"""
Feature Engineering -- Price Forecast Feature Store
=====================================================
Builds energy_copilot.gold.feature_store_price by joining:
  - Temporal: hour_of_day, day_of_week, month, is_weekend,
               is_public_holiday (Australian states), season,
               minutes_since_midnight
  - Price/market lags: t-1 (5min), t-6 (30min), t-12 (1hr),
                        t-288 (24hr), t-2016 (7 days)
  - Rolling statistics: mean, std, min, max over 1hr/4hr/24hr windows
                        for both price (rrp) and demand (totaldemand)
  - Generation by fuel type (gen_<fuel>_mw) plus t-1 lags
  - Interconnector net_import_mw, ic_utilisation plus t-1 lags
  - Weather: temperature_2m, windspeed_100m, shortwave_radiation
             (current + NWP +1hr/+4hr/+24hr forecast variants)
  - Cross-regional: price_spread_to_national, nem_total_demand_mw,
                    nem_capacity_utilisation
  - forecast_horizon as integer feature (1, 4, 8, 12, 24, 48 x 5-min intervals)

Platform : Databricks Runtime 15.4 LTS+, PySpark 3.5
Output   : energy_copilot.gold.feature_store_price
           Partitioned by (regionid, settlement_date)
"""

from __future__ import annotations

import logging
from typing import List

from pyspark.sql import SparkSession, DataFrame, Window
import pyspark.sql.functions as F
import pyspark.sql.types as T

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CATALOG      = "energy_copilot"
SILVER       = f"{CATALOG}.silver"
BRONZE       = f"{CATALOG}.bronze"
GOLD         = f"{CATALOG}.gold"
TARGET_TABLE = f"{GOLD}.feature_store_price"

NEM_REGIONS: List[str] = ["NSW1", "QLD1", "SA1", "TAS1", "VIC1"]

# Lag periods in 5-minute dispatch intervals
PRICE_LAG_STEPS = {
    "t_minus_1":    1,
    "t_minus_6":    6,
    "t_minus_12":   12,
    "t_minus_288":  288,
    "t_minus_2016": 2016,
}

# Rolling window sizes in 5-min intervals
ROLLING_WINDOWS = {
    "1hr":  12,
    "4hr":  48,
    "24hr": 288,
}

# Forecast horizons as integer multiples of the 5-min dispatch interval
FORECAST_HORIZONS: List[int] = [1, 4, 8, 12, 24, 48]

# NEM generation fuel type categories
FUEL_TYPES: List[str] = [
    "black_coal",
    "brown_coal",
    "gas",
    "hydro",
    "wind",
    "solar",
    "battery_discharging",
    "pumped_hydro",
]

# Approximate NEM installed capacity (MW) for utilisation ratio
NEM_CAPACITY_MW: float = 55_000.0


# ---------------------------------------------------------------------------
# Temporal features
# ---------------------------------------------------------------------------

def add_temporal_features(df: DataFrame) -> DataFrame:
    """Attach clock and calendar features derived from settlementdate."""
    return (
        df
        .withColumn("hour_of_day",           F.hour("settlementdate"))
        .withColumn(
            "minutes_since_midnight",
            F.hour("settlementdate") * 60 + F.minute("settlementdate"),
        )
        .withColumn("day_of_week",   F.dayofweek("settlementdate"))   # 1=Sun ... 7=Sat
        .withColumn("month",         F.month("settlementdate"))
        .withColumn(
            "is_weekend",
            (F.dayofweek("settlementdate").isin(1, 7)).cast("int"),
        )
        .withColumn(
            "season",
            F.when(F.month("settlementdate").isin(12, 1, 2), F.lit("summer"))
             .when(F.month("settlementdate").isin(3, 4, 5),  F.lit("autumn"))
             .when(F.month("settlementdate").isin(6, 7, 8),  F.lit("winter"))
             .otherwise(F.lit("spring")),
        )
        .withColumn("settlement_date", F.to_date("settlementdate"))
    )


def join_public_holidays(df: DataFrame, spark: SparkSession) -> DataFrame:
    """
    Left-join bronze.public_holidays_au to add is_public_holiday (0/1).

    NEM region id encodes the state abbreviation before the trailing digit,
    e.g. NSW1 -> NSW, SA1 -> SA, TAS1 -> TAS.
    """
    holidays = spark.table(f"{BRONZE}.public_holidays_au").select(
        F.col("date").alias("holiday_date"),
        F.col("region_code"),
    )

    df = df.withColumn(
        "state_code",
        F.regexp_extract(F.col("regionid"), r"^([A-Z]+)", 1),
    )

    df = (
        df.join(
            holidays,
            (F.col("settlement_date") == F.col("holiday_date"))
            & (F.col("state_code") == F.col("region_code")),
            how="left",
        )
        .withColumn(
            "is_public_holiday",
            F.when(F.col("holiday_date").isNotNull(), 1).otherwise(0),
        )
        .drop("holiday_date", "region_code", "state_code")
    )
    return df


