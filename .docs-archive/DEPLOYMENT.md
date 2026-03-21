# AUS Energy Copilot — Deployment Guide

This guide walks through deploying the full Energy Copilot platform to a Databricks workspace using Databricks Asset Bundles (DAB). The entire deployment — App, Jobs, Pipelines, Model Serving, and Experiments — is managed declaratively via `databricks.yml` and `resources/*.yml`.

---

## Prerequisites

### Databricks Workspace

| Requirement | Notes |
|---|---|
| Databricks Workspace | Serverless-enabled (AWS, Azure, or GCP) |
| Unity Catalog | Enabled on the metastore |
| SQL Warehouse | At least one warehouse (Serverless Starter is sufficient) |
| Databricks Apps | Enabled on the workspace |
| Lakebase | Provisioned (for sub-10ms serving; optional, falls back to SQL Warehouse) |

### Local Tools

| Tool | Install | Version |
|---|---|---|
| Databricks CLI | `brew tap databricks/tap && brew install databricks` | v0.209.0+ |
| Node.js + npm | `brew install node` | v18+ |
| Python | `brew install python@3.11` | 3.10+ |

---

## Deployment Architecture

The deployment uses Databricks Asset Bundles to manage all resources declaratively:

![Bundle Architecture](images/bundle-architecture.png)

### Bundle File Structure

```
databricks.yml              # Root config: variables, includes, targets
resources/
├── app.yml                 # Databricks App (FastAPI + React + Lakebase)
├── jobs.yml                # 10 serverless jobs
├── pipelines.yml           # 4 serverless DLT pipelines
├── model_serving.yml       # 2 model serving endpoints
└── experiments.yml         # 5 MLflow experiments
```

### Key Design Decisions

- **All serverless**: Every job uses `environment_key` instead of `new_cluster`. No cluster management, no spot instance bidding, no autoscaling configuration.
- **Variables everywhere**: Catalog name, Lakebase instance, warehouse ID, app name — all configurable via bundle variables. Zero hardcoded workspace-specific values.
- **Env vars from bundle**: The App's environment variables (`DATABRICKS_CATALOG`, `LAKEBASE_INSTANCE_NAME`, etc.) are set in `resources/app.yml`, not `app/app.yaml`. The bundle is the single source of truth.
- **Widget-parameterized notebooks**: All pipeline and setup notebooks accept a `catalog` widget parameter, enabling the same notebooks to run against different catalogs in dev vs prod.

---

## Step-by-Step Deployment

### Step 1 — Authenticate

```bash
databricks auth login https://your-workspace.cloud.databricks.com --profile=my-profile
```

Verify authentication:

```bash
databricks current-user me --profile=my-profile
```

### Step 2 — Validate the Bundle

Before deploying, validate that all YAML is correct and all variable references resolve:

```bash
cd energy-copilot
databricks bundle validate --target dev --profile=my-profile
```

Expected output: no errors. Warnings about missing resources (experiments, models) are normal on first deploy.

### Step 3 — Deploy All Resources

```bash
databricks bundle deploy --target dev --profile=my-profile
```

This single command creates/updates:

| Resource | What Happens |
|----------|--------------|
| **14 Jobs** | Creates serverless jobs: setup, ingest (NEMWEB, OpenElec, Weather, Solar, AER tariffs, OpenNEM facilities, CER LGC, AEMO ISP), ML forecast, market summary, data quality, simulator, snapshots |
| **5 MLflow Experiments** | Creates experiment tracking for price, demand, wind, solar, and anomaly models |

**Note:** The App is deployed separately via `databricks apps deploy` (not managed by the bundle). Model Serving endpoints are commented out until models are trained.

Deployment typically takes 2-5 minutes.

### Step 4 — One-Time Setup (Schemas, Tables, Backfill)

```bash
databricks bundle run job_00_setup --target dev --profile=my-profile
```

This job runs 8 tasks (2 sequential, then 6 in parallel):

