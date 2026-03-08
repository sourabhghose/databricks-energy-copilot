"""WS1: AI Bidding & Revenue Optimisation.

Generator bid management, optimisation, conformance monitoring, and revenue attribution.
"""
from __future__ import annotations

import math
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from .shared import (
    _CATALOG,
    _NEM_REGIONS,
    _query_gold,
    _execute_gold,
    _insert_gold,
    _insert_gold_batch,
    _sql_escape,
    _cache_get,
    _cache_set,
    logger,
)

router = APIRouter()
_SCHEMA = f"{_CATALOG}.gold"

# NEM price bands: 10 bands from -$1000 to $16600
_NEM_BAND_LIMITS = [-1000, -100, 0, 50, 100, 200, 500, 1000, 5000, 16600]

# Generator profiles for optimisation
_GENERATOR_PROFILES: Dict[str, Dict[str, Any]] = {
    "BAYSW1": {"fuel": "coal_black", "capacity_mw": 660, "min_gen_mw": 200, "srmc": 28},
    "ERGT01": {"fuel": "gas_ccgt", "capacity_mw": 160, "min_gen_mw": 0, "srmc": 65},
    "HDWF1": {"fuel": "wind", "capacity_mw": 95, "min_gen_mw": 0, "srmc": 0},
    "LKBNL1": {"fuel": "wind", "capacity_mw": 278, "min_gen_mw": 0, "srmc": 0},
    "CALL_A_1": {"fuel": "coal_black", "capacity_mw": 420, "min_gen_mw": 150, "srmc": 32},
}


# ---------------------------------------------------------------------------
# Core functions (exported for Copilot tools)
# ---------------------------------------------------------------------------

def _optimize_bid_core(generator_id: str, region: str = "NSW1",
                       strategy: str = "ML_OPTIMIZED") -> Dict[str, Any]:
    """Generate an optimised 10-band bid for a generator."""
    profile = _GENERATOR_PROFILES.get(generator_id, {
        "fuel": "unknown", "capacity_mw": 500, "min_gen_mw": 0, "srmc": 40,
    })
    capacity = profile["capacity_mw"]
    srmc = profile["srmc"]
    min_gen = profile["min_gen_mw"]

    # Get recent prices to inform bidding
    recent = _query_gold(
        f"SELECT AVG(rrp) as avg_price, STDDEV(rrp) as vol, MAX(rrp) as max_price "
        f"FROM {_SCHEMA}.nem_prices_5min "
        f"WHERE region_id = '{_sql_escape(region)}' "
        f"AND interval_datetime >= current_timestamp() - INTERVAL 24 HOURS"
    )
    avg_price = 75.0
    vol = 40.0
    if recent and recent[0].get("avg_price"):
        avg_price = float(recent[0]["avg_price"])
        vol = float(recent[0].get("vol") or 40)

    # Build optimised bands
    random.seed(hash(f"{generator_id}{strategy}{datetime.now().date()}"))
    bands = []
    remaining = capacity

    if strategy == "PRICE_TAKER":
        # Bid all at floor price
        bands = [{"band": i + 1, "price": _NEM_BAND_LIMITS[i], "mw": round(capacity / 10, 1)}
                 for i in range(10)]
    elif strategy == "MARGINAL_COST":
        # Bid min gen at floor, rest at SRMC
        for i in range(10):
            if i == 0:
                mw = round(min_gen, 1)
            elif i == 4:
                mw = round(remaining * 0.7, 1)
            elif i == 8:
                mw = round(remaining * 0.3, 1)
            else:
                mw = 0
            bands.append({"band": i + 1, "price": round(srmc + (i - 4) * vol * 0.5, 2), "mw": mw})
            remaining -= mw
    else:
        # ML_OPTIMIZED: distribute based on price forecast
        for i in range(10):
            if i < 2:
                price = round(-1000 + i * 900, 2)
                mw = round(min_gen * 0.5 if i == 0 else min_gen * 0.5, 1)
            elif i < 5:
                price = round(srmc * (0.8 + i * 0.15), 2)
                mw = round((capacity - min_gen) * 0.15, 1)
            elif i < 8:
                price = round(avg_price + vol * (i - 4) * 0.8, 2)
                mw = round((capacity - min_gen) * 0.12, 1)
            else:
                price = round(avg_price + vol * (i - 4) * 1.5, 2)
                mw = round(remaining, 1) if i == 9 else round((capacity - min_gen) * 0.05, 1)
            remaining -= mw
            remaining = max(0, remaining)
            bands.append({"band": i + 1, "price": price, "mw": max(0, mw)})

    expected_revenue = sum(b["mw"] * max(b["price"], avg_price) / 2 for b in bands)

    return {
        "generator_id": generator_id,
        "region": region,
        "strategy": strategy,
        "capacity_mw": capacity,
        "srmc": srmc,
        "market_context": {
            "avg_price_24h": round(avg_price, 2),
            "volatility": round(vol, 2),
        },
        "recommended_bands": bands,
        "total_bid_mw": round(sum(b["mw"] for b in bands), 1),
        "expected_revenue_daily": round(expected_revenue, 2),
    }


