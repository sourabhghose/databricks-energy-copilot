import { useEffect, useState } from 'react'
import { Power, AlertTriangle, Zap, DollarSign } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
  LabelList,
} from 'recharts'
import {
  getGeneratorRetirementDashboard,
  GRADashboard,
  GRAGeneratorRecord,
  GRARetirementScheduleRecord,
  GRAReplacementRecord,
  GRAEconomicsRecord,
} from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function techBadge(tech: string) {
  const map: Record<string, string> = {
    COAL: 'bg-gray-700 text-gray-100',
    BROWN_COAL: 'bg-amber-800 text-amber-100',
    GAS_OCGT: 'bg-orange-700 text-orange-100',
    GAS_CCGT: 'bg-yellow-700 text-yellow-100',
    HYDRO: 'bg-blue-700 text-blue-100',
    OIL: 'bg-red-900 text-red-100',
  }
  return map[tech] ?? 'bg-gray-600 text-gray-100'
}

function riskBadge(risk: string) {
  const map: Record<string, string> = {
    CRITICAL: 'bg-red-600 text-white',
    HIGH: 'bg-orange-500 text-white',
    MEDIUM: 'bg-yellow-500 text-gray-900',
    LOW: 'bg-green-600 text-white',
  }
  return map[risk] ?? 'bg-gray-600 text-white'
}

function firmnessBadge(firmness: string) {
  const map: Record<string, string> = {
    COMMITTED: 'bg-green-600 text-white',
    CONTRACTED: 'bg-blue-600 text-white',
    PROPOSED: 'bg-yellow-500 text-gray-900',
    SPECULATIVE: 'bg-red-600 text-white',
  }
  return map[firmness] ?? 'bg-gray-600 text-white'
}

function regionBadge(region: string) {
  const map: Record<string, string> = {
    NSW1: 'bg-blue-700 text-blue-100',
    VIC1: 'bg-purple-700 text-purple-100',
    QLD1: 'bg-amber-700 text-amber-100',
    SA1: 'bg-red-700 text-red-100',
    TAS1: 'bg-teal-700 text-teal-100',
  }
  return map[region] ?? 'bg-gray-600 text-gray-100'
}

