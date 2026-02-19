import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  LineChart,
  Line,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { AlertTriangle, Users } from 'lucide-react'
import { api } from '../api/client'
import type { MarketPowerDashboard, HhiRecord, PivotalSupplierRecord, MarketShareTrend } from '../api/client'

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function hhiColor(score: number): string {
  if (score >= 2500) return 'text-red-600 dark:text-red-400'
  if (score >= 1500) return 'text-amber-600 dark:text-amber-400'
  return 'text-green-600 dark:text-green-400'
}

function hhiBgColor(score: number): string {
  if (score >= 2500) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  if (score >= 1500) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
}

function structureBadgeClass(structure: string): string {
  switch (structure) {
    case 'HIGHLY_CONCENTRATED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'MODERATELY_CONCENTRATED':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    default:
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }
}

function pivotalBadgeClass(status: string): string {
  switch (status) {
    case 'PIVOTAL':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'QUASI_PIVOTAL':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    default:
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }
}

function rsiColor(rsi: number): string {
  if (rsi < 0.9) return 'text-red-600 dark:text-red-400 font-semibold'
  if (rsi < 1.0) return 'text-amber-600 dark:text-amber-400 font-semibold'
  return 'text-green-600 dark:text-green-400 font-semibold'
}

function trendIcon(direction: string): JSX.Element {
  switch (direction) {
    case 'IMPROVING':
      return <span className="text-green-600 dark:text-green-400 font-bold">&darr; IMPROVING</span>
    case 'DETERIORATING':
      return <span className="text-red-600 dark:text-red-400 font-bold">&uarr; DETERIORATING</span>
    default:
      return <span className="text-amber-600 dark:text-amber-400 font-bold">&rarr; STABLE</span>
  }
}

function concentrationTrendClass(trend: string): string {
  switch (trend) {
    case 'IMPROVING':
      return 'text-green-600 dark:text-green-400'
    case 'DETERIORATING':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-amber-600 dark:text-amber-400'
  }
}