# ---------------------------------------------------------------------------
# Price and demand lag features
# ---------------------------------------------------------------------------

def add_price_lag_features(df: DataFrame) -> DataFrame:
    """
    Add lagged price (rrp) and demand (totaldemand) for each lag step
    defined in PRICE_LAG_STEPS (units: 5-min dispatch intervals).
    """
    w = Window.partitionBy("regionid").orderBy("settlementdate")
    for name, steps in PRICE_LAG_STEPS.items():
        df = (
            df
            .withColumn(f"price_{name}",  F.lag("rrp",         steps).over(w))
            .withColumn(f"demand_{name}", F.lag("totaldemand", steps).over(w))
        )
    return df


# ---------------------------------------------------------------------------
# Rolling window statistics
# ---------------------------------------------------------------------------

def add_rolling_stats(df: DataFrame) -> DataFrame:
    """
    Rolling mean, std, min, max over 1hr/4hr/24hr windows for price and demand.

    Uses a range-based window (on epoch seconds) so that irregular 5-min gaps
    do not silently collapse the effective window size.
    Current row is excluded from each window (upper bound = -1 second).
    """
    SECS = 300   # seconds per 5-min interval

    df = df.withColumn("_epoch_sec", F.col("settlementdate").cast("long"))

    for label, n_intervals in ROLLING_WINDOWS.items():
        w_sec = n_intervals * SECS
        w = (
            Window.partitionBy("regionid")
            .orderBy("_epoch_sec")
            .rangeBetween(-w_sec, -1)
        )
        for metric, col_name in [("price", "rrp"), ("demand", "totaldemand")]:
            df = (
                df
                .withColumn(f"{metric}_mean_{label}", F.mean(col_name).over(w))
                .withColumn(f"{metric}_std_{label}",  F.stddev_pop(col_name).over(w))
                .withColumn(f"{metric}_min_{label}",  F.min(col_name).over(w))
                .withColumn(f"{metric}_max_{label}",  F.max(col_name).over(w))
            )

    return df.drop("_epoch_sec")


# ---------------------------------------------------------------------------
# Generation by fuel type
# ---------------------------------------------------------------------------

def build_generation_by_fuel(spark: SparkSession) -> DataFrame:
    """
    Pivot silver.dispatch_generation on fuel_type to produce one row per
    (settlementdate, regionid) with columns gen_<fuel_type>_mw and t-1 lags.
    """
    gen_raw = spark.table(f"{SILVER}.dispatch_generation").select(
        "settlementdate",
        "regionid",
        F.lower(
            F.regexp_replace(F.col("fuel_type"), r"[\s\-/]", "_")
        ).alias("fuel_type"),
        F.col("scadavalue").alias("mw"),
    )

    gen_agg = (
        gen_raw
        .groupBy("settlementdate", "regionid", "fuel_type")
        .agg(F.sum("mw").alias("mw"))
    )

    gen_wide = (
        gen_agg
        .groupBy("settlementdate", "regionid")
        .pivot("fuel_type", FUEL_TYPES)
        .agg(F.first("mw"))
        .fillna(0.0, subset=FUEL_TYPES)
    )

    w = Window.partitionBy("regionid").orderBy("settlementdate")
    for ft in FUEL_TYPES:
        gen_wide = (
            gen_wide
            .withColumnRenamed(ft, f"gen_{ft}_mw")
            .withColumn(f"gen_{ft}_mw_lag1", F.lag(f"gen_{ft}_mw", 1).over(w))
        )

    return gen_wide


# ---------------------------------------------------------------------------
# Interconnector flow features
# ---------------------------------------------------------------------------

