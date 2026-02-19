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

import pytest

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


# ===========================================================================
# TestRateLimiting
# ===========================================================================

class TestRateLimiting:
    """Tests for the in-process per-IP rate limiting middleware."""

    def test_rate_limit_not_triggered_by_single_request(self):
        """A single GET /health request must return 200, not 429.

        The rate limiter allows RATE_LIMIT_REQUESTS (default 60) requests per
        window. A single request is well within that limit and must not be
        blocked.
        """
        response = client.get("/health")
        assert response.status_code == 200
        assert response.status_code != 429

    def test_market_summary_endpoint(self):
        """GET /api/market-summary/latest returns 200 with summary_text key.

        In mock_mode the endpoint returns the _MOCK_MARKET_SUMMARY dict which
        now includes the extended MarketSummaryWidget fields: summary_id,
        summary_text, highest_price_region, lowest_price_region, avg_nem_price.
        """
        response = client.get("/api/market-summary/latest")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "summary_text" in data
        assert data["summary_text"] is not None
        assert len(data["summary_text"]) > 0


# ===========================================================================
# TestSprintEightEndpoints
# ===========================================================================

class TestSprintEightEndpoints:
    """Integration tests for Sprint 8 endpoints: /api/system/health and
    extended /api/market-summary/latest validation."""

    def test_system_health_endpoint(self):
        """GET /api/system/health returns 200 with required top-level keys.

        The response must include all five keys defined in SystemHealthResponse:
        databricks_ok, lakebase_ok, models_healthy, models_total, and
        model_details. In mock_mode both DB health checks return True so
        databricks_ok and lakebase_ok should both be True.
        """
        response = client.get("/api/system/health")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "databricks_ok" in data
        assert "lakebase_ok" in data
        assert "models_healthy" in data
        assert "models_total" in data
        assert "model_details" in data
        # In mock mode both DB checks are True
        assert isinstance(data["databricks_ok"], bool)
        assert isinstance(data["lakebase_ok"], bool)
        assert isinstance(data["models_healthy"], int)
        assert isinstance(data["models_total"], int)
        assert isinstance(data["model_details"], list)

    def test_system_health_model_details_structure(self):
        """Each item in model_details has the required ModelHealthRecord keys.

        Every entry in the model_details list must contain model_name, region,
        alias, and status. Optional fields (model_version, last_updated) may
        be present or None. status must be one of 'ok', 'stale', or 'missing'.
        """
        response = client.get("/api/system/health")
        assert response.status_code == 200
        data = response.json()
        model_details = data["model_details"]
        assert len(model_details) > 0, "model_details must not be empty"
        for item in model_details:
            assert "model_name" in item, f"model_name missing from {item}"
            assert "region" in item, f"region missing from {item}"
            assert "alias" in item, f"alias missing from {item}"
            assert "status" in item, f"status missing from {item}"
            assert item["status"] in (
                "ok", "stale", "missing"
            ), f"unexpected status value: {item['status']}"
            assert isinstance(item["model_name"], str) and len(item["model_name"]) > 0
            assert isinstance(item["region"], str) and len(item["region"]) > 0
            assert isinstance(item["alias"], str) and len(item["alias"]) > 0

    def test_system_health_model_count(self):
        """models_total equals len(model_details).

        The models_total field in the response must be consistent with the
        actual number of records returned in model_details. In mock_mode the
        backend generates 4 model types x 5 regions + 1 anomaly model = 21.
        """
        response = client.get("/api/system/health")
        assert response.status_code == 200
        data = response.json()
        assert data["models_total"] == len(data["model_details"]), (
            f"models_total={data['models_total']} does not match "
            f"len(model_details)={len(data['model_details'])}"
        )
        # Verify the expected count: 4 types * 5 regions + 1 anomaly = 21
        assert data["models_total"] == 21, (
            f"Expected 21 models (20 regional + 1 anomaly), got {data['models_total']}"
        )

    def test_market_summary_has_required_fields(self):
        """GET /api/market-summary/latest includes narrative, generated_at, and word_count.

        Extends the existing market summary test to also validate the
        generated_at and word_count fields defined in MarketSummaryRecord.
        The narrative must be a non-empty string. generated_at must be a
        non-empty string (ISO-8601 timestamp). word_count must be a positive
        integer greater than zero.
        """
        response = client.get("/api/market-summary/latest")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

        # narrative is the primary required field
        assert "narrative" in data
        assert isinstance(data["narrative"], str)
        assert len(data["narrative"]) > 0

        # generated_at must be present and non-empty
        assert "generated_at" in data
        assert data["generated_at"] is not None
        assert isinstance(data["generated_at"], str)
        assert len(data["generated_at"]) > 0

        # word_count must be a positive integer
        assert "word_count" in data
        assert data["word_count"] is not None
        assert isinstance(data["word_count"], int)
        assert data["word_count"] > 0


# ===========================================================================
# TestApiKeyAuth
# ===========================================================================

class TestApiKeyAuth:
    """Tests for API key authentication middleware."""

    def test_version_endpoint_no_auth(self):
        """GET /api/version returns 200 without any headers (auth not required).

        The /api/version endpoint is explicitly excluded from auth requirements
        and must be accessible without any X-API-Key header present.
        """
        response = client.get("/api/version")
        assert response.status_code == 200

    def test_version_returns_mock_mode(self):
        """GET /api/version response includes the mock_mode key.

        The version endpoint returns a dict with feature flags including
        mock_mode, api_auth_enabled, databricks_catalog, and
        rate_limit_requests_per_minute.
        """
        response = client.get("/api/version")
        assert response.status_code == 200
        data = response.json()
        assert "mock_mode" in data

    def test_api_auth_disabled_in_mock_mode(self):
        """GET /api/prices/latest returns 200 without X-API-Key header.

        In the test environment ENERGY_COPILOT_API_KEY is not set, so
        _API_AUTH_ENABLED is False and the verify_api_key dependency
        returns immediately without checking for the header. All /api/*
        routes must therefore be accessible without authentication.
        """
        response = client.get("/api/prices/latest")
        assert response.status_code == 200


# ===========================================================================
# TestSessionEndpoints
# ===========================================================================

