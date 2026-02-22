import { useEffect, useState } from 'react'
import { Battery, DollarSign, Zap, RefreshCw } from 'lucide-react'
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
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts'
import {
  getEnergyStorageTechComparisonDashboard,
  ESTCDashboard,
  ESTCTechnologyRecord,
  ESTCCostRecord,
  ESTCPerformanceRecord,
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

// Colour palette for tech lines/bars
const TECH_COLOURS: Record<string, string> = {
  'Li-ion NMC':    '#3b82f6',
  'LFP':           '#10b981',
  'Vanadium Flow': '#f59e0b',
  'Sodium-ion':    '#8b5cf6',
  'Zinc-Bromine':  '#ef4444',
  'Lead-Acid':     '#6b7280',
  'Compressed Air':'#06b6d4',
  'Flywheel':      '#f97316',
  'Hydrogen LDES': '#84cc16',
  'Gravity Storage':'#e879f9',
  'Liquid Air':    '#67e8f9',
  'Thermal Storage':'#fbbf24',
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function EnergyStorageTechComparisonAnalytics() {
  const [data, setData] = useState<ESTCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyStorageTechComparisonDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <div className="text-gray-400 animate-pulse text-sm">Loading energy storage technology data…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <div className="text-red-400 text-sm">Error: {error ?? 'No data returned'}</div>
      </div>
    )
  }

  const { technologies, cost_trajectories, applications, market_evolution, performance, projections, summary } = data

  // ── Chart 1: Technology Capability — grouped bar for top 6 techs ──────────
  const TOP6_TECHS = ['Li-ion NMC', 'LFP', 'Vanadium Flow', 'Sodium-ion', 'Compressed Air', 'Flywheel']
  const MAX_CYCLE = Math.max(...technologies.map(t => t.cycle_life > 100000 ? 100000 : t.cycle_life))
  const capabilityData = TOP6_TECHS.map(tech => {
    const rec = technologies.find(t => t.technology === tech)
    if (!rec) return { tech }
    const cycleNorm = Math.min(rec.cycle_life, 100000) / MAX_CYCLE * 100
    return {
      tech: tech.replace(' ', '\n'),
      'RTE (%)': rec.round_trip_efficiency_pct,
      'Cycle Life (norm%)': Math.round(cycleNorm),
      'Energy Density (Wh/kg)': Math.min(rec.energy_density_wh_kg, 100), // cap for readability
    }
  })

  // ── Chart 2: Cost Trajectory — capex_kwh 2020-2024 for 4 techs ───────────
  const COST_TECHS = ['LFP', 'Li-ion NMC', 'Vanadium Flow', 'Sodium-ion']
  const costByYear: Record<number, Record<string, number>> = {}
  cost_trajectories.forEach((c: ESTCCostRecord) => {
    if (!COST_TECHS.includes(c.technology)) return
    if (!costByYear[c.year]) costByYear[c.year] = { year: c.year }
    costByYear[c.year][c.technology] = c.capex_kwh
  })
  const costChartData = Object.values(costByYear).sort((a, b) => (a.year as number) - (b.year as number))

  // ── Chart 3: Application Suitability — horizontal bar by application ──────
  const TOP3_TECHS = ['LFP', 'Li-ion NMC', 'Vanadium Flow']
  const appNames = [...new Set(applications.map(a => a.application))]
  const appChartData = appNames.map(app => {
    const row: Record<string, string | number> = { application: app.length > 22 ? app.slice(0, 22) + '…' : app }
    TOP3_TECHS.forEach(tech => {
      const rec = applications.find(a => a.application === app && a.technology === tech)
      row[tech] = rec ? rec.suitability_score : 0
    })
    return row
  })

  // ── Chart 4: Market Evolution — cumulative_aus_mwh by month ──────────────
  const marketChartData = market_evolution.map(m => ({
    month: m.date_month,
    'Cumulative (MWh)': m.cumulative_aus_mwh,
    'Market Value ($M)': m.market_value_m,
  }))

  // ── Chart 5: Top 10 deployments by installed_mwh ─────────────────────────
  const top10Perf = [...performance]
    .sort((a: ESTCPerformanceRecord, b: ESTCPerformanceRecord) => b.installed_mwh - a.installed_mwh)
    .slice(0, 10)

  // ── Chart 6: 2030 Projections by scenario ─────────────────────────────────
  const projScenarios = ['Base', 'Accelerated', 'Conservative']
  const projByYear: Record<number, Record<string, number>> = {}
  projections.forEach(p => {
    if (!projByYear[p.year]) projByYear[p.year] = { year: p.year }
    projByYear[p.year][p.scenario] = p.projected_aus_gwh
  })
  const projChartData = Object.values(projByYear).sort((a, b) => (a.year as number) - (b.year as number))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Battery size={28} className="text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold">Energy Storage Technology Comparison</h1>
          <p className="text-sm text-gray-400">Australian market analytics — technology, cost, application & deployment</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Technologies Tracked"
          value={String(summary.total_technologies ?? 0)}
          sub="Across maturity levels"
          icon={Battery}
          colour="bg-emerald-700"
        />
        <KpiCard
          label="Avg Round-Trip Efficiency"
          value={`${summary.avg_round_trip_efficiency ?? 0}%`}
          sub="Across all tracked techs"
          icon={Zap}
          colour="bg-blue-700"
        />
        <KpiCard
          label="Lowest CapEx/kWh Tech"
          value={String(summary.lowest_capex_kwh_tech ?? '—')}
          sub="2024 pricing"
          icon={DollarSign}
          colour="bg-amber-700"
        />
        <KpiCard
          label="Highest Cycle Life Tech"
          value={String(summary.highest_cycle_life_tech ?? '—')}
          sub="Rated cycle life"
          icon={RefreshCw}
          colour="bg-violet-700"
        />
      </div>

      {/* Chart 1: Technology Capability (Grouped Bar) */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-white mb-4">Technology Capability — Top 6 Technologies</h2>
        <p className="text-xs text-gray-500 mb-3">RTE (%), Cycle Life (normalised to 100k cycles, %), Energy Density (Wh/kg, capped at 100 for scale)</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={capabilityData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="tech" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
            <Bar dataKey="RTE (%)" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Cycle Life (norm%)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Energy Density (Wh/kg)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Cost Trajectory */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-white mb-4">CapEx Trajectory 2020–2024 (AUD/kWh)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={costChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
            {COST_TECHS.map(tech => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                stroke={TECH_COLOURS[tech] ?? '#9ca3af'}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Application Suitability */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-white mb-4">Application Suitability Score (1–10) — Top 3 Technologies</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={appChartData}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" domain={[0, 10]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis type="category" dataKey="application" tick={{ fill: '#9ca3af', fontSize: 10 }} width={148} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
            {TOP3_TECHS.map(tech => (
              <Bar key={tech} dataKey={tech} fill={TECH_COLOURS[tech] ?? '#9ca3af'} radius={[0, 3, 3, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Market Evolution */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-white mb-4">Australian Storage Market Evolution — Cumulative Deployed (MWh)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={marketChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="gradMwh" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={3} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MWh" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
            <Area
              type="monotone"
              dataKey="Cumulative (MWh)"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gradMwh)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Australian Deployments Table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow overflow-x-auto">
        <h2 className="text-base font-semibold text-white mb-4">Top 10 Australian Deployments by Installed Capacity (MWh)</h2>
        <table className="min-w-full text-sm text-left">
          <thead>
            <tr className="text-gray-400 uppercase text-xs border-b border-gray-700">
              <th className="pb-2 pr-4">Project</th>
              <th className="pb-2 pr-4">Technology</th>
              <th className="pb-2 pr-4">State</th>
              <th className="pb-2 pr-4 text-right">MWh</th>
              <th className="pb-2 pr-4 text-right">MW</th>
              <th className="pb-2 pr-4 text-right">RTE %</th>
              <th className="pb-2 pr-4 text-right">Avail %</th>
              <th className="pb-2 pr-4 text-right">Deg %/yr</th>
              <th className="pb-2">Primary Use Case</th>
            </tr>
          </thead>
          <tbody>
            {top10Perf.map((p: ESTCPerformanceRecord) => (
              <tr key={p.project_id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-4 text-gray-300 font-mono text-xs">{p.project_id}</td>
                <td className="py-2 pr-4 text-emerald-400">{p.technology}</td>
                <td className="py-2 pr-4 text-gray-300">{p.location}</td>
                <td className="py-2 pr-4 text-right text-blue-300">{p.installed_mwh.toFixed(0)}</td>
                <td className="py-2 pr-4 text-right text-gray-300">{p.installed_mw.toFixed(0)}</td>
                <td className="py-2 pr-4 text-right text-green-400">{p.actual_rte_pct.toFixed(1)}</td>
                <td className="py-2 pr-4 text-right text-gray-300">{p.availability_pct.toFixed(1)}</td>
                <td className="py-2 pr-4 text-right text-amber-400">{p.degradation_rate_pct_year.toFixed(1)}</td>
                <td className="py-2 text-gray-400 text-xs">{p.primary_use_case}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart 6: 2030 Projections */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-white mb-4">Australian Storage Projections 2025–2034 (GWh) — Three Scenarios</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={projChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" GWh" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
            <Line type="monotone" dataKey="Base"         stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="Accelerated"  stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 2" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Conservative" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-600 text-center pb-2">
        Sprint 107c — Energy Storage Technology Comparison Analytics (ESTC) — Australian NEM focus
      </div>
    </div>
  )
}
