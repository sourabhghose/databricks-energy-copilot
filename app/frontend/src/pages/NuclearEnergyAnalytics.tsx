import { useEffect, useState } from 'react'
import { Atom } from 'lucide-react'
import {
  getNuclearEnergyDashboard,
  NEADashboard,
  NEASmrRecord,
  NEAPolicyRecord,
  NEACostProjectionRecord,
  NEACapacityScenarioRecord,
} from '../api/client'
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
} from 'recharts'

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  sub,
  valueColor,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold" style={{ color: valueColor ?? '#fff' }}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMMERCIAL: 'bg-green-900 text-green-300',
    LICENSED: 'bg-blue-900 text-blue-300',
    LICENSING: 'bg-blue-800 text-blue-200',
    DEVELOPMENT: 'bg-yellow-900 text-yellow-300',
    PROTOTYPE: 'bg-orange-900 text-orange-300',
  }
  const cls = styles[status] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

// ── Category Badge ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    POLICY: 'bg-purple-900 text-purple-300',
    REPORT: 'bg-gray-700 text-gray-300',
    INQUIRY: 'bg-blue-900 text-blue-300',
    REGULATION: 'bg-amber-900 text-amber-300',
    DEFENCE: 'bg-red-900 text-red-300',
    STUDY: 'bg-teal-900 text-teal-300',
    LEGISLATION: 'bg-indigo-900 text-indigo-300',
    CONSULTATION: 'bg-pink-900 text-pink-300',
  }
  const cls = styles[category] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {category}
    </span>
  )
}

// ── Sentiment color helper ────────────────────────────────────────────────────

function sentimentColor(sentiment: string): string {
  if (sentiment === 'POSITIVE') return 'text-green-400'
  if (sentiment === 'NEGATIVE') return 'text-red-400'
  return 'text-gray-400'
}

function sentimentDot(sentiment: string): string {
  if (sentiment === 'POSITIVE') return 'bg-green-400'
  if (sentiment === 'NEGATIVE') return 'bg-red-400'
  return 'bg-gray-400'
}

// ── Technology colors for charts ──────────────────────────────────────────────

const TECH_COLORS: Record<string, string> = {
  'Large Nuclear AP1000': '#60a5fa',
  'SMR BWRX-300': '#34d399',
  'Advanced SMR (2030s)': '#a78bfa',
  'Offshore Wind (comparison)': '#fbbf24',
  'Utility Solar + Storage': '#f87171',
}

const CAPACITY_COLORS: Record<string, string> = {
  nuclear_gw: '#60a5fa',
  coal_gw: '#6b7280',
  gas_gw: '#f59e0b',
  wind_gw: '#34d399',
  solar_gw: '#fbbf24',
  storage_gw: '#a78bfa',
}

// ── SMR Technologies Table ────────────────────────────────────────────────────

