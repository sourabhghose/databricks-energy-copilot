import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer,
} from 'recharts'
import { Wind } from 'lucide-react'
import {
  getOffshoreWindFinanceDashboard,
  OWPFDashboard,
  OWPFProjectRecord,
  OWPFScenarioRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TECH_COLOR: Record<string, string> = {
  'Fixed Bottom': '#38bdf8',
  Floating: '#818cf8',
  Hybrid: '#34d399',
}

const STAGE_COLOR: Record<string, string> = {
  'Pre-FEED': '#94a3b8',
  FEED: '#fbbf24',
  Approved: '#60a5fa',
  Construction: '#34d399',
  Operating: '#4ade80',
}

const VIABILITY_COLOR: Record<string, string> = {
  Viable: '#4ade80',
  Marginal: '#fbbf24',
  'Not Viable': '#f87171',
}

const KPI_CARDS = (summary: Record<string, number | string>) => [
  {
    label: 'Total Pipeline',
    value: `${summary['total_pipeline_gw'] ?? '—'} GW`,
    sub: 'Offshore wind projects',
    color: 'from-sky-600 to-sky-800',
  },
  {
    label: 'Projects at FID',
    value: String(summary['projects_at_fid_stage'] ?? '—'),
    sub: 'Approved + Construction',
    color: 'from-emerald-600 to-emerald-800',
  },
  {
    label: 'Avg LCOE',
    value: `$${summary['avg_lcoe_dolpermwh'] ?? '—'}/MWh`,
    sub: 'All projects weighted avg',
    color: 'from-violet-600 to-violet-800',
  },
  {
    label: 'Total Financing',
    value: `$${summary['total_financing_bn'] ?? '—'}B`,
    sub: 'Across modelled projects',
    color: 'from-amber-600 to-amber-800',
  },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br ${color} p-5 flex flex-col gap-1 shadow-lg`}>
      <p className="text-xs text-white/70 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/60">{sub}</p>
    </div>
  )
}

// Capacity by technology + stage (stacked)
function CapacityByTechChart({ projects }: { projects: OWPFProjectRecord[] }) {
  const stages = ['Pre-FEED', 'FEED', 'Approved', 'Construction', 'Operating']
  const techs = ['Fixed Bottom', 'Floating', 'Hybrid']

  const data = techs.map((tech) => {
    const row: Record<string, string | number> = { technology: tech }
    stages.forEach((stage) => {
      row[stage] = projects
        .filter((p) => p.technology === tech && p.stage === stage)
        .reduce((s, p) => s + p.capacity_mw, 0)
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Project Capacity by Technology & Stage (MW)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="technology" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          {stages.map((stage) => (
            <Bar key={stage} dataKey={stage} stackId="a" fill={STAGE_COLOR[stage]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Cost breakdown with learning curve targets
function CostBreakdownChart({ costs }: { costs: { cost_category: string; value_m: number; learning_curve_2030_pct: number; learning_curve_2040_pct: number }[] }) {
  const categories = ['Foundations', 'Turbines', 'Offshore Substation', 'Cables', 'Installation']

  // Aggregate across all projects
  const data = categories.map((cat) => {
    const recs = costs.filter((c) => c.cost_category === cat)
    const avgValue = recs.length ? recs.reduce((s, c) => s + c.value_m, 0) / recs.length : 0
    const lc2030 = recs.length ? recs[0].learning_curve_2030_pct : 0
    const lc2040 = recs.length ? recs[0].learning_curve_2040_pct : 0
    return {
      category: cat.replace('Offshore Substation', 'O/S Substation'),
      'Avg Cost (M)': Math.round(avgValue),
      '2030 Reduction %': Math.abs(lc2030),
      '2040 Reduction %': Math.abs(lc2040),
    }
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Cost Breakdown & Learning Curve Targets (avg across projects)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="category" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          <Bar yAxisId="left" dataKey="Avg Cost (M)" fill="#38bdf8" />
          <Bar yAxisId="right" dataKey="2030 Reduction %" fill="#fbbf24" />
          <Bar yAxisId="right" dataKey="2040 Reduction %" fill="#4ade80" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Scenario LCOE comparison
function ScenarioLcoeChart({ scenarios }: { scenarios: OWPFScenarioRecord[] }) {
  const scenarioNames = ['Base', 'High Cost', 'CIS Support', 'Accelerated Build']
  const projectNames = [...new Set(scenarios.map((s) => s.project_name))]

  const data = projectNames.map((proj) => {
    const row: Record<string, string | number> = {
      project: proj.replace(' Offshore Wind', '').replace(' Floating Wind', ' Float'),
    }
    scenarioNames.forEach((scen) => {
      const rec = scenarios.find((s) => s.project_name === proj && s.scenario_name === scen)
      row[scen] = rec ? rec.lcoe_dolpermwh : 0
    })
    return row
  })

  const SCEN_COLORS: Record<string, string> = {
    Base: '#60a5fa',
    'High Cost': '#f87171',
    'CIS Support': '#4ade80',
    'Accelerated Build': '#fbbf24',
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Scenario LCOE Comparison by Project ($/MWh)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="project"
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            angle={-25}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="$/MWh" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          {scenarioNames.map((scen) => (
            <Bar key={scen} dataKey={scen} fill={SCEN_COLORS[scen]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Revenue stream mix per project
function RevenueStreamChart({ revenues }: { revenues: { project_id: string; revenue_stream: string; revenue_m_pa: number }[] }) {
  const projIds = [...new Set(revenues.map((r) => r.project_id))]
  const streams = ['CIS Contract', 'PPA', 'Spot Market', 'RECs']
  const STREAM_COLORS: Record<string, string> = {
    'CIS Contract': '#4ade80',
    PPA: '#38bdf8',
    'Spot Market': '#fbbf24',
    RECs: '#c084fc',
  }

  const data = projIds.map((pid) => {
    const row: Record<string, string | number> = { project: pid.replace('OWPF-PRJ-', 'PRJ-') }
    streams.forEach((s) => {
      const rec = revenues.find((r) => r.project_id === pid && r.revenue_stream === s)
      row[s] = rec ? Math.round(rec.revenue_m_pa) : 0
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Revenue Stream Mix per Project (A$M/yr)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="project" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          {streams.map((s) => (
            <Bar key={s} dataKey={s} stackId="a" fill={STREAM_COLORS[s]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function OffshoreWindFinanceAnalytics() {
  const [data, setData] = useState<OWPFDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getOffshoreWindFinanceDashboard()
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Wind className="w-6 h-6 animate-spin" />
          <span className="text-lg">Loading Offshore Wind Finance Analytics...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-400 font-semibold">Failed to load dashboard</p>
          <p className="text-red-300 text-sm mt-2">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  const { projects, financing, costs, supply_chain, revenues, scenarios, summary } = data
  const kpiCards = KPI_CARDS(summary)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-sky-700 rounded-lg">
          <Wind className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Offshore Wind Project Finance Analytics</h1>
          <p className="text-sm text-gray-400">Australian offshore wind pipeline — project finance, costs, supply chain & scenario modelling</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CapacityByTechChart projects={projects} />
        <CostBreakdownChart costs={costs} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ScenarioLcoeChart scenarios={scenarios} />
        <RevenueStreamChart revenues={revenues} />
      </div>

      {/* Project Overview Table */}
      <div className="bg-gray-800 rounded-xl p-4 shadow overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Project Overview</h3>
        <table className="w-full text-xs text-gray-300 border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-700">
              {['Project', 'State', 'Technology', 'Stage', 'Capacity (MW)', 'Water Depth (m)', 'LCOE ($/MWh)', 'CapEx (A$B)', 'CF %', 'Licence'].map(
                (h) => (
                  <th key={h} className="text-left py-2 px-2 font-semibold text-gray-400">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 px-2 font-medium text-white">{p.project_name}</td>
                <td className="py-2 px-2">{p.state}</td>
                <td className="py-2 px-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: (TECH_COLOR[p.technology] ?? '#6b7280') + '33',
                      color: TECH_COLOR[p.technology] ?? '#9ca3af',
                    }}
                  >
                    {p.technology}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: (STAGE_COLOR[p.stage] ?? '#6b7280') + '33',
                      color: STAGE_COLOR[p.stage] ?? '#9ca3af',
                    }}
                  >
                    {p.stage}
                  </span>
                </td>
                <td className="py-2 px-2 text-right">{p.capacity_mw.toLocaleString()}</td>
                <td className="py-2 px-2 text-right">{p.water_depth_m}</td>
                <td className="py-2 px-2 text-right">${p.lcoe_dolpermwh}</td>
                <td className="py-2 px-2 text-right">${p.capex_bn}B</td>
                <td className="py-2 px-2 text-right">{p.capacity_factor_pct}%</td>
                <td className="py-2 px-2 text-center">
                  <span className={p.offshore_licence_held ? 'text-green-400' : 'text-red-400'}>
                    {p.offshore_licence_held ? 'Yes' : 'No'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scenario Viability Summary */}
      <div className="bg-gray-800 rounded-xl p-4 shadow overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Scenario Viability Summary</h3>
        <table className="w-full text-xs text-gray-300 border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-700">
              {['Project', 'Scenario', 'LCOE ($/MWh)', 'CapEx (A$B)', 'IRR Equity %', 'IRR Project %', 'NPV (A$M)', 'DSCR Min', 'Payback (yr)', 'Viability'].map(
                (h) => (
                  <th key={h} className="text-left py-2 px-2 font-semibold text-gray-400">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.scenario_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 px-2 text-white font-medium truncate max-w-[140px]">{s.project_name.replace(' Offshore Wind', '').replace(' Floating Wind', '')}</td>
                <td className="py-2 px-2">{s.scenario_name}</td>
                <td className="py-2 px-2 text-right">${s.lcoe_dolpermwh}</td>
                <td className="py-2 px-2 text-right">${s.capex_bn}B</td>
                <td className="py-2 px-2 text-right">{s.irr_equity_pct}%</td>
                <td className="py-2 px-2 text-right">{s.irr_project_pct}%</td>
                <td className="py-2 px-2 text-right">{s.npv_m}</td>
                <td className="py-2 px-2 text-right">{s.dscr_min}x</td>
                <td className="py-2 px-2 text-right">{s.payback_years} yr</td>
                <td className="py-2 px-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: (VIABILITY_COLOR[s.viability] ?? '#6b7280') + '33',
                      color: VIABILITY_COLOR[s.viability] ?? '#9ca3af',
                    }}
                  >
                    {s.viability}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Supply Chain Table */}
      <div className="bg-gray-800 rounded-xl p-4 shadow overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Supply Chain Overview ({supply_chain.length} components)</h3>
        <table className="w-full text-xs text-gray-300 border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-700">
              {['Component', 'Supplier Country', 'Market Share %', 'Lead Time (mo)', 'AU Mfg Gap', 'Localisation Inv. (A$M)', 'Jobs (FTE)', 'Policy Support'].map(
                (h) => (
                  <th key={h} className="text-left py-2 px-2 font-semibold text-gray-400">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {supply_chain.map((sc) => (
              <tr key={sc.chain_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 px-2 text-white font-medium">{sc.component}</td>
                <td className="py-2 px-2">{sc.supplier_country}</td>
                <td className="py-2 px-2 text-right">{sc.market_share_pct}%</td>
                <td className="py-2 px-2 text-right">{sc.lead_time_months}</td>
                <td className="py-2 px-2 text-center">
                  <span className={sc.australian_manufacturing_gap ? 'text-red-400' : 'text-green-400'}>
                    {sc.australian_manufacturing_gap ? 'Gap' : 'OK'}
                  </span>
                </td>
                <td className="py-2 px-2 text-right">${sc.localisation_investment_m.toLocaleString()}M</td>
                <td className="py-2 px-2 text-right">{sc.jobs_created_fte.toLocaleString()}</td>
                <td className="py-2 px-2 text-gray-400 max-w-[200px] truncate">{sc.policy_support_needed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financing Summary */}
      <div className="bg-gray-800 rounded-xl p-4 shadow overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Financing Instruments ({financing.length} records)</h3>
        <table className="w-full text-xs text-gray-300 border-collapse min-w-[860px]">
          <thead>
            <tr className="border-b border-gray-700">
              {['Project', 'Instrument', 'Provider', 'Amount (A$M)', 'Rate %', 'Tenor (yr)', 'D/E Ratio', 'Guarantee', 'Close Date'].map(
                (h) => (
                  <th key={h} className="text-left py-2 px-2 font-semibold text-gray-400">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {financing.map((f) => (
              <tr key={f.finance_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 px-2">{f.project_id.replace('OWPF-', '')}</td>
                <td className="py-2 px-2 text-white font-medium">{f.instrument_type}</td>
                <td className="py-2 px-2">{f.provider}</td>
                <td className="py-2 px-2 text-right">${f.amount_m.toLocaleString()}M</td>
                <td className="py-2 px-2 text-right">{f.interest_rate_pct > 0 ? `${f.interest_rate_pct}%` : 'N/A'}</td>
                <td className="py-2 px-2 text-right">{f.tenor_years > 0 ? `${f.tenor_years}yr` : 'N/A'}</td>
                <td className="py-2 px-2 text-right">{f.debt_equity_ratio}%</td>
                <td className="py-2 px-2">{f.guarantee_type}</td>
                <td className="py-2 px-2">{f.financial_close_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600 text-center pb-4">
        Offshore Wind Project Finance Analytics — Sprint 106c | Data indicative only
      </p>
    </div>
  )
}
