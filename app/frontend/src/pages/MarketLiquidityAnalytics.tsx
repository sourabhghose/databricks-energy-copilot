import { useEffect, useState } from 'react'
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
  ComposedChart,
} from 'recharts'
import { BarChart3, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  getWholesaleLiquidityDashboard,
  WMLDashboard,
  WMLLiquidityRecord,
  WMLOpenInterestRecord,
  WMLBidAskRecord,
} from '../api/client'

// ── Colour helpers ────────────────────────────────────────────────────────────

const DEPTH_BADGE: Record<string, string> = {
  DEEP: 'bg-green-700 text-green-100',
  MODERATE: 'bg-blue-700 text-blue-100',
  THIN: 'bg-yellow-600 text-yellow-100',
  ILLIQUID: 'bg-red-700 text-red-100',
}

const PARTICIPANT_BADGE: Record<string, string> = {
  GENTAILER: 'bg-purple-700 text-purple-100',
  RETAILER: 'bg-sky-700 text-sky-100',
  GENERATOR: 'bg-teal-700 text-teal-100',
}

const EVENT_COLOR: Record<string, string> = {
  NORMAL: '#22c55e',
  WIDE: '#eab308',
  CRISIS: '#ef4444',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#f59e0b',
  VIC1: '#a78bfa',
  SA1: '#f87171',
}

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1']

// ── Custom dot for bid-ask chart coloured by liquidity event ─────────────────

interface DotProps {
  cx?: number
  cy?: number
  payload?: WMLBidAskRecord
}

const EventDot = (props: DotProps) => {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || !payload) return null
  const color = EVENT_COLOR[payload.liquidity_event] ?? '#94a3b8'
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#1e293b" strokeWidth={1} />
}

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: string
}

function KpiCard({ label, value, sub, accent = 'text-blue-400' }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      {sub && <span className="text-gray-500 text-xs">{sub}</span>}
    </div>
  )
}

// ── Market Depth table ────────────────────────────────────────────────────────

