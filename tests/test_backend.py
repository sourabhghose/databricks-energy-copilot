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
