# Changelog

All notable changes to AUS Energy Copilot are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