function reviewStatusBadge(status: string): JSX.Element {
  const classes: Record<string, string> = {
    UNDER_REVIEW: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    MONITORING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    CLEARED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  }
  const cls = classes[status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Custom bar colour for HHI chart
// ---------------------------------------------------------------------------
interface HhiBarEntry {
  label: string
  hhi_score: number
  fill: string
}

function buildHhiBarData(records: HhiRecord[]): HhiBarEntry[] {
  return records.map((r) => {
    const label = r.fuel_type ? `${r.fuel_type}` : r.region
    const fill = r.hhi_score >= 2500 ? '#ef4444' : r.hhi_score >= 1500 ? '#f59e0b' : '#22c55e'
    return { label, hhi_score: r.hhi_score, fill }
  })
}

// ---------------------------------------------------------------------------
// Market share trend data shaped for recharts
// ---------------------------------------------------------------------------
interface SharePoint {
  period: string
  'AGL Energy': number
  'Origin Energy': number
  EnergyAustralia: number
}

function buildShareTrendData(trends: MarketShareTrend[]): SharePoint[] {
  const periodMap = new Map<string, SharePoint>()
  for (const t of trends) {
    const period = `${t.year} ${t.quarter}`
    if (!periodMap.has(period)) {
      periodMap.set(period, {
        period,
        'AGL Energy': 0,
        'Origin Energy': 0,
        EnergyAustralia: 0,
      })
    }
    const entry = periodMap.get(period)!
    if (t.participant_name === 'AGL Energy') entry['AGL Energy'] = t.generation_share_pct
    else if (t.participant_name === 'Origin Energy') entry['Origin Energy'] = t.generation_share_pct
    else if (t.participant_name === 'EnergyAustralia') entry['EnergyAustralia'] = t.generation_share_pct
  }
  return Array.from(periodMap.values()).sort((a, b) => a.period.localeCompare(b.period))
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  valueClass?: string
  icon?: JSX.Element
}

function KpiCard({ title, value, subtitle, valueClass, icon }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</span>
        {icon && <span className="text-gray-400 dark:text-gray-500">{icon}</span>}
      </div>
      <span className={`text-2xl font-bold ${valueClass ?? 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </span>
      {subtitle && <span className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom bar shape for colour-per-bar
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ColourBar(props: any) {
  const { x, y, width, height, fill } = props
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function MarketPower() {
  const [dashboard, setDashboard] = useState<MarketPowerDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .getMarketPowerDashboard()
      .then((d) => {
        setDashboard(d)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading market power data…</span>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="p-6 text-red-600 dark:text-red-400">
        <AlertTriangle size={20} className="inline mr-2" />
        Failed to load: {error ?? 'No data'}
      </div>
    )
  }

  const hhiBarData = buildHhiBarData(dashboard.hhi_records)
  const shareTrendData = buildShareTrendData(dashboard.share_trends)

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                             */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle size={24} className="text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Market Power &amp; Concentration Analytics
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              HHI, Pivotal Supplier Analysis, ACCC/AER Monitoring
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">Review Status:</span>
          {reviewStatusBadge(dashboard.market_review_status)}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* KPI Cards                                                          */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="NEM Overall HHI"
          value={dashboard.nem_overall_hhi.toFixed(0)}
          subtitle="Herfindahl-Hirschman Index (0-10000)"
          valueClass={hhiColor(dashboard.nem_overall_hhi)}
          icon={<AlertTriangle size={18} />}
        />
        <KpiCard
          title="SA1 HHI (Most Concentrated)"
          value={dashboard.sa1_hhi.toFixed(0)}
          subtitle="&gt;2500 = Highly concentrated"
          valueClass={hhiColor(dashboard.sa1_hhi)}
          icon={<AlertTriangle size={18} />}
        />
        <KpiCard
          title="Pivotal Suppliers"
          value={`${dashboard.pivotal_suppliers_count} pivotal / ${dashboard.quasi_pivotal_count} quasi`}
          subtitle="Participants with RSI < 1.0"
          icon={<Users size={18} />}
        />
        <KpiCard
          title="Concentration Trend"
          value={dashboard.concentration_trend}
          subtitle="NEM-wide directional change"
          valueClass={concentrationTrendClass(dashboard.concentration_trend)}
          icon={<AlertTriangle size={18} />}
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Charts row                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* HHI by Region / Fuel BarChart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            HHI Score by Region &amp; Fuel Type
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            Green &lt;1500 competitive · Amber 1500–2500 moderate · Red &gt;2500 concentrated
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hhiBarData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                domain={[0, 4000]}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(v) => v.toLocaleString()}
              />
              <Tooltip
                formatter={(val: number) => [val.toFixed(0), 'HHI Score']}
                contentStyle={{ fontSize: 12 }}
              />
              <ReferenceLine y={1500} stroke="#22c55e" strokeDasharray="4 4" label={{ value: '1500 (Competitive)', position: 'insideTopRight', fontSize: 10, fill: '#22c55e' }} />
              <ReferenceLine y={2500} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '2500 (Concentrated)', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
              <Bar dataKey="hhi_score" shape={<ColourBar />} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Market Share Trend LineChart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Generation Market Share Trend
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            Big 3 market share erosion as new entrants grow
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={shareTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis
                domain={[10, 30]}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(val: number) => [`${val.toFixed(1)}%`, '']}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="AGL Energy"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Origin Energy"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="EnergyAustralia"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* HHI Details Table                                                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">HHI Details</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Concentration by region and fuel type with trend direction
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {['Region / Fuel', 'HHI Score', 'Structure', 'Competitors', 'Top 3 Share', 'Trend', 'YoY Change'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {dashboard.hhi_records.map((rec, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {rec.fuel_type ? (
                      <span>
                        <span className="text-gray-400 text-xs">{rec.region} /</span> {rec.fuel_type}
                      </span>
                    ) : (
                      rec.region
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${hhiBgColor(rec.hhi_score)}`}>
                      {rec.hhi_score.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${structureBadgeClass(rec.market_structure)}`}>
                      {rec.market_structure.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {rec.num_competitors}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {rec.top3_share_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {trendIcon(rec.trend_direction)}
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${rec.change_vs_last_year > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {rec.change_vs_last_year > 0 ? '+' : ''}{rec.change_vs_last_year.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Pivotal Suppliers Table                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Users size={16} className="text-gray-500 dark:text-gray-400" />
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pivotal Supplier Analysis</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              RSI &lt; 1.0 indicates pivotal market position · ACCC/AER monitoring
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {['Participant', 'Region', 'Status', 'Capacity (MW)', 'RSI', 'Pivotal Freq %', 'Strategic MW', 'Avg Rebids/Day'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {dashboard.pivotal_suppliers.map((s) => (
                <tr key={s.participant_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {s.participant_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium">
                      {s.region}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${pivotalBadgeClass(s.pivotal_status)}`}>
                      {s.pivotal_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {s.capacity_mw.toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-sm ${rsiColor(s.residual_supply_index)}`}>
                    {s.residual_supply_index.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {s.occurrence_frequency_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {s.strategic_capacity_mw.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {s.avg_rebids_per_day.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
        Data source: AEMO dispatch data · ACCC/AER market monitoring · Updated hourly
      </p>
    </div>
  )
}
