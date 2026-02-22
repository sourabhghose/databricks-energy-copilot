import { useEffect, useState } from 'react'
import { Zap, DollarSign, Factory, Cpu } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts'
import {
  getPowerToXEconomicsDashboard,
  P2XEDashboard,
} from '../api/client'

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  colour,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const PRODUCT_COLOURS: Record<string, string> = {
  'Green Hydrogen':       '#3b82f6',
  'Green Ammonia':        '#10b981',
  'E-Methanol':           '#f59e0b',
  'E-Kerosene':           '#8b5cf6',
  'Green Steel DRI-EAF': '#ef4444',
  'E-Methane':            '#06b6d4',
  'Green Ethylene':       '#f97316',
  'Electrofuel Aviation': '#84cc16',
}

const TECH_COLOURS: Record<string, string> = {
  PEM:      '#3b82f6',
  Alkaline: '#10b981',
  SOEC:     '#f59e0b',
  AEM:      '#8b5cf6',
}

const STATUS_COLOURS: Record<string, string> = {
  Development:  '#6b7280',
  FID:          '#f59e0b',
  Construction: '#3b82f6',
  Operating:    '#10b981',
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PowerToXEconomicsAnalytics() {
  const [data, setData] = useState<P2XEDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPowerToXEconomicsDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-pulse">Loading Power-to-X Economics data…</div>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Error: {error ?? 'No data returned'}</div>
      </div>
    )
  }

  const { summary, cost_trajectories, projects, electrolysers, markets, scenarios } = data

  // ── Chart 1: Cost to Parity Gap (2024 vs 2030) ──────────────────────────
  const targetProducts = ['Green Hydrogen', 'Green Ammonia', 'E-Methanol', 'Green Steel DRI-EAF']
  const parityGapData = targetProducts.map((prod) => {
    const c2024 = cost_trajectories.find((c) => c.product === prod && c.year === 2024)
    const c2030 = cost_trajectories.find((c) => c.product === prod && c.year === 2030)
    return {
      product: prod.replace('Green Steel DRI-EAF', 'Green Steel').replace('Green ', 'Grn '),
      'Production Cost 2024': c2024 ? Math.round(c2024.lcox_aud_per_tonne) : 0,
      'Fossil Parity 2024':   c2024 ? Math.round(c2024.fossil_parity_aud_per_tonne) : 0,
      'Production Cost 2030': c2030 ? Math.round(c2030.lcox_aud_per_tonne) : 0,
      'Fossil Parity 2030':   c2030 ? Math.round(c2030.fossil_parity_aud_per_tonne) : 0,
    }
  })

  // ── Chart 2: LCOX Trajectory 2023-2030 ──────────────────────────────────
  const lcoxYears = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]
  const lcoxData = lcoxYears.map((yr) => {
    const row: Record<string, number | string> = { year: yr }
    targetProducts.forEach((prod) => {
      const rec = cost_trajectories.find((c) => c.product === prod && c.year === yr)
      if (rec) row[prod] = Math.round(rec.lcox_aud_per_tonne)
    })
    return row
  })

  // ── Chart 3: Project Pipeline by Status & State ──────────────────────────
  const stateMap: Record<string, Record<string, number>> = {}
  projects.forEach((p) => {
    if (!stateMap[p.state]) stateMap[p.state] = {}
    stateMap[p.state][p.status] = (stateMap[p.state][p.status] ?? 0) + p.electrolyser_mw
  })
  const pipelineData = Object.entries(stateMap).map(([state, statuses]) => ({
    state,
    ...statuses,
  }))
  const allStatuses = ['Development', 'FID', 'Construction', 'Operating']

  // ── Chart 4: Electrolyser Comparison ────────────────────────────────────
  const techGrouped: Record<string, { effSum: number; capexSum: number; count: number }> = {}
  electrolysers.forEach((e) => {
    if (!techGrouped[e.technology]) techGrouped[e.technology] = { effSum: 0, capexSum: 0, count: 0 }
    techGrouped[e.technology].effSum   += e.efficiency_kwh_per_kg_h2
    techGrouped[e.technology].capexSum += e.capex_aud_per_kw
    techGrouped[e.technology].count    += 1
  })
  const electrolyserChartData = Object.entries(techGrouped).map(([tech, v]) => ({
    technology: tech,
    'Avg Efficiency (kWh/kg H2)': Math.round(v.effSum / v.count * 10) / 10,
    'Avg Capex (AUD/kW)':         Math.round(v.capexSum / v.count),
  }))

  // ── Chart 5: Export Market Demand (horizontal) ───────────────────────────
  const marketChartData = [...markets]
    .sort((a, b) => b.projected_2030_mtpa - a.projected_2030_mtpa)
    .slice(0, 12)
    .map((m) => ({
      label: `${m.market} – ${m.product.replace('Green Steel DRI-EAF', 'Grn Steel').replace('Green ', 'Grn ')}`,
      'Projected 2030 Demand (Mtpa)': m.projected_2030_mtpa,
      'Current Demand (Mtpa)':        m.current_demand_mtpa,
    }))

  // ── Chart 6: 2030 Scenario – Green H2 production ────────────────────────
  const h2ScenYears = [2025, 2027, 2030, 2035, 2040]
  const scenarioChartData = h2ScenYears.map((yr) => {
    const base = scenarios.find((s) => s.year === yr && s.scenario === 'Base' && s.product === 'Green Hydrogen')
    const opt  = scenarios.find((s) => s.year === yr && s.scenario === 'Optimistic' && s.product === 'Green Hydrogen')
    return {
      year: yr,
      Base:       base?.australia_production_mtpa ?? 0,
      Optimistic: opt?.australia_production_mtpa  ?? 0,
    }
  })

  return (
    <div className="p-6 space-y-8 text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Zap size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Power-to-X Economics Analytics</h1>
          <p className="text-sm text-gray-400">
            Green hydrogen, ammonia, e-fuels and green steel — production economics, projects and export markets
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Projects"
          value={String(summary.total_projects)}
          sub="Across all states"
          icon={Factory}
          colour="bg-blue-600"
        />
        <KpiCard
          label="Total Electrolyser Capacity"
          value={`${Number(summary.total_electrolyser_capacity_mw).toLocaleString()} MW`}
          sub="Across project pipeline"
          icon={Zap}
          colour="bg-emerald-600"
        />
        <KpiCard
          label="Avg Green H2 Cost"
          value={`AUD $${summary.avg_green_h2_cost_aud_per_kg}/kg`}
          sub="2024 LCOX estimate"
          icon={DollarSign}
          colour="bg-amber-600"
        />
        <KpiCard
          label="Cheapest Electrolyser"
          value={String(summary.cheapest_electrolyser_tech).split('(')[0].trim()}
          sub={`2030 projection`}
          icon={Cpu}
          colour="bg-violet-600"
        />
      </div>

      {/* Chart 1 + Chart 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Cost to Parity Gap */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-base font-semibold mb-4">Cost to Fossil Parity Gap — 2024 vs 2030 (AUD/tonne)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={parityGapData} margin={{ left: 10, right: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="product" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-15} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend wrapperStyle={{ paddingTop: 8 }} />
              <Bar dataKey="Production Cost 2024" fill="#3b82f6" />
              <Bar dataKey="Fossil Parity 2024"   fill="#6b7280" />
              <Bar dataKey="Production Cost 2030" fill="#10b981" />
              <Bar dataKey="Fossil Parity 2030"   fill="#4b5563" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* LCOX Trajectory */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-base font-semibold mb-4">LCOX Trajectory 2023–2030 (AUD/tonne)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lcoxData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend />
              {targetProducts.map((prod) => (
                <Line
                  key={prod}
                  type="monotone"
                  dataKey={prod}
                  stroke={PRODUCT_COLOURS[prod]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 3 + Chart 4 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Project Pipeline */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-base font-semibold mb-4">Project Pipeline by Status and State (Electrolyser MW)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend />
              {allStatuses.map((st) => (
                <Bar key={st} dataKey={st} stackId="a" fill={STATUS_COLOURS[st]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Electrolyser Comparison */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-base font-semibold mb-4">Electrolyser Technology Comparison</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={electrolyserChartData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="technology" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="left"  tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend />
              <Bar yAxisId="left"  dataKey="Avg Efficiency (kWh/kg H2)" fill="#3b82f6" />
              <Bar yAxisId="right" dataKey="Avg Capex (AUD/kW)"         fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-2">
            Left axis: efficiency (lower = better); Right axis: 2024 capex
          </p>
        </div>
      </div>

      {/* Chart 5 + Chart 6 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Export Market Demand */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-base font-semibold mb-4">Top Export Market Demand — Projected 2030 (Mtpa)</h2>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart
              data={marketChartData}
              layout="vertical"
              margin={{ left: 140, right: 20, top: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                width={140}
              />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend />
              <Bar dataKey="Projected 2030 Demand (Mtpa)" fill="#3b82f6" />
              <Bar dataKey="Current Demand (Mtpa)"         fill="#6b7280" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 2030 Scenario — Green H2 */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-base font-semibold mb-4">Green H2 Production Scenarios — Australia (Mtpa)</h2>
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={scenarioChartData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend />
              <Line
                type="monotone"
                dataKey="Base"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="Optimistic"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Electrolyser technology detail table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold mb-4">Electrolyser Technology — Key Metrics</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">Technology</th>
                <th className="pb-2 pr-4">Efficiency (kWh/kg H2)</th>
                <th className="pb-2 pr-4">Lifetime (yr)</th>
                <th className="pb-2 pr-4">Capex 2024 (AUD/kW)</th>
                <th className="pb-2 pr-4">Capex 2030 (AUD/kW)</th>
                <th className="pb-2">Degradation (%/yr)</th>
              </tr>
            </thead>
            <tbody>
              {electrolyserChartData.map((row) => {
                const recs = electrolysers.filter((e) => e.technology === row.technology)
                const avg = (fn: (e: typeof recs[0]) => number) =>
                  Math.round(recs.reduce((s, e) => s + fn(e), 0) / recs.length * 10) / 10
                return (
                  <tr
                    key={row.technology}
                    className="border-b border-gray-700 hover:bg-gray-750"
                  >
                    <td
                      className="py-2 pr-4 font-medium"
                      style={{ color: TECH_COLOURS[row.technology] ?? '#fff' }}
                    >
                      {row.technology}
                    </td>
                    <td className="py-2 pr-4 text-gray-300">{avg((e) => e.efficiency_kwh_per_kg_h2)}</td>
                    <td className="py-2 pr-4 text-gray-300">{avg((e) => e.lifetime_years)}</td>
                    <td className="py-2 pr-4 text-gray-300">{avg((e) => e.capex_aud_per_kw).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-gray-300">{avg((e) => e.capex_2030_projection).toLocaleString()}</td>
                    <td className="py-2 text-gray-300">{avg((e) => e.degradation_rate_pct_year)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
