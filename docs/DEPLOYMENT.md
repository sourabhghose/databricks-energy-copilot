# AUS Energy Copilot — Deployment Guide

## Prerequisites

### Databricks Workspace

| Requirement | Notes |
|---|---|
| Databricks Workspace | Serverless-enabled (FEVM or One-Env) |
| Unity Catalog | Enabled on the metastore; `energy_copilot_catalog` will be used |
| SQL Warehouse | At least one warehouse (Serverless Starter is sufficient) |
| Databricks CLI | v0.209.0+ installed and authenticated |
| Databricks Apps | Enabled on the workspace |

### Local Tools

| Tool | Install |
|---|---|
| Databricks CLI | `brew tap databricks/tap && brew install databricks` |
| Node.js + npm | `brew install node` (for frontend build) |
| Python 3.10+ | Required for local development |

---

## Automated Deployment (Recommended)

The `deploy.sh` script handles the entire deployment in a single command:

```bash
# 1. Authenticate with your Databricks workspace
databricks auth login https://your-workspace.cloud.databricks.com --profile=my-profile

# 2. Deploy everything
./deploy.sh my-profile
```

### What `deploy.sh` does

| Step | Description | Duration |
|------|-------------|----------|
| 1. Create schemas | Creates `bronze`, `silver`, `gold`, `ml`, `tools` in `energy_copilot_catalog` | ~30s |
| 2. Create tables | Creates 4 bronze + 5 silver + 13 gold Delta tables with auto-optimize | ~2 min |
| 3. Upload notebooks | Uploads simulator and backfill notebooks to workspace | ~10s |
| 4. Historical backfill | Runs 90-day backfill job (waits for completion, prints row count progress) | 15–30 min |
| 5. Start simulator | Creates and starts the live simulator job (writes every 30s) | ~30s |
| 6. Deploy app | Builds frontend, uploads files, deploys Databricks App | 5–10 min |

The script is **idempotent** — safe to re-run at any time. It uses `CREATE IF NOT EXISTS` for all tables, finds existing jobs by name, and the backfill notebook skips if historical data already exists (>50K rows).

### Output

When complete, the script prints:

```
============================================================
 Deployment Complete!
============================================================
 App URL:       https://energy-copilot-XXXXX.aws.databricksapps.com
 Simulator Job: 123456789 (running)
 Backfill Job:  987654321
 Catalog:       energy_copilot_catalog
 Profile:       my-profile
============================================================
```

### Managing the Simulator

```bash
# Check if simulator is running
databricks jobs list-runs --job-id=<SIM_JOB_ID> --active-only --profile=my-profile

# Stop the simulator
databricks jobs cancel-all-runs <SIM_JOB_ID> --profile=my-profile

# Restart the simulator
databricks jobs run-now <SIM_JOB_ID> --profile=my-profile
```

---

## Manual Deployment

If you prefer to run each step individually:

### Step 1 — Authenticate

```bash
databricks auth login https://your-workspace.cloud.databricks.com --profile=my-profile
```

### Step 2 — Create Schemas and Tables

The deploy script creates tables via the SQL Statements API. To do this manually, run each DDL statement against your SQL warehouse:

```bash
# Create schemas
for schema in bronze silver gold ml tools; do
  databricks api post /api/2.0/sql/statements/ \
    --json='{"statement": "CREATE SCHEMA IF NOT EXISTS energy_copilot_catalog.'$schema'", "warehouse_id": "<WH_ID>", "wait_timeout": "50s"}' \
    --profile=my-profile
done
```

For the full table DDL, see `setup/02_create_tables.sql` or review the table creation section in `deploy.sh`.

### Step 3 — Upload Notebooks

```bash
WS_BASE="/Workspace/Users/<your-email>/energy-copilot"

databricks workspace mkdirs "$WS_BASE/setup" --profile=my-profile

databricks workspace import "$WS_BASE/setup/10_nem_simulator.py" \
  --file=setup/10_nem_simulator.py --format=SOURCE --language=PYTHON --overwrite \
  --profile=my-profile

databricks workspace import "$WS_BASE/setup/11_historical_backfill.py" \
  --file=setup/11_historical_backfill.py --format=SOURCE --language=PYTHON --overwrite \
  --profile=my-profile
```

### Step 4 — Run Historical Backfill

Create a job and run it:

```bash
JOB_ID=$(databricks jobs create --json='{
  "name": "NEM Historical Backfill (90 days)",
  "tasks": [{
    "task_key": "backfill",
    "notebook_task": {
      "notebook_path": "'$WS_BASE'/setup/11_historical_backfill.py",
      "source": "WORKSPACE"
    },
    "environment_key": "default"
  }],
  "environments": [{"environment_key": "default", "spec": {"client": "1"}}],
  "max_concurrent_runs": 1
}' --profile=my-profile | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")

databricks jobs run-now $JOB_ID --profile=my-profile
```

Monitor progress by checking row counts:

```bash
databricks api post /api/2.0/sql/statements/ \
  --json='{"statement": "SELECT COUNT(*), COUNT(DISTINCT CAST(interval_datetime AS DATE)) FROM energy_copilot_catalog.gold.nem_prices_5min", "warehouse_id": "<WH_ID>", "wait_timeout": "30s"}' \
  --profile=my-profile
```

Expected final state: ~130K rows across 90 distinct dates.

### Step 5 — Start the Simulator

