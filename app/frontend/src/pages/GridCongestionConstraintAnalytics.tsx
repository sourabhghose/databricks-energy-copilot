import { useEffect, useState } from 'react'
import { GitBranch } from 'lucide-react'
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
  Cell,
} from 'recharts'
import {
  getGridCongestionConstraintDashboard,
  GCCADashboard,
} from '../api/client'

const CONSTRAINT_TYPE_COLORS: Record<string, string> = {
  Thermal: '#f59e0b',
  Voltage: '#6366f1',
  Stability: '#ef4444',
  'N-1 Security': '#22c55e',
  'Thermal N-2': '#f97316',
  'System Strength': '#22d3ee',
}

const TECH_COLORS: Record<string, string> = {
  Solar: '#f59e0b',
  Wind: '#22c55e',
  Hydro: '#22d3ee',
  Coal: '#9ca3af',
  Gas: '#f97316',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#6366f1',
  QLD1: '#f59e0b',
  VIC1: '#22c55e',
  SA1: '#ef4444',
  TAS1: '#22d3ee',
}

const SCENARIO_COLORS: Record<string, string> = {
  'No Investment': '#ef4444',
  'Current Pipeline': '#f59e0b',
  Accelerated: '#22c55e',
}

const TNSP_COLORS: Record<string, string> = {
  TransGrid: '#6366f1',
  ElectraNet: '#ef4444',
  Powerlink: '#f59e0b',
  AusNet: '#22c55e',
  TasNetworks: '#22d3ee',
  TBD: '#9ca3af',
}

