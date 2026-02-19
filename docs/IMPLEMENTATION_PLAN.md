# Implementation Plan
# AUS Energy Copilot — Phase 1

**Version:** 1.0
**Date:** 19 February 2026
**Estimated Duration:** 10 weeks (5 sprints x 2 weeks)
**Team Size:** 2-3 engineers

---

## 1. Technical Architecture

### 1.1 Databricks Technology Mapping

```
┌────────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                              │
│                                                                    │
│  ┌──────────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │  Databricks App  │  │ Genie Spaces  │  │  Databricks SQL   │   │
│  │  (React SPA +    │  │ (NL Analytics)│  │  Alerts           │   │
│  │   FastAPI)       │  │               │  │                   │   │
│  │  - Dashboard     │  │ - Prices      │  │  - Price thresh.  │   │
│  │  - Forecasts     │  │ - Generation  │  │  - Demand alerts  │   │
│  │  - Copilot Chat  │  │ - Intercon.   │  │  - Stale data     │   │
│  │  - Alerts        │  │               │  │  - Model drift    │   │
│  └────────┬─────────┘  └───────┬───────┘  └────────┬──────────┘   │
│           │                    │                    │              │
├───────────┼────────────────────┼────────────────────┼──────────────┤
│           │          AI / ML LAYER                  │              │
│           │                                         │              │
│  ┌────────┴─────────────────────────────────────────┴──────────┐   │
│  │                  Mosaic AI Agent Framework                   │   │
│  │                                                             │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ LLM Engine  │  │ Unity Cat.   │  │ Vector Search    │   │   │
│  │  │ (Claude     │  │ Function     │  │ (RAG Index)      │   │   │
│  │  │  Sonnet 4.5)│  │ Tools        │  │                  │   │   │
│  │  │             │  │ (14 tools)   │  │ - AEMO docs      │   │   │
│  │  └─────────────┘  └──────────────┘  │ - NEM rules      │   │   │
│  │                                     │ - Market glossary │   │   │
│  │  ┌─────────────────────────────┐    └──────────────────┘   │   │
│  │  │ MLflow Model Registry      │                            │   │
│  │  │ - Price forecast models x5  │                            │   │
│  │  │ - Demand forecast models x5 │                            │   │
│  │  │ - Wind forecast models x5   │                            │   │
│  │  │ - Solar forecast models x5  │                            │   │
│  │  │ - Anomaly detection model   │                            │   │
│  │  └─────────────────────────────┘                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                    DATA LAYER                                      │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Unity Catalog                              │  │
│  │                   Catalog: energy_copilot                    │  │
│  │                                                              │  │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐               │  │
│  │  │  bronze   │    │  silver   │    │   gold   │               │  │
│  │  │  schema   │───▶│  schema   │───▶│  schema  │               │  │
│  │  │          │    │          │    │          │               │  │
│  │  │ 11 tables│    │ 13 tables│    │ 15 tables│               │  │
│  │  └──────────┘    └──────────┘    └──────────┘               │  │
│  │                                                              │  │
│  │  ┌──────────────┐    ┌──────────────────────────────────┐    │  │
│  │  │   Lakebase   │    │  Vector Search Index             │    │  │
│  │  │  (Postgres)  │    │  - aemo_documents                │    │  │
│  │  │              │    │  - nem_rules                     │    │  │
│  │  │ - user_prefs │    └──────────────────────────────────┘    │  │
│  │  │ - alerts     │                                            │  │
│  │  │ - sessions   │                                            │  │
│  │  └──────────────┘                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                  INGESTION LAYER                                   │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Lakeflow SDP Pipelines                          │  │
│  │                                                              │  │
│  │  Pipeline 1: nemweb_ingest (streaming)                       │  │
│  │    - Polls NEMWEB /REPORTS/CURRENT/ every 60s                │  │
│  │    - Downloads new ZIP files → extracts CSV → Bronze         │  │
│  │    - Transforms to Silver (clean, validate, enrich)          │  │
│  │    - Aggregates to Gold (regional rollups, fuel mix)         │  │
│  │                                                              │  │
│  │  Pipeline 2: openelec_ingest (batch, hourly)                 │  │
│  │    - Calls OpenElectricity API → Bronze → Silver → Gold      │  │
│  │                                                              │  │
│  │  Pipeline 3: weather_ingest (batch, hourly)                  │  │
│  │    - Calls Open-Meteo API → Bronze → Silver → Gold           │  │
│  │    - Maps weather stations to NEM regions                    │  │
│  │                                                              │  │
│  │  Pipeline 4: solar_ingest (batch, 30-min)                    │  │
│  │    - Calls APVI API → Bronze → Silver → Gold                 │  │
│  │                                                              │  │
│  │  Pipeline 5: forecast_pipeline (triggered)                   │  │
│  │    - Triggered after new dispatch data arrives                │  │
│  │    - Runs all forecast models → Gold forecast tables          │  │
│  │                                                              │  │
│  │  Pipeline 6: market_summary (daily, 05:30 AEST)              │  │
│  │    - AI-generated daily market summary → Gold                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                  EXTERNAL DATA SOURCES                             │
│                                                                    │
│  NEMWEB ──────── nemweb.com.au/REPORTS/CURRENT/                   │
│  OpenElec. ───── api.openelectricity.org.au/v4                    │
│  Open-Meteo ──── api.open-meteo.com                               │
│  APVI ────────── pv-map.apvi.org.au/api                           │
│  AEMO Docs ───── aemo.com.au (for RAG index, one-time)            │
└────────────────────────────────────────────────────────────────────┘
```

