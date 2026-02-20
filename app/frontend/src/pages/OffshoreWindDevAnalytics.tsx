import { useEffect, useState } from 'react'
import { Wind } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getOffshoreWindDevAnalyticsDashboard,
  OWDADashboard,
  OWDAProjectRecord,
  OWDAZoneRecord,
  OWDASupplyChainRecord,
  OWDACostCurveRecord,
  OWDAGridImpactRecord,
} from '../api/client'

// ── helpers ────────────────────────────────────────────────────────────────

const STATUS_ORDER = ['FEASIBILITY', 'EIS', 'APPROVED', 'CONSTRUCTION', 'OPERATING']
const STATUS_COLOR: Record<string, string> = {
  FEASIBILITY: 'bg-blue-700',
  EIS: 'bg-yellow-600',
  APPROVED: 'bg-orange-500',
  CONSTRUCTION: 'bg-purple-500',
  OPERATING: 'bg-green-600',
}
const TECH_COLOR: Record<string, string> = {
  FIXED_BOTTOM: 'text-cyan-400',
  FLOATING: 'text-violet-400',
  OPERATING: 'text-green-400',
}
const SENS_COLOR: Record<string, string> = {
  HIGH: 'text-red-400',
  MEDIUM: 'text-yellow-400',
  LOW: 'text-green-400',
}
const SCENARIO_COLOR: Record<string, string> = {
  BASE: '#60a5fa',
  FAST_DEPLOYMENT: '#34d399',
  SLOW_DEPLOYMENT: '#f87171',
}

// ── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Pipeline funnel ────────────────────────────────────────────────────────

