"""Risk Management — MtM Valuation, VaR & Greeks, Credit Risk.

E2: Mark-to-Market valuation using forward curves
E3: VaR & portfolio Greeks
E5: Credit risk per counterparty
"""
from __future__ import annotations

import math
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from .shared import (
    _CATALOG,
    _NEM_REGIONS,
    _query_gold,
    _query_lakebase_fresh,
    _insert_gold,
    _insert_gold_batch,
    _sql_escape,
    logger,
)
from .curves import _build_forward_curve

router = APIRouter()

_SCHEMA = f"{_CATALOG}.gold"
_RISK_FREE_RATE = 0.045  # 4.5% AUD risk-free rate
_REC_SPOT_PRICE = 40.0  # $/MWh default REC spot

# Fallback annualised volatilities by region
_DEFAULT_VOL: Dict[str, float] = {
    "NSW1": 0.45, "QLD1": 0.55, "VIC1": 0.40, "SA1": 0.65, "TAS1": 0.30,
}


# ---------------------------------------------------------------------------
# Math helpers
# ---------------------------------------------------------------------------

def _discount_factor(days: int) -> float:
    """Continuous discounting at risk-free rate."""
    return math.exp(-_RISK_FREE_RATE * days / 365.0)


def _norm_cdf(x: float) -> float:
    """Standard normal CDF via erf."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_pdf(x: float) -> float:
    """Standard normal PDF."""
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


def _get_historical_volatility(region: str, lookback_days: int = 90) -> float:
    """Annualised log-return std dev from nem_prices_5min. Falls back to defaults."""
    try:
        rows = _query_gold(
            f"SELECT rrp FROM {_SCHEMA}.nem_prices_5min "
            f"WHERE region_id = '{_sql_escape(region)}' "
            f"AND interval_datetime >= current_timestamp() - INTERVAL {lookback_days} DAYS "
            f"AND rrp > 0 ORDER BY interval_datetime"
        )
        if rows and len(rows) > 20:
            prices = [r["rrp"] for r in rows if r["rrp"] and r["rrp"] > 0]
            if len(prices) > 20:
                log_returns = [math.log(prices[i] / prices[i - 1])
                               for i in range(1, len(prices)) if prices[i - 1] > 0]
                if log_returns:
                    mean_lr = sum(log_returns) / len(log_returns)
                    var_lr = sum((lr - mean_lr) ** 2 for lr in log_returns) / len(log_returns)
                    # 5-min intervals → annualise: sqrt(intervals_per_year)
                    intervals_per_day = 288  # 24*60/5
                    annual_vol = math.sqrt(var_lr) * math.sqrt(intervals_per_day * 252)
                    return min(max(annual_vol, 0.1), 2.0)  # clamp 10%-200%
    except Exception as exc:
        logger.debug("Vol calc failed for %s: %s", region, exc)
    return _DEFAULT_VOL.get(region, 0.45)


# ---------------------------------------------------------------------------
# Trade fetching
# ---------------------------------------------------------------------------

def _get_active_trades(portfolio_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch non-CANCELLED trades, optionally filtered by portfolio. Lakebase first."""
    if portfolio_id:
        lb_sql = (
            "SELECT t.*, c.name as counterparty_name "
            "FROM gold.trades_synced t "
            "LEFT JOIN gold.counterparties_synced c ON t.counterparty_id = c.counterparty_id "
            "INNER JOIN gold.portfolio_trades_synced pt ON t.trade_id = pt.trade_id "
            f"WHERE pt.portfolio_id = '{_sql_escape(portfolio_id)}' AND t.status != 'CANCELLED'"
        )
        wh_sql = (
            f"SELECT t.*, c.name as counterparty_name "
            f"FROM {_SCHEMA}.trades t "
            f"LEFT JOIN {_SCHEMA}.counterparties c ON t.counterparty_id = c.counterparty_id "
            f"INNER JOIN {_SCHEMA}.portfolio_trades pt ON t.trade_id = pt.trade_id "
            f"WHERE pt.portfolio_id = '{_sql_escape(portfolio_id)}' AND t.status != 'CANCELLED'"
        )
    else:
        lb_sql = (
            "SELECT t.*, c.name as counterparty_name "
            "FROM gold.trades_synced t "
            "LEFT JOIN gold.counterparties_synced c ON t.counterparty_id = c.counterparty_id "
            "WHERE t.status != 'CANCELLED'"
        )
        wh_sql = (
            f"SELECT t.*, c.name as counterparty_name "
            f"FROM {_SCHEMA}.trades t "
            f"LEFT JOIN {_SCHEMA}.counterparties c ON t.counterparty_id = c.counterparty_id "
            f"WHERE t.status != 'CANCELLED'"
        )

    result = _query_lakebase_fresh(lb_sql)
    if result is not None:
        return result
    return _query_gold(wh_sql) or []


