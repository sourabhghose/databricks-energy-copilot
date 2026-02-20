// Sprint 58b — Climate Physical Risk to Grid Assets

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Thermometer } from 'lucide-react'
import { getClimatePhysicalRiskDashboard, ClimatePhysicalRiskDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const ASSET_TYPE_COLOURS: Record<string, string> = {
  TRANSMISSION_LINE: '#60a5fa',
  SUBSTATION:        '#f87171',
  GENERATION:        '#fbbf24',
  DISTRIBUTION:      '#34d399',
  STORAGE:           '#a78bfa',
}

const HAZARD_COLOURS: Record<string, string> = {
  EXTREME_HEAT:   '#f97316',
  FLOODING:       '#38bdf8',
  BUSHFIRE:       '#ef4444',
  CYCLONE:        '#a78bfa',
  SEA_LEVEL_RISE: '#2dd4bf',
  DROUGHT:        '#d97706',
}

const ADAPTATION_STATUS_STYLE: Record<string, string> = {
  NO_ACTION:   'bg-red-900 text-red-300 border border-red-700',
  PLANNING:    'bg-amber-900 text-amber-300 border border-amber-700',
  IN_PROGRESS: 'bg-blue-900 text-blue-300 border border-blue-700',
  COMPLETE:    'bg-green-900 text-green-300 border border-green-700',
}

const PRIORITY_STYLE: Record<string, string> = {
  HIGH:   'bg-red-900 text-red-300 border border-red-700',
  MEDIUM: 'bg-amber-900 text-amber-300 border border-amber-700',
  LOW:    'bg-slate-700 text-slate-300 border border-slate-600',
}

// ---------------------------------------------------------------------------
// Helper: format number
// ---------------------------------------------------------------------------
function fmt(n: number, dp = 1): string {
  return n.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

// ---------------------------------------------------------------------------
// Custom tooltip: Risk Matrix
// ---------------------------------------------------------------------------
function RiskMatrixTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-800 border border-gray-600 rounded p-3 text-xs text-gray-200 shadow-lg">
      <p className="font-semibold text-white mb-1">{d.asset_name}</p>
      <p>Type: <span className="text-sky-300">{d.asset_type}</span></p>
      <p>Region: <span className="text-amber-300">{d.region}</span></p>
      <p>Exposure: <span className="text-red-300">{fmt(d.exposure_score)}</span></p>
      <p>Vulnerability: <span className="text-orange-300">{fmt(d.vulnerability_score)}</span></p>
      <p>Risk Score: <span className="text-pink-300">{fmt(d.risk_score)}</span></p>
      <p>Value: <span className="text-green-300">A${fmt(d.value_m_aud)} M</span></p>
      <p>Primary Hazard: <span className="text-purple-300">{d.primary_hazard}</span></p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom tooltip: Event Damage
// ---------------------------------------------------------------------------
function EventTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded p-3 text-xs text-gray-200 shadow-lg">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey}>
          <span style={{ color: p.color }}>{p.name}</span>: {fmt(p.value)}
          {p.dataKey === 'damage_m_aud' ? ' M AUD' : ' hrs'}
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClimatePhysicalRisk() {
  const [data, setData] = useState<ClimatePhysicalRiskDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getClimatePhysicalRiskDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <span className="animate-pulse">Loading Climate Physical Risk data…</span>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error loading data: {error}
      </div>
    )
  }

  // ── Derived KPIs ──────────────────────────────────────────────────────────
  const totalExposedValue = data.assets.reduce((s, a) => s + a.value_m_aud, 0)
  const highestRiskAsset = [...data.assets].sort((a, b) => b.risk_score - a.risk_score)[0]
  const totalEventDamage = data.climate_events.reduce((s, e) => s + e.damage_m_aud, 0)
  const adaptationInProgress = data.adaptation_measures.filter(m => m.priority === 'HIGH').length

  // ── Scatter data ──────────────────────────────────────────────────────────
  const scatterByType: Record<string, typeof data.assets> = {}
  for (const a of data.assets) {
    if (!scatterByType[a.asset_type]) scatterByType[a.asset_type] = []
    scatterByType[a.asset_type].push(a)
  }

  // ── Hazard projection line data (RCP8.5 only) ────────────────────────────
  const rcp85 = data.hazard_projections.filter(h => h.scenario === 'RCP85')
  const hazardSet = [...new Set(rcp85.map(h => h.hazard))]
  const years = ['2030', '2050', '2070']
  const lineData = years.map(yr => {
    const row: Record<string, string | number> = { year: yr }
    for (const haz of hazardSet) {
      // average across regions for that hazard
      const recs = rcp85.filter(h => h.hazard === haz)
      const key = `year_${yr}_change_pct` as keyof typeof recs[0]
      const avg = recs.reduce((s, r) => s + (r[key] as number), 0) / recs.length
      row[haz] = Math.round(avg * 10) / 10
    }
    return row
  })

  // ── Event bar data (sorted by damage) ────────────────────────────────────
  const sortedEvents = [...data.climate_events].sort((a, b) => b.damage_m_aud - a.damage_m_aud)
  const eventBarData = sortedEvents.map(e => ({
    name: `${e.event_type} (${e.region} ${e.date.slice(0, 7)})`,
    damage_m_aud: e.damage_m_aud,
    outage_hours: e.outage_hours,
  }))

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Thermometer className="text-orange-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Climate Physical Risk — Grid Assets</h1>
          <p className="text-sm text-gray-400">
            Extreme heat, flooding, bushfire, cyclone and sea-level-rise exposure for transmission,
            distribution and generation infrastructure
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Exposed Asset Value</p>
          <p className="text-2xl font-bold text-sky-300 mt-1">A${fmt(totalExposedValue / 1000, 1)}B</p>
          <p className="text-xs text-gray-500 mt-1">{data.assets.length} assets assessed</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Highest Risk Asset</p>
          <p className="text-lg font-bold text-red-300 mt-1 leading-tight">{highestRiskAsset.asset_name}</p>
          <p className="text-xs text-gray-500 mt-1">Risk score: {fmt(highestRiskAsset.risk_score)}/100</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Climate Event Damage</p>
          <p className="text-2xl font-bold text-amber-300 mt-1">A${fmt(totalEventDamage)} M</p>
          <p className="text-xs text-gray-500 mt-1">{data.climate_events.length} events recorded</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">High-Priority Adaptations</p>
          <p className="text-2xl font-bold text-green-300 mt-1">{adaptationInProgress}</p>
          <p className="text-xs text-gray-500 mt-1">of {data.adaptation_measures.length} measures</p>
        </div>
      </div>

      {/* Row: Risk Matrix + Hazard Projections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Risk Matrix Scatter */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">
            Asset Risk Matrix — Exposure vs Vulnerability
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                dataKey="exposure_score"
                name="Exposure"
                domain={[0, 100]}
                label={{ value: 'Exposure Score', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 11 }}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="vulnerability_score"
                name="Vulnerability"
                domain={[0, 100]}
                label={{ value: 'Vulnerability Score', angle: -90, position: 'insideLeft', offset: 15, fill: '#9ca3af', fontSize: 11 }}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
              />
              <ZAxis type="number" dataKey="value_m_aud" range={[40, 600]} name="Value M AUD" />
              <Tooltip content={<RiskMatrixTooltip />} />
              <Legend
                formatter={(v) => <span style={{ color: ASSET_TYPE_COLOURS[v] || '#ccc', fontSize: 11 }}>{v}</span>}
              />
              {Object.entries(scatterByType).map(([type, pts]) => (
                <Scatter key={type} name={type} data={pts} fill={ASSET_TYPE_COLOURS[type] || '#888'} fillOpacity={0.8} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Hazard Projection Line Chart */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">
            Hazard Frequency Change (RCP8.5 Scenario)
          </h2>
          <p className="text-xs text-gray-500 mb-4">Average % change in hazard frequency vs baseline — averaged across regions</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                tickFormatter={v => `${v}%`}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                label={{ value: '% Change', angle: -90, position: 'insideLeft', offset: 15, fill: '#9ca3af', fontSize: 11 }}
              />
              <Tooltip
                formatter={(v: number, name: string) => [`${fmt(v)}%`, name]}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend formatter={(v) => <span style={{ color: HAZARD_COLOURS[v] || '#ccc', fontSize: 11 }}>{v}</span>} />
              {hazardSet.map(haz => (
                <Line
                  key={haz}
                  type="monotone"
                  dataKey={haz}
                  stroke={HAZARD_COLOURS[haz] || '#888'}
                  strokeWidth={2}
                  dot={{ fill: HAZARD_COLOURS[haz] || '#888', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Climate Event Damage Bar Chart */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Climate Event Damage — Sorted by Impact (M AUD)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={eventBarData}
            margin={{ top: 10, right: 60, bottom: 80, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 9 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              label={{ value: 'Damage (M AUD)', angle: -90, position: 'insideLeft', offset: 15, fill: '#9ca3af', fontSize: 11 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              label={{ value: 'Outage (hrs)', angle: 90, position: 'insideRight', offset: 10, fill: '#9ca3af', fontSize: 11 }}
            />
            <Tooltip content={<EventTooltip />} />
            <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="damage_m_aud" name="Damage M AUD" radius={[3, 3, 0, 0]}>
              {eventBarData.map((e, i) => (
                <Cell key={i} fill={HAZARD_COLOURS[e.name.split(' ')[0]] || '#60a5fa'} />
              ))}
            </Bar>
            <Bar yAxisId="right" dataKey="outage_hours" name="Outage Hours" fill="#94a3b8" radius={[3, 3, 0, 0]} fillOpacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Adaptation Measures Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Adaptation Measures</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left pb-2 pr-4 font-medium">Measure</th>
                <th className="text-left pb-2 pr-4 font-medium">Asset Type</th>
                <th className="text-right pb-2 pr-4 font-medium">Cost (M AUD)</th>
                <th className="text-right pb-2 pr-4 font-medium">Risk Reduction</th>
                <th className="text-right pb-2 pr-4 font-medium">Years</th>
                <th className="text-right pb-2 pr-4 font-medium">BCR</th>
                <th className="text-center pb-2 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody>
              {[...data.adaptation_measures]
                .sort((a, b) => {
                  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
                  return (order[a.priority as keyof typeof order] ?? 3) - (order[b.priority as keyof typeof order] ?? 3)
                })
                .map((m, i) => (
                  <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="py-2 pr-4 text-gray-200 max-w-xs">{m.measure}</td>
                    <td className="py-2 pr-4">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: (ASSET_TYPE_COLOURS[m.asset_type] || '#888') + '33', color: ASSET_TYPE_COLOURS[m.asset_type] || '#ccc' }}
                      >
                        {m.asset_type}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-amber-300">{fmt(m.cost_m_aud)}</td>
                    <td className="py-2 pr-4 text-right text-green-300">{fmt(m.risk_reduction_pct)}%</td>
                    <td className="py-2 pr-4 text-right">{m.implementation_years}</td>
                    <td className="py-2 pr-4 text-right text-sky-300">{fmt(m.benefit_cost_ratio, 1)}x</td>
                    <td className="py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_STYLE[m.priority] || ''}`}>
                        {m.priority}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
