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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from 'recharts'
import { Users, RefreshCw, TrendingDown, DollarSign, Activity, Zap } from 'lucide-react'
import {
  getRetailerCompetitionDashboard,
  ERCDashboard,
  ERCMarketShareRecord,
  ERCChurnRecord,
  ERCMarginRecord,
} from '../api/client'

// ─── Colour palettes ────────────────────────────────────────────────────────

const BIG3_COLORS: Record<string, string> = {
  'AGL Energy': '#3b82f6',
  'Origin Energy': '#60a5fa',
  'EnergyAustralia': '#93c5fd',
}

const CHALLENGER_COLORS: Record<string, string> = {
  'Alinta Energy': '#10b981',
  'Red Energy': '#34d399',
  'Simply Energy': '#6ee7b7',
  'Momentum Energy': '#a7f3d0',
  '1st Energy': '#d1fae5',
  'Amber Electric': '#059669',
}

const NICHE_COLORS: Record<string, string> = {
  Others: '#6b7280',
}

function retailerColor(name: string): string {
  return BIG3_COLORS[name] ?? CHALLENGER_COLORS[name] ?? NICHE_COLORS[name] ?? '#9ca3af'
}

const COST_COLORS = {
  wholesale_cost_per_mwh: '#f59e0b',
  network_cost_per_mwh: '#3b82f6',
  environmental_cost_per_mwh: '#10b981',
  retail_margin_per_mwh: '#8b5cf6',
}

const CHURN_COLORS = {
  switching_rate_pct: '#f59e0b',
  churn_to_challenger_pct: '#10b981',
  churn_to_big3_pct: '#3b82f6',
  churn_to_green_pct: '#34d399',
}

