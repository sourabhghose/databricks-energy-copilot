"""
Integration tests for the FastAPI backend. All external dependencies
(Databricks, Anthropic, Lakebase) are mocked. Tests run without any live
services.

The module-level environment variable stubs trigger mock_mode=True in both
DatabricksSQLClient (DATABRICKS_HOST unset causes no-op) and LakebaseClient
(LAKEBASE_HOST unset), so every endpoint falls through to the built-in mock
data logic in mock_data.py — no real DB or LLM calls are required.

Run:
    pytest tests/test_backend.py -v
"""

from __future__ import annotations

import json
import os

# ---------------------------------------------------------------------------
# Environment stubs — must be set BEFORE importing app.backend.main so that
# DatabricksSQLClient and LakebaseClient initialise in mock_mode=True.
# ---------------------------------------------------------------------------
os.environ.setdefault("DATABRICKS_HOST", "https://dummy.azuredatabricks.net")
os.environ.setdefault("DATABRICKS_TOKEN", "dapi-dummy-token")
os.environ.setdefault("DATABRICKS_WAREHOUSE_ID", "dummy-warehouse-id")
os.environ.setdefault("DATABRICKS_CATALOG", "energy_copilot")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-dummy-key")

# Deliberately leave LAKEBASE_HOST and LAKEBASE_PASSWORD unset so that
# LakebaseClient also initialises in mock_mode=True — all alert endpoints
# will then use the mock data helpers rather than attempting a real Postgres
# connection.

from unittest.mock import MagicMock, patch  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from app.backend.main import app  # noqa: E402

# ---------------------------------------------------------------------------
# Shared synchronous TestClient (wraps the ASGI app; no live server needed)
# ---------------------------------------------------------------------------
client = TestClient(app)


# ===========================================================================
# TestHealthEndpoint
# ===========================================================================

class TestHealthEndpoint:
    """Tests for the GET /health endpoint (service health check)."""

    def test_health_returns_200(self):
        """GET /health must return 200 with status 'ok' or 'degraded'.

        In mock_mode both _db.health_check() and _lakebase.health_check()
        always return True, so the response status will be 'ok'.
        """
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        # In mock mode both health checks return True → status == 'ok'
        assert data["status"] in ("ok", "degraded")
        assert "mock_mode" in data


# ===========================================================================
# TestPricesEndpoint
# ===========================================================================

