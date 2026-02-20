import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getSpotMarketStressDashboard,
  SSTDashboard,
  SSTScenarioRecord,
  SSTTailRiskRecord,
  SSTResilenceMetricRecord,
  SSTHistoricalEventRecord,
  SSTSensitivityRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const KPI_CARD_BG = 'bg-gray-800 border border-gray-700 rounded-lg p-4'

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={KPI_CARD_BG}>
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">
      {title}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// Severity Badge
// ---------------------------------------------------------------------------
function SeverityBadge({ severity }: { severity: string }) {
  const COLOR_MAP: Record<string, string> = {
    EXTREME:  'bg-red-900 text-red-300 border border-red-700',
    SEVERE:   'bg-orange-900 text-orange-300 border border-orange-700',
    MODERATE: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
    MILD:     'bg-green-900 text-green-300 border border-green-700',
  }
  const cls = COLOR_MAP[severity] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${cls}`}>
      {severity}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Status Badge (traffic light)
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const COLOR_MAP: Record<string, string> = {
    ADEQUATE: 'bg-green-900 text-green-300 border border-green-700',
    MARGINAL: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
    STRESSED: 'bg-red-900 text-red-300 border border-red-700',
  }
  const cls = COLOR_MAP[status] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Trend Badge
// ---------------------------------------------------------------------------
function TrendBadge({ trend }: { trend: string }) {
  const symbols: Record<string, string> = {
    IMPROVING:    '↑',
    STABLE:       '→',
    DETERIORATING: '↓',
  }
  const colors: Record<string, string> = {
    IMPROVING:    'text-green-400',
    STABLE:       'text-gray-400',
    DETERIORATING: 'text-red-400',
  }
  return (
    <span className={`font-bold ${colors[trend] ?? 'text-gray-400'}`}>
      {symbols[trend] ?? trend}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Section 1: Stress Scenarios Table
// ---------------------------------------------------------------------------
function StressScenariosSection({ scenarios }: { scenarios: SSTScenarioRecord[] }) {
  const [filter, setFilter] = useState<string>('ALL')
  const categories = ['ALL', ...Array.from(new Set(scenarios.map((s) => s.category))).sort()]

  const filtered = filter === 'ALL' ? scenarios : scenarios.filter((s) => s.category === filter)
  const sorted = [...filtered].sort((a, b) => b.peak_price_impact - a.peak_price_impact)

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Stress Scenarios — Impact & Probability Matrix" />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Scenario</th>
              <th className="text-left py-2 pr-3">Category</th>
              <th className="text-left py-2 pr-3">Severity</th>
              <th className="text-right py-2 pr-3">Prob % p.a.</th>
              <th className="text-right py-2 pr-3">Duration (days)</th>
              <th className="text-right py-2 pr-3">Peak Price ($/MWh)</th>
              <th className="text-right py-2 pr-3">Avg Impact %</th>
              <th className="text-right py-2 pr-3">Cost ($M)</th>
              <th className="text-left py-2">Regions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.scenario_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 text-white font-medium max-w-xs">
                  <span className="block truncate" title={s.scenario_name}>
                    {s.scenario_name.replace(/_/g, ' ')}
                  </span>
                  <span className="text-gray-500 text-xs">{s.description.slice(0, 60)}…</span>
                </td>
                <td className="py-2 pr-3 text-gray-300">{s.category}</td>
                <td className="py-2 pr-3"><SeverityBadge severity={s.severity} /></td>
                <td className="py-2 pr-3 text-right text-gray-200">{s.probability_annual_pct.toFixed(1)}%</td>
                <td className="py-2 pr-3 text-right text-gray-200">{s.duration_days}</td>
                <td className="py-2 pr-3 text-right text-red-300 font-semibold">
                  ${s.peak_price_impact.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right text-orange-300">+{s.avg_price_impact_pct.toFixed(0)}%</td>
                <td className="py-2 pr-3 text-right text-yellow-300">${s.energy_cost_impact_m.toLocaleString()}M</td>
                <td className="py-2 text-gray-400 text-xs">{s.affected_regions.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 2: Tail Risk — VaR/CVaR BarChart by region
// ---------------------------------------------------------------------------
const METRIC_COLORS: Record<string, string> = {
  VAR_95:      '#3B82F6',
  VAR_99:      '#6366F1',
  CVAR_95:     '#F59E0B',
  CVAR_99:     '#EF4444',
  MAX_DRAWDOWN:'#EC4899',
  STRESS_VaR:  '#10B981',
}

function TailRiskSection({ records }: { records: SSTTailRiskRecord[] }) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['VAR_99', 'CVAR_99', 'STRESS_VaR'])
  const regions = Array.from(new Set(records.map((r) => r.region))).sort()
  const allMetrics = Array.from(new Set(records.map((r) => r.metric)))

  const chartData = regions.map((region) => {
    const row: Record<string, number | string> = { region }
    for (const metric of selectedMetrics) {
      const rec = records.find((r) => r.region === region && r.metric === metric)
      row[metric] = rec ? parseFloat(rec.value.toFixed(1)) : 0
    }
    return row
  })

  // Detail table
  const tableData = records
    .filter((r) => selectedMetrics.includes(r.metric))
    .sort((a, b) => a.region.localeCompare(b.region) || a.metric.localeCompare(b.metric))

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Tail Risk Analysis — VaR & CVaR by Region ($/MWh)" />
        <div className="flex flex-wrap gap-2">
          {allMetrics.map((m) => (
            <button
              key={m}
              onClick={() =>
                setSelectedMetrics((prev) =>
                  prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
                )
              }
              className={`px-2 py-1 rounded text-xs font-medium border ${
                selectedMetrics.includes(m)
                  ? 'border-blue-500 text-blue-300 bg-blue-900/40'
                  : 'border-gray-600 text-gray-400 bg-gray-700'
              }`}
            >
              {m.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
          <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '6px' }}
            labelStyle={{ color: '#F9FAFB' }}
            formatter={(value: number, name: string) => [`$${value.toFixed(1)}/MWh`, name.replace(/_/g, ' ')]}
          />
          <Legend />
          {selectedMetrics.map((metric) => (
            <Bar key={metric} dataKey={metric} name={metric.replace(/_/g, ' ')} fill={METRIC_COLORS[metric] ?? '#6B7280'} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-left py-2 pr-3">Metric</th>
              <th className="text-right py-2 pr-3">Value ($/MWh)</th>
              <th className="text-right py-2 pr-3">Percentile</th>
              <th className="text-right py-2 pr-3">Return Period (yrs)</th>
              <th className="text-right py-2 pr-3">Hist. Worst</th>
              <th className="text-right py-2">Stress Worst</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((r, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 text-white font-medium">{r.region}</td>
                <td className="py-2 pr-3">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ backgroundColor: (METRIC_COLORS[r.metric] ?? '#6B7280') + '33', color: METRIC_COLORS[r.metric] ?? '#9CA3AF', border: `1px solid ${METRIC_COLORS[r.metric] ?? '#6B7280'}` }}
                  >
                    {r.metric.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-orange-300 font-semibold">${r.value.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{r.percentile_pct.toFixed(1)}th</td>
                <td className="py-2 pr-3 text-right text-gray-300">1-in-{r.return_period_years.toFixed(0)}</td>
                <td className="py-2 pr-3 text-right text-yellow-400">${r.historical_worst.toFixed(1)}</td>
                <td className="py-2 text-right text-red-400">${r.stress_test_worst.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 3: Resilience Dashboard — Traffic-light status table
// ---------------------------------------------------------------------------
const METRIC_LABEL: Record<string, string> = {
  PRICE_SPIKE_RECOVERY_HRS:     'Price Spike Recovery (hrs)',
  SUPPLY_ADEQUACY_MARGIN_PCT:   'Supply Adequacy Margin (%)',
  INTERCONNECTOR_REDUNDANCY_PCT:'Interconnector Redundancy (%)',
  FCAS_HEADROOM_MW:             'FCAS Headroom (MW)',
  RAMP_CAPABILITY_MW_MIN:       'Ramp Capability (MW/min)',
}

function ResilienceDashboardSection({ records }: { records: SSTResilenceMetricRecord[] }) {
  const regions = Array.from(new Set(records.map((r) => r.region))).sort()
  const metrics = Array.from(new Set(records.map((r) => r.metric)))
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL')

  const filtered = selectedRegion === 'ALL' ? records : records.filter((r) => r.region === selectedRegion)

  // Summary counts
  const adequateCount = records.filter((r) => r.status === 'ADEQUATE').length
  const marginalCount = records.filter((r) => r.status === 'MARGINAL').length
  const stressedCount = records.filter((r) => r.status === 'STRESSED').length

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="System Resilience Metrics — Traffic Light Dashboard" />
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm"
        >
          <option value="ALL">All Regions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Summary strip */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
          <span className="text-gray-300 text-sm">Adequate: {adequateCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block"></span>
          <span className="text-gray-300 text-sm">Marginal: {marginalCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
          <span className="text-gray-300 text-sm">Stressed: {stressedCount}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-left py-2 pr-3">Metric</th>
              <th className="text-right py-2 pr-3">Current Value</th>
              <th className="text-right py-2 pr-3">Adequate Threshold</th>
              <th className="text-right py-2 pr-3">Stress Threshold</th>
              <th className="text-left py-2 pr-3">Status</th>
              <th className="text-center py-2">Trend</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 text-white font-medium">{r.region}</td>
                <td className="py-2 pr-3 text-gray-300 text-xs">{METRIC_LABEL[r.metric] ?? r.metric}</td>
                <td className="py-2 pr-3 text-right text-white font-semibold">{r.current_value.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-green-400">{r.adequate_threshold.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-red-400">{r.stress_threshold.toFixed(1)}</td>
                <td className="py-2 pr-3"><StatusBadge status={r.status} /></td>
                <td className="py-2 text-center"><TrendBadge trend={r.trend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 4: Historical Events Timeline
// ---------------------------------------------------------------------------
function HistoricalEventsSection({ events }: { events: SSTHistoricalEventRecord[] }) {
  const [sortKey, setSortKey] = useState<'date' | 'total_cost_m' | 'peak_price'>('date')
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)

  const sorted = [...events].sort((a, b) => {
    if (sortKey === 'date') return b.date.localeCompare(a.date)
    if (sortKey === 'total_cost_m') return b.total_cost_m - a.total_cost_m
    return b.peak_price - a.peak_price
  })

  const totalCost = events.reduce((sum, e) => sum + e.total_cost_m, 0)
  const totalLoadShed = events.reduce((sum, e) => sum + e.load_shed_mwh, 0)
  const interventionCount = events.filter((e) => e.market_intervention).length

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Historical Stress Events — NEM Timeline" />
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-xs">Sort by:</span>
          {(['date', 'total_cost_m', 'peak_price'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`px-2 py-1 rounded text-xs font-medium border ${
                sortKey === k
                  ? 'border-blue-500 text-blue-300 bg-blue-900/40'
                  : 'border-gray-600 text-gray-400 bg-gray-700'
              }`}
            >
              {k === 'date' ? 'Date' : k === 'total_cost_m' ? 'Cost' : 'Peak Price'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-700/50 rounded p-3 text-center">
          <p className="text-gray-400 text-xs">Total Historical Cost</p>
          <p className="text-red-300 font-bold text-lg">${totalCost.toFixed(0)}M</p>
        </div>
        <div className="bg-gray-700/50 rounded p-3 text-center">
          <p className="text-gray-400 text-xs">Total Load Shed (MWh)</p>
          <p className="text-orange-300 font-bold text-lg">{(totalLoadShed / 1000).toFixed(0)}k</p>
        </div>
        <div className="bg-gray-700/50 rounded p-3 text-center">
          <p className="text-gray-400 text-xs">Market Interventions</p>
          <p className="text-yellow-300 font-bold text-lg">{interventionCount}/{events.length}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Event</th>
              <th className="text-left py-2 pr-3">Date</th>
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-left py-2 pr-3">Category</th>
              <th className="text-right py-2 pr-3">Peak Price</th>
              <th className="text-right py-2 pr-3">Duration (hrs)</th>
              <th className="text-right py-2 pr-3">Total Cost ($M)</th>
              <th className="text-right py-2 pr-3">Load Shed (MWh)</th>
              <th className="text-center py-2">Intervention</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <>
                <tr
                  key={e.event_name}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer"
                  onClick={() => setExpandedEvent(expandedEvent === e.event_name ? null : e.event_name)}
                >
                  <td className="py-2 pr-3 text-white font-medium">{e.event_name}</td>
                  <td className="py-2 pr-3 text-gray-300">{e.date}</td>
                  <td className="py-2 pr-3 text-blue-300">{e.region}</td>
                  <td className="py-2 pr-3 text-gray-400 text-xs">{e.category}</td>
                  <td className="py-2 pr-3 text-right text-red-300 font-semibold">
                    {e.peak_price < 0 ? `-$${Math.abs(e.peak_price).toFixed(0)}` : `$${e.peak_price.toLocaleString()}`}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-300">{e.duration_hrs.toFixed(0)}</td>
                  <td className="py-2 pr-3 text-right text-orange-300 font-semibold">${e.total_cost_m.toFixed(0)}M</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{e.load_shed_mwh > 0 ? e.load_shed_mwh.toLocaleString() : '—'}</td>
                  <td className="py-2 text-center">
                    {e.market_intervention ? (
                      <span className="text-red-400 font-bold">Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                </tr>
                {expandedEvent === e.event_name && (
                  <tr key={`${e.event_name}-lesson`} className="bg-gray-700/20">
                    <td colSpan={9} className="px-4 py-3">
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Lesson Learned</p>
                      <p className="text-gray-200 text-sm">{e.lesson_learned}</p>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 5: Sensitivity Analysis — Heatmap-style factor × region table
// ---------------------------------------------------------------------------
const INTENSITY_COLORS = [
  'bg-blue-900/40 text-blue-300',
  'bg-yellow-900/40 text-yellow-300',
  'bg-orange-900/40 text-orange-300',
  'bg-red-900/40 text-red-400',
  'bg-red-800 text-red-200',
]

function cellIntensity(value: number, max: number): string {
  if (max === 0) return INTENSITY_COLORS[0]
  const ratio = value / max
  if (ratio < 0.2) return INTENSITY_COLORS[0]
  if (ratio < 0.4) return INTENSITY_COLORS[1]
  if (ratio < 0.6) return INTENSITY_COLORS[2]
  if (ratio < 0.8) return INTENSITY_COLORS[3]
  return INTENSITY_COLORS[4]
}

function SensitivitySection({ records }: { records: SSTSensitivityRecord[] }) {
  const factors = Array.from(new Set(records.map((r) => r.factor))).sort()
  const regions = Array.from(new Set(records.map((r) => r.region))).sort()
  const [valueType, setValueType] = useState<'price_response' | 'risk_contribution_pct'>('price_response')

  const getValue = (factor: string, region: string): number => {
    const rec = records.find((r) => r.factor === factor && r.region === region)
    return rec ? (valueType === 'price_response' ? rec.price_response : rec.risk_contribution_pct) : 0
  }

  const allValues = records.map((r) => valueType === 'price_response' ? r.price_response : r.risk_contribution_pct)
  const maxVal = Math.max(...allValues)

  const unit = valueType === 'price_response' ? '$/MWh' : '%'

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Sensitivity Analysis — Factor vs Region Heatmap" />
        <div className="flex gap-2">
          {(['price_response', 'risk_contribution_pct'] as const).map((vt) => (
            <button
              key={vt}
              onClick={() => setValueType(vt)}
              className={`px-3 py-1 rounded text-xs font-medium border ${
                valueType === vt
                  ? 'border-blue-500 text-blue-300 bg-blue-900/40'
                  : 'border-gray-600 text-gray-400 bg-gray-700'
              }`}
            >
              {vt === 'price_response' ? 'Price Response ($/MWh)' : 'Risk Contribution (%)'}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-left text-gray-400 py-1 pr-2 text-xs">Factor \ Region</th>
              {regions.map((r) => (
                <th key={r} className="text-center text-gray-400 text-xs py-1 px-2">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factors.map((factor) => {
              const rowMax = Math.max(...regions.map((r) => getValue(factor, r)))
              return (
                <tr key={factor}>
                  <td className="text-gray-300 text-xs py-1 pr-2 font-medium whitespace-nowrap">
                    {factor.replace(/_/g, ' ')}
                  </td>
                  {regions.map((region) => {
                    const val = getValue(factor, region)
                    const intensity = cellIntensity(val, maxVal)
                    return (
                      <td key={region} className={`text-center rounded py-2 px-3 font-semibold text-xs ${intensity}`}>
                        {val > 0 ? `${val.toFixed(1)}${unit}` : '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Color scale legend */}
      <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
        <span>Low</span>
        {INTENSITY_COLORS.map((cls, i) => (
          <span key={i} className={`w-8 h-4 rounded inline-block ${cls.split(' ')[0]}`}></span>
        ))}
        <span>High</span>
      </div>

      {/* Detail table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Factor</th>
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-left py-2 pr-3">Magnitude</th>
              <th className="text-right py-2 pr-3">Price Response ($/MWh)</th>
              <th className="text-right py-2 pr-3">Prob % p.a.</th>
              <th className="text-right py-2">Risk Contribution (%)</th>
            </tr>
          </thead>
          <tbody>
            {[...records]
              .sort((a, b) => b.price_response - a.price_response)
              .map((r, i) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-3 text-white font-medium">{r.factor.replace(/_/g, ' ')}</td>
                  <td className="py-2 pr-3 text-blue-300">{r.region}</td>
                  <td className="py-2 pr-3 text-gray-400 text-xs">{r.magnitude}</td>
                  <td className="py-2 pr-3 text-right text-orange-300 font-semibold">${r.price_response.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{r.probability_annual_pct.toFixed(1)}%</td>
                  <td className="py-2 text-right text-yellow-300">{r.risk_contribution_pct.toFixed(2)}%</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function SpotMarketStressAnalytics() {
  const [data, setData] = useState<SSTDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSpotMarketStressDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">NEM Spot Market Stress Testing Analytics</h1>
        <p className="text-gray-400 text-sm">
          Market stress scenarios, tail risk analysis, extreme event impacts, and system resilience metrics for the National Electricity Market.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <KpiCard
          label="Scenarios Modelled"
          value={String(summary.scenarios_count)}
          sub="Stress scenarios"
        />
        <KpiCard
          label="Highest Risk"
          value="EXTREME HEATWAVE"
          sub={String(summary.highest_risk_scenario).replace(/_/g, ' ')}
        />
        <KpiCard
          label="Avg VaR 99 NSW1"
          value={`$${Number(summary.avg_var_99_nsw1).toFixed(1)}/MWh`}
          sub="99th percentile"
        />
        <KpiCard
          label="Stressed Regions"
          value={String(summary.stressed_regions_count)}
          sub="of 5 NEM regions"
        />
        <KpiCard
          label="Resilience Adequate"
          value={`${Number(summary.resilience_adequate_pct).toFixed(1)}%`}
          sub="of all metrics"
        />
        <KpiCard
          label="Events Analysed"
          value={String(summary.historical_events_analyzed)}
          sub="Historical events"
        />
        <KpiCard
          label="Total Historical Cost"
          value={`$${Number(summary.total_historical_cost_m).toLocaleString()}M`}
          sub="All events combined"
        />
      </div>

      {/* Sections */}
      <StressScenariosSection scenarios={data.scenarios} />
      <TailRiskSection records={data.tail_risks} />
      <ResilienceDashboardSection records={data.resilience} />
      <HistoricalEventsSection events={data.historical_events} />
      <SensitivitySection records={data.sensitivity} />
    </div>
  )
}