const PIE_PALETTE = [
  '#3b82f6', '#60a5fa', '#93c5fd',
  '#10b981', '#34d399', '#6ee7b7', '#a7f3d0',
  '#6b7280',
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 1): string {
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtAud(n: number): string {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtCustomers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString('en-AU')
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: string
}

function KpiCard({ icon, label, value, sub, accent = 'text-blue-400' }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 border border-gray-700">
      <div className={`p-2 rounded-lg bg-gray-700 ${accent}`}>{icon}</div>
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${accent}`}>{value}</p>
        {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Offer type badge ────────────────────────────────────────────────────────

function offerBadge(type: string) {
  const map: Record<string, string> = {
    STANDING: 'bg-red-900 text-red-300 border border-red-700',
    MARKET_BEST: 'bg-green-900 text-green-300 border border-green-700',
    MARKET_TYPICAL: 'bg-blue-900 text-blue-300 border border-blue-700',
    GREENPOWER: 'bg-emerald-900 text-emerald-300 border border-emerald-700',
    GREEN: 'bg-emerald-900 text-emerald-300 border border-emerald-700',
  }
  const cls = map[type] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ─── Market Share chart ──────────────────────────────────────────────────────

function MarketShareSection({ data }: { data: ERCMarketShareRecord[] }) {
  const [stateFilter, setStateFilter] = useState<string>('ALL')
  const states = ['ALL', 'NSW', 'VIC', 'QLD', 'SA', 'TAS']

  const allRetailers = Array.from(new Set(data.map(d => d.retailer_name)))

  // Stacked bar data: one entry per state
  const barData = (['NSW', 'VIC', 'QLD', 'SA', 'TAS'] as const).map(state => {
    const stateRows = data.filter(d => d.state === state)
    const entry: Record<string, number | string> = { state }
    for (const r of stateRows) {
      entry[r.retailer_name] = r.market_share_residential_pct
    }
    return entry
  })

  // Pie data for selected state
  const pieData =
    stateFilter === 'ALL'
      ? []
      : data
          .filter(d => d.state === stateFilter)
          .map(d => ({ name: d.retailer_name, value: d.market_share_residential_pct }))

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <SectionHeader
        title="Retail Market Share by State"
        subtitle="Residential customer share (%) — Q4 2024"
      />
      <div className="flex gap-2 mb-5 flex-wrap">
        {states.map(s => (
          <button
            key={s}
            onClick={() => setStateFilter(s)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              stateFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Stacked bar */}
        <div>
          <p className="text-gray-400 text-xs mb-2">All states — stacked market share</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                formatter={(v: number) => [`${v.toFixed(1)}%`, '']}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {allRetailers.map(r => (
                <Bar key={r} dataKey={r} stackId="a" fill={retailerColor(r)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie for selected state */}
        <div>
          {stateFilter === 'ALL' ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Select a state above to view pie chart
            </div>
          ) : (
            <>
              <p className="text-gray-400 text-xs mb-2">{stateFilter} — share breakdown</p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name}: ${value.toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                    formatter={(v: number) => [`${v.toFixed(1)}%`]}
                  />
                  <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Offer comparison table ──────────────────────────────────────────────────

function OfferTable({ data }: { data: ERCDashboard['offers'] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <SectionHeader
        title="Standing vs Market Offer Comparison"
        subtitle="Retailer offers across states — annual bill vs DMO/VDO reference price"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-700">
              <th className="text-left py-2 pr-4">Retailer</th>
              <th className="text-left py-2 pr-4">State</th>
              <th className="text-left py-2 pr-4">Type</th>
              <th className="text-right py-2 pr-4">Annual Bill</th>
              <th className="text-right py-2 pr-4">vs Ref Price</th>
              <th className="text-right py-2 pr-4">Green %</th>
              <th className="text-right py-2 pr-4">Contract (mo)</th>
              <th className="text-right py-2 pr-4">Exit Fee</th>
              <th className="text-right py-2 pr-4">Solar FiT (c)</th>
              <th className="text-right py-2">Headline Disc.</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-2 pr-4 font-medium text-white">{row.retailer_name}</td>
                <td className="py-2 pr-4 text-gray-300">{row.state}</td>
                <td className="py-2 pr-4">{offerBadge(row.offer_type)}</td>
                <td className="py-2 pr-4 text-right text-gray-200">{fmtAud(row.annual_bill_median)}</td>
                <td className="py-2 pr-4 text-right">
                  {row.annual_bill_vs_ref_pct === 0 ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span className={row.annual_bill_vs_ref_pct < 0 ? 'text-green-400' : 'text-red-400'}>
                      {row.annual_bill_vs_ref_pct > 0 ? '+' : ''}{fmt(row.annual_bill_vs_ref_pct)}%
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right text-gray-300">{fmt(row.green_pct, 0)}%</td>
                <td className="py-2 pr-4 text-right text-gray-300">
                  {row.contract_length_months === 0 ? 'No lock-in' : row.contract_length_months}
                </td>
                <td className="py-2 pr-4 text-right text-gray-300">
                  {row.exit_fee === 0 ? '—' : fmtAud(row.exit_fee)}
                </td>
                <td className="py-2 pr-4 text-right text-gray-300">
                  {row.solar_feed_in_tariff === 0 ? '—' : `${fmt(row.solar_feed_in_tariff)}c`}
                </td>
                <td className="py-2 text-right text-gray-300">
                  {row.headline_discount_pct === 0 ? '—' : `${fmt(row.headline_discount_pct, 0)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Churn trend ─────────────────────────────────────────────────────────────

function ChurnSection({ data }: { data: ERCChurnRecord[] }) {
  const [selectedState, setSelectedState] = useState<string>('NSW')
  const states = ['NSW', 'VIC', 'QLD', 'SA', 'TAS']

  const stateData = data
    .filter(d => d.state === selectedState)
    .map(d => ({
      period: `${d.year} ${d.quarter}`,
      ...d,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <SectionHeader
        title="Customer Switching Rate & Churn Analysis"
        subtitle="Quarterly switching rates by destination — complaints/1000 on secondary axis"
      />
      <div className="flex gap-2 mb-5 flex-wrap">
        {states.map(s => (
          <button
            key={s}
            onClick={() => setSelectedState(s)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              selectedState === s
                ? 'bg-amber-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={stateData} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="period"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            interval={3}
            angle={-30}
            textAnchor="end"
            height={48}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            unit="%"
            label={{ value: 'Switch %', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Complaints/1k', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="switching_rate_pct"
            name="Total Switch %"
            stroke={CHURN_COLORS.switching_rate_pct}
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="churn_to_challenger_pct"
            name="To Challenger %"
            stroke={CHURN_COLORS.churn_to_challenger_pct}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="churn_to_big3_pct"
            name="To Big3 %"
            stroke={CHURN_COLORS.churn_to_big3_pct}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="churn_to_green_pct"
            name="To Green %"
            stroke={CHURN_COLORS.churn_to_green_pct}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
          />
          <Bar
            yAxisId="right"
            dataKey="complaints_per_1000"
            name="Complaints/1k"
            fill="#ef4444"
            opacity={0.35}
            barSize={6}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Retail margin chart ──────────────────────────────────────────────────────

function MarginSection({ data }: { data: ERCMarginRecord[] }) {
  const retailers = Array.from(new Set(data.map(d => d.retailer_name)))
  const years = Array.from(new Set(data.map(d => d.year))).sort()
  const [selectedRetailer, setSelectedRetailer] = useState<string>(retailers[0] ?? 'AGL Energy')
  const [selectedYear, setSelectedYear] = useState<number>(2024)

  const filtered = data.filter(
    d => d.retailer_name === selectedRetailer && d.year === selectedYear,
  )

  // aggregate by state (should be 1 row per state given the data structure)
  const chartData = filtered.map(d => ({
    state: d.state,
    wholesale_cost_per_mwh: d.wholesale_cost_per_mwh,
    network_cost_per_mwh: d.network_cost_per_mwh,
    environmental_cost_per_mwh: d.environmental_cost_per_mwh,
    retail_margin_per_mwh: d.retail_margin_per_mwh,
    ebit_margin_pct: d.ebit_margin_pct,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <SectionHeader
        title="Retail Cost Stack & Margin Tracking"
        subtitle="$/MWh cost breakdown with EBIT margin % as line overlay"
      />
      <div className="flex gap-4 mb-5 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {retailers.map(r => (
            <button
              key={r}
              onClick={() => setSelectedRetailer(r)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedRetailer === r
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedYear === y
                  ? 'bg-gray-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            unit=" $/MWh"
            width={70}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            unit="%"
            label={{ value: 'EBIT %', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
            formatter={(v: number, name: string) =>
              name === 'EBIT Margin %' ? [`${v.toFixed(1)}%`, name] : [`$${v.toFixed(1)}/MWh`, name]
            }
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Bar yAxisId="left" dataKey="wholesale_cost_per_mwh" stackId="a" name="Wholesale" fill={COST_COLORS.wholesale_cost_per_mwh} />
          <Bar yAxisId="left" dataKey="network_cost_per_mwh" stackId="a" name="Network" fill={COST_COLORS.network_cost_per_mwh} />
          <Bar yAxisId="left" dataKey="environmental_cost_per_mwh" stackId="a" name="Environmental" fill={COST_COLORS.environmental_cost_per_mwh} />
          <Bar yAxisId="left" dataKey="retail_margin_per_mwh" stackId="a" name="Retail Margin" fill={COST_COLORS.retail_margin_per_mwh} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="ebit_margin_pct"
            name="EBIT Margin %"
            stroke="#f9fafb"
            strokeWidth={2}
            dot={{ fill: '#f9fafb', r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function RetailerCompetitionAnalytics() {
  const [dashboard, setDashboard] = useState<ERCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getRetailerCompetitionDashboard()
      setDashboard(data)
      setLastUpdated(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const summary = dashboard?.summary ?? {}

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Electricity Retailer Competition Analytics</h1>
            <p className="text-gray-400 text-sm">
              NEM retail market share, offers, churn & margin tracking
              {lastUpdated && ` — updated ${lastUpdated.toLocaleTimeString('en-AU')}`}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Zap className="w-5 h-5" />}
          label="States Tracked"
          value={loading ? '—' : String(summary['states_tracked'] ?? 5)}
          sub="NSW · VIC · QLD · SA · TAS"
          accent="text-blue-400"
        />
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          label="Retailers Tracked"
          value={loading ? '—' : String(summary['retailers_tracked'] ?? 8)}
          sub="Big3 + challengers + niche"
          accent="text-green-400"
        />
        <KpiCard
          icon={<Activity className="w-5 h-5" />}
          label="Big3 NSW Share"
          value={
            loading
              ? '—'
              : `${(summary['big3_combined_share_nsw_pct'] as number ?? 72).toFixed(0)}%`
          }
          sub={`HHI NSW: ${loading ? '—' : (summary['hhi_nsw'] as number ?? 0).toLocaleString('en-AU')}`}
          accent="text-amber-400"
        />
        <KpiCard
          icon={<TrendingDown className="w-5 h-5" />}
          label="Avg Churn Rate"
          value={
            loading
              ? '—'
              : `${(summary['avg_churn_rate_pct'] as number ?? 0).toFixed(1)}%`
          }
          sub="Annual switching rate"
          accent="text-red-400"
        />
      </div>

      {/* Market share */}
      {dashboard && <MarketShareSection data={dashboard.market_share} />}

      {/* Offer comparison */}
      {dashboard && <OfferTable data={dashboard.offers} />}

      {/* Churn */}
      {dashboard && <ChurnSection data={dashboard.churn} />}

      {/* Margin */}
      {dashboard && <MarginSection data={dashboard.margins} />}

      {/* Loading skeleton */}
      {loading && !dashboard && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-800 rounded-xl p-6 border border-gray-700 animate-pulse h-48" />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-gray-600 text-xs pt-4 border-t border-gray-800">
        NEM Retailer Competition Analytics — Sprint 73a &bull; Data: AER / ACCC Retail Electricity Price Inquiry &bull;
        Offers based on Energy Made Easy database &bull; Churn data: AER Annual Retail Markets Report
      </div>
    </div>
  )
}
