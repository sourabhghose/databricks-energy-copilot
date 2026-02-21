import { useEffect, useState } from 'react'
import { Award } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  CISCDashboard,
  CISCAwardRecord,
  getCapacityInvestmentSchemeDashboard,
} from '../api/client'

// ---- Colour palette ----
const TECH_COLORS: Record<string, string> = {
  'Solar PV':       '#f59e0b',
  'Wind Onshore':   '#3b82f6',
  'Wind Offshore':  '#06b6d4',
  'Battery Storage':'#a855f7',
  'Pumped Hydro':   '#22d3ee',
  'Firming Gas':    '#f97316',
}
const STAGE_COLORS: Record<string, string> = {
  'Pre-bid':        '#6b7280',
  'Short-listed':   '#3b82f6',
  'Awarded':        '#f59e0b',
  'Financial Close':'#10b981',
  'Construction':   '#f97316',
  'Operating':      '#22c55e',
}
const REGION_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#a855f7']
const REGIONS = ['NSW/ACT', 'VIC/TAS', 'QLD', 'SA/WA']

// ---- Helper: sum capacity by technology ----
function capacityByTechnology(awards: CISCAwardRecord[]) {
  const map: Record<string, number> = {}
  for (const a of awards) {
    map[a.technology] = (map[a.technology] ?? 0) + a.capacity_mw
  }
  return Object.entries(map)
    .map(([technology, capacity_mw]) => ({ technology, capacity_mw: Math.round(capacity_mw) }))
    .sort((a, b) => b.capacity_mw - a.capacity_mw)
}

