# Databricks notebook source
# ============================================================
# Create Competitive Gap Phase 1 Tables
# ============================================================
# 4 new gold tables: alert_rules, alert_history,
# anomaly_explanations, market_briefs
# ============================================================

# COMMAND ----------

catalog = "energy_copilot_catalog"
sp_id = "67aaaa6b-778c-4c8b-b2f0-9f9b9728b3bb"

# COMMAND ----------

spark.sql(f"USE CATALOG {catalog}")
spark.sql("USE SCHEMA gold")

# COMMAND ----------

# --- alert_rules ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.alert_rules (
    rule_id STRING,
    region STRING,
    alert_type STRING,
    threshold_value DOUBLE,
    notification_channel STRING,
    is_active BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    created_by STRING
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true'
)
""")
print("Created alert_rules")

# COMMAND ----------

# --- alert_history ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.alert_history (
    event_id STRING,
    rule_id STRING,
    region STRING,
    alert_type STRING,
    threshold_value DOUBLE,
    actual_value DOUBLE,
    triggered_at TIMESTAMP,
    notification_sent BOOLEAN,
    channel STRING
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true'
)
""")
print("Created alert_history")

# COMMAND ----------

# --- anomaly_explanations ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.anomaly_explanations (
    explanation_id STRING,
    event_id STRING,
    region STRING,
    event_timestamp TIMESTAMP,
    event_type STRING,
    metric_value DOUBLE,
    explanation_text STRING,
    root_causes STRING,
    generation_context STRING,
    weather_context STRING,
    constraint_context STRING,
    model_id STRING,
    generated_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true'
)
""")
print("Created anomaly_explanations")

# COMMAND ----------

# --- market_briefs ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.market_briefs (
    brief_id STRING,
    brief_date DATE,
    brief_type STRING,
    title STRING,
    narrative STRING,
    key_metrics STRING,
    regions STRING,
    model_id STRING,
    generated_at TIMESTAMP,
    word_count INT
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true'
)
""")
print("Created market_briefs")

# COMMAND ----------

# Grant MODIFY to app service principal
for tbl in ["alert_rules", "alert_history", "anomaly_explanations", "market_briefs"]:
    spark.sql(f"GRANT MODIFY ON TABLE {catalog}.gold.{tbl} TO `{sp_id}`")
    print(f"Granted MODIFY on {tbl}")

# COMMAND ----------

print("All competitive gap tables created successfully.")
