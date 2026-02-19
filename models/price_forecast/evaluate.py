"""
Price Forecast -- Backtesting Evaluation
==========================================
Loads the production model for each NEM region from MLflow Model Registry,
evaluates on the held-out test set, computes detailed metrics, and saves
a structured evaluation report.

Metrics computed:
  - MAE (all prices)
  - MAE (excluding spikes > $500/MWh)
  - MAPE (all / normal / spike segments)
  - Spike detection recall  (events where true price > $500/MWh)
  - Comparison against AEMO pre-dispatch baseline (gold.aemo_predispatch_prices)

Outputs:
  - Printed summary table to stdout / Databricks notebook output
  - JSON report written to MLflow artifact store
  - gold.price_forecast_evaluation Delta table (for Databricks SQL / Genie)

Usage
-----
  python evaluate.py           # run all 5 regions
  python evaluate.py NSW1      # run one region
"""

from __future__ import annotations

import json
import logging
import os
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
PREDISPATCH_TABLE = f"{GOLD}.aemo_predispatch_prices"
EVAL_TABLE    = f"{GOLD}.price_forecast_evaluation"

NEM_REGIONS: List[str] = ["NSW1", "QLD1", "SA1", "TAS1", "VIC1"]

SPIKE_THRESHOLD = 500.0     # $/MWh
MODEL_NAME_TMPL = "price_forecast_{region}"
MODEL_ALIAS     = "production"
MLFLOW_EXPERIMENT = "/energy_copilot/price_forecast_evaluation"


# ---------------------------------------------------------------------------
# Load model from MLflow
# ---------------------------------------------------------------------------

def load_production_model(region: str) -> mlflow.pyfunc.PyFuncModel:
    """
    Load the model registered under alias 'production' for a given region.
    Raises a clear error if the model or alias is not found.
    """
    model_name = MODEL_NAME_TMPL.format(region=region.lower().replace("1", ""))
    model_uri  = f"models:/{model_name}@{MODEL_ALIAS}"
    logger.info("Loading model: %s", model_uri)
    try:
        model = mlflow.pyfunc.load_model(model_uri)
    except mlflow.exceptions.MlflowException as exc:
        raise RuntimeError(
            f"Could not load model '{model_uri}'. "
            "Ensure train.py has been run and the model registered."
        ) from exc
    return model


# ---------------------------------------------------------------------------
# Load test data
# ---------------------------------------------------------------------------

def load_test_data(
    spark: SparkSession,
    region: str,
    val_end: Optional[datetime],
    test_end: Optional[datetime],
) -> pd.DataFrame:
    """
    Load the held-out test split for a region.  If val_end/test_end are not
    supplied, reads the boundaries from the production model's MLflow tags.
    """
    if val_end is None or test_end is None:
        client = MlflowClient()
        model_name = MODEL_NAME_TMPL.format(region=region.lower().replace("1", ""))
        versions = client.get_model_version_by_alias(model_name, MODEL_ALIAS)
        run = client.get_run(versions.run_id)
        val_end_str  = run.data.tags.get("val_end")
        test_end_str = run.data.tags.get("test_end")
        if not (val_end_str and test_end_str):
            raise ValueError(
                "val_end / test_end tags not found on MLflow run. "
                "Re-run train.py to regenerate the model with proper tags."
            )
        val_end  = datetime.fromisoformat(val_end_str)
        test_end = datetime.fromisoformat(test_end_str)

    logger.info(
        "Loading test data for %s: [%s, %s)",
        region, val_end.date(), test_end.date(),
    )

    df_spark = (
        spark.table(FEATURE_TABLE)
        .filter(F.col("regionid") == region)
        .filter(F.col("settlementdate") >= F.lit(val_end.isoformat()))
        .filter(F.col("settlementdate") <  F.lit(test_end.isoformat()))
        .orderBy("settlementdate", "forecast_horizon")
    )
    df = df_spark.toPandas()

    # Match the same categorical encoding used in training
    if "season" in df.columns:
        dummies = pd.get_dummies(df["season"], prefix="season", drop_first=False)
        df = pd.concat([df.drop(columns=["season"]), dummies], axis=1)

    return df


