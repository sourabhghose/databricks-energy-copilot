# Databricks notebook source
# ============================================================
# Phase 3 — Create 21 New Gold Tables
# ============================================================
# WS1: AI Bidding (4), WS2: Advanced Risk (4), WS3: Battery (3),
# WS4: Gas Markets (3), WS5: WEM (3), WS6: Compliance/Env/Reports (4)
# ============================================================

# COMMAND ----------

catalog = "energy_copilot_catalog"
sp_id = "67aaaa6b-778c-4c8b-b2f0-9f9b9728b3bb"

# COMMAND ----------

spark.sql(f"USE CATALOG {catalog}")
spark.sql("USE SCHEMA gold")

# COMMAND ----------

# =========================================================================
# WS1: AI Bidding & Revenue Optimisation
# =========================================================================

# --- bids_submitted ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.bids_submitted (
    bid_id STRING,
    generator_id STRING,
    generator_name STRING,
    region STRING,
    bid_type STRING,
    bid_datetime TIMESTAMP,
    band1_price DOUBLE, band1_mw DOUBLE,
    band2_price DOUBLE, band2_mw DOUBLE,
    band3_price DOUBLE, band3_mw DOUBLE,
    band4_price DOUBLE, band4_mw DOUBLE,
    band5_price DOUBLE, band5_mw DOUBLE,
    band6_price DOUBLE, band6_mw DOUBLE,
    band7_price DOUBLE, band7_mw DOUBLE,
    band8_price DOUBLE, band8_mw DOUBLE,
    band9_price DOUBLE, band9_mw DOUBLE,
    band10_price DOUBLE, band10_mw DOUBLE,
    total_mw DOUBLE,
    status STRING,
    reason STRING,
    created_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created bids_submitted")

# COMMAND ----------

# --- bid_optimization_results ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.bid_optimization_results (
    result_id STRING,
    bid_id STRING,
    generator_id STRING,
    region STRING,
    strategy STRING,
    expected_revenue DOUBLE,
    actual_revenue DOUBLE,
    optimal_revenue DOUBLE,
    revenue_uplift_pct DOUBLE,
    recommended_bands STRING,
    calc_datetime TIMESTAMP
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created bid_optimization_results")

# COMMAND ----------

# --- dispatch_conformance ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.dispatch_conformance (
    event_id STRING,
    generator_id STRING,
    generator_name STRING,
    region STRING,
    interval_datetime TIMESTAMP,
    target_mw DOUBLE,
    actual_mw DOUBLE,
    deviation_mw DOUBLE,
    deviation_pct DOUBLE,
    conformance_status STRING,
    penalty_flag BOOLEAN,
    reason STRING
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created dispatch_conformance")

# COMMAND ----------

# --- revenue_attribution ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.revenue_attribution (
    record_id STRING,
    generator_id STRING,
    generator_name STRING,
    region STRING,
    trading_date DATE,
    energy_revenue DOUBLE,
    fcas_revenue DOUBLE,
    total_revenue DOUBLE,
    spot_price_avg DOUBLE,
    dispatch_mw_avg DOUBLE,
    capacity_factor DOUBLE,
    fuel_type STRING
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created revenue_attribution")

# COMMAND ----------

# =========================================================================
# WS2: Advanced Risk Analytics
# =========================================================================

# --- var_historical ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.var_historical (
    var_id STRING,
    portfolio_id STRING,
    calc_date DATE,
    horizon_days INT,
    confidence_level DOUBLE,
    var_amount DOUBLE,
    cvar_amount DOUBLE,
    num_observations INT,
    method STRING
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created var_historical")

# COMMAND ----------

# --- var_monte_carlo ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.var_monte_carlo (
    mc_id STRING,
    portfolio_id STRING,
    calc_date DATE,
    horizon_days INT,
    confidence_level DOUBLE,
    var_amount DOUBLE,
    cvar_amount DOUBLE,
    num_simulations INT,
    mean_pnl DOUBLE,
    std_pnl DOUBLE
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created var_monte_carlo")

# COMMAND ----------

# --- vol_surface ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.vol_surface (
    surface_id STRING,
    region STRING,
    calc_date DATE,
    tenor_days INT,
    strike_pct DOUBLE,
    implied_vol DOUBLE,
    historical_vol DOUBLE,
    skew DOUBLE,
    kurtosis DOUBLE
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created vol_surface")

# COMMAND ----------

# --- stress_test_library ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.stress_test_library (
    scenario_id STRING,
    scenario_name STRING,
    category STRING,
    description STRING,
    price_shock_pct DOUBLE,
    demand_shock_pct DOUBLE,
    wind_shock_pct DOUBLE,
    solar_shock_pct DOUBLE,
    gas_shock_pct DOUBLE,
    severity STRING,
    is_active BOOLEAN
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created stress_test_library")

# COMMAND ----------

# =========================================================================
# WS3: Battery Optimisation
# =========================================================================

# --- battery_assets ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.battery_assets (
    asset_id STRING,
    name STRING,
    region STRING,
    capacity_mw DOUBLE,
    storage_mwh DOUBLE,
    efficiency_pct DOUBLE,
    max_charge_rate_mw DOUBLE,
    max_discharge_rate_mw DOUBLE,
    min_soc_pct DOUBLE,
    max_soc_pct DOUBLE,
    degradation_rate_pct DOUBLE,
    fcas_capable BOOLEAN,
    commissioning_date DATE,
    status STRING
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created battery_assets")

# COMMAND ----------

