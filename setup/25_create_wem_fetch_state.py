# Databricks notebook source
# MAGIC %md
# MAGIC # Setup 25 — Create WEM Fetch State Table
# MAGIC Tracks incremental fetch progress for WEM data from OpenElectricity API.

# COMMAND ----------

try:
    CATALOG = dbutils.widgets.get("catalog")
except Exception:
    CATALOG = "energy_copilot_catalog"

APP_SP = "67aaaa6b-778c-4c8b-b2f0-9f9b9728b3bb"

# COMMAND ----------

spark.sql(f"""
CREATE TABLE IF NOT EXISTS {CATALOG}.bronze.wem_fetch_state (
    endpoint            STRING      NOT NULL,
    last_data_timestamp TIMESTAMP   NOT NULL,
    fetched_at          TIMESTAMP   NOT NULL
)
USING DELTA
COMMENT 'Incremental fetch state for WEM OpenElectricity API ingest'
TBLPROPERTIES (
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print(f"Created {CATALOG}.bronze.wem_fetch_state")

# COMMAND ----------

# Grant SP access
for stmt in [
    f"GRANT USAGE ON SCHEMA {CATALOG}.bronze TO `{APP_SP}`",
    f"GRANT SELECT ON TABLE {CATALOG}.bronze.wem_fetch_state TO `{APP_SP}`",
    f"GRANT MODIFY ON TABLE {CATALOG}.bronze.wem_fetch_state TO `{APP_SP}`",
]:
    try:
        spark.sql(stmt)
        print(f"  OK: {stmt}")
    except Exception as e:
        print(f"  SKIP: {stmt} — {e}")

print("Done.")
