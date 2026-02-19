# AUS Energy Copilot — Project Status

## Frontend Workstream — completed
**Completed:** package.json, tsconfig.json, vite.config.ts, index.html, src/main.tsx, src/App.tsx, 6 pages, 4 components, api/client.ts, hooks/useMarketData.ts
**Notes:** React 18 + Vite 5 + TypeScript. Recharts for charts, Tailwind for styling, React Router v6 for navigation. SSE streaming in ChatInterface for real-time copilot responses. InterconnectorMap uses inline SVG.

## Backend + Agent Workstream — 2026-02-19T00:00:00+11:00 (AEDT)

**Completed:**
- `app/backend/requirements.txt` — pinned dependencies: fastapi, uvicorn[standard], databricks-sdk, databricks-sql-connector, anthropic, python-dotenv, pydantic, pydantic-settings, sse-starlette, httpx
- `app/backend/main.py` — FastAPI application with CORS middleware, 7 REST market-data endpoints (/api/prices/latest, /api/prices/history, /api/forecasts, /api/generation, /api/interconnectors, /api/fcas, /api/alerts), and POST /api/chat SSE streaming endpoint with a full agentic loop (Claude Sonnet 4.5 with 6 inline tools)
- `app/backend/.env.example` — environment variable template for all secrets (DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID, DATABRICKS_CATALOG, ANTHROPIC_API_KEY, LAKEBASE_HOST, LAKEBASE_PASSWORD)
- `app/app.yaml` — Databricks Apps deployment config with secret-scope injection
- `agent/copilot_agent.py` — Mosaic AI Agent: LangChain AgentExecutor wrapping Claude Sonnet 4.5 with all 13 tools, MLflow PyFunc wrapper for Model Serving registration, interactive CLI REPL
- `agent/__init__.py`, `agent/tools/__init__.py`, `agent/rag/__init__.py`, `agent/evaluation/__init__.py` — package init files; ALL_TOOLS list in tools/__init__.py
- `agent/tools/market_data_tools.py` — 6 market data tools: get_latest_prices, get_price_history, get_generation_mix, get_interconnector_flows, get_active_constraints, get_fcas_prices
- `agent/tools/forecast_tools.py` — 3 forecast tools: get_price_forecast, get_demand_forecast, get_weather_forecast
- `agent/tools/analysis_tools.py` — 3 analysis tools: explain_price_event, compare_regions, get_market_summary
- `agent/tools/rag_tools.py` — 1 RAG tool: search_market_rules (Databricks Vector Search)
- `agent/rag/index_documents.py` — Document chunking (512-token, 64-token overlap), Delta table upsert, VS index creation and sync trigger
- `agent/evaluation/eval_dataset.py` — 50 Q&A evaluation pairs: 15 factual, 10 forecast, 8 event explanation, 7 comparative, 5 market rules RAG, 5 out-of-scope
- `agent/evaluation/run_evaluation.py` — Evaluation harness with 4-dimension scoring, LLM judge, MLflow tracking, JSON report output

**Notes:**
- LLM model used throughout: claude-sonnet-4-5 (as specified in requirements).
- The /api/chat SSE endpoint implements a full agentic loop (up to 5 tool-call rounds), streaming typed events (text, tool_call, tool_result, done, error) so the React frontend can show live tool execution progress.
- All "latest per partition" SQL queries use QUALIFY + ROW_NUMBER() OVER() for warehouse-scale performance rather than correlated subqueries.
- Agent tools use langchain-anthropic as LLM provider. Swap ChatAnthropic for ChatDatabricks to route through a Databricks External Model endpoint (LiteLLM proxy) if preferred.
- RAG index uses databricks-gte-large-en embeddings with TRIGGERED pipeline sync; switch to CONTINUOUS for near-real-time updates.
- Evaluation scores on: key_fact_coverage (30%), tool_usage (20%), decline_correctness (20%), LLM_judge_quality (30%). Pass threshold: 0.70. Target: 80%+ of pairs pass.
- All Gold table references use the DATABRICKS_CATALOG env var (default: energy_copilot) resolved at runtime.

## ML Models Workstream -- 2026-02-19T00:00:00

