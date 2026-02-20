// ---------------------------------------------------------------------------
// Sprint 77c — Renewable Energy Certificates (LGC & STC) Analytics
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import {
  Award,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Leaf,
  BarChart2,
  Users,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  getRECMarketDashboard,
  type RECDashboard,
  type RECLGCPriceRecord,
  type RECSTCRecord,
  type RECCreationRecord,
  type RECLiableEntityRecord,
  type RECVoluntaryRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiCardProps {
  title: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
}

function KpiCard({ title, value, sub, icon, trend, trendLabel }: KpiCardProps) {
  const trendColor =
    trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-2 border border-gray-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{title}</span>
        <span className="text-gray-500">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
      {trendLabel && (
        <div className={`text-xs font-medium flex items-center gap-1 ${trendColor}`}>
          {trend === 'up' && <TrendingUp size={12} />}
          {trend === 'down' && <TrendingDown size={12} />}
          {trendLabel}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TECH_COLORS: Record<string, string> = {
  WIND:         '#38bdf8',
  SOLAR_FARM:   '#fbbf24',
  HYDRO:        '#34d399',
  BIOMASS:      '#a78bfa',
  GEOTHERMAL:   '#f87171',
  WAVE:         '#2dd4bf',
  LANDFILL_GAS: '#fb923c',
}

const SCHEME_COLORS: Record<string, string> = {
  GreenPower:         '#34d399',
  REGO:               '#38bdf8',
  Corporate_PPA_RECs: '#fbbf24',
  GEC:                '#a78bfa',
  Climate_Active:     '#fb923c',
}

// Aggregate creation by year+technology across all regions
function aggregateCreationByTechYear(
  records: RECCreationRecord[]
): { year: number; [tech: string]: number }[] {
  const map = new Map<number, Record<string, number>>()
  for (const r of records) {
    if (!map.has(r.year)) map.set(r.year, {})
    const entry = map.get(r.year)!
    entry[r.technology] = (entry[r.technology] ?? 0) + r.lgcs_created_thousands
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, techs]) => ({ year, ...techs }))
}

// Aggregate voluntary by year+scheme
function aggregateVoluntaryBySchemeYear(
  records: RECVoluntaryRecord[]
): { year: number; [scheme: string]: number }[] {
  const map = new Map<number, Record<string, number>>()
  for (const r of records) {
    if (!map.has(r.year)) map.set(r.year, {})
    const entry = map.get(r.year)!
    entry[r.scheme] = (entry[r.scheme] ?? 0) + r.volume_thousands
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, schemes]) => ({ year, ...schemes }))
}

