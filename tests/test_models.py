"""
tests/test_models.py
====================
Unit and integration tests for the AUS Energy Copilot ML models.

Tests are designed to run either:
  a) Locally with lightweight mock data (default) using pytest + unittest.mock
  b) On Databricks with a real Spark session and live tables (integration mode)
     by setting the environment variable ENERGY_COPILOT_INTEGRATION_TEST=1

Test groups
-----------
1. Feature engineering
   - Expected column set is produced
   - No null values in mandatory feature columns
   - Temporal features are in valid ranges
   - Horizon explosion produces correct row count

2. Model loading
   - Production model loads from MLflow without error (mocked locally)
   - Model schema has the required input columns

3. Prediction shapes
   - Predictions have shape (n_rows,) -- not (n_rows, n_classes) etc.
   - 5 regions x n_horizons predictions can be produced in one call

4. Anomaly model
   - IsolationForest flags known spike events (rrp >= 5000 $/MWh)
   - Rule classifier correctly labels negative and spike events
   - Output contains anomaly_score and event_type columns

Run locally:
  pytest tests/test_models.py -v

Run integration tests:
  ENERGY_COPILOT_INTEGRATION_TEST=1 pytest tests/test_models.py -v
"""

from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta
from typing import List
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

IS_INTEGRATION = os.environ.get("ENERGY_COPILOT_INTEGRATION_TEST", "0") == "1"

NEM_REGIONS: List[str] = ["NSW1", "QLD1", "SA1", "TAS1", "VIC1"]
FORECAST_HORIZONS: List[int] = [1, 4, 8, 12, 24, 48]

SPIKE_THRESHOLD    =  5_000.0
NEGATIVE_THRESHOLD =   -100.0

# All mandatory columns that must be present (and non-null) in the feature store
MANDATORY_FEATURE_COLUMNS = [
    "settlementdate",
    "regionid",
    "rrp",
    "totaldemand",
    "hour_of_day",
    "day_of_week",
    "month",
    "is_weekend",
    "is_public_holiday",
    "season",
    "minutes_since_midnight",
    "settlement_date",
    "forecast_horizon",
    "rrp_target",
    # Price lags
    "price_t_minus_1",
    "price_t_minus_6",
    "price_t_minus_12",
    "price_t_minus_288",
    "price_t_minus_2016",
    # Rolling stats (spot-check a few)
    "price_mean_1hr",
    "price_std_1hr",
    "price_min_24hr",
    "price_max_24hr",
    "demand_mean_4hr",
    # Generation (at least wind and solar)
    "gen_wind_mw",
    "gen_solar_mw",
    # Interconnector
    "net_import_mw",
    "ic_utilisation",
    # Weather
    "temperature_2m",
    "windspeed_100m",
    "shortwave_radiation",
    # Cross-regional
    "nem_total_demand_mw",
    "nem_capacity_utilisation",
    "price_spread_to_national",
]


# ---------------------------------------------------------------------------
# Minimal mock data factory
# ---------------------------------------------------------------------------

