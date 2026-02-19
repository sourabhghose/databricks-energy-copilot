"""
Demand Forecast -- Evaluation
================================
Loads the production demand forecast model per NEM region, evaluates on the
held-out test set, and checks whether the MAPE target of < 3% is achieved.

Outputs:
  - Printed per-region summary (MAPE, MAE, RMSE)
  - MLflow artifact: demand_forecast_eval_report.json
  - gold.demand_forecast_evaluation Delta table
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime
from typing import Dict, List, Optional

import mlflow
import numpy as np
import pandas as pd
from mlflow.tracking import MlflowClient
from pyspark.sql import SparkSession
import pyspark.sql.functions as F
import pyspark.sql.types as T

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CATALOG       = "energy_copilot"
GOLD          = f"{CATALOG}.gold"
FEATURE_TABLE = f"{GOLD}.feature_store_price"
EVAL_TABLE    = f"{GOLD}.demand_forecast_evaluation"

NEM_REGIONS: List[str] = ["NSW1", "QLD1", "SA1", "TAS1", "VIC1"]
MODEL_NAME_TMPL = "demand_forecast_{region}"
MODEL_ALIAS     = "production"
MLFLOW_EXPERIMENT = "/energy_copilot/demand_forecast_evaluation"

FORECAST_HORIZONS: List[int] = [1, 4, 8, 12, 24, 48]
MAPE_TARGET_PCT = 3.0

EXCLUDED_COLS = {
    "settlementdate", "settlement_date", "regionid", "rrp", "totaldemand",
    "rrp_target", "demand_target", "feature_timestamp", "season",
}


# ---------------------------------------------------------------------------
# Helpers (reuse pattern from price evaluate.py)
# ---------------------------------------------------------------------------

def load_model(region: str) -> mlflow.pyfunc.PyFuncModel:
    model_name = MODEL_NAME_TMPL.format(region=region.lower().replace("1", ""))
    return mlflow.pyfunc.load_model(f"models:/{model_name}@{MODEL_ALIAS}")


def load_test_data(
    spark: SparkSession, region: str
) -> pd.DataFrame:
    """Load test data; infer split from model MLflow tags."""
    client = MlflowClient()
    mn = MODEL_NAME_TMPL.format(region=region.lower().replace("1", ""))
    v  = client.get_model_version_by_alias(mn, MODEL_ALIAS)
    run = client.get_run(v.run_id)
    val_end  = datetime.fromisoformat(run.data.tags["val_end"])
    test_end = datetime.fromisoformat(run.data.tags["test_end"])

    df_base = (
        spark.table(FEATURE_TABLE)
        .filter(F.col("regionid") == region)
        .filter(F.col("settlementdate") >= F.lit(val_end.isoformat()))
        .filter(F.col("settlementdate") <  F.lit(test_end.isoformat()))
        .dropDuplicates(["settlementdate", "regionid"])
    )

    # Add demand_target horizons
    horizons_df = spark.createDataFrame(
        [(h,) for h in FORECAST_HORIZONS],
        schema=T.StructType([T.StructField("forecast_horizon", T.IntegerType(), False)]),
    )
    df_x = df_base.crossJoin(horizons_df)
    df_x = df_x.withColumn(
        "_target_ts",
        (F.col("settlementdate").cast("long") + F.col("forecast_horizon") * 300).cast("timestamp"),
    )
    future = df_base.select(
        F.col("settlementdate").alias("_fts"),
        F.col("regionid").alias("_fr"),
        F.col("totaldemand").alias("demand_target"),
    )
    df_x = (
        df_x.join(future, (F.col("_target_ts") == F.col("_fts")) & (F.col("regionid") == F.col("_fr")), "left")
        .drop("_target_ts", "_fts", "_fr")
        .filter(F.col("demand_target").isNotNull())
    )

    df = df_x.toPandas()
    if "season" in df.columns:
        dummies = pd.get_dummies(df["season"], prefix="season", drop_first=False)
        df = pd.concat([df.drop(columns=["season"]), dummies], axis=1)
    return df


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    eps = 1.0
    abs_err = np.abs(y_true - y_pred)
    return {
        "mae":      float(np.mean(abs_err)),
        "rmse":     float(np.sqrt(np.mean(abs_err ** 2))),
        "mape_pct": float(np.mean(abs_err / (np.abs(y_true) + eps)) * 100.0),
    }


# ---------------------------------------------------------------------------
# Region evaluation
# ---------------------------------------------------------------------------

def evaluate_region(spark: SparkSession, region: str) -> Dict:
    model   = load_model(region)
    df_test = load_test_data(spark, region)

    feat_cols = model.metadata.get_input_schema().input_names()
    for col in feat_cols:
        if col not in df_test.columns:
            df_test[col] = 0.0

    y_true = df_test["demand_target"].values
    y_pred = model.predict(df_test[feat_cols])

    overall = compute_metrics(y_true, y_pred)
    mape_ok = overall["mape_pct"] < MAPE_TARGET_PCT

    horizon_metrics = []
    for h in sorted(df_test["forecast_horizon"].unique()):
        m = df_test["forecast_horizon"] == h
        hm = compute_metrics(y_true[m], y_pred[m])
        hm["forecast_horizon"] = int(h)
        horizon_metrics.append(hm)

    result = {
        "region":          region,
        "evaluation_time": datetime.utcnow().isoformat(),
        "n_test_rows":     len(df_test),
        "overall_metrics": overall,
        "mape_target_met": mape_ok,
        "horizon_metrics": horizon_metrics,
    }

    icon = "PASS" if mape_ok else "FAIL"
    logger.info(
        "[%s] %s | MAE: %.1f MW | MAPE: %.2f%% (target <%.1f%%)",
        icon, region, overall["mae"], overall["mape_pct"], MAPE_TARGET_PCT,
    )
    return result


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run_evaluation(spark: SparkSession, regions: Optional[List[str]] = None) -> None:
    mlflow.set_experiment(MLFLOW_EXPERIMENT)
    regions = regions or NEM_REGIONS

    with mlflow.start_run(run_name="demand_forecast_evaluation"):
        results = []
        for region in regions:
            try:
                results.append(evaluate_region(spark, region))
            except Exception as exc:
                logger.error("Evaluation failed for %s: %s", region, exc, exc_info=True)

        report_path = "/tmp/demand_forecast_eval_report.json"
        with open(report_path, "w") as fh:
            json.dump(results, fh, indent=2, default=str)
        mlflow.log_artifact(report_path, artifact_path="evaluation")

        rows = [
            {"region": r["region"], **r["overall_metrics"],
             "mape_target_met": r["mape_target_met"]}
            for r in results
        ]
        (
            spark.createDataFrame(pd.DataFrame(rows))
            .write.format("delta")
            .mode("overwrite").option("overwriteSchema", "true")
            .saveAsTable(EVAL_TABLE)
        )
        logger.info("Demand evaluation written to %s", EVAL_TABLE)


if __name__ == "__main__":
    spark  = SparkSession.builder.getOrCreate()
    target = sys.argv[1:] if len(sys.argv) > 1 else None
    run_evaluation(spark, target)
