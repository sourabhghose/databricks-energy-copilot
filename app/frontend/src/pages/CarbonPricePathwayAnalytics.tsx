import { useEffect, useState, useMemo } from 'react'
import { Leaf } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  LabelList,
} from 'recharts'
import {
  getCarbonPricePathwayDashboard,
  CPPDashboard,
  CPPScenarioRecord,
  CPPAbatementRecord,
} from '../api/client'

// ── Colours ──────────────────────────────────────────────────────────────────

const SCENARIO_COLORS: Record<string, string> = {
  'Net Zero 2050 (Paris-aligned)': '#34d399',
  'Accelerated Transition':        '#60a5fa',
  'Current Policy (Safeguard)':    '#fbbf24',
  'High Carbon Price':             '#f87171',
}

const TECH_COLORS: Record<string, string> = {
  COAL:       '#1f2937',
  BROWN_COAL: '#374151',
  GAS_CCGT:   '#f97316',
  GAS_OCGT:   '#fbbf24',
  WIND:       '#34d399',
  SOLAR:      '#fde68a',
}

const SECTOR_BADGE: Record<string, string> = {
  ELECTRICITY: 'bg-blue-700 text-blue-100',
  ALUMINIUM:   'bg-gray-600 text-gray-100',
  ALUMINA:     'bg-yellow-700 text-yellow-100',
  CHEMICALS:   'bg-purple-700 text-purple-100',
}

const MATURITY_COLOR: Record<string, string> = {
  COMMERCIAL:   '#34d399',
  EMERGING:     '#60a5fa',
  EARLY_STAGE:  '#f87171',
}

// ── Small components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

function SectorBadge({ sector }: { sector: string }) {
  const cls = SECTOR_BADGE[sector] ?? 'bg-gray-600 text-gray-100'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {sector}
    </span>
  )
}

// ── Carbon Price Pathway Chart ────────────────────────────────────────────────

