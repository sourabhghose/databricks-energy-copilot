"""
Price Forecast -- LightGBM Training
=====================================
Trains one LightGBM model per NEM region (5 total) using features from
energy_copilot.gold.feature_store_price with forecast_horizon as an
explicit model feature (multi-horizon single model per region).

Hyperparameter optimisation: Optuna with 50 trials, TPE sampler.
Tracking: MLflow experiments on Databricks.
Model registration: MLflow Model Registry, alias "production".

Split strategy (no data leakage):
  - train : earliest 18 months of the feature store
  - val   : next 3 months (used by Optuna for early stopping signal)
  - test  : final 3 months (held out; evaluation done in evaluate.py)

The test set boundaries are saved as MLflow tags so that evaluate.py can
reproduce the exact same split without needing to re-read the whole table.

Usage
-----
  python train.py            # Databricks task or local with Spark session
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple

import lightgbm as lgb
import mlflow
import mlflow.lightgbm
import numpy as np
import optuna
import pandas as pd
from mlflow.tracking import MlflowClient
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

NEM_REGIONS: List[str] = ["NSW1", "QLD1", "SA1", "TAS1", "VIC1"]

MLFLOW_EXPERIMENT = "/energy_copilot/price_forecast_training"
MODEL_NAME_TMPL   = "price_forecast_{region}"

TRAIN_MONTHS = 18
VAL_MONTHS   = 3
TEST_MONTHS  = 3

OPTUNA_TRIALS = 50
OPTUNA_SEED   = 42

SPIKE_THRESHOLD = 500.0   # $/MWh -- used for per-segment MAE/MAPE metrics

LABEL_COL     = "rrp_target"
EXCLUDED_COLS = {
    "settlementdate", "settlement_date", "regionid", "rrp", "totaldemand",
    LABEL_COL, "feature_timestamp", "season",   # season encoded separately below
}

# LightGBM fixed params (not tuned by Optuna)
LGB_FIXED_PARAMS: Dict[str, Any] = {
    "objective":       "regression_l1",   # MAE objective
    "metric":          "mae",
    "boosting_type":   "gbdt",
    "n_jobs":          -1,
    "verbose":         -1,
    "random_state":    42,
}


# ---------------------------------------------------------------------------
# Feature preparation helpers
# ---------------------------------------------------------------------------

def encode_categoricals(df: pd.DataFrame) -> pd.DataFrame:
    """
    One-hot encode low-cardinality string columns (season only in this schema).
    Label-encode regionid (already filtered to one region before training,
    but kept for safety).
    """
    if "season" in df.columns:
        dummies = pd.get_dummies(df["season"], prefix="season", drop_first=False)
        df = pd.concat([df.drop(columns=["season"]), dummies], axis=1)
    return df


def get_feature_columns(df: pd.DataFrame) -> List[str]:
    """Return the sorted list of feature columns to keep."""
    return sorted([c for c in df.columns if c not in EXCLUDED_COLS])


def prepare_region_data(
    spark: SparkSession,
    region: str,
    train_end: datetime,
    val_end: datetime,
    test_end: datetime,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Load features for a single NEM region from the feature store and split
    into train / val / test DataFrames.
    """
    train_start = train_end - timedelta(days=TRAIN_MONTHS * 30)

    df_spark = (
        spark.table(FEATURE_TABLE)
        .filter(F.col("regionid") == region)
        .filter(F.col("settlementdate") >= F.lit(train_start.isoformat()))
        .filter(F.col("settlementdate") <  F.lit(test_end.isoformat()))
        .orderBy("settlementdate", "forecast_horizon")
    )
    df: pd.DataFrame = df_spark.toPandas()
    df = encode_categoricals(df)

    # Chronological split
    train_mask = df["settlementdate"] <  train_end
    val_mask   = (df["settlementdate"] >= train_end) & (df["settlementdate"] < val_end)
    test_mask  = (df["settlementdate"] >= val_end)   & (df["settlementdate"] < test_end)

    return df[train_mask], df[val_mask], df[test_mask]


# ---------------------------------------------------------------------------
# Metrics helpers
# ---------------------------------------------------------------------------

