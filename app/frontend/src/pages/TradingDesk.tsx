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
  Cell,
} from 'recharts'
import { BarChart2, RefreshCw, TrendingUp, TrendingDown, Activity, MapPin } from 'lucide-react'
import { api, TradingDashboard, TradingPosition, RegionSpread } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(value: number, decimals = 0): string {
  return value.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtAud(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${fmt(abs / 1_000_000, 2)}M`
  if (abs >= 1_000) return `${sign}$${fmt(abs / 1_000, 1)}k`
  return `${sign}$${fmt(abs, 0)}`
}

const PRODUCT_COLORS: Record<string, string> = {
  SPOT:   'bg-blue-700 text-blue-100',
  CAP:    'bg-orange-600 text-orange-100',
  SWAP:   'bg-indigo-600 text-indigo-100',
  OPTION: 'bg-purple-600 text-purple-100',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string
  icon: React.ReactNode
  positive?: boolean | null
  subtitle?: string
}

function KpiCard({ title, value, icon, positive, subtitle }: KpiCardProps) {
  const valueColor =
    positive === true
      ? 'text-emerald-400'
      : positive === false
      ? 'text-red-400'
      : 'text-gray-100'

  return (
    <div className="bg-gray-800 dark:bg-gray-900 rounded-lg p-4 flex items-start gap-4">
      <div className="p-2 bg-gray-700 rounded-md shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 truncate">{title}</p>
        <p className={`text-2xl font-bold mt-0.5 ${valueColor}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Spread chart custom tooltip
// ---------------------------------------------------------------------------

interface SpreadTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function SpreadTooltip({ active, payload, label }: SpreadTooltipProps) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs shadow-lg">
      <p className="text-gray-300 mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-6">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className={p.value >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {p.value >= 0 ? '+' : ''}{fmt(p.value, 2)} $/MWh
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function TradingDesk() {
  const [dashboard, setDashboard] = useState<TradingDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  // Filters
  const [dirFilter, setDirFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL')
  const [regionFilter, setRegionFilter] = useState<string>('ALL')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getTradingDashboard()
      setDashboard(data)
      setLastUpdated(
        new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trading data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ----- loading skeleton -----
  if (loading && !dashboard) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-700 dark:bg-gray-800 rounded animate-pulse w-72" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-700 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-700 dark:bg-gray-800 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-700 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
    )
  }

  // ----- error banner -----
  const ErrorBanner = error ? (
    <div className="mx-6 mt-4 bg-amber-900/30 border border-amber-600 rounded-lg px-4 py-2 text-amber-300 text-sm">
      API unavailable — showing indicative mock data. ({error})
    </div>
  ) : null

  if (!dashboard) {
    return (
      <div className="p-6">
        {ErrorBanner}
        <p className="text-gray-400 mt-4">No trading data available.</p>
      </div>
    )
  }

  // ----- derived / filtered data -----
  const netPositive = dashboard.net_position_mw >= 0
  const pnlPositive = dashboard.total_pnl_aud >= 0

  const allRegions = Array.from(new Set(dashboard.positions.map((p) => p.region))).sort()

  const filteredPositions: TradingPosition[] = dashboard.positions.filter((p) => {
    const dirOk = dirFilter === 'ALL' || p.direction === dirFilter
    const regOk = regionFilter === 'ALL' || p.region === regionFilter
    return dirOk && regOk
  })

  const spreadChartData = dashboard.spreads.map((s) => ({
    name: s.interconnector,
    'Spot Spread': s.spot_spread_aud_mwh,
    'Forward Spread': s.forward_spread_aud_mwh,
  }))

  // ----- render -----
  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart2 size={24} className="text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              NEM Trading Desk Analytics
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Live as of {lastUpdated || dashboard.timestamp}
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                     text-white text-sm rounded-lg transition-colors"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {ErrorBanner}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Net Position (MW)"
          value={`${netPositive ? '+' : ''}${fmt(dashboard.net_position_mw, 0)} MW`}
          icon={
            netPositive
              ? <TrendingUp size={18} className="text-emerald-400" />
              : <TrendingDown size={18} className="text-red-400" />
          }
          positive={netPositive ? true : false}
          subtitle={`Long ${fmt(dashboard.total_long_mw, 0)} / Short ${fmt(dashboard.total_short_mw, 0)} MW`}
        />
        <KpiCard
          title="Total P&L ($AUD)"
          value={fmtAud(dashboard.total_pnl_aud)}
          icon={
            pnlPositive
              ? <TrendingUp size={18} className="text-emerald-400" />
              : <TrendingDown size={18} className="text-red-400" />
          }
          positive={pnlPositive ? true : false}
          subtitle="Across all open positions"
        />
        <KpiCard
          title="Daily Volume (MW)"
          value={`${fmt(dashboard.daily_volume_mw, 0)} MW`}
          icon={<Activity size={18} className="text-blue-400" />}
          positive={null}
          subtitle="Total traded volume today"
        />
        <KpiCard
          title="Active Regions"
          value={String(dashboard.regions_active)}
          icon={<MapPin size={18} className="text-purple-400" />}
          positive={null}
          subtitle="NEM dispatch regions"
        />
      </div>

      {/* Regional Spread Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Regional Price Spreads — Interconnectors
        </h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={spreadChartData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.4} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis
              tickFormatter={(v) => `${v} $/MWh`}
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              width={80}
            />
            <Tooltip content={<SpreadTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="Spot Spread" radius={[3, 3, 0, 0]}>
              {spreadChartData.map((entry, index) => (
                <Cell
                  key={`spot-${index}`}
                  fill={entry['Spot Spread'] >= 0 ? '#3B82F6' : '#EF4444'}
                />
              ))}
            </Bar>
            <Bar dataKey="Forward Spread" fill="#F59E0B" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Positions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table header + filters */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Open Trading Positions ({filteredPositions.length})
          </h2>
          <div className="flex items-center gap-3">
            {/* Direction filter */}
            <div className="flex rounded overflow-hidden border border-gray-300 dark:border-gray-600 text-xs">
              {(['ALL', 'LONG', 'SHORT'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirFilter(d)}
                  className={`px-3 py-1 ${
                    dirFilter === d
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            {/* Region filter */}
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="text-xs bg-gray-100 dark:bg-gray-700 border-none rounded px-2 py-1
                         text-gray-700 dark:text-gray-200"
            >
              <option value="ALL">All Regions</option>
              {allRegions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-750 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Trader</th>
                <th className="px-4 py-3 text-left">Region</th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Direction</th>
                <th className="px-4 py-3 text-right">Volume MW</th>
                <th className="px-4 py-3 text-right">Entry $/MWh</th>
                <th className="px-4 py-3 text-right">Current $/MWh</th>
                <th className="px-4 py-3 text-right">P&L</th>
                <th className="px-4 py-3 text-left">Counterparty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredPositions.map((pos: TradingPosition) => {
                const pnlPos = pos.pnl_aud >= 0
                const productClass = PRODUCT_COLORS[pos.product] ?? 'bg-gray-500 text-gray-100'
                const isLong = pos.direction === 'LONG'
                return (
                  <tr
                    key={pos.position_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {pos.position_id}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">
                      {pos.trader}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pos.region}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${productClass}`}>
                        {pos.product}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          isLong
                            ? 'bg-emerald-700 text-emerald-100'
                            : 'bg-red-700 text-red-100'
                        }`}
                      >
                        {pos.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {fmt(pos.volume_mw, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      ${fmt(pos.entry_price_aud_mwh, 2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      ${fmt(pos.current_price_aud_mwh, 2)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        pnlPos ? 'text-emerald-500' : 'text-red-400'
                      }`}
                    >
                      {pnlPos ? '+' : ''}{fmtAud(pos.pnl_aud)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                      {pos.counterparty}
                    </td>
                  </tr>
                )
              })}
              {filteredPositions.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No positions match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spreads Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Interconnector Spreads & Arbitrage
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-750 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Interconnector</th>
                <th className="px-4 py-3 text-left">From</th>
                <th className="px-4 py-3 text-left">To</th>
                <th className="px-4 py-3 text-right">Spot Spread $/MWh</th>
                <th className="px-4 py-3 text-right">Fwd Spread $/MWh</th>
                <th className="px-4 py-3 text-right">Flow MW</th>
                <th className="px-4 py-3 text-right">Capacity MW</th>
                <th className="px-4 py-3 text-right">Congestion Rev $M</th>
                <th className="px-4 py-3 text-center">Arbitrage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {dashboard.spreads.map((spread: RegionSpread) => {
                const spotPos = spread.spot_spread_aud_mwh >= 0
                const fwdPos = spread.forward_spread_aud_mwh >= 0
                return (
                  <tr
                    key={spread.interconnector}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {spread.interconnector}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{spread.region_from}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{spread.region_to}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        spotPos ? 'text-emerald-500' : 'text-red-400'
                      }`}
                    >
                      {spotPos ? '+' : ''}{fmt(spread.spot_spread_aud_mwh, 2)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        fwdPos ? 'text-emerald-500' : 'text-red-400'
                      }`}
                    >
                      {fwdPos ? '+' : ''}{fmt(spread.forward_spread_aud_mwh, 2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {fmt(spread.flow_mw, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {fmt(spread.capacity_mw, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      ${fmt(spread.congestion_revenue_m_aud, 2)}M
                    </td>
                    <td className="px-4 py-3 text-center">
                      {spread.arbitrage_opportunity ? (
                        <span className="px-2 py-0.5 bg-yellow-600 text-yellow-100 rounded text-xs font-semibold">
                          Opportunity
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-600 text-gray-300 rounded text-xs">
                          None
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
