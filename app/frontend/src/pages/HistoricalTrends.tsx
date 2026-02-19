// ---------------------------------------------------------------------------
// HistoricalTrends.tsx — Sprint 17c
// Multi-year NEM price trends, year-over-year comparisons, and long-run
// structural analysis covering the Australian energy transition (2015–2025).
// ---------------------------------------------------------------------------

import React, { useState, useEffect, useCallback } from 'react'
import {
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Leaf, Clock, RefreshCw } from 'lucide-react'
import { api, LongRunTrendSummary, YearOverYearChange } from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NEM_REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
const YEAR_OPTIONS = Array.from({ length: 16 }, (_, i) => 2010 + i)

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
          {label}
        </p>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
        {sub && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trend icon helper
// ---------------------------------------------------------------------------

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') {
    return <TrendingUp size={14} className="text-green-500 inline" />
  }
  if (trend === 'worsening') {
    return <TrendingDown size={14} className="text-red-500 inline" />
  }
  return <span className="text-gray-400 text-sm inline">—</span>
}

// ---------------------------------------------------------------------------
// Metric display name mapping
// ---------------------------------------------------------------------------

const METRIC_LABELS: Record<string, string> = {
  avg_price:        'Avg Price ($/MWh)',
  peak_demand:      'Peak Demand (MW)',
  renewable_pct:    'Renewable %',
  carbon_intensity: 'Carbon Intensity (kg CO2/MWh)',
  spike_events:     'Spike Events (>$300)',
  negative_hours:   'Negative Price Hours',
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function HistoricalTrends() {
  const [region, setRegion] = useState('NSW1')
  const [startYear, setStartYear] = useState(2015)
  const [endYear, setEndYear] = useState(2025)
  const [yoyYear, setYoyYear] = useState(2024)

  const [summary, setSummary] = useState<LongRunTrendSummary | null>(null)
  const [yoyChanges, setYoyChanges] = useState<YearOverYearChange[]>([])
  const [loading, setLoading] = useState(false)
  const [yoyLoading, setYoyLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchTrends = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getAnnualTrends(region, startYear, endYear)
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load historical trends')
    } finally {
      setLoading(false)
    }
  }, [region, startYear, endYear])

  const fetchYoy = useCallback(async () => {
    setYoyLoading(true)
    try {
      const data = await api.getYoyChanges(region, yoyYear)
      setYoyChanges(data)
    } catch {
      setYoyChanges([])
    } finally {
      setYoyLoading(false)
    }
  }, [region, yoyYear])

  useEffect(() => { fetchTrends() }, [fetchTrends])
  useEffect(() => { fetchYoy() }, [fetchYoy])

  // ---------------------------------------------------------------------------
  // Derived chart data
  // ---------------------------------------------------------------------------

  const priceChartData = summary?.annual_data.map(d => ({
    year: d.year,
    nominal: d.avg_price_aud_mwh,
    cpi_adjusted: d.cpi_adjusted_price,
  })) ?? []

  const renewableChartData = summary?.annual_data.map(d => ({
    year: d.year,
    renewable_pct: d.renewable_pct,
    carbon_intensity: d.carbon_intensity,
  })) ?? []

  // ---------------------------------------------------------------------------
  // Summary card values
  // ---------------------------------------------------------------------------

  const priceCagr = summary?.price_cagr_pct ?? 0
  const reStart   = summary?.renewable_pct_start ?? 0
  const reEnd     = summary?.renewable_pct_end ?? 0
  const ciStart   = summary?.carbon_intensity_start ?? 1
  const ciEnd     = summary?.carbon_intensity_end ?? 1
  const carbonReductionPct = ciStart > 0
    ? ((1 - ciEnd / ciStart) * 100).toFixed(0)
    : '0'

  const firstYear = summary?.annual_data[0]
  const lastYear  = summary?.annual_data[summary.annual_data.length - 1]
  const spikeFirst = firstYear?.spike_events_count ?? 0
  const spikeLast  = lastYear?.spike_events_count ?? 0

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Historical Trends
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Multi-year NEM market intelligence — energy transition analysis
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Region selector */}
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          >
            {NEM_REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Start year selector */}
          <select
            value={startYear}
            onChange={e => setStartYear(Number(e.target.value))}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          >
            {YEAR_OPTIONS.filter(y => y <= endYear).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <span className="text-gray-400 text-sm">to</span>

          {/* End year selector */}
          <select
            value={endYear}
            onChange={e => setEndYear(Number(e.target.value))}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          >
            {YEAR_OPTIONS.filter(y => y >= startYear).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={() => { fetchTrends(); fetchYoy() }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Long-run summary cards                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={priceCagr >= 0
            ? <TrendingUp size={20} className="text-red-500" />
            : <TrendingDown size={20} className="text-green-500" />
          }
          label="Price CAGR"
          value={`${priceCagr.toFixed(1)}%/yr`}
          sub={`${summary?.start_year ?? startYear}–${summary?.end_year ?? endYear}`}
          color="bg-red-50 dark:bg-red-900/20"
        />
        <SummaryCard
          icon={<Leaf size={20} className="text-green-500" />}
          label="Renewable Growth"
          value={`${reStart.toFixed(0)}% → ${reEnd.toFixed(0)}%`}
          sub={`+${(reEnd - reStart).toFixed(0)} pp over period`}
          color="bg-green-50 dark:bg-green-900/20"
        />
        <SummaryCard
          icon={<TrendingDown size={20} className="text-emerald-500" />}
          label="Carbon Reduction"
          value={`-${carbonReductionPct}%`}
          sub={`${ciStart.toFixed(2)} → ${ciEnd.toFixed(2)} kg CO2/MWh`}
          color="bg-emerald-50 dark:bg-emerald-900/20"
        />
        <SummaryCard
          icon={<Clock size={20} className="text-amber-500" />}
          label="Spike Events Trend"
          value={`${spikeFirst} → ${spikeLast}`}
          sub={`Events >$300/MWh (${firstYear?.year ?? startYear} vs ${lastYear?.year ?? endYear})`}
          color="bg-amber-50 dark:bg-amber-900/20"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Annual Price Trend chart                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Annual Price Trend — Nominal vs CPI-Adjusted (2024 $)
        </h2>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
            Loading price trend data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={priceChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nominalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={v => `$${v}`}
                label={{ value: '$/MWh', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#6b7280' } }}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  `$${v.toFixed(2)}/MWh`,
                  name === 'nominal' ? 'Nominal Price' : 'CPI-Adjusted (2024$)',
                ]}
                labelFormatter={l => `Year: ${l}`}
                contentStyle={{ background: 'var(--tw-bg-opacity,1) #1f2937', border: 'none', borderRadius: '8px' }}
              />
              <Legend
                formatter={v => v === 'nominal' ? 'Nominal Price' : 'CPI-Adjusted (2024$)'}
              />
              {/* 2022 gas crisis annotation */}
              <ReferenceLine
                x={2022}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{ value: '2022 Gas Crisis', position: 'top', fontSize: 11, fill: '#ef4444' }}
              />
              <Area
                type="monotone"
                dataKey="nominal"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#nominalGrad)"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="cpi_adjusted"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Renewable % & Carbon Intensity dual-axis chart                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Energy Transition — Renewable Share & Carbon Intensity
        </h2>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
            Loading transition data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={renewableChartData} margin={{ top: 10, right: 50, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={v => `${v}%`}
                label={{ value: 'Renewable %', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#22c55e' } }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={v => v.toFixed(2)}
                label={{ value: 'kg CO2/MWh', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 11, fill: '#f97316' } }}
              />
              <Tooltip
                formatter={(v: number, name: string) => {
                  if (name === 'renewable_pct') return [`${v.toFixed(1)}%`, 'Renewable %']
                  return [`${v.toFixed(3)} kg CO2/MWh`, 'Carbon Intensity']
                }}
                labelFormatter={l => `Year: ${l}`}
              />
              <Legend
                formatter={v => v === 'renewable_pct' ? 'Renewable %' : 'Carbon Intensity'}
              />
              <Bar
                yAxisId="left"
                dataKey="renewable_pct"
                fill="#22c55e"
                fillOpacity={0.75}
                radius={[3, 3, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="carbon_intensity"
                stroke="#f97316"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#f97316' }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Year-over-Year comparison                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Year-over-Year Comparison
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-gray-400">Year:</label>
            <select
              value={yoyYear}
              onChange={e => setYoyYear(Number(e.target.value))}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
            >
              {YEAR_OPTIONS.filter(y => y >= 2012).map(y => (
                <option key={y} value={y}>{y} vs {y - 1}</option>
              ))}
            </select>
          </div>
        </div>

        {yoyLoading ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading year-over-year data...</div>
        ) : yoyChanges.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">No data available for this year range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Metric</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">
                    {yoyYear - 1}
                  </th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">
                    {yoyYear}
                  </th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Change</th>
                  <th className="text-center py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {yoyChanges.map(c => (
                  <tr
                    key={c.metric}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 font-medium">
                      {METRIC_LABELS[c.metric] ?? c.metric}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400">
                      {c.prior_year_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-800 dark:text-gray-200 font-semibold">
                      {c.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-medium ${
                      c.trend === 'improving' ? 'text-green-600 dark:text-green-400' :
                      c.trend === 'worsening' ? 'text-red-600 dark:text-red-400' :
                      'text-gray-500 dark:text-gray-400'
                    }`}>
                      {c.change_pct > 0 ? '+' : ''}{c.change_pct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <TrendIcon trend={c.trend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Full annual data table                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Annual Data Table
        </h2>
        {loading ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading annual data...</div>
        ) : !summary ? (
          <div className="text-sm text-gray-400 py-6 text-center">No data available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Year</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Avg Price</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Max Price</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Volatility</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Avg Demand</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Renewable %</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Carbon (kg/MWh)</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Spikes</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Neg Hours</th>
                </tr>
              </thead>
              <tbody>
                {summary.annual_data.map(row => {
                  const isGasCrisis = row.year === 2022
                  const rowClass = isGasCrisis
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50'
                    : 'border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30'

                  // Simple sparkline bar for renewable %
                  const barWidth = Math.round(row.renewable_pct)

                  return (
                    <tr key={row.year} className={rowClass}>
                      <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-gray-200">
                        {row.year}
                        {isGasCrisis && (
                          <span className="ml-2 text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">
                            Gas Crisis
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-800 dark:text-gray-200">
                        ${row.avg_price_aud_mwh.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400">
                        ${row.max_price_aud_mwh.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400">
                        ${row.price_volatility.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400">
                        {row.avg_demand_mw.toLocaleString()} MW
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="text-gray-800 dark:text-gray-200 w-10 text-right">
                            {row.renewable_pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400">
                        {row.carbon_intensity.toFixed(3)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-medium ${
                        row.spike_events_count > 80
                          ? 'text-red-600 dark:text-red-400'
                          : row.spike_events_count > 30
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {row.spike_events_count}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400">
                        {row.negative_price_hours}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center pb-2">
        Data represents simulated NEM market data. CPI adjustment uses 2.5%/yr compounding with 2024 as base year.
        Spike events defined as intervals with spot price &gt; $300/MWh.
      </p>
    </div>
  )
}
