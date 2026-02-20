import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { GitMerge, AlertTriangle, DollarSign, Zap } from 'lucide-react'
import { getRenewableIntegrationCostDashboard, RenewableIntegrationCostDashboard } from '../api/client'

// ---- colour palette ----
const COMPONENT_COLORS: Record<string, string> = {
  NETWORK_AUGMENTATION: '#6366f1',
  FIRMING_CAPACITY:     '#f59e0b',
  FCAS_MARKETS:         '#10b981',
  CURTAILMENT_COST:     '#ef4444',
  SYSTEM_RESTART:       '#8b5cf6',
  INERTIA_SERVICES:     '#06b6d4',
}

const TECH_COLORS: Record<string, string> = {
  'Large Solar': '#f59e0b',
  'Wind':        '#6366f1',
  'Rooftop PV':  '#10b981',
}

const TREND_BADGE: Record<string, string> = {
  RISING:  'bg-red-900/60 text-red-300 border border-red-700',
  STABLE:  'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
  FALLING: 'bg-green-900/60 text-green-300 border border-green-700',
}

const SERVICE_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#06b6d4']

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// ---- derived data builders ----
function buildAreaData(data: RenewableIntegrationCostDashboard) {
  const years = [...new Set(data.cost_components.map(r => r.year))].sort()
  return years.map(year => {
    const row: Record<string, number | string> = { year }
    data.cost_components
      .filter(r => r.year === year)
      .forEach(r => { row[r.cost_component] = r.cost_m_aud })
    return row
  })
}

function buildCurtailmentData(data: RenewableIntegrationCostDashboard) {
  const years = [...new Set(data.curtailment.map(r => r.year))].sort()
  return years.map(year => {
    const row: Record<string, number | string> = { year }
    data.curtailment
      .filter(r => r.year === year)
      .forEach(r => {
        const key = r.technology
        row[key] = ((row[key] as number) || 0) + r.curtailed_gwh
      })
    return row
  })
}