def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """
    Compute MAE, MAPE for all rows and separately for normal vs spike events.
    Spike: rrp_target > SPIKE_THRESHOLD $/MWh.
    """
    eps = 1e-6
    abs_err = np.abs(y_true - y_pred)
    pct_err = abs_err / (np.abs(y_true) + eps)

    spike_mask  = y_true > SPIKE_THRESHOLD
    normal_mask = ~spike_mask

    metrics: Dict[str, float] = {
        "mae_all":            float(np.mean(abs_err)),
        "mape_all":           float(np.mean(pct_err) * 100.0),
        "mae_normal":         float(np.mean(abs_err[normal_mask]))  if normal_mask.any() else np.nan,
        "mape_normal":        float(np.mean(pct_err[normal_mask]) * 100.0) if normal_mask.any() else np.nan,
        "mae_spike":          float(np.mean(abs_err[spike_mask]))   if spike_mask.any() else np.nan,
        "mape_spike":         float(np.mean(pct_err[spike_mask]) * 100.0) if spike_mask.any() else np.nan,
        "n_spike_events_true": int(spike_mask.sum()),
    }
    return metrics


# ---------------------------------------------------------------------------
# Optuna objective
# ---------------------------------------------------------------------------

def make_objective(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    X_val:   pd.DataFrame,
    y_val:   np.ndarray,
) -> Any:
    """
    Return an Optuna objective function that trains LightGBM with a given
    set of hyperparameters and returns the validation MAE.
    """
    def objective(trial: optuna.Trial) -> float:
        params = {
            **LGB_FIXED_PARAMS,
            "num_leaves":        trial.suggest_int("num_leaves",        31,   512),
            "learning_rate":     trial.suggest_float("learning_rate",   1e-3, 0.3,  log=True),
            "max_depth":         trial.suggest_int("max_depth",         3,    12),
            "min_child_samples": trial.suggest_int("min_child_samples", 10,   200),
            "reg_alpha":         trial.suggest_float("reg_alpha",       1e-8, 10.0, log=True),
            "reg_lambda":        trial.suggest_float("reg_lambda",      1e-8, 10.0, log=True),
            "subsample":         trial.suggest_float("subsample",       0.5,  1.0),
            "n_estimators":      trial.suggest_int("n_estimators",      200,  2000),
        }

        dtrain = lgb.Dataset(X_train, label=y_train)
        dval   = lgb.Dataset(X_val,   label=y_val, reference=dtrain)

        callbacks = [
            lgb.early_stopping(stopping_rounds=50, verbose=False),
            lgb.log_evaluation(period=-1),
        ]

        booster = lgb.train(
            params,
            dtrain,
            valid_sets=[dval],
            callbacks=callbacks,
        )

        y_pred = booster.predict(X_val)
        mae = float(np.mean(np.abs(y_val - y_pred)))
        return mae

    return objective


# ---------------------------------------------------------------------------
# Single-region training
# ---------------------------------------------------------------------------