class TestPricesEndpoint:
    """Tests for /api/prices/* endpoints."""

    def test_latest_prices_returns_list(self):
        """GET /api/prices/latest should return 200 with a non-empty list.

        Each item must contain at least the 'region' and 'rrp' keys (which
        map to the 'price' concept described in the task; the actual field
        name in PriceRecord is 'rrp').
        """
        response = client.get("/api/prices/latest")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        for item in data:
            assert "region" in item
            assert "rrp" in item

    def test_prices_history_requires_region(self):
        """GET /api/prices/history without any query params must return 422.

        'region', 'start', and 'end' are all required query parameters;
        FastAPI/Pydantic returns 422 Unprocessable Entity when they are absent.
        """
        response = client.get("/api/prices/history")
        assert response.status_code == 422

    def test_prices_history_with_region(self):
        """GET /api/prices/history with all required params returns 200 and a list."""
        response = client.get(
            "/api/prices/history",
            params={
                "region": "NSW1",
                "start": "2026-02-19T00:00:00",
                "end": "2026-02-19T01:00:00",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Mock data generator returns at least one record for a 1-hour window
        assert len(data) > 0


# ===========================================================================
# TestForecastsEndpoint
# ===========================================================================

class TestForecastsEndpoint:
    """Tests for the GET /api/forecasts endpoint."""

    def test_forecasts_endpoint(self):
        """GET /api/forecasts?region=NSW1 returns 200 with a non-empty list.

        In mock_mode get_mock_forecasts() generates synthetic forecast data;
        each record contains 'region', 'forecast_time', 'horizon_minutes',
        and 'predicted_rrp'.
        """
        response = client.get("/api/forecasts", params={"region": "NSW1"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        for item in data:
            assert "region" in item
            assert "predicted_rrp" in item


# ===========================================================================
# TestGenerationEndpoint
# ===========================================================================

class TestGenerationEndpoint:
    """Tests for the GET /api/generation endpoint."""

    def test_generation_endpoint(self):
        """GET /api/generation?region=NSW1 returns 200 with a list or dict.

        In mock_mode get_mock_generation() returns the latest dispatch
        interval for NSW1, which may be a single or multiple rows depending
        on the number of fuel types.
        """
        response = client.get("/api/generation", params={"region": "NSW1"})
        assert response.status_code == 200
        data = response.json()
        # The endpoint returns List[GenerationRecord]; a dict is also acceptable
        # if a future refactor wraps the list.
        assert isinstance(data, (list, dict))


# ===========================================================================
# TestAlertsEndpoint
# ===========================================================================

class TestAlertsEndpoint:
    """Tests for the /api/alerts CRUD endpoints."""

    def test_list_alerts(self):
        """GET /api/alerts returns 200 with a list (may be empty or populated).

        In mock_mode the endpoint returns the 3 example alerts from
        mock_data.get_mock_alerts().
        """
        response = client.get("/api/alerts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_alert_validation(self):
        """POST /api/alerts with an invalid body returns 422.

        Sending an empty JSON object is missing the required 'alert_type'
        and 'threshold_value' fields, which triggers Pydantic validation.
        """
        response = client.post("/api/alerts", json={})
        assert response.status_code == 422

    def test_create_alert_valid(self):
        """POST /api/alerts with a valid body returns 200 or 201.

        The endpoint is annotated status_code=201 for the created response.
        In mock_mode the alert is not persisted to Postgres — the handler
        returns the new_alert dict constructed from the request body.
        """
        payload = {
            "region": "NSW1",
            "alert_type": "PRICE_THRESHOLD",
            "threshold_value": 300.0,
            "notification_channel": "EMAIL",
        }
        response = client.post("/api/alerts", json=payload)
        assert response.status_code in (200, 201)
        data = response.json()
        assert "alert_id" in data
        assert data["alert_type"] == "PRICE_THRESHOLD"
        assert data["threshold_value"] == 300.0

    def test_delete_alert_not_found(self):
        """DELETE /api/alerts/<unknown-id> returns 404.

        In mock_mode the delete handler checks whether the ID exists in the
        mock alert list.  A random UUID that is not in that list must return
        404 Not Found so the caller can distinguish 'not found' from 'deleted'.
        """
        response = client.delete("/api/alerts/nonexistent-id-00000000")
        assert response.status_code == 404


# ===========================================================================
# TestChatEndpoint
# ===========================================================================

class TestChatEndpoint:
    """Tests for the POST /api/chat SSE streaming endpoint."""

    def test_chat_requires_message(self):
        """POST /api/chat with an empty body returns 422.

        'message' is a required field with min_length=1 on the ChatRequest
        model; an empty JSON object must fail validation.
        """
        response = client.post("/api/chat", json={})
        assert response.status_code == 422

    def test_chat_returns_stream(self):
        """POST /api/chat with a valid body returns 200 with SSE or JSON content.

        We mock _stream_chat so that the Anthropic client is never called.
        The response should be 200 and the content-type should indicate either
        Server-Sent Events ('text/event-stream') or JSON ('application/json').

        EventSourceResponse from sse-starlette sets the content-type to
        'text/event-stream'.  In some test environments the sync TestClient
        may receive the response body as plain text; we therefore assert on
        status code and accept either content-type variant.
        """

        async def _fake_stream(request):
            """Minimal SSE generator that does NOT call Anthropic."""
            yield f"data: {json.dumps({'type': 'text', 'content': 'NSW1 spot price is $85/MWh.'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        with patch("app.backend.main._stream_chat", side_effect=_fake_stream):
            response = client.post(
                "/api/chat",
                json={
                    "message": "What is the NSW spot price?",
                    "history": [],
                },
            )

        assert response.status_code == 200
        content_type = response.headers.get("content-type", "")
        assert "text/event-stream" in content_type or "application/json" in content_type
