# Databricks notebook source
# MAGIC %md
# MAGIC # Phase 5 — Settlement Back Office Tables
# MAGIC Creates 5 new Delta tables and ALTERs `settlement_disputes` for enhanced workflow.

# COMMAND ----------

catalog = dbutils.widgets.get("catalog")

# COMMAND ----------

# --- 1. settlement_runs — AEMO billing run tracking ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.settlement_runs (
    run_id STRING,
    run_type STRING COMMENT 'PRELIM, FINAL, R1, R2, R3',
    billing_period STRING COMMENT 'YYYY-MM',
    region STRING,
    run_date DATE,
    status STRING COMMENT 'PENDING, VALIDATED, ACCEPTED, DISPUTED, FAILED',
    aemo_total_aud DOUBLE,
    internal_total_aud DOUBLE,
    variance_aud DOUBLE,
    variance_pct DOUBLE,
    prior_run_id STRING COMMENT 'Reference to previous version for comparison',
    auto_accept BOOLEAN COMMENT 'Auto-accepted if variance below materiality',
    materiality_threshold_aud DOUBLE,
    notes STRING,
    created_by STRING,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true'
)
""")
print("Created settlement_runs")

# COMMAND ----------

# --- 2. settlement_charges — Line items per run ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.settlement_charges (
    charge_id STRING,
    run_id STRING,
    charge_type STRING COMMENT 'ENERGY, FCAS_RAISE, FCAS_LOWER, SRA_RESIDUE, ANCILLARY, RERT, ADMIN',
    charge_code STRING COMMENT 'AEMO charge code',
    region STRING,
    interval_date DATE,
    aemo_amount_aud DOUBLE,
    internal_amount_aud DOUBLE,
    variance_aud DOUBLE,
    mapped_status STRING COMMENT 'MAPPED, UNMAPPED, PARTIAL',
    trade_id STRING COMMENT 'Internal trade reference if mapped',
    description STRING,
    created_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true'
)
""")
print("Created settlement_charges")

# COMMAND ----------

# --- 3. settlement_journals — GL entries ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.settlement_journals (
    journal_id STRING,
    run_id STRING,
    journal_type STRING COMMENT 'SETTLEMENT, ACCRUAL, REVERSAL',
    entity STRING,
    period STRING COMMENT 'YYYY-MM',
    account_code STRING,
    account_name STRING,
    debit_aud DOUBLE,
    credit_aud DOUBLE,
    charge_type STRING,
    region STRING,
    posted BOOLEAN,
    posted_at TIMESTAMP,
    posted_by STRING,
    description STRING,
    created_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true'
)
""")
print("Created settlement_journals")

# COMMAND ----------

# --- 4. settlement_evidence — Dispute attachments ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.settlement_evidence (
    evidence_id STRING,
    dispute_id STRING,
    evidence_type STRING COMMENT 'SCREENSHOT, CSV, EMAIL, AEMO_RESPONSE, NOTE',
    filename STRING,
    content_json STRING COMMENT 'JSON-serialised content or reference',
    uploaded_by STRING,
    uploaded_at TIMESTAMP
)
USING DELTA
""")
print("Created settlement_evidence")

# COMMAND ----------

# --- 5. settlement_gl_mapping — Chart-of-accounts config ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.settlement_gl_mapping (
    mapping_id STRING,
    entity STRING,
    charge_type STRING COMMENT 'ENERGY, FCAS_RAISE, FCAS_LOWER, SRA_RESIDUE, ANCILLARY, RERT, ADMIN',
    debit_account_code STRING,
    debit_account_name STRING,
    credit_account_code STRING,
    credit_account_name STRING,
    is_active BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
