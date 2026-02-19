# AUS Energy Copilot — Deployment Guide

## Prerequisites

### Databricks Workspace Requirements

| Requirement | Minimum Version / SKU |
|---|---|
| Databricks Runtime | 15.4 LTS (jobs); 15.4 LTS ML (forecast job) |
| Unity Catalog | Enabled on the metastore |
| Databricks Asset Bundles (DAB) CLI | v0.209.0+ |
| SQL Warehouse | Serverless or Pro tier (for agent SQL tools) |
| Vector Search | Enabled on the workspace |
| Model Serving | Enabled (for MLflow Model Registry with UC) |
| Lakehouse Monitoring | Enabled (for drift detection) |

### Access Scopes Required

The service principal used for deployment needs:

- `CAN MANAGE` on the `energy_copilot` catalog (or equivalent Unity Catalog admin)
- `CAN USE` on the target SQL warehouse
- `CAN USE` on the Vector Search endpoint
- `CREATE MODEL` privilege in `energy_copilot.ml` schema
- Databricks Secrets scope: `energy-copilot-secrets` with the keys listed in the environment variables table below

---

## Step-by-Step Deployment

### Step 1 — Set Environment Variables

Copy `.env.example` to `.env` (for local runs) and export the following in your shell or CI environment:

```bash
export DATABRICKS_HOST=https://<workspace-id>.azuredatabricks.net
export DATABRICKS_TOKEN=<personal-access-token-or-sp-token>
export DATABRICKS_WAREHOUSE_ID=<sql-warehouse-id>
export DATABRICKS_CATALOG=energy_copilot
export ANTHROPIC_API_KEY=<anthropic-api-key>
export LAKEBASE_HOST=<lakebase-postgres-host>
export LAKEBASE_PORT=5432
export LAKEBASE_DB=energy_copilot
export LAKEBASE_USER=<lakebase-user>
export LAKEBASE_PASSWORD=<lakebase-password>
```

Store secrets in a Databricks Secret Scope for production:

```bash
databricks secrets create-scope energy-copilot-secrets
databricks secrets put-secret energy-copilot-secrets ANTHROPIC_API_KEY
databricks secrets put-secret energy-copilot-secrets LAKEBASE_PASSWORD
```

### Step 2 — Run Setup SQL Scripts (00 to 06)

Execute scripts in order from the `setup/` directory. Scripts 00–02 and 05–06 run
against your Databricks SQL warehouse; script 03 requires a Postgres connection to
Lakebase; script 04 uses the Databricks Python SDK.

```bash
# Unity Catalog, schemas, and all Delta tables
databricks sql execute --warehouse-id $DATABRICKS_WAREHOUSE_ID -f setup/00_create_catalog.sql
databricks sql execute --warehouse-id $DATABRICKS_WAREHOUSE_ID -f setup/01_create_schemas.sql
databricks sql execute --warehouse-id $DATABRICKS_WAREHOUSE_ID -f setup/02_create_tables.sql

# Lakebase (Postgres) — run with psql or your Postgres client
psql "$LAKEBASE_CONNECTION_STRING" -f setup/03_setup_lakebase.sql

# Genie Spaces (requires DATABRICKS_HOST + DATABRICKS_TOKEN in env)
python setup/04_create_genie_spaces.py

# Alert views
databricks sql execute --warehouse-id $DATABRICKS_WAREHOUSE_ID -f setup/05_create_alerts.sql

# Unity Catalog SQL functions for the agent
python setup/06_register_uc_functions.py
```

### Step 3 — Load Generator Registry

Downloads the AEMO NEM Registration and Exemption List XLSX and writes
`energy_copilot.gold.generator_registry` and `energy_copilot.gold.region_weather_mapping`
to the Delta tables.

```bash
python setup/load_generator_registry.py
# Or, if running locally with no Spark:
python setup/load_generator_registry.py --local-csv /path/to/nem_registration.csv
# Dry-run to validate without writing:
python setup/load_generator_registry.py --dry-run
```

### Step 4 — Deploy Databricks Bundle

The `databricks.yml` bundle packages all jobs, DLT pipelines, MLflow experiments,
and the Databricks App definition.

```bash
# Deploy to dev target
databricks bundle deploy --target dev

# Deploy to production
databricks bundle deploy --target prod
```

Verify all resources were created:

```bash
databricks bundle run --target prod job_01_nemweb_ingest --no-wait
databricks jobs list | grep energy_copilot
```

### Step 5 — Trigger First Data Ingest

Run ingest pipelines in dependency order to populate Bronze through Gold tables:

```bash
databricks bundle run --target prod job_01_nemweb_ingest
databricks bundle run --target prod job_02_openelec_ingest
databricks bundle run --target prod job_03_weather_ingest
databricks bundle run --target prod job_04_solar_ingest
```

Confirm Gold tables are populated:

```bash
databricks sql execute --warehouse-id $DATABRICKS_WAREHOUSE_ID \
  --statement "SELECT COUNT(*), MAX(settlementdate) FROM energy_copilot.gold.nem_prices_5min"
```

### Step 6 — Index AEMO Documents for RAG

Index AEMO market rules PDFs, constraint XML files, and market notices into the
Vector Search index. Place source documents in the configured blob path or pass
URLs directly.

