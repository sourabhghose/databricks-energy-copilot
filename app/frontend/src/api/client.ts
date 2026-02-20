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
// Sprint 28a — Price Setter interfaces
// ---------------------------------------------------------------------------
export interface PriceSetterRecord { interval: string; region: string; duid: string; station_name: string; fuel_type: string; dispatch_price: number; dispatch_quantity_mw: number; offer_band: string; offer_price: number; is_strategic: boolean; shadow_price_mw: number }
export interface PriceSetterFrequency { duid: string; station_name: string; fuel_type: string; region: string; capacity_mw: number; intervals_as_price_setter: number; pct_intervals: number; avg_price_when_setter: number; max_price_when_setter: number; estimated_daily_price_power_aud: number; strategic_bids_pct: number }
export interface FuelTypePriceSetting { fuel_type: string; intervals_as_price_setter: number; pct_of_all_intervals: number; avg_price_aud_mwh: number; max_price_aud_mwh: number; economic_rent_est_m_aud: number }
export interface PriceSetterDashboard { timestamp: string; region: string; total_intervals_today: number; dominant_price_setter: string; dominant_fuel_type: string; strategic_bid_frequency_pct: number; avg_price_today: number; current_price_setter: string; current_price: number; price_setter_records: PriceSetterRecord[]; frequency_stats: PriceSetterFrequency[]; fuel_type_stats: FuelTypePriceSetting[] }

// ---------------------------------------------------------------------------
// Sprint 28c — Retail Tariff Structure interfaces
// ---------------------------------------------------------------------------
export interface TariffComponent { state: string; customer_type: string; tariff_type: string; dnsp: string; component: string; rate_c_kwh: number; pct_of_total_bill: number; yoy_change_pct: number; regulated: boolean }
export interface TouTariffStructure { state: string; dnsp: string; tariff_name: string; peak_hours: string; shoulder_hours: string; off_peak_hours: string; peak_rate_c_kwh: number; shoulder_rate_c_kwh: number; off_peak_rate_c_kwh: number; daily_supply_charge_aud: number; solar_export_rate_c_kwh: number; demand_charge_aud_kw_mth: number | null; typical_annual_bill_aud: number }
export interface BillComposition { state: string; customer_segment: string; annual_usage_kwh: number; total_annual_bill_aud: number; energy_cost_aud: number; network_cost_aud: number; environmental_cost_aud: number; metering_cost_aud: number; retail_margin_aud: number; energy_pct: number; network_pct: number; env_pct: number; avg_c_kwh_all_in: number }
export interface TariffDashboard { timestamp: string; national_avg_residential_bill_aud: number; cheapest_state: string; most_expensive_state: string; tou_adoption_pct: number; avg_solar_export_rate_c_kwh: number; network_cost_share_pct: number; tariff_components: TariffComponent[]; tou_structures: TouTariffStructure[]; bill_compositions: BillComposition[] }

// ---------------------------------------------------------------------------
// Sprint 28b — Smart Meter & Grid Modernisation interfaces
// ---------------------------------------------------------------------------
export interface SmartMeterRecord { state: string; dnsp: string; total_customer_points: number; smart_meters_installed: number; penetration_pct: number; interval_data_enabled_pct: number; tou_tariff_customers_pct: number; demand_tariff_customers_pct: number; smart_meter_target_pct: number; annual_rollout_rate_pct: number; cost_per_meter_aud: number; market_led_upgrades_pct: number }
export interface GridModernisationProject { project_id: string; project_name: string; dnsp: string; state: string; category: string; description: string; capex_m_aud: number; status: string; completion_year: number; customers_benefiting: number; reliability_improvement_pct: number }
export interface NetworkReliabilityStats { dnsp: string; state: string; year: number; saidi_minutes: number; saifi_count: number; caidi_minutes: number; vs_regulatory_target_pct: number; unplanned_outages: number; planned_outages: number; major_event_days: number }
export interface GridModernisationDashboard { timestamp: string; national_smart_meter_pct: number; tou_tariff_adoption_pct: number; interval_data_coverage_pct: number; total_grid_mod_investment_m_aud: number; projects_underway: number; avg_saidi_minutes: number; smart_meter_records: SmartMeterRecord[]; grid_mod_projects: GridModernisationProject[]; reliability_stats: NetworkReliabilityStats[] }

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Sprint 29a — Spot Price Cap & CPT Analytics interfaces
// ---------------------------------------------------------------------------
export interface SpotCapEvent { event_id: string; region: string; trading_interval: string; spot_price: number; market_price_cap: number; below_floor: boolean; floor_price: number; cumulative_price_at_interval: number; dispatch_intervals_capped: number }
export interface CptTrackerRecord { region: string; trading_date: string; cumulative_price: number; cpt_threshold: number; pct_of_cpt: number; daily_avg_price: number; cap_events_today: number; floor_events_today: number; days_until_reset: number; quarter: string }
export interface SpotCapSummary { region: string; year: number; total_cap_events: number; total_floor_events: number; avg_price_during_cap_events: number; max_cumulative_price: number; cpt_breaches: number; total_cpt_periods: number; revenue_impact_m_aud: number }
export interface SpotCapDashboard { timestamp: string; market_price_cap_aud: number; market_floor_price_aud: number; cumulative_price_threshold_aud: number; cpt_period_days: number; national_cap_events_ytd: number; national_floor_events_ytd: number; active_cpt_regions: string[]; cap_events: SpotCapEvent[]; cpt_tracker: CptTrackerRecord[]; regional_summaries: SpotCapSummary[] }

// ---------------------------------------------------------------------------
// Sprint 29c — WEM Western Australia Energy Market interfaces
// ---------------------------------------------------------------------------
export interface WemBalancingPrice { trading_interval: string; balancing_price_aud: number; reference_price_aud: number; mcap_aud: number; load_forecast_mw: number; actual_load_mw: number; reserves_mw: number; facility_count: number }
export interface WemFacility { facility_id: string; facility_name: string; participant: string; technology: string; registered_capacity_mw: number; accredited_capacity_mw: number; lpf: number; balancing_flag: boolean; region: string; commissioning_year: number; capacity_credit_mw: number }
export interface WemSrMcRecord { year: number; reserve_capacity_requirement_mw: number; certified_reserve_capacity_mw: number; surplus_deficit_mw: number; srmc_aud_per_mwh: number; max_reserve_capacity_price_aud: number; rcp_outcome_aud: number; num_accredited_facilities: number }
export interface WemDashboard { timestamp: string; current_balancing_price_aud: number; reference_price_aud: number; mcap_aud: number; current_load_mw: number; spinning_reserve_mw: number; total_registered_capacity_mw: number; renewable_penetration_pct: number; num_registered_facilities: number; balancing_prices: WemBalancingPrice[]; facilities: WemFacility[]; srmc_records: WemSrMcRecord[] }

// ---------------------------------------------------------------------------
// Sprint 29b — Causer Pays & FCAS Performance interfaces
// ---------------------------------------------------------------------------
export interface CauserPaysContributor { participant_id: string; participant_name: string; region: string; fuel_type: string; fcas_service: string; contribution_mw: number; causer_pays_unit: string; deviation_mw: number; enablement_mw: number; performance_factor: number; causer_pays_amount_aud: number; period: string }
export interface FcasPerformanceRecord { unit_id: string; participant_name: string; region: string; fuel_type: string; service: string; enablement_min_mw: number; enablement_max_mw: number; actual_response_mw: number; required_response_mw: number; performance_factor: number; mlf: number; causer_pays_eligible: boolean; total_payments_aud: number; quarter: string }
export interface FcasMarketSummary { service: string; region: string; quarter: string; total_volume_mw: number; total_cost_aud: number; avg_price_aud_mwh: number; causer_pays_pool_aud: number; num_providers: number; concentration_hhi: number }
export interface CauserPaysDashboard { timestamp: string; total_causer_pays_pool_ytd_aud: number; avg_performance_factor: number; num_active_providers: number; highest_performing_participant: string; contributors: CauserPaysContributor[]; performance_records: FcasPerformanceRecord[]; market_summaries: FcasMarketSummary[] }

// ---------------------------------------------------------------------------
// Sprint 30a — Power System Inertia & System Strength interfaces
// ---------------------------------------------------------------------------
export interface InertiaRecord { region: string; timestamp: string; total_inertia_mws: number; synchronous_inertia_mws: number; non_synchronous_inertia_mws: number; min_threshold_mws: number; secure_threshold_mws: number; deficit_mws: number; rocof_hz_per_sec: number; synchronous_condensers_online: number; num_synchronous_generators: number }
export interface SystemStrengthRecord { region: string; timestamp: string; fault_level_mva: number; min_fault_level_mva: number; scr_ratio: number; synchronous_condenser_mva: number; inverter_based_resources_pct: number; system_strength_status: string }
export interface InertiaDashboard { timestamp: string; national_inertia_mws: number; regions_below_secure: string[]; regions_below_minimum: string[]; total_synchronous_condensers: number; inertia_records: InertiaRecord[]; strength_records: SystemStrengthRecord[] }

// ---------------------------------------------------------------------------
// Sprint 30c — TNSP Revenue & AER Determinations interfaces
// ---------------------------------------------------------------------------
export interface TnspRevenueRecord { tnsp: string; state: string; regulatory_period: string; year: number; approved_revenue_m_aud: number; actual_revenue_m_aud: number; over_under_recovery_m_aud: number; rab_value_m_aud: number; wacc_pct: number; capex_m_aud: number; opex_m_aud: number; depreciation_m_aud: number; transmission_use_of_system_aud_kwh: number }
export interface AerDeterminationRecord { determination_id: string; tnsp: string; state: string; regulatory_period: string; start_year: number; end_year: number; total_revenue_m_aud: number; rab_at_start_m_aud: number; rab_at_end_m_aud: number; allowed_wacc_pct: number; approved_capex_m_aud: number; approved_opex_m_aud: number; appeal_lodged: boolean; appeal_outcome: string | null; key_projects: string[] }
export interface TnspAssetRecord { tnsp: string; state: string; circuit_km: number; substations: number; transformer_capacity_mva: number; asset_age_yrs_avg: number; reliability_target_pct: number; actual_reliability_pct: number; saidi_minutes: number; asset_replacement_rate_pct: number }
export interface TnspDashboard { timestamp: string; total_tnsp_revenue_ytd_m_aud: number; total_rab_value_m_aud: number; avg_wacc_pct: number; num_tnsps: number; revenue_records: TnspRevenueRecord[]; determinations: AerDeterminationRecord[]; asset_records: TnspAssetRecord[] }

// ---------------------------------------------------------------------------
// Sprint 30b — AEMO Market Surveillance & Compliance interfaces
// ---------------------------------------------------------------------------
export interface MarketSurveillanceNotice { notice_id: string; notice_type: string; region: string; participant: string; trading_date: string; description: string; status: string; priority: string; aemo_team: string; resolution_date: string | null; outcome: string | null }
export interface ComplianceRecord { record_id: string; participant: string; rule_reference: string; rule_description: string; breach_type: string; trading_date: string; region: string; penalty_aud: number; status: string; referred_to_aer: boolean; civil_penalty: boolean }
export interface MarketAnomalyRecord { anomaly_id: string; region: string; trading_interval: string; anomaly_type: string; spot_price: number; expected_price: number; deviation_pct: number; generator_id: string; flagged: boolean; explanation: string | null }
export interface SurveillanceDashboard { timestamp: string; open_investigations: number; referred_to_aer_ytd: number; total_penalties_ytd_aud: number; participants_under_review: number; notices: MarketSurveillanceNotice[]; compliance_records: ComplianceRecord[]; anomalies: MarketAnomalyRecord[] }

// ---------------------------------------------------------------------------
// Sprint 31a — Green Hydrogen & Electrolysis Economics interfaces
// ---------------------------------------------------------------------------
export interface ElectrolysisProject { project_id: string; project_name: string; developer: string; state: string; technology: string; capacity_mw: number; hydrogen_output_tpd: number; target_cost_kg_aud: number; current_cost_kg_aud: number; lcoh_aud_kg: number; electrolyser_efficiency_pct: number; utilisation_pct: number; renewable_source: string; status: string; commissioning_year: number; offtake_secured: boolean; export_ready: boolean }
export interface HydrogenPriceBenchmark { region: string; date: string; spot_h2_price_aud_kg: number; green_premium_aud_kg: number; grey_h2_price_aud_kg: number; blue_h2_price_aud_kg: number; ammonia_equiv_aud_t: number; japan_target_price_aud_kg: number; cost_competitiveness_pct: number }
export interface HydrogenCapacityRecord { state: string; year: number; operating_mw: number; under_construction_mw: number; approved_mw: number; proposed_mw: number; pipeline_mw: number; government_target_mw: number; progress_to_target_pct: number }
export interface HydrogenDashboard { timestamp: string; total_operating_capacity_mw: number; total_pipeline_capacity_mw: number; national_avg_lcoh_aud_kg: number; projects_at_target_cost: number; projects: ElectrolysisProject[]; price_benchmarks: HydrogenPriceBenchmark[]; capacity_records: HydrogenCapacityRecord[] }

// ---------------------------------------------------------------------------
// Sprint 31b — Offshore Wind Project Tracker interfaces
// ---------------------------------------------------------------------------
export interface OffshoreWindProject { project_id: string; project_name: string; developer: string; state: string; zone: string; capacity_mw: number; turbine_count: number; turbine_mw: number; water_depth_m: number; distance_offshore_km: number; foundation_type: string; status: string; feasibility_licence: boolean; environment_approval: boolean; financial_close: boolean; construction_start: number | null; commissioning_year: number | null; capex_b_aud: number; lcoe_aud_mwh: number; jobs_construction: number; jobs_operations: number; offshore_infrastructure_zone: string }
export interface OffshoreWindZoneSummary { zone_name: string; state: string; total_capacity_mw: number; num_projects: number; avg_water_depth_m: number; avg_distance_km: number; declared_year: number; area_km2: number; wind_speed_ms: number; capacity_factor_pct: number; grid_connection_point: string }
export interface OffshoreTimeline { project_id: string; project_name: string; milestone: string; planned_year: number; actual_year: number | null; completed: boolean; notes: string }
export interface OffshoreWindDashboard { timestamp: string; total_proposed_capacity_gw: number; projects_with_feasibility_licence: number; projects_in_construction: number; earliest_commissioning_year: number; projects: OffshoreWindProject[]; zone_summaries: OffshoreWindZoneSummary[]; timeline_milestones: OffshoreTimeline[] }

// ---------------------------------------------------------------------------
// Sprint 31c — CER & Renewable Energy Target interfaces
// ---------------------------------------------------------------------------
export interface LretRecord { year: number; liable_entity_acquittal_gwh: number; renewable_power_percentage: number; lret_target_gwh: number; lret_shortfall_gwh: number; laret_price_aud: number; laret_certificates_created: number; laret_certificates_surrendered: number; laret_surplus_deficit: number; num_accredited_power_stations: number }
export interface SresRecord { year: number; sth_systems_installed: number; solar_water_heaters_installed: number; stc_price_aud: number; stc_created_million: number; stc_assigned_million: number; clearing_house_price_aud: number; avg_system_size_kw: number; total_capacity_installed_mw: number }
export interface CerAccreditedStation { station_id: string; station_name: string; developer: string; state: string; fuel_source: string; capacity_mw: number; accreditation_date: string; lgc_created_ytd: number; lgc_price_aud: number; status: string }
export interface CerDashboard { timestamp: string; lret_target_2030_gwh: number; current_year_renewable_pct: number; total_accredited_stations: number; stc_clearing_house_price_aud: number; laret_spot_price_aud: number; lret_records: LretRecord[]; sres_records: SresRecord[]; accredited_stations: CerAccreditedStation[] }

// ---------------------------------------------------------------------------
// Sprint 32a — Pumped Hydro Energy Storage (PHES) interfaces
// ---------------------------------------------------------------------------
export interface PhesProject { project_id: string; project_name: string; developer: string; state: string; capacity_mw: number; storage_hours: number; energy_capacity_mwh: number; upper_reservoir_ml: number; lower_reservoir_ml: number; head_height_m: number; tunnel_km: number; status: string; capex_b_aud: number; lcoe_aud_mwh: number; construction_start: number | null; commissioning_year: number | null; round_trip_efficiency_pct: number; cycle_life_years: number; jobs_peak_construction: number; isp_role: string }
export interface PhesOperationRecord { project_id: string; project_name: string; state: string; date: string; generation_mwh: number; pumping_mwh: number; net_mwh: number; capacity_factor_pct: number; cycles: number; arbitrage_revenue_aud: number; fcas_revenue_aud: number; capacity_market_revenue_aud: number }
export interface PhesMarketOutlook { year: number; total_phes_capacity_mw: number; total_phes_storage_gwh: number; share_of_storage_pct: number; avg_lcoe_aud_mwh: number; investment_committed_b_aud: number; isp_target_mw: number }
export interface PhesDashboard { timestamp: string; total_operating_mw: number; total_pipeline_mw: number; total_storage_gwh: number; largest_project: string; projects: PhesProject[]; operations: PhesOperationRecord[]; market_outlook: PhesMarketOutlook[] }

// ---------------------------------------------------------------------------
// Sprint 32c — Safeguard Mechanism & ERF interfaces
// ---------------------------------------------------------------------------
export interface SafeguardFacility { facility_id: string; facility_name: string; operator: string; sector: string; state: string; baseline_co2e_kt: number; actual_emissions_co2e_kt: number; emissions_above_below_kt: number; safeguard_mechanism_credits_accu: number; purchased_accu: number; compliance_status: string; reporting_year: number; decline_rate_pct: number; headroom_kt: number }
export interface ErfProject { project_id: string; project_name: string; developer: string; state: string; methodology: string; abatement_kt_co2e: number; accu_issued: number; accu_price_aud: number; contract_type: string; contract_value_m_aud: number; start_date: string; end_date: string; status: string }
export interface AccuMarketRecord { date: string; spot_price_aud: number; forward_price_aud: number; volume_traded: number; total_accu_issued_m: number; total_accu_retired_m: number; safeguard_demand_kt: number; govt_contracts_kt: number }
export interface SafeguardDashboard { timestamp: string; total_covered_facilities: number; total_baseline_emissions_mt: number; total_actual_emissions_mt: number; total_exceedances_mt: number; accu_spot_price_aud: number; facilities: SafeguardFacility[]; erf_projects: ErfProject[]; accu_market: AccuMarketRecord[] }

// ---------------------------------------------------------------------------
// Sprint 32b — Major Transmission Projects interfaces
// ---------------------------------------------------------------------------
export interface TransmissionProject { project_id: string; project_name: string; tnsp: string; states: string[]; category: string; circuit_km: number; voltage_kv: number; capacity_mw: number; capex_b_aud: number; status: string; rar_submitted: boolean; rit_t_passed: boolean; aer_approved: boolean; construction_start: number | null; commissioning_year: number | null; consumer_benefit_b_aud: number; jobs_created: number; isp_2024_priority: string }
export interface TransmissionMilestone { project_id: string; project_name: string; milestone: string; planned_date: string; actual_date: string | null; status: string; notes: string }
export interface TransmissionDashboard { timestamp: string; total_pipeline_capex_b_aud: number; km_under_construction: number; km_approved: number; projects_at_risk: number; projects: TransmissionProject[]; milestones: TransmissionMilestone[] }

// ---------------------------------------------------------------------------
// Sprint 33a — DNSP Distribution Network interfaces
// ---------------------------------------------------------------------------
export interface DnspRecord { dnsp: string; state: string; customers: number; network_km: number; substations: number; saidi_minutes: number; saifi_count: number; maifi_count: number; regulatory_target_saidi: number; network_tariff_aud_kwh: number; capex_m_aud: number; opex_m_aud: number; rab_m_aud: number; allowed_revenue_m_aud: number; rooftop_solar_pct: number; ev_charger_connections: number; demand_mw: number; reporting_year: number }
export interface DnspFaultRecord { dnsp: string; date: string; fault_type: string; duration_minutes: number; customers_affected: number; cause: string; region: string }
export interface DnspInvestmentRecord { dnsp: string; project_name: string; category: string; capex_m_aud: number; year: number; customer_benefit: string; status: string }
export interface DnspDashboard { timestamp: string; total_distribution_customers: number; national_avg_saidi: number; total_network_km: number; total_rooftop_solar_pct: number; dnsp_records: DnspRecord[]; fault_records: DnspFaultRecord[]; investment_records: DnspInvestmentRecord[] }

// ---------------------------------------------------------------------------
// Sprint 33b — Virtual Power Plant (VPP) interfaces
// ---------------------------------------------------------------------------
export interface VppScheme { scheme_id: string; scheme_name: string; operator: string; state: string; technology: string; enrolled_participants: number; total_capacity_mw: number; avg_battery_kwh: number; nem_registered: boolean; fcas_eligible: boolean; status: string; launch_year: number; avg_annual_saving_aud: number }
export interface VppDispatchRecord { scheme_id: string; scheme_name: string; trading_interval: string; dispatch_type: string; energy_dispatched_mwh: number; participants_dispatched: number; revenue_aud: number; avg_participant_payment_aud: number; trigger: string }
export interface VppPerformanceRecord { scheme_id: string; scheme_name: string; month: string; total_dispatches: number; total_energy_mwh: number; total_revenue_aud: number; avg_response_time_sec: number; reliability_pct: number; participant_satisfaction_pct: number; co2_avoided_t: number }
export interface VppDashboard { timestamp: string; total_enrolled_participants: number; total_vpp_capacity_mw: number; active_schemes: number; total_revenue_ytd_aud: number; schemes: VppScheme[]; dispatches: VppDispatchRecord[]; performance: VppPerformanceRecord[] }

// ---------------------------------------------------------------------------
// Sprint 33c — NEM Market Reform Tracker interfaces
// ---------------------------------------------------------------------------
export interface MarketReform { reform_id: string; reform_name: string; category: string; description: string; status: string; lead_agency: string; implementation_date: string | null; impact_level: string; stakeholders_affected: string[]; rule_reference: string | null; ner_clause: string | null; key_benefit: string }
export interface ReformMilestoneRecord { reform_id: string; reform_name: string; milestone: string; date: string; status: string; description: string }
export interface ReformImpactRecord { reform_id: string; reform_name: string; stakeholder_type: string; impact_description: string; financial_impact_m_aud: number; benefit_type: string }
export interface ReformDashboard { timestamp: string; implemented_reforms: number; in_progress_reforms: number; proposed_reforms: number; high_impact_reforms: number; reforms: MarketReform[]; milestones: ReformMilestoneRecord[]; impacts: ReformImpactRecord[] }

// ---------------------------------------------------------------------------
// Sprint 34a — TNSP TUoS Network Pricing interfaces
// ---------------------------------------------------------------------------
export interface TuosZone { zone_id: string; zone_name: string; tnsp: string; state: string; tuos_rate_kwh: number; annual_charge_m_aud: number; customer_count: number; peak_demand_mw: number; network_length_km: number; loss_factor_type: string }
export interface MlfRecord { connection_point: string; duid: string; generator_name: string; state: string; fuel_type: string; mlf_value: number; mlf_category: string; financial_year: string; revenue_impact_m_aud: number }
export interface TuosDashboard { timestamp: string; total_tuos_revenue_m_aud: number; avg_tuos_rate_kwh: number; zones_count: number; avg_mlf: number; zones: TuosZone[]; mlf_records: MlfRecord[] }

// ---------------------------------------------------------------------------
// Sprint 34b — Carbon Credit & ACCU Registry interfaces
// ---------------------------------------------------------------------------
export interface AccuProject { project_id: string; project_name: string; proponent: string; state: string; method: string; status: string; area_ha: number; registered_year: number; accu_issued: number; accu_pending: number; price_per_accu_aud: number; safeguard_eligible: boolean }
export interface CarbonAccuMarketRecord { month: string; spot_price_aud: number; futures_12m_aud: number; volume_traded: number; new_projects_registered: number; accus_issued: number; corporate_demand_pct: number }
export interface CarbonCreditDashboard { timestamp: string; total_registered_projects: number; total_accu_issued: number; current_spot_price_aud: number; ytd_trading_volume: number; projects: AccuProject[]; market_records: CarbonAccuMarketRecord[] }

// ---------------------------------------------------------------------------
// Sprint 34c — EV Charging Infrastructure interfaces
// ---------------------------------------------------------------------------
export interface EvCharger { charger_id: string; site_name: string; operator: string; state: string; charger_type: string; power_kw: number; num_connectors: number; utilisation_pct: number; avg_session_kwh: number; sessions_per_day: number; revenue_aud_per_day: number; managed_charging: boolean; grid_upgrade_required: boolean; installation_year: number }
export interface EvGridImpact { state: string; ev_vehicles_registered: number; charging_load_mw_peak: number; charging_load_mw_offpeak: number; managed_charging_participation_pct: number; grid_upgrade_cost_m_aud: number; renewable_charging_pct: number; v2g_capable_vehicles: number }
export interface EvDashboard { timestamp: string; total_chargers: number; total_ev_vehicles: number; total_charging_capacity_mw: number; avg_utilisation_pct: number; managed_charging_pct: number; chargers: EvCharger[]; grid_impacts: EvGridImpact[] }

// ---------------------------------------------------------------------------
// Sprint 35a — Grid-Scale Energy Storage Arbitrage interfaces
// ---------------------------------------------------------------------------
export interface BessProject { project_id: string; project_name: string; owner: string; state: string; technology: string; capacity_mwh: number; power_mw: number; duration_hours: number; round_trip_efficiency_pct: number; commissioning_year: number; status: string; energy_arbitrage_revenue_m_aud: number; fcas_revenue_m_aud: number; capacity_revenue_m_aud: number; capex_m_aud: number; lcoe_mwh: number }
export interface StorageDispatchRecord { project_id: string; trading_interval: string; charge_mw: number; soc_pct: number; spot_price_aud_mwh: number; fcas_raise_revenue_aud: number; fcas_lower_revenue_aud: number; net_revenue_aud: number }
export interface StorageDashboard { timestamp: string; total_storage_capacity_mwh: number; total_storage_power_mw: number; operating_projects: number; avg_round_trip_efficiency_pct: number; total_annual_revenue_m_aud: number; projects: BessProject[]; dispatch_records: StorageDispatchRecord[] }

// ---------------------------------------------------------------------------
// Sprint 35b — NEM Demand Forecasting Accuracy & PASA interfaces
// ---------------------------------------------------------------------------
export interface DemandForecastRecord { region: string; forecast_date: string; forecast_horizon_h: number; forecast_mw: number; actual_mw: number; error_mw: number; mae_pct: number; forecast_model: string; temperature_c: number; conditions: string }
export interface PasaReliabilityRecord { region: string; month: string; reserve_margin_pct: number; ues_mwh: number; lrc_mw: number; capacity_available_mw: number; demand_10poe_mw: number; demand_50poe_mw: number; reliability_standard_met: boolean }
export interface DemandForecastDashboard { timestamp: string; regions: string[]; avg_mae_1h_pct: number; avg_mae_24h_pct: number; avg_mae_168h_pct: number; forecast_records: DemandForecastRecord[]; pasa_records: PasaReliabilityRecord[] }

// ---------------------------------------------------------------------------
// Sprint 35c — Renewable Energy Zone (REZ) Development interfaces
// ---------------------------------------------------------------------------
export interface RezRecord { rez_id: string; rez_name: string; state: string; region: string; status: string; technology_focus: string; capacity_potential_gw: number; committed_capacity_mw: number; operating_capacity_mw: number; pipeline_capacity_mw: number; transmission_investment_m_aud: number; land_area_km2: number; rez_class: string; enabling_project: string }
export interface RezGenerationProject { project_id: string; project_name: string; rez_id: string; technology: string; capacity_mw: number; developer: string; state: string; status: string; commissioning_year: number; estimated_generation_gwh: number; firming_partner: string }
export interface RezDevDashboard { timestamp: string; total_rez_zones: number; total_pipeline_gw: number; committed_capacity_mw: number; operating_capacity_mw: number; total_transmission_investment_m_aud: number; rez_records: RezRecord[]; generation_projects: RezGenerationProject[] }

// ---------------------------------------------------------------------------
// Sprint 36a — NEM Trading Desk interfaces
// ---------------------------------------------------------------------------
export interface TradingPosition { position_id: string; trader: string; region: string; product: string; direction: string; volume_mw: number; entry_price_aud_mwh: number; current_price_aud_mwh: number; pnl_aud: number; open_date: string; expiry_date: string; counterparty: string }
export interface RegionSpread { region_from: string; region_to: string; interconnector: string; spot_spread_aud_mwh: number; forward_spread_aud_mwh: number; flow_mw: number; capacity_mw: number; congestion_revenue_m_aud: number; arbitrage_opportunity: boolean }
export interface TradingDashboard { timestamp: string; total_long_mw: number; total_short_mw: number; net_position_mw: number; total_pnl_aud: number; daily_volume_mw: number; regions_active: number; positions: TradingPosition[]; spreads: RegionSpread[] }

// ---------------------------------------------------------------------------
// Sprint 36b — Network Congestion & Constraint Binding interfaces
// ---------------------------------------------------------------------------
export interface CongestionEvent { event_id: string; constraint_id: string; constraint_name: string; region_from: string; region_to: string; binding_date: string; duration_hours: number; peak_congestion_mw: number; congestion_cost_m_aud: number; congestion_rent_m_aud: number; price_differential_aud_mwh: number; cause: string }
export interface ConstraintRecord { constraint_id: string; constraint_name: string; lhs_description: string; rhs_value_mw: number; current_flow_mw: number; binding_frequency_pct: number; annual_congestion_cost_m_aud: number; last_updated: string; region: string; type: string }
export interface CongestionDashboard { timestamp: string; total_events_ytd: number; total_congestion_cost_m_aud: number; total_congestion_rent_m_aud: number; avg_event_duration_h: number; most_binding_constraint: string; events: CongestionEvent[]; constraints: ConstraintRecord[] }

// ---------------------------------------------------------------------------
// Sprint 36c — Energy Poverty & Social Equity interfaces
// ---------------------------------------------------------------------------
export interface EnergyHardshipRecord { state: string; year: number; residential_customers: number; hardship_program_customers: number; hardship_rate_pct: number; disconnections: number; disconnection_rate_per_1000: number; avg_bill_aud: number; concession_recipients: number; concession_value_m_aud: number; solar_penetration_pct: number; avg_retail_tariff_kwh: number }
export interface AffordabilityIndicator { indicator_id: string; region: string; demographic: string; energy_burden_pct: number; digital_exclusion_pct: number; summer_bill_aud: number; winter_bill_aud: number; avg_concession_aud: number; hardship_debt_avg_aud: number; payment_plan_uptake_pct: number }
export interface EquityDashboard { timestamp: string; national_avg_hardship_rate_pct: number; national_disconnection_rate: number; total_concession_value_m_aud: number; hardship_customers: number; hardship_records: EnergyHardshipRecord[]; affordability_indicators: AffordabilityIndicator[] }

// ── Sprint 37a: Demand Response & RERT ──
export interface RertContract {
  contract_id: string
  provider: string
  region: string
  contract_type: string
  contracted_mw: number
  available_mw: number
  strike_price_aud_mwh: number
  contract_start: string
  contract_end: string
  activations_ytd: number
  total_activation_mw: number
  contract_cost_m_aud: number
}

