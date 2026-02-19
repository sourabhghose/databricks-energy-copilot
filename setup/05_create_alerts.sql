-- =============================================================================
-- 05_create_alerts.sql
-- AUS Energy Copilot -- Databricks SQL Alert query definitions
--
-- Creates saved SQL query views that back Databricks SQL Alerts.
-- Alerts fire when the query returns > 0 rows.
--
-- Alert categories:
--   A. Price threshold alerts: >$300, >$1000, >$5000 per region (4 queries)
--   B. Demand surge alert: >95th percentile across regions
--   C. Data staleness alert: any Gold table older than 10 minutes
--   D. ML model drift alert: price MAE >$15/MWh or demand MAPE >3%
--   E. Predictive price spike alert: ML spike_probability >= 70%
--   F. Interconnector congestion alert: utilisation > 95%
--
-- Setup in Databricks SQL:
--   1. Run this script to create the views
--   2. For each view, create a Query in SQL editor pointing to the view
--   3. Create an Alert on that query: condition=row_count>0, schedule=5min
--   4. Attach notification destinations (email, webhook, Slack, PagerDuty)
-- =============================================================================

USE CATALOG energy_copilot;
USE SCHEMA gold;

-- ===========================================================================
-- A1. Price Moderate Spike Alert (> $300/MWh)
-- ===========================================================================
CREATE OR REPLACE VIEW energy_copilot.gold._alert_price_moderate AS
SELECT
    p.region_id                              AS region,
    ROUND(p.rrp, 2)                          AS current_price_aud_mwh,
    p.interval_datetime                      AS interval_time,
    ROUND(p.total_demand_mw, 1)              AS demand_mw,
    ROUND(p.net_interchange_mw, 1)           AS net_interchange_mw,
    ROUND(p.rrp - 300.0, 2)                  AS excess_above_threshold,
    300                                      AS threshold_aud_mwh,
    'MODERATE_SPIKE'                         AS alert_tier
FROM energy_copilot.gold.nem_prices_5min p
WHERE p.interval_datetime = (
        SELECT MAX(interval_datetime) FROM energy_copilot.gold.nem_prices_5min)
  AND p.rrp > 300
  AND p.market_suspended = FALSE
ORDER BY p.rrp DESC;
-- Alert config: schedule=5min, condition=row_count>0, notify=email+in_app

-- ===========================================================================
-- A2. Price High Spike Alert (> $1,000/MWh)
-- ===========================================================================
CREATE OR REPLACE VIEW energy_copilot.gold._alert_price_high AS
SELECT
    p.region_id                              AS region,
    ROUND(p.rrp, 2)                          AS current_price_aud_mwh,
    p.interval_datetime                      AS interval_time,
    ROUND(p.total_demand_mw, 1)              AS demand_mw,
    p.apc_flag                               AS apc_active,
    ROUND(p.rrp - 1000.0, 2)                 AS excess_above_threshold,
    -- Binding constraints correlated with this spike
    (
        SELECT COUNT(*)
        FROM energy_copilot.gold.nem_constraints_active c
        WHERE c.interval_datetime = p.interval_datetime
          AND ARRAY_CONTAINS(c.affected_regions, p.region_id)
          AND c.marginal_value > 100
    )                                        AS high_value_constraints_count,
    1000                                     AS threshold_aud_mwh,
    'HIGH_SPIKE'                             AS alert_tier
FROM energy_copilot.gold.nem_prices_5min p
WHERE p.interval_datetime = (
        SELECT MAX(interval_datetime) FROM energy_copilot.gold.nem_prices_5min)
  AND p.rrp > 1000
  AND p.market_suspended = FALSE
ORDER BY p.rrp DESC;
-- Alert config: schedule=5min, condition=row_count>0, notify=email+in_app+webhook

