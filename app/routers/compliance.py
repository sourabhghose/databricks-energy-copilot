"""WS6: Compliance Dashboard.

Regulatory obligations tracking, status monitoring, and timeline.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from .shared import (
    _CATALOG,
    _query_gold,
    _insert_gold,
    _update_gold,
    _sql_escape,
    _invalidate_cache,
    logger,
)

router = APIRouter()
_SCHEMA = f"{_CATALOG}.gold"


# ---------------------------------------------------------------------------
# Core functions (exported for Copilot tools)
# ---------------------------------------------------------------------------

def _get_compliance_status_core(region: Optional[str] = None) -> Dict[str, Any]:
    """Get compliance status summary across all obligations."""
    where = f"WHERE region = '{_sql_escape(region)}'" if region else ""
    rows = _query_gold(
        f"SELECT status, COUNT(*) as cnt, "
        f"SUM(CASE WHEN priority = 'CRITICAL' THEN 1 ELSE 0 END) as critical, "
        f"SUM(CASE WHEN priority = 'HIGH' THEN 1 ELSE 0 END) as high "
        f"FROM {_SCHEMA}.compliance_obligations {where} "
        f"GROUP BY status"
    )

    overdue = _query_gold(
        f"SELECT COUNT(*) as cnt FROM {_SCHEMA}.compliance_obligations "
        f"{'WHERE' if not where else where + ' AND'} due_date < current_date() "
        f"AND status NOT IN ('COMPLIANT', 'COMPLETED')"
    )

    upcoming = _query_gold(
        f"SELECT obligation_id, obligation_type, title, due_date, status, priority, region "
        f"FROM {_SCHEMA}.compliance_obligations "
        f"{'WHERE' if not where else where + ' AND'} due_date >= current_date() "
        f"AND due_date <= current_date() + INTERVAL 30 DAYS "
        f"AND status NOT IN ('COMPLIANT', 'COMPLETED') "
        f"ORDER BY due_date LIMIT 10"
    )

    total = sum(int(r.get("cnt", 0)) for r in (rows or []))
    compliant = sum(int(r["cnt"]) for r in (rows or []) if r["status"] == "COMPLIANT")

    return {
        "total_obligations": total,
        "compliant_count": compliant,
        "compliance_rate": round(compliant / max(total, 1) * 100, 1),
        "overdue_count": int((overdue or [{}])[0].get("cnt", 0)),
        "status_breakdown": rows or [],
        "upcoming_deadlines": [{**r, "due_date": str(r.get("due_date", ""))}
                                for r in (upcoming or [])],
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/api/compliance/dashboard")
async def compliance_dashboard(region: Optional[str] = None):
    """Compliance overview: status KPIs, timeline, obligations."""
    status = _get_compliance_status_core(region)

    timeline = _query_gold(
        f"SELECT obligation_type, title, due_date, status, priority, region "
        f"FROM {_SCHEMA}.compliance_obligations "
        f"ORDER BY due_date LIMIT 20"
    )

    return {
        **status,
        "timeline": [{**r, "due_date": str(r.get("due_date", ""))} for r in (timeline or [])],
    }


@router.get("/api/compliance/obligations")
async def list_obligations(region: Optional[str] = None,
                            status: Optional[str] = None,
                            limit: int = Query(50)):
    """List compliance obligations with filters."""
    parts = []
    if region:
        parts.append(f"region = '{_sql_escape(region)}'")
    if status:
        parts.append(f"status = '{_sql_escape(status)}'")
    where = f"WHERE {' AND '.join(parts)}" if parts else ""

    rows = _query_gold(
        f"SELECT * FROM {_SCHEMA}.compliance_obligations {where} "
        f"ORDER BY due_date LIMIT {limit}"
    )
    return {
        "obligations": [
            {**r, "due_date": str(r.get("due_date", "")),
             "created_at": str(r.get("created_at", "")),
             "updated_at": str(r.get("updated_at", ""))}
            for r in (rows or [])
        ]
    }


@router.post("/api/compliance/obligations")
async def create_obligation(request: Request):
    """Create a new compliance obligation."""
    body = await request.json()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    data = {
        "obligation_id": str(uuid.uuid4()),
        "obligation_type": body.get("obligation_type", "NER_COMPLIANCE"),
        "title": body.get("title", "New Obligation"),
        "description": body.get("description", ""),
        "due_date": body.get("due_date", "2026-06-30"),
        "status": "PENDING",
        "region": body.get("region", "NSW1"),
        "responsible_party": body.get("responsible_party", "Compliance Team"),
        "priority": body.get("priority", "MEDIUM"),
        "created_at": now,
        "updated_at": now,
    }
    ok = _insert_gold(f"{_SCHEMA}.compliance_obligations", data)
    if ok:
        _invalidate_cache("sql:")
        return {"status": "created", "obligation_id": data["obligation_id"]}
    return JSONResponse(status_code=500, content={"error": "Failed to create obligation"})


@router.put("/api/compliance/obligations")
async def update_obligation(request: Request):
    """Update an existing compliance obligation."""
    body = await request.json()
    obligation_id = body.get("obligation_id")
    if not obligation_id:
        return JSONResponse(status_code=400, content={"error": "obligation_id required"})

    updates = {}
    for field in ["status", "priority", "title", "description", "due_date", "responsible_party"]:
        if field in body:
            updates[field] = body[field]
    updates["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    ok = _update_gold(
        f"{_SCHEMA}.compliance_obligations",
        updates,
        f"obligation_id = '{_sql_escape(obligation_id)}'"
    )
    if ok:
        _invalidate_cache("sql:")
        return {"status": "updated", "obligation_id": obligation_id}
    return JSONResponse(status_code=500, content={"error": "Failed to update obligation"})


@router.get("/api/compliance/timeline")
async def compliance_timeline(months_ahead: int = Query(6)):
    """Get compliance timeline for upcoming deadlines."""
    rows = _query_gold(
        f"SELECT obligation_id, obligation_type, title, due_date, status, priority, region "
        f"FROM {_SCHEMA}.compliance_obligations "
        f"WHERE due_date >= current_date() "
        f"AND due_date <= current_date() + INTERVAL {months_ahead} MONTHS "
        f"ORDER BY due_date LIMIT 50"
    )
    return {
        "months_ahead": months_ahead,
        "deadlines": [{**r, "due_date": str(r.get("due_date", ""))} for r in (rows or [])],
    }
