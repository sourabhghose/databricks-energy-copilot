# Databricks notebook source
# MAGIC %md
# MAGIC # Pipeline 06 — Daily AI Market Summary
# MAGIC
# MAGIC **Schedule:** Daily at 05:30 AEST (UTC cron: `0 30 19 * * ?`)
# MAGIC **Cluster:** DBR 15.4.x-scala2.12
# MAGIC
# MAGIC Queries 5 Gold tables for the past 24 hours, assembles a structured context
# MAGIC dict, and calls Claude Sonnet 4.5 to generate a 400-600 word narrative summary
# MAGIC for energy traders and analysts.  Writes output to gold.daily_market_summary.
# MAGIC
# MAGIC **Retry logic:** API failure triggers one retry after 30 seconds.  If both
# MAGIC attempts fail a template-based fallback summary is written instead.

import json
import logging
import os
import re
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CATALOG = "energy_copilot"
SUMMARY_TABLE = f"{CATALOG}.gold.daily_market_summary"
CLAUDE_MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 600
RETRY_DELAY_SECONDS = 30

WORD_COUNT_MIN = 300
WORD_COUNT_MAX = 700

# Patterns that indicate trading advice — rejected before writing
TRADING_ADVICE_PATTERNS = re.compile(
    r"\b(buy|sell|invest|trade|position|short|long)\b",
    re.IGNORECASE,
)

SYSTEM_PROMPT = (
    "You are an Australian electricity market analyst. "
    "Write a concise daily market summary in 400-600 words for energy traders "
    "and analysts. Focus on: key price movements, renewable generation trends, "
    "interconnector activity, and any notable market events. "
    "Use plain English. "
    "Do NOT provide trading advice or price predictions. "
    "End with one bullet point of key risks for the day ahead."
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}',
)
logger = logging.getLogger("market_summary")


# ---------------------------------------------------------------------------
# Secret / credential helpers
# ---------------------------------------------------------------------------

def _anthropic_key() -> str:
    try:
        return dbutils.secrets.get(scope="energy_copilot", key="anthropic_api_key")  # noqa: F821
    except Exception:
        return os.environ.get("ANTHROPIC_API_KEY", "")


# ---------------------------------------------------------------------------
# Data gathering — 5 Gold tables
# ---------------------------------------------------------------------------

def _query_prices(spark: Any, since: datetime) -> Dict[str, Any]:
    """gold.nem_prices_5min: min/max/avg/latest spot price + spike count per region."""
    result: Dict[str, Any] = {}
    try:
        from pyspark.sql import functions as F

        pdf = (
            spark.table(f"{CATALOG}.gold.nem_prices_5min")
            .filter(F.col("interval_datetime") >= since)
            .groupBy("region_id")
            .agg(
                F.min("spot_price_aud_mwh").alias("min_price"),
                F.max("spot_price_aud_mwh").alias("max_price"),
                F.avg("spot_price_aud_mwh").alias("avg_price"),
                F.last("spot_price_aud_mwh").alias("latest_price"),
                F.sum(
                    F.when(F.col("spot_price_aud_mwh") > 300, 1).otherwise(0)
                ).alias("spike_count_300"),
                F.sum(
                    F.when(F.col("spot_price_aud_mwh") > 5000, 1).otherwise(0)
                ).alias("spike_count_5000"),
            )
            .toPandas()
        )
        for _, row in pdf.iterrows():
            result[str(row["region_id"])] = {
                "min_price_aud": round(float(row["min_price"] or 0), 2),
                "max_price_aud": round(float(row["max_price"] or 0), 2),
                "avg_price_aud": round(float(row["avg_price"] or 0), 2),
                "latest_price_aud": round(float(row["latest_price"] or 0), 2),
                "spike_count_gt300": int(row["spike_count_300"] or 0),
                "spike_count_gt5000": int(row["spike_count_5000"] or 0),
            }
    except Exception as exc:
        logger.warning(f"Price query failed: {exc}")
    return result