# ---------------------------------------------------------------------------
# AEMO pre-dispatch baseline
# ---------------------------------------------------------------------------

def load_predispatch_baseline(
    spark: SparkSession,
    region: str,
    val_end: datetime,
    test_end: datetime,
) -> Optional[pd.DataFrame]:
    """
    Attempt to load AEMO pre-dispatch price forecasts from the Gold table.
    Returns None if the table is absent or has no data for the region/period.
    """
    try:
        baseline = (
            spark.table(PREDISPATCH_TABLE)
            .filter(F.col("regionid") == region)
            .filter(F.col("predispatchseqno") >= F.lit(val_end.isoformat()))
            .filter(F.col("predispatchseqno") <  F.lit(test_end.isoformat()))
            .select(
                F.col("predispatchseqno").alias("settlementdate"),
                "forecast_horizon",
                F.col("rrp").alias("predispatch_rrp"),
            )
        ).toPandas()
        return baseline if not baseline.empty else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Pre-dispatch baseline unavailable: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Metric computation
# ---------------------------------------------------------------------------

def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    label:  str = "model",
) -> Dict[str, float]:
    """Compute MAE, MAPE, spike recall for a prediction array."""
    eps = 1e-6
    abs_err  = np.abs(y_true - y_pred)
    pct_err  = abs_err / (np.abs(y_true) + eps)

    spike_mask  = y_true > SPIKE_THRESHOLD
    normal_mask = ~spike_mask

    # Spike detection: predicted > SPIKE_THRESHOLD when actual > SPIKE_THRESHOLD
    pred_spike_mask = y_pred > SPIKE_THRESHOLD
    tp = int((spike_mask & pred_spike_mask).sum())
    fn = int((spike_mask & ~pred_spike_mask).sum())
    spike_recall = tp / (tp + fn) if (tp + fn) > 0 else float("nan")

    return {
        f"{label}_mae_all":             float(np.mean(abs_err)),
        f"{label}_mape_all_pct":        float(np.mean(pct_err) * 100.0),
        f"{label}_mae_normal":          float(np.mean(abs_err[normal_mask]))  if normal_mask.any() else float("nan"),
        f"{label}_mae_spike":           float(np.mean(abs_err[spike_mask]))   if spike_mask.any() else float("nan"),
        f"{label}_mape_normal_pct":     float(np.mean(pct_err[normal_mask]) * 100.0) if normal_mask.any() else float("nan"),
        f"{label}_mape_spike_pct":      float(np.mean(pct_err[spike_mask]) * 100.0)  if spike_mask.any() else float("nan"),
        f"{label}_spike_recall":        spike_recall,
        f"{label}_n_true_spikes":       int(spike_mask.sum()),
        f"{label}_n_detected_spikes":   int(pred_spike_mask.sum()),
    }


# ---------------------------------------------------------------------------
# Evaluate one region
# ---------------------------------------------------------------------------

