import React, { useEffect, useState } from 'react'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  AreaChart,
  Area,
} from 'recharts'
import { BarChart, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  api,
  MarketLiquidityDashboard,
  TradingVolumeRecord,
  BidAskSpreadRecord,
  MarketDepthRecord,
  LiquidityMetricRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const PRODUCT_COLORS: Record<string, string> = {
  BASE_LOAD: 'bg-blue-600 text-blue-100',
  PEAK:      'bg-amber-500 text-amber-100',
  CAP:       'bg-red-600 text-red-100',
  FLOOR:     'bg-green-600 text-green-100',
  SWAP:      'bg-gray-500 text-gray-100',
}

const VENUE_COLORS: Record<string, string> = {
  ASX:        'bg-blue-600 text-blue-100',
  OTC_BROKER: 'bg-green-600 text-green-100',
  BILATERAL:  'bg-gray-500 text-gray-100',
  EXCHANGE:   'bg-teal-600 text-teal-100',
}

const VENUE_CHART_COLORS: Record<string, string> = {
  ASX:        '#3b82f6',
  OTC_BROKER: '#22c55e',
  BILATERAL:  '#6b7280',
  EXCHANGE:   '#14b8a6',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function Badge({
  label,
  colorClass,
}: {
  label: string
  colorClass: string
}) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Trading Volume Chart
// Build one row per date with volumes summed by venue
// ---------------------------------------------------------------------------

function TradingVolumeChart({ records }: { records: TradingVolumeRecord[] }) {
  // Aggregate by date × venue
  const dateMap: Record<string, Record<string, number>> = {}
  const vwapMap: Record<string, { sum: number; count: number }> = {}

  records.forEach((r) => {
    if (!dateMap[r.date]) dateMap[r.date] = {}
    dateMap[r.date][r.venue] = (dateMap[r.date][r.venue] ?? 0) + r.volume_gwh
    if (!vwapMap[r.date]) vwapMap[r.date] = { sum: 0, count: 0 }
    vwapMap[r.date].sum += r.vwap_aud_mwh
    vwapMap[r.date].count += 1
  })

  const data = Object.entries(dateMap).map(([date, venues]) => ({
    date: date.slice(5), // MM-DD
    ASX: Number((venues.ASX ?? 0).toFixed(2)),
    OTC_BROKER: Number((venues.OTC_BROKER ?? 0).toFixed(2)),
    BILATERAL: Number((venues.BILATERAL ?? 0).toFixed(2)),
    EXCHANGE: Number((venues.EXCHANGE ?? 0).toFixed(2)),
    vwap: Number((vwapMap[date].sum / vwapMap[date].count).toFixed(2)),
  }))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Trading Volume by Venue (GWh) &amp; VWAP ($/MWh)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="vol"
            stroke="#9ca3af"
            tick={{ fontSize: 11 }}
            label={{ value: 'GWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            stroke="#f59e0b"
            tick={{ fontSize: 11 }}
            label={{ value: '$/MWh', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {Object.entries(VENUE_CHART_COLORS).map(([venue, color]) => (
            <Bar key={venue} yAxisId="vol" dataKey={venue} stackId="a" fill={color} name={venue} />
          ))}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="vwap"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3, fill: '#f59e0b' }}
            name="VWAP $/MWh"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Market Share Evolution Chart
// ---------------------------------------------------------------------------

function MarketShareChart({ metrics }: { metrics: LiquidityMetricRecord[] }) {
  // Aggregate by quarter (average across regions)
  const quarterMap: Record<string, { ex: number[]; otc: number[]; bil: number[] }> = {}
  metrics.forEach((m) => {
    if (!quarterMap[m.quarter]) quarterMap[m.quarter] = { ex: [], otc: [], bil: [] }
    quarterMap[m.quarter].ex.push(m.exchange_share_pct)
    quarterMap[m.quarter].otc.push(m.otc_share_pct)
    quarterMap[m.quarter].bil.push(m.bilateral_share_pct)
  })

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

  const data = Object.entries(quarterMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarter, v]) => ({
      quarter,
      Exchange: Number(avg(v.ex).toFixed(1)),
      OTC: Number(avg(v.otc).toFixed(1)),
      Bilateral: Number(avg(v.bil).toFixed(1)),
    }))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Market Share Evolution by Quarter (%)
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="exchGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="otcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="bilGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6b7280" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#6b7280" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="Exchange"
            stackId="1"
            stroke="#3b82f6"
            fill="url(#exchGrad)"
          />
          <Area
            type="monotone"
            dataKey="OTC"
            stackId="1"
            stroke="#22c55e"
            fill="url(#otcGrad)"
          />
          <Area
            type="monotone"
            dataKey="Bilateral"
            stackId="1"
            stroke="#6b7280"
            fill="url(#bilGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Market Depth Chart (order book ladder)
// ---------------------------------------------------------------------------

function MarketDepthChart({ records }: { records: MarketDepthRecord[] }) {
  const [selectedRegion, setSelectedRegion] = useState<string>('NSW1')
  const regions = Array.from(new Set(records.map((r) => r.region)))

  const filtered = records.filter((r) => r.region === selectedRegion)

  // For the order book visualization, show bid as negative (left) and ask as positive (right)
  const data = filtered.map((r) => ({
    price: `$${r.price_level}`,
    bid: -r.bid_volume_mw,
    ask: r.ask_volume_mw,
  }))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200">
          Market Depth Order Book
        </h3>
        <div className="flex gap-2">
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                selectedRegion === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <RechartsBarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis
            type="number"
            stroke="#9ca3af"
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `${Math.abs(v)} MW`}
          />
          <YAxis type="category" dataKey="price" stroke="#9ca3af" tick={{ fontSize: 11 }} width={50} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(val: number) => [`${Math.abs(val).toFixed(1)} MW`, val < 0 ? 'Bid' : 'Ask']}
          />
          <Bar dataKey="bid" fill="#3b82f6" name="Bid Volume" />
          <Bar dataKey="ask" fill="#ef4444" name="Ask Volume" />
        </RechartsBarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Bid (blue, left) vs Ask (red, right) at each price level — {selectedRegion} BASE_LOAD
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bid-Ask Spreads Table
// ---------------------------------------------------------------------------

function BidAskTable({ spreads }: { spreads: BidAskSpreadRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Bid-Ask Spreads by Region &amp; Product
      </h3>
      <table className="w-full text-xs text-gray-300 border-collapse">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 pr-3 text-gray-400 font-medium">Region</th>
            <th className="text-left py-2 pr-3 text-gray-400 font-medium">Product</th>
            <th className="text-left py-2 pr-3 text-gray-400 font-medium">Contract Qtr</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">Bid ($/MWh)</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">Ask ($/MWh)</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">Mid ($/MWh)</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">Spread $/MWh</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">Spread %</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">Depth (MW)</th>
            <th className="text-right py-2 text-gray-400 font-medium">Mkr Makers</th>
          </tr>
        </thead>
        <tbody>
          {spreads.map((s, idx) => (
            <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
              <td className="py-2 pr-3 font-medium text-white">{s.region}</td>
              <td className="py-2 pr-3">
                <Badge
                  label={s.product}
                  colorClass={PRODUCT_COLORS[s.product] ?? 'bg-gray-600 text-gray-100'}
                />
              </td>
              <td className="py-2 pr-3 text-gray-400">{s.contract_quarter}</td>
              <td className="py-2 pr-3 text-right text-green-400">${s.bid_price.toFixed(2)}</td>
              <td className="py-2 pr-3 text-right text-red-400">${s.ask_price.toFixed(2)}</td>
              <td className="py-2 pr-3 text-right text-gray-200">${s.mid_price.toFixed(2)}</td>
              <td className="py-2 pr-3 text-right text-amber-400">${s.spread_aud_mwh.toFixed(2)}</td>
              <td className="py-2 pr-3 text-right text-amber-300">{s.spread_pct.toFixed(2)}%</td>
              <td className="py-2 pr-3 text-right">{s.market_depth_mw.toFixed(0)}</td>
              <td className="py-2 text-right text-gray-400">{s.num_market_makers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Liquidity Metrics Table
// ---------------------------------------------------------------------------

function LiquidityMetricsTable({ metrics }: { metrics: LiquidityMetricRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Quarterly Liquidity Metrics by Region
      </h3>
      <table className="w-full text-xs text-gray-300 border-collapse">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 pr-3 text-gray-400 font-medium">Quarter</th>
            <th className="text-left py-2 pr-3 text-gray-400 font-medium">Region</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">Volume (TWh)</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">Exchange %</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">OTC %</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">Bilateral %</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">Turnover</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">Avg Spread</th>
            <th className="text-right py-2 pr-3 text-gray-400 font-medium">Mkt Makers</th>
            <th className="text-right py-2 text-gray-400 font-medium">HHI</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, idx) => (
            <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
              <td className="py-2 pr-3 text-gray-400">{m.quarter}</td>
              <td className="py-2 pr-3 font-medium text-white">{m.region}</td>
              <td className="py-2 pr-3 text-right text-blue-300">{m.total_volume_twh.toFixed(2)}</td>
              <td className="py-2 pr-3 text-right text-blue-400">{m.exchange_share_pct.toFixed(1)}%</td>
              <td className="py-2 pr-3 text-right text-green-400">{m.otc_share_pct.toFixed(1)}%</td>
              <td className="py-2 pr-3 text-right text-gray-400">{m.bilateral_share_pct.toFixed(1)}%</td>
              <td className="py-2 pr-3 text-right text-amber-400">{m.turnover_ratio.toFixed(2)}x</td>
              <td className="py-2 pr-3 text-right text-amber-300">${m.avg_spread_aud_mwh.toFixed(2)}</td>
              <td className="py-2 pr-3 text-right">{m.market_maker_count}</td>
              <td className="py-2 text-right text-gray-400">{m.herfindahl_index.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MarketLiquidity() {
  const [dashboard, setDashboard] = useState<MarketLiquidityDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getMarketLiquidityDashboard()
      setDashboard(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load market liquidity data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="p-6 space-y-6 min-h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg">
            <BarChart className="text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              Electricity Market Liquidity &amp; Trading Volume
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              NEM and ASX electricity market depth, bid-ask spreads, trading volumes, and OTC vs
              exchange market share analytics
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-sm text-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !dashboard && (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 h-24 animate-pulse" />
          ))}
        </div>
      )}

      {dashboard && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Total Daily Volume"
              value={`${dashboard.total_daily_volume_gwh.toFixed(1)} GWh`}
              sub="Across all venues & regions"
            />
            <KpiCard
              label="Avg Bid-Ask Spread"
              value={`$${dashboard.avg_spread_aud_mwh.toFixed(2)}/MWh`}
              sub="Volume-weighted average"
            />
            <KpiCard
              label="Exchange Share"
              value={`${dashboard.exchange_share_pct.toFixed(1)}%`}
              sub="ASX & exchange-traded volume"
            />
            <KpiCard
              label="Turnover Ratio"
              value={`${dashboard.turnover_ratio.toFixed(2)}x`}
              sub="Traded / physical generation"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TradingVolumeChart records={dashboard.trading_volumes} />
            <MarketShareChart metrics={dashboard.liquidity_metrics} />
          </div>

          {/* Market Depth Chart */}
          <MarketDepthChart records={dashboard.market_depth} />

          {/* Bid-Ask Spreads Table */}
          <BidAskTable spreads={dashboard.bid_ask_spreads} />

          {/* Liquidity Metrics Table */}
          <LiquidityMetricsTable metrics={dashboard.liquidity_metrics} />

          {/* Venue Legend */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Venues:</span>
            {Object.entries(VENUE_COLORS).map(([venue, cls]) => (
              <Badge key={venue} label={venue} colorClass={cls} />
            ))}
            <span className="text-xs text-gray-500 uppercase tracking-wider ml-4">Products:</span>
            {Object.entries(PRODUCT_COLORS).map(([product, cls]) => (
              <Badge key={product} label={product} colorClass={cls} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
