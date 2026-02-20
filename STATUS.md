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

## ML Model Depth Workstream — Sprint 2
**Completed:** models/price_forecast/feature_engineering.py (enhanced), models/price_forecast/train.py (enhanced), models/anomaly_detection/train.py (rewritten), models/register_all_models.py (new)
**Notes:**
- `feature_engineering.py`: added five new feature groups to the existing pipeline without breaking backward compatibility. (1) Volatility regime: 5-day (1440-interval) range-based rolling std of spot price, classified into low/medium/high regimes using $/MWh thresholds (20/80). (2) FCAS correlation: `build_fcas_features()` loads `silver.fcas_prices` and produces raise6sec current + 1-interval + 6-interval lags as leading indicators for spike events. (3) Interconnector stress: `build_interconnector_features()` now also aggregates NEM-wide absolute net import (`nem_ic_stress_mw`) alongside existing per-region metrics. (4) Time flags: `is_peak_period` (07:00–09:00 and 17:00–20:00 AEST via UTC+10 shift), `is_business_day` (Mon–Fri, overridden to 0 on public holidays), `days_to_quarter_end` (approximate days to next Q-end for strategic bidding signals). (5) Spike history: range-based rolling count of rrp > $300/MWh over preceding 24h and 7d windows. `build_feature_store()` now explicitly filters `silver.dispatch_prices` to all five NEM regions and logs region count in the completion message.
- `train.py`: expanded Optuna search space to full sprint spec (num_leaves [20,300], learning_rate log [1e-4,0.3], n_estimators [200,2000], min_child_samples [5,100], subsample [0.5,1.0], colsample_bytree [0.5,1.0], lambda_l1/l2 [0,10]). Added `SPIKE_WEIGHT=3.0` sample weights applied to `lgb.Dataset(weight=...)` for all intervals where rrp_target > $300/MWh — improves spike recall without a separate model. Integrated `optuna.integration.lightgbm.LightGBMPruningCallback` alongside `lgb.early_stopping(50)` so bad trials are pruned early. Best hyperparameters are logged both as MLflow params (`best_<k>`) and as run tags (`best_param_<k>`) for programmatic retrieval. Changed registration alias from "production" to "champion" with an explicit code comment explaining that "production" should only be assigned after evaluate.py confirms DoD thresholds (MAE < $15/MWh, spike MAE < $200/MWh). Added `volatility_regime` to `EXCLUDED_COLS` for one-hot encoding via `encode_categoricals()`.
- `anomaly_detection/train.py`: complete rewrite loading from `gold.nem_prices_5min` (with fallback to `gold.feature_store_price`) for 21 months. Features are now engineered in pure pandas: hour_of_day, day_of_week, LabelEncoder region_id, 12-interval rolling mean/std for price and demand. IsolationForest contamination lowered to 0.01 to match the NEM anomaly base rate. Separation rule is computed at the interval level using `groupby("interval_datetime").transform()` so all regions in an interval are flagged consistently. `is_anomaly` is the union of IsolationForest and rule-based flags. Feature importance uses `sklearn.inspection.permutation_importance` with a custom scorer measuring score-distribution variance (native feature importance unavailable for IsolationForest); values logged as individual MLflow metrics. Handles `RESOURCE_DOES_NOT_EXIST` on model registration gracefully. Unit-test mode triggers when `spark=None` or PySpark is not installed, generating synthetic NEM-like data via `_make_synthetic_data()`. Registers to `energy_copilot.ml.anomaly_detection_nem@production`.
- `register_all_models.py`: standalone CLI script using `argparse`. Iterates all 20 regional forecast experiments + anomaly detection experiment. For each model: looks up the latest `phase=final_training` run (region-filtered for forecast models), calls `_ensure_registered_model()` which catches `RESOURCE_DOES_NOT_EXIST` and creates the model if absent, then creates a model version and sets the alias. Anomaly detection falls back to the latest run if no `final_training` tag is present. Prints a formatted ASCII summary table with columns: model_name | run_id (12-char) | metric_value | alias_set | status. `--dry-run` flag skips all write operations. Requires `DATABRICKS_HOST` and `DATABRICKS_TOKEN` env vars; validates at startup. Exit code 1 if any model failed to register.

## Agent + RAG Workstream — Sprint 3
**Completed:** agent/copilot_agent.py (enhanced), agent/rag/index_documents.py (enhanced), agent/tools/rag_tools.py (enhanced), agent/prompt_templates.py (new)
**Notes:**
- Primary vs. fallback agent paths: The agent now has two distinct execution paths. The primary path uses `run_agentic_loop()` (raw Anthropic SDK with `client.messages.create()`) which gives direct control over the tool-call loop, token counting, and stop-reason handling. The secondary path is the existing LangChain `AgentExecutor` kept for local dev convenience via `--use-langchain` CLI flag. Both paths share `MAX_TOOL_ROUNDS = 10` and the same system prompt.
- Security enforcement at the agent layer (not just system prompt): Two independent guards are applied before any tool calls are made. `_is_trading_advice_request()` uses a pre-compiled whole-word regex against `REFUSAL_PATTERNS = ["buy", "sell", "invest", "trade", "position", "short", "long"]` and returns the `REFUSAL_RESPONSE` canned message without touching the LLM. `_contains_injection_token()` checks for known LLM jailbreak tokens (`</s>`, `<|im_end|>`, `<|system|>`, etc.) as case-insensitive substrings and returns `INJECTION_RESPONSE`. Both checks are in the hot path of `predict()` and the interactive REPL.
- Token tracking: `run_agentic_loop()` accumulates `input_tokens` and `output_tokens` across all API calls in the loop (including tool-call rounds) via `response.usage`. These are logged as MLflow metrics (`mlflow.log_metric`) inside the `predict()` nested run, enabling per-session cost visibility in the MLflow experiment.
- Streaming via `stream_predict()`: Uses `client.messages.stream()` context manager and `stream.get_final_message()` to get the final usage stats. Yields typed SSE event dicts (`text`, `tool_call`, `tool_result`, `done`, `error`), matching the event taxonomy the FastAPI `/api/chat` SSE endpoint already expects.
- System prompt is dynamic: `_build_system_prompt()` injects the current AEST date/time (formatted `%Y-%m-%d %H:%M AEST`) and the 5 NEM region codes at every call — not at module import time — so the timestamp is always fresh.
- Tool schema bridge: `_langchain_tool_to_anthropic_tool()` converts LangChain `@tool`-decorated functions (Pydantic `args_schema`) to Anthropic `input_schema` format, allowing the same tool definitions to serve both the LangChain and raw Anthropic paths without duplication.
- RAG index restructured: `index_documents.py` now targets `energy_copilot.gold.aemo_document_chunks` (was `energy_copilot.rag.aemo_document_chunks`) and `energy_copilot.gold.aemo_docs_vs_index` (was `energy_copilot.rag.aemo_documents_vs_index`) to consolidate all Gold assets in one schema. Table schema changed to `chunk_id / content / metadata_json / embedding_model / indexed_at` to store all doc-type-specific metadata in a single JSON blob rather than adding nullable columns per doc type.
- Chunking strategies by doc type: PDFs use `\n\n` paragraph-boundary splitting with a 1500-char target and 200-char overlap sliding-window fallback for oversized paragraphs. XML constraint files use `xml.etree.ElementTree` to emit one chunk per `<ConstraintEquation>` element with the equation ID as `section_title`. HTML notices split on `<h1>`–`<h3>` heading tags after tag-stripping with a pure-regex approach (no BeautifulSoup dependency).
- Deterministic chunk IDs: `_make_chunk()` generates UUIDs from `SHA-256(source_url + "::" + chunk_index)` so re-indexing the same document yields the same `chunk_id` values, making upserts fully idempotent.
- Graceful VS degradation: Both `index_documents.py` and `rag_tools.py` wrap all `VectorSearchClient` usage in `try/except ImportError` + `try/except Exception` blocks. If the SDK is not installed or the endpoint is down, the indexer logs a warning and continues (Delta write still completes). The `search_market_rules` tool falls back to a `spark.sql()` LIKE query against the Delta table, with `_sanitize_sql_query()` stripping single quotes, semicolons, backslashes, and SQL comment sequences before embedding the query in the SQL string.
- `prompt_templates.py`: Centralises all prompt text to make system prompt changes testable in isolation. Contains `SYSTEM_PROMPT_TEMPLATE` (f-string with `{current_datetime_aest}` and `{nem_regions}`), `REFUSAL_RESPONSE`, `ERROR_RESPONSE`, `INJECTION_RESPONSE`, `CLARIFICATION_PROMPTS` dict (8 NEM terminology entries), and `FEW_SHOT_EXAMPLES` list (3 Q&A pairs covering live data, event explanation, and market rules lookup).

## CI/CD + Config Workstream — Sprint 4
**Completed:** .github/workflows/ci.yml, pyproject.toml, .pre-commit-config.yaml, tests/test_models.py (5 new anomaly tests), docs/DEPLOYMENT.md
**Notes:**
- `.github/workflows/ci.yml` has three jobs: `python-tests` (Python 3.11, pytest with `-k "not integration"`, dummy env vars for Databricks/Anthropic so imports succeed), `frontend-build` (Node 20, npm ci + npm run build in app/frontend), and `lint` (ruff with GitHub output format + mypy). All jobs use `ubuntu-latest` only (no cross-platform matrix). pip and npm caches are keyed on the respective lock files using `actions/cache@v4`.
- `pyproject.toml` centralises all tool config: pytest `asyncio_mode=auto` for pytest-asyncio, `filterwarnings` suppressing DeprecationWarning from pydantic/lightgbm/numpy, ruff `F821` ignore so Databricks `spark`/`dbutils` globals do not cause false positives in notebooks, mypy `check_untyped_defs=true` for stricter type checking without requiring full annotations.
- `.pre-commit-config.yaml` uses pinned revisions for ruff (v0.4.9), black (24.4.2), and pre-commit-hooks (v4.6.0). The ruff hook uses `--fix --exit-non-zero-on-fix` so auto-fixable issues are corrected but the commit is still blocked, requiring a re-stage.
- The 5 new tests in `TestAnomalyDetection` use `classify_events_rule()` from `models.anomaly_detection.train` directly (imported at test time to avoid top-level PySpark dependency). `test_isolation_forest_unit_test_mode` patches all MLflow calls (`set_experiment`, `start_run`, `log_params`, `log_metrics`, `sklearn.log_model`, `log_artifact`, `MlflowClient`) so the full train path runs in-process with synthetic data and no network I/O.
- `docs/DEPLOYMENT.md` covers all 9 deployment steps, a complete environment variables table, and three common troubleshooting scenarios (missing secret scope, wrong catalog, VS index not ready).

## Deployment + Monitoring Workstream — Sprint 4
**Completed:** databricks.yml, setup/07_setup_monitoring.py, Makefile, app/frontend/.env.example, app/backend/main.py (market-summary endpoint added)
**Notes:**
- `databricks.yml` uses DAB v2 schema (`targets:`, not `environments:`). Two targets defined: `dev` (mode: development, catalog: energy_copilot_dev) and `prod` (mode: production, catalog: energy_copilot). Variable substitution `${var.catalog}` is threaded through all job `base_parameters` and DLT pipeline `configuration` blocks so a single bundle deploy switches the catalog without touching notebook code.
- Job schedules: job_01_nemweb_ingest and job_05_forecast_pipeline run on `0 */5 * * * ?` (every 5 min); jobs 02/03/04 run every 30 min on staggered cron offsets (`:00`, `:10`, `:20`) to avoid thundering-herd on the SQL warehouse. job_06_market_summary uses `0 30 19 * * ?` UTC which is 05:30 AEST (UTC+10).
- Cluster policy: all jobs use `SPOT_WITH_FALLBACK` with `first_on_demand: 1` to keep one on-demand driver for reliability. Autoscale 2–8 workers, DBR 15.4 LTS on ingest/summary jobs, and DBR 15.4 LTS ML (`15.4.x-ml-scala2.12`) on the forecast job which requires scikit-learn and lightgbm pre-installed. Photon enabled on all clusters for Delta write acceleration.
- DLT pipelines mirror jobs 01–04 as `resources.pipelines` entries. `development: ${bundle.target == "dev"}` enables DLT development mode (no auto-retry, cheaper) on the dev target automatically.
- MLflow experiments are declared under `resources.experiments` for all five model types (price, demand, wind, solar, anomaly); paths follow the `/Shared/energy_copilot/experiments/<type>_forecast` convention used by the training scripts.
- `setup/07_setup_monitoring.py` follows the Databricks notebook source convention (`# Databricks notebook source` header, `# COMMAND ----------` separators). Uses `databricks.sdk.WorkspaceClient` and `w.quality_monitors.create()`. Regression monitors (`MonitorInferenceLog` with `PROBLEM_TYPE_REGRESSION`) are created for price/demand/wind/solar gold tables; a snapshot-based custom monitor is created for `daily_market_summary`. All five monitors share a daily 07:00 UTC schedule (`MonitorCronSchedule`). `ResourceAlreadyExists` is caught and logged as a warning so the notebook is safely re-entrant.
- Drift thresholds are implemented as `MonitorCustomMetric` objects of type `AGGREGATE`. JS divergence uses a symmetric log-ratio approximation expressible in Spark SQL (Lakehouse Monitoring evaluates metrics as SQL against the profile data). MAE relative increase is computed as `(current_mae - baseline_mae) / baseline_mae`; a value > 0.25 represents a 25%+ regression. Slicing by `region_id` and `horizon_hours` means the drift metrics are computed per-region per-horizon, enabling fine-grained alerting.
- `GET /api/market-summary/latest` queries `energy_copilot.gold.daily_market_summary ORDER BY summary_date DESC LIMIT 1`. Response fields: `summary_date`, `narrative`, `model_id`, `generated_at`, `word_count`, `generation_succeeded`. Cached for 3600 s (`_TTL_MARKET_SUMMARY`) because the pipeline only writes once per day. Any DB exception falls back to `_MOCK_MARKET_SUMMARY` rather than raising 503, keeping the dashboard functional when the warehouse is cold.
- `app/frontend/.env.example` exposes four Vite-prefixed variables: `VITE_API_BASE_URL`, `VITE_APP_TITLE`, `VITE_ENABLE_MOCK_DATA`, `VITE_GENIE_SPACE_ID`. The file is committed; developers copy it to `.env.local` (gitignored) for local overrides.
- Makefile uses GNU Make tab-indented recipes throughout. The `help` target auto-generates usage from `## comment` annotations using `grep` + `awk` so the list stays in sync with target definitions without manual maintenance.

## Frontend Completion Workstream — Sprint 4
**Completed:** app/frontend/src/pages/Copilot.tsx (rewritten), app/frontend/src/components/ChatInterface.tsx (enhanced), app/frontend/src/pages/Alerts.tsx (enhanced), app/frontend/src/pages/Genie.tsx (enhanced), app/frontend/src/api/client.ts (enhanced)
**Notes:**
- `Copilot.tsx` rewritten as a full-featured page. `ChatInterface` is now a `forwardRef` component exposing an imperative `ChatInterfaceHandle` with `clearChat()`, `sendQuestion()`, and `focusInput()` methods. The Copilot page holds all telemetry state (token counter, session stats, API error indicator) and receives it from `ChatInterface` via `onDoneEvent` and `onApiError` callback props rather than prop-drilling into the SSE stream. The collapsible 200px sidebar uses CSS `w-[200px]` and a `ChevronLeft`/`ChevronRight` toggle button overlaid on the chat area edge. Cmd/Ctrl+K global keyboard shortcut uses a `window.addEventListener` effect that calls `chatRef.current?.focusInput()`.
- Token counting is done by parsing the `event: done` SSE frame in `ChatInterface` (which carries `{"input_tokens": X, "output_tokens": Y}`). The parsed values are passed to the parent via `onDoneEvent(inputTokens, outputTokens, elapsedMs)`; the Copilot page accumulates them with `setTotalTokens(prev => prev + input + output)`. The `performance.now()` API provides sub-millisecond timing for the avg response time stat.
- `Alerts.tsx` now owns its own data-fetching directly via `api.getAlerts()` rather than the `useAlerts` hook (which had no fallback); falls back to `MOCK_ALERTS` on error with an amber banner. The `Alert` interface was extended with optional `isActive` and `notificationChannel` fields. The create modal posts to `api.createAlert()` and degrades gracefully to a local optimistic mock on network failure. Delete uses optimistic removal then `api.deleteAlert()` with re-fetch on error. Toggle is fully optimistic with a `TODO` comment marking the `PATCH /api/alerts/:id` stub. Severity is derived from thresholds: RED ≥$5000, ORANGE ≥$300, YELLOW ≥$100, GREY otherwise; per-row left-border color coding uses Tailwind's `border-l-4` with severity-matched colors.
- `Genie.tsx` now checks both `VITE_GENIE_SPACE_ID` and `VITE_GENIE_URL`. When `VITE_GENIE_SPACE_ID` is set (but no explicit URL), the iframe URL is constructed as `https://<workspace>.azuredatabricks.net/genie/spaces/<space-id>` — developers are expected to also set the full `VITE_GENIE_URL` for production. Preset query buttons send `{ type: "genie_query", query }` via `window.postMessage` to the iframe's `contentWindow`; the Genie app must handle this message type (Databricks Genie spaces do not have a published postMessage API as of 2026-02, so this is forward-compatible plumbing). The Genie info box is always shown above the iframe/setup panel.
- `api/client.ts` adds: `createAlert(AlertCreateRequest) → Alert` (POST /api/alerts), `deleteAlert(id) → void` (DELETE /api/alerts/{id}), `getMarketSummary() → MarketSummaryRecord` (GET /api/market-summary/latest). Internal `post<TBody, TResponse>()` and `del()` helpers added. The `Alert` interface extended with optional `isActive` and `notificationChannel` fields to match the Lakebase `alert_configs` schema documented in Sprint 1. New interfaces `AlertCreateRequest` and `MarketSummaryRecord` exported.

## Frontend Polish + Dev Infrastructure Workstream — Sprint 5
**Completed:** app/frontend/src/pages/Home.tsx (market summary widget), tests/conftest.py (shared pytest fixtures), docker-compose.yml, app/backend/Dockerfile, app/frontend/Dockerfile.dev
**Notes:**
- Home.tsx market summary widget: calls api.getMarketSummary() on mount, shows loading skeleton (animate-pulse), renders narrative in overflow-y-auto max-h-48 card with date/word-count/model badges. Placed between PriceTicker row and lower dashboard content. "Powered by Claude Sonnet 4.5" attribution badge with Zap icon.
- conftest.py: mock_spark (MagicMock with table/sql/createDataFrame methods), mock_anthropic_client (messages.create returning mock text), databricks_env autouse fixture (sets dummy DATABRICKS_HOST/TOKEN/ANTHROPIC_API_KEY). IS_INTEGRATION constant. All fixtures use try/except ImportError for pyspark.
- docker-compose.yml: backend service (build from repo root, port 8000, .env.local, volumes for agent/ and models/), frontend service (Dockerfile.dev, port 5173, VITE_API_BASE_URL, depends_on backend healthcheck). Backend healthcheck uses GET /api/health.
- Dockerfiles: backend Dockerfile copies app/backend/, agent/, models/ into /app (built from repo root context). Frontend Dockerfile.dev is a Node 20 slim dev-only image with npm run dev --host 0.0.0.0.

## Backend Quality + Deployment Workstream — Sprint 5
**Completed:** tests/test_backend.py (FastAPI integration test suite), app/app.yaml (Databricks Apps config)
**Notes:**
- test_backend.py: 5 test classes covering health, prices (latest + history), forecasts, generation, alerts (list/create/delete), and chat (streaming). All tests use FastAPI TestClient (no live services). Module-level env var stubs enable mock_mode in DatabricksSQLClient/LakebaseClient. TestChatEndpoint tests that the /api/chat endpoint returns a 200 with either SSE or JSON content-type. Alert DELETE 404 test validates Lakebase 404 propagation. create_alert validates request body schema enforcement.
- app/app.yaml: Databricks Apps v2 config using `command:` (uvicorn with 2 workers). Env vars use `valueFrom.fieldRef` for auto-injected DATABRICKS_HOST/TOKEN, `valueFrom.secretRef` for Anthropic key and Lakebase creds (scope: energy_copilot). Static values for DATABRICKS_CATALOG, LOG_LEVEL, PYTHONPATH=/app. The PYTHONPATH=/app ensures that `import agent.*` and `import models.*` resolve correctly when the app is deployed with the repo structure mounted at /app.

## CI + Config Quality Workstream — Sprint 6
**Completed:** pyproject.toml (pythonpath fix), .github/workflows/ci.yml (PYTHONPATH env var), .dockerignore, setup.py stub, .gitignore updates
**Notes:**
- pyproject.toml: Added `pythonpath = ["."]` to `[tool.pytest.ini_options]`. This is required for `from app.backend.main import app` in test_backend.py and `from models.anomaly_detection.train import classify_events_rule` in test_models.py to resolve from the repo root. pytest 7+ supports the `pythonpath` ini option natively.
- ci.yml: Added `PYTHONPATH: .` to python-tests job env (belt-and-suspenders alongside pyproject.toml pythonpath config). This ensures the env var is set even if an older pytest version is used or if pyproject.toml pythonpath support is not available.
- .dockerignore: Excludes .git, Python bytecode, node_modules, .databricks, docs, and test artifacts from Docker build context. Keeps image build fast and prevents credential files from being accidentally included.
- setup.py: Stub enabling `pip install -e .` for editable installs, useful in CI if any tool resolves the package via setuptools.

## Wind + Solar Model Enhancement — Sprint 6
**Completed:** models/wind_forecast/train.py (rewritten, ~380 lines), models/solar_forecast/train.py (rewritten, ~380 lines)
**Notes:**
- wind_forecast/train.py: 6 wind-specific features added (lags 1-12, 4h rolling stats, ramp rate, capacity factor, high/low wind flags). Optuna 50 trials, MedianPruner, MAE objective. MAPE target <8%. Feature importances logged as JSON. Unit test mode with synthetic sine-wave wind data. Alias = "production".
- solar_forecast/train.py: 7 solar-specific features (lags, capacity factor, daylight flag, sun angle proxy, season sin/cos, cloud proxy). Night interval exclusion from training to prevent trivial-zero fitting. Optuna 50 trials, MAE objective. MAPE target <10%. Alias = "production".


## Sprint 7b — Agent Eval CI + Production Hardening — 2026-02-19
**Completed:** .github/workflows/ci.yml (agent-eval job, syntax-check lint), agent/evaluation/run_evaluation.py (--dry-run/--max-pairs/--output-file/mock mode), app/backend/main.py (rate limiting middleware, X-Request-ID header, /api/market-summary/latest extended fields), tests/test_backend.py (rate limit + market summary tests)
**Notes:**
- ci.yml: `agent-evaluation` job added with `needs: python-tests`; runs `--dry-run --max-pairs 5` for fast CI; uploads eval-report.json as artifact. `lint` job extended with `find agent/models -name "*.py" -exec python -m py_compile {} \;` syntax checks.
- run_evaluation.py: `--dry-run` wraps all `mlflow.*` calls; `--max-pairs N` slices `ALL_EVAL_PAIRS[:N]`; `--output-file PATH` writes CI-format JSON with `pass_rate`, `total_pairs`, `passed`, `failed`, `scores_by_dimension`. Mock LLM judge (score=0.8) activated when `ANTHROPIC_API_KEY` starts with `sk-ant-dummy` or `sk-ant-test`.
- main.py: In-process per-IP rate limiter middleware added before logging middleware using `defaultdict(list)` timestamp store; configurable via `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW_SECONDS` env vars. X-Request-ID response header was already present. `MarketSummaryRecord` extended with `summary_id`, `summary_text`, `highest_price_region`, `lowest_price_region`, `avg_nem_price` optional fields; mock data updated with NSW1 highest, TAS1 lowest, avg_nem_price=$86.20.
- test_backend.py: `TestRateLimiting` class added with `test_rate_limit_not_triggered_by_single_request` and `test_market_summary_endpoint` covering the new endpoint fields.

## Sprint 7a -- Wind/Solar Evaluate Depth -- 2026-02-19
**Completed:** models/wind_forecast/evaluate.py (rewritten ~400 lines), models/solar_forecast/evaluate.py (rewritten ~450 lines), tests/test_models.py (4 new evaluate tests added in TestRenewableEvaluate class)
**Notes:**
- `wind_forecast/evaluate.py`: Full rewrite from 151 to ~400 lines. Reconstructs the exact Sprint 6 feature set (wind_lag_1-12, wind_roll_mean/std_4h, wind_ramp_rate, wind_capacity_factor, is_high/low_wind, hour/dow/month sin+cos). Loads 'production' alias from `models:/energy_copilot.ml.wind_forecast_{region}@production`. Computes: MAE, RMSE, MAPE, capacity-weighted bias (bias/installed_capacity), ramp accuracy (% matching up/down/flat within 50 MW deadband), high-wind MAPE (speed > 10 m/s), low-wind MAPE (speed < 3 m/s). Writes to `gold.wind_forecast_evaluation` Delta table with passed_dod BOOLEAN. MLflow metrics logged as `wind_{region}_{metric}`. Promotion logic: if ALL regions MAPE < 8% sets 'champion' alias. Rich console table with NEM-wide capacity-weighted summary row. Unit-test mode (spark=None) uses synthetic sine+noise wind data; persistence baseline replaces model. CLI: `--region / --all-regions / --promote / --unit-test`.
- `solar_forecast/evaluate.py`: Full rewrite from 189 to ~450 lines. Matches train.py night exclusion (NIGHT_HOURS = hours 0-5 + 20-23). Reconstructs: solar_lag_1-12, solar_roll_mean/std_4h, solar_capacity_factor, is_daylight_hour, sun_angle_proxy, season_sin/cos, cloud_proxy, hour/dow sin+cos. Loads 'production' alias from `models:/energy_copilot.ml.solar_forecast_{region}@production`. Computes: daytime MAPE (primary, target < 10%), clear-sky MAE (cloud_proxy < 0.2), zero-compliance (% night preds correctly clamped to 0), overall MAE/RMSE, seasonal MAPE (DJF/MAM/JJA/SON). Writes to `gold.solar_forecast_evaluation` with full schema including all seasonal columns. MLflow metrics as `solar_{region}_{metric}`. Promotion on daytime MAPE < 10%. Two-section console output: core metrics + seasonal breakdown. Unit-test mode uses Gaussian daylight bell-curve data (zero at night). CLI: `--region / --all-regions / --promote / --unit-test`.
- `tests/test_models.py`: Added `TestRenewableEvaluate` class with 4 tests: `test_wind_evaluate_unit_mode` (asserts run_evaluation(spark=None) returns valid region dicts for NSW1+VIC1), `test_solar_evaluate_unit_mode` (asserts daytime_mape_pct/zero_compliance_pct/passed_dod for QLD1+SA1), `test_ramp_accuracy_computation` (verifies compute_ramp_accuracy gives 100% for perfect forecast and [0,100] for zeros baseline), `test_zero_compliance` (verifies 70% for 7/10 near-zero preds, 100% for all-zero preds, NaN for daytime-only rows). All tests verified passing in-process without Spark, MLflow, or LightGBM.