### 1.2 Databricks Workspace Organization

```
Workspace
├── energy_copilot/
│   ├── pipelines/
│   │   ├── 01_nemweb_ingest.py          # SDP pipeline: NEMWEB → Bronze → Silver → Gold
│   │   ├── 02_openelec_ingest.py        # SDP pipeline: OpenElectricity API
│   │   ├── 03_weather_ingest.py         # SDP pipeline: Open-Meteo + BOM
│   │   ├── 04_solar_ingest.py           # SDP pipeline: APVI rooftop solar
│   │   ├── 05_forecast_pipeline.py      # Triggered ML inference pipeline
│   │   └── 06_market_summary.py         # Daily AI summary generation
│   │
│   ├── models/
│   │   ├── price_forecast/
│   │   │   ├── train.py                 # Training notebook
│   │   │   ├── evaluate.py              # Evaluation & backtesting
│   │   │   └── feature_engineering.py   # Feature store definitions
│   │   ├── demand_forecast/
│   │   │   ├── train.py
│   │   │   └── evaluate.py
│   │   ├── wind_forecast/
│   │   │   ├── train.py
│   │   │   └── evaluate.py
│   │   ├── solar_forecast/
│   │   │   ├── train.py
│   │   │   └── evaluate.py
│   │   └── anomaly_detection/
│   │       ├── train.py
│   │       └── evaluate.py
│   │
│   ├── agent/
│   │   ├── copilot_agent.py             # Mosaic AI agent definition
│   │   ├── tools/                       # Unity Catalog function tools
│   │   │   ├── market_data_tools.py     # get_latest_prices, get_price_history, etc.
│   │   │   ├── forecast_tools.py        # get_price_forecast, get_demand_forecast, etc.
│   │   │   ├── analysis_tools.py        # explain_price_event, compare_regions, etc.
│   │   │   └── rag_tools.py             # search_market_rules
│   │   ├── evaluation/
│   │   │   ├── eval_dataset.py          # Ground-truth Q&A pairs
│   │   │   └── run_evaluation.py        # Agent evaluation harness
│   │   └── rag/
│   │       ├── index_documents.py       # AEMO doc chunking + embedding
│   │       └── documents/               # Source PDFs/HTML for RAG
│   │
│   ├── app/
│   │   ├── frontend/                    # React SPA (Vite + TypeScript)
│   │   │   ├── src/
│   │   │   │   ├── App.tsx              # Root app with React Router
│   │   │   │   ├── main.tsx             # Entry point
│   │   │   │   ├── pages/
│   │   │   │   │   ├── Home.tsx         # Executive overview page
│   │   │   │   │   ├── LiveMarket.tsx   # Real-time market page
│   │   │   │   │   ├── Forecasts.tsx    # Forecasts page
│   │   │   │   │   ├── Copilot.tsx      # Chat interface page
│   │   │   │   │   ├── Genie.tsx        # Genie analytics (iframe embed)
│   │   │   │   │   └── Alerts.tsx       # Alerts management page
│   │   │   │   ├── components/
│   │   │   │   │   ├── PriceTicker.tsx  # Live price ticker
│   │   │   │   │   ├── GenerationChart.tsx  # Generation mix (Recharts)
│   │   │   │   │   ├── InterconnectorMap.tsx # Interconnector flow diagram
│   │   │   │   │   └── ChatInterface.tsx # Copilot chat w/ SSE streaming
│   │   │   │   ├── api/
│   │   │   │   │   └── client.ts        # Typed API client (FastAPI backend)
│   │   │   │   └── hooks/
│   │   │   │       └── useMarketData.ts # Data fetching + polling hooks
│   │   │   ├── package.json
│   │   │   ├── tsconfig.json
│   │   │   └── vite.config.ts
│   │   ├── backend/                     # FastAPI backend
│   │   │   ├── main.py                  # FastAPI app (SQL proxy + agent proxy)
│   │   │   └── requirements.txt         # Python dependencies
│   │   └── app.yaml                     # Databricks Apps config
│   │
│   ├── setup/
│   │   ├── 00_create_catalog.sql        # Unity Catalog setup
│   │   ├── 01_create_schemas.sql        # Bronze/Silver/Gold schemas
│   │   ├── 02_create_tables.sql         # Table DDL
│   │   ├── 03_setup_lakebase.sql        # Lakebase tables
│   │   ├── 04_create_genie_spaces.py    # Genie space configuration
│   │   ├── 05_create_alerts.sql         # SQL alert definitions
│   │   └── 06_register_uc_functions.py  # Unity Catalog function registration
│   │
│   └── tests/
│       ├── test_pipelines.py            # Pipeline unit tests
│       ├── test_models.py               # Model validation tests
│       ├── test_agent.py                # Agent tool tests
│       └── test_data_quality.py         # Data quality assertions
│
Unity Catalog
├── energy_copilot (catalog)
│   ├── bronze (schema)
│   ├── silver (schema)
│   ├── gold (schema)
│   ├── ml (schema)        # MLflow models
│   └── tools (schema)     # UC functions for agent
```

