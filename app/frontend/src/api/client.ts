// ---------------------------------------------------------------------------
// Typed API client for AUS Energy Copilot
// All requests are proxied through Vite → FastAPI backend at /api/*
// ---------------------------------------------------------------------------

export interface RegionPrice {
  region: string
  price: number
  trend: string
  updatedAt: string
}

export interface PricePoint {
  timestamp: string
  price: number
}

export interface ForecastPoint {
  timestamp: string
  predicted: number
  lower: number
  upper: number
  price_p10?: number
  price_p90?: number
  demand_p10?: number
  demand_p90?: number
  forecast_confidence?: number
}

export interface ForecastSummary {
  regions: string[]
  horizons_available: number[]
  models_loaded: number
  avg_confidence: number
  price_mape_1hr: number
  price_mape_4hr: number
  price_mape_24hr: number
  demand_mape_1hr: number
  demand_mape_4hr: number
  demand_mape_24hr: number
  last_evaluation: string
}

export interface Alert {
  id: string
  region: string
  metric: string
  threshold: number
  status: string
  triggeredAt: string
  /** Whether the alert is currently active (enabled/disabled toggle) */
  isActive?: boolean
  /** Notification delivery channel */
  notificationChannel?: 'EMAIL' | 'SLACK' | 'IN_APP'
}

export interface AlertCreateRequest {
  region_id: string
  alert_type: 'PRICE_THRESHOLD' | 'DEMAND_SURGE' | 'FCAS_PRICE' | 'FORECAST_SPIKE'
  threshold_value: number
  notification_channel: 'EMAIL' | 'SLACK' | 'IN_APP'
}

export interface MarketSummaryRecord {
  summary_date: string
  narrative: string
  model_id: string
  generated_at: string
  word_count: number
  generation_succeeded: boolean
}

export interface GenerationDataPoint {
  timestamp: string
  coal: number
  gas: number
  hydro: number
  wind: number
  solar: number
  battery: number
}

export interface InterconnectorFlow {
  id: string
  from: string
  to: string
  flowMw: number
  limitMw: number
}

export interface InterconnectorRecord {
  interval_datetime: string
  interconnectorid: string
  from_region: string
  to_region: string
  mw_flow: number
  mw_flow_limit: number
  export_limit: number
  import_limit: number
  congested: boolean
}

export interface InterconnectorSummary {
  timestamp: string
  interconnectors: InterconnectorRecord[]
  most_loaded: string
  total_interstate_mw: number
}

export interface SettlementRecord {
  trading_interval: string
  region: string
  totaldemand_mw: number
  net_interchange_mw: number
  rrp_aud_mwh: number
  raise_reg_rrp: number
  lower_reg_rrp: number
  raise6sec_rrp: number
  lower6sec_rrp: number
}

export interface ModelHealthRecord {
  model_name: string;
  region: string;
  alias: string;
  model_version?: string;
  last_updated?: string;
  status: 'ok' | 'stale' | 'missing';
}

export interface SystemHealthResponse {
  timestamp: string;
  databricks_ok: boolean;
  lakebase_ok: boolean;
  models_healthy: number;
  models_total: number;
  pipeline_last_run?: string;
  data_freshness_minutes?: number;
  model_details: ModelHealthRecord[];
}

export interface RegionComparisonPoint {
  timestamp: string;
  NSW1?: number;
  QLD1?: number;
  VIC1?: number;
  SA1?: number;
  TAS1?: number;
}

export interface ConstraintRecord {
  interval_datetime: string;
  constraintid: string;
  rhs: number;
  marginalvalue: number;
  violationdegree: number;
}

export interface FcasRecord {
  interval_datetime: string;
  regionid: string;
  service: string;
  totaldemand: number;
  clearedmw: number;
  rrp: number;
}

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tokens_used?: number;
}

export interface CopilotSession {
  session_id: string;
  created_at: string;
  last_active: string;
  message_count: number;
  total_tokens: number;
  messages?: SessionMessage[];
  rating?: number;
}

export interface AlertTriggerEvent {
  event_id: string;
  alert_id: string;
  triggered_at: string;
  region: string;
  alert_type: string;
  threshold: number;
  actual_value: number;
  notification_sent: boolean;
  channel: string;
}

export interface AlertStats {
  total_alerts: number;
  triggered_last_24h: number;
  notifications_sent: number;
  channels: string[];
  most_triggered_region: string;
}

export interface PriceSpikeEvent {
  event_id: string
  interval_datetime: string
  region: string
  rrp_aud_mwh: number
  spike_type: string
  duration_minutes: number
  cause: string
  resolved: boolean
}

export interface VolatilityStats {
  region: string
  period_days: number
  mean_price: number
  std_dev: number
  p5_price: number
  p95_price: number
  spike_count: number
  negative_count: number
  voll_count: number
  max_price: number
  min_price: number
  cumulative_price_threshold: number
  cumulative_price_current: number
  cpt_utilised_pct: number
}

export interface SpikeAnalysisSummary {
  timestamp: string
  regions: VolatilityStats[]
  total_spike_events_24h: number
  most_volatile_region: string
}

export interface GeneratorRecord {
  duid: string
  station_name: string
  fuel_type: string
  region: string
  registered_capacity_mw: number
  current_output_mw: number
  availability_mw: number
  capacity_factor: number
  is_renewable: boolean
}

export interface GenerationMixRecord {
  fuel_type: string
  total_mw: number
  percentage: number
  unit_count: number
  is_renewable: boolean
}

export interface GenerationSummary {
  timestamp: string
  total_generation_mw: number
  renewable_mw: number
  renewable_percentage: number
  carbon_intensity_kg_co2_mwh: number
  region: string
  fuel_mix: GenerationMixRecord[]
}

export interface MarketNotice {
  notice_id: string
  notice_type: string
  creation_date: string
  external_reference: string
  reason: string
  regions_affected: string[]
  severity: string
  resolved: boolean
}

export interface DispatchInterval {
  interval_datetime: string
  region: string
  rrp: number
  predispatch_rrp: number
  rrp_deviation: number
  totaldemand: number
  dispatchablegeneration: number
  net_interchange: number
  lower_reg_mw: number
  raise_reg_mw: number
}

export interface DispatchSummary {
  region: string
  intervals: DispatchInterval[]
  mean_deviation: number
  max_surprise: number
  surprise_intervals: number
}

export interface WeatherDemandPoint {
  timestamp: string
  region: string
  temperature_c: number
  apparent_temp_c: number
  demand_mw: number
  demand_baseline_mw: number
  demand_deviation_mw: number
  wind_speed_kmh: number
  solar_irradiance_wm2: number
}

export interface DemandResponseEvent {
  event_id: string
  program_name: string
  region: string
  activation_time: string
  duration_minutes: number
  mw_reduction: number
  participants: number
  status: string
  trigger_reason: string
}

export interface DemandResponseSummary {
  timestamp: string
  active_programs: number
  total_enrolled_mw: number
  total_activated_mw_today: number
  events_today: number
  events: DemandResponseEvent[]
  region_summaries: Record<string, number>
}

export interface BessUnit {
  duid: string
  station_name: string
  region: string
  capacity_mwh: number
  power_mw: number
  soc_pct: number
  mode: string
  current_mw: number
  cycles_today: number
  revenue_today_aud: number
  efficiency_pct: number
}

export interface BessDispatchInterval {
  interval_datetime: string
  duid: string
  mw: number
  soc_pct: number
  rrp_at_dispatch: number
  revenue_aud: number
}

export interface BessFleetSummary {
  timestamp: string
  total_capacity_mwh: number
  total_power_mw: number
  units_discharging: number
  units_charging: number
  units_idle: number
  fleet_avg_soc_pct: number
  fleet_revenue_today_aud: number
  units: BessUnit[]
}

export interface PortfolioAsset {
  asset_id: string
  name: string
  asset_type: string
  fuel_type: string
  region: string
  capacity_mw: number
  contracted_volume_mwh: number
  contract_price_aud_mwh: number
  current_spot_mwh: number
  mtm_pnl_aud: number
  daily_revenue_aud: number
  daily_cost_aud: number
}

export interface HedgePosition {
  hedge_id: string
  hedge_type: string
  region: string
  volume_mw: number
  strike_price: number
  premium_paid_aud: number
  current_value_aud: number
  expiry_date: string
  in_the_money: boolean
}

export interface PortfolioSummary {
  timestamp: string
  total_mtm_pnl_aud: number
  total_daily_revenue_aud: number
  total_hedge_value_aud: number
  net_open_position_mw: number
  hedge_ratio_pct: number
  assets: PortfolioAsset[]
  hedges: HedgePosition[]
  region_pnl: Record<string, number>
}

export interface CarbonIntensityRecord {
  timestamp: string
  region: string
  carbon_intensity_kg_co2_mwh: number
  renewable_pct: number
  fossil_pct: number
  generation_mix: Record<string, number>
}

export interface LgcMarketRecord {
  date: string
  lgc_spot_price_aud: number
  lgc_futures_2026: number
  lgc_futures_2027: number
  lgc_futures_2028: number
  sts_price_aud: number
  total_lgcs_surrendered_ytd: number
  liable_entities_shortfall_gwh: number
}

export interface SustainabilityDashboard {
  timestamp: string
  nem_carbon_intensity: number
  nem_renewable_pct: number
  annual_emissions_mt_co2: number
  emissions_vs_2005_pct: number
  renewable_capacity_gw: number
  renewable_target_gw: number
  lgc_market: LgcMarketRecord
  regional_intensity: CarbonIntensityRecord[]
  intensity_history: CarbonIntensityRecord[]
}

export interface MeritOrderUnit {
  duid: string
  station_name: string
  fuel_type: string
  region: string
  capacity_mw: number
  marginal_cost_aud_mwh: number
  current_offer_price: number
  dispatched_mw: number
  cumulative_mw: number
  on_merit: boolean
}

export interface MeritOrderCurve {
  region: string
  timestamp: string
  demand_mw: number
  marginal_generator: string
  system_marginal_cost: number
  total_supply_mw: number
  units: MeritOrderUnit[]
}

export interface MlflowRun {
  run_id: string
  experiment_name: string
  model_type: string
  region: string
  status: string
  start_time: string
  end_time?: string
  duration_seconds: number
  mae: number
  rmse: number
  mape: number
  r2_score: number
  training_rows: number
  feature_count: number
  model_version: string
  tags: Record<string, string>
}

export interface FeatureImportance {
  feature_name: string
  importance: number
  rank: number
}

export interface ModelDriftRecord {
  model_type: string
  region: string
  date: string
  mae_production: number
  mae_training: number
  drift_ratio: number
  drift_status: string
  samples_evaluated: number
}

export interface MlDashboardData {
  timestamp: string
  total_experiments: number
  total_runs: number
  models_in_production: number
  avg_mae_production: number
  recent_runs: MlflowRun[]
  feature_importance: Record<string, FeatureImportance[]>
  drift_summary: ModelDriftRecord[]
}

// ---------------------------------------------------------------------------
// Sprint 18c — Market Participant Registry & Credit Analytics interfaces
// ---------------------------------------------------------------------------

export interface MarketParticipant {
  participant_id: string
  company_name: string
  participant_type: string
  regions: string[]
  registration_date: string
  credit_limit_aud: number
  credit_used_pct: number
  assets_count: number
  total_capacity_mw: number
  market_share_pct: number
  compliance_status: string
  last_settlement_aud: number
}

export interface ParticipantAsset {
  duid: string
  participant_id: string
  asset_name: string
  asset_type: string
  region: string
  registered_capacity_mw: number
  fuel_type: string
  commissioning_date: string
  current_output_mw: number
  status: string
}

export interface ParticipantRegistry {
  timestamp: string
  total_participants: number
  total_registered_capacity_mw: number
  market_concentration_hhi: number
  largest_participant: string
  participants: MarketParticipant[]
}

// ---------------------------------------------------------------------------
// Sprint 18a — ASX Energy Futures & Hedge Market interfaces
// ---------------------------------------------------------------------------

export interface FuturesContract {
  contract_code: string
  region: string
  contract_type: string
  year: number
  quarter?: number
  settlement_price: number
  peak_price?: number
  change_1d: number
  change_1w: number
  open_interest: number
  volume_today: number
  last_trade: string
}

export interface ForwardCurvePoint {
  date: string
  base_price: number
  peak_price?: number
  implied_volatility: number
}

