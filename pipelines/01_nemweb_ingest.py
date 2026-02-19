# Databricks notebook source
# MAGIC %md
# MAGIC # Pipeline 01 — NEMWEB Ingest (Bronze -> Silver -> Gold)
# MAGIC DLT/SDP streaming pipeline. Autoloader reads CSVs from Volume.

import dlt
from functools import reduce
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, StringType, TimestampType

VOLUME_BASE = "/Volumes/energy_copilot/bronze/nemweb_raw"
NEM_REGIONS = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]


def _autoloader(report_type: str):
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "csv")
        .option("cloudFiles.schemaLocation", f"/Volumes/energy_copilot/bronze/_schema_ckpt/{report_type}")
        .option("cloudFiles.inferColumnTypes", "true")
        .option("cloudFiles.schemaEvolutionMode", "addNewColumns")
        .option("header", "true")
        .load(f"{VOLUME_BASE}/{report_type}/")
        .withColumn("_source_file", F.input_file_name())
        .withColumn("_report_type", F.lit(report_type))
        .withColumn("_ingested_at", F.current_timestamp())
        .filter(F.col("_c0") == "D")
        .withColumn("_ingest_date", F.to_date("_ingested_at"))
    )


# === BRONZE ===

@dlt.table(name="nemweb_dispatch_gen", comment="Bronze: Dispatch_SCADA generator MW 5min",
           table_properties={"quality": "bronze"}, partition_cols=["_ingest_date"])
def bronze_dispatch_gen(): return _autoloader("Dispatch_SCADA")

@dlt.table(name="nemweb_dispatch_is", comment="Bronze: DispatchIS regional prices, FCAS 5min",
           table_properties={"quality": "bronze"}, partition_cols=["_ingest_date"])
def bronze_dispatch_is(): return _autoloader("DispatchIS_Reports")

@dlt.table(name="nemweb_dispatch_price", comment="Bronze: DISPATCHPRICE 5min spot prices",
           table_properties={"quality": "bronze"}, partition_cols=["_ingest_date"])
def bronze_dispatch_price(): return _autoloader("Dispatch_Reports_Price")

@dlt.table(name="nemweb_dispatch_inter", comment="Bronze: interconnector flows and limits",
           table_properties={"quality": "bronze"}, partition_cols=["_ingest_date"])
def bronze_dispatch_inter(): return _autoloader("Dispatch_Reports_Interconnector")

@dlt.table(name="nemweb_trading_is", comment="Bronze: TradingIS 30min trading prices",
           table_properties={"quality": "bronze"}, partition_cols=["_ingest_date"])
def bronze_trading_is(): return _autoloader("TradingIS_Reports")

@dlt.table(name="nemweb_predispatch", comment="Bronze: pre-dispatch price forecasts 30min",
           table_properties={"quality": "bronze"}, partition_cols=["_ingest_date"])
def bronze_predispatch(): return _autoloader("Predispatch_Reports")

@dlt.table(name="nemweb_bids", comment="Bronze: generator bid stacks daily",
           table_properties={"quality": "bronze"}, partition_cols=["_ingest_date"])
def bronze_bids(): return _autoloader("Next_Day_Dispatch")


# === SILVER ===

@dlt.table(name="dispatch_gen", comment="Silver: generator MW output per DUID, 5min, deduped",
           table_properties={"quality": "silver", "delta.enableChangeDataFeed": "true"},
           partition_cols=["interval_date"])
@dlt.expect_or_drop("valid_settlement_date", "SETTLEMENTDATE IS NOT NULL")
@dlt.expect_or_drop("valid_duid", "DUID IS NOT NULL AND DUID != ''")
@dlt.expect("scada_mw_in_range", "SCADAVALUE BETWEEN -9999 AND 99999")
def silver_dispatch_gen():
    return (
        dlt.read_stream("nemweb_dispatch_gen")
        .select(
            F.col("SETTLEMENTDATE").cast(TimestampType()).alias("SETTLEMENTDATE"),
            F.col("DUID").cast(StringType()),
            F.col("SCADAVALUE").cast(DoubleType()),
            "_source_file", "_ingested_at",
        )
        .filter(F.col("SETTLEMENTDATE").isNotNull())
        .dropDuplicates(["SETTLEMENTDATE", "DUID"])
        .withColumn("interval_date", F.to_date("SETTLEMENTDATE"))
        .withColumn("interval_datetime", F.col("SETTLEMENTDATE"))
    )


