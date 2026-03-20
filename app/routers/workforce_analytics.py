"""Workforce Analytics — Opex Benchmarking, Contractor Management & Productivity.

Tracks DNSP workforce composition, contractor spend and SLA compliance,
opex category performance against AER allowances, and monthly field
productivity trends to support regulatory reporting and efficiency programs.
"""
from __future__ import annotations

import random as _r
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from .shared import _query_gold, logger

router = APIRouter()

_DNSPS = ["AusNet Services", "Ergon Energy", "Energex", "Ausgrid", "Essential Energy", "SA Power Networks"]

_SPECIALISATIONS = ["Vegetation", "Civil", "Electrical", "Metering", "IT"]
_RATINGS = ["A", "B", "C", "D"]

_CONTRACTOR_NAMES = [
    "Ventia Infrastructure Services",
    "Downer EDI Works",
    "Service Stream",
    "Lendlease Engineering",
    "Broadspectrum",
    "Fulton Hogan",
    "Stantec Australia",
    "WSP Pacific",
    "GHD Advisory",
    "Ausgrid Field Services",
    "Enwave Australia",
    "Zinfra Group",
    "John Holland",
    "Laing O'Rourke",
    "AECOM Australia",
]


# =========================================================================
# GET /api/workforce/summary
# =========================================================================

@router.get("/api/workforce/summary")
async def workforce_summary() -> JSONResponse:
    """Workforce composition and opex cost summary for AusNet Services."""
    _r.seed(820)
    direct = _r.randint(2_800, 3_600)
    contractors = _r.randint(1_100, 1_900)
    total = direct + contractors
    contractor_ratio = round(contractors / total * 100, 1)
    opex_ytd = round(_r.uniform(420.0, 580.0), 1)
    opex_budget = round(opex_ytd * _r.uniform(0.96, 1.08), 1)
    aer_allowed = round(opex_budget * _r.uniform(0.92, 1.02), 1)
    customers = 780_000
    network_km = 47_200.0
    return JSONResponse({
        "dnsp_name": "AusNet Services",
        "total_workforce": total,
        "direct_employees": direct,
        "contractors_fte": contractors,
        "contractor_ratio_pct": contractor_ratio,
        "opex_ytd_m": opex_ytd,
        "opex_budget_m": opex_budget,
        "cost_per_customer_aud": round(opex_ytd * 1_000_000 / customers, 2),
        "cost_per_km_maintained_aud": round(opex_ytd * 1_000_000 / network_km, 2),
        "aer_allowed_opex_m": aer_allowed,
        "efficiency_gap_m": round(opex_ytd - aer_allowed, 2),
        "data_source": "synthetic",
    })


# =========================================================================
# GET /api/workforce/contractors
# =========================================================================

@router.get("/api/workforce/contractors")
async def workforce_contractors() -> JSONResponse:
    """Contractor performance, spend, and SLA compliance."""
    _r.seed(821)
    contractors = []
    for i, name in enumerate(_CONTRACTOR_NAMES):
        active_contracts = _r.randint(1, 6)
        spend_ytd = round(_r.uniform(2.5, 48.0), 2)
        budget = round(spend_ytd * _r.uniform(0.90, 1.15), 2)
        sla = round(_r.uniform(78.0, 99.5), 1)
        defect_rate = round(_r.uniform(0.2, 5.8), 2)
        incidents = _r.randint(0, 4)
        rating = (
            "A" if sla >= 95.0 and defect_rate < 1.5 else
            "B" if sla >= 88.0 and defect_rate < 3.0 else
            "C" if sla >= 78.0 else
            "D"
        )
        contractors.append({
            "contractor_name": name,
            "specialisation": _r.choice(_SPECIALISATIONS),
            "contracts_active": active_contracts,
            "spend_ytd_m": spend_ytd,
            "budget_m": budget,
            "sla_compliance_pct": sla,
            "defect_rate_pct": defect_rate,
            "safety_incidents": incidents,
            "rating": rating,
        })
    return JSONResponse({"contractors": contractors, "count": len(contractors)})


# =========================================================================
# GET /api/workforce/opex-benchmark
# =========================================================================

@router.get("/api/workforce/opex-benchmark")
async def workforce_opex_benchmark() -> JSONResponse:
    """Opex category benchmarking against AER allowances and peer frontier."""
    _r.seed(822)
    categories = [
        ("Field Operations",   185.0, 178.0, 162.0, 148.0),
        ("Asset Management",    92.0,  88.0,  82.0,  74.0),
        ("Customer Services",   68.0,  65.0,  61.0,  55.0),
        ("Corporate",           48.0,  44.0,  40.0,  35.0),
        ("IT & Technology",     55.0,  52.0,  48.0,  42.0),
    ]
    result = []
    for category, actual, allowed, peer_avg, frontier in categories:
        variance = round(actual - allowed, 2)
        efficiency = round(allowed / actual * 100, 1)
        result.append({
            "category": category,
            "actual_m": actual,
            "aer_allowed_m": allowed,
            "variance_m": variance,
            "efficiency_pct": efficiency,
            "peer_avg_m": peer_avg,
            "frontier_m": frontier,
        })
    return JSONResponse({"opex_benchmark": result, "count": len(result)})


# =========================================================================
# GET /api/workforce/productivity
# =========================================================================

@router.get("/api/workforce/productivity")
async def workforce_productivity() -> JSONResponse:
    """Monthly field productivity trend for the last 12 months."""
    _r.seed(823)
    today = date.today()
    trend = []
    for i in range(11, -1, -1):
        # Step back month by month
        month_date = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        month_str = month_date.strftime("%Y-%m")
        work_orders = _r.randint(3_200, 5_800)
        avg_resolution = round(_r.uniform(2.8, 8.4), 1)
        cost_per_wo = round(_r.uniform(320.0, 680.0), 2)
        sla_compliance = round(_r.uniform(82.0, 97.5), 1)
        overtime_pct = round(_r.uniform(4.5, 18.0), 1)
        trend.append({
            "month": month_str,
            "work_orders_completed": work_orders,
            "avg_resolution_hrs": avg_resolution,
            "cost_per_work_order_aud": cost_per_wo,
            "sla_compliance_pct": sla_compliance,
            "overtime_pct": overtime_pct,
        })
    return JSONResponse({"productivity": trend, "months": len(trend)})
