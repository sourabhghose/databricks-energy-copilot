# ============================================================
# AUS Energy Copilot — Mock data for local development
# ============================================================
# Used when DATABRICKS_HOST is not set in the environment.
# All values are plausible for the Australian NEM but are
# SYNTHETIC — never use these for real market decisions.
# ============================================================

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

# ---------------------------------------------------------------------------
# Baseline values per region (AUD/MWh)
# ---------------------------------------------------------------------------
_BASELINE_PRICE: Dict[str, float] = {
    "NSW1": 85.0,
    "QLD1": 78.0,
    "VIC1": 92.0,
    "SA1":  105.0,
    "TAS1": 71.0,
}

_BASELINE_DEMAND_MW: Dict[str, float] = {
    "NSW1": 8400.0,
    "QLD1": 6200.0,
    "VIC1": 5800.0,
    "SA1":  1650.0,
    "TAS1": 1050.0,
}

# Realistic fuel-mix fractions per region (must sum to 1.0 within region)
_FUEL_MIX: Dict[str, Dict[str, float]] = {
    "NSW1": {"BLACK_COAL": 0.58, "GAS_CCGT": 0.10, "HYDRO": 0.08, "SOLAR": 0.12, "WIND": 0.07, "BATTERY": 0.03, "BIOMASS": 0.02},
    "QLD1": {"BLACK_COAL": 0.52, "GAS_CCGT": 0.11, "GAS_OCGT": 0.04, "HYDRO": 0.03, "SOLAR": 0.24, "WIND": 0.04, "BATTERY": 0.02},
    "VIC1": {"BROWN_COAL": 0.42, "GAS_CCGT": 0.08, "GAS_OCGT": 0.03, "HYDRO": 0.04, "SOLAR": 0.10, "WIND": 0.28, "BATTERY": 0.05},
    "SA1":  {"GAS_CCGT": 0.20, "GAS_OCGT": 0.08, "SOLAR": 0.30, "WIND": 0.38, "BATTERY": 0.04},
    "TAS1": {"HYDRO": 0.82, "WIND": 0.14, "GAS_OCGT": 0.02, "SOLAR": 0.02},
}

# Interconnectors: (from_region, to_region, typical_flow_mw, export_limit, import_limit)
_INTERCONNECTORS = [
    ("VIC1-NSW1",  "VIC1", "NSW1", 300.0,  1600.0, 1350.0),
    ("NSW1-QLD1",  "NSW1", "QLD1", -250.0,  600.0,  1078.0),
    ("VIC1-SA1",   "VIC1", "SA1",  150.0,   600.0,   490.0),
    ("VIC1-TAS1",  "VIC1", "TAS1", -180.0,  594.0,   478.0),
    ("NSW1-VIC1",  "NSW1", "VIC1", -300.0, 1350.0,  1600.0),  # alias perspective
]


