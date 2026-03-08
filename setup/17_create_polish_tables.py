# Databricks notebook source
# ============================================================
# Create Polish Tables — Phase 2 Spec Gap Closure
# ============================================================
# 1. ALTER alert_rules ADD cooldown_minutes
# 2. CREATE curve_configs (seasonal factors + peak ratios)
# 3. CREATE risk_limits
# 4. CREATE stress_test_results
# 5. CREATE settlement_disputes
# 6. Gold schema views bridging nemweb_analytics tables
# ============================================================

# COMMAND ----------

catalog = "energy_copilot_catalog"
sp_id = "67aaaa6b-778c-4c8b-b2f0-9f9b9728b3bb"

# COMMAND ----------

spark.sql(f"USE CATALOG {catalog}")
spark.sql("USE SCHEMA gold")

# COMMAND ----------

# --- 1. ALTER alert_rules ADD cooldown_minutes ---
try:
    spark.sql(f"ALTER TABLE {catalog}.gold.alert_rules ADD COLUMNS (cooldown_minutes INT)")
    print("Added cooldown_minutes to alert_rules")
except Exception as e:
    if "already exists" in str(e).lower():
        print("cooldown_minutes already exists on alert_rules")
    else:
        print(f"ALTER alert_rules: {e}")

# Set default cooldown for existing rows
try:
    spark.sql(f"UPDATE {catalog}.gold.alert_rules SET cooldown_minutes = 60 WHERE cooldown_minutes IS NULL")
    print("Set default cooldown_minutes = 60")
except Exception as e:
    print(f"UPDATE alert_rules: {e}")

# COMMAND ----------

# --- 2. curve_configs ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.curve_configs (
    config_id STRING,
    config_type STRING COMMENT 'SEASONAL_FACTORS or PEAK_RATIOS',
    region STRING,
    period_key STRING COMMENT 'Month number (1-12) for seasonal, region for peak ratios',
    factor_value DOUBLE,
    updated_by STRING,
    updated_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true'
)
""")
print("Created curve_configs")

# Seed seasonal factors
import uuid
from datetime import datetime, timezone

now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
seasonal = {1: 1.12, 2: 1.08, 3: 0.95, 4: 0.88, 5: 0.92, 6: 1.02,
            7: 1.05, 8: 1.00, 9: 0.93, 10: 0.90, 11: 0.95, 12: 1.10}
peak = {"NSW1": 1.22, "QLD1": 1.18, "VIC1": 1.20, "SA1": 1.25, "TAS1": 1.10}

# Check if already seeded
existing = spark.sql(f"SELECT COUNT(*) AS cnt FROM {catalog}.gold.curve_configs").collect()[0].cnt
if existing == 0:
    rows = []
    for month, factor in seasonal.items():
        rows.append(f"('{uuid.uuid4()}', 'SEASONAL_FACTORS', 'ALL', '{month}', {factor}, 'system', '{now_str}')")
    for region, ratio in peak.items():
        rows.append(f"('{uuid.uuid4()}', 'PEAK_RATIOS', '{region}', '{region}', {ratio}, 'system', '{now_str}')")
    spark.sql(f"INSERT INTO {catalog}.gold.curve_configs VALUES {','.join(rows)}")
    print(f"Seeded {len(rows)} curve_configs rows")
else:
    print(f"curve_configs already has {existing} rows, skipping seed")

# COMMAND ----------

# --- 3. risk_limits ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.risk_limits (
    limit_id STRING,
    portfolio_id STRING,
    limit_type STRING COMMENT 'POSITION_MW, VAR_AUD, NOTIONAL_AUD, CREDIT_AUD',
    region STRING,
    limit_value DOUBLE,
    warning_pct DOUBLE,
    breach_pct DOUBLE,
    is_active BOOLEAN,
    created_by STRING,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true'
)
""")
print("Created risk_limits")

# COMMAND ----------

# --- 4. stress_test_results ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.stress_test_results (
    run_id STRING,
    portfolio_id STRING,
    scenario_id STRING,
    scenario_name STRING,
    base_mtm_aud DOUBLE,
    stressed_mtm_aud DOUBLE,
    pnl_change_aud DOUBLE,
    pnl_change_pct DOUBLE,
    var_95_aud DOUBLE,
    max_loss_aud DOUBLE,
    results_json STRING,
    run_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true'
)
""")
print("Created stress_test_results")

# COMMAND ----------

# --- 5. settlement_disputes ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.settlement_disputes (
    dispute_id STRING,
    region STRING,
    settlement_date DATE,
    dispute_type STRING COMMENT 'ENERGY_AMOUNT, FCAS_RECOVERY, SRA_RESIDUE, PRICE',
    aemo_amount_aud DOUBLE,
    internal_amount_aud DOUBLE,
    variance_aud DOUBLE,
    status STRING COMMENT 'OPEN, UNDER_REVIEW, RESOLVED, ESCALATED',
    description STRING,
    resolution_notes STRING,
    raised_by STRING,
    raised_at TIMESTAMP,
    resolved_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true'
)
""")
print("Created settlement_disputes")

# COMMAND ----------

# --- 6. Gold schema views bridging nemweb_analytics ---

_NEMWEB = f"{catalog}.nemweb_analytics"

# nem_settlement_summary view
try:
    spark.sql(f"""
    CREATE OR REPLACE VIEW {catalog}.gold.nem_settlement_summary AS
    SELECT * FROM {_NEMWEB}.gold_nem_settlement_summary
    """)
    print(f"Created view {catalog}.gold.nem_settlement_summary")
except Exception as e:
    print(f"View nem_settlement_summary: {e}")

# nem_sra_residues view
try:
    spark.sql(f"""
    CREATE OR REPLACE VIEW {catalog}.gold.nem_sra_residues AS
    SELECT * FROM {_NEMWEB}.gold_nem_sra_residues
    """)
    print(f"Created view {catalog}.gold.nem_sra_residues")
except Exception as e:
    print(f"View nem_sra_residues: {e}")

# COMMAND ----------

# --- 7. Grants ---
for tbl in ["curve_configs", "risk_limits", "stress_test_results", "settlement_disputes"]:
    try:
        spark.sql(f"GRANT MODIFY ON TABLE {catalog}.gold.{tbl} TO `{sp_id}`")
        print(f"Granted MODIFY on {tbl}")
    except Exception as e:
        print(f"Grant {tbl}: {e}")

for view in ["nem_settlement_summary", "nem_sra_residues"]:
    try:
        spark.sql(f"GRANT SELECT ON VIEW {catalog}.gold.{view} TO `{sp_id}`")
        print(f"Granted SELECT on {view}")
    except Exception as e:
        print(f"Grant {view}: {e}")

# COMMAND ----------

# Verify
for obj in ["curve_configs", "risk_limits", "stress_test_results", "settlement_disputes"]:
    try:
        count = spark.sql(f"SELECT COUNT(*) AS cnt FROM {catalog}.gold.{obj}").collect()[0].cnt
        print(f"  {catalog}.gold.{obj}: {count} rows")
    except Exception as e:
        print(f"  {catalog}.gold.{obj}: ERROR - {e}")

print("\nPolish tables setup complete.")