def _suggest_rebid_core(generator_id: str, region: str = "NSW1",
                        reason: str = "price_change") -> Dict[str, Any]:
    """Suggest a rebid based on current market conditions."""
    current = _optimize_bid_core(generator_id, region, "ML_OPTIMIZED")
    current["rebid_reason"] = reason
    current["rebid_recommended"] = True
    current["urgency"] = "HIGH" if reason in ("price_spike", "constraint") else "MEDIUM"
    current["aemo_notification_required"] = True
    return current


def _get_bid_compliance_core(generator_id: Optional[str] = None,
                             region: Optional[str] = None) -> Dict[str, Any]:
    """Check bid compliance — conformance rate, penalties, flags."""
    where_parts = []
    if generator_id:
        where_parts.append(f"generator_id = '{_sql_escape(generator_id)}'")
    if region:
        where_parts.append(f"region = '{_sql_escape(region)}'")
    where = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

    rows = _query_gold(
        f"SELECT conformance_status, COUNT(*) as cnt, "
        f"AVG(ABS(deviation_pct)) as avg_dev "
        f"FROM {_SCHEMA}.dispatch_conformance {where} "
        f"GROUP BY conformance_status"
    )

    total = sum(int(r.get("cnt", 0)) for r in (rows or []))
    conforming = sum(int(r["cnt"]) for r in (rows or []) if r["conformance_status"] == "CONFORMING")

    penalties = _query_gold(
        f"SELECT COUNT(*) as penalty_count FROM {_SCHEMA}.dispatch_conformance "
        f"{where}{' AND ' if where else 'WHERE '}penalty_flag = true"
    )

    return {
        "total_events": total,
        "conforming_count": conforming,
        "conformance_rate": round(conforming / max(total, 1) * 100, 1),
        "penalty_count": int((penalties or [{}])[0].get("penalty_count", 0)),
        "status_breakdown": rows or [],
        "compliance_grade": "A" if conforming / max(total, 1) > 0.95 else "B" if conforming / max(total, 1) > 0.85 else "C",
    }