## Sprint 7c - Frontend Polish + CHANGELOG + Demand Evaluate - 2026-02-19
**Completed:** models/demand_forecast/evaluate.py (rewritten ~380 lines), app/frontend/src/pages/LiveMarket.tsx (region selector + localStorage, spike indicator, FUEL_COLORS, empty state), app/frontend/src/pages/Forecasts.tsx (localStorage region, confidence band, accuracy badge), CHANGELOG.md (full sprint history)
**Notes:** evaluate.py adds reconstruct_features() with all 22 demand features (12 lags, 2 rolling stats, 6 cyclical encodings, 3 calendar flags, 5 temperature cols), peak/off-peak MAPE, per-season MAPE (DJF/MAM/JJA/SON), major miss rate (>500 MW), champion promotion, unit-test mode with synthetic 5000 MW base + daily sine + weekday boost. LiveMarket.tsx adds SpikeBadge (amber >$300, red >$5000), EmptyStateCard with AlertCircle, FUEL_COLORS constant at top, localStorage persistence for region. Forecasts.tsx adds localStorage region state, AccuracyBadge (green/amber/red by MAPE threshold), MAE confidence band as translucent grey Area behind forecast line.

## Sprint 8b — Forecast + Market Summary Pipeline — 2026-02-19
**Completed:** pipelines/05_forecast_pipeline.py (rewritten ~350 lines, production inference with version tracking, spike probability, confidence scores, stale-mode fallback), pipelines/06_market_summary.py (rewritten ~280 lines, Claude Sonnet 4.5 narrative generation with quality checks, retry logic, template fallback)
**Notes:** Forecast pipeline loads 20 regional models from MLflow @production, clamps predictions to physical bounds, writes MERGE upsert to gold.nem_forecasts_realtime. Market summary pipeline assembles structured context from 5 Gold tables, generates 400-600 word narrative via Claude Sonnet 4.5, validates quality before writing to gold.daily_market_summary.

## Sprint 8a -- Price + Anomaly Evaluate Depth -- 2026-02-19
**Completed:** models/price_forecast/evaluate.py (rewritten ~1057 lines), models/anomaly_detection/evaluate.py (rewritten ~971 lines)
**Notes:** Price evaluation adds spike recall (% of actual spikes >$300/MWh correctly predicted), per-horizon MAE (one row per forecast_horizon in 1,4,8,12,24,48), volatility-regime breakdown (MAE per low/medium/high regime), AEMO pre-dispatch baseline comparison from silver.dispatch_prices P5MIN column, DoD thresholds (MAE <$15/MWh AND spike MAE <$200/MWh AND MAPE <12%), champion promotion when all 5 NEM regions pass. Feature reconstruction mirrors feature_engineering.py exactly: hour/dow/month sin+cos, is_peak_period (07-09 and 17-20 AEST), is_business_day, days_to_quarter_end, price lags 1-48, rolling mean/std (30min/1h/4h/24h), price_std_5day volatility regime one-hot, spike_count_24h/7d, raise6sec_price_lag1/lag6, nem_ic_stress_mw. MLflow metrics named price_{region}_{metric}. Anomaly evaluation adds per-event-type precision/recall/F1 (spike/negative/separation), ROC-AUC for binary anomaly score, false positive rate on confirmed-normal intervals (DoD: <5%), alert storm rate (% of intervals in consecutive anomaly runs >3). Feature reconstruction matches train.py engineer_features() exactly: hour_of_day, day_of_week (Mon=0), LabelEncoder region_id_encoded, price_roll_mean_12/std_12, demand_roll_mean_12/std_12. Ground truth: gold.known_market_events primary, rule-derived fallback. MLflow metrics named anomaly_{region}_{metric}. Both scripts support unit-test mode (spark=None) with synthetic data.

## Sprint 8c — System Monitoring Frontend — 2026-02-19
**Completed:** app/backend/main.py (/api/system/health endpoint, ModelHealthRecord + SystemHealthResponse Pydantic models), app/frontend/src/api/client.ts (SystemHealthResponse + ModelHealthRecord interfaces + getSystemHealth method), app/frontend/src/pages/Monitoring.tsx (new page ~300 lines: infra health cards, model registry grid, auto-refresh, loading skeletons), app/frontend/src/App.tsx (Monitoring route + nav link with Activity icon)
**Notes:** Monitoring page shows 4 infra health cards (Databricks, Lakebase, data freshness, pipeline last-run) and a region×model-type grid for all 21 ML models. Auto-refreshes every 30s. Stopped a stuck subagent that was using base64-encoding to work around JSX template-literal escaping — rewrote Monitoring.tsx directly.

## Sprint 9a — README + Test Coverage — 2026-02-19
**Completed:** README.md (full rewrite ~300 lines: architecture ASCII diagram, quick start, project structure, ML model table, API table, sprint checklist), tests/test_backend.py (TestSprintEightEndpoints: 4 new tests for /api/system/health and extended /api/market-summary/latest validation)
**Notes:** README now reflects the full production architecture. System health endpoint verified to return correct model count (21) and per-model structure.

## Sprint 9b — Agent Tools Expansion + Eval Dataset — 2026-02-19
**Completed:** agent/tools/analysis_tools.py (3 new tools: get_anomaly_events, get_model_health, get_forecast_accuracy — all with mock fallback), agent/tools/__init__.py (ALL_TOOLS updated), agent/evaluation/eval_dataset.py (10 new Q&A pairs: anomaly events, model health, forecast accuracy, multi-tool chains, out-of-scope declines)
**Notes:** get_anomaly_events queries gold.anomaly_detection_results with region/time/type filters. get_model_health queries MLflow UC registry for all 21 models. get_forecast_accuracy reads evaluation Delta tables. All tools degrade to mock data when Databricks unavailable.

## Sprint 9c — Model Serving + Batch Scoring — 2026-02-19
**Completed:** databricks.yml (model_serving_endpoints for price_forecast + anomaly_detection, auto-capture logging to ml schema, RBAC permissions), notebooks/batch_scoring.py (Databricks notebook ~250 lines: load 21 models from MLflow, batch inference for all regions+horizons, physical clamping, spike probability, write to gold.nem_forecasts_batch), databricks.yml job_05 updated with batch_scoring_notebook task dependency
**Notes:** Model serving endpoints use scale_to_zero to minimize cost when idle. Auto-capture logs all serving requests/responses to Delta for drift monitoring. Batch notebook separates the heavy model-loading step from the real-time inference pipeline (05_forecast_pipeline.py handles near-real-time 5-min intervals; batch notebook handles daily full-history scoring).

