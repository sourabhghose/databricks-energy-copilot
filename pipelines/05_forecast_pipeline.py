# Databricks notebook source
# MAGIC %md
# MAGIC # Pipeline 05 — ML Forecast Inference Pipeline
# MAGIC Triggered batch. Loads 20 models from MLflow UC registry, runs inference,
# MAGIC writes to gold forecast tables, fires alerts if spike predicted.

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import mlflow.pyfunc
import numpy as np
import pandas as pd
from pyspark.sql import functions as F

CATALOG = "energy_copilot"
NEM_REGIONS = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
FORECAST_TYPES = ["price", "demand", "wind", "solar"]
FORECAST_HORIZONS_HOURS = [1, 4, 24, 48]
MODEL_ALIAS = "production"
PRICE_SPIKE_THRESHOLD = 300.0
EXTREME_PRICE_THRESHOLD = 5000.0

logging.basicConfig(level=logging.INFO, format='{"ts":"%(asctime)s","msg":"%(message)s"}')
logger = logging.getLogger("forecast_pipeline")


def _load_model(name: str):
    uri = f"models:/{CATALOG}.ml.{name}@{MODEL_ALIAS}"
    try: return mlflow.pyfunc.load_model(uri)
    except Exception as e: logger.warning(f"Model not available: {uri} — {e}"); return None


def load_all_models() -> Dict[str, Any]:
    models = {ft: {} for ft in FORECAST_TYPES}
    for ft in FORECAST_TYPES:
        for region in NEM_REGIONS:
            models[ft][region] = _load_model(f"{ft}_forecast_{region}")
    models["anomaly"] = _load_model("anomaly_detection_nem")
    return models


def _get_season(month: int) -> int:
    return {12:0,1:0,2:0,3:1,4:1,5:1,6:2,7:2,8:2,9:3,10:3,11:3}[month]


def build_features(region: str, as_of: datetime) -> Optional[pd.DataFrame]:
    cutoff = as_of - timedelta(hours=48)
    try:
        price_pd = (spark.table(f"{CATALOG}.gold.nem_prices_5min")
                    .filter((F.col("region_id")==region) & (F.col("interval_datetime")>=cutoff) & (F.col("interval_datetime")<=as_of))
                    .orderBy("interval_datetime").toPandas())
        if price_pd.empty: return None
        prices = price_pd["spot_price_aud_mwh"]; demands = price_pd["total_demand_mw"]; n = len(prices)
        lag = lambda s,k: float(s.iloc[-k]) if n>=k else np.nan
        roll_mean = lambda s,k: float(s.tail(k).mean()) if n>=k else np.nan
    except Exception as e: logger.error(f"Feature fetch failed for {region}: {e}"); return None

    try:
        wx = (spark.table(f"{CATALOG}.gold.weather_nem_regions")
              .filter((F.col("region_id")==region) & (F.col("interval_datetime")>=cutoff))
              .orderBy("interval_datetime").toPandas())
        w = wx.iloc[-1] if not wx.empty else None
        temp = float(w["temperature_c"]) if w is not None else np.nan
        wind = float(w["wind_speed_100m_ms"]) if w is not None else np.nan
        solar = float(w["solar_radiation_wm2"]) if w is not None else np.nan
    except Exception: temp=wind=solar=np.nan

    rows = []
    for h in FORECAST_HORIZONS_HOURS:
        target = as_of + timedelta(hours=h)
        rows.append({
            "region_id": region, "horizon_hours": h,
            "hour_of_day": target.hour, "day_of_week": target.weekday(),
            "month": target.month, "is_weekend": int(target.weekday()>=5),
            "season": _get_season(target.month),
            "price_lag_1": lag(prices,1), "price_lag_12": lag(prices,12),
            "price_lag_288": lag(prices,288), "price_mean_4hr": roll_mean(prices,48),
            "demand_lag_12": lag(demands,12), "demand_mean_4hr": roll_mean(demands,48),
            "temperature_c": temp, "wind_speed_100m": wind, "solar_radiation": solar,
        })
    return pd.DataFrame(rows)


def _predict(model, features_df) -> List[float]:
    if model is None or features_df is None or features_df.empty: return []
    try:
        preds = model.predict(features_df)
        return [float(p) for p in (preds if hasattr(preds,"__len__") else [preds])]
    except Exception as e: logger.error(f"Prediction error: {e}"); return []


def run_forecast_pipeline() -> None:
    as_of = datetime.now(timezone.utc)
    logger.info(f"Forecast pipeline start: {as_of.isoformat()}")
    models = load_all_models()

    price_recs, demand_recs, gen_recs = [], [], []
    for region in NEM_REGIONS:
        features = build_features(region, as_of)
        for ft, recs in [("price", price_recs), ("demand", demand_recs)]:
            preds = _predict(models[ft].get(region), features)
            for i, h in enumerate(FORECAST_HORIZONS_HOURS):
                if i < len(preds):
                    recs.append({"region_id": region, "as_of_datetime": as_of,
                                 "target_datetime": as_of+timedelta(hours=h), "horizon_hours": h,
                                 "predicted_value": preds[i], "forecast_type": ft,
                                 "model_version": MODEL_ALIAS, "created_at": datetime.now(timezone.utc)})

    for table, recs in [
        (f"{CATALOG}.gold.price_forecasts", price_recs),
        (f"{CATALOG}.gold.demand_forecasts", demand_recs),
    ]:
        if recs:
            spark.createDataFrame(recs).write.format("delta").mode("append").saveAsTable(table)
            logger.info(f"Wrote {len(recs)} records to {table}")

    # Spike alerts
    alerts = [{"region_id": p["region_id"], "alert_type": "PREDICTED_PRICE_SPIKE",
               "severity": "EXTREME" if p["predicted_value"]>=EXTREME_PRICE_THRESHOLD else "HIGH",
               "target_datetime": p["target_datetime"], "predicted_value": p["predicted_value"],
               "created_at": datetime.now(timezone.utc)}
              for p in price_recs if p["predicted_value"] >= PRICE_SPIKE_THRESHOLD]
    if alerts:
        spark.createDataFrame(alerts).write.format("delta").mode("append").saveAsTable(f"{CATALOG}.gold.forecast_alerts")
        logger.info(f"Fired {len(alerts)} spike alerts")

    logger.info(f"Pipeline complete: {len(price_recs)} price, {len(demand_recs)} demand forecasts")


try:
    run_forecast_pipeline()
except NameError:
    logger.warning("No Spark session — pipeline not executed (unit test mode)")
