# Databricks notebook source
# MAGIC %md
# MAGIC # Pipeline 06 — Daily AI Market Summary
# MAGIC Schedule: Daily 05:30 AEST. LLM: Claude Sonnet 4.5 (claude-sonnet-4-5).
# MAGIC Gathers prior-day Gold stats, calls Claude, writes to gold.daily_market_summary.

import json, logging, os
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional
import anthropic
from pyspark.sql import functions as F

CATALOG = "energy_copilot"
SUMMARY_TABLE = f"{CATALOG}.gold.daily_market_summary"
CLAUDE_MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 2048

logging.basicConfig(level=logging.INFO, format='{"ts":"%(asctime)s","msg":"%(message)s"}')
logger = logging.getLogger("market_summary")


def _anthropic_key() -> str:
    try: return dbutils.secrets.get(scope="energy_copilot", key="anthropic_api_key")  # noqa: F821
    except Exception: return os.environ.get("ANTHROPIC_API_KEY", "")


def get_prior_day_stats(target_date: date) -> Dict[str, Any]:
    stats: Dict[str, Any] = {"date": str(target_date), "regions": {}}
    date_str = str(target_date)

    try:
        pdf = (spark.table(f"{CATALOG}.gold.nem_prices_5min")  # noqa: F821
               .filter(F.col("interval_date") == date_str)
               .groupBy("region_id")
               .agg(F.avg("spot_price_aud_mwh").alias("avg_price"),
                    F.max("spot_price_aud_mwh").alias("max_price"),
                    F.min("spot_price_aud_mwh").alias("min_price"),
                    F.avg("total_demand_mw").alias("avg_demand_mw"),
                    F.max("total_demand_mw").alias("peak_demand_mw"),
                    F.sum(F.when(F.col("spot_price_aud_mwh") > 300, 1).otherwise(0)).alias("high_price_intervals"),
                    F.sum(F.when(F.col("spot_price_aud_mwh") > 5000, 1).otherwise(0)).alias("extreme_price_intervals"),
                    F.count("*").alias("total_intervals"))
               .toPandas())
        for _, row in pdf.iterrows():
            stats["regions"][row["region_id"]] = {
                "avg_price": round(float(row["avg_price"] or 0), 2),
                "max_price": round(float(row["max_price"] or 0), 2),
                "avg_demand_mw": round(float(row["avg_demand_mw"] or 0), 1),
                "peak_demand_mw": round(float(row["peak_demand_mw"] or 0), 1),
                "high_price_intervals": int(row["high_price_intervals"] or 0),
                "extreme_price_intervals": int(row["extreme_price_intervals"] or 0),
            }
    except Exception as exc: logger.warning(f"Price stats unavailable: {exc}")

    try:
        gen_pdf = (spark.table(f"{CATALOG}.gold.nem_generation_by_fuel")  # noqa: F821
                   .filter(F.col("interval_date") == date_str)
                   .groupBy("fuel_type").agg(F.avg("total_mw").alias("avg_mw")).toPandas())
        total_mw = gen_pdf["avg_mw"].sum()
        stats["fuel_mix"] = {str(r["fuel_type"]): {
            "avg_mw": round(float(r["avg_mw"]), 1),
            "share_pct": round(float(r["avg_mw"])/total_mw*100, 1) if total_mw > 0 else 0}
            for _, r in gen_pdf.iterrows() if r["fuel_type"]}
    except Exception as exc: logger.warning(f"Fuel mix unavailable: {exc}")

    return stats


def generate_summary(stats: Dict[str, Any]) -> str:
    key = _anthropic_key()
    if not key: return "ERROR: Anthropic API key not configured."
    client = anthropic.Anthropic(api_key=key)
    system = (
        "You are an expert Australian NEM analyst producing the daily market summary. "
        "Audience: energy traders and grid operators. "
        "Cover all 5 regions. Max 600 words. "
        "Structure: Market Overview, Price Summary, Generation Mix, Interconnector Flows, "
        "Demand, Notable Events, Outlook. "
        "Never provide trading advice. Caveat inferences with 'data suggests'."
    )
    user = (f"Write the daily NEM market summary for {stats['date']}.\n\n"
            f"Data:\n```json\n{json.dumps(stats, indent=2, default=str)}\n```")
    try:
        msg = client.messages.create(model=CLAUDE_MODEL, max_tokens=MAX_TOKENS,
                                     system=system, messages=[{"role":"user","content":user}])
        return msg.content[0].text if msg.content else ""
    except Exception as exc: return f"ERROR: {exc}"


def write_summary(target_date: date, narrative: str, stats: Dict[str, Any]) -> None:
    from pyspark.sql import Row
    row = Row(summary_date=target_date, narrative=narrative,
              stats_json=json.dumps(stats, default=str), model_id=CLAUDE_MODEL,
              generated_at=datetime.now(timezone.utc), word_count=len(narrative.split()),
              generation_succeeded=not narrative.startswith("ERROR:"))
    spark.createDataFrame([row]).write.format("delta").mode("append").saveAsTable(SUMMARY_TABLE)  # noqa: F821
    logger.info(f"Summary written for {target_date}")


def run_market_summary_pipeline(target_date: Optional[date] = None) -> None:
    if target_date is None:
        target_date = (datetime.now(timezone.utc) - timedelta(hours=10)).date() - timedelta(days=1)
    logger.info(f"Generating market summary for {target_date}")
    stats = get_prior_day_stats(target_date)
    narrative = generate_summary(stats)
    write_summary(target_date, narrative, stats)
    logger.info(f"Complete for {target_date}")


# COMMAND ----------
try:
    run_market_summary_pipeline()
except NameError:
    logger.warning("No Spark session — not executed (unit test mode)")