### 1.3 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Primary ingestion source** | NEMWEB (direct) | Most comprehensive, no API key, lowest latency |
| **Supplementary source** | OpenElectricity API | Cleaner data, good for backfill and validation |
| **Weather source** | Open-Meteo (BOM ACCESS-G) | Free, no key, Australian-specific model, hourly |
| **Streaming vs batch for dispatch** | Near-real-time polling (60s) via SDP | True streaming not available from NEMWEB; polling is practical |
| **Forecast algorithm** | LightGBM primary | Fast training, handles mixed features well, interpretable |
| **LLM for copilot** | Claude Sonnet 4.5 (`claude-sonnet-4-5`) | Strong reasoning and tool-use, large context window suitable for multi-step NEM analysis; call via Anthropic API or Amazon Bedrock |
| **App framework** | React (Vite + TypeScript) + FastAPI backend | Production-quality UI with full TypeScript type safety; Recharts for charting; FastAPI proxies Databricks SQL and agent endpoints; deployed as Databricks App |
| **Operational DB** | Lakebase (Postgres) | Native integration, scale-to-zero, ap-southeast-2 available |
| **Authentication** | Databricks Apps workspace-backed SSO | Native Databricks identity; Unity Catalog RBAC for data-level access control; no additional auth infrastructure needed |
| **Agent framework** | Mosaic AI Agent Framework | Native UC function tools, MLflow tracking, built-in eval |

---

## 2. Sprint Plan

### Sprint 0: Foundation Setup (Week 1-2)

**Goal**: Databricks workspace configured, catalog/schemas created, raw data flowing into Bronze layer.

| # | Task | Owner | Days | Deliverable |
|---|------|-------|------|-------------|
| 0.1 | Create Unity Catalog: `energy_copilot` with `bronze`, `silver`, `gold`, `ml`, `tools` schemas | Data Eng | 0.5 | Catalog + schemas |
| 0.2 | Define and create all Bronze table DDL (11 tables) | Data Eng | 1 | Table definitions |
| 0.3 | Build NEMWEB file downloader utility (poll `/REPORTS/CURRENT/`, detect new ZIPs, download, extract CSV) | Data Eng | 2 | Python module `nemweb_downloader.py` |
| 0.4 | Build SDP Pipeline 1: `nemweb_ingest` — Bronze layer only (dispatch prices, generation, interconnectors, bids, constraints, pre-dispatch) | Data Eng | 3 | Running SDP pipeline, Bronze tables populated |
| 0.5 | Build SDP Pipeline 2: `openelec_ingest` — Bronze layer (OpenElectricity API client + ingestion) | Data Eng | 1.5 | Running pipeline, `bronze.openelec_raw` populated |
| 0.6 | Build SDP Pipeline 3: `weather_ingest` — Bronze layer (Open-Meteo API for key Australian cities mapped to NEM regions) | Data Eng | 1 | Running pipeline, `bronze.weather_raw` populated |
| 0.7 | Build SDP Pipeline 4: `solar_ingest` — Bronze layer (APVI API) | Data Eng | 1 | Running pipeline, `bronze.apvi_raw` populated |
| 0.8 | Historical backfill: Load 12-24 months of NEMWEB archive data into Bronze. **Start as background job on Day 1** — archives are 100s of GBs; must run in parallel with other Sprint 0 tasks, not sequentially at the end | Data Eng | 5 (parallel) | 12+ months of historical data available |
| 0.9 | Set up Lakebase instance in ap-southeast-2 (user_preferences, alert_configs, copilot_sessions tables) | Data Eng | 0.5 | Lakebase provisioned |
| 0.10 | Set up Databricks Workflows to orchestrate all pipelines on schedule | Data Eng | 0.5 | Workflow DAG running |
| 0.11 | Configure access control: Databricks Apps SSO, Unity Catalog RBAC (gold/silver read-only for app users; bronze restricted to pipeline service principals) | Data Eng | 0.5 | Auth and permissions configured |

**Sprint 0 Exit Criteria**:
- All 4 ingestion pipelines running on schedule
- Bronze tables receiving new data every 5 minutes (NEMWEB) and hourly (weather, OpenElec)
- 12+ months of historical dispatch data loaded (backfill job started Day 1, completed by end of sprint)
- Lakebase instance running
- Access control configured (Databricks Apps SSO, Unity Catalog RBAC)

---

### Sprint 1: Silver/Gold Layers + Basic Dashboard (Week 3-4)

**Goal**: Clean data in Silver, analytics-ready Gold tables, first dashboard with live prices.

