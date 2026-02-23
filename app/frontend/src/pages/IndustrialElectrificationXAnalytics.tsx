import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Factory, Zap, Leaf, TrendingUp, DollarSign } from 'lucide-react'
import {
  getIndustrialElectrificationXDashboard,
  INEAXDashboard,
} from '../api/client'

// ── Colour maps ──────────────────────────────────────────────────────────────
const REGION_COLOUR: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#34d399',
  VIC1: '#a78bfa',
  SA1:  '#fb923c',
  TAS1: '#f472b6',
}

const SCENARIO_COLOUR: Record<string, string> = {
  Base:          '#60a5fa',
  Accelerated:   '#34d399',
  Transformative:'#f59e0b',
}

const SEVERITY_COLOUR: Record<string, string> = {
  High:   '#ef4444',
  Medium: '#f59e0b',
  Low:    '#22c55e',
}

const MATURITY_COLOUR: Record<string, string> = {
  Commercial:    '#22c55e',
  Demonstration: '#f59e0b',
  Emerging:      '#a78bfa',
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, Icon, colour,
}: {
  label: string; value: string | number; sub?: string; Icon: React.ElementType; colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex items-start gap-3 shadow border border-gray-700">
      <div className={`p-2 rounded-lg ${colour}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Chart 1 — Stacked bar: electrification_potential_pj by sector × region ──
function SectorElecPotentialChart({ data }: { data: INEAXDashboard['sectors'] }) {
  // Build one entry per sector, stacked by region
  const sectors = Array.from(new Set(data.map(d => d.sector)))
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

  const chartData = sectors.map(sec => {
    const row: Record<string, unknown> = { sector: sec }
    regions.forEach(reg => {
      const match = data.find(d => d.sector === sec && d.region === reg)
      row[reg] = match ? match.electrification_potential_pj : 0
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Electrification Potential (PJ) by Sector &amp; Region
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-30} textAnchor="end" />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" PJ" />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {regions.map(reg => (
            <Bar key={reg} dataKey={reg} stackId="a" fill={REGION_COLOUR[reg]} name={reg} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Chart 2 — Grouped bar: capex & co2_reduction by technology ──────────────
function TechnologyCapexCO2Chart({ data }: { data: INEAXDashboard['technologies'] }) {
  const chartData = data.map(t => ({
    name: t.technology.length > 20 ? t.technology.slice(0, 18) + '…' : t.technology,
    fullName: t.technology,
    sector: t.sector,
    maturity: t.maturity,
    capex: t.capex_m_per_unit,
    co2: t.co2_reduction_mt_per_yr,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Technology Capex (A$M/unit) vs CO₂ Reduction (Mt/yr)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" />
          <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" M" />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" Mt" />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(value: number, name: string) =>
              name === 'Capex A$M/unit'
                ? [`$${value.toFixed(1)}M`, name]
                : [`${value.toFixed(2)} Mt/yr`, name]
            }
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Bar yAxisId="left" dataKey="capex" name="Capex A$M/unit" fill="#60a5fa">
            {chartData.map((entry, i) => (
              <Cell key={i} fill={MATURITY_COLOUR[entry.maturity] ?? '#60a5fa'} />
            ))}
          </Bar>
          <Bar yAxisId="right" dataKey="co2" name="CO₂ Reduction Mt/yr" fill="#34d399" />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-2">Bar colour = maturity: green=Commercial, amber=Demonstration, purple=Emerging</p>
    </div>
  )
}

// ── Chart 3 — Line: electrification_demand_twh by year for 3 scenarios ──────
function DemandScenarioChart({ data }: { data: INEAXDashboard['demand_projections'] }) {
  const years = Array.from(new Set(data.map(d => d.year))).sort()
  const scenarios = ['Base', 'Accelerated', 'Transformative']

  const chartData = years.map(yr => {
    const row: Record<string, unknown> = { year: yr }
    scenarios.forEach(sc => {
      const match = data.find(d => d.year === yr && d.scenario === sc)
      row[sc] = match ? match.electrification_demand_twh : null
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Industrial Electrification Demand (TWh) by Scenario 2024–2040
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" TWh" />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {scenarios.map(sc => (
            <Line
              key={sc}
              type="monotone"
              dataKey={sc}
              stroke={SCENARIO_COLOUR[sc]}
              strokeWidth={2}
              dot={false}
              name={`${sc} scenario`}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Chart 4 — Bar: estimated_cost_b by barrier_name, coloured by severity ───
function CostBarrierChart({ data }: { data: INEAXDashboard['cost_barriers'] }) {
  const chartData = [...data].sort((a, b) => b.estimated_cost_b - a.estimated_cost_b).map(b => ({
    name: b.barrier_name.length > 20 ? b.barrier_name.slice(0, 18) + '…' : b.barrier_name,
    fullName: b.barrier_name,
    cost: b.estimated_cost_b,
    severity: b.severity,
    sector: b.sector,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Cost Barriers (A$B) by Name, Coloured by Severity
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 120, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" B" />
          <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} width={115} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(value: number) => [`$${value.toFixed(2)}B`, 'Estimated Cost']}
          />
          <Bar dataKey="cost" name="Estimated Cost (A$B)" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={SEVERITY_COLOUR[entry.severity] ?? '#60a5fa'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-2">Red = High severity, Amber = Medium, Green = Low</p>
    </div>
  )
}

// ── Chart 5 — Bar: funding_m by program_name sorted desc ────────────────────
function PolicyFundingChart({ data }: { data: INEAXDashboard['policy_support'] }) {
  const chartData = [...data]
    .sort((a, b) => b.funding_m - a.funding_m)
    .map(p => ({
      name: p.program_name.length > 30 ? p.program_name.slice(0, 28) + '…' : p.program_name,
      fullName: p.program_name,
      funding: p.funding_m,
      body: p.administering_body,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Policy Program Funding (A$M), Sorted Descending
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 280, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" M" />
          <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={270} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(value: number) => [`$${value.toFixed(1)}M`, 'Funding']}
          />
          <Bar dataKey="funding" name="Funding A$M" fill="#60a5fa" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Summary dl grid ──────────────────────────────────────────────────────────
function SummaryGrid({ summary }: { summary: Record<string, unknown> }) {
  const rows = [
    { key: 'total_electrification_potential_pj', label: 'Total Electrification Potential', unit: 'PJ' },
    { key: 'total_abatement_mtco2',              label: 'Total Abatement Potential',         unit: 'MtCO₂' },
    { key: 'leading_sector',                     label: 'Leading Sector',                    unit: '' },
    { key: 'projected_demand_increase_twh_2030', label: 'Projected Demand Increase (2030)',  unit: 'TWh' },
    { key: 'top_technology',                     label: 'Top Technology',                    unit: '' },
  ]

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">Dashboard Summary</h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows.map(({ key, label, unit }) => (
          <div key={key} className="bg-gray-700/50 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</dt>
            <dd className="text-sm font-semibold text-white">
              {typeof summary[key] === 'number'
                ? `${(summary[key] as number).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`
                : String(summary[key] ?? '—')}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function IndustrialElectrificationXAnalytics() {
  const [data, setData] = useState<INEAXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getIndustrialElectrificationXDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <span className="animate-spin mr-2">&#9696;</span> Loading Industrial Electrification Analytics…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Failed to load data: {error ?? 'Unknown error'}
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Factory size={28} className="text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Industrial Electrification Analytics</h1>
          <p className="text-sm text-gray-400">
            Australian heavy industry decarbonisation pathways — NEM regions, ARENA &amp; CEFC programs
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Electrification Potential"
          value={`${(summary.total_electrification_potential_pj as number ?? 0).toFixed(0)} PJ`}
          sub="Total across all sectors & regions"
          Icon={Zap}
          colour="bg-amber-500"
        />
        <KpiCard
          label="Total Abatement"
          value={`${(summary.total_abatement_mtco2 as number ?? 0).toFixed(0)} MtCO₂`}
          sub="Combined abatement potential"
          Icon={Leaf}
          colour="bg-green-600"
        />
        <KpiCard
          label="Leading Sector"
          value={String(summary.leading_sector ?? '—')}
          sub="Highest abatement potential"
          Icon={Factory}
          colour="bg-indigo-600"
        />
        <KpiCard
          label="Demand Increase 2030"
          value={`${(summary.projected_demand_increase_twh_2030 as number ?? 0).toFixed(1)} TWh`}
          sub="Base scenario electrification demand"
          Icon={TrendingUp}
          colour="bg-blue-600"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectorElecPotentialChart data={data.sectors} />
        <TechnologyCapexCO2Chart data={data.technologies} />
      </div>

      {/* Demand scenario chart */}
      <DemandScenarioChart data={data.demand_projections} />

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CostBarrierChart data={data.cost_barriers} />
        <PolicyFundingChart data={data.policy_support} />
      </div>

      {/* Summary */}
      <SummaryGrid summary={summary} />

      {/* Top technology callout */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center gap-3">
        <DollarSign size={20} className="text-green-400 shrink-0" />
        <p className="text-sm text-gray-300">
          <span className="font-semibold text-white">Top technology by CO₂ reduction: </span>
          {String(summary.top_technology ?? '—')}
        </p>
      </div>
    </div>
  )
}
