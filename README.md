# AUS Energy Copilot

Real-time Australian NEM market intelligence platform: live prices, ML forecasts, and an AI copilot chat backed by Claude Sonnet 4.5 — deployed as a Databricks App.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                             │
│  React SPA (Vite + TypeScript)  ←→  FastAPI backend             │
│  6 pages: Home · Live Market · Forecasts · Copilot · Genie · Alerts │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST + SSE streaming
┌────────────────────────▼────────────────────────────────────────┐
│  AI / ML LAYER                                                  │
│  Mosaic AI Agent (LangChain + Claude Sonnet 4.5)                │
│  14 UC function tools · MLflow Model Registry · Vector Search   │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│  DATA LAYER  (Unity Catalog: energy_copilot)                    │
│  Bronze (11 tables) → Silver (13 tables) → Gold (16 tables)     │
│  Lakebase (Postgres): user_prefs · alerts · sessions            │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│  INGESTION LAYER  (Lakeflow SDP Pipelines)                      │
│  NEMWEB (5-min polling) · OpenElectricity · Open-Meteo · APVI   │
│  + Forecast pipeline (triggered) + Daily AI market summary      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

**Step 1 — Run setup SQL (Unity Catalog + tables + Lakebase)**

```bash
# Connect to your Databricks workspace and run in order:
databricks bundle run setup/00_create_catalog.sql
databricks bundle run setup/01_create_schemas.sql
databricks bundle run setup/02_create_tables.sql
databricks bundle run setup/03_setup_lakebase.sql   # Postgres/Lakebase connection
python setup/04_create_genie_spaces.py
databricks bundle run setup/05_create_alerts.sql
python setup/06_register_uc_functions.py
```

**Step 2 — Start the FastAPI backend**

