import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getNEMMarketMicrostructureDashboard,
  NMMDashboard,
  NMMRebidRecord,
  NMMBidOfferRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const REGIONS = ['NSW', 'VIC', 'SA', 'QLD', 'TAS']
const REGION_COLORS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#34d399',
  SA:  '#f59e0b',
  QLD: '#f87171',
  TAS: '#a78bfa',
}
const BAND_COLORS = ['#6366f1', '#22d3ee', '#10b981', '#f59e0b', '#ef4444']

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Price Formation Distribution — grouped bar by region
// ---------------------------------------------------------------------------
function PriceFormationChart({ data }: { data: NMMDashboard['price_formation'] }) {
  const byRegion = REGIONS.map(region => {
    const rows = data.filter(r => r.region === region)
    if (!rows.length) return null
    const avg = (key: keyof typeof rows[0]) =>
      Math.round((rows.reduce((s, r) => s + (r[key] as number), 0) / rows.length) * 10) / 10
    return {
      region,
      'At VoLL':       avg('pct_intervals_at_voll'),
      'Above $300':    avg('pct_intervals_above_300'),
      'Zero/Negative': avg('pct_intervals_zero_or_negative'),
      'Normal $10-100':avg('pct_intervals_normal_10_to_100'),
    }
  }).filter(Boolean)

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-1">Price Formation Distribution by Region</h3>
      <p className="text-xs text-gray-400 mb-4">% of dispatch intervals in each price band (annual average)</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={byRegion} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis unit="%" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="At VoLL"        fill="#ef4444" radius={[2,2,0,0]} />
          <Bar dataKey="Above $300"     fill="#f59e0b" radius={[2,2,0,0]} />
          <Bar dataKey="Zero/Negative"  fill="#22d3ee" radius={[2,2,0,0]} />
          <Bar dataKey="Normal $10-100" fill="#10b981" radius={[2,2,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dispatch Interval Analysis — trading vs dispatch price for NSW
// ---------------------------------------------------------------------------
function DispatchIntervalChart({ data }: { data: NMMDashboard['dispatch_intervals'] }) {
  const nswData = data
    .filter(r => r.region === 'NSW')
    .sort((a, b) => a.interval_number - b.interval_number)
    .map(r => ({
      interval: r.interval_number,
      'Trading Price':      r.trading_price,
      'Dispatch Price':     r.dispatch_price,
      'Pre-Dispatch Price': r.pre_dispatch_price,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-1">Dispatch Interval Analysis — NSW</h3>
      <p className="text-xs text-gray-400 mb-4">Trading vs dispatch vs pre-dispatch prices across intervals</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={nswData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="interval" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Interval #', position: 'insideBottomRight', fill: '#6b7280', fontSize: 11 }} />
          <YAxis unit=" $/MWh" tick={{ fill: '#9ca3af', fontSize: 11 }} width={80} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => [`$${v.toFixed(2)}/MWh`]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Line type="monotone" dataKey="Trading Price"      stroke="#60a5fa" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="Dispatch Price"     stroke="#34d399" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="Pre-Dispatch Price" stroke="#f59e0b" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Market Depth Curve — AreaChart supply at different price points
// ---------------------------------------------------------------------------
function MarketDepthChart({ data }: { data: NMMDashboard['market_depth'] }) {
  const regionData = REGIONS.map(region => {
    const rows = data.filter(r => r.region === region)
    if (!rows.length) return null
    const avg = (key: keyof typeof rows[0]) =>
      Math.round((rows.reduce((s, r) => s + (r[key] as number), 0) / rows.length))
    return {
      region,
      'Supply @ $0':    avg('cumulative_supply_mw_at_0'),
      'Supply @ $50':   avg('cumulative_supply_mw_at_50'),
      'Supply @ $100':  avg('cumulative_supply_mw_at_100'),
      'Supply @ $300':  avg('cumulative_supply_mw_at_300'),
      'Supply @ VoLL':  avg('cumulative_supply_mw_at_voll'),
      'Avg Demand':     avg('demand_mw'),
    }
  }).filter(Boolean)

  const pricePoints = ['$0', '$50', '$100', '$300', 'VoLL']
  const saData = regionData.find(r => r && r.region === 'SA')
  const curveData = saData ? [
    { price: '$0',    supply: saData['Supply @ $0'],   demand: saData['Avg Demand'] },
    { price: '$50',   supply: saData['Supply @ $50'],  demand: saData['Avg Demand'] },
    { price: '$100',  supply: saData['Supply @ $100'], demand: saData['Avg Demand'] },
    { price: '$300',  supply: saData['Supply @ $300'], demand: saData['Avg Demand'] },
    { price: 'VoLL',  supply: saData['Supply @ VoLL'], demand: saData['Avg Demand'] },
  ] : []

  void pricePoints

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-1">Market Depth Curve — SA (Peak Day)</h3>
      <p className="text-xs text-gray-400 mb-4">Cumulative supply available at each price threshold vs average demand</p>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={curveData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="supplyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="price" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis unit=" MW" tick={{ fill: '#9ca3af', fontSize: 11 }} width={72} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => [`${v.toLocaleString()} MW`]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Area type="monotone" dataKey="supply" name="Cumulative Supply" stroke="#60a5fa" fill="url(#supplyGrad)" strokeWidth={2} />
          <Area type="monotone" dataKey="demand" name="Average Demand"    stroke="#ef4444" fill="url(#demandGrad)"  strokeWidth={2} strokeDasharray="5 3" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rebid Activity — bar chart + ranked table
// ---------------------------------------------------------------------------
function RebidActivitySection({ data }: { data: NMMRebidRecord[] }) {
  const sorted = [...data].sort((a, b) => b.rebid_count - a.rebid_count).slice(0, 10)
  const chartData = sorted.map(r => ({
    duid: r.duid.replace('_', ' '),
    rebids: r.rebid_count,
    impact: Math.round(r.price_impact_estimate * 10) / 10,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-1">Strategic Rebid Activity</h3>
      <p className="text-xs text-gray-400 mb-4">Top 10 generators by rebid count — 2024 Q3</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, left: 60, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis type="category" dataKey="duid" tick={{ fill: '#9ca3af', fontSize: 10 }} width={60} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Bar dataKey="rebids" name="Rebid Count" fill="#6366f1" radius={[0,3,3,0]} />
          </BarChart>
        </ResponsiveContainer>
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                <th className="text-left pb-2 pr-3">DUID</th>
                <th className="text-left pb-2 pr-3">Company</th>
                <th className="text-right pb-2 pr-3">Rebids</th>
                <th className="text-right pb-2 pr-3">Hrs Before</th>
                <th className="text-right pb-2">Impact $</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.duid} className={i % 2 === 0 ? 'bg-gray-750' : ''}>
                  <td className="py-1.5 pr-3 text-blue-400 font-mono text-xs">{r.duid}</td>
                  <td className="py-1.5 pr-3 text-gray-300 text-xs">{r.company}</td>
                  <td className="py-1.5 pr-3 text-right text-white font-semibold">{r.rebid_count}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-400 text-xs">{r.rebid_timing_hours_before.toFixed(1)}h</td>
                  <td className="py-1.5 text-right text-amber-400 text-xs">${r.price_impact_estimate.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bid-Offer Stack Table
// ---------------------------------------------------------------------------
function BidOfferStackTable({ data }: { data: NMMBidOfferRecord[] }) {
  const sample = data.slice(0, 25)
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-1">Bid-Offer Stack</h3>
      <p className="text-xs text-gray-400 mb-4">Price band volume and clearance by dispatch interval</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
              <th className="text-left pb-2 pr-3">Interval</th>
              <th className="text-left pb-2 pr-3">Region</th>
              <th className="text-right pb-2 pr-3">Band</th>
              <th className="text-right pb-2 pr-3">Cap ($/MWh)</th>
              <th className="text-right pb-2 pr-3">Total (MW)</th>
              <th className="text-right pb-2 pr-3">Cleared (MW)</th>
              <th className="text-right pb-2 pr-3">% Cleared</th>
              <th className="text-center pb-2">Marginal</th>
            </tr>
          </thead>
          <tbody>
            {sample.map((r, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-gray-750' : ''}>
                <td className="py-1.5 pr-3 text-blue-300 font-mono text-xs">{r.dispatch_interval.replace('T', ' ')}</td>
                <td className="py-1.5 pr-3">
                  <span
                    className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: REGION_COLORS[r.region] + '33', color: REGION_COLORS[r.region] }}
                  >
                    {r.region}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right">
                  <span className="text-xs font-mono" style={{ color: BAND_COLORS[r.price_band - 1] }}>
                    B{r.price_band}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right text-gray-300 text-xs">${r.band_price_cap.toFixed(0)}</td>
                <td className="py-1.5 pr-3 text-right text-white text-xs">{r.total_volume_mw.toFixed(0)}</td>
                <td className="py-1.5 pr-3 text-right text-green-400 text-xs">{r.cleared_volume_mw.toFixed(0)}</td>
                <td className="py-1.5 pr-3 text-right text-xs">
                  <span className={r.percent_cleared > 80 ? 'text-green-400' : r.percent_cleared > 40 ? 'text-yellow-400' : 'text-red-400'}>
                    {r.percent_cleared.toFixed(1)}%
                  </span>
                </td>
                <td className="py-1.5 text-center">
                  {r.marginal_band && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                      MARGINAL
                    </span>
                  )}
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
// Avg Clearing Price by Region (bar)
// ---------------------------------------------------------------------------
function AvgPriceByRegionChart({ data }: { data: NMMDashboard['price_formation'] }) {
  const byRegion = REGIONS.map(region => {
    const rows = data.filter(r => r.region === region)
    if (!rows.length) return { region, avg: 0, median: 0 }
    const avg    = Math.round(rows.reduce((s, r) => s + r.avg_clearing_price,    0) / rows.length)
    const median = Math.round(rows.reduce((s, r) => s + r.median_clearing_price, 0) / rows.length)
    return { region, 'Avg Price': avg, 'Median Price': median }
  })

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-1">Average vs Median Clearing Price</h3>
      <p className="text-xs text-gray-400 mb-4">Annual average across all intervals by region ($/MWh)</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={byRegion} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis unit=" $/MWh" tick={{ fill: '#9ca3af', fontSize: 11 }} width={76} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => [`$${v}/MWh`]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="Avg Price"    fill="#60a5fa" radius={[2,2,0,0]} />
          <Bar dataKey="Median Price" fill="#34d399" radius={[2,2,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function NEMMarketMicrostructureAnalytics() {
  const [data, setData]     = useState<NMMDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    getNEMMarketMicrostructureDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3" />
          <p>Loading NEM Market Microstructure Analytics...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96 text-red-400">
        <p>Error: {error ?? 'No data available'}</p>
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">NEM Market Microstructure Analytics</h1>
        <p className="text-sm text-gray-400 mt-1">
          Bid-offer spreads, dispatch interval mechanics, market depth, and strategic bidding analysis
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Avg Rebids / Generator / Day"
          value={String(summary.avg_rebids_per_generator_per_day)}
          sub="Strategic bidding activity"
        />
        <KpiCard
          label="% Intervals at VoLL (Annual)"
          value={`${summary.pct_intervals_at_voll_annual}%`}
          sub="$16,600/MWh cap"
        />
        <KpiCard
          label="Avg Price Dev. from Pre-Dispatch"
          value={`${summary.avg_price_deviation_from_predispatch_pct}%`}
          sub="Forecast accuracy gap"
        />
        <KpiCard
          label="Most Active Rebidder"
          value={String(summary.most_active_rebidder)}
          sub="by rebid count"
        />
        <KpiCard
          label="Market Depth Surplus"
          value={`${summary.market_depth_surplus_pct}%`}
          sub="at clearing price"
        />
        <KpiCard
          label="Gas as Price Setter"
          value={`${summary.price_setter_gas_pct}%`}
          sub="of all intervals"
        />
      </div>

      {/* Row 1: Price Formation + Avg Price */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PriceFormationChart data={data.price_formation} />
        <AvgPriceByRegionChart data={data.price_formation} />
      </div>

      {/* Row 2: Dispatch Interval + Market Depth */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DispatchIntervalChart data={data.dispatch_intervals} />
        <MarketDepthChart data={data.market_depth} />
      </div>

      {/* Row 3: Rebid Activity (full width) */}
      <RebidActivitySection data={data.rebids} />

      {/* Row 4: Bid-Offer Stack (full width) */}
      <BidOfferStackTable data={data.bid_offers} />

      {/* Footer note */}
      <div className="text-xs text-gray-600 text-center pb-2">
        Sprint 76c — NEM Market Microstructure Analytics | Data: AEMO NEM Dispatch &amp; Bidding | Reference day: 2024-07-15
      </div>
    </div>
  )
}
