-- =============================================================================
-- 03_setup_lakebase.sql
-- AUS Energy Copilot — Lakebase (Postgres) operational tables
--
-- These tables run on the Databricks Lakebase (managed Postgres) instance
-- provisioned in ap-southeast-2. Lakebase is used for operational/user state
-- that benefits from low-latency row-level read/write (not suited to Delta).
--
-- Tables:
--   1. user_preferences     — per-user dashboard settings and default views
--   2. alert_configs        — user-configured alert rules (thresholds, channels)
--   3. copilot_sessions     — AI copilot chat session history
--
-- Run against the Lakebase Postgres connection, NOT against Databricks SQL.
-- Connection: DATABRICKS_LAKEBASE_HOST (ap-southeast-2 endpoint)
-- Safe to re-run: all statements use CREATE TABLE IF NOT EXISTS.
-- =============================================================================

-- =============================================================================
-- TABLE 1: user_preferences
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    preference_id       UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             VARCHAR(256)    NOT NULL,
    workspace_id        VARCHAR(128)    NOT NULL,
    default_region      VARCHAR(10)     DEFAULT 'NSW1',
    default_time_range  VARCHAR(20)     DEFAULT '24h',
    price_unit          VARCHAR(10)     DEFAULT 'AUD_MWH',
    chart_theme         VARCHAR(20)     DEFAULT 'dark',
    pinned_regions      JSONB           DEFAULT '["NSW1","VIC1","QLD1","SA1","TAS1"]',
    home_widgets        JSONB           DEFAULT '["price_ticker","demand_gauge","generation_mix","interconnectors"]',
    forecasts_horizon   VARCHAR(10)     DEFAULT '4h',
    email_notifications BOOLEAN         DEFAULT TRUE,
    notification_email  VARCHAR(256),
    push_notifications  BOOLEAN         DEFAULT FALSE,
    created_at          TIMESTAMPTZ     DEFAULT NOW() NOT NULL,
    updated_at          TIMESTAMPTZ     DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_user_preferences_user_workspace
    ON user_preferences (user_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id
    ON user_preferences (user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_preferences IS
    'Per-user dashboard configuration and notification preferences. One row per Databricks workspace user.';
COMMENT ON COLUMN user_preferences.user_id IS
    'Databricks workspace username (SSO email address).';
COMMENT ON COLUMN user_preferences.default_region IS
    'User default NEM region: NSW1, QLD1, VIC1, SA1, or TAS1.';
COMMENT ON COLUMN user_preferences.pinned_regions IS
    'JSON array of NEM region codes in display order on the Home price ticker.';
COMMENT ON COLUMN user_preferences.home_widgets IS
    'JSON array of widget IDs in display order for the Home page dashboard.';
COMMENT ON COLUMN user_preferences.forecasts_horizon IS
    'Default forecast horizon shown on Forecasts page: 1h, 4h, or 24h.';


-- =============================================================================
-- TABLE 2: alert_configs
-- =============================================================================
CREATE TABLE IF NOT EXISTS alert_configs (
    alert_config_id     UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             VARCHAR(256)    NOT NULL,
    workspace_id        VARCHAR(128)    NOT NULL,
    alert_name          VARCHAR(255)    NOT NULL,
    alert_type          VARCHAR(50)     NOT NULL,
    -- Valid values: PRICE_THRESHOLD, DEMAND_SURGE, DEMAND_DROP,
    -- INTERCONNECTOR_CONGESTION, FCAS_SPIKE, DATA_STALE, MODEL_DRIFT, CUSTOM
    is_enabled          BOOLEAN         DEFAULT TRUE,
    regions             JSONB           DEFAULT '["NSW1","QLD1","VIC1","SA1","TAS1"]',
    -- JSON array of NEM regions; empty array means all regions
    threshold_value     NUMERIC(12, 4),
    -- $/MWh for price alerts; MW for demand alerts; minutes for staleness
    threshold_operator  VARCHAR(10)     DEFAULT '>',
    -- Comparison operator: >, >=, <, <=, =
    secondary_threshold NUMERIC(12, 4),
    -- Optional secondary value (e.g. upper bound for range alerts)
    trigger_intervals   INT             DEFAULT 1,
    -- Consecutive 5-min intervals threshold must be met before firing
    cooldown_minutes    INT             DEFAULT 30,
    -- Minimum minutes between repeat notifications for same condition
    notify_email        BOOLEAN         DEFAULT TRUE,
    notify_in_app       BOOLEAN         DEFAULT TRUE,
    notify_webhook      BOOLEAN         DEFAULT FALSE,
    webhook_url         VARCHAR(2048),
    -- Webhook URL for Slack / Teams / PagerDuty (NULL if not configured)
    use_forecast        BOOLEAN         DEFAULT FALSE,
    -- If true, evaluates ML forecast spike_probability instead of actuals
    forecast_probability_threshold NUMERIC(5, 4) DEFAULT 0.70,
    -- Minimum forecast spike probability (0.0–1.0) to fire predictive alert
    last_fired_at       TIMESTAMPTZ,
    last_evaluated_at   TIMESTAMPTZ,
    fire_count          INT             DEFAULT 0,
    created_at          TIMESTAMPTZ     DEFAULT NOW() NOT NULL,
    updated_at          TIMESTAMPTZ     DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_configs_user_id
    ON alert_configs (user_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_alert_configs_type_enabled
    ON alert_configs (alert_type, is_enabled)
    WHERE is_enabled = TRUE;

CREATE OR REPLACE TRIGGER trg_alert_configs_updated_at
    BEFORE UPDATE ON alert_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE alert_configs IS
    'User-configured NEM market alert rules. Each row defines one alert with a metric, '
    'threshold, scope (regions), timing, and notification channels. '
    'Evaluated every 5 minutes by the alert pipeline.';
COMMENT ON COLUMN alert_configs.alert_type IS
    'Alert category: PRICE_THRESHOLD, DEMAND_SURGE, DEMAND_DROP, '
    'INTERCONNECTOR_CONGESTION, FCAS_SPIKE, DATA_STALE, MODEL_DRIFT, CUSTOM.';
COMMENT ON COLUMN alert_configs.trigger_intervals IS
    'Number of consecutive 5-minute intervals the threshold must be breached before firing. '
    'Use 1 for immediate; 3-6 to filter transient single-interval spikes.';
COMMENT ON COLUMN alert_configs.use_forecast IS
    'If true, alert fires on ML price forecast spike_probability (predictive alerting). '
    'Enables warning before a spike occurs rather than after.';
COMMENT ON COLUMN alert_configs.regions IS
    'JSON array of NEM region codes this alert monitors. '
    'Example: ["NSW1","VIC1"] monitors only NSW and VIC.';


-- =============================================================================
-- TABLE 3: copilot_sessions
-- =============================================================================
CREATE TABLE IF NOT EXISTS copilot_sessions (
    session_id          UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             VARCHAR(256)    NOT NULL,
    workspace_id        VARCHAR(128)    NOT NULL,
    session_title       VARCHAR(512),
    -- Auto-generated title derived from first user message (populated after first turn)
    is_active           BOOLEAN         DEFAULT TRUE,
    -- False when session is archived or deleted by the user
    session_context     JSONB,
    -- Snapshot of NEM market context at session start:
    -- { "default_region": "NSW1", "latest_rrp": 89.5,
    --   "timestamp": "2026-02-19T10:30:00+11:00",
    --   "initial_query": "What happened to SA prices today?" }
    messages            JSONB           DEFAULT '[]',
    -- Array of message turn objects:
    -- [{
    --   "turn_id": "<uuid>",
    --   "role": "user" | "assistant",
    --   "content": "<message text>",
    --   "tool_calls": [{ "name": "get_latest_prices", "args": {}, "result": {} }],
    --   "has_chart": false,
    --   "chart_config": null,
    --   "timestamp": "<ISO8601 AEST>",
    --   "latency_ms": 1240,
    --   "input_tokens": 320,
    --   "output_tokens": 210
    -- }]
    total_turns         INT             DEFAULT 0,
    -- Total number of user+assistant turn pairs in this session
    total_tokens_used   INT             DEFAULT 0,
    -- Cumulative token count (input + output) for cost tracking
    total_tool_calls    INT             DEFAULT 0,
    -- Cumulative number of UC function tool calls made in session
    avg_latency_ms      NUMERIC(10, 2),
    -- Average assistant response latency in milliseconds
    user_rating         SMALLINT,
    -- Optional user satisfaction rating: 1 (poor) to 5 (excellent)
    feedback_text       TEXT,
    -- Optional free-text feedback from user (shown in evaluation dashboard)
    started_at          TIMESTAMPTZ     DEFAULT NOW() NOT NULL,
    last_message_at     TIMESTAMPTZ     DEFAULT NOW(),
    created_at          TIMESTAMPTZ     DEFAULT NOW() NOT NULL,
    updated_at          TIMESTAMPTZ     DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_user_rating CHECK (user_rating IS NULL OR (user_rating BETWEEN 1 AND 5))
);

CREATE INDEX IF NOT EXISTS idx_copilot_sessions_user_recent
    ON copilot_sessions (user_id, workspace_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_copilot_sessions_active
    ON copilot_sessions (user_id, is_active)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_copilot_sessions_rated
    ON copilot_sessions (user_rating)
    WHERE user_rating IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_copilot_sessions_updated_at
    BEFORE UPDATE ON copilot_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE copilot_sessions IS
    'AI Copilot chat session history. Each row is one conversation. '
    'Messages stored as JSONB array of turn objects for efficient retrieval and session resumption.';
COMMENT ON COLUMN copilot_sessions.messages IS
    'JSONB array of all message turns in the session. Each turn records role, content, '
    'tool_calls with arguments and results, optional chart config, and performance metrics. '
    'Full history replayed when a user resumes a session.';
COMMENT ON COLUMN copilot_sessions.session_context IS
    'JSONB snapshot of the NEM market context when the session started. '
    'Passed to the agent to ground responses in the market state the user was viewing.';
COMMENT ON COLUMN copilot_sessions.user_rating IS
    'User-provided session quality rating (1–5 stars). NULL if not yet rated. '
    'Used for agent evaluation analytics and model improvement.';