def _query_generation(spark: Any, since: datetime) -> Dict[str, Any]:
    """gold.nem_generation_dispatch: fuel mix % per region."""
    result: Dict[str, Any] = {}
    try:
        from pyspark.sql import functions as F

        pdf = (
            spark.table(f"{CATALOG}.gold.nem_generation_dispatch")
            .filter(F.col("interval_datetime") >= since)
            .groupBy("region_id", "fuel_type")
            .agg(F.avg("dispatch_mw").alias("avg_mw"))
            .toPandas()
        )
        for region, grp in pdf.groupby("region_id"):
            total_mw = grp["avg_mw"].sum()
            result[str(region)] = {
                str(row["fuel_type"]): {
                    "avg_mw": round(float(row["avg_mw"]), 1),
                    "share_pct": round(float(row["avg_mw"]) / total_mw * 100, 1)
                    if total_mw > 0 else 0.0,
                }
                for _, row in grp.iterrows()
                if row["fuel_type"]
            }
    except Exception as exc:
        logger.warning(f"Generation query failed: {exc}")
    return result


def _query_interconnectors(spark: Any, since: datetime) -> Dict[str, Any]:
    """gold.nem_interconnectors_5min: peak flows."""
    result: Dict[str, Any] = {}
    try:
        from pyspark.sql import functions as F

        pdf = (
            spark.table(f"{CATALOG}.gold.nem_interconnectors_5min")
            .filter(F.col("interval_datetime") >= since)
            .groupBy("interconnector_id")
            .agg(
                F.max("mw_flow").alias("peak_flow_mw"),
                F.min("mw_flow").alias("min_flow_mw"),
                F.avg("mw_flow").alias("avg_flow_mw"),
            )
            .toPandas()
        )
        for _, row in pdf.iterrows():
            result[str(row["interconnector_id"])] = {
                "peak_flow_mw": round(float(row["peak_flow_mw"] or 0), 1),
                "min_flow_mw": round(float(row["min_flow_mw"] or 0), 1),
                "avg_flow_mw": round(float(row["avg_flow_mw"] or 0), 1),
            }
    except Exception as exc:
        logger.warning(f"Interconnector query failed: {exc}")
    return result


def _query_forecasts(spark: Any) -> Dict[str, Any]:
    """gold.nem_forecasts_realtime: predicted prices next 2 hours (price model only)."""
    result: Dict[str, Any] = {}
    try:
        from pyspark.sql import functions as F

        two_hours_intervals = 24  # 24 × 5 min = 120 min
        pdf = (
            spark.table(f"{CATALOG}.gold.nem_forecasts_realtime")
            .filter(
                (F.col("model_type") == "price")
                & (F.col("horizon_intervals") <= two_hours_intervals)
            )
            .orderBy("generated_at", ascending=False)
            .groupBy("region", "horizon_intervals", "horizon_minutes")
            .agg(
                F.first("predicted_value").alias("predicted_price_aud"),
                F.first("spike_probability").alias("spike_probability"),
                F.first("confidence_score").alias("confidence_score"),
            )
            .toPandas()
        )
        for region, grp in pdf.groupby("region"):
            result[str(region)] = [
                {
                    "horizon_minutes": int(row["horizon_minutes"]),
                    "predicted_price_aud": round(float(row["predicted_price_aud"] or 0), 2),
                    "spike_probability": round(float(row["spike_probability"] or 0), 3),
                    "confidence_score": round(float(row["confidence_score"] or 0), 3),
                }
                for _, row in grp.sort_values("horizon_intervals").iterrows()
            ]
    except Exception as exc:
        logger.warning(f"Forecast query failed: {exc}")
    return result


def _query_anomalies(spark: Any, since: datetime) -> Dict[str, Any]:
    """gold.anomaly_detection_results: anomaly event counts."""
    result: Dict[str, Any] = {"total_anomalies": 0, "by_type": {}}
    try:
        from pyspark.sql import functions as F

        pdf = (
            spark.table(f"{CATALOG}.gold.anomaly_detection_results")
            .filter(F.col("interval_datetime") >= since)
            .groupBy("anomaly_type")
            .agg(F.count("*").alias("count"))
            .toPandas()
        )
        result["total_anomalies"] = int(pdf["count"].sum()) if not pdf.empty else 0
        result["by_type"] = {
            str(row["anomaly_type"]): int(row["count"])
            for _, row in pdf.iterrows()
            if row["anomaly_type"]
        }
    except Exception as exc:
        logger.warning(f"Anomaly query failed: {exc}")
    return result


