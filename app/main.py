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
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone, timedelta, date
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
    """Return service health status (always healthy in slim deployment mode)."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mock_mode": True,
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
    available_capacity_mw: float
    dispatched_mw: float
    capacity_factor: float
    marginal_cost_estimate: float


class NemIcFlowRecord(BaseModel):
    interconnector_id: str
    from_region: str
    to_region: str
    flow_mw: float
    limit_mw: float
    utilisation_pct: float
    marginal_loss_factor: float


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
                available_capacity_mw=float(cap) * 0.85,
                dispatched_mw=float(disp),
                capacity_factor=cf,
                marginal_cost_estimate=mc,
            ))

    interconnector_flows = [
        NemIcFlowRecord(interconnector_id="N-Q-MNSP1", from_region="NSW1", to_region="QLD1",
                        flow_mw=280.0, limit_mw=700.0, utilisation_pct=40.0, marginal_loss_factor=0.98),
        NemIcFlowRecord(interconnector_id="VIC1-NSW1", from_region="VIC1", to_region="NSW1",
                        flow_mw=420.0, limit_mw=1350.0, utilisation_pct=31.1, marginal_loss_factor=0.97),
        NemIcFlowRecord(interconnector_id="V-SA", from_region="VIC1", to_region="SA1",
                        flow_mw=-142.0, limit_mw=680.0, utilisation_pct=20.9, marginal_loss_factor=0.96),
        NemIcFlowRecord(interconnector_id="T-V-MNSP1", from_region="TAS1", to_region="VIC1",
                        flow_mw=87.0, limit_mw=594.0, utilisation_pct=14.6, marginal_loss_factor=0.97),
        NemIcFlowRecord(interconnector_id="V-S-MNSP1", from_region="VIC1", to_region="SA1",
                        flow_mw=95.0, limit_mw=220.0, utilisation_pct=43.2, marginal_loss_factor=0.95),
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


@app.get("/api/prices/latest", summary="Latest spot prices", tags=["Market Data"])
async def prices_latest():
    """Current spot prices for all 5 NEM regions with trend indicators."""
    now = datetime.now(_AEST)
    seed = int(now.timestamp() // 30)  # changes every 30s
    rng = random.Random(seed)
    trends = ["up", "down", "stable"]
    result = []
    for region in _NEM_REGIONS:
        base = _REGION_BASE_PRICES[region]
        price = round(base * rng.uniform(0.85, 1.15), 2)
        result.append({
            "region": region,
            "price": price,
            "trend": rng.choice(trends),
            "updatedAt": now.isoformat(),
        })
    return result


@app.get("/api/prices/history", summary="Price history", tags=["Market Data"])
async def prices_history(
    region: str = Query("NSW1"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
):
    """Return 24 hours of 5-minute price points for a region."""
    base = _REGION_BASE_PRICES.get(region, 70.0)
    now = datetime.now(timezone.utc)
    start_dt = now - timedelta(hours=24)
    rng = random.Random(hash(region) + int(start_dt.timestamp() // 3600))
    points = []
    for i in range(288):
        ts = start_dt + timedelta(minutes=5 * i)
        hour_frac = ts.hour + ts.minute / 60.0
        # sine wave for daily pattern: peak around 18:00, trough around 04:00
        daily = math.sin((hour_frac - 4) / 24 * 2 * math.pi) * base * 0.3
        noise = rng.gauss(0, base * 0.08)
        price = round(max(0, base + daily + noise), 2)
        points.append({"timestamp": ts.isoformat(), "price": price})
    return points


@app.get("/api/market-summary/latest", summary="Market narrative summary", tags=["Market Data"])
async def market_summary_latest():
    """AI-generated market summary narrative."""
    today = date.today().isoformat()
    return {
        "summary_date": today,
        "narrative": (
            "The NEM experienced moderate demand across eastern states today, with "
            "South Australia recording elevated spot prices driven by high gas generation costs "
            "and lower-than-forecast wind output. Victoria and Tasmania continued to benefit from "
            "strong hydro availability, keeping wholesale prices below $60/MWh. NSW demand tracked "
            "near seasonal averages at approximately 8,400 MW, with rooftop solar offsetting "
            "early-afternoon peaks. Queensland coal units maintained steady output, while battery "
            "storage facilities across the NEM captured evening price spreads during the transition "
            "from solar to thermal generation. Interconnector flows from Victoria to South Australia "
            "reached 85% utilisation during the afternoon shoulder period. Overall system security "
            "remained satisfactory with adequate inertia margins across all regions."
        ),
        "model_id": "gpt-nem-v3",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "word_count": 120,
        "generation_succeeded": True,
    }


@app.get("/api/generation", summary="Generation mix time series", tags=["Market Data"])
async def generation_timeseries(
    region: str = Query("NSW1"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
):
    """Return generation mix time series (30-min intervals, 24h) for a region."""
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
            "interval_datetime": now.isoformat(),
            "interconnectorid": ic["id"],
            "from_region": ic["from_region"],
            "to_region": ic["to_region"],
            "mw_flow": flow,
            "mw_flow_limit": ic["limit"],
            "export_limit": ic["export_limit"],
            "import_limit": ic["import_limit"],
            "congested": util > 0.85,
        })
    return {
        "timestamp": now.isoformat(),
        "interconnectors": interconnectors_list,
        "most_loaded": most_loaded,
        "total_interstate_mw": round(total_mw, 0),
    }


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
    base = _REGION_BASE_PRICES.get(region, 70.0)
    rng = random.Random(hash(region) + int(now.timestamp() // 3600))
    points = []
    for i in range(hours * 2):  # 30-min intervals
        ts = now + timedelta(minutes=30 * i)
        hour = ts.hour + ts.minute / 60.0
        daily = math.sin((hour - 4) / 24 * 2 * math.pi) * base * 0.25
        noise = rng.gauss(0, base * 0.06)
        price = round(max(0, base + daily + noise), 2)
        ci_width = base * 0.15 * (1 + i / (hours * 2))  # widening CI
        points.append({
            "timestamp": ts.isoformat(),
            "predicted": price,
            "lower": round(max(0, price - ci_width), 2),
            "upper": round(price + ci_width, 2),
            "price_p10": round(max(0, price - ci_width * 0.8), 2),
            "price_p90": round(price + ci_width * 0.8, 2),
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
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
):
    """Return recent price spike events for a region."""
    now = datetime.now(timezone.utc)
    rng = random.Random(hash(region) + 999)
    spikes = []
    for i in range(rng.randint(3, 8)):
        spike_time = now - timedelta(hours=rng.uniform(1, 72))
        base = _REGION_BASE_PRICES.get(region, 70.0)
        peak = round(base * rng.uniform(5, 25), 2)
        duration = rng.randint(5, 30)
        spikes.append({
            "timestamp": spike_time.isoformat(),
            "peakPrice": peak,
            "durationMinutes": duration,
            "region": region,
            "trigger": rng.choice(["generator_trip", "demand_surge", "interconnector_constraint", "forecast_error"]),
        })
    spikes.sort(key=lambda s: s["timestamp"], reverse=True)
    return spikes


@app.get("/api/prices/volatility", summary="Price volatility metrics", tags=["Market Data"])
async def prices_volatility():
    """Return volatility metrics for all NEM regions."""
    rng = random.Random(int(datetime.now(timezone.utc).timestamp() // 3600))
    result = []
    for region in _NEM_REGIONS:
        base = _REGION_BASE_PRICES[region]
        result.append({
            "region": region,
            "currentPrice": round(base * rng.uniform(0.9, 1.1), 2),
            "avgPrice24h": round(base * rng.uniform(0.95, 1.05), 2),
            "stdDev24h": round(base * rng.uniform(0.1, 0.4), 2),
            "maxPrice24h": round(base * rng.uniform(1.5, 3.0), 2),
            "minPrice24h": round(base * rng.uniform(0.2, 0.6), 2),
            "volatilityIndex": round(rng.uniform(0.1, 0.9), 3),
            "spikeCount24h": rng.randint(0, 5),
        })
    return result


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
    mix_data = {
        "NSW1": {"Black Coal": 52.0, "Natural Gas": 8.5, "Hydro": 10.2, "Wind": 12.8, "Solar": 13.5, "Battery": 3.0},
        "QLD1": {"Black Coal": 58.0, "Natural Gas": 12.0, "Hydro": 5.0, "Wind": 7.5, "Solar": 15.5, "Battery": 2.0},
        "VIC1": {"Brown Coal": 48.0, "Natural Gas": 10.5, "Hydro": 6.0, "Wind": 25.0, "Solar": 7.5, "Battery": 3.0},
        "SA1":  {"Natural Gas": 22.0, "Wind": 48.0, "Solar": 18.0, "Battery": 12.0},
        "TAS1": {"Natural Gas": 3.0, "Hydro": 72.0, "Wind": 20.0, "Solar": 5.0},
    }
    total_gen_base = {"NSW1": 9500, "QLD1": 7200, "VIC1": 6800, "SA1": 2200, "TAS1": 1400}
    renewables = {"Hydro", "Wind", "Solar", "Battery"}
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
    unit_counts = {"Black Coal": 4, "Brown Coal": 3, "Natural Gas": 5, "Hydro": 6, "Wind": 8, "Solar": 10, "Battery": 3}
    for fuel, val in adjusted.items():
        pct = round(val / total_pct * 100, 1)
        mw = round(total_gen * pct / 100, 0)
        is_renew = fuel in renewables
        if is_renew:
            renewable_mw += mw
        fuel_mix.append({
            "fuel_type": fuel,
            "total_mw": mw,
            "percentage": pct,
            "unit_count": unit_counts.get(fuel, 3),
            "is_renewable": is_renew,
        })
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_generation_mw": round(total_gen, 0),
        "renewable_mw": round(renewable_mw, 0),
        "renewable_percentage": round(renewable_mw / total_gen * 100, 1) if total_gen > 0 else 0,
        "carbon_intensity_kg_co2_mwh": round(rng.uniform(0.4, 0.85), 2),
        "region": region,
        "fuel_mix": fuel_mix,
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
        lg.warning("Context: generation mix failed: %s", exc)

    if nem_total_gen > 0:
        parts.append(
            f"NEM TOTAL GENERATION: {nem_total_gen:.0f} MW, "
            f"renewable {nem_total_renew:.0f} MW ({nem_total_renew / nem_total_gen * 100:.1f}%)"
        )

    # 6. Price volatility
    try:
        vol = await prices_volatility()
        lines = []
        for v in vol:
            lines.append(
                f"  {v['region']}: avg=${v.get('avgPrice24h', 0):.1f}, "
                f"std_dev=${v.get('stdDev24h', 0):.1f}, "
                f"range=[${v.get('minPrice24h', 0):.0f}, ${v.get('maxPrice24h', 0):.0f}], "
                f"spikes={v.get('spikeCount24h', 0)}"
            )
        parts.append("PRICE VOLATILITY (24h):\n" + "\n".join(lines))
    except Exception as exc:
        lg.warning("Context: volatility failed: %s", exc)

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
        lg.warning("Context: BESS fleet failed: %s", exc)

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
        lg.warning("Context: alerts failed: %s", exc)

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
        lg.warning("Context: demand response failed: %s", exc)

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
        lg.warning("Context: forecasts failed: %s", exc)

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
        lg.warning("Context: merit order failed: %s", exc)

    return "\n\n".join(parts)


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
        lg.error("Failed to initialise Databricks auth: %s", auth_exc)
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
            lg.exception("Chat stream error")
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
# API 404 catch-all (must be BEFORE the SPA catch-all)
# =========================================================================

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def api_not_found(path: str):
    """Return a proper JSON 404 for any undefined /api/* route."""
    return JSONResponse(
        status_code=404,
        content={
            "error": f"Endpoint /api/{path} not found",
            "available_endpoints": [
                "/api/chat",
                "/api/sessions",
                "/api/health",
                "/api/prices/latest",
                "/api/prices/history",
                "/api/market-summary/latest",
                "/api/generation",
                "/api/interconnectors",
                "/api/forecasts",
                "/api/prices/compare",
                "/api/prices/spikes",
                "/api/prices/volatility",
                "/api/generation/units",
                "/api/generation/mix",
                "/api/nem-realtime/dashboard",
                "/api/bess/fleet",
                "/api/bess/dispatch",
                "/api/weather/demand",
                "/api/sustainability/dashboard",
                "/api/sustainability/intensity_history",
                "/api/merit/order",
                "/api/trading/dashboard",
                "/api/trading/positions",
                "/api/trading/spreads",
                "/api/alerts",
                "/api/alerts/stats",
                "/api/demand/response",
                "/api/market-notices",
                "/api/live-ops/status",
                "/api/market/notices",
                "/api/dispatch/intervals",
                "/api/settlement/summary",
                "/api/alerts/history",
                "/api/forecasts/summary",
                "/api/forecasts/accuracy",
                "/api/constraints",
                "/api/fcas/market",
                "/api/dsp/dashboard",
            ],
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
