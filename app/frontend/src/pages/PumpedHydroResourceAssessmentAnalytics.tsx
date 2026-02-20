import { useEffect, useState } from 'react'
import { Droplets } from 'lucide-react'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getPumpedHydroResourceAssessmentDashboard,
  PHADashboard,
  PHASiteRecord,
  PHAWaterConstraintRecord,
} from '../api/client'

// ── colour maps ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  IDENTIFIED:   'bg-gray-600',
  FEASIBILITY:  'bg-blue-700',
  APPROVED:     'bg-yellow-600',
  CONSTRUCTION: 'bg-orange-500',
  OPERATING:    'bg-green-600',
}

const CLASS_COLOR: Record<string, string> = {
  CLASS_A: 'bg-emerald-600',
  CLASS_B: 'bg-sky-600',
  CLASS_C: 'bg-amber-600',
  CLASS_D: 'bg-red-700',
}

const STRESS_COLOR: Record<string, string> = {
  LOW:     'text-green-400',
  MEDIUM:  'text-yellow-400',
  HIGH:    'text-orange-400',
  EXTREME: 'text-red-400',
}

const RISK_COLOR: Record<string, string> = {
  LOW:    'text-green-400',
  MEDIUM: 'text-yellow-400',
  HIGH:   'text-red-400',
}

const SCENARIO_COLOR: Record<string, string> = {
  NEM_2030: '#60a5fa',
  NEM_2040: '#34d399',
  NEM_2050: '#f87171',
}

const STATE_COLOR: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#34d399',
  QLD: '#fbbf24',
  SA:  '#f87171',
  TAS: '#a78bfa',
}

// ── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 1): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })
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

// ── Site Register Table ────────────────────────────────────────────────────