@dlt.table(name="dispatch_price", comment="Silver: 5min regional spot + FCAS prices, deduped",
           table_properties={"quality": "silver", "delta.enableChangeDataFeed": "true"},
           partition_cols=["interval_date"])
@dlt.expect_or_drop("valid_settlement_date", "SETTLEMENTDATE IS NOT NULL")
@dlt.expect_or_drop("valid_region", "REGIONID IN ('NSW1','QLD1','VIC1','SA1','TAS1')")
@dlt.expect_or_drop("non_null_price", "RRP IS NOT NULL")
@dlt.expect("price_within_market_limits", "RRP BETWEEN -1000 AND 17000")
def silver_dispatch_price():
    return (
        dlt.read_stream("nemweb_dispatch_price")
        .select(
            F.col("SETTLEMENTDATE").cast(TimestampType()).alias("SETTLEMENTDATE"),
            F.col("REGIONID").cast(StringType()),
            F.col("RRP").cast(DoubleType()),
            F.col("RAISE6SECRRP").cast(DoubleType()),
            F.col("RAISE60SECRRP").cast(DoubleType()),
            F.col("RAISE5MINRRP").cast(DoubleType()),
            F.col("RAISEREGRRP").cast(DoubleType()),
            F.col("LOWER6SECRRP").cast(DoubleType()),
            F.col("LOWER60SECRRP").cast(DoubleType()),
            F.col("LOWER5MINRRP").cast(DoubleType()),
            F.col("LOWERREGRRP").cast(DoubleType()),
            F.col("TOTALDEMAND").cast(DoubleType()),
            F.col("DISPATCHABLELOAD").cast(DoubleType()),
            "_source_file", "_ingested_at",
        )
        .filter(F.col("SETTLEMENTDATE").isNotNull())
        .dropDuplicates(["SETTLEMENTDATE", "REGIONID"])
        .withColumn("interval_date", F.to_date("SETTLEMENTDATE"))
        .withColumn("interval_datetime", F.col("SETTLEMENTDATE"))
    )


@dlt.table(name="dispatch_interconnector", comment="Silver: interconnector flows, limits, utilisation 5min",
           table_properties={"quality": "silver"}, partition_cols=["interval_date"])
@dlt.expect_or_drop("valid_settlement_date", "SETTLEMENTDATE IS NOT NULL")
@dlt.expect_or_drop("valid_interconnector", "INTERCONNECTORID IS NOT NULL")
def silver_dispatch_interconnector():
    return (
        dlt.read_stream("nemweb_dispatch_inter")
        .select(
            F.col("SETTLEMENTDATE").cast(TimestampType()).alias("SETTLEMENTDATE"),
            F.col("INTERCONNECTORID").cast(StringType()),
            F.col("METEREDMWFLOW").cast(DoubleType()),
            F.col("MWFLOW").cast(DoubleType()),
            F.col("MWLOSSES").cast(DoubleType()),
            F.col("EXPORTLIMIT").cast(DoubleType()),
            F.col("IMPORTLIMIT").cast(DoubleType()),
            "_source_file", "_ingested_at",
        )
        .filter(F.col("SETTLEMENTDATE").isNotNull())
        .dropDuplicates(["SETTLEMENTDATE", "INTERCONNECTORID"])
        .withColumn("interval_date", F.to_date("SETTLEMENTDATE"))
        .withColumn("interval_datetime", F.col("SETTLEMENTDATE"))
        .withColumn(
            "utilisation_ratio",
            F.when(F.col("EXPORTLIMIT") > 0, F.abs(F.col("MWFLOW")) / F.col("EXPORTLIMIT"))
             .when(F.col("IMPORTLIMIT") > 0, F.abs(F.col("MWFLOW")) / F.col("IMPORTLIMIT"))
             .otherwise(F.lit(None).cast(DoubleType())),
        )
    )


# === GOLD ===

@dlt.table(name="nem_prices_5min", comment="Gold: 5min NEM spot prices ($/MWh), primary time-series",
           table_properties={"quality": "gold"}, partition_cols=["interval_date"])
@dlt.expect_or_drop("valid_interval", "interval_datetime IS NOT NULL")
@dlt.expect_or_drop("valid_region", "region_id IN ('NSW1','QLD1','VIC1','SA1','TAS1')")
def gold_nem_prices_5min():
    return dlt.read("dispatch_price").select(
        F.col("interval_datetime"), F.col("interval_date"),
        F.col("REGIONID").alias("region_id"),
        F.col("RRP").alias("spot_price_aud_mwh"),
        F.col("TOTALDEMAND").alias("total_demand_mw"),
        F.col("DISPATCHABLELOAD").alias("dispatchable_load_mw"),
    )


