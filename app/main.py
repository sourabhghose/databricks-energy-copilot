# ============================================================
# AUS Energy Copilot — Slim FastAPI Backend (Databricks Apps)
# ============================================================
# Standalone deployment entry point that does NOT import from
# backend.main (127K lines — too large for the Apps container).
#
# Includes: health check + ~10 representative dashboard endpoints
# with inline mock data, plus SPA static file serving.
#
# Run locally:  uvicorn main:app --reload --port 8000
# ============================================================

from __future__ import annotations

import json
import logging
import math
import os
import random
import random as _r
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone, timedelta, date
from datetime import datetime as _dt, timedelta as _td
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Structured JSON logging
# ---------------------------------------------------------------------------

class _JsonFormatter(logging.Formatter):
    _SKIP = frozenset({
        "msg", "args", "levelname", "levelno", "pathname", "filename",
        "module", "exc_info", "exc_text", "stack_info", "lineno",
        "funcName", "created", "msecs", "relativeCreated", "thread",
        "threadName", "processName", "process", "message", "name", "taskName",
    })

    def format(self, record: logging.LogRecord) -> str:
        obj: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level":     record.levelname,
            "message":   record.getMessage(),
            "module":    record.module,
        }
        if record.exc_info:
            obj["exception"] = self.formatException(record.exc_info)
        for k, v in record.__dict__.items():
            if k not in self._SKIP:
                obj[k] = v
        return json.dumps(obj, default=str)


def _configure_logging(level: str = "INFO") -> logging.Logger:
    lg = logging.getLogger("energy_copilot")
    if not lg.handlers:
        h = logging.StreamHandler()
        h.setFormatter(_JsonFormatter())
        lg.addHandler(h)
    lg.setLevel(getattr(logging, level.upper(), logging.INFO))
    lg.propagate = False
    return lg


logger = _configure_logging(os.environ.get("LOG_LEVEL", "INFO"))

# ---------------------------------------------------------------------------
# Environment / config
# ---------------------------------------------------------------------------
ALLOW_ORIGINS: List[str] = os.getenv("ALLOW_ORIGINS", "*").split(",")
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "60"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
_rate_limit_store: dict[str, list[float]] = defaultdict(list)

# ---------------------------------------------------------------------------
# Simple in-memory TTL cache
# ---------------------------------------------------------------------------
_cache: Dict[str, Dict[str, Any]] = {}


def _cache_get(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if entry is None:
        return None
    if time.monotonic() > entry["expires_at"]:
        del _cache[key]
        return None
    return entry["data"]


def _cache_set(key: str, data: Any, ttl_seconds: float = 3600.0) -> None:
    _cache[key] = {"data": data, "expires_at": time.monotonic() + ttl_seconds}


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AUS Energy Copilot API",
    description=(
        "## AUS Energy Copilot — NEM Market Intelligence API\n\n"
        "Real-time Australian electricity market data, ML forecasts, and AI-powered analytics.\n\n"
        "This is the slim deployment build for Databricks Apps."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "Health", "description": "Service health and readiness checks"},
        {"name": "Market Data", "description": "Real-time NEM prices, generation, and interconnector data"},
        {"name": "Grid Operations", "description": "Power system security, frequency, and inertia data"},
        {"name": "Renewable Energy", "description": "Curtailment, DER, and sustainability analytics"},
        {"name": "Battery Storage", "description": "Battery economics and arbitrage analytics"},
        {"name": "Gas Market", "description": "Eastern Australian gas market data"},
        {"name": "Retail Market", "description": "Retail competition and customer analytics"},
        {"name": "Demand Response", "description": "RERT contracts and demand response activations"},
        {"name": "Carbon & Emissions", "description": "NEM carbon intensity and emissions tracking"},
        {"name": "Cyber Security", "description": "Energy sector cyber security analytics"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Middleware — rate limiting
# ---------------------------------------------------------------------------

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS
    _rate_limit_store[client_ip] = [t for t in _rate_limit_store[client_ip] if t > window_start]
    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
        return JSONResponse(
            status_code=429,
            content={"error": "rate_limit_exceeded", "retry_after_seconds": RATE_LIMIT_WINDOW_SECONDS},
        )
    _rate_limit_store[client_ip].append(now)
    return await call_next(request)

# ---------------------------------------------------------------------------
# Middleware — structured request logging + request ID
# ---------------------------------------------------------------------------

@app.middleware("http")
async def _logging_middleware(request: Request, call_next) -> Response:
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    t0 = time.monotonic()
    response: Response = await call_next(request)
    duration_ms = round((time.monotonic() - t0) * 1000, 1)
    logger.info(
        "http_request",
        extra={
            "request_id":  request_id,
            "method":      request.method,
            "path":        request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    response.headers["X-Request-ID"] = request_id
    return response

# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def _global_exc_handler(request: Request, exc: Exception):
    logger.exception("unhandled_exception", extra={"path": request.url.path})
    return JSONResponse(status_code=500, content={"error": "internal_server_error"})


# =========================================================================
# 1. HEALTH CHECK
# =========================================================================

@app.get("/health", summary="Service health", tags=["Health"])
async def health():
    """Return service health status."""
    sql_ok = _get_sql_connection() is not None
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mock_mode": not sql_ok,
        "sql_connected": sql_ok,
        "deployment": "slim",
        "databricks_healthy": True,
        "lakebase_healthy": True,
    }


@app.get("/api/health", summary="API health check", tags=["Health"])
async def api_health():
    """Return API health status — primary health endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mock_mode": True,
        "deployment": "slim",
    }


@app.get("/api/system/health", summary="System health for monitoring dashboard", tags=["Health"])
async def system_health():
    """Return SystemHealthResponse matching the Monitoring page interface."""
    sql_ok = _get_sql_connection() is not None
    now = datetime.now(timezone.utc)

    # Check data freshness from gold table
    freshness_minutes = None
    pipeline_last_run = None
    if sql_ok:
        rows = _query_gold(f"""
            SELECT MAX(interval_datetime) AS latest
            FROM {_CATALOG}.gold.nem_prices_5min
        """)
        if rows and rows[0].get("latest"):
            latest = rows[0]["latest"]
            if hasattr(latest, 'isoformat'):
                pipeline_last_run = latest.isoformat()
                delta = (now - latest.replace(tzinfo=timezone.utc) if latest.tzinfo is None else now - latest)
                freshness_minutes = round(delta.total_seconds() / 60, 1)

    # Build model details for the 21 models (5 regions × 4 forecast types + 1 anomaly)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    model_types = ["price_forecast", "demand_forecast", "wind_forecast", "solar_forecast"]
    model_details = []
    for mt in model_types:
        for region in regions:
            model_details.append({
                "model_name": mt,
                "region": region,
                "alias": "production",
                "model_version": "1",
                "last_updated": (now - timedelta(hours=1)).isoformat(),
                "status": "ok" if sql_ok else "stale",
            })
    # Anomaly detection model (NEM-wide)
    model_details.append({
        "model_name": "anomaly_detection",
        "region": "NEM",
        "alias": "production",
        "model_version": "1",
        "last_updated": (now - timedelta(hours=1)).isoformat(),
        "status": "ok" if sql_ok else "stale",
    })

    models_healthy = sum(1 for m in model_details if m["status"] == "ok")

    return {
        "timestamp": now.isoformat(),
        "databricks_ok": sql_ok,
        "lakebase_ok": True,
        "models_healthy": models_healthy,
        "models_total": len(model_details),
        "pipeline_last_run": pipeline_last_run or (now - timedelta(minutes=5)).isoformat(),
        "data_freshness_minutes": freshness_minutes if freshness_minutes is not None else 5.0,
        "model_details": model_details,
    }


@app.get("/api/version", tags=["Health"], summary="API version info")
def get_version():
    """Return API version, build info, and feature flags."""
    return {
        "version": "1.0.0",
        "api_auth_enabled": False,
        "mock_mode": True,
        "deployment": "slim",
        "rate_limit_requests_per_minute": RATE_LIMIT_REQUESTS,
    }


# =========================================================================
# 2. NEM REAL-TIME DASHBOARD (main overview)
# =========================================================================

class RegionalDispatch(BaseModel):
    region: str
    dispatch_price_aud_mwh: float
    predispatch_price_aud_mwh: float
    demand_mw: float
    generation_mw: float
    net_interchange_mw: float
    rrp_band: str
    renewable_pct: float
    scheduled_gen_mw: float
    semi_sched_gen_mw: float


class NemGenMixRecord(BaseModel):
    region: str
    fuel_type: str
    registered_capacity_mw: float
    available_mw: float
    dispatch_mw: float
    capacity_factor_pct: float
    marginal_cost_aud_mwh: float


class NemIcFlowRecord(BaseModel):
    interconnector_id: str
    from_region: str
    to_region: str
    mw_flow: float
    mw_limit: float
    loading_pct: float
    losses_mw: float
    direction: str


class NemRealTimeDashboard(BaseModel):
    dispatch_interval: str
    timestamp: str
    nem_total_demand_mw: float
    nem_total_generation_mw: float
    nem_avg_price_aud_mwh: float
    nem_renewable_pct: float
    max_price_region: str
    min_price_region: str
    regional_dispatch: list[RegionalDispatch]
    generation_mix: list[NemGenMixRecord]
    interconnector_flows: list[NemIcFlowRecord]


def _build_realtime_dashboard() -> NemRealTimeDashboard:
    rng = random.Random(7731)
    now = datetime.now(timezone.utc)
    now_ts = now.isoformat()
    interval = now.strftime("%Y-%m-%dT%H:%M:00")

    base_prices = {"NSW1": 87.5, "QLD1": 92.3, "VIC1": 74.8, "SA1": 118.4, "TAS1": 61.2}
    base_demand = {"NSW1": 8420.0, "QLD1": 7180.0, "VIC1": 5840.0, "SA1": 1720.0, "TAS1": 1080.0}
    base_renewable_pct = {"NSW1": 28.4, "QLD1": 22.1, "VIC1": 32.7, "SA1": 61.5, "TAS1": 87.3}
    net_interchange = {"NSW1": -320.0, "QLD1": 280.0, "VIC1": 95.0, "SA1": -142.0, "TAS1": 87.0}

    def price_band(p):
        if p < 0:       return "NEGATIVE"
        if p < 100:     return "LOW"
        if p < 300:     return "NORMAL"
        if p < 1000:    return "HIGH"
        if p < 5000:    return "VHIGH"
        return "SPIKE"

    regional_dispatch = []
    for region in ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]:
        dp = base_prices[region] * rng.uniform(0.95, 1.05)
        pd_ = dp * rng.uniform(0.97, 1.03)
        dem = base_demand[region] * rng.uniform(0.98, 1.02)
        gen = dem - net_interchange[region] * rng.uniform(0.95, 1.05)
        ren = base_renewable_pct[region] * rng.uniform(0.92, 1.08)
        sched = gen * rng.uniform(0.58, 0.72)
        semi = gen * rng.uniform(0.18, 0.28)
        regional_dispatch.append(RegionalDispatch(
            region=region,
            dispatch_price_aud_mwh=round(dp, 2),
            predispatch_price_aud_mwh=round(pd_, 2),
            demand_mw=round(dem, 1),
            generation_mw=round(gen, 1),
            net_interchange_mw=round(net_interchange[region], 1),
            rrp_band=price_band(dp),
            renewable_pct=round(ren, 1),
            scheduled_gen_mw=round(sched, 1),
            semi_sched_gen_mw=round(semi, 1),
        ))

    generation_mix = []
    fuel_mix = {
        "NSW1": [("BLACK_COAL", 8500, 5800, 0.68, 42.0), ("GAS", 2800, 820, 0.29, 85.0),
                 ("HYDRO", 900, 680, 0.76, 18.0), ("WIND", 1400, 780, 0.56, 0.0),
                 ("SOLAR", 2200, 720, 0.33, 0.0), ("BATTERY", 400, 120, 0.30, 95.0)],
        "QLD1": [("BLACK_COAL", 9200, 6200, 0.67, 38.0), ("GAS", 4200, 1100, 0.26, 82.0),
                 ("HYDRO", 700, 420, 0.60, 15.0), ("WIND", 800, 480, 0.60, 0.0),
                 ("SOLAR", 3800, 980, 0.26, 0.0), ("BATTERY", 200, 60, 0.30, 95.0)],
        "VIC1": [("BROWN_COAL", 4500, 3200, 0.71, 28.0), ("GAS", 2200, 720, 0.33, 88.0),
                 ("HYDRO", 600, 380, 0.63, 16.0), ("WIND", 3200, 1980, 0.62, 0.0),
                 ("SOLAR", 1400, 420, 0.30, 0.0), ("BATTERY", 320, 98, 0.31, 92.0)],
        "SA1":  [("GAS", 2600, 620, 0.24, 92.0), ("WIND", 2800, 1820, 0.65, 0.0),
                 ("SOLAR", 1200, 360, 0.30, 0.0), ("BATTERY", 300, 210, 0.70, 90.0)],
        "TAS1": [("HYDRO", 2700, 1950, 0.72, 12.0), ("WIND", 480, 310, 0.65, 0.0),
                 ("GAS", 200, 40, 0.20, 95.0)],
    }
    for region, fuels in fuel_mix.items():
        for fuel, cap, disp, cf, mc in fuels:
            generation_mix.append(NemGenMixRecord(
                region=region, fuel_type=fuel,
                registered_capacity_mw=float(cap),
                available_mw=float(cap) * 0.85,
                dispatch_mw=float(disp),
                capacity_factor_pct=cf * 100,
                marginal_cost_aud_mwh=mc,
            ))

    interconnector_flows = [
        NemIcFlowRecord(interconnector_id="N-Q-MNSP1", from_region="NSW1", to_region="QLD1",
                        mw_flow=280.0, mw_limit=700.0, loading_pct=40.0, losses_mw=5.6, direction="FORWARD"),
        NemIcFlowRecord(interconnector_id="VIC1-NSW1", from_region="VIC1", to_region="NSW1",
                        mw_flow=420.0, mw_limit=1350.0, loading_pct=31.1, losses_mw=12.6, direction="FORWARD"),
        NemIcFlowRecord(interconnector_id="V-SA", from_region="VIC1", to_region="SA1",
                        mw_flow=-142.0, mw_limit=680.0, loading_pct=20.9, losses_mw=4.3, direction="REVERSE"),
        NemIcFlowRecord(interconnector_id="T-V-MNSP1", from_region="TAS1", to_region="VIC1",
                        mw_flow=87.0, mw_limit=594.0, loading_pct=14.6, losses_mw=2.6, direction="FORWARD"),
        NemIcFlowRecord(interconnector_id="V-S-MNSP1", from_region="VIC1", to_region="SA1",
                        mw_flow=95.0, mw_limit=220.0, loading_pct=43.2, losses_mw=3.8, direction="FORWARD"),
    ]

    prices = [rd.dispatch_price_aud_mwh for rd in regional_dispatch]
    regions = [rd.region for rd in regional_dispatch]
    max_idx = prices.index(max(prices))
    min_idx = prices.index(min(prices))
    total_demand = sum(rd.demand_mw for rd in regional_dispatch)
    total_gen = sum(rd.generation_mw for rd in regional_dispatch)
    avg_price = sum(prices) / len(prices)
    weighted_ren = sum(rd.renewable_pct * rd.demand_mw for rd in regional_dispatch) / total_demand

    return NemRealTimeDashboard(
        dispatch_interval=interval,
        timestamp=now_ts,
        nem_total_demand_mw=round(total_demand, 1),
        nem_total_generation_mw=round(total_gen, 1),
        nem_avg_price_aud_mwh=round(avg_price, 2),
        nem_renewable_pct=round(weighted_ren, 1),
        max_price_region=regions[max_idx],
        min_price_region=regions[min_idx],
        regional_dispatch=regional_dispatch,
        generation_mix=generation_mix,
        interconnector_flows=interconnector_flows,
    )


@app.get("/api/nem-realtime/dashboard", response_model=NemRealTimeDashboard,
         summary="NEM Real-Time Dashboard", tags=["Market Data"])
@app.get("/api/realtime/dashboard", response_model=NemRealTimeDashboard,
         summary="NEM Real-Time Dashboard (alias)", tags=["Market Data"], include_in_schema=False)
def get_nem_realtime_dashboard() -> NemRealTimeDashboard:
    """NEM-wide real-time dispatch overview with regional prices, generation mix, and interconnector flows."""
    cached = _cache_get("nem_realtime")
    if cached is not None:
        return cached
    result = _build_realtime_dashboard()
    _cache_set("nem_realtime", result, 10)
    return result


# =========================================================================
# 3. POWER SYSTEM SECURITY DASHBOARD
# =========================================================================

class PssInertiaRecord(BaseModel):
    region: str
    timestamp: str
    total_inertia_mws: float
    synchronous_generation_mw: float
    non_synchronous_pct: float
    rocof_limit_hz_s: float
    min_inertia_requirement_mws: float
    inertia_headroom_mws: float
    status: str


class SynchronousCondenserRecord(BaseModel):
    unit_id: str
    site_name: str
    region: str
    operator: str
    rated_mvar: float
    inertia_contribution_mws: float
    status: str
    commissioning_year: int
    purpose: str


class FcasDispatchRecord(BaseModel):
    service: str
    region: str
    requirement_mw: float
    dispatched_mw: float
    price_mwh: float
    enablement_pct: float
    primary_provider: str
    timestamp: str


class PowerSystemSecurityDashboard(BaseModel):
    timestamp: str
    nem_inertia_total_mws: float
    lowest_inertia_region: str
    synchronous_condensers_online: int
    total_syncon_capacity_mvar: float
    fcas_raise_total_mw: float
    fcas_lower_total_mw: float
    system_strength_status: str
    inertia_records: list[PssInertiaRecord]
    synchronous_condensers: list[SynchronousCondenserRecord]
    fcas_dispatch: list[FcasDispatchRecord]


def _build_pss_dashboard() -> PowerSystemSecurityDashboard:
    ts = datetime.now(timezone.utc).isoformat()
    inertia_records = [
        PssInertiaRecord(region="SA1", timestamp=ts, total_inertia_mws=4200.0, synchronous_generation_mw=480.0,
                         non_synchronous_pct=74.2, rocof_limit_hz_s=1.0, min_inertia_requirement_mws=3500.0,
                         inertia_headroom_mws=700.0, status="Secure"),
        PssInertiaRecord(region="VIC1", timestamp=ts, total_inertia_mws=18500.0, synchronous_generation_mw=3200.0,
                         non_synchronous_pct=52.8, rocof_limit_hz_s=0.5, min_inertia_requirement_mws=12000.0,
                         inertia_headroom_mws=6500.0, status="Secure"),
        PssInertiaRecord(region="NSW1", timestamp=ts, total_inertia_mws=22000.0, synchronous_generation_mw=5800.0,
                         non_synchronous_pct=44.1, rocof_limit_hz_s=0.5, min_inertia_requirement_mws=15000.0,
                         inertia_headroom_mws=7000.0, status="Secure"),
        PssInertiaRecord(region="QLD1", timestamp=ts, total_inertia_mws=19800.0, synchronous_generation_mw=4600.0,
                         non_synchronous_pct=49.3, rocof_limit_hz_s=0.5, min_inertia_requirement_mws=14000.0,
                         inertia_headroom_mws=5800.0, status="Secure"),
        PssInertiaRecord(region="TAS1", timestamp=ts, total_inertia_mws=2800.0, synchronous_generation_mw=620.0,
                         non_synchronous_pct=38.4, rocof_limit_hz_s=1.0, min_inertia_requirement_mws=2200.0,
                         inertia_headroom_mws=600.0, status="Secure"),
    ]
    condensers = [
        SynchronousCondenserRecord(unit_id="SC-SA-001", site_name="Davenport Synchronous Condenser 1",
                                   region="SA1", operator="ElectraNet", rated_mvar=100.0,
                                   inertia_contribution_mws=500.0, status="Online", commissioning_year=2023, purpose="Both"),
        SynchronousCondenserRecord(unit_id="SC-SA-002", site_name="Davenport Synchronous Condenser 2",
                                   region="SA1", operator="ElectraNet", rated_mvar=100.0,
                                   inertia_contribution_mws=500.0, status="Online", commissioning_year=2023, purpose="Both"),
        SynchronousCondenserRecord(unit_id="SC-SA-003", site_name="Robertstown Synchronous Condenser",
                                   region="SA1", operator="ElectraNet", rated_mvar=100.0,
                                   inertia_contribution_mws=500.0, status="Online", commissioning_year=2022, purpose="System Strength"),
        SynchronousCondenserRecord(unit_id="SC-VIC-001", site_name="Moorabool Synchronous Condenser 1",
                                   region="VIC1", operator="AusNet Services", rated_mvar=200.0,
                                   inertia_contribution_mws=1000.0, status="Commissioning", commissioning_year=2026, purpose="Both"),
        SynchronousCondenserRecord(unit_id="SC-NSW-001", site_name="Transgrid Tomago Synchronous Condenser",
                                   region="NSW1", operator="Transgrid", rated_mvar=250.0,
                                   inertia_contribution_mws=1200.0, status="Online", commissioning_year=2024, purpose="System Strength"),
        SynchronousCondenserRecord(unit_id="SC-QLD-001", site_name="Greenbank Synchronous Condenser",
                                   region="QLD1", operator="Powerlink", rated_mvar=160.0,
                                   inertia_contribution_mws=800.0, status="Online", commissioning_year=2025, purpose="Voltage Support"),
    ]
    fcas = [
        FcasDispatchRecord(service="R6S", region="NEM", requirement_mw=240.0, dispatched_mw=240.0,
                           price_mwh=12.50, enablement_pct=100.0, primary_provider="Batteries", timestamp=ts),
        FcasDispatchRecord(service="R60S", region="NEM", requirement_mw=280.0, dispatched_mw=278.0,
                           price_mwh=8.20, enablement_pct=99.3, primary_provider="Batteries + Hydro", timestamp=ts),
        FcasDispatchRecord(service="R5M", region="NEM", requirement_mw=320.0, dispatched_mw=320.0,
                           price_mwh=4.80, enablement_pct=100.0, primary_provider="Gas + Batteries", timestamp=ts),
        FcasDispatchRecord(service="R5RE", region="NEM", requirement_mw=420.0, dispatched_mw=415.0,
                           price_mwh=2.40, enablement_pct=98.8, primary_provider="Gas + DSP", timestamp=ts),
        FcasDispatchRecord(service="L6S", region="NEM", requirement_mw=210.0, dispatched_mw=210.0,
                           price_mwh=15.80, enablement_pct=100.0, primary_provider="Batteries", timestamp=ts),
        FcasDispatchRecord(service="L60S", region="NEM", requirement_mw=250.0, dispatched_mw=248.0,
                           price_mwh=9.40, enablement_pct=99.2, primary_provider="Batteries + DSP", timestamp=ts),
        FcasDispatchRecord(service="L5M", region="NEM", requirement_mw=300.0, dispatched_mw=298.0,
                           price_mwh=5.20, enablement_pct=99.3, primary_provider="Gas + DSP", timestamp=ts),
        FcasDispatchRecord(service="L5RE", region="NEM", requirement_mw=380.0, dispatched_mw=378.0,
                           price_mwh=2.80, enablement_pct=99.5, primary_provider="Gas + Hydro", timestamp=ts),
    ]
    total_inertia = sum(r.total_inertia_mws for r in inertia_records)
    lowest_region = min(inertia_records, key=lambda r: r.inertia_headroom_mws).region
    online_condensers = [c for c in condensers if c.status == "Online"]
    fcas_raise = sum(f.dispatched_mw for f in fcas if f.service.startswith("R"))
    fcas_lower = sum(f.dispatched_mw for f in fcas if f.service.startswith("L"))

    return PowerSystemSecurityDashboard(
        timestamp=ts,
        nem_inertia_total_mws=total_inertia,
        lowest_inertia_region=lowest_region,
        synchronous_condensers_online=len(online_condensers),
        total_syncon_capacity_mvar=sum(c.rated_mvar for c in online_condensers),
        fcas_raise_total_mw=fcas_raise,
        fcas_lower_total_mw=fcas_lower,
        system_strength_status="Secure",
        inertia_records=inertia_records,
        synchronous_condensers=condensers,
        fcas_dispatch=fcas,
    )


@app.get("/api/pss/dashboard", response_model=PowerSystemSecurityDashboard,
         summary="Power System Security & Inertia Dashboard", tags=["Grid Operations"])
def get_pss_dashboard() -> PowerSystemSecurityDashboard:
    """Inertia, synchronous condensers, and FCAS dispatch dashboard."""
    cached = _cache_get("pss_dashboard")
    if cached is not None:
        return cached
    result = _build_pss_dashboard()
    _cache_set("pss_dashboard", result, 30)
    return result


# =========================================================================
# 4. CURTAILMENT DASHBOARD (Renewable Integration)
# =========================================================================

class CurtailmentEvent(BaseModel):
    event_id: str
    date: str
    region: str
    technology: str
    curtailed_mwh: float
    curtailed_pct: float
    duration_minutes: int
    cause: str
    peak_available_mw: float


class MinimumOperationalDemandRecord(BaseModel):
    date: str
    region: str
    min_demand_mw: float
    min_demand_time: str
    renewable_share_pct: float
    instantaneous_renewable_mw: float
    storage_charging_mw: float
    exports_mw: float
    record_broken: bool


class RenewableIntegrationLimit(BaseModel):
    region: str
    limit_type: str
    current_limit_mw: float
    headroom_mw: float
    mitigation_project: str
    mitigation_year: int
    description: str


class CurtailmentDashboard(BaseModel):
    timestamp: str
    total_curtailment_gwh_ytd: float
    curtailment_events_ytd: int
    worst_region: str
    lowest_mod_record_mw: float
    lowest_mod_date: str
    renewable_penetration_record_pct: float
    renewable_penetration_record_date: str
    curtailment_events: list[CurtailmentEvent]
    mod_records: list[MinimumOperationalDemandRecord]
    integration_limits: list[RenewableIntegrationLimit]


def _build_curtailment_dashboard() -> CurtailmentDashboard:
    events = [
        CurtailmentEvent(event_id="CE-2025-0842", date="2025-10-14", region="SA1", technology="Wind",
                         curtailed_mwh=842.0, curtailed_pct=38.2, duration_minutes=95,
                         cause="System Strength", peak_available_mw=1580.0),
        CurtailmentEvent(event_id="CE-2025-0831", date="2025-10-13", region="VIC1", technology="Solar",
                         curtailed_mwh=312.0, curtailed_pct=18.5, duration_minutes=45,
                         cause="Thermal Limit", peak_available_mw=1890.0),
        CurtailmentEvent(event_id="CE-2025-0819", date="2025-10-11", region="QLD1", technology="Solar",
                         curtailed_mwh=1240.0, curtailed_pct=42.1, duration_minutes=135,
                         cause="Voltage", peak_available_mw=4200.0),
        CurtailmentEvent(event_id="CE-2025-0808", date="2025-10-10", region="SA1", technology="Wind",
                         curtailed_mwh=620.0, curtailed_pct=29.8, duration_minutes=72,
                         cause="Frequency Control", peak_available_mw=1460.0),
        CurtailmentEvent(event_id="CE-2025-0795", date="2025-10-08", region="NSW1", technology="Solar",
                         curtailed_mwh=480.0, curtailed_pct=22.4, duration_minutes=60,
                         cause="Thermal Limit", peak_available_mw=2800.0),
        CurtailmentEvent(event_id="CE-2025-0781", date="2025-10-07", region="VIC1", technology="Wind",
                         curtailed_mwh=950.0, curtailed_pct=35.6, duration_minutes=110,
                         cause="System Strength", peak_available_mw=2650.0),
    ]
    mod_records = [
        MinimumOperationalDemandRecord(date="2025-10-13", region="SA1", min_demand_mw=312.0,
                                       min_demand_time="13:00", renewable_share_pct=92.4,
                                       instantaneous_renewable_mw=1820.0, storage_charging_mw=680.0,
                                       exports_mw=420.0, record_broken=True),
        MinimumOperationalDemandRecord(date="2025-10-12", region="VIC1", min_demand_mw=2840.0,
                                       min_demand_time="12:30", renewable_share_pct=78.2,
                                       instantaneous_renewable_mw=5180.0, storage_charging_mw=420.0,
                                       exports_mw=1200.0, record_broken=False),
        MinimumOperationalDemandRecord(date="2025-09-28", region="QLD1", min_demand_mw=2120.0,
                                       min_demand_time="13:30", renewable_share_pct=85.6,
                                       instantaneous_renewable_mw=6840.0, storage_charging_mw=950.0,
                                       exports_mw=380.0, record_broken=True),
    ]
    integration_limits = [
        RenewableIntegrationLimit(region="SA1", limit_type="System Strength", current_limit_mw=2200.0,
                                  headroom_mw=380.0, mitigation_project="Synchronous Condensers (Davenport)",
                                  mitigation_year=2026, description="SA system strength limits non-synchronous renewable infeed."),
        RenewableIntegrationLimit(region="VIC1", limit_type="System Strength", current_limit_mw=6000.0,
                                  headroom_mw=1200.0, mitigation_project="VNI West Transmission Upgrade",
                                  mitigation_year=2030, description="VIC system strength constrained near Latrobe Valley as coal retires."),
        RenewableIntegrationLimit(region="QLD1", limit_type="Thermal Limit", current_limit_mw=8500.0,
                                  headroom_mw=2400.0, mitigation_project="QNI Upgrade + Central QLD REZ",
                                  mitigation_year=2029, description="North QLD solar/wind export limited by 275kV thermal constraints."),
    ]
    return CurtailmentDashboard(
        timestamp=datetime.now(timezone.utc).isoformat(),
        total_curtailment_gwh_ytd=3.82,
        curtailment_events_ytd=842,
        worst_region="SA1",
        lowest_mod_record_mw=312.0,
        lowest_mod_date="2025-10-13",
        renewable_penetration_record_pct=92.4,
        renewable_penetration_record_date="2025-10-13",
        curtailment_events=events,
        mod_records=mod_records,
        integration_limits=integration_limits,
    )


@app.get("/api/curtailment/dashboard", response_model=CurtailmentDashboard,
         summary="Renewable Curtailment Dashboard", tags=["Renewable Energy"])
def get_curtailment_dashboard() -> CurtailmentDashboard:
    """Curtailment events, minimum operational demand records, and renewable integration limits."""
    cached = _cache_get("curtailment_dashboard")
    if cached is not None:
        return cached
    result = _build_curtailment_dashboard()
    _cache_set("curtailment_dashboard", result, 300)
    return result


# =========================================================================
# 5. BATTERY ECONOMICS DASHBOARD
# =========================================================================

class BatteryUnit(BaseModel):
    bess_id: str
    station_name: str
    region: str
    technology: str
    capacity_mwh: float
    power_mw: float
    roundtrip_efficiency_pct: float
    cycles_today: float
    soc_current_pct: float
    energy_revenue_today: float
    fcas_revenue_today: float
    sras_revenue_today: float
    total_revenue_today: float
    annual_revenue_est_aud: float
    lcoe_aud_mwh: float


class ArbitrageOpportunity(BaseModel):
    region: str
    date: str
    peak_price: float
    off_peak_price: float
    spread: float
    optimal_cycles: float
    theoretical_max_revenue_mw: float
    actual_captured_pct: float


class BatteryEconomicsDashboard(BaseModel):
    timestamp: str
    total_fleet_capacity_mwh: float
    total_fleet_power_mw: float
    avg_roundtrip_efficiency_pct: float
    fleet_revenue_today_aud: float
    energy_pct: float
    fcas_pct: float
    sras_pct: float
    best_arbitrage_region: str
    best_spread_today: float
    batteries: List[BatteryUnit]
    opportunities: List[ArbitrageOpportunity]


def _build_battery_dashboard() -> BatteryEconomicsDashboard:
    rng = random.Random(42)
    batteries_raw = [
        ("HPSA1", "Hornsdale Power Reserve", "SA1", "Li-Ion", 194.0, 150.0, 92.5, 0.95, 68.0, 8_200_000, 95.0),
        ("LBSA1", "Lake Bonney BESS", "SA1", "Li-Ion", 52.0, 25.0, 91.0, 0.60, 55.0, 1_450_000, 98.0),
        ("WSBNSW1", "Waratah Super Battery", "NSW1", "Li-Ion", 1680.0, 850.0, 93.0, 1.10, 72.0, 45_000_000, 88.0),
        ("OBQLD1", "Onslow Battery", "QLD1", "Li-Ion", 200.0, 100.0, 90.5, 0.85, 60.0, 5_500_000, 97.0),
        ("TIBSA1", "Torrens Island BESS", "SA1", "Li-Ion", 500.0, 250.0, 92.0, 1.00, 65.0, 13_800_000, 92.0),
        ("VBBVIC1", "Victorian Big Battery", "VIC1", "Li-Ion", 450.0, 300.0, 91.5, 0.90, 58.0, 12_100_000, 94.0),
        ("HWBVIC1", "Hazelwood Battery", "VIC1", "Flow Battery", 100.0, 50.0, 78.0, 0.40, 45.0, 2_200_000, 110.0),
    ]
    batteries = []
    for bess_id, name, region, tech, cap, pwr, rte, cycles, soc, annual, lcoe in batteries_raw:
        daily = annual / 365.0
        e_rev = daily * 0.45 * (1 + rng.uniform(-0.05, 0.05))
        f_rev = daily * 0.40 * (1 + rng.uniform(-0.05, 0.05))
        s_rev = daily * 0.15 * (1 + rng.uniform(-0.05, 0.05))
        batteries.append(BatteryUnit(
            bess_id=bess_id, station_name=name, region=region, technology=tech,
            capacity_mwh=cap, power_mw=pwr, roundtrip_efficiency_pct=rte,
            cycles_today=cycles, soc_current_pct=soc,
            energy_revenue_today=round(e_rev, 2), fcas_revenue_today=round(f_rev, 2),
            sras_revenue_today=round(s_rev, 2), total_revenue_today=round(e_rev + f_rev + s_rev, 2),
            annual_revenue_est_aud=annual, lcoe_aud_mwh=lcoe,
        ))

    today_str = date.today().isoformat()
    opportunities = [
        ArbitrageOpportunity(region="SA1", date=today_str, peak_price=820.0, off_peak_price=15.0,
                             spread=420.0, optimal_cycles=2.0, theoretical_max_revenue_mw=310.0, actual_captured_pct=78.5),
        ArbitrageOpportunity(region="QLD1", date=today_str, peak_price=750.0, off_peak_price=18.0,
                             spread=380.0, optimal_cycles=1.8, theoretical_max_revenue_mw=270.0, actual_captured_pct=74.2),
        ArbitrageOpportunity(region="VIC1", date=today_str, peak_price=680.0, off_peak_price=22.0,
                             spread=310.0, optimal_cycles=1.5, theoretical_max_revenue_mw=225.0, actual_captured_pct=71.8),
        ArbitrageOpportunity(region="NSW1", date=today_str, peak_price=620.0, off_peak_price=20.0,
                             spread=280.0, optimal_cycles=1.4, theoretical_max_revenue_mw=200.0, actual_captured_pct=68.9),
        ArbitrageOpportunity(region="TAS1", date=today_str, peak_price=450.0, off_peak_price=25.0,
                             spread=190.0, optimal_cycles=1.2, theoretical_max_revenue_mw=140.0, actual_captured_pct=65.0),
    ]

    total_cap = sum(b.capacity_mwh for b in batteries)
    total_pwr = sum(b.power_mw for b in batteries)
    avg_rte = sum(b.roundtrip_efficiency_pct * b.capacity_mwh for b in batteries) / total_cap
    total_rev = sum(b.total_revenue_today for b in batteries)
    total_e = sum(b.energy_revenue_today for b in batteries)
    total_f = sum(b.fcas_revenue_today for b in batteries)
    total_s = sum(b.sras_revenue_today for b in batteries)

    return BatteryEconomicsDashboard(
        timestamp=datetime.now(timezone.utc).isoformat(),
        total_fleet_capacity_mwh=total_cap,
        total_fleet_power_mw=total_pwr,
        avg_roundtrip_efficiency_pct=round(avg_rte, 1),
        fleet_revenue_today_aud=round(total_rev, 2),
        energy_pct=round(total_e / total_rev * 100, 1) if total_rev else 0,
        fcas_pct=round(total_f / total_rev * 100, 1) if total_rev else 0,
        sras_pct=round(total_s / total_rev * 100, 1) if total_rev else 0,
        best_arbitrage_region="SA1",
        best_spread_today=420.0,
        batteries=batteries,
        opportunities=opportunities,
    )


@app.get("/api/battery-economics/dashboard", response_model=BatteryEconomicsDashboard,
         summary="Battery Economics & Arbitrage Dashboard", tags=["Battery Storage"])
def get_battery_economics_dashboard() -> BatteryEconomicsDashboard:
    """Fleet-wide battery economics including revenue splits, arbitrage opportunities."""
    cached = _cache_get("battery_economics")
    if cached is not None:
        return cached
    result = _build_battery_dashboard()
    _cache_set("battery_economics", result, 60)
    return result


# =========================================================================
# 6. GAS MARKET DASHBOARD
# =========================================================================

class GasHubPrice(BaseModel):
    hub: str
    price_aud_gj: float
    change_1d_pct: float
    volume_tj: float
    timestamp: str


class GasPipelineFlow(BaseModel):
    pipeline_id: str
    pipeline_name: str
    from_location: str
    to_location: str
    capacity_tj_day: float
    flow_tj_day: float
    utilisation_pct: float
    pressure_kpa: float
    timestamp: str


class LngExportRecord(BaseModel):
    terminal: str
    state: str
    capacity_mtpa: float
    utilisation_pct: float
    exports_today_tj: float
    destination: str
    timestamp: str


class GasMarketDashboard(BaseModel):
    timestamp: str
    wallumbilla_price: float
    moomba_price: float
    longford_price: float
    total_pipeline_flow_tj: float
    lng_exports_today_tj: float
    domestic_demand_tj: float
    gas_power_generation_tj: float
    hub_prices: List[GasHubPrice]
    pipeline_flows: List[GasPipelineFlow]
    lng_terminals: List[LngExportRecord]


def _build_gas_dashboard() -> GasMarketDashboard:
    ts = datetime.now(timezone.utc).isoformat()
    hub_prices = [
        GasHubPrice(hub="Wallumbilla", price_aud_gj=8.45, change_1d_pct=2.1, volume_tj=285.0, timestamp=ts),
        GasHubPrice(hub="Moomba", price_aud_gj=9.12, change_1d_pct=-0.8, volume_tj=310.0, timestamp=ts),
        GasHubPrice(hub="Longford", price_aud_gj=10.80, change_1d_pct=1.5, volume_tj=195.0, timestamp=ts),
        GasHubPrice(hub="Adelaide", price_aud_gj=11.20, change_1d_pct=3.2, volume_tj=58.0, timestamp=ts),
        GasHubPrice(hub="Sydney", price_aud_gj=10.50, change_1d_pct=0.6, volume_tj=245.0, timestamp=ts),
    ]
    pipeline_flows = [
        GasPipelineFlow(pipeline_id="MSP", pipeline_name="Moomba Sydney Pipeline",
                        from_location="Moomba", to_location="Sydney", capacity_tj_day=310.0,
                        flow_tj_day=245.0, utilisation_pct=79.0, pressure_kpa=10000.0, timestamp=ts),
        GasPipelineFlow(pipeline_id="EGP", pipeline_name="Eastern Gas Pipeline",
                        from_location="Longford", to_location="Sydney", capacity_tj_day=195.0,
                        flow_tj_day=142.0, utilisation_pct=72.8, pressure_kpa=8600.0, timestamp=ts),
        GasPipelineFlow(pipeline_id="SEA", pipeline_name="SEA Gas Pipeline",
                        from_location="Victoria", to_location="Adelaide", capacity_tj_day=90.0,
                        flow_tj_day=58.0, utilisation_pct=64.4, pressure_kpa=7400.0, timestamp=ts),
        GasPipelineFlow(pipeline_id="CGP", pipeline_name="Carpentaria Gas Pipeline",
                        from_location="Ballera", to_location="Mount Isa", capacity_tj_day=110.0,
                        flow_tj_day=74.0, utilisation_pct=67.3, pressure_kpa=9200.0, timestamp=ts),
        GasPipelineFlow(pipeline_id="SWQP", pipeline_name="South West Queensland Pipeline",
                        from_location="Wallumbilla", to_location="Moomba", capacity_tj_day=210.0,
                        flow_tj_day=163.0, utilisation_pct=77.6, pressure_kpa=11500.0, timestamp=ts),
    ]
    lng_terminals = [
        LngExportRecord(terminal="GLNG", state="QLD", capacity_mtpa=7.8, utilisation_pct=82.0,
                        exports_today_tj=420.0, destination="Asia-Pacific", timestamp=ts),
        LngExportRecord(terminal="APLNG", state="QLD", capacity_mtpa=9.0, utilisation_pct=88.5,
                        exports_today_tj=510.0, destination="Asia-Pacific", timestamp=ts),
        LngExportRecord(terminal="QCLNG", state="QLD", capacity_mtpa=8.5, utilisation_pct=85.0,
                        exports_today_tj=480.0, destination="Asia-Pacific", timestamp=ts),
    ]
    total_pipeline = sum(p.flow_tj_day for p in pipeline_flows)
    total_lng = sum(t.exports_today_tj for t in lng_terminals)

    return GasMarketDashboard(
        timestamp=ts,
        wallumbilla_price=8.45,
        moomba_price=9.12,
        longford_price=10.80,
        total_pipeline_flow_tj=total_pipeline,
        lng_exports_today_tj=total_lng,
        domestic_demand_tj=682.0,
        gas_power_generation_tj=185.0,
        hub_prices=hub_prices,
        pipeline_flows=pipeline_flows,
        lng_terminals=lng_terminals,
    )


@app.get("/api/gas-market/dashboard", response_model=GasMarketDashboard,
         summary="Eastern Australian Gas Market Dashboard", tags=["Gas Market"])
def get_gas_market_dashboard() -> GasMarketDashboard:
    """Gas hub prices, pipeline flows, and LNG export data."""
    cached = _cache_get("gas_market")
    if cached is not None:
        return cached
    result = _build_gas_dashboard()
    _cache_set("gas_market", result, 60)
    return result


# =========================================================================
# 7. CARBON & EMISSIONS DASHBOARD
# =========================================================================

class RegionEmissionsRecord(BaseModel):
    region: str
    timestamp: str
    emissions_intensity_kg_co2_mwh: float
    renewable_pct: float
    coal_pct: float
    gas_pct: float
    hydro_pct: float
    wind_pct: float
    solar_pct: float
    battery_pct: float
    total_generation_mw: float
    net_emissions_t_co2_hr: float


class FuelEmissionsFactor(BaseModel):
    fuel_type: str
    scope: str
    kg_co2_mwh: float
    kg_co2_mwh_with_losses: float
    notes: str


class EmissionsTrajectory(BaseModel):
    year: int
    emissions_mt_co2: float
    renewable_share_pct: float
    coal_capacity_gw: float
    target_met: bool


class CarbonDashboard(BaseModel):
    timestamp: str
    nem_emissions_intensity_now: float
    lowest_region: str
    lowest_intensity: float
    highest_region: str
    highest_intensity: float
    renewable_share_now_pct: float
    vs_same_time_last_year_pct: float
    annual_trajectory: List[EmissionsTrajectory]
    region_records: List[RegionEmissionsRecord]
    fuel_factors: List[FuelEmissionsFactor]


def _build_carbon_dashboard() -> CarbonDashboard:
    ts = datetime.now(timezone.utc).isoformat()
    regions = [
        RegionEmissionsRecord(region="NSW1", timestamp=ts, emissions_intensity_kg_co2_mwh=450.0,
                              renewable_pct=22.0, coal_pct=58.0, gas_pct=12.0, hydro_pct=6.0,
                              wind_pct=3.5, solar_pct=4.5, battery_pct=0.5,
                              total_generation_mw=9800.0, net_emissions_t_co2_hr=4410.0),
        RegionEmissionsRecord(region="QLD1", timestamp=ts, emissions_intensity_kg_co2_mwh=520.0,
                              renewable_pct=18.0, coal_pct=62.0, gas_pct=12.0, hydro_pct=2.0,
                              wind_pct=3.0, solar_pct=5.0, battery_pct=0.0,
                              total_generation_mw=8200.0, net_emissions_t_co2_hr=4264.0),
        RegionEmissionsRecord(region="VIC1", timestamp=ts, emissions_intensity_kg_co2_mwh=500.0,
                              renewable_pct=24.0, coal_pct=55.0, gas_pct=12.0, hydro_pct=4.0,
                              wind_pct=8.0, solar_pct=4.0, battery_pct=1.0,
                              total_generation_mw=6500.0, net_emissions_t_co2_hr=3250.0),
        RegionEmissionsRecord(region="SA1", timestamp=ts, emissions_intensity_kg_co2_mwh=120.0,
                              renewable_pct=70.0, coal_pct=0.0, gas_pct=22.0, hydro_pct=0.0,
                              wind_pct=38.0, solar_pct=28.0, battery_pct=4.0,
                              total_generation_mw=2100.0, net_emissions_t_co2_hr=252.0),
        RegionEmissionsRecord(region="TAS1", timestamp=ts, emissions_intensity_kg_co2_mwh=50.0,
                              renewable_pct=95.0, coal_pct=0.0, gas_pct=5.0, hydro_pct=88.0,
                              wind_pct=7.0, solar_pct=0.0, battery_pct=0.0,
                              total_generation_mw=1600.0, net_emissions_t_co2_hr=80.0),
    ]
    fuel_factors = [
        FuelEmissionsFactor(fuel_type="Black Coal", scope="Scope 1", kg_co2_mwh=820.0,
                            kg_co2_mwh_with_losses=902.0, notes="NSW/QLD bituminous coal"),
        FuelEmissionsFactor(fuel_type="Brown Coal", scope="Scope 1", kg_co2_mwh=1100.0,
                            kg_co2_mwh_with_losses=1210.0, notes="VIC Latrobe Valley lignite"),
        FuelEmissionsFactor(fuel_type="Natural Gas (CCGT)", scope="Scope 1", kg_co2_mwh=370.0,
                            kg_co2_mwh_with_losses=407.0, notes="Combined cycle gas turbine"),
        FuelEmissionsFactor(fuel_type="Natural Gas (OCGT)", scope="Scope 1", kg_co2_mwh=550.0,
                            kg_co2_mwh_with_losses=605.0, notes="Open cycle peaker — lower efficiency"),
        FuelEmissionsFactor(fuel_type="Solar PV", scope="Scope 1", kg_co2_mwh=0.0,
                            kg_co2_mwh_with_losses=0.0, notes="Zero operational emissions"),
        FuelEmissionsFactor(fuel_type="Wind", scope="Scope 1", kg_co2_mwh=0.0,
                            kg_co2_mwh_with_losses=0.0, notes="Zero operational emissions"),
    ]
    trajectory = [
        EmissionsTrajectory(year=2020, emissions_mt_co2=165.0, renewable_share_pct=24.0, coal_capacity_gw=23.0, target_met=True),
        EmissionsTrajectory(year=2022, emissions_mt_co2=155.0, renewable_share_pct=32.0, coal_capacity_gw=21.0, target_met=True),
        EmissionsTrajectory(year=2024, emissions_mt_co2=140.0, renewable_share_pct=40.0, coal_capacity_gw=18.5, target_met=True),
        EmissionsTrajectory(year=2026, emissions_mt_co2=120.0, renewable_share_pct=52.0, coal_capacity_gw=15.0, target_met=False),
        EmissionsTrajectory(year=2028, emissions_mt_co2=95.0, renewable_share_pct=65.0, coal_capacity_gw=10.0, target_met=False),
        EmissionsTrajectory(year=2030, emissions_mt_co2=70.0, renewable_share_pct=82.0, coal_capacity_gw=5.0, target_met=False),
    ]

    total_gen = sum(r.total_generation_mw for r in regions)
    weighted_intensity = sum(r.emissions_intensity_kg_co2_mwh * r.total_generation_mw for r in regions) / total_gen
    weighted_renewable = sum(r.renewable_pct * r.total_generation_mw for r in regions) / total_gen

    return CarbonDashboard(
        timestamp=ts,
        nem_emissions_intensity_now=round(weighted_intensity, 1),
        lowest_region="TAS1",
        lowest_intensity=50.0,
        highest_region="QLD1",
        highest_intensity=520.0,
        renewable_share_now_pct=round(weighted_renewable, 1),
        vs_same_time_last_year_pct=-8.2,
        annual_trajectory=trajectory,
        region_records=regions,
        fuel_factors=fuel_factors,
    )


@app.get("/api/carbon/dashboard", response_model=CarbonDashboard,
         summary="Carbon & Emissions Dashboard", tags=["Carbon & Emissions"])
def get_carbon_dashboard() -> CarbonDashboard:
    """NEM emissions intensity, regional breakdown, fuel factors, and decarbonisation trajectory."""
    cached = _cache_get("carbon_dashboard")
    if cached is not None:
        return cached
    result = _build_carbon_dashboard()
    _cache_set("carbon_dashboard", result, 300)
    return result


# =========================================================================
# 8. RETAIL MARKET DASHBOARD
# =========================================================================

class RetailerMarketShare(BaseModel):
    retailer: str
    state: str
    residential_customers: int
    sme_customers: int
    large_commercial_customers: int
    market_share_pct: float
    electricity_volume_gwh: float
    avg_retail_margin_pct: float


class DefaultOfferPrice(BaseModel):
    state: str
    offer_type: str
    annual_cost_aud: float
    annual_usage_kwh: int
    cents_per_kwh: float
    daily_supply_charge_aud: float
    effective_date: str


class CustomerSwitchingRecord(BaseModel):
    quarter: str
    state: str
    switches_count: int
    churn_rate_pct: float
    avg_saving_aud: float


class RetailMarketDashboard(BaseModel):
    timestamp: str
    total_residential_customers: int
    total_market_offers_count: int
    best_market_offer_discount_pct: float
    standing_offer_customers_pct: float
    market_shares: List[RetailerMarketShare]
    default_offers: List[DefaultOfferPrice]
    switching_data: List[CustomerSwitchingRecord]


def _build_retail_dashboard() -> RetailMarketDashboard:
    market_shares = [
        RetailerMarketShare(retailer="AGL Energy", state="NEM", residential_customers=2_100_000,
                            sme_customers=210_000, large_commercial_customers=4_200,
                            market_share_pct=23.0, electricity_volume_gwh=38_400.0, avg_retail_margin_pct=6.2),
        RetailerMarketShare(retailer="Origin Energy", state="NEM", residential_customers=2_010_000,
                            sme_customers=195_000, large_commercial_customers=3_800,
                            market_share_pct=22.0, electricity_volume_gwh=36_100.0, avg_retail_margin_pct=5.8),
        RetailerMarketShare(retailer="EnergyAustralia", state="NEM", residential_customers=1_820_000,
                            sme_customers=175_000, large_commercial_customers=3_500,
                            market_share_pct=20.0, electricity_volume_gwh=33_200.0, avg_retail_margin_pct=5.5),
        RetailerMarketShare(retailer="Simply Energy", state="NEM", residential_customers=600_000,
                            sme_customers=62_000, large_commercial_customers=1_100,
                            market_share_pct=7.0, electricity_volume_gwh=10_800.0, avg_retail_margin_pct=4.9),
        RetailerMarketShare(retailer="Alinta Energy", state="NEM", residential_customers=400_000,
                            sme_customers=38_000, large_commercial_customers=700,
                            market_share_pct=4.0, electricity_volume_gwh=7_100.0, avg_retail_margin_pct=4.7),
        RetailerMarketShare(retailer="Others", state="NEM", residential_customers=1_650_000,
                            sme_customers=160_000, large_commercial_customers=3_000,
                            market_share_pct=19.0, electricity_volume_gwh=31_500.0, avg_retail_margin_pct=4.3),
    ]
    default_offers = [
        DefaultOfferPrice(state="NSW", offer_type="DMO", annual_cost_aud=1_829.0, annual_usage_kwh=3_900,
                          cents_per_kwh=38.5, daily_supply_charge_aud=1.12, effective_date="2025-07-01"),
        DefaultOfferPrice(state="QLD", offer_type="DMO", annual_cost_aud=1_762.0, annual_usage_kwh=4_600,
                          cents_per_kwh=31.2, daily_supply_charge_aud=1.08, effective_date="2025-07-01"),
        DefaultOfferPrice(state="SA", offer_type="DMO", annual_cost_aud=2_185.0, annual_usage_kwh=4_000,
                          cents_per_kwh=44.8, daily_supply_charge_aud=1.28, effective_date="2025-07-01"),
        DefaultOfferPrice(state="VIC", offer_type="VDO", annual_cost_aud=1_684.0, annual_usage_kwh=4_000,
                          cents_per_kwh=33.2, daily_supply_charge_aud=1.02, effective_date="2025-01-01"),
    ]
    switching_data = [
        CustomerSwitchingRecord(quarter="2025-Q1", state="NSW", switches_count=142_000,
                                churn_rate_pct=8.2, avg_saving_aud=185.0),
        CustomerSwitchingRecord(quarter="2025-Q1", state="VIC", switches_count=128_000,
                                churn_rate_pct=9.1, avg_saving_aud=210.0),
        CustomerSwitchingRecord(quarter="2025-Q1", state="QLD", switches_count=98_000,
                                churn_rate_pct=7.5, avg_saving_aud=165.0),
        CustomerSwitchingRecord(quarter="2025-Q1", state="SA", switches_count=52_000,
                                churn_rate_pct=10.8, avg_saving_aud=240.0),
    ]
    return RetailMarketDashboard(
        timestamp=datetime.now(timezone.utc).isoformat(),
        total_residential_customers=8_580_000,
        total_market_offers_count=412,
        best_market_offer_discount_pct=28.5,
        standing_offer_customers_pct=12.8,
        market_shares=market_shares,
        default_offers=default_offers,
        switching_data=switching_data,
    )


@app.get("/api/retail-market/dashboard", response_model=RetailMarketDashboard,
         summary="Retail Market Competition Dashboard", tags=["Retail Market"])
def get_retail_market_dashboard() -> RetailMarketDashboard:
    """Retail market shares, DMO/VDO prices, and customer switching data."""
    cached = _cache_get("retail_market")
    if cached is not None:
        return cached
    result = _build_retail_dashboard()
    _cache_set("retail_market", result, 3600)
    return result


# =========================================================================
# 9. DEMAND RESPONSE DASHBOARD
# =========================================================================

class RertContract(BaseModel):
    contract_id: str
    provider: str
    region: str
    contract_type: str
    contracted_mw: float
    available_mw: float
    strike_price_aud_mwh: float
    contract_start: str
    contract_end: str
    activations_ytd: int
    total_activation_mw: float
    contract_cost_m_aud: float


class DemandResponseActivation(BaseModel):
    activation_id: str
    trading_interval: str
    region: str
    provider: str
    activation_type: str
    activated_mw: float
    duration_min: int
    trigger: str
    spot_price_aud_mwh: float
    avoided_voll_m_aud: float
    cost_aud: float


class DemandResponseProvider(BaseModel):
    provider_id: str
    provider_name: str
    provider_type: str
    registered_mw: float
    regions: List[str]
    technologies: List[str]
    reliability_pct: float
    avg_response_time_min: float


class DemandResponseDashboard(BaseModel):
    timestamp: str
    total_contracted_mw: float
    total_available_mw: float
    activations_ytd: int
    total_activation_cost_m_aud: float
    avoided_voll_m_aud: float
    avg_activation_duration_min: float
    contracts: list[RertContract]
    activations: list[DemandResponseActivation]
    providers: list[DemandResponseProvider]


def _build_dr_dashboard() -> DemandResponseDashboard:
    rng = random.Random(9901)
    contracts = [
        RertContract(contract_id="RERT-NSW-01", provider="Energy Australia DR", region="NSW1",
                     contract_type="RERT", contracted_mw=150.0, available_mw=140.0,
                     strike_price_aud_mwh=285.0, contract_start="2025-04-01", contract_end="2025-10-31",
                     activations_ytd=3, total_activation_mw=420.0, contract_cost_m_aud=4.2),
        RertContract(contract_id="RERT-VIC-01", provider="AGL Energy DR", region="VIC1",
                     contract_type="RERT", contracted_mw=120.0, available_mw=115.0,
                     strike_price_aud_mwh=295.0, contract_start="2025-04-01", contract_end="2025-10-31",
                     activations_ytd=5, total_activation_mw=580.0, contract_cost_m_aud=3.5),
        RertContract(contract_id="RERT-QLD-01", provider="Origin Energy DR", region="QLD1",
                     contract_type="RERT", contracted_mw=100.0, available_mw=95.0,
                     strike_price_aud_mwh=275.0, contract_start="2025-04-01", contract_end="2025-10-31",
                     activations_ytd=2, total_activation_mw=190.0, contract_cost_m_aud=2.8),
        RertContract(contract_id="RERT-SA-01", provider="Tesla VPP DR", region="SA1",
                     contract_type="RERT", contracted_mw=80.0, available_mw=75.0,
                     strike_price_aud_mwh=310.0, contract_start="2025-04-01", contract_end="2025-10-31",
                     activations_ytd=7, total_activation_mw=540.0, contract_cost_m_aud=2.5),
        RertContract(contract_id="SRAS-NSW-01", provider="Schneider Electric", region="NSW1",
                     contract_type="SRAS", contracted_mw=60.0, available_mw=58.0,
                     strike_price_aud_mwh=450.0, contract_start="2025-01-01", contract_end="2025-12-31",
                     activations_ytd=1, total_activation_mw=55.0, contract_cost_m_aud=2.7),
        RertContract(contract_id="SRAS-SA-01", provider="Neoen DR (HPR)", region="SA1",
                     contract_type="SRAS", contracted_mw=70.0, available_mw=70.0,
                     strike_price_aud_mwh=420.0, contract_start="2025-01-01", contract_end="2025-12-31",
                     activations_ytd=8, total_activation_mw=540.0, contract_cost_m_aud=2.9),
    ]

    activations = [
        DemandResponseActivation(activation_id="ACT-001", trading_interval="2025-07-14T15:30:00",
                                 region="NSW1", provider="Energy Australia DR", activation_type="RERT",
                                 activated_mw=120.5, duration_min=90, trigger="PRICE_SPIKE",
                                 spot_price_aud_mwh=12800.0, avoided_voll_m_aud=2.61, cost_aud=48200.0),
        DemandResponseActivation(activation_id="ACT-002", trading_interval="2025-07-12T16:15:00",
                                 region="SA1", provider="Tesla VPP DR", activation_type="RERT",
                                 activated_mw=75.2, duration_min=60, trigger="RESERVE_LOW",
                                 spot_price_aud_mwh=9500.0, avoided_voll_m_aud=1.09, cost_aud=28600.0),
        DemandResponseActivation(activation_id="ACT-003", trading_interval="2025-07-10T18:00:00",
                                 region="VIC1", provider="AGL Energy DR", activation_type="SRAS",
                                 activated_mw=95.0, duration_min=120, trigger="SYSTEM_EMERGENCY",
                                 spot_price_aud_mwh=14200.0, avoided_voll_m_aud=2.76, cost_aud=52800.0),
        DemandResponseActivation(activation_id="ACT-004", trading_interval="2025-07-08T13:05:00",
                                 region="QLD1", provider="Origin Energy DR", activation_type="RERT",
                                 activated_mw=88.3, duration_min=30, trigger="PRICE_SPIKE",
                                 spot_price_aud_mwh=7800.0, avoided_voll_m_aud=0.64, cost_aud=15400.0),
    ]

    providers = [
        DemandResponseProvider(provider_id="PROV-001", provider_name="Enel X Australia",
                               provider_type="AGGREGATOR", registered_mw=210.0,
                               regions=["NSW1", "VIC1", "SA1"], technologies=["HVAC", "Lighting", "Industrial Process"],
                               reliability_pct=96.5, avg_response_time_min=8.2),
        DemandResponseProvider(provider_id="PROV-002", provider_name="Tesla VPP",
                               provider_type="AGGREGATOR", registered_mw=185.0,
                               regions=["SA1", "VIC1", "NSW1"], technologies=["Residential Battery", "EV", "Solar"],
                               reliability_pct=94.8, avg_response_time_min=3.1),
        DemandResponseProvider(provider_id="PROV-003", provider_name="Energy Australia DR",
                               provider_type="RETAILER", registered_mw=320.0,
                               regions=["NSW1", "QLD1", "VIC1"], technologies=["C&I Load", "Pumps", "Refrigeration"],
                               reliability_pct=97.2, avg_response_time_min=12.5),
        DemandResponseProvider(provider_id="PROV-004", provider_name="AGL Energy DR",
                               provider_type="RETAILER", registered_mw=275.0,
                               regions=["VIC1", "NSW1", "SA1"], technologies=["C&I Load", "HVAC", "Pumping"],
                               reliability_pct=95.9, avg_response_time_min=11.8),
    ]

    total_contracted = sum(c.contracted_mw for c in contracts)
    total_available = sum(c.available_mw for c in contracts)
    total_cost = sum(c.contract_cost_m_aud for c in contracts)
    total_avoided = sum(a.avoided_voll_m_aud for a in activations)
    avg_dur = sum(a.duration_min for a in activations) / len(activations) if activations else 0

    return DemandResponseDashboard(
        timestamp=datetime.now(timezone.utc).isoformat(),
        total_contracted_mw=total_contracted,
        total_available_mw=total_available,
        activations_ytd=len(activations),
        total_activation_cost_m_aud=total_cost,
        avoided_voll_m_aud=round(total_avoided, 2),
        avg_activation_duration_min=avg_dur,
        contracts=contracts,
        activations=activations,
        providers=providers,
    )


@app.get("/api/demand-response/dashboard", response_model=DemandResponseDashboard,
         summary="Demand Response & RERT Dashboard", tags=["Demand Response"])
def get_demand_response_dashboard() -> DemandResponseDashboard:
    """RERT contracts, demand response activations, and provider analytics."""
    cached = _cache_get("demand_response")
    if cached is not None:
        return cached
    result = _build_dr_dashboard()
    _cache_set("demand_response", result, 3600)
    return result


# =========================================================================
# 10. FREQUENCY DASHBOARD
# =========================================================================

class FrequencyRecord(BaseModel):
    timestamp: str
    frequency_hz: float
    rocof_hz_per_s: float
    region: str
    deviation_hz: float
    band: str


class InertiaRecord(BaseModel):
    timestamp: str
    region: str
    synchronous_mws: float
    synthetic_mws: float
    total_mws: float
    min_requirement_mws: float
    adequate: bool
    rocof_risk: str


class FrequencyEventRecord(BaseModel):
    event_id: str
    timestamp: str
    event_type: str
    nadir_hz: float
    zenith_hz: float
    duration_seconds: float
    trigger: str
    region: str
    resolved: bool


class FrequencyDashboard(BaseModel):
    timestamp: str
    current_frequency_hz: float
    current_rocof: float
    current_band: str
    total_synchronous_inertia_mws: float
    recent_frequency: List[FrequencyRecord]
    inertia_by_region: List[InertiaRecord]
    recent_events: List[FrequencyEventRecord]


def _frequency_band(hz: float) -> str:
    if 49.85 <= hz <= 50.15:
        return "normal"
    elif 49.5 <= hz <= 50.5:
        return "warning"
    return "emergency"


def _build_frequency_dashboard() -> FrequencyDashboard:
    now = datetime.now(timezone.utc)
    ts = now.isoformat()
    seed = int(now.timestamp() / 5)

    # Build recent frequency series (60 points, 5-sec intervals)
    recent = []
    for i in range(60):
        pt = now - timedelta(seconds=5 * (59 - i))
        t = (seed - (59 - i)) * 0.3
        osc = 0.03 * math.sin(t) + 0.015 * math.sin(t * 2.7 + 1.1)
        excursion = 0.10 * math.sin(t * 4.0) if (seed + i) % 13 == 0 else 0.0
        hz = round(max(49.2, min(50.8, 50.0 + osc + excursion)), 4)
        if i == 0:
            rocof = 0.0
        else:
            rocof = round((hz - recent[-1].frequency_hz) / 5, 6)
        recent.append(FrequencyRecord(
            timestamp=pt.isoformat(), frequency_hz=hz, rocof_hz_per_s=rocof,
            region="NEM", deviation_hz=round(hz - 50.0, 6), band=_frequency_band(hz),
        ))

    inertia = [
        InertiaRecord(timestamp=ts, region="NSW1", synchronous_mws=14500.0, synthetic_mws=1200.0,
                      total_mws=15700.0, min_requirement_mws=6000.0, adequate=True, rocof_risk="low"),
        InertiaRecord(timestamp=ts, region="QLD1", synchronous_mws=12800.0, synthetic_mws=900.0,
                      total_mws=13700.0, min_requirement_mws=5500.0, adequate=True, rocof_risk="low"),
        InertiaRecord(timestamp=ts, region="VIC1", synchronous_mws=8200.0, synthetic_mws=1500.0,
                      total_mws=9700.0, min_requirement_mws=4000.0, adequate=True, rocof_risk="medium"),
        InertiaRecord(timestamp=ts, region="SA1", synchronous_mws=1800.0, synthetic_mws=2200.0,
                      total_mws=4000.0, min_requirement_mws=1500.0, adequate=True, rocof_risk="high"),
        InertiaRecord(timestamp=ts, region="TAS1", synchronous_mws=3500.0, synthetic_mws=400.0,
                      total_mws=3900.0, min_requirement_mws=1200.0, adequate=True, rocof_risk="medium"),
    ]

    events = [
        FrequencyEventRecord(event_id="FE-2025-0142", timestamp=(now - timedelta(hours=3)).isoformat(),
                             event_type="Under-frequency", nadir_hz=49.72, zenith_hz=50.02,
                             duration_seconds=8.2, trigger="Generator trip — Callide C4 460MW",
                             region="QLD1", resolved=True),
        FrequencyEventRecord(event_id="FE-2025-0141", timestamp=(now - timedelta(hours=18)).isoformat(),
                             event_type="Over-frequency", nadir_hz=49.98, zenith_hz=50.28,
                             duration_seconds=4.1, trigger="Interconnector trip — Basslink",
                             region="TAS1", resolved=True),
        FrequencyEventRecord(event_id="FE-2025-0140", timestamp=(now - timedelta(days=1, hours=6)).isoformat(),
                             event_type="Under-frequency", nadir_hz=49.65, zenith_hz=50.01,
                             duration_seconds=12.5, trigger="Load surge — smelter reconnection",
                             region="VIC1", resolved=True),
    ]

    current = recent[-1] if recent else None
    total_sync = sum(i.synchronous_mws for i in inertia)

    return FrequencyDashboard(
        timestamp=ts,
        current_frequency_hz=current.frequency_hz if current else 50.0,
        current_rocof=current.rocof_hz_per_s if current else 0.0,
        current_band=current.band if current else "normal",
        total_synchronous_inertia_mws=total_sync,
        recent_frequency=recent,
        inertia_by_region=inertia,
        recent_events=events,
    )


@app.get("/api/frequency/dashboard", response_model=FrequencyDashboard,
         summary="Frequency & Inertia Dashboard", tags=["Grid Operations"])
def get_frequency_dashboard() -> FrequencyDashboard:
    """Real-time frequency, ROCOF, inertia by region, and recent frequency events."""
    cached = _cache_get("frequency_dashboard")
    if cached is not None:
        return cached
    result = _build_frequency_dashboard()
    _cache_set("frequency_dashboard", result, 5)
    return result


# =========================================================================
# 11. ENERGY CYBER SECURITY DASHBOARD
# =========================================================================

class ESCAIncidentRecord(BaseModel):
    incident_id: str
    date: str
    severity: str
    category: str
    affected_systems: List[str]
    region: str
    status: str
    response_time_min: float
    description: str


class ESCAMaturityRecord(BaseModel):
    domain: str
    current_score: float
    target_score: float
    gap: float
    priority: str


class ESCAVulnerabilityRecord(BaseModel):
    cve_id: str
    severity: str
    affected_component: str
    exploit_available: bool
    patch_available: bool
    remediation_status: str


class ESCAAssetRecord(BaseModel):
    asset_class: str
    count: int
    patched_pct: float
    monitored_pct: float
    avg_age_years: float
    eol_pct: float


class ESCADashboard(BaseModel):
    timestamp: str
    incidents: List[ESCAIncidentRecord]
    maturity: List[ESCAMaturityRecord]
    vulnerabilities: List[ESCAVulnerabilityRecord]
    assets: List[ESCAAssetRecord]


def _build_esca_dashboard() -> ESCADashboard:
    incidents = [
        ESCAIncidentRecord(incident_id="ESCA-2025-0042", date="2025-10-14", severity="HIGH",
                           category="Phishing", affected_systems=["SCADA HMI", "Corporate Email"],
                           region="NSW1", status="Contained", response_time_min=12.5,
                           description="Targeted spear-phishing campaign aimed at SCADA operators"),
        ESCAIncidentRecord(incident_id="ESCA-2025-0041", date="2025-10-12", severity="MEDIUM",
                           category="Malware", affected_systems=["Engineering Workstation"],
                           region="VIC1", status="Resolved", response_time_min=28.0,
                           description="Malware detected on engineering workstation via USB media"),
        ESCAIncidentRecord(incident_id="ESCA-2025-0040", date="2025-10-10", severity="CRITICAL",
                           category="Network Intrusion", affected_systems=["OT Network", "Firewall"],
                           region="QLD1", status="Investigating", response_time_min=5.2,
                           description="Anomalous traffic pattern detected crossing IT/OT boundary"),
    ]
    maturity = [
        ESCAMaturityRecord(domain="Asset Management", current_score=2.8, target_score=4.0, gap=1.2, priority="High"),
        ESCAMaturityRecord(domain="Access Control", current_score=3.5, target_score=4.5, gap=1.0, priority="High"),
        ESCAMaturityRecord(domain="Detection & Response", current_score=3.2, target_score=4.0, gap=0.8, priority="Medium"),
        ESCAMaturityRecord(domain="Recovery Planning", current_score=2.5, target_score=4.0, gap=1.5, priority="Critical"),
        ESCAMaturityRecord(domain="Supply Chain Security", current_score=2.0, target_score=3.5, gap=1.5, priority="Critical"),
    ]
    vulnerabilities = [
        ESCAVulnerabilityRecord(cve_id="CVE-2025-21987", severity="CRITICAL", affected_component="Siemens S7-1500 PLC",
                                exploit_available=True, patch_available=True, remediation_status="Patching in progress"),
        ESCAVulnerabilityRecord(cve_id="CVE-2025-18432", severity="HIGH", affected_component="ABB RTU560",
                                exploit_available=False, patch_available=True, remediation_status="Scheduled"),
        ESCAVulnerabilityRecord(cve_id="CVE-2025-15891", severity="MEDIUM", affected_component="GE MarkVIe Turbine Controller",
                                exploit_available=False, patch_available=False, remediation_status="Mitigating controls applied"),
    ]
    assets = [
        ESCAAssetRecord(asset_class="SCADA Servers", count=245, patched_pct=62.0, monitored_pct=88.0, avg_age_years=8.5, eol_pct=22.0),
        ESCAAssetRecord(asset_class="RTUs", count=1820, patched_pct=45.0, monitored_pct=72.0, avg_age_years=12.0, eol_pct=35.0),
        ESCAAssetRecord(asset_class="PLCs", count=3400, patched_pct=38.0, monitored_pct=65.0, avg_age_years=10.5, eol_pct=28.0),
        ESCAAssetRecord(asset_class="Network Switches", count=890, patched_pct=85.0, monitored_pct=95.0, avg_age_years=5.0, eol_pct=8.0),
        ESCAAssetRecord(asset_class="IoT Sensors", count=12500, patched_pct=32.0, monitored_pct=55.0, avg_age_years=3.5, eol_pct=12.0),
    ]
    return ESCADashboard(
        timestamp=datetime.now(timezone.utc).isoformat(),
        incidents=incidents,
        maturity=maturity,
        vulnerabilities=vulnerabilities,
        assets=assets,
    )


@app.get("/api/energy-cyber-security/dashboard", response_model=ESCADashboard,
         summary="Energy Sector Cyber Security Dashboard", tags=["Cyber Security"])
def get_esca_dashboard() -> ESCADashboard:
    """OT/ICS security incidents, maturity scores, vulnerabilities, and asset inventory."""
    cached = _cache_get("esca_dashboard")
    if cached is not None:
        return cached
    result = _build_esca_dashboard()
    _cache_set("esca_dashboard", result, 300)
    return result


# =========================================================================
# 12. DER (Distributed Energy Resources) DASHBOARD
# =========================================================================

class VppUnit(BaseModel):
    vpp_id: str
    name: str
    region: str
    operator: str
    enrolled_sites: int
    total_capacity_mw: float
    available_mw: float
    dispatched_mw: float
    technology: str
    response_time_s: float


class DerSummary(BaseModel):
    region: str
    rooftop_solar_gw: float
    btm_battery_gwh: float
    ev_chargers: int
    smart_inverters: int
    active_vpp_mw: float
    net_demand_reduction_mw: float


class DerDashboard(BaseModel):
    timestamp: str
    nem_rooftop_solar_gw: float
    nem_btm_battery_gwh: float
    nem_net_demand_reduction_mw: float
    vpp_fleet: List[VppUnit]
    regional_der: List[DerSummary]


def _build_der_dashboard() -> DerDashboard:
    vpp_fleet = [
        VppUnit(vpp_id="VPP-SA-001", name="SA Power Networks VPP", region="SA1", operator="Tesla / SAPN",
                enrolled_sites=12_400, total_capacity_mw=62.0, available_mw=55.0, dispatched_mw=18.0,
                technology="Residential Battery", response_time_s=2.0),
        VppUnit(vpp_id="VPP-VIC-001", name="AGL Virtual Power Plant", region="VIC1", operator="AGL Energy",
                enrolled_sites=8_200, total_capacity_mw=41.0, available_mw=38.0, dispatched_mw=12.0,
                technology="Residential Battery + Solar", response_time_s=3.5),
        VppUnit(vpp_id="VPP-NSW-001", name="Endeavour Energy VPP", region="NSW1", operator="Endeavour / Origin",
                enrolled_sites=6_800, total_capacity_mw=34.0, available_mw=30.0, dispatched_mw=8.0,
                technology="Residential Battery", response_time_s=4.0),
        VppUnit(vpp_id="VPP-QLD-001", name="Energex Virtual Solar", region="QLD1", operator="Energex / Simply",
                enrolled_sites=15_200, total_capacity_mw=76.0, available_mw=68.0, dispatched_mw=22.0,
                technology="Solar + Battery", response_time_s=2.5),
    ]
    regional_der = [
        DerSummary(region="NSW1", rooftop_solar_gw=5.8, btm_battery_gwh=1.2, ev_chargers=42_000,
                   smart_inverters=380_000, active_vpp_mw=34.0, net_demand_reduction_mw=1850.0),
        DerSummary(region="QLD1", rooftop_solar_gw=7.2, btm_battery_gwh=0.9, ev_chargers=28_000,
                   smart_inverters=420_000, active_vpp_mw=76.0, net_demand_reduction_mw=2400.0),
        DerSummary(region="VIC1", rooftop_solar_gw=4.5, btm_battery_gwh=1.0, ev_chargers=38_000,
                   smart_inverters=310_000, active_vpp_mw=41.0, net_demand_reduction_mw=1420.0),
        DerSummary(region="SA1", rooftop_solar_gw=2.8, btm_battery_gwh=0.8, ev_chargers=18_000,
                   smart_inverters=195_000, active_vpp_mw=62.0, net_demand_reduction_mw=980.0),
        DerSummary(region="TAS1", rooftop_solar_gw=0.4, btm_battery_gwh=0.1, ev_chargers=4_000,
                   smart_inverters=28_000, active_vpp_mw=0.0, net_demand_reduction_mw=120.0),
    ]
    total_solar = sum(r.rooftop_solar_gw for r in regional_der)
    total_battery = sum(r.btm_battery_gwh for r in regional_der)
    total_reduction = sum(r.net_demand_reduction_mw for r in regional_der)

    return DerDashboard(
        timestamp=datetime.now(timezone.utc).isoformat(),
        nem_rooftop_solar_gw=round(total_solar, 1),
        nem_btm_battery_gwh=round(total_battery, 1),
        nem_net_demand_reduction_mw=round(total_reduction, 1),
        vpp_fleet=vpp_fleet,
        regional_der=regional_der,
    )


@app.get("/api/der/dashboard", response_model=DerDashboard,
         summary="Distributed Energy Resources Dashboard", tags=["Renewable Energy"])
def get_der_dashboard() -> DerDashboard:
    """Rooftop solar, behind-the-meter batteries, VPP fleet, and DER by region."""
    cached = _cache_get("der_dashboard")
    if cached is not None:
        return cached
    result = _build_der_dashboard()
    _cache_set("der_dashboard", result, 60)
    return result


# =========================================================================
# HOME PAGE API ENDPOINTS (frontend dashboard cards)
# =========================================================================

_NEM_REGIONS = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
_REGION_BASE_PRICES = {"NSW1": 72.5, "QLD1": 65.3, "VIC1": 55.8, "SA1": 88.1, "TAS1": 42.0}
_AEST = timezone(timedelta(hours=10))


# ---------------------------------------------------------------------------
# SQL query helper — query gold tables via Databricks SQL
# ---------------------------------------------------------------------------
_CATALOG = "energy_copilot_catalog"
_sql_connection = None


def _get_sql_connection():
    """Lazily create a Databricks SQL connection using SDK auth."""
    global _sql_connection
    if _sql_connection is not None:
        try:
            _sql_connection.cursor().execute("SELECT 1")
            return _sql_connection
        except Exception:
            _sql_connection = None

    try:
        from databricks.sdk import WorkspaceClient
        from databricks import sql as dbsql

        w = WorkspaceClient()
        host = w.config.host.rstrip("/").replace("https://", "")
        token = w.config.authenticate().get("Authorization", "").replace("Bearer ", "")

        # Find the first available SQL warehouse
        warehouses = list(w.warehouses.list())
        wh_id = None
        for wh in warehouses:
            if wh.state and str(wh.state).upper() in ("RUNNING", "STARTING"):
                wh_id = wh.id
                break
        if not wh_id and warehouses:
            wh_id = warehouses[0].id
        if not wh_id:
            logger.warning("No SQL warehouse found")
            return None

        _sql_connection = dbsql.connect(
            server_hostname=host,
            http_path=f"/sql/1.0/warehouses/{wh_id}",
            access_token=token,
        )
        logger.info("SQL connection established to %s warehouse %s", host, wh_id)
        return _sql_connection
    except Exception as exc:
        logger.warning("Cannot establish SQL connection: %s", exc)
        return None


def _query_gold(sql: str, params: Optional[dict] = None) -> Optional[List[Dict[str, Any]]]:
    """Run a SQL query and return list of dicts, or None on failure."""
    cache_key = f"sql:{hash(sql)}:{params}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    conn = _get_sql_connection()
    if conn is None:
        return None
    cursor = None
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        result = [dict(zip(columns, row)) for row in rows]
        # Only cache non-empty results to avoid caching transient misses
        if result:
            _cache_set(cache_key, result, ttl_seconds=25)
        return result
    except Exception as exc:
        logger.warning("SQL query failed: %s — %s", exc, sql[:120])
        return None
    finally:
        if cursor:
            try:
                cursor.close()
            except Exception:
                pass


@app.get("/api/prices/latest", summary="Latest spot prices", tags=["Market Data"])
async def prices_latest():
    """Current spot prices for all 5 NEM regions with trend indicators."""
    # Try gold table first
    rows = _query_gold(f"""
        WITH latest AS (
            SELECT region_id, rrp, interval_datetime,
                   LAG(rrp) OVER (PARTITION BY region_id ORDER BY interval_datetime) AS prev_rrp
            FROM {_CATALOG}.gold.nem_prices_5min
            WHERE interval_datetime >= current_timestamp() - INTERVAL 1 HOUR
        )
        SELECT region_id, rrp, interval_datetime, prev_rrp
        FROM latest
        WHERE (region_id, interval_datetime) IN (
            SELECT region_id, MAX(interval_datetime) FROM latest GROUP BY region_id
        )
    """)
    if rows:
        result = []
        for r in rows:
            price = float(r["rrp"])
            prev = float(r["prev_rrp"]) if r.get("prev_rrp") is not None else price
            trend = "up" if price > prev * 1.01 else ("down" if price < prev * 0.99 else "stable")
            result.append({
                "region": r["region_id"],
                "price": round(price, 2),
                "trend": trend,
                "updatedAt": str(r["interval_datetime"]),
            })
        # Fill any missing regions
        found = {r["region"] for r in result}
        now = datetime.now(_AEST)
        for region in _NEM_REGIONS:
            if region not in found:
                result.append({"region": region, "price": _REGION_BASE_PRICES[region], "trend": "stable", "updatedAt": now.isoformat()})
        return result

    # Fallback to mock
    now = datetime.now(_AEST)
    seed = int(now.timestamp() // 30)
    rng = random.Random(seed)
    trends = ["up", "down", "stable"]
    result = []
    for region in _NEM_REGIONS:
        base = _REGION_BASE_PRICES[region]
        price = round(base * rng.uniform(0.85, 1.15), 2)
        result.append({"region": region, "price": price, "trend": rng.choice(trends), "updatedAt": now.isoformat()})
    return result


@app.get("/api/prices/history", summary="Price history", tags=["Market Data"])
async def prices_history(
    region: str = Query("NSW1"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
):
    """Return 24 hours of 5-minute price points for a region."""
    rows = _query_gold(f"""
        SELECT interval_datetime, rrp
        FROM {_CATALOG}.gold.nem_prices_5min
        WHERE region_id = '{region}'
          AND interval_datetime >= current_timestamp() - INTERVAL 24 HOURS
        ORDER BY interval_datetime
    """)
    if rows and len(rows) > 10:
        return [{"timestamp": str(r["interval_datetime"]), "price": round(float(r["rrp"]), 2)} for r in rows]

    # Fallback to mock
    base = _REGION_BASE_PRICES.get(region, 70.0)
    now = datetime.now(timezone.utc)
    start_dt = now - timedelta(hours=24)
    rng = random.Random(hash(region) + int(start_dt.timestamp() // 3600))
    points = []
    for i in range(288):
        ts = start_dt + timedelta(minutes=5 * i)
        hour_frac = ts.hour + ts.minute / 60.0
        daily = math.sin((hour_frac - 4) / 24 * 2 * math.pi) * base * 0.3
        noise = rng.gauss(0, base * 0.08)
        price = round(max(0, base + daily + noise), 2)
        points.append({"timestamp": ts.isoformat(), "price": price})
    return points


@app.get("/api/market-summary/latest", summary="Market narrative summary", tags=["Market Data"])
async def market_summary_latest():
    """AI-generated market summary narrative."""
    rows = _query_gold(f"""
        SELECT summary_text, key_events, trading_date, avg_price_aud_mwh,
               max_price_aud_mwh, renewables_pct, generated_at
        FROM {_CATALOG}.gold.daily_market_summary
        WHERE trading_date >= current_date() - INTERVAL 1 DAY
        ORDER BY trading_date DESC, generated_at DESC
        LIMIT 1
    """)
    if rows and rows[0].get("summary_text"):
        r = rows[0]
        return {
            "summary_date": str(r["trading_date"]),
            "narrative": r["summary_text"],
            "model_id": "gold-table",
            "generated_at": str(r.get("generated_at") or datetime.now(timezone.utc).isoformat()),
            "word_count": len(str(r["summary_text"]).split()),
            "generation_succeeded": True,
        }

    # Build a data-driven summary from prices and generation tables
    price_rows = _query_gold(f"""
        SELECT region_id, AVG(rrp) AS avg_rrp, MAX(rrp) AS max_rrp, MIN(rrp) AS min_rrp
        FROM {_CATALOG}.gold.nem_prices_5min
        WHERE interval_datetime >= current_timestamp() - INTERVAL 6 HOURS
        GROUP BY region_id
    """)
    if price_rows:
        lines = []
        for pr in sorted(price_rows, key=lambda x: -float(x["avg_rrp"])):
            lines.append(f"{pr['region_id']} averaging ${float(pr['avg_rrp']):.0f}/MWh (range ${float(pr['min_rrp']):.0f}-${float(pr['max_rrp']):.0f})")
        narrative = f"NEM spot prices over the past 6 hours: {'; '.join(lines)}."
        return {
            "summary_date": date.today().isoformat(),
            "narrative": narrative,
            "model_id": "auto-summary",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "word_count": len(narrative.split()),
            "generation_succeeded": True,
        }

    # Static fallback
    today = date.today().isoformat()
    return {
        "summary_date": today,
        "narrative": (
            "The NEM experienced moderate demand across eastern states today, with "
            "South Australia recording elevated spot prices driven by high gas generation costs "
            "and lower-than-forecast wind output. Victoria and Tasmania continued to benefit from "
            "strong hydro availability, keeping wholesale prices below $60/MWh. NSW demand tracked "
            "near seasonal averages at approximately 8,400 MW, with rooftop solar offsetting "
            "early-afternoon peaks."
        ),
        "model_id": "static-fallback",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "word_count": 70,
        "generation_succeeded": True,
    }


@app.get("/api/generation", summary="Generation mix time series", tags=["Market Data"])
async def generation_timeseries(
    region: str = Query("NSW1"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
):
    """Return generation mix time series (30-min intervals, 24h) for a region."""
    rows = _query_gold(f"""
        SELECT interval_datetime, fuel_type, total_mw
        FROM {_CATALOG}.gold.nem_generation_by_fuel
        WHERE region_id = '{region}'
          AND interval_datetime >= current_timestamp() - INTERVAL 24 HOURS
        ORDER BY interval_datetime, fuel_type
    """)
    if rows and len(rows) > 10:
        from itertools import groupby
        # Pivot: group by interval, fuel_type columns
        by_interval = {}
        for r in rows:
            ts = str(r["interval_datetime"])
            if ts not in by_interval:
                by_interval[ts] = {"timestamp": ts}
            fuel = str(r["fuel_type"]).lower()
            by_interval[ts][fuel] = round(float(r["total_mw"]), 1)
        return list(by_interval.values())

    # Fallback to mock
    now = datetime.now(timezone.utc)
    start_dt = now - timedelta(hours=24)
    rng = random.Random(hash(region) + 42)
    fuel_bases = {
        "NSW1": {"coal": 5800, "gas": 820, "hydro": 680, "wind": 780, "solar": 720, "battery": 120},
        "QLD1": {"coal": 6200, "gas": 1100, "hydro": 420, "wind": 480, "solar": 980, "battery": 60},
        "VIC1": {"coal": 3200, "gas": 720, "hydro": 380, "wind": 1980, "solar": 420, "battery": 98},
        "SA1":  {"coal": 0, "gas": 620, "hydro": 0, "wind": 1820, "solar": 360, "battery": 210},
        "TAS1": {"coal": 0, "gas": 40, "hydro": 1950, "wind": 310, "solar": 80, "battery": 0},
    }
    bases = fuel_bases.get(region, fuel_bases["NSW1"])
    points = []
    for i in range(48):
        ts = start_dt + timedelta(minutes=30 * i)
        hour = ts.hour + ts.minute / 60.0
        solar_factor = max(0, math.sin((hour - 6) / 12 * math.pi)) if 6 <= hour <= 18 else 0.0
        row = {"timestamp": ts.isoformat()}
        for fuel, base_mw in bases.items():
            if fuel == "solar":
                val = base_mw * solar_factor * rng.uniform(0.7, 1.3)
            elif fuel == "wind":
                val = base_mw * rng.uniform(0.3, 1.2)
            elif fuel == "battery":
                val = base_mw * rng.uniform(-1.0, 1.0)
            else:
                val = base_mw * rng.uniform(0.85, 1.1)
            row[fuel] = round(val, 1)
        points.append(row)
    return points


@app.get("/api/interconnectors", summary="Interconnector flows", tags=["Market Data"])
async def interconnectors(intervals: int = Query(12)):
    """Return InterconnectorSummary matching frontend interface."""
    # IC metadata for from/to region mapping
    _ic_meta = {
        "N-Q-MNSP1":  {"from": "NSW1", "to": "QLD1", "limit": 700, "export_limit": 700, "import_limit": 600},
        "VIC1-NSW1":  {"from": "VIC1", "to": "NSW1", "limit": 1350, "export_limit": 1350, "import_limit": 1200},
        "V-SA":       {"from": "VIC1", "to": "SA1", "limit": 680, "export_limit": 680, "import_limit": 550},
        "T-V-MNSP1":  {"from": "TAS1", "to": "VIC1", "limit": 594, "export_limit": 594, "import_limit": 478},
        "V-S-MNSP1":  {"from": "VIC1", "to": "SA1", "limit": 220, "export_limit": 220, "import_limit": 200},
    }
    rows = _query_gold(f"""
        SELECT interconnector_id, mw_flow, export_limit_mw, import_limit_mw, interval_datetime,
               from_region, to_region
        FROM {_CATALOG}.gold.nem_interconnectors
        WHERE interval_datetime = (SELECT MAX(interval_datetime) FROM {_CATALOG}.gold.nem_interconnectors)
    """)
    if rows:
        now = str(rows[0]["interval_datetime"])
        interconnectors_list = []
        max_util = 0.0
        most_loaded = ""
        total_mw = 0.0
        for r in rows:
            ic_id = r["interconnector_id"]
            flow = float(r["mw_flow"])
            meta = _ic_meta.get(ic_id, {})
            limit = float(r.get("export_limit_mw") or meta.get("limit", 700))
            util = abs(flow) / limit if limit > 0 else 0
            if util > max_util:
                max_util = util
                most_loaded = ic_id
            total_mw += abs(flow)
            interconnectors_list.append({
                "interval_datetime": now,
                "interconnectorid": ic_id,
                "from_region": r.get("from_region") or meta.get("from", ""),
                "to_region": r.get("to_region") or meta.get("to", ""),
                "mw_flow": round(flow, 1),
                "mw_flow_limit": limit,
                "export_limit": float(r.get("export_limit_mw") or meta.get("export_limit", limit)),
                "import_limit": float(r.get("import_limit_mw") or meta.get("import_limit", limit)),
                "congested": util > 0.85,
            })
        return {"timestamp": now, "interconnectors": interconnectors_list, "most_loaded": most_loaded, "total_interstate_mw": round(total_mw, 0)}

    # Fallback to mock
    now = datetime.now(timezone.utc)
    rng = random.Random(int(now.timestamp() // 60))
    ic_data = [
        {"id": "N-Q-MNSP1", "from_region": "NSW1", "to_region": "QLD1", "baseMw": 280, "limit": 700, "export_limit": 700, "import_limit": 600},
        {"id": "VIC1-NSW1", "from_region": "VIC1", "to_region": "NSW1", "baseMw": 420, "limit": 1350, "export_limit": 1350, "import_limit": 1200},
        {"id": "V-SA", "from_region": "VIC1", "to_region": "SA1", "baseMw": -142, "limit": 680, "export_limit": 680, "import_limit": 550},
        {"id": "T-V-MNSP1", "from_region": "TAS1", "to_region": "VIC1", "baseMw": 87, "limit": 594, "export_limit": 594, "import_limit": 478},
        {"id": "V-S-MNSP1", "from_region": "VIC1", "to_region": "SA1", "baseMw": 95, "limit": 220, "export_limit": 220, "import_limit": 200},
    ]
    interconnectors_list = []
    max_util = 0.0
    most_loaded = ""
    total_mw = 0.0
    for ic in ic_data:
        flow = round(ic["baseMw"] * rng.uniform(0.6, 1.4), 1)
        util = abs(flow) / ic["limit"]
        if util > max_util:
            max_util = util
            most_loaded = ic["id"]
        total_mw += abs(flow)
        interconnectors_list.append({
            "interval_datetime": now.isoformat(), "interconnectorid": ic["id"],
            "from_region": ic["from_region"], "to_region": ic["to_region"],
            "mw_flow": flow, "mw_flow_limit": ic["limit"],
            "export_limit": ic["export_limit"], "import_limit": ic["import_limit"],
            "congested": util > 0.85,
        })
    return {"timestamp": now.isoformat(), "interconnectors": interconnectors_list, "most_loaded": most_loaded, "total_interstate_mw": round(total_mw, 0)}


@app.get("/api/forecasts", summary="Price forecasts", tags=["Market Data"])
async def forecasts(
    region: str = Query("NSW1"),
    horizon: str = Query("24h"),
):
    """Return price forecast points for a region and horizon."""
    now = datetime.now(timezone.utc)
    hours = 24
    if horizon.endswith("h"):
        hours = int(horizon[:-1])
    elif horizon.endswith("d"):
        hours = int(horizon[:-1]) * 24

    rows = _query_gold(f"""
        SELECT interval_datetime, predicted_rrp, prediction_lower_80, prediction_upper_80,
               spike_probability, horizon_intervals
        FROM {_CATALOG}.gold.price_forecasts
        WHERE region_id = '{region}'
          AND interval_datetime >= current_timestamp()
          AND interval_datetime <= current_timestamp() + INTERVAL {hours} HOURS
        ORDER BY interval_datetime
    """)
    if rows and len(rows) > 3:
        points = []
        for r in rows:
            pred = float(r["predicted_rrp"])
            lo = float(r.get("prediction_lower_80") or pred * 0.85)
            hi = float(r.get("prediction_upper_80") or pred * 1.15)
            h = int(r.get("horizon_intervals") or 1)
            conf = round(max(0.5, 0.92 - h * 0.02), 2)
            points.append({
                "timestamp": str(r["interval_datetime"]),
                "predicted": round(pred, 2),
                "lower": round(lo, 2),
                "upper": round(hi, 2),
                "price_p10": round(lo * 0.9, 2),
                "price_p90": round(hi * 1.1, 2),
                "forecast_confidence": conf,
            })
        return points

    # Fallback to mock
    base = _REGION_BASE_PRICES.get(region, 70.0)
    rng = random.Random(hash(region) + int(now.timestamp() // 3600))
    points = []
    for i in range(hours * 2):
        ts = now + timedelta(minutes=30 * i)
        hour = ts.hour + ts.minute / 60.0
        daily = math.sin((hour - 4) / 24 * 2 * math.pi) * base * 0.25
        noise = rng.gauss(0, base * 0.06)
        price = round(max(0, base + daily + noise), 2)
        ci_width = base * 0.15 * (1 + i / (hours * 2))
        points.append({
            "timestamp": ts.isoformat(), "predicted": price,
            "lower": round(max(0, price - ci_width), 2), "upper": round(price + ci_width, 2),
            "price_p10": round(max(0, price - ci_width * 0.8), 2), "price_p90": round(price + ci_width * 0.8, 2),
            "forecast_confidence": round(max(0.5, 0.92 - i / (hours * 4)), 2),
        })
    return points


@app.get("/api/prices/compare", summary="Multi-region price comparison", tags=["Market Data"])
async def prices_compare(
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    interval_minutes: int = Query(30),
):
    """Compare prices across all NEM regions over a time window."""
    now = datetime.now(timezone.utc)
    start_dt = now - timedelta(hours=24)
    steps = int(24 * 60 / interval_minutes)
    result = []
    for i in range(steps):
        ts = start_dt + timedelta(minutes=interval_minutes * i)
        row = {"timestamp": ts.isoformat()}
        for region in _NEM_REGIONS:
            base = _REGION_BASE_PRICES[region]
            rng = random.Random(hash(region) + i)
            hour = ts.hour + ts.minute / 60.0
            daily = math.sin((hour - 4) / 24 * 2 * math.pi) * base * 0.3
            row[region] = round(max(0, base + daily + rng.gauss(0, base * 0.08)), 2)
        result.append(row)
    return result


@app.get("/api/prices/spikes", summary="Price spike events", tags=["Market Data"])
async def prices_spikes(
    region: str = Query("NSW1"),
    hours_back: int = Query(24),
    spike_type: Optional[str] = Query(None),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
):
    """Return recent price spike events matching PriceSpikeEvent interface."""
    type_filter = ""
    if spike_type:
        type_filter = f"AND event_type = '{spike_type}'"
    rows = _query_gold(f"""
        SELECT detected_at, interval_datetime, metric_value, description, event_type, region_id
        FROM {_CATALOG}.gold.anomaly_events
        WHERE (region_id = '{region}' OR region_id IS NULL)
          AND event_type IN ('price_spike', 'negative_price', 'high', 'voll', 'negative')
          {type_filter}
          AND detected_at >= current_timestamp() - INTERVAL {int(hours_back)} HOURS
        ORDER BY detected_at DESC
        LIMIT 30
    """)
    if rows:
        spikes = []
        for i, r in enumerate(rows):
            dt = str(r.get("interval_datetime") or r["detected_at"])
            price = round(float(r.get("metric_value") or 300), 2)
            etype = str(r.get("event_type") or "price_spike")
            if etype == "negative_price":
                st = "negative"
            elif price > 5000:
                st = "voll"
            else:
                st = "high"
            spikes.append({
                "event_id": f"EVT-{region}-{i+1:04d}",
                "interval_datetime": dt,
                "region": r.get("region_id") or region,
                "rrp_aud_mwh": price,
                "spike_type": st,
                "duration_minutes": 5,
                "cause": str(r.get("description") or "demand_surge"),
                "resolved": True,
            })
        return spikes

    # Fallback to mock
    now = datetime.now(timezone.utc)
    rng = random.Random(hash(region) + 999)
    spikes = []
    causes = ["generator_trip", "demand_surge", "interconnector_constraint", "forecast_error", "low_wind", "high_temperature"]
    for i in range(rng.randint(3, 8)):
        spike_time = now - timedelta(hours=rng.uniform(1, hours_back))
        base = _REGION_BASE_PRICES.get(region, 70.0)
        st = rng.choice(["high", "voll", "negative"])
        if st == "negative":
            peak = round(-rng.uniform(10, 100), 2)
        elif st == "voll":
            peak = round(rng.uniform(5000, 16600), 2)
        else:
            peak = round(base * rng.uniform(5, 25), 2)
        duration = rng.randint(5, 30)
        spikes.append({
            "event_id": f"EVT-{region}-{i+1:04d}",
            "interval_datetime": spike_time.isoformat(),
            "region": region,
            "rrp_aud_mwh": peak,
            "spike_type": st,
            "duration_minutes": duration,
            "cause": rng.choice(causes),
            "resolved": True,
        })
    spikes.sort(key=lambda s: s["interval_datetime"], reverse=True)
    return spikes


@app.get("/api/prices/volatility", summary="Price volatility metrics", tags=["Market Data"])
async def prices_volatility():
    """Return SpikeAnalysisSummary with VolatilityStats[] for all NEM regions."""

    def _build_summary(regions_list):
        total_spikes = sum(r["spike_count"] for r in regions_list)
        most_volatile = max(regions_list, key=lambda r: r["std_dev"])["region"] if regions_list else "NSW1"
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "regions": regions_list,
            "total_spike_events_24h": total_spikes,
            "most_volatile_region": most_volatile,
        }

    rows = _query_gold(f"""
        WITH stats AS (
            SELECT region_id,
                   AVG(rrp) AS avg_price,
                   STDDEV(rrp) AS std_dev,
                   MAX(rrp) AS max_price,
                   MIN(rrp) AS min_price,
                   PERCENTILE_APPROX(rrp, 0.05) AS p5_price,
                   PERCENTILE_APPROX(rrp, 0.95) AS p95_price,
                   SUM(CASE WHEN rrp > 300 THEN 1 ELSE 0 END) AS spike_count,
                   SUM(CASE WHEN rrp < 0 THEN 1 ELSE 0 END) AS negative_count,
                   SUM(CASE WHEN rrp > 15000 THEN 1 ELSE 0 END) AS voll_count,
                   SUM(rrp) AS cumulative_price
            FROM {_CATALOG}.gold.nem_prices_5min
            WHERE interval_datetime >= current_timestamp() - INTERVAL 24 HOURS
            GROUP BY region_id
        )
        SELECT * FROM stats
    """)
    if rows:
        regions_list = []
        for r in rows:
            avg_p = float(r["avg_price"])
            std = float(r["std_dev"]) if r["std_dev"] else avg_p * 0.2
            cum_price = float(r.get("cumulative_price") or 0)
            # CPT (Cumulative Price Threshold) — AER sets this annually, ~$1.4M for 2025
            cpt_threshold = 1_389_600.0
            cpt_pct = round(min(100.0, (cum_price / cpt_threshold) * 100), 1) if cpt_threshold > 0 else 0
            regions_list.append({
                "region": r["region_id"],
                "period_days": 1,
                "mean_price": round(avg_p, 2),
                "std_dev": round(std, 2),
                "p5_price": round(float(r.get("p5_price") or avg_p * 0.3), 2),
                "p95_price": round(float(r.get("p95_price") or avg_p * 2.5), 2),
                "spike_count": int(r["spike_count"]),
                "negative_count": int(r.get("negative_count") or 0),
                "voll_count": int(r.get("voll_count") or 0),
                "max_price": round(float(r["max_price"]), 2),
                "min_price": round(float(r["min_price"]), 2),
                "cumulative_price_threshold": cpt_threshold,
                "cumulative_price_current": round(cum_price, 2),
                "cpt_utilised_pct": cpt_pct,
            })
        # Fill missing regions
        found = {r["region"] for r in regions_list}
        rng = random.Random(int(datetime.now(timezone.utc).timestamp() // 3600))
        for region in _NEM_REGIONS:
            if region not in found:
                base = _REGION_BASE_PRICES[region]
                regions_list.append({
                    "region": region, "period_days": 1,
                    "mean_price": base, "std_dev": round(base * 0.2, 2),
                    "p5_price": round(base * 0.3, 2), "p95_price": round(base * 2.5, 2),
                    "spike_count": 0, "negative_count": 0, "voll_count": 0,
                    "max_price": round(base * 2, 2), "min_price": round(base * 0.4, 2),
                    "cumulative_price_threshold": 1_389_600.0, "cumulative_price_current": 0,
                    "cpt_utilised_pct": 0,
                })
        return _build_summary(regions_list)

    # Fallback to mock
    rng = random.Random(int(datetime.now(timezone.utc).timestamp() // 3600))
    regions_list = []
    for region in _NEM_REGIONS:
        base = _REGION_BASE_PRICES[region]
        std = round(base * rng.uniform(0.1, 0.4), 2)
        spike_count = rng.randint(0, 5)
        neg_count = rng.randint(0, 2)
        cum_price = round(base * 288 * rng.uniform(0.8, 1.2), 2)  # ~288 intervals/day
        cpt_threshold = 1_389_600.0
        regions_list.append({
            "region": region, "period_days": 1,
            "mean_price": round(base * rng.uniform(0.95, 1.05), 2),
            "std_dev": std,
            "p5_price": round(base * rng.uniform(0.2, 0.4), 2),
            "p95_price": round(base * rng.uniform(2.0, 3.5), 2),
            "spike_count": spike_count, "negative_count": neg_count,
            "voll_count": 0,
            "max_price": round(base * rng.uniform(1.5, 3.0), 2),
            "min_price": round(base * rng.uniform(0.2, 0.6), 2),
            "cumulative_price_threshold": cpt_threshold,
            "cumulative_price_current": cum_price,
            "cpt_utilised_pct": round(min(100.0, (cum_price / cpt_threshold) * 100), 1),
        })
    return _build_summary(regions_list)


@app.get("/api/generation/units", summary="Generator units", tags=["Market Data"])
async def generation_units(region: str = Query("NSW1"), fuel_type: str = Query(None), min_output_mw: float = Query(0)):
    """Return GeneratorRecord[] matching frontend interface."""
    rng = random.Random(hash(region) + int(time.time() // 300))
    renewables = {"wind", "solar", "hydro", "battery"}
    units_data = {
        "NSW1": [
            {"duid": "BW01", "station_name": "Bayswater", "fuel_type": "Black Coal", "cap": 2640, "out": 2100},
            {"duid": "ERGS1", "station_name": "Eraring", "fuel_type": "Black Coal", "cap": 2880, "out": 2200},
            {"duid": "MTPIPER1", "station_name": "Mt Piper", "fuel_type": "Black Coal", "cap": 1400, "out": 1100},
            {"duid": "TALWA1", "station_name": "Tallawarra B", "fuel_type": "Natural Gas", "cap": 400, "out": 280},
            {"duid": "TUMUT3", "station_name": "Tumut 3", "fuel_type": "Hydro", "cap": 1800, "out": 680},
            {"duid": "SILVWF1", "station_name": "Silverton WF", "fuel_type": "Wind", "cap": 200, "out": 120},
            {"duid": "BOMENSF1", "station_name": "Bomen Solar", "fuel_type": "Solar", "cap": 120, "out": 55},
            {"duid": "WLGRVBS1", "station_name": "Wallgrove BESS", "fuel_type": "Battery", "cap": 50, "out": 20},
        ],
        "QLD1": [
            {"duid": "GLAD1", "station_name": "Gladstone", "fuel_type": "Black Coal", "cap": 1680, "out": 1400},
            {"duid": "TARONG1", "station_name": "Tarong", "fuel_type": "Black Coal", "cap": 1400, "out": 1100},
            {"duid": "CALL_B_1", "station_name": "Callide B", "fuel_type": "Black Coal", "cap": 700, "out": 580},
            {"duid": "BRAEMAR1", "station_name": "Braemar", "fuel_type": "Natural Gas", "cap": 504, "out": 320},
            {"duid": "CPGWF1", "station_name": "Coopers Gap WF", "fuel_type": "Wind", "cap": 453, "out": 280},
            {"duid": "WDNSSF1", "station_name": "Western Downs Solar", "fuel_type": "Solar", "cap": 400, "out": 190},
        ],
        "VIC1": [
            {"duid": "LYA1", "station_name": "Loy Yang A", "fuel_type": "Brown Coal", "cap": 2210, "out": 1800},
            {"duid": "LYB1", "station_name": "Loy Yang B", "fuel_type": "Brown Coal", "cap": 1000, "out": 820},
            {"duid": "NEWPT1", "station_name": "Newport", "fuel_type": "Natural Gas", "cap": 500, "out": 200},
            {"duid": "MACARTH1", "station_name": "Macarthur WF", "fuel_type": "Wind", "cap": 420, "out": 280},
            {"duid": "MOORBWF1", "station_name": "Moorabool WF", "fuel_type": "Wind", "cap": 312, "out": 190},
            {"duid": "VBBG1", "station_name": "Victorian Big Battery", "fuel_type": "Battery", "cap": 300, "out": 98},
        ],
        "SA1": [
            {"duid": "TORRB1", "station_name": "Torrens Island B", "fuel_type": "Natural Gas", "cap": 800, "out": 420},
            {"duid": "PELICPT1", "station_name": "Pelican Point", "fuel_type": "Natural Gas", "cap": 479, "out": 200},
            {"duid": "HDWF1", "station_name": "Hornsdale WF", "fuel_type": "Wind", "cap": 315, "out": 240},
            {"duid": "LGAPWF1", "station_name": "Lincoln Gap WF", "fuel_type": "Wind", "cap": 212, "out": 160},
            {"duid": "HPRG1", "station_name": "Hornsdale Power Reserve", "fuel_type": "Battery", "cap": 150, "out": 110},
            {"duid": "BNGLSF1", "station_name": "Bungala Solar", "fuel_type": "Solar", "cap": 220, "out": 100},
        ],
        "TAS1": [
            {"duid": "GORDON1", "station_name": "Gordon", "fuel_type": "Hydro", "cap": 432, "out": 350},
            {"duid": "POAT1", "station_name": "Poatina", "fuel_type": "Hydro", "cap": 300, "out": 220},
            {"duid": "REECE1", "station_name": "Reece", "fuel_type": "Hydro", "cap": 230, "out": 180},
            {"duid": "MUSSWF1", "station_name": "Musselroe WF", "fuel_type": "Wind", "cap": 168, "out": 110},
            {"duid": "TVPP1", "station_name": "Tamar Valley", "fuel_type": "Natural Gas", "cap": 200, "out": 40},
        ],
    }
    raw = units_data.get(region, units_data["NSW1"])
    result = []
    for u in raw:
        output = round(u["out"] + rng.uniform(-u["out"] * 0.05, u["out"] * 0.05), 1)
        avail = round(u["cap"] * rng.uniform(0.85, 1.0), 1)
        ft_lower = u["fuel_type"].lower()
        is_renew = any(k in ft_lower for k in renewables)
        if fuel_type and fuel_type.lower() not in ft_lower:
            continue
        if output < min_output_mw:
            continue
        result.append({
            "duid": u["duid"],
            "station_name": u["station_name"],
            "fuel_type": u["fuel_type"],
            "region": region,
            "registered_capacity_mw": u["cap"],
            "current_output_mw": output,
            "availability_mw": avail,
            "capacity_factor": round(output / u["cap"], 3) if u["cap"] > 0 else 0,
            "is_renewable": is_renew,
        })
    return result


@app.get("/api/generation/mix", summary="Generation mix percentages", tags=["Market Data"])
async def generation_mix_pct(region: str = Query("NSW1")):
    """Return GenerationSummary matching frontend interface."""
    renewables_set = {"hydro", "wind", "solar", "battery"}
    unit_counts = {"coal": 4, "gas": 5, "hydro": 6, "wind": 8, "solar": 10, "battery": 3}

    rows = _query_gold(f"""
        SELECT fuel_type, total_mw, unit_count, capacity_factor, emissions_tco2e, interval_datetime
        FROM {_CATALOG}.gold.nem_generation_by_fuel
        WHERE region_id = '{region}'
          AND interval_datetime = (
              SELECT MAX(interval_datetime)
              FROM {_CATALOG}.gold.nem_generation_by_fuel
              WHERE region_id = '{region}'
          )
    """)
    if rows:
        total_gen = sum(float(r["total_mw"]) for r in rows)
        fuel_mix = []
        renewable_mw = 0.0
        total_emissions = 0.0
        for r in rows:
            mw = float(r["total_mw"])
            fuel = str(r["fuel_type"])
            fuel_lower = fuel.lower()
            pct = round(mw / total_gen * 100, 1) if total_gen > 0 else 0
            is_renew = fuel_lower in renewables_set
            if is_renew:
                renewable_mw += mw
            if r.get("emissions_tco2e"):
                total_emissions += float(r["emissions_tco2e"])
            fuel_mix.append({
                "fuel_type": fuel.title(),
                "total_mw": round(mw, 0),
                "percentage": pct,
                "unit_count": int(r.get("unit_count") or unit_counts.get(fuel_lower, 3)),
                "is_renewable": is_renew,
            })
        carbon_intensity = round(total_emissions / total_gen, 2) if total_gen > 0 and total_emissions > 0 else round(random.uniform(0.4, 0.85), 2)
        return {
            "timestamp": str(rows[0]["interval_datetime"]),
            "total_generation_mw": round(total_gen, 0),
            "renewable_mw": round(renewable_mw, 0),
            "renewable_percentage": round(renewable_mw / total_gen * 100, 1) if total_gen > 0 else 0,
            "carbon_intensity_kg_co2_mwh": carbon_intensity,
            "region": region,
            "fuel_mix": fuel_mix,
        }

    # Fallback to mock
    mix_data = {
        "NSW1": {"Black Coal": 52.0, "Natural Gas": 8.5, "Hydro": 10.2, "Wind": 12.8, "Solar": 13.5, "Battery": 3.0},
        "QLD1": {"Black Coal": 58.0, "Natural Gas": 12.0, "Hydro": 5.0, "Wind": 7.5, "Solar": 15.5, "Battery": 2.0},
        "VIC1": {"Brown Coal": 48.0, "Natural Gas": 10.5, "Hydro": 6.0, "Wind": 25.0, "Solar": 7.5, "Battery": 3.0},
        "SA1":  {"Natural Gas": 22.0, "Wind": 48.0, "Solar": 18.0, "Battery": 12.0},
        "TAS1": {"Natural Gas": 3.0, "Hydro": 72.0, "Wind": 20.0, "Solar": 5.0},
    }
    total_gen_base = {"NSW1": 9500, "QLD1": 7200, "VIC1": 6800, "SA1": 2200, "TAS1": 1400}
    mix = mix_data.get(region, mix_data["NSW1"])
    rng = random.Random(int(datetime.now(timezone.utc).timestamp() // 300) + hash(region))
    total_gen = total_gen_base.get(region, 7000) + rng.uniform(-500, 500)
    adjusted = {}
    total_pct = 0.0
    for fuel, pct in mix.items():
        val = max(0, pct + rng.uniform(-2, 2))
        adjusted[fuel] = val
        total_pct += val
    fuel_mix = []
    renewable_mw = 0.0
    for fuel, val in adjusted.items():
        pct = round(val / total_pct * 100, 1)
        mw = round(total_gen * pct / 100, 0)
        is_renew = fuel in {"Hydro", "Wind", "Solar", "Battery"}
        if is_renew:
            renewable_mw += mw
        fuel_mix.append({"fuel_type": fuel, "total_mw": mw, "percentage": pct,
            "unit_count": {"Black Coal": 4, "Brown Coal": 3, "Natural Gas": 5, "Hydro": 6, "Wind": 8, "Solar": 10, "Battery": 3}.get(fuel, 3),
            "is_renewable": is_renew})
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(), "total_generation_mw": round(total_gen, 0),
        "renewable_mw": round(renewable_mw, 0),
        "renewable_percentage": round(renewable_mw / total_gen * 100, 1) if total_gen > 0 else 0,
        "carbon_intensity_kg_co2_mwh": round(rng.uniform(0.4, 0.85), 2), "region": region, "fuel_mix": fuel_mix,
    }


# =========================================================================
# SIDEBAR NAVIGATION API ENDPOINTS
# =========================================================================

# --- 1. BESS Fleet ---
@app.get("/api/bess/fleet", summary="BESS fleet overview", tags=["BESS"])
async def bess_fleet():
    """Return BESS fleet summary matching BessFleetSummary shape."""
    rng = random.Random(int(time.time() // 30))
    base_units = [
        {"duid": "HPRG1", "station_name": "Hornsdale Power Reserve", "region": "SA1", "capacity_mwh": 194, "power_mw": 150, "base_soc": 72.5, "mode": "discharging", "base_current_mw": 120.3, "cycles_today": 2, "revenue_today_aud": 45200, "efficiency_pct": 87.5},
        {"duid": "WRSF1", "station_name": "Waratah Super Battery", "region": "NSW1", "capacity_mwh": 1680, "power_mw": 850, "base_soc": 58.3, "mode": "charging", "base_current_mw": -450.0, "cycles_today": 1, "revenue_today_aud": 89400, "efficiency_pct": 91.2},
        {"duid": "VBBG1", "station_name": "Victorian Big Battery", "region": "VIC1", "capacity_mwh": 450, "power_mw": 300, "base_soc": 85.1, "mode": "standby", "base_current_mw": 0.0, "cycles_today": 3, "revenue_today_aud": 23100, "efficiency_pct": 88.9},
        {"duid": "BSLD1", "station_name": "Bouldercombe Battery", "region": "QLD1", "capacity_mwh": 400, "power_mw": 200, "base_soc": 41.7, "mode": "discharging", "base_current_mw": 180.5, "cycles_today": 2, "revenue_today_aud": 31500, "efficiency_pct": 86.3},
        {"duid": "TLSB1", "station_name": "Torrens Island BESS", "region": "SA1", "capacity_mwh": 500, "power_mw": 250, "base_soc": 63.4, "mode": "charging", "base_current_mw": -200.0, "cycles_today": 1, "revenue_today_aud": 37800, "efficiency_pct": 89.7},
    ]
    units = []
    for u in base_units:
        soc = round(u["base_soc"] + rng.uniform(-3, 3), 1)
        current_mw = round(u["base_current_mw"] + rng.uniform(-5, 5), 1) if u["mode"] != "standby" else 0.0
        units.append({
            "duid": u["duid"], "station_name": u["station_name"], "region": u["region"],
            "capacity_mwh": u["capacity_mwh"], "power_mw": u["power_mw"],
            "soc_pct": soc, "mode": u["mode"], "current_mw": current_mw,
            "cycles_today": u["cycles_today"], "revenue_today_aud": u["revenue_today_aud"],
            "efficiency_pct": u["efficiency_pct"],
        })
    discharging = sum(1 for u in units if u["mode"] == "discharging")
    charging = sum(1 for u in units if u["mode"] == "charging")
    idle = sum(1 for u in units if u["mode"] == "standby")
    total_soc = sum(u["soc_pct"] for u in units) / len(units)
    total_rev = sum(u["revenue_today_aud"] for u in units)
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_capacity_mwh": sum(u["capacity_mwh"] for u in units),
        "total_power_mw": sum(u["power_mw"] for u in units),
        "units_discharging": discharging,
        "units_charging": charging,
        "units_idle": idle,
        "fleet_avg_soc_pct": round(total_soc, 1),
        "fleet_revenue_today_aud": total_rev,
        "units": units,
    }


# --- 2. BESS Dispatch ---
@app.get("/api/bess/dispatch", summary="BESS dispatch history", tags=["BESS"])
async def bess_dispatch(
    duid: str = Query("HPRG1"),
    count: int = Query(48),
):
    """Return dispatch intervals matching BessDispatchInterval[] shape."""
    now = datetime.now(timezone.utc)
    rng = random.Random(hash(duid) + int(now.timestamp() // 30))
    soc = rng.uniform(40, 80)
    points = []
    for i in range(count):
        ts = now - timedelta(minutes=5 * (count - i))
        mw = round(rng.uniform(-150, 150), 1)
        soc = max(5, min(95, soc + mw * 5 / 60 / 194 * 100))
        rrp = round(rng.uniform(30, 180), 2)
        revenue = round(abs(mw) * rrp * 5 / 60, 2) if mw > 0 else 0.0
        points.append({
            "interval_datetime": ts.isoformat(),
            "duid": duid,
            "mw": mw,
            "soc_pct": round(soc, 1),
            "rrp_at_dispatch": rrp,
            "revenue_aud": revenue,
        })
    return points


# --- 3. Weather/Demand ---
@app.get("/api/weather/demand", summary="Weather-adjusted demand", tags=["Weather"])
async def weather_demand(
    region: str = Query("NSW1"),
    hours: int = Query(24),
):
    """Return WeatherDemandPoint[] (flat array, not wrapper object)."""
    now = datetime.now(timezone.utc)
    rng = random.Random(hash(region) + int(now.timestamp() // 30))
    base_demand = {"NSW1": 8500, "QLD1": 6200, "VIC1": 5800, "SA1": 1800, "TAS1": 1100}.get(region, 5000)
    baseline_demand = {"NSW1": 8200, "QLD1": 6000, "VIC1": 5600, "SA1": 1700, "TAS1": 1050}.get(region, 4800)
    points = []
    for i in range(hours * 2):  # 30-min intervals
        ts = now - timedelta(minutes=30 * (hours * 2 - i))
        hour = (ts.hour + ts.minute / 60.0)
        daily = math.sin((hour - 6) / 24 * 2 * math.pi) * base_demand * 0.2
        demand = round(base_demand + daily + rng.gauss(0, base_demand * 0.03), 0)
        temp = round(22 + 8 * math.sin((hour - 14) / 24 * 2 * math.pi) + rng.gauss(0, 1), 1)
        apparent = round(temp + rng.uniform(0.5, 2.5), 1)
        baseline = round(baseline_demand + daily * 0.9, 0)
        solar_irr = round(max(0, 800 * math.sin(max(0, (hour - 6) / 12 * math.pi))) + rng.gauss(0, 30), 1) if 6 <= hour <= 18 else 0.0
        wind = round(max(0, 15 + rng.gauss(0, 5)), 1)
        points.append({
            "timestamp": ts.isoformat(),
            "region": region,
            "temperature_c": temp,
            "apparent_temp_c": apparent,
            "demand_mw": demand,
            "demand_baseline_mw": baseline,
            "demand_deviation_mw": round(demand - baseline, 0),
            "wind_speed_kmh": wind,
            "solar_irradiance_wm2": solar_irr,
        })
    return points


# --- 4. Sustainability Dashboard ---
@app.get("/api/sustainability/dashboard", summary="Sustainability metrics", tags=["Sustainability"])
async def sustainability_dashboard(region: str = Query("NSW1")):
    """Return SustainabilityDashboard shape."""
    now = datetime.now(timezone.utc)
    rng = random.Random(hash(region) + int(time.time() // 30))
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    regional_intensity = []
    fuel_mix_by_region = {
        "NSW1": {"black_coal": 55, "gas": 8, "hydro": 7, "wind": 14, "solar": 12, "battery": 4},
        "QLD1": {"black_coal": 48, "gas": 15, "hydro": 3, "wind": 12, "solar": 18, "battery": 4},
        "VIC1": {"brown_coal": 40, "gas": 10, "hydro": 8, "wind": 22, "solar": 15, "battery": 5},
        "SA1": {"gas": 18, "wind": 42, "solar": 28, "battery": 12},
        "TAS1": {"hydro": 72, "wind": 20, "gas": 5, "solar": 3},
    }
    for r in regions:
        ren_pct = round(rng.uniform(18, 65), 0)
        regional_intensity.append({
            "region": r,
            "timestamp": now.isoformat(),
            "carbon_intensity_kg_co2_mwh": round(rng.uniform(400, 850), 0),
            "renewable_pct": ren_pct,
            "fossil_pct": round(100 - ren_pct, 0),
            "generation_mix": fuel_mix_by_region.get(r, {"coal": 50, "gas": 20, "wind": 15, "solar": 15}),
        })
    intensity_history = []
    for i in range(48):
        ts = now - timedelta(minutes=30 * (48 - i))
        hour = ts.hour + ts.minute / 60.0
        solar_factor = max(0, math.sin((hour - 6) / 12 * math.pi)) if 6 <= hour <= 18 else 0
        intensity_history.append({
            "region": "NEM",
            "timestamp": ts.isoformat(),
            "carbon_intensity_kg_co2_mwh": round(max(300, 620 - solar_factor * 200 + rng.gauss(0, 30)), 0),
            "renewable_pct": round(min(80, max(15, 38 + solar_factor * 25 + rng.gauss(0, 3))), 0),
            "fossil_pct": round(min(85, max(20, 62 - solar_factor * 25 + rng.gauss(0, 3))), 0),
            "generation_mix": {"coal": 40, "gas": 15, "wind": 20, "solar": round(solar_factor * 25, 0), "hydro": 8, "battery": 5},
        })
    return {
        "timestamp": now.isoformat(),
        "nem_carbon_intensity": round(rng.uniform(0.50, 0.75), 2),
        "nem_renewable_pct": round(rng.uniform(30, 48), 1),
        "annual_emissions_mt_co2": round(rng.uniform(130, 155), 1),
        "emissions_vs_2005_pct": round(rng.uniform(-40, -28), 1),
        "renewable_capacity_gw": round(rng.uniform(28, 36), 1),
        "renewable_target_gw": 50.0,
        "lgc_market": {
            "date": now.strftime("%Y-%m-%d"),
            "lgc_spot_price_aud": round(rng.uniform(35, 52), 2),
            "lgc_futures_2026": round(rng.uniform(38, 55), 2),
            "lgc_futures_2027": round(rng.uniform(32, 48), 2),
            "lgc_futures_2028": round(rng.uniform(28, 42), 2),
            "sts_price_aud": round(rng.uniform(28, 38), 2),
            "total_lgcs_surrendered_ytd": round(rng.uniform(20000, 35000), 0),
            "liable_entities_shortfall_gwh": round(rng.uniform(1.5, 5.0), 1),
        },
        "regional_intensity": regional_intensity,
        "intensity_history": intensity_history,
    }


# --- 5. Sustainability Intensity History ---
@app.get("/api/sustainability/intensity_history", summary="Carbon intensity history", tags=["Sustainability"])
async def sustainability_intensity_history(
    region: str = Query("NSW1"),
    hours: int = Query(24),
):
    """Return list of {region, timestamp, intensity_kg_mwh, renewable_pct}."""
    now = datetime.now(timezone.utc)
    rng = random.Random(hash(region) + int(now.timestamp() // 30))
    points = []
    for i in range(hours * 2):
        ts = now - timedelta(minutes=30 * (hours * 2 - i))
        hour = ts.hour + ts.minute / 60.0
        solar_factor = max(0, math.sin((hour - 6) / 12 * math.pi)) if 6 <= hour <= 18 else 0
        base_intensity = 750 - solar_factor * 300
        points.append({
            "region": region,
            "timestamp": ts.isoformat(),
            "carbon_intensity_kg_co2_mwh": round(max(100, base_intensity + rng.gauss(0, 30)), 0),
            "renewable_pct": round(min(90, max(10, 35 + solar_factor * 30 + rng.gauss(0, 3))), 0),
            "fossil_pct": round(min(85, max(10, 65 - solar_factor * 30 + rng.gauss(0, 3))), 0),
            "generation_mix": {"coal": 40, "gas": 15, "wind": 20, "solar": round(solar_factor * 25, 0), "hydro": 8, "battery": 5},
        })
    return points


# --- 6. Merit Order ---
@app.get("/api/merit/order", summary="Merit order stack", tags=["Market Data"])
async def merit_order(region: str = Query("NSW1")):
    """Return MeritOrderCurve shape with units sorted by offer price."""
    rng = random.Random(hash(region) + int(time.time() // 30))
    now = datetime.now(timezone.utc)
    fuel_label = {"coal": "Black Coal", "gas": "Gas (CCGT)", "solar": "Solar", "wind": "Wind", "hydro": "Hydro"}
    generators = [
        {"duid": "ERGS1", "station_name": "Eraring", "fuel_type": "Black Coal", "region": "NSW1", "capacity_mw": 720, "fuel_key": "coal"},
        {"duid": "BW01", "station_name": "Bayswater", "fuel_type": "Black Coal", "region": "NSW1", "capacity_mw": 660, "fuel_key": "coal"},
        {"duid": "BAYSW3", "station_name": "Bayswater 3", "fuel_type": "Black Coal", "region": "NSW1", "capacity_mw": 660, "fuel_key": "coal"},
        {"duid": "CALL_B_1", "station_name": "Callide B", "fuel_type": "Black Coal", "region": "QLD1", "capacity_mw": 700, "fuel_key": "coal"},
        {"duid": "TALWA1", "station_name": "Tallawarra", "fuel_type": "Gas (CCGT)", "region": "NSW1", "capacity_mw": 435, "fuel_key": "gas"},
        {"duid": "MOREESF1", "station_name": "Moree Solar Farm", "fuel_type": "Solar", "region": "NSW1", "capacity_mw": 56, "fuel_key": "solar"},
        {"duid": "SNWYSF1", "station_name": "Snowy 2.0", "fuel_type": "Hydro", "region": "NSW1", "capacity_mw": 2040, "fuel_key": "hydro"},
        {"duid": "HDWF1", "station_name": "Hornsdale Wind Farm", "fuel_type": "Wind", "region": "SA1", "capacity_mw": 315, "fuel_key": "wind"},
        {"duid": "URANQ1", "station_name": "Uranquinty", "fuel_type": "Gas (CCGT)", "region": "NSW1", "capacity_mw": 664, "fuel_key": "gas"},
        {"duid": "MACARTH1", "station_name": "Macarthur Wind", "fuel_type": "Wind", "region": "VIC1", "capacity_mw": 420, "fuel_key": "wind"},
    ]
    cost_ranges = {"coal": (20, 45), "gas": (55, 120), "solar": (-60, 0), "wind": (-55, 5), "hydro": (10, 70)}
    for g in generators:
        lo, hi = cost_ranges.get(g["fuel_key"], (30, 80))
        g["marginal_cost_aud_mwh"] = round(rng.uniform(lo, hi), 1)
        g["current_offer_price"] = round(g["marginal_cost_aud_mwh"] + rng.uniform(0, 8), 1)
        pct = rng.uniform(0.3, 1.0)
        g["dispatched_mw"] = round(g["capacity_mw"] * pct, 0)
        del g["fuel_key"]
    generators.sort(key=lambda x: x["current_offer_price"])
    cumulative = 0
    for g in generators:
        cumulative += g["dispatched_mw"]
        g["cumulative_mw"] = round(cumulative, 0)
    demand = round(rng.uniform(7500, 9500), 0)
    marginal_gen = None
    smc = 0.0
    for g in generators:
        if g["cumulative_mw"] >= demand:
            marginal_gen = g["duid"]
            smc = g["current_offer_price"]
            break
    if marginal_gen is None:
        marginal_gen = generators[-1]["duid"]
        smc = generators[-1]["current_offer_price"]
    for g in generators:
        g["on_merit"] = g["cumulative_mw"] <= cumulative
    return {
        "region": region,
        "timestamp": now.isoformat(),
        "demand_mw": demand,
        "marginal_generator": marginal_gen,
        "system_marginal_cost": smc,
        "total_supply_mw": round(cumulative, 0),
        "units": generators,
    }


# --- 7. Trading Dashboard ---
@app.get("/api/trading/dashboard", summary="Trading P&L dashboard", tags=["Trading"])
async def trading_dashboard():
    """Return TradingDashboard shape with positions and spreads."""
    now = datetime.now(timezone.utc)
    rng = random.Random(int(time.time() // 30))
    # Build positions inline
    products = ["Base Swap", "Peak Swap", "Cap $300", "Cap $500", "Asian Option", "CfD"]
    traders = ["Desk-A", "Desk-B", "Desk-C", "Algo-1"]
    counterparties = ["Origin Energy", "AGL", "EnergyAustralia", "Snowy Hydro", "Shell Energy"]
    positions = []
    total_long = 0
    total_short = 0
    total_pnl = 0
    for i in range(rng.randint(6, 12)):
        region = rng.choice(_NEM_REGIONS)
        direction = rng.choice(["long", "short"])
        vol = rng.choice([10, 25, 50, 100])
        entry = round(rng.uniform(40, 150), 2)
        current = round(entry * rng.uniform(0.8, 1.3), 2)
        pnl = round((current - entry) * vol * 48, 2) if direction == "long" else round((entry - current) * vol * 48, 2)
        if direction == "long":
            total_long += vol
        else:
            total_short += vol
        total_pnl += pnl
        positions.append({
            "position_id": f"POS-{1000 + i}",
            "trader": rng.choice(traders),
            "region": region,
            "product": rng.choice(products),
            "direction": direction,
            "volume_mw": vol,
            "entry_price_aud_mwh": entry,
            "current_price_aud_mwh": current,
            "pnl_aud": pnl,
            "open_date": (now - timedelta(days=rng.randint(1, 30))).strftime("%Y-%m-%d"),
            "expiry_date": (now + timedelta(days=rng.randint(7, 180))).strftime("%Y-%m-%d"),
            "counterparty": rng.choice(counterparties),
        })
    # Build spreads inline
    interconnectors = {"NSW1-QLD1": "QNI", "VIC1-SA1": "Heywood", "NSW1-VIC1": "VNI", "QLD1-SA1": "Terranora", "VIC1-TAS1": "Basslink"}
    pairs = [("NSW1", "QLD1"), ("VIC1", "SA1"), ("NSW1", "VIC1"), ("QLD1", "SA1"), ("VIC1", "TAS1")]
    spreads = []
    for r1, r2 in pairs:
        b1 = _REGION_BASE_PRICES.get(r1, 70)
        b2 = _REGION_BASE_PRICES.get(r2, 70)
        spot_spread = round((b1 - b2) * rng.uniform(0.5, 2.0), 2)
        cap = rng.choice([460, 700, 1000, 1350])
        flow = round(cap * rng.uniform(0.3, 0.95), 0)
        spreads.append({
            "region_from": r1,
            "region_to": r2,
            "interconnector": interconnectors.get(f"{r1}-{r2}", "Unknown"),
            "spot_spread_aud_mwh": spot_spread,
            "forward_spread_aud_mwh": round(spot_spread * rng.uniform(0.7, 1.3), 2),
            "flow_mw": flow,
            "capacity_mw": cap,
            "congestion_revenue_m_aud": round(abs(spot_spread) * flow / 1e6 * 24, 3),
            "arbitrage_opportunity": abs(spot_spread) > 10,
        })
    return {
        "timestamp": now.isoformat(),
        "total_long_mw": total_long,
        "total_short_mw": total_short,
        "net_position_mw": total_long - total_short,
        "total_pnl_aud": round(total_pnl, 2),
        "daily_volume_mw": total_long + total_short,
        "regions_active": len(set(p["region"] for p in positions)),
        "positions": positions,
        "spreads": spreads,
    }


# --- 8. Trading Positions ---
@app.get("/api/trading/positions", summary="Open trading positions", tags=["Trading"])
async def trading_positions():
    """Return TradingPosition[] matching frontend interface."""
    now = datetime.now(timezone.utc)
    rng = random.Random(int(time.time() // 30))
    products = ["Base Swap", "Peak Swap", "Cap $300", "Cap $500", "Asian Option", "CfD"]
    traders = ["Desk-A", "Desk-B", "Desk-C", "Algo-1"]
    counterparties = ["Origin Energy", "AGL", "EnergyAustralia", "Snowy Hydro", "Shell Energy"]
    positions = []
    for i in range(rng.randint(6, 15)):
        region = rng.choice(_NEM_REGIONS)
        direction = rng.choice(["long", "short"])
        vol = rng.choice([10, 25, 50, 100])
        entry = round(rng.uniform(40, 150), 2)
        current = round(entry * rng.uniform(0.8, 1.3), 2)
        pnl = round((current - entry) * vol * 48, 2) if direction == "long" else round((entry - current) * vol * 48, 2)
        positions.append({
            "position_id": f"POS-{1000 + i}",
            "trader": rng.choice(traders),
            "region": region,
            "product": rng.choice(products),
            "direction": direction,
            "volume_mw": vol,
            "entry_price_aud_mwh": entry,
            "current_price_aud_mwh": current,
            "pnl_aud": pnl,
            "open_date": (now - timedelta(days=rng.randint(1, 30))).strftime("%Y-%m-%d"),
            "expiry_date": (now + timedelta(days=rng.randint(7, 180))).strftime("%Y-%m-%d"),
            "counterparty": rng.choice(counterparties),
        })
    return positions


# --- 9. Trading Spreads ---
@app.get("/api/trading/spreads", summary="Inter-region spreads", tags=["Trading"])
async def trading_spreads():
    """Return RegionSpread[] matching frontend interface."""
    rng = random.Random(int(time.time() // 30))
    interconnectors = {"NSW1-QLD1": "QNI", "VIC1-SA1": "Heywood", "NSW1-VIC1": "VNI", "QLD1-SA1": "Terranora", "VIC1-TAS1": "Basslink"}
    pairs = [("NSW1", "QLD1"), ("VIC1", "SA1"), ("NSW1", "VIC1"), ("QLD1", "SA1"), ("VIC1", "TAS1")]
    spreads = []
    for r1, r2 in pairs:
        b1 = _REGION_BASE_PRICES.get(r1, 70)
        b2 = _REGION_BASE_PRICES.get(r2, 70)
        spot_spread = round((b1 - b2) * rng.uniform(0.5, 2.0), 2)
        cap = rng.choice([460, 700, 1000, 1350])
        flow = round(cap * rng.uniform(0.3, 0.95), 0)
        spreads.append({
            "region_from": r1,
            "region_to": r2,
            "interconnector": interconnectors.get(f"{r1}-{r2}", "Unknown"),
            "spot_spread_aud_mwh": spot_spread,
            "forward_spread_aud_mwh": round(spot_spread * rng.uniform(0.7, 1.3), 2),
            "flow_mw": flow,
            "capacity_mw": cap,
            "congestion_revenue_m_aud": round(abs(spot_spread) * flow / 1e6 * 24, 3),
            "arbitrage_opportunity": abs(spot_spread) > 10,
        })
    return spreads


# --- 10. Alerts ---
@app.get("/api/alerts", summary="Active alerts", tags=["Alerts"])
async def alerts_list():
    """Return Alert[] matching frontend interface."""
    rng = random.Random(int(time.time() // 30))
    now = datetime.now(timezone.utc)
    alert_defs = [
        {"region": "NSW1", "metric": "price", "threshold": 300},
        {"region": "SA1", "metric": "frequency", "threshold": 49.85},
        {"region": "QLD1", "metric": "demand", "threshold": 9000},
        {"region": "VIC1", "metric": "generation", "threshold": 200},
        {"region": "NSW1", "metric": "interconnector", "threshold": 95},
        {"region": "SA1", "metric": "battery_soc", "threshold": 15},
        {"region": "VIC1", "metric": "carbon_intensity", "threshold": 0.9},
        {"region": "QLD1", "metric": "price", "threshold": 500},
        {"region": "TAS1", "metric": "demand", "threshold": 1500},
        {"region": "SA1", "metric": "price", "threshold": 1000},
        {"region": "NSW1", "metric": "demand", "threshold": 12000},
        {"region": "VIC1", "metric": "price", "threshold": 300},
    ]
    channels = ["SLACK", "EMAIL"]
    statuses = ["armed", "triggered", "resolved"]
    alerts = []
    for i, a in enumerate(alert_defs):
        is_active = rng.random() > 0.3
        status = rng.choice(statuses)
        triggered_at = (now - timedelta(hours=rng.uniform(0.5, 48))).isoformat() if status != "armed" else None
        alerts.append({
            "id": f"ALT-{str(i + 1).zfill(3)}",
            "region": a["region"],
            "metric": a["metric"],
            "threshold": a["threshold"],
            "status": status,
            "triggeredAt": triggered_at,
            "isActive": is_active,
            "notificationChannel": rng.choice(channels),
        })
    return alerts


# --- 11. Alert Stats ---
@app.get("/api/alerts/stats", summary="Alert statistics", tags=["Alerts"])
async def alerts_stats():
    """Return AlertStats matching frontend interface."""
    rng = random.Random(int(time.time() // 30))
    return {
        "total_alerts": rng.randint(10, 20),
        "triggered_last_24h": rng.randint(1, 6),
        "notifications_sent": rng.randint(3, 12),
        "channels": ["SLACK", "EMAIL"],
        "most_triggered_region": rng.choice(_NEM_REGIONS),
    }


# --- 12. Demand Response ---
@app.get("/api/demand/response", summary="Demand response summary", tags=["Demand Response"])
async def demand_response(region: str = Query(None)):
    """Return DemandResponseSummary matching frontend interface."""
    rng = random.Random(int(time.time() // 30))
    now = datetime.now(timezone.utc)
    programs = ["EnergyAustralia DR", "AGL Virtual Power Plant", "Enel X", "Amber Electric Flex", "ShineHub VPP"]
    triggers = ["price_signal", "RERT_activation", "reliability_event", "frequency_event"]
    events = []
    for i in range(rng.randint(4, 8)):
        r = region if region else rng.choice(_NEM_REGIONS)
        mw = round(rng.uniform(10, 120), 1)
        events.append({
            "event_id": f"DRE-{2000 + i}",
            "program_name": rng.choice(programs),
            "region": r,
            "activation_time": (now - timedelta(hours=rng.uniform(0.5, 24))).isoformat(),
            "duration_minutes": rng.randint(15, 120),
            "mw_reduction": mw,
            "participants": rng.randint(200, 5000),
            "status": rng.choice(["active", "completed", "cancelled"]),
            "trigger_reason": rng.choice(triggers),
        })
    total_enrolled = round(rng.uniform(800, 2000), 0)
    total_activated = round(sum(e["mw_reduction"] for e in events if e["status"] in ("active", "completed")), 0)
    region_summaries = {}
    for r in _NEM_REGIONS:
        region_summaries[r] = round(rng.uniform(50, 400), 0)
    return {
        "timestamp": now.isoformat(),
        "active_programs": rng.randint(3, 8),
        "total_enrolled_mw": total_enrolled,
        "total_activated_mw_today": total_activated,
        "events_today": len([e for e in events if e["status"] != "cancelled"]),
        "events": events,
        "region_summaries": region_summaries,
    }


# --- 13. Market Notices ---
@app.get("/api/market-events/dashboard", summary="NEM market events dashboard", tags=["Market Data"])
async def market_events_dashboard():
    """Return MarketEventsDashboard matching frontend interface."""
    rng = random.Random(int(time.time() // 300))
    now = datetime.now(timezone.utc)

    event_types = ["LOR1", "LOR2", "LOR3", "direction", "administered_pricing", "constraint_violation", "frequency_event", "interconnector_trip"]
    severities = ["low", "medium", "high", "critical"]
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    causes = [
        "forecast demand exceeds available supply",
        "unplanned generator outage",
        "interconnector constraint binding",
        "high demand from extreme temperatures",
        "low wind generation across region",
        "transmission line fault",
        "frequency deviation outside normal band",
    ]

    # Recent events
    recent_events = []
    for i in range(rng.randint(6, 12)):
        et = rng.choice(event_types)
        sev = "critical" if et in ("LOR3", "administered_pricing") else rng.choice(severities)
        start = now - timedelta(hours=rng.uniform(0.5, 168))
        resolved = rng.random() > 0.2
        dur = rng.randint(5, 480) if resolved else None
        recent_events.append({
            "event_id": f"NEM-EVT-{2026}{i+1:04d}",
            "event_type": et,
            "region": rng.choice(regions),
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(minutes=dur)).isoformat() if dur else None,
            "duration_minutes": dur,
            "severity": sev,
            "description": rng.choice(causes),
            "affected_capacity_mw": round(rng.uniform(100, 2500), 0) if et != "frequency_event" else None,
            "administered_price": round(rng.uniform(300, 600), 2) if et == "administered_pricing" else None,
            "resolved": resolved,
        })
    recent_events.sort(key=lambda e: e["start_time"], reverse=True)

    # Interventions
    interventions = []
    intervention_types = ["direction", "instructions", "reliability_reserve"]
    for i in range(rng.randint(1, 4)):
        interventions.append({
            "intervention_id": f"INT-{2026}{i+1:03d}",
            "intervention_type": rng.choice(intervention_types),
            "region": rng.choice(regions),
            "duid": rng.choice(["BW01", "TORRB1", "APTS1", "PPCCGT", "YWPS1", None]),
            "station_name": rng.choice(["Bayswater", "Torrens Island B", "Angaston", "Pelican Point", "Yallourn", None]),
            "issued_time": (now - timedelta(hours=rng.uniform(1, 48))).isoformat(),
            "duration_hours": round(rng.uniform(0.5, 12), 1),
            "directed_mw": round(rng.uniform(50, 500), 0),
            "reason": rng.choice(causes),
            "market_notice_id": f"MN-{rng.randint(80000, 99999)}",
            "cost_est_aud": round(rng.uniform(50000, 2000000), 0),
        })

    # Price cap events
    price_cap_events = []
    cap_types = ["CPT", "MPC", "APC"]
    for i in range(rng.randint(0, 3)):
        price_cap_events.append({
            "event_id": f"CAP-{2026}{i+1:03d}",
            "region": rng.choice(regions),
            "date": (now - timedelta(days=rng.randint(0, 30))).strftime("%Y-%m-%d"),
            "cap_type": rng.choice(cap_types),
            "trigger_interval": (now - timedelta(hours=rng.uniform(1, 72))).isoformat(),
            "intervals_above_cap": rng.randint(1, 12),
            "cumulative_energy_mwh": round(rng.uniform(100, 5000), 1),
            "max_spot_price": round(rng.uniform(5000, 16600), 2),
            "total_apc_duration_hours": round(rng.uniform(0.5, 8), 1) if rng.random() > 0.5 else None,
        })

    critical = sum(1 for e in recent_events if e["severity"] == "critical")
    lor_today = sum(1 for e in recent_events if e["event_type"].startswith("LOR") and e["start_time"][:10] == now.strftime("%Y-%m-%d"))
    active_dirs = sum(1 for i in interventions if i["intervention_type"] == "direction")
    apc_hrs = sum(p["total_apc_duration_hours"] or 0 for p in price_cap_events)

    return {
        "period": "Last 7 days",
        "total_events": len(recent_events),
        "critical_events": critical,
        "interventions_this_week": len(interventions),
        "apc_hours_this_month": round(apc_hrs, 1),
        "lor_events_today": lor_today,
        "directions_active": active_dirs,
        "recent_events": recent_events,
        "interventions": interventions,
        "price_cap_events": price_cap_events,
    }


@app.get("/api/surveillance/dashboard", summary="Market surveillance dashboard", tags=["Market Data"])
async def surveillance_dashboard():
    """Return SurveillanceDashboard matching frontend interface."""
    rng = random.Random(int(time.time() // 300))
    now = datetime.now(timezone.utc)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    participants = ["Origin Energy", "AGL Energy", "EnergyAustralia", "Alinta Energy", "Snowy Hydro",
                    "CS Energy", "Stanwell", "Macquarie Generation", "Engie", "Delta Electricity"]
    notice_types = ["rebidding_investigation", "market_power_review", "price_manipulation", "compliance_audit",
                    "direction_compliance", "late_rebid", "false_misleading_offer"]
    rule_refs = ["NER 3.8.22A", "NER 3.8.1", "NEL s.46", "NER 3.15.6A", "NER 4.9.8", "NER 3.8.22"]
    breach_types = ["late_rebid", "false_rebid_reason", "excessive_market_power", "direction_non_compliance", "reporting_failure"]
    anomaly_types = ["price_spike_unexplained", "generation_withdrawal", "bid_stack_manipulation",
                     "interconnector_gaming", "capacity_withholding", "rebid_timing"]

    notices = []
    for i in range(rng.randint(4, 10)):
        td = (now - timedelta(days=rng.randint(0, 60))).strftime("%Y-%m-%d")
        resolved = rng.random() > 0.4
        notices.append({
            "notice_id": f"SN-{2026}-{i+1:04d}",
            "notice_type": rng.choice(notice_types),
            "region": rng.choice(regions),
            "participant": rng.choice(participants),
            "trading_date": td,
            "description": f"Investigation into {rng.choice(anomaly_types).replace('_', ' ')} behaviour",
            "status": rng.choice(["closed", "resolved"]) if resolved else rng.choice(["open", "under_review"]),
            "priority": rng.choice(["low", "medium", "high", "critical"]),
            "aemo_team": rng.choice(["Market Monitoring", "Compliance", "Enforcement", "Market Analysis"]),
            "resolution_date": (now - timedelta(days=rng.randint(0, 10))).strftime("%Y-%m-%d") if resolved else None,
            "outcome": rng.choice(["no_breach", "warning_issued", "referred_to_aer", "penalty_applied", "ongoing_monitoring"]) if resolved else None,
        })

    compliance = []
    for i in range(rng.randint(3, 8)):
        ref_to_aer = rng.random() > 0.7
        compliance.append({
            "record_id": f"CR-{2026}-{i+1:04d}",
            "participant": rng.choice(participants),
            "rule_reference": rng.choice(rule_refs),
            "rule_description": rng.choice(["Late rebidding obligation", "Good faith rebidding", "Market power conduct",
                                             "Direction compliance", "Reporting obligations", "Bidding in good faith"]),
            "breach_type": rng.choice(breach_types),
            "trading_date": (now - timedelta(days=rng.randint(0, 90))).strftime("%Y-%m-%d"),
            "region": rng.choice(regions),
            "penalty_aud": round(rng.uniform(0, 500000), 0) if rng.random() > 0.3 else 0,
            "status": rng.choice(["confirmed", "under_investigation", "dismissed", "penalty_issued"]),
            "referred_to_aer": ref_to_aer,
            "civil_penalty": ref_to_aer and rng.random() > 0.5,
        })

    anomalies = []
    for i in range(rng.randint(5, 15)):
        expected = round(rng.uniform(30, 120), 2)
        actual = round(expected * rng.uniform(1.5, 10), 2) if rng.random() > 0.3 else round(expected * rng.uniform(-0.5, 0.5), 2)
        anomalies.append({
            "anomaly_id": f"MA-{2026}-{i+1:04d}",
            "region": rng.choice(regions),
            "trading_interval": (now - timedelta(hours=rng.uniform(0, 168))).isoformat(),
            "anomaly_type": rng.choice(anomaly_types),
            "spot_price": actual,
            "expected_price": expected,
            "deviation_pct": round(((actual - expected) / expected) * 100, 1) if expected != 0 else 0,
            "generator_id": rng.choice(["BW01", "TORRB1", "APTS1", "YWPS1", "LD01", "MP1", "VPGS1", None]),
            "flagged": rng.random() > 0.4,
            "explanation": rng.choice([None, "demand forecast error", "generator trip", "rebid ahead of constraint",
                                        "correlated bidding pattern", "capacity withholding suspected"]),
        })

    referred = sum(1 for c in compliance if c["referred_to_aer"])
    total_penalties = sum(c["penalty_aud"] for c in compliance)
    open_inv = sum(1 for n in notices if n["status"] in ("open", "under_review"))

    return {
        "timestamp": now.isoformat(),
        "open_investigations": open_inv,
        "referred_to_aer_ytd": referred,
        "total_penalties_ytd_aud": round(total_penalties, 0),
        "participants_under_review": len(set(n["participant"] for n in notices if n["status"] in ("open", "under_review"))),
        "notices": notices,
        "compliance_records": compliance,
        "anomalies": anomalies,
    }


@app.get("/api/market-notices", summary="AEMO market notices", tags=["Live Ops"])
async def market_notices():
    """Return list of recent AEMO market notices."""
    rng = random.Random(int(time.time() // 30))
    now = datetime.now(timezone.utc)
    notice_types = [
        ("PRICES UNCHANGED", "Inter-regional prices unchanged for {region}"),
        ("MARKET INTERVENTION", "AEMO intervention event in {region}"),
        ("RECLASSIFICATION", "Non-credible contingency reclassified as credible: {region} interconnector"),
        ("GENERAL NOTICE", "Updated demand forecast for {region} trading interval"),
        ("CONSTRAINTS", "Constraint set invoked: {region}_XFER_LIMIT"),
        ("RESERVE NOTICE", "Lack of reserve level 1 (LOR1) in {region}"),
        ("MARKET SYSTEMS", "Market system update — scheduled maintenance window"),
    ]
    notices = []
    for i in range(rng.randint(5, 12)):
        ntype, template = rng.choice(notice_types)
        region = rng.choice(_NEM_REGIONS)
        notices.append({
            "id": f"MN-{50000 + rng.randint(0, 9999)}",
            "type": ntype,
            "severity": rng.choice(["info", "warning", "critical"]),
            "message": template.format(region=region),
            "issued_at": (now - timedelta(minutes=rng.uniform(5, 1440))).isoformat(),
            "region": region,
        })
    notices.sort(key=lambda x: x["issued_at"], reverse=True)
    return notices


# --- 14. Live Ops Status ---
@app.get("/api/live-ops/status", summary="System status overview", tags=["Live Ops"])
async def live_ops_status():
    """Return system status overview."""
    rng = random.Random(int(time.time() // 30))
    now = datetime.now(timezone.utc)
    services = ["AEMO MMS", "AEMO NEMWeb", "AEMO NEMDE", "Price Feed", "Generation Feed", "Interconnector Feed", "Forecast Engine"]
    statuses = []
    for svc in services:
        up = rng.random() > 0.08
        statuses.append({
            "service": svc,
            "status": "operational" if up else rng.choice(["degraded", "outage"]),
            "latency_ms": round(rng.uniform(15, 250), 0) if up else None,
            "last_check": (now - timedelta(seconds=rng.randint(5, 120))).isoformat(),
        })
    return {
        "overall": "operational" if all(s["status"] == "operational" for s in statuses) else "degraded",
        "services": statuses,
        "active_market_notices": rng.randint(2, 8),
        "nem_trading_interval": now.strftime("%Y-%m-%dT%H:%M:00Z"),
    }


# =========================================================================
# ADDITIONAL SIDEBAR ENDPOINTS (missing from initial deployment)
# =========================================================================

# --- Market Notices (frontend calls /api/market/notices) ---
@app.get("/api/market/notices", summary="Market notices (frontend path)", tags=["Live Ops"])
async def market_notices_frontend(severity: str = Query(None), notice_type: str = Query(None), limit: int = Query(20)):
    """Return MarketNotice[] matching frontend interface."""
    rng = random.Random(int(time.time() // 30))
    now = datetime.now(timezone.utc)
    notice_types = [
        ("PRICES UNCHANGED", "Inter-regional prices unchanged"),
        ("MARKET INTERVENTION", "AEMO intervention event"),
        ("RECLASSIFICATION", "Non-credible contingency reclassified as credible"),
        ("GENERAL NOTICE", "Updated demand forecast for trading interval"),
        ("CONSTRAINTS", "Constraint set invoked"),
        ("RESERVE NOTICE", "Lack of reserve level (LOR) declared"),
        ("MARKET SYSTEMS", "Market system update — scheduled maintenance window"),
    ]
    severities = ["info", "warning", "critical"]
    notices = []
    for i in range(min(limit, rng.randint(8, 18))):
        ntype_label, reason_base = rng.choice(notice_types)
        affected = rng.sample(_NEM_REGIONS, rng.randint(1, 3))
        sev = rng.choice(severities)
        if severity and sev != severity:
            continue
        if notice_type and ntype_label != notice_type:
            continue
        notices.append({
            "notice_id": f"MN-{50000 + rng.randint(0, 9999)}",
            "notice_type": ntype_label,
            "creation_date": (now - timedelta(minutes=rng.uniform(5, 2880))).isoformat(),
            "external_reference": f"AEMO-{rng.randint(10000, 99999)}",
            "reason": f"{reason_base} for {', '.join(affected)}",
            "regions_affected": affected,
            "severity": sev,
            "resolved": rng.random() > 0.4,
        })
    notices.sort(key=lambda x: x["creation_date"], reverse=True)
    return notices


# --- Dispatch Intervals ---
@app.get("/api/dispatch/intervals", summary="Dispatch interval analysis", tags=["Market Data"])
async def dispatch_intervals(region: str = Query("NSW1"), count: int = Query(12)):
    """Return DispatchSummary matching frontend interface."""
    rng = random.Random(hash(region) + int(time.time() // 30))
    now = datetime.now(timezone.utc)
    base_price = _REGION_BASE_PRICES.get(region, 70.0)
    intervals = []
    deviations = []
    for i in range(count):
        ts = now - timedelta(minutes=5 * (count - i))
        rrp = round(base_price + rng.gauss(0, base_price * 0.15), 2)
        pd_rrp = round(rrp + rng.gauss(0, 10), 2)
        dev = round(rrp - pd_rrp, 2)
        deviations.append(abs(dev))
        intervals.append({
            "interval_datetime": ts.isoformat(),
            "region": region,
            "rrp": rrp,
            "predispatch_rrp": pd_rrp,
            "rrp_deviation": dev,
            "totaldemand": round(rng.uniform(5000, 10000), 0),
            "dispatchablegeneration": round(rng.uniform(6000, 12000), 0),
            "net_interchange": round(rng.uniform(-500, 500), 0),
            "lower_reg_mw": round(rng.uniform(100, 400), 0),
        })
    max_dev = max(deviations) if deviations else 0
    surprise_count = sum(1 for d in deviations if d > base_price * 0.1)
    return {
        "region": region,
        "intervals": intervals,
        "mean_deviation": round(sum(deviations) / len(deviations), 2) if deviations else 0,
        "max_surprise": round(max_dev, 2),
        "surprise_intervals": surprise_count,
    }


# --- Settlement Summary ---
@app.get("/api/settlement/summary", summary="Settlement records", tags=["Market Data"])
async def settlement_summary():
    """Return SettlementRecord[] matching frontend interface."""
    rng = random.Random(int(time.time() // 30))
    now = datetime.now(timezone.utc)
    records = []
    for region in _NEM_REGIONS:
        base = _REGION_BASE_PRICES.get(region, 70.0)
        for i in range(6):
            ts = now - timedelta(minutes=30 * (6 - i))
            records.append({
                "trading_interval": ts.isoformat(),
                "region": region,
                "totaldemand_mw": round(rng.uniform(4000, 12000), 0),
                "net_interchange_mw": round(rng.uniform(-600, 600), 0),
                "rrp_aud_mwh": round(base + rng.gauss(0, base * 0.2), 2),
                "raise_reg_rrp": round(rng.uniform(5, 25), 2),
                "lower_reg_rrp": round(rng.uniform(3, 15), 2),
                "raise6sec_rrp": round(rng.uniform(2, 20), 2),
                "lower6sec_rrp": round(rng.uniform(1, 12), 2),
            })
    return records


# --- Alert History ---
@app.get("/api/alerts/history", summary="Alert trigger history", tags=["Alerts"])
async def alert_history(region: str = Query(None), hours_back: int = Query(24)):
    """Return AlertTriggerEvent[] matching frontend interface."""
    rng = random.Random(int(time.time() // 30))
    now = datetime.now(timezone.utc)
    alert_types = ["PRICE_THRESHOLD", "DEMAND_SURGE", "FCAS_PRICE", "FORECAST_SPIKE"]
    events = []
    for i in range(rng.randint(5, 15)):
        r = region if region else rng.choice(_NEM_REGIONS)
        at = rng.choice(alert_types)
        threshold = round(rng.uniform(100, 1000), 0)
        events.append({
            "event_id": f"ATE-{i + 1:04d}",
            "alert_id": f"ALT-{rng.randint(1, 12):03d}",
            "triggered_at": (now - timedelta(hours=rng.uniform(0, hours_back))).isoformat(),
            "region": r,
            "alert_type": at,
            "threshold": threshold,
            "actual_value": round(threshold * rng.uniform(1.01, 1.5), 2),
            "notification_sent": rng.random() > 0.1,
            "channel": rng.choice(["SLACK", "EMAIL", "IN_APP"]),
        })
    events.sort(key=lambda x: x["triggered_at"], reverse=True)
    return events


# --- Forecast Summary ---
@app.get("/api/forecasts/summary", summary="Forecast model summary", tags=["Forecasts"])
async def forecast_summary():
    """Return ForecastSummary matching frontend interface."""
    rng = random.Random(int(time.time() // 300))
    return {
        "regions": list(_NEM_REGIONS),
        "horizons_available": [1, 4, 12, 24, 48],
        "models_loaded": rng.randint(8, 15),
        "avg_confidence": round(rng.uniform(0.72, 0.92), 2),
        "price_mape_1hr": round(rng.uniform(3, 8), 1),
        "price_mape_4hr": round(rng.uniform(6, 14), 1),
        "price_mape_24hr": round(rng.uniform(12, 25), 1),
        "demand_mape_1hr": round(rng.uniform(1.5, 4), 1),
        "demand_mape_4hr": round(rng.uniform(3, 7), 1),
        "demand_mape_24hr": round(rng.uniform(5, 12), 1),
        "last_evaluation": datetime.now(timezone.utc).isoformat(),
    }


# --- Forecast Accuracy ---
@app.get("/api/forecasts/accuracy", summary="Forecast accuracy by region", tags=["Forecasts"])
async def forecast_accuracy(region: str = Query("NSW1")):
    """Return AccuracyRow[] matching frontend interface: [{horizon, mae, mape}]."""
    rng = random.Random(hash(region) + int(time.time() // 300))
    return [
        {"horizon": "1hr",  "mae": round(8 + rng.uniform(-2, 4), 1),  "mape": round(6 + rng.uniform(-1, 4), 1)},
        {"horizon": "4hr",  "mae": round(12 + rng.uniform(-2, 4), 1), "mape": round(10 + rng.uniform(-1, 4), 1)},
        {"horizon": "24hr", "mae": round(17 + rng.uniform(-3, 5), 1), "mape": round(15 + rng.uniform(-2, 4), 1)},
    ]


# --- Constraints ---
@app.get("/api/constraints", summary="Binding constraints", tags=["Market Data"])
async def constraints(region: str = Query("NSW1"), hours_back: int = Query(24), binding_only: str = Query("true")):
    """Return ConstraintRecord[] matching frontend interface."""
    rng = random.Random(hash(region) + int(time.time() // 30))
    now = datetime.now(timezone.utc)
    constraint_names = [
        f"{region}_XFER_LIMIT", f"N_Q_MNSP1_LIMIT", f"V_SA_FLOW_LIMIT",
        f"SYSTEM_NORMAL_{region}", f"N_NIL_CLWP_LIMIT", f"V_T_FLOW_LIMIT",
    ]
    records = []
    for i in range(rng.randint(4, 10)):
        ts = now - timedelta(hours=rng.uniform(0, hours_back))
        mv = round(rng.uniform(0, 150), 2)
        records.append({
            "interval_datetime": ts.isoformat(),
            "constraintid": rng.choice(constraint_names),
            "rhs": round(rng.uniform(200, 1500), 0),
            "marginalvalue": mv,
            "violationdegree": round(rng.uniform(0, 20), 2) if mv > 50 else 0.0,
        })
    return records


# --- FCAS Market ---
@app.get("/api/fcas/market", summary="FCAS market data", tags=["Market Data"])
async def fcas_market(region: str = Query("NSW1"), hours_back: int = Query(24)):
    """Return FcasRecord[] matching frontend interface."""
    rng = random.Random(hash(region) + int(time.time() // 30))
    now = datetime.now(timezone.utc)
    services = ["RAISE6SEC", "RAISE60SEC", "RAISE5MIN", "RAISEREG", "LOWER6SEC", "LOWER60SEC", "LOWER5MIN", "LOWERREG"]
    records = []
    for i in range(rng.randint(8, 20)):
        ts = now - timedelta(hours=rng.uniform(0, hours_back))
        records.append({
            "interval_datetime": ts.isoformat(),
            "regionid": region,
            "service": rng.choice(services),
            "totaldemand": round(rng.uniform(100, 600), 0),
            "clearedmw": round(rng.uniform(50, 400), 0),
            "rrp": round(rng.uniform(2, 80), 2),
        })
    return records


# --- DSP Dashboard ---
@app.get("/api/dsp/dashboard", summary="DSP dashboard", tags=["Demand Response"])
async def dsp_dashboard():
    """Return DspDashboard matching frontend interface."""
    rng = random.Random(int(time.time() // 30))
    now = datetime.now(timezone.utc)
    sectors = ["Aluminium Smelting", "Water Pumping", "Cold Storage", "Commercial HVAC", "Data Centres", "Steel Manufacturing"]
    programs = ["RERT", "WDR", "Reliability Panel", "ST-PASA"]
    participants = []
    for i in range(rng.randint(6, 12)):
        cap = round(rng.uniform(5, 200), 0)
        participants.append({
            "duid": f"DSP-{i + 1:03d}",
            "participant_name": f"{rng.choice(['AGL', 'Origin', 'EnergyAustralia', 'Enel X', 'Flow Power'])} - {rng.choice(sectors)}",
            "industry_sector": rng.choice(sectors),
            "region": rng.choice(_NEM_REGIONS),
            "registered_capacity_mw": cap,
            "response_time_minutes": rng.choice([5, 10, 15, 30, 60]),
            "dsp_program": rng.choice(programs),
            "min_activation_duration_hrs": rng.choice([1, 2, 4, 6]),
            "payment_type": rng.choice(["availability", "activation", "hybrid"]),
            "avg_activations_per_year": round(rng.uniform(2, 20), 1),
            "reliability_score_pct": round(rng.uniform(75, 99), 1),
        })
    activations = []
    for i in range(rng.randint(4, 10)):
        act_mw = round(rng.uniform(20, 300), 0)
        del_mw = round(act_mw * rng.uniform(0.7, 1.0), 0)
        activations.append({
            "event_id": f"DSPA-{i + 1:04d}",
            "date": (now - timedelta(days=rng.randint(0, 90))).strftime("%Y-%m-%d"),
            "region": rng.choice(_NEM_REGIONS),
            "trigger": rng.choice(["LOR2", "LOR3", "price_signal", "reliability_event"]),
            "activated_mw": act_mw,
            "delivered_mw": del_mw,
            "delivery_pct": round(del_mw / act_mw * 100, 1) if act_mw > 0 else 0,
            "duration_minutes": rng.randint(30, 240),
            "average_price_mwh": round(rng.uniform(300, 5000), 0),
            "participants_called": rng.randint(3, 30),
            "season": rng.choice(["summer", "winter", "shoulder"]),
        })
    curtailment = []
    for i in range(rng.randint(2, 5)):
        curtailment.append({
            "date": (now - timedelta(days=rng.randint(0, 180))).strftime("%Y-%m-%d"),
            "region": rng.choice(_NEM_REGIONS),
            "curtailment_type": rng.choice(["manual", "automatic", "rolling"]),
            "total_load_shed_mwh": round(rng.uniform(50, 500), 0),
            "customers_affected": rng.randint(1000, 50000),
            "duration_minutes": rng.randint(30, 360),
            "trigger_event": rng.choice(["extreme_heat", "generation_failure", "transmission_fault", "LOR3"]),
        })
    total_cap = sum(p["registered_capacity_mw"] for p in participants)
    return {
        "timestamp": now.isoformat(),
        "total_registered_capacity_mw": round(total_cap, 0),
        "total_participants": len(participants),
        "activations_ytd": len(activations),
        "total_delivered_mwh_ytd": round(sum(a["delivered_mw"] * a["duration_minutes"] / 60 for a in activations), 0),
        "avg_delivery_reliability_pct": round(sum(a["delivery_pct"] for a in activations) / len(activations), 1) if activations else 0,
        "top_sector_by_capacity": max(sectors, key=lambda s: sum(p["registered_capacity_mw"] for p in participants if p["industry_sector"] == s)),
        "participants": participants,
        "activations": activations,
        "curtailment_records": curtailment,
    }


# =========================================================================
# --- Realtime Operations Dashboard ---
@app.get("/api/realtime-ops/dashboard", summary="Realtime ops dashboard", tags=["Live Ops"])
async def realtime_ops_dashboard():
    """Return RealtimeOpsDashboard matching frontend interface."""
    rng = random.Random(int(time.time() // 30))
    now = datetime.now(timezone.utc)

    # Regions
    region_configs = {
        "NSW1": {"demand": 8500, "gen": 9200, "pv": 1800, "base_price": 85},
        "QLD1": {"demand": 6200, "gen": 6800, "pv": 2200, "base_price": 72},
        "VIC1": {"demand": 5800, "gen": 6100, "pv": 1200, "base_price": 58},
        "SA1":  {"demand": 1800, "gen": 2100, "pv": 900,  "base_price": 81},
        "TAS1": {"demand": 1100, "gen": 1300, "pv": 100,  "base_price": 42},
    }
    fuel_bases = {
        "NSW1": {"coal": 4800, "gas": 800, "wind": 1200, "solar": 1400, "hydro": 700, "battery": 300},
        "QLD1": {"coal": 3600, "gas": 600, "wind": 500,  "solar": 1500, "hydro": 200, "battery": 400},
        "VIC1": {"coal": 3200, "gas": 500, "wind": 1600, "solar": 400,  "hydro": 200, "battery": 200},
        "SA1":  {"gas": 500,   "wind": 900, "solar": 400, "battery": 300},
        "TAS1": {"hydro": 900, "wind": 250, "gas": 50,    "solar": 100},
    }
    regions = []
    for reg, cfg in region_configs.items():
        demand = round(cfg["demand"] + rng.gauss(0, cfg["demand"] * 0.04), 0)
        gen = round(cfg["gen"] + rng.gauss(0, cfg["gen"] * 0.03), 0)
        pv = round(cfg["pv"] * rng.uniform(0.3, 1.0), 0)
        price = round(cfg["base_price"] + rng.gauss(0, cfg["base_price"] * 0.2), 2)
        freq = round(50 + rng.gauss(0, 0.02), 3)
        mix = {}
        for fuel, base_mw in fuel_bases.get(reg, {}).items():
            mix[fuel] = round(base_mw * rng.uniform(0.6, 1.2), 0)
        regions.append({
            "region": reg,
            "timestamp": now.isoformat(),
            "total_demand_mw": demand,
            "generation_mw": gen,
            "rooftop_solar_mw": pv,
            "net_interchange_mw": round(gen - demand, 0),
            "spot_price_aud_mwh": price,
            "frequency_hz": freq,
            "reserve_mw": round(max(0, gen - demand + rng.uniform(200, 800)), 0),
            "generation_mix": mix,
        })

    # Interconnectors
    ic_defs = [
        {"ic": "N-Q-MNSP1",  "from": "NSW1", "to": "QLD1", "cap": 700,  "base": 280},
        {"ic": "VIC1-NSW1",   "from": "VIC1", "to": "NSW1", "cap": 1350, "base": 420},
        {"ic": "V-SA",        "from": "VIC1", "to": "SA1",  "cap": 680,  "base": -142},
        {"ic": "T-V-MNSP1",   "from": "TAS1", "to": "VIC1", "cap": 594,  "base": 87},
        {"ic": "Murraylink",   "from": "SA1",  "to": "VIC1", "cap": 220,  "base": 95},
    ]
    interconnectors = []
    for ic in ic_defs:
        flow = round(ic["base"] * rng.uniform(0.5, 1.5), 1)
        util = round(abs(flow) / ic["cap"] * 100, 1)
        interconnectors.append({
            "interconnector": ic["ic"],
            "from_region": ic["from"],
            "to_region": ic["to"],
            "flow_mw": flow,
            "capacity_mw": ic["cap"],
            "utilisation_pct": util,
            "binding": util > 85,
            "marginal_loss": round(rng.uniform(0.005, 0.04), 4),
        })

    # FCAS
    fcas_services = ["RAISE_6SEC", "RAISE_60SEC", "RAISE_5MIN", "RAISE_REG",
                     "LOWER_6SEC", "LOWER_60SEC", "LOWER_5MIN", "LOWER_REG"]
    fcas = []
    for svc in fcas_services:
        req = round(rng.uniform(150, 500), 0)
        cleared = round(req * rng.uniform(0.9, 1.15), 0)
        surplus = round((cleared - req) / req * 100, 1)
        fcas.append({
            "service": svc,
            "cleared_mw": cleared,
            "clearing_price_aud_mw": round(rng.uniform(2, 60), 2),
            "requirement_mw": req,
            "surplus_pct": max(0, surplus),
        })

    # Alerts
    alert_msgs = [
        ("PRICE", "CRITICAL", "Spot price exceeded $300/MWh in {r}"),
        ("FREQUENCY", "WARNING", "System frequency deviation >0.15 Hz in {r}"),
        ("RESERVE", "WARNING", "LOR1 declared — reserve margin below 1500 MW in {r}"),
        ("CONSTRAINT", "INFO", "Constraint set {r}_XFER_LIMIT binding at 92% capacity"),
        ("MARKET", "INFO", "AEMO market notice: updated demand forecast for {r}"),
        ("PRICE", "WARNING", "Negative pricing event in {r} — current $-15.20/MWh"),
        ("RESERVE", "CRITICAL", "LOR2 risk — reserve below 750 MW in {r}"),
    ]
    alerts = []
    for i in range(rng.randint(3, 7)):
        cat, sev, msg_tmpl = rng.choice(alert_msgs)
        r = rng.choice(_NEM_REGIONS)
        alerts.append({
            "alert_id": f"RTO-{rng.randint(10000, 99999)}",
            "severity": sev,
            "category": cat,
            "message": msg_tmpl.format(r=r),
            "region": r,
            "timestamp": (now - timedelta(minutes=rng.uniform(1, 120))).isoformat(),
            "acknowledged": rng.random() > 0.6,
        })
    alerts.sort(key=lambda a: ({"CRITICAL": 0, "WARNING": 1, "INFO": 2}.get(a["severity"], 3), a["timestamp"]))

    return {
        "timestamp": now.isoformat(),
        "regions": regions,
        "interconnectors": interconnectors,
        "fcas": fcas,
        "alerts": alerts,
    }


# =========================================================================
# Copilot Chat — Databricks Foundation Model API (pay-per-token)
# =========================================================================

_CHAT_MODEL = "databricks-claude-sonnet-4-6"

_SYSTEM_PROMPT_BASE = (
    "You are the AUS Energy Copilot, an expert AI assistant specialising in "
    "Australia's National Electricity Market (NEM). You have LIVE access to "
    "NEM market data which is provided below. Use this data to give specific, "
    "data-driven answers. Never say you don't have access to data — you DO. "
    "When discussing prices, use AUD $/MWh. Refer to NEM regions as NSW1, "
    "QLD1, VIC1, SA1, TAS1. Be concise but thorough."
)


async def _build_market_context() -> str:
    """Gather live market data from our own endpoints to inject as LLM context."""
    parts = []
    now = datetime.now(_AEST)
    parts.append(f"Current time (AEST): {now.strftime('%Y-%m-%d %H:%M:%S')}")

    # 1. Current spot prices
    try:
        prices = await prices_latest()
        lines = []
        for p in prices:
            lines.append(f"  {p['region']}: ${p['price']:.2f}/MWh ({p['trend']})")
        parts.append("CURRENT SPOT PRICES:\n" + "\n".join(lines))
    except Exception:
        pass

    # 2. Market summary narrative
    try:
        summary = await market_summary_latest()
        parts.append(f"MARKET SUMMARY:\n  {summary['narrative']}")
    except Exception:
        pass

    # 3. Price spikes (recent events across all regions)
    try:
        all_spikes = []
        for r in _NEM_REGIONS:
            spikes = await prices_spikes(region=r)
            all_spikes.extend(spikes)
        all_spikes.sort(key=lambda s: s["timestamp"], reverse=True)
        if all_spikes:
            lines = []
            for s in all_spikes[:10]:
                ts = s["timestamp"][:16].replace("T", " ")
                lines.append(
                    f"  {s['region']} {ts}: ${s['peakPrice']:.0f}/MWh "
                    f"({s['durationMinutes']}min, trigger={s['trigger']})"
                )
            parts.append("RECENT PRICE SPIKES (last 72h):\n" + "\n".join(lines))
    except Exception:
        pass

    # 4. Interconnector flows
    try:
        ic_data = await interconnectors()
        lines = []
        for ic in ic_data.get("interconnectors", []):
            cong = " CONGESTED" if ic.get("congested") else ""
            lines.append(
                f"  {ic['interconnectorid']} ({ic['from_region']}→{ic['to_region']}): "
                f"{ic['mw_flow']:.0f} MW / {ic['mw_flow_limit']} MW limit{cong}"
            )
        parts.append(
            f"INTERCONNECTOR FLOWS (total interstate: {ic_data.get('total_interstate_mw', 0):.0f} MW):\n"
            + "\n".join(lines)
        )
    except Exception:
        pass

    # 5. Generation mix for each region
    nem_total_gen = 0.0
    nem_total_renew = 0.0
    try:
        for r in _NEM_REGIONS:
            mix = await generation_mix_pct(region=r)
            total_mw = mix.get("total_generation_mw", 0)
            renew_pct = mix.get("renewable_percentage", 0)
            renew_mw = mix.get("renewable_mw", 0)
            nem_total_gen += total_mw
            nem_total_renew += renew_mw
            fuel_lines = []
            for fm in mix.get("fuel_mix", []):
                fuel_lines.append(
                    f"    {fm['fuel_type']}: {fm['percentage']:.1f}% "
                    f"({fm.get('total_mw', 0):.0f} MW, "
                    f"{'renewable' if fm.get('is_renewable') else 'fossil'})"
                )
            parts.append(
                f"GENERATION MIX — {r} (total {total_mw:.0f} MW, "
                f"renewable {renew_pct:.1f}% = {renew_mw:.0f} MW, "
                f"carbon intensity {mix.get('carbon_intensity_kg_co2_mwh', 0)} kg CO₂/MWh):\n"
                + "\n".join(fuel_lines)
            )
    except Exception as exc:
        logger.warning("Context: generation mix failed: %s", exc)

    if nem_total_gen > 0:
        parts.append(
            f"NEM TOTAL GENERATION: {nem_total_gen:.0f} MW, "
            f"renewable {nem_total_renew:.0f} MW ({nem_total_renew / nem_total_gen * 100:.1f}%)"
        )

    # 6. Price volatility
    try:
        vol = await prices_volatility()
        vol_regions = vol.get("regions", []) if isinstance(vol, dict) else vol
        lines = []
        for v in vol_regions:
            lines.append(
                f"  {v['region']}: avg=${v.get('mean_price', 0):.1f}, "
                f"std_dev=${v.get('std_dev', 0):.1f}, "
                f"range=[${v.get('min_price', 0):.0f}, ${v.get('max_price', 0):.0f}], "
                f"spikes={v.get('spike_count', 0)}"
            )
        parts.append("PRICE VOLATILITY (24h):\n" + "\n".join(lines))
    except Exception as exc:
        logger.warning("Context: volatility failed: %s", exc)

    # 7. BESS fleet summary
    try:
        fleet_data = await bess_fleet()
        if isinstance(fleet_data, dict):
            units = fleet_data.get("units", [])
            parts.append(
                f"BATTERY STORAGE FLEET: {len(units)} units, "
                f"{fleet_data.get('total_power_mw', 0):.0f} MW power capacity, "
                f"{fleet_data.get('total_capacity_mwh', 0):.0f} MWh energy capacity, "
                f"avg SoC {fleet_data.get('fleet_avg_soc_pct', 0):.1f}%, "
                f"{fleet_data.get('units_discharging', 0)} discharging, "
                f"{fleet_data.get('units_charging', 0)} charging, "
                f"{fleet_data.get('units_idle', 0)} idle, "
                f"fleet revenue today ${fleet_data.get('fleet_revenue_today_aud', 0):,.0f}"
            )
            bess_lines = []
            for u in units:
                bess_lines.append(
                    f"  {u['station_name']} ({u['region']}): {u['mode']}, "
                    f"{u['current_mw']:.0f} MW, SoC {u['soc_pct']:.0f}%, "
                    f"capacity {u['power_mw']} MW / {u['capacity_mwh']} MWh"
                )
            parts.append("BESS UNIT DETAIL:\n" + "\n".join(bess_lines))
    except Exception as exc:
        logger.warning("Context: BESS fleet failed: %s", exc)

    # 8. Alerts
    try:
        alert_data = await alerts_list()
        alerts = alert_data if isinstance(alert_data, list) else alert_data.get("alerts", [])
        if alerts:
            triggered = [a for a in alerts if a.get("status") == "triggered"]
            armed = [a for a in alerts if a.get("status") == "armed"]
            lines = []
            for a in triggered[:8]:
                lines.append(
                    f"  [{a.get('status', '').upper()}] {a['region']} {a['metric']} "
                    f"threshold={a.get('threshold')} triggered={a.get('triggeredAt', 'N/A')[:16]}"
                )
            for a in armed[:4]:
                lines.append(f"  [ARMED] {a['region']} {a['metric']} threshold={a.get('threshold')}")
            parts.append(
                f"ALERTS ({len(triggered)} triggered, {len(armed)} armed, {len(alerts)} total):\n"
                + "\n".join(lines)
            )
    except Exception as exc:
        logger.warning("Context: alerts failed: %s", exc)

    # 9. Demand response
    try:
        dr = await demand_response()
        if isinstance(dr, dict):
            parts.append(
                f"DEMAND RESPONSE: {dr.get('active_programs', 0)} active programs, "
                f"{dr.get('total_enrolled_mw', 0):.0f} MW enrolled, "
                f"{dr.get('total_activated_mw_today', 0):.0f} MW activated today, "
                f"{dr.get('events_today', 0)} events today"
            )
            events = dr.get("events", [])
            if events:
                ev_lines = []
                for ev in events[:5]:
                    ev_lines.append(
                        f"  {ev.get('program_name', 'N/A')}: {ev.get('mw_reduction', 0)} MW reduction, "
                        f"{ev.get('participants', 0)} participants, trigger={ev.get('trigger_reason', 'N/A')}"
                    )
                parts.append("DR EVENTS TODAY:\n" + "\n".join(ev_lines))
    except Exception as exc:
        logger.warning("Context: demand response failed: %s", exc)

    # 10. Forecasts summary (next 4h price outlook)
    try:
        for r in _NEM_REGIONS:
            fc = await forecasts(region=r, horizon="4h")
            if fc:
                prices_fc = [p["predicted"] for p in fc]
                avg_fc = sum(prices_fc) / len(prices_fc)
                min_fc = min(prices_fc)
                max_fc = max(prices_fc)
                parts.append(
                    f"PRICE FORECAST (next 4h) — {r}: "
                    f"avg ${avg_fc:.1f}, min ${min_fc:.1f}, max ${max_fc:.1f}/MWh"
                )
    except Exception as exc:
        logger.warning("Context: forecasts failed: %s", exc)

    # 11. Merit order snapshot (top generators)
    try:
        mo = await merit_order(region="NSW1")
        if isinstance(mo, dict) and mo.get("generators"):
            gens = mo["generators"][:5]
            mo_lines = []
            for g in gens:
                mo_lines.append(
                    f"  {g.get('station_name', g.get('duid', '?'))}: "
                    f"${g.get('offer_price', 0):.0f}/MWh, "
                    f"{g.get('capacity_mw', 0)} MW, {g.get('fuel_type', '?')}"
                )
            parts.append(f"MERIT ORDER — NSW1 (cheapest 5):\n" + "\n".join(mo_lines))
    except Exception as exc:
        logger.warning("Context: merit order failed: %s", exc)

    return "\n\n".join(parts)


@app.get("/api/debug/context")
async def debug_context():
    """Debug: show the market context that gets injected into the LLM."""
    try:
        ctx = await _build_market_context()
        return {"status": "ok", "length": len(ctx), "context": ctx}
    except Exception as exc:
        import traceback
        return {"status": "error", "error": str(exc), "traceback": traceback.format_exc()}


class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = Field(default_factory=list)


@app.post("/api/chat")
async def copilot_chat(req: ChatRequest):
    """
    Stream a chat completion from the Databricks Foundation Model API
    using the pay-per-token model databricks-claude-sonnet-4-6.
    Returns SSE with data chunks and a final `event: done` with token usage.
    """
    import httpx as _httpx

    # Use Databricks SDK for automatic auth (works in Databricks Apps environment)
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        db_host = w.config.host.rstrip("/")
        # Get auth headers from the SDK (handles OAuth, PAT, etc.)
        auth_headers = w.config.authenticate()
    except Exception as auth_exc:
        logger.error("Failed to initialise Databricks auth: %s", auth_exc)
        return JSONResponse(
            status_code=500,
            content={"error": f"Databricks authentication failed: {str(auth_exc)[:200]}"},
        )

    # Gather live market data context
    try:
        market_context = await _build_market_context()
    except Exception:
        market_context = "(Market data temporarily unavailable)"

    system_prompt = (
        f"{_SYSTEM_PROMPT_BASE}\n\n"
        f"=== LIVE NEM MARKET DATA ===\n{market_context}\n"
        f"=== END MARKET DATA ===\n\n"
        f"CRITICAL INSTRUCTIONS:\n"
        f"- You HAVE full live data above. NEVER say 'I don't have access to data' or "
        f"'real-time data is not included'. The data above IS real-time.\n"
        f"- Always answer with specific numbers from the data above.\n"
        f"- For generation questions: use the GENERATION MIX sections which show fuel type, MW, and percentages per region.\n"
        f"- For renewable questions: use renewable_percentage and renewable_mw from each region.\n"
        f"- For total NEM output: use the NEM TOTAL GENERATION line.\n"
        f"- For battery questions: use the BESS FLEET and BESS UNIT DETAIL sections.\n"
        f"- For forecast questions: use the PRICE FORECAST sections.\n"
        f"- Format responses cleanly with markdown tables where appropriate."
    )

    # Build messages array: system + history + current user message
    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for h in req.history[-20:]:  # limit history to last 20 turns
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": req.message})

    url = f"{db_host}/serving-endpoints/{_CHAT_MODEL}/invocations"

    async def _stream():
        input_tokens = 0
        output_tokens = 0
        try:
            async with _httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    url,
                    headers={
                        **auth_headers,
                        "Content-Type": "application/json",
                    },
                    json={
                        "messages": messages,
                        "max_tokens": 2048,
                        "stream": True,
                    },
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        err_text = body.decode("utf-8", errors="replace")
                        yield f'data: {json.dumps({"content": f"API error ({resp.status_code}): {err_text[:200]}"})}\n\n'
                        return

                    buffer = ""
                    async for chunk in resp.aiter_text():
                        buffer += chunk
                        while "\n" in buffer:
                            line, buffer = buffer.split("\n", 1)
                            line = line.strip()
                            if not line:
                                continue
                            if line.startswith("data: "):
                                data_str = line[6:].strip()
                                if data_str == "[DONE]":
                                    continue
                                try:
                                    data_obj = json.loads(data_str)
                                    # Extract token from streaming chunk
                                    choices = data_obj.get("choices", [])
                                    if choices:
                                        delta = choices[0].get("delta", {})
                                        content = delta.get("content", "")
                                        if content:
                                            yield f'data: {json.dumps({"content": content})}\n\n'
                                    # Capture usage if present (often in last chunk)
                                    usage = data_obj.get("usage")
                                    if usage:
                                        input_tokens = usage.get("prompt_tokens", 0)
                                        output_tokens = usage.get("completion_tokens", 0)
                                except json.JSONDecodeError:
                                    pass
        except Exception as exc:
            logger.exception("Chat stream error")
            yield f'data: {json.dumps({"content": f"Error: {str(exc)[:200]}"})}\n\n'

        # Send done event with token usage
        yield f'event: done\ndata: {json.dumps({"input_tokens": input_tokens, "output_tokens": output_tokens})}\n\n'
        yield "data: [DONE]\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")


# =========================================================================
# Copilot Sessions (lightweight in-memory mock)
# =========================================================================

_sessions: list[dict] = []


@app.get("/api/sessions")
async def list_sessions(limit: int = Query(default=20, ge=1, le=100)):
    """List recent copilot sessions."""
    return sorted(_sessions, key=lambda s: s["last_active"], reverse=True)[:limit]


@app.post("/api/sessions", status_code=201)
async def create_session():
    """Create a new copilot session."""
    now = datetime.now(timezone.utc).isoformat()
    session = {
        "session_id": str(uuid.uuid4()),
        "created_at": now,
        "last_active": now,
        "message_count": 0,
        "total_tokens": 0,
        "rating": None,
    }
    _sessions.append(session)
    return session


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Get a specific copilot session."""
    for s in _sessions:
        if s["session_id"] == session_id:
            return s
    raise HTTPException(status_code=404, detail="Session not found")



# =========================================================================
# MISSING DASHBOARD ENDPOINTS (stub data for all frontend pages)
# =========================================================================

@app.get("/api/spot-depth/dashboard", summary="Spot market depth", tags=["Market Data"])
async def spot_depth_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    regions = ["NSW1","QLD1","VIC1","SA1","TAS1"]
    bid_stacks = []
    for r in regions:
        for band in [0,50,100,200,500,1000,5000,15500]:
            bid_stacks.append({"interval":ts,"region":r,"price_band_aud_mwh":band,"cumulative_mw":random.randint(2000,12000),"technology":"Mixed","participant_count":random.randint(3,15)})
    order_flows = [{"interval":ts,"region":r,"buy_volume_mw":random.uniform(200,800),"sell_volume_mw":random.uniform(200,800),"net_flow_mw":random.uniform(-200,200),"price_impact_aud_mwh":random.uniform(-5,5),"participant_id":f"P{i}"} for i,r in enumerate(regions)]
    depth_snapshots = [{"snapshot_time":ts,"region":r,"bid_depth_mw":random.uniform(5000,15000),"offer_depth_mw":random.uniform(5000,15000),"bid_ask_spread_aud":random.uniform(1,20),"best_bid_aud":random.uniform(60,120),"best_ask_aud":random.uniform(65,130),"imbalance_ratio":random.uniform(0.8,1.2)} for r in regions]
    participant_flows = [{"participant":p,"region":regions[i%5],"avg_bid_mw":random.uniform(100,500),"avg_offer_mw":random.uniform(100,500),"market_share_pct":random.uniform(5,25),"rebid_frequency_day":random.uniform(1,10),"strategic_withholding_score":random.uniform(0,1)} for i,p in enumerate(["Origin","AGL","EnergyAustralia","Snowy Hydro","Alinta"])]
    return {"timestamp":ts,"bid_stacks":bid_stacks,"order_flows":order_flows,"depth_snapshots":depth_snapshots,"participant_flows":participant_flows}

@app.get("/api/spot-forecast/dashboard", summary="Spot price forecast", tags=["Market Data"])
async def spot_forecast_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    regions = ["NSW1","QLD1","VIC1","SA1","TAS1"]
    intervals = []
    for r in regions:
        for h in range(0,24,2):
            p50 = random.uniform(40,150)
            intervals.append({"trading_interval":f"2026-02-26T{h:02d}:00:00","region":r,"actual_price":p50*random.uniform(0.9,1.1) if h<12 else None,"forecast_p10":p50*0.7,"forecast_p50":p50,"forecast_p90":p50*1.5,"forecast_model":"XGBoost-v3","mae":random.uniform(5,20) if h<12 else None,"mape_pct":random.uniform(5,15) if h<12 else None})
    regional = [{"region":r,"current_price":random.uniform(50,130),"forecast_24h_avg":random.uniform(60,120),"forecast_7d_avg":random.uniform(55,110),"price_spike_prob_pct":random.uniform(2,25),"volatility_index":random.uniform(10,60),"trend":random.choice(["RISING","FALLING","STABLE"])} for r in regions]
    models = [{"model_name":m,"region":"NEM","period":"30d","mae":random.uniform(8,25),"rmse":random.uniform(12,35),"mape_pct":random.uniform(8,20),"r2_score":random.uniform(0.7,0.95),"spike_detection_rate_pct":random.uniform(60,90)} for m in ["XGBoost-v3","LSTM-Ensemble","Prophet-NEM","Ridge-Baseline"]]
    return {"timestamp":ts,"forecast_intervals":intervals,"regional_summary":regional,"model_performance":models,"next_spike_alert":None,"overall_forecast_accuracy_pct":82.4}

@app.get("/api/load-curve/dashboard", summary="Load duration curves", tags=["Market Data"])
async def load_curve_dashboard():
    regions = ["NSW1","QLD1","VIC1","SA1","TAS1"]
    hourly = []
    for r in regions:
        base = {"NSW1":7500,"QLD1":6200,"VIC1":5000,"SA1":1500,"TAS1":1000}[r]
        for season in ["Summer","Winter","Shoulder"]:
            for dt in ["Weekday","Weekend"]:
                for h in range(24):
                    factor = 0.7+0.3*abs(12-h)/12
                    d = base*factor*random.uniform(0.95,1.05)
                    hourly.append({"region":r,"season":season,"day_type":dt,"hour":h,"avg_demand_mw":round(d),"min_demand_mw":round(d*0.8),"max_demand_mw":round(d*1.3),"p10_demand_mw":round(d*0.85),"p90_demand_mw":round(d*1.2)})
    duration = [{"region":r,"year":2025,"percentile":p,"demand_mw":round({"NSW1":12000,"QLD1":9500,"VIC1":8000,"SA1":3200,"TAS1":2100}[r]*(1-p/120))} for r in regions for p in range(0,101,5)]
    peaks = [{"region":r,"year":y,"peak_demand_mw":round({"NSW1":13500,"QLD1":10800,"VIC1":9200,"SA1":3400,"TAS1":2200}[r]*random.uniform(0.95,1.05)),"peak_month":random.choice([1,2,7,8]),"peak_hour":random.choice([14,15,16,17,18]),"temperature_celsius":random.uniform(35,44),"coincident_peak_mw":round({"NSW1":13500,"QLD1":10800,"VIC1":9200,"SA1":3400,"TAS1":2200}[r]*0.9)} for r in regions for y in [2023,2024,2025]]
    seasonal = [{"region":r,"year":2025,"season":s,"avg_demand_mw":round({"NSW1":7500,"QLD1":6200,"VIC1":5000,"SA1":1500,"TAS1":1000}[r]*f),"demand_growth_pct":random.uniform(-1,3),"renewable_share_pct":random.uniform(20,65)} for r in regions for s,f in [("Summer",1.1),("Winter",1.05),("Shoulder",0.9),("Spring",0.85)]]
    return {"hourly_profiles":hourly,"duration_curves":duration,"peak_records":peaks,"seasonal_trends":seasonal,"summary":{"max_peak_demand_mw":13800,"min_demand_mw":4200,"avg_load_factor_pct":62.3,"demand_growth_yoy_pct":1.8}}

@app.get("/api/forward-curve/dashboard", summary="Energy futures forward curve", tags=["Market Data"])
async def forward_curve_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    regions = ["NSW1","QLD1","VIC1","SA1"]
    curves = []
    for r in regions:
        base = {"NSW1":85,"QLD1":90,"VIC1":75,"SA1":110}[r]
        for i,prod in enumerate(["Q2-2026","Q3-2026","Q4-2026","Q1-2027","CAL25","CAL26","CAL27","CAL28"]):
            pt = "CALENDAR" if prod.startswith("CAL") else "QUARTERLY"
            p = base*(1+i*0.03)*random.uniform(0.95,1.05)
            curves.append({"point_id":f"{r}-{prod}","region":r,"product":prod,"product_type":pt,"delivery_start":f"2026-{(i+4)%12+1:02d}-01","delivery_end":f"2026-{(i+5)%12+1:02d}-01","settlement_price_aud_mwh":round(p,2),"daily_volume_mw":random.randint(50,300),"open_interest_mw":random.randint(500,3000),"spot_to_forward_premium_pct":round(random.uniform(-5,15),1),"implied_volatility_pct":round(random.uniform(20,50),1),"last_trade_date":"2026-02-25"})
    caps = [{"option_id":f"CAP-{r}-{i}","region":r,"contract_type":"CAP","strike_price_aud_mwh":s,"settlement_period":"Q3-2026","premium_aud_mwh":round(random.uniform(2,15),2),"delta":round(random.uniform(0.1,0.6),3),"gamma":round(random.uniform(0.001,0.01),4),"vega":round(random.uniform(0.5,3),2),"implied_vol_pct":round(random.uniform(25,55),1),"open_interest_mw":random.randint(100,800),"in_the_money":s<100} for i,(r,s) in enumerate([(r,s) for r in ["NSW1","VIC1"] for s in [100,200,300]])]
    seasonal = [{"record_id":f"SP-{r}-{s}-{y}","region":r,"season":s,"year":y,"avg_spot_aud_mwh":round(random.uniform(50,120),2),"avg_forward_aud_mwh":round(random.uniform(55,130),2),"forward_premium_aud_mwh":round(random.uniform(-5,15),2),"realised_volatility_pct":round(random.uniform(20,60),1),"max_spike_aud_mwh":round(random.uniform(500,5000),0),"spike_hours":random.randint(2,30)} for r in regions for s in ["SUMMER","AUTUMN","WINTER","SPRING"] for y in [2023,2024,2025]]
    return {"timestamp":ts,"base_spot_nsw_aud_mwh":87.5,"curve_steepness_nsw":3.2,"avg_implied_vol_pct":35.8,"total_open_interest_mw":12500,"forward_curve":curves,"cap_options":caps,"seasonal_premiums":seasonal}

@app.get("/api/participant-market-share/dashboard", summary="Participant market share", tags=["Market Data"])
async def participant_market_share_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    companies = [("ORIG","Origin Energy","Origin"),("AGL","AGL Energy","AGL"),("EA","EnergyAustralia","CLP Group"),("SNOWY","Snowy Hydro","Australian Govt"),("ALINTA","Alinta Energy","Chow Tai Fook")]
    participants = []
    for pid,name,parent in companies:
        for r in ["NSW1","QLD1","VIC1","SA1","TAS1"]:
            port = random.randint(1000,5000)
            ren = round(port*random.uniform(0.2,0.5))
            participants.append({"participant_id":pid,"name":name,"parent_company":parent,"region":r,"portfolio_mw":port,"renewable_mw":ren,"thermal_mw":port-ren-random.randint(0,200),"storage_mw":random.randint(50,400),"market_share_pct":round(random.uniform(8,28),1),"hhi_contribution":round(random.uniform(50,400)),"year":2025})
    concentration = [{"region":r,"year":2025,"hhi_score":random.randint(1200,2200),"cr3_pct":round(random.uniform(55,75),1),"cr5_pct":round(random.uniform(75,92),1),"dominant_participant":random.choice(["Origin","AGL","EnergyAustralia"]),"competition_level":random.choice(["MODERATE","CONCENTRATED"])} for r in ["NSW1","QLD1","VIC1","SA1","TAS1"]]
    ownership = [{"year":2024,"acquirer":"Shell","target":"Meridian","assets_transferred":"Hydro portfolio","capacity_mw":420,"transaction_value_m_aud":680,"regulatory_approval":"Approved","impact_on_hhi":45},{"year":2025,"acquirer":"Brookfield","target":"Origin (partial)","assets_transferred":"Gas peakers","capacity_mw":1200,"transaction_value_m_aud":2100,"regulatory_approval":"Under Review","impact_on_hhi":120}]
    regional = [{"participant":name,"region":r,"year":2025,"generation_share_pct":round(random.uniform(8,30),1),"capacity_share_pct":round(random.uniform(8,30),1),"peak_share_pct":round(random.uniform(5,35),1),"rebid_events":random.randint(50,500)} for _,name,_ in companies for r in ["NSW1","QLD1","VIC1"]]
    return {"timestamp":ts,"participants":participants,"concentration":concentration,"ownership_changes":ownership,"regional_shares":regional}

@app.get("/api/planned-outage/dashboard", summary="Planned outage schedule", tags=["Market Data"])
async def planned_outage_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    outages = []
    units = [("BW01","Bayswater Unit 1","BLACK_COAL","NSW1",660),("LD01","Liddell Unit 1","BLACK_COAL","NSW1",500),("YPS1","Yallourn Unit 1","BROWN_COAL","VIC1",360),("ER01","Eraring Unit 1","BLACK_COAL","NSW1",720),("CPP4","Callide C Unit 4","BLACK_COAL","QLD1",420),("TORRA1","Torrens Island A1","GAS","SA1",120)]
    for uid,name,tech,region,cap in units:
        outages.append({"outage_id":f"OUT-{uid}","unit_id":uid,"unit_name":name,"technology":tech,"region":region,"capacity_mw":cap,"start_date":"2026-03-15","end_date":"2026-04-20","duration_days":36,"outage_type":random.choice(["FULL","PARTIAL","DERATING"]),"derated_capacity_mw":round(cap*random.uniform(0,0.5)),"reason":random.choice(["MAJOR_OVERHAUL","MINOR_MAINTENANCE","REGULATORY_INSPECTION","FUEL_SYSTEM"]),"submitted_by":"Participant"})
    reserve = [{"week":f"2026-W{w}","region":r,"available_capacity_mw":random.randint(8000,14000),"maximum_demand_mw":random.randint(6000,12000),"scheduled_outage_mw":random.randint(200,1500),"unplanned_outage_mw":random.randint(100,600),"reserve_margin_pct":round(random.uniform(8,30),1),"reserve_status":random.choice(["ADEQUATE","TIGHT","ADEQUATE"])} for r in ["NSW1","QLD1","VIC1","SA1","TAS1"] for w in range(10,14)]
    conflicts = [{"conflict_id":"CON-001","unit_a":"BW01","unit_b":"ER01","overlap_start":"2026-03-15","overlap_end":"2026-03-28","combined_capacity_mw":1380,"region":"NSW1","risk_level":"HIGH","aemo_intervention":False}]
    kpis = [{"technology":t,"avg_planned_days_yr":d,"forced_outage_rate_pct":f,"planned_outage_rate_pct":p,"maintenance_cost_m_aud_mw_yr":round(random.uniform(0.02,0.08),3),"reliability_index":round(random.uniform(0.85,0.98),3)} for t,d,f,p in [("BLACK_COAL",42,6.2,12.1),("BROWN_COAL",55,8.1,15.3),("GAS_CCGT",18,3.8,6.2),("GAS_OCGT",8,2.1,3.5),("HYDRO",12,1.5,4.2),("WIND",5,2.8,2.1),("SOLAR",3,0.8,1.2)]]
    return {"timestamp":ts,"outages":outages,"reserve_margins":reserve,"conflicts":conflicts,"kpis":kpis}

@app.get("/api/hydrogen/dashboard", summary="Hydrogen economy dashboard", tags=["Market Data"])
async def hydrogen_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    projects = [
        {"project_id":"H2-WA-01","project_name":"Asian Renewable Energy Hub","developer":"InterContinental Energy","state":"WA","technology":"PEM","capacity_mw":15000,"hydrogen_output_tpd":2500,"target_cost_kg_aud":3.50,"current_cost_kg_aud":5.80,"lcoh_aud_kg":5.20,"electrolyser_efficiency_pct":68.0,"utilisation_pct":42.0,"renewable_source":"Wind + Solar","status":"Development","commissioning_year":2030,"offtake_secured":True,"export_ready":True},
        {"project_id":"H2-QLD-01","project_name":"CQ-H2 Gladstone","developer":"CQ-H2","state":"QLD","technology":"Alkaline","capacity_mw":3000,"hydrogen_output_tpd":450,"target_cost_kg_aud":4.00,"current_cost_kg_aud":6.50,"lcoh_aud_kg":5.80,"electrolyser_efficiency_pct":65.0,"utilisation_pct":38.0,"renewable_source":"Solar","status":"Feasibility","commissioning_year":2029,"offtake_secured":False,"export_ready":True},
        {"project_id":"H2-SA-01","project_name":"Whyalla Green Steel H2","developer":"GFG Alliance","state":"SA","technology":"PEM","capacity_mw":200,"hydrogen_output_tpd":35,"target_cost_kg_aud":4.50,"current_cost_kg_aud":7.20,"lcoh_aud_kg":6.80,"electrolyser_efficiency_pct":70.0,"utilisation_pct":55.0,"renewable_source":"Wind","status":"Under Construction","commissioning_year":2027,"offtake_secured":True,"export_ready":False},
        {"project_id":"H2-VIC-01","project_name":"Hydrogen Park Murray Valley","developer":"AGIG","state":"VIC","technology":"PEM","capacity_mw":10,"hydrogen_output_tpd":1.8,"target_cost_kg_aud":6.00,"current_cost_kg_aud":8.50,"lcoh_aud_kg":8.20,"electrolyser_efficiency_pct":72.0,"utilisation_pct":60.0,"renewable_source":"Solar","status":"Operating","commissioning_year":2024,"offtake_secured":True,"export_ready":False},
    ]
    benchmarks = [{"region":r,"date":"2026-02-26","spot_h2_price_aud_kg":round(random.uniform(5,9),2),"green_premium_aud_kg":round(random.uniform(1.5,4),2),"grey_h2_price_aud_kg":round(random.uniform(2,3.5),2),"blue_h2_price_aud_kg":round(random.uniform(3,5),2),"ammonia_equiv_aud_t":round(random.uniform(600,900)),"japan_target_price_aud_kg":3.0,"cost_competitiveness_pct":round(random.uniform(30,65),1)} for r in ["QLD","WA","SA","VIC","NSW"]]
    capacity = [{"state":s,"year":y,"operating_mw":round(random.uniform(5,200)),"under_construction_mw":round(random.uniform(50,2000)),"approved_mw":round(random.uniform(100,5000)),"proposed_mw":round(random.uniform(500,15000)),"pipeline_mw":round(random.uniform(1000,20000)),"government_target_mw":round(random.uniform(2000,15000)),"progress_to_target_pct":round(random.uniform(2,25),1)} for s in ["QLD","WA","SA","VIC","NSW","TAS"] for y in [2025,2030]]
    return {"timestamp":ts,"total_operating_capacity_mw":220,"total_pipeline_capacity_mw":52000,"national_avg_lcoh_aud_kg":6.50,"projects_at_target_cost":1,"projects":projects,"price_benchmarks":benchmarks,"capacity_records":capacity}

@app.get("/api/regulatory/dashboard", summary="Regulatory compliance", tags=["Market Data"])
async def regulatory_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    rules = [
        {"rcr_id":"ERC0401","title":"Capacity Investment Scheme Integration","proponent":"AEMC","category":"Market Design","status":"Draft Determination","lodged_date":"2025-08-15","consultation_close":"2026-03-30","determination_date":"2026-06-15","effective_date":"2027-01-01","description":"Integrating CIS with NEM dispatch and settlement","impact_level":"HIGH","affected_parties":["Generators","Retailers","AEMO"],"aemc_link":None},
        {"rcr_id":"ERC0389","title":"Renewable Integration - System Services","proponent":"AEMO","category":"System Security","status":"Final Determination","lodged_date":"2025-03-01","consultation_close":None,"determination_date":"2025-12-15","effective_date":"2026-07-01","description":"New system services market for inverter-based resources","impact_level":"HIGH","affected_parties":["Generators","TNSPs","AEMO"],"aemc_link":None},
        {"rcr_id":"ERC0412","title":"Consumer Energy Resources - Two-Sided Market","proponent":"ESB","category":"DER Integration","status":"Consultation","lodged_date":"2025-11-01","consultation_close":"2026-04-15","determination_date":None,"effective_date":None,"description":"Enabling DER participation in wholesale market","impact_level":"TRANSFORMATIVE","affected_parties":["DNSPs","Aggregators","Consumers","AEMO"],"aemc_link":None},
    ]
    determinations = [
        {"determination_id":"DET-2025-NSW","title":"Ausgrid Distribution Determination 2024-29","body":"AER","determination_type":"Distribution","network_business":"Ausgrid","state":"NSW","decision_date":"2024-04-30","effective_period":"2024-2029","allowed_revenue_m_aud":8200,"capex_allowance_m_aud":3400,"opex_allowance_m_aud":4800,"wacc_pct":5.8,"status":"In Effect"},
        {"determination_id":"DET-2025-VIC","title":"AusNet Transmission Determination 2023-28","body":"AER","determination_type":"Transmission","network_business":"AusNet Services","state":"VIC","decision_date":"2023-06-30","effective_period":"2023-2028","allowed_revenue_m_aud":4500,"capex_allowance_m_aud":2100,"opex_allowance_m_aud":2400,"wacc_pct":5.6,"status":"In Effect"},
    ]
    calendar = [{"event_id":f"CAL-{i}","event_type":t,"title":title,"body":body,"date":d,"days_from_now":dn,"urgency":u,"related_rcr":rcr} for i,(t,title,body,d,dn,u,rcr) in enumerate([("Consultation Close","CIS Integration Submissions Due","AEMC","2026-03-30",32,"HIGH","ERC0401"),("Rule Effective","System Services Market Goes Live","AEMO","2026-07-01",125,"MEDIUM","ERC0389"),("Determination","SA Power Networks Revenue 2025-30","AER","2026-06-30",124,"LOW",None)])]
    return {"timestamp":ts,"open_consultations":8,"draft_rules":3,"final_rules_this_year":5,"transformative_changes":2,"upcoming_deadlines":12,"rule_changes":rules,"aer_determinations":determinations,"calendar_events":calendar}

@app.get("/api/network-tariff-reform/dashboard", summary="Network tariff reform", tags=["Market Data"])
async def network_tariff_reform_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    tariffs = [{"dnsp_id":f"DNSP-{s}","dnsp_name":n,"state":s,"tariff_name":tn,"tariff_category":cat,"structure_type":st,"daily_supply_charge":round(random.uniform(0.8,1.5),2),"peak_rate_kw_or_kwh":round(random.uniform(0.25,0.55),3),"off_peak_rate":round(random.uniform(0.08,0.18),3),"shoulder_rate":round(random.uniform(0.15,0.30),3),"demand_charge_kw_month":round(random.uniform(8,18),2) if st=="DEMAND" else None,"solar_export_rate":round(random.uniform(0.02,0.08),3),"customer_count":random.randint(200000,1200000),"reform_status":random.choice(["LEGACY","TRANSITIONING","REFORMED"])} for n,s,tn,cat,st in [("Ausgrid","NSW","EA010 TOU","RESIDENTIAL","TOU"),("Endeavour","NSW","N70 Demand","SME","DEMAND"),("Citipower","VIC","RESI TOU","RESIDENTIAL","TOU"),("SA Power","SA","RTOU Solar","RESIDENTIAL","TOU"),("Energex","QLD","T11 Flat","RESIDENTIAL","FLAT")]]
    revenue = [{"dnsp_name":n,"state":s,"regulatory_period":"2024-2029","total_revenue_allowance_b_aud":round(random.uniform(3,9),1),"capex_allowance_b_aud":round(random.uniform(1.5,4),1),"opex_allowance_b_aud":round(random.uniform(1.5,5),1),"wacc_pct":round(random.uniform(5.2,6.5),2),"regulatory_asset_base_b_aud":round(random.uniform(5,15),1),"customer_numbers":random.randint(400000,1800000),"avg_revenue_per_customer_aud":random.randint(800,1400),"aer_approved":True} for n,s in [("Ausgrid","NSW"),("Citipower","VIC"),("SA Power","SA"),("Energex","QLD")]]
    reforms = [{"reform_id":f"REF-{i}","reform_name":rn,"dnsp_name":dn,"state":s,"reform_type":rt,"implementation_date":"2026-07-01","customers_affected":random.randint(100000,500000),"avg_bill_change_pct":round(random.uniform(-5,8),1),"peak_demand_reduction_mw":round(random.uniform(10,80)),"der_integration_benefit_m_aud":round(random.uniform(5,50)),"status":random.choice(["APPROVED","TRANSITIONING"]),"aer_position":"SUPPORTED"} for i,(rn,dn,s,rt) in enumerate([("Cost-Reflective TOU","Ausgrid","NSW","COST_REFLECTIVE"),("EV Managed Charging","Citipower","VIC","EV_TARIFF"),("Solar Export Pricing","SA Power","SA","SOLAR_EXPORT")])]
    der = [{"dnsp_name":n,"state":s,"year":2025,"rooftop_solar_gw":round(random.uniform(1,5),1),"home_battery_gw":round(random.uniform(0.1,0.8),2),"ev_charger_gw":round(random.uniform(0.05,0.3),2),"reverse_power_flow_events":random.randint(50,500),"voltage_violations":random.randint(10,200),"network_augmentation_avoided_m_aud":round(random.uniform(10,100)),"hosting_capacity_constraint_pct":round(random.uniform(5,30),1)} for n,s in [("Ausgrid","NSW"),("Citipower","VIC"),("SA Power","SA"),("Energex","QLD")]]
    return {"timestamp":ts,"dnsp_tariffs":tariffs,"dnsp_revenue":revenue,"tariff_reforms":reforms,"der_network_impacts":der,"total_network_revenue_b_aud":22.4,"reformed_customers_pct":34.2,"avg_peak_demand_reduction_mw":185,"network_augmentation_avoided_b_aud":1.8}

@app.get("/api/tariff/dashboard", summary="Tariff analysis", tags=["Market Data"])
async def tariff_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    states = ["NSW","VIC","QLD","SA","TAS"]
    components = [{"state":s,"customer_type":"Residential","tariff_type":"TOU","dnsp":d,"component":c,"rate_c_kwh":round(random.uniform(3,35),1),"pct_of_total_bill":round(random.uniform(5,40),1),"yoy_change_pct":round(random.uniform(-5,12),1),"regulated":c!="Retail Margin"} for s,d in [("NSW","Ausgrid"),("VIC","Citipower"),("QLD","Energex"),("SA","SA Power"),("TAS","TasNetworks")] for c in ["Network","Energy","Environmental","Metering","Retail Margin"]]
    tou = [{"state":s,"dnsp":d,"tariff_name":f"{s} Residential TOU","peak_hours":"14:00-20:00","shoulder_hours":"07:00-14:00, 20:00-22:00","off_peak_hours":"22:00-07:00","peak_rate_c_kwh":round(random.uniform(35,55),1),"shoulder_rate_c_kwh":round(random.uniform(18,28),1),"off_peak_rate_c_kwh":round(random.uniform(10,18),1),"daily_supply_charge_aud":round(random.uniform(0.80,1.40),2),"solar_export_rate_c_kwh":round(random.uniform(3,8),1),"demand_charge_aud_kw_mth":None,"typical_annual_bill_aud":random.randint(1400,2200)} for s,d in [("NSW","Ausgrid"),("VIC","Citipower"),("QLD","Energex"),("SA","SA Power"),("TAS","TasNetworks")]]
    bills = [{"state":s,"customer_segment":"Residential","annual_usage_kwh":5000,"total_annual_bill_aud":b,"energy_cost_aud":round(b*0.35),"network_cost_aud":round(b*0.42),"environmental_cost_aud":round(b*0.08),"metering_cost_aud":round(b*0.05),"retail_margin_aud":round(b*0.10),"energy_pct":35,"network_pct":42,"env_pct":8,"avg_c_kwh_all_in":round(b/50,1)} for s,b in [("NSW",1820),("VIC",1650),("QLD",1750),("SA",2100),("TAS",1580)]]
    return {"timestamp":ts,"national_avg_residential_bill_aud":1780,"cheapest_state":"TAS","most_expensive_state":"SA","tou_adoption_pct":48.2,"avg_solar_export_rate_c_kwh":5.5,"network_cost_share_pct":42,"tariff_components":components,"tou_structures":tou,"bill_compositions":bills}

@app.get("/api/mlf-analytics/dashboard", summary="Marginal loss factor analytics", tags=["Market Data"])
async def mlf_analytics_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    cps = [{"connection_point":f"CP-{n[:3].upper()}{i}","generator_name":n,"technology":t,"region":r,"mlf_2024":round(random.uniform(0.88,1.02),4),"mlf_2023":round(random.uniform(0.89,1.03),4),"mlf_2022":round(random.uniform(0.90,1.04),4),"mlf_trend":random.choice(["IMPROVING","DECLINING","STABLE"]),"revenue_impact_pct":round(random.uniform(-8,3),1),"reason":reason} for i,(n,t,r,reason) in enumerate([("Bayswater","BLACK_COAL","NSW1","Stable transmission"),("Loy Yang A","BROWN_COAL","VIC1","Network congestion"),("Coopers Gap Wind","WIND","QLD1","REZ congestion increasing"),("Stockyard Hill Wind","WIND","VIC1","High VRE penetration"),("Bungala Solar","SOLAR","SA1","Transmission constraints"),("Sapphire Wind","WIND","NSW1","Improving with augmentation")])]
    rez = [{"rez_id":f"REZ-{i}","rez_name":n,"region":r,"projected_mlf_2028":round(random.uniform(0.82,0.95),3),"current_mlf":round(random.uniform(0.88,0.98),3),"mlf_deterioration_pct":round(random.uniform(2,12),1),"connected_capacity_mw":random.randint(500,3000),"pipeline_capacity_mw":random.randint(1000,8000),"risk_level":random.choice(["HIGH","MEDIUM","LOW"]),"aemo_mitigation":"Network augmentation planned"} for i,(n,r) in enumerate([("New England REZ","NSW1"),("Central-West Orana REZ","NSW1"),("Western Victoria REZ","VIC1"),("Far North QLD REZ","QLD1"),("Mid-North SA REZ","SA1")])]
    revenue = [{"generator_name":n,"technology":t,"capacity_mw":cap,"annual_generation_gwh":round(cap*random.uniform(2,5),1),"mlf_value":round(random.uniform(0.88,1.0),4),"spot_price_aud_mwh":round(random.uniform(60,110),2),"effective_price_aud_mwh":round(random.uniform(55,105),2),"revenue_loss_m_aud":round(random.uniform(0.5,8),1),"revenue_loss_pct":round(random.uniform(1,10),1)} for n,t,cap in [("Coopers Gap","WIND",453),("Stockyard Hill","WIND",530),("Bungala","SOLAR",220),("Sapphire","WIND",270)]]
    historical = [{"year":y,"region":r,"avg_mlf":round(random.uniform(0.92,0.99),3),"min_mlf":round(random.uniform(0.78,0.90),3),"max_mlf":round(random.uniform(1.0,1.05),3),"generators_below_095":random.randint(5,25),"total_generators":random.randint(40,120),"avg_revenue_impact_pct":round(random.uniform(-4,-1),1)} for r in ["NSW1","QLD1","VIC1","SA1","TAS1"] for y in [2022,2023,2024]]
    return {"timestamp":ts,"connection_points":cps,"rez_mlfs":rez,"revenue_impacts":revenue,"historical":historical}

@app.get("/api/settlement/dashboard", summary="Settlement dashboard", tags=["Market Data"])
async def settlement_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    runs = [{"run_id":f"SR-{i}","run_type":rt,"trading_date":"2026-02-25","run_datetime":ts,"status":"COMPLETE","records_processed":random.randint(50000,200000),"total_settlement_aud":round(random.uniform(20e6,80e6),2),"largest_payment_aud":round(random.uniform(2e6,8e6),2),"largest_receipt_aud":round(random.uniform(2e6,8e6),2),"runtime_seconds":random.randint(120,600)} for i,rt in enumerate(["PRELIMINARY","FINAL","REVISION_1"])]
    residues = [{"interval_id":f"INT-{i}","interconnector_id":ic,"flow_mw":round(random.uniform(-500,500),1),"price_differential":round(random.uniform(-20,40),2),"settlement_residue_aud":round(random.uniform(-50000,200000),2),"direction":random.choice(["IMPORT","EXPORT"]),"allocation_pool":random.choice(["SRA_POOL","IRSR_POOL"])} for i,ic in enumerate(["N-Q-MNSP1","VIC1-NSW1","V-SA","T-V-MNSP1","V-S-MNSP1"])]
    prudential = [{"participant_id":f"P{i}","participant_name":n,"participant_type":pt,"credit_limit_aud":round(random.uniform(10e6,100e6),2),"current_exposure_aud":round(random.uniform(5e6,80e6),2),"utilisation_pct":round(random.uniform(20,85),1),"outstanding_amount_aud":round(random.uniform(0,5e6),2),"days_since_review":random.randint(10,90),"status":random.choice(["GREEN","AMBER","GREEN"]),"default_notice_issued":False} for i,(n,pt) in enumerate([("Origin Energy","Generator/Retailer"),("AGL Energy","Generator/Retailer"),("EnergyAustralia","Generator/Retailer"),("Snowy Hydro","Generator"),("Alinta Energy","Generator")])]
    tec = [{"participant_id":"P0","duid":"BW01","station_name":"Bayswater","region":"NSW1","previous_tec_mw":2640,"new_tec_mw":2640,"change_mw":0,"effective_date":"2026-07-01","reason":"No change","mlf_before":0.98,"mlf_after":0.98}]
    return {"timestamp":ts,"settlement_period":"2026-02","total_energy_settlement_aud":245000000,"total_fcas_settlement_aud":18500000,"total_residues_aud":12800000,"prudential_exceedances":0,"pending_settlement_runs":1,"largest_residue_interconnector":"VIC1-NSW1","settlement_runs":runs,"residues":residues,"prudential_records":prudential,"tec_adjustments":tec}

@app.get("/api/market-participant-financial/dashboard", summary="Participant financial", tags=["Market Data"])
async def market_participant_financial_dashboard():
    participants = [{"participant_id":f"P{i}","company":n,"role":r,"credit_rating":cr,"prudential_obligation_m":round(random.uniform(20,120),1),"actual_credit_support_m":round(random.uniform(25,140),1),"coverage_ratio":round(random.uniform(1.0,1.8),2),"daily_settlement_exposure_m":round(random.uniform(2,15),1),"max_exposure_m":round(random.uniform(10,60),1),"credit_risk_flag":random.choice(["GREEN","GREEN","AMBER"])} for i,(n,r,cr) in enumerate([("Origin Energy","Generator/Retailer","BBB+"),("AGL Energy","Generator/Retailer","BBB"),("EnergyAustralia","Generator/Retailer","BBB"),("Snowy Hydro","Generator","AA-"),("Alinta Energy","Generator","BBB-")])]
    settlement = [{"month":f"2025-{m:02d}","total_settlement_value_m":round(random.uniform(800,1500),1),"number_of_participants":42,"max_single_participant_exposure_m":round(random.uniform(50,120),1),"net_market_position_m":round(random.uniform(-20,20),1),"undercollateralised_m":round(random.uniform(0,5),1),"late_payments_count":random.randint(0,3),"disputes_count":random.randint(0,2)} for m in range(1,13)]
    defaults = [{"year":y,"default_events":e,"total_default_value_m":round(random.uniform(0,50),1),"recovered_pct":round(random.uniform(60,95),1),"market_impact_m":round(random.uniform(0,20),1),"trigger":t} for y,e,t in [(2022,0,"None"),(2023,1,"Retailer insolvency"),(2024,0,"None"),(2025,0,"None")]]
    credit = [{"support_type":st,"total_lodged_m":round(random.uniform(200,800),1),"participants_using":random.randint(5,30),"avg_duration_months":random.randint(6,24),"renewal_frequency_per_yr":round(random.uniform(1,4),1),"acceptance_rate_pct":round(random.uniform(92,100),1)} for st in ["Bank Guarantee","Cash Deposit","Insurance Bond","Letter of Credit"]]
    prudential = [{"quarter":f"2025-Q{q}","total_prudential_requirement_m":round(random.uniform(2000,3000),1),"total_credit_support_lodged_m":round(random.uniform(2500,3500),1),"market_coverage_ratio":round(random.uniform(1.1,1.4),2),"amber_participants":random.randint(0,3),"red_participants":0,"waiver_requests":random.randint(0,2),"waivers_granted":random.randint(0,1)} for q in range(1,5)]
    total_parts = len(participants)
    latest_prud = prudential[-1] if prudential else {}
    total_prud_req = latest_prud.get("total_prudential_requirement_m", 2500)
    mkt_cov = latest_prud.get("market_coverage_ratio", 1.25)
    red_flagged = sum(1 for p in participants if p["credit_risk_flag"] == "RED")
    default_2024 = sum(d["default_events"] for d in defaults if d["year"] == 2024)
    ratings = [p["credit_rating"] for p in participants]
    avg_rating = max(set(ratings), key=ratings.count) if ratings else "BBB"
    return {"participants":participants,"settlement":settlement,"defaults":defaults,"credit_support":credit,"prudential":prudential,"summary":{"total_participants":total_parts,"total_prudential_requirement_m":total_prud_req,"market_coverage_ratio":mkt_cov,"red_flagged_participants":red_flagged,"default_events_2024":default_2024,"avg_credit_rating":avg_rating}}

@app.get("/api/rec-market/dashboard", summary="Renewable energy certificates", tags=["Market Data"])
async def rec_market_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    lgc_spot = [{"trade_date":f"2026-02-{d:02d}","spot_price_aud":round(random.uniform(38,52),2),"volume_traded":random.randint(5000,30000),"open_interest":random.randint(50000,200000),"created_from":random.choice(["WIND","SOLAR","HYDRO"]),"vintage_year":random.choice([2024,2025,2026])} for d in range(1,27)]
    surplus = [{"year":y,"liable_entity":"National","required_lgcs":random.randint(30000000,40000000),"surrendered_lgcs":random.randint(28000000,42000000),"shortfall_lgcs":random.randint(0,2000000),"shortfall_charge_m_aud":round(random.uniform(0,50),1),"compliance_pct":round(random.uniform(92,100),1)} for y in [2022,2023,2024,2025]]
    creation = [{"accreditation_id":f"ACC-{i}","station_name":n,"technology":t,"state":s,"capacity_mw":cap,"lgcs_created_2024":random.randint(100000,2000000),"lgcs_surrendered_2024":random.randint(80000,1800000),"lgcs_in_registry":random.randint(10000,200000),"avg_price_received":round(random.uniform(35,50),2)} for i,(n,t,s,cap) in enumerate([("Coopers Gap","WIND","QLD",453),("Stockyard Hill","WIND","VIC",530),("Bungala","SOLAR","SA",220),("Snowy 2.0","HYDRO","NSW",2040)])]
    stc = [{"quarter":f"2025-Q{q}","stc_price_aud":round(random.uniform(38,40),2),"volume_created":random.randint(5000000,8000000),"rooftop_solar_mw":random.randint(600,1200),"solar_hot_water_units":random.randint(5000,15000),"heat_pump_units":random.randint(3000,10000),"total_stc_value_m_aud":round(random.uniform(200,320),1)} for q in range(1,5)]
    return {"timestamp":ts,"lgc_spot_records":lgc_spot,"surplus_deficit":surplus,"lgc_creation":creation,"stc_records":stc,"current_lgc_price":45.20,"current_stc_price":39.80,"lgc_surplus_deficit_m":2.4,"lret_target_2030_twh":33.0,"lret_progress_pct":78.5}

@app.get("/api/carbon-intensity/dashboard", summary="Carbon intensity", tags=["Market Data"])
async def carbon_intensity_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    grid = [{"region":r,"year":2025,"month":f"2025-{m:02d}","avg_intensity_kgco2_mwh":round(random.uniform(200,800),1),"min_intensity_kgco2_mwh":round(random.uniform(50,300),1),"max_intensity_kgco2_mwh":round(random.uniform(600,1100),1),"zero_carbon_hours_pct":round(random.uniform(5,45),1),"total_emissions_kt_co2":round(random.uniform(500,4000)),"vre_penetration_pct":round(random.uniform(20,65),1)} for r in ["NSW1","QLD1","VIC1","SA1","TAS1"] for m in range(1,13)]
    marginal = [{"region":r,"hour":h,"marginal_emission_factor_kgco2_mwh":round(random.uniform(400,1000),1),"marginal_technology":random.choice(["BLACK_COAL","GAS_CCGT","GAS_OCGT"]),"typical_price_aud_mwh":round(random.uniform(40,150),2),"flexibility_benefit_kg_co2_kwh":round(random.uniform(0.1,0.5),3)} for r in ["NSW1","VIC1","SA1"] for h in range(0,24,4)]
    tech = [{"technology":t,"lifecycle_kgco2_mwh":lc,"operational_kgco2_mwh":op,"construction_kgco2_mwh":round(lc-op-f),"fuel_kgco2_mwh":f,"category":cat} for t,lc,op,f,cat in [("Black Coal",1020,950,60,"Fossil"),("Brown Coal",1280,1200,70,"Fossil"),("Gas CCGT",490,430,50,"Fossil"),("Gas OCGT",650,580,60,"Fossil"),("Wind Onshore",12,0,0,"Renewable"),("Solar PV",20,0,0,"Renewable"),("Hydro",6,0,0,"Renewable"),("Battery",30,0,0,"Storage")]]
    decarb = [{"region":r,"year":y,"emissions_mt_co2":round(random.uniform(5,60),1),"intensity_kgco2_mwh":round(random.uniform(150,800),1),"vre_pct":round(random.uniform(15,70),1),"coal_pct":round(random.uniform(0,60),1),"gas_pct":round(random.uniform(5,25),1),"target_intensity_kgco2_mwh":200,"target_year":2035,"on_track":random.choice([True,False])} for r in ["NSW1","QLD1","VIC1","SA1","TAS1"] for y in [2020,2022,2024,2025]]
    return {"timestamp":ts,"grid_intensity":grid,"marginal_emissions":marginal,"technology_emissions":tech,"decarbonisation":decarb}

@app.get("/api/ppa/dashboard", summary="PPA market", tags=["Market Data"])
async def ppa_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    ppas = [{"ppa_id":f"PPA-{i}","project_name":n,"technology":t,"region":r,"capacity_mw":cap,"offtaker":off,"offtaker_sector":sec,"ppa_price_aud_mwh":round(random.uniform(50,85),2),"contract_start":cs,"contract_end":ce,"term_years":term,"annual_energy_gwh":round(cap*random.uniform(2,4),1),"lgc_included":True,"structure":random.choice(["Pay-as-produced","Baseload shape","Firmed"]),"status":random.choice(["Active","Signed","Negotiating"])} for i,(n,t,r,cap,off,sec,cs,ce,term) in enumerate([("Coopers Gap Wind","WIND","QLD1",453,"BHP","Mining","2019-01-01","2034-01-01",15),("Stockyard Hill Wind","WIND","VIC1",530,"Telstra","Telecom","2021-06-01","2036-06-01",15),("Western Downs Solar","SOLAR","QLD1",460,"APA Group","Infrastructure","2022-01-01","2032-01-01",10),("Bango Wind","WIND","NSW1",244,"CommBank","Financial","2023-07-01","2033-07-01",10)])]
    lgc = [{"calendar_year":y,"lgc_spot_price_aud":round(random.uniform(35,55),2),"lgc_forward_price_aud":round(random.uniform(38,58),2),"lgcs_created_this_year_m":round(random.uniform(25,40),1),"lgcs_surrendered_this_year_m":round(random.uniform(23,38),1),"lgcs_banked_m":round(random.uniform(2,8),1),"voluntary_surrender_pct":round(random.uniform(10,25),1),"shortfall_charge_risk":random.choice(["LOW","LOW","MODERATE"])} for y in [2023,2024,2025,2026]]
    btm = [{"asset_id":f"BTM-{t}","asset_type":t,"state":s,"capacity_kw":kw,"installed_count":cnt,"total_installed_mw":round(cnt*kw/1000),"avg_capacity_factor_pct":round(random.uniform(12,22),1),"annual_generation_gwh":round(cnt*kw/1000*random.uniform(1.5,3),1),"avoided_grid_cost_m_aud":round(random.uniform(10,200)),"certificates_eligible":"STC"} for s in ["NSW","VIC","QLD","SA"] for t,kw,cnt in [("Rooftop Solar",6.5,random.randint(300000,800000)),("Home Battery",10,random.randint(20000,80000))]]
    return {"timestamp":ts,"total_ppa_capacity_gw":8.2,"active_ppas":145,"pipeline_ppas":62,"avg_ppa_price_aud_mwh":68.50,"tech_mix":[{"technology":"Wind","capacity_gw":4.8,"pct":58.5},{"technology":"Solar","capacity_gw":2.9,"pct":35.4},{"technology":"Hybrid","capacity_gw":0.5,"pct":6.1}],"lgc_spot_price":45.20,"rooftop_solar_total_gw":22.5,"ppas":ppas,"lgc_market":lgc,"behind_meter_assets":btm}

@app.get("/api/rooftop-solar-grid/dashboard", summary="Rooftop solar grid impact", tags=["Market Data"])
async def rooftop_solar_grid_dashboard():
    adoption = [{"state":s,"quarter":f"2025-Q{q}","residential_systems":random.randint(500000,2000000),"commercial_systems":random.randint(20000,80000),"total_capacity_mw":random.randint(2000,8000),"avg_system_size_kw":round(random.uniform(6,10),1),"penetration_pct":round(random.uniform(20,45),1),"new_installations_quarter":random.randint(30000,80000),"avg_payback_years":round(random.uniform(4,7),1),"feed_in_tariff_c_per_kwh":round(random.uniform(3,8),1)} for s in ["NSW","VIC","QLD","SA","TAS"] for q in range(1,5)]
    gen = [{"date":"2026-02-26","region":r,"hour":h,"rooftop_generation_mw":round(max(0,1500*max(0,1-abs(h-12)/6))*random.uniform(0.8,1.2)),"behind_meter_consumption_mw":round(max(0,800*max(0,1-abs(h-12)/6))*random.uniform(0.8,1.2)),"net_export_to_grid_mw":round(max(0,700*max(0,1-abs(h-12)/6))*random.uniform(0.8,1.2)),"curtailed_mw":round(max(0,50*max(0,1-abs(h-12)/4))*random.uniform(0,2)),"curtailment_pct":round(random.uniform(0,8),1),"system_demand_mw":random.randint(5000,12000),"solar_fraction_pct":round(random.uniform(0,35),1)} for r in ["NSW1","VIC1","QLD1","SA1"] for h in range(6,20)]
    duck = [{"region":r,"season":s,"hour":h,"net_demand_2020_mw":round(base*(0.7+0.3*abs(12-h)/12)),"net_demand_2024_mw":round(base*(0.6+0.3*abs(12-h)/12)),"net_demand_2030_mw":round(base*(0.4+0.3*abs(12-h)/12)),"net_demand_2035_mw":round(base*(0.25+0.35*abs(12-h)/12)),"ramp_rate_mw_per_hr":round(random.uniform(100,600))} for r,base in [("NSW1",10000),("VIC1",7000),("SA1",2000)] for s in ["Summer","Winter"] for h in range(0,24,2)]
    hosting = [{"distributor":d,"feeder_class":fc,"avg_hosting_capacity_pct":round(random.uniform(40,85),1),"additional_capacity_available_mw":round(random.uniform(50,500)),"constraint_type":random.choice(["Voltage","Thermal","Protection"]),"dynamic_export_limit_applied":random.choice([True,False]),"upgrade_cost_per_mw_m":round(random.uniform(0.5,3),1)} for d in ["Ausgrid","Citipower","Energex","SA Power"] for fc in ["Urban","Suburban","Rural"]]
    export = [{"state":s,"scheme":"Dynamic Export Limits","penetration_pct":round(random.uniform(15,50),1),"avg_curtailment_pct":round(random.uniform(2,12),1),"customer_satisfaction_score":round(random.uniform(3.5,4.5),1),"network_benefit_m_yr":round(random.uniform(5,50),1)} for s in ["SA","QLD","NSW","VIC"]]
    avg_payback = sum(a["avg_payback_years"] for a in adoption) / max(len(adoption), 1)
    peak_curtail = max((g["curtailment_pct"] for g in gen), default=0)
    min_net_2024 = min((d["net_demand_2024_mw"] for d in duck), default=0)
    min_net_2030 = min((d["net_demand_2030_mw"] for d in duck), default=0)
    total_cap = sum(a["total_capacity_mw"] for a in adoption if a["quarter"] == "2025-Q4")
    total_sys = sum(a["residential_systems"] + a["commercial_systems"] for a in adoption if a["quarter"] == "2025-Q4")
    avg_pen = sum(a["penetration_pct"] for a in adoption if a["quarter"] == "2025-Q4") / max(sum(1 for a in adoption if a["quarter"] == "2025-Q4"), 1)
    return {"adoption":adoption,"generation":gen,"duck_curve":duck,"hosting_capacity":hosting,"export_management":export,"summary":{"total_rooftop_mw_2024":total_cap,"total_systems_2024":total_sys,"avg_penetration_pct":round(avg_pen,1),"peak_curtailment_pct":round(peak_curtail,1),"min_net_demand_2024_mw":min_net_2024,"min_net_demand_2030_mw":min_net_2030,"avg_payback_years":round(avg_payback,1)}}

@app.get("/api/community-energy/dashboard", summary="Community energy", tags=["Market Data"])
async def community_energy_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    batteries = [{"battery_id":f"CB-{i}","name":n,"operator":op,"state":s,"region":f"{s}1","program":"Community Batteries","capacity_kwh":cap,"power_kw":round(cap/2),"participants":random.randint(50,250),"avg_bill_savings_pct":round(random.uniform(15,30),1),"grid_services_revenue_aud_yr":random.randint(20000,100000),"utilisation_pct":round(random.uniform(50,80),1),"status":random.choice(["Operating","Commissioning"]),"commissioning_year":random.choice([2024,2025,2026])} for i,(n,op,s,cap) in enumerate([("Waverley Community Battery","Ausgrid","NSW",500),("YEF Yackandandah","Mondo","VIC",274),("Alkimos Beach","Synergy","WA",1100),("Beehive Community Battery","AusNet","VIC",316)])]
    gardens = [{"garden_id":f"SG-{i}","name":n,"operator":op,"state":s,"capacity_kw":cap,"subscribers":subs,"annual_generation_mwh":round(cap*1.5),"subscription_cost_aud_kw":round(random.uniform(100,200)),"savings_per_subscriber_aud_yr":random.randint(200,500),"waitlist_count":random.randint(0,100),"low_income_reserved_pct":round(random.uniform(10,30),1),"status":"Operating"} for i,(n,op,s,cap,subs) in enumerate([("Haystacks Solar Garden","Community Power Agency","NSW",1000,200),("Melbourne Renewable Energy Project","MREP","VIC",80000,14),("Hepburn Wind","Hepburn Wind","VIC",4100,2000)])]
    sps = [{"sps_id":f"SPS-{i}","network_area":na,"dnsp":dnsp,"state":s,"technology":"Solar + Battery","capacity_kw":random.randint(20,200),"storage_kwh":random.randint(50,500),"customers_served":random.randint(1,20),"reliability_pct":round(random.uniform(98,99.9),1),"annual_fuel_saved_litres":random.randint(5000,50000),"carbon_saved_tco2_yr":round(random.uniform(10,100),1),"capex_m_aud":round(random.uniform(0.2,2),1),"opex_aud_yr":random.randint(10000,50000),"network_deferral_m_aud":round(random.uniform(0.5,5),1),"commissioning_year":random.choice([2023,2024,2025])} for i,(na,dnsp,s) in enumerate([("Far West NSW","Essential Energy","NSW"),("North QLD","Ergon","QLD"),("Flinders Island","TasNetworks","TAS")])]
    return {"timestamp":ts,"total_community_batteries":120,"total_community_battery_capacity_mwh":85.0,"total_solar_garden_capacity_mw":95.0,"total_solar_garden_subscribers":2500,"total_sps_systems":45,"total_sps_customers":380,"community_batteries":batteries,"solar_gardens":gardens,"sps_systems":sps}

@app.get("/api/vpp/dashboard", summary="Virtual power plant", tags=["Market Data"])
async def vpp_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    schemes = [{"scheme_id":f"VPP-{i}","scheme_name":n,"operator":op,"state":s,"technology":"Home Battery","enrolled_participants":parts,"total_capacity_mw":round(parts*0.01,1),"avg_battery_kwh":13.5,"nem_registered":True,"fcas_eligible":fc,"status":"Active","launch_year":ly,"avg_annual_saving_aud":random.randint(400,800)} for i,(n,op,s,parts,fc,ly) in enumerate([("Tesla Energy Plan","Tesla","SA",10000,True,2021),("Origin Loop","Origin Energy","VIC",8000,True,2022),("AGL Virtual Power Plant","AGL","QLD",12000,True,2020),("Simply Energy VPP","Simply Energy","SA",5000,False,2023),("Reposit Grid Credits","Reposit Power","NSW",6000,True,2022)])]
    dispatches = [{"scheme_id":f"VPP-{i%5}","scheme_name":schemes[i%5]["scheme_name"],"trading_interval":f"2026-02-26T{h:02d}:00:00","dispatch_type":random.choice(["ENERGY","FCAS_RAISE","FCAS_LOWER"]),"energy_dispatched_mwh":round(random.uniform(1,15),2),"participants_dispatched":random.randint(500,5000),"revenue_aud":round(random.uniform(500,8000),2),"avg_participant_payment_aud":round(random.uniform(0.5,3),2),"trigger":random.choice(["High Price","FCAS Contingency","Network Support"])} for i,h in enumerate([8,10,14,16,18,19,20])]
    performance = [{"scheme_id":f"VPP-{i}","scheme_name":schemes[i]["scheme_name"],"month":"2026-01","total_dispatches":random.randint(20,80),"total_energy_mwh":round(random.uniform(50,500),1),"total_revenue_aud":random.randint(20000,150000),"avg_response_time_sec":round(random.uniform(2,8),1),"reliability_pct":round(random.uniform(92,99),1),"participant_satisfaction_pct":round(random.uniform(75,92),1),"co2_avoided_t":round(random.uniform(10,100),1)} for i in range(5)]
    return {"timestamp":ts,"total_enrolled_participants":41000,"total_vpp_capacity_mw":410,"active_schemes":5,"total_revenue_ytd_aud":2800000,"schemes":schemes,"dispatches":dispatches,"performance":performance}

@app.get("/api/ev/dashboard", summary="EV grid impact", tags=["Market Data"])
async def ev_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    chargers = [{"charger_id":f"EV-{i}","site_name":n,"operator":op,"state":s,"charger_type":ct,"power_kw":pw,"num_connectors":conn,"utilisation_pct":round(random.uniform(15,65),1),"avg_session_kwh":round(random.uniform(15,60),1),"sessions_per_day":round(random.uniform(3,20),1),"revenue_aud_per_day":round(random.uniform(50,400),2),"managed_charging":mc,"grid_upgrade_required":random.choice([True,False]),"installation_year":random.choice([2023,2024,2025])} for i,(n,op,s,ct,pw,conn,mc) in enumerate([("Sydney Olympic Park","Chargefox","NSW","DC Ultra-Rapid",350,4,True),("Melbourne Airport","Evie","VIC","DC Fast",150,8,True),("Brisbane Supercharger","Tesla","QLD","DC Fast",250,12,False),("Adelaide CBD","Jolt","SA","DC Fast",50,6,True),("Hobart Waterfront","ChargePoint","TAS","AC Type 2",22,4,False)])]
    grid = [{"state":s,"ev_vehicles_registered":ev,"charging_load_mw_peak":round(ev*0.003,1),"charging_load_mw_offpeak":round(ev*0.001,1),"managed_charging_participation_pct":round(random.uniform(15,45),1),"grid_upgrade_cost_m_aud":round(random.uniform(10,80),1),"renewable_charging_pct":round(random.uniform(25,60),1),"v2g_capable_vehicles":round(ev*random.uniform(0.01,0.05))} for s,ev in [("NSW",85000),("VIC",72000),("QLD",48000),("SA",22000),("TAS",8000),("WA",35000)]]
    return {"timestamp":ts,"total_chargers":4200,"total_ev_vehicles":270000,"total_charging_capacity_mw":850,"avg_utilisation_pct":32.5,"managed_charging_pct":28.4,"chargers":chargers,"grid_impacts":grid}

@app.get("/api/isp-progress/dashboard", summary="ISP progress tracking", tags=["Market Data"])
async def isp_progress_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    projects = [{"project_id":f"ISP-{i}","project_name":n,"project_type":pt,"proponent":prop,"state":s,"region":r,"isp_category":cat,"capacity_mw":cap,"investment_m_aud":inv,"isp_benefit_m_aud":round(inv*random.uniform(1.2,3)),"benefit_cost_ratio":round(random.uniform(1.2,3),1),"need_year":ny,"committed_year":cy,"completion_year":None,"status":st,"regulatory_hurdle":rh} for i,(n,pt,prop,s,r,cat,cap,inv,ny,cy,st,rh) in enumerate([("HumeLink","Transmission","Transgrid","NSW","NSW1","Actionable ISP",2000,3300,2026,2025,"Under Construction",None),("VNI West","Transmission","AEMO/Transgrid","VIC","VIC1","Actionable ISP",1800,2800,2028,None,"RIT-T Approved","Route selection"),("Marinus Link","Interconnector","Marinus Link Pty","TAS","TAS1","Actionable ISP",1500,3500,2029,2025,"Under Construction",None),("Sydney Ring","Transmission","Transgrid","NSW","NSW1","Actionable ISP",3000,4200,2030,None,"Assessment","Environmental"),("QNI Medium","Interconnector","Powerlink","QLD","QLD1","Actionable ISP",800,1600,2032,None,"Feasibility","Cost escalation")])]
    milestones = [{"year":y,"scenario":"Step Change","region":r,"wind_target_gw":round(random.uniform(5,25),1),"solar_target_gw":round(random.uniform(5,35),1),"storage_target_gwh":round(random.uniform(5,50),1),"transmission_target_gw":round(random.uniform(1,8),1),"wind_actual_gw":round(random.uniform(3,15),1) if y<=2026 else None,"solar_actual_gw":round(random.uniform(3,20),1) if y<=2026 else None,"storage_actual_gwh":round(random.uniform(2,20),1) if y<=2026 else None,"on_track":random.choice([True,False]) if y<=2026 else None} for r in ["NSW1","VIC1","QLD1","SA1"] for y in [2026,2030,2035,2040]]
    scenarios = [{"scenario":s,"description":d,"total_investment_b_aud":inv,"renewables_share_2035_pct":r35,"renewables_share_2040_pct":r40,"emissions_reduction_2035_pct":e35,"coal_exit_year":cey,"new_storage_gwh_2035":stg,"new_transmission_km":tkm,"consumer_bill_impact_aud_yr":bill} for s,d,inv,r35,r40,e35,cey,stg,tkm,bill in [("Step Change","Rapid electrification and decarbonisation",122,83,96,78,2038,46,10000,-120),("Progressive Change","Moderate pace of transition",98,68,82,62,2042,32,7000,-50),("Green Energy Exports","Renewable superpower",165,92,99,88,2035,65,15000,-180)]]
    risks = [{"project_category":c,"total_projects":tp,"on_schedule_pct":round(random.uniform(40,70),1),"at_risk_pct":round(random.uniform(15,30),1),"delayed_pct":round(random.uniform(10,25),1),"stalled_pct":round(random.uniform(0,10),1),"key_risk":kr,"risk_mitigation":rm} for c,tp,kr,rm in [("Transmission",12,"Supply chain delays","Early procurement"),("Wind Farms",45,"Planning approvals","Streamlined assessment"),("Solar Farms",62,"Grid connection","REZ coordination"),("Storage",28,"Technology costs","CIS auction rounds")]]
    return {"timestamp":ts,"actionable_projects":projects,"capacity_milestones":milestones,"scenarios":scenarios,"delivery_risks":risks,"total_actionable_investment_b_aud":15.4,"committed_projects":3,"projects_on_track_pct":52.0,"step_change_renewable_target_gw_2030":68}

@app.get("/api/rez-dev/dashboard", summary="REZ development", tags=["Market Data"])
async def rez_dev_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    rezs = [{"rez_id":f"REZ-{i}","rez_name":n,"state":s,"region":f"{s}1","status":st,"technology_focus":tf,"capacity_potential_gw":cpg,"committed_capacity_mw":round(cpg*1000*random.uniform(0.05,0.3)),"operating_capacity_mw":round(cpg*1000*random.uniform(0.02,0.15)),"pipeline_capacity_mw":round(cpg*1000*random.uniform(0.3,0.7)),"transmission_investment_m_aud":round(random.uniform(500,4000)),"land_area_km2":random.randint(2000,15000),"rez_class":random.choice(["Priority","Actionable","Future"]),"enabling_project":ep} for i,(n,s,st,tf,cpg,ep) in enumerate([("New England","NSW","Declared","Wind + Solar",8.0,"HumeLink"),("Central-West Orana","NSW","Declared","Solar + Wind",5.5,"CWO Transmission"),("Western Victoria","VIC","Active","Wind",4.2,"VNI West"),("Far North QLD","QLD","Active","Solar",3.8,"CopperString 2.0"),("Mid-North SA","SA","Active","Wind + Solar",3.0,"ElectraNet Augmentation"),("North West TAS","TAS","Planned","Wind",2.5,"Marinus Link")])]
    projects = [{"project_id":f"RGP-{i}","project_name":n,"rez_id":rez,"technology":t,"capacity_mw":cap,"developer":dev,"state":s,"status":st,"commissioning_year":cy,"estimated_generation_gwh":round(cap*random.uniform(2,4),1),"firming_partner":fp} for i,(n,rez,t,cap,dev,s,st,cy,fp) in enumerate([("Thunderbolt Wind","REZ-0","WIND",900,"Neoen","NSW","Approved",2028,"Waratah Super Battery"),("Valley of the Winds","REZ-1","WIND",600,"Goldwind","NSW","Under Construction",2027,"CWO BESS"),("Bulgana Green Power Hub","REZ-2","WIND",204,"Neoen","VIC","Operating",2024,"Bulgana Battery"),("Kidston Solar","REZ-3","SOLAR",320,"Genex","QLD","Under Construction",2027,"Kidston Pumped Hydro")])]
    return {"timestamp":ts,"total_rez_zones":6,"total_pipeline_gw":18.5,"committed_capacity_mw":4200,"operating_capacity_mw":1800,"total_transmission_investment_m_aud":12500,"rez_records":rezs,"generation_projects":projects}

@app.get("/api/isp/dashboard", summary="ISP major projects", tags=["Market Data"])
async def isp_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    projects = [{"project_id":f"ISPP-{i}","project_name":n,"tnsp":tnsp,"regions_connected":rc,"project_type":pt,"isp_action":"Actionable","total_capex_m_aud":capex,"sunk_cost_to_date_m_aud":round(capex*random.uniform(0.1,0.5)),"committed_capex_m_aud":round(capex*random.uniform(0.3,0.8)),"circuit_km":km,"voltage_kv":vkv,"thermal_limit_mw":tlm,"construction_start":cs,"commissioning_date":cd,"current_status":st,"rit_t_complete":True,"overall_progress_pct":round(random.uniform(10,60),1),"milestones":[{"milestone_id":"M1","milestone_name":"RIT-T Complete","planned_date":"2024-06-01","actual_date":"2024-08-15","status":"Complete","delay_months":2},{"milestone_id":"M2","milestone_name":"Construction Start","planned_date":cs,"actual_date":cs,"status":"Complete","delay_months":0}],"net_market_benefit_m_aud":round(capex*random.uniform(1.5,4)),"bcr":round(random.uniform(1.5,3.5),1)} for i,(n,tnsp,rc,pt,capex,km,vkv,tlm,cs,cd,st) in enumerate([("HumeLink","Transgrid",["NSW1","VIC1"],"Transmission",3300,360,500,2000,"2025-01-01","2028-06-01","Under Construction"),("VNI West","AEMO",["VIC1","NSW1"],"Interconnector",2800,290,500,1800,"2026-06-01","2029-12-01","Approved"),("Marinus Link","Marinus Link Pty",["TAS1","VIC1"],"Interconnector",3500,255,320,1500,"2025-06-01","2030-06-01","Under Construction"),("Project EnergyConnect","ElectraNet/Transgrid",["SA1","NSW1"],"Interconnector",2400,900,330,800,"2022-01-01","2026-12-01","Under Construction")])]
    tnsp = [{"tnsp":t,"regulatory_period":rp,"states":sts,"total_approved_capex_m_aud":capex,"spent_to_date_m_aud":round(capex*random.uniform(0.3,0.6)),"remaining_m_aud":round(capex*random.uniform(0.4,0.7)),"spend_rate_pct":round(random.uniform(40,70),1),"major_projects":mp,"regulatory_body":"AER"} for t,rp,sts,capex,mp in [("Transgrid","2023-2028",["NSW"],8500,["HumeLink","Sydney Ring"]),("AusNet","2022-2027",["VIC"],4200,["Western Renewables Link"]),("Powerlink","2022-2027",["QLD"],3800,["CopperString 2.0"]),("ElectraNet","2023-2028",["SA"],2100,["Project EnergyConnect"])]]
    return {"timestamp":ts,"total_pipeline_capex_bn_aud":28.5,"committed_projects":4,"projects_under_construction":3,"total_new_km":1805,"total_new_capacity_mw":6100,"delayed_projects":1,"isp_projects":projects,"tnsp_programs":tnsp}

@app.get("/api/capacity-investment/dashboard", summary="Capacity investment signals", tags=["Market Data"])
async def capacity_investment_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    new_entrant = [{"technology":t,"region":"NEM","capex_m_aud_mw":capex,"wacc_pct":round(random.uniform(6,9),1),"loe_aud_mwh":round(random.uniform(40,120),2),"breakeven_price_aud_mwh":bp,"payback_years":round(random.uniform(5,20),1),"npv_m_aud":round(random.uniform(-50,200),1),"irr_pct":round(random.uniform(4,15),1)} for t,capex,bp in [("Wind Onshore",1.8,55),("Solar PV",1.2,42),("Battery 2hr",1.5,85),("Battery 4hr",2.2,72),("Gas Peaker",1.0,110),("Pumped Hydro",3.5,68),("Offshore Wind",4.2,88)]]
    activity = [{"year":y,"technology":t,"committed_mw":random.randint(200,3000),"cancelled_mw":random.randint(0,500),"net_investment_mw":random.randint(100,2500),"announced_projects":random.randint(5,30),"financing_secured_pct":round(random.uniform(40,85),1)} for y in [2023,2024,2025] for t in ["Wind","Solar","Battery","Gas"]]
    signals = [{"region":r,"year":2025,"avg_spot_price":round(random.uniform(50,120),2),"time_weighted_price":round(random.uniform(55,130),2),"peak_peaker_price":round(random.uniform(100,300),2),"revenue_adequacy_signal":random.choice(["STRONG","ADEQUATE","WEAK"])} for r in ["NSW1","QLD1","VIC1","SA1","TAS1"]]
    exits = [{"unit_id":f"EXIT-{i}","unit_name":n,"technology":t,"age_years":age,"remaining_life_years":rem,"exit_probability_5yr_pct":round(random.uniform(20,90),1),"exit_trigger":trig,"capacity_mw":cap} for i,(n,t,age,rem,trig,cap) in enumerate([("Eraring","BLACK_COAL",42,2,"POLICY",2880),("Bayswater","BLACK_COAL",38,6,"ECONOMICS",2640),("Yallourn","BROWN_COAL",50,2,"AGE",1480),("Vales Point","BLACK_COAL",46,4,"ECONOMICS",1320)])]
    return {"timestamp":ts,"new_entrant_costs":new_entrant,"investment_activity":activity,"price_signals":signals,"exit_risks":exits}

@app.get("/api/coal-retirement/dashboard", summary="Coal retirement tracker", tags=["Market Data"])
async def coal_retirement_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    records = [{"unit_id":f"COAL-{i}","unit_name":f"{n} Unit {u}","station":n,"owner":own,"state":s,"technology":t,"registered_capacity_mw":cap,"commissioning_year":cy,"planned_retirement_year":ry,"age_years":2026-cy,"remaining_life_years":max(0,ry-2026),"status":st,"retirement_reason":rr,"replacement_capacity_needed_mw":cap,"replacement_technologies":["Wind","Solar","Battery"],"annual_generation_gwh":round(cap*random.uniform(4,7),1),"carbon_intensity_tco2_mwh":ci} for i,(n,u,own,s,t,cap,cy,ry,st,rr,ci) in enumerate([("Eraring",1,"Origin","NSW","BLACK_COAL",720,1982,2027,"Announced","POLICY",0.92),("Eraring",2,"Origin","NSW","BLACK_COAL",720,1982,2027,"Announced","POLICY",0.92),("Bayswater",1,"AGL","NSW","BLACK_COAL",660,1985,2033,"Operating","ECONOMICS",0.90),("Yallourn",1,"EnergyAustralia","VIC","BROWN_COAL",360,1974,2028,"Announced","AGE",1.28),("Yallourn",2,"EnergyAustralia","VIC","BROWN_COAL",360,1975,2028,"Announced","AGE",1.28),("Callide B",1,"CS Energy","QLD","BLACK_COAL",350,1988,2035,"Operating","ECONOMICS",0.89),("Vales Point",1,"Delta Electricity","NSW","BLACK_COAL",660,1978,2029,"Under Review","AGE",0.93)])]
    gaps = [{"record_id":f"GAP-{y}","year":y,"state":"NEM","retirements_mw":rm,"new_renewables_mw":nr,"new_storage_mw":ns,"new_gas_mw":ng,"net_capacity_change_mw":nr+ns+ng-rm,"cumulative_gap_mw":round(random.uniform(-2000,3000)),"reliability_margin_pct":round(random.uniform(5,20),1)} for y,rm,nr,ns,ng in [(2027,1800,4500,1200,200),(2028,720,5200,1800,100),(2029,660,6000,2400,0),(2030,1000,7500,3200,0),(2035,3500,15000,8000,0)]]
    investments = [{"record_id":f"INV-{y}-{t}","year":y,"state":"NEM","investment_type":t,"capex_committed_m_aud":round(random.uniform(500,5000)),"capex_pipeline_m_aud":round(random.uniform(1000,10000)),"mw_committed":random.randint(500,5000),"mw_pipeline":random.randint(1000,15000)} for y in [2026,2028,2030] for t in ["Wind","Solar","Battery","Transmission"]]
    return {"timestamp":ts,"operating_coal_units":18,"total_coal_capacity_mw":18200,"retirements_by_2030_mw":4640,"retirements_by_2035_mw":8140,"replacement_gap_2030_mw":-1200,"avg_coal_age_years":38,"retirement_records":records,"capacity_gaps":gaps,"transition_investments":investments}

@app.get("/api/system-operator/dashboard", summary="System operator directions", tags=["Market Data"])
async def system_operator_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    directions = [{"direction_id":f"DIR-{i}","issued_datetime":f"2026-02-{random.randint(1,26):02d}T{random.randint(8,20):02d}:00:00Z","region":r,"participant_id":f"P{i}","participant_name":n,"direction_type":dt,"mw_directed":round(random.uniform(50,500)),"reason":reason,"duration_minutes":random.randint(30,240),"actual_compliance_pct":round(random.uniform(85,100),1),"cost_aud":round(random.uniform(50000,500000)),"outcome":"SUCCESSFUL"} for i,(r,n,dt,reason) in enumerate([("SA1","Torrens Island","GENERATE","LOW_RESERVE"),("VIC1","Yallourn","MAINTAIN","FREQUENCY"),("NSW1","Bayswater","REDUCE_OUTPUT","NETWORK"),("QLD1","Gladstone","GENERATE","LOW_RESERVE")])]
    rert = [{"activation_id":"RERT-2026-01","activation_date":"2026-01-15","region":"SA1","trigger":"LACK_OF_RESERVE_2","contracted_mw":200,"activated_mw":180,"duration_hours":4,"providers":["SA Water","BHP Olympic Dam"],"total_cost_m_aud":2.8,"reserve_margin_pre_pct":3.2,"reserve_margin_post_pct":8.5}]
    shedding = [{"event_id":"LS-2025-001","event_date":"2025-12-20","region":"VIC1","state":"VIC","cause":"EXTREME_DEMAND","peak_shedding_mw":450,"duration_minutes":90,"affected_customers":52000,"unserved_energy_mwh":675,"financial_cost_m_aud":45,"voll_cost_m_aud":38}]
    relaxations = [{"relaxation_id":f"REL-{i}","constraint_id":f"CON-{i}","constraint_name":cn,"region":r,"relaxation_date":f"2026-02-{random.randint(1,26):02d}","original_limit_mw":ol,"relaxed_limit_mw":round(ol*1.1),"relaxation_mw":round(ol*0.1),"reason":reason,"approval_authority":"AEMO","duration_hours":round(random.uniform(2,12),1),"risk_assessment":ra} for i,(cn,r,ol,reason,ra) in enumerate([("N>>N-NIL_V5","NSW1",1350,"Thermal limit reassessed","LOW"),("S>>SA_WIND","SA1",600,"Wind forecast revised","MEDIUM")])]
    return {"timestamp":ts,"directions":directions,"rert_activations":rert,"load_shedding":shedding,"constraint_relaxations":relaxations,"total_directions_2024":42,"total_rert_activations_2024":3,"total_load_shed_mwh":675,"total_direction_cost_m_aud":4.2}

@app.get("/api/emergency-management/dashboard", summary="Emergency management", tags=["Market Data"])
async def emergency_management_dashboard():
    emergencies = [{"event_id":"EM-2025-001","name":"SA Heatwave Emergency","date":"2025-12-20","region":"SA1","emergency_class":"Lack of Reserve 3","aemo_power_invoked":"Section 116","severity_level":3,"duration_hrs":6,"mw_at_risk":800,"load_shed_mwh":450,"regions_affected":["SA1","VIC1"],"resolution_mechanism":"RERT + Direction"}]
    protocols = [{"protocol_id":f"PROT-{i}","name":n,"trigger_condition":tc,"aemo_power_section":aps,"activation_time_target_min":at,"response_resources":rr,"escalation_path":ep,"test_frequency_per_yr":tf,"last_activation_year":la,"effectiveness_score":round(random.uniform(7,10),1)} for i,(n,tc,aps,at,rr,ep,tf,la) in enumerate([("LOR1 Protocol","Reserve deficit 0-480 MW","NER 4.8.5A",15,["Demand Response","Interruptible Loads"],"LOR2 → LOR3",4,2025),("LOR2 Protocol","Reserve deficit 480-960 MW","NER 4.8.5B",10,["RERT Providers","Directions"],"LOR3 → Load Shedding",4,2024),("LOR3 Protocol","Reserve deficit >960 MW","NER 4.8.9",5,["Directions","Load Shedding"],"Emergency Trading",2,2023),("Black System Protocol","Complete system collapse","NER 4.8.12",120,["Black Start Units","Restoration Plan"],"Federal Emergency",1,2016)])]
    restoration = [{"event_id":"RS-2016-001","event_name":"South Australia Black System","region":"SA1","black_start_units":["Quarantine PS","Torrens Island"],"restoration_phases":4,"phase_1_time_hrs":2.5,"phase_2_time_hrs":5.0,"full_restoration_hrs":12.0,"critical_load_priority":"Hospitals, Water, Comms","lessons_learned":"Improved system strength requirements"}]
    preparedness = [{"region":r,"metric":"Black Start Capacity","current_value":round(random.uniform(200,800)),"target_value":round(random.uniform(300,1000)),"adequacy_status":random.choice(["ADEQUATE","MARGINAL"]),"last_tested_months_ago":random.randint(3,18),"investment_needed_m":round(random.uniform(0,50),1)} for r in ["NSW1","QLD1","VIC1","SA1","TAS1"]]
    drills = [{"drill_id":f"DRILL-{i}","drill_type":dt,"date":d,"participants":p,"scenario":sc,"duration_hrs":round(random.uniform(4,8),1),"objectives_met_pct":round(random.uniform(75,98),1),"findings_count":random.randint(3,15),"critical_findings":random.randint(0,3),"remediation_actions":random.randint(2,10)} for i,(dt,d,p,sc) in enumerate([("Tabletop","2025-06-15",["AEMO","TNSPs","Generators"],"Cascading failure in NSW"),("Live Test","2025-09-20",["AEMO","SA Generators"],"SA islanding event"),("Full Simulation","2025-11-10",["AEMO","All NEM Participants"],"Multi-region LOR3")])]
    adequate_count = sum(1 for p in preparedness if p["adequacy_status"] == "ADEQUATE")
    summary = {
        "total_emergencies_2024": len(emergencies),
        "avg_severity_level": sum(e["severity_level"] for e in emergencies) / max(len(emergencies), 1),
        "load_shed_2024_mwh": sum(e["load_shed_mwh"] for e in emergencies),
        "avg_restoration_hrs": sum(r["full_restoration_hrs"] for r in restoration) / max(len(restoration), 1),
        "preparedness_adequate_pct": round(100 * adequate_count / max(len(preparedness), 1), 1),
        "drills_per_yr_avg": round(len(drills) / 1, 1),
        "rert_activated_2024": sum(1 for e in emergencies if "RERT" in e.get("resolution_mechanism", "")),
    }
    return {"emergencies":emergencies,"protocols":protocols,"restoration":restoration,"preparedness":preparedness,"drills":drills,"summary":summary}

@app.get("/api/stpasa-adequacy/dashboard", summary="ST PASA adequacy", tags=["Market Data"])
async def stpasa_adequacy_dashboard():
    regions = ["NSW","QLD","VIC","SA","TAS"]
    outlooks = [{"outlook_id":f"STPASA-{r}-{d}","region":r,"run_date":"2026-02-26","period":f"Day {d}","assessment_period_start":f"2026-02-{26+d:02d}T00:00:00","assessment_period_end":f"2026-02-{26+d:02d}T23:59:59","surplus_mw":round(random.uniform(500,3000)),"reserve_requirement_mw":round(random.uniform(800,2500)),"scheduled_capacity_mw":round(random.uniform(8000,14000)),"forecast_demand_mw":round(random.uniform(5000,12000)),"reliability_status":random.choice(["ADEQUATE","ADEQUATE","TIGHT"]),"probability_lrc_pct":round(random.uniform(0,8),2),"triggered_rert":False,"required_reserves_mw":round(random.uniform(500,2000))} for r in regions for d in range(1,8)]
    supply = [{"supply_id":f"SUP-{r}-{h}","region":r,"run_date":"2026-02-26","assessment_hour":h,"available_generation_mw":round(random.uniform(8000,15000)),"forced_outages_mw":round(random.uniform(200,1000)),"planned_outages_mw":round(random.uniform(300,1500)),"interconnector_import_mw":round(random.uniform(-500,800)),"demand_response_mw":round(random.uniform(0,200)),"scheduled_total_mw":round(random.uniform(7000,14000)),"forecast_demand_mw":round(random.uniform(5000,12000)),"reserve_mw":round(random.uniform(500,3000)),"reserve_pct":round(random.uniform(5,25),1),"LOR_level":("LOR1" if r == "SA" and h == 16 else "LOR2" if r == "SA" and h == 18 else "None")} for r in regions for h in [8,12,16,18]]
    outages = [{"outage_id":f"OUT-{i}","region":r,"unit_name":n,"technology":t,"capacity_mw":cap,"outage_type":ot,"start_date":"2026-02-28","end_date":"2026-03-15","return_date":"2026-03-15","reliability_impact":random.choice(["LOW","MEDIUM"]),"replacement_source":"Market","surplus_impact_mw":round(-cap*random.uniform(0.5,1))} for i,(r,n,t,cap,ot) in enumerate([("NSW","Bayswater U3","BLACK_COAL",660,"Planned"),("VIC","Loy Yang A U2","BROWN_COAL",560,"Planned"),("QLD","Callide C U4","BLACK_COAL",420,"Forced")])]
    demand_fc = [{"forecast_id":f"DF-{r}-{d}","region":r,"forecast_date":f"2026-02-{27+d:02d}","period_start":f"2026-02-{27+d:02d}","forecast_50_mw":round(random.uniform(5000,12000)),"forecast_10_mw":round(random.uniform(4000,10000)),"forecast_90_mw":round(random.uniform(6000,14000)),"actual_mw":round(random.uniform(5000,12000)) if d < 3 else 0,"forecast_error_mw":round(random.uniform(-500,500)),"peak_flag":d in [2,5],"weather_driver":"Temperature","temperature_c":round(random.uniform(22,38),1)} for r in regions for d in range(7)]
    ic = [{"ic_id":f"IC-{ic}","interconnector":ic,"run_date":"2026-02-26","period":"2026-02-27","max_import_mw":mi,"max_export_mw":me,"scheduled_flow_mw":round(random.uniform(-mi,me)),"contribution_to_reserves_mw":round(random.uniform(0,300)),"congested":random.choice([True,False,False]),"constraint_binding":False,"flow_direction":random.choice(["FORWARD","REVERSE"])} for ic,mi,me in [("N-Q-MNSP1",700,1100),("VIC1-NSW1",1350,1600),("V-SA",680,460),("T-V-MNSP1",594,478)]]
    rert = [{"rert_id":"RERT-ST-001","region":"SA","activation_date":"2026-02-20","stage":"Pre-activation","trigger_lor_level":"LOR2","contracted_mw":200,"activated_mw":0,"provider_type":"Industrial DR","activation_cost_m":0.5,"duration_hours":0,"effectiveness_pct":0,"avoided_energy_unserved_mwh":0}]
    regions_with_lor = sum(1 for s in supply if s["LOR_level"] not in ("None", "LOR0"))
    avg_reserve = sum(s["reserve_pct"] for s in supply) / max(len(supply), 1)
    total_surplus = sum(o["surplus_mw"] for o in outlooks) / max(len(regions), 1)
    stpa_summary = {
        "regions_with_lor": regions_with_lor,
        "total_surplus_mw": round(total_surplus),
        "avg_reserve_pct": round(avg_reserve, 1),
        "rert_activations_ytd": len(rert),
        "national_surplus_mw": 4200,
        "lowest_reserve_region": "SA",
        "lor_warnings_active": regions_with_lor,
    }
    return {"outlooks":outlooks,"supply_records":supply,"outages":outages,"demand_forecasts":demand_fc,"interconnector_records":ic,"rert_activations":rert,"summary":stpa_summary}

@app.get("/api/electricity-market-transparency/dashboard", summary="Market transparency", tags=["Market Data"])
async def electricity_market_transparency_dashboard():
    data_quality = [{"report_month":f"2025-{m:02d}","data_type":dt,"completeness_pct":round(random.uniform(95,100),1),"timeliness_score":round(random.uniform(7,10),1),"error_rate_pct":round(random.uniform(0.1,2),2),"corrections_issued":random.randint(0,5),"user_complaints":random.randint(0,3),"api_uptime_pct":round(random.uniform(99,99.99),2),"revision_frequency":round(random.uniform(0.5,3),1)} for dt in ["Dispatch","Settlement","Bids","Forecasts"] for m in range(1,13)]
    compliance = [{"participant":n,"participant_type":pt,"reporting_period":"2025","reports_due":52,"reports_submitted":random.randint(48,52),"reports_late":random.randint(0,4),"data_errors":random.randint(0,8),"non_compliance_notices":random.randint(0,2),"penalty_aud":round(random.uniform(0,50000)),"exemptions_granted":random.randint(0,1)} for n,pt in [("Origin","Generator"),("AGL","Generator"),("EnergyAustralia","Retailer"),("Snowy Hydro","Generator")]]
    notices = [{"notice_id":f"MN-{i}","notice_date":f"2026-02-{random.randint(1,26):02d}","notice_type":nt,"region":random.choice(["NSW1","QLD1","VIC1","SA1"]),"lead_time_minutes":random.randint(15,120),"accuracy_pct":round(random.uniform(70,100),1),"market_impact_mwh":round(random.uniform(0,500)),"price_impact_mwh":round(random.uniform(-20,50),2),"participants_affected":random.randint(5,50)} for i,nt in enumerate(["Inter-Regional Transfer Limit","Constraint","LOR Warning","Price Revision","System Normal"])]
    audits = [{"audit_id":f"AUD-{i}","auditor":"AER","participant":n,"audit_year":2025,"audit_type":at,"findings_count":random.randint(1,8),"critical_findings":random.randint(0,2),"recommendations":random.randint(2,10),"remediation_status":random.choice(["Complete","In Progress"]),"penalty_issued_m":round(random.uniform(0,2),1)} for i,(n,at) in enumerate([("Origin","Bidding Compliance"),("AGL","Settlement Accuracy"),("EnergyAustralia","Reporting Timeliness")])]
    info_gaps = [{"metric_name":mn,"region":"NEM","information_advantage_score":round(random.uniform(2,8),1),"data_lag_minutes":lag,"public_access":pa,"participant_only":not pa,"institutional_advantage_score":round(random.uniform(1,5),1),"retail_customer_access":ra,"improvement_priority":ip} for mn,lag,pa,ra,ip in [("Real-Time Dispatch",5,True,True,"LOW"),("Bid Stack Data",30,True,False,"MEDIUM"),("Settlement Data",1440,False,False,"HIGH"),("Network Constraints",60,True,False,"MEDIUM")]]
    scores = [{"year":y,"region":r,"overall_transparency_score":round(random.uniform(60,92),1),"data_quality_score":round(random.uniform(70,95),1),"timeliness_score":round(random.uniform(55,90),1),"accessibility_score":round(random.uniform(50,85),1),"completeness_score":round(random.uniform(70,95),1),"participant_compliance_score":round(random.uniform(70,90),1),"public_confidence_index":round(random.uniform(60,85),1)} for r in ["NEM","NSW","VIC","QLD","SA","TAS"] for y in [2020,2021,2022,2023,2024]]
    avg_completeness = sum(d["completeness_pct"] for d in data_quality) / max(len(data_quality), 1)
    avg_uptime = sum(d["api_uptime_pct"] for d in data_quality) / max(len(data_quality), 1)
    total_penalties = sum(a["penalty_issued_m"] for a in audits) + sum(c["penalty_aud"] for c in compliance) / 1_000_000
    best_region = max([(r, sum(s["overall_transparency_score"] for s in scores if s["region"] == r and s["year"] == 2024)) for r in ["NSW","VIC","QLD","SA","TAS"]], key=lambda x: x[1])[0]
    avg_score = sum(s["overall_transparency_score"] for s in scores if s["year"] == 2024) / max(sum(1 for s in scores if s["year"] == 2024), 1)
    emt_summary = {
        "avg_data_completeness_pct": round(avg_completeness, 1),
        "avg_api_uptime_pct": round(avg_uptime, 2),
        "total_penalties_m": round(total_penalties, 2),
        "avg_transparency_score": round(avg_score, 1),
        "highest_transparency_region": best_region,
        "overall_score": round(avg_score, 1),
        "data_completeness_pct": round(avg_completeness, 1),
    }
    return {"data_quality":data_quality,"compliance":compliance,"market_notices":notices,"audits":audits,"information_gaps":info_gaps,"transparency_scores":scores,"summary":emt_summary}

@app.get("/api/aemo-market-operations/dashboard", summary="AEMO market operations", tags=["Market Data"])
async def aemo_market_operations_dashboard():
    regions = ["NSW1","QLD1","VIC1","SA1","TAS1"]
    dispatch = [{"region":r,"month":f"2025-{m:02d}","total_dispatched_gwh":round(random.uniform(2000,8000),1),"renewable_dispatched_gwh":round(random.uniform(500,3500),1),"renewable_share_pct":round(random.uniform(20,55),1),"avg_dispatch_price":round(random.uniform(40,120),2),"rebid_count":random.randint(500,3000),"constraint_count":random.randint(50,300),"intervention_count":random.randint(0,5)} for r in regions for m in range(1,13)]
    notices = [{"notice_type":nt,"region":r,"month":"2025-12","count":random.randint(5,50),"avg_duration_min":round(random.uniform(30,240)),"avg_price_impact":round(random.uniform(-10,30),2),"total_unserved_energy_mwh":round(random.uniform(0,100),1)} for nt in ["LOR","Constraint","Direction","Price Revision"] for r in regions[:3]]
    settlement = [{"quarter":f"2025-Q{q}","region":r,"total_energy_payments_m":round(random.uniform(500,2000),1),"fcas_payments_m":round(random.uniform(20,100),1),"settlement_residue_m":round(random.uniform(5,50),1),"prudential_requirement_m":round(random.uniform(50,200),1),"credit_support_m":round(random.uniform(60,250),1),"default_events":0} for q in range(1,5) for r in regions[:3]]
    predispatch = [{"region":r,"month":"2025-12","predispatch_mae_pct":round(random.uniform(5,15),1),"st_predispatch_mae_pct":round(random.uniform(3,10),1),"price_forecast_accuracy_pct":round(random.uniform(70,90),1),"demand_forecast_mae_gwh":round(random.uniform(0.5,3),2),"renewable_forecast_mae_gwh":round(random.uniform(0.3,2),2)} for r in regions]
    system_normal = [{"metric":m,"region":"NEM","year":2025,"events_count":random.randint(5,50),"total_duration_hours":round(random.uniform(10,200),1),"max_severity_mw":round(random.uniform(100,2000)),"regulatory_action_taken":random.choice([True,False])} for m in ["Frequency Excursion","Voltage Deviation","Constraint Violation","System Restart","Load Shedding"]]
    total_notices = sum(n["count"] for n in notices)
    avg_pred_acc = sum(p["price_forecast_accuracy_pct"] for p in predispatch) / max(len(predispatch), 1)
    return {"dispatch":dispatch,"notices":notices,"settlement":settlement,"predispatch":predispatch,"system_normal":system_normal,"summary":{"total_dispatched_twh":195.4,"avg_renewable_share_pct":38.2,"total_notices":total_notices,"avg_predispatch_accuracy_pct":round(avg_pred_acc,1)}}

@app.get("/api/storage/dashboard", summary="Energy storage projects", tags=["Market Data"])
async def storage_dashboard():
    ts = datetime.now(timezone.utc).isoformat()
    projects = [{"project_id":f"BESS-{i}","project_name":n,"owner":own,"state":s,"technology":t,"capacity_mwh":mwh,"power_mw":mw,"duration_hours":round(mwh/mw,1),"round_trip_efficiency_pct":round(random.uniform(85,92),1),"commissioning_year":cy,"status":st,"energy_arbitrage_revenue_m_aud":round(random.uniform(2,15),1),"fcas_revenue_m_aud":round(random.uniform(1,8),1),"capacity_revenue_m_aud":round(random.uniform(0.5,4),1),"capex_m_aud":round(mwh*random.uniform(0.3,0.6),1),"lcoe_mwh":round(random.uniform(100,200),2)} for i,(n,own,s,t,mwh,mw,cy,st) in enumerate([("Victorian Big Battery","Neoen","VIC","Li-ion NMC",450,300,2022,"Operating"),("Waratah Super Battery","Akaysha","NSW","Li-ion LFP",1680,850,2025,"Operating"),("Torrens Island BESS","AGL","SA","Li-ion LFP",500,250,2024,"Operating"),("Bouldercombe Battery","Genex","QLD","Li-ion LFP",2000,500,2026,"Under Construction"),("Kidston Pumped Hydro","Genex","QLD","Pumped Hydro",24000,250,2025,"Commissioning")])]
    dispatch = [{"project_id":f"BESS-{i%5}","trading_interval":f"2026-02-26T{h:02d}:00:00","charge_mw":round(random.uniform(-300,0) if h<12 else 0),"soc_pct":round(random.uniform(20,90),1),"spot_price_aud_mwh":round(random.uniform(30,150),2),"fcas_raise_revenue_aud":round(random.uniform(100,2000),2),"fcas_lower_revenue_aud":round(random.uniform(100,1500),2),"net_revenue_aud":round(random.uniform(-500,5000),2)} for i,h in enumerate([4,8,10,12,14,16,18,20])]
    return {"timestamp":ts,"total_storage_capacity_mwh":28630,"total_storage_power_mw":2150,"operating_projects":3,"avg_round_trip_efficiency_pct":88.5,"total_annual_revenue_m_aud":125,"projects":projects,"dispatch_records":dispatch}


# =========================================================================
# NEM Suspension / Market Events Analysis endpoints
# =========================================================================

@app.get("/api/nem-suspension/dashboard")
async def nem_suspension_dashboard():
    import random
    ts = "2026-02-27T06:00:00+11:00"
    events = [
        {"event_id":"EVT001","event_name":"SA System Black","start_date":"2016-09-28","end_date":"2016-10-11","duration_days":13,"event_type":"SYSTEM_BLACK","regions_affected":["SA1"],"trigger":"Severe storm destroyed transmission towers; cascading failure","avg_spot_price_before_aud_mwh":52.30,"avg_spot_price_during_aud_mwh":14200.00,"max_spot_price_aud_mwh":14200.00,"total_market_cost_m_aud":367.0,"load_shed_mwh":524000,"generators_directed":12,"aemo_market_notices":47},
        {"event_id":"EVT002","event_name":"QLD-NSW Separation Event","start_date":"2021-05-25","end_date":"2021-05-26","duration_days":1,"event_type":"SEPARATION","regions_affected":["QLD1","NSW1"],"trigger":"QNI trip due to lightning; QLD islanded","avg_spot_price_before_aud_mwh":68.40,"avg_spot_price_during_aud_mwh":1540.00,"max_spot_price_aud_mwh":15100.00,"total_market_cost_m_aud":42.0,"load_shed_mwh":0,"generators_directed":4,"aemo_market_notices":15},
        {"event_id":"EVT003","event_name":"Feb 2017 NSW Heatwave","start_date":"2017-02-10","end_date":"2017-02-12","duration_days":2,"event_type":"PRICE_SPIKE","regions_affected":["NSW1","VIC1"],"trigger":"Extreme heat 45°C+; record demand; Liddell unit trip","avg_spot_price_before_aud_mwh":71.20,"avg_spot_price_during_aud_mwh":6800.00,"max_spot_price_aud_mwh":14200.00,"total_market_cost_m_aud":185.0,"load_shed_mwh":35000,"generators_directed":7,"aemo_market_notices":28},
        {"event_id":"EVT004","event_name":"2019 VIC Bushfire Emergency","start_date":"2019-11-21","end_date":"2019-11-24","duration_days":3,"event_type":"EMERGENCY","regions_affected":["VIC1"],"trigger":"Bushfire damage to 500kV Moorabool–Haunted Gully line","avg_spot_price_before_aud_mwh":58.10,"avg_spot_price_during_aud_mwh":2340.00,"max_spot_price_aud_mwh":14700.00,"total_market_cost_m_aud":89.0,"load_shed_mwh":18000,"generators_directed":5,"aemo_market_notices":22},
        {"event_id":"EVT005","event_name":"June 2022 Market Suspension","start_date":"2022-06-15","end_date":"2022-06-24","duration_days":9,"event_type":"MARKET_SUSPENSION","regions_affected":["NSW1","QLD1","SA1","VIC1","TAS1"],"trigger":"Cumulative coal outages + gas shortages; AEMO suspended spot market","avg_spot_price_before_aud_mwh":264.00,"avg_spot_price_during_aud_mwh":0.0,"max_spot_price_aud_mwh":15500.00,"total_market_cost_m_aud":1850.0,"load_shed_mwh":0,"generators_directed":28,"aemo_market_notices":92},
        {"event_id":"EVT006","event_name":"TAS Basslink Cable Failure","start_date":"2015-12-20","end_date":"2016-06-13","duration_days":176,"event_type":"SEPARATION","regions_affected":["TAS1"],"trigger":"Basslink undersea cable failure; TAS islanded for 6 months","avg_spot_price_before_aud_mwh":38.50,"avg_spot_price_during_aud_mwh":95.40,"max_spot_price_aud_mwh":1420.00,"total_market_cost_m_aud":145.0,"load_shed_mwh":0,"generators_directed":3,"aemo_market_notices":180},
        {"event_id":"EVT007","event_name":"Jan 2024 SA Heatwave Spike","start_date":"2024-01-18","end_date":"2024-01-19","duration_days":1,"event_type":"PRICE_SPIKE","regions_affected":["SA1","VIC1"],"trigger":"Heatwave 44°C; wind output dropped to 5% capacity; gas peakers maxed","avg_spot_price_before_aud_mwh":82.00,"avg_spot_price_during_aud_mwh":4200.00,"max_spot_price_aud_mwh":16600.00,"total_market_cost_m_aud":62.0,"load_shed_mwh":8000,"generators_directed":6,"aemo_market_notices":14},
        {"event_id":"EVT008","event_name":"2020 QLD Callide Explosion","start_date":"2021-05-25","end_date":"2021-06-30","duration_days":36,"event_type":"EMERGENCY","regions_affected":["QLD1"],"trigger":"Callide C4 turbine hall explosion; 2 units offline for years","avg_spot_price_before_aud_mwh":55.00,"avg_spot_price_during_aud_mwh":310.00,"max_spot_price_aud_mwh":15100.00,"total_market_cost_m_aud":520.0,"load_shed_mwh":0,"generators_directed":8,"aemo_market_notices":65},
    ]
    interventions = [
        {"intervention_id":"INT001","event_id":"EVT001","intervention_type":"DIRECTION","date":"2016-09-28","region":"SA1","generator_or_party":"Torrens Island B","quantity_mw":480,"duration_hrs":72,"trigger_reason":"System restart after blackout","cost_m_aud":18.5,"outcome":"Successful restart sequence"},
        {"intervention_id":"INT002","event_id":"EVT001","intervention_type":"LOAD_SHEDDING","date":"2016-09-28","region":"SA1","generator_or_party":"SA Power Networks","quantity_mw":1200,"duration_hrs":8,"trigger_reason":"Total system black","cost_m_aud":0.0,"outcome":"Rolling restoration over 8 hours"},
        {"intervention_id":"INT003","event_id":"EVT003","intervention_type":"DIRECTION","date":"2017-02-10","region":"NSW1","generator_or_party":"Vales Point B","quantity_mw":660,"duration_hrs":12,"trigger_reason":"Reliability and Reserve Trader (RERT)","cost_m_aud":8.2,"outcome":"Avoided load shedding"},
        {"intervention_id":"INT004","event_id":"EVT003","intervention_type":"RERT_ACTIVATION","date":"2017-02-11","region":"NSW1","generator_or_party":"EnergyAustralia","quantity_mw":350,"duration_hrs":6,"trigger_reason":"LOR3 condition","cost_m_aud":12.0,"outcome":"350MW emergency reserve activated"},
        {"intervention_id":"INT005","event_id":"EVT005","intervention_type":"MARKET_SUSPENSION","date":"2022-06-15","region":"NSW1","generator_or_party":"AEMO","quantity_mw":0,"duration_hrs":216,"trigger_reason":"Administered pricing cap hit 7 times in 336 intervals","cost_m_aud":0.0,"outcome":"Spot market suspended; AEMO directed all generation"},
        {"intervention_id":"INT006","event_id":"EVT005","intervention_type":"DIRECTION","date":"2022-06-16","region":"QLD1","generator_or_party":"Gladstone PS","quantity_mw":1680,"duration_hrs":192,"trigger_reason":"Coal unit returning from outage; directed to generate","cost_m_aud":45.0,"outcome":"Critical base-load restored"},
        {"intervention_id":"INT007","event_id":"EVT005","intervention_type":"DIRECTION","date":"2022-06-17","region":"VIC1","generator_or_party":"Loy Yang A","quantity_mw":2200,"duration_hrs":168,"trigger_reason":"Unplanned outage recall","cost_m_aud":52.0,"outcome":"VIC supply stabilised"},
        {"intervention_id":"INT008","event_id":"EVT006","intervention_type":"DIRECTION","date":"2016-01-15","region":"TAS1","generator_or_party":"Tamar Valley CCGT","quantity_mw":208,"duration_hrs":2160,"trigger_reason":"Gas generation directed during Basslink outage","cost_m_aud":35.0,"outcome":"TAS supply maintained via hydro + gas"},
        {"intervention_id":"INT009","event_id":"EVT007","intervention_type":"LOAD_SHEDDING","date":"2024-01-18","region":"SA1","generator_or_party":"SA Power Networks","quantity_mw":200,"duration_hrs":2,"trigger_reason":"LOR3 actual; insufficient generation","cost_m_aud":0.0,"outcome":"200MW rotational load shed"},
        {"intervention_id":"INT010","event_id":"EVT008","intervention_type":"DIRECTION","date":"2021-05-26","region":"QLD1","generator_or_party":"Stanwell PS","quantity_mw":1400,"duration_hrs":480,"trigger_reason":"Emergency direction to cover Callide C loss","cost_m_aud":28.0,"outcome":"QLD supply maintained"},
    ]
    timeline = [
        {"record_id":"TL001","event_id":"EVT005","timestamp":"2022-06-12T00:00:00","milestone":"Cumulative Price Threshold (CPT) exceeded","milestone_type":"TRIGGER","region":"QLD1","detail":"QLD CPT hit $1,359,100 — exceeding $1,313,100 threshold"},
        {"record_id":"TL002","event_id":"EVT005","timestamp":"2022-06-13T14:00:00","milestone":"Administered Price Cap activated","milestone_type":"INTERVENTION","region":"NSW1","detail":"APC of $300/MWh applied across NEM"},
        {"record_id":"TL003","event_id":"EVT005","timestamp":"2022-06-15T14:05:00","milestone":"AEMO suspends spot market","milestone_type":"SUSPENSION","region":"ALL","detail":"First NEM-wide market suspension in history"},
        {"record_id":"TL004","event_id":"EVT005","timestamp":"2022-06-22T00:00:00","milestone":"Coal units begin returning","milestone_type":"RECOVERY","region":"QLD1","detail":"Gladstone and Stanwell units restarted"},
        {"record_id":"TL005","event_id":"EVT005","timestamp":"2022-06-24T06:00:00","milestone":"Spot market resumes","milestone_type":"RESOLUTION","region":"ALL","detail":"AEMO lifts suspension; normal dispatch resumes"},
        {"record_id":"TL006","event_id":"EVT001","timestamp":"2016-09-28T16:18:00","milestone":"Tornado destroys transmission towers","milestone_type":"TRIGGER","region":"SA1","detail":"Two tornadoes damage 22 transmission towers on 275kV lines"},
        {"record_id":"TL007","event_id":"EVT001","timestamp":"2016-09-28T16:18:30","milestone":"SA system black","milestone_type":"SUSPENSION","region":"SA1","detail":"Entire SA grid collapses; 1.7 million customers without power"},
        {"record_id":"TL008","event_id":"EVT001","timestamp":"2016-09-28T19:00:00","milestone":"Restoration begins","milestone_type":"RECOVERY","region":"SA1","detail":"Torrens Island B directed to start; first loads restored"},
        {"record_id":"TL009","event_id":"EVT001","timestamp":"2016-10-11T00:00:00","milestone":"Full restoration complete","milestone_type":"RESOLUTION","region":"SA1","detail":"All SA loads restored; investigation begins"},
        {"record_id":"TL010","event_id":"EVT008","timestamp":"2021-05-25T13:44:00","milestone":"Callide C4 turbine explosion","milestone_type":"TRIGGER","region":"QLD1","detail":"Catastrophic turbine failure at Callide C4; 2 workers injured"},
        {"record_id":"TL011","event_id":"EVT008","timestamp":"2021-05-25T14:00:00","milestone":"QLD-NSW separation","milestone_type":"INTERVENTION","region":"QLD1","detail":"QNI trips due to frequency deviation; QLD islanded"},
        {"record_id":"TL012","event_id":"EVT008","timestamp":"2021-06-30T00:00:00","milestone":"QLD supply stabilised","milestone_type":"RESOLUTION","region":"QLD1","detail":"Stanwell and Gladstone compensate for Callide loss"},
        {"record_id":"TL013","event_id":"EVT007","timestamp":"2024-01-18T14:30:00","milestone":"SA LOR3 declared","milestone_type":"TRIGGER","region":"SA1","detail":"Wind drops to 5% capacity; temperature hits 44°C"},
        {"record_id":"TL014","event_id":"EVT007","timestamp":"2024-01-18T15:00:00","milestone":"Load shedding activated","milestone_type":"INTERVENTION","region":"SA1","detail":"200MW rotational load shed across Adelaide metro"},
        {"record_id":"TL015","event_id":"EVT007","timestamp":"2024-01-19T06:00:00","milestone":"Conditions ease","milestone_type":"RESOLUTION","region":"SA1","detail":"Temperature drops; wind output recovers; LOR3 cancelled"},
    ]
    total_cost = sum(e["total_market_cost_m_aud"] for e in events)
    total_shed = sum(e["load_shed_mwh"] for e in events) / 1000  # to GWh
    total_days = sum(e["duration_days"] for e in events)
    return {"timestamp":ts,"total_events_5yr":len(events),"total_suspension_days":total_days,"total_market_cost_m_aud":round(total_cost,1),"total_load_shed_gwh":round(total_shed,1),"events":events,"interventions":interventions,"timeline":timeline}

@app.get("/api/nem-suspension/events")
async def nem_suspension_events():
    d = await nem_suspension_dashboard()
    return d["events"]

@app.get("/api/nem-suspension/interventions")
async def nem_suspension_interventions():
    d = await nem_suspension_dashboard()
    return d["interventions"]

@app.get("/api/nem-suspension/timeline")
async def nem_suspension_timeline():
    d = await nem_suspension_dashboard()
    return d["timeline"]

# =========================================================================
# Price Setter & Marginal Generator Analytics
# =========================================================================

@app.get("/api/price-setter/dashboard")
async def price_setter_dashboard(region: str = "SA1"):
    import random as _r
    _r.seed(hash(region) % 10000)

    fuels = ["Wind", "Solar", "Gas OCGT", "Gas CCGT", "Battery", "Coal", "Hydro"]
    stations = {
        "Wind": [("ARWF1", "Ararat Wind Farm"), ("HDWF1", "Hallet Wind Farm"), ("MLWF1", "Macarthur Wind")],
        "Solar": [("DDSF1", "Darlington Point Solar"), ("BALBG1", "Bald Hills Solar"), ("LRSF1", "Limondale Solar")],
        "Gas OCGT": [("CALL_B_1", "Callide B1"), ("OSPS1", "Osborne PS"), ("PPCCGT", "Pelican Point")],
        "Gas CCGT": [("PPCCGT", "Pelican Point"), ("TORRA1", "Torrens Island A1")],
        "Battery": [("HPRG1", "Hornsdale Power Reserve"), ("VBBL1", "Victorian Big Battery")],
        "Coal": [("BW01", "Bayswater 1"), ("ER01", "Eraring 1"), ("VP5", "Vales Point 5")],
        "Hydro": [("MURRAY1", "Murray 1"), ("TUMUT3", "Tumut 3")],
    }

    # Generate 24 interval records (5-min intervals, last 2 hours)
    records = []
    for i in range(24):
        fuel = _r.choice(fuels)
        duid, sname = _r.choice(stations[fuel])
        price = round(_r.gauss(85 if region == "SA1" else 65, 40), 2)
        strategic = _r.random() < 0.12
        records.append({
            "interval": f"{6 + i // 12}:{(i % 12) * 5:02d}",
            "region": region,
            "duid": duid,
            "station_name": sname,
            "fuel_type": fuel,
            "dispatch_price": price,
            "dispatch_quantity_mw": round(_r.uniform(50, 500), 1),
            "offer_band": f"Band {_r.randint(1, 10)}",
            "offer_price": round(price * _r.uniform(0.7, 1.0), 2),
            "is_strategic": strategic,
            "shadow_price_mw": round(_r.uniform(0.5, 8.0), 1),
        })

    # Fuel type stats
    fuel_stats = []
    remaining = 100.0
    for j, fuel in enumerate(fuels):
        pct = round(_r.uniform(5, 30), 1) if j < len(fuels) - 1 else round(remaining, 1)
        remaining -= pct
        if remaining < 0:
            pct += remaining
            remaining = 0
        fuel_stats.append({
            "fuel_type": fuel,
            "intervals_as_price_setter": _r.randint(10, 80),
            "pct_of_all_intervals": round(max(pct, 1.0), 1),
            "avg_price_aud_mwh": round(_r.uniform(40, 200), 0),
            "max_price_aud_mwh": round(_r.uniform(200, 5000), 0),
            "economic_rent_est_m_aud": round(_r.uniform(0.1, 15.0), 2),
        })

    # Frequency stats
    freq_stats = []
    for fuel in fuels:
        for duid, sname in stations[fuel][:1]:
            freq_stats.append({
                "duid": duid,
                "station_name": sname,
                "fuel_type": fuel,
                "region": region,
                "capacity_mw": _r.randint(100, 800),
                "intervals_as_price_setter": _r.randint(5, 60),
                "pct_intervals": round(_r.uniform(1, 25), 1),
                "avg_price_when_setter": round(_r.uniform(30, 250), 0),
                "max_price_when_setter": round(_r.uniform(200, 8000), 0),
                "estimated_daily_price_power_aud": round(_r.uniform(500, 50000), 0),
                "strategic_bids_pct": round(_r.uniform(0, 35), 1),
            })
    freq_stats.sort(key=lambda x: x["intervals_as_price_setter"], reverse=True)

    dominant = max(freq_stats, key=lambda x: x["intervals_as_price_setter"])
    dominant_fuel = max(fuel_stats, key=lambda x: x["pct_of_all_intervals"])
    strategic_pct = round(sum(1 for r in records if r["is_strategic"]) / max(len(records), 1) * 100, 1)
    avg_price = round(sum(r["dispatch_price"] for r in records) / max(len(records), 1), 0)
    current = records[-1] if records else None

    return {
        "timestamp": "2026-02-27T08:00:00Z",
        "region": region,
        "total_intervals_today": len(records),
        "dominant_price_setter": dominant["station_name"],
        "dominant_fuel_type": dominant_fuel["fuel_type"],
        "strategic_bid_frequency_pct": strategic_pct,
        "avg_price_today": avg_price,
        "current_price_setter": current["station_name"] if current else "Unknown",
        "current_price": current["dispatch_price"] if current else 0,
        "price_setter_records": records,
        "frequency_stats": freq_stats,
        "fuel_type_stats": fuel_stats,
    }

@app.get("/api/price-setter/records")
async def price_setter_records(region: str = "SA1"):
    data = await price_setter_dashboard(region)
    return data["price_setter_records"]

@app.get("/api/price-setter/frequency")
async def price_setter_frequency(region: str = "SA1"):
    data = await price_setter_dashboard(region)
    return data["frequency_stats"]

# =========================================================================
# Spot Price Cap & CPT Analytics
# =========================================================================

def _build_spot_cap_data():
    import random as _r
    _r.seed(42)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]

    events = []
    for i in range(30):
        reg = _r.choice(regions)
        is_floor = _r.random() < 0.25
        spot = round(_r.uniform(-1100, -900), 2) if is_floor else round(_r.uniform(14000, 15500), 2)
        events.append({
            "event_id": f"CE-2025-{i+1:04d}",
            "region": reg,
            "trading_interval": f"2025-{_r.randint(1,12):02d}-{_r.randint(1,28):02d}T{_r.randint(6,20):02d}:{_r.choice(['00','05','10','15','20','25','30','35','40','45','50','55'])}:00",
            "spot_price": spot,
            "market_price_cap": 15500,
            "below_floor": is_floor,
            "floor_price": -1000,
            "cumulative_price_at_interval": round(_r.uniform(200000, 1350000), 2),
            "dispatch_intervals_capped": _r.randint(0, 12) if not is_floor else 0,
        })

    cpt_records = []
    for reg in regions:
        for q in ["Q1-2025", "Q2-2025", "Q3-2025", "Q4-2025"]:
            base_cum = _r.uniform(400000, 1200000)
            cpt_records.append({
                "region": reg,
                "trading_date": f"2025-{['03','06','09','12'][['Q1-2025','Q2-2025','Q3-2025','Q4-2025'].index(q)]}-28",
                "cumulative_price": round(base_cum, 2),
                "cpt_threshold": 1300000,
                "pct_of_cpt": round(base_cum / 1300000 * 100, 2),
                "daily_avg_price": round(_r.uniform(50, 200), 2),
                "cap_events_today": _r.randint(0, 5),
                "floor_events_today": _r.randint(0, 2),
                "days_until_reset": _r.randint(1, 90),
                "quarter": q,
            })

    regional_summaries = []
    for reg in regions:
        regional_summaries.append({
            "region": reg,
            "year": 2025,
            "total_cap_events": _r.randint(10, 60),
            "total_floor_events": _r.randint(2, 20),
            "avg_price_during_cap_events": round(_r.uniform(12000, 15500), 0),
            "max_cumulative_price": round(_r.uniform(600000, 1350000), 0),
            "cpt_breaches": _r.randint(0, 2),
            "total_cpt_periods": _r.randint(3, 8),
            "revenue_impact_m_aud": round(_r.uniform(5, 80), 1),
        })

    active_cpt = [r for r in regions if _r.random() < 0.4]
    total_cap = sum(s["total_cap_events"] for s in regional_summaries)
    total_floor = sum(s["total_floor_events"] for s in regional_summaries)

    return {
        "timestamp": "2025-12-28T14:30:00+11:00",
        "market_price_cap_aud": 15500,
        "market_floor_price_aud": -1000,
        "cumulative_price_threshold_aud": 1300000,
        "cpt_period_days": 336,
        "national_cap_events_ytd": total_cap,
        "national_floor_events_ytd": total_floor,
        "active_cpt_regions": active_cpt,
        "cap_events": events,
        "cpt_tracker": cpt_records,
        "regional_summaries": regional_summaries,
    }

@app.get("/api/spot-cap/dashboard")
async def spot_cap_dashboard():
    return _build_spot_cap_data()

@app.get("/api/spot-cap/cpt-tracker")
async def spot_cap_cpt_tracker(region: str = None, quarter: str = None):
    data = _build_spot_cap_data()
    records = data["cpt_tracker"]
    if region:
        records = [r for r in records if r["region"] == region]
    if quarter:
        records = [r for r in records if r["quarter"] == quarter]
    return records

@app.get("/api/spot-cap/cap-events")
async def spot_cap_events(region: str = None):
    data = _build_spot_cap_data()
    events = data["cap_events"]
    if region:
        events = [e for e in events if e["region"] == region]
    return events


# ---------------------------------------------------------------------------
# 1) /api/spike-analysis/dashboard  ->  PSADashboard
# ---------------------------------------------------------------------------

@app.get("/api/spike-analysis/dashboard")
def spike_analysis_dashboard():
    _r.seed(101)
    regions = ["NSW1", "VIC1", "QLD1", "SA1", "TAS1"]
    root_causes = [
        "GENERATION_SHORTFALL", "NETWORK_CONSTRAINT", "DEMAND_SPIKE",
        "STRATEGIC_BIDDING", "WEATHER",
    ]
    severities = ["MODERATE", "HIGH", "EXTREME", "MARKET_SUSPENSION"]
    contribution_types = [
        "WITHDREW_CAPACITY", "REBID_HIGH", "FCAS_RESPONSE",
        "DEMAND_REDUCTION", "CONSTRAINT_BINDING",
    ]
    regulatory_actions = ["INVESTIGATED", "CAUTIONED", "FINED", "CLEARED", None]
    technologies = ["Gas Peaker", "Coal", "Battery", "Hydro", "Wind"]
    consumer_segments = ["Residential", "Commercial", "Industrial", "Large User"]
    participants = [
        "AGL Energy", "Origin Energy", "EnergyAustralia", "Snowy Hydro",
        "CS Energy", "Stanwell", "Alinta Energy", "Engie",
    ]

    event_names = [
        "SA Heatwave Jan 2024", "QLD Cyclone Grid Stress", "VIC Evening Ramp Failure",
        "NSW Coal Trip Aug 2023", "TAS Low Hydro Event", "SA Interconnector Trip",
        "QLD Summer Demand Peak", "NSW Strategic Rebid Event",
        "VIC Wind Drought Feb 2024", "SA Solar Cliff Event",
        "QLD Generator Outage Mar 2024", "NSW Bushfire Network Fault",
    ]

    spike_events = []
    for i, name in enumerate(event_names):
        region = regions[i % len(regions)]
        base_date = _dt(2022, 6, 1) + _td(days=_r.randint(0, 900))
        peak = _r.choice([5000, 8500, 12000, 15100, 16600])
        dur = _r.choice([30, 60, 90, 120, 180, 240, 360])
        pre_avg = _r.uniform(40, 120)
        spike_events.append({
            "spike_id": f"SPK-{2022 + i // 4}-{i + 1:03d}",
            "event_name": name,
            "region": region,
            "event_date": base_date.strftime("%Y-%m-%d"),
            "start_time": f"{_r.randint(6, 20):02d}:{_r.choice(['00', '30'])}",
            "end_time": f"{_r.randint(7, 23):02d}:{_r.choice(['00', '30'])}",
            "duration_minutes": dur,
            "peak_price_aud_mwh": peak,
            "avg_price_during_spike": round(peak * _r.uniform(0.35, 0.65), 2),
            "pre_spike_avg_price": round(pre_avg, 2),
            "price_multiple": round(peak / pre_avg, 1),
            "total_revenue_m_aud": round(_r.uniform(1.5, 45.0), 2),
            "consumer_cost_m_aud": round(_r.uniform(2.0, 55.0), 1),
            "hedged_consumer_cost_m_aud": round(_r.uniform(0.5, 15.0), 2),
            "root_cause": _r.choice(root_causes),
            "severity": _r.choice(severities),
        })

    contributors = []
    for ev in spike_events:
        for _ in range(_r.randint(2, 5)):
            contributors.append({
                "spike_id": ev["spike_id"],
                "participant_name": _r.choice(participants),
                "technology": _r.choice(technologies),
                "contribution_type": _r.choice(contribution_types),
                "mw_impact": round(_r.uniform(-500, 800), 0),
                "price_contribution_aud_mwh": round(_r.uniform(200, 8000), 0),
                "revenue_gained_m_aud": round(_r.uniform(0.2, 12.0), 1),
                "regulatory_action": _r.choice(regulatory_actions),
            })

    consumer_impacts = []
    for ev in spike_events:
        for seg in consumer_segments:
            consumer_impacts.append({
                "spike_id": ev["spike_id"],
                "consumer_segment": seg,
                "region": ev["region"],
                "hedged_exposure_pct": round(_r.uniform(30, 95), 1),
                "unhedged_cost_m_aud": round(_r.uniform(0.1, 18.0), 1),
                "demand_response_mw": round(_r.uniform(5, 350), 0),
                "air_con_curtailment_mw": round(_r.uniform(0, 180), 0),
                "price_signal_response_pct": round(_r.uniform(2, 25), 1),
            })

    regional_timelines = []
    for ev in spike_events[:4]:
        for minute_offset in range(0, 360, 30):
            regional_timelines.append({
                "spike_id": ev["spike_id"],
                "region": ev["region"],
                "interval": (
                    _dt.strptime(ev["event_date"], "%Y-%m-%d")
                    + _td(minutes=minute_offset)
                ).isoformat(),
                "spot_price": round(_r.uniform(-50, ev["peak_price_aud_mwh"]), 2),
                "generation_mw": round(_r.uniform(6000, 12000), 0),
                "demand_mw": round(_r.uniform(7000, 13000), 0),
                "interconnector_flow_mw": round(_r.uniform(-1000, 1000), 0),
                "reserve_margin_pct": round(_r.uniform(-5, 25), 1),
            })

    return {
        "timestamp": _dt.utcnow().isoformat(),
        "spike_events": spike_events,
        "contributors": contributors,
        "consumer_impacts": consumer_impacts,
        "regional_timelines": regional_timelines,
        "total_spike_events_2024": sum(1 for e in spike_events if "2024" in e["event_date"]),
        "total_consumer_cost_m_aud": round(sum(e["consumer_cost_m_aud"] for e in spike_events), 1),
        "avg_spike_duration_min": round(
            sum(e["duration_minutes"] for e in spike_events) / len(spike_events), 0
        ),
        "most_affected_region": "SA1",
    }


# ---------------------------------------------------------------------------
# 2) /api/spot-price-forecast/dashboard  ->  SPFDashboard
# ---------------------------------------------------------------------------

@app.get("/api/spot-price-forecast/dashboard")
def spot_price_forecast_dashboard():
    _r.seed(202)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    model_types = ["XGBOOST", "LSTM", "PROPHET", "ENSEMBLE", "LINEAR"]
    statuses = ["PRODUCTION", "SHADOW", "DEPRECATED"]
    regimes = ["NORMAL", "SPIKE", "NEGATIVE", "EXTREME"]
    categories = ["DEMAND", "SUPPLY", "WEATHER", "MARKET", "TIME"]
    horizons = [5, 30, 60, 288]

    models = []
    model_defs = [
        ("M001", "XGBoost-NSW-5min", "XGBOOST", "NSW1", 5, "PRODUCTION"),
        ("M002", "LSTM-VIC-30min", "LSTM", "VIC1", 30, "DEPRECATED"),
        ("M003", "Ensemble-NEM-1hr", "ENSEMBLE", "QLD1", 60, "PRODUCTION"),
        ("M004", "Prophet-SA-DayAhead", "PROPHET", "SA1", 288, "SHADOW"),
        ("M005", "XGBoost-QLD-30min", "XGBOOST", "QLD1", 30, "PRODUCTION"),
        ("M006", "LSTM-SA-Spike", "LSTM", "SA1", 5, "SHADOW"),
    ]
    for mid, mname, mtype, region, horizon, status in model_defs:
        models.append({
            "model_id": mid,
            "model_name": mname,
            "model_type": mtype,
            "region": region,
            "horizon_min": horizon,
            "mae_per_mwh": round(_r.uniform(3.5, 18.0), 1),
            "rmse_per_mwh": round(_r.uniform(8.0, 35.0), 1),
            "mape_pct": round(_r.uniform(4.0, 22.0), 1),
            "r2_score": round(_r.uniform(0.72, 0.96), 2),
            "spike_detection_recall_pct": _r.randint(45, 92),
            "negative_price_recall_pct": _r.randint(38, 85),
            "training_period": "2020-01 to 2024-06",
            "deployment_status": status,
        })

    dates = [
        (_dt(2024, 7, 1) + _td(days=d)).strftime("%Y-%m-%d")
        for d in range(0, 14)
    ]
    intervals = [f"{h:02d}:{m:02d}" for h in range(0, 24) for m in [0, 30]]

    forecasts = []
    for date in dates[:3]:
        for region in regions[:3]:
            for interval in intervals[:6]:
                actual = round(_r.uniform(-20, 350), 2)
                fc = actual + _r.uniform(-15, 15)
                forecasts.append({
                    "date": date,
                    "region": region,
                    "trading_interval": interval,
                    "actual_price": round(actual, 2),
                    "forecast_price": round(fc, 2),
                    "forecast_low": round(fc - _r.uniform(5, 25), 2),
                    "forecast_high": round(fc + _r.uniform(5, 25), 2),
                    "error_per_mwh": round(abs(actual - fc), 2),
                    "model_used": _r.choice(["M001", "M003", "M005"]),
                    "price_regime": _r.choice(regimes),
                })

    features = []
    feature_names = [
        "demand_forecast_mw", "temperature_forecast_c", "solar_generation_mw",
        "wind_generation_mw", "gas_price_gj", "interconnector_flow_mw",
        "time_of_day", "day_of_week", "coal_gen_mw", "battery_soc_pct",
        "lagged_price_5min", "demand_ramp_rate",
    ]
    for mtype in model_types[:4]:
        for rank_i, fname in enumerate(feature_names[:10], 1):
            cat = _r.choice(categories)
            features.append({
                "feature_name": fname,
                "model_type": mtype,
                "region": _r.choice(regions),
                "importance_score": round(_r.uniform(0.01, 0.22), 4),
                "rank": rank_i,
                "category": cat,
            })

    drift = []
    for mid in ["M001", "M003", "M004"]:
        baseline_mae = round(_r.uniform(5.0, 10.0), 2)
        for d_off in range(14):
            date_str = (_dt(2024, 6, 1) + _td(days=d_off)).strftime("%Y-%m-%d")
            rolling = round(baseline_mae + _r.uniform(-3, 6), 2)
            drift_score = round(max(0, min(1, (rolling - baseline_mae) / baseline_mae)), 3)
            drift.append({
                "model_id": mid,
                "date": date_str,
                "mae_rolling_7d": rolling,
                "mae_baseline": baseline_mae,
                "drift_score": drift_score,
                "drift_alert": drift_score > 0.7,
                "regime_shift": _r.choice(["NONE", "SPIKE_ENTRY", "NEGATIVE_ENTRY", "NONE"]),
            })

    prod_models = [m for m in models if m["deployment_status"] == "PRODUCTION"]
    best_mae = min(models, key=lambda m: m["mae_per_mwh"])
    best_spike = max(models, key=lambda m: m["spike_detection_recall_pct"])

    return {
        "models": models,
        "forecasts": forecasts,
        "features": features,
        "drift": drift,
        "summary": {
            "production_models": len(prod_models),
            "best_mae_model": best_mae["model_name"],
            "best_spike_recall_pct": best_spike["spike_detection_recall_pct"],
            "avg_mape_pct": round(
                sum(m["mape_pct"] for m in prod_models) / max(len(prod_models), 1), 1
            ),
            "total_forecasts": len(forecasts),
        },
    }


# ---------------------------------------------------------------------------
# 3) /api/spot-market-stress/dashboard  ->  SSTDashboard
# ---------------------------------------------------------------------------

@app.get("/api/spot-market-stress/dashboard")
def spot_market_stress_dashboard():
    _r.seed(303)
    regions = ["NSW1", "VIC1", "QLD1", "SA1", "TAS1"]
    sev_list = ["EXTREME", "SEVERE", "MODERATE", "MILD"]
    cat_list = ["WEATHER", "SUPPLY", "DEMAND", "FUEL", "NETWORK", "POLICY"]
    status_list = ["ADEQUATE", "MARGINAL", "STRESSED"]
    trend_list = ["IMPROVING", "STABLE", "DETERIORATING"]
    metrics_list = [
        "PRICE_SPIKE_RECOVERY_HRS", "SUPPLY_ADEQUACY_MARGIN_PCT",
        "INTERCONNECTOR_REDUNDANCY_PCT", "FCAS_HEADROOM_MW",
        "RAMP_CAPABILITY_MW_MIN",
    ]
    tail_metrics = ["VAR_95", "VAR_99", "CVAR_95", "CVAR_99", "MAX_DRAWDOWN", "STRESS_VaR"]
    sensitivity_factors = [
        "GAS_PRICE_SHOCK", "COAL_PLANT_CLOSURE", "RENEWABLE_INTERMITTENCY",
        "DEMAND_HEATWAVE", "INTERCONNECTOR_FAILURE", "POLICY_CHANGE",
    ]

    scenario_names = [
        "EXTREME_HEATWAVE", "COAL_FLEET_FAILURE", "GAS_SUPPLY_DISRUPTION",
        "RENEWABLE_DROUGHT", "INTERCONNECTOR_LOSS", "DEMAND_SURGE_CYCLONE",
        "BUSHFIRE_GRID_DAMAGE", "COORDINATED_CYBER_ATTACK",
    ]
    scenarios = []
    for i, sname in enumerate(scenario_names):
        scenarios.append({
            "scenario_id": f"SST-{i + 1:03d}",
            "scenario_name": sname,
            "category": _r.choice(cat_list),
            "description": f"Stress scenario modelling {sname.replace('_', ' ').lower()} conditions across NEM regions with cascading impacts.",
            "probability_annual_pct": round(_r.uniform(0.5, 15.0), 1),
            "severity": _r.choice(sev_list),
            "affected_regions": _r.sample(regions, k=_r.randint(2, 5)),
            "duration_days": _r.randint(1, 21),
            "peak_price_impact": _r.choice([5000, 10000, 15100, 16600]),
            "avg_price_impact_pct": round(_r.uniform(50, 800), 0),
            "energy_cost_impact_m": round(_r.uniform(50, 2500), 0),
        })

    tail_risks = []
    for region in regions:
        for metric in tail_metrics:
            val = round(_r.uniform(150, 2500), 1)
            tail_risks.append({
                "region": region,
                "metric": metric,
                "lookback_years": 10,
                "value": val,
                "percentile_pct": round(_r.uniform(90, 99.9), 1),
                "return_period_years": round(_r.uniform(2, 50), 0),
                "historical_worst": round(val * _r.uniform(1.1, 1.8), 1),
                "stress_test_worst": round(val * _r.uniform(1.5, 3.0), 1),
            })

    resilience = []
    for region in regions:
        for metric in metrics_list:
            curr = round(_r.uniform(1, 100), 1)
            resilience.append({
                "region": region,
                "metric": metric,
                "current_value": curr,
                "adequate_threshold": round(curr * 1.2, 1),
                "stress_threshold": round(curr * 0.5, 1),
                "status": _r.choice(status_list),
                "trend": _r.choice(trend_list),
            })

    historical_events = [
        {
            "event_name": "SA System Black 2016",
            "date": "2016-09-28",
            "region": "SA1",
            "category": "WEATHER",
            "peak_price": 14000,
            "avg_price_during": 5200,
            "duration_hrs": 18,
            "total_cost_m": 367,
            "load_shed_mwh": 52400,
            "market_intervention": True,
            "lesson_learned": "Exposed SA reliance on single interconnector (Heywood). Led to Hornsdale battery investment and system strength requirements.",
        },
        {
            "event_name": "QLD-NSW Heatwave Jan 2019",
            "date": "2019-01-24",
            "region": "QLD1",
            "category": "DEMAND",
            "peak_price": 14500,
            "avg_price_during": 3800,
            "duration_hrs": 8,
            "total_cost_m": 180,
            "load_shed_mwh": 12000,
            "market_intervention": False,
            "lesson_learned": "Record demand combined with low wind output. Battery response improved after Hornsdale upgrade.",
        },
        {
            "event_name": "Energy Crisis Jun 2022",
            "date": "2022-06-15",
            "region": "NSW1",
            "category": "FUEL",
            "peak_price": 15100,
            "avg_price_during": 6800,
            "duration_hrs": 168,
            "total_cost_m": 2100,
            "load_shed_mwh": 0,
            "market_intervention": True,
            "lesson_learned": "Coal plant outages combined with gas shortages led to AEMO market suspension. Resulted in Capacity Investment Scheme.",
        },
        {
            "event_name": "VIC Storm Damage Dec 2023",
            "date": "2023-12-08",
            "region": "VIC1",
            "category": "WEATHER",
            "peak_price": 8500,
            "avg_price_during": 2200,
            "duration_hrs": 12,
            "total_cost_m": 95,
            "load_shed_mwh": 8200,
            "market_intervention": False,
            "lesson_learned": "Transmission line damage from severe storms caused localized load shedding. Highlighted need for undergrounding in fire-prone areas.",
        },
        {
            "event_name": "TAS Low Hydro 2024",
            "date": "2024-03-15",
            "region": "TAS1",
            "category": "SUPPLY",
            "peak_price": 4200,
            "avg_price_during": 1100,
            "duration_hrs": 48,
            "total_cost_m": 45,
            "load_shed_mwh": 0,
            "market_intervention": False,
            "lesson_learned": "Basslink import constraints during low hydro storage period. Demonstrates ongoing TAS dependency on interconnector availability.",
        },
    ]

    sensitivity = []
    for factor in sensitivity_factors:
        for region in regions:
            sensitivity.append({
                "factor": factor,
                "region": region,
                "magnitude": _r.choice(["LOW", "MEDIUM", "HIGH"]),
                "price_response": round(_r.uniform(10, 800), 1),
                "probability_annual_pct": round(_r.uniform(1, 30), 1),
                "risk_contribution_pct": round(_r.uniform(0.5, 25), 2),
            })

    nsw1_var99 = [t for t in tail_risks if t["region"] == "NSW1" and t["metric"] == "VAR_99"]
    avg_var_99_nsw1 = round(nsw1_var99[0]["value"], 1) if nsw1_var99 else 450.0
    adequate_count = sum(1 for r in resilience if r["status"] == "ADEQUATE")
    stressed_count = sum(1 for r in resilience if r["status"] == "STRESSED")

    return {
        "scenarios": scenarios,
        "tail_risks": tail_risks,
        "resilience": resilience,
        "historical_events": historical_events,
        "sensitivity": sensitivity,
        "summary": {
            "scenarios_count": len(scenarios),
            "highest_risk_scenario": "EXTREME_HEATWAVE",
            "avg_var_99_nsw1": avg_var_99_nsw1,
            "stressed_regions_count": stressed_count,
            "resilience_adequate_pct": round(adequate_count / max(len(resilience), 1) * 100, 1),
            "historical_events_analyzed": len(historical_events),
            "total_historical_cost_m": sum(e["total_cost_m"] for e in historical_events),
        },
    }


# ---------------------------------------------------------------------------
# 4) /api/spot-price-volatility-regime/dashboard  ->  SVRDashboard
# ---------------------------------------------------------------------------

@app.get("/api/spot-price-volatility-regime/dashboard")
def spot_price_volatility_regime_dashboard():
    _r.seed(404)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    regime_types = ["LOW_VOL", "NORMAL", "HIGH_VOL", "EXTREME"]
    drivers_list = [
        "WIND_OUTPUT", "SOLAR_OUTPUT", "DEMAND_LEVEL", "GAS_PRICE",
        "COAL_AVAILABILITY", "INTERCONNECTOR_FLOW", "BATTERY_DISPATCH",
        "TEMPERATURE", "ROOFTOP_SOLAR",
    ]
    causes = ["LOW_WIND", "HIGH_DEMAND", "CONSTRAINT", "OUTAGE", "STRATEGIC_BIDDING"]
    sig_levels = ["HIGH", "MEDIUM", "LOW"]

    regimes = []
    for region in regions:
        start = _dt(2023, 1, 1)
        for _ in range(_r.randint(4, 7)):
            regime = _r.choice(regime_types)
            dur = _r.randint(15, 120)
            end = start + _td(days=dur)
            mean_p = {"LOW_VOL": 45, "NORMAL": 85, "HIGH_VOL": 220, "EXTREME": 650}[regime]
            regimes.append({
                "region": region,
                "regime": regime,
                "start_date": start.strftime("%Y-%m-%d"),
                "end_date": end.strftime("%Y-%m-%d"),
                "duration_days": dur,
                "mean_price": round(mean_p + _r.uniform(-20, 20), 1),
                "std_price": round(mean_p * _r.uniform(0.2, 0.8), 1),
                "max_price": round(mean_p * _r.uniform(2, 25), 0),
                "min_price": round(_r.uniform(-100, mean_p * 0.3), 0),
                "spike_count": _r.randint(0, 80),
                "negative_count": _r.randint(0, 60),
            })
            start = end

    quarters = [f"{y}-Q{q}" for y in [2023, 2024] for q in [1, 2, 3, 4]]
    volatility_metrics = []
    for region in regions:
        for quarter in quarters:
            volatility_metrics.append({
                "region": region,
                "quarter": quarter,
                "realized_volatility_annualized": round(_r.uniform(0.3, 2.5), 3),
                "garch_volatility": round(_r.uniform(0.25, 2.0), 3),
                "conditional_var_95": round(_r.uniform(100, 600), 1),
                "conditional_var_99": round(_r.uniform(200, 1200), 1),
                "price_range_pct": round(_r.uniform(50, 500), 1),
                "iqr_price": round(_r.uniform(20, 120), 1),
            })

    transition_matrix = []
    for from_r in regime_types:
        probs = [_r.random() for _ in regime_types]
        total = sum(probs)
        probs = [p / total for p in probs]
        for to_r, prob in zip(regime_types, probs):
            transition_matrix.append({
                "from_regime": from_r,
                "to_regime": to_r,
                "transition_probability": round(prob, 3),
                "avg_duration_days": round(_r.uniform(10, 90), 1),
            })

    spike_clusters = []
    for cid in range(1, 13):
        region = _r.choice(regions)
        spike_clusters.append({
            "cluster_id": cid,
            "region": region,
            "start_datetime": (_dt(2023, 6, 1) + _td(days=_r.randint(0, 500))).isoformat(),
            "end_datetime": (_dt(2023, 6, 1) + _td(days=_r.randint(501, 600))).isoformat(),
            "duration_intervals": _r.randint(3, 48),
            "peak_price": _r.choice([2500, 5000, 8000, 12000, 15100]),
            "total_cost_m": round(_r.uniform(0.5, 45.0), 1),
            "primary_cause": _r.choice(causes),
        })

    regime_drivers = []
    for regime in regime_types:
        for driver in _r.sample(drivers_list, k=_r.randint(3, 6)):
            regime_drivers.append({
                "regime": regime,
                "driver": driver,
                "correlation": round(_r.uniform(-0.85, 0.92), 2),
                "significance": _r.choice(sig_levels),
            })

    extreme_time = sum(r["duration_days"] for r in regimes if r["regime"] == "EXTREME")
    total_time = sum(r["duration_days"] for r in regimes)
    most_vol_region = max(regions, key=lambda rg: sum(
        vm["realized_volatility_annualized"]
        for vm in volatility_metrics
        if vm["region"] == rg and vm["quarter"] == "2024-Q4"
    ))

    return {
        "regimes": regimes,
        "transition_matrix": transition_matrix,
        "volatility_metrics": volatility_metrics,
        "spike_clusters": spike_clusters,
        "regime_drivers": regime_drivers,
        "summary": {
            "total_regimes_identified": len(regimes),
            "extreme_regime_pct": round(extreme_time / max(total_time, 1) * 100, 1),
            "avg_spike_duration_hrs": round(
                sum(c["duration_intervals"] * 0.0833 for c in spike_clusters) / max(len(spike_clusters), 1), 1
            ),
            "most_volatile_region": most_vol_region,
            "regime_persistence_avg_days": round(
                total_time / max(len(regimes), 1), 0
            ),
        },
    }


# ---------------------------------------------------------------------------
# 5) /api/spot-price-spike-prediction/dashboard  ->  SPPDashboard
# ---------------------------------------------------------------------------

@app.get("/api/spot-price-spike-prediction/dashboard")
def spot_price_spike_prediction_dashboard():
    _r.seed(505)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    statuses = ["ACTIVE", "RESOLVED_SPIKE", "RESOLVED_NO_SPIKE", "EXPIRED"]
    feature_categories = ["MARKET", "WEATHER", "GRID", "TEMPORAL", "FUEL"]
    cause_list = [
        "Generator Trip", "Demand Surge", "Low Wind", "Heatwave",
        "Network Constraint", "Gas Shortage", "Strategic Bidding",
    ]
    trigger_factors_pool = [
        "High demand forecast", "Low wind forecast", "Generator outage notice",
        "Heatwave warning", "Gas price spike", "Interconnector limit",
        "Evening ramp", "Low reserve margin",
    ]
    model_names = ["Ensemble-Spike", "XGBoost-Spike", "LSTM-Spike"]

    predictions = []
    for _ in range(30):
        prob = round(_r.random(), 3)
        actual = round(_r.uniform(-50, 500), 2) if _r.random() > 0.15 else None
        threshold = 300
        predictions.append({
            "prediction_id": f"PRED-{_r.randint(10000, 99999)}",
            "region": _r.choice(regions),
            "dispatch_interval": (
                _dt(2024, 7, 1) + _td(minutes=_r.randint(0, 43200))
            ).isoformat(),
            "predicted_spike_probability": prob,
            "predicted_price_aud_mwh": round(_r.uniform(50, 800), 2),
            "actual_price_aud_mwh": actual,
            "threshold_aud_mwh": threshold,
            "correct_prediction": (
                (prob >= 0.5 and actual >= threshold) or (prob < 0.5 and actual < threshold)
            ) if actual is not None else None,
            "confidence_interval_low": round(_r.uniform(10, 150), 2),
            "confidence_interval_high": round(_r.uniform(300, 1200), 2),
        })

    model_performance = []
    for model_name in model_names:
        for region in regions:
            for period in ["2024-H1", "2024-H2"]:
                prec = round(_r.uniform(0.65, 0.92), 3)
                rec = round(_r.uniform(0.60, 0.90), 3)
                model_performance.append({
                    "model_name": model_name,
                    "region": region,
                    "period": period,
                    "precision": prec,
                    "recall": rec,
                    "f1_score": round(2 * prec * rec / max(prec + rec, 0.001), 3),
                    "auc_roc": round(_r.uniform(0.85, 0.97), 3),
                    "false_positive_rate": round(_r.uniform(0.03, 0.15), 3),
                    "spike_threshold_aud_mwh": 300,
                    "total_spikes": _r.randint(20, 120),
                    "predicted_spikes": _r.randint(15, 110),
                })

    feature_names = [
        "demand_forecast_mw", "temperature_max_c", "wind_generation_forecast_mw",
        "solar_generation_mw", "gas_price_aud_gj", "interconnector_available_mw",
        "hour_of_day", "day_of_week", "lagged_price_30min", "reserve_margin_mw",
        "coal_gen_available_mw", "battery_soc_pct", "rooftop_solar_mw",
    ]
    features = []
    for fname in feature_names:
        features.append({
            "feature": fname,
            "importance": round(_r.uniform(0.01, 0.15), 4),
            "category": _r.choice(feature_categories),
            "spike_correlation": round(_r.uniform(-0.6, 0.85), 3),
            "lag_minutes": _r.choice([0, 5, 30, 60, 120]),
        })

    alerts = []
    for i in range(8):
        alerts.append({
            "alert_id": f"ALERT-{_r.randint(1000, 9999)}",
            "region": _r.choice(regions),
            "issued_at": (
                _dt(2024, 7, 15) + _td(hours=_r.randint(0, 168))
            ).isoformat(),
            "forecast_window_minutes": _r.choice([30, 60, 120, 240]),
            "spike_probability": round(_r.uniform(0.45, 0.98), 2),
            "expected_price_aud_mwh": _r.choice([450, 800, 1500, 5000, 12000]),
            "trigger_factors": _r.sample(trigger_factors_pool, k=_r.randint(2, 4)),
            "status": _r.choice(statuses),
        })

    spike_history = []
    for _ in range(20):
        predicted = _r.random() > 0.3
        spike_history.append({
            "region": _r.choice(regions),
            "date": (
                _dt(2024, 1, 1) + _td(days=_r.randint(0, 200))
            ).strftime("%Y-%m-%d"),
            "hour": _r.randint(6, 22),
            "max_price_aud_mwh": _r.choice([500, 1200, 5000, 8000, 15100]),
            "duration_intervals": _r.randint(2, 24),
            "cause": _r.choice(cause_list),
            "predicted": predicted,
            "warning_lead_time_minutes": _r.randint(10, 120) if predicted else None,
        })

    active_alerts = sum(1 for a in alerts if a["status"] == "ACTIVE")
    best_auc = max(model_performance, key=lambda m: m["auc_roc"])
    ensemble_perfs = [m for m in model_performance if m["model_name"] == "Ensemble-Spike"]
    avg_recall = round(sum(m["recall"] for m in ensemble_perfs) / max(len(ensemble_perfs), 1), 3)

    return {
        "predictions": predictions,
        "model_performance": model_performance,
        "features": features,
        "alerts": alerts,
        "spike_history": spike_history,
        "summary": {
            "active_alerts": active_alerts,
            "best_auc_roc": best_auc["auc_roc"],
            "best_model": best_auc["model_name"],
            "spike_detection_rate_pct": round(avg_recall * 100, 1),
            "false_positive_rate_pct": round(
                sum(m["false_positive_rate"] for m in ensemble_perfs) / max(len(ensemble_perfs), 1) * 100, 1
            ),
            "avg_warning_lead_time_minutes": round(
                sum(s["warning_lead_time_minutes"] for s in spike_history if s["warning_lead_time_minutes"])
                / max(sum(1 for s in spike_history if s["warning_lead_time_minutes"]), 1), 0
            ),
            "total_spikes_ytd": len(spike_history),
        },
    }


# ---------------------------------------------------------------------------
# 6) /api/spot-market-depth-x/dashboard  ->  ESMDXDashboard
# ---------------------------------------------------------------------------

@app.get("/api/spot-market-depth-x/dashboard")
def spot_market_depth_x_dashboard():
    _r.seed(606)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    anomaly_types = [
        "Price Spike", "Price Collapse", "Volume Surge",
        "Bid Withdrawal", "Coordinated Bidding", "Abnormal Spread",
    ]
    suspected_causes = [
        "Generator rebid", "Demand forecast error", "Interconnector outage",
        "Solar cliff", "Wind drought", "Strategic withdrawal",
    ]
    participant_names = [
        "AGL Energy", "Origin Energy", "EnergyAustralia", "Snowy Hydro",
        "CS Energy", "Stanwell", "Alinta Energy", "Engie", "Shell Energy",
    ]

    dates = [
        (_dt(2024, 1, 15) + _td(days=d * 7)).strftime("%Y-%m-%d")
        for d in range(4)
    ]

    order_books = []
    for region in regions[:3]:
        for date in dates:
            for hour in range(0, 24, 12):
                mid = round(_r.uniform(40, 250), 2)
                order_books.append({
                    "book_id": f"OB-{region}-{date}-{hour:02d}",
                    "region": region,
                    "snapshot_date": date,
                    "hour": hour,
                    "bid_volume_mw_10pct": round(_r.uniform(200, 2000), 0),
                    "bid_volume_mw_total": round(_r.uniform(3000, 12000), 0),
                    "offer_volume_mw_10pct": round(_r.uniform(200, 2500), 0),
                    "offer_volume_mw_total": round(_r.uniform(3000, 14000), 0),
                    "bid_ask_spread_dolpermwh": round(_r.uniform(1.5, 45.0), 2),
                    "market_depth_mw_within_5pct": round(_r.uniform(500, 5000), 0),
                    "mid_price_dolpermwh": mid,
                    "bid_price_95pct": round(mid - _r.uniform(5, 50), 2),
                    "offer_price_5pct": round(mid + _r.uniform(5, 50), 2),
                    "volume_weighted_mid_price": round(mid + _r.uniform(-5, 5), 2),
                    "liquidity_score": round(_r.uniform(30, 95), 1),
                })

    price_discovery = []
    for region in regions[:3]:
        for date in dates:
            for hour in [8, 16]:
                pre_dispatch = round(_r.uniform(40, 200), 2)
                dispatch = round(pre_dispatch + _r.uniform(-30, 40), 2)
                price_discovery.append({
                    "discovery_id": f"PD-{region}-{date}-{hour:02d}",
                    "region": region,
                    "date": date,
                    "hour": hour,
                    "pre_dispatch_price": pre_dispatch,
                    "dispatch_price": dispatch,
                    "price_revision_pct": round((dispatch - pre_dispatch) / max(pre_dispatch, 1) * 100, 2),
                    "discovery_efficiency_pct": round(_r.uniform(60, 98), 1),
                    "informed_trading_pct": round(_r.uniform(20, 70), 1),
                    "noise_trading_pct": round(_r.uniform(10, 40), 1),
                    "price_impact_per_mw": round(_r.uniform(0.01, 0.5), 3),
                    "market_depth_mw": round(_r.uniform(1000, 6000), 0),
                    "contribution_of_rebids_pct": round(_r.uniform(5, 45), 1),
                    "information_asymmetry_index": round(_r.uniform(0.1, 0.8), 2),
                })

    trading_activity = []
    for region in regions[:3]:
        for date in dates:
            for hour in range(0, 24, 12):
                avg_p = round(_r.uniform(30, 200), 2)
                trading_activity.append({
                    "activity_id": f"TA-{region}-{date}-{hour:02d}",
                    "region": region,
                    "date": date,
                    "hour": hour,
                    "total_traded_volume_mwh": round(_r.uniform(500, 8000), 0),
                    "num_dispatch_intervals": _r.randint(6, 12),
                    "avg_interval_price": avg_p,
                    "max_interval_price": round(avg_p * _r.uniform(1.1, 5.0), 2),
                    "min_interval_price": round(avg_p * _r.uniform(0.1, 0.8), 2),
                    "price_std_dev": round(_r.uniform(5, 120), 2),
                    "high_price_intervals": _r.randint(0, 4),
                    "zero_price_intervals": _r.randint(0, 2),
                    "negative_price_intervals": _r.randint(0, 3),
                    "largest_single_bid_mw": round(_r.uniform(100, 1500), 0),
                    "market_concentration_index": round(_r.uniform(800, 3500), 0),
                })

    market_impacts = []
    for i, pname in enumerate(participant_names):
        region = regions[i % len(regions)]
        market_impacts.append({
            "impact_id": f"MI-{i + 1:03d}",
            "participant_name": pname,
            "region": region,
            "period": "2024-H1",
            "avg_bid_volume_mw": round(_r.uniform(200, 3000), 0),
            "market_share_dispatched_pct": round(_r.uniform(5, 28), 1),
            "price_impact_dolpermwh_per_100mw": round(_r.uniform(0.5, 8.0), 2),
            "strategic_trading_indicator": round(_r.uniform(1.0, 9.0), 1),
            "rebid_frequency_per_interval": round(_r.uniform(0.05, 2.5), 2),
            "price_setter_hours_pct": round(_r.uniform(5, 45), 1),
            "market_impact_cost_m_pa": round(_r.uniform(2, 120), 1),
            "regulatoryaction_flag": _r.random() > 0.7,
        })

    seasonal_patterns = []
    for region in regions[:3]:
        for month in range(1, 13, 3):
            for hour in range(0, 24, 8):
                seasonal_patterns.append({
                    "pattern_id": f"SP-{region}-{month:02d}-{hour:02d}",
                    "region": region,
                    "month": month,
                    "hour_of_day": hour,
                    "avg_price_dolpermwh": round(_r.uniform(20, 300), 2),
                    "avg_volume_mwh": round(_r.uniform(500, 6000), 0),
                    "price_volatility_pct": round(_r.uniform(5, 80), 1),
                    "liquidity_score": round(_r.uniform(30, 95), 1),
                    "high_price_probability_pct": round(_r.uniform(0, 25), 1),
                    "negative_price_probability_pct": round(_r.uniform(0, 15), 1),
                    "renewable_share_pct": round(_r.uniform(10, 75), 1),
                    "peak_demand_flag": hour in [16, 17, 18, 19],
                })

    anomalies = []
    for i in range(10):
        detected = round(_r.uniform(50, 15000), 0)
        expected = round(_r.uniform(40, 200), 0)
        anomalies.append({
            "anomaly_id": f"ANOM-{i + 1:03d}",
            "region": _r.choice(regions),
            "detected_date": (_dt(2024, 1, 1) + _td(days=_r.randint(0, 200))).strftime("%Y-%m-%d"),
            "hour": _r.randint(0, 23),
            "anomaly_type": _r.choice(anomaly_types),
            "detected_price_dolpermwh": detected,
            "expected_price_dolpermwh": expected,
            "deviation_pct": round((detected - expected) / max(expected, 1) * 100, 1),
            "volume_deviation_pct": round(_r.uniform(-50, 200), 1),
            "suspected_cause": _r.choice(suspected_causes),
            "market_impact_m": round(_r.uniform(0.1, 25.0), 1),
            "referred_to_aer": _r.random() > 0.6,
        })

    all_spreads = [ob["bid_ask_spread_dolpermwh"] for ob in order_books]
    all_liq = [ob["liquidity_score"] for ob in order_books]
    all_eff = [pd["discovery_efficiency_pct"] for pd in price_discovery]

    return {
        "order_books": order_books,
        "price_discovery": price_discovery,
        "trading_activity": trading_activity,
        "market_impacts": market_impacts,
        "seasonal_patterns": seasonal_patterns,
        "anomalies": anomalies,
        "summary": {
            "avg_bid_ask_spread_dolpermwh": round(sum(all_spreads) / max(len(all_spreads), 1), 2),
            "avg_liquidity_score": round(sum(all_liq) / max(len(all_liq), 1), 1),
            "anomalies_detected_ytd": len(anomalies),
            "avg_price_discovery_efficiency_pct": round(sum(all_eff) / max(len(all_eff), 1), 1),
        },
    }


# ---------------------------------------------------------------------------
# 7) /api/negative-price-events/dashboard  ->  NPEDashboard
# ---------------------------------------------------------------------------

@app.get("/api/negative-price-events/dashboard")
def negative_price_events_dashboard():
    _r.seed(707)
    regions = ["SA1", "VIC1", "NSW1", "QLD1", "TAS1"]
    years = list(range(2018, 2025))

    frequency = []
    for year in years:
        for region in regions:
            base_intervals = {"SA1": 3500, "VIC1": 2200, "NSW1": 1500, "QLD1": 1800, "TAS1": 800}[region]
            growth = (year - 2018) * _r.randint(80, 250)
            neg_intervals = base_intervals + growth + _r.randint(-300, 300)
            neg_hours = round(neg_intervals * 5 / 60, 1)
            frequency.append({
                "year": year,
                "region": region,
                "negative_price_intervals": neg_intervals,
                "negative_price_hours": neg_hours,
                "pct_of_year": round(neg_hours / 8760 * 100, 2),
                "avg_negative_price": round(_r.uniform(-80, -5), 1),
                "deepest_price": round(_r.uniform(-1000, -200), 0),
                "consecutive_negative_hrs_max": round(_r.uniform(1, 18), 1),
                "total_negative_energy_mwh": round(neg_intervals * _r.uniform(50, 300), 0),
            })

    quarters = [f"{y}-Q{q}" for y in [2022, 2023, 2024] for q in [1, 2, 3, 4]]
    drivers = []
    for region in regions:
        for quarter in quarters:
            solar = round(_r.uniform(15, 55), 1)
            wind = round(_r.uniform(10, 35), 1)
            must_run = round(_r.uniform(10, 30), 1)
            hydro = round(_r.uniform(2, 15), 1)
            low_dem = round(_r.uniform(5, 20), 1)
            export = round(100 - solar - wind - must_run - hydro - low_dem, 1)
            drivers.append({
                "region": region,
                "quarter": quarter,
                "rooftop_solar_contribution_pct": solar,
                "wind_contribution_pct": wind,
                "must_run_baseload_pct": must_run,
                "pumped_hydro_pct": hydro,
                "low_demand_pct": low_dem,
                "combined_export_constraint_pct": max(0, export),
            })

    battery_opportunity = []
    for region in regions:
        for year in [2022, 2023, 2024]:
            neg_mwh = _r.randint(50000, 500000)
            battery_opportunity.append({
                "region": region,
                "year": year,
                "negative_price_mwh_available": neg_mwh,
                "optimal_charge_value_m": round(neg_mwh * _r.uniform(0.00005, 0.0002), 1),
                "battery_capacity_mw_needed": round(_r.uniform(50, 600), 0),
                "avg_charge_price": round(_r.uniform(-80, -5), 1),
                "arbitrage_spread_to_peak": round(_r.uniform(80, 350), 0),
            })

    plant_names = [
        "Liddell", "Eraring", "Bayswater", "Vales Point",
        "Yallourn", "Loy Yang A", "Tarong", "Gladstone",
    ]
    technologies = ["COAL", "COAL", "COAL", "COAL", "COAL", "COAL", "GAS", "COGENERATION"]
    must_run = []
    for i, pname in enumerate(plant_names):
        region = _r.choice(regions[:4])
        min_stable = round(_r.uniform(200, 800), 0)
        must_run.append({
            "plant_name": pname,
            "technology": technologies[i % len(technologies)],
            "region": region,
            "min_stable_load_mw": min_stable,
            "technical_min_mw": round(min_stable * _r.uniform(0.4, 0.7), 0),
            "startup_cost_k": round(_r.uniform(200, 2000), 0),
            "ramp_rate_mw_min": round(_r.uniform(2, 15), 1),
            "negative_price_hours_yr": round(_r.uniform(100, 1500), 0),
            "estimated_loss_m_yr": round(_r.uniform(1, 25), 1),
        })

    market_design = [
        {
            "mechanism": "FIVE_MINUTE_SETTLEMENT",
            "description": "Transition from 30-minute to 5-minute settlement to reduce manipulation of negative price windows.",
            "estimated_negative_price_reduction_pct": 12,
            "implementation_cost_m": 150,
            "aemo_recommendation": True,
            "status": "IMPLEMENTED",
        },
        {
            "mechanism": "BATTERY_STORAGE_INCENTIVES",
            "description": "Tax incentives and CIS funding for grid-scale batteries to absorb excess renewable generation.",
            "estimated_negative_price_reduction_pct": 25,
            "implementation_cost_m": 800,
            "aemo_recommendation": True,
            "status": "IMPLEMENTED",
        },
        {
            "mechanism": "INTERCONNECTOR_UPGRADE",
            "description": "Expand SA-NSW (EnergyConnect) and QLD-NSW interconnector capacity to export surplus generation.",
            "estimated_negative_price_reduction_pct": 18,
            "implementation_cost_m": 2400,
            "aemo_recommendation": True,
            "status": "UNDER_REVIEW",
        },
        {
            "mechanism": "DEMAND_FLEXIBILITY_PROGRAM",
            "description": "Industrial and residential demand response programs to shift load into negative price periods.",
            "estimated_negative_price_reduction_pct": 15,
            "implementation_cost_m": 120,
            "aemo_recommendation": True,
            "status": "PROPOSED",
        },
        {
            "mechanism": "NEGATIVE_PRICE_FLOOR_REFORM",
            "description": "Review of market price floor from -$1000/MWh to reduce perverse bidding incentives.",
            "estimated_negative_price_reduction_pct": 30,
            "implementation_cost_m": 10,
            "aemo_recommendation": False,
            "status": "UNDER_REVIEW",
        },
        {
            "mechanism": "PUMPED_HYDRO_OPTIMISATION",
            "description": "Optimise Snowy 2.0 and Borumba pumped hydro to charge during negative prices.",
            "estimated_negative_price_reduction_pct": 20,
            "implementation_cost_m": 600,
            "aemo_recommendation": True,
            "status": "IMPLEMENTED",
        },
    ]

    sa_2024 = [f for f in frequency if f["region"] == "SA1" and f["year"] == 2024]
    total_neg_2024 = sum(f["negative_price_intervals"] for f in frequency if f["year"] == 2024)
    batt_total = sum(b["optimal_charge_value_m"] for b in battery_opportunity if b["year"] == 2024)
    deepest = min(f["deepest_price"] for f in frequency)
    prev_year_total = sum(f["negative_price_intervals"] for f in frequency if f["year"] == 2023)

    return {
        "frequency": frequency,
        "drivers": drivers,
        "battery_opportunity": battery_opportunity,
        "must_run": must_run,
        "market_design": market_design,
        "summary": {
            "total_negative_intervals_2024": total_neg_2024,
            "pct_of_year_sa1": sa_2024[0]["pct_of_year"] if sa_2024 else 8.5,
            "avg_negative_price_2024": round(
                sum(f["avg_negative_price"] for f in frequency if f["year"] == 2024)
                / max(sum(1 for f in frequency if f["year"] == 2024), 1), 1
            ),
            "battery_arbitrage_value_m": round(batt_total, 0),
            "deepest_price": deepest,
            "yoy_increase_pct": round(
                (total_neg_2024 - prev_year_total) / max(prev_year_total, 1) * 100, 1
            ),
        },
    }


# ---------------------------------------------------------------------------
# 8) /api/electricity-spot-price-seasonality/dashboard  ->  ESPSDashboard
# ---------------------------------------------------------------------------

@app.get("/api/electricity-spot-price-seasonality/dashboard")
def electricity_spot_price_seasonality_dashboard():
    _r.seed(808)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    seasons = ["Summer", "Autumn", "Winter", "Spring"]
    day_types = [
        "Monday", "Tuesday", "Wednesday", "Thursday",
        "Friday", "Saturday", "Sunday", "Public Holiday",
    ]
    scenarios = ["Base", "High Renewable", "Low Renewable"]
    regime_types = [
        "High-Price", "Low-Price", "Volatile",
        "Renewable-Driven", "Gas-Driven", "Managed",
    ]

    hourly_patterns = []
    for region in regions[:3]:
        for season in seasons:
            for year in [2024]:
                for hour in range(0, 24, 4):
                    base = {"Summer": 95, "Autumn": 65, "Winter": 80, "Spring": 55}[season]
                    hour_adj = 40 * (1 if 16 <= hour <= 20 else (-0.3 if 10 <= hour <= 14 else 0))
                    avg_p = round(base + hour_adj + _r.uniform(-20, 20), 1)
                    hourly_patterns.append({
                        "region": region,
                        "hour_of_day": hour,
                        "season": season,
                        "year": year,
                        "avg_price_mwh": avg_p,
                        "median_price_mwh": round(avg_p * _r.uniform(0.85, 1.0), 1),
                        "p10_price_mwh": round(avg_p * _r.uniform(0.2, 0.5), 1),
                        "p90_price_mwh": round(avg_p * _r.uniform(1.5, 3.5), 1),
                        "spike_frequency_pct": round(_r.uniform(0, 12), 1),
                        "avg_demand_mw": round(_r.uniform(4000, 12000), 0),
                        "avg_solar_mw": round(max(0, _r.uniform(-500, 3000) if 6 <= hour <= 18 else 0), 0),
                        "avg_wind_mw": round(_r.uniform(200, 3000), 0),
                    })

    day_type_patterns = []
    for region in regions[:3]:
        for season in seasons:
            for year in [2024]:
                for dt in ["Weekday", "Weekend", "Public Holiday"]:
                    avg_p = round(_r.uniform(40, 150), 1)
                    day_type_patterns.append({
                        "region": region,
                        "day_type": dt,
                        "season": season,
                        "year": year,
                        "avg_price_mwh": avg_p,
                        "peak_hour": _r.randint(16, 20),
                        "trough_hour": _r.randint(2, 6),
                        "price_volatility_pct": round(_r.uniform(15, 80), 1),
                        "demand_factor": round(_r.uniform(0.7, 1.3), 2),
                        "evening_ramp_magnitude_mwh": round(_r.uniform(20, 150), 1),
                        "morning_ramp_magnitude_mwh": round(_r.uniform(10, 80), 1),
                    })

    monthly_trends = []
    for region in regions[:3]:
        for year in [2024]:
            for month in range(1, 10):
                ym = f"{year}-{month:02d}"
                avg_p = round(_r.uniform(30, 160), 1)
                monthly_trends.append({
                    "year_month": ym,
                    "region": region,
                    "avg_price_mwh": avg_p,
                    "min_price_mwh": round(_r.uniform(-100, 10), 1),
                    "max_price_mwh": round(avg_p * _r.uniform(3, 20), 1),
                    "negative_price_hrs": round(_r.uniform(0, 120), 0),
                    "voll_price_hrs": round(_r.uniform(0, 5), 0),
                    "cumulative_avg_ytd_mwh": round(avg_p * _r.uniform(0.9, 1.1), 1),
                    "renewable_pct": round(_r.uniform(25, 65), 1),
                    "coal_pct": round(_r.uniform(15, 55), 1),
                    "gas_pct": round(_r.uniform(5, 25), 1),
                    "temperature_anomaly_c": round(_r.uniform(-3, 5), 1),
                })

    price_regimes = []
    rid = 1
    for region in regions:
        start = _dt(2023, 1, 1)
        for _ in range(_r.randint(2, 4)):
            rtype = _r.choice(regime_types)
            dur = _r.randint(30, 180)
            end = start + _td(days=dur)
            avg_p = round(_r.uniform(30, 250), 1)
            price_regimes.append({
                "regime_id": f"R{rid:03d}",
                "region": region,
                "start_date": start.strftime("%Y-%m-%d"),
                "end_date": end.strftime("%Y-%m-%d"),
                "regime_type": rtype,
                "duration_days": dur,
                "avg_price_mwh": avg_p,
                "p95_price_mwh": round(avg_p * _r.uniform(3, 15), 1),
                "total_energy_cost_m": round(_r.uniform(50, 2000), 0),
                "primary_driver": _r.choice(["Solar surplus", "Gas price", "Demand heatwave", "Coal retirement", "Wind drought"]),
                "renewable_share_pct": round(_r.uniform(20, 70), 1),
            })
            rid += 1
            start = end

    decomposition = []
    for region in regions[:3]:
        for year in range(2022, 2025):
            trend = round(_r.uniform(40, 100), 2)
            seasonal = round(_r.uniform(-15, 25), 2)
            renewable_effect = round(_r.uniform(-30, -5), 2)
            residual = round(_r.uniform(-10, 10), 2)
            decomposition.append({
                "year": year,
                "region": region,
                "trend_component_mwh": trend,
                "seasonal_component_mwh": seasonal,
                "residual_component_mwh": residual,
                "renewable_penetration_effect_mwh": renewable_effect,
                "demand_effect_mwh": round(_r.uniform(-5, 15), 2),
                "fuel_cost_effect_mwh": round(_r.uniform(-10, 20), 2),
                "policy_effect_mwh": round(_r.uniform(-8, 5), 2),
                "long_run_avg_mwh": round(trend + seasonal + renewable_effect + residual, 2),
            })

    forecasts = []
    for region in regions[:3]:
        for year in range(2024, 2027):
            for scenario in scenarios:
                base_price = {"Base": 75, "High Renewable": 55, "Low Renewable": 95}[scenario]
                year_adj = (year - 2024) * _r.uniform(-5, 3)
                forecasts.append({
                    "year": year,
                    "region": region,
                    "scenario": scenario,
                    "forecast_avg_price_mwh": round(base_price + year_adj + _r.uniform(-10, 10), 1),
                    "forecast_peak_price_mwh": round((base_price + year_adj) * _r.uniform(3, 8), 1),
                    "forecast_negative_price_hrs": round(_r.uniform(100, 1500), 0),
                    "price_volatility_index": round(_r.uniform(0.3, 2.0), 2),
                    "renewable_pct_forecast": round(min(95, 35 + (year - 2024) * 5 + _r.uniform(-5, 5)), 1),
                    "structural_break_expected": year >= 2026 and scenario == "High Renewable",
                })

    summer_prices = [h["avg_price_mwh"] for h in hourly_patterns if h["season"] == "Summer" and h["year"] == 2024]
    winter_prices = [h["avg_price_mwh"] for h in hourly_patterns if h["season"] == "Winter" and h["year"] == 2024]

    return {
        "hourly_patterns": hourly_patterns,
        "day_type_patterns": day_type_patterns,
        "monthly_trends": monthly_trends,
        "price_regimes": price_regimes,
        "decomposition": decomposition,
        "forecasts": forecasts,
        "summary": {
            "avg_price_summer_mwh": round(sum(summer_prices) / max(len(summer_prices), 1), 1),
            "avg_price_winter_mwh": round(sum(winter_prices) / max(len(winter_prices), 1), 1),
            "peak_hour_of_day": 17,
            "trough_hour_of_day": 3,
            "negative_price_hrs_ytd": sum(m["negative_price_hrs"] for m in monthly_trends if m["year_month"].startswith("2024")),
            "most_volatile_region": "SA1",
        },
    }


# ---------------------------------------------------------------------------
# 9) /api/electricity-spot-price-events/dashboard  ->  ESPEDashboard
# ---------------------------------------------------------------------------

@app.get("/api/electricity-spot-price-events/dashboard")
def electricity_spot_price_events_dashboard():
    _r.seed(909)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    event_types = ["Spike", "Negative", "Cap Hit", "VoLL"]
    trigger_causes = [
        "Generator Trip", "Demand Spike", "Renewable Drop",
        "Gas Shortage", "Network Constraint", "Heatwave", "Cold Snap",
    ]
    driver_types = ["Supply", "Demand", "Weather", "Network", "Fuel", "Market Structure"]
    seasonal_patterns = ["Summer", "Winter", "Year-Round", "Random"]
    price_bands = ["Negative", "$0-$50", "$50-$300", "$300+"]
    measure_types = ["FCAS", "RERT", "DSP", "Battery", "Interconnector", "Manual"]

    events = []
    for i in range(25):
        events.append({
            "event_id": f"ESPE-{i + 1:04d}",
            "event_type": _r.choice(event_types),
            "region": _r.choice(regions),
            "year": _r.choice([2022, 2023, 2024]),
            "month": _r.randint(1, 12),
            "duration_intervals": _r.randint(1, 48),
            "max_price_mwh": round(_r.uniform(-1000, 16600), 2),
            "avg_price_mwh": round(_r.uniform(-200, 5000), 2),
            "total_energy_affected_mwh": round(_r.uniform(100, 50000), 0),
            "financial_impact_m_aud": round(_r.uniform(0.01, 15.0), 3),
            "trigger_cause": _r.choice(trigger_causes),
        })

    regional_stats = []
    for region in regions:
        for year in [2022, 2023, 2024]:
            for half in ["H1", "H2"]:
                regional_stats.append({
                    "region": region,
                    "year": year,
                    "half": half,
                    "spike_count": _r.randint(5, 80),
                    "negative_count": _r.randint(10, 200),
                    "cap_hit_count": _r.randint(0, 5),
                    "total_spike_revenue_m_aud": round(_r.uniform(1, 50), 1),
                    "p5_price_mwh": round(_r.uniform(-100, -10), 1),
                    "p95_price_mwh": round(_r.uniform(200, 2000), 1),
                    "volatility_index": round(_r.uniform(0.3, 3.5), 2),
                    "time_above_300_pct": round(_r.uniform(0.1, 5.0), 2),
                })

    driver_names = [
        "Coal Plant Outage", "High Demand Heatwave", "Wind Drought",
        "Solar Cliff Evening", "Gas Price Surge", "Interconnector Limit",
        "Strategic Rebidding", "Cold Snap Heating Load", "Bushfire Network Damage",
        "Renewable Curtailment", "Low Reserve Margin", "Battery Exhaustion",
        "Rooftop Solar Excess", "Transmission Congestion", "Cyclone Impact",
    ]
    espe_drivers = []
    for i, dname in enumerate(driver_names):
        espe_drivers.append({
            "driver_id": f"DRV-{i + 1:03d}",
            "driver_name": dname,
            "driver_type": _r.choice(driver_types),
            "contribution_pct": round(_r.uniform(2, 18), 1),
            "year": _r.choice([2022, 2023, 2024]),
            "region": _r.choice(regions),
            "events_caused": _r.randint(3, 50),
            "avg_price_impact_mwh": round(_r.uniform(50, 3000), 1),
            "seasonal_pattern": _r.choice(seasonal_patterns),
        })

    price_distribution = []
    for region in regions:
        for year in [2023, 2024]:
            for band in price_bands:
                base_hrs = {"Negative": 150, "$0-$50": 4000, "$50-$300": 3500, "$300+": 200}[band]
                hrs = base_hrs + _r.randint(-100, 200)
                price_distribution.append({
                    "region": region,
                    "year": year,
                    "price_band": band,
                    "hours_count": hrs,
                    "percentage_of_year": round(hrs / 8760 * 100, 2),
                    "avg_price_mwh": round(
                        {"Negative": -45, "$0-$50": 28, "$50-$300": 120, "$300+": 2500}[band]
                        + _r.uniform(-10, 10), 1
                    ),
                    "volume_mwh": round(hrs * _r.uniform(3000, 8000), 0),
                })

    measure_names = [
        "FCAS Raise Dispatch", "RERT Activation", "Demand Side Programme",
        "Battery Emergency Discharge", "Interconnector Emergency",
        "AEMO Manual Direction", "FCAS Lower Service", "DR Industrial",
    ]
    mitigation = []
    for i, mname in enumerate(measure_names):
        mitigation.append({
            "measure_id": f"MIT-{i + 1:03d}",
            "measure_name": mname,
            "measure_type": _r.choice(measure_types),
            "region": _r.choice(regions),
            "year": _r.choice([2023, 2024]),
            "activations": _r.randint(5, 200),
            "mw_dispatched": round(_r.uniform(50, 2000), 0),
            "cost_m_aud": round(_r.uniform(0.5, 30), 1),
            "effectiveness_pct": round(_r.uniform(25, 95), 1),
        })

    total_spike_rev = round(sum(rs["total_spike_revenue_m_aud"] for rs in regional_stats if rs["year"] == 2024), 1)
    biggest_event = max(events, key=lambda e: e["financial_impact_m_aud"])
    most_volatile = max(
        regions,
        key=lambda rg: sum(
            rs["volatility_index"] for rs in regional_stats
            if rs["region"] == rg and rs["year"] == 2024
        ),
    )

    summary = {
        "total_events_2024": sum(1 for e in events if e["year"] == 2024),
        "total_spike_revenue_m_aud": total_spike_rev,
        "most_volatile_region": most_volatile,
        "avg_negative_price_hrs_pa": round(
            sum(pd["hours_count"] for pd in price_distribution if pd["price_band"] == "Negative")
            / max(len(set(pd["year"] for pd in price_distribution)), 1)
            / max(len(regions), 1), 1
        ),
        "total_cap_hit_events": sum(rs["cap_hit_count"] for rs in regional_stats if rs["year"] == 2024),
        "biggest_single_event_m_aud": biggest_event["financial_impact_m_aud"],
        "avg_event_duration_intervals": round(
            sum(e["duration_intervals"] for e in events) / max(len(events), 1), 1
        ),
    }

    return {
        "events": events,
        "regional_stats": regional_stats,
        "drivers": espe_drivers,
        "price_distribution": price_distribution,
        "mitigation": mitigation,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# 10) /api/price-model-comparison/dashboard  ->  PMCDashboard
# ---------------------------------------------------------------------------

@app.get("/api/price-model-comparison/dashboard")
def price_model_comparison_dashboard():
    _r.seed(1010)
    regions_pmc = ["NSW", "VIC", "QLD", "SA", "WA"]
    model_families = ["STATISTICAL", "ML", "DEEP_LEARNING", "HYBRID", "FUNDAMENTAL", "EXPERT_SYSTEM"]
    complexities = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]
    accuracy_req = ["HIGH", "MEDIUM", "LOW"]
    feature_categories = ["DEMAND", "GENERATION", "WEATHER", "FUEL", "CALENDAR", "MARKET"]
    scenario_list = ["NORMAL", "HIGH_VRE", "PRICE_SPIKE", "MARKET_STRESS", "NEGATIVE_PRICE"]

    model_defs = [
        ("M001", "ARIMA-GARCH", "STATISTICAL", "ARIMA(2,1,2)-GARCH(1,1)", "MEDIUM", 24, 2.5, "WEEKLY", None),
        ("M002", "XGBoost-Price", "ML", "XGBoost Regressor", "MEDIUM", 48, 8.0, "DAILY", None),
        ("M003", "LSTM-Seq2Seq", "DEEP_LEARNING", "LSTM Encoder-Decoder", "HIGH", 24, 45.0, "WEEKLY", None),
        ("M004", "Prophet-Additive", "STATISTICAL", "Facebook Prophet", "LOW", 168, 1.5, "MONTHLY", None),
        ("M005", "Dispatch-Sim", "FUNDAMENTAL", "Merit-order dispatch simulation", "VERY_HIGH", 48, 120.0, "MONTHLY", "AEMO"),
        ("M006", "Ensemble-Stack", "HYBRID", "Stacked ensemble (XGB+LSTM+ARIMA)", "HIGH", 24, 55.0, "DAILY", None),
        ("M007", "SARIMA-GARCH", "STATISTICAL", "SARIMA(1,1,1)(1,1,1)[48]-GARCH", "MEDIUM", 48, 5.0, "WEEKLY", None),
        ("M008", "Transformer-NEM", "DEEP_LEARNING", "Temporal Fusion Transformer", "VERY_HIGH", 24, 90.0, "WEEKLY", "Google DeepMind"),
    ]

    models = []
    for mid, mname, mfamily, algo, complexity, horizon, compute, freq, vendor in model_defs:
        features = _r.sample(
            ["demand", "temperature", "wind_gen", "solar_gen", "gas_price",
             "coal_gen", "interconnector", "time_of_day", "lagged_price", "calendar"],
            k=_r.randint(4, 8),
        )
        models.append({
            "model_id": mid,
            "model_name": mname,
            "model_family": mfamily,
            "algorithm": algo,
            "input_features": features,
            "training_frequency": freq,
            "forecast_horizon_hrs": horizon,
            "compute_time_mins": compute,
            "model_complexity": complexity,
            "commercial_vendor": vendor,
        })

    accuracy = []
    for m in models:
        for region in regions_pmc[:3]:
            for year in [2024]:
                for horizon in [1, 24]:
                    base_mae = {"STATISTICAL": 12, "ML": 8, "DEEP_LEARNING": 7, "HYBRID": 6, "FUNDAMENTAL": 15, "EXPERT_SYSTEM": 18}[m["model_family"]]
                    mae = round(base_mae + horizon * 0.3 + _r.uniform(-3, 5), 1)
                    accuracy.append({
                        "model_id": m["model_id"],
                        "region": region,
                        "year": year,
                        "horizon_hrs": horizon,
                        "mae": mae,
                        "rmse": round(mae * _r.uniform(1.2, 1.8), 1),
                        "mape": round(_r.uniform(5, 35), 1),
                        "r_squared": round(_r.uniform(0.55, 0.95), 2),
                        "spike_detection_rate_pct": round(_r.uniform(20, 90), 1),
                        "directional_accuracy_pct": round(_r.uniform(55, 85), 1),
                        "pit_coverage_pct": round(_r.uniform(80, 98), 1),
                    })

    use_cases = [
        ("INTRADAY_TRADING", "ML", "HIGH", 4, 120, 72.5),
        ("DAY_AHEAD_BIDDING", "HYBRID", "HIGH", 24, 85, 68.0),
        ("HEDGING_STRATEGY", "STATISTICAL", "MEDIUM", 8760, 45, 55.0),
        ("RENEWABLE_PPA_PRICING", "FUNDAMENTAL", "MEDIUM", 17520, 60, 40.0),
        ("BATTERY_DISPATCH", "ML", "HIGH", 4, 95, 80.0),
        ("RETAIL_PRICING", "STATISTICAL", "LOW", 168, 30, 65.0),
    ]
    commercial_uses = []
    for uc, fam, acc, horiz, val, adopt in use_cases:
        commercial_uses.append({
            "use_case": uc,
            "preferred_model_family": fam,
            "accuracy_requirement": acc,
            "horizon_needed_hrs": horiz,
            "annual_value_m": val,
            "adoption_pct": adopt,
        })

    feature_names = [
        "demand_forecast", "temperature", "wind_generation",
        "solar_generation", "gas_price", "coal_generation",
        "interconnector_flow", "time_of_day", "lagged_price",
        "calendar_effects", "battery_soc",
    ]
    feature_importance = []
    for m in models[:4]:
        remaining = 100.0
        for fi, fname in enumerate(feature_names[:6]):
            imp = round(min(remaining, _r.uniform(2, 20)), 1)
            remaining -= imp
            feature_importance.append({
                "model_id": m["model_id"],
                "feature": fname,
                "importance_pct": imp,
                "feature_category": _r.choice(feature_categories),
            })

    backtests = []
    for m in models:
        for scenario in scenario_list:
            for region in regions_pmc[:2]:
                rank = _r.randint(1, len(models))
                backtests.append({
                    "model_id": m["model_id"],
                    "backtest_period": "2022-01 to 2024-06",
                    "region": region,
                    "scenario": scenario,
                    "mae_normal": round(_r.uniform(5, 20), 1),
                    "mae_spike": round(_r.uniform(50, 500), 1),
                    "mae_negative": round(_r.uniform(20, 150), 1),
                    "overall_rank": rank,
                })

    # Make ranks per scenario unique
    for scenario in scenario_list:
        for region in regions_pmc[:2]:
            scenario_backtests = [b for b in backtests if b["scenario"] == scenario and b["region"] == region]
            scenario_backtests.sort(key=lambda b: b["mae_normal"] + b["mae_spike"])
            for rank, bt in enumerate(scenario_backtests, 1):
                bt["overall_rank"] = rank

    best_mae_model = min(
        accuracy, key=lambda a: a["mae"] if a["year"] == 2024 and a["horizon_hrs"] == 24 else 999
    )
    best_spike_model = max(
        accuracy, key=lambda a: a["spike_detection_rate_pct"] if a["year"] == 2024 else 0
    )
    avg_mae = round(
        sum(a["mae"] for a in accuracy if a["year"] == 2024 and a["horizon_hrs"] == 24)
        / max(sum(1 for a in accuracy if a["year"] == 2024 and a["horizon_hrs"] == 24), 1), 1
    )
    total_annual_value = sum(cu["annual_value_m"] for cu in commercial_uses)
    avg_adoption = round(sum(cu["adoption_pct"] for cu in commercial_uses) / max(len(commercial_uses), 1), 1)

    return {
        "models": models,
        "accuracy": accuracy,
        "commercial_uses": commercial_uses,
        "feature_importance": feature_importance,
        "backtests": backtests,
        "summary": {
            "best_model_mae": best_mae_model["model_id"],
            "best_spike_model": best_spike_model["model_id"],
            "avg_mae_all_models": avg_mae,
            "spike_detection_leader_pct": best_spike_model["spike_detection_rate_pct"],
            "commercial_adoption_pct": avg_adoption,
            "annual_forecast_value_m": total_annual_value,
        },
    }



# ---------------------------------------------------------------------------
# 1) /api/electricity-price-index/dashboard  ->  ElectricityPriceIndexDashboard
# ---------------------------------------------------------------------------

@app.get("/api/electricity-price-index/dashboard")
def electricity_price_index_dashboard():
    _r.seed(201)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    states = ["NSW", "VIC", "QLD", "SA", "WA"]
    quarters = ["2023-Q1", "2023-Q2", "2023-Q3", "2023-Q4", "2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"]
    drivers = [
        "Wholesale cost increase", "Network investment", "Renewable transition",
        "Gas price spike", "Demand growth", "Carbon policy",
    ]

    cpi_records = []
    for q in quarters:
        for s in states:
            elec_idx = round(_r.uniform(140, 210), 1)
            all_idx = round(_r.uniform(120, 145), 1)
            elec_yoy = round(_r.uniform(-5, 25), 1)
            all_yoy = round(_r.uniform(2, 7), 1)
            cpi_records.append({
                "quarter": q,
                "electricity_cpi_index": elec_idx,
                "electricity_cpi_yoy_pct": elec_yoy,
                "all_cpi_index": all_idx,
                "all_cpi_yoy_pct": all_yoy,
                "electricity_vs_all_cpi_diff_pct": round(elec_yoy - all_yoy, 1),
                "state": s,
                "key_driver": _r.choice(drivers),
            })

    dist_zones = ["Ausgrid", "Endeavour", "Essential", "Energex", "Ergon", "CitiPower", "Powercor", "SA Power", "Western Power"]
    dmo_records = []
    for yr in [2022, 2023, 2024]:
        for s in states[:4]:
            zone = _r.choice(dist_zones)
            usage = _r.choice([3900, 4600, 5500, 6200])
            dmo = round(_r.uniform(1200, 2200), 2)
            market_avg = round(dmo * _r.uniform(0.82, 0.98), 2)
            best = round(market_avg * _r.uniform(0.85, 0.95), 2)
            dmo_records.append({
                "year": yr,
                "state": s,
                "distribution_zone": zone,
                "annual_usage_kwh": usage,
                "dmo_price_aud": dmo,
                "dmo_change_pct": round(_r.uniform(-8, 25), 1),
                "market_offer_avg_aud": market_avg,
                "market_offer_avg_change_pct": round(_r.uniform(-10, 20), 1),
                "best_market_offer_aud": best,
                "potential_saving_aud": round(dmo - best, 2),
            })

    tariff_components = []
    for yr in [2022, 2023, 2024]:
        for s in states[:4]:
            nw = round(_r.uniform(0.08, 0.14), 4)
            wh = round(_r.uniform(0.06, 0.12), 4)
            env = round(_r.uniform(0.01, 0.03), 4)
            ret = round(_r.uniform(0.01, 0.04), 4)
            met = round(_r.uniform(0.005, 0.015), 4)
            tariff_components.append({
                "state": s,
                "year": yr,
                "network_charges_aud_kwh": nw,
                "wholesale_charges_aud_kwh": wh,
                "environmental_charges_aud_kwh": env,
                "retail_margin_aud_kwh": ret,
                "metering_aud_kwh": met,
                "total_tariff_aud_kwh": round(nw + wh + env + ret + met, 4),
            })

    retailer_names = ["AGL", "Origin Energy", "EnergyAustralia", "Alinta", "Red Energy", "Lumo"]
    retailers = []
    for ret_name in retailer_names:
        for s in states[:4]:
            avg_offer = round(_r.uniform(1100, 2000), 2)
            retailers.append({
                "retailer": ret_name,
                "state": s,
                "market_share_pct": round(_r.uniform(3, 32), 1),
                "avg_offer_aud": avg_offer,
                "cheapest_offer_aud": round(avg_offer * _r.uniform(0.82, 0.95), 2),
                "customer_satisfaction_score": round(_r.uniform(55, 85), 1),
                "complaints_per_1000": round(_r.uniform(2, 18), 1),
                "churn_rate_pct": round(_r.uniform(8, 28), 1),
            })

    return {
        "timestamp": _dt.utcnow().isoformat() + "Z",
        "cpi_records": cpi_records,
        "dmo_records": dmo_records,
        "tariff_components": tariff_components,
        "retailers": retailers,
    }


# ---------------------------------------------------------------------------
# 2) /api/market-price-formation-review/dashboard  ->  MPFRDashboard
# ---------------------------------------------------------------------------

@app.get("/api/market-price-formation-review/dashboard")
def market_price_formation_review_dashboard():
    _r.seed(202)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    states = ["NSW", "VIC", "QLD", "SA", "WA"]
    scarcity_types = [
        "Lack of Reserve 1", "LOR2", "LOR3", "Pre-LOR",
        "Emergency", "VoLL", "RERT", "Voluntary", "Market Suspended",
    ]
    customer_classes = ["Residential", "Small Business", "Commercial", "Industrial", "Agricultural"]
    reform_names = [
        "Capacity Investment Scheme", "Post-2025 Market Design",
        "Transmission Access Reform", "Congestion Management Model",
        "Operating Reserve Demand Curve", "Strategic Reserve Enhancement",
    ]
    consultation_stages = ["Draft Rule", "Final Determination", "Implementation", "Review", "Consultation"]
    outcomes = ["Approved", "Under Review", "Deferred", "Partially Approved"]

    price_caps = []
    for yr in [2022, 2023, 2024]:
        for r in regions:
            price_caps.append({
                "region": r,
                "year": yr,
                "market_price_cap_mwh": 16600.0,
                "administered_price_cap_mwh": 300.0,
                "voll_mwh": round(_r.uniform(33000, 40000), 0),
            })

    scarcity_events = []
    for _ in range(20):
        scarcity_events.append({
            "region": _r.choice(regions),
            "scarcity_type": _r.choice(scarcity_types),
        })

    vcr_values = []
    for cc in customer_classes:
        for s in states:
            vcr_values.append({
                "customer_class": cc,
                "state": s,
                "vcr_aud_per_mwh": round(_r.uniform(12000, 45000), 0),
            })

    reforms = []
    for name in reform_names:
        reforms.append({
            "reform_name": name,
            "consultation_stage": _r.choice(consultation_stages),
            "outcome": _r.choice(outcomes),
            "financial_impact_consumer_m": round(_r.uniform(-200, 500), 1),
        })

    quarters = ["2023-Q1", "2023-Q2", "2023-Q3", "2023-Q4", "2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"]
    marginal_costs = []
    for r in regions:
        for q in quarters:
            fuel = round(_r.uniform(20, 60), 2)
            carbon = round(_r.uniform(2, 15), 2)
            cap = round(_r.uniform(1, 10), 2)
            scarcity = round(_r.uniform(0, 8), 2)
            actual = round(fuel + carbon + cap + scarcity + _r.uniform(-10, 20), 2)
            marginal_costs.append({
                "region": r,
                "quarter": q,
                "fuel_cost_contribution_mwh": fuel,
                "carbon_cost_contribution_mwh": carbon,
                "capacity_adequacy_premium_mwh": cap,
                "scarcity_premium_mwh": scarcity,
                "actual_spot_price_mwh": actual,
            })

    demand_side = []
    for r in regions:
        for yr in [2022, 2023, 2024]:
            demand_side.append({
                "region": r,
                "year": yr,
                "demand_response_capacity_mw": round(_r.uniform(50, 600), 0),
            })

    return {
        "price_caps": price_caps,
        "scarcity_events": scarcity_events,
        "vcr_values": vcr_values,
        "reforms": reforms,
        "marginal_costs": marginal_costs,
        "demand_side": demand_side,
        "summary": {
            "current_mpc_mwh": 16600.0,
            "total_apc_activations_ytd": _r.randint(2, 12),
            "total_scarcity_cost_m": round(_r.uniform(50, 350), 1),
            "avg_vcr_residential_aud_per_mwh": round(_r.uniform(25000, 38000), 0),
            "active_reforms_count": len(reform_names),
            "demand_response_capacity_mw": round(_r.uniform(800, 2200), 0),
        },
    }


# ---------------------------------------------------------------------------
# 3) /api/electricity-market-price-formation/dashboard  ->  EMPFDashboard
# ---------------------------------------------------------------------------

@app.get("/api/electricity-market-price-formation/dashboard")
def electricity_market_price_formation_dashboard():
    _r.seed(203)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    months = [f"2024-{m:02d}" for m in range(1, 13)]
    fuel_types = ["Black Coal", "Brown Coal", "Gas CCGT", "Gas OCGT", "Hydro", "Wind", "Solar"]
    event_types = ["Price Spike >$300", "Negative Price", "Administered Price", "VOLL"]
    participants = ["AGL", "Origin", "Snowy Hydro", "EnergyAustralia"]
    technologies = ["New Entrant CCGT", "New Entrant Wind", "New Entrant Solar", "New Entrant BESS"]
    investment_signals = ["Invest", "Marginal", "Do Not Invest", "Under Review"]

    price_drivers = []
    for r in regions:
        for m in months[:6]:
            price_drivers.append({
                "region": r,
                "month": m,
                "fuel_cost_component": round(_r.uniform(15, 55), 2),
                "carbon_cost_component": round(_r.uniform(2, 12), 2),
                "capacity_scarcity_component": round(_r.uniform(0, 15), 2),
                "network_constraint_component": round(_r.uniform(1, 10), 2),
                "renewable_suppression_component": round(_r.uniform(-8, 0), 2),
                "fcas_cost_component": round(_r.uniform(0.5, 5), 2),
            })

    marginal_units = []
    for ft in fuel_types:
        marginal_units.append({
            "fuel_type": ft,
            "pct_intervals_marginal": round(_r.uniform(2, 35), 1),
        })

    price_events = []
    for _ in range(15):
        price_events.append({
            "peak_price": round(_r.uniform(300, 16600), 2),
            "duration_intervals": _r.randint(1, 24),
            "total_cost_m": round(_r.uniform(0.5, 45), 2),
            "event_type": _r.choice(event_types),
            "region": _r.choice(regions),
        })

    quarters = ["2023-Q1", "2023-Q2", "2023-Q3", "2023-Q4", "2024-Q1", "2024-Q2"]
    bidding_behaviour = []
    for q in quarters:
        for p in participants:
            bidding_behaviour.append({
                "quarter": q,
                "participant": p,
                "capacity_bid_at_voll_pct": round(_r.uniform(0, 15), 1),
            })

    long_run_costs = []
    for tech in technologies:
        for r in regions:
            lrmc = round(_r.uniform(45, 120), 2)
            req_cf = round(_r.uniform(15, 60), 1)
            cur_cf = round(req_cf * _r.uniform(0.6, 1.2), 1)
            long_run_costs.append({
                "technology": tech,
                "region": r,
                "lrmc_per_mwh": lrmc,
                "required_capacity_factor_pct": req_cf,
                "current_cf_pct": cur_cf,
                "investment_signal": _r.choice(investment_signals),
            })

    return {
        "price_drivers": price_drivers,
        "marginal_units": marginal_units,
        "price_events": price_events,
        "bidding_behaviour": bidding_behaviour,
        "long_run_costs": long_run_costs,
        "summary": {
            "avg_spot_price_mwh": round(_r.uniform(55, 120), 2),
            "most_frequent_price_setter": _r.choice(fuel_types),
            "price_spike_events_ytd": _r.randint(15, 85),
            "avg_lrmc_new_wind": round(_r.uniform(50, 75), 2),
            "most_concentrated_region": _r.choice(regions),
        },
    }


# ---------------------------------------------------------------------------
# 4) /api/electricity-price-cap-intervention/dashboard  ->  EPCIDashboard
# ---------------------------------------------------------------------------

@app.get("/api/electricity-price-cap-intervention/dashboard")
def electricity_price_cap_intervention_dashboard():
    _r.seed(204)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    trigger_types = ["MPC Activated", "CPT Breach", "RERT Trigger", "APC Price"]
    action_types = ["RERT Activation", "DR Activation", "Interconnector Dispatch", "Reserve Trader"]
    action_outcomes = ["Prevented Cap", "Reduced Duration", "Ineffective"]
    generators = ["AGL Macquarie", "Origin Eraring", "Stanwell Corp", "Snowy Hydro", "CS Energy", "EnergyAustralia Yallourn"]

    price_cap_events = []
    for _ in range(18):
        price_cap_events.append({
            "trigger_type": _r.choice(trigger_types),
            "spot_price_avg_aud_mwh": round(_r.uniform(300, 16600), 2),
        })

    market_impact = []
    for yr in [2022, 2023, 2024]:
        for q in ["Q1", "Q2", "Q3", "Q4"]:
            for r in regions[:3]:
                market_impact.append({
                    "year": yr,
                    "quarter": q,
                    "region": r,
                    "cap_events_count": _r.randint(0, 8),
                })

    generator_response = []
    for yr in [2022, 2023, 2024]:
        for g in generators:
            generator_response.append({
                "year": yr,
                "generator": g,
                "revenue_impact_m": round(_r.uniform(-50, 30), 1),
            })

    threshold_tracker = []
    for yr in [2023, 2024]:
        for m in range(1, 13):
            for r in regions[:3]:
                threshold_tracker.append({
                    "year": yr,
                    "month": m,
                    "region": r,
                    "cumulative_price_atd": round(_r.uniform(50000, 1200000), 0),
                })

    remedy_actions = []
    for _ in range(15):
        remedy_actions.append({
            "action_type": _r.choice(action_types),
            "outcome": _r.choice(action_outcomes),
            "capacity_mw": round(_r.uniform(50, 800), 0),
        })

    return {
        "price_cap_events": price_cap_events,
        "market_impact": market_impact,
        "generator_response": generator_response,
        "threshold_tracker": threshold_tracker,
        "remedy_actions": remedy_actions,
        "summary": {
            "total_cap_events_fy": _r.randint(10, 45),
            "total_hours_at_cap_fy": round(_r.uniform(5, 80), 1),
            "max_administered_price_aud_mwh": 300.0,
            "total_consumer_savings_m": round(_r.uniform(100, 800), 1),
            "most_affected_region": _r.choice(regions),
        },
    }


# ---------------------------------------------------------------------------
# 5) /api/nem-price-review/dashboard  ->  NEPRdashboard
# ---------------------------------------------------------------------------

@app.get("/api/nem-price-review/dashboard")
def nem_price_review_dashboard():
    _r.seed(205)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    states = ["NSW", "VIC", "QLD", "SA", "WA", "TAS"]

    spot_prices = []
    for r in regions:
        for yr in [2022, 2023, 2024]:
            for m in range(1, 13):
                spot_prices.append({
                    "region": r,
                    "year": yr,
                    "month": m,
                    "avg_spot_price_mwh": round(_r.uniform(30, 180), 2),
                })

    retail_prices = []
    for s in states:
        for yr in [2022, 2023, 2024]:
            retail_prices.append({
                "state": s,
                "year": yr,
                "avg_residential_c_kwh": round(_r.uniform(22, 42), 2),
                "avg_sme_c_kwh": round(_r.uniform(18, 36), 2),
            })

    quarters = ["Q1", "Q2", "Q3", "Q4"]
    price_drivers = []
    for r in regions:
        for yr in [2023, 2024]:
            for q in quarters:
                wh = round(_r.uniform(25, 45), 1)
                nw = round(_r.uniform(30, 45), 1)
                env = round(_r.uniform(5, 15), 1)
                ret = round(_r.uniform(5, 12), 1)
                oth = round(100 - wh - nw - env - ret, 1)
                price_drivers.append({
                    "region": r,
                    "year": yr,
                    "quarter": q,
                    "wholesale_component_pct": wh,
                    "network_component_pct": nw,
                    "environmental_component_pct": env,
                    "retail_margin_pct": ret,
                    "other_pct": oth,
                })

    affordability = []
    for s in states:
        for yr in [2022, 2023, 2024]:
            affordability.append({
                "state": s,
                "year": yr,
                "avg_household_bill_aud": round(_r.uniform(1200, 2600), 0),
                "energy_poverty_pct": round(_r.uniform(5, 22), 1),
            })

    return {
        "spot_prices": spot_prices,
        "retail_prices": retail_prices,
        "price_drivers": price_drivers,
        "affordability": affordability,
        "summary": {
            "avg_spot_price_2024_mwh": round(_r.uniform(60, 110), 2),
            "avg_retail_price_2024_c_kwh": round(_r.uniform(28, 38), 2),
            "highest_price_region": _r.choice(regions),
            "total_cap_price_events": _r.randint(8, 40),
        },
    }


# ---------------------------------------------------------------------------
# 6) /api/demand-curve-price-anchor/dashboard  ->  DCPAdashboard
# ---------------------------------------------------------------------------

@app.get("/api/demand-curve-price-anchor/dashboard")
def demand_curve_price_anchor_dashboard():
    _r.seed(206)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    sectors = ["Residential", "Commercial", "Industrial", "Agricultural"]
    quarters = ["Q1", "Q2", "Q3", "Q4"]

    demand = []
    for yr in [2022, 2023, 2024]:
        for m in range(1, 13):
            for r in regions:
                demand.append({
                    "year": yr,
                    "month": m,
                    "region": r,
                    "peak_demand_mw": round(_r.uniform(3000, 14000), 0),
                })

    price_anchors = []
    for yr in [2022, 2023, 2024]:
        for q in quarters:
            for r in regions:
                vwap = round(_r.uniform(50, 150), 2)
                twa = round(_r.uniform(40, 130), 2)
                price_anchors.append({
                    "year": yr,
                    "quarter": q,
                    "region": r,
                    "vwap_mwh": vwap,
                    "twa_price_mwh": twa,
                    "price_anchor_mwh": round((vwap + twa) / 2, 2),
                })

    elasticity = []
    for sec in sectors:
        elasticity.append({
            "sector": sec,
            "price_elasticity": round(_r.uniform(-0.8, -0.05), 3),
        })

    forecasts = []
    for yr in [2024, 2025]:
        for q in quarters:
            for r in regions:
                forecast = round(_r.uniform(4000, 13500), 0)
                actual = round(forecast * _r.uniform(0.9, 1.1), 0)
                forecasts.append({
                    "year": yr,
                    "quarter": q,
                    "region": r,
                    "forecast_demand_mw": forecast,
                    "actual_demand_mw": actual,
                })

    return {
        "demand": demand,
        "price_anchors": price_anchors,
        "elasticity": elasticity,
        "forecasts": forecasts,
        "summary": {
            "avg_peak_demand_mw": round(_r.uniform(7000, 10000), 0),
            "avg_price_anchor_mwh": round(_r.uniform(65, 95), 2),
            "most_elastic_region": _r.choice(regions),
            "total_demand_response_mw": round(_r.uniform(800, 2500), 0),
        },
    }


# ---------------------------------------------------------------------------
# /api/market-stress/dashboard  ->  MarketStressDashboard
# ---------------------------------------------------------------------------

@app.get("/api/market-stress/dashboard")
def market_stress_dashboard():
    _r.seed(777)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    severities = ["MILD", "MODERATE", "SEVERE", "EXTREME"]
    triggers = [
        "Heatwave exceeding 45°C across eastern seaboard",
        "Simultaneous coal unit trips (3+ units)",
        "Gas supply disruption — Longford plant outage",
        "Basslink interconnector failure",
        "Wind drought across SA and VIC (48hr+)",
        "Cyber attack on SCADA systems",
        "Major bushfire cutting transmission lines",
        "LNG export surge reducing domestic gas supply",
    ]
    scenario_names = [
        "Eastern Seaboard Heatwave", "Multi-Unit Coal Trip", "Gas Supply Shock",
        "Basslink Outage", "Prolonged Wind Drought", "Cyber Disruption",
        "Bushfire Transmission Loss", "LNG Export Squeeze",
    ]

    scenarios = []
    for i, name in enumerate(scenario_names):
        scenarios.append({
            "scenario_id": f"STRESS-{i+1:03d}",
            "name": name,
            "description": f"Stress test scenario: {name.lower()}",
            "trigger_event": triggers[i],
            "severity": severities[min(i // 2, 3)],
            "probability_pct": round(_r.uniform(2, 35), 1),
            "duration_days": _r.randint(1, 14),
        })

    metrics = ["PRICE", "AVAILABILITY", "RELIABILITY", "REVENUE"]
    results = []
    for sc in scenarios[:5]:
        for reg in regions[:3]:
            for met in metrics:
                baseline = round(_r.uniform(50, 500), 2) if met == "PRICE" else round(_r.uniform(85, 99), 1)
                impact = round(_r.uniform(5, 120), 1)
                results.append({
                    "scenario_id": sc["scenario_id"],
                    "region": reg,
                    "metric": met,
                    "baseline_value": baseline,
                    "stressed_value": round(baseline * (1 + impact / 100), 2),
                    "impact_pct": impact,
                    "recovery_days": _r.randint(1, 21),
                })

    components = [
        "Coal Fleet (aging)", "Gas Pipeline Network", "Interconnector Capacity",
        "Rooftop Solar Inverters", "BESS Fleet", "SCADA/EMS Systems",
        "Market IT Systems", "Transmission Towers (bushfire zones)",
    ]
    vulnerabilities = []
    for comp in components:
        vulnerabilities.append({
            "component": comp,
            "vulnerability_score": round(_r.uniform(0.2, 0.95), 2),
            "single_point_of_failure": _r.random() > 0.6,
            "mitigation_status": _r.choice(["Mitigated", "Partial", "Unmitigated", "Under Review"]),
        })

    kpis = []
    for sc in scenarios[:6]:
        kpis.append({
            "scenario": sc["name"],
            "avg_price_spike_pct": round(_r.uniform(50, 800), 1),
            "max_price_aud_mwh": round(_r.uniform(1000, 16600), 0),
            "unserved_energy_mwh": round(_r.uniform(0, 5000), 0),
            "affected_consumers_k": round(_r.uniform(10, 2500), 0),
            "economic_cost_m_aud": round(_r.uniform(5, 500), 1),
        })

    return {
        "timestamp": _dt.utcnow().isoformat() + "Z",
        "scenarios": scenarios,
        "results": results,
        "vulnerabilities": vulnerabilities,
        "kpis": kpis,
    }


# ---------------------------------------------------------------------------
# /api/demand-forecast/dashboard  ->  DemandForecastDashboard
# ---------------------------------------------------------------------------

@app.get("/api/demand-forecast/dashboard")
def demand_forecast_dashboard():
    _r.seed(888)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    models = ["AEMO_ST_PASA", "AEMO_MT_PASA", "ML_ENHANCED"]
    conditions = ["HOT", "MODERATE", "COLD", "STORM"]
    horizons = [1, 24, 168]
    base_demands = {"NSW1": 8500, "QLD1": 6200, "VIC1": 5800, "SA1": 1800, "TAS1": 1100}

    forecast_records = []
    for reg in regions:
        base = base_demands[reg]
        for h in horizons:
            for d in range(5):
                actual = base + _r.uniform(-800, 800)
                error_scale = 1 + h * 0.02
                forecast = actual + _r.uniform(-200, 200) * error_scale
                error = forecast - actual
                mae_pct = round(abs(error) / actual * 100, 2)
                forecast_records.append({
                    "region": reg,
                    "forecast_date": (_dt(2024, 7, 1) + _td(days=d)).strftime("%Y-%m-%d"),
                    "forecast_horizon_h": h,
                    "forecast_mw": round(forecast, 1),
                    "actual_mw": round(actual, 1),
                    "error_mw": round(error, 1),
                    "mae_pct": mae_pct,
                    "forecast_model": _r.choice(models),
                    "temperature_c": round(_r.uniform(8, 42), 1),
                    "conditions": _r.choice(conditions),
                })

    pasa_records = []
    months = ["2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12"]
    for reg in regions:
        base = base_demands[reg]
        for m in months:
            cap = base * _r.uniform(1.15, 1.45)
            d10 = base * _r.uniform(1.05, 1.25)
            d50 = base * _r.uniform(0.85, 1.05)
            margin = round((cap - d10) / d10 * 100, 1)
            pasa_records.append({
                "region": reg,
                "month": m,
                "reserve_margin_pct": margin,
                "ues_mwh": round(_r.uniform(0, 50), 1) if margin < 10 else 0.0,
                "lrc_mw": round(cap - d10, 0),
                "capacity_available_mw": round(cap, 0),
                "demand_10poe_mw": round(d10, 0),
                "demand_50poe_mw": round(d50, 0),
                "reliability_standard_met": margin >= 10,
            })

    mae_1h = round(sum(r["mae_pct"] for r in forecast_records if r["forecast_horizon_h"] == 1) / max(1, sum(1 for r in forecast_records if r["forecast_horizon_h"] == 1)), 2)
    mae_24h = round(sum(r["mae_pct"] for r in forecast_records if r["forecast_horizon_h"] == 24) / max(1, sum(1 for r in forecast_records if r["forecast_horizon_h"] == 24)), 2)
    mae_168h = round(sum(r["mae_pct"] for r in forecast_records if r["forecast_horizon_h"] == 168) / max(1, sum(1 for r in forecast_records if r["forecast_horizon_h"] == 168)), 2)

    return {
        "timestamp": _dt.utcnow().isoformat() + "Z",
        "regions": regions,
        "avg_mae_1h_pct": mae_1h,
        "avg_mae_24h_pct": mae_24h,
        "avg_mae_168h_pct": mae_168h,
        "forecast_records": forecast_records,
        "pasa_records": pasa_records,
    }


# =========================================================================
# Genie AI/BI Space proxy endpoints
# =========================================================================

_GENIE_SPACES = [
    {
        "space_id": "01f1150f2d9d121f8b06c0867f395604",
        "title": "NEM Spot Market Intelligence",
        "description": "Spot prices, demand, price spikes, negative pricing, and anomaly events across all NEM regions.",
        "icon": "zap",
        "tables": ["nem_prices_5min", "nem_prices_30min", "nem_daily_summary", "daily_market_summary", "anomaly_events", "demand_actuals"],
        "sample_questions": [
            "What was the average spot price by region last week?",
            "Show me all price spike events above $1000/MWh",
            "Which region had the most negative pricing intervals?",
            "What is the daily price volatility trend for SA1?",
            "Show peak demand by region for the last 30 days",
        ],
    },
    {
        "space_id": "01f1150f2e40113fb08038e471628297",
        "title": "NEM Generation & Renewables",
        "description": "Generation by fuel type, renewable penetration, emissions intensity, and capacity factors.",
        "icon": "sun",
        "tables": ["nem_generation_by_fuel", "nem_daily_summary", "generation_forecasts"],
        "sample_questions": [
            "What is the current renewable energy share by region?",
            "Show the generation mix for NSW1 over the last month",
            "Which fuel type has the highest emissions intensity?",
            "How does wind generation vary by time of day?",
            "What is the trend in coal generation share?",
        ],
    },
    {
        "space_id": "01f1150f2ed91af88393964a36ed4e64",
        "title": "NEM Network & Interconnectors",
        "description": "Interconnector flows, congestion events, network constraints, and inter-regional transfers.",
        "icon": "network",
        "tables": ["nem_interconnectors", "nem_constraints_active", "nem_daily_summary"],
        "sample_questions": [
            "Which interconnector is most congested?",
            "Show the flow pattern between NSW and QLD over the last week",
            "What are the most binding network constraints?",
            "When does Basslink typically export to Tasmania?",
            "What is the average utilization of each interconnector?",
        ],
    },
    {
        "space_id": "01f1150f2f95139da2181460ecdd4136",
        "title": "NEM Forecasting & Weather",
        "description": "Demand forecasts, price forecasts, generation forecasts, and weather conditions.",
        "icon": "cloud-sun",
        "tables": ["demand_forecasts", "price_forecasts", "generation_forecasts", "weather_nem_regions", "demand_actuals"],
        "sample_questions": [
            "How accurate are the demand forecasts for NSW1?",
            "Show the price forecast vs actual for the last 24 hours",
            "What is the current temperature and wind speed by region?",
            "Which region has the highest spike probability?",
            "How does solar radiation affect price forecasts?",
        ],
    },
]


@app.get("/api/genie/spaces")
def list_genie_spaces():
    """Return the list of configured Genie spaces."""
    return {"spaces": _GENIE_SPACES}


def _genie_headers():
    """Get auth headers for Genie API calls using the app's service principal."""
    from databricks.sdk import WorkspaceClient
    w = WorkspaceClient()
    auth = w.config.authenticate()
    host = w.config.host.rstrip("/")
    return auth, host


@app.post("/api/genie/spaces/{space_id}/start-conversation")
async def genie_start_conversation(space_id: str, request: Request):
    """Start a new Genie conversation with an initial question."""
    try:
        body = await request.json()
        headers, host = _genie_headers()
        headers["Content-Type"] = "application/json"
        import httpx
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{host}/api/2.0/genie/spaces/{space_id}/start-conversation",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        return JSONResponse(status_code=502, content={"error": str(e)})


@app.post("/api/genie/spaces/{space_id}/conversations/{conversation_id}/messages")
async def genie_send_message(space_id: str, conversation_id: str, request: Request):
    """Send a follow-up message to an existing Genie conversation."""
    try:
        body = await request.json()
        headers, host = _genie_headers()
        headers["Content-Type"] = "application/json"
        import httpx
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{host}/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        return JSONResponse(status_code=502, content={"error": str(e)})


@app.get("/api/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}")
async def genie_get_message(space_id: str, conversation_id: str, message_id: str):
    """Poll a Genie message for its result (SQL query and data)."""
    try:
        headers, host = _genie_headers()
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{host}/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}",
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        return JSONResponse(status_code=502, content={"error": str(e)})


@app.get("/api/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}/query-result")
async def genie_get_query_result(space_id: str, conversation_id: str, message_id: str):
    """Get the SQL query result data for a Genie message."""
    try:
        headers, host = _genie_headers()
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{host}/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}/query-result",
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        return JSONResponse(status_code=502, content={"error": str(e)})


# =========================================================================
# BATCH: Forecasting endpoints (9)
# =========================================================================

@app.get("/api/nem-demand-forecasting-accuracy/dashboard")
def ndfa_dashboard():
    _r.seed(7001)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    horizons = ["1h", "4h", "12h", "24h", "48h", "168h"]
    models = ["XGBoost", "LSTM", "Prophet", "Ensemble", "Ridge", "GBM"]
    fa = []
    for reg in regions:
        for h in horizons:
            fa.append({"region": reg, "horizon": h, "mape_pct": round(_r.uniform(1.5, 12), 2), "rmse_mw": round(_r.uniform(50, 400), 1), "bias_mw": round(_r.uniform(-80, 80), 1), "r_squared": round(_r.uniform(0.85, 0.99), 3), "sample_size": _r.randint(500, 5000)})
    hp = [{"region": reg, "hour": h, "avg_error_pct": round(_r.uniform(1, 8), 2), "peak_error_pct": round(_r.uniform(5, 25), 2)} for reg in regions for h in range(0, 24, 3)]
    mc = [{"model": m, "region": reg, "mape_1h": round(_r.uniform(1, 5), 2), "mape_24h": round(_r.uniform(3, 12), 2), "training_time_s": round(_r.uniform(10, 600), 1)} for m in models for reg in regions[:3]]
    ee = [{"event_type": t, "region": reg, "count": _r.randint(5, 50), "avg_error_pct": round(_r.uniform(8, 35), 2), "max_error_pct": round(_r.uniform(20, 80), 2)} for t in ["Heatwave", "Cold Snap", "Storm", "Price Spike"] for reg in regions[:3]]
    fi = [{"feature": f, "importance": round(_r.uniform(0.02, 0.25), 3)} for f in ["Temperature", "Time of Day", "Day of Week", "Solar Irradiance", "Wind Speed", "Lagged Demand", "Holiday Flag", "Cloud Cover"]]
    return {"forecast_accuracy": fa, "hourly_profiles": hp, "model_comparison": mc, "extreme_events": ee, "feature_importance": fi, "summary": {"best_model": "Ensemble", "avg_mape_1h": 2.8, "avg_mape_24h": 6.1, "regions_covered": 5}}


@app.get("/api/electricity-demand-forecasting-ml-x/dashboard")
def edfmx_dashboard():
    _r.seed(7002)
    models_list = ["XGBoost-v3", "LSTM-Attention", "Prophet-Tuned", "CatBoost-v2", "LightGBM", "Transformer-S"]
    models = [{"model_id": f"MDL-{i+1:03d}", "model_name": m, "model_type": m.split("-")[0], "version": f"v{_r.randint(1,5)}.{_r.randint(0,9)}", "mape_pct": round(_r.uniform(1.5, 8), 2), "rmse_mw": round(_r.uniform(60, 350), 1), "status": _r.choice(["PRODUCTION", "STAGING", "RETIRED"]), "last_trained": "2025-12-15"} for i, m in enumerate(models_list)]
    fi = [{"feature": f, "importance": round(_r.uniform(0.02, 0.3), 3), "model": _r.choice(models_list)} for f in ["Temperature", "Solar", "Wind", "Lagged Demand", "Price Signal", "Calendar", "Cloud Cover", "Humidity"]]
    ar = [{"model": m, "region": reg, "horizon_h": h, "mape_pct": round(_r.uniform(1, 10), 2), "rmse_mw": round(_r.uniform(40, 300), 1)} for m in models_list[:3] for reg in ["NSW1", "QLD1", "VIC1"] for h in [1, 4, 24]]
    sb = [{"date": f"2025-{_r.randint(1,12):02d}-{_r.randint(1,28):02d}", "region": _r.choice(["NSW1", "QLD1", "VIC1"]), "break_type": _r.choice(["Level Shift", "Trend Change", "Variance Change"]), "magnitude_pct": round(_r.uniform(5, 25), 1), "detected_by": _r.choice(["CUSUM", "Chow Test"])} for _ in range(8)]
    dm = [{"model": m, "drift_score": round(_r.uniform(0, 1), 3), "drift_detected": _r.choice([True, False]), "last_check": "2025-12-20"} for m in models_list]
    fc = [{"region": reg, "timestamp": f"2025-12-20T{h:02d}:00:00Z", "forecast_mw": round(_r.uniform(5000, 14000), 0), "actual_mw": round(_r.uniform(5000, 14000), 0)} for reg in ["NSW1", "QLD1", "VIC1"] for h in range(0, 24, 4)]
    return {"models": models, "feature_importance": fi, "accuracy_records": ar, "structural_breaks": sb, "drift_monitoring": dm, "forecasts": fc, "summary": {"best_model_name": "Ensemble", "best_model_mape_pct": 2.3, "production_models_count": 3, "models_with_drift": 1, "structural_breaks_ytd": 4, "avg_forecast_error_pct": 3.8}}


@app.get("/api/distributed-solar-forecasting/dashboard")
def dsfa_dashboard():
    _r.seed(7003)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    acc = [{"region": reg, "horizon": h, "mape_pct": round(_r.uniform(5, 25), 2), "rmse_mw": round(_r.uniform(20, 200), 1), "skill_score": round(_r.uniform(0.3, 0.9), 2)} for reg in regions for h in ["1h", "4h", "24h"]]
    inst = [{"region": reg, "year": y, "installed_capacity_mw": round(_r.uniform(2000, 8000), 0), "systems_count": _r.randint(200000, 900000), "avg_system_kw": round(_r.uniform(5, 10), 1)} for reg in regions for y in [2023, 2024, 2025]]
    wi = [{"region": reg, "weather_type": w, "impact_mw": round(_r.uniform(-500, 500), 0), "frequency_pct": round(_r.uniform(2, 20), 1)} for reg in regions[:3] for w in ["Cloud Cover", "Temperature", "Humidity", "Dust/Haze"]]
    gi = [{"region": reg, "max_ramp_mw_min": round(_r.uniform(50, 300), 0), "curtailment_mwh": round(_r.uniform(0, 5000), 0), "min_demand_event_count": _r.randint(0, 20)} for reg in regions]
    sc = [{"scenario": s, "year": 2030, "capacity_gw": round(_r.uniform(20, 50), 1), "generation_twh": round(_r.uniform(30, 80), 1)} for s in ["Step Change", "Progressive Change", "Green Energy Exports"]]
    return {"accuracy": acc, "installations": inst, "weather_impacts": wi, "grid_integration": gi, "scenarios": sc, "summary": {"total_installed_gw": 18.5, "avg_mape_1h": 8.2, "fastest_growing_region": "QLD1"}}


@app.get("/api/demand-forecast-accuracy/dashboard")
def dfa_dashboard():
    _r.seed(7004)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    er = [{"region": reg, "date": f"2025-{m:02d}-15", "forecast_mw": round(_r.uniform(5000, 13000), 0), "actual_mw": round(_r.uniform(5000, 13000), 0), "error_mw": round(_r.uniform(-500, 500), 0), "error_pct": round(_r.uniform(-8, 8), 2)} for reg in regions for m in range(1, 13)]
    hs = [{"horizon": h, "mape_pct": round(_r.uniform(1, 12), 2), "rmse_mw": round(_r.uniform(50, 400), 0), "bias_mw": round(_r.uniform(-100, 100), 0), "sample_count": _r.randint(500, 5000)} for h in ["5min", "30min", "1h", "4h", "24h", "168h"]]
    sb = [{"region": reg, "season": s, "bias_mw": round(_r.uniform(-200, 200), 0), "bias_pct": round(_r.uniform(-5, 5), 2)} for reg in regions for s in ["Summer", "Autumn", "Winter", "Spring"]]
    mb = [{"model": m, "mape_pct": round(_r.uniform(2, 10), 2), "rmse_mw": round(_r.uniform(80, 350), 0), "r_squared": round(_r.uniform(0.88, 0.99), 3)} for m in ["AEMO P50", "XGBoost", "LSTM", "Ensemble", "Persistence"]]
    return {"error_records": er, "horizon_summary": hs, "seasonal_bias": sb, "model_benchmarks": mb, "summary": {"avg_mape_pct": 3.9, "best_model": "Ensemble", "worst_region": "SA1"}}


@app.get("/api/electricity-market-forecasting-accuracy/dashboard")
def emfa_dashboard():
    _r.seed(7005)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    pf = [{"region": reg, "date": f"2025-{m:02d}-15", "forecast_price": round(_r.uniform(40, 200), 2), "actual_price": round(_r.uniform(40, 200), 2), "error_pct": round(_r.uniform(-15, 15), 2)} for reg in regions for m in range(1, 13)]
    df = [{"region": reg, "date": f"2025-{m:02d}-15", "forecast_mw": round(_r.uniform(5000, 13000), 0), "actual_mw": round(_r.uniform(5000, 13000), 0), "mape_pct": round(_r.uniform(1, 8), 2)} for reg in regions for m in range(1, 7)]
    rf = [{"region": reg, "source": s, "forecast_mw": round(_r.uniform(500, 5000), 0), "actual_mw": round(_r.uniform(500, 5000), 0), "error_pct": round(_r.uniform(-20, 20), 2)} for reg in regions[:3] for s in ["Solar", "Wind"]]
    ep = [{"event_type": t, "predicted": _r.randint(5, 30), "actual": _r.randint(5, 30), "accuracy_pct": round(_r.uniform(40, 90), 1)} for t in ["Price Spike", "Negative Price", "Demand Peak", "Ramp Event"]]
    mdls = [{"model": m, "mape_price_pct": round(_r.uniform(5, 20), 2), "mape_demand_pct": round(_r.uniform(2, 8), 2), "status": "PRODUCTION"} for m in ["Ensemble-v4", "XGBoost-P", "LSTM-Price", "Prophet"]]
    it = [{"year": y, "price_mape_pct": round(_r.uniform(8, 18), 2), "demand_mape_pct": round(_r.uniform(2, 6), 2)} for y in [2021, 2022, 2023, 2024, 2025]]
    return {"price_forecasts": pf, "demand_forecasts": df, "renewable_forecasts": rf, "event_predictions": ep, "models": mdls, "improvement_trend": it, "summary": {"avg_price_mape_pct": 11.2, "avg_demand_mape_pct": 3.9, "best_model_name": "Ensemble-v4", "spike_prediction_accuracy_pct": 72.5, "yoy_improvement_pct": 8.3, "avg_renewable_error_pct": 12.1}}


@app.get("/api/nem-demand-forecast/dashboard")
def ndf_dashboard():
    _r.seed(7006)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    rf = [{"region": reg, "year": y, "summer_peak_mw": round(_r.uniform(8000, 15000), 0), "winter_peak_mw": round(_r.uniform(7000, 13000), 0), "annual_energy_twh": round(_r.uniform(20, 80), 1), "growth_pct": round(_r.uniform(-2, 5), 2)} for reg in regions for y in [2025, 2026, 2027, 2028, 2030]]
    pd_list = [{"region": reg, "year": y, "peak_demand_mw": round(_r.uniform(8000, 15000), 0), "poe_10_mw": round(_r.uniform(9000, 17000), 0), "poe_50_mw": round(_r.uniform(7500, 14000), 0), "poe_90_mw": round(_r.uniform(6500, 12000), 0)} for reg in regions for y in [2025, 2026, 2028]]
    gd = [{"driver": d, "impact_mw": round(_r.uniform(-2000, 3000), 0), "direction": _r.choice(["Increasing", "Decreasing"]), "certainty": _r.choice(["High", "Medium", "Low"])} for d in ["Population Growth", "EV Uptake", "Rooftop Solar", "Battery Storage", "Industrial Load", "Data Centres", "Electrification"]]
    sens = [{"parameter": p, "low_case_mw": round(_r.uniform(-2000, 0), 0), "base_case_mw": 0, "high_case_mw": round(_r.uniform(0, 3000), 0)} for p in ["Temperature", "Economic Growth", "EV Penetration", "Solar Uptake"]]
    ro = [{"region": reg, "year": y, "unserved_energy_mwh": round(_r.uniform(0, 50), 1), "reliability_standard_met": _r.choice([True, True, True, False])} for reg in regions for y in [2025, 2026, 2028]]
    return {"regional_forecasts": rf, "peak_demands": pd_list, "growth_drivers": gd, "sensitivities": sens, "reliability_outlook": ro, "summary": {"total_nem_peak_mw": 35200, "growth_rate_pct": 1.8, "highest_growth_region": "QLD1"}}


@app.get("/api/electricity-price-forecasting-models/dashboard")
def epf_models_dashboard():
    _r.seed(7007)
    models_names = ["XGBoost-Price", "LSTM-Seq2Seq", "Prophet-Energy", "Ridge-Base", "CatBoost-v2", "Transformer"]
    models = [{"model_id": f"EPF-{i+1:03d}", "model_name": m, "model_type": m.split("-")[0], "version": f"v{_r.randint(1,4)}.{_r.randint(0,9)}", "mape_pct": round(_r.uniform(5, 20), 2), "rmse_aud": round(_r.uniform(10, 60), 2), "status": _r.choice(["PRODUCTION", "STAGING", "RETIRED"])} for i, m in enumerate(models_names)]
    ew = [{"model": m, "weight": round(_r.uniform(0.05, 0.35), 3)} for m in models_names[:4]]
    fa = [{"model": m, "region": reg, "horizon": h, "mape_pct": round(_r.uniform(3, 18), 2), "rmse_aud": round(_r.uniform(8, 50), 2)} for m in models_names[:3] for reg in ["NSW1", "QLD1", "VIC1"] for h in ["1h", "24h"]]
    fi = [{"feature": f, "importance": round(_r.uniform(0.02, 0.25), 3)} for f in ["Demand", "Gas Price", "Wind Output", "Solar Output", "Temperature", "Time of Day", "Interconnector Flow", "Coal Price"]]
    cal = [{"model": m, "quantile": q, "coverage_pct": round(_r.uniform(q * 100 - 5, q * 100 + 5), 1)} for m in models_names[:3] for q in [0.1, 0.25, 0.5, 0.75, 0.9]]
    return {"models": models, "ensemble_weights": ew, "forecast_accuracy": fa, "feature_importance": fi, "calibration": cal, "summary": {"best_model": "XGBoost-Price", "ensemble_mape_pct": 7.2, "models_in_production": 3}}


@app.get("/api/electricity-price-forecasting/dashboard")
def epfm_dashboard():
    _r.seed(7008)
    models_names = ["Ensemble-v5", "XGBoost-P2", "LSTM-Price", "CatBoost-P", "Ridge", "Prophet-P"]
    models = [{"model_id": f"EPFM-{i+1:03d}", "model_name": m, "mape_pct": round(_r.uniform(4, 16), 2), "rmse_aud": round(_r.uniform(8, 45), 2), "training_samples": _r.randint(10000, 100000), "status": _r.choice(["ACTIVE", "RETIRED"])} for i, m in enumerate(models_names)]
    fa = [{"region": reg, "horizon": h, "mape_pct": round(_r.uniform(3, 15), 2), "rmse_aud": round(_r.uniform(8, 50), 2), "direction_accuracy_pct": round(_r.uniform(55, 85), 1)} for reg in ["NSW1", "QLD1", "VIC1", "SA1"] for h in ["5min", "30min", "1h", "4h", "24h"]]
    fi = [{"feature": f, "importance": round(_r.uniform(0.03, 0.22), 3), "direction": _r.choice(["positive", "negative"])} for f in ["Demand", "Gas Price", "Wind", "Solar", "Temperature", "Interconnector", "Coal Price", "Carbon Price"]]
    fva = [{"region": reg, "timestamp": f"2025-12-20T{h:02d}:00:00Z", "forecast_aud": round(_r.uniform(30, 200), 2), "actual_aud": round(_r.uniform(30, 200), 2)} for reg in ["NSW1", "QLD1", "VIC1"] for h in range(0, 24, 4)]
    ee = [{"event_type": t, "count": _r.randint(5, 40), "avg_forecast_error_pct": round(_r.uniform(15, 60), 1), "model_best": _r.choice(models_names[:3])} for t in ["Price Spike >$300", "Negative Price", "Sustained High", "Ramp Event"]]
    return {"models": models, "forecast_accuracy": fa, "feature_importance": fi, "forecast_vs_actual": fva, "extreme_events": ee, "summary": {"best_model": "Ensemble-v5", "avg_mape_pct": 8.4, "spike_detection_rate_pct": 68.0, "models_active": 4}}


@app.get("/api/volatility-regime/dashboard")
def volatility_regime_dashboard():
    _r.seed(7009)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    regimes = [{"regime_id": f"R-{i+1}", "region": reg, "regime_name": name, "avg_volatility_pct": round(_r.uniform(5, 80), 1), "avg_price_aud": round(_r.uniform(40, 300), 2), "duration_days": _r.randint(5, 120), "frequency_pct": round(_r.uniform(5, 40), 1), "current": _r.choice([True, False])} for i, (reg, name) in enumerate([(r, n) for r in regions for n in ["Low Vol", "Normal", "High Vol", "Extreme"]])]
    clusters = [{"region": reg, "cluster_id": _r.randint(1, 5), "volatility_pct": round(_r.uniform(5, 90), 1), "price_range_aud": round(_r.uniform(20, 500), 2), "observations": _r.randint(100, 2000)} for reg in regions for _ in range(4)]
    hedging = [{"regime": n, "recommended_hedge_ratio_pct": round(_r.uniform(50, 100), 0), "instrument": _r.choice(["Swap", "Cap", "Collar"]), "cost_aud_mwh": round(_r.uniform(2, 20), 2)} for n in ["Low Vol", "Normal", "High Vol", "Extreme"]]
    trans = [{"from_regime": f, "to_regime": t, "probability_pct": round(_r.uniform(5, 40), 1), "avg_transition_days": _r.randint(1, 30)} for f in ["Low Vol", "Normal", "High Vol"] for t in ["Normal", "High Vol", "Extreme"] if f != t]
    return {"timestamp": _dt.utcnow().isoformat() + "Z", "regimes": regimes, "clusters": clusters, "hedging": hedging, "transitions": trans}


# =========================================================================
# BATCH: Futures endpoints (5)
# =========================================================================

@app.get("/api/futures/dashboard")
def futures_dashboard(region: str = "NSW1"):
    _r.seed(7010)
    qtrs = ["Q1-2026", "Q2-2026", "Q3-2026", "Q4-2026", "Q1-2027", "Q2-2027"]
    contracts = [{"contract_code": f"BL-{region}-{q}", "region": region, "contract_type": _r.choice(["Base", "Peak"]), "year": int(q.split("-")[1]), "quarter": int(q[1]), "settlement_price": round(_r.uniform(50, 180), 2), "peak_price": round(_r.uniform(60, 250), 2), "change_1d": round(_r.uniform(-8, 8), 2), "change_1w": round(_r.uniform(-15, 15), 2), "open_interest": _r.randint(500, 5000), "volume_today": _r.randint(50, 800), "last_trade": "2025-12-20T14:30:00Z"} for q in qtrs]
    fc = [{"date": f"2026-{m:02d}-01", "base_price": round(_r.uniform(55, 170), 2), "peak_price": round(_r.uniform(70, 240), 2), "implied_volatility": round(_r.uniform(15, 55), 1)} for m in range(1, 13)]
    he = [{"hedge_type": ht, "region": region, "contract": f"BL-{region}-Q1-2026", "notional_mwh": _r.randint(10000, 100000), "hedge_price": round(_r.uniform(60, 150), 2), "spot_realised": round(_r.uniform(50, 200), 2), "pnl_aud": round(_r.uniform(-500000, 500000), 0), "effectiveness_pct": round(_r.uniform(60, 99), 1)} for ht in ["Swap", "Cap", "Collar", "Floor"]]
    return {"timestamp": _dt.utcnow().isoformat() + "Z", "region": region, "contracts": contracts, "forward_curve": fc, "hedge_effectiveness": he, "market_summary": {"avg_base_price": 95.4, "avg_peak_price": 142.1, "total_open_interest": 18500, "implied_vol_avg": 32.5}}


@app.get("/api/electricity-futures-options/dashboard")
def efot_dashboard():
    _r.seed(7011)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    contracts = [{"contract_id": f"EFOT-{i+1:04d}", "contract_type": _r.choice(["Base Swap", "Peak Swap", "Cap", "Asian Option"]), "region": reg, "delivery_year": _r.choice([2025, 2026]), "settlement_month": _r.randint(1, 12), "strike_price_mwh": round(_r.uniform(50, 200), 2), "market_price_mwh": round(_r.uniform(45, 220), 2), "open_interest_mwh": round(_r.uniform(10000, 200000), 0), "volume_traded_mwh": round(_r.uniform(1000, 50000), 0), "implied_volatility_pct": round(_r.uniform(15, 60), 1)} for i, reg in enumerate(regions * 3)]
    ohlc = [{"contract_id": f"EFOT-{_r.randint(1,12):04d}", "trade_date_offset": -d, "open_mwh": round(_r.uniform(60, 180), 2), "high_mwh": round(_r.uniform(70, 200), 2), "low_mwh": round(_r.uniform(50, 170), 2), "close_mwh": round(_r.uniform(55, 190), 2), "volume_mwh": round(_r.uniform(5000, 50000), 0), "vwap_mwh": round(_r.uniform(60, 185), 2)} for d in range(20)]
    hp = [{"program_id": f"HP-{i+1:03d}", "participant_name": p, "hedge_type": _r.choice(["Swap", "Cap", "Collar"]), "region": _r.choice(regions), "hedged_volume_twh": round(_r.uniform(1, 15), 1), "hedge_ratio_pct": round(_r.uniform(40, 95), 1), "avg_strike_mwh": round(_r.uniform(55, 160), 2), "portfolio_delta_mwh": round(_r.uniform(-5000, 5000), 0), "mark_to_market_m_aud": round(_r.uniform(-50, 80), 1), "var_95_m_aud": round(_r.uniform(5, 40), 1)} for i, p in enumerate(["AGL", "Origin", "EnergyAustralia", "Snowy Hydro", "Alinta"])]
    md = [{"region": reg, "contract_type": ct, "quarter": f"Q{q}", "year": 2026, "bid_volume_mwh": round(_r.uniform(5000, 50000), 0), "ask_volume_mwh": round(_r.uniform(5000, 50000), 0), "bid_ask_spread_mwh": round(_r.uniform(0.5, 5), 2), "market_maker_count": _r.randint(3, 10), "liquidity_score": round(_r.uniform(0.3, 0.95), 2)} for reg in regions for ct in ["Base", "Peak"] for q in [1, 2]]
    vol = [{"region": reg, "year": 2025, "month": m, "realised_vol_30d": round(_r.uniform(15, 70), 1), "implied_vol": round(_r.uniform(18, 65), 1), "vol_risk_premium_pct": round(_r.uniform(-5, 15), 1), "skew": round(_r.uniform(-0.5, 1.5), 2), "kurtosis": round(_r.uniform(2, 8), 2)} for reg in regions[:2] for m in range(1, 7)]
    return {"contracts": contracts, "daily_ohlc": ohlc, "hedging_programs": hp, "market_depth": md, "volatility": vol, "summary": {"total_open_interest_twh": 45.2, "avg_implied_volatility_pct": 34.8, "most_liquid_region": "NSW1", "total_hedging_volume_twh": 38.5, "avg_hedge_ratio_pct": 72.3, "var_95_portfolio_m_aud": 28.4, "active_contracts": 156}}


@app.get("/api/futures-market-risk/dashboard")
def futures_market_risk_dashboard():
    _r.seed(7012)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    var_recs = [{"date": f"2025-12-{d:02d}", "region": reg, "portfolio_type": pt, "notional_position_m_aud": round(_r.uniform(10, 200), 1), "var_95_m_aud": round(_r.uniform(1, 30), 1), "var_99_m_aud": round(_r.uniform(2, 45), 1), "cvar_95_m_aud": round(_r.uniform(2, 40), 1), "delta_mwh": round(_r.uniform(-50000, 50000), 0), "gamma": round(_r.uniform(-1, 1), 3), "vega": round(_r.uniform(0, 500), 1), "theta_daily_aud": round(_r.uniform(-5000, 0), 0)} for d in [15, 20] for reg in regions[:2] for pt in ["Generator", "Retailer"]]
    he = [{"quarter": f"Q{q}-2025", "region": reg, "participant": p, "hedge_ratio_pct": round(_r.uniform(50, 95), 1), "hedge_instrument": _r.choice(["Swap", "Cap", "Collar"]), "avg_hedge_price": round(_r.uniform(60, 150), 2), "avg_spot_price": round(_r.uniform(50, 180), 2), "hedge_gain_loss_m_aud": round(_r.uniform(-20, 30), 1), "effectiveness_score_pct": round(_r.uniform(60, 98), 1), "basis_risk_m_aud": round(_r.uniform(0.5, 8), 1)} for q in [3, 4] for reg in regions[:2] for p in ["AGL", "Origin"]]
    br = [{"region": reg, "year": 2025, "quarter": f"Q{q}", "futures_settlement_price": round(_r.uniform(60, 160), 2), "spot_price_avg": round(_r.uniform(55, 170), 2), "basis_aud_mwh": round(_r.uniform(-15, 15), 2), "basis_volatility": round(_r.uniform(5, 25), 1), "max_basis_aud_mwh": round(_r.uniform(10, 40), 2), "min_basis_aud_mwh": round(_r.uniform(-40, -5), 2), "risk_exposure_m_aud": round(_r.uniform(1, 15), 1)} for reg in regions for q in [3, 4]]
    fp = [{"participant": p, "participant_type": pt, "region": _r.choice(regions), "contract_quarter": f"Q1-2026", "long_position_mw": round(_r.uniform(0, 2000), 0), "short_position_mw": round(_r.uniform(0, 2000), 0), "net_position_mw": round(_r.uniform(-1500, 1500), 0), "avg_entry_price": round(_r.uniform(60, 150), 2), "mark_to_market_m_aud": round(_r.uniform(-30, 30), 1), "margin_posted_m_aud": round(_r.uniform(5, 50), 1)} for p, pt in [("AGL", "Gentailer"), ("Origin", "Gentailer"), ("Snowy", "Generator"), ("Shell", "Trader"), ("Macquarie", "Financial")]]
    return {"timestamp": _dt.utcnow().isoformat() + "Z", "var_records": var_recs, "hedge_effectiveness": he, "basis_risk": br, "futures_positions": fp, "portfolio_var_95_m_aud": 42.8, "avg_hedge_ratio_pct": 74.5, "total_open_interest_mw": 18200, "avg_basis_risk_aud_mwh": 6.3}


@app.get("/api/futures-price-discovery/dashboard")
def futures_price_discovery_dashboard():
    _r.seed(7013)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    ts = [{"region": reg, "contract_month": f"2026-{m:02d}", "product": _r.choice(["Base", "Peak"]), "settlement_price_aud_mwh": round(_r.uniform(55, 180), 2), "open_interest_lots": _r.randint(100, 3000), "daily_volume_lots": _r.randint(10, 500), "implied_vol_pct": round(_r.uniform(15, 55), 1), "days_to_expiry": _r.randint(30, 365)} for reg in regions for m in range(1, 7)]
    basis = [{"region": reg, "month": f"2025-{m:02d}", "futures_price": round(_r.uniform(60, 160), 2), "spot_price": round(_r.uniform(55, 170), 2), "basis_aud": round(_r.uniform(-15, 20), 2), "basis_pct": round(_r.uniform(-10, 15), 2), "convergence_trend": _r.choice(["Converging", "Diverging", "Stable"]), "seasonal_factor": _r.choice(["Summer Premium", "Winter Lift", "Shoulder Dip", "Neutral"])} for reg in regions[:3] for m in range(7, 13)]
    carry = [{"region": reg, "near_contract": "Q4-2025", "far_contract": "Q1-2026", "carry_cost_aud": round(_r.uniform(-5, 15), 2), "storage_premium_aud": round(_r.uniform(0, 3), 2), "risk_premium_aud": round(_r.uniform(1, 10), 2), "convenience_yield_pct": round(_r.uniform(0, 8), 2)} for reg in regions]
    cs = [{"region": reg, "snapshot_date": "2025-12-20", "curve_shape": _r.choice(["Contango", "Backwardation", "Flat"]), "q1_price": round(_r.uniform(60, 140), 2), "q2_price": round(_r.uniform(55, 130), 2), "q3_price": round(_r.uniform(70, 160), 2), "q4_price": round(_r.uniform(65, 150), 2), "annual_slope_pct": round(_r.uniform(-15, 20), 2), "inflection_quarter": _r.choice(["Q1", "Q2", "Q3", "Q4"])} for reg in regions]
    return {"timestamp": _dt.utcnow().isoformat() + "Z", "term_structures": ts, "basis_records": basis, "carry_records": carry, "curve_shapes": cs}


@app.get("/api/electricity-options/dashboard")
def eov_dashboard():
    _r.seed(7014)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    ob = [{"option_id": f"OPT-{i+1:04d}", "underlying": f"BL-{reg}-Q1-2026", "region": reg, "expiry": "2026-03-31", "strike_per_mwh": round(_r.uniform(50, 200), 2), "option_type": _r.choice(["Call", "Put"]), "premium_per_mwh": round(_r.uniform(2, 30), 2), "delta": round(_r.uniform(-1, 1), 3), "gamma": round(_r.uniform(0, 0.05), 4), "theta": round(_r.uniform(-2, 0), 3), "vega": round(_r.uniform(0, 50), 2), "implied_vol_pct": round(_r.uniform(15, 60), 1), "moneyness": _r.choice(["ITM", "ATM", "OTM"]), "open_interest_mwh": round(_r.uniform(5000, 100000), 0)} for i, reg in enumerate(regions * 4)]
    vs = [{"tenor_months": t, "strike_pct_atm": s, "implied_vol_pct": round(_r.uniform(15, 65), 1), "region": reg} for t in [1, 3, 6, 12] for s in [80, 90, 100, 110, 120] for reg in regions[:2]]
    strats = [{"strategy_name": sn, "strategy_type": st, "legs": _r.randint(1, 4), "max_profit_per_mwh": round(_r.uniform(5, 50), 2), "max_loss_per_mwh": round(_r.uniform(2, 30), 2), "breakeven_low": round(_r.uniform(50, 90), 2), "breakeven_high": round(_r.uniform(110, 200), 2), "net_premium": round(_r.uniform(-10, 15), 2), "use_case": uc, "suitability": _r.choice(["Generator", "Retailer", "Trader"])} for sn, st, uc in [("Bull Call Spread", "Vertical", "Upside protection"), ("Bear Put Spread", "Vertical", "Downside hedge"), ("Collar", "Combination", "Range bound"), ("Straddle", "Volatility", "Vol play"), ("Cap", "Single", "Price ceiling")]]
    hv = [{"date": f"2025-{m:02d}-15", "region": reg, "realized_vol_30d": round(_r.uniform(15, 70), 1), "realized_vol_90d": round(_r.uniform(18, 55), 1), "implied_vol": round(_r.uniform(18, 65), 1), "vol_risk_premium": round(_r.uniform(-5, 15), 1)} for reg in regions[:3] for m in range(1, 13)]
    return {"options_book": ob, "vol_surface": vs, "strategies": strats, "hist_vol": hv, "summary": {"total_open_interest_gwh": 2.4, "avg_implied_vol_pct": 35.2, "put_call_ratio": 0.85, "most_traded_strike": 100}}


# =========================================================================
# BATCH: Hedging endpoints (10)
# =========================================================================

@app.get("/api/electricity-price-risk/dashboard")
def eprm_dashboard():
    _r.seed(7015)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    participants = ["AGL", "Origin", "EnergyAustralia", "Snowy Hydro", "Alinta"]
    portfolios = [{"portfolio_id": f"PF-{i+1:03d}", "entity_name": p, "entity_type": _r.choice(["Gentailer", "Generator", "Retailer"]), "region": regions[i % 4], "total_load_twh": round(_r.uniform(5, 30), 1), "total_generation_twh": round(_r.uniform(5, 35), 1), "net_position_twh": round(_r.uniform(-10, 10), 1), "hedge_ratio_pct": round(_r.uniform(50, 95), 1), "open_position_twh": round(_r.uniform(0.5, 8), 1), "var_95_m": round(_r.uniform(10, 80), 1), "cvar_95_m": round(_r.uniform(15, 100), 1), "max_loss_scenario_m": round(_r.uniform(30, 200), 1)} for i, p in enumerate(participants)]
    hedges = [{"hedge_id": f"H-{i+1:04d}", "portfolio_id": f"PF-{(i%5)+1:03d}", "product_type": _r.choice(["Swap", "Cap", "Collar", "Floor"]), "region": _r.choice(regions), "volume_mw": round(_r.uniform(50, 500), 0), "strike_price_dolpermwh": round(_r.uniform(50, 180), 2), "market_price_dolpermwh": round(_r.uniform(45, 200), 2), "start_date": "2025-07-01", "end_date": "2026-06-30", "mtm_value_m": round(_r.uniform(-20, 30), 1), "premium_paid_m": round(_r.uniform(0.5, 10), 1), "hedge_effectiveness_pct": round(_r.uniform(60, 99), 1), "counterparty": _r.choice(["Macquarie", "Shell", "BP", "Trafigura"])} for i in range(15)]
    var_recs = [{"var_id": f"V-{i+1:03d}", "portfolio_id": f"PF-{(i%5)+1:03d}", "calculation_date": "2025-12-20", "methodology": _r.choice(["Historical", "Monte Carlo", "Parametric"]), "confidence_level_pct": cl, "time_horizon_days": _r.choice([1, 10, 30]), "var_m": round(_r.uniform(5, 60), 1), "cvar_m": round(_r.uniform(8, 80), 1), "scenario_99_m": round(_r.uniform(15, 120), 1), "stressed_var_m": round(_r.uniform(20, 150), 1), "correlation_risk_m": round(_r.uniform(1, 15), 1), "basis_risk_m": round(_r.uniform(0.5, 10), 1)} for i, cl in enumerate([95, 99] * 5)]
    scenarios = [{"scenario_id": f"SC-{i+1:02d}", "scenario_name": s, "year": 2026, "avg_price_dolpermwh": round(_r.uniform(40, 300), 2), "peak_price_dolpermwh": round(_r.uniform(100, 2000), 2), "price_vol_pct": round(_r.uniform(20, 80), 1), "portfolio_pnl_m": round(_r.uniform(-200, 100), 1), "hedge_benefit_m": round(_r.uniform(0, 80), 1), "worst_30day_loss_m": round(_r.uniform(10, 150), 1)} for i, s in enumerate(["Base", "High Gas", "Drought", "Renewable Surge", "Demand Spike"])]
    corr = [{"correlation_id": f"CR-{i+1:02d}", "factor_pair": fp, "correlation_coefficient": round(_r.uniform(-0.8, 0.95), 2), "r_squared": round(_r.uniform(0.1, 0.9), 2), "lag_days": _r.randint(0, 5), "data_period_years": 5, "statistical_significance": True, "hedging_implication": _r.choice(["Natural hedge", "Basis risk", "Diversification benefit"])} for i, fp in enumerate(["Gas-Elec", "Wind-Price", "Solar-Demand", "Temp-Demand", "Coal-Elec", "Carbon-Elec"])]
    reg_cap = [{"capital_id": f"RC-{i+1:02d}", "entity_name": p, "regulatory_framework": "AEMO Prudential", "capital_requirement_m": round(_r.uniform(20, 200), 0), "current_capital_m": round(_r.uniform(25, 250), 0), "coverage_ratio_pct": round(_r.uniform(100, 180), 1), "liquidity_buffer_m": round(_r.uniform(5, 50), 0), "stressed_requirement_m": round(_r.uniform(30, 300), 0), "compliance_status": _r.choice(["Compliant", "Compliant", "Watch"]), "review_date": "2026-03-31"} for i, p in enumerate(participants)]
    return {"portfolios": portfolios, "hedges": hedges, "var_records": var_recs, "scenarios": scenarios, "correlations": corr, "regulatory_capital": reg_cap, "summary": {"total_var_95_m": 185, "avg_hedge_ratio_pct": 74, "total_open_positions_twh": 22}}


@app.get("/api/energy-market-credit-risk-x/dashboard")
def emcrx_dashboard():
    _r.seed(7016)
    ptypes = ["Gentailer", "Generator", "Retailer", "Trader", "Financial"]
    participants = [{"participant_name": p, "participant_type": pt, "credit_rating": _r.choice(["AAA", "AA", "A", "BBB", "BB"]), "credit_outlook": _r.choice(["Stable", "Positive", "Negative"]), "prudential_requirement_m": round(_r.uniform(20, 300), 0), "credit_support_lodged_m": round(_r.uniform(25, 350), 0), "net_market_exposure_m": round(_r.uniform(5, 150), 0), "leverage_ratio_pct": round(_r.uniform(20, 70), 1), "interest_coverage": round(_r.uniform(2, 10), 1)} for p, pt in [("AGL", "Gentailer"), ("Origin", "Gentailer"), ("EnergyAustralia", "Retailer"), ("Snowy Hydro", "Generator"), ("Shell Energy", "Trader"), ("Macquarie", "Financial"), ("Alinta", "Generator")]]
    exposures = [{"quarter": f"Q{q}-2025", "region": reg, "participant_type": pt, "total_market_exposure_m": round(_r.uniform(50, 500), 0), "unsecured_exposure_m": round(_r.uniform(5, 80), 0), "collateral_coverage_pct": round(_r.uniform(80, 150), 1), "largest_single_exposure_m": round(_r.uniform(10, 100), 0), "concentration_risk_score": round(_r.uniform(0.2, 0.8), 2)} for q in [3, 4] for reg in ["NSW1", "QLD1", "VIC1"] for pt in ptypes[:3]]
    defaults = [{"year": y, "event_type": _r.choice(["Payment Default", "Margin Call Failure", "Insolvency"]), "participant_type": _r.choice(ptypes[:3]), "default_amount_m": round(_r.uniform(5, 200), 0), "recovery_pct": round(_r.uniform(20, 85), 1), "days_to_resolution": _r.randint(30, 365), "aemo_intervention": _r.choice([True, False])} for y in [2020, 2021, 2022, 2023, 2024]]
    prud = [{"metric_name": mn, "region": _r.choice(["NSW1", "QLD1", "VIC1"]), "quarter": f"Q4-2025", "avg_value": round(_r.uniform(50, 200), 1), "threshold_value": round(_r.uniform(80, 250), 1), "breach_count": _r.randint(0, 5), "trend": _r.choice(["Improving", "Stable", "Deteriorating"])} for mn in ["MCL", "Trading Limit", "Prudential Margin", "Reallocation Limit"]]
    stress = [{"scenario": s, "region": _r.choice(["NSW1", "QLD1", "VIC1"]), "total_exposure_m": round(_r.uniform(200, 2000), 0), "potential_default_m": round(_r.uniform(10, 300), 0), "systemic_risk_score": round(_r.uniform(0.1, 0.9), 2), "recovery_fund_adequacy_pct": round(_r.uniform(60, 150), 1), "mitigation_available": _r.choice([True, True, False])} for s in ["Extreme Price", "Participant Failure", "Correlated Default", "Liquidity Crisis"]]
    return {"participants": participants, "exposures": exposures, "default_history": defaults, "prudential_metrics": prud, "stress_tests": stress, "summary": {"total_market_exposure_m": 2800, "avg_credit_rating": "A", "breach_count_ytd": 3}}


@app.get("/api/hedge-effectiveness/dashboard")
def hef_dashboard():
    _r.seed(7017)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    companies = ["AGL", "Origin", "EnergyAustralia", "Snowy Hydro"]
    positions = [{"portfolio_id": f"PF-{i+1:03d}", "company": c, "region": regions[i % 4], "contract_type": _r.choice(["Swap", "Cap", "Collar", "Floor"]), "position": _r.choice(["Long", "Short"]), "notional_mw": round(_r.uniform(50, 500), 0), "strike_price": round(_r.uniform(55, 170), 2), "market_price": round(_r.uniform(50, 190), 2), "mtm_value_m": round(_r.uniform(-15, 20), 1), "delta": round(_r.uniform(-1, 1), 3), "gamma": round(_r.uniform(-0.02, 0.02), 4), "vega": round(_r.uniform(0, 30), 2), "expiry": "2026-03-31"} for i, c in enumerate(companies * 3)]
    basis = [{"region": reg, "hedge_region": hreg, "quarter": f"Q{q}-2025", "spot_price_hedge_region": round(_r.uniform(50, 160), 2), "spot_price_physical_region": round(_r.uniform(50, 170), 2), "basis_differential": round(_r.uniform(-20, 20), 2), "basis_risk_pct": round(_r.uniform(2, 15), 1), "correlation": round(_r.uniform(0.7, 0.99), 3), "avg_interconnector_constraint_hrs": _r.randint(0, 200)} for reg in regions[:2] for hreg in regions[2:4] for q in [3, 4]]
    pnl = [{"month": f"2025-{m:02d}", "portfolio_id": f"PF-{(m%4)+1:03d}", "physical_pnl_m": round(_r.uniform(-10, 15), 1), "hedge_pnl_m": round(_r.uniform(-8, 12), 1), "net_pnl_m": round(_r.uniform(-5, 10), 1), "hedge_ratio_pct": round(_r.uniform(60, 95), 1), "var_95_m": round(_r.uniform(3, 20), 1), "cvar_95_m": round(_r.uniform(5, 25), 1), "realized_vol_annualized": round(_r.uniform(15, 60), 1)} for m in range(1, 13)]
    hr = [{"company": c, "region": reg, "quarter": f"Q{q}-2025", "optimal_hedge_ratio": round(_r.uniform(70, 95), 1), "actual_hedge_ratio": round(_r.uniform(55, 100), 1), "deviation_from_optimal_pct": round(_r.uniform(-15, 15), 1), "cost_of_over_hedging_m": round(_r.uniform(0, 5), 1), "cost_of_under_hedging_m": round(_r.uniform(0, 8), 1), "recommendation": _r.choice(["Maintain", "Increase Hedge", "Reduce Hedge"])} for c in companies[:2] for reg in regions[:2] for q in [3, 4]]
    rp = [{"year": y, "region": reg, "avg_annual_spot_price": round(_r.uniform(50, 150), 2), "avg_hedge_price": round(_r.uniform(55, 140), 2), "hedge_premium_pct": round(_r.uniform(-5, 15), 1), "hedge_savings_m": round(_r.uniform(-20, 50), 1), "unhedged_cost_m": round(_r.uniform(100, 500), 0), "hedged_cost_m": round(_r.uniform(80, 450), 0), "effectiveness_pct": round(_r.uniform(60, 98), 1)} for y in [2021, 2022, 2023, 2024, 2025] for reg in regions[:2]]
    return {"positions": positions, "basis_risk": basis, "pnl_attribution": pnl, "hedge_ratios": hr, "rolling_performance": rp, "summary": {"avg_effectiveness_pct": 82.5, "total_hedge_savings_m": 145, "optimal_ratio_deviation_pct": 4.2}}


@app.get("/api/market-power/dashboard")
def market_power_dashboard():
    _r.seed(7018)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    fuel_types = ["Black Coal", "Gas", "Hydro", "Wind", "Solar", "Battery"]
    hhi = [{"region": reg, "fuel_type": ft, "hhi_score": _r.randint(800, 3500), "num_competitors": _r.randint(3, 15), "top3_share_pct": round(_r.uniform(40, 90), 1), "market_structure": _r.choice(["Competitive", "Moderately Concentrated", "Highly Concentrated"]), "trend_direction": _r.choice(["Improving", "Stable", "Worsening"]), "change_vs_last_year": round(_r.uniform(-200, 200), 0)} for reg in regions for ft in fuel_types[:3]]
    pivotal = [{"participant_id": f"GEN-{i+1:03d}", "participant_name": p, "region": _r.choice(regions[:4]), "pivotal_status": _r.choice(["Pivotal", "Quasi-Pivotal", "Non-Pivotal"]), "capacity_mw": round(_r.uniform(1000, 8000), 0), "residual_supply_index": round(_r.uniform(0.8, 1.5), 2), "occurrence_frequency_pct": round(_r.uniform(5, 60), 1), "strategic_capacity_mw": round(_r.uniform(200, 3000), 0), "avg_rebids_per_day": round(_r.uniform(1, 15), 1)} for i, p in enumerate(["AGL", "Origin", "EnergyAustralia", "Snowy Hydro", "CS Energy", "Stanwell", "Alinta"])]
    trends = [{"participant_name": p, "participant_type": _r.choice(["Gentailer", "Generator"]), "year": y, "quarter": f"Q{q}", "generation_share_pct": round(_r.uniform(5, 25), 1), "retail_share_pct": round(_r.uniform(5, 30), 1), "capacity_mw": round(_r.uniform(2000, 10000), 0)} for p in ["AGL", "Origin", "EnergyAustralia", "Snowy Hydro"] for y in [2024, 2025] for q in [1, 2, 3, 4]]
    return {"timestamp": _dt.utcnow().isoformat() + "Z", "nem_overall_hhi": 1850, "sa1_hhi": 2800, "concentration_trend": "Moderately Concentrated", "pivotal_suppliers_count": 3, "quasi_pivotal_count": 2, "market_review_status": "Under Review", "hhi_records": hhi, "pivotal_suppliers": pivotal, "share_trends": trends}


@app.get("/api/hedging/dashboard")
def hedging_main_dashboard():
    _r.seed(7019)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    contracts = [{"contract_id": f"HC-{i+1:04d}", "contract_type": _r.choice(["Swap", "Cap", "Collar", "Floor", "Asian Option"]), "region": _r.choice(regions), "counterparty": _r.choice(["Macquarie", "Shell", "BP", "Trafigura", "Origin"]), "start_date": "2025-07-01", "end_date": "2026-06-30", "strike_price": round(_r.uniform(50, 180), 2), "volume_mw": round(_r.uniform(20, 500), 0), "volume_mwh": round(_r.uniform(50000, 2000000), 0), "premium_paid_aud": round(_r.uniform(50000, 2000000), 0), "mtm_value_aud": round(_r.uniform(-500000, 800000), 0), "pnl_aud": round(_r.uniform(-300000, 500000), 0), "hedge_period": f"Q{_r.randint(1,4)}-2026", "status": _r.choice(["Active", "Active", "Expired"]), "underlying": f"BL-{_r.choice(regions)}"} for i in range(20)]
    portfolio = [{"region": reg, "total_hedged_mw": round(_r.uniform(500, 3000), 0), "expected_generation_mw": round(_r.uniform(600, 4000), 0), "hedge_ratio_pct": round(_r.uniform(50, 95), 1), "avg_swap_price": round(_r.uniform(60, 140), 2), "mtm_total_aud": round(_r.uniform(-2000000, 5000000), 0), "unrealised_pnl_aud": round(_r.uniform(-1000000, 3000000), 0), "var_95_aud": round(_r.uniform(500000, 5000000), 0), "var_99_aud": round(_r.uniform(800000, 8000000), 0), "cap_protection_pct": round(_r.uniform(30, 80), 1), "num_active_contracts": _r.randint(5, 25)} for reg in regions]
    qp = [{"quarter": f"Q{q}-2026", "hedged_mw": round(_r.uniform(1000, 5000), 0), "spot_ref": round(_r.uniform(60, 150), 2), "contract_price": round(_r.uniform(55, 140), 2)} for q in [1, 2, 3, 4]]
    return {"timestamp": _dt.utcnow().isoformat() + "Z", "total_portfolio_mtm_aud": 4850000, "total_unrealised_pnl_aud": 2100000, "portfolio_var_95_aud": 8500000, "weighted_avg_hedge_price": 92.5, "overall_hedge_ratio_pct": 74.2, "contracts": contracts, "portfolio_by_region": portfolio, "quarterly_position": qp}


@app.get("/api/hedging/contracts")
def hedging_contracts(region: str = None, contract_type: str = None, status: str = None):
    _r.seed(7020)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    contracts = [{"contract_id": f"HC-{i+1:04d}", "contract_type": _r.choice(["Swap", "Cap", "Collar", "Floor"]), "region": _r.choice(regions), "counterparty": _r.choice(["Macquarie", "Shell", "BP", "Trafigura"]), "start_date": "2025-07-01", "end_date": "2026-06-30", "strike_price": round(_r.uniform(50, 180), 2), "volume_mw": round(_r.uniform(20, 500), 0), "volume_mwh": round(_r.uniform(50000, 2000000), 0), "premium_paid_aud": round(_r.uniform(50000, 2000000), 0), "mtm_value_aud": round(_r.uniform(-500000, 800000), 0), "pnl_aud": round(_r.uniform(-300000, 500000), 0), "hedge_period": f"Q{_r.randint(1,4)}-2026", "status": _r.choice(["Active", "Active", "Expired"]), "underlying": f"BL-{_r.choice(regions)}"} for i in range(25)]
    if region:
        contracts = [c for c in contracts if c["region"] == region]
    if contract_type:
        contracts = [c for c in contracts if c["contract_type"] == contract_type]
    if status:
        contracts = [c for c in contracts if c["status"] == status]
    return contracts


@app.get("/api/hedging/portfolio")
def hedging_portfolio(region: str = None):
    _r.seed(7021)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    portfolio = [{"region": reg, "total_hedged_mw": round(_r.uniform(500, 3000), 0), "expected_generation_mw": round(_r.uniform(600, 4000), 0), "hedge_ratio_pct": round(_r.uniform(50, 95), 1), "avg_swap_price": round(_r.uniform(60, 140), 2), "mtm_total_aud": round(_r.uniform(-2000000, 5000000), 0), "unrealised_pnl_aud": round(_r.uniform(-1000000, 3000000), 0), "var_95_aud": round(_r.uniform(500000, 5000000), 0), "var_99_aud": round(_r.uniform(800000, 8000000), 0), "cap_protection_pct": round(_r.uniform(30, 80), 1), "num_active_contracts": _r.randint(5, 25)} for reg in regions]
    if region:
        portfolio = [p for p in portfolio if p["region"] == region]
    return portfolio


@app.get("/api/nem-participant-financial/dashboard")
def npfp_dashboard():
    _r.seed(7022)
    participants_data = [("AGL", "Gentailer", "NSW1", 22.5), ("Origin", "Gentailer", "QLD1", 18.3), ("EnergyAustralia", "Retailer", "VIC1", 15.1), ("Snowy Hydro", "Generator", "NSW1", 12.8), ("CS Energy", "Generator", "QLD1", 8.2), ("Stanwell", "Generator", "QLD1", 7.5), ("Alinta", "Generator", "SA1", 5.4)]
    parts = [{"participant_id": f"P-{i+1:03d}", "participant_name": p, "participant_type": pt, "region": reg, "market_share_pct": ms} for i, (p, pt, reg, ms) in enumerate(participants_data)]
    rev = [{"participant_id": f"P-{i+1:03d}", "year": y, "quarter": f"Q{q}", "trading_revenue_m_aud": round(_r.uniform(200, 2000), 0), "fcas_revenue_m_aud": round(_r.uniform(10, 150), 0), "capacity_revenue_m_aud": round(_r.uniform(0, 50), 0), "hedge_pnl_m_aud": round(_r.uniform(-100, 200), 0), "total_revenue_m_aud": round(_r.uniform(200, 2200), 0)} for i in range(7) for y in [2024, 2025] for q in [1, 2, 3, 4]]
    costs = [{"participant_id": f"P-{i+1:03d}", "year": y, "fuel_cost_m_aud": round(_r.uniform(50, 800), 0), "opex_m_aud": round(_r.uniform(30, 300), 0), "carbon_cost_m_aud": round(_r.uniform(5, 100), 0), "network_charges_m_aud": round(_r.uniform(10, 200), 0), "ebitda_m_aud": round(_r.uniform(50, 500), 0), "ebitda_margin_pct": round(_r.uniform(8, 35), 1)} for i in range(7) for y in [2024, 2025]]
    risk = [{"participant_id": f"P-{i+1:03d}", "year": 2025, "value_at_risk_m_aud": round(_r.uniform(10, 100), 0), "credit_exposure_m_aud": round(_r.uniform(20, 200), 0), "hedge_ratio_pct": round(_r.uniform(50, 95), 1), "liquidity_ratio": round(_r.uniform(1.2, 3.5), 1)} for i in range(7)]
    return {"participants": parts, "revenue": rev, "costs": costs, "risk": risk, "summary": {"total_participants": 7, "total_market_revenue_m_aud": 28500, "avg_ebitda_margin_pct": 18.5, "most_profitable_participant": "AGL"}}


@app.get("/api/energy-retailer-hedging/dashboard")
def erha_dashboard():
    _r.seed(7023)
    retailers = ["AGL Retail", "Origin Retail", "EnergyAustralia", "Simply Energy", "Red Energy"]
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    hb = [{"retailer": ret, "region": reg, "contract_type": _r.choice(["Swap", "Cap", "Collar"]), "year": 2025, "quarter": _r.randint(1, 4), "hedge_volume_gwh": round(_r.uniform(0.5, 10), 1), "hedge_price_aud_mwh": round(_r.uniform(55, 150), 2), "market_price_aud_mwh": round(_r.uniform(50, 170), 2), "mtm_value_m": round(_r.uniform(-10, 15), 1), "hedge_ratio_pct": round(_r.uniform(50, 95), 1)} for ret in retailers[:3] for reg in regions[:3]]
    ce = [{"retailer": ret, "counterparty": cp, "contract_type": _r.choice(["Swap", "Cap"]), "notional_value_m": round(_r.uniform(10, 200), 0), "credit_rating": _r.choice(["AAA", "AA", "A", "BBB"]), "exposure_m": round(_r.uniform(2, 50), 0), "collateral_posted_m": round(_r.uniform(1, 30), 0)} for ret in retailers[:3] for cp in ["Macquarie", "Shell", "BP"]]
    hc = [{"retailer": ret, "region": reg, "year": 2025, "total_premium_m": round(_r.uniform(5, 50), 0), "realized_pnl_m": round(_r.uniform(-20, 30), 0), "unrealized_pnl_m": round(_r.uniform(-15, 25), 0), "hedging_cost_aud_mwh": round(_r.uniform(3, 15), 2)} for ret in retailers[:3] for reg in regions[:2]]
    vm = [{"region": reg, "year": 2025, "quarter": q, "spot_price_volatility_pct": round(_r.uniform(20, 80), 1), "implied_vol_cap_pct": round(_r.uniform(25, 70), 1), "hist_vol_30d_pct": round(_r.uniform(15, 65), 1), "var_95_m": round(_r.uniform(5, 40), 1)} for reg in regions for q in [1, 2, 3, 4]]
    st = [{"retailer": ret, "scenario": s, "region": _r.choice(regions), "pnl_impact_m": round(_r.uniform(-50, 20), 1), "hedge_effectiveness_pct": round(_r.uniform(50, 95), 1)} for ret in retailers[:3] for s in ["Price Spike", "Prolonged High", "Demand Surge"]]
    return {"hedge_book": hb, "counterparty_exposure": ce, "hedging_costs": hc, "volatility_metrics": vm, "stress_tests": st, "summary": {"total_hedge_book_value_m": 850, "avg_hedge_ratio_pct": 72.5, "total_counterparty_exposure_m": 320, "avg_hedging_cost_aud_mwh": 8.4, "max_var_95_m": 35.2}}


@app.get("/api/voll-analytics/dashboard")
def voll_analytics_dashboard():
    _r.seed(7024)
    voll = [{"year": y, "methodology": m, "residential_voll_aud_mwh": round(_r.uniform(15000, 40000), 0), "commercial_voll_aud_mwh": round(_r.uniform(30000, 80000), 0), "industrial_voll_aud_mwh": round(_r.uniform(10000, 50000), 0), "weighted_avg_voll_aud_mwh": round(_r.uniform(20000, 55000), 0), "nem_regulatory_voll_aud_mwh": round(_r.uniform(15000, 17500), 0), "review_body": _r.choice(["AEMC", "AEMO", "AER"])} for y in [2020, 2022, 2024] for m in ["SURVEY", "REVEALED_PREFERENCE", "HYBRID"]]
    oc = [{"year": y, "region": reg, "total_outage_hours": round(_r.uniform(10, 200), 0), "customers_affected_k": round(_r.uniform(5, 500), 0), "total_economic_cost_m_aud": round(_r.uniform(10, 500), 0), "residential_cost_m_aud": round(_r.uniform(3, 150), 0), "commercial_cost_m_aud": round(_r.uniform(5, 200), 0), "industrial_cost_m_aud": round(_r.uniform(2, 150), 0), "direct_cost_pct": round(_r.uniform(50, 80), 0), "indirect_cost_pct": round(_r.uniform(20, 50), 0)} for y in [2023, 2024, 2025] for reg in ["NSW1", "QLD1", "VIC1", "SA1"]]
    sectors = [{"sector": s, "avg_outage_cost_aud_hour": round(_r.uniform(5000, 200000), 0), "outage_sensitivity": sens, "critical_threshold_min": _r.randint(1, 120), "annual_exposure_m_aud": round(_r.uniform(10, 500), 0), "backup_power_adoption_pct": round(_r.uniform(10, 90), 0)} for s, sens in [("Data Centres", "HIGH"), ("Manufacturing", "HIGH"), ("Healthcare", "HIGH"), ("Retail", "MEDIUM"), ("Agriculture", "MEDIUM"), ("Residential", "LOW"), ("Government", "LOW")]]
    rv = [{"region": reg, "current_saidi_min": round(_r.uniform(60, 200), 0), "target_saidi_min": round(_r.uniform(40, 150), 0), "improvement_cost_m_aud": round(_r.uniform(50, 500), 0), "customers_benefited_k": round(_r.uniform(100, 2000), 0), "voll_saved_m_aud": round(_r.uniform(20, 300), 0), "benefit_cost_ratio": round(_r.uniform(0.5, 3.5), 1)} for reg in ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]]
    return {"timestamp": _dt.utcnow().isoformat() + "Z", "voll_estimates": voll, "outage_costs": oc, "industry_sectors": sectors, "reliability_values": rv}


# =========================================================================
# BATCH: Settlement endpoints (9)
# =========================================================================

@app.get("/api/nem-five-minute-settlement/dashboard")
def nfms_dashboard():
    _r.seed(7025)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    intervals = [{"region": reg, "interval_end": f"2025-12-20T{h:02d}:{m:02d}:00Z", "dispatch_price_aud": round(_r.uniform(-50, 500), 2), "energy_mwh": round(_r.uniform(1000, 8000), 0), "demand_mw": round(_r.uniform(3000, 14000), 0)} for reg in regions[:3] for h in range(0, 24, 4) for m in [0, 5, 10]]
    generators = [{"generator_id": f"GEN-{i+1:03d}", "station_name": g, "region": _r.choice(regions[:4]), "fuel_type": ft, "capacity_mw": round(_r.uniform(100, 2800), 0), "output_mw": round(_r.uniform(50, 2500), 0), "revenue_5min_aud": round(_r.uniform(5000, 200000), 0)} for i, (g, ft) in enumerate([("Bayswater", "Black Coal"), ("Eraring", "Black Coal"), ("Loy Yang A", "Brown Coal"), ("Torrens Island", "Gas"), ("Snowy 2.0", "Hydro"), ("Hornsdale", "Wind"), ("Broken Hill Solar", "Solar")])]
    spikes = [{"region": reg, "timestamp": f"2025-{_r.randint(1,12):02d}-{_r.randint(1,28):02d}T{_r.randint(12,18):02d}:00:00Z", "price_aud": round(_r.uniform(300, 16600), 2), "duration_intervals": _r.randint(1, 12), "cause": _r.choice(["Generator Trip", "Demand Surge", "Interconnector Constraint", "Forecast Error"])} for reg in regions[:4] for _ in range(3)]
    batteries = [{"battery_name": b, "region": reg, "capacity_mw": cap, "revenue_5min_aud": round(_r.uniform(10000, 150000), 0), "cycles_today": _r.randint(1, 4), "avg_spread_aud": round(_r.uniform(30, 200), 2)} for b, reg, cap in [("Hornsdale Power Reserve", "SA1", 150), ("Victorian Big Battery", "VIC1", 300), ("Wallgrove", "NSW1", 50), ("Bouldercombe", "QLD1", 200)]]
    mi = [{"metric": m, "pre_5min_value": round(_r.uniform(10, 100), 1), "post_5min_value": round(_r.uniform(10, 100), 1), "change_pct": round(_r.uniform(-30, 50), 1)} for m in ["Price Volatility", "Battery Revenue", "Generator Ramping", "Demand Response", "Settlement Residue"]]
    return {"intervals": intervals, "generators": generators, "price_spikes": spikes, "batteries": batteries, "market_impact": mi, "summary": {"avg_5min_price_aud": 82.5, "max_5min_price_aud": 15800, "battery_total_revenue_aud": 420000, "price_spike_count": 12, "avg_demand_mw": 24500}}


@app.get("/api/aemo-5min-settlement/dashboard")
def aemo5m_dashboard():
    _r.seed(7026)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    dispatch = [{"region": reg, "interval": f"2025-12-20T{h:02d}:{m:02d}:00Z", "dispatch_price": round(_r.uniform(-30, 400), 2), "total_demand_mw": round(_r.uniform(3000, 14000), 0), "scheduled_gen_mw": round(_r.uniform(2000, 12000), 0), "semi_scheduled_gen_mw": round(_r.uniform(500, 4000), 0)} for reg in regions[:3] for h in [8, 12, 16, 20] for m in [0, 5]]
    settlement = [{"region": reg, "trading_interval": f"2025-12-20T{h:02d}:00:00Z", "rrp_aud_mwh": round(_r.uniform(30, 300), 2), "total_energy_mwh": round(_r.uniform(5000, 30000), 0), "settlement_amount_aud": round(_r.uniform(100000, 5000000), 0)} for reg in regions[:4] for h in range(0, 24, 6)]
    intervals_data = [{"region": reg, "date": "2025-12-20", "interval_count": 288, "avg_price_aud": round(_r.uniform(40, 120), 2), "min_price_aud": round(_r.uniform(-30, 20), 2), "max_price_aud": round(_r.uniform(200, 5000), 2), "price_std_dev": round(_r.uniform(20, 150), 2)} for reg in regions]
    compliance = [{"participant": p, "region": _r.choice(regions[:4]), "dispatch_conformance_pct": round(_r.uniform(90, 100), 1), "causer_pays_factor": round(_r.uniform(0.5, 2.0), 2), "non_conformance_count": _r.randint(0, 10)} for p in ["AGL", "Origin", "EnergyAustralia", "Snowy Hydro", "CS Energy"]]
    return {"dispatch": dispatch, "settlement": settlement, "intervals": intervals_data, "compliance": compliance, "summary": {"total_settlement_aud": 45000000, "avg_price_all_regions_aud": 78.5, "max_price_aud": 4800, "dispatch_intervals_today": 288, "non_conformance_events": 8}}


@app.get("/api/settlement-analytics/dashboard")
def settlement_analytics_dashboard():
    _r.seed(7027)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    settlements = [{"region": reg, "period": f"2025-{m:02d}", "total_settlement_m_aud": round(_r.uniform(100, 800), 0), "energy_settlement_m_aud": round(_r.uniform(80, 700), 0), "fcas_settlement_m_aud": round(_r.uniform(5, 50), 0), "participant_count": _r.randint(50, 200), "disputes_count": _r.randint(0, 5)} for reg in regions for m in range(7, 13)]
    prudential = [{"participant": p, "mcl_m_aud": round(_r.uniform(20, 400), 0), "trading_limit_m_aud": round(_r.uniform(15, 350), 0), "prudential_margin_m_aud": round(_r.uniform(5, 100), 0), "credit_support_m_aud": round(_r.uniform(10, 200), 0), "utilization_pct": round(_r.uniform(30, 95), 1)} for p in ["AGL", "Origin", "EnergyAustralia", "Snowy Hydro", "CS Energy", "Stanwell"]]
    shortfalls = [{"region": reg, "date": f"2025-{_r.randint(7,12):02d}-{_r.randint(1,28):02d}", "shortfall_mwh": round(_r.uniform(10, 500), 0), "cost_aud": round(_r.uniform(50000, 5000000), 0), "cause": _r.choice(["Generator Trip", "Forecast Error", "Interconnector Limit"])} for reg in regions[:4] for _ in range(2)]
    exposures = [{"participant": p, "region": _r.choice(regions[:4]), "gross_exposure_m_aud": round(_r.uniform(20, 300), 0), "net_exposure_m_aud": round(_r.uniform(5, 100), 0), "collateral_held_m_aud": round(_r.uniform(10, 150), 0)} for p in ["AGL", "Origin", "EnergyAustralia", "Snowy Hydro"]]
    return {"timestamp": _dt.utcnow().isoformat() + "Z", "settlements": settlements, "prudential": prudential, "shortfalls": shortfalls, "exposures": exposures}


@app.get("/api/transmission-congestion-revenue/dashboard")
def tcra_dashboard():
    _r.seed(7028)
    interconnectors = ["NSW1-QLD1", "VIC1-NSW1", "VIC1-SA1", "VIC1-TAS1", "NSW1-QLD1(DC)"]
    ir = [{"interconnector": ic, "year": y, "quarter": f"Q{q}", "total_revenue_m_aud": round(_r.uniform(5, 80), 1), "avg_flow_mw": round(_r.uniform(100, 1000), 0), "congestion_hours": _r.randint(50, 2000), "direction": _r.choice(["Southbound", "Northbound"])} for ic in interconnectors for y in [2024, 2025] for q in [3, 4]]
    cg = [{"constraint_group": cg_name, "region": _r.choice(["NSW1", "QLD1", "VIC1", "SA1"]), "binding_hours": _r.randint(100, 3000), "cost_m_aud": round(_r.uniform(5, 100), 1), "affected_generators": _r.randint(3, 20)} for cg_name in ["N-Q_NIL", "V-SA_NIL", "T-V_NIL", "System Normal", "Outage Related"]]
    rps = [{"region_pair": rp, "avg_price_diff_aud": round(_r.uniform(-30, 50), 2), "max_price_diff_aud": round(_r.uniform(50, 500), 2), "hours_diverged": _r.randint(500, 4000)} for rp in ["NSW1-QLD1", "VIC1-SA1", "VIC1-TAS1", "NSW1-VIC1"]]
    cc = [{"region": reg, "year": 2025, "congestion_cost_m_aud": round(_r.uniform(20, 200), 0), "as_pct_of_energy_cost": round(_r.uniform(1, 8), 1)} for reg in ["NSW1", "QLD1", "VIC1", "SA1"]]
    mp = [{"project": p, "interconnector": _r.choice(interconnectors[:3]), "capacity_increase_mw": _r.randint(100, 1000), "estimated_cost_m_aud": round(_r.uniform(200, 3000), 0), "expected_saving_m_aud_yr": round(_r.uniform(20, 200), 0), "status": _r.choice(["Planning", "Approved", "Construction"])} for p in ["HumeLink", "VNI West", "Marinus Link", "Sydney Ring", "QNI Medium"]]
    return {"interconnector_revenues": ir, "constraint_groups": cg, "regional_price_splits": rps, "congestion_costs": cc, "mitigation_projects": mp, "summary": {"total_congestion_revenue_m_aud": 450, "most_congested_interconnector": "NSW1-QLD1", "total_mitigation_investment_m_aud": 8500, "avg_price_divergence_hours": 2200}}


@app.get("/api/congestion-revenue/dashboard")
def congestion_revenue_dashboard():
    _r.seed(7029)
    interconnectors = ["NSW1-QLD1", "VIC1-NSW1", "VIC1-SA1", "VIC1-TAS1"]
    sra = [{"contract_id": f"SRA-{i+1:04d}", "interconnector": _r.choice(interconnectors), "direction": _r.choice(["Forward", "Reverse"]), "quarter": f"Q{q}-2026", "units": _r.randint(10, 200), "auction_price_aud": round(_r.uniform(1000, 50000), 0), "settlement_residue_aud": round(_r.uniform(500, 60000), 0), "pnl_aud": round(_r.uniform(-20000, 40000), 0)} for i in range(12) for q in [1, 2]]
    cr = [{"interconnector": ic, "month": f"2025-{m:02d}", "congestion_rent_aud": round(_r.uniform(100000, 5000000), 0), "flow_mwh": round(_r.uniform(50000, 500000), 0), "binding_intervals": _r.randint(100, 2000)} for ic in interconnectors for m in range(7, 13)]
    np = [{"node": f"NODE-{reg}", "region": reg, "avg_price_aud": round(_r.uniform(40, 150), 2), "marginal_loss_factor": round(_r.uniform(0.85, 1.05), 3)} for reg in ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]]
    ie = [{"interconnector": ic, "avg_flow_mw": round(_r.uniform(100, 900), 0), "capacity_mw": round(_r.uniform(500, 1500), 0), "utilization_pct": round(_r.uniform(30, 85), 1), "revenue_per_mw_aud": round(_r.uniform(5000, 50000), 0)} for ic in interconnectors]
    return {"timestamp": _dt.utcnow().isoformat() + "Z", "sra_contracts": sra, "congestion_rents": cr, "nodal_prices": np, "interconnector_economics": ie}


@app.get("/api/nem-congestion-rent/dashboard")
def ncra_dashboard():
    _r.seed(7030)
    interconnectors_list = ["NSW1-QLD1", "VIC1-NSW1", "VIC1-SA1", "VIC1-TAS1"]
    ics = [{"interconnector": ic, "capacity_mw": _r.randint(500, 1500), "avg_flow_mw": round(_r.uniform(100, 900), 0), "total_rent_m_aud": round(_r.uniform(10, 150), 1), "binding_hours": _r.randint(500, 4000), "congestion_frequency_pct": round(_r.uniform(10, 60), 1)} for ic in interconnectors_list]
    constraints = [{"constraint_id": f"C-{i+1:03d}", "constraint_name": cn, "interconnector": _r.choice(interconnectors_list), "binding_hours": _r.randint(100, 2000), "marginal_value_aud": round(_r.uniform(5, 200), 2), "cost_impact_m_aud": round(_r.uniform(1, 50), 1)} for i, cn in enumerate(["N>>Q_NIL", "V>>SA_NIL", "T>>V_NIL", "System_Normal", "N>>V_Thermal", "SA_Wind_Limit"])]
    rb = [{"from_region": f, "to_region": t, "avg_price_diff_aud": round(_r.uniform(-40, 60), 2), "max_diff_aud": round(_r.uniform(50, 800), 2), "correlation": round(_r.uniform(0.5, 0.95), 2)} for f, t in [("NSW1", "QLD1"), ("VIC1", "SA1"), ("VIC1", "TAS1"), ("NSW1", "VIC1")]]
    dist = [{"participant_type": pt, "share_pct": round(_r.uniform(5, 30), 1), "total_m_aud": round(_r.uniform(10, 100), 1)} for pt in ["Generator", "Retailer", "Network", "Customer"]]
    return {"interconnectors": ics, "constraints": constraints, "regional_basis": rb, "distribution": dist, "summary": {"total_congestion_rent_m_aud": 380, "most_congested": "NSW1-QLD1", "avg_binding_hours": 1800, "yoy_change_pct": 12.5}}


@app.get("/api/sra/dashboard")
def sra_main_dashboard():
    _r.seed(7031)
    interconnectors_list = ["NSW1-QLD1", "VIC1-NSW1", "VIC1-SA1", "VIC1-TAS1"]
    ar = [{"auction_id": f"AUC-{i+1:04d}", "interconnector": ic, "direction": _r.choice(["Forward", "Counter"]), "quarter": f"Q{q}-2026", "clearing_price_aud": round(_r.uniform(2000, 80000), 0), "units_offered": _r.randint(50, 300), "units_sold": _r.randint(30, 250), "total_proceeds_m_aud": round(_r.uniform(0.5, 20), 1)} for i, (ic, q) in enumerate([(ic, q) for ic in interconnectors_list for q in [1, 2, 3, 4]])]
    units = [{"unit_id": f"SRU-{i+1:04d}", "interconnector": _r.choice(interconnectors_list), "direction": _r.choice(["Forward", "Counter"]), "holder": _r.choice(["AGL", "Origin", "Snowy Hydro", "Macquarie", "Shell"]), "acquisition_price_aud": round(_r.uniform(1000, 50000), 0), "current_value_aud": round(_r.uniform(800, 60000), 0), "quarter": f"Q1-2026"} for i in range(15)]
    icr = [{"interconnector": ic, "quarter": "Q4-2025", "total_residue_m_aud": round(_r.uniform(5, 60), 1), "distributed_m_aud": round(_r.uniform(4, 55), 1), "retained_m_aud": round(_r.uniform(0.5, 5), 1)} for ic in interconnectors_list]
    return {"timestamp": _dt.utcnow().isoformat() + "Z", "current_quarter": "Q4-2025", "total_sra_units_active": 850, "total_sra_revenue_this_quarter": 45000000, "best_performing_interconnector": "NSW1-QLD1", "total_residues_distributed_aud": 38000000, "auction_results": ar, "active_units": units, "interconnector_revenue": icr}


@app.get("/api/sra-analytics/dashboard")
def sraa_dashboard():
    _r.seed(7032)
    interconnectors_list = ["NSW1-QLD1", "VIC1-NSW1", "VIC1-SA1", "VIC1-TAS1"]
    ar = [{"auction_id": f"SRAA-{i+1:04d}", "interconnector": _r.choice(interconnectors_list), "quarter": f"Q{q}-{y}", "direction": _r.choice(["Forward", "Counter"]), "clearing_price_aud_per_unit": round(_r.uniform(1000, 60000), 0), "units_traded": _r.randint(20, 300), "participation_ratio_pct": round(_r.uniform(50, 95), 1)} for i in range(12) for q in [1, 2] for y in [2025, 2026]]
    holders = [{"holder_name": h, "holder_type": _r.choice(["Gentailer", "Financial", "Trader"]), "total_units": _r.randint(50, 500), "total_investment_m_aud": round(_r.uniform(5, 80), 1), "realized_return_pct": round(_r.uniform(-20, 50), 1)} for h in ["AGL", "Origin", "Macquarie", "Shell", "Snowy Hydro", "Alinta"]]
    residues = [{"interconnector": ic, "quarter": f"Q{q}-2025", "total_residue_m_aud": round(_r.uniform(5, 60), 1), "per_unit_residue_aud": round(_r.uniform(500, 40000), 0), "forecast_vs_actual_pct": round(_r.uniform(-30, 40), 1)} for ic in interconnectors_list for q in [3, 4]]
    ics = [{"interconnector": ic, "avg_utilization_pct": round(_r.uniform(40, 85), 1), "congestion_frequency_pct": round(_r.uniform(15, 55), 1), "sra_value_correlation": round(_r.uniform(0.4, 0.9), 2)} for ic in interconnectors_list]
    pb = [{"participant": p, "bidding_frequency": _r.randint(5, 50), "avg_bid_price_aud": round(_r.uniform(2000, 40000), 0), "success_rate_pct": round(_r.uniform(30, 85), 1)} for p in ["AGL", "Origin", "Macquarie", "Shell"]]
    return {"auction_results": ar, "holders": holders, "residues": residues, "interconnectors": ics, "participant_behaviour": pb, "summary": {"total_auction_proceeds_m_aud": 120, "avg_return_pct": 15.2, "most_active_participant": "AGL"}}


@app.get("/api/nem-settlement-residue-auction/dashboard")
def nsra_dashboard():
    _r.seed(7033)
    interconnectors_list = ["NSW1-QLD1", "VIC1-NSW1", "VIC1-SA1", "VIC1-TAS1"]
    auctions = [{"auction_id": f"NSRA-{i+1:04d}", "interconnector": ic, "quarter": f"Q{q}-2026", "auction_date": f"2025-{_r.randint(9,12):02d}-{_r.randint(1,28):02d}", "clearing_price_aud": round(_r.uniform(2000, 70000), 0), "units_available": _r.randint(50, 300), "units_sold": _r.randint(30, 280), "oversubscription_ratio": round(_r.uniform(0.8, 3.0), 1)} for i, (ic, q) in enumerate([(ic, q) for ic in interconnectors_list for q in [1, 2]])]
    holders = [{"holder_name": h, "total_units_held": _r.randint(30, 400), "interconnectors_count": _r.randint(1, 4), "total_value_m_aud": round(_r.uniform(5, 60), 1), "strategy": _r.choice(["Hedge", "Speculative", "Portfolio"])} for h in ["AGL", "Origin", "Macquarie", "Shell", "Snowy Hydro"]]
    flows = [{"interconnector": ic, "quarter": f"Q4-2025", "settlement_residue_m_aud": round(_r.uniform(5, 50), 1), "units_settled": _r.randint(50, 300), "per_unit_residue_aud": round(_r.uniform(500, 30000), 0)} for ic in interconnectors_list]
    ma = [{"quarter": f"Q{q}-2025", "total_auction_value_m_aud": round(_r.uniform(30, 150), 0), "participants_count": _r.randint(10, 30), "new_participants": _r.randint(0, 5)} for q in [1, 2, 3, 4]]
    icm = [{"interconnector": ic, "capacity_mw": _r.randint(500, 1500), "avg_utilization_pct": round(_r.uniform(40, 80), 1), "congestion_rent_correlation": round(_r.uniform(0.5, 0.9), 2), "forecast_accuracy_pct": round(_r.uniform(60, 90), 1)} for ic in interconnectors_list]
    return {"auctions": auctions, "sra_holders": holders, "settlement_residue_flows": flows, "market_activity": ma, "interconnector_metrics": icm, "summary": {"total_units_active": 1200, "total_market_value_m_aud": 95, "avg_clearing_price_aud": 25000, "quarterly_turnover_pct": 35}}


# =========================================================================
# BATCH: More endpoints (3)
# =========================================================================

@app.get("/api/carbon-price-pathway/dashboard")
def cpp_dashboard():
    _r.seed(7034)
    scenarios = [{"scenario_name": s, "year": y, "carbon_price_aud_t": round(_r.uniform(15, 80), 2), "emissions_mt": round(_r.uniform(50, 200), 0), "reduction_vs_2005_pct": round(_r.uniform(20, 65), 1), "policy_mechanism": _r.choice(["Safeguard Mechanism", "ETS", "Carbon Tax", "Baseline & Credit"])} for s in ["Net Zero 2050", "Current Policy", "Accelerated", "Delayed Action"] for y in [2025, 2028, 2030, 2035]]
    sf = [{"facility_name": f, "sector": sec, "baseline_mt": round(_r.uniform(0.1, 5), 2), "actual_emissions_mt": round(_r.uniform(0.08, 5.5), 2), "shortfall_mt": round(_r.uniform(-0.5, 1), 2), "compliance_status": _r.choice(["Compliant", "Shortfall", "Surrender Required"])} for f, sec in [("Eraring PS", "Electricity"), ("Bayswater PS", "Electricity"), ("Loy Yang A", "Electricity"), ("Tomago Aluminium", "Manufacturing"), ("BlueScope Steel", "Manufacturing"), ("Woodside NWS", "Oil & Gas")]]
    pt = [{"sector": sec, "carbon_cost_aud_mwh": round(_r.uniform(2, 20), 2), "passthrough_rate_pct": round(_r.uniform(50, 100), 1), "consumer_impact_aud_yr": round(_r.uniform(50, 300), 0)} for sec in ["Electricity", "Gas", "Transport", "Manufacturing"]]
    ab = [{"option": opt, "abatement_cost_aud_t": round(_r.uniform(10, 200), 0), "potential_mt": round(_r.uniform(1, 50), 0), "readiness": _r.choice(["Available", "Near-term", "Long-term"])} for opt in ["Renewables", "Energy Efficiency", "CCS", "Green Hydrogen", "Electrification", "Nature-based"]]
    return {"scenarios": scenarios, "safeguard_facilities": sf, "passthrough_records": pt, "abatement_options": ab, "summary": {"current_carbon_price_aud_t": 32.5, "safeguard_covered_mt": 140, "compliance_rate_pct": 88, "projected_2030_price_aud_t": 55}}


@app.get("/api/price-sensitivity/dashboard")
def epsa_dashboard():
    _r.seed(7035)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    drivers = ["Gas Price", "Coal Price", "Carbon Price", "Demand", "Wind Output", "Solar Output", "Interconnector", "Hydro Availability"]
    sens = [{"region": reg, "driver": d, "elasticity": round(_r.uniform(-2, 3), 2), "base_price_impact_aud_mwh": round(_r.uniform(-20, 40), 2), "r_squared": round(_r.uniform(0.1, 0.8), 2)} for reg in regions for d in drivers]
    scenarios = [{"scenario_name": s, "region": reg, "base_price_aud_mwh": round(_r.uniform(50, 120), 2), "scenario_price_aud_mwh": round(_r.uniform(30, 250), 2), "price_change_pct": round(_r.uniform(-40, 100), 1)} for s in ["High Gas", "Low Renewables", "Drought", "Demand Surge", "Carbon Increase"] for reg in regions[:2]]
    corr = [{"factor_a": fa, "factor_b": fb, "correlation": round(_r.uniform(-0.8, 0.9), 2), "significance": _r.choice(["High", "Medium", "Low"])} for fa, fb in [("Gas Price", "Electricity Price"), ("Wind Output", "Electricity Price"), ("Temperature", "Demand"), ("Solar Output", "Midday Price"), ("Coal Price", "Baseload Price")]]
    tr = [{"region": reg, "scenario": s, "tail_price_aud_mwh": round(_r.uniform(300, 5000), 0), "probability_pct": round(_r.uniform(0.5, 10), 1), "expected_loss_m_aud": round(_r.uniform(5, 200), 0)} for reg in regions[:3] for s in ["Extreme Heat", "Generator Failure", "Gas Supply Disruption"]]
    return {"sensitivity": sens, "scenarios": scenarios, "correlations": corr, "tail_risks": tr, "summary": {"most_sensitive_region": "SA1", "highest_elasticity_driver": "Gas Price", "avg_base_price_mwh": 85.5, "max_tail_risk_mwh": 4200}}


@app.get("/api/market-evolution-policy/dashboard")
def mepa_dashboard():
    _r.seed(7036)
    policies = [{"policy_id": f"POL-{i+1:03d}", "policy_name": p, "status": _r.choice(["Active", "Proposed", "Under Review"]), "implementation_date": f"202{_r.randint(4,7)}-{_r.randint(1,12):02d}-01", "impact_category": cat, "estimated_impact_m_aud": round(_r.uniform(50, 2000), 0)} for i, (p, cat) in enumerate([("Capacity Investment Scheme", "Investment"), ("Renewable Energy Target", "Generation"), ("Safeguard Mechanism", "Emissions"), ("Consumer Energy Resources", "Demand"), ("Transmission Planning", "Network"), ("ISP 2024", "Planning"), ("Battery Incentive Scheme", "Storage")])]
    mi = [{"indicator": ind, "year": y, "value": round(_r.uniform(10, 200), 1), "trend": _r.choice(["Increasing", "Decreasing", "Stable"]), "unit": u} for ind, u in [("Renewable Share", "%"), ("Wholesale Price", "AUD/MWh"), ("Emissions Intensity", "tCO2/MWh"), ("Storage Capacity", "GW"), ("DER Penetration", "%")] for y in [2023, 2024, 2025]]
    trans = [{"year": y, "coal_share_pct": round(_r.uniform(15, 45), 1), "gas_share_pct": round(_r.uniform(5, 15), 1), "renewable_share_pct": round(_r.uniform(30, 70), 1), "storage_share_pct": round(_r.uniform(2, 15), 1), "total_capacity_gw": round(_r.uniform(60, 90), 0)} for y in [2024, 2025, 2026, 2028, 2030]]
    consumer = [{"year": y, "avg_retail_price_c_kwh": round(_r.uniform(25, 45), 1), "solar_households_pct": round(_r.uniform(25, 50), 1), "battery_households_pct": round(_r.uniform(2, 20), 1), "ev_share_pct": round(_r.uniform(2, 25), 1), "demand_response_mw": round(_r.uniform(500, 3000), 0)} for y in [2024, 2025, 2026, 2028, 2030]]
    return {"policies": policies, "market_indicators": mi, "transition": trans, "consumer": consumer, "summary": {"renewable_share_current_pct": 38.5, "coal_retirement_year": 2038, "total_investment_pipeline_b_aud": 85, "consumer_savings_target_pct": 15, "policy_count_active": 5}}


# =========================================================================
# API 404 catch-all (must be BEFORE the SPA catch-all)
# =========================================================================

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def api_fallback(path: str):
    """Return 501 for any unregistered /api/* route.

    The frontend client throws on non-2xx responses, which lets each page's
    own error handler display a friendly message instead of crashing on
    mismatched data shapes.
    """
    label = path.replace("/", " ").replace("-", " ").replace("_", " ").title()
    return JSONResponse(
        status_code=501,
        content={
            "error": f"Endpoint /api/{path} is not yet implemented",
            "message": f"{label} data is coming soon. This endpoint has not been wired up yet.",
        },
    )

# =========================================================================
# STATIC FRONTEND SERVING (Databricks Apps deployment)
# =========================================================================

from fastapi.staticfiles import StaticFiles  # noqa: E402
from fastapi.responses import FileResponse    # noqa: E402

_frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.isdir(_frontend_dist):
    # Serve static assets (JS, CSS, images)
    _assets_dir = os.path.join(_frontend_dist, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="static-assets")

    # Catch-all: serve index.html for any non-API route (SPA routing)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA for all non-API routes."""
        # Safety guard: never serve index.html for API routes
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"error": "Not found"})
        index = os.path.join(_frontend_dist, "index.html")
        if os.path.exists(index):
            return FileResponse(index)
        return {"error": "Frontend not built. Run npm run build in app/frontend/"}
