import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { getEsooAdequacyDashboard, EsooAdequacyDashboard } from '../api/client'

const REGION_COLORS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#a78bfa',
  QLD: '#f97316',
  SA:  '#34d399',
  TAS: '#fbbf24',
}

const SCENARIO_COLORS: Record<string, string> = {
  STEP_CHANGE:  '#34d399',
  CENTRAL:      '#60a5fa',
  SLOW_CHANGE:  '#f97316',
  HIGH_DER:     '#a78bfa',
}

const RISK_COLORS: Record<string, string> = {
  LOW:      'bg-green-900 text-green-300',
  MEDIUM:   'bg-yellow-900 text-yellow-300',
  HIGH:     'bg-orange-900 text-orange-300',
  CRITICAL: 'bg-red-900 text-red-300',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  FIRM:        'bg-green-900 text-green-300',
  LIKELY:      'bg-blue-900 text-blue-300',
  SPECULATIVE: 'bg-gray-700 text-gray-300',
}

const TRIGGER_COLORS: Record<string, string> = {
  ECONOMICS:     'bg-orange-900 text-orange-300',
  AGE:           'bg-yellow-900 text-yellow-300',
  POLICY:        'bg-blue-900 text-blue-300',
  OWNER_DECISION:'bg-purple-900 text-purple-300',
}

const ADEQUACY_COLORS: Record<string, string> = {
  ADEQUATE:   'bg-green-900 text-green-300',
  MARGINAL:   'bg-yellow-900 text-yellow-300',
  INADEQUATE: 'bg-red-900 text-red-300',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}