| Task | Description | Duration |
|------|-------------|----------|
| `create_schemas` | Creates `bronze`, `silver`, `gold`, `ml`, `tools` schemas in the catalog | ~30s |
| `create_tables` | Creates all Delta tables + grants SP permissions (USAGE/SELECT on gold, MODIFY on deal tables) | ~2 min |
| `seed_isp_data` | AEMO ISP 2024 projects, capacity outlook, REZ assessments (seed fallback if API unreachable) | ~1 min |
| `seed_lgc_data` | CER LGC registry + spot prices (seed fallback) | ~1 min |
| `seed_tariff_data` | AER CDR retail tariffs + components (seed fallback) | ~1 min |
| `seed_facility_data` | OpenNEM facility generation timeseries (seed fallback) | ~1 min |
| `seed_deal_data` | 5 counterparties, 3 portfolios, 50 sample trades | ~1 min |
| `backfill` | Generates 90 days of synthetic NEM data (~130K rows across 9 gold tables) | 15-30 min |

Tasks 3-8 run in parallel after `create_tables` completes.

Monitor progress in the Databricks Jobs UI or via CLI:

```bash
databricks jobs get-run <RUN_ID> --profile=my-profile
```

### Step 5 — Post-Deploy Setup

The post-deploy script handles resources that need the App deployed first (chicken-and-egg dependencies):

```bash
./post_deploy.sh my-profile dev
```

This script:

| Step | Description | Duration |
|------|-------------|----------|
| Get App SP UUID | Looks up the Service Principal assigned to the deployed App | ~5s |
| Grant Lakebase Perms | Runs `pipelines/11_grant_lakebase_perms.py` to grant the App SP `SELECT` on Lakebase gold schema | ~2 min |
| Create Synced Tables | Runs `pipelines/12_recreate_synced_tables_continuous.py` to set up continuous Delta-to-Postgres sync | ~3 min |
| Create Genie Spaces | Runs `setup/04_create_genie_spaces.py` to create 6 AI/BI Genie spaces | ~2 min |

### Step 6 — Start the Simulator

```bash
databricks bundle run job_09_simulator --target dev --profile=my-profile
```

The simulator writes fresh NEM market data every 30 seconds to all gold tables. It runs continuously until cancelled.

### Step 7 — Verify

```bash
# Check app health
curl https://<app-url>/health

# Check data source (Lakebase vs SQL Warehouse)
curl https://<app-url>/api/health/datasource

# Check latest prices
curl https://<app-url>/api/prices/latest
```

Expected health response:

```json
{
  "status": "ok",
  "sql_connected": true,
  "lakebase_connected": true,
  "lakebase_fresh": true
}
```

---

## Deployment Flow Diagram

![Deployment Flow](images/deployment-flow.png)

---

## Production Deployment

To deploy to production with a different catalog:

```bash
databricks bundle deploy --target prod --profile=prod-profile \
  --var="notification_email=ops@mycompany.com"
```

The `prod` target uses:
- `mode: production` (no `[dev]` prefixes on resource names)
- `catalog: energy_copilot` (production catalog)
- All other variables can be overridden via `--var=`

---

## Managing the Deployment

### Check Deployed Resources

```bash
# List all bundle resources
databricks bundle summary --target dev --profile=my-profile

# Check app status
databricks apps get energy-copilot --profile=my-profile

# Check job runs
databricks jobs list --profile=my-profile | grep energy-copilot
```

### Update and Redeploy

After making code changes:

```bash
# Rebuild frontend (if UI changed)
cd app/frontend && npx vite build && cd ../..

# Redeploy
databricks bundle deploy --target dev --profile=my-profile
```

The bundle deploy is idempotent — it updates existing resources rather than recreating them.

### Stop the Simulator

```bash
# Find the simulator job ID
databricks jobs list --profile=my-profile | grep "Simulator"

# Cancel all active runs
databricks jobs cancel-all-runs <JOB_ID> --profile=my-profile
```

### Destroy All Resources

```bash
databricks bundle destroy --target dev --profile=my-profile
```

