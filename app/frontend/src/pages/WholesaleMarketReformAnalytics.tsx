import { useEffect, useState } from 'react'
import { Scale } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getWMRADashboard,
  WMRADashboard,
  WMRAReformRecord,
  WMRAEfficiencyRecord,
  WMRAConsumerImpactRecord,
  WMRAPriceCapRecord,
  WMRAMetricRecord,
} from '../api/client'

const STATUS_COLORS: Record<string, string> = {
  IMPLEMENTED: '#10b981',
  FINAL_DETERMINATION: '#3b82f6',
  DRAFT_DETERMINATION: '#f59e0b',
  CONSULTATION: '#a855f7',
  PROPOSED: '#6b7280',
}

const CATEGORY_COLORS: Record<string, string> = {
  PRICING: '#3b82f6',
  SCHEDULING: '#f59e0b',
  ACCESS: '#10b981',
  RELIABILITY: '#ef4444',
  EMISSIONS: '#a855f7',
  GOVERNANCE: '#06b6d4',
}

const EFFICIENCY_COLORS = {
  price_volatility_index: '#ef4444',
  bid_ask_spread_aud: '#f59e0b',
  dispatch_error_mw: '#3b82f6',
}

const CONSUMER_IMPACT_COLORS = {
  bill_reduction_m_aud: '#10b981',
  reliability_improvement_m_aud: '#3b82f6',
  emissions_reduction_m_aud: '#a855f7',
}

const PRICE_CAP_COLORS = {
  market_price_cap_aud_mwh: '#ef4444',
  cumulative_price_threshold_aud: '#f59e0b',
  administered_price_cap_aud_mwh: '#3b82f6',
}