export default function GridCongestionConstraintAnalytics() {
  const [data, setData] = useState<GCCADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string>('SA1')

  useEffect(() => {
    getGridCongestionConstraintDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading Grid Congestion and Constraint Analytics...</span>
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

  const { summary, constraints, congestion_rents, curtailment, mlf_records, relief_projects, projections } = data

  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

  // KPI cards
  const kpis = [
    {
      label: 'Active Constraints',
      value: summary.total_constraints_active.toString(),
      sub: 'Binding in NEM',
      color: 'text-red-400',
    },
    {
      label: 'Total Congestion Rent YTD',
      value: `$${summary.total_congestion_rent_ytd_m.toFixed(1)}M`,
      sub: 'Across all corridors',
      color: 'text-amber-400',
    },
    {
      label: 'Total Curtailment YTD',
      value: `${summary.total_curtailment_ytd_gwh.toFixed(0)} GWh`,
      sub: 'Renewable curtailment',
      color: 'text-cyan-400',
    },
    {
      label: 'Most Congested Corridor',
      value: summary.most_congested_corridor,
      sub: `Avg MLF: ${summary.avg_mlf_value.toFixed(4)}`,
      color: 'text-purple-400',
    },
  ]

  // ---- Chart 1: Constraint Binding Frequency (horizontal bar) ----
  const constraintChartData = [...constraints]
    .sort((a, b) => b.binding_frequency_pct - a.binding_frequency_pct)
    .slice(0, 15)
    .map((c) => ({
      name: c.constraint_name.length > 28 ? c.constraint_name.slice(0, 28) + '…' : c.constraint_name,
      binding_frequency_pct: c.binding_frequency_pct,
      constraint_type: c.constraint_type,
      fill: CONSTRAINT_TYPE_COLORS[c.constraint_type] ?? '#9ca3af',
    }))

  // ---- Chart 2: Congestion Rent by Corridor (monthly bar) ----
  // Show top 3 corridors by total rent
  const corridorRentMap: Record<string, number> = {}
  for (const r of congestion_rents) {
    const key = `${r.region_from}→${r.region_to}`
    corridorRentMap[key] = (corridorRentMap[key] ?? 0) + r.congestion_rent_m
  }
  const topCorridors = Object.keys(corridorRentMap)
    .sort((a, b) => corridorRentMap[b] - corridorRentMap[a])
    .slice(0, 3)

  const congestionMonths = [...new Set(congestion_rents.map((r) => r.year_month))].sort()
  const congestionRentChartData = congestionMonths.map((ym) => {
    const row: Record<string, string | number> = { month: ym }
    for (const corridor of topCorridors) {
      const [rf, rt] = corridor.split('→')
      const rec = congestion_rents.find((r) => r.year_month === ym && r.region_from === rf && r.region_to === rt)
      if (rec) row[corridor] = rec.congestion_rent_m
    }
    return row
  })

  // ---- Chart 3: Renewable Curtailment Trend ----
  const curtailFiltered = curtailment
    .filter((c) => c.region === selectedRegion)
    .sort((a, b) => a.date_month.localeCompare(b.date_month))

  const curtailByMonthTech: Record<string, Record<string, number>> = {}
  for (const c of curtailFiltered) {
    if (!curtailByMonthTech[c.date_month]) curtailByMonthTech[c.date_month] = {}
    curtailByMonthTech[c.date_month][c.technology] = c.curtailed_pct_of_available
  }
  const curtailChartData = Object.keys(curtailByMonthTech)
    .sort()
    .map((ym) => ({
      month: ym,
      Solar: curtailByMonthTech[ym]['Solar'] ?? null,
      Wind: curtailByMonthTech[ym]['Wind'] ?? null,
    }))

  // ---- Chart 4: MLF Distribution ----
  const mlfSorted = [...mlf_records].sort((a, b) => a.mlf_value - b.mlf_value)
  const mlfChartData = mlfSorted.map((m) => ({
    name: m.duid,
    mlf_value: m.mlf_value,
    technology: m.technology,
    fill: TECH_COLORS[m.technology] ?? '#9ca3af',
  }))

  // ---- Chart 5: Relief Project Pipeline ----
  const reliefChartData = relief_projects
    .sort((a, b) => b.capex_m - a.capex_m)
    .map((p) => ({
      name: p.project_name.length > 22 ? p.project_name.slice(0, 22) + '…' : p.project_name,
      capex_m: p.capex_m,
      benefit_per_year: p.congestion_benefit_m_year,
      tnsp: p.tnsp,
      completion: p.expected_completion,
      fill: TNSP_COLORS[p.tnsp] ?? '#9ca3af',
    }))

  // ---- Chart 6: Congestion Cost Projection by scenario ----
  const projYears = [...new Set(projections.map((p) => p.year))].sort()
  const scenarios = ['No Investment', 'Current Pipeline', 'Accelerated']
  const projChartData = projYears.map((yr) => {
    const row: Record<string, string | number> = { year: yr.toString() }
    for (const sc of scenarios) {
      const recs = projections.filter((p) => p.year === yr && p.scenario === sc)
      if (recs.length > 0) {
        row[sc] = Math.round((recs.reduce((s, r) => s + r.congestion_cost_m, 0) / recs.length) * 10) / 10
      }
    }
    return row
  })

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <GitBranch className="w-8 h-8 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Grid Congestion and Constraint Analytics</h1>
          <p className="text-gray-400 text-sm">
            Binding constraint analysis, marginal loss factors, congestion rent, renewable curtailment and relief investment pipeline
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-gray-500 text-xs mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Region Filter */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-sm">Region (Curtailment):</label>
          <select
            className="bg-gray-800 text-gray-200 rounded-lg px-3 py-1 border border-gray-600 text-sm"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart 1: Constraint Binding Frequency */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Constraint Binding Frequency (%)</h2>
        <p className="text-gray-400 text-xs mb-4">Percentage of dispatch intervals where constraint is binding — top 15 constraints</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(CONSTRAINT_TYPE_COLORS).map(([ct, col]) => (
            <span key={ct} className="flex items-center gap-1 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: col }} />
              {ct}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart layout="vertical" data={constraintChartData} margin={{ left: 200 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis type="number" stroke="#9ca3af" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
            <YAxis type="category" dataKey="name" stroke="#9ca3af" tick={{ fontSize: 9 }} width={200} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, _name: string, props: { payload?: { constraint_type?: string } }) => [
                `${v.toFixed(1)}% binding | ${props.payload?.constraint_type ?? ''}`,
                'Binding Frequency',
              ]}
            />
            <Bar dataKey="binding_frequency_pct" name="Binding Frequency (%)">
              {constraintChartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Congestion Rent by Corridor */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Congestion Rent by Corridor ($M/month)</h2>
        <p className="text-gray-400 text-xs mb-4">Monthly congestion rent for the three highest-rent corridors</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={congestionRentChartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 9 }} interval={1} angle={-30} textAnchor="end" height={50} />
            <YAxis stroke="#9ca3af" tickFormatter={(v) => `$${v}M`} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`$${v.toFixed(2)}M`]}
            />
            <Legend />
            {topCorridors.map((corridor, i) => (
              <Bar key={corridor} dataKey={corridor} fill={['#6366f1', '#f59e0b', '#22c55e'][i % 3]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Renewable Curtailment Trend */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">
          Renewable Curtailment Trend — {selectedRegion}
        </h2>
        <p className="text-gray-400 text-xs mb-4">Curtailment as % of available generation by technology and month</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={curtailChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 9 }} interval={1} angle={-30} textAnchor="end" height={50} />
            <YAxis stroke="#9ca3af" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`${v.toFixed(1)}%`]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="Solar"
              stroke={TECH_COLORS['Solar']}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="Wind"
              stroke={TECH_COLORS['Wind']}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-gray-500 text-xs mt-2">
          SA renewable curtailment exceeds 10% in high-penetration periods driven by System Strength and Thermal constraints.
        </p>
      </div>

      {/* Chart 4: MLF Distribution */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Marginal Loss Factor (MLF) Distribution by Generator</h2>
        <p className="text-gray-400 text-xs mb-4">MLF values sorted ascending — values below 1.0 reduce effective dispatch revenue</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(TECH_COLORS).map(([tech, col]) => (
            <span key={tech} className="flex items-center gap-1 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: col }} />
              {tech}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={mlfChartData} barCategoryGap="15%">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" height={55} />
            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              domain={[0.82, 1.10]}
              tickFormatter={(v) => v.toFixed(3)}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, _name: string, props: { payload?: { technology?: string } }) => [
                `MLF ${v.toFixed(4)} | ${props.payload?.technology ?? ''}`,
                'MLF Value',
              ]}
            />
            <Bar dataKey="mlf_value" name="MLF Value">
              {mlfChartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Relief Project Pipeline */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Network Relief Project Pipeline — Capex ($M) by TNSP</h2>
        <p className="text-gray-400 text-xs mb-4">Capital expenditure by project coloured by Transmission Network Service Provider</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(TNSP_COLORS).filter(([k]) => k !== 'TBD').map(([tnsp, col]) => (
            <span key={tnsp} className="flex items-center gap-1 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: col }} />
              {tnsp}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart layout="vertical" data={reliefChartData} margin={{ left: 180 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis type="number" stroke="#9ca3af" tickFormatter={(v) => `$${v}M`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" stroke="#9ca3af" tick={{ fontSize: 9 }} width={180} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, _name: string, props: { payload?: { benefit_per_year?: number; tnsp?: string; completion?: string } }) => [
                `$${v.toFixed(0)}M | ${props.payload?.tnsp ?? ''} | Due ${props.payload?.completion ?? ''} | Benefit $${props.payload?.benefit_per_year?.toFixed(0) ?? 0}M/yr`,
                'Capex',
              ]}
            />
            <Bar dataKey="capex_m" name="Capex ($M)">
              {reliefChartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 6: Congestion Cost Projection */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Congestion Cost Projection 2024-2032 — Scenario Analysis</h2>
        <p className="text-gray-400 text-xs mb-4">Average annual congestion cost ($M) across NEM regions under three investment scenarios</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={projChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tickFormatter={(v) => `$${v}M`} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`$${(v as number).toFixed(1)}M`]}
            />
            <Legend />
            {scenarios.map((sc) => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                stroke={SCENARIO_COLORS[sc]}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p className="text-gray-500 text-xs mt-2">
          Accelerated investment scenario targets 40% congestion cost reduction by 2030 via Snowy 2.0, VIC-SA Heywood upgrade and SA STATCOM deployments.
        </p>
      </div>

      {/* Summary Table: Relief Projects */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Relief Project Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Project</th>
                <th className="text-left pb-2 pr-4">TNSP</th>
                <th className="text-left pb-2 pr-4">Type</th>
                <th className="text-right pb-2 pr-4">Capex ($M)</th>
                <th className="text-right pb-2 pr-4">Benefit ($M/yr)</th>
                <th className="text-right pb-2 pr-4">RAB</th>
                <th className="text-left pb-2">Completion</th>
              </tr>
            </thead>
            <tbody>
              {relief_projects.map((p) => (
                <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white">{p.project_name}</td>
                  <td className="py-2 pr-4">{p.tnsp}</td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300">
                      {p.relief_type}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right text-amber-400">${p.capex_m.toFixed(0)}M</td>
                  <td className="py-2 pr-4 text-right text-green-400">${p.congestion_benefit_m_year.toFixed(0)}M</td>
                  <td className="py-2 pr-4 text-right">
                    {p.rab_inclusion ? (
                      <span className="text-green-400">Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                  <td className="py-2 text-cyan-400">{p.expected_completion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary footer */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Total Relief Investment Pipeline</p>
            <p className="text-white font-bold text-lg">${(summary.total_relief_investment_pipeline_m / 1000).toFixed(1)}B</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Avg MLF (NEM)</p>
            <p className="text-white font-bold text-lg">{summary.avg_mlf_value.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Total Curtailment YTD</p>
            <p className="text-white font-bold text-lg">{summary.total_curtailment_ytd_gwh.toFixed(0)} GWh</p>
          </div>
        </div>
      </div>
    </div>
  )
}