export default function CapacityInvestmentSchemeAnalytics() {
  const [data, setData] = useState<CISCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCapacityInvestmentSchemeDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        <div className="text-center">
          <Award size={40} className="mx-auto mb-3 text-amber-400 animate-pulse" />
          <p>Loading CIS Analytics...</p>
        </div>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        <p>Error loading data: {error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const { awards, rounds, cfd_payments, pipeline, portfolio_metrics, market_impacts, summary } = data

  // ---- Derived datasets ----
  const techCapacity = capacityByTechnology(awards)

  const roundChartData = rounds.map(r => ({
    name: r.round_name.replace('CIS ', '').replace(' (', '\n('),
    target: r.total_capacity_mw_target,
    awarded: r.awarded_capacity_mw,
    clearing: r.clearing_price_dolpermwh,
  }))

  // CFD trends: aggregate by settlement period (avg cfd_payment)
  const cfdByPeriod: Record<string, { total: number; count: number }> = {}
  for (const c of cfd_payments) {
    if (!cfdByPeriod[c.settlement_period]) cfdByPeriod[c.settlement_period] = { total: 0, count: 0 }
    cfdByPeriod[c.settlement_period].total += c.cfd_payment_m
    cfdByPeriod[c.settlement_period].count += 1
  }
  const cfdTrendData = Object.entries(cfdByPeriod).map(([period, { total, count }]) => ({
    period,
    avg_payment: parseFloat((total / count).toFixed(2)),
    total_payment: parseFloat(total.toFixed(2)),
  }))

  // Pipeline by stage
  const stageMap: Record<string, number> = {}
  for (const p of pipeline) {
    stageMap[p.stage] = (stageMap[p.stage] ?? 0) + p.capacity_mw
  }
  const pipelineStageData = Object.entries(stageMap)
    .map(([stage, capacity_mw]) => ({ stage, capacity_mw: Math.round(capacity_mw) }))
    .sort((a, b) => {
      const order = ['Pre-bid','Short-listed','Awarded','Financial Close','Construction','Operating']
      return order.indexOf(a.stage) - order.indexOf(b.stage)
    })

  // Portfolio area chart: awarded capacity by region & year (2025-2029)
  const years = [2025, 2026, 2027, 2028, 2029]
  const portfolioChartData = years.map(year => {
    const row: Record<string, number | string> = { year: year.toString() }
    for (const region of REGIONS) {
      const rec = portfolio_metrics.find(m => m.year === year && m.region === region)
      row[region] = rec ? Math.round(rec.total_awarded_capacity_mw) : 0
    }
    return row
  })

  // Top 12 awards by capacity
  const topAwards = [...awards].sort((a, b) => b.capacity_mw - a.capacity_mw).slice(0, 12)

  const fmt = (n: number, dp = 1) => n.toFixed(dp)

  return (
    <div className="p-6 bg-gray-900 min-h-full text-gray-100">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <Award size={28} className="text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Capacity Investment Scheme Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Australia's CIS — Contracts for Difference & Firming Auctions
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Awarded Capacity</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{fmt(summary.total_awarded_gw, 2)}</p>
          <p className="text-xs text-gray-500 mt-1">GW contracted</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Pipeline Capacity</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{fmt(summary.total_pipeline_gw, 2)}</p>
          <p className="text-xs text-gray-500 mt-1">GW in pipeline</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Auction Rounds</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{summary.num_auction_rounds}</p>
          <p className="text-xs text-gray-500 mt-1">rounds completed/planned</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Avg Clearing Price</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">${fmt(summary.avg_clearing_price_dolpermwh, 1)}</p>
          <p className="text-xs text-gray-500 mt-1">$/MWh across rounds</p>
        </div>
      </div>

      {/* Row 1: Tech capacity + Rounds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Awarded capacity by technology */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Awarded Capacity by Technology (MW)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={techCapacity} layout="vertical" margin={{ left: 24, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="technology" stroke="#6b7280" tick={{ fontSize: 11 }} width={110} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v: number) => [`${v.toLocaleString()} MW`, 'Capacity']}
              />
              <Bar dataKey="capacity_mw" radius={[0, 4, 4, 0]}
                fill="#f59e0b"
                label={{ position: 'right', fill: '#9ca3af', fontSize: 10,
                  formatter: (v: number) => `${(v/1000).toFixed(1)}GW` }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Auction rounds: awarded vs target */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Auction Rounds — Target vs Awarded (MW)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={roundChartData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 9 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v: number, name: string) => [`${v.toLocaleString()} MW`, name === 'target' ? 'Target' : 'Awarded']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="target" fill="#374151" name="Target" radius={[4, 4, 0, 0]} />
              <Bar dataKey="awarded" fill="#3b82f6" name="Awarded" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: CFD payments + Pipeline stages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* CFD payment trends */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">CfD Payment Trends by Settlement Period ($M)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={cfdTrendData} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="period" stroke="#6b7280" tick={{ fontSize: 11 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v: number, name: string) => [
                  `$${v.toFixed(2)}M`,
                  name === 'avg_payment' ? 'Avg Payment' : 'Total Payment'
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="avg_payment" stroke="#f59e0b" strokeWidth={2} dot name="Avg Payment ($M)" />
              <Line type="monotone" dataKey="total_payment" stroke="#3b82f6" strokeWidth={2} dot name="Total Payment ($M)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline by stage */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Pipeline Capacity by Stage (MW)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pipelineStageData} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="stage" stroke="#6b7280" tick={{ fontSize: 10 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v: number) => [`${v.toLocaleString()} MW`, 'Capacity']}
              />
              <Bar dataKey="capacity_mw" radius={[4, 4, 0, 0]}
                name="Capacity (MW)"
                fill="#10b981"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Portfolio area chart */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Portfolio — Awarded Capacity by Region & Year (MW, Stacked)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={portfolioChartData} margin={{ left: 0, right: 20 }}>
            <defs>
              {REGIONS.map((region, i) => (
                <linearGradient key={region} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={REGION_COLORS[i]} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={REGION_COLORS[i]} stopOpacity={0.15} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number, name: string) => [`${v.toLocaleString()} MW`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {REGIONS.map((region, i) => (
              <Area
                key={region}
                type="monotone"
                dataKey={region}
                stackId="1"
                stroke={REGION_COLORS[i]}
                fill={`url(#grad-${i})`}
                strokeWidth={1.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Row 4: Top award records table */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Top 12 Award Records by Capacity</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="pb-2 pr-4 font-medium">Project</th>
                <th className="pb-2 pr-4 font-medium">Technology</th>
                <th className="pb-2 pr-4 font-medium">State</th>
                <th className="pb-2 pr-4 font-medium text-right">Capacity (MW)</th>
                <th className="pb-2 pr-4 font-medium text-right">Strike ($/MWh)</th>
                <th className="pb-2 pr-4 font-medium text-right">Term (yrs)</th>
                <th className="pb-2 font-medium">Contract Type</th>
              </tr>
            </thead>
            <tbody>
              {topAwards.map((a, idx) => (
                <tr
                  key={a.award_id}
                  className={`border-b border-gray-700/50 ${idx % 2 === 0 ? 'bg-gray-800/40' : ''}`}
                >
                  <td className="py-2 pr-4 text-white font-medium truncate max-w-[200px]">{a.project_name}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${TECH_COLORS[a.technology] ?? '#6b7280'}22`,
                        color: TECH_COLORS[a.technology] ?? '#9ca3af',
                      }}
                    >
                      {a.technology}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{a.state}</td>
                  <td className="py-2 pr-4 text-amber-400 text-right font-mono">{a.capacity_mw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-blue-400 text-right font-mono">${a.strike_price_dolpermwh.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-gray-300 text-right">{a.contract_term_years}</td>
                  <td className="py-2 text-gray-400">{a.contract_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Market Impact Summary */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mt-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Market Impact Scenarios</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="pb-2 pr-4 font-medium">Scenario</th>
                <th className="pb-2 pr-4 font-medium">Year</th>
                <th className="pb-2 pr-4 font-medium text-right">Price Impact (%)</th>
                <th className="pb-2 pr-4 font-medium text-right">RE Penetration (%)</th>
                <th className="pb-2 pr-4 font-medium text-right">Consumer Bill Impact ($/pa)</th>
                <th className="pb-2 pr-4 font-medium text-right">CO2 Reduction (Mt/pa)</th>
                <th className="pb-2 font-medium text-center">Reliability</th>
              </tr>
            </thead>
            <tbody>
              {market_impacts.map((m, idx) => (
                <tr key={m.impact_id} className={`border-b border-gray-700/50 ${idx % 2 === 0 ? 'bg-gray-800/40' : ''}`}>
                  <td className="py-2 pr-4 text-white font-medium">{m.scenario}</td>
                  <td className="py-2 pr-4 text-gray-300">{m.year}</td>
                  <td className={`py-2 pr-4 text-right font-mono ${m.wholesale_price_impact_pctchange < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.wholesale_price_impact_pctchange.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4 text-blue-400 text-right font-mono">{m.renewable_penetration_pct.toFixed(1)}%</td>
                  <td className={`py-2 pr-4 text-right font-mono ${m.consumer_bill_impact_dollar_pa < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${m.consumer_bill_impact_dollar_pa.toFixed(0)}
                  </td>
                  <td className="py-2 pr-4 text-amber-400 text-right font-mono">{m.co2_reduction_mt_pa.toFixed(1)}</td>
                  <td className="py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${m.reliability_standard_met ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
                      {m.reliability_standard_met ? 'Met' : 'At Risk'}
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
