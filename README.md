# AUS Energy Copilot

![Python 3.11](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![React 18](https://img.shields.io/badge/React-18-61dafb?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi)
![Databricks](https://img.shields.io/badge/Databricks-Runtime%2015.4-FF3621?logo=databricks)
![Claude Sonnet 4.5](https://img.shields.io/badge/Claude-Sonnet%204.5-8B5CF6?logo=anthropic)
![License MIT](https://img.shields.io/badge/License-MIT-green)

AUS Energy Copilot is an AI-powered Australian National Electricity Market (NEM) intelligence platform deployed on Databricks. It ingests live 5-minute dispatch data from AEMO NEMWEB, OpenElectricity, Open-Meteo, and APVI rooftop solar into a Unity Catalog Medallion lakehouse, trains 21 LightGBM and IsolationForest models for price/demand/wind/solar forecasting and anomaly detection, and surfaces everything through a FastAPI backend and React 18 frontend. An agentic AI copilot backed by Claude Sonnet 4.5 with 13 RAG-enabled tools answers free-form market questions in real time, while Databricks Genie Spaces enable natural-language SQL analytics over the full historical dataset.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUS Energy Copilot                           │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   NEMWEB     │ OpenElec API │  Open-Meteo  │   APVI Rooftop     │
│  (5-min NEM) │  (gen data)  │  (weather)   │   Solar (15-min)   │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Databricks Delta Lake (Unity Catalog)              │
│   Bronze (raw) → Silver (cleaned) → Gold (aggregated+features) │
│   Catalog: energy_copilot | 40 Delta tables | DLT pipelines    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│  ML Models   │ │  AI Agent    │ │   Databricks Genie       │
│ LightGBM ×20 │ │ Claude 4.5   │ │   (NL→SQL analytics)     │
│ IsoForest ×1 │ │ 13 RAG tools │ │                          │
│ MLflow UC    │ │ VS + AEMO    │ │                          │
└──────┬───────┘ └──────┬───────┘ └──────────────────────────┘
       │                │
       ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│              FastAPI Backend (app/backend/main.py)              │
│   /api/prices  /api/forecasts  /api/generation  /api/chat      │
│   /api/alerts  /api/market-summary  /api/system/health         │
│   Rate limiting · SSE streaming · Lakebase (Postgres) sessions │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                React 18 + Vite 5 Frontend                       │
│   Home · LiveMarket · Forecasts · Copilot · Genie               │
│   Alerts · Monitoring                                           │
│   Recharts · Tailwind · React Router v6                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/sourabhghose/databricks-energy-copilot
cd databricks-energy-copilot
pip install -r requirements-dev.txt

# 2. Run backend in mock mode (no Databricks needed)
cd app/backend && uvicorn main:app --reload --port 8000

# 3. Run frontend
cd app/frontend && npm install && npm run dev
# Open http://localhost:5173
```

All endpoints fall through to realistic mock data when `DATABRICKS_HOST` / `LAKEBASE_HOST` are unset, so the full UI is usable for local development without any cloud credentials.

---

## Docker Compose

```bash
cp .env.example .env.local  # fill in secrets
docker-compose up
```

The `docker-compose.yml` starts two services: `backend` (FastAPI on port 8000) and `frontend` (Vite dev server on port 5173). The backend healthcheck (`GET /health`) is used as a `depends_on` condition for the frontend service.

---

## Project Structure

```
energy-copilot/
├── app/
│   ├── backend/           # FastAPI application (main.py, db.py, mock_data.py)
│   ├── frontend/          # React 18 + Vite 5 SPA (7 pages)
│   └── app.yaml           # Databricks Apps deployment config
├── agent/
│   ├── copilot_agent.py   # Mosaic AI Agent (raw Anthropic SDK + LangChain fallback)
│   ├── tools/             # 13 LangChain tools (market data, forecasts, analysis, RAG)
│   ├── rag/               # AEMO document chunking + Vector Search indexer
│   └── evaluation/        # 50-pair eval dataset + LLM-judge harness
├── models/
│   ├── price_forecast/    # LightGBM multi-horizon price forecaster (5 regions)
│   ├── demand_forecast/   # LightGBM demand forecaster
│   ├── wind_forecast/     # LightGBM wind generation forecaster
│   ├── solar_forecast/    # LightGBM solar generation forecaster (night-excluded)
│   └── anomaly_detection/ # IsolationForest + rule-based anomaly detector
├── pipelines/
│   ├── 01_nemweb_ingest.py    # DLT Bronze→Silver→Gold (prices, gen, interconnectors)
│   ├── 05_forecast_pipeline.py # ML inference pipeline (20 models, every 5 min)
│   └── 06_market_summary.py    # Daily market narrative via Claude Sonnet 4.5
├── setup/                 # DDL scripts (40 tables), Genie spaces, UC functions
├── tests/                 # pytest suite (unit + integration)
├── databricks.yml         # Databricks Asset Bundle (6 jobs, 4 DLT pipelines)
├── Makefile               # Developer convenience targets
└── docs/DEPLOYMENT.md     # Step-by-step deployment guide
```

---

## Data Sources

| Source | URL | Refresh | Notes |
|--------|-----|---------|-------|
| **NEMWEB** | `nemweb.com.au/REPORTS/CURRENT/` | 5 min | Primary dispatch data (prices, generation, interconnectors, FCAS); no API key required |
| **OpenElectricity** | `api.openelectricity.org.au/v4` | Hourly | Cleaner REST API; used for historical backfill and cross-validation |
| **Open-Meteo** | `api.open-meteo.com` | Hourly | BOM ACCESS-G gridded NWP (temperature, wind speed, solar irradiance); free for non-commercial use |
| **APVI** | `pv-map.apvi.org.au/api` | 15 min | Rooftop solar generation by postcode aggregated to NEM region |

---

## ML Models

| Model | Regions | Algorithm | MAPE Target | Features |
|-------|---------|-----------|-------------|----------|
| Price Forecast | 5 (NSW1, QLD1, VIC1, SA1, TAS1) | LightGBM | <12% | 30+ features incl FCAS, interconnectors, volatility regime, spike history |
| Demand Forecast | 5 | LightGBM | <3% | Temperature (current + NWP +1h/+4h), time flags, 12-interval demand lags |
| Wind Forecast | 5 | LightGBM | <8% | Wind speed lags 1-12, 4h rolling stats, ramp rate, capacity factor |
| Solar Forecast | 5 | LightGBM | <10% | Sun angle proxy, seasonality sin/cos, cloud proxy, night-interval excluded |
| Anomaly Detection | NEM-wide | IsolationForest + rules | F1 >0.7 | Price/demand rolling mean/std, spike rules (>$5000), negative price (<-$100), regional spread |

All models are registered in MLflow Model Registry (Unity Catalog) under the `energy_copilot.ml` schema with a `production` alias. The forecast inference pipeline (`pipelines/05_forecast_pipeline.py`) loads models via `models:/<name>@production` and writes output to `gold.nem_forecasts_realtime` every 5 minutes.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health check (Databricks + Lakebase connectivity) |
| `GET` | `/api/prices/latest` | Latest 5-min dispatch price for all 5 NEM regions |
| `GET` | `/api/prices/history` | Price history for a region between `start` and `end` timestamps |
| `GET` | `/api/forecasts` | Multi-horizon price forecasts for a region (1h–24h ahead) |
| `GET` | `/api/generation` | Latest generation mix by fuel type for a region |
| `GET` | `/api/interconnectors` | Current interconnector flows and limits |
| `GET` | `/api/fcas` | Latest FCAS service prices (raise/lower, 6-sec to 5-min) |
| `GET` | `/api/alerts` | List user alert configurations |
| `POST` | `/api/alerts` | Create a new alert threshold |
| `DELETE` | `/api/alerts/{id}` | Delete an alert configuration |
| `GET` | `/api/market-summary/latest` | Latest AI-generated daily market narrative |
| `GET` | `/api/system/health` | ML model registry health, counts, and per-model status |
| `POST` | `/api/chat` | SSE-streaming agentic chat (Claude Sonnet 4.5, up to 10 tool rounds) |

All endpoints include TTL-based in-memory caching (10s–3600s depending on endpoint) and fall through to mock data in development mode.

---

## Development

```bash
# Run the full test suite (unit tests only; no live cloud services required)
make test

# Lint and format check
make lint

# Start the backend (mock mode, no Databricks needed)
make backend

# Start the frontend dev server
make frontend
```

Available `make` targets: `test`, `lint`, `format`, `backend`, `frontend`, `docker-up`, `docker-down`, `eval`, `help`.

### Running tests manually

```bash
# From repo root
pytest tests/ -v -k "not integration"

# With coverage
pytest tests/ --cov=app --cov=agent --cov=models -v
```

Integration tests (requiring live Databricks) are gated by the `ENERGY_COPILOT_INTEGRATION_TEST=1` environment variable and are excluded from the standard CI run.

---

## Environment Variables

Copy `app/backend/.env.example` to `app/backend/.env` and fill in values:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABRICKS_HOST` | Yes (prod) | Databricks workspace URL |
| `DATABRICKS_TOKEN` | Yes (prod) | Personal access token or service principal secret |
| `DATABRICKS_WAREHOUSE_ID` | Yes (prod) | SQL warehouse ID for query execution |
| `DATABRICKS_CATALOG` | No | Unity Catalog name (default: `energy_copilot`) |
| `ANTHROPIC_API_KEY` | Yes (chat) | Anthropic API key for Claude Sonnet 4.5 |
| `LAKEBASE_HOST` | No | Lakebase (Postgres) host for user prefs and sessions |
| `LAKEBASE_PASSWORD` | No | Lakebase password |
| `ALLOW_ORIGINS` | No | CORS allowed origins (default: `*`) |
| `RATE_LIMIT_REQUESTS` | No | Max requests per IP per window (default: 60) |

When `DATABRICKS_HOST` and `LAKEBASE_HOST` are absent, all endpoints serve mock data — no cloud credentials are needed for local development or CI.

---

## Sprint Status

- [x] Sprint 0: Foundation — Unity Catalog, Bronze DLT pipelines, 12-month historical backfill, Lakebase Postgres tables
- [x] Sprint 1: Silver/Gold Medallion + Dashboard — cleaned/aggregated layers, Home + Live Market pages, backend rewrite (db.py, mock_data.py)
- [x] Sprint 2: Forecasting Models — 20 LightGBM models (price, demand, wind, solar x 5 regions) + IsolationForest anomaly detector
- [x] Sprint 3: AI Copilot Agent — 14 UC function tools, AEMO RAG Vector Search index, Claude Sonnet 4.5, streaming Chat UI
- [x] Sprint 4: Genie Spaces, Alerts, Databricks Asset Bundle, CI/CD pipeline, Deployment guide
- [x] Sprint 5: Docker Compose, shared pytest fixtures, Home market-summary widget, Alerts page wiring
- [x] Sprint 6: Wind/Solar model depth (Optuna HPO, capacity factor features), CI config quality fixes
- [x] Sprint 7a: Wind + Solar evaluate.py (capacity-weighted bias, ramp accuracy, seasonal MAPE)
- [x] Sprint 7b: Agent eval CI job, production hardening (rate limiting, X-Request-ID), extended market summary fields
- [x] Sprint 7c: Demand evaluate.py, LiveMarket spike indicator, Forecasts confidence band
- [x] Sprint 8a: Price + Anomaly evaluate.py depth (per-horizon MAE, spike recall, per-event-type F1)
- [x] Sprint 8b: Forecast + Market Summary pipelines rewrite (production inference, narrative quality checks)
- [x] Sprint 8c: System Monitoring frontend — /api/system/health endpoint, Monitoring page (21-model grid, infra cards)
- [x] Sprint 9a: README rewrite (full architecture, ML table, API table, sprint checklist), Sprint 8 endpoint tests

---

## Deployment

Full step-by-step deployment instructions are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

The high-level deployment sequence:

1. Run setup SQL scripts (`setup/00_*` through `setup/06_*`) to provision Unity Catalog, Delta tables, Lakebase, Genie Spaces, and UC function tools.
2. Deploy the Databricks Asset Bundle: `databricks bundle deploy --target prod`
3. Start the 6 scheduled jobs (NEMWEB ingest, OpenElectricity, weather, solar, forecast pipeline, market summary).
4. Deploy the React frontend + FastAPI backend as a Databricks App: `databricks bundle run deploy_app`.

---

## License

MIT — see [LICENSE](LICENSE).