export interface HedgeEffectivenessRecord {
  hedge_type: string
  region: string
  contract: string
  notional_mwh: number
  hedge_price: number
  spot_realised: number
  pnl_aud: number
  effectiveness_pct: number
}

export interface FuturesDashboard {
  timestamp: string
  region: string
  contracts: FuturesContract[]
  forward_curve: ForwardCurvePoint[]
  hedge_effectiveness: HedgeEffectivenessRecord[]
  market_summary: Record<string, number>
}

// ---------------------------------------------------------------------------
// Sprint 17c — Historical Trend & Long-Run Analysis interfaces
// ---------------------------------------------------------------------------

export interface AnnualSummary {
  year: number
  region: string
  avg_price_aud_mwh: number
  max_price_aud_mwh: number
  min_price_aud_mwh: number
  price_volatility: number
  avg_demand_mw: number
  peak_demand_mw: number
  total_generation_gwh: number
  renewable_pct: number
  carbon_intensity: number
  spike_events_count: number
  negative_price_hours: number
  cpi_adjusted_price: number
}

export interface YearOverYearChange {
  region: string
  metric: string
  year: number
  value: number
  prior_year_value: number
  change_pct: number
  trend: string
}

export interface LongRunTrendSummary {
  region: string
  years_analyzed: number
  start_year: number
  end_year: number
  price_cagr_pct: number
  demand_cagr_pct: number
  renewable_pct_start: number
  renewable_pct_end: number
  carbon_intensity_start: number
  carbon_intensity_end: number
  annual_data: AnnualSummary[]
  yoy_changes: YearOverYearChange[]
}

// ---------------------------------------------------------------------------
// Sprint 16c — Data Catalog & Pipeline Health interfaces
// ---------------------------------------------------------------------------

export interface PipelineRunRecord {
  pipeline_id: string
  pipeline_name: string
  run_id: string
  status: string
  start_time: string
  end_time?: string
  duration_seconds: number
  rows_processed: number
  rows_failed: number
  error_message?: string
  triggered_by: string
}

export interface TableHealthRecord {
  catalog: string
  schema_name: string
  table_name: string
  row_count: number
  last_updated: string
  freshness_minutes: number
  freshness_status: string
  size_gb: number
  partition_count: number
  expectation_pass_rate: number
}

export interface DataQualityExpectation {
  table_name: string
  expectation_name: string
  column_name: string
  expectation_type: string
  passed: boolean
  pass_rate: number
  failed_rows: number
  last_evaluated: string
  severity: string
}

export interface DataCatalogDashboard {
  timestamp: string
  total_tables: number
  fresh_tables: number
  stale_tables: number
  critical_tables: number
  total_rows_today: number
  pipeline_runs_today: number
  pipeline_failures_today: number
  recent_pipelines: PipelineRunRecord[]
  table_health: TableHealthRecord[]
  dq_expectations: DataQualityExpectation[]
}

export interface ScenarioInput {
  region: string
  base_temperature_c: number
  temperature_delta_c: number
  gas_price_multiplier: number
  wind_output_multiplier: number
  solar_output_multiplier: number
  demand_multiplier: number
  coal_outage_mw: number
}

export interface ScenarioResult {
  scenario_id: string
  region: string
  base_price_aud_mwh: number
  scenario_price_aud_mwh: number
  price_change_aud_mwh: number
  price_change_pct: number
  base_demand_mw: number
  scenario_demand_mw: number
  demand_change_mw: number
  base_renewable_pct: number
  scenario_renewable_pct: number
  marginal_generator_base: string
  marginal_generator_scenario: string
  key_drivers: string[]
  confidence: string
}

export interface ScenarioComparison {
  timestamp: string
  inputs: ScenarioInput
  result: ScenarioResult
  sensitivity_table: Record<string, number>[]
}

// ---------------------------------------------------------------------------
// Sprint 17a — Load Duration Curve & Statistical Analysis interfaces
// ---------------------------------------------------------------------------

export interface DurationCurvePoint {
  percentile: number
  demand_mw: number
  price_aud_mwh: number
  hours_per_year: number
}

export interface StatisticalSummary {
  region: string
  period_label: string
  demand_mean: number
  demand_p10: number
  demand_p25: number
  demand_p50: number
  demand_p75: number
  demand_p90: number
  demand_p99: number
  demand_max: number
  demand_min: number
  price_mean: number
  price_p10: number
  price_p25: number
  price_p50: number
  price_p75: number
  price_p90: number
  price_p95: number
  price_p99: number
  price_max: number
  price_min: number
  demand_stddev: number
  price_stddev: number
  correlation_demand_price: number
  peak_demand_hour: number
  peak_price_hour: number
}

export interface SeasonalPattern {
  region: string
  month: number
  month_name: string
  avg_demand_mw: number
  avg_price_aud_mwh: number
  peak_demand_mw: number
  renewable_pct: number
}

// ---------------------------------------------------------------------------
// Sprint 17b — Frequency & System Strength Analytics interfaces
// ---------------------------------------------------------------------------

export interface FrequencyRecord {
  timestamp: string
  frequency_hz: number
  rocof_hz_per_s: number
  region: string
  deviation_hz: number
  band: string
}

export interface InertiaRecord {
  timestamp: string
  region: string
  total_inertia_mws: number
  synchronous_mws: number
  synthetic_mws: number
  min_inertia_requirement_mws: number
  inertia_adequate: boolean
  rocof_risk: string
}

export interface FrequencyEventRecord {
  event_id: string
  event_type: string
  start_time: string
  end_time: string
  duration_seconds: number
  min_frequency: number
  max_rocof: number
  region: string
  cause: string
  ufls_activated: boolean
  mw_shed: number
}

export interface FrequencyDashboard {
  timestamp: string
  current_frequency_hz: number
  current_rocof: number
  current_band: string
  total_synchronous_inertia_mws: number
  recent_frequency: FrequencyRecord[]
  inertia_by_region: InertiaRecord[]
  recent_events: FrequencyEventRecord[]
}

// ---------------------------------------------------------------------------
// Sprint 18b — Outage Schedule & PASA Adequacy Assessment interfaces
// ---------------------------------------------------------------------------

export interface OutageRecord {
  outage_id: string
  duid: string
  station_name: string
  region: string
  fuel_type: string
  outage_type: string
  start_time: string
  end_time?: string
  duration_hours?: number
  capacity_lost_mw: number
  reason: string
  status: string
}

export interface PasaRecord {
  interval_date: string
  region: string
  available_capacity_mw: number
  forecast_demand_mw: number
  reserve_mw: number
  reserve_status: string
  surplus_pct: number
}

export interface PasaDashboard {
  timestamp: string
  active_outages: OutageRecord[]
  upcoming_outages: OutageRecord[]
  recent_returns: OutageRecord[]
  total_capacity_lost_mw: number
  pasa_outlook: PasaRecord[]
  worst_reserve_day: string
  worst_reserve_mw: number
}

// ---------------------------------------------------------------------------
// Sprint 19a — VPP & Distributed Energy Resources (DER) interfaces
// ---------------------------------------------------------------------------

export interface VppUnit {
  vpp_id: string
  vpp_name: string
  operator: string
  region: string
  total_capacity_mw: number
  participating_households: number
  battery_capacity_mwh: number
  solar_capacity_mw: number
  ev_count: number
  current_dispatch_mw: number
  mode: string
  revenue_today_aud: number
}

export interface DerSummary {
  region: string
  rooftop_solar_capacity_gw: number
  rooftop_solar_output_mw: number
  btm_battery_capacity_gwh: number
  btm_battery_output_mw: number
  ev_connected_count: number
  ev_charging_mw: number
  net_demand_mw: number
  gross_demand_mw: number
  solar_penetration_pct: number
}

export interface DerDashboard {
  timestamp: string
  nem_rooftop_solar_gw: number
  nem_btm_battery_gwh: number
  nem_net_demand_reduction_mw: number
  vpp_fleet: VppUnit[]
  regional_der: DerSummary[]
  hourly_solar_forecast: Record<string, number>[]
}

// ---------------------------------------------------------------------------
// Sprint 19c — Admin Settings & API Configuration Panel interfaces
// ---------------------------------------------------------------------------

export interface UserPreferences {
  user_id: string
  default_region: string
  theme: string
  default_horizon: string
  price_alert_threshold: number
  demand_alert_threshold: number
  auto_refresh_seconds: number
  notification_email?: string
  notification_slack_webhook?: string
  regions_watchlist: string[]
  data_export_format: string
}

export interface ApiKeyInfo {
  key_id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at?: string
  expires_at?: string
  permissions: string[]
  request_count_today: number
  rate_limit_per_min: number
  is_active: boolean
}

export interface DataSourceConfig {
  source_id: string
  name: string
  endpoint_url: string
  status: string
  last_sync: string
  sync_interval_minutes: number
  records_synced_today: number
}

export interface SystemConfig {
  mock_mode: boolean
  environment: string
  databricks_workspace: string
  unity_catalog: string
  mlflow_experiment: string
  api_version: string
  frontend_version: string
  backend_uptime_hours: number
  total_api_requests_today: number
  cache_hit_rate_pct: number
}

// ---------------------------------------------------------------------------
// Sprint 19b — Gas Market & Pipeline Analytics interfaces
// ---------------------------------------------------------------------------

export interface GasPipelineFlow {
  pipeline_id: string
  pipeline_name: string
  from_location: string
  to_location: string
  flow_tj_day: number
  capacity_tj_day: number
  utilisation_pct: number
  direction: string
  pressure_kpa: number
}

export interface GasHubPrice {
  hub: string
  timestamp: string
  price_aud_gj: number
  volume_tj: number
  change_1d: number
  change_1w: number
}

export interface LngExportRecord {
  terminal: string
  region: string
  export_volume_mtpa: number
  domestic_allocation_pj: number
  spot_cargo: boolean
  next_cargo_date: string
}

export interface GasMarketDashboard {
  timestamp: string
  wallumbilla_price: number
  moomba_price: number
  longford_price: number
  total_pipeline_flow_tj: number
  lng_exports_today_tj: number
  domestic_demand_tj: number
  gas_power_generation_tj: number
  hub_prices: GasHubPrice[]
  pipeline_flows: GasPipelineFlow[]
  lng_terminals: LngExportRecord[]
}

// ---------------------------------------------------------------------------
// Sprint 20a — Retail Market Analytics interfaces
// ---------------------------------------------------------------------------

export interface RetailerMarketShare {
  retailer: string
  state: string
  residential_customers: number
  sme_customers: number
  large_commercial_customers: number
  total_customers: number
  market_share_pct: number
  electricity_volume_gwh: number
  avg_retail_margin_pct: number
}

export interface DefaultOfferPrice {
  state: string
  offer_type: string
  distributor: string
  annual_usage_kwh: number
  flat_rate_c_kwh: number
  daily_supply_charge: number
  annual_bill_aud: number
  previous_year_aud: number
  change_pct: number
}

export interface CustomerSwitchingRecord {
  state: string
  quarter: string
  switches_count: number
  switching_rate_pct: number
  avg_savings_aud_yr: number
  market_offer_take_up_pct: number
}

export interface RetailMarketDashboard {
  timestamp: string
  total_residential_customers: number
  total_market_offers_count: number
  best_market_offer_discount_pct: number
  standing_offer_customers_pct: number
  market_shares: RetailerMarketShare[]
  default_offers: DefaultOfferPrice[]
  switching_data: CustomerSwitchingRecord[]
}

// ---------------------------------------------------------------------------
// Sprint 20b — Transmission Loss Factor & Network Analytics interfaces
// ---------------------------------------------------------------------------

export interface LossFactorRecord {
  connection_point: string
  duid: string
  station_name: string
  region: string
  fuel_type: string
  registered_capacity_mw: number
  mlf: number
  dlf: number
  combined_lf: number
  mlf_category: string
  mlf_prior_year: number
  mlf_change: number
}

export interface NetworkConstraintLimit {
  element_id: string
  element_name: string
  region: string
  voltage_kv: number
  thermal_limit_mva: number
  current_flow_mva: number
  loading_pct: number
  n1_contingency_mva: number
  status: string
}

export interface NetworkDashboard {
  timestamp: string
  total_connection_points: number
  avg_mlf_renewables: number
  avg_mlf_thermal: number
  low_mlf_generators: number
  high_mlf_generators: number
  loss_factors: LossFactorRecord[]
  network_elements: NetworkConstraintLimit[]
}

// ---------------------------------------------------------------------------
// Sprint 20c — REZ & Infrastructure Investment Analytics interfaces
// ---------------------------------------------------------------------------