// ---- component ----
export default function RenewableIntegrationCost() {
  const [dashboard, setDashboard] = useState<RenewableIntegrationCostDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getRenewableIntegrationCostDashboard()
      .then(d => { setDashboard(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading Renewable Integration Cost data...
      </div>
    )
  }
  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error || 'No data'}
      </div>
    )
  }

  // ---- KPI derivations ----
  const costs2024 = dashboard.cost_components.filter(r => r.year === 2024)
  const totalCost2024 = costs2024.reduce((s, r) => s + r.cost_m_aud, 0)
  const highestComp2024 = costs2024.reduce((a, b) => a.cost_m_aud > b.cost_m_aud ? a : b)
  const highestCompLabel = highestComp2024.cost_component.replace(/_/g, ' ')
  const totalCurtailmentGwh = dashboard.curtailment
    .filter(r => r.year === 2024)
    .reduce((s, r) => s + r.curtailed_gwh, 0)
  const networkPipeline = dashboard.network_augs.reduce((s, r) => s + r.investment_m_aud, 0)

  const areaData       = buildAreaData(dashboard)
  const curtailData    = buildCurtailmentData(dashboard)
  const technologies   = [...new Set(dashboard.curtailment.map(r => r.technology))]

  return (
    <div className="p-6 space-y-8 text-slate-100 min-h-screen bg-slate-900">

      {/* Header */}
      <div className="flex items-center gap-3">
        <GitMerge className="w-7 h-7 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Renewable Integration Cost Analytics</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            System costs of high VRE penetration — firming, network augmentation, FCAS, and curtailment
          </p>
        </div>
        <span className="ml-auto text-xs text-slate-500">
          Updated {new Date(dashboard.timestamp).toLocaleString('en-AU')}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<DollarSign className="w-5 h-5 text-indigo-400" />}
          label="Total Integration Cost 2024"
          value={`$${fmt(totalCost2024)} M`}
          sub="All components combined"
          colour="indigo"
        />
        <KpiCard
          icon={<Zap className="w-5 h-5 text-amber-400" />}
          label="Highest Cost Component"
          value={highestCompLabel}
          sub={`$${fmt(highestComp2024.cost_m_aud)} M in 2024`}
          colour="amber"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          label="Total Curtailment 2024"
          value={`${fmt(totalCurtailmentGwh)} GWh`}
          sub="Across all technologies & regions"
          colour="red"
        />
        <KpiCard
          icon={<GitMerge className="w-5 h-5 text-emerald-400" />}
          label="Network Augmentation Pipeline"
          value={`$${fmt(networkPipeline)} M`}
          sub={`${dashboard.network_augs.length} major projects`}
          colour="emerald"
        />
      </div>

      {/* Stacked Area Chart — Integration Cost Components by Year */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Integration Cost Components by Year (M AUD)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={areaData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} unit=" M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [`$${fmt(v)} M`, name.replace(/_/g, ' ')]}
            />
            <Legend formatter={(v: string) => v.replace(/_/g, ' ')} />
            {Object.entries(COMPONENT_COLORS).map(([key, color]) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId="1"
                stroke={color}
                fill={color}
                fillOpacity={0.75}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Network Augmentation Table */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Network Augmentation Projects
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-2 pr-4">Project</th>
                <th className="text-left py-2 pr-4">Region</th>
                <th className="text-right py-2 pr-4">Investment (M AUD)</th>
                <th className="text-right py-2 pr-4">VRE Enabled (MW)</th>
                <th className="text-right py-2 pr-4">Cost / MW (k AUD)</th>
                <th className="text-right py-2 pr-4">Commissioning</th>
                <th className="text-right py-2">BCR</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.network_augs.map((p, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="py-2 pr-4 text-white font-medium">{p.project_name}</td>
                  <td className="py-2 pr-4">
                    <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs">{p.region}</span>
                  </td>
                  <td className="py-2 pr-4 text-right text-indigo-300">${fmt(p.investment_m_aud)}</td>
                  <td className="py-2 pr-4 text-right text-amber-300">{fmt(p.vre_enabled_mw)}</td>
                  <td className="py-2 pr-4 text-right text-slate-300">{fmt(p.cost_per_mw_k_aud, 1)}</td>
                  <td className="py-2 pr-4 text-right text-slate-300">{p.commissioning_year}</td>
                  <td className="py-2 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      p.benefit_cost_ratio >= 3 ? 'bg-green-900/60 text-green-300' :
                      p.benefit_cost_ratio >= 2 ? 'bg-blue-900/60 text-blue-300' :
                      'bg-yellow-900/60 text-yellow-300'
                    }`}>
                      {p.benefit_cost_ratio.toFixed(1)}x
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Curtailment Stacked Bar Chart */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Curtailment by Technology by Year (GWh)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={curtailData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} unit=" GWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [`${fmt(v, 0)} GWh`, name]}
            />
            <Legend />
            {technologies.map(tech => (
              <Bar key={tech} dataKey={tech} stackId="a" fill={TECH_COLORS[tech] || '#94a3b8'} radius={0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* System Services */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          System Services Annual Cost (M AUD)
        </h2>
        <div className="grid gap-3">
          {dashboard.system_services.map((s, i) => {
            const maxCost = Math.max(...dashboard.system_services.map(x => x.annual_cost_m_aud))
            const barPct  = (s.annual_cost_m_aud / maxCost) * 100
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">
                      {s.service.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TREND_BADGE[s.cost_trend]}`}>
                      {s.cost_trend}
                    </span>
                    <span className="text-slate-500 text-xs">{s.providers} providers</span>
                  </div>
                  <span className="text-white font-semibold">${fmt(s.annual_cost_m_aud)} M</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${barPct}%`, backgroundColor: SERVICE_COLORS[i] }}
                  />
                </div>
                <p className="text-slate-500 text-xs">{s.vre_correlation}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cost per MWh VRE table */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Integration Cost Intensity (AUD/MWh of VRE) — 2024
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {costs2024.map((r, i) => (
            <div key={i} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600 text-center">
              <div
                className="text-lg font-bold"
                style={{ color: COMPONENT_COLORS[r.cost_component] || '#94a3b8' }}
              >
                ${r.cost_aud_mwh_vre.toFixed(1)}
              </div>
              <div className="text-xs text-slate-400 mt-1 leading-tight">
                {r.cost_component.replace(/_/g, ' ')}
              </div>
              <div className="text-xs text-slate-500">AUD/MWh VRE</div>
            </div>
          ))}
        </div>
        <p className="text-slate-500 text-xs mt-3">
          VRE penetration 2024: {costs2024[0]?.vre_penetration_pct}% of total generation
        </p>
      </div>

    </div>
  )
}

// ---- KPI Card ----
function KpiCard({
  icon, label, value, sub, colour,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  colour: 'indigo' | 'amber' | 'red' | 'emerald'
}) {
  const borders: Record<string, string> = {
    indigo:  'border-indigo-700/40',
    amber:   'border-amber-700/40',
    red:     'border-red-700/40',
    emerald: 'border-emerald-700/40',
  }
  return (
    <div className={`bg-slate-800 rounded-xl p-4 border ${borders[colour]}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-slate-400 text-xs">{label}</span></div>
      <div className="text-xl font-bold text-white leading-tight">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  )
}