export interface DemandResponseActivation {
  activation_id: string
  trading_interval: string
  region: string
  provider: string
  activation_type: string
  activated_mw: number
  duration_min: number
  trigger: string
  spot_price_aud_mwh: number
  avoided_voll_m_aud: number
  cost_aud: number
}

export interface DemandResponseProvider {
  provider_id: string
  provider_name: string
  provider_type: string
  registered_mw: number
  regions: string[]
  technologies: string[]
  reliability_pct: number
  avg_response_time_min: number
}

export interface DemandResponseDashboard {
  timestamp: string
  total_contracted_mw: number
  total_available_mw: number
  activations_ytd: number
  total_activation_cost_m_aud: number
  avoided_voll_m_aud: number
  avg_activation_duration_min: number
  contracts: RertContract[]
  activations: DemandResponseActivation[]
  providers: DemandResponseProvider[]
}

// ── Sprint 37b: Behind-the-Meter ──
export interface RooftopPvRecord {
  record_id: string
  month: string
  state: string
  installations_cumulative: number
  installed_capacity_mw: number
  generation_gwh: number
  avg_system_size_kw: number
  capacity_factor_pct: number
  export_gwh: number
  self_consumption_pct: number
  new_installations: number
}

export interface HomeBatteryRecord {
  record_id: string
  month: string
  state: string
  cumulative_installations: number
  total_capacity_mwh: number
  avg_capacity_kwh: number
  paired_with_solar_pct: number
  arbitrage_revenue_m_aud: number
  grid_injection_gwh: number
}

export interface BtmEvRecord {
  record_id: string
  month: string
  state: string
  ev_registrations_cumulative: number
  home_chargers_installed: number
  managed_charging_enrolled: number
  v2g_capable_units: number
  avg_charge_kwh_day: number
  peak_demand_offset_mw: number
}

export interface BtmDashboard {
  timestamp: string
  total_rooftop_capacity_mw: number
  total_generation_twh: number
  total_home_batteries: number
  total_battery_capacity_mwh: number
  ev_registrations: number
  managed_charging_enrolled: number
  rooftop_pv: RooftopPvRecord[]
  home_batteries: HomeBatteryRecord[]
  ev_records: BtmEvRecord[]
}

// ── Sprint 37c: Regulatory Asset Base ──
export interface RegulatoryDetermination {
  determination_id: string
  network: string
  network_type: string
  state: string
  regulatory_period: string
  rab_start_m_aud: number
  rab_end_m_aud: number
  allowed_revenue_m_aud: number
  capex_allowance_m_aud: number
  opex_allowance_m_aud: number
  wacc_nominal_pct: number
  depreciation_m_aud: number
  return_on_rab_m_aud: number
  aer_decision: string
  decision_date: string
}

export interface RabYearlyRecord {
  record_id: string
  network: string
  year: number
  rab_value_m_aud: number
  capex_actual_m_aud: number
  capex_allowance_m_aud: number
  capex_variance_pct: number
  opex_actual_m_aud: number
  opex_allowance_m_aud: number
  opex_variance_pct: number
  allowed_revenue_m_aud: number
  actual_revenue_m_aud: number
  under_over_recovery_m_aud: number
}

export interface RabDashboard {
  timestamp: string
  total_tnsp_rab_m_aud: number
  total_dnsp_rab_m_aud: number
  total_allowed_revenue_m_aud: number
  avg_wacc_pct: number
  determinations: RegulatoryDetermination[]
  yearly_records: RabYearlyRecord[]
}

// ── Sprint 38a: Real-Time NEM Dashboard ──
export interface RegionalDispatch {
  region: string
  dispatch_price_aud_mwh: number
  predispatch_price_aud_mwh: number
  demand_mw: number
  generation_mw: number
  net_interchange_mw: number
  rrp_band: string
  renewable_pct: number
  scheduled_gen_mw: number
  semi_sched_gen_mw: number
}

export interface NemGenMixRecord {
  region: string
  fuel_type: string
  registered_capacity_mw: number
  available_mw: number
  dispatch_mw: number
  capacity_factor_pct: number
  marginal_cost_aud_mwh: number
}

export interface InterconnectorFlowRecord {
  interconnector_id: string
  from_region: string
  to_region: string
  mw_flow: number
  mw_limit: number
  loading_pct: number
  losses_mw: number
  direction: string
}

export interface NemRealTimeDashboard {
  dispatch_interval: string
  timestamp: string
  nem_total_demand_mw: number
  nem_total_generation_mw: number
  nem_avg_price_aud_mwh: number
  nem_renewable_pct: number
  max_price_region: string
  min_price_region: string
  regional_dispatch: RegionalDispatch[]
  generation_mix: NemGenMixRecord[]
  interconnector_flows: InterconnectorFlowRecord[]
}

// ── Sprint 38b: Network RIT Analytics ──
export interface RitProject {
  project_id: string
  project_name: string
  proponent: string
  project_type: string
  state: string
  status: string
  preferred_option: string
  capital_cost_m_aud: number
  net_market_benefit_m_aud: number
  benefit_cost_ratio: number
  npv_m_aud: number
  commencement_year: number
  completion_year: number
  key_drivers: string[]
}

export interface RitCostBenefitRecord {
  record_id: string
  project_id: string
  benefit_category: string
  benefit_m_aud: number
  confidence: string
  discount_rate_pct: number
  analysis_period_years: number
}

export interface RitOptionRecord {
  option_id: string
  project_id: string
  option_name: string
  option_type: string
  capex_m_aud: number
  opex_m_aud_pa: number
  net_benefit_m_aud: number
  is_preferred: boolean
  feasibility: string
}

export interface RitDashboard {
  timestamp: string
  total_projects: number
  total_capex_m_aud: number
  total_net_benefit_m_aud: number
  avg_bcr: number
  rit_t_projects: number
  rit_d_projects: number
  projects: RitProject[]
  cost_benefits: RitCostBenefitRecord[]
  options: RitOptionRecord[]
}

// ── Sprint 38c: Forward Curve & Derivatives ──
export interface Fwd38cCurvePoint {
  point_id: string
  region: string
  product: string
  product_type: string
  delivery_start: string
  delivery_end: string
  settlement_price_aud_mwh: number
  daily_volume_mw: number
  open_interest_mw: number
  spot_to_forward_premium_pct: number
  implied_volatility_pct: number
  last_trade_date: string
}

export interface Fwd38cCapOptionRecord {
  option_id: string
  region: string
  contract_type: string
  strike_price_aud_mwh: number
  settlement_period: string
  premium_aud_mwh: number
  delta: number
  gamma: number
  vega: number
  implied_vol_pct: number
  open_interest_mw: number
  in_the_money: boolean
}

export interface Fwd38cSeasonalPremiumRecord {
  record_id: string
  region: string
  season: string
  year: number
  avg_spot_aud_mwh: number
  avg_forward_aud_mwh: number
  forward_premium_aud_mwh: number
  realised_volatility_pct: number
  max_spike_aud_mwh: number
  spike_hours: number
}

export interface Fwd38cDashboard {
  timestamp: string
  base_spot_nsw_aud_mwh: number
  curve_steepness_nsw: number
  avg_implied_vol_pct: number
  total_open_interest_mw: number
  forward_curve: Fwd38cCurvePoint[]
  cap_options: Fwd38cCapOptionRecord[]
  seasonal_premiums: Fwd38cSeasonalPremiumRecord[]
}

// ── Sprint 39a: Coal Retirement & Transition ──
export interface CoalRetirementRecord {
  unit_id: string
  unit_name: string
  station: string
  owner: string
  state: string
  technology: string
  registered_capacity_mw: number
  commissioning_year: number
  planned_retirement_year: number
  age_years: number
  remaining_life_years: number
  status: string
  retirement_reason: string
  replacement_capacity_needed_mw: number
  replacement_technologies: string[]
  annual_generation_gwh: number
  carbon_intensity_tco2_mwh: number
}

export interface CapacityGapRecord {
  record_id: string
  year: number
  state: string
  retirements_mw: number
  new_renewables_mw: number
  new_storage_mw: number
  new_gas_mw: number
  net_capacity_change_mw: number
  cumulative_gap_mw: number
  reliability_margin_pct: number
}

export interface TransitionInvestmentRecord {
  record_id: string
  year: number
  state: string
  investment_type: string
  capex_committed_m_aud: number
  capex_pipeline_m_aud: number
  mw_committed: number
  mw_pipeline: number
}

export interface CoalRetirementDashboard {
  timestamp: string
  operating_coal_units: number
  total_coal_capacity_mw: number
  retirements_by_2030_mw: number
  retirements_by_2035_mw: number
  replacement_gap_2030_mw: number
  avg_coal_age_years: number
  retirement_records: CoalRetirementRecord[]
  capacity_gaps: CapacityGapRecord[]
  transition_investments: TransitionInvestmentRecord[]
}

// ── Sprint 39b: Gas Generation Economics ──
export interface GasGeneratorRecord {
  generator_id: string
  name: string
  owner: string
  state: string
  technology: string
  registered_capacity_mw: number
  heat_rate_gj_mwh: number
  variable_om_aud_mwh: number
  fixed_om_aud_kw_yr: number
  gas_contract_type: string
  gas_price_gj: number
  fuel_cost_aud_mwh: number
  short_run_marginal_cost_aud_mwh: number
  capacity_factor_pct: number
  annual_generation_gwh: number
  annual_revenue_m_aud: number
  start_up_cost_aud: number
  min_gen_pct: number
  commissioning_year: number
}

export interface SparkSpreadRecord {
  record_id: string
  month: string
  region: string
  avg_spot_price_aud_mwh: number
  gas_price_aud_gj: number
  heat_rate_reference_gj_mwh: number
  fuel_cost_aud_mwh: number
  spark_spread_aud_mwh: number
  dark_spread_aud_mwh: number
  operating_hours: number
  peak_spark_spread: number
}

export interface GasGenEconomicsDashboard {
  timestamp: string
  total_gas_capacity_mw: number
  avg_heat_rate_gj_mwh: number
  avg_gas_price_aud_gj: number
  avg_spark_spread_aud_mwh: number
  ccgt_count: number
  ocgt_count: number
  generators: GasGeneratorRecord[]
  spark_spreads: SparkSpreadRecord[]
}

// ── Sprint 39c: Consumer Protection & Retail ──
export interface RetailOfferRecord {
  offer_id: string
  retailer: string
  state: string
  offer_type: string
  annual_bill_aud: number
  daily_supply_charge_aud: number
  usage_rate_c_kwh: number
  off_peak_rate_c_kwh: number
  peak_vs_dmo_pct: number
  conditional_discounts: boolean
  green_power_pct: number
  contract_length_months: number
  exit_fee_aud: number
}

export interface ConsumerComplaintRecord {
  record_id: string
  quarter: string
  state: string
  category: string
  complaint_count: number
  resolved_first_contact_pct: number
  median_resolution_days: number
  escalated_to_ombudsman_pct: number
}

export interface SwitchingRateRecord {
  record_id: string
  quarter: string
  state: string
  total_switches: number
  switches_per_1000_customers: number
  inbound_switches: number
  outbound_switches: number
  churn_triggered_by: string
}

export interface ConsumerProtectionDashboard {
  timestamp: string
  avg_dmo_annual_bill_aud: number
  avg_market_offer_saving_pct: number
  total_complaints_ytd: number
  ombudsman_cases_ytd: number
  avg_switching_rate_per_1000: number
  hardship_customers_pct: number
  retail_offers: RetailOfferRecord[]
  complaints: ConsumerComplaintRecord[]
  switching_rates: SwitchingRateRecord[]
}

// ── Sprint 40a: Generator Availability & EFOR ──
export interface GeneratorAvailabilityRecord {
  unit_id: string
  unit_name: string
  station: string
  owner: string
  state: string
  technology: string
  registered_capacity_mw: number
  year: number
  total_hours: number
  available_hours: number
  forced_outage_hours: number
  planned_outage_hours: number
  partial_outage_hours: number
  availability_factor_pct: number
  efor_pct: number
  planned_outage_rate_pct: number
  equivalent_availability_factor_pct: number
  net_generation_gwh: number
  capacity_factor_pct: number
}

export interface EforTrendRecord {
  record_id: string
  technology: string
  year: number
  fleet_avg_efor_pct: number
  fleet_avg_availability_pct: number
  fleet_avg_planned_outage_pct: number
  worst_unit_efor_pct: number
  best_unit_efor_pct: number
  unit_count: number
  total_forced_outage_events: number
  avg_forced_outage_duration_hrs: number
}

export interface AvailabilityDashboard {
  timestamp: string
  fleet_avg_availability_pct: number
  fleet_avg_efor_pct: number
  highest_efor_technology: string
  lowest_efor_technology: string
  total_forced_outage_mwh_yr: number
  availability_records: GeneratorAvailabilityRecord[]
  efor_trends: EforTrendRecord[]
}

// ── Sprint 40b: Climate Risk & Infrastructure Resilience ──
export interface NetworkAssetRiskRecord {
  asset_id: string
  asset_name: string
  asset_type: string
  owner: string
  state: string
  region: string
  voltage_kv: number
  age_years: number
  flood_risk_score: number
  bushfire_risk_score: number
  extreme_heat_risk_score: number
  storm_risk_score: number
  composite_risk_score: number
  risk_category: string
  customers_at_risk: number
  adaptation_cost_m_aud: number
  adaptation_status: string
}

export interface ClimateEventRecord {
  event_id: string
  event_date: string
  event_type: string
  state: string
  severity: string
  assets_affected: number
  customers_affected: number
  outage_duration_hrs: number
  restoration_cost_m_aud: number
  insured_loss_m_aud: number
  network_damage_description: string
}

export interface ClimateRiskDashboard {
  timestamp: string
  total_assets_assessed: number
  high_critical_risk_assets: number
  total_adaptation_capex_m_aud: number
  avg_composite_risk_score: number
  events_last_5yr: number
  total_event_restoration_cost_m_aud: number
  assets: NetworkAssetRiskRecord[]
  events: ClimateEventRecord[]
}

// ── Sprint 40c: Smart Grid Innovation ──
export interface DoeRecord {
  record_id: string
  dnsp: string
  state: string
  program_name: string
  doe_type: string
  customers_enrolled: number
  avg_export_limit_kw: number
  avg_import_limit_kw: number
  peak_solar_managed_mw: number
  voltage_violations_prevented: number
  implementation_cost_m_aud: number
  status: string
}

export interface DermsRecord {
  record_id: string
  dnsp: string
  state: string
  system_name: string
  der_types_managed: string[]
  registered_assets: number
  controllable_mw: number
  coordination_events_yr: number
  peak_response_mw: number
  interoperability_standard: string
  rollout_year: number
  opex_m_aud_pa: number
}

export interface AmiAdoptionRecord {
  record_id: string
  state: string
  dnsp: string
  quarter: string
  smart_meters_installed: number
  total_customers: number
  penetration_pct: number
  interval_data_enabled_pct: number
  remote_disconnect_enabled_pct: number
  demand_response_enrolled: number
  ami_capex_m_aud: number
}

export interface SmartGridDashboard {
  timestamp: string
  total_doe_customers: number
  total_derms_assets: number
  total_controllable_mw: number
  national_ami_penetration_pct: number
  coordination_events_yr: number
  doe_programs: DoeRecord[]
  derms_systems: DermsRecord[]
  ami_adoption: AmiAdoptionRecord[]
}

// ── Sprint 41a: Minimum Demand & Duck Curve ──
export interface MinimumDemandRecord {
  record_id: string
  date: string
  region: string
  min_operational_demand_mw: number
  time_of_minimum: string
  rooftop_pv_mw: number
  behind_meter_load_mw: number
  total_scheduled_gen_mw: number
  total_semisc_gen_mw: number
  system_load_mw: number
  negative_price_intervals: number
  min_spot_price_aud_mwh: number
  system_strength_mvar: number
  record_low_flag: boolean
}

export interface DuckCurveProfile {
  profile_id: string
  date: string
  region: string
  season: string
  year: number
  half_hourly_demand: number[]
  half_hourly_rooftop_pv: number[]
  half_hourly_net_demand: number[]
  ramp_rate_mw_30min: number
  trough_depth_mw: number
  peak_demand_mw: number
  trough_demand_mw: number
}

export interface NegativePricingRecord {
  record_id: string
  month: string
  region: string
  negative_intervals: number
  negative_hours: number
  avg_negative_price_aud_mwh: number
  min_negative_price_aud_mwh: number
  curtailed_solar_gwh: number
  curtailed_wind_gwh: number
  battery_charge_gwh: number
  hydro_pump_gwh: number
}

export interface MinDemandDashboard {
  timestamp: string
  min_demand_record_mw: number
  min_demand_region: string
  min_demand_date: string
  avg_negative_price_intervals_per_day: number
  total_curtailed_twh_yr: number
  rooftop_pv_share_at_min_demand_pct: number
  min_demand_records: MinimumDemandRecord[]
  duck_curve_profiles: DuckCurveProfile[]
  negative_pricing: NegativePricingRecord[]
}

// ── Sprint 41b: NEM Market Events ──
export interface MajorMarketEvent {
  event_id: string
  event_name: string
  start_date: string
  end_date: string
  duration_days: number
  event_type: string
  regions_affected: string[]
  trigger: string
  avg_spot_price_before_aud_mwh: number
  avg_spot_price_during_aud_mwh: number
  max_spot_price_aud_mwh: number
  total_market_cost_m_aud: number
  load_shed_mwh: number
  generators_directed: number
  aemo_market_notices: number
  rule_changes_triggered: number
  description: string
}

export interface InterventionRecord {
  intervention_id: string
  event_id: string
  intervention_type: string
  date: string
  region: string
  generator_or_party: string
  quantity_mw: number
  duration_hrs: number
  trigger_reason: string
  cost_m_aud: number
  outcome: string
}

export interface MarketEventTimeline {
  record_id: string
  event_id: string
  timestamp: string
  milestone: string
  milestone_type: string
  region: string
  detail: string
}

export interface NEMSuspensionDashboard {
  timestamp: string
  total_events_5yr: number
  total_suspension_days: number
  total_market_cost_m_aud: number
  total_load_shed_gwh: number
  events: MajorMarketEvent[]
  interventions: InterventionRecord[]
  timeline: MarketEventTimeline[]
}

// ── Sprint 41c: Battery Technology Economics ──
export interface BatteryTechCostRecord {
  record_id: string
  year: number
  technology: string
  pack_cost_usd_kwh: number
  system_cost_usd_kwh: number
  cycle_life: number
  round_trip_efficiency_pct: number
  calendar_life_years: number
  energy_density_wh_kg: number
  cumulative_deployed_gwh: number
  learning_rate_pct: number
}

export interface LcosRecord {
  record_id: string
  year: number
  technology: string
  application: string
  lcos_usd_mwh: number
  lcos_aud_mwh: number
  capacity_cost_pct: number
  om_cost_pct: number
  replacement_cost_pct: number
  discount_rate_pct: number
  project_life_years: number
  cycles_per_year: number
}

export interface SupplyChainRecord {
  record_id: string
  material: string
  price_usd_tonne: number
  year: number
  price_change_pct_yr: number
  supply_concentration_hhi: number
  top_producer_country: string
  battery_tech_exposure: string[]
}

export interface BatteryTechDashboard {
  timestamp: string
  li_ion_pack_cost_2024_usd_kwh: number
  cost_reduction_since_2015_pct: number
  projected_cost_2030_usd_kwh: number
  avg_li_ion_learning_rate_pct: number
  cost_records: BatteryTechCostRecord[]
  lcos_records: LcosRecord[]
  supply_chain: SupplyChainRecord[]
}

// ── Sprint 42a: Community Energy & Microgrids ──
export interface CommunityBatteryRecord {
  battery_id: string
  name: string
  operator: string
  state: string
  region: string
  program: string
  capacity_kwh: number
  power_kw: number
  participants: number
  avg_bill_savings_pct: number
  grid_services_revenue_aud_yr: number
  utilisation_pct: number
  status: string
  commissioning_year: number
}

export interface SolarGardenRecord {
  garden_id: string
  name: string
  operator: string
  state: string
  capacity_kw: number
  subscribers: number
  annual_generation_mwh: number
  subscription_cost_aud_kw: number
  savings_per_subscriber_aud_yr: number
  waitlist_count: number
  low_income_reserved_pct: number
  status: string
}

export interface StandalonePowerRecord {
  sps_id: string
  network_area: string
  dnsp: string
  state: string
  technology: string
  capacity_kw: number
  storage_kwh: number
  customers_served: number
  reliability_pct: number
  annual_fuel_saved_litres: number
  carbon_saved_tco2_yr: number
  capex_m_aud: number
  opex_aud_yr: number
  network_deferral_m_aud: number
  commissioning_year: number
}

export interface CommunityEnergyDashboard {
  timestamp: string
  total_community_batteries: number
  total_community_battery_capacity_mwh: number
  total_solar_garden_capacity_mw: number
  total_solar_garden_subscribers: number
  total_sps_systems: number
  total_sps_customers: number
  community_batteries: CommunityBatteryRecord[]
  solar_gardens: SolarGardenRecord[]
  sps_systems: StandalonePowerRecord[]
}

// ── Sprint 42b: Transmission Asset Management ──
export interface TransmissionAssetRecord {
  asset_id: string
  asset_name: string
  asset_type: string
  owner: string
  region: string
  voltage_kv: number
  installation_year: number
  age_years: number
  design_life_years: number
  remaining_life_years: number
  condition_score: number
  condition_category: string
  last_inspection_date: string
  next_inspection_date: string
  inspection_frequency_years: number
  maintenance_status: string
  replacement_priority: string
  replacement_capex_m_aud: number
  replacement_year_planned: number
}

export interface InspectionEventRecord {
  inspection_id: string
  asset_id: string
  inspection_date: string
  inspector: string
  inspection_type: string
  findings: string
  defects_found: number
  severity: string
  action_required: string
  action_status: string
  inspection_cost_aud: number
}

export interface MaintenanceProgramRecord {
  program_id: string
  owner: string
  asset_type: string
  year: number
  scheduled_inspections: number
  completed_inspections: number
  compliance_pct: number
  deferred_maintenance_pct: number
  maintenance_backlog_m_aud: number
  maintenance_capex_m_aud: number
  maintenance_opex_m_aud: number
  defects_found: number
  defects_resolved_pct: number
}

export interface AssetManagementDashboard {
  timestamp: string
  total_assets: number
  poor_critical_assets: number
  avg_asset_age_years: number
  maintenance_compliance_pct: number
  total_replacement_capex_5yr_m_aud: number
  urgent_replacement_count: number
  assets: TransmissionAssetRecord[]
  inspections: InspectionEventRecord[]
  maintenance_programs: MaintenanceProgramRecord[]
}

// ── Sprint 42c: Decarbonization Pathway ──
export interface SectoralEmissionsRecord {
  record_id: string
  sector: string
  year: number
  emissions_mt_co2e: number
  target_mt_co2e: number
  reduction_vs_2005_pct: number
  reduction_on_track: boolean
  carbon_intensity: number
  technology_readiness: string
  key_abatement_technologies: string[]
}

export interface NetZeroMilestoneRecord {
  milestone_id: string
  milestone_name: string
  sector: string
  target_year: number
  status: string
  progress_pct: number
  policy_framework: string
  investment_committed_b_aud: number
  investment_required_b_aud: number
  funding_gap_b_aud: number
  description: string
}

export interface TechnologyDeploymentRecord {
  record_id: string
  technology: string
  year: number
  deployed_capacity_gw: number
  unit: string
  annual_addition: number
  cost_usd_per_unit: number
  cost_reduction_pct_vs_2020: number
  australia_share_pct: number
  cumulative_co2_avoided_mt: number
}

export interface DecarbonizationDashboard {
  timestamp: string
  total_emissions_2024_mt_co2e: number
  emissions_vs_2005_pct: number
  electricity_decarbonization_pct: number
  on_track_milestones: number
  total_milestones: number
  investment_gap_b_aud: number
  sectoral_emissions: SectoralEmissionsRecord[]
  milestones: NetZeroMilestoneRecord[]
  technology_deployment: TechnologyDeploymentRecord[]
}

// ---------------------------------------------------------------------------
// Sprint 43a — Nuclear & Long-Duration Storage Investment Analytics
// ---------------------------------------------------------------------------

export interface SmrProjectRecord {
  project_id: string
  project_name: string
  developer: string
  technology: string
  state: string
  capacity_mw: number
  status: string
  capex_b_aud: number
  lcoe_mwh: number
  construction_start_year: number | null
  first_power_year: number | null
  design_life_years: number
  cf_pct: number
  co2_intensity_kg_mwh: number
}

export interface LongDurationStorageRecord {
  project_id: string
  project_name: string
  technology: string
  developer: string
  state: string
  capacity_mwh: number
  power_mw: number
  duration_hours: number
  status: string
  capex_m_aud: number
  lcos_mwh: number
  round_trip_efficiency_pct: number
  cycles_per_year: number
  design_life_years: number
}

export interface CleanFirmCapacityRecord {
  year: number
  nuclear_gw: number
  long_duration_storage_gw: number
  pumped_hydro_gw: number
  gas_ccs_gw: number
  hydrogen_peaker_gw: number
}

export interface NuclearLongDurationDashboard {
  timestamp: string
  smr_projects: SmrProjectRecord[]
  long_duration_projects: LongDurationStorageRecord[]
  capacity_outlook: CleanFirmCapacityRecord[]
  total_smr_pipeline_gw: number
  total_lds_pipeline_gwh: number
  avg_smr_lcoe: number
  avg_lds_lcos: number
}

// ---------------------------------------------------------------------------
// Sprint 43b — Wholesale Market Bidding Behaviour & Strategic Withholding
// ---------------------------------------------------------------------------

export interface BidWithholdingRecord {
  participant_id: string
  participant_name: string
  region: string
  technology: string
  dispatch_interval: string
  registered_capacity_mw: number
  offered_capacity_mw: number
  dispatched_mw: number
  withheld_mw: number
  withholding_ratio_pct: number
  spot_price_aud_mwh: number
  rebid_count: number
  rebid_reason: string
}

export interface BidPriceDistRecord {
  participant_id: string
  participant_name: string
  technology: string
  price_band_aud_mwh: number
  volume_offered_mw: number
  pct_of_portfolio: number
}

export interface RebidPatternRecord {
  participant_id: string
  participant_name: string
  month: string
  total_rebids: number
  late_rebids: number
  avg_rebid_price_change: number
  price_impact_aud_mwh: number
  market_impact_score: number
}

export interface MarketConcentrationRecord {
  region: string
  year: number
  hhi_index: number
  cr3_pct: number
  top_participant: string
  top_share_pct: number
  withholding_events: number
  avg_withholding_mw: number
}

export interface BiddingBehaviourDashboard {
  timestamp: string
  withholding_records: BidWithholdingRecord[]
  price_distribution: BidPriceDistRecord[]
  rebid_patterns: RebidPatternRecord[]
  market_concentration: MarketConcentrationRecord[]
  total_withheld_mw: number
  avg_withholding_ratio_pct: number
  high_withholding_events: number
  market_power_index: number
}

// ---------------------------------------------------------------------------
// Sprint 43c — Energy Poverty & Just Transition Analytics
// ---------------------------------------------------------------------------

export interface EnergyPovertyHardshipRecord {
  region: string
  state: string
  year: number
  quarter: string
  households_in_hardship: number
  hardship_rate_pct: number
  disconnection_notices: number
  actual_disconnections: number
  concession_recipients: number
  avg_bill_aud: number
  bill_stress_pct: number
}

export interface CoalWorkerTransitionRecord {
  region: string
  state: string
  facility_name: string
  technology: string
  closure_year: number
  workers_affected: number
  transition_programs: number
  retraining_enrolled: number
  reemployed: number
  avg_reemployment_wage_ratio: number
  transition_fund_m_aud: number
  program_status: string
}

export interface EnergyAffordabilityRecord {
  state: string
  year: number
  median_bill_aud: number
  low_income_bill_aud: number
  bill_as_pct_income_median: number
  bill_as_pct_income_low: number
  solar_penetration_low_income_pct: number
  concession_coverage_pct: number
  hardship_program_spend_m_aud: number
}

export interface JustTransitionProgramRecord {
  program_id: string
  program_name: string
  state: string
  region: string
  program_type: string
  budget_m_aud: number
  beneficiaries: number
  status: string
  start_year: number
  end_year: number | null
  outcomes_score: number
}

export interface EnergyPovertyDashboard {
  timestamp: string
  hardship_records: EnergyPovertyHardshipRecord[]
  worker_transition: CoalWorkerTransitionRecord[]
  affordability: EnergyAffordabilityRecord[]
  just_transition_programs: JustTransitionProgramRecord[]
  national_hardship_rate_pct: number
  total_workers_in_transition: number
  total_transition_fund_b_aud: number
  low_income_solar_gap_pct: number
}

// ---------------------------------------------------------------------------
// Sprint 44a — Spot Price Forecasting Dashboard
// ---------------------------------------------------------------------------

export interface SpotForecastInterval {
  trading_interval: string
  region: string
  actual_price: number | null
  forecast_p10: number
  forecast_p50: number
  forecast_p90: number
  forecast_model: string
  mae: number | null
  mape_pct: number | null
}

export interface RegionalPriceSummary {
  region: string
  current_price: number
  forecast_24h_avg: number
  forecast_7d_avg: number
  price_spike_prob_pct: number
  volatility_index: number
  trend: string
}

export interface ModelPerformanceRecord {
  model_name: string
  region: string
  period: string
  mae: number
  rmse: number
  mape_pct: number
  r2_score: number
  spike_detection_rate_pct: number
}

export interface SpotForecastDashboard {
  timestamp: string
  forecast_intervals: SpotForecastInterval[]
  regional_summary: RegionalPriceSummary[]
  model_performance: ModelPerformanceRecord[]
  next_spike_alert: string | null
  overall_forecast_accuracy_pct: number
}

// ---------------------------------------------------------------------------
// Sprint 44b — Hydrogen Economy & Infrastructure Analytics
// ---------------------------------------------------------------------------

export interface H2ProductionFacility {
  facility_id: string
  facility_name: string
  developer: string
  state: string
  hydrogen_type: string          // GREEN, BLUE, TURQUOISE
  production_type: string        // ELECTROLYSIS_PEM, ELECTROLYSIS_ALK, SMR_CCS, PYROLYSIS
  capacity_tpd: number
  electrolyser_mw: number | null
  renewable_source: string | null
  status: string
  capex_m_aud: number
  lcoh_kg: number
  co2_intensity_kgco2_kgh2: number
  production_2024_tpa: number | null
}

export interface H2ExportTerminal {
  terminal_id: string
  terminal_name: string
  port: string
  state: string
  carrier: string                // AMMONIA, LH2, MCH
  capacity_tpa: number
  status: string
  first_export_year: number | null
  capex_b_aud: number
  target_markets: string[]
}

export interface H2RefuellingStation {
  station_id: string
  location: string
  state: string
  capacity_kgd: number
  pressure_bar: number
  vehicle_type: string           // HCV, BUS, PASSENGER
  status: string
  daily_transactions: number | null
  price_per_kg: number | null
}

export interface H2CostBenchmark {
  year: number
  technology: string
  region: string
  lcoh_kg: number
  electricity_cost_mwh: number | null
  capex_index: number
  cost_reduction_pct_pa: number
}