export interface RezProject {
  rez_id: string
  rez_name: string
  state: string
  region: string
  status: string
  total_capacity_mw: number
  committed_capacity_mw: number
  operational_capacity_mw: number
  connection_queue_mw: number
  technology_mix: { wind_mw?: number; solar_mw?: number; storage_mw?: number }
  target_completion_year: number
  network_investment_m: number
  developer_count: number
}

export interface IspProject {
  project_id: string
  project_name: string
  category: string
  states_connected: string[]
  capacity_mva: number
  voltage_kv: number
  capex_m: number
  status: string
  expected_commissioning_year: number
  congestion_relief_m_pa: number
  benefit_cost_ratio: number
}

export interface CisContract {
  contract_id: string
  project_name: string
  technology: string
  state: string
  capacity_mw: number
  storage_duration_hrs: number
  auction_round: string
  strike_price_mwh: number
  contract_duration_years: number
  expected_generation_gwh_pa: number
  developer: string
  commissioning_year: number
}

export interface RezDashboard {
  timestamp: string
  total_rez_capacity_gw: number
  operational_rez_gw: number
  under_construction_gw: number
  pipeline_gw: number
  total_cis_contracts: number
  cis_contracted_capacity_gw: number
  total_isp_projects: number
  isp_actionable_capex_b: number
  rez_projects: RezProject[]
  isp_projects: IspProject[]
  cis_contracts: CisContract[]
}

// ---------------------------------------------------------------------------
// Sprint 21a — Renewable Curtailment & Integration interfaces
// ---------------------------------------------------------------------------

export interface CurtailmentEvent {
  event_id: string
  date: string
  region: string
  technology: string
  curtailed_mwh: number
  curtailed_pct: number
  duration_minutes: number
  cause: string
  peak_available_mw: number
}

export interface MinimumOperationalDemandRecord {
  date: string
  region: string
  min_demand_mw: number
  min_demand_time: string
  renewable_share_pct: number
  instantaneous_renewable_mw: number
  storage_charging_mw: number
  exports_mw: number
  record_broken: boolean
}

export interface RenewableIntegrationLimit {
  region: string
  limit_type: string
  current_limit_mw: number
  headroom_mw: number
  mitigation_project: string
  mitigation_year: number
  description: string
}

export interface CurtailmentDashboard {
  timestamp: string
  total_curtailment_gwh_ytd: number
  curtailment_events_ytd: number
  worst_region: string
  lowest_mod_record_mw: number
  lowest_mod_date: string
  renewable_penetration_record_pct: number
  renewable_penetration_record_date: string
  curtailment_events: CurtailmentEvent[]
  mod_records: MinimumOperationalDemandRecord[]
  integration_limits: RenewableIntegrationLimit[]
}

// ---------------------------------------------------------------------------
// Sprint 21b — Demand Side Participation interfaces
// ---------------------------------------------------------------------------

export interface DspParticipant {
  duid: string
  participant_name: string
  industry_sector: string
  region: string
  registered_capacity_mw: number
  response_time_minutes: number
  dsp_program: string
  min_activation_duration_hrs: number
  payment_type: string
  avg_activations_per_year: number
  reliability_score_pct: number
}

export interface DspActivationEvent {
  event_id: string
  date: string
  region: string
  trigger: string
  activated_mw: number
  delivered_mw: number
  delivery_pct: number
  duration_minutes: number
  average_price_mwh: number
  participants_called: number
  season: string
}

export interface LoadCurtailmentRecord {
  date: string
  region: string
  curtailment_type: string
  total_load_shed_mwh: number
  customers_affected: number
  duration_minutes: number
  trigger_event: string
}

export interface DspDashboard {
  timestamp: string
  total_registered_capacity_mw: number
  total_participants: number
  activations_ytd: number
  total_delivered_mwh_ytd: number
  avg_delivery_reliability_pct: number
  top_sector_by_capacity: string
  participants: DspParticipant[]
  activations: DspActivationEvent[]
  curtailment_records: LoadCurtailmentRecord[]
}

// ---------------------------------------------------------------------------
// Sprint 21c — Power System Security & Inertia interfaces
// ---------------------------------------------------------------------------

export interface PssInertiaRecord {
  region: string
  timestamp: string
  total_inertia_mws: number
  synchronous_generation_mw: number
  non_synchronous_pct: number
  rocof_limit_hz_s: number
  min_inertia_requirement_mws: number
  inertia_headroom_mws: number
  status: string
}

export interface SynchronousCondenserRecord {
  unit_id: string
  site_name: string
  region: string
  operator: string
  rated_mvar: number
  inertia_contribution_mws: number
  status: string
  commissioning_year: number
  purpose: string
}

export interface FcasDispatchRecord {
  service: string
  region: string
  requirement_mw: number
  dispatched_mw: number
  price_mwh: number
  enablement_pct: number
  primary_provider: string
  timestamp: string
}

export interface PowerSystemSecurityDashboard {
  timestamp: string
  nem_inertia_total_mws: number
  lowest_inertia_region: string
  synchronous_condensers_online: number
  total_syncon_capacity_mvar: number
  fcas_raise_total_mw: number
  fcas_lower_total_mw: number
  system_strength_status: string
  inertia_records: PssInertiaRecord[]
  synchronous_condensers: SynchronousCondenserRecord[]
  fcas_dispatch: FcasDispatchRecord[]
}

// ---------------------------------------------------------------------------
// Sprint 22a — Generator Bidding & Offer Stack interfaces
// ---------------------------------------------------------------------------

export interface OfferBand {
  price_band: string
  price_aud_mwh: number
  mw_offered: number
  cumulative_mw: number
}

export interface GeneratorOfferRecord {
  duid: string
  station_name: string
  fuel_type: string
  region: string
  registered_capacity_mw: number
  max_capacity_mw: number
  offer_bands: OfferBand[]
  daily_energy_price_avg: number
  rebit_count_today: number
}

export interface RebidRecord {
  duid: string
  station_name: string
  fuel_type: string
  region: string
  rebid_time: string
  reason_code: string
  reason_text: string
  mw_change: number
  price_band_changed: string
  old_price: number
  new_price: number
}

export interface BidStackSummary {
  timestamp: string
  total_offered_mw: number
  average_offer_price: number
  offers_below_50: number
  offers_above_300: number
  total_rebids_today: number
  fuel_type_breakdown: Array<{ fuel_type: string; offered_mw: number; avg_price: number }>
  offer_records: GeneratorOfferRecord[]
  rebid_log: RebidRecord[]
}

// Sprint 22b interfaces
export interface MarketEvent {
  event_id: string
  event_type: string
  region: string
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  severity: string
  description: string
  affected_capacity_mw: number | null
  administered_price: number | null
  resolved: boolean
}

export interface MarketIntervention {
  intervention_id: string
  intervention_type: string
  region: string
  duid: string | null
  station_name: string | null
  issued_time: string
  duration_hours: number
  directed_mw: number
  reason: string
  market_notice_id: string
  cost_est_aud: number | null
}

export interface PriceCapEvent {
  event_id: string
  region: string
  date: string
  cap_type: string
  trigger_interval: string
  intervals_above_cap: number
  cumulative_energy_mwh: number
  max_spot_price: number
  total_apc_duration_hours: number | null
}

export interface MarketEventsDashboard {
  period: string
  total_events: number
  critical_events: number
  interventions_this_week: number
  apc_hours_this_month: number
  lor_events_today: number
  directions_active: number
  recent_events: MarketEvent[]
  interventions: MarketIntervention[]
  price_cap_events: PriceCapEvent[]
}

// Sprint 22c — FCAS Market Deep-Dive interfaces
export interface FcasServicePrice {
  service: string
  service_name: string
  direction: string
  type: string
  clearing_price_aud_mw: number
  volume_mw: number
  requirement_mw: number
  utilisation_pct: number
  max_clearing_today: number
  min_clearing_today: number
  main_provider: string
}

export interface FcasProvider {
  duid: string
  station_name: string
  fuel_type: string
  region: string
  services_enabled: string[]
  raise_mw: number
  lower_mw: number
  regulation_mw: number
  contingency_mw: number
  revenue_today_aud: number
  cost_per_mw: number
}

export interface FcasTrapRecord {
  duid: string
  station_name: string
  region: string
  service: string
  trap_type: string
  constraint_id: string
  mw_limited: number
  revenue_foregone_est: number
  period: string
}

export interface FcasMarketDashboard {
  timestamp: string
  total_fcas_cost_today_aud: number
  regulation_cost_aud: number
  contingency_cost_aud: number
  total_enabled_mw: number
  shortfall_risk: string
  services: FcasServicePrice[]
  providers: FcasProvider[]
  trap_records: FcasTrapRecord[]
  regional_requirement: Array<{ region: string; raise_req_mw: number; lower_req_mw: number }>
}

// ---------------------------------------------------------------------------
// Sprint 23a — Battery Arbitrage & Economics interfaces
// ---------------------------------------------------------------------------

export interface BatteryArbitrageSlot { hour: number; time_label: string; action: string; power_mw: number; spot_price: number; energy_revenue: number; soc_pct: number }
export interface BatteryUnit { bess_id: string; station_name: string; region: string; technology: string; capacity_mwh: number; power_mw: number; roundtrip_efficiency_pct: number; cycles_today: number; soc_current_pct: number; energy_revenue_today: number; fcas_revenue_today: number; sras_revenue_today: number; total_revenue_today: number; annual_revenue_est_aud: number; lcoe_aud_mwh: number }
export interface ArbitrageOpportunity { region: string; date: string; peak_price: number; off_peak_price: number; spread: number; optimal_cycles: number; theoretical_max_revenue_mw: number; actual_captured_pct: number }
export interface BatteryEconomicsDashboard { timestamp: string; total_fleet_capacity_mwh: number; total_fleet_power_mw: number; avg_roundtrip_efficiency_pct: number; fleet_revenue_today_aud: number; energy_pct: number; fcas_pct: number; sras_pct: number; best_arbitrage_region: string; best_spread_today: number; batteries: BatteryUnit[]; opportunities: ArbitrageOpportunity[]; dispatch_schedule: BatteryArbitrageSlot[] }

// Sprint 23c — NEM Settlement & Prudential interfaces
export interface SettlementResidueRecord { interval_id: string; interconnector_id: string; flow_mw: number; price_differential: number; settlement_residue_aud: number; direction: string; allocation_pool: string }
export interface PrudentialRecord { participant_id: string; participant_name: string; participant_type: string; credit_limit_aud: number; current_exposure_aud: number; utilisation_pct: number; outstanding_amount_aud: number; days_since_review: number; status: string; default_notice_issued: boolean }
export interface SettlementRun { run_id: string; run_type: string; trading_date: string; run_datetime: string; status: string; records_processed: number; total_settlement_aud: number; largest_payment_aud: number; largest_receipt_aud: number; runtime_seconds: number }
export interface TecAdjustment { participant_id: string; duid: string; station_name: string; region: string; previous_tec_mw: number; new_tec_mw: number; change_mw: number; effective_date: string; reason: string; mlf_before: number; mlf_after: number }
export interface SettlementDashboard { timestamp: string; settlement_period: string; total_energy_settlement_aud: number; total_fcas_settlement_aud: number; total_residues_aud: number; prudential_exceedances: number; pending_settlement_runs: number; largest_residue_interconnector: string; settlement_runs: SettlementRun[]; residues: SettlementResidueRecord[]; prudential_records: PrudentialRecord[]; tec_adjustments: TecAdjustment[] }

// ---------------------------------------------------------------------------
// Sprint 23b — Carbon Emissions Intensity interfaces
// ---------------------------------------------------------------------------
export interface RegionEmissionsRecord { region: string; timestamp: string; emissions_intensity_kg_co2_mwh: number; renewable_pct: number; coal_pct: number; gas_pct: number; hydro_pct: number; wind_pct: number; solar_pct: number; battery_pct: number; total_generation_mw: number; net_emissions_t_co2_hr: number }
export interface FuelEmissionsFactor { fuel_type: string; scope: string; kg_co2_mwh: number; kg_co2_mwh_with_losses: number; generation_share_pct: number; annual_abatement_potential_gt: number }
export interface EmissionsTrajectory { year: number; actual_emissions_mt: number | null; forecast_emissions_mt: number | null; renewable_share_pct: number; emissions_intensity_avg: number; vs_2005_baseline_pct: number }
export interface Scope2Calculator { state: string; consumption_gwh: number; emissions_factor_kg_co2_mwh: number; scope2_emissions_t_co2: number; green_power_offset_pct: number; net_scope2_t_co2: number }
export interface CarbonDashboard { timestamp: string; nem_emissions_intensity_now: number; lowest_region: string; lowest_intensity: number; highest_region: string; highest_intensity: number; renewable_share_now_pct: number; vs_same_time_last_year_pct: number; annual_trajectory: EmissionsTrajectory[]; region_records: RegionEmissionsRecord[]; fuel_factors: FuelEmissionsFactor[]; scope2_by_state: Scope2Calculator[] }

