import React, { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Bell, AlertTriangle, Activity, RefreshCw, Radio } from 'lucide-react'
import { api, MarketNotice, DispatchSummary } from '../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NoticeTypeFilter = 'ALL' | 'CONSTRAINT' | 'LOR' | 'RECLASSIFICATION' | 'PRICE_LIMIT' | 'GENERAL'
type SeverityFilter = 'ALL' | 'INFO' | 'WARNING' | 'CRITICAL'
type RegionCode = 'NSW1' | 'QLD1' | 'VIC1' | 'SA1' | 'TAS1'
type CountOption = 12 | 24 | 48

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Australia/Sydney',
    })
  } catch {
    return isoString
  }
}

function formatDatetime(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleString('en-AU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Australia/Sydney',
    })
  } catch {
    return isoString
  }
}

function truncate(text: string, maxLen = 80): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SeverityBadgeProps {
  severity: string
  size?: 'sm' | 'md'
}

function SeverityBadge({ severity, size = 'sm' }: SeverityBadgeProps) {
  const base = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  const colours: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    WARNING:  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    INFO:     'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  }
  return (
    <span className={`inline-flex items-center rounded font-semibold ${base} ${colours[severity] ?? colours['INFO']}`}>
      {severity}
    </span>
  )
}

interface StatusBadgeProps {
  resolved: boolean
}

function StatusBadge({ resolved }: StatusBadgeProps) {
  return resolved ? (
    <span className="inline-flex items-center px-2 py-0.5 text-xs rounded font-semibold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
      Resolved
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 text-xs rounded font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
      Active
    </span>
  )
}

interface LorBadgeProps {
  level: 1 | 2 | 3
  count: number
}

