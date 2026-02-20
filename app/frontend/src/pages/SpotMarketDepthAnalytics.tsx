// ============================================================
// Sprint 55a — NEM Spot Market Depth & Order Flow Analytics
// Real-time bid stacks, dispatch interval depth, order flow
// ============================================================

import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { Layers, BarChart2 } from 'lucide-react'
import {
  getSpotMarketDepthDashboard,
  SpotMarketDepthDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtMw(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(1)} GW`
  return `${val.toFixed(0)} MW`
}

function fmtAud(val: number, decimals = 2): string {
  return `$${val.toFixed(decimals)}`
}

function fmtScore(val: number): string {
  return val.toFixed(1)
}

function withholdingColour(score: number): string {
  if (score >= 7.0) return 'text-red-400'
  if (score >= 4.0) return 'text-amber-400'
  return 'text-emerald-400'
}

function withholdingBadge(score: number): string {
  if (score >= 7.0) return 'bg-red-500/20 text-red-400 border border-red-500/40'
  if (score >= 4.0) return 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
  return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
}

function imbalanceColour(ratio: number): string {
  if (ratio > 1.1) return 'text-red-400'
  if (ratio < 0.9) return 'text-blue-400'
  return 'text-emerald-400'
}

// Technology colour mapping for bid stack chart
const TECH_COLOURS: Record<string, string> = {
  'Hydro':           '#22d3ee',
  'Wind':            '#34d399',
  'Large Solar':     '#fbbf24',
  'Black Coal':      '#6b7280',
  'Brown Coal':      '#92400e',
  'Gas CCGT':        '#f97316',
  'Gas OCGT':        '#fb923c',
  'Demand Response': '#a78bfa',
  'Diesel':          '#ef4444',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent: string
}

function KpiCard({ label, value, sub, icon, accent }: KpiCardProps) {
  return (
    <div className={`bg-gray-800 rounded-xl p-4 border ${accent} flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">{label}</span>
        <span className="text-gray-500">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-gray-400 text-xs">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SpotMarketDepthAnalytics() {
  const [data, setData] = useState<SpotMarketDepthDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string>('NSW1')

  useEffect(() => {
    getSpotMarketDepthDashboard()
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message ?? 'Failed to load data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="flex items-center gap-3">
          <Layers className="w-6 h-6 animate-pulse" />
          <span>Loading Spot Market Depth...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <span>{error ?? 'No data available'}</span>
      </div>
    )
  }

  // ---- KPI calculations ----
  const totalBidDepth = data.depth_snapshots.reduce((s, r) => s + r.bid_depth_mw, 0)
  const avgSpread = data.depth_snapshots.reduce((s, r) => s + r.bid_ask_spread_aud, 0) / data.depth_snapshots.length
  const widestRegion = [...data.depth_snapshots].sort((a, b) => b.bid_ask_spread_aud - a.bid_ask_spread_aud)[0]
  const highestWithholding = [...data.participant_flows].sort((a, b) => b.strategic_withholding_score - a.strategic_withholding_score)[0]

  // ---- Bid stack data filtered by region ----
  const bidStackData = data.bid_stacks
    .filter(r => r.region === selectedRegion)
    .map(r => ({
      priceBand: r.price_band_aud_mwh <= 0
        ? `≤$${r.price_band_aud_mwh}`
        : r.price_band_aud_mwh >= 10000
        ? `$${(r.price_band_aud_mwh / 1000).toFixed(0)}k`
        : `$${r.price_band_aud_mwh}`,
      cumulative: r.cumulative_mw,
      technology: r.technology,
      participants: r.participant_count,
    }))

  // ---- Order flow chart data ----
  const orderFlowData = data.order_flows.map(r => ({
    interval: r.interval.substring(11, 16),
    region: r.region,
    buy: r.buy_volume_mw,
    sell: r.sell_volume_mw,
    net: r.net_flow_mw,
    priceImpact: r.price_impact_aud_mwh,
    label: `${r.interval.substring(11, 16)} (${r.region})`,
  }))

  // ---- Regions for filter ----
  const regions = [...new Set(data.bid_stacks.map(r => r.region))].sort()

  return (
    <div className="space-y-6 p-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Layers className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">NEM Spot Market Depth & Order Flow</h1>
            <p className="text-gray-400 text-sm">Real-time bid stacks, dispatch interval market depth, and participant order flow patterns</p>
          </div>
        </div>
        <div className="text-gray-500 text-xs">
          Updated: {new Date(data.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Bid Depth"
          value={fmtMw(totalBidDepth)}
          sub="All NEM regions combined"
          icon={<BarChart2 className="w-5 h-5" />}
          accent="border-cyan-500/30"
        />
        <KpiCard
          label="Avg Bid-Ask Spread"
          value={fmtAud(avgSpread)}
          sub="AUD/MWh across regions"
          icon={<Layers className="w-5 h-5" />}
          accent="border-violet-500/30"
        />
        <KpiCard
          label="Widest Spread Region"
          value={widestRegion.region}
          sub={`Spread: ${fmtAud(widestRegion.bid_ask_spread_aud)}/MWh`}
          icon={<BarChart2 className="w-5 h-5" />}
          accent="border-amber-500/30"
        />
        <KpiCard
          label="Highest Withholding"
          value={highestWithholding.participant.split(' ')[0]}
          sub={`Score: ${fmtScore(highestWithholding.strategic_withholding_score)}/10 — ${highestWithholding.region}`}
          icon={<Layers className="w-5 h-5" />}
          accent="border-red-500/30"
        />
      </div>

      {/* Bid Stack Chart */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Bid Stack — Cumulative Supply Curve</h2>
            <p className="text-gray-400 text-xs mt-0.5">Cumulative MW vs price band (stepped), coloured by technology</p>
          </div>
          <div className="flex items-center gap-2">
            {regions.map(r => (
              <button
                key={r}
                onClick={() => setSelectedRegion(r)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  selectedRegion === r
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                    : 'bg-gray-700 text-gray-400 border border-gray-600 hover:border-gray-500'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={bidStackData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="priceBand"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
            />
            <YAxis
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={v => `${(v / 1000).toFixed(1)}GW`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
              itemStyle={{ color: '#9ca3af' }}
              formatter={(value: number, name: string) => [`${value.toFixed(0)} MW`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            <Area
              type="stepAfter"
              dataKey="cumulative"
              name="Cumulative MW"
              stroke="#22d3ee"
              fill="#22d3ee"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={(props: any) => {
                const tech = bidStackData[props.index]?.technology ?? ''
                const colour = TECH_COLOURS[tech] ?? '#6b7280'
                return <circle key={props.index} cx={props.cx} cy={props.cy} r={5} fill={colour} stroke="#1f2937" strokeWidth={1.5} />
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
        {/* Technology legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(TECH_COLOURS).map(([tech, colour]) => (
            <div key={tech} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colour }} />
              <span className="text-gray-400 text-xs">{tech}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Order Flow Chart */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="mb-4">
          <h2 className="text-white font-semibold text-lg">Order Flow Net Balance</h2>
          <p className="text-gray-400 text-xs mt-0.5">Buy vs sell volume by dispatch interval with net flow line</p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={orderFlowData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="label"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              interval={2}
              angle={-25}
              textAnchor="end"
              height={45}
            />
            <YAxis
              yAxisId="left"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={v => `${(v / 1000).toFixed(1)}GW`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={v => `${v.toFixed(0)}`}
              label={{ value: 'Net MW', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
              itemStyle={{ color: '#9ca3af' }}
              formatter={(value: number, name: string) => [
                name === 'Net Flow MW' ? `${value.toFixed(0)} MW` : `${(value / 1000).toFixed(2)} GW`,
                name,
              ]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            <ReferenceLine yAxisId="right" y={0} stroke="#6b7280" strokeDasharray="4 2" />
            <Bar yAxisId="left" dataKey="buy" name="Buy Volume" fill="#22d3ee" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
            <Bar yAxisId="left" dataKey="sell" name="Sell Volume" fill="#f97316" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="net"
              name="Net Flow MW"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={{ r: 3, fill: '#a78bfa' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Market Depth Snapshots Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="mb-4">
          <h2 className="text-white font-semibold text-lg">Market Depth Snapshots — All NEM Regions</h2>
          <p className="text-gray-400 text-xs mt-0.5">Current bid/ask depth, spread, best prices, and order book imbalance</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 font-medium py-2 pr-4">Region</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Bid Depth</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Offer Depth</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Best Bid</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Best Ask</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Spread</th>
                <th className="text-right text-gray-400 font-medium py-2 pl-3">Imbalance Ratio</th>
              </tr>
            </thead>
            <tbody>
              {data.depth_snapshots.map((snap, i) => (
                <tr
                  key={snap.region}
                  className={`border-b border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}`}
                >
                  <td className="py-3 pr-4">
                    <span className="inline-block px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-xs font-semibold border border-cyan-500/30">
                      {snap.region}
                    </span>
                  </td>
                  <td className="text-right text-white py-3 px-3 font-mono text-xs">
                    {fmtMw(snap.bid_depth_mw)}
                  </td>
                  <td className="text-right text-white py-3 px-3 font-mono text-xs">
                    {fmtMw(snap.offer_depth_mw)}
                  </td>
                  <td className="text-right text-emerald-400 py-3 px-3 font-mono text-xs">
                    {fmtAud(snap.best_bid_aud)}
                  </td>
                  <td className="text-right text-red-400 py-3 px-3 font-mono text-xs">
                    {fmtAud(snap.best_ask_aud)}
                  </td>
                  <td className="text-right text-amber-400 py-3 px-3 font-mono text-xs font-semibold">
                    {fmtAud(snap.bid_ask_spread_aud)}
                  </td>
                  <td className={`text-right py-3 pl-3 font-mono text-xs font-semibold ${imbalanceColour(snap.imbalance_ratio)}`}>
                    {snap.imbalance_ratio.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Participant Strategic Analysis Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="mb-4">
          <h2 className="text-white font-semibold text-lg">Participant Strategic Analysis</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            Market share, rebid frequency, and strategic withholding score (0-10).
            Score colour: <span className="text-emerald-400">low (0-4)</span>{' '}
            <span className="text-amber-400">medium (4-7)</span>{' '}
            <span className="text-red-400">high (7-10)</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 font-medium py-2 pr-4">Participant</th>
                <th className="text-left text-gray-400 font-medium py-2 px-3">Region</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Avg Bid MW</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Avg Offer MW</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Market Share</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Rebids/Day</th>
                <th className="text-right text-gray-400 font-medium py-2 pl-3">Withholding Score</th>
              </tr>
            </thead>
            <tbody>
              {[...data.participant_flows]
                .sort((a, b) => b.strategic_withholding_score - a.strategic_withholding_score)
                .map((p, i) => (
                  <tr
                    key={`${p.participant}-${p.region}`}
                    className={`border-b border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}`}
                  >
                    <td className="py-3 pr-4 text-white font-medium">{p.participant}</td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded bg-violet-500/20 text-violet-400 text-xs font-semibold border border-violet-500/30">
                        {p.region}
                      </span>
                    </td>
                    <td className="text-right text-gray-300 py-3 px-3 font-mono text-xs">
                      {p.avg_bid_mw.toFixed(0)} MW
                    </td>
                    <td className="text-right text-gray-300 py-3 px-3 font-mono text-xs">
                      {p.avg_offer_mw.toFixed(0)} MW
                    </td>
                    <td className="text-right text-cyan-400 py-3 px-3 font-mono text-xs font-semibold">
                      {p.market_share_pct.toFixed(1)}%
                    </td>
                    <td className="text-right text-gray-300 py-3 px-3 font-mono text-xs">
                      {p.rebid_frequency_day.toFixed(1)}
                    </td>
                    <td className="text-right py-3 pl-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${withholdingBadge(p.strategic_withholding_score)}`}>
                        {fmtScore(p.strategic_withholding_score)} / 10
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
