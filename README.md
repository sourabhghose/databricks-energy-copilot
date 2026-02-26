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

### One-command deploy to Databricks

```bash
# 1. Authenticate with your Databricks workspace
databricks auth login <workspace-url> --profile=fe-vm-energy-copilot

# 2. Deploy everything (tables, data, simulator, app)
./deploy.sh fe-vm-energy-copilot
```

This single command:
1. Creates the Unity Catalog schemas and all 26 Delta tables
2. Uploads simulator and backfill notebooks to the workspace
3. Runs a 90-day historical data backfill (~130K price rows across 9 gold tables)
4. Starts the live NEM simulator (writes fresh data every 30 seconds)
5. Builds the React frontend and deploys the Databricks App

### Local development

```bash
# Run backend in mock mode (no Databricks needed)
cd app && uvicorn main:app --reload --port 8000

# Run frontend
cd app/frontend && npm install && npm run dev
# Open http://localhost:5173
```

All endpoints fall through to realistic mock data when running locally outside Databricks, so the full UI is usable for development without any cloud credentials.

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
├── deploy.sh              # One-command deploy (tables + data + simulator + app)
├── app/
│   ├── main.py            # FastAPI backend (queries gold tables via databricks-sql-connector)
│   ├── frontend/          # React 18 + Vite 5 SPA (10 dashboard pages)
│   ├── requirements.txt   # Python dependencies
│   └── app.yaml           # Databricks Apps deployment config
├── setup/
│   ├── 00_create_catalog.sql   # Unity Catalog DDL
│   ├── 01_create_schemas.sql   # Schema definitions
│   ├── 02_create_tables.sql    # Full table DDL (bronze/silver/gold)
│   ├── 10_nem_simulator.py     # Live data simulator (writes every 30s)
│   └── 11_historical_backfill.py # 90-day historical data generator
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
├── tests/                 # pytest suite (unit + integration)
├── databricks.yml         # Databricks Asset Bundle (6 jobs, 4 DLT pipelines)
├── Makefile               # Developer convenience targets
└── docs/DEPLOYMENT.md     # Step-by-step deployment guide
```

---

## Data Pipeline

### Simulated Mode (default)

The deploy script provisions a **NEM Market Data Simulator** that generates realistic 5-minute dispatch data for all 5 NEM regions. No external API keys or live data feeds are required.

| Component | Description |
|-----------|-------------|
| **Historical Backfill** | `setup/11_historical_backfill.py` — Generates 90 days of historical data across 9 gold tables on first deploy |
| **Live Simulator** | `setup/10_nem_simulator.py` — Runs as a Databricks Job, writing fresh data every 30 seconds |

The simulator models realistic patterns: diurnal demand curves, solar peak at midday, wind variability, coal baseload, gas peaking, battery charge/discharge cycles, interconnector flows, and occasional price spikes.

### Gold Tables

| Table | Description | Update Frequency |
|-------|-------------|------------------|
| `nem_prices_5min` | Spot prices by region | Every 30s |
| `nem_generation_by_fuel` | Generation mix (7 fuel types × 5 regions) | Every 30s |
| `nem_interconnectors` | Interconnector flows (5 links) | Every 30s |
| `demand_actuals` | Demand and rooftop solar | Every 30s |
| `weather_nem_regions` | Temperature, wind, solar radiation | Every 30s |
| `anomaly_events` | Price spikes and negative price events | On occurrence |
| `price_forecasts` | 3-horizon price forecasts | Every 5 min |
| `demand_forecasts` | 3-horizon demand forecasts | Every 5 min |
| `nem_daily_summary` | Daily regional summaries | Daily |

### Live Data Sources (optional)

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

Key endpoints wired to Unity Catalog gold tables (with mock fallback):

| Method | Path | Gold Table | Description |
|--------|------|------------|-------------|
| `GET` | `/health` | — | Service health, SQL connection status |
| `GET` | `/api/prices/latest` | `nem_prices_5min` | Latest spot prices for all 5 NEM regions with trend indicators |
| `GET` | `/api/prices/history` | `nem_prices_5min` | 24h of 5-minute price points for a region |
| `GET` | `/api/prices/volatility` | `nem_prices_5min` | 24h volatility metrics (avg, stddev, min, max, spike count) |
| `GET` | `/api/prices/spikes` | `anomaly_events` | Recent price spike events |
| `GET` | `/api/generation` | `nem_generation_by_fuel` | Generation mix time series (24h, by fuel type) |
| `GET` | `/api/generation/mix` | `nem_generation_by_fuel` | Current generation mix percentages and renewable share |
| `GET` | `/api/interconnectors` | `nem_interconnectors` | Interconnector flows, limits, and congestion |
| `GET` | `/api/forecasts` | `price_forecasts` | Multi-horizon price forecasts with confidence intervals |
| `GET` | `/api/market-summary/latest` | `daily_market_summary` | AI-generated market narrative |
| `POST` | `/api/chat` | All (via context) | SSE-streaming copilot chat (Claude Sonnet 4.6 via Databricks Foundation Model API) |

All endpoints include 25-second TTL caching (aligned to the 30-second simulator cadence) and automatically fall through to mock data when the SQL connection is unavailable.

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

When deployed as a Databricks App, authentication is handled automatically via the Databricks SDK — no manual tokens or environment variables required. The app auto-discovers the workspace host, authenticates via OAuth, and finds the SQL warehouse.

For local development, no environment variables are needed — all endpoints serve mock data automatically.

| Variable | Required | Description |
|----------|----------|-------------|
| `ALLOW_ORIGINS` | No | CORS allowed origins (default: `*`) |
| `RATE_LIMIT_REQUESTS` | No | Max requests per IP per window (default: 60) |
| `LOG_LEVEL` | No | Logging level (default: `INFO`) |

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

### Automated (recommended)

```bash
./deploy.sh <databricks-cli-profile>
```

The deploy script handles the full sequence:

1. **Create schemas** — `bronze`, `silver`, `gold`, `ml`, `tools` in `energy_copilot_catalog`
2. **Create tables** — 4 bronze + 5 silver + 13 gold Delta tables with auto-optimize
3. **Upload notebooks** — simulator and backfill to workspace
4. **Run historical backfill** — 90-day backfill (waits for completion, prints progress)
5. **Start live simulator** — creates a Databricks Job that writes data every 30 seconds
6. **Deploy app** — builds frontend, uploads to workspace, deploys as a Databricks App

The script is idempotent — safe to re-run. It finds existing jobs, uses `CREATE IF NOT EXISTS` for tables, and the backfill skips if data already exists.

### Manual

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for step-by-step manual instructions.

---

## License

MIT — see [LICENSE](LICENSE).