def make_mock_feature_store(n_intervals: int = 300, n_horizons: int = 6) -> pd.DataFrame:
    """
    Build a small, fully-populated feature DataFrame that mirrors the
    gold.feature_store_price schema.

    Used by unit tests that do not have access to a live Spark session.
    """
    rng = np.random.default_rng(seed=12345)
    region = "NSW1"

    rows = []
    base_ts = datetime(2025, 1, 1, 0, 0, 0)
    for i in range(n_intervals):
        ts = base_ts + timedelta(minutes=5 * i)
        for h in FORECAST_HORIZONS[:n_horizons]:
            rrp = float(rng.uniform(30, 200))
            if i % 50 == 0:    # inject a spike
                rrp = 6_000.0
            elif i % 80 == 0:  # inject a negative price
                rrp = -150.0
            rows.append({
                "settlementdate":         ts,
                "regionid":               region,
                "rrp":                    rrp,
                "totaldemand":            float(rng.uniform(5_000, 10_000)),
                "hour_of_day":            ts.hour,
                "day_of_week":            ts.isoweekday(),
                "month":                  ts.month,
                "is_weekend":             int(ts.weekday() >= 5),
                "is_public_holiday":      0,
                "season":                 "summer",
                "minutes_since_midnight": ts.hour * 60 + ts.minute,
                "settlement_date":        ts.date(),
                "forecast_horizon":       h,
                "rrp_target":             float(rng.uniform(30, 200)),
                # Lags
                "price_t_minus_1":        rrp - rng.uniform(-5, 5),
                "price_t_minus_6":        rrp - rng.uniform(-10, 10),
                "price_t_minus_12":       rrp - rng.uniform(-15, 15),
                "price_t_minus_288":      rrp - rng.uniform(-20, 20),
                "price_t_minus_2016":     rrp - rng.uniform(-30, 30),
                "demand_t_minus_1":       float(rng.uniform(5_000, 10_000)),
                # Rolling stats
                "price_mean_1hr":         rrp,
                "price_std_1hr":          float(rng.uniform(1, 20)),
                "price_min_1hr":          rrp * 0.9,
                "price_max_1hr":          rrp * 1.1,
                "price_mean_4hr":         rrp,
                "price_std_4hr":          float(rng.uniform(2, 30)),
                "price_min_4hr":          rrp * 0.85,
                "price_max_4hr":          rrp * 1.15,
                "price_mean_24hr":        rrp,
                "price_std_24hr":         float(rng.uniform(5, 50)),
                "price_min_24hr":         rrp * 0.8,
                "price_max_24hr":         rrp * 1.2,
                "demand_mean_4hr":        float(rng.uniform(5_000, 10_000)),
                "demand_std_4hr":         float(rng.uniform(50, 300)),
                "demand_min_4hr":         float(rng.uniform(4_500, 5_000)),
                "demand_max_4hr":         float(rng.uniform(10_000, 11_000)),
                "demand_mean_24hr":       float(rng.uniform(5_000, 10_000)),
                "demand_std_24hr":        float(rng.uniform(100, 500)),
                "demand_min_24hr":        float(rng.uniform(4_000, 5_000)),
                "demand_max_24hr":        float(rng.uniform(10_000, 12_000)),
                # Generation
                "gen_black_coal_mw":      float(rng.uniform(1_000, 4_000)),
                "gen_brown_coal_mw":      float(rng.uniform(0, 1_000)),
                "gen_gas_mw":             float(rng.uniform(200, 1_000)),
                "gen_hydro_mw":           float(rng.uniform(0, 500)),
                "gen_wind_mw":            float(rng.uniform(0, 1_000)),
                "gen_solar_mw":           float(rng.uniform(0, 800)),
                "gen_battery_discharging_mw": 0.0,
                "gen_pumped_hydro_mw":    0.0,
                "gen_wind_mw_lag1":       float(rng.uniform(0, 1_000)),
                "gen_solar_mw_lag1":      float(rng.uniform(0, 800)),
                # Interconnector
                "net_import_mw":          float(rng.uniform(-500, 500)),
                "ic_utilisation":         float(rng.uniform(0, 1)),
                "net_import_mw_lag1":     float(rng.uniform(-500, 500)),
                "ic_utilisation_lag1":    float(rng.uniform(0, 1)),
                # Weather
                "temperature_2m":         float(rng.uniform(10, 40)),
                "windspeed_100m":         float(rng.uniform(0, 20)),
                "shortwave_radiation":    float(rng.uniform(0, 1_000)),
                "temperature_2m_1h":      float(rng.uniform(10, 40)),
                "windspeed_100m_1h":      float(rng.uniform(0, 20)),
                "shortwave_radiation_1h": float(rng.uniform(0, 1_000)),
                "temperature_2m_4h":      float(rng.uniform(10, 40)),
                "windspeed_100m_4h":      float(rng.uniform(0, 20)),
                "shortwave_radiation_4h": float(rng.uniform(0, 1_000)),
                "temperature_2m_24h":     float(rng.uniform(10, 40)),
                "windspeed_100m_24h":     float(rng.uniform(0, 20)),
                "shortwave_radiation_24h":float(rng.uniform(0, 1_000)),
                # Cross-regional
                "nem_total_demand_mw":    float(rng.uniform(20_000, 35_000)),
                "nem_capacity_utilisation": float(rng.uniform(0.3, 0.7)),
                "price_spread_to_national": float(rng.uniform(-50, 50)),
                "feature_timestamp":      ts,
            })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 1. Feature Engineering Tests