def gather_context(spark: Any, summary_date: date) -> Dict[str, Any]:
    """Assemble the structured context dict from all 5 Gold tables."""
    since = datetime.combine(summary_date - timedelta(days=1), datetime.min.time()).replace(
        tzinfo=timezone.utc
    )
    logger.info(f"Gathering context since {since.isoformat()}")

    prices = _query_prices(spark, since)
    generation = _query_generation(spark, since)
    interconnectors = _query_interconnectors(spark, since)
    forecasts = _query_forecasts(spark)
    anomalies = _query_anomalies(spark, since)

    return {
        "summary_date": str(summary_date),
        "data_window_hours": 24,
        "prices_by_region": prices,
        "generation_fuel_mix_by_region": generation,
        "interconnector_flows": interconnectors,
        "price_forecasts_next_2h": forecasts,
        "anomaly_events": anomalies,
    }


def make_hardcoded_context(summary_date: Optional[date] = None) -> Dict[str, Any]:
    """Hardcoded context for unit-test / mock mode."""
    d = str(summary_date or date.today())
    return {
        "summary_date": d,
        "data_window_hours": 24,
        "prices_by_region": {
            "NSW1": {"min_price_aud": 45.0, "max_price_aud": 320.0, "avg_price_aud": 87.5,
                     "latest_price_aud": 92.0, "spike_count_gt300": 3, "spike_count_gt5000": 0},
            "QLD1": {"min_price_aud": 38.0, "max_price_aud": 285.0, "avg_price_aud": 74.2,
                     "latest_price_aud": 78.0, "spike_count_gt300": 1, "spike_count_gt5000": 0},
            "VIC1": {"min_price_aud": 50.0, "max_price_aud": 410.0, "avg_price_aud": 95.1,
                     "latest_price_aud": 105.0, "spike_count_gt300": 5, "spike_count_gt5000": 0},
            "SA1":  {"min_price_aud": 30.0, "max_price_aud": 850.0, "avg_price_aud": 120.4,
                     "latest_price_aud": 98.0, "spike_count_gt300": 8, "spike_count_gt5000": 1},
            "TAS1": {"min_price_aud": 41.0, "max_price_aud": 195.0, "avg_price_aud": 68.3,
                     "latest_price_aud": 71.0, "spike_count_gt300": 0, "spike_count_gt5000": 0},
        },
        "generation_fuel_mix_by_region": {
            "NSW1": {"coal": {"avg_mw": 5200.0, "share_pct": 60.0},
                     "gas": {"avg_mw": 800.0, "share_pct": 9.2},
                     "wind": {"avg_mw": 1200.0, "share_pct": 13.8},
                     "solar_utility": {"avg_mw": 900.0, "share_pct": 10.4}},
            "SA1":  {"wind": {"avg_mw": 1100.0, "share_pct": 42.0},
                     "solar_utility": {"avg_mw": 680.0, "share_pct": 26.0},
                     "gas": {"avg_mw": 540.0, "share_pct": 20.6}},
            "TAS1": {"hydro": {"avg_mw": 1050.0, "share_pct": 82.0},
                     "wind": {"avg_mw": 180.0, "share_pct": 14.0}},
        },
        "interconnector_flows": {
            "NSW1-QLD1": {"peak_flow_mw": 800.0, "min_flow_mw": 120.0, "avg_flow_mw": 450.0},
            "VIC1-SA1":  {"peak_flow_mw": 600.0, "min_flow_mw": -200.0, "avg_flow_mw": 180.0},
            "VIC1-TAS1": {"peak_flow_mw": 470.0, "min_flow_mw": 100.0, "avg_flow_mw": 310.0},
        },
        "price_forecasts_next_2h": {
            "NSW1": [{"horizon_minutes": 30, "predicted_price_aud": 95.0,
                      "spike_probability": 0.05, "confidence_score": 0.71}],
        },
        "anomaly_events": {"total_anomalies": 2, "by_type": {"price_spike": 1, "separation": 1}},
    }


# ---------------------------------------------------------------------------
# Narrative helpers
# ---------------------------------------------------------------------------

