import { useEffect, useState } from 'react'
import { Layers, TrendingUp, Database, DollarSign } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getCarbonCaptureStorageProjectDashboard,
  CCSPDashboard,
  CCSPProjectRecord,
  CCSPStorageSiteRecord,
  CCSPPerformanceRecord,
  CCSPCostRecord,
  CCSPScenarioRecord,
} from '../api/client'

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  colour,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

const STATUS_COLOURS: Record<string, string> = {
  'Concept':     '#6b7280',
  'Feasibility': '#a78bfa',
  'Development': '#3b82f6',
  'Operating':   '#10b981',
  'Suspended':   '#ef4444',
}

const FORMATION_COLOURS: Record<string, string> = {
  'Depleted Oil Field': '#f59e0b',
  'Saline Aquifer':    '#3b82f6',
  'Coal Seam':         '#6b7280',
  'Basalt':            '#8b5cf6',
  'Deep Offshore':     '#06b6d4',
}

const SCENARIO_COLOURS: Record<string, string> = {
  'Current Policy': '#f59e0b',
  'Net Zero':       '#10b981',
}

// ── Chart 1: Project Pipeline by Type (stacked by status) ─────────────────
function ProjectPipelineChart({ data }: { data: CCSPProjectRecord[] }) {
  const types = Array.from(new Set(data.map(d => d.project_type))).sort()
  const statuses = Array.from(new Set(data.map(d => d.status))).sort()

  const chartData = types.map(t => {
    const row: Record<string, string | number> = { type: t }
    statuses.forEach(s => {
      row[s] = parseFloat(
        data
          .filter(d => d.project_type === t && d.status === s)
          .reduce((acc, d) => acc + d.capture_capacity_mtpa, 0)
          .toFixed(2)
      )
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-20} textAnchor="end" />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Capacity (Mtpa CO2)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ paddingTop: 16, fontSize: 11, color: '#9ca3af' }} />
        {statuses.map(s => (
          <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLOURS[s] ?? '#6b7280'} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 2: Capture Efficiency Trend ─────────────────────────────────────
function CaptureEfficiencyChart({ data }: { data: CCSPPerformanceRecord[] }) {
  const projects = Array.from(new Set(data.map(d => d.project_name)))
  const quarters = Array.from(new Set(data.map(d => d.quarter))).sort()

  const chartData = quarters.map(q => {
    const row: Record<string, string | number> = { quarter: q }
    projects.forEach(p => {
      const rec = data.find(d => d.quarter === q && d.project_name === p)
      if (rec) row[p] = rec.capture_efficiency_pct
    })
    return row
  })

  const lineColours = ['#10b981', '#3b82f6', '#f59e0b']

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" interval={1} />
        <YAxis
          domain={[80, 100]}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Efficiency (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ paddingTop: 16, fontSize: 11, color: '#9ca3af' }} />
        {projects.map((p, i) => (
          <Line
            key={p}
            type="monotone"
            dataKey={p}
            stroke={lineColours[i % lineColours.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Chart 3: Cost Benchmark by Technology ─────────────────────────────────
function CostBenchmarkChart({ data }: { data: CCSPCostRecord[] }) {
  // One row per technology, show latest year costs
  const latestYear = Math.max(...data.map(d => d.year))
  const latest = data.filter(d => d.year === latestYear)
  const techs = Array.from(new Set(latest.map(d => d.technology)))

  const chartData = techs.map(t => {
    const recs = latest.filter(d => d.technology === t)
    const avg = (field: keyof CCSPCostRecord) =>
      parseFloat((recs.reduce((a, r) => a + (r[field] as number), 0) / recs.length).toFixed(2))
    return {
      technology: t.replace('Post-combustion Amine', 'Post-comb.').replace('Pre-combustion IGCC', 'Pre-comb.').replace('Direct Air Capture', 'DAC').replace('Oxyfuel Combustion', 'Oxyfuel'),
      Capture: avg('capture_cost_aud_per_tonne'),
      Transport: avg('transport_cost_aud_per_tonne'),
      Storage: avg('storage_cost_aud_per_tonne'),
    }
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="technology" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-15} textAnchor="end" />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'AUD/tonne CO2', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ paddingTop: 16, fontSize: 11, color: '#9ca3af' }} />
        <Bar dataKey="Capture" stackId="a" fill="#ef4444" />
        <Bar dataKey="Transport" stackId="a" fill="#3b82f6" />
        <Bar dataKey="Storage" stackId="a" fill="#10b981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 4: Storage Site Capacity (horizontal bar) ───────────────────────
function StorageSiteChart({ data }: { data: CCSPStorageSiteRecord[] }) {
  const sorted = [...data].sort((a, b) => b.storage_capacity_gt_co2 - a.storage_capacity_gt_co2)
  const chartData = sorted.map(s => ({
    name: s.site_name.replace(' Formation', '').replace(' Saline', '').replace(' Basin', ''),
    capacity: s.storage_capacity_gt_co2,
    formation_type: s.formation_type,
  }))

  return (
    <ResponsiveContainer width="100%" height={420}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 170, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          type="number"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Storage Capacity (Gt CO2)', position: 'insideBottom', offset: -4, fill: '#9ca3af', fontSize: 11 }}
        />
        <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} width={165} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Bar dataKey="capacity" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={FORMATION_COLOURS[entry.formation_type] ?? '#6b7280'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 5: Scenario Cumulative Storage ──────────────────────────────────
function ScenarioCumulativeChart({ data }: { data: CCSPScenarioRecord[] }) {
  const years = Array.from(new Set(data.map(d => d.year))).sort()
  const scenarios = Array.from(new Set(data.map(d => d.scenario)))

  const chartData = years.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    scenarios.forEach(sc => {
      const rec = data.find(d => d.year === yr && d.scenario === sc)
      if (rec) row[sc] = rec.cumulative_storage_gt
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Cumulative Storage (Gt CO2)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11, color: '#9ca3af' }} />
        {scenarios.map(sc => (
          <Area
            key={sc}
            type="monotone"
            dataKey={sc}
            fill={SCENARIO_COLOURS[sc] ?? '#6b7280'}
            stroke={SCENARIO_COLOURS[sc] ?? '#6b7280'}
            fillOpacity={0.35}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Chart 6 / Performance Table — top 10 recent quarters ──────────────────
function PerformanceTable({ data }: { data: CCSPPerformanceRecord[] }) {
  const sorted = [...data]
    .sort((a, b) => b.quarter.localeCompare(a.quarter))
    .slice(0, 10)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-gray-300">
        <thead>
          <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <th className="pb-2 text-left pr-4">Quarter</th>
            <th className="pb-2 text-left pr-4">Project</th>
            <th className="pb-2 text-right pr-4">Actual (Mtpa)</th>
            <th className="pb-2 text-right pr-4">Efficiency (%)</th>
            <th className="pb-2 text-right pr-4">Cost (AUD/t)</th>
            <th className="pb-2 text-center">Leakage</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
              <td className="py-2 pr-4 font-mono text-xs">{r.quarter}</td>
              <td className="py-2 pr-4 text-xs">{r.project_name}</td>
              <td className="py-2 pr-4 text-right">{r.actual_capture_mtpa.toFixed(3)}</td>
              <td className="py-2 pr-4 text-right">
                <span className={r.capture_efficiency_pct >= 88 ? 'text-emerald-400' : 'text-amber-400'}>
                  {r.capture_efficiency_pct.toFixed(1)}%
                </span>
              </td>
              <td className="py-2 pr-4 text-right">${r.operating_cost_per_tonne_aud.toFixed(0)}</td>
              <td className="py-2 text-center">
                {r.leakage_detected ? (
                  <span className="text-red-400 font-semibold">Yes</span>
                ) : (
                  <span className="text-emerald-400">No</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CarbonCaptureStorageProjectAnalytics() {
  const [data, setData] = useState<CCSPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCarbonCaptureStorageProjectDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading carbon capture and storage project data...
      </div>
    )
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )

  const s = data.summary as Record<string, number | string>

  return (
    <div className="p-6 bg-gray-900 min-h-full text-white">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-teal-600 rounded-xl">
          <Layers size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Carbon Capture and Storage Project Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Australian CCS/CCUS project pipeline, geological storage sites, capture performance, cost benchmarking and regulatory monitoring
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Total Projects"
          value={String(s.total_projects)}
          sub="All stages in pipeline"
          icon={Layers}
          colour="bg-teal-600"
        />
        <KpiCard
          label="Total Storage Capacity"
          value={`${Number(s.total_storage_capacity_gt).toLocaleString()} Gt`}
          sub="Geological CO2 storage (Australia)"
          icon={Database}
          colour="bg-blue-600"
        />
        <KpiCard
          label="Avg Capture Efficiency"
          value={`${s.avg_capture_efficiency_pct}%`}
          sub="Operating projects (2023-2024)"
          icon={TrendingUp}
          colour="bg-emerald-600"
        />
        <KpiCard
          label="Avg Total Cost"
          value={`$${s.avg_total_cost_aud_per_tonne} /t`}
          sub="Capture + transport + storage AUD"
          icon={DollarSign}
          colour="bg-amber-600"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <SectionHeader
            title="Project Pipeline by Type"
            subtitle="Capture capacity (Mtpa CO2) stacked by project status"
          />
          <ProjectPipelineChart data={data.projects} />
        </div>
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <SectionHeader
            title="Capture Efficiency Trend"
            subtitle="Quarterly capture efficiency (%) for operating projects"
          />
          <CaptureEfficiencyChart data={data.performance} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <SectionHeader
            title="Cost Benchmark by Technology"
            subtitle="Capture, transport and storage cost (AUD/tonne CO2) by technology"
          />
          <CostBenchmarkChart data={data.costs} />
        </div>
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <SectionHeader
            title="Scenario: Cumulative Storage (2025–2034)"
            subtitle="Cumulative CO2 stored (Gt) under Current Policy vs Net Zero"
          />
          <ScenarioCumulativeChart data={data.scenarios} />
        </div>
      </div>

      {/* Storage Site Capacity */}
      <div className="bg-gray-800 rounded-xl p-5 shadow mb-6">
        <SectionHeader
          title="Storage Site Capacity"
          subtitle="Geological storage capacity (Gt CO2) by site, coloured by formation type"
        />
        <StorageSiteChart data={data.storage_sites} />
      </div>

      {/* Performance Table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow mb-6">
        <SectionHeader
          title="Recent Quarterly Performance"
          subtitle="Top 10 most recent quarters — capture rate, efficiency, cost and leakage status"
        />
        <PerformanceTable data={data.performance} />
      </div>

      {/* Summary Band */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="CCS Sector Overview"
          subtitle="Key metrics across the Australian carbon capture and storage sector"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Projects', value: String(s.total_projects) },
            { label: 'Storage Capacity', value: `${s.total_storage_capacity_gt} Gt` },
            { label: 'Avg Efficiency', value: `${s.avg_capture_efficiency_pct}%` },
            { label: 'Avg Total Cost', value: `$${s.avg_total_cost_aud_per_tonne}/t` },
            { label: 'Operating Capacity', value: `${s.total_operating_capacity_mtpa} Mtpa` },
            { label: 'Projected 2035 Storage (NZ)', value: `${s.projected_2035_storage_gt} Gt` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-sm font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
