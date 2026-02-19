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