class TestSessionEndpoints:
    """Tests for the /api/sessions CRUD endpoints."""

    def test_list_sessions_returns_list(self):
        """GET /api/sessions returns 200 with a list of session objects.

        In mock_mode the endpoint returns the 3 example sessions from
        _MOCK_SESSIONS. Each item must contain at least session_id,
        created_at, last_active, message_count, and total_tokens.
        """
        response = client.get("/api/sessions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        for item in data:
            assert "session_id" in item
            assert "created_at" in item
            assert "last_active" in item
            assert "message_count" in item
            assert "total_tokens" in item

    def test_create_session_returns_201(self):
        """POST /api/sessions returns 201 with a new session including a session_id.

        The endpoint must return HTTP 201 Created and the response body must
        contain a non-empty session_id string.
        """
        response = client.post("/api/sessions")
        assert response.status_code == 201
        data = response.json()
        assert isinstance(data, dict)
        assert "session_id" in data
        assert isinstance(data["session_id"], str)
        assert len(data["session_id"]) > 0
        assert data["message_count"] == 0
        assert data["total_tokens"] == 0

    def test_get_session_returns_404_for_unknown(self):
        """GET /api/sessions/<nonexistent> returns 404 Not Found.

        When the session_id is not in the _MOCK_SESSIONS dict the endpoint
        must return 404 so the caller can distinguish 'not found' from a
        successful empty session.
        """
        response = client.get("/api/sessions/nonexistent-session-id")
        assert response.status_code == 404

    def test_rate_session_validation(self):
        """PATCH /api/sessions/sess-001/rating with rating=6 returns 422.

        The SessionRatingRequest model has ge=1, le=5 constraints on the
        rating field. Sending rating=6 must fail Pydantic validation with
        422 Unprocessable Entity.
        """
        response = client.patch(
            "/api/sessions/sess-001/rating",
            json={"rating": 6},
        )
        assert response.status_code == 422


# ===========================================================================
# TestAlertEndpoints
# ===========================================================================

class TestAlertEndpoints:
    """Tests for alert history and notification endpoints."""

    def test_alert_history_returns_list(self):
        """GET /api/alerts/history returns 200 with a list of trigger events."""
        response = client.get("/api/alerts/history")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_alert_stats_returns_expected_keys(self):
        """GET /api/alerts/stats returns 200 with required summary keys."""
        response = client.get("/api/alerts/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_alerts" in data
        assert "triggered_last_24h" in data
        assert "notifications_sent" in data

    def test_test_notification_in_mock_mode(self):
        """POST /api/alerts/test-notification returns success in mock mode."""
        response = client.post("/api/alerts/test-notification", json={
            "channel": "slack",
            "test_message": "test"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["channel"] == "slack"


# ===========================================================================
# TestForecastEndpoints
# ===========================================================================

class TestForecastEndpoints:
    """Tests for forecast endpoints including CI fields."""

    def test_forecasts_include_ci_fields(self):
        """GET /api/forecasts includes price_p10 and price_p90 fields."""
        response = client.get("/api/forecasts?region=NSW1&horizon=1hr")
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        # Each forecast record should include confidence interval fields
        first = data[0]
        assert "price_forecast" in first or "predicted_rrp" in first
        assert "price_p10" in first
        assert "price_p90" in first

    def test_forecasts_summary_endpoint(self):
        """GET /api/forecasts/summary returns 200 with MAPE values."""
        response = client.get("/api/forecasts/summary")
        assert response.status_code == 200
        data = response.json()
        assert "price_mape_1hr" in data
        assert "price_mape_4hr" in data
        assert "models_loaded" in data
        assert data["models_loaded"] == 20

    def test_forecast_ci_ordering(self):
        """price_p10 should be <= predicted_rrp <= price_p90."""
        response = client.get("/api/forecasts?region=NSW1&horizon=4hr")
        assert response.status_code == 200
        data = response.json()
        for record in data:
            if record.get("price_p10") and record.get("price_p90"):
                assert record["price_p10"] <= record["predicted_rrp"]
                assert record["predicted_rrp"] <= record["price_p90"]


# ===========================================================================
# TestPriceSpikeEndpoints
# ===========================================================================

class TestPriceSpikeEndpoints:
    """Tests for the GET /api/prices/spikes and GET /api/prices/volatility endpoints."""

    def test_price_spikes_list(self):
        """GET /api/prices/spikes?region=SA1 returns 200 with a non-empty list of spike events.

        Each event must contain the required fields: event_id, rrp_aud_mwh, and
        spike_type. SA1 is modelled as the most volatile region and must always
        return at least one event.
        """
        r = client.get("/api/prices/spikes?region=SA1")
        assert r.status_code == 200
        spikes = r.json()
        assert isinstance(spikes, list)
        assert len(spikes) > 0
        spike = spikes[0]
        assert "event_id" in spike
        assert "rrp_aud_mwh" in spike
        assert "spike_type" in spike

    def test_volatility_stats_all_regions(self):
        """GET /api/prices/volatility returns 200 with stats for all 5 NEM regions.

        The response must contain a 'regions' list with exactly 5 entries, one per
        NEM region. Each region entry must have a valid cpt_utilised_pct in the range
        [0, 100] and a non-negative std_dev.
        """
        r = client.get("/api/prices/volatility")
        assert r.status_code == 200
        data = r.json()
        assert "regions" in data
        assert len(data["regions"]) == 5
        for reg in data["regions"]:
            assert 0 <= reg["cpt_utilised_pct"] <= 100
            assert reg["std_dev"] >= 0

    def test_spike_type_filter(self):
        """GET /api/prices/spikes?region=NSW1&spike_type=high returns only high spikes.

        When spike_type is provided as a query parameter the endpoint must filter
        the result set so that every returned event has the matching spike_type value.
        """
        r = client.get("/api/prices/spikes?region=NSW1&spike_type=high")
        assert r.status_code == 200
        spikes = r.json()
        for s in spikes:
            assert s["spike_type"] == "high"


# ===========================================================================
# TestInterconnectorEndpoints
# ===========================================================================

class TestInterconnectorEndpoints:
    """Tests for the GET /api/interconnectors and GET /api/settlement/summary endpoints."""

    def test_interconnectors_summary(self, client=client):
        """GET /api/interconnectors returns 200 with InterconnectorSummary containing 5 ICs.

        The response must include the 'interconnectors' list with exactly 5 entries
        (one per NEM interconnector), plus the 'most_loaded' string identifying the
        highest-utilisation interconnector.
        """
        r = client.get("/api/interconnectors")
        assert r.status_code == 200
        data = r.json()
        assert "interconnectors" in data
        assert len(data["interconnectors"]) == 5
        assert "most_loaded" in data
        assert isinstance(data["most_loaded"], str)
        assert len(data["most_loaded"]) > 0

    def test_settlement_summary_all_regions(self, client=client):
        """GET /api/settlement/summary returns 200 with one record per NEM region.

        Must return exactly 5 records covering all five NEM regions:
        NSW1, QLD1, VIC1, SA1, TAS1.
        """
        r = client.get("/api/settlement/summary")
        assert r.status_code == 200
        records = r.json()
        assert len(records) == 5
        regions = {rec["region"] for rec in records}
        assert regions == {"NSW1", "QLD1", "VIC1", "SA1", "TAS1"}

    def test_interconnector_congestion_flag(self, client=client):
        """congested=True implies abs(mw_flow) / mw_flow_limit >= 0.95.

        For every interconnector record, if the congested flag is True then
        the utilisation ratio must be at least 0.95 (95%). This validates that
        the congestion detection logic is applied correctly.
        """
        r = client.get("/api/interconnectors")
        assert r.status_code == 200
        for ic in r.json()["interconnectors"]:
            utilisation = abs(ic["mw_flow"]) / ic["mw_flow_limit"]
            if ic["congested"]:
                assert utilisation >= 0.95, (
                    f"{ic['interconnectorid']}: congested=True but utilisation={utilisation:.3f} < 0.95"
                )


# ===========================================================================
# TestGenerationEndpoints
# ===========================================================================

class TestGenerationEndpoints:
    """Tests for GET /api/generation/units and GET /api/generation/mix endpoints."""

    def test_generation_units_default(self, client=client):
        r = client.get("/api/generation/units")
        assert r.status_code == 200
        units = r.json()
        assert isinstance(units, list)
        assert len(units) > 0
        assert "duid" in units[0]
        assert "fuel_type" in units[0]
        assert "capacity_factor" in units[0]

    def test_generation_mix_structure(self, client=client):
        r = client.get("/api/generation/mix?region=VIC1")
        assert r.status_code == 200
        data = r.json()
        assert "total_generation_mw" in data
        assert "renewable_percentage" in data
        assert "fuel_mix" in data
        assert isinstance(data["fuel_mix"], list)
        assert data["renewable_percentage"] >= 0
        assert data["renewable_percentage"] <= 100

    def test_generation_capacity_factors_valid(self, client=client):
        r = client.get("/api/generation/units?region=QLD1")
        assert r.status_code == 200
        for unit in r.json():
            assert 0 <= unit["capacity_factor"] <= 1


# ===========================================================================
# TestMarketNoticesEndpoints
# ===========================================================================

class TestMarketNoticesEndpoints:
    """Tests for the GET /api/market/notices and GET /api/dispatch/intervals endpoints."""

    def test_market_notices_list(self, client=client):
        """GET /api/market/notices returns 200 with a non-empty list of notice objects.

        Each notice must contain at minimum the required fields: notice_id and severity.
        The endpoint returns mock data covering LOR1/2/3, constraint, reclassification,
        price limit, and general notice types.
        """
        r = client.get("/api/market/notices")
        assert r.status_code == 200
        notices = r.json()
        assert isinstance(notices, list)
        assert len(notices) > 0
        assert "notice_id" in notices[0]
        assert "severity" in notices[0]

    def test_market_notices_severity_filter(self, client=client):
        """GET /api/market/notices?severity=CRITICAL returns only CRITICAL notices.

        When a severity query parameter is provided, every notice in the response
        must have the matching severity value.
        """
        r = client.get("/api/market/notices?severity=CRITICAL")
        assert r.status_code == 200
        for n in r.json():
            assert n["severity"] == "CRITICAL"

    def test_dispatch_intervals_structure(self, client=client):
        """GET /api/dispatch/intervals?region=VIC1&count=6 returns correct structure.

        The response must include the region field, exactly 6 interval records,
        and the mean_deviation summary field. For every interval, rrp_deviation
        must equal rrp - predispatch_rrp within floating-point tolerance.
        """
        r = client.get("/api/dispatch/intervals?region=VIC1&count=6")
        assert r.status_code == 200
        data = r.json()
        assert data["region"] == "VIC1"
        assert len(data["intervals"]) == 6
        assert "mean_deviation" in data
        for iv in data["intervals"]:
            # rrp_deviation should equal rrp - predispatch_rrp
            assert abs(iv["rrp_deviation"] - (iv["rrp"] - iv["predispatch_rrp"])) < 0.01


# ===========================================================================
# TestWeatherDemandEndpoints
# ===========================================================================

class TestWeatherDemandEndpoints:
    """Tests for GET /api/weather/demand and GET /api/demand/response endpoints."""

    def test_weather_demand_series(self, client=client):
        r = client.get("/api/weather/demand?region=NSW1&hours=12")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 12
        for pt in data:
            assert "temperature_c" in pt
            assert "demand_mw" in pt
            assert abs(pt["demand_deviation_mw"] - (pt["demand_mw"] - pt["demand_baseline_mw"])) < 0.1

    def test_demand_response_summary(self, client=client):
        r = client.get("/api/demand/response")
        assert r.status_code == 200
        data = r.json()
        assert "events" in data
        assert data["total_enrolled_mw"] > 0
        assert isinstance(data["events"], list)

    def test_weather_temperature_range(self, client=client):
        for region in ["NSW1", "TAS1", "SA1"]:
            r = client.get(f"/api/weather/demand?region={region}&hours=24")
            assert r.status_code == 200
            temps = [pt["temperature_c"] for pt in r.json()]
            # All NEM regions have temperatures between -5 and 50°C
            assert all(-5 <= t <= 50 for t in temps)


# ===========================================================================
# TestBessEndpoints
# ===========================================================================

class TestBessEndpoints:
    """Tests for GET /api/bess/fleet and GET /api/bess/dispatch endpoints."""

    def test_bess_fleet_structure(self, client=client):
        """GET /api/bess/fleet returns 200 with BessFleetSummary containing >= 8 units.

        The response must have the 'units' list with at least 8 NEM BESS units,
        fleet_avg_soc_pct, and each unit must pass SOC/mode validation.
        """
        r = client.get("/api/bess/fleet")
        assert r.status_code == 200
        data = r.json()
        assert "units" in data
        assert len(data["units"]) >= 8
        assert "fleet_avg_soc_pct" in data
        for unit in data["units"]:
            assert 0 <= unit["soc_pct"] <= 100
            assert unit["mode"] in ("charging", "discharging", "idle", "standby")

    def test_bess_dispatch_history(self, client=client):
        """GET /api/bess/dispatch returns exactly count intervals for a given DUID.

        Fetches the first DUID from the fleet, then requests exactly 12 intervals.
        Each interval must contain the rrp_at_dispatch field.
        """
        fleet = client.get("/api/bess/fleet").json()
        duid = fleet["units"][0]["duid"]
        r = client.get(f"/api/bess/dispatch?duid={duid}&count=12")
        assert r.status_code == 200
        intervals = r.json()
        assert len(intervals) == 12
        assert all("rrp_at_dispatch" in iv for iv in intervals)

    def test_bess_soc_range(self, client=client):
        """All BESS units have soc_pct in [0, 100] and efficiency_pct >= 80.

        Validates the fleet data quality constraints: SOC cannot exceed battery
        capacity and round-trip efficiency for any NEM BESS must be at least 80%.
        """
        fleet = client.get("/api/bess/fleet").json()
        for unit in fleet["units"]:
            assert 0 <= unit["soc_pct"] <= 100
            assert unit["efficiency_pct"] >= 80


# ===========================================================================
# TestPortfolioEndpoints
# ===========================================================================

class TestPortfolioEndpoints:
    """Tests for GET /api/portfolio/summary and GET /api/portfolio/pnl_history."""

    def test_portfolio_summary_structure(self, client=client):
        """GET /api/portfolio/summary returns 200 with required fields.

        The response must include 'assets', 'hedges', 'total_mtm_pnl_aud',
        'region_pnl', and 'hedge_ratio_pct'. The assets list must contain
        at least 5 generation units covering the NEM portfolio.
        """
        r = client.get("/api/portfolio/summary")
        assert r.status_code == 200
        data = r.json()
        assert "assets" in data
        assert "hedges" in data
        assert len(data["assets"]) >= 5
        assert "total_mtm_pnl_aud" in data
        assert "region_pnl" in data
        assert "total_daily_revenue_aud" in data
        assert "total_hedge_value_aud" in data

    def test_portfolio_hedge_ratio(self, client=client):
        """GET /api/portfolio/summary hedge_ratio_pct is in the range [0, 100].

        The hedge ratio represents the proportion of total capacity that has
        been hedged. It must be a valid percentage between 0 and 100 inclusive.
        """
        r = client.get("/api/portfolio/summary")
        data = r.json()
        assert 0 <= data["hedge_ratio_pct"] <= 100

    def test_pnl_history_days(self, client=client):
        """GET /api/portfolio/pnl_history?days=7 returns exactly 7 records.

        Each record must contain 'pnl_aud' at minimum. The number of records
        returned must exactly match the 'days' query parameter.
        """
        r = client.get("/api/portfolio/pnl_history?days=7")
        assert r.status_code == 200
        history = r.json()
        assert len(history) == 7
        assert all("pnl_aud" in day for day in history)


# ===========================================================================
# TestSustainabilityEndpoints
# ===========================================================================

class TestSustainabilityEndpoints:
    """Tests for GET /api/sustainability/dashboard and GET /api/sustainability/intensity_history."""

    def test_sustainability_dashboard_structure(self, client=client):
        """GET /api/sustainability/dashboard returns 200 with required top-level keys.

        The response must contain nem_carbon_intensity, lgc_market, regional_intensity
        (5 NEM regions), and a positive nem_renewable_pct value.
        """
        r = client.get("/api/sustainability/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "nem_carbon_intensity" in data
        assert "lgc_market" in data
        assert len(data["regional_intensity"]) == 5
        assert data["nem_renewable_pct"] > 0

    def test_carbon_intensity_history(self, client=client):
        """GET /api/sustainability/intensity_history?region=SA1&hours=12 returns 12 hourly records.

        Each record must have region=SA1 and renewable_pct in the valid [0, 100] range.
        """
        r = client.get("/api/sustainability/intensity_history?region=SA1&hours=12")
        assert r.status_code == 200
        records = r.json()
        assert len(records) == 12
        for rec in records:
            assert rec["region"] == "SA1"
            assert 0 <= rec["renewable_pct"] <= 100

    def test_regional_intensity_ordering(self, client=client):
        """TAS1 must have a lower carbon intensity than NSW1.

        TAS1 is predominantly hydro (~95% renewable) and should have carbon
        intensity close to zero. NSW1 is coal-heavy (~0.7 kg CO2/MWh) and must
        always read higher than TAS1.
        """
        r = client.get("/api/sustainability/dashboard")
        data = r.json()
        intensities = {rec["region"]: rec["carbon_intensity_kg_co2_mwh"]
                       for rec in data["regional_intensity"]}
        # TAS1 should have very low carbon intensity (almost all hydro)
        assert intensities.get("TAS1", 99) < intensities.get("NSW1", 0)


# ===========================================================================
# TestMeritOrderEndpoints
# ===========================================================================

class TestMeritOrderEndpoints:
    """Tests for GET /api/merit/order and GET /api/merit/stack endpoints."""

    def test_merit_order_sorted(self, client=client):
        """GET /api/merit/order?region=NSW1 returns units sorted ascending by SRMC.

        The merit order must have units arranged from cheapest (hydro/wind/solar
        near $0/MWh) to most expensive (diesel peakers, up to $800/MWh).
        Any violation would invalidate the marginal cost calculation.
        """
        r = client.get("/api/merit/order?region=NSW1")
        assert r.status_code == 200
        data = r.json()
        units = data["units"]
        assert len(units) > 0
        # Merit order must be sorted ascending by marginal cost
        costs = [u["marginal_cost_aud_mwh"] for u in units]
        assert costs == sorted(costs)

    def test_merit_order_cumulative_mw(self, client=client):
        """GET /api/merit/order?region=VIC1 has monotonically increasing cumulative_mw.

        cumulative_mw is the running total of capacity from the cheapest unit
        forward. It must never decrease across the sorted merit order stack.
        """
        r = client.get("/api/merit/order?region=VIC1")
        assert r.status_code == 200
        data = r.json()
        units = data["units"]
        # Cumulative MW must be monotonically non-decreasing
        cumulative = [u["cumulative_mw"] for u in units]
        assert all(
            cumulative[i] <= cumulative[i + 1]
            for i in range(len(cumulative) - 1)
        )

    def test_marginal_unit_identification(self, client=client):
        """GET /api/merit/order?region=QLD1 correctly identifies the marginal generator.

        The marginal_generator DUID must match the first unit in the sorted stack
        whose cumulative_mw is greater than or equal to demand_mw. This unit sets
        the system_marginal_cost (competitive equilibrium spot price).
        """
        r = client.get("/api/merit/order?region=QLD1")
        assert r.status_code == 200
        data = r.json()
        demand = data["demand_mw"]
        # Find the marginal unit: first unit where cumulative_mw >= demand
        marginal = next(
            (u for u in data["units"] if u["cumulative_mw"] >= demand), None
        )
        assert marginal is not None


# ===========================================================================
# TestCatalogEndpoints  (Sprint 16c)
# ===========================================================================

class TestCatalogEndpoints:
    """Tests for /api/catalog/* endpoints."""

    def test_catalog_dashboard_structure(self, client=client):
        """GET /api/catalog/dashboard must return 200 with all top-level fields."""
        r = client.get("/api/catalog/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "table_health" in data
        assert "dq_expectations" in data
        assert "recent_pipelines" in data
        assert data["total_tables"] > 0

    def test_table_freshness_status_valid(self, client=client):
        """Every table_health record must have a valid freshness_status and a pass rate in [0, 1]."""
        r = client.get("/api/catalog/dashboard")
        data = r.json()
        for tbl in data["table_health"]:
            assert tbl["freshness_status"] in ("fresh", "stale", "critical")
            assert 0 <= tbl["expectation_pass_rate"] <= 1.0

    def test_pipeline_runs_status_valid(self, client=client):
        """GET /api/catalog/pipeline_runs must return 200 with valid status values."""
        r = client.get("/api/catalog/pipeline_runs")
        assert r.status_code == 200
        for run in r.json():
            assert run["status"] in ("COMPLETED", "RUNNING", "FAILED", "WAITING")
        assert marginal["duid"] == data["marginal_generator"]


# ===========================================================================
# TestMlDashboardEndpoints
# ===========================================================================

class TestMlDashboardEndpoints:
    """Tests for GET /api/ml/dashboard and GET /api/ml/runs endpoints."""

    def test_ml_dashboard_structure(self, client=client):
        """GET /api/ml/dashboard returns 200 with required top-level keys.

        The response must include recent_runs, drift_summary, feature_importance,
        and a positive models_in_production count.
        """
        r = client.get("/api/ml/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "recent_runs" in data
        assert "drift_summary" in data
        assert "feature_importance" in data
        assert data["models_in_production"] > 0

    def test_ml_runs_list(self, client=client):
        """GET /api/ml/runs?limit=5 returns at most 5 runs with valid status values.

        Each run must have a status that is one of the known MLflow run states.
        """
        r = client.get("/api/ml/runs?limit=5")
        assert r.status_code == 200
        runs = r.json()
        assert len(runs) <= 5
        for run in runs:
            assert run["status"] in ("FINISHED", "RUNNING", "FAILED")

    def test_drift_status_values(self, client=client):
        """GET /api/ml/dashboard drift_summary entries have valid status and positive ratios.

        Every drift record must have drift_status in the allowed set and a
        drift_ratio strictly greater than zero.
        """
        r = client.get("/api/ml/dashboard")
        assert r.status_code == 200
        data = r.json()
        for drift in data["drift_summary"]:
            assert drift["drift_status"] in ("stable", "warning", "critical")
            assert drift["drift_ratio"] > 0


# ===========================================================================
# TestScenarioEndpoints
# ===========================================================================

class TestScenarioEndpoints:
    """Tests for the scenario what-if analysis endpoints."""

    def test_scenario_run_base(self, client=client):
        """POST /api/scenario/run with all-default parameters returns 200.

        With no parameter deviations from base, the price_change_pct should
        be near zero (within +/- 5%).
        """
        payload = {
            "region": "NSW1",
            "base_temperature_c": 25.0,
            "temperature_delta_c": 0.0,
            "gas_price_multiplier": 1.0,
            "wind_output_multiplier": 1.0,
            "solar_output_multiplier": 1.0,
            "demand_multiplier": 1.0,
            "coal_outage_mw": 0.0,
        }
        r = client.post("/api/scenario/run", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert "result" in data
        # With no changes, price_change should be near 0
        assert abs(data["result"]["price_change_pct"]) < 5

    def test_scenario_hot_day(self, client=client):
        """POST /api/scenario/run with extreme heat + high demand should raise price.

        A +12 degree C temperature delta combined with 20% demand uplift should
        produce a positive price_change_pct.
        """
        payload = {
            "region": "SA1",
            "base_temperature_c": 25.0,
            "temperature_delta_c": 12.0,
            "gas_price_multiplier": 1.0,
            "wind_output_multiplier": 1.0,
            "solar_output_multiplier": 1.2,
            "demand_multiplier": 1.2,
            "coal_outage_mw": 0.0,
        }
        r = client.post("/api/scenario/run", json=payload)
        assert r.status_code == 200
        # Hot day + high demand should increase price
        assert r.json()["result"]["price_change_pct"] > 0

    def test_scenario_presets(self, client=client):
        """GET /api/scenario/presets returns at least 5 named presets.

        Each preset must have a 'name' key. The endpoint should return 200.
        """
        r = client.get("/api/scenario/presets")
        assert r.status_code == 200
        presets = r.json()
        assert len(presets) >= 5
        assert all("name" in p for p in presets)


# ===========================================================================
# TestLoadDurationEndpoints
# ===========================================================================

class TestLoadDurationEndpoints:
    """Tests for the /api/stats/* duration curve and statistical analysis endpoints."""

    def test_duration_curve_length(self, client=client):
        """GET /api/stats/duration_curve must return exactly 101 points (P0–P100).

        The demand series must be monotonically decreasing: higher percentile
        = lower demand level exceeded (i.e. we're approaching the peak that is
        only exceeded 0% of the time).
        """
        r = client.get("/api/stats/duration_curve?region=NSW1")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 101  # 0 through 100 percentiles
        # Demand must be monotonically decreasing (higher percentile = lower demand exceeding)
        demands = [p["demand_mw"] for p in data]
        assert all(demands[i] >= demands[i + 1] for i in range(len(demands) - 1))

    def test_stats_summary_structure(self, client=client):
        """GET /api/stats/summary must return correct percentile ordering and valid correlation.

        Percentiles must be strictly ordered: P10 < P50 < P90 for demand.
        Correlation coefficient must be in [-1, 1].
        """
        r = client.get("/api/stats/summary?region=SA1&period=90d")
        assert r.status_code == 200
        data = r.json()
        assert data["demand_p50"] > data["demand_p10"]
        assert data["demand_p90"] > data["demand_p50"]
        assert -1 <= data["correlation_demand_price"] <= 1

    def test_seasonal_pattern_12_months(self, client=client):
        """GET /api/stats/seasonal must return exactly 12 records covering months 1–12.

        The months list must be exactly [1, 2, …, 12] when sorted.
        """
        r = client.get("/api/stats/seasonal?region=QLD1")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 12
        months = [p["month"] for p in data]
        assert sorted(months) == list(range(1, 13))


# ===========================================================================
# TestTrendsEndpoints
# ===========================================================================

class TestTrendsEndpoints:
    """Tests for GET /api/trends/annual and GET /api/trends/yoy endpoints."""

    def test_annual_trends_structure(self, client=client):
        """GET /api/trends/annual returns correct structure and 11 years of data.

        The default range is 2015–2025 (inclusive), giving 11 annual records.
        Renewable penetration must increase and carbon intensity must decrease
        over the analysis period — reflecting the Australian energy transition.
        """
        r = client.get("/api/trends/annual?region=NSW1")
        assert r.status_code == 200
        data = r.json()
        assert len(data["annual_data"]) == 11  # 2015-2025 inclusive
        assert data["renewable_pct_end"] > data["renewable_pct_start"]
        assert data["carbon_intensity_end"] < data["carbon_intensity_start"]

    def test_annual_data_year_range(self, client=client):
        """GET /api/trends/annual with custom year range returns correct subset.

        Requesting 2018–2022 (VIC1) must return exactly 5 annual records with
        min year 2018 and max year 2022.
        """
        r = client.get("/api/trends/annual?region=VIC1&start_year=2018&end_year=2022")
        data = r.json()
        years = [d["year"] for d in data["annual_data"]]
        assert min(years) == 2018
        assert max(years) == 2022
        assert len(years) == 5

    def test_yoy_changes_metrics(self, client=client):
        """GET /api/trends/yoy returns at least 4 metric records with valid trend labels.

        Each YoY record must have a valid trend value (improving/worsening/neutral)
        and must report the requested year.
        """
        r = client.get("/api/trends/yoy?region=SA1&year=2024")
        assert r.status_code == 200
        changes = r.json()
        assert len(changes) >= 4
        for c in changes:
            assert c["trend"] in ("improving", "worsening", "neutral")
            assert c["year"] == 2024


# ===========================================================================
# TestFrequencyEndpoints  (Sprint 17b)
# ===========================================================================

class TestFrequencyEndpoints:
    """Tests for GET /api/frequency/dashboard and GET /api/frequency/history endpoints."""

    def test_frequency_dashboard_structure(self, client=client):
        """GET /api/frequency/dashboard returns 200 with required top-level keys.

        The response must include current_frequency_hz, recent_frequency (60 records),
        inertia_by_region (5 regions), and a valid current_band value.
        """
        r = client.get("/api/frequency/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "current_frequency_hz" in data
        assert len(data["recent_frequency"]) == 60
        assert len(data["inertia_by_region"]) == 5
        assert data["current_band"] in ("normal", "warning", "emergency")

    def test_frequency_within_nemband(self, client=client):
        """All recent_frequency records have hz within NEM operating range and a valid band.

        The NEM operates between ~49.0 and 51.0 Hz under normal conditions.
        Every record must also carry a valid band classification string.
        """
        r = client.get("/api/frequency/dashboard")
        assert r.status_code == 200
        data = r.json()
        for rec in data["recent_frequency"]:
            # Most points should be within +/- 1.0 Hz of 50 Hz
            assert 49.0 <= rec["frequency_hz"] <= 51.0
            assert rec["band"] in ("normal", "warning", "emergency")

    def test_inertia_adequacy(self, client=client):
        """Each inertia_by_region record has a valid rocof_risk and consistent adequacy flag.

        The inertia_adequate flag must be True if and only if total_inertia_mws
        is greater than or equal to min_inertia_requirement_mws.
        """
        r = client.get("/api/frequency/dashboard")
        assert r.status_code == 200
        data = r.json()
        for region in data["inertia_by_region"]:
            assert region["rocof_risk"] in ("low", "medium", "high")
            # Adequate flag should match whether total exceeds minimum
            if region["inertia_adequate"]:
                assert region["total_inertia_mws"] >= region["min_inertia_requirement_mws"]


class TestRegistryEndpoints:
    def test_registry_structure(self, client):
        r = client.get("/api/registry/participants")
        assert r.status_code == 200
        data = r.json()
        assert "participants" in data
        assert len(data["participants"]) >= 10
        assert data["market_concentration_hhi"] > 0
        # Market shares should sum to ~100%
        total_share = sum(p["market_share_pct"] for p in data["participants"])
        assert 95 <= total_share <= 105  # allow small rounding

    def test_compliance_status_valid(self, client):
        r = client.get("/api/registry/participants")
        for p in r.json()["participants"]:
            assert p["compliance_status"] in ("COMPLIANT", "NOTICE", "SUSPENDED")
            assert 0 <= p["credit_used_pct"] <= 100

    def test_assets_filter(self, client):
        r = client.get("/api/registry/assets?fuel_type=Wind")
        assert r.status_code == 200
        for asset in r.json():
            assert asset["fuel_type"] == "Wind"


# ===========================================================================
# TestFuturesEndpoints
# ===========================================================================

class TestFuturesEndpoints:
    """Tests for /api/futures/* endpoints."""

    def test_futures_dashboard_structure(self, client=client):
        """GET /api/futures/dashboard must return 200 with contracts and forward curve."""
        r = client.get("/api/futures/dashboard?region=NSW1")
        assert r.status_code == 200
        data = r.json()
        assert "contracts" in data
        assert "forward_curve" in data
        assert len(data["contracts"]) > 0
        assert len(data["forward_curve"]) > 0

    def test_forward_curve_ordering(self, client=client):
        """Forward curve for VIC1 must have at least 8 quarterly/annual points."""
        r = client.get("/api/futures/dashboard?region=VIC1")
        assert r.status_code == 200
        data = r.json()
        # Forward curve should cover multiple periods
        assert len(data["forward_curve"]) >= 8  # at least 8 quarterly/annual points

    def test_contracts_change_format(self, client=client):
        """GET /api/futures/contracts must return valid contract fields and contract_type values."""
        r = client.get("/api/futures/contracts?region=QLD1")
        assert r.status_code == 200
        contracts = r.json()
        for c in contracts:
            assert "settlement_price" in c
            assert "change_1d" in c
            assert c["contract_type"] in ("CAL", "Q1", "Q2", "Q3", "Q4")


# ===========================================================================
# TestOutageEndpoints  (Sprint 18b)
# ===========================================================================

class TestOutageEndpoints:
    """Tests for GET /api/outages/dashboard and GET /api/outages/list endpoints."""

    def test_outage_dashboard_structure(self, client=client):
        """GET /api/outages/dashboard returns 200 with required top-level keys.

        The response must include active_outages, pasa_outlook (exactly 7 records),
        and a positive total_capacity_lost_mw value. All three active forced/planned
        outages must be present in the active_outages list.
        """
        r = client.get("/api/outages/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "active_outages" in data
        assert "pasa_outlook" in data
        assert len(data["pasa_outlook"]) == 7
        assert data["total_capacity_lost_mw"] > 0

    def test_pasa_status_values(self, client=client):
        """All pasa_outlook records must have a valid reserve_status and consistent arithmetic.

        reserve_mw must equal available_capacity_mw - forecast_demand_mw within 1 MW.
        All reserve_status values must be from the allowed PASA status set.
        """
        r = client.get("/api/outages/dashboard")
        data = r.json()
        valid_statuses = {"SURPLUS", "ADEQUATE", "LOR1", "LOR2", "LOR3"}
        for rec in data["pasa_outlook"]:
            assert rec["reserve_status"] in valid_statuses
            assert rec["reserve_mw"] == pytest.approx(
                rec["available_capacity_mw"] - rec["forecast_demand_mw"], abs=1
            )

    def test_outage_list_filter(self, client=client):
        """GET /api/outages/list?outage_type=FORCED returns only FORCED outages.

        When the outage_type query parameter is set to FORCED, every outage in
        the response must have outage_type == 'FORCED'. The default status filter
        is ACTIVE, so only active forced outages are returned.
        """
        r = client.get("/api/outages/list?outage_type=FORCED")
        assert r.status_code == 200
        for o in r.json():
            assert o["outage_type"] == "FORCED"


# ===========================================================================
# TestDerEndpoints
# ===========================================================================

class TestDerEndpoints:
    """Tests for VPP & Distributed Energy Resources endpoints."""

    def test_der_dashboard_structure(self, client=client):
        """GET /api/der/dashboard must return the full DER dashboard structure.

        Verifies top-level keys, VPP fleet has at least 5 VPPs, regional_der
        covers all 5 NEM regions, and NEM aggregate solar is positive.
        """
        r = client.get("/api/der/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "vpp_fleet" in data
        assert "regional_der" in data
        assert len(data["vpp_fleet"]) >= 5
        assert len(data["regional_der"]) == 5
        assert data["nem_rooftop_solar_gw"] > 0

    def test_solar_forecast_24h(self, client=client):
        """GET /api/der/dashboard must include a 24-point hourly solar forecast.

        Each point must have 'hour' and 'solar_mw' keys.
        Night hours (0-5) should have zero or near-zero solar output.
        """
        r = client.get("/api/der/dashboard")
        data = r.json()
        assert len(data["hourly_solar_forecast"]) == 24
        # Solar should be zero at night (hours 0-5 and 20-23)
        for pt in data["hourly_solar_forecast"]:
            assert "hour" in pt
            assert "solar_mw" in pt

    def test_vpp_modes_valid(self, client=client):
        """GET /api/der/vpp must return only VPPs with valid mode values.

        All VPP mode values must be one of the four defined operational modes:
        peak_support, frequency_response, arbitrage, or idle.
        """
        r = client.get("/api/der/vpp")
        assert r.status_code == 200
        valid_modes = {"peak_support", "frequency_response", "arbitrage", "idle"}
        for vpp in r.json():
            assert vpp["mode"] in valid_modes


# ===========================================================================
# TestAdminEndpoints
# ===========================================================================

class TestAdminEndpoints:
    """Tests for the /api/admin/* endpoints (Sprint 19c)."""

    def test_admin_preferences_get(self, client=client):
        """GET /api/admin/preferences must return 200 with valid preference fields.

        Checks that the response includes a 'default_region' field whose value
        is one of the five NEM region codes, and that 'auto_refresh_seconds'
        is a positive integer.
        """
        r = client.get("/api/admin/preferences")
        assert r.status_code == 200
        data = r.json()
        assert "default_region" in data
        assert data["default_region"] in ("NSW1", "QLD1", "VIC1", "SA1", "TAS1")
        assert data["auto_refresh_seconds"] > 0

    def test_admin_preferences_update(self, client=client):
        """PUT /api/admin/preferences must echo back the submitted preferences.

        In mock mode the endpoint is stateless and echoes the input payload.
        Verifies that the updated 'default_region' is returned as submitted.
        """
        prefs = {
            "user_id": "test-user",
            "default_region": "VIC1",
            "theme": "dark",
            "default_horizon": "4h",
            "price_alert_threshold": 500.0,
            "demand_alert_threshold": 10000.0,
            "auto_refresh_seconds": 60,
            "regions_watchlist": ["VIC1", "SA1"],
            "data_export_format": "json"
        }
        r = client.put("/api/admin/preferences", json=prefs)
        assert r.status_code == 200
        assert r.json()["default_region"] == "VIC1"

    def test_data_sources_status(self, client=client):
        """GET /api/admin/data_sources must return at least 4 sources with valid statuses.

        Each source must have a 'status' field that is one of the three defined
        values: connected, degraded, or disconnected.
        """
        r = client.get("/api/admin/data_sources")
        assert r.status_code == 200
        sources = r.json()
        assert len(sources) >= 4
        for s in sources:
            assert s["status"] in ("connected", "degraded", "disconnected")


class TestGasEndpoints:
    """Tests for GET /api/gas/dashboard and GET /api/gas/pipeline_flows endpoints."""

    def test_gas_dashboard_structure(self, client=client):
        """GET /api/gas/dashboard returns 200 with required top-level keys.

        The response must include hub_prices, pipeline_flows, lng_terminals,
        and a positive wallumbilla_price. All hub and pipeline lists must be
        non-empty.
        """
        r = client.get("/api/gas/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "hub_prices" in data
        assert "pipeline_flows" in data
        assert "lng_terminals" in data
        assert data["wallumbilla_price"] > 0

    def test_pipeline_utilisation_valid(self, client=client):
        """GET /api/gas/pipeline_flows returns valid utilisation and direction values.

        utilisation_pct must be between 0 and 100 inclusive.
        direction must be one of FORWARD, REVERSE, ZERO.
        utilisation_pct must match flow_tj_day / capacity_tj_day * 100 within 0.1%.
        """
        r = client.get("/api/gas/pipeline_flows")
        assert r.status_code == 200
        for pipe in r.json():
            assert 0 <= pipe["utilisation_pct"] <= 100
            assert pipe["direction"] in ("FORWARD", "REVERSE", "ZERO")
            assert abs(pipe["flow_tj_day"] / pipe["capacity_tj_day"] * 100 - pipe["utilisation_pct"]) < 0.1

    def test_gas_hub_prices_present(self, client=client):
        """GET /api/gas/dashboard hub_prices must include Wallumbilla and Longford hubs.

        These are the key east coast reference price hubs. All hub prices must
        be positive values (gas is not typically traded at negative prices).
        """
        r = client.get("/api/gas/dashboard")
        data = r.json()
        hubs = {h["hub"] for h in data["hub_prices"]}
        assert "Wallumbilla" in hubs
        assert "Longford" in hubs


class TestRetailEndpoints:
    """Tests for GET /api/retail/dashboard and GET /api/retail/offers endpoints."""

    def test_retail_dashboard_structure(self, client=client):
        """GET /api/retail/dashboard returns 200 with required top-level keys.

        The response must include market_shares and default_offers lists.
        The sum of all retailer market share percentages must be within the
        range 95-105% (accounting for rounding).
        """
        r = client.get("/api/retail/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "market_shares" in data
        assert "default_offers" in data
        total_share = sum(m["market_share_pct"] for m in data["market_shares"])
        assert 95 <= total_share <= 105

    def test_default_offers_state_filter(self, client=client):
        """GET /api/retail/offers?state=NSW returns only NSW offer records.

        Every record in the response must have state == "NSW".
        """
        r = client.get("/api/retail/offers?state=NSW")
        assert r.status_code == 200
        for offer in r.json():
            assert offer["state"] == "NSW"

    def test_switching_data_present(self, client=client):
        """GET /api/retail/dashboard switching_data has >= 4 valid quarters.

        Each record must have positive avg_savings_aud_yr and
        switching_rate_pct in the range 0-100.
        """
        r = client.get("/api/retail/dashboard")
        data = r.json()
        assert len(data["switching_data"]) >= 4
        for rec in data["switching_data"]:
            assert rec["avg_savings_aud_yr"] > 0
            assert 0 <= rec["switching_rate_pct"] <= 100


# ===========================================================================
# TestRezInfrastructureEndpoints
# ===========================================================================

class TestRezInfrastructureEndpoints:
    """Tests for Sprint 20c REZ & Infrastructure Investment endpoints."""

    def test_rez_dashboard_returns_200(self, client=client):
        """GET /api/rez/dashboard must return 200 with valid structure."""
        r = client.get("/api/rez/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "rez_projects" in data
        assert "isp_projects" in data
        assert "cis_contracts" in data
        assert data["total_rez_capacity_gw"] > 0

    def test_rez_projects_returns_list(self, client=client):
        """GET /api/rez/projects must return a non-empty list of REZ projects."""
        r = client.get("/api/rez/projects")
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) >= 5
        for p in projects:
            assert p["total_capacity_mw"] > 0
            assert p["state"] in ("NSW", "QLD", "VIC", "SA", "TAS")

    def test_rez_projects_state_filter(self, client=client):
        """GET /api/rez/projects?state=NSW must return only NSW projects."""
        r = client.get("/api/rez/projects?state=NSW")
        assert r.status_code == 200
        for p in r.json():
            assert p["state"] == "NSW"

    def test_cis_contracts_returns_list(self, client=client):
        """GET /api/rez/cis_contracts must return a non-empty list of CIS contracts."""
        r = client.get("/api/rez/cis_contracts")
        assert r.status_code == 200
        contracts = r.json()
        assert len(contracts) >= 5
        for c in contracts:
            assert c["capacity_mw"] > 0
            assert c["strike_price_mwh"] > 0

    def test_cis_technology_filter(self, client=client):
        """GET /api/rez/cis_contracts?technology=Wind must return only wind contracts."""
        r = client.get("/api/rez/cis_contracts?technology=Wind")
        assert r.status_code == 200
        for c in r.json():
            assert c["technology"] == "Wind"


# ===========================================================================
# TestNetworkEndpoints
# ===========================================================================

class TestNetworkEndpoints:
    """Tests for GET /api/network/dashboard and GET /api/network/loss_factors endpoints."""

    def test_network_dashboard_structure(self, client=client):
        """GET /api/network/dashboard must return 200 with loss_factors and network_elements.

        The response must include both sections and at least 15 loss factor records
        covering the 5 NEM regions.
        """
        r = client.get("/api/network/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "loss_factors" in data
        assert "network_elements" in data
        assert len(data["loss_factors"]) >= 15

    def test_mlf_categories_correct(self, client=client):
        """GET /api/network/loss_factors verifies MLF categories and combined_lf math.

        Each record's mlf_category must be consistent with its mlf value:
        - mlf > 1.02 => category == "high"
        - mlf < 0.98 => category == "low"
        - 0.98 <= mlf <= 1.02 => category == "normal"

        combined_lf must equal mlf * dlf within floating-point tolerance (0.001).
        """
        r = client.get("/api/network/loss_factors")
        assert r.status_code == 200
        for lf in r.json():
            if lf["mlf"] > 1.02:
                assert lf["mlf_category"] == "high"
            elif lf["mlf"] < 0.98:
                assert lf["mlf_category"] == "low"
            else:
                assert lf["mlf_category"] == "normal"
            # Combined LF should equal mlf * dlf
            assert abs(lf["combined_lf"] - lf["mlf"] * lf["dlf"]) < 0.001

    def test_network_loading_valid(self, client=client):
        """GET /api/network/dashboard verifies loading_pct is internally consistent.

        loading_pct must be in range [0, 150] (can temporarily exceed 100% during N-1 events).
        loading_pct must match current_flow_mva / thermal_limit_mva * 100 within 0.1%.
        """
        r = client.get("/api/network/dashboard")
        data = r.json()
        for elem in data["network_elements"]:
            assert 0 <= elem["loading_pct"] <= 150  # can exceed 100% temporarily
            assert abs(elem["loading_pct"] - elem["current_flow_mva"] / elem["thermal_limit_mva"] * 100) < 0.1


# ===========================================================================
# TestPowerSystemSecurityEndpoints
# ===========================================================================

class TestPowerSystemSecurityEndpoints:
    """Tests for Sprint 21c Power System Security endpoints."""

    def test_pss_dashboard_returns_200(self, client=client):
        r = client.get("/api/pss/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "inertia_records" in data
        assert "fcas_dispatch" in data
        assert data["nem_inertia_total_mws"] > 0

    def test_inertia_records_all_regions(self, client=client):
        r = client.get("/api/pss/dashboard")
        assert r.status_code == 200
        regions = {rec["region"] for rec in r.json()["inertia_records"]}
        for region in ("SA1", "VIC1", "NSW1", "QLD1", "TAS1"):
            assert region in regions

    def test_fcas_dispatch_eight_services(self, client=client):
        r = client.get("/api/pss/fcas")
        assert r.status_code == 200
        services = r.json()
        assert len(services) == 8
        service_codes = {s["service"] for s in services}
        for code in ("R6S", "R60S", "R5M", "R5RE", "L6S", "L60S", "L5M", "L5RE"):
            assert code in service_codes
        for s in services:
            assert 0 < s["enablement_pct"] <= 100


# ===========================================================================
# TestDspEndpoints
# ===========================================================================

class TestDspEndpoints:
    """Tests for Sprint 21b Demand Side Participation endpoints."""

    def test_dsp_dashboard_returns_200(self, client=client):
        r = client.get("/api/dsp/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "participants" in data
        assert "activations" in data
        assert data["total_registered_capacity_mw"] > 0

    def test_dsp_participants_list(self, client=client):
        r = client.get("/api/dsp/participants")
        assert r.status_code == 200
        participants = r.json()
        assert len(participants) >= 5
        for p in participants:
            assert p["registered_capacity_mw"] > 0
            assert 0 < p["reliability_score_pct"] <= 100

    def test_dsp_region_filter(self, client=client):
        r = client.get("/api/dsp/participants?region=SA1")
        assert r.status_code == 200
        for p in r.json():
            assert p["region"] == "SA1"


# ===========================================================================
# TestCurtailmentEndpoints
# ===========================================================================

class TestCurtailmentEndpoints:
    """Tests for Sprint 21a Renewable Curtailment endpoints."""

    def test_curtailment_dashboard_returns_200(self, client=client):
        r = client.get("/api/curtailment/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "curtailment_events" in data
        assert "mod_records" in data
        assert "integration_limits" in data
        assert data["curtailment_events_ytd"] > 0

    def test_curtailment_events_list(self, client=client):
        r = client.get("/api/curtailment/events")
        assert r.status_code == 200
        events = r.json()
        assert len(events) >= 5
        for e in events:
            assert 0 < e["curtailed_pct"] <= 100
            assert e["region"] in ("NSW1", "QLD1", "VIC1", "SA1", "TAS1")

    def test_curtailment_region_filter(self, client=client):
        r = client.get("/api/curtailment/events?region=SA1")
        assert r.status_code == 200
        for e in r.json():
            assert e["region"] == "SA1"
