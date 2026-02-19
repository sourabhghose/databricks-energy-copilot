-- =============================================================================
-- 01_create_schemas.sql
-- AUS Energy Copilot — Schema definitions with full comments
--
-- Run after 00_create_catalog.sql.
-- Safe to re-run: all statements use IF NOT EXISTS.
-- Target: energy_copilot catalog (Unity Catalog, ap-southeast-2)
-- =============================================================================

USE CATALOG energy_copilot;

-- =============================================================================
-- BRONZE SCHEMA
-- Raw, append-only data from all external sources.
-- Tables named nemweb_*, openelec_raw, weather_raw, apvi_raw.
-- Data is never modified after insert; source format is preserved.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS energy_copilot.bronze
  COMMENT 'Bronze layer — append-only raw data from NEMWEB (11 tables),
           OpenElectricity API, Open-Meteo weather API, and APVI rooftop solar API.
           Schema owner: energy-copilot-data-engineers.
           Pipeline write frequency: NEMWEB tables every 5-30 min; others hourly.
           Retention: 36 months rolling (managed by lifecycle job).';

-- =============================================================================
-- SILVER SCHEMA
-- Cleaned, typed, validated, deduplicated tables.
-- One-to-one or many-to-one mapping from Bronze sources.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS energy_copilot.silver
  COMMENT 'Silver layer — cleaned and validated NEM market and weather data.
           13 tables covering: dispatch prices, dispatch generation,
           dispatch interconnectors, dispatch constraints, trading prices,
           pre-dispatch prices, generator registry, bids, weather per NEM region,
           rooftop solar, OpenElectricity generation, OpenElectricity prices,
           and a generation-by-fuel rollup.
           Schema owner: energy-copilot-data-engineers.
           SDP data quality expectations enforced on all tables.';

-- =============================================================================
-- GOLD SCHEMA
-- Analytics-ready, feature-engineered tables.
-- Partitioned by date for fast time-range queries.
-- Serves: dashboard (React app), Genie spaces, ML inference, agent tools.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS energy_copilot.gold
  COMMENT 'Gold layer — analytics-ready NEM market data and ML forecasts.
           16 tables: 5-min prices, 30-min prices, generation by fuel, interconnectors,
           active constraints, FCAS prices, demand actuals, weather per NEM region,
           price/demand/generation forecasts, daily NEM summary, ML feature stores
           (price + demand), daily market narrative summary, and anomaly events.
           Partitioned by interval_datetime::date on all high-volume time-series tables.
           Schema owner: energy-copilot-ml-engineers.
           Read access: all app users via Databricks Apps SSO passthrough.';

-- =============================================================================
-- ML SCHEMA
-- MLflow experiment artefacts, feature store tables, evaluation results.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS energy_copilot.ml
  COMMENT 'ML layer — MLflow experiment tracking tables, feature store definitions,
           model evaluation results, and backtesting artefacts.
           Hosts 20 forecast models (5 NEM regions × 4 types: price, demand,
           wind, solar) plus 1 anomaly detection model.
           Training cadence: weekly retraining every Sunday night AEST.
           Schema owner: energy-copilot-ml-engineers.';

-- =============================================================================
-- TOOLS SCHEMA
-- Unity Catalog SQL/Python functions exposed as AI agent tools.
-- 14 functions covering market data, forecasts, analysis, and RAG.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS energy_copilot.tools
  COMMENT 'Tools schema — 14 Unity Catalog functions registered as Mosaic AI agent tools.
           Categories:
             Market data (6): get_latest_prices, get_price_history, get_generation_mix,
               get_interconnector_flows, get_active_constraints, get_fcas_prices.
             Forecasting (3): get_price_forecast, get_demand_forecast, get_weather_forecast.
             Analysis (3): explain_price_event, compare_regions, get_market_summary.
             RAG (1): search_market_rules.
             Utility (1): get_generator_info.
           Execute access: agent serving endpoint service principal + app users.
           Schema owner: energy-copilot-ml-engineers.';
