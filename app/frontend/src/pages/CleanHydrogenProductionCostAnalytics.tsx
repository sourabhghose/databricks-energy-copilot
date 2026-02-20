import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Flame, Zap, Calendar, TrendingDown, Globe } from 'lucide-react'
import {
  getCleanHydrogenProductionCostDashboard,
  LCOHDashboard,
  LCOHProductionRouteRecord,
  LCOHProjectRecord,
  LCOHElectrolyserRecord,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const COLOUR_PALETTE: Record<string, string> = {
  GREEN:     '#4ade80',
  BLUE:      '#60a5fa',
  GREY:      '#9ca3af',
  TURQUOISE: '#2dd4bf',
}

const STATUS_COLOURS: Record<string, string> = {
  OPERATIONAL:  'bg-green-700',
  CONSTRUCTION: 'bg-yellow-700',
  APPROVED:     'bg-blue-700',
  FEASIBILITY:  'bg-purple-700',
  PROPOSED:     'bg-gray-600',
}

const SECTOR_COLOURS: Record<string, string> = {
  EXPORT:     '#22d3ee',
  AMMONIA:    '#f472b6',
  STEEL:      '#fb923c',
  TRANSPORT:  '#facc15',
  POWER:      '#4ade80',
  INDUSTRIAL: '#a78bfa',
}

const COST_COMPONENT_COLOURS: Record<string, string> = {
  electricity_cost_aud_per_kg: '#facc15',
  capex_cost_aud_per_kg:       '#60a5fa',
  opex_cost_aud_per_kg:        '#f472b6',
  water_cost_aud_per_kg:       '#2dd4bf',
  co2_cost_aud_per_kg:         '#f87171',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, Icon }: {
  label: string; value: string; sub?: string; Icon: React.ElementType
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow-lg">
      <div className="p-3 bg-gray-700 rounded-lg">
        <Icon className="w-6 h-6 text-cyan-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, colourClass }: { label: string; colourClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold text-white ${colourClass}`}>
      {label}
    </span>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">
      {title}
    </h2>
  )
}