USING DELTA
""")
print("Created settlement_gl_mapping")

# COMMAND ----------

# --- 6. ALTER settlement_disputes for enhanced workflow ---
alter_cols = [
    ("workflow_state", "STRING COMMENT 'DRAFT, SUBMITTED, UNDER_REVIEW, ACCEPTED, REJECTED, CLOSED'"),
    ("evidence_ids", "STRING COMMENT 'Comma-separated evidence IDs'"),
    ("billing_run_no", "STRING"),
    ("charge_id", "STRING"),
    ("assigned_to", "STRING"),
    ("priority", "STRING COMMENT 'LOW, MEDIUM, HIGH, CRITICAL'"),
    ("due_date", "DATE"),
    ("aemo_case_ref", "STRING"),
    ("updated_at", "TIMESTAMP"),
]
for col_name, col_def in alter_cols:
    try:
        spark.sql(f"ALTER TABLE {catalog}.gold.settlement_disputes ADD COLUMNS ({col_name} {col_def})")
        print(f"  Added column {col_name}")
    except Exception as e:
        if "already exists" in str(e).lower():
            print(f"  Column {col_name} already exists — skipping")
        else:
            print(f"  Warning adding {col_name}: {e}")
print("Altered settlement_disputes")

# COMMAND ----------

# --- 7. Seed sample settlement runs ---
import uuid
from datetime import datetime

now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

runs = [
    ("PRELIM", "2026-02", "NSW1", "2026-03-01", "ACCEPTED", 12450000, 12380000, 70000, 0.56, True),
    ("FINAL",  "2026-01", "VIC1", "2026-02-28", "VALIDATED", 8920000, 8750000, 170000, 1.91, False),
    ("R1",     "2025-12", "QLD1", "2026-03-10", "PENDING", 15600000, 15580000, 20000, 0.13, True),
]

for run_type, period, region, run_date, status, aemo, internal, var, var_pct, auto in runs:
    rid = str(uuid.uuid4())
    spark.sql(f"""
    INSERT INTO {catalog}.gold.settlement_runs VALUES (
        '{rid}', '{run_type}', '{period}', '{region}', '{run_date}',
        '{status}', {aemo}, {internal}, {var}, {var_pct},
        NULL, {str(auto).lower()}, 5000.0, 'Seed data', 'setup_script', '{now}', '{now}'
    )
    """)
print(f"Seeded {len(runs)} settlement runs")

# COMMAND ----------

# --- 8. Seed sample charges ---
charge_types = ["ENERGY", "FCAS_RAISE", "FCAS_LOWER", "SRA_RESIDUE", "ANCILLARY"]
regions = ["NSW1", "VIC1", "QLD1", "SA1", "TAS1"]

# Get a run_id to attach charges to
run_rows = spark.sql(f"SELECT run_id FROM {catalog}.gold.settlement_runs LIMIT 1").collect()
if run_rows:
    sample_run = run_rows[0]["run_id"]
    import random
    for i in range(25):
        cid = str(uuid.uuid4())
        ct = charge_types[i % len(charge_types)]
        rg = regions[i % len(regions)]
        aemo_amt = round(random.uniform(50000, 500000), 2)
        var = round(random.uniform(-5000, 5000), 2)
        internal_amt = round(aemo_amt - var, 2)
        mapped = "MAPPED" if random.random() > 0.3 else "UNMAPPED"
        spark.sql(f"""
        INSERT INTO {catalog}.gold.settlement_charges VALUES (
            '{cid}', '{sample_run}', '{ct}', '{ct}_001', '{rg}',
            '2026-02-{15 + (i % 14):02d}', {aemo_amt}, {internal_amt}, {var},
            '{mapped}', NULL, 'Seed charge', '{now}'
        )
        """)
    print("Seeded 25 settlement charges")

# COMMAND ----------

# --- 9. Seed GL mappings ---
gl_mappings = [
    ("ENERGY",      "4100", "Energy Purchases",        "2100", "AEMO Energy Payable"),
    ("FCAS_RAISE",  "4200", "FCAS Raise Costs",        "2100", "AEMO FCAS Payable"),
    ("FCAS_LOWER",  "4210", "FCAS Lower Costs",        "2100", "AEMO FCAS Payable"),
    ("SRA_RESIDUE", "4300", "SRA Residue Revenue",      "1200", "SRA Receivable"),
    ("ANCILLARY",   "4400", "Ancillary Service Costs",  "2100", "AEMO Ancillary Payable"),
    ("RERT",        "4500", "RERT Costs",               "2100", "AEMO RERT Payable"),
    ("ADMIN",       "4600", "AEMO Admin Fees",          "2100", "AEMO Admin Payable"),
]
for ct, dc, dn, cc, cn in gl_mappings:
    mid = str(uuid.uuid4())
    spark.sql(f"""
    INSERT INTO {catalog}.gold.settlement_gl_mapping VALUES (
        '{mid}', 'AUS_ENERGY', '{ct}', '{dc}', '{dn}', '{cc}', '{cn}', true, '{now}', '{now}'
    )
    """)
print(f"Seeded {len(gl_mappings)} GL mappings")

# COMMAND ----------

# --- 10. Grants ---
sp = "67aaaa6b-778c-4c8b-b2f0-9f9b9728b3bb"
for tbl in ["settlement_runs", "settlement_charges", "settlement_journals", "settlement_evidence", "settlement_gl_mapping"]:
    try:
        spark.sql(f"GRANT MODIFY ON TABLE {catalog}.gold.{tbl} TO `{sp}`")
        print(f"  GRANT MODIFY on {tbl}")
    except Exception as e:
        print(f"  Warning granting on {tbl}: {e}")
print("Done — settlement tables ready")