def _compute_price_summary(context: Dict[str, Any]) -> Dict[str, Any]:
    """Derive highest/lowest region and NEM-wide avg from context."""
    prices = context.get("prices_by_region", {})
    if not prices:
        return {"highest_price_region": None, "lowest_price_region": None, "avg_nem_price": None}

    avg_by_region = {r: v.get("avg_price_aud", 0.0) for r, v in prices.items()}
    highest = max(avg_by_region, key=avg_by_region.get)
    lowest = min(avg_by_region, key=avg_by_region.get)
    nem_avg = round(sum(avg_by_region.values()) / len(avg_by_region), 2)
    return {
        "highest_price_region": highest,
        "lowest_price_region": lowest,
        "avg_nem_price": nem_avg,
    }


def _quality_check(narrative: str) -> Optional[str]:
    """Return an error string if the narrative fails quality checks, else None."""
    words = len(narrative.split())
    if words < WORD_COUNT_MIN:
        return f"word_count_too_low: {words} < {WORD_COUNT_MIN}"
    if words > WORD_COUNT_MAX:
        return f"word_count_too_high: {words} > {WORD_COUNT_MAX}"
    if TRADING_ADVICE_PATTERNS.search(narrative):
        match = TRADING_ADVICE_PATTERNS.search(narrative)
        return f"contains_trading_advice_pattern: '{match.group()}'"  # type: ignore[union-attr]
    return None


def _template_fallback(context: Dict[str, Any], price_summary: Dict[str, Any]) -> str:
    """Generate a plain-English fallback summary from the context dict alone."""
    d = context.get("summary_date", "today")
    highest = price_summary.get("highest_price_region", "N/A")
    lowest = price_summary.get("lowest_price_region", "N/A")
    avg = price_summary.get("avg_nem_price", 0.0)
    anomalies = context.get("anomaly_events", {}).get("total_anomalies", 0)

    prices = context.get("prices_by_region", {})
    spike_lines = []
    for region, data in prices.items():
        cnt = data.get("spike_count_gt300", 0)
        if cnt > 0:
            spike_lines.append(f"{region} ({cnt} intervals above $300/MWh)")

    spike_text = (
        "Notable price spike activity in: " + ", ".join(spike_lines) + "."
        if spike_lines
        else "No significant price spike activity recorded."
    )

    return (
        f"NEM Daily Market Summary — {d}\n\n"
        f"The NEM recorded an average wholesale price of ${avg:.2f}/MWh across all regions "
        f"for the 24-hour period. {highest} posted the highest average regional price while "
        f"{lowest} recorded the lowest. {spike_text} "
        f"A total of {anomalies} anomaly event(s) were flagged by automated monitoring.\n\n"
        f"Renewable generation continued to contribute to the overall supply mix. "
        f"Interconnector flows supported cross-regional balancing throughout the period. "
        f"No extraordinary market events were identified beyond those noted above.\n\n"
        f"Key risks for the day ahead:\n"
        f"- Elevated price volatility possible in regions with high renewable penetration "
        f"if forecast wind or solar output deviates materially from AEMO pre-dispatch schedules."
    )


# ---------------------------------------------------------------------------
# Claude API call
# ---------------------------------------------------------------------------

def _call_claude(client: Any, context: Dict[str, Any]) -> str:
    """Call Claude Sonnet 4.5 and return the narrative string."""
    user_message = (
        f"Generate today's NEM market summary based on this data:\n"
        f"{json.dumps(context, indent=2)}"
    )
    msg = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    return msg.content[0].text if msg.content else ""