| # | Task | Owner | Days | Deliverable |
|---|------|-------|------|-------------|
| 1.1 | Extend SDP Pipeline 1: Bronze → Silver transforms (data cleaning, type casting, dedup, null handling, validation expectations) | Data Eng | 3 | 13 Silver tables populated |
| 1.2 | Build generator registry in Silver (DUID → fuel type, capacity, region mapping from AEMO registration data) | Data Eng | 1 | `silver.generator_registry` |
| 1.3 | Build NEM region ↔ weather station mapping table | Data Eng | 0.5 | Region-weather mapping |
| 1.4 | Extend SDP pipelines: Silver → Gold transforms (regional aggregations, fuel-type rollups, interconnector summaries). Partition all high-volume Gold tables by `interval_datetime::date` for query performance | Data Eng | 3 | 15 Gold tables populated, partitioned by date |
| 1.5 | Data quality: Add SDP expectations for all Silver/Gold tables (null checks, range checks, freshness checks) | Data Eng | 1 | DQ expectations firing |
| 1.6 | Scaffold React app (Vite + TypeScript + React Router + Recharts + Tailwind CSS) and FastAPI backend (Databricks SQL proxy, auth middleware); deploy to Databricks Apps | App Dev | 2 | App deployed, all routes showing placeholder pages |
| 1.7 | Build Home page: 5-region price ticker component, NEM demand gauge, 24-hr sparklines (Recharts) | App Dev | 2 | Working Home page |
| 1.8 | Build Live Market page: regional price chart (Recharts LineChart), generation mix stacked area, demand overlay | App Dev | 3 | Working Live Market page |
| 1.9 | Build interconnector flow visualization (directional flow diagram with congestion indicators) | App Dev | 2 | Interconnector panel in Live Market |
| 1.10 | Wire React frontend to FastAPI backend; FastAPI queries Gold tables via Databricks SQL connector; polling-based auto-refresh | App Dev | 1 | Live data flowing to dashboard |
| 1.11 | Extract FCAS prices from Silver DispatchIS data into `gold.nem_fcas_prices` (8 FCAS services × 5 regions × 5-min resolution) | Data Eng | 1 | FCAS Gold table populated |

**Sprint 1 Exit Criteria**:
- Medallion architecture fully operational (Bronze → Silver → Gold)
- Data quality expectations running on all layers
- React app deployed on Databricks Apps with Home + Live Market pages; FastAPI backend serving Gold table data
- Dashboard showing live NEM prices, generation, and interconnector data

---

### Sprint 2: Forecasting Models (Week 5-6)

**Goal**: ML models trained, evaluated, and serving forecasts to Gold layer.

| # | Task | Owner | Days | Deliverable |
|---|------|-------|------|-------------|
| 2.1 | Feature engineering: build feature tables combining price, demand, generation, weather, calendar features | ML Eng | 2 | Feature tables in `gold` schema |
| 2.2 | Train regional price forecast models (LightGBM, 5 regions, horizon as model feature for multi-horizon output) with hyperparameter tuning | ML Eng | 3 | 5 price forecast models in MLflow |
| 2.3 | Train regional demand forecast models (LightGBM, 5 regions, multi-horizon output) | ML Eng | 2 | 5 demand forecast models in MLflow |
| 2.4 | Train wind generation forecast models (5 regions, multi-horizon output) | ML Eng | 2 | 5 wind forecast models in MLflow |
| 2.5 | Train solar generation forecast models (5 regions, multi-horizon output) | ML Eng | 2 | 5 solar forecast models in MLflow |
| 2.6 | Build anomaly/event detection model (isolation forest + rule-based classification) | ML Eng | 2 | Anomaly model in MLflow |
| 2.7 | Backtesting: evaluate all models against held-out test periods, compute MAE/MAPE, compare vs AEMO pre-dispatch baseline | ML Eng | 2 | Evaluation reports in MLflow |
| 2.8 | Build SDP Pipeline 5: `forecast_pipeline` — triggered inference writing to `gold.price_forecasts`, `gold.demand_forecasts`, `gold.generation_forecasts` | ML Eng | 1.5 | Forecasts auto-updating |
| 2.9 | Build Forecasts page in React: actual vs predicted charts, confidence bands, model accuracy panel, horizon selector (Recharts ComposedChart) | App Dev | 2 | Working Forecasts page |
| 2.10 | Set up MLflow model monitoring: track prediction drift, alert on accuracy degradation | ML Eng | 1 | Model monitoring active |

**Sprint 2 Exit Criteria**:
- All 20 forecast models (5 regions × 4 types: price, demand, wind, solar) trained, evaluated, and registered in MLflow
- Price MAE < $15/MWh (1-hr horizon, **excluding extreme events >$500/MWh**) across regions; spike detection recall tracked separately
- Demand MAPE < 3% (1-hr horizon)
- Forecast pipeline auto-triggered on new dispatch data
- Forecasts tab live in dashboard with actual vs predicted visualizations

---

### Sprint 3: AI Copilot Agent (Week 7-8)

**Goal**: Conversational AI agent with tool-calling, RAG, and chat interface deployed.