// ─── Production Route Chart Data ──────────────────────────────────────────────
function buildRouteChartData(routes: LCOHProductionRouteRecord[]) {
  return routes.map(r => ({
    name: r.name.replace('H2 - ', '').replace(' Electrolysis', ''),
    lcoh: r.lcoh_aud_per_kg,
    colour: COLOUR_PALETTE[r.colour] ?? '#9ca3af',
    co2: r.co2_intensity_kgco2_per_kg,
    trl: r.trl,
  }))
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CleanHydrogenProductionCostAnalytics() {
  const [data, setData] = useState<LCOHDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCleanHydrogenProductionCostDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading hydrogen cost data...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400">Error: {error ?? 'No data'}</p>
      </div>
    )
  }

  const summary = data.summary as Record<string, number>

  // Cost breakdown for Green H2 PEM (WA only, 2024-2035)
  const greenPemWABreakdowns = data.cost_breakdowns
    .filter(cb => cb.route === 'Green H2 - PEM' && cb.region === 'WA')
    .sort((a, b) => a.year - b.year)

  // Demand projections pivoted by sector
  const demandYears = [2025, 2030, 2035, 2040]
  const demandChartData = demandYears.map(yr => {
    const row: Record<string, number | string> = { year: yr.toString() }
    const sectorList = ['EXPORT', 'AMMONIA', 'STEEL', 'TRANSPORT', 'POWER', 'INDUSTRIAL']
    for (const sec of sectorList) {
      const rec = data.demand_projections.find(d => d.sector === sec && d.year === yr)
      row[sec] = rec ? rec.demand_tpa : 0
    }
    return row
  })

  const routeChartData = buildRouteChartData(data.production_routes)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-cyan-900 rounded-xl">
          <Flame className="w-8 h-8 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Clean Hydrogen Production Cost Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            LCOH curves, electrolyser performance and Australian hydrogen project pipeline
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Cheapest Green LCOH"
          value={`$${summary.cheapest_green_lcoh_aud_per_kg?.toFixed(2) ?? '—'}/kg`}
          sub="ALK electrolysis + wind"
          Icon={Flame}
        />
        <KpiCard
          label="Green Parity Year"
          value={String(summary.green_parity_year ?? '—')}
          sub="vs. grey hydrogen"
          Icon={Calendar}
        />
        <KpiCard
          label="Total Project Capacity"
          value={`${summary.total_project_capacity_tpd?.toLocaleString() ?? '—'} TPD`}
          sub="across all pipeline projects"
          Icon={TrendingDown}
        />
        <KpiCard
          label="Export Demand 2040"
          value={`${((summary.export_demand_2040_tpa ?? 0) / 1e6).toFixed(1)}M TPA`}
          sub="projected hydrogen export"
          Icon={Globe}
        />
      </div>

      {/* ── Production Route LCOH Comparison ── */}
      <div className="bg-gray-800 rounded-xl p-6">
        <SectionHeader title="Production Route LCOH Comparison (AUD/kg)" />
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={routeChartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'AUD/kg', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
              formatter={(v: number) => [`$${v.toFixed(2)}/kg`, 'LCOH']}
            />
            <Bar dataKey="lcoh" name="LCOH AUD/kg" radius={[4, 4, 0, 0]}>
              {routeChartData.map((entry, idx) => (
                <rect key={idx} fill={entry.colour} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Manual legend */}
        <div className="flex flex-wrap gap-4 mt-3">
          {Object.entries(COLOUR_PALETTE).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: v }} />
              <span className="text-xs text-gray-400">{k}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cost Breakdown Over Time (Green PEM, WA) ── */}
      <div className="bg-gray-800 rounded-xl p-6">
        <SectionHeader title="Green H2 PEM — LCOH Cost Components Over Time (WA)" />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={greenPemWABreakdowns} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'AUD/kg', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
              formatter={(v: number) => `$${v.toFixed(2)}/kg`}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="electricity_cost_aud_per_kg" stackId="a" name="Electricity"  fill={COST_COMPONENT_COLOURS.electricity_cost_aud_per_kg} />
            <Bar dataKey="capex_cost_aud_per_kg"       stackId="a" name="Capex"        fill={COST_COMPONENT_COLOURS.capex_cost_aud_per_kg} />
            <Bar dataKey="opex_cost_aud_per_kg"        stackId="a" name="Opex"         fill={COST_COMPONENT_COLOURS.opex_cost_aud_per_kg} />
            <Bar dataKey="water_cost_aud_per_kg"       stackId="a" name="Water"        fill={COST_COMPONENT_COLOURS.water_cost_aud_per_kg} />
            <Bar dataKey="co2_cost_aud_per_kg"         stackId="a" name="CO2 Cost"     fill={COST_COMPONENT_COLOURS.co2_cost_aud_per_kg} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Demand Projections by Sector ── */}
      <div className="bg-gray-800 rounded-xl p-6">
        <SectionHeader title="Hydrogen Demand Projections by Sector (TPA, 2025–2040)" />
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={demandChartData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={(v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v)}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
              formatter={(v: number) => `${v.toLocaleString()} TPA`}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {Object.keys(SECTOR_COLOURS).map(sec => (
              <Line
                key={sec}
                type="monotone"
                dataKey={sec}
                name={sec}
                stroke={SECTOR_COLOURS[sec]}
                strokeWidth={2}
                dot={{ r: 4, fill: SECTOR_COLOURS[sec] }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Project Pipeline Table ── */}
      <div className="bg-gray-800 rounded-xl p-6">
        <SectionHeader title="Australian Hydrogen Project Pipeline" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                <th className="text-left py-2 pr-4">Project</th>
                <th className="text-left py-2 pr-4">State</th>
                <th className="text-left py-2 pr-4">Proponent</th>
                <th className="text-right py-2 pr-4">Capacity (TPD)</th>
                <th className="text-left py-2 pr-4">Technology</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-right py-2 pr-4">Target LCOH</th>
                <th className="text-right py-2 pr-4">Funding ($M)</th>
                <th className="text-left py-2">Offtake</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p: LCOHProjectRecord) => (
                <tr key={p.project_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-medium text-white">{p.name}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.state}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.proponent}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{p.capacity_tpd.toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-cyan-300 font-mono">
                      {p.technology}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge label={p.status} colourClass={STATUS_COLOURS[p.status] ?? 'bg-gray-600'} />
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {p.lcoh_target_aud_per_kg != null ? `$${p.lcoh_target_aud_per_kg.toFixed(2)}/kg` : '—'}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">${p.funding_aud_m.toFixed(0)}M</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.offtake_secured ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                      {p.offtake_secured ? 'Secured' : 'None'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Electrolyser Comparison Table ── */}
      <div className="bg-gray-800 rounded-xl p-6">
        <SectionHeader title="Electrolyser Technology Comparison" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                <th className="text-left py-2 pr-4">Manufacturer</th>
                <th className="text-left py-2 pr-4">Technology</th>
                <th className="text-right py-2 pr-4">Capacity (MW)</th>
                <th className="text-right py-2 pr-4">Efficiency (%)</th>
                <th className="text-right py-2 pr-4">Stack Life (hrs)</th>
                <th className="text-right py-2 pr-4">Capex (AUD/kW)</th>
                <th className="text-right py-2 pr-4">Opex (% Capex)</th>
                <th className="text-right py-2 pr-4">Degradation (%/yr)</th>
                <th className="text-right py-2 pr-4">H2 Output (kg/hr)</th>
                <th className="text-right py-2">AU Projects</th>
              </tr>
            </thead>
            <tbody>
              {data.electrolysers.map((e: LCOHElectrolyserRecord, idx: number) => (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-medium text-white">{e.manufacturer}</td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-cyan-300 font-mono">
                      {e.technology}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">{e.capacity_mw.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right">
                    <span className={`font-semibold ${e.efficiency_pct >= 80 ? 'text-green-400' : e.efficiency_pct >= 70 ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {e.efficiency_pct.toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">{e.stack_lifetime_hours.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">${e.capex_aud_per_kw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{e.opex_pct_capex.toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{e.degradation_pct_per_year.toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{e.h2_output_kg_per_hour.toFixed(1)}</td>
                  <td className="py-2 text-right text-gray-300">{e.australia_projects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer ── */}
      <p className="text-xs text-gray-600 text-center pb-4">
        Sprint 92b — Clean Hydrogen Production Cost Analytics | Data is indicative and for illustrative purposes only
      </p>
    </div>
  )
}