function LorBadge({ level, count }: LorBadgeProps) {
  const colours: Record<number, string> = {
    1: 'bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/40 dark:border-amber-500 dark:text-amber-300',
    2: 'bg-orange-100 border-orange-400 text-orange-800 dark:bg-orange-900/40 dark:border-orange-500 dark:text-orange-300',
    3: 'bg-red-100 border-red-500 text-red-800 dark:bg-red-900/40 dark:border-red-500 dark:text-red-300',
  }
  const label = `LOR${level}`
  const desc: Record<number, string> = {
    1: 'Reserve < 1500 MW',
    2: 'Reserve < 1200 MW',
    3: 'Reserve < 750 MW',
  }
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 min-w-[140px] ${colours[level]}`}>
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={18} />
        <span className="text-lg font-bold">{label}</span>
      </div>
      <div className="text-2xl font-extrabold">{count}</div>
      <div className="text-xs mt-1 font-medium">{desc[level]}</div>
      <div className="text-xs mt-0.5 opacity-75">{count === 0 ? 'No active alerts' : 'Active'}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Recharts tooltip
// ---------------------------------------------------------------------------

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function DispatchTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs text-gray-100 shadow-xl">
      <div className="font-semibold mb-2 text-gray-300">{label}</div>
      {payload.map(entry => (
        <div key={entry.name} className="flex justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-mono">${entry.value.toFixed(2)}/MWh</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MarketNotices() {
  // --- State ---
  const [notices, setNotices] = useState<MarketNotice[]>([])
  const [dispatch, setDispatch] = useState<DispatchSummary | null>(null)
  const [loadingNotices, setLoadingNotices] = useState(true)
  const [loadingDispatch, setLoadingDispatch] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [typeFilter, setTypeFilter] = useState<NoticeTypeFilter>('ALL')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')
  const [dispatchRegion, setDispatchRegion] = useState<RegionCode>('NSW1')
  const [dispatchCount, setDispatchCount] = useState<CountOption>(12)

  // --- Data fetching ---
  const fetchNotices = useCallback(async () => {
    setLoadingNotices(true)
    try {
      const data = await api.getMarketNotices(
        severityFilter !== 'ALL' ? severityFilter : undefined,
        typeFilter !== 'ALL' ? typeFilter : undefined,
        50,
      )
      setNotices(data)
      setError(null)
    } catch (err) {
      setError('Failed to load market notices')
      console.error(err)
    } finally {
      setLoadingNotices(false)
    }
  }, [typeFilter, severityFilter])

  const fetchDispatch = useCallback(async () => {
    setLoadingDispatch(true)
    try {
      const data = await api.getDispatchIntervals(dispatchRegion, dispatchCount)
      setDispatch(data)
    } catch (err) {
      console.error('Failed to load dispatch intervals', err)
    } finally {
      setLoadingDispatch(false)
    }
  }, [dispatchRegion, dispatchCount])

  const refresh = useCallback(() => {
    fetchNotices()
    fetchDispatch()
  }, [fetchNotices, fetchDispatch])

  useEffect(() => { fetchNotices() }, [fetchNotices])
  useEffect(() => { fetchDispatch() }, [fetchDispatch])

  // --- Derived values ---
  const activeNotices = notices.filter(n => !n.resolved)

  const lorCount = (level: 1 | 2 | 3) =>
    activeNotices.filter(n => n.notice_type === 'LOR' && n.notice_id.startsWith(`LOR${level}`)).length

  // Fallback: count LOR notices by matching the label in the reason / external_reference
  const lorCountByKeyword = (level: 1 | 2 | 3) =>
    activeNotices.filter(n => {
      if (n.notice_type !== 'LOR') return false
      const combined = (n.notice_id + n.external_reference + n.reason).toUpperCase()
      return combined.includes(`LOR${level}`)
    }).length

  const lor1Count = lorCountByKeyword(1)
  const lor2Count = lorCountByKeyword(2)
  const lor3Count = lorCountByKeyword(3)

  // Filtered notices for the table (already pre-filtered by API, but apply local fallback)
  const filteredNotices = notices.filter(n => {
    const typeOk = typeFilter === 'ALL' || n.notice_type === typeFilter
    const sevOk = severityFilter === 'ALL' || n.severity === severityFilter
    return typeOk && sevOk
  })

  // Chart data
  const chartData = (dispatch?.intervals ?? []).map(iv => ({
    time: formatTime(iv.interval_datetime),
    'Dispatch RRP': iv.rrp,
    'Pre-dispatch RRP': iv.predispatch_rrp,
    deviation: iv.rrp_deviation,
  }))

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">

      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="text-amber-400" size={26} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Market Notices &amp; Dispatch
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              AEMO market notices and 5-minute dispatch interval analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-semibold">
            <Radio size={12} className="animate-pulse" />
            AEMO LIVE
          </span>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} className={(loadingNotices || loadingDispatch) ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ---- Error banner ---- */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* ---- Active LOR Alert Strip ---- */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-red-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Active Reserve Alerts
          </h2>
        </div>
        <div className="flex flex-wrap gap-4">
          <LorBadge level={1} count={lor1Count} />
          <LorBadge level={2} count={lor2Count} />
          <LorBadge level={3} count={lor3Count} />
          <div className="flex flex-col justify-center ml-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
            <p className="font-medium text-gray-700 dark:text-gray-200 mb-1">Lack of Reserve (LOR)</p>
            <p>LOR1: Reserve margin below the threshold — generators requested to increase output.</p>
            <p className="mt-1">LOR2/3: Critical reserve shortage — AEMO may direct large industrial loads to reduce consumption.</p>
          </div>
        </div>
      </section>

      {/* ---- Market Notices Table ---- */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Table header + filters */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-amber-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Market Notices</h2>
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              {filteredNotices.length} notices
              {filteredNotices.filter(n => !n.resolved).length > 0 && (
                <span className="ml-1 text-red-500 font-medium">
                  ({filteredNotices.filter(n => !n.resolved).length} active)
                </span>
              )}
            </span>
          </div>

          {/* Type filter */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1">Type:</span>
            {(['ALL', 'CONSTRAINT', 'LOR', 'RECLASSIFICATION', 'PRICE_LIMIT', 'GENERAL'] as NoticeTypeFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={[
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  typeFilter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ].join(' ')}
              >
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase().replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Severity filter */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1">Severity:</span>
            {(['ALL', 'INFO', 'WARNING', 'CRITICAL'] as SeverityFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={[
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  severityFilter === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ].join(' ')}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Table body */}
        <div className="overflow-x-auto">
          {loadingNotices ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredNotices.length === 0 ? (
            <div className="p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
              No notices match the current filters.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Notice ID</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Regions</th>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredNotices.map(notice => (
                  <tr
                    key={notice.notice_id}
                    className={[
                      'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                      !notice.resolved && notice.severity === 'CRITICAL'
                        ? 'bg-red-50/40 dark:bg-red-900/10'
                        : '',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDatetime(notice.creation_date)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {notice.notice_id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {notice.notice_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {notice.regions_affected.map(r => (
                          <span
                            key={r}
                            className="px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={notice.severity} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 max-w-xs">
                      <span title={notice.reason}>{truncate(notice.reason, 80)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge resolved={notice.resolved} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ---- Dispatch Interval Analysis ---- */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Section header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-blue-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Dispatch Interval Analysis
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                Dispatch RRP vs Pre-dispatch Forecast
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Region selector */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 dark:text-gray-400">Region</label>
                <select
                  value={dispatchRegion}
                  onChange={e => setDispatchRegion(e.target.value as RegionCode)}
                  className="text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-none px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {(['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'] as RegionCode[]).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Count selector */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 dark:text-gray-400">Window</label>
                <select
                  value={dispatchCount}
                  onChange={e => setDispatchCount(Number(e.target.value) as CountOption)}
                  className="text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-none px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={12}>1 hour (12 intervals)</option>
                  <option value={24}>2 hours (24 intervals)</option>
                  <option value={48}>4 hours (48 intervals)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="px-5 py-4">
          {loadingDispatch ? (
            <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse flex items-center justify-center">
              <span className="text-gray-400 dark:text-gray-500 text-sm">Loading dispatch data…</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v}`}
                  width={60}
                />
                <Tooltip content={<DispatchTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(value) => (
                    <span style={{ color: '#9CA3AF' }}>{value}</span>
                  )}
                />
                {/* Deviation threshold reference lines */}
                <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '+$50', fill: '#EF4444', fontSize: 10 }} />
                <ReferenceLine y={-50} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '-$50', fill: '#EF4444', fontSize: 10 }} />
                {/* Bars for Dispatch RRP */}
                <Bar dataKey="Dispatch RRP" fill="#3B82F6" opacity={0.8} radius={[2, 2, 0, 0]} />
                {/* Line for Pre-dispatch RRP */}
                <Line
                  dataKey="Pre-dispatch RRP"
                  stroke="#F97316"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  type="monotone"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Summary stats */}
        {dispatch && !loadingDispatch && (
          <div className="px-5 pb-5">
            <div className="grid grid-cols-3 gap-4">
              {/* Mean deviation */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Mean Deviation</div>
                <div className={[
                  'text-2xl font-bold',
                  dispatch.mean_deviation > 30
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-gray-800 dark:text-gray-100',
                ].join(' ')}>
                  ${dispatch.mean_deviation.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">/MWh avg abs deviation</div>
              </div>

              {/* Max surprise */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Surprise</div>
                <div className={[
                  'text-2xl font-bold',
                  dispatch.max_surprise > 100
                    ? 'text-red-500 dark:text-red-400'
                    : dispatch.max_surprise > 50
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-gray-800 dark:text-gray-100',
                ].join(' ')}>
                  ${dispatch.max_surprise.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">/MWh largest deviation</div>
              </div>

              {/* Surprise intervals */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Surprise Intervals</div>
                <div className={[
                  'text-2xl font-bold',
                  dispatch.surprise_intervals > 3
                    ? 'text-red-500 dark:text-red-400'
                    : dispatch.surprise_intervals > 0
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-green-600 dark:text-green-400',
                ].join(' ')}>
                  {dispatch.surprise_intervals}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  intervals with |dev| &gt; $50/MWh
                </div>
              </div>
            </div>

            {/* Legend explanation */}
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
              <span className="text-blue-400 font-medium">Dispatch RRP</span> — actual 5-minute spot price cleared in dispatch.{' '}
              <span className="text-orange-400 font-medium">Pre-dispatch RRP</span> — forecast made ~30 minutes earlier.{' '}
              The <span className="text-red-400 font-medium">±$50/MWh dotted lines</span> mark the surprise threshold.
              Deviation = Dispatch RRP − Pre-dispatch RRP; positive values indicate upside price surprises.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
