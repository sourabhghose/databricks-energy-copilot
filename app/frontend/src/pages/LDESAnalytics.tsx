import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getLDESAnalyticsDashboard,
  LDESADashboard,
  LDESATechnologyRecord,
  LDESAProjectRecord,
  LDESAMarketNeedRecord,
  LDESAInvestmentRecord,
  LDESAPolicyRecord,
} from '../api/client'

// ─── helpers ────────────────────────────────────────────────────────────────

const statusBadgeClass = (status: string): string => {
  switch (status) {
    case 'COMMERCIAL':    return 'bg-green-700 text-green-100'
    case 'DEMONSTRATION': return 'bg-blue-700 text-blue-100'
    case 'PILOT':         return 'bg-yellow-700 text-yellow-100'
    case 'RESEARCH':      return 'bg-purple-700 text-purple-100'
    case 'OPERATING':     return 'bg-green-700 text-green-100'
    case 'CONSTRUCTION':  return 'bg-orange-700 text-orange-100'
    case 'APPROVED':      return 'bg-blue-700 text-blue-100'
    case 'HIGH':          return 'bg-green-700 text-green-100'
    case 'MEDIUM':        return 'bg-yellow-700 text-yellow-100'
    case 'LOW':           return 'bg-red-700 text-red-100'
    default:              return 'bg-gray-700 text-gray-100'
  }
}

const impactBadgeClass = (level: string): string => {
  switch (level) {
    case 'HIGH':   return 'bg-green-700 text-green-100'
    case 'MEDIUM': return 'bg-yellow-700 text-yellow-100'
    case 'LOW':    return 'bg-red-700 text-red-100'
    default:       return 'bg-gray-700 text-gray-100'
  }
}