| # | Task | Owner | Days | Deliverable |
|---|------|-------|------|-------------|
| 3.1 | Register Unity Catalog functions (14 tools): market data tools (6), forecast tools (3), analysis tools (3), RAG tool (1), utility (1) | ML Eng | 2 | UC functions registered |
| 3.2 | Build market data tools: `get_latest_prices`, `get_price_history`, `get_generation_mix`, `get_interconnector_flows`, `get_active_constraints`, `get_fcas_prices` | ML Eng | 2 | 6 tools tested |
| 3.3 | Build forecast tools: `get_price_forecast`, `get_demand_forecast`, `get_weather_forecast` | ML Eng | 1 | 3 tools tested |
| 3.4 | Build analysis tools: `explain_price_event` (correlates outages + weather + constraints + demand), `compare_regions`, `get_market_summary` | ML Eng | 2 | 3 tools tested |
| 3.5 | Build RAG pipeline: chunk and embed AEMO documents (NEM rules, market procedures, glossary) into Vector Search index | ML Eng | 2 | Vector index populated |
| 3.6 | Build `search_market_rules` RAG tool | ML Eng | 0.5 | RAG tool tested |
| 3.7 | Define agent system prompt (NEM domain expertise, Australian energy context, response formatting, guardrails) | ML Eng | 1 | System prompt versioned |
| 3.8 | Build Mosaic AI agent (`copilot_agent.py`) wiring LLM + tools + RAG | ML Eng | 2 | Agent running in AI Playground |
| 3.9 | Build agent evaluation dataset (50+ Q&A pairs covering all capability categories) | ML Eng | 1.5 | Eval dataset |
| 3.10 | Run agent evaluation, iterate on prompt/tools to hit >80% resolution rate. **Budget 3 days** — eval failures often reveal tool architecture issues, not just prompt problems; design tools to be independently testable before wiring into agent | ML Eng | 3 | Eval results documented |
| 3.11 | Deploy agent as serving endpoint | ML Eng | 0.5 | Agent endpoint live |
| 3.12 | Build Copilot Chat page in React: chat interface with SSE streaming, message history, inline chart rendering (Recharts), suggested questions | App Dev | 3 | Working Chat page |

**Sprint 3 Exit Criteria**:
- All 14 UC function tools registered and tested
- RAG index populated with AEMO documents
- Agent deployed and accessible via serving endpoint
- Agent evaluation: >80% query resolution rate
- Chat tab functional with tool-calling, inline results, and suggested questions

---

### Sprint 4: Genie Spaces, Alerts, Polish & Launch (Week 9-10)

**Goal**: Genie spaces live, alerting system active, UX polished, production-ready.

| # | Task | Owner | Days | Deliverable |
|---|------|-------|------|-------------|
| 4.0 | Build SDP Pipeline 6: `market_summary` — daily AI-generated market brief using agent + tools (moved from Sprint 3 to protect agent eval iteration time) | ML Eng | 1 | Daily summaries in `gold.daily_market_summary` |
| 4.1 | Create Genie Space 1: NEM Prices & Demand (tables, sample questions, glossary, benchmarks). **Invest in semantic layer** — column descriptions and benchmark questions are the primary lever for Genie accuracy | Data Eng | 1.5 | Genie space live |
| 4.2 | Create Genie Space 2: Generation & Fuel Mix (tables, sample questions, glossary, benchmarks) | Data Eng | 1.5 | Genie space live |
| 4.3 | Create Genie Space 3: Interconnectors & Constraints (tables, sample questions, glossary, benchmarks) | Data Eng | 1.5 | Genie space live |
| 4.4 | Write Genie benchmark tests (15+ per space) and validate >85% accuracy | Data Eng | 2 | Benchmark results |
| 4.5 | Build Genie Analytics page in React (embed Genie spaces via iframe using Databricks Apps SSO passthrough) | App Dev | 1.5 | Genie page working |
| 4.6 | Build Alerts tab: alert configuration UI (metric, region, threshold, channel), active alerts table, alert history | App Dev | 2 | Alerts tab working |
| 4.7 | Configure Databricks SQL Alerts: price thresholds (>$300, >$1000, >$5000 per region), demand surge, data staleness, model drift | Data Eng | 1 | SQL alerts active |
| 4.8 | Build predictive alerts: AI copilot flags predicted price spikes before they happen | ML Eng | 1.5 | Predictive alerts in Alerts tab |
| 4.9 | Lakebase integration: persist user alert preferences, copilot chat history, dashboard settings | App Dev | 1.5 | Persistent user state |
| 4.10 | UX polish: loading states, error handling, responsive layout, color scheme, tooltips, onboarding tutorial | App Dev | 2 | Polished UI |
| 4.11 | Performance optimization: query caching, chart lazy loading, SQL warehouse tuning | Data Eng | 1 | Load times < 3s |
| 4.12 | End-to-end testing: data pipeline → Gold tables → dashboard → copilot → alerts | All | 1.5 | Test report |
| 4.13 | Documentation: user guide, architecture docs, runbook | All | 1 | Docs in repo |
| 4.14 | Production deployment: final app publish, pipeline schedules confirmed, monitoring dashboards | All | 0.5 | Production launch |

