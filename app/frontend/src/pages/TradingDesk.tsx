import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Shield, RefreshCw } from 'lucide-react'
import { api, PortfolioSummary } from '../api/client'

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

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

const FUEL_BADGE_COLORS: Record<string, string> = {
  Coal:  'bg-gray-700 text-gray-100',
  Gas:   'bg-blue-700 text-blue-100',
  Wind:  'bg-teal-700 text-teal-100',
  Solar: 'bg-amber-600 text-amber-100',
  Hydro: 'bg-cyan-700 text-cyan-100',
  Hedge: 'bg-purple-700 text-purple-100',
}

const HEDGE_TYPE_COLORS: Record<string, string> = {
  cap:    'bg-orange-600 text-orange-100',
  swap:   'bg-indigo-600 text-indigo-100',
  floor:  'bg-green-600 text-green-100',
  collar: 'bg-pink-600 text-pink-100',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  title: string
  value: string
  icon: React.ReactNode
  positive?: boolean | null
  subtitle?: string
}

function SummaryCard({ title, value, icon, positive, subtitle }: SummaryCardProps) {
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
// Custom tooltip for P&L chart
// ---------------------------------------------------------------------------

interface PnlTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function PnlTooltip({ active, payload, label }: PnlTooltipProps) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs shadow-lg">
      <p className="text-gray-300 mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-6">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className={p.value >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {fmtAud(p.value)}
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
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [pnlHistory, setPnlHistory] = useState<Record<string, number>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [chartMode, setChartMode] = useState<'daily' | 'cumulative'>('daily')
  const [historyDays, setHistoryDays] = useState(7)

  // ----- data fetch -----
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryData, historyData] = await Promise.all([
        api.getPortfolioSummary(),
        api.getPortfolioPnlHistory(historyDays),
      ])
      setSummary(summaryData)
      setPnlHistory(historyData)
      setLastUpdated(
        new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio data')
    } finally {
      setLoading(false)
    }
  }, [historyDays])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ----- loading skeleton -----
  if (loading && !summary) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-700 dark:bg-gray-800 rounded animate-pulse w-64" />
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

  if (!summary) {
    return (
      <div className="p-6">
        {ErrorBanner}
        <p className="text-gray-400 mt-4">No portfolio data available.</p>
      </div>
    )
  }

  // ----- derived data -----
  const mtmPositive = summary.total_mtm_pnl_aud >= 0
  const hedgePositive = summary.total_hedge_value_aud >= 0

  const chartData = pnlHistory.map((d) => ({
    date: fmtDate(d['date'] as string),
    'Daily P&L': d['pnl_aud'] as number,
    'Cumulative P&L': d['cumulative_pnl_aud'] as number,
    'Revenue': d['revenue_aud'] as number,
    'Hedge Value': d['hedge_value_aud'] as number,
  }))

  // ----- render -----
  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Portfolio Trading Desk
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Mark-to-Market as of {lastUpdated || '—'}
          </p>
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

      {/* P&L Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total MtM P&L"
          value={fmtAud(summary.total_mtm_pnl_aud)}
          icon={mtmPositive
            ? <TrendingUp size={18} className="text-emerald-400" />
            : <TrendingDown size={18} className="text-red-400" />}
          positive={mtmPositive ? true : false}
          subtitle="Today vs contract"
        />
        <SummaryCard
          title="Daily Revenue"
          value={fmtAud(summary.total_daily_revenue_aud)}
          icon={<DollarSign size={18} className="text-blue-400" />}
          positive={null}
          subtitle="Spot market revenue"
        />
        <SummaryCard
          title="Hedge Value"
          value={fmtAud(summary.total_hedge_value_aud)}
          icon={<Shield size={18} className={hedgePositive ? 'text-emerald-400' : 'text-red-400'} />}
          positive={hedgePositive ? true : false}
          subtitle="Net hedge payoff"
        />
        <SummaryCard
          title="Hedge Ratio"
          value={`${fmt(summary.hedge_ratio_pct, 1)}%`}
          icon={<Shield size={18} className="text-purple-400" />}
          positive={null}
          subtitle={`Open: ${fmt(summary.net_open_position_mw, 0)} MW`}
        />
      </div>

      {/* Region P&L */}
      {Object.keys(summary.region_pnl).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Region P&L Breakdown
          </h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(summary.region_pnl).map(([region, pnl]) => (
              <div
                key={region}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full
                           bg-gray-100 dark:bg-gray-700 text-sm"
              >
                <span className="font-semibold text-gray-700 dark:text-gray-200">{region}</span>
                <span className={pnl >= 0 ? 'text-emerald-500' : 'text-red-400'}>
                  {fmtAud(pnl)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* P&L History Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            P&L History
          </h2>
          <div className="flex items-center gap-3">
            {/* Days selector */}
            <select
              value={historyDays}
              onChange={(e) => setHistoryDays(Number(e.target.value))}
              className="text-xs bg-gray-100 dark:bg-gray-700 border-none rounded px-2 py-1
                         text-gray-700 dark:text-gray-200"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
            {/* Toggle */}
            <div className="flex rounded overflow-hidden border border-gray-300 dark:border-gray-600 text-xs">
              <button
                onClick={() => setChartMode('daily')}
                className={`px-3 py-1 ${
                  chartMode === 'daily'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Daily P&L
              </button>
              <button
                onClick={() => setChartMode('cumulative')}
                className={`px-3 py-1 ${
                  chartMode === 'cumulative'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Cumulative
              </button>
            </div>
          </div>
        </div>

        {chartMode === 'daily' ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis
                tickFormatter={(v) => fmtAud(v)}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                width={68}
              />
              <Tooltip content={<PnlTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="4 2" />
              <Bar
                dataKey="Daily P&L"
                fill="#10B981"
                radius={[3, 3, 0, 0]}
                // Colour individual bars based on sign
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis
                tickFormatter={(v) => fmtAud(v)}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                width={68}
              />
              <Tooltip content={<PnlTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="4 2" />
              <Area
                type="monotone"
                dataKey="Cumulative P&L"
                stroke="#6366F1"
                fill="url(#cumulativeGrad)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Portfolio Assets Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Portfolio Assets
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-750 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Asset</th>
                <th className="px-4 py-3 text-left">Fuel</th>
                <th className="px-4 py-3 text-left">Region</th>
                <th className="px-4 py-3 text-right">Capacity MW</th>
                <th className="px-4 py-3 text-right">Contract $/MWh</th>
                <th className="px-4 py-3 text-right">Spot $/MWh</th>
                <th className="px-4 py-3 text-right">MtM P&L</th>
                <th className="px-4 py-3 text-right">Daily Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {summary.assets.map((asset) => {
                const pnlPos = asset.mtm_pnl_aud >= 0
                const badgeClass =
                  FUEL_BADGE_COLORS[asset.fuel_type] ?? 'bg-gray-500 text-gray-100'
                return (
                  <tr
                    key={asset.asset_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {asset.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${badgeClass}`}>
                        {asset.fuel_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{asset.region}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {fmt(asset.capacity_mw, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      ${fmt(asset.contract_price_aud_mwh, 2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      ${fmt(asset.current_spot_mwh, 2)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        pnlPos ? 'text-emerald-500' : 'text-red-400'
                      }`}
                    >
                      {pnlPos ? '+' : ''}{fmtAud(asset.mtm_pnl_aud)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {fmtAud(asset.daily_revenue_aud)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hedge Positions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Hedge Positions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-750 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Hedge ID</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Region</th>
                <th className="px-4 py-3 text-right">Volume MW</th>
                <th className="px-4 py-3 text-right">Strike $/MWh</th>
                <th className="px-4 py-3 text-right">Premium Paid</th>
                <th className="px-4 py-3 text-right">Current Value</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-center">ITM?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {summary.hedges.map((hedge) => {
                const typeClass =
                  HEDGE_TYPE_COLORS[hedge.hedge_type] ?? 'bg-gray-500 text-gray-100'
                const cvPos = hedge.current_value_aud >= 0
                return (
                  <tr
                    key={hedge.hedge_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {hedge.hedge_id}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${typeClass}`}>
                        {hedge.hedge_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{hedge.region}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {fmt(hedge.volume_mw, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      ${fmt(hedge.strike_price, 2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {fmtAud(hedge.premium_paid_aud)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        cvPos ? 'text-emerald-500' : 'text-red-400'
                      }`}
                    >
                      {cvPos ? '+' : ''}{fmtAud(hedge.current_value_aud)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                      {hedge.expiry_date}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hedge.in_the_money ? (
                        <span className="px-2 py-0.5 bg-emerald-700 text-emerald-100 rounded text-xs font-semibold">
                          In the Money
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-700 text-red-100 rounded text-xs font-semibold">
                          Out of Money
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