function SmrTable({ technologies }: { technologies: NEASmrRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">SMR Technology Landscape</h2>
        <p className="text-xs text-gray-400 mt-1">Global small modular reactor candidates for Australian deployment</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Technology</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Vendor</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Capacity (MW)</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">CapEx ($/kW)</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">LCOE ($/MWh)</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Cap. Factor (%)</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Lead Time (yrs)</th>
              <th className="text-center px-4 py-3 text-gray-400 font-medium">FOAK</th>
              <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {technologies.map((t, i) => (
              <tr
                key={t.technology}
                className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'}`}
              >
                <td className="px-4 py-3 text-white font-medium">{t.technology}</td>
                <td className="px-4 py-3 text-gray-300">{t.vendor}</td>
                <td className="px-4 py-3 text-right text-gray-200">{t.capacity_mw.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-200">${t.capex_per_kw.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <span className={t.lcoe_per_mwh > 150 ? 'text-red-400' : t.lcoe_per_mwh > 120 ? 'text-yellow-400' : 'text-green-400'}>
                    ${t.lcoe_per_mwh}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-200">{t.capacity_factor_pct}%</td>
                <td className="px-4 py-3 text-right text-gray-200">{t.lead_time_years}</td>
                <td className="px-4 py-3 text-center">
                  {t.first_of_kind ? (
                    <span className="text-orange-400 font-medium">FOAK</span>
                  ) : (
                    <span className="text-green-400">Nth</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Policy Timeline ───────────────────────────────────────────────────────────

function PolicyTimeline({ events }: { events: NEAPolicyRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Australian Nuclear Policy Timeline</h2>
        <p className="text-xs text-gray-400 mt-1">Key legislative and regulatory milestones in Australia's nuclear energy debate</p>
      </div>
      <div className="px-6 py-4">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />
          <div className="space-y-6">
            {events.map((ev) => (
              <div key={ev.id} className="relative pl-12">
                {/* Dot */}
                <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-gray-800 ${sentimentDot(ev.sentiment)}`} />
                <div className="bg-gray-750 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-gray-400">{ev.date}</span>
                    <CategoryBadge category={ev.category} />
                    <span className="text-xs text-gray-500">{ev.jurisdiction}</span>
                    <span className={`text-xs font-medium ml-auto ${sentimentColor(ev.sentiment)}`}>
                      {ev.sentiment}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white mb-1">{ev.event}</p>
                  <p className="text-xs text-gray-400 mb-3">{ev.description}</p>
                  {/* Impact score bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20">Impact score</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${(ev.impact_score / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-6 text-right">{ev.impact_score}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── LCOE Cost Projections Chart ───────────────────────────────────────────────

function CostProjectionsChart({ projections }: { projections: NEACostProjectionRecord[] }) {
  const technologies = Array.from(new Set(projections.map((p) => p.technology)))

  // Pivot: year -> { technology: lcoe_mid }
  const pivoted: Record<number, Record<string, number>> = {}
  for (const p of projections) {
    if (!pivoted[p.year]) pivoted[p.year] = { year: p.year }
    pivoted[p.year][p.technology] = p.lcoe_mid
  }
  const chartData = Object.values(pivoted).sort((a, b) => (a['year'] as number) - (b['year'] as number))

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">LCOE Cost Projections ($/MWh)</h2>
        <p className="text-xs text-gray-400 mt-1">Levelised cost of energy trajectories 2025-2050 — mid-case estimates</p>
      </div>
      <div className="px-4 py-4">
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="year"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              stroke="#4b5563"
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              stroke="#4b5563"
              tickFormatter={(v) => `$${v}`}
              domain={[0, 220]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(value: number) => [`$${value}/MWh`, '']}
            />
            <Legend
              wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: '#9ca3af' }}
            />
            <ReferenceLine
              y={155}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: 'CSIRO est. $155', fill: '#f59e0b', fontSize: 11, position: 'insideTopRight' }}
            />
            {technologies.map((tech) => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                stroke={TECH_COLORS[tech] ?? '#6b7280'}
                strokeWidth={2}
                dot={{ r: 4, fill: TECH_COLORS[tech] ?? '#6b7280' }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Capacity Scenario Chart ───────────────────────────────────────────────────

function CapacityScenarioChart({ scenarios }: { scenarios: NEACapacityScenarioRecord[] }) {
  const allScenarios = Array.from(new Set(scenarios.map((s) => s.scenario)))
  const [selectedScenario, setSelectedScenario] = useState(allScenarios[0] ?? '')

  const filtered = scenarios.filter((s) => s.scenario === selectedScenario)
  const chartData = filtered.map((s) => ({
    year: s.year,
    'Nuclear': s.nuclear_gw,
    'Coal': s.coal_gw,
    'Gas': s.gas_gw,
    'Wind': s.wind_gw,
    'Solar': s.solar_gw,
    'Storage': s.storage_gw,
  }))

  const bars: { key: string; color: string }[] = [
    { key: 'Nuclear', color: CAPACITY_COLORS['nuclear_gw'] },
    { key: 'Coal', color: CAPACITY_COLORS['coal_gw'] },
    { key: 'Gas', color: CAPACITY_COLORS['gas_gw'] },
    { key: 'Wind', color: CAPACITY_COLORS['wind_gw'] },
    { key: 'Solar', color: CAPACITY_COLORS['solar_gw'] },
    { key: 'Storage', color: CAPACITY_COLORS['storage_gw'] },
  ]

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Capacity Mix Scenarios (GW)</h2>
          <p className="text-xs text-gray-400 mt-1">Australian electricity generation capacity under different nuclear deployment pathways</p>
        </div>
        <select
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {allScenarios.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="px-4 py-4">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="year"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              stroke="#4b5563"
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              stroke="#4b5563"
              tickFormatter={(v) => `${v} GW`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(value: number) => [`${value} GW`, '']}
            />
            <Legend
              wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: '#9ca3af' }}
            />
            {bars.map((b) => (
              <Bar key={b.key} dataKey={b.key} stackId="mix" fill={b.color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Scenario comparison pills */}
      <div className="px-6 pb-4 flex flex-wrap gap-2">
        {allScenarios.map((s) => (
          <button
            key={s}
            onClick={() => setSelectedScenario(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedScenario === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NuclearEnergyAnalytics() {
  const [data, setData] = useState<NEADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNuclearEnergyDashboard()
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message ?? 'Failed to load data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Atom className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading Nuclear Energy Pathway Analytics...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 border border-red-800 text-center max-w-md">
          <p className="text-red-400 font-semibold mb-2">Failed to load data</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const summary = data.summary

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-blue-900 rounded-lg">
            <Atom className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Nuclear Energy Pathway Analytics</h1>
            <p className="text-sm text-gray-400">
              Australia's nuclear energy policy debate, SMR technology pathways & cost trajectories
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-orange-900 text-orange-300 font-medium">
            Legislative Barrier: {String(summary['legislative_barrier'])}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 font-medium">
            Sprint 67a
          </span>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="SMR Technologies Tracked"
            value={String(summary['smr_technologies_tracked'])}
            unit="reactors"
            sub="Global candidate pool"
            valueColor="#60a5fa"
          />
          <KpiCard
            label="Earliest Online (Optimistic)"
            value={String(summary['earliest_possible_online'])}
            sub="Subject to legislation passing"
            valueColor="#34d399"
          />
          <KpiCard
            label="CSIRO LCOE Estimate"
            value={`$${String(summary['csiro_lcoe_estimate_per_mwh'])}`}
            unit="/MWh"
            sub="GenCost 2024 — most expensive new entrant"
            valueColor="#fbbf24"
          />
          <KpiCard
            label="Legislative Barrier"
            value="ARPANS Act"
            unit="1998"
            sub="Section 10 — prohibits civil nuclear"
            valueColor="#f87171"
          />
        </div>

        {/* SMR Table */}
        <SmrTable technologies={data.smr_technologies} />

        {/* Policy Timeline + Cost Chart */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <PolicyTimeline events={data.policy_timeline} />
          <CostProjectionsChart projections={data.cost_projections} />
        </div>

        {/* Capacity Scenarios */}
        <CapacityScenarioChart scenarios={data.capacity_scenarios} />

        {/* Footer note */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 px-6 py-4">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-400">Data note:</span> Cost projections based on published vendor estimates, CSIRO GenCost 2024, and IRENA learning curve analysis.
            SMR costs include first-of-a-kind (FOAK) premiums. All figures in real 2024 AUD unless stated. Scenario modelling is illustrative only.
          </p>
        </div>
      </div>
    </div>
  )
}