export default function WholesaleMarketReformAnalytics() {
  const [data, setData] = useState<WMRADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWMRADashboard().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="p-6 text-red-400">Error: {error}</div>
  if (!data) return <div className="p-6 text-gray-400">Loading Wholesale Market Reform Analytics...</div>

  // ---- KPI Calculations ----
  const activeReformProposals = data.reforms.filter(
    (r) => r.status !== 'IMPLEMENTED'
  ).length
  const implementedReforms = data.reforms.filter(
    (r) => r.status === 'IMPLEMENTED'
  ).length
  const estimatedConsumerSavingBAud = data.reforms
    .reduce((s, r) => s + r.consumer_impact_b_aud, 0)
  const latestEfficiency = data.efficiency.length > 0 ? data.efficiency[data.efficiency.length - 1] : null
  const earliestEfficiency = data.efficiency.length > 0 ? data.efficiency[0] : null
  const marketEfficiencyGainPct =
    latestEfficiency && earliestEfficiency && earliestEfficiency.price_volatility_index > 0
      ? ((earliestEfficiency.price_volatility_index - latestEfficiency.price_volatility_index) /
          earliestEfficiency.price_volatility_index) *
        100
      : 0

  // ---- BarChart: Reform proposals by category & status ----
  const categories = ['PRICING', 'SCHEDULING', 'ACCESS', 'RELIABILITY', 'EMISSIONS', 'GOVERNANCE']
  const statuses = ['IMPLEMENTED', 'FINAL_DETERMINATION', 'DRAFT_DETERMINATION', 'CONSULTATION', 'PROPOSED']
  const reformByCategoryData = categories.map((cat) => {
    const row: Record<string, string | number> = { category: cat }
    statuses.forEach((st) => {
      row[st] = data.reforms.filter((r) => r.category === cat && r.status === st).length
    })
    return row
  })

  // ---- LineChart: Market efficiency metrics over 3 years ----
  const efficiencyData = data.efficiency.slice().sort((a, b) => (a.month < b.month ? -1 : 1))

  // ---- Stacked BarChart: Consumer impact by reform ----
  const consumerImpactData = data.consumer_impacts
    .slice()
    .sort((a, b) => b.total_impact_m_aud - a.total_impact_m_aud)

  // ---- AreaChart: Price cap evolution ----
  const priceCapData = data.price_caps.slice().sort((a, b) => a.year - b.year)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Scale className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold">NEM Wholesale Market Reform Analytics</h1>
          <p className="text-sm text-gray-400">
            Sprint 170c WMRA — Tracking NEM wholesale market reform proposals, efficiency improvements, and consumer impact
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Reform Proposals', value: activeReformProposals, fmt: (v: number) => v.toString(), color: 'text-blue-400' },
          { label: 'Implemented Reforms (Last 3yr)', value: implementedReforms, fmt: (v: number) => v.toString(), color: 'text-green-400' },
          { label: 'Estimated Consumer Saving B AUD', value: estimatedConsumerSavingBAud, fmt: (v: number) => v.toFixed(1), color: 'text-yellow-400' },
          { label: 'Market Efficiency Gain %', value: marketEfficiencyGainPct, fmt: (v: number) => v.toFixed(1) + '%', color: 'text-purple-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-2xl p-5 shadow">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.fmt(kpi.value)}</p>
          </div>
        ))}
      </div>

      {/* Row 1: Reform proposals by category & Market efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BarChart: Reform proposals by category and status */}
        <div className="bg-gray-800 rounded-2xl p-5 shadow">
          <h2 className="text-lg font-semibold mb-3">Reform Proposals by Category &amp; Status</h2>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={reformByCategoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="category" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend />
              {statuses.map((st) => (
                <Bar key={st} dataKey={st} stackId="a" fill={STATUS_COLORS[st]} name={st.replace(/_/g, ' ')} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* LineChart: Market efficiency metrics */}
        <div className="bg-gray-800 rounded-2xl p-5 shadow">
          <h2 className="text-lg font-semibold mb-3">Market Efficiency Metrics (3-Year Trend)</h2>
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={efficiencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={5} />
              <YAxis tick={{ fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend />
              <Line type="monotone" dataKey="price_volatility_index" stroke={EFFICIENCY_COLORS.price_volatility_index} name="Price Volatility Index" dot={false} />
              <Line type="monotone" dataKey="bid_ask_spread_aud" stroke={EFFICIENCY_COLORS.bid_ask_spread_aud} name="Bid-Ask Spread (AUD)" dot={false} />
              <Line type="monotone" dataKey="dispatch_error_mw" stroke={EFFICIENCY_COLORS.dispatch_error_mw} name="Dispatch Error (MW)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Consumer impact & Price cap evolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stacked BarChart: Consumer impact by reform */}
        <div className="bg-gray-800 rounded-2xl p-5 shadow">
          <h2 className="text-lg font-semibold mb-3">Consumer Impact by Reform (M AUD)</h2>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={consumerImpactData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af' }} />
              <YAxis dataKey="reform_name" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} width={180} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend />
              <Bar dataKey="bill_reduction_m_aud" stackId="a" fill={CONSUMER_IMPACT_COLORS.bill_reduction_m_aud} name="Bill Reduction" />
              <Bar dataKey="reliability_improvement_m_aud" stackId="a" fill={CONSUMER_IMPACT_COLORS.reliability_improvement_m_aud} name="Reliability Improvement" />
              <Bar dataKey="emissions_reduction_m_aud" stackId="a" fill={CONSUMER_IMPACT_COLORS.emissions_reduction_m_aud} name="Emissions Reduction" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* AreaChart: Market price cap and cumulative price threshold evolution */}
        <div className="bg-gray-800 rounded-2xl p-5 shadow">
          <h2 className="text-lg font-semibold mb-3">Price Cap &amp; Threshold Evolution (2020-2026)</h2>
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={priceCapData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af' }} />
              <YAxis tick={{ fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend />
              <Area type="monotone" dataKey="market_price_cap_aud_mwh" stroke={PRICE_CAP_COLORS.market_price_cap_aud_mwh} fill={PRICE_CAP_COLORS.market_price_cap_aud_mwh} fillOpacity={0.2} name="Market Price Cap (AUD/MWh)" />
              <Area type="monotone" dataKey="cumulative_price_threshold_aud" stroke={PRICE_CAP_COLORS.cumulative_price_threshold_aud} fill={PRICE_CAP_COLORS.cumulative_price_threshold_aud} fillOpacity={0.2} name="Cumulative Price Threshold (AUD)" />
              <Area type="monotone" dataKey="administered_price_cap_aud_mwh" stroke={PRICE_CAP_COLORS.administered_price_cap_aud_mwh} fill={PRICE_CAP_COLORS.administered_price_cap_aud_mwh} fillOpacity={0.2} name="Administered Price Cap (AUD/MWh)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table: Reform Register */}
      <div className="bg-gray-800 rounded-2xl p-5 shadow overflow-x-auto">
        <h2 className="text-lg font-semibold mb-3">Reform Register</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="py-2 px-3 text-left">Reform Name</th>
              <th className="py-2 px-3 text-left">Category</th>
              <th className="py-2 px-3 text-left">Proponent</th>
              <th className="py-2 px-3 text-left">Status</th>
              <th className="py-2 px-3 text-left">Implementation Date</th>
              <th className="py-2 px-3 text-right">Consumer Impact (B AUD)</th>
              <th className="py-2 px-3 text-left">Description</th>
            </tr>
          </thead>
          <tbody>
            {data.reforms.map((r: WMRAReformRecord, i: number) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 px-3 font-medium">{r.reform_name}</td>
                <td className="py-2 px-3">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: CATEGORY_COLORS[r.category] + '33', color: CATEGORY_COLORS[r.category] }}>
                    {r.category}
                  </span>
                </td>
                <td className="py-2 px-3">{r.proponent}</td>
                <td className="py-2 px-3">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: STATUS_COLORS[r.status] + '33', color: STATUS_COLORS[r.status] }}>
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-2 px-3">{r.implementation_date ?? '---'}</td>
                <td className="py-2 px-3 text-right">{r.consumer_impact_b_aud.toFixed(2)}</td>
                <td className="py-2 px-3 text-gray-400 max-w-xs truncate">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table: Market Efficiency Metrics */}
      <div className="bg-gray-800 rounded-2xl p-5 shadow overflow-x-auto">
        <h2 className="text-lg font-semibold mb-3">Market Efficiency Metrics</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="py-2 px-3 text-left">Metric</th>
              <th className="py-2 px-3 text-right">2022 Value</th>
              <th className="py-2 px-3 text-right">2025 Value</th>
              <th className="py-2 px-3 text-right">Improvement %</th>
              <th className="py-2 px-3 text-right">Target</th>
              <th className="py-2 px-3 text-center">On Track</th>
            </tr>
          </thead>
          <tbody>
            {data.metrics.map((m: WMRAMetricRecord, i: number) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 px-3 font-medium">{m.metric_name}</td>
                <td className="py-2 px-3 text-right">{m.value_2022.toFixed(2)}</td>
                <td className="py-2 px-3 text-right">{m.value_2025.toFixed(2)}</td>
                <td className="py-2 px-3 text-right">
                  <span className={m.improvement_pct >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {m.improvement_pct >= 0 ? '+' : ''}{m.improvement_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 px-3 text-right">{m.target_value.toFixed(2)}</td>
                <td className="py-2 px-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${m.on_track ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                    {m.on_track ? 'ON TRACK' : 'OFF TRACK'}
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