-- ===========================================================================
-- A3. Price Critical Spike Alert (> $5,000/MWh)
-- Fires for severe market stress events approaching the market price cap.
-- ===========================================================================
CREATE OR REPLACE VIEW energy_copilot.gold._alert_price_critical AS
SELECT
    p.region_id                              AS region,
    ROUND(p.rrp, 2)                          AS current_price_aud_mwh,
    p.interval_datetime                      AS interval_time,
    p.apc_flag                               AS apc_active,
    p.market_suspended                       AS market_suspended,
    ROUND(p.rrp / 15500.0 * 100.0, 1)        AS pct_of_market_cap,
    ROUND(p.rrp - 5000.0, 2)                 AS excess_above_threshold,
    -- List congested interconnectors in this interval
    (
        SELECT COALESCE(STRING_AGG(ic.interconnector_id, ', '), 'none')
        FROM energy_copilot.gold.nem_interconnectors ic
        WHERE ic.interval_datetime = p.interval_datetime
          AND (ic.from_region = p.region_id OR ic.to_region = p.region_id)
          AND ic.is_congested = TRUE
    )                                        AS congested_interconnectors,
    5000                                     AS threshold_aud_mwh,
    'CRITICAL_SPIKE'                         AS alert_tier
FROM energy_copilot.gold.nem_prices_5min p
WHERE p.interval_datetime = (
        SELECT MAX(interval_datetime) FROM energy_copilot.gold.nem_prices_5min)
  AND p.rrp > 5000
ORDER BY p.rrp DESC;
-- Alert config: schedule=5min, condition=row_count>0, notify=email+in_app+webhook(PagerDuty/Slack)

-- ===========================================================================
-- A4. Sustained High Price Alert (>$300/MWh for >= 30 consecutive minutes)
-- Sustained high prices are more costly than single-interval spikes.
-- ===========================================================================
CREATE OR REPLACE VIEW energy_copilot.gold._alert_price_sustained AS
WITH recent AS (
    SELECT
        region_id,
        interval_datetime,
        rrp,
        -- Partition consecutive high-price runs using break detection
        SUM(CASE WHEN rrp <= 300 THEN 1 ELSE 0 END)
            OVER (PARTITION BY region_id
                  ORDER BY interval_datetime
                  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS run_break
    FROM energy_copilot.gold.nem_prices_5min
    WHERE interval_datetime >= DATEADD(HOUR, -2, CURRENT_TIMESTAMP())
      AND market_suspended = FALSE
),
runs AS (
    SELECT
        region_id,
        run_break,
        COUNT(*)               AS consecutive_intervals,
        MIN(interval_datetime) AS run_start,
        MAX(interval_datetime) AS run_end,
        ROUND(AVG(rrp), 2)     AS avg_rrp,
        ROUND(MAX(rrp), 2)     AS max_rrp
    FROM recent
    WHERE rrp > 300
    GROUP BY region_id, run_break
)
SELECT
    region_id                                    AS region,
    consecutive_intervals,
    ROUND(consecutive_intervals * 5.0, 0)        AS duration_minutes,
    run_start,
    run_end,
    avg_rrp                                      AS avg_rrp_aud_mwh,
    max_rrp                                      AS max_rrp_aud_mwh,
    'SUSTAINED_HIGH_PRICE'                       AS alert_tier
FROM runs
WHERE consecutive_intervals >= 6     -- 30 minutes = 6 x 5-minute intervals
  AND run_end = (SELECT MAX(interval_datetime) FROM energy_copilot.gold.nem_prices_5min)
ORDER BY consecutive_intervals DESC;
-- Alert config: schedule=5min, condition=row_count>0, notify=email+in_app

-- ===========================================================================
-- B. Demand Surge Alert (> 95th-percentile benchmark)
-- ===========================================================================
CREATE OR REPLACE VIEW energy_copilot.gold._alert_demand_surge AS
WITH benchmarks AS (
    -- 95th percentile over last 90 days per region
    SELECT
        region_id,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_demand_mw) AS p95_mw,
        MAX(total_demand_mw)                                          AS hist_max_mw
    FROM energy_copilot.gold.demand_actuals
    WHERE interval_datetime >= DATEADD(DAY, -90, CURRENT_DATE())
    GROUP BY region_id
),
latest AS (
    SELECT region_id, total_demand_mw, net_demand_mw,
           temperature_c, interval_datetime, is_peak
    FROM energy_copilot.gold.demand_actuals
    WHERE interval_datetime = (SELECT MAX(interval_datetime) FROM energy_copilot.gold.demand_actuals)
)
SELECT
    l.region_id                                         AS region,
    ROUND(l.total_demand_mw, 1)                         AS current_demand_mw,
    ROUND(b.p95_mw, 1)                                  AS p95_benchmark_mw,
    ROUND(l.total_demand_mw - b.p95_mw, 1)              AS excess_above_p95_mw,
    ROUND(l.total_demand_mw / b.hist_max_mw * 100.0, 1) AS pct_of_historical_max,
    ROUND(l.temperature_c, 1)                           AS temperature_c,
    l.interval_datetime                                 AS interval_time,
    l.is_peak                                           AS is_peak_period,
    'DEMAND_SURGE'                                      AS alert_type