# --- battery_dispatch_schedule ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.battery_dispatch_schedule (
    schedule_id STRING,
    asset_id STRING,
    interval_datetime TIMESTAMP,
    action STRING,
    power_mw DOUBLE,
    soc_pct DOUBLE,
    energy_price DOUBLE,
    expected_revenue DOUBLE,
    schedule_source STRING
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created battery_dispatch_schedule")

# COMMAND ----------

# --- battery_performance ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.battery_performance (
    perf_id STRING,
    asset_id STRING,
    perf_date DATE,
    cycles_count DOUBLE,
    throughput_mwh DOUBLE,
    arbitrage_revenue DOUBLE,
    fcas_revenue DOUBLE,
    total_revenue DOUBLE,
    avg_charge_price DOUBLE,
    avg_discharge_price DOUBLE,
    efficiency_actual DOUBLE,
    degradation_pct DOUBLE
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created battery_performance")

# COMMAND ----------

# =========================================================================
# WS4: Gas Market Analytics
# =========================================================================

# --- gas_sttm_prices ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.gas_sttm_prices (
    record_id STRING,
    hub STRING,
    trade_date DATE,
    ex_ante_price DOUBLE,
    ex_post_price DOUBLE,
    excess_demand_gj DOUBLE,
    total_demand_gj DOUBLE
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created gas_sttm_prices")

# COMMAND ----------

# --- gas_dwgm_prices ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.gas_dwgm_prices (
    record_id STRING,
    trade_date DATE,
    trading_interval INT,
    price_aud_gj DOUBLE,
    total_demand_gj DOUBLE,
    total_supply_gj DOUBLE,
    linepack_gj DOUBLE
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created gas_dwgm_prices")

# COMMAND ----------

# --- gas_spark_spreads ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.gas_spark_spreads (
    record_id STRING,
    region STRING,
    trade_date DATE,
    electricity_price DOUBLE,
    gas_price DOUBLE,
    heat_rate DOUBLE,
    spark_spread DOUBLE,
    clean_spark_spread DOUBLE,
    carbon_cost DOUBLE
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created gas_spark_spreads")

# COMMAND ----------

# =========================================================================
# WS5: WEM Expansion
# =========================================================================

# --- wem_balancing_prices ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.wem_balancing_prices (
    record_id STRING,
    trading_interval TIMESTAMP,
    balancing_price DOUBLE,
    total_balancing_demand_mw DOUBLE,
    total_generation_mw DOUBLE,
    reserve_margin_mw DOUBLE,
    price_flag STRING
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created wem_balancing_prices")

# COMMAND ----------

# --- wem_generation ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.wem_generation (
    record_id STRING,
    trading_interval TIMESTAMP,
    fuel_type STRING,
    total_mw DOUBLE,
    unit_count INT,
    capacity_factor DOUBLE
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created wem_generation")

# COMMAND ----------

# --- wem_demand ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.wem_demand (
    record_id STRING,
    trading_interval TIMESTAMP,
    total_demand_mw DOUBLE,
    forecast_demand_mw DOUBLE,
    temperature_c DOUBLE,
    solar_output_mw DOUBLE,
    wind_output_mw DOUBLE
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created wem_demand")

# COMMAND ----------

# =========================================================================
# WS6: Compliance, Environmentals, Reports
# =========================================================================

# --- compliance_obligations ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.compliance_obligations (
    obligation_id STRING,
    obligation_type STRING,
    title STRING,
    description STRING,
    due_date DATE,
    status STRING,
    region STRING,
    responsible_party STRING,
    priority STRING,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created compliance_obligations")

# COMMAND ----------

# --- environmental_portfolio ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.environmental_portfolio (
    holding_id STRING,
    certificate_type STRING,
    vintage_year INT,
    quantity INT,
    unit_price DOUBLE,
    total_value DOUBLE,
    status STRING,
    source STRING,
    acquired_date DATE,
    expiry_date DATE
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created environmental_portfolio")

# COMMAND ----------

# --- certificate_balances ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.certificate_balances (
    balance_id STRING,
    certificate_type STRING,
    vintage_year INT,
    opening_balance INT,
    acquired INT,
    surrendered INT,
    closing_balance INT,
    liability INT,
    surplus_deficit INT,
    as_of_date DATE
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created certificate_balances")

# COMMAND ----------

# --- generated_reports ---
spark.sql(f"""
CREATE TABLE IF NOT EXISTS {catalog}.gold.generated_reports (
    report_id STRING,
    report_type STRING,
    title STRING,
    report_date DATE,
    content STRING,
    summary STRING,
    generated_by STRING,
    created_at TIMESTAMP,
    status STRING,
    parameters STRING
)
USING DELTA
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'true',
    'delta.autoOptimize.optimizeWrite' = 'true'
)
""")
print("Created generated_reports")

# COMMAND ----------

# =========================================================================
# Grant MODIFY to app service principal on all new tables
# =========================================================================

tables = [
    "bids_submitted", "bid_optimization_results", "dispatch_conformance", "revenue_attribution",
    "var_historical", "var_monte_carlo", "vol_surface", "stress_test_library",
    "battery_assets", "battery_dispatch_schedule", "battery_performance",
    "gas_sttm_prices", "gas_dwgm_prices", "gas_spark_spreads",
    "wem_balancing_prices", "wem_generation", "wem_demand",
    "compliance_obligations", "environmental_portfolio", "certificate_balances", "generated_reports",
]

for t in tables:
    try:
        spark.sql(f"GRANT MODIFY ON TABLE {catalog}.gold.{t} TO `{sp_id}`")
        print(f"  MODIFY granted on {t}")
    except Exception as e:
        print(f"  MODIFY grant skipped for {t}: {e}")

# COMMAND ----------

print("Phase 3 DDL complete — 21 tables created with CDF and MODIFY grants.")
