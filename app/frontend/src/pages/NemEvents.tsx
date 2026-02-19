import { useEffect, useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Calendar, AlertTriangle } from 'lucide-react'
import { api } from '../api/client'
import type { MarketEventsDashboard, MarketEvent, MarketIntervention, PriceCapEvent } from '../api/client'

// ---------------------------------------------------------------------------
// Severity badge helper
// ---------------------------------------------------------------------------
const SEVERITY_CLASSES: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  HIGH:     'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  MEDIUM:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  LOW:      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_CLASSES[severity] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {severity}
    </span>
  )
}

// Cap type badge for APC / MPC
function CapTypeBadge({ capType }: { capType: string }) {
  const cls =
    capType === 'MPC'
      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {capType}
    </span>
  )
}

// Resolved / Active pill
function StatusPill({ resolved }: { resolved: boolean }) {
  return resolved ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
      Resolved
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 animate-pulse">
      Active
    </span>
  )
}

// Friendly label for event_type
const EVENT_TYPE_LABELS: Record<string, string> = {
  PRICE_CAP:        'Price Cap',
  PRICE_FLOOR:      'Price Floor',
  MARKET_SUSPENSION: 'Market Suspension',
  DIRECTION:        'Direction',
  LACK_OF_RESERVE:  'Lack of Reserve',
  RECLASSIFIED_EVENT: 'Reclassified Event',
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  PRICE_CAP:         '#ef4444',
  PRICE_FLOOR:       '#3b82f6',
  MARKET_SUSPENSION: '#7c3aed',
  DIRECTION:         '#f97316',
  LACK_OF_RESERVE:   '#eab308',
  RECLASSIFIED_EVENT: '#6b7280',
}

// Format ISO timestamp as short local string
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

function fmtMW(mw: number | null | undefined): string {
  if (mw == null) return '—'
  return `${mw.toLocaleString('en-AU')} MW`
}

function fmtAUD(aud: number | null | undefined): string {
  if (aud == null) return '—'
  return `$${aud.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`
}

function fmtSpotPrice(price: number): string {
  return `$${price.toLocaleString('en-AU', { maximumFractionDigits: 0 })}/MWh`
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: 'red' | 'orange' | 'blue' | 'green' | 'default'
  icon?: React.ReactNode
}