const Badge = ({ label, cls }: { label: string; cls: string }) => (
  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${cls}`}>
    {label.replace(/_/g, ' ')}
  </span>
)

const TRLBar = ({ trl }: { trl: number }) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: 9 }, (_, i) => (
      <div
        key={i}
        className={`h-2 w-3 rounded-sm ${i < trl ? 'bg-teal-400' : 'bg-gray-700'}`}
      />
    ))}
    <span className="ml-1 text-xs text-gray-400">{trl}/9</span>
  </div>
)

const fmt = (n: number, decimals = 1): string => n.toFixed(decimals)
const fmtBn = (n: number): string => `$${n.toFixed(1)}B`
const fmtM  = (n: number): string => `$${n.toFixed(0)}M`

// ─── KPI card ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub?: string
}
const KpiCard = ({ label, value, sub }: KpiCardProps) => (
  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
    <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
    <p className="text-2xl font-bold text-white mt-1">{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </div>
)

// ─── Technology Table ────────────────────────────────────────────────────────

const TechnologyTable = ({ rows }: { rows: LDESATechnologyRecord[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm text-left">
      <thead>
        <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
          <th className="py-2 pr-3">Technology</th>
          <th className="py-2 pr-3">Duration (hr)</th>
          <th className="py-2 pr-3">TRL</th>
          <th className="py-2 pr-3">Status</th>
          <th className="py-2 pr-3">LCOE 2024 ($/MWh)</th>
          <th className="py-2 pr-3">LCOE 2030 ($/MWh)</th>
          <th className="py-2 pr-3">LCOE 2040 ($/MWh)</th>
          <th className="py-2 pr-3">CapEx ($/kWh)</th>
          <th className="py-2 pr-3">RTE %</th>
          <th className="py-2 pr-3">Scale</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.technology} className="border-b border-gray-800 hover:bg-gray-800/50">
            <td className="py-2 pr-3 font-medium text-white whitespace-nowrap">
              {r.technology.replace(/_/g, ' ')}
            </td>
            <td className="py-2 pr-3 text-gray-300">{r.duration_range_hr}</td>
            <td className="py-2 pr-3"><TRLBar trl={r.trl} /></td>
            <td className="py-2 pr-3"><Badge label={r.commercial_status} cls={statusBadgeClass(r.commercial_status)} /></td>
            <td className="py-2 pr-3 text-teal-300 font-semibold">{fmt(r.lcoe_per_mwh_2024)}</td>
            <td className="py-2 pr-3 text-blue-300">{fmt(r.lcoe_per_mwh_2030)}</td>
            <td className="py-2 pr-3 text-purple-300">{fmt(r.lcoe_per_mwh_2040)}</td>
            <td className="py-2 pr-3 text-gray-300">{fmt(r.capex_per_kwh_2024)}</td>
            <td className="py-2 pr-3 text-gray-300">{fmt(r.round_trip_efficiency_pct)}%</td>
            <td className="py-2 pr-3"><Badge label={r.scale_potential} cls={statusBadgeClass(r.scale_potential)} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// ─── Project Table ───────────────────────────────────────────────────────────

const ProjectTable = ({ rows }: { rows: LDESAProjectRecord[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm text-left">
      <thead>
        <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
          <th className="py-2 pr-3">Project</th>
          <th className="py-2 pr-3">Developer</th>
          <th className="py-2 pr-3">Country</th>
          <th className="py-2 pr-3">Technology</th>
          <th className="py-2 pr-3">Power (MW)</th>
          <th className="py-2 pr-3">Energy (MWh)</th>
          <th className="py-2 pr-3">Duration (hr)</th>
          <th className="py-2 pr-3">Status</th>
          <th className="py-2 pr-3">COD</th>
          <th className="py-2 pr-3">CapEx</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.project_id} className="border-b border-gray-800 hover:bg-gray-800/50">
            <td className="py-2 pr-3 font-medium text-white whitespace-nowrap">{r.name}</td>
            <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{r.developer}</td>
            <td className="py-2 pr-3">
              <span className={`font-semibold ${r.country === 'AUSTRALIA' ? 'text-yellow-400' : 'text-gray-400'}`}>
                {r.country}
              </span>
            </td>
            <td className="py-2 pr-3 text-gray-300">{r.technology.replace(/_/g, ' ')}</td>
            <td className="py-2 pr-3 text-gray-300">{r.power_mw}</td>
            <td className="py-2 pr-3 text-teal-300 font-semibold">{r.energy_mwh.toLocaleString()}</td>
            <td className="py-2 pr-3 text-gray-300">{r.duration_hr}h</td>
            <td className="py-2 pr-3"><Badge label={r.status} cls={statusBadgeClass(r.status)} /></td>
            <td className="py-2 pr-3 text-gray-300">{r.commissioning_year}</td>
            <td className="py-2 pr-3 text-gray-300">{fmtM(r.capex_m)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// ─── Market Need Chart ───────────────────────────────────────────────────────

const MarketNeedChart = ({ rows }: { rows: LDESAMarketNeedRecord[] }) => {
  const data = rows.map((r) => ({
    region: r.region,
    current: r.current_ldes_gwh,
    gap: r.ldes_gap_gwh,
    savings: r.savings_from_ldes_m / 1000,
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="region"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          angle={-40}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          yAxisId="gwh"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'GWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
        />
        <YAxis
          yAxisId="savings"
          orientation="right"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Savings $B', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f9fafb', fontWeight: 'bold' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
        <Bar yAxisId="gwh" dataKey="current" name="Current LDES (GWh)" fill="#14b8a6" />
        <Bar yAxisId="gwh" dataKey="gap"     name="LDES Gap (GWh)"     fill="#f97316" />
        <Bar yAxisId="savings" dataKey="savings" name="Savings ($B)"   fill="#8b5cf6" />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Investment Trends Chart ─────────────────────────────────────────────────

const TECH_COLORS: Record<string, string> = {
  FLOW_BATTERY_VANADIUM: '#14b8a6',
  IRON_AIR:              '#f97316',
  LIQUID_AIR:            '#8b5cf6',
  COMPRESSED_AIR:        '#3b82f6',
  HYDROGEN_STORAGE:      '#eab308',
  PUMPED_THERMAL:        '#ec4899',
}

const InvestmentChart = ({ rows }: { rows: LDESAInvestmentRecord[] }) => {
  const years = [2020, 2021, 2022, 2023, 2024]
  const techs = [...new Set(rows.map((r) => r.technology))]

  const data = years.map((yr) => {
    const entry: Record<string, number | string> = { year: String(yr) }
    techs.forEach((t) => {
      const rec = rows.find((r) => r.year === yr && r.technology === t)
      entry[t] = rec ? rec.global_investment_bn : 0
    })
    return entry
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Global Investment ($B)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f9fafb', fontWeight: 'bold' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
        {techs.map((t) => (
          <Bar
            key={t}
            dataKey={t}
            name={t.replace(/_/g, ' ')}
            stackId="a"
            fill={TECH_COLORS[t] ?? '#6b7280'}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Policy Table ────────────────────────────────────────────────────────────

const PolicyTable = ({ rows }: { rows: LDESAPolicyRecord[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm text-left">
      <thead>
        <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
          <th className="py-2 pr-3">Jurisdiction</th>
          <th className="py-2 pr-3">Policy</th>
          <th className="py-2 pr-3">Type</th>
          <th className="py-2 pr-3">LDES Specific</th>
          <th className="py-2 pr-3">Funding</th>
          <th className="py-2 pr-3">Duration (yr)</th>
          <th className="py-2 pr-3">Impact</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
            <td className="py-2 pr-3 font-semibold text-teal-300">{r.jurisdiction}</td>
            <td className="py-2 pr-3 text-white">{r.policy_name}</td>
            <td className="py-2 pr-3 text-gray-300">{r.policy_type.replace(/_/g, ' ')}</td>
            <td className="py-2 pr-3">
              {r.ldes_specific ? (
                <span className="text-green-400 font-semibold">Yes</span>
              ) : (
                <span className="text-gray-500">No</span>
              )}
            </td>
            <td className="py-2 pr-3 text-yellow-300 font-semibold">{fmtBn(r.funding_bn)}</td>
            <td className="py-2 pr-3 text-gray-300">{r.duration_years}</td>
            <td className="py-2 pr-3"><Badge label={r.impact_assessment} cls={impactBadgeClass(r.impact_assessment)} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function LDESAnalytics() {
  const [data, setData]       = useState<LDESADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getLDESAnalyticsDashboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-teal-400" />
        <span className="ml-3 text-gray-400">Loading LDES Analytics...</span>
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

  const s = data.summary as Record<string, number>

  return (
    <div className="p-6 space-y-8 text-gray-200 bg-gray-900 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Long Duration Energy Storage (LDES) Technology &amp; Investment Analytics
        </h1>
        <p className="mt-1 text-gray-400 text-sm">
          10–100+ hour storage technologies, economics, deployment pipeline, and role in decarbonization.
          Covers flow batteries, iron-air, liquid air, CAES, green hydrogen, and more.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard label="Global LDES Deployed" value={`${s.total_global_ldes_gwh} GWh`} sub="All LDES technologies" />
        <KpiCard label="Australian LDES" value={`${s.australian_ldes_gwh} GWh`} sub="Installed + approved" />
        <KpiCard label="Avg LCOE 2024" value={`$${s.avg_lcoe_2024}/MWh`} sub="Across LDES techs" />
        <KpiCard label="Avg LCOE 2030" value={`$${s.avg_lcoe_2030}/MWh`} sub="-33% vs 2024" />
        <KpiCard label="Avg LCOE 2040" value={`$${s.avg_lcoe_2040}/MWh`} sub="-54% vs 2024" />
        <KpiCard label="2024 Investment" value={`$${s.total_investment_2024_bn}B`} sub="Global LDES investment" />
        <KpiCard label="Commercial Tech" value={String(s.commercial_technologies_count)} sub="TRL 8-9 available now" />
      </div>

      {/* Technology Comparison */}
      <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Technology Comparison — TRL, Status &amp; LCOE Trajectory
        </h2>
        <TechnologyTable rows={data.technologies} />
      </section>

      {/* Project Register */}
      <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-1">
          Global LDES Project Register
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Australian projects highlighted in gold. 15 key LDES projects across flow batteries, iron-air,
          liquid air, CAES, hydrogen storage, and pumped thermal.
        </p>
        <ProjectTable rows={data.projects} />
      </section>

      {/* Market Need */}
      <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-1">
          NEM Market Need for LDES — 2030 &amp; 2050 Scenarios
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Current LDES deployment vs. required capacity for 75–100% VRE grids. Right axis shows
          system cost savings from deploying optimal LDES.
        </p>
        <MarketNeedChart rows={data.market_needs} />

        {/* Market Need detail table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="py-2 pr-3">Region</th>
                <th className="py-2 pr-3">VRE %</th>
                <th className="py-2 pr-3">LDES Needed (GWh)</th>
                <th className="py-2 pr-3">Current (GWh)</th>
                <th className="py-2 pr-3">Gap (GWh)</th>
                <th className="py-2 pr-3">Optimal Duration (hr)</th>
                <th className="py-2 pr-3">Cost w/o LDES</th>
                <th className="py-2 pr-3">Cost w/ LDES</th>
                <th className="py-2 pr-3">Savings</th>
              </tr>
            </thead>
            <tbody>
              {data.market_needs.map((r) => (
                <tr key={r.region} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-2 pr-3 font-semibold text-white">{r.region}</td>
                  <td className="py-2 pr-3 text-gray-300">{r.vre_penetration_pct}%</td>
                  <td className="py-2 pr-3 text-teal-300">{r.ldes_needed_gwh}</td>
                  <td className="py-2 pr-3 text-gray-300">{r.current_ldes_gwh}</td>
                  <td className="py-2 pr-3 text-orange-400 font-semibold">{r.ldes_gap_gwh}</td>
                  <td className="py-2 pr-3 text-gray-300">{r.optimal_duration_hr}h</td>
                  <td className="py-2 pr-3 text-red-400">{fmtM(r.cost_without_ldes_m)}</td>
                  <td className="py-2 pr-3 text-green-400">{fmtM(r.cost_with_ldes_m)}</td>
                  <td className="py-2 pr-3 text-yellow-300 font-semibold">{fmtM(r.savings_from_ldes_m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Investment Trends */}
      <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-1">
          Global LDES Investment Trends (2020–2024)
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Stacked by technology. Hydrogen storage and vanadium flow batteries dominate investment,
          with iron-air and liquid air accelerating from 2022.
        </p>
        <InvestmentChart rows={data.investment} />

        {/* Australian investment sub-table */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Australian Investment by Technology (2024)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {['FLOW_BATTERY_VANADIUM', 'IRON_AIR', 'LIQUID_AIR', 'COMPRESSED_AIR', 'HYDROGEN_STORAGE', 'PUMPED_THERMAL'].map(
              (tech) => {
                const rec = data.investment.find((r) => r.year === 2024 && r.technology === tech)
                if (!rec) return null
                return (
                  <div key={tech} className="bg-gray-700 rounded-lg p-3 border border-gray-600">
                    <p className="text-xs text-gray-400">{tech.replace(/_/g, ' ')}</p>
                    <p className="text-lg font-bold text-white mt-1">{fmtM(rec.australia_investment_m)}</p>
                    <p className="text-xs text-gray-500">AU 2024</p>
                    <div className="mt-2 text-xs space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-gray-400">VC</span>
                        <span className="text-teal-300">{rec.venture_capital_pct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Govt</span>
                        <span className="text-blue-300">{rec.govt_grants_pct}%</span>
                      </div>
                    </div>
                  </div>
                )
              }
            )}
          </div>
        </div>
      </section>

      {/* Policy Landscape */}
      <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-1">
          Global LDES Policy Landscape
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Key policies enabling LDES deployment across USA, EU, Australia, UK, Japan, and China.
          Dedicated LDES-specific programs highlighted.
        </p>
        <PolicyTable rows={data.policies} />
      </section>
    </div>
  )
}