// Latest liable entity records (2024)
function latestLiableEntities(records: RECLiableEntityRecord[]): RECLiableEntityRecord[] {
  const maxYear = Math.max(...records.map(r => r.year))
  return records.filter(r => r.year === maxYear).sort((a, b) => b.compliance_pct - a.compliance_pct)
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function RECMarketAnalytics() {
  const [data, setData] = useState<RECDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      setRefreshing(true)
      const result = await getRECMarketDashboard()
      setData(result)
      setError(null)
    } catch (e) {
      setError('Failed to load REC market analytics data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={18} />
        Loading REC Market Analytics...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertTriangle className="mr-2" size={18} />
        {error ?? 'No data available'}
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>
  const lgcSpot        = summary.current_lgc_spot as number
  const stcPrice       = summary.current_stc_clearing_price as number
  const lgcCreated2024 = summary.total_lgcs_created_2024_thousands as number
  const lretAchv       = summary.lret_target_achievement_pct as number
  const voluntaryM     = summary.voluntary_market_size_m as number
  const nonCompliant   = summary.non_compliant_entities_2024 as number
  const largestTech    = summary.largest_creator_technology as string

  // Chart data
  const lgcChartData = data.lgc_prices.map((r: RECLGCPriceRecord) => ({
    month: r.month.slice(0, 7),
    'Spot': r.spot_price,
    'Fwd 1yr': r.forward_1yr_price,
    'Fwd 2yr': r.forward_2yr_price,
    'Fwd 3yr': r.forward_3yr_price,
  }))

  const stcChartData = data.stc_records.map((r: RECSTCRecord) => ({
    quarter: r.quarter,
    'Clearing Price ($)': r.clearing_price,
    'Created (000s)': r.stc_created_thousands / 1000,
    'Surrendered (000s)': r.stc_surrendered_thousands / 1000,
  }))

  const creationByTech = aggregateCreationByTechYear(data.creation)
  const technologies   = [...new Set(data.creation.map(r => r.technology))]

  const voluntaryByScheme = aggregateVoluntaryBySchemeYear(data.voluntary)
  const schemes           = [...new Set(data.voluntary.map(r => r.scheme))]

  const liableLatest = latestLiableEntities(data.liable_entities)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Award className="text-amber-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-white">
              Renewable Energy Certificate Analytics
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              LGC &amp; STC market microstructure — spot/forward prices, creation by technology,
              liable entity compliance, voluntary market
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 border border-gray-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
        <KpiCard
          title="LGC Spot Price"
          value={`$${lgcSpot.toFixed(2)}`}
          sub="$/certificate"
          icon={<DollarSign size={16} />}
          trend="up"
          trendLabel="+8.3% YoY"
        />
        <KpiCard
          title="STC Clearing Price"
          value={`$${stcPrice.toFixed(2)}`}
          sub="$/certificate"
          icon={<DollarSign size={16} />}
          trend="up"
          trendLabel="+4.6% YoY"
        />
        <KpiCard
          title="LGCs Created 2024"
          value={`${(lgcCreated2024 / 1000).toFixed(1)}M`}
          sub="certificates"
          icon={<Leaf size={16} />}
          trend="up"
          trendLabel="Record high"
        />
        <KpiCard
          title="LRET Achievement"
          value={`${lretAchv.toFixed(1)}%`}
          sub="of statutory target"
          icon={<CheckCircle size={16} />}
          trend="neutral"
          trendLabel="On track"
        />
        <KpiCard
          title="Voluntary Market"
          value={`$${voluntaryM}M`}
          sub="GreenPower + REGO + PPA RECs"
          icon={<BarChart2 size={16} />}
          trend="up"
          trendLabel="Growing 22% YoY"
        />
        <KpiCard
          title="Non-Compliant Entities"
          value={nonCompliant}
          sub="liable entities (2024)"
          icon={<AlertTriangle size={16} />}
          trend={nonCompliant > 0 ? 'down' : 'neutral'}
          trendLabel={nonCompliant > 0 ? 'Shortfall charges apply' : 'Full compliance'}
        />
        <KpiCard
          title="Largest Creator"
          value={largestTech}
          sub="by LGC volume"
          icon={<Award size={16} />}
          trend="neutral"
        />
      </div>

      {/* Section 1 — LGC Price History */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-400" />
          LGC Spot &amp; Forward Price History (2022–2024)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={lgcChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="month"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              interval={5}
              angle={-30}
              textAnchor="end"
              height={45}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => `$${v}`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, undefined]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <ReferenceLine y={40} stroke="#6b7280" strokeDasharray="4 2" label={{ value: '$40', fill: '#6b7280', fontSize: 10 }} />
            <Line type="monotone" dataKey="Spot"     stroke="#38bdf8" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="Fwd 1yr"  stroke="#34d399" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="Fwd 2yr"  stroke="#fbbf24" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="Fwd 3yr"  stroke="#f87171" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2">
          LGC forward curve shows term structure premium. Spot price reflects OTC and ASX Energy clearing.
        </p>
      </div>

      {/* Section 2 — STC Clearing Market */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <DollarSign size={16} className="text-yellow-400" />
          STC Clearing Market — Quarterly Price &amp; Volume (2022–2024)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stcChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" height={45} />
            <YAxis yAxisId="left"  tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v: number) => `${v}M`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar yAxisId="left"  dataKey="Clearing Price ($)"   fill="#fbbf24" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="right" dataKey="Created (000s)"       fill="#34d399" radius={[3, 3, 0, 0]} opacity={0.8} />
            <Bar yAxisId="right" dataKey="Surrendered (000s)"   fill="#38bdf8" radius={[3, 3, 0, 0]} opacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2">
          STCs are created by small-scale solar, hot water, and heat pump systems. Clearing house price
          is currently capped at $40 under the small-scale technology percentage.
        </p>
      </div>

      {/* Section 3 — Certificate Creation by Technology */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Leaf size={16} className="text-green-400" />
          LGC Creation by Technology (2024)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={creationByTech} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}M`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(v: number) => [`${v.toLocaleString()}k certs`, undefined]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {technologies.map(tech => (
              <Bar
                key={tech}
                dataKey={tech}
                stackId="creation"
                fill={TECH_COLORS[tech] ?? '#6b7280'}
                radius={technologies.indexOf(tech) === technologies.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2">
          Wind and large-scale solar dominate LGC creation. Stacked bars show contribution of each
          accredited technology aggregated across all NEM regions.
        </p>
      </div>

      {/* Section 4 — Liable Entity Compliance */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Users size={16} className="text-purple-400" />
          Liable Entity Compliance (2024)
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs border-b border-gray-700">
                  <th className="pb-2 pr-3">Entity</th>
                  <th className="pb-2 pr-3 text-right">Obligation (k)</th>
                  <th className="pb-2 pr-3 text-right">LGCs (k)</th>
                  <th className="pb-2 pr-3 text-right">Compliance</th>
                  <th className="pb-2 pr-3 text-right">Shortfall ($M)</th>
                  <th className="pb-2 text-right">Renew %</th>
                </tr>
              </thead>
              <tbody>
                {liableLatest.map((r: RECLiableEntityRecord) => (
                  <tr key={r.entity} className="border-b border-gray-700/40 hover:bg-gray-700/30 transition-colors">
                    <td className="py-2 pr-3 font-medium text-gray-200">{r.entity}</td>
                    <td className="py-2 pr-3 text-right text-gray-300">{r.surrender_obligation_thousands.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right text-gray-300">{r.lgcs_surrendered_thousands.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right">
                      <span className={`font-semibold ${r.compliance_pct >= 100 ? 'text-green-400' : r.compliance_pct >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {r.compliance_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <span className={r.lgc_shortfall_charges_m > 0 ? 'text-red-400' : 'text-green-400'}>
                        {r.lgc_shortfall_charges_m > 0 ? `$${r.lgc_shortfall_charges_m.toFixed(1)}M` : '—'}
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-300">{r.renewable_content_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar chart of renewable content */}
          <div>
            <p className="text-xs text-gray-400 mb-3">Renewable Content % by Entity (2024)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={liableLatest}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 80, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} domain={[0, 60]} tickFormatter={(v: number) => `${v}%`} />
                <YAxis type="category" dataKey="entity" tick={{ fill: '#9ca3af', fontSize: 10 }} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#e5e7eb' }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, 'Renewable Content']}
                />
                <ReferenceLine x={30} stroke="#6b7280" strokeDasharray="3 2" />
                <Bar dataKey="renewable_content_pct" fill="#a78bfa" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Shortfall charge is $65/MWh shortfall equivalent. Compliance &lt;100% triggers ATO-administered
          penalty.
        </p>
      </div>

      {/* Section 5 — Voluntary Market */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Award size={16} className="text-amber-400" />
          Voluntary Certificate Market by Scheme (2022–2024)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={voluntaryByScheme} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v: number) => `${v}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(v: number) => [`${v.toLocaleString()}k certs`, undefined]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {schemes.map(scheme => (
              <Bar
                key={scheme}
                dataKey={scheme}
                stackId="voluntary"
                fill={SCHEME_COLORS[scheme] ?? '#6b7280'}
                radius={schemes.indexOf(scheme) === schemes.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {data.voluntary
            .filter(r => r.year === Math.max(...data.voluntary.map(x => x.year)))
            .map((r: RECVoluntaryRecord) => (
              <div key={r.scheme} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600/40">
                <div className="text-xs text-gray-400 mb-1 truncate">{r.scheme.replace(/_/g, ' ')}</div>
                <div className="text-sm font-semibold text-white">${r.price_per_cert.toFixed(2)}/cert</div>
                <div className="text-xs text-gray-400 mt-1">{r.buyer_type} · {r.underlying_technology}</div>
              </div>
            ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Corporate PPA-linked RECs dominate voluntary market growth driven by ASX100 net-zero commitments.
          GreenPower remains the primary household product.
        </p>
      </div>

      {/* Footer note */}
      <div className="text-center text-xs text-gray-600 mt-4 pb-4">
        Sprint 77c — Data sourced from CER PowerClerk, ASX Energy, and Clean Energy Regulator RET reporting.
        Last updated: {new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}
      </div>
    </div>
  )
}