def build_interconnector_features(spark: SparkSession) -> DataFrame:
    """
    Aggregate interconnector flows to per-region net_import_mw and
    ic_utilisation, plus t-1 lags.

    Positive net_import_mw means the region is a net importer in that interval.
    """
    ic_raw = spark.table(f"{SILVER}.interconnector_flows").select(
        "settlementdate", "interconnectorid",
        "mwflow", "importlimit", "exportlimit",
    )

    # Static endpoint map: (interconnector_id, import_region, export_region)
    ic_map_rows = [
        ("NSW1-QLD1",  "QLD1", "NSW1"),
        ("N-Q-MNSP1",  "QLD1", "NSW1"),
        ("VIC1-NSW1",  "NSW1", "VIC1"),
        ("V-SA",       "SA1",  "VIC1"),
        ("V-SA-MNSP1", "SA1",  "VIC1"),
        ("T-V-MNSP1",  "VIC1", "TAS1"),
    ]
    ic_schema = T.StructType([
        T.StructField("interconnectorid", T.StringType(), False),
        T.StructField("import_region",    T.StringType(), False),
        T.StructField("export_region",    T.StringType(), False),
    ])
    ic_map = spark.createDataFrame(ic_map_rows, schema=ic_schema)
    ic = ic_raw.join(ic_map, on="interconnectorid", how="inner")

    ic = ic.withColumn(
        "utilisation",
        F.abs("mwflow") / (
            F.greatest(F.abs("importlimit"), F.abs("exportlimit")) + F.lit(1e-3)
        ),
    )

    import_side = (
        ic.groupBy("settlementdate", "import_region")
        .agg(
            F.sum("mwflow").alias("net_import_mw"),
            F.mean("utilisation").alias("ic_utilisation"),
        )
        .withColumnRenamed("import_region", "regionid")
    )

    export_side = (
        ic.groupBy("settlementdate", "export_region")
        .agg(
            (-F.sum("mwflow")).alias("net_import_mw"),
            F.mean("utilisation").alias("ic_utilisation"),
        )
        .withColumnRenamed("export_region", "regionid")
    )

    ic_regional = (
        import_side.union(export_side)
        .groupBy("settlementdate", "regionid")
        .agg(
            F.sum("net_import_mw").alias("net_import_mw"),
            F.mean("ic_utilisation").alias("ic_utilisation"),
        )
    )

    w = Window.partitionBy("regionid").orderBy("settlementdate")
    return (
        ic_regional
        .withColumn("net_import_mw_lag1",  F.lag("net_import_mw",  1).over(w))
        .withColumn("ic_utilisation_lag1", F.lag("ic_utilisation", 1).over(w))
    )


# ---------------------------------------------------------------------------
# Weather features
# ---------------------------------------------------------------------------

def build_weather_features(spark: SparkSession) -> DataFrame:
    """
    Load silver.weather_regional (hourly) and forward-fill to 5-min
    resolution for alignment with dispatch prices.

    Columns:
      current observation : temperature_2m, windspeed_100m, shortwave_radiation
      +1hr NWP forecast   : *_1h variants
      +4hr NWP forecast   : *_4h variants
      +24hr NWP forecast  : *_24h variants
    """
    weather_cols = [
        "temperature_2m",     "windspeed_100m",     "shortwave_radiation",
        "temperature_2m_1h",  "windspeed_100m_1h",  "shortwave_radiation_1h",
        "temperature_2m_4h",  "windspeed_100m_4h",  "shortwave_radiation_4h",
        "temperature_2m_24h", "windspeed_100m_24h", "shortwave_radiation_24h",
    ]
    weather = spark.table(f"{SILVER}.weather_regional").select(
        F.col("timestamp").alias("settlementdate"),
        "regionid",
        *weather_cols,
    )
    w = (
        Window.partitionBy("regionid")
        .orderBy("settlementdate")
        .rowsBetween(Window.unboundedPreceding, 0)
    )
    for col in weather_cols:
        weather = weather.withColumn(col, F.last(col, ignorenulls=True).over(w))

    return weather


# ---------------------------------------------------------------------------
# Cross-regional / NEM-wide features
# ---------------------------------------------------------------------------

def add_cross_regional_features(df: DataFrame) -> DataFrame:
    """
    Compute NEM-wide aggregates per dispatch interval and join back:
      - nem_total_demand_mw      : sum of all regional totaldemand
      - nem_capacity_utilisation : nem_total_demand_mw / NEM_CAPACITY_MW
      - price_spread_to_national : region rrp minus demand-weighted NEM avg price
    """
    nem_totals = (
        df.groupBy("settlementdate")
        .agg(
            F.sum(F.col("rrp") * F.col("totaldemand")).alias("_wt_price"),
            F.sum("totaldemand").alias("nem_total_demand_mw"),
        )
        .withColumn(
            "_nem_avg_price",
            F.col("_wt_price") / (F.col("nem_total_demand_mw") + F.lit(1e-3)),
        )
        .withColumn(
            "nem_capacity_utilisation",
            F.col("nem_total_demand_mw") / F.lit(NEM_CAPACITY_MW),
        )
        .drop("_wt_price")
    )

    df = df.join(nem_totals, on="settlementdate", how="left")
    df = (
        df
        .withColumn(
            "price_spread_to_national",
            F.col("rrp") - F.col("_nem_avg_price"),
        )
        .drop("_nem_avg_price")
    )
    return df


