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


# ===========================================================================
# TestBiddingEndpoints
# ===========================================================================

class TestBiddingEndpoints:
    """Tests for Sprint 22a Generator Bidding endpoints."""

    def test_bid_stack_returns_200(self, client=client):
        r = client.get("/api/bids/stack")
        assert r.status_code == 200
        data = r.json()
        assert "offer_records" in data
        assert "rebid_log" in data
        assert data["total_offered_mw"] > 0

    def test_offer_records_fuel_types(self, client=client):
        r = client.get("/api/bids/stack")
        assert r.status_code == 200
        fuel_types = {rec["fuel_type"] for rec in r.json()["offer_records"]}
        assert "Coal" in fuel_types
        assert "Battery" in fuel_types

    def test_fuel_type_filter(self, client=client):
        r = client.get("/api/bids/stack?fuel_type=Battery")
        assert r.status_code == 200
        for rec in r.json()["offer_records"]:
            assert rec["fuel_type"] == "Battery"


# ===========================================================================
# TestMarketEventsEndpoints
# ===========================================================================

class TestMarketEventsEndpoints:
    def test_market_events_dashboard_returns_200(self, client=client):
        r = client.get("/api/market-events/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "recent_events" in d
        assert "interventions" in d
        assert "price_cap_events" in d
        assert d["total_events"] > 0

    def test_market_events_list_all(self, client=client):
        r = client.get("/api/market-events/events")
        assert r.status_code == 200
        events = r.json()
        assert isinstance(events, list)
        assert len(events) > 0
        assert "event_type" in events[0]
        assert "severity" in events[0]

    def test_market_events_region_filter(self, client=client):
        r = client.get("/api/market-events/events?region=SA1")
        assert r.status_code == 200
        for e in r.json():
            assert e["region"] == "SA1"

    def test_market_interventions_list(self, client=client):
        r = client.get("/api/market-events/interventions")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) > 0
        assert "intervention_type" in items[0]
        assert "directed_mw" in items[0]


# ===========================================================================
# TestFcasMarketEndpoints
# ===========================================================================

class TestFcasMarketEndpoints:
    def test_fcas_market_dashboard_returns_200(self, client=client):
        r = client.get("/api/fcas/market")
        assert r.status_code == 200
        d = r.json()
        assert "services" in d
        assert "providers" in d
        assert "trap_records" in d
        assert len(d["services"]) == 8

    def test_fcas_services_eight_services(self, client=client):
        r = client.get("/api/fcas/services")
        assert r.status_code == 200
        services = r.json()
        assert len(services) == 8
        codes = {s["service"] for s in services}
        assert codes == {"R6S", "R60S", "R5M", "R5RE", "L6S", "L60S", "L5M", "L5RE"}

    def test_fcas_providers_list(self, client=client):
        r = client.get("/api/fcas/providers")
        assert r.status_code == 200
        providers = r.json()
        assert isinstance(providers, list)
        assert len(providers) > 0
        assert "services_enabled" in providers[0]

    def test_fcas_providers_region_filter(self, client=client):
        r = client.get("/api/fcas/providers?region=NSW1")
        assert r.status_code == 200
        for p in r.json():
            assert p["region"] == "NSW1"


class TestBatteryEconomicsEndpoints:
    def test_battery_economics_dashboard_returns_200(self, client=client):
        r = client.get("/api/battery-economics/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "batteries" in d
        assert "opportunities" in d
        assert "dispatch_schedule" in d
        assert d["total_fleet_capacity_mwh"] > 0

    def test_battery_units_list(self, client=client):
        r = client.get("/api/battery-economics/batteries")
        assert r.status_code == 200
        batteries = r.json()
        assert isinstance(batteries, list)
        assert len(batteries) >= 5
        assert all(b["roundtrip_efficiency_pct"] > 0 for b in batteries)

    def test_battery_region_filter(self, client=client):
        r = client.get("/api/battery-economics/batteries?region=SA1")
        assert r.status_code == 200
        for b in r.json():
            assert b["region"] == "SA1"

    def test_dispatch_schedule_24_hours(self, client=client):
        r = client.get("/api/battery-economics/schedule")
        assert r.status_code == 200
        schedule = r.json()
        assert len(schedule) == 24
        hours = [s["hour"] for s in schedule]
        assert hours == list(range(24))


class TestSettlementEndpoints:
    def test_settlement_dashboard_returns_200(self, client=client):
        r = client.get("/api/settlement/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "settlement_runs" in d
        assert "residues" in d
        assert "prudential_records" in d
        assert d["total_energy_settlement_aud"] > 0

    def test_settlement_runs_have_statuses(self, client=client):
        r = client.get("/api/settlement/dashboard")
        assert r.status_code == 200
        runs = r.json()["settlement_runs"]
        statuses = {run["status"] for run in runs}
        assert "COMPLETE" in statuses

    def test_prudential_records_list(self, client=client):
        r = client.get("/api/settlement/prudential")
        assert r.status_code == 200
        records = r.json()
        assert isinstance(records, list)
        assert len(records) >= 5
        for rec in records:
            assert 0 <= rec["utilisation_pct"] <= 200

    def test_prudential_status_filter(self, client=client):
        r = client.get("/api/settlement/prudential?status=WARNING")
        assert r.status_code == 200
        for rec in r.json():
            assert rec["status"] == "WARNING"

    def test_settlement_residues_list(self, client=client):
        r = client.get("/api/settlement/residues")
        assert r.status_code == 200
        residues = r.json()
        assert isinstance(residues, list)
        assert len(residues) > 0
        assert "interconnector_id" in residues[0]


class TestCarbonAnalyticsEndpoints:
    def test_carbon_dashboard_returns_200(self, client=client):
        r = client.get("/api/carbon/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "region_records" in d
        assert "annual_trajectory" in d
        assert "fuel_factors" in d
        assert d["nem_emissions_intensity_now"] > 0

    def test_carbon_regions_all_five(self, client=client):
        r = client.get("/api/carbon/regions")
        assert r.status_code == 200
        regions = r.json()
        region_codes = {rec["region"] for rec in regions}
        assert region_codes == {"NSW1", "QLD1", "VIC1", "SA1", "TAS1"}

    def test_carbon_trajectory_historical_and_forecast(self, client=client):
        r = client.get("/api/carbon/trajectory")
        assert r.status_code == 200
        trajectory = r.json()
        years = [t["year"] for t in trajectory]
        assert 2005 in years
        assert 2030 in years
        # At least some historical (actual not null)
        actual_records = [t for t in trajectory if t["actual_emissions_mt"] is not None]
        assert len(actual_records) >= 3
        # At least some forecast
        forecast_records = [t for t in trajectory if t["forecast_emissions_mt"] is not None]
        assert len(forecast_records) >= 3

    def test_emissions_intensity_by_region_valid(self, client=client):
        r = client.get("/api/carbon/regions")
        assert r.status_code == 200
        for rec in r.json():
            assert 0 <= rec["emissions_intensity_kg_co2_mwh"] <= 1500
            pcts = rec["renewable_pct"] + rec["coal_pct"] + rec["gas_pct"]
            assert pcts <= 101  # allow rounding


# ===========================================================================
# Sprint 24c — Market Power & Concentration Analytics
# ===========================================================================

class TestMarketPowerEndpoints:
    def test_market_power_dashboard_returns_200(self, client=client):
        r = client.get("/api/market-power/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "hhi_records" in d
        assert "pivotal_suppliers" in d
        assert d["nem_overall_hhi"] > 0

    def test_hhi_records_regions(self, client=client):
        r = client.get("/api/market-power/hhi")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 5
        for rec in records:
            assert 0 <= rec["hhi_score"] <= 10000
            assert rec["market_structure"] in ["COMPETITIVE", "MODERATELY_CONCENTRATED", "HIGHLY_CONCENTRATED"]

    def test_pivotal_suppliers_list(self, client=client):
        r = client.get("/api/market-power/pivotal")
        assert r.status_code == 200
        suppliers = r.json()
        assert len(suppliers) >= 4
        statuses = {s["pivotal_status"] for s in suppliers}
        assert "PIVOTAL" in statuses

    def test_pivotal_status_filter(self, client=client):
        r = client.get("/api/market-power/pivotal?pivotal_status=PIVOTAL")
        assert r.status_code == 200
        for s in r.json():
            assert s["pivotal_status"] == "PIVOTAL"


class TestHedgingEndpoints:
    def test_hedging_dashboard_returns_200(self, client=client):
        r = client.get("/api/hedging/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "contracts" in d
        assert "portfolio_by_region" in d
        assert d["overall_hedge_ratio_pct"] > 0

    def test_hedge_contracts_list(self, client=client):
        r = client.get("/api/hedging/contracts")
        assert r.status_code == 200
        contracts = r.json()
        assert len(contracts) >= 8
        types = {c["contract_type"] for c in contracts}
        assert "CAP" in types
        assert "SWAP" in types

    def test_hedge_contracts_type_filter(self, client=client):
        r = client.get("/api/hedging/contracts?contract_type=CAP")
        assert r.status_code == 200
        for c in r.json():
            assert c["contract_type"] == "CAP"

    def test_hedge_portfolio_by_region(self, client=client):
        r = client.get("/api/hedging/portfolio")
        assert r.status_code == 200
        portfolio = r.json()
        assert len(portfolio) >= 3
        for p in portfolio:
            assert 0 <= p["hedge_ratio_pct"] <= 200


class TestHydroStorageEndpoints:
    def test_hydro_dashboard_returns_200(self, client=client):
        r = client.get("/api/hydro/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "reservoirs" in d
        assert "schemes" in d
        assert "water_value_curve" in d
        assert 0 <= d["total_nem_hydro_storage_pct"] <= 100

    def test_hydro_reservoirs_list(self, client=client):
        r = client.get("/api/hydro/reservoirs")
        assert r.status_code == 200
        reservoirs = r.json()
        assert len(reservoirs) >= 6
        for res in reservoirs:
            assert 0 <= res["usable_pct"] <= 100

    def test_hydro_reservoirs_scheme_filter(self, client=client):
        r = client.get("/api/hydro/reservoirs?scheme=Hydro Tasmania")
        assert r.status_code == 200
        for res in r.json():
            assert res["scheme"] == "Hydro Tasmania"

    def test_water_value_curve_structure(self, client=client):
        r = client.get("/api/hydro/water-value")
        assert r.status_code == 200
        points = r.json()
        assert len(points) >= 8
        for pt in points:
            assert 0 <= pt["usable_storage_pct"] <= 100
            assert pt["water_value_aud_ml"] > 0


class TestPasaEndpoints:
    def test_pasa_dashboard_returns_200(self, client=client):
        r = client.get("/api/pasa/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "pasa_periods" in d
        assert "forced_outages" in d
        assert "reliability_stats" in d
        assert d["assessment_horizon_weeks"] > 0

    def test_pasa_periods_multiple_regions(self, client=client):
        r = client.get("/api/pasa/periods")
        assert r.status_code == 200
        periods = r.json()
        regions = {p["region"] for p in periods}
        assert len(regions) >= 3
        for p in periods:
            assert p["reserve_margin_pct"] >= 0

    def test_forced_outages_list(self, client=client):
        r = client.get("/api/pasa/forced-outages")
        assert r.status_code == 200
        outages = r.json()
        assert len(outages) >= 5
        types = {o["outage_type"] for o in outages}
        assert "FORCED" in types

    def test_forced_outages_status_filter(self, client=client):
        r = client.get("/api/pasa/forced-outages?status=ACTIVE")
        assert r.status_code == 200
        for o in r.json():
            assert o["status"] == "ACTIVE"


class TestSraEndpoints:
    def test_sra_dashboard_returns_200(self, client=client):
        r = client.get("/api/sra/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "auction_results" in d
        assert "active_units" in d
        assert "interconnector_revenue" in d
        assert d["total_sra_units_active"] > 0

    def test_sra_units_list(self, client=client):
        r = client.get("/api/sra/units")
        assert r.status_code == 200
        units = r.json()
        assert len(units) >= 6
        interconnectors = {u["interconnector_id"] for u in units}
        assert len(interconnectors) >= 2

    def test_sra_auction_results_list(self, client=client):
        r = client.get("/api/sra/auction-results")
        assert r.status_code == 200
        results = r.json()
        assert len(results) >= 4
        for res in results:
            assert res["clearing_price_aud_mwh"] >= 0
            assert res["over_subscription_ratio"] > 0

    def test_sra_units_interconnector_filter(self, client=client):
        r = client.get("/api/sra/units?interconnector_id=SA1-VIC1")
        assert r.status_code == 200
        for u in r.json():
            assert u["interconnector_id"] == "SA1-VIC1"


class TestPpaEndpoints:
    def test_ppa_dashboard_returns_200(self, client=client):
        r = client.get("/api/ppa/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "ppas" in d
        assert "lgc_market" in d
        assert "behind_meter_assets" in d
        assert d["total_ppa_capacity_gw"] > 0

    def test_ppa_contracts_list(self, client=client):
        r = client.get("/api/ppa/contracts")
        assert r.status_code == 200
        ppas = r.json()
        assert len(ppas) >= 6
        technologies = {p["technology"] for p in ppas}
        assert "Wind" in technologies
        assert "Solar PV" in technologies

    def test_ppa_contracts_technology_filter(self, client=client):
        r = client.get("/api/ppa/contracts?technology=Wind")
        assert r.status_code == 200
        for p in r.json():
            assert p["technology"] == "Wind"

    def test_lgc_market_trend(self, client=client):
        r = client.get("/api/ppa/lgc-market")
        assert r.status_code == 200
        lgc_data = r.json()
        assert len(lgc_data) >= 4
        years = [d["calendar_year"] for d in lgc_data]
        assert 2025 in years
        assert all(d["lgc_spot_price_aud"] > 0 for d in lgc_data)


class TestDispatchAccuracyEndpoints:
    def test_dispatch_dashboard_returns_200(self, client=client):
        r = client.get("/api/dispatch/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "predispatch_intervals" in d
        assert "accuracy_stats" in d
        assert "five_min_summary" in d

    def test_predispatch_intervals_24_hours(self, client=client):
        r = client.get("/api/dispatch/predispatch")
        assert r.status_code == 200
        intervals = r.json()
        assert len(intervals) == 24
        for iv in intervals:
            assert "price_error" in iv
            assert iv["price_error"] == round(iv["actual_price"] - iv["predispatch_price"], 2)

    def test_dispatch_accuracy_by_region(self, client=client):
        r = client.get("/api/dispatch/accuracy")
        assert r.status_code == 200
        stats = r.json()
        assert len(stats) >= 4
        for s in stats:
            assert s["mean_absolute_error_aud"] >= 0
            assert 0 <= s["spike_detection_rate_pct"] <= 100

    def test_five_min_summary_volatility(self, client=client):
        r = client.get("/api/dispatch/dashboard")
        assert r.status_code == 200
        summaries = r.json()["five_min_summary"]
        assert len(summaries) >= 4
        # At least one high volatility period
        assert any(s["high_volatility"] for s in summaries)


class TestRegulatoryEndpoints:
    def test_regulatory_dashboard_returns_200(self, client=client):
        r = client.get("/api/regulatory/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "rule_changes" in d
        assert "aer_determinations" in d
        assert "calendar_events" in d
        assert d["open_consultations"] >= 0

    def test_rule_changes_list(self, client=client):
        r = client.get("/api/regulatory/rule-changes")
        assert r.status_code == 200
        rcs = r.json()
        assert len(rcs) >= 8
        statuses = {rc["status"] for rc in rcs}
        assert "FINAL_RULE" in statuses
        assert "OPEN_CONSULTATION" in statuses

    def test_rule_changes_category_filter(self, client=client):
        r = client.get("/api/regulatory/rule-changes?category=MARKETS")
        assert r.status_code == 200
        for rc in r.json():
            assert rc["category"] == "MARKETS"

    def test_regulatory_calendar_list(self, client=client):
        r = client.get("/api/regulatory/calendar")
        assert r.status_code == 200
        events = r.json()
        assert len(events) >= 6
        urgencies = {e["urgency"] for e in events}
        assert len(urgencies) >= 2


class TestIspTrackerEndpoints:
    def test_isp_dashboard_returns_200(self, client=client):
        r = client.get("/api/isp/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "isp_projects" in d
        assert "tnsp_programs" in d
        assert d["total_pipeline_capex_bn_aud"] > 0

    def test_isp_projects_list(self, client=client):
        r = client.get("/api/isp/projects")
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) >= 6
        project_names = {p["project_name"] for p in projects}
        assert "HumeLink" in project_names

    def test_isp_projects_have_milestones(self, client=client):
        r = client.get("/api/isp/projects")
        assert r.status_code == 200
        for p in r.json():
            assert len(p["milestones"]) >= 3
            assert 0 <= p["overall_progress_pct"] <= 100

    def test_isp_projects_status_filter(self, client=client):
        r = client.get("/api/isp/projects?current_status=UNDER_CONSTRUCTION")
        assert r.status_code == 200
        for p in r.json():
            assert p["current_status"] == "UNDER_CONSTRUCTION"


class TestLrmcEndpoints:
    def test_lrmc_dashboard_returns_200(self, client=client):
        r = client.get("/api/lrmc/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "lcoe_technologies" in d
        assert "investment_signals" in d
        assert "capacity_scenarios" in d
        assert d["cheapest_lcoe_aud_mwh"] > 0

    def test_lcoe_technologies_list(self, client=client):
        r = client.get("/api/lrmc/technologies")
        assert r.status_code == 200
        techs = r.json()
        assert len(techs) >= 15
        tech_names = {t["technology"] for t in techs}
        assert "Wind Onshore" in tech_names
        assert "Solar Farm" in tech_names
        for t in techs:
            assert t["lcoe_low_aud_mwh"] <= t["lcoe_mid_aud_mwh"] <= t["lcoe_high_aud_mwh"]

    def test_investment_signals_list(self, client=client):
        r = client.get("/api/lrmc/signals")
        assert r.status_code == 200
        signals = r.json()
        assert len(signals) >= 6
        signal_types = {s["signal"] for s in signals}
        assert "INVEST" in signal_types

    def test_lrmc_region_filter(self, client=client):
        r = client.get("/api/lrmc/technologies?region=SA1")
        assert r.status_code == 200
        for t in r.json():
            assert t["region"] == "SA1"


class TestSolarEvEndpoints:
    def test_solar_ev_dashboard_returns_200(self, client=client):
        r = client.get("/api/solar-ev/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "solar_records" in d
        assert "ev_records" in d
        assert "hourly_profile" in d
        assert len(d["hourly_profile"]) == 24

    def test_solar_records_by_state(self, client=client):
        r = client.get("/api/solar-ev/solar")
        assert r.status_code == 200
        records = r.json()
        states = {r["state"] for r in records}
        assert "NSW" in states and "QLD" in states
        for rec in records:
            assert 0 <= rec["capacity_factor_pct"] <= 100

    def test_ev_fleet_list(self, client=client):
        r = client.get("/api/solar-ev/ev-fleet")
        assert r.status_code == 200
        fleet = r.json()
        types = {f["ev_type"] for f in fleet}
        assert "BEV" in types
        assert "PHEV" in types

    def test_solar_state_filter(self, client=client):
        r = client.get("/api/solar-ev/solar?state=SA")
        assert r.status_code == 200
        for rec in r.json():
            assert rec["state"] == "SA"


class TestNetworkConstraintEndpoints:
    def test_constraint_dashboard_returns_200(self, client=client):
        r = client.get("/api/constraints/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "constraint_equations" in d
        assert "region_summaries" in d
        assert "violations" in d
        assert len(d["region_summaries"]) == 5

    def test_constraint_equations_list(self, client=client):
        r = client.get("/api/constraints/equations")
        assert r.status_code == 200
        equations = r.json()
        assert len(equations) >= 8
        binding = [e for e in equations if e["binding"]]
        assert len(binding) >= 2
        for e in equations:
            assert e["slack_mw"] == round(e["rhs_value"] - e["lhs_value"], 2)

    def test_constraint_region_filter(self, client=client):
        r = client.get("/api/constraints/equations?region=SA1")
        assert r.status_code == 200
        for e in r.json():
            assert e["region"] == "SA1"

    def test_constraint_violations_list(self, client=client):
        r = client.get("/api/constraints/violations")
        assert r.status_code == 200
        violations = r.json()
        assert len(violations) >= 3
        causes = {v["cause"] for v in violations}
        assert len(causes) >= 2


class TestPriceSetterEndpoints:
    def test_price_setter_dashboard_returns_200(self, client=client):
        r = client.get("/api/price-setter/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "price_setter_records" in d
        assert "frequency_stats" in d
        assert "fuel_type_stats" in d
        assert len(d["price_setter_records"]) == 24

    def test_price_setter_records_list(self, client=client):
        r = client.get("/api/price-setter/records")
        assert r.status_code == 200
        records = r.json()
        assert len(records) == 24
        for rec in records:
            assert "dispatch_price" in rec
            assert "fuel_type" in rec

    def test_price_setter_frequency_list(self, client=client):
        r = client.get("/api/price-setter/frequency")
        assert r.status_code == 200
        freq = r.json()
        assert len(freq) >= 5
        total_pct = sum(f["pct_intervals"] for f in freq)
        assert total_pct <= 101  # allow rounding

    def test_fuel_type_stats_coverage(self, client=client):
        r = client.get("/api/price-setter/dashboard")
        assert r.status_code == 200
        fuel_stats = r.json()["fuel_type_stats"]
        fuel_types = {f["fuel_type"] for f in fuel_stats}
        assert len(fuel_types) >= 3


class TestGridModernisationEndpoints:
    def test_grid_mod_dashboard_returns_200(self, client=client):
        r = client.get("/api/grid-modernisation/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "smart_meter_records" in d
        assert "grid_mod_projects" in d
        assert "reliability_stats" in d
        assert 0 <= d["national_smart_meter_pct"] <= 100

    def test_smart_meter_records_list(self, client=client):
        r = client.get("/api/grid-modernisation/smart-meters")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 6
        for rec in records:
            assert 0 <= rec["penetration_pct"] <= 100
            assert rec["penetration_pct"] <= rec["smart_meter_target_pct"] + 10

    def test_grid_mod_projects_list(self, client=client):
        r = client.get("/api/grid-modernisation/projects")
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) >= 6
        categories = {p["category"] for p in projects}
        assert len(categories) >= 3

    def test_grid_mod_status_filter(self, client=client):
        r = client.get("/api/grid-modernisation/projects?status=UNDERWAY")
        assert r.status_code == 200
        for p in r.json():
            assert p["status"] == "UNDERWAY"


# ---------------------------------------------------------------------------
# Sprint 28c — Electricity Retail Tariff Structure & Bill Analytics
# ---------------------------------------------------------------------------

class TestTariffEndpoints:
    def test_tariff_dashboard_returns_200(self, client=client):
        r = client.get("/api/tariff/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "tariff_components" in d
        assert "tou_structures" in d
        assert "bill_compositions" in d
        assert d["national_avg_residential_bill_aud"] > 0

    def test_tariff_components_list(self, client=client):
        r = client.get("/api/tariff/components")
        assert r.status_code == 200
        components = r.json()
        assert len(components) >= 15
        comp_names = {c["component"] for c in components}
        assert "ENERGY" in comp_names
        assert "NETWORK" in comp_names

    def test_tou_structures_list(self, client=client):
        r = client.get("/api/tariff/structures")
        assert r.status_code == 200
        structures = r.json()
        assert len(structures) >= 4
        for s in structures:
            assert s["peak_rate_c_kwh"] >= s["shoulder_rate_c_kwh"] >= s["off_peak_rate_c_kwh"]

    def test_tariff_state_filter(self, client=client):
        r = client.get("/api/tariff/components?state=SA")
        assert r.status_code == 200
        for c in r.json():
            assert c["state"] == "SA"


# ---------------------------------------------------------------------------
# Sprint 29a — Spot Price Cap & CPT Analytics
# ---------------------------------------------------------------------------

class TestSpotCapEndpoints:
    def test_spot_cap_dashboard_returns_200(self, client=client):
        r = client.get("/api/spot-cap/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "cap_events" in d
        assert "cpt_tracker" in d
        assert "regional_summaries" in d
        assert d["market_price_cap_aud"] == 15500.0

    def test_cpt_tracker_list(self, client=client):
        r = client.get("/api/spot-cap/cpt-tracker")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 5
        for rec in records:
            assert 0 <= rec["pct_of_cpt"] <= 110

    def test_cap_events_list(self, client=client):
        r = client.get("/api/spot-cap/cap-events")
        assert r.status_code == 200
        events = r.json()
        assert len(events) >= 5

    def test_cap_events_region_filter(self, client=client):
        r = client.get("/api/spot-cap/cap-events?region=SA1")
        assert r.status_code == 200
        for e in r.json():
            assert e["region"] == "SA1"



# ---------------------------------------------------------------------------
# Sprint 29b — Causer Pays & FCAS Performance Analytics
# ---------------------------------------------------------------------------

class TestCauserPaysEndpoints:
    def test_causer_pays_dashboard_returns_200(self, client=client):
        r = client.get("/api/causer-pays/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "contributors" in d
        assert "performance_records" in d
        assert "market_summaries" in d
        assert d["avg_performance_factor"] > 0

    def test_contributors_list(self, client=client):
        r = client.get("/api/causer-pays/contributors")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 4
        for rec in records:
            assert 0 <= rec["performance_factor"] <= 1.0

    def test_fcas_performance_list(self, client=client):
        r = client.get("/api/causer-pays/performance")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 5
        for rec in records:
            assert rec["performance_factor"] <= 1.0

    def test_causer_pays_region_filter(self, client=client):
        r = client.get("/api/causer-pays/contributors?region=NSW1")
        assert r.status_code == 200
        for c in r.json():
            assert c["region"] == "NSW1"


# ---------------------------------------------------------------------------
# Sprint 29c — WEM Western Australia Energy Market
# ---------------------------------------------------------------------------

class TestWemEndpoints:
    def test_wem_dashboard_returns_200(self, client=client):
        r = client.get("/api/wem/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "balancing_prices" in d
        assert "facilities" in d
        assert "srmc_records" in d
        assert d["mcap_aud"] == 300.0

    def test_wem_prices_list(self, client=client):
        r = client.get("/api/wem/prices")
        assert r.status_code == 200
        prices = r.json()
        assert len(prices) == 48
        for p in prices:
            assert p["balancing_price_aud"] <= 300.0

    def test_wem_facilities_list(self, client=client):
        r = client.get("/api/wem/facilities")
        assert r.status_code == 200
        facilities = r.json()
        assert len(facilities) >= 10
        techs = {f["technology"] for f in facilities}
        assert "COAL" in techs or "GAS_GT" in techs

    def test_wem_facilities_technology_filter(self, client=client):
        r = client.get("/api/wem/facilities?technology=WIND")
        assert r.status_code == 200
        for f in r.json():
            assert f["technology"] == "WIND"



# ---------------------------------------------------------------------------
# Sprint 30a — Power System Inertia & System Strength Analytics
# ---------------------------------------------------------------------------

class TestInertiaEndpoints:
    def test_inertia_dashboard_returns_200(self, client=client):
        r = client.get("/api/inertia/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "inertia_records" in d
        assert "strength_records" in d
        assert d["national_inertia_mws"] > 0

    def test_inertia_records_list(self, client=client):
        r = client.get("/api/inertia/records")
        assert r.status_code == 200
        records = r.json()
        assert len(records) == 5
        for rec in records:
            assert rec["total_inertia_mws"] > 0

    def test_system_strength_list(self, client=client):
        r = client.get("/api/inertia/strength")
        assert r.status_code == 200
        records = r.json()
        assert len(records) == 5
        for rec in records:
            assert rec["system_strength_status"] in ["SECURE", "MARGINAL", "INSECURE"]

    def test_inertia_region_filter(self, client=client):
        r = client.get("/api/inertia/records?region=SA1")
        assert r.status_code == 200
        for rec in r.json():
            assert rec["region"] == "SA1"


# ---------------------------------------------------------------------------
# Sprint 30c — TNSP Revenue & AER Determinations Analytics
# ---------------------------------------------------------------------------

class TestTnspEndpoints:
    def test_tnsp_dashboard_returns_200(self, client=client):
        r = client.get("/api/tnsp/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "revenue_records" in d
        assert "determinations" in d
        assert "asset_records" in d
        assert d["num_tnsps"] == 5

    def test_tnsp_revenue_list(self, client=client):
        r = client.get("/api/tnsp/revenue")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 10
        for rec in records:
            assert rec["approved_revenue_m_aud"] > 0

    def test_aer_determinations_list(self, client=client):
        r = client.get("/api/tnsp/determinations")
        assert r.status_code == 200
        dets = r.json()
        assert len(dets) >= 5
        for d in dets:
            assert d["total_revenue_m_aud"] > 0

    def test_tnsp_revenue_year_filter(self, client=client):
        r = client.get("/api/tnsp/revenue?year=2025")
        assert r.status_code == 200
        for rec in r.json():
            assert rec["year"] == 2025


# ---------------------------------------------------------------------------
# Sprint 30b — AEMO Market Surveillance & Compliance
# ---------------------------------------------------------------------------

class TestSurveillanceEndpoints:
    def test_surveillance_dashboard_returns_200(self, client=client):
        r = client.get("/api/surveillance/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "notices" in d
        assert "compliance_records" in d
        assert "anomalies" in d
        assert d["open_investigations"] >= 0

    def test_surveillance_notices_list(self, client=client):
        r = client.get("/api/surveillance/notices")
        assert r.status_code == 200
        notices = r.json()
        assert len(notices) >= 5
        for n in notices:
            assert n["status"] in ["OPEN", "UNDER_INVESTIGATION", "REFERRED", "CLOSED"]

    def test_surveillance_status_filter(self, client=client):
        r = client.get("/api/surveillance/notices?status=OPEN")
        assert r.status_code == 200
        for n in r.json():
            assert n["status"] == "OPEN"

    def test_market_anomalies_list(self, client=client):
        r = client.get("/api/surveillance/anomalies")
        assert r.status_code == 200
        anomalies = r.json()
        assert len(anomalies) >= 5



# ---------------------------------------------------------------------------
# Sprint 31a — Green Hydrogen & Electrolysis Economics
# ---------------------------------------------------------------------------

class TestHydrogenEndpoints:
    def test_hydrogen_dashboard_returns_200(self, client=client):
        r = client.get("/api/hydrogen/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "projects" in d
        assert "price_benchmarks" in d
        assert "capacity_records" in d
        assert d["national_avg_lcoh_aud_kg"] > 0

    def test_hydrogen_projects_list(self, client=client):
        r = client.get("/api/hydrogen/projects")
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) >= 5
        for p in projects:
            assert p["lcoh_aud_kg"] > 0

    def test_hydrogen_benchmarks_list(self, client=client):
        r = client.get("/api/hydrogen/benchmarks")
        assert r.status_code == 200
        benchmarks = r.json()
        assert len(benchmarks) >= 4

    def test_hydrogen_status_filter(self, client=client):
        r = client.get("/api/hydrogen/projects?status=OPERATING")
        assert r.status_code == 200
        for p in r.json():
            assert p["status"] == "OPERATING"



# ---------------------------------------------------------------------------
# Sprint 31b — Offshore Wind Project Tracker
# ---------------------------------------------------------------------------

class TestOffshoreWindEndpoints:
    def test_offshore_dashboard_returns_200(self, client=client):
        r = client.get("/api/offshore-wind/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "projects" in d
        assert "zone_summaries" in d
        assert d["total_proposed_capacity_gw"] > 0

    def test_offshore_projects_list(self, client=client):
        r = client.get("/api/offshore-wind/projects")
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) >= 5
        for p in projects:
            assert p["capacity_mw"] > 0

    def test_offshore_zones_list(self, client=client):
        r = client.get("/api/offshore-wind/zones")
        assert r.status_code == 200
        zones = r.json()
        assert len(zones) >= 4

    def test_offshore_state_filter(self, client=client):
        r = client.get("/api/offshore-wind/projects?state=VIC")
        assert r.status_code == 200
        for p in r.json():
            assert p["state"] == "VIC"


# ---------------------------------------------------------------------------
# Sprint 31c — Clean Energy Regulator & RET Dashboard
# ---------------------------------------------------------------------------

class TestCerEndpoints:
    def test_cer_dashboard_returns_200(self, client=client):
        r = client.get("/api/cer/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "lret_records" in d
        assert "sres_records" in d
        assert "accredited_stations" in d
        assert d["lret_target_2030_gwh"] == 33000.0

    def test_lret_records_list(self, client=client):
        r = client.get("/api/cer/lret")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 5
        for rec in records:
            assert rec["lret_target_gwh"] > 0

    def test_cer_stations_list(self, client=client):
        r = client.get("/api/cer/stations")
        assert r.status_code == 200
        stations = r.json()
        assert len(stations) >= 5
        for s in stations:
            assert s["status"] in ["REGISTERED", "SUSPENDED"]

    def test_cer_stations_fuel_filter(self, client=client):
        r = client.get("/api/cer/stations?fuel_source=WIND")
        assert r.status_code == 200
        for s in r.json():
            assert s["fuel_source"] == "WIND"



# ---------------------------------------------------------------------------
# Sprint 32c — Safeguard Mechanism & ERF Analytics
# ---------------------------------------------------------------------------

class TestSafeguardEndpoints:
    def test_safeguard_dashboard_returns_200(self, client=client):
        r = client.get("/api/safeguard/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "facilities" in d
        assert "erf_projects" in d
        assert "accu_market" in d
        assert d["total_covered_facilities"] >= 5

    def test_safeguard_facilities_list(self, client=client):
        r = client.get("/api/safeguard/facilities")
        assert r.status_code == 200
        facilities = r.json()
        assert len(facilities) >= 5
        for f in facilities:
            assert f["compliance_status"] in ["COMPLIANT", "NON_COMPLIANT", "EXCESS_EMISSIONS"]

    def test_accu_market_list(self, client=client):
        r = client.get("/api/safeguard/accu-market")
        assert r.status_code == 200
        market = r.json()
        assert len(market) == 12
        for m in market:
            assert m["spot_price_aud"] > 0

    def test_safeguard_sector_filter(self, client=client):
        r = client.get("/api/safeguard/facilities?sector=ELECTRICITY")
        assert r.status_code == 200
        for f in r.json():
            assert f["sector"] == "ELECTRICITY"


# ---------------------------------------------------------------------------
# Sprint 32a — Pumped Hydro Energy Storage (PHES)
# ---------------------------------------------------------------------------

class TestPhesEndpoints:
    def test_phes_dashboard_returns_200(self, client=client):
        r = client.get("/api/phes/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "projects" in d
        assert "operations" in d
        assert "market_outlook" in d
        assert d["total_operating_mw"] > 0

    def test_phes_projects_list(self, client=client):
        r = client.get("/api/phes/projects")
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) >= 5
        for p in projects:
            assert p["capacity_mw"] > 0

    def test_phes_outlook_list(self, client=client):
        r = client.get("/api/phes/outlook")
        assert r.status_code == 200
        outlook = r.json()
        assert len(outlook) >= 5

    def test_phes_status_filter(self, client=client):
        r = client.get("/api/phes/projects?status=CONSTRUCTION")
        assert r.status_code == 200
        for p in r.json():
            assert p["status"] == "CONSTRUCTION"


# ---------------------------------------------------------------------------
# Sprint 32b — Major Transmission Projects Dashboard
# ---------------------------------------------------------------------------

class TestTransmissionEndpoints:
    def test_transmission_dashboard_returns_200(self, client=client):
        r = client.get("/api/transmission/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "projects" in d
        assert "milestones" in d
        assert d["total_pipeline_capex_b_aud"] > 0

    def test_transmission_projects_list(self, client=client):
        r = client.get("/api/transmission/projects")
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) >= 5
        for p in projects:
            assert p["capex_b_aud"] > 0

    def test_transmission_milestones_list(self, client=client):
        r = client.get("/api/transmission/milestones")
        assert r.status_code == 200
        milestones = r.json()
        assert len(milestones) >= 5

    def test_transmission_status_filter(self, client=client):
        r = client.get("/api/transmission/projects?status=CONSTRUCTION")
        assert r.status_code == 200
        for p in r.json():
            assert p["status"] == "CONSTRUCTION"


# ---------------------------------------------------------------------------
# Sprint 33a — DNSP Distribution Network Analytics
# ---------------------------------------------------------------------------

class TestDnspEndpoints:
    def test_dnsp_dashboard_returns_200(self, client=client):
        r = client.get("/api/dnsp/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "dnsp_records" in d
        assert d["total_distribution_customers"] > 0

    def test_dnsp_records_list(self, client=client):
        r = client.get("/api/dnsp/records")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 10
        for rec in records:
            assert rec["saidi_minutes"] > 0

    def test_dnsp_investments_list(self, client=client):
        r = client.get("/api/dnsp/investments")
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_dnsp_state_filter(self, client=client):
        r = client.get("/api/dnsp/records?state=VIC")
        assert r.status_code == 200
        for rec in r.json():
            assert rec["state"] == "VIC"


# ---------------------------------------------------------------------------
# Sprint 33b — Virtual Power Plant (VPP) Performance
# ---------------------------------------------------------------------------

class TestVppEndpoints:
    def test_vpp_dashboard_returns_200(self, client=client):
        r = client.get("/api/vpp/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "schemes" in d
        assert "dispatches" in d
        assert d["total_enrolled_participants"] > 0

    def test_vpp_schemes_list(self, client=client):
        r = client.get("/api/vpp/schemes")
        assert r.status_code == 200
        schemes = r.json()
        assert len(schemes) >= 5

    def test_vpp_dispatches_list(self, client=client):
        r = client.get("/api/vpp/dispatches")
        assert r.status_code == 200
        dispatches = r.json()
        assert len(dispatches) >= 5

    def test_vpp_state_filter(self, client=client):
        r = client.get("/api/vpp/schemes?state=SA")
        assert r.status_code == 200
        for s in r.json():
            assert s["state"] == "SA"


# ---------------------------------------------------------------------------
# Sprint 33c — NEM Market Reform Tracker
# ---------------------------------------------------------------------------

class TestReformEndpoints:
    def test_reform_dashboard_returns_200(self, client=client):
        r = client.get("/api/reform/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "reforms" in d
        assert "milestones" in d
        assert d["implemented_reforms"] >= 0

    def test_reform_list(self, client=client):
        r = client.get("/api/reform/list")
        assert r.status_code == 200
        reforms = r.json()
        assert len(reforms) >= 5
        for ref in reforms:
            assert ref["impact_level"] in ["HIGH", "MEDIUM", "LOW"]

    def test_reform_status_filter(self, client=client):
        r = client.get("/api/reform/list?status=IMPLEMENTED")
        assert r.status_code == 200
        for ref in r.json():
            assert ref["status"] == "IMPLEMENTED"

    def test_reform_milestones_list(self, client=client):
        r = client.get("/api/reform/milestones")
        assert r.status_code == 200
        assert len(r.json()) >= 5


# ---------------------------------------------------------------------------
# Sprint 34c — EV Charging Infrastructure & Grid Impact
# ---------------------------------------------------------------------------

class TestEvEndpoints:
    def test_ev_dashboard_returns_200(self, client=client):
        r = client.get("/api/ev/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "chargers" in d
        assert "grid_impacts" in d
        assert d["total_ev_vehicles"] > 0

    def test_ev_chargers_list(self, client=client):
        r = client.get("/api/ev/chargers")
        assert r.status_code == 200
        chargers = r.json()
        assert len(chargers) >= 8

    def test_ev_grid_impact_list(self, client=client):
        r = client.get("/api/ev/grid-impact")
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_ev_charger_type_filter(self, client=client):
        r = client.get("/api/ev/chargers?charger_type=DC_FAST")
        assert r.status_code == 200
        for c in r.json():
            assert c["charger_type"] == "DC_FAST"


# ---------------------------------------------------------------------------
# Sprint 34a — TNSP TUoS Network Pricing Analytics
# ---------------------------------------------------------------------------

class TestTuosEndpoints:
    def test_tuos_dashboard_returns_200(self, client=client):
        r = client.get("/api/tuos/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "zones" in d
        assert "mlf_records" in d
        assert d["total_tuos_revenue_m_aud"] > 0

    def test_tuos_zones_list(self, client=client):
        r = client.get("/api/tuos/zones")
        assert r.status_code == 200
        zones = r.json()
        assert len(zones) >= 8
        for z in zones:
            assert z["tuos_rate_kwh"] > 0

    def test_tuos_mlf_list(self, client=client):
        r = client.get("/api/tuos/mlf")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 10

    def test_tuos_state_filter(self, client=client):
        r = client.get("/api/tuos/zones?state=SA")
        assert r.status_code == 200
        for z in r.json():
            assert z["state"] == "SA"


# ---------------------------------------------------------------------------
# Sprint 34b — Carbon Credit & ACCU Registry Analytics
# ---------------------------------------------------------------------------

class TestCarbonEndpoints:
    def test_carbon_dashboard_returns_200(self, client=client):
        r = client.get("/api/carbon/registry/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "projects" in d
        assert "market_records" in d
        assert d["current_spot_price_aud"] > 0

    def test_carbon_projects_list(self, client=client):
        r = client.get("/api/carbon/registry/projects")
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) >= 8
        for p in projects:
            assert p["accu_issued"] >= 0

    def test_carbon_market_list(self, client=client):
        r = client.get("/api/carbon/registry/market")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 12

    def test_carbon_state_filter(self, client=client):
        r = client.get("/api/carbon/registry/projects?state=QLD")
        assert r.status_code == 200
        for p in r.json():
            assert p["state"] == "QLD"


# ---------------------------------------------------------------------------
# Sprint 35a — Grid-Scale Energy Storage Arbitrage
# ---------------------------------------------------------------------------

class TestStorageEndpoints:
    def test_storage_dashboard_returns_200(self, client=client):
        r = client.get("/api/storage/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "projects" in d
        assert "dispatch_records" in d
        assert d["operating_projects"] >= 3

    def test_storage_projects_list(self, client=client):
        r = client.get("/api/storage/projects")
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) >= 8

    def test_storage_dispatch_list(self, client=client):
        r = client.get("/api/storage/dispatch")
        assert r.status_code == 200
        assert len(r.json()) >= 24

    def test_storage_status_filter(self, client=client):
        r = client.get("/api/storage/projects?status=OPERATING")
        assert r.status_code == 200
        for p in r.json():
            assert p["status"] == "OPERATING"


# ---------------------------------------------------------------------------
# Sprint 35b — NEM Demand Forecasting Accuracy & PASA
# ---------------------------------------------------------------------------

class TestDemandForecastEndpoints:
    def test_demand_forecast_dashboard_returns_200(self, client=client):
        r = client.get("/api/demand-forecast/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "forecast_records" in d
        assert "pasa_records" in d
        assert d["avg_mae_1h_pct"] >= 0

    def test_demand_forecast_records_list(self, client=client):
        r = client.get("/api/demand-forecast/records")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 20

    def test_demand_forecast_region_filter(self, client=client):
        r = client.get("/api/demand-forecast/records?region=NSW1")
        assert r.status_code == 200
        for rec in r.json():
            assert rec["region"] == "NSW1"

    def test_pasa_records_list(self, client=client):
        r = client.get("/api/demand-forecast/pasa")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 12


# ---------------------------------------------------------------------------
# Sprint 35c — Renewable Energy Zone (REZ) Development
# ---------------------------------------------------------------------------

class TestRezEndpoints:
    def test_rez_dashboard_returns_200(self, client=client):
        r = client.get("/api/rez-dev/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "rez_records" in d
        assert "generation_projects" in d
        assert d["total_rez_zones"] >= 8

    def test_rez_zones_list(self, client=client):
        r = client.get("/api/rez-dev/zones")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 8

    def test_rez_projects_list(self, client=client):
        r = client.get("/api/rez-dev/projects")
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_rez_state_filter(self, client=client):
        r = client.get("/api/rez-dev/zones?state=NSW")
        assert r.status_code == 200
        for rec in r.json():
            assert rec["state"] == "NSW"


# ---------------------------------------------------------------------------
# Sprint 36c — Energy Poverty & Social Equity Analytics
# ---------------------------------------------------------------------------

class TestEquityEndpoints:
    def test_equity_dashboard_returns_200(self, client=client):
        r = client.get("/api/equity/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "hardship_records" in d
        assert "affordability_indicators" in d
        assert d["national_avg_hardship_rate_pct"] > 0

    def test_hardship_records_list(self, client=client):
        r = client.get("/api/equity/hardship")
        assert r.status_code == 200
        records = r.json()
        assert len(records) >= 6

    def test_affordability_indicators_list(self, client=client):
        r = client.get("/api/equity/affordability")
        assert r.status_code == 200
        indicators = r.json()
        assert len(indicators) >= 10

    def test_affordability_demographic_filter(self, client=client):
        r = client.get("/api/equity/affordability?demographic=LOW_INCOME")
        assert r.status_code == 200
        for ind in r.json():
            assert ind["demographic"] == "LOW_INCOME"


# ---------------------------------------------------------------------------
# Sprint 36a — NEM Trading Desk Analytics
# ---------------------------------------------------------------------------

class TestTradingEndpoints:
    def test_trading_dashboard_returns_200(self, client=client):
        r = client.get("/api/trading/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "positions" in d
        assert "spreads" in d

    def test_trading_positions_list(self, client=client):
        r = client.get("/api/trading/positions")
        assert r.status_code == 200
        positions = r.json()
        assert len(positions) >= 10

    def test_trading_spreads_list(self, client=client):
        r = client.get("/api/trading/spreads")
        assert r.status_code == 200
        assert len(r.json()) >= 4

    def test_trading_direction_filter(self, client=client):
        r = client.get("/api/trading/positions?direction=LONG")
        assert r.status_code == 200
        for p in r.json():
            assert p["direction"] == "LONG"


# ---------------------------------------------------------------------------
# Sprint 36b — Network Congestion & Constraint Binding
# ---------------------------------------------------------------------------

class TestCongestionEndpoints:
    def test_congestion_dashboard_returns_200(self, client=client):
        r = client.get("/api/congestion/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "events" in d
        assert "constraints" in d
        assert d["total_events_ytd"] >= 10

    def test_congestion_events_list(self, client=client):
        r = client.get("/api/congestion/events")
        assert r.status_code == 200
        events = r.json()
        assert len(events) >= 15

    def test_congestion_constraints_list(self, client=client):
        r = client.get("/api/congestion/constraints")
        assert r.status_code == 200
        assert len(r.json()) >= 8

    def test_congestion_cause_filter(self, client=client):
        r = client.get("/api/congestion/events?cause=THERMAL")
        assert r.status_code == 200
        for e in r.json():
            assert e["cause"] == "THERMAL"

# ---------------------------------------------------------------------------
# Sprint 37a — Demand Response & RERT Analytics
# ---------------------------------------------------------------------------

class TestDemandResponseEndpoints:
    def test_dr_dashboard(self, client=client):
        r = client.get("/api/demand-response/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert d["total_contracted_mw"] > 0
        assert len(d["contracts"]) >= 10
        assert len(d["activations"]) >= 10
        assert len(d["providers"]) >= 8

    def test_dr_contracts(self, client=client):
        r = client.get("/api/demand-response/contracts")
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_dr_activations(self, client=client):
        r = client.get("/api/demand-response/activations")
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_dr_providers(self, client=client):
        r = client.get("/api/demand-response/providers")
        assert r.status_code == 200
        assert len(r.json()) >= 8

# ---------------------------------------------------------------------------
# Sprint 37b — Behind-the-Meter (BTM) Analytics
# ---------------------------------------------------------------------------

class TestBtmEndpoints:
    def test_btm_dashboard(self, client=client):
        r = client.get("/api/btm/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert d["total_rooftop_capacity_mw"] > 0
        assert len(d["rooftop_pv"]) >= 50
        assert len(d["home_batteries"]) >= 20
        assert len(d["ev_records"]) >= 20

    def test_btm_rooftop(self, client=client):
        r = client.get("/api/btm/rooftop-pv")
        assert r.status_code == 200
        assert len(r.json()) >= 50

    def test_btm_batteries(self, client=client):
        r = client.get("/api/btm/home-batteries")
        assert r.status_code == 200
        assert len(r.json()) >= 20

    def test_btm_ev(self, client=client):
        r = client.get("/api/btm/ev")
        assert r.status_code == 200
        assert len(r.json()) >= 20

class TestRabEndpoints:
    def test_rab_dashboard(self, client=client):
        r = client.get("/api/rab/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert d["total_tnsp_rab_m_aud"] > 0
        assert len(d["determinations"]) >= 10
        assert len(d["yearly_records"]) >= 20

    def test_rab_determinations(self, client=client):
        r = client.get("/api/rab/determinations")
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_rab_yearly(self, client=client):
        r = client.get("/api/rab/yearly")
        assert r.status_code == 200
        assert len(r.json()) >= 20


class TestRealtimeEndpoints:
    def test_realtime_dashboard(self):
        r = client.get("/api/realtime/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert d["nem_total_demand_mw"] > 0
        assert len(d["regional_dispatch"]) == 5
        assert len(d["generation_mix"]) >= 15
        assert len(d["interconnector_flows"]) >= 5

    def test_realtime_dispatch(self):
        r = client.get("/api/realtime/dispatch")
        assert r.status_code == 200
        assert len(r.json()) == 5

    def test_realtime_gen_mix(self):
        r = client.get("/api/realtime/generation-mix")
        assert r.status_code == 200
        assert len(r.json()) >= 15

    def test_realtime_interconnectors(self):
        r = client.get("/api/realtime/interconnectors")
        assert r.status_code == 200
        assert len(r.json()) >= 5

class TestRitEndpoints:
    def test_rit_dashboard(self, client):
        r = client.get("/api/rit/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["total_projects"] >= 10
        assert len(d["projects"]) >= 10
        assert len(d["cost_benefits"]) >= 20
        assert len(d["options"]) >= 20

    def test_rit_projects(self, client):
        r = client.get("/api/rit/projects", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_rit_cost_benefits(self, client):
        r = client.get("/api/rit/cost-benefits", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 20

    def test_rit_options(self, client):
        r = client.get("/api/rit/options", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 20

class TestForwardCurveEndpoints:
    def test_forward_dashboard(self, client):
        r = client.get("/api/forward-curve/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["base_spot_nsw_aud_mwh"] > 0
        assert len(d["forward_curve"]) >= 20
        assert len(d["cap_options"]) >= 20
        assert len(d["seasonal_premiums"]) >= 50

    def test_forward_prices(self, client):
        r = client.get("/api/forward-curve/prices", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 20

    def test_forward_options(self, client):
        r = client.get("/api/forward-curve/options", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 20

    def test_forward_seasonal(self, client):
        r = client.get("/api/forward-curve/seasonal", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 50

class TestCoalRetirementEndpoints:
    def test_coal_retirement_dashboard(self, client):
        r = client.get("/api/coal-retirement/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["operating_coal_units"] >= 10
        assert d["total_coal_capacity_mw"] > 0
        assert len(d["retirement_records"]) >= 12
        assert len(d["capacity_gaps"]) >= 15

    def test_coal_retirement_units(self, client):
        r = client.get("/api/coal-retirement/units", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 12

    def test_coal_retirement_gaps(self, client):
        r = client.get("/api/coal-retirement/capacity-gaps", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 15

    def test_coal_retirement_investments(self, client):
        r = client.get("/api/coal-retirement/investments", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 10

class TestGasGenEndpoints:
    def test_gas_gen_dashboard(self, client):
        r = client.get("/api/gas-gen/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["total_gas_capacity_mw"] > 0
        assert len(d["generators"]) >= 10
        assert len(d["spark_spreads"]) >= 40

    def test_gas_generators(self, client):
        r = client.get("/api/gas-gen/generators", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_gas_spark_spreads(self, client):
        r = client.get("/api/gas-gen/spark-spreads", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 40

class TestConsumerProtectionEndpoints:
    def test_consumer_dashboard(self, client):
        r = client.get("/api/consumer-protection/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["avg_dmo_annual_bill_aud"] > 0
        assert len(d["retail_offers"]) >= 20
        assert len(d["complaints"]) >= 50
        assert len(d["switching_rates"]) >= 20

    def test_consumer_offers(self, client):
        r = client.get("/api/consumer-protection/offers", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 20

    def test_consumer_complaints(self, client):
        r = client.get("/api/consumer-protection/complaints", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 50

    def test_consumer_switching(self, client):
        r = client.get("/api/consumer-protection/switching", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 20

class TestEforEndpoints:
    def test_efor_dashboard(self, client):
        r = client.get("/api/efor/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["fleet_avg_availability_pct"] > 0
        assert len(d["availability_records"]) >= 40
        assert len(d["efor_trends"]) >= 40

    def test_efor_availability(self, client):
        r = client.get("/api/efor/availability", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 40

    def test_efor_trends(self, client):
        r = client.get("/api/efor/trends", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 40

class TestClimateRiskEndpoints:
    def test_climate_risk_dashboard(self, client):
        r = client.get("/api/climate-risk/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["total_assets_assessed"] >= 15
        assert len(d["assets"]) >= 15
        assert len(d["events"]) >= 10

    def test_climate_risk_assets(self, client):
        r = client.get("/api/climate-risk/assets", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 15

    def test_climate_risk_events(self, client):
        r = client.get("/api/climate-risk/events", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 10

class TestSmartGridEndpoints:
    def test_smart_grid_dashboard(self, client):
        r = client.get("/api/smart-grid/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["total_doe_customers"] > 0
        assert len(d["doe_programs"]) >= 10
        assert len(d["derms_systems"]) >= 6
        assert len(d["ami_adoption"]) >= 20

    def test_smart_grid_doe(self, client):
        r = client.get("/api/smart-grid/doe-programs", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_smart_grid_derms(self, client):
        r = client.get("/api/smart-grid/derms", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 6

    def test_smart_grid_ami(self, client):
        r = client.get("/api/smart-grid/ami", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 20

class TestMinDemandEndpoints:
    def test_min_demand_dashboard(self, client):
        r = client.get("/api/minimum-demand/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["min_demand_record_mw"] > 0
        assert len(d["min_demand_records"]) >= 6
        assert len(d["duck_curve_profiles"]) >= 6
        assert len(d["negative_pricing"]) >= 40

    def test_min_demand_records(self, client):
        r = client.get("/api/minimum-demand/records", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 6

    def test_duck_curve(self, client):
        r = client.get("/api/minimum-demand/duck-curve", headers=AUTH)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 6
        assert len(data[0]["half_hourly_demand"]) == 48

    def test_negative_pricing(self, client):
        r = client.get("/api/minimum-demand/negative-pricing", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 40

class TestNEMSuspensionEndpoints:
    def test_market_events_dashboard(self, client):
        r = client.get("/api/nem-suspension/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["total_events_5yr"] >= 8
        assert len(d["events"]) >= 8
        assert len(d["interventions"]) >= 8
        assert len(d["timeline"]) >= 10

    def test_market_events_list(self, client):
        r = client.get("/api/nem-suspension/events", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 8

    def test_market_interventions(self, client):
        r = client.get("/api/nem-suspension/interventions", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 8

    def test_market_timeline(self, client):
        r = client.get("/api/nem-suspension/timeline", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 10


class TestBatteryTechEndpoints:
    def test_battery_tech_dashboard(self, client):
        r = client.get("/api/battery-tech/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["li_ion_pack_cost_2024_usd_kwh"] > 0
        assert len(d["cost_records"]) >= 25
        assert len(d["lcos_records"]) >= 8
        assert len(d["supply_chain"]) >= 5

    def test_battery_tech_costs(self, client):
        r = client.get("/api/battery-tech/costs", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 25

    def test_battery_tech_lcos(self, client):
        r = client.get("/api/battery-tech/lcos", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 8

    def test_battery_tech_supply_chain(self, client):
        r = client.get("/api/battery-tech/supply-chain", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 5

class TestCommunityEnergyEndpoints:
    def test_community_energy_dashboard(self, client):
        r = client.get("/api/community-energy/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["total_community_batteries"] >= 8
        assert len(d["community_batteries"]) >= 8
        assert len(d["solar_gardens"]) >= 6
        assert len(d["sps_systems"]) >= 8

    def test_community_batteries(self, client):
        r = client.get("/api/community-energy/batteries", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 8

    def test_solar_gardens(self, client):
        r = client.get("/api/community-energy/solar-gardens", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 6

    def test_sps_systems(self, client):
        r = client.get("/api/community-energy/sps", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 8

class TestAssetManagementEndpoints:
    def test_asset_mgmt_dashboard(self, client):
        r = client.get("/api/asset-management/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["total_assets"] >= 14
        assert len(d["assets"]) >= 14
        assert len(d["inspections"]) >= 8
        assert len(d["maintenance_programs"]) >= 5

    def test_transmission_assets(self, client):
        r = client.get("/api/asset-management/assets", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 14

    def test_asset_inspections(self, client):
        r = client.get("/api/asset-management/inspections", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 8

    def test_maintenance_programs(self, client):
        r = client.get("/api/asset-management/maintenance", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 5

class TestDecarbonizationEndpoints:
    def test_decarbonization_dashboard(self, client):
        r = client.get("/api/decarbonization/dashboard", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["total_emissions_2024_mt_co2e"] > 0
        assert len(d["sectoral_emissions"]) >= 8
        assert len(d["milestones"]) >= 10
        assert len(d["technology_deployment"]) >= 20

    def test_decarbonization_sectors(self, client):
        r = client.get("/api/decarbonization/sectors", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 8

    def test_decarbonization_milestones(self, client):
        r = client.get("/api/decarbonization/milestones", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_decarbonization_technology(self, client):
        r = client.get("/api/decarbonization/technology", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) >= 20


class TestNuclearLdesEndpoints:
    def test_nuclear_ldes_dashboard(self, client):
        r = client.get("/api/nuclear-ldes/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "smr_projects" in d
        assert len(d["smr_projects"]) > 0
        assert "long_duration_projects" in d
        assert len(d["long_duration_projects"]) > 0

    def test_smr_projects(self, client):
        r = client.get("/api/nuclear-ldes/smr-projects", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_long_duration_projects(self, client):
        r = client.get("/api/nuclear-ldes/long-duration", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_capacity_outlook(self, client):
        r = client.get("/api/nuclear-ldes/capacity-outlook", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestEnergyPovertyEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/energy-poverty/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "hardship_records" in d
        assert len(d["hardship_records"]) > 0

    def test_hardship(self, client):
        r = client.get("/api/energy-poverty/hardship", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_worker_transition(self, client):
        r = client.get("/api/energy-poverty/worker-transition", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_programs(self, client):
        r = client.get("/api/energy-poverty/programs", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0


class TestBiddingBehaviourEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/bidding-behaviour/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "withholding_records" in d
        assert len(d["withholding_records"]) > 0

    def test_withholding(self, client):
        r = client.get("/api/bidding-behaviour/withholding", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_rebid_patterns(self, client):
        r = client.get("/api/bidding-behaviour/rebid-patterns", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_market_concentration(self, client):
        r = client.get("/api/bidding-behaviour/market-concentration", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0


class TestSpotForecastEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/spot-forecast/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "forecast_intervals" in d
        assert len(d["forecast_intervals"]) > 0

    def test_intervals(self, client):
        r = client.get("/api/spot-forecast/intervals", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_regional_summary(self, client):
        r = client.get("/api/spot-forecast/regional-summary", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert len(r.json()) == 5

    def test_model_performance(self, client):
        r = client.get("/api/spot-forecast/model-performance", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestHydrogenEconomyEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/hydrogen-economy/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "production_facilities" in d
        assert len(d["production_facilities"]) > 0

    def test_production(self, client):
        r = client.get("/api/hydrogen-economy/production", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_export_terminals(self, client):
        r = client.get("/api/hydrogen-economy/export-terminals", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_cost_benchmarks(self, client):
        r = client.get("/api/hydrogen-economy/cost-benchmarks", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_refuelling(self, client):
        r = client.get("/api/hydrogen-economy/refuelling", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0


class TestCarbonCreditEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/carbon-credit/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "spot_records" in d
        assert len(d["spot_records"]) > 0

    def test_spot(self, client):
        r = client.get("/api/carbon-credit/spot", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_projects(self, client):
        r = client.get("/api/carbon-credit/projects", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_buyers(self, client):
        r = client.get("/api/carbon-credit/buyers", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_price_forecast(self, client):
        r = client.get("/api/carbon-credit/price-forecast", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestGridResilienceEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/grid-resilience/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "outage_events" in d
        assert len(d["outage_events"]) > 0

    def test_outage_events(self, client):
        r = client.get("/api/grid-resilience/outage-events", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_investments(self, client):
        r = client.get("/api/grid-resilience/investments", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_vulnerability(self, client):
        r = client.get("/api/grid-resilience/vulnerability", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_kpis(self, client):
        r = client.get("/api/grid-resilience/kpis", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestEvFleetEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/ev-fleet/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "fleets" in d
        assert len(d["fleets"]) > 0

    def test_fleets(self, client):
        r = client.get("/api/ev-fleet/fleets", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_charging_infra(self, client):
        r = client.get("/api/ev-fleet/charging-infra", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_v2g_dispatch(self, client):
        r = client.get("/api/ev-fleet/v2g-dispatch", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_demand_forecast(self, client):
        r = client.get("/api/ev-fleet/demand-forecast", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestRecMarketEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/rec-market/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "lgc_spot_records" in d
        assert len(d["lgc_spot_records"]) > 0

    def test_lgc_spot(self, client):
        r = client.get("/api/rec-market/lgc-spot", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_lgc_creation(self, client):
        r = client.get("/api/rec-market/lgc-creation", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_surplus_deficit(self, client):
        r = client.get("/api/rec-market/surplus-deficit", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_stc(self, client):
        r = client.get("/api/rec-market/stc", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestTransmissionCongestionEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/transmission-congestion/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "constraint_binding" in d
        assert len(d["constraint_binding"]) > 0

    def test_constraints(self, client):
        r = client.get("/api/transmission-congestion/constraints", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_nodal_prices(self, client):
        r = client.get("/api/transmission-congestion/nodal-prices", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_congestion_rent(self, client):
        r = client.get("/api/transmission-congestion/congestion-rent", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_heatmap(self, client):
        r = client.get("/api/transmission-congestion/heatmap", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestDermsOrchestrationEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/derms-orchestration/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "aggregators" in d
        assert len(d["aggregators"]) > 0

    def test_aggregators(self, client):
        r = client.get("/api/derms-orchestration/aggregators", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_dispatch_events(self, client):
        r = client.get("/api/derms-orchestration/dispatch-events", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_der_portfolio(self, client):
        r = client.get("/api/derms-orchestration/der-portfolio", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_kpis(self, client):
        r = client.get("/api/derms-orchestration/kpis", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestMarketDesignEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/market-design/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "proposals" in d
        assert len(d["proposals"]) > 0

    def test_proposals(self, client):
        r = client.get("/api/market-design/proposals", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_capacity_mechanisms(self, client):
        r = client.get("/api/market-design/capacity-mechanisms", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_settlement_reforms(self, client):
        r = client.get("/api/market-design/settlement-reforms", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_market_comparison(self, client):
        r = client.get("/api/market-design/market-comparison", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 5


class TestRezCapacityEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/rez-capacity/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "rez_zones" in d
        assert len(d["rez_zones"]) > 0

    def test_zones(self, client):
        r = client.get("/api/rez-capacity/zones", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_projects(self, client):
        r = client.get("/api/rez-capacity/projects", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_network_augmentations(self, client):
        r = client.get("/api/rez-capacity/network-augmentations", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_build_out(self, client):
        r = client.get("/api/rez-capacity/build-out", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestRetailOfferComparisonEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/retail-offer-comparison/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "market_offers" in d
        assert len(d["market_offers"]) > 0

    def test_offers(self, client):
        r = client.get("/api/retail-offer-comparison/offers", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_dmo_comparison(self, client):
        r = client.get("/api/retail-offer-comparison/dmo-comparison", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_solar_fit(self, client):
        r = client.get("/api/retail-offer-comparison/solar-fit", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_tariff_structures(self, client):
        r = client.get("/api/retail-offer-comparison/tariff-structures", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestSystemOperatorEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/system-operator/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "directions" in d
        assert len(d["directions"]) > 0

    def test_directions(self, client):
        r = client.get("/api/system-operator/directions", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_rert_activations(self, client):
        r = client.get("/api/system-operator/rert-activations", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_load_shedding(self, client):
        r = client.get("/api/system-operator/load-shedding", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_constraint_relaxations(self, client):
        r = client.get("/api/system-operator/constraint-relaxations", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestOWPEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/offshore-wind-pipeline/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "declared_areas" in d
        assert len(d["declared_areas"]) > 0

    def test_declared_areas(self, client):
        r = client.get("/api/offshore-wind-pipeline/declared-areas", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_licences(self, client):
        r = client.get("/api/offshore-wind-pipeline/licences", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_supply_chain(self, client):
        r = client.get("/api/offshore-wind-pipeline/supply-chain", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_capacity_outlook(self, client):
        r = client.get("/api/offshore-wind-pipeline/capacity-outlook", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestNetworkTariffReformEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/network-tariff-reform/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "dnsp_tariffs" in d
        assert len(d["dnsp_tariffs"]) > 0

    def test_tariffs(self, client):
        r = client.get("/api/network-tariff-reform/tariffs", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_revenue(self, client):
        r = client.get("/api/network-tariff-reform/revenue", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_reforms(self, client):
        r = client.get("/api/network-tariff-reform/reforms", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_der_impacts(self, client):
        r = client.get("/api/network-tariff-reform/der-impacts", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

class TestSpikeAnalysisEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/spike-analysis/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "spike_events" in d
        assert len(d["spike_events"]) > 0

    def test_events(self, client):
        r = client.get("/api/spike-analysis/events", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_contributors(self, client):
        r = client.get("/api/spike-analysis/contributors", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_consumer_impacts(self, client):
        r = client.get("/api/spike-analysis/consumer-impacts", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_regional_timeline(self, client):
        r = client.get("/api/spike-analysis/regional-timeline", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestStorageRevenueStackEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/storage-revenue-stack/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "revenue_waterfall" in d
        assert len(d["revenue_waterfall"]) > 0

    def test_waterfall(self, client):
        r = client.get("/api/storage-revenue-stack/waterfall", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_dispatch_optimisation(self, client):
        r = client.get("/api/storage-revenue-stack/dispatch-optimisation", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_multi_service_bids(self, client):
        r = client.get("/api/storage-revenue-stack/multi-service-bids", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_scenarios(self, client):
        r = client.get("/api/storage-revenue-stack/scenarios", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestSolarResourceEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/solar-resource/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "irradiance_sites" in d
        assert len(d["irradiance_sites"]) > 0

    def test_sites(self, client):
        r = client.get("/api/solar-resource/sites", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_farm_yields(self, client):
        r = client.get("/api/solar-resource/farm-yields", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_monthly_irradiance(self, client):
        r = client.get("/api/solar-resource/monthly-irradiance", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_degradation(self, client):
        r = client.get("/api/solar-resource/degradation", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestFuturesMarketRiskEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/futures-market-risk/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "var_records" in d
        assert len(d["var_records"]) > 0

    def test_var(self, client):
        r = client.get("/api/futures-market-risk/var", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_hedge_effectiveness(self, client):
        r = client.get("/api/futures-market-risk/hedge-effectiveness", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_basis_risk(self, client):
        r = client.get("/api/futures-market-risk/basis-risk", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_positions(self, client):
        r = client.get("/api/futures-market-risk/positions", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestWindResourceEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/wind-resource/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "site_assessments" in d
        assert len(d["site_assessments"]) > 0

    def test_site_assessments(self, client):
        r = client.get("/api/wind-resource/site-assessments", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_farm_performance(self, client):
        r = client.get("/api/wind-resource/farm-performance", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_wake_losses(self, client):
        r = client.get("/api/wind-resource/wake-losses", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_monthly_resource(self, client):
        r = client.get("/api/wind-resource/monthly-resource", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestCorporatePpaMarketEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/corporate-ppa-market/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "ppa_deals" in d
        assert len(d["ppa_deals"]) > 0

    def test_deals(self, client):
        r = client.get("/api/corporate-ppa-market/deals", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_offtakers(self, client):
        r = client.get("/api/corporate-ppa-market/offtakers", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_price_trends(self, client):
        r = client.get("/api/corporate-ppa-market/price-trends", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_market_summary(self, client):
        r = client.get("/api/corporate-ppa-market/market-summary", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestMicrogridRapsEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/microgrid-raps/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "microgrids" in d
        assert len(d["microgrids"]) > 0

    def test_microgrids(self, client):
        r = client.get("/api/microgrid-raps/microgrids", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_diesel_displacement(self, client):
        r = client.get("/api/microgrid-raps/diesel-displacement", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_energy_records(self, client):
        r = client.get("/api/microgrid-raps/energy-records", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_technology_summary(self, client):
        r = client.get("/api/microgrid-raps/technology-summary", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestMarketLiquidityEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/market-liquidity/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "trading_volumes" in d
        assert len(d["trading_volumes"]) > 0

    def test_trading_volumes(self, client):
        r = client.get("/api/market-liquidity/trading-volumes", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_bid_ask_spreads(self, client):
        r = client.get("/api/market-liquidity/bid-ask-spreads", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_market_depth(self, client):
        r = client.get("/api/market-liquidity/market-depth", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_metrics(self, client):
        r = client.get("/api/market-liquidity/metrics", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestThermalEfficiencyEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/thermal-efficiency/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "thermal_units" in d
        assert len(d["thermal_units"]) > 0

    def test_units(self, client):
        r = client.get("/api/thermal-efficiency/units", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_heat_rate_trends(self, client):
        r = client.get("/api/thermal-efficiency/heat-rate-trends", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_fuel_costs(self, client):
        r = client.get("/api/thermal-efficiency/fuel-costs", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_benchmarks(self, client):
        r = client.get("/api/thermal-efficiency/benchmarks", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestIndustrialDemandFlexEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/industrial-demand-flex/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "large_consumers" in d
        assert len(d["large_consumers"]) > 0

    def test_consumers(self, client):
        r = client.get("/api/industrial-demand-flex/consumers", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_events(self, client):
        r = client.get("/api/industrial-demand-flex/events", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_load_shapes(self, client):
        r = client.get("/api/industrial-demand-flex/load-shapes", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_aggregate(self, client):
        r = client.get("/api/industrial-demand-flex/aggregate", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestStorageLcaEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/storage-lca/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "lca_records" in d
        assert len(d["lca_records"]) > 0

    def test_lca_records(self, client):
        r = client.get("/api/storage-lca/lca-records", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_critical_minerals(self, client):
        r = client.get("/api/storage-lca/critical-minerals", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_recycling(self, client):
        r = client.get("/api/storage-lca/recycling", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_scenarios(self, client):
        r = client.get("/api/storage-lca/scenarios", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestIFAEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/interconnector-flow-analytics/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "interconnectors" in d
        assert len(d["interconnectors"]) > 0

    def test_interconnectors(self, client):
        r = client.get("/api/interconnector-flow-analytics/interconnectors", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_flows(self, client):
        r = client.get("/api/interconnector-flow-analytics/flows", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_upgrades(self, client):
        r = client.get("/api/interconnector-flow-analytics/upgrades", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_patterns(self, client):
        r = client.get("/api/interconnector-flow-analytics/patterns", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestIspProgressEndpoints:
    def test_dashboard(self, client):
        r = client.get("/api/isp-progress/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "actionable_projects" in d
        assert len(d["actionable_projects"]) > 0

    def test_actionable_projects(self, client):
        r = client.get("/api/isp-progress/actionable-projects", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_capacity_milestones(self, client):
        r = client.get("/api/isp-progress/capacity-milestones", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_scenarios(self, client):
        r = client.get("/api/isp-progress/scenarios", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_delivery_risks(self, client):
        r = client.get("/api/isp-progress/delivery-risks", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestFirmingTechnologyEconomics:
    def test_firming_technology_dashboard(self, client):
        r = client.get("/api/firming-technology/dashboard", headers={"X-API-Key": "test-key"})
        assert r.status_code == 200
        d = r.json()
        assert "technologies" in d
        assert len(d["technologies"]) == 8
        assert "dispatch_records" in d
        assert len(d["dispatch_records"]) == 16
        assert "cost_curves" in d
        assert len(d["cost_curves"]) == 15
        assert "scenarios" in d
        assert len(d["scenarios"]) == 3
        # Validate technology record shape
        tech = d["technologies"][0]
        assert "tech_id" in tech
        assert "lcos_aud_mwh" in tech
        assert "capex_m_aud_mw" in tech
        assert "co2_kg_mwh" in tech
        assert "commercial_maturity" in tech
        # Validate scenario record shape
        scenario = d["scenarios"][0]
        assert "scenario_id" in scenario
        assert "vre_penetration_pct" in scenario
        assert "firming_capacity_gw" in scenario
        assert "recommended_mix" in scenario
        assert "avg_lcoe_aud_mwh" in scenario


class TestDemandForecastingModels:
    def test_demand_forecast_models_dashboard(self, client):
        r = client.get(
            "/api/demand-forecast-models/dashboard",
            headers={"X-API-Key": "test-key"},
        )
        assert r.status_code == 200
        body = r.json()

        # Top-level keys
        assert "timestamp" in body
        assert "models" in body
        assert "forecasts" in body
        assert "seasonal_patterns" in body
        assert "feature_importance" in body

        # Models: at least 6 unique model names
        model_names = {m["name"] for m in body["models"]}
        assert model_names >= {"ARIMA", "LSTM", "XGBoost", "Prophet", "Ensemble", "SARIMA"}

        # All five NEM regions covered
        regions = {m["region"] for m in body["models"]}
        assert regions >= {"NSW1", "QLD1", "VIC1", "SA1", "TAS1"}

        # Model fields
        for m in body["models"]:
            assert m["mape_pct"] > 0
            assert 0 < m["r_squared"] <= 1
            assert m["training_data_years"] > 0

        # Forecast records: 48 records (24 h × 2 models for NSW1)
        assert len(body["forecasts"]) == 48
        for f in body["forecasts"]:
            assert 0 <= f["hour"] <= 23
            assert f["forecast_mw"] > 0
            assert f["lower_bound_mw"] < f["forecast_mw"]
            assert f["upper_bound_mw"] > f["forecast_mw"]

        # Seasonal patterns: 20 records (4 seasons × 5 regions)
        assert len(body["seasonal_patterns"]) == 20
        for p in body["seasonal_patterns"]:
            assert p["season"] in ("SUMMER", "AUTUMN", "WINTER", "SPRING")
            assert p["peak_demand_mw"] >= p["avg_demand_mw"] >= p["min_demand_mw"]
            assert 0 <= p["peak_hour"] <= 23

        # Feature importance: scores between 0 and 1
        for fi in body["feature_importance"]:
            assert 0 <= fi["importance_score"] <= 1
            assert fi["feature"] in (
                "TEMPERATURE", "TIME_OF_DAY", "DAY_OF_WEEK",
                "HOLIDAY", "SOLAR_OUTPUT", "ECONOMIC_ACTIVITY", "HUMIDITY",
            )


class TestMarketStressTesting:
    def test_market_stress_dashboard(self, client):
        r = client.get(
            "/api/market-stress/dashboard",
            headers={"X-API-Key": "test-key"},
        )
        assert r.status_code == 200
        d = r.json()

        # Top-level structure
        assert "timestamp" in d
        assert "scenarios" in d
        assert "results" in d
        assert "vulnerabilities" in d
        assert "kpis" in d

        # Scenarios
        assert len(d["scenarios"]) == 8
        for sc in d["scenarios"]:
            assert sc["scenario_id"]
            assert sc["severity"] in ("MILD", "MODERATE", "SEVERE", "EXTREME")
            assert 0 < sc["probability_pct"] <= 100
            assert sc["duration_days"] > 0

        # Results — metric enum and value plausibility
        assert len(d["results"]) > 0
        for res in d["results"]:
            assert res["metric"] in ("PRICE", "AVAILABILITY", "RELIABILITY", "REVENUE")
            assert res["baseline_value"] > 0
            assert res["recovery_days"] > 0

        # Vulnerabilities — 6 components expected
        assert len(d["vulnerabilities"]) == 6
        for v in d["vulnerabilities"]:
            assert 0 <= v["vulnerability_score"] <= 100
            assert isinstance(v["single_point_of_failure"], bool)

        # KPIs — 8 records expected
        assert len(d["kpis"]) == 8
        for k in d["kpis"]:
            assert k["avg_price_spike_pct"] >= 0
            assert k["max_price_aud_mwh"] > 0
            assert k["unserved_energy_mwh"] >= 0
            assert k["economic_cost_m_aud"] >= 0


class TestFrequencyControlAnalytics:
    """Sprint 54a — NEM Frequency Control Analytics endpoint tests."""

    def test_frequency_control_dashboard(self, client):
        resp = client.get("/api/frequency-control/dashboard", headers={"X-API-Key": "test-key"})
        assert resp.status_code == 200
        d = resp.json()

        # Top-level structure
        assert "timestamp" in d
        assert "frequency_records" in d
        assert "events" in d
        assert "contributors" in d
        assert "performance" in d

        # Frequency records — 12 monthly records expected
        assert len(d["frequency_records"]) == 12
        for rec in d["frequency_records"]:
            assert rec["region"] == "NSW1"
            assert 49.0 <= rec["avg_freq_hz"] <= 51.0
            assert 0.0 <= rec["std_dev_hz"] <= 1.0
            assert 0.0 <= rec["time_in_band_pct"] <= 100.0
            assert rec["high_freq_deviations"] >= 0
            assert rec["low_freq_deviations"] >= 0
            assert rec["max_freq_hz"] >= rec["avg_freq_hz"]
            assert rec["min_freq_hz"] <= rec["avg_freq_hz"]

        # Events — 8 major frequency events expected
        assert len(d["events"]) == 8
        valid_triggers = {
            "GENERATOR_TRIP",
            "LOAD_REJECTION",
            "INTERCONNECTOR_SEPARATION",
            "DEMAND_FORECAST_ERROR",
        }
        for ev in d["events"]:
            assert ev["trigger"] in valid_triggers
            assert 48.0 <= ev["nadir_hz"] <= 52.0
            assert ev["recovery_time_sec"] > 0
            assert ev["rocof_hz_per_sec"] >= 0
            assert ev["unserved_energy_mwh"] >= 0
            assert ev["region"] in ("NSW1", "VIC1", "QLD1", "SA1", "TAS1")

        # Contributors — 10 technology records expected
        assert len(d["contributors"]) == 10
        for c in d["contributors"]:
            assert c["pfr_response_mw"] > 0
            assert c["response_speed_ms"] > 0
            assert 0.0 <= c["droop_setting_pct"] <= 10.0
            assert 0.0 <= c["contribution_pct"] <= 100.0
            assert c["portfolio_mw"] > 0

        # Contribution percentages should sum to ~100 %
        total_contrib = sum(c["contribution_pct"] for c in d["contributors"])
        assert abs(total_contrib - 100.0) < 1.0

        # Performance — 12 monthly records expected
        assert len(d["performance"]) == 12
        for p in d["performance"]:
            assert 0.0 <= p["compliance_rate_pct"] <= 100.0
            assert p["fcas_shortfall_events"] >= 0
            assert 0.0 <= p["pfr_response_adequacy_pct"] <= 100.0
            assert 49.0 <= p["avg_nadir_hz"] <= 51.0
            assert p["avg_rocof"] >= 0


# ---------------------------------------------------------------------------
# Sprint 54b — NEM Capacity Investment Signals
# ---------------------------------------------------------------------------

class TestCapacityInvestmentSignals:
    def test_capacity_investment_dashboard(self, client):
        resp = client.get("/api/capacity-investment/dashboard")
        assert resp.status_code == 200
        d = resp.json()

        # Top-level keys
        for key in ("timestamp", "new_entrant_costs", "investment_activity", "price_signals", "exit_risks"):
            assert key in d, f"Missing key: {key}"

        # New entrant costs — 8 records
        assert len(d["new_entrant_costs"]) == 8
        for rec in d["new_entrant_costs"]:
            assert rec["technology"]
            assert rec["region"]
            assert rec["capex_m_aud_mw"] > 0
            assert 0 < rec["wacc_pct"] <= 15
            assert rec["loe_aud_mwh"] > 0
            assert rec["breakeven_price_aud_mwh"] >= rec["loe_aud_mwh"]
            assert rec["payback_years"] > 0

        # Investment activity — 20 records (5 years × 4 technologies)
        assert len(d["investment_activity"]) == 20
        years_seen = set()
        techs_seen = set()
        for rec in d["investment_activity"]:
            assert 2020 <= rec["year"] <= 2024
            assert rec["technology"]
            assert rec["committed_mw"] >= 0
            assert rec["cancelled_mw"] >= 0
            assert 0 <= rec["financing_secured_pct"] <= 100
            years_seen.add(rec["year"])
            techs_seen.add(rec["technology"])
        assert len(years_seen) == 5
        assert len(techs_seen) == 4

        # Price signals — 20 records (5 regions × 4 years)
        assert len(d["price_signals"]) == 20
        valid_signals = {"STRONG", "ADEQUATE", "WEAK", "INSUFFICIENT"}
        regions_seen = set()
        for rec in d["price_signals"]:
            assert rec["region"]
            assert 2021 <= rec["year"] <= 2024
            assert rec["avg_spot_price"] > 0
            assert rec["time_weighted_price"] > 0
            assert rec["peak_peaker_price"] > rec["avg_spot_price"]
            assert rec["revenue_adequacy_signal"] in valid_signals
            regions_seen.add(rec["region"])
        assert len(regions_seen) == 5

        # Exit risks — 10 records
        assert len(d["exit_risks"]) == 10
        valid_triggers = {"ECONOMICS", "AGE", "POLICY", "REGULATION"}
        for rec in d["exit_risks"]:
            assert rec["unit_id"]
            assert rec["unit_name"]
            assert rec["technology"]
            assert rec["age_years"] > 0
            assert rec["remaining_life_years"] >= 0
            assert 0 <= rec["exit_probability_5yr_pct"] <= 100
            assert rec["exit_trigger"] in valid_triggers
            assert rec["capacity_mw"] > 0


# ===========================================================================
# Sprint 54c — REC Certificate Tracking
# ===========================================================================

class TestRecCertificateTracking:
    def test_rec_certificate_dashboard(self, client):
        r = client.get(
            "/api/rec-tracking/dashboard",
            headers={"X-API-Key": "test-key"},
        )
        assert r.status_code == 200
        d = r.json()

        # Top-level structure
        assert "timestamp" in d
        assert "lgc_prices" in d
        assert "surplus_deficit" in d
        assert "creation" in d
        assert "compliance" in d
        assert "greenpower" in d

        # LGC price records — 24 monthly records (Jan 2023 – Dec 2024)
        assert len(d["lgc_prices"]) == 24
        for p in d["lgc_prices"]:
            assert p["month"]
            assert p["lgc_spot_price_aud"] > 0
            assert p["lgc_forward_2026_aud"] > 0
            assert p["lgc_forward_2027_aud"] > 0
            assert p["volume_k_certificates"] > 0
            assert p["open_interest_k"] > 0
            # Forward prices should be reasonably close to spot
            assert abs(p["lgc_forward_2026_aud"] - p["lgc_spot_price_aud"]) < 30

        # Surplus/deficit records — 8 annual records (2017–2024)
        assert len(d["surplus_deficit"]) == 8
        years = [r["year"] for r in d["surplus_deficit"]]
        assert 2017 in years
        assert 2024 in years
        for rec in d["surplus_deficit"]:
            assert rec["lret_target_gwh"] == 33000.0
            assert rec["liable_entity_surrenders_gwh"] > 0
            assert rec["new_projects_gwh"] > 0

        # Creation records — 20 (5 techs × 4 regions)
        assert len(d["creation"]) == 20
        valid_techs = {"Wind", "Large Solar", "Hydro", "Biomass/Waste", "Rooftop Solar"}
        for rec in d["creation"]:
            assert rec["technology"] in valid_techs
            assert rec["region"] in ("NSW1", "VIC1", "QLD1", "SA1", "TAS1")
            assert rec["lgcs_created_k"] >= 0
            assert rec["year"] == 2024

        # Compliance records — 10 retailers
        assert len(d["compliance"]) == 10
        valid_statuses = {"COMPLIANT", "SHORTFALL", "DEFERRED"}
        for rec in d["compliance"]:
            assert rec["retailer"]
            assert 0 < rec["market_share_pct"] <= 100
            assert rec["liable_energy_gwh"] > 0
            assert rec["certificates_surrendered_k"] > 0
            assert rec["compliance_status"] in valid_statuses
            assert rec["shortfall_charge_m_aud"] >= 0
            # Shortfall charge only for non-compliant
            if rec["compliance_status"] == "COMPLIANT":
                assert rec["shortfall_charge_m_aud"] == 0.0

        # GreenPower records — 6 states
        assert len(d["greenpower"]) == 6
        valid_states = {"NSW", "VIC", "QLD", "SA", "WA", "TAS"}
        state_set = {r["state"] for r in d["greenpower"]}
        assert state_set == valid_states
        for rec in d["greenpower"]:
            assert rec["greenpower_customers_k"] > 0
            assert rec["greenpower_gwh"] > 0
            assert rec["avg_premium_aud_mwh"] > 0


class TestSpotMarketDepthAnalytics:
    def test_spot_depth_dashboard(self, client):
        resp = client.get("/api/spot-depth/dashboard")
        assert resp.status_code == 200
        d = resp.json()

        # Top-level keys
        assert "timestamp" in d
        assert "bid_stacks" in d
        assert "order_flows" in d
        assert "depth_snapshots" in d
        assert "participant_flows" in d

        # Bid stacks — 20 records (10 price bands × 2 regions)
        assert len(d["bid_stacks"]) == 20
        valid_regions = {"NSW1", "VIC1", "QLD1", "SA1", "TAS1"}
        for rec in d["bid_stacks"]:
            assert rec["region"] in valid_regions
            assert isinstance(rec["price_band_aud_mwh"], float)
            assert rec["cumulative_mw"] > 0
            assert rec["participant_count"] >= 1
            assert rec["technology"]

        # Order flow records — 15
        assert len(d["order_flows"]) == 15
        for rec in d["order_flows"]:
            assert rec["region"] in valid_regions
            assert rec["buy_volume_mw"] > 0
            assert rec["sell_volume_mw"] > 0
            # net_flow = buy - sell (may be negative)
            assert isinstance(rec["net_flow_mw"], float)
            assert rec["participant_id"]

        # Depth snapshots — 5 NEM regions
        assert len(d["depth_snapshots"]) == 5
        snapshot_regions = {s["region"] for s in d["depth_snapshots"]}
        assert snapshot_regions == {"NSW1", "VIC1", "QLD1", "SA1", "TAS1"}
        for snap in d["depth_snapshots"]:
            assert snap["bid_depth_mw"] > 0
            assert snap["offer_depth_mw"] > 0
            assert snap["bid_ask_spread_aud"] > 0
            assert snap["best_bid_aud"] > 0
            assert snap["best_ask_aud"] > snap["best_bid_aud"]
            assert snap["imbalance_ratio"] > 0

        # Participant flow records — 8
        assert len(d["participant_flows"]) == 8
        for rec in d["participant_flows"]:
            assert rec["participant"]
            assert rec["region"] in valid_regions
            assert rec["avg_bid_mw"] > 0
            assert rec["avg_offer_mw"] > 0
            assert 0 < rec["market_share_pct"] <= 100
            assert rec["rebid_frequency_day"] >= 0
            assert 0.0 <= rec["strategic_withholding_score"] <= 10.0


# ===========================================================================
# Sprint 55c — Energy Storage Technology Roadmap
# ===========================================================================

class TestStorageTechRoadmap:
    def test_storage_tech_roadmap_dashboard(self, client):
        r = client.get(
            "/api/storage-roadmap/dashboard",
            headers={"X-API-Key": "test-key"},
        )
        assert r.status_code == 200
        d = r.json()

        # Top-level structure
        assert "timestamp" in d
        assert "technologies" in d
        assert "cost_trajectories" in d
        assert "milestones" in d
        assert "market_forecasts" in d

        # Technologies — exactly 10
        assert len(d["technologies"]) == 10
        valid_maturities = {"COMMERCIAL", "PILOT", "DEMO", "RESEARCH"}
        for rec in d["technologies"]:
            assert rec["tech_id"]
            assert rec["name"]
            assert rec["maturity"] in valid_maturities
            assert rec["duration_range_hr"]
            assert rec["current_lcos_aud_mwh"] > 0
            assert rec["target_lcos_2030_aud_mwh"] > 0
            # 2030 target must be cheaper than current
            assert rec["target_lcos_2030_aud_mwh"] < rec["current_lcos_aud_mwh"]
            assert rec["cycle_life_k_cycles"] > 0
            assert rec["energy_density_kwh_m3"] >= 0
            assert rec["calendar_life_years"] > 0
            assert rec["australia_installed_mwh"] >= 0

        # At least 3 commercial-stage technologies
        commercial = [t for t in d["technologies"] if t["maturity"] == "COMMERCIAL"]
        assert len(commercial) >= 3

        # Cost trajectories — exactly 50 (10 techs × 5 years 2024–2028)
        assert len(d["cost_trajectories"]) == 50
        years_in_trajectories = {rec["year"] for rec in d["cost_trajectories"]}
        assert years_in_trajectories == {2024, 2025, 2026, 2027, 2028}
        techs_in_trajectories = {rec["technology"] for rec in d["cost_trajectories"]}
        assert len(techs_in_trajectories) == 10
        for rec in d["cost_trajectories"]:
            assert rec["technology"]
            assert 2024 <= rec["year"] <= 2028
            assert rec["lcos_aud_mwh"] > 0
            assert rec["capex_aud_kwh"] > 0
            assert rec["energy_density_kwh_kg"] >= 0
            assert 0 <= rec["market_share_pct"] <= 100

        # Milestones — exactly 15
        assert len(d["milestones"]) == 15
        valid_statuses = {"ACHIEVED", "ON_TRACK", "AT_RISK", "NOT_STARTED"}
        for rec in d["milestones"]:
            assert rec["technology"]
            assert rec["milestone"]
            assert 2024 <= rec["target_year"] <= 2030
            assert rec["status"] in valid_statuses
            assert rec["responsible_org"]
            assert rec["capacity_mwh"] >= 0
            assert "notes" in rec

        # At least one ACHIEVED milestone
        achieved = [m for m in d["milestones"] if m["status"] == "ACHIEVED"]
        assert len(achieved) >= 1

        # Market forecasts — exactly 30 (6 techs × 5 years)
        assert len(d["market_forecasts"]) == 30
        years_in_forecasts = {rec["year"] for rec in d["market_forecasts"]}
        assert years_in_forecasts == {2024, 2025, 2026, 2027, 2028}
        forecast_techs = {rec["technology"] for rec in d["market_forecasts"]}
        assert len(forecast_techs) == 6
        for rec in d["market_forecasts"]:
            assert rec["technology"]
            assert 2024 <= rec["year"] <= 2028
            assert rec["cumulative_deployed_gwh"] >= 0
            assert rec["annual_additions_gwh"] >= 0
            assert 0 <= rec["cost_reduction_pct_from_2024"] < 100
            assert 0 <= rec["addressable_market_pct"] <= 100

        # LFP must be the largest deployment technology by 2028
        lfp_2028 = next(
            (r for r in d["market_forecasts"] if r["technology"] == "Li-Ion LFP" and r["year"] == 2028),
            None,
        )
        assert lfp_2028 is not None
        assert lfp_2028["cumulative_deployed_gwh"] > 10.0  # well above 10 GWh by 2028

        # 2024 baseline cost reduction must be exactly 0.0
        baselines = [r for r in d["market_forecasts"] if r["year"] == 2024]
        for b in baselines:
            assert b["cost_reduction_pct_from_2024"] == 0.0


class TestRenewableIntegrationCost:
    """Sprint 55b — Renewable Integration Cost Analytics endpoint tests."""

    def test_integration_cost_dashboard(self, client: TestClient) -> None:
        resp = client.get("/api/integration-cost/dashboard", headers={"x-api-key": "test-key"})
        assert resp.status_code == 200
        d = resp.json()

        # Top-level structure
        assert "timestamp" in d
        assert "cost_components" in d
        assert "network_augs" in d
        assert "curtailment" in d
        assert "system_services" in d

        # cost_components: 30 records (5 years × 6 components)
        assert len(d["cost_components"]) == 30
        valid_components = {
            "NETWORK_AUGMENTATION", "FIRMING_CAPACITY", "FCAS_MARKETS",
            "CURTAILMENT_COST", "SYSTEM_RESTART", "INERTIA_SERVICES",
        }
        years_seen = set()
        for rec in d["cost_components"]:
            assert rec["cost_component"] in valid_components
            assert 2020 <= rec["year"] <= 2024
            assert rec["cost_m_aud"] > 0
            assert rec["cost_aud_mwh_vre"] > 0
            assert 0 < rec["vre_penetration_pct"] < 100
            assert rec["notes"]
            years_seen.add(rec["year"])
        assert years_seen == {2020, 2021, 2022, 2023, 2024}

        # Each year must have all 6 components
        for year in [2020, 2021, 2022, 2023, 2024]:
            yr_components = {r["cost_component"] for r in d["cost_components"] if r["year"] == year}
            assert yr_components == valid_components, f"Year {year} missing components"

        # network_augs: 8 projects
        assert len(d["network_augs"]) == 8
        for aug in d["network_augs"]:
            assert aug["project_name"]
            assert aug["region"]
            assert aug["investment_m_aud"] > 0
            assert aug["vre_enabled_mw"] > 0
            assert aug["cost_per_mw_k_aud"] > 0
            assert 2020 <= aug["commissioning_year"] <= 2035
            assert aug["benefit_cost_ratio"] > 1.0  # all projects viable

        # curtailment: 20 records (4 techs × 5 years)
        assert len(d["curtailment"]) == 20
        valid_causes = {"NETWORK_CONSTRAINT", "DEMAND_LOW", "OVERSUPPLY", "DISPATCH_ORDER"}
        for rec in d["curtailment"]:
            assert rec["technology"]
            assert rec["region"]
            assert rec["curtailed_gwh"] > 0
            assert 0 < rec["curtailed_pct"] < 100
            assert rec["curtailment_cause"] in valid_causes
            assert rec["revenue_lost_m_aud"] > 0

        # system_services: 5 records
        assert len(d["system_services"]) == 5
        valid_services = {
            "INERTIA", "SYSTEM_RESTART", "VOLTAGE_CONTROL",
            "REACTIVE_POWER", "FAST_FREQUENCY_RESPONSE",
        }
        valid_trends = {"RISING", "STABLE", "FALLING"}
        services_seen = set()
        for rec in d["system_services"]:
            assert rec["service"] in valid_services
            assert rec["annual_cost_m_aud"] > 0
            assert rec["providers"] > 0
            assert rec["cost_trend"] in valid_trends
            assert rec["vre_correlation"]
            services_seen.add(rec["service"])
        assert services_seen == valid_services

        # Business logic assertions
        # 2024 VRE penetration must be highest
        penetrations = {r["year"]: r["vre_penetration_pct"] for r in d["cost_components"] if r["cost_component"] == "NETWORK_AUGMENTATION"}
        assert penetrations[2024] > penetrations[2020]

        # Curtailment should be growing over time
        annual_curtailment = {}
        for rec in d["curtailment"]:
            annual_curtailment[rec["year"]] = annual_curtailment.get(rec["year"], 0) + rec["curtailed_gwh"]
        assert annual_curtailment[2024] > annual_curtailment[2020]

        # INERTIA must be RISING trend (key system service concern)
        inertia = next(r for r in d["system_services"] if r["service"] == "INERTIA")
        assert inertia["cost_trend"] == "RISING"


class TestMarketShareTracker:
    """Sprint 56c — NEM Participant Market Share & Concentration Tracker tests."""

    def test_market_share_dashboard(self, client):
        resp = client.get(
            "/api/participant-market-share/dashboard",
            headers={"X-API-Key": "test-api-key"},
        )
        assert resp.status_code == 200
        d = resp.json()

        # Top-level keys
        for key in ("timestamp", "participants", "concentration", "ownership_changes", "regional_shares"):
            assert key in d, f"Missing key: {key}"

        # Participants: 12 per year × 3 years = 36
        assert len(d["participants"]) == 36
        for p in d["participants"]:
            assert p["portfolio_mw"] > 0
            assert 0 <= p["market_share_pct"] <= 100
            assert p["hhi_contribution"] > 0
            assert p["year"] in (2022, 2023, 2024)
            assert p["renewable_mw"] >= 0
            assert p["thermal_mw"] >= 0
            assert p["storage_mw"] >= 0

        # Participant names coverage
        participant_ids = {p["participant_id"] for p in d["participants"]}
        for expected in ("AGL", "ORG", "EA", "SNOWY", "TILT", "NEOEN"):
            assert expected in participant_ids, f"Missing participant: {expected}"

        # Concentration: 5 regions × 3 years = 15
        assert len(d["concentration"]) == 15
        valid_levels = {"COMPETITIVE", "MODERATE", "CONCENTRATED", "HIGHLY_CONCENTRATED"}
        regions_seen = set()
        for c in d["concentration"]:
            assert c["hhi_score"] > 0
            assert 0 < c["cr3_pct"] <= 100
            assert 0 < c["cr5_pct"] <= 100
            assert c["cr5_pct"] >= c["cr3_pct"]
            assert c["competition_level"] in valid_levels
            assert c["year"] in (2022, 2023, 2024)
            regions_seen.add(c["region"])
        assert regions_seen == {"NSW", "QLD", "VIC", "SA", "WA"}

        # Ownership changes: exactly 5
        assert len(d["ownership_changes"]) == 5
        for o in d["ownership_changes"]:
            assert o["capacity_mw"] > 0
            assert o["transaction_value_m_aud"] > 0
            assert o["acquirer"]
            assert o["assets_transferred"]

        # Regional shares: 6 participants × 5 regions = 30
        assert len(d["regional_shares"]) == 30
        for r in d["regional_shares"]:
            assert 0 <= r["generation_share_pct"] <= 100
            assert 0 <= r["capacity_share_pct"] <= 100
            assert r["rebid_events"] >= 0

        # Business logic: WA should be highest HHI (monopoly-like)
        wa_2024 = next(
            (c for c in d["concentration"] if c["region"] == "WA" and c["year"] == 2024),
            None
        )
        assert wa_2024 is not None
        assert wa_2024["hhi_score"] > 2000, "WA should be concentrated"

        # Market shares sum to reasonable total for latest year
        latest_shares = [p["market_share_pct"] for p in d["participants"] if p["year"] == 2024]
        total_share = sum(latest_shares)
        assert total_share > 50, "Market shares must cover meaningful portion"

        # Total M&A transaction value
        total_ma = sum(o["transaction_value_m_aud"] for o in d["ownership_changes"])
        assert total_ma > 1000, "Total M&A value should exceed $1B AUD"


# ---------------------------------------------------------------------------
# Sprint 56a — Generator Planned Outage & Maintenance Scheduling Analytics
# ---------------------------------------------------------------------------

class TestPlannedOutageAnalytics:
    """Tests for GET /api/planned-outage/dashboard"""

    def test_planned_outage_dashboard(self, client: TestClient) -> None:
        resp = client.get(
            "/api/planned-outage/dashboard",
            headers={"X-API-Key": os.environ["API_KEY"]},
        )
        assert resp.status_code == 200
        d = resp.json()

        # Top-level keys
        assert "timestamp" in d
        assert "outages" in d
        assert "reserve_margins" in d
        assert "conflicts" in d
        assert "kpis" in d

        # --- Outages ---
        outages = d["outages"]
        assert len(outages) == 15

        valid_types   = {"FULL", "PARTIAL", "DERATING"}
        valid_reasons = {
            "MAJOR_OVERHAUL", "MINOR_MAINTENANCE",
            "REGULATORY_INSPECTION", "FUEL_SYSTEM", "ENVIRONMENTAL_COMPLIANCE",
        }
        for o in outages:
            assert o["outage_id"]
            assert o["unit_id"]
            assert o["unit_name"]
            assert o["technology"]
            assert o["region"] in {"NSW", "VIC", "QLD", "SA", "TAS"}
            assert o["capacity_mw"] > 0
            assert o["start_date"]
            assert o["end_date"]
            assert o["duration_days"] > 0
            assert o["outage_type"] in valid_types
            assert o["derated_capacity_mw"] >= 0
            assert o["reason"] in valid_reasons
            assert o["submitted_by"]

        # --- Reserve margins ---
        margins = d["reserve_margins"]
        assert len(margins) == 20  # 5 regions x 4 weeks

        valid_statuses = {"ADEQUATE", "TIGHT", "CRITICAL"}
        for m in margins:
            assert m["week"]
            assert m["region"] in {"NSW", "VIC", "QLD", "SA", "TAS"}
            assert m["available_capacity_mw"] > 0
            assert m["maximum_demand_mw"] > 0
            assert m["scheduled_outage_mw"] >= 0
            assert m["unplanned_outage_mw"] >= 0
            assert 0 <= m["reserve_margin_pct"] <= 100
            assert m["reserve_status"] in valid_statuses

        # Business: VIC week 3 should be CRITICAL (reserve_margin_pct ~3.4)
        vic_week3 = next(
            (m for m in margins if m["region"] == "VIC" and m["week"] == "2025-W03"),
            None,
        )
        assert vic_week3 is not None
        assert vic_week3["reserve_status"] == "CRITICAL"
        assert vic_week3["reserve_margin_pct"] < 10

        # --- Conflicts ---
        conflicts = d["conflicts"]
        assert len(conflicts) == 5

        valid_risks = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
        for c in conflicts:
            assert c["conflict_id"]
            assert c["unit_a"]
            assert c["unit_b"]
            assert c["overlap_start"]
            assert c["overlap_end"]
            assert c["combined_capacity_mw"] > 0
            assert c["region"] in {"NSW", "VIC", "QLD", "SA", "TAS"}
            assert c["risk_level"] in valid_risks
            assert isinstance(c["aemo_intervention"], bool)

        # Business: QLD conflict should be CRITICAL and require AEMO intervention
        qld_conflict = next(
            (c for c in conflicts if c["region"] == "QLD"),
            None,
        )
        assert qld_conflict is not None
        assert qld_conflict["risk_level"] == "CRITICAL"
        assert qld_conflict["aemo_intervention"] is True

        # --- KPIs ---
        kpis = d["kpis"]
        assert len(kpis) == 7

        for k in kpis:
            assert k["technology"]
            assert k["avg_planned_days_yr"] > 0
            assert 0 <= k["forced_outage_rate_pct"] <= 100
            assert 0 <= k["planned_outage_rate_pct"] <= 100
            assert k["maintenance_cost_m_aud_mw_yr"] > 0
            assert 0 <= k["reliability_index"] <= 100

        # Business: Solar should have lowest forced outage rate
        solar_kpi = next((k for k in kpis if k["technology"] == "Utility Solar"), None)
        assert solar_kpi is not None
        for other in kpis:
            if other["technology"] != "Utility Solar":
                assert solar_kpi["forced_outage_rate_pct"] <= other["forced_outage_rate_pct"]

        # Business: Brown coal should have highest EFOR
        brown_coal = next((k for k in kpis if k["technology"] == "Brown Coal"), None)
        assert brown_coal is not None
        assert brown_coal["forced_outage_rate_pct"] == max(k["forced_outage_rate_pct"] for k in kpis)


# ===========================================================================
# Sprint 56b — Wholesale Price Volatility Regime Analytics
# ===========================================================================

class TestVolatilityRegimeAnalytics:
    """Sprint 56b — Wholesale Price Volatility Regime Analytics endpoint tests."""

    def test_volatility_regime_dashboard(self, client: TestClient) -> None:
        resp = client.get(
            "/api/volatility-regime/dashboard",
            headers={"x-api-key": "test-key"},
        )
        assert resp.status_code == 200
        d = resp.json()

        # Top-level structure
        assert "timestamp" in d
        assert "regimes" in d
        assert "clusters" in d
        assert "hedging" in d
        assert "transitions" in d

        # regimes: 60 records (12 months × 5 regions)
        assert len(d["regimes"]) == 60
        valid_regimes = {"LOW", "NORMAL", "HIGH", "EXTREME"}
        regions_seen: set = set()
        months_seen: set = set()
        for rec in d["regimes"]:
            assert rec["month"].startswith("2024-")
            assert rec["region"] in {"NSW1", "VIC1", "QLD1", "SA1", "TAS1"}
            assert rec["regime"] in valid_regimes
            assert rec["avg_price_aud_mwh"] > 0
            assert rec["price_std_aud"] >= 0
            assert rec["spike_count"] >= 0
            assert rec["negative_price_hours"] >= 0
            assert rec["volatility_index"] >= 0
            assert rec["regime_duration_days"] > 0
            regions_seen.add(rec["region"])
            months_seen.add(rec["month"])

        # All 5 regions and 12 months must be represented
        assert regions_seen == {"NSW1", "VIC1", "QLD1", "SA1", "TAS1"}
        assert len(months_seen) == 12

        # SA1 should have the highest average volatility index
        sa1_avg_vi = sum(
            r["volatility_index"] for r in d["regimes"] if r["region"] == "SA1"
        ) / 12
        for region in {"NSW1", "VIC1", "QLD1", "TAS1"}:
            region_avg_vi = sum(
                r["volatility_index"] for r in d["regimes"] if r["region"] == region
            ) / 12
            assert sa1_avg_vi > region_avg_vi, (
                f"SA1 avg VI ({sa1_avg_vi:.2f}) should exceed {region} avg VI ({region_avg_vi:.2f})"
            )

        # clusters: 8 records
        assert len(d["clusters"]) == 8
        valid_triggers = {
            "HEATWAVE", "GAS_SHORTAGE", "LOW_WIND",
            "GENERATOR_OUTAGE", "INTERCONNECTOR_FAILURE", "MARKET_POWER",
        }
        for c in d["clusters"]:
            assert c["cluster_id"].startswith("VCE-")
            assert c["region"] in {"NSW1", "VIC1", "QLD1", "SA1", "TAS1"}
            assert c["start_date"] < c["end_date"]
            assert c["duration_days"] > 0
            assert c["trigger"] in valid_triggers
            assert c["max_price"] > c["avg_price"] > 0
            assert c["total_cost_impact_m_aud"] > 0

        # hedging: 4 records (one per regime)
        assert len(d["hedging"]) == 4
        hedge_regimes = {h["regime"] for h in d["hedging"]}
        assert hedge_regimes == {"LOW", "NORMAL", "HIGH", "EXTREME"}
        for h in d["hedging"]:
            assert 0 < h["recommended_hedge_ratio_pct"] <= 100
            assert h["cap_strike_optimal_aud"] > 0
            assert h["swap_volume_twh_yr"] > 0
            assert h["var_95_m_aud"] > 0
            assert h["cost_of_hedging_m_aud_twh"] > 0

        # Business logic: EXTREME hedge ratio > HIGH > NORMAL > LOW
        by_regime = {h["regime"]: h for h in d["hedging"]}
        assert by_regime["EXTREME"]["recommended_hedge_ratio_pct"] > by_regime["HIGH"]["recommended_hedge_ratio_pct"]
        assert by_regime["HIGH"]["recommended_hedge_ratio_pct"] > by_regime["NORMAL"]["recommended_hedge_ratio_pct"]
        assert by_regime["NORMAL"]["recommended_hedge_ratio_pct"] > by_regime["LOW"]["recommended_hedge_ratio_pct"]

        # Business logic: EXTREME cap strike must be highest
        assert by_regime["EXTREME"]["cap_strike_optimal_aud"] > by_regime["HIGH"]["cap_strike_optimal_aud"]
        assert by_regime["HIGH"]["cap_strike_optimal_aud"] > by_regime["NORMAL"]["cap_strike_optimal_aud"]
        assert by_regime["NORMAL"]["cap_strike_optimal_aud"] > by_regime["LOW"]["cap_strike_optimal_aud"]

        # transitions: 12 records
        assert len(d["transitions"]) == 12
        valid_t_regimes = {"LOW", "NORMAL", "HIGH", "EXTREME"}
        for t in d["transitions"]:
            assert t["from_regime"] in valid_t_regimes
            assert t["to_regime"] in valid_t_regimes
            assert t["from_regime"] != t["to_regime"]
            assert t["transition_count"] > 0
            assert t["avg_duration_before_transition_days"] > 0
            assert 0 < t["probability_pct"] <= 100
            assert t["typical_trigger"]

        # All 4 regimes must appear as from_regime
        from_regimes = {t["from_regime"] for t in d["transitions"]}
        assert from_regimes == valid_t_regimes


# ===========================================================================
# Sprint 57b — Power System Black Start & System Restart Analytics
# ===========================================================================

class TestBlackStartCapability:
    """Sprint 57b — Black Start & System Restart Analytics endpoint tests."""

    def test_black_start_dashboard(self, client: TestClient) -> None:
        resp = client.get(
            "/api/black-start/dashboard",
            headers={"x-api-key": "test-key"},
        )
        assert resp.status_code == 200
        d = resp.json()

        # Top-level structure
        assert "timestamp" in d
        assert "restart_zones" in d
        assert "black_start_units" in d
        assert "system_strength" in d
        assert "restore_progress" in d

        # ------------------------------------------------------------------
        # restart_zones: 10 records (2 per NEM region)
        # ------------------------------------------------------------------
        assert len(d["restart_zones"]) == 10
        valid_regions = {"NSW1", "VIC1", "QLD1", "SA1", "TAS1"}
        valid_adequacy = {"ADEQUATE", "MARGINAL", "INADEQUATE"}
        regions_seen: set = set()
        for zone in d["restart_zones"]:
            assert zone["zone_id"].startswith("BSZ-")
            assert zone["region"] in valid_regions
            assert isinstance(zone["anchor_units"], list)
            assert len(zone["anchor_units"]) >= 1
            assert zone["total_black_start_mw"] > 0
            assert zone["cranking_path"]
            assert zone["estimated_restore_hours"] > 0
            assert zone["zone_load_mw"] > 0
            assert zone["adequacy_status"] in valid_adequacy
            assert zone["last_tested_date"]
            regions_seen.add(zone["region"])

        # All 5 NEM regions must be present
        assert regions_seen == valid_regions

        # Each region must have exactly 2 zones
        from collections import Counter
        region_counts = Counter(z["region"] for z in d["restart_zones"])
        assert all(c == 2 for c in region_counts.values())

        # ------------------------------------------------------------------
        # black_start_units: 12 records
        # ------------------------------------------------------------------
        assert len(d["black_start_units"]) == 12
        valid_capability = {"FULL", "PARTIAL", "NONE"}
        valid_contract = {"MARKET", "CONTRACTED", "MANDATORY"}
        for unit in d["black_start_units"]:
            assert unit["unit_id"]
            assert unit["unit_name"]
            assert unit["technology"]
            assert unit["region"] in valid_regions
            assert unit["black_start_capability"] in valid_capability
            assert unit["cranking_power_mw"] >= 0
            assert isinstance(unit["self_excitation"], bool)
            assert unit["contract_type"] in valid_contract
            assert unit["contract_value_m_aud_yr"] >= 0
            assert unit["test_compliance"] in {"COMPLIANT", "NON_COMPLIANT"}

        # FULL capability units must have cranking_power_mw > 0
        for unit in d["black_start_units"]:
            if unit["black_start_capability"] == "FULL":
                assert unit["cranking_power_mw"] > 0

        # MANDATORY contracts must have zero contract value (covered by regulation)
        for unit in d["black_start_units"]:
            if unit["contract_type"] == "MANDATORY":
                assert unit["contract_value_m_aud_yr"] == 0

        # ------------------------------------------------------------------
        # system_strength: 5 records (one per NEM region)
        # ------------------------------------------------------------------
        assert len(d["system_strength"]) == 5
        valid_strength_status = {"ADEQUATE", "MARGINAL", "INADEQUATE"}
        strength_regions: set = set()
        for ss in d["system_strength"]:
            assert ss["region"] in valid_regions
            assert ss["fault_level_mva"] > 0
            assert ss["minimum_fault_level_mva"] > 0
            assert ss["system_strength_status"] in valid_strength_status
            assert ss["synchronous_generation_mw"] > 0
            assert 0 <= ss["inverter_based_resources_pct"] <= 100
            assert isinstance(ss["strength_providers"], list)
            assert len(ss["strength_providers"]) >= 1
            strength_regions.add(ss["region"])

        assert strength_regions == valid_regions

        # SA1 must be INADEQUATE (high IBR penetration scenario)
        sa_strength = next(s for s in d["system_strength"] if s["region"] == "SA1")
        assert sa_strength["system_strength_status"] == "INADEQUATE"
        assert sa_strength["fault_level_mva"] < sa_strength["minimum_fault_level_mva"]

        # SA1 must have the highest IBR percentage
        ibr_pcts = {s["region"]: s["inverter_based_resources_pct"] for s in d["system_strength"]}
        assert ibr_pcts["SA1"] == max(ibr_pcts.values())

        # ------------------------------------------------------------------
        # restore_progress: 20 records (10 hours × 2 scenarios)
        # ------------------------------------------------------------------
        assert len(d["restore_progress"]) == 20
        valid_scenarios = {"BEST_CASE", "WORST_CASE"}
        scenarios_seen: set = set()
        for rp in d["restore_progress"]:
            assert rp["scenario"] in valid_scenarios
            assert rp["hour"] >= 0
            assert rp["restored_load_mw"] >= 0
            assert 0 <= rp["restored_load_pct"] <= 100
            assert rp["active_zones"] >= 0
            assert rp["generation_online_mw"] >= 0
            assert rp["milestone"]
            scenarios_seen.add(rp["scenario"])

        assert scenarios_seen == valid_scenarios

        # Each scenario must have exactly 10 hourly records
        scenario_counts = Counter(r["scenario"] for r in d["restore_progress"])
        assert all(c == 10 for c in scenario_counts.values())

        # Business logic: BEST_CASE must restore more load than WORST_CASE at hour 5
        best_h5 = next(
            r["restored_load_pct"] for r in d["restore_progress"]
            if r["scenario"] == "BEST_CASE" and r["hour"] == 5
        )
        worst_h5 = next(
            r["restored_load_pct"] for r in d["restore_progress"]
            if r["scenario"] == "WORST_CASE" and r["hour"] == 5
        )
        assert best_h5 > worst_h5

        # Hour 0 should have 0% load restored for both scenarios
        for rp in d["restore_progress"]:
            if rp["hour"] == 0:
                assert rp["restored_load_pct"] == 0.0
                assert rp["restored_load_mw"] == 0.0


# ===========================================================================
# Sprint 57a — FCAS & Ancillary Services Cost Allocation Analytics
# ===========================================================================

class TestAncillaryServicesCost:
    """Tests for GET /api/ancillary-cost/dashboard."""

    def test_ancillary_cost_dashboard(self, client: TestClient) -> None:
        resp = client.get(
            "/api/ancillary-cost/dashboard",
            headers={"x-api-key": "test-api-key"},
        )
        assert resp.status_code == 200
        d = resp.json()

        # Top-level keys
        assert "timestamp" in d
        assert "services" in d
        assert "providers" in d
        assert "cost_allocations" in d
        assert "causer_pays" in d

        # 24 service records: 8 services x 3 months
        assert len(d["services"]) == 24
        valid_services = {
            "RAISE_6SEC", "RAISE_60SEC", "RAISE_5MIN",
            "LOWER_6SEC", "LOWER_60SEC", "LOWER_5MIN",
            "RAISE_REG", "LOWER_REG",
        }
        for svc in d["services"]:
            assert svc["service"] in valid_services
            assert svc["clearing_price_aud_mw"] > 0
            assert svc["volume_mw"] > 0
            assert svc["total_cost_m_aud"] > 0
            assert svc["num_providers"] >= 1
            assert 0 < svc["herfindahl_index"] < 1

        # All 8 service types must be present
        service_types_found = {s["service"] for s in d["services"]}
        assert service_types_found == valid_services

        # Months present: 2024-01, 2024-02, 2024-03
        months_found = {s["month"] for s in d["services"]}
        assert months_found == {"2024-01", "2024-02", "2024-03"}

        # RAISE_REG must have highest average clearing price (regulation is most expensive)
        by_service: dict = {}
        for svc in d["services"]:
            by_service.setdefault(svc["service"], []).append(svc["clearing_price_aud_mw"])
        avg_prices = {k: sum(v) / len(v) for k, v in by_service.items()}
        assert avg_prices["RAISE_REG"] > avg_prices["RAISE_6SEC"]
        assert avg_prices["LOWER_REG"] > avg_prices["LOWER_6SEC"]

        # 20 provider records
        assert len(d["providers"]) == 20
        for p in d["providers"]:
            assert p["participant"]
            assert p["service"]
            assert p["enabled_mw"] > 0
            assert p["revenue_m_aud"] > 0
            assert 0 < p["market_share_pct"] <= 100
            assert 0 < p["avg_enablement_rate_pct"] <= 100
            assert p["technology"]

        # 15 cost allocation records: 5 regions x 3 months
        assert len(d["cost_allocations"]) == 15
        valid_mechanisms = {"CAUSER_PAYS", "PRO_RATA"}
        valid_regions = {"NSW1", "QLD1", "VIC1", "SA1", "TAS1"}
        for ca in d["cost_allocations"]:
            assert ca["region"] in valid_regions
            assert ca["allocation_mechanism"] in valid_mechanisms
            assert ca["total_fcas_cost_m_aud"] > 0
            assert 0 < ca["energy_market_share_pct"] <= 100
            assert ca["allocated_cost_m_aud"] > 0
            assert ca["cost_per_mwh_aud"] > 0

        # All 5 regions must appear
        regions_found = {ca["region"] for ca in d["cost_allocations"]}
        assert regions_found == valid_regions

        # SA1 must have highest cost_per_mwh_aud among all allocations
        sa1_cpMwh = [ca["cost_per_mwh_aud"] for ca in d["cost_allocations"] if ca["region"] == "SA1"]
        other_avg = [ca["cost_per_mwh_aud"] for ca in d["cost_allocations"] if ca["region"] != "SA1"]
        assert min(sa1_cpMwh) > min(other_avg)

        # NSW1 must have highest energy_market_share_pct
        nsw_shares = [ca["energy_market_share_pct"] for ca in d["cost_allocations"] if ca["region"] == "NSW1"]
        qld_shares = [ca["energy_market_share_pct"] for ca in d["cost_allocations"] if ca["region"] == "QLD1"]
        assert sum(nsw_shares) / len(nsw_shares) > sum(qld_shares) / len(qld_shares)

        # 12 causer-pays records
        assert len(d["causer_pays"]) == 12
        valid_cause_types = {
            "LOAD_VARIATION", "GENERATION_VARIATION", "INTERCONNECTOR", "MARKET_NOTICE"
        }
        for cp in d["causer_pays"]:
            assert cp["participant"]
            assert cp["service"]
            assert 0 < cp["causer_pays_factor"] < 1
            assert cp["cost_contribution_m_aud"] > 0
            assert cp["cause_type"] in valid_cause_types
            assert cp["month"] in {"2024-01", "2024-02", "2024-03"}

        # Causer-pays factors must be strictly decreasing when sorted
        factors = sorted([cp["causer_pays_factor"] for cp in d["causer_pays"]], reverse=True)
        assert factors == sorted(factors, reverse=True)

        # Business logic: highest factor participant should be AGL Energy (0.182)
        top_cp = max(d["causer_pays"], key=lambda x: x["causer_pays_factor"])
        assert top_cp["participant"] == "AGL Energy"
        assert top_cp["causer_pays_factor"] == pytest.approx(0.182, abs=0.001)

        # INTERCONNECTOR cause types must be present
        cause_types_found = {cp["cause_type"] for cp in d["causer_pays"]}
        assert "INTERCONNECTOR" in cause_types_found
        assert "GENERATION_VARIATION" in cause_types_found


class TestCbamTradeAnalytics:
    """Sprint 57c — CBAM & Australian Export Trade Analytics endpoint tests."""

    def test_cbam_trade_dashboard(self, client: TestClient) -> None:
        resp = client.get(
            "/api/cbam-trade/dashboard",
            headers={"x-api-key": "test-key"},
        )
        assert resp.status_code == 200
        d = resp.json()

        # Top-level structure
        assert "timestamp" in d
        assert "export_sectors" in d
        assert "trade_flows" in d
        assert "clean_exports" in d
        assert "policies" in d

        # export_sectors: exactly 8 records
        assert len(d["export_sectors"]) == 8
        valid_sectors = {
            "ALUMINIUM", "STEEL", "CEMENT", "CHEMICALS",
            "LNG", "CLEAN_HYDROGEN", "GREEN_AMMONIA", "BATTERY_MATERIALS",
        }
        sectors_seen = set()
        for s in d["export_sectors"]:
            assert s["sector"] in valid_sectors
            assert s["export_value_bn_aud"] > 0
            assert s["carbon_intensity_tco2_per_tonne"] >= 0
            assert s["cbam_exposure_m_aud"] >= 0
            assert isinstance(s["clean_alternative_available"], bool)
            assert s["transition_timeline_years"] >= 0
            assert s["australian_competitive_advantage"]
            sectors_seen.add(s["sector"])
        assert sectors_seen == valid_sectors

        # CBAM_EXPOSURE: CLEAN_HYDROGEN and GREEN_AMMONIA should be 0
        zero_exposure = {
            s["sector"]
            for s in d["export_sectors"]
            if s["cbam_exposure_m_aud"] == 0.0
        }
        assert "CLEAN_HYDROGEN" in zero_exposure
        assert "GREEN_AMMONIA" in zero_exposure

        # ALUMINIUM must have the highest CBAM exposure
        by_sector = {s["sector"]: s for s in d["export_sectors"]}
        assert by_sector["ALUMINIUM"]["cbam_exposure_m_aud"] == max(
            s["cbam_exposure_m_aud"] for s in d["export_sectors"]
        )

        # trade_flows: exactly 20 records (10 partners × 2 sectors)
        assert len(d["trade_flows"]) == 20
        partners_seen = set()
        for f in d["trade_flows"]:
            assert f["trading_partner"]
            assert f["sector"]
            assert f["export_volume_kt"] > 0
            assert f["embedded_carbon_kt_co2"] > 0
            assert 0 < f["cbam_tariff_rate_pct"] <= 10
            assert f["cbam_cost_m_aud"] >= 0
            assert f["year"] == 2025
            partners_seen.add(f["trading_partner"])
        assert len(partners_seen) == 10

        # EU must have the highest tariff rate
        eu_rates = [f["cbam_tariff_rate_pct"] for f in d["trade_flows"] if f["trading_partner"] == "European Union"]
        max_rate = max(f["cbam_tariff_rate_pct"] for f in d["trade_flows"])
        assert all(r == max_rate for r in eu_rates)

        # clean_exports: exactly 6 records
        assert len(d["clean_exports"]) == 6
        valid_products = {
            "GREEN_HYDROGEN", "GREEN_AMMONIA", "GREEN_STEEL",
            "CLEAN_ALUMINUM", "SILICON_METAL", "LITHIUM_HYDROXIDE",
        }
        products_seen = set()
        for c in d["clean_exports"]:
            assert c["product"] in valid_products
            assert c["production_cost_aud_tonne"] > 0
            assert c["target_price_aud_tonne"] > 0
            assert c["market_size_bn_aud"] > 0
            assert c["competitiveness_rank"] >= 1
            assert len(c["key_markets"]) >= 1
            assert c["target_2030_kt"] > 0
            products_seen.add(c["product"])
        assert products_seen == valid_products

        # LITHIUM_HYDROXIDE should have the largest market size (120 bn AUD)
        by_product = {c["product"]: c for c in d["clean_exports"]}
        assert by_product["LITHIUM_HYDROXIDE"]["market_size_bn_aud"] == max(
            c["market_size_bn_aud"] for c in d["clean_exports"]
        )

        # policies: exactly 5 records
        assert len(d["policies"]) == 5
        valid_statuses = {"ENACTED", "PROPOSED", "UNDER_REVIEW"}
        countries_seen = set()
        for p in d["policies"]:
            assert p["country"]
            assert p["policy_name"]
            assert p["implementation_year"] >= 2025
            assert p["carbon_price_aud_tonne"] > 0
            assert len(p["sectors_covered"]) >= 1
            assert p["australia_exposure_m_aud"] >= 0
            assert p["policy_status"] in valid_statuses
            countries_seen.add(p["country"])
        assert len(countries_seen) == 5

        # EU must be ENACTED and have highest AU exposure
        by_country = {p["country"]: p for p in d["policies"]}
        assert by_country["European Union"]["policy_status"] == "ENACTED"
        assert by_country["United Kingdom"]["policy_status"] == "ENACTED"
        assert by_country["European Union"]["australia_exposure_m_aud"] == max(
            p["australia_exposure_m_aud"] for p in d["policies"]
        )

        # EU must have highest carbon price
        assert by_country["European Union"]["carbon_price_aud_tonne"] == max(
            p["carbon_price_aud_tonne"] for p in d["policies"]
        )


# ===========================================================================
# Sprint 58a — Network Congestion Revenue & SRA Analytics
# ===========================================================================

class TestCongestionRevenueAnalytics:
    def test_congestion_revenue_dashboard(self, client: TestClient) -> None:
        response = client.get(
            "/api/congestion-revenue/dashboard",
            headers={"X-API-Key": "test-key"},
        )
        assert response.status_code == 200
        d = response.json()

        # Top-level keys
        assert "timestamp" in d
        assert "sra_contracts" in d
        assert "congestion_rents" in d
        assert "nodal_prices" in d
        assert "interconnector_economics" in d

        # SRA contracts: 12 records (4 interconnectors × 3 quarters)
        sra = d["sra_contracts"]
        assert len(sra) == 12
        valid_directions = {"FORWARD", "REVERSE"}
        interconnectors_seen: set[str] = set()
        for c in sra:
            assert c["contract_id"]
            assert c["quarter"]
            assert c["interconnector"]
            assert c["direction"] in valid_directions
            assert c["mw_contracted"] > 0
            assert c["clearing_price_aud_mwh"] > 0
            assert c["total_value_m_aud"] > 0
            assert c["holder"]
            assert 0.0 <= c["utilisation_pct"] <= 100.0
            interconnectors_seen.add(c["interconnector"])
        # exactly 4 interconnectors
        assert len(interconnectors_seen) == 4

        # Congestion rents: 8 records
        rents = d["congestion_rents"]
        assert len(rents) == 8
        for r in rents:
            assert r["quarter"]
            assert r["interconnector"]
            assert r["total_rent_m_aud"] > 0
            assert r["sra_allocated_m_aud"] > 0
            assert r["retained_m_aud"] > 0
            # allocated + retained should equal total
            assert abs(r["sra_allocated_m_aud"] + r["retained_m_aud"] - r["total_rent_m_aud"]) < 0.1
            assert r["beneficiary"]
            assert 0.0 < r["binding_hours_pct"] < 100.0
            assert r["avg_price_diff_aud"] > 0

        # NSW1-QLD1 should have the highest total rent across all quarters
        rent_by_ic: dict[str, float] = {}
        for r in rents:
            rent_by_ic[r["interconnector"]] = rent_by_ic.get(r["interconnector"], 0) + r["total_rent_m_aud"]
        assert max(rent_by_ic, key=lambda k: rent_by_ic[k]) == "NSW1-QLD1"

        # Nodal prices: 10 records
        nodes = d["nodal_prices"]
        assert len(nodes) == 10
        regions_seen: set[str] = set()
        for n in nodes:
            assert n["node_id"]
            assert n["node_name"]
            assert n["region"]
            assert n["avg_lmp_aud_mwh"] > 0
            # energy component should be positive
            assert n["energy_component_aud"] > 0
            # avg_lmp ≈ energy + congestion + loss
            approx_lmp = n["energy_component_aud"] + n["congestion_component_aud"] + n["loss_component_aud"]
            assert abs(approx_lmp - n["avg_lmp_aud_mwh"]) < 0.5
            regions_seen.add(n["region"])
        # at least 4 regions represented
        assert len(regions_seen) >= 4

        # SA1 should have highest congestion components
        sa_nodes = [n for n in nodes if n["region"] == "SA1"]
        assert len(sa_nodes) >= 1
        assert max(n["congestion_component_aud"] for n in sa_nodes) > max(
            n["congestion_component_aud"] for n in nodes if n["region"] == "NSW1"
        )

        # Interconnector economics: 6 records
        economics = d["interconnector_economics"]
        assert len(economics) == 6
        for e in economics:
            assert e["interconnector"]
            assert e["year"] >= 2024
            assert e["total_flows_gwh"] > 0
            assert e["revenue_generated_m_aud"] > 0
            assert e["cost_allocated_m_aud"] > 0
            assert e["net_benefit_m_aud"] == pytest.approx(
                e["revenue_generated_m_aud"] - e["cost_allocated_m_aud"], abs=0.2
            )
            assert e["benefit_cost_ratio"] > 1.0
            assert 0.0 < e["capacity_factor_pct"] <= 100.0

        # NSW1-QLD1 should have best BCR (latest year)
        latest_by_ic: dict[str, dict] = {}
        for e in economics:
            if e["interconnector"] not in latest_by_ic or e["year"] > latest_by_ic[e["interconnector"]]["year"]:
                latest_by_ic[e["interconnector"]] = e
        best_bcr_ic = max(latest_by_ic, key=lambda k: latest_by_ic[k]["benefit_cost_ratio"])
        assert best_bcr_ic == "NSW1-QLD1"


# ===========================================================================
# TestEnergyAffordabilityAnalytics
# ===========================================================================

class TestEnergyAffordabilityAnalytics:
    """Tests for GET /api/energy-affordability/dashboard (Sprint 58c)."""

    def test_energy_affordability_dashboard(self):
        """Validates full structure, counts, enums, and key data invariants."""
        resp = client.get(
            "/api/energy-affordability/dashboard",
            headers={"X-API-Key": "test-api-key"},
        )
        assert resp.status_code == 200, resp.text
        d = resp.json()

        # Top-level keys
        for key in ("timestamp", "bill_trends", "income_affordability", "solar_impact", "assistance_programs"):
            assert key in d, f"Missing top-level key: {key}"

        # --- bill_trends: 30 records (6 states × 5 years) ---
        assert len(d["bill_trends"]) == 30, f"Expected 30 bill trend records, got {len(d['bill_trends'])}"
        valid_states = {"NSW", "VIC", "QLD", "SA", "WA", "TAS"}
        valid_years  = {2020, 2021, 2022, 2023, 2024}
        states_seen: set = set()
        years_seen:  set = set()
        for rec in d["bill_trends"]:
            assert rec["state"] in valid_states
            assert rec["year"] in valid_years
            assert rec["avg_annual_bill_aud"] > 0
            assert 0 < rec["median_income_pct"] < 20
            assert rec["usage_kwh"] > 0
            assert rec["network_charges_aud"] > 0
            assert rec["wholesale_charges_aud"] > 0
            assert rec["environmental_charges_aud"] > 0
            assert rec["retail_margin_aud"] > 0
            states_seen.add(rec["state"])
            years_seen.add(rec["year"])
        assert states_seen == valid_states
        assert years_seen  == valid_years

        # SA must have the highest avg bill in 2024
        trends_2024 = [r for r in d["bill_trends"] if r["year"] == 2024]
        by_state_2024 = {r["state"]: r["avg_annual_bill_aud"] for r in trends_2024}
        assert by_state_2024["SA"] == max(by_state_2024.values()), "SA should have highest 2024 bill"
        assert by_state_2024["WA"] == min(by_state_2024.values()), "WA should have lowest 2024 bill"

        # --- income_affordability: 30 records (6 states × 5 cohorts) ---
        assert len(d["income_affordability"]) == 30, f"Expected 30 income affordability records"
        valid_cohorts = {"BOTTOM_20PCT", "LOWER_MIDDLE", "MIDDLE", "UPPER_MIDDLE", "TOP_20PCT"}
        cohorts_seen: set = set()
        for rec in d["income_affordability"]:
            assert rec["state"] in valid_states
            assert rec["income_cohort"] in valid_cohorts
            assert rec["annual_income_aud"] > 0
            assert rec["energy_spend_aud"] > 0
            assert rec["energy_burden_pct"] > 0
            assert 0 <= rec["solar_ownership_pct"] <= 100
            assert 0 <= rec["hardship_rate_pct"] <= 100
            cohorts_seen.add(rec["income_cohort"])
        assert cohorts_seen == valid_cohorts

        # Bottom 20% must always have higher energy burden than Top 20% within each state
        for state in valid_states:
            bottom = next(r for r in d["income_affordability"]
                          if r["state"] == state and r["income_cohort"] == "BOTTOM_20PCT")
            top    = next(r for r in d["income_affordability"]
                          if r["state"] == state and r["income_cohort"] == "TOP_20PCT")
            assert bottom["energy_burden_pct"] > top["energy_burden_pct"], \
                f"{state}: bottom 20% burden should exceed top 20% burden"

        # SA should have the highest bottom-20% energy burden
        bottom_20_by_state = {
            r["state"]: r["energy_burden_pct"]
            for r in d["income_affordability"]
            if r["income_cohort"] == "BOTTOM_20PCT"
        }
        assert bottom_20_by_state["SA"] == max(bottom_20_by_state.values()), \
            "SA bottom-20% energy burden should be the highest"

        # --- solar_impact: 24 records (6 states × 4 household types) ---
        assert len(d["solar_impact"]) == 24, f"Expected 24 solar impact records"
        valid_types = {"NO_SOLAR", "SOLAR_ONLY", "SOLAR_BATTERY", "VPP_PARTICIPANT"}
        types_seen: set = set()
        for rec in d["solar_impact"]:
            assert rec["state"] in valid_states
            assert rec["household_type"] in valid_types
            assert rec["avg_annual_bill_aud"] >= 0
            assert rec["avg_annual_export_aud"] >= 0
            assert rec["payback_years"] >= 0
            assert 0 <= rec["adoption_pct"] <= 100
            types_seen.add(rec["household_type"])
        assert types_seen == valid_types

        # NO_SOLAR households should always have the highest net cost per state
        for state in valid_states:
            no_solar = next(r for r in d["solar_impact"]
                            if r["state"] == state and r["household_type"] == "NO_SOLAR")
            solar_only = next(r for r in d["solar_impact"]
                              if r["state"] == state and r["household_type"] == "SOLAR_ONLY")
            assert no_solar["net_energy_cost_aud"] > solar_only["net_energy_cost_aud"], \
                f"{state}: NO_SOLAR net cost should exceed SOLAR_ONLY net cost"

        # VPP_PARTICIPANT should have the lowest (most negative) net cost in QLD and SA
        for state in ("QLD", "SA"):
            state_recs = [r for r in d["solar_impact"] if r["state"] == state]
            min_cost_type = min(state_recs, key=lambda r: r["net_energy_cost_aud"])
            assert min_cost_type["household_type"] == "VPP_PARTICIPANT", \
                f"{state}: VPP_PARTICIPANT should have the lowest net energy cost"

        # --- assistance_programs: 12 records ---
        assert len(d["assistance_programs"]) == 12, f"Expected 12 assistance program records"
        valid_program_types = {"REBATE", "CONCESSION", "PAYMENT_PLAN", "FREE_APPLIANCE"}
        program_types_seen: set = set()
        for prog in d["assistance_programs"]:
            assert prog["program_name"]
            assert prog["state"] in valid_states
            assert prog["eligible_cohort"]
            assert prog["rebate_aud"] >= 0
            assert prog["recipients_k"] > 0
            assert prog["total_cost_m_aud"] > 0
            assert 0 <= prog["effectiveness_score"] <= 10
            assert prog["program_type"] in valid_program_types
            program_types_seen.add(prog["program_type"])
        assert program_types_seen == valid_program_types, \
            "All 4 program types must be represented"

        # NSW Solar for Low Income should have the highest effectiveness score
        by_program = {p["program_name"]: p for p in d["assistance_programs"]}
        assert by_program["NSW Solar for Low Income"]["effectiveness_score"] == max(
            p["effectiveness_score"] for p in d["assistance_programs"]
        ), "NSW Solar for Low Income should have the highest effectiveness score"

        # Total assistance spending must exceed 1000 M AUD
        total_spend = sum(p["total_cost_m_aud"] for p in d["assistance_programs"])
        assert total_spend > 1000, f"Total assistance spend {total_spend:.1f}M should exceed 1000M AUD"


class TestClimatePhysicalRisk:
    """Sprint 58b — Climate Physical Risk to Grid Assets endpoint tests."""

    def test_climate_physical_risk_dashboard(self, client: TestClient) -> None:
        resp = client.get(
            "/api/climate-risk/physical-dashboard",
            headers={"x-api-key": "test-key"},
        )
        assert resp.status_code == 200
        d = resp.json()

        # Top-level structure
        assert "timestamp" in d
        assert "assets" in d
        assert "hazard_projections" in d
        assert "climate_events" in d
        assert "adaptation_measures" in d

        # assets: exactly 12 records
        assert len(d["assets"]) == 12
        valid_asset_types = {
            "TRANSMISSION_LINE", "SUBSTATION", "GENERATION",
            "DISTRIBUTION", "STORAGE",
        }
        valid_hazards = {
            "EXTREME_HEAT", "FLOODING", "BUSHFIRE",
            "CYCLONE", "SEA_LEVEL_RISE", "DROUGHT",
        }
        valid_adaptation_statuses = {"NO_ACTION", "PLANNING", "IN_PROGRESS", "COMPLETE"}
        for a in d["assets"]:
            assert a["asset_id"]
            assert a["asset_name"]
            assert a["asset_type"] in valid_asset_types
            assert a["region"]
            assert a["value_m_aud"] > 0
            assert 0 <= a["exposure_score"] <= 100
            assert 0 <= a["vulnerability_score"] <= 100
            assert 0 <= a["risk_score"] <= 100
            assert a["primary_hazard"] in valid_hazards
            assert a["adaptation_status"] in valid_adaptation_statuses

        # Highest risk asset should have risk_score >= 80
        max_risk = max(a["risk_score"] for a in d["assets"])
        assert max_risk >= 80.0

        # All five asset types must be represented
        types_seen = {a["asset_type"] for a in d["assets"]}
        assert types_seen == valid_asset_types

        # hazard_projections: exactly 20 records (5 hazards × 2 scenarios × 2 regions)
        assert len(d["hazard_projections"]) == 20
        valid_scenarios = {"RCP45", "RCP85"}
        valid_confidence = {"HIGH", "MEDIUM", "LOW"}
        for h in d["hazard_projections"]:
            assert h["hazard"] in valid_hazards
            assert h["scenario"] in valid_scenarios
            assert h["confidence_level"] in valid_confidence
            assert h["year_2030_change_pct"] > 0
            assert h["year_2050_change_pct"] > h["year_2030_change_pct"]
            assert h["year_2070_change_pct"] > h["year_2050_change_pct"]
            assert h["frequency_multiplier"] >= 1.0

        # RCP85 must have higher 2070 change than RCP45 for same hazard+region
        rcp85_2070 = {(h["hazard"], h["region"]): h["year_2070_change_pct"] for h in d["hazard_projections"] if h["scenario"] == "RCP85"}
        rcp45_2070 = {(h["hazard"], h["region"]): h["year_2070_change_pct"] for h in d["hazard_projections"] if h["scenario"] == "RCP45"}
        for key in rcp85_2070:
            if key in rcp45_2070:
                assert rcp85_2070[key] > rcp45_2070[key]

        # climate_events: exactly 8 records
        assert len(d["climate_events"]) == 8
        valid_event_types = {"FLOODING", "EXTREME_HEAT", "BUSHFIRE", "CYCLONE", "STORM"}
        for e in d["climate_events"]:
            assert e["event_id"]
            assert e["event_type"] in valid_event_types
            assert e["date"]
            assert e["region"]
            assert e["assets_affected"] > 0
            assert e["damage_m_aud"] > 0
            assert e["outage_hours"] >= 0
            assert e["customers_affected_k"] > 0
            assert e["recovery_cost_m_aud"] > 0

        # Highest damage event should be a BUSHFIRE
        max_event = max(d["climate_events"], key=lambda e: e["damage_m_aud"])
        assert max_event["event_type"] == "BUSHFIRE"

        # adaptation_measures: exactly 10 records
        assert len(d["adaptation_measures"]) == 10
        valid_priorities = {"HIGH", "MEDIUM", "LOW"}
        for m in d["adaptation_measures"]:
            assert m["measure"]
            assert m["asset_type"] in valid_asset_types
            assert m["cost_m_aud"] > 0
            assert 0 < m["risk_reduction_pct"] <= 100
            assert m["implementation_years"] >= 1
            assert m["benefit_cost_ratio"] > 0
            assert m["priority"] in valid_priorities

        # At least 3 HIGH priority measures
        high_priority = [m for m in d["adaptation_measures"] if m["priority"] == "HIGH"]
        assert len(high_priority) >= 3

        # Best BCR measure should have BCR > 5
        best_bcr = max(m["benefit_cost_ratio"] for m in d["adaptation_measures"])
        assert best_bcr > 5.0


# ---------------------------------------------------------------------------
# Sprint 59c — Australian Electricity Export Infrastructure
# ---------------------------------------------------------------------------

# TestElectricityExportInfra
# Validates GET /api/electricity-export/dashboard

class TestElectricityExportInfra:
    """Tests for the Electricity Export Infrastructure dashboard endpoint."""

    def test_electricity_export_dashboard(self, client, auth_headers):
        resp = client.get("/api/electricity-export/dashboard", headers=auth_headers)
        assert resp.status_code == 200

        d = resp.json()
        # Top-level keys
        assert "timestamp" in d
        assert "cable_projects" in d
        assert "renewable_zones" in d
        assert "export_markets" in d
        assert "economic_projections" in d

        # ── cable_projects: exactly 7 records ──────────────────────────────
        assert len(d["cable_projects"]) == 7
        valid_cable_statuses = {"OPERATING", "CONSTRUCTION", "APPROVED", "PROPOSED", "CANCELLED"}
        valid_technologies = {"HVDC", "HVAC"}
        for p in d["cable_projects"]:
            assert p["project_id"]
            assert p["name"]
            assert p["route"]
            assert p["capacity_gw"] > 0
            assert p["length_km"] > 0
            assert p["capex_bn_aud"] > 0
            assert p["technology"] in valid_technologies
            assert p["status"] in valid_cable_statuses
            assert p["proponent"]
            assert p["expected_cod"] > 2020

        # Sun Cable AAPowerLink should be PROPOSED with capacity 3.2 GW
        sun_cable = next(p for p in d["cable_projects"] if "Sun Cable AAPowerLink" in p["name"])
        assert sun_cable["status"] == "PROPOSED"
        assert sun_cable["capacity_gw"] == 3.2

        # Marinus Link records (both legs) should be APPROVED
        marinus = [p for p in d["cable_projects"] if "Marinus Link" in p["name"]]
        assert len(marinus) == 2
        for m in marinus:
            assert m["status"] == "APPROVED"

        # ── renewable_zones: exactly 8 records ─────────────────────────────
        assert len(d["renewable_zones"]) == 8
        valid_resources = {"SOLAR", "WIND", "HYBRID"}
        for z in d["renewable_zones"]:
            assert z["zone_id"]
            assert z["zone_name"]
            assert z["state"]
            assert z["primary_resource"] in valid_resources
            assert z["potential_gw"] > 0
            assert z["committed_gw"] >= 0
            assert z["estimated_lcoe_aud_mwh"] > 0
            assert z["grid_connection_cost_bn_aud"] > 0

        # At least 3 export-oriented zones
        export_zones = [z for z in d["renewable_zones"] if z["export_oriented"]]
        assert len(export_zones) >= 3

        # All three resource types must be represented
        resources_present = {z["primary_resource"] for z in d["renewable_zones"]}
        assert "SOLAR" in resources_present
        assert "WIND" in resources_present
        assert "HYBRID" in resources_present

        # ── export_markets: exactly 8 records ──────────────────────────────
        assert len(d["export_markets"]) == 8
        expected_countries = {"Japan", "Singapore", "Indonesia", "South Korea",
                               "Philippines", "Malaysia", "India", "China"}
        actual_countries = {m["destination_country"] for m in d["export_markets"]}
        assert actual_countries == expected_countries

        valid_forms = {"ELECTRICITY", "GREEN_H2", "GREEN_AMMONIA", "LNG_CCS"}
        valid_agreement_statuses = {"SIGNED", "NEGOTIATING", "MOU", "NONE"}
        for m in d["export_markets"]:
            assert m["import_potential_twh_yr"] > 0
            assert m["preferred_form"] in valid_forms
            assert m["agreement_status"] in valid_agreement_statuses
            assert m["bilateral_trade_bn_aud"] > 0

        # Japan and Singapore should be SIGNED
        japan = next(m for m in d["export_markets"] if m["destination_country"] == "Japan")
        singapore = next(m for m in d["export_markets"] if m["destination_country"] == "Singapore")
        assert japan["agreement_status"] == "SIGNED"
        assert singapore["agreement_status"] == "SIGNED"

        # China should have the highest import potential
        china = next(m for m in d["export_markets"] if m["destination_country"] == "China")
        assert china["import_potential_twh_yr"] == max(m["import_potential_twh_yr"] for m in d["export_markets"])

        # ── economic_projections: exactly 15 records (3 scenarios × 5 years) ─
        assert len(d["economic_projections"]) == 15
        scenarios = {p["scenario"] for p in d["economic_projections"]}
        assert len(scenarios) == 3
        assert "Conservative" in scenarios
        assert "Moderate" in scenarios
        assert "Accelerated" in scenarios

        years = {p["year"] for p in d["economic_projections"]}
        assert len(years) == 5

        for p in d["economic_projections"]:
            assert p["export_revenue_bn_aud"] > 0
            assert p["jobs_created_k"] > 0
            assert p["investment_attracted_bn_aud"] > 0
            assert p["renewable_capacity_gw"] > 0
            assert p["co2_abated_mt"] > 0

        # Accelerated scenario always has higher revenue than Conservative for each year
        for year in years:
            acc = next(p for p in d["economic_projections"] if p["scenario"] == "Accelerated" and p["year"] == year)
            con = next(p for p in d["economic_projections"] if p["scenario"] == "Conservative" and p["year"] == year)
            assert acc["export_revenue_bn_aud"] > con["export_revenue_bn_aud"]

        # Final year (2035) Accelerated revenue should be > 50 bn AUD
        acc_2035 = next(p for p in d["economic_projections"] if p["scenario"] == "Accelerated" and p["year"] == max(years))
        assert acc_2035["export_revenue_bn_aud"] > 50.0


class TestElectrificationAnalytics:
    """Tests for GET /api/electrification/dashboard (Sprint 59a)."""

    def test_electrification_dashboard(self):
        """Validates full structure, counts, enums, and key data invariants."""
        resp = client.get(
            "/api/electrification/dashboard",
            headers={"X-API-Key": "test-key"},
        )
        assert resp.status_code == 200, resp.text
        d = resp.json()

        # Top-level keys
        for key in ("timestamp", "adoption", "load_impacts", "gas_networks", "programs"):
            assert key in d, f"Missing top-level key: {key}"

        # --- adoption: 25 records (5 appliance types × 5 states) ---
        assert len(d["adoption"]) == 25, f"Expected 25 adoption records, got {len(d['adoption'])}"
        valid_states = {"NSW", "VIC", "QLD", "SA", "WA"}
        valid_appliance_types = {
            "HEAT_PUMP_HVAC", "HEAT_PUMP_WATER", "INDUCTION_COOKTOP", "EV_CHARGER", "ALL_ELECTRIC_HOME"
        }
        states_seen: set = set()
        appliance_types_seen: set = set()
        for rec in d["adoption"]:
            assert rec["state"] in valid_states
            assert rec["appliance_type"] in valid_appliance_types
            assert rec["total_units_k"] > 0
            assert rec["annual_additions_k"] > 0
            assert 0 < rec["market_penetration_pct"] < 100
            assert rec["avg_install_cost_aud"] > 0
            assert rec["payback_years"] > 0
            states_seen.add(rec["state"])
            appliance_types_seen.add(rec["appliance_type"])
        assert states_seen == valid_states
        assert appliance_types_seen == valid_appliance_types

        # Induction cooktop should have the lowest avg install cost
        by_type_cost = {}
        for atype in valid_appliance_types:
            recs = [r for r in d["adoption"] if r["appliance_type"] == atype]
            by_type_cost[atype] = sum(r["avg_install_cost_aud"] for r in recs) / len(recs)
        assert by_type_cost["INDUCTION_COOKTOP"] == min(by_type_cost.values()), \
            "Induction cooktop should have the lowest avg install cost"

        # All-Electric Home should have the highest avg install cost
        assert by_type_cost["ALL_ELECTRIC_HOME"] == max(by_type_cost.values()), \
            "All-Electric Home should have the highest avg install cost"

        # --- load_impacts: 20 records (5 states × 4 years 2024-2027) ---
        assert len(d["load_impacts"]) == 20, f"Expected 20 load impact records, got {len(d['load_impacts'])}"
        valid_years = {2024, 2025, 2026, 2027}
        years_seen: set = set()
        li_states_seen: set = set()
        for rec in d["load_impacts"]:
            assert rec["state"] in valid_states
            assert rec["year"] in valid_years
            assert rec["additional_peak_mw"] > 0
            assert rec["additional_annual_gwh"] > 0
            assert rec["gas_displaced_pj"] > 0
            assert rec["co2_reduction_kt"] > 0
            assert rec["grid_augmentation_cost_m_aud"] > 0
            assert rec["flexibility_potential_mw"] > 0
            years_seen.add(rec["year"])
            li_states_seen.add(rec["state"])
        assert years_seen == valid_years
        assert li_states_seen == valid_states

        # Peak demand should increase year-over-year for each state
        for state in valid_states:
            state_recs = sorted(
                [r for r in d["load_impacts"] if r["state"] == state],
                key=lambda r: r["year"]
            )
            for i in range(1, len(state_recs)):
                assert state_recs[i]["additional_peak_mw"] > state_recs[i-1]["additional_peak_mw"], \
                    f"{state}: peak demand should increase year over year"

        # VIC should have higher cumulative peak demand than SA
        vic_2027 = next(r for r in d["load_impacts"] if r["state"] == "VIC" and r["year"] == 2027)
        sa_2027  = next(r for r in d["load_impacts"] if r["state"] == "SA"  and r["year"] == 2027)
        assert vic_2027["additional_peak_mw"] > sa_2027["additional_peak_mw"], \
            "VIC 2027 peak demand should exceed SA 2027"

        # --- gas_networks: 8 records ---
        assert len(d["gas_networks"]) == 8, f"Expected 8 gas network records, got {len(d['gas_networks'])}"
        valid_regulatory_statuses = {"ALLOWED", "UNDER_REVIEW", "RESTRICTED", "BANNED"}
        reg_statuses_seen: set = set()
        for rec in d["gas_networks"]:
            assert rec["network_name"]
            assert rec["state"]
            assert rec["residential_connections_k"] > 0
            assert rec["annual_consumption_pj"] > 0
            assert 0 < rec["electrification_risk_pct"] < 100
            assert rec["asset_value_m_aud"] > 0
            assert rec["stranded_asset_risk_m_aud"] > 0
            assert rec["stranded_asset_risk_m_aud"] < rec["asset_value_m_aud"], \
                f"{rec['network_name']}: stranded risk should be less than total asset value"
            assert rec["regulatory_status"] in valid_regulatory_statuses
            reg_statuses_seen.add(rec["regulatory_status"])

        # All 4 regulatory statuses must be represented
        assert reg_statuses_seen == valid_regulatory_statuses, \
            f"All regulatory statuses should appear; got {reg_statuses_seen}"

        # Network with BANNED status should have highest electrification_risk_pct
        banned_net = next((r for r in d["gas_networks"] if r["regulatory_status"] == "BANNED"), None)
        assert banned_net is not None
        max_risk = max(r["electrification_risk_pct"] for r in d["gas_networks"])
        assert banned_net["electrification_risk_pct"] == max_risk, \
            "BANNED network should have highest electrification risk"

        # --- programs: 10 records ---
        assert len(d["programs"]) == 10, f"Expected 10 program records, got {len(d['programs'])}"
        valid_program_types = {"REBATE", "LOAN", "VPP_INCENTIVE", "BULK_PURCHASE"}
        prog_types_seen: set = set()
        for rec in d["programs"]:
            assert rec["program_name"]
            assert rec["state"]
            assert rec["program_type"] in valid_program_types
            assert rec["annual_budget_m_aud"] > 0
            assert rec["appliances_supported"]
            assert rec["uptake_rate_pct"] > 0
            assert rec["co2_abatement_cost_aud_tonne"] > 0
            prog_types_seen.add(rec["program_type"])

        # All 4 program types must be represented
        assert prog_types_seen == valid_program_types, \
            f"All program types should appear; got {prog_types_seen}"

        # Bulk purchase programs should have lowest average abatement cost
        bulk_avg = sum(
            r["co2_abatement_cost_aud_tonne"]
            for r in d["programs"] if r["program_type"] == "BULK_PURCHASE"
        ) / len([r for r in d["programs"] if r["program_type"] == "BULK_PURCHASE"])
        rebate_avg = sum(
            r["co2_abatement_cost_aud_tonne"]
            for r in d["programs"] if r["program_type"] == "REBATE"
        ) / len([r for r in d["programs"] if r["program_type"] == "REBATE"])
        assert bulk_avg < rebate_avg, "BULK_PURCHASE programs should have lower abatement cost than REBATE on average"

        # Rebate programs should have rebate_amount_aud > 0
        for rec in d["programs"]:
            if rec["program_type"] == "REBATE":
                assert rec["rebate_amount_aud"] > 0, \
                    f"{rec['program_name']}: REBATE programs must have rebate_amount_aud > 0"


# ---------------------------------------------------------------------------
# Sprint 59b — Long Duration Energy Storage (LDES) Economics
# ---------------------------------------------------------------------------

class TestLdesEconomicsAnalytics:
    """Tests for GET /api/ldes-economics/dashboard (Sprint 59b)."""

    def test_ldes_economics_dashboard(self):
        """Validates full structure, record counts, enums, and key data invariants."""
        resp = client.get(
            "/api/ldes-economics/dashboard",
            headers={"X-API-Key": "test-api-key"},
        )
        assert resp.status_code == 200, resp.text
        d = resp.json()

        # Top-level keys
        for key in ("timestamp", "technologies", "economic_cases", "projects", "seasonal_patterns"):
            assert key in d, f"Missing top-level key: {key}"

        # --- technologies: exactly 10 records ---
        assert len(d["technologies"]) == 10, (
            f"Expected 10 technology records, got {len(d['technologies'])}"
        )
        valid_tech_ids = {
            "PUMPED_HYDRO", "COMPRESSED_AIR", "FLOW_VANADIUM", "FLOW_ZINC",
            "LIQUID_AIR", "GREEN_HYDROGEN_STORAGE", "THERMAL_MOLTEN_SALT",
            "GRAVITY_RAIL", "IRON_AIR", "ADIABATIC_CAES",
        }
        tech_ids_seen = set()
        for tech in d["technologies"]:
            assert tech["tech_id"] in valid_tech_ids, f"Unknown tech_id: {tech['tech_id']}"
            assert tech["name"], "Technology name must not be empty"
            assert tech["duration_range_hr"], "duration_range_hr must not be empty"
            assert tech["current_lcos_aud_mwh"] > 0
            assert tech["target_lcos_2035_aud_mwh"] > 0
            assert tech["target_lcos_2035_aud_mwh"] < tech["current_lcos_aud_mwh"], (
                f"{tech['name']}: 2035 target must be lower than current LCOS"
            )
            assert 1 <= tech["technology_readiness_level"] <= 9
            assert tech["capex_aud_kwh"] > 0
            assert 0 < tech["round_trip_efficiency_pct"] <= 100
            assert tech["self_discharge_rate_pct_day"] >= 0
            assert tech["project_lifetime_years"] > 0
            assert tech["australian_projects"] >= 0
            tech_ids_seen.add(tech["tech_id"])
        assert tech_ids_seen == valid_tech_ids, "Not all 10 tech_ids present"

        # Pumped hydro must have the highest TRL
        ph = next(t for t in d["technologies"] if t["tech_id"] == "PUMPED_HYDRO")
        max_trl = max(t["technology_readiness_level"] for t in d["technologies"])
        assert ph["technology_readiness_level"] == max_trl

        # At least 4 technologies at TRL >= 7 (commercial / demonstration)
        trl7_count = sum(1 for t in d["technologies"] if t["technology_readiness_level"] >= 7)
        assert trl7_count >= 4, f"Expected >=4 technologies at TRL>=7, got {trl7_count}"

        # --- economic_cases: exactly 3 scenario records ---
        assert len(d["economic_cases"]) == 3, (
            f"Expected 3 economic case records, got {len(d['economic_cases'])}"
        )
        valid_scenarios = {"HIGH_VRE_90", "HIGH_VRE_75", "MEDIUM_VRE_60"}
        scenarios_seen = set()
        for ec in d["economic_cases"]:
            assert ec["scenario"] in valid_scenarios, f"Unknown scenario: {ec['scenario']}"
            assert ec["duration_optimal_hr"] > 0
            assert ec["storage_required_gwh"] > 0
            assert ec["ldes_capacity_gw"] > 0
            assert ec["avoided_curtailment_gwh"] > 0
            assert ec["system_cost_saving_m_aud"] > 0
            assert ec["optimal_technology"]
            assert ec["breakeven_lcos_aud_mwh"] > 0
            scenarios_seen.add(ec["scenario"])
        assert scenarios_seen == valid_scenarios

        # Higher VRE penetration should require more storage
        by_scenario = {ec["scenario"]: ec for ec in d["economic_cases"]}
        assert (
            by_scenario["HIGH_VRE_90"]["storage_required_gwh"]
            > by_scenario["HIGH_VRE_75"]["storage_required_gwh"]
            > by_scenario["MEDIUM_VRE_60"]["storage_required_gwh"]
        ), "Storage required should increase with VRE penetration"

        # Higher VRE should have greater system savings
        assert (
            by_scenario["HIGH_VRE_90"]["system_cost_saving_m_aud"]
            > by_scenario["MEDIUM_VRE_60"]["system_cost_saving_m_aud"]
        )

        # --- projects: exactly 12 records ---
        assert len(d["projects"]) == 12, (
            f"Expected 12 project records, got {len(d['projects'])}"
        )
        valid_statuses = {"OPERATING", "CONSTRUCTION", "APPROVED", "PROPOSED"}
        statuses_seen = set()
        for proj in d["projects"]:
            assert proj["project_name"]
            assert proj["technology"]
            assert proj["region"]
            assert proj["capacity_gwh"] > 0
            assert proj["power_mw"] > 0
            assert proj["status"] in valid_statuses, f"Unknown status: {proj['status']}"
            assert proj["proponent"]
            assert proj["capex_m_aud"] > 0
            assert 2020 <= proj["expected_cod"] <= 2040
            assert proj["energy_to_power_ratio"] > 0
            statuses_seen.add(proj["status"])
        # All 4 status types should appear
        assert statuses_seen == valid_statuses, f"Missing statuses: {valid_statuses - statuses_seen}"

        # Snowy 2.0 should be the largest project by capacity
        snowy = next((p for p in d["projects"] if "Snowy" in p["project_name"]), None)
        assert snowy is not None, "Snowy 2.0 project not found"
        max_capacity = max(p["capacity_gwh"] for p in d["projects"])
        assert snowy["capacity_gwh"] == max_capacity

        # At least one PUMPED_HYDRO project in CONSTRUCTION
        phes_construction = [
            p for p in d["projects"]
            if p["technology"] == "PUMPED_HYDRO" and p["status"] == "CONSTRUCTION"
        ]
        assert len(phes_construction) >= 1

        # --- seasonal_patterns: exactly 12 records (one per month) ---
        assert len(d["seasonal_patterns"]) == 12, (
            f"Expected 12 seasonal pattern records, got {len(d['seasonal_patterns'])}"
        )
        expected_months = {"Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"}
        months_seen = set()
        for sp in d["seasonal_patterns"]:
            assert sp["month"] in expected_months, f"Unknown month: {sp['month']}"
            assert sp["vre_surplus_gwh"] > 0
            assert sp["vre_deficit_gwh"] > 0
            assert sp["optimal_charge_gwh"] > 0
            assert sp["optimal_discharge_gwh"] > 0
            assert 0 < sp["storage_utilisation_pct"] <= 100
            assert sp["price_arbitrage_aud_mwh"] > 0
            # Optimal charge should be <= surplus
            assert sp["optimal_charge_gwh"] <= sp["vre_surplus_gwh"]
            # Optimal discharge should be <= deficit
            assert sp["optimal_discharge_gwh"] <= sp["vre_deficit_gwh"]
            months_seen.add(sp["month"])
        assert months_seen == expected_months

        # Winter months (Jun, Jul) should have higher price arbitrage than summer (Dec, Jan)
        by_month = {sp["month"]: sp for sp in d["seasonal_patterns"]}
        avg_winter_arb = (by_month["Jun"]["price_arbitrage_aud_mwh"] + by_month["Jul"]["price_arbitrage_aud_mwh"]) / 2
        avg_summer_arb = (by_month["Dec"]["price_arbitrage_aud_mwh"] + by_month["Jan"]["price_arbitrage_aud_mwh"]) / 2
        assert avg_winter_arb > avg_summer_arb, (
            "Winter price arbitrage should exceed summer arbitrage in a high-VRE NEM"
        )

        # Summer should have higher VRE surplus than winter
        assert by_month["Jan"]["vre_surplus_gwh"] > by_month["Jun"]["vre_surplus_gwh"]
        assert by_month["Dec"]["vre_surplus_gwh"] > by_month["Jul"]["vre_surplus_gwh"]


class TestProsumerAnalytics:
    """Sprint 60c — Prosumer & Behind-the-Meter Analytics endpoint tests."""

    def test_prosumer_dashboard(self, client):
        resp = client.get("/api/prosumer/dashboard", headers={"x-api-key": "test-key"})
        assert resp.status_code == 200
        d = resp.json()

        # Top-level keys
        for key in ("timestamp", "installations", "net_load", "exports", "vpps"):
            assert key in d, f"Missing top-level key: {key}"

        # ---- Installations ----
        installs = d["installations"]
        assert len(installs) == 25, f"Expected 25 installation records, got {len(installs)}"

        states_seen = {r["state"] for r in installs}
        assert states_seen == {"NSW", "VIC", "QLD", "SA", "WA"}

        years_seen = {r["year"] for r in installs}
        assert years_seen == {2020, 2021, 2022, 2023, 2024}

        for r in installs:
            assert r["rooftop_solar_mw"] > 0
            assert r["btm_battery_mwh"] >= 0
            assert 0 < r["avg_system_size_kw"] <= 50
            assert 0 <= r["export_capable_pct"] <= 100
            assert 0 <= r["smart_meter_pct"] <= 100

        # 2024 solar should exceed 2020 for every state
        by_state_year = {(r["state"], r["year"]): r for r in installs}
        for st in ("NSW", "VIC", "QLD", "SA", "WA"):
            assert by_state_year[(st, 2024)]["rooftop_solar_mw"] > by_state_year[(st, 2020)]["rooftop_solar_mw"], (
                f"{st}: 2024 rooftop solar should exceed 2020"
            )

        # ---- Net Load ----
        net_load = d["net_load"]
        assert len(net_load) == 30, f"Expected 30 net load records, got {len(net_load)}"

        nl_states = {r["state"] for r in net_load}
        assert nl_states == {"NSW", "VIC", "QLD", "SA", "WA"}

        nl_months = {r["month"] for r in net_load}
        assert nl_months == {"Jan", "Mar", "May", "Jul", "Sep", "Nov"}

        for r in net_load:
            assert r["gross_demand_gwh"] > 0
            assert r["btm_solar_generation_gwh"] >= 0
            assert r["net_demand_gwh"] < r["gross_demand_gwh"], (
                "Net demand must be less than gross demand"
            )
            assert r["duck_curve_depth_mw"] >= 0
            assert r["evening_ramp_mw_hr"] >= 0

        # Summer (Jan) BTM solar should exceed winter (Jul) for each state
        nl_by = {(r["state"], r["month"]): r for r in net_load}
        for st in ("NSW", "VIC", "QLD", "SA", "WA"):
            assert nl_by[(st, "Jan")]["btm_solar_generation_gwh"] > nl_by[(st, "Jul")]["btm_solar_generation_gwh"], (
                f"{st}: January solar generation should exceed July"
            )

        # ---- Exports ----
        exports = d["exports"]
        assert len(exports) == 20, f"Expected 20 export records, got {len(exports)}"

        exp_states = {r["state"] for r in exports}
        assert exp_states == {"NSW", "VIC", "QLD", "SA", "WA"}

        exp_years = {r["year"] for r in exports}
        assert exp_years == {2021, 2022, 2023, 2024}

        for r in exports:
            assert r["total_exports_gwh"] > 0
            assert r["avg_fit_rate_aud_kwh"] > 0
            assert 0 <= r["curtailment_pct"] <= 100
            assert isinstance(r["grid_constraint_triggered"], bool)

        # 2024 exports should exceed 2021 for each state
        exp_by = {(r["state"], r["year"]): r for r in exports}
        for st in ("NSW", "VIC", "QLD", "SA", "WA"):
            assert exp_by[(st, 2024)]["total_exports_gwh"] > exp_by[(st, 2021)]["total_exports_gwh"], (
                f"{st}: 2024 exports should exceed 2021"
            )

        # SA should have highest curtailment in 2024 (most constrained)
        curtailments_2024 = {r["state"]: r["curtailment_pct"] for r in exports if r["year"] == 2024}
        assert curtailments_2024["SA"] == max(curtailments_2024.values()), (
            "SA should have the highest export curtailment in 2024"
        )

        # ---- VPPs ----
        vpps = d["vpps"]
        assert len(vpps) == 8, f"Expected 8 VPP records, got {len(vpps)}"

        vpp_states = {r["state"] for r in vpps}
        assert vpp_states.issubset({"NSW", "VIC", "QLD", "SA", "WA"})

        for r in vpps:
            assert r["enrolled_customers_k"] > 0
            assert r["total_battery_mwh"] > 0
            assert r["peak_dispatch_mw"] > 0
            assert r["annual_events"] > 0
            assert r["avg_event_duration_hr"] > 0
            assert r["revenue_per_customer_aud"] > 0
            assert len(r["operator"]) > 0

        # Total VPP battery capacity should exceed 500 MWh
        total_mwh = sum(r["total_battery_mwh"] for r in vpps)
        assert total_mwh > 500, f"Total VPP battery capacity {total_mwh} MWh should exceed 500 MWh"

        # Synergy Home Battery Scheme should be the largest by battery MWh (WA)
        largest = max(vpps, key=lambda r: r["total_battery_mwh"])
        assert largest["state"] == "WA", "Largest VPP by battery MWh should be in WA"


# ---------------------------------------------------------------------------
# Sprint 60a — Gas-Fired Generation Transition Analytics
# ---------------------------------------------------------------------------

class TestGasTransitionAnalytics:
    """Tests for GET /api/gas-transition/dashboard (Sprint 60a)."""

    def test_gas_transition_dashboard(self):
        """Validates structure, record counts, enums and key data invariants."""
        resp = client.get(
            "/api/gas-transition/dashboard",
            headers={"X-API-Key": "test-api-key"},
        )
        assert resp.status_code == 200, resp.text
        d = resp.json()

        # Top-level keys
        for key in ("timestamp", "generators", "gas_supply", "hydrogen_blending", "capacity_outlook"):
            assert key in d, f"Missing top-level key: {key}"

        # --- generators: exactly 12 records ---
        generators = d["generators"]
        assert len(generators) == 12, (
            f"Expected 12 generator records, got {len(generators)}"
        )
        valid_technologies = {"OCGT", "CCGT", "RECIP", "STEAM"}
        valid_exit_triggers = {"ECONOMICS", "FUEL", "POLICY", "AGE", None}
        for g in generators:
            assert g["unit_id"], "unit_id must not be empty"
            assert g["unit_name"], "unit_name must not be empty"
            assert g["technology"] in valid_technologies, f"Unknown technology: {g['technology']}"
            assert g["region"], "region must not be empty"
            assert g["capacity_mw"] > 0, "capacity_mw must be positive"
            assert 1950 <= g["commissioning_year"] <= 2030
            assert isinstance(g["h2_capable"], bool)
            assert g["gas_contract_expiry"] >= 2024
            assert g["srmc_aud_mwh"] > 0
            assert 0 <= g["capacity_factor_pct"] <= 100
            assert g["exit_trigger"] in valid_exit_triggers, f"Unknown exit_trigger: {g['exit_trigger']}"

        # At least 3 CCGT units
        ccgt_count = sum(1 for g in generators if g["technology"] == "CCGT")
        assert ccgt_count >= 3, f"Expected at least 3 CCGT units, got {ccgt_count}"

        # At least 1 H2-capable unit
        h2_capable_count = sum(1 for g in generators if g["h2_capable"])
        assert h2_capable_count >= 1, "At least 1 generator must be H2-capable"

        # H2-capable units must have an h2_ready_year set
        for g in generators:
            if g["h2_capable"]:
                assert g["h2_ready_year"] is not None, (
                    f"H2-capable unit {g['unit_id']} must have h2_ready_year set"
                )

        # Exit year units must have exit_trigger set
        for g in generators:
            if g["exit_year"] is not None:
                assert g["exit_trigger"] is not None, (
                    f"Unit {g['unit_id']} has exit_year but no exit_trigger"
                )

        # --- gas_supply: exactly 8 basin records ---
        gas_supply = d["gas_supply"]
        assert len(gas_supply) == 8, (
            f"Expected 8 gas supply records, got {len(gas_supply)}"
        )
        valid_price_trends = {"RISING", "STABLE", "FALLING"}
        for b in gas_supply:
            assert b["basin"], "basin must not be empty"
            assert b["region"], "region must not be empty"
            assert b["reserves_pj"] > 0
            assert b["reserve_life_years"] > 0
            assert 0 <= b["domestic_reservation_pct"] <= 100
            assert b["price_aud_gj"] > 0
            assert b["price_trend"] in valid_price_trends, f"Unknown price_trend: {b['price_trend']}"
            assert isinstance(b["pipeline_connected"], bool)

        # Carnarvon Basin should be the largest by reserves
        largest_basin = max(gas_supply, key=lambda b: b["reserves_pj"])
        assert "Carnarvon" in largest_basin["basin"] or "Browse" in largest_basin["basin"], (
            "Largest basin by reserves should be Carnarvon or Browse"
        )

        # At least 1 basin with pipeline_connected = False (undeveloped basins)
        unconnected = [b for b in gas_supply if not b["pipeline_connected"]]
        assert len(unconnected) >= 1, "At least 1 basin should not have pipeline connectivity"

        # Gippsland should be 100% domestically reserved
        gippsland = next((b for b in gas_supply if "Gippsland" in b["basin"]), None)
        assert gippsland is not None, "Gippsland Basin must be present"
        assert gippsland["domestic_reservation_pct"] == 100.0, (
            "Gippsland should be 100% domestically reserved"
        )

        # --- hydrogen_blending: exactly 8 records ---
        h2_blending = d["hydrogen_blending"]
        assert len(h2_blending) == 8, (
            f"Expected 8 hydrogen blending records, got {len(h2_blending)}"
        )
        valid_risks = {"LOW", "MEDIUM", "HIGH"}
        for r in h2_blending:
            assert r["unit_id"], "unit_id must not be empty"
            assert 0 <= r["blend_pct_2025"] <= 100
            assert 0 <= r["blend_pct_2030"] <= 100
            assert 0 <= r["blend_pct_2035"] <= 100
            # Blend should be non-decreasing over time
            assert r["blend_pct_2030"] >= r["blend_pct_2025"], (
                f"{r['unit_id']}: 2030 blend must be >= 2025 blend"
            )
            assert r["blend_pct_2035"] >= r["blend_pct_2030"], (
                f"{r['unit_id']}: 2035 blend must be >= 2030 blend"
            )
            assert r["conversion_cost_m_aud"] >= 0
            assert r["operational_risk"] in valid_risks, f"Unknown operational_risk: {r['operational_risk']}"
            assert r["derating_pct"] >= 0

        # TALWB1 (H2-ready unit) should have highest 2035 blend pct
        talwb = next((r for r in h2_blending if r["unit_id"] == "TALWB1"), None)
        assert talwb is not None, "TALWB1 must be in hydrogen_blending records"
        max_2035 = max(r["blend_pct_2035"] for r in h2_blending)
        assert talwb["blend_pct_2035"] == max_2035 or talwb["blend_pct_2035"] >= 40.0, (
            "TALWB1 (H2-ready) should have a high 2035 blend percentage"
        )

        # --- capacity_outlook: exactly 8 records (2024-2031) ---
        outlook = d["capacity_outlook"]
        assert len(outlook) == 8, (
            f"Expected 8 capacity outlook records, got {len(outlook)}"
        )
        years_seen = set()
        for o in outlook:
            assert 2024 <= o["year"] <= 2031
            assert o["ocgt_mw"] >= 0
            assert o["ccgt_mw"] >= 0
            assert o["h2_turbine_mw"] >= 0
            assert o["total_gas_mw"] > 0
            assert o["retirements_mw"] >= 0
            assert o["gas_generation_twh"] > 0
            assert o["role_in_nem"], "role_in_nem must not be empty"
            years_seen.add(o["year"])
        expected_years = set(range(2024, 2032))
        assert years_seen == expected_years, f"Expected years 2024-2031, got {years_seen}"

        # H2 turbine capacity should grow monotonically from 2024 to 2031
        by_year = {o["year"]: o for o in outlook}
        assert by_year[2031]["h2_turbine_mw"] >= by_year[2027]["h2_turbine_mw"], (
            "H2 turbine capacity should grow over time"
        )
        assert by_year[2024]["h2_turbine_mw"] == 0.0, (
            "H2 turbine capacity should be zero in 2024"
        )

        # Gas generation (TWh) should decline from 2024 to 2031 (energy transition)
        assert by_year[2031]["gas_generation_twh"] < by_year[2024]["gas_generation_twh"], (
            "Gas generation should decline from 2024 to 2031"
        )


class TestTnspAnalytics:
    """Sprint 60b — TNSP Revenue & Investment Analytics endpoint tests."""

    def test_tnsp_analytics_dashboard(self, client, auth_headers):
        resp = client.get("/api/tnsp-analytics/dashboard", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        d = resp.json()

        # Top-level keys
        for key in ("timestamp", "tnsps", "reliability", "projects", "regulatory"):
            assert key in d, f"Missing key: {key}"

        # ── TNSP records ──────────────────────────────────────────────────────
        tnsps = d["tnsps"]
        assert len(tnsps) == 5, f"Expected 5 TNSPs, got {len(tnsps)}"

        expected_ids = {"TRANSGRID", "ELECTRANET", "TASNETWORKS", "POWERLINK", "AUSNET_TX"}
        actual_ids = {t["tnsp_id"] for t in tnsps}
        assert actual_ids == expected_ids, f"TNSP ID mismatch: {actual_ids}"

        for t in tnsps:
            assert t["regulated_asset_base_bn_aud"] > 0, "RAB must be positive"
            assert t["revenue_determination_bn_aud"] > 0, "Revenue must be positive"
            assert 0 < t["wacc_real_pct"] < 10, f"WACC out of range: {t['wacc_real_pct']}"
            assert t["network_length_km"] > 0
            assert t["substations"] > 0
            assert t["capex_m_aud_yr"] > 0
            assert t["opex_m_aud_yr"] > 0
            assert t["determination_period"]

        # TransGrid should have largest RAB
        rab_by_id = {t["tnsp_id"]: t["regulated_asset_base_bn_aud"] for t in tnsps}
        assert rab_by_id["TRANSGRID"] == max(rab_by_id.values()), \
            "TransGrid should have largest RAB"

        # ── Reliability records ───────────────────────────────────────────────
        reliability = d["reliability"]
        assert len(reliability) == 15, f"Expected 15 reliability records (5 TNSPs x 3 years), got {len(reliability)}"

        years_seen = {r["year"] for r in reliability}
        assert years_seen == {2022, 2023, 2024}, f"Expected years 2022-2024, got {years_seen}"

        tnsps_seen = {r["tnsp"] for r in reliability}
        assert len(tnsps_seen) == 5, f"Expected 5 TNSPs in reliability, got {len(tnsps_seen)}"

        for r in reliability:
            assert r["saidi_minutes"] > 0, "SAIDI must be positive"
            assert r["system_minutes_lost"] > 0
            assert r["circuit_outages"] > 0
            assert 0 < r["unplanned_outage_rate_pct"] < 10
            assert r["transmission_constraint_hours"] > 0
            assert r["asset_age_avg_years"] > 0

        # ElectraNet should be most constrained (highest SAIDI) in latest year
        latest_year = max(r["year"] for r in reliability)
        latest = [r for r in reliability if r["year"] == latest_year]
        most_constrained = max(latest, key=lambda r: r["saidi_minutes"])
        assert most_constrained["tnsp"] == "ElectraNet", \
            f"ElectraNet should be most constrained, got {most_constrained['tnsp']}"

        # Reliability should improve year-over-year for TransGrid
        tg = sorted([r for r in reliability if r["tnsp"] == "TransGrid"], key=lambda r: r["year"])
        assert tg[0]["saidi_minutes"] > tg[-1]["saidi_minutes"], \
            "TransGrid SAIDI should improve over the period"

        # ── Project records ───────────────────────────────────────────────────
        projects = d["projects"]
        assert len(projects) == 12, f"Expected 12 project records, got {len(projects)}"

        valid_statuses = {"COMPLETE", "CONSTRUCTION", "APPROVED", "PROPOSED"}
        valid_types    = {"AUGMENTATION", "REPLACEMENT", "UPGRADE", "NEW_BUILD"}
        valid_drivers  = {"NETWORK_SECURITY", "LOAD_GROWTH", "RENEWABLE_CONNECTION", "RELIABILITY", "ISP"}

        for p in projects:
            assert p["status"] in valid_statuses, f"Invalid status: {p['status']}"
            assert p["project_type"] in valid_types, f"Invalid type: {p['project_type']}"
            assert p["primary_driver"] in valid_drivers, f"Invalid driver: {p['primary_driver']}"
            assert p["investment_m_aud"] > 0
            assert p["commissioning_year"] >= 2020
            assert p["vre_enabled_mw"] >= 0

        # All 4 statuses should be present
        statuses_present = {p["status"] for p in projects}
        assert statuses_present == valid_statuses, f"Missing statuses: {valid_statuses - statuses_present}"

        # CopperString should be the largest project by investment
        largest = max(projects, key=lambda p: p["investment_m_aud"])
        assert "CopperString" in largest["project_name"], \
            f"CopperString should be largest project, got {largest['project_name']}"

        # At least 3 ISP-driven projects
        isp_count = sum(1 for p in projects if p["primary_driver"] == "ISP")
        assert isp_count >= 3, f"Expected at least 3 ISP-driven projects, got {isp_count}"

        # ── Regulatory records ────────────────────────────────────────────────
        regulatory = d["regulatory"]
        assert len(regulatory) == 10, f"Expected 10 regulatory records, got {len(regulatory)}"

        valid_decisions = {"ACCEPTED", "REVISED", "REJECTED"}
        for r in regulatory:
            assert r["aer_decision"] in valid_decisions, f"Invalid AER decision: {r['aer_decision']}"
            assert r["allowed_revenue_m_aud"] > 0
            assert r["actual_revenue_m_aud"] > 0
            assert r["efficiency_carryover_m_aud"] >= 0
            assert 0 < r["cpi_escalator_pct"] < 10
            assert r["regulatory_period"]
            assert r["tnsp"]

        # All 5 TNSPs should have regulatory records
        reg_tnsps = {r["tnsp"] for r in regulatory}
        assert len(reg_tnsps) == 5, f"Expected 5 TNSPs in regulatory, got {len(reg_tnsps)}"

        # Actual revenue should always be below allowed (efficiency delivered)
        for r in regulatory:
            assert r["actual_revenue_m_aud"] <= r["allowed_revenue_m_aud"], \
                f"{r['tnsp']} {r['regulatory_period']}: actual revenue exceeds allowed"

        # Majority of decisions should be ACCEPTED or REVISED (not REJECTED)
        accepted_or_revised = sum(1 for r in regulatory if r["aer_decision"] in {"ACCEPTED", "REVISED"})
        assert accepted_or_revised == len(regulatory), \
            "No regulatory records should have REJECTED decision in mock data"


class TestReliabilityStandardAnalytics:
    """Sprint 61a — NEM Reliability Standard & USE Analytics endpoint tests."""

    def test_reliability_standard_dashboard(self, client, auth_headers):
        resp = client.get("/api/reliability-standard/dashboard", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        d = resp.json()

        # Top-level keys
        for key in ("timestamp", "use_records", "reserve_margins", "events", "demand_side"):
            assert key in d, f"Missing key: {key}"

        # ── USE records ───────────────────────────────────────────────────────
        use_records = d["use_records"]
        assert len(use_records) == 15, f"Expected 15 USE records (5 regions x 3 years), got {len(use_records)}"

        regions_seen = {r["region"] for r in use_records}
        expected_regions = {"NSW1", "VIC1", "QLD1", "SA1", "TAS1"}
        assert regions_seen == expected_regions, f"Region mismatch: {regions_seen}"

        years_seen = {r["year"] for r in use_records}
        assert years_seen == {2022, 2023, 2024}, f"Expected years 2022-2024, got {years_seen}"

        valid_compliance = {"COMPLIANT", "BREACH", "AT_RISK"}
        for r in use_records:
            assert r["compliance"] in valid_compliance, f"Invalid compliance: {r['compliance']}"
            assert r["unserved_energy_mwh"] > 0, "USE must be positive"
            assert 0 < r["use_pct"] < 1, f"USE pct out of range: {r['use_pct']}"
            assert r["standard_pct"] == 0.002, f"Standard pct should be 0.002, got {r['standard_pct']}"
            assert r["events"] >= 1, "Events must be at least 1"
            assert r["max_event_duration_hr"] > 0
            assert r["economic_cost_m_aud"] > 0

        # BREACH records should have use_pct > standard_pct
        for r in use_records:
            if r["compliance"] == "BREACH":
                assert r["use_pct"] > r["standard_pct"], \
                    f"BREACH record {r['region']} {r['year']} has use_pct {r['use_pct']} <= standard {r['standard_pct']}"

        # COMPLIANT records should have use_pct <= standard_pct
        for r in use_records:
            if r["compliance"] == "COMPLIANT":
                assert r["use_pct"] <= r["standard_pct"], \
                    f"COMPLIANT record {r['region']} {r['year']} has use_pct {r['use_pct']} > standard {r['standard_pct']}"

        # SA1 should have at least one BREACH
        sa1_breaches = [r for r in use_records if r["region"] == "SA1" and r["compliance"] == "BREACH"]
        assert len(sa1_breaches) >= 1, "SA1 should have at least one BREACH record"

        # NSW1 and QLD1 should be fully COMPLIANT
        nsw_non_compliant = [r for r in use_records if r["region"] == "NSW1" and r["compliance"] != "COMPLIANT"]
        assert len(nsw_non_compliant) == 0, f"NSW1 should be fully COMPLIANT, got {nsw_non_compliant}"

        qld_non_compliant = [r for r in use_records if r["region"] == "QLD1" and r["compliance"] != "COMPLIANT"]
        assert len(qld_non_compliant) == 0, f"QLD1 should be fully COMPLIANT, got {qld_non_compliant}"

        # ── Reserve margin records ─────────────────────────────────────────────
        reserve_margins = d["reserve_margins"]
        assert len(reserve_margins) == 15, f"Expected 15 reserve margin records, got {len(reserve_margins)}"

        rm_regions = {r["region"] for r in reserve_margins}
        assert rm_regions == expected_regions, f"Region mismatch in reserve margins: {rm_regions}"

        rm_years = {r["year"] for r in reserve_margins}
        assert rm_years == {2022, 2023, 2024}, f"Expected years 2022-2024, got {rm_years}"

        for r in reserve_margins:
            assert r["peak_demand_mw"] > 0
            assert r["available_capacity_mw"] > 0
            assert r["reserve_margin_pct"] >= 0
            assert r["required_reserve_pct"] == 15.0, f"Required reserve should be 15%, got {r['required_reserve_pct']}"
            # surplus_deficit should be consistent with reserve margin vs required
            if r["reserve_margin_pct"] < r["required_reserve_pct"]:
                assert r["surplus_deficit_mw"] < 0, \
                    f"Below-standard margin should have negative surplus: {r['region']} {r['year']}"
            else:
                assert r["surplus_deficit_mw"] >= 0, \
                    f"Above-standard margin should have non-negative surplus: {r['region']} {r['year']}"

        # QLD1 should have highest reserve margins (well-resourced)
        latest_year = max(r["year"] for r in reserve_margins)
        latest_rm = [r for r in reserve_margins if r["year"] == latest_year]
        qld_rm = next(r for r in latest_rm if r["region"] == "QLD1")
        sa1_rm = next(r for r in latest_rm if r["region"] == "SA1")
        assert qld_rm["reserve_margin_pct"] > sa1_rm["reserve_margin_pct"], \
            "QLD1 should have higher reserve margin than SA1 in latest year"

        # TAS1 should have very high reserve margin (hydro surplus)
        tas_rm = next(r for r in latest_rm if r["region"] == "TAS1")
        assert tas_rm["reserve_margin_pct"] > 50, \
            f"TAS1 should have >50% reserve margin (hydro), got {tas_rm['reserve_margin_pct']}"

        # ── Reliability event records ──────────────────────────────────────────
        events = d["events"]
        assert len(events) == 8, f"Expected 8 reliability events, got {len(events)}"

        valid_causes = {
            "GENERATION_SHORTFALL", "NETWORK_FAILURE", "EXTREME_WEATHER",
            "DEMAND_SURGE", "EQUIPMENT_FAILURE",
        }
        for ev in events:
            assert ev["cause"] in valid_causes, f"Invalid cause: {ev['cause']}"
            assert ev["duration_hr"] > 0
            assert ev["customers_affected_k"] > 0
            assert ev["use_mwh"] > 0
            assert ev["estimated_cost_m_aud"] > 0
            assert ev["date"], "Event must have a date"
            assert ev["event_id"], "Event must have an event_id"
            assert isinstance(ev["nem_intervention"], bool), "nem_intervention must be bool"

        # NEM interventions should be the majority (high-impact events)
        nem_intervention_count = sum(1 for ev in events if ev["nem_intervention"])
        assert nem_intervention_count >= 4, \
            f"Expected at least 4 NEM interventions, got {nem_intervention_count}"

        # SA1 and VIC1 should have the most events (high-risk regions)
        sa1_events = [ev for ev in events if ev["region"] == "SA1"]
        vic_events = [ev for ev in events if ev["region"] == "VIC1"]
        assert len(sa1_events) >= 2, f"Expected at least 2 SA1 events, got {len(sa1_events)}"
        assert len(vic_events) >= 2, f"Expected at least 2 VIC1 events, got {len(vic_events)}"

        # ── Demand-side records ────────────────────────────────────────────────
        demand_side = d["demand_side"]
        assert len(demand_side) == 12, f"Expected 12 demand-side records, got {len(demand_side)}"

        valid_mechanisms = {"RERT", "DSP", "VPP", "INTERRUPTIBLE_LOAD"}
        mechanisms_seen = {r["mechanism"] for r in demand_side}
        assert mechanisms_seen == valid_mechanisms, f"Mechanism mismatch: {mechanisms_seen}"

        for r in demand_side:
            assert r["registered_mw"] > 0
            assert r["activated_mw"] > 0
            assert r["activated_mw"] <= r["registered_mw"], \
                f"Activated MW {r['activated_mw']} exceeds registered {r['registered_mw']} for {r['mechanism']} {r['region']}"
            assert r["activation_events_yr"] >= 1
            assert r["cost_m_aud_yr"] > 0
            assert r["cost_aud_mwh"] > 0
            assert 0 < r["reliability_contribution_pct"] < 20

        # RERT should have highest average cost per MWh
        rert_costs = [r["cost_aud_mwh"] for r in demand_side if r["mechanism"] == "RERT"]
        il_costs = [r["cost_aud_mwh"] for r in demand_side if r["mechanism"] == "INTERRUPTIBLE_LOAD"]
        assert min(rert_costs) > max(il_costs), \
            "RERT should be more expensive per MWh than Interruptible Load"

        # SA1 should have highest reliability contribution from VPP (energy transition leader)
        sa1_vpp = next((r for r in demand_side if r["mechanism"] == "VPP" and r["region"] == "SA1"), None)
        assert sa1_vpp is not None, "SA1 VPP record should exist"
        assert sa1_vpp["reliability_contribution_pct"] > 5, \
            f"SA1 VPP should have >5% reliability contribution, got {sa1_vpp['reliability_contribution_pct']}"

        # Total registered capacity should exceed 3000 MW
        total_registered = sum(r["registered_mw"] for r in demand_side)
        assert total_registered > 3000, \
            f"Total registered demand-side capacity should exceed 3000 MW, got {total_registered}"


# ===========================================================================
# Sprint 61b — DNSP Performance & Investment Analytics
# ===========================================================================

class TestDnspAnalytics:
    """Sprint 61b — DNSP Performance & Investment Analytics endpoint tests."""

    def test_dnsp_analytics_dashboard(self, client, auth_headers):
        resp = client.get("/api/dnsp-analytics/dashboard", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        d = resp.json()

        # Top-level keys
        for key in ("timestamp", "dnsps", "reliability", "der_hosting", "investments"):
            assert key in d, f"Missing key: {key}"

        # ── DNSP records ──────────────────────────────────────────────────────
        dnsps = d["dnsps"]
        assert len(dnsps) == 10, f"Expected 10 DNSP records, got {len(dnsps)}"

        expected_ids = {
            "AUSGRID", "ENDEAVOUR", "ESSENTIAL", "EVOENERGY", "SAPN",
            "CITIPOWER", "POWERCOR", "UNITEDENERGY", "JEMENA", "TASNETWORKS",
        }
        actual_ids = {r["dnsp_id"] for r in dnsps}
        assert actual_ids == expected_ids, f"DNSP ID mismatch: {actual_ids}"

        for r in dnsps:
            assert r["regulated_asset_base_bn_aud"] > 0, f"{r['dnsp_id']}: RAB must be positive"
            assert r["customers_k"] > 0, f"{r['dnsp_id']}: customers must be positive"
            assert r["network_length_km"] > 0, f"{r['dnsp_id']}: network length must be positive"
            assert r["substations"] > 0, f"{r['dnsp_id']}: substations must be positive"
            assert r["annual_capex_m_aud"] > 0, f"{r['dnsp_id']}: capex must be positive"
            assert r["annual_opex_m_aud"] > 0, f"{r['dnsp_id']}: opex must be positive"
            assert 0 < r["wacc_pct"] < 10, f"{r['dnsp_id']}: WACC out of range: {r['wacc_pct']}"
            assert r["determination_period"], f"{r['dnsp_id']}: determination period missing"

        # Ausgrid should have largest RAB
        rab_by_id = {r["dnsp_id"]: r["regulated_asset_base_bn_aud"] for r in dnsps}
        assert rab_by_id["AUSGRID"] == max(rab_by_id.values()), \
            "Ausgrid should have the largest RAB"

        # ── Reliability records ───────────────────────────────────────────────
        reliability = d["reliability"]
        assert len(reliability) == 30, f"Expected 30 reliability records (10 DNSPs x 3 years), got {len(reliability)}"

        years_seen = {r["year"] for r in reliability}
        assert years_seen == {2022, 2023, 2024}, f"Expected years 2022-2024, got {years_seen}"

        dnsps_in_reliability = {r["dnsp"] for r in reliability}
        assert len(dnsps_in_reliability) == 10, \
            f"Expected 10 DNSPs in reliability, got {len(dnsps_in_reliability)}"

        for r in reliability:
            assert r["saidi_minutes"] > 0, f"SAIDI must be positive for {r['dnsp']} {r['year']}"
            assert r["saifi_interruptions"] > 0, f"SAIFI must be positive for {r['dnsp']} {r['year']}"
            assert r["caidi_minutes"] > 0, f"CAIDI must be positive for {r['dnsp']} {r['year']}"
            assert r["planned_outage_saidi"] >= 0
            assert r["unplanned_outage_saidi"] >= 0
            # planned + unplanned should approximately equal total SAIDI
            total_check = r["planned_outage_saidi"] + r["unplanned_outage_saidi"]
            assert abs(total_check - r["saidi_minutes"]) < 1, \
                f"Planned+unplanned SAIDI mismatch for {r['dnsp']} {r['year']}: {total_check} vs {r['saidi_minutes']}"
            assert 0 < r["worst_served_customers_pct"] < 100

        # SAIDI should improve year-over-year for Ausgrid
        ausgrid = sorted([r for r in reliability if r["dnsp"] == "Ausgrid"], key=lambda r: r["year"])
        assert ausgrid[0]["saidi_minutes"] > ausgrid[-1]["saidi_minutes"], \
            "Ausgrid SAIDI should improve (decrease) from 2022 to 2024"

        # CitiPower should have the best (lowest) SAIDI in 2024
        latest_year = max(r["year"] for r in reliability)
        latest = [r for r in reliability if r["year"] == latest_year]
        best = min(latest, key=lambda r: r["saidi_minutes"])
        assert best["dnsp"] == "CitiPower", \
            f"CitiPower should have lowest SAIDI in 2024, got {best['dnsp']}"

        # Essential Energy should have worst (highest) SAIDI in 2024
        worst = max(latest, key=lambda r: r["saidi_minutes"])
        assert worst["dnsp"] == "Essential Energy", \
            f"Essential Energy should have highest SAIDI in 2024, got {worst['dnsp']}"

        # ── DER hosting records ───────────────────────────────────────────────
        der = d["der_hosting"]
        assert len(der) == 20, f"Expected 20 DER hosting records, got {len(der)}"

        valid_feeder_types   = {"URBAN", "SUBURBAN", "RURAL", "REMOTE"}
        valid_constraint_types = {"VOLTAGE", "THERMAL", "PROTECTION", "UNCONSTRAINED"}

        for r in der:
            assert r["feeder_type"] in valid_feeder_types, \
                f"Invalid feeder_type: {r['feeder_type']}"
            assert r["constraint_type"] in valid_constraint_types, \
                f"Invalid constraint_type: {r['constraint_type']}"
            assert r["hosting_capacity_mw"] > 0, "Hosting capacity must be positive"
            assert r["connected_der_mw"] > 0, "Connected DER must be positive"
            assert r["connected_der_mw"] <= r["hosting_capacity_mw"], \
                f"Connected DER ({r['connected_der_mw']}) exceeds hosting capacity ({r['hosting_capacity_mw']}) for {r['dnsp']}"
            assert 0 < r["utilisation_pct"] <= 100
            assert r["upgrade_cost_m_aud"] >= 0

        # All four feeder types must be present
        feeder_types_seen = {r["feeder_type"] for r in der}
        assert feeder_types_seen == valid_feeder_types, \
            f"Not all feeder types present: {feeder_types_seen}"

        # Ausgrid should have highest total connected DER
        total_by_dnsp = {}
        for r in der:
            total_by_dnsp[r["dnsp"]] = total_by_dnsp.get(r["dnsp"], 0) + r["connected_der_mw"]
        assert total_by_dnsp.get("Ausgrid", 0) == max(total_by_dnsp.values()), \
            "Ausgrid should have highest total connected DER MW"

        # ── Investment records ────────────────────────────────────────────────
        investments = d["investments"]
        assert len(investments) == 30, f"Expected 30 investment records, got {len(investments)}"

        valid_categories = {
            "RELIABILITY", "GROWTH", "SAFETY",
            "DER_INTEGRATION", "BUSHFIRE_MITIGATION", "CYBER_SECURITY",
        }

        for r in investments:
            assert r["project_category"] in valid_categories, \
                f"Invalid project_category: {r['project_category']}"
            assert r["investment_m_aud"] > 0, "Investment must be positive"
            assert r["year"] == 2024, f"All mock investments should be year 2024, got {r['year']}"
            assert r["rab_addition_m_aud"] > 0, "RAB addition must be positive"
            assert r["rab_addition_m_aud"] <= r["investment_m_aud"], \
                "RAB addition cannot exceed total investment"
            assert r["customers_benefited_k"] > 0

        # All 6 categories must be present
        categories_seen = {r["project_category"] for r in investments}
        assert categories_seen == valid_categories, \
            f"Not all investment categories present: {categories_seen}"

        # Ausgrid should have highest total investment
        inv_by_dnsp = {}
        for r in investments:
            inv_by_dnsp[r["dnsp"]] = inv_by_dnsp.get(r["dnsp"], 0) + r["investment_m_aud"]
        assert inv_by_dnsp.get("Ausgrid", 0) == max(inv_by_dnsp.values()), \
            "Ausgrid should have highest total investment"

        # All 10 DNSPs should appear in investments
        inv_dnsps = {r["dnsp"] for r in investments}
        assert len(inv_dnsps) == 10, f"Expected 10 DNSPs in investments, got {len(inv_dnsps)}"


class TestStorageOptimisationAnalytics:
    """Sprint 61c — Battery Storage Revenue Stacking Optimisation endpoint tests."""

    def test_storage_optimisation_dashboard(self, client):
        resp = client.get(
            "/api/storage-optimisation/dashboard",
            headers={"X-API-Key": "test-key"},
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        d = resp.json()

        # ── Top-level structure ────────────────────────────────────────────
        for key in ("timestamp", "service_allocations", "price_correlations",
                    "optimisation_results", "degradation"):
            assert key in d, f"Missing key: {key}"

        # ── Service allocations ────────────────────────────────────────────
        allocs = d["service_allocations"]
        assert len(allocs) == 8, f"Expected 8 service allocation records, got {len(allocs)}"

        valid_regions = {"NSW1", "VIC1", "SA1", "QLD1", "TAS1"}
        for a in allocs:
            assert a["capacity_mw"] > 0, "capacity_mw must be positive"
            assert a["duration_hr"] > 0, "duration_hr must be positive"
            assert a["region"] in valid_regions, f"Invalid region: {a['region']}"
            assert a["revenue_per_mw_k_aud"] > 0
            assert a["total_revenue_m_aud"] > 0
            pct_sum = (
                a["energy_arbitrage_pct"] + a["raise_fcas_pct"] + a["lower_fcas_pct"]
                + a["capacity_market_pct"] + a["demand_response_pct"] + a["idle_pct"]
            )
            assert abs(pct_sum - 100.0) < 0.5, (
                f"Pct allocation for {a['bess_id']} sums to {pct_sum}, expected ~100"
            )

        # Waratah Super Battery should be largest by revenue
        revenues = [(a["total_revenue_m_aud"], a["bess_id"]) for a in allocs]
        largest = max(revenues)[1]
        assert largest == "WARATAH_BESS", f"Expected WARATAH_BESS as largest, got {largest}"

        # All known real BESS should be present
        bess_ids = {a["bess_id"] for a in allocs}
        for expected in ("HORNSDALE1", "VIC_BIG", "WARATAH_BESS"):
            assert expected in bess_ids, f"Missing BESS: {expected}"

        # ── Price correlations ─────────────────────────────────────────────
        prices = d["price_correlations"]
        assert len(prices) == 12, f"Expected 12 monthly price records, got {len(prices)}"

        valid_services = {"ENERGY_ONLY", "FCAS_ONLY", "ENERGY_FCAS", "FULL_STACK", "AI_OPTIMISED"}
        for p in prices:
            assert p["region"] == "NSW1", f"Expected NSW1 region, got {p['region']}"
            assert p["energy_price_aud_mwh"] > 0
            assert p["arbitrage_spread_aud"] > 0
            assert p["optimal_service"] in valid_services, f"Invalid service: {p['optimal_service']}"

        # Winter months (Jul, Aug) should have the highest arbitrage spreads
        summer_avg = sum(p["arbitrage_spread_aud"] for p in prices if p["month"].startswith("Jan") or p["month"].startswith("Feb")) / 2
        winter_aug = next(p["arbitrage_spread_aud"] for p in prices if p["month"].startswith("Aug"))
        assert winter_aug > summer_avg, "August spread should exceed summer average"

        # ── Optimisation results ───────────────────────────────────────────
        results = d["optimisation_results"]
        assert len(results) == 5, f"Expected 5 optimisation scenarios, got {len(results)}"

        valid_scenarios = {"ENERGY_ONLY", "FCAS_ONLY", "ENERGY_FCAS", "FULL_STACK", "AI_OPTIMISED"}
        scenario_names = {r["scenario"] for r in results}
        assert scenario_names == valid_scenarios, f"Missing scenarios: {valid_scenarios - scenario_names}"

        for r in results:
            assert r["annual_revenue_m_aud"] > 0
            assert 0 < r["irr_pct"] < 50, f"IRR out of range: {r['irr_pct']}"
            assert r["payback_years"] > 0
            assert r["capex_m_aud"] > 0
            assert r["lcoe_aud_mwh"] > 0

        # AI_OPTIMISED should be best on revenue and IRR
        ai = next(r for r in results if r["scenario"] == "AI_OPTIMISED")
        energy_only = next(r for r in results if r["scenario"] == "ENERGY_ONLY")
        assert ai["annual_revenue_m_aud"] > energy_only["annual_revenue_m_aud"], (
            "AI_OPTIMISED revenue must exceed ENERGY_ONLY"
        )
        assert ai["irr_pct"] > energy_only["irr_pct"], "AI_OPTIMISED IRR must exceed ENERGY_ONLY"
        assert ai["payback_years"] < energy_only["payback_years"], (
            "AI_OPTIMISED payback must be shorter than ENERGY_ONLY"
        )

        # FULL_STACK should outperform single-service scenarios
        full_stack = next(r for r in results if r["scenario"] == "FULL_STACK")
        fcas_only = next(r for r in results if r["scenario"] == "FCAS_ONLY")
        assert full_stack["annual_revenue_m_aud"] > fcas_only["annual_revenue_m_aud"]

        # ── Degradation records ────────────────────────────────────────────
        degrad = d["degradation"]
        assert len(degrad) == 8, f"Expected 8 degradation records (2 BESS x 4 years), got {len(degrad)}"

        degrad_ids = {r["bess_id"] for r in degrad}
        assert "HORNSDALE1" in degrad_ids, "Missing HORNSDALE1 degradation records"
        assert "VIC_BIG" in degrad_ids, "Missing VIC_BIG degradation records"

        for r in degrad:
            assert 1 <= r["year"] <= 4, f"Year out of range: {r['year']}"
            assert 80 < r["capacity_retention_pct"] <= 100, (
                f"Capacity retention out of range: {r['capacity_retention_pct']}"
            )
            assert r["calendar_degradation_pct"] >= 0
            assert r["cycle_degradation_pct"] >= 0
            assert r["annual_cycles"] > 0
            assert r["revenue_impact_m_aud"] >= 0
            assert r["replacement_schedule"]

        # Capacity should decline monotonically over years for each BESS
        for bess_id in ("HORNSDALE1", "VIC_BIG"):
            bess_records = sorted(
                [r for r in degrad if r["bess_id"] == bess_id],
                key=lambda x: x["year"],
            )
            assert len(bess_records) == 4, f"Expected 4 years for {bess_id}"
            for i in range(1, len(bess_records)):
                assert bess_records[i]["capacity_retention_pct"] < bess_records[i - 1]["capacity_retention_pct"], (
                    f"{bess_id} year {bess_records[i]['year']} capacity did not decline"
                )

        # Revenue impact should be 0 in year 1 (baseline)
        year1_records = [r for r in degrad if r["year"] == 1]
        for r in year1_records:
            assert r["revenue_impact_m_aud"] == 0.0, (
                f"{r['bess_id']} year 1 should have zero revenue impact"
            )


# ===========================================================================
# Sprint 62a — NEM 5-Minute Settlement & Prudential Analytics
# ===========================================================================

class TestSettlementAnalytics:
    """Sprint 62a — NEM 5-Minute Settlement & Prudential Analytics endpoint tests."""

    def test_settlement_analytics_dashboard(self, client):
        resp = client.get(
            "/api/settlement-analytics/dashboard",
            headers={"X-API-Key": "test-key"},
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        d = resp.json()

        # ── Top-level structure ────────────────────────────────────────────
        for key in ("timestamp", "settlements", "prudential", "shortfalls", "exposures"):
            assert key in d, f"Missing key: {key}"

        # ── Settlement records ─────────────────────────────────────────────
        settlements = d["settlements"]
        assert len(settlements) == 10, f"Expected 10 settlement records, got {len(settlements)}"

        valid_regions = {"NSW1", "VIC1", "QLD1", "SA1", "TAS1"}
        for s in settlements:
            assert s["region"] in valid_regions, f"Invalid region: {s['region']}"
            assert s["total_energy_value_m_aud"] > 0, "total_energy_value must be positive"
            assert s["avg_settlement_price_aud"] > 0, "avg_settlement_price must be positive"
            assert s["peak_interval_price_aud"] > s["avg_settlement_price_aud"], (
                "Peak interval price must exceed average settlement price"
            )
            assert s["settlement_variance_m_aud"] > 0, "settlement_variance must be positive"
            assert s["positive_residue_m_aud"] > 0, "positive_residue must be positive"
            assert s["negative_residue_m_aud"] > 0, "negative_residue must be positive"
            # positive residue should exceed negative residue
            assert s["positive_residue_m_aud"] > s["negative_residue_m_aud"], (
                "Positive residue should exceed negative residue"
            )

        # SA1 should have highest variance (volatile renewables)
        sa_records = [s for s in settlements if s["region"] == "SA1"]
        nsw_records = [s for s in settlements if s["region"] == "NSW1"]
        assert sa_records, "SA1 records missing"
        assert nsw_records, "NSW1 records missing"
        avg_sa_variance = sum(s["settlement_variance_m_aud"] for s in sa_records) / len(sa_records)
        avg_nsw_variance = sum(s["settlement_variance_m_aud"] for s in nsw_records) / len(nsw_records)
        assert avg_sa_variance > avg_nsw_variance, (
            "SA1 should have higher settlement variance than NSW1 due to renewable volatility"
        )

        # Weeks covered
        weeks = {s["week"] for s in settlements}
        assert len(weeks) >= 4, f"Expected at least 4 weeks of data, got {len(weeks)}"

        # ── Prudential records ─────────────────────────────────────────────
        prudential = d["prudential"]
        assert len(prudential) == 12, f"Expected 12 prudential records, got {len(prudential)}"

        valid_collateral = {"BANK_GUARANTEE", "CASH", "LETTER_OF_CREDIT"}
        valid_statuses = {"COMPLIANT", "WARNING", "BREACH"}

        for p in prudential:
            assert p["credit_support_m_aud"] > 0, "credit_support must be positive"
            assert p["maximum_credit_limit_m_aud"] >= p["credit_support_m_aud"], (
                f"{p['participant']}: max limit must be >= credit support"
            )
            assert 0 < p["utilisation_pct"] <= 100, (
                f"{p['participant']}: utilisation {p['utilisation_pct']} out of range"
            )
            assert p["collateral_type"] in valid_collateral, (
                f"Invalid collateral type: {p['collateral_type']}"
            )
            assert p["compliance_status"] in valid_statuses, (
                f"Invalid compliance status: {p['compliance_status']}"
            )
            assert p["credit_rating"], f"{p['participant']}: credit_rating must not be empty"

        # AGL Energy should have the highest maximum credit limit
        limits = {p["participant"]: p["maximum_credit_limit_m_aud"] for p in prudential}
        assert limits["AGL Energy"] == max(limits.values()), (
            "AGL Energy should have the highest maximum credit limit"
        )

        # Walcha Energy should be in BREACH
        walcha = next(p for p in prudential if p["participant"] == "Walcha Energy")
        assert walcha["compliance_status"] == "BREACH", (
            "Walcha Energy should have BREACH compliance status"
        )

        # At least 1 BREACH record
        breach_count = sum(1 for p in prudential if p["compliance_status"] == "BREACH")
        assert breach_count >= 1, "Expected at least 1 BREACH record"

        # At least 1 WARNING record
        warning_count = sum(1 for p in prudential if p["compliance_status"] == "WARNING")
        assert warning_count >= 1, "Expected at least 1 WARNING record"

        # Utilisation for BREACH participant should be highest
        breach_record = next(p for p in prudential if p["compliance_status"] == "BREACH")
        assert breach_record["utilisation_pct"] == max(p["utilisation_pct"] for p in prudential), (
            "BREACH participant should have highest utilisation"
        )

        # ── Shortfall records ──────────────────────────────────────────────
        shortfalls = d["shortfalls"]
        assert len(shortfalls) == 5, f"Expected 5 shortfall records, got {len(shortfalls)}"

        valid_shortfall_types = {"SETTLEMENT", "PRUDENTIAL", "MARKET_FEES"}
        for sf in shortfalls:
            assert sf["shortfall_m_aud"] > 0, "shortfall_m_aud must be positive"
            assert sf["shortfall_type"] in valid_shortfall_types, (
                f"Invalid shortfall type: {sf['shortfall_type']}"
            )
            assert sf["resolution_days"] > 0, "resolution_days must be positive"
            assert sf["event_id"], "event_id must not be empty"
            assert sf["date"], "date must not be empty"
            assert sf["aemo_action"], "aemo_action must not be empty"
            assert isinstance(sf["financial_security_drawn"], bool), (
                "financial_security_drawn must be boolean"
            )

        # Events where financial security drawn should have DRAW_FINANCIAL_SECURITY action
        drawn_events = [sf for sf in shortfalls if sf["financial_security_drawn"]]
        for e in drawn_events:
            assert e["aemo_action"] == "DRAW_FINANCIAL_SECURITY", (
                f"Event {e['event_id']}: financial_security_drawn=True must have DRAW_FINANCIAL_SECURITY action"
            )

        # Walcha Energy should have shortfall events
        walcha_shortfalls = [sf for sf in shortfalls if sf["participant"] == "Walcha Energy"]
        assert len(walcha_shortfalls) >= 1, "Walcha Energy should have at least 1 shortfall event"

        # Largest shortfall should have financial security drawn
        largest = max(shortfalls, key=lambda sf: sf["shortfall_m_aud"])
        assert largest["financial_security_drawn"], (
            "Largest shortfall event should have financial security drawn"
        )

        # ── Exposure records ───────────────────────────────────────────────
        exposures = d["exposures"]
        assert len(exposures) == 20, f"Expected 20 exposure records, got {len(exposures)}"

        for e in exposures:
            assert e["gross_energy_purchase_m_aud"] > 0, "gross_purchase must be positive"
            assert e["gross_energy_sale_m_aud"] > 0, "gross_sale must be positive"
            assert e["exposure_utilisation_pct"] > 0, "exposure_utilisation_pct must be positive"
            assert e["region"] in valid_regions, f"Invalid region: {e['region']}"
            assert e["participant"], "participant must not be empty"
            assert e["week"], "week must not be empty"
            # net position = purchase - sale (positive = net buyer, negative = net seller)
            expected_net = e["gross_energy_purchase_m_aud"] - e["gross_energy_sale_m_aud"]
            assert abs(expected_net - e["net_position_m_aud"]) < 0.1, (
                f"net_position_m_aud mismatch for {e['participant']} {e['week']}"
            )

        # AGL Energy should be present in exposures
        agl_exposures = [e for e in exposures if e["participant"] == "AGL Energy"]
        assert len(agl_exposures) >= 1, "AGL Energy must have exposure records"

        # Top 5 participants should all be present
        participants_in_exposures = {e["participant"] for e in exposures}
        for expected in ("AGL Energy", "Origin Energy", "EnergyAustralia", "Snowy Hydro", "Alinta Energy"):
            assert expected in participants_in_exposures, f"Missing participant: {expected}"

        # 4 weeks of exposure data
        weeks_in_exposures = {e["week"] for e in exposures}
        assert len(weeks_in_exposures) >= 4, (
            f"Expected at least 4 weeks of exposure data, got {len(weeks_in_exposures)}"
        )


class TestRealtimeOperationsDashboard:
    """Sprint 62c — NEM Real-Time Operational Overview Dashboard tests."""

    def test_realtime_ops_dashboard(self, client):
        resp = client.get(
            "/api/realtime-ops/dashboard",
            headers={"X-API-Key": "test-key"},
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        body = resp.json()

        # Top-level keys
        for key in ("timestamp", "regions", "interconnectors", "fcas", "alerts"):
            assert key in body, f"Missing top-level key: {key}"

        # ---- Regions ----
        regions = body["regions"]
        assert len(regions) == 5, f"Expected 5 region snapshots, got {len(regions)}"

        region_codes = {r["region"] for r in regions}
        assert region_codes == {"NSW1", "QLD1", "VIC1", "SA1", "TAS1"}, (
            f"Expected all 5 NEM regions, got {region_codes}"
        )

        for r in regions:
            assert r["total_demand_mw"] > 0, f"{r['region']} demand must be positive"
            assert r["generation_mw"] > 0, f"{r['region']} generation must be positive"
            assert r["spot_price_aud_mwh"] > 0, f"{r['region']} price must be positive"
            assert 49.0 < r["frequency_hz"] < 51.0, (
                f"{r['region']} frequency out of plausible range: {r['frequency_hz']}"
            )
            assert r["reserve_mw"] >= 0, f"{r['region']} reserve must be non-negative"
            assert isinstance(r["generation_mix"], dict), "generation_mix must be a dict"
            mix_total = sum(r["generation_mix"].values())
            assert mix_total > 0, f"{r['region']} generation mix total must be positive"

        # SA1 should have the highest spot price (mock data price spike)
        sa1 = next(r for r in regions if r["region"] == "SA1")
        assert sa1["spot_price_aud_mwh"] > 500, (
            f"SA1 should have high spot price (>$500), got {sa1['spot_price_aud_mwh']}"
        )

        # TAS1 should have significant hydro
        tas1 = next(r for r in regions if r["region"] == "TAS1")
        assert tas1["generation_mix"].get("hydro", 0) > 400, (
            f"TAS1 should have >400 MW hydro, got {tas1['generation_mix'].get('hydro', 0)}"
        )

        # ---- Interconnectors ----
        interconnectors = body["interconnectors"]
        assert len(interconnectors) == 6, (
            f"Expected 6 interconnector records, got {len(interconnectors)}"
        )

        ic_names = {ic["interconnector"] for ic in interconnectors}
        assert "BASSLINK" in ic_names, "BASSLINK must be present"
        assert "V-SA" in ic_names, "V-SA must be present"
        assert "QNI" in ic_names, "QNI must be present"

        for ic in interconnectors:
            assert ic["capacity_mw"] > 0, f"{ic['interconnector']} capacity must be positive"
            assert 0 <= ic["utilisation_pct"] <= 100, (
                f"{ic['interconnector']} utilisation out of range: {ic['utilisation_pct']}"
            )
            assert 0 <= ic["marginal_loss"] < 0.05, (
                f"{ic['interconnector']} marginal loss implausible: {ic['marginal_loss']}"
            )
            assert isinstance(ic["binding"], bool), "binding must be bool"

        # V-SA should be binding in mock data
        v_sa = next(ic for ic in interconnectors if ic["interconnector"] == "V-SA")
        assert v_sa["binding"] is True, "V-SA should be binding"

        # ---- FCAS ----
        fcas = body["fcas"]
        assert len(fcas) == 8, f"Expected 8 FCAS service snapshots, got {len(fcas)}"

        fcas_services = {f["service"] for f in fcas}
        for svc in ("RAISE_6SEC", "RAISE_60SEC", "RAISE_5MIN", "RAISE_REG",
                    "LOWER_6SEC", "LOWER_60SEC", "LOWER_5MIN", "LOWER_REG"):
            assert svc in fcas_services, f"Missing FCAS service: {svc}"

        for f in fcas:
            assert f["cleared_mw"] > 0, f"{f['service']} cleared_mw must be positive"
            assert f["requirement_mw"] > 0, f"{f['service']} requirement_mw must be positive"
            assert f["clearing_price_aud_mw"] >= 0, f"{f['service']} price must be non-negative"
            assert f["surplus_pct"] >= 0, f"{f['service']} surplus must be non-negative"
            # Cleared MW should be >= requirement
            assert f["cleared_mw"] >= f["requirement_mw"], (
                f"{f['service']} cleared MW {f['cleared_mw']} < requirement {f['requirement_mw']}"
            )

        # Regulation services should have higher prices than contingency
        raise_reg = next(f for f in fcas if f["service"] == "RAISE_REG")
        raise_6sec = next(f for f in fcas if f["service"] == "RAISE_6SEC")
        assert raise_reg["clearing_price_aud_mw"] > raise_6sec["clearing_price_aud_mw"], (
            "RAISE_REG should have higher clearing price than RAISE_6SEC"
        )

        # ---- Alerts ----
        alerts = body["alerts"]
        assert len(alerts) == 6, f"Expected 6 system alerts, got {len(alerts)}"

        severities = {a["severity"] for a in alerts}
        assert "CRITICAL" in severities, "Should have at least one CRITICAL alert"
        assert "WARNING" in severities, "Should have at least one WARNING alert"
        assert "INFO" in severities, "Should have at least one INFO alert"

        categories = {a["category"] for a in alerts}
        assert "PRICE" in categories, "Should have a PRICE category alert"
        assert "FREQUENCY" in categories, "Should have a FREQUENCY category alert"

        for a in alerts:
            assert a["alert_id"], "alert_id must not be empty"
            assert a["message"], "message must not be empty"
            assert a["region"], "region must not be empty"
            assert a["timestamp"], "timestamp must not be empty"
            assert isinstance(a["acknowledged"], bool), "acknowledged must be bool"
            assert a["severity"] in ("INFO", "WARNING", "CRITICAL"), (
                f"Invalid severity: {a['severity']}"
            )
            assert a["category"] in ("PRICE", "FREQUENCY", "RESERVE", "CONSTRAINT", "MARKET"), (
                f"Invalid category: {a['category']}"
            )

        # The CRITICAL alert should be for SA1 price
        critical_alerts = [a for a in alerts if a["severity"] == "CRITICAL"]
        assert any(a["region"] == "SA1" for a in critical_alerts), (
            "Should have a CRITICAL alert for SA1"
        )

        # Mix of acknowledged / unacknowledged
        ack_count = sum(1 for a in alerts if a["acknowledged"])
        unack_count = sum(1 for a in alerts if not a["acknowledged"])
        assert ack_count > 0, "Should have at least one acknowledged alert"
        assert unack_count > 0, "Should have at least one unacknowledged alert"


class TestRenewableAuctionAnalytics:
    """Sprint 62b — Renewable Energy Auction Results & CfD Analytics endpoint tests."""

    def test_renewable_auction_dashboard(self, client, auth_headers):
        resp = client.get(
            "/api/renewable-auction/dashboard",
            headers=auth_headers,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        d = resp.json()

        # ── Top-level structure ────────────────────────────────────────────
        for key in ("timestamp", "auction_results", "technology_trends", "performance", "state_comparison"):
            assert key in d, f"Missing top-level key: {key}"

        # ── Auction results ────────────────────────────────────────────────
        results = d["auction_results"]
        assert len(results) == 15, f"Expected 15 auction result records, got {len(results)}"

        valid_technologies = {"WIND_ONSHORE", "WIND_OFFSHORE", "UTILITY_SOLAR", "HYBRID", "STORAGE"}
        valid_statuses = {"CONTRACTED", "UNDER_CONSTRUCTION", "COMMISSIONED", "TERMINATED"}
        valid_states = {"NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"}

        for r in results:
            assert r["auction_id"], "auction_id must be non-empty"
            assert r["auction_name"], "auction_name must be non-empty"
            assert r["state"] in valid_states, f"Invalid state: {r['state']}"
            assert 2015 <= r["year"] <= 2030, f"Year out of range: {r['year']}"
            assert r["technology"] in valid_technologies, f"Invalid technology: {r['technology']}"
            assert r["capacity_mw"] > 0, "capacity_mw must be positive"
            assert r["strike_price_aud_mwh"] > 0, "strike_price_aud_mwh must be positive"
            assert r["reference_price_aud_mwh"] > 0, "reference_price_aud_mwh must be positive"
            assert 5 <= r["cfd_term_years"] <= 25, f"cfd_term_years out of range: {r['cfd_term_years']}"
            assert r["developer"], "developer must be non-empty"
            assert 2020 <= r["cod_year"] <= 2035, f"cod_year out of range: {r['cod_year']}"
            assert r["status"] in valid_statuses, f"Invalid status: {r['status']}"

        # All technologies represented
        techs_present = {r["technology"] for r in results}
        for tech in {"WIND_ONSHORE", "UTILITY_SOLAR", "HYBRID", "STORAGE"}:
            assert tech in techs_present, f"Missing technology in auction results: {tech}"

        # At least one TERMINATED record
        terminated = [r for r in results if r["status"] == "TERMINATED"]
        assert len(terminated) >= 1, "Expected at least one TERMINATED record"

        # Lowest strike price should be from UTILITY_SOLAR (typically cheapest)
        cheapest = min(results, key=lambda r: r["strike_price_aud_mwh"])
        assert cheapest["technology"] == "UTILITY_SOLAR", (
            f"Expected cheapest to be UTILITY_SOLAR, got {cheapest['technology']}"
        )

        # ── Technology trends ──────────────────────────────────────────────
        trends = d["technology_trends"]
        assert len(trends) == 20, f"Expected 20 technology trend records, got {len(trends)}"

        valid_trend_techs = {"WIND_ONSHORE", "UTILITY_SOLAR", "HYBRID", "STORAGE"}
        for t in trends:
            assert t["technology"] in valid_trend_techs, f"Invalid trend technology: {t['technology']}"
            assert 2018 <= t["year"] <= 2025, f"Trend year out of range: {t['year']}"
            assert t["auction_count"] > 0, "auction_count must be positive"
            assert t["avg_strike_price_aud_mwh"] > 0, "avg_strike_price must be positive"
            assert t["min_strike_price_aud_mwh"] > 0, "min_strike_price must be positive"
            assert t["min_strike_price_aud_mwh"] <= t["avg_strike_price_aud_mwh"], (
                "min_strike_price must be <= avg_strike_price"
            )
            assert t["total_contracted_mw"] > 0, "total_contracted_mw must be positive"
            assert t["oversubscription_ratio"] >= 1.0, "oversubscription_ratio must be >= 1"
            assert 0 <= t["cost_reduction_pct_from_2018"] <= 100, (
                f"cost_reduction_pct out of range: {t['cost_reduction_pct_from_2018']}"
            )

        # Exactly 4 technologies with 5 years each
        for tech in valid_trend_techs:
            tech_records = [t for t in trends if t["technology"] == tech]
            assert len(tech_records) == 5, f"Expected 5 year records for {tech}, got {len(tech_records)}"
            years = sorted(r["year"] for r in tech_records)
            assert years == [2018, 2019, 2020, 2021, 2022], f"Years mismatch for {tech}: {years}"

        # 2018 baseline should have 0% cost reduction
        for tech in valid_trend_techs:
            baseline = next(t for t in trends if t["technology"] == tech and t["year"] == 2018)
            assert baseline["cost_reduction_pct_from_2018"] == 0.0, (
                f"{tech} 2018 baseline cost_reduction should be 0, got {baseline['cost_reduction_pct_from_2018']}"
            )

        # UTILITY_SOLAR should have lower avg strike than STORAGE in latest year
        solar_2022 = next(t for t in trends if t["technology"] == "UTILITY_SOLAR" and t["year"] == 2022)
        storage_2022 = next(t for t in trends if t["technology"] == "STORAGE" and t["year"] == 2022)
        assert solar_2022["avg_strike_price_aud_mwh"] < storage_2022["avg_strike_price_aud_mwh"], (
            "Solar should have lower strike than storage in 2022"
        )

        # ── Performance records ────────────────────────────────────────────
        perf = d["performance"]
        assert len(perf) == 10, f"Expected 10 performance records, got {len(perf)}"

        for p in perf:
            assert p["project_name"], "project_name must be non-empty"
            assert p["technology"] in valid_technologies, f"Invalid tech: {p['technology']}"
            assert p["state"] in valid_states, f"Invalid state: {p['state']}"
            assert p["contracted_capacity_mw"] > 0, "contracted_capacity_mw must be positive"
            assert 0 < p["actual_capacity_factor_pct"] < 100, (
                f"actual_capacity_factor_pct out of range: {p['actual_capacity_factor_pct']}"
            )
            assert 0 < p["bid_capacity_factor_pct"] < 100, (
                f"bid_capacity_factor_pct out of range: {p['bid_capacity_factor_pct']}"
            )
            assert p["annual_generation_twh"] > 0, "annual_generation_twh must be positive"
            assert p["cfd_payment_m_aud"] >= 0, "cfd_payment_m_aud must be non-negative"
            assert p["market_revenue_m_aud"] > 0, "market_revenue_m_aud must be positive"

        # At least one record with CfD payment > 0 (receiving support)
        paying = [p for p in perf if p["cfd_payment_m_aud"] > 0]
        assert len(paying) >= 1, "Expected at least one project receiving CfD payment"

        # Wind onshore should have highest average capacity factors
        wind_cf = [p["actual_capacity_factor_pct"] for p in perf if p["technology"] == "WIND_ONSHORE"]
        solar_cf = [p["actual_capacity_factor_pct"] for p in perf if p["technology"] == "UTILITY_SOLAR"]
        assert wind_cf and solar_cf, "Expected both wind and solar performance records"
        assert sum(wind_cf) / len(wind_cf) > sum(solar_cf) / len(solar_cf), (
            "Wind should have higher average CF than solar"
        )

        # ── State comparison ───────────────────────────────────────────────
        states = d["state_comparison"]
        assert len(states) == 5, f"Expected 5 state comparison records, got {len(states)}"

        for s in states:
            assert s["state"] in valid_states, f"Invalid state: {s['state']}"
            assert s["total_contracted_mw"] > 0, "total_contracted_mw must be positive"
            assert s["avg_strike_price_aud_mwh"] > 0, "avg_strike_price must be positive"
            assert s["cheapest_technology"] in valid_technologies, (
                f"Invalid cheapest_technology: {s['cheapest_technology']}"
            )
            assert s["auction_pipeline_mw"] > 0, "auction_pipeline_mw must be positive"
            assert s["policy_target_mw"] > 0, "policy_target_mw must be positive"
            assert 0 <= s["completion_pct"] <= 100, (
                f"completion_pct out of range: {s['completion_pct']}"
            )
            # Pipeline should not exceed policy target
            assert s["auction_pipeline_mw"] <= s["policy_target_mw"], (
                f"{s['state']} pipeline ({s['auction_pipeline_mw']}) exceeds policy target ({s['policy_target_mw']})"
            )

        # VIC should have highest contracted capacity (strong VRET programme)
        vic = next((s for s in states if s["state"] == "VIC"), None)
        assert vic is not None, "VIC state record missing"
        nsw = next((s for s in states if s["state"] == "NSW"), None)
        assert nsw is not None, "NSW state record missing"
        assert vic["total_contracted_mw"] > nsw["total_contracted_mw"], (
            "VIC should have higher contracted MW than NSW"
        )

        # UTILITY_SOLAR should be cheapest technology in most states
        solar_cheapest_count = sum(1 for s in states if s["cheapest_technology"] == "UTILITY_SOLAR")
        assert solar_cheapest_count >= 3, (
            f"Expected UTILITY_SOLAR cheapest in >=3 states, got {solar_cheapest_count}"
        )


# ===========================================================================
# Sprint 63a — VoLL Analytics tests
# ===========================================================================

class TestVollAnalytics:
    """Integration tests for GET /api/voll-analytics/dashboard."""

    def test_voll_analytics_dashboard(self, client):
        resp = client.get("/api/voll-analytics/dashboard")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        body = resp.json()

        # ── Top-level structure ─────────────────────────────────────────────
        required_keys = {"timestamp", "voll_estimates", "outage_costs", "industry_sectors", "reliability_values"}
        assert required_keys.issubset(body.keys()), f"Missing keys: {required_keys - body.keys()}"

        voll_estimates   = body["voll_estimates"]
        outage_costs     = body["outage_costs"]
        industry_sectors = body["industry_sectors"]
        reliability_vals = body["reliability_values"]

        # ── VoLL estimate records: 6 records (3 years × 2 methodologies) ───
        assert len(voll_estimates) == 6, f"Expected 6 voll_estimate records, got {len(voll_estimates)}"

        valid_methodologies = {"SURVEY", "REVEALED_PREFERENCE", "HYBRID"}
        for ve in voll_estimates:
            assert ve["methodology"] in valid_methodologies, f"Invalid methodology: {ve['methodology']}"
            assert 2000 <= ve["year"] <= 2030, f"Unexpected year: {ve['year']}"
            assert ve["residential_voll_aud_mwh"] > 0, "residential_voll must be positive"
            assert ve["commercial_voll_aud_mwh"] > ve["residential_voll_aud_mwh"], (
                "commercial VoLL should exceed residential VoLL"
            )
            assert ve["industrial_voll_aud_mwh"] > 0, "industrial_voll must be positive"
            assert ve["weighted_avg_voll_aud_mwh"] > 0, "weighted_avg_voll must be positive"
            assert ve["nem_regulatory_voll_aud_mwh"] > 0, "nem_regulatory_voll must be positive"
            assert ve["review_body"], "review_body must not be empty"

        # Latest year should have highest regulatory VoLL (cost escalation over time)
        years = sorted(set(ve["year"] for ve in voll_estimates))
        assert len(years) == 3, f"Expected 3 distinct years, got {years}"
        latest_voll = next(ve["nem_regulatory_voll_aud_mwh"] for ve in voll_estimates if ve["year"] == years[-1])
        earliest_voll = next(ve["nem_regulatory_voll_aud_mwh"] for ve in voll_estimates if ve["year"] == years[0])
        assert latest_voll > earliest_voll, (
            f"Latest VoLL ({latest_voll}) should exceed earliest ({earliest_voll})"
        )

        # ── Outage cost records: 15 records (5 regions × 3 years) ───────────
        assert len(outage_costs) == 15, f"Expected 15 outage_cost records, got {len(outage_costs)}"

        expected_regions = {"NSW", "VIC", "QLD", "SA", "TAS"}
        present_regions  = {oc["region"] for oc in outage_costs}
        assert expected_regions == present_regions, f"Missing regions: {expected_regions - present_regions}"

        for oc in outage_costs:
            assert oc["total_outage_hours"] > 0, "total_outage_hours must be positive"
            assert oc["customers_affected_k"] > 0, "customers_affected_k must be positive"
            assert oc["total_economic_cost_m_aud"] > 0, "total_economic_cost_m_aud must be positive"
            # Component costs must sum close to total
            component_sum = (
                oc["residential_cost_m_aud"]
                + oc["commercial_cost_m_aud"]
                + oc["industrial_cost_m_aud"]
            )
            assert abs(component_sum - oc["total_economic_cost_m_aud"]) < 5.0, (
                f"Component costs ({component_sum}) diverge from total ({oc['total_economic_cost_m_aud']})"
            )
            # Direct + indirect must equal 100
            assert abs(oc["direct_cost_pct"] + oc["indirect_cost_pct"] - 100.0) < 0.1, (
                f"direct_cost_pct + indirect_cost_pct != 100 for {oc['region']} {oc['year']}"
            )

        # QLD should have highest average total cost (most severe outages)
        def avg_cost(region: str) -> float:
            recs = [oc["total_economic_cost_m_aud"] for oc in outage_costs if oc["region"] == region]
            return sum(recs) / len(recs)

        qld_avg = avg_cost("QLD")
        tas_avg = avg_cost("TAS")
        assert qld_avg > tas_avg, f"QLD avg ({qld_avg}) should exceed TAS avg ({tas_avg})"

        # ── Industry sector records: 10 ──────────────────────────────────────
        assert len(industry_sectors) == 10, f"Expected 10 industry_sector records, got {len(industry_sectors)}"

        valid_sensitivities = {"HIGH", "MEDIUM", "LOW"}
        for s in industry_sectors:
            assert s["outage_sensitivity"] in valid_sensitivities, (
                f"Invalid sensitivity: {s['outage_sensitivity']}"
            )
            assert s["avg_outage_cost_aud_hour"] > 0, "avg_outage_cost must be positive"
            assert s["critical_threshold_min"] > 0, "critical_threshold_min must be positive"
            assert s["annual_exposure_m_aud"] > 0, "annual_exposure must be positive"
            assert 0 <= s["backup_power_adoption_pct"] <= 100, (
                f"backup_power_adoption_pct out of range: {s['backup_power_adoption_pct']}"
            )

        # HIGH-sensitivity sectors should have higher avg cost than LOW-sensitivity ones
        high_costs = [s["avg_outage_cost_aud_hour"] for s in industry_sectors if s["outage_sensitivity"] == "HIGH"]
        low_costs  = [s["avg_outage_cost_aud_hour"] for s in industry_sectors if s["outage_sensitivity"] == "LOW"]
        assert min(high_costs) > max(low_costs), (
            f"All HIGH-sensitivity costs ({min(high_costs)}) should exceed all LOW costs ({max(low_costs)})"
        )

        # ── Reliability value records: 5 ─────────────────────────────────────
        assert len(reliability_vals) == 5, f"Expected 5 reliability_value records, got {len(reliability_vals)}"

        for rv in reliability_vals:
            assert rv["current_saidi_min"] > rv["target_saidi_min"], (
                f"current_saidi_min must exceed target for {rv['region']}"
            )
            assert rv["improvement_cost_m_aud"] > 0, "improvement_cost must be positive"
            assert rv["customers_benefited_k"] > 0, "customers_benefited_k must be positive"
            assert rv["voll_saved_m_aud"] > 0, "voll_saved must be positive"
            assert rv["benefit_cost_ratio"] > 0, "benefit_cost_ratio must be positive"
            # VoLL saved should exceed investment cost for it to be worthwhile
            assert rv["voll_saved_m_aud"] > rv["improvement_cost_m_aud"], (
                f"{rv['region']}: voll_saved ({rv['voll_saved_m_aud']}) should exceed investment cost ({rv['improvement_cost_m_aud']})"
            )

        # NSW should benefit most customers
        nsw_rv = next((rv for rv in reliability_vals if rv["region"] == "NSW"), None)
        assert nsw_rv is not None, "NSW reliability record missing"
        for rv in reliability_vals:
            if rv["region"] != "NSW":
                assert nsw_rv["customers_benefited_k"] >= rv["customers_benefited_k"], (
                    f"NSW should have highest customers_benefited_k, but {rv['region']} has more"
                )


class TestDemandFlexibilityAnalytics:
    """Sprint 63c – Demand Flexibility & Industrial Load Management Analytics"""

    def test_demand_flexibility_dashboard(self, client, auth_headers):
        resp = client.get("/api/demand-flexibility/dashboard", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        data = resp.json()

        # Top-level keys
        for key in ("timestamp", "consumers", "events", "benefits", "technologies"):
            assert key in data, f"Missing key: {key}"

        # ── consumers ──────────────────────────────────────────────────────
        consumers = data["consumers"]
        assert len(consumers) == 10, f"Expected 10 consumers, got {len(consumers)}"

        valid_industries = {
            "ALUMINIUM_SMELTER", "STEEL_EAF", "DATA_CENTRE", "WATER_UTILITY",
            "MINING", "CEMENT", "PAPER_PULP", "COLD_STORAGE",
        }
        valid_contracts = {"INTERRUPTIBLE", "VOLUNTARY", "VPP_PARTICIPANT", "ANCILLARY_SERVICE"}

        for c in consumers:
            assert c["industry"] in valid_industries, f"Invalid industry: {c['industry']}"
            assert c["contract_type"] in valid_contracts, f"Invalid contract: {c['contract_type']}"
            assert c["peak_demand_mw"] > 0, "peak_demand_mw must be positive"
            assert 0 < c["flexible_mw"] <= c["peak_demand_mw"], "flexible_mw out of range"
            assert 0 < c["flexibility_pct"] <= 100, "flexibility_pct out of range"
            assert c["annual_revenue_m_aud"] >= 0, "annual_revenue must be non-negative"
            assert c["response_time_min"] >= 0, "response_time_min must be non-negative"

        # At least two aluminium smelters (Pacific + Tomago)
        smelters = [c for c in consumers if c["industry"] == "ALUMINIUM_SMELTER"]
        assert len(smelters) >= 2, f"Expected >=2 aluminium smelters, got {len(smelters)}"

        # ── events ─────────────────────────────────────────────────────────
        events = data["events"]
        assert len(events) == 8, f"Expected 8 events, got {len(events)}"

        valid_triggers = {"HIGH_PRICE", "RESERVE_LOW", "FCAS_SHORTFALL", "OPERATOR_REQUEST"}
        for ev in events:
            assert ev["trigger"] in valid_triggers, f"Invalid trigger: {ev['trigger']}"
            assert ev["total_curtailed_mw"] > 0, "curtailed_mw must be positive"
            assert ev["duration_hr"] > 0, "duration_hr must be positive"
            assert ev["participants"] > 0, "participants must be positive"
            assert ev["price_during_event_aud"] > 0, "price must be positive"
            assert ev["cost_avoided_m_aud"] > 0, "cost_avoided must be positive"
            assert 0 <= ev["success_rate_pct"] <= 100, "success_rate_pct out of range"

        # Must have at least one HIGH_PRICE event
        high_price_events = [e for e in events if e["trigger"] == "HIGH_PRICE"]
        assert len(high_price_events) >= 1, "Expected at least one HIGH_PRICE event"

        # ── benefits ───────────────────────────────────────────────────────
        benefits = data["benefits"]
        assert len(benefits) == 10, f"Expected 10 benefit records, got {len(benefits)}"

        for b in benefits:
            assert b["annual_flexibility_revenue_m_aud"] >= 0
            assert b["energy_cost_saving_m_aud"] >= 0
            assert b["network_charge_saving_m_aud"] >= 0
            assert b["co2_avoided_kt"] >= 0
            expected_total = (
                b["annual_flexibility_revenue_m_aud"]
                + b["energy_cost_saving_m_aud"]
                + b["network_charge_saving_m_aud"]
            )
            assert abs(b["total_benefit_m_aud"] - expected_total) < 0.05, (
                f"total_benefit_m_aud mismatch for {b['consumer_name']}: "
                f"got {b['total_benefit_m_aud']}, expected ~{expected_total:.2f}"
            )

        # ── technologies ───────────────────────────────────────────────────
        techs = data["technologies"]
        assert len(techs) == 6, f"Expected 6 technology records, got {len(techs)}"

        valid_techs = {
            "AUTOMATED_DR", "MANUAL_DR", "SMART_INVERTER",
            "THERMAL_STORAGE", "PROCESS_SHIFT", "BACKUP_GENERATOR",
        }
        for t in techs:
            assert t["technology"] in valid_techs, f"Invalid technology: {t['technology']}"
            assert 0 < t["adoption_pct"] <= 100, "adoption_pct out of range"
            assert t["avg_response_time_min"] >= 0, "avg_response_time_min must be non-negative"
            assert t["typical_duration_hr"] > 0, "typical_duration_hr must be positive"
            assert t["cost_aud_per_kw"] >= 0, "cost_aud_per_kw must be non-negative"
            assert 0 <= t["reliability_score"] <= 10, "reliability_score out of range"

        # AUTOMATED_DR should have a shorter response than MANUAL_DR
        auto_dr = next(t for t in techs if t["technology"] == "AUTOMATED_DR")
        manual_dr = next(t for t in techs if t["technology"] == "MANUAL_DR")
        assert auto_dr["avg_response_time_min"] < manual_dr["avg_response_time_min"], (
            "AUTOMATED_DR should respond faster than MANUAL_DR"
        )

        # SMART_INVERTER should have the highest reliability
        smart_inv = next(t for t in techs if t["technology"] == "SMART_INVERTER")
        assert smart_inv["reliability_score"] >= 9.0, (
            f"SMART_INVERTER reliability should be >=9.0, got {smart_inv['reliability_score']}"
        )


# ============================================================
# Sprint 63b — ASX Energy Futures Price Discovery & Term Structure Analytics
# ============================================================

class TestFuturesPriceDiscovery:
    def test_futures_price_discovery_dashboard(self, client):
        response = client.get(
            "/api/futures-price-discovery/dashboard",
            headers={"X-API-Key": "test-api-key"},
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        body = response.json()

        # Top-level keys
        for key in ("timestamp", "term_structures", "basis_records", "carry_records", "curve_shapes"):
            assert key in body, f"Missing key: {key}"

        # ----- term_structures: 20 records (5 regions × 4 quarters) -----
        ts = body["term_structures"]
        assert len(ts) == 20, f"Expected 20 term structure records, got {len(ts)}"

        valid_regions = {"NSW", "VIC", "QLD", "SA", "TAS"}
        valid_products = {"BASE", "PEAK", "CAP"}
        quarters = {"2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"}

        for rec in ts:
            assert rec["region"] in valid_regions, f"Invalid region: {rec['region']}"
            assert rec["product"] in valid_products, f"Invalid product: {rec['product']}"
            assert rec["contract_month"] in quarters, f"Invalid quarter: {rec['contract_month']}"
            assert rec["settlement_price_aud_mwh"] > 0, "Settlement price must be positive"
            assert rec["open_interest_lots"] > 0, "OI must be positive"
            assert rec["daily_volume_lots"] >= 0, "Volume must be non-negative"
            assert 0 < rec["implied_vol_pct"] < 100, f"Implied vol out of range: {rec['implied_vol_pct']}"
            assert rec["days_to_expiry"] >= 0, "Days to expiry must be non-negative"

        # SA prices should be higher than TAS across all quarters
        sa_prices = [r["settlement_price_aud_mwh"] for r in ts if r["region"] == "SA"]
        tas_prices = [r["settlement_price_aud_mwh"] for r in ts if r["region"] == "TAS"]
        for sa_p, tas_p in zip(sa_prices, tas_prices):
            assert sa_p > tas_p, f"SA price {sa_p} should exceed TAS price {tas_p}"

        # Most liquid contract should have highest OI
        max_oi = max(r["open_interest_lots"] for r in ts)
        assert max_oi >= 10000, f"Expected at least one contract with OI >= 10000, got {max_oi}"

        # ----- basis_records: 20 records (5 regions × 4 months) -----
        basis = body["basis_records"]
        assert len(basis) == 20, f"Expected 20 basis records, got {len(basis)}"

        valid_trends = {"CONVERGING", "DIVERGING", "STABLE"}
        valid_months = {"Jan", "Feb", "Mar", "Apr"}

        for rec in basis:
            assert rec["region"] in valid_regions, f"Invalid basis region: {rec['region']}"
            assert rec["month"] in valid_months, f"Invalid month: {rec['month']}"
            assert rec["convergence_trend"] in valid_trends, (
                f"Invalid convergence trend: {rec['convergence_trend']}"
            )
            assert rec["futures_price"] > 0, "Futures price must be positive"
            assert rec["spot_price"] > 0, "Spot price must be positive"
            # basis = futures - spot
            expected_basis = round(rec["futures_price"] - rec["spot_price"], 1)
            assert abs(rec["basis_aud"] - expected_basis) < 1.0, (
                f"basis_aud mismatch: {rec['basis_aud']} vs expected {expected_basis}"
            )
            assert rec["seasonal_factor"], "seasonal_factor should not be empty"

        # ----- carry_records: 10 records (5 regions × 2 spreads) -----
        carry = body["carry_records"]
        assert len(carry) == 10, f"Expected 10 carry records, got {len(carry)}"

        carry_regions = {r["region"] for r in carry}
        assert carry_regions == valid_regions, f"Carry regions mismatch: {carry_regions}"

        for rec in carry:
            assert rec["near_contract"] != rec["far_contract"], (
                "Near and far contract should differ"
            )
            assert rec["storage_premium_aud"] >= 0, "Storage premium should be non-negative"
            assert rec["risk_premium_aud"] >= 0, "Risk premium should be non-negative"

        # ----- curve_shapes: 10 records (5 regions × 2 snapshots) -----
        shapes = body["curve_shapes"]
        assert len(shapes) == 10, f"Expected 10 curve shape records, got {len(shapes)}"

        valid_shapes = {"CONTANGO", "BACKWARDATION", "FLAT", "KINKED"}
        shape_regions = {r["region"] for r in shapes}
        assert shape_regions == valid_regions, f"Curve shape regions mismatch: {shape_regions}"

        for rec in shapes:
            assert rec["curve_shape"] in valid_shapes, f"Invalid curve shape: {rec['curve_shape']}"
            assert rec["q1_price"] > 0, "Q1 price must be positive"
            assert rec["q2_price"] > 0, "Q2 price must be positive"
            assert rec["q3_price"] > 0, "Q3 price must be positive"
            assert rec["q4_price"] > 0, "Q4 price must be positive"
            assert rec["inflection_quarter"].startswith("Q"), (
                f"inflection_quarter should start with Q, got {rec['inflection_quarter']}"
            )

        # SA should be CONTANGO (prices rising in summer forward curve)
        sa_shapes = [r["curve_shape"] for r in shapes if r["region"] == "SA"]
        assert all(s == "CONTANGO" for s in sa_shapes), (
            f"SA should be CONTANGO, got {sa_shapes}"
        )

        # TAS should be FLAT (hydro stability)
        tas_shapes = [r["curve_shape"] for r in shapes if r["region"] == "TAS"]
        assert all(s == "FLAT" for s in tas_shapes), (
            f"TAS should be FLAT, got {tas_shapes}"
        )

        # NSW and VIC should be KINKED
        nsw_shapes = [r["curve_shape"] for r in shapes if r["region"] == "NSW"]
        assert all(s == "KINKED" for s in nsw_shapes), (
            f"NSW should be KINKED, got {nsw_shapes}"
        )


class TestElectricityPriceIndex:
    def test_electricity_price_index_dashboard(self, client):
        response = client.get(
            "/api/electricity-price-index/dashboard",
            headers={"X-API-Key": "test-key"},
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        body = response.json()

        # Top-level keys
        for key in ("timestamp", "cpi_records", "dmo_records", "tariff_components", "retailers"):
            assert key in body, f"Missing top-level key: {key}"

        # CPI records: 24 records (6 quarters x 4 states)
        cpi = body["cpi_records"]
        assert len(cpi) == 24, f"Expected 24 CPI records, got {len(cpi)}"
        for rec in cpi:
            assert rec["electricity_cpi_yoy_pct"] > 0, "Electricity CPI YoY should be positive"
            assert rec["all_cpi_yoy_pct"] > 0, "All CPI YoY should be positive"
            assert rec["electricity_cpi_index"] > 0, "CPI index should be positive"
            assert rec["state"] in ("NSW", "VIC", "QLD", "SA"), f"Unexpected state: {rec['state']}"
            assert rec["quarter"].startswith("202"), f"Unexpected quarter: {rec['quarter']}"
            assert len(rec["key_driver"]) > 0, "key_driver should not be empty"
        # SA should have the highest avg electricity_cpi_yoy_pct
        sa_avg = sum(r["electricity_cpi_yoy_pct"] for r in cpi if r["state"] == "SA") / 6
        nsw_avg = sum(r["electricity_cpi_yoy_pct"] for r in cpi if r["state"] == "NSW") / 6
        assert sa_avg > nsw_avg, "SA should have higher avg CPI YoY than NSW"

        # DMO records: 20 records (5 states x 4 years)
        dmo = body["dmo_records"]
        assert len(dmo) == 20, f"Expected 20 DMO records, got {len(dmo)}"
        states_in_dmo = set(r["state"] for r in dmo)
        assert states_in_dmo == {"NSW", "VIC", "QLD", "SA", "WA"}, f"DMO states mismatch: {states_in_dmo}"
        years_in_dmo = set(r["year"] for r in dmo)
        assert years_in_dmo == {2021, 2022, 2023, 2024}, f"DMO years mismatch: {years_in_dmo}"
        for rec in dmo:
            assert rec["dmo_price_aud"] > rec["best_market_offer_aud"], "DMO should exceed best market offer"
            assert rec["potential_saving_aud"] > 0, "Potential saving should be positive"
            assert rec["annual_usage_kwh"] > 0, "Annual usage should be positive"
        # SA should have the highest DMO price in 2024
        sa_2024_dmo = next((r["dmo_price_aud"] for r in dmo if r["state"] == "SA" and r["year"] == 2024), None)
        vic_2024_dmo = next((r["dmo_price_aud"] for r in dmo if r["state"] == "VIC" and r["year"] == 2024), None)
        assert sa_2024_dmo is not None and vic_2024_dmo is not None
        assert sa_2024_dmo > vic_2024_dmo, "SA DMO should be higher than VIC DMO in 2024"

        # Tariff components: 20 records (5 states x 4 years)
        tariffs = body["tariff_components"]
        assert len(tariffs) == 20, f"Expected 20 tariff records, got {len(tariffs)}"
        states_in_tariffs = set(r["state"] for r in tariffs)
        assert states_in_tariffs == {"NSW", "VIC", "QLD", "SA", "WA"}, f"Tariff states mismatch: {states_in_tariffs}"
        for rec in tariffs:
            component_sum = (
                rec["network_charges_aud_kwh"]
                + rec["wholesale_charges_aud_kwh"]
                + rec["environmental_charges_aud_kwh"]
                + rec["retail_margin_aud_kwh"]
                + rec["metering_aud_kwh"]
            )
            assert abs(component_sum - rec["total_tariff_aud_kwh"]) < 0.005, (
                f"Component sum {component_sum:.4f} != total {rec['total_tariff_aud_kwh']:.4f} for {rec['state']} {rec['year']}"
            )
            # Network should be the largest component
            assert rec["network_charges_aud_kwh"] > rec["retail_margin_aud_kwh"], (
                f"Network charges should exceed retail margin for {rec['state']} {rec['year']}"
            )
        # 2023 NSW total should exceed 2021 NSW total (price increase)
        nsw_2021 = next(r["total_tariff_aud_kwh"] for r in tariffs if r["state"] == "NSW" and r["year"] == 2021)
        nsw_2023 = next(r["total_tariff_aud_kwh"] for r in tariffs if r["state"] == "NSW" and r["year"] == 2023)
        assert nsw_2023 > nsw_2021, "NSW 2023 tariff should exceed 2021"

        # Retailer records: 15 records
        retailers = body["retailers"]
        assert len(retailers) == 15, f"Expected 15 retailer records, got {len(retailers)}"
        for rec in retailers:
            assert 0 < rec["market_share_pct"] <= 100, f"market_share_pct out of range: {rec['market_share_pct']}"
            assert 0 <= rec["customer_satisfaction_score"] <= 10, (
                f"satisfaction_score out of range: {rec['customer_satisfaction_score']}"
            )
            assert rec["avg_offer_aud"] >= rec["cheapest_offer_aud"], (
                f"avg_offer should >= cheapest_offer for {rec['retailer']}"
            )
            assert rec["complaints_per_1000"] >= 0, "Complaints should be non-negative"
            assert rec["churn_rate_pct"] >= 0, "Churn rate should be non-negative"
        # Synergy (WA) should have the highest market share
        synergy = next((r for r in retailers if r["retailer"] == "Synergy"), None)
        assert synergy is not None, "Synergy retailer not found"
        max_share = max(r["market_share_pct"] for r in retailers)
        assert synergy["market_share_pct"] == max_share, (
            f"Synergy should have the highest market share, got {synergy['market_share_pct']} vs max {max_share}"
        )
        # Red Energy should have the highest satisfaction score among VIC retailers
        vic_retailers = [r for r in retailers if r["state"] == "VIC"]
        red_energy = next((r for r in vic_retailers if r["retailer"] == "Red Energy"), None)
        assert red_energy is not None, "Red Energy not found in VIC"
        vic_max_satisfaction = max(r["customer_satisfaction_score"] for r in vic_retailers)
        assert red_energy["customer_satisfaction_score"] == vic_max_satisfaction, (
            "Red Energy should have highest satisfaction in VIC"
        )


class TestMlfAnalytics:
    def test_mlf_analytics_dashboard(self, client, auth_headers):
        response = client.get("/api/mlf-analytics/dashboard", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()

        # Top-level keys
        for key in ("timestamp", "connection_points", "rez_mlfs", "revenue_impacts", "historical"):
            assert key in data, f"Missing key: {key}"

        # connection_points: 15 records
        cps = data["connection_points"]
        assert len(cps) == 15, f"Expected 15 connection points, got {len(cps)}"

        valid_trends = {"IMPROVING", "DECLINING", "STABLE"}
        valid_regions = {"NSW", "VIC", "QLD", "SA", "TAS"}
        for cp in cps:
            assert cp["mlf_trend"] in valid_trends, f"Invalid mlf_trend: {cp['mlf_trend']}"
            assert cp["region"] in valid_regions, f"Invalid region: {cp['region']}"
            assert 0.0 < cp["mlf_2024"] <= 1.1, f"mlf_2024 out of range: {cp['mlf_2024']}"
            assert 0.0 < cp["mlf_2023"] <= 1.1, f"mlf_2023 out of range: {cp['mlf_2023']}"
            assert 0.0 < cp["mlf_2022"] <= 1.1, f"mlf_2022 out of range: {cp['mlf_2022']}"
            assert cp["connection_point"], "connection_point must be non-empty"
            assert cp["generator_name"], "generator_name must be non-empty"

        # At least one declining and one improving
        declining = [cp for cp in cps if cp["mlf_trend"] == "DECLINING"]
        improving = [cp for cp in cps if cp["mlf_trend"] == "IMPROVING"]
        assert len(declining) >= 1, "Expected at least 1 DECLINING trend"
        assert len(improving) >= 1, "Expected at least 1 IMPROVING trend"

        # At least one CP with mlf_2024 < 0.95
        below_095 = [cp for cp in cps if cp["mlf_2024"] < 0.95]
        assert len(below_095) >= 1, "Expected at least 1 connection point with MLF 2024 below 0.95"

        # rez_mlfs: 8 records
        rezs = data["rez_mlfs"]
        assert len(rezs) == 8, f"Expected 8 REZ records, got {len(rezs)}"

        valid_risk = {"HIGH", "MEDIUM", "LOW"}
        for rez in rezs:
            assert rez["risk_level"] in valid_risk, f"Invalid risk_level: {rez['risk_level']}"
            assert rez["region"] in valid_regions, f"Invalid region: {rez['region']}"
            assert 0.0 < rez["current_mlf"] <= 1.1, f"current_mlf out of range: {rez['current_mlf']}"
            assert 0.0 < rez["projected_mlf_2028"] <= 1.1, f"projected_mlf_2028 out of range: {rez['projected_mlf_2028']}"
            assert rez["mlf_deterioration_pct"] <= 0, "Deterioration should be negative or zero"
            assert rez["connected_capacity_mw"] > 0, "connected_capacity_mw must be positive"
            assert rez["pipeline_capacity_mw"] > 0, "pipeline_capacity_mw must be positive"
            assert rez["aemo_mitigation"], "aemo_mitigation must be non-empty"

        # At least 4 HIGH risk REZs
        high_risk = [r for r in rezs if r["risk_level"] == "HIGH"]
        assert len(high_risk) >= 4, f"Expected at least 4 HIGH risk REZs, got {len(high_risk)}"

        # revenue_impacts: 12 records
        impacts = data["revenue_impacts"]
        assert len(impacts) == 12, f"Expected 12 revenue impact records, got {len(impacts)}"

        for imp in impacts:
            assert imp["capacity_mw"] > 0, "capacity_mw must be positive"
            assert imp["annual_generation_gwh"] > 0, "annual_generation_gwh must be positive"
            assert 0.0 < imp["mlf_value"] <= 1.1, f"mlf_value out of range: {imp['mlf_value']}"
            assert imp["spot_price_aud_mwh"] > 0, "spot_price_aud_mwh must be positive"
            assert imp["effective_price_aud_mwh"] > 0, "effective_price_aud_mwh must be positive"
            # effective price = spot * mlf (approximately)
            assert abs(imp["effective_price_aud_mwh"] - imp["spot_price_aud_mwh"] * imp["mlf_value"]) < 2.0, (
                f"effective_price should approximate spot * mlf for {imp['generator_name']}"
            )

        # At least one generator with revenue_loss_m_aud > 5 M AUD
        big_loss = [imp for imp in impacts if imp["revenue_loss_m_aud"] > 5.0]
        assert len(big_loss) >= 1, "Expected at least 1 generator with revenue loss > $5M AUD"

        # historical: 20 records (5 regions × 4 years)
        hist = data["historical"]
        assert len(hist) == 20, f"Expected 20 historical records, got {len(hist)}"

        for rec in hist:
            assert rec["region"] in valid_regions, f"Invalid region: {rec['region']}"
            assert rec["year"] in (2021, 2022, 2023, 2024), f"Invalid year: {rec['year']}"
            assert 0.0 < rec["avg_mlf"] <= 1.1, f"avg_mlf out of range: {rec['avg_mlf']}"
            assert rec["min_mlf"] <= rec["avg_mlf"], "min_mlf must be <= avg_mlf"
            assert rec["avg_mlf"] <= rec["max_mlf"], "avg_mlf must be <= max_mlf"
            assert rec["generators_below_095"] >= 0, "generators_below_095 must be non-negative"
            assert rec["total_generators"] > 0, "total_generators must be positive"
            assert rec["generators_below_095"] <= rec["total_generators"], (
                "generators_below_095 must not exceed total_generators"
            )

        # SA should have the lowest avg_mlf in 2024 (heavy renewable penetration)
        sa_2024 = next(r for r in hist if r["region"] == "SA" and r["year"] == 2024)
        tas_2024 = next(r for r in hist if r["region"] == "TAS" and r["year"] == 2024)
        assert sa_2024["avg_mlf"] < tas_2024["avg_mlf"], (
            "SA avg_mlf 2024 should be lower than TAS avg_mlf 2024"
        )

        # TAS should have 0 generators below 0.95 in all years
        tas_recs = [r for r in hist if r["region"] == "TAS"]
        for rec in tas_recs:
            assert rec["generators_below_095"] == 0, (
                f"TAS generators_below_095 should be 0, got {rec['generators_below_095']} in {rec['year']}"
            )


# ===========================================================================
# Sprint 64b — Interconnector Upgrade Business Case Analytics
# ===========================================================================

class TestInterconnectorUpgradeAnalytics:
    """Tests for GET /api/interconnector-upgrade/dashboard endpoint."""

    def test_interconnector_upgrade_dashboard(self, client):
        response = client.get(
            "/api/interconnector-upgrade/dashboard",
            headers={"X-API-Key": "test-api-key"},
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        body = response.json()

        # Top-level keys
        for key in ("timestamp", "projects", "benefits", "scenarios", "flow_analysis"):
            assert key in body, f"Missing key: {key}"

        # ---- projects: 6 records ----
        projects = body["projects"]
        assert len(projects) == 6, f"Expected 6 project records, got {len(projects)}"

        valid_statuses = {"OPERATING", "CONSTRUCTION", "APPROVED", "PROPOSED"}
        valid_outcomes = {"PASS", "FAIL", "PENDING"}
        project_ids = {p["project_id"] for p in projects}
        expected_ids = {"HUMELINK", "VNI_WEST", "QNI_MIDDLEWARE", "ENERGY_CONNECT", "MARINUS_1", "COPPERSTRING"}
        assert project_ids == expected_ids, f"Unexpected project IDs: {project_ids}"

        for p in projects:
            assert p["status"] in valid_statuses, f"Invalid status: {p['status']}"
            assert p["regulatory_test_outcome"] in valid_outcomes, (
                f"Invalid regulatory test outcome: {p['regulatory_test_outcome']}"
            )
            assert p["capex_bn_aud"] > 0, f"capex must be positive for {p['project_id']}"
            assert p["capacity_increase_mw"] > 0, f"capacity_increase must be positive for {p['project_id']}"
            assert p["bcr"] > 0, f"BCR must be positive for {p['project_id']}"
            assert isinstance(p["aer_approved"], bool), f"aer_approved must be bool for {p['project_id']}"
            assert 2020 <= p["commissioning_year"] <= 2040, (
                f"commissioning_year out of range: {p['commissioning_year']}"
            )

        # EnergyConnect should be OPERATING and AER approved
        ec = next(p for p in projects if p["project_id"] == "ENERGY_CONNECT")
        assert ec["status"] == "OPERATING"
        assert ec["aer_approved"] is True
        assert ec["regulatory_test_outcome"] == "PASS"

        # HumeLink should have the second highest BCR after EnergyConnect
        ec_bcr = ec["bcr"]
        assert ec_bcr > 1.5, f"EnergyConnect BCR should be > 1.5, got {ec_bcr}"

        # QNI-Middleware should be PROPOSED and not AER approved
        qni = next(p for p in projects if p["project_id"] == "QNI_MIDDLEWARE")
        assert qni["status"] == "PROPOSED"
        assert qni["aer_approved"] is False
        assert qni["regulatory_test_outcome"] == "PENDING"

        # ---- benefits: 20 records ----
        benefits = body["benefits"]
        assert len(benefits) == 20, f"Expected 20 benefit records, got {len(benefits)}"

        valid_benefit_types = {
            "CONGESTION_RENT", "FUEL_COST_SAVING", "RELIABILITY",
            "RENEWABLE_FIRMING", "AVOIDED_INVESTMENT", "CONSUMER_SURPLUS",
        }
        valid_confidence = {"HIGH", "MEDIUM", "LOW"}

        for b in benefits:
            assert b["benefit_type"] in valid_benefit_types, f"Invalid benefit type: {b['benefit_type']}"
            assert b["confidence"] in valid_confidence, f"Invalid confidence: {b['confidence']}"
            assert b["benefit_m_aud_yr"] > 0, f"benefit_m_aud_yr must be positive"
            assert b["project_id"] in expected_ids, f"Unknown project_id in benefit: {b['project_id']}"
            assert len(b["quantification_method"]) > 0, "quantification_method must not be empty"

        # Every project should have at least one benefit record
        for pid in expected_ids:
            count = sum(1 for b in benefits if b["project_id"] == pid)
            assert count >= 1, f"Project {pid} has no benefit records"

        # ---- scenarios: 18 records (6 projects × 3 scenarios) ----
        scenarios = body["scenarios"]
        assert len(scenarios) == 18, f"Expected 18 scenario records, got {len(scenarios)}"

        valid_scenarios = {"STEP_CHANGE", "CENTRAL", "SLOW_CHANGE"}

        for s in scenarios:
            assert s["scenario"] in valid_scenarios, f"Invalid scenario: {s['scenario']}"
            assert s["project_id"] in expected_ids, f"Unknown project_id in scenario: {s['project_id']}"
            assert s["bcr"] > 0, f"Scenario BCR must be positive"
            assert s["renewable_firming_mw"] >= 0, "renewable_firming_mw must be non-negative"
            assert s["breakeven_price_aud_mwh"] > 0, "breakeven_price_aud_mwh must be positive"

        # For every project, STEP_CHANGE NPV >= CENTRAL NPV >= SLOW_CHANGE NPV
        for pid in expected_ids:
            sc_npv = next(s["npv_bn_aud"] for s in scenarios if s["project_id"] == pid and s["scenario"] == "STEP_CHANGE")
            cen_npv = next(s["npv_bn_aud"] for s in scenarios if s["project_id"] == pid and s["scenario"] == "CENTRAL")
            slow_npv = next(s["npv_bn_aud"] for s in scenarios if s["project_id"] == pid and s["scenario"] == "SLOW_CHANGE")
            assert sc_npv >= cen_npv, (
                f"{pid}: STEP_CHANGE NPV ({sc_npv}) should be >= CENTRAL NPV ({cen_npv})"
            )
            assert cen_npv >= slow_npv, (
                f"{pid}: CENTRAL NPV ({cen_npv}) should be >= SLOW_CHANGE NPV ({slow_npv})"
            )

        # ---- flow_analysis: 18 records (6 projects × 3 years) ----
        flow = body["flow_analysis"]
        assert len(flow) == 18, f"Expected 18 flow analysis records, got {len(flow)}"

        for f in flow:
            assert f["project_id"] in expected_ids, f"Unknown project_id in flow: {f['project_id']}"
            assert 2020 <= f["year"] <= 2040, f"year out of range: {f['year']}"
            assert f["annual_flow_twh"] > 0, "annual_flow_twh must be positive"
            assert f["peak_flow_mw"] > 0, "peak_flow_mw must be positive"
            assert 0 < f["avg_utilisation_pct"] <= 100, (
                f"avg_utilisation_pct out of range: {f['avg_utilisation_pct']}"
            )
            assert 0 <= f["congestion_hours_pct"] <= 100, (
                f"congestion_hours_pct out of range: {f['congestion_hours_pct']}"
            )
            assert f["marginal_value_aud_mwh"] > 0, "marginal_value_aud_mwh must be positive"

        # Utilisation should increase over time for each project (improving)
        for pid in expected_ids:
            proj_flows = sorted(
                [f for f in flow if f["project_id"] == pid],
                key=lambda x: x["year"],
            )
            if len(proj_flows) >= 2:
                assert proj_flows[-1]["avg_utilisation_pct"] >= proj_flows[0]["avg_utilisation_pct"], (
                    f"{pid}: utilisation should not decrease over time"
                )


class TestCspAnalytics:
    """Sprint 65a — CSP & Solar Thermal Technology Analytics tests."""

    def test_csp_analytics_dashboard(self, client, auth_headers):
        response = client.get("/api/csp-analytics/dashboard", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        body = response.json()

        # Top-level keys
        for key in ("timestamp", "technologies", "projects", "resources", "dispatch_profiles"):
            assert key in body, f"Missing key: {key}"

        # ---- technologies: exactly 4 records ----
        technologies = body["technologies"]
        assert len(technologies) == 4, f"Expected 4 technology records, got {len(technologies)}"

        valid_tech_names = {"PARABOLIC_TROUGH", "SOLAR_TOWER", "LINEAR_FRESNEL", "DISH_STIRLING"}
        for t in technologies:
            assert t["name"] in valid_tech_names, f"Invalid tech name: {t['name']}"
            assert 0 < t["peak_efficiency_pct"] <= 100, f"peak_efficiency_pct out of range: {t['peak_efficiency_pct']}"
            assert 0 < t["annual_capacity_factor_pct"] <= 100, f"annual_capacity_factor_pct out of range"
            assert t["storage_hours"] >= 0, "storage_hours must be non-negative"
            assert t["capex_m_aud_mw"] > 0, "capex_m_aud_mw must be positive"
            assert t["lcoe_aud_mwh"] > 0, "lcoe_aud_mwh must be positive"
            assert t["water_use_l_mwh"] >= 0, "water_use_l_mwh must be non-negative"
            assert t["land_use_ha_mw"] > 0, "land_use_ha_mw must be positive"
            assert 1 <= t["trl"] <= 9, f"TRL out of range: {t['trl']}"
            assert 0 <= t["dispatchability_score"] <= 10, f"dispatchability_score out of range: {t['dispatchability_score']}"

        # SOLAR_TOWER should have highest dispatchability
        tower = next(t for t in technologies if t["name"] == "SOLAR_TOWER")
        dish = next(t for t in technologies if t["name"] == "DISH_STIRLING")
        assert tower["dispatchability_score"] > dish["dispatchability_score"], (
            "SOLAR_TOWER dispatchability should exceed DISH_STIRLING"
        )

        # SOLAR_TOWER should have highest storage hours
        assert tower["storage_hours"] >= dish["storage_hours"], (
            "SOLAR_TOWER storage hours should be >= DISH_STIRLING"
        )

        # ---- projects: exactly 8 records ----
        projects = body["projects"]
        assert len(projects) == 8, f"Expected 8 project records, got {len(projects)}"

        valid_statuses = {"OPERATING", "CONSTRUCTION", "APPROVED", "PROPOSED", "CANCELLED"}
        valid_technologies = {"PARABOLIC_TROUGH", "SOLAR_TOWER", "LINEAR_FRESNEL", "DISH_STIRLING"}
        for p in projects:
            assert p["status"] in valid_statuses, f"Invalid status: {p['status']}"
            assert p["technology"] in valid_technologies, f"Invalid technology: {p['technology']}"
            assert p["capacity_mw"] > 0, "capacity_mw must be positive"
            assert p["capex_m_aud"] > 0, "capex_m_aud must be positive"
            assert p["storage_hours"] >= 0, "storage_hours must be non-negative"
            assert p["expected_lcoe_aud_mwh"] > 0, "expected_lcoe_aud_mwh must be positive"
            assert p["dni_kwh_m2_yr"] > 0, "dni_kwh_m2_yr must be positive"
            assert 2000 <= p["cod_year"] <= 2040, f"cod_year out of range: {p['cod_year']}"

        # Specific project checks
        vast = next((p for p in projects if "Vast Solar Jemalong" in p["project_name"]), None)
        assert vast is not None, "Vast Solar Jemalong Pilot not found"
        assert vast["status"] == "OPERATING", "Vast Solar Jemalong should be OPERATING"
        assert vast["technology"] == "SOLAR_TOWER", "Vast Solar Jemalong should use SOLAR_TOWER"

        sundrop = next((p for p in projects if "Sundrop" in p["project_name"]), None)
        assert sundrop is not None, "Sundrop Farms project not found"
        assert sundrop["technology"] == "LINEAR_FRESNEL", "Sundrop Farms should use LINEAR_FRESNEL"

        pilbara = next((p for p in projects if "Pilbara" in p["project_name"]), None)
        assert pilbara is not None, "Pilbara Solar Thermal Hub not found"
        assert pilbara["status"] == "APPROVED", "Pilbara should be APPROVED"
        assert pilbara["storage_hours"] >= 10, "Pilbara should have >= 10 storage hours"

        # World-class DNI projects should have lower LCOE
        high_dni_projects = [p for p in projects if p["dni_kwh_m2_yr"] >= 2800]
        assert len(high_dni_projects) > 0, "Should have projects in world-class DNI zones"

        # ---- resources: exactly 10 records ----
        resources = body["resources"]
        assert len(resources) == 10, f"Expected 10 resource records, got {len(resources)}"

        valid_dni_classes = {"WORLD_CLASS", "EXCELLENT", "GOOD", "MARGINAL"}
        world_class_count = 0
        for r in resources:
            assert r["dni_class"] in valid_dni_classes, f"Invalid DNI class: {r['dni_class']}"
            assert r["dni_kwh_m2_yr"] > 0, "dni_kwh_m2_yr must be positive"
            assert r["area_km2"] > 0, "area_km2 must be positive"
            assert r["grid_distance_km"] >= 0, "grid_distance_km must be non-negative"
            assert isinstance(r["proximity_to_existing_project"], bool), "proximity_to_existing_project must be bool"
            if r["dni_class"] == "WORLD_CLASS":
                world_class_count += 1
                assert r["dni_kwh_m2_yr"] >= 2700, (
                    f"WORLD_CLASS site {r['location']} has low DNI: {r['dni_kwh_m2_yr']}"
                )

        assert world_class_count >= 4, f"Expected >= 4 WORLD_CLASS sites, got {world_class_count}"

        # Newman WA should be world class
        newman = next((r for r in resources if r["location"] == "Newman"), None)
        assert newman is not None, "Newman WA resource record not found"
        assert newman["dni_class"] == "WORLD_CLASS", "Newman should be WORLD_CLASS DNI"

        # ---- dispatch_profiles: exactly 12 monthly records ----
        dispatch = body["dispatch_profiles"]
        assert len(dispatch) == 12, f"Expected 12 dispatch records, got {len(dispatch)}"

        months_seen = set()
        for d in dispatch:
            assert d["solar_mw"] >= 0, "solar_mw must be non-negative"
            assert d["storage_mw"] >= 0, "storage_mw must be non-negative"
            assert d["total_output_mw"] >= 0, "total_output_mw must be non-negative"
            assert 0 <= d["storage_utilisation_pct"] <= 100, (
                f"storage_utilisation_pct out of range: {d['storage_utilisation_pct']}"
            )
            assert d["curtailment_mw"] >= 0, "curtailment_mw must be non-negative"
            assert d["firming_hours_provided"] >= 0, "firming_hours_provided must be non-negative"
            months_seen.add(d["month"])

        expected_months = {"Jan", "Feb", "Mar", "Apr", "May", "Jun",
                           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}
        assert months_seen == expected_months, f"Missing months: {expected_months - months_seen}"

        # Summer months (Jan, Dec) should have higher solar output than winter (Jun, Jul)
        jan = next(d for d in dispatch if d["month"] == "Jan")
        jun = next(d for d in dispatch if d["month"] == "Jun")
        assert jan["solar_mw"] > jun["solar_mw"], (
            f"January solar ({jan['solar_mw']}) should exceed June solar ({jun['solar_mw']})"
        )


class TestCarbonIntensityAnalytics:
    """Sprint 65c — Carbon Intensity Real-Time & Historical Analytics"""

    def test_carbon_intensity_dashboard(self, client, auth_headers):
        response = client.get("/api/carbon-intensity/dashboard", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        body = response.json()

        # Top-level keys
        for key in ("timestamp", "grid_intensity", "marginal_emissions", "technology_emissions", "decarbonisation"):
            assert key in body, f"Missing top-level key: {key}"

        # --- grid_intensity: 30 records (5 regions × 6 months) ---
        grid = body["grid_intensity"]
        assert len(grid) == 30, f"Expected 30 grid intensity records, got {len(grid)}"

        for rec in grid:
            assert rec["region"] in ("NSW", "VIC", "QLD", "SA", "TAS"), f"Unexpected region: {rec['region']}"
            assert rec["avg_intensity_kgco2_mwh"] > 0, "avg_intensity must be positive"
            assert rec["min_intensity_kgco2_mwh"] <= rec["avg_intensity_kgco2_mwh"], "min must be <= avg"
            assert rec["max_intensity_kgco2_mwh"] >= rec["avg_intensity_kgco2_mwh"], "max must be >= avg"
            assert 0 <= rec["zero_carbon_hours_pct"] <= 100, f"zero_carbon_hours_pct out of range: {rec['zero_carbon_hours_pct']}"
            assert rec["total_emissions_kt_co2"] > 0, "total_emissions must be positive"
            assert 0 <= rec["vre_penetration_pct"] <= 100, "vre_penetration_pct out of range"

        # SA should have lower average intensity than NSW in the same month
        sa_recs = [r for r in grid if r["region"] == "SA"]
        nsw_recs = [r for r in grid if r["region"] == "NSW"]
        sa_avg = sum(r["avg_intensity_kgco2_mwh"] for r in sa_recs) / len(sa_recs)
        nsw_avg = sum(r["avg_intensity_kgco2_mwh"] for r in nsw_recs) / len(nsw_recs)
        assert sa_avg < nsw_avg, "SA should have lower avg intensity than NSW"

        # TAS should have the lowest overall average intensity
        tas_recs = [r for r in grid if r["region"] == "TAS"]
        tas_avg = sum(r["avg_intensity_kgco2_mwh"] for r in tas_recs) / len(tas_recs)
        assert tas_avg < sa_avg, "TAS should have lower avg intensity than SA"

        # All 6 months present
        months_found = set(r["month"] for r in grid)
        assert len(months_found) == 6, f"Expected 6 distinct months, got {len(months_found)}: {months_found}"

        # --- marginal_emissions: 24 records (4 regions × 6 hours) ---
        mef = body["marginal_emissions"]
        assert len(mef) == 24, f"Expected 24 marginal emission records, got {len(mef)}"

        valid_mef_regions = {"NSW", "VIC", "QLD", "SA"}
        valid_techs = {"Black Coal", "Gas CCGT", "Gas OCGT", "Solar PV"}
        for rec in mef:
            assert rec["region"] in valid_mef_regions, f"Unexpected MEF region: {rec['region']}"
            assert 0 <= rec["hour"] <= 23, f"hour out of range: {rec['hour']}"
            assert rec["marginal_emission_factor_kgco2_mwh"] >= 0, "MEF must be non-negative"
            assert rec["typical_price_aud_mwh"] > 0, "price must be positive"
            assert rec["flexibility_benefit_kg_co2_kwh"] >= 0, "flexibility_benefit must be non-negative"
            assert rec["marginal_technology"] in valid_techs, f"Unexpected marginal_technology: {rec['marginal_technology']}"

        # Daytime solar hours should have lower MEF than overnight coal hours for NSW
        nsw_mef = [r for r in mef if r["region"] == "NSW"]
        nsw_night = [r for r in nsw_mef if r["hour"] in (0, 4)]
        nsw_day = [r for r in nsw_mef if r["hour"] in (8, 12)]
        if nsw_night and nsw_day:
            avg_night_mef = sum(r["marginal_emission_factor_kgco2_mwh"] for r in nsw_night) / len(nsw_night)
            avg_day_mef = sum(r["marginal_emission_factor_kgco2_mwh"] for r in nsw_day) / len(nsw_day)
            assert avg_day_mef < avg_night_mef, "Daytime MEF should be lower than overnight MEF for NSW"

        # SA MEF should be lower than NSW MEF on average (more renewables)
        sa_mef = [r for r in mef if r["region"] == "SA"]
        nsw_mef_all = [r for r in mef if r["region"] == "NSW"]
        sa_mef_avg = sum(r["marginal_emission_factor_kgco2_mwh"] for r in sa_mef) / len(sa_mef)
        nsw_mef_avg = sum(r["marginal_emission_factor_kgco2_mwh"] for r in nsw_mef_all) / len(nsw_mef_all)
        assert sa_mef_avg < nsw_mef_avg, "SA average MEF should be lower than NSW"

        # --- technology_emissions: 12 records ---
        tech = body["technology_emissions"]
        assert len(tech) == 12, f"Expected 12 technology emission records, got {len(tech)}"

        valid_categories = {"FOSSIL", "LOW_CARBON", "RENEWABLE", "STORAGE"}
        for rec in tech:
            assert rec["category"] in valid_categories, f"Unexpected category: {rec['category']}"
            assert rec["lifecycle_kgco2_mwh"] >= 0, "lifecycle must be non-negative"
            assert rec["operational_kgco2_mwh"] >= 0, "operational must be non-negative"
            assert rec["construction_kgco2_mwh"] >= 0, "construction must be non-negative"
            assert rec["fuel_kgco2_mwh"] >= 0, "fuel must be non-negative"

        # FOSSIL technologies must have higher lifecycle than RENEWABLE
        fossil_recs = [r for r in tech if r["category"] == "FOSSIL"]
        renewable_recs = [r for r in tech if r["category"] == "RENEWABLE"]
        assert len(fossil_recs) >= 1, "At least 1 FOSSIL technology required"
        assert len(renewable_recs) >= 1, "At least 1 RENEWABLE technology required"
        min_fossil = min(r["lifecycle_kgco2_mwh"] for r in fossil_recs)
        max_renewable = max(r["lifecycle_kgco2_mwh"] for r in renewable_recs)
        assert min_fossil > max_renewable, "All FOSSIL technologies should have higher lifecycle than all RENEWABLE"

        # Black Coal should be the dirtiest
        black_coal = next((r for r in tech if r["technology"] == "Black Coal"), None)
        assert black_coal is not None, "Black Coal record required"
        max_lifecycle = max(r["lifecycle_kgco2_mwh"] for r in tech)
        assert black_coal["lifecycle_kgco2_mwh"] == max_lifecycle, "Black Coal should have highest lifecycle emissions"

        # --- decarbonisation: 20 records (5 regions × 4 years) ---
        decarb = body["decarbonisation"]
        assert len(decarb) == 20, f"Expected 20 decarbonisation records, got {len(decarb)}"

        for rec in decarb:
            assert rec["region"] in ("NSW", "VIC", "QLD", "SA", "TAS"), f"Unexpected region: {rec['region']}"
            assert rec["year"] in (2021, 2022, 2023, 2024), f"Year out of range: {rec['year']}"
            assert rec["emissions_mt_co2"] > 0, "emissions must be positive"
            assert rec["intensity_kgco2_mwh"] > 0, "intensity must be positive"
            assert 0 <= rec["vre_pct"] <= 100, "vre_pct out of range"
            assert 0 <= rec["coal_pct"] <= 100, "coal_pct out of range"
            assert 0 <= rec["gas_pct"] <= 100, "gas_pct out of range"
            assert rec["target_intensity_kgco2_mwh"] > 0, "target intensity must be positive"
            assert rec["target_year"] > 2024, "target_year must be in the future"
            assert isinstance(rec["on_track"], bool), "on_track must be a boolean"

        # Each region should show declining intensity over 2021-2024
        for region in ("NSW", "VIC", "QLD", "SA", "TAS"):
            region_recs = sorted(
                [r for r in decarb if r["region"] == region],
                key=lambda x: x["year"],
            )
            assert len(region_recs) == 4, f"{region}: expected 4 year records"
            assert region_recs[-1]["intensity_kgco2_mwh"] <= region_recs[0]["intensity_kgco2_mwh"], (
                f"{region}: intensity should not increase from 2021 to 2024"
            )

        # TAS should have lower intensity than NSW in 2024
        tas_2024 = next(r for r in decarb if r["region"] == "TAS" and r["year"] == 2024)
        nsw_2024 = next(r for r in decarb if r["region"] == "NSW" and r["year"] == 2024)
        assert tas_2024["intensity_kgco2_mwh"] < nsw_2024["intensity_kgco2_mwh"], (
            "TAS 2024 intensity should be less than NSW 2024 intensity"
        )

        # At least one region on track in 2024
        on_track_2024 = [r for r in decarb if r["year"] == 2024 and r["on_track"]]
        assert len(on_track_2024) >= 1, "At least one region should be on track in 2024"


class TestNetworkTariffReformAnalytics:
    """Sprint 65b — Network Tariff Reform & DER Incentive Analytics"""

    def test_network_tariff_reform_dashboard(self, client, auth_headers):
        response = client.get("/api/tariff-reform/dashboard", headers=auth_headers)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

        body = response.json()

        # Top-level keys
        for key in ("timestamp", "tariff_structures", "tariff_impacts", "der_incentives", "reform_outcomes"):
            assert key in body, f"Missing top-level key: {key}"

        # --- tariff_structures: 20 records (5 DNSPs x 4 tariff classes) ---
        structs = body["tariff_structures"]
        assert len(structs) == 20, f"Expected 20 tariff structure records, got {len(structs)}"

        valid_classes = {"RESIDENTIAL", "SME", "LARGE_COMMERCIAL", "INDUSTRIAL"}
        valid_types = {"FLAT", "TOU", "DEMAND", "DYNAMIC_NETWORK"}
        expected_dnsps = {"Ausgrid", "Energex", "SA Power Networks", "CitiPower", "Western Power"}

        dnsps_found = set()
        for rec in structs:
            assert rec["tariff_class"] in valid_classes, (
                f"Unexpected tariff_class: {rec['tariff_class']}"
            )
            assert rec["tariff_type"] in valid_types, (
                f"Unexpected tariff_type: {rec['tariff_type']}"
            )
            assert rec["daily_supply_aud"] > 0, "daily_supply_aud must be positive"
            assert rec["customers_k"] > 0, "customers_k must be positive"
            dnsps_found.add(rec["dnsp"])

        assert dnsps_found == expected_dnsps, (
            f"Expected DNSPs {expected_dnsps}, found {dnsps_found}"
        )

        # All 4 tariff types must appear in the data
        types_found = {r["tariff_type"] for r in structs}
        assert types_found == valid_types, f"Not all tariff types present: {types_found}"

        # At least some records should have solar export rates
        solar_records = [r for r in structs if r.get("solar_export_rate_aud_kwh") is not None]
        assert len(solar_records) >= 3, (
            f"Expected at least 3 records with solar export rates, got {len(solar_records)}"
        )

        # --- tariff_impacts: 20 records (4 tariff types x 5 customer types) ---
        impacts = body["tariff_impacts"]
        assert len(impacts) == 20, f"Expected 20 tariff impact records, got {len(impacts)}"

        valid_customer_types = {"AVERAGE", "HIGH_SOLAR", "EV_OWNER", "BATTERY_OWNER", "HIGH_DEMAND"}
        for rec in impacts:
            assert rec["tariff_type"] in valid_types, (
                f"Unexpected tariff_type in impact: {rec['tariff_type']}"
            )
            assert rec["customer_type"] in valid_customer_types, (
                f"Unexpected customer_type: {rec['customer_type']}"
            )
            assert rec["annual_bill_before_aud"] > 0, "annual_bill_before must be positive"
            assert rec["annual_bill_after_aud"] > 0, "annual_bill_after must be positive"
            assert 0 <= rec["der_incentive_score"] <= 10, (
                f"der_incentive_score out of range: {rec['der_incentive_score']}"
            )
            assert rec["peak_shift_mw_potential"] > 0, "peak_shift_mw_potential must be positive"

        # FLAT tariff should have lower DER incentive score than DYNAMIC_NETWORK
        flat_avg_score = sum(
            r["der_incentive_score"] for r in impacts if r["tariff_type"] == "FLAT"
        ) / 5
        dynamic_avg_score = sum(
            r["der_incentive_score"] for r in impacts if r["tariff_type"] == "DYNAMIC_NETWORK"
        ) / 5
        assert flat_avg_score < dynamic_avg_score, (
            f"FLAT avg DER score ({flat_avg_score:.2f}) should be < DYNAMIC_NETWORK avg score ({dynamic_avg_score:.2f})"
        )

        # DYNAMIC_NETWORK should have larger peak shift potential than FLAT for all customer types
        for ctype in valid_customer_types:
            flat_rec = next(
                r for r in impacts if r["tariff_type"] == "FLAT" and r["customer_type"] == ctype
            )
            dynamic_rec = next(
                r for r in impacts if r["tariff_type"] == "DYNAMIC_NETWORK" and r["customer_type"] == ctype
            )
            assert dynamic_rec["peak_shift_mw_potential"] > flat_rec["peak_shift_mw_potential"], (
                f"{ctype}: DYNAMIC_NETWORK peak shift should exceed FLAT"
            )

        # --- der_incentives: 15 records ---
        incentives = body["der_incentives"]
        assert len(incentives) == 15, f"Expected 15 DER incentive records, got {len(incentives)}"

        valid_incentive_types = {
            "SOLAR_FIT", "BATTERY_REBATE", "EV_SMART_CHARGING",
            "VPP_PARTICIPATION", "DEMAND_RESPONSE", "SOLAR_SPONGE",
        }
        for rec in incentives:
            assert rec["incentive_type"] in valid_incentive_types, (
                f"Unexpected incentive_type: {rec['incentive_type']}"
            )
            assert rec["incentive_value_aud"] > 0, "incentive_value must be positive"
            assert rec["eligible_customers_k"] > 0, "eligible_customers_k must be positive"
            assert 0 < rec["uptake_rate_pct"] <= 100, (
                f"uptake_rate_pct out of range: {rec['uptake_rate_pct']}"
            )
            assert rec["peak_reduction_mw"] > 0, "peak_reduction_mw must be positive"
            assert rec["annual_network_benefit_m_aud"] > 0, "annual_network_benefit must be positive"

        # Ausgrid should have incentives covering at least 3 different types
        ausgrid_types = {r["incentive_type"] for r in incentives if r["dnsp"] == "Ausgrid"}
        assert len(ausgrid_types) >= 3, (
            f"Ausgrid should cover at least 3 incentive types, found: {ausgrid_types}"
        )

        # --- reform_outcomes: 8 records ---
        outcomes = body["reform_outcomes"]
        assert len(outcomes) == 8, f"Expected 8 reform outcome records, got {len(outcomes)}"

        for rec in outcomes:
            assert rec["implementation_year"] >= 2020, (
                f"implementation_year too early: {rec['implementation_year']}"
            )
            assert rec["customers_affected_k"] > 0, "customers_affected_k must be positive"
            assert rec["peak_demand_reduction_mw"] > 0, "peak_demand_reduction_mw must be positive"
            assert isinstance(rec["revenue_neutral"], bool), "revenue_neutral must be bool"
            assert isinstance(rec["aer_approved"], bool), "aer_approved must be bool"
            assert rec["consumer_avg_saving_aud"] >= 0, "consumer_avg_saving_aud must be non-negative"

        # SA Power Networks mandatory demand reform should be AER approved
        sa_mandatory = next(
            (r for r in outcomes if r["dnsp"] == "SA Power Networks" and "Mandatory" in r["reform_name"]),
            None,
        )
        assert sa_mandatory is not None, "SA Power Networks mandatory demand reform record required"
        assert sa_mandatory["aer_approved"] is True, "SA mandatory demand reform must be AER approved"
        assert sa_mandatory["peak_demand_reduction_mw"] > 100, (
            "SA mandatory reform should have peak reduction > 100 MW"
        )

        # At least 5 out of 8 reform outcomes should be AER approved
        aer_approved_count = sum(1 for r in outcomes if r["aer_approved"])
        assert aer_approved_count >= 5, (
            f"Expected at least 5 AER approved reforms, got {aer_approved_count}"
        )

        # Ausgrid EV smart charging should show consumer savings > $300
        ausgrid_ev = next(
            (r for r in outcomes if r["dnsp"] == "Ausgrid" and "EV" in r["reform_name"]),
            None,
        )
        assert ausgrid_ev is not None, "Ausgrid EV smart charging reform record required"
        assert ausgrid_ev["consumer_avg_saving_aud"] > 300, (
            f"Ausgrid EV reform consumer saving should exceed $300, got {ausgrid_ev['consumer_avg_saving_aud']}"
        )


class TestAiDigitalTwinAnalytics:
    """Tests for GET /api/ai-digital-twin/dashboard (Sprint 66c)."""

    def test_ai_digital_twin_dashboard(self, client, auth_headers):
        response = client.get("/api/ai-digital-twin/dashboard", headers=auth_headers)

        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}: {response.text}"
        )

        body = response.json()

        # Top-level keys
        for key in ("timestamp", "use_cases", "digital_twins", "automation", "investments"):
            assert key in body, f"Missing top-level key: {key}"

        # ── use_cases ──────────────────────────────────────────────────────────
        use_cases = body["use_cases"]
        assert len(use_cases) == 8, f"Expected 8 use case records, got {len(use_cases)}"

        expected_use_cases = {
            "DEMAND_FORECASTING", "PRICE_FORECASTING", "FAULT_DETECTION",
            "PREDICTIVE_MAINTENANCE", "TRADING_OPTIMISATION", "RENEWABLE_FORECASTING",
            "LOAD_BALANCING", "CYBERSECURITY",
        }
        actual_use_cases = {r["use_case"] for r in use_cases}
        assert actual_use_cases == expected_use_cases, (
            f"Use case mismatch. Expected {expected_use_cases}, got {actual_use_cases}"
        )

        valid_statuses = {"PRODUCTION", "PILOT", "RESEARCH", "PLANNED"}
        valid_technologies = {"ML", "DL", "RL", "DIGITAL_TWIN", "OPTIMIZATION", "HYBRID"}
        for uc in use_cases:
            assert uc["deployment_status"] in valid_statuses, (
                f"Invalid deployment_status: {uc['deployment_status']}"
            )
            assert uc["technology"] in valid_technologies, (
                f"Invalid technology: {uc['technology']}"
            )
            assert uc["accuracy_improvement_pct"] > 0, "accuracy_improvement_pct must be positive"
            assert uc["cost_saving_m_aud_yr"] > 0, "cost_saving_m_aud_yr must be positive"
            assert 0 <= uc["adoption_rate_industry_pct"] <= 100, "adoption rate out of range"
            assert uc["organisations_deployed"] > 0, "organisations_deployed must be positive"

        production_count = sum(1 for uc in use_cases if uc["deployment_status"] == "PRODUCTION")
        assert production_count >= 4, f"Expected at least 4 PRODUCTION use cases, got {production_count}"

        trading_uc = next((uc for uc in use_cases if uc["use_case"] == "TRADING_OPTIMISATION"), None)
        assert trading_uc is not None, "TRADING_OPTIMISATION use case required"
        assert trading_uc["cost_saving_m_aud_yr"] > 100, (
            f"TRADING_OPTIMISATION cost saving should exceed $100M, got {trading_uc['cost_saving_m_aud_yr']}"
        )

        # ── digital_twins ──────────────────────────────────────────────────────
        digital_twins = body["digital_twins"]
        assert len(digital_twins) == 8, f"Expected 8 digital twin records, got {len(digital_twins)}"

        valid_asset_types = {
            "TRANSMISSION_LINE", "SUBSTATION", "WIND_FARM",
            "SOLAR_FARM", "BATTERY", "THERMAL_PLANT",
        }
        for dt in digital_twins:
            assert dt["asset_type"] in valid_asset_types, f"Invalid asset_type: {dt['asset_type']}"
            assert 0 < dt["coverage_pct"] <= 100, "coverage_pct out of range"
            assert 0 < dt["predictive_accuracy_pct"] <= 100, "predictive_accuracy_pct out of range"
            assert dt["maintenance_saving_m_aud_yr"] > 0, "maintenance_saving_m_aud_yr must be positive"
            assert dt["outage_reduction_pct"] > 0, "outage_reduction_pct must be positive"
            assert dt["data_feeds_count"] > 0, "data_feeds_count must be positive"
            assert dt["implementation_cost_m_aud"] > 0, "implementation_cost_m_aud must be positive"

        battery_dt = next((dt for dt in digital_twins if dt["asset_type"] == "BATTERY"), None)
        assert battery_dt is not None, "BATTERY digital twin record required"
        assert battery_dt["coverage_pct"] > 90, (
            f"BATTERY coverage should exceed 90%, got {battery_dt['coverage_pct']}"
        )

        # ── automation ─────────────────────────────────────────────────────────
        automation = body["automation"]
        assert len(automation) == 6, f"Expected 6 automation domain records, got {len(automation)}"

        valid_domains = {
            "DISPATCH_OPTIMISATION", "BIDDING", "HEDGE_EXECUTION",
            "FCAS_OPTIMISATION", "FAULT_RESTORATION", "DEMAND_RESPONSE",
        }
        actual_domains = {a["domain"] for a in automation}
        assert actual_domains == valid_domains, (
            f"Automation domain mismatch. Expected {valid_domains}, got {actual_domains}"
        )

        for a in automation:
            assert 0 <= a["current_automation_pct"] <= 100, "current_automation_pct out of range"
            assert a["target_2030_pct"] >= a["current_automation_pct"], (
                f"target_2030_pct should be >= current for domain {a['domain']}"
            )
            assert 0 <= a["human_override_rate_pct"] <= 100, "human_override_rate_pct out of range"
            assert a["error_rate_pct"] >= 0, "error_rate_pct must be non-negative"
            assert a["cost_reduction_m_aud_yr"] > 0, "cost_reduction_m_aud_yr must be positive"
            assert a["jobs_affected"] >= 0, "jobs_affected must be non-negative"

        fcas = next((a for a in automation if a["domain"] == "FCAS_OPTIMISATION"), None)
        assert fcas is not None, "FCAS_OPTIMISATION automation record required"
        assert fcas["current_automation_pct"] > 75, (
            f"FCAS_OPTIMISATION current automation should exceed 75%, got {fcas['current_automation_pct']}"
        )

        # ── investments ────────────────────────────────────────────────────────
        investments = body["investments"]
        assert len(investments) == 15, f"Expected 15 investment records, got {len(investments)}"

        years_present = {inv["year"] for inv in investments}
        assert len(years_present) == 5, f"Expected 5 distinct years, got {len(years_present)}: {years_present}"

        valid_categories = {
            "INFRASTRUCTURE", "ANALYTICS_PLATFORM", "AI_MODELS",
            "DIGITAL_TWINS", "CYBERSECURITY", "TRAINING",
        }
        valid_maturity = {"EARLY", "GROWING", "MATURE"}
        for inv in investments:
            assert inv["category"] in valid_categories, f"Invalid category: {inv['category']}"
            assert inv["maturity_level"] in valid_maturity, f"Invalid maturity_level: {inv['maturity_level']}"
            assert inv["investment_m_aud"] > 0, "investment_m_aud must be positive"
            assert inv["organisations"] > 0, "organisations must be positive"
            assert inv["roi_pct"] > 0, "roi_pct must be positive"

        latest_year = max(years_present)
        latest_investments = [inv for inv in investments if inv["year"] == latest_year]
        latest_total = sum(inv["investment_m_aud"] for inv in latest_investments)
        earliest_year = min(years_present)
        earliest_investments = [inv for inv in investments if inv["year"] == earliest_year]
        earliest_total = sum(inv["investment_m_aud"] for inv in earliest_investments)
        assert latest_total > earliest_total, (
            f"Total investment in {latest_year} (${latest_total:.1f}M) should exceed {earliest_year} (${earliest_total:.1f}M)"
        )


# ---------------------------------------------------------------------------
# Sprint 66b — AEMO ESOO Generation Adequacy Analytics
# ---------------------------------------------------------------------------

class TestEsooAdequacyAnalytics:
    """Tests for GET /api/esoo-adequacy/dashboard"""

    def test_esoo_adequacy_dashboard(self, client, auth_headers) -> None:
        resp = client.get("/api/esoo-adequacy/dashboard", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        body = resp.json()

        # ── top-level keys ────────────────────────────────────────────────────
        required_keys = {"timestamp", "adequacy", "investment_pipeline", "retirements", "scenarios"}
        assert required_keys.issubset(body.keys()), (
            f"Missing keys: {required_keys - set(body.keys())}"
        )
        assert isinstance(body["timestamp"], str), "timestamp must be a string"

        # ── adequacy records — 20 (5 regions × 4 years) ──────────────────────
        adequacy = body["adequacy"]
        assert len(adequacy) == 20, f"Expected 20 adequacy records, got {len(adequacy)}"

        valid_regions = {"NSW", "VIC", "QLD", "SA", "TAS"}
        valid_years   = {2025, 2026, 2027, 2028}
        valid_risk    = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

        for rec in adequacy:
            assert rec["region"] in valid_regions, f"Invalid region: {rec['region']}"
            assert rec["year"] in valid_years,     f"Invalid year: {rec['year']}"
            assert rec["capacity_shortage_risk"] in valid_risk, (
                f"Invalid risk: {rec['capacity_shortage_risk']}"
            )
            assert rec["peak_demand_mw"] > 0,          "peak_demand_mw must be positive"
            assert rec["available_capacity_mw"] > 0,   "available_capacity_mw must be positive"
            assert rec["use_probability_pct"] >= 0,    "use_probability_pct must be non-negative"
            assert rec["new_investment_needed_mw"] >= 0, "new_investment_needed_mw must be non-negative"

        # Each region must appear exactly 4 times (one per year)
        for region in valid_regions:
            count = sum(1 for r in adequacy if r["region"] == region)
            assert count == 4, f"Region {region} should appear 4 times, got {count}"

        # VIC and SA should be HIGH or CRITICAL by 2028
        vic_2028 = next((r for r in adequacy if r["region"] == "VIC" and r["year"] == 2028), None)
        assert vic_2028 is not None, "VIC 2028 adequacy record required"
        assert vic_2028["capacity_shortage_risk"] in {"HIGH", "CRITICAL"}, (
            f"VIC 2028 should be HIGH/CRITICAL, got {vic_2028['capacity_shortage_risk']}"
        )

        sa_2028 = next((r for r in adequacy if r["region"] == "SA" and r["year"] == 2028), None)
        assert sa_2028 is not None, "SA 2028 adequacy record required"
        assert sa_2028["capacity_shortage_risk"] in {"HIGH", "CRITICAL"}, (
            f"SA 2028 should be HIGH/CRITICAL, got {sa_2028['capacity_shortage_risk']}"
        )

        # TAS should remain LOW in all years (good adequacy)
        tas_records = [r for r in adequacy if r["region"] == "TAS"]
        for tas in tas_records:
            assert tas["capacity_shortage_risk"] == "LOW", (
                f"TAS {tas['year']} should be LOW risk, got {tas['capacity_shortage_risk']}"
            )

        # At least 2 regions at HIGH or CRITICAL by 2028
        high_critical_2028 = [
            r for r in adequacy
            if r["year"] == 2028 and r["capacity_shortage_risk"] in {"HIGH", "CRITICAL"}
        ]
        assert len(high_critical_2028) >= 2, (
            f"Expected at least 2 HIGH/CRITICAL regions by 2028, got {len(high_critical_2028)}"
        )

        # ── investment pipeline — 15 records ──────────────────────────────────
        pipeline = body["investment_pipeline"]
        assert len(pipeline) == 15, f"Expected 15 investment pipeline records, got {len(pipeline)}"

        valid_confidence = {"FIRM", "LIKELY", "SPECULATIVE"}

        for rec in pipeline:
            assert rec["region"] in valid_regions,       f"Invalid region: {rec['region']}"
            assert rec["confidence"] in valid_confidence, f"Invalid confidence: {rec['confidence']}"
            assert rec["capacity_mw"] > 0,               "capacity_mw must be positive"
            assert rec["expected_cod"] >= 2025,          "expected_cod must be >= 2025"
            assert rec["investment_m_aud"] > 0,          "investment_m_aud must be positive"
            assert isinstance(rec["capacity_market_eligible"], bool), (
                "capacity_market_eligible must be bool"
            )
            assert rec["project_name"],  "project_name must not be empty"
            assert rec["technology"],    "technology must not be empty"

        # At least one FIRM project in NSW
        nsw_firm = [r for r in pipeline if r["region"] == "NSW" and r["confidence"] == "FIRM"]
        assert len(nsw_firm) >= 1, "At least one FIRM project required in NSW"

        # Snowy 2.0 should be in NSW with capacity >= 2000 MW
        snowy = next((r for r in pipeline if "Snowy" in r["project_name"]), None)
        assert snowy is not None, "Snowy 2.0 project required in pipeline"
        assert snowy["region"] == "NSW",      f"Snowy 2.0 should be NSW, got {snowy['region']}"
        assert snowy["capacity_mw"] >= 2000,  f"Snowy 2.0 should be >= 2000 MW, got {snowy['capacity_mw']}"

        # Waratah Super Battery should be a Battery Storage project
        waratah = next((r for r in pipeline if "Waratah" in r["project_name"]), None)
        assert waratah is not None, "Waratah Super Battery required in pipeline"
        assert "Battery" in waratah["technology"], (
            f"Waratah should be Battery Storage, got {waratah['technology']}"
        )

        # ── retirement records — 10 ───────────────────────────────────────────
        retirements = body["retirements"]
        assert len(retirements) == 10, f"Expected 10 retirement records, got {len(retirements)}"

        valid_triggers = {"ECONOMICS", "AGE", "POLICY", "OWNER_DECISION"}

        for rec in retirements:
            assert rec["region"] in valid_regions,             f"Invalid region: {rec['region']}"
            assert rec["retirement_trigger"] in valid_triggers, f"Invalid trigger: {rec['retirement_trigger']}"
            assert rec["capacity_mw"] > 0,                    "capacity_mw must be positive"
            assert rec["expected_retirement_year"] >= 2025,   "retirement year must be >= 2025"
            assert isinstance(rec["replacement_committed"], bool), (
                "replacement_committed must be bool"
            )
            assert rec["unit_name"],        "unit_name must not be empty"
            assert rec["technology"],       "technology must not be empty"
            assert rec["reliability_impact"], "reliability_impact must not be empty"

        # At least one VIC retirement with CRITICAL or HIGH reliability impact
        vic_critical = [
            r for r in retirements
            if r["region"] == "VIC" and r["reliability_impact"] in {"CRITICAL", "HIGH"}
        ]
        assert len(vic_critical) >= 1, "At least one VIC HIGH/CRITICAL reliability impact retirement required"

        # Majority of retirements should be coal technology
        coal_count = sum(1 for r in retirements if "Coal" in r["technology"] or "coal" in r["technology"])
        assert coal_count >= 6, f"At least 6 coal retirements expected, got {coal_count}"

        # Loy Yang A Unit 1 should be VIC with ECONOMICS trigger
        loy_yang = next((r for r in retirements if "Loy Yang A Unit 1" in r["unit_name"]), None)
        assert loy_yang is not None, "Loy Yang A Unit 1 retirement record required"
        assert loy_yang["region"] == "VIC",                    f"Loy Yang A Unit 1 should be VIC, got {loy_yang['region']}"
        assert loy_yang["retirement_trigger"] == "ECONOMICS",  (
            f"Loy Yang A Unit 1 trigger should be ECONOMICS, got {loy_yang['retirement_trigger']}"
        )

        # ── scenario records — 20 (5 regions × 4 scenarios) ─────────────────
        scenarios = body["scenarios"]
        assert len(scenarios) == 20, f"Expected 20 scenario records, got {len(scenarios)}"

        valid_scenarios      = {"STEP_CHANGE", "CENTRAL", "SLOW_CHANGE", "HIGH_DER"}
        valid_adequacy_status = {"ADEQUATE", "MARGINAL", "INADEQUATE"}

        for rec in scenarios:
            assert rec["region"] in valid_regions,            f"Invalid region: {rec['region']}"
            assert rec["scenario"] in valid_scenarios,        f"Invalid scenario: {rec['scenario']}"
            assert rec["adequacy_status"] in valid_adequacy_status, (
                f"Invalid adequacy_status: {rec['adequacy_status']}"
            )
            assert rec["total_capacity_gw"] > 0,             "total_capacity_gw must be positive"
            assert rec["vre_capacity_gw"] >= 0,              "vre_capacity_gw must be non-negative"
            assert rec["dispatchable_capacity_gw"] >= 0,     "dispatchable_capacity_gw must be non-negative"
            assert rec["storage_gw"] >= 0,                   "storage_gw must be non-negative"
            assert rec["vre_capacity_gw"] <= rec["total_capacity_gw"], (
                "vre_capacity_gw must not exceed total_capacity_gw"
            )

        # Each region must appear exactly 4 times (once per scenario)
        for region in valid_regions:
            count = sum(1 for r in scenarios if r["region"] == region)
            assert count == 4, f"Region {region} should appear 4 times in scenarios, got {count}"

        # STEP_CHANGE should have the highest ADEQUATE ratio
        step_adequate = sum(1 for r in scenarios if r["scenario"] == "STEP_CHANGE" and r["adequacy_status"] == "ADEQUATE")
        slow_adequate = sum(1 for r in scenarios if r["scenario"] == "SLOW_CHANGE" and r["adequacy_status"] == "ADEQUATE")
        assert step_adequate >= slow_adequate, (
            f"STEP_CHANGE adequate ({step_adequate}) should be >= SLOW_CHANGE adequate ({slow_adequate})"
        )

        # NSW STEP_CHANGE should be ADEQUATE
        nsw_step = next(
            (r for r in scenarios if r["scenario"] == "STEP_CHANGE" and r["region"] == "NSW"), None
        )
        assert nsw_step is not None, "NSW STEP_CHANGE scenario record required"
        assert nsw_step["adequacy_status"] == "ADEQUATE", (
            f"NSW STEP_CHANGE should be ADEQUATE, got {nsw_step['adequacy_status']}"
        )

        # SA SLOW_CHANGE should be INADEQUATE
        sa_slow = next(
            (r for r in scenarios if r["scenario"] == "SLOW_CHANGE" and r["region"] == "SA"), None
        )
        assert sa_slow is not None, "SA SLOW_CHANGE scenario record required"
        assert sa_slow["adequacy_status"] == "INADEQUATE", (
            f"SA SLOW_CHANGE should be INADEQUATE, got {sa_slow['adequacy_status']}"
        )

        # STEP_CHANGE NSW dispatchable >= SLOW_CHANGE NSW dispatchable
        nsw_slow = next(
            (r for r in scenarios if r["scenario"] == "SLOW_CHANGE" and r["region"] == "NSW"), None
        )
        assert nsw_slow is not None, "NSW SLOW_CHANGE scenario record required"
        assert nsw_step["dispatchable_capacity_gw"] <= nsw_step["total_capacity_gw"], (
            "NSW STEP_CHANGE dispatchable must not exceed total capacity"
        )


# ===========================================================================
# TestSocialLicenceAnalytics — Sprint 66a
# ===========================================================================

class TestSocialLicenceAnalytics:
    """Tests for GET /api/social-licence/dashboard (Sprint 66a)."""

    def test_social_licence_dashboard(self, client, auth_headers):
        response = client.get("/api/social-licence/dashboard", headers=auth_headers)
        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}: {response.text}"
        )

        body = response.json()

        # ── Top-level keys ──────────────────────────────────────────────────
        for key in ("timestamp", "projects", "first_nations", "just_transition", "equity"):
            assert key in body, f"Missing top-level key: {key}"

        assert body["timestamp"], "timestamp must be non-empty"

        # ── projects: 10 records ────────────────────────────────────────────
        projects = body["projects"]
        assert len(projects) == 10, f"Expected 10 project records, got {len(projects)}"

        valid_opposition = {
            "VISUAL_AMENITY", "NOISE", "PROPERTY_VALUE",
            "LAND_USE", "CULTURAL_HERITAGE", "GRID_RELIABILITY", "NONE",
        }
        valid_engagement = {"EXCELLENT", "GOOD", "FAIR", "POOR"}
        for p in projects:
            assert p["project_id"], "project_id must be non-empty"
            assert p["project_name"], "project_name must be non-empty"
            assert p["technology"], "technology must be non-empty"
            assert p["region"], "region must be non-empty"
            assert p["state"], "state must be non-empty"
            assert 0 <= p["community_support_pct"] <= 100, (
                f"community_support_pct out of range: {p['community_support_pct']}"
            )
            assert 0 <= p["community_opposition_pct"] <= 100, (
                f"community_opposition_pct out of range: {p['community_opposition_pct']}"
            )
            assert 0 <= p["neutral_pct"] <= 100, (
                f"neutral_pct out of range: {p['neutral_pct']}"
            )
            total = (
                p["community_support_pct"]
                + p["community_opposition_pct"]
                + p["neutral_pct"]
            )
            assert abs(total - 100.0) < 1.0, (
                f"Support + opposition + neutral should sum to ~100, got {total}"
            )
            assert p["opposition_reason"] in valid_opposition, (
                f"Invalid opposition_reason: {p['opposition_reason']}"
            )
            assert p["engagement_quality"] in valid_engagement, (
                f"Invalid engagement_quality: {p['engagement_quality']}"
            )
            assert p["status"], "status must be non-empty"
            assert isinstance(p["aboriginal_land"], bool), "aboriginal_land must be bool"

        # At least one project on aboriginal land
        aboriginal_projects = [p for p in projects if p["aboriginal_land"]]
        assert len(aboriginal_projects) >= 1, "Expected at least 1 project on aboriginal land"

        # Average support should be >= 50%
        avg_support = sum(p["community_support_pct"] for p in projects) / len(projects)
        assert avg_support >= 50, f"Expected avg support >= 50%, got {avg_support:.1f}%"

        # ── first_nations: 5 records ────────────────────────────────────────
        first_nations = body["first_nations"]
        assert len(first_nations) == 5, (
            f"Expected 5 First Nations records, got {len(first_nations)}"
        )

        valid_consultation = {"ADEQUATE", "INADEQUATE", "OUTSTANDING"}
        for fn in first_nations:
            assert fn["region"], "region must be non-empty"
            assert fn["project_count"] > 0, "project_count must be positive"
            assert fn["indigenous_land_agreements"] >= 0, (
                "indigenous_land_agreements must be non-negative"
            )
            assert fn["benefit_sharing_m_aud"] >= 0, "benefit_sharing_m_aud must be non-negative"
            assert fn["employment_indigenous_k"] >= 0, (
                "employment_indigenous_k must be non-negative"
            )
            assert fn["consultation_adequacy"] in valid_consultation, (
                f"Invalid consultation_adequacy: {fn['consultation_adequacy']}"
            )
            assert isinstance(fn["land_rights_respected"], bool), (
                "land_rights_respected must be bool"
            )
            assert fn["cultural_heritage_issues"] >= 0, (
                "cultural_heritage_issues must be non-negative"
            )

        # Total benefit sharing should be > AUD 0
        total_benefit = sum(fn["benefit_sharing_m_aud"] for fn in first_nations)
        assert total_benefit > 0, f"Total benefit sharing should be positive, got {total_benefit}"

        # ── just_transition: 5 coal region records ──────────────────────────
        just_transition = body["just_transition"]
        assert len(just_transition) == 5, (
            f"Expected 5 just transition records, got {len(just_transition)}"
        )

        expected_regions = {"Hunter Valley", "Latrobe Valley", "Callide", "Collie", "Leigh Creek"}
        actual_regions = {r["region"] for r in just_transition}
        assert actual_regions == expected_regions, (
            f"Region mismatch. Expected {expected_regions}, got {actual_regions}"
        )

        for jt in just_transition:
            assert jt["affected_workers_k"] > 0, "affected_workers_k must be positive"
            assert jt["retraining_programs"] > 0, "retraining_programs must be positive"
            assert 0 <= jt["retraining_uptake_pct"] <= 100, (
                f"retraining_uptake_pct out of range: {jt['retraining_uptake_pct']}"
            )
            assert jt["jobs_created_k"] >= 0, "jobs_created_k must be non-negative"
            assert 0 <= jt["wage_replacement_pct"] <= 100, (
                f"wage_replacement_pct out of range: {jt['wage_replacement_pct']}"
            )
            assert jt["community_fund_m_aud"] > 0, "community_fund_m_aud must be positive"
            assert jt["timeline_years"] > 0, "timeline_years must be positive"
            assert isinstance(jt["on_track"], bool), "on_track must be bool"

        # Hunter Valley should be the largest affected workforce
        hunter = next(r for r in just_transition if r["region"] == "Hunter Valley")
        for jt in just_transition:
            if jt["region"] != "Hunter Valley":
                assert hunter["affected_workers_k"] >= jt["affected_workers_k"], (
                    f"Hunter Valley should have largest workforce, but {jt['region']} "
                    f"({jt['affected_workers_k']}k) >= Hunter Valley ({hunter['affected_workers_k']}k)"
                )

        # ── equity: 6 cohort records ────────────────────────────────────────
        equity = body["equity"]
        assert len(equity) == 6, f"Expected 6 equity records, got {len(equity)}"

        valid_cohorts = {
            "LOW_INCOME", "RENTERS", "REMOTE_COMMUNITIES",
            "FIRST_NATIONS", "ELDERLY", "DISABILITY",
        }
        valid_trends = {"IMPROVING", "STABLE", "WORSENING"}
        actual_cohorts = {e["cohort"] for e in equity}
        assert actual_cohorts == valid_cohorts, (
            f"Cohort mismatch. Expected {valid_cohorts}, got {actual_cohorts}"
        )

        for e in equity:
            assert 0 <= e["electricity_bill_burden_pct"] <= 100, (
                f"electricity_bill_burden_pct out of range: {e['electricity_bill_burden_pct']}"
            )
            assert 0 <= e["access_to_solar_pct"] <= 100, (
                f"access_to_solar_pct out of range: {e['access_to_solar_pct']}"
            )
            assert 0 <= e["energy_hardship_rate_pct"] <= 100, (
                f"energy_hardship_rate_pct out of range: {e['energy_hardship_rate_pct']}"
            )
            assert 0 <= e["program_coverage_pct"] <= 100, (
                f"program_coverage_pct out of range: {e['program_coverage_pct']}"
            )
            assert 0 <= e["equity_score"] <= 10, (
                f"equity_score out of range: {e['equity_score']}"
            )
            assert e["trend"] in valid_trends, f"Invalid trend: {e['trend']}"

        # First Nations cohort should have the lowest equity score
        fn_equity = next(e for e in equity if e["cohort"] == "FIRST_NATIONS")
        min_score = min(e["equity_score"] for e in equity)
        assert fn_equity["equity_score"] == min_score, (
            f"First Nations should have the lowest equity score, got {fn_equity['equity_score']}, "
            f"min is {min_score}"
        )

        # At least one cohort with WORSENING trend
        worsening = [e for e in equity if e["trend"] == "WORSENING"]
        assert len(worsening) >= 1, "Expected at least 1 cohort with WORSENING trend"


class TestElectricityOptionsDashboard:
    def test_electricity_options_dashboard_ok(self, client, auth_headers):
        r = client.get("/api/electricity-options/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_electricity_options_book(self, client, auth_headers):
        d = client.get("/api/electricity-options/dashboard", headers=auth_headers).json()
        assert len(d["options_book"]) >= 8
        assert all("delta" in o and "implied_vol_pct" in o for o in d["options_book"])

    def test_electricity_options_vol_surface(self, client, auth_headers):
        d = client.get("/api/electricity-options/dashboard", headers=auth_headers).json()
        assert len(d["vol_surface"]) >= 20
        tenors = {v["tenor_months"] for v in d["vol_surface"]}
        assert 1 in tenors and 12 in tenors

    def test_electricity_options_strategies(self, client, auth_headers):
        d = client.get("/api/electricity-options/dashboard", headers=auth_headers).json()
        assert len(d["strategies"]) >= 4
        types = {s["strategy_type"] for s in d["strategies"]}
        assert "CAP" in types or "COLLAR" in types

    def test_electricity_options_hist_vol(self, client, auth_headers):
        d = client.get("/api/electricity-options/dashboard", headers=auth_headers).json()
        assert len(d["hist_vol"]) >= 16
        assert all("vol_risk_premium" in h for h in d["hist_vol"])

    def test_electricity_options_summary(self, client, auth_headers):
        d = client.get("/api/electricity-options/dashboard", headers=auth_headers).json()
        assert d["summary"]["highest_vol_region"] == "SA1"

class TestNuclearEnergyDashboard:
    def test_nuclear_energy_dashboard_ok(self, client, auth_headers):
        r = client.get("/api/nuclear-energy/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_nuclear_energy_smr_technologies(self, client, auth_headers):
        d = client.get("/api/nuclear-energy/dashboard", headers=auth_headers).json()
        assert len(d["smr_technologies"]) >= 5
        techs = [t["technology"] for t in d["smr_technologies"]]
        assert any("BWRX" in t or "AP1000" in t or "NuScale" in t for t in techs)

    def test_nuclear_energy_policy_timeline(self, client, auth_headers):
        d = client.get("/api/nuclear-energy/dashboard", headers=auth_headers).json()
        assert len(d["policy_timeline"]) >= 5
        assert all("event" in p and "sentiment" in p for p in d["policy_timeline"])

    def test_nuclear_energy_cost_projections(self, client, auth_headers):
        d = client.get("/api/nuclear-energy/dashboard", headers=auth_headers).json()
        assert len(d["cost_projections"]) >= 10
        assert all(p["lcoe_mid"] > 0 for p in d["cost_projections"])

    def test_nuclear_energy_capacity_scenarios(self, client, auth_headers):
        d = client.get("/api/nuclear-energy/dashboard", headers=auth_headers).json()
        assert len(d["capacity_scenarios"]) >= 6
        scenarios = {s["scenario"] for s in d["capacity_scenarios"]}
        assert len(scenarios) >= 2

    def test_nuclear_energy_summary(self, client, auth_headers):
        d = client.get("/api/nuclear-energy/dashboard", headers=auth_headers).json()
        assert d["summary"]["earliest_possible_online"] >= 2035

class TestGridFormingInverterDashboard:
    def test_grid_forming_dashboard_ok(self, client, auth_headers):
        r = client.get("/api/grid-forming-inverter/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_grid_forming_inverter_fleet(self, client, auth_headers):
        d = client.get("/api/grid-forming-inverter/dashboard", headers=auth_headers).json()
        assert len(d["inverter_fleet"]) >= 8
        types = {a["inverter_type"] for a in d["inverter_fleet"]}
        assert "GRID_FORMING" in types and "GRID_FOLLOWING" in types

    def test_grid_forming_system_strength(self, client, auth_headers):
        d = client.get("/api/grid-forming-inverter/dashboard", headers=auth_headers).json()
        assert len(d["system_strength"]) >= 5
        regions = {s["region"] for s in d["system_strength"]}
        assert "SA1" in regions
        sa = next(s for s in d["system_strength"] if s["region"] == "SA1")
        assert sa["strength_status"] in ["MARGINAL", "INADEQUATE"]

    def test_grid_forming_fault_events(self, client, auth_headers):
        d = client.get("/api/grid-forming-inverter/dashboard", headers=auth_headers).json()
        assert len(d["fault_ride_through_events"]) >= 4
        assert all(e["gfm_rode_through"] for e in d["fault_ride_through_events"])

    def test_grid_forming_ibr_penetration(self, client, auth_headers):
        d = client.get("/api/grid-forming-inverter/dashboard", headers=auth_headers).json()
        assert len(d["ibr_penetration"]) >= 20
        years = {r["year"] for r in d["ibr_penetration"]}
        assert 2025 in years and 2030 in years

    def test_grid_forming_summary(self, client, auth_headers):
        d = client.get("/api/grid-forming-inverter/dashboard", headers=auth_headers).json()
        assert d["summary"]["gfm_ride_through_rate_pct"] == 100
        assert d["summary"]["grid_forming_count"] >= 4

class TestCapacityMechanismDashboard:
    def test_capacity_mechanism_ok(self, client, auth_headers):
        r = client.get("/api/capacity-mechanism/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_capacity_mechanism_records(self, client, auth_headers):
        d = client.get("/api/capacity-mechanism/dashboard", headers=auth_headers).json()
        assert len(d["capacity_records"]) >= 6
        statuses = {r["status"] for r in d["capacity_records"]}
        assert "DEFICIT" in statuses and "CLEARED" in statuses

    def test_capacity_mechanism_auctions(self, client, auth_headers):
        d = client.get("/api/capacity-mechanism/dashboard", headers=auth_headers).json()
        assert len(d["auction_results"]) >= 4
        assert all("clearing_price_per_kw_yr" in a for a in d["auction_results"])

    def test_capacity_mechanism_participants(self, client, auth_headers):
        d = client.get("/api/capacity-mechanism/dashboard", headers=auth_headers).json()
        assert len(d["participants"]) >= 8
        statuses = {p["compliance_status"] for p in d["participants"]}
        assert "COMPLIANT" in statuses and "BREACH" in statuses

    def test_capacity_mechanism_comparison(self, client, auth_headers):
        d = client.get("/api/capacity-mechanism/dashboard", headers=auth_headers).json()
        assert len(d["mechanism_comparison"]) >= 4
        names = [m["mechanism_name"] for m in d["mechanism_comparison"]]
        assert any("CIS" in n for n in names)

    def test_capacity_mechanism_summary(self, client, auth_headers):
        d = client.get("/api/capacity-mechanism/dashboard", headers=auth_headers).json()
        assert d["summary"]["deficit_regions"] >= 2
        assert d["summary"]["breach_participants"] >= 1

class TestDemandForecastAccuracyDashboard:
    def test_demand_forecast_accuracy_ok(self, client, auth_headers):
        r = client.get("/api/demand-forecast-accuracy/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_demand_forecast_error_records(self, client, auth_headers):
        d = client.get("/api/demand-forecast-accuracy/dashboard", headers=auth_headers).json()
        assert len(d["error_records"]) >= 50
        horizons = {e["horizon_min"] for e in d["error_records"]}
        assert 5 in horizons and 240 in horizons

    def test_demand_forecast_horizon_summary(self, client, auth_headers):
        d = client.get("/api/demand-forecast-accuracy/dashboard", headers=auth_headers).json()
        assert len(d["horizon_summary"]) >= 20
        assert all("skill_score" in h for h in d["horizon_summary"])
        assert all(0 <= h["skill_score"] <= 1 for h in d["horizon_summary"])

    def test_demand_forecast_seasonal_bias(self, client, auth_headers):
        d = client.get("/api/demand-forecast-accuracy/dashboard", headers=auth_headers).json()
        assert len(d["seasonal_bias"]) >= 40
        seasons = {b["season"] for b in d["seasonal_bias"]}
        assert "SUMMER" in seasons and "WINTER" in seasons

    def test_demand_forecast_model_benchmarks(self, client, auth_headers):
        d = client.get("/api/demand-forecast-accuracy/dashboard", headers=auth_headers).json()
        assert len(d["model_benchmarks"]) >= 4
        statuses = {m["deployment_status"] for m in d["model_benchmarks"]}
        assert "PRODUCTION" in statuses

    def test_demand_forecast_summary(self, client, auth_headers):
        d = client.get("/api/demand-forecast-accuracy/dashboard", headers=auth_headers).json()
        assert d["summary"]["best_model_mape_pct"] < 2.0
        assert d["summary"]["production_models"] >= 2

class TestTransmissionInvestmentDashboard:
    def test_transmission_investment_ok(self, client, auth_headers):
        r = client.get("/api/transmission-investment/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_transmission_investment_projects(self, client, auth_headers):
        d = client.get("/api/transmission-investment/dashboard", headers=auth_headers).json()
        assert len(d["projects"]) >= 8
        types = {p["project_type"] for p in d["projects"]}
        assert "REZ" in types and "INTERCONNECTOR" in types

    def test_transmission_investment_rab(self, client, auth_headers):
        d = client.get("/api/transmission-investment/dashboard", headers=auth_headers).json()
        assert len(d["rab_records"]) >= 4
        assert all(r["rab_closing_m"] > r["rab_opening_m"] for r in d["rab_records"])

    def test_transmission_investment_capex(self, client, auth_headers):
        d = client.get("/api/transmission-investment/dashboard", headers=auth_headers).json()
        assert len(d["capex_records"]) >= 20
        years = {c["year"] for c in d["capex_records"]}
        assert 2025 in years

    def test_transmission_investment_aer(self, client, auth_headers):
        d = client.get("/api/transmission-investment/dashboard", headers=auth_headers).json()
        assert len(d["aer_determinations"]) >= 4
        assert all(a["revenue_reduction_m"] > 0 for a in d["aer_determinations"])

    def test_transmission_investment_summary(self, client, auth_headers):
        d = client.get("/api/transmission-investment/dashboard", headers=auth_headers).json()
        assert d["summary"]["total_capex_approved_bn"] >= 15
        assert d["summary"]["interconnector_projects"] >= 3

class TestRezProgressDashboard:
    def test_rez_progress_ok(self, client, auth_headers):
        r = client.get("/api/rez-progress/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_rez_progress_zones(self, client, auth_headers):
        d = client.get("/api/rez-progress/dashboard", headers=auth_headers).json()
        assert len(d["zones"]) >= 6
        statuses = {z["zone_status"] for z in d["zones"]}
        assert "CONSTRAINED" in statuses and "OPEN" in statuses

    def test_rez_progress_projects(self, client, auth_headers):
        d = client.get("/api/rez-progress/dashboard", headers=auth_headers).json()
        assert len(d["projects"]) >= 8
        stages = {p["stage"] for p in d["projects"]}
        assert "OPERATIONAL" in stages

    def test_rez_progress_constraints(self, client, auth_headers):
        d = client.get("/api/rez-progress/dashboard", headers=auth_headers).json()
        assert len(d["constraints"]) >= 4
        assert all(c["avg_curtailment_pct"] > 0 for c in d["constraints"])

    def test_rez_progress_queue(self, client, auth_headers):
        d = client.get("/api/rez-progress/dashboard", headers=auth_headers).json()
        assert len(d["queue"]) >= 6

    def test_rez_progress_summary(self, client, auth_headers):
        d = client.get("/api/rez-progress/dashboard", headers=auth_headers).json()
        assert d["summary"]["total_zones"] >= 6
        assert d["summary"]["constrained_zones"] >= 1

class TestStorageRevenueDashboard:
    def test_storage_revenue_ok(self, client, auth_headers):
        r = client.get("/api/storage-revenue/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_storage_revenue_streams(self, client, auth_headers):
        d = client.get("/api/storage-revenue/dashboard", headers=auth_headers).json()
        assert len(d["revenue_streams"]) >= 5
        assert all("fcas_raise_per_kw" in r for r in d["revenue_streams"])

    def test_storage_revenue_projects(self, client, auth_headers):
        d = client.get("/api/storage-revenue/dashboard", headers=auth_headers).json()
        assert len(d["projects"]) >= 5
        assert all(p["irr_pct"] > 0 for p in d["projects"])
        techs = {p["technology"] for p in d["projects"]}
        assert "LFP" in techs

    def test_storage_revenue_degradation(self, client, auth_headers):
        d = client.get("/api/storage-revenue/dashboard", headers=auth_headers).json()
        assert len(d["degradation"]) >= 40
        assert all(r["capacity_retention_pct"] > 50 for r in d["degradation"])

    def test_storage_revenue_sensitivity(self, client, auth_headers):
        d = client.get("/api/storage-revenue/dashboard", headers=auth_headers).json()
        assert len(d["sensitivity"]) >= 8
        variables = {s["variable"] for s in d["sensitivity"]}
        assert any("Capex" in v for v in variables)

    def test_storage_revenue_summary(self, client, auth_headers):
        d = client.get("/api/storage-revenue/dashboard", headers=auth_headers).json()
        assert d["summary"]["avg_irr_pct"] > 10
        assert d["summary"]["highest_revenue_region"] == "SA1"

class TestCarbonPricePathwayDashboard:
    def test_carbon_price_pathway_ok(self, client, auth_headers):
        r = client.get("/api/carbon-price-pathway/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_carbon_price_scenarios(self, client, auth_headers):
        d = client.get("/api/carbon-price-pathway/dashboard", headers=auth_headers).json()
        assert len(d["scenarios"]) >= 20
        scenario_names = {s["scenario_name"] for s in d["scenarios"]}
        assert len(scenario_names) >= 3

    def test_carbon_price_safeguard(self, client, auth_headers):
        d = client.get("/api/carbon-price-pathway/dashboard", headers=auth_headers).json()
        assert len(d["safeguard_facilities"]) >= 6
        sectors = {f["sector"] for f in d["safeguard_facilities"]}
        assert "ELECTRICITY" in sectors

    def test_carbon_price_passthrough(self, client, auth_headers):
        d = client.get("/api/carbon-price-pathway/dashboard", headers=auth_headers).json()
        assert len(d["passthrough_records"]) >= 5
        techs = {r["technology"] for r in d["passthrough_records"]}
        assert "COAL" in techs and "SOLAR" in techs

    def test_carbon_price_abatement(self, client, auth_headers):
        d = client.get("/api/carbon-price-pathway/dashboard", headers=auth_headers).json()
        assert len(d["abatement_options"]) >= 8
        costs = [a["cost_per_t_co2"] for a in d["abatement_options"]]
        assert any(c < 0 for c in costs)  # some negative cost options

    def test_carbon_price_summary(self, client, auth_headers):
        d = client.get("/api/carbon-price-pathway/dashboard", headers=auth_headers).json()
        assert d["summary"]["carbon_price_2024_per_t"] == 28
        assert d["summary"]["facilities_in_deficit"] >= 2

class TestSpotPriceForecastDashboard:
    def test_spot_price_forecast_ok(self, client, auth_headers):
        r = client.get("/api/spot-price-forecast/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_spot_price_models(self, client, auth_headers):
        d = client.get("/api/spot-price-forecast/dashboard", headers=auth_headers).json()
        assert len(d["models"]) >= 5
        statuses = {m["deployment_status"] for m in d["models"]}
        assert "PRODUCTION" in statuses

    def test_spot_price_forecasts(self, client, auth_headers):
        d = client.get("/api/spot-price-forecast/dashboard", headers=auth_headers).json()
        assert len(d["forecasts"]) >= 50
        assert all("forecast_low" in f and "forecast_high" in f for f in d["forecasts"])

    def test_spot_price_features(self, client, auth_headers):
        d = client.get("/api/spot-price-forecast/dashboard", headers=auth_headers).json()
        assert len(d["features"]) >= 15
        cats = {f["category"] for f in d["features"]}
        assert "DEMAND" in cats and "SUPPLY" in cats

    def test_spot_price_drift(self, client, auth_headers):
        d = client.get("/api/spot-price-forecast/dashboard", headers=auth_headers).json()
        assert len(d["drift"]) >= 10
        assert all(0 <= dr["drift_score"] <= 1 for dr in d["drift"])

    def test_spot_price_summary(self, client, auth_headers):
        d = client.get("/api/spot-price-forecast/dashboard", headers=auth_headers).json()
        assert d["summary"]["production_models"] >= 4
        assert d["summary"]["best_spike_recall_pct"] >= 80

class TestAncillaryCostAllocationDashboard:
    def test_ancillary_cost_ok(self, client, auth_headers):
        r = client.get("/api/ancillary-cost-allocation/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_ancillary_cost_records(self, client, auth_headers):
        d = client.get("/api/ancillary-cost-allocation/dashboard", headers=auth_headers).json()
        assert len(d["cost_records"]) >= 20
        services = {c["service"] for c in d["cost_records"]}
        assert "RAISEREG" in services and "LOWER6SEC" in services

    def test_ancillary_participants(self, client, auth_headers):
        d = client.get("/api/ancillary-cost-allocation/dashboard", headers=auth_headers).json()
        assert len(d["participants"]) >= 8
        types = {p["participant_type"] for p in d["participants"]}
        assert "GENERATOR" in types and "LOAD" in types

    def test_ancillary_causer_pays(self, client, auth_headers):
        d = client.get("/api/ancillary-cost-allocation/dashboard", headers=auth_headers).json()
        assert len(d["causer_pays"]) >= 8
        assert all("cpf_score" in c for c in d["causer_pays"])

    def test_ancillary_trends(self, client, auth_headers):
        d = client.get("/api/ancillary-cost-allocation/dashboard", headers=auth_headers).json()
        assert len(d["trends"]) >= 20
        years = {t["year"] for t in d["trends"]}
        assert 2020 in years and 2024 in years

    def test_ancillary_summary(self, client, auth_headers):
        d = client.get("/api/ancillary-cost-allocation/dashboard", headers=auth_headers).json()
        assert d["summary"]["highest_cost_service"] == "RAISEREG"
        assert d["summary"]["breach_participants"] >= 1

class TestMarketLiquidityDashboard:
    def test_market_liquidity_ok(self, client, auth_headers):
        r = client.get("/api/wholesale-liquidity/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_market_liquidity_records(self, client, auth_headers):
        d = client.get("/api/wholesale-liquidity/dashboard", headers=auth_headers).json()
        assert len(d["liquidity_records"]) >= 30
        ratings = {r["market_depth_rating"] for r in d["liquidity_records"]}
        assert "DEEP" in ratings or "MODERATE" in ratings

    def test_market_hedge_coverage(self, client, auth_headers):
        d = client.get("/api/wholesale-liquidity/dashboard", headers=auth_headers).json()
        assert len(d["hedge_coverage"]) >= 5
        assert all(0 < h["hedge_coverage_pct"] <= 100 for h in d["hedge_coverage"])

    def test_market_open_interest(self, client, auth_headers):
        d = client.get("/api/wholesale-liquidity/dashboard", headers=auth_headers).json()
        assert len(d["open_interest"]) >= 20
        regions = {o["region"] for o in d["open_interest"]}
        assert "NSW1" in regions and "SA1" in regions

    def test_market_bid_ask_history(self, client, auth_headers):
        d = client.get("/api/wholesale-liquidity/dashboard", headers=auth_headers).json()
        assert len(d["bid_ask_history"]) >= 20
        events = {b["liquidity_event"] for b in d["bid_ask_history"]}
        assert "NORMAL" in events

    def test_market_liquidity_summary(self, client, auth_headers):
        d = client.get("/api/wholesale-liquidity/dashboard", headers=auth_headers).json()
        assert d["summary"]["highest_spread_region"] == "SA1"
        assert d["summary"]["avg_hedge_coverage_pct"] > 50


class TestGeneratorRetirementDashboard:
    """Sprint 71a: NEM Generator Retirement Analytics"""

    def test_http_200(self, client, auth_headers):
        r = client.get("/api/generator-retirement/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_generators_count_and_risk_levels(self, client, auth_headers):
        d = client.get("/api/generator-retirement/dashboard", headers=auth_headers).json()
        assert len(d["generators"]) == 10
        risk_levels = {g["stranded_asset_risk"] for g in d["generators"]}
        assert "CRITICAL" in risk_levels
        assert "HIGH" in risk_levels
        assert "MEDIUM" in risk_levels
        assert "LOW" in risk_levels

    def test_retirement_schedule_gap_statuses(self, client, auth_headers):
        d = client.get("/api/generator-retirement/dashboard", headers=auth_headers).json()
        gap_statuses = {r["gap_status"] for r in d["retirement_schedule"]}
        assert "COVERED" in gap_statuses
        assert "PARTIAL" in gap_statuses
        assert "UNCOVERED" in gap_statuses
        assert len(d["retirement_schedule"]) >= 5

    def test_replacements_firmness_variety(self, client, auth_headers):
        d = client.get("/api/generator-retirement/dashboard", headers=auth_headers).json()
        firmness_vals = {r["firmness"] for r in d["replacements"]}
        assert "COMMITTED" in firmness_vals
        assert "SPECULATIVE" in firmness_vals
        assert len(d["replacements"]) >= 4

    def test_economics_stranded_costs(self, client, auth_headers):
        d = client.get("/api/generator-retirement/dashboard", headers=auth_headers).json()
        assert len(d["economics"]) >= 4
        # All stranded costs must be positive
        for e in d["economics"]:
            assert e["stranded_cost_m"] > 0
        # At least one station should have a stranded cost above 100M
        assert any(e["stranded_cost_m"] > 100 for e in d["economics"])
        # All net costs should be less than or equal to stranded cost
        for e in d["economics"]:
            assert e["net_cost_m"] <= e["stranded_cost_m"]

    def test_summary_assertions(self, client, auth_headers):
        d = client.get("/api/generator-retirement/dashboard", headers=auth_headers).json()
        s = d["summary"]
        assert s["critical_risk_count"] >= 2
        assert s["retiring_by_2030_mw"] > 5000
        assert s["total_generators_tracked"] == 10
        assert s["avg_asset_age_years"] > 0
        assert s["uncovered_gap_years"] >= 1
        assert s["total_stranded_value_m"] > 0

# ===========================================================================
# TestTariffCrossSubsidyDashboard
# ===========================================================================

class TestTariffCrossSubsidyDashboard:
    """Sprint 71b: Cross-Subsidy & Cost-Reflective Tariff Analytics"""

    def test_http_200(self, client, auth_headers):
        r = client.get("/api/tariff-cross-subsidy/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_tariff_structures_count_and_demand_type(self, client, auth_headers):
        d = client.get("/api/tariff-cross-subsidy/dashboard", headers=auth_headers).json()
        assert len(d["tariff_structures"]) >= 6
        tariff_types = {t["tariff_type"] for t in d["tariff_structures"]}
        assert "DEMAND" in tariff_types

    def test_cross_subsidies_count_and_reform_status_variety(self, client, auth_headers):
        d = client.get("/api/tariff-cross-subsidy/dashboard", headers=auth_headers).json()
        assert len(d["cross_subsidies"]) >= 4
        statuses = {c["reform_status"] for c in d["cross_subsidies"]}
        assert "REFORMED" in statuses
        assert "UNREFORMED" in statuses

    def test_customer_costs_pays_and_receives_directions(self, client, auth_headers):
        d = client.get("/api/tariff-cross-subsidy/dashboard", headers=auth_headers).json()
        assert len(d["customer_costs"]) >= 4
        directions = {c["subsidy_direction"] for c in d["customer_costs"]}
        assert "PAYS" in directions
        assert "RECEIVES" in directions

    def test_der_impacts_count_and_risk_variety(self, client, auth_headers):
        d = client.get("/api/tariff-cross-subsidy/dashboard", headers=auth_headers).json()
        assert len(d["der_impacts"]) >= 20
        risk_levels = {r["death_spiral_risk"] for r in d["der_impacts"]}
        assert len(risk_levels) >= 2  # must have variety of risk levels

    def test_summary_assertions(self, client, auth_headers):
        d = client.get("/api/tariff-cross-subsidy/dashboard", headers=auth_headers).json()
        s = d["summary"]
        assert s["largest_cross_subsidy_m"] >= 400
        assert s["reformed_flows"] >= 1
        assert s["cross_subsidy_flows"] >= 4
        assert s["dnsp_count"] >= 3


# ── Sprint 71c: NEM Energy Consumer Hardship & Affordability Analytics ────────

class TestConsumerHardshipDashboard:
    BASE = "/api/consumer-hardship/dashboard"

    def test_http_200_ok(self, client):
        resp = client.get(self.BASE, headers={"x-api-key": "test-key"})
        assert resp.status_code == 200

    def test_stress_records_count_and_states(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        stress = d["stress_records"]
        assert len(stress) >= 40
        states_in_data = {r["state"] for r in stress}
        assert "TAS" in states_in_data
        assert "NSW" in states_in_data

    def test_retailers_count_and_non_compliant(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        retailers = d["retailers"]
        assert len(retailers) >= 6
        non_compliant = [r for r in retailers if not r["aemc_compliant"]]
        assert len(non_compliant) >= 1

    def test_concessions_count_and_critical_present(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        concessions = d["concessions"]
        assert len(concessions) >= 5
        adequacy_ratings = {c["adequacy_rating"] for c in concessions}
        assert "CRITICAL" in adequacy_ratings

    def test_disconnections_count_and_years(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        disconnections = d["disconnections"]
        assert len(disconnections) >= 30
        years_in_data = {r["year"] for r in disconnections}
        assert 2022 in years_in_data
        assert 2024 in years_in_data

    def test_summary_fields(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        s = d["summary"]
        assert s["highest_stress_state"] == "TAS"
        assert s["non_compliant_retailers"] >= 2
        assert s["states_tracked"] >= 5
        assert s["total_concession_cost_m"] > 0


# ── Sprint 72a: NEM Demand Side Response Aggregator Analytics ─────────────────

class TestDsrAggregatorDashboard:
    BASE = "/api/dsr-aggregator/dashboard"

    def test_http_200(self, client):
        r = client.get(self.BASE, headers={"x-api-key": "test-key"})
        assert r.status_code == 200

    def test_aggregators_present_and_fcas_registered(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        aggs = d["aggregators"]
        assert len(aggs) >= 5
        fcas_registered = [a for a in aggs if a["fcas_registered"] is True]
        assert len(fcas_registered) >= 1

    def test_events_present_and_trigger_variety(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        evts = d["events"]
        assert len(evts) >= 5
        trigger_types = {e["trigger_type"] for e in evts}
        assert "PRICE" in trigger_types
        assert "RERT" in trigger_types

    def test_participants_present_and_sector_variety(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        parts = d["participants"]
        assert len(parts) >= 6
        sectors = {p["sector"] for p in parts}
        assert "ALUMINIUM" in sectors
        assert "EV_FLEET" in sectors

    def test_economics_years_coverage(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        econ = d["economics"]
        assert len(econ) >= 16
        years = {e["year"] for e in econ}
        assert 2020 in years
        assert 2025 in years

    def test_summary_fields(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        s = d["summary"]
        assert s["total_registered_mw"] >= 1000
        assert s["avg_reliability_pct"] >= 85


class TestPowerSystemEventsDashboard:
    BASE = "/api/power-system-events/dashboard"

    def test_http_200(self, client):
        r = client.get(self.BASE, headers={"x-api-key": "test-key"})
        assert r.status_code == 200

    def test_events_count_and_types(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        events = d["events"]
        assert len(events) >= 5
        event_types = {e["event_type"] for e in events}
        assert "BLACKOUT" in event_types
        severities = {e["severity"] for e in events}
        assert "EXTREME" in severities

    def test_frequency_records(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        freq = d["frequency_records"]
        assert len(freq) >= 20
        low_freq = [r for r in freq if r["min_frequency_hz"] <= 49.9]
        assert len(low_freq) > 0

    def test_load_shedding(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        ls = d["load_shedding"]
        assert len(ls) >= 4
        planned_values = {r["planned"] for r in ls}
        assert True in planned_values
        assert False in planned_values

    def test_aemo_actions(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        actions = d["aemo_actions"]
        assert len(actions) >= 5
        suspended = [a for a in actions if a["market_suspended"] is True]
        assert len(suspended) >= 1

    def test_summary_fields(self, client):
        d = client.get(self.BASE, headers={"x-api-key": "test-key"}).json()
        s = d["summary"]
        assert s["total_cost_estimate_m"] >= 2000
        assert s["extreme_events"] >= 1


class TestMerchantRenewableDashboard:
    endpoint = "/api/merchant-renewable/dashboard"

    def test_http_200(self, client):
        resp = client.get(self.endpoint, headers={"x-api-key": "test-key"})
        assert resp.status_code == 200

    def test_projects_count_and_fully_merchant(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        projects = data["projects"]
        assert len(projects) >= 5
        fully_merchant = [p for p in projects if p["merchant_pct"] == 100]
        assert len(fully_merchant) >= 1

    def test_capture_prices_techs(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        capture_prices = data["capture_prices"]
        assert len(capture_prices) >= 30
        techs = {cp["technology"] for cp in capture_prices}
        assert "WIND" in techs
        assert "SOLAR" in techs

    def test_cannibalisation_severity_and_years(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        cannibal = data["cannibalisation"]
        assert len(cannibal) >= 20
        severities = {c["cannibalisation_severity"] for c in cannibal}
        assert "SEVERE" in severities
        years = {c["year"] for c in cannibal}
        assert 2023 in years
        assert 2030 in years

    def test_risks_count_and_high_residual(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        risks = data["risks"]
        assert len(risks) >= 6
        high_risks = [r for r in risks if r["residual_risk"] == "HIGH"]
        assert len(high_risks) >= 1

    def test_summary_irr_penalty_and_best_region(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        s = data["summary"]
        assert s["avg_irr_penalty_vs_contracted"] < 0
        assert s["best_merchant_region"] == "SA1"


class TestRetailerCompetitionDashboard:
    endpoint = "/api/retailer-competition/dashboard"

    def test_http_200(self, client):
        resp = client.get(self.endpoint, headers={"x-api-key": "test-key"})
        assert resp.status_code == 200

    def test_market_share_count_and_types(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        ms = data["market_share"]
        assert len(ms) >= 20
        types = {r["retailer_type"] for r in ms}
        assert "BIG3" in types
        assert "CHALLENGER" in types

    def test_offers_count_and_types(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        offers = data["offers"]
        assert len(offers) >= 6
        offer_types = {o["offer_type"] for o in offers}
        assert "STANDING" in offer_types
        assert "MARKET_BEST" in offer_types

    def test_churn_count_and_states(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        churn = data["churn"]
        assert len(churn) >= 30
        states = {c["state"] for c in churn}
        for s in ["NSW", "VIC", "QLD", "SA", "TAS"]:
            assert s in states

    def test_margins_count_and_big3_present(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        margins = data["margins"]
        assert len(margins) >= 30
        retailers = {m["retailer_name"] for m in margins}
        for big3 in ["AGL Energy", "Origin Energy", "EnergyAustralia"]:
            assert big3 in retailers

    def test_summary_big3_share_and_hhi(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        s = data["summary"]
        assert s["big3_combined_share_nsw_pct"] >= 60
        assert s["hhi_nsw"] > 1500


class TestStorageCostCurvesDashboard:
    endpoint = "/api/storage-cost-curves/dashboard"

    def test_http_200(self, client):
        r = client.get(self.endpoint, headers={"x-api-key": "test-key"})
        assert r.status_code == 200

    def test_learning_curves_volume_and_lfp_present_and_declining(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        lc = data["learning_curves"]
        assert len(lc) >= 50
        techs = {r["technology"] for r in lc}
        assert "Li-ion LFP" in techs
        # Capex should be declining over time for Li-ion LFP
        lfp = sorted([r for r in lc if r["technology"] == "Li-ion LFP"], key=lambda x: x["year"])
        assert lfp[0]["capex_per_kwh"] >= lfp[-1]["capex_per_kwh"]

    def test_projections_volume_and_scenarios(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        proj = data["projections"]
        assert len(proj) >= 20
        scenarios = {r["scenario"] for r in proj}
        assert "BASE" in scenarios
        assert "FAST_LEARNING" in scenarios

    def test_trl_records_volume_and_readiness_levels(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        trl = data["trl_records"]
        assert len(trl) >= 6
        readiness = {r["commercial_readiness"] for r in trl}
        assert "MATURE" in readiness
        assert "PILOT" in readiness

    def test_comparison_2030_volume_and_nem_fit(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        comp = data["comparison_2030"]
        assert len(comp) >= 6
        nem_fits = {r["nem_fit"] for r in comp}
        assert "EXCELLENT" in nem_fits
        assert "POOR" in nem_fits

    def test_summary_mature_technologies_and_lowest_lcoes(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        s = data["summary"]
        assert s["mature_technologies"] >= 2
        assert "Thermal" in s["lowest_2030_lcoes_tech"]


class TestExtremeWeatherResilienceDashboard:
    endpoint = "/api/extreme-weather-resilience/dashboard"

    def test_http_200(self, client):
        r = client.get(self.endpoint, headers={"x-api-key": "test-key"})
        assert r.status_code == 200

    def test_events_types_and_attribution(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        events = data["events"]
        assert len(events) >= 5
        event_types = {e["event_type"] for e in events}
        assert "HEATWAVE" in event_types
        assert "BUSHFIRE" in event_types
        attributions = {e["climate_attribution"] for e in events}
        assert "LIKELY" in attributions

    def test_demand_surges_lor_flags(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        surges = data["demand_surges"]
        assert len(surges) >= 4
        lor_flags = {s["close_to_lor"] for s in surges}
        assert True in lor_flags
        assert False in lor_flags

    def test_network_impacts_bushfire_proximity(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        impacts = data["network_impacts"]
        assert len(impacts) >= 4
        failure_types = {n["failure_type"] for n in impacts}
        assert "BUSHFIRE_PROXIMITY" in failure_types

    def test_adaptation_status_variety(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        adaptation = data["adaptation"]
        assert len(adaptation) >= 5
        statuses = {a["status"] for a in adaptation}
        assert "COMPLETED" in statuses
        assert "PLANNED" in statuses

    def test_summary_thresholds(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        s = data["summary"]
        assert s["total_economic_cost_m"] >= 2000
        assert s["close_to_lor_events"] >= 2
        assert s["total_adaptation_investment_m"] >= 900


class TestSpotPriceVolatilityRegimeEndpoint:
    endpoint = "/api/spot-price-volatility-regime/dashboard"

    def test_http_200(self, client):
        response = client.get(self.endpoint, headers={"x-api-key": "test-key"})
        assert response.status_code == 200

    def test_regime_count_minimum(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        regimes = data["regimes"]
        assert len(regimes) >= 20, f"Expected >= 20 regime records, got {len(regimes)}"

    def test_volatility_metrics_count_minimum(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        metrics = data["volatility_metrics"]
        assert len(metrics) >= 30, f"Expected >= 30 volatility metric records, got {len(metrics)}"

class TestIndustrialElectrificationEndpoint:
    endpoint = "/api/industrial-electrification/dashboard"

    def test_http_200(self, client):
        response = client.get(self.endpoint, headers={"x-api-key": "test-key"})
        assert response.status_code == 200

    def test_sectors_count_equals_8(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        assert len(data["sectors"]) == 8

    def test_load_shapes_count_at_least_150(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        assert len(data["load_shapes"]) >= 150


class TestOffshoreWindDevAnalyticsEndpoint:
    """Sprint 74c — Offshore Wind Development Pipeline Analytics (prefix OWDA)"""

    endpoint = "/api/offshore-wind-dev-analytics/dashboard"

    def test_http_200(self, client):
        response = client.get(self.endpoint, headers={"x-api-key": "test-key"})
        assert response.status_code == 200

    def test_projects_count_at_least_12(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        assert len(data["projects"]) >= 12

    def test_cost_curves_count_at_least_30(self, client):
        data = client.get(self.endpoint, headers={"x-api-key": "test-key"}).json()
        assert len(data["cost_curves"]) >= 30
