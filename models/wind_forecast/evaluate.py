"""
Wind Generation Forecast -- Evaluation
=========================================
Loads the production wind forecast model per region and evaluates on the
held-out test set.

Metrics: MAE (MW), RMSE (MW), MAPE (%), capacity factor error.
Output : gold.wind_forecast_evaluation Delta table + MLflow artifact.
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

CATALOG       = "energy_copilot"
GOLD          = f"{CATALOG}.gold"
FEATURE_TABLE = f"{GOLD}.feature_store_price"
EVAL_TABLE    = f"{GOLD}.wind_forecast_evaluation"

NEM_REGIONS: List[str]  = ["NSW1", "QLD1", "SA1", "TAS1", "VIC1"]
MODEL_NAME_TMPL  = "wind_forecast_{region}"
MODEL_ALIAS      = "production"
MLFLOW_EXPERIMENT = "/energy_copilot/wind_forecast_evaluation"
LABEL_COL         = "wind_generation_target"
FORECAST_HORIZONS = [1, 4, 8, 12, 24, 48]


def load_model(region):
    mn = MODEL_NAME_TMPL.format(region=region.lower().replace("1", ""))
    return mlflow.pyfunc.load_model(f"models:/{mn}@{MODEL_ALIAS}")


def load_test_data(spark, region):
    client = MlflowClient()
    mn = MODEL_NAME_TMPL.format(region=region.lower().replace("1", ""))
    v  = client.get_model_version_by_alias(mn, MODEL_ALIAS)
    run = client.get_run(v.run_id)
    val_end  = datetime.fromisoformat(run.data.tags["val_end"])
    test_end = datetime.fromisoformat(run.data.tags["test_end"])

    base = (
        spark.table(FEATURE_TABLE)
        .filter(F.col("regionid") == region)
        .filter(F.col("settlementdate") >= F.lit(val_end.isoformat()))
        .filter(F.col("settlementdate") <  F.lit(test_end.isoformat()))
        .dropDuplicates(["settlementdate", "regionid"])
    )
    horizons_df = spark.createDataFrame(
        [(h,) for h in FORECAST_HORIZONS],
        schema=T.StructType([T.StructField("forecast_horizon", T.IntegerType(), False)]),
    )
    df_x = base.crossJoin(horizons_df).withColumn(
        "_ts",
        (F.col("settlementdate").cast("long") + F.col("forecast_horizon") * 300).cast("timestamp"),
    )
    future = base.select(
        F.col("settlementdate").alias("_fts"),
        F.col("regionid").alias("_fr"),
        F.col("gen_wind_mw").alias(LABEL_COL),
    )
    df_x = (
        df_x.join(future, (F.col("_ts") == F.col("_fts")) & (F.col("regionid") == F.col("_fr")), "left")
        .drop("_ts", "_fts", "_fr")
        .filter(F.col(LABEL_COL).isNotNull())
    )
    df = df_x.toPandas()
    if "season" in df.columns:
        dummies = pd.get_dummies(df["season"], prefix="season", drop_first=False)
        df = pd.concat([df.drop(columns=["season"]), dummies], axis=1)
    return df


def compute_metrics(y_true, y_pred):
    abs_err = np.abs(y_true - y_pred)
    eps = 1.0
    return {
        "mae":       float(np.mean(abs_err)),
        "rmse":      float(np.sqrt(np.mean(abs_err ** 2))),
        "mape_pct":  float(np.mean(abs_err / (np.abs(y_true) + eps)) * 100.0),
        "bias_mw":   float(np.mean(y_pred - y_true)),
    }


def evaluate_region(spark, region):
    model  = load_model(region)
    df     = load_test_data(spark, region)
    feats  = model.metadata.get_input_schema().input_names()
    for c in feats:
        if c not in df.columns:
            df[c] = 0.0
    y_true = df[LABEL_COL].values
    y_pred = model.predict(df[feats])
    metrics = compute_metrics(y_true, y_pred)
    h_metrics = []
    for h in sorted(df["forecast_horizon"].unique()):
        m = df["forecast_horizon"] == h
        hm = compute_metrics(y_true[m], y_pred[m])
        hm["forecast_horizon"] = int(h)
        h_metrics.append(hm)
    result = {
        "region": region,
        "evaluation_time": datetime.utcnow().isoformat(),
        "overall_metrics": metrics,
        "horizon_metrics": h_metrics,
    }
    logger.info("%s | MAE: %.1f MW | MAPE: %.2f%%", region, metrics["mae"], metrics["mape_pct"])
    return result


def run_evaluation(spark, regions=None):
    mlflow.set_experiment(MLFLOW_EXPERIMENT)
    regions = regions or NEM_REGIONS
    with mlflow.start_run(run_name="wind_forecast_evaluation"):
        results = []
        for region in regions:
            try:
                results.append(evaluate_region(spark, region))
            except Exception as exc:
                logger.error("Evaluation failed for %s: %s", region, exc, exc_info=True)
        rpt = "/tmp/wind_forecast_eval_report.json"
        with open(rpt, "w") as fh:
            json.dump(results, fh, indent=2, default=str)
        mlflow.log_artifact(rpt, artifact_path="evaluation")
        rows = [{"region": r["region"], **r["overall_metrics"]} for r in results]
        (
            spark.createDataFrame(pd.DataFrame(rows))
            .write.format("delta").mode("overwrite").option("overwriteSchema", "true")
            .saveAsTable(EVAL_TABLE)
        )
        logger.info("Wind evaluation written to %s", EVAL_TABLE)


if __name__ == "__main__":
    spark  = SparkSession.builder.getOrCreate()
    target = sys.argv[1:] if len(sys.argv) > 1 else None
    run_evaluation(spark, target)