**Completed:**
- `models/price_forecast/feature_engineering.py` -- PySpark feature store pipeline writing to gold.feature_store_price; temporal, lag, rolling stats, generation-by-fuel, interconnector, weather (current + NWP +1h/+4h/+24h), cross-regional, and horizon explosion features
- `models/price_forecast/train.py` -- LightGBM multi-horizon price forecast training (5 regions, Optuna 50-trial HPO, MLflow logging, MAE+MAPE+spike metrics, "production" alias registration)
- `models/price_forecast/evaluate.py` -- Backtesting evaluation vs AEMO pre-dispatch baseline; spike recall; per-horizon metrics; gold.price_forecast_evaluation Delta table
- `models/demand_forecast/train.py` -- Demand forecast training (same LightGBM / Optuna structure, target: totaldemand MW, MAPE target < 3%)
- `models/demand_forecast/evaluate.py` -- Demand evaluation with MAPE compliance check vs 3% target
- `models/wind_forecast/train.py` -- Wind generation forecast (target: gen_wind_mw, windspeed_100m NWP as key feature)
- `models/wind_forecast/evaluate.py` -- Wind evaluation with bias and MAPE per region
- `models/solar_forecast/train.py` -- Solar generation forecast (night hours excluded from training, zero-clamp on predictions, target: gen_solar_mw)
- `models/solar_forecast/evaluate.py` -- Solar evaluation with daytime-only MAPE, clear-sky MAE, zero-compliance metric
- `models/anomaly_detection/train.py` -- IsolationForest (sklearn Pipeline with StandardScaler) + rule-based classifier (spike >$5000, negative <-$100, separation >$500 regional spread); registered as "anomaly_detector"
- `models/anomaly_detection/evaluate.py` -- Precision/recall/F1 per event type; ROC-AUC binary anomaly; FP rate on normal periods; falls back to rule-based GT if gold.known_market_events is absent
- `tests/test_models.py` -- Unit tests: mandatory feature columns, null checks, temporal range validation, horizon explosion count, prediction shape (5 regions x 6 horizons = 30), anomaly rule-classifier correctness, IsolationForest extreme-outlier detection, integration test stubs (gated by ENERGY_COPILOT_INTEGRATION_TEST=1)

**Notes:**
- All 5 NEM regions (NSW1, QLD1, SA1, TAS1, VIC1) get individual models for price, demand, wind, solar
- `forecast_horizon` is included as an integer feature (1, 4, 8, 12, 24, 48 x 5-min intervals) so each region trains a single multi-horizon model rather than 6 separate models -- reduces registry footprint and improves generalisation across horizons
- Feature store (gold.feature_store_price) is shared across price, demand, wind, and solar model training; demand/wind/solar add their own target column via a PySpark self-join rather than a separate feature table
- Chronological train/val/test split: 18 months train | 3 months val | 3 months test; split boundaries stored as MLflow run tags so evaluate.py can reproduce the exact split without parameter passing
- Solar training excludes night-time hours (20:00-05:59 AEST approximate) to prevent the model learning trivial zero-output -- predictions are zero-clamped at inference time by the forecast pipeline
- Anomaly model uses the most recent 21 months (train+val equivalent) to maximise coverage of rare events; test window inferred from model tags or defaults to last 90 days
- Known events table (gold.known_market_events) is optional for anomaly evaluation; the module falls back to rule-derived ground truth if the table is absent
- All models are registered in MLflow Model Registry with alias "production"; downstream inference pipeline (pipelines/05_forecast_pipeline.py) loads via models:/<name>@production URI