def _compare_bid_vs_optimal_core(generator_id: str, region: str = "NSW1") -> Dict[str, Any]:
    """Compare actual bid outcomes vs optimal strategy."""
    rows = _query_gold(
        f"SELECT strategy, expected_revenue, actual_revenue, optimal_revenue, revenue_uplift_pct "
        f"FROM {_SCHEMA}.bid_optimization_results "
        f"WHERE generator_id = '{_sql_escape(generator_id)}' "
        f"ORDER BY calc_datetime DESC LIMIT 10"
    )
    if not rows:
        return {"error": f"No optimization results for {generator_id}"}

    total_actual = sum(float(r.get("actual_revenue", 0) or 0) for r in rows)
    total_optimal = sum(float(r.get("optimal_revenue", 0) or 0) for r in rows)
    uplift = round((total_optimal - total_actual) / max(total_actual, 1) * 100, 2)

    return {
        "generator_id": generator_id,
        "region": region,
        "comparisons": rows,
        "total_actual_revenue": round(total_actual, 2),
        "total_optimal_revenue": round(total_optimal, 2),
        "revenue_uplift_pct": uplift,
        "recommendation": f"Potential {uplift:.1f}% revenue uplift through optimised bidding",
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/api/bidding/dashboard")
async def bidding_dashboard(region: str = Query("NSW1")):
    """Bidding overview: KPIs, recent bids, conformance, revenue."""
    # KPIs
    bids = _query_gold(
        f"SELECT COUNT(*) as total, "
        f"SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted "
        f"FROM {_SCHEMA}.bids_submitted WHERE region = '{_sql_escape(region)}'"
    )
    conformance = _get_bid_compliance_core(region=region)

    revenue = _query_gold(
        f"SELECT SUM(total_revenue) as total_rev, AVG(capacity_factor) as avg_cf "
        f"FROM {_SCHEMA}.revenue_attribution WHERE region = '{_sql_escape(region)}'"
    )

    recent_bids = _query_gold(
        f"SELECT bid_id, generator_id, generator_name, bid_datetime, total_mw, status "
        f"FROM {_SCHEMA}.bids_submitted WHERE region = '{_sql_escape(region)}' "
        f"ORDER BY bid_datetime DESC LIMIT 10"
    )

    return {
        "region": region,
        "kpis": {
            "total_bids": int((bids or [{}])[0].get("total", 0)),
            "accepted_bids": int((bids or [{}])[0].get("accepted", 0)),
            "conformance_rate": conformance["conformance_rate"],
            "total_revenue": round(float((revenue or [{}])[0].get("total_rev", 0) or 0), 2),
            "avg_capacity_factor": round(float((revenue or [{}])[0].get("avg_cf", 0) or 0), 3),
        },
        "recent_bids": [
            {**b, "bid_datetime": str(b.get("bid_datetime", ""))} for b in (recent_bids or [])
        ],
        "conformance": conformance,
    }


@router.get("/api/bidding/bids")
async def list_bids(region: str = Query("NSW1"), generator_id: Optional[str] = None,
                    limit: int = Query(20)):
    """List submitted bids."""
    where = f"WHERE region = '{_sql_escape(region)}'"
    if generator_id:
        where += f" AND generator_id = '{_sql_escape(generator_id)}'"
    rows = _query_gold(
        f"SELECT * FROM {_SCHEMA}.bids_submitted {where} "
        f"ORDER BY bid_datetime DESC LIMIT {limit}"
    )
    return {"bids": [{**r, "bid_datetime": str(r.get("bid_datetime", "")),
                       "created_at": str(r.get("created_at", ""))} for r in (rows or [])]}


@router.post("/api/bidding/optimize")
async def optimize_bid(generator_id: str = Query("BAYSW1"),
                       region: str = Query("NSW1"),
                       strategy: str = Query("ML_OPTIMIZED")):
    """Generate an optimised bid for a generator."""
    return _optimize_bid_core(generator_id, region, strategy)


@router.post("/api/bidding/rebid")
async def suggest_rebid(generator_id: str = Query("BAYSW1"),
                        region: str = Query("NSW1"),
                        reason: str = Query("price_change")):
    """Suggest a rebid based on market conditions."""
    return _suggest_rebid_core(generator_id, region, reason)


@router.get("/api/bidding/conformance")
async def conformance_events(region: str = Query("NSW1"),
                             generator_id: Optional[str] = None,
                             limit: int = Query(30)):
    """List dispatch conformance events."""
    where = f"WHERE region = '{_sql_escape(region)}'"
    if generator_id:
        where += f" AND generator_id = '{_sql_escape(generator_id)}'"
    rows = _query_gold(
        f"SELECT * FROM {_SCHEMA}.dispatch_conformance {where} "
        f"ORDER BY interval_datetime DESC LIMIT {limit}"
    )
    return {"events": [{**r, "interval_datetime": str(r.get("interval_datetime", ""))}
                        for r in (rows or [])]}


@router.get("/api/bidding/revenue")
async def revenue_attribution(region: str = Query("NSW1"),
                               generator_id: Optional[str] = None):
    """Get revenue attribution by generator."""
    where = f"WHERE region = '{_sql_escape(region)}'"
    if generator_id:
        where += f" AND generator_id = '{_sql_escape(generator_id)}'"
    rows = _query_gold(
        f"SELECT generator_id, generator_name, fuel_type, "
        f"SUM(energy_revenue) as energy_rev, SUM(fcas_revenue) as fcas_rev, "
        f"SUM(total_revenue) as total_rev, AVG(capacity_factor) as avg_cf, "
        f"AVG(spot_price_avg) as avg_spot "
        f"FROM {_SCHEMA}.revenue_attribution {where} "
        f"GROUP BY generator_id, generator_name, fuel_type "
        f"ORDER BY total_rev DESC"
    )
    return {"revenue": rows or []}


@router.get("/api/bidding/compliance")
async def bid_compliance(generator_id: Optional[str] = None,
                         region: Optional[str] = None):
    """Get bid compliance summary."""
    return _get_bid_compliance_core(generator_id, region)