# ---------------------------------------------------------------------------
# Horizon explosion
# ---------------------------------------------------------------------------

def explode_horizons(df: DataFrame) -> DataFrame:
    """
    Cross-join with FORECAST_HORIZONS to produce one row per
    (settlementdate, regionid, forecast_horizon).

    Adds:
      forecast_horizon (int)   -- horizon index (1, 4, 8, 12, 24, 48)
      rrp_target (double)      -- actual price at settlementdate + horizon*5min
                                  (supervised learning label)
    """
    spark = df.sparkSession

    horizons_df = spark.createDataFrame(
        [(h,) for h in FORECAST_HORIZONS],
        schema=T.StructType([
            T.StructField("forecast_horizon", T.IntegerType(), False),
        ]),
    )

    df_x = df.crossJoin(horizons_df)

    # Compute the target timestamp (settlementdate + horizon * 300 seconds)
    df_x = df_x.withColumn(
        "_target_ts",
        (
            F.col("settlementdate").cast("long")
            + F.col("forecast_horizon") * F.lit(300)
        ).cast("timestamp"),
    )

    # Look up the future price as the supervised label
    future = df.select(
        F.col("settlementdate").alias("_future_ts"),
        F.col("regionid").alias("_future_region"),
        F.col("rrp").alias("rrp_target"),
    )

    df_x = (
        df_x
        .join(
            future,
            (F.col("_target_ts") == F.col("_future_ts"))
            & (F.col("regionid") == F.col("_future_region")),
            how="left",
        )
        .drop("_target_ts", "_future_ts", "_future_region")
    )

    return df_x


# ---------------------------------------------------------------------------
# Main pipeline orchestration
# ---------------------------------------------------------------------------

def build_feature_store(spark: SparkSession) -> None:
    """
    Run the full feature engineering pipeline and write the result to
    energy_copilot.gold.feature_store_price (Delta Lake, partitioned by
    regionid and settlement_date).
    """
    logger.info("Loading silver.dispatch_prices ...")
    prices = spark.table(f"{SILVER}.dispatch_prices").select(
        "settlementdate", "regionid", "rrp", "totaldemand"
    )

    logger.info("Adding temporal features ...")
    prices = add_temporal_features(prices)
    prices = join_public_holidays(prices, spark)

    logger.info("Adding price/demand lag features ...")
    prices = add_price_lag_features(prices)

    logger.info("Adding rolling window statistics ...")
    prices = add_rolling_stats(prices)

    logger.info("Adding cross-regional / NEM-wide features ...")
    prices = add_cross_regional_features(prices)

    logger.info("Building generation-by-fuel-type features ...")
    gen_feats = build_generation_by_fuel(spark)
    prices = prices.join(gen_feats, on=["settlementdate", "regionid"], how="left")

    logger.info("Building interconnector flow features ...")
    ic_feats = build_interconnector_features(spark)
    prices = prices.join(ic_feats, on=["settlementdate", "regionid"], how="left")

    logger.info("Building weather features ...")
    wx_feats = build_weather_features(spark)
    prices = prices.join(wx_feats, on=["settlementdate", "regionid"], how="left")

    logger.info("Exploding forecast horizons ...")
    features = explode_horizons(prices)

    # Drop rows where the future target is unavailable (end of data range)
    features = features.filter(F.col("rrp_target").isNotNull())

    features = features.withColumn("feature_timestamp", F.current_timestamp())

    logger.info("Writing feature store to %s ...", TARGET_TABLE)
    (
        features
        .repartition("regionid", "settlement_date")
        .write
        .format("delta")
        .mode("overwrite")
        .option("overwriteSchema", "true")
        .partitionBy("regionid", "settlement_date")
        .saveAsTable(TARGET_TABLE)
    )

    row_count = spark.table(TARGET_TABLE).count()
    logger.info("Feature store written: %d rows in %s", row_count, TARGET_TABLE)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    spark = SparkSession.builder.getOrCreate()
    spark.conf.set("spark.sql.shuffle.partitions", "400")
    spark.conf.set("spark.databricks.delta.optimizeWrite.enabled", "true")
    spark.conf.set("spark.databricks.delta.autoCompact.enabled", "true")
    build_feature_store(spark)