export interface H2EconomyDashboard {
  timestamp: string
  production_facilities: H2ProductionFacility[]
  export_terminals: H2ExportTerminal[]
  refuelling_stations: H2RefuellingStation[]
  cost_benchmarks: H2CostBenchmark[]
  total_production_capacity_tpd: number
  operating_facilities: number
  total_export_capacity_tpa: number
  avg_lcoh_green: number
}

// Sprint 44c — Carbon Credit & Offset Market Analytics
// ---------------------------------------------------------------------------

export interface AccuSpotRecord {
  trade_date: string
  accu_type: string
  spot_price_aud: number
  volume_traded: number
  turnover_aud_m: number
  buyer_category: string
}

export interface CarbonOffsetProjectRecord {
  project_id: string
  project_name: string
  developer: string
  state: string
  project_type: string
  methodology: string
  registered_units: number
  issued_units: number
  cancelled_units: number
  vintage_year: number
  price_aud: number
  permanence_rating: string
  co_benefits: string[]
}

export interface CarbonOffsetBuyerRecord {
  buyer_id: string
  company_name: string
  sector: string
  accus_purchased_2024: number
  avg_price_paid: number
  total_spend_m_aud: number
  offset_purpose: string
  net_zero_target_year: number | null
}

export interface AccuPriceForecastRecord {
  year: number
  scenario: string
  accu_price_forecast_aud: number
  eu_ets_aud: number
  california_cap_aud: number
  voluntary_premium_aud: number
}