def train_region(
    spark:      SparkSession,
    region:     str,
    train_end:  datetime,
    val_end:    datetime,
    test_end:   datetime,
) -> None:
    """
    Run the full training pipeline for a single NEM region:
      1. Load and split data
      2. Optuna hyperparameter search (50 trials)
      3. Final training with best params on train + val combined
      4. Log everything to MLflow and register the model
    """
    logger.info("=== Training region: %s ===", region)

    df_train, df_val, df_test = prepare_region_data(
        spark, region, train_end, val_end, test_end
    )

    feat_cols = get_feature_columns(df_train)
    logger.info("Feature count: %d", len(feat_cols))

    X_train = df_train[feat_cols].values
    y_train = df_train[LABEL_COL].values
    X_val   = df_val[feat_cols].values
    y_val   = df_val[LABEL_COL].values
    X_test  = df_test[feat_cols].values
    y_test  = df_test[LABEL_COL].values

    model_name = MODEL_NAME_TMPL.format(region=region.lower().replace("1", ""))

    with mlflow.start_run(run_name=f"{region}_hyperopt") as parent_run:
        mlflow.set_tag("region",     region)
        mlflow.set_tag("phase",      "hyperparameter_tuning")
        mlflow.set_tag("train_end",  train_end.isoformat())
        mlflow.set_tag("val_end",    val_end.isoformat())
        mlflow.set_tag("test_end",   test_end.isoformat())
        mlflow.log_param("feature_columns", json.dumps(feat_cols))
        mlflow.log_param("train_rows", len(X_train))
        mlflow.log_param("val_rows",   len(X_val))
        mlflow.log_param("test_rows",  len(X_test))
        mlflow.log_param("optuna_trials", OPTUNA_TRIALS)

        # Optuna study
        sampler = optuna.samplers.TPESampler(seed=OPTUNA_SEED)
        study = optuna.create_study(
            direction="minimize",
            sampler=sampler,
            study_name=f"price_forecast_{region}",
        )
        objective = make_objective(X_train, y_train, X_val, y_val)
        study.optimize(
            objective,
            n_trials=OPTUNA_TRIALS,
            show_progress_bar=False,
        )

        best_params = {**LGB_FIXED_PARAMS, **study.best_params}
        logger.info("Best params for %s: %s", region, best_params)
        mlflow.log_params({f"best_{k}": v for k, v in study.best_params.items()})
        mlflow.log_metric("best_val_mae", study.best_value)

        # Final model: retrain on train + val combined
        X_final = np.vstack([X_train, X_val])
        y_final = np.concatenate([y_train, y_val])

        dtrain_final = lgb.Dataset(X_final, label=y_final)

    with mlflow.start_run(run_name=f"{region}_final_model") as run:
        mlflow.set_tag("region",    region)
        mlflow.set_tag("phase",     "final_training")
        mlflow.set_tag("train_end", train_end.isoformat())
        mlflow.set_tag("val_end",   val_end.isoformat())
        mlflow.set_tag("test_end",  test_end.isoformat())
        mlflow.log_params({f"param_{k}": v for k, v in study.best_params.items()})
        mlflow.log_param("feature_columns", json.dumps(feat_cols))

        final_booster = lgb.train(
            best_params,
            dtrain_final,
        )

        # Evaluate on held-out test set (logged but not used for selection)
        y_pred_test = final_booster.predict(X_test)
        test_metrics = compute_metrics(y_test, y_pred_test)
        mlflow.log_metrics({f"test_{k}": v for k, v in test_metrics.items()})

        logger.info("Test metrics for %s: %s", region, test_metrics)

        # Log feature importances
        importance_df = pd.DataFrame({
            "feature":    feat_cols,
            "importance": final_booster.feature_importance(importance_type="gain"),
        }).sort_values("importance", ascending=False)
        importance_path = f"/tmp/feature_importance_{region}.csv"
        importance_df.to_csv(importance_path, index=False)
        mlflow.log_artifact(importance_path, artifact_path="feature_importance")

        # Log the model artifact
        signature = mlflow.models.infer_signature(
            pd.DataFrame(X_train[:5], columns=feat_cols),
            final_booster.predict(X_train[:5]),
        )
        mlflow.lightgbm.log_model(
            final_booster,
            artifact_path="model",
            registered_model_name=model_name,
            signature=signature,
            input_example=pd.DataFrame(X_train[:3], columns=feat_cols),
        )

        # Assign "production" alias to the latest registered version
        client = MlflowClient()
        latest_versions = client.get_latest_versions(model_name)
        if latest_versions:
            latest_version = str(max(int(v.version) for v in latest_versions))
            client.set_registered_model_alias(model_name, "production", latest_version)
            logger.info(
                "Registered %s v%s with alias 'production'",
                model_name, latest_version,
            )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def train_all_regions(spark: SparkSession) -> None:
    """
    Determine train/val/test boundaries from the feature store and train
    one model per NEM region sequentially.
    """
    # Determine date range from the feature store
    date_stats = (
        spark.table(FEATURE_TABLE)
        .agg(
            F.min("settlementdate").alias("min_dt"),
            F.max("settlementdate").alias("max_dt"),
        )
        .collect()[0]
    )
    data_start = date_stats["min_dt"]
    data_end   = date_stats["max_dt"]

    total_months = TRAIN_MONTHS + VAL_MONTHS + TEST_MONTHS  # 24 months
    train_end = data_start + timedelta(days=TRAIN_MONTHS * 30)
    val_end   = train_end  + timedelta(days=VAL_MONTHS   * 30)
    test_end  = val_end    + timedelta(days=TEST_MONTHS  * 30)

    logger.info(
        "Split: train [%s, %s) | val [%s, %s) | test [%s, %s)",
        data_start.date(), train_end.date(),
        train_end.date(), val_end.date(),
        val_end.date(), test_end.date(),
    )

    mlflow.set_experiment(MLFLOW_EXPERIMENT)

    for region in NEM_REGIONS:
        train_region(spark, region, train_end, val_end, test_end)

    logger.info("All regions trained successfully.")


if __name__ == "__main__":
    spark = SparkSession.builder.getOrCreate()
    train_all_regions(spark)