FROM latest l
JOIN benchmarks b ON l.region_id = b.region_id
WHERE l.total_demand_mw > b.p95_mw
   OR l.total_demand_mw > (b.hist_max_mw * 0.95)    -- Within 5% of all-time record
ORDER BY excess_above_p95_mw DESC;
-- Alert config: schedule=5min, condition=row_count>0, notify=email+in_app

-- ===========================================================================
-- C. Data Staleness Alert (any key Gold table older than 10 minutes)
-- Data freshness SLA: < 2 minutes from AEMO publish; alert at 10 minutes.
-- ===========================================================================
CREATE OR REPLACE VIEW energy_copilot.gold._alert_data_stale AS
WITH freshness AS (
    SELECT 'nem_prices_5min' AS tbl,
           MAX(interval_datetime) AS latest_interval,
           TIMESTAMPDIFF(MINUTE, MAX(interval_datetime), CURRENT_TIMESTAMP()) AS mins_stale
    FROM energy_copilot.gold.nem_prices_5min
    UNION ALL
    SELECT 'nem_generation_by_fuel',
           MAX(interval_datetime),
           TIMESTAMPDIFF(MINUTE, MAX(interval_datetime), CURRENT_TIMESTAMP())
    FROM energy_copilot.gold.nem_generation_by_fuel
    UNION ALL
    SELECT 'nem_interconnectors',
           MAX(interval_datetime),
           TIMESTAMPDIFF(MINUTE, MAX(interval_datetime), CURRENT_TIMESTAMP())
    FROM energy_copilot.gold.nem_interconnectors
    UNION ALL
    SELECT 'demand_actuals',
           MAX(interval_datetime),
           TIMESTAMPDIFF(MINUTE, MAX(interval_datetime), CURRENT_TIMESTAMP())
    FROM energy_copilot.gold.demand_actuals
    UNION ALL
    SELECT 'nem_fcas_prices',
           MAX(interval_datetime),
           TIMESTAMPDIFF(MINUTE, MAX(interval_datetime), CURRENT_TIMESTAMP())
    FROM energy_copilot.gold.nem_fcas_prices
)
SELECT
    tbl      AS table_name,
    latest_interval,
    mins_stale AS minutes_stale,
    CASE
        WHEN mins_stale > 60 THEN 'CRITICAL'
        WHEN mins_stale > 30 THEN 'HIGH'
        ELSE                      'MEDIUM'
    END AS severity,
    'DATA_STALE' AS alert_type
FROM freshness
WHERE mins_stale > 10
ORDER BY mins_stale DESC;
-- Alert config: schedule=5min, condition=row_count>0, notify=email (data-engineering team)

-- ===========================================================================
-- D. ML Model Drift Alert
-- Price MAE > $15/MWh (excl. >$500 extremes) OR Demand MAPE > 3%
-- Evaluated over recent 1-hour-horizon forecasts vs actuals
-- ===========================================================================
CREATE OR REPLACE VIEW energy_copilot.gold._alert_model_drift AS
WITH price_acc AS (
    SELECT
        f.region_id, f.model_name, f.model_version, COUNT(*) AS n,
        -- MAE excluding extreme price events per model performance spec
        AVG(CASE WHEN a.rrp <= 500
                 THEN ABS(f.predicted_rrp - a.rrp) END)         AS mae_excl_extremes,
        AVG(ABS(f.predicted_rrp - a.rrp)
            / NULLIF(ABS(a.rrp), 0)) * 100                      AS mape_pct
    FROM energy_copilot.gold.price_forecasts f
    JOIN energy_copilot.gold.nem_prices_5min a
        ON f.region_id = a.region_id
       AND f.interval_datetime = a.interval_datetime
    WHERE f.horizon_intervals = 12   -- 1-hour horizon
      AND f.forecast_run_at BETWEEN DATEADD(HOUR, -25, CURRENT_TIMESTAMP())
                                AND DATEADD(HOUR, -1,  CURRENT_TIMESTAMP())
    GROUP BY f.region_id, f.model_name, f.model_version
    HAVING COUNT(*) >= 24
),
demand_acc AS (
    SELECT
        f.region_id, f.model_name, f.model_version, COUNT(*) AS n,
        AVG(ABS(f.predicted_demand_mw - a.total_demand_mw)
            / NULLIF(a.total_demand_mw, 0)) * 100 AS mape_pct
    FROM energy_copilot.gold.demand_forecasts f
    JOIN energy_copilot.gold.demand_actuals a
        ON f.region_id = a.region_id
       AND f.interval_datetime = a.interval_datetime
    WHERE f.horizon_intervals = 12
      AND f.forecast_run_at BETWEEN DATEADD(HOUR, -25, CURRENT_TIMESTAMP())
                                AND DATEADD(HOUR, -1,  CURRENT_TIMESTAMP())
    GROUP BY f.region_id, f.model_name, f.model_version
    HAVING COUNT(*) >= 24
)
SELECT region_id, model_name, model_version,
       'PRICE_FORECAST' AS forecast_type,
       ROUND(mae_excl_extremes, 2) AS metric_value,
       15.0 AS threshold_value,
       ROUND(mae_excl_extremes - 15.0, 2) AS excess,
       n AS sample_count, 'MODEL_DRIFT' AS alert_type
