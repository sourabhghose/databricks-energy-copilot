import React, { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Activity, Zap, AlertTriangle, Radio, RefreshCw } from 'lucide-react'
import { api, FrequencyDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bandColor(band: string): string {
  switch (band) {
    case 'normal':
      return 'text-green-600 dark:text-green-400'
    case 'warning':
      return 'text-amber-600 dark:text-amber-400'
    case 'emergency':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

function bandBg(band: string): string {
  switch (band) {
    case 'normal':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'warning':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    case 'emergency':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

function rocofRiskBg(risk: string): string {
  switch (risk) {
    case 'low':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'medium':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    case 'high':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

function eventTypeBadge(eventType: string): string {
  switch (eventType) {
    case 'under_frequency':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'over_frequency':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    case 'rocof_event':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    case 'load_shedding':
      return 'bg-red-100 text-red-900 font-bold dark:bg-red-900/40 dark:text-red-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Australia/Sydney',
  })
}

function formatChartTime(isoString: string): string {
  const d = new Date(isoString)
  const mm = d.getUTCMinutes().toString().padStart(2, '0')
  const ss = d.getUTCSeconds().toString().padStart(2, '0')
  return `${mm}:${ss}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string
  value: string
  sub?: string
  colorClass?: string
  icon?: React.ReactNode
}

function StatCard({ label, value, sub, colorClass = '', icon }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold font-mono ${colorClass}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FrequencyAnalytics() {
  const [data, setData] = useState<FrequencyDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchDashboard = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const result = await api.getFrequencyDashboard()
      setData(result)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch frequency data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Auto-refresh every 5 seconds (tight loop for frequency data)
  useEffect(() => {
    const interval = setInterval(() => fetchDashboard(), 5000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          <AlertTriangle className="inline mr-2" size={16} />
          {error ?? 'No data available'}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Chart data
  // ---------------------------------------------------------------------------

  const chartData = data.recent_frequency.map((rec) => ({
    time: formatChartTime(rec.timestamp),
    hz: rec.frequency_hz,
    band: rec.band,
  }))

  const freqMin = 49.7
  const freqMax = 50.3

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="text-purple-500" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              System Frequency &amp; Inertia
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              NEM real-time frequency, ROCOF and system strength analytics
            </p>
          </div>
          {/* LIVE badge */}
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {lastUpdated && (
            <span>Updated {lastUpdated.toLocaleTimeString('en-AU')}</span>
          )}
          <button
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Current Frequency Gauge + Summary Cards                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Large frequency display */}
        <div className="col-span-2 md:col-span-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 flex flex-col items-center justify-center text-center gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            <Activity size={14} />
            Current Frequency
          </div>
          <div className={`text-4xl font-bold font-mono ${bandColor(data.current_band)}`}>
            {data.current_frequency_hz.toFixed(3)} Hz
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${bandBg(data.current_band)}`}>
              {data.current_band.toUpperCase()}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            ROCOF: <span className="font-mono font-semibold">{data.current_rocof.toFixed(4)} Hz/s</span>
          </div>
        </div>

        <StatCard
          label="ROCOF"
          value={`${data.current_rocof.toFixed(4)} Hz/s`}
          sub="Rate of Change of Frequency"
          colorClass={Math.abs(data.current_rocof) > 0.5 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}
          icon={<Zap size={12} />}
        />

        <StatCard
          label="Total Synchronous Inertia"
          value={`${(data.total_synchronous_inertia_mws / 1000).toFixed(1)} GWs`}
          sub="NEM-wide synchronous inertia"
          colorClass="text-gray-900 dark:text-gray-100"
          icon={<Activity size={12} />}
        />

        <StatCard
          label="Frequency Band"
          value={data.current_band.charAt(0).toUpperCase() + data.current_band.slice(1)}
          sub={`Dev: ${(data.current_frequency_hz - 50.0 >= 0 ? '+' : '')}${(data.current_frequency_hz - 50.0).toFixed(4)} Hz`}
          colorClass={bandColor(data.current_band)}
          icon={<Radio size={12} />}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Frequency Trend Chart (last 5 minutes)                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Frequency Trend — Last 5 Minutes (5-second intervals)
          </h2>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-green-500 inline-block" /> Normal band
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-amber-400 border-dashed inline-block" /> Warning band
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10 }}
              interval={11}
              tickFormatter={(v) => v}
            />
            <YAxis
              domain={[freqMin, freqMax]}
              tickCount={7}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => v.toFixed(2)}
              width={52}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(4)} Hz`, 'Frequency']}
              labelFormatter={(label) => `Time: ${label}`}
            />
            {/* Normal band boundaries */}
            <ReferenceLine
              y={50.15}
              stroke="#22c55e"
              strokeDasharray="4 2"
              label={{ value: '50.15', position: 'right', fontSize: 9, fill: '#22c55e' }}
            />
            <ReferenceLine
              y={49.85}
              stroke="#22c55e"
              strokeDasharray="4 2"
              label={{ value: '49.85', position: 'right', fontSize: 9, fill: '#22c55e' }}
            />
            {/* Warning band boundaries */}
            <ReferenceLine
              y={50.5}
              stroke="#f59e0b"
              strokeDasharray="2 4"
              label={{ value: '50.5', position: 'right', fontSize: 9, fill: '#f59e0b' }}
            />
            <ReferenceLine
              y={49.5}
              stroke="#f59e0b"
              strokeDasharray="2 4"
              label={{ value: '49.5', position: 'right', fontSize: 9, fill: '#f59e0b' }}
            />
            {/* Nominal 50 Hz line */}
            <ReferenceLine y={50.0} stroke="#6b7280" strokeDasharray="6 3" />
            <Line
              type="monotone"
              dataKey="hz"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Inertia by Region Table                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Zap size={16} className="text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Inertia by Region
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {[
                  'Region',
                  'Synchronous (MWs)',
                  'Synthetic (MWs)',
                  'Total (MWs)',
                  'Min Required',
                  'Adequate?',
                  'ROCOF Risk',
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.inertia_by_region.map((row) => (
                <tr
                  key={row.region}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">
                    {row.region}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">
                    {row.synchronous_mws.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">
                    {row.synthetic_mws.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-gray-900 dark:text-gray-100">
                    {row.total_inertia_mws.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">
                    {row.min_inertia_requirement_mws.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        row.inertia_adequate
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {row.inertia_adequate ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${rocofRiskBg(row.rocof_risk)}`}
                    >
                      {row.rocof_risk}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Frequency Events Log (last 24h)                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Frequency Events — Last 24 Hours
          </h2>
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            {data.recent_events.length} events
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {[
                  'Time',
                  'Type',
                  'Region',
                  'Duration (s)',
                  'Min Freq (Hz)',
                  'Max ROCOF (Hz/s)',
                  'Cause',
                  'UFLS?',
                  'MW Shed',
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.recent_events.map((ev) => (
                <tr
                  key={ev.event_id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {formatTime(ev.start_time)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${eventTypeBadge(ev.event_type)}`}>
                      {formatEventType(ev.event_type)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">
                    {ev.region}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">
                    {ev.duration_seconds.toFixed(0)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">
                    {ev.min_frequency.toFixed(3)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">
                    {ev.max_rocof.toFixed(3)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 max-w-xs truncate" title={ev.cause}>
                    {ev.cause}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        ev.ufls_activated
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      }`}
                    >
                      {ev.ufls_activated ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">
                    {ev.mw_shed > 0 ? ev.mw_shed.toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
              {data.recent_events.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm"
                  >
                    No frequency events in the past 24 hours
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Footer notes                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
        <p>
          NEM normal frequency band: 49.85–50.15 Hz. Warning band: 49.5–50.5 Hz. Emergency: &lt;49.5 Hz or &gt;50.5 Hz.
        </p>
        <p>
          ROCOF (Rate of Change of Frequency) — AEMO requires &lt; ±1 Hz/s under credible contingency.
          UFLS (Under Frequency Load Shedding) activates below 49.0 Hz.
        </p>
        <p>
          Synthetic inertia provided by FFR (Fast Frequency Response) capable units: batteries, DFIG wind turbines, HVDC links.
        </p>
      </div>
    </div>
  )
}
