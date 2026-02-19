import React, { useState, useEffect, useCallback } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { BarChart2, TrendingUp, Activity, RefreshCw } from 'lucide-react'
import { api, DurationCurvePoint, StatisticalSummary, SeasonalPattern } from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

const PERIODS = [
  { value: '30d',  label: '30 Days'  },
  { value: '90d',  label: '90 Days'  },
  { value: '365d', label: '12 Months' },
]

const PERIOD_DAYS: Record<string, number> = {
  '30d':  30,
  '90d':  90,
  '365d': 365,
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtMW(mw: number): string {
  return mw.toLocaleString('en-AU', { maximumFractionDigits: 0 }) + ' MW'
}

function fmtPrice(price: number): string {
  if (price < 0) return `-$${Math.abs(price).toFixed(0)}/MWh`
  return `$${price.toFixed(0)}/MWh`
}

function fmtNum(n: number, decimals = 1): string {
  return n.toLocaleString('en-AU', { maximumFractionDigits: decimals })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  colorClass: string
}

function StatCard({ icon, label, value, sub, colorClass }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-1">
      <div className={`flex items-center gap-2 text-sm font-medium ${colorClass}`}>
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>
    </div>
  )
}

// Custom tooltip for duration curves
function DurationTooltip({ active, payload, label, type }: {
  active?: boolean
  payload?: { value: number; name: string }[]
  label?: number
  type: 'demand' | 'price'
}) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  const hours = label !== undefined ? (label * 8760 / 100).toFixed(0) : '—'
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs shadow">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
        P{label} — {hours} hrs/yr above this
      </p>
      {type === 'demand' ? (
        <p className="text-blue-600 dark:text-blue-400">
          Demand: {val !== undefined ? fmtMW(val) : '—'}
        </p>
      ) : (
        <p className="text-amber-600 dark:text-amber-400">
          Price: {val !== undefined ? fmtPrice(val) : '—'}
        </p>
      )}
    </div>
  )
}

// Custom tooltip for seasonal bar chart
function SeasonalTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs shadow">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.name.includes('Price') ? `$${p.value.toFixed(0)}/MWh` : `${fmtNum(p.value, 0)} MW`}
        </p>
      ))}
    </div>
  )
}

