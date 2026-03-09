# Databricks notebook source
# ============================================================
# Create Trading Signals Gold Tables
# ============================================================
# Tables for algorithmic trading signal engine — stores detected
# opportunities and risk configuration.
# ============================================================

# COMMAND ----------

catalog = "energy_copilot_catalog"
sp_id = "67aaaa6b-778c-4c8b-b2f0-9f9b9728b3bb"

# COMMAND ----------

spark.sql(f"USE CATALOG {catalog}")
spark.sql("USE SCHEMA gold")

# COMMAND ----------

# --- trading_signals table ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.trading_signals (
    signal_id STRING,
    signal_type STRING,
    region STRING,
    direction STRING,
    confidence DOUBLE,
    expected_profit_aud DOUBLE,
    risk_aud DOUBLE,
    reward_risk_ratio DOUBLE,
    suggested_volume_mw DOUBLE,
    suggested_price DOUBLE,
    suggested_trade_type STRING,
    suggested_profile STRING,
    suggested_start_date STRING,
    suggested_end_date STRING,
    rationale STRING,
    market_context STRING,
    status STRING,
    generated_at TIMESTAMP,
    expires_at TIMESTAMP,
    executed_trade_id STRING,
    executed_at TIMESTAMP
)
USING DELTA
COMMENT 'Algorithmic trading signals with traceable rationale'
""")

print("✓ trading_signals table created")

# COMMAND ----------

# --- trading_signal_config table ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.trading_signal_config (
    config_key STRING,
    config_value STRING,
    updated_at TIMESTAMP
)
USING DELTA
COMMENT 'Trading signal engine risk limits and configuration'
""")

print("✓ trading_signal_config table created")

# COMMAND ----------

# --- Seed default config ---
from datetime import datetime

now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
defaults = [
    ("max_position_mw", '{"value": 100}'),
    ("max_var_impact_aud", '{"value": 500000}'),
    ("allowed_regions", '{"value": ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]}'),
    ("min_confidence", '{"value": 0.5}'),
    ("enabled_signal_types", '{"value": ["FORWARD_MISPRICING", "SPOT_ARBITRAGE", "CONSTRAINT_PLAY", "WEATHER_SHIFT", "DEMAND_SURGE", "VOLATILITY_REGIME", "RENEWABLE_SHORTFALL", "PEAK_SPREAD"]}'),
]

for key, val in defaults:
    spark.sql(f"""
        MERGE INTO {catalog}.gold.trading_signal_config AS t
        USING (SELECT '{key}' AS config_key) AS s
        ON t.config_key = s.config_key
        WHEN NOT MATCHED THEN INSERT (config_key, config_value, updated_at)
        VALUES ('{key}', '{val}', '{now}')
    """)

print("✓ Default config seeded")

# COMMAND ----------

# --- Grant SP access ---
spark.sql(f"GRANT MODIFY ON TABLE {catalog}.gold.trading_signals TO `{sp_id}`")
spark.sql(f"GRANT MODIFY ON TABLE {catalog}.gold.trading_signal_config TO `{sp_id}`")
spark.sql(f"GRANT SELECT ON TABLE {catalog}.gold.trading_signals TO `{sp_id}`")
spark.sql(f"GRANT SELECT ON TABLE {catalog}.gold.trading_signal_config TO `{sp_id}`")
print("✓ SP grants applied")