// ---------------------------------------------------------------------------
// Sprint 24a — OTC Hedging interfaces
// ---------------------------------------------------------------------------
export interface HedgeContract { contract_id: string; contract_type: string; region: string; counterparty: string; start_date: string; end_date: string; strike_price: number; volume_mw: number; volume_mwh: number; premium_paid_aud: number; mtm_value_aud: number; pnl_aud: number; hedge_period: string; status: string; underlying: string }
export interface HedgePortfolioSummary { region: string; total_hedged_mw: number; expected_generation_mw: number; hedge_ratio_pct: number; avg_swap_price: number; mtm_total_aud: number; unrealised_pnl_aud: number; var_95_aud: number; var_99_aud: number; cap_protection_pct: number; num_active_contracts: number }
export interface HedgingDashboard { timestamp: string; total_portfolio_mtm_aud: number; total_unrealised_pnl_aud: number; portfolio_var_95_aud: number; weighted_avg_hedge_price: number; overall_hedge_ratio_pct: number; contracts: HedgeContract[]; portfolio_by_region: HedgePortfolioSummary[]; quarterly_position: Array<{quarter: string; hedged_mw: number; spot_ref: number; contract_price: number}> }

// ---------------------------------------------------------------------------
// Sprint 24b — Hydro Storage interfaces
// ---------------------------------------------------------------------------
export interface ReservoirRecord { reservoir_id: string; name: string; scheme: string; region: string; state: string; current_storage_gl: number; full_supply_level_gl: number; dead_storage_gl: number; percent_full: number; usable_storage_gl: number; usable_pct: number; inflow_7d_gl: number; outflow_7d_gl: number; net_change_7d_gl: number; energy_potential_gwh: number; last_updated: string }
export interface HydroInflowForecast { scheme: string; region: string; forecast_period: string; inflow_gl: number; vs_median_pct: number; probability_exceedance_pct: number; confidence: string; scenario: string }
export interface WaterValuePoint { usable_storage_pct: number; water_value_aud_ml: number; season: string; regime: string }
export interface HydroSchemeSummary { scheme: string; region: string; total_capacity_mw: number; total_storage_gl: number; total_storage_pct: number; avg_water_value_aud_ml: number; num_stations: number; annual_energy_twh: number; critical_storage_threshold_pct: number }
export interface HydroDashboard { timestamp: string; total_nem_hydro_storage_pct: number; vs_last_year_pct_pts: number; critical_reservoirs: number; forecast_outlook: string; schemes: HydroSchemeSummary[]; reservoirs: ReservoirRecord[]; inflow_forecasts: HydroInflowForecast[]; water_value_curve: WaterValuePoint[] }

// ---------------------------------------------------------------------------
// Sprint 24c — Market Power & HHI interfaces
// ---------------------------------------------------------------------------
export interface HhiRecord { region: string; fuel_type: string | null; hhi_score: number; num_competitors: number; top3_share_pct: number; market_structure: string; trend_direction: string; change_vs_last_year: number }
export interface PivotalSupplierRecord { participant_id: string; participant_name: string; region: string; pivotal_status: string; capacity_mw: number; residual_supply_index: number; occurrence_frequency_pct: number; strategic_capacity_mw: number; avg_rebids_per_day: number }
export interface MarketShareTrend { participant_name: string; participant_type: string; year: number; quarter: string; generation_share_pct: number; retail_share_pct: number | null; capacity_mw: number }
export interface MarketPowerDashboard { timestamp: string; nem_overall_hhi: number; sa1_hhi: number; concentration_trend: string; pivotal_suppliers_count: number; quasi_pivotal_count: number; market_review_status: string; hhi_records: HhiRecord[]; pivotal_suppliers: PivotalSupplierRecord[]; share_trends: MarketShareTrend[] }

// ---------------------------------------------------------------------------
// Sprint 25a — PASA interfaces
// ---------------------------------------------------------------------------
export interface PasaPeriod { period: string; start_date: string; end_date: string; region: string; peak_demand_mw: number; scheduled_generation_mw: number; semi_scheduled_mw: number; non_scheduled_mw: number; total_available_mw: number; reserve_margin_mw: number; reserve_margin_pct: number; lor_risk: string; probability_shortage_pct: number }
export interface ForcedOutageRecord { duid: string; station_name: string; fuel_type: string; region: string; unit_capacity_mw: number; outage_start: string; outage_end: string | null; duration_hours: number | null; outage_type: string; cause: string; mw_lost: number; status: string; return_to_service: string | null }
export interface GeneratorReliabilityStats { duid: string; station_name: string; fuel_type: string; region: string; capacity_mw: number; equivalent_forced_outage_rate_pct: number; planned_outage_rate_pct: number; availability_pct: number; forced_outages_last_12m: number; avg_outage_duration_hrs: number; unplanned_energy_unavailability_pct: number }
export interface PasaAdequacyDashboard { timestamp: string; assessment_horizon_weeks: number; regions_with_lor_risk: string[]; min_reserve_margin_mw: number; min_reserve_margin_region: string; total_forced_outages_active: number; total_mw_forced_out: number; high_efor_generators: number; pasa_periods: PasaPeriod[]; forced_outages: ForcedOutageRecord[]; reliability_stats: GeneratorReliabilityStats[] }

// Sprint 25b — SRA Auction interfaces
export interface SraUnit { unit_id: string; interconnector_id: string; direction: string; quarter: string; allocated_mw: number; auction_price_aud_mwh: number; holder_participant: string; utilisation_pct: number; residue_revenue_aud: number; net_value_aud: number; status: string }
export interface SraAuctionResult { auction_id: string; auction_date: string; quarter: string; interconnector_id: string; direction: string; total_units_offered_mw: number; total_bids_received_mw: number; clearing_price_aud_mwh: number; units_allocated_mw: number; over_subscription_ratio: number; total_revenue_aud: number; num_participants: number; weighted_avg_bid: number }
export interface InterconnectorRevenueSummary { interconnector_id: string; from_region: string; to_region: string; quarter: string; total_flow_twh: number; avg_price_differential: number; total_settlement_residue_aud: number; sra_revenue_allocated_pct: number; congestion_hours_pct: number; thermal_limit_mw: number; avg_utilisation_pct: number }
export interface SraDashboard { timestamp: string; current_quarter: string; total_sra_units_active: number; total_sra_revenue_this_quarter: number; best_performing_interconnector: string; total_residues_distributed_aud: number; auction_results: SraAuctionResult[]; active_units: SraUnit[]; interconnector_revenue: InterconnectorRevenueSummary[] }

// ---------------------------------------------------------------------------
// Sprint 25c — Corporate PPA interfaces
// ---------------------------------------------------------------------------
export interface CorporatePpa { ppa_id: string; project_name: string; technology: string; region: string; capacity_mw: number; offtaker: string; offtaker_sector: string; ppa_price_aud_mwh: number; contract_start: string; contract_end: string; term_years: number; annual_energy_gwh: number; lgc_included: boolean; structure: string; status: string }
export interface LgcMarket { calendar_year: number; lgc_spot_price_aud: number; lgc_forward_price_aud: number; lgcs_created_this_year_m: number; lgcs_surrendered_this_year_m: number; lgcs_banked_m: number; voluntary_surrender_pct: number; shortfall_charge_risk: string }
export interface BehindMeterAsset { asset_id: string; asset_type: string; state: string; capacity_kw: number; installed_count: number; total_installed_mw: number; avg_capacity_factor_pct: number; annual_generation_gwh: number; avoided_grid_cost_m_aud: number; certificates_eligible: string }
export interface PpaDashboard { timestamp: string; total_ppa_capacity_gw: number; active_ppas: number; pipeline_ppas: number; avg_ppa_price_aud_mwh: number; tech_mix: Array<{technology: string; capacity_gw: number; pct: number}>; lgc_spot_price: number; rooftop_solar_total_gw: number; ppas: CorporatePpa[]; lgc_market: LgcMarket[]; behind_meter_assets: BehindMeterAsset[] }

// ---------------------------------------------------------------------------
// Sprint 26b — Pre-dispatch & 5-min settlement interfaces
// ---------------------------------------------------------------------------
export interface PredispatchInterval { interval: string; region: string; predispatch_price: number; actual_price: number; price_error: number; predispatch_demand_mw: number; actual_demand_mw: number; demand_error_mw: number; predispatch_generation_mw: number; actual_generation_mw: number; generation_error_mw: number; constraint_active: boolean }
export interface FiveMinuteSettlementSummary { region: string; trading_period: string; num_intervals: number; min_price: number; max_price: number; avg_price: number; trading_price: number; five_min_vs_30min_diff: number; high_volatility: boolean }
export interface DispatchAccuracyStats { region: string; date: string; mean_absolute_error_aud: number; root_mean_square_error_aud: number; bias_aud: number; accuracy_within_10pct: number; spike_detection_rate_pct: number; predispatch_horizon: string }
export interface DispatchDashboard { timestamp: string; region: string; today_avg_price_error: number; today_max_price_error: number; five_min_settlement_advantage_generators: number; intervals_with_spikes: number; intervals_with_negative_prices: number; accuracy_stats: DispatchAccuracyStats[]; predispatch_intervals: PredispatchInterval[]; five_min_summary: FiveMinuteSettlementSummary[] }

// ---------------------------------------------------------------------------
// Sprint 26a — Regulatory interfaces
// ---------------------------------------------------------------------------
export interface RuleChangeRequest { rcr_id: string; title: string; proponent: string; category: string; status: string; lodged_date: string; consultation_close: string | null; determination_date: string | null; effective_date: string | null; description: string; impact_level: string; affected_parties: string[]; aemc_link: string | null }
export interface AerDetermination { determination_id: string; title: string; body: string; determination_type: string; network_business: string; state: string; decision_date: string; effective_period: string; allowed_revenue_m_aud: number | null; capex_allowance_m_aud: number | null; opex_allowance_m_aud: number | null; wacc_pct: number | null; status: string }
export interface RegulatoryCalendarEvent { event_id: string; event_type: string; title: string; body: string; date: string; days_from_now: number; urgency: string; related_rcr: string | null }
export interface RegulatoryDashboard { timestamp: string; open_consultations: number; draft_rules: number; final_rules_this_year: number; transformative_changes: number; upcoming_deadlines: number; rule_changes: RuleChangeRequest[]; aer_determinations: AerDetermination[]; calendar_events: RegulatoryCalendarEvent[] }

// ---------------------------------------------------------------------------
// Sprint 26c — ISP Transmission Tracker interfaces
// ---------------------------------------------------------------------------
export interface IspProjectMilestone { milestone_id: string; milestone_name: string; planned_date: string; actual_date: string | null; status: string; delay_months: number }
export interface IspMajorProject { project_id: string; project_name: string; tnsp: string; regions_connected: string[]; project_type: string; isp_action: string; total_capex_m_aud: number; sunk_cost_to_date_m_aud: number; committed_capex_m_aud: number; circuit_km: number; voltage_kv: number; thermal_limit_mw: number; construction_start: string | null; commissioning_date: string; current_status: string; rit_t_complete: boolean; overall_progress_pct: number; milestones: IspProjectMilestone[]; net_market_benefit_m_aud: number; bcr: number }
export interface TnspCapexProgram { tnsp: string; regulatory_period: string; states: string[]; total_approved_capex_m_aud: number; spent_to_date_m_aud: number; remaining_m_aud: number; spend_rate_pct: number; major_projects: string[]; regulatory_body: string }
export interface IspDashboard { timestamp: string; total_pipeline_capex_bn_aud: number; committed_projects: number; projects_under_construction: number; total_new_km: number; total_new_capacity_mw: number; delayed_projects: number; isp_projects: IspMajorProject[]; tnsp_programs: TnspCapexProgram[] }

