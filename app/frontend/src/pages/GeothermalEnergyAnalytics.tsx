import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Thermometer } from 'lucide-react'
import {
  getGeothermalEnergyPotentialDashboard,
  GEPADashboard,
} from '../api/client'

// ── colour palette ──────────────────────────────────────────────────────────
const RESOURCE_TYPE_COLOURS: Record<string, string> = {
  'Hot Dry Rock':           '#ef4444',
  'Hot Sedimentary Aquifer': '#3b82f6',
  'Magma':                  '#f59e0b',
  'Direct Use':             '#10b981',
}

const STATUS_COLOURS: Record<string, string> = {
  Concept:      '#64748b',
  Exploration:  '#3b82f6',
  Feasibility:  '#f59e0b',
  Pilot:        '#10b981',
  Cancelled:    '#ef4444',
}

const SCENARIO_COLOURS: Record<string, string> = {
  Base:       '#6366f1',
  Optimistic: '#22c55e',
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── custom bar colour renderer ────────────────────────────────────────────────
function ColourCell({ fill }: { fill: string }) {
  return <rect fill={fill} />
}
ColourCell

// ── main component ───────────────────────────────────────────────────────────
export default function GeothermalEnergyAnalytics() {
  const [data, setData] = useState<GEPADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGeothermalEnergyPotentialDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <p className="text-gray-400 animate-pulse">Loading Geothermal Energy Potential Analytics…</p>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <p className="text-red-400">Failed to load data: {error}</p>
      </div>
    )
  }

  const { resources, projects, technologies, cost_curves, summary } = data

  // ── Chart 1: resource potential capacity by resource_type ─────────────────
  const resourceCapData = resources.map(r => ({
    name: r.resource_name.replace(' Basin', '').replace(' Geothermal', ''),
    potential_capacity_mw: r.potential_capacity_mw,
    resource_type: r.resource_type,
    fill: RESOURCE_TYPE_COLOURS[r.resource_type] ?? '#94a3b8',
  }))

  // ── Chart 2: project LCOE sorted ascending ────────────────────────────────
  const lcoeData = [...projects]
    .sort((a, b) => a.lcoe_per_mwh - b.lcoe_per_mwh)
    .map(p => ({
      name: p.project_name.split(' ').slice(0, 2).join(' '),
      lcoe_per_mwh: p.lcoe_per_mwh,
      status: p.status,
      fill: STATUS_COLOURS[p.status] ?? '#94a3b8',
    }))

  // ── Chart 3: EGS LCOE cost curve Base vs Optimistic ───────────────────────
  const egsCurveByYear: Record<number, Record<string, number>> = {}
  cost_curves
    .filter(c => c.technology_type === 'EGS')
    .forEach(c => {
      if (!egsCurveByYear[c.year]) egsCurveByYear[c.year] = { year: c.year }
      egsCurveByYear[c.year][c.scenario] = c.lcoe_per_mwh
    })
  const egsCurveData = Object.values(egsCurveByYear).sort((a, b) => (a.year as number) - (b.year as number))

  // ── Chart 4: technology capacity factor vs coal/gas ───────────────────────
  // group technologies by type, average CF
  const cfByType: Record<string, { sum: number; count: number }> = {}
  technologies.forEach(t => {
    if (!cfByType[t.technology_type]) cfByType[t.technology_type] = { sum: 0, count: 0 }
    cfByType[t.technology_type].sum += t.capacity_factor_pct
    cfByType[t.technology_type].count += 1
  })
  const cfData = [
    ...Object.entries(cfByType).map(([type, v]) => ({
      name: type,
      capacity_factor_pct: Math.round((v.sum / v.count) * 10) / 10,
      fill: '#6366f1',
    })),
    { name: 'Coal', capacity_factor_pct: 85.0, fill: '#374151' },
    { name: 'Gas Peaker', capacity_factor_pct: 25.0, fill: '#f59e0b' },
  ]

  // ── Chart 5: resource temperature_c grouped by state ─────────────────────
  const tempByState = resources.map(r => ({
    name: r.resource_name.split(' ').slice(0, 2).join(' '),
    temperature_c: r.temperature_c,
    gradient_c_per_km: r.gradient_c_per_km,
    state: r.state,
  }))

  return (
    <div className="p-6 bg-gray-900 min-h-full text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-600 rounded-lg">
          <Thermometer size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Geothermal Energy Potential Analytics</h1>
          <p className="text-sm text-gray-400">Australian geothermal resources, projects, technologies and cost outlook</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard
          label="Total Potential Capacity"
          value={`${(summary.total_potential_capacity_mw / 1000).toFixed(1)} GW`}
          sub="across all basins"
        />
        <KPICard
          label="Active Projects"
          value={String(summary.active_projects)}
          sub="Exploration / Feasibility / Pilot"
        />
        <KPICard
          label="Avg Gradient"
          value={`${summary.avg_gradient_c_per_km} °C/km`}
          sub="resource average"
        />
        <KPICard
          label="Lowest LCOE"
          value={`$${summary.lowest_lcoe_per_mwh}/MWh`}
          sub={`Best basin: ${summary.best_resource_basin.split(' ').slice(0, 2).join(' ')}`}
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 1: Resource Potential Capacity */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">
            Resource Potential Capacity (MW) by Type
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={resourceCapData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Bar dataKey="potential_capacity_mw" name="Potential Capacity (MW)" radius={[4, 4, 0, 0]}>
                {resourceCapData.map((entry, idx) => (
                  <rect key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.entries(RESOURCE_TYPE_COLOURS).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: v }} />
                {k}
              </span>
            ))}
          </div>
        </div>

        {/* Chart 2: Project LCOE sorted ascending */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">
            Project LCOE ($/MWh) — Ascending by Status
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={lcoeData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 320]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Bar dataKey="lcoe_per_mwh" name="LCOE ($/MWh)" radius={[4, 4, 0, 0]}>
                {lcoeData.map((entry, idx) => (
                  <rect key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.entries(STATUS_COLOURS).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: v }} />
                {k}
              </span>
            ))}
          </div>
        </div>

        {/* Chart 3: EGS LCOE Cost Curve 2025-2045 */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">
            EGS LCOE Cost Curve 2025–2045 (Base vs Optimistic)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={egsCurveData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {Object.entries(SCENARIO_COLOURS).map(([scenario, colour]) => (
                <Line
                  key={scenario}
                  type="monotone"
                  dataKey={scenario}
                  stroke={colour}
                  strokeWidth={2}
                  dot={{ r: 4, fill: colour }}
                  name={`${scenario} LCOE ($/MWh)`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Technology Capacity Factor vs Coal/Gas */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">
            Capacity Factor (%) — Geothermal Tech vs Coal &amp; Gas
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cfData} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-25}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Bar dataKey="capacity_factor_pct" name="Capacity Factor (%)" radius={[4, 4, 0, 0]}>
                {cfData.map((entry, idx) => (
                  <rect key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 5: Resource Temperature & Gradient grouped bar by state */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">
            Resource Temperature (°C) &amp; Gradient (°C/km) by Basin
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tempByState} margin={{ top: 5, right: 20, left: 10, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 400]} label={{ value: '°C', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 50]} label={{ value: '°C/km', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="temperature_c" name="Temperature (°C)" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="gradient_c_per_km" name="Gradient (°C/km)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Footer info */}
      <p className="mt-6 text-xs text-gray-600 text-center">
        Synthetic data for demonstration — based on Australian geothermal research. Sprint 141b GEPA.
      </p>
    </div>
  )
}