**Sprint 4 Exit Criteria**:
- 3 Genie spaces live with >85% benchmark accuracy (semantic layer tuned per space)
- SQL alerts and predictive alerts operational
- Daily market summary auto-generating by 06:00 AEST
- All 6 React pages polished and functional
- End-to-end data flow validated
- Dashboard load time < 3 seconds
- Access control configured (SSO + RBAC)
- Application deployed to production

---

## 3. Data Pipeline Detail

### 3.1 NEMWEB Ingestion Pattern

```
                    ┌─────────────────────┐
                    │  nemweb.com.au       │
                    │  /REPORTS/CURRENT/   │
                    │                     │
                    │  New ZIP files       │
                    │  every 5 minutes     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  NEMWEB Downloader   │
                    │  (Python utility)    │
                    │                     │
                    │  - Poll every 60s    │
                    │  - Track processed   │
                    │    files in Delta    │
                    │  - Download new ZIPs │
                    │  - Extract CSV       │
                    │  - Write to Volume   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Autoloader          │
                    │  (SDP Streaming)     │
                    │                     │
                    │  - Schema inference  │
                    │  - File tracking     │
                    │  - Exactly-once      │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │    Bronze     │ │    Silver     │ │     Gold     │
      │              │ │              │ │              │
      │ Raw CSV data │ │ Cleaned,     │ │ Aggregated,  │
      │ append-only  │ │ typed,       │ │ enriched,    │
      │ partitioned  │ │ validated,   │ │ feature-     │
      │ by date      │ │ deduplicated │ │ engineered   │
      └──────────────┘ └──────────────┘ └──────────────┘
```

### 3.2 NEMWEB File Categories to Ingest

| NEMWEB Directory | Files | Target Bronze Table | Frequency |
|-----------------|-------|-------------------|-----------|
| `Dispatch_SCADA/` | `PUBLIC_DISPATCHSCADA_*.ZIP` | `bronze.nemweb_dispatch_gen` | 5 min |
| `DispatchIS_Reports/` | `PUBLIC_DISPATCHIS_*.ZIP` | `bronze.nemweb_dispatch_is` | 5 min |
| `Dispatch_Reports/` | `PUBLIC_DISPATCHPRICE_*.ZIP` | `bronze.nemweb_dispatch_price` | 5 min |
| `Dispatch_Reports/` | `PUBLIC_DISPATCHINTERCONNECTORRES_*.ZIP` | `bronze.nemweb_dispatch_inter` | 5 min |
| `TradingIS_Reports/` | `PUBLIC_TRADINGIS_*.ZIP` | `bronze.nemweb_trading_is` | 30 min |
| `Predispatch_Reports/` | `PUBLIC_PREDISPATCHIS_*.ZIP` | `bronze.nemweb_predispatch` | 30 min |
| `Next_Day_Dispatch/` | `PUBLIC_NEXT_DAY_DISPATCH_*.ZIP` | `bronze.nemweb_bids` | Daily |
| `DispatchIS_Reports/` | Constraint files | `bronze.nemweb_constraints` | 5 min |

### 3.3 Weather Station → NEM Region Mapping

| NEM Region | Representative Cities | Open-Meteo Coordinates |
|------------|----------------------|----------------------|
| NSW1 | Sydney, Newcastle, Wollongong | -33.87, 151.21 |
| QLD1 | Brisbane, Townsville, Cairns | -27.47, 153.03 |
| VIC1 | Melbourne, Geelong | -37.81, 144.96 |
| SA1 | Adelaide, Port Augusta | -34.93, 138.60 |
| TAS1 | Hobart, Launceston | -42.88, 147.33 |

Multiple weather stations per region, aggregated with population/load weighting.

---

## 4. ML Model Pipeline Detail

### 4.1 Feature Engineering

**Temporal Features:**
- Hour of day (0-23), day of week (0-6), month (1-12)
- Is weekend, is public holiday (Australian state-specific)
- Season indicator
- Minutes since midnight (continuous)
- Days since last holiday

**Price/Market Features (lagged):**
- Price lags: t-1 (5min), t-6 (30min), t-12 (1hr), t-288 (24hr), t-2016 (7 days)
- Price rolling stats: mean, std, min, max over 1hr, 4hr, 24hr windows
- Demand lags and rolling stats (same windows)
- Generation by fuel type lags
- Interconnector flow lags
- AEMO pre-dispatch price forecast (where available)

**Weather Features:**
- Temperature (current, forecast +1hr, +4hr, +24hr)
- Wind speed at 100m (current + forecast)
- Solar radiation (current + forecast)
- Heating/cooling degree days

**Cross-Regional Features:**
- Price spread between connected regions
- Interconnector utilization ratio
- NEM-wide total demand / total available capacity

### 4.2 Training Strategy

```
Historical Data: 24 months
├── Training:   months 1-18 (rolling window)
├── Validation: months 19-21
└── Test:       months 22-24

Retraining: Weekly (Sunday night AEST)
  - Full retrain on latest 12-month window
  - Evaluate against validation set
  - Auto-promote if metrics improve; alert if degraded

Hyperparameter Tuning: Optuna (50 trials per model)
  - LightGBM params: num_leaves, learning_rate, max_depth,
    min_child_samples, reg_alpha, reg_lambda, subsample
```

