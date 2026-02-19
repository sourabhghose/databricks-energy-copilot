"""
Anomaly Detection -- Training
================================
Two-stage anomaly detection for NEM electricity market events:

Stage 1 -- Unsupervised: IsolationForest trained on price, demand, and
           generation features to produce an anomaly_score per dispatch
           interval. A lower score (more negative) = more anomalous.

Stage 2 -- Rule-based classification on top of the raw features:
           - spike:     rrp > SPIKE_THRESHOLD    ($5,000/MWh)
           - negative:  rrp < NEGATIVE_THRESHOLD (-$100/MWh)
           - separation: rrp in any region diverges from NEM avg by >
                         SEPARATION_THRESHOLD ($500/MWh) (possible
                         system separation or large transmission constraint)
           - normal:    everything else

Output per interval:
  - anomaly_score (float)  : IsolationForest decision function output
  - is_anomaly (int)       : 1 if IsolationForest labels the row as outlier
  - event_type (str)       : "normal" | "spike" | "negative" | "separation"

The combined model (IsolationForest + rule classifier) is logged to MLflow
and registered as "anomaly_detector" with alias "production".

Feature source: gold.feature_store_price (one row per settlementdate × region,
                not exploded across horizons -- just current-interval features).

Platform: Databricks Runtime 15.4 LTS+
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
from mlflow.tracking import MlflowClient
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
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

MLFLOW_EXPERIMENT = "/energy_copilot/anomaly_detection_training"
MODEL_NAME        = "anomaly_detector"

# Rule-based thresholds (AUD/MWh)
SPIKE_THRESHOLD      =  5_000.0
NEGATIVE_THRESHOLD   =   -100.0
SEPARATION_THRESHOLD =    500.0   # regional price divergence from NEM average

# IsolationForest hyperparameters
IF_CONTAMINATION   = 0.02    # ~2% of intervals expected to be anomalous
IF_N_ESTIMATORS    = 200
IF_MAX_SAMPLES     = "auto"
IF_RANDOM_STATE    = 42

# Training window (use full available history for anomaly model)
TRAINING_MONTHS = 21   # same as train+val combined in forecast models

FEATURE_COLS_IF = [
    "rrp",
    "totaldemand",
    "price_t_minus_1",
    "price_t_minus_6",
    "price_t_minus_12",
    "price_t_minus_288",
    "demand_t_minus_1",
    "price_mean_1hr",
    "price_std_1hr",
    "price_max_1hr",
    "price_mean_4hr",
    "price_std_4hr",
    "price_mean_24hr",
    "gen_wind_mw",
    "gen_solar_mw",
    "gen_gas_mw",
    "gen_black_coal_mw",
    "gen_hydro_mw",
    "net_import_mw",
    "ic_utilisation",
    "temperature_2m",
    "shortwave_radiation",
    "nem_total_demand_mw",
    "nem_capacity_utilisation",
    "price_spread_to_national",
    "hour_of_day",
    "is_weekend",
    "is_public_holiday",
]


# ---------------------------------------------------------------------------
# Rule-based event classifier
# ---------------------------------------------------------------------------

def classify_events(df: pd.DataFrame) -> pd.Series:
    """
    Apply deterministic rules to classify each row into an event_type.

    Priority order (first match wins):
      1. spike     -- rrp >= SPIKE_THRESHOLD
      2. negative  -- rrp <= NEGATIVE_THRESHOLD
      3. separation -- |price_spread_to_national| >= SEPARATION_THRESHOLD
      4. normal
    """
    cond_spike     = df["rrp"] >= SPIKE_THRESHOLD
    cond_negative  = df["rrp"] <= NEGATIVE_THRESHOLD
    cond_separation = (
        df.get("price_spread_to_national", pd.Series(0.0, index=df.index)).abs()
        >= SEPARATION_THRESHOLD
    )

    event_type = pd.Series("normal", index=df.index)
    event_type = event_type.where(~cond_separation, "separation")
    event_type = event_type.where(~cond_negative,   "negative")
    event_type = event_type.where(~cond_spike,      "spike")

    return event_type


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_training_data(spark: SparkSession) -> pd.DataFrame:
    """
    Load the most recent TRAINING_MONTHS of data from the feature store.
    Uses one row per (settlementdate, regionid) -- not the horizon-exploded view.
    """
    max_ts = (
        spark.table(FEATURE_TABLE)
        .agg(F.max("settlementdate").alias("max_ts"))
        .collect()[0]["max_ts"]
    )
    cutoff = max_ts - timedelta(days=TRAINING_MONTHS * 30)

    df_spark = (
        spark.table(FEATURE_TABLE)
        .filter(F.col("settlementdate") >= F.lit(cutoff.isoformat()))
        .dropDuplicates(["settlementdate", "regionid"])
        .select(["settlementdate", "regionid"] + FEATURE_COLS_IF
                + ["price_spread_to_national"])
    )
    return df_spark.toPandas()


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_anomaly_detector(spark: SparkSession) -> None:
    logger.info("Loading training data ...")
    df = load_training_data(spark)
    logger.info("Training rows: %d", len(df))

    # Keep only the IF feature columns; fill NaN from warm-start lags
    X = df[FEATURE_COLS_IF].fillna(0.0).values

    # IsolationForest wrapped in a StandardScaler pipeline so that the
    # sklearn artifact includes preprocessing (important for MLflow signature)
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("isoforest", IsolationForest(
            contamination=IF_CONTAMINATION,
            n_estimators=IF_N_ESTIMATORS,
            max_samples=IF_MAX_SAMPLES,
            random_state=IF_RANDOM_STATE,
            n_jobs=-1,
        )),
    ])

    logger.info("Fitting IsolationForest ...")
    pipeline.fit(X)

    # Produce anomaly_score (decision_function: higher = more normal)
    # and is_anomaly (predict: -1 = anomaly, 1 = normal -> remap to 0/1)
    df["anomaly_score"] = pipeline.decision_function(X)
    df["is_anomaly"]    = (pipeline.predict(X) == -1).astype(int)
    df["event_type"]    = classify_events(df)

    anomaly_rate = df["is_anomaly"].mean()
    spike_count  = (df["event_type"] == "spike").sum()
    neg_count    = (df["event_type"] == "negative").sum()
    sep_count    = (df["event_type"] == "separation").sum()

    logger.info(
        "IF anomaly rate: %.2f%% | spikes: %d | negatives: %d | separations: %d",
        anomaly_rate * 100, spike_count, neg_count, sep_count,
    )

    mlflow.set_experiment(MLFLOW_EXPERIMENT)
    with mlflow.start_run(run_name="anomaly_detector_training") as run:
        mlflow.set_tag("model_type", "IsolationForest + rule_classifier")

        mlflow.log_params({
            "if_contamination":   IF_CONTAMINATION,
            "if_n_estimators":    IF_N_ESTIMATORS,
            "if_max_samples":     str(IF_MAX_SAMPLES),
            "spike_threshold":    SPIKE_THRESHOLD,
            "negative_threshold": NEGATIVE_THRESHOLD,
            "separation_threshold": SEPARATION_THRESHOLD,
            "training_months":    TRAINING_MONTHS,
            "n_features":         len(FEATURE_COLS_IF),
            "feature_list":       json.dumps(FEATURE_COLS_IF),
        })

        mlflow.log_metrics({
            "train_rows":          int(len(df)),
            "anomaly_rate_pct":    float(anomaly_rate * 100),
            "spike_events":        int(spike_count),
            "negative_events":     int(neg_count),
            "separation_events":   int(sep_count),
        })

        # Log the sklearn pipeline artifact
        signature = mlflow.models.infer_signature(
            pd.DataFrame(X[:5], columns=FEATURE_COLS_IF),
            pipeline.decision_function(X[:5]),
        )
        mlflow.sklearn.log_model(
            pipeline,
            artifact_path="model",
            registered_model_name=MODEL_NAME,
            signature=signature,
            input_example=pd.DataFrame(X[:3], columns=FEATURE_COLS_IF),
        )

        # Also save the rule thresholds as a JSON artifact for auditing
        thresholds = {
            "spike_threshold":      SPIKE_THRESHOLD,
            "negative_threshold":   NEGATIVE_THRESHOLD,
            "separation_threshold": SEPARATION_THRESHOLD,
            "feature_cols":         FEATURE_COLS_IF,
        }
        thresholds_path = "/tmp/anomaly_thresholds.json"
        with open(thresholds_path, "w") as fh:
            json.dump(thresholds, fh, indent=2)
        mlflow.log_artifact(thresholds_path, artifact_path="config")

        # Register with "production" alias
        client = MlflowClient()
        latest = max(int(v.version) for v in client.get_latest_versions(MODEL_NAME))
        client.set_registered_model_alias(MODEL_NAME, "production", str(latest))
        logger.info("Registered %s v%d with alias 'production'", MODEL_NAME, latest)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    spark = SparkSession.builder.getOrCreate()
    train_anomaly_detector(spark)