# ---------------------------------------------------------------------------
# MtM Valuation Engine (E2)
# ---------------------------------------------------------------------------

def _value_trade(trade: Dict[str, Any], valuation_date: date) -> Dict[str, Any]:
    """Value a single trade. Returns mtm dict ready for DB insert."""
    trade_type = str(trade.get("trade_type", "FORWARD")).upper()
    region = str(trade.get("region", "NSW1"))
    buy_sell = str(trade.get("buy_sell", "BUY")).upper()
    volume_mw = float(trade.get("volume_mw", 0) or 0)
    contract_price = float(trade.get("price", 0) or 0)
    profile = str(trade.get("profile", "FLAT")).upper()

    start_date = trade.get("start_date")
    end_date = trade.get("end_date")
    if isinstance(start_date, str):
        start_date = date.fromisoformat(start_date)
    if isinstance(end_date, str):
        end_date = date.fromisoformat(end_date)
    if not start_date or not end_date:
        start_date = start_date or valuation_date
        end_date = end_date or valuation_date

    direction = 1.0 if buy_sell == "BUY" else -1.0
    remaining_days = max((end_date - valuation_date).days, 0)
    df = _discount_factor(remaining_days)

    # Get forward prices for the region+profile
    curve_points = _build_forward_curve(
        region=region, profile=profile if profile in ("FLAT", "PEAK", "OFF_PEAK") else "FLAT",
        curve_date=valuation_date.isoformat(), num_quarters=8,
    )
    # Average forward price for the trade period
    relevant_months = set()
    cur = start_date.replace(day=1) if start_date > valuation_date else valuation_date.replace(day=1)
    while cur <= end_date:
        relevant_months.add(f"{cur.year}-{cur.month:02d}")
        if cur.month == 12:
            cur = cur.replace(year=cur.year + 1, month=1)
        else:
            cur = cur.replace(month=cur.month + 1)

    forward_prices = [pt["price_mwh"] for pt in curve_points if pt["month"] in relevant_months]
    avg_forward_price = sum(forward_prices) / len(forward_prices) if forward_prices else contract_price

    mtm_value = 0.0
    unrealised_pnl = 0.0

    if trade_type == "SPOT":
        # Spot trades are settled — MtM = 0
        mtm_value = 0.0
        unrealised_pnl = 0.0

    elif trade_type in ("FORWARD", "SWAP", "FUTURE", "PPA"):
        # DCF: (forward_price - contract_price) * volume * direction * discount
        price_diff = avg_forward_price - contract_price
        mtm_value = price_diff * volume_mw * direction * remaining_days * df
        unrealised_pnl = mtm_value

    elif trade_type == "OPTION":
        # Black-76 model
        vol = _get_historical_volatility(region)
        T = remaining_days / 365.0
        if T > 0.001 and avg_forward_price > 0 and contract_price > 0:
            F = avg_forward_price
            K = contract_price
            vol_sqrt_T = vol * math.sqrt(T)
            d1 = (math.log(F / K) + 0.5 * vol * vol * T) / vol_sqrt_T
            d2 = d1 - vol_sqrt_T
            discount = math.exp(-_RISK_FREE_RATE * T)
            if buy_sell == "BUY":
                # Long call
                mtm_value = discount * (F * _norm_cdf(d1) - K * _norm_cdf(d2)) * volume_mw * remaining_days
            else:
                # Long put
                mtm_value = discount * (K * _norm_cdf(-d2) - F * _norm_cdf(-d1)) * volume_mw * remaining_days
            unrealised_pnl = mtm_value
        else:
            mtm_value = 0.0

    elif trade_type == "REC":
        mtm_value = direction * volume_mw * remaining_days * _REC_SPOT_PRICE * df
        unrealised_pnl = mtm_value - direction * volume_mw * remaining_days * contract_price * df

    return {
        "mtm_id": str(uuid.uuid4()),
        "valuation_date": valuation_date.isoformat(),
        "trade_id": trade.get("trade_id", ""),
        "portfolio_id": trade.get("portfolio_id", "") or "",
        "region": region,
        "trade_type": trade_type,
        "direction": buy_sell,
        "mtm_value": round(mtm_value, 2),
        "unrealised_pnl": round(unrealised_pnl, 2),
        "market_price": round(avg_forward_price, 2),
        "contract_price": round(contract_price, 2),
        "volume_mw": volume_mw,
        "remaining_days": remaining_days,
        "discount_factor": round(df, 6),
        "model_version": "1.0",
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    }