function coverageColor(pct: number) {
  if (pct >= 90) return 'bg-green-500'
  if (pct >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

function gapStatusColor(status: string) {
  if (status === 'COVERED') return 'text-green-400'
  if (status === 'PARTIAL') return 'text-yellow-400'
  return 'text-red-400'
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  accent: string
}

function KpiCard({ label, value, sub, icon, accent }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Custom Tooltip for Retirement Timeline chart ──────────────────────────────

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string | number
}

function RetirementTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-sm">
      <p className="text-gray-300 font-semibold mb-1">Year {label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()} MW
        </p>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GeneratorRetirementAnalytics() {
  const [data, setData] = useState<GRADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGeneratorRetirementDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading generator retirement data...
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

  const summary = data.summary as Record<string, number>

  // Prepare chart data: merge retirement schedule with gap status label
  const chartData = data.retirement_schedule.map((r: GRARetirementScheduleRecord) => ({
    year: r.year,
    'Coal Retiring (MW)': r.coal_retiring_mw,
    'Gas Retiring (MW)': r.gas_retiring_mw,
    'Replacement (MW)': r.replacement_contracted_mw,
    gapStatus: r.gap_status,
    region: r.region,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-700 rounded-lg">
          <Power size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Generator Retirement Analytics</h1>
          <p className="text-sm text-gray-400">NEM thermal fleet retirement schedule, stranded asset risk &amp; replacement capacity</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Generators Tracked"
          value={summary.total_generators_tracked}
          sub="NEM thermal fleet"
          icon={<Power size={18} className="text-white" />}
          accent="bg-gray-700"
        />
        <KpiCard
          label="Critical Risk"
          value={summary.critical_risk_count}
          sub="Stations at CRITICAL risk"
          icon={<AlertTriangle size={18} className="text-white" />}
          accent="bg-red-700"
        />
        <KpiCard
          label="Retiring by 2030"
          value={`${(summary.retiring_by_2030_mw / 1000).toFixed(1)} GW`}
          sub="Expected capacity exit"
          icon={<Zap size={18} className="text-white" />}
          accent="bg-orange-700"
        />
        <KpiCard
          label="Total Stranded Value"
          value={`$${summary.total_stranded_value_m}M`}
          sub="Across tracked fleet"
          icon={<DollarSign size={18} className="text-white" />}
          accent="bg-yellow-700"
        />
      </div>

      {/* Generator Fleet Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-base font-semibold text-white mb-3">Generator Fleet</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700 text-xs uppercase">
                <th className="pb-2 pr-3">DUID</th>
                <th className="pb-2 pr-3">Station Name</th>
                <th className="pb-2 pr-3">Participant</th>
                <th className="pb-2 pr-3">Region</th>
                <th className="pb-2 pr-3">Technology</th>
                <th className="pb-2 pr-3 text-right">Capacity (MW)</th>
                <th className="pb-2 pr-3 text-right">Age (yrs)</th>
                <th className="pb-2 pr-3 text-right">Ret. Year</th>
                <th className="pb-2 pr-3">Stranded Risk</th>
                <th className="pb-2 pr-3 text-right">Book ($M)</th>
                <th className="pb-2 text-right">Stranded ($M)</th>
              </tr>
            </thead>
            <tbody>
              {data.generators.map((g: GRAGeneratorRecord) => (
                <tr
                  key={g.duid}
                  className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
                >
                  <td className="py-2 pr-3 font-mono text-xs text-gray-300">{g.duid}</td>
                  <td className="py-2 pr-3 text-white font-medium whitespace-nowrap">{g.station_name}</td>
                  <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{g.participant}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${regionBadge(g.region)}`}>
                      {g.region}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${techBadge(g.technology)}`}>
                      {g.technology.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-200">{g.registered_capacity_mw.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{g.asset_age_years}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{g.expected_retirement_year}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${riskBadge(g.stranded_asset_risk)}`}>
                      {g.stranded_asset_risk}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-200">${g.book_value_m}</td>
                  <td className="py-2 text-right">
                    <span className={g.stranded_value_m > 200 ? 'text-red-400 font-semibold' : 'text-gray-200'}>
                      ${g.stranded_value_m}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retirement Timeline Chart */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-base font-semibold text-white mb-1">Retirement Timeline</h2>
        <p className="text-xs text-gray-400 mb-4">
          Stacked bars show retiring capacity by fuel type. Green line = contracted replacement.
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
            <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v} MW`} />
            <Tooltip content={<RetirementTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }}
            />
            <Bar dataKey="Coal Retiring (MW)" stackId="a" fill="#374151" radius={[0, 0, 0, 0]}>
              <LabelList
                dataKey="gapStatus"
                position="top"
                style={{ fontSize: '10px', fill: '#9CA3AF' }}
              />
            </Bar>
            <Bar dataKey="Gas Retiring (MW)" stackId="a" fill="#b45309" radius={[2, 2, 0, 0]} />
            <Line
              type="monotone"
              dataKey="Replacement (MW)"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ fill: '#22c55e', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        {/* Gap status legend */}
        <div className="flex gap-4 mt-3 text-xs">
          <span className="text-green-400 font-medium">COVERED: Full replacement contracted</span>
          <span className="text-yellow-400 font-medium">PARTIAL: Some replacement contracted</span>
          <span className="text-red-400 font-medium">UNCOVERED: No adequate replacement</span>
        </div>
      </div>

      {/* Replacement Coverage Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-base font-semibold text-white mb-3">Replacement Coverage</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700 text-xs uppercase">
                <th className="pb-2 pr-3">Region</th>
                <th className="pb-2 pr-3">Retiring Station</th>
                <th className="pb-2 pr-3 text-right">Ret. MW</th>
                <th className="pb-2 pr-3">Replacement Technology</th>
                <th className="pb-2 pr-3">Developer</th>
                <th className="pb-2 pr-3 text-right">Repl. MW</th>
                <th className="pb-2 pr-3">Coverage %</th>
                <th className="pb-2">Firmness</th>
              </tr>
            </thead>
            <tbody>
              {data.replacements.map((r: GRAReplacementRecord, idx: number) => (
                <tr
                  key={idx}
                  className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
                >
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${regionBadge(r.region)}`}>
                      {r.region}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-white font-medium">{r.retiring_station}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{r.retiring_mw.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-gray-300">{r.replacement_technology}</td>
                  <td className="py-2 pr-3 text-gray-300">{r.replacement_developer}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{r.replacement_mw.toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${coverageColor(r.coverage_pct)}`}
                          style={{ width: `${Math.min(r.coverage_pct, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${r.coverage_pct >= 90 ? 'text-green-400' : r.coverage_pct >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {r.coverage_pct}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${firmnessBadge(r.firmness)}`}>
                      {r.firmness}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Early Retirement Economics Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-base font-semibold text-white mb-3">Early Retirement Economics</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700 text-xs uppercase">
                <th className="pb-2 pr-3">Station</th>
                <th className="pb-2 pr-3">Technology</th>
                <th className="pb-2 pr-3 text-right">Yrs Early</th>
                <th className="pb-2 pr-3 text-right">Stranded Cost ($M)</th>
                <th className="pb-2 pr-3 text-right">Ret. Payment ($M)</th>
                <th className="pb-2 pr-3 text-right">Net Cost ($M)</th>
                <th className="pb-2 pr-3 text-right">Carbon Abatement (Mt)</th>
                <th className="pb-2 text-right">Cost / t CO2 ($/t)</th>
              </tr>
            </thead>
            <tbody>
              {data.economics.map((e: GRAEconomicsRecord, idx: number) => (
                <tr
                  key={idx}
                  className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
                >
                  <td className="py-2 pr-3 text-white font-medium">{e.station_name}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${techBadge(e.technology)}`}>
                      {e.technology.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <span className="text-orange-400 font-semibold">{e.years_early}</span>
                  </td>
                  <td className="py-2 pr-3 text-right text-red-300">${e.stranded_cost_m}M</td>
                  <td className="py-2 pr-3 text-right text-yellow-300">${e.early_retirement_payment_m}M</td>
                  <td className="py-2 pr-3 text-right">
                    <span className={e.net_cost_m > 200 ? 'text-red-400 font-semibold' : 'text-gray-200'}>
                      ${e.net_cost_m}M
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right text-green-400">{e.carbon_abatement_mt} Mt</td>
                  <td className="py-2 text-right">
                    <span className={e.cost_per_t_co2 < 2 ? 'text-green-400' : 'text-yellow-400'}>
                      ${e.cost_per_t_co2}/t
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-gray-400">
          Cost per tonne CO2 = Net retirement cost / Carbon abatement. Values below $2/t represent highly cost-effective early retirement.
        </div>
      </div>

      {/* Summary stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">Retiring by 2035</p>
          <p className="text-lg font-bold text-white">{(summary.retiring_by_2035_mw / 1000).toFixed(1)} GW</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">Avg Fleet Age</p>
          <p className="text-lg font-bold text-orange-400">{summary.avg_asset_age_years} yrs</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">Uncovered Gap Years</p>
          <p className="text-lg font-bold text-red-400">{summary.uncovered_gap_years}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">Total Stranded Value</p>
          <p className="text-lg font-bold text-yellow-400">${summary.total_stranded_value_m}M</p>
        </div>
      </div>
    </div>
  )
}
