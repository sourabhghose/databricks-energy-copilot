# Changelog

All notable changes to AUS Energy Copilot are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Bundle Deploy] - 2026-03-06

### Added
- **Databricks Asset Bundle deployment** — single `databricks bundle deploy` command deploys all resources (App, 10 Jobs, 4 DLT Pipelines, 2 Model Serving Endpoints, 5 MLflow Experiments)
- `resources/app.yml` — Databricks App resource with SQL Warehouse + Lakebase database resources
- `resources/jobs.yml` — 10 serverless jobs (setup, ingest x4, ML, market summary, data quality, simulator, snapshots)
- `resources/pipelines.yml` — 4 serverless DLT pipelines (no cluster blocks)
- `resources/model_serving.yml` — Price Forecast (5 regions) + Anomaly Detection endpoints
- `resources/experiments.yml` — 5 MLflow experiments
- `post_deploy.sh` — Post-deploy script for Lakebase permissions, Synced Tables, and Genie Space creation
- `job_00_setup` — One-time setup job (schemas + tables + 90-day backfill)
- `job_09_simulator` — NEM simulator job (manual start, continuous)
- `job_10_dashboard_snapshots` — Dashboard snapshot generator (every 5 min)
- Bundle variables: `catalog`, `lakebase_instance_name`, `lakebase_database`, `warehouse_id`, `app_name`, `vs_endpoint_name`, `notification_email`
- Architecture diagrams in `docs/images/` (deployment flow, bundle architecture, data serving layers)

### Changed
- `databricks.yml` — Rewritten to use variables + `include: resources/*.yml` + targets only (was monolithic 544 lines)
- `app/app.yaml` — Simplified to `command:` only (env vars now managed by bundle in `resources/app.yml`)
- `app/routers/shared.py` — `_CATALOG` now reads from `DATABRICKS_CATALOG` env var (was hardcoded)
- `app/routers/genie.py` — Workspace URL fallback reads from `DATABRICKS_HOST` env var (was hardcoded to `fevm-energy-copilot.cloud.databricks.com`)
- `app/routers/copilot.py` — VS endpoint/index now read from `VS_ENDPOINT_NAME`/`VS_INDEX_NAME` env vars
- 6 pipeline notebooks — Added `dbutils.widgets.get("catalog")` widget pattern (was hardcoded catalog name)
- 2 Lakebase notebooks — Parameterized SP UUID, instance name, database name via widgets
- All jobs — Replaced `new_cluster:` with `environment_key: default` for serverless compute
- All DLT pipelines — Removed `clusters:` blocks for serverless execution
- All notification emails — Replaced hardcoded `ops@energy-copilot.internal` with `${var.notification_email}`
- README.md — Complete rewrite with bundle deploy instructions, architecture diagrams, and comprehensive reference
- docs/DEPLOYMENT.md — Complete rewrite covering bundle deploy workflow

### Deprecated
- `deploy.sh` — Now prints deprecation warning and exits unless `FORCE_LEGACY_DEPLOY=1` is set

### Removed
- Broken `batch_scoring_notebook` sub-task in job_05 (used `existing_cluster_id: ""`)
- `python_wheel_task` in job_08 (replaced with `notebook_task` for serverless compatibility)
- Hardcoded cluster configs (`new_cluster` blocks with `i3.xlarge`, `SPOT_WITH_FALLBACK`, `spark_version`)

## [Sprint 171] - 2026-02-26

### Fixed
- Route ordering: moved 32 stub dashboard endpoints before the API catch-all route (`/api/{path:path}`) so they no longer return 404
- Copilot data context: fixed `NameError: name 'lg' is not defined` in `_build_market_context()` — logger variable was `logger` but context builder used `lg`
- Copilot volatility parsing: `prices_volatility()` returns `{"regions": [...]}` dict but context builder iterated over it directly; now extracts `.regions` list and uses correct field names (`mean_price`, `std_dev`, `min_price`, `max_price`, `spike_count`)

### Changed
- API catch-all fallback from 404 to 501 ("not yet implemented") so frontend error handlers display a message instead of crashing to blank screen
- Sidebar branding: Databricks logo (inline SVG), dark sidebar (`#1B3139`), accent color `#FF3621`
- Favicon: Databricks diamond logo as data URI SVG
- Font: DM Sans via Google Fonts
- Title: "AUS Energy Copilot | Databricks"
- Top bar and main container colors updated to Databricks palette
- Footer: "Powered by Databricks"

### Added
- `/api/debug/context` endpoint for troubleshooting copilot system prompt context
- Databricks icon SVG in `frontend/dist/`

## [Sprint 12c] - 2026-02-19

### Added
- Forecast confidence intervals (p10/p90) on price and demand forecasts
- New `GET /api/forecasts/summary` endpoint with model MAPE metrics
- Confidence interval shaded area band on Forecasts page chart
- Model Performance table showing 1hr/4hr/24hr MAPE for price and demand
- Forecast confidence score bar with color-coded health indicator
- "Show confidence interval" toggle on forecast chart
- `ForecastSummary` TypeScript interface and `getForecastSummary()` API method

