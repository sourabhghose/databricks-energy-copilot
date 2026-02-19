"""
Demand Forecast - Evaluation (Sprint 7c)
=========================================
Loads the production demand forecast model per NEM region from MLflow Model
Registry, reconstructs features from gold.feature_store_price, evaluates
on the held-out test set, and writes rich diagnostic metrics to
gold.demand_forecast_evaluation.

Target MAPE: < 3.0%

Metrics produced
----------------
Overall:
  mae_mw          Mean Absolute Error (MW)
  rmse_mw         Root Mean Squared Error (MW)
  mape_pct        Overall MAPE (%)
  major_miss_rate Fraction of intervals with |error| > 500 MW

Period:
  peak_mape_pct     Peak-period MAPE (07-09 and 17-20 AEST)
  offpeak_mape_pct  Off-peak MAPE

Seasonal (Southern Hemisphere):
  mape_djf, mape_mam, mape_jja, mape_son

MLflow logged as demand_{region}_{metric} (lowercase).

Usage
-----
  python -m models.demand_forecast.evaluate --region NSW1
  python -m models.demand_forecast.evaluate --all-regions --promote
  python -m models.demand_forecast.evaluate --unit-test   (no Spark/MLflow)
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Generator, List, Optional, Tuple

import mlflow
import numpy as np
import pandas as pd
from mlflow.tracking import MlflowClient

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CATALOG        = "energy_copilot"
GOLD           = f"{CATALOG}.gold"
FEATURE_TABLE  = f"{GOLD}.feature_store_price"
EVAL_TABLE     = f"{GOLD}.demand_forecast_evaluation"

NEM_REGIONS: List[str] = ["NSW1", "QLD1", "SA1", "TAS1", "VIC1"]
MODEL_REGISTRY_TMPL    = "energy_copilot.ml.demand_forecast_{region}"
MODEL_ALIAS            = "production"
CHAMPION_ALIAS         = "champion"
MLFLOW_EXPERIMENT      = "/energy_copilot/demand_forecast_evaluation"

MAPE_TARGET_PCT  = 3.0
MAJOR_MISS_MW    = 500.0          # threshold for a "major miss" interval
AEST_OFFSET_HRS  = 10             # UTC+10 fixed offset for AEST

# Peak windows: (start_hour_inclusive, end_hour_exclusive) in AEST
PEAK_WINDOWS: List[Tuple[int, int]] = [(7, 9), (17, 20)]   # 07:00-09:00, 17:00-20:00

# Lag features: demand_lag_1 through demand_lag_12
LAG_COLS = [f"demand_lag_{i}" for i in range(1, 13)]

# Rolling stats (4 x 30-min settlement periods = 2 h look-back)
ROLL_COLS = ["demand_roll_mean_4h", "demand_roll_std_4h"]

# Cyclical time encodings
CYCLICAL_COLS = [
    "hour_sin", "hour_cos",
    "dow_sin",  "dow_cos",
    "month_sin", "month_cos",
]

# Calendar flags
CALENDAR_COLS = ["is_peak_period", "is_business_day", "is_weekend"]

# Temperature features (filled with 0 when unavailable)
TEMPERATURE_COLS = [
    "temp_avg", "temp_max", "temp_min",
    "heating_degree_days", "cooling_degree_days",
]

# Southern-Hemisphere season map
SEASON_MAP = {
    12: "DJF", 1: "DJF",  2: "DJF",
    3:  "MAM", 4: "MAM",  5: "MAM",
    6:  "JJA", 7: "JJA",  8: "JJA",
    9:  "SON", 10: "SON", 11: "SON",
}
SEASONS = ["DJF", "MAM", "JJA", "SON"]


# ---------------------------------------------------------------------------
# Feature engineering helpers
# ---------------------------------------------------------------------------

def _aest_hour(ts_series: pd.Series) -> pd.Series:
    """Return AEST (UTC+10) hour from a timestamp Series."""
    if hasattr(ts_series.dtype, "tz") and ts_series.dtype.tz is not None:
        try:
            return ts_series.dt.tz_convert("Australia/Brisbane").dt.hour
        except Exception:
            pass
    return (ts_series + pd.Timedelta(hours=AEST_OFFSET_HRS)).dt.hour


def _aest_month(ts_series: pd.Series) -> pd.Series:
    """Return AEST month from a timestamp Series."""
    if hasattr(ts_series.dtype, "tz") and ts_series.dtype.tz is not None:
        try:
            return ts_series.dt.tz_convert("Australia/Brisbane").dt.month
        except Exception:
            pass
    return ts_series.dt.month


def _is_peak(hour_series: pd.Series) -> pd.Series:
    """Float mask: 1.0 inside peak windows (07-09 and 17-20 AEST)."""
    mask = pd.Series(False, index=hour_series.index)
    for start, end in PEAK_WINDOWS:
        mask |= (hour_series >= start) & (hour_series < end)
    return mask.astype(float)


def _season(month_series: pd.Series) -> pd.Series:
    return month_series.map(SEASON_MAP)


def _cyclical_encode(values: pd.Series, period: float) -> Tuple[pd.Series, pd.Series]:
    rad = 2.0 * np.pi * values / period
    return np.sin(rad), np.cos(rad)


def reconstruct_features(df: pd.DataFrame, ts_col: str = "settlementdate") -> pd.DataFrame:
    """
    Reconstruct the full demand feature set from raw settlement data.

    Input columns required:
        ts_col (str or datetime)  -- settlement timestamp
        totaldemand (float)       -- observed demand in MW

    All feature columns consumed by the LightGBM model are reconstructed
    in-place.  Temperature columns missing from the input are filled 0.0.
    """
    df = df.copy().sort_values(ts_col).reset_index(drop=True)
    ts = pd.to_datetime(df[ts_col], utc=True, errors="coerce")

    hour  = _aest_hour(ts)
    month = _aest_month(ts)
    dow   = ts.dt.dayofweek   # 0=Monday ... 6=Sunday

    # ---- Lag features (demand_lag_1 ... demand_lag_12) ----------------------
    demand = df["totaldemand"].astype(float)
    for i in range(1, 13):
        df[f"demand_lag_{i}"] = demand.shift(i).bfill()

    # ---- Rolling statistics (4-period = 2 h window at 30-min cadence) -------
    roll4 = demand.shift(1).rolling(window=4, min_periods=1)
    df["demand_roll_mean_4h"] = roll4.mean().fillna(demand.mean())
    df["demand_roll_std_4h"]  = roll4.std().fillna(0.0)

    # ---- Cyclical time encodings --------------------------------------------
    df["hour_sin"],  df["hour_cos"]  = _cyclical_encode(hour,  24.0)
    df["dow_sin"],   df["dow_cos"]   = _cyclical_encode(dow,    7.0)
    df["month_sin"], df["month_cos"] = _cyclical_encode(month, 12.0)

    # ---- Calendar flags -----------------------------------------------------
    df["is_peak_period"]  = _is_peak(hour).values
    df["is_business_day"] = (dow < 5).astype(float).values
    df["is_weekend"]      = (dow >= 5).astype(float).values

    # ---- Temperature (zero-fill when unavailable) ---------------------------
    for col in TEMPERATURE_COLS:
        if col not in df.columns:
            df[col] = 0.0

    # ---- Season label -------------------------------------------------------
    df["season"] = _season(month).values

    return df


# ---------------------------------------------------------------------------
# Synthetic demand data - unit-test mode
# ---------------------------------------------------------------------------

def _synthetic_demand(n_periods: int = 2016) -> pd.DataFrame:
    """
    Generate synthetic half-hourly demand used in --unit-test mode.

    Pattern:
        Base:           5000 MW
        Daily sine:     amplitude 800 MW, trough at midnight
        Weekday boost:  +500 MW Monday-Friday
        Gaussian noise: std 150 MW
    """
    rng    = np.random.default_rng(42)
    t      = np.arange(n_periods)
    base   = 5000.0
    daily  = 800.0 * np.sin(2.0 * np.pi * t / 48.0 - np.pi / 2.0)
    start  = pd.Timestamp("2025-01-01 00:00:00", tz="UTC")
    times  = pd.date_range(start, periods=n_periods, freq="30min")
    dow    = times.dayofweek
    boost  = np.where(dow < 5, 500.0, 0.0)
    noise  = rng.normal(0.0, 150.0, n_periods)
    demand = np.clip(base + daily + boost + noise, 2000.0, 14000.0)
    rrp    = 80.0 + 50.0 * np.sin(2.0 * np.pi * t / 48.0) + rng.normal(0.0, 20.0, n_periods)
    return pd.DataFrame({
        "settlementdate": times,
        "regionid":       "NSW1",
        "totaldemand":    demand,
        "rrp":            rrp,
    })


# ---------------------------------------------------------------------------
# MLflow / model registry helpers
# ---------------------------------------------------------------------------

def _model_uri(region: str) -> str:
    name = MODEL_REGISTRY_TMPL.format(region=region.lower())
    return f"models:/{name}@{MODEL_ALIAS}"


def load_production_model(region: str) -> mlflow.pyfunc.PyFuncModel:
    uri = _model_uri(region)
    logger.info("Loading model: %s", uri)
    return mlflow.pyfunc.load_model(uri)


def _get_run_tags(region: str) -> Optional[Dict[str, str]]:
    """Retrieve MLflow run tags for the production model version."""
    try:
        client     = MlflowClient()
        model_name = MODEL_REGISTRY_TMPL.format(region=region.lower())
        version    = client.get_model_version_by_alias(model_name, MODEL_ALIAS)
        run        = client.get_run(version.run_id)
        return run.data.tags
    except Exception as exc:
        logger.warning("Could not fetch run tags for %s: %s", region, exc)
        return None


# ---------------------------------------------------------------------------
# Data loading - Spark / Delta path
# ---------------------------------------------------------------------------

def load_test_data_spark(spark: Any, region: str) -> pd.DataFrame:
    """
    Load the held-out test window from gold.feature_store_price and
    reconstruct the full feature set.

    The test window is determined from val_end / test_end MLflow run tags.
    Falls back to the last 90 days when tags are unavailable.
    """
    import pyspark.sql.functions as F

    tags = _get_run_tags(region)
    if tags and "val_end" in tags and "test_end" in tags:
        val_end  = tags["val_end"]
        test_end = tags["test_end"]
        logger.info("Test window for %s: %s -> %s", region, val_end, test_end)
        sdf = (
            spark.table(FEATURE_TABLE)
            .filter(F.col("regionid") == region)
            .filter(F.col("settlementdate") >= F.lit(val_end))
            .filter(F.col("settlementdate") <  F.lit(test_end))
            .dropDuplicates(["settlementdate", "regionid"])
        )
    else:
        cutoff = (pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=90)).isoformat()
        logger.warning(
            "No val_end/test_end tags found -- using last 90 days for %s (cutoff: %s)",
            region, cutoff,
        )
        sdf = (
            spark.table(FEATURE_TABLE)
            .filter(F.col("regionid") == region)
            .filter(F.col("settlementdate") >= F.lit(cutoff))
            .dropDuplicates(["settlementdate", "regionid"])
        )

    df = sdf.toPandas()
    if df.empty:
        raise ValueError(f"No feature-store data found for region {region}")

    df = reconstruct_features(df, ts_col="settlementdate")
    return df


# ---------------------------------------------------------------------------
# Metric computation
# ---------------------------------------------------------------------------

def _safe_mape(y_true: np.ndarray, y_pred: np.ndarray, eps: float = 1.0) -> float:
    return float(np.mean(np.abs(y_true - y_pred) / (np.abs(y_true) + eps)) * 100.0)


def _mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


def _rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def compute_all_metrics(
    df: pd.DataFrame,
    y_pred: np.ndarray,
    target_col: str = "totaldemand",
    ts_col: str = "settlementdate",
) -> Dict[str, float]:
    """
    Compute the full metric suite for a region evaluation.

    Returns
    -------
    Flat dict with keys:
        mae_mw, rmse_mw, mape_pct, major_miss_rate,
        peak_mape_pct, offpeak_mape_pct,
        mape_djf, mape_mam, mape_jja, mape_son
    """
    y_true  = df[target_col].values.astype(float)
    ts      = pd.to_datetime(df[ts_col], utc=True, errors="coerce")
    abs_err = np.abs(y_true - y_pred)

    # ---- Overall metrics ----------------------------------------------------
    mae_mw          = _mae(y_true, y_pred)
    rmse_mw         = _rmse(y_true, y_pred)
    mape_pct        = _safe_mape(y_true, y_pred)
    major_miss_rate = float(np.mean(abs_err > MAJOR_MISS_MW))

    # ---- Peak / off-peak MAPE -----------------------------------------------
    hour      = _aest_hour(ts)
    peak_mask = _is_peak(hour).astype(bool).values

    peak_mape    = _safe_mape(y_true[peak_mask],  y_pred[peak_mask])  if peak_mask.sum()    > 0 else float("nan")
    offpeak_mape = _safe_mape(y_true[~peak_mask], y_pred[~peak_mask]) if (~peak_mask).sum() > 0 else float("nan")

    # ---- Per-season MAPE ----------------------------------------------------
    month         = _aest_month(ts)
    season_series = _season(month)
    season_mapes: Dict[str, float] = {}
    for s in SEASONS:
        mask = (season_series == s).values
        key  = f"mape_{s.lower()}"
        season_mapes[key] = _safe_mape(y_true[mask], y_pred[mask]) if mask.sum() > 0 else float("nan")

    return {
        "mae_mw":           mae_mw,
        "rmse_mw":          rmse_mw,
        "mape_pct":         mape_pct,
        "major_miss_rate":  major_miss_rate,
        "peak_mape_pct":    peak_mape,
        "offpeak_mape_pct": offpeak_mape,
        **season_mapes,
    }


# ---------------------------------------------------------------------------
# Console summary logging
# ---------------------------------------------------------------------------

def _log_summary(region: str, metrics: Dict[str, float], target_met: bool) -> None:
    status = "PASS" if target_met else "FAIL"
    logger.info(
        "[%s] %s | MAE: %.1f MW | RMSE: %.1f MW | MAPE: %.2f%% (target <%.1f%%)",
        status, region,
        metrics["mae_mw"], metrics["rmse_mw"],
        metrics["mape_pct"], MAPE_TARGET_PCT,
    )
    logger.info(
        "       Peak MAPE: %.2f%% | Off-peak MAPE: %.2f%% | Major-miss rate: %.2f%%",
        metrics.get("peak_mape_pct",    float("nan")),
        metrics.get("offpeak_mape_pct", float("nan")),
        metrics.get("major_miss_rate",  0.0) * 100.0,
    )
    logger.info(
        "       Seasonal -- DJF: %.2f%% | MAM: %.2f%% | JJA: %.2f%% | SON: %.2f%%",
        metrics.get("mape_djf", float("nan")),
        metrics.get("mape_mam", float("nan")),
        metrics.get("mape_jja", float("nan")),
        metrics.get("mape_son", float("nan")),
    )


# ---------------------------------------------------------------------------
# MLflow metric logging
# ---------------------------------------------------------------------------

def log_metrics_to_mlflow(region: str, metrics: Dict[str, float]) -> None:
    """Log all metrics under naming convention: demand_{region}_{metric}."""
    region_lower = region.lower()
    safe_metrics = {
        f"demand_{region_lower}_{k}": v
        for k, v in metrics.items()
        if isinstance(v, (int, float)) and not (
            isinstance(v, float) and (np.isnan(v) or np.isinf(v))
        )
    }
    mlflow.log_metrics(safe_metrics)
    logger.debug("Logged %d metrics to MLflow for %s", len(safe_metrics), region)


# ---------------------------------------------------------------------------
# Champion promotion
# ---------------------------------------------------------------------------

def maybe_promote_champion(results: List[Dict[str, Any]], promote: bool) -> None:
    """
    Set the 'champion' alias on all production model versions when every
    evaluated region meets the MAPE target and --promote is passed.
    """
    if not promote:
        logger.info("Promotion skipped (pass --promote to enable).")
        return

    failing = [r["region"] for r in results if not r["mape_target_met"]]
    if failing:
        logger.warning(
            "Champion promotion skipped -- regions not meeting MAPE < %.1f%%: %s",
            MAPE_TARGET_PCT, failing,
        )
        return

    client = MlflowClient()
    for r in results:
        region = r["region"]
        try:
            model_name = MODEL_REGISTRY_TMPL.format(region=region.lower())
            version    = client.get_model_version_by_alias(model_name, MODEL_ALIAS)
            client.set_registered_model_alias(model_name, CHAMPION_ALIAS, version.version)
            logger.info("Champion alias set: %s v%s", model_name, version.version)
        except Exception as exc:
            logger.error("Failed to set champion alias for %s: %s", region, exc)


# ---------------------------------------------------------------------------
# Delta table write
# ---------------------------------------------------------------------------

def write_eval_table(spark: Any, results: List[Dict[str, Any]]) -> None:
    """Flatten results and persist to gold.demand_forecast_evaluation."""
    rows = []
    for r in results:
        row: Dict[str, Any] = {
            "region":          r["region"],
            "evaluation_time": r["evaluation_time"],
            "n_rows":          r["n_rows"],
            "mape_target_met": r["mape_target_met"],
        }
        row.update(r["metrics"])
        rows.append(row)

    (
        spark.createDataFrame(pd.DataFrame(rows))
        .write.format("delta")
        .mode("overwrite")
        .option("overwriteSchema", "true")
        .saveAsTable(EVAL_TABLE)
    )
    logger.info("Evaluation table written: %s (%d rows)", EVAL_TABLE, len(rows))


# ---------------------------------------------------------------------------
# Per-region evaluation
# ---------------------------------------------------------------------------

def evaluate_region(
    spark: Optional[Any],
    region: str,
    unit_test_mode: bool = False,
) -> Dict[str, Any]:
    """
    Evaluate a single NEM region and return a result dict.

    In unit_test_mode (spark=None):
        Synthetic demand data is used; no MLflow / Spark calls are made.
        The synthetic forecast adds ~1.5% MAPE correlated noise to simulate
        a well-calibrated model.

    Returns
    -------
    Dict with keys: region, evaluation_time, n_rows, metrics, mape_target_met
    """
    logger.info("Starting evaluation for region: %s", region)

    if unit_test_mode:
        df       = _synthetic_demand()
        df       = reconstruct_features(df, ts_col="settlementdate")
        rng      = np.random.default_rng(123)
        y_true   = df["totaldemand"].values.astype(float)
        # Simulate a ~2% MAPE forecast with correlated noise
        y_pred   = (
            y_true * (1.0 + rng.normal(0.0, 0.012, len(y_true)))
            + rng.normal(0.0, 25.0, len(y_true))
        )
        metrics  = compute_all_metrics(
            df, y_pred, target_col="totaldemand", ts_col="settlementdate"
        )
    else:
        model    = load_production_model(region)
        df       = load_test_data_spark(spark, region)

        # Align to model input schema
        try:
            feat_cols = model.metadata.get_input_schema().input_names()
        except Exception:
            excluded  = {"settlementdate", "regionid", "totaldemand", "rrp", "season"}
            feat_cols = [c for c in df.columns if c not in excluded]

        for col in feat_cols:
            if col not in df.columns:
                df[col] = 0.0

        y_pred   = np.array(model.predict(df[feat_cols]), dtype=float)
        metrics  = compute_all_metrics(
            df, y_pred, target_col="totaldemand", ts_col="settlementdate"
        )

    mape_target_met = metrics["mape_pct"] < MAPE_TARGET_PCT

    result: Dict[str, Any] = {
        "region":          region,
        "evaluation_time": datetime.now(tz=timezone.utc).isoformat(),
        "n_rows":          len(df),
        "metrics":         metrics,
        "mape_target_met": mape_target_met,
    }

    _log_summary(region, metrics, mape_target_met)
    return result


# ---------------------------------------------------------------------------
# Null context manager (unit-test mode -- avoids MLflow calls)
# ---------------------------------------------------------------------------

@contextmanager
def _null_context() -> Generator:
    yield


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def run_evaluation(
    spark: Optional[Any],
    regions: Optional[List[str]] = None,
    promote: bool = False,
    unit_test_mode: bool = False,
) -> List[Dict[str, Any]]:
    """
    Run the full evaluation pipeline for one or more NEM regions.

    Parameters
    ----------
    spark          : Active SparkSession, or None for unit-test mode.
    regions        : List of region IDs; defaults to all five NEM regions.
    promote        : Set 'champion' alias when all targets are met.
    unit_test_mode : Use synthetic data -- requires neither Spark nor MLflow.
    """
    regions = regions or NEM_REGIONS

    if not unit_test_mode:
        mlflow.set_experiment(MLFLOW_EXPERIMENT)

    run_name = f"demand_eval_{datetime.utcnow().strftime('%Y%m%d_%H%M')}"
    ctx = (
        mlflow.start_run(run_name=run_name)
        if not unit_test_mode
        else _null_context()
    )

    results: List[Dict[str, Any]] = []
    with ctx:
        for region in regions:
            try:
                result = evaluate_region(spark, region, unit_test_mode=unit_test_mode)
                results.append(result)
                if not unit_test_mode:
                    log_metrics_to_mlflow(region, result["metrics"])
            except Exception as exc:
                logger.error(
                    "Evaluation failed for %s: %s", region, exc, exc_info=True
                )

        if results:
            report_path = "/tmp/demand_forecast_eval_report.json"
            with open(report_path, "w") as fh:
                json.dump(results, fh, indent=2, default=str)

            if not unit_test_mode:
                mlflow.log_artifact(report_path, artifact_path="evaluation")
                write_eval_table(spark, results)

        maybe_promote_champion(results, promote=promote)

    return results


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m models.demand_forecast.evaluate",
        description=(
            "Evaluate production demand forecast models for NEM regions.\n"
            "MAPE target: < %.1f%%" % MAPE_TARGET_PCT
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument(
        "--region",
        type=str,
        default=None,
        metavar="REGION",
        help="Single NEM region to evaluate (e.g. NSW1, QLD1, VIC1, SA1, TAS1).",
    )
    p.add_argument(
        "--all-regions",
        action="store_true",
        help="Evaluate all five NEM regions (default when no --region is given).",
    )
    p.add_argument(
        "--promote",
        action="store_true",
        help=(
            "Set 'champion' alias on all model versions when MAPE < %.1f%% "
            "for every region." % MAPE_TARGET_PCT
        ),
    )
    p.add_argument(
        "--unit-test",
        action="store_true",
        help="Run with synthetic demand data -- no Spark, MLflow, or Delta required.",
    )
    return p


def main(argv: Optional[List[str]] = None) -> int:
    parser = _build_parser()
    args   = parser.parse_args(argv)

    unit_test_mode = args.unit_test

    if args.region:
        regions = [args.region.upper()]
    else:
        regions = NEM_REGIONS   # --all-regions or default

    if unit_test_mode:
        logger.info(
            "Unit-test mode active -- synthetic demand data, no external dependencies."
        )
        spark = None
    else:
        from pyspark.sql import SparkSession
        spark = SparkSession.builder.getOrCreate()

    results = run_evaluation(
        spark,
        regions=regions,
        promote=args.promote,
        unit_test_mode=unit_test_mode,
    )

    # ---- Print summary table ------------------------------------------------
    hr = "=" * 74
    print(f"\n{hr}")
    print(
        f"{'Region':<8} {'MAE (MW)':>10} {'RMSE (MW)':>10} "
        f"{'MAPE (%)':>10} {'Peak MAPE':>11} {'Target':>7}"
    )
    print("-" * 74)
    for r in results:
        m      = r["metrics"]
        status = "PASS" if r["mape_target_met"] else "FAIL"
        peak   = m.get("peak_mape_pct", float("nan"))
        print(
            f"{r['region']:<8} {m['mae_mw']:>10.1f} {m['rmse_mw']:>10.1f} "
            f"{m['mape_pct']:>10.2f} {peak:>11.2f} {status:>7}"
        )
    print(hr)

    all_pass = all(r["mape_target_met"] for r in results) if results else False
    if not all_pass:
        logger.warning(
            "One or more regions did not meet the MAPE < %.1f%% target.",
            MAPE_TARGET_PCT,
        )
        return 1
    logger.info(
        "All evaluated regions meet the MAPE < %.1f%% target.", MAPE_TARGET_PCT
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