### 4.3 Model Serving Architecture

```
New dispatch data arrives (every 5 min)
        │
        ▼
┌──────────────────────────┐
│ Databricks Workflow       │
│ (Trigger: file arrival)   │
│                          │
│  1. Read latest features │
│  2. Load models from     │
│     MLflow registry      │
│  3. Run inference:       │
│     5 regions ×          │
│     3 horizons =         │
│     15 predictions       │
│  4. Write to Gold        │
│     forecast tables      │
│  5. Check for anomalies  │
│  6. Fire alerts if       │
│     predicted spike      │
└──────────────────────────┘
```

---

## 5. Copilot Agent Detail

### 5.1 System Prompt (Summary)

The agent system prompt establishes:
- **Role**: Expert Australian energy market analyst and trading assistant
- **Domain knowledge**: NEM structure (5 regions), dispatch/trading intervals, AEMO market rules, fuel types, interconnectors, FCAS basics
- **Behavior**: Always ground answers in data (use tools); never guess prices; state uncertainty clearly; cite data timestamps
- **Response format**: Concise, trader-friendly; use tables for multi-region comparisons; use bullet points for summaries
- **Guardrails**: Never provide trading advice or recommendations; always caveat forecasts with uncertainty; decline questions outside NEM/energy domain

### 5.2 Tool Specifications

| Tool | Input | Output | Data Source |
|------|-------|--------|-------------|
| `get_latest_prices(region: Optional[str])` | Region code or None (all) | Dict of region→price, timestamp | `gold.nem_prices_5min` |
| `get_price_history(region, start, end, interval)` | Region, date range, 5min/30min/1hr/daily | List of (timestamp, price) | `gold.nem_prices_5min/30min` |
| `get_price_forecast(region, horizon)` | Region, 1hr/4hr/24hr | List of (timestamp, predicted_price, confidence) | `gold.price_forecasts` |
| `get_demand_forecast(region, horizon)` | Region, 1hr/4hr/24hr | List of (timestamp, predicted_demand_mw) | `gold.demand_forecasts` |
| `get_generation_mix(region, start, end)` | Region, date range | Dict of fuel_type→total_mw | `gold.nem_generation_by_fuel` |
| `get_interconnector_flows(interconnector_id)` | Interconnector ID or None | Flow MW, limit, utilization% | `gold.nem_interconnectors` |
| `get_weather_forecast(region, hours_ahead)` | Region, horizon | Temp, wind, solar rad forecast | `gold.weather_nem_regions` |
| `explain_price_event(region, timestamp)` | Region, approx time | Structured explanation (outages, weather, constraints, demand) | Multiple Gold tables |
| `get_market_summary(date)` | Date or "today"/"yesterday" | AI-generated market narrative | `gold.daily_market_summary` |
| `search_market_rules(query)` | NL query about NEM rules | Relevant document chunks | Vector Search index |
| `get_active_constraints(region)` | Region | List of binding constraints | `gold.nem_constraints_active` |
| `get_fcas_prices(region, service, start, end)` | Region, FCAS service (RAISE6SEC/LOWER6SEC/etc.), date range | List of (timestamp, price) for the specified FCAS service | `gold.nem_fcas_prices` |
| `get_generator_info(duid)` | Generator DUID | Fuel type, capacity, region, owner | `silver.generator_registry` |
| `compare_regions(metric, start, end)` | price/demand/generation, date range | Comparison table across all 5 regions | Gold tables |

### 5.3 Agent Evaluation Criteria

| Category | # Test Cases | Example |
|----------|-------------|---------|
| Factual market queries | 15 | "What is the current price in NSW?" |
| Forecast queries | 10 | "What's the demand forecast for VIC tonight?" |
| Event explanation | 8 | "Why did SA price spike at 3pm yesterday?" |
| Comparative analysis | 7 | "Compare wind generation across all regions this week" |
| Market rules (RAG) | 5 | "How does the AEMO dispatch process work?" |
| Out-of-scope handling | 5 | "Should I buy BHP shares?" → polite decline |

**Pass criteria**: >80% of queries answered correctly (graded by domain expert).

---

## 6. Infrastructure & Cost Estimates

### 6.1 Databricks Resources

| Resource | Specification | Estimated Monthly Cost (AUD) |
|----------|--------------|------------------------------|
| **SQL Warehouse** (dashboard queries) | Serverless, Small, auto-stop 10min | $400-$800 |
| **SDP Pipelines** (5 pipelines) | Serverless, triggered/scheduled | $300-$600 |
| **ML Training** (weekly retraining) | GPU cluster, spot instances, ~4 hrs/week | $200-$400 |
| **ML Inference** (forecast pipeline) | Serverless, triggered every 5 min | $200-$400 |
| **Agent Serving Endpoint** | Serverless, pay-per-request | $300-$600 |
| **Databricks App** (React + FastAPI) | Serverless, pay-per-use | $50-$150 |
| **Lakebase** (Postgres) | Autoscaling, scale-to-zero | $50-$150 |
| **Unity Catalog Storage** | ~500GB Delta tables | $50-$100 |
| **Vector Search** | Serverless index | $50-$100 |
| **LLM tokens** (agent) | ~1M tokens/day (Claude Sonnet 4.5) | $300-$600 |
| **Total Estimated** | | **$1,900-$3,900/month** |

