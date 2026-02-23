import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
} from 'recharts'
import {
  getHydrogenElectrolysisCostDashboard,
  HECADashboard,
} from '../api/client'

const TECH_COLORS: Record<string, string> = {
  PEM: '#38bdf8',
  Alkaline: '#34d399',
  SOEC: '#f97316',
  AEM: '#a78bfa',
}

const SCENARIO_COLORS: Record<string, string> = {
  'Grid Connected': '#f87171',
  'Dedicated Wind': '#38bdf8',
  'Dedicated Solar': '#fbbf24',
  'Hybrid Renewable': '#34d399',
}

function KpiCard({
  label,
  value,
  unit,
  sub,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

export default function HydrogenElectrolysisCostAnalytics() {
  const [data, setData] = useState<HECADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getHydrogenElectrolysisCostDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading...
      </div>
    )
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data'}
      </div>
    )

  const { summary, electrolyser_technologies, production_costs, grid_vs_renewable, stack_degradation, supply_chain } = data

  // Chart 1: grouped bar — current vs projected capex by technology
  const capexChartData = electrolyser_technologies.map((t) => ({
    technology: t.technology,
    'Current CapEx ($/kW)': t.current_capex_aud_kw,
    '2030 Projected ($/kW)': t.projected_capex_2030_aud_kw,
  }))

  // Chart 2: scatter — electricity cost vs LCOH, coloured by technology
  const scatterByTech: Record<string, { x: number; y: number; project_id: string }[]> = {}
  for (const pc of production_costs) {
    if (!scatterByTech[pc.technology]) scatterByTech[pc.technology] = []
    scatterByTech[pc.technology].push({
      x: pc.electricity_cost_aud_kwh,
      y: pc.lcoh_aud_kg,
      project_id: pc.project_id,
    })
  }

  // Chart 3: line — LCOH by year for each scenario (NSW1 only)
  const nsw1Data = grid_vs_renewable.filter((r) => r.region === 'NSW1')
  const years = [2024, 2027, 2030, 2035]
  const scenarioLineData = years.map((yr) => {
    const row: Record<string, number | string> = { year: yr }
    for (const scenario of ['Grid Connected', 'Dedicated Wind', 'Dedicated Solar', 'Hybrid Renewable']) {
      const match = nsw1Data.find((r) => r.scenario === scenario && r.year === yr)
      if (match) row[scenario] = match.lcoh_aud_kg
    }
    return row
  })

  // Chart 4: line — efficiency_loss_pct by operating_hours_k for each technology
  const techs = ['PEM', 'Alkaline', 'SOEC', 'AEM']
  const opHours = [0, 10, 20, 40, 60, 80, 100]
  const degradationLineData = opHours.map((h) => {
    const row: Record<string, number> = { operating_hours_k: h }
    for (const tech of techs) {
      const match = stack_degradation.find((d) => d.technology === tech && d.operating_hours_k === h)
      if (match) row[tech] = match.efficiency_loss_pct
    }
    return row
  })

  // Chart 5: stacked bar — australian_content_pct by component x technology
  const components = ['Membrane/Electrode', 'Stack', 'Power Electronics', 'BoP', 'Water Treatment']
  const supplyBarData = components.map((comp) => {
    const row: Record<string, string | number> = { component: comp }
    for (const tech of techs) {
      const match = supply_chain.find((s) => s.component === comp && s.technology === tech)
      if (match) row[tech] = match.australian_content_pct
    }
    return row
  })

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Hydrogen Electrolysis Cost Analytics</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            LCOH, electrolyser technology economics, grid vs renewable, stack degradation and supply chain
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Lowest LCOH"
          value={`$${summary.lowest_lcoh_aud_kg.toFixed(2)}`}
          unit="/kg"
          sub="Best project in pipeline"
        />
        <KpiCard
          label="2030 Target LCOH"
          value={`$${summary.target_lcoh_2030_aud_kg.toFixed(2)}`}
          unit="/kg"
          sub="Government stretch target"
        />
        <KpiCard
          label="Total Pipeline"
          value={summary.total_electrolyser_pipeline_gw.toFixed(1)}
          unit="GW"
          sub="Announced electrolyser projects"
        />
        <KpiCard
          label="Avg Efficiency"
          value={summary.avg_efficiency_kwh_kg.toFixed(1)}
          unit="kWh/kg"
          sub="Across all technologies"
        />
        <KpiCard
          label="Green H2 Projects"
          value={summary.green_h2_projects_count}
          sub="Electricity consumption < 60% LCOH"
        />
      </div>

      {/* Chart 1: Capex Comparison */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-100">
          Electrolyser CapEx: Current vs 2030 Projected (AUD $/kW)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={capexChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="technology" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $/kW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Current CapEx ($/kW)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="2030 Projected ($/kW)" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Scatter — electricity cost vs LCOH */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-100">
          Electricity Cost vs LCOH by Technology (30 Projects)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              dataKey="x"
              name="Electricity Cost"
              unit=" $/kWh"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'Electricity Cost ($/kWh)', position: 'insideBottom', offset: -4, fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="LCOH"
              unit=" $/kg"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'LCOH ($/kg)', angle: -90, position: 'insideLeft', offset: 10, fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(val: number, name: string) => [val.toFixed(3), name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {techs.map((tech) => (
              <Scatter
                key={tech}
                name={tech}
                data={scatterByTech[tech] ?? []}
                fill={TECH_COLORS[tech]}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: LCOH by year for each scenario (NSW1) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-100">
          LCOH Trajectory by Scenario — NSW1 (AUD $/kg H2)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={scenarioLineData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $/kg" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {['Grid Connected', 'Dedicated Wind', 'Dedicated Solar', 'Hybrid Renewable'].map((scenario) => (
              <Line
                key={scenario}
                type="monotone"
                dataKey={scenario}
                stroke={SCENARIO_COLORS[scenario]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Stack Degradation */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-100">
          Stack Degradation — Efficiency Loss by Operating Hours
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={degradationLineData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="operating_hours_k"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'Operating Hours (k hrs)', position: 'insideBottom', offset: -4, fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {techs.map((tech) => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                stroke={TECH_COLORS[tech]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Australian Content by Component x Technology (stacked) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-100">
          Australian Content (%) by Component and Technology
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={supplyBarData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="component"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {techs.map((tech) => (
              <Bar key={tech} dataKey={tech} stackId="a" fill={TECH_COLORS[tech]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-100">Summary</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt className="text-gray-400">Lowest LCOH</dt>
            <dd className="text-white font-semibold">${summary.lowest_lcoh_aud_kg.toFixed(2)}/kg</dd>
          </div>
          <div>
            <dt className="text-gray-400">2030 Target</dt>
            <dd className="text-white font-semibold">${summary.target_lcoh_2030_aud_kg.toFixed(2)}/kg</dd>
          </div>
          <div>
            <dt className="text-gray-400">Pipeline</dt>
            <dd className="text-white font-semibold">{summary.total_electrolyser_pipeline_gw.toFixed(1)} GW</dd>
          </div>
          <div>
            <dt className="text-gray-400">Avg Efficiency</dt>
            <dd className="text-white font-semibold">{summary.avg_efficiency_kwh_kg.toFixed(1)} kWh/kg</dd>
          </div>
          <div>
            <dt className="text-gray-400">Green H2 Projects</dt>
            <dd className="text-white font-semibold">{summary.green_h2_projects_count}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Technologies</dt>
            <dd className="text-white font-semibold">{electrolyser_technologies.length}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Production Projects</dt>
            <dd className="text-white font-semibold">{production_costs.length}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Grid vs RE Scenarios</dt>
            <dd className="text-white font-semibold">{grid_vs_renewable.length}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Degradation Points</dt>
            <dd className="text-white font-semibold">{stack_degradation.length}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Supply Chain Entries</dt>
            <dd className="text-white font-semibold">{supply_chain.length}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