```bash
cd app/backend
cp .env.example .env          # fill in DATABRICKS_HOST, TOKEN, WAREHOUSE_ID, ANTHROPIC_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Step 3 — Start the React frontend**

```bash
cd app/frontend
npm install
npm run dev                   # opens http://localhost:5173
```

---

## Project Structure

```
energy-copilot/
├── agent/                        # Mosaic AI agent definition + tools
│   ├── copilot_agent.py          # LangChain AgentExecutor + MLflow PyFunc wrapper
│   ├── tools/
│   │   ├── market_data_tools.py  # 6 tools: latest prices, history, generation, FCAS, …
│   │   ├── forecast_tools.py     # 3 tools: price forecast, demand forecast, weather
│   │   ├── analysis_tools.py     # 3 tools: explain event, compare regions, market summary
│   │   └── rag_tools.py          # 1 tool: search_market_rules (Vector Search)
│   ├── rag/
│   │   └── index_documents.py    # AEMO doc chunking + embedding → VS index
│   └── evaluation/
│       ├── eval_dataset.py       # 50 ground-truth Q&A pairs
│       └── run_evaluation.py     # MLflow-tracked evaluation harness
│
├── app/
│   ├── frontend/                 # React SPA (Vite + TypeScript + Recharts + Tailwind)
│   │   └── src/
│   │       ├── pages/            # Home, LiveMarket, Forecasts, Copilot, Genie, Alerts
│   │       ├── components/       # PriceTicker, GenerationChart, InterconnectorMap, Chat
│   │       ├── api/client.ts     # Typed API client
│   │       └── hooks/            # useMarketData polling hooks
│   ├── backend/
│   │   ├── main.py               # FastAPI: 8 REST endpoints + /api/chat SSE stream
│   │   └── requirements.txt      # Backend Python deps
│   └── app.yaml                  # Databricks Apps deployment config
│
├── models/                       # ML model training notebooks
│   ├── price_forecast/           # LightGBM price forecast (5 regions, multi-horizon)
│   ├── demand_forecast/          # LightGBM demand forecast
│   ├── wind_forecast/            # Wind generation forecast
│   ├── solar_forecast/           # Solar generation forecast
│   └── anomaly_detection/        # IsolationForest + rule-based classifier
│
├── pipelines/                    # Lakeflow SDP pipelines
│   ├── nemweb_downloader.py      # NEMWEB polling utility (60s, dedup via Delta)
│   ├── 01_nemweb_ingest.py       # NEMWEB Bronze → Silver → Gold (streaming)
│   ├── 02_openelec_ingest.py     # OpenElectricity API batch ingest
│   ├── 03_weather_ingest.py      # Open-Meteo BOM ACCESS-G ingest
│   ├── 04_solar_ingest.py        # APVI rooftop solar ingest
│   ├── 05_forecast_pipeline.py   # Triggered ML inference → Gold forecast tables
│   └── 06_market_summary.py      # Daily AI market brief (Claude, 05:30 AEST)
│
├── setup/                        # One-time workspace setup scripts
│   ├── 00_create_catalog.sql     # Unity Catalog + schemas + RBAC
│   ├── 01_create_schemas.sql     # Schema definitions with metadata
│   ├── 02_create_tables.sql      # Full DDL: 40 Delta tables (Bronze/Silver/Gold)
│   ├── 03_setup_lakebase.sql     # Lakebase Postgres tables
│   ├── 04_create_genie_spaces.py # 3 Genie Spaces with semantic layer + benchmarks
│   ├── 05_create_alerts.sql      # SQL alert views (price, demand, staleness, drift)
│   └── 06_register_uc_functions.py # Register 14 UC function tools for agent
│
├── tests/
│   ├── test_agent.py             # Agent tool + FastAPI endpoint tests (mocked)
│   ├── test_models.py            # ML model validation tests
│   ├── test_pipelines.py         # Pipeline unit tests
│   └── test_data_quality.py      # Data quality assertions
│
├── docs/
│   └── IMPLEMENTATION_PLAN.md    # Full 10-week sprint plan + architecture detail
│
├── .gitignore
├── README.md
├── requirements-dev.txt          # Dev/test dependencies
└── STATUS.md                     # Workstream completion log
```

---

## Data Sources

| Source | URL | Refresh | Notes |
|--------|-----|---------|-------|
| **NEMWEB** | `nemweb.com.au/REPORTS/CURRENT/` | 5 min | Primary dispatch data; no API key required |
| **OpenElectricity** | `api.openelectricity.org.au/v4` | Hourly | Cleaner API; used for backfill and validation |
| **Open-Meteo** | `api.open-meteo.com` | Hourly | BOM ACCESS-G gridded NWP; free for non-commercial use |
| **APVI** | `pv-map.apvi.org.au/api` | 30 min | Rooftop solar generation by postcode → NEM region |
| **AEMO Docs** | `aemo.com.au` | One-time | NER, market procedures, glossary → RAG Vector Search index |

---

## Sprint Status

- [x] Sprint 0: Foundation — Unity Catalog, Bronze pipelines, 12-month historical backfill, Lakebase
- [x] Sprint 1: Silver/Gold + Dashboard — Medallion architecture, Home + Live Market pages
- [x] Sprint 2: Forecasting Models — 20 LightGBM models (price, demand, wind, solar x 5 regions) + anomaly detection
- [x] Sprint 3: AI Copilot Agent — 14 UC function tools, RAG index, Claude Sonnet 4.5, Chat UI
- [ ] Sprint 4: Genie Spaces, Alerts, Polish, Launch

**Definition of Done — Phase 1:**

- [x] 4 data ingestion pipelines running in production on schedule
- [x] Medallion architecture: 11 Bronze + 13 Silver + 16 Gold tables populated and refreshing
- [ ] Data freshness: dispatch data < 2 minutes from AEMO publish (pipeline running; SLA monitoring pending)
- [x] 20 forecast models trained, evaluated, and serving forecasts (multi-horizon output)
- [ ] Price forecast 1-hr MAE < $15/MWh excluding extreme events (evaluation in progress)
- [x] AI Copilot agent deployed with 14 tools, RAG, and streaming chat UI
- [ ] Agent evaluation > 80% query resolution rate (eval harness built; benchmarking pending)
- [x] Daily AI market summaries auto-generating by 06:00 AEST
- [ ] 3 Genie Spaces live with > 85% benchmark accuracy
- [x] React app (6 pages) deployed on Databricks Apps with FastAPI backend
- [ ] SQL alerts configured for all thresholds (views created; alert objects pending UI config)
- [ ] Dashboard load time < 3 seconds (performance testing pending)
- [x] Lakebase storing user preferences and copilot session history
- [ ] Access control: Databricks Apps SSO + Unity Catalog RBAC (configured; end-to-end verification pending)
- [ ] End-to-end test suite passing
- [ ] Architecture documentation and user guide complete