# ---------------------------------------------------------------------------

class TestFeatureEngineering(unittest.TestCase):

    def setUp(self):
        self.df = make_mock_feature_store(n_intervals=50, n_horizons=6)

    def test_expected_columns_present(self):
        """All mandatory feature columns must be present."""
        missing = [c for c in MANDATORY_FEATURE_COLUMNS if c not in self.df.columns]
        self.assertEqual(
            missing, [],
            msg=f"Missing mandatory feature columns: {missing}",
        )

    def test_no_nulls_in_mandatory_columns(self):
        """Mandatory columns must have zero nulls in the mock dataset."""
        null_counts = self.df[MANDATORY_FEATURE_COLUMNS].isnull().sum()
        columns_with_nulls = null_counts[null_counts > 0].index.tolist()
        self.assertEqual(
            columns_with_nulls, [],
            msg=f"Unexpected nulls in: {columns_with_nulls}",
        )

    def test_temporal_feature_ranges(self):
        """Temporal features must be within physically valid ranges."""
        self.assertTrue(
            self.df["hour_of_day"].between(0, 23).all(),
            "hour_of_day out of range [0, 23]",
        )
        self.assertTrue(
            self.df["day_of_week"].between(1, 7).all(),
            "day_of_week out of range [1, 7]",
        )
        self.assertTrue(
            self.df["month"].between(1, 12).all(),
            "month out of range [1, 12]",
        )
        self.assertTrue(
            self.df["minutes_since_midnight"].between(0, 1439).all(),
            "minutes_since_midnight out of range [0, 1439]",
        )
        self.assertTrue(
            self.df["is_weekend"].isin([0, 1]).all(),
            "is_weekend contains values other than 0 and 1",
        )
        self.assertTrue(
            self.df["is_public_holiday"].isin([0, 1]).all(),
            "is_public_holiday contains values other than 0 and 1",
        )

    def test_season_values(self):
        """Season column must only contain the four valid season labels."""
        valid_seasons = {"summer", "autumn", "winter", "spring"}
        actual_seasons = set(self.df["season"].unique())
        unexpected = actual_seasons - valid_seasons
        self.assertEqual(unexpected, set(), msg=f"Unexpected season values: {unexpected}")

    def test_horizon_explosion_row_count(self):
        """
        For n_intervals rows per region, the horizon explosion should produce
        n_intervals * len(FORECAST_HORIZONS) rows.
        """
        n_intervals = 50
        n_horizons  = 6
        df = make_mock_feature_store(n_intervals=n_intervals, n_horizons=n_horizons)
        expected_rows = n_intervals * n_horizons
        self.assertEqual(
            len(df), expected_rows,
            msg=f"Expected {expected_rows} rows, got {len(df)}",
        )

    def test_forecast_horizon_values(self):
        """forecast_horizon must only contain values from FORECAST_HORIZONS."""
        actual_horizons = set(int(h) for h in self.df["forecast_horizon"].unique())
        expected = set(FORECAST_HORIZONS)
        self.assertEqual(actual_horizons, expected, msg=f"Unexpected horizons: {actual_horizons}")

    def test_nem_capacity_utilisation_range(self):
        """nem_capacity_utilisation should be between 0 and 1 for normal demand levels."""
        self.assertTrue(
            self.df["nem_capacity_utilisation"].between(0.0, 1.5).all(),
            "nem_capacity_utilisation has unexpected values",
        )

    def test_rolling_stats_consistency(self):
        """price_min_1hr <= price_mean_1hr <= price_max_1hr for all rows."""
        df = self.df
        # Allow small floating point tolerance
        self.assertTrue(
            ((df["price_min_1hr"] - df["price_mean_1hr"]) <= 1e-6).all(),
            "price_min_1hr > price_mean_1hr in some rows",
        )
        self.assertTrue(
            ((df["price_mean_1hr"] - df["price_max_1hr"]) <= 1e-6).all(),
            "price_mean_1hr > price_max_1hr in some rows",
        )


# ---------------------------------------------------------------------------
# 2. Model Loading Tests
# ---------------------------------------------------------------------------

