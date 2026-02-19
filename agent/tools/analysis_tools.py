"""
agent/tools/analysis_tools.py
================================
Python stubs for the 3 analysis tools used by the AUS Energy Copilot agent.

These tools perform higher-level analytical operations by joining multiple
gold-layer tables (prices, generation, weather, constraints, outages) and
returning structured summaries suitable for LLM consumption.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from databricks import sql as dbsql
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

_CATALOG = os.getenv("DATABRICKS_CATALOG", "energy_copilot")


def _connection():
    return dbsql.connect(
        server_hostname=os.environ["DATABRICKS_HOST"].replace("https://", ""),
        http_path=f"/sql/1.0/warehouses/{os.environ['DATABRICKS_WAREHOUSE_ID']}",
        access_token=os.environ["DATABRICKS_TOKEN"],
    )


def _query(sql: str) -> list[dict]:
    conn = _connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Tool 1: explain_price_event
# ---------------------------------------------------------------------------

@tool
def explain_price_event(region: str, timestamp: str) -> dict:
    """
    Provide a structured causal explanation for an unusual price event
    (spike or negative price) at a specific dispatch interval in a NEM region.

    This tool correlates multiple data sources to identify probable causes:
      - Scheduled and forced generator outages
      - Network binding constraints
      - Weather conditions (temperature, wind, solar)
      - Interconnector flows and limits
      - Demand levels relative to seasonal norms

    Args:
        region:    NEM region code (NSW1, QLD1, VIC1, SA1, TAS1).
        timestamp: ISO-8601 datetime of the dispatch interval to explain,
                   e.g. "2026-02-19T14:30:00". Must be a past interval.

    Returns:
        A dict containing:
          - "region"          (str)   The analysed region
          - "timestamp"       (str)   The dispatch interval timestamp
          - "price_rrp"       (float) Actual RRP at this interval (AUD/MWh)
          - "price_category"  (str)   One of: NEGATIVE, LOW, NORMAL, HIGH, SPIKE, MPC
                                      (MPC = Market Price Cap, $17,500/MWh as of 2026)
          - "demand_mw"       (float) Operational demand at this interval
          - "demand_vs_norm_pct" (float) % above/below seasonal 30-day average
          - "active_constraints" (list) Binding constraints with marginal values
          - "recent_outages"  (list) Generator outages in region in prior 2 hours:
              [{"duid": str, "name": str, "type": str, "capacity_mw": float,
                "outage_type": str}]
          - "interconnector_status" (list) Flow levels as % of limits
          - "weather_summary" (dict) Temp, wind, solar at the interval
          - "generation_mix"  (dict) Generation by fuel type at this interval
          - "likely_causes"   (list[str]) Ranked list of probable causes
          - "confidence"      (str) "HIGH" | "MEDIUM" | "LOW"
          - "analyst_notes"   (str) Plain-language summary for trader consumption

    Example:
        >>> explain_price_event("SA1", "2026-02-19T15:00:00")
        {"price_rrp": 14500.0, "price_category": "SPIKE",
         "likely_causes": ["Loss of PELICAN POINT CCGT (240MW)", "Heywood at export limit"],
         "analyst_notes": "Price spike driven by simultaneous loss of..."}
    """
    # --- Price and demand at the interval ---
    price_rows = _query(
        f"""
        SELECT rrp, totaldemand AS demand_mw,
               (totaldemand - AVG(totaldemand) OVER (
                   ORDER BY settlementdate
                   ROWS BETWEEN 8640 PRECEDING AND CURRENT ROW
               )) / NULLIF(AVG(totaldemand) OVER (
                   ORDER BY settlementdate
                   ROWS BETWEEN 8640 PRECEDING AND CURRENT ROW
               ), 0) * 100 AS demand_vs_norm_pct
        FROM {_CATALOG}.gold.nem_prices_5min
        WHERE regionid = '{region}'
          AND settlementdate = '{timestamp}'
        """
    )

    price_rrp = price_rows[0]["rrp"] if price_rows else None
    demand_mw = price_rows[0]["demand_mw"] if price_rows else None
    demand_vs_norm = price_rows[0]["demand_vs_norm_pct"] if price_rows else None

    # Categorise price
    if price_rrp is None:
        price_category = "UNKNOWN"
    elif price_rrp >= 17500:
        price_category = "MPC"
    elif price_rrp >= 1000:
        price_category = "SPIKE"
    elif price_rrp >= 300:
        price_category = "HIGH"
    elif price_rrp >= 0:
        price_category = "NORMAL" if price_rrp < 150 else "HIGH"
    else:
        price_category = "NEGATIVE"

    # --- Active constraints ---
    constraints = _query(
        f"""
        SELECT constraintid, marginalvalue AS marginal_value, rhs, violationdegree
        FROM {_CATALOG}.gold.nem_constraints
        WHERE regionid = '{region}'
          AND settlementdate = '{timestamp}'
          AND marginalvalue != 0
        ORDER BY ABS(marginalvalue) DESC
        LIMIT 10
        """
    )

    # --- Outages in the prior 2 hours ---
    outages = _query(
        f"""
        SELECT o.duid, d.station_name AS name, d.dispatch_type AS type,
               d.registered_capacity AS capacity_mw, o.outage_type
        FROM {_CATALOG}.gold.generator_outages o
        JOIN {_CATALOG}.gold.generator_details d USING (duid)
        WHERE d.regionid = '{region}'
          AND o.outage_start <= '{timestamp}'
          AND (o.outage_end IS NULL OR o.outage_end >= '{timestamp}')
        ORDER BY d.registered_capacity DESC
        LIMIT 10
        """
    )

    # --- Interconnector status ---
    interconnectors = _query(
        f"""
        SELECT interconnectorid, mwflow, exportlimit, importlimit,
               ABS(mwflow) / NULLIF(
                   CASE WHEN mwflow >= 0 THEN exportlimit ELSE ABS(importlimit) END, 0
               ) * 100 AS utilisation_pct
        FROM {_CATALOG}.gold.nem_interconnectors
        WHERE settlementdate = '{timestamp}'
          AND (fromregionid = '{region}' OR toregionid = '{region}')
        """
    )

    # --- Weather ---
    weather = _query(
        f"""
        SELECT temp_c, wind_speed_kph, solar_exposure_mj, apparent_temp_c
        FROM {_CATALOG}.gold.weather_actuals w
        JOIN {_CATALOG}.gold.weather_station_region_map m ON w.station_id = m.station_id
        WHERE m.regionid = '{region}' AND m.is_primary = TRUE
          AND w.observation_time BETWEEN '{timestamp}' - INTERVAL 15 MINUTES
          AND '{timestamp}' + INTERVAL 15 MINUTES
        ORDER BY ABS(TIMESTAMPDIFF(MINUTE, w.observation_time, '{timestamp}'))
        LIMIT 1
        """
    )

    # --- Generation mix ---
    generation = _query(
        f"""
        SELECT fuel_type, SUM(generation_mw) AS generation_mw
        FROM {_CATALOG}.gold.nem_generation_by_fuel
        WHERE regionid = '{region}'
          AND settlementdate = '{timestamp}'
        GROUP BY fuel_type
        ORDER BY generation_mw DESC
        """
    )

    # Heuristic: derive likely causes
    likely_causes = []
    if outages:
        for o in outages[:3]:
            likely_causes.append(
                f"Loss of {o.get('name', o.get('duid', '?'))} "
                f"({o.get('capacity_mw', '?')} MW, {o.get('outage_type', 'outage')})"
            )
    for ic in interconnectors:
        if ic.get("utilisation_pct") and ic["utilisation_pct"] >= 95:
            likely_causes.append(
                f"Interconnector {ic['interconnectorid']} at "
                f"{ic['utilisation_pct']:.0f}% of limit"
            )
    for c in constraints[:2]:
        likely_causes.append(
            f"Binding constraint {c['constraintid']} "
            f"(marginal value: ${c['marginal_value']:.0f}/MWh)"
        )
    if demand_vs_norm and demand_vs_norm > 10:
        likely_causes.append(
            f"Demand {demand_vs_norm:.1f}% above 30-day seasonal average"
        )
    if not likely_causes:
        likely_causes = ["Insufficient data to determine cause; manual review recommended"]

    confidence = "HIGH" if len(likely_causes) >= 2 else ("MEDIUM" if likely_causes else "LOW")

    causes_text = "; ".join(likely_causes[:3])
    analyst_notes = (
        f"Price {'spike' if price_rrp and price_rrp > 300 else 'event'} "
        f"of ${price_rrp:.2f}/MWh in {region} at {timestamp}. "
        f"Primary factors: {causes_text}."
    )

    return {
        "region": region,
        "timestamp": timestamp,
        "price_rrp": price_rrp,
        "price_category": price_category,
        "demand_mw": demand_mw,
        "demand_vs_norm_pct": demand_vs_norm,
        "active_constraints": constraints,
        "recent_outages": outages,
        "interconnector_status": interconnectors,
        "weather_summary": weather[0] if weather else {},
        "generation_mix": {r["fuel_type"]: r["generation_mw"] for r in generation},
        "likely_causes": likely_causes,
        "confidence": confidence,
        "analyst_notes": analyst_notes,
    }


# ---------------------------------------------------------------------------
# Tool 2: compare_regions
# ---------------------------------------------------------------------------

@tool
def compare_regions(metric: str, start: str, end: str) -> dict:
    """
    Compare all 5 NEM regions side-by-side on a specified market metric over
    a time period.

    Args:
        metric: The metric to compare. One of:
                  "price"       — Average, min, max, std RRP (AUD/MWh)
                  "demand"      — Average and peak operational demand (MW)
                  "generation"  — Total generation by fuel type (GWh)
                  "fcas_cost"   — Total FCAS expenditure (AUD)
                  "spike_count" — Number of dispatch intervals with RRP > $1000/MWh
                  "negative_count" — Number of dispatch intervals with RRP < $0/MWh
        start:  ISO-8601 start datetime.
        end:    ISO-8601 end datetime.

    Returns:
        A dict containing:
          - "metric"      (str)  The requested metric
          - "period"      (dict) {"start": str, "end": str}
          - "regions"     (dict) Mapping of region_code -> metric_data
          - "ranking"     (list) Regions ranked from highest to lowest on primary value
          - "summary"     (str)  Plain-language one-sentence summary

    Example:
        >>> compare_regions("price", "2026-02-19T00:00:00", "2026-02-19T23:59:59")
        {"metric": "price", "regions": {
            "NSW1": {"avg": 87.4, "min": -42.3, "max": 1450.0, "std": 95.2},
            "SA1":  {"avg": 112.6, "min": -65.1, "max": 14500.0, "std": 430.1},
            ...
        }}
    """
    valid_metrics = {"price", "demand", "generation", "fcas_cost", "spike_count", "negative_count"}
    if metric not in valid_metrics:
        raise ValueError(f"Invalid metric '{metric}'. Must be one of {valid_metrics}.")

    metric_sql_map = {
        "price": f"""
            SELECT regionid,
                   AVG(rrp) AS avg_price,
                   MIN(rrp) AS min_price,
                   MAX(rrp) AS max_price,
                   STDDEV(rrp) AS std_price
            FROM {_CATALOG}.gold.nem_prices_5min
            WHERE settlementdate BETWEEN '{start}' AND '{end}'
            GROUP BY regionid ORDER BY regionid
        """,
        "demand": f"""
            SELECT regionid,
                   AVG(totaldemand) AS avg_demand_mw,
                   MAX(totaldemand) AS peak_demand_mw,
                   MIN(totaldemand) AS min_demand_mw
            FROM {_CATALOG}.gold.nem_prices_5min
            WHERE settlementdate BETWEEN '{start}' AND '{end}'
            GROUP BY regionid ORDER BY regionid
        """,
        "generation": f"""
            SELECT regionid, fuel_type,
                   SUM(generation_mw) * 5/60 AS total_gwh
            FROM {_CATALOG}.gold.nem_generation_by_fuel
            WHERE settlementdate BETWEEN '{start}' AND '{end}'
            GROUP BY regionid, fuel_type ORDER BY regionid, total_gwh DESC
        """,
        "fcas_cost": f"""
            SELECT regionid,
                   SUM(rrp * clearedvolume * 5/60) AS total_fcas_aud
            FROM {_CATALOG}.gold.nem_fcas_prices
            WHERE settlementdate BETWEEN '{start}' AND '{end}'
            GROUP BY regionid ORDER BY regionid
        """,
        "spike_count": f"""
            SELECT regionid,
                   COUNT(*) AS spike_intervals,
                   SUM(rrp) / COUNT(*) AS avg_spike_price
            FROM {_CATALOG}.gold.nem_prices_5min
            WHERE settlementdate BETWEEN '{start}' AND '{end}'
              AND rrp > 1000
            GROUP BY regionid ORDER BY regionid
        """,
        "negative_count": f"""
            SELECT regionid,
                   COUNT(*) AS negative_intervals,
                   MIN(rrp) AS lowest_price
            FROM {_CATALOG}.gold.nem_prices_5min
            WHERE settlementdate BETWEEN '{start}' AND '{end}'
              AND rrp < 0
            GROUP BY regionid ORDER BY regionid
        """,
    }

    rows = _query(metric_sql_map[metric])

    # Build region dict
    regions: dict = {}
    for row in rows:
        rid = row.pop("regionid")
        if metric == "generation":
            # Accumulate fuel breakdown per region
            regions.setdefault(rid, {})[row["fuel_type"]] = row["total_gwh"]
        else:
            regions[rid] = row

    # Rank regions by primary value
    primary_key_map = {
        "price": "avg_price",
        "demand": "avg_demand_mw",
        "generation": None,
        "fcas_cost": "total_fcas_aud",
        "spike_count": "spike_intervals",
        "negative_count": "negative_intervals",
    }
    pk = primary_key_map.get(metric)
    if pk and all(pk in v for v in regions.values()):
        ranking = sorted(regions.keys(), key=lambda r: regions[r].get(pk, 0), reverse=True)
    else:
        ranking = sorted(regions.keys())

    summary = f"Comparison of {metric} across NEM regions from {start} to {end}."
    if ranking and pk:
        top = ranking[0]
        summary = (
            f"{top} had the highest {metric.replace('_', ' ')} "
            f"({regions[top].get(pk, '?'):.1f}) for the period."
        )

    return {
        "metric": metric,
        "period": {"start": start, "end": end},
        "regions": regions,
        "ranking": ranking,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# Tool 3: get_market_summary
# ---------------------------------------------------------------------------

@tool
def get_market_summary(date: str) -> str:
    """
    Return a structured daily summary of NEM market conditions for a given date.

    Suitable for providing a quick market overview before diving into specifics.
    Covers prices, demand, generation, notable events, and interconnector flows.

    Args:
        date: Date to summarise in YYYY-MM-DD format (AEST).
              Must be a past date for which settled data is available.

    Returns:
        A multi-section plain-text string formatted for direct presentation to
        a trader, structured as:

        === NEM Market Summary: YYYY-MM-DD ===

        PRICES (AUD/MWh):
          NSW1: avg $XX.XX | peak $XX.XX at HH:MM | min $XX.XX at HH:MM
          ...

        DEMAND (MW):
          Peak: XXX MW in NSW1 at HH:MM | System peak: XXX MW at HH:MM
          ...

        GENERATION:
          Renewables share: XX% (wind: XX%, solar: XX%, hydro: XX%)
          ...

        NOTABLE EVENTS:
          - [any price spikes, outages, constraint events]

        INTERCONNECTORS:
          ...

    Example:
        >>> get_market_summary("2026-02-18")
        "=== NEM Market Summary: 2026-02-18 ===\n\nPRICES (AUD/MWh):\n..."
    """
    # Price summary
    price_rows = _query(
        f"""
        SELECT regionid,
               AVG(rrp)  AS avg_rrp,
               MAX(rrp)  AS max_rrp,
               MIN(rrp)  AS min_rrp,
               SUM(CASE WHEN rrp > 1000 THEN 1 ELSE 0 END) AS spike_count,
               SUM(CASE WHEN rrp < 0    THEN 1 ELSE 0 END) AS neg_count
        FROM {_CATALOG}.gold.nem_prices_5min
        WHERE DATE(settlementdate) = '{date}'
        GROUP BY regionid ORDER BY regionid
        """
    )

    # Peak demand intervals
    peak_rows = _query(
        f"""
        SELECT regionid, MAX(totaldemand) AS peak_demand_mw,
               FIRST_VALUE(settlementdate) OVER (
                   PARTITION BY regionid ORDER BY totaldemand DESC
               ) AS peak_time
        FROM {_CATALOG}.gold.nem_prices_5min
        WHERE DATE(settlementdate) = '{date}'
        GROUP BY regionid ORDER BY regionid
        """
    )

    # Generation mix
    gen_rows = _query(
        f"""
        SELECT fuel_type,
               SUM(generation_mw) * 5/60 AS total_gwh
        FROM {_CATALOG}.gold.nem_generation_by_fuel
        WHERE DATE(settlementdate) = '{date}'
        GROUP BY fuel_type ORDER BY total_gwh DESC
        """
    )

    # Build summary text
    lines = [f"=== NEM Market Summary: {date} ===", ""]

    lines.append("PRICES (AUD/MWh):")
    for r in price_rows:
        spike_note = f" | {r['spike_count']} spike intervals" if r["spike_count"] > 0 else ""
        neg_note = f" | {r['neg_count']} negative intervals" if r["neg_count"] > 0 else ""
        lines.append(
            f"  {r['regionid']}: avg ${r['avg_rrp']:.2f} | "
            f"max ${r['max_rrp']:.2f} | min ${r['min_rrp']:.2f}"
            f"{spike_note}{neg_note}"
        )
    lines.append("")

    lines.append("DEMAND (MW):")
    for r in peak_rows:
        lines.append(
            f"  {r['regionid']}: peak {r['peak_demand_mw']:.0f} MW at "
            f"{str(r.get('peak_time', '?'))}"
        )
    lines.append("")

    lines.append("GENERATION:")
    total_gen = sum(r["total_gwh"] for r in gen_rows)
    renewable_types = {"WIND", "SOLAR_UTILITY", "SOLAR_ROOFTOP", "HYDRO"}
    renewable_gwh = sum(r["total_gwh"] for r in gen_rows if r["fuel_type"] in renewable_types)
    renewable_pct = renewable_gwh / total_gen * 100 if total_gen else 0
    lines.append(f"  Total generation: {total_gen:.1f} GWh")
    lines.append(f"  Renewables share: {renewable_pct:.1f}%")
    for r in gen_rows[:6]:
        share = r["total_gwh"] / total_gen * 100 if total_gen else 0
        lines.append(f"  {r['fuel_type']}: {r['total_gwh']:.1f} GWh ({share:.1f}%)")
    lines.append("")

    # Notable events (price spikes)
    lines.append("NOTABLE EVENTS:")
    spike_events = [r for r in price_rows if r["spike_count"] > 0]
    if spike_events:
        for r in spike_events:
            lines.append(
                f"  - {r['regionid']}: {r['spike_count']} dispatch intervals "
                f"above $1000/MWh (max: ${r['max_rrp']:.0f}/MWh)"
            )
    else:
        lines.append("  - No significant price spikes recorded.")

    return "\n".join(lines)