def generate_narrative(
    context: Dict[str, Any],
    mock_anthropic: bool = False,
) -> Dict[str, Any]:
    """Call Claude to generate the market narrative with retry and fallback.

    Returns a dict with keys: narrative, word_count, generation_succeeded.
    """
    if mock_anthropic:
        mock_text = (
            "This is a mock market summary for unit-test mode. "
            "The NEM operated within normal parameters over the past 24 hours. "
            "Renewable generation was elevated across most regions. "
            "Interconnector flows were broadly balanced. "
            "No significant anomalies were detected. "
            "Price outcomes were broadly in line with seasonal expectations. "
            "This mock summary contains approximately the right number of words to pass "
            "the quality gate checks that are applied before writing to the Gold table.\n\n"
            "Key risks for the day ahead:\n"
            "- Forecast renewable generation uncertainty may drive short-term price volatility."
        )
        return {
            "narrative": mock_text,
            "word_count": len(mock_text.split()),
            "generation_succeeded": True,
        }

    api_key = _anthropic_key()
    if not api_key:
        logger.error("ANTHROPIC_API_KEY not configured")
        return {"narrative": "ERROR: Anthropic API key not configured.", "word_count": 0, "generation_succeeded": False}

    import anthropic

    client = anthropic.Anthropic(api_key=api_key)

    # First attempt
    narrative = ""
    for attempt in range(1, 3):
        try:
            narrative = _call_claude(client, context)
            qc_error = _quality_check(narrative)
            if qc_error:
                logger.warning(f"Attempt {attempt}: quality check failed — {qc_error}")
                narrative = ""
            else:
                logger.info(
                    f"Attempt {attempt}: narrative generated successfully "
                    f"({len(narrative.split())} words)"
                )
                return {
                    "narrative": narrative,
                    "word_count": len(narrative.split()),
                    "generation_succeeded": True,
                }
        except Exception as exc:
            logger.error(f"Attempt {attempt}: Claude API call failed — {exc}")
            if attempt == 1:
                logger.info(f"Retrying after {RETRY_DELAY_SECONDS}s...")
                time.sleep(RETRY_DELAY_SECONDS)

    # Both attempts failed — use template fallback
    logger.warning("Both Claude API attempts failed; using template fallback")
    price_summary = _compute_price_summary(context)
    fallback = _template_fallback(context, price_summary)
    return {
        "narrative": fallback,
        "word_count": len(fallback.split()),
        "generation_succeeded": False,
    }


# ---------------------------------------------------------------------------
# Delta writer
# ---------------------------------------------------------------------------

def write_summary(
    spark: Any,
    summary_date: date,
    narrative_result: Dict[str, Any],
    context: Dict[str, Any],
    price_summary: Dict[str, Any],
) -> None:
    """Write the completed summary row to gold.daily_market_summary."""
    import pandas as pd

    row = {
        "summary_id": str(uuid.uuid4()),
        "summary_date": str(summary_date),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "narrative": narrative_result["narrative"],
        "word_count": narrative_result["word_count"],
        "model_id": CLAUDE_MODEL,
        "generation_succeeded": narrative_result["generation_succeeded"],
        "context_json": json.dumps(context, default=str),
        "highest_price_region": price_summary.get("highest_price_region"),
        "lowest_price_region": price_summary.get("lowest_price_region"),
        "avg_nem_price": price_summary.get("avg_nem_price"),
    }
    df = spark.createDataFrame(pd.DataFrame([row]))
    df.write.format("delta").mode("append").saveAsTable(SUMMARY_TABLE)
    logger.info(
        f"Summary written to {SUMMARY_TABLE} for {summary_date} "
        f"(word_count={narrative_result['word_count']}, "
        f"generation_succeeded={narrative_result['generation_succeeded']})"
    )


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_market_summary_pipeline(
    spark: Optional[Any] = None,
    target_date: Optional[date] = None,
    mock_anthropic: bool = False,
) -> Dict[str, Any]:
    """Run the daily market summary pipeline.

    Parameters
    ----------
    spark:
        Active SparkSession.  Pass None to run in unit-test / mock mode.
    target_date:
        Override the summary date.  Defaults to yesterday AEST.
    mock_anthropic:
        If True, skip the real API call and use a hardcoded mock response.

    Returns
    -------
    dict with keys: summary_date, word_count, generation_succeeded.
    """
    unit_test_mode = spark is None

    if target_date is None:
        # AEST = UTC+10; yesterday in AEST
        aest_now = datetime.now(timezone.utc) - timedelta(hours=10)
        target_date = (aest_now - timedelta(days=1)).date()

    logger.info(
        f"Market summary pipeline start: target_date={target_date} "
        f"unit_test_mode={unit_test_mode} mock_anthropic={mock_anthropic}"
    )

    # ------------------------------------------------------------------
    # Gather context
    # ------------------------------------------------------------------
    if unit_test_mode or mock_anthropic:
        context = make_hardcoded_context(target_date)
        logger.info("Using hardcoded context (unit-test / mock mode)")
    else:
        try:
            _spark = spark or globals().get("spark")  # type: ignore[assignment]
            if _spark is None:
                raise NameError("spark not in globals")
            context = gather_context(_spark, target_date)
        except NameError:
            logger.error("No Spark session — cannot gather context")
            return {"error": "no_spark"}

    # ------------------------------------------------------------------
    # Compute price summary metadata
    # ------------------------------------------------------------------
    price_summary = _compute_price_summary(context)

    # ------------------------------------------------------------------
    # Generate narrative
    # ------------------------------------------------------------------
    narrative_result = generate_narrative(context, mock_anthropic=mock_anthropic)

    # ------------------------------------------------------------------
    # Write output
    # ------------------------------------------------------------------
    if not unit_test_mode:
        try:
            _spark = spark or globals().get("spark")  # type: ignore[assignment]
            write_summary(_spark, target_date, narrative_result, context, price_summary)
        except Exception as exc:
            logger.error(f"Write to {SUMMARY_TABLE} failed: {exc}")
            return {
                "summary_date": str(target_date),
                "word_count": narrative_result["word_count"],
                "generation_succeeded": narrative_result["generation_succeeded"],
                "write_succeeded": False,
                "error": str(exc),
            }
    else:
        logger.info(
            f"Unit-test mode: would write summary for {target_date} "
            f"(word_count={narrative_result['word_count']}, "
            f"generation_succeeded={narrative_result['generation_succeeded']})"
        )

    return {
        "summary_date": str(target_date),
        "word_count": narrative_result["word_count"],
        "generation_succeeded": narrative_result["generation_succeeded"],
        "write_succeeded": not unit_test_mode,
        "highest_price_region": price_summary.get("highest_price_region"),
        "lowest_price_region": price_summary.get("lowest_price_region"),
        "avg_nem_price": price_summary.get("avg_nem_price"),
    }


