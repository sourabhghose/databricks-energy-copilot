"""AIO (Annual Regulatory Information) Compliance Management.

Endpoints for tracking AIO section completion, STPIS incentive scheme metrics,
submission validation, and revenue impact forecasting for Australian DNSPs.
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

_SECTION_NAMES = [
    "Capital Expenditure",
    "Operating Expenditure",
    "Reliability Performance",
    "Connection Standards",
    "Demand Management",
    "Price & Revenue",
    "Assets & Network",
    "Customer Service",
]

_TEAMS = [
    "Regulatory Affairs",
    "Finance & Treasury",
    "Network Operations",
    "Customer Experience",
    "Asset Management",
    "Strategy & Planning",
]


# =========================================================================
# GET /api/aio/summary
# =========================================================================

@router.get("/api/aio/summary")
async def aio_summary() -> JSONResponse:
    """Overall AIO compliance status for AusNet Services."""
    _r.seed(720)
    completed = _r.randint(5, 7)
    score = round(_r.uniform(78.0, 96.0), 1)
    s_factor = round(_r.uniform(-0.02, 0.02), 4)
    revenue_impact = round(s_factor * 950.0 * _r.uniform(0.8, 1.2), 2)
    next_due = date.today() + timedelta(days=_r.randint(14, 120))
    return JSONResponse({
        "dnsp_name": "AusNet Services",
        "total_sections": 8,
        "completed_sections": completed,
        "in_progress_sections": 8 - completed - _r.randint(0, 1),
        "overall_score_pct": score,
        "stpis_s_factor": s_factor,
        "revenue_impact_m": revenue_impact,
        "next_due_date": next_due.isoformat(),
        "regulatory_period": "2025-2030",
        "last_updated": date.today().isoformat(),
        "data_source": "synthetic",
    })


# =========================================================================
# GET /api/aio/stpis
# =========================================================================

@router.get("/api/aio/stpis")
async def aio_stpis() -> JSONResponse:
    """STPIS performance incentive scheme metrics per DNSP."""
    _r.seed(721)
    dnsp_params = [
        ("AusNet Services",  75.0,  1.00, 950.0),
        ("Ergon Energy",    140.0,  1.60, 1200.0),
        ("Energex",          80.0,  1.10, 1800.0),
        ("Ausgrid",          70.0,  0.95, 1600.0),
        ("Essential Energy", 160.0, 1.75, 750.0),
        ("SA Power Networks", 90.0,  1.20, 870.0),
    ]
    result = []
    for dnsp, saidi_t, saifi_t, rev_base in dnsp_params:
        saidi_a = round(saidi_t * _r.uniform(0.72, 1.28), 2)
        saifi_a = round(saifi_t * _r.uniform(0.72, 1.28), 3)
        s_saidi = round((saidi_t - saidi_a) / saidi_t * 0.5, 4)
        s_saifi = round((saifi_t - saifi_a) / saifi_t * 0.5, 4)
        s_factor = round(max(-0.02, min(0.02, s_saidi + s_saifi)), 4)
        band = (
            "A" if s_factor > 0.01 else
            "B" if s_factor >= 0 else
            "C" if s_factor > -0.01 else
            "D"
        )
        rev_adj = round(s_factor * rev_base, 3)
        result.append({
            "dnsp": dnsp,
            "saidi_minutes": saidi_a,
            "saifi_events": saifi_a,
            "saidi_target": saidi_t,
            "saifi_target": saifi_t,
            "s_factor": s_factor,
            "band": band,
            "revenue_adjustment_m": rev_adj,
        })
    return JSONResponse({"stpis": result, "count": len(result)})


# =========================================================================
# GET /api/aio/sections
# =========================================================================

@router.get("/api/aio/sections")
async def aio_sections() -> JSONResponse:
    """AIO section completion status for all 8 sections."""
    _r.seed(722)
    sections = []
    today = date.today()
    statuses = ["Complete", "Complete", "Complete", "Complete", "Complete",
                "In Progress", "In Progress", "Not Started"]
    _r.shuffle(statuses)
    for i, (name, status) in enumerate(zip(_SECTION_NAMES, statuses), start=1):
        if status == "Complete":
            pct = 100.0
        elif status == "In Progress":
            pct = round(_r.uniform(35.0, 85.0), 1)
        else:
            pct = 0.0
        due = today + timedelta(days=_r.randint(10, 180))
        sections.append({
            "section_id": i,
            "section_name": name,
            "status": status,
            "completion_pct": pct,
            "due_date": due.isoformat(),
            "responsible_team": _r.choice(_TEAMS),
        })
    return JSONResponse({"sections": sections, "count": len(sections)})


# =========================================================================
# GET /api/aio/validation
# =========================================================================

@router.get("/api/aio/validation")
async def aio_validation() -> JSONResponse:
    """AIO submission validation issues across all sections."""
    _r.seed(723)
    issue_types = ["Missing Data", "Out of Range", "Format Error"]
    severities = ["Critical", "Warning"]
    descriptions = {
        "Missing Data": [
            "Asset replacement value not populated for zone substation assets",
            "Vegetation clearance completion date missing for Q3 works",
            "Customer complaint resolution time not reported for September",
        ],
        "Out of Range": [
            "SAIDI exclusion percentage exceeds AER-permitted threshold of 20%",
            "Opex growth rate of 14.2% is above peer average of 6.8%",
            "Capex forecast variance exceeds ±15% allowed tolerance band",
        ],
        "Format Error": [
            "Date field in Section 3 uses DD/MM/YYYY instead of ISO 8601",
            "Revenue figure reported in thousands rather than millions AUD",
            "Feeder ID format does not match AER RIN naming convention",
        ],
    }
    issues = []
    for _ in range(_r.randint(6, 12)):
        section = _r.choice(_SECTION_NAMES)
        issue_type = _r.choice(issue_types)
        severity = _r.choice(severities)
        issues.append({
            "section": section,
            "field": _r.choice([
                "saidi_minutes", "opex_m", "capex_m", "asset_age_yrs",
                "customer_count", "network_length_km", "submission_date",
                "revenue_allowed_m", "clearance_pct", "feeder_id",
            ]),
            "issue_type": issue_type,
            "severity": severity,
            "description": _r.choice(descriptions[issue_type]),
        })
    critical_count = sum(1 for i in issues if i["severity"] == "Critical")
    return JSONResponse({
        "issues": issues,
        "total_issues": len(issues),
        "critical_count": critical_count,
        "warning_count": len(issues) - critical_count,
    })
