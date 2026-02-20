import React, { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts'
import { FileText, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import {
  api,
  CorporatePpaMarketDashboard,
  CorporatePpaDeal,
  PpaOfftakerRecord,
  PpaPriceTrendRecord,
  PpaMarketSummaryRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const SECTOR_COLORS: Record<string, string> = {
  TECH:           'bg-blue-600 text-blue-100',
  RETAIL:         'bg-purple-600 text-purple-100',
  MINING:         'bg-amber-600 text-amber-100',
  MANUFACTURING:  'bg-orange-600 text-orange-100',
  FINANCE:        'bg-green-600 text-green-100',
  GOVERNMENT:     'bg-teal-600 text-teal-100',
}

const DEAL_TYPE_COLORS: Record<string, string> = {
  PHYSICAL:          'bg-green-600 text-green-100',
  FINANCIAL_FIRMING: 'bg-blue-600 text-blue-100',
  SLEEVED:           'bg-gray-600 text-gray-100',
  VIRTUAL:           'bg-purple-600 text-purple-100',
}

const TECH_COLORS: Record<string, string> = {
  WIND:    'bg-cyan-600 text-cyan-100',
  SOLAR:   'bg-yellow-500 text-yellow-100',
  HYBRID:  'bg-indigo-600 text-indigo-100',
  STORAGE: 'bg-pink-600 text-pink-100',
}

const SUSTAINABILITY_COLORS: Record<string, string> = {
  AAA: 'bg-emerald-700 text-emerald-100',
  AA:  'bg-emerald-600 text-emerald-100',
  A:   'bg-green-600 text-green-100',
  BBB: 'bg-amber-500 text-amber-100',
  BB:  'bg-red-600 text-red-100',
}

// Chart line colours
const CHART_COLORS: Record<string, string> = {
  WIND:  '#06b6d4',
  SOLAR: '#f59e0b',
  SPOT:  '#94a3b8',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Price Trend Chart
// ---------------------------------------------------------------------------

function PriceTrendChart({ data }: { data: PpaPriceTrendRecord[] }) {
  // Aggregate by year+technology, averaging strike price
  const byYearTech: Record<string, Record<string, { sum: number; count: number; min: number; max: number; spot: number }>> = {}
  for (const r of data) {
    if (!byYearTech[r.year]) byYearTech[r.year] = {}
    if (!byYearTech[r.year][r.technology]) {
      byYearTech[r.year][r.technology] = { sum: 0, count: 0, min: Infinity, max: -Infinity, spot: 0 }
    }
    const entry = byYearTech[r.year][r.technology]
    entry.sum += r.avg_strike_price_mwh
    entry.count += 1
    if (r.min_strike_price_mwh < entry.min) entry.min = r.min_strike_price_mwh
    if (r.max_strike_price_mwh > entry.max) entry.max = r.max_strike_price_mwh
    entry.spot += r.spot_price_comparison
  }

  const years = Object.keys(byYearTech).sort()
  const chartData = years.map(year => {
    const point: Record<string, number | string> = { year }
    for (const tech of ['WIND', 'SOLAR']) {
      const entry = byYearTech[year]?.[tech]
      if (entry) {
        point[`${tech}_avg`] = Math.round((entry.sum / entry.count) * 10) / 10
        point[`${tech}_min`] = entry.min
        point[`${tech}_max`] = entry.max
        point['spot'] = Math.round((entry.spot / entry.count) * 10) / 10
      }
    }
    return point
  })

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-200 mb-4">PPA Strike Price Trend by Technology ($/MWh)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}`} domain={[30, 90]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => [`$${v}/MWh`]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
          <Line type="monotone" dataKey="WIND_avg" name="WIND Avg" stroke={CHART_COLORS.WIND} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="SOLAR_avg" name="SOLAR Avg" stroke={CHART_COLORS.SOLAR} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="spot" name="Spot (Avg)" stroke={CHART_COLORS.SPOT} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Market Summary Chart (dual-axis)
// ---------------------------------------------------------------------------

function MarketSummaryChart({ data }: { data: PpaMarketSummaryRecord[] }) {
  const chartData = data.map(r => ({
    year: r.year,
    capacity_mw: r.total_capacity_mw,
    total_deals: r.total_deals,
    additionality_pct: r.additionality_pct,
  }))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-200 mb-4">Annual Market Volume — Capacity (MW) &amp; Deal Count</h2>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis yAxisId="left" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(1)}GW`} />
          <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
          <Bar yAxisId="left" dataKey="capacity_mw" name="Contracted Capacity (MW)" fill="#3b82f6" opacity={0.8} />
          <Line yAxisId="right" type="monotone" dataKey="total_deals" name="Total Deals" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
          <Line yAxisId="right" type="monotone" dataKey="additionality_pct" name="Additionality %" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PPA Deals Table
// ---------------------------------------------------------------------------

function PpaDealsTable({ deals }: { deals: CorporatePpaDeal[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-200 mb-3">PPA Deals</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="text-gray-500 border-b border-gray-700">
              <th className="text-left py-2 pr-3 font-medium">Project</th>
              <th className="text-left py-2 pr-3 font-medium">Tech</th>
              <th className="text-left py-2 pr-3 font-medium">State</th>
              <th className="text-left py-2 pr-3 font-medium">Offtaker</th>
              <th className="text-left py-2 pr-3 font-medium">Sector</th>
              <th className="text-left py-2 pr-3 font-medium">Type</th>
              <th className="text-right py-2 pr-3 font-medium">MW</th>
              <th className="text-right py-2 pr-3 font-medium">Strike $/MWh</th>
              <th className="text-right py-2 pr-3 font-medium">Mkt $/MWh</th>
              <th className="text-right py-2 pr-3 font-medium">Signed</th>
              <th className="text-right py-2 pr-3 font-medium">Term (yr)</th>
              <th className="text-center py-2 pr-3 font-medium">Add.</th>
              <th className="text-center py-2 font-medium">LGC</th>
            </tr>
          </thead>
          <tbody>
            {deals.map(d => (
              <tr key={d.deal_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-3 font-medium text-gray-200 max-w-[160px] truncate">{d.project_name}</td>
                <td className="py-2 pr-3">
                  <Badge label={d.technology} colorClass={TECH_COLORS[d.technology] ?? 'bg-gray-600 text-gray-100'} />
                </td>
                <td className="py-2 pr-3 text-gray-400">{d.state}</td>
                <td className="py-2 pr-3 max-w-[120px] truncate">{d.offtaker_name}</td>
                <td className="py-2 pr-3">
                  <Badge label={d.offtaker_sector} colorClass={SECTOR_COLORS[d.offtaker_sector] ?? 'bg-gray-600 text-gray-100'} />
                </td>
                <td className="py-2 pr-3">
                  <Badge label={d.deal_type} colorClass={DEAL_TYPE_COLORS[d.deal_type] ?? 'bg-gray-600 text-gray-100'} />
                </td>
                <td className="py-2 pr-3 text-right">{d.capacity_mw.toFixed(0)}</td>
                <td className="py-2 pr-3 text-right font-mono text-green-400">${d.strike_price_mwh.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right font-mono text-gray-400">${d.market_price_at_signing.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-gray-400">{d.signing_date.slice(0, 4)}</td>
                <td className="py-2 pr-3 text-right">{d.contract_length_years}</td>
                <td className="py-2 pr-3 text-center">
                  {d.additionality
                    ? <CheckCircle size={14} className="inline text-green-400" />
                    : <XCircle size={14} className="inline text-red-400" />}
                </td>
                <td className="py-2 text-center">
                  {d.bundled_lgcs
                    ? <CheckCircle size={14} className="inline text-green-400" />
                    : <XCircle size={14} className="inline text-gray-600" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top Offtakers Table
// ---------------------------------------------------------------------------

function OfftakersTable({ offtakers }: { offtakers: PpaOfftakerRecord[] }) {
  const sorted = [...offtakers].sort((a, b) => b.total_contracted_mw - a.total_contracted_mw)

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-200 mb-3">Top Corporate Offtakers</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="text-gray-500 border-b border-gray-700">
              <th className="text-left py-2 pr-3 font-medium">Offtaker</th>
              <th className="text-left py-2 pr-3 font-medium">Sector</th>
              <th className="text-right py-2 pr-3 font-medium">Contracted MW</th>
              <th className="text-right py-2 pr-3 font-medium">Contracted GWh</th>
              <th className="text-right py-2 pr-3 font-medium">Deals</th>
              <th className="text-right py-2 pr-3 font-medium">Avg Strike</th>
              <th className="text-center py-2 pr-3 font-medium">RE100</th>
              <th className="text-right py-2 pr-3 font-medium">Net Zero</th>
              <th className="text-center py-2 font-medium">Rating</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(o => (
              <tr key={o.offtaker_name} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-3 font-medium text-gray-200">{o.offtaker_name}</td>
                <td className="py-2 pr-3">
                  <Badge label={o.sector} colorClass={SECTOR_COLORS[o.sector] ?? 'bg-gray-600 text-gray-100'} />
                </td>
                <td className="py-2 pr-3 text-right font-mono">{o.total_contracted_mw.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right font-mono">{o.total_contracted_gwh.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right">{o.num_deals}</td>
                <td className="py-2 pr-3 text-right font-mono text-green-400">${o.avg_strike_price.toFixed(1)}</td>
                <td className="py-2 pr-3 text-center">
                  {o.re100_member
                    ? <Badge label="RE100" colorClass="bg-emerald-700 text-emerald-100" />
                    : <span className="text-gray-600">—</span>}
                </td>
                <td className="py-2 pr-3 text-right text-gray-400">
                  {o.net_zero_target ? o.net_zero_target : '—'}
                </td>
                <td className="py-2 text-center">
                  <Badge label={o.sustainability_rating} colorClass={SUSTAINABILITY_COLORS[o.sustainability_rating] ?? 'bg-gray-600 text-gray-100'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function CorporatePpaMarket() {
  const [data, setData] = useState<CorporatePpaMarketDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getCorporatePpaMarketDashboard()
      setData(result)
      setLastRefresh(new Date())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="text-blue-400 shrink-0" size={28} />
          <div>
            <h1 className="text-xl font-bold text-white">Corporate Power Purchase Agreement (PPA) Market</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Corporate renewable PPAs, offtaker analysis, contract structures, pricing benchmarks and additionality tracking
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg h-24 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard
              label="Total Contracted Capacity"
              value={`${data.total_contracted_capacity_mw.toLocaleString()} MW`}
              sub="All active PPA deals"
            />
            <KpiCard
              label="Avg PPA Price"
              value={`$${data.avg_ppa_price_mwh.toFixed(1)}/MWh`}
              sub="Weighted avg strike"
            />
            <KpiCard
              label="Additionality"
              value={`${data.additionality_pct.toFixed(1)}%`}
              sub="New build projects"
            />
            <KpiCard
              label="YoY Growth"
              value={`+${data.yoy_growth_pct.toFixed(1)}%`}
              sub="Deal volume growth"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <PriceTrendChart data={data.price_trends} />
            <MarketSummaryChart data={data.market_summary} />
          </div>

          {/* Deals Table */}
          <PpaDealsTable deals={data.ppa_deals} />

          {/* Offtakers Table */}
          <OfftakersTable offtakers={data.offtakers} />

          {/* Footer */}
          <p className="text-xs text-gray-600 text-right">
            Last refreshed: {lastRefresh.toLocaleTimeString('en-AU')} — Source: AEMO, Corporate PPA tracker, Bloomberg NEF
          </p>
        </>
      )}
    </div>
  )
}