// Statistical summary table row
function StatRow({ label, demand, price, highlight }: {
  label: string
  demand: number | undefined
  price: number | undefined
  highlight?: boolean
}) {
  const rowClass = highlight
    ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold'
    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
  return (
    <tr className={`border-b border-gray-200 dark:border-gray-700 ${rowClass}`}>
      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{label}</td>
      <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100">
        {demand !== undefined ? `${fmtNum(demand, 0)} MW` : '—'}
      </td>
      <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100">
        {price !== undefined ? (price < 0 ? `-$${Math.abs(price).toFixed(0)}` : `$${price.toFixed(0)}`) : '—'}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function LoadDuration() {
  const [region, setRegion] = useState('NSW1')
  const [period, setPeriod] = useState('365d')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [durationData, setDurationData] = useState<DurationCurvePoint[]>([])
  const [summary, setSummary] = useState<StatisticalSummary | null>(null)
  const [seasonal, setSeasonal] = useState<SeasonalPattern[]>([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const periodDays = PERIOD_DAYS[period] ?? 365
      const [curve, stats, season] = await Promise.all([
        api.getDurationCurve(region, periodDays),
        api.getStatsSummary(region, period),
        api.getSeasonalPattern(region),
      ])
      setDurationData(curve)
      setSummary(stats)
      setSeasonal(season)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [region, period])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="text-blue-500" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Load Duration Curve
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Statistical distribution analysis — NEM demand and prices
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Region selector */}
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Period selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Stats Summary Cards                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity size={16} />}
          label="Median Demand"
          value={summary ? `${fmtNum(summary.demand_p50, 0)} MW` : '—'}
          sub={`P50: ${summary ? fmtNum(summary.demand_p50, 0) : '—'} MW`}
          colorClass="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Peak Demand"
          value={summary ? `${fmtNum(summary.demand_p99, 0)} MW` : '—'}
          sub={`P99: ${summary ? fmtNum(summary.demand_p99, 0) : '—'} MW`}
          colorClass="text-indigo-600 dark:text-indigo-400"
        />
        <StatCard
          icon={<BarChart2 size={16} />}
          label="Median Price"
          value={summary ? `$${summary.price_p50.toFixed(0)}/MWh` : '—'}
          sub={`P50: $${summary ? summary.price_p50.toFixed(0) : '—'}/MWh`}
          colorClass="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="P95 Price"
          value={summary ? `$${summary.price_p95.toFixed(0)}/MWh` : '—'}
          sub="95th percentile spot price"
          colorClass="text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Load Duration Curve                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={18} className="text-blue-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Load Duration Curve
          </h2>
          <span className="text-xs text-gray-400 ml-1">— {region}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          How many hours per year does demand exceed a given level? Curve decreases from
          100% of hours (minimum demand) to 0% (peak demand).
        </p>

        {loading && durationData.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse w-full h-48 bg-gray-100 dark:bg-gray-700 rounded" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={durationData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
              <XAxis
                dataKey="percentile"
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: '% of time demand exceeds this level',
                  position: 'insideBottom',
                  offset: -2,
                  style: { fontSize: 11, fill: '#9ca3af' },
                }}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                label={{
                  value: 'Demand (MW)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 11, fill: '#9ca3af' },
                }}
                tick={{ fontSize: 11 }}
              />
              <Tooltip content={<DurationTooltip type="demand" />} />
              <ReferenceLine x={10}  stroke="#93c5fd" strokeDasharray="4 2" label={{ value: 'P10', position: 'top', fontSize: 10 }} />
              <ReferenceLine x={50}  stroke="#60a5fa" strokeDasharray="4 2" label={{ value: 'P50', position: 'top', fontSize: 10 }} />
              <ReferenceLine x={90}  stroke="#2563eb" strokeDasharray="4 2" label={{ value: 'P90', position: 'top', fontSize: 10 }} />
              <Area
                type="monotone"
                dataKey="demand_mw"
                name="Demand"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#demandGrad)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Price Duration Curve                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={18} className="text-amber-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Price Duration Curve
          </h2>
          <span className="text-xs text-gray-400 ml-1">— {region}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          How many hours per year does the spot price exceed a given level?
          The steep right tail reveals how rarely extreme prices (VOLL) occur.
        </p>

        {loading && durationData.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse w-full h-48 bg-gray-100 dark:bg-gray-700 rounded" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={durationData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
              <XAxis
                dataKey="percentile"
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: '% of time price exceeds this level',
                  position: 'insideBottom',
                  offset: -2,
                  style: { fontSize: 11, fill: '#9ca3af' },
                }}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                label={{
                  value: 'Price (AUD/MWh)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 11, fill: '#9ca3af' },
                }}
                tick={{ fontSize: 11 }}
              />
              <Tooltip content={<DurationTooltip type="price" />} />
              <ReferenceLine x={10}  stroke="#fcd34d" strokeDasharray="4 2" label={{ value: 'P10', position: 'top', fontSize: 10 }} />
              <ReferenceLine x={50}  stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'P50', position: 'top', fontSize: 10 }} />
              <ReferenceLine x={90}  stroke="#d97706" strokeDasharray="4 2" label={{ value: 'P90', position: 'top', fontSize: 10 }} />
              <Area
                type="monotone"
                dataKey="price_aud_mwh"
                name="Price"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#priceGrad)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Seasonal Pattern Chart                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 size={18} className="text-green-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Seasonal Patterns — Monthly Average
          </h2>
          <span className="text-xs text-gray-400 ml-1">— {region}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Average monthly demand (MW, left axis) and average spot price (AUD/MWh, right axis).
          Australian summer (Jan/Feb) drives peak demand and prices; shoulder season (Apr/Oct) troughs.
        </p>

        {loading && seasonal.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse w-full h-48 bg-gray-100 dark:bg-gray-700 rounded" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={seasonal} margin={{ top: 10, right: 40, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
              <XAxis dataKey="month_name" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="demand"
                orientation="left"
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                label={{
                  value: 'Avg Demand (MW)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 11, fill: '#9ca3af' },
                }}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                yAxisId="price"
                orientation="right"
                tickFormatter={(v) => `$${v}`}
                label={{
                  value: 'Avg Price ($/MWh)',
                  angle: 90,
                  position: 'insideRight',
                  style: { fontSize: 11, fill: '#9ca3af' },
                }}
                tick={{ fontSize: 11 }}
              />
              <Tooltip content={<SeasonalTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                yAxisId="demand"
                dataKey="avg_demand_mw"
                name="Avg Demand"
                fill="#3b82f6"
                fillOpacity={0.8}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                yAxisId="price"
                dataKey="avg_price_aud_mwh"
                name="Avg Price ($/MWh)"
                fill="#f59e0b"
                fillOpacity={0.8}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Statistical Summary Table                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={18} className="text-indigo-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Statistical Summary
          </h2>
          {summary && (
            <span className="ml-auto text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
              {summary.period_label} — {region}
            </span>
          )}
        </div>

        {summary ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/60 border-b border-gray-200 dark:border-gray-600">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Statistic
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">
                    Demand
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider">
                    Price (AUD/MWh)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                <StatRow label="Minimum"        demand={summary.demand_min}    price={summary.price_min} />
                <StatRow label="P10"            demand={summary.demand_p10}    price={summary.price_p10} />
                <StatRow label="P25"            demand={summary.demand_p25}    price={summary.price_p25} />
                <StatRow label="P50 (Median)"   demand={summary.demand_p50}    price={summary.price_p50}    highlight />
                <StatRow label="P75"            demand={summary.demand_p75}    price={summary.price_p75} />
                <StatRow label="P90"            demand={summary.demand_p90}    price={summary.price_p90} />
                <StatRow label="P95"            demand={undefined}             price={summary.price_p95} />
                <StatRow label="P99"            demand={summary.demand_p99}    price={summary.price_p99} />
                <StatRow label="Maximum"        demand={summary.demand_max}    price={summary.price_max} />
                <StatRow label="Mean"           demand={summary.demand_mean}   price={summary.price_mean} />
                <StatRow label="Std Deviation"  demand={summary.demand_stddev} price={summary.price_stddev} />
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-pulse w-full h-32 bg-gray-100 dark:bg-gray-700 rounded" />
          </div>
        )}

        {/* Correlation and peak hour info */}
        {summary && (
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">Demand-Price Correlation</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {summary.correlation_demand_price.toFixed(2)} (Pearson)
              </span>
              <span className="text-xs text-gray-400">
                {summary.correlation_demand_price > 0.5 ? 'Strong positive' : 'Moderate positive'} — higher demand raises prices
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">Peak Demand Hour</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {summary.peak_demand_hour}:00 ({summary.peak_demand_hour < 12 ? 'AM' : 'PM'})
              </span>
              <span className="text-xs text-gray-400">Evening residential AC / heating peak</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">Peak Price Hour</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {summary.peak_price_hour}:00 ({summary.peak_price_hour < 12 ? 'AM' : 'PM'})
              </span>
              <span className="text-xs text-gray-400">Aligns with demand peak</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
