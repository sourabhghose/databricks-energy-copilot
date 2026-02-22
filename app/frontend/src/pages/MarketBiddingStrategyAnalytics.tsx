import { useEffect, useState } from 'react'
import { Target } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  EMBSDashboard,
  getMarketBiddingStrategyDashboard,
} from '../api/client'

export default function MarketBiddingStrategyAnalytics() {
  const [data, setData] = useState<EMBSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState('NSW')

  useEffect(() => {
    getMarketBiddingStrategyDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading Market Bidding Strategy data...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-lg">Error: {error ?? 'No data available'}</div>
      </div>
    )
  }

  const { summary, participant_metrics, bid_stacks, auction_outcomes, nash_equilibria, strategic_behaviours, generator_bids } = data

  // KPI cards
  const kpis = [
    { label: 'Market Participants', value: String(summary.num_market_participants), sub: 'Active NEM generators' },
    { label: 'Avg Price-Cost Markup', value: `${summary.avg_price_cost_markup_pct}%`, sub: 'Above competitive benchmark' },
    { label: 'Consumer Overcharge', value: `$${Number(summary.total_consumer_overcharge_m_pa).toFixed(1)}M`, sub: 'Total Q1-2024' },
    { label: 'Avg Effective HHI', value: String(Number(summary.avg_effective_hhi).toFixed(0)), sub: 'Herfindahl-Hirschman Index' },
  ]

  // Market power chart data — sorted descending
  const marketPowerData = [...participant_metrics]
    .sort((a, b) => b.market_power_score - a.market_power_score)
    .map(p => ({
      name: p.participant_name.replace(' Energy', '').replace(' Hydro', ' H').replace(' Electricity', ' E'),
      score: p.market_power_score,
      fill: p.market_power_score > 60 ? '#ef4444' : p.market_power_score > 40 ? '#f59e0b' : '#22c55e',
    }))

  // Bid stack supply curve for selected region
  const bidStackData = bid_stacks
    .filter(bs => bs.region === selectedRegion)
    .sort((a, b) => a.hour - b.hour)
    .map(bs => ({
      hour: `${bs.hour}:00`,
      cumulative_mw: bs.cumulative_mw,
      cleared_price: bs.cleared_price_dolpermwh,
      competitive_price: bs.competitive_price_dolpermwh,
      demand_mw: bs.demand_mw,
    }))

  // Auction outcomes by region — cleared vs benchmark
  const auctionByRegion = ['NSW', 'VIC', 'QLD', 'SA', 'TAS'].map(r => {
    const regionOutcomes = auction_outcomes.filter(ao => ao.region === r)
    const avgCleared = regionOutcomes.length
      ? regionOutcomes.reduce((s, ao) => s + ao.cleared_price_dolpermwh, 0) / regionOutcomes.length
      : 0
    const avgBench = regionOutcomes.length
      ? regionOutcomes.reduce((s, ao) => s + ao.competitive_benchmark_dolpermwh, 0) / regionOutcomes.length
      : 0
    return { region: r, cleared: Math.round(avgCleared * 10) / 10, benchmark: Math.round(avgBench * 10) / 10 }
  })

  // Nash equilibrium surplus chart
  const nashData = nash_equilibria.map(eq => ({
    scenario: eq.market_scenario.replace(' Peak', '').replace(' Period', '').replace(' Demand', ''),
    consumer_surplus: eq.consumer_surplus_m,
    producer_surplus: eq.producer_surplus_m,
    deadweight_loss: eq.deadweight_loss_m,
  }))

  // Top 10 generators by revenue
  const topGenerators = [...generator_bids]
    .sort((a, b) => b.revenue_m - a.revenue_m)
    .slice(0, 10)

  const regions = ['NSW', 'VIC', 'QLD', 'SA']

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-orange-500/20 rounded-lg">
          <Target className="text-orange-400" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Electricity Market Bidding Strategy Analytics</h1>
          <p className="text-gray-400 text-sm">NEM generator bid strategies, market power, Nash equilibria &amp; auction efficiency</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">{kpi.label}</div>
            <div className="text-2xl font-bold text-white mb-1">{kpi.value}</div>
            <div className="text-xs text-gray-500">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Market Power Scores + Bid Stack */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Market Power Scores */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Participant Market Power Scores (Sorted)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={marketPowerData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} label={{ value: 'Score (0-100)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }} labelStyle={{ color: '#e5e7eb' }} itemStyle={{ color: '#9ca3af' }} />
              <Bar dataKey="score" name="Market Power Score" fill="#f59e0b">
                {marketPowerData.map((entry, index) => (
                  <rect key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bid Stack Supply Curve */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Supply Curve — Cleared vs Competitive Price</h2>
            <select
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              className="bg-gray-700 text-gray-300 text-xs rounded px-2 py-1 border border-gray-600"
            >
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={bidStackData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '$/MWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }} labelStyle={{ color: '#e5e7eb' }} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Line type="monotone" dataKey="cleared_price" name="Cleared Price $/MWh" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="competitive_price" name="Competitive Benchmark $/MWh" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Auction Outcomes + Nash Equilibria */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Auction Outcomes by Region */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Auction Outcomes — Cleared vs Benchmark (Avg by Region)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={auctionByRegion} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '$/MWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }} labelStyle={{ color: '#e5e7eb' }} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Bar dataKey="cleared" name="Cleared Price $/MWh" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="benchmark" name="Competitive Benchmark $/MWh" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Nash Equilibrium Surplus */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Nash Equilibrium — Consumer vs Producer Surplus ($M)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={nashData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="scenario" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '$M', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }} labelStyle={{ color: '#e5e7eb' }} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Bar dataKey="consumer_surplus" name="Consumer Surplus $M" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="producer_surplus" name="Producer Surplus $M" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="deadweight_loss" name="Deadweight Loss $M" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Strategic Behaviours Table */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Strategic Behaviour Events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Generator</th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Technology</th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Period</th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Behaviour Type</th>
                <th className="text-right py-2 px-2 text-gray-400 font-medium">Evidence Events</th>
                <th className="text-right py-2 px-2 text-gray-400 font-medium">Price Impact $/MWh</th>
                <th className="text-right py-2 px-2 text-gray-400 font-medium">Market Power Index</th>
                <th className="text-center py-2 px-2 text-gray-400 font-medium">Regulatory Flag</th>
              </tr>
            </thead>
            <tbody>
              {strategic_behaviours.map(sb => (
                <tr key={sb.behaviour_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 px-2 text-gray-200">{sb.generator_name}</td>
                  <td className="py-2 px-2 text-gray-400">{sb.technology}</td>
                  <td className="py-2 px-2 text-gray-400">{sb.analysis_period}</td>
                  <td className="py-2 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      sb.behaviour_type === 'Competitive' ? 'bg-green-900/50 text-green-400' :
                      sb.behaviour_type === 'Marginal Pricing' ? 'bg-blue-900/50 text-blue-400' :
                      'bg-amber-900/50 text-amber-400'
                    }`}>
                      {sb.behaviour_type}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-gray-300">{sb.evidence_events}</td>
                  <td className="py-2 px-2 text-right text-gray-300">${sb.price_impact_dolpermwh.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{sb.market_power_index.toFixed(3)}</td>
                  <td className="py-2 px-2 text-center">
                    {sb.regulatory_flag ? (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-900/50 text-red-400">FLAGGED</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4: Top Generator Bids Table */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Top 10 Generator Bids by Revenue</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Generator</th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Technology</th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Region</th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Interval</th>
                <th className="text-right py-2 px-2 text-gray-400 font-medium">Max Avail MW</th>
                <th className="text-right py-2 px-2 text-gray-400 font-medium">Dispatched MW</th>
                <th className="text-right py-2 px-2 text-gray-400 font-medium">Spot $/MWh</th>
                <th className="text-right py-2 px-2 text-gray-400 font-medium">Rebids</th>
                <th className="text-right py-2 px-2 text-gray-400 font-medium">Revenue $M</th>
              </tr>
            </thead>
            <tbody>
              {topGenerators.map(bid => (
                <tr key={bid.bid_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 px-2 text-gray-200">{bid.generator_name}</td>
                  <td className="py-2 px-2 text-gray-400">{bid.technology}</td>
                  <td className="py-2 px-2 text-gray-400">{bid.region}</td>
                  <td className="py-2 px-2 text-gray-400">{bid.dispatch_interval.replace('T', ' ')}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{bid.total_max_avail_mw.toFixed(0)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{bid.dispatched_mw.toFixed(0)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">${bid.spot_price_dolpermwh.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${bid.rebid_count > 5 ? 'bg-red-900/50 text-red-400' : bid.rebid_count > 2 ? 'bg-amber-900/50 text-amber-400' : 'text-gray-400'}`}>
                      {bid.rebid_count}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right font-semibold text-emerald-400">${bid.revenue_m.toFixed(2)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
