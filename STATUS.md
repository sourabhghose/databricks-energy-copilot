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

## Backend Refinements Workstream — Sprint 1
**Completed:** app/backend/main.py (rewritten), app/backend/db.py, app/backend/mock_data.py
**Notes:**
- main.py rewritten with: FastAPI lifespan startup health check (Databricks + Lakebase); per-request structured JSON logging middleware that emits request_id, method, path, status_code, duration_ms; global exception handler returning {"error": "...", "detail": "...", "request_id": "..."} JSON; get_db_cursor() generator dependency raising 503 on warehouse failure; ALLOW_ORIGINS env var for CORS (default "*"); ANTHROPIC_API_KEY is now optional at startup (chat endpoint returns an error SSE event if unset rather than crashing at import time).
- In-memory TTL cache dict with time.monotonic() expiry: /api/prices/latest 10s, /api/generation 30s, /api/interconnectors 30s, /api/forecasts 60s. Cache keys include region/horizon parameters to avoid cross-region collisions.
- All endpoints now raise 404 when DB returns empty rows for a specific region/filter, 503 on DB connectivity failure, 422 via Pydantic for bad request bodies.
- New alerts endpoints: GET /api/alerts (list, filterable by is_active), POST /api/alerts (create, returns 201 with full AlertConfig), GET /api/alerts/:id (single), DELETE /api/alerts/:id (204 No Content). All four delegate to LakebaseClient.upsert / execute / execute_one; fall through to mock data when LAKEBASE_HOST is unset.
- AlertConfig model extended with notification_channel and updated_at fields. AlertCreateRequest model added (threshold_value ge=0 validation).
- db.py: DatabricksSQLClient wraps databricks-sql-connector; exposes execute(), execute_one(), health_check(), and a context-manager cursor(). LakebaseClient wraps psycopg2; exposes execute(), execute_one(), upsert() (INSERT ... ON CONFLICT DO UPDATE), health_check(). Both classes detect missing env vars at __init__ and switch to mock_mode=True, logging a warning.
- mock_data.py: get_mock_latest_prices() — 5-region prices at NSW1=$85, QLD1=$78, VIC1=$92, SA1=$105, TAS1=$71 with +/-5% noise. get_mock_price_history() — sine-wave day shape (morning/evening peaks) + +/-10% noise, 5-min intervals. get_mock_forecasts() — widening confidence bands with horizon distance. get_mock_generation() — per-region realistic fuel mix (e.g. TAS1 82% hydro, SA1 38% wind). get_mock_interconnectors() — 5 NEM interconnectors with plausible base flows. get_mock_alerts() — 3 example alert configs. get_mock_fcas() — 8 FCAS service types with realistic price ranges.
- requirements.txt: added psycopg2-binary==2.9.10. .env.example: added LAKEBASE_PORT, LAKEBASE_DB, LAKEBASE_USER, ALLOW_ORIGINS, LOG_LEVEL entries.

## Agent Tests + Infrastructure Workstream — Sprint 1
**Completed:** tests/test_agent.py, .gitignore, README.md, requirements-dev.txt
**Notes:**
- tests/test_agent.py uses unittest.mock throughout; no real Databricks, Anthropic, or MLflow calls are made. All Databricks SQL connections are patched at the _connection() and _query() helper level rather than at the tool function level, keeping tests stable against future SQL changes. FastAPI endpoint tests use httpx.AsyncClient with ASGITransport (no live server required). The _stream_chat generator is patched in test_chat_endpoint_streams so the full SSE content-type assertion works without touching Anthropic. pytest-asyncio is required for the async test class.
- .gitignore covers Python, Node/React/Vite, Databricks bundle files, MLflow run artefacts, IDE configs (.vscode, .idea), OS noise (.DS_Store), and a comprehensive secrets block (*.key, *.pem, credentials.json, secrets.yml). .env.example is explicitly excluded from the secrets block so the template file remains tracked.
- README.md reproduces the condensed ASCII architecture diagram from IMPLEMENTATION_PLAN.md (4-layer stack), a 3-step Quick Start, a full directory tree with one-line descriptions, the 4 external data sources as a table, and a Sprint Status checklist mirroring the Phase 1 Definition of Done.
- requirements-dev.txt pins pytest, pytest-asyncio, pytest-mock, httpx, unittest-mock, black, ruff, and mypy. unittest-mock (PyPI shim) is included alongside stdlib unittest.mock for toolchain compatibility; the stdlib version is what the test file actually imports.

