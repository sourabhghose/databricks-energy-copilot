import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Flame, TrendingUp, ArrowRight, Activity, RefreshCw } from 'lucide-react'
import { api, GasMarketDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtPrice(v: number): string {
  return `$${v.toFixed(2)}/GJ`
}

function fmtTj(v: number): string {
  return `${v.toLocaleString('en-AU', { maximumFractionDigits: 0 })} TJ/day`
}

function changeLabel(v: number): string {
  if (v > 0) return `+${v.toFixed(2)}`
  return v.toFixed(2)
}

function utilisationColor(pct: number): string {
  if (pct >= 80) return 'bg-red-500'
  if (pct >= 60) return 'bg-amber-400'
  return 'bg-green-500'
}

function utilisationTextColor(pct: number): string {
  if (pct >= 80) return 'text-red-600 dark:text-red-400'
  if (pct >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-green-600 dark:text-green-400'
}

function directionIcon(direction: string): React.ReactNode {
  if (direction === 'FORWARD') return <span className="text-green-600 dark:text-green-400 font-mono">&rarr; FORWARD</span>
  if (direction === 'REVERSE') return <span className="text-red-600 dark:text-red-400 font-mono">&larr; REVERSE</span>
  return <span className="text-gray-400 font-mono">&#8212; ZERO</span>
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface HubPriceCardProps {
  label: string
  price: number
  change1d?: number
  volume?: number
  icon?: React.ReactNode
}

function HubPriceCard({ label, price, change1d, volume, icon }: HubPriceCardProps) {
  const isUp = (change1d ?? 0) >= 0
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        {icon && <span className="text-orange-500">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">
        {fmtPrice(price)}
      </div>
      {change1d !== undefined && (
        <div className={`text-sm font-medium ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {isUp ? '▲' : '▼'} {changeLabel(change1d)} today
        </div>
      )}
      {volume !== undefined && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Vol: {volume.toFixed(0)} TJ
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function GasMarket() {
  const [data, setData] = useState<GasMarketDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    try {
      const dashboard = await api.getGasDashboard()
      setData(dashboard)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gas market data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-72 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 text-amber-800 dark:text-amber-300 text-sm">
          {error ?? 'No gas market data available'}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Chart data — hub price comparison
  // ---------------------------------------------------------------------------

  const hubChartData = data.hub_prices
    .filter(h => ['Wallumbilla', 'Moomba', 'Longford'].includes(h.hub))
    .map(h => ({
      hub: h.hub,
      price: h.price_aud_gj,
      change: h.change_1d,
    }))

  // Wallumbilla hub price detail for summary card
  const wallumbillaHub = data.hub_prices.find(h => h.hub === 'Wallumbilla')
  const moombaHub = data.hub_prices.find(h => h.hub === 'Moomba')
  const longfordHub = data.hub_prices.find(h => h.hub === 'Longford')

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
          <Flame className="text-orange-500" size={26} />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Gas Market Analytics
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-semibold">
                <Activity size={11} />
                Bulletin Board
              </span>
              {lastUpdated && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Updated {lastUpdated.toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit' })} AEST
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Hub Price Summary Strip (4 cards)                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <HubPriceCard
          label="Wallumbilla (QLD)"
          price={data.wallumbilla_price}
          change1d={wallumbillaHub?.change_1d}
          volume={wallumbillaHub?.volume_tj}
          icon={<Flame size={16} />}
        />
        <HubPriceCard
          label="Moomba (SA)"
          price={data.moomba_price}
          change1d={moombaHub?.change_1d}
          volume={moombaHub?.volume_tj}
        />
        <HubPriceCard
          label="Longford (VIC)"
          price={data.longford_price}
          change1d={longfordHub?.change_1d}
          volume={longfordHub?.volume_tj}
          icon={<TrendingUp size={16} />}
        />
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Gas-to-Power
            </span>
            <Activity size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {data.gas_power_generation_tj.toFixed(0)} TJ/day
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            NEM power sector consumption
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            Total demand: {fmtTj(data.domestic_demand_tj)}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Pipeline Flows Table                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ArrowRight size={18} className="text-blue-500" />
            <h2 className="font-semibold text-gray-800 dark:text-white text-sm">
              Pipeline Flows
            </h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Total: {fmtTj(data.total_pipeline_flow_tj)}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Pipeline
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  From &rarr; To
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Flow TJ/day
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Capacity TJ/day
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-40">
                  Utilisation
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Direction
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Pressure (kPa)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.pipeline_flows.map(pipe => (
                <tr
                  key={pipe.pipeline_id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                    <div>{pipe.pipeline_name}</div>
                    <div className="text-xs text-gray-400 font-mono">{pipe.pipeline_id}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {pipe.from_location} &rarr; {pipe.to_location}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-800 dark:text-gray-200">
                    {pipe.flow_tj_day.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500 dark:text-gray-400">
                    {pipe.capacity_tj_day.toFixed(0)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 min-w-[60px]">
                        <div
                          className={`h-2 rounded-full ${utilisationColor(pipe.utilisation_pct)}`}
                          style={{ width: `${Math.min(100, pipe.utilisation_pct)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold w-12 text-right ${utilisationTextColor(pipe.utilisation_pct)}`}>
                        {pipe.utilisation_pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {directionIcon(pipe.direction)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                    {pipe.pressure_kpa.toLocaleString('en-AU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Hub Price Comparison BarChart                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-orange-500" />
          <h2 className="font-semibold text-gray-800 dark:text-white text-sm">
            Hub Price Comparison
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            East coast hubs — $/GJ with daily change overlay
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={hubChartData} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="hub"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="price"
              orientation="left"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={v => `$${v}`}
              domain={[0, 'dataMax + 2']}
              label={{ value: '$/GJ', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: '#9ca3af' } }}
            />
            <YAxis
              yAxisId="change"
              orientation="right"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={v => `${v > 0 ? '+' : ''}${v}`}
              domain={[-2, 2]}
              label={{ value: 'Chg $/GJ', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 10, fill: '#9ca3af' } }}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'Price ($/GJ)') return [`$${(value as number).toFixed(2)}/GJ`, name]
                return [`${(value as number) >= 0 ? '+' : ''}${(value as number).toFixed(2)}`, name]
              }}
              contentStyle={{ fontSize: 12, borderRadius: 6 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="price" dataKey="price" name="Price ($/GJ)" fill="#f97316" radius={[4, 4, 0, 0]} />
            <Bar
              yAxisId="change"
              dataKey="change"
              name="Daily Change ($/GJ)"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              opacity={0.7}
            />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Regional price spread reflects transport tariffs and supply/demand balance at each hub.
          Longford (VIC) typically commands a premium due to distance from upstream production.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* LNG Terminals Table                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <Flame size={18} className="text-orange-500" />
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-white text-sm">
              LNG Export Terminals
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              LNG exports reduce domestic gas availability. WA Domestic Reservation Obligation (DRO) requires
              15% of LNG production to be reserved for the domestic market.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Terminal
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Region
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Export Rate (MTPA)
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Domestic Alloc. (PJ)
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Spot Cargo?
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Next Cargo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.lng_terminals.map(terminal => (
                <tr
                  key={terminal.terminal}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 font-mono">
                    {terminal.terminal}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {terminal.region}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-800 dark:text-gray-200">
                    {terminal.export_volume_mtpa.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">
                    {terminal.domestic_allocation_pj > 0
                      ? terminal.domestic_allocation_pj.toFixed(1)
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {terminal.spot_cargo ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-semibold">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                    {terminal.next_cargo_date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold">QLD terminals</span> (QCLNG, APLNG, GLNG) have no domestic reservation obligation.
            <span className="font-semibold ml-2">WA terminals</span> (DLNG, NWLHIC) must reserve 15% of LNG production for domestic supply under the WA DRO policy.
            Total LNG exports today: <span className="font-semibold">{data.lng_exports_today_tj.toFixed(0)} TJ</span>.
          </p>
        </div>
      </div>

    </div>
  )
}
