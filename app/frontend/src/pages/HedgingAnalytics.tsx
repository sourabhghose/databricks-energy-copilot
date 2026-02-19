import { useState, useEffect, useCallback } from 'react'
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
import { TrendingUp, Shield, RefreshCw, AlertTriangle } from 'lucide-react'
import { api } from '../api/client'
import type { HedgingDashboard, HedgeContract, HedgePortfolioSummary } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals)
}

function fmtM(n: number): string {
  return `$${(n / 1_000_000).toFixed(2)}M`
}

function fmtMwh(n: number): string {
  return `${n.toFixed(1)} MW`
}

function fmtPrice(n: number): string {
  return `$${n.toFixed(2)}/MWh`
}

function fmtPnl(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${fmtM(n)}`
}

// ---------------------------------------------------------------------------
// Type badge
// ---------------------------------------------------------------------------

function ContractTypeBadge({ type }: { type: string }) {
  const colours: Record<string, string> = {
    CAP: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    SWAP: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    COLLAR: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    FLOOR: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    SWAPTION: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  }
  const cls = colours[type] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{type}</span>
  )
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    EXPIRED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  }
  const cls = colours[status] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>
  )
}

// ---------------------------------------------------------------------------
// Region chip
// ---------------------------------------------------------------------------

function RegionChip({ region }: { region: string }) {
  const colours: Record<string, string> = {
    NSW1: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    VIC1: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    QLD1: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    SA1: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    TAS1: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  }
  const cls = colours[region] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{region}</span>
  )
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  subLabel?: string
  positive?: boolean | null  // null = neutral
  icon: React.ReactNode
}

function KpiCard({ label, value, subLabel, positive, icon }: KpiCardProps) {
  const valueColour =
    positive === null || positive === undefined
      ? 'text-gray-900 dark:text-gray-100'
      : positive
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4 shadow-sm">
      <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
        <p className={`text-xl font-bold mt-0.5 ${valueColour}`}>{value}</p>
        {subLabel && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{subLabel}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hedge ratio progress bar
// ---------------------------------------------------------------------------

function HedgeRatioBar({ pct }: { pct: number }) {
  const capped = Math.min(pct, 100)
  const colour =
    pct >= 80
      ? 'bg-green-500'
      : pct >= 60
      ? 'bg-amber-500'
      : 'bg-red-500'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full ${colour} transition-all duration-500`}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 shrink-0 w-10 text-right">
        {fmt(pct, 1)}%
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Recharts tooltip
// ---------------------------------------------------------------------------

function QuarterlyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-gray-600 dark:text-gray-400">{p.name}:</span>
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {p.name === 'Hedged MW' ? `${p.value} MW` : fmtPrice(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HedgingAnalytics() {
  const [dashboard, setDashboard] = useState<HedgingDashboard | null>(null)
  const [contracts, setContracts] = useState<HedgeContract[]>([])
  const [portfolio, setPortfolio] = useState<HedgePortfolioSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // filters
  const [filterRegion, setFilterRegion] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [dash, contractList, portfolioList] = await Promise.all([
        api.getHedgingDashboard(),
        api.getHedgeContracts(),
        api.getHedgePortfolio(),
      ])
      setDashboard(dash)
      setContracts(contractList)
      setPortfolio(portfolioList)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load hedging data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // filtered contracts (client-side)
  const filteredContracts = contracts.filter((c) => {
    if (filterRegion && c.region !== filterRegion) return false
    if (filterType && c.contract_type !== filterType) return false
    if (filterStatus && c.status !== filterStatus) return false
    return true
  })

  // unique values for dropdowns
  const regions = Array.from(new Set(contracts.map((c) => c.region))).sort()
  const types = Array.from(new Set(contracts.map((c) => c.contract_type))).sort()
  const statuses = Array.from(new Set(contracts.map((c) => c.status))).sort()

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400" size={28} />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading hedging data…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg border border-red-200 dark:border-red-700">
          <AlertTriangle size={18} />
          <p className="text-sm font-medium">{error}</p>
          <button
            onClick={load}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!dashboard) return null

  const pnlPositive = dashboard.total_unrealised_pnl_aud >= 0

  // quarterly bar chart data
  const quarterlyData = dashboard.quarterly_position.map((q) => ({
    quarter: q.quarter,
    'Hedged MW': q.hedged_mw,
    'Contract Price': q.contract_price,
    'Spot Reference': q.spot_ref,
  }))

  return (
    <div className="p-6 space-y-6 min-h-0">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              OTC Hedging &amp; Contract Portfolio
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Cap / Swap / Collar positions, mark-to-market valuations and portfolio VaR
            </p>
          </div>
          <span className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-indigo-600 text-white shadow-sm">
            <TrendingUp size={14} />
            {fmt(dashboard.overall_hedge_ratio_pct, 1)}% Hedged
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {lastRefresh.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* KPI cards                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Portfolio MtM Value"
          value={fmtM(dashboard.total_portfolio_mtm_aud)}
          subLabel="Total mark-to-market across all regions"
          positive={null}
          icon={<Shield size={20} />}
        />
        <KpiCard
          label="Unrealised P&amp;L"
          value={fmtPnl(dashboard.total_unrealised_pnl_aud)}
          subLabel="vs. entry price / premium paid"
          positive={pnlPositive}
          icon={<TrendingUp size={20} />}
        />
        <KpiCard
          label="Portfolio VaR 95%"
          value={fmtM(dashboard.portfolio_var_95_aud)}
          subLabel="Daily value-at-risk (95% confidence)"
          positive={null}
          icon={<AlertTriangle size={20} />}
        />
        <KpiCard
          label="Weighted Avg Hedge Price"
          value={fmtPrice(dashboard.weighted_avg_hedge_price)}
          subLabel="Volume-weighted across active SWAPs"
          positive={null}
          icon={<TrendingUp size={20} />}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Quarterly Position chart                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Quarterly Hedge Position (MW &amp; Price)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={quarterlyData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
            <XAxis
              dataKey="quarter"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'MW', angle: -90, position: 'insideLeft', offset: 12, style: { fontSize: 10, fill: '#9ca3af' } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[60, 130]}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              label={{ value: '$/MWh', angle: 90, position: 'insideRight', offset: 12, style: { fontSize: 10, fill: '#9ca3af' } }}
            />
            <Tooltip content={<QuarterlyTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
            <Bar
              yAxisId="left"
              dataKey="Hedged MW"
              fill="#6366f1"
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              yAxisId="right"
              dataKey="Contract Price"
              fill="#22c55e"
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              yAxisId="right"
              dataKey="Spot Reference"
              fill="#f59e0b"
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Blue: hedged volume (MW, left axis) · Green: contract/swap price · Amber: spot reference price (both $/MWh, right axis)
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Portfolio by region table                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Portfolio by Region
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Hedge ratios, MtM totals, and risk metrics per NEM region
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-750">
              <tr>
                {[
                  'Region',
                  'Hedged MW',
                  'Expected Gen',
                  'Hedge Ratio',
                  'Avg Swap Price',
                  'MtM ($M)',
                  'VaR 95% ($M)',
                  'Active Contracts',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {portfolio.map((p) => (
                <tr
                  key={p.region}
                  className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <td className="px-4 py-3">
                    <RegionChip region={p.region} />
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">
                    {fmtMwh(p.total_hedged_mw)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {fmtMwh(p.expected_generation_mw)}
                  </td>
                  <td className="px-4 py-3 min-w-[140px]">
                    <HedgeRatioBar pct={p.hedge_ratio_pct} />
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {fmtPrice(p.avg_swap_price)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">
                    {fmtM(p.mtm_total_aud)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {fmtM(p.var_95_aud)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                      {p.num_active_contracts}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Contract details table with filters                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Header + filters */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Contract Details
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {filteredContracts.length} of {contracts.length} contracts
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Region filter */}
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">All Regions</option>
                {regions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {/* Type filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">All Types</option>
                {types.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">All Statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {/* Clear filters */}
              {(filterRegion || filterType || filterStatus) && (
                <button
                  onClick={() => {
                    setFilterRegion('')
                    setFilterType('')
                    setFilterStatus('')
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-750">
              <tr>
                {[
                  'Contract ID',
                  'Type',
                  'Region',
                  'Counterparty',
                  'Period',
                  'Strike Price',
                  'Volume MW',
                  'MtM ($M)',
                  'P&L ($M)',
                  'Status',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                    No contracts match the current filters.
                  </td>
                </tr>
              ) : (
                filteredContracts.map((c) => {
                  const mtmPositive = c.mtm_value_aud >= 0
                  const pnlPositive = c.pnl_aud >= 0
                  return (
                    <tr
                      key={c.contract_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {c.contract_id}
                      </td>
                      <td className="px-4 py-3">
                        <ContractTypeBadge type={c.contract_type} />
                      </td>
                      <td className="px-4 py-3">
                        <RegionChip region={c.region} />
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {c.counterparty}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                        {c.hedge_period}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">
                        {fmtPrice(c.strike_price)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {c.volume_mw.toFixed(0)} MW
                      </td>
                      <td className={`px-4 py-3 font-semibold whitespace-nowrap ${c.status === 'EXPIRED' ? 'text-gray-400 dark:text-gray-500' : mtmPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {c.status === 'EXPIRED' ? '—' : fmtM(c.mtm_value_aud)}
                      </td>
                      <td className={`px-4 py-3 font-semibold whitespace-nowrap ${pnlPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmtPnl(c.pnl_aud)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {filteredContracts.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-4">
            <span>
              Total MtM:{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {fmtM(filteredContracts.reduce((a, c) => a + (c.status !== 'EXPIRED' ? c.mtm_value_aud : 0), 0))}
              </span>
            </span>
            <span>
              Total P&amp;L:{' '}
              <span className={`font-semibold ${filteredContracts.reduce((a, c) => a + c.pnl_aud, 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {fmtPnl(filteredContracts.reduce((a, c) => a + c.pnl_aud, 0))}
              </span>
            </span>
            <span>
              Total Volume:{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {filteredContracts.reduce((a, c) => a + c.volume_mw, 0).toFixed(0)} MW
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
