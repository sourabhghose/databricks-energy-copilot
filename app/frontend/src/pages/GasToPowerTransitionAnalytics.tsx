import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getGasToPowerTransitionDashboard,
  GPTADashboard,
  GPTAGasPlant,
  GPTARetirementTimeline,
  GPTAGasDemand,
  GPTAReplacementOption,
  GPTATransitionRisk,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const TECH_COLOURS: Record<string, string> = {
  CCGT: '#3b82f6',
  OCGT: '#f59e0b',
  Steam: '#ef4444',
  Cogeneration: '#8b5cf6',
}

const DISP_COLOURS: Record<string, string> = {
  'Fully Dispatchable': '#22c55e',
  'Weather Dependent': '#f59e0b',
  'Demand Side': '#3b82f6',
}

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#8b5cf6',
  SA1: '#ef4444',
  TAS1: '#06b6d4',
}

const SEVERITY_SIZE: Record<string, number> = {
  Critical: 200,
  High: 140,
  Medium: 90,
  Low: 50,
}

const SCENARIO_COLOURS: Record<string, string> = {
  'Rapid Transition': '#22c55e',
  'Managed Exit': '#f59e0b',
  'Late Action': '#ef4444',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KPICardProps {
  label: string
  value: string
  sub?: string
  accent?: string
}

function KPICard({ label, value, sub, accent = '#3b82f6' }: KPICardProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: accent }}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GasToPowerTransitionAnalytics() {
  const [data, setData] = useState<GPTADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGasToPowerTransitionDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
        Loading Gas-to-Power Transition data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-red-500">
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, string | number>

  // Chart 1 — top 15 plants by installed capacity
  const top15Plants: GPTAGasPlant[] = [...data.gas_plants]
    .sort((a, b) => b.installed_capacity_mw - a.installed_capacity_mw)
    .slice(0, 15)

  // Chart 3 — gas demand by year/scenario (pivot to array of {year, ...scenarios})
  const demandByYear: Record<number, Record<string, number>> = {}
  data.gas_demand.forEach((d: GPTAGasDemand) => {
    if (!demandByYear[d.year]) demandByYear[d.year] = { year: d.year }
    demandByYear[d.year][d.scenario] = d.gas_demand_pj
  })
  const demandChartData = Object.values(demandByYear).sort((a, b) => (a.year as number) - (b.year as number))

  // Chart 5 — scatter: probability vs cost, sized by severity
  const scatterData = data.transition_risks.map((tr: GPTATransitionRisk) => ({
    x: tr.probability_pct,
    y: tr.estimated_cost_m,
    z: SEVERITY_SIZE[tr.severity] ?? 60,
    region: tr.region,
    risk: tr.risk,
    severity: tr.severity,
  }))

  return (
    <div className="space-y-8 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Flame className="h-7 w-7 text-orange-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gas-to-Power Transition &amp; Retirement Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Australian gas generator retirement pipeline, replacement pathways and transition risks
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPICard
          label="Total Retiring Capacity"
          value={`${Number(summary.total_retiring_capacity_gw).toFixed(2)} GW`}
          sub="across 2024–2040"
          accent="#ef4444"
        />
        <KPICard
          label="Replacement Needed"
          value={`${Number(summary.total_replacement_needed_gw).toFixed(2)} GW`}
          sub="new dispatchable capacity"
          accent="#3b82f6"
        />
        <KPICard
          label="Transition Cost"
          value={`$${Number(summary.transition_cost_b).toFixed(1)} B`}
          sub="cumulative 2024–2040"
          accent="#f59e0b"
        />
        <KPICard
          label="Highest Risk Region"
          value={String(summary.highest_risk_region)}
          sub="most critical+high risks"
          accent="#8b5cf6"
        />
      </div>

      {/* Chart 1 — installed capacity by plant (top 15), coloured by technology */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          Installed Capacity by Plant (Top 15) — Coloured by Technology
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top15Plants} margin={{ top: 10, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="plant_name"
              angle={-45}
              textAnchor="end"
              tick={{ fontSize: 11 }}
              interval={0}
            />
            <YAxis
              label={{ value: 'Capacity (MW)', angle: -90, position: 'insideLeft', offset: -2, style: { fontSize: 11 } }}
            />
            <Tooltip
              formatter={(val: number) => [`${val.toFixed(1)} MW`, 'Installed Capacity']}
            />
            <Bar dataKey="installed_capacity_mw" name="Installed Capacity (MW)" radius={[4, 4, 0, 0]}>
              {top15Plants.map((entry, index) => (
                <Cell key={`plant-${index}`} fill={TECH_COLOURS[entry.technology] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-3">
          {Object.entries(TECH_COLOURS).map(([tech, colour]) => (
            <span key={tech} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: colour }} />
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2 — capacity retiring vs replacement by year */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          Retirement vs Replacement Capacity by Year (Reliability Gap Visible)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.retirement_timeline} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis
              label={{ value: 'Capacity (MW)', angle: -90, position: 'insideLeft', offset: -2, style: { fontSize: 11 } }}
            />
            <Tooltip formatter={(val: number) => [`${val.toFixed(1)} MW`]} />
            <Legend />
            <Line
              type="monotone"
              dataKey="capacity_retiring_mw"
              name="Retiring (MW)"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="replacement_capacity_mw"
              name="Replacement (MW)"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3 — gas demand by year for 3 scenarios */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          Gas Demand by Year — Three Transition Scenarios (PJ)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={demandChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis
              label={{ value: 'Gas Demand (PJ)', angle: -90, position: 'insideLeft', offset: -2, style: { fontSize: 11 } }}
            />
            <Tooltip formatter={(val: number) => [`${val.toFixed(1)} PJ`]} />
            <Legend />
            {['Rapid Transition', 'Managed Exit', 'Late Action'].map((scenario) => (
              <Line
                key={scenario}
                type="monotone"
                dataKey={scenario}
                stroke={SCENARIO_COLOURS[scenario]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — capex by replacement option, coloured by dispatchability */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          Replacement Option CAPEX ($B) — Coloured by Dispatchability
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data.replacement_options}
            margin={{ top: 10, right: 20, left: 10, bottom: 90 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="option"
              angle={-45}
              textAnchor="end"
              tick={{ fontSize: 11 }}
              interval={0}
            />
            <YAxis
              label={{ value: 'CAPEX ($B)', angle: -90, position: 'insideLeft', offset: -2, style: { fontSize: 11 } }}
            />
            <Tooltip formatter={(val: number) => [`$${val.toFixed(2)}B`, 'CAPEX']} />
            <Bar dataKey="capex_b" name="CAPEX ($B)" radius={[4, 4, 0, 0]}>
              {data.replacement_options.map((entry: GPTAReplacementOption, index: number) => (
                <Cell key={`rep-${index}`} fill={DISP_COLOURS[entry.dispatchability] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-3">
          {Object.entries(DISP_COLOURS).map(([disp, colour]) => (
            <span key={disp} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: colour }} />
              {disp}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 5 — scatter: probability vs estimated cost, sized by severity, coloured by region */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          Transition Risk Matrix — Probability vs Estimated Cost (Dot Size = Severity, Colour = Region)
        </h2>
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="x"
              name="Probability"
              type="number"
              label={{ value: 'Probability (%)', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              dataKey="y"
              name="Estimated Cost"
              type="number"
              label={{ value: 'Est. Cost ($M)', angle: -90, position: 'insideLeft', offset: -2, style: { fontSize: 11 } }}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (!payload || payload.length === 0) return null
                const d = payload[0].payload
                return (
                  <div className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-xs shadow">
                    <p className="font-semibold">{d.risk}</p>
                    <p>Region: {d.region}</p>
                    <p>Severity: {d.severity}</p>
                    <p>Probability: {d.x.toFixed(1)}%</p>
                    <p>Cost: ${d.y.toFixed(0)}M</p>
                  </div>
                )
              }}
            />
            {Object.entries(REGION_COLOURS).map(([reg, colour]) => {
              const regionData = scatterData.filter((d) => d.region === reg)
              return (
                <Scatter
                  key={reg}
                  name={reg}
                  data={regionData}
                  fill={colour}
                  opacity={0.75}
                />
              )
            })}
            <Legend />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-3">
          {Object.entries(SEVERITY_SIZE).map(([sev, sz]) => (
            <span key={sev} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <span
                className="inline-block rounded-full bg-gray-400"
                style={{ width: Math.sqrt(sz / 10) * 6, height: Math.sqrt(sz / 10) * 6 }}
              />
              {sev}
            </span>
          ))}
        </div>
      </div>

      {/* Summary grid */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">Summary</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(summary).map(([key, val]) => (
            <div key={key}>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
