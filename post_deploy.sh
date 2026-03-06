#!/bin/bash
# ============================================================
# Energy Copilot — Post-Deploy Script
# ============================================================
# Handles chicken-and-egg resources that need the App deployed first:
#   1. Gets App Service Principal UUID
#   2. Grants Lakebase permissions to the App SP
#   3. Creates/recreates Synced Tables
#   4. Creates Genie AI/BI spaces
#
# Usage:  ./post_deploy.sh <PROFILE> [TARGET]
#   PROFILE: Databricks CLI profile name
#   TARGET:  Bundle target (default: dev)
#
# Prerequisites:
#   - databricks bundle deploy already completed
#   - App is deployed and has a Service Principal assigned
# ============================================================

set -euo pipefail

PROFILE="${1:?Usage: ./post_deploy.sh <PROFILE> [TARGET]}"
TARGET="${2:-dev}"

echo "============================================================"
echo " Energy Copilot — Post-Deploy"
echo "============================================================"
echo " Profile: $PROFILE"
echo " Target:  $TARGET"
echo "============================================================"
echo ""

# -----------------------------------------------------------
# Step 1: Get the App Service Principal UUID
# -----------------------------------------------------------
echo "Step 1/4: Getting App Service Principal UUID..."

APP_NAME="energy-copilot"
APP_INFO=$(databricks apps get "$APP_NAME" --profile="$PROFILE" 2>&1)
APP_SP=$(echo "$APP_INFO" | python3 -c "
import sys, json
d = json.load(sys.stdin)
sp = d.get('service_principal_id', '')
print(sp)
" 2>/dev/null || echo "")

if [ -z "$APP_SP" ]; then
    echo "  WARNING: Could not determine App SP UUID from 'databricks apps get'."
    echo "  You may need to find it manually in the workspace admin console."
    echo "  Falling back to default SP UUID."
    APP_SP="67aaaa6b-778c-4c8b-b2f0-9f9b9728b3bb"
fi
echo "  App SP UUID: $APP_SP"
echo ""

# -----------------------------------------------------------
# Step 2: Grant Lakebase permissions
# -----------------------------------------------------------
echo "Step 2/4: Granting Lakebase permissions to App SP..."

# Find the Lakebase grant notebook job or run it directly
GRANT_RUN=$(databricks jobs list --profile="$PROFILE" 2>/dev/null \
    | grep "Lakebase Perms" | awk '{print $1}' || true)

if [ -z "$GRANT_RUN" ]; then
    # Run the notebook as a one-time job
    GRANT_JOB_ID=$(databricks jobs create --json="{
        \"name\": \"[${TARGET}] Lakebase Perms Grant (one-time)\",
        \"tasks\": [{
            \"task_key\": \"grant_perms\",
            \"notebook_task\": {
                \"notebook_path\": \"pipelines/11_grant_lakebase_perms.py\",
                \"base_parameters\": {
                    \"app_sp_uuid\": \"$APP_SP\",
                    \"lakebase_instance_name\": \"energy-copilot-db\",
                    \"lakebase_db\": \"energy_copilot_db\"
                }
            },
            \"environment_key\": \"default\"
        }],
        \"environments\": [{
            \"environment_key\": \"default\",
            \"spec\": {
                \"client\": \"1\",
                \"dependencies\": [\"psycopg[binary]>=3.0\", \"databricks-sdk>=0.81.0\"]
            }
        }],
        \"max_concurrent_runs\": 1
    }" --profile="$PROFILE" 2>&1 | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
    echo "  Created grant job: $GRANT_JOB_ID"
else
    GRANT_JOB_ID="$GRANT_RUN"
    echo "  Found existing grant job: $GRANT_JOB_ID"
fi

RUN_ID=$(databricks jobs run-now "$GRANT_JOB_ID" --profile="$PROFILE" 2>&1 \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['run_id'])")
echo "  Running Lakebase grant job: run $RUN_ID"
echo "  Waiting for completion..."

while true; do
    STATE=$(databricks jobs get-run "$RUN_ID" --profile="$PROFILE" 2>&1 \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['state']['life_cycle_state'])")
    if [ "$STATE" = "TERMINATED" ] || [ "$STATE" = "INTERNAL_ERROR" ] || [ "$STATE" = "SKIPPED" ]; then
        RESULT=$(databricks jobs get-run "$RUN_ID" --profile="$PROFILE" 2>&1 \
            | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['state'].get('result_state','UNKNOWN'))")
        echo "  Lakebase grant finished: $RESULT"
        break
    fi
    sleep 10
done
echo ""