### 6.2 External API Costs

| API | Cost |
|-----|------|
| NEMWEB | Free (public data) |
| OpenElectricity | Free (API key required) |
| Open-Meteo | Free (non-commercial); $15/month (commercial) |
| APVI | Free |

---

## 7. Risk Mitigation

| Risk | Mitigation Strategy |
|------|-------------------|
| **NEMWEB format changes** | Schema evolution handling in Bronze layer; Autoloader schema hints; alerting on schema drift; OpenElectricity as fallback |
| **API rate limits** | Cache all API responses in Bronze layer; incremental processing; respect rate limits with backoff |
| **Forecast accuracy insufficient** | Start with AEMO pre-dispatch as baseline; ensemble multiple algorithms; weekly retraining; human-in-the-loop review |
| **Agent hallucination** | Tool-grounded architecture (agent must use tools for data); evaluation suite; guardrails in system prompt; citation of data timestamps |
| **Cost overrun** | Serverless everything (pay per use); scale-to-zero on Lakebase; spot instances for training; monitor DBU consumption weekly |
| **Data freshness degradation** | Pipeline health monitoring; staleness alerts (>10 min for dispatch); redundant sources (NEMWEB + OpenElectricity) |
| **Model proliferation / operational overhead** | Multi-horizon output design (horizon as model feature) caps total models at 20 (5 regions × 4 types) instead of 60; weekly retraining shared across horizons per model |
| **Agent eval reveals tool architecture issues** | Design and unit-test each UC function tool independently before wiring into agent; budget 3 days for eval iteration; maintain a canary eval set to catch regressions after tool changes |

---

## 8. Timeline Summary

```
Week 1-2:  Sprint 0 — Foundation (Catalog, Bronze pipelines, historical backfill)
           ════════════════════════════════════════════════════

Week 3-4:  Sprint 1 — Silver/Gold + Dashboard (Live Market, Home tabs)
           ════════════════════════════════════════════════════

Week 5-6:  Sprint 2 — ML Models (Price, Demand, Wind, Solar, Anomaly)
           ════════════════════════════════════════════════════

Week 7-8:  Sprint 3 — AI Copilot (Agent, Tools, RAG, Chat UI)
           ════════════════════════════════════════════════════

Week 9-10: Sprint 4 — Genie, Alerts, Polish, Launch
           ════════════════════════════════════════════════════

           ┃ MVP Demo ┃          ┃ Beta ┃         ┃ Launch ┃
           Week 4              Week 8            Week 10
```

### Key Milestones

| Milestone | Date (from start) | Deliverable |
|-----------|-------------------|-------------|
| **M1: Data Flowing** | End of Week 2 | All Bronze pipelines running, 12 months historical data loaded |
| **M2: MVP Demo** | End of Week 4 | Dashboard with live prices, generation, interconnectors; full medallion architecture |
| **M3: Forecasts Live** | End of Week 6 | All forecast models trained and auto-updating; Forecasts tab in dashboard |
| **M4: Beta Release** | End of Week 8 | AI Copilot chat working with 14 tools (including FCAS); RAG over NEM docs |
| **M5: Production Launch** | End of Week 10 | All features complete; Genie spaces; alerts; polished UX; documentation |

---

## 9. Definition of Done — Phase 1

- [ ] 4 data ingestion pipelines running in production on schedule
- [ ] Medallion architecture: 11 Bronze, 13 Silver, 16 Gold tables (including `nem_fcas_prices`) populated and refreshing
- [ ] Data freshness: dispatch data < 2 minutes from AEMO publish
- [ ] 20 forecast models (5 regions × 4 types: price, demand, wind, solar) + anomaly model trained, evaluated, and serving forecasts via multi-horizon output design
- [ ] Price forecast 1-hr MAE < $15/MWh (excluding extreme events >$500/MWh); spike detection recall tracked separately
- [ ] AI Copilot agent deployed with 14 tools (including FCAS), >80% query resolution rate
- [ ] RAG index over AEMO documents searchable
- [ ] Daily AI market summaries auto-generating by 06:00 AEST
- [ ] 3 Genie spaces live with >85% query accuracy (semantic layer — column descriptions and benchmark questions — tuned per space)
- [ ] React app (Vite + TypeScript + FastAPI backend) deployed on Databricks Apps with 6 pages (Home, Live Market, Forecasts, Copilot, Genie, Alerts)
- [ ] SQL alerts configured for price thresholds, data staleness, model drift
- [ ] Dashboard load time < 3 seconds
- [ ] Lakebase storing user preferences and copilot history
- [ ] Access control configured: Databricks Apps SSO, Unity Catalog RBAC (gold/silver read for app users; bronze restricted to pipeline service principals)
- [ ] End-to-end test suite passing
- [ ] Architecture documentation and user guide complete