def _noise(pct: float = 0.05) -> float:
    """Return a multiplicative noise factor: 1.0 ± pct."""
    return 1.0 + random.uniform(-pct, pct)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _floor_5min(dt: datetime) -> datetime:
    """Floor a datetime to the nearest 5-minute boundary."""
    return dt.replace(second=0, microsecond=0, minute=(dt.minute // 5) * 5)


# ---------------------------------------------------------------------------
# Public mock generators
# ---------------------------------------------------------------------------

def get_mock_latest_prices(region: str | None = None) -> List[Dict[str, Any]]:
    """
    Return one RegionPrice dict per NEM region (or just the requested region),
    with ±5% random noise on the baseline price.
    """
    now = _floor_5min(_utcnow())
    regions = [region] if region else list(_BASELINE_PRICE.keys())
    rows: List[Dict[str, Any]] = []
    for r in regions:
        base = _BASELINE_PRICE[r]
        rrp  = round(base * _noise(0.05), 2)
        rows.append({
            "region":          r,
            "settlement_date": now.isoformat(),
            "rrp":             rrp,
            "raise_reg_rrp":   round(random.uniform(8.0, 18.0), 2),
            "lower_reg_rrp":   round(random.uniform(4.0, 12.0), 2),
            "total_demand":    round(_BASELINE_DEMAND_MW[r] * _noise(0.03), 1),
        })
    return rows


def get_mock_price_history(
    region: str,
    hours: int = 24,
    start: str | None = None,
    end: str | None = None,
) -> List[Dict[str, Any]]:
    """
    Return 5-minute price history as a sine-wave with ±10% noise.
    If start/end are provided they take precedence over hours.
    """
    base = _BASELINE_PRICE.get(region, 85.0)
    demand_base = _BASELINE_DEMAND_MW.get(region, 5000.0)

    if start and end:
        t_start = datetime.fromisoformat(start.replace("Z", "+00:00"))
        t_end   = datetime.fromisoformat(end.replace("Z", "+00:00"))
    else:
        t_end   = _floor_5min(_utcnow())
        t_start = t_end - timedelta(hours=hours)

    rows: List[Dict[str, Any]] = []
    current = t_start
    while current <= t_end:
        # Sine wave: morning & evening peaks, overnight trough
        hour_frac = current.hour + current.minute / 60.0
        sine_factor = 1.0 + 0.25 * math.sin(math.pi * (hour_frac - 6) / 12)
        rrp = round(base * sine_factor * _noise(0.10), 2)
        demand = round(demand_base * sine_factor * _noise(0.03), 1)
        rows.append({
            "region":          region,
            "settlement_date": current.isoformat(),
            "rrp":             rrp,
            "raise_reg_rrp":   round(random.uniform(8.0, 18.0), 2),
            "lower_reg_rrp":   round(random.uniform(4.0, 12.0), 2),
            "total_demand":    demand,
        })
        current += timedelta(minutes=5)
    return rows


def get_mock_forecasts(
    region: str,
    horizon: str = "24h",
    start: str | None = None,
) -> List[Dict[str, Any]]:
    """
    Return forecast points with 10% confidence bands and p10/p90 CI fields.
    Points are spaced 30 minutes apart for all horizons.
    CI band width scales with sqrt(horizon_hours / 24).
    """
    base = _BASELINE_PRICE.get(region, 85.0)
    demand_base = _BASELINE_DEMAND_MW.get(region, 5000.0)

    horizon_hours_map = {
        "30min": 0.5,
        "1h":    1.0,
        "1hr":   1.0,
        "4h":    4.0,
        "4hr":   4.0,
        "24h":   24.0,
        "24hr":  24.0,
        "7d":    168.0,
    }
    total_horizon_hours = horizon_hours_map.get(horizon, 24.0)

    t_start = _floor_5min(_utcnow()) if not start else datetime.fromisoformat(start.replace("Z", "+00:00"))
    t_end   = t_start + timedelta(hours=total_horizon_hours)

    rows: List[Dict[str, Any]] = []
    current = t_start
    interval_minutes = 30
    while current <= t_end:
        hour_frac  = current.hour + current.minute / 60.0
        sine_factor = 1.0 + 0.20 * math.sin(math.pi * (hour_frac - 6) / 12)
        predicted  = round(base * sine_factor * _noise(0.05), 2)
        # Legacy confidence band (widens with forecast distance)
        minutes_ahead = max(0, (current - t_start).total_seconds() / 60)
        band = round(predicted * 0.08 * (1 + minutes_ahead / 720), 2)
        # Demand forecast (sine-wave with noise)
        demand_forecast = round(demand_base * sine_factor * _noise(0.03), 1)
        # Horizon-scaled CI using sqrt(horizon_hours / 24)
        horizon_hours = minutes_ahead / 60.0
        sqrt_factor = math.sqrt(max(horizon_hours, 0.0) / 24.0) if horizon_hours > 0 else 0.0
        price_p10 = round(predicted * (1 - 0.08 * sqrt_factor), 2)
        price_p90 = round(predicted * (1 + 0.12 * sqrt_factor), 2)
        demand_p10 = round(demand_forecast * (1 - 0.04 * sqrt_factor), 1)
        demand_p90 = round(demand_forecast * (1 + 0.06 * sqrt_factor), 1)
        forecast_confidence = round(max(0.4, 1.0 - 0.06 * horizon_hours), 4)
        rows.append({
            "region":              region,
            "forecast_time":       current.isoformat(),
            "horizon_minutes":     int(minutes_ahead),
            "predicted_rrp":       predicted,
            "lower_bound":         round(predicted - band, 2),
            "upper_bound":         round(predicted + band, 2),
            "price_p10":           price_p10,
            "price_p90":           price_p90,
            "demand_p10":          demand_p10,
            "demand_p90":          demand_p90,
            "forecast_confidence": forecast_confidence,
        })
        current += timedelta(minutes=interval_minutes)
    return rows


def get_mock_generation(
    region: str,
    start: str | None = None,
    end: str | None = None,
) -> List[Dict[str, Any]]:
    """
    Return generation mix rows for the last dispatch interval (or a range).
    Each fuel type for the region gets one row per 5-minute interval.
    """
    fuel_mix  = _FUEL_MIX.get(region, _FUEL_MIX["NSW1"])
    total_mw  = _BASELINE_DEMAND_MW.get(region, 5000.0) * _noise(0.03)

    if start and end:
        t_start = datetime.fromisoformat(start.replace("Z", "+00:00"))
        t_end   = datetime.fromisoformat(end.replace("Z", "+00:00"))
    else:
        t_now   = _floor_5min(_utcnow())
        t_start = t_now
        t_end   = t_now

    rows: List[Dict[str, Any]] = []
    current = t_start
    while current <= t_end:
        hour_frac   = current.hour + current.minute / 60.0
        load_factor = 0.75 + 0.25 * math.sin(math.pi * (hour_frac - 6) / 12)
        interval_total = total_mw * load_factor
        for fuel, fraction in fuel_mix.items():
            gen_mw = round(interval_total * fraction * _noise(0.04), 1)
            rows.append({
                "region":          region,
                "settlement_date": current.isoformat(),
                "fuel_type":       fuel,
                "generation_mw":   gen_mw,
            })
        current += timedelta(minutes=5)
    return rows


def get_mock_interconnectors(
    interconnector_id: str | None = None,
) -> List[Dict[str, Any]]:
    """
    Return current interconnector flow rows.
    """
    now = _floor_5min(_utcnow())
    rows: List[Dict[str, Any]] = []
    for ic_id, from_r, to_r, base_flow, export_lim, import_lim in _INTERCONNECTORS:
        if interconnector_id and ic_id != interconnector_id:
            continue
        flow = round(base_flow * _noise(0.15), 1)
        rows.append({
            "interconnector_id": ic_id,
            "settlement_date":   now.isoformat(),
            "mw_flow":           flow,
            "export_limit":      export_lim,
            "import_limit":      import_lim,
        })
    return rows


def get_mock_alerts() -> List[Dict[str, Any]]:
    """
    Return a small list of example alert configurations.
    """
    now = _utcnow()
    return [
        {
            "alert_id":        "mock-alert-001",
            "region":          "NSW1",
            "alert_type":      "price_threshold",
            "threshold_value": 300.0,
            "notification_channel": "email",
            "is_active":       True,
            "created_at":      (now - timedelta(days=3)).isoformat(),
            "updated_at":      (now - timedelta(days=3)).isoformat(),
        },
        {
            "alert_id":        "mock-alert-002",
            "region":          "SA1",
            "alert_type":      "price_threshold",
            "threshold_value": 500.0,
            "notification_channel": "slack",
            "is_active":       True,
            "created_at":      (now - timedelta(days=1)).isoformat(),
            "updated_at":      (now - timedelta(days=1)).isoformat(),
        },
        {
            "alert_id":        "mock-alert-003",
            "region":          None,
            "alert_type":      "data_staleness",
            "threshold_value": 10.0,
            "notification_channel": "email",
            "is_active":       False,
            "created_at":      (now - timedelta(days=7)).isoformat(),
            "updated_at":      (now - timedelta(days=2)).isoformat(),
        },
    ]


def get_mock_fcas(
    region: str,
    service: str | None = None,
    start: str | None = None,
    end: str | None = None,
) -> List[Dict[str, Any]]:
    """
    Return mock FCAS price rows with plausible values per service type.
    """
    _FCAS_SERVICES = {
        "RAISE6SEC":  (8.0,  18.0),
        "RAISE60SEC": (4.0,  12.0),
        "RAISE5MIN":  (2.0,   8.0),
        "RAISEREG":   (5.0,  15.0),
        "LOWER6SEC":  (0.5,   3.0),
        "LOWER60SEC": (0.3,   2.5),
        "LOWER5MIN":  (0.2,   2.0),
        "LOWERREG":   (1.0,   6.0),
    }

    services = [service] if service else list(_FCAS_SERVICES.keys())

    if start and end:
        t_start = datetime.fromisoformat(start.replace("Z", "+00:00"))
        t_end   = datetime.fromisoformat(end.replace("Z", "+00:00"))
    else:
        t_now   = _floor_5min(_utcnow())
        t_start = t_now - timedelta(hours=1)
        t_end   = t_now

    rows: List[Dict[str, Any]] = []
    current = t_start
    while current <= t_end:
        for svc in services:
            lo, hi = _FCAS_SERVICES.get(svc, (1.0, 10.0))
            rows.append({
                "region":          region,
                "settlement_date": current.isoformat(),
                "service":         svc,
                "rrp":             round(random.uniform(lo, hi), 2),
            })
        current += timedelta(minutes=5)
    return rows
