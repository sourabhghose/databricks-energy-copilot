import { useEffect, useState } from 'react'
import { MapPin, Zap, TrendingUp, DollarSign, Users } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getRezAuctionCisDashboard, REZADashboard } from '../api/client'

const TECH_COLORS: Record<string, string> = {
  'Wind': '#3b82f6',
  'Solar': '#f59e0b',
  'Hybrid Wind+Solar': '#10b981',
  'Wind+BESS': '#8b5cf6',
}

const SCENARIO_COLORS: Record<string, string> = {
  'Current Policy': '#6366f1',
  'Accelerated CIS': '#22c55e',
  'State Led': '#f97316',
}

export default function RezAuctionCisAnalytics() {
  const [data, setData] = useState<REZADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRezAuctionCisDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-500">
        Failed to load REZ Auction & CIS data: {error}
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>

  // Chart 1: capacity awarded by auction (top 15 for readability)
  const auctionChartData = data.auctions.slice(0, 15).map(a => ({
    name: a.auction_name.length > 20 ? a.auction_name.slice(0, 18) + '…' : a.auction_name,
    capacity_mw: a.capacity_awarded_mw,
    technology: a.technology,
  }))

  // Chart 2: zone capacity breakdown
  const zoneChartData = data.zone_capacity.map(z => ({
    zone: z.zone.length > 18 ? z.zone.slice(0, 16) + '…' : z.zone,
    Awarded: z.awarded_gw,
    'Under Construction': z.under_construction_gw,
    Operating: z.operating_gw,
    Pipeline: z.pipeline_gw,
  }))

  // Chart 3: avg bid price by round and technology
  const roundTechMap: Record<string, Record<string, number>> = {}
  data.bid_characteristics.forEach(b => {
    if (!roundTechMap[b.auction_round]) roundTechMap[b.auction_round] = {}
    roundTechMap[b.auction_round][b.technology] = b.avg_bid_price
  })
  const bidChartData = Object.entries(roundTechMap).map(([round, techs]) => ({
    round,
    ...techs,
  }))

  // Chart 4: consumer savings by year per scenario (3 scenarios from grid_impacts)
  const scenarioYearMap: Record<string, Record<number, number>> = {}
  data.grid_impacts.forEach(g => {
    if (!scenarioYearMap[g.scenario]) scenarioYearMap[g.scenario] = {}
    scenarioYearMap[g.scenario][g.year] = (scenarioYearMap[g.scenario][g.year] || 0) + g.consumer_savings_m
  })
  const allYears = Array.from(new Set(data.grid_impacts.map(g => g.year))).sort()
  const savingsChartData = allYears.map(year => {
    const row: Record<string, unknown> = { year }
    Object.entries(scenarioYearMap).forEach(([scenario, yearData]) => {
      row[scenario] = yearData[year] ? Math.round(yearData[year] * 10) / 10 : 0
    })
    return row
  })
  const scenarioKeys = Object.keys(scenarioYearMap)

  // Chart 5: developer pipeline by total_pipeline_gw
  const pipelineChartData = data.developer_pipeline
    .sort((a, b) => b.total_pipeline_gw - a.total_pipeline_gw)
    .map(d => ({
      developer: d.developer.length > 16 ? d.developer.slice(0, 14) + '…' : d.developer,
      total_pipeline_gw: d.total_pipeline_gw,
      technology: d.preferred_technology,
    }))

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <MapPin className="w-7 h-7 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Renewable Energy Zone Auction &amp; CIS Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            CIS auction outcomes, zone capacity, bid characteristics, grid impacts &amp; developer pipelines
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center gap-4">
          <Zap className="w-8 h-8 text-blue-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Awarded</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {(summary.total_awarded_gw as number).toFixed(2)} GW
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center gap-4">
          <DollarSign className="w-8 h-8 text-amber-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Avg Strike Price</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${(summary.avg_strike_price as number).toFixed(2)}/MWh
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center gap-4">
          <TrendingUp className="w-8 h-8 text-green-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Oversubscribed Rounds</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.oversubscribed_rounds as number}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center gap-4">
          <Users className="w-8 h-8 text-purple-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Consumer Savings</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${((summary.total_consumer_savings_m as number) / 1000).toFixed(1)}B
            </p>
          </div>
        </div>
      </div>

      {/* Chart 1: Capacity Awarded by Auction */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Capacity Awarded by Auction (Top 15)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={auctionChartData} margin={{ top: 5, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-40} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
            <YAxis label={{ value: 'MW', angle: -90, position: 'insideLeft', offset: -5 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)} MW`, 'Capacity Awarded']} />
            <Bar dataKey="capacity_mw" fill="#3b82f6" name="Capacity Awarded (MW)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Zone Capacity Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Zone Capacity Breakdown (GW)
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={zoneChartData} margin={{ top: 5, right: 20, left: 10, bottom: 90 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="zone" angle={-40} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
            <YAxis label={{ value: 'GW', angle: -90, position: 'insideLeft', offset: -5 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)} GW`]} />
            <Legend verticalAlign="top" />
            <Bar dataKey="Awarded" stackId="a" fill="#3b82f6" />
            <Bar dataKey="Under Construction" stackId="a" fill="#f59e0b" />
            <Bar dataKey="Operating" stackId="a" fill="#10b981" />
            <Bar dataKey="Pipeline" stackId="a" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Avg Bid Price by Round for 4 Technologies */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Average Bid Price by Auction Round &amp; Technology ($/MWh)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={bidChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="round" />
            <YAxis label={{ value: '$/MWh', angle: -90, position: 'insideLeft', offset: -5 }} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}/MWh`]} />
            <Legend />
            {['Wind', 'Solar', 'Hybrid Wind+Solar', 'Wind+BESS'].map(tech => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                stroke={TECH_COLORS[tech]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Consumer Savings by Year per Scenario */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Consumer Savings by Year &amp; Scenario ($M)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={savingsChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis label={{ value: '$M', angle: -90, position: 'insideLeft', offset: -5 }} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(1)}M`]} />
            <Legend />
            {scenarioKeys.map(scenario => (
              <Line
                key={scenario}
                type="monotone"
                dataKey={scenario}
                stroke={SCENARIO_COLORS[scenario] || '#6366f1'}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Developer Pipeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Developer Pipeline (Total GW by Developer)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={pipelineChartData} margin={{ top: 5, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="developer" angle={-40} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
            <YAxis label={{ value: 'GW', angle: -90, position: 'insideLeft', offset: -5 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)} GW`, 'Total Pipeline']} />
            <Bar dataKey="total_pipeline_gw" fill="#10b981" name="Total Pipeline (GW)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Dashboard Summary
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Total Awarded (GW)</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
              {(summary.total_awarded_gw as number).toFixed(3)}
            </dd>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Avg Strike Price ($/MWh)</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
              ${(summary.avg_strike_price as number).toFixed(2)}
            </dd>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Oversubscribed Rounds</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
              {summary.oversubscribed_rounds as number}
            </dd>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Consumer Savings ($M)</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
              ${((summary.total_consumer_savings_m as number)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </dd>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Leading Developer</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
              {summary.leading_developer as string}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