export interface CarbonCreditMarketDashboard {
  timestamp: string
  spot_records: AccuSpotRecord[]
  projects: CarbonOffsetProjectRecord[]
  buyers: CarbonOffsetBuyerRecord[]
  price_forecasts: AccuPriceForecastRecord[]
  current_accu_price: number
  total_issued_mtco2: number
  safeguard_demand_ktco2: number
  market_size_b_aud: number
}

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

  getPriceSetterDashboard: (params?: { region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<PriceSetterDashboard>(`/api/price-setter/dashboard${query}`)
  },

  getPriceSetterRecords: (params?: { region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<PriceSetterRecord[]>(`/api/price-setter/records${query}`)
  },

  getPriceSetterFrequency: (params?: { region?: string; fuel_type?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.fuel_type) qs.append('fuel_type', params.fuel_type)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<PriceSetterFrequency[]>(`/api/price-setter/frequency${query}`)
  },

  // Sprint 28c — Retail Tariff Structure & Bill Analytics
  getTariffDashboard: () => get<TariffDashboard>('/api/tariff/dashboard'),
  getTariffComponents: (params?: { state?: string; customer_type?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.customer_type) qs.append('customer_type', params.customer_type)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<TariffComponent[]>(`/api/tariff/components${query}`)
  },
  getTouStructures: (params?: { state?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<TouTariffStructure[]>(`/api/tariff/structures${query}`)
  },

  // Sprint 28b — Smart Meter & Grid Modernisation Analytics
  getGridModernisationDashboard: () => get<GridModernisationDashboard>('/api/grid-modernisation/dashboard'),

  getSmartMeterRecords: (params?: { state?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<SmartMeterRecord[]>(`/api/grid-modernisation/smart-meters${query}`)
  },

  getGridModProjects: (params?: { state?: string; category?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.category) qs.append('category', params.category)
    if (params?.status) qs.append('status', params.status)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<GridModernisationProject[]>(`/api/grid-modernisation/projects${query}`)
  },

  getSpotCapDashboard: () => get<SpotCapDashboard>('/api/spot-cap/dashboard'),
  getCptTracker: (params?: { region?: string; quarter?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.quarter) qs.append('quarter', params.quarter)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<CptTrackerRecord[]>(`/api/spot-cap/cpt-tracker${query}`)
  },
  getCapEvents: (params?: { region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<SpotCapEvent[]>(`/api/spot-cap/cap-events${query}`)
  },
  getWemDashboard: () => get<WemDashboard>('/api/wem/dashboard'),
  getWemPrices: () => get<WemBalancingPrice[]>('/api/wem/prices'),
  getWemFacilities: (params?: { technology?: string }) => {
    const qs = new URLSearchParams()
    if (params?.technology) qs.append('technology', params.technology)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<WemFacility[]>(`/api/wem/facilities${query}`)
  },
  getCauserPaysDashboard: () => get<CauserPaysDashboard>('/api/causer-pays/dashboard'),
  getCauserPaysContributors: (params?: { region?: string; service?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.service) qs.append('service', params.service)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<CauserPaysContributor[]>(`/api/causer-pays/contributors${query}`)
  },
  getFcasPerformance: (params?: { region?: string; service?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.service) qs.append('service', params.service)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<FcasPerformanceRecord[]>(`/api/causer-pays/performance${query}`)
  },
  getInertiaDashboard: () => get<InertiaDashboard>('/api/inertia/dashboard'),
  getInertiaRecords: (params?: { region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<InertiaRecord[]>(`/api/inertia/records${query}`)
  },
  getSystemStrength: (params?: { region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<SystemStrengthRecord[]>(`/api/inertia/strength${query}`)
  },
  getTnspDashboard: () => get<TnspDashboard>('/api/tnsp/dashboard'),
  getTnspRevenue: (params?: { tnsp?: string; year?: number }) => {
    const qs = new URLSearchParams()
    if (params?.tnsp) qs.append('tnsp', params.tnsp)
    if (params?.year) qs.append('year', String(params.year))
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<TnspRevenueRecord[]>(`/api/tnsp/revenue${query}`)
  },
  getAerDeterminations: (params?: { tnsp?: string }) => {
    const qs = new URLSearchParams()
    if (params?.tnsp) qs.append('tnsp', params.tnsp)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<AerDeterminationRecord[]>(`/api/tnsp/determinations${query}`)
  },
  getSurveillanceDashboard: () => get<SurveillanceDashboard>('/api/surveillance/dashboard'),
  getSurveillanceNotices: (params?: { status?: string; region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.append('status', params.status)
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<MarketSurveillanceNotice[]>(`/api/surveillance/notices${query}`)
  },
  getMarketAnomalies: (params?: { region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<MarketAnomalyRecord[]>(`/api/surveillance/anomalies${query}`)
  },
  getHydrogenDashboard: () => get<HydrogenDashboard>('/api/hydrogen/dashboard'),
  getHydrogenProjects: (params?: { state?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.status) qs.append('status', params.status)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<ElectrolysisProject[]>(`/api/hydrogen/projects${query}`)
  },
  getHydrogenBenchmarks: () => get<HydrogenPriceBenchmark[]>('/api/hydrogen/benchmarks'),
  getOffshoreWindDashboard: () => get<OffshoreWindDashboard>('/api/offshore-wind/dashboard'),
  getOffshoreProjects: (params?: { state?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.status) qs.append('status', params.status)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<OffshoreWindProject[]>(`/api/offshore-wind/projects${query}`)
  },
  getOffshoreZones: () => get<OffshoreWindZoneSummary[]>('/api/offshore-wind/zones'),
  getCerDashboard: () => get<CerDashboard>('/api/cer/dashboard'),
  getLretRecords: () => get<LretRecord[]>('/api/cer/lret'),
  getCerStations: (params?: { fuel_source?: string; state?: string }) => {
    const qs = new URLSearchParams()
    if (params?.fuel_source) qs.append('fuel_source', params.fuel_source)
    if (params?.state) qs.append('state', params.state)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<CerAccreditedStation[]>(`/api/cer/stations${query}`)
  },
  getPhesDashboard: () => get<PhesDashboard>('/api/phes/dashboard'),
  getPhesProjects: (params?: { state?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.status) qs.append('status', params.status)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<PhesProject[]>(`/api/phes/projects${query}`)
  },
  getPhesOutlook: () => get<PhesMarketOutlook[]>('/api/phes/outlook'),
  getSafeguardDashboard: () => get<SafeguardDashboard>('/api/safeguard/dashboard'),
  getSafeguardFacilities: (params?: { sector?: string; state?: string }) => {
    const qs = new URLSearchParams()
    if (params?.sector) qs.append('sector', params.sector)
    if (params?.state) qs.append('state', params.state)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<SafeguardFacility[]>(`/api/safeguard/facilities${query}`)
  },
  getAccuMarket: () => get<AccuMarketRecord[]>('/api/safeguard/accu-market'),
  getTransmissionDashboard: () => get<TransmissionDashboard>('/api/transmission/dashboard'),
  getTransmissionProjects: (params?: { status?: string; category?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.append('status', params.status)
    if (params?.category) qs.append('category', params.category)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<TransmissionProject[]>(`/api/transmission/projects${query}`)
  },
  getTransmissionMilestones: (params?: { project_id?: string }) => {
    const qs = new URLSearchParams()
    if (params?.project_id) qs.append('project_id', params.project_id)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<TransmissionMilestone[]>(`/api/transmission/milestones${query}`)
  },
  getDnspDashboard: () => get<DnspDashboard>('/api/dnsp/dashboard'),
  getDnspRecords: (params?: { state?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<DnspRecord[]>(`/api/dnsp/records${query}`)
  },
  getDnspInvestments: (params?: { dnsp?: string }) => {
    const qs = new URLSearchParams()
    if (params?.dnsp) qs.append('dnsp', params.dnsp)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<DnspInvestmentRecord[]>(`/api/dnsp/investments${query}`)
  },
  getVppDashboard: () => get<VppDashboard>('/api/vpp/dashboard'),
  getVppSchemes: (params?: { state?: string; technology?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.technology) qs.append('technology', params.technology)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<VppScheme[]>(`/api/vpp/schemes${query}`)
  },
  getVppDispatches: (params?: { scheme_id?: string }) => {
    const qs = new URLSearchParams()
    if (params?.scheme_id) qs.append('scheme_id', params.scheme_id)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<VppDispatchRecord[]>(`/api/vpp/dispatches${query}`)
  },
  getReformDashboard: () => get<ReformDashboard>('/api/reform/dashboard'),
  getReformList: (params?: { status?: string; category?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.append('status', params.status)
    if (params?.category) qs.append('category', params.category)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<MarketReform[]>(`/api/reform/list${query}`)
  },
  getReformMilestones: (params?: { reform_id?: string }) => {
    const qs = new URLSearchParams()
    if (params?.reform_id) qs.append('reform_id', params.reform_id)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<ReformMilestoneRecord[]>(`/api/reform/milestones${query}`)
  },
  getTuosDashboard: () => get<TuosDashboard>('/api/tuos/dashboard'),
  getTuosZones: (params?: { state?: string; tnsp?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.tnsp) qs.append('tnsp', params.tnsp)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<TuosZone[]>(`/api/tuos/zones${query}`)
  },
  getMlfRecords: (params?: { state?: string; fuel_type?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.fuel_type) qs.append('fuel_type', params.fuel_type)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<MlfRecord[]>(`/api/tuos/mlf${query}`)
  },
  getAccuRegistryDashboard: () => get<CarbonCreditDashboard>('/api/carbon/registry/dashboard'),
  getAccuProjects: (params?: { state?: string; method?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.method) qs.append('method', params.method)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<AccuProject[]>(`/api/carbon/registry/projects${query}`)
  },
  getCarbonAccuMarket: () => get<CarbonAccuMarketRecord[]>('/api/carbon/registry/market'),
  getEvDashboard: () => get<EvDashboard>('/api/ev/dashboard'),
  getEvChargers: (params?: { state?: string; charger_type?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.charger_type) qs.append('charger_type', params.charger_type)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<EvCharger[]>(`/api/ev/chargers${query}`)
  },
  getEvGridImpact: (params?: { state?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<EvGridImpact[]>(`/api/ev/grid-impact${query}`)
  },
  getStorageDashboard: () => get<StorageDashboard>('/api/storage/dashboard'),
  getBessProjects: (params?: { state?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.status) qs.append('status', params.status)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<BessProject[]>(`/api/storage/projects${query}`)
  },
  getStorageDispatch: (params?: { project_id?: string }) => {
    const qs = new URLSearchParams()
    if (params?.project_id) qs.append('project_id', params.project_id)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<StorageDispatchRecord[]>(`/api/storage/dispatch${query}`)
  },
  getDemandForecastDashboard: () => get<DemandForecastDashboard>('/api/demand-forecast/dashboard'),
  getDemandForecastRecords: (params?: { region?: string; horizon_h?: number }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.horizon_h) qs.append('horizon_h', String(params.horizon_h))
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<DemandForecastRecord[]>(`/api/demand-forecast/records${query}`)
  },
  getPasaRecords: (params?: { region?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<PasaReliabilityRecord[]>(`/api/demand-forecast/pasa${query}`)
  },
  getRezDevDashboard: () => get<RezDevDashboard>('/api/rez-dev/dashboard'),
  getRezDevZones: (params?: { state?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    if (params?.status) qs.append('status', params.status)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<RezRecord[]>(`/api/rez-dev/zones${query}`)
  },
  getRezDevProjects: (params?: { rez_id?: string; technology?: string }) => {
    const qs = new URLSearchParams()
    if (params?.rez_id) qs.append('rez_id', params.rez_id)
    if (params?.technology) qs.append('technology', params.technology)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<RezGenerationProject[]>(`/api/rez-dev/projects${query}`)
  },
  getTradingDashboard: () => get<TradingDashboard>('/api/trading/dashboard'),
  getTradingPositions: (params?: { region?: string; direction?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.direction) qs.append('direction', params.direction)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<TradingPosition[]>(`/api/trading/positions${query}`)
  },
  getTradingSpreads: () => get<RegionSpread[]>('/api/trading/spreads'),
  getCongestionDashboard: () => get<CongestionDashboard>('/api/congestion/dashboard'),
  getCongestionEvents: (params?: { cause?: string; region_from?: string }) => {
    const qs = new URLSearchParams()
    if (params?.cause) qs.append('cause', params.cause)
    if (params?.region_from) qs.append('region_from', params.region_from)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<CongestionEvent[]>(`/api/congestion/events${query}`)
  },
  getCongestionConstraints: (params?: { region?: string; constraint_type?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.constraint_type) qs.append('constraint_type', params.constraint_type)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<ConstraintRecord[]>(`/api/congestion/constraints${query}`)
  },
  getEquityDashboard: () => get<EquityDashboard>('/api/equity/dashboard'),
  getHardshipRecords: (params?: { state?: string }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.append('state', params.state)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<EnergyHardshipRecord[]>(`/api/equity/hardship${query}`)
  },
  getAffordabilityIndicators: (params?: { region?: string; demographic?: string }) => {
    const qs = new URLSearchParams()
    if (params?.region) qs.append('region', params.region)
    if (params?.demographic) qs.append('demographic', params.demographic)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get<AffordabilityIndicator[]>(`/api/equity/affordability${query}`)
  },
  getDrDashboard: (): Promise<DemandResponseDashboard> =>
    get<DemandResponseDashboard>('/api/demand-response/dashboard'),
  getDrContracts: (): Promise<RertContract[]> =>
    get<RertContract[]>('/api/demand-response/contracts'),
  getDrActivations: (): Promise<DemandResponseActivation[]> =>
    get<DemandResponseActivation[]>('/api/demand-response/activations'),
  getDrProviders: (): Promise<DemandResponseProvider[]> =>
    get<DemandResponseProvider[]>('/api/demand-response/providers'),
  getBtmDashboard: (): Promise<BtmDashboard> =>
    get<BtmDashboard>('/api/btm/dashboard'),
  getBtmRooftopPv: (): Promise<RooftopPvRecord[]> =>
    get<RooftopPvRecord[]>('/api/btm/rooftop-pv'),
  getBtmBatteries: (): Promise<HomeBatteryRecord[]> =>
    get<HomeBatteryRecord[]>('/api/btm/home-batteries'),
  getBtmEv: (): Promise<BtmEvRecord[]> =>
    get<BtmEvRecord[]>('/api/btm/ev'),
  getRabDashboard: (): Promise<RabDashboard> =>
    get<RabDashboard>('/api/rab/dashboard'),
  getRabDeterminations: (): Promise<RegulatoryDetermination[]> =>
    get<RegulatoryDetermination[]>('/api/rab/determinations'),
  getRabYearly: (): Promise<RabYearlyRecord[]> =>
    get<RabYearlyRecord[]>('/api/rab/yearly'),
  getRealtimeDashboard: (): Promise<NemRealTimeDashboard> =>
    get<NemRealTimeDashboard>('/api/realtime/dashboard'),
  getRealtimeDispatch: (): Promise<RegionalDispatch[]> =>
    get<RegionalDispatch[]>('/api/realtime/dispatch'),
  getRealtimeGenerationMix: (): Promise<NemGenMixRecord[]> =>
    get<NemGenMixRecord[]>('/api/realtime/generation-mix'),
  getRealtimeInterconnectors: (): Promise<InterconnectorFlowRecord[]> =>
    get<InterconnectorFlowRecord[]>('/api/realtime/interconnectors'),
  getRitDashboard: (): Promise<RitDashboard> =>
    get<RitDashboard>('/api/rit/dashboard'),
  getRitProjects: (): Promise<RitProject[]> =>
    get<RitProject[]>('/api/rit/projects'),
  getRitCostBenefits: (): Promise<RitCostBenefitRecord[]> =>
    get<RitCostBenefitRecord[]>('/api/rit/cost-benefits'),
  getRitOptions: (): Promise<RitOptionRecord[]> =>
    get<RitOptionRecord[]>('/api/rit/options'),
  getForwardCurveDashboard: (): Promise<Fwd38cDashboard> =>
    get<Fwd38cDashboard>('/api/forward-curve/dashboard'),
  getForwardCurvePrices: (): Promise<Fwd38cCurvePoint[]> =>
    get<Fwd38cCurvePoint[]>('/api/forward-curve/prices'),
  getForwardCurveOptions: (): Promise<Fwd38cCapOptionRecord[]> =>
    get<Fwd38cCapOptionRecord[]>('/api/forward-curve/options'),
  getForwardCurveSeasonal: (): Promise<Fwd38cSeasonalPremiumRecord[]> =>
    get<Fwd38cSeasonalPremiumRecord[]>('/api/forward-curve/seasonal'),
  getCoalRetirementDashboard: (): Promise<CoalRetirementDashboard> =>
    get<CoalRetirementDashboard>('/api/coal-retirement/dashboard'),
  getCoalRetirementUnits: (): Promise<CoalRetirementRecord[]> =>
    get<CoalRetirementRecord[]>('/api/coal-retirement/units'),
  getCoalRetirementGaps: (): Promise<CapacityGapRecord[]> =>
    get<CapacityGapRecord[]>('/api/coal-retirement/capacity-gaps'),
  getCoalRetirementInvestments: (): Promise<TransitionInvestmentRecord[]> =>
    get<TransitionInvestmentRecord[]>('/api/coal-retirement/investments'),
  getGasGenDashboard: (): Promise<GasGenEconomicsDashboard> =>
    get<GasGenEconomicsDashboard>('/api/gas-gen/dashboard'),
  getGasGenerators: (): Promise<GasGeneratorRecord[]> =>
    get<GasGeneratorRecord[]>('/api/gas-gen/generators'),
  getGasSparkSpreads: (): Promise<SparkSpreadRecord[]> =>
    get<SparkSpreadRecord[]>('/api/gas-gen/spark-spreads'),
  getConsumerProtectionDashboard: (): Promise<ConsumerProtectionDashboard> =>
    get<ConsumerProtectionDashboard>('/api/consumer-protection/dashboard'),
  getConsumerOffers: (): Promise<RetailOfferRecord[]> =>
    get<RetailOfferRecord[]>('/api/consumer-protection/offers'),
  getConsumerComplaints: (): Promise<ConsumerComplaintRecord[]> =>
    get<ConsumerComplaintRecord[]>('/api/consumer-protection/complaints'),
  getConsumerSwitching: (): Promise<SwitchingRateRecord[]> =>
    get<SwitchingRateRecord[]>('/api/consumer-protection/switching'),
  getEforDashboard: (): Promise<AvailabilityDashboard> =>
    get<AvailabilityDashboard>('/api/efor/dashboard'),
  getEforAvailability: (): Promise<GeneratorAvailabilityRecord[]> =>
    get<GeneratorAvailabilityRecord[]>('/api/efor/availability'),
  getEforTrends: (): Promise<EforTrendRecord[]> =>
    get<EforTrendRecord[]>('/api/efor/trends'),
  getClimateRiskDashboard: (): Promise<ClimateRiskDashboard> =>
    get<ClimateRiskDashboard>('/api/climate-risk/dashboard'),
  getClimateRiskAssets: (): Promise<NetworkAssetRiskRecord[]> =>
    get<NetworkAssetRiskRecord[]>('/api/climate-risk/assets'),
  getClimateRiskEvents: (): Promise<ClimateEventRecord[]> =>
    get<ClimateEventRecord[]>('/api/climate-risk/events'),
  getSmartGridDashboard: (): Promise<SmartGridDashboard> =>
    get<SmartGridDashboard>('/api/smart-grid/dashboard'),
  getSmartGridDoe: (): Promise<DoeRecord[]> =>
    get<DoeRecord[]>('/api/smart-grid/doe-programs'),
  getSmartGridDerms: (): Promise<DermsRecord[]> =>
    get<DermsRecord[]>('/api/smart-grid/derms'),
  getSmartGridAmi: (): Promise<AmiAdoptionRecord[]> =>
    get<AmiAdoptionRecord[]>('/api/smart-grid/ami'),
  getMinDemandDashboard: (): Promise<MinDemandDashboard> =>
    get<MinDemandDashboard>('/api/minimum-demand/dashboard'),
  getMinDemandRecords: (): Promise<MinimumDemandRecord[]> =>
    get<MinimumDemandRecord[]>('/api/minimum-demand/records'),
  getDuckCurve: (): Promise<DuckCurveProfile[]> =>
    get<DuckCurveProfile[]>('/api/minimum-demand/duck-curve'),
  getNegativePricing: (): Promise<NegativePricingRecord[]> =>
    get<NegativePricingRecord[]>('/api/minimum-demand/negative-pricing'),
  getNEMSuspensionDashboard: (): Promise<NEMSuspensionDashboard> =>
    get<NEMSuspensionDashboard>('/api/nem-suspension/dashboard'),
  getNEMSuspensionEvents: (): Promise<MajorMarketEvent[]> =>
    get<MajorMarketEvent[]>('/api/nem-suspension/events'),
  getNEMSuspensionInterventions: (): Promise<InterventionRecord[]> =>
    get<InterventionRecord[]>('/api/nem-suspension/interventions'),
  getNEMSuspensionTimeline: (): Promise<MarketEventTimeline[]> =>
    get<MarketEventTimeline[]>('/api/nem-suspension/timeline'),
  getBatteryTechDashboard: (): Promise<BatteryTechDashboard> =>
    get<BatteryTechDashboard>('/api/battery-tech/dashboard'),
  getBatteryTechCosts: (): Promise<BatteryTechCostRecord[]> =>
    get<BatteryTechCostRecord[]>('/api/battery-tech/costs'),
  getBatteryTechLcos: (): Promise<LcosRecord[]> =>
    get<LcosRecord[]>('/api/battery-tech/lcos'),
  getBatteryTechSupplyChain: (): Promise<SupplyChainRecord[]> =>
    get<SupplyChainRecord[]>('/api/battery-tech/supply-chain'),
  getCommunityEnergyDashboard: (): Promise<CommunityEnergyDashboard> =>
    get<CommunityEnergyDashboard>('/api/community-energy/dashboard'),
  getCommunityBatteries: (): Promise<CommunityBatteryRecord[]> =>
    get<CommunityBatteryRecord[]>('/api/community-energy/batteries'),
  getSolarGardens: (): Promise<SolarGardenRecord[]> =>
    get<SolarGardenRecord[]>('/api/community-energy/solar-gardens'),
  getSpsSystems: (): Promise<StandalonePowerRecord[]> =>
    get<StandalonePowerRecord[]>('/api/community-energy/sps'),
  getAssetMgmtDashboard: (): Promise<AssetManagementDashboard> =>
    get<AssetManagementDashboard>('/api/asset-management/dashboard'),
  getTransmissionAssets: (): Promise<TransmissionAssetRecord[]> =>
    get<TransmissionAssetRecord[]>('/api/asset-management/assets'),
  getAssetInspections: (): Promise<InspectionEventRecord[]> =>
    get<InspectionEventRecord[]>('/api/asset-management/inspections'),
  getMaintenancePrograms: (): Promise<MaintenanceProgramRecord[]> =>
    get<MaintenanceProgramRecord[]>('/api/asset-management/maintenance'),
  getDecarbonizationDashboard: (): Promise<DecarbonizationDashboard> =>
    get<DecarbonizationDashboard>('/api/decarbonization/dashboard'),
  getDecarbonizationSectors: (): Promise<SectoralEmissionsRecord[]> =>
    get<SectoralEmissionsRecord[]>('/api/decarbonization/sectors'),
  getDecarbonizationMilestones: (): Promise<NetZeroMilestoneRecord[]> =>
    get<NetZeroMilestoneRecord[]>('/api/decarbonization/milestones'),
  getDecarbonizationTechnology: (): Promise<TechnologyDeploymentRecord[]> =>
    get<TechnologyDeploymentRecord[]>('/api/decarbonization/technology'),
  getNuclearLdesDashboard: (): Promise<NuclearLongDurationDashboard> =>
    get<NuclearLongDurationDashboard>('/api/nuclear-ldes/dashboard'),
  getBiddingBehaviourDashboard: (): Promise<BiddingBehaviourDashboard> =>
    get<BiddingBehaviourDashboard>('/api/bidding-behaviour/dashboard'),
  getBiddingBehaviourWithholding: (): Promise<BidWithholdingRecord[]> =>
    get<BidWithholdingRecord[]>('/api/bidding-behaviour/withholding'),
  getBiddingBehaviourPriceDistribution: (): Promise<BidPriceDistRecord[]> =>
    get<BidPriceDistRecord[]>('/api/bidding-behaviour/price-distribution'),
  getBiddingBehaviourRebidPatterns: (): Promise<RebidPatternRecord[]> =>
    get<RebidPatternRecord[]>('/api/bidding-behaviour/rebid-patterns'),
  getBiddingBehaviourMarketConcentration: (): Promise<MarketConcentrationRecord[]> =>
    get<MarketConcentrationRecord[]>('/api/bidding-behaviour/market-concentration'),

  // Sprint 43c — Energy Poverty & Just Transition Analytics
  getEnergyPovertyDashboard: (): Promise<EnergyPovertyDashboard> =>
    get<EnergyPovertyDashboard>('/api/energy-poverty/dashboard'),

  // Sprint 44a — Spot Price Forecasting Dashboard
  getSpotForecastDashboard: (): Promise<SpotForecastDashboard> =>
    get<SpotForecastDashboard>('/api/spot-forecast/dashboard'),
  getSpotForecastIntervals: (): Promise<SpotForecastInterval[]> =>
    get<SpotForecastInterval[]>('/api/spot-forecast/intervals'),
  getSpotForecastRegionalSummary: (): Promise<RegionalPriceSummary[]> =>
    get<RegionalPriceSummary[]>('/api/spot-forecast/regional-summary'),
  getSpotForecastModelPerformance: (): Promise<ModelPerformanceRecord[]> =>
    get<ModelPerformanceRecord[]>('/api/spot-forecast/model-performance'),

  // Sprint 44b — Hydrogen Economy & Infrastructure Analytics
  getHydrogenEconomyDashboard: (): Promise<H2EconomyDashboard> =>
    get<H2EconomyDashboard>('/api/hydrogen-economy/dashboard'),
  getHydrogenEconomyProduction: (): Promise<H2ProductionFacility[]> =>
    get<H2ProductionFacility[]>('/api/hydrogen-economy/production'),
  getHydrogenEconomyExportTerminals: (): Promise<H2ExportTerminal[]> =>
    get<H2ExportTerminal[]>('/api/hydrogen-economy/export-terminals'),
  getHydrogenEconomyRefuelling: (): Promise<H2RefuellingStation[]> =>
    get<H2RefuellingStation[]>('/api/hydrogen-economy/refuelling'),
  getHydrogenEconomyCostBenchmarks: (): Promise<H2CostBenchmark[]> =>
    get<H2CostBenchmark[]>('/api/hydrogen-economy/cost-benchmarks'),

  // Sprint 44c — Carbon Credit & Offset Market Analytics
  getCarbonCreditDashboard: (): Promise<CarbonCreditMarketDashboard> =>
    get<CarbonCreditMarketDashboard>('/api/carbon-credit/dashboard'),
  getCarbonCreditSpot: (params?: { accu_type?: string; buyer_category?: string }): Promise<AccuSpotRecord[]> => {
    const q = params ? '?' + Object.entries(params).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join('&') : ''
    return get<AccuSpotRecord[]>(`/api/carbon-credit/spot${q}`)
  },
  getCarbonCreditProjects: (params?: { state?: string; project_type?: string }): Promise<CarbonOffsetProjectRecord[]> => {
    const q = params ? '?' + Object.entries(params).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join('&') : ''
    return get<CarbonOffsetProjectRecord[]>(`/api/carbon-credit/projects${q}`)
  },
  getCarbonCreditBuyers: (offset_purpose?: string): Promise<CarbonOffsetBuyerRecord[]> => {
    const q = offset_purpose ? `?offset_purpose=${offset_purpose}` : ''
    return get<CarbonOffsetBuyerRecord[]>(`/api/carbon-credit/buyers${q}`)
  },
  getCarbonCreditPriceForecast: (scenario?: string): Promise<AccuPriceForecastRecord[]> => {
    const q = scenario ? `?scenario=${scenario}` : ''
    return get<AccuPriceForecastRecord[]>(`/api/carbon-credit/price-forecast${q}`)
  },

  // Sprint 45b — Power System Resilience & Extreme Weather Analytics
  getGridResilienceDashboard: (): Promise<GridResilienceDashboard> =>
    get<GridResilienceDashboard>('/api/grid-resilience/dashboard'),
  getGridResilienceOutageEvents: (params?: { event_type?: string; state?: string }): Promise<WeatherOutageEvent[]> => {
    const q = params ? '?' + Object.entries(params).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join('&') : ''
    return get<WeatherOutageEvent[]>(`/api/grid-resilience/outage-events${q}`)
  },
  getGridResilienceInvestments: (params?: { state?: string; investment_type?: string }): Promise<ResilienceInvestmentRecord[]> => {
    const q = params ? '?' + Object.entries(params).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join('&') : ''
    return get<ResilienceInvestmentRecord[]>(`/api/grid-resilience/investments${q}`)
  },
  getGridResilienceVulnerability: (params?: { state?: string; asset_type?: string }): Promise<GridVulnerabilityRecord[]> => {
    const q = params ? '?' + Object.entries(params).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join('&') : ''
    return get<GridVulnerabilityRecord[]>(`/api/grid-resilience/vulnerability${q}`)
  },
  getGridResilienceKpis: (params?: { state?: string; year?: number }): Promise<ResilienceKpiRecord[]> => {
    const q = params ? '?' + Object.entries(params).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join('&') : ''
    return get<ResilienceKpiRecord[]>(`/api/grid-resilience/kpis${q}`)
  },

  // Sprint 45a — EV Fleet & Grid-Scale Charging Integration Analytics
  getEvFleetDashboard: (): Promise<EvFleet45Dashboard> =>
    get<EvFleet45Dashboard>('/api/ev-fleet/dashboard'),

  // Sprint 45c — Renewable Energy Certificate Market Analytics
  getRecMarketDashboard: (): Promise<RecMarketDashboard> =>
    get<RecMarketDashboard>('/api/rec-market/dashboard'),
  getRecMarketLgcSpot: (): Promise<LgcSpotRecord[]> =>
    get<LgcSpotRecord[]>('/api/rec-market/lgc-spot'),
  getRecMarketLgcCreation: (): Promise<LgcCreationRecord[]> =>
    get<LgcCreationRecord[]>('/api/rec-market/lgc-creation'),
  getRecMarketSurplusDeficit: (): Promise<SurplusDeficitRecord[]> =>
    get<SurplusDeficitRecord[]>('/api/rec-market/surplus-deficit'),
  getRecMarketStc: (): Promise<StcRecord[]> =>
    get<StcRecord[]>('/api/rec-market/stc'),

  // Sprint 46a — Transmission Congestion & Nodal Pricing Analytics
  getTransmissionCongestionDashboard: (): Promise<TransmissionCongestionDashboard> =>
    get<TransmissionCongestionDashboard>('/api/transmission-congestion/dashboard'),
  getTransmissionCongestionConstraints: (): Promise<ConstraintBindingRecord[]> =>
    get<ConstraintBindingRecord[]>('/api/transmission-congestion/constraints'),
  getTransmissionCongestionNodalPrices: (): Promise<NodalPriceRecord[]> =>
    get<NodalPriceRecord[]>('/api/transmission-congestion/nodal-prices'),
  getTransmissionCongestionRent: (): Promise<CongestionRentRecord[]> =>
    get<CongestionRentRecord[]>('/api/transmission-congestion/congestion-rent'),
  getTransmissionCongestionHeatmap: (): Promise<CongestionHeatmapRecord[]> =>
    get<CongestionHeatmapRecord[]>('/api/transmission-congestion/heatmap'),

  // Sprint 46b — DERMS & DER Orchestration Analytics
  getDermsOrchestrationDashboard: (): Promise<DermsOrchestrationDashboard> =>
    get<DermsOrchestrationDashboard>('/api/derms-orchestration/dashboard'),
  getDermsOrchestrationAggregators: (): Promise<DerAggregatorRecord[]> =>
    get<DerAggregatorRecord[]>('/api/derms-orchestration/aggregators'),
  getDermsOrchestrationDispatchEvents: (): Promise<DerDispatchEventRecord[]> =>
    get<DerDispatchEventRecord[]>('/api/derms-orchestration/dispatch-events'),
  getDermsOrchestrationDerPortfolio: (): Promise<DerPortfolioRecord[]> =>
    get<DerPortfolioRecord[]>('/api/derms-orchestration/der-portfolio'),
  getDermsOrchestrationKpis: (): Promise<DerOrchestrationKpiRecord[]> =>
    get<DerOrchestrationKpiRecord[]>('/api/derms-orchestration/kpis'),

  // Sprint 46c — Electricity Market Design & Reform Analytics
  getMarketDesignDashboard: (): Promise<MarketDesignDashboard> =>
    get<MarketDesignDashboard>('/api/market-design/dashboard'),
  getMarketDesignProposals: (): Promise<MarketDesignProposalRecord[]> =>
    get<MarketDesignProposalRecord[]>('/api/market-design/proposals'),
  getMarketDesignCapacityMechanisms: (): Promise<CapacityMechanismRecord[]> =>
    get<CapacityMechanismRecord[]>('/api/market-design/capacity-mechanisms'),
  getMarketDesignSettlementReforms: (): Promise<SettlementReformRecord[]> =>
    get<SettlementReformRecord[]>('/api/market-design/settlement-reforms'),
  getMarketDesignMarketComparison: (): Promise<MarketDesignComparisonRecord[]> =>
    get<MarketDesignComparisonRecord[]>('/api/market-design/market-comparison'),

  // Sprint 47a — REZ Capacity & Development Tracking
  getRezCapacityDashboard: (): Promise<RezCapacityDashboard> =>
    get<RezCapacityDashboard>('/api/rez-capacity/dashboard'),
  getRezCapacityZones: (): Promise<RezZoneRecord[]> =>
    get<RezZoneRecord[]>('/api/rez-capacity/zones'),
  getRezCapacityProjects: (): Promise<RezProjectRecord[]> =>
    get<RezProjectRecord[]>('/api/rez-capacity/projects'),
  getRezCapacityNetworkAugmentations: (): Promise<RezNetworkAugRecord[]> =>
    get<RezNetworkAugRecord[]>('/api/rez-capacity/network-augmentations'),
  getRezCapacityBuildOut: (): Promise<RezBuildOutRecord[]> =>
    get<RezBuildOutRecord[]>('/api/rez-capacity/build-out'),

  // Sprint 47b — Retail Offer Comparison & Tariff Analytics
  getRetailOfferComparisonDashboard: (): Promise<RetailOfferComparisonDashboard> =>
    get<RetailOfferComparisonDashboard>('/api/retail-offer-comparison/dashboard'),
  getRetailOfferComparisonOffers: (): Promise<MarketOfferRecord[]> =>
    get<MarketOfferRecord[]>('/api/retail-offer-comparison/offers'),
  getRetailOfferComparisonDmo: (): Promise<DmoVsMarketRecord[]> =>
    get<DmoVsMarketRecord[]>('/api/retail-offer-comparison/dmo-comparison'),
  getRetailOfferComparisonSolarFit: (): Promise<SolarFitRecord[]> =>
    get<SolarFitRecord[]>('/api/retail-offer-comparison/solar-fit'),
  getRetailOfferComparisonTariffStructures: (): Promise<TariffStructureRecord[]> =>
    get<TariffStructureRecord[]>('/api/retail-offer-comparison/tariff-structures'),

  // Sprint 47c — AEMO System Operator Actions Dashboard
  getSystemOperatorDashboard: (): Promise<SystemOperatorDashboard> =>
    get<SystemOperatorDashboard>('/api/system-operator/dashboard'),
  getSystemOperatorDirections: (): Promise<SysOpDirectionRecord[]> =>
    get<SysOpDirectionRecord[]>('/api/system-operator/directions'),
  getSystemOperatorRertActivations: (): Promise<SysOpRertActivation[]> =>
    get<SysOpRertActivation[]>('/api/system-operator/rert-activations'),
  getSystemOperatorLoadShedding: (): Promise<LoadSheddingEvent[]> =>
    get<LoadSheddingEvent[]>('/api/system-operator/load-shedding'),
  getSystemOperatorConstraintRelaxations: (): Promise<ConstraintRelaxation[]> =>
    get<ConstraintRelaxation[]>('/api/system-operator/constraint-relaxations'),

  // Sprint 48a — Offshore Wind Development Pipeline Analytics
  getOWPDashboard: (): Promise<OWPDashboard> =>
    get<OWPDashboard>('/api/offshore-wind-pipeline/dashboard'),
  getOWPDeclaredAreas: (): Promise<OWPDeclaredArea[]> =>
    get<OWPDeclaredArea[]>('/api/offshore-wind-pipeline/declared-areas'),
  getOWPLicences: (): Promise<OWPLicenceRecord[]> =>
    get<OWPLicenceRecord[]>('/api/offshore-wind-pipeline/licences'),
  getOWPSupplyChain: (): Promise<OWPSupplyChainRecord[]> =>
    get<OWPSupplyChainRecord[]>('/api/offshore-wind-pipeline/supply-chain'),
  getOWPCapacityOutlook: (): Promise<OWPCapacityOutlook[]> =>
    get<OWPCapacityOutlook[]>('/api/offshore-wind-pipeline/capacity-outlook'),

  // Sprint 48c — Network Tariff Reform & DNSP Analytics
  getNetworkTariffReformDashboard: (): Promise<NetworkTariffReformDashboard> =>
    get<NetworkTariffReformDashboard>('/api/network-tariff-reform/dashboard'),
  getNetworkTariffReformTariffs: (): Promise<DnspTariffRecord48c[]> =>
    get<DnspTariffRecord48c[]>('/api/network-tariff-reform/tariffs'),
  getNetworkTariffReformRevenue: (): Promise<DnspRevenueRecord[]> =>
    get<DnspRevenueRecord[]>('/api/network-tariff-reform/revenue'),
  getNetworkTariffReformReforms: (): Promise<TariffReformRecord[]> =>
    get<TariffReformRecord[]>('/api/network-tariff-reform/reforms'),
  getNetworkTariffReformDerImpacts: (): Promise<DerNetworkImpactRecord[]> =>
    get<DerNetworkImpactRecord[]>('/api/network-tariff-reform/der-impacts'),

  // Sprint 48b — NEM Price Spike Post-Event Analysis
  getSpikeAnalysisDashboard: (): Promise<PSADashboard> =>
    get<PSADashboard>('/api/spike-analysis/dashboard'),
  getSpikeAnalysisEvents: (): Promise<PSAEventRecord[]> =>
    get<PSAEventRecord[]>('/api/spike-analysis/events'),
  getSpikeAnalysisContributors: (): Promise<PSAContributorRecord[]> =>
    get<PSAContributorRecord[]>('/api/spike-analysis/contributors'),
  getSpikeAnalysisConsumerImpacts: (): Promise<PSAConsumerImpact[]> =>
    get<PSAConsumerImpact[]>('/api/spike-analysis/consumer-impacts'),
  getSpikeAnalysisRegionalTimeline: (): Promise<PSARegionalTimeline[]> =>
    get<PSARegionalTimeline[]>('/api/spike-analysis/regional-timeline'),

  // Sprint 49c — Solar Irradiance & Resource Assessment Analytics
  getSolarResourceDashboard: (): Promise<SolarResourceDashboard> =>
    get<SolarResourceDashboard>('/api/solar-resource/dashboard'),
  getSolarResourceSites: (): Promise<IrradianceSiteRecord[]> =>
    get<IrradianceSiteRecord[]>('/api/solar-resource/sites'),
  getSolarResourceFarmYields: (): Promise<SolarFarmYieldRecord[]> =>
    get<SolarFarmYieldRecord[]>('/api/solar-resource/farm-yields'),
  getSolarResourceMonthlyIrradiance: (): Promise<MonthlyIrradianceRecord[]> =>
    get<MonthlyIrradianceRecord[]>('/api/solar-resource/monthly-irradiance'),
  getSolarResourceDegradation: (): Promise<SolarDegradationRecord[]> =>
    get<SolarDegradationRecord[]>('/api/solar-resource/degradation'),

  // Sprint 49a — Energy Storage Revenue Stacking & Optimisation
  getStorageRevenueStackDashboard: (): Promise<StorageRevenueStackDashboard> =>
    get<StorageRevenueStackDashboard>('/api/storage-revenue-stack/dashboard'),
  getStorageRevenueStackWaterfall: (): Promise<StorageRevenueWaterfall[]> =>
    get<StorageRevenueWaterfall[]>('/api/storage-revenue-stack/waterfall'),
  getStorageRevenueStackDispatchOptimisation: (): Promise<StorageDispatchOptRecord[]> =>
    get<StorageDispatchOptRecord[]>('/api/storage-revenue-stack/dispatch-optimisation'),
  getStorageRevenueStackMultiServiceBids: (): Promise<MultiServiceBidRecord[]> =>
    get<MultiServiceBidRecord[]>('/api/storage-revenue-stack/multi-service-bids'),
  getStorageRevenueStackScenarios: (): Promise<StorageScenarioRecord[]> =>
    get<StorageScenarioRecord[]>('/api/storage-revenue-stack/scenarios'),

  // Sprint 49b — Electricity Futures Market Risk Analytics
  getFuturesMarketRiskDashboard: (): Promise<FuturesMarketRiskDashboard> =>
    get<FuturesMarketRiskDashboard>('/api/futures-market-risk/dashboard'),
  getFuturesMarketRiskVar: (): Promise<VaRRecord[]> =>
    get<VaRRecord[]>('/api/futures-market-risk/var'),
  getFuturesMarketRiskHedgeEffectiveness: (): Promise<FMRHedgeEffectivenessRecord[]> =>
    get<FMRHedgeEffectivenessRecord[]>('/api/futures-market-risk/hedge-effectiveness'),
  getFuturesMarketRiskBasisRisk: (): Promise<BasisRiskRecord[]> =>
    get<BasisRiskRecord[]>('/api/futures-market-risk/basis-risk'),
  getFuturesMarketRiskPositions: (): Promise<FuturesPositionRecord[]> =>
    get<FuturesPositionRecord[]>('/api/futures-market-risk/positions'),

  // Sprint 50a — Wind Resource & Wake Effect Analytics
  getWindResourceDashboard: (): Promise<WindResourceDashboard> =>
    get<WindResourceDashboard>('/api/wind-resource/dashboard'),
  getWindResourceSiteAssessments: (): Promise<WindSiteAssessment[]> =>
    get<WindSiteAssessment[]>('/api/wind-resource/site-assessments'),
  getWindResourceFarmPerformance: (): Promise<WindFarmPerformance[]> =>
    get<WindFarmPerformance[]>('/api/wind-resource/farm-performance'),
  getWindResourceWakeLosses: (): Promise<WakeLossRecord[]> =>
    get<WakeLossRecord[]>('/api/wind-resource/wake-losses'),
  getWindResourceMonthlyResource: (): Promise<WindResourceRecord[]> =>
    get<WindResourceRecord[]>('/api/wind-resource/monthly-resource'),

  // Sprint 50c — Microgrids & Remote Area Power Systems Analytics
  getMicrogridRapsDashboard: (): Promise<MicrogridDashboard> =>
    get<MicrogridDashboard>('/api/microgrid-raps/dashboard'),
  getMicrogridRapsMicrogrids: (): Promise<MicrogridRecord[]> =>
    get<MicrogridRecord[]>('/api/microgrid-raps/microgrids'),
  getMicrogridRapsDieselDisplacement: (): Promise<DieselDisplacementRecord[]> =>
    get<DieselDisplacementRecord[]>('/api/microgrid-raps/diesel-displacement'),
  getMicrogridRapsEnergyRecords: (): Promise<MicrogridEnergyRecord[]> =>
    get<MicrogridEnergyRecord[]>('/api/microgrid-raps/energy-records'),
  getMicrogridRapsTechnologySummary: (): Promise<OffGridTechnologyRecord[]> =>
    get<OffGridTechnologyRecord[]>('/api/microgrid-raps/technology-summary'),

  // Sprint 50b — Corporate PPA Market Analytics
  getCorporatePpaMarketDashboard: (): Promise<CorporatePpaMarketDashboard> =>
    get<CorporatePpaMarketDashboard>('/api/corporate-ppa-market/dashboard'),
  getCorporatePpaMarketDeals: (): Promise<CorporatePpaDeal[]> =>
    get<CorporatePpaDeal[]>('/api/corporate-ppa-market/deals'),
  getCorporatePpaMarketOfftakers: (): Promise<PpaOfftakerRecord[]> =>
    get<PpaOfftakerRecord[]>('/api/corporate-ppa-market/offtakers'),
  getCorporatePpaMarketPriceTrends: (): Promise<PpaPriceTrendRecord[]> =>
    get<PpaPriceTrendRecord[]>('/api/corporate-ppa-market/price-trends'),
  getCorporatePpaMarketSummary: (): Promise<PpaMarketSummaryRecord[]> =>
    get<PpaMarketSummaryRecord[]>('/api/corporate-ppa-market/market-summary'),

  // Sprint 51a — Electricity Market Liquidity & Trading Volume Analytics
  getMarketLiquidityDashboard: (): Promise<MarketLiquidityDashboard> =>
    get<MarketLiquidityDashboard>('/api/market-liquidity/dashboard'),
  getMarketLiquidityTradingVolumes: (): Promise<TradingVolumeRecord[]> =>
    get<TradingVolumeRecord[]>('/api/market-liquidity/trading-volumes'),
  getMarketLiquidityBidAskSpreads: (): Promise<BidAskSpreadRecord[]> =>
    get<BidAskSpreadRecord[]>('/api/market-liquidity/bid-ask-spreads'),
  getMarketLiquidityMarketDepth: (): Promise<MarketDepthRecord[]> =>
    get<MarketDepthRecord[]>('/api/market-liquidity/market-depth'),
  getMarketLiquidityMetrics: (): Promise<LiquidityMetricRecord[]> =>
    get<LiquidityMetricRecord[]>('/api/market-liquidity/metrics'),

  // Sprint 51c — Thermal Power Plant Heat Rate & Efficiency Analytics
  getThermalEfficiencyDashboard: (): Promise<ThermalEfficiencyDashboard> =>
    get<ThermalEfficiencyDashboard>('/api/thermal-efficiency/dashboard'),
  getThermalEfficiencyUnits: (): Promise<ThermalUnitRecord[]> =>
    get<ThermalUnitRecord[]>('/api/thermal-efficiency/units'),
  getThermalEfficiencyHeatRateTrends: (): Promise<HeatRateTrendRecord[]> =>
    get<HeatRateTrendRecord[]>('/api/thermal-efficiency/heat-rate-trends'),
  getThermalEfficiencyFuelCosts: (): Promise<FuelCostRecord[]> =>
    get<FuelCostRecord[]>('/api/thermal-efficiency/fuel-costs'),
  getThermalEfficiencyBenchmarks: (): Promise<ThermalBenchmarkRecord[]> =>
    get<ThermalBenchmarkRecord[]>('/api/thermal-efficiency/benchmarks'),

  // Sprint 51b — Industrial Demand Flexibility & Load Management
  getIndustrialDemandFlexDashboard: (): Promise<IndustrialDemandFlexDashboard> =>
    get<IndustrialDemandFlexDashboard>('/api/industrial-demand-flex/dashboard'),
  getIndustrialDemandFlexConsumers: (): Promise<LargeConsumerRecord[]> =>
    get<LargeConsumerRecord[]>('/api/industrial-demand-flex/consumers'),
  getIndustrialDemandFlexEvents: (): Promise<FlexibilityEventRecord[]> =>
    get<FlexibilityEventRecord[]>('/api/industrial-demand-flex/events'),
  getIndustrialDemandFlexLoadShapes: (): Promise<IndustrialLoadShapeRecord[]> =>
    get<IndustrialLoadShapeRecord[]>('/api/industrial-demand-flex/load-shapes'),
  getIndustrialDemandFlexAggregate: (): Promise<DemandFlexAggregateRecord[]> =>
    get<DemandFlexAggregateRecord[]>('/api/industrial-demand-flex/aggregate'),

  // Sprint 52a — Energy Storage LCA & Sustainability Analytics
  getStorageLcaDashboard: (): Promise<StorageLcaDashboard> =>
    get<StorageLcaDashboard>('/api/storage-lca/dashboard'),
  getStorageLcaRecords: (): Promise<StorageLcaRecord[]> =>
    get<StorageLcaRecord[]>('/api/storage-lca/lca-records'),
  getStorageLcaCriticalMinerals: (): Promise<CriticalMineralRecord[]> =>
    get<CriticalMineralRecord[]>('/api/storage-lca/critical-minerals'),
  getStorageLcaRecycling: (): Promise<RecyclingRecord[]> =>
    get<RecyclingRecord[]>('/api/storage-lca/recycling'),
  getStorageLcaScenarios: (): Promise<LcaScenarioRecord[]> =>
    get<LcaScenarioRecord[]>('/api/storage-lca/scenarios'),

  // Sprint 52b — Interconnector Flow & Limit Binding Analytics
  getIFADashboard: (): Promise<IFADashboard> =>
    get<IFADashboard>('/api/interconnector-flow-analytics/dashboard'),
  getIFAInterconnectors: (): Promise<IFAInterconnectorRecord[]> =>
    get<IFAInterconnectorRecord[]>('/api/interconnector-flow-analytics/interconnectors'),
  getIFAFlows: (): Promise<IFAFlowRecord[]> =>
    get<IFAFlowRecord[]>('/api/interconnector-flow-analytics/flows'),
  getIFAUpgrades: (): Promise<IFACapacityUpgradeRecord[]> =>
    get<IFACapacityUpgradeRecord[]>('/api/interconnector-flow-analytics/upgrades'),
  getIFAPatterns: (): Promise<IFAFlowPatternRecord[]> =>
    get<IFAFlowPatternRecord[]>('/api/interconnector-flow-analytics/patterns'),

  // Sprint 52c — AEMO ISP Progress Tracker
  getIspProgressDashboard: (): Promise<IspProgressDashboard> =>
    get<IspProgressDashboard>('/api/isp-progress/dashboard'),
  getIspProgressActionableProjects: (): Promise<IspActionableProject[]> =>
    get<IspActionableProject[]>('/api/isp-progress/actionable-projects'),
  getIspProgressCapacityMilestones: (): Promise<IspCapacityMilestone[]> =>
    get<IspCapacityMilestone[]>('/api/isp-progress/capacity-milestones'),
  getIspProgressScenarios: (): Promise<IspScenarioRecord[]> =>
    get<IspScenarioRecord[]>('/api/isp-progress/scenarios'),
  getIspProgressDeliveryRisks: (): Promise<IspDeliveryRiskRecord[]> =>
    get<IspDeliveryRiskRecord[]>('/api/isp-progress/delivery-risks'),
  // Sprint 53c — Firming Technology Economics
  getFirmingTechDashboard: (): Promise<FirmingTechDashboard> =>
    get<FirmingTechDashboard>('/api/firming-technology/dashboard'),

  // Sprint 53b — Electricity Demand Forecasting Models
  getDemandForecastModelsDashboard(): Promise<DemandForecastModelsDashboard> {
    return get<DemandForecastModelsDashboard>('/api/demand-forecast-models/dashboard')
  },

  // Sprint 66a — Social Licence & Energy Transition Equity Analytics
  getSocialLicenceDashboard: (): Promise<SocialLicenceDashboard> =>
    get<SocialLicenceDashboard>('/api/social-licence/dashboard'),
}

// ---------------------------------------------------------------------------
// Sprint 45b — Power System Resilience & Extreme Weather Analytics
// ---------------------------------------------------------------------------

export interface WeatherOutageEvent {
  event_id: string
  event_name: string
  event_type: string
  state: string
  region: string
  start_date: string
  end_date: string | null
  affected_customers: number
  peak_demand_impact_mw: number
  unserved_energy_mwh: number
  infrastructure_damage_m_aud: number
  recovery_days: number
  severity: string
}

export interface ResilienceInvestmentRecord {
  project_id: string
  project_name: string
  asset_owner: string
  state: string
  investment_type: string
  capex_m_aud: number
  annual_benefit_m_aud: number
  customers_protected: number
  risk_reduction_pct: number
  status: string
}

export interface GridVulnerabilityRecord {
  asset_id: string
  asset_name: string
  asset_type: string
  state: string
  vulnerability_score: number
  bushfire_risk: string
  flood_risk: string
  heat_risk: string
  age_years: number
  last_hardening_year: number | null
  replacement_priority: string
}

export interface ResilienceKpiRecord {
  year: number
  state: string
  saidi_minutes: number
  saifi_count: number
  maifi_count: number
  unserved_energy_mwh: number
  weather_related_pct: number
  avg_restoration_hours: number
  resilience_investment_m_aud: number
}

export interface GridResilienceDashboard {
  timestamp: string
  outage_events: WeatherOutageEvent[]
  resilience_investments: ResilienceInvestmentRecord[]
  vulnerability_records: GridVulnerabilityRecord[]
  kpi_records: ResilienceKpiRecord[]
  total_unserved_energy_mwh: number
  total_affected_customers: number
  total_resilience_investment_m_aud: number
  avg_recovery_days: number
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

// ---------------------------------------------------------------------------
// Sprint 45a — EV Fleet & Grid-Scale Charging Integration Analytics
// ---------------------------------------------------------------------------

export interface EvFleet45Record {
  fleet_id: string
  fleet_name: string
  operator: string
  state: string
  fleet_type: string
  total_vehicles: number
  ev_vehicles: number
  ev_penetration_pct: number
  avg_daily_km: number
  avg_consumption_kwh_100km: number
  total_daily_kwh_demand: number
  charging_strategy: string
  peak_charge_mw: number
  grid_connection_kv: number
}

export interface ChargingInfra45Record {
  site_id: string
  site_name: string
  operator: string
  state: string
  location_type: string
  charger_type: string
  num_chargers: number
  total_power_kw: number
  avg_utilisation_pct: number
  sessions_per_day: number
  avg_energy_per_session_kwh: number
  v2g_capable: boolean
  status: string
}

export interface V2GDispatch45Record {
  interval: string
  fleet_id: string
  fleet_name: string
  v2g_export_mw: number
  grid_frequency_hz: number
  spot_price_aud_mwh: number
  revenue_aud: number
  soc_before_pct: number
  soc_after_pct: number
}

export interface EvDemandForecast45Record {
  year: number
  ev_stock_millions: number
  fleet_ev_pct: number
  total_ev_demand_twh: number
  managed_charging_twh: number
  v2g_discharge_twh: number
  peak_demand_increase_gw: number
  off_peak_shift_gw: number
}

export interface EvFleet45Dashboard {
  timestamp: string
  fleets: EvFleet45Record[]
  charging_infra: ChargingInfra45Record[]
  v2g_dispatch: V2GDispatch45Record[]
  demand_forecast: EvDemandForecast45Record[]
  total_fleet_ev_vehicles: number
  total_charging_power_mw: number
  avg_fleet_ev_penetration_pct: number
  v2g_capable_sites: number
}

// ---------------------------------------------------------------------------
// Sprint 45c — Renewable Energy Certificate Market Analytics
// ---------------------------------------------------------------------------

export interface LgcSpotRecord {
  trade_date: string
  spot_price_aud: number
  volume_traded: number
  open_interest: number
  created_from: string    // WIND, SOLAR, HYDRO, BIOMASS, GEOTHERMAL
  vintage_year: number
}

export interface SurplusDeficitRecord {
  year: number
  liable_entity: string
  required_lgcs: number
  surrendered_lgcs: number
  shortfall_lgcs: number
  shortfall_charge_m_aud: number
  compliance_pct: number
}

export interface LgcCreationRecord {
  accreditation_id: string
  station_name: string
  technology: string      // WIND, SOLAR, HYDRO, BIOMASS, WASTE_COAL_MINE
  state: string
  capacity_mw: number
  lgcs_created_2024: number
  lgcs_surrendered_2024: number
  lgcs_in_registry: number
  avg_price_received: number
}

export interface StcRecord {
  quarter: string         // e.g. "2024-Q1"
  stc_price_aud: number
  volume_created: number
  rooftop_solar_mw: number
  solar_hot_water_units: number
  heat_pump_units: number
  total_stc_value_m_aud: number
}

export interface RecMarketDashboard {
  timestamp: string
  lgc_spot_records: LgcSpotRecord[]
  surplus_deficit: SurplusDeficitRecord[]
  lgc_creation: LgcCreationRecord[]
  stc_records: StcRecord[]
  current_lgc_price: number
  current_stc_price: number
  lgc_surplus_deficit_m: number   // positive = surplus, negative = deficit in millions
  lret_target_2030_twh: number
  lret_progress_pct: number
}

// ---------------------------------------------------------------------------
// Sprint 46a — Transmission Congestion & Nodal Pricing Analytics
// ---------------------------------------------------------------------------

export interface ConstraintBindingRecord {
  constraint_id: string
  constraint_name: string
  interconnector: string       // e.g. VIC1-NSW1, QLD1-NSW1, SA1-VIC1
  direction: string            // IMPORT, EXPORT
  binding_hours_2024: number
  binding_pct: number          // % of trading intervals bound
  avg_shadow_price: number     // $/MWh
  max_shadow_price: number
  congestion_rent_m_aud: number
  primary_cause: string        // THERMAL, STABILITY, VOLTAGE, NETWORK_OUTAGE
}

export interface NodalPriceRecord {
  node_id: string
  node_name: string
  region: string
  node_type: string            // GENERATION, LOAD, INTERCONNECT
  avg_lmp_2024: number         // Locational Marginal Price $/MWh
  congestion_component: number
  loss_component: number
  energy_component: number
  max_lmp: number
  min_lmp: number
  price_volatility_pct: number
}

export interface CongestionRentRecord {
  year: number
  quarter: string
  interconnector: string
  total_rent_m_aud: number
  srec_allocated_m_aud: number  // Surplus Rent from Excess Capacity
  tnsp_retained_m_aud: number
  hedging_value_m_aud: number
}

export interface CongestionHeatmapRecord {
  month: string              // YYYY-MM
  interconnector: string
  avg_flow_mw: number
  capacity_mw: number
  utilisation_pct: number
  binding_events: number
  avg_price_separation: number  // $/MWh price diff between regions
}

export interface TransmissionCongestionDashboard {
  timestamp: string
  constraint_binding: ConstraintBindingRecord[]
  nodal_prices: NodalPriceRecord[]
  congestion_rent: CongestionRentRecord[]
  congestion_heatmap: CongestionHeatmapRecord[]
  total_congestion_rent_m_aud: number
  most_constrained_interconnector: string
  avg_binding_pct: number
  peak_shadow_price: number
}

// ---------------------------------------------------------------------------
// Sprint 46b — DERMS & DER Orchestration Analytics
// ---------------------------------------------------------------------------

export interface DerAggregatorRecord {
  aggregator_id: string
  aggregator_name: string
  state: string
  der_types: string[]
  enrolled_devices: number
  controllable_devices: number
  peak_dispatch_mw: number
  registered_capacity_mw: number
  market_registration: string   // VPP, FCAS, DEMAND_RESPONSE, ALL
  avg_response_time_sec: number
  dispatch_success_rate_pct: number
}

export interface DerDispatchEventRecord {
  event_id: string
  event_date: string
  aggregator_id: string
  aggregator_name: string
  trigger: string               // PRICE_SPIKE, GRID_FREQUENCY, OPERATOR_INSTRUCTION, SCHEDULED
  requested_mw: number
  delivered_mw: number
  response_accuracy_pct: number
  duration_minutes: number
  market_revenue_aud: number
  grid_service: string          // ENERGY, FCAS_R6, FCAS_R60, DEMAND_RESPONSE
}

export interface DerPortfolioRecord {
  state: string
  der_type: string              // ROOFTOP_SOLAR, HOME_BATTERY, EV_CHARGER, HVAC, HOT_WATER
  total_units: number
  smart_enabled_units: number
  smart_penetration_pct: number
  avg_capacity_kw: number
  total_capacity_mw: number
  potential_flexibility_mw: number
  enrolled_in_vpp_pct: number
}

export interface DerOrchestrationKpiRecord {
  month: string
  state: string
  total_der_dispatches: number
  total_energy_dispatched_mwh: number
  total_fcas_provided_mwh: number
  peak_coincidence_reduction_mw: number
  revenue_per_device_aud: number
  customer_satisfaction_score: number
}

export interface DermsOrchestrationDashboard {
  timestamp: string
  aggregators: DerAggregatorRecord[]
  dispatch_events: DerDispatchEventRecord[]
  der_portfolio: DerPortfolioRecord[]
  kpi_records: DerOrchestrationKpiRecord[]
  total_controllable_mw: number
  total_enrolled_devices: number
  avg_dispatch_accuracy_pct: number
  peak_flexibility_mw: number
}

// ---------------------------------------------------------------------------
// Sprint 46c — Electricity Market Design & Reform Analytics
// ---------------------------------------------------------------------------

export interface MarketDesignProposalRecord {
  proposal_id: string
  title: string
  proposing_body: string         // AEMC, AEMO, AER, GOVERNMENT, INDUSTRY
  reform_area: string            // CAPACITY_MECHANISM, PRICING, SETTLEMENT, STORAGE, DER, RETAIL, PLANNING
  status: string                 // CONSULTATION, DRAFT_DETERMINATION, FINAL_DETERMINATION, IMPLEMENTED, REJECTED
  lodgement_date: string
  decision_date: string | null
  impact_assessment: string      // LOW, MEDIUM, HIGH, TRANSFORMATIVE
  annual_benefit_m_aud: number | null
  affected_parties: string[]
  summary: string
}

export interface CapacityMechanismRecord {
  mechanism_id: string
  mechanism_name: string
  region: string
  mechanism_type: string         // RELIABILITY_OBLIGATION, CAPACITY_AUCTION, STRATEGIC_RESERVE, CAPACITY_PAYMENT
  status: string                 // PROPOSED, PILOT, OPERATIONAL
  target_capacity_mw: number
  contracted_capacity_mw: number
  cost_per_mw_aud: number
  duration_years: number
  technology_neutral: boolean
  storage_eligible: boolean
}

export interface SettlementReformRecord {
  reform_name: string
  implementation_date: string
  region: string
  pre_reform_avg_price: number
  post_reform_avg_price: number
  price_volatility_change_pct: number
  storage_revenue_change_m_aud: number
  demand_response_change_mw: number
  winner: string                 // GENERATORS, STORAGE, CONSUMERS, MIXED
  assessment: string
}

export interface MarketDesignComparisonRecord {
  market: string                 // NEM, WEM, ERCOT, PJM, CAISO, NORDPOOL, GB_NETA
  country: string
  market_type: string            // GROSS_POOL, NET_POOL, BILATERAL, HYBRID
  settlement_interval_min: number
  capacity_mechanism: string     // NONE, AUCTION, OBLIGATION, PAYMENT
  price_cap_aud_mwh: number
  renewables_pct: number
  avg_price_aud_mwh: number
  market_size_twh: number
}

export interface MarketDesignDashboard {
  timestamp: string
  proposals: MarketDesignProposalRecord[]
  capacity_mechanisms: CapacityMechanismRecord[]
  settlement_reforms: SettlementReformRecord[]
  market_comparison: MarketDesignComparisonRecord[]
  active_proposals: number
  implemented_reforms: number
  total_reform_benefit_b_aud: number
  capacity_mechanism_pipeline_gw: number
}

// ---------------------------------------------------------------------------
// Sprint 47a — REZ Capacity & Development Tracking
// ---------------------------------------------------------------------------

export interface RezZoneRecord {
  rez_id: string
  rez_name: string
  state: string
  region: string
  zone_type: string              // WIND, SOLAR, HYBRID
  isp_priority: string           // STEP_CHANGE, CENTRAL, SLOW_CHANGE
  target_capacity_mw: number
  connected_capacity_mw: number
  under_construction_mw: number
  approved_mw: number
  proposed_mw: number
  network_limit_mw: number
  augmentation_required_mw: number
  augmentation_cost_m_aud: number
}

export interface RezProjectRecord {
  project_id: string
  project_name: string
  rez_id: string
  rez_name: string
  technology: string             // WIND, SOLAR_FARM, HYBRID, STORAGE
  developer: string
  state: string
  capacity_mw: number
  status: string                 // OPERATING, CONSTRUCTION, APPROVED, PROPOSED
  connection_year: number | null
  annual_generation_gwh: number | null
  ppa_signed: boolean
  offtake_type: string           // MERCHANT, PPA_CORPORATE, PPA_RETAILER, GOVERNMENT
}

export interface RezNetworkAugRecord {
  project_id: string
  project_name: string
  rez_id: string
  asset_owner: string
  augmentation_type: string      // NEW_LINE, UPGRADE, SUBSTATION, TRANSFORMER, REACTIVE_SUPPORT
  voltage_kv: number
  capacity_increase_mw: number
  capex_m_aud: number
  status: string
  completion_year: number | null
  tnsp: string
}

export interface RezBuildOutRecord {
  year: number
  rez_id: string
  rez_name: string
  cumulative_capacity_mw: number
  annual_additions_mw: number
  curtailment_pct: number
  capacity_factor_pct: number
}

export interface RezCapacityDashboard {
  timestamp: string
  rez_zones: RezZoneRecord[]
  rez_projects: RezProjectRecord[]
  network_augmentations: RezNetworkAugRecord[]
  build_out_records: RezBuildOutRecord[]
  total_target_capacity_gw: number
  total_connected_gw: number
  total_pipeline_gw: number
  network_augmentation_cost_b_aud: number
}

// ---------------------------------------------------------------------------
// Sprint 47b — Retail Offer Comparison & Tariff Analytics
// ---------------------------------------------------------------------------

export interface MarketOfferRecord {
  offer_id: string
  retailer: string
  state: string
  offer_name: string
  offer_type: string
  daily_supply_charge: number
  peak_rate: number
  off_peak_rate: number | null
  shoulder_rate: number | null
  solar_fit_rate: number | null
  controlled_load_rate: number | null
  annual_bill_1500kwh: number
  annual_bill_5000kwh: number
  green_power_pct: number
  contract_term_months: number
  exit_fee_aud: number
  conditional_discount_pct: number
}

export interface DmoVsMarketRecord {
  state: string
  distributor: string
  year: number
  dmo_annual_bill: number
  avg_market_offer_bill: number
  cheapest_offer_bill: number
  market_discount_pct: number
  consumers_on_dmo_pct: number
}

export interface SolarFitRecord {
  state: string
  retailer: string
  fit_type: string
  fit_rate_c_kwh: number
  minimum_rate: boolean
  time_varying: boolean
  peak_fit_c_kwh: number | null
  off_peak_fit_c_kwh: number | null
  max_capacity_kw: number | null
}

export interface TariffStructureRecord {
  state: string
  retailer: string
  tariff_type: string
  peak_hours: string
  peak_rate: number
  off_peak_rate: number
  shoulder_rate: number | null
  demand_charge_kw_month: number | null
  battery_optimisation: boolean
  ev_charging_discount_pct: number | null
}

export interface RetailOfferComparisonDashboard {
  timestamp: string
  market_offers: MarketOfferRecord[]
  dmo_vs_market: DmoVsMarketRecord[]
  solar_fit_records: SolarFitRecord[]
  tariff_structures: TariffStructureRecord[]
  avg_market_discount_pct: number
  cheapest_offer_state: string
  avg_solar_fit_rate: number
  tou_adoption_pct: number
}

// ---------------------------------------------------------------------------
// Sprint 47c — AEMO System Operator Actions Dashboard
// ---------------------------------------------------------------------------

export interface SysOpDirectionRecord {
  direction_id: string
  issued_datetime: string
  region: string
  participant_id: string
  participant_name: string
  direction_type: string         // GENERATE, REDUCE_OUTPUT, INCREASE_LOAD, REDUCE_LOAD, MAINTAIN
  mw_directed: number
  reason: string                 // LOW_RESERVE, FREQUENCY, VOLTAGE, NETWORK, SECURITY
  duration_minutes: number
  actual_compliance_pct: number
  cost_aud: number
  outcome: string                // SUCCESSFUL, PARTIAL, FAILED
}

export interface SysOpRertActivation {
  activation_id: string
  activation_date: string
  region: string
  trigger: string                // LACK_OF_RESERVE_1, LACK_OF_RESERVE_2, LACK_OF_RESERVE_3
  contracted_mw: number
  activated_mw: number
  duration_hours: number
  providers: string[]
  total_cost_m_aud: number
  reserve_margin_pre_pct: number
  reserve_margin_post_pct: number
}

export interface LoadSheddingEvent {
  event_id: string
  event_date: string
  region: string
  state: string
  cause: string                  // GENERATION_SHORTFALL, NETWORK_FAILURE, EXTREME_DEMAND, CASCADING
  peak_shedding_mw: number
  duration_minutes: number
  affected_customers: number
  unserved_energy_mwh: number
  financial_cost_m_aud: number
  voll_cost_m_aud: number        // Value of Lost Load
}

export interface ConstraintRelaxation {
  relaxation_id: string
  constraint_id: string
  constraint_name: string
  region: string
  relaxation_date: string
  original_limit_mw: number
  relaxed_limit_mw: number
  relaxation_mw: number
  reason: string
  approval_authority: string
  duration_hours: number
  risk_assessment: string        // LOW, MEDIUM, HIGH
}

export interface SystemOperatorDashboard {
  timestamp: string
  directions: SysOpDirectionRecord[]
  rert_activations: SysOpRertActivation[]
  load_shedding: LoadSheddingEvent[]
  constraint_relaxations: ConstraintRelaxation[]
  total_directions_2024: number
  total_rert_activations_2024: number
  total_load_shed_mwh: number
  total_direction_cost_m_aud: number
}

// ---------------------------------------------------------------------------
// Sprint 48a — Offshore Wind Development Pipeline Analytics
// ---------------------------------------------------------------------------

export interface OWPDeclaredArea {
  area_id: string
  area_name: string
  state: string
  water_depth_range_m: string
  area_km2: number
  wind_resource_gw: number
  declaration_date: string
  licence_round: string
  licence_applications: number
  approved_licences: number
  grid_connection_point: string
  onshore_distance_km: number
}

export interface OWPLicenceRecord {
  licence_id: string
  declared_area_id: string
  area_name: string
  project_name: string
  developer: string
  consortium_members: string[]
  capacity_mw: number
  turbine_technology: string       // FIXED_BOTTOM, FLOATING
  turbine_mw: number
  num_turbines: number
  water_depth_avg_m: number
  distance_shore_km: number
  licence_status: string           // APPLICATION, FEASIBILITY, COMMERCIAL, CONSTRUCTION, OPERATING
  licence_granted_date: string | null
  first_power_year: number | null
  capex_b_aud: number
  lcoe_mwh: number
  export_cable_kv: number
}

export interface OWPSupplyChainRecord {
  component: string                // TURBINE, MONOPILE, JACKET, FLOATING_PLATFORM, CABLE, INSTALLATION_VESSEL
  australian_content_pct: number
  global_supply_constraint: string // LOW, MEDIUM, HIGH, CRITICAL
  lead_time_months: number
  key_suppliers: string[]
  port_requirements: string
}

export interface OWPCapacityOutlook {
  year: number
  scenario: string                 // STEP_CHANGE, CENTRAL
  cumulative_capacity_gw: number
  annual_additions_gw: number
  jobs_supported: number
  export_potential_gw: number
}

export interface OWPDashboard {
  timestamp: string
  declared_areas: OWPDeclaredArea[]
  licence_records: OWPLicenceRecord[]
  supply_chain: OWPSupplyChainRecord[]
  capacity_outlook: OWPCapacityOutlook[]
  total_declared_area_gw: number
  total_licenced_pipeline_gw: number
  operating_capacity_mw: number
  total_jobs_2030: number
}

// ---------------------------------------------------------------------------
// Sprint 48c — Network Tariff Reform & DNSP Analytics
// ---------------------------------------------------------------------------

export interface DnspTariffRecord48c {
  dnsp_id: string
  dnsp_name: string
  state: string
  tariff_name: string
  tariff_category: string        // RESIDENTIAL, SME, LARGE_BUSINESS, EV, SOLAR_EXPORT
  structure_type: string         // FLAT, TOU, DEMAND, CAPACITY, INCLINING_BLOCK
  daily_supply_charge: number
  peak_rate_kw_or_kwh: number    // $/kW or c/kWh depending on structure_type
  off_peak_rate: number | null
  shoulder_rate: number | null
  demand_charge_kw_month: number | null
  solar_export_rate: number | null   // c/kWh for export
  customer_count: number
  reform_status: string          // LEGACY, TRANSITIONING, REFORMED
}

export interface DnspRevenueRecord {
  dnsp_name: string
  state: string
  regulatory_period: string      // e.g. "2024-2029"
  total_revenue_allowance_b_aud: number
  capex_allowance_b_aud: number
  opex_allowance_b_aud: number
  wacc_pct: number
  regulatory_asset_base_b_aud: number
  customer_numbers: number
  avg_revenue_per_customer_aud: number
  aer_approved: boolean
}

export interface TariffReformRecord {
  reform_id: string
  reform_name: string
  dnsp_name: string
  state: string
  reform_type: string            // COST_REFLECTIVE, DER_INTEGRATION, EV_TARIFF, SOLAR_EXPORT, CAPACITY_BASED
  implementation_date: string
  customers_affected: number
  avg_bill_change_pct: number    // positive = increase, negative = decrease
  peak_demand_reduction_mw: number
  der_integration_benefit_m_aud: number
  status: string                 // PROPOSED, APPROVED, TRANSITIONING, COMPLETE
  aer_position: string           // SUPPORTED, CONDITIONAL, OPPOSED, REVIEWING
}

export interface DerNetworkImpactRecord {
  dnsp_name: string
  state: string
  year: number
  rooftop_solar_gw: number
  home_battery_gw: number
  ev_charger_gw: number
  reverse_power_flow_events: number
  voltage_violations: number
  network_augmentation_avoided_m_aud: number
  hosting_capacity_constraint_pct: number  // % of feeders at hosting capacity limit
}

export interface NetworkTariffReformDashboard {
  timestamp: string
  dnsp_tariffs: DnspTariffRecord48c[]
  dnsp_revenue: DnspRevenueRecord[]
  tariff_reforms: TariffReformRecord[]
  der_network_impacts: DerNetworkImpactRecord[]
  total_network_revenue_b_aud: number
  reformed_customers_pct: number
  avg_peak_demand_reduction_mw: number
  network_augmentation_avoided_b_aud: number
}

// ---------------------------------------------------------------------------
// Sprint 48b — NEM Price Spike Post-Event Analysis
// ---------------------------------------------------------------------------

export interface PSAEventRecord {
  spike_id: string
  event_name: string
  region: string
  event_date: string
  start_time: string
  end_time: string
  duration_minutes: number
  peak_price_aud_mwh: number
  avg_price_during_spike: number
  pre_spike_avg_price: number
  price_multiple: number
  total_revenue_m_aud: number
  consumer_cost_m_aud: number
  hedged_consumer_cost_m_aud: number
  root_cause: string
  severity: string
}

export interface PSAContributorRecord {
  spike_id: string
  participant_name: string
  technology: string
  contribution_type: string
  mw_impact: number
  price_contribution_aud_mwh: number
  revenue_gained_m_aud: number
  regulatory_action: string | null
}

export interface PSAConsumerImpact {
  spike_id: string
  consumer_segment: string
  region: string
  hedged_exposure_pct: number
  unhedged_cost_m_aud: number
  demand_response_mw: number
  air_con_curtailment_mw: number
  price_signal_response_pct: number
}

export interface PSARegionalTimeline {
  spike_id: string
  region: string
  interval: string
  spot_price: number
  generation_mw: number
  demand_mw: number
  interconnector_flow_mw: number
  reserve_margin_pct: number
}

export interface PSADashboard {
  timestamp: string
  spike_events: PSAEventRecord[]
  contributors: PSAContributorRecord[]
  consumer_impacts: PSAConsumerImpact[]
  regional_timelines: PSARegionalTimeline[]
  total_spike_events_2024: number
  total_consumer_cost_m_aud: number
  avg_spike_duration_min: number
  most_affected_region: string
}

// ---------------------------------------------------------------------------
// Sprint 49c — Solar Irradiance & Resource Assessment Analytics
// ---------------------------------------------------------------------------

export interface IrradianceSiteRecord {
  site_id: string
  site_name: string
  state: string
  latitude: number
  longitude: number
  annual_ghi_kwh_m2: number
  annual_dni_kwh_m2: number
  annual_dhi_kwh_m2: number
  peak_sun_hours: number
  cloud_cover_pct: number
  temperature_annual_avg_c: number
  dust_soiling_loss_pct: number
  resource_class: string
}

export interface SolarFarmYieldRecord {
  farm_id: string
  farm_name: string
  state: string
  technology: string
  installed_capacity_mw: number
  panel_brand: string
  panel_efficiency_pct: number
  inverter_efficiency_pct: number
  performance_ratio_pct: number
  annual_yield_gwh: number
  specific_yield_kwh_kwp: number
  capacity_factor_pct: number
  degradation_year1_pct: number
  degradation_annual_pct: number
  p90_yield_gwh: number
  pr_degradation_5yr: number
}

export interface MonthlyIrradianceRecord {
  site_id: string
  site_name: string
  month: number
  month_name: string
  ghi_kwh_m2_day: number
  dni_kwh_m2_day: number
  dhi_kwh_m2_day: number
  sunshine_hours: number
  avg_temp_c: number
  irradiance_variability_pct: number
}

export interface SolarDegradationRecord {
  technology: string
  panel_type: string
  year: number
  avg_efficiency_pct: number
  performance_ratio_pct: number
  cumulative_degradation_pct: number
  failure_rate_pct: number
}

export interface SolarResourceDashboard {
  timestamp: string
  irradiance_sites: IrradianceSiteRecord[]
  farm_yields: SolarFarmYieldRecord[]
  monthly_irradiance: MonthlyIrradianceRecord[]
  degradation_records: SolarDegradationRecord[]
  best_solar_resource_site: string
  avg_capacity_factor_pct: number
  total_assessed_capacity_mw: number
  avg_specific_yield_kwh_kwp: number
}

// ---------------------------------------------------------------------------
// Sprint 49a — Energy Storage Revenue Stacking & Optimisation
// ---------------------------------------------------------------------------

export interface StorageRevenueWaterfall {
  project_id: string
  project_name: string
  state: string
  capacity_mwh: number
  power_mw: number
  energy_arbitrage_m_aud: number
  fcas_raise_m_aud: number
  fcas_lower_m_aud: number
  capacity_market_m_aud: number
  network_services_m_aud: number
  ancillary_services_m_aud: number
  total_revenue_m_aud: number
  lcoe_mwh: number
  simple_payback_years: number
  irr_pct: number
}

export interface StorageDispatchOptRecord {
  hour: number
  month: string
  optimal_action: string
  energy_price: number
  fcas_contingency_price: number
  fcas_regulation_price: number
  soc_start_pct: number
  soc_end_pct: number
  energy_mwh: number
  revenue_aud: number
  service_priority: string
}

export interface MultiServiceBidRecord {
  project_id: string
  project_name: string
  trading_date: string
  energy_bid_mw: number
  fcas_contingency_raise_mw: number
  fcas_contingency_lower_mw: number
  fcas_regulation_raise_mw: number
  fcas_regulation_lower_mw: number
  energy_price_bid: number
  total_fcas_revenue_aud: number
  total_energy_revenue_aud: number
  co_optimisation_benefit_pct: number
}

export interface StorageScenarioRecord {
  scenario: string
  capacity_mwh: number
  annual_revenue_m_aud: number
  annual_cost_m_aud: number
  annual_profit_m_aud: number
  roi_pct: number
  payback_years: number
  project_npv_m_aud: number
}

export interface StorageRevenueStackDashboard {
  timestamp: string
  revenue_waterfall: StorageRevenueWaterfall[]
  dispatch_optimisation: StorageDispatchOptRecord[]
  multi_service_bids: MultiServiceBidRecord[]
  scenario_comparison: StorageScenarioRecord[]
  avg_total_revenue_m_aud: number
  best_revenue_project: string
  energy_vs_fcas_split_pct: number
  co_optimisation_benefit_pct: number
}

// ---------------------------------------------------------------------------
// Sprint 49b — Electricity Futures Market Risk Analytics
// ---------------------------------------------------------------------------

export interface VaRRecord {
  date: string
  region: string
  portfolio_type: string
  notional_position_m_aud: number
  var_95_m_aud: number
  var_99_m_aud: number
  cvar_95_m_aud: number
  delta_mwh: number
  gamma: number
  vega: number
  theta_daily_aud: number
}

export interface FMRHedgeEffectivenessRecord {
  quarter: string
  region: string
  participant: string
  hedge_ratio_pct: number
  hedge_instrument: string
  avg_hedge_price: number
  avg_spot_price: number
  hedge_gain_loss_m_aud: number
  effectiveness_score_pct: number
  basis_risk_m_aud: number
}

export interface BasisRiskRecord {
  region: string
  year: number
  quarter: string
  futures_settlement_price: number
  spot_price_avg: number
  basis_aud_mwh: number
  basis_volatility: number
  max_basis_aud_mwh: number
  min_basis_aud_mwh: number
  risk_exposure_m_aud: number
}

export interface FuturesPositionRecord {
  participant: string
  participant_type: string
  region: string
  contract_quarter: string
  long_position_mw: number
  short_position_mw: number
  net_position_mw: number
  avg_entry_price: number
  mark_to_market_m_aud: number
  margin_posted_m_aud: number
}

export interface FuturesMarketRiskDashboard {
  timestamp: string
  var_records: VaRRecord[]
  hedge_effectiveness: FMRHedgeEffectivenessRecord[]
  basis_risk: BasisRiskRecord[]
  futures_positions: FuturesPositionRecord[]
  portfolio_var_95_m_aud: number
  avg_hedge_ratio_pct: number
  total_open_interest_mw: number
  avg_basis_risk_aud_mwh: number
}

// ---------------------------------------------------------------------------
// Sprint 50a — Wind Resource & Wake Effect Analytics
// ---------------------------------------------------------------------------

export interface WindSiteAssessment {
  site_id: string
  site_name: string
  state: string
  mean_wind_speed_ms: number
  wind_power_density_wm2: number
  turbulence_intensity_pct: number
  weibull_k: number
  weibull_c: number
  predominant_direction: string
  resource_class: string
  capacity_factor_potential_pct: number
  elevation_m: number
  terrain_roughness: string
}

export interface WindFarmPerformance {
  farm_id: string
  farm_name: string
  state: string
  installed_capacity_mw: number
  turbine_model: string
  turbine_rating_mw: number
  num_turbines: number
  hub_height_m: number
  rotor_diameter_m: number
  actual_capacity_factor_pct: number
  p90_capacity_factor_pct: number
  wake_loss_pct: number
  availability_pct: number
  curtailment_pct: number
  annual_generation_gwh: number
  specific_power_wm2: number
}

export interface WakeLossRecord {
  farm_id: string
  farm_name: string
  wind_direction: string
  wind_speed_bin_ms: number
  gross_generation_gwh: number
  wake_loss_gwh: number
  wake_loss_pct: number
  near_wake_loss_pct: number
  far_wake_loss_pct: number
  inter_farm_wake_pct: number
}

export interface WindResourceRecord {
  region: string
  month: number
  month_name: string
  avg_wind_speed_ms: number
  p90_wind_speed_ms: number
  capacity_factor_monthly_pct: number
  generation_gwh: number
  curtailment_mwh: number
}

export interface WindResourceDashboard {
  timestamp: string
  site_assessments: WindSiteAssessment[]
  farm_performance: WindFarmPerformance[]
  wake_loss_records: WakeLossRecord[]
  monthly_resource: WindResourceRecord[]
  best_wind_resource_site: string
  avg_capacity_factor_pct: number
  total_wind_capacity_mw: number
  avg_wake_loss_pct: number
}

// ---------------------------------------------------------------------------
// Sprint 50c — Microgrids & Remote Area Power Systems Analytics
// ---------------------------------------------------------------------------

export interface MicrogridRecord {
  microgrid_id: string
  microgrid_name: string
  location: string
  state: string
  community_type: string
  grid_type: string
  peak_demand_kw: number
  solar_capacity_kw: number
  wind_capacity_kw: number
  storage_kwh: number
  diesel_gen_kw: number
  annual_consumption_mwh: number
  renewable_fraction_pct: number
  diesel_displaced_litres_yr: number
  diesel_cost_saving_aud_yr: number
  co2_avoided_tpa: number
  energy_autonomy_days: number
  operator: string
  status: string
}

export interface DieselDisplacementRecord {
  state: string
  year: number
  quarter: string
  total_microgrids: number
  total_diesel_gen_kw: number
  total_solar_kw: number
  total_storage_kwh: number
  diesel_litres_consumed: number
  renewable_fraction_pct: number
  avg_lcoe_diesel_mwh: number
  avg_lcoe_hybrid_mwh: number
  cost_saving_m_aud: number
}

export interface MicrogridEnergyRecord {
  microgrid_id: string
  microgrid_name: string
  month: number
  month_name: string
  solar_generation_mwh: number
  wind_generation_mwh: number
  diesel_generation_mwh: number
  storage_discharge_mwh: number
  demand_mwh: number
  curtailment_mwh: number
  renewable_fraction_pct: number
}

export interface OffGridTechnologyRecord {
  technology: string
  installed_capacity_kw: number
  sites_deployed: number
  avg_cost_per_kw: number
  reliability_pct: number
  maintenance_cost_kw_yr: number
  design_life_years: number
}

export interface MicrogridDashboard {
  timestamp: string
  microgrids: MicrogridRecord[]
  diesel_displacement: DieselDisplacementRecord[]
  energy_records: MicrogridEnergyRecord[]
  technology_summary: OffGridTechnologyRecord[]
  total_microgrids: number
  avg_renewable_fraction_pct: number
  total_diesel_displaced_ml: number
  total_co2_avoided_tpa: number
}

// ---------------------------------------------------------------------------
// Sprint 50b — Corporate PPA Market Analytics
// ---------------------------------------------------------------------------

export interface CorporatePpaDeal {
  deal_id: string
  project_name: string
  technology: string
  state: string
  offtaker_name: string
  offtaker_sector: string
  deal_type: string
  contract_length_years: number
  capacity_mw: number
  annual_energy_gwh: number
  strike_price_mwh: number
  market_price_at_signing: number
  signing_date: string
  first_delivery_date: string | null
  additionality: boolean
  bundled_lgcs: boolean
  green_power_accredited: boolean
}

export interface PpaOfftakerRecord {
  offtaker_name: string
  sector: string
  total_contracted_mw: number
  total_contracted_gwh: number
  num_deals: number
  avg_strike_price: number
  earliest_deal_year: number
  net_zero_target: number | null
  re100_member: boolean
  sustainability_rating: string
}

export interface PpaPriceTrendRecord {
  year: number
  quarter: string
  technology: string
  region: string
  avg_strike_price_mwh: number
  min_strike_price_mwh: number
  max_strike_price_mwh: number
  num_deals: number
  total_capacity_mw: number
  spot_price_comparison: number
}

export interface PpaMarketSummaryRecord {
  year: number
  total_deals: number
  total_capacity_mw: number
  total_value_m_aud: number
  avg_contract_years: number
  physical_pct: number
  financial_pct: number
  additionality_pct: number
  top_sector: string
}

export interface CorporatePpaMarketDashboard {
  timestamp: string
  ppa_deals: CorporatePpaDeal[]
  offtakers: PpaOfftakerRecord[]
  price_trends: PpaPriceTrendRecord[]
  market_summary: PpaMarketSummaryRecord[]
  total_contracted_capacity_mw: number
  avg_ppa_price_mwh: number
  additionality_pct: number
  yoy_growth_pct: number
}

// ---------------------------------------------------------------------------
// Sprint 51a — Electricity Market Liquidity & Trading Volume Analytics
// ---------------------------------------------------------------------------

export interface TradingVolumeRecord {
  date: string
  region: string
  venue: string
  product: string
  volume_mw: number
  volume_gwh: number
  num_trades: number
  avg_trade_size_mw: number
  vwap_aud_mwh: number
}

export interface BidAskSpreadRecord {
  date: string
  region: string
  product: string
  contract_quarter: string
  bid_price: number
  ask_price: number
  mid_price: number
  spread_aud_mwh: number
  spread_pct: number
  market_depth_mw: number
  num_market_makers: number
}

export interface MarketDepthRecord {
  region: string
  product: string
  price_level: number
  bid_volume_mw: number
  ask_volume_mw: number
  cumulative_bid_mw: number
  cumulative_ask_mw: number
}

export interface LiquidityMetricRecord {
  year: number
  quarter: string
  region: string
  total_volume_twh: number
  exchange_share_pct: number
  otc_share_pct: number
  bilateral_share_pct: number
  turnover_ratio: number
  avg_spread_aud_mwh: number
  market_maker_count: number
  herfindahl_index: number
}

export interface MarketLiquidityDashboard {
  timestamp: string
  trading_volumes: TradingVolumeRecord[]
  bid_ask_spreads: BidAskSpreadRecord[]
  market_depth: MarketDepthRecord[]
  liquidity_metrics: LiquidityMetricRecord[]
  total_daily_volume_gwh: number
  avg_spread_aud_mwh: number
  exchange_share_pct: number
  turnover_ratio: number
}

// ---------------------------------------------------------------------------
// Sprint 51b — Industrial Demand Flexibility & Load Management
// ---------------------------------------------------------------------------

export interface LargeConsumerRecord {
  consumer_id: string
  consumer_name: string
  industry_type: string
  state: string
  region: string
  peak_demand_mw: number
  annual_consumption_gwh: number
  flexibility_mw: number
  flexibility_duration_hours: number
  response_time_minutes: number
  contracted_dr_mw: number
  contract_type: string
  annual_dr_revenue_m_aud: number
  sustainability_score: number
}

export interface FlexibilityEventRecord {
  event_id: string
  consumer_id: string
  consumer_name: string
  event_date: string
  event_type: string
  trigger_price_mwh: number
  requested_reduction_mw: number
  actual_reduction_mw: number
  response_accuracy_pct: number
  duration_hours: number
  settlement_aud: number
  grid_benefit_mwh: number
}

export interface IndustrialLoadShapeRecord {
  consumer_id: string
  consumer_name: string
  industry_type: string
  hour: number
  season: string
  baseline_mw: number
  min_curtailable_mw: number
  flexibility_band_mw: number
  spot_response_threshold: number
}

export interface DemandFlexAggregateRecord {
  region: string
  year: number
  quarter: string
  enrolled_consumers: number
  total_flex_capacity_mw: number
  activated_events: number
  total_energy_reduced_mwh: number
  total_revenue_m_aud: number
  grid_services_value_m_aud: number
  avg_response_accuracy_pct: number
}

export interface IndustrialDemandFlexDashboard {
  timestamp: string
  large_consumers: LargeConsumerRecord[]
  flexibility_events: FlexibilityEventRecord[]
  load_shapes: IndustrialLoadShapeRecord[]
  aggregate_records: DemandFlexAggregateRecord[]
  total_flex_capacity_mw: number
  activated_events_2024: number
  total_dr_revenue_m_aud: number
  avg_response_accuracy_pct: number
}

// ---------------------------------------------------------------------------
// Sprint 51c — Thermal Power Plant Heat Rate & Efficiency Analytics
// ---------------------------------------------------------------------------

export interface ThermalUnitRecord {
  unit_id: string
  unit_name: string
  station_name: string
  owner: string
  state: string
  technology: string
  installed_capacity_mw: number
  age_years: number
  commission_year: number
  retirement_year: number | null
  design_heat_rate_gj_mwh: number
  actual_heat_rate_gj_mwh: number
  heat_rate_degradation_pct: number
  gross_efficiency_pct: number
  net_efficiency_pct: number
  auxiliary_load_pct: number
  fuel_type: string
  co2_intensity_kg_mwh: number
}

export interface HeatRateTrendRecord {
  unit_id: string
  unit_name: string
  year: number
  actual_heat_rate_gj_mwh: number
  benchmark_heat_rate_gj_mwh: number
  deviation_pct: number
  capacity_factor_pct: number
  load_following_cycles: number
  starts_stops: number
  major_overhaul: boolean
}

export interface FuelCostRecord {
  unit_id: string
  unit_name: string
  technology: string
  year: number
  fuel_price_gj: number
  fuel_cost_mwh: number
  variable_om_mwh: number
  fixed_om_mw_yr: number
  total_srmc_mwh: number
  carbon_cost_mwh: number
  all_in_cost_mwh: number
}

export interface ThermalBenchmarkRecord {
  technology: string
  benchmark_type: string
  heat_rate_gj_mwh: number
  efficiency_pct: number
  co2_intensity_kg_mwh: number
  fuel_cost_mwh: number
  srmc_mwh: number
}

export interface ThermalEfficiencyDashboard {
  timestamp: string
  thermal_units: ThermalUnitRecord[]
  heat_rate_trends: HeatRateTrendRecord[]
  fuel_costs: FuelCostRecord[]
  benchmarks: ThermalBenchmarkRecord[]
  fleet_avg_heat_rate_gj_mwh: number
  fleet_avg_efficiency_pct: number
  worst_heat_rate_unit: string
  total_fuel_cost_b_aud_yr: number
}

// ---------------------------------------------------------------------------
// Sprint 52a — Energy Storage LCA & Sustainability Analytics
// ---------------------------------------------------------------------------

export interface StorageLcaRecord {
  technology_id: string
  technology_name: string
  capacity_category: string
  embodied_carbon_kgco2_kwh: number
  operational_carbon_kgco2_kwh: number
  eol_carbon_kgco2_kwh: number
  total_lifecycle_kgco2_kwh: number
  energy_payback_years: number
  water_use_l_kwh: number
  land_use_m2_kwh: number
  recyclability_pct: number
  design_life_years: number
  round_trip_efficiency_pct: number
}

export interface CriticalMineralRecord {
  mineral: string
  technology: string
  content_kg_kwh: number
  australian_reserves_pct: number
  supply_risk: string
  price_usd_kg: number
  price_trend: string
  recycling_rate_pct: number
  circular_economy_potential: string
}

export interface RecyclingRecord {
  technology: string
  recycling_process: string
  recovery_efficiency_pct: number
  cost_per_kwh: number
  carbon_benefit_kgco2_kwh: number
  commercial_maturity: string
  key_players: string[]
}

export interface LcaScenarioRecord {
  year: number
  scenario: string
  technology: string
  lifecycle_carbon_kgco2_kwh: number
  vs_gas_peaker_ratio: number
  vs_diesel_ratio: number
}

export interface StorageLcaDashboard {
  timestamp: string
  lca_records: StorageLcaRecord[]
  critical_minerals: CriticalMineralRecord[]
  recycling_records: RecyclingRecord[]
  lca_scenarios: LcaScenarioRecord[]
  best_lifecycle_technology: string
  avg_recyclability_pct: number
  critical_minerals_at_risk: number
  total_technologies_assessed: number
}

// ---------------------------------------------------------------------------
// Sprint 52b — Interconnector Flow & Limit Binding Analytics
// ---------------------------------------------------------------------------

export interface IFAInterconnectorRecord {
  interconnector_id: string
  interconnector_name: string
  from_region: string
  to_region: string
  ic_type: string
  max_import_mw: number
  max_export_mw: number
  current_capacity_mw: number
  status: string
  commission_year: number | null
  capex_b_aud: number | null
  length_km: number
  voltage_kv: number
  operator: string
}

export interface IFAFlowRecord {
  month: string
  interconnector_id: string
  interconnector_name: string
  avg_flow_mw: number
  max_flow_mw: number
  min_flow_mw: number
  import_binding_hours: number
  export_binding_hours: number
  import_binding_pct: number
  export_binding_pct: number
  avg_price_diff_aud_mwh: number
  congestion_rent_m_aud: number
}

export interface IFACapacityUpgradeRecord {
  project_id: string
  project_name: string
  interconnector_id: string
  upgrade_type: string
  additional_capacity_mw: number
  estimated_capex_m_aud: number
  benefit_cost_ratio: number
  regulated_asset: boolean
  status: string
  completion_year: number | null
  annual_consumer_benefit_m_aud: number
}

export interface IFAFlowPatternRecord {
  interconnector_id: string
  hour_of_day: number
  season: string
  avg_flow_mw: number
  flow_direction: string
  renewable_driven: boolean
}

export interface IFADashboard {
  timestamp: string
  interconnectors: IFAInterconnectorRecord[]
  flow_records: IFAFlowRecord[]
  capacity_upgrades: IFACapacityUpgradeRecord[]
  flow_patterns: IFAFlowPatternRecord[]
  total_ic_capacity_mw: number
  avg_binding_pct: number
  total_congestion_rent_m_aud: number
  planned_capacity_increase_mw: number
}

// ---------------------------------------------------------------------------
// Sprint 52c — AEMO ISP Progress Tracker
// ---------------------------------------------------------------------------

export interface IspActionableProject {
  project_id: string
  project_name: string
  project_type: string
  proponent: string
  state: string
  region: string
  isp_category: string
  capacity_mw: number
  investment_m_aud: number
  isp_benefit_m_aud: number
  benefit_cost_ratio: number
  need_year: number
  committed_year: number | null
  completion_year: number | null
  status: string
  regulatory_hurdle: string | null
}

export interface IspCapacityMilestone {
  year: number
  scenario: string
  region: string
  wind_target_gw: number
  solar_target_gw: number
  storage_target_gwh: number
  transmission_target_gw: number
  wind_actual_gw: number | null
  solar_actual_gw: number | null
  storage_actual_gwh: number | null
  on_track: boolean | null
}

export interface IspScenarioRecord {
  scenario: string
  description: string
  total_investment_b_aud: number
  renewables_share_2035_pct: number
  renewables_share_2040_pct: number
  emissions_reduction_2035_pct: number
  coal_exit_year: number
  new_storage_gwh_2035: number
  new_transmission_km: number
  consumer_bill_impact_aud_yr: number
}

export interface IspDeliveryRiskRecord {
  project_category: string
  total_projects: number
  on_schedule_pct: number
  at_risk_pct: number
  delayed_pct: number
  stalled_pct: number
  key_risk: string
  risk_mitigation: string
}

export interface IspProgressDashboard {
  timestamp: string
  actionable_projects: IspActionableProject[]
  capacity_milestones: IspCapacityMilestone[]
  scenarios: IspScenarioRecord[]
  delivery_risks: IspDeliveryRiskRecord[]
  total_actionable_investment_b_aud: number
  committed_projects: number
  projects_on_track_pct: number
  step_change_renewable_target_gw_2030: number
}

// ============================================================
// Sprint 53b — Electricity Demand Forecasting Models
// ============================================================

export interface DFMModelRecord {
  model_id: string
  name: string
  region: string
  mae_mw: number
  rmse_mw: number
  mape_pct: number
  r_squared: number
  training_data_years: number
  last_retrained: string
}

export interface DFMForecastRecord {
  model_id: string
  region: string
  forecast_date: string
  hour: number
  forecast_mw: number
  actual_mw: number | null
  lower_bound_mw: number
  upper_bound_mw: number
  temperature_degc: number
}

export interface DFMSeasonalPatternRecord {
  region: string
  season: string
  peak_demand_mw: number
  avg_demand_mw: number
  min_demand_mw: number
  peak_hour: number
  temp_sensitivity_mw_per_degc: number
}

export interface DFMFeatureImportanceRecord {
  model_id: string
  feature: string
  importance_score: number
}

export interface DemandForecastModelsDashboard {
  timestamp: string
  models: DFMModelRecord[]
  forecasts: DFMForecastRecord[]
  seasonal_patterns: DFMSeasonalPatternRecord[]
  feature_importance: DFMFeatureImportanceRecord[]
}

// ---------------------------------------------------------------------------
// Sprint 53c — Firming Technology Economics
// ---------------------------------------------------------------------------

export interface FirmingTechnologyRecord {
  tech_id: string
  name: string
  category: string
  capex_m_aud_mw: number
  opex_m_aud_mw_yr: number
  lcos_aud_mwh: number
  capacity_factor_pct: number
  response_time_min: number
  duration_hours: number | null
  co2_kg_mwh: number
  commercial_maturity: string
}

export interface FirmingDispatchRecord {
  tech_id: string
  scenario: string
  dispatch_events_yr: number
  avg_duration_hr: number
  avg_revenue_m_aud_yr: number
  capacity_payment_m_aud_yr: number
  total_revenue_m_aud_yr: number
}

export interface FirmingCostCurveRecord {
  scenario: string
  firming_requirement_pct: number
  avg_firming_cost_aud_mwh: number
  optimal_mix_str: string
  total_system_cost_m_aud_yr: number
}

export interface FirmingScenarioRecord {
  scenario_id: string
  name: string
  vre_penetration_pct: number
  firming_capacity_gw: number
  recommended_mix: string
  avg_lcoe_aud_mwh: number
}

export interface FirmingTechDashboard {
  timestamp: string
  technologies: FirmingTechnologyRecord[]
  dispatch_records: FirmingDispatchRecord[]
  cost_curves: FirmingCostCurveRecord[]
  scenarios: FirmingScenarioRecord[]
}

// ---------------------------------------------------------------------------
// Sprint 53a — Energy Market Stress Testing
// ---------------------------------------------------------------------------

export interface MarketStressScenario {
  scenario_id: string
  name: string
  description: string
  trigger_event: string
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'EXTREME'
  probability_pct: number
  duration_days: number
}

export interface StressTestResult {
  scenario_id: string
  region: string
  metric: 'PRICE' | 'AVAILABILITY' | 'RELIABILITY' | 'REVENUE'
  baseline_value: number
  stressed_value: number
  impact_pct: number
  recovery_days: number
}

export interface SystemVulnerabilityRecord {
  component: string
  vulnerability_score: number
  single_point_of_failure: boolean
  mitigation_status: string
}

export interface StressTestKpiRecord {
  scenario: string
  avg_price_spike_pct: number
  max_price_aud_mwh: number
  unserved_energy_mwh: number
  affected_consumers_k: number
  economic_cost_m_aud: number
}

export interface MarketStressDashboard {
  timestamp: string
  scenarios: MarketStressScenario[]
  results: StressTestResult[]
  vulnerabilities: SystemVulnerabilityRecord[]
  kpis: StressTestKpiRecord[]
}

export const getMarketStressDashboard = (): Promise<MarketStressDashboard> =>
  get<MarketStressDashboard>('/api/market-stress/dashboard')

// ── Sprint 54a: NEM Frequency Control Analytics ───────────────────────────

export interface NFCFrequencyRecord {
  date: string
  region: string
  avg_freq_hz: number
  std_dev_hz: number
  time_in_band_pct: number
  high_freq_deviations: number
  low_freq_deviations: number
  max_freq_hz: number
  min_freq_hz: number
}

export interface NFCEventRecord {
  event_id: string
  datetime: string
  trigger: 'GENERATOR_TRIP' | 'LOAD_REJECTION' | 'INTERCONNECTOR_SEPARATION' | 'DEMAND_FORECAST_ERROR'
  nadir_hz: number
  recovery_time_sec: number
  rocof_hz_per_sec: number
  unserved_energy_mwh: number
  region: string
}

export interface NFCContributorRecord {
  technology: string
  pfr_response_mw: number
  response_speed_ms: number
  droop_setting_pct: number
  contribution_pct: number
  portfolio_mw: number
}

export interface NFCPerformanceRecord {
  month: string
  compliance_rate_pct: number
  fcas_shortfall_events: number
  pfr_response_adequacy_pct: number
  avg_nadir_hz: number
  avg_rocof: number
}

export interface FrequencyControlDashboard {
  timestamp: string
  frequency_records: NFCFrequencyRecord[]
  events: NFCEventRecord[]
  contributors: NFCContributorRecord[]
  performance: NFCPerformanceRecord[]
}

export const getFrequencyControlDashboard = (): Promise<FrequencyControlDashboard> =>
  get<FrequencyControlDashboard>('/api/frequency-control/dashboard')

// ---------------------------------------------------------------------------
// Sprint 54b — NEM Capacity Investment Signals
// ---------------------------------------------------------------------------

export interface CISNewEntrantRecord {
  technology: string
  region: string
  capex_m_aud_mw: number
  wacc_pct: number
  loe_aud_mwh: number
  breakeven_price_aud_mwh: number
  payback_years: number
  npv_m_aud: number
  irr_pct: number
}

export interface CISInvestmentActivityRecord {
  year: number
  technology: string
  committed_mw: number
  cancelled_mw: number
  net_investment_mw: number
  announced_projects: number
  financing_secured_pct: number
}

export interface CISPriceSignalRecord {
  region: string
  year: number
  avg_spot_price: number
  time_weighted_price: number
  peak_peaker_price: number
  revenue_adequacy_signal: 'STRONG' | 'ADEQUATE' | 'WEAK' | 'INSUFFICIENT'
}

export interface CISExitRiskRecord {
  unit_id: string
  unit_name: string
  technology: string
  age_years: number
  remaining_life_years: number
  exit_probability_5yr_pct: number
  exit_trigger: 'ECONOMICS' | 'AGE' | 'POLICY' | 'REGULATION'
  capacity_mw: number
}

export interface CapacityInvestmentDashboard {
  timestamp: string
  new_entrant_costs: CISNewEntrantRecord[]
  investment_activity: CISInvestmentActivityRecord[]
  price_signals: CISPriceSignalRecord[]
  exit_risks: CISExitRiskRecord[]
}

export const getCapacityInvestmentDashboard = (): Promise<CapacityInvestmentDashboard> =>
  get<CapacityInvestmentDashboard>('/api/capacity-investment/dashboard')

// ---------------------------------------------------------------------------
// Sprint 54c — REC & PPAs Certificate Tracking
// ---------------------------------------------------------------------------

export interface RCTLgcPriceRecord {
  month: string
  lgc_spot_price_aud: number
  lgc_forward_2026_aud: number
  lgc_forward_2027_aud: number
  volume_k_certificates: number
  open_interest_k: number
}

export interface RCTSurplusDeficitRecord {
  year: number
  lret_target_gwh: number
  liable_entity_surrenders_gwh: number
  surplus_deficit_gwh: number
  surplus_deficit_pct: number
  new_projects_gwh: number
}

export interface RCTCreationRecord {
  technology: string
  region: string
  lgcs_created_k: number
  year: number
  capacity_mw: number
  avg_lgc_yield_per_mw: number
  accredited_projects: number
}

export interface RCTComplianceRecord {
  retailer: string
  market_share_pct: number
  liable_energy_gwh: number
  certificates_surrendered_k: number
  compliance_status: 'COMPLIANT' | 'SHORTFALL' | 'DEFERRED'
  shortfall_charge_m_aud: number
}

export interface RCTGreenPowerRecord {
  state: string
  greenpower_customers_k: number
  greenpower_gwh: number
  avg_premium_aud_mwh: number
  yoy_growth_pct: number
}

export interface RecCertificateDashboard {
  timestamp: string
  lgc_prices: RCTLgcPriceRecord[]
  surplus_deficit: RCTSurplusDeficitRecord[]
  creation: RCTCreationRecord[]
  compliance: RCTComplianceRecord[]
  greenpower: RCTGreenPowerRecord[]
}

export const getRecCertificateDashboard = (): Promise<RecCertificateDashboard> =>
  get<RecCertificateDashboard>('/api/rec-tracking/dashboard')

// ── Sprint 55a — NEM Spot Market Depth & Order Flow Analytics ──────────────

export interface SMDBidStackRecord {
  interval: string
  region: string
  price_band_aud_mwh: number
  cumulative_mw: number
  technology: string
  participant_count: number
}

export interface SMDOrderFlowRecord {
  interval: string
  region: string
  buy_volume_mw: number
  sell_volume_mw: number
  net_flow_mw: number
  price_impact_aud_mwh: number
  participant_id: string
}

export interface SMDMarketDepthSnapshot {
  snapshot_time: string
  region: string
  bid_depth_mw: number
  offer_depth_mw: number
  bid_ask_spread_aud: number
  best_bid_aud: number
  best_ask_aud: number
  imbalance_ratio: number
}

export interface SMDParticipantFlowRecord {
  participant: string
  region: string
  avg_bid_mw: number
  avg_offer_mw: number
  market_share_pct: number
  rebid_frequency_day: number
  strategic_withholding_score: number
}

export interface SpotMarketDepthDashboard {
  timestamp: string
  bid_stacks: SMDBidStackRecord[]
  order_flows: SMDOrderFlowRecord[]
  depth_snapshots: SMDMarketDepthSnapshot[]
  participant_flows: SMDParticipantFlowRecord[]
}

export const getSpotMarketDepthDashboard = (): Promise<SpotMarketDepthDashboard> =>
  get<SpotMarketDepthDashboard>('/api/spot-depth/dashboard')

// ---------------------------------------------------------------------------
// Sprint 55c — Energy Storage Technology Roadmap
// ---------------------------------------------------------------------------

export interface STRTechnologyRecord {
  tech_id: string
  name: string
  maturity: 'COMMERCIAL' | 'PILOT' | 'DEMO' | 'RESEARCH'
  duration_range_hr: string
  current_lcos_aud_mwh: number
  target_lcos_2030_aud_mwh: number
  cycle_life_k_cycles: number
  energy_density_kwh_m3: number
  calendar_life_years: number
  australia_installed_mwh: number
}

export interface STRCostTrajectoryRecord {
  technology: string
  year: number
  lcos_aud_mwh: number
  capex_aud_kwh: number
  energy_density_kwh_kg: number
  market_share_pct: number
}

export interface STRDeploymentMilestoneRecord {
  technology: string
  milestone: string
  target_year: number
  status: 'ACHIEVED' | 'ON_TRACK' | 'AT_RISK' | 'NOT_STARTED'
  responsible_org: string
  capacity_mwh: number
  notes: string
}

export interface STRMarketForecastRecord {
  year: number
  technology: string
  cumulative_deployed_gwh: number
  annual_additions_gwh: number
  cost_reduction_pct_from_2024: number
  addressable_market_pct: number
}

export interface StorageTechRoadmapDashboard {
  timestamp: string
  technologies: STRTechnologyRecord[]
  cost_trajectories: STRCostTrajectoryRecord[]
  milestones: STRDeploymentMilestoneRecord[]
  market_forecasts: STRMarketForecastRecord[]
}

export const getStorageTechRoadmapDashboard = (): Promise<StorageTechRoadmapDashboard> =>
  get<StorageTechRoadmapDashboard>('/api/storage-roadmap/dashboard')

// ---------------------------------------------------------------------------
// Sprint 55b — Renewable Integration Cost Analytics
// ---------------------------------------------------------------------------

export interface RICCostComponentRecord {
  year: number
  cost_component: 'NETWORK_AUGMENTATION' | 'FIRMING_CAPACITY' | 'FCAS_MARKETS' | 'CURTAILMENT_COST' | 'SYSTEM_RESTART' | 'INERTIA_SERVICES'
  cost_m_aud: number
  cost_aud_mwh_vre: number
  vre_penetration_pct: number
  notes: string
}

export interface RICNetworkAugRecord {
  project_name: string
  region: string
  investment_m_aud: number
  vre_enabled_mw: number
  cost_per_mw_k_aud: number
  commissioning_year: number
  benefit_cost_ratio: number
}

export interface RICCurtailmentRecord {
  year: number
  technology: string
  region: string
  curtailed_gwh: number
  curtailed_pct: number
  curtailment_cause: 'NETWORK_CONSTRAINT' | 'DEMAND_LOW' | 'OVERSUPPLY' | 'DISPATCH_ORDER'
  revenue_lost_m_aud: number
}

export interface RICSystemServiceRecord {
  service: 'INERTIA' | 'SYSTEM_RESTART' | 'VOLTAGE_CONTROL' | 'REACTIVE_POWER' | 'FAST_FREQUENCY_RESPONSE'
  annual_cost_m_aud: number
  providers: number
  cost_trend: 'RISING' | 'STABLE' | 'FALLING'
  vre_correlation: string
}

export interface RenewableIntegrationCostDashboard {
  timestamp: string
  cost_components: RICCostComponentRecord[]
  network_augs: RICNetworkAugRecord[]
  curtailment: RICCurtailmentRecord[]
  system_services: RICSystemServiceRecord[]
}

export const getRenewableIntegrationCostDashboard = (): Promise<RenewableIntegrationCostDashboard> =>
  get<RenewableIntegrationCostDashboard>('/api/integration-cost/dashboard')

// ---------------------------------------------------------------------------
// Sprint 56a — Generator Planned Outage & Maintenance Scheduling Analytics
// ---------------------------------------------------------------------------

export interface GPOPlannedOutageRecord {
  outage_id: string
  unit_id: string
  unit_name: string
  technology: string
  region: string
  capacity_mw: number
  start_date: string
  end_date: string
  duration_days: number
  outage_type: 'FULL' | 'PARTIAL' | 'DERATING'
  derated_capacity_mw: number
  reason: 'MAJOR_OVERHAUL' | 'MINOR_MAINTENANCE' | 'REGULATORY_INSPECTION' | 'FUEL_SYSTEM' | 'ENVIRONMENTAL_COMPLIANCE'
  submitted_by: string
}

export interface GPOReserveMarginRecord {
  week: string
  region: string
  available_capacity_mw: number
  maximum_demand_mw: number
  scheduled_outage_mw: number
  unplanned_outage_mw: number
  reserve_margin_pct: number
  reserve_status: 'ADEQUATE' | 'TIGHT' | 'CRITICAL'
}

export interface GPOOutageConflictRecord {
  conflict_id: string
  unit_a: string
  unit_b: string
  overlap_start: string
  overlap_end: string
  combined_capacity_mw: number
  region: string
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  aemo_intervention: boolean
}

export interface GPOMaintenanceKpiRecord {
  technology: string
  avg_planned_days_yr: number
  forced_outage_rate_pct: number
  planned_outage_rate_pct: number
  maintenance_cost_m_aud_mw_yr: number
  reliability_index: number
}

export interface PlannedOutageDashboard {
  timestamp: string
  outages: GPOPlannedOutageRecord[]
  reserve_margins: GPOReserveMarginRecord[]
  conflicts: GPOOutageConflictRecord[]
  kpis: GPOMaintenanceKpiRecord[]
}

export const getPlannedOutageDashboard = (): Promise<PlannedOutageDashboard> =>
  get<PlannedOutageDashboard>('/api/planned-outage/dashboard')

// ---------------------------------------------------------------------------
// Sprint 56c — NEM Participant Market Share & Concentration Tracker
// ---------------------------------------------------------------------------

export interface PMSParticipantRecord {
  participant_id:   string
  name:             string
  parent_company:   string
  region:           string
  portfolio_mw:     number
  renewable_mw:     number
  thermal_mw:       number
  storage_mw:       number
  market_share_pct: number
  hhi_contribution: number
  year:             number
}

export interface PMSConcentrationRecord {
  region:               string
  year:                 number
  hhi_score:            number
  cr3_pct:              number
  cr5_pct:              number
  dominant_participant: string
  competition_level:    'COMPETITIVE' | 'MODERATE' | 'CONCENTRATED' | 'HIGHLY_CONCENTRATED'
}

export interface PMSOwnershipChangeRecord {
  year:                    number
  acquirer:                string
  target:                  string
  assets_transferred:      string
  capacity_mw:             number
  transaction_value_m_aud: number
  regulatory_approval:     string
  impact_on_hhi:           number
}

export interface PMSRegionalShareRecord {
  participant:          string
  region:               string
  year:                 number
  generation_share_pct: number
  capacity_share_pct:   number
  peak_share_pct:       number
  rebid_events:         number
}

export interface MarketShareDashboard {
  timestamp:        string
  participants:     PMSParticipantRecord[]
  concentration:    PMSConcentrationRecord[]
  ownership_changes: PMSOwnershipChangeRecord[]
  regional_shares:  PMSRegionalShareRecord[]
}

export const getMarketShareDashboard = (): Promise<MarketShareDashboard> =>
  get<MarketShareDashboard>('/api/participant-market-share/dashboard')

// ---------------------------------------------------------------------------
// Sprint 56b — Wholesale Price Volatility Regime Analytics
// ---------------------------------------------------------------------------

export interface VRARegimeRecord {
  month: string
  region: string
  regime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME'
  avg_price_aud_mwh: number
  price_std_aud: number
  spike_count: number
  negative_price_hours: number
  volatility_index: number
  regime_duration_days: number
}

export interface VRAVolatilityClusterRecord {
  cluster_id: string
  region: string
  start_date: string
  end_date: string
  duration_days: number
  trigger: 'HEATWAVE' | 'GAS_SHORTAGE' | 'LOW_WIND' | 'GENERATOR_OUTAGE' | 'INTERCONNECTOR_FAILURE' | 'MARKET_POWER'
  max_price: number
  avg_price: number
  total_cost_impact_m_aud: number
}

export interface VRAHedgingImplicationRecord {
  regime: string
  recommended_hedge_ratio_pct: number
  cap_strike_optimal_aud: number
  swap_volume_twh_yr: number
  var_95_m_aud: number
  cost_of_hedging_m_aud_twh: number
}

export interface VRARegimeTransitionRecord {
  from_regime: string
  to_regime: string
  transition_count: number
  avg_duration_before_transition_days: number
  probability_pct: number
  typical_trigger: string
}

export interface VolatilityRegimeDashboard {
  timestamp: string
  regimes: VRARegimeRecord[]
  clusters: VRAVolatilityClusterRecord[]
  hedging: VRAHedgingImplicationRecord[]
  transitions: VRARegimeTransitionRecord[]
}

export const getVolatilityRegimeDashboard = (): Promise<VolatilityRegimeDashboard> =>
  get<VolatilityRegimeDashboard>('/api/volatility-regime/dashboard')

// ---------------------------------------------------------------------------
// Sprint 57b — Power System Black Start & System Restart Analytics
// ---------------------------------------------------------------------------

export interface BSARestartZoneRecord {
  zone_id: string
  region: string
  anchor_units: string[]
  total_black_start_mw: number
  cranking_path: string
  estimated_restore_hours: number
  zone_load_mw: number
  adequacy_status: 'ADEQUATE' | 'MARGINAL' | 'INADEQUATE'
  last_tested_date: string
}

export interface BSABlackStartUnitRecord {
  unit_id: string
  unit_name: string
  technology: string
  region: string
  black_start_capability: 'FULL' | 'PARTIAL' | 'NONE'
  cranking_power_mw: number
  self_excitation: boolean
  contract_type: 'MARKET' | 'CONTRACTED' | 'MANDATORY'
  contract_value_m_aud_yr: number
  test_compliance: string
}

export interface BSASystemStrengthRecord {
  region: string
  fault_level_mva: number
  minimum_fault_level_mva: number
  system_strength_status: 'ADEQUATE' | 'MARGINAL' | 'INADEQUATE'
  synchronous_generation_mw: number
  inverter_based_resources_pct: number
  strength_providers: string[]
}

export interface BSARestoreProgressRecord {
  scenario: string
  hour: number
  restored_load_mw: number
  restored_load_pct: number
  active_zones: number
  generation_online_mw: number
  milestone: string
}

export interface BlackStartDashboard {
  timestamp: string
  restart_zones: BSARestartZoneRecord[]
  black_start_units: BSABlackStartUnitRecord[]
  system_strength: BSASystemStrengthRecord[]
  restore_progress: BSARestoreProgressRecord[]
}

export const getBlackStartDashboard = (): Promise<BlackStartDashboard> =>
  get<BlackStartDashboard>('/api/black-start/dashboard')

// ---------------------------------------------------------------------------
// Sprint 57a — FCAS & Ancillary Services Cost Allocation Analytics
// ---------------------------------------------------------------------------

export type ASCServiceType =
  | 'RAISE_6SEC'
  | 'RAISE_60SEC'
  | 'RAISE_5MIN'
  | 'LOWER_6SEC'
  | 'LOWER_60SEC'
  | 'LOWER_5MIN'
  | 'RAISE_REG'
  | 'LOWER_REG'

export type ASCAllocationMechanism = 'CAUSER_PAYS' | 'PRO_RATA'

export type ASCCauseType =
  | 'LOAD_VARIATION'
  | 'GENERATION_VARIATION'
  | 'INTERCONNECTOR'
  | 'MARKET_NOTICE'

export interface ASCServiceRecord {
  service:               ASCServiceType
  month:                 string
  clearing_price_aud_mw: number
  volume_mw:             number
  total_cost_m_aud:      number
  num_providers:         number
  herfindahl_index:      number
}

export interface ASCProviderRecord {
  participant:             string
  service:                 string
  enabled_mw:              number
  revenue_m_aud:           number
  market_share_pct:        number
  avg_enablement_rate_pct: number
  technology:              string
}

export interface ASCCostAllocationRecord {
  region:                  string
  month:                   string
  total_fcas_cost_m_aud:   number
  energy_market_share_pct: number
  allocated_cost_m_aud:    number
  cost_per_mwh_aud:        number
  allocation_mechanism:    ASCAllocationMechanism
}

export interface ASCCauserPaysRecord {
  participant:             string
  service:                 string
  causer_pays_factor:      number
  cost_contribution_m_aud: number
  cause_type:              ASCCauseType
  month:                   string
}

export interface AncillaryCostDashboard {
  timestamp:        string
  services:         ASCServiceRecord[]
  providers:        ASCProviderRecord[]
  cost_allocations: ASCCostAllocationRecord[]
  causer_pays:      ASCCauserPaysRecord[]
}

export const getAncillaryCostDashboard = (): Promise<AncillaryCostDashboard> =>
  get<AncillaryCostDashboard>('/api/ancillary-cost/dashboard')

// ---------------------------------------------------------------------------
// Sprint 57c — CBAM & Australian Export Trade Analytics
// ---------------------------------------------------------------------------

export interface CBAExportSectorRecord {
  sector: string
  export_value_bn_aud: number
  carbon_intensity_tco2_per_tonne: number
  cbam_exposure_m_aud: number
  clean_alternative_available: boolean
  transition_timeline_years: number
  australian_competitive_advantage: string
}

export interface CBATradeFlowRecord {
  trading_partner: string
  sector: string
  export_volume_kt: number
  embedded_carbon_kt_co2: number
  cbam_tariff_rate_pct: number
  cbam_cost_m_aud: number
  year: number
}

export interface CBACleanExportRecord {
  product: string
  production_cost_aud_tonne: number
  target_price_aud_tonne: number
  market_size_bn_aud: number
  competitiveness_rank: number
  key_markets: string[]
  target_2030_kt: number
}

export interface CBAPolicyRecord {
  country: string
  policy_name: string
  implementation_year: number
  carbon_price_aud_tonne: number
  sectors_covered: string[]
  australia_exposure_m_aud: number
  policy_status: 'ENACTED' | 'PROPOSED' | 'UNDER_REVIEW'
}

export interface CbamTradeDashboard {
  timestamp: string
  export_sectors: CBAExportSectorRecord[]
  trade_flows: CBATradeFlowRecord[]
  clean_exports: CBACleanExportRecord[]
  policies: CBAPolicyRecord[]
}

export const getCbamTradeDashboard = (): Promise<CbamTradeDashboard> =>
  get<CbamTradeDashboard>('/api/cbam-trade/dashboard')

// ---------------------------------------------------------------------------
// Sprint 58a — Network Congestion Revenue & SRA Analytics
// ---------------------------------------------------------------------------

export interface NCRSraContractRecord {
  contract_id:              string
  quarter:                  string
  interconnector:           string
  direction:                'FORWARD' | 'REVERSE'
  mw_contracted:            number
  clearing_price_aud_mwh:   number
  total_value_m_aud:        number
  holder:                   string
  utilisation_pct:          number
}

export interface NCRCongestionRentRecord {
  quarter:               string
  interconnector:        string
  total_rent_m_aud:      number
  sra_allocated_m_aud:   number
  retained_m_aud:        number
  beneficiary:           string
  binding_hours_pct:     number
  avg_price_diff_aud:    number
}

export interface NCRNodalPriceRecord {
  node_id:                  string
  node_name:                string
  region:                   string
  avg_lmp_aud_mwh:          number
  congestion_component_aud: number
  loss_component_aud:       number
  energy_component_aud:     number
  price_premium_pct:        number
}

export interface NCRInterconnectorEconomicsRecord {
  interconnector:          string
  year:                    number
  total_flows_gwh:         number
  revenue_generated_m_aud: number
  cost_allocated_m_aud:    number
  net_benefit_m_aud:       number
  benefit_cost_ratio:      number
  capacity_factor_pct:     number
}

export interface CongestionRevenueDashboard {
  timestamp:                  string
  sra_contracts:              NCRSraContractRecord[]
  congestion_rents:           NCRCongestionRentRecord[]
  nodal_prices:               NCRNodalPriceRecord[]
  interconnector_economics:   NCRInterconnectorEconomicsRecord[]
}

export const getCongestionRevenueDashboard = (): Promise<CongestionRevenueDashboard> =>
  get<CongestionRevenueDashboard>('/api/congestion-revenue/dashboard')

// ── Sprint 58b: Climate Physical Risk to Grid Assets ─────────────────────────

export interface CPRAssetRecord {
  asset_id: string
  asset_name: string
  asset_type: string
  region: string
  value_m_aud: number
  exposure_score: number
  vulnerability_score: number
  risk_score: number
  primary_hazard: string
  adaptation_status: string
}

export interface CPRHazardProjectionRecord {
  hazard: string
  region: string
  scenario: string
  year_2030_change_pct: number
  year_2050_change_pct: number
  year_2070_change_pct: number
  frequency_multiplier: number
  confidence_level: string
}

export interface CPRClimateEventRecord {
  event_id: string
  event_type: string
  date: string
  region: string
  assets_affected: number
  damage_m_aud: number
  outage_hours: number
  customers_affected_k: number
  recovery_cost_m_aud: number
}

export interface CPRAdaptationMeasureRecord {
  measure: string
  asset_type: string
  cost_m_aud: number
  risk_reduction_pct: number
  implementation_years: number
  benefit_cost_ratio: number
  priority: string
}

export interface ClimatePhysicalRiskDashboard {
  timestamp: string
  assets: CPRAssetRecord[]
  hazard_projections: CPRHazardProjectionRecord[]
  climate_events: CPRClimateEventRecord[]
  adaptation_measures: CPRAdaptationMeasureRecord[]
}

export const getClimatePhysicalRiskDashboard = (): Promise<ClimatePhysicalRiskDashboard> =>
  get<ClimatePhysicalRiskDashboard>('/api/climate-risk/physical-dashboard')

// ---------------------------------------------------------------------------
// Sprint 58c — Energy Affordability & Household Bill Analytics
// ---------------------------------------------------------------------------

export interface EAHBillTrendRecord {
  state: string
  year: number
  avg_annual_bill_aud: number
  median_income_pct: number
  usage_kwh: number
  network_charges_aud: number
  wholesale_charges_aud: number
  environmental_charges_aud: number
  retail_margin_aud: number
}

export interface EAHIncomeAffordabilityRecord {
  state: string
  income_cohort: 'BOTTOM_20PCT' | 'LOWER_MIDDLE' | 'MIDDLE' | 'UPPER_MIDDLE' | 'TOP_20PCT'
  annual_income_aud: number
  energy_spend_aud: number
  energy_burden_pct: number
  solar_ownership_pct: number
  hardship_rate_pct: number
}

export interface EAHSolarImpactRecord {
  state: string
  household_type: 'NO_SOLAR' | 'SOLAR_ONLY' | 'SOLAR_BATTERY' | 'VPP_PARTICIPANT'
  avg_annual_bill_aud: number
  avg_annual_export_aud: number
  net_energy_cost_aud: number
  payback_years: number
  adoption_pct: number
}

export interface EAHAssistanceProgramRecord {
  program_name: string
  state: string
  eligible_cohort: string
  rebate_aud: number
  recipients_k: number
  total_cost_m_aud: number
  effectiveness_score: number
  program_type: 'REBATE' | 'CONCESSION' | 'PAYMENT_PLAN' | 'FREE_APPLIANCE'
}

export interface EnergyAffordabilityDashboard {
  timestamp: string
  bill_trends: EAHBillTrendRecord[]
  income_affordability: EAHIncomeAffordabilityRecord[]
  solar_impact: EAHSolarImpactRecord[]
  assistance_programs: EAHAssistanceProgramRecord[]
}

export const getEnergyAffordabilityDashboard = (): Promise<EnergyAffordabilityDashboard> =>
  get<EnergyAffordabilityDashboard>('/api/energy-affordability/dashboard')

// ---------------------------------------------------------------------------
// Sprint 59b — Long Duration Energy Storage (LDES) Economics
// ---------------------------------------------------------------------------

export interface LDETechnologyRecord {
  tech_id: string
  name: string
  duration_range_hr: string
  current_lcos_aud_mwh: number
  target_lcos_2035_aud_mwh: number
  technology_readiness_level: number
  capex_aud_kwh: number
  round_trip_efficiency_pct: number
  self_discharge_rate_pct_day: number
  project_lifetime_years: number
  australian_projects: number
}

export interface LDEEconomicCaseRecord {
  scenario: 'HIGH_VRE_90' | 'HIGH_VRE_75' | 'MEDIUM_VRE_60'
  duration_optimal_hr: number
  storage_required_gwh: number
  ldes_capacity_gw: number
  avoided_curtailment_gwh: number
  system_cost_saving_m_aud: number
  optimal_technology: string
  breakeven_lcos_aud_mwh: number
}

export interface LDEProjectRecord {
  project_name: string
  technology: string
  region: string
  capacity_gwh: number
  power_mw: number
  status: 'OPERATING' | 'CONSTRUCTION' | 'APPROVED' | 'PROPOSED'
  proponent: string
  capex_m_aud: number
  expected_cod: number
  energy_to_power_ratio: number
}

export interface LDESeasonalRecord {
  month: string
  vre_surplus_gwh: number
  vre_deficit_gwh: number
  optimal_charge_gwh: number
  optimal_discharge_gwh: number
  storage_utilisation_pct: number
  price_arbitrage_aud_mwh: number
}

export interface LdesEconomicsDashboard {
  timestamp: string
  technologies: LDETechnologyRecord[]
  economic_cases: LDEEconomicCaseRecord[]
  projects: LDEProjectRecord[]
  seasonal_patterns: LDESeasonalRecord[]
}

export const getLdesEconomicsDashboard = (): Promise<LdesEconomicsDashboard> =>
  get<LdesEconomicsDashboard>('/api/ldes-economics/dashboard')

// ── Sprint 59c: Australian Electricity Export Infrastructure ─────────────────

export interface EEICableProjectRecord {
  project_id: string
  name: string
  route: string
  capacity_gw: number
  length_km: number
  capex_bn_aud: number
  technology: 'HVDC' | 'HVAC'
  status: 'OPERATING' | 'CONSTRUCTION' | 'APPROVED' | 'PROPOSED' | 'CANCELLED'
  proponent: string
  expected_cod: number
  energy_export_twh_yr: number
}

export interface EEIRenewableZoneRecord {
  zone_id: string
  zone_name: string
  state: string
  primary_resource: 'SOLAR' | 'WIND' | 'HYBRID'
  potential_gw: number
  committed_gw: number
  export_oriented: boolean
  nearest_port_km: number
  land_area_km2: number
  estimated_lcoe_aud_mwh: number
  grid_connection_cost_bn_aud: number
}

export interface EEIExportMarketRecord {
  destination_country: string
  import_potential_twh_yr: number
  current_imports_twh_yr: number
  preferred_form: 'ELECTRICITY' | 'GREEN_H2' | 'GREEN_AMMONIA' | 'LNG_CCS'
  carbon_price_usd_tonne: number
  agreement_status: 'SIGNED' | 'NEGOTIATING' | 'MOU' | 'NONE'
  bilateral_trade_bn_aud: number
}

export interface EEIEconomicProjectionRecord {
  scenario: string
  year: number
  export_revenue_bn_aud: number
  jobs_created_k: number
  investment_attracted_bn_aud: number
  renewable_capacity_gw: number
  co2_abated_mt: number
}

export interface ElectricityExportDashboard {
  timestamp: string
  cable_projects: EEICableProjectRecord[]
  renewable_zones: EEIRenewableZoneRecord[]
  export_markets: EEIExportMarketRecord[]
  economic_projections: EEIEconomicProjectionRecord[]
}

export const getElectricityExportDashboard = (): Promise<ElectricityExportDashboard> =>
  get<ElectricityExportDashboard>('/api/electricity-export/dashboard')

// ---------------------------------------------------------------------------
// Sprint 59a — Building Electrification & Heat Pump Analytics
// ---------------------------------------------------------------------------

export interface BEAAdoptionRecord {
  state: string
  year: number
  appliance_type: 'HEAT_PUMP_HVAC' | 'HEAT_PUMP_WATER' | 'INDUCTION_COOKTOP' | 'EV_CHARGER' | 'ALL_ELECTRIC_HOME'
  total_units_k: number
  annual_additions_k: number
  market_penetration_pct: number
  avg_install_cost_aud: number
  payback_years: number
}

export interface BEALoadImpactRecord {
  state: string
  year: number
  additional_peak_mw: number
  additional_annual_gwh: number
  gas_displaced_pj: number
  co2_reduction_kt: number
  grid_augmentation_cost_m_aud: number
  flexibility_potential_mw: number
}

export interface BEAGasNetworkRecord {
  network_name: string
  state: string
  residential_connections_k: number
  annual_consumption_pj: number
  electrification_risk_pct: number
  asset_value_m_aud: number
  stranded_asset_risk_m_aud: number
  regulatory_status: 'ALLOWED' | 'UNDER_REVIEW' | 'RESTRICTED' | 'BANNED'
}

export interface BEAProgramRecord {
  program_name: string
  state: string
  program_type: 'REBATE' | 'LOAN' | 'VPP_INCENTIVE' | 'BULK_PURCHASE'
  annual_budget_m_aud: number
  appliances_supported: string
  rebate_amount_aud: number
  uptake_rate_pct: number
  co2_abatement_cost_aud_tonne: number
}

export interface ElectrificationDashboard {
  timestamp: string
  adoption: BEAAdoptionRecord[]
  load_impacts: BEALoadImpactRecord[]
  gas_networks: BEAGasNetworkRecord[]
  programs: BEAProgramRecord[]
}

export const getElectrificationDashboard = (): Promise<ElectrificationDashboard> =>
  get<ElectrificationDashboard>('/api/electrification/dashboard')

// ---------------------------------------------------------------------------
// Sprint 60a — Gas-Fired Generation Transition Analytics
// ---------------------------------------------------------------------------

export interface GFTGeneratorRecord {
  unit_id: string
  unit_name: string
  technology: 'OCGT' | 'CCGT' | 'RECIP' | 'STEAM'
  region: string
  capacity_mw: number
  commissioning_year: number
  h2_capable: boolean
  h2_ready_year: number | null
  gas_contract_expiry: number
  srmc_aud_mwh: number
  capacity_factor_pct: number
  exit_year: number | null
  exit_trigger: 'ECONOMICS' | 'FUEL' | 'POLICY' | 'AGE' | null
}

export interface GFTGasSupplyRecord {
  basin: string
  region: string
  reserves_pj: number
  production_pj_yr: number
  reserve_life_years: number
  domestic_reservation_pct: number
  price_aud_gj: number
  price_trend: 'RISING' | 'STABLE' | 'FALLING'
  pipeline_connected: boolean
}

export interface GFTHydrogenBlendRecord {
  unit_id: string
  blend_pct_2025: number
  blend_pct_2030: number
  blend_pct_2035: number
  conversion_cost_m_aud: number
  operational_risk: string
  derating_pct: number
}

export interface GFTCapacityOutlookRecord {
  year: number
  ocgt_mw: number
  ccgt_mw: number
  h2_turbine_mw: number
  total_gas_mw: number
  retirements_mw: number
  gas_generation_twh: number
  role_in_nem: string
}

export interface GasTransitionDashboard {
  timestamp: string
  generators: GFTGeneratorRecord[]
  gas_supply: GFTGasSupplyRecord[]
  hydrogen_blending: GFTHydrogenBlendRecord[]
  capacity_outlook: GFTCapacityOutlookRecord[]
}

export const getGasTransitionDashboard = (): Promise<GasTransitionDashboard> =>
  get<GasTransitionDashboard>('/api/gas-transition/dashboard')

// ---------------------------------------------------------------------------
// Sprint 60c — Prosumer & Behind-the-Meter (BTM) Analytics
// ---------------------------------------------------------------------------

export interface BTMInstallationRecord {
  state: string
  year: number
  rooftop_solar_systems_k: number
  rooftop_solar_mw: number
  btm_battery_systems_k: number
  btm_battery_mwh: number
  avg_system_size_kw: number
  avg_battery_size_kwh: number
  export_capable_pct: number
  smart_meter_pct: number
}

export interface BTMNetLoadRecord {
  state: string
  month: string
  gross_demand_gwh: number
  btm_solar_generation_gwh: number
  btm_battery_discharge_gwh: number
  net_demand_gwh: number
  min_net_demand_mw: number
  duck_curve_depth_mw: number
  evening_ramp_mw_hr: number
}

export interface BTMExportRecord {
  state: string
  year: number
  total_exports_gwh: number
  fit_payments_m_aud: number
  avg_fit_rate_aud_kwh: number
  export_curtailment_gwh: number
  curtailment_pct: number
  grid_constraint_triggered: boolean
}

export interface BTMVppRecord {
  vpp_name: string
  state: string
  enrolled_customers_k: number
  total_battery_mwh: number
  peak_dispatch_mw: number
  annual_events: number
  avg_event_duration_hr: number
  revenue_per_customer_aud: number
  operator: string
}

export interface ProsumerDashboard {
  timestamp: string
  installations: BTMInstallationRecord[]
  net_load: BTMNetLoadRecord[]
  exports: BTMExportRecord[]
  vpps: BTMVppRecord[]
}

export const getProsumerDashboard = (): Promise<ProsumerDashboard> =>
  get<ProsumerDashboard>('/api/prosumer/dashboard')

// ── Sprint 60b: TNSP Revenue & Investment Analytics ──────────────────────────

export interface TNATnspRecord {
  tnsp_id: string
  tnsp_name: string
  state: string
  regulated_asset_base_bn_aud: number
  revenue_determination_bn_aud: number
  determination_period: string
  capex_m_aud_yr: number
  opex_m_aud_yr: number
  network_length_km: number
  substations: number
  wacc_real_pct: number
}

export interface TNAReliabilityRecord {
  tnsp: string
  year: number
  system_minutes_lost: number
  circuit_outages: number
  unplanned_outage_rate_pct: number
  saidi_minutes: number
  transmission_constraint_hours: number
  asset_age_avg_years: number
}

export interface TNAProjectRecord {
  project_name: string
  tnsp: string
  project_type: string
  investment_m_aud: number
  commissioning_year: number
  status: string
  primary_driver: string
  vre_enabled_mw: number
}

export interface TNARegulatoryRecord {
  tnsp: string
  regulatory_period: string
  allowed_revenue_m_aud: number
  actual_revenue_m_aud: number
  efficiency_carryover_m_aud: number
  cpi_escalator_pct: number
  aer_decision: string
}

export interface TnspAnalyticsDashboard {
  timestamp: string
  tnsps: TNATnspRecord[]
  reliability: TNAReliabilityRecord[]
  projects: TNAProjectRecord[]
  regulatory: TNARegulatoryRecord[]
}

export const getTnspAnalyticsDashboard = (): Promise<TnspAnalyticsDashboard> =>
  get<TnspAnalyticsDashboard>('/api/tnsp-analytics/dashboard')

// ── Sprint 61a: NEM Reliability Standard & USE Analytics ─────────────────────

export interface RSAUseRecord {
  year: number
  region: string
  unserved_energy_mwh: number
  use_pct: number
  standard_pct: number
  compliance: string
  events: number
  max_event_duration_hr: number
  economic_cost_m_aud: number
}

export interface RSAReserveMarginRecord {
  year: number
  region: string
  peak_demand_mw: number
  available_capacity_mw: number
  reserve_margin_pct: number
  required_reserve_pct: number
  surplus_deficit_mw: number
  probability_of_exceeding_standard_pct: number
}

export interface RSAReliabilityEventRecord {
  event_id: string
  date: string
  region: string
  duration_hr: number
  customers_affected_k: number
  use_mwh: number
  cause: string
  nem_intervention: boolean
  estimated_cost_m_aud: number
}

export interface RSADemandSideRecord {
  mechanism: string
  region: string
  registered_mw: number
  activated_mw: number
  activation_events_yr: number
  cost_m_aud_yr: number
  cost_aud_mwh: number
  reliability_contribution_pct: number
}

export interface ReliabilityStandardDashboard {
  timestamp: string
  use_records: RSAUseRecord[]
  reserve_margins: RSAReserveMarginRecord[]
  events: RSAReliabilityEventRecord[]
  demand_side: RSADemandSideRecord[]
}

export const getReliabilityStandardDashboard = (): Promise<ReliabilityStandardDashboard> =>
  get<ReliabilityStandardDashboard>('/api/reliability-standard/dashboard')

// ── Sprint 61c: Battery Storage Revenue Stacking Optimisation ───────────────

export interface BSOServiceAllocationRecord {
  bess_id: string
  bess_name: string
  region: string
  capacity_mw: number
  duration_hr: number
  energy_arbitrage_pct: number
  raise_fcas_pct: number
  lower_fcas_pct: number
  capacity_market_pct: number
  demand_response_pct: number
  idle_pct: number
  total_revenue_m_aud: number
  revenue_per_mw_k_aud: number
}

export interface BSOPriceCorrelationRecord {
  month: string
  region: string
  energy_price_aud_mwh: number
  raise_reg_price: number
  lower_reg_price: number
  raise_6sec_price: number
  optimal_service: string
  arbitrage_spread_aud: number
}

export interface BSOOptimisationResultRecord {
  scenario: string
  capacity_mw: number
  duration_hr: number
  annual_revenue_m_aud: number
  irr_pct: number
  payback_years: number
  capex_m_aud: number
  lcoe_aud_mwh: number
}

export interface BSODegradationRecord {
  bess_id: string
  year: number
  capacity_retention_pct: number
  calendar_degradation_pct: number
  cycle_degradation_pct: number
  annual_cycles: number
  revenue_impact_m_aud: number
  replacement_schedule: string
}

export interface StorageOptimisationDashboard {
  timestamp: string
  service_allocations: BSOServiceAllocationRecord[]
  price_correlations: BSOPriceCorrelationRecord[]
  optimisation_results: BSOOptimisationResultRecord[]
  degradation: BSODegradationRecord[]
}

export const getStorageOptimisationDashboard = (): Promise<StorageOptimisationDashboard> =>
  get<StorageOptimisationDashboard>('/api/storage-optimisation/dashboard')

// ---------------------------------------------------------------------------
// Sprint 61b — DNSP Performance & Investment Analytics
// ---------------------------------------------------------------------------

export interface DPADnspRecord {
  dnsp_id: string
  dnsp_name: string
  state: string
  regulated_asset_base_bn_aud: number
  customers_k: number
  network_length_km: number
  substations: number
  annual_capex_m_aud: number
  annual_opex_m_aud: number
  wacc_pct: number
  determination_period: string
}

export interface DPAReliabilityRecord {
  dnsp: string
  year: number
  saidi_minutes: number
  saifi_interruptions: number
  caidi_minutes: number
  momentary_interruptions: number
  planned_outage_saidi: number
  unplanned_outage_saidi: number
  worst_served_customers_pct: number
}

export interface DPADerHostingRecord {
  dnsp: string
  feeder_type: string
  hosting_capacity_mw: number
  connected_der_mw: number
  utilisation_pct: number
  constraint_type: string
  upgrade_cost_m_aud: number
}

export interface DPAInvestmentRecord {
  dnsp: string
  project_category: string
  investment_m_aud: number
  year: number
  rab_addition_m_aud: number
  customers_benefited_k: number
}

export interface DnspAnalyticsDashboard61b {
  timestamp: string
  dnsps: DPADnspRecord[]
  reliability: DPAReliabilityRecord[]
  der_hosting: DPADerHostingRecord[]
  investments: DPAInvestmentRecord[]
}

export const getDnspAnalyticsDashboard = (): Promise<DnspAnalyticsDashboard61b> =>
  get<DnspAnalyticsDashboard61b>('/api/dnsp-analytics/dashboard')

// ── Sprint 62a — NEM 5-Minute Settlement & Prudential Analytics ─────────────

export interface WSASettlementRecord {
  week: string
  region: string
  total_energy_value_m_aud: number
  avg_settlement_price_aud: number
  peak_interval_price_aud: number
  settlement_variance_m_aud: number
  positive_residue_m_aud: number
  negative_residue_m_aud: number
}

export interface WSAPrudentialRecord {
  participant: string
  credit_support_m_aud: number
  maximum_credit_limit_m_aud: number
  utilisation_pct: number
  collateral_type: string
  credit_rating: string
  compliance_status: string
}

export interface WSAShortfallRecord {
  event_id: string
  date: string
  participant: string
  shortfall_m_aud: number
  shortfall_type: string
  resolution_days: number
  financial_security_drawn: boolean
  aemo_action: string
}

export interface WSAParticipantExposureRecord {
  participant: string
  week: string
  gross_energy_purchase_m_aud: number
  gross_energy_sale_m_aud: number
  net_position_m_aud: number
  exposure_utilisation_pct: number
  region: string
}

export interface SettlementAnalyticsDashboard62a {
  timestamp: string
  settlements: WSASettlementRecord[]
  prudential: WSAPrudentialRecord[]
  shortfalls: WSAShortfallRecord[]
  exposures: WSAParticipantExposureRecord[]
}

export const getSettlementAnalyticsDashboard = (): Promise<SettlementAnalyticsDashboard62a> =>
  get<SettlementAnalyticsDashboard62a>('/api/settlement-analytics/dashboard')

// ---------------------------------------------------------------------------
// Sprint 62c — NEM Real-Time Operational Overview Dashboard
// ---------------------------------------------------------------------------

export interface RTORegionSnapshot {
  region: string
  timestamp: string
  total_demand_mw: number
  generation_mw: number
  rooftop_solar_mw: number
  net_interchange_mw: number
  spot_price_aud_mwh: number
  frequency_hz: number
  reserve_mw: number
  generation_mix: Record<string, number>
}

export interface RTOInterconnectorFlow {
  interconnector: string
  from_region: string
  to_region: string
  flow_mw: number
  capacity_mw: number
  utilisation_pct: number
  binding: boolean
  marginal_loss: number
}

export interface RTOFcasSnapshot {
  service: string
  cleared_mw: number
  clearing_price_aud_mw: number
  requirement_mw: number
  surplus_pct: number
}

export interface RTOSystemAlert {
  alert_id: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  category: 'PRICE' | 'FREQUENCY' | 'RESERVE' | 'CONSTRAINT' | 'MARKET'
  message: string
  region: string
  timestamp: string
  acknowledged: boolean
}

export interface RealtimeOpsDashboard {
  timestamp: string
  regions: RTORegionSnapshot[]
  interconnectors: RTOInterconnectorFlow[]
  fcas: RTOFcasSnapshot[]
  alerts: RTOSystemAlert[]
}

export const getRealtimeOpsDashboard = (): Promise<RealtimeOpsDashboard> =>
  get<RealtimeOpsDashboard>('/api/realtime-ops/dashboard')

// ── Sprint 62b: Renewable Auction Results & CfD Analytics ─────────────────

export interface RAAAuctionResultRecord {
  auction_id: string
  auction_name: string
  state: string
  year: number
  technology: 'WIND_ONSHORE' | 'WIND_OFFSHORE' | 'UTILITY_SOLAR' | 'HYBRID' | 'STORAGE'
  capacity_mw: number
  strike_price_aud_mwh: number
  reference_price_aud_mwh: number
  cfd_term_years: number
  developer: string
  cod_year: number
  status: 'CONTRACTED' | 'UNDER_CONSTRUCTION' | 'COMMISSIONED' | 'TERMINATED'
}

export interface RAATechnologyTrendRecord {
  technology: string
  year: number
  auction_count: number
  avg_strike_price_aud_mwh: number
  min_strike_price_aud_mwh: number
  total_contracted_mw: number
  oversubscription_ratio: number
  cost_reduction_pct_from_2018: number
}

export interface RAAPerformanceRecord {
  project_name: string
  technology: string
  state: string
  contracted_capacity_mw: number
  actual_capacity_factor_pct: number
  bid_capacity_factor_pct: number
  annual_generation_twh: number
  cfd_payment_m_aud: number
  market_revenue_m_aud: number
}

export interface RAAStateComparisonRecord {
  state: string
  total_contracted_mw: number
  avg_strike_price_aud_mwh: number
  cheapest_technology: string
  auction_pipeline_mw: number
  policy_target_mw: number
  completion_pct: number
}

export interface RenewableAuctionDashboard {
  timestamp: string
  auction_results: RAAAuctionResultRecord[]
  technology_trends: RAATechnologyTrendRecord[]
  performance: RAAPerformanceRecord[]
  state_comparison: RAAStateComparisonRecord[]
}

export const getRenewableAuctionDashboard = (): Promise<RenewableAuctionDashboard> =>
  get<RenewableAuctionDashboard>('/api/renewable-auction/dashboard')

// ── Sprint 63a: VoLL Analytics ─────────────────────────────────────────────

export interface VCAVollRecord {
  year: number
  methodology: 'SURVEY' | 'REVEALED_PREFERENCE' | 'HYBRID'
  residential_voll_aud_mwh: number
  commercial_voll_aud_mwh: number
  industrial_voll_aud_mwh: number
  weighted_avg_voll_aud_mwh: number
  nem_regulatory_voll_aud_mwh: number
  review_body: string
}

export interface VCAOutageCostRecord {
  year: number
  region: string
  total_outage_hours: number
  customers_affected_k: number
  total_economic_cost_m_aud: number
  residential_cost_m_aud: number
  commercial_cost_m_aud: number
  industrial_cost_m_aud: number
  direct_cost_pct: number
  indirect_cost_pct: number
}

export interface VCAIndustrySectorRecord {
  sector: string
  avg_outage_cost_aud_hour: number
  outage_sensitivity: 'HIGH' | 'MEDIUM' | 'LOW'
  critical_threshold_min: number
  annual_exposure_m_aud: number
  backup_power_adoption_pct: number
}

export interface VCAReliabilityValueRecord {
  region: string
  current_saidi_min: number
  target_saidi_min: number
  improvement_cost_m_aud: number
  customers_benefited_k: number
  voll_saved_m_aud: number
  benefit_cost_ratio: number
}

export interface VollAnalyticsDashboard {
  timestamp: string
  voll_estimates: VCAVollRecord[]
  outage_costs: VCAOutageCostRecord[]
  industry_sectors: VCAIndustrySectorRecord[]
  reliability_values: VCAReliabilityValueRecord[]
}

export const getVollAnalyticsDashboard = (): Promise<VollAnalyticsDashboard> =>
  get<VollAnalyticsDashboard>('/api/voll-analytics/dashboard')

// ---- Sprint 63b: ASX Energy Futures Price Discovery & Term Structure Analytics ----

export interface FPDTermStructureRecord {
  region: string
  contract_month: string
  product: string
  settlement_price_aud_mwh: number
  open_interest_lots: number
  daily_volume_lots: number
  implied_vol_pct: number
  days_to_expiry: number
}

export interface FPDBasisRecord {
  region: string
  month: string
  futures_price: number
  spot_price: number
  basis_aud: number
  basis_pct: number
  convergence_trend: string
  seasonal_factor: string
}

export interface FPDCarryRecord {
  region: string
  near_contract: string
  far_contract: string
  carry_cost_aud: number
  storage_premium_aud: number
  risk_premium_aud: number
  convenience_yield_pct: number
}

export interface FPDCurveShapeRecord {
  region: string
  snapshot_date: string
  curve_shape: string
  q1_price: number
  q2_price: number
  q3_price: number
  q4_price: number
  annual_slope_pct: number
  inflection_quarter: string
}

export interface FuturesPriceDiscoveryDashboard {
  timestamp: string
  term_structures: FPDTermStructureRecord[]
  basis_records: FPDBasisRecord[]
  carry_records: FPDCarryRecord[]
  curve_shapes: FPDCurveShapeRecord[]
}

export const getFuturesPriceDiscoveryDashboard = (): Promise<FuturesPriceDiscoveryDashboard> =>
  get<FuturesPriceDiscoveryDashboard>('/api/futures-price-discovery/dashboard')

// ---------------------------------------------------------------------------
// Sprint 63c – Demand Flexibility & Industrial Load Management Analytics
// ---------------------------------------------------------------------------

export interface DFLConsumerRecord {
  consumer_id: string
  consumer_name: string
  industry: 'ALUMINIUM_SMELTER' | 'STEEL_EAF' | 'DATA_CENTRE' | 'WATER_UTILITY' | 'MINING' | 'CEMENT' | 'PAPER_PULP' | 'COLD_STORAGE'
  region: string
  peak_demand_mw: number
  flexible_mw: number
  flexibility_pct: number
  contract_type: 'INTERRUPTIBLE' | 'VOLUNTARY' | 'VPP_PARTICIPANT' | 'ANCILLARY_SERVICE'
  annual_revenue_m_aud: number
  response_time_min: number
}

export interface DFLEventRecord {
  event_id: string
  date: string
  trigger: 'HIGH_PRICE' | 'RESERVE_LOW' | 'FCAS_SHORTFALL' | 'OPERATOR_REQUEST'
  region: string
  total_curtailed_mw: number
  duration_hr: number
  participants: number
  price_during_event_aud: number
  cost_avoided_m_aud: number
  success_rate_pct: number
}

export interface DFLBenefitRecord {
  consumer_name: string
  annual_flexibility_revenue_m_aud: number
  energy_cost_saving_m_aud: number
  network_charge_saving_m_aud: number
  total_benefit_m_aud: number
  benefit_per_mw_k_aud: number
  co2_avoided_kt: number
}

export interface DFLTechnologyRecord {
  technology: 'AUTOMATED_DR' | 'MANUAL_DR' | 'SMART_INVERTER' | 'THERMAL_STORAGE' | 'PROCESS_SHIFT' | 'BACKUP_GENERATOR'
  adoption_pct: number
  avg_response_time_min: number
  typical_duration_hr: number
  cost_aud_per_kw: number
  reliability_score: number
}

export interface DemandFlexibilityDashboard {
  timestamp: string
  consumers: DFLConsumerRecord[]
  events: DFLEventRecord[]
  benefits: DFLBenefitRecord[]
  technologies: DFLTechnologyRecord[]
}

export const getDemandFlexibilityDashboard = (): Promise<DemandFlexibilityDashboard> =>
  get<DemandFlexibilityDashboard>('/api/demand-flexibility/dashboard')

// ---------------------------------------------------------------------------
// Sprint 64b — Interconnector Upgrade Business Case Analytics
// ---------------------------------------------------------------------------

export interface ICBProjectRecord {
  project_id: string
  project_name: string
  from_region: string
  to_region: string
  capacity_increase_mw: number
  capex_bn_aud: number
  opex_m_aud_yr: number
  commissioning_year: number
  status: 'OPERATING' | 'CONSTRUCTION' | 'APPROVED' | 'PROPOSED'
  aer_approved: boolean
  regulatory_test_outcome: 'PASS' | 'FAIL' | 'PENDING'
  bcr: number
  npv_bn_aud: number
}

export interface ICBBenefitRecord {
  project_id: string
  benefit_type: 'CONGESTION_RENT' | 'FUEL_COST_SAVING' | 'RELIABILITY' | 'RENEWABLE_FIRMING' | 'AVOIDED_INVESTMENT' | 'CONSUMER_SURPLUS'
  benefit_m_aud_yr: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  beneficiary_region: string
  quantification_method: string
}

export interface ICBScenarioRecord {
  project_id: string
  scenario: 'STEP_CHANGE' | 'CENTRAL' | 'SLOW_CHANGE'
  npv_bn_aud: number
  bcr: number
  consumer_benefit_bn_aud: number
  renewable_firming_mw: number
  breakeven_price_aud_mwh: number
}

export interface ICBFlowAnalysisRecord {
  project_id: string
  year: number
  annual_flow_twh: number
  peak_flow_mw: number
  avg_utilisation_pct: number
  congestion_hours_pct: number
  marginal_value_aud_mwh: number
}

export interface InterconnectorUpgradeDashboard {
  timestamp: string
  projects: ICBProjectRecord[]
  benefits: ICBBenefitRecord[]
  scenarios: ICBScenarioRecord[]
  flow_analysis: ICBFlowAnalysisRecord[]
}

export const getInterconnectorUpgradeDashboard = (): Promise<InterconnectorUpgradeDashboard> =>
  get<InterconnectorUpgradeDashboard>('/api/interconnector-upgrade/dashboard')

export interface EPICpiRecord {
  quarter: string
  electricity_cpi_index: number
  electricity_cpi_yoy_pct: number
  all_cpi_index: number
  all_cpi_yoy_pct: number
  electricity_vs_all_cpi_diff_pct: number
  state: string
  key_driver: string
}

export interface EPIDmoRecord {
  year: number
  state: string
  distribution_zone: string
  annual_usage_kwh: number
  dmo_price_aud: number
  dmo_change_pct: number
  market_offer_avg_aud: number
  market_offer_avg_change_pct: number
  best_market_offer_aud: number
  potential_saving_aud: number
}

export interface EPITariffComponentRecord {
  state: string
  year: number
  network_charges_aud_kwh: number
  wholesale_charges_aud_kwh: number
  environmental_charges_aud_kwh: number
  retail_margin_aud_kwh: number
  metering_aud_kwh: number
  total_tariff_aud_kwh: number
}

export interface EPIRetailerRecord {
  retailer: string
  state: string
  market_share_pct: number
  avg_offer_aud: number
  cheapest_offer_aud: number
  customer_satisfaction_score: number
  complaints_per_1000: number
  churn_rate_pct: number
}

export interface ElectricityPriceIndexDashboard {
  timestamp: string
  cpi_records: EPICpiRecord[]
  dmo_records: EPIDmoRecord[]
  tariff_components: EPITariffComponentRecord[]
  retailers: EPIRetailerRecord[]
}

export const getElectricityPriceIndexDashboard = (): Promise<ElectricityPriceIndexDashboard> =>
  get<ElectricityPriceIndexDashboard>('/api/electricity-price-index/dashboard')

export interface MLFConnectionPointRecord {
  connection_point: string
  generator_name: string
  technology: string
  region: string
  mlf_2024: number
  mlf_2023: number
  mlf_2022: number
  mlf_trend: 'IMPROVING' | 'DECLINING' | 'STABLE'
  revenue_impact_pct: number
  reason: string
}

export interface MLFRezRecord {
  rez_id: string
  rez_name: string
  region: string
  projected_mlf_2028: number
  current_mlf: number
  mlf_deterioration_pct: number
  connected_capacity_mw: number
  pipeline_capacity_mw: number
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
  aemo_mitigation: string
}

export interface MLFRevenueImpactRecord {
  generator_name: string
  technology: string
  capacity_mw: number
  annual_generation_gwh: number
  mlf_value: number
  spot_price_aud_mwh: number
  effective_price_aud_mwh: number
  revenue_loss_m_aud: number
  revenue_loss_pct: number
}

export interface MLFHistoricalRecord {
  year: number
  region: string
  avg_mlf: number
  min_mlf: number
  max_mlf: number
  generators_below_095: number
  total_generators: number
  avg_revenue_impact_pct: number
}

export interface MlfAnalyticsDashboard {
  timestamp: string
  connection_points: MLFConnectionPointRecord[]
  rez_mlfs: MLFRezRecord[]
  revenue_impacts: MLFRevenueImpactRecord[]
  historical: MLFHistoricalRecord[]
}

export const getMlfAnalyticsDashboard = (): Promise<MlfAnalyticsDashboard> =>
  get<MlfAnalyticsDashboard>('/api/mlf-analytics/dashboard')

// ---- Sprint 65a: CSP & Solar Thermal Analytics ----

export interface CSPTechnologyRecord {
  tech_id: string
  name: string
  peak_efficiency_pct: number
  annual_capacity_factor_pct: number
  storage_hours: number
  capex_m_aud_mw: number
  lcoe_aud_mwh: number
  water_use_l_mwh: number
  land_use_ha_mw: number
  trl: number
  dispatchability_score: number
}

export interface CSPProjectRecord {
  project_id: string
  project_name: string
  developer: string
  region: string
  technology: string
  capacity_mw: number
  storage_hours: number
  status: string
  capex_m_aud: number
  cod_year: number
  dni_kwh_m2_yr: number
  expected_lcoe_aud_mwh: number
}

export interface CSPResourceRecord {
  location: string
  state: string
  dni_kwh_m2_yr: number
  dni_class: string
  area_km2: number
  grid_distance_km: number
  proximity_to_existing_project: boolean
}

export interface CSPDispatchRecord {
  project_name: string
  month: string
  solar_mw: number
  storage_mw: number
  total_output_mw: number
  storage_utilisation_pct: number
  curtailment_mw: number
  firming_hours_provided: number
}

export interface CspAnalyticsDashboard {
  timestamp: string
  technologies: CSPTechnologyRecord[]
  projects: CSPProjectRecord[]
  resources: CSPResourceRecord[]
  dispatch_profiles: CSPDispatchRecord[]
}

export const getCspAnalyticsDashboard = (): Promise<CspAnalyticsDashboard> =>
  get<CspAnalyticsDashboard>('/api/csp-analytics/dashboard')

// ---------------------------------------------------------------------------
// Sprint 65b — Network Tariff Reform & DER Incentive Analytics
// ---------------------------------------------------------------------------
export interface NTRTariffStructureRecord {
  dnsp: string
  tariff_class: string
  tariff_type: string
  daily_supply_aud: number
  flat_rate_aud_kwh: number | null
  peak_rate_aud_kwh: number | null
  offpeak_rate_aud_kwh: number | null
  demand_rate_aud_kw_month: number | null
  solar_export_rate_aud_kwh: number | null
  customers_k: number
}

export interface NTRTariffImpactRecord {
  tariff_type: string
  customer_type: string
  annual_bill_before_aud: number
  annual_bill_after_aud: number
  bill_change_pct: number
  der_incentive_score: number
  peak_shift_mw_potential: number
}

export interface NTRDerIncentiveRecord {
  incentive_type: string
  dnsp: string
  incentive_value_aud: number
  eligible_customers_k: number
  uptake_rate_pct: number
  peak_reduction_mw: number
  annual_network_benefit_m_aud: number
}

export interface NTRReformOutcomeRecord {
  dnsp: string
  reform_name: string
  implementation_year: number
  customers_affected_k: number
  peak_demand_reduction_mw: number
  revenue_neutral: boolean
  consumer_avg_saving_aud: number
  aer_approved: boolean
}

export interface NTRDashboard {
  timestamp: string
  tariff_structures: NTRTariffStructureRecord[]
  tariff_impacts: NTRTariffImpactRecord[]
  der_incentives: NTRDerIncentiveRecord[]
  reform_outcomes: NTRReformOutcomeRecord[]
}

export const getNTRDashboard = (): Promise<NTRDashboard> =>
  get<NTRDashboard>('/api/tariff-reform/dashboard')

// ---------------------------------------------------------------------------
// Carbon Intensity Real-Time & Historical Analytics (Sprint 65c)
// ---------------------------------------------------------------------------

export interface CIRGridIntensityRecord {
  region: string
  year: number
  month: string
  avg_intensity_kgco2_mwh: number
  min_intensity_kgco2_mwh: number
  max_intensity_kgco2_mwh: number
  zero_carbon_hours_pct: number
  total_emissions_kt_co2: number
  vre_penetration_pct: number
}

export interface CIRMarginalEmissionRecord {
  region: string
  hour: number
  marginal_emission_factor_kgco2_mwh: number
  marginal_technology: string
  typical_price_aud_mwh: number
  flexibility_benefit_kg_co2_kwh: number
}

export interface CIRTechnologyEmissionRecord {
  technology: string
  lifecycle_kgco2_mwh: number
  operational_kgco2_mwh: number
  construction_kgco2_mwh: number
  fuel_kgco2_mwh: number
  category: string
}

export interface CIRDecarbonisationRecord {
  region: string
  year: number
  emissions_mt_co2: number
  intensity_kgco2_mwh: number
  vre_pct: number
  coal_pct: number
  gas_pct: number
  target_intensity_kgco2_mwh: number
  target_year: number
  on_track: boolean
}

export interface CarbonIntensityDashboard {
  timestamp: string
  grid_intensity: CIRGridIntensityRecord[]
  marginal_emissions: CIRMarginalEmissionRecord[]
  technology_emissions: CIRTechnologyEmissionRecord[]
  decarbonisation: CIRDecarbonisationRecord[]
}

export const getCarbonIntensityDashboard = (): Promise<CarbonIntensityDashboard> =>
  get<CarbonIntensityDashboard>('/api/carbon-intensity/dashboard')

// ---------------------------------------------------------------------------
// AEMO ESOO Generation Adequacy Analytics (Sprint 66b)
// ---------------------------------------------------------------------------

export interface EGAAdequacyRecord {
  year: number
  region: string
  peak_demand_mw: number
  available_capacity_mw: number
  capacity_gap_mw: number
  use_probability_pct: number
  capacity_shortage_risk: string
  new_investment_needed_mw: number
}

export interface EGAInvestmentPipelineRecord {
  project_name: string
  technology: string
  region: string
  capacity_mw: number
  expected_cod: number
  confidence: string
  investment_m_aud: number
  capacity_market_eligible: boolean
}

export interface EGARetirementRecord {
  unit_name: string
  technology: string
  region: string
  capacity_mw: number
  expected_retirement_year: number
  retirement_trigger: string
  replacement_committed: boolean
  reliability_impact: string
}

export interface EGAScenarioRecord {
  scenario: string
  year: number
  region: string
  total_capacity_gw: number
  vre_capacity_gw: number
  dispatchable_capacity_gw: number
  storage_gw: number
  adequacy_status: string
}

export interface EsooAdequacyDashboard {
  timestamp: string
  adequacy: EGAAdequacyRecord[]
  investment_pipeline: EGAInvestmentPipelineRecord[]
  retirements: EGARetirementRecord[]
  scenarios: EGAScenarioRecord[]
}

export const getEsooAdequacyDashboard = (): Promise<EsooAdequacyDashboard> =>
  get<EsooAdequacyDashboard>('/api/esoo-adequacy/dashboard')

// ── Sprint 66c: AI & Digital Twin Analytics ──────────────────────────────────

export type ADTDeploymentStatus = 'PRODUCTION' | 'PILOT' | 'RESEARCH' | 'PLANNED'
export type ADTTechnology = 'ML' | 'DL' | 'RL' | 'DIGITAL_TWIN' | 'OPTIMIZATION' | 'HYBRID'
export type ADTAssetType = 'TRANSMISSION_LINE' | 'SUBSTATION' | 'WIND_FARM' | 'SOLAR_FARM' | 'BATTERY' | 'THERMAL_PLANT'
export type ADTAutomationDomain = 'DISPATCH_OPTIMISATION' | 'BIDDING' | 'HEDGE_EXECUTION' | 'FCAS_OPTIMISATION' | 'FAULT_RESTORATION' | 'DEMAND_RESPONSE'
export type ADTInvestmentCategory = 'INFRASTRUCTURE' | 'ANALYTICS_PLATFORM' | 'AI_MODELS' | 'DIGITAL_TWINS' | 'CYBERSECURITY' | 'TRAINING'
export type ADTMaturityLevel = 'EARLY' | 'GROWING' | 'MATURE'

export interface ADTUseCaseRecord {
  use_case_id: string
  use_case: string
  deployment_status: ADTDeploymentStatus
  accuracy_improvement_pct: number
  cost_saving_m_aud_yr: number
  adoption_rate_industry_pct: number
  technology: ADTTechnology
  organisations_deployed: number
}

export interface ADTDigitalTwinRecord {
  asset_type: ADTAssetType
  operator: string
  coverage_pct: number
  predictive_accuracy_pct: number
  maintenance_saving_m_aud_yr: number
  outage_reduction_pct: number
  data_feeds_count: number
  implementation_cost_m_aud: number
}

export interface ADTAutomationRecord {
  domain: ADTAutomationDomain
  current_automation_pct: number
  target_2030_pct: number
  human_override_rate_pct: number
  error_rate_pct: number
  cost_reduction_m_aud_yr: number
  jobs_affected: number
}

export interface ADTInvestmentRecord {
  year: number
  category: ADTInvestmentCategory
  investment_m_aud: number
  organisations: number
  roi_pct: number
  maturity_level: ADTMaturityLevel
}

export interface AiDigitalTwinDashboard {
  timestamp: string
  use_cases: ADTUseCaseRecord[]
  digital_twins: ADTDigitalTwinRecord[]
  automation: ADTAutomationRecord[]
  investments: ADTInvestmentRecord[]
}

export const getAiDigitalTwinDashboard = (): Promise<AiDigitalTwinDashboard> =>
  get<AiDigitalTwinDashboard>('/api/ai-digital-twin/dashboard')

// ---------------------------------------------------------------------------
// Sprint 66a — Social Licence & Energy Transition Equity Analytics interfaces
// ---------------------------------------------------------------------------

export interface SLEProjectRecord {
  project_id: string
  project_name: string
  technology: string
  region: string
  state: string
  community_support_pct: number
  community_opposition_pct: number
  neutral_pct: number
  opposition_reason: string
  engagement_quality: string
  status: string
  aboriginal_land: boolean
}

export interface SLEFirstNationsRecord {
  region: string
  project_count: number
  indigenous_land_agreements: number
  benefit_sharing_m_aud: number
  employment_indigenous_k: number
  consultation_adequacy: string
  land_rights_respected: boolean
  cultural_heritage_issues: number
}

export interface SLEJustTransitionRecord {
  region: string
  affected_workers_k: number
  retraining_programs: number
  retraining_uptake_pct: number
  jobs_created_k: number
  wage_replacement_pct: number
  community_fund_m_aud: number
  timeline_years: number
  on_track: boolean
}

export interface SLEEquityRecord {
  cohort: string
  electricity_bill_burden_pct: number
  access_to_solar_pct: number
  energy_hardship_rate_pct: number
  program_coverage_pct: number
  equity_score: number
  trend: string
}

export interface SocialLicenceDashboard {
  timestamp: string
  projects: SLEProjectRecord[]
  first_nations: SLEFirstNationsRecord[]
  just_transition: SLEJustTransitionRecord[]
  equity: SLEEquityRecord[]
}

// ── Sprint 67b: Electricity Options Volatility Surface Analytics ──────────────

export interface EOVOptionRecord {
  option_id: string;
  underlying: string;
  region: string;
  expiry: string;
  strike_per_mwh: number;
  option_type: string;
  premium_per_mwh: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  implied_vol_pct: number;
  moneyness: string;
  open_interest_mwh: number;
}

export interface EOVVolSurfaceRecord {
  tenor_months: number;
  strike_pct_atm: number;
  implied_vol_pct: number;
  region: string;
}

export interface EOVStrategyRecord {
  strategy_name: string;
  strategy_type: string;
  legs: number;
  max_profit_per_mwh: number;
  max_loss_per_mwh: number;
  breakeven_low: number;
  breakeven_high: number;
  net_premium: number;
  use_case: string;
  suitability: string;
}

export interface EOVHistVolRecord {
  date: string;
  region: string;
  realized_vol_30d: number;
  realized_vol_90d: number;
  implied_vol: number;
  vol_risk_premium: number;
}

export interface EOVDashboard {
  options_book: EOVOptionRecord[];
  vol_surface: EOVVolSurfaceRecord[];
  strategies: EOVStrategyRecord[];
  hist_vol: EOVHistVolRecord[];
  summary: Record<string, unknown>;
}

export const getElectricityOptionsDashboard = (): Promise<EOVDashboard> =>
  get<EOVDashboard>('/api/electricity-options/dashboard');

// ── Sprint 67c: Grid-Forming Inverter & System Strength Analytics ─────────────

export interface GFIInverterRecord {
  asset_id: string;
  asset_name: string;
  region: string;
  technology: string;
  inverter_type: string;
  capacity_mw: number;
  scr_contribution: number;
  fault_ride_through: boolean;
  voltage_support: boolean;
  frequency_response: boolean;
  inertia_synthetic_mws: number;
  commissioning_year: number;
  gfm_upgraded: boolean;
}

export interface GFISystemStrengthRecord {
  region: string;
  date: string;
  scr_actual: number;
  scr_minimum: number;
  scr_comfortable: number;
  strength_status: string;
  ibr_penetration_pct: number;
  synchronous_mw: number;
  ibr_mw: number;
  risk_event: string;
}

export interface GFIFaultRideRecord {
  event_id: string;
  date: string;
  region: string;
  fault_type: string;
  severity: string;
  gfm_response_ms: number;
  gfl_response_ms: number;
  gfm_rode_through: boolean;
  gfl_rode_through: boolean;
  generation_lost_mw: number;
  frequency_nadir_hz: number;
  recovery_time_s: number;
}

export interface GFIIbrPenetrationRecord {
  year: number;
  region: string;
  ibr_penetration_pct: number;
  gfm_pct_of_ibr: number;
  synchronous_inertia_mws: number;
  synthetic_inertia_mws: number;
  system_strength_index: number;
  stability_risk: string;
}

export interface GFIDashboard {
  inverter_fleet: GFIInverterRecord[];
  system_strength: GFISystemStrengthRecord[];
  fault_ride_through_events: GFIFaultRideRecord[];
  ibr_penetration: GFIIbrPenetrationRecord[];
  summary: Record<string, unknown>;
}

export const getGridFormingInverterDashboard = (): Promise<GFIDashboard> =>
  get<GFIDashboard>('/api/grid-forming-inverter/dashboard');

// ── Sprint 67a: Nuclear Energy Pathway Analytics ─────────────────────────────

export interface NEASmrRecord {
  technology: string;
  vendor: string;
  capacity_mw: number;
  capex_per_kw: number;
  opex_per_mwh: number;
  capacity_factor_pct: number;
  lead_time_years: number;
  first_of_kind: boolean;
  overnight_cost_m: number;
  lcoe_per_mwh: number;
  status: string;
}

export interface NEAPolicyRecord {
  id: string;
  date: string;
  event: string;
  jurisdiction: string;
  category: string;
  sentiment: string;
  impact_score: number;
  description: string;
}

export interface NEACostProjectionRecord {
  year: number;
  technology: string;
  lcoe_low: number;
  lcoe_mid: number;
  lcoe_high: number;
  capacity_factor_low: number;
  capacity_factor_high: number;
}

export interface NEACapacityScenarioRecord {
  scenario: string;
  year: number;
  nuclear_gw: number;
  coal_gw: number;
  gas_gw: number;
  wind_gw: number;
  solar_gw: number;
  storage_gw: number;
  total_gw: number;
}

export interface NEADashboard {
  smr_technologies: NEASmrRecord[];
  policy_timeline: NEAPolicyRecord[];
  cost_projections: NEACostProjectionRecord[];
  capacity_scenarios: NEACapacityScenarioRecord[];
  summary: Record<string, unknown>;
}

export const getNuclearEnergyDashboard = (): Promise<NEADashboard> =>
  get<NEADashboard>('/api/nuclear-energy/dashboard');

// ── Sprint 68a: Capacity Mechanism Design Analytics ───────────────────────────

export interface CMDCapacityRecord {
  region: string;
  delivery_year: number;
  capacity_obligation_mw: number;
  capacity_contracted_mw: number;
  capacity_gap_mw: number;
  clearing_price_per_kw_yr: number;
  mechanism_type: string;
  technology_mix: string;
  status: string;
}

export interface CMDAuctionRecord {
  auction_id: string;
  auction_date: string;
  region: string;
  capacity_sought_mw: number;
  capacity_cleared_mw: number;
  clearing_price_per_kw_yr: number;
  num_bidders: number;
  num_winners: number;
  technology_types: string;
  oversubscription_pct: number;
  outcome: string;
}

export interface CMDParticipantRecord {
  participant_id: string;
  name: string;
  region: string;
  technology: string;
  committed_capacity_mw: number;
  available_capacity_mw: number;
  delivery_year: number;
  payment_per_kw_yr: number;
  reliability_rating: number;
  compliance_status: string;
}

export interface CMDDesignComparisonRecord {
  mechanism_name: string;
  jurisdiction: string;
  mechanism_type: string;
  in_use: boolean;
  cost_per_mwh: number;
  reliability_improvement_pct: number;
  new_investment_triggered_mw: number;
  admin_complexity: string;
  pros: string;
  cons: string;
}

export interface CMDDashboard {
  capacity_records: CMDCapacityRecord[];
  auction_results: CMDAuctionRecord[];
  participants: CMDParticipantRecord[];
  mechanism_comparison: CMDDesignComparisonRecord[];
  summary: Record<string, unknown>;
}

export const getCapacityMechanismDashboard = (): Promise<CMDDashboard> =>
  get<CMDDashboard>('/api/capacity-mechanism/dashboard');

// ── Sprint 68b: NEM Demand Forecasting Accuracy Analytics ─────────────────────

export interface DFAErrorRecord {
  date: string;
  region: string;
  period: string;
  horizon_min: number;
  forecast_mw: number;
  actual_mw: number;
  error_mw: number;
  error_pct: number;
  direction: string;
}

export interface DFAHorizonSummaryRecord {
  region: string;
  horizon_min: number;
  mae_mw: number;
  rmse_mw: number;
  mape_pct: number;
  bias_mw: number;
  p90_error_mw: number;
  skill_score: number;
}

export interface DFASeasonalBiasRecord {
  region: string;
  season: string;
  time_of_day: string;
  avg_error_mw: number;
  avg_error_pct: number;
  sample_count: number;
  primary_driver: string;
}

export interface DFAModelBenchmarkRecord {
  model_name: string;
  model_type: string;
  region: string;
  mae_mw: number;
  rmse_mw: number;
  mape_pct: number;
  training_data_years: number;
  features_used: string;
  deployment_status: string;
  last_retrained: string;
}

export interface DFADashboard {
  error_records: DFAErrorRecord[];
  horizon_summary: DFAHorizonSummaryRecord[];
  seasonal_bias: DFASeasonalBiasRecord[];
  model_benchmarks: DFAModelBenchmarkRecord[];
  summary: Record<string, unknown>;
}

export const getDemandForecastAccuracyDashboard = (): Promise<DFADashboard> =>
  get<DFADashboard>('/api/demand-forecast-accuracy/dashboard');

// ── Sprint 68c: Transmission Network Investment Analytics ─────────────────────

export interface TNIProjectRecord {
  project_id: string;
  project_name: string;
  tnsp: string;
  region: string;
  capex_approved_m: number;
  capex_spent_m: number;
  capex_remaining_m: number;
  commissioning_year: number;
  project_type: string;
  stage: string;
  bcr: number;
  mw_enabled: number;
  aer_approved: boolean;
}

export interface TNIRabRecord {
  tnsp: string;
  regulatory_period: string;
  rab_opening_m: number;
  rab_closing_m: number;
  capex_allowance_m: number;
  capex_actual_m: number;
  capex_variance_m: number;
  wacc_pct: number;
  revenue_cap_m: number;
  revenue_actual_m: number;
  efficiency_score: number;
}

export interface TNICapexRecord {
  tnsp: string;
  year: number;
  category: string;
  capex_m: number;
  opex_m: number;
  total_expenditure_m: number;
  assets_commissioned_m: number;
  network_length_km: number;
}

export interface TNIAerDeterminationRecord {
  determination_id: string;
  tnsp: string;
  period_start: number;
  period_end: number;
  allowed_revenue_m: number;
  proposed_revenue_m: number;
  revenue_reduction_m: number;
  wacc_approved_pct: number;
  capex_allowance_m: number;
  opex_allowance_m: number;
  rab_approved_m: number;
  key_decision: string;
}

export interface TNIDashboard {
  projects: TNIProjectRecord[];
  rab_records: TNIRabRecord[];
  capex_records: TNICapexRecord[];
  aer_determinations: TNIAerDeterminationRecord[];
  summary: Record<string, unknown>;
}

export const getTransmissionInvestmentDashboard = (): Promise<TNIDashboard> =>
  get<TNIDashboard>('/api/transmission-investment/dashboard');

// ── Sprint 69a: Renewable Energy Zone Progress Analytics ──────────────────────

export interface RZPZoneRecord {
  rez_id: string;
  rez_name: string;
  region: string;
  state: string;
  capacity_limit_mw: number;
  capacity_committed_mw: number;
  capacity_queue_mw: number;
  capacity_operational_mw: number;
  transmission_capacity_mw: number;
  dominant_technology: string;
  zone_status: string;
  lcoe_range: string;
  num_projects: number;
}

export interface RZPProjectRecord {
  project_id: string;
  project_name: string;
  rez_id: string;
  developer: string;
  technology: string;
  capacity_mw: number;
  stage: string;
  target_cod: string;
  connection_application: string;
  estimated_annual_gwh: number;
  lgi_agreement: boolean;
}

export interface RZPConstraintRecord {
  rez_id: string;
  constraint_id: string;
  constraint_type: string;
  binding_frequency_pct: number;
  avg_curtailment_pct: number;
  shadow_price_per_mwh: number;
  resolution_project: string;
  resolution_year: number;
}

export interface RZPQueueRecord {
  rez_id: string;
  queue_position: number;
  technology: string;
  capacity_mw: number;
  developer: string;
  application_date: string;
  expected_connection_year: number;
  status: string;
}

export interface RZPDashboard {
  zones: RZPZoneRecord[];
  projects: RZPProjectRecord[];
  constraints: RZPConstraintRecord[];
  queue: RZPQueueRecord[];
  summary: Record<string, unknown>;
}

export const getRezProgressDashboard = (): Promise<RZPDashboard> =>
  get<RZPDashboard>('/api/rez-progress/dashboard');

// ── Sprint 69b: Energy Storage Revenue Stack Analytics ────────────────────────

export interface ESRRevenueStreamRecord {
  project_name: string;
  region: string;
  capacity_mw: number;
  duration_hr: number;
  year: number;
  energy_arbitrage_per_kw: number;
  fcas_raise_per_kw: number;
  fcas_lower_per_kw: number;
  capacity_payment_per_kw: number;
  firm_power_contract_per_kw: number;
  ancillary_other_per_kw: number;
  total_revenue_per_kw: number;
  merchant_pct: number;
  contracted_pct: number;
}

export interface ESRProjectRecord {
  project_id: string;
  project_name: string;
  region: string;
  capacity_mw: number;
  energy_mwh: number;
  duration_hr: number;
  technology: string;
  developer: string;
  commissioning_year: number;
  capex_per_kw: number;
  opex_per_kw_yr: number;
  cycles_per_year: number;
  degradation_pct_per_yr: number;
  warranty_years: number;
  project_life_years: number;
  irr_pct: number;
  npv_m: number;
}

export interface ESRDegradationRecord {
  technology: string;
  year: number;
  capacity_retention_pct: number;
  round_trip_efficiency_pct: number;
  cycle_count_cumulative: number;
  replacement_cost_per_kwh: number;
}

export interface ESRSensitivityRecord {
  project_id: string;
  variable: string;
  delta_pct: number;
  irr_base_pct: number;
  irr_scenario_pct: number;
  irr_delta_pct: number;
  npv_delta_m: number;
}

export interface ESRDashboard {
  revenue_streams: ESRRevenueStreamRecord[];
  projects: ESRProjectRecord[];
  degradation: ESRDegradationRecord[];
  sensitivity: ESRSensitivityRecord[];
  summary: Record<string, unknown>;
}

export const getStorageRevenueDashboard = (): Promise<ESRDashboard> =>
  get<ESRDashboard>('/api/storage-revenue/dashboard');

// ── Sprint 69c: NEM Carbon Price Pathway Analytics ────────────────────────────

export interface CPPScenarioRecord {
  scenario_name: string;
  year: number;
  carbon_price_per_t: number;
  electricity_price_impact_per_mwh: number;
  total_abatement_mt: number;
  renewable_share_pct: number;
  coal_generation_twh: number;
  gas_generation_twh: number;
  policy_basis: string;
}

export interface CPPSafeguardRecord {
  facility_name: string;
  sector: string;
  state: string;
  baseline_kt_co2e: number;
  actual_emissions_kt_co2e: number;
  surplus_deficit_kt: number;
  accu_purchased: number;
  accu_cost_m: number;
  abatement_pathway: string;
  compliance_year: number;
}

export interface CPPPassthroughRecord {
  generator_name: string;
  technology: string;
  region: string;
  carbon_intensity_t_per_mwh: number;
  carbon_cost_per_mwh: number;
  spot_price_impact_pct: number;
  passthrough_rate_pct: number;
  year: number;
}

export interface CPPAbatementRecord {
  abatement_option: string;
  sector: string;
  cost_per_t_co2: number;
  potential_mt_pa: number;
  maturity: string;
  timeline_years: number;
  nem_relevant: boolean;
}

export interface CPPDashboard {
  scenarios: CPPScenarioRecord[];
  safeguard_facilities: CPPSafeguardRecord[];
  passthrough_records: CPPPassthroughRecord[];
  abatement_options: CPPAbatementRecord[];
  summary: Record<string, unknown>;
}

export const getCarbonPricePathwayDashboard = (): Promise<CPPDashboard> =>
  get<CPPDashboard>('/api/carbon-price-pathway/dashboard');