function MarketDepthTable({ records }: { records: WMLLiquidityRecord[] }) {
  const [activeRegion, setActiveRegion] = useState('NSW1')
  const filtered = records.filter((r) => r.region === activeRegion)

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold text-lg mb-3">Market Depth by Tenor</h2>
      {/* Region tabs */}
      <div className="flex gap-2 mb-4">
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRegion(r)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeRegion === r
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-300">
          <thead>
            <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
              <th className="text-left py-2 pr-3">Type</th>
              <th className="text-left py-2 pr-3">Tenor</th>
              <th className="text-right py-2 pr-3">Bid ($/MWh)</th>
              <th className="text-right py-2 pr-3">Ask ($/MWh)</th>
              <th className="text-right py-2 pr-3">Spread ($)</th>
              <th className="text-right py-2 pr-3">Mid Price</th>
              <th className="text-right py-2 pr-3">Open Interest (MWh)</th>
              <th className="text-right py-2 pr-3">Daily Vol (MWh)</th>
              <th className="text-right py-2 pr-3">Liq Score</th>
              <th className="text-left py-2">Depth</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rec, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3">
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-200">
                    {rec.contract_type}
                  </span>
                </td>
                <td className="py-2 pr-3 font-mono">{rec.tenor}</td>
                <td className="text-right py-2 pr-3 text-green-400">${rec.bid_price.toFixed(2)}</td>
                <td className="text-right py-2 pr-3 text-red-400">${rec.ask_price.toFixed(2)}</td>
                <td className="text-right py-2 pr-3 text-yellow-400">${rec.bid_ask_spread.toFixed(2)}</td>
                <td className="text-right py-2 pr-3">${rec.mid_price.toFixed(2)}</td>
                <td className="text-right py-2 pr-3">{rec.open_interest_mwh.toLocaleString()}</td>
                <td className="text-right py-2 pr-3">{rec.daily_volume_mwh.toLocaleString()}</td>
                <td className="text-right py-2 pr-3">
                  <span
                    className={`font-semibold ${
                      rec.liquidity_score >= 7
                        ? 'text-green-400'
                        : rec.liquidity_score >= 5
                        ? 'text-blue-400'
                        : rec.liquidity_score >= 3
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  >
                    {rec.liquidity_score}/10
                  </span>
                </td>
                <td className="py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      DEPTH_BADGE[rec.market_depth_rating] ?? 'bg-gray-700 text-gray-200'
                    }`}
                  >
                    {rec.market_depth_rating}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Hedge Coverage chart ──────────────────────────────────────────────────────

function HedgeCoverageChart({ data }: { data: WMLDashboard['hedge_coverage'] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold text-lg mb-1">Retailer Hedging Coverage Ratios</h2>
      <p className="text-gray-400 text-xs mb-4">
        Stacked breakdown of hedge components (%) with hedge cost overlay ($/MWh)
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 10, right: 60, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="participant_name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            domain={[0, 100]}
            label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            domain={[0, 120]}
            label={{
              value: '$/MWh',
              angle: 90,
              position: 'insideRight',
              fill: '#9ca3af',
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
          <Bar yAxisId="left" dataKey="base_swap_pct" name="Base Swap" stackId="a" fill="#3b82f6" />
          <Bar yAxisId="left" dataKey="cap_pct" name="Cap" stackId="a" fill="#6366f1" />
          <Bar yAxisId="left" dataKey="ppa_pct" name="PPA" stackId="a" fill="#22c55e" />
          <Bar yAxisId="left" dataKey="spot_exposure_pct" name="Spot Exposure" stackId="a" fill="#ef4444" />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="hedge_cost_per_mwh"
            name="Hedge Cost ($/MWh)"
            stroke="#fbbf24"
            strokeWidth={2}
            dot={{ fill: '#fbbf24', r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Open Interest trend ───────────────────────────────────────────────────────

function OpenInterestChart({ data }: { data: WMLOpenInterestRecord[] }) {
  const [activeRegion, setActiveRegion] = useState('NSW1')
  const filtered = data.filter((r) => r.region === activeRegion)

  // Build series: { date, BASE, CAP }
  const dateMap: Record<string, { date: string; BASE?: number; CAP?: number }> = {}
  filtered.forEach((r) => {
    if (!dateMap[r.date]) dateMap[r.date] = { date: r.date }
    dateMap[r.date][r.contract_type as 'BASE' | 'CAP'] = r.open_interest_mwh
  })
  const chartData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold text-lg mb-3">Open Interest Trends (MWh)</h2>
      <div className="flex gap-2 mb-4">
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRegion(r)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeRegion === r
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => [v.toLocaleString() + ' MWh']}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="BASE"
            name="BASE Contract"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ r: 4, fill: '#60a5fa' }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="CAP"
            name="CAP Contract"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 4, fill: '#f59e0b' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Bid-Ask Spread history ────────────────────────────────────────────────────

function BidAskSpreadChart({ data }: { data: WMLBidAskRecord[] }) {
  const [activeRegion, setActiveRegion] = useState('NSW1')
  const filtered = data
    .filter((r) => r.region === activeRegion)
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold text-lg mb-1">Bid-Ask Spread History (CAL25)</h2>
      <p className="text-gray-400 text-xs mb-3">
        Dot color: <span className="text-green-400">NORMAL</span> /{' '}
        <span className="text-yellow-400">WIDE</span> /{' '}
        <span className="text-red-400">CRISIS</span>
      </p>
      <div className="flex gap-2 mb-4">
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRegion(r)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeRegion === r
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={filtered} margin={{ top: 10, right: 60, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{
              value: 'Spread ($)',
              angle: -90,
              position: 'insideLeft',
              fill: '#9ca3af',
              fontSize: 11,
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{
              value: 'Mid ($/MWh)',
              angle: 90,
              position: 'insideRight',
              fill: '#9ca3af',
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="bid_ask_spread"
            name="Bid-Ask Spread ($)"
            stroke={REGION_COLORS[activeRegion] ?? '#60a5fa'}
            strokeWidth={2}
            dot={<EventDot />}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="mid_price"
            name="Mid Price ($/MWh)"
            stroke="#a78bfa"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Hedge Coverage participant table ──────────────────────────────────────────

function HedgeCoverageTable({ data }: { data: WMLDashboard['hedge_coverage'] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold text-lg mb-3">Participant Hedge Summary</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-300">
          <thead>
            <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
              <th className="text-left py-2 pr-3">Participant</th>
              <th className="text-left py-2 pr-3">Type</th>
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-right py-2 pr-3">Load (TWh)</th>
              <th className="text-right py-2 pr-3">Hedged (TWh)</th>
              <th className="text-right py-2 pr-3">Coverage %</th>
              <th className="text-right py-2 pr-3">Spot Exposure %</th>
              <th className="text-right py-2">Hedge Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 font-medium text-white">{p.participant_name}</td>
                <td className="py-2 pr-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      PARTICIPANT_BADGE[p.participant_type] ?? 'bg-gray-700 text-gray-200'
                    }`}
                  >
                    {p.participant_type}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-mono"
                    style={{ color: REGION_COLORS[p.region] }}
                  >
                    {p.region}
                  </span>
                </td>
                <td className="text-right py-2 pr-3">{p.load_exposure_twh.toFixed(1)}</td>
                <td className="text-right py-2 pr-3">{p.hedge_coverage_twh.toFixed(1)}</td>
                <td className="text-right py-2 pr-3">
                  <span
                    className={`font-semibold ${
                      p.hedge_coverage_pct >= 80
                        ? 'text-green-400'
                        : p.hedge_coverage_pct >= 65
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  >
                    {p.hedge_coverage_pct}%
                  </span>
                </td>
                <td className="text-right py-2 pr-3">
                  <span
                    className={p.spot_exposure_pct > 30 ? 'text-red-400' : 'text-gray-300'}
                  >
                    {p.spot_exposure_pct}%
                  </span>
                </td>
                <td className="text-right py-2 text-yellow-400">
                  ${p.hedge_cost_per_mwh}/MWh
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MarketLiquidityAnalytics() {
  const [data, setData] = useState<WMLDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getWholesaleLiquidityDashboard()
      .then(setData)
      .catch((e) => setError(e?.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-blue-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-white">Wholesale Market Liquidity Analytics</h1>
            <p className="text-gray-400 text-sm">
              NEM ASX electricity futures — bid-ask spreads, open interest, market depth & hedging
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Loading / Error states */}
      {loading && (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw size={24} className="animate-spin mr-3" />
          Loading wholesale liquidity data...
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-900/40 border border-red-700 rounded-lg p-4 mb-6">
          <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
          <span className="text-red-300">{error}</span>
        </div>
      )}

      {data && !loading && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Total Contracts"
              value={String(data.summary['total_contracts'] ?? '—')}
              sub="across all regions & tenors"
              accent="text-blue-400"
            />
            <KpiCard
              label="Illiquid Contracts"
              value={String(data.summary['illiquid_contracts'] ?? '—')}
              sub="market depth = ILLIQUID"
              accent="text-red-400"
            />
            <KpiCard
              label="Avg Hedge Coverage"
              value={`${data.summary['avg_hedge_coverage_pct'] ?? '—'}%`}
              sub="across all participants"
              accent="text-green-400"
            />
            <KpiCard
              label="Highest Spread Region"
              value={String(data.summary['highest_spread_region'] ?? '—')}
              sub="widest bid-ask spreads"
              accent="text-yellow-400"
            />
          </div>

          {/* Market Depth table */}
          <div className="mb-6">
            <MarketDepthTable records={data.liquidity_records} />
          </div>

          {/* Hedge Coverage stacked bar */}
          <div className="mb-6">
            <HedgeCoverageChart data={data.hedge_coverage} />
          </div>

          {/* Participant summary table */}
          <div className="mb-6">
            <HedgeCoverageTable data={data.hedge_coverage} />
          </div>

          {/* Open Interest trend + Bid-Ask history side by side on wide screens */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <OpenInterestChart data={data.open_interest} />
            <BidAskSpreadChart data={data.bid_ask_history} />
          </div>
        </>
      )}
    </div>
  )
}