## [Unreleased] — Sprint 10 (2026-02-19)

### Added
- API key authentication middleware (X-API-Key header, opt-in via ENERGY_COPILOT_API_KEY env var)
- /api/version endpoint (version, auth status, mock mode, rate limit config)
- OpenAPI metadata: app title, description, tag groups, response descriptions
- Agent tools: get_anomaly_events, get_model_health, get_forecast_accuracy (Sprint 9b)
- Model serving endpoints in databricks.yml (Sprint 9c)
- Batch scoring notebook (Sprint 9c)

## [Unreleased] - Sprint 7 (2026-02-19)

### Added
- Wind forecast evaluation with capacity-weighted bias, ramp accuracy, high/low wind MAPE
- Solar forecast evaluation with daytime-only MAPE, clear-sky MAE, seasonal breakdown
- Demand forecast evaluation with peak/off-peak MAPE, seasonal decomposition
- Agent evaluation CI job with dry-run mode and JSON report artifact
- Rate limiting middleware (60 req/min per IP, configurable)
- /api/market-summary/latest endpoint
- Region persistence via localStorage in LiveMarket and Forecasts pages
- Price spike visual indicators (amber SPIKE badge, red EXTREME SPIKE badge)
- Forecast confidence bands in Forecasts page

## [0.6.0] - Sprint 6 (2026-02-19)

### Added
- Wind forecast model: 12 lags, ramp rate, capacity factor, Optuna 50-trial HPO (MAPE target <8%)
- Solar forecast model: daylight-only training, sun angle proxy, seasonal sin/cos, night exclusion
- CI pythonpath fix: pythonpath=["."] in pyproject.toml + PYTHONPATH: . in ci.yml
- .dockerignore, setup.py stub, .gitignore cleanup

## [0.5.0] - Sprint 5 (2026-02-19)

### Added
- Home dashboard AI Market Summary widget (Claude Sonnet 4.5)
- Backend integration tests (TestClient, 7 test classes, 13 tests)
- docker-compose.yml with backend + frontend services
- app/backend/Dockerfile, app/frontend/Dockerfile.dev
- app/app.yaml Databricks Apps deployment config

## [0.4.0] - Sprint 4 (2026-02-19)

### Added
- ChatInterface forwardRef with ChatInterfaceHandle (clearChat, sendQuestion, focusInput)
- Copilot page with collapsible sidebar, token badge, session stats, Cmd+K shortcut
- Alerts CRUD UI (create modal, optimistic delete, severity colour coding)
- GitHub Actions CI (python-tests, frontend-build, lint jobs)
- pyproject.toml with ruff, mypy, pytest config
- .pre-commit-config.yaml (ruff, black, pre-commit-hooks)
- docs/DEPLOYMENT.md (9-step deployment guide)

## [0.3.0] - Sprint 3 (2026-02-19)

### Added
- Copilot agent: dual path (raw Anthropic SDK + LangChain), MAX_TOOL_ROUNDS=10
- Security guards: trading advice refusal, prompt injection detection
- Token tracking across multi-round tool calls
- Streaming via stream_predict() with typed SSE events
- RAG index restructured to energy_copilot.gold schema
- Chunking by doc type: PDF paragraph-boundary, XML constraint, HTML heading
- prompt_templates.py centralising all prompt text

## [0.2.0] - Sprint 2 (2026-02-19)

### Added
- Price forecast: full Optuna search space, SPIKE_WEIGHT=3.0, LightGBMPruningCallback
- Feature engineering: volatility regime, FCAS correlation, interconnector stress, time flags, spike history
- Anomaly detection: complete rewrite with permutation importance, 21-month training window
- register_all_models.py CLI for bulk MLflow registration with alias management

## [0.1.0] - Sprint 1 (2026-02-19)

### Added
- FastAPI backend: 7 market data endpoints + SSE chat endpoint with 5-round tool loop
- Mock data layer (DatabricksSQLClient + LakebaseClient with mock_mode=True)
- React frontend: Home, LiveMarket, Forecasts, Copilot, Alerts, Genie pages
- All 6 frontend data hooks with API fallback to plausible mock data
- Generator registry loader (AEMO XLSX -> Delta)
- Data quality tests, pipeline tests, agent tests

## [0.0.1] - Sprint 0 (2026-02-19)

### Added
- Project scaffold: directory structure, PRD, implementation plan
- DDL: 40 Delta tables (Bronze/Silver/Gold), Lakebase Postgres schema, 14 UC functions
- Initial pipeline stubs: 6 DLT/Python pipelines
- Initial model stubs: 5 model packages (price, demand, wind, solar, anomaly)
- Initial agent stub: LangChain AgentExecutor with 13 tools