function KpiCard({ label, value, sub, accent = 'default', icon }: KpiCardProps) {
  const accentBorder: Record<string, string> = {
    red:     'border-l-red-500',
    orange:  'border-l-orange-500',
    blue:    'border-l-blue-500',
    green:   'border-l-green-500',
    default: 'border-l-indigo-500',
  }
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 ${accentBorder[accent]} p-4 flex flex-col gap-1`}>
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sortable column helper
// ---------------------------------------------------------------------------
type SortDir = 'asc' | 'desc'

function useSortState<T extends string>(defaultCol: T) {
  const [col, setCol] = useState<T>(defaultCol)
  const [dir, setDir] = useState<SortDir>('asc')

  function toggle(newCol: T) {
    if (newCol === col) {
      setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setCol(newCol)
      setDir('asc')
    }
  }

  function indicator(c: T) {
    if (c !== col) return ' ↕'
    return dir === 'asc' ? ' ↑' : ' ↓'
  }

  return { col, dir, toggle, indicator }
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
const REGIONS = ['All', 'NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

export default function NemEvents() {
  const [dashboard, setDashboard] = useState<MarketEventsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regionFilter, setRegionFilter] = useState<string>('All')

  useEffect(() => {
    setLoading(true)
    api
      .getMarketEventsDashboard()
      .then(data => {
        setDashboard(data)
        setError(null)
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  // Filtered subsets
  const filteredEvents: MarketEvent[] = useMemo(() => {
    if (!dashboard) return []
    return regionFilter === 'All'
      ? dashboard.recent_events
      : dashboard.recent_events.filter(e => e.region === regionFilter)
  }, [dashboard, regionFilter])

  const filteredInterventions: MarketIntervention[] = useMemo(() => {
    if (!dashboard) return []
    return regionFilter === 'All'
      ? dashboard.interventions
      : dashboard.interventions.filter(i => i.region === regionFilter)
  }, [dashboard, regionFilter])

  const filteredPriceCapEvents: PriceCapEvent[] = useMemo(() => {
    if (!dashboard) return []
    return regionFilter === 'All'
      ? dashboard.price_cap_events
      : dashboard.price_cap_events.filter(p => p.region === regionFilter)
  }, [dashboard, regionFilter])

  // Chart data — event type distribution
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredEvents.forEach(e => {
      counts[e.event_type] = (counts[e.event_type] ?? 0) + 1
    })
    return Object.entries(counts).map(([event_type, count]) => ({
      event_type,
      label: EVENT_TYPE_LABELS[event_type] ?? event_type,
      count,
      fill: EVENT_TYPE_COLORS[event_type] ?? '#6b7280',
    }))
  }, [filteredEvents])

  // Sort state for events table
  type EventCol = 'region' | 'event_type' | 'severity' | 'start_time' | 'duration_minutes'
  const evtSort = useSortState<EventCol>('start_time')

  const sortedEvents = useMemo(() => {
    const arr = [...filteredEvents]
    arr.sort((a, b) => {
      const av = a[evtSort.col] ?? ''
      const bv = b[evtSort.col] ?? ''
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else {
        cmp = String(av).localeCompare(String(bv))
      }
      return evtSort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filteredEvents, evtSort.col, evtSort.dir])

  // Sort state for interventions table
  type IntCol = 'region' | 'intervention_type' | 'directed_mw' | 'duration_hours' | 'issued_time'
  const intSort = useSortState<IntCol>('issued_time')

  const sortedInterventions = useMemo(() => {
    const arr = [...filteredInterventions]
    arr.sort((a, b) => {
      const av = a[intSort.col] ?? ''
      const bv = b[intSort.col] ?? ''
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else {
        cmp = String(av).localeCompare(String(bv))
      }
      return intSort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filteredInterventions, intSort.col, intSort.dir])

  // Sort for price cap events
  type PcCol = 'region' | 'date' | 'cap_type' | 'intervals_above_cap' | 'max_spot_price'
  const pcSort = useSortState<PcCol>('date')

  const sortedPriceCapEvents = useMemo(() => {
    const arr = [...filteredPriceCapEvents]
    arr.sort((a, b) => {
      const av = a[pcSort.col] ?? ''
      const bv = b[pcSort.col] ?? ''
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else {
        cmp = String(av).localeCompare(String(bv))
      }
      return pcSort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filteredPriceCapEvents, pcSort.col, pcSort.dir])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mr-3" />
        Loading market events data...
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <AlertTriangle size={20} className="mr-2" />
        {error ?? 'Failed to load market events data.'}
      </div>
    )
  }

  const thCls =
    'px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 dark:hover:text-gray-200 whitespace-nowrap'
  const tdCls = 'px-3 py-2 text-sm text-gray-700 dark:text-gray-300 align-top'
  const trCls =
    'border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors'

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* ------------------------------------------------------------------ */}
      {/* Header row                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Calendar className="text-indigo-500" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              NEM Market Events &amp; Interventions
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Price cap events, market suspensions, AEMO directions, and LOR declarations — real-time NEM monitoring
            </p>
          </div>
        </div>

        {/* Region filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Filter region:
          </label>
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {REGIONS.map(r => (
              <option key={r} value={r}>{r === 'All' ? 'All Regions' : r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* KPI cards                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Events"
          value={dashboard.total_events}
          sub="Last 30 days"
          accent="default"
          icon={<Calendar size={14} />}
        />
        <KpiCard
          label="Critical Events"
          value={dashboard.critical_events}
          sub="Severity: CRITICAL"
          accent="red"
          icon={<AlertTriangle size={14} />}
        />
        <KpiCard
          label="Interventions This Week"
          value={dashboard.interventions_this_week}
          sub="Directions + Reserve Traders"
          accent="orange"
          icon={<AlertTriangle size={14} />}
        />
        <KpiCard
          label="APC Hours This Month"
          value={`${dashboard.apc_hours_this_month} hrs`}
          sub="Administered Price Cap active time"
          accent="blue"
          icon={<Calendar size={14} />}
        />
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 max-w-md">
        <KpiCard
          label="LOR Events Today"
          value={dashboard.lor_events_today}
          sub="Lack of Reserve active"
          accent={dashboard.lor_events_today > 0 ? 'orange' : 'green'}
        />
        <KpiCard
          label="Active Directions"
          value={dashboard.directions_active}
          sub="AEMO directions in effect"
          accent={dashboard.directions_active > 0 ? 'red' : 'green'}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Event Type Distribution chart                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Event Type Distribution
          {regionFilter !== 'All' && (
            <span className="ml-2 text-xs font-normal text-gray-400">— {regionFilter}</span>
          )}
        </h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No events for selected region.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 0, right: 40, left: 20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                contentStyle={{
                  background: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#f9fafb',
                }}
                formatter={(value: number) => [value, 'Events']}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Recent Market Events table                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Recent Market Events
          </h2>
          <span className="text-xs text-gray-400">{sortedEvents.length} events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-750">
              <tr>
                <th className={thCls}>Event ID</th>
                <th className={thCls} onClick={() => evtSort.toggle('region')}>
                  Region{evtSort.indicator('region')}
                </th>
                <th className={thCls} onClick={() => evtSort.toggle('event_type')}>
                  Type{evtSort.indicator('event_type')}
                </th>
                <th className={thCls} onClick={() => evtSort.toggle('severity')}>
                  Severity{evtSort.indicator('severity')}
                </th>
                <th className={thCls}>Description</th>
                <th className={thCls} onClick={() => evtSort.toggle('start_time')}>
                  Start Time{evtSort.indicator('start_time')}
                </th>
                <th className={thCls} onClick={() => evtSort.toggle('duration_minutes')}>
                  Duration{evtSort.indicator('duration_minutes')}
                </th>
                <th className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-400">
                    No events match the selected filter.
                  </td>
                </tr>
              ) : (
                sortedEvents.map(evt => (
                  <tr key={evt.event_id} className={trCls}>
                    <td className={`${tdCls} font-mono text-xs`}>{evt.event_id}</td>
                    <td className={tdCls}>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {evt.region}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {EVENT_TYPE_LABELS[evt.event_type] ?? evt.event_type}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <SeverityBadge severity={evt.severity} />
                    </td>
                    <td className={`${tdCls} max-w-xs`}>
                      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 line-clamp-2">
                        {evt.description}
                      </p>
                      {evt.affected_capacity_mw != null && (
                        <span className="text-xs text-gray-400">
                          Affected: {fmtMW(evt.affected_capacity_mw)}
                        </span>
                      )}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>{fmtTime(evt.start_time)}</td>
                    <td className={tdCls}>
                      {evt.duration_minutes != null ? `${evt.duration_minutes} min` : '—'}
                    </td>
                    <td className={tdCls}>
                      <StatusPill resolved={evt.resolved} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Market Interventions table                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Market Interventions
          </h2>
          <span className="text-xs text-gray-400">{sortedInterventions.length} interventions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-750">
              <tr>
                <th className={thCls} onClick={() => intSort.toggle('intervention_type')}>
                  Type{intSort.indicator('intervention_type')}
                </th>
                <th className={thCls} onClick={() => intSort.toggle('region')}>
                  Region{intSort.indicator('region')}
                </th>
                <th className={thCls}>Station / DUID</th>
                <th className={thCls} onClick={() => intSort.toggle('directed_mw')}>
                  Directed MW{intSort.indicator('directed_mw')}
                </th>
                <th className={thCls} onClick={() => intSort.toggle('duration_hours')}>
                  Duration{intSort.indicator('duration_hours')}
                </th>
                <th className={thCls}>Est. Cost</th>
                <th className={thCls}>Reason</th>
                <th className={thCls} onClick={() => intSort.toggle('issued_time')}>
                  Issued{intSort.indicator('issued_time')}
                </th>
                <th className={thCls}>Notice ID</th>
              </tr>
            </thead>
            <tbody>
              {sortedInterventions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-400">
                    No interventions match the selected filter.
                  </td>
                </tr>
              ) : (
                sortedInterventions.map(item => (
                  <tr key={item.intervention_id} className={trCls}>
                    <td className={tdCls}>
                      <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                        {item.intervention_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {item.region}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {item.station_name ?? '—'}
                      </div>
                      {item.duid && (
                        <div className="text-xs text-gray-400 font-mono">{item.duid}</div>
                      )}
                    </td>
                    <td className={`${tdCls} font-semibold`}>{fmtMW(item.directed_mw)}</td>
                    <td className={tdCls}>{item.duration_hours} hrs</td>
                    <td className={tdCls}>{fmtAUD(item.cost_est_aud)}</td>
                    <td className={`${tdCls} max-w-xs`}>
                      <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-2">
                        {item.reason}
                      </p>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>{fmtTime(item.issued_time)}</td>
                    <td className={`${tdCls} font-mono text-xs`}>{item.market_notice_id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Price Cap Events table                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Price Cap Events (Last 30 Days)
          </h2>
          <span className="text-xs text-gray-400">{sortedPriceCapEvents.length} events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-750">
              <tr>
                <th className={thCls} onClick={() => pcSort.toggle('region')}>
                  Region{pcSort.indicator('region')}
                </th>
                <th className={thCls} onClick={() => pcSort.toggle('date')}>
                  Date{pcSort.indicator('date')}
                </th>
                <th className={thCls} onClick={() => pcSort.toggle('cap_type')}>
                  Cap Type{pcSort.indicator('cap_type')}
                </th>
                <th className={thCls}>Trigger Interval</th>
                <th className={thCls} onClick={() => pcSort.toggle('intervals_above_cap')}>
                  Intervals Above Cap{pcSort.indicator('intervals_above_cap')}
                </th>
                <th className={thCls}>Cumulative Energy</th>
                <th className={thCls} onClick={() => pcSort.toggle('max_spot_price')}>
                  Max Spot Price{pcSort.indicator('max_spot_price')}
                </th>
                <th className={thCls}>APC Duration</th>
              </tr>
            </thead>
            <tbody>
              {sortedPriceCapEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-400">
                    No price cap events for selected region.
                  </td>
                </tr>
              ) : (
                sortedPriceCapEvents.map(pc => (
                  <tr key={pc.event_id} className={trCls}>
                    <td className={tdCls}>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {pc.region}
                      </span>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>{pc.date}</td>
                    <td className={tdCls}>
                      <CapTypeBadge capType={pc.cap_type} />
                    </td>
                    <td className={`${tdCls} font-mono text-xs whitespace-nowrap`}>
                      {pc.trigger_interval}
                    </td>
                    <td className={`${tdCls} text-center font-semibold`}>
                      {pc.intervals_above_cap}
                    </td>
                    <td className={tdCls}>
                      {pc.cumulative_energy_mwh.toLocaleString('en-AU', { maximumFractionDigits: 1 })} MWh
                    </td>
                    <td className={`${tdCls} font-semibold text-red-600 dark:text-red-400 whitespace-nowrap`}>
                      {fmtSpotPrice(pc.max_spot_price)}
                    </td>
                    <td className={tdCls}>
                      {pc.total_apc_duration_hours != null
                        ? `${pc.total_apc_duration_hours} hrs`
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center pb-4">
        Data sourced from AEMO NEMWEB — Market Notice board, DISPATCH_UNIT_SOLUTION, and P5MIN tables.
        APC = Administered Price Cap ($300/MWh). MPC = Market Price Cap ($15,100/MWh).
      </p>
    </div>
  )
}