## Setup/DDL Workstream — 2026-02-19T00:00+11:00
**Completed:**
- setup/00_create_catalog.sql — Creates energy_copilot Unity Catalog with 5 schemas (bronze, silver, gold, ml, tools), RBAC grants for 4 principal groups (admins, data-engineers, ml-engineers, app-users, pipeline service principals)
- setup/01_create_schemas.sql — Full schema definitions with extended COMMENT metadata for all 5 schemas
- setup/02_create_tables.sql — Complete DDL for 40 tables (11 Bronze + 13 Silver + 16 Gold). All tables use Delta format with TBLPROPERTIES for auto-optimise. All high-volume time-series tables partitioned by CAST(interval_datetime AS DATE). Every column has a COMMENT annotation for the Genie semantic layer.
- setup/03_setup_lakebase.sql — Postgres DDL for 3 Lakebase tables: user_preferences (dashboard settings + notification prefs), alert_configs (thresholds, channels, predictive alerting flag), copilot_sessions (JSONB message history, ratings, token tracking). Includes indexes, constraints, and auto-update triggers.
- setup/04_create_genie_spaces.py — Databricks SDK script creating 3 Genie Spaces (NEM Prices & Demand, Generation & Fuel Mix, Interconnectors & Constraints). Each space configured with: table semantic metadata (descriptions + column-level comments), 15 benchmark/sample questions, domain glossary (10-12 terms each). Includes REST API fallback if SDK method not yet GA.
- setup/05_create_alerts.sql — 7 Databricks SQL alert views covering: A1) price threshold >300/MWh (moderate spike), A2) price >1000/MWh (high spike), A3) price >5000/MWh (critical spike), A4) sustained high price for 30+ consecutive minutes, B) demand surge >95th-percentile, C) data staleness >10 minutes, D) ML model drift (price MAE >15/MWh excluding extremes, or demand MAPE >3%), E) predictive price spike (ML spike_probability >=70%), F) interconnector congestion >95% utilisation. Each view includes inline comments specifying alert schedule and notification channels.
- setup/06_register_uc_functions.py — Registers all 14 Unity Catalog SQL functions in energy_copilot.tools for the Mosaic AI agent: get_latest_prices, get_price_history, get_generation_mix, get_interconnector_flows, get_active_constraints, get_fcas_prices (market data); get_price_forecast, get_demand_forecast, get_weather_forecast (forecasting); explain_price_event, compare_regions, get_market_summary (analysis); search_market_rules (RAG/Vector Search); get_generator_info (utility). Full SQL bodies, parameter types, return schemas, and docstrings included.

**Notes:**
- All SQL uses fully qualified names energy_copilot.<schema>.<table> throughout.
- 02_create_tables.sql is the largest file (1,278 lines, ~86KB) and covers the complete medallion architecture. Gold tables include delta.enableChangeDataFeed=true on tables used by the agent (prices, forecasts, anomalies).
- 06_register_uc_functions.py: the compare_regions tool uses a UNION-based pattern because Databricks SQL functions cannot use dynamic pivot. The agent should be told to call this tool separately per metric.
- 04_create_genie_spaces.py: Genie Spaces API is in preview in Databricks SDK. The script includes a REST API fallback (POST /api/2.0/genie/spaces) for workspaces where the SDK method is not yet GA.
- 05_create_alerts.sql creates views only; actual alert objects (schedule + notification destination) must be configured in the Databricks SQL Alerts UI or via REST API after the views are created.
- Run order: 00 -> 01 -> 02 -> 03 (separate Postgres connection) -> 04 -> 05 -> 06.

## Pipelines Workstream — 2026-02-19
**Completed:**
- pipelines/nemweb_downloader.py — polling utility, exponential backoff, Delta dedup tracking
- pipelines/01_nemweb_ingest.py — DLT Autoloader Bronze→Silver→Gold (prices, gen, interconnectors, FCAS pivot)
- pipelines/02_openelec_ingest.py — OpenElectricity API incremental Bronze→Silver→Gold
- pipelines/03_weather_ingest.py — Open-Meteo BOM ACCESS-G Bronze→Silver→Gold with energy-demand derived features
- pipelines/04_solar_ingest.py — APVI rooftop solar Bronze→Silver→Gold (ACT→NSW1 mapping)
- pipelines/05_forecast_pipeline.py — MLflow UC registry model loading, inference, spike alerts
- pipelines/06_market_summary.py — Claude Sonnet 4.5 daily summary pipeline (05:30 AEST)

**Notes:**
- FCAS prices pivoted from 8 columns to long format in Gold for query flexibility
- Gold tables partitioned by interval_date throughout
- All pipelines degrade gracefully when Spark unavailable (unit test mode)
- Market summary uses claude-sonnet-4-5 with no-trading-advice guardrails in system prompt
