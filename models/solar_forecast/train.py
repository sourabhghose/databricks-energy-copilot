"""
Solar Generation Forecast -- LightGBM Training
================================================
Trains one LightGBM model per NEM region (5 models) to predict total solar
generation (MW) at each dispatch interval across multiple forecast horizons.

Solar-specific design decisions:
  - Night-time intervals (shortwave_radiation == 0 AND hour_of_day in 20-5)
    are excluded from training to avoid biasing the model with trivially-zero
    periods. At inference time, the forecast pipeline zero-clamps predictions
    for dark hours.
  - The solar generation column (gen_solar_mw) captures both large-scale and
    embedded distributed solar (as ingested from AEMO SCADA + APVI data in the
    Silver layer and aggregated to gold.feature_store_price).
  - NWP solar radiation forecasts (shortwave_radiation_1h/4h/24h) are the most
    predictive features and are included in the feature set.

Target column    : solar_generation_target (MW)
Feature source   : gold.feature_store_price
Model registry   : "solar_forecast_{region}" with alias "production"
MLflow experiment: /energy_copilot/solar_forecast_training

Split: 18 months train | 3 months val | 3 months test (chronological).
Hyperparameter tuning: Optuna 50 trials, TPE sampler, MAE objective.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

import lightgbm as lgb
import mlflow
import mlflow.lightgbm
import numpy as np
import optuna
import pandas as pd
from mlflow.tracking import MlflowClient
from pyspark.sql import SparkSession
import pyspark.sql.functions as F
import pyspark.sql.types as T

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

CATALOG        = "energy_copilot"
GOLD           = f"{CATALOG}.gold"
FEATURE_TABLE  = f"{GOLD}.feature_store_price"

NEM_REGIONS: List[str] = ["NSW1", "QLD1", "SA1", "TAS1", "VIC1"]
MLFLOW_EXPERIMENT = "/energy_copilot/solar_forecast_training"
MODEL_NAME_TMPL   = "solar_forecast_{region}"

TRAIN_MONTHS = 18
VAL_MONTHS   = 3
TEST_MONTHS  = 3
OPTUNA_TRIALS = 50
OPTUNA_SEED   = 42

FORECAST_HORIZONS: List[int] = [1, 4, 8, 12, 24, 48]
LABEL_COL = "solar_generation_target"

# Night-time hours (AEST) -- solar generation is definitionally zero
NIGHT_HOURS = set(range(0, 6)) | set(range(20, 24))   # 8pm-6am local approx

EXCLUDED_COLS = {
    "settlementdate", "settlement_date", "regionid", "rrp", "totaldemand",
    "rrp_target", LABEL_COL, "feature_timestamp", "season",
}

LGB_FIXED_PARAMS: Dict[str, Any] = {
    "objective":     "regression_l1",
    "metric":        "mae",
    "boosting_type": "gbdt",
    "n_jobs":        -1,
    "verbose":       -1,
    "random_state":  42,
}


def add_solar_target(spark, df_spark):
    """Add solar_generation_target by joining future gen_solar_mw values."""
    horizons_df = spark.createDataFrame(
        [(h,) for h in FORECAST_HORIZONS],
        schema=T.StructType([T.StructField("forecast_horizon", T.IntegerType(), False)]),
    )
    df_x = df_spark.crossJoin(horizons_df).withColumn(
        "_ts",
        (F.col("settlementdate").cast("long") + F.col("forecast_horizon") * 300).cast("timestamp"),
    )
    future = df_spark.select(
        F.col("settlementdate").alias("_fts"),
        F.col("regionid").alias("_fr"),
        F.col("gen_solar_mw").alias(LABEL_COL),
    )
    df_x = (
        df_x.join(future, (F.col("_ts") == F.col("_fts")) & (F.col("regionid") == F.col("_fr")), "left")
        .drop("_ts", "_fts", "_fr")
        .filter(F.col(LABEL_COL).isNotNull())
        # Exclude night-time rows from training (solar = 0 trivially)
        .filter(~F.col("hour_of_day").isin(list(NIGHT_HOURS)))
    )
    return df_x


def prepare_data(spark, region, train_end, val_end, test_end):
    train_start = train_end - timedelta(days=TRAIN_MONTHS * 30)
    base = (
        spark.table(FEATURE_TABLE)
        .filter(F.col("regionid") == region)
        .filter(F.col("settlementdate") >= F.lit(train_start.isoformat()))
        .filter(F.col("settlementdate") <  F.lit(test_end.isoformat()))
        .dropDuplicates(["settlementdate", "regionid"])
    )
    df_spark = add_solar_target(spark, base)
    df = df_spark.toPandas()
    if "season" in df.columns:
        dummies = pd.get_dummies(df["season"], prefix="season", drop_first=False)
        df = pd.concat([df.drop(columns=["season"]), dummies], axis=1)
    return (
        df[df["settlementdate"] <  train_end],
        df[(df["settlementdate"] >= train_end) & (df["settlementdate"] < val_end)],
        df[(df["settlementdate"] >= val_end)   & (df["settlementdate"] < test_end)],
    )


def get_feature_columns(df):
    return sorted([c for c in df.columns if c not in EXCLUDED_COLS])


def compute_metrics(y_true, y_pred):
    abs_err = np.abs(y_true - y_pred)
    eps = 1.0
    return {
        "mae":       float(np.mean(abs_err)),
        "rmse":      float(np.sqrt(np.mean(abs_err ** 2))),
        "mape_pct":  float(np.mean(abs_err / (np.abs(y_true) + eps)) * 100.0),
        "bias_mw":   float(np.mean(y_pred - y_true)),
    }


def make_objective(X_tr, y_tr, X_v, y_v):
    def obj(trial):
        p = {
            **LGB_FIXED_PARAMS,
            "num_leaves":        trial.suggest_int("num_leaves",        31,  512),
            "learning_rate":     trial.suggest_float("learning_rate",   1e-3, 0.3,  log=True),
            "max_depth":         trial.suggest_int("max_depth",         3,   12),
            "min_child_samples": trial.suggest_int("min_child_samples", 10,  200),
            "reg_alpha":         trial.suggest_float("reg_alpha",       1e-8, 10.0, log=True),
            "reg_lambda":        trial.suggest_float("reg_lambda",      1e-8, 10.0, log=True),
            "subsample":         trial.suggest_float("subsample",       0.5,  1.0),
            "n_estimators":      trial.suggest_int("n_estimators",      200, 2000),
        }
        dtrain = lgb.Dataset(X_tr, label=y_tr)
        dval   = lgb.Dataset(X_v,  label=y_v, reference=dtrain)
        b = lgb.train(p, dtrain, valid_sets=[dval],
                      callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(-1)])
        return float(np.mean(np.abs(y_v - b.predict(X_v))))
    return obj


def train_region(spark, region, train_end, val_end, test_end):
    logger.info("=== Solar forecast training: %s ===", region)
    df_tr, df_v, df_te = prepare_data(spark, region, train_end, val_end, test_end)
    feat_cols = get_feature_columns(df_tr)
    X_tr, y_tr = df_tr[feat_cols].values, df_tr[LABEL_COL].values
    X_v,  y_v  = df_v[feat_cols].values,  df_v[LABEL_COL].values
    X_te, y_te = df_te[feat_cols].values, df_te[LABEL_COL].values

    model_name = MODEL_NAME_TMPL.format(region=region.lower().replace("1", ""))

    with mlflow.start_run(run_name=f"{region}_hyperopt"):
        study = optuna.create_study(direction="minimize", sampler=optuna.samplers.TPESampler(seed=OPTUNA_SEED))
        study.optimize(make_objective(X_tr, y_tr, X_v, y_v), n_trials=OPTUNA_TRIALS)
        best_params = {**LGB_FIXED_PARAMS, **study.best_params}
        mlflow.log_metric("best_val_mae", study.best_value)

    X_final = np.vstack([X_tr, X_v])
    y_final = np.concatenate([y_tr, y_v])

    with mlflow.start_run(run_name=f"{region}_final_model"):
        mlflow.set_tag("region",    region)
        mlflow.set_tag("train_end", train_end.isoformat())
        mlflow.set_tag("val_end",   val_end.isoformat())
        mlflow.set_tag("test_end",  test_end.isoformat())
        mlflow.set_tag("night_hours_excluded", str(sorted(NIGHT_HOURS)))
        mlflow.log_params({f"param_{k}": v for k, v in study.best_params.items()})

        booster = lgb.train(best_params, lgb.Dataset(X_final, label=y_final))

        # Clamp predictions to >= 0 (solar cannot go negative)
        y_pred_test = np.maximum(booster.predict(X_te), 0.0)
        test_metrics = compute_metrics(y_te, y_pred_test)
        mlflow.log_metrics({f"test_{k}": v for k, v in test_metrics.items()})
        logger.info("Test metrics %s: %s", region, test_metrics)

        sig = mlflow.models.infer_signature(
            pd.DataFrame(X_tr[:5], columns=feat_cols),
            np.maximum(booster.predict(X_tr[:5]), 0.0),
        )
        mlflow.lightgbm.log_model(
            booster, "model", registered_model_name=model_name,
            signature=sig,
            input_example=pd.DataFrame(X_tr[:3], columns=feat_cols),
        )
        client = MlflowClient()
        latest = max(int(v.version) for v in client.get_latest_versions(model_name))
        client.set_registered_model_alias(model_name, "production", str(latest))
        logger.info("Registered %s v%d as 'production'", model_name, latest)


def train_all_regions(spark: SparkSession) -> None:
    ds = spark.table(FEATURE_TABLE).agg(F.min("settlementdate").alias("m")).collect()[0]["m"]
    train_end = ds + timedelta(days=TRAIN_MONTHS * 30)
    val_end   = train_end + timedelta(days=VAL_MONTHS * 30)
    test_end  = val_end   + timedelta(days=TEST_MONTHS * 30)
    mlflow.set_experiment(MLFLOW_EXPERIMENT)
    for region in NEM_REGIONS:
        train_region(spark, region, train_end, val_end, test_end)
    logger.info("All solar forecast models trained.")


if __name__ == "__main__":
    spark = SparkSession.builder.getOrCreate()
    train_all_regions(spark)
