-- =============================================================================
-- 00_create_catalog.sql
-- AUS Energy Copilot — Unity Catalog setup
--
-- Creates the top-level Unity Catalog catalog and all schemas required
-- for the medallion architecture and AI tooling.
--
-- Run as: Databricks workspace admin with CREATE CATALOG privilege
-- Target environment: Databricks Unity Catalog (ap-southeast-2)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: Create the top-level catalog
-- ---------------------------------------------------------------------------
CREATE CATALOG IF NOT EXISTS energy_copilot
  COMMENT 'AUS Energy Copilot — Australian NEM market data, forecasts, and AI tooling.
           Catalog owner: energy-copilot-admins group.
           Contains schemas: bronze, silver, gold, ml, tools.';

-- Set the default catalog for the remainder of this script
USE CATALOG energy_copilot;

-- ---------------------------------------------------------------------------
-- Step 2: Create schemas (detailed DDL in 01_create_schemas.sql)
-- ---------------------------------------------------------------------------

-- Bronze: raw ingested data, append-only, schema-on-read
CREATE SCHEMA IF NOT EXISTS energy_copilot.bronze
  COMMENT 'Bronze layer — raw data from NEMWEB, OpenElectricity, Open-Meteo and APVI.
           Data is append-only and retains original source structure.
           Write access restricted to pipeline service principals.
           Read access restricted to data engineering principals.';

-- Silver: cleaned, validated, deduplicated tables
CREATE SCHEMA IF NOT EXISTS energy_copilot.silver
  COMMENT 'Silver layer — cleaned, typed, validated and deduplicated data.
           Sourced exclusively from Bronze via SDP pipelines.
           Read access: data engineering + ML engineering principals.
           Write access: pipeline service principals only.';

-- Gold: analytics-ready, aggregated, feature-engineered tables
CREATE SCHEMA IF NOT EXISTS energy_copilot.gold
  COMMENT 'Gold layer — analytics-ready aggregations and feature tables.
           Powers the dashboard, Genie spaces, and ML inference.
           Read access: all authenticated app users (via Databricks Apps SSO).
           Write access: pipeline service principals only.';

-- ml: MLflow experiment tracking, feature store tables, model artifacts
CREATE SCHEMA IF NOT EXISTS energy_copilot.ml
  COMMENT 'ML layer — MLflow experiments, feature store tables and model output logs.
           Hosts training feature tables and model evaluation artefacts.
           Read access: ML engineering principals.
           Write access: ML pipeline service principals.';

-- tools: Unity Catalog functions used as AI agent tools
CREATE SCHEMA IF NOT EXISTS energy_copilot.tools
  COMMENT 'Tools schema — Unity Catalog SQL/Python functions registered for the
           Mosaic AI Copilot agent (14 tools across market data, forecasting,
           analysis, and RAG categories).
           Read/execute access: agent serving endpoint service principal.
           Write access: ML engineering principals.';

-- ---------------------------------------------------------------------------
-- Step 3: Grant baseline permissions
-- (Adjust principal names to match your workspace groups)
-- ---------------------------------------------------------------------------

-- Admins: full control on catalog
GRANT ALL PRIVILEGES ON CATALOG energy_copilot
  TO `energy-copilot-admins`;

-- Data engineers: manage bronze and silver
GRANT USE CATALOG ON CATALOG energy_copilot
  TO `energy-copilot-data-engineers`;
GRANT USE SCHEMA, CREATE TABLE, MODIFY ON SCHEMA energy_copilot.bronze
  TO `energy-copilot-data-engineers`;
GRANT USE SCHEMA, CREATE TABLE, MODIFY ON SCHEMA energy_copilot.silver
  TO `energy-copilot-data-engineers`;

-- ML engineers: read silver, manage gold and ml
GRANT USE CATALOG ON CATALOG energy_copilot
  TO `energy-copilot-ml-engineers`;
GRANT USE SCHEMA, SELECT ON SCHEMA energy_copilot.silver
  TO `energy-copilot-ml-engineers`;
GRANT USE SCHEMA, CREATE TABLE, MODIFY ON SCHEMA energy_copilot.gold
  TO `energy-copilot-ml-engineers`;
GRANT USE SCHEMA, CREATE TABLE, MODIFY ON SCHEMA energy_copilot.ml
  TO `energy-copilot-ml-engineers`;
GRANT USE SCHEMA, CREATE FUNCTION, MODIFY ON SCHEMA energy_copilot.tools
  TO `energy-copilot-ml-engineers`;

-- App users (dashboard, Genie, Copilot): read-only on gold
GRANT USE CATALOG ON CATALOG energy_copilot
  TO `energy-copilot-app-users`;
GRANT USE SCHEMA, SELECT ON SCHEMA energy_copilot.gold
  TO `energy-copilot-app-users`;
GRANT USE SCHEMA, EXECUTE ON SCHEMA energy_copilot.tools
  TO `energy-copilot-app-users`;

-- Pipeline service principals: write to all layers
GRANT USE CATALOG ON CATALOG energy_copilot
  TO `energy-copilot-pipelines`;
GRANT USE SCHEMA, CREATE TABLE, MODIFY ON SCHEMA energy_copilot.bronze
  TO `energy-copilot-pipelines`;
GRANT USE SCHEMA, CREATE TABLE, MODIFY ON SCHEMA energy_copilot.silver
  TO `energy-copilot-pipelines`;
GRANT USE SCHEMA, CREATE TABLE, MODIFY ON SCHEMA energy_copilot.gold
  TO `energy-copilot-pipelines`;
GRANT USE SCHEMA, CREATE TABLE, MODIFY ON SCHEMA energy_copilot.ml
  TO `energy-copilot-pipelines`;
