// ============================================================
// Sprint 105a — Electricity Spot Market Depth & Price Discovery Analytics
// Prefix: ESMDX  |  Path: /spot-market-depth-x
// ============================================================

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import {
  getSpotMarketDepthXDashboard,
  ESMDXDashboard,
  ESMDXAnomalyRecord,
  ESMDXMarketImpactRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt2(v: number): string {
  return v.toFixed(2)
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

function anomalyBadgeClass(type: string): string {
  switch (type) {
    case 'Price Spike':         return 'bg-red-500/20 text-red-400 border border-red-500/40'
    case 'Price Collapse':      return 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
    case 'Volume Surge':        return 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
    case 'Bid Withdrawal':      return 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
    case 'Coordinated Bidding': return 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
    case 'Abnormal Spread':     return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
    default:                    return 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
  }
}

function strategicBadgeClass(v: number): string {
  if (v >= 7.0) return 'bg-red-500/20 text-red-400 border border-red-500/40'
  if (v >= 4.0) return 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
  return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  accent: string
}

function KpiCard({ label, value, sub, accent }: KpiCardProps) {
  return (
    <div className={`bg-gray-800 rounded-xl p-4 border ${accent} flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">{label}</span>
        <TrendingUp className="w-4 h-4 text-gray-500" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-gray-400 text-xs">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SpotMarketDepthXAnalytics() {
  const [data, setData] = useState<ESMDXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSpotMarketDepthXDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(err => { setError(err.message ?? 'Failed to load data'); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 animate-pulse" />
          <span>Loading Spot Market Depth & Price Discovery...</span>
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

  // ---- KPI values from summary ----
  const avgSpread = Number(data.summary['avg_bid_ask_spread_dolpermwh'] ?? 0)
  const avgLiq    = Number(data.summary['avg_liquidity_score'] ?? 0)
  const anomYtd   = Number(data.summary['anomalies_detected_ytd'] ?? 0)
  const avgEff    = Number(data.summary['avg_price_discovery_efficiency_pct'] ?? 0)

  // ---- Order Book Depth Chart — bid vs offer within 5% by region ----
  const regionMap: Record<string, { region: string; bid: number; offer: number; count: number }> = {}
  data.order_books.forEach(r => {
    if (!regionMap[r.region]) regionMap[r.region] = { region: r.region, bid: 0, offer: 0, count: 0 }
    regionMap[r.region].bid   += r.bid_volume_mw_10pct
    regionMap[r.region].offer += r.offer_volume_mw_10pct
    regionMap[r.region].count += 1
  })
  const orderBookChartData = Object.values(regionMap).map(r => ({
    region: r.region,
    bid:   Math.round(r.bid / r.count),
    offer: Math.round(r.offer / r.count),
  }))

  // ---- Price Discovery Efficiency by region over time ----
  const pdRegions = [...new Set(data.price_discovery.map(r => r.region))].sort()
  const pdDateMap: Record<string, Record<string, number>> = {}
  data.price_discovery.forEach(r => {
    if (!pdDateMap[r.date]) pdDateMap[r.date] = {}
    pdDateMap[r.date][r.region] = r.discovery_efficiency_pct
  })
  const pdChartData = Object.entries(pdDateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date: date.substring(5), ...vals }))

  const PD_COLOURS = ['#22d3ee', '#f97316', '#a78bfa', '#34d399', '#fbbf24']

  // ---- Trading Activity — high price vs negative price intervals by region ----
  const taRegionMap: Record<string, { region: string; high: number; neg: number; count: number }> = {}
  data.trading_activity.forEach(r => {
    if (!taRegionMap[r.region]) taRegionMap[r.region] = { region: r.region, high: 0, neg: 0, count: 0 }
    taRegionMap[r.region].high  += r.high_price_intervals
    taRegionMap[r.region].neg   += r.negative_price_intervals
    taRegionMap[r.region].count += 1
  })
  const taChartData = Object.values(taRegionMap).map(r => ({
    region: r.region,
    high_price: r.high,
    negative_price: r.neg,
  }))

  // ---- Seasonal avg price by hour_of_day (averaged across all regions/months) ----
  const hourMap: Record<number, { sum: number; count: number }> = {}
  data.seasonal_patterns.forEach(r => {
    const h = r.hour_of_day
    if (!hourMap[h]) hourMap[h] = { sum: 0, count: 0 }
    hourMap[h].sum   += r.avg_price_dolpermwh
    hourMap[h].count += 1
  })
  const seasonalChartData = Object.entries(hourMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([hour, v]) => ({
      hour: `${hour}:00`,
      avg_price: Math.round(v.sum / v.count * 100) / 100,
    }))

  // ---- Sort anomalies by date desc ----
  const sortedAnomalies: ESMDXAnomalyRecord[] = [...data.anomalies]
    .sort((a, b) => b.detected_date.localeCompare(a.detected_date))

  // ---- Sort market impacts by strategic_trading_indicator desc ----
  const sortedImpacts: ESMDXMarketImpactRecord[] = [...data.market_impacts]
    .sort((a, b) => b.strategic_trading_indicator - a.strategic_trading_indicator)

  return (
    <div className="space-y-6 p-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-teal-500/20 rounded-lg">
          <TrendingUp className="w-6 h-6 text-teal-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Electricity Spot Market Depth &amp; Price Discovery Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Order book depth, price discovery efficiency, trading activity, seasonal patterns, and market anomalies
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Avg Bid-Ask Spread"
          value={`$${fmt2(avgSpread)}/MWh`}
          sub="Avg across all regions"
          accent="border-teal-500/30"
        />
        <KpiCard
          label="Avg Liquidity Score"
          value={avgLiq.toFixed(1)}
          sub="0-100 scale"
          accent="border-cyan-500/30"
        />
        <KpiCard
          label="Anomalies YTD"
          value={String(anomYtd)}
          sub="Detected in 2024"
          accent="border-amber-500/30"
        />
        <KpiCard
          label="Price Discovery Efficiency"
          value={fmtPct(avgEff)}
          sub="Avg across regions"
          accent="border-violet-500/30"
        />
      </div>

      {/* Order Book Depth by Region */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="mb-4">
          <h2 className="text-white font-semibold text-lg">Order Book Depth by Region</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            Average bid vs offer volume (top 10%) in the order book by NEM region
          </p>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={orderBookChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={v => `${v.toFixed(0)} MW`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
              itemStyle={{ color: '#9ca3af' }}
              formatter={(value: number, name: string) => [`${value.toFixed(0)} MW`, name === 'bid' ? 'Bid Volume' : 'Offer Volume']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            <Bar dataKey="bid"   name="Bid Volume"   fill="#22d3ee" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            <Bar dataKey="offer" name="Offer Volume" fill="#f97316" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Price Discovery Efficiency by Region Over Time */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="mb-4">
          <h2 className="text-white font-semibold text-lg">Price Discovery Efficiency by Region</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            How efficiently spot prices incorporate available information over time (%)
          </p>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={pdChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis domain={[50, 100]} stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={v => `${v}%`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
              itemStyle={{ color: '#9ca3af' }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            {pdRegions.map((region, i) => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                name={region}
                stroke={PD_COLOURS[i % PD_COLOURS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trading Activity — High Price vs Negative Price Intervals */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="mb-4">
          <h2 className="text-white font-semibold text-lg">Trading Activity — Price Extremes by Region</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            Count of high-price and negative-price dispatch intervals by NEM region
          </p>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={taChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
              itemStyle={{ color: '#9ca3af' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            <Bar dataKey="high_price"     name="High Price Intervals"     fill="#ef4444" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            <Bar dataKey="negative_price" name="Negative Price Intervals" fill="#3b82f6" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Seasonal Avg Price by Hour of Day */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="mb-4">
          <h2 className="text-white font-semibold text-lg">Seasonal Price Pattern — Avg Price by Hour of Day</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            Average spot price ($/MWh) across all regions and seasons by hour of day
          </p>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={seasonalChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="hour" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
              itemStyle={{ color: '#9ca3af' }}
              formatter={(value: number) => [`$${value.toFixed(2)}/MWh`, 'Avg Price']}
            />
            <Bar dataKey="avg_price" name="Avg Price ($/MWh)" fill="#a78bfa" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Market Anomalies Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="mb-4">
          <h2 className="text-white font-semibold text-lg">Market Anomalies</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            Detected price, volume, and structural anomalies — AER referral status
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 font-medium py-2 pr-3">ID</th>
                <th className="text-left text-gray-400 font-medium py-2 px-3">Date</th>
                <th className="text-left text-gray-400 font-medium py-2 px-3">Region</th>
                <th className="text-left text-gray-400 font-medium py-2 px-3">Type</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Detected $</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Expected $</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Dev %</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Impact $M</th>
                <th className="text-center text-gray-400 font-medium py-2 pl-3">AER</th>
              </tr>
            </thead>
            <tbody>
              {sortedAnomalies.map((row, i) => (
                <tr
                  key={row.anomaly_id}
                  className={`border-b border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}`}
                >
                  <td className="py-2.5 pr-3 text-gray-400 font-mono text-xs">{row.anomaly_id}</td>
                  <td className="py-2.5 px-3 text-gray-300 text-xs">{row.detected_date}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 text-xs font-semibold border border-teal-500/30">
                      {row.region}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${anomalyBadgeClass(row.anomaly_type)}`}>
                      {row.anomaly_type}
                    </span>
                  </td>
                  <td className="text-right text-white py-2.5 px-3 font-mono text-xs">
                    ${row.detected_price_dolpermwh.toFixed(0)}
                  </td>
                  <td className="text-right text-gray-400 py-2.5 px-3 font-mono text-xs">
                    ${row.expected_price_dolpermwh.toFixed(0)}
                  </td>
                  <td className={`text-right py-2.5 px-3 font-mono text-xs font-semibold ${row.deviation_pct > 100 ? 'text-red-400' : row.deviation_pct < 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                    {row.deviation_pct > 0 ? '+' : ''}{row.deviation_pct.toFixed(1)}%
                  </td>
                  <td className="text-right text-white py-2.5 px-3 font-mono text-xs">
                    ${row.market_impact_m.toFixed(1)}M
                  </td>
                  <td className="text-center py-2.5 pl-3">
                    {row.referred_to_aer ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/40">
                        Referred
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded bg-gray-600/40 text-gray-500 text-xs">
                        No
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Market Participant Impact Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="mb-4">
          <h2 className="text-white font-semibold text-lg">Market Participant Impact Scores</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            Strategic trading indicator, price impact per 100 MW, and annual market impact cost
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 font-medium py-2 pr-4">Participant</th>
                <th className="text-left text-gray-400 font-medium py-2 px-3">Region</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Mkt Share</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Price Impact</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Rebids/Interval</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Price Setter %</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Impact $M/yr</th>
                <th className="text-center text-gray-400 font-medium py-2 pl-3">Strategic Score</th>
              </tr>
            </thead>
            <tbody>
              {sortedImpacts.map((row, i) => (
                <tr
                  key={row.impact_id}
                  className={`border-b border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}`}
                >
                  <td className="py-2.5 pr-4 text-white font-medium">{row.participant_name}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 text-xs font-semibold border border-violet-500/30">
                      {row.region}
                    </span>
                  </td>
                  <td className="text-right text-cyan-400 py-2.5 px-3 font-mono text-xs">
                    {row.market_share_dispatched_pct.toFixed(1)}%
                  </td>
                  <td className="text-right text-gray-300 py-2.5 px-3 font-mono text-xs">
                    ${row.price_impact_dolpermwh_per_100mw.toFixed(2)}/MWh/100MW
                  </td>
                  <td className="text-right text-gray-300 py-2.5 px-3 font-mono text-xs">
                    {row.rebid_frequency_per_interval.toFixed(2)}
                  </td>
                  <td className="text-right text-amber-400 py-2.5 px-3 font-mono text-xs">
                    {row.price_setter_hours_pct.toFixed(1)}%
                  </td>
                  <td className="text-right text-white py-2.5 px-3 font-mono text-xs font-semibold">
                    ${row.market_impact_cost_m_pa.toFixed(1)}M
                  </td>
                  <td className="text-center py-2.5 pl-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${strategicBadgeClass(row.strategic_trading_indicator)}`}>
                      {row.strategic_trading_indicator.toFixed(1)}
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
