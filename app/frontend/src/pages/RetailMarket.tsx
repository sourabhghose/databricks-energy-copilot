import React, { useState, useEffect, useCallback } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Users, DollarSign, TrendingDown, ArrowRightLeft, RefreshCw } from 'lucide-react'
import { api, RetailMarketDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCustomers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString('en-AU')
}

function fmtAud(v: number): string {
  return `$${v.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function changeBadge(pct: number) {
  const color = pct <= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
  const sign = pct > 0 ? '+' : ''
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      {sign}{pct.toFixed(1)}%
    </span>
  )
}

// ---------------------------------------------------------------------------
// Pie chart colour palette
// ---------------------------------------------------------------------------
const PIE_COLORS = [
  '#f59e0b', // amber  — AGL
  '#3b82f6', // blue   — Origin
  '#10b981', // green  — EnergyAustralia
  '#8b5cf6', // purple — Simply Energy
  '#ef4444', // red    — Red / Lumo
  '#06b6d4', // cyan   — Alinta
  '#6b7280', // gray   — Others
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  badge?: React.ReactNode
}

function MetricCard({ icon, label, value, sub, badge }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      {(sub || badge) && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {badge}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Tooltip for PieChart
// ---------------------------------------------------------------------------
interface PieTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { residential_customers: number } }>
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 shadow text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{entry.name}</p>
      <p className="text-gray-600 dark:text-gray-300">Market share: {entry.value.toFixed(1)}%</p>
      <p className="text-gray-600 dark:text-gray-300">
        Residential: {fmtCustomers(entry.payload.residential_customers)}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Tooltip for BarChart
// ---------------------------------------------------------------------------
interface BarTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function SwitchingBarTooltip({ active, payload, label }: BarTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 shadow text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="text-xs">
          {p.name}: {p.name === 'Avg Savings ($/yr)' ? fmtAud(p.value) : p.value.toLocaleString('en-AU')}
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const STATES = ['All', 'NSW', 'QLD', 'VIC', 'SA', 'TAS']

export default function RetailMarket() {
  const [dashboard, setDashboard] = useState<RetailMarketDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedState, setSelectedState] = useState<string>('All')
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (state: string) => {
    try {
      setError(null)
      const stateParam = state === 'All' ? undefined : state
      const data = await api.getRetailDashboard(stateParam)
      setDashboard(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load retail market data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchData(selectedState)
  }, [selectedState, fetchData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData(selectedState)
  }

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={18} />
        Loading retail market data...
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error ?? 'No data available'}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  // Pie chart — top 6 retailers + Others
  const pieData = dashboard.market_shares.map((m) => ({
    name: m.retailer,
    value: m.market_share_pct,
    residential_customers: m.residential_customers,
  }))

  // Bar chart — customer switching over quarters
  const barData = dashboard.switching_data.map((r) => ({
    quarter: r.quarter,
    'Switches (000s)': Math.round(r.switches_count / 1_000),
    'Avg Savings ($/yr)': r.avg_savings_aud_yr,
    switching_rate_pct: r.switching_rate_pct,
  }))

  const totalCustomersM =
    (dashboard.total_residential_customers / 1_000_000).toFixed(1)

  // Latest switching quarter
  const latestSwitching =
    dashboard.switching_data.length > 0
      ? dashboard.switching_data[dashboard.switching_data.length - 1]
      : null

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Retail Market Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            NEM retailer market share, DMO/VDO reference prices, and customer switching data
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* State selector */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {STATES.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedState(s)}
                className={[
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  selectedState === s
                    ? 'bg-amber-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Market Overview Cards (4)                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Users size={18} />}
          label="Total Customers"
          value={`${totalCustomersM}M`}
          sub="residential + SME"
        />
        <MetricCard
          icon={<DollarSign size={18} />}
          label="Standing Offer Customers"
          value={`${dashboard.standing_offer_customers_pct.toFixed(1)}%`}
          sub="still on expensive plans"
          badge={
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-red-600 bg-red-50">
              High Cost Risk
            </span>
          }
        />
        <MetricCard
          icon={<TrendingDown size={18} />}
          label="Best Market Deal"
          value={`${dashboard.best_market_offer_discount_pct.toFixed(1)}%`}
          sub="below DMO reference"
          badge={
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-green-600 bg-green-50">
              vs Standing Offer
            </span>
          }
        />
        <MetricCard
          icon={<ArrowRightLeft size={18} />}
          label="Avg Switching Savings"
          value={latestSwitching ? fmtAud(latestSwitching.avg_savings_aud_yr) : 'N/A'}
          sub="per year from switching"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row: Retailer Market Share (Pie) + Default Offer Prices (Table)      */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Retailer Market Share — Donut PieChart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Retailer Market Share
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {pieData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                iconType="circle"
                iconSize={9}
                formatter={(value) => (
                  <span className="text-xs text-gray-700 dark:text-gray-300">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
            NEM-wide residential market share by retailer
          </p>
        </div>

        {/* Default Offer Prices Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Default Offer Prices (DMO / VDO) 2025-26
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {['State', 'Distributor', 'Type', 'Rate (c/kWh)', 'Supply (c/day)', 'Annual Bill', 'YoY'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {dashboard.default_offers.map((offer, i) => {
                  // Highlight SA (highest price) in amber
                  const isSA = offer.state === 'SA'
                  const rowClass = isSA
                    ? 'border-b border-gray-100 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20'
                    : 'border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                  return (
                    <tr key={i} className={rowClass}>
                      <td className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">
                        {offer.state}
                      </td>
                      <td className="py-2 px-2 text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                        {offer.distributor}
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${
                            offer.offer_type === 'VDO'
                              ? 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30'
                              : 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30'
                          }`}
                        >
                          {offer.offer_type}
                        </span>
                      </td>
                      <td
                        className={`py-2 px-2 font-mono ${
                          isSA
                            ? 'text-amber-700 dark:text-amber-400 font-semibold'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {offer.flat_rate_c_kwh.toFixed(1)}
                      </td>
                      <td className="py-2 px-2 font-mono text-gray-700 dark:text-gray-300">
                        {offer.daily_supply_charge.toFixed(1)}
                      </td>
                      <td
                        className={`py-2 px-2 font-mono font-semibold ${
                          isSA
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {fmtAud(offer.annual_bill_aud)}
                      </td>
                      <td className="py-2 px-2">{changeBadge(offer.change_pct)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            SA has the highest electricity prices in the NEM. DMO set by AER; VDO set by ESC (Victoria).
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Customer Switching Trend — BarChart                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Customer Switching Trend
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Quarterly switching volumes and average savings (last 8 quarters)
            </p>
          </div>
          {latestSwitching && (
            <div className="text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400">Latest rate</div>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {latestSwitching.switching_rate_pct.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">annual switching</div>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="quarter"
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-gray-500 dark:text-gray-400"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-gray-500 dark:text-gray-400"
              label={{ value: 'Switches (000s)', angle: -90, position: 'insideLeft', offset: 5, style: { fontSize: 10 } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-gray-500 dark:text-gray-400"
              label={{ value: 'Avg Savings ($/yr)', angle: 90, position: 'insideRight', offset: 5, style: { fontSize: 10 } }}
            />
            <Tooltip content={<SwitchingBarTooltip />} />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-gray-700 dark:text-gray-300">{value}</span>
              )}
            />
            <Bar
              yAxisId="left"
              dataKey="Switches (000s)"
              fill="#f59e0b"
              radius={[3, 3, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="Avg Savings ($/yr)"
              fill="#3b82f6"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Retailer Market Share Detail Table                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Retailer Detail
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                {['Retailer', 'Residential', 'SME', 'Large C&I', 'Total', 'Market Share', 'Volume (GWh)', 'Avg Margin'].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {dashboard.market_shares.map((m, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      {m.retailer}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                    {fmtCustomers(m.residential_customers)}
                  </td>
                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                    {fmtCustomers(m.sme_customers)}
                  </td>
                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                    {fmtCustomers(m.large_commercial_customers)}
                  </td>
                  <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">
                    {fmtCustomers(m.total_customers)}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 w-16">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${(m.market_share_pct / 25) * 100}%`,
                            background: PIE_COLORS[i % PIE_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {m.market_share_pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300">
                    {m.electricity_volume_gwh.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300">
                    {m.avg_retail_margin_pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-400 dark:text-gray-500 pb-2">
        Data: AER Energy Made Easy, ESC Victoria, ACCC Retail Electricity Pricing Inquiry. DMO/VDO prices are reference benchmarks for the 2025-26 regulatory year. Last updated: {new Date(dashboard.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
      </div>
    </div>
  )
}