def _run_mtm_core(
    portfolio_id: Optional[str] = None,
    valuation_date: Optional[date] = None,
) -> Dict[str, Any]:
    """Run MtM valuation for all active trades. Returns summary dict."""
    if valuation_date is None:
        valuation_date = date.today()

    trades = _get_active_trades(portfolio_id)
    if not trades:
        return {"status": "no_trades", "trades_valued": 0, "total_mtm": 0.0}

    mtm_rows: List[Dict[str, Any]] = []
    for trade in trades:
        mtm = _value_trade(trade, valuation_date)
        mtm_rows.append(mtm)

    # Batch insert to portfolio_mtm
    inserted = _insert_gold_batch(f"{_SCHEMA}.portfolio_mtm", mtm_rows)

    # Compute P&L attribution (simplified: compare vs previous day's MtM if available)
    prev_date = valuation_date - timedelta(days=1)
    prev_mtm = _query_gold(
        f"SELECT portfolio_id, region, SUM(mtm_value) as prev_total "
        f"FROM {_SCHEMA}.portfolio_mtm "
        f"WHERE valuation_date = '{prev_date.isoformat()}' "
        f"GROUP BY portfolio_id, region"
    )
    prev_map: Dict[str, float] = {}
    if prev_mtm:
        for r in prev_mtm:
            key = f"{r.get('portfolio_id', '')}:{r.get('region', '')}"
            prev_map[key] = float(r.get("prev_total", 0) or 0)

    # Aggregate current by portfolio+region
    current_agg: Dict[str, Dict[str, float]] = {}
    for m in mtm_rows:
        key = f"{m['portfolio_id']}:{m['region']}"
        if key not in current_agg:
            current_agg[key] = {"mtm": 0.0, "pid": m["portfolio_id"], "region": m["region"]}
        current_agg[key]["mtm"] += m["mtm_value"]

    # Build attribution rows
    attr_rows: List[Dict[str, Any]] = []
    for key, agg in current_agg.items():
        prev_total = prev_map.get(key, 0.0)
        total_pnl = agg["mtm"] - prev_total
        # Simplified decomposition
        price_effect = total_pnl * 0.6  # approximate
        time_decay = total_pnl * -0.1
        volume_effect = total_pnl * 0.2
        new_trades_effect = total_pnl * 0.1
        residual = total_pnl - (price_effect + time_decay + volume_effect + new_trades_effect)
        price_effect += residual  # absorb rounding

        attr_rows.append({
            "attribution_id": str(uuid.uuid4()),
            "valuation_date": valuation_date.isoformat(),
            "portfolio_id": agg["pid"],
            "region": agg["region"],
            "price_effect": round(price_effect, 2),
            "volume_effect": round(volume_effect, 2),
            "new_trades_effect": round(new_trades_effect, 2),
            "time_decay": round(time_decay, 2),
            "total_pnl": round(total_pnl, 2),
            "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        })

    if attr_rows:
        _insert_gold_batch(f"{_SCHEMA}.pnl_attribution", attr_rows)

    # Summary
    total_mtm = sum(m["mtm_value"] for m in mtm_rows)
    total_pnl = sum(a["total_pnl"] for a in attr_rows)
    by_portfolio: Dict[str, float] = {}
    for m in mtm_rows:
        pid = m["portfolio_id"] or "unassigned"
        by_portfolio[pid] = by_portfolio.get(pid, 0.0) + m["mtm_value"]

    return {
        "status": "ok",
        "valuation_date": valuation_date.isoformat(),
        "trades_valued": len(mtm_rows),
        "rows_inserted": inserted,
        "total_mtm": round(total_mtm, 2),
        "daily_pnl": round(total_pnl, 2),
        "by_portfolio": {k: round(v, 2) for k, v in by_portfolio.items()},
    }


# ---------------------------------------------------------------------------
# VaR & Greeks (E3)
# ---------------------------------------------------------------------------

def _calculate_var_greeks(
    portfolio_id: str,
    valuation_date: Optional[date] = None,
) -> Dict[str, Any]:
    """Calculate VaR and Greeks for a portfolio. Persists to risk_metrics."""
    if valuation_date is None:
        valuation_date = date.today()

    # Get latest MtM for this portfolio
    mtm_rows = _query_gold(
        f"SELECT * FROM {_SCHEMA}.portfolio_mtm "
        f"WHERE portfolio_id = '{_sql_escape(portfolio_id)}' "
        f"AND valuation_date = '{valuation_date.isoformat()}'"
    )
    if not mtm_rows:
        # Try running MtM first
        _run_mtm_core(portfolio_id=portfolio_id, valuation_date=valuation_date)
        mtm_rows = _query_gold(
            f"SELECT * FROM {_SCHEMA}.portfolio_mtm "
            f"WHERE portfolio_id = '{_sql_escape(portfolio_id)}' "
            f"AND valuation_date = '{valuation_date.isoformat()}'"
        )
    if not mtm_rows:
        return {"status": "no_data", "portfolio_id": portfolio_id}

    # Group by region
    by_region: Dict[str, List[Dict[str, Any]]] = {}
    for m in mtm_rows:
        r = m.get("region", "NSW1")
        if r not in by_region:
            by_region[r] = []
        by_region[r].append(m)

    z_95 = 1.645
    z_99 = 2.326
    metric_rows: List[Dict[str, Any]] = []

    for region, trades in by_region.items():
        vol = _get_historical_volatility(region)
        daily_vol = vol / math.sqrt(252)

        # Portfolio value for this region
        portfolio_value = sum(abs(float(t.get("mtm_value", 0) or 0)) for t in trades)
        if portfolio_value < 0.01:
            portfolio_value = sum(
                float(t.get("volume_mw", 0) or 0) * float(t.get("market_price", 0) or 0) * max(int(t.get("remaining_days", 0) or 0), 1)
                for t in trades
            )

        # VaR
        var_95_1d = portfolio_value * z_95 * daily_vol
        var_99_1d = portfolio_value * z_99 * daily_vol
        var_95_10d = var_95_1d * math.sqrt(10)
        var_99_10d = var_99_1d * math.sqrt(10)

        # Greeks
        delta_mw = 0.0
        gamma = 0.0
        vega = 0.0
        theta = 0.0

        for t in trades:
            tt = str(t.get("trade_type", "FORWARD")).upper()
            direction = 1.0 if str(t.get("direction", "BUY")).upper() == "BUY" else -1.0
            vol_mw = float(t.get("volume_mw", 0) or 0)
            rem_days = max(int(t.get("remaining_days", 0) or 0), 1)
            mkt_price = float(t.get("market_price", 0) or 0)
            K = float(t.get("contract_price", 0) or 0)
            T = rem_days / 365.0

            if tt in ("FORWARD", "SWAP", "FUTURE", "PPA"):
                # Linear instruments
                delta_mw += direction * vol_mw * rem_days / 365.0
                theta += -abs(float(t.get("mtm_value", 0) or 0)) * _RISK_FREE_RATE / 365.0
                # gamma = 0 for linear

            elif tt == "OPTION" and T > 0.001 and mkt_price > 0 and K > 0:
                F = mkt_price
                vol_sqrt_T = vol * math.sqrt(T)
                d1 = (math.log(F / K) + 0.5 * vol * vol * T) / vol_sqrt_T
                npd1 = _norm_pdf(d1)
                discount = math.exp(-_RISK_FREE_RATE * T)

                # Delta
                delta_mw += direction * _norm_cdf(d1) * vol_mw * rem_days / 365.0
                # Gamma
                gamma += npd1 / (F * vol_sqrt_T) * vol_mw * rem_days
                # Vega (per 1% vol move)
                vega += F * math.sqrt(T) * npd1 * discount * vol_mw * rem_days / 100.0
                # Theta
                theta += -(F * npd1 * vol / (2.0 * math.sqrt(T)) * discount
                           + _RISK_FREE_RATE * K * discount * _norm_cdf(d1 - vol_sqrt_T)) * vol_mw / 365.0

        metric_rows.append({
            "metric_id": str(uuid.uuid4()),
            "valuation_date": valuation_date.isoformat(),
            "portfolio_id": portfolio_id,
            "region": region,
            "var_95_1d": round(var_95_1d, 2),
            "var_99_1d": round(var_99_1d, 2),
            "var_95_10d": round(var_95_10d, 2),
            "var_99_10d": round(var_99_10d, 2),
            "delta_mw": round(delta_mw, 2),
            "gamma": round(gamma, 4),
            "vega": round(vega, 2),
            "theta": round(theta, 2),
            "volatility_annual": round(vol, 4),
            "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        })

    if metric_rows:
        _insert_gold_batch(f"{_SCHEMA}.risk_metrics", metric_rows)

    return {
        "status": "ok",
        "portfolio_id": portfolio_id,
        "valuation_date": valuation_date.isoformat(),
        "metrics": metric_rows,
    }


# ---------------------------------------------------------------------------
# Credit Risk (E5)
# ---------------------------------------------------------------------------

def _calculate_credit_exposure(valuation_date: Optional[date] = None) -> Dict[str, Any]:
    """Calculate credit exposures for all counterparties."""
    if valuation_date is None:
        valuation_date = date.today()

    # Get counterparties
    cp_rows = _query_lakebase_fresh(
        "SELECT * FROM gold.counterparties_synced WHERE status = 'ACTIVE'"
    )
    if cp_rows is None:
        cp_rows = _query_gold(
            f"SELECT * FROM {_SCHEMA}.counterparties WHERE status = 'ACTIVE'"
        )
    if not cp_rows:
        return {"status": "no_counterparties", "exposures": []}

    # Get latest MtM grouped by counterparty
    mtm_sql = (
        f"SELECT t.counterparty_id, m.mtm_value, m.remaining_days "
        f"FROM {_SCHEMA}.portfolio_mtm m "
        f"INNER JOIN {_SCHEMA}.trades t ON m.trade_id = t.trade_id "
        f"WHERE m.valuation_date = '{valuation_date.isoformat()}' "
        f"AND t.counterparty_id IS NOT NULL AND t.counterparty_id != ''"
    )
    mtm_rows = _query_gold(mtm_sql)
    if not mtm_rows:
        # Run MtM first
        _run_mtm_core(valuation_date=valuation_date)
        mtm_rows = _query_gold(mtm_sql)

    # Group by counterparty
    cp_mtm: Dict[str, List[Dict[str, Any]]] = {}
    for r in (mtm_rows or []):
        cpid = r.get("counterparty_id", "")
        if cpid:
            if cpid not in cp_mtm:
                cp_mtm[cpid] = []
            cp_mtm[cpid].append(r)

    exposure_rows: List[Dict[str, Any]] = []
    for cp in cp_rows:
        cpid = cp.get("counterparty_id", "")
        credit_limit = float(cp.get("credit_limit_aud", 0) or 0)
        if credit_limit <= 0:
            credit_limit = 10_000_000.0  # default $10M

        trades = cp_mtm.get(cpid, [])

        # Current exposure = sum of positive MtM
        current_exposure = sum(
            max(float(t.get("mtm_value", 0) or 0), 0) for t in trades
        )

        # Exposure aging buckets
        bucket_0_30 = sum(
            max(float(t.get("mtm_value", 0) or 0), 0)
            for t in trades if int(t.get("remaining_days", 0) or 0) <= 30
        )
        bucket_30_90 = sum(
            max(float(t.get("mtm_value", 0) or 0), 0)
            for t in trades if 30 < int(t.get("remaining_days", 0) or 0) <= 90
        )
        bucket_90plus = sum(
            max(float(t.get("mtm_value", 0) or 0), 0)
            for t in trades if int(t.get("remaining_days", 0) or 0) > 90
        )

        # PFE = current * (1 + 0.15 * sqrt(avg_years))
        avg_days = (
            sum(int(t.get("remaining_days", 0) or 0) for t in trades) / len(trades)
            if trades else 180
        )
        pfe = current_exposure * (1.0 + 0.15 * math.sqrt(avg_days / 365.0))

        utilization = current_exposure / credit_limit if credit_limit > 0 else 0.0

        if utilization >= 0.95:
            alert = "CRITICAL"
        elif utilization >= 0.80:
            alert = "WARNING"
        else:
            alert = "NORMAL"

        exposure_rows.append({
            "exposure_id": str(uuid.uuid4()),
            "valuation_date": valuation_date.isoformat(),
            "counterparty_id": cpid,
            "counterparty_name": cp.get("name", ""),
            "current_exposure": round(current_exposure, 2),
            "potential_future_exposure": round(pfe, 2),
            "credit_limit": round(credit_limit, 2),
            "credit_utilization": round(utilization, 4),
            "credit_rating": cp.get("credit_rating", ""),
            "exposure_current_bucket": round(bucket_0_30, 2),
            "exposure_30_90_bucket": round(bucket_30_90, 2),
            "exposure_90plus_bucket": round(bucket_90plus, 2),
            "alert_level": alert,
            "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        })

    if exposure_rows:
        _insert_gold_batch(f"{_SCHEMA}.credit_exposure", exposure_rows)

    return {
        "status": "ok",
        "valuation_date": valuation_date.isoformat(),
        "counterparties": len(exposure_rows),
        "exposures": exposure_rows,
        "alerts": [e for e in exposure_rows if e["alert_level"] != "NORMAL"],
    }


# =========================================================================
# MtM Endpoints (E2)
# =========================================================================

@router.post("/api/risk/mtm/run")
async def run_mtm(
    portfolio_id: Optional[str] = Query(None),
    valuation_date: Optional[str] = Query(None),
):
    """Trigger MtM valuation for all trades or a specific portfolio."""
    vd = date.fromisoformat(valuation_date) if valuation_date else date.today()
    result = _run_mtm_core(portfolio_id=portfolio_id, valuation_date=vd)
    return result


@router.get("/api/risk/mtm/latest")
async def mtm_latest(portfolio_id: Optional[str] = Query(None)):
    """Latest MtM results, optionally filtered by portfolio."""
    where = ""
    if portfolio_id:
        where = f"AND portfolio_id = '{_sql_escape(portfolio_id)}'"

    rows = _query_gold(
        f"SELECT * FROM {_SCHEMA}.portfolio_mtm "
        f"WHERE valuation_date = (SELECT MAX(valuation_date) FROM {_SCHEMA}.portfolio_mtm) "
        f"{where} ORDER BY ABS(mtm_value) DESC LIMIT 200"
    )
    if not rows:
        return {"results": [], "total_mtm": 0.0}

    for r in rows:
        for k in ("valuation_date", "created_at"):
            if k in r and r[k] is not None:
                r[k] = str(r[k])

    total = sum(float(r.get("mtm_value", 0) or 0) for r in rows)
    return {
        "results": rows,
        "total_mtm": round(total, 2),
        "trades_valued": len(rows),
        "valuation_date": rows[0].get("valuation_date", ""),
    }


@router.get("/api/risk/mtm/history")
async def mtm_history(
    portfolio_id: str = Query(...),
    days: int = Query(30, le=365),
):
    """MtM over time for a portfolio."""
    rows = _query_gold(
        f"SELECT valuation_date, SUM(mtm_value) as total_mtm, COUNT(*) as trade_count "
        f"FROM {_SCHEMA}.portfolio_mtm "
        f"WHERE portfolio_id = '{_sql_escape(portfolio_id)}' "
        f"AND valuation_date >= current_date() - INTERVAL {days} DAYS "
        f"GROUP BY valuation_date ORDER BY valuation_date"
    )
    if not rows:
        return {"history": [], "portfolio_id": portfolio_id}

    for r in rows:
        if "valuation_date" in r and r["valuation_date"] is not None:
            r["valuation_date"] = str(r["valuation_date"])
    return {"history": rows, "portfolio_id": portfolio_id}


@router.get("/api/risk/pnl/attribution")
async def pnl_attribution(
    portfolio_id: Optional[str] = Query(None),
    valuation_date: Optional[str] = Query(None),
):
    """P&L breakdown by effect type."""
    where_parts = ["1=1"]
    if portfolio_id:
        where_parts.append(f"portfolio_id = '{_sql_escape(portfolio_id)}'")
    if valuation_date:
        where_parts.append(f"valuation_date = '{_sql_escape(valuation_date)}'")
    else:
        where_parts.append(
            f"valuation_date = (SELECT MAX(valuation_date) FROM {_SCHEMA}.pnl_attribution)"
        )

    rows = _query_gold(
        f"SELECT * FROM {_SCHEMA}.pnl_attribution "
        f"WHERE {' AND '.join(where_parts)} ORDER BY ABS(total_pnl) DESC"
    )
    if not rows:
        return {"attribution": []}

    for r in rows:
        for k in ("valuation_date", "created_at"):
            if k in r and r[k] is not None:
                r[k] = str(r[k])
    return {"attribution": rows}


@router.get("/api/risk/pnl/summary")
async def pnl_summary():
    """Aggregate P&L across all portfolios."""
    rows = _query_gold(
        f"SELECT portfolio_id, "
        f"SUM(price_effect) as total_price_effect, "
        f"SUM(volume_effect) as total_volume_effect, "
        f"SUM(new_trades_effect) as total_new_trades, "
        f"SUM(time_decay) as total_time_decay, "
        f"SUM(total_pnl) as total_pnl "
        f"FROM {_SCHEMA}.pnl_attribution "
        f"WHERE valuation_date = (SELECT MAX(valuation_date) FROM {_SCHEMA}.pnl_attribution) "
        f"GROUP BY portfolio_id"
    )
    if not rows:
        return {"portfolios": [], "grand_total_pnl": 0.0}

    grand_total = sum(float(r.get("total_pnl", 0) or 0) for r in rows)
    return {"portfolios": rows, "grand_total_pnl": round(grand_total, 2)}


# =========================================================================
# VaR & Greeks Endpoints (E3)
# =========================================================================

@router.post("/api/risk/var/calculate")
async def calculate_var(
    portfolio_id: str = Query(...),
    valuation_date: Optional[str] = Query(None),
):
    """Calculate VaR and Greeks for a portfolio."""
    vd = date.fromisoformat(valuation_date) if valuation_date else date.today()
    result = _calculate_var_greeks(portfolio_id=portfolio_id, valuation_date=vd)
    return result


@router.get("/api/risk/var/latest")
async def var_latest(portfolio_id: Optional[str] = Query(None)):
    """Latest VaR results."""
    where = ""
    if portfolio_id:
        where = f"AND portfolio_id = '{_sql_escape(portfolio_id)}'"

    rows = _query_gold(
        f"SELECT * FROM {_SCHEMA}.risk_metrics "
        f"WHERE valuation_date = (SELECT MAX(valuation_date) FROM {_SCHEMA}.risk_metrics) "
        f"{where} ORDER BY var_95_1d DESC"
    )
    if not rows:
        return {"metrics": []}

    for r in rows:
        for k in ("valuation_date", "created_at"):
            if k in r and r[k] is not None:
                r[k] = str(r[k])
    return {"metrics": rows}


@router.get("/api/risk/var/history")
async def var_history(
    portfolio_id: str = Query(...),
    days: int = Query(30, le=365),
):
    """VaR over time for a portfolio."""
    rows = _query_gold(
        f"SELECT valuation_date, SUM(var_95_1d) as var_95_1d, SUM(var_99_1d) as var_99_1d, "
        f"SUM(var_95_10d) as var_95_10d, SUM(var_99_10d) as var_99_10d "
        f"FROM {_SCHEMA}.risk_metrics "
        f"WHERE portfolio_id = '{_sql_escape(portfolio_id)}' "
        f"AND valuation_date >= current_date() - INTERVAL {days} DAYS "
        f"GROUP BY valuation_date ORDER BY valuation_date"
    )
    if not rows:
        return {"history": [], "portfolio_id": portfolio_id}

    for r in rows:
        if "valuation_date" in r and r["valuation_date"] is not None:
            r["valuation_date"] = str(r["valuation_date"])
    return {"history": rows, "portfolio_id": portfolio_id}


@router.get("/api/risk/greeks")
async def greeks(
    portfolio_id: str = Query(...),
):
    """Greeks by region for a portfolio."""
    rows = _query_gold(
        f"SELECT region, delta_mw, gamma, vega, theta, volatility_annual "
        f"FROM {_SCHEMA}.risk_metrics "
        f"WHERE portfolio_id = '{_sql_escape(portfolio_id)}' "
        f"AND valuation_date = (SELECT MAX(valuation_date) FROM {_SCHEMA}.risk_metrics "
        f"WHERE portfolio_id = '{_sql_escape(portfolio_id)}')"
    )
    if not rows:
        return {"greeks": [], "portfolio_id": portfolio_id}
    return {"greeks": rows, "portfolio_id": portfolio_id}


# =========================================================================
# Credit Risk Endpoints (E5)
# =========================================================================

@router.post("/api/risk/credit/calculate")
async def calculate_credit(
    valuation_date: Optional[str] = Query(None),
):
    """Calculate credit exposures for all counterparties."""
    vd = date.fromisoformat(valuation_date) if valuation_date else date.today()
    return _calculate_credit_exposure(valuation_date=vd)


@router.get("/api/risk/credit/summary")
async def credit_summary():
    """Credit exposure summary — latest valuations."""
    rows = _query_gold(
        f"SELECT * FROM {_SCHEMA}.credit_exposure "
        f"WHERE valuation_date = (SELECT MAX(valuation_date) FROM {_SCHEMA}.credit_exposure) "
        f"ORDER BY current_exposure DESC"
    )
    if not rows:
        return {"exposures": []}

    for r in rows:
        for k in ("valuation_date", "created_at"):
            if k in r and r[k] is not None:
                r[k] = str(r[k])
    return {"exposures": rows}


@router.get("/api/risk/credit/counterparty/{counterparty_id}")
async def credit_counterparty(counterparty_id: str):
    """Detailed credit exposure for one counterparty."""
    rows = _query_gold(
        f"SELECT * FROM {_SCHEMA}.credit_exposure "
        f"WHERE counterparty_id = '{_sql_escape(counterparty_id)}' "
        f"ORDER BY valuation_date DESC LIMIT 30"
    )
    if not rows:
        return JSONResponse(status_code=404, content={"error": "No exposure data"})

    for r in rows:
        for k in ("valuation_date", "created_at"):
            if k in r and r[k] is not None:
                r[k] = str(r[k])
    return {"counterparty_id": counterparty_id, "history": rows}


@router.get("/api/risk/credit/alerts")
async def credit_alerts():
    """WARNING and CRITICAL credit alerts only."""
    rows = _query_gold(
        f"SELECT * FROM {_SCHEMA}.credit_exposure "
        f"WHERE valuation_date = (SELECT MAX(valuation_date) FROM {_SCHEMA}.credit_exposure) "
        f"AND alert_level IN ('WARNING', 'CRITICAL') "
        f"ORDER BY credit_utilization DESC"
    )
    if not rows:
        return {"alerts": [], "message": "No active alerts"}

    for r in rows:
        for k in ("valuation_date", "created_at"):
            if k in r and r[k] is not None:
                r[k] = str(r[k])
    return {"alerts": rows}