FROM price_acc WHERE mae_excl_extremes > 15.0
UNION ALL
SELECT region_id, model_name, model_version,
       'DEMAND_FORECAST',
       ROUND(mape_pct, 2), 3.0, ROUND(mape_pct - 3.0, 2),
       n, 'MODEL_DRIFT'
FROM demand_acc WHERE mape_pct > 3.0
ORDER BY excess DESC;
-- Alert config: schedule=30min, condition=row_count>0, notify=email (ml-engineering team)

-- ===========================================================================
-- E. Predictive Price Spike Alert (ML forecast spike_probability >= 70%)
-- Forward-looking: fires BEFORE the spike occurs, based on ML forecast.
-- This alert is unique to the AI Copilot platform.
-- ===========================================================================
CREATE OR REPLACE VIEW energy_copilot.gold._alert_predicted_spike AS
SELECT
    f.region_id                                  AS region,
    f.interval_datetime                          AS predicted_interval,
    f.horizon_intervals,
    ROUND(f.horizon_intervals * 5.0, 0)          AS minutes_ahead,
    ROUND(f.predicted_rrp, 2)                    AS predicted_price_aud_mwh,
    ROUND(f.spike_probability * 100.0, 1)        AS spike_probability_pct,
    ROUND(f.prediction_upper_80, 2)              AS worst_case_price_aud_mwh,
    f.model_name,
    f.forecast_run_at,
    'PREDICTED_SPIKE'                            AS alert_type
FROM energy_copilot.gold.price_forecasts f
WHERE f.forecast_run_at = (
        SELECT MAX(forecast_run_at) FROM energy_copilot.gold.price_forecasts)
  AND f.spike_probability >= 0.70    -- 70% probability threshold
  AND f.horizon_intervals BETWEEN 1 AND 48   -- Next 4 hours only
  AND f.predicted_rrp > 300
ORDER BY f.spike_probability DESC, f.interval_datetime ASC;
-- Alert config: schedule=5min, condition=row_count>0, notify=email+in_app+webhook

-- ===========================================================================
-- F. Interconnector Congestion Alert (utilisation > 95%)
-- ===========================================================================
CREATE OR REPLACE VIEW energy_copilot.gold._alert_interconnector_congestion AS
SELECT
    ic.interconnector_id,
    ic.from_region,
    ic.to_region,
    ROUND(ic.mw_flow, 1)          AS current_flow_mw,
    ROUND(ic.export_limit_mw, 1)  AS export_limit_mw,
    ROUND(ic.import_limit_mw, 1)  AS import_limit_mw,
    ROUND(ic.utilization_pct, 1)  AS utilization_pct,
    ROUND(ic.marginal_value, 2)   AS shadow_price_aud_mwh,
    ic.interval_datetime          AS interval_time,
    'INTERCONNECTOR_CONGESTION'   AS alert_type
FROM energy_copilot.gold.nem_interconnectors ic
WHERE ic.interval_datetime = (
        SELECT MAX(interval_datetime) FROM energy_copilot.gold.nem_interconnectors)
  AND ic.is_congested = TRUE
ORDER BY ic.utilization_pct DESC;
-- Alert config: schedule=5min, condition=row_count>0, notify=email+in_app
