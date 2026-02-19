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
} from 'recharts'
import { Battery, BatteryCharging, Zap, DollarSign, RefreshCw } from 'lucide-react'
import { api, BessFleetSummary, BessDispatchInterval } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(isoStr: string): string {
  const d = new Date(isoStr)
  const hh = d.getUTCHours().toString().padStart(2, '0')
  const mm = d.getUTCMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

function socColor(soc: number): string {
  if (soc > 60) return 'bg-green-500'
  if (soc > 30) return 'bg-amber-500'
  return 'bg-red-500'
}

function modeBadge(mode: string): string {
  switch (mode) {
    case 'discharging': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'charging':    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'standby':     return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    default:            return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }
}

function mwColor(mw: number): string {
  if (mw > 0) return 'text-green-600 dark:text-green-400'
  if (mw < 0) return 'text-blue-600 dark:text-blue-400'
  return 'text-gray-500 dark:text-gray-400'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}

function SummaryCard({ icon, label, value, sub }: SummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-3">
      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-semibold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// Custom tooltip for the dispatch chart
interface DispatchTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function DispatchTooltip({ active, payload, label }: DispatchTooltipProps) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-white shadow-lg">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
          {p.name === 'Price ($/MWh)' ? ' $/MWh' : p.name === 'SOC (%)' ? '%' : ' MW'}
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function BessAnalytics() {
  const [fleet, setFleet] = useState<BessFleetSummary | null>(null)
  const [dispatch, setDispatch] = useState<BessDispatchInterval[]>([])
  const [selectedDuid, setSelectedDuid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dispatchLoading, setDispatchLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Fetch fleet data
  const fetchFleet = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getBessFleet()
      setFleet(data)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load BESS fleet data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch dispatch history for selected unit
  const fetchDispatch = useCallback(async (duid: string) => {
    try {
      setDispatchLoading(true)
      const data = await api.getBessDispatch(duid, 24)
      setDispatch(data)
    } catch (e) {
      console.error('Failed to load dispatch history', e)
    } finally {
      setDispatchLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFleet()
  }, [fetchFleet])

  useEffect(() => {
    if (selectedDuid) {
      fetchDispatch(selectedDuid)
    }
  }, [selectedDuid, fetchDispatch])

  // Prepare chart data
  const chartData = dispatch.map((iv) => ({
    time: formatTime(iv.interval_datetime),
    mw: iv.mw,
    soc: iv.soc_pct,
    price: iv.rrp_at_dispatch,
    revenue: iv.revenue_aud,
  }))

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Battery &amp; Storage Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            NEM BESS fleet state of charge, dispatch cycles, and revenue
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchFleet}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Fleet summary cards */}
      {fleet && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={<Battery size={20} />}
            label="Total Capacity"
            value={`${fleet.total_capacity_mwh.toFixed(0)} MWh`}
            sub={`${fleet.total_power_mw.toFixed(0)} MW installed power`}
          />
          <SummaryCard
            icon={<Zap size={20} />}
            label="Active (Discharging)"
            value={String(fleet.units_discharging)}
            sub={`${fleet.units_charging} charging · ${fleet.units_idle} idle/standby`}
          />
          <SummaryCard
            icon={<BatteryCharging size={20} />}
            label="Fleet Avg SOC"
            value={`${fleet.fleet_avg_soc_pct.toFixed(0)}%`}
            sub={`${fleet.units.length} units tracked`}
          />
          <SummaryCard
            icon={<DollarSign size={20} />}
            label="Revenue Today"
            value={`$${fleet.fleet_revenue_today_aud.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`}
            sub="Cumulative AEST trading day"
          />
        </div>
      )}

      {/* BESS units table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Fleet Units
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Click a row to load dispatch history
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading fleet data...</div>
        ) : fleet ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-2.5 font-medium">Station</th>
                  <th className="text-left px-4 py-2.5 font-medium">Region</th>
                  <th className="text-right px-4 py-2.5 font-medium">Capacity (MWh)</th>
                  <th className="text-right px-4 py-2.5 font-medium">Power (MW)</th>
                  <th className="text-left px-4 py-2.5 font-medium">SOC %</th>
                  <th className="text-left px-4 py-2.5 font-medium">Mode</th>
                  <th className="text-right px-4 py-2.5 font-medium">Current MW</th>
                  <th className="text-right px-4 py-2.5 font-medium">Revenue Today</th>
                </tr>
              </thead>
              <tbody>
                {fleet.units.map((unit) => (
                  <tr
                    key={unit.duid}
                    onClick={() => setSelectedDuid(unit.duid === selectedDuid ? null : unit.duid)}
                    className={[
                      'border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-colors',
                      unit.duid === selectedDuid
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{unit.station_name}</div>
                      <div className="text-xs text-gray-400">{unit.duid}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {unit.region}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {unit.capacity_mwh.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {unit.power_mw.toFixed(0)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${socColor(unit.soc_pct)}`}
                            style={{ width: `${unit.soc_pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          {unit.soc_pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${modeBadge(unit.mode)}`}>
                        {unit.mode}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${mwColor(unit.current_mw)}`}>
                      {unit.current_mw > 0 ? '+' : ''}{unit.current_mw.toFixed(1)}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${unit.revenue_today_aud >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {unit.revenue_today_aud < 0 ? '-' : ''}$
                      {Math.abs(unit.revenue_today_aud).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* Dispatch history chart */}
      {selectedDuid && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Dispatch History —{' '}
                {fleet?.units.find((u) => u.duid === selectedDuid)?.station_name ?? selectedDuid}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Last 2 hours · 5-minute intervals · green bars = discharge, blue bars = charge
              </p>
            </div>
            {dispatchLoading && (
              <span className="text-xs text-gray-400">Loading...</span>
            )}
          </div>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  interval="preserveStartEnd"
                />
                {/* Left Y axis: MW */}
                <YAxis
                  yAxisId="mw"
                  orientation="left"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
                />
                {/* Right Y axis: price + SOC */}
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#f97316' }}
                  label={{ value: '$/MWh / SOC%', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }}
                />
                <Tooltip content={<DispatchTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: '#9ca3af' }}
                />
                {/* MW bars: green for discharge (positive), blue for charge (negative) */}
                <Bar
                  yAxisId="mw"
                  dataKey="mw"
                  name="Dispatch MW"
                  fill="#22c55e"
                  radius={[2, 2, 0, 0]}
                  // Color cell individually — positive=green, negative=blue
                  isAnimationActive={false}
                />
                {/* Spot price line on right axis */}
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="price"
                  name="Price ($/MWh)"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                {/* SOC line on right axis */}
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="soc"
                  name="SOC (%)"
                  stroke="#a855f7"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">
              {dispatchLoading ? 'Loading dispatch history...' : 'No dispatch data available'}
            </div>
          )}

          {/* Interval summary table */}
          {chartData.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                    <th className="text-left px-3 py-2 font-medium">Time</th>
                    <th className="text-right px-3 py-2 font-medium">MW</th>
                    <th className="text-right px-3 py-2 font-medium">SOC %</th>
                    <th className="text-right px-3 py-2 font-medium">Price ($/MWh)</th>
                    <th className="text-right px-3 py-2 font-medium">Revenue ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.slice(-8).map((row, i) => (
                    <tr
                      key={i}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{row.time}</td>
                      <td className={`px-3 py-1.5 text-right font-medium tabular-nums ${mwColor(row.mw)}`}>
                        {row.mw > 0 ? '+' : ''}{row.mw.toFixed(1)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">
                        {row.soc.toFixed(1)}%
                      </td>
                      <td className="px-3 py-1.5 text-right text-orange-600 dark:text-orange-400">
                        ${row.price.toFixed(2)}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${row.revenue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {row.revenue < 0 ? '-' : ''}${Math.abs(row.revenue).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Efficiency & cycles summary */}
      {fleet && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
            Efficiency &amp; Cycle Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {fleet.units.map((unit) => (
              <div
                key={unit.duid}
                className="border border-gray-100 dark:border-gray-700 rounded p-3"
              >
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {unit.station_name}
                </p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Efficiency</span>
                    <span className="text-gray-700 dark:text-gray-200 font-medium">
                      {unit.efficiency_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Cycles today</span>
                    <span className="text-gray-700 dark:text-gray-200 font-medium">
                      {unit.cycles_today}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
