import React, { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Thermometer, Zap, Wind, Sun, RefreshCw } from 'lucide-react'
import { api, WeatherDemandPoint, DemandResponseSummary } from '../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HoursOption = 12 | 24 | 48

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'] as const
type Region = typeof REGIONS[number]

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  completed: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(isoString: string, showDate: boolean): string {
  const d = new Date(isoString)
  if (showDate) {
    return d.toLocaleString('en-AU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

function formatActivationTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleString('en-AU', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  badge?: React.ReactNode
}

function SummaryCard({ icon, label, value, sub, badge }: SummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
        {badge}
      </div>
      {sub && <span className="text-xs text-gray-500 dark:text-gray-400">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DR region bar
// ---------------------------------------------------------------------------

interface RegionBarProps {
  regionSummaries: Record<string, number>
  totalEnrolled: number
}

function RegionBar({ regionSummaries, totalEnrolled }: RegionBarProps) {
  const maxMw = Math.max(...Object.values(regionSummaries), 1)
  return (
    <div className="space-y-2">
      {Object.entries(regionSummaries).map(([region, mw]) => (
        <div key={region} className="flex items-center gap-3">
          <span className="w-12 text-xs font-mono text-gray-500 dark:text-gray-400 text-right">{region}</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(mw / maxMw) * 100}%` }}
            />
          </div>
          <span className="w-16 text-xs text-gray-700 dark:text-gray-300 text-right">
            {mw.toFixed(0)} MW
          </span>
        </div>
      ))}
      <div className="text-xs text-gray-400 dark:text-gray-500 pt-1">
        Total enrolled capacity: {totalEnrolled.toFixed(0)} MW
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom tooltip for ComposedChart
// ---------------------------------------------------------------------------

function WeatherTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs shadow-lg">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100 ml-auto pl-4">
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function WeatherDemand() {
  const [region, setRegion] = useState<Region>('NSW1')
  const [hours, setHours] = useState<HoursOption>(24)
  const [weatherData, setWeatherData] = useState<WeatherDemandPoint[]>([])
  const [drData, setDrData] = useState<DemandResponseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [weather, dr] = await Promise.all([
        api.getWeatherDemand(region, hours),
        api.getDemandResponse(region),
      ])
      setWeatherData(weather)
      setDrData(dr)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [region, hours])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Most recent data point for summary cards
  const latest = weatherData[weatherData.length - 1]

  // Build chart data — format timestamps for X-axis
  const showDate = hours > 24
  const chartData = weatherData.map((pt) => ({
    time: formatTime(pt.timestamp, showDate),
    'Temperature (°C)': pt.temperature_c,
    'Demand (MW)': pt.demand_mw,
    'Baseline (MW)': pt.demand_baseline_mw,
  }))

  // Deviation badge for the demand card
  const deviationBadge = latest ? (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        latest.demand_deviation_mw >= 0
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
      }`}
    >
      {latest.demand_deviation_mw >= 0 ? '+' : ''}
      {latest.demand_deviation_mw.toFixed(0)} MW vs baseline
    </span>
  ) : null

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Weather &amp; Demand Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Temperature–demand correlation and demand response programs
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Region selector */}
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as Region)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Hours selector */}
          <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
            {([12, 24, 48] as HoursOption[]).map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  hours === h
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Last refresh timestamp */}
      <p className="text-xs text-gray-400 dark:text-gray-500 -mt-4">
        Last updated: {lastRefresh.toLocaleTimeString('en-AU')}
      </p>

      {/* Error banner */}
      {error && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
          {error} — showing cached or mock data.
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Weather summary cards                                               */}
      {/* ------------------------------------------------------------------ */}
      {loading && !latest ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-28 animate-pulse"
            />
          ))}
        </div>
      ) : latest ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={<Thermometer size={14} />}
            label="Current Temperature"
            value={`${latest.temperature_c}°C`}
            sub={`Region: ${latest.region}`}
          />
          <SummaryCard
            icon={<Thermometer size={14} className="text-amber-400" />}
            label="Feels Like"
            value={`${latest.apparent_temp_c}°C`}
            sub="Apparent temperature"
          />
          <SummaryCard
            icon={<Zap size={14} className="text-blue-500" />}
            label="Demand vs Baseline"
            value={`${latest.demand_mw.toFixed(0)} MW`}
            badge={deviationBadge}
          />
          <SummaryCard
            icon={<Sun size={14} className="text-yellow-500" />}
            label="Solar Irradiance"
            value={`${latest.solar_irradiance_wm2.toFixed(0)} W/m²`}
            sub={`Wind: ${latest.wind_speed_kmh} km/h`}
          />
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Temperature vs Demand chart                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Thermometer size={16} className="text-amber-500" />
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Temperature vs Electricity Demand
          </h2>
        </div>

        {loading && chartData.length === 0 ? (
          <div className="h-72 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                interval="preserveStartEnd"
              />
              {/* Left Y-axis: Temperature */}
              <YAxis
                yAxisId="temp"
                orientation="left"
                tick={{ fontSize: 11, fill: '#f59e0b' }}
                label={{
                  value: 'Temp (°C)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 11, fill: '#f59e0b' },
                }}
              />
              {/* Right Y-axis: Demand */}
              <YAxis
                yAxisId="demand"
                orientation="right"
                tick={{ fontSize: 11, fill: '#3b82f6' }}
                label={{
                  value: 'Demand (MW)',
                  angle: 90,
                  position: 'insideRight',
                  style: { fontSize: 11, fill: '#3b82f6' },
                }}
              />
              <Tooltip content={<WeatherTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {/* Temperature area */}
              <Area
                yAxisId="temp"
                type="monotone"
                dataKey="Temperature (°C)"
                stroke="#f59e0b"
                fill="#fef3c7"
                fillOpacity={0.4}
                strokeWidth={2}
                dot={false}
              />
              {/* Demand line */}
              <Line
                yAxisId="demand"
                type="monotone"
                dataKey="Demand (MW)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              {/* Baseline line (dashed) */}
              <Line
                yAxisId="demand"
                type="monotone"
                dataKey="Baseline (MW)"
                stroke="#9ca3af"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Baseline = long-run average demand for each hour of day. Deviation driven by temperature
          effect on cooling (AC) and heating load.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Demand Response section                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-green-500" />
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Demand Response Programs
          </h2>
        </div>

        {/* Summary strip */}
        {drData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Active Programs',   value: drData.active_programs.toString() },
              { label: 'Enrolled Capacity', value: `${drData.total_enrolled_mw.toFixed(0)} MW` },
              { label: 'Activated Today',   value: `${drData.total_activated_mw_today.toFixed(0)} MW` },
              { label: 'Events Today',      value: drData.events_today.toString() },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Events table */}
        {loading && !drData ? (
          <div className="h-40 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
        ) : drData && drData.events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {['Program', 'Region', 'Activation Time', 'Duration', 'MW Reduction', 'Participants', 'Trigger', 'Status'].map(
                    (col) => (
                      <th
                        key={col}
                        className="pb-2 pr-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {drData.events.map((event) => (
                  <tr key={event.event_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {event.program_name}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 font-mono text-xs">
                      {event.region}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                      {formatActivationTime(event.activation_time)}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {event.duration_minutes} min
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-gray-900 dark:text-gray-100">
                      {event.mw_reduction.toFixed(0)} MW
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400">
                      {event.participants.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {event.trigger_reason}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          STATUS_STYLES[event.status] ?? STATUS_STYLES.completed
                        }`}
                      >
                        {event.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No demand response events for this region.
          </p>
        )}

        {/* Region MW bar */}
        {drData && Object.keys(drData.region_summaries).length > 0 && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              MW Activated by Region (Today)
            </h3>
            <RegionBar
              regionSummaries={drData.region_summaries}
              totalEnrolled={drData.total_enrolled_mw}
            />
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Wind data note                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500">
        <Wind size={13} className="mt-0.5 flex-shrink-0" />
        <span>
          Wind speed included as a proxy for renewable generation output. Higher wind speeds
          generally reduce gas peaker dispatch and lower spot prices in wind-rich regions (SA1, TAS1).
        </span>
      </div>
    </div>
  )
}
