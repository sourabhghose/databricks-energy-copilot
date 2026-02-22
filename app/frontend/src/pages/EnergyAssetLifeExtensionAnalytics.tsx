import { useEffect, useState } from 'react'
import { Wrench } from 'lucide-react'
import {
  BarChart, Bar, ScatterChart, Scatter, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import {
  EALXDashboard,
  EALXAssetRecord,
  EALXDegradationRecord,
  getEnergyAssetLifeExtensionDashboard,
} from '../api/client'

// ---- Colour palette ----
const TECH_COLORS: Record<string, string> = {
  'Coal':       '#78716c',
  'Gas CCGT':   '#3b82f6',
  'Gas OCGT':   '#60a5fa',
  'Gas Steam':  '#93c5fd',
  'Hydro':      '#06b6d4',
  'Diesel':     '#f97316',
}
const STATUS_COLORS: Record<string, string> = {
  'Operating':           '#10b981',
  'Life Extended':       '#f59e0b',
  'Retirement Planned':  '#ef4444',
  'Retired':             '#6b7280',
}
const SEVERITY_COLORS: Record<string, string> = {
  'None':     '#10b981',
  'Minor':    '#84cc16',
  'Moderate': '#f59e0b',
  'Severe':   '#ef4444',
}

// ---- Helpers ----
function capacityByTechAndStatus(assets: EALXAssetRecord[]) {
  const map: Record<string, Record<string, number>> = {}
  for (const a of assets) {
    if (!map[a.technology]) map[a.technology] = { technology: a.technology as unknown as number }
    map[a.technology][a.status] = (map[a.technology][a.status] ?? 0) + a.capacity_mw
  }
  return Object.values(map).map(row => ({
    ...row,
    Operating: Math.round((row['Operating'] ?? 0)),
    'Life Extended': Math.round((row['Life Extended'] ?? 0)),
    'Retirement Planned': Math.round((row['Retirement Planned'] ?? 0)),
    Retired: Math.round((row['Retired'] ?? 0)),
  }))
}

function scatterAgeVsCondition(assets: EALXAssetRecord[], degradations: EALXDegradationRecord[]) {
  return assets.map(a => {
    const recs = degradations.filter(d => d.asset_id === a.asset_id)
    const avgCondition = recs.length > 0
      ? Math.round(recs.reduce((s, r) => s + r.condition_score, 0) / recs.length)
      : 50
    return {
      age: a.current_age_years,
      condition: avgCondition,
      name: a.asset_name,
      technology: a.technology,
      capacity: a.capacity_mw,
    }
  })
}

function economicsTimeline(data: EALXDashboard) {
  const top5ids = data.assets.slice(0, 5).map(a => a.asset_id)
  const byYear: Record<number, Record<string, number>> = {}
  for (const e of data.economics) {
    if (!top5ids.includes(e.asset_id)) continue
    if (!byYear[e.year]) byYear[e.year] = { year: e.year }
    const asset = data.assets.find(a => a.asset_id === e.asset_id)
    const label = asset ? asset.asset_name.split(' ')[0] : e.asset_id
    byYear[e.year][label + ' GM'] = (byYear[e.year][label + ' GM'] ?? 0) + e.gross_margin_m
    byYear[e.year][label + ' NPV'] = (byYear[e.year][label + ' NPV'] ?? 0) + e.npv_continue_m
  }
  return Object.values(byYear).sort((a, b) => (a.year as number) - (b.year as number))
}

function replacementNeedsByRegionYear(needs: EALXDashboard['replacement_needs']) {
  const map: Record<string, Record<string, number>> = {}
  for (const n of needs) {
    const key = String(n.timeline_year)
    if (!map[key]) map[key] = { year: n.timeline_year as unknown as number }
    map[key][n.region] = (map[key][n.region] ?? 0) + n.replacement_capacity_mw
  }
  return Object.values(map).sort((a, b) => (a.year as number) - (b.year as number))
}

// ---- Sub-components ----
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ---- Main Page ----
export default function EnergyAssetLifeExtensionAnalytics() {
  const [data, setData] = useState<EALXDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyAssetLifeExtensionDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400 p-8">
        <p>Error: {error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center text-gray-400">
          <Wrench className="mx-auto mb-3 animate-pulse" size={36} />
          <p className="text-sm">Loading Energy Asset Life Extension Analytics...</p>
        </div>
      </div>
    )
  }

  const { summary } = data
  const capByTech = capacityByTechAndStatus(data.assets)
  const scatterData = scatterAgeVsCondition(data.assets, data.degradation_records)
  const econTimeline = economicsTimeline(data)
  const repNeeds = replacementNeedsByRegionYear(data.replacement_needs)

  // Top 10 assets by retirement risk (highest avg probability)
  const riskByAsset: Record<string, number[]> = {}
  for (const r of data.retirement_risks) {
    if (!riskByAsset[r.asset_name]) riskByAsset[r.asset_name] = []
    riskByAsset[r.asset_name].push(r.probability_pct)
  }
  const topRiskAssets = Object.entries(riskByAsset)
    .map(([name, probs]) => ({
      name,
      avgRisk: Math.round(probs.reduce((s, p) => s + p, 0) / probs.length),
      asset: data.assets.find(a => a.asset_name === name),
    }))
    .sort((a, b) => b.avgRisk - a.avgRisk)
    .slice(0, 10)

  // Critical degradation records (condition < 50)
  const criticalDeg = data.degradation_records
    .filter(d => d.condition_score < 50)
    .sort((a, b) => a.condition_score - b.condition_score)
    .slice(0, 20)

  const econLineKeys: string[] = data.assets.slice(0, 5).map(a => a.asset_name.split(' ')[0])

  const lineColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7']

  return (
    <div className="min-h-full bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wrench className="text-amber-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">Energy Asset Life Extension Analytics</h1>
          <p className="text-sm text-gray-400">Coal &amp; Gas generator life extension economics — NEM portfolio view</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="At-Risk Capacity"
          value={`${summary.total_at_risk_capacity_gw?.toFixed(1)} GW`}
          sub="Life Extended + Retirement Planned"
        />
        <KpiCard
          label="Retirements (5yr)"
          value={String(summary.assets_retirement_planned_5yr)}
          sub="Assets with Retirement Planned status"
        />
        <KpiCard
          label="Avg Asset Age"
          value={`${summary.avg_asset_age_years?.toFixed(1)} yrs`}
          sub="Fleet-wide weighted average"
        />
        <KpiCard
          label="Extension Investment"
          value={`$${summary.total_extension_investment_m?.toFixed(0)}M`}
          sub="Total life extension capex committed"
        />
      </div>

      {/* Row 1: Capacity by Tech/Status + Scatter Age vs Condition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stacked Bar: capacity by technology and status */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Capacity by Technology &amp; Status (MW)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={capByTech} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="technology" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} />
              <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
              <Bar dataKey="Operating" stackId="a" fill={STATUS_COLORS['Operating']} name="Operating" />
              <Bar dataKey="Life Extended" stackId="a" fill={STATUS_COLORS['Life Extended']} name="Life Extended" />
              <Bar dataKey="Retirement Planned" stackId="a" fill={STATUS_COLORS['Retirement Planned']} name="Retirement Planned" />
              <Bar dataKey="Retired" stackId="a" fill={STATUS_COLORS['Retired']} name="Retired" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scatter: Age vs Condition Score */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Asset Age vs Avg Condition Score (coloured by technology)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" dataKey="age" name="Age (years)" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Age (years)', position: 'insideBottom', offset: -5, fill: '#9ca3af', fontSize: 11 }} />
              <YAxis type="number" dataKey="condition" name="Condition Score" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Condition', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(value, name, props) => [value, name]}
                labelFormatter={() => ''}
                content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0]?.payload
                  if (!d) return null
                  return (
                    <div className="bg-gray-800 border border-gray-600 rounded p-2 text-xs text-gray-200">
                      <p className="font-semibold">{d.name}</p>
                      <p>Technology: {d.technology}</p>
                      <p>Age: {d.age} years</p>
                      <p>Condition: {d.condition}/100</p>
                      <p>Capacity: {d.capacity} MW</p>
                    </div>
                  )
                }}
              />
              <Scatter data={scatterData} name="Assets">
                {scatterData.map((entry, idx) => (
                  <Cell key={idx} fill={TECH_COLORS[entry.technology] ?? '#6b7280'} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {Object.entries(TECH_COLORS).map(([tech, color]) => (
              <span key={tech} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Economics Timeline + Replacement Needs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart: Gross Margin timeline for top 5 assets */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Gross Margin 2025–2028 — Top 5 Assets ($M)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={econTimeline} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {econLineKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={`${key} GM`}
                  stroke={lineColors[idx]}
                  strokeWidth={2}
                  dot={false}
                  name={`${key} Margin`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart: Replacement Needs by Region and Year */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Replacement Capacity Needs by Region &amp; Timeline (MW)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={repNeeds} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="NSW" fill="#3b82f6" name="NSW" />
              <Bar dataKey="VIC" fill="#10b981" name="VIC" />
              <Bar dataKey="QLD" fill="#f59e0b" name="QLD" />
              <Bar dataKey="SA" fill="#ef4444" name="SA" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table: Top 10 Assets by Retirement Risk */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Top 10 Assets by Retirement Risk</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Asset</th>
                <th className="text-left py-2 pr-4">Technology</th>
                <th className="text-left py-2 pr-4">Region</th>
                <th className="text-right py-2 pr-4">Capacity (MW)</th>
                <th className="text-right py-2 pr-4">Age (yrs)</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-right py-2 pr-4">Avg Risk %</th>
                <th className="text-right py-2">Avg Condition</th>
              </tr>
            </thead>
            <tbody>
              {topRiskAssets.map((row, idx) => {
                const assetDeg = data.degradation_records.filter(d => d.asset_id === row.asset?.asset_id)
                const avgCond = assetDeg.length > 0
                  ? Math.round(assetDeg.reduce((s, d) => s + d.condition_score, 0) / assetDeg.length)
                  : '-'
                return (
                  <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="py-2 pr-4 font-medium text-white">{row.name}</td>
                    <td className="py-2 pr-4">{row.asset?.technology ?? '-'}</td>
                    <td className="py-2 pr-4">{row.asset?.region ?? '-'}</td>
                    <td className="py-2 pr-4 text-right">{row.asset?.capacity_mw?.toLocaleString() ?? '-'}</td>
                    <td className="py-2 pr-4 text-right">{row.asset?.current_age_years ?? '-'}</td>
                    <td className="py-2 pr-4">
                      <span
                        className="px-2 py-0.5 rounded text-white text-xs"
                        style={{ backgroundColor: STATUS_COLORS[row.asset?.status ?? ''] ?? '#6b7280' }}
                      >
                        {row.asset?.status ?? '-'}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold" style={{ color: row.avgRisk > 60 ? '#ef4444' : row.avgRisk > 40 ? '#f59e0b' : '#10b981' }}>
                      {row.avgRisk}%
                    </td>
                    <td className="py-2 text-right" style={{ color: (avgCond as number) < 50 ? '#ef4444' : (avgCond as number) < 70 ? '#f59e0b' : '#10b981' }}>
                      {avgCond}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table: Critical Degradation Records (condition < 50) */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Critical Component Degradation (Condition Score &lt; 50)</h2>
        <p className="text-xs text-gray-500 mb-4">{criticalDeg.length} critical records — immediate attention required</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Asset</th>
                <th className="text-left py-2 pr-4">Component</th>
                <th className="text-right py-2 pr-4">Condition</th>
                <th className="text-right py-2 pr-4">Remaining Life (yrs)</th>
                <th className="text-right py-2 pr-4">Failure Prob %</th>
                <th className="text-right py-2 pr-4">Replacement Cost ($M)</th>
                <th className="text-left py-2 pr-4">Last Inspection</th>
                <th className="text-left py-2">Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {criticalDeg.map((rec, idx) => {
                const asset = data.assets.find(a => a.asset_id === rec.asset_id)
                return (
                  <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="py-2 pr-4 text-white font-medium">{asset?.asset_name ?? rec.asset_id}</td>
                    <td className="py-2 pr-4">{rec.component}</td>
                    <td className="py-2 pr-4 text-right font-bold" style={{ color: rec.condition_score < 30 ? '#ef4444' : '#f59e0b' }}>
                      {rec.condition_score.toFixed(1)}
                    </td>
                    <td className="py-2 pr-4 text-right">{rec.remaining_life_years.toFixed(1)}</td>
                    <td className="py-2 pr-4 text-right" style={{ color: rec.failure_probability_pct > 60 ? '#ef4444' : '#f59e0b' }}>
                      {rec.failure_probability_pct.toFixed(1)}%
                    </td>
                    <td className="py-2 pr-4 text-right">${rec.replacement_cost_m.toFixed(1)}M</td>
                    <td className="py-2 pr-4 text-gray-400">{rec.last_inspection_date}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-white text-xs ${
                        rec.recommended_action === 'Retire' ? 'bg-gray-600' :
                        rec.recommended_action === 'Replace' ? 'bg-red-700' :
                        rec.recommended_action === 'Overhaul' ? 'bg-amber-700' :
                        'bg-green-800'
                      }`}>
                        {rec.recommended_action}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Replacement Need Severity Summary */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Reliability Gap &amp; Replacement Need Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.replacement_needs.map((n, idx) => (
            <div key={idx} className="bg-gray-750 rounded-lg p-3 border border-gray-600">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-semibold text-white">{n.region} — {n.timeline_year}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: SEVERITY_COLORS[n.gap_severity] + '33', color: SEVERITY_COLORS[n.gap_severity] }}
                >
                  {n.gap_severity}
                </span>
              </div>
              <p className="text-xs text-gray-400">{n.replacement_technology}</p>
              <div className="mt-1 flex justify-between text-xs">
                <span className="text-gray-500">Retiring: <span className="text-gray-300">{n.retiring_asset_mw.toFixed(0)} MW</span></span>
                <span className="text-gray-500">Replace: <span className="text-gray-300">{n.replacement_capacity_mw.toFixed(0)} MW</span></span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Est. cost: <span className="text-gray-300">${n.estimated_cost_m.toFixed(0)}M</span>
                {n.reliability_gap_mw > 0 && (
                  <span className="ml-2 text-red-400">Gap: {n.reliability_gap_mw.toFixed(0)} MW</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