## Sprint 10a — API Auth + OpenAPI Docs — 2026-02-19
**Completed:** app/backend/main.py (FastAPI OpenAPI metadata, API key auth middleware via X-API-Key header, /api/version endpoint, Depends(verify_api_key) on all /api/* routes), app/backend/.env.example (ENERGY_COPILOT_API_KEY + rate limit vars), tests/test_backend.py (TestApiKeyAuth: 3 tests), CHANGELOG.md (Sprint 10 section)
**Notes:** API auth is opt-in — set ENERGY_COPILOT_API_KEY env var to enable; unset (default) disables auth for dev/mock mode. All existing tests continue to pass since ENERGY_COPILOT_API_KEY is not set in test env.

## Sprint 10b — DLT Expectations + Data Quality Pipeline — 2026-02-19
**Completed:** pipelines/01_nemweb_ingest.py (@dlt.expect/@dlt.expect_or_drop/@dlt.expect_all_or_drop on all Bronze/Silver/Gold tables, comment= annotations), pipelines/08_data_quality_report.py (new ~280 lines: DLT event log metrics, table freshness, row count trends, null rate scan, writes to gold.data_quality_daily_report, alert stub), databricks.yml (job_08_data_quality_report scheduled 06:00 AEST)
**Notes:** DLT expectations use expect_or_drop for Silver/Gold (hard failures drop bad rows) and expect for Bronze (warnings preserve raw data for debugging). Data quality pipeline queries DLT event log via event_log() TVF; falls back gracefully when event log unavailable. Overall status (green/amber/red) drives alert routing.

## Sprint 10c — Dark Mode + Mobile Responsive — 2026-02-19
**Completed:** app/frontend/src/hooks/useDarkMode.ts (new hook: localStorage + prefers-color-scheme, applies .dark class to <html>), app/frontend/tailwind.config.js (darkMode: 'class'), app/frontend/src/App.tsx (TopBar dark mode toggle with Moon/Sun icon, Sidebar + container dark classes), app/frontend/src/pages/Home.tsx (dark mode class additions), app/frontend/src/pages/Monitoring.tsx (dark mode class additions), app/frontend/src/index.css (dark mode base styles)
**Notes:** Dark mode uses Tailwind's class strategy (.dark on documentElement) for maximum control. Preference persisted to localStorage. System preference used as initial fallback. All 7 pages have dark mode support added to page-level containers; chart components (Recharts) are left with their existing colors as they render on white/transparent backgrounds.

## Sprint 11b — Conversation Session Persistence — 2026-02-19
**Completed:** app/backend/main.py (5 new session endpoints: list/get/create/rate/delete, ChatRequest.session_id, mock session storage dict), app/frontend/src/api/client.ts (CopilotSession + SessionMessage types, 5 session API methods), app/frontend/src/pages/Copilot.tsx (Sessions tab in sidebar: session history list, New Session button, session selection loads history), tests/test_backend.py (TestSessionEndpoints: 4 session tests)
**Notes:** Sessions stored in Lakebase copilot_sessions table in production; in mock mode uses in-process _MOCK_SESSIONS dict. session_id optional on ChatRequest — when provided, messages are appended to the session record. Star ratings (1-5) persist to Lakebase for agent quality tracking.

## Sprint 11a — Historical Backfill Pipeline — 2026-02-19
**Completed:** pipelines/00_historical_backfill.py (new ~300 lines: month-by-month NEMWEB archive download, ThreadPoolExecutor parallelism, BackfillTracker for resume support, Bronze Delta write with dedup, dry-run mode, unit test mode, CLI), pipelines/nemweb_downloader.py (NEMWEB_FILE_TYPES registry, checksum verification, DownloadMetrics dataclass, URL health check)
**Notes:** Backfill pipeline iterates month-by-month over NEMWEB MMSDM archive URLs. ThreadPoolExecutor downloads 4 months in parallel (configurable). BackfillTracker skips already-completed files, making re-runs safe. Unit test mode generates synthetic CSV to validate pipeline without internet access.

## Sprint 11c — Multi-region Comparison + CSV Export — 2026-02-19
**Completed:** app/backend/main.py (/api/prices/compare endpoint: pivoted multi-region price series, configurable interval aggregation, mock data with per-region sine offsets), app/frontend/src/api/client.ts (RegionComparisonPoint type, getPricesCompare method, exportToCSV utility), app/frontend/src/pages/Forecasts.tsx (Compare Regions tab: 5-region LineChart, time range + interval pickers, region toggles, CSV download), app/frontend/src/pages/LiveMarket.tsx (Export CSV button on price chart)
**Notes:** /api/prices/compare returns a pivoted response (one row per timestamp, one column per region) to minimize frontend aggregation. exportToCSV handles null values and comma-escaping for clean CSV output. Region colours are consistent across all charts: NSW1=blue, QLD1=amber, VIC1=purple, SA1=red, TAS1=green.

## Sprint 12a — Constraint & FCAS Analysis — 2026-02-19
**Completed:** app/backend/main.py (GET /api/constraints: binding constraint records with marginalvalue/violationdegree, GET /api/fcas: 8-service FCAS prices with clearings), app/frontend/src/api/client.ts (ConstraintRecord + FcasRecord types, getConstraints/getFcas methods), app/frontend/src/pages/MarketDepth.tsx (new page: Binding Constraints tab with horizontal bar chart + table, FCAS Markets tab with price + cleared MW charts), app/frontend/src/App.tsx (MarketDepth route + nav item)
**Notes:** Constraint analysis shows top binding constraints by marginal value (cost of constraint in $/MW). FCAS tab provides breakdown of all 8 ancillary services (Raise/Lower × 6sec/60sec/5min/Reg). Both tabs auto-refresh on region/time range change.

## Sprint 12b — Alert Notification Dispatch — 2026-02-19
**Completed:** app/backend/main.py (GET /api/alerts/history: trigger event log, GET /api/alerts/stats: alert summary stats, POST /api/alerts/test-notification: webhook dispatch test), app/frontend/src/api/client.ts (AlertTriggerEvent + AlertStats types, 3 new alert API methods), app/frontend/src/pages/Alerts.tsx (stats bar, Alert History tab with region filter, Test Notification inline form), tests/test_backend.py (TestAlertEndpoints: 3 tests)
**Notes:** Notification dispatch supports Slack webhook (POST JSON), email (simulated), and generic webhook. In mock mode all notifications return success without network calls. Alert history queryable by region and time range. Stats endpoint aggregates from both active alerts and trigger event log.

## Sprint 12c — Forecast Confidence Intervals — 2026-02-19
**Completed:** app/backend/main.py (ForecastRecord updated with price_p10/p90/demand_p10/p90/forecast_confidence optional fields, mock CI generation with horizon-scaled width, GET /api/forecasts/summary endpoint), app/frontend/src/api/client.ts (ForecastPoint CI fields, ForecastSummary interface, getForecastSummary method), app/frontend/src/pages/Forecasts.tsx (ComposedChart with CI band, Model Performance MAPE table, confidence score bar, show/hide CI toggle), tests/test_backend.py (TestForecastEndpoints: 3 tests), CHANGELOG.md (Sprint 12c section)
**Notes:** CI band width scales with sqrt(horizon_hours/24) — wider intervals at longer horizons. Confidence score decays linearly from 1.0 at 0h to minimum 0.4. MAPE values from gold.forecast_evaluation table in production; static mock values in mock mode.

## Sprint 13b — Price Spike & Volatility Analysis — 2026-02-19
**Completed:** app/backend/main.py (PriceSpikeEvent/VolatilityStats/SpikeAnalysisSummary Pydantic models, GET /api/prices/spikes with region/hours_back/spike_type filters, GET /api/prices/volatility returning per-region volatility stats with CPT utilisation), app/frontend/src/api/client.ts (PriceSpikeEvent/VolatilityStats/SpikeAnalysisSummary interfaces, getPriceSpikes/getVolatilityStats methods), app/frontend/src/pages/PriceAnalysis.tsx (new ~450-line page: volatility cards, CPT progress bar, spike events table with type filters, regional volatility BarChart), app/frontend/src/App.tsx (price-analysis route + nav item), tests/test_backend.py (TestPriceSpikeEndpoints: 3 tests)
**Notes:** CPT (Cumulative Price Threshold) = $1,359,100 over 7-day rolling window. When reached, AEMO can suspend the spot market and invoke administered pricing. SA1 modelled as most volatile (high wind, gas peakers). TAS1 least volatile (predominantly hydro). Spike types: high (>$300), voll (>$15000), negative (<$0).

## Sprint 13c — Interconnector Flows & NEM Settlement — 2026-02-19
**Completed:** app/backend/main.py (InterconnectorRecord/InterconnectorSummary/SettlementRecord Pydantic models, GET /api/interconnectors with 5 NEM interconnector mock flows + congestion detection, GET /api/settlement/summary with per-region FCAS+spot prices), app/frontend/src/api/client.ts (InterconnectorRecord/InterconnectorSummary/SettlementRecord interfaces, getInterconnectorsSummary/getSettlementSummary methods), app/frontend/src/pages/Interconnectors.tsx (new ~400-line page: SVG NEM topology diagram with flow direction + congestion labels, interconnector detail table with utilisation %, settlement summary table with FCAS prices), app/frontend/src/App.tsx (interconnectors route + nav item), tests/test_backend.py (TestInterconnectorEndpoints: 3 tests)
**Notes:** NEM interconnectors: NSW1-QLD1 (1078MW limit), VIC1-NSW1 (1600MW), VIC1-SA1 (500MW), V-SA Heywood (650MW), T-V-MNSP1 Basslink (478MW HVDC). Congestion flag when flow ≥ 95% of limit. Settlement records include FCAS ancillary service prices (raise/lower reg + 6sec) alongside spot price.

## Sprint 13a — Generator Fleet Dashboard — 2026-02-19
**Completed:** app/backend/main.py (GeneratorRecord/GenerationMixRecord/GenerationSummary Pydantic models, GET /api/generation/units with region/fuel_type/min_output filters, GET /api/generation/mix with weighted carbon intensity calculation), app/frontend/src/api/client.ts (GeneratorRecord/GenerationMixRecord/GenerationSummary interfaces, getGenerationUnits/getGenerationMix methods), app/frontend/src/pages/GeneratorFleet.tsx (new ~400-line page: summary cards, donut PieChart fuel mix, renewable vs fossil progress bar, sortable generator units table with status badges), app/frontend/src/App.tsx (generator-fleet route + nav item), tests/test_backend.py (TestGenerationEndpoints: 3 tests)
**Notes:** Carbon intensity computed as weighted average of per-fuel-type CO2 factors. Capacity factor = current_output / registered_capacity. Generator status badges: High (>80% CF), Running (>20% CF), Low otherwise. Fuel type colors consistent across charts.

## Sprint 14a — Market Notices & Dispatch Interval Analysis — 2026-02-19
**Completed:** app/backend/main.py (MarketNotice/DispatchInterval/DispatchSummary Pydantic models, GET /api/market/notices with severity/type filters, GET /api/dispatch/intervals with 5-min interval series + pre-dispatch comparison), app/frontend/src/api/client.ts (MarketNotice/DispatchInterval/DispatchSummary interfaces, getMarketNotices/getDispatchIntervals methods), app/frontend/src/pages/MarketNotices.tsx (new ~420-line page: LOR alert strip, notices table with type/severity filters, ComposedChart dispatch vs pre-dispatch with deviation tracking), app/frontend/src/App.tsx (market-notices route + nav item), tests/test_backend.py (TestMarketNoticesEndpoints: 3 tests)
**Notes:** Market notices include LOR1/2/3 (Lack of Reserve levels 1-3), constraint binding events, reclassification events, and price limit notifications. rrp_deviation = dispatch_rrp - predispatch_rrp measures forecast surprise. Surprise threshold set at ±$50/MWh. LOR3 is most critical (< 750 MW reserve in a region).

## Sprint 14c — Weather Correlation & Demand Response Analytics — 2026-02-19
**Completed:** app/backend/main.py (WeatherDemandPoint/DemandResponseEvent/DemandResponseSummary Pydantic models, GET /api/weather/demand with diurnal temperature patterns + demand correlation, GET /api/demand/response with RERT/interruptible load/EV fleet DR programs), app/frontend/src/api/client.ts (WeatherDemandPoint/DemandResponseEvent/DemandResponseSummary interfaces, getWeatherDemand/getDemandResponse methods), app/frontend/src/pages/WeatherDemand.tsx (new ~440-line page: weather summary cards, ComposedChart temperature+demand dual-axis, DR summary strip, DR events table with status badges), app/frontend/src/App.tsx (weather-demand route + nav item), tests/test_backend.py (TestWeatherDemandEndpoints: 3 tests)
**Notes:** Demand correlates with temperature deviation from 18°C comfort zone (both hot and cold increase demand). Diurnal temperature pattern peaks ~3pm, troughs ~5am. DR programs: RERT (emergency reserve), Interruptible Load (industrial), EV Fleet Response (aggregated EVs), Demand Aggregator. total_enrolled_mw ~500-1500MW across NEM.

## Sprint 14b — Battery & Storage Analytics — 2026-02-19
**Completed:** app/backend/main.py (BessUnit/BessDispatchInterval/BessFleetSummary Pydantic models, GET /api/bess/fleet with 8 real-world-inspired NEM BESS units, GET /api/bess/dispatch with charge/discharge cycle simulation), app/frontend/src/api/client.ts (BessUnit/BessDispatchInterval/BessFleetSummary interfaces, getBessFleet/getBessDispatch methods), app/frontend/src/pages/BessAnalytics.tsx (new ~450-line page: fleet summary cards, BESS units table with SOC bar + mode badges, dispatch history ComposedChart with MW bars + price line + SOC line), app/frontend/src/App.tsx (bess route + nav item), tests/test_backend.py (TestBessEndpoints: 3 tests)
**Notes:** BESS units modelled on real NEM assets: Hornsdale (SA1, 150MW/193.5MWh), Victorian Big Battery (VIC1, 300MW/450MWh), Waratah Super Battery (NSW1, 850MW/1680MWh), plus 5 others. Revenue = abs(mw) * rrp * (5/60) for discharging intervals. Charge cycles shown as negative MW (cost of charge). Round-trip efficiency 85-92%.

## Sprint 15a — Portfolio Trading Desk — 2026-02-19
**Completed:** app/backend/main.py (PortfolioAsset/HedgePosition/PortfolioSummary Pydantic models, GET /api/portfolio/summary with 7 generation assets + 3-4 hedge positions + region P&L, GET /api/portfolio/pnl_history with 7-day daily P&L series), app/frontend/src/api/client.ts (PortfolioAsset/HedgePosition/PortfolioSummary interfaces, getPortfolioSummary/getPortfolioPnlHistory methods), app/frontend/src/pages/TradingDesk.tsx (new ~450-line page: MtM P&L cards, P&L history BarChart with green/red bars, portfolio assets table, hedge positions table with ITM badges), app/frontend/src/App.tsx (trading-desk route + nav item), tests/test_backend.py (TestPortfolioEndpoints: 3 tests)
**Notes:** MtM P&L = (current_spot - contract_price) * contracted_volume / 1000. Assets include major NEM generators: Eraring (2880MW coal, NSW1), Liddell (1000MW coal), Torrens Island (400MW gas, SA1), Bango Wind (244MW, NSW1), Darlington Point Solar (275MW, NSW1), Hallet (99MW wind, SA1). Hedge types: cap (ceiling on price paid), swap (fixed-for-floating), floor (minimum price received), collar (cap + floor combined).

## Sprint 15c — Carbon & Sustainability Dashboard — 2026-02-19
**Completed:** app/backend/main.py (CarbonIntensityRecord/LgcMarketRecord/SustainabilityDashboard Pydantic models, GET /api/sustainability/dashboard with NEM decarbonisation stats + LGC market + regional intensities, GET /api/sustainability/intensity_history with hourly series), app/frontend/src/api/client.ts (CarbonIntensityRecord/LgcMarketRecord/SustainabilityDashboard interfaces, getSustainabilityDashboard/getCarbonIntensityHistory methods), app/frontend/src/pages/Sustainability.tsx (new ~450-line page: decarbonisation progress banner, summary cards, regional intensity BarChart, hourly trend AreaChart, LGC market cards), app/frontend/src/App.tsx (sustainability route + nav item), tests/test_backend.py (TestSustainabilityEndpoints: 3 tests)
**Notes:** NEM 2026 carbon intensity ~0.5 kg CO2/MWh (down 36% from 2005 baseline of 0.82). Regional variation: TAS1~0.05 (hydro), SA1~0.15 (high wind), VIC1~0.45, NSW1/QLD1~0.7 (coal dominated). LGCs (Large-scale Generation Certificates) are the tradeable instrument for Australia's Renewable Energy Target. 1 LGC = 1 MWh of eligible renewable generation.

## Sprint 15b — Merit Order & Dispatch Stack — 2026-02-19
**Completed:** app/backend/main.py (MeritOrderUnit/MeritOrderCurve/DispatchStackSummary Pydantic models, GET /api/merit/order with per-region merit order stack sorted by SRMC + marginal unit identification, GET /api/merit/stack for all 5 NEM regions), app/frontend/src/api/client.ts (MeritOrderUnit/MeritOrderCurve interfaces, getMeritOrder method), app/frontend/src/pages/MeritOrder.tsx (new ~450-line page: region tabs, SMC/marginal generator/demand cards, ComposedChart step-curve merit order with demand reference line, dispatch units table with on/off merit status), app/frontend/src/App.tsx (merit-order route + nav item), tests/test_backend.py (TestMeritOrderEndpoints: 3 tests)
**Notes:** SRMC (Short-Run Marginal Cost) by fuel: Hydro/Wind/Solar=$0-20, Brown Coal=$25-45, Black Coal=$35-55, Gas CCGT=$65-95, Gas OCGT=$150-350, Battery=$50-500 (strategic), Diesel=$400-800. Marginal generator is the unit whose cumulative capacity first exceeds current demand. System Marginal Cost = marginal generator SRMC = spot price in competitive equilibrium.

## Sprint 16b — Scenario / What-If Analysis — 2026-02-19
**Completed:** app/backend/main.py (ScenarioInput/ScenarioResult/ScenarioComparison Pydantic models, POST /api/scenario/run with linear sensitivity model, GET /api/scenario/presets with 6 pre-built scenarios), app/frontend/src/api/client.ts (ScenarioInput/ScenarioResult/ScenarioComparison interfaces, runScenario POST + getScenarioPresets methods), app/frontend/src/pages/ScenarioAnalysis.tsx (new ~480-line page: preset scenario cards, parameter sliders for 6 inputs, results panel with price/demand impact arrows, sensitivity table), app/frontend/src/App.tsx (scenario route + nav item), tests/test_backend.py (TestScenarioEndpoints: 3 tests)
**Notes:** Simplified price sensitivity model: temperature +$3.50/MWh per degree C above 30 degrees C (AC load), gas pass-through ~35%, wind shortfall +15% price impact, coal outage +$0.05/MWh per MW. Presets: Hot Summer Day, Cold Snap, Wind Drought, Gas Price Spike, Major Coal Outage, Perfect Green Day.

## Sprint 16c — Data Pipeline & Catalog Health Dashboard — 2026-02-19
**Completed:** app/backend/main.py (PipelineRunRecord/TableHealthRecord/DataQualityExpectation/DataCatalogDashboard Pydantic models, GET /api/catalog/dashboard with DLT pipeline runs + table health + DQ expectations, GET /api/catalog/pipeline_runs with filters), app/frontend/src/api/client.ts (PipelineRunRecord/TableHealthRecord/DataQualityExpectation/DataCatalogDashboard interfaces, getCatalogDashboard/getPipelineRuns methods), app/frontend/src/pages/DataCatalog.tsx (new ~450-line page: health summary cards, pipeline runs table, table health grid grouped by Bronze/Silver/Gold, DQ expectations table), app/frontend/src/App.tsx (data-catalog route + nav item), tests/test_backend.py (TestCatalogEndpoints: 3 tests)
**Notes:** 4 DLT pipelines tracked: nemweb_bronze (5-min), silver_transform (5-min), gold_aggregation (30-min), ml_feature (1-hr). 8 Unity Catalog tables across bronze/silver/gold schemas. 10 DQ expectations covering not_null, unique, in_range, matches_regex. Freshness thresholds: fresh < 10min, stale 10-30min, critical > 30min.

## Sprint 17a — Load Duration Curve & Statistical Analysis — 2026-02-19
**Completed:** app/backend/main.py (DurationCurvePoint/StatisticalSummary/SeasonalPattern Pydantic models, GET /api/stats/duration_curve with 101-point percentile series, GET /api/stats/summary with box-plot statistics + demand-price correlation, GET /api/stats/seasonal with 12-month patterns), app/frontend/src/api/client.ts (DurationCurvePoint/StatisticalSummary/SeasonalPattern interfaces, getDurationCurve/getStatsSummary/getSeasonalPattern methods), app/frontend/src/pages/LoadDuration.tsx (new ~480-line page: stats cards, load + price duration AreaCharts with percentile reference lines, seasonal BarChart, statistical summary table), app/frontend/src/App.tsx (load-duration route + nav item), tests/test_backend.py (TestLoadDurationEndpoints: 3 tests)
**Notes:** Load duration curve shows what fraction of time demand exceeds a given level (monotonically decreasing). NSW1 demand range P0=2000MW to P100=14800MW; price range P0=-$50 to P100=$15500 (VOLL). Demand-price correlation ~0.40 (positive: high demand = high prices). Seasonal patterns: Jan/Feb peak (summer AC), Jun/Jul moderate (heating), Apr/Oct trough (shoulder season).

## Sprint 16a — MLflow Experiment & Model Management Dashboard — 2026-02-19
**Completed:** app/backend/main.py (MlflowRun/FeatureImportance/ModelDriftRecord/MlDashboard Pydantic models, GET /api/ml/dashboard with 8-10 mock runs + feature importance + drift summary, GET /api/ml/runs with model_type/region/limit filters), app/frontend/src/api/client.ts (MlflowRun/FeatureImportance/ModelDriftRecord/MlDashboardData interfaces, getMlDashboard/getMlRuns methods), app/frontend/src/pages/MlDashboard.tsx (new ~450-line page: summary cards, model drift table, feature importance horizontal BarChart, training runs table with status badges), app/frontend/src/App.tsx (ml-dashboard route + nav item), tests/test_backend.py (TestMlDashboardEndpoints: 3 tests)
**Notes:** MLflow experiments map to Unity Catalog model registry (energy_copilot.models.<name>). Feature importance from LightGBM gain metric. Drift detected when production MAE / training MAE > 1.3 (warning) or > 1.5 (critical). 8 features tracked for price forecast: hour_of_day, day_of_week, temp_c, nem_demand, gas_price, prev_rrp_1h, wind_mw, solar_mw.

## Sprint 17c — Historical Trend & Long-Run Analysis — 2026-02-19
**Completed:** app/backend/main.py (AnnualSummary/YearOverYearChange/LongRunTrendSummary Pydantic models, GET /api/trends/annual with 2015-2025 data + CAGR calculations, GET /api/trends/yoy with year-over-year metric comparisons), app/frontend/src/api/client.ts (AnnualSummary/YearOverYearChange/LongRunTrendSummary interfaces, getAnnualTrends/getYoyChanges methods), app/frontend/src/pages/HistoricalTrends.tsx (new ~480-line page: CAGR + renewable growth + carbon reduction summary cards, annual price AreaChart with CPI-adjusted line, renewable+carbon ComposedChart, YoY comparison table, full annual data table with 2022 gas crisis highlight), app/frontend/src/App.tsx (trends route + nav item), tests/test_backend.py (TestTrendsEndpoints: 3 tests)
**Notes:** Key NEM price milestones: 2017 high (~$100/MWh gas supply constraints), 2020 low (~$45 COVID + renewables), 2022 high (~$180 global gas crisis), 2024 moderate (~$75 renewables normalizing). Renewable penetration grew from ~15% in 2015 to ~40% in 2025. Carbon intensity declined ~39% over the decade. CPI adjustment uses 2.5%/yr inflation assumption.

## Sprint 17b — Frequency & System Strength Analytics — 2026-02-19
**Completed:** app/backend/main.py (FrequencyRecord/InertiaRecord/FrequencyEventRecord/FrequencyDashboard Pydantic models, GET /api/frequency/dashboard with 5-sec frequency series + inertia by region + event log, GET /api/frequency/history with per-minute series), app/frontend/src/api/client.ts (FrequencyRecord/InertiaRecord/FrequencyEventRecord/FrequencyDashboard interfaces, getFrequencyDashboard/getFrequencyHistory methods), app/frontend/src/pages/FrequencyAnalytics.tsx (new ~460-line page: live frequency Hz display with band coloring, 5-min trend LineChart with normal band reference lines, inertia table, frequency events log), app/frontend/src/App.tsx (frequency route + nav item), tests/test_backend.py (TestFrequencyEndpoints: 3 tests)
**Notes:** NEM normal frequency band: 49.85-50.15 Hz. Warning band: 49.5-50.5 Hz. Emergency: <49.5 or >50.5 Hz. ROCOF (Rate of Change of Frequency) critical for protecting equipment — AEMO requires < ±1 Hz/s under credible contingency. SA1 lowest inertia (inverter-based renewables dominant). UFLS (Under Frequency Load Shedding) activates below 49.0 Hz.

## Sprint 18a — ASX Energy Futures & Hedge Market — 2026-02-19
**Completed:** app/backend/main.py (FuturesContract/ForwardCurvePoint/HedgeEffectivenessRecord/FuturesDashboard Pydantic models, GET /api/futures/dashboard with CAL+quarterly contracts + forward curve + hedge analytics, GET /api/futures/contracts with region/type filters), app/frontend/src/api/client.ts (FuturesContract/ForwardCurvePoint/HedgeEffectivenessRecord/FuturesDashboard interfaces, getFuturesDashboard/getFuturesContracts methods), app/frontend/src/pages/EnergyFutures.tsx (new ~470-line page: market summary strip, forward curve LineChart, futures contracts table grouped by CAL/quarterly, hedge effectiveness cards), app/frontend/src/App.tsx (futures route + nav item), tests/test_backend.py (TestFuturesEndpoints: 3 tests)
**Notes:** ASX Energy futures settle against average NEM spot price for the contract period. CAL contracts cover full calendar year. Quarterly contracts (Q1-Q4) allow more granular hedging. Peak contracts hedge peak periods (7am-10pm weekdays). Forward curve shows declining prices 2025→2028 as renewables expand (contango → backwardation transition expected by 2027).

## Sprint 18c — Market Participant Registry & Credit Analytics — 2026-02-19
**Completed:** app/backend/main.py (MarketParticipant/ParticipantAsset/ParticipantRegistry Pydantic models, GET /api/registry/participants with 12 NEM participants + HHI concentration metrics, GET /api/registry/assets with participant/region/fuel filters), app/frontend/src/api/client.ts (MarketParticipant/ParticipantAsset/ParticipantRegistry interfaces, getParticipantRegistry/getParticipantAssets methods), app/frontend/src/pages/ParticipantRegistry.tsx (new ~450-line page: market concentration cards, donut PieChart market share, participants table with compliance + credit badges, asset detail expansion panel), app/frontend/src/App.tsx (registry route + nav item), tests/test_backend.py (TestRegistryEndpoints: 3 tests)
**Notes:** NEM major participants: AGL (~22% share), Origin (~18%), Snowy Hydro (4100MW hydro), CS Energy (QLD govt), Energy Australia, ERM Power, Tilt Renewables, Neoen (large BESS), Alinta, Glencore (coal NSW). HHI index ~1200 (moderately concentrated but below 2500 concentrated threshold). Credit limits set by AEMO based on 7-day maximum exposure.

## Sprint 18b — Outage Schedule & PASA Adequacy Assessment — 2026-02-19
**Completed:** app/backend/main.py (OutageRecord/PasaRecord/PasaDashboard Pydantic models, GET /api/outages/dashboard with active/upcoming/returned outages + 7-day PASA outlook, GET /api/outages/list with region/type/status filters), app/frontend/src/api/client.ts (OutageRecord/PasaRecord/PasaDashboard interfaces, getOutageDashboard/getOutageList methods), app/frontend/src/pages/OutageSchedule.tsx (new ~460-line page: capacity impact cards, 7-day PASA outlook timeline, active outages table, upcoming outages section), app/frontend/src/App.tsx (outages route + nav item), tests/test_backend.py (TestOutageEndpoints: 3 tests)
**Notes:** PASA (Projected Assessment of System Adequacy) is AEMO's reliability outlook. Reserve status thresholds: SURPLUS (>25%), ADEQUATE (>LOR1 requirement ~750MW), LOR1 (<750MW reserve), LOR2 (<450MW), LOR3 (<0MW). Mock forced outages: Yallourn W unit 3 (VIC1, 380MW), Callide C unit 4 (QLD1, 460MW). Planned: Eraring unit 2 (NSW1, 720MW annual maintenance).

## Sprint 19a — VPP & Distributed Energy Resources Dashboard — 2026-02-19
**Completed:** app/backend/main.py (VppUnit/DerSummary/DerDashboard Pydantic models, GET /api/der/dashboard with 6 VPPs + 5-region DER summary + 24-hour solar forecast, GET /api/der/vpp with region/mode filters), app/frontend/src/api/client.ts (VppUnit/DerSummary/DerDashboard interfaces, getDerDashboard/getVppFleet methods), app/frontend/src/pages/DerDashboard.tsx (new ~460-line page: NEM DER summary cards, 24-hour solar AreaChart showing duck curve, VPP fleet table, regional DER stacked BarChart), app/frontend/src/App.tsx (der route + nav item), tests/test_backend.py (TestDerEndpoints: 3 tests)
**Notes:** NEM 2026 DER landscape: ~22 GW rooftop solar (3.5M households), ~3.5 GWh BTM batteries, ~250,000 smart-charging EVs. VPPs: AGL (SA1, 50MW), Origin (NSW1, 80MW), Tesla Powerwall (SA1, 40MW), EnergyAustralia (VIC1, 60MW), Amber Electric (multi-region, 30MW). Duck curve shows midday solar depression followed by evening ramp. Net demand reduction during peak solar: 8,000-12,000 MW across NEM.

## Sprint 19c — Admin Settings & API Configuration Panel — 2026-02-19
**Completed:** app/backend/main.py (UserPreferences/ApiKeyInfo/DataSourceConfig/SystemConfig Pydantic models, GET/PUT /api/admin/preferences, GET /api/admin/api_keys, GET /api/admin/data_sources, GET /api/admin/system_config), app/frontend/src/api/client.ts (UserPreferences/ApiKeyInfo/DataSourceConfig/SystemConfig interfaces, getAdminPreferences/updateAdminPreferences/getApiKeys/getDataSources/getSystemConfig methods), app/frontend/src/pages/Settings.tsx (new ~500-line page: 4-tab layout — User Preferences (form with save), API Keys (masked table + revoke), Data Sources (status cards + sync), System Info (read-only config)), app/frontend/src/App.tsx (settings route + nav item), tests/test_backend.py (TestAdminEndpoints: 3 tests)
**Notes:** Settings page provides operational control panel for platform administrators. API keys use prefix masking (show first 8 chars, mask rest). Data sources include NEMWEB, MLflow, gas bulletin board, Lakebase, ASX futures, BOM weather. PUT /api/admin/preferences is stateless in mock mode (echoes back input). SystemConfig exposes environment metadata, uptime, cache performance.

## Sprint 19b — Gas Market & Pipeline Analytics — 2026-02-19
**Completed:** app/backend/main.py (GasPipelineFlow/GasHubPrice/LngExportRecord/GasMarketDashboard Pydantic models, GET /api/gas/dashboard with 3 hub prices + 5 pipeline flows + 5 LNG terminals, GET /api/gas/pipeline_flows with utilisation filter), app/frontend/src/api/client.ts (GasPipelineFlow/GasHubPrice/LngExportRecord/GasMarketDashboard interfaces, getGasDashboard/getGasPipelineFlows methods), app/frontend/src/pages/GasMarket.tsx (new ~450-line page: hub price cards, pipeline flows table with utilisation bars, hub price BarChart, LNG terminals table), app/frontend/src/App.tsx (gas route + nav item), tests/test_backend.py (TestGasEndpoints: 3 tests)
**Notes:** Australian east coast gas hubs: Wallumbilla (QLD, largest trading hub), Moomba (SA, major production centre), Longford (VIC, Bass Strait supply point). Gas-to-power is key NEM fuel input: ~450-800 TJ/day. LNG export terminals: 3 in QLD (QCLNG, APLNG, GLNG) + 2 in WA (Darwin LNG, NW Shelf). Domestic Reservation Obligation (WA) requires 15% of LNG production reserved for domestic market.

## Sprint 20a — Retail Market Analytics — 2026-02-19
**Completed:** app/backend/main.py (RetailerMarketShare/DefaultOfferPrice/CustomerSwitchingRecord/RetailMarketDashboard Pydantic models, GET /api/retail/dashboard with 7 retailers + DMO/VDO prices + switching data, GET /api/retail/offers with state filter), app/frontend/src/api/client.ts (RetailerMarketShare/DefaultOfferPrice/CustomerSwitchingRecord/RetailMarketDashboard interfaces, getRetailDashboard/getRetailOffers methods), app/frontend/src/pages/RetailMarket.tsx (new ~460-line page: market overview cards, retailer PieChart, DMO/VDO prices table, customer switching BarChart), app/frontend/src/App.tsx (retail route + nav item), tests/test_backend.py (TestRetailEndpoints: 3 tests)
**Notes:** DMO (Default Market Offer) = Australian federal government's reference price cap, set annually by AER. VDO (Victorian Default Offer) = Victorian-specific equivalent set by ESC. SA has highest electricity prices in NEM (~$2,172/yr reference). ~18-22% of customers switch retailers annually, saving average $300-400/yr. ~30% of residential customers still on expensive standing offers.

## Sprint 20b — Transmission Loss Factor & Network Analytics — 2026-02-19
**Completed:** app/backend/main.py (LossFactorRecord/NetworkConstraintLimit/NetworkDashboard Pydantic models, GET /api/network/dashboard with 20-25 MLF records + 8-10 network elements, GET /api/network/loss_factors with region/category filters), app/frontend/src/api/client.ts (LossFactorRecord/NetworkConstraintLimit/NetworkDashboard interfaces, getNetworkDashboard/getLossFactors methods), app/frontend/src/pages/NetworkAnalytics.tsx (new ~460-line page: MLF summary cards, MLF distribution BarChart, loss factors table sorted by MLF, network element loading table), app/frontend/src/App.tsx (network route + nav item), tests/test_backend.py (TestNetworkEndpoints: 3 tests)
**Notes:** MLF (Marginal Loss Factor) measures the marginal transmission loss at a generator's connection point. MLF < 1.0 means revenue penalty (generator receives less than the spot price). Remote renewable zones in SA and QLD often have MLFs 0.85-0.95, significantly reducing effective revenue. MLFs are set annually by AEMO for each financial year. Combined LF = MLF x DLF.

## Sprint 20c — REZ & Infrastructure Investment Analytics (2026-02-19)
- Added RezProject, IspProject, CisContract, RezDashboard Pydantic models to main.py
- Created /api/rez/dashboard, /api/rez/projects, /api/rez/cis_contracts endpoints
- Created RezInfrastructure.tsx with REZ project table, ISP project table, CIS contracts table
- Added TypeScript interfaces and API methods to client.ts
- Added /rez route to App.tsx
- Added TestRezInfrastructureEndpoints tests to test_backend.py

## Sprint 21a — Renewable Curtailment & Integration Analytics (2026-02-19)
- Added CurtailmentEvent, MinimumOperationalDemandRecord, RenewableIntegrationLimit, CurtailmentDashboard Pydantic models
- Created /api/curtailment/dashboard and /api/curtailment/events endpoints
- Created CurtailmentAnalytics.tsx with curtailment events table, MOD records table, integration limits table
- Added TypeScript interfaces and API methods to client.ts
- Added /curtailment route to App.tsx
- Added TestCurtailmentEndpoints tests to test_backend.py

## Sprint 21b — Demand Side Participation & Load Curtailment Analytics (2026-02-19)
- Added DspParticipant, DspActivationEvent, LoadCurtailmentRecord, DspDashboard Pydantic models
- Created /api/dsp/dashboard and /api/dsp/participants endpoints
- Created DemandResponse.tsx with participants table, sector capacity chart, activation events table, curtailment table
- Added TypeScript interfaces and API methods to client.ts
- Added /dsp route to App.tsx
- Added TestDspEndpoints tests to test_backend.py

## Sprint 21c — Power System Security & Inertia Analytics (2026-02-19)
- Added PssInertiaRecord, SynchronousCondenserRecord, FcasDispatchRecord, PowerSystemSecurityDashboard Pydantic models
- Created /api/pss/dashboard and /api/pss/fcas endpoints
- Created SystemSecurity.tsx with inertia table, synchronous condenser table, FCAS dispatch table
- Added TypeScript interfaces and API methods to client.ts
- Added /security route to App.tsx
- Added TestPowerSystemSecurityEndpoints tests to test_backend.py

## Sprint 22a — Generator Bidding & Offer Stack Analytics (2026-02-19)
- Added OfferBand, GeneratorOfferRecord, RebidRecord, BidStackSummary Pydantic models
- Created /api/bids/stack endpoint (offer records, rebid log, fuel type breakdown)
- Created BiddingAnalytics.tsx with fuel type BarChart, offer records table, rebid log
- Added TypeScript interfaces and API methods to client.ts
- Added /bidding route to App.tsx
- Added TestBiddingEndpoints tests to test_backend.py

## Sprint 22b — NEM Market Events & Intervention Timeline (2026-02-19)
**Status**: COMPLETE

### What was built:
- `MarketEvent`, `MarketIntervention`, `PriceCapEvent`, `MarketEventsDashboard` Pydantic models
- Endpoints: GET /api/market-events/dashboard, /api/market-events/events, /api/market-events/interventions
- `NemEvents.tsx` (~500 lines) — event timeline table, intervention log, price cap events, KPI cards, region filter
- TypeScript interfaces in client.ts + API methods
- 4 tests in TestMarketEventsEndpoints
- Covers price cap events (APC/MPC), AEMO directions, LOR declarations, reclassified events

## Sprint 22c — FCAS Market & Ancillary Services Deep-Dive (2026-02-19)
**Status**: COMPLETE

### What was built:
- `FcasServicePrice`, `FcasProvider`, `FcasTrapRecord`, `FcasMarketDashboard` Pydantic models
- Endpoints: GET /api/fcas/market, /api/fcas/services, /api/fcas/providers
- `FcasMarket.tsx` (~520 lines) — 8-service price table, cost PieChart, provider table, constraint/trap records, regional requirements
- TypeScript interfaces in client.ts + API methods
- 4 tests in TestFcasMarketEndpoints
- Covers all 8 FCAS services (R6S/R60S/R5M/R5RE/L6S/L60S/L5M/L5RE), causer pays, enablement limits

## Sprint 23c — NEM Settlement & Prudential Management Analytics (2026-02-19)
**Status**: COMPLETE
- SettlementResidueRecord, PrudentialRecord, SettlementRun, TecAdjustment, SettlementDashboard models
- GET /api/settlement/dashboard, /residues, /prudential
- NemSettlement.tsx (~520 lines): settlement runs table, prudential status, residues, TEC adjustments
- 5 tests in TestSettlementEndpoints

## Sprint 23a — Battery Storage Arbitrage & Economics Analytics (2026-02-19)
**Status**: COMPLETE
- BatteryArbitrageSlot, BatteryUnit, ArbitrageOpportunity, BatteryEconomicsDashboard models
- GET /api/battery-economics/dashboard, /batteries, /schedule
- BatteryEconomics.tsx (~500 lines): dispatch schedule chart, fleet table, arbitrage opportunities, revenue PieChart
- 4 tests in TestBatteryEconomicsEndpoints

## Sprint 23b — Carbon Emissions Intensity & Net Zero Tracking (2026-02-19)
**Status**: COMPLETE
- RegionEmissionsRecord, FuelEmissionsFactor, EmissionsTrajectory, Scope2Calculator, CarbonDashboard models
- GET /api/carbon/dashboard, /regions, /trajectory
- CarbonAnalytics.tsx (~520 lines): trajectory ComposedChart, region intensity table, fuel factors, Scope 2 calculator
- 4 tests in TestCarbonAnalyticsEndpoints

## Sprint 24a — OTC Hedging & Contract Portfolio Analytics (2026-02-19)
**Status**: COMPLETE
- HedgeContract, HedgePortfolioSummary, HedgingDashboard models
- GET /api/hedging/dashboard, /contracts, /portfolio
- HedgingAnalytics.tsx (~530 lines): quarterly position BarChart, portfolio table, contract details with filters
- 4 tests in TestHedgingEndpoints

## Sprint 24b — Hydro Storage & Water Value Analytics (2026-02-19)
**Status**: COMPLETE
- ReservoirRecord, HydroInflowForecast, WaterValuePoint, HydroSchemeSummary, HydroDashboard models
- GET /api/hydro/dashboard, /reservoirs, /water-value
- HydroStorage.tsx (~510 lines): water value curve, scheme summary cards, reservoir table, inflow forecasts
- 4 tests in TestHydroStorageEndpoints

## Sprint 24c — Market Power & Concentration Analytics (2026-02-19)
**Status**: COMPLETE
- HhiRecord, PivotalSupplierRecord, MarketShareTrend, MarketPowerDashboard models
- GET /api/market-power/dashboard, /hhi, /pivotal
- MarketPower.tsx (~500 lines): HHI BarChart, share trend LineChart, pivotal supplier table, HHI details
- 4 tests in TestMarketPowerEndpoints

## Sprint 25a — PASA Availability & Generator Forced Outage Statistics (2026-02-19)
**Status**: COMPLETE
- PasaPeriod, ForcedOutageRecord, GeneratorReliabilityStats, PasaDashboard models
- GET /api/pasa/dashboard, /periods, /forced-outages
- PasaAnalytics.tsx (~510 lines): reserve margin BarChart, PASA periods table, forced outage log, reliability stats
- 4 tests in TestPasaEndpoints

## Sprint 25b — SRA Auction & Interconnector Firm Transfer Rights (2026-02-19)
**Status**: COMPLETE
- SraUnit, SraAuctionResult, InterconnectorRevenueSummary, SraDashboard models
- GET /api/sra/dashboard, /units, /auction-results
- SraAuction.tsx (~500 lines): auction results table, revenue BarChart, active SRA units, interconnector cards
- 4 tests in TestSraEndpoints

## Sprint 25c — Corporate PPA Market & Green Energy Procurement (2026-02-19)
**Status**: COMPLETE
- CorporatePpa, LgcMarket, BehindMeterAsset, PpaDashboard models
- GET /api/ppa/dashboard, /contracts, /lgc-market
- PpaMarket.tsx (~520 lines): tech mix PieChart, LGC trend AreaChart, PPA table, behind-meter assets
- 4 tests in TestPpaEndpoints

## Sprint 27b — LRMC & Investment Signal Analytics (2026-02-19)
**Status**: COMPLETE
- LcoeTechnology, InvestmentSignal, CapacityMechanismScenario, LrmcDashboard models
- GET /api/lrmc/dashboard, /technologies, /signals
- LrmcAnalytics.tsx (~520 lines): LCOE range chart, investment signal table, capacity scenarios, LCOE comparison
- 4 tests in TestLrmcEndpoints

## Sprint 26c — AEMO ISP Transmission Investment Tracker (2026-02-19)
**Status**: COMPLETE
- IspProjectMilestone, IspMajorProject, TnspCapexProgram, IspDashboard models
- GET /api/isp/dashboard, /projects, /tnsp-programs
- IspTracker.tsx (~540 lines): capex BarChart, projects table with milestone timeline, TNSP programs
- 4 tests in TestIspTrackerEndpoints

## Sprint 26b — Pre-dispatch Accuracy & 5-Minute Settlement Analytics (2026-02-19)
**Status**: COMPLETE
- PredispatchInterval, FiveMinuteSettlementSummary, DispatchAccuracyStats, DispatchDashboard models
- GET /api/dispatch/dashboard, /predispatch, /accuracy
- DispatchAccuracy.tsx (~500 lines): pre-dispatch vs actual ComposedChart, 5-min settlement table, accuracy stats
- 4 tests in TestDispatchAccuracyEndpoints

## Sprint 26a — NEM Rule Change & Regulatory Reform Tracker (2026-02-19)
**Status**: COMPLETE
- RuleChangeRequest, AerDetermination, RegulatoryCalendarEvent, RegulatoryDashboard models
- GET /api/regulatory/dashboard, /rule-changes, /calendar
- RegulatoryTracker.tsx (~510 lines): calendar timeline, rule changes table, AER determinations, pipeline BarChart
- 4 tests in TestRegulatoryEndpoints

## Sprint 27a — Small-Scale Solar & EV Fleet Analytics (2026-02-19)
**Status**: COMPLETE
- SolarGenerationRecord, EvFleetRecord, SolarEvDashboard models
- GET /api/solar-ev/dashboard, /solar, /ev-fleet
- SolarEvAnalytics.tsx (~520 lines): duck curve chart, growth projection, solar table, EV fleet table
- 4 tests in TestSolarEvEndpoints

## Sprint 27c — Network Constraint Equation & Binding Constraint Analytics (2026-02-19)
**Status**: COMPLETE
- ConstraintEquation, ConstraintSummaryByRegion, ConstraintViolationRecord, ConstraintDashboard models
- GET /api/constraints/dashboard, /equations, /violations
- NetworkConstraints.tsx (~510 lines): constraint cost chart, equations table with slack coloring, violations log
- 4 tests in TestNetworkConstraintEndpoints

## Sprint 28a — Price Setter & Marginal Generator Analytics (2026-02-19)
**Status**: COMPLETE
- PriceSetterRecord, PriceSetterFrequency, FuelTypePriceSetting, PriceSetterDashboard models
- GET /api/price-setter/dashboard, /records, /frequency
- PriceSetterAnalytics.tsx (~510 lines): timeline bar chart, fuel PieChart, frequency table, interval records
- 4 tests in TestPriceSetterEndpoints

## Sprint 28c — Electricity Retail Tariff Structure & Bill Analytics (2026-02-19)
**Status**: COMPLETE
- TariffComponent, TouTariffStructure, BillComposition, TariffDashboard models
- GET /api/tariff/dashboard, /components, /structures
- TariffAnalytics.tsx (~530 lines): stacked bill BarChart, composition PieChart, TOU table, component breakdown
- 4 tests in TestTariffEndpoints

## Sprint 28b — Smart Meter & Grid Modernisation Analytics (2026-02-19)
**Status**: COMPLETE
- SmartMeterRecord, GridModernisationProject, NetworkReliabilityStats, GridModernisationDashboard models
- GET /api/grid-modernisation/dashboard, /smart-meters, /projects
- GridModernisation.tsx (~520 lines): penetration BarChart, SAIDI reliability, smart meter table, projects table
- 4 tests in TestGridModernisationEndpoints

## Sprint 29a — Spot Price Cap & CPT Analytics [COMPLETE]
- SpotCapAnalytics.tsx: CPT tracker, cap/floor events, regional summary table
- /api/spot-cap/dashboard, /cpt-tracker, /cap-events
- 4 TestSpotCapEndpoints tests

## Sprint 29b — Causer Pays & FCAS Performance Analytics [COMPLETE]
- CauserPays.tsx: performance factor chart, contributors table, FCAS market summary
- /api/causer-pays/dashboard, /contributors, /performance
- 4 TestCauserPaysEndpoints tests

## Sprint 29c — WEM Western Australia Energy Market [COMPLETE]
- WemOverview.tsx: balancing price chart, facility table with tech filter, reserve capacity (SRMC) chart
- /api/wem/dashboard, /prices, /facilities endpoints
- 4 TestWemEndpoints tests

## Sprint 30a — Power System Inertia & System Strength Analytics [COMPLETE]
- InertiaAnalytics.tsx: inertia bar chart vs thresholds, system strength table, detail table
- /api/inertia/dashboard, /records, /strength endpoints
- 4 TestInertiaEndpoints tests

## Sprint 30c — TNSP Revenue & AER Determinations Analytics [COMPLETE]
- TnspAnalytics.tsx: revenue vs approved chart, AER determinations table, asset reliability table
- /api/tnsp/dashboard, /revenue, /determinations endpoints
- 4 TestTnspEndpoints tests

## Sprint 30b — AEMO Market Surveillance & Compliance Dashboard [COMPLETE]
- MarketSurveillance.tsx: surveillance notices table, compliance records, anomaly detection
- /api/surveillance/dashboard, /notices, /anomalies endpoints
- 4 TestSurveillanceEndpoints tests

## Sprint 31a — Green Hydrogen & Electrolysis Economics [COMPLETE]
- HydrogenAnalytics.tsx: LCOH comparison chart, project pipeline table, capacity stacked bar chart
- /api/hydrogen/dashboard, /projects, /benchmarks endpoints
- 4 TestHydrogenEndpoints tests

## Sprint 31b — Offshore Wind Project Tracker [COMPLETE]
- OffshoreWind.tsx: declared zones table, project tracker with approvals status, milestone timeline
- /api/offshore-wind/dashboard, /projects, /zones endpoints (8 projects, 7 zones)
- 4 TestOffshoreWindEndpoints tests

## Sprint 31c — Clean Energy Regulator (CER) & RET Dashboard [COMPLETE]
- CerDashboard.tsx: LRET/LGC price history, SRES solar installation chart, accredited stations table
- /api/cer/dashboard, /lret, /stations endpoints (11-year LRET history, 10 accredited stations)
- 4 TestCerEndpoints tests

## Sprint 32a — Pumped Hydro Energy Storage (PHES) Analytics [COMPLETE]
- PhesAnalytics.tsx: capacity outlook chart, project pipeline table, generation/pumping operations chart
- /api/phes/dashboard, /projects, /outlook endpoints (8 projects, 2025-2035 outlook)
- 4 TestPhesEndpoints tests

## Sprint 32c — Safeguard Mechanism & ERF Analytics [COMPLETE]
- SafeguardAnalytics.tsx: ACCU price/volume chart, safeguard facilities compliance table, ERF projects table
- /api/safeguard/dashboard, /facilities, /accu-market (10 facilities, 8 ERF projects, 12-month ACCU market)
- 4 TestSafeguardEndpoints tests

## Sprint 32b — Major Transmission Projects Dashboard [COMPLETE]
- TransmissionProjects.tsx: project table with RIT-T/AER status, milestone tracker, capex vs benefit chart
- /api/transmission/dashboard, /projects, /milestones (8 projects: HumeLink, VNI West, EnergyConnect, Marinus Link)
- 4 TestTransmissionEndpoints tests

## Sprint 33b — Virtual Power Plant (VPP) Performance Dashboard [COMPLETE]
- VppDashboard.tsx: capacity by scheme chart, schemes table with filters, 12-month performance LineChart
- /api/vpp/dashboard, /schemes, /dispatches (10 VPP schemes: AGL, Origin, sonnen, EA, Simply)
- 4 TestVppEndpoints tests

## Sprint 33a — DNSP Distribution Network Analytics [COMPLETE]
- DnspAnalytics.tsx: SAIDI bar chart vs regulatory target, DNSP table with reliability metrics, investment table
- /api/dnsp/dashboard, /records, /investments (14 DNSPs across all states)
- 4 TestDnspEndpoints tests

## Sprint 33c — NEM Market Reform Tracker [COMPLETE]
- MarketReformTracker.tsx: reforms table with status/category/agency filters, milestone timeline, financial impact table
- /api/reform/dashboard, /list, /milestones (10 reforms: 5MS, GSL, DER Integration, Two-Sided Markets, Capacity Mechanism)
- 4 TestReformEndpoints tests

## Sprint 34c — EV Charging Infrastructure & Grid Impact Analytics [COMPLETE]
- EvCharging.tsx: state/type filter charger table, peak vs offpeak grid impact bar chart, grid impact state table
- /api/ev/dashboard, /chargers, /grid-impact (12 chargers: Chargefox/BP Pulse/NRMA/Evie, 8-state grid impact)
- 4 TestEvEndpoints tests

## Sprint 34a — TNSP Network Pricing (TUoS) Analytics [COMPLETE]
- TuosAnalytics.tsx: TUoS rate bar chart by zone/TNSP, zones pricing table, MLF table with HIGH/LOW/AVG filters
- /api/tuos/dashboard, /zones, /mlf (12 TUoS zones: TransGrid/AusNet/Powerlink/ElectraNet/TasNetworks, 15 MLF records)
- 4 TestTuosEndpoints tests

## Sprint 34b — Carbon Credit & ACCU Registry Analytics [COMPLETE]
- CarbonRegistry.tsx: 24-month ACCU spot/futures price chart, projects table with method filters, method breakdown bar chart
- /api/carbon/dashboard, /projects, /market (12 ACCU projects: Savanna Fire, HIR, Soil Carbon; 24-month market data)
- 4 TestCarbonEndpoints tests

## Sprint 35a — Grid-Scale Energy Storage Arbitrage Analytics [COMPLETE]
- StorageArbitrage.tsx: revenue stack chart (arbitrage+FCAS+capacity), projects table, 48-period dispatch/SoC/price chart
- /api/storage/dashboard, /projects, /dispatch (12 BESS projects: HPR/VBB/Waratah/Snowy 2.0, 48-interval dispatch)
- 4 TestStorageEndpoints tests

## Sprint 35b — NEM Demand Forecasting Accuracy & PASA Analytics [COMPLETE]
- DemandForecastAnalytics.tsx: MAE by horizon bar chart, forecast records table, PASA reliability table with reserve margin colour-coding
- /api/demand-forecast/dashboard, /records, /pasa (100 forecast records, 60 PASA reliability records)
- 4 TestDemandForecastEndpoints tests

## Sprint 35c — Renewable Energy Zone (REZ) Development Analytics [COMPLETE]
- RezDevelopment.tsx: REZ capacity progress chart, zones table with state/status filters, generation pipeline table
- /api/rez/dashboard, /zones, /projects (11 REZs: New England, CWO, Southern QLD, Gippsland; 14 generation projects)
- 4 TestRezEndpoints tests

## Sprint 36a — NEM Trading Desk Real-Time Analytics [COMPLETE]
- TradingDesk.tsx: positions P&L table, regional spread bar chart, arbitrage opportunity badges
- /api/trading/dashboard, /positions, /spreads (15 positions, 5 interconnector spreads)
- 4 TestTradingEndpoints tests

## Sprint 36b — Network Congestion & Constraint Binding Analytics [COMPLETE]
- CongestionAnalytics.tsx: cost vs rent bar chart by interconnector, events table with cause/region filters, constraint binding frequency table
- /api/congestion/dashboard, /events, /constraints (20 congestion events, 10 constraint records)
- 4 TestCongestionEndpoints tests

## Sprint 36c — Energy Poverty & Social Equity Analytics [COMPLETE]
- EnergyEquity.tsx: hardship rate bar chart with disconnection rate line, state hardship table, demographic affordability table
- /api/equity/dashboard, /hardship, /affordability (8-state hardship records, 14 demographic affordability indicators)
- 4 TestEquityEndpoints tests

## Sprint 37a — Demand Response & RERT Analytics [COMPLETE]
- DemandResponseAnalytics.tsx: contracted vs available MW bar chart, activations table with trigger/type badges, providers table
- /api/demand-response/dashboard, /contracts, /activations, /providers (12 RERT/SRAS/NSCAS contracts, 15 activations, 10 providers)
- 4 TestDemandResponseEndpoints tests

## Sprint 37b — Behind-the-Meter (BTM) Analytics [COMPLETE]
- BehindTheMeter.tsx: rooftop PV capacity trend by state (12 months), home battery table, EV managed charging table
- /api/btm/dashboard, /rooftop-pv, /home-batteries, /ev (8-state PV records, 5-state battery+EV records, 12-month trend)
- 4 TestBtmEndpoints tests

## Sprint 37c — Regulatory Asset Base (RAB) & Network Revenue Analytics [COMPLETE]
- RabAnalytics.tsx: allowed revenue bar chart (top 10 networks), determinations table with AER decision badges, yearly CAPEX/OPEX variance table
- /api/rab/dashboard, /determinations, /yearly (15 TNSP+DNSP determinations, 25 yearly records)
- 3 TestRabEndpoints tests

## Sprint 38a — NEM Real-Time Overview Dashboard [COMPLETE]
- NemRealTimeDashboard.tsx: 5-region KPI price cards (colour-coded by band), generation mix stacked bar chart by fuel type, interconnector loading table
- /api/realtime/dashboard, /dispatch, /generation-mix, /interconnectors (5 regions, 28+ gen mix records, 6 interconnectors)
- 4 TestRealtimeEndpoints tests

## Sprint 38b — Network Investment Test (RIT-T/RIT-D) Analytics [COMPLETE]
- RitAnalytics.tsx: cost vs benefit scatter chart, projects table with BCR highlighting, options comparison table
- /api/rit/dashboard, /projects, /cost-benefits, /options (12 projects: 8 RIT-T + 4 RIT-D, 30+ cost-benefit records, 30+ option records)
- 4 TestRitEndpoints tests

## Sprint 38c — Electricity Derivatives & Forward Curve Analytics [COMPLETE]
- ForwardCurveAnalytics.tsx: forward curve line chart (CAL25/26/27 by region), cap/floor options table, seasonal premium heatmap
- /api/forward-curve/dashboard, /prices, /options, /seasonal (4-region curve, 27 cap/floor options, 80 seasonal premium records)
- 4 TestForwardCurveEndpoints tests

## Sprint 39a — Coal Fleet Retirement & Energy Transition Analytics [COMPLETE]
- CoalRetirement.tsx: capacity gap grouped bar chart (retirements vs renewables vs storage by state/year), retirement units table, transition investment pipeline table
- /api/coal-retirement/dashboard, /units, /capacity-gaps, /investments (16 coal units incl. retired, 20+ gap records, 15 investment records)
- 4 TestCoalRetirementEndpoints tests

## Sprint 39b — Gas-Fired Generation Economics Analytics [COMPLETE]
- GasGenEconomics.tsx: 12-month spark spread trend chart by region, gas generators SRMC table, gas contract type badges
- /api/gas-gen/dashboard, /generators, /spark-spreads (14 CCGT/OCGT generators, 48 spark spread records across 4 regions)
- 3 TestGasGenEndpoints tests

## Sprint 39c — Consumer Protection & Retail Market Analytics [COMPLETE]
- ConsumerProtection.tsx: complaints stacked bar chart by quarter, retail offers table (DMO vs market), switching rates table
- /api/consumer-protection/dashboard, /offers, /complaints, /switching (48 retail offers, 96 complaint records, 32 switching records)
- 4 TestConsumerProtectionEndpoints tests

## Sprint 40a — Generator Availability & EFOR Analytics [COMPLETE]
- GeneratorAvailability.tsx: EFOR trend line chart by technology (2018-2024), availability table sorted by EFOR with colour-coded thresholds
- /api/efor/dashboard, /availability, /trends (60 unit-year records, 49 technology trend records)
- 3 TestEforEndpoints tests

## Sprint 40b — Climate Risk & Infrastructure Resilience Analytics [COMPLETE]
- ClimateRiskAnalytics.tsx: composite risk horizontal bar chart (top 10 assets), asset risk table with adaptation status, climate event timeline table
- /api/climate-risk/dashboard, /assets, /events (18 network assets with risk scores, 12 historical climate events)
- 3 TestClimateRiskEndpoints tests

## Sprint 40c — Smart Grid Innovation & Grid Modernisation Analytics [COMPLETE]
- SmartGridAnalytics.tsx: DOE program bar chart with state filters, DERMS systems table, AMI adoption tracking
- /api/smart-grid/dashboard, /doe-programs, /derms, /ami (12 DOE programs, 8 DERMS systems, 24 AMI adoption records)
- 4 TestSmartGridEndpoints tests

## Sprint 41a — Minimum Demand & Duck Curve Analytics [COMPLETE]
- MinimumDemandAnalytics.tsx: duck curve line chart (demand/PV/net 48 half-hour periods), min demand records table, negative pricing stacked bar chart
- /api/minimum-demand/dashboard, /records, /duck-curve, /negative-pricing (8 min demand events, 8 duck curve profiles with 48 data points each, 48 negative pricing records)
- 4 TestMinDemandEndpoints tests

## Sprint 41b — NEM Market Events & AEMO Interventions Analysis [COMPLETE]
- MarketEventsAnalysis.tsx: event duration bar chart, events table with expandable descriptions, interventions table, chronological milestone timeline
- /api/nem-suspension/dashboard, /events, /interventions, /timeline (9 major events incl. 2022 suspension + 2016 SA blackout, 10 interventions, 12 timeline milestones)
- 4 TestNEMSuspensionEndpoints tests

## Sprint 41c — Battery Technology Economics & Learning Rate Analytics [COMPLETE]
- BatteryTechAnalytics.tsx: 10-year pack cost trend line chart by technology, LCOS comparison bar chart (2024), technology spec comparison table, critical mineral supply chain risk table
- /api/battery-tech/dashboard, /costs, /lcos, /supply-chain (34 cost records 2015-2024, 12 LCOS records, 6 supply chain records)
- 4 TestBatteryTechEndpoints tests

## Sprint 42a — Community Energy & Microgrids Analytics [COMPLETE]
- CommunityEnergy.tsx: community batteries table with program/status badges, solar gardens table (waitlist + low-income allocation), standalone power systems (SPS) table with network deferral value
- /api/community-energy/dashboard, /batteries, /solar-gardens, /sps (10 community batteries, 8 solar gardens, 11 SPS systems incl. NT Aboriginal communities)
- 4 TestCommunityEnergyEndpoints tests

## Sprint 42b — Transmission Asset Management & Inspection Analytics [COMPLETE]
- AssetManagement.tsx: condition score horizontal bar chart, assets table with priority/condition badges, inspections table with severity badges
- /api/asset-management/dashboard, /assets, /inspections, /maintenance (16 assets across 5 TNSPs, 10 inspection events, 7 maintenance program records)
- 4 TestAssetManagementEndpoints tests

## Sprint 42c — Energy Transition & Decarbonization Pathway Analytics [COMPLETE]
- DecarbonizationPathway.tsx: sectoral emissions vs target bar chart, technology deployment trend line chart, net zero milestones table with progress bars and funding gap
- /api/decarbonization/dashboard, /sectors, /milestones, /technology (10 sectoral records, 12 milestones, 25 technology deployment records)
- 4 TestDecarbonizationEndpoints tests

## Sprint 43a — Nuclear SMR & Long-Duration Energy Storage Investment Analytics [COMPLETE]
- NuclearLongDuration.tsx: 4 KPI cards (Total SMR Pipeline GW, Total LDES Pipeline GWh, Avg SMR LCOE, Avg LDES LCOS), stacked area chart for Clean Firm Capacity Outlook 2025-2040 (nuclear/LDES/pumped hydro/gas CCS/H2 peaker), SMR projects table with technology/status badges, long-duration storage table with technology/status badges
- Backend Pydantic models: SmrProjectRecord, LongDurationStorageRecord, CleanFirmCapacityRecord, NuclearLongDurationDashboard
- /api/nuclear-ldes/dashboard, /smr-projects, /long-duration, /capacity-outlook (8 SMR projects across NSW/VIC/SA/QLD covering AP1000/BWRX-300/ARC-100/NuScale; 10 LDES projects covering IRON_AIR/FLOW_BATTERY/COMPRESSED_AIR/GRAVITY/PUMPED_HYDRO/LIQUID_AIR; 16-year capacity outlook 2025-2040)
- Mock data: 8 SMR projects (CAPEX 4-12B AUD, LCOE 110-180 $/MWh, first power 2035-2045, CF 85-92%, CO2 <10 kg/MWh); 10 LDES projects (duration 4-100h, LCOS 55-200 $/MWh, status PROPOSED/FEASIBILITY/APPROVED)
- TypeScript interfaces: SmrProjectRecord, LongDurationStorageRecord, CleanFirmCapacityRecord, NuclearLongDurationDashboard; api.getNuclearLdesDashboard() method added to client.ts
- App.tsx: Atom icon imported, NuclearLongDuration page imported, /nuclear-ldes route added, "Nuclear & LDES" nav item added
- 4 TestNuclearLdesEndpoints tests appended to tests/test_backend.py

## Sprint 43b — Wholesale Market Bidding Behaviour & Strategic Withholding Analytics [COMPLETE]
- BiddingBehaviour.tsx: 4 KPI cards (Total Withheld MW, Avg Withholding Ratio %, High Withholding Events, Market Power Index), Market Concentration table (5 NEM regions x 2 years with HHI color coding: <1500 green / <2500 amber / >=2500 red), Capacity Withholding Records table with region filter (participant, technology badges, withheld MW, withholding ratio color coded, spot price, rebid count badge, rebid reason), Rebid Patterns ComposedChart with dual Y-axis (total rebids + late rebids as bars, market impact score as line overlay, participant selector), Bid Price Distribution table (participants vs price bands heatmap showing volume MW and portfolio %)
- Backend Pydantic models: BidWithholdingRecord, BidPriceDistRecord, RebidPatternRecord, MarketConcentrationRecord, BiddingBehaviourDashboard
- /api/bidding-behaviour/dashboard, /withholding, /price-distribution, /rebid-patterns, /market-concentration (all require X-API-Key)
  - 12 withholding records: AGL, Origin, EnergyAustralia, Snowy Hydro, Alinta across NSW1/VIC1/QLD1/SA1; technologies COAL/GAS/HYDRO/SOLAR; withholding ratios 10.98-82.86%; rebid counts 1-8; spot prices $50-$15,000/MWh
  - 15 price distribution records: 5 participants x multiple price bands (-$1000, $0, $50, $100, $300, $1000, $5000, $15000)
  - 36 rebid pattern records: 6 participants (AGL, Origin, EnergyAustralia, Snowy, Alinta, Meridian) x 6 months (Jan-Jun 2024); late_rebids 2-20; market_impact_score 2.0-8.1
  - 10 market concentration records: NSW1, VIC1, QLD1, SA1, TAS1 x years 2023 and 2024; HHI 1520-3380; CR3 45.8-74.2%
  - KPI aggregates: total_withheld_mw, avg_withholding_ratio_pct, high_withholding_events (ratio >40%), market_power_index (HHI/500 normalised)
- TypeScript interfaces: BidWithholdingRecord, BidPriceDistRecord, RebidPatternRecord, MarketConcentrationRecord, BiddingBehaviourDashboard added to client.ts
- api methods: getBiddingBehaviourDashboard, getBiddingBehaviourWithholding, getBiddingBehaviourPriceDistribution, getBiddingBehaviourRebidPatterns, getBiddingBehaviourMarketConcentration added to api object in client.ts
- App.tsx: BiddingBehaviour page imported, /bidding-behaviour route added, "Bidding Behaviour" nav item added (BarChart2 icon already present)
- 4 TestBiddingBehaviourEndpoints tests appended to tests/test_backend.py

## Sprint 44a — Electricity Spot Price Forecasting Dashboard [COMPLETE]
- SpotForecastDashboard.tsx: 5 KPI mini-cards (one per region — current price with trend arrow + spike probability progress bar), Forecast Price Bands AreaChart (P10/P50/P90 confidence intervals + actual prices over 24h, region toggle for NSW1/QLD1/VIC1/SA1/TAS1), Regional Price Summary table (region, current price, 24h avg, 7d avg, spike prob color-coded <15% green / <35% amber / else red, volatility index, trend badge), Model Performance table with period selector (NEURAL/GBDT/ENSEMBLE, MAE, RMSE, MAPE%, R², spike detection rate)
- Backend Pydantic models: SpotForecastInterval, RegionalPriceSummary, ModelPerformanceRecord, SpotForecastDashboard
- /api/spot-forecast/dashboard, /intervals, /regional-summary, /model-performance (all with `dependencies=[Depends(verify_api_key)]`)
  - 48 forecast intervals (30-min for next 24h) for NSW1; actual prices for past 24 intervals, None for future; P10/P50/P90 bands; NEURAL/ENSEMBLE/GBDT model rotation
  - 5 regional summaries (NSW1 $87.5, QLD1 $74.2, VIC1 $112.8, SA1 $198.4, TAS1 $44.6; spike probs 5.1–40.2%; volatility 21.7–78.4)
  - 15 model performance records (NEURAL/GBDT/ENSEMBLE × 5 regions; MAE $4.8–24.5; MAPE 7.8–20.7%; R² 0.67–0.86; spike detection 65.4–85.9%)
  - next_spike_alert: "NSW1 spike risk 73% at 18:30 AEST"; overall_forecast_accuracy_pct: 88.6%
- TypeScript interfaces: SpotForecastInterval, RegionalPriceSummary, ModelPerformanceRecord, SpotForecastDashboard added to client.ts before `// Internal helpers`
- api methods: getSpotForecastDashboard, getSpotForecastIntervals, getSpotForecastRegionalSummary, getSpotForecastModelPerformance added to api object in client.ts
- App.tsx: SpotForecastDashboard page imported, /spot-forecast route added, "Spot Forecast" nav item added (Zap icon already imported)
- 4 TestSpotForecastEndpoints tests appended to tests/test_backend.py

## Sprint 44c — Carbon Credit & Offset Market Analytics [COMPLETE]
- CarbonCreditMarket.tsx: TreePine icon header, 4 KPI cards (Current ACCU Price $/unit, Total Issued Mt CO2-e, Safeguard Demand kt CO2, Market Size $B AUD), ACCU Price History line chart (Jan-Jun 2024 daily spot by type: GENERIC/HIR/LANDFILL/SAVANNA_BURNING), Carbon Price Forecast line chart (2024-2035 BASE/HIGH/LOW + EU ETS AUD), Carbon Projects table with type filter badges (REFORESTATION green, SOIL_CARBON amber, SAVANNA_BURNING orange, LANDFILL_GAS gray, AVOIDED_DEFORESTATION teal), Corporate Buyers table with purpose badges (SAFEGUARD_COMPLIANCE red, VOLUNTARY_NET_ZERO green, EXPORT blue)
- Backend Pydantic models (collision-safe names): AccuSpotRecord, CarbonOffsetProjectRecord, CarbonOffsetBuyerRecord, AccuPriceForecastRecord, CarbonCreditMarketDashboard
- /api/carbon-credit/dashboard, /spot, /projects, /buyers, /price-forecast (all with `dependencies=[Depends(verify_api_key)]`)
  - 24 ACCU spot records: daily Jan-Jun 2024; GENERIC $28-42, HIR $44-55+, LANDFILL ~$30, SAVANNA ~$34-42; volumes 8K-95K; buyer_category rotation SAFEGUARD/VOLUNTARY/GOVERNMENT/EXPORT
  - 15 carbon offset projects: QLD/NSW/WA/NT/VIC/SA states; all 5 project types; vintage 2019-2023; prices $29-48/ACCU; HIR/soil carbon at premium; co_benefits including BIODIVERSITY/WATER/INDIGENOUS_EMPLOYMENT
  - 10 corporate buyers: BHP/Rio Tinto/AGL/Qantas/Woolworths/ANZ/Santos/Woodside/CBA/Coles; purchase volumes 18K-480K ACCUs; net zero targets 2030-2050
  - 36 price forecast records: BASE/HIGH/LOW x 12 years (2024-2035); BASE $36-88; HIGH $38-148; LOW $33-65; EU ETS AUD $78-147; California cap-and-trade AUD $48-99
- TypeScript interfaces: AccuSpotRecord, CarbonOffsetProjectRecord, CarbonOffsetBuyerRecord, AccuPriceForecastRecord, CarbonCreditMarketDashboard added to client.ts
- api methods: getCarbonCreditDashboard, getCarbonCreditSpot, getCarbonCreditProjects, getCarbonCreditBuyers, getCarbonCreditPriceForecast added to api object in client.ts
- App.tsx: CarbonCreditMarket imported, TreePine imported from lucide-react, /carbon-credit route added, "Carbon Credits" nav item (TreePine icon)
- 5 TestCarbonCreditEndpoints tests appended to tests/test_backend.py
- Note: test execution blocked by pre-existing NameError at line 11930 of main.py (`@router.get` used without `router` defined — not introduced by Sprint 44c)

## Sprint 45b — Power System Resilience & Extreme Weather Analytics [COMPLETE]
- GridResilience.tsx: ShieldAlert icon header, 4 KPI cards (Total Unserved Energy MWh, Customers Affected, Total Resilience Investment $M, Avg Recovery days), SAIDI Trend grouped bar chart 2022–2024 by state (NSW/VIC/QLD/SA/WA in distinct colors), Weather Outage Events table (event type badges: BUSHFIRE red, FLOOD blue, HEATWAVE amber, STORM gray, CYCLONE purple, DROUGHT yellow-brown; severity badges: LOW green / MODERATE amber / HIGH orange / EXTREME red), Grid Asset Vulnerability table (type badges, vulnerability score progress bar 0–10 color-coded, risk badges per hazard, replacement priority badges), Resilience Investment Programs table (investment type badges, status badges)
- Backend Pydantic models: WeatherOutageEvent, ResilienceInvestmentRecord, GridVulnerabilityRecord, ResilienceKpiRecord, GridResilienceDashboard
- /api/grid-resilience/dashboard, /outage-events, /investments, /vulnerability, /kpis (all with `dependencies=[Depends(verify_api_key)]`)
  - 12 weather outage events: Black Summer NSW/VIC fires 2019-20, 2022 QLD/NSW floods, Cyclone Ilsa WA 2023, 2024 SE QLD heatwave, 2019 SA storm, 2023 VIC alpine fires, 2023 NSW central west floods, 2022 WA Cyclone Ellie, 2024 TAS drought, 2023 NT storms; severity mix LOW–EXTREME; recovery 0.5–30 days
  - 10 resilience investments: Western Sydney undergrounding ($245M), Lismore substation flood barrier ($38M), Gippsland microgrids ($82M), Powerlink fire hardening ($145M), SA remote backup power ($28M), Pilbara comms upgrade ($55M), North QLD undergrounding ($180M), VIC transmission flood protection ($62M), Adelaide Hills fire hardening ($95M), TAS diesel backup ($18M); statuses PLANNING/APPROVED/CONSTRUCTION/COMPLETE
  - 15 grid vulnerability records: mix of SUBSTATION/TRANSMISSION_LINE/DISTRIBUTION_LINE/TRANSFORMER/CONTROL_SYSTEM; age 5–45 years; vulnerability scores 4.8–8.9
  - 15 KPI records: 5 states × 3 years (2022–2024); SAIDI 140–396 min; weather_related_pct 38–71.5%; resilience investment $78M–$248M
- TypeScript interfaces: WeatherOutageEvent, ResilienceInvestmentRecord, GridVulnerabilityRecord, ResilienceKpiRecord, GridResilienceDashboard added to client.ts
- api methods: getGridResilienceDashboard, getGridResilienceOutageEvents, getGridResilienceInvestments, getGridResilienceVulnerability, getGridResilienceKpis added to api object in client.ts
- App.tsx: GridResilience imported, ShieldAlert imported from lucide-react, /grid-resilience route added, "Grid Resilience" nav item (ShieldAlert icon)
- 5 TestGridResilienceEndpoints tests appended to tests/test_backend.py

## Sprint 45a — EV Fleet & Grid-Scale Charging Integration Analytics [COMPLETE]
- EvFleetCharging.tsx: Car icon header, 4 KPI cards (Total EV Fleet Vehicles, Total Charging Power MW, Avg Fleet EV Penetration %, V2G Capable Sites), EV Demand Forecast composed chart 2024–2035 (stacked areas for total_ev_demand/managed_charging/v2g_discharge TWh; line for peak_demand_increase_gw on right axis), Fleet Registry table (fleet type badges: BUS cyan/TRUCK amber/DELIVERY_VAN orange/GOVERNMENT blue/TAXI purple; penetration % colored <30% red/<60% amber/else green; charging strategy badges: OVERNIGHT gray/OPPORTUNITY amber/SMART_V2G green), Charging Infrastructure table (location type badges: DEPOT blue/HIGHWAY green/RETAIL purple/WORKPLACE amber/RESIDENTIAL_HUB cyan; charger type badges: AC_SLOW gray/AC_FAST blue/DC_FAST amber/DC_ULTRA red; V2G green badge; status badges), V2G Dispatch composed chart (bar for v2g_export_mw; line overlay for spot price on right axis)
- Backend Pydantic models: EvFleet45Record, ChargingInfra45Record, V2GDispatch45Record, EvDemandForecast45Record, EvFleet45Dashboard (note: Sprint 27a had EvFleetRecord so 45-suffix used to avoid collision)
- /api/ev-fleet/dashboard, /fleets, /charging-infra, /v2g-dispatch, /demand-forecast (all with `dependencies=[Depends(verify_api_key)]`)
  - 10 fleet records: Sydney Buses, Melbourne Metro Trains, Australia Post, Woolworths Distribution, NSW Government Fleet, QLD Taxi Fleet, Brisbane City Council, Toll Group, StarTrack, TransLink; EV penetration 10–85%; fleet_type BUS/TRUCK/DELIVERY_VAN/GOVERNMENT/TAXI; charging_strategy mix with 5 V2G-enabled fleets
  - 12 charging infrastructure sites: depots/highways/retail/workplace/residential hub across NSW/VIC/QLD/SA/WA; AC_SLOW to DC_ULTRA; utilisation 30–80%; 5 V2G-capable sites; statuses OPERATING/CONSTRUCTION/PLANNED
  - 24 V2G dispatch intervals: 30-min for 2026-02-20 (06:00–17:30); 3 fleet IDs rotating; export 0.2–5 MW following price curve; spot prices $55–$500/MWh; SoC tracking 20–95%
  - 12 demand forecast records (2024–2035): EV stock 0.25M–11M; fleet EV % 8–91%; total demand 1.2–95 TWh; managed charging 0.3–42 TWh; V2G discharge 0.05–15.5 TWh
- TypeScript interfaces: EvFleet45Record, ChargingInfra45Record, V2GDispatch45Record, EvDemandForecast45Record, EvFleet45Dashboard added to client.ts
- api method: getEvFleetDashboard added to api object in client.ts
- App.tsx: EvFleetCharging imported, Car imported from lucide-react, /ev-fleet route added, "EV Fleet & V2G" nav item (Car icon)
- 5 TestEvFleetEndpoints tests appended to tests/test_backend.py
- Note: test execution blocked by pre-existing NameError at line 11930 of main.py (`@router.get` used without `router` defined — not introduced by Sprint 45a)

## Sprint 43c — Energy Poverty & Just Transition Analytics [COMPLETE]
- EnergyPoverty.tsx: 4 KPI cards (national hardship rate, workers in transition, total transition fund, low-income solar gap), hardship rate trend line chart by state over 4 quarters, coal worker transition table (wage ratio colored red/amber/green), affordability table (bill % income colored by stress level), just transition programs table (program type and status badges, outcomes score bar)
- /api/energy-poverty/dashboard, /hardship, /worker-transition, /affordability, /programs
  - 20 hardship records (5 states × 4 quarters 2024; hardship rates 8.6–15.8%; avg bills $1550–$2450 AUD)
  - 8 coal worker transition records (Liddell NSW, Yallourn VIC, Eraring NSW, Bayswater NSW, Muja WA, Callide QLD, Tarong QLD, Hazelwood VIC; closure years 2017–2032; statuses PLANNING/ACTIVE/COMPLETED)
  - 5 affordability records (NSW, VIC, QLD, SA, WA for 2024; low-income solar penetration 8–29%; concession coverage 68–82%)
  - 12 just transition programs (WORKER_RETRAINING, COMMUNITY_FUND, CLEAN_ENERGY_ACCESS, ECONOMIC_DIVERSIFICATION; budgets $20M–$500M; up to 58,000 beneficiaries)
- 4 TestEnergyPovertyEndpoints tests
- App.tsx: Heart icon nav entry at /energy-poverty; Heart already in lucide-react imports

## Sprint 45c — Renewable Energy Certificate Market Analytics [COMPLETE]
- RecMarket.tsx: Award icon header, title "Renewable Energy Certificate Market (LGC & STC)", subtitle about LRET compliance and certificate markets
  - 4 KPI cards: Current LGC Price ($/cert), Current STC Price ($/cert), LRET Progress %, LGC Surplus/Deficit (M)
  - LGC Spot Price History line chart (Jan–Mar 2024 daily; color-coded by technology source WIND/SOLAR/HYDRO/BIOMASS)
  - LRET Target Progress bar: visual progress indicator with achieved TWh, gap to target, and 2030 deadline
  - LGC Creation Registry table: filterable by technology (WIND/SOLAR/HYDRO/BIOMASS/WASTE_COAL_MINE); 20 stations including Macarthur Wind Farm, Snowtown, Bungala Solar, Snowy 2.0, Hornsdale, etc.; technology badges (WIND blue, SOLAR amber, HYDRO cyan, BIOMASS green, WASTE_COAL_MINE gray)
  - LRET Compliance table: 8 liable entities (AGL, Origin, EnergyAustralia, Alinta, ERM, Snowy, Ergon, Powercor); compliance % color-coded; CheckCircle/AlertTriangle icons
  - STC Market section: quarterly bar+line chart (2022–2024) + detail table with quarter, price, volume, rooftop solar MW, solar HW units, heat pumps, total value
- Backend Pydantic models: LgcSpotRecord, SurplusDeficitRecord, LgcCreationRecord, StcRecord, RecMarketDashboard
- Endpoints: /api/rec-market/dashboard, /lgc-spot, /lgc-creation, /surplus-deficit, /stc (all with verify_api_key)
  - 24 LGC spot records: Jan–Mar 2024; prices $42.80–$58.10/cert; volumes 7.6K–41.2K; technologies WIND/SOLAR/HYDRO/BIOMASS; vintages 2023–2024
  - 8 surplus/deficit records: AGL/Origin/EnergyAustralia/Alinta/ERM/Snowy/Ergon/Powercor; 3 entities with shortfalls (EnergyAustralia 25K LGCs/$1.32M, ERM 12K/$0.63M, Powercor 9K/$0.47M)
  - 20 LGC creation records: major wind/solar/hydro/biomass/waste-coal-mine stations; LGCs created 112K–4.23M; capacities 38–2000 MW; avg prices $44.80–$54.80/cert
  - 8 STC quarterly records: 2022-Q3 through 2024-Q2; prices $37.50–$40.20/cert; volumes 18.45M–25.6M; rooftop solar 389–568 MW/quarter; total values $691.9M–$1021.4M
- Dashboard KPIs: current_lgc_price=$42.80, current_stc_price=$40.20, lgc_surplus_deficit_m=-2.3 (deficit), lret_target_2030_twh=33.0, lret_progress_pct=67.4%
- Cache TTL: 1800s (30 minutes)
- TypeScript interfaces: LgcSpotRecord, SurplusDeficitRecord, LgcCreationRecord, StcRecord, RecMarketDashboard added to client.ts
- api methods: getRecMarketDashboard, getRecMarketLgcSpot, getRecMarketLgcCreation, getRecMarketSurplusDeficit, getRecMarketStc added to api object in client.ts
- App.tsx: RecMarket imported, Award imported from lucide-react, /rec-market route added, "REC Market (LGC/STC)" nav item (Award icon)
- 5 TestRecMarketEndpoints tests appended to tests/test_backend.py

## Sprint 46a — Transmission Congestion & Nodal Pricing Analytics [COMPLETE]
- TransmissionCongestion.tsx: Network icon header, title "Transmission Congestion & Nodal Pricing Analytics", subtitle about NEM constraint binding, LMP decomposition, congestion rent
  - 4 KPI cards: Total Congestion Rent ($M AUD, all interconnectors 2024), Most Constrained Interconnector, Avg Binding %, Peak Shadow Price ($/MWh)
  - Congestion Heatmap chart: Recharts ComposedChart — grouped bars by interconnector (VIC1-NSW1 blue, QLD1-NSW1 green, SA1-VIC1 amber, TAS1-VIC1 cyan) for utilisation % + pink line overlay for avg price separation (right axis); 6 months Jan–Jun 2024
  - Constraint Binding table: sorted descending by binding %; interconnector badge (colored), direction badge (IMPORT blue, EXPORT purple), binding hours, binding % (red/amber/green threshold coloring), avg/max shadow prices, congestion rent ($M), primary cause badge (THERMAL red, STABILITY orange, VOLTAGE amber, NETWORK_OUTAGE gray)
  - Nodal LMP Decomposition stacked bar chart: Energy (blue), Loss (green), Congestion (amber) components per node; 12 nodes across NSW/VIC/QLD/SA/TAS
  - Congestion Rent Distribution table: per interconnector-quarter with total rent, SREC allocated, TNSP retained, hedging value; total row in footer
  - Interconnector color legend panel at bottom
- Backend Pydantic models: ConstraintBindingRecord, NodalPriceRecord, CongestionRentRecord, CongestionHeatmapRecord, TransmissionCongestionDashboard
- Endpoints: /api/transmission-congestion/dashboard, /constraints, /nodal-prices, /congestion-rent, /heatmap (all with verify_api_key)
  - 10 constraint binding records: VIC1-NSW1/QLD1-NSW1/SA1-VIC1/TAS1-VIC1 (IMPORT+EXPORT directions); binding 5–39%; avg shadow prices $42–$487/MWh; max shadow prices $2.1K–$15.1K; congestion rent $9.7M–$198.4M; causes THERMAL/STABILITY/VOLTAGE/NETWORK_OUTAGE
  - 12 nodal price records: Eraring/Sydney CBD (NSW), Loy Yang/Melbourne (VIC), Tarong/Brisbane (QLD), Torrens/Adelaide (SA), Basslink (TAS), TransGrid North (NSW), Moorabool Wind (VIC), Western Downs Solar (QLD); LMP $44.7–$134.2/MWh; congestion -$46.8 to +$38.4/MWh
  - 16 congestion rent records: 4 interconnectors × 4 quarters 2024; total rent $19.8M–$67.4M per IC-quarter; SREC/TNSP/hedging components
  - 24 heatmap records: 4 interconnectors × 6 months (Jan–Jun 2024); utilisation 45–95%; binding events 98–412; price separation $8.2–$78.6/MWh
- Dashboard KPIs: total_congestion_rent_m_aud (sum across all 16 rent records), most_constrained_interconnector=SA1-VIC1 (38.9% binding), avg_binding_pct across 10 constraints, peak_shadow_price=$15,100/MWh
- Cache TTL: 600s (10 minutes)
- TypeScript interfaces: ConstraintBindingRecord, NodalPriceRecord, CongestionRentRecord, CongestionHeatmapRecord, TransmissionCongestionDashboard added to client.ts
- api methods: getTransmissionCongestionDashboard, getTransmissionCongestionConstraints, getTransmissionCongestionNodalPrices, getTransmissionCongestionRent, getTransmissionCongestionHeatmap added to api object in client.ts
- App.tsx: TransmissionCongestion imported; Network icon already in lucide-react imports; /transmission-congestion route added; "Transmission Congestion" nav item (Network icon) added before Settings
- 5 TestTransmissionCongestionEndpoints tests appended to tests/test_backend.py

## Sprint 46c — Electricity Market Design & Reform Tracker [COMPLETE]
- MarketDesignReform.tsx: BookOpen icon header, title "Electricity Market Design & Reform Tracker", subtitle about NEM reform pipeline, capacity mechanisms, and global market benchmarking
  - 4 KPI cards: Active Reform Proposals (3), Implemented Reforms (6), Total Reform Benefit ($1.9B AUD), Capacity Mechanism Pipeline (5.4 GW)
  - Proposals by Reform Area bar chart: Recharts BarChart showing count per area (indigo bars); 7 areas represented
  - Capacity Mechanisms Target vs Contracted bar chart: Recharts grouped BarChart; amber=target, green=contracted; per region
  - Reform Proposals table: filterable by status dropdown; title+summary excerpt, proposing body, reform area badge (CAPACITY_MECHANISM red, PRICING amber, SETTLEMENT blue, STORAGE cyan, DER green, RETAIL purple, PLANNING gray), status badge (CONSULTATION blue, DRAFT_DETERMINATION amber, FINAL_DETERMINATION orange, IMPLEMENTED green, REJECTED red), impact badge (LOW/MEDIUM/HIGH/TRANSFORMATIVE), decision date, annual benefit ($M)
  - Capacity Mechanisms table: mechanism name, region, type badge (RELIABILITY_OBLIGATION red, CAPACITY_AUCTION blue, STRATEGIC_RESERVE amber, CAPACITY_PAYMENT purple), status badge, target/contracted MW with progress bar + fill %, cost per MW ($AUD), storage eligible checkmark/x
  - Settlement Reforms section: grid of cards (1-3 col responsive); each card shows pre/post reform avg price with delta, volatility change %, storage revenue impact, demand response change, winner badge (GENERATORS red, STORAGE blue, CONSUMERS green, MIXED amber), assessment excerpt
  - Global Market Comparison table: NEM row highlighted (indigo background + HOME badge); 8 markets (NEM/WEM/ERCOT/PJM/CAISO/NORDPOOL/GB_NETA/SINGAPORE); market type badge, settlement interval, capacity mechanism type badge, price cap, renewables % (green if >=50%), avg price, market size TWh
- Backend Pydantic models: MarketDesignProposalRecord, CapacityMechanismRecord, SettlementReformRecord, MarketDesignComparisonRecord, MarketDesignDashboard
- Endpoints: /api/market-design/dashboard, /proposals, /capacity-mechanisms, /settlement-reforms, /market-comparison (all with verify_api_key)
  - 12 reform proposals: 5-minute settlement (IMPLEMENTED), Capacity Investment Scheme (IMPLEMENTED), Storage registration (IMPLEMENTED), Integrating ESS (FINAL_DETERMINATION), DER integration (IMPLEMENTED), Default Market Offer (IMPLEMENTED), ISP actionable projects (DRAFT_DETERMINATION), Intraday auction proposal (CONSULTATION), Minimum demand management (FINAL_DETERMINATION), Demand response mechanism (IMPLEMENTED), Whole of System Plan (CONSULTATION), NEM price cap review (REJECTED)
  - 6 capacity mechanism records: NSW Retailer Reliability Obligation (OPERATIONAL), QLD Strategic Reserve (OPERATIONAL), SA Capacity Auction Pilot (PILOT), VIC Capacity Payment Review (PROPOSED), National Capacity Mechanism Proposal (PROPOSED), WEM Capacity Credit Mechanism (OPERATIONAL)
  - 5 settlement reform records: 5-minute settlement NEM 2021 (STORAGE winner), WEM Real-Time 2023 (MIXED), Intraday Auction proposal 2026 (MIXED), SA Real-Time Pricing Pilot 2022 (CONSUMERS), NEM Demand Response 2021 (CONSUMERS)
  - 8 market comparison records: NEM (GROSS_POOL, 5-min, OBLIGATION, 38.2% RE), WEM (GROSS_POOL, 30-min), ERCOT (GROSS_POOL, 5-min, NONE), PJM (GROSS_POOL, 5-min, AUCTION), CAISO (GROSS_POOL, 5-min, OBLIGATION), NORDPOOL (HYBRID, 60-min, NONE, 91.4% RE), GB_NETA (NET_POOL, 30-min, AUCTION), SINGAPORE (GROSS_POOL, 30-min, PAYMENT)
- Dashboard KPIs: active_proposals=3 (CONSULTATION+DRAFT+FINAL), implemented_reforms=6, total_reform_benefit_b_aud (sum of annual benefits / 1000), capacity_mechanism_pipeline_gw (PROPOSED+PILOT target MW / 1000)
- Cache TTL: 600s (10 minutes)
- TypeScript interfaces: MarketDesignProposalRecord, CapacityMechanismRecord, SettlementReformRecord, MarketDesignComparisonRecord, MarketDesignDashboard added to client.ts
- api methods: getMarketDesignDashboard, getMarketDesignProposals, getMarketDesignCapacityMechanisms, getMarketDesignSettlementReforms, getMarketDesignMarketComparison added to api object in client.ts
- App.tsx: MarketDesignReform imported; BookOpen added to lucide-react imports; /market-design route added; "Market Design" nav item (BookOpen icon) added before Settings
- 5 TestMarketDesignEndpoints tests appended to tests/test_backend.py

## Sprint 46b — DERMS & DER Orchestration Analytics [COMPLETE]
- DermsOrchestration.tsx: Layers icon header, title "DERMS & DER Orchestration Analytics", subtitle about VPP dispatch, grid flexibility services and behind-the-meter resource orchestration
  - 4 KPI cards: Total Controllable Capacity (MW), Total Enrolled Devices, Avg Dispatch Accuracy %, Peak Flexibility (MW)
  - DER Portfolio stacked bar chart: potential_flexibility_mw per DER type (ROOFTOP_SOLAR amber, HOME_BATTERY blue, EV_CHARGER green, HVAC purple, HOT_WATER cyan) grouped by state (NSW/VIC/QLD/SA/WA)
  - Monthly KPI line chart: peak_coincidence_reduction_mw by state (NSW/VIC/QLD/SA/WA) over Jan–Apr 2024
  - Aggregator Registry table: name, state, DER types, enrolled/controllable devices, peak dispatch MW, market registration badge (VPP green, FCAS amber, DEMAND_RESPONSE blue, ALL purple), response time, dispatch success % (color-coded)
  - VPP Dispatch Event Log table: date, aggregator, trigger badge (PRICE_SPIKE red, GRID_FREQUENCY orange, OPERATOR_INSTRUCTION blue, SCHEDULED gray), requested/delivered MW, accuracy % (color-coded), duration, revenue ($AUD), grid service badge (ENERGY blue, FCAS_R6/R60 amber, DEMAND_RESPONSE green)
- Backend Pydantic models: DerAggregatorRecord, DerDispatchEventRecord, DerPortfolioRecord, DerOrchestrationKpiRecord, DermsOrchestrationDashboard
- Endpoints: /api/derms-orchestration/dashboard, /aggregators, /dispatch-events, /der-portfolio, /kpis (all with verify_api_key)
  - 8 aggregator records: AGL VPP (NSW), Origin VPP (VIC), Tesla Energy Plan (SA), Amber Electric (QLD), Reposit Power (NSW), EnergyAustralia Smart Home (VIC), Simply Energy DER (SA), Ausgrid DER Program (NSW); enrolled 5100–48500 devices; dispatch success 87.6–98.4%
  - 15 dispatch events: Jan–Apr 2024; all 4 trigger types; accuracy 79.5–99.7%; all grid service types; revenue $19.8K–$305K
  - 20 DER portfolio records: 4 DER types × 5 states (NSW/VIC/QLD/SA/WA); smart penetration 15–90%; VPP enrolment 4.1–32.1%
  - 20 KPI records: 5 states × 4 months Jan–Apr 2024; dispatches 10–51/month; peak coincidence reduction 46–210 MW
- Dashboard KPIs: total_controllable_mw (sum peak_dispatch_mw), total_enrolled_devices (sum enrolled_devices), avg_dispatch_accuracy_pct (mean across 15 events), peak_flexibility_mw (sum potential_flexibility_mw across portfolio)
- Cache TTL: 300s (5 minutes)
- TypeScript interfaces: DerAggregatorRecord, DerDispatchEventRecord, DerPortfolioRecord, DerOrchestrationKpiRecord, DermsOrchestrationDashboard added to client.ts
- api methods: getDermsOrchestrationDashboard, getDermsOrchestrationAggregators, getDermsOrchestrationDispatchEvents, getDermsOrchestrationDerPortfolio, getDermsOrchestrationKpis added to api object in client.ts
- App.tsx: DermsOrchestration imported; Layers icon added to lucide-react imports; /derms-orchestration route added; "DERMS & VPP" nav item (Layers icon) added before Settings
- 5 TestDermsOrchestrationEndpoints tests appended to tests/test_backend.py

## Sprint 47b — Retail Offer Comparison & Tariff Analytics [COMPLETE]
- RetailOfferComparison.tsx: Tag icon header, title "Electricity Retail Offer Comparison", subtitle about DMO vs market offers, solar FIT, tariff structures
  - 4 KPI cards: Avg Market Discount vs DMO %, Cheapest Offer State, Avg Solar FIT Rate (c/kWh), TOU Adoption %
  - DMO vs Market ComposedChart: grouped bars for dmo_annual_bill (red), avg_market_offer_bill (blue), cheapest_offer_bill (green) by state/year; line for consumers_on_dmo_pct (amber, right axis)
  - Market Offers table: retailer, state, offer name, offer type badge (FLAT_RATE gray, TOU blue, DEMAND purple, FLEXIBLE amber, EV_OPTIMISED green), supply charge, peak rate, solar FIT, est. annual bill 5000 kWh — filterable by state and type dropdowns
  - Solar FIT Comparison table: state, retailer, FIT type badge (GROSS yellow, NET teal, BATTERY_FEED_IN indigo), rate, minimum rate flag, time-varying, peak/off-peak rates
  - Tariff Structure grid of cards: peak hours, peak/off-peak/shoulder rates, demand charge, battery optimisation badge, EV discount badge
- Backend Pydantic models: MarketOfferRecord, DmoVsMarketRecord, SolarFitRecord, TariffStructureRecord, RetailOfferComparisonDashboard
- Endpoints: /api/retail-offer-comparison/dashboard, /offers, /dmo-comparison, /solar-fit, /tariff-structures (all with verify_api_key)
  - 20 market offer records: AGL/Origin/EnergyAustralia/Alinta/Simply Energy/Amber/Powershop across NSW/VIC/QLD/SA; FLAT_RATE/TOU/DEMAND/FLEXIBLE/EV_OPTIMISED types; bills $800–$2400; solar FIT 6–18c
  - 8 DMO vs market records: NSW/VIC/QLD/SA × 2023/2024; market discount 16–25.5%; consumers on DMO 18–40%
  - 12 solar FIT records: major retailers across 4 states; NET/GROSS/BATTERY_FEED_IN; rates 6.7–18c; time-varying options with peak/off-peak rates
  - 8 tariff structure records: FLAT_RATE/TOU/DEMAND/FLEXIBLE/EV_OPTIMISED across states; peak hours descriptions; battery optimisation and EV discount flags
- Dashboard KPIs: avg_market_discount_pct (mean across DMO records), cheapest_offer_state (state with lowest cheapest_offer_bill), avg_solar_fit_rate (mean FIT rates), tou_adoption_pct (TOU offers / total offers × 100)
- Cache TTL: 300s (5 minutes)
- TypeScript interfaces: MarketOfferRecord, DmoVsMarketRecord, SolarFitRecord, TariffStructureRecord, RetailOfferComparisonDashboard appended to client.ts
- api methods: getRetailOfferComparisonDashboard, getRetailOfferComparisonOffers, getRetailOfferComparisonDmo, getRetailOfferComparisonSolarFit, getRetailOfferComparisonTariffStructures added to api object in client.ts
- App.tsx: RetailOfferComparison imported; Tag icon added to lucide-react imports; /retail-offer-comparison route added; "Retail Offer Compare" nav item (Tag icon) added before Settings
- 5 TestRetailOfferComparisonEndpoints tests appended to tests/test_backend.py

## Sprint 47c — AEMO System Operator Actions & Instructions Dashboard [COMPLETE]
- SystemOperatorActions.tsx: AlertOctagon icon header, title "AEMO System Operator Actions & Instructions", subtitle about emergency interventions, directions, RERT activations, load shedding
  - 4 KPI cards: Total Directions (2024), RERT Activations (2024), Total Load Shed (MWh), Direction Cost ($M AUD)
  - Directions table: direction ID, datetime, region badge, participant, type badge (GENERATE green/REDUCE_OUTPUT red/INCREASE_LOAD blue/REDUCE_LOAD orange/MAINTAIN gray), MW directed, reason badge (LOW_RESERVE amber/FREQUENCY purple/VOLTAGE indigo/NETWORK cyan/SECURITY rose), duration, compliance %, cost ($AUD), outcome badge
  - RERT Activations cards: activation ID, trigger badge (LOR1 green/LOR2 amber/LOR3 red), region, date, contracted/activated MW, duration, cost, reserve margin before/after arrow, provider chips
  - Load Shedding Events table: date, region badge, state, cause badge (GENERATION_SHORTFALL red/NETWORK_FAILURE orange/EXTREME_DEMAND amber/CASCADING purple), peak MW, duration, customers affected, unserved energy MWh, financial cost, VoLL cost
  - Constraint Relaxations table: constraint name + ID, region badge, date, original/relaxed/delta MW, approval authority, duration, risk badge (LOW green/MEDIUM amber/HIGH red)
- Backend Pydantic models: SysOpDirectionRecord, SysOpRertActivation, LoadSheddingEvent, ConstraintRelaxation, SystemOperatorDashboard
- Endpoints: /api/system-operator/dashboard, /directions, /rert-activations, /load-shedding, /constraint-relaxations (all with verify_api_key)
  - 12 direction records: 2024 events; SA1/NSW1/VIC1/QLD1; AGL/Origin/EnergyAustralia/Snowy/CS Energy/Stanwell; GENERATE/REDUCE_OUTPUT/INCREASE_LOAD/MAINTAIN types; LOW_RESERVE/FREQUENCY/VOLTAGE/NETWORK/SECURITY reasons; costs $95K-$4.9M; mostly SUCCESSFUL (2 PARTIAL, 1 FAILED)
  - 5 RERT activations: SA1 (Jan 2023 LOR3, Jul 2024 LOR3), NSW1 (Jun 2023 LOR2), VIC1 (Aug 2023 LOR1), QLD1 (Feb 2024 LOR2); contracted 200-1000 MW; costs $1.8M-$30.1M
  - 4 load shedding events: 2019 QLD GENERATION_SHORTFALL (200 MWh), 2022 NEM CASCADING (5000 MWh), 2023 SA EXTREME_DEMAND (50 MWh), 2024 VIC NETWORK_FAILURE (380 MWh)
  - 8 constraint relaxations: SA1/NSW1/VIC1/QLD1 constraints; relaxation 50-500 MW; LOW/MEDIUM/HIGH risk; approved by AEMO/TNSPs
- Dashboard KPIs: total_directions_2024 (len directions), total_rert_activations_2024 (2024 RERT count), total_load_shed_mwh (sum unserved_energy_mwh), total_direction_cost_m_aud (sum cost_aud / 1M)
- Cache TTL: 300s (5 minutes)
- TypeScript interfaces: SysOpDirectionRecord, SysOpRertActivation, LoadSheddingEvent, ConstraintRelaxation, SystemOperatorDashboard appended to client.ts
- api methods: getSystemOperatorDashboard, getSystemOperatorDirections, getSystemOperatorRertActivations, getSystemOperatorLoadShedding, getSystemOperatorConstraintRelaxations added to api object in client.ts
- App.tsx: SystemOperatorActions imported; AlertOctagon already present in lucide-react imports; /system-operator route added; "System Operator" nav item (AlertOctagon icon) added before Settings
- 5 TestSystemOperatorEndpoints tests appended to tests/test_backend.py

## Sprint 47a — REZ Capacity & Development Tracking [COMPLETE]
- RezCapacityTracking.tsx: MapPin icon header, title "Renewable Energy Zone (REZ) Capacity Tracker", subtitle about ISP REZ pipeline, network augmentation, generation build-out
  - 4 KPI cards: Total REZ Target (GW), Connected Capacity (GW), Total Pipeline (GW), Network Augmentation Cost ($B)
  - REZ Capacity Progress chart: horizontal stacked bar per zone (Connected green, Construction blue, Approved amber, Proposed gray) vs target; sorted by target MW descending
  - Build-out Forecast chart: stacked area 2024–2029 cumulative MW for 5 REZs (New England, Central-West Orana, Western Victoria, South Australia, Queensland Central); 5 distinct colours
  - REZ Zones table: REZ name, state, zone type badge (WIND blue / SOLAR amber / HYBRID green), ISP priority badge (STEP_CHANGE green / CENTRAL amber / SLOW_CHANGE gray), target/connected/pipeline MW, network limit, augmentation required, cost ($M); sorted by target MW desc
  - Projects table: project name, REZ, technology badge (WIND/SOLAR/HYBRID/STORAGE), developer, state, capacity MW, status badge (OPERATING/CONSTRUCTION/APPROVED/PROPOSED), connection year, PPA signed, offtake badge (MERCHANT gray/PPA_CORPORATE blue/PPA_RETAILER green/GOVERNMENT purple) — filterable by zone and status dropdowns
  - Network Augmentations table: project name, REZ ID, TNSP, augmentation type badge (NEW_LINE blue/UPGRADE green/SUBSTATION amber/TRANSFORMER purple/REACTIVE_SUPPORT gray), voltage kV, capacity increase MW, CAPEX $M, status badge, completion year
- Backend Pydantic models (with RezGen prefix to avoid collisions with Sprint 20c): RezZoneRecord, RezProjectRecord, RezNetworkAugRecord, RezBuildOutRecord, RezCapacityDashboard
- Naming collision check: existing RezProject, RezDashboard (Sprint 20c), RezRecord confirmed; new models use distinct names; existing /api/rez/ routes unaffected
- Mock data: 10 REZ zone records (real ISP REZs: New England NSW, Central-West Orana NSW, South West NSW, Western Victoria, North East Victoria, SA REZ, Queensland Central, NW Tasmania, Hunter Valley NSW, Darling Downs QLD), 15 project records (Neoen/Origin/AGL/EDF/Tilt/CWP; WIND/SOLAR/HYBRID; OPERATING through PROPOSED), 8 network augmentation projects (TransGrid/AusNet/ElectraNet/Powerlink/TasNetworks; 500kV and 275kV), 30 build-out records (2024–2029 × 5 REZs)
- Dashboard KPIs computed: total_target_capacity_gw (sum target / 1000), total_connected_gw (sum connected / 1000), total_pipeline_gw (sum construction+approved+proposed / 1000), network_augmentation_cost_b_aud (sum capex / 1000)
- Endpoints: /api/rez-capacity/dashboard, /api/rez-capacity/zones, /api/rez-capacity/projects, /api/rez-capacity/network-augmentations, /api/rez-capacity/build-out (all with verify_api_key, TTL 300s cache)
- TypeScript interfaces: RezZoneRecord, RezProjectRecord, RezNetworkAugRecord, RezBuildOutRecord, RezCapacityDashboard appended to client.ts
- api methods: getRezCapacityDashboard, getRezCapacityZones, getRezCapacityProjects, getRezCapacityNetworkAugmentations, getRezCapacityBuildOut added to api object in client.ts
- App.tsx: RezCapacityTracking imported; MapPin already present in lucide-react imports; /rez-capacity route added; "REZ Capacity" nav item (MapPin icon) added before Settings
- 5 TestRezCapacityEndpoints tests appended to tests/test_backend.py

## Sprint 48b — NEM Price Spike Post-Event Analysis [COMPLETE]
- PriceSpikeAnalysis.tsx: TrendingUp icon header (Flame already used by Gas/Hydrogen/Coal Retirement), title "NEM Price Spike Post-Event Analysis", subtitle about root cause analysis, market participant behaviour, consumer impact, and regulatory response
  - 4 KPI cards: Spike Events 2024 (AlertTriangle red), Total Consumer Cost $M (DollarSign amber), Avg Spike Duration min (Clock blue), Most Affected Region (MapPin teal)
  - Spike Severity Timeline: ScatterChart with custom bubble shapes; X=event date (epoch ms), Y=peak price $/MWh; bubble size proportional to sqrt(duration_minutes)*4 capped at 60; color by severity (MODERATE amber, HIGH orange, EXTREME red, MARKET_SUSPENSION purple); custom tooltip showing event name, region, peak price, date
  - Spike Events table: event name, RegionBadge, date, duration (min), peak price ($/MWh, orange), price multiple (amber), consumer cost ($M, red), RootCauseBadge, SeverityBadge (MARKET_SUSPENSION pulses); clickable rows to filter detail panels
  - Top Contributors detail panel (filters to selected spike): participant, technology, ContributionTypeBadge, MW impact (+/- formatted), price contribution ($/MWh), revenue gained ($M), RegulatoryActionBadge (FINED red / CAUTIONED orange / INVESTIGATED yellow / CLEARED green)
  - Consumer Impact detail panel: stacked BarChart (hedged blue, unhedged red per segment); supplement table with hedged%, unhedged cost, demand response MW, A/C curtailment MW, price signal response%
  - Notes section: explains root cause taxonomy, hedging exposure definitions, regulatory action statuses
- Naming collision check: Sprint 13b uses PriceSpikeEvent and SpikeAnalysisSummary; Sprint 48b uses PSA-prefix (PSAEventRecord, PSAContributorRecord, PSAConsumerImpact, PSARegionalTimeline, PSADashboard) to avoid any conflict; endpoints use /api/spike-analysis/ (not /api/price-spike/)
- Backend Pydantic models: PSAEventRecord, PSAContributorRecord, PSAConsumerImpact, PSARegionalTimeline, PSADashboard
- Mock data:
  - 8 spike events: SPK-2022-001 (NEM Market Suspension Jun 2022 MARKET_SUSPENSION), SPK-2022-002 (NSW Summer Heatwave Jan 2022 EXTREME), SPK-2023-001 (SA Heatwave Jan 2023 EXTREME), SPK-2023-002 (VIC Gas Shortage Jul 2023 HIGH), SPK-2023-003 (QLD Network Constraint Nov 2023 HIGH), SPK-2024-001 (NSW Summer Peak Jan 2024 EXTREME), SPK-2024-002 (VIC Winter Peak Jul 2024 HIGH), SPK-2024-003 (QLD Cycling Sep 2024 MODERATE); peak prices $5200-$15300; durations 30-10080 min; root causes: GENERATION_SHORTFALL/DEMAND_SPIKE/WEATHER/STRATEGIC_BIDDING/NETWORK_CONSTRAINT
  - 12 contributor records: 3 for NEM Suspension (Origin/AGL/EnergyAustralia coal), 2 for NSW heatwave (Snowy Hydro/Meridian), 2 for SA heatwave (AGL OCGT/ElectraNet), 2 for VIC gas (Origin/AGL OCGT — one FINED), 1 for NSW 2024 (Origin), 1 for VIC 2024 (EnergyAustralia), 1 for QLD 2024 (CS Energy)
  - 16 consumer impact records: 2 segments × 8 spikes (RESIDENTIAL/INDUSTRIAL/C_AND_I/SME across NEM-WIDE/NSW1/SA1/VIC1/QLD1)
  - 40 regional timeline records: 5 intervals × 8 spikes; showing pre-spike, ramp-up, peak, decline, recovery
- Dashboard KPIs: total_spike_events_2024=3, total_consumer_cost_m_aud=sum of all 8 events, avg_spike_duration_min=avg across 8 events, most_affected_region="NSW1"
- Endpoints: GET /api/spike-analysis/dashboard, /events, /contributors, /consumer-impacts, /regional-timeline (all with Depends(verify_api_key), tag="Spike Analysis")
- TypeScript interfaces: PSAEventRecord, PSAContributorRecord, PSAConsumerImpact, PSARegionalTimeline, PSADashboard appended to client.ts
- api methods: getSpikeAnalysisDashboard, getSpikeAnalysisEvents, getSpikeAnalysisContributors, getSpikeAnalysisConsumerImpacts, getSpikeAnalysisRegionalTimeline added to api object in client.ts
- App.tsx: PriceSpikeAnalysis imported; Flame already present (used by Gas Market, Green Hydrogen, Coal Retirement); /spike-analysis route added; "Price Spike Analysis" nav item (Flame icon) added after Network Tariff Reform, before Settings
- 5 TestSpikeAnalysisEndpoints tests appended to tests/test_backend.py

## Sprint 49a — Energy Storage Revenue Stacking & Optimisation Analytics [COMPLETE]
- StorageRevenueStack.tsx: BarChart3 icon header, title "Energy Storage Revenue Stacking & Optimisation", subtitle about multi-service co-optimisation, FCAS + energy + capacity stacking
  - 4 KPI cards: Avg Total Revenue ($M/yr) blue, Best Revenue Project green, Energy vs FCAS Split % amber, Co-optimisation Benefit % purple
  - Revenue Waterfall stacked bar chart: 8 BESS projects sorted by total revenue descending; 6 revenue streams (energy arbitrage blue, FCAS raise green, FCAS lower cyan, capacity amber, network purple, ancillary gray); detail table with LCOE, IRR%, payback years
  - Scenario Comparison grouped bar chart: ENERGY_ONLY/FCAS_ONLY/FULL_STACK/NETWORK_CONTRACT showing Revenue/Cost/Profit per scenario; ROI%, payback, NPV table demonstrating clear revenue uplift from full stacking
  - Dispatch Optimisation: action heatmap row (24 hourly cells coloured CHARGE blue/DISCHARGE red/IDLE gray/FCAS_STANDBY amber with hover tooltip); dual-axis LineChart showing SOC trajectory + hourly revenue ($K); scrollable hourly table with SOC transition, action badge, energy MWh, P/L
  - Multi-Service Bids table: 10 records across 8 BESS projects; columns for energy bid MW, FCAS contingency raise/lower, FCAS regulation raise/lower, FCAS revenue, energy revenue, co-optimisation uplift % (amber)
- Naming collision check: Sprint 14b used /api/storage/ (BessUnit/BessDispatchInterval/BessFleetSummary); Sprint 23a used /api/battery-economics/ (BatteryArbitrageSlot); Sprint 35a used /api/storage/ again (StorageArbitrage); Sprint 44b added StorageArbitrage at /api/storage/; Sprint 49a uses /api/storage-revenue-stack/ prefix and SRV- prefixed data variables; no collisions
- Backend Pydantic models: StorageRevenueWaterfall, StorageDispatchOptRecord, MultiServiceBidRecord, StorageScenarioRecord, StorageRevenueStackDashboard
- Mock data:
  - 8 revenue waterfall records: Hornsdale PR (150MW/194MWh SA, $21.6M total, IRR 16.5%), Victorian Big Battery (300MW VIC, $28.2M, IRR 18%), Waratah Super Battery (850MW NSW, $31.7M, IRR 17.8%), Torrens Island BESS (250MW SA, $19.2M), Moorabool (200MW VIC), Kwinana (100MW WA), Gannawarra (25MW VIC), Lake Bonney (100MW SA); FCAS $4.9-12.3M, energy $2-8.1M, capacity $0.5-3M, total $7.9-31.7M
  - 24 dispatch optimisation records: representative Jan peak summer day; actions: CHARGE (8 intervals off-peak), DISCHARGE (6 intervals peak/morning peak), FCAS_STANDBY (7 intervals, including evening peak), IDLE (1 interval); SOC 10%→95%→10%; peak DISCHARGE revenue $42.8K-73.2K at hours 12,19; FCAS regulation priority at hours 10,14,17; revenue-negative CHARGE intervals -$0.8K to -4.9K
  - 10 multi-service bid records: HPR/VBB/WSB/TIB/MBB/KBB/GBB/LBB across Jan-Aug 2024 trading dates; co-optimisation uplift 15.2%-31.7%; FCAS contingency raise 14-350 MW; energy bids 18-420 MW
  - 4 scenario comparison records: ENERGY_ONLY ($8.2M rev, $2.8M profit, ROI 9.3%, 12.5yr payback, NPV $18.4M) → FCAS_ONLY ($14.6M rev, $9.2M profit, ROI 15.8%) → FULL_STACK ($26.8M rev, $21M profit, ROI 24.5%, 4.9yr payback, NPV $142.7M) → NETWORK_CONTRACT ($31.4M rev, $25.3M profit, ROI 28.2%, 4.2yr payback, NPV $175.3M)
- Dashboard KPIs: avg_total_revenue_m_aud=18.7, best_revenue_project="Waratah Super Battery", energy_vs_fcas_split_pct=38.5 (energy share), co_optimisation_benefit_pct=23.2
- Endpoints: GET /api/storage-revenue-stack/dashboard, /waterfall, /dispatch-optimisation, /multi-service-bids, /scenarios (all with Depends(verify_api_key), tag="Storage Revenue Stack")
- TypeScript interfaces: StorageRevenueWaterfall, StorageDispatchOptRecord, MultiServiceBidRecord, StorageScenarioRecord, StorageRevenueStackDashboard appended to client.ts
- api methods: getStorageRevenueStackDashboard, getStorageRevenueStackWaterfall, getStorageRevenueStackDispatchOptimisation, getStorageRevenueStackMultiServiceBids, getStorageRevenueStackScenarios added to api object in client.ts
- App.tsx: StorageRevenueStack imported; BarChart3 added to lucide-react imports (new icon, not previously imported); /storage-revenue-stack route added; "Storage Revenue Stack" nav item (BarChart3 icon) added after Price Spike Analysis, before Settings
- 5 TestStorageRevenueStackEndpoints tests appended to tests/test_backend.py

## Sprint 49c — Solar Irradiance & Resource Assessment Analytics — 2026-02-20T00:00:00+11:00 (AEDT)

**Completed:**
- Naming collision check: No collisions found for IrradianceSiteRecord, SolarFarmYieldRecord, MonthlyIrradianceRecord, SolarDegradationRecord, SolarResourceDashboard, /api/solar-resource/* endpoints
- Backend Pydantic models: IrradianceSiteRecord, SolarFarmYieldRecord, MonthlyIrradianceRecord, SolarDegradationRecord, SolarResourceDashboard appended to app/backend/main.py
- Mock data:
  - 10 irradiance sites: Broken Hill NSW (GHI 2310), Longreach QLD (2380), Port Augusta SA (2240), Carnarvon WA (2420), Alice Springs NT (2400), Mildura VIC (2050), Dubbo NSW (1980), Toowoomba QLD (1860), Geraldton WA (2200), Roxby Downs SA (2280); resource classes EXCELLENT/VERY_GOOD/GOOD; peak sun hours 5.1-6.6; dust soiling 2.1-3.5%
  - 12 solar farms: Bungala SA (220MW SAT, CF 21.0%), Darlington Point NSW (275MW fixed, CF 19.8%), Limondale NSW (249MW SAT, CF 20.7%), Finley NSW (133MW fixed, CF 19.3%), Rugby Run NSW (110MW SAT, CF 20.8%), Ouyen VIC (180MW fixed), Sunlands SA (100MW SAT, CF 21.9%), DeGrussa WA (10.6MW fixed, CF 23.6%), Molong NSW (93MW bifacial), Merredin WA (120MW dual-axis, CF 24.6%), Hornsdale Solar Reserve SA (315MW SAT), Kalgoorlie WA (85MW fixed); specific yield 1680-2157 kWh/kWp
  - 120 monthly irradiance records (10 sites × 12 months): sinusoidal seasonal GHI pattern, southern hemisphere summer peak Jan/Dec; GHI 3.4-9.8 kWh/m²/day; DNI/DHI computed from GHI ratios
  - 25 degradation records (5 panel types × 5 year milestones 0/5/10/15/20yr): MONO_PERC (0.50%+0.55%/yr), POLY (0.70%+0.65%/yr — fastest degrader), BIFACIAL_MONO (0.45%+0.50%/yr), HJT (0.25%+0.40%/yr — lowest), TOPCon (0.30%+0.42%/yr); includes efficiency, PR, cumulative degradation, failure rate
- Endpoints: GET /api/solar-resource/dashboard, /sites, /farm-yields, /monthly-irradiance, /degradation (all with Depends(verify_api_key), tags=["Solar Resource"])
- TypeScript interfaces: IrradianceSiteRecord, SolarFarmYieldRecord, MonthlyIrradianceRecord, SolarDegradationRecord, SolarResourceDashboard appended to app/frontend/src/api/client.ts
- api methods: getSolarResourceDashboard, getSolarResourceSites, getSolarResourceFarmYields, getSolarResourceMonthlyIrradiance, getSolarResourceDegradation added to api object in client.ts
- New page: app/frontend/src/pages/SolarResourceAnalytics.tsx — 468 lines; dark theme; 4 KPI cards (Best Solar Resource Site, Avg CF%, Total MW, Avg Specific Yield); Monthly GHI multi-line chart (5 high-resource sites, 12 months, seasonal curves); Solar Farm Yields table with TechnologyBadge (FIXED_TILT gray/SAT amber/DUAL_AXIS green/BIFACIAL blue); Irradiance Sites table with ResourceClassBadge (EXCELLENT gold/VERY_GOOD green/GOOD blue/MODERATE gray); Panel Degradation line chart (5 panel types, years 0-20, showing HJT/TOPCon vs POLY degradation delta)
- App.tsx: SolarResourceAnalytics imported; SunMedium added to lucide-react imports (new icon); /solar-resource route added; "Solar Resource" nav item (SunMedium icon) added after Storage Revenue Stack, before Settings
- 5 TestSolarResourceEndpoints tests appended to tests/test_backend.py

## Sprint 49b — Electricity Futures Market Risk Analytics — 2026-02-20T00:00:00+11:00 (AEDT)

**Files modified:**
- `app/backend/main.py` — appended Sprint 49b models, mock data, and endpoints
- `app/frontend/src/api/client.ts` — appended TS interfaces + api methods
- `app/frontend/src/App.tsx` — added import, nav item, route
- `tests/test_backend.py` — appended TestFuturesMarketRiskEndpoints

**New file:**
- `app/frontend/src/pages/FuturesMarketRisk.tsx` — full page component

**Backend models (appended to main.py):**
- `VaRRecord` — 1-day 95%/99% VaR, CVaR, Greeks (delta, gamma, vega, theta) per region/portfolio type
- `FMR_HedgeEffectivenessRecord` — named with FMR_ prefix to avoid collision with Sprint 18a's `HedgeEffectivenessRecord`; hedge ratio %, instrument, gain/loss, effectiveness %, basis risk
- `BasisRiskRecord` — futures settlement vs spot, basis $/MWh, volatility, min/max basis, exposure $M
- `FuturesPositionRecord` — long/short/net MW, avg entry price, MTM $M, margin $M
- `FuturesMarketRiskDashboard` — aggregated KPIs + all sub-lists

**Mock data volumes:**
- 10 VaR records: 5 regions x 2 portfolio types (NSW1/QLD1/VIC1 → RETAILER+GENERATOR, SA1 → GENERATOR+TRADER, TAS1 → GENERATOR+RETAILER); VaR 95% range $0.9M–$11.2M; delta -1200 to +1850 MWh; full Greeks
- 15 hedge effectiveness records: AGL (3×NSW1), Origin (3×QLD1), EnergyAustralia (3×VIC1), Snowy Hydro (2×NSW1+1×QLD1), ERM Power (3×SA1); Q1–Q3 2024; hedge ratios 62–92%; effectiveness 71–94%; instruments FUTURES/SWAP/CAP/FLOOR/COLLAR/PPA
- 20 basis risk records: 5 regions × 4 quarters 2024; basis range -$17.5 to +$27.0/MWh; volatility 5.8–30.1; risk exposure $0.5M–$8.8M
- 12 futures position records: AGL (×2), Origin (×2), EnergyAustralia, Snowy Hydro, ERM Power, Macquarie Energy (×2), CS Energy, Trafigura, Alinta Energy; mix GENERATOR/RETAILER/GENTAILER/FINANCIAL; mark-to-market -$4.1M to +$7.4M

**Endpoints (all with Depends(verify_api_key), tag="Futures Market Risk"):**
- GET /api/futures-market-risk/dashboard → FuturesMarketRiskDashboard
- GET /api/futures-market-risk/var → list[VaRRecord]
- GET /api/futures-market-risk/hedge-effectiveness → list[FMR_HedgeEffectivenessRecord]
- GET /api/futures-market-risk/basis-risk → list[BasisRiskRecord]
- GET /api/futures-market-risk/positions → list[FuturesPositionRecord]

**Frontend page (FuturesMarketRisk.tsx):**
- Header: Activity icon (TrendingDown already used by Curtailment/LRMC/Min Demand; Activity re-used as nav icon), title + subtitle
- 4 KPI cards: Portfolio VaR 95% ($M, red), Avg Hedge Ratio % (blue), Total Open Interest (MW, green), Avg Basis Risk ($/MWh, amber)
- VaR chart: grouped bars (VaR 95% blue, VaR 99% red) per region + CVaR 95% line on right axis (orange); aggregated by region
- Hedge Effectiveness scatter: X=hedge ratio %, Y=effectiveness %; bubble size proportional to |gain/loss|; one scatter series per instrument; custom tooltip showing participant + quarter
- Basis Risk heatmap: table — rows=regions, cols=Q1–Q4 2024; cells color-coded red (negative) → gray (near-zero) → green (positive) with legend
- Futures Positions table: 10 columns including type badge, net MW (green/red sign), MTM (green/red), margin
- Hedge Effectiveness detail table: 10 columns including instrument badge, effectiveness % color-coded by threshold (>=85% green, >=75% amber, <75% red), basis risk color-coded by severity

**Instrument badges:** FUTURES blue, SWAP cyan, CAP amber, FLOOR teal, COLLAR purple, PPA green
**Participant type badges:** GENERATOR red, RETAILER blue, GENTAILER purple, FINANCIAL gray

**TypeScript interfaces appended to client.ts:** VaRRecord, FMRHedgeEffectivenessRecord, BasisRiskRecord, FuturesPositionRecord, FuturesMarketRiskDashboard
**api methods added to api object:** getFuturesMarketRiskDashboard, getFuturesMarketRiskVar, getFuturesMarketRiskHedgeEffectiveness, getFuturesMarketRiskBasisRisk, getFuturesMarketRiskPositions
**App.tsx:** FuturesMarketRisk imported; Activity already imported (used by Monitoring, Scenario, PASA, Demand Response, etc.); /futures-market-risk route added; "Futures Market Risk" nav item (Activity icon) added after Solar Resource, before Settings
**Tests:** 5 TestFuturesMarketRiskEndpoints tests appended to tests/test_backend.py

---

## Sprint 50b — Corporate PPA Market Analytics — 2026-02-20T00:00:00

**Files modified:**
- `app/backend/main.py` — appended Sprint 50b models + mock data + 5 endpoints (lines ~35521–35842)
- `app/frontend/src/pages/CorporatePpaMarket.tsx` — new page (NEW FILE)
- `app/frontend/src/api/client.ts` — appended 5 TypeScript interfaces; added 5 api methods to api object
- `app/frontend/src/App.tsx` — imported CorporatePpaMarket; added /corporate-ppa-market route; added "Corporate PPA Market" nav entry (FileText icon already present)
- `tests/test_backend.py` — appended TestCorporatePpaMarketEndpoints class (5 tests)

**Backend models (app/backend/main.py):**
- `CorporatePpaDeal` — 19 fields: deal_id, project_name, technology (WIND/SOLAR/HYBRID/STORAGE), state, offtaker_name, offtaker_sector (TECH/RETAIL/MINING/MANUFACTURING/FINANCE/GOVERNMENT), deal_type (PHYSICAL/FINANCIAL_FIRMING/SLEEVED/VIRTUAL), contract_length_years, capacity_mw, annual_energy_gwh, strike_price_mwh, market_price_at_signing, signing_date, first_delivery_date (nullable), additionality, bundled_lgcs, green_power_accredited
- `PpaOfftakerRecord` — 10 fields: offtaker_name, sector, total_contracted_mw, total_contracted_gwh, num_deals, avg_strike_price, earliest_deal_year, net_zero_target (nullable), re100_member, sustainability_rating (AAA/AA/A/BBB/BB)
- `PpaPriceTrendRecord` — 10 fields: year, quarter, technology, region, avg_strike_price_mwh, min_strike_price_mwh, max_strike_price_mwh, num_deals, total_capacity_mw, spot_price_comparison
- `PpaMarketSummaryRecord` — 9 fields: year, total_deals, total_capacity_mw, total_value_m_aud, avg_contract_years, physical_pct, financial_pct, additionality_pct, top_sector
- `CorporatePpaMarketDashboard` — aggregates all 4 lists + 4 KPI scalars

**Mock data volumes:**
- 15 PPA deals: Amazon Web Services (×2 VIC WIND), Google Australia (QLD SOLAR), Microsoft Australia (TAS WIND), BHP (×2 QLD/SA SOLAR+HYBRID), Rio Tinto (×2 NSW/QLD SOLAR+HYBRID), Fortescue (SA WIND), Coles (NSW SOLAR), Woolworths (QLD SOLAR), CBA (VIC WIND), ANZ (VIC HYBRID), Sydney Water (NSW SOLAR), NSW Gov (SA SOLAR), Clarke Creek (QLD HYBRID); strikes $42–$65/MWh; 2018–2024 signings; 10–20 year terms
- 10 offtaker records: AWS, Google, Microsoft, BHP, Rio Tinto, Fortescue, Coles, Woolworths, CBA, ANZ; aggregated totals; RE100 flags; net zero targets 2030–2050; ratings AAA–BBB
- 30 price trend records: WIND×3 regions (NSW/VIC/QLD) × 5 years (2020–2024) + SOLAR×3 regions × 5 years; price decline $74→$55 WIND, $65→$42 SOLAR
- 6 market summary records: 2019–2024; deals 5→50/yr; capacity 950→9100 MW/yr; additionality 90%→68%

**Endpoints (all with Depends(verify_api_key), tag="Corporate PPA Market"):**
- GET /api/corporate-ppa-market/dashboard → CorporatePpaMarketDashboard
- GET /api/corporate-ppa-market/deals → list[CorporatePpaDeal]
- GET /api/corporate-ppa-market/offtakers → list[PpaOfftakerRecord]
- GET /api/corporate-ppa-market/price-trends → list[PpaPriceTrendRecord]
- GET /api/corporate-ppa-market/market-summary → list[PpaMarketSummaryRecord]

**Frontend page (CorporatePpaMarket.tsx):**
- Header: FileText icon (already in lucide-react imports), title "Corporate Power Purchase Agreement (PPA) Market", subtitle about corporate renewable PPAs, offtaker analysis, contract structures, pricing benchmarks, additionality tracking
- 4 KPI cards: Total Contracted Capacity (MW), Avg PPA Price ($/MWh), Additionality %, YoY Growth %
- PPA Price Trend chart: LineChart — WIND avg (cyan), SOLAR avg (amber), Spot avg (gray dashed); data aggregated by year+technology across all 3 regions; Y-axis $30–$90/MWh
- Market Summary chart: ComposedChart (dual-axis) — Contracted Capacity MW bars (blue, left axis GW), Total Deals line (amber, right axis), Additionality % line (green dashed, right axis)
- PPA Deals table: 13 columns — project name, tech badge, state, offtaker, sector badge, deal type badge, MW, strike $/MWh (green), market $/MWh (gray), signed year, term (yr), additionality icon, LGC icon
- Top Offtakers table: 9 columns — offtaker, sector badge, contracted MW, contracted GWh, deals, avg strike, RE100 badge, net zero target, sustainability rating badge

**Badge color scheme:**
- Sector: TECH blue, RETAIL purple, MINING amber, MANUFACTURING orange, FINANCE green, GOVERNMENT teal
- Deal type: PHYSICAL green, FINANCIAL_FIRMING blue, SLEEVED gray, VIRTUAL purple
- Tech: WIND cyan, SOLAR yellow, HYBRID indigo, STORAGE pink
- Sustainability: AAA/AA dark/light emerald, A green, BBB amber, BB red

**TypeScript interfaces appended to client.ts:** CorporatePpaDeal, PpaOfftakerRecord, PpaPriceTrendRecord, PpaMarketSummaryRecord, CorporatePpaMarketDashboard
**api methods added to api object:** getCorporatePpaMarketDashboard, getCorporatePpaMarketDeals, getCorporatePpaMarketOfftakers, getCorporatePpaMarketPriceTrends, getCorporatePpaMarketSummary
**App.tsx:** CorporatePpaMarket imported; FileText already in lucide-react imports (used by Settlement, Regulatory, Reform); /corporate-ppa-market route added; "Corporate PPA Market" nav item (FileText icon) added before Settings
**Tests:** 5 TestCorporatePpaMarketEndpoints tests appended to tests/test_backend.py

## Sprint 50c — Microgrids & Remote Area Power Systems (RAPS) Analytics — 2026-02-20

**Completed:**
- `app/backend/main.py` — Appended 5 Pydantic models (MicrogridRecord, DieselDisplacementRecord, MicrogridEnergyRecord, OffGridTechnologyRecord, MicrogridDashboard), mock data (12 microgrids, 20 diesel displacement records, 48 energy records, 6 technology records), and 5 endpoints under `/api/microgrid-raps/*` (dashboard, microgrids, diesel-displacement, energy-records, technology-summary); all protected by `verify_api_key`
- `app/frontend/src/pages/MicrogridRaps.tsx` — New 464-line page: Wifi icon header, 4 KPI cards (Total Microgrids, Avg RF%, Total Diesel Displaced ML/yr, Total CO2 Avoided t/yr), horizontal RF bar chart (sorted desc, color-coded green/lime/amber/red), monthly energy mix stacked area chart with microgrid toggle, diesel displacement quarterly bar+line chart with state toggle, full Microgrid Registry table with community/grid type badges, technology summary grid cards
- `app/frontend/src/api/client.ts` — Appended 5 TypeScript interfaces (MicrogridRecord, DieselDisplacementRecord, MicrogridEnergyRecord, OffGridTechnologyRecord, MicrogridDashboard) and 5 API methods to `api` object (getMicrogridRapsDashboard, getMicrogridRapsMicrogrids, getMicrogridRapsDieselDisplacement, getMicrogridRapsEnergyRecords, getMicrogridRapsTechnologySummary)
- `app/frontend/src/App.tsx` — Imported MicrogridRaps; Wifi icon already in lucide-react imports; added `/microgrid-raps` route and "Microgrids & RAPS" nav item (Wifi icon) before Settings
- `tests/test_backend.py` — Appended `TestMicrogridRapsEndpoints` class with 5 tests (test_dashboard, test_microgrids, test_diesel_displacement, test_energy_records, test_technology_summary); all 5 pass

**Bug fixes (pre-existing issues resolved to enable tests):**
- `app/backend/main.py` — Replaced 6 instances of `@router.get(` with `@app.get(` (battery-economics and settlement endpoints used undefined `router` variable, blocking all test imports)
- `tests/conftest.py` — Added `client` pytest fixture (session-scoped FastAPI TestClient) so the many newer test classes using `def test_*(self, client)` pattern can resolve the fixture

**Mock data highlights:**
- 12 real-ish Australian remote microgrids: Doomadgee QLD, Coober Pedy SA, Mawson Station Antarctica, Lord Howe Island NSW, Esperance WA, Carnarvon WA, King Island TAS, Rottnest Island WA, Marble Bar WA, Windorah QLD, Nguiu NT, Wiluna WA
- Mix of community types (ABORIGINAL, PASTORAL, MINING, ISLAND, TOURISM, DEFENCE) and grid types (ISOLATED_DIESEL, HYBRID_SOLAR_DIESEL, FULL_RENEWABLE, PARTIAL_GRID)
- Renewable fractions range 30% (Mawson Station) to 100% (King Island, Rottnest Island)
- 20 diesel displacement records across QLD, WA, NT, SA, TAS showing quarterly improvement in renewable fraction through 2024
- 48 monthly energy records for 4 selected microgrids with seasonal solar patterns (high Dec/Jan/Feb, lower Jun/Jul)
- 6 technology summary records covering SOLAR_PV, WIND, BATTERY, DIESEL, FLYWHEEL, FUEL_CELL

## Sprint 51c — Thermal Power Plant Heat Rate & Efficiency Analytics — 2026-02-20

**Completed:**
- `app/backend/main.py` — Appended 5 Pydantic models (ThermalUnitRecord, HeatRateTrendRecord, FuelCostRecord, ThermalBenchmarkRecord, ThermalEfficiencyDashboard), comprehensive mock data (15 thermal unit records, 30 heat rate trend records, 20 fuel cost records, 15 benchmark records), and 5 endpoints under `/api/thermal-efficiency/*` (dashboard, units, heat-rate-trends, fuel-costs, benchmarks); all protected by `verify_api_key`
- `app/frontend/src/pages/ThermalEfficiency.tsx` — New page: Thermometer icon header, 4 KPI cards (Fleet Avg Heat Rate GJ/MWh, Fleet Avg Efficiency %, Worst Performing Unit, Total Fuel Cost $B AUD/yr), heat rate scatter chart (design vs actual, diagonal benchmark line, color by technology), heat rate trend multi-line chart (6 units × 2020-2024, overhaul markers via ReferenceLine), thermal units table with technology filter and degradation color coding (red >10%, amber >5%), fuel cost SRMC table sortable by SRMC/all-in/fuel cost/year
- `app/frontend/src/api/client.ts` — Appended 5 TypeScript interfaces (ThermalUnitRecord, HeatRateTrendRecord, FuelCostRecord, ThermalBenchmarkRecord, ThermalEfficiencyDashboard) and 5 API methods (getThermalEfficiencyDashboard, getThermalEfficiencyUnits, getThermalEfficiencyHeatRateTrends, getThermalEfficiencyFuelCosts, getThermalEfficiencyBenchmarks) added to `api` object
- `app/frontend/src/App.tsx` — Imported ThermalEfficiency; Thermometer already in lucide-react imports (used by /weather-demand); added `/thermal-efficiency` route and "Thermal Efficiency" nav item (Thermometer icon) before Settings
- `tests/test_backend.py` — Appended `TestThermalEfficiencyEndpoints` class with 5 tests (test_dashboard, test_units, test_heat_rate_trends, test_fuel_costs, test_benchmarks)

**Mock data highlights:**
- 15 real-ish Australian thermal units: Eraring 1-4 NSW (720 MW each, black coal), Vales Point 5-6 NSW (660 MW), Bayswater 3 NSW (665 MW), Loy Yang A1-2 VIC (brown coal), Yallourn W3 VIC (360 MW), Torrens Island B3 SA (gas steam), Pelican Point 1 SA (CCGT 478 MW), Mortlake 1 VIC (OCGT 282 MW), Darling Downs 1 QLD (CCGT 630 MW), Callide C3 QLD (black coal 450 MW)
- Heat rates: black coal 9.6-12.1 GJ/MWh, brown coal 13.9-14.8 GJ/MWh, CCGT 6.9-7.2 GJ/MWh, OCGT 10.2 GJ/MWh, gas steam 11.9 GJ/MWh
- 30 heat rate trend records: 6 units × 5 years (2020-2024) showing gradual degradation with step improvements after major overhauls (2023 for most units); Callide C3 shows anomalous 2022 degradation reflecting real-world unplanned outage
- 20 fuel cost records: 5 units × 4 years; coal $3-6.2/GJ, gas $8.5-20/GJ; SRMC ranges from $12.8/MWh (Loy Yang brown coal) to $141/MWh (Darling Downs 2022 gas crisis)
- 15 benchmark records: 5 technologies × 3 benchmark types (BEST_PRACTICE, AVERAGE, FLEET_BOTTOM); best practice CCGT 6.5 GJ/MWh, best practice black coal 9.0 GJ/MWh

**Technology color scheme:** BLACK_COAL dark gray #4b5563, BROWN_COAL brown #92400e, GAS_CCGT blue #3b82f6, GAS_OCGT gray #6b7280, GAS_STEAM cyan #06b6d4

## Sprint 51a — Electricity Market Liquidity & Trading Volume Analytics — 2026-02-20

**Completed:**
- `app/backend/main.py` — Appended 5 Pydantic models (TradingVolumeRecord, BidAskSpreadRecord, MarketDepthRecord, LiquidityMetricRecord, MarketLiquidityDashboard), comprehensive mock data (20 trading volume records across 4 regions × 5 dates with ASX/OTC/BILATERAL/EXCHANGE venues; 15 bid-ask spread records across 3 regions × 5 products with spreads $0.5-$8/MWh and market depth 50-500 MW; 20 market depth records across 4 regions × 5 price levels showing bid/ask order book; 20 liquidity metric records across 4 regions × 5 quarters with turnover ratio 0.5-3.0 and exchange share 30-60%), and 5 endpoints under `/api/market-liquidity/*` (dashboard, trading-volumes, bid-ask-spreads, market-depth, metrics); all protected by `verify_api_key`
- `app/frontend/src/pages/MarketLiquidity.tsx` — New page (536 lines): BarChart icon header with title "Electricity Market Liquidity & Trading Volume" and NEM/ASX subtitle; 4 KPI cards (Total Daily Volume GWh, Avg Bid-Ask Spread $/MWh, Exchange Share %, Turnover Ratio); stacked bar + VWAP line ComposedChart for trading volumes by venue; AreaChart for market share evolution by quarter (Exchange/OTC/Bilateral % stack); horizontal RechartsBarChart order book depth visualization (bid blue left / ask red right) with region selector; BidAskSpreadRecord table with product and venue color badges; quarterly LiquidityMetricRecord table with turnover ratio and HHI
- `app/frontend/src/api/client.ts` — Appended 5 TypeScript interfaces (TradingVolumeRecord, BidAskSpreadRecord, MarketDepthRecord, LiquidityMetricRecord, MarketLiquidityDashboard) and 5 API methods (getMarketLiquidityDashboard, getMarketLiquidityTradingVolumes, getMarketLiquidityBidAskSpreads, getMarketLiquidityMarketDepth, getMarketLiquidityMetrics) added to `api` object
- `app/frontend/src/App.tsx` — Imported MarketLiquidity; added `BarChart` (without suffix) to lucide-react imports (BarChart2/BarChart3 already used); added `/market-liquidity` route and "Market Liquidity" nav item (BarChart icon) before Settings
- `tests/test_backend.py` — Appended `TestMarketLiquidityEndpoints` class with 5 tests (test_dashboard, test_trading_volumes, test_bid_ask_spreads, test_market_depth, test_metrics)

**Mock data highlights:**
- 20 trading volume records: 4 NEM regions (NSW1, QLD1, VIC1, SA1) × 5 dates (Jan 15-19 2025); venue rotates ASX/OTC_BROKER/BILATERAL/EXCHANGE by region; product rotates BASE_LOAD/PEAK/CAP/FLOOR/SWAP by date; VWAP ranges $50-$120/MWh; volumes 200-520 MW per record
- 15 bid-ask spreads: 3 regions × 5 products; spreads range from $0.5 (NSW BASE_LOAD) to $8+/MWh (SA SWAP); market depth 50-500 MW; 3-9 market makers per product
- 20 market depth records: 4 regions × 5 price levels ($60-$100); cumulative bid/ask volumes build up the order book ladder for the horizontal chart
- 20 liquidity metrics: 4 regions × 5 quarters (2024-Q1 to 2025-Q1); exchange share 30-60%, OTC 20-40%, bilateral 10-30%; turnover ratio 0.5-3.0x; HHI 0.15-0.34 (moderate concentration)

**Product badge colors:** BASE_LOAD blue, PEAK amber, CAP red, FLOOR green, SWAP gray
**Venue badge colors:** ASX blue, OTC_BROKER green, BILATERAL gray, EXCHANGE teal

## Sprint 51b — Industrial Demand Flexibility & Load Management Analytics — 2026-02-20

**Completed:**
- `app/backend/main.py` — Appended 5 Pydantic models (LargeConsumerRecord, FlexibilityEventRecord, IndustrialLoadShapeRecord, DemandFlexAggregateRecord, IndustrialDemandFlexDashboard), comprehensive mock data, and 5 endpoints under `/api/industrial-demand-flex/*` (dashboard, consumers, events, load-shapes, aggregate); all protected by `verify_api_key`
- `app/frontend/src/pages/IndustrialDemandFlex.tsx` — New page (635 lines): Factory icon header with title "Industrial Demand Flexibility & Load Management" and large industrial consumers subtitle; 4 KPI cards (Total Flex Capacity MW, Activated Events 2024, Total DR Revenue $M, Avg Response Accuracy %); horizontal bar chart for flexibility capacity by consumer with per-industry-type colors (Cell-based coloring); events table with RERT_ACTIVATION/PRICE_SIGNAL/NETWORK_SUPPORT/VOLUNTARY badges, accuracy color-coding, and settlement/grid-benefit columns; large consumers table with industry type and contract type badges, sustainability score 0-10 bar; seasonal load shape chart (multi-line SUMMER/WINTER/SHOULDER baseline + flex band) with consumer toggle buttons
- `app/frontend/src/api/client.ts` — Appended 5 TypeScript interfaces (LargeConsumerRecord, FlexibilityEventRecord, IndustrialLoadShapeRecord, DemandFlexAggregateRecord, IndustrialDemandFlexDashboard) and 5 API methods (getIndustrialDemandFlexDashboard, getIndustrialDemandFlexConsumers, getIndustrialDemandFlexEvents, getIndustrialDemandFlexLoadShapes, getIndustrialDemandFlexAggregate) added to `api` object
- `app/frontend/src/App.tsx` — Imported IndustrialDemandFlex; added Factory to lucide-react imports; added `/industrial-demand-flex` route and "Industrial Demand Flex" nav item (Factory icon) before Settings
- `tests/test_backend.py` — Appended `TestIndustrialDemandFlexEndpoints` class with 5 tests (test_dashboard, test_consumers, test_events, test_load_shapes, test_aggregate)

**Mock data highlights:**
- 12 large consumer records: Tomago Aluminium NSW (380 MW flex, RERT), BlueScope Steel Port Kembla NSW (210 MW, WHOLESALE_DR), BHP Olympic Dam SA (60 MW, NETWORK_DR), Santos Moomba SA (45 MW, SPOT_RESPONSE), Snowy Hydro Guthega NSW (160 MW pumping, RERT), Loy Yang Power Aux VIC (35 MW, NETWORK_DR), Sydney Desalination Plant NSW (80 MW, WHOLESALE_DR), Kwinana Industrial WA (90 MW, NETWORK_DR), Alcoa Portland VIC (400 MW, RERT), Rio Tinto Yarwun QLD (130 MW, WHOLESALE_DR), BHP Nickel West WA (55 MW, SPOT_RESPONSE), AWS Sydney DC NSW (25 MW, WHOLESALE_DR); sustainability scores 3.2-9.4
- 15 flexibility event records (2024 Jan-Dec): 4 RERT activations (prices $14,800-$15,200/MWh, settlements $680K-$1.35M), 5 price signals ($3,200-$8,200/MWh), 4 network support events (zero trigger price, paid separately), 2 voluntary reductions; response accuracy 80-99.3%
- 18 load shape records: 3 consumers (Tomago Al., Alcoa Portland, BlueScope Steel) × 3 seasons × 2 representative hours (00:00 and 12:00); baseline MW, min curtailable MW, flexibility band MW, spot response threshold ($/MWh) per record
- 20 aggregate records: 5 regions (NSW1, VIC1, SA1, QLD1, WEM) × 4 quarters (Q1-Q4 2024); enrolled consumers 1-4, flex capacity 105-1155 MW, activated events 0-5, revenue $0-4.2M per region/quarter

**Industry type badge colors:** EAF_STEEL red, ALUMINIUM silver/gray, DATA_CENTRE blue, DESALINATION cyan, CHEMICALS orange, MINING amber, CEMENT gray
**Contract type badge colors:** RERT red, WHOLESALE_DR blue, NETWORK_DR green, SPOT_RESPONSE amber
**Event type badge colors:** RERT_ACTIVATION red, PRICE_SIGNAL amber, NETWORK_SUPPORT blue, VOLUNTARY gray

## Sprint 52a — Energy Storage LCA & Sustainability Analytics — 2026-02-20

**Completed:**
- `app/backend/main.py` — Appended 5 Pydantic models (StorageLcaRecord, CriticalMineralRecord, RecyclingRecord, LcaScenarioRecord, StorageLcaDashboard), comprehensive mock data, and 5 endpoints under `/api/storage-lca/*` (dashboard, lca-records, critical-minerals, recycling, scenarios); all protected by `verify_api_key`
- `app/frontend/src/pages/StorageLca.tsx` — New page (512 lines): RefreshCw icon header with title "Energy Storage Life Cycle Assessment & Sustainability" and embodied carbon / circular economy subtitle; 4 KPI cards (Best Lifecycle Technology, Avg Recyclability %, Critical Minerals at Risk, Technologies Assessed); stacked bar chart for lifecycle carbon by phase (embodied/operational/EOL) sorted by total; multi-line scenario chart showing lifecycle carbon reduction trajectory CURRENT vs 2030_GRID_CLEAN per technology; full LCA detail table sorted by total lifecycle carbon with energy payback / water / land use columns; Critical Mineral Supply Chain table with supply risk, price trend, and circular economy potential badges; End-of-Life Recycling table with process, maturity, and key players
- `app/frontend/src/api/client.ts` — Added 5 TypeScript interfaces (StorageLcaRecord, CriticalMineralRecord, RecyclingRecord, LcaScenarioRecord, StorageLcaDashboard) appended after existing interfaces; added 5 API methods (getStorageLcaDashboard, getStorageLcaRecords, getStorageLcaCriticalMinerals, getStorageLcaRecycling, getStorageLcaScenarios) inside the `api` object
- `app/frontend/src/App.tsx` — Imported StorageLca; added `RefreshCw` to lucide-react imports; added `/storage-lca` route and "Storage LCA" nav item (RefreshCw icon) before Settings
- `tests/test_backend.py` — Appended `TestStorageLcaEndpoints` class with 5 tests (test_dashboard, test_lca_records, test_critical_minerals, test_recycling, test_scenarios)

**Mock data highlights:**
- 8 LCA records: Li-Ion NMC (183 kgCO2/kWh total, 68% recyclability), LFP (136, 75%), NMC 811 (159.5, 72%), Na-Ion (103, 80%), Flow Battery Vanadium (192, 90%), Compressed Air (103, 65%), Pumped Hydro (67 — best, 85%), Gravity Storage (69.5, 95%)
- 12 critical mineral records: Lithium (x2 techs, AU 57% reserves, MEDIUM risk, FALLING price), Cobalt (x2, AU 1.2%, CRITICAL/HIGH, RISING), Nickel (x2, AU 22%, MEDIUM/HIGH), Manganese (x2, AU 8%, LOW), Graphite (x2, AU 1.5%, HIGH, RISING), Vanadium (x2, AU 3.5%, HIGH/LOW)
- 8 recycling records: NMC Hydromet (95% recovery, COMMERCIAL), NMC Pyrmet (70%, MATURE), NMC Direct (90%, PILOT), LFP Hydromet (88%, COMMERCIAL), LFP Direct (92%, EMERGING), NMC 811 Hydromet (93%, PILOT), Flow Vanadium Remanufacturing (95%, COMMERCIAL), Na-Ion Hydromet (80%, EMERGING)
- 24 LCA scenario records: 8 technologies x 3 scenarios (CURRENT 2024, 2030_GRID_CLEAN, 2035_GREEN_MANUFACTURING); showing progressive carbon reduction; vs_gas_peaker_ratio and vs_diesel_ratio computed vs 620 and 820 kgCO2/kWh baselines

**Technology palette:** Li-Ion NMC blue (#3b82f6), LFP green (#22c55e), NMC 811 teal (#0d9488), Na-Ion purple (#8b5cf6), Flow Battery Vanadium amber (#f59e0b), Compressed Air gray (#6b7280), Pumped Hydro cyan (#06b6d4), Gravity dark (#1e293b)
**Supply risk badge colors:** LOW green, MEDIUM amber, HIGH orange, CRITICAL red
**Process badge colors:** all gray-700 (process name shown as human-readable label)
**Maturity badge colors:** EMERGING blue, PILOT amber, COMMERCIAL green, MATURE gray

## Sprint 53c — Firming Technology Economics — 2026-02-20

**Completed:**
- `app/backend/main.py` — Appended 5 Pydantic models (FirmingTechnologyRecord, FirmingDispatchRecord, FirmingCostCurveRecord, FirmingScenarioRecord, FirmingTechDashboard), realistic NEM mock data (8 technology records, 16 dispatch records across 2 scenarios, 15 cost curve records across 3 VRE scenarios, 3 scenario records), and 1 endpoint `GET /api/firming-technology/dashboard` protected by `verify_api_key`
- `app/frontend/src/pages/FirmingTechnologyEconomics.tsx` — New page: Flame icon header with title "Firming Technology Economics" and NEM firming description; 4 KPI cards (cheapest LCOS, fastest response, lowest CO2, total firming capacity GW); technology comparison table with CAPEX/OPEX/LCOS/response/CO2/maturity badge columns; LCOS vs Duration scatter chart with bubble size = capacity factor and category-coloured bubbles; stacked revenue bar chart (dispatch + capacity payments) with per-scenario filter toggle; firming cost curve line chart for 3 VRE scenarios vs firming requirement %; scenario comparison cards (HIGH/MEDIUM/LOW VRE)
- `app/frontend/src/api/client.ts` — Appended 5 TypeScript interfaces (FirmingTechnologyRecord, FirmingDispatchRecord, FirmingCostCurveRecord, FirmingScenarioRecord, FirmingTechDashboard); added `getFirmingTechDashboard()` method to `api` object
- `app/frontend/src/App.tsx` — Imported FirmingTechnologyEconomics; added `/firming-technology-economics` route and "Firming Tech Economics" nav item (Flame icon)
- `tests/test_backend.py` — Appended `TestFirmingTechnologyEconomics` class with `test_firming_technology_dashboard()` validating status 200, 8 technologies, 16 dispatch records, 15 cost curves, 3 scenarios, and field shapes

**Mock data highlights:**
- 8 technologies: OCGT ($185/MWh LCOS, 580 kg/MWh CO2, COMMERCIAL), CCGT ($145, 390, COMMERCIAL), H2 Turbine ($320, 5, DEMONSTRATION), Battery 4HR ($135, 28, COMMERCIAL), Battery 8HR ($175, 28, COMMERCIAL), Pumped Hydro ($115, 12 — cheapest, COMMERCIAL), Biomass ($235, 25, COMMERCIAL), Demand Response ($65 — lowest LCOS, 0 CO2, COMMERCIAL)
- 3 VRE scenarios: HIGH (90% VRE, 18.5 GW firming, $95/MWh LCOE), MEDIUM (70%, 13.2 GW, $82/MWh), LOW (50%, 8.8 GW, $72/MWh)
- Cost curves: firming cost rises from $28–45/MWh at 10% requirement to $84–132/MWh at 30%, steeper for higher VRE scenarios

## Sprint 53b — Electricity Demand Forecasting Models (2026-02-20)

Added comparative analytics page for ML-based electricity demand forecasting across NEM regions.

**Backend (`app/backend/main.py`):**
- Pydantic models: `DFMModelRecord`, `DFMForecastRecord`, `DFMSeasonalPatternRecord`, `DFMFeatureImportanceRecord`, `DemandForecastModelsDashboard`
- Endpoint: `GET /api/demand-forecast-models/dashboard` — returns 21 model records (6 model types × 5 NEM regions), 48 hourly forecast records (24 h × 2 models for NSW1), 20 seasonal pattern records, and 33 feature importance records with realistic NEM values
- All names prefixed `DFM` to avoid collisions with existing `DemandForecast*` models

**Frontend (`app/frontend/src/pages/DemandForecastingModels.tsx`):**
- 4 KPI cards: best MAPE %, best RMSE, best R², total model count
- Sortable model performance comparison table with per-region filter and green highlight for best MAPE
- 24-hour ComposedChart (NSW1) with actual vs LSTM vs Ensemble lines and 90% CI bands
- Horizontal grouped BarChart for feature importance (LSTM / XGBoost / Ensemble, NSW1)
- Seasonal patterns table with color-coded peak demand and temperature sensitivity

**API client (`app/frontend/src/api/client.ts`):** Added TypeScript interfaces and `getDemandForecastModelsDashboard()` method.
**Routing (`app/frontend/src/App.tsx`):** Import, nav entry (`Brain` icon), and route at `/demand-forecasting-models`.
**Tests (`tests/test_backend.py`):** `TestDemandForecastingModels.test_demand_forecast_models_dashboard` validates all response fields, record counts, and data constraints.

## Sprint 53a — Energy Market Stress Testing — 2026-02-20

**Completed:**
- `app/backend/main.py` — Added Pydantic models (`MarketStressScenario`, `StressTestResult`, `SystemVulnerabilityRecord`, `StressTestKpiRecord`, `MarketStressDashboard`) and `GET /api/market-stress/dashboard` endpoint with realistic NEM mock data: 8 stress scenarios (heatwave, gas disruption, Basslink trip, SCADA cyber attack, wind drought, solar eclipse, major generator failure, combined compound extreme), 20 regional stress results across 5 NEM regions, 6 component vulnerability records, 8 KPI records.
- `app/frontend/src/pages/MarketStressTesting.tsx` — New React/TypeScript analytics page with: 4 KPI summary cards (worst-case price spike, max unserved energy, most vulnerable component, highest economic cost); 8-row scenario severity matrix table with colour-coded severity badges; RadarChart showing system vulnerability profile across 6 NEM components; grouped BarChart comparing economic cost and unserved energy across all 8 scenarios; colour-coded vulnerability heatmap table with inline score bars; detailed stress results table with baseline vs stressed comparison. Tailwind dark theme (bg-gray-900/bg-gray-800), Recharts, lucide-react icons.
- `app/frontend/src/api/client.ts` — Appended TypeScript interfaces (`MarketStressScenario`, `StressTestResult`, `SystemVulnerabilityRecord`, `StressTestKpiRecord`, `MarketStressDashboard`) and `getMarketStressDashboard()` exported function.
- `app/frontend/src/App.tsx` — Added `MarketStressTesting` import, `/market-stress-testing` route, and nav item with `ShieldAlert` icon.
- `tests/test_backend.py` — Appended `TestMarketStressTesting` class with `test_market_stress_dashboard()` covering top-level structure, scenario enum validation, vulnerability score bounds, and KPI record counts.

## Sprint 54a — NEM Frequency Control Analytics — 2026-02-20

**Completed:**
- `app/backend/main.py` — Added Pydantic models (`NFCFrequencyRecord`, `NFCEventRecord`, `NFCContributorRecord`, `NFCPerformanceRecord`, `FrequencyControlDashboard`) and `GET /api/frequency-control/dashboard` endpoint with realistic NEM mock data: 12 monthly frequency performance records for NSW1 (2024), 8 major frequency events across NEM regions (covering GENERATOR_TRIP, LOAD_REJECTION, INTERCONNECTOR_SEPARATION, DEMAND_FORECAST_ERROR triggers), 10 technology contributor records (BESS, Hydro, OCGT, CCGT, Coal, Solar, Wind, PHES, Demand Response, VPP), and 12 monthly performance records tracking compliance, FCAS shortfalls, PFR adequacy, average nadir, and ROCOF.
- `app/frontend/src/pages/FrequencyControlAnalytics.tsx` — New React/TypeScript analytics page with: 4 KPI summary cards (current avg frequency, time-in-band %, worst nadir Hz, PFR compliance rate %); AreaChart of monthly avg frequency with reference lines at 49.85 and 50.15 Hz band boundaries; event severity table sorted by nadir Hz ascending (worst first) with colour-coded trigger badges, nadir, ROCOF, recovery time, and unserved energy columns; horizontal BarChart of PFR MW response by technology coloured by response speed (green ≤ 500 ms, amber ≤ 1500 ms, red > 1500 ms); dual-axis LineChart showing compliance rate %, PFR adequacy %, and FCAS shortfall event count over 12 months. Tailwind dark theme (bg-gray-900/bg-gray-800), Recharts, lucide-react Activity icon.
- `app/frontend/src/api/client.ts` — Appended TypeScript interfaces (`NFCFrequencyRecord`, `NFCEventRecord`, `NFCContributorRecord`, `NFCPerformanceRecord`, `FrequencyControlDashboard`) and `getFrequencyControlDashboard()` exported function.
- `app/frontend/src/App.tsx` — Added `FrequencyControlAnalytics` import, `/frequency-control-analytics` route, and nav item with `Activity` icon.
- `tests/test_backend.py` — Appended `TestFrequencyControlAnalytics` class with `test_frequency_control_dashboard()` covering top-level structure validation, 12 frequency records with plausibility bounds, 8 events with trigger enum validation, 10 contributor records with contribution-percentage sum check (~100%), and 12 performance records with all numeric field bounds.

## Sprint 54b — NEM Capacity Investment Signals — 2026-02-20

**Completed:**
- `app/backend/main.py` — Added Pydantic models (`CISNewEntrantRecord`, `CISInvestmentActivityRecord`, `CISPriceSignalRecord`, `CISExitRiskRecord`, `CapacityInvestmentDashboard`) and `GET /api/capacity-investment/dashboard` endpoint with comprehensive NEM mock data: 8 new entrant cost records covering Utility Solar, Onshore Wind, BESS 2h, OCGT, CCGT, Pumped Hydro, Offshore Wind, and Green Hydrogen with CAPEX, WACC, LCOE, breakeven price, payback years, NPV at $85/MWh average, and IRR; 20 investment activity records (5 years 2020-2024 × 4 technologies) with committed/cancelled MW and financing secured %; 20 price signal records (5 NEM regions × 4 years 2021-2024) with revenue adequacy signal enum (STRONG/ADEQUATE/WEAK/INSUFFICIENT); 10 exit risk records for real NEM units with age, remaining life, exit probability, trigger type, and capacity.
- `app/frontend/src/pages/CapacityInvestmentSignals.tsx` — New React/TypeScript analytics page with: 4 KPI summary cards (cheapest new entrant LCOE, total 2024 committed capacity, regions with STRONG signal, total exit risk capacity); new entrant cost stacked BarChart with CAPEX + WACC Uplift breakdown and $85/MWh average breakeven ReferenceLine; investment activity stacked BarChart (committed vs cancelled by technology by year); average spot price LineChart by region over 2021-2024 with LRMC reference line; revenue adequacy signal heatmap table colour-coded by strength (green/yellow/orange/red) across 5 regions × 4 years with $/MWh inlay; exit risk register table sorted by exit probability with inline progress bars (red/orange/yellow) and trigger badges. Tailwind dark theme (bg-gray-900/bg-gray-800), Recharts, lucide-react icons.
- `app/frontend/src/api/client.ts` — Appended TypeScript interfaces (`CISNewEntrantRecord`, `CISInvestmentActivityRecord`, `CISPriceSignalRecord`, `CISExitRiskRecord`, `CapacityInvestmentDashboard`) and `getCapacityInvestmentDashboard()` exported function.
- `app/frontend/src/App.tsx` — Added `CapacityInvestmentSignals` import, `/capacity-investment-signals` route, and nav item with `TrendingUp` icon.
- `tests/test_backend.py` — Appended `TestCapacityInvestmentSignals` class with `test_capacity_investment_dashboard()` covering all response keys, record counts (8 new entrant, 20 activity, 20 price signal, 10 exit risk), enum validation, value bounds, and cross-record consistency checks.

## Sprint 54c — REC & PPAs Certificate Tracking — 2026-02-20

Added Australian RET scheme tracking page for LGCs, STCs, GreenPower, and corporate renewable matching.

**Backend (`app/backend/main.py`):**
- Pydantic models: `RCTLgcPriceRecord`, `RCTSurplusDeficitRecord`, `RCTCreationRecord`, `RCTComplianceRecord`, `RCTGreenPowerRecord`, `RecCertificateDashboard`
- Endpoint: `GET /api/rec-tracking/dashboard` — returns 24 monthly LGC price records (2023-2024) with spot and forward curves (2026/2027), 8 LRET surplus/deficit records (2017-2024), 20 LGC creation records (5 technologies × 4 NEM regions: Wind, Large Solar, Hydro, Biomass/Waste, Rooftop Solar), 10 retailer compliance records with status enum (COMPLIANT/SHORTFALL/DEFERRED), 6 state GreenPower records (NSW/VIC/QLD/SA/WA/TAS)
- All model names prefixed `RCT` to avoid collisions with existing REC-related models

**Frontend (`app/frontend/src/pages/RecCertificateTracking.tsx`):**
- 4 KPI cards: current LGC spot price (Dec 2024 $78.40), 2024 LRET surplus (+3,200 GWh / +9.70%), total LGCs created (all techs & regions), GreenPower customers (k, nationwide)
- LGC price trend AreaChart — spot price with gradient fill + 2026/2027 forward curves as dashed lines over 24 months
- LRET surplus/deficit BarChart — annual surplus (positive) / deficit (negative) bars with zero ReferenceLine
- LGC creation by technology stacked BarChart — per NEM region, colour-coded by technology type
- Retailer compliance table — market share %, liable energy GWh, certificates surrendered, compliance status badge (green/red/amber with icon), shortfall charge AUD$M
- GreenPower state table — state badge, customers k, GWh, avg premium $/MWh, YoY growth % with colour coding

**API client (`app/frontend/src/api/client.ts`):** Appended TypeScript interfaces (`RCTLgcPriceRecord`, `RCTSurplusDeficitRecord`, `RCTCreationRecord`, `RCTComplianceRecord`, `RCTGreenPowerRecord`, `RecCertificateDashboard`) and `getRecCertificateDashboard()` exported function.
**Routing (`app/frontend/src/App.tsx`):** Import, nav entry (`Award` icon), and route at `/rec-certificate-tracking`.
**Tests (`tests/test_backend.py`):** `TestRecCertificateTracking.test_rec_certificate_dashboard` validates top-level structure, 24 LGC price records with forward/spot proximity, 8 surplus/deficit records with correct 33,000 GWh target, 20 creation records with tech/region enum checks, 10 compliance records with status enum validation and zero-shortfall-charge constraint for COMPLIANT retailers, 6 GreenPower records covering all states.

## Sprint 55a — NEM Spot Market Depth & Order Flow Analytics — 2026-02-20

Added NEM Spot Market Depth & Order Flow Analytics page covering real-time bid stacks, dispatch interval market depth, and participant order flow patterns.

**Backend (`app/backend/main.py`):**
- Pydantic models: `SMDBidStackRecord`, `SMDOrderFlowRecord`, `SMDMarketDepthSnapshot`, `SMDParticipantFlowRecord`, `SpotMarketDepthDashboard` (all prefixed `SMD` to avoid collisions; `DispatchInterval` already existed)
- Endpoint: `GET /api/spot-depth/dashboard` — returns 20 bid stack records (10 price bands × 2 regions: NSW1, VIC1; technologies: Hydro, Wind, Large Solar, Black/Brown Coal, Gas CCGT/OCGT, Demand Response, Diesel), 15 order flow records across all 5 NEM regions with buy/sell volumes and net flow, 5 market depth snapshots (one per NEM region: NSW1/VIC1/QLD1/SA1/TAS1) with bid/offer depth, best bid/ask, spread, and imbalance ratio, 8 participant strategic flow records with market share, rebid frequency, and strategic withholding score (0-10)

**Frontend (`app/frontend/src/pages/SpotMarketDepthAnalytics.tsx`):**
- 4 KPI cards: total bid depth (all regions combined, MW/GW), average bid-ask spread (AUD/MWh), widest spread region with spread value, highest withholding score participant with score and region
- Bid stack stepped AreaChart — cumulative MW vs price band using `stepAfter` type, coloured dots per technology with a technology legend; region filter buttons for NSW1/VIC1
- Order flow ComposedChart — dual-axis buy/sell volume BarChart with net flow Line overlay (purple), ReferenceLine at zero, interval labels showing time and region
- Market depth snapshots table — 5 NEM regions with bid/ask depth, best bid (green), best ask (red), spread (amber), and imbalance ratio (colour-coded: red >1.1 oversupply pressure, blue <0.9 undersupply, green balanced)
- Participant strategic analysis table — sorted descending by withholding score, with colour-coded score badges (green 0-4, amber 4-7, red 7-10)

**API client (`app/frontend/src/api/client.ts`):** Appended TypeScript interfaces (`SMDBidStackRecord`, `SMDOrderFlowRecord`, `SMDMarketDepthSnapshot`, `SMDParticipantFlowRecord`, `SpotMarketDepthDashboard`) and `getSpotMarketDepthDashboard()` exported function.
**Routing (`app/frontend/src/App.tsx`):** Import, nav entry (`Layers` icon at `/spot-market-depth`), and `Route` element `<SpotMarketDepthAnalytics />`.
**Tests (`tests/test_backend.py`):** `TestSpotMarketDepthAnalytics.test_spot_depth_dashboard` validates top-level structure, 20 bid stack records with region/technology/price-band checks, 15 order flow records with positive volumes and typed net flow, 5 depth snapshots covering all NEM regions with spread/imbalance/best-bid-ask constraints, 8 participant flow records with score bounds (0-10) and market share (0-100%).

---

## Sprint 55c — Energy Storage Technology Roadmap (2026-02-20)

**New page:** `app/frontend/src/pages/StorageTechRoadmap.tsx` — route `/storage-tech-roadmap`, nav entry "Storage Tech Roadmap" with `GitBranch` icon.

**Backend (`app/backend/main.py`):** Appended Pydantic models (`STRTechnologyRecord`, `STRCostTrajectoryRecord`, `STRDeploymentMilestoneRecord`, `STRMarketForecastRecord`, `StorageTechRoadmapDashboard`) and `GET /api/storage-roadmap/dashboard` endpoint with:
- 10 technology records covering Li-Ion NMC/LFP, Solid-State, Na-Ion, Flow Vanadium/Zinc, CAES, Gravity, LAES, Green Hydrogen Storage
- 50 cost trajectory records (10 techs × 5 years 2024–2028)
- 15 deployment milestone records across all technologies
- 30 market forecast records (6 technologies × 5 years 2024–2028)

**Frontend visualisations:**
- Header + 4 KPI cards: commercial-stage count, cheapest 2030 LCOS target, total AU installed GWh, milestones on-track/achieved count
- Technology matrix table — 10 technologies with maturity badge, duration, current/target LCOS, cycle life, calendar life, AU installed
- LCOS cost trajectory LineChart — top 5 technologies 2024–2028 converging toward competitiveness
- Deployment forecast stacked AreaChart — cumulative GWh by 6 technologies 2024–2028
- Cost reduction horizontal BarChart — % LCOS reduction 2024→2028 by technology
- Milestone tracker table — Gantt-style with status badges (ACHIEVED/ON_TRACK/AT_RISK/NOT_STARTED)
- Technology scatter plot (ScatterChart) — energy density vs cycle life, bubble size = AU installed MWh

**API client (`app/frontend/src/api/client.ts`):** Appended TypeScript interfaces (`STRTechnologyRecord`, `STRCostTrajectoryRecord`, `STRDeploymentMilestoneRecord`, `STRMarketForecastRecord`, `StorageTechRoadmapDashboard`) and `getStorageTechRoadmapDashboard()`.

**Tests (`tests/test_backend.py`):** `TestStorageTechRoadmap.test_storage_tech_roadmap_dashboard` validates top-level structure, exactly 10 technology records with maturity enum and 2030 cost improvement constraint, 50 cost trajectory records spanning all 5 years and 10 technologies, 15 milestones with status enum validation, 30 market forecasts with correct baseline (0% cost reduction in 2024) and LFP 2028 deployment threshold.

## Sprint 55b — Renewable Integration Cost Analytics — 2026-02-20

Added Renewable Integration Cost Analytics page covering the system costs of integrating high VRE penetration — firming, network augmentation, FCAS markets, and curtailment.

**Backend (`app/backend/main.py`):**
- Pydantic enums: `RICCostComponent` (NETWORK_AUGMENTATION/FIRMING_CAPACITY/FCAS_MARKETS/CURTAILMENT_COST/SYSTEM_RESTART/INERTIA_SERVICES), `RICCurtailmentCause` (NETWORK_CONSTRAINT/DEMAND_LOW/OVERSUPPLY/DISPATCH_ORDER), `RICCostTrend` (RISING/STABLE/FALLING), `RICSystemService` (INERTIA/SYSTEM_RESTART/VOLTAGE_CONTROL/REACTIVE_POWER/FAST_FREQUENCY_RESPONSE)
- Pydantic models: `RICCostComponentRecord`, `RICNetworkAugRecord`, `RICCurtailmentRecord`, `RICSystemServiceRecord`, `RenewableIntegrationCostDashboard`
- Endpoint: `GET /api/integration-cost/dashboard` — returns 30 cost component records (5 years × 6 components: 2020-2024 with VRE penetration 24.5%→47.3%), 8 network augmentation projects (EnergyConnect, HumeLink, VNI-West, QNI-M, and 4 REZ enabling projects with BCR 1.9x-4.2x), 20 curtailment records (4 technologies × 5 years across SA/VIC/NSW/QLD with growing trend from 730 GWh in 2020 to 2,830 GWh in 2024), 5 system service records with INERTIA trending RISING, SYSTEM_RESTART STABLE, VOLTAGE_CONTROL and REACTIVE_POWER FALLING

**Frontend (`app/frontend/src/pages/RenewableIntegrationCost.tsx`):**
- 4 KPI cards: Total integration cost 2024 ($4,435 M), highest cost component (NETWORK AUGMENTATION at $1,380 M), total 2024 curtailment (2,830 GWh), network augmentation pipeline ($14,370 M across 8 projects)
- Stacked AreaChart — 6 cost components (indigo/amber/green/red/purple/cyan) stacked by year 2020-2024 showing VRE cost growth trajectory
- Network augmentation table — project name, region badge, investment (M AUD), VRE-enabled MW, cost/MW, commissioning year, BCR badge (green ≥3x, blue ≥2x, amber otherwise)
- Curtailment stacked BarChart — Large Solar/Wind/Rooftop PV GWh by year showing growing curtailment trend
- System services horizontal bar chart — 5 services with RISING/STABLE/FALLING trend badges, provider count, and VRE correlation description
- Cost intensity grid — AUD/MWh VRE for each of 6 components in 2024 with component-coloured values

**API client (`app/frontend/src/api/client.ts`):** Appended TypeScript interfaces (`RICCostComponentRecord`, `RICNetworkAugRecord`, `RICCurtailmentRecord`, `RICSystemServiceRecord`, `RenewableIntegrationCostDashboard`) and `getRenewableIntegrationCostDashboard()` exported function.
**Routing (`app/frontend/src/App.tsx`):** Added `GitMerge` to lucide-react import block; import `RenewableIntegrationCost`; nav entry (`GitMerge` icon at `/renewable-integration-cost`); `Route` element `<RenewableIntegrationCost />`.
**Tests (`tests/test_backend.py`):** `TestRenewableIntegrationCost.test_integration_cost_dashboard` validates top-level structure, 30 cost component records with all 6 components present in each of 5 years, 8 network augmentation projects with viable BCR (>1.0), 20 curtailment records with valid cause enums, 5 system service records covering all services, business logic assertions: 2024 VRE penetration highest, curtailment growing 2020→2024, INERTIA service has RISING trend.
