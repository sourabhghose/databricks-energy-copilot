"""WS4: Gas Market Analytics.

STTM prices, DWGM prices, spark spreads, and gas-electricity correlation.
"""
from __future__ import annotations

import random
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from .shared import (
    _CATALOG,
    _NEM_REGIONS,
    _query_gold,
    _sql_escape,
    logger,
)

router = APIRouter()
_SCHEMA = f"{_CATALOG}.gold"


# ---------------------------------------------------------------------------
# Core functions (exported for Copilot tools)
# ---------------------------------------------------------------------------

def _get_gas_price_core(hub: Optional[str] = None, days: int = 30) -> Dict[str, Any]:
    """Get gas prices across STTM hubs and DWGM."""
    # STTM prices
    sttm_where = f"AND hub = '{_sql_escape(hub)}'" if hub else ""
    sttm = _query_gold(
        f"SELECT hub, trade_date, ex_ante_price, ex_post_price "
        f"FROM {_SCHEMA}.gas_sttm_prices "
        f"WHERE trade_date >= current_date() - INTERVAL {days} DAYS {sttm_where} "
        f"ORDER BY trade_date DESC LIMIT 200"
    )

    # DWGM prices
    dwgm = _query_gold(
        f"SELECT trade_date, AVG(price_aud_gj) as avg_price, "
        f"MIN(price_aud_gj) as min_price, MAX(price_aud_gj) as max_price "
        f"FROM {_SCHEMA}.gas_dwgm_prices "
        f"WHERE trade_date >= current_date() - INTERVAL {days} DAYS "
        f"GROUP BY trade_date ORDER BY trade_date DESC LIMIT 90"
    )

    # Summary stats
    sttm_avg = _query_gold(
        f"SELECT hub, AVG(ex_ante_price) as avg_price, "
        f"MIN(ex_ante_price) as min_price, MAX(ex_ante_price) as max_price "
        f"FROM {_SCHEMA}.gas_sttm_prices "
        f"WHERE trade_date >= current_date() - INTERVAL {days} DAYS {sttm_where} "
        f"GROUP BY hub"
    )

    return {
        "period_days": days,
        "sttm_prices": [{**r, "trade_date": str(r.get("trade_date", ""))} for r in (sttm or [])],
        "dwgm_prices": [{**r, "trade_date": str(r.get("trade_date", ""))} for r in (dwgm or [])],
        "sttm_summary": sttm_avg or [],
    }


def _get_spark_spread_core(region: Optional[str] = None, days: int = 30) -> Dict[str, Any]:
    """Get spark spread data — electricity price vs gas cost of generation."""
    where = f"AND region = '{_sql_escape(region)}'" if region else ""
    rows = _query_gold(
        f"SELECT region, trade_date, electricity_price, gas_price, "
        f"heat_rate, spark_spread, clean_spark_spread, carbon_cost "
        f"FROM {_SCHEMA}.gas_spark_spreads "
        f"WHERE trade_date >= current_date() - INTERVAL {days} DAYS {where} "
        f"ORDER BY trade_date DESC LIMIT 500"
    )

    # Averages by region
    avgs = _query_gold(
        f"SELECT region, AVG(spark_spread) as avg_spark, "
        f"AVG(clean_spark_spread) as avg_clean_spark, "
        f"AVG(electricity_price) as avg_elec, AVG(gas_price) as avg_gas "
        f"FROM {_SCHEMA}.gas_spark_spreads "
        f"WHERE trade_date >= current_date() - INTERVAL {days} DAYS {where} "
        f"GROUP BY region ORDER BY avg_spark DESC"
    )

    return {
        "period_days": days,
        "spreads": [{**r, "trade_date": str(r.get("trade_date", ""))} for r in (rows or [])],
        "summary_by_region": avgs or [],
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/api/gas/dashboard")
async def gas_dashboard(days: int = Query(30)):
    """Gas market overview: STTM, DWGM, spark spreads."""
    prices = _get_gas_price_core(days=days)
    spreads = _get_spark_spread_core(days=days)

    return {
        "period_days": days,
        "sttm_summary": prices["sttm_summary"],
        "dwgm_latest": prices["dwgm_prices"][:5] if prices["dwgm_prices"] else [],
        "spark_spread_summary": spreads["summary_by_region"],
    }


@router.get("/api/gas/sttm")
async def sttm_prices(hub: Optional[str] = None, days: int = Query(30)):
    """Get STTM hub prices."""
    where = f"AND hub = '{_sql_escape(hub)}'" if hub else ""
    rows = _query_gold(
        f"SELECT * FROM {_SCHEMA}.gas_sttm_prices "
        f"WHERE trade_date >= current_date() - INTERVAL {days} DAYS {where} "
        f"ORDER BY trade_date DESC, hub LIMIT 300"
    )
    return {"prices": [{**r, "trade_date": str(r.get("trade_date", ""))} for r in (rows or [])]}


@router.get("/api/gas/dwgm")
async def dwgm_prices(days: int = Query(30)):
    """Get DWGM (Victorian gas market) prices."""
    rows = _query_gold(
        f"SELECT * FROM {_SCHEMA}.gas_dwgm_prices "
        f"WHERE trade_date >= current_date() - INTERVAL {days} DAYS "
        f"ORDER BY trade_date DESC, trading_interval LIMIT 600"
    )
    return {"prices": [{**r, "trade_date": str(r.get("trade_date", ""))} for r in (rows or [])]}


@router.get("/api/gas/spark-spread")
async def spark_spreads(region: Optional[str] = None, days: int = Query(30)):
    """Get spark spread data."""
    return _get_spark_spread_core(region, days)


@router.get("/api/gas/correlation")
async def gas_electricity_correlation(region: str = Query("NSW1"), days: int = Query(30)):
    """Get gas-electricity price correlation."""
    rows = _query_gold(
        f"SELECT gs.trade_date, gs.gas_price, gs.electricity_price, gs.spark_spread "
        f"FROM {_SCHEMA}.gas_spark_spreads gs "
        f"WHERE gs.region = '{_sql_escape(region)}' "
        f"AND gs.trade_date >= current_date() - INTERVAL {days} DAYS "
        f"ORDER BY gs.trade_date"
    )

    if rows and len(rows) > 2:
        gas_prices = [float(r.get("gas_price", 0) or 0) for r in rows]
        elec_prices = [float(r.get("electricity_price", 0) or 0) for r in rows]
        n = len(gas_prices)
        mean_g = sum(gas_prices) / n
        mean_e = sum(elec_prices) / n
        cov = sum((g - mean_g) * (e - mean_e) for g, e in zip(gas_prices, elec_prices)) / n
        std_g = (sum((g - mean_g) ** 2 for g in gas_prices) / n) ** 0.5
        std_e = (sum((e - mean_e) ** 2 for e in elec_prices) / n) ** 0.5
        corr = cov / (std_g * std_e) if std_g > 0 and std_e > 0 else 0
    else:
        corr = 0

    return {
        "region": region,
        "period_days": days,
        "correlation": round(corr, 4),
        "data": [{**r, "trade_date": str(r.get("trade_date", ""))} for r in (rows or [])],
    }
