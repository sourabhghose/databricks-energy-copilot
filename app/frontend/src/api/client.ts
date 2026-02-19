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
