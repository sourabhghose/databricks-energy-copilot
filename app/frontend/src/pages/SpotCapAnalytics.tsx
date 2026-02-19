import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  RefreshCw,
  Filter,
} from 'lucide-react'
import {
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
import {
  api,
  SpotCapDashboard,
  CptTrackerRecord,
  SpotCapEvent,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------
function fmtAUD(v: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(v)
}

function fmtPrice(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`
  return `$${v.toFixed(2)}`
}

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiCardProps {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
  highlight?: 'red' | 'amber' | 'blue' | 'green' | 'default'
}

function KpiCard({ title, value, sub, icon, highlight = 'default' }: KpiCardProps) {
  const colorMap: Record<string, string> = {
    red: 'border-red-500 bg-red-50 dark:bg-red-950',
    amber: 'border-amber-500 bg-amber-50 dark:bg-amber-950',
    blue: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
    green: 'border-green-500 bg-green-50 dark:bg-green-950',
    default: 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
  }
  const textMap: Record<string, string> = {
    red: 'text-red-700 dark:text-red-300',
    amber: 'text-amber-700 dark:text-amber-300',
    blue: 'text-blue-700 dark:text-blue-300',
    green: 'text-green-700 dark:text-green-300',
    default: 'text-gray-900 dark:text-gray-100',
  }

  return (
    <div className={`rounded-xl border-2 p-4 ${colorMap[highlight]}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
        <span className={highlight === 'default' ? 'text-gray-400' : textMap[highlight]}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${textMap[highlight]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CPT Progress Chart
// ---------------------------------------------------------------------------
interface CptProgressChartProps {
  records: CptTrackerRecord[]
  selectedRegion: string
  selectedQuarter: string
}

function CptProgressChart({ records, selectedRegion, selectedQuarter }: CptProgressChartProps) {
  // Get latest quarter data per region
  const latestQuarter = selectedQuarter || 'Q4-2025'
  const filtered = records.filter(
    r =>
      r.quarter === latestQuarter &&
      (selectedRegion === 'All' || r.region === selectedRegion)
  )

  const chartData = filtered.map(r => ({
    region: r.region,
    pct_of_cpt: r.pct_of_cpt,
    quarter: r.quarter,
  }))

  const getBarColor = (pct: number) => {
    if (pct >= 100) return '#ef4444'
    if (pct >= 80) return '#f59e0b'
    return '#3b82f6'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
        CPT Utilisation by Region — {latestQuarter}
      </h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        % of $1.3M cumulative price threshold consumed. Amber &gt; 80%, Red = breach.
      </p>
      {chartData.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-sm">No data for selected filters</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="region" tick={{ fontSize: 12, fill: '#9ca3af' }} />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={v => `${v}%`}
              domain={[0, Math.max(110, Math.ceil(Math.max(...chartData.map(d => d.pct_of_cpt)) / 10) * 10)]}
            />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(2)}%`, '% of CPT']}
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="pct_of_cpt" name="% of CPT" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.pct_of_cpt)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      <div className="flex gap-4 mt-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Normal (&lt; 80%)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> High (80–99%)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Breach (≥ 100%)</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cap Event Table
// ---------------------------------------------------------------------------
interface CapEventTableProps {
  events: SpotCapEvent[]
  selectedRegion: string
}

function CapEventTable({ events, selectedRegion }: CapEventTableProps) {
  const filtered = selectedRegion === 'All' ? events : events.filter(e => e.region === selectedRegion)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Cap & Floor Events</h3>
        <p className="text-xs text-gray-400 mt-0.5">Recent price cap ($15,500/MWh) and floor (–$1,000/MWh) events</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 uppercase text-[10px] tracking-wide">
              <th className="px-4 py-3 text-left">Event ID</th>
              <th className="px-4 py-3 text-left">Region</th>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-right">Spot Price</th>
              <th className="px-4 py-3 text-center">Floor Event</th>
              <th className="px-4 py-3 text-right">CPT Cumulative</th>
              <th className="px-4 py-3 text-right">Intervals Capped</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No events for selected region</td>
              </tr>
            ) : (
              filtered.map(event => (
                <tr
                  key={event.event_id}
                  className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-400">{event.event_id}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {event.region}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 font-mono">
                    {event.trading_interval.replace('T', ' ').substring(0, 16)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">
                    <span className={
                      event.below_floor
                        ? 'text-blue-600 dark:text-blue-400'
                        : event.spot_price >= event.market_price_cap
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }>
                      {fmtAUD(event.spot_price)}/MWh
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {event.below_floor ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                        <TrendingDown size={10} /> Floor
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
                        <TrendingUp size={10} /> Cap
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300 font-mono">
                    {fmtPrice(event.cumulative_price_at_interval)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {event.dispatch_intervals_capped > 0 ? (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {event.dispatch_intervals_capped}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Regional Summary Table
// ---------------------------------------------------------------------------
interface RegionalSummaryTableProps {
  dashboard: SpotCapDashboard
  selectedRegion: string
}

function RegionalSummaryTable({ dashboard, selectedRegion }: RegionalSummaryTableProps) {
  const summaries = selectedRegion === 'All'
    ? dashboard.regional_summaries
    : dashboard.regional_summaries.filter(s => s.region === selectedRegion)

  const cptThreshold = dashboard.cumulative_price_threshold_aud

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Regional Summary — 2025 YTD</h3>
        <p className="text-xs text-gray-400 mt-0.5">Aggregated cap & floor event statistics per NEM region</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 uppercase text-[10px] tracking-wide">
              <th className="px-4 py-3 text-left">Region</th>
              <th className="px-4 py-3 text-right">Cap Events</th>
              <th className="px-4 py-3 text-right">Floor Events</th>
              <th className="px-4 py-3 text-right">Avg Cap Price</th>
              <th className="px-4 py-3 text-right">CPT Breaches</th>
              <th className="px-4 py-3 text-right">Max Cum. Price</th>
              <th className="px-4 py-3 text-right">Revenue Impact</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(s => {
              const pctOfCpt = (s.max_cumulative_price / cptThreshold) * 100
              const isHighCpt = pctOfCpt >= 80
              return (
                <tr
                  key={s.region}
                  className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      dashboard.active_cpt_regions.includes(s.region)
                        ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      {s.region}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-semibold ${s.total_cap_events > 40 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {s.total_cap_events}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-blue-600 dark:text-blue-400 font-semibold">
                    {s.total_floor_events}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">
                    {fmtAUD(s.avg_price_during_cap_events)}/MWh
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {s.cpt_breaches > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 font-semibold">
                        <AlertTriangle size={9} /> {s.cpt_breaches}
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400 font-semibold">0</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`font-mono font-semibold ${isHighCpt ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {fmtPrice(s.max_cumulative_price)}
                      </span>
                      <span className={`text-[10px] ${isHighCpt ? 'text-amber-500' : 'text-gray-400'}`}>
                        {fmtPct(pctOfCpt)} of CPT
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                      ${s.revenue_impact_m_aud.toFixed(1)}M
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quarter selector helper
// ---------------------------------------------------------------------------
const QUARTERS = ['Q1-2025', 'Q2-2025', 'Q3-2025', 'Q4-2025']
const REGIONS = ['All', 'NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function SpotCapAnalytics() {
  const [dashboard, setDashboard] = useState<SpotCapDashboard | null>(null)
  const [cptRecords, setCptRecords] = useState<CptTrackerRecord[]>([])
  const [capEvents, setCapEvents] = useState<SpotCapEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState('All')
  const [selectedQuarter, setSelectedQuarter] = useState('Q4-2025')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, cpt, events] = await Promise.all([
        api.getSpotCapDashboard(),
        api.getCptTracker(),
        api.getCapEvents(),
      ])
      setDashboard(dash)
      setCptRecords(cpt)
      setCapEvents(events)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load Spot Cap data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-3 text-amber-500" size={28} />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading Spot Cap & CPT data…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center max-w-md">
          <AlertTriangle className="mx-auto mb-3 text-red-500" size={28} />
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Error loading data</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!dashboard) return null

  const totalCapEvents = dashboard.national_cap_events_ytd
  const totalFloorEvents = dashboard.national_floor_events_ytd
  const activeCptCount = dashboard.active_cpt_regions.length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-900 rounded-xl">
            <AlertTriangle className="text-amber-600 dark:text-amber-400" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Spot Price Cap & CPT Analytics
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Market price cap events, floor events, and Cumulative Price Threshold tracking
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 ml-2 self-center">
            <AlertTriangle size={11} />
            Market Price Cap ${dashboard.market_price_cap_aud.toLocaleString()}/MWh
          </span>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Market Price Cap"
          value={`$${dashboard.market_price_cap_aud.toLocaleString()}/MWh`}
          sub="AEMC regulatory ceiling"
          icon={<TrendingUp size={18} />}
          highlight="red"
        />
        <KpiCard
          title="Market Floor Price"
          value={`$${dashboard.market_floor_price_aud.toLocaleString()}/MWh`}
          sub="AEMC regulatory floor"
          icon={<TrendingDown size={18} />}
          highlight="blue"
        />
        <KpiCard
          title="CPT Threshold"
          value={`$${(dashboard.cumulative_price_threshold_aud / 1000).toFixed(0)}k/MWh`}
          sub={`${dashboard.cpt_period_days}-day rolling period`}
          icon={<Activity size={18} />}
          highlight="amber"
        />
        <KpiCard
          title="National Cap Events YTD"
          value={totalCapEvents.toString()}
          sub={`${totalFloorEvents} floor events • ${activeCptCount} active CPT regions`}
          icon={<DollarSign size={18} />}
          highlight={totalCapEvents > 150 ? 'red' : 'default'}
        />
      </div>

      {/* Active CPT Regions Banner */}
      {dashboard.active_cpt_regions.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0" size={18} />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Active CPT Monitoring: {dashboard.active_cpt_regions.join(', ')}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              These regions have cumulative prices exceeding $200,000/MWh — approaching CPT threshold
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Filter size={14} />
          <span className="font-medium">Region:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map(r => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedRegion === r
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 ml-2">
          <span className="font-medium">Quarter:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUARTERS.map(q => (
            <button
              key={q}
              onClick={() => setSelectedQuarter(q)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedQuarter === q
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* CPT Progress Chart */}
      <CptProgressChart
        records={cptRecords}
        selectedRegion={selectedRegion}
        selectedQuarter={selectedQuarter}
      />

      {/* Cap Event Table */}
      <CapEventTable events={capEvents} selectedRegion={selectedRegion} />

      {/* Regional Summary Table */}
      <RegionalSummaryTable dashboard={dashboard} selectedRegion={selectedRegion} />

      {/* Footer */}
      <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
        Last updated: {dashboard.timestamp} AEST • Data sourced from AEMO NEMWEB
      </div>
    </div>
  )
}
