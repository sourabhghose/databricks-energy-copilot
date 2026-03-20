"""Vegetation Risk & Electrical Line Clearance Compliance.

Tracks powerline vegetation clearance compliance under the Electricity Safety
(Bushfire Mitigation) Regulations, span-level risk scores, ELC inspection
schedules, and seasonal bushfire risk forecasting across the network.
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

_CLEARANCE_STATUSES = ["Compliant", "Non-Compliant", "Overdue", "Scheduled"]
_ZONES = ["BMO", "Non-BMO"]
_FUEL_LOADS = ["High", "Medium", "Low"]
_MITIGATION_STATUSES = ["On Track", "Behind", "Complete"]

_BUSHFIRE_ZONES = [
    ("Dandenong Ranges", True),
    ("Yarra Valley", True),
    ("Kinglake", True),
    ("Macedon Ranges", True),
    ("Otway Ranges", True),
    ("Strathbogie Ranges", True),
    ("East Gippsland", True),
    ("Latrobe Valley", False),
    ("Mornington Peninsula", False),
    ("Bellarine Peninsula", False),
    ("Geelong Metro", False),
    ("Melbourne CBD", False),
]


# =========================================================================
# GET /api/veg-risk/summary
# =========================================================================

@router.get("/api/veg-risk/summary")
async def veg_risk_summary() -> JSONResponse:
    """Network-wide vegetation risk and ELC compliance summary."""
    _r.seed(800)
    total_km = 47_200
    bmo_km = _r.randint(12_400, 18_600)
    return JSONResponse({
        "total_network_km": total_km,
        "bmo_zone_km": bmo_km,
        "high_risk_spans": _r.randint(1_800, 4_200),
        "critical_risk_spans": _r.randint(280, 840),
        "inspection_compliance_pct": round(_r.uniform(88.5, 97.8), 1),
        "avg_risk_score": round(_r.uniform(32.0, 58.0), 1),
        "outages_from_vegetation_ytd": _r.randint(180, 640),
        "clearance_work_due_km": round(_r.uniform(620.0, 2_400.0), 1),
        "data_source": "synthetic",
    })


# =========================================================================
# GET /api/veg-risk/spans
# =========================================================================

@router.get("/api/veg-risk/spans")
async def veg_risk_spans() -> JSONResponse:
    """Span-level vegetation risk scores and inspection status."""
    _r.seed(801)
    today = date.today()
    spans = []
    for i in range(40):
        zone = _r.choice(_ZONES)
        risk = round(_r.uniform(5.0, 100.0), 1)
        encroachment = round(_r.uniform(0.0, 2.8), 2)
        last_inspection = today - timedelta(days=_r.randint(30, 730))
        # BMO zones require annual inspection; Non-BMO every 3 years
        inspection_cycle_days = 365 if zone == "BMO" else 1095
        next_due = last_inspection + timedelta(days=inspection_cycle_days)
        overdue = next_due < today
        if overdue and encroachment > 1.5:
            status = "Overdue"
        elif next_due < today + timedelta(days=60):
            status = "Scheduled"
        elif encroachment > 1.8:
            status = "Non-Compliant"
        else:
            status = "Compliant"
        feeder_num = _r.randint(1, 30)
        spans.append({
            "span_id": f"SPN-{i+1:04d}",
            "feeder_id": f"FDR-{feeder_num:03d}",
            "zone": zone,
            "vegetation_risk_score": risk,
            "canopy_encroachment_m": encroachment,
            "last_inspection_date": last_inspection.isoformat(),
            "next_inspection_due": next_due.isoformat(),
            "clearance_status": status,
            "satellite_change_detected": _r.random() > 0.65,
            "outage_history_3yr": _r.randint(0, 5),
        })
    spans.sort(key=lambda x: x["vegetation_risk_score"], reverse=True)
    return JSONResponse({"spans": spans, "count": len(spans)})


# =========================================================================
# GET /api/veg-risk/elc-compliance
# =========================================================================

@router.get("/api/veg-risk/elc-compliance")
async def veg_risk_elc_compliance() -> JSONResponse:
    """Electrical line clearance compliance by DNSP."""
    _r.seed(802)
    dnsp_params = [
        ("AusNet Services",    18_400, 0.944),
        ("Ergon Energy",       24_800, 0.912),
        ("Energex",            22_100, 0.958),
        ("Ausgrid",            19_600, 0.961),
        ("Essential Energy",   31_200, 0.887),
        ("SA Power Networks",  16_800, 0.933),
    ]
    result = []
    for dnsp, total_spans, compliance_rate in dnsp_params:
        compliant = int(total_spans * compliance_rate * _r.uniform(0.98, 1.02))
        compliant = min(compliant, total_spans)
        compliance_pct = round(compliant / total_spans * 100, 1)
        overdue = int(total_spans * _r.uniform(0.008, 0.045))
        works_done = int(total_spans * _r.uniform(0.12, 0.28))
        works_outstanding = int(total_spans * _r.uniform(0.04, 0.12))
        reg_risk = (
            "High" if compliance_pct < 90.0 else
            "Medium" if compliance_pct < 95.0 else
            "Low"
        )
        result.append({
            "dnsp": dnsp,
            "total_spans": total_spans,
            "compliant_spans": compliant,
            "compliance_pct": compliance_pct,
            "overdue_inspections": overdue,
            "clearance_works_completed": works_done,
            "clearance_works_outstanding": works_outstanding,
            "regulatory_risk": reg_risk,
        })
    return JSONResponse({"elc_compliance": result, "count": len(result)})


# =========================================================================
# GET /api/veg-risk/bushfire-forecast
# =========================================================================

@router.get("/api/veg-risk/bushfire-forecast")
async def veg_risk_bushfire_forecast() -> JSONResponse:
    """Seasonal bushfire risk forecast by network zone."""
    _r.seed(803)
    result = []
    for zone_name, is_bmo in _BUSHFIRE_ZONES:
        current_risk = round(_r.uniform(20.0, 60.0) if not is_bmo else _r.uniform(45.0, 88.0), 1)
        peak_risk = round(min(current_risk * _r.uniform(1.1, 1.6), 100.0), 1)
        fuel_load = (
            "High" if peak_risk > 72 else
            "Medium" if peak_risk > 48 else
            "Low"
        )
        line_km = round(_r.uniform(80.0, 680.0), 1) if is_bmo else round(_r.uniform(20.0, 180.0), 1)
        high_risk_assets = _r.randint(12, 180) if is_bmo else _r.randint(2, 45)
        mitigation = (
            "Complete" if current_risk < 35 else
            "On Track" if _r.random() > 0.3 else
            "Behind"
        )
        result.append({
            "zone_name": zone_name,
            "bmo_zone": is_bmo,
            "risk_score_current": current_risk,
            "risk_score_peak_season": peak_risk,
            "fuel_load_rating": fuel_load,
            "powerline_length_km": line_km,
            "high_risk_assets": high_risk_assets,
            "mitigation_plan_status": mitigation,
        })
    return JSONResponse({"zones": result, "count": len(result)})