## Frontend Wiring Workstream — Sprint 1
**Completed:** Home.tsx, LiveMarket.tsx, Forecasts.tsx, PriceTicker.tsx, GenerationChart.tsx, InterconnectorMap.tsx, useMarketData.ts
**Notes:**
- useMarketData.ts: Added useGeneration(region, pollMs=60000) and useInterconnectors(pollMs=30000). Both hooks attempt the real API first and fall back to plausible mock data on error so the UI is never blank. Mock generation defaults: coal 2000 MW, gas 500 MW, wind 800 MW, solar 400 MW, hydro 300 MW, battery ~65 MW. Mock interconnectors match the 5 standard NEM interconnectors with realistic limit values.
- PriceTicker.tsx: Added REGION_FULL_NAMES map (NSW1→"New South Wales", etc.) displayed below the region badge. Price formatted via toLocaleString('en-AU', {minimumFractionDigits:2}) which produces the $X,XXX.XX pattern. Trend icon wrapper uses CSS transition on opacity/transform; card background uses transition on background-color/border-color for smooth price-level colour changes.
- GenerationChart.tsx: Replaced built-in Recharts Legend with a custom colour-swatch legend div below the chart. Added CustomTooltip component showing MW value and % of total for each fuel type at the hovered timestamp. buildMockData() fallback fires when data prop is empty (coal 2000 MW, gas 500 MW, wind 800 MW, solar 400 MW, hydro 300 MW, battery ~65 MW).
- InterconnectorMap.tsx: Redrawn with specified node positions (QLD1 250,60 · NSW1 330,180 · VIC1 280,310 · SA1 130,300 · TAS1 270,420) on 500×450 viewBox. All 5 interconnectors rendered as FlowLine components with SVG marker arrowheads. Murraylink is visually separated from V-SA via a ±12px perpendicular offset and a dashed stroke. Line colour: green (flow>0), red (flow<0), gray (flow=0). Stroke width = 1 + (abs(flowMw)/limitMw)*5, clamped to [1,6]px. STATIC_FLOWS ensure the diagram is always drawn even with no API data.
- Home.tsx: Replaced stub Sparkline with RegionSparkline using usePriceHistory (last 24 hrs, down-sampled to ≤96 pts). Recharts LineChart 120×40 with no axes. Shows animate-pulse skeleton while loading. DemandCard row uses avg_demand_mw and peak_demand_mw from merged regionData (real API prices + static demand placeholders). Last-updated timestamp shown top-right via Clock icon. Error banner downgrades to amber "API unavailable – showing indicative mock data" rather than hard red, since mock data is always shown.
- LiveMarket.tsx: Wired to usePriceHistory, useGeneration, useInterconnectors hooks. Auto-refresh implemented via a 30s setInterval that updates the timeWindow state, causing usePriceHistory to refetch. ReferenceLine at $300 (amber) and $5000 (red, dashed). Spinning RefreshCw icon shows during fetch. Generation and interconnector sections each show animate-pulse skeleton during initial load.
- Forecasts.tsx: Added useAccuracy hook that fetches /api/forecasts/accuracy?region=… with fallback to STATIC_ACCURACY (MAE $10.2/$13.7/$18.5 for 1hr/4hr/24hr; MAPE 8.4%/11.9%/16.3%). Accuracy table colour-codes MAE green/amber/red relative to $12/$15 thresholds. ChartSkeleton component used as loading placeholder for the chart section. isAnimationActive=false on all lines to avoid re-animation on every 30s refresh.

## Data Quality + Registry Workstream — Sprint 1
**Completed:** setup/load_generator_registry.py, tests/test_pipelines.py, tests/test_data_quality.py
**Notes:**
- setup/load_generator_registry.py: Plain Python script (not a notebook). Downloads AEMO NEM Registration and Exemption List XLSX via direct API URL (https://aemo.com.au/aemo/apps/api/report/NEM_REGISTRATION_AND_EXEMPTION_LIST); falls back to --local-csv CLI arg or GENERATOR_REGISTRY_CSV env var. Parses multi-sheet XLSX by finding the header row containing "DUID" (robust to AEMO's varying row offsets). Normalises column names using a column map keyed on lowercased AEMO header strings. Fuel-type mapping uses two-level lookup: fuel_source_primary first (exact then partial-match), then tech_type_primary as tiebreaker; all 10 canonical labels supported (coal, gas, hydro, wind, solar_utility, battery, pumps, liquid, biomass, other). CO2 intensity coefficients (tCO2e/MWh) are injected per fuel_type using Australian NGA Factors 2023 values. region_weather_mapping table built from the 5 hardcoded NEM-region coordinates from Implementation Plan §3.3. Both tables written as Delta with mode=overwrite via PySpark when a session is available; falls back to local delta-rs (or Parquet) for local/CI runs. --dry-run flag skips all writes. Structured JSON logging throughout with graceful error handling; sys.exit(1) on fatal data-source failure.
- tests/test_pipelines.py: 10 unit tests across TestNemwebDownloader (6 tests) and TestProcessedFilesTracker (4 extra + 3 core = all required tests present). All HTTP calls are patched via unittest.mock; no network I/O. In-memory ZIPs built with Python's zipfile module for extract tests. _process_directory is tested directly for the skip-processed case (avoids needing to stub run_once's full loop). Backoff test patches time.sleep to avoid CI slowdowns; side_effect list with 4 ConnectionErrors + 1 success validates MAX_RETRIES=5 call count. Tracker's Spark-write path tested by verifying mock_spark.createDataFrame called and saveAsTable called with PROCESSED_FILES_TABLE constant.
- tests/test_data_quality.py: 4 test classes covering Gold prices (5 tests), Gold FCAS (2 tests), Silver dispatch_gen (2 tests), and generator_registry (3 tests). Each test has a paired "_detects_*" variant that seeds the mock data with the defect and asserts it is caught — this ensures the assertion logic itself is correct and not trivially passing. MockDataFrame backed by pandas provides a Spark-like API (filter, count, dropDuplicates, col(), isin(), isNull()) without requiring PySpark. Integration test classes for all 4 groups are gated by ENERGY_COPILOT_INTEGRATION_TEST=1 and use the real Spark table API (pyspark.sql.functions). NEM price limits set to [-1000, 17000] matching the APC floor and MPC headroom. FCAS prices asserted non-negative (FCAS markets clear at >= 0 by design). Future-interval test uses timezone-naive datetime comparison consistent with NEMWEB SETTLEMENTDATE format.