export default function EsooAdequacyAnalytics() {
  const [data, setData] = useState<EsooAdequacyDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEsooAdequacyDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Loading ESOO Generation Adequacy data...
    </div>
  )
  if (error) return (
    <div className="flex items-center justify-center h-64 text-red-400">
      Error: {error}
    </div>
  )
  if (!data) return null

  // KPI calculations
  const highCritical2028 = data.adequacy
    .filter(r => r.year === 2028 && (r.capacity_shortage_risk === 'HIGH' || r.capacity_shortage_risk === 'CRITICAL'))
    .length

  const totalNewInvestmentMW = data.adequacy.reduce((sum, r) => sum + r.new_investment_needed_mw, 0)

  const totalRetirementMW = data.retirements.reduce((sum, r) => sum + r.capacity_mw, 0)

  const stepChangeRecords = data.scenarios.filter(s => s.scenario === 'STEP_CHANGE')
  const stepChangeAdequateCount = stepChangeRecords.filter(s => s.adequacy_status === 'ADEQUATE').length
  const stepChangeAdequacyRate = stepChangeRecords.length > 0
    ? Math.round((stepChangeAdequateCount / stepChangeRecords.length) * 100)
    : 0

  // Adequacy gap bar chart data: group by region/year
  const regions = ['NSW', 'VIC', 'QLD', 'SA', 'TAS']
  const years = [2025, 2026, 2027, 2028]

  const adequacyBarData = years.map(yr => {
    const entry: Record<string, string | number> = { year: String(yr) }
    regions.forEach(region => {
      const rec = data.adequacy.find(r => r.year === yr && r.region === region)
      if (rec) {
        entry[`${region}_available`] = rec.available_capacity_mw
        entry[`${region}_demand`]    = rec.peak_demand_mw
        entry[`${region}_gap`]       = Math.max(0, rec.capacity_gap_mw)
      }
    })
    return entry
  })

  // Scenario comparison chart for NSW and SA
  const scenarioChartData = ['STEP_CHANGE', 'CENTRAL', 'SLOW_CHANGE', 'HIGH_DER'].map(sc => {
    const nsw = data.scenarios.find(s => s.scenario === sc && s.region === 'NSW')
    const sa  = data.scenarios.find(s => s.scenario === sc && s.region === 'SA')
    return {
      scenario: sc.replace('_', ' '),
      NSW_dispatchable: nsw?.dispatchable_capacity_gw ?? 0,
      SA_dispatchable:  sa?.dispatchable_capacity_gw ?? 0,
      NSW_storage:      nsw?.storage_gw ?? 0,
      SA_storage:       sa?.storage_gw ?? 0,
    }
  })

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">AEMO ESOO Generation Adequacy Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Electricity Statement of Opportunities — projected adequacy gaps, new investment requirements and reliability trajectory
          </p>
        </div>
        <div className="ml-auto text-xs text-gray-500">
          Updated: {new Date(data.timestamp).toLocaleString()}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Regions HIGH/CRITICAL by 2028</div>
          <div className="text-3xl font-bold text-red-400">{highCritical2028}</div>
          <div className="text-xs text-gray-500 mt-1">of {regions.length} NEM regions</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total New Investment Needed</div>
          <div className="text-3xl font-bold text-orange-400">{totalNewInvestmentMW.toLocaleString()} MW</div>
          <div className="text-xs text-gray-500 mt-1">across all regions 2025-2028</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Retirement Pipeline</div>
          <div className="text-3xl font-bold text-yellow-400">{Math.round(totalRetirementMW).toLocaleString()} MW</div>
          <div className="text-xs text-gray-500 mt-1">{data.retirements.length} units scheduled</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">STEP_CHANGE Adequacy Rate</div>
          <div className="text-3xl font-bold text-green-400">{stepChangeAdequacyRate}%</div>
          <div className="text-xs text-gray-500 mt-1">regions ADEQUATE by 2030</div>
        </div>
      </div>

      {/* Adequacy Gap Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Capacity Adequacy by Region and Year</h2>
        <p className="text-xs text-gray-400 mb-4">Available capacity (MW) vs peak demand — gap highlighted for at-risk regions</p>

        <div className="space-y-6">
          {regions.map(region => {
            const regionData = years.map(yr => {
              const rec = data.adequacy.find(r => r.year === yr && r.region === region)
              return {
                year: String(yr),
                available: rec?.available_capacity_mw ?? 0,
                demand:    rec?.peak_demand_mw ?? 0,
                gap:       Math.max(0, rec?.capacity_gap_mw ?? 0),
                risk:      rec?.capacity_shortage_risk ?? 'LOW',
              }
            })
            return (
              <div key={region}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold" style={{ color: REGION_COLORS[region] }}>{region}</span>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <ComposedChart data={regionData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={65} tickFormatter={v => `${(v/1000).toFixed(1)}GW`} />
                    <Tooltip
                      contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                      formatter={(val: number, name: string) => [`${val.toLocaleString()} MW`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="available" name="Available Capacity" fill={REGION_COLORS[region]} opacity={0.85} />
                    <Bar dataKey="demand" name="Peak Demand" fill="#6b7280" opacity={0.7} />
                    <Bar dataKey="gap" name="Capacity Gap" fill="#ef4444" opacity={0.9} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
      </div>

      {/* Investment Pipeline Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">New Investment Pipeline</h2>
        <p className="text-xs text-gray-400 mb-4">Committed and anticipated generation and storage projects across the NEM</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-800">
                <th className="pb-2 pr-4">Project</th>
                <th className="pb-2 pr-4">Technology</th>
                <th className="pb-2 pr-4">Region</th>
                <th className="pb-2 pr-4">Capacity (MW)</th>
                <th className="pb-2 pr-4">COD Year</th>
                <th className="pb-2 pr-4">Confidence</th>
                <th className="pb-2 pr-4">Investment (M AUD)</th>
                <th className="pb-2">Cap. Market</th>
              </tr>
            </thead>
            <tbody>
              {data.investment_pipeline.map((rec, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="py-2 pr-4 font-medium text-white">{rec.project_name}</td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 bg-blue-900/60 text-blue-300 rounded text-xs">
                      {rec.technology}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className="font-semibold text-sm" style={{ color: REGION_COLORS[rec.region] }}>
                      {rec.region}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-gray-200">{rec.capacity_mw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-gray-300">{rec.expected_cod}</td>
                  <td className="py-2 pr-4">
                    <Badge label={rec.confidence} className={CONFIDENCE_COLORS[rec.confidence] ?? 'bg-gray-700 text-gray-300'} />
                  </td>
                  <td className="py-2 pr-4 font-mono text-gray-200">${rec.investment_m_aud.toLocaleString()}</td>
                  <td className="py-2">
                    {rec.capacity_market_eligible
                      ? <span className="px-2 py-0.5 bg-green-900/60 text-green-300 rounded text-xs">Eligible</span>
                      : <span className="px-2 py-0.5 bg-gray-800 text-gray-500 rounded text-xs">No</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retirement Risk Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Generation Retirement Schedule</h2>
        <p className="text-xs text-gray-400 mb-4">Upcoming retirements and reliability impact assessment</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-800">
                <th className="pb-2 pr-4">Unit</th>
                <th className="pb-2 pr-4">Technology</th>
                <th className="pb-2 pr-4">Region</th>
                <th className="pb-2 pr-4">Capacity (MW)</th>
                <th className="pb-2 pr-4">Retirement Year</th>
                <th className="pb-2 pr-4">Trigger</th>
                <th className="pb-2 pr-4">Replacement</th>
                <th className="pb-2">Reliability Impact</th>
              </tr>
            </thead>
            <tbody>
              {data.retirements
                .slice()
                .sort((a, b) => a.expected_retirement_year - b.expected_retirement_year)
                .map((rec, i) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="py-2 pr-4 font-medium text-white">{rec.unit_name}</td>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-xs">
                        {rec.technology}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="font-semibold text-sm" style={{ color: REGION_COLORS[rec.region] }}>
                        {rec.region}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-gray-200">{rec.capacity_mw.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-gray-300">{rec.expected_retirement_year}</td>
                    <td className="py-2 pr-4">
                      <Badge
                        label={rec.retirement_trigger}
                        className={TRIGGER_COLORS[rec.retirement_trigger] ?? 'bg-gray-700 text-gray-300'}
                      />
                    </td>
                    <td className="py-2 pr-4">
                      {rec.replacement_committed
                        ? <span className="px-2 py-0.5 bg-green-900/60 text-green-300 rounded text-xs">Committed</span>
                        : <span className="px-2 py-0.5 bg-red-900/60 text-red-400 rounded text-xs">Not Committed</span>
                      }
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        rec.reliability_impact === 'CRITICAL' ? 'bg-red-900 text-red-300'
                        : rec.reliability_impact === 'HIGH' ? 'bg-orange-900 text-orange-300'
                        : rec.reliability_impact === 'MODERATE' ? 'bg-yellow-900 text-yellow-300'
                        : 'bg-gray-800 text-gray-400'
                      }`}>
                        {rec.reliability_impact}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scenario Comparison Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Scenario Comparison — Dispatchable Capacity by 2030</h2>
        <p className="text-xs text-gray-400 mb-4">
          Dispatchable capacity (GW) across STEP_CHANGE, CENTRAL, SLOW_CHANGE and HIGH_DER scenarios for NSW and SA
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dispatchable capacity grouped bar */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Dispatchable Capacity (GW)</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={scenarioChartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="scenario" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={40} tickFormatter={v => `${v}GW`} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(val: number, name: string) => [`${val.toFixed(1)} GW`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="NSW_dispatchable" name="NSW Dispatchable" fill={REGION_COLORS['NSW']} />
                <Bar dataKey="SA_dispatchable"  name="SA Dispatchable"  fill={REGION_COLORS['SA']} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Storage capacity grouped bar */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Storage Capacity (GW)</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={scenarioChartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="scenario" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={40} tickFormatter={v => `${v}GW`} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(val: number, name: string) => [`${val.toFixed(1)} GW`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="NSW_storage" name="NSW Storage" fill="#60a5fa" opacity={0.85} />
                <Bar dataKey="SA_storage"  name="SA Storage"  fill="#34d399" opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scenario adequacy status grid */}
        <div className="mt-6">
          <p className="text-xs text-gray-400 mb-3">Adequacy Status by Region and Scenario (2030)</p>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-800">
                  <th className="pb-2 pr-6">Region</th>
                  {['STEP_CHANGE', 'CENTRAL', 'SLOW_CHANGE', 'HIGH_DER'].map(sc => (
                    <th key={sc} className="pb-2 pr-4">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ color: SCENARIO_COLORS[sc] }}>
                        {sc.replace('_', ' ')}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regions.map(region => (
                  <tr key={region} className="border-b border-gray-800">
                    <td className="py-2 pr-6 font-semibold" style={{ color: REGION_COLORS[region] }}>{region}</td>
                    {['STEP_CHANGE', 'CENTRAL', 'SLOW_CHANGE', 'HIGH_DER'].map(sc => {
                      const rec = data.scenarios.find(s => s.scenario === sc && s.region === region)
                      return (
                        <td key={sc} className="py-2 pr-4">
                          {rec && (
                            <Badge
                              label={rec.adequacy_status}
                              className={ADEQUACY_COLORS[rec.adequacy_status] ?? 'bg-gray-700 text-gray-300'}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