def evaluate_region(
    spark:    SparkSession,
    region:   str,
    val_end:  Optional[datetime] = None,
    test_end: Optional[datetime] = None,
) -> Dict:
    """
    Full evaluation pipeline for a single region.  Returns a dict with
    all metrics and metadata that can be serialised to JSON.
    """
    model    = load_production_model(region)
    df_test  = load_test_data(spark, region, val_end, test_end)

    # Align feature columns to what the model expects
    model_feat_cols = model.metadata.get_input_schema().input_names()
    # Fill any new columns with 0 (handles season dummies that may have been
    # absent during training for that region)
    for col in model_feat_cols:
        if col not in df_test.columns:
            df_test[col] = 0.0
    X_test = df_test[model_feat_cols]

    y_true = df_test["rrp_target"].values
    y_pred = model.predict(X_test)

    model_metrics = compute_metrics(y_true, y_pred, label="model")

    # Per-horizon breakdown
    horizon_metrics: List[Dict] = []
    for horizon in sorted(df_test["forecast_horizon"].unique()):
        mask = df_test["forecast_horizon"] == horizon
        if mask.sum() == 0:
            continue
        hm = compute_metrics(y_true[mask], y_pred[mask], label=f"h{horizon}")
        hm["forecast_horizon"] = int(horizon)
        horizon_metrics.append(hm)

    # AEMO pre-dispatch baseline comparison
    # We need val_end/test_end resolved -- re-read if needed
    if val_end is None:
        client = MlflowClient()
        mn = MODEL_NAME_TMPL.format(region=region.lower().replace("1", ""))
        v  = client.get_model_version_by_alias(mn, MODEL_ALIAS)
        run = client.get_run(v.run_id)
        val_end  = datetime.fromisoformat(run.data.tags["val_end"])
        test_end = datetime.fromisoformat(run.data.tags["test_end"])

    baseline_df = load_predispatch_baseline(spark, region, val_end, test_end)
    baseline_metrics: Optional[Dict] = None
    if baseline_df is not None:
        merged = df_test.merge(
            baseline_df,
            on=["settlementdate", "forecast_horizon"],
            how="inner",
        )
        if not merged.empty:
            baseline_metrics = compute_metrics(
                merged["rrp_target"].values,
                merged["predispatch_rrp"].values,
                label="baseline",
            )

    result = {
        "region":           region,
        "evaluation_time":  datetime.utcnow().isoformat(),
        "n_test_rows":      int(len(df_test)),
        "model_metrics":    model_metrics,
        "horizon_metrics":  horizon_metrics,
        "baseline_metrics": baseline_metrics,
    }

    # Print summary
    logger.info("--- %s Results ---", region)
    logger.info("  MAE (all):          %.2f $/MWh", model_metrics["model_mae_all"])
    logger.info("  MAE (normal):       %.2f $/MWh", model_metrics["model_mae_normal"])
    logger.info("  MAE (spike):        %.2f $/MWh", model_metrics["model_mae_spike"])
    logger.info("  MAPE (all):         %.2f %%",    model_metrics["model_mape_all_pct"])
    logger.info("  Spike recall:       %.3f",       model_metrics["model_spike_recall"])
    if baseline_metrics:
        logger.info(
            "  Baseline MAE (all): %.2f $/MWh",
            baseline_metrics["baseline_mae_all"],
        )

    return result


# ---------------------------------------------------------------------------
# Save evaluation report
# ---------------------------------------------------------------------------

def save_report(spark: SparkSession, results: List[Dict]) -> None:
    """
    Persist the evaluation results to:
      1. MLflow artifact (JSON)
      2. gold.price_forecast_evaluation Delta table
    """
    report_path = "/tmp/price_forecast_eval_report.json"
    with open(report_path, "w") as fh:
        json.dump(results, fh, indent=2, default=str)
    mlflow.log_artifact(report_path, artifact_path="evaluation")
    logger.info("Evaluation report saved to MLflow artifact store.")

    # Flatten for Delta table storage
    rows = []
    for r in results:
        base = {
            "region":          r["region"],
            "evaluation_time": r["evaluation_time"],
            "n_test_rows":     r["n_test_rows"],
            **r["model_metrics"],
        }
        if r["baseline_metrics"]:
            base.update(r["baseline_metrics"])
        rows.append(base)

    eval_df = spark.createDataFrame(pd.DataFrame(rows))
    (
        eval_df.write
        .format("delta")
        .mode("overwrite")
        .option("overwriteSchema", "true")
        .saveAsTable(EVAL_TABLE)
    )
    logger.info("Evaluation results written to %s", EVAL_TABLE)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run_evaluation(spark: SparkSession, regions: Optional[List[str]] = None) -> None:
    mlflow.set_experiment(MLFLOW_EXPERIMENT)
    regions = regions or NEM_REGIONS

    with mlflow.start_run(run_name="price_forecast_evaluation"):
        results = []
        for region in regions:
            try:
                result = evaluate_region(spark, region)
                results.append(result)
            except Exception as exc:  # noqa: BLE001
                logger.error("Evaluation failed for %s: %s", region, exc, exc_info=True)

        save_report(spark, results)


if __name__ == "__main__":
    spark  = SparkSession.builder.getOrCreate()
    target_regions = sys.argv[1:] if len(sys.argv) > 1 else None
    run_evaluation(spark, target_regions)