// ---------------------------------------------------------------------------
// Sprint 27a — Solar EV Analytics interfaces
// ---------------------------------------------------------------------------
export interface SolarGenerationRecord { state: string; postcode_zone: string; installed_capacity_mw: number; avg_generation_mw: number; capacity_factor_pct: number; num_systems: number; avg_system_size_kw: number; curtailment_mw: number; export_to_grid_mw: number; self_consumption_mw: number; nem_impact_mw: number }
export interface EvFleetRecord { state: string; ev_type: string; total_vehicles: number; annual_growth_pct: number; avg_battery_size_kwh: number; avg_daily_km: number; daily_charging_demand_mwh: number; peak_charging_hour: number; smart_charging_capable_pct: number; v2g_capable_pct: number; v2g_potential_mw: number }
export interface SolarEvDashboard { timestamp: string; total_rooftop_solar_gw: number; current_rooftop_generation_gw: number; nem_solar_pct: number; total_evs: number; bev_count: number; total_ev_charging_demand_mw: number; v2g_fleet_potential_mw: number; minimum_demand_impact_mw: number; solar_records: SolarGenerationRecord[]; ev_records: EvFleetRecord[]; hourly_profile: Array<{hour: number; solar_mw: number; ev_charging_mw: number; net_demand_mw: number}>; growth_projection: Array<{year: number; solar_gw: number; ev_millions: number}> }

// Sprint 27b — LRMC Investment Signal interfaces
export interface LcoeTechnology { technology: string; region: string; lcoe_low_aud_mwh: number; lcoe_mid_aud_mwh: number; lcoe_high_aud_mwh: number; capacity_factor_pct: number; capex_aud_kw: number; opex_aud_mwh: number; discount_rate_pct: number; economic_life_years: number; is_dispatchable: boolean; co2_intensity_kg_mwh: number; learning_rate_pct: number }
export interface InvestmentSignal { technology: string; region: string; signal: string; spot_price_avg_aud_mwh: number; futures_price_aud_mwh: number; lcoe_mid_aud_mwh: number; margin_aud_mwh: number; irr_pct: number; payback_years: number; revenue_adequacy_pct: number }
export interface CapacityMechanismScenario { scenario: string; description: string; additional_capacity_gw: number; cost_to_consumers_m_aud: number; reliability_improvement_pct: number; recommended_technologies: string[] }
export interface LrmcDashboard { timestamp: string; avg_nem_lrmc_aud_mwh: number; cheapest_new_entrant: string; cheapest_lcoe_aud_mwh: number; technologies_above_market: number; best_investment_region: string; lcoe_technologies: LcoeTechnology[]; investment_signals: InvestmentSignal[]; capacity_scenarios: CapacityMechanismScenario[] }

// ---------------------------------------------------------------------------
// Sprint 27c — Network Constraint interfaces
// ---------------------------------------------------------------------------
export interface ConstraintEquation { constraint_id: string; constraint_name: string; constraint_type: string; binding: boolean; region: string; rhs_value: number; lhs_value: number; slack_mw: number; marginal_value: number; generic_equation: string; connected_duids: string[]; frequency_binding_pct: number; annual_cost_est_m_aud: number }
export interface ConstraintSummaryByRegion { region: string; active_constraints: number; binding_constraints: number; critical_constraints: number; total_cost_m_aud_yr: number; most_binding_constraint: string; interconnector_limited: boolean }
export interface ConstraintViolationRecord { violation_id: string; constraint_id: string; region: string; dispatch_interval: string; violation_mw: number; dispatch_price_impact: number; cause: string; resolved: boolean }
export interface ConstraintDashboard { timestamp: string; total_active_constraints: number; binding_constraints_now: number; total_annual_constraint_cost_m_aud: number; most_constrained_region: string; violations_today: number; region_summaries: ConstraintSummaryByRegion[]; constraint_equations: ConstraintEquation[]; violations: ConstraintViolationRecord[] }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const BASE_URL = ''
const headers = { Accept: 'application/json' }

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function post<TBody, TResponse>(path: string, body: TBody): Promise<TResponse> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<TResponse>
}