This removes all bundle-managed resources (jobs, pipelines, app, serving endpoints). Data in Unity Catalog tables is preserved.

---

## Data Serving Layers

The app uses a tiered serving architecture for optimal latency:

![Data Serving Layers](images/data-serving-layers.png)

### Lakebase (Primary — 10-38ms)

Gold Delta tables are continuously synced to a managed Postgres instance via Databricks Synced Tables. The FastAPI backend queries Postgres directly via `psycopg3`, bypassing the SQL Warehouse entirely.

Synced tables:
- `gold.nem_prices_5min_dedup_synced`
- `gold.nem_interconnectors_dedup_synced`
- `gold.nem_generation_by_fuel_synced`
- `gold.dashboard_snapshots_synced`
- `gold.asx_futures_eod_synced`
- `gold.emissions_factors_synced`
- `gold.gas_hub_prices_synced`

### SQL Warehouse (Fallback — 400-1000ms)

If Lakebase is unavailable or data is stale (>30 minutes), the app falls back to querying via `databricks-sql-connector`. This path also serves tables that aren't yet synced to Lakebase.

### Dashboard Snapshots (<10ms)

The `job_10_dashboard_snapshots` job (every 5 minutes) pre-computes JSON payloads for dashboard endpoints and stores them in `gold.dashboard_snapshots`. These are synced to Lakebase and served as pre-built responses — no SQL query needed at request time.

### Observability

Every API response includes headers indicating the data source:

| Header | Example | Description |
|--------|---------|-------------|
| `X-Data-Source` | `lakebase` | Which backend served the data |
| `X-Query-Ms` | `12.3` | Query latency in milliseconds |

The `/api/health/datasource` endpoint provides a full breakdown of query counts by source.

---

## Troubleshooting

### `bundle validate` fails with "warehouse not found"

The `warehouse_id` variable uses a lookup: `warehouse: "Serverless Starter Warehouse"`. If your warehouse has a different name, override it:

```bash
databricks bundle deploy --target dev --var="warehouse_id=<your-warehouse-id>"
```

### App shows mock data instead of gold table data

1. Check `/health` — verify `sql_connected: true`
2. Check `/api/health/datasource` — verify queries are hitting real backends
3. Verify the SQL warehouse is running: `databricks warehouses list --profile=my-profile`
4. Check app logs in the Databricks Apps UI

### Lakebase returns stale data

1. Check synced table status in Unity Catalog > Tables > Sync Status
2. Re-run synced table creation: `./post_deploy.sh my-profile dev`
3. Verify the App SP has `SELECT` permissions on the Lakebase gold schema

### Post-deploy script can't find App SP

The `service_principal_id` field is only available after the App is fully deployed. Wait for the app deployment to complete before running `post_deploy.sh`.

### Simulator job fails

Check the job run output in the Databricks UI. Common issues:
- **Table doesn't exist**: Run `job_00_setup` first
- **Permission denied**: The job service principal needs `USAGE` on the catalog and `ALL PRIVILEGES` on the gold schema
- **Timeout**: The simulator runs indefinitely — `timeout_seconds: 0` is expected

### Notebook import fails with "already exists"

The bundle handles this automatically with `--overwrite`. If running manually:

```bash
databricks workspace import /path/to/notebook.py --file=local.py --format=SOURCE --language=PYTHON --overwrite --profile=my-profile
```

---

## Migration from `deploy.sh`

If you previously deployed using the legacy `deploy.sh` script:

1. The bundle deploy creates **new** jobs and pipelines (with `[dev]` prefix in dev mode)
2. Your existing manually-created jobs and the App continue to work
3. After verifying the bundle-deployed resources work correctly, you can delete the old manually-created jobs
4. The App is updated in-place (same name: `energy-copilot`)

The legacy `deploy.sh` script is still available but prints a deprecation warning. Set `FORCE_LEGACY_DEPLOY=1` to bypass:

```bash
FORCE_LEGACY_DEPLOY=1 ./deploy.sh my-profile
```
