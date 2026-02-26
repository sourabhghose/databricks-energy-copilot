#!/bin/bash
# ============================================================
# Energy Copilot — One-Command Deploy
# ============================================================
# Usage:  ./deploy.sh [PROFILE]
#
# Deploys everything to a Databricks workspace:
#   1. Creates catalog, schemas, and tables
#   2. Uploads notebooks (simulator + backfill)
#   3. Runs historical backfill (90 days)
#   4. Creates & starts the live simulator job
#   5. Builds frontend & deploys the Databricks App
#
# Prerequisites:
#   - databricks CLI authenticated (profile passed or fe-vm-energy-copilot)
#   - Node.js / npm (for frontend build)
# ============================================================

set -euo pipefail

PROFILE="${1:-fe-vm-energy-copilot}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"
SETUP_DIR="$SCRIPT_DIR/setup"
CATALOG="energy_copilot_catalog"

# Derive workspace user and paths
USER_EMAIL=$(databricks current-user me --profile="$PROFILE" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['userName'])" 2>/dev/null || echo "")
if [ -z "$USER_EMAIL" ]; then
    echo "ERROR: Cannot determine user email. Is the profile '$PROFILE' authenticated?"
    echo "  Run: databricks auth login <workspace-url> --profile=$PROFILE"
    exit 1
fi
WS_BASE="/Workspace/Users/$USER_EMAIL/energy-copilot"

echo "============================================================"
echo " Energy Copilot Deploy"
echo "============================================================"
echo " Profile:    $PROFILE"
echo " User:       $USER_EMAIL"
echo " Workspace:  $WS_BASE"
echo "============================================================"
echo ""

# -----------------------------------------------------------
# Helper: run a SQL statement via the SQL Statements API
# -----------------------------------------------------------
WH_ID=""

find_warehouse() {
    if [ -n "$WH_ID" ]; then return; fi
    WH_ID=$(databricks warehouses list --profile="$PROFILE" 2>/dev/null \
        | awk 'NR>1 {print $1; exit}')
    if [ -z "$WH_ID" ]; then
        echo "ERROR: No SQL warehouse found. Please create one in the workspace."
        exit 1
    fi
    echo "Using warehouse: $WH_ID"
}

run_sql() {
    local desc="$1"
    local sql="$2"
    find_warehouse
    local result
    result=$(databricks api post /api/2.0/sql/statements/ \
        --json="{\"statement\": \"$sql\", \"warehouse_id\": \"$WH_ID\", \"format\":\"JSON_ARRAY\", \"wait_timeout\":\"50s\"}" \
        --profile="$PROFILE" 2>&1)
    local state
    state=$(echo "$result" | grep -o '"state":"[^"]*"' | head -1)
    if echo "$state" | grep -q "SUCCEEDED"; then
        echo "  OK: $desc"
    else
        local msg
        msg=$(echo "$result" | grep -o '"message":"[^"]*"' | head -1)
        echo "  WARN: $desc — $state $msg"
    fi
}

# -----------------------------------------------------------
# Step 1: Create schemas
# -----------------------------------------------------------
echo "Step 1/6: Creating schemas..."
for schema in bronze silver gold ml tools; do
    run_sql "schema $schema" "CREATE SCHEMA IF NOT EXISTS $CATALOG.$schema"
done
echo ""

# -----------------------------------------------------------
# Step 2: Create tables
# -----------------------------------------------------------
echo "Step 2/6: Creating tables..."

# Bronze tables
run_sql "bronze.nemweb_dispatch_price" "CREATE TABLE IF NOT EXISTS $CATALOG.bronze.nemweb_dispatch_price (_source_file STRING, _ingested_at TIMESTAMP, settlement_date STRING, run_no STRING, regionid STRING, rrp STRING, intervention STRING, lastchanged STRING) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "bronze.nemweb_dispatch_gen" "CREATE TABLE IF NOT EXISTS $CATALOG.bronze.nemweb_dispatch_gen (_source_file STRING, _ingested_at TIMESTAMP, settlement_date STRING, run_no STRING, duid STRING, intervention STRING, initialmw STRING, totalcleared STRING, lastchanged STRING) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "bronze.nemweb_dispatch_inter" "CREATE TABLE IF NOT EXISTS $CATALOG.bronze.nemweb_dispatch_inter (_source_file STRING, _ingested_at TIMESTAMP, settlement_date STRING, run_no STRING, interconnectorid STRING, meteredmwflow STRING, mwflow STRING, exportlimit STRING, importlimit STRING, lastchanged STRING) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "bronze.weather_raw" "CREATE TABLE IF NOT EXISTS $CATALOG.bronze.weather_raw (_ingested_at TIMESTAMP, nem_region STRING, forecast_datetime STRING, temperature_2m_c DOUBLE, wind_speed_100m_kmh DOUBLE, solar_radiation_wm2 DOUBLE, cloud_cover_pct DOUBLE) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"