async function del(path: string): Promise<void> {
  const res = await fetch(path, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  // 204 No Content is a success
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status} ${res.statusText}: ${text}`)
  }
}

// ---------------------------------------------------------------------------
// API client object
// ---------------------------------------------------------------------------

export const api = {
  /**
   * Get the latest spot prices for all (or one) NEM region.
   */
  getLatestPrices(): Promise<RegionPrice[]> {
    return get<RegionPrice[]>('/api/prices/latest')
  },

  /**
   * Get 5-min or aggregated price history for a region over a time range.
   * @param region  NEM region code (NSW1, QLD1, VIC1, SA1, TAS1)
   * @param start   ISO-8601 datetime string
   * @param end     ISO-8601 datetime string
   */
  getPriceHistory(region: string, start: string, end: string): Promise<PricePoint[]> {
    const params = new URLSearchParams({ region, start, end })
    return get<PricePoint[]>(`/api/prices/history?${params}`)
  },

  /**
   * Get price forecasts for a region at a specific horizon.
   * @param region  NEM region code
   * @param horizon One of: "1hr" | "4hr" | "24hr"
   */
  getForecasts(region: string, horizon: string): Promise<ForecastPoint[]> {
    const params = new URLSearchParams({ region, horizon })
    return get<ForecastPoint[]>(`/api/forecasts?${params}`)
  },

  /**
   * Get generation mix (MW by fuel type) for a region over a time range.
   */
  getGeneration(region: string, start: string, end: string): Promise<GenerationDataPoint[]> {
    const params = new URLSearchParams({ region, start, end })
    return get<GenerationDataPoint[]>(`/api/generation?${params}`)
  },

  /**
   * Get current interconnector flows across the NEM (legacy flat list).
   * @deprecated Use getInterconnectorsSummary for the full summary with congestion data.
   */
  getInterconnectors(): Promise<InterconnectorFlow[]> {
    return get<InterconnectorFlow[]>('/api/interconnectors')
  },

  /**
   * Get NEM interconnector power flows with congestion detection.
   * Returns InterconnectorSummary containing all 5 NEM interconnectors.
   * @param intervals  Number of 5-min intervals of history (default 12)
   */
  async getInterconnectorsSummary(intervals = 12): Promise<InterconnectorSummary> {
    const res = await fetch(`/api/interconnectors?intervals=${intervals}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error('Failed to fetch interconnector data')
    return res.json()
  },

  /**
   * Get NEM settlement summary — one record per region for the current trading interval.
   * Includes demand, net interchange, spot price, and FCAS ancillary service prices.
   */
  async getSettlementSummary(): Promise<SettlementRecord[]> {
    const res = await fetch('/api/settlement/summary', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error('Failed to fetch settlement summary')
    return res.json()
  },

  /**
   * Get active and recently triggered alerts.
   */
  getAlerts(): Promise<Alert[]> {
    return get<Alert[]>('/api/alerts')
  },

  /**
   * Create a new alert configuration.
   * @param data  Alert creation payload including region, type, threshold, and channel
   * @returns     The newly created Alert record (HTTP 201)
   */
  createAlert(data: AlertCreateRequest): Promise<Alert> {
    return post<AlertCreateRequest, Alert>('/api/alerts', data)
  },

  /**
   * Delete an alert by ID.
   * @param id  Alert UUID
   */
  deleteAlert(id: string): Promise<void> {
    return del(`/api/alerts/${id}`)
  },

  /**
   * Get the most recent daily market summary narrative.
   * Cached for 1 hour on the backend (summary pipeline runs once daily at 05:30 AEST).
   */
  getMarketSummary(): Promise<MarketSummaryRecord> {
    return get<MarketSummaryRecord>('/api/market-summary/latest')
  },

  /**
   * Send a chat message to the Copilot agent.
   * Returns an EventSource for SSE streaming (text/event-stream).
   * Each event carries `data: {"delta": "..."}` or `data: [DONE]`.
   *
   * The caller is responsible for calling `eventSource.close()` when done.
   *
   * Note: EventSource only supports GET requests natively. For POST + SSE
   * we use the fetch API with streaming in ChatInterface.tsx instead.
   * This method is provided for convenience when a GET endpoint is available.
   *
   * @param message  The user's message text
   * @param history  Prior conversation turns [{ role, content }, …]
   */
  sendChat(
    message: string,
    history: { role: string; content: string }[]
  ): EventSource {
    // Encode payload in query string (base64) for GET-based SSE.
    // The FastAPI backend accepts either GET /api/chat?payload=<b64> or
    // POST /api/chat with JSON body — the ChatInterface component uses
    // the POST + fetch approach for richer control; this method covers
    // the EventSource (GET) approach.
    const payload = btoa(
      JSON.stringify({ message, history })
    )
    return new EventSource(`/api/chat?payload=${encodeURIComponent(payload)}`)
  },

  /**
   * Get system-wide health status including DB connectivity, model registry,
   * data freshness, and pipeline last run time.
   */
  getSystemHealth(): Promise<SystemHealthResponse> {
    return get<SystemHealthResponse>('/api/system/health')
  },

  /**
   * List recent copilot sessions, sorted by last_active descending.
   * @param limit  Maximum number of sessions to return (default 20)
   */
  listSessions(limit?: number): Promise<CopilotSession[]> {
    const params = limit ? `?limit=${limit}` : ''
    return get<CopilotSession[]>(`/api/sessions${params}`)
  },

  /**
   * Get a full session record including message history.
   * @param sessionId  Session UUID
   */
  getSession(sessionId: string): Promise<CopilotSession> {
    return get<CopilotSession>(`/api/sessions/${sessionId}`)
  },

  /**
   * Create a new copilot session.
   * @returns  The newly created CopilotSession (HTTP 201)
   */
  createSession(): Promise<CopilotSession> {
    return post<Record<string, never>, CopilotSession>('/api/sessions', {})
  },

  /**
   * Rate a copilot session (1-5 stars).
   * @param sessionId  Session UUID
   * @param rating     Integer rating from 1 to 5
   */
  rateSession(sessionId: string, rating: number): Promise<void> {
    return post<{ rating: number }, void>(`/api/sessions/${sessionId}/rating`, { rating })
  },

  /**
   * Delete a copilot session by ID.
   * @param sessionId  Session UUID
   */
  deleteSession(sessionId: string): Promise<void> {
    return del(`/api/sessions/${sessionId}`)
  },

  /**
   * Get multi-region price comparison in pivoted format (one row per timestamp,
   * one column per NEM region).
   * @param start           ISO-8601 start datetime
   * @param end             ISO-8601 end datetime
   * @param intervalMinutes Aggregation interval in minutes (5, 15, 30, 60)
   */
  getPricesCompare(
    start: string,
    end: string,
    intervalMinutes?: number
  ): Promise<RegionComparisonPoint[]> {
    const params = new URLSearchParams({ start, end })
    if (intervalMinutes) params.set('interval_minutes', String(intervalMinutes))
    return get<RegionComparisonPoint[]>(`/api/prices/compare?${params}`)
  },

  /**
   * Get binding network constraints for a region.
   * @param region      NEM region code (NSW1, QLD1, VIC1, SA1, TAS1)
   * @param hoursBack   Look-back window in hours (1–168)
   * @param bindingOnly When true, only return constraints with marginalvalue > 0
   */
  getConstraints(region: string, hoursBack: number, bindingOnly: boolean): Promise<ConstraintRecord[]> {
    const params = new URLSearchParams({ region, hours_back: String(hoursBack), binding_only: String(bindingOnly) })
    return get<ConstraintRecord[]>(`/api/constraints?${params}`)
  },

  /**
   * Get FCAS market prices and clearings for a region.
   * @param region    NEM region code
   * @param hoursBack Look-back window in hours (1–48)
   */
  getFcas(region: string, hoursBack: number): Promise<FcasRecord[]> {
    const params = new URLSearchParams({ region, hours_back: String(hoursBack) })
    return get<FcasRecord[]>(`/api/fcas/market?${params}`)
  },

  /**
   * Get forecast model accuracy summary including MAPE metrics by horizon.
   * Returns model confidence, price and demand MAPE for 1hr, 4hr, and 24hr horizons.
   */
  getForecastSummary(): Promise<ForecastSummary> {
    return get<ForecastSummary>('/api/forecasts/summary')
  },

  /**
   * Get alert trigger event history.
   * @param region    Optional NEM region code filter
   * @param hoursBack Number of hours back to query (1–168, default 24)
   */
  getAlertHistory(region?: string, hoursBack?: number): Promise<AlertTriggerEvent[]> {
    const params = new URLSearchParams()
    if (region) params.set('region', region)
    if (hoursBack) params.set('hours_back', String(hoursBack))
    return get<AlertTriggerEvent[]>(`/api/alerts/history?${params}`)
  },

  /**
   * Send a test notification via the specified channel.
   * @param channel    Delivery channel: "slack" | "email" | "webhook"
   * @param webhookUrl Optional webhook URL (required for slack/webhook channels)
   */
  testNotification(channel: string, webhookUrl?: string): Promise<{ success: boolean; message: string; channel: string }> {
    return post('/api/alerts/test-notification', { channel, webhook_url: webhookUrl, test_message: 'AUS Energy Copilot — test notification' })
  },

  /**
   * Get alert summary statistics (total, triggered 24h, notifications sent, etc.).
   */
  getAlertStats(): Promise<AlertStats> {
    return get<AlertStats>('/api/alerts/stats')
  },

  /**
   * Get price spike events for a region over the requested look-back window.
   * @param region     NEM region code (default: NSW1)
   * @param hoursBack  Look-back window in hours (default: 24)
   * @param spikeType  Optional filter: "high" | "voll" | "negative"
   */
  getPriceSpikes(region = 'NSW1', hoursBack = 24, spikeType?: string): Promise<PriceSpikeEvent[]> {
    const params = new URLSearchParams({ region, hours_back: String(hoursBack) })
    if (spikeType) params.set('spike_type', spikeType)
    return get<PriceSpikeEvent[]>(`/api/prices/spikes?${params}`)
  },

  /**
   * Get volatility statistics and CPT utilisation for all 5 NEM regions.
   */
  getVolatilityStats(): Promise<SpikeAnalysisSummary> {
    return get<SpikeAnalysisSummary>('/api/prices/volatility')
  },

  /**
   * Get individual generator units for a region with optional fuel type and output filters.
   * @param region      NEM region code (default: NSW1)
   * @param fuelType    Optional fuel type filter e.g. "Coal", "Wind"
   * @param minOutput   Minimum current output in MW (default: 0)
   */
  getGenerationUnits(region = 'NSW1', fuelType?: string, minOutput = 0): Promise<GeneratorRecord[]> {
    const params = new URLSearchParams({ region, min_output_mw: String(minOutput) })
    if (fuelType) params.set('fuel_type', fuelType)
    return get<GeneratorRecord[]>(`/api/generation/units?${params}`)
  },

  /**
   * Get aggregated generation fuel mix summary with renewable penetration and carbon intensity.
   * @param region  NEM region code (default: NSW1)
   */
  getGenerationMix(region = 'NSW1'): Promise<GenerationSummary> {
    return get<GenerationSummary>(`/api/generation/mix?region=${region}`)
  },

  /**
   * Get AEMO market notices (LOR, constraint binding, reclassification, price limit, general).
   * @param severity    Optional filter: "INFO" | "WARNING" | "CRITICAL"
   * @param noticeType  Optional filter: "LOR" | "CONSTRAINT" | "RECLASSIFICATION" | "PRICE_LIMIT" | "GENERAL"
   * @param limit       Maximum number of notices to return (default 20)
   */
  getMarketNotices: async (severity?: string, noticeType?: string, limit = 20): Promise<MarketNotice[]> => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (severity) params.set('severity', severity)
    if (noticeType) params.set('notice_type', noticeType)
    const res = await fetch(`/api/market/notices?${params}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error('Failed to fetch market notices')
    return res.json()
  },

  /**
   * Get 5-minute dispatch interval analysis with actual RRP vs pre-dispatch forecast.
   * @param region  NEM region code (default: NSW1)
   * @param count   Number of 5-minute intervals (default 12 = 1 hour)
   */
  getDispatchIntervals: async (region = 'NSW1', count = 12): Promise<DispatchSummary> => {
    const res = await fetch(`/api/dispatch/intervals?region=${region}&count=${count}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error('Failed to fetch dispatch intervals')
    return res.json()
  },

  /**
   * Get hourly temperature and electricity demand data for a region.
   * @param region  NEM region code (default: NSW1)
   * @param hours   Number of hours of history (default: 24)
   */
  getWeatherDemand: async (region = 'NSW1', hours = 24): Promise<WeatherDemandPoint[]> => {
    const res = await fetch(`${BASE_URL}/api/weather/demand?region=${region}&hours=${hours}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch weather demand data')
    return res.json()
  },

  /**
   * Get demand response program summary and event list.
   * @param region  Optional NEM region filter (omit for all regions)
   */
  getDemandResponse: async (region?: string): Promise<DemandResponseSummary> => {
    const params = region ? `?region=${region}` : ''
    const res = await fetch(`${BASE_URL}/api/demand/response${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch demand response data')
    return res.json()
  },

  /**
   * Get BESS fleet summary with SOC, mode, and revenue for all NEM battery units.
   */
  getBessFleet: async (): Promise<BessFleetSummary> => {
    const res = await fetch(`${BASE_URL}/api/bess/fleet`, { headers })
    if (!res.ok) throw new Error('Failed to fetch BESS fleet')
    return res.json()
  },

  /**
   * Get BESS dispatch history (charge/discharge intervals) for a single unit.
   * @param duid   BESS unit DUID
   * @param count  Number of 5-min intervals to return (default 24 = 2 hours)
   */
  getBessDispatch: async (duid: string, count = 24): Promise<BessDispatchInterval[]> => {
    const res = await fetch(`${BASE_URL}/api/bess/dispatch?duid=${encodeURIComponent(duid)}&count=${count}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch BESS dispatch')
    return res.json()
  },

  /**
   * Get the portfolio trading desk summary including all generation assets,
   * hedge positions, MtM P&L, and region P&L breakdown.
   */
  getPortfolioSummary: async (): Promise<PortfolioSummary> => {
    const res = await fetch(`${BASE_URL}/api/portfolio/summary`, { headers })
    if (!res.ok) throw new Error('Failed to fetch portfolio summary')
    return res.json()
  },

  /**
   * Get daily P&L history for the trading desk portfolio.
   * @param days  Number of days of history to return (default 7)
   */
  getPortfolioPnlHistory: async (days = 7): Promise<Record<string, number>[]> => {
    const res = await fetch(`${BASE_URL}/api/portfolio/pnl_history?days=${days}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch P&L history')
    return res.json()
  },

  /**
   * Get the full carbon & sustainability dashboard including NEM decarbonisation
   * stats, LGC market prices, regional carbon intensities, and 24-hour trend.
   * @param region  NEM region code for the intensity_history series (default: NSW1)
   */
  getSustainabilityDashboard: async (region = 'NSW1'): Promise<SustainabilityDashboard> => {
    const res = await fetch(`${BASE_URL}/api/sustainability/dashboard?region=${region}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch sustainability dashboard')
    return res.json()
  },

  /**
   * Get hourly carbon intensity history for a NEM region.
   * @param region  NEM region code (default: NSW1)
   * @param hours   Number of hours of history to return (default: 24)
   */
  getCarbonIntensityHistory: async (region = 'NSW1', hours = 24): Promise<CarbonIntensityRecord[]> => {
    const res = await fetch(`${BASE_URL}/api/sustainability/intensity_history?region=${region}&hours=${hours}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch carbon intensity history')
    return res.json()
  },

  /**
   * Get the merit order curve for a NEM region.
   * Units are sorted by SRMC ascending. The marginal generator is the first
   * unit whose cumulative MW meets or exceeds current demand.
   * @param region  NEM region code (default: NSW1)
   */
  getMeritOrder: async (region = 'NSW1'): Promise<MeritOrderCurve> => {
    const res = await fetch(`${BASE_URL}/api/merit/order?region=${region}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch merit order')
    return res.json()
  },

  /**
   * Get the ML experiment and model management dashboard.
   * Returns recent MLflow runs, feature importance, and drift summary.
   */
  getMlDashboard: async (): Promise<MlDashboardData> => {
    const res = await fetch(`${BASE_URL}/api/ml/dashboard`, { headers })
    if (!res.ok) throw new Error('Failed to fetch ML dashboard')
    return res.json()
  },

  /**
   * Get a filtered list of recent MLflow training runs.
   * @param modelType  Optional model type filter, e.g. "price_forecast"
   * @param region     Optional NEM region filter, e.g. "NSW1"
   * @param limit      Maximum number of runs to return (default 20)
   */
  getMlRuns: async (modelType?: string, region?: string, limit = 20): Promise<MlflowRun[]> => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (modelType) params.set('model_type', modelType)
    if (region) params.set('region', region)
    const res = await fetch(`${BASE_URL}/api/ml/runs?${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch ML runs')
    return res.json()
  },

  /**
   * Get the Data Pipeline & Catalog Health Dashboard.
   * Returns DLT pipeline runs, Unity Catalog table freshness, and DQ expectations.
   */
  getCatalogDashboard: async (): Promise<DataCatalogDashboard> => {
    const res = await fetch(`${BASE_URL}/api/catalog/dashboard`, { headers })
    if (!res.ok) throw new Error('Failed to fetch catalog dashboard')
    return res.json()
  },

  /**
   * Get a filtered list of recent DLT pipeline runs.
   * @param pipelineName  Optional pipeline name filter, e.g. "nemweb_bronze_pipeline"
   * @param status        Optional status filter: COMPLETED, RUNNING, FAILED, WAITING
   * @param limit         Maximum number of runs to return (default 20)
   */
  getPipelineRuns: async (pipelineName?: string, status?: string, limit = 20): Promise<PipelineRunRecord[]> => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (pipelineName) params.set('pipeline_name', pipelineName)
    if (status) params.set('status', status)
    const res = await fetch(`${BASE_URL}/api/catalog/pipeline_runs?${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch pipeline runs')
    return res.json()
  },

  /**
   * Run a what-if scenario analysis with the given parameter inputs.
   * Returns price/demand impact, renewable % change, marginal generator shift,
   * key drivers, and a sensitivity table.
   */
  runScenario: async (input: ScenarioInput): Promise<ScenarioComparison> => {
    const res = await fetch(`${BASE_URL}/api/scenario/run`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error('Failed to run scenario')
    return res.json()
  },

  /**
   * Get pre-built scenario presets (Hot Summer Day, Cold Snap, Wind Drought, etc.).
   */
  getScenarioPresets: async (): Promise<Record<string, unknown>[]> => {
    const res = await fetch(`${BASE_URL}/api/scenario/presets`, { headers })
    if (!res.ok) throw new Error('Failed to fetch scenario presets')
    return res.json()
  },

  /**
   * Get 101-point load and price duration curves for a NEM region.
   * Each point represents a percentile (0=minimum, 100=peak).
   * Both demand and price are monotonically decreasing with percentile.
   * @param region      NEM region code (default: NSW1)
   * @param periodDays  Look-back period in days (default: 365)
   */
  getDurationCurve: async (region = 'NSW1', periodDays = 365): Promise<DurationCurvePoint[]> => {
    const res = await fetch(`${BASE_URL}/api/stats/duration_curve?region=${region}&period_days=${periodDays}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch duration curve')
    return res.json()
  },

  /**
   * Get box-plot statistics for demand and price for a NEM region.
   * Includes percentile breakdown, mean, stddev, and demand-price correlation.
   * @param region  NEM region code (default: NSW1)
   * @param period  Period string: "30d" | "90d" | "365d" (default: "365d")
   */
  getStatsSummary: async (region = 'NSW1', period = '365d'): Promise<StatisticalSummary> => {
    const res = await fetch(`${BASE_URL}/api/stats/summary?region=${region}&period=${period}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch stats summary')
    return res.json()
  },

  /**
   * Get 12 monthly seasonal pattern records (Jan–Dec) for a NEM region.
   * Shows average demand, average price, peak demand, and renewable share per month.
   * @param region  NEM region code (default: NSW1)
   */
  getSeasonalPattern: async (region = 'NSW1'): Promise<SeasonalPattern[]> => {
    const res = await fetch(`${BASE_URL}/api/stats/seasonal?region=${region}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch seasonal pattern')
    return res.json()
  },

  /**
   * Get multi-year NEM market trend data with CAGR calculations and energy transition metrics.
   * Covers price milestones: 2017 gas constraints (~$100/MWh), 2020 COVID low (~$45),
   * 2022 gas crisis (~$180), 2024 renewables normalising (~$75).
   * @param region     NEM region code (default: NSW1)
   * @param startYear  First year of the analysis range (default: 2015)
   * @param endYear    Last year of the analysis range (default: 2025)
   */
  getAnnualTrends: async (region = 'NSW1', startYear = 2015, endYear = 2025): Promise<LongRunTrendSummary> => {
    const res = await fetch(`${BASE_URL}/api/trends/annual?region=${region}&start_year=${startYear}&end_year=${endYear}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch annual trends')
    return res.json()
  },

  /**
   * Get year-over-year metric changes for a NEM region comparing the specified year vs prior year.
   * Metrics: avg_price, peak_demand, renewable_pct, carbon_intensity, spike_events, negative_hours.
   * Trend values: "improving" | "worsening" | "neutral"
   * @param region  NEM region code (default: NSW1)
   * @param year    Year to compare against the prior year (default: 2024)
   */
  getYoyChanges: async (region = 'NSW1', year = 2024): Promise<YearOverYearChange[]> => {
    const res = await fetch(`${BASE_URL}/api/trends/yoy?region=${region}&year=${year}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch YoY changes')
    return res.json()
  },

  /**
   * Get the real-time system frequency and inertia dashboard.
   * Returns current frequency Hz, ROCOF, last 5 minutes of 5-second frequency
   * history, inertia by region, and recent frequency events from the past 24h.
   * Cache TTL: 5 seconds (very fresh).
   */
  getFrequencyDashboard: async (): Promise<FrequencyDashboard> => {
    const res = await fetch(`${BASE_URL}/api/frequency/dashboard`, { headers })
    if (!res.ok) throw new Error('Failed to fetch frequency dashboard')
    return res.json()
  },

  /**
   * Get per-minute frequency history for a NEM region.
   * @param region   NEM region code (default: NSW1)
   * @param minutes  Number of minutes of history to return (default: 60)
   */
  getFrequencyHistory: async (region = 'NSW1', minutes = 60): Promise<FrequencyRecord[]> => {
    const res = await fetch(`${BASE_URL}/api/frequency/history?region=${region}&minutes=${minutes}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch frequency history')
    return res.json()
  },

  /**
   * Get the ASX Energy Futures dashboard for a NEM region.
   * Includes CAL and quarterly contracts, forward curve, and hedge effectiveness analytics.
   * @param region  NEM region code (default: NSW1)
   */
  getFuturesDashboard: async (region = 'NSW1'): Promise<FuturesDashboard> => {
    const res = await fetch(`${BASE_URL}/api/futures/dashboard?region=${region}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch futures dashboard')
    return res.json()
  },

  /**
   * Get a filtered list of ASX Energy futures contracts for a NEM region.
   * @param region        NEM region code (default: NSW1)
   * @param contractType  Optional filter: "CAL" | "Q1" | "Q2" | "Q3" | "Q4"
   */
  getFuturesContracts: async (region = 'NSW1', contractType?: string): Promise<FuturesContract[]> => {
    const params = new URLSearchParams({ region })
    if (contractType) params.set('contract_type', contractType)
    const res = await fetch(`${BASE_URL}/api/futures/contracts?${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch futures contracts')
    return res.json()
  },

  /**
   * Get the NEM market participant registry with credit analytics and HHI concentration metrics.
   */
  getParticipantRegistry: async (): Promise<ParticipantRegistry> => {
    const res = await fetch(`${BASE_URL}/api/registry/participants`, { headers })
    if (!res.ok) throw new Error('Failed to fetch participant registry')
    return res.json()
  },

  /**
   * Get registered generation and load assets for NEM participants.
   * @param participantId  Optional participant ID filter, e.g. "AGLQLD"
   * @param region         Optional NEM region filter, e.g. "NSW1"
   * @param fuelType       Optional fuel type filter, e.g. "Wind", "Coal"
   */
  getParticipantAssets: async (participantId?: string, region?: string, fuelType?: string): Promise<ParticipantAsset[]> => {
    const params = new URLSearchParams()
    if (participantId) params.set('participant_id', participantId)
    if (region) params.set('region', region)
    if (fuelType) params.set('fuel_type', fuelType)
    const res = await fetch(`${BASE_URL}/api/registry/assets?${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch participant assets')
    return res.json()
  },

  /**
   * Get the Outage Schedule and PASA adequacy dashboard.
   * Returns active/upcoming outages and 7-day PASA reserve outlook.
   * Cache TTL: 60 seconds on the backend.
   */
  getOutageDashboard: async (): Promise<PasaDashboard> => {
    const res = await fetch(`${BASE_URL}/api/outages/dashboard`, { headers })
    if (!res.ok) throw new Error('Failed to fetch outage dashboard')
    return res.json()
  },

  /**
   * Get a filtered list of generator outage records.
   * @param region      Optional NEM region code filter, e.g. "NSW1"
   * @param outageType  Optional outage type filter: "PLANNED" | "FORCED" | "PARTIAL"
   * @param status      Status filter: "ACTIVE" (default) | "UPCOMING" | "RETURNED"
   */
  getOutageList: async (region?: string, outageType?: string, status = 'ACTIVE'): Promise<OutageRecord[]> => {
    const params = new URLSearchParams({ status })
    if (region) params.set('region', region)
    if (outageType) params.set('outage_type', outageType)
    const res = await fetch(`${BASE_URL}/api/outages/list?${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch outage list')
    return res.json()
  },

  /**
   * Get the VPP & Distributed Energy Resources dashboard.
   * Returns NEM-wide DER metrics, VPP fleet, regional DER summary, and
   * 24-hour rooftop solar forecast showing the duck curve effect.
   * @param region  Optional NEM region code to filter regional_der
   * Cache TTL: 60 seconds on the backend.
   */
  getDerDashboard: async (region?: string): Promise<DerDashboard> => {
    const params = region ? `?region=${region}` : ''
    const res = await fetch(`${BASE_URL}/api/der/dashboard${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch DER dashboard')
    return res.json()
  },

  /**
   * Get a filtered list of VPP units.
   * @param region  Optional NEM region code filter, e.g. "SA1"
   * @param mode    Optional VPP mode filter: "peak_support" | "frequency_response" | "arbitrage" | "idle"
   * Cache TTL: 30 seconds on the backend.
   */
  getVppFleet: async (region?: string, mode?: string): Promise<VppUnit[]> => {
    const params = new URLSearchParams()
    if (region) params.set('region', region)
    if (mode) params.set('mode', mode)
    const res = await fetch(`${BASE_URL}/api/der/vpp?${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch VPP fleet')
    return res.json()
  },

  /**
   * Get the default user preferences for the platform.
   * Cache TTL: 30 seconds on the backend.
   */
  getAdminPreferences: async (): Promise<UserPreferences> => {
    const res = await fetch(`${BASE_URL}/api/admin/preferences`, { headers })
    if (!res.ok) throw new Error('Failed to fetch preferences')
    return res.json()
  },

  /**
   * Update user preferences (stateless echo in mock mode).
   * @param prefs  Full UserPreferences object to persist
   */
  updateAdminPreferences: async (prefs: UserPreferences): Promise<UserPreferences> => {
    const res = await fetch(`${BASE_URL}/api/admin/preferences`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    })
    if (!res.ok) throw new Error('Failed to update preferences')
    return res.json()
  },

  /**
   * List all API keys (prefixes only, secrets masked).
   * Cache TTL: 60 seconds on the backend.
   */
  getApiKeys: async (): Promise<ApiKeyInfo[]> => {
    const res = await fetch(`${BASE_URL}/api/admin/api_keys`, { headers })
    if (!res.ok) throw new Error('Failed to fetch API keys')
    return res.json()
  },

  /**
   * List all configured data sources with their current sync status.
   * Cache TTL: 60 seconds on the backend.
   */
  getDataSources: async (): Promise<DataSourceConfig[]> => {
    const res = await fetch(`${BASE_URL}/api/admin/data_sources`, { headers })
    if (!res.ok) throw new Error('Failed to fetch data sources')
    return res.json()
  },

  /**
   * Get platform system configuration and runtime statistics.
   * Cache TTL: 30 seconds on the backend.
   */
  getSystemConfig: async (): Promise<SystemConfig> => {
    const res = await fetch(`${BASE_URL}/api/admin/system_config`, { headers })
    if (!res.ok) throw new Error('Failed to fetch system config')
    return res.json()
  },

  /**
   * Get the Gas Market Dashboard for the Australian east coast gas market.
   * Includes hub prices (Wallumbilla, Moomba, Longford, Port Hedland),
   * pipeline flows for 5 major pipelines, and LNG terminal export records.
   * Cache TTL: 60 seconds on the backend.
   */
  getGasDashboard: async (): Promise<GasMarketDashboard> => {
    const res = await fetch(`${BASE_URL}/api/gas/dashboard`, { headers })
    if (!res.ok) throw new Error('Failed to fetch gas market dashboard')
    return res.json()
  },

  /**
   * Get a filtered list of gas pipeline flow records.
   * @param minUtilisation  Minimum utilisation % threshold (default 0 = return all pipelines)
   */
  getGasPipelineFlows: async (minUtilisation = 0): Promise<GasPipelineFlow[]> => {
    const res = await fetch(`${BASE_URL}/api/gas/pipeline_flows?min_utilisation_pct=${minUtilisation}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch pipeline flows')
    return res.json()
  },

  /**
   * Get the Retail Market Analytics Dashboard.
   * Includes retailer market shares, DMO/VDO reference prices, and customer switching data.
   * @param state  Optional NEM state filter: NSW, QLD, VIC, SA, TAS
   * Cache TTL: 3600 seconds on the backend.
   */
  getRetailDashboard: async (state?: string): Promise<RetailMarketDashboard> => {
    const params = state ? `?state=${state}` : ''
    const res = await fetch(`${BASE_URL}/api/retail/dashboard${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch retail dashboard')
    return res.json()
  },

  /**
   * Get DMO and VDO reference prices, optionally filtered by state.
   * @param state  Optional state filter: NSW, QLD, VIC, SA
   * Cache TTL: 3600 seconds on the backend.
   */
  getRetailOffers: async (state?: string): Promise<DefaultOfferPrice[]> => {
    const params = state ? `?state=${state}` : ''
    const res = await fetch(`${BASE_URL}/api/retail/offers${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch retail offers')
    return res.json()
  },

  /**
   * Get the Transmission Loss Factor & Network Analytics dashboard.
   * Includes per-connection-point MLF/DLF data and transmission element loading.
   * @param region  Optional NEM region filter (NSW1, QLD1, VIC1, SA1, TAS1)
   * Cache TTL: 3600 seconds on the backend (MLFs updated annually by AEMO).
   */
  getNetworkDashboard: async (region?: string): Promise<NetworkDashboard> => {
    const params = region ? `?region=${region}` : ''
    const res = await fetch(`${BASE_URL}/api/network/dashboard${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch network dashboard')
    return res.json()
  },

  /**
   * Get a filtered list of MLF/DLF records for NEM connection points.
   * @param region       Optional NEM region filter (NSW1, QLD1, VIC1, SA1, TAS1)
   * @param mlfCategory  Optional MLF category filter: "high" | "normal" | "low"
   * Cache TTL: 3600 seconds on the backend.
   */
  getLossFactors: async (region?: string, mlfCategory?: string): Promise<LossFactorRecord[]> => {
    const params = new URLSearchParams()
    if (region) params.set('region', region)
    if (mlfCategory) params.set('mlf_category', mlfCategory)
    const res = await fetch(`${BASE_URL}/api/network/loss_factors?${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch loss factors')
    return res.json()
  },

  getRezDashboard: async (): Promise<RezDashboard> => {
    const res = await fetch(`${BASE_URL}/api/rez/dashboard`, { headers })
    if (!res.ok) throw new Error('Failed to fetch REZ dashboard')
    return res.json()
  },

  getRezProjects: async (state?: string, status?: string): Promise<RezProject[]> => {
    const params = new URLSearchParams()
    if (state) params.append('state', state)
    if (status) params.append('status', status)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/rez/projects${qs}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch REZ projects')
    return res.json()
  },

  getCisContracts: async (technology?: string, state?: string): Promise<CisContract[]> => {
    const params = new URLSearchParams()
    if (technology) params.append('technology', technology)
    if (state) params.append('state', state)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/rez/cis_contracts${qs}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch CIS contracts')
    return res.json()
  },

  getCurtailmentDashboard: async (): Promise<CurtailmentDashboard> => {
    const res = await fetch(`${BASE_URL}/api/curtailment/dashboard`, { headers })
    if (!res.ok) throw new Error('Failed to fetch curtailment dashboard')
    return res.json()
  },

  getCurtailmentEvents: async (region?: string, cause?: string): Promise<CurtailmentEvent[]> => {
    const params = new URLSearchParams()
    if (region) params.append('region', region)
    if (cause) params.append('cause', cause)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/curtailment/events${qs}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch curtailment events')
    return res.json()
  },

  getDspDashboard: async (): Promise<DspDashboard> => {
    const res = await fetch(`${BASE_URL}/api/dsp/dashboard`, { headers })
    if (!res.ok) throw new Error('Failed to fetch DSP dashboard')
    return res.json()
  },

  getDspParticipants: async (region?: string, sector?: string): Promise<DspParticipant[]> => {
    const params = new URLSearchParams()
    if (region) params.append('region', region)
    if (sector) params.append('sector', sector)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/dsp/participants${qs}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch DSP participants')
    return res.json()
  },

  getPssDashboard: async (): Promise<PowerSystemSecurityDashboard> => {
    const res = await fetch(`${BASE_URL}/api/pss/dashboard`, { headers })
    if (!res.ok) throw new Error('Failed to fetch power system security dashboard')
    return res.json()
  },

  getFcasDispatch: async (): Promise<FcasDispatchRecord[]> => {
    const res = await fetch(`${BASE_URL}/api/pss/fcas`, { headers })
    if (!res.ok) throw new Error('Failed to fetch FCAS dispatch')
    return res.json()
  },

  getBidStack: async (region?: string, fuelType?: string): Promise<BidStackSummary> => {
    const params = new URLSearchParams()
    if (region) params.append('region', region)
    if (fuelType) params.append('fuel_type', fuelType)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/bids/stack${qs}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch bid stack')
    return res.json()
  },

  getMarketEventsDashboard: () => get<MarketEventsDashboard>('/api/market-events/dashboard'),

  getMarketEvents: async (params?: { region?: string; event_type?: string; severity?: string }): Promise<MarketEvent[]> => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.event_type) qs.append('event_type', params.event_type)
    if (params?.severity) qs.append('severity', params.severity)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/market-events/events${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch market events')
    return res.json()
  },

  getMarketInterventions: async (params?: { region?: string }): Promise<MarketIntervention[]> => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/market-events/interventions${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch market interventions')
    return res.json()
  },

  getFcasMarket: (): Promise<FcasMarketDashboard> => get<FcasMarketDashboard>('/api/fcas/market'),

  getFcasServices: (): Promise<FcasServicePrice[]> => get<FcasServicePrice[]>('/api/fcas/services'),

  getFcasProviders: async (params?: { region?: string; fuel_type?: string }): Promise<FcasProvider[]> => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.fuel_type) qs.append('fuel_type', params.fuel_type)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/fcas/providers${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch FCAS providers')
    return res.json()
  },

  getBatteryEconomicsDashboard: (): Promise<BatteryEconomicsDashboard> =>
    get<BatteryEconomicsDashboard>('/api/battery-economics/dashboard'),

  getBatteryUnits: async (params?: { region?: string; technology?: string }): Promise<BatteryUnit[]> => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.technology) qs.append('technology', params.technology)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/battery-economics/batteries${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch battery units')
    return res.json()
  },

  getBatterySchedule: async (params?: { bess_id?: string }): Promise<BatteryArbitrageSlot[]> => {
    const qs = new URLSearchParams()
    if (params?.bess_id) qs.append('bess_id', params.bess_id)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/battery-economics/schedule${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch battery schedule')
    return res.json()
  },

  getSettlementDashboard: (): Promise<SettlementDashboard> => get<SettlementDashboard>('/api/settlement/dashboard'),

  getSettlementResidues: async (params?: { interconnector?: string }): Promise<SettlementResidueRecord[]> => {
    const qs = new URLSearchParams()
    if (params?.interconnector) qs.append('interconnector', params.interconnector)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/settlement/residues${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch settlement residues')
    return res.json()
  },

  getSettlementPrudential: async (params?: { status?: string }): Promise<PrudentialRecord[]> => {
    const qs = new URLSearchParams()
    if (params?.status) qs.append('status', params.status)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/settlement/prudential${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch prudential records')
    return res.json()
  },

  getCarbonDashboard: () => get<CarbonDashboard>('/api/carbon/dashboard'),
  getCarbonRegions: () => get<RegionEmissionsRecord[]>('/api/carbon/regions'),
  getCarbonTrajectory: () => get<EmissionsTrajectory[]>('/api/carbon/trajectory'),

  getHedgingDashboard: () => get<HedgingDashboard>('/api/hedging/dashboard'),

  getHedgeContracts: async (params?: { region?: string; contract_type?: string; status?: string }): Promise<HedgeContract[]> => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.contract_type) qs.append('contract_type', params.contract_type)
    if (params?.status) qs.append('status', params.status)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/hedging/contracts${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch hedge contracts')
    return res.json()
  },

  getHedgePortfolio: async (params?: { region?: string }): Promise<HedgePortfolioSummary[]> => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/hedging/portfolio${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch hedge portfolio')
    return res.json()
  },

  // Sprint 24b — Hydro Storage & Water Value
  getHydroDashboard: () => get<HydroDashboard>('/api/hydro/dashboard'),

  getHydroReservoirs: async (params?: { scheme?: string; state?: string }): Promise<ReservoirRecord[]> => {
    const qs = new URLSearchParams()
    if (params?.scheme) qs.append('scheme', params.scheme)
    if (params?.state) qs.append('state', params.state)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/hydro/reservoirs${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch hydro reservoirs')
    return res.json()
  },

  getWaterValueCurve: async (params?: { season?: string; regime?: string }): Promise<WaterValuePoint[]> => {
    const qs = new URLSearchParams()
    if (params?.season) qs.append('season', params.season)
    if (params?.regime) qs.append('regime', params.regime)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/hydro/water-value${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch water value curve')
    return res.json()
  },

  // Sprint 24c — Market Power & Concentration Analytics
  getMarketPowerDashboard: () => get<MarketPowerDashboard>('/api/market-power/dashboard'),

  getHhiRecords: async (params?: { region?: string; fuel_type?: string }): Promise<HhiRecord[]> => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.fuel_type) qs.append('fuel_type', params.fuel_type)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/market-power/hhi${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch HHI records')
    return res.json()
  },

  getPivotalSuppliers: async (params?: { region?: string; pivotal_status?: string }): Promise<PivotalSupplierRecord[]> => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.pivotal_status) qs.append('pivotal_status', params.pivotal_status)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/market-power/pivotal${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch pivotal suppliers')
    return res.json()
  },

  getPasaDashboard: async (): Promise<PasaAdequacyDashboard> => {
    const res = await fetch(`${BASE_URL}/api/pasa/dashboard`, { headers })
    if (!res.ok) throw new Error('Failed to fetch PASA dashboard')
    return res.json()
  },

  getPasaPeriods: async (params?: { region?: string; lor_risk?: string }): Promise<PasaPeriod[]> => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.lor_risk) qs.append('lor_risk', params.lor_risk)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/pasa/periods${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch PASA periods')
    return res.json()
  },

  getForcedOutages: async (params?: { region?: string; status?: string; fuel_type?: string }): Promise<ForcedOutageRecord[]> => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.status) qs.append('status', params.status)
    if (params?.fuel_type) qs.append('fuel_type', params.fuel_type)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/pasa/forced-outages${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch forced outages')
    return res.json()
  },

  // Sprint 25b — SRA Auction & Interconnector Firm Transfer Rights
  getSraDashboard: () => get<SraDashboard>('/api/sra/dashboard'),

  getSraUnits: async (params?: { interconnector_id?: string; quarter?: string }): Promise<SraUnit[]> => {
    const qs = new URLSearchParams()
    if (params?.interconnector_id) qs.append('interconnector_id', params.interconnector_id)
    if (params?.quarter) qs.append('quarter', params.quarter)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/sra/units${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch SRA units')
    return res.json()
  },

  getSraAuctionResults: async (params?: { interconnector_id?: string }): Promise<SraAuctionResult[]> => {
    const qs = new URLSearchParams()
    if (params?.interconnector_id) qs.append('interconnector_id', params.interconnector_id)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${BASE_URL}/api/sra/auction-results${query}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch SRA auction results')
    return res.json()
  },

  // Sprint 25c — Corporate PPA Market & Green Energy Procurement
  getPpaDashboard: () => get<PpaDashboard>('/api/ppa/dashboard'),

  getPpaContracts: (params?: { technology?: string; status?: string; region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.technology) qs.append('technology', params.technology)
    if (params?.status) qs.append('status', params.status)
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<CorporatePpa[]>(`/api/ppa/contracts${query}`)
  },

  getLgcMarket: () => get<LgcMarket[]>('/api/ppa/lgc-market'),

  // Sprint 26b — Pre-dispatch & 5-min settlement
  getDispatchDashboard: (params?: { region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<DispatchDashboard>(`/api/dispatch/dashboard${query}`)
  },

  getPredispatchIntervals: (params?: { region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<PredispatchInterval[]>(`/api/dispatch/predispatch${query}`)
  },

  getDispatchAccuracy: (params?: { region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<DispatchAccuracyStats[]>(`/api/dispatch/accuracy${query}`)
  },

  // Sprint 26a — Regulatory
  getRegulatoryDashboard: () => get<RegulatoryDashboard>('/api/regulatory/dashboard'),

  getRuleChanges: (params?: { category?: string; status?: string; impact_level?: string }) => {
    const qs = new URLSearchParams()
    if (params?.category) qs.append('category', params.category)
    if (params?.status) qs.append('status', params.status)
    if (params?.impact_level) qs.append('impact_level', params.impact_level)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<RuleChangeRequest[]>(`/api/regulatory/rule-changes${query}`)
  },

  getRegulatoryCalendar: (params?: { body?: string; urgency?: string }) => {
    const qs = new URLSearchParams()
    if (params?.body) qs.append('body', params.body)
    if (params?.urgency) qs.append('urgency', params.urgency)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<RegulatoryCalendarEvent[]>(`/api/regulatory/calendar${query}`)
  },

  // Sprint 26c — ISP Transmission Tracker
  getIspDashboard: () => get<IspDashboard>('/api/isp/dashboard'),

  getIspProjects: (params?: { tnsp?: string; current_status?: string; isp_action?: string }) => {
    const qs = new URLSearchParams()
    if (params?.tnsp) qs.append('tnsp', params.tnsp)
    if (params?.current_status) qs.append('current_status', params.current_status)
    if (params?.isp_action) qs.append('isp_action', params.isp_action)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<IspMajorProject[]>(`/api/isp/projects${query}`)
  },

  getTnspPrograms: () => get<TnspCapexProgram[]>('/api/isp/tnsp-programs'),

  // Sprint 27a — Solar EV Analytics
  getSolarEvDashboard: () => get<SolarEvDashboard>('/api/solar-ev/dashboard'),

  getSolarRecords: (params?: { state?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<SolarGenerationRecord[]>(`/api/solar-ev/solar${query}`)
  },

  getEvFleet: (params?: { state?: string; ev_type?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.ev_type) qs.append('ev_type', params.ev_type)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<EvFleetRecord[]>(`/api/solar-ev/ev-fleet${query}`)
  },

  // Sprint 27b — LRMC & Investment Signal Analytics
  getLrmcDashboard: () => get<LrmcDashboard>('/api/lrmc/dashboard'),

  getLcoeTechnologies: (params?: { region?: string; technology?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.technology) qs.append('technology', params.technology)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<LcoeTechnology[]>(`/api/lrmc/technologies${query}`)
  },

  getInvestmentSignals: (params?: { region?: string; signal?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.signal) qs.append('signal', params.signal)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<InvestmentSignal[]>(`/api/lrmc/signals${query}`)
  },

  // Sprint 27c — Network Constraint Analytics
  getConstraintDashboard: () => get<ConstraintDashboard>('/api/constraints/dashboard'),

  getConstraintEquations: (params?: { region?: string; binding?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.binding) qs.append('binding', params.binding)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<ConstraintEquation[]>(`/api/constraints/equations${query}`)
  },

  getConstraintViolations: (params?: { region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<ConstraintViolationRecord[]>(`/api/constraints/violations${query}`)
  },
}

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h]
      if (val == null) return ''
      if (typeof val === 'string' && val.includes(',')) return `"${val}"`
      return String(val)
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
