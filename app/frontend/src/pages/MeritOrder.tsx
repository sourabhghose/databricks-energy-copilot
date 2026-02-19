import React, { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { TrendingUp, Zap, Activity, RefreshCw } from 'lucide-react'
import { api, MeritOrderCurve } from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

const FUEL_COLORS: Record<string, string> = {
  Hydro:   '#22c55e',   // green
  Wind:    '#3b82f6',   // blue
  Solar:   '#f59e0b',   // amber
  Biomass: '#84cc16',   // lime
  Coal:    '#6b7280',   // gray
  Gas:     '#9ca3af',   // light gray
  Battery: '#a855f7',   // purple
  Diesel:  '#ef4444',   // red
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fuelColor(fuelType: string): string {
  return FUEL_COLORS[fuelType] ?? '#6b7280'
}

function formatCurrency(val: number): string {
  return `$${val.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/MWh`
}

// ---------------------------------------------------------------------------
// Custom Tooltip for the step chart
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  payload: {
    duid: string
    station_name: string
    fuel_type: string
    capacity_mw: number
    current_offer_price: number
    marginal_cost_aud_mwh: number
    on_merit: boolean
  }
}

function MeritTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-900 dark:text-white mb-1">{d.station_name}</p>
      <p className="text-gray-500 dark:text-gray-400">{d.duid}</p>
      <div className="mt-2 space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">Fuel</span>
          <span className="font-medium text-gray-800 dark:text-gray-200"
            style={{ color: fuelColor(d.fuel_type) }}>
            {d.fuel_type}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">Capacity</span>
          <span className="font-medium text-gray-800 dark:text-gray-200">{d.capacity_mw.toFixed(0)} MW</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">SRMC</span>
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {formatCurrency(d.marginal_cost_aud_mwh)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">Offer Price</span>
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {formatCurrency(d.current_offer_price)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">Status</span>
          <span className={`font-medium ${d.on_merit ? 'text-green-600' : 'text-gray-400'}`}>
            {d.on_merit ? 'On Merit' : 'Off Merit'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MeritOrder() {
  const [region, setRegion] = useState('NSW1')
  const [data, setData] = useState<MeritOrderCurve | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getMeritOrder(region)
      setData(result)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load merit order data')
    } finally {
      setLoading(false)
    }
  }, [region])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---------------------------------------------------------------------------
  // Build step-chart data
  // ---------------------------------------------------------------------------

  const chartData = React.useMemo(() => {
    if (!data) return []
    // For each unit, emit two data points to create the step effect:
    //   { mw: cumulative_start, cost: srmc }
    //   { mw: cumulative_end,   cost: srmc }
    const points: Array<{
      mw: number
      cost: number
      fill: string
      duid: string
      station_name: string
      fuel_type: string
      capacity_mw: number
      current_offer_price: number
      marginal_cost_aud_mwh: number
      on_merit: boolean
    }> = []

    let prevCumulative = 0
    for (const unit of data.units) {
      const start = prevCumulative
      const end = unit.cumulative_mw
      const fill = fuelColor(unit.fuel_type)
      const common = {
        cost: unit.marginal_cost_aud_mwh,
        fill,
        duid: unit.duid,
        station_name: unit.station_name,
        fuel_type: unit.fuel_type,
        capacity_mw: unit.capacity_mw,
        current_offer_price: unit.current_offer_price,
        marginal_cost_aud_mwh: unit.marginal_cost_aud_mwh,
        on_merit: unit.on_merit,
      }
      points.push({ mw: start, ...common })
      points.push({ mw: end, ...common })
      prevCumulative = end
    }
    return points
  }, [data])

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------

  const marginalUnit = React.useMemo(() => {
    if (!data) return null
    return data.units.find((u) => u.duid === data.marginal_generator) ?? null
  }, [data])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="text-amber-500" size={24} />
            Merit Order &amp; Dispatch Stack
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Supply stack sorted by short-run marginal cost (SRMC). The marginal unit sets the spot price.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Region tabs */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 w-fit">
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setRegion(r)}
            className={[
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              region === r
                ? 'bg-amber-500 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
            ].join(' ')}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Key metrics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* System Marginal Cost */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-amber-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              System Marginal Cost
            </span>
          </div>
          {loading ? (
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {data ? formatCurrency(data.system_marginal_cost) : '—'}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Price-setting unit SRMC
          </p>
        </div>

        {/* Marginal Generator */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={16} className="text-blue-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Marginal Generator
            </span>
          </div>
          {loading ? (
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <p className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {marginalUnit ? marginalUnit.station_name : '—'}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {marginalUnit ? `${marginalUnit.fuel_type} — ${marginalUnit.duid}` : 'Price-setting unit'}
          </p>
        </div>

        {/* Demand */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-green-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Demand
            </span>
          </div>
          {loading ? (
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {data ? `${data.demand_mw.toFixed(0)} MW` : '—'}
            </p>
          )}
          {data && (
            <div className="mt-1">
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                <span>Supply: {data.total_supply_mw.toFixed(0)} MW</span>
                <span>{((data.demand_mw / data.total_supply_mw) * 100).toFixed(1)}% utilised</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full"
                  style={{
                    width: `${Math.min(100, (data.demand_mw / data.total_supply_mw) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Merit Order Curve chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Merit Order Curve — {region}
        </h2>
        {loading ? (
          <div className="h-72 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis
                dataKey="mw"
                type="number"
                domain={[0, 'dataMax']}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}GW`}
                label={{
                  value: 'Cumulative Capacity (GW)',
                  position: 'insideBottom',
                  offset: -4,
                  fontSize: 11,
                  fill: '#6b7280',
                }}
                tick={{ fontSize: 11, fill: '#6b7280' }}
              />
              <YAxis
                tickFormatter={(v: number) => `$${v}`}
                label={{
                  value: 'SRMC ($/MWh)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10,
                  fontSize: 11,
                  fill: '#6b7280',
                }}
                tick={{ fontSize: 11, fill: '#6b7280' }}
              />
              <Tooltip content={<MeritTooltip />} />
              <Legend
                formatter={(value: string) => (
                  <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>
                )}
              />
              <Area
                type="stepAfter"
                dataKey="cost"
                name="SRMC ($/MWh)"
                stroke="#f59e0b"
                fill="#fef3c7"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {data && (
                <ReferenceLine
                  x={data.demand_mw}
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  label={{
                    value: `Demand: ${data.demand_mw.toFixed(0)} MW`,
                    position: 'top',
                    fontSize: 11,
                    fill: '#ef4444',
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-16">
            No data available
          </p>
        )}
      </div>

      {/* Dispatch units table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Dispatch Stack — {region}
          </h2>
          {lastRefresh && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastRefresh.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ) : data && data.units.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">Rank</th>
                  <th className="text-left py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">Station</th>
                  <th className="text-left py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">Fuel</th>
                  <th className="text-right py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">
                    Capacity MW
                  </th>
                  <th className="text-right py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">
                    SRMC $/MWh
                  </th>
                  <th className="text-right py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">
                    Offer Price
                  </th>
                  <th className="text-right py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">
                    Dispatched MW
                  </th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.units.map((unit, idx) => {
                  const isMarginal = unit.duid === data.marginal_generator
                  return (
                    <tr
                      key={unit.duid}
                      className={[
                        'border-b border-gray-100 dark:border-gray-700/50',
                        isMarginal
                          ? 'bg-amber-50 dark:bg-amber-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/30',
                      ].join(' ')}
                    >
                      <td className="py-2 pr-3 text-gray-400 dark:text-gray-500 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`font-medium ${isMarginal ? 'text-amber-700 dark:text-amber-400' : 'text-gray-800 dark:text-gray-200'}`}>
                          {unit.station_name}
                        </span>
                        {isMarginal && (
                          <span className="ml-1 text-xs text-amber-600 dark:text-amber-400 font-bold">
                            (marginal)
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-white text-xs font-medium"
                          style={{ backgroundColor: fuelColor(unit.fuel_type) }}
                        >
                          {unit.fuel_type}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                        {unit.capacity_mw.toFixed(0)}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                        ${unit.marginal_cost_aud_mwh.toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                        ${unit.current_offer_price.toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                        {unit.dispatched_mw.toFixed(0)}
                      </td>
                      <td className="py-2">
                        {unit.on_merit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            On Merit
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                            Off Merit
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
            No dispatch units available
          </p>
        )}
      </div>
    </div>
  )
}
