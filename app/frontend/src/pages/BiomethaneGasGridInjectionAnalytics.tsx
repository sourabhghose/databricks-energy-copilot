import { useEffect, useState } from 'react'
import { Leaf } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getBiomethaneGasGridInjectionDashboard,
  BGGIDashboard,
  BGGIFeedstockRecord,
  BGGIProductionRecord,
  BGGIEconomicsRecord,
  BGGIGridRecord,
  BGGICertificateRecord,
  BGGIScenarioRecord,
} from '../api/client'

export default function BiomethaneGasGridInjectionAnalytics() {
  const [data, setData] = useState<BGGIDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBiomethaneGasGridInjectionDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading Biomethane Gas Grid Injection Analytics...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400">
        <span className="text-lg">Error: {error ?? 'No data available'}</span>
      </div>
    )
  }

  const { summary, feedstocks, production, economics, grid_integration, certificates, scenarios } = data

  // ---- KPI Values ----
  const totalFeedstockPJ = typeof summary.total_feedstock_potential_pj === 'number'
    ? summary.total_feedstock_potential_pj.toFixed(4)
    : '0'
  const totalCapacityGJDay = typeof summary.total_production_capacity_gj_day === 'number'
    ? summary.total_production_capacity_gj_day.toLocaleString()
    : '0'
  const avgProdCost = typeof summary.avg_production_cost_aud_per_gj === 'number'
    ? summary.avg_production_cost_aud_per_gj.toFixed(2)
    : '0'
  const gridInjFacilities = typeof summary.grid_injection_facilities === 'number'
    ? summary.grid_injection_facilities
    : 0

  const kpis = [
    {
      label: 'Total Feedstock Potential',
      value: totalFeedstockPJ,
      unit: 'PJ biomethane',
      color: 'text-green-400',
    },
    {
      label: 'Total Production Capacity',
      value: totalCapacityGJDay,
      unit: 'GJ/day (all facilities)',
      color: 'text-emerald-400',
    },
    {
      label: 'Avg Production Cost',
      value: `A$${avgProdCost}`,
      unit: 'per GJ (LCOE)',
      color: 'text-yellow-400',
    },
    {
      label: 'Grid Injection Facilities',
      value: String(gridInjFacilities),
      unit: 'connected to gas network',
      color: 'text-cyan-400',
    },
  ]

  // ---- Chart 1: Feedstock Potential by Type (BarChart, biomethane_potential_gj by feedstock_type coloured by state) ----
  const feedstockTypeMap: Record<string, Record<string, number>> = {}
  feedstocks.forEach((f: BGGIFeedstockRecord) => {
    if (!feedstockTypeMap[f.feedstock_type]) feedstockTypeMap[f.feedstock_type] = {}
    feedstockTypeMap[f.feedstock_type][f.state] =
      (feedstockTypeMap[f.feedstock_type][f.state] ?? 0) + f.biomethane_potential_gj
  })
  const feedstockChartData = Object.entries(feedstockTypeMap).map(([feedstock_type, states]) => ({
    feedstock_type: feedstock_type.length > 14 ? feedstock_type.slice(0, 13) + '…' : feedstock_type,
    fullLabel: feedstock_type,
    ...states,
  }))
  const feedstockStates = [...new Set(feedstocks.map((f) => f.state))]
  const feedstockStateColors = ['#22d3ee', '#34d399', '#f59e0b', '#6366f1', '#f87171']

  // ---- Chart 2: Production Economics (LineChart, production_cost + total_lcoe vs natural_gas_price 2020-2032) ----
  const econYearMap: Record<number, { production_cost: number[]; total_lcoe: number[]; ng_price: number[] }> = {}
  economics.forEach((e: BGGIEconomicsRecord) => {
    if (!econYearMap[e.year]) econYearMap[e.year] = { production_cost: [], total_lcoe: [], ng_price: [] }
    econYearMap[e.year].production_cost.push(e.production_cost_aud_per_gj)
    econYearMap[e.year].total_lcoe.push(e.total_lcoe_aud_per_gj)
    econYearMap[e.year].ng_price.push(e.natural_gas_price_aud_per_gj)
  })
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const econChartData = Object.entries(econYearMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, v]) => ({
      year: Number(year),
      'Avg Production Cost': +avg(v.production_cost).toFixed(2),
      'Avg Total LCOE': +avg(v.total_lcoe).toFixed(2),
      'Natural Gas Price': +avg(v.ng_price).toFixed(2),
    }))

  // ---- Chart 3: Grid Network Capacity (horizontal BarChart, biomethane_capacity_pj by network_operator × state) ----
  const gridChartData = grid_integration
    .slice()
    .sort((a: BGGIGridRecord, b: BGGIGridRecord) => b.biomethane_capacity_pj - a.biomethane_capacity_pj)
    .slice(0, 12)
    .map((g: BGGIGridRecord) => ({
      operator: g.network_operator.length > 20 ? g.network_operator.slice(0, 19) + '…' : g.network_operator,
      state: g.state,
      biomethane_capacity_pj: g.biomethane_capacity_pj,
      current_injection_pj: g.current_injection_pj,
    }))

  // ---- Chart 4: Facility Status Pipeline (stacked BarChart, capacity_gj_day by status × technology) ----
  const pipelineMap: Record<string, Record<string, number>> = {}
  production.forEach((p: BGGIProductionRecord) => {
    if (!pipelineMap[p.status]) pipelineMap[p.status] = {}
    pipelineMap[p.status][p.upgrading_technology] =
      (pipelineMap[p.status][p.upgrading_technology] ?? 0) + p.capacity_gj_day
  })
  const pipelineChartData = Object.entries(pipelineMap).map(([status, techs]) => ({
    status,
    ...techs,
  }))
  const upgradingTechs = [...new Set(production.map((p) => p.upgrading_technology))]
  const techColors = ['#6366f1', '#22d3ee', '#34d399', '#f59e0b', '#f87171']

  // ---- Chart 5: Certificate Value (BarChart, value_range and issuance_count for each scheme) ----
  const certChartData = certificates.map((c: BGGICertificateRecord) => {
    const parts = c.value_range_aud.split('-').map(Number)
    const midValue = parts.length === 2 ? (parts[0] + parts[1]) / 2 : parts[0] ?? 0
    return {
      scheme: c.scheme_name.length > 20 ? c.scheme_name.slice(0, 19) + '…' : c.scheme_name,
      fullScheme: c.scheme_name,
      mid_value_aud: midValue,
      issuance_k: Math.round(c.issuance_count_ytd / 1000),
    }
  })

  // ---- Chart 6: Scenario Biomethane Penetration (AreaChart, 2 scenarios 2025-2040) ----
  const scenarioYears = [...new Set(scenarios.map((s: BGGIScenarioRecord) => s.year))].sort()
  const scenarioNames = [...new Set(scenarios.map((s: BGGIScenarioRecord) => s.scenario))]
  const scenarioMap: Record<number, Record<string, number>> = {}
  scenarios.forEach((s: BGGIScenarioRecord) => {
    if (!scenarioMap[s.year]) scenarioMap[s.year] = {}
    scenarioMap[s.year][s.scenario] = s.biomethane_production_pj
  })
  const scenarioChartData = scenarioYears.map((yr) => ({
    year: yr,
    ...scenarioMap[yr],
  }))
  const scenarioColors: Record<string, string> = {
    'Current Policy': '#6366f1',
    'Net Zero Gas': '#34d399',
  }

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Leaf size={28} className="text-green-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Biomethane &amp; Gas Grid Injection Analytics</h1>
          <p className="text-sm text-gray-400">
            Anaerobic digestion, upgrading technologies, grid injection economics, renewable gas certificates and decarbonisation of the gas network — Australia
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.unit}</p>
          </div>
        ))}
      </div>

      {/* Row 1: Feedstock Potential + Production Economics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart 1: Feedstock Potential by Type */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Feedstock Biomethane Potential by Type (GJ, by State)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={feedstockChartData} margin={{ top: 5, right: 20, left: 0, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="feedstock_type"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} unit=" GJ" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number, name: string) => [v.toLocaleString(), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {feedstockStates.map((st, idx) => (
                <Bar
                  key={st}
                  dataKey={st}
                  stackId="feedstock"
                  fill={feedstockStateColors[idx % feedstockStateColors.length]}
                  name={st}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Production Economics */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Production Economics — LCOE vs Natural Gas Price (AUD/GJ, 2020–2032)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={econChartData} margin={{ top: 5, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/GJ" domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number, name: string) => [`A$${v.toFixed(2)}/GJ`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Line type="monotone" dataKey="Avg Production Cost" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Avg Total LCOE" stroke="#f87171" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Natural Gas Price" stroke="#22d3ee" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Grid Network Capacity + Facility Status Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart 3: Grid Network Capacity — horizontal BarChart */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Gas Grid Biomethane Capacity by Network Operator (PJ)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={gridChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} unit=" PJ" />
              <YAxis
                type="category"
                dataKey="operator"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                width={140}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number, name: string) => [`${v.toFixed(3)} PJ`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="biomethane_capacity_pj" fill="#6366f1" name="Max Biomethane Capacity (PJ)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="current_injection_pj" fill="#34d399" name="Current Injection (PJ)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Facility Status Pipeline — stacked BarChart */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Facility Pipeline by Status &amp; Upgrading Technology (GJ/day)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={pipelineChartData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="status" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} unit=" GJ/d" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number, name: string) => [`${v.toLocaleString()} GJ/day`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {upgradingTechs.map((tech, idx) => (
                <Bar
                  key={tech}
                  dataKey={tech}
                  stackId="pipeline"
                  fill={techColors[idx % techColors.length]}
                  name={tech}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Certificate Value + Scenario Biomethane Penetration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart 5: Certificate Value */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Renewable Gas Certificate — Mid-Value (AUD) &amp; YTD Issuance (k)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={certChartData} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="scheme"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 10 }} unit=" AUD" />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 10 }} unit="k" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar yAxisId="left" dataKey="mid_value_aud" fill="#f59e0b" name="Mid Certificate Value (AUD)" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="issuance_k" fill="#22d3ee" name="YTD Issuance (thousands)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 6: Scenario Biomethane Penetration — AreaChart */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Biomethane Production Scenarios 2025–2034 (PJ)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={scenarioChartData} margin={{ top: 5, right: 20, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="bggiNZGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="bggiCPGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} unit=" PJ" domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number, name: string) => [`${v.toFixed(4)} PJ`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {scenarioNames.map((sc) => (
                <Area
                  key={sc}
                  type="monotone"
                  dataKey={sc}
                  stroke={scenarioColors[sc] ?? '#a3a3a3'}
                  fill={sc === 'Net Zero Gas' ? 'url(#bggiNZGrad)' : 'url(#bggiCPGrad)'}
                  strokeWidth={2}
                  name={sc}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Table: Production Facilities */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Biomethane Production Facilities</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-2 pr-3">Facility</th>
                <th className="text-left py-2 pr-3">Operator</th>
                <th className="text-left py-2 pr-3">State</th>
                <th className="text-left py-2 pr-3">Feedstock</th>
                <th className="text-left py-2 pr-3">Technology</th>
                <th className="text-right py-2 pr-3">Capacity (GJ/day)</th>
                <th className="text-right py-2 pr-3">Actual (GJ/day)</th>
                <th className="text-right py-2 pr-3">Purity (%)</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-center py-2">Grid Injection</th>
              </tr>
            </thead>
            <tbody>
              {production.map((p: BGGIProductionRecord) => (
                <tr key={p.facility_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-1.5 pr-3 font-medium text-white">{p.facility_name}</td>
                  <td className="py-1.5 pr-3">{p.operator}</td>
                  <td className="py-1.5 pr-3">
                    <span className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded text-xs">{p.state}</span>
                  </td>
                  <td className="py-1.5 pr-3">{p.feedstock_primary}</td>
                  <td className="py-1.5 pr-3 text-cyan-400">{p.upgrading_technology}</td>
                  <td className="py-1.5 pr-3 text-right">{p.capacity_gj_day.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right">{p.actual_production_gj_day.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right">{p.biomethane_purity_pct.toFixed(1)}%</td>
                  <td className="py-1.5 pr-3">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      p.status === 'Operating'
                        ? 'bg-green-900 text-green-300'
                        : p.status === 'Construction'
                        ? 'bg-yellow-900 text-yellow-300'
                        : p.status === 'Development'
                        ? 'bg-blue-900 text-blue-300'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-1.5 text-center">
                    {p.grid_injection ? (
                      <span className="text-green-400 font-bold">Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
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