# -----------------------------------------------------------
# Step 3: Create/Recreate Synced Tables
# -----------------------------------------------------------
echo "Step 3/4: Creating Synced Tables..."

SYNC_JOB_ID=$(databricks jobs create --json="{
    \"name\": \"[${TARGET}] Synced Tables Setup (one-time)\",
    \"tasks\": [{
        \"task_key\": \"recreate_synced\",
        \"notebook_task\": {
            \"notebook_path\": \"pipelines/12_recreate_synced_tables_continuous.py\",
            \"base_parameters\": {
                \"app_sp_uuid\": \"$APP_SP\",
                \"lakebase_instance_name\": \"energy-copilot-db\",
                \"lakebase_db\": \"energy_copilot_db\",
                \"catalog\": \"energy_copilot_catalog\"
            }
        },
        \"environment_key\": \"default\"
    }],
    \"environments\": [{
        \"environment_key\": \"default\",
        \"spec\": {
            \"client\": \"1\",
            \"dependencies\": [\"psycopg[binary]>=3.0\", \"databricks-sdk>=0.81.0\"]
        }
    }],
    \"max_concurrent_runs\": 1
}" --profile="$PROFILE" 2>&1 | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")

SYNC_RUN=$(databricks jobs run-now "$SYNC_JOB_ID" --profile="$PROFILE" 2>&1 \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['run_id'])")
echo "  Running synced tables job: run $SYNC_RUN"
echo "  Waiting for completion..."

while true; do
    STATE=$(databricks jobs get-run "$SYNC_RUN" --profile="$PROFILE" 2>&1 \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['state']['life_cycle_state'])")
    if [ "$STATE" = "TERMINATED" ] || [ "$STATE" = "INTERNAL_ERROR" ] || [ "$STATE" = "SKIPPED" ]; then
        RESULT=$(databricks jobs get-run "$SYNC_RUN" --profile="$PROFILE" 2>&1 \
            | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['state'].get('result_state','UNKNOWN'))")
        echo "  Synced tables finished: $RESULT"
        break
    fi
    sleep 10
done
echo ""

# -----------------------------------------------------------
# Step 4: Create Genie AI/BI Spaces
# -----------------------------------------------------------
echo "Step 4/4: Creating Genie spaces..."

GENIE_EXISTS=$(databricks workspace ls /Workspace/Users/ --profile="$PROFILE" 2>/dev/null | head -1)
if [ -f "setup/04_create_genie_spaces.py" ]; then
    GENIE_JOB_ID=$(databricks jobs create --json="{
        \"name\": \"[${TARGET}] Genie Spaces Setup (one-time)\",
        \"tasks\": [{
            \"task_key\": \"create_genie\",
            \"notebook_task\": {
                \"notebook_path\": \"setup/04_create_genie_spaces.py\",
                \"base_parameters\": {
                    \"catalog\": \"energy_copilot_catalog\",
                    \"app_sp_name\": \"$APP_SP\"
                }
            },
            \"environment_key\": \"default\"
        }],
        \"environments\": [{
            \"environment_key\": \"default\",
            \"spec\": { \"client\": \"1\" }
        }],
        \"max_concurrent_runs\": 1
    }" --profile="$PROFILE" 2>&1 | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")

    GENIE_RUN=$(databricks jobs run-now "$GENIE_JOB_ID" --profile="$PROFILE" 2>&1 \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['run_id'])")
    echo "  Running Genie spaces job: run $GENIE_RUN"
    echo "  Waiting for completion..."

    while true; do
        STATE=$(databricks jobs get-run "$GENIE_RUN" --profile="$PROFILE" 2>&1 \
            | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['state']['life_cycle_state'])")
        if [ "$STATE" = "TERMINATED" ] || [ "$STATE" = "INTERNAL_ERROR" ] || [ "$STATE" = "SKIPPED" ]; then
            RESULT=$(databricks jobs get-run "$GENIE_RUN" --profile="$PROFILE" 2>&1 \
                | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['state'].get('result_state','UNKNOWN'))")
            echo "  Genie spaces finished: $RESULT"
            break
        fi
        sleep 10
    done
else
    echo "  SKIP: setup/04_create_genie_spaces.py not found"
fi

echo ""
echo "============================================================"
echo " Post-Deploy Complete!"
echo "============================================================"
echo " App SP:    $APP_SP"
echo " Lakebase:  Permissions granted"
echo " Synced:    Tables created with CONTINUOUS sync"
echo " Genie:     Spaces created"
echo ""
echo " NOTE: Update Genie space IDs in app/routers/genie.py if"
echo "       new spaces were created (check job output for IDs)."
echo "============================================================"