function SiteRegisterTable({ sites }: { sites: PHASiteRecord[] }) {
  const sorted = [...sites].sort((a, b) => b.capacity_mw - a.capacity_mw)

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4">Site Register</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {['ID', 'Name', 'State', 'Head (m)', 'Cap (MW)', 'Storage (GWh)',
                'CAPEX ($bn)', 'LCOE ($/MWh)', 'Status', 'Class'].map(h => (
                <th key={h} className="text-left text-xs text-gray-400 py-2 pr-4 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => (
              <tr key={s.site_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-4 text-gray-400 font-mono text-xs">{s.site_id}</td>
                <td className="py-2 pr-4 text-white font-medium whitespace-nowrap">{s.name}</td>
                <td className="py-2 pr-4 text-gray-300">{s.state}</td>
                <td className="py-2 pr-4 text-gray-300 text-right">{fmt(s.head_m, 0)}</td>
                <td className="py-2 pr-4 text-gray-300 text-right">{fmt(s.capacity_mw, 0)}</td>
                <td className="py-2 pr-4 text-gray-300 text-right">{fmt(s.storage_gwh, 1)}</td>
                <td className="py-2 pr-4 text-gray-300 text-right">{fmt(s.capex_bn, 2)}</td>
                <td className="py-2 pr-4 text-gray-300 text-right">{fmt(s.lcoe_per_mwh, 0)}</td>
                <td className="py-2 pr-4">
                  <span className={`text-xs px-2 py-0.5 rounded text-white ${STATUS_COLOR[s.development_status] ?? 'bg-gray-600'}`}>
                    {s.development_status}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <span className={`text-xs px-2 py-0.5 rounded text-white ${CLASS_COLOR[s.environmental_class] ?? 'bg-gray-600'}`}>
                    {s.environmental_class}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── State Summary Chart ────────────────────────────────────────────────────

function StateSummaryChart({ data }: { data: PHADashboard['state_summary'] }) {
  const chartData = data.map(d => ({
    state: d.state,
    'Potential (GW)': d.total_potential_gw,
    'Under Dev (GW)': d.under_development_gw,
    'Operating (GW)': d.operating_gw,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4">State Capacity Summary (GW)</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="Potential (GW)"    fill="#60a5fa" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Under Dev (GW)"   fill="#fbbf24" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Operating (GW)"   fill="#34d399" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Storage Needs by Scenario ──────────────────────────────────────────────

function StorageNeedsChart({ data }: { data: PHADashboard['storage_needs'] }) {
  const regions = ['NSW', 'VIC', 'QLD', 'SA', 'TAS']
  const scenarios = ['NEM_2030', 'NEM_2040', 'NEM_2050']

  // pivot: one row per region
  const chartData = regions.map(region => {
    const row: Record<string, number | string> = { region }
    scenarios.forEach(sc => {
      const rec = data.find(d => d.region === region && d.scenario === sc)
      row[sc] = rec ? rec.storage_needed_gwh : 0
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4">Storage Needs by Scenario (GWh)</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {scenarios.map(sc => (
            <Bar key={sc} dataKey={sc} fill={SCENARIO_COLOR[sc]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Head Duration Distribution ─────────────────────────────────────────────

function HeadDurationChart({ data }: { data: PHADashboard['head_duration'] }) {
  const headRanges = ['100-200m', '200-400m', '400-600m', '600-900m', '>900m']
  const states = ['NSW', 'VIC', 'QLD', 'SA', 'TAS']

  const chartData = headRanges.map(hr => {
    const row: Record<string, number | string> = { head_range: hr }
    states.forEach(st => {
      const rec = data.find(d => d.state === st && d.head_range === hr)
      row[st] = rec ? rec.total_capacity_mw : 0
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4">Head Range Distribution — Capacity by State (MW)</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="head_range" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {states.map(st => (
            <Bar key={st} dataKey={st} stackId="a" fill={STATE_COLOR[st]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── PHES Share vs Battery Chart ────────────────────────────────────────────

function PhesShareChart({ data }: { data: PHADashboard['storage_needs'] }) {
  // For NEM_2050 across all regions, show storage mix
  const filtered = data.filter(d => d.scenario === 'NEM_2050')
  const chartData = filtered.map(d => ({
    region: d.region,
    'PHES %':    d.phes_share_pct,
    'Battery %': d.battery_share_pct,
    'Other %':   d.other_storage_share_pct,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-1">
        2050 Storage Mix by Region
      </h2>
      <p className="text-xs text-gray-500 mb-4">PHES vs Battery vs Other share (%)</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="PHES %"    stackId="b" fill="#60a5fa" />
          <Bar dataKey="Battery %" stackId="b" fill="#34d399" />
          <Bar dataKey="Other %"   stackId="b" fill="#9ca3af" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Water Constraints Table ────────────────────────────────────────────────

function WaterConstraintsTable({ data, sites }: { data: PHAWaterConstraintRecord[]; sites: PHASiteRecord[] }) {
  const nameFor = (id: string) => sites.find(s => s.site_id === id)?.name ?? id

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4">Water Constraint Assessment</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {['Site', 'Evaporation (ML/yr)', 'Seepage (ML/yr)', 'Makeup Water (ML/yr)',
                'Water Source', 'Stress Level', 'Climate Risk'].map(h => (
                <th key={h} className="text-left text-xs text-gray-400 py-2 pr-4 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(w => (
              <tr key={w.site_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-4 text-white font-medium whitespace-nowrap">{nameFor(w.site_id)}</td>
                <td className="py-2 pr-4 text-gray-300 text-right">{fmt(w.annual_evaporation_ml, 0)}</td>
                <td className="py-2 pr-4 text-gray-300 text-right">{fmt(w.annual_seepage_ml, 0)}</td>
                <td className="py-2 pr-4 text-gray-300 text-right">{fmt(w.annual_makeup_water_ml, 0)}</td>
                <td className="py-2 pr-4 text-gray-400 text-xs">{w.water_source}</td>
                <td className={`py-2 pr-4 font-semibold text-xs ${STRESS_COLOR[w.water_stress_level] ?? 'text-gray-300'}`}>
                  {w.water_stress_level}
                </td>
                <td className={`py-2 pr-4 font-semibold text-xs ${RISK_COLOR[w.climate_change_risk] ?? 'text-gray-300'}`}>
                  {w.climate_change_risk}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PumpedHydroResourceAssessmentAnalytics() {
  const [data, setData] = useState<PHADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPumpedHydroResourceAssessmentDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Pumped Hydro Resource Assessment…
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

  const s = data.summary as Record<string, number>

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Droplets className="text-cyan-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Pumped Hydro Resource Assessment Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Australia-wide PHES site inventory, storage needs modelling and water constraint mapping
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <KpiCard label="Identified Sites"       value={String(s.total_identified_sites)}          sub="across NEM" />
        <KpiCard label="Total Potential"        value={`${s.total_potential_gw} GW`}              sub={`${s.total_potential_gwh} GWh`} />
        <KpiCard label="CLASS A Sites"          value={String(s.class_a_sites)}                   sub="best environmental class" />
        <KpiCard label="Operating"              value={`${s.operating_gw} GW`}                   sub="in service" />
        <KpiCard label="Under Development"      value={`${s.under_development_gw} GW`}           sub="approved + construction" />
        <KpiCard label="Avg LCOE"               value={`$${s.avg_lcoe_per_mwh}/MWh`}             sub="across all sites" />
        <KpiCard label="States Assessed"        value="5"                                         sub="NSW VIC QLD SA TAS" />
      </div>

      {/* Site Register */}
      <SiteRegisterTable sites={data.sites} />

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <StateSummaryChart data={data.state_summary} />
        <StorageNeedsChart data={data.storage_needs} />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <HeadDurationChart data={data.head_duration} />
        <PhesShareChart    data={data.storage_needs} />
      </div>

      {/* Water Constraints */}
      <WaterConstraintsTable data={data.water_constraints} sites={data.sites} />

      {/* Legend note */}
      <div className="bg-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p>
          <span className="font-semibold text-gray-400">Environmental Classification: </span>
          CLASS_A = minimal environmental sensitivity, shortest approvals pathway.
          CLASS_B = moderate constraints. CLASS_C = significant constraints requiring detailed EIS.
          CLASS_D = severe constraints, development unlikely.
        </p>
        <p>
          <span className="font-semibold text-gray-400">Data source: </span>
          Australian Renewable Energy Agency (ARENA) PHES Atlas, ANU 100% Renewable Energy
          study, ISP 2024, state government feasibility reports.
        </p>
      </div>
    </div>
  )
}