function PipelineFunnel({ projects }: { projects: OWDAProjectRecord[] }) {
  const counts = STATUS_ORDER.map(s => ({
    status: s,
    count: projects.filter(p => p.status === s).length,
    capacity_mw: projects.filter(p => p.status === s).reduce((a, b) => a + b.capacity_mw, 0),
  }))
  const maxCount = Math.max(...counts.map(c => c.count), 1)

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4">Development Pipeline Funnel</h2>
      <div className="flex flex-col gap-3">
        {counts.map(({ status, count, capacity_mw }) => (
          <div key={status} className="flex items-center gap-3">
            <span className="w-28 text-xs text-gray-400 text-right">{status.replace('_', ' ')}</span>
            <div className="flex-1 bg-gray-700 rounded h-7 overflow-hidden">
              <div
                className={`h-full ${STATUS_COLOR[status]} rounded flex items-center px-2 transition-all`}
                style={{ width: `${Math.max((count / maxCount) * 100, 4)}%` }}
              >
                <span className="text-xs text-white font-medium">{count} project{count !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <span className="w-24 text-xs text-gray-300 text-right">
              {capacity_mw >= 1000
                ? `${(capacity_mw / 1000).toFixed(1)} GW`
                : `${capacity_mw.toFixed(0)} MW`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Project table ──────────────────────────────────────────────────────────

function ProjectTable({ projects }: { projects: OWDAProjectRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4">Project Register</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 pr-3">Project</th>
              <th className="text-left py-2 pr-3">State</th>
              <th className="text-left py-2 pr-3">Technology</th>
              <th className="text-left py-2 pr-3">Status</th>
              <th className="text-right py-2 pr-3">Cap (MW)</th>
              <th className="text-right py-2 pr-3">LCOE ($/MWh)</th>
              <th className="text-right py-2 pr-3">CapEx ($bn)</th>
              <th className="text-right py-2">Target</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 font-medium text-white">{p.name}</td>
                <td className="py-2 pr-3">{p.state}</td>
                <td className={`py-2 pr-3 font-medium ${TECH_COLOR[p.technology] ?? 'text-gray-300'}`}>
                  {p.technology.replace('_', ' ')}
                </td>
                <td className="py-2 pr-3">
                  <span className={`px-2 py-0.5 rounded text-white text-xs ${STATUS_COLOR[p.status]}`}>
                    {p.status}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right">{p.capacity_mw.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right">${p.lcoe_per_mwh.toFixed(0)}</td>
                <td className="py-2 pr-3 text-right">${p.capex_bn.toFixed(2)}</td>
                <td className="py-2 text-right">{p.target_commissioning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Zone map table ─────────────────────────────────────────────────────────

function ZoneTable({ zones }: { zones: OWDAZoneRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4">Offshore Infrastructure Zones</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 pr-3">Zone</th>
              <th className="text-left py-2 pr-3">State</th>
              <th className="text-right py-2 pr-3">Area (km²)</th>
              <th className="text-right py-2 pr-3">Potential (GW)</th>
              <th className="text-right py-2 pr-3">Wind (m/s)</th>
              <th className="text-right py-2 pr-3">Grid (km)</th>
              <th className="text-left py-2 pr-3">Sensitivity</th>
              <th className="text-left py-2">Declared</th>
            </tr>
          </thead>
          <tbody>
            {zones.map(z => (
              <tr key={z.zone_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 font-medium text-white max-w-xs truncate">{z.zone_name}</td>
                <td className="py-2 pr-3">{z.state}</td>
                <td className="py-2 pr-3 text-right">{z.total_area_km2.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right font-medium text-cyan-400">{z.potential_capacity_gw.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right">{z.avg_wind_speed_ms.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right">{z.grid_connection_km}</td>
                <td className={`py-2 pr-3 font-medium ${SENS_COLOR[z.environmental_sensitivity]}`}>
                  {z.environmental_sensitivity}
                </td>
                <td className="py-2">
                  {z.declared
                    ? <span className="text-green-400 font-medium">Yes ({z.declaration_year})</span>
                    : <span className="text-gray-500">No</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Supply chain gap chart ─────────────────────────────────────────────────

function SupplyChainChart({ data }: { data: OWDASupplyChainRecord[] }) {
  const chartData = data.map(d => ({
    name: d.component.replace('_', ' '),
    Current: d.current_aus_capacity_units_yr,
    Required2030: d.required_2030_units_yr,
    Required2035: d.required_2035_units_yr,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-1">Supply Chain Gaps</h2>
      <p className="text-xs text-gray-400 mb-4">Current Australian capacity vs required (units/yr)</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11, paddingTop: 8 }} />
          <Bar dataKey="Current" fill="#60a5fa" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Required2030" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Required2035" fill="#f87171" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── LCOE cost curves ───────────────────────────────────────────────────────

function LcoeCurveChart({ data }: { data: OWDACostCurveRecord[] }) {
  const years = [...new Set(data.map(d => d.year))].sort()
  const scenarios = [...new Set(data.map(d => d.scenario))]
  const byYear = years.map(yr => {
    const row: Record<string, number | string> = { year: yr }
    for (const sc of scenarios) {
      const rec = data.find(d => d.year === yr && d.scenario === sc)
      if (rec) row[sc] = rec.lcoe_per_mwh
    }
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-1">LCOE Cost Curves by Scenario</h2>
      <p className="text-xs text-gray-400 mb-4">$/MWh, 2025–2036</p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={byYear} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} unit=" $" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {scenarios.map(sc => (
            <Line
              key={sc}
              type="monotone"
              dataKey={sc}
              stroke={SCENARIO_COLOR[sc] ?? '#a78bfa'}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Cumulative capacity chart ──────────────────────────────────────────────

function CumulativeCapacityChart({ data }: { data: OWDACostCurveRecord[] }) {
  const years = [...new Set(data.map(d => d.year))].sort()
  const scenarios = [...new Set(data.map(d => d.scenario))]
  const byYear = years.map(yr => {
    const row: Record<string, number | string> = { year: yr }
    for (const sc of scenarios) {
      const rec = data.find(d => d.year === yr && d.scenario === sc)
      if (rec) row[sc] = rec.cumulative_capacity_gw
    }
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-1">Cumulative Deployed Capacity</h2>
      <p className="text-xs text-gray-400 mb-4">GW offshore wind, 2025–2036</p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={byYear} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} unit=" GW" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {scenarios.map(sc => (
            <Line
              key={sc}
              type="monotone"
              dataKey={sc}
              stroke={SCENARIO_COLOR[sc] ?? '#a78bfa'}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Grid impact chart ──────────────────────────────────────────────────────

function GridImpactChart({ data }: { data: OWDAGridImpactRecord[] }) {
  const regions = [...new Set(data.map(d => d.region))]
  const scenarioYears = [2030, 2035, 2040, 2050]

  // One grouped bar chart per scenario year
  const byYear = scenarioYears.map(sy => {
    const row: Record<string, number | string> = { year: String(sy) }
    for (const r of regions) {
      const rec = data.find(d => d.region === r && d.scenario_year === sy)
      if (rec) row[r] = rec.offshore_capacity_gw
    }
    return row
  })

  const REGION_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f87171', '#a78bfa']

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-1">Grid Integration — Offshore Capacity by Region</h2>
      <p className="text-xs text-gray-400 mb-4">GW deployed per scenario year</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={byYear} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} unit=" GW" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {regions.map((r, i) => (
            <Bar key={r} dataKey={r} stackId="a" fill={REGION_COLORS[i % REGION_COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Grid impact summary table ──────────────────────────────────────────────

function GridImpactTable({ data }: { data: OWDAGridImpactRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4">Grid Impact Detail</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-right py-2 pr-3">Year</th>
              <th className="text-right py-2 pr-3">Capacity (GW)</th>
              <th className="text-right py-2 pr-3">Curtailment (%)</th>
              <th className="text-right py-2 pr-3">Congestion Cost ($M)</th>
              <th className="text-right py-2 pr-3">Tx Upgrade ($bn)</th>
              <th className="text-right py-2">Firming (GW)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 font-medium text-white">{d.region}</td>
                <td className="py-2 pr-3 text-right">{d.scenario_year}</td>
                <td className="py-2 pr-3 text-right text-cyan-400 font-medium">{d.offshore_capacity_gw.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right">{d.curtailment_pct.toFixed(1)}%</td>
                <td className="py-2 pr-3 text-right">${d.congestion_cost_m.toFixed(0)}</td>
                <td className="py-2 pr-3 text-right">${d.transmission_upgrade_bn.toFixed(2)}</td>
                <td className="py-2 text-right">{d.firming_capacity_gw.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function OffshoreWindDevAnalytics() {
  const [data, setData] = useState<OWDADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getOffshoreWindDevAnalyticsDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-300">
          <Wind className="animate-spin" size={24} />
          <span>Loading Offshore Wind Development Pipeline Analytics...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 text-red-300 max-w-lg">
          <p className="font-semibold mb-1">Failed to load dashboard</p>
          <p className="text-sm">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  const { projects, zones, supply_chain, cost_curves, grid_impacts, summary } = data
  const totalPipelineGw = Number(summary.total_pipeline_gw ?? 0)
  const operatingGw = Number(summary.operating_gw ?? 0)
  const constructionGw = Number(summary.under_construction_gw ?? 0)
  const declaredZones = Number(summary.declared_zones ?? 0)
  const peakJobs = Number(summary.total_jobs_construction_peak ?? 0)
  const lcoe2030 = Number(summary.avg_lcoe_2030 ?? 0)
  const lcoe2040 = Number(summary.avg_lcoe_2040 ?? 0)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wind className="text-cyan-400" size={28} />
        <div>
          <h1 className="text-xl font-bold">Offshore Wind Development Pipeline Analytics</h1>
          <p className="text-sm text-gray-400">Australian offshore wind full development funnel, zones, supply chain &amp; grid integration</p>
        </div>
      </div>

      {/* KPI summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard label="Total Pipeline" value={`${totalPipelineGw.toFixed(1)} GW`} sub="all stages" />
        <KpiCard label="Operating" value={`${operatingGw.toFixed(2)} GW`} sub="commissioned" />
        <KpiCard label="Under Construction" value={`${constructionGw.toFixed(1)} GW`} sub="in build" />
        <KpiCard label="Declared Zones" value={String(declaredZones)} sub="OIZ gazetted" />
        <KpiCard label="Peak Construction Jobs" value={peakJobs.toLocaleString()} sub="across all projects" />
        <KpiCard label="Avg LCOE 2030" value={`$${lcoe2030.toFixed(0)}/MWh`} sub="base scenario" />
        <KpiCard label="Avg LCOE 2040" value={`$${lcoe2040.toFixed(0)}/MWh`} sub="base scenario" />
      </div>

      {/* Pipeline funnel + project table */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PipelineFunnel projects={projects} />
        <ProjectTable projects={projects} />
      </div>

      {/* Zone table */}
      <ZoneTable zones={zones} />

      {/* Supply chain + LCOE curves */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SupplyChainChart data={supply_chain} />
        <LcoeCurveChart data={cost_curves} />
      </div>

      {/* Cumulative capacity + grid impact bar */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CumulativeCapacityChart data={cost_curves} />
        <GridImpactChart data={grid_impacts} />
      </div>

      {/* Grid impact detail table */}
      <GridImpactTable data={grid_impacts} />
    </div>
  )
}
