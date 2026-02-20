import React, { useEffect, useState } from 'react'
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
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import {
  api,
  StorageLcaDashboard,
  StorageLcaRecord,
  CriticalMineralRecord,
  RecyclingRecord,
  LcaScenarioRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Palette & display maps
// ---------------------------------------------------------------------------

const TECH_COLORS: Record<string, string> = {
  'Li-Ion NMC':            '#3b82f6',
  'LFP':                   '#22c55e',
  'NMC 811':               '#0d9488',
  'Na-Ion':                '#8b5cf6',
  'Flow Battery Vanadium': '#f59e0b',
  'Compressed Air':        '#6b7280',
  'Pumped Hydro':          '#06b6d4',
  'Gravity Storage':       '#1e293b',
}

const SUPPLY_RISK_BADGE: Record<string, string> = {
  LOW:      'bg-green-700 text-green-100',
  MEDIUM:   'bg-amber-700 text-amber-100',
  HIGH:     'bg-orange-700 text-orange-100',
  CRITICAL: 'bg-red-700 text-red-100',
}

const PRICE_TREND_BADGE: Record<string, string> = {
  RISING:  'bg-red-800 text-red-100',
  STABLE:  'bg-gray-700 text-gray-100',
  FALLING: 'bg-green-800 text-green-100',
}

const CE_BADGE: Record<string, string> = {
  LOW:    'bg-gray-700 text-gray-200',
  MEDIUM: 'bg-amber-700 text-amber-100',
  HIGH:   'bg-green-700 text-green-100',
}

const MATURITY_BADGE: Record<string, string> = {
  EMERGING:   'bg-blue-700 text-blue-100',
  PILOT:      'bg-amber-700 text-amber-100',
  COMMERCIAL: 'bg-green-700 text-green-100',
  MATURE:     'bg-gray-600 text-gray-100',
}

const PROCESS_DISPLAY: Record<string, string> = {
  HYDROMET:        'Hydromet',
  PYRMET:          'Pyrometallurgy',
  DIRECT_RECYCLING:'Direct Recycling',
  REMANUFACTURING: 'Remanufacturing',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt1(v: number): string { return v.toFixed(1) }
function fmt2(v: number): string { return v.toFixed(2) }

function Badge({
  label,
  className,
}: {
  label: string
  className: string
}) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lifecycle Carbon Stacked Bar Chart
// ---------------------------------------------------------------------------

function LifecycleCarbonChart({ records }: { records: StorageLcaRecord[] }) {
  const data = [...records]
    .sort((a, b) => a.total_lifecycle_kgco2_kwh - b.total_lifecycle_kgco2_kwh)
    .map(r => ({
      name: r.technology_name,
      Embodied: r.embodied_carbon_kgco2_kwh,
      Operational: r.operational_carbon_kgco2_kwh,
      'End-of-Life': r.eol_carbon_kgco2_kwh,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">
        Lifecycle Carbon by Phase (kgCO₂/kWh) — sorted by total
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 16 }} />
          <Bar dataKey="Embodied"     stackId="a" fill="#3b82f6" />
          <Bar dataKey="Operational"  stackId="a" fill="#f59e0b" />
          <Bar dataKey="End-of-Life"  stackId="a" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LCA Scenario Line Chart
// ---------------------------------------------------------------------------

function LcaScenarioChart({ scenarios }: { scenarios: LcaScenarioRecord[] }) {
  // Build data: years as rows, one series per technology (CURRENT + 2030_GRID_CLEAN)
  const targetScenarios = ['CURRENT', '2030_GRID_CLEAN', '2035_GREEN_MANUFACTURING']
  const years = [...new Set(scenarios.map(s => s.year))].sort()
  const technologies = [...new Set(scenarios.map(s => s.technology))]

  // Build chart rows: one per (year, scenario) but only for the two primary scenarios
  // Represent as one series per technology spanning years
  // Group by technology+scenario but use year on X
  // Simpler: one line per technology, X axis = year, we use scenario CURRENT for 2024 and 2030_GRID_CLEAN for later
  // Actually we'll show CURRENT + 2030_GRID_CLEAN as separate dotted series
  // Best: pivot to year rows, columns = "Tech (Scenario)"

  const SHOWN_SCENARIOS = ['CURRENT', '2030_GRID_CLEAN']

  const yearData = years.map(yr => {
    const row: Record<string, number | string> = { year: yr }
    technologies.forEach(tech => {
      SHOWN_SCENARIOS.forEach(sc => {
        const match = scenarios.find(s => s.year === yr && s.technology === tech && s.scenario === sc)
        if (match) {
          row[`${tech} (${sc === 'CURRENT' ? 'Current' : '2030'})`] = match.lifecycle_carbon_kgco2_kwh
        }
      })
    })
    return row
  })

  const keys: string[] = []
  technologies.forEach(t => {
    SHOWN_SCENARIOS.forEach(sc => {
      const label = `${t} (${sc === 'CURRENT' ? 'Current' : '2030'})`
      if (yearData.some(r => r[label] !== undefined)) keys.push(label)
    })
  })

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-1">
        LCA Carbon Reduction Trajectory (kgCO₂/kWh)
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Current grid vs. 2030 clean grid manufacturing assumptions
      </p>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={yearData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {technologies.map(tech => (
            <React.Fragment key={tech}>
              <Line
                key={`${tech}-current`}
                type="monotone"
                dataKey={`${tech} (Current)`}
                stroke={TECH_COLORS[tech] ?? '#888'}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                key={`${tech}-2030`}
                type="monotone"
                dataKey={`${tech} (2030)`}
                stroke={TECH_COLORS[tech] ?? '#888'}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={{ r: 3 }}
              />
            </React.Fragment>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Critical Minerals Table
// ---------------------------------------------------------------------------

function CriticalMineralsTable({ minerals }: { minerals: CriticalMineralRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Critical Mineral Supply Chain</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300 border-collapse">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="pb-2 pr-3 font-medium">Mineral</th>
              <th className="pb-2 pr-3 font-medium">Technology</th>
              <th className="pb-2 pr-3 font-medium text-right">Content (kg/kWh)</th>
              <th className="pb-2 pr-3 font-medium text-right">AU Reserves %</th>
              <th className="pb-2 pr-3 font-medium">Supply Risk</th>
              <th className="pb-2 pr-3 font-medium text-right">Price ($/kg)</th>
              <th className="pb-2 pr-3 font-medium">Trend</th>
              <th className="pb-2 pr-3 font-medium text-right">Recycling %</th>
              <th className="pb-2 font-medium">CE Potential</th>
            </tr>
          </thead>
          <tbody>
            {minerals.map((m, i) => (
              <tr
                key={i}
                className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-2 pr-3 font-semibold text-white">{m.mineral}</td>
                <td className="py-2 pr-3">{m.technology}</td>
                <td className="py-2 pr-3 text-right font-mono">{fmt2(m.content_kg_kwh)}</td>
                <td className="py-2 pr-3 text-right font-mono">{fmt1(m.australian_reserves_pct)}%</td>
                <td className="py-2 pr-3">
                  <Badge label={m.supply_risk} className={SUPPLY_RISK_BADGE[m.supply_risk] ?? 'bg-gray-700 text-white'} />
                </td>
                <td className="py-2 pr-3 text-right font-mono">
                  {m.price_usd_kg >= 1000
                    ? `$${(m.price_usd_kg / 1000).toFixed(1)}k`
                    : `$${fmt1(m.price_usd_kg)}`}
                </td>
                <td className="py-2 pr-3">
                  <Badge label={m.price_trend} className={PRICE_TREND_BADGE[m.price_trend] ?? 'bg-gray-700 text-white'} />
                </td>
                <td className="py-2 pr-3 text-right font-mono">{fmt1(m.recycling_rate_pct)}%</td>
                <td className="py-2">
                  <Badge
                    label={m.circular_economy_potential}
                    className={CE_BADGE[m.circular_economy_potential] ?? 'bg-gray-700 text-white'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recycling Technology Table
// ---------------------------------------------------------------------------

function RecyclingTable({ records }: { records: RecyclingRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">End-of-Life Recycling Technologies</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300 border-collapse">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="pb-2 pr-3 font-medium">Technology</th>
              <th className="pb-2 pr-3 font-medium">Process</th>
              <th className="pb-2 pr-3 font-medium text-right">Recovery %</th>
              <th className="pb-2 pr-3 font-medium text-right">Cost ($/kWh)</th>
              <th className="pb-2 pr-3 font-medium text-right">Carbon Benefit</th>
              <th className="pb-2 pr-3 font-medium">Maturity</th>
              <th className="pb-2 font-medium">Key Players</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr
                key={i}
                className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-2 pr-3 font-semibold text-white">{r.technology}</td>
                <td className="py-2 pr-3">
                  <Badge
                    label={PROCESS_DISPLAY[r.recycling_process] ?? r.recycling_process}
                    className="bg-gray-700 text-gray-200"
                  />
                </td>
                <td className="py-2 pr-3 text-right font-mono">{fmt1(r.recovery_efficiency_pct)}%</td>
                <td className="py-2 pr-3 text-right font-mono">${fmt1(r.cost_per_kwh)}</td>
                <td className="py-2 pr-3 text-right font-mono text-green-400">
                  -{fmt1(r.carbon_benefit_kgco2_kwh)} kg
                </td>
                <td className="py-2 pr-3">
                  <Badge
                    label={r.commercial_maturity}
                    className={MATURITY_BADGE[r.commercial_maturity] ?? 'bg-gray-700 text-white'}
                  />
                </td>
                <td className="py-2 text-gray-400">{r.key_players.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function StorageLca() {
  const [dashboard, setDashboard] = useState<StorageLcaDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getStorageLcaDashboard()
      .then(d => { setDashboard(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Loading Storage LCA data…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="p-8 text-red-400">
        Failed to load Storage LCA data: {error}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 text-white min-h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-start gap-3">
        <RefreshCw className="text-green-400 mt-1 shrink-0" size={24} />
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">
            Energy Storage Life Cycle Assessment &amp; Sustainability
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Cradle-to-grave environmental impact of battery storage technologies — embodied carbon,
            critical mineral supply chains, end-of-life recycling, and circular economy potential
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Best Lifecycle Technology"
          value={dashboard.best_lifecycle_technology}
          sub="Lowest cradle-to-grave carbon"
          accent="text-green-400"
        />
        <KpiCard
          label="Avg Recyclability"
          value={`${fmt1(dashboard.avg_recyclability_pct)}%`}
          sub="Across all assessed technologies"
          accent="text-blue-400"
        />
        <KpiCard
          label="Critical Minerals at Risk"
          value={String(dashboard.critical_minerals_at_risk)}
          sub="HIGH or CRITICAL supply risk"
          accent="text-orange-400"
        />
        <KpiCard
          label="Technologies Assessed"
          value={String(dashboard.total_technologies_assessed)}
          sub="Storage technologies in scope"
          accent="text-purple-400"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LifecycleCarbonChart records={dashboard.lca_records} />
        <LcaScenarioChart scenarios={dashboard.lca_scenarios} />
      </div>

      {/* LCA Detail Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">
          Full Lifecycle Assessment Details
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300 border-collapse">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="pb-2 pr-3 font-medium">Technology</th>
                <th className="pb-2 pr-3 font-medium">Duration</th>
                <th className="pb-2 pr-3 font-medium text-right">Embodied</th>
                <th className="pb-2 pr-3 font-medium text-right">Operational</th>
                <th className="pb-2 pr-3 font-medium text-right">EOL</th>
                <th className="pb-2 pr-3 font-medium text-right">Total LC</th>
                <th className="pb-2 pr-3 font-medium text-right">Payback (yr)</th>
                <th className="pb-2 pr-3 font-medium text-right">Water (L/kWh)</th>
                <th className="pb-2 pr-3 font-medium text-right">Recyclability</th>
                <th className="pb-2 pr-3 font-medium text-right">Life (yr)</th>
                <th className="pb-2 font-medium text-right">RTE %</th>
              </tr>
            </thead>
            <tbody>
              {[...dashboard.lca_records]
                .sort((a, b) => a.total_lifecycle_kgco2_kwh - b.total_lifecycle_kgco2_kwh)
                .map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="py-2 pr-3">
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: TECH_COLORS[r.technology_name] ?? '#888' }}
                      />
                      <span className="font-semibold text-white">{r.technology_name}</span>
                    </td>
                    <td className="py-2 pr-3 text-gray-400 text-xs">
                      {r.capacity_category.replace('_', ' ')}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{fmt1(r.embodied_carbon_kgco2_kwh)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{fmt1(r.operational_carbon_kgco2_kwh)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{fmt1(r.eol_carbon_kgco2_kwh)}</td>
                    <td className="py-2 pr-3 text-right font-mono font-bold text-blue-300">
                      {fmt1(r.total_lifecycle_kgco2_kwh)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{fmt1(r.energy_payback_years)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{fmt1(r.water_use_l_kwh)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-green-400">
                      {fmt1(r.recyclability_pct)}%
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{r.design_life_years}</td>
                    <td className="py-2 text-right font-mono">{fmt1(r.round_trip_efficiency_pct)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Critical Minerals */}
      <CriticalMineralsTable minerals={dashboard.critical_minerals} />

      {/* Recycling Technologies */}
      <RecyclingTable records={dashboard.recycling_records} />
    </div>
  )
}