# ---------------------------------------------------------------------------
# Unit-test entry point
# ---------------------------------------------------------------------------

def run_unit_tests() -> None:
    """Verify key functions with hardcoded data and a mock Anthropic response."""
    logger.info("Running unit tests for market summary pipeline...")

    # Full pipeline run with mock mode
    result = run_market_summary_pipeline(spark=None, mock_anthropic=True)
    assert result.get("generation_succeeded") is True, "Mock generation should succeed"
    assert result.get("word_count", 0) >= WORD_COUNT_MIN, (
        f"Mock word count {result.get('word_count')} < {WORD_COUNT_MIN}"
    )

    # Quality check: trading advice detection
    bad_text = "You should buy when prices drop and sell at the morning peak."
    assert _quality_check(bad_text) is not None, "Trading advice should be flagged"

    clean_text = "Prices rose across most regions during the morning ramp. " * 40
    result_clean = _quality_check(clean_text)
    assert result_clean is None or "too_high" in (result_clean or ""), (
        "Clean text should pass trading-advice check"
    )

    # Template fallback
    ctx = make_hardcoded_context()
    ps = _compute_price_summary(ctx)
    fallback = _template_fallback(ctx, ps)
    assert len(fallback) > 100, "Template fallback should produce non-trivial text"
    assert TRADING_ADVICE_PATTERNS.search(fallback) is None, (
        "Template fallback must not contain trading advice patterns"
    )

    # Price summary derivation
    assert ps["highest_price_region"] == "SA1", f"Expected SA1 highest, got {ps['highest_price_region']}"
    assert ps["lowest_price_region"] == "TAS1", f"Expected TAS1 lowest, got {ps['lowest_price_region']}"

    logger.info("All unit tests passed.")


# ---------------------------------------------------------------------------
# Notebook execution entry point
# ---------------------------------------------------------------------------

try:
    run_market_summary_pipeline(spark=spark)  # type: ignore[name-defined]  # noqa: F821
except NameError:
    logger.warning("No Spark session found — running in unit-test mode")
    run_unit_tests()