```bash
SIM_JOB_ID=$(databricks jobs create --json='{
  "name": "NEM Market Data Simulator",
  "tasks": [{
    "task_key": "nem_simulator",
    "notebook_task": {
      "notebook_path": "'$WS_BASE'/setup/10_nem_simulator.py",
      "source": "WORKSPACE"
    },
    "environment_key": "default"
  }],
  "environments": [{"environment_key": "default", "spec": {"client": "1"}}],
  "max_concurrent_runs": 1
}' --profile=my-profile | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")

databricks jobs run-now $SIM_JOB_ID --profile=my-profile
```

The simulator runs indefinitely, writing to 9 gold tables every 30 seconds.

### Step 6 — Deploy the App

```bash
WS_BASE="/Workspace/Users/<your-email>/energy-copilot"

# Build frontend
cd app/frontend && npm install && npm run build && cd ../..

# Upload app files
databricks workspace import "$WS_BASE/main.py" --file=app/main.py --format=AUTO --language=PYTHON --overwrite --profile=my-profile
databricks workspace import "$WS_BASE/requirements.txt" --file=app/requirements.txt --format=AUTO --overwrite --profile=my-profile
databricks workspace import "$WS_BASE/app.yaml" --file=app/app.yaml --format=AUTO --overwrite --profile=my-profile
databricks workspace import-dir app/frontend/dist "$WS_BASE/frontend/dist" --overwrite --profile=my-profile

# Deploy
databricks apps deploy energy-copilot --source-code-path="$WS_BASE" --profile=my-profile
```

---

## Data Architecture

### Medallion Layers

```
Bronze (raw)  →  Silver (cleaned)  →  Gold (analytics-ready)
4 tables          5 tables              13 tables
```

### Gold Tables (queried by the API)

| Table | Rows per Day | Description |
|-------|-------------|-------------|
| `nem_prices_5min` | 1,440 (5 regions × 288) | 5-minute spot prices by region |
| `nem_generation_by_fuel` | ~10,080 | Generation by fuel type, region, interval |
| `nem_interconnectors` | 1,440 | Interconnector flows (5 links × 288) |
| `demand_actuals` | 1,440 | Demand and rooftop solar by region |
| `weather_nem_regions` | 1,440 | Temperature, wind, solar radiation |
| `anomaly_events` | Variable | Price spikes and negative price events |
| `price_forecasts` | ~720 | 3-horizon forecasts (every 30 min) |
| `demand_forecasts` | ~720 | 3-horizon demand forecasts |
| `nem_daily_summary` | 5 | Daily summary per region |

### Simulator Details

The simulator (`setup/10_nem_simulator.py`) generates realistic NEM market data:

- **Diurnal demand** — peaks at 8am and 6pm, troughs at 3am
- **Solar generation** — follows sun position, zero at night, peak at noon
- **Wind generation** — variable with semi-random patterns
- **Coal/gas baseload** — steady output with small variation
- **Battery storage** — charges during solar surplus, discharges during evening peak
- **Price-demand correlation** — prices rise with demand and fall with surplus generation
- **Interconnector flows** — proportional to price differentials between regions
- **Weather** — temperature, wind speed, solar radiation with diurnal cycles
- **Anomalies** — occasional price spikes (>$300/MWh) and negative prices during solar surplus

---

## API Architecture

The FastAPI backend (`app/main.py`) queries gold tables via `databricks-sql-connector`:

1. On startup, the app lazily creates a SQL connection using the Databricks SDK for auth
2. Each endpoint first queries the gold table with a 25-second TTL cache
3. If the SQL connection fails or returns no data, endpoints fall back to mock data
4. The `/api/chat` endpoint gathers data from multiple endpoints to build LLM context
5. Chat uses the Databricks Foundation Model API (`databricks-claude-sonnet-4-6`)

### Authentication

When deployed as a Databricks App:
- The Databricks SDK handles OAuth automatically — no tokens or environment variables needed
- The SQL warehouse is auto-discovered from the workspace
- Users authenticate via the workspace's SSO when accessing the app URL

For local development:
- No auth needed — all endpoints serve mock data
- To connect to a real workspace locally, set `DATABRICKS_HOST` and `DATABRICKS_TOKEN`

---

## Troubleshooting

### Backfill completes too quickly (skipped)

The backfill has an idempotency check — if >50K historical rows already exist, it skips. To force a re-run:

```sql
-- Check current row count
SELECT COUNT(*) FROM energy_copilot_catalog.gold.nem_prices_5min
  WHERE interval_datetime < current_timestamp() - INTERVAL 2 DAYS;
```

If you need to regenerate, truncate the tables first:

```sql
TRUNCATE TABLE energy_copilot_catalog.gold.nem_prices_5min;
-- Repeat for other gold tables
```

### App shows mock data instead of gold table data

Check the `/health` endpoint:

```bash
curl -H "Authorization: Bearer <token>" https://<app-url>/health
```

If `sql_connected: false`:
1. Verify a SQL warehouse exists and is running
2. Check the app logs in the Databricks Apps UI for connection errors
3. Ensure `databricks-sql-connector` is in `requirements.txt`

### Simulator job fails with "serverless compute not supported"

The job must use `environment_key` instead of `new_cluster`. The deploy script handles this, but if creating manually, use:

```json
{
  "environments": [{"environment_key": "default", "spec": {"client": "1"}}]
}
```

### Notebook import fails with "already exists"

Use the `--overwrite` flag:

```bash
databricks workspace import /path/to/notebook.py --file=local.py --format=SOURCE --language=PYTHON --overwrite --profile=my-profile
```