# Silver tables
run_sql "silver.dispatch_prices" "CREATE TABLE IF NOT EXISTS $CATALOG.silver.dispatch_prices (interval_datetime TIMESTAMP, region_id STRING, rrp DOUBLE, total_demand_mw DOUBLE, available_gen_mw DOUBLE, net_interchange_mw DOUBLE, run_no INT, _processed_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "silver.dispatch_generation" "CREATE TABLE IF NOT EXISTS $CATALOG.silver.dispatch_generation (interval_datetime TIMESTAMP, duid STRING, region_id STRING, fuel_type STRING, initial_mw DOUBLE, total_cleared_mw DOUBLE, run_no INT, _processed_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "silver.dispatch_interconnectors" "CREATE TABLE IF NOT EXISTS $CATALOG.silver.dispatch_interconnectors (interval_datetime TIMESTAMP, interconnector_id STRING, metered_mw_flow DOUBLE, mw_flow DOUBLE, export_limit_mw DOUBLE, import_limit_mw DOUBLE, run_no INT, _processed_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "silver.generator_registry" "CREATE TABLE IF NOT EXISTS $CATALOG.silver.generator_registry (duid STRING, station_name STRING, region_id STRING, fuel_type STRING, registered_capacity_mw DOUBLE, max_capacity_mw DOUBLE, is_active BOOLEAN, _last_updated TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true')"
run_sql "silver.generation_by_fuel" "CREATE TABLE IF NOT EXISTS $CATALOG.silver.generation_by_fuel (interval_datetime TIMESTAMP, region_id STRING, fuel_type STRING, total_cleared_mw DOUBLE, unit_count INT, capacity_factor DOUBLE, _processed_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"

# Gold tables
run_sql "gold.nem_prices_5min" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.nem_prices_5min (interval_datetime TIMESTAMP NOT NULL, region_id STRING NOT NULL, rrp DOUBLE NOT NULL, rop DOUBLE, total_demand_mw DOUBLE, available_gen_mw DOUBLE, net_interchange_mw DOUBLE, intervention BOOLEAN, apc_flag BOOLEAN, market_suspended BOOLEAN, _updated_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "gold.nem_prices_30min" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.nem_prices_30min (interval_datetime TIMESTAMP NOT NULL, region_id STRING NOT NULL, rrp DOUBLE NOT NULL, rrp_min DOUBLE, rrp_max DOUBLE, rrp_stddev DOUBLE, spike_count INT, total_demand_mw DOUBLE, net_interchange_mw DOUBLE, _updated_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "gold.nem_generation_by_fuel" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.nem_generation_by_fuel (interval_datetime TIMESTAMP NOT NULL, region_id STRING NOT NULL, fuel_type STRING NOT NULL, total_mw DOUBLE, unit_count INT, capacity_factor DOUBLE, emissions_tco2e DOUBLE, emissions_intensity DOUBLE, _updated_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "gold.nem_interconnectors" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.nem_interconnectors (interval_datetime TIMESTAMP NOT NULL, interconnector_id STRING NOT NULL, from_region STRING, to_region STRING, mw_flow DOUBLE, mw_losses DOUBLE, export_limit_mw DOUBLE, import_limit_mw DOUBLE, utilization_pct DOUBLE, is_congested BOOLEAN, marginal_value DOUBLE, _updated_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "gold.demand_actuals" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.demand_actuals (interval_datetime TIMESTAMP NOT NULL, region_id STRING NOT NULL, total_demand_mw DOUBLE, scheduled_demand_mw DOUBLE, net_demand_mw DOUBLE, solar_rooftop_mw DOUBLE, temperature_c DOUBLE, is_peak BOOLEAN, _updated_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "gold.price_forecasts" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.price_forecasts (forecast_run_at TIMESTAMP NOT NULL, interval_datetime TIMESTAMP NOT NULL, region_id STRING NOT NULL, horizon_intervals INT NOT NULL, predicted_rrp DOUBLE, prediction_lower_80 DOUBLE, prediction_upper_80 DOUBLE, spike_probability DOUBLE, model_version STRING, model_name STRING, _updated_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "gold.demand_forecasts" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.demand_forecasts (forecast_run_at TIMESTAMP NOT NULL, interval_datetime TIMESTAMP NOT NULL, region_id STRING NOT NULL, horizon_intervals INT NOT NULL, predicted_demand_mw DOUBLE, prediction_lower_80 DOUBLE, prediction_upper_80 DOUBLE, model_version STRING, model_name STRING, _updated_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "gold.nem_daily_summary" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.nem_daily_summary (trading_date DATE NOT NULL, region_id STRING NOT NULL, avg_price_aud_mwh DOUBLE, min_price_aud_mwh DOUBLE, max_price_aud_mwh DOUBLE, price_spike_count INT, price_negative_count INT, avg_demand_mw DOUBLE, peak_demand_mw DOUBLE, total_energy_gwh DOUBLE, coal_pct DOUBLE, gas_pct DOUBLE, wind_pct DOUBLE, solar_utility_pct DOUBLE, solar_rooftop_pct DOUBLE, hydro_pct DOUBLE, battery_pct DOUBLE, renewables_pct DOUBLE, avg_emissions_intensity DOUBLE, _updated_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "gold.anomaly_events" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.anomaly_events (event_id STRING NOT NULL, detected_at TIMESTAMP NOT NULL, interval_datetime TIMESTAMP, region_id STRING, event_type STRING, severity STRING, metric_value DOUBLE, threshold_value DOUBLE, description STRING, is_resolved BOOLEAN, resolved_at TIMESTAMP, alert_fired BOOLEAN, _created_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "gold.daily_market_summary" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.daily_market_summary (trading_date DATE NOT NULL, region_id STRING NOT NULL, summary_text STRING, key_events ARRAY<STRING>, avg_price_aud_mwh DOUBLE, max_price_aud_mwh DOUBLE, price_spike_count INT, renewables_pct DOUBLE, generated_at TIMESTAMP, model_used STRING, _updated_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "gold.weather_nem_regions" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.weather_nem_regions (forecast_datetime TIMESTAMP NOT NULL, api_call_datetime TIMESTAMP, nem_region STRING NOT NULL, is_historical BOOLEAN, temperature_c DOUBLE, apparent_temp_c DOUBLE, max_temp_c DOUBLE, wind_speed_100m_kmh DOUBLE, solar_radiation_wm2 DOUBLE, cloud_cover_pct DOUBLE, heating_degree_days DOUBLE, cooling_degree_days DOUBLE, _updated_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "gold.nem_constraints_active" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.nem_constraints_active (interval_datetime TIMESTAMP NOT NULL, constraint_id STRING NOT NULL, marginal_value DOUBLE, violation_degree DOUBLE, rhs DOUBLE, constraint_type STRING, _updated_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
run_sql "gold.generation_forecasts" "CREATE TABLE IF NOT EXISTS $CATALOG.gold.generation_forecasts (forecast_run_at TIMESTAMP NOT NULL, interval_datetime TIMESTAMP NOT NULL, region_id STRING NOT NULL, fuel_type STRING NOT NULL, horizon_intervals INT NOT NULL, predicted_mw DOUBLE, prediction_lower_80 DOUBLE, prediction_upper_80 DOUBLE, model_version STRING, model_name STRING, _updated_at TIMESTAMP) USING DELTA TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true', 'delta.autoOptimize.autoCompact' = 'true')"
echo ""

# -----------------------------------------------------------
# Step 3: Upload notebooks
# -----------------------------------------------------------
echo "Step 3/6: Uploading notebooks..."
databricks workspace mkdirs "$WS_BASE/setup" --profile="$PROFILE" 2>/dev/null || true

for nb in 10_nem_simulator.py 11_historical_backfill.py; do
    databricks workspace import "$WS_BASE/setup/$nb" \
        --file="$SETUP_DIR/$nb" \
        --format=SOURCE --language=PYTHON --overwrite \
        --profile="$PROFILE" 2>&1
    echo "  Uploaded: $WS_BASE/setup/$nb"
done
echo ""

# -----------------------------------------------------------
# Step 4: Run historical backfill
# -----------------------------------------------------------
echo "Step 4/6: Running historical backfill (90 days)..."
echo "  This populates gold tables with simulated historical data."
echo "  The notebook is idempotent — if data already exists it skips."

# Create or find the backfill job
BACKFILL_JOB_ID=$(databricks jobs list --profile="$PROFILE" 2>/dev/null \
    | grep "NEM Historical Backfill" | awk '{print $1}')

if [ -z "$BACKFILL_JOB_ID" ]; then
    BACKFILL_JOB_ID=$(databricks jobs create --json="{
        \"name\": \"NEM Historical Backfill (90 days)\",
        \"tasks\": [{
            \"task_key\": \"backfill\",
            \"notebook_task\": {
                \"notebook_path\": \"$WS_BASE/setup/11_historical_backfill.py\",
                \"source\": \"WORKSPACE\"
            },
            \"environment_key\": \"default\"
        }],
        \"environments\": [{
            \"environment_key\": \"default\",
            \"spec\": { \"client\": \"1\" }
        }],
        \"max_concurrent_runs\": 1,
        \"timeout_seconds\": 0
    }" --profile="$PROFILE" 2>&1 | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
    echo "  Created backfill job: $BACKFILL_JOB_ID"
else
    echo "  Found existing backfill job: $BACKFILL_JOB_ID"
fi

# Run the backfill and wait for completion
BACKFILL_RUN=$(databricks jobs run-now "$BACKFILL_JOB_ID" --profile="$PROFILE" 2>&1 \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['run_id'])")
echo "  Backfill run started: $BACKFILL_RUN"
echo "  Waiting for completion (this may take 10-30 minutes)..."

while true; do
    STATE=$(databricks jobs get-run "$BACKFILL_RUN" --profile="$PROFILE" 2>&1 \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['state']['life_cycle_state'])")
    if [ "$STATE" = "TERMINATED" ] || [ "$STATE" = "INTERNAL_ERROR" ] || [ "$STATE" = "SKIPPED" ]; then
        RESULT=$(databricks jobs get-run "$BACKFILL_RUN" --profile="$PROFILE" 2>&1 \
            | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['state'].get('result_state','UNKNOWN'))")
        echo "  Backfill finished: $RESULT"
        break
    fi
    # Print progress: count rows in gold table
    CNT=$(databricks api post /api/2.0/sql/statements/ \
        --json="{\"statement\": \"SELECT COUNT(*) FROM $CATALOG.gold.nem_prices_5min\", \"warehouse_id\": \"$WH_ID\", \"format\":\"JSON_ARRAY\", \"wait_timeout\":\"10s\"}" \
        --profile="$PROFILE" 2>/dev/null \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('data_array',[[0]])[0][0])" 2>/dev/null || echo "?")
    echo "  [$STATE] nem_prices_5min rows: $CNT"
    sleep 30
done
echo ""

# -----------------------------------------------------------
# Step 5: Create & start simulator job
# -----------------------------------------------------------
echo "Step 5/6: Starting live simulator (writes every 30s)..."

SIM_JOB_ID=$(databricks jobs list --profile="$PROFILE" 2>/dev/null \
    | grep "NEM Market Data Simulator" | awk '{print $1}')

if [ -z "$SIM_JOB_ID" ]; then
    SIM_JOB_ID=$(databricks jobs create --json="{
        \"name\": \"NEM Market Data Simulator\",
        \"tasks\": [{
            \"task_key\": \"nem_simulator\",
            \"notebook_task\": {
                \"notebook_path\": \"$WS_BASE/setup/10_nem_simulator.py\",
                \"source\": \"WORKSPACE\"
            },
            \"environment_key\": \"default\"
        }],
        \"environments\": [{
            \"environment_key\": \"default\",
            \"spec\": { \"client\": \"1\" }
        }],
        \"max_concurrent_runs\": 1,
        \"timeout_seconds\": 0
    }" --profile="$PROFILE" 2>&1 | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
    echo "  Created simulator job: $SIM_JOB_ID"
else
    echo "  Found existing simulator job: $SIM_JOB_ID"
fi

# Check if simulator is already running
SIM_RUNNING=$(databricks jobs list-runs --job-id="$SIM_JOB_ID" --active-only --profile="$PROFILE" 2>/dev/null \
    | grep -c "RUNNING" || true)

if [ "$SIM_RUNNING" -gt 0 ]; then
    echo "  Simulator is already running."
else
    SIM_RUN=$(databricks jobs run-now "$SIM_JOB_ID" --profile="$PROFILE" 2>&1 \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['run_id'])")
    echo "  Simulator started: run $SIM_RUN"
fi
echo ""

# -----------------------------------------------------------
# Step 6: Build frontend & deploy app
# -----------------------------------------------------------
echo "Step 6/6: Building and deploying the app..."

# Build frontend if needed
if [ -d "$APP_DIR/frontend" ] && [ -f "$APP_DIR/frontend/package.json" ]; then
    echo "  Building frontend..."
    (cd "$APP_DIR/frontend" && npm install --silent 2>/dev/null && npm run build 2>/dev/null)
    echo "  Frontend built."
fi

# Upload app files to workspace
echo "  Uploading app files..."
databricks workspace mkdirs "$WS_BASE" --profile="$PROFILE" 2>/dev/null || true

# Upload main.py
databricks workspace import "$WS_BASE/main.py" \
    --file="$APP_DIR/main.py" \
    --format=AUTO --language=PYTHON --overwrite \
    --profile="$PROFILE" 2>/dev/null
echo "  Uploaded main.py"

# Upload requirements.txt and app.yaml
for f in requirements.txt app.yaml; do
    if [ -f "$APP_DIR/$f" ]; then
        databricks workspace import "$WS_BASE/$f" \
            --file="$APP_DIR/$f" \
            --format=AUTO --overwrite \
            --profile="$PROFILE" 2>/dev/null
        echo "  Uploaded $f"
    fi
done

# Upload frontend dist if it exists
if [ -d "$APP_DIR/frontend/dist" ]; then
    databricks workspace import-dir "$APP_DIR/frontend/dist" \
        "$WS_BASE/frontend/dist" \
        --overwrite --profile="$PROFILE" 2>/dev/null
    echo "  Uploaded frontend/dist"
fi

# Deploy the Databricks App
APP_NAME="energy-copilot"
echo "  Deploying Databricks App '$APP_NAME'..."

# Check if app exists
APP_EXISTS=$(databricks apps get "$APP_NAME" --profile="$PROFILE" 2>/dev/null && echo "yes" || echo "no")
if [ "$APP_EXISTS" = "no" ]; then
    echo "  Creating app '$APP_NAME'..."
    databricks apps create "$APP_NAME" --profile="$PROFILE" 2>/dev/null || true
fi

databricks apps deploy "$APP_NAME" \
    --source-code-path="$WS_BASE" \
    --profile="$PROFILE" 2>&1 | tail -5

# Wait for deployment to complete
echo "  Waiting for app to start..."
for i in $(seq 1 40); do
    sleep 15
    ST=$(databricks apps get "$APP_NAME" --profile="$PROFILE" 2>&1 \
        | python3 -c "
import sys, json
d = json.load(sys.stdin)
p = d.get('pending_deployment')
a = d.get('active_deployment', {})
if p:
    print('PENDING:' + p['status']['state'])
else:
    print('ACTIVE:' + a.get('status', {}).get('state', 'UNKNOWN'))
")
    echo "  $ST"
    if echo "$ST" | grep -q "ACTIVE:SUCCEEDED"; then
        break
    fi
    if echo "$ST" | grep -q "FAILED"; then
        echo "  ERROR: Deployment failed!"
        break
    fi
done

# Get the app URL
APP_URL=$(databricks apps get "$APP_NAME" --profile="$PROFILE" 2>&1 \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))")

echo ""
echo "============================================================"
echo " Deployment Complete!"
echo "============================================================"
echo " App URL:       $APP_URL"
echo " Simulator Job: $SIM_JOB_ID (running)"
echo " Backfill Job:  $BACKFILL_JOB_ID"
echo " Catalog:       $CATALOG"
echo " Profile:       $PROFILE"
echo ""
echo " To check simulator: databricks jobs list-runs --job-id=$SIM_JOB_ID --profile=$PROFILE"
echo " To stop simulator:  databricks jobs cancel-all-runs $SIM_JOB_ID --profile=$PROFILE"
echo "============================================================"