@dlt.table(name="nem_prices_30min", comment="Gold: 30min avg NEM spot prices from 5min dispatch",
           table_properties={"quality": "gold"}, partition_cols=["interval_date"])
def gold_nem_prices_30min():
    return (
        dlt.read("dispatch_price")
        .withColumn("trading_interval", F.date_trunc("30 minute", F.col("SETTLEMENTDATE")))
        .groupBy("trading_interval", "REGIONID")
        .agg(
            F.avg("RRP").alias("avg_spot_price_aud_mwh"),
            F.max("RRP").alias("max_spot_price_aud_mwh"),
            F.min("RRP").alias("min_spot_price_aud_mwh"),
            F.avg("TOTALDEMAND").alias("avg_demand_mw"),
            F.count("*").alias("interval_count"),
        )
        .withColumnRenamed("REGIONID", "region_id")
        .withColumnRenamed("trading_interval", "interval_datetime")
        .withColumn("interval_date", F.to_date("interval_datetime"))
    )


@dlt.table(name="nem_generation_by_fuel", comment="Gold: generation MW by fuel type and region 5min",
           table_properties={"quality": "gold"}, partition_cols=["interval_date"])
def gold_generation_by_fuel():
    gen = dlt.read("dispatch_gen").select("interval_datetime", "interval_date", "DUID", "SCADAVALUE")
    try:
        registry = spark.table("energy_copilot.silver.generator_registry").select("DUID", "fuel_type", "region_id", "max_capacity_mw")
        return (
            gen.join(registry, on="DUID", how="left")
            .groupBy("interval_datetime", "interval_date", "region_id", "fuel_type")
            .agg(F.sum("SCADAVALUE").alias("total_mw"), F.count("DUID").alias("unit_count"))
        )
    except Exception:
        return (
            gen.groupBy("interval_datetime", "interval_date", "DUID")
            .agg(F.sum("SCADAVALUE").alias("total_mw"))
            .withColumn("region_id", F.lit(None).cast(StringType()))
            .withColumn("fuel_type", F.lit("UNKNOWN"))
            .withColumn("unit_count", F.lit(1))
        )


@dlt.table(name="nem_interconnectors", comment="Gold: interconnector flows, limits, utilisation 5min",
           table_properties={"quality": "gold"}, partition_cols=["interval_date"])
def gold_nem_interconnectors():
    return dlt.read("dispatch_interconnector").select(
        "interval_datetime", "interval_date",
        F.col("INTERCONNECTORID").alias("interconnector_id"),
        F.col("METEREDMWFLOW").alias("metered_flow_mw"),
        F.col("MWFLOW").alias("scheduled_flow_mw"),
        F.col("MWLOSSES").alias("losses_mw"),
        F.col("EXPORTLIMIT").alias("export_limit_mw"),
        F.col("IMPORTLIMIT").alias("import_limit_mw"),
        "utilisation_ratio",
    )


@dlt.table(name="nem_fcas_prices", comment="Gold: 8 FCAS service prices per region per 5min (long format)",
           table_properties={"quality": "gold"}, partition_cols=["interval_date"])
@dlt.expect_or_drop("valid_region", "region_id IN ('NSW1','QLD1','VIC1','SA1','TAS1')")
def gold_nem_fcas_prices():
    fcas_map = {
        "RAISE6SECRRP": "RAISE6SEC", "RAISE60SECRRP": "RAISE60SEC",
        "RAISE5MINRRP": "RAISE5MIN", "RAISEREGRRP": "RAISEREG",
        "LOWER6SECRRP": "LOWER6SEC", "LOWER60SECRRP": "LOWER60SEC",
        "LOWER5MINRRP": "LOWER5MIN", "LOWERREGRRP": "LOWERREG",
    }
    src = dlt.read("dispatch_price").select("SETTLEMENTDATE", "REGIONID", *fcas_map.keys())
    frames = [
        src.select(
            F.col("SETTLEMENTDATE").alias("interval_datetime"),
            F.col("REGIONID").alias("region_id"),
            F.lit(service).alias("fcas_service"),
            F.col(col).alias("price_aud_mwh"),
        )
        for col, service in fcas_map.items()
    ]
    return reduce(lambda a, b: a.union(b), frames).withColumn("interval_date", F.to_date("interval_datetime"))
