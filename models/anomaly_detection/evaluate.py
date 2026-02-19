"""
Anomaly Detection -- Evaluation
==================================
Evaluates the production anomaly detector against known historical NEM
market events, computing precision/recall for spike, negative, and
separation event types.

Known historical events are loaded from
  gold.known_market_events
which must contain columns:
  - settlementdate  (timestamp)
  - regionid        (str)
  - event_type      ("spike" | "negative" | "separation")
  - event_description (str, optional)

If gold.known_market_events does not exist the evaluation will fall back
to rule-based ground truth derived from the price data itself (treating
actual prices > SPIKE_THRESHOLD as true spikes, etc.).

Metrics computed:
  - Precision, Recall, F1 per event_type
  - Overall ROC-AUC for is_anomaly (binary) using anomaly_score
  - False positive rate on normal periods

Outputs:
  - gold.anomaly_detection_evaluation Delta table
  - MLflow artifact: anomaly_eval_report.json
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime
from typing import Dict, List, Optional

import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
from mlflow.tracking import MlflowClient
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score,
)
from pyspark.sql import SparkSession
import pyspark.sql.functions as F

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CATALOG       = "energy_copilot"
GOLD          = f"{CATALOG}.gold"
FEATURE_TABLE = f"{GOLD}.feature_store_price"
EVENTS_TABLE  = f"{GOLD}.known_market_events"
EVAL_TABLE    = f"{GOLD}.anomaly_detection_evaluation"

MODEL_NAME        = "anomaly_detector"
MODEL_ALIAS       = "production"
MLFLOW_EXPERIMENT = "/energy_copilot/anomaly_detection_evaluation"

SPIKE_THRESHOLD      =  5_000.0
NEGATIVE_THRESHOLD   =   -100.0
SEPARATION_THRESHOLD =    500.0

FEATURE_COLS_IF = [
    "rrp", "totaldemand",
    "price_t_minus_1", "price_t_minus_6", "price_t_minus_12", "price_t_minus_288",
    "demand_t_minus_1",
    "price_mean_1hr", "price_std_1hr", "price_max_1hr",
    "price_mean_4hr", "price_std_4hr",
    "price_mean_24hr",
    "gen_wind_mw", "gen_solar_mw", "gen_gas_mw", "gen_black_coal_mw", "gen_hydro_mw",
    "net_import_mw", "ic_utilisation",
    "temperature_2m", "shortwave_radiation",
    "nem_total_demand_mw", "nem_capacity_utilisation", "price_spread_to_national",
    "hour_of_day", "is_weekend", "is_public_holiday",
]


# ---------------------------------------------------------------------------
# Rule-based ground-truth helper (fallback when no labelled events table)
# ---------------------------------------------------------------------------

def build_rule_ground_truth(df: pd.DataFrame) -> pd.Series:
    cond_spike     = df["rrp"] >= SPIKE_THRESHOLD
    cond_negative  = df["rrp"] <= NEGATIVE_THRESHOLD
    cond_sep       = df.get("price_spread_to_national", pd.Series(0.0, index=df.index)).abs() >= SEPARATION_THRESHOLD
    gt = pd.Series("normal", index=df.index)
    gt = gt.where(~cond_sep,      "separation")
    gt = gt.where(~cond_negative, "negative")
    gt = gt.where(~cond_spike,    "spike")
    return gt


# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------

def load_test_data(spark: SparkSession) -> pd.DataFrame:
    """Load the most recent 3-month test period from the feature store."""
    client = MlflowClient()
    v  = client.get_model_version_by_alias(MODEL_NAME, MODEL_ALIAS)
    run = client.get_run(v.run_id)
    # The anomaly model is trained on train+val; test = last 3 months
    # Infer test window from tags if available, else use last 90 days
    test_start_str = run.data.tags.get("test_start")
    test_end_str   = run.data.tags.get("test_end")

    if test_start_str and test_end_str:
        test_start = datetime.fromisoformat(test_start_str)
        test_end   = datetime.fromisoformat(test_end_str)
    else:
        max_ts = (
            spark.table(FEATURE_TABLE)
            .agg(F.max("settlementdate").alias("m"))
            .collect()[0]["m"]
        )
        from datetime import timedelta
        test_end   = max_ts
        test_start = max_ts - timedelta(days=90)

    df_spark = (
        spark.table(FEATURE_TABLE)
        .filter(F.col("settlementdate") >= F.lit(test_start.isoformat()))
        .filter(F.col("settlementdate") <  F.lit(test_end.isoformat()))
        .dropDuplicates(["settlementdate", "regionid"])
        .select(["settlementdate", "regionid"] + FEATURE_COLS_IF + ["price_spread_to_national"])
    )
    return df_spark.toPandas()


def load_known_events(spark: SparkSession, df_test: pd.DataFrame) -> pd.Series:
    """
    Load ground-truth event labels from gold.known_market_events.
    Falls back to rule-based ground truth if the table does not exist.
    """
    try:
        events_df = (
            spark.table(EVENTS_TABLE)
            .select("settlementdate", "regionid", "event_type")
        ).toPandas()
        # Merge onto test set; unmatched rows get label "normal"
        merged = df_test[["settlementdate", "regionid"]].merge(
            events_df, on=["settlementdate", "regionid"], how="left"
        )
        merged["event_type"] = merged["event_type"].fillna("normal")
        return merged["event_type"]
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Could not load %s (%s); using rule-based ground truth.",
            EVENTS_TABLE, exc,
        )
        return build_rule_ground_truth(df_test)


# ---------------------------------------------------------------------------
# Evaluate
# ---------------------------------------------------------------------------

def run_evaluation(spark: SparkSession) -> None:
    mlflow.set_experiment(MLFLOW_EXPERIMENT)

    # Load model
    model_uri = f"models:/{MODEL_NAME}@{MODEL_ALIAS}"
    logger.info("Loading model: %s", model_uri)
    model = mlflow.sklearn.load_model(model_uri)

    df_test = load_test_data(spark)
    y_true  = load_known_events(spark, df_test)

    X = df_test[FEATURE_COLS_IF].fillna(0.0).values

    # IsolationForest outputs
    anomaly_scores = model.decision_function(X)
    is_anomaly     = (model.predict(X) == -1).astype(int)

    # Rule-based event classification applied to raw features
    from models.anomaly_detection.train import classify_events  # noqa: PLC0415
    # Inline classify_events to avoid import path issues in Databricks
    cond_spike = df_test["rrp"] >= SPIKE_THRESHOLD
    cond_neg   = df_test["rrp"] <= NEGATIVE_THRESHOLD
    cond_sep   = df_test.get("price_spread_to_national", pd.Series(0.0)).abs() >= SEPARATION_THRESHOLD
    event_type_pred = pd.Series("normal", index=df_test.index)
    event_type_pred = event_type_pred.where(~cond_sep,  "separation")
    event_type_pred = event_type_pred.where(~cond_neg,  "negative")
    event_type_pred = event_type_pred.where(~cond_spike,"spike")

    # Metrics
    event_classes = ["spike", "negative", "separation", "normal"]
    cr = classification_report(y_true, event_type_pred, labels=event_classes, output_dict=True, zero_division=0)
    pr, rc, f1, sup = precision_recall_fscore_support(
        y_true, event_type_pred, labels=event_classes, zero_division=0
    )

    # Binary anomaly AUC (normal=0 vs any event=1)
    y_binary_true = (y_true != "normal").astype(int)
    # anomaly_score: lower = more anomalous; negate for standard AUC (higher = positive)
    try:
        auc = roc_auc_score(y_binary_true, -anomaly_scores)
    except ValueError:
        auc = float("nan")

    # False positive rate on normal periods
    normal_mask = y_true == "normal"
    fp_rate = float(is_anomaly[normal_mask].mean()) if normal_mask.any() else float("nan")

    results = {
        "evaluation_time": datetime.utcnow().isoformat(),
        "n_test_rows":     len(df_test),
        "roc_auc_anomaly": auc,
        "false_positive_rate_normal": fp_rate,
        "classification_report": cr,
        "per_class": {
            cls: {
                "precision": float(pr[i]),
                "recall":    float(rc[i]),
                "f1":        float(f1[i]),
                "support":   int(sup[i]),
            }
            for i, cls in enumerate(event_classes)
        },
    }

    logger.info("ROC-AUC (binary anomaly): %.4f", auc)
    logger.info("False positive rate on normal: %.4f", fp_rate)
    for cls in ["spike", "negative", "separation"]:
        idx = event_classes.index(cls)
        logger.info(
            "%-12s | Precision: %.3f | Recall: %.3f | F1: %.3f | Support: %d",
            cls.upper(), pr[idx], rc[idx], f1[idx], sup[idx],
        )

    with mlflow.start_run(run_name="anomaly_detector_evaluation"):
        mlflow.log_metric("roc_auc_binary", auc)
        mlflow.log_metric("fp_rate_normal", fp_rate)
        for cls in ["spike", "negative", "separation"]:
            idx = event_classes.index(cls)
            mlflow.log_metrics({
                f"precision_{cls}": float(pr[idx]),
                f"recall_{cls}":    float(rc[idx]),
                f"f1_{cls}":        float(f1[idx]),
            })

        rpt_path = "/tmp/anomaly_eval_report.json"
        with open(rpt_path, "w") as fh:
            json.dump(results, fh, indent=2, default=str)
        mlflow.log_artifact(rpt_path, artifact_path="evaluation")

        # Write flattened results to Delta table
        flat_rows = [
            {
                "evaluation_time": results["evaluation_time"],
                "n_test_rows":     results["n_test_rows"],
                "roc_auc_anomaly": auc,
                "fp_rate_normal":  fp_rate,
                "event_class":     cls,
                **results["per_class"][cls],
            }
            for cls in event_classes
        ]
        (
            spark.createDataFrame(pd.DataFrame(flat_rows))
            .write.format("delta").mode("overwrite").option("overwriteSchema", "true")
            .saveAsTable(EVAL_TABLE)
        )
        logger.info("Anomaly evaluation written to %s", EVAL_TABLE)


if __name__ == "__main__":
    spark = SparkSession.builder.getOrCreate()
    run_evaluation(spark)