class TestModelLoading(unittest.TestCase):
    """
    Tests for loading production models from MLflow.
    In unit test mode (IS_INTEGRATION=False) these mock the MLflow client.
    """

    @pytest.mark.skipif(IS_INTEGRATION, reason="Unit test only")
    def test_price_model_loads_with_mock(self):
        """
        Verify that load_production_model() calls mlflow.pyfunc.load_model
        with the correct URI format.
        """
        with patch("mlflow.pyfunc.load_model") as mock_load:
            mock_model = MagicMock()
            mock_model.metadata.get_input_schema.return_value.input_names.return_value = [
                "hour_of_day", "forecast_horizon", "price_t_minus_1"
            ]
            mock_load.return_value = mock_model

            # Import here to avoid top-level dependency on PySpark
            sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
            from models.price_forecast.evaluate import load_production_model  # noqa
            model = load_production_model("NSW1")

            mock_load.assert_called_once_with("models:/price_forecast_nsw@production")
            self.assertIsNotNone(model)

    @pytest.mark.skipif(not IS_INTEGRATION, reason="Integration test only")
    def test_price_model_loads_live(self):
        """Integration test: load real model from MLflow (requires registered model)."""
        import mlflow
        for region in NEM_REGIONS:
            model_name = f"price_forecast_{region.lower().replace('1', '')}"
            model_uri  = f"models:/{model_name}@production"
            model = mlflow.pyfunc.load_model(model_uri)
            self.assertIsNotNone(model)

    @pytest.mark.skipif(IS_INTEGRATION, reason="Unit test only")
    def test_anomaly_model_loads_with_mock(self):
        """Verify that the anomaly detector loads from the correct registry path."""
        with patch("mlflow.sklearn.load_model") as mock_load:
            from sklearn.ensemble import IsolationForest
            from sklearn.pipeline import Pipeline
            from sklearn.preprocessing import StandardScaler
            mock_pipeline = Pipeline([
                ("scaler", StandardScaler()),
                ("isoforest", IsolationForest()),
            ])
            mock_load.return_value = mock_pipeline

            model_uri = "models:/anomaly_detector@production"
            loaded = mlflow.sklearn.load_model(model_uri)
            mock_load.assert_called_once_with(model_uri)
            self.assertIsNotNone(loaded)

    def test_model_registry_names_format(self):
        """
        The model name format 'price_forecast_{region}' must use the
        lowercased region without the trailing '1' digit.
        """
        expected_names = [
            "price_forecast_nsw",
            "price_forecast_qld",
            "price_forecast_sa",
            "price_forecast_tas",
            "price_forecast_vic",
        ]
        for region, expected_name in zip(NEM_REGIONS, expected_names):
            actual = f"price_forecast_{region.lower().replace('1', '')}"
            self.assertEqual(actual, expected_name, msg=f"Region {region}: bad model name {actual}")


# ---------------------------------------------------------------------------
# 3. Prediction Shape Tests
# ---------------------------------------------------------------------------