```bash
python -m agent.rag.index_documents \
  --docs-path /path/to/aemo_docs \
  --warehouse-id $DATABRICKS_WAREHOUSE_ID
```

The script writes chunks to `energy_copilot.gold.aemo_document_chunks` (Delta)
and triggers a sync on `energy_copilot.gold.aemo_docs_vs_index`. Wait for the
index sync to complete (status: `ONLINE`) before starting the app:

```bash
databricks vector-search indexes get-index \
  --endpoint-name energy_copilot_vs \
  --index-name energy_copilot.gold.aemo_docs_vs_index
```

### Step 7 — Train Models

Train all five model types. On Databricks, trigger the training jobs via the bundle;
locally, pass `spark=None` for unit-test/smoke-test mode.

```bash
# Via Databricks bundle (recommended for production)
databricks bundle run --target prod job_train_price_forecast
databricks bundle run --target prod job_train_anomaly_detector

# Smoke-test locally (synthetic data, no Databricks required)
python -c "from models.anomaly_detection.train import train_anomaly_detector; train_anomaly_detector(spark=None)"
```

### Step 8 — Register Models

After training completes, register all models in MLflow Model Registry with the
`production` alias so the forecast pipeline can load them:

```bash
python models/register_all_models.py \
  --databricks-host $DATABRICKS_HOST \
  --databricks-token $DATABRICKS_TOKEN

# Dry-run to validate without writing aliases
python models/register_all_models.py --dry-run
```

### Step 9 — Start the App

Deploy the Databricks App using the bundle (recommended) or start FastAPI locally:

```bash
# Databricks Apps (production)
databricks bundle deploy --target prod
# Then open the Apps URL from the Databricks workspace UI

# Local development
cd app/frontend && npm ci && npm run build && cd ../..
uvicorn app.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABRICKS_HOST` | Yes | Databricks workspace URL, e.g. `https://<id>.azuredatabricks.net` |
| `DATABRICKS_TOKEN` | Yes | PAT or service-principal OAuth token |
| `DATABRICKS_WAREHOUSE_ID` | Yes | SQL warehouse ID for all query endpoints |
| `DATABRICKS_CATALOG` | No | Unity Catalog name (default: `energy_copilot`) |
| `ANTHROPIC_API_KEY` | Yes | API key for Claude (used by agent and market summary pipeline) |
| `LAKEBASE_HOST` | No | Lakebase Postgres host (falls back to mock data if unset) |
| `LAKEBASE_PORT` | No | Postgres port (default: `5432`) |
| `LAKEBASE_DB` | No | Postgres database name (default: `energy_copilot`) |
| `LAKEBASE_USER` | No | Postgres user |
| `LAKEBASE_PASSWORD` | No | Postgres password (store in secret scope) |
| `ALLOW_ORIGINS` | No | CORS allowed origins for the FastAPI backend (default: `*`) |
| `LOG_LEVEL` | No | Logging level for the backend (default: `INFO`) |
| `ENERGY_COPILOT_INTEGRATION_TEST` | No | Set to `1` to enable integration test suite |

---

## Troubleshooting

### Error: `RESOURCE_DOES_NOT_EXIST` on secret scope

```
databricks.sdk.errors.ResourceDoesNotExist: Secret scope 'energy-copilot-secrets' does not exist
```

Create the scope before running the bundle:

```bash
databricks secrets create-scope energy-copilot-secrets
```

### Error: Wrong catalog (`energy_copilot_dev` vs `energy_copilot`)

The bundle uses `${var.catalog}` substitution. Verify the active target:

```bash
databricks bundle validate --target prod
```

Check that `DATABRICKS_CATALOG` is set correctly when running scripts locally.

### Error: Vector Search index not ready

```
VectorSearchClientException: Index is not ONLINE (current status: PROVISIONING)
```

Wait for the index to finish syncing. This can take 5–15 minutes after the first
ingest. Poll the status:

```bash
databricks vector-search indexes get-index \
  --endpoint-name energy_copilot_vs \
  --index-name energy_copilot.gold.aemo_docs_vs_index
```

The RAG tool and agent will function in degraded mode (SQL LIKE fallback) while
the index is provisioning.

### Error: `No module named 'pyspark'` during local tests

This is expected. All pipelines, models, and agent tools degrade gracefully when
PySpark is not installed. Set `ENERGY_COPILOT_INTEGRATION_TEST=0` (the default)
to run only unit tests that do not require a Spark session.

---

## Local Development Quick Start

```bash
# 1. Clone and install dev dependencies
git clone <repo-url> energy-copilot
cd energy-copilot
pip install -r requirements-dev.txt

# 2. Copy environment template
cp app/backend/.env.example app/backend/.env
# Edit app/backend/.env — set at least DATABRICKS_HOST, DATABRICKS_TOKEN, ANTHROPIC_API_KEY

# 3. Run unit tests (no Databricks required)
pytest tests/ -v -k "not integration"

# 4. Start backend (mock data mode when LAKEBASE_HOST unset)
uvicorn app.backend.main:app --reload --port 8000

# 5. Start frontend
cd app/frontend
npm install
npm run dev
# Open http://localhost:5173
```