function ScenarioPathwayChart({
  scenarios,
  selectedScenarios,
}: {
  scenarios: CPPScenarioRecord[]
  selectedScenarios: Set<string>
}) {
  // Pivot: group by year, one key per scenario
  const allScenarios = Array.from(new Set(scenarios.map(s => s.scenario_name)))
  const years = Array.from(new Set(scenarios.map(s => s.year))).sort((a, b) => a - b)

  const pivoted = useMemo(() => {
    const map: Record<number, Record<string, number>> = {}
    years.forEach(y => { map[y] = { year: y } as Record<string, number> })
    scenarios.forEach(s => {
      if (map[s.year]) map[s.year][s.scenario_name] = s.carbon_price_per_t
    })
    return years.map(y => map[y])
  }, [scenarios, years])

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={pivoted} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
        <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          formatter={(val: number, name: string) => [`$${val}/t`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#d1d5db' }} />
        {allScenarios.map(name =>
          selectedScenarios.has(name) ? (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={SCENARIO_COLORS[name] ?? '#94a3b8'}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ) : null
        )}
        <ReferenceLine y={28} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: '2024 baseline', fill: '#9ca3af', fontSize: 10 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Carbon Cost Pass-Through Chart ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PassthroughLabel = (props: any) => {
  const { x, y, width, value } = props
  if (value === undefined) return null
  return (
    <text x={x + width + 4} y={y + 10} fill="#9ca3af" fontSize={10}>
      {value}% pt
    </text>
  )
}

function PassthroughChart({ records }: { records: CPPDashboard['passthrough_records'] }) {
  const sorted = [...records].sort((a, b) => b.carbon_cost_per_mwh - a.carbon_cost_per_mwh)
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        layout="vertical"
        data={sorted}
        margin={{ top: 8, right: 80, left: 110, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
        <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
        <YAxis type="category" dataKey="generator_name" stroke="#9ca3af" tick={{ fontSize: 11 }} width={105} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          formatter={(val: number) => [`$${val}/MWh`, 'Carbon cost']}
        />
        <Bar dataKey="carbon_cost_per_mwh" radius={[0, 4, 4, 0]}>
          {sorted.map(r => (
            <Cell key={r.generator_name} fill={TECH_COLORS[r.technology] ?? '#6b7280'} />
          ))}
          <LabelList dataKey="passthrough_rate_pct" content={PassthroughLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Marginal Abatement Cost Curve ─────────────────────────────────────────────

function MaccChart({ options }: { options: CPPAbatementRecord[] }) {
  // Sort ascending by cost, compute cumulative potential
  const sorted = [...options].sort((a, b) => a.cost_per_t_co2 - b.cost_per_t_co2)
  let cumulative = 0
  const chartData = sorted.map(o => {
    const start = cumulative
    cumulative += o.potential_mt_pa
    return { ...o, cumulative_start: start, cumulative_end: cumulative }
  })

  // Use a simple bar chart with each bar representing one option's potential width
  // We'll use a BarChart with the potential_mt_pa as value and cost as the category
  const barData = chartData.map(o => ({
    name: o.abatement_option.length > 20 ? o.abatement_option.slice(0, 18) + '…' : o.abatement_option,
    fullName: o.abatement_option,
    cost: o.cost_per_t_co2,
    potential: o.potential_mt_pa,
    maturity: o.maturity,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={barData} margin={{ top: 10, right: 20, left: 10, bottom: 70 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-35} textAnchor="end" interval={0} />
        <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} label={{ value: '$/t CO₂', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          formatter={(val: number, _name: string, props: { payload?: { fullName?: string; potential?: number; maturity?: string } }) => {
            const p = props.payload ?? {}
            return [`$${val}/t CO₂ | ${p.potential ?? ''}Mt/pa | ${p.maturity ?? ''}`, p.fullName ?? '']
          }}
        />
        <ReferenceLine y={0} stroke="#6b7280" />
        <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
          {barData.map(d => (
            <Cell
              key={d.name}
              fill={d.cost < 0 ? '#34d399' : (MATURITY_COLOR[d.maturity] ?? '#60a5fa')}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CarbonPricePathwayAnalytics() {
  const [data, setData] = useState<CPPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(
    new Set([
      'Net Zero 2050 (Paris-aligned)',
      'Accelerated Transition',
      'Current Policy (Safeguard)',
      'High Carbon Price',
    ])
  )

  useEffect(() => {
    getCarbonPricePathwayDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  const toggleScenario = (name: string) => {
    setSelectedScenarios(prev => {
      const next = new Set(prev)
      if (next.has(name)) { next.delete(name) } else { next.add(name) }
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading carbon price pathway data...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  const allScenarioNames = Array.from(new Set(data.scenarios.map(s => s.scenario_name)))
  const summary = data.summary as Record<string, number>

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-900/40 rounded-lg">
          <Leaf size={24} className="text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Carbon Price Pathway Analytics</h1>
          <p className="text-sm text-gray-400">
            Australia NEM — Safeguard Mechanism trajectory, carbon cost pass-through &amp; abatement options
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Carbon Scenarios"
          value={String(summary.scenarios ?? 4)}
          sub="2024 – 2050 pathways"
        />
        <KpiCard
          label="2024 Carbon Price"
          value={`$${summary.carbon_price_2024_per_t ?? 28}/t`}
          sub="Safeguard baseline year"
        />
        <KpiCard
          label="2030 Central Price"
          value={`$${summary.carbon_price_2030_per_t_central ?? 53}/t`}
          sub="Net Zero 2050 scenario"
        />
        <KpiCard
          label="Facilities in Deficit"
          value={String(summary.facilities_in_deficit ?? 3)}
          sub={`of ${summary.safeguard_facilities ?? 8} tracked facilities`}
        />
      </div>

      {/* Carbon Price Pathway Chart */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-white">Carbon Price Pathways (2024 – 2050)</h2>
          <div className="flex flex-wrap gap-2">
            {allScenarioNames.map(name => (
              <button
                key={name}
                onClick={() => toggleScenario(name)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedScenarios.has(name)
                    ? 'border-transparent text-gray-900'
                    : 'border-gray-600 text-gray-400 bg-transparent'
                }`}
                style={selectedScenarios.has(name) ? { backgroundColor: SCENARIO_COLORS[name] ?? '#6b7280' } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: SCENARIO_COLORS[name] ?? '#6b7280', opacity: selectedScenarios.has(name) ? 1 : 0.4 }}
                />
                {name}
              </button>
            ))}
          </div>
        </div>
        <ScenarioPathwayChart scenarios={data.scenarios} selectedScenarios={selectedScenarios} />
        <p className="text-xs text-gray-500 mt-2">
          Carbon price $/t CO₂-e. Dashed line = 2024 Safeguard baseline. Secondary impact: electricity price = carbon price x 0.65 t/MWh x 80% pass-through.
        </p>
      </div>

      {/* Safeguard Facilities Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">Safeguard Mechanism Facilities</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-left text-gray-400 text-xs uppercase tracking-wide">
                <th className="pb-2 pr-3 font-medium">Facility</th>
                <th className="pb-2 pr-3 font-medium">Sector</th>
                <th className="pb-2 pr-3 font-medium">State</th>
                <th className="pb-2 pr-3 font-medium text-right">Baseline (kt)</th>
                <th className="pb-2 pr-3 font-medium text-right">Actual (kt)</th>
                <th className="pb-2 pr-3 font-medium text-right">Surplus/Deficit</th>
                <th className="pb-2 pr-3 font-medium text-right">ACCUs</th>
                <th className="pb-2 pr-3 font-medium text-right">Cost ($M)</th>
                <th className="pb-2 font-medium">Abatement Pathway</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.safeguard_facilities.map(f => (
                <tr key={f.facility_name} className="hover:bg-gray-750 transition-colors">
                  <td className="py-2 pr-3 text-white font-medium">{f.facility_name}</td>
                  <td className="py-2 pr-3">
                    <SectorBadge sector={f.sector} />
                  </td>
                  <td className="py-2 pr-3 text-gray-300">{f.state}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">
                    {f.baseline_kt_co2e.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-300">
                    {f.actual_emissions_kt_co2e.toLocaleString()}
                  </td>
                  <td className={`py-2 pr-3 text-right font-semibold ${f.surplus_deficit_kt >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {f.surplus_deficit_kt >= 0 ? '+' : ''}{f.surplus_deficit_kt.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-300">
                    {f.accu_purchased > 0 ? f.accu_purchased.toLocaleString() : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-300">
                    {f.accu_cost_m > 0 ? `$${f.accu_cost_m.toFixed(1)}M` : '—'}
                  </td>
                  <td className="py-2 text-gray-400 text-xs max-w-xs">
                    <span title={f.abatement_pathway}>
                      {f.abatement_pathway.length > 45
                        ? f.abatement_pathway.slice(0, 43) + '…'
                        : f.abatement_pathway}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Carbon Cost Pass-Through + MACC side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pass-Through Chart */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-1">Carbon Cost Pass-Through by Generator</h2>
          <p className="text-xs text-gray-400 mb-4">
            Bar width = carbon cost ($/MWh). Label = pass-through rate %.
          </p>
          <PassthroughChart records={data.passthrough_records} />
          {/* Technology legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.entries(TECH_COLORS).map(([tech, color]) => (
              <span key={tech} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
                {tech.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>

        {/* MACC Chart */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-1">Marginal Abatement Cost Curve</h2>
          <p className="text-xs text-gray-400 mb-4">
            Sorted by cost ($/t CO₂). Green = negative cost (co-benefit). Bar height = abatement cost.
          </p>
          <MaccChart options={data.abatement_options} />
          {/* Maturity legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.entries(MATURITY_COLOR).map(([m, color]) => (
              <span key={m} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
                {m}
              </span>
            ))}
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block bg-green-400" />
              NEGATIVE COST
            </span>
          </div>
        </div>
      </div>

      {/* Abatement Options Summary Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">Abatement Options — Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-left text-gray-400 text-xs uppercase tracking-wide">
                <th className="pb-2 pr-3 font-medium">Option</th>
                <th className="pb-2 pr-3 font-medium">Sector</th>
                <th className="pb-2 pr-3 font-medium text-right">Cost ($/t)</th>
                <th className="pb-2 pr-3 font-medium text-right">Potential (Mt/pa)</th>
                <th className="pb-2 pr-3 font-medium">Maturity</th>
                <th className="pb-2 pr-3 font-medium text-right">Timeline (yrs)</th>
                <th className="pb-2 font-medium">NEM Relevant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {[...data.abatement_options]
                .sort((a, b) => a.cost_per_t_co2 - b.cost_per_t_co2)
                .map(o => (
                  <tr key={o.abatement_option} className="hover:bg-gray-750 transition-colors">
                    <td className="py-2 pr-3 text-white font-medium">{o.abatement_option}</td>
                    <td className="py-2 pr-3 text-gray-400">{o.sector}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${o.cost_per_t_co2 < 0 ? 'text-green-400' : 'text-gray-300'}`}>
                      {o.cost_per_t_co2 < 0 ? '' : '+'}${o.cost_per_t_co2}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-300">{o.potential_mt_pa}</td>
                    <td className="py-2 pr-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          backgroundColor: (MATURITY_COLOR[o.maturity] ?? '#6b7280') + '33',
                          color: MATURITY_COLOR[o.maturity] ?? '#6b7280',
                        }}
                      >
                        {o.maturity}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-300">{o.timeline_years}</td>
                    <td className="py-2">
                      {o.nem_relevant
                        ? <span className="text-green-400 font-medium">Yes</span>
                        : <span className="text-gray-500">No</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-500 pb-4">
        Data: Safeguard Mechanism (DCCEEW), ACCU spot prices (CER), NEM carbon intensity (AEMO), abatement costs indicative. Sprint 69c.
      </p>
    </div>
  )
}