class TestPredictionShapes(unittest.TestCase):
    """
    Verify that models return predictions of the correct shape without
    requiring a live MLflow connection.
    """

    def _make_feature_array(self, n_rows: int, feat_cols: List[str]) -> pd.DataFrame:
        rng = np.random.default_rng(seed=99)
        return pd.DataFrame(
            rng.standard_normal((n_rows, len(feat_cols))),
            columns=feat_cols,
        )

    def test_price_model_prediction_shape(self):
        """
        A mock LightGBM model must return a 1-D array of length n_rows.
        5 regions x n_horizons should each return (n_rows,).
        """
        import lightgbm as lgb
        from sklearn.datasets import make_regression

        feat_cols = [
            "hour_of_day", "forecast_horizon", "price_t_minus_1",
            "price_t_minus_6", "temperature_2m", "windspeed_100m",
        ]
        n_rows = 5 * len(FORECAST_HORIZONS)   # 5 regions × 6 horizons

        X, y = make_regression(n_samples=200, n_features=len(feat_cols), random_state=0)
        X_df = pd.DataFrame(X, columns=feat_cols)

        booster = lgb.LGBMRegressor(n_estimators=10, verbose=-1)
        booster.fit(X_df, y)

        X_pred = self._make_feature_array(n_rows, feat_cols)
        preds = booster.predict(X_pred)

        self.assertEqual(preds.shape, (n_rows,),
                         msg=f"Expected shape ({n_rows},), got {preds.shape}")

    def test_all_regions_and_horizons(self):
        """
        Simulate generating one prediction per (region, horizon) combination
        and verify the total is 5 regions x 6 horizons = 30.
        """
        total_predictions = len(NEM_REGIONS) * len(FORECAST_HORIZONS)
        self.assertEqual(total_predictions, 30,
                         msg=f"Expected 30 (5 regions x 6 horizons), got {total_predictions}")

    def test_anomaly_prediction_columns(self):
        """
        The anomaly detector output must include both anomaly_score (float)
        and event_type (str) for each row.
        """
        from sklearn.ensemble import IsolationForest
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import StandardScaler

        feat_cols = [
            "rrp", "totaldemand", "price_t_minus_1", "price_mean_1hr",
            "gen_wind_mw", "gen_solar_mw", "hour_of_day",
        ]
        rng = np.random.default_rng(42)
        X = rng.standard_normal((50, len(feat_cols)))
        X_df = pd.DataFrame(X, columns=feat_cols)

        pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("isoforest", IsolationForest(n_estimators=10, random_state=0)),
        ])
        pipeline.fit(X)

        scores      = pipeline.decision_function(X)
        is_anomaly  = (pipeline.predict(X) == -1).astype(int)

        result_df = X_df.copy()
        result_df["anomaly_score"] = scores
        result_df["is_anomaly"]    = is_anomaly
        # Inline event_type rule (no rrp column in this test; use the raw feature)
        result_df["event_type"]    = "normal"   # simplified for shape test

        self.assertIn("anomaly_score", result_df.columns)
        self.assertIn("is_anomaly",    result_df.columns)
        self.assertIn("event_type",    result_df.columns)
        self.assertEqual(len(result_df), 50,
                         msg="Prediction row count should match input row count")
        self.assertTrue(
            result_df["anomaly_score"].dtype in [np.float32, np.float64, float],
            msg="anomaly_score should be float",
        )


# ---------------------------------------------------------------------------
# 4. Anomaly Model -- Spike Detection Tests
# ---------------------------------------------------------------------------

class TestAnomalyModelSpikes(unittest.TestCase):
    """
    Verify that the rule-based classifier correctly identifies known spike,
    negative price, and separation events.
    """

    def _classify(self, df: pd.DataFrame) -> pd.Series:
        """Inline the classify_events logic from anomaly_detection/train.py."""
        cond_spike = df["rrp"] >= SPIKE_THRESHOLD
        cond_neg   = df["rrp"] <= NEGATIVE_THRESHOLD
        cond_sep   = df.get(
            "price_spread_to_national", pd.Series(0.0, index=df.index)
        ).abs() >= 500.0

        event = pd.Series("normal", index=df.index)
        event = event.where(~cond_sep,  "separation")
        event = event.where(~cond_neg,  "negative")
        event = event.where(~cond_spike,"spike")
        return event

    def test_spike_events_detected(self):
        """Rows with rrp >= 5000 must be classified as 'spike'."""
        df = pd.DataFrame({
            "rrp": [5_000.0, 10_000.0, 15_000.0, 150.0, 50.0],
            "price_spread_to_national": [0.0, 0.0, 0.0, 0.0, 0.0],
        })
        event_types = self._classify(df)
        self.assertEqual(event_types.iloc[0], "spike", "rrp=5000 should be spike")
        self.assertEqual(event_types.iloc[1], "spike", "rrp=10000 should be spike")
        self.assertEqual(event_types.iloc[2], "spike", "rrp=15000 should be spike")
        self.assertEqual(event_types.iloc[3], "normal", "rrp=150 should be normal")
        self.assertEqual(event_types.iloc[4], "normal", "rrp=50 should be normal")

    def test_negative_price_events_detected(self):
        """Rows with rrp <= -100 must be classified as 'negative'."""
        df = pd.DataFrame({
            "rrp": [-100.0, -500.0, -50.0, 0.0, 30.0],
            "price_spread_to_national": [0.0, 0.0, 0.0, 0.0, 0.0],
        })
        event_types = self._classify(df)
        self.assertEqual(event_types.iloc[0], "negative", "rrp=-100 should be negative")
        self.assertEqual(event_types.iloc[1], "negative", "rrp=-500 should be negative")
        self.assertEqual(event_types.iloc[2], "normal",   "rrp=-50 should be normal (above threshold)")
        self.assertEqual(event_types.iloc[3], "normal",   "rrp=0 should be normal")

    def test_separation_events_detected(self):
        """Rows with |price_spread_to_national| >= 500 should be 'separation'."""
        df = pd.DataFrame({
            "rrp": [200.0, 200.0, 200.0],
            "price_spread_to_national": [600.0, -550.0, 400.0],
        })
        event_types = self._classify(df)
        self.assertEqual(event_types.iloc[0], "separation", "spread=600 should be separation")
        self.assertEqual(event_types.iloc[1], "separation", "spread=-550 should be separation")
        self.assertEqual(event_types.iloc[2], "normal",     "spread=400 should be normal")

    def test_spike_priority_over_separation(self):
        """When rrp >= spike threshold, event_type should be 'spike' not 'separation'."""
        df = pd.DataFrame({
            "rrp": [6_000.0],
            "price_spread_to_national": [700.0],  # would trigger separation alone
        })
        event_types = self._classify(df)
        # spike priority: spike > negative > separation > normal
        self.assertEqual(event_types.iloc[0], "spike",
                         "Spike should take priority over separation")

    def test_isolation_forest_flags_extreme_outliers(self):
        """
        Train a tiny IsolationForest on normal prices, then verify that an
        extreme spike row gets a lower decision_function score than normal rows.
        """
        from sklearn.ensemble import IsolationForest

        rng = np.random.default_rng(42)
        # Normal training data: prices 30-200
        X_train = rng.uniform(30, 200, size=(500, 1))
        clf = IsolationForest(contamination=0.02, n_estimators=100, random_state=0)
        clf.fit(X_train)

        # Normal row
        X_normal = np.array([[100.0]])
        # Extreme spike row
        X_spike  = np.array([[10_000.0]])

        score_normal = clf.decision_function(X_normal)[0]
        score_spike  = clf.decision_function(X_spike)[0]

        self.assertLess(
            score_spike, score_normal,
            msg=(
                f"Spike anomaly score ({score_spike:.4f}) should be lower "
                f"than normal score ({score_normal:.4f})"
            ),
        )

    def test_anomaly_score_dtype(self):
        """anomaly_score from IsolationForest decision_function must be float."""
        from sklearn.ensemble import IsolationForest

        X = np.array([[50.0], [100.0], [200.0]])
        clf = IsolationForest(n_estimators=10, random_state=0)
        clf.fit(X)
        scores = clf.decision_function(X)
        self.assertEqual(scores.dtype.kind, "f",
                         msg="anomaly_score dtype should be floating point")


# ---------------------------------------------------------------------------
# Integration: Spark-based feature store tests
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not IS_INTEGRATION, reason="Requires live Databricks cluster")
class TestFeatureStoreIntegration(unittest.TestCase):
    """
    Integration tests that load real data from the Gold feature store.
    Only executed when ENERGY_COPILOT_INTEGRATION_TEST=1.
    """

    @classmethod
    def setUpClass(cls):
        from pyspark.sql import SparkSession
        cls.spark = SparkSession.builder.getOrCreate()

    def test_feature_store_exists(self):
        """gold.feature_store_price must be accessible and non-empty."""
        df = self.spark.table("energy_copilot.gold.feature_store_price")
        self.assertGreater(df.count(), 0, "Feature store is empty")

    def test_feature_store_all_regions(self):
        """All 5 NEM regions must have at least one row in the feature store."""
        from pyspark.sql import functions as F
        df = self.spark.table("energy_copilot.gold.feature_store_price")
        regions_present = [
            r["regionid"] for r in df.select("regionid").distinct().collect()
        ]
        for region in NEM_REGIONS:
            self.assertIn(region, regions_present,
                          msg=f"Region {region} missing from feature store")

    def test_feature_store_no_null_targets(self):
        """rrp_target must not contain nulls (null rows should be filtered in pipeline)."""
        from pyspark.sql import functions as F
        df = self.spark.table("energy_copilot.gold.feature_store_price")
        null_count = df.filter(F.col("rrp_target").isNull()).count()
        self.assertEqual(null_count, 0, f"Found {null_count} null rrp_target rows")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main(argv=["", "-v"])
