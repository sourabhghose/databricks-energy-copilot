import { useEffect, useState } from 'react'
import { GitBranch, TrendingUp, Database, Zap } from 'lucide-react'
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
  getHydrogenPipelineInfrastructureDashboard,
  HPIADashboard,
  HPIAPipelineRecord,
  HPIAHubRecord,
  HPIATransportComparisonRecord,
  HPIABlendingRecord,
  HPIAProjectRecord,
  HPIADemandRecord,
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

const MODE_COLOURS: Record<string, string> = {
  'Compressed Gas Pipeline': '#3b82f6',
  'Liquefied H2 Ship': '#06b6d4',
  'LOHC Tanker': '#8b5cf6',
  'Ammonia Ship': '#f59e0b',
  'On-site Production': '#10b981',
}

const STATUS_COLOURS: Record<string, string> = {
  'Proposed': '#6b7280',
  'Approved': '#3b82f6',
  'Under Construction': '#f59e0b',
  'Operating': '#10b981',
  'Feasibility': '#a78bfa',
  'FEED': '#60a5fa',
}

const HUB_TYPE_COLOURS: Record<string, string> = {
  'Production': '#10b981',
  'Storage': '#3b82f6',
  'Distribution': '#f59e0b',
  'Export': '#ef4444',
}

const SECTOR_COLOURS: Record<string, string> = {
  'Industry': '#3b82f6',
  'Transport': '#10b981',
  'Exports': '#f59e0b',
  'Blending': '#8b5cf6',
  'Power': '#ef4444',
}

// ── Chart 1: Transport Mode Cost Comparison ────────────────────────────────
function TransportCostChart({ data }: { data: HPIATransportComparisonRecord[] }) {
  // Group by mode, then compute avg cost per distance bucket
  const distanceBuckets = ['Short (<1k km)', 'Medium (1-5k km)', 'Long (>5k km)']
  const modes = Array.from(new Set(data.map(d => d.mode)))

  const bucketed: Record<string, Record<string, number[]>> = {}
  distanceBuckets.forEach(b => { bucketed[b] = {} })
  modes.forEach(m => {
    distanceBuckets.forEach(b => { bucketed[b][m] = [] })
  })

  data.forEach(d => {
    const bucket = d.distance_km < 1000
      ? 'Short (<1k km)'
      : d.distance_km <= 5000
      ? 'Medium (1-5k km)'
      : 'Long (>5k km)'
    if (bucketed[bucket][d.mode]) bucketed[bucket][d.mode].push(d.cost_aud_per_kg_h2)
  })

  const chartData = distanceBuckets.map(bucket => {
    const row: Record<string, string | number> = { bucket }
    modes.forEach(m => {
      const vals = bucketed[bucket][m]
      if (vals && vals.length > 0) {
        row[m] = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
      }
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="bucket" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'AUD/kg H2', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#e5e7eb' }} itemStyle={{ color: '#d1d5db' }} />
        <Legend wrapperStyle={{ paddingTop: 16, fontSize: 11, color: '#9ca3af' }} />
        {modes.map(m => (
          <Bar key={m} dataKey={m} fill={MODE_COLOURS[m] ?? '#6b7280'} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 2: Blending Trend ────────────────────────────────────────────────
function BlendingTrendChart({ data }: { data: HPIABlendingRecord[] }) {
  const networks = Array.from(new Set(data.map(d => d.gas_network)))
  const months = Array.from(new Set(data.map(d => d.month))).sort()

  const chartData = months.map(m => {
    const row: Record<string, string | number> = { month: m.slice(0, 7) }
    networks.forEach(n => {
      const rec = data.find(d => d.month === m && d.gas_network === n)
      if (rec) row[n] = rec.blend_pct
    })
    return row
  })

  const lineColours = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" interval={3} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Blend %', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#e5e7eb' }} itemStyle={{ color: '#d1d5db' }} />
        <Legend wrapperStyle={{ paddingTop: 16, fontSize: 10, color: '#9ca3af' }} />
        {networks.map((n, i) => (
          <Line
            key={n}
            type="monotone"
            dataKey={n}
            stroke={lineColours[i % lineColours.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Chart 3: Pipeline Network Status ──────────────────────────────────────
function PipelineStatusChart({ data }: { data: HPIAPipelineRecord[] }) {
  const states = Array.from(new Set(data.map(d => d.state))).sort()
  const statuses = Array.from(new Set(data.map(d => d.status)))

  const chartData = states.map(st => {
    const row: Record<string, string | number> = { state: st }
    statuses.forEach(s => {
      row[s] = data
        .filter(d => d.state === st && d.status === s)
        .reduce((acc, d) => acc + d.length_km, 0)
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Length (km)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#e5e7eb' }} itemStyle={{ color: '#d1d5db' }} />
        <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11, color: '#9ca3af' }} />
        {statuses.map(s => (
          <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLOURS[s] ?? '#6b7280'} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 4: Hub Capacity Overview ─────────────────────────────────────────
function HubCapacityChart({ data }: { data: HPIAHubRecord[] }) {
  const sorted = [...data].sort((a, b) => b.storage_capacity_tonne_h2 - a.storage_capacity_tonne_h2)
  const chartData = sorted.map(h => ({
    name: h.hub_name.replace(' H2 ', ' ').replace(' Hub', '').replace(' Terminal', ''),
    storage: h.storage_capacity_tonne_h2,
    hub_type: h.hub_type,
  }))

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 140, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Storage (t H2)', position: 'insideBottom', offset: -4, fill: '#9ca3af', fontSize: 11 }} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={135} />
        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#e5e7eb' }} itemStyle={{ color: '#d1d5db' }} />
        <Bar dataKey="storage" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={HUB_TYPE_COLOURS[entry.hub_type] ?? '#6b7280'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 5: Demand Forecast by Sector ────────────────────────────────────
function DemandForecastChart({ data }: { data: HPIADemandRecord[] }) {
  const years = Array.from(new Set(data.map(d => d.year))).sort()
  const sectors = Array.from(new Set(data.map(d => d.sector)))

  const chartData = years.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    sectors.forEach(s => {
      const rec = data.find(d => d.year === yr && d.sector === s)
      row[s] = rec ? rec.demand_kt_h2 : 0
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Demand (kt H2)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#e5e7eb' }} itemStyle={{ color: '#d1d5db' }} />
        <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11, color: '#9ca3af' }} />
        {sectors.map(s => (
          <Area
            key={s}
            type="monotone"
            dataKey={s}
            stackId="1"
            fill={SECTOR_COLOURS[s] ?? '#6b7280'}
            stroke={SECTOR_COLOURS[s] ?? '#6b7280'}
            fillOpacity={0.7}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Chart 6: Project Pipeline ──────────────────────────────────────────────
function ProjectPipelineChart({ data }: { data: HPIAProjectRecord[] }) {
  const types = Array.from(new Set(data.map(d => d.project_type))).sort()
  const statuses = Array.from(new Set(data.map(d => d.status))).sort()

  const chartData = types.map(t => {
    const row: Record<string, string | number> = { type: t }
    statuses.forEach(s => {
      row[s] = data
        .filter(d => d.project_type === t && d.status === s)
        .reduce((acc, d) => acc + d.capex_m, 0)
    })
    return row
  })

  const statusColMap: Record<string, string> = {
    'Operating': '#10b981',
    'Under Construction': '#f59e0b',
    'Approved': '#3b82f6',
    'FEED': '#60a5fa',
    'Feasibility': '#a78bfa',
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-15} textAnchor="end" />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Capex ($M)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#e5e7eb' }} itemStyle={{ color: '#d1d5db' }} />
        <Legend wrapperStyle={{ paddingTop: 16, fontSize: 11, color: '#9ca3af' }} />
        {statuses.map(s => (
          <Bar key={s} dataKey={s} stackId="a" fill={statusColMap[s] ?? '#6b7280'} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function HydrogenPipelineInfrastructureAnalytics() {
  const [data, setData] = useState<HPIADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getHydrogenPipelineInfrastructureDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading hydrogen pipeline infrastructure data...
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
        <div className="p-2.5 bg-blue-600 rounded-xl">
          <GitBranch size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Hydrogen Pipeline Infrastructure Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Australia-wide H2 pipeline networks, blending programs, export hubs, and techno-economic transport analysis
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Total Pipeline"
          value={`${Number(s.total_pipeline_km).toLocaleString()} km`}
          sub="Across all states & statuses"
          icon={GitBranch}
          colour="bg-blue-600"
        />
        <KpiCard
          label="Total H2 Storage"
          value={`${Number(s.total_h2_storage_capacity_tonne).toLocaleString()} t`}
          sub="Across all hubs"
          icon={Database}
          colour="bg-emerald-600"
        />
        <KpiCard
          label="Cheapest Transport Mode"
          value={String(s.cheapest_transport_mode)}
          sub="Lowest AUD/kg H2"
          icon={TrendingUp}
          colour="bg-amber-600"
        />
        <KpiCard
          label="Avg Current Blend %"
          value={`${s.avg_blend_pct_current}%`}
          sub="Across active blending networks"
          icon={Zap}
          colour="bg-purple-600"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <SectionHeader
            title="Transport Mode Cost Comparison"
            subtitle="Average cost (AUD/kg H2) by mode and distance bucket"
          />
          <TransportCostChart data={data.transport_comparison} />
        </div>
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <SectionHeader
            title="Gas Network Blending Trend"
            subtitle="H2 blend % by gas network over time"
          />
          <BlendingTrendChart data={data.blending} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <SectionHeader
            title="Pipeline Network Status by State"
            subtitle="Total pipeline length (km) stacked by development status"
          />
          <PipelineStatusChart data={data.pipelines} />
        </div>
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <SectionHeader
            title="H2 Hub Storage Capacity"
            subtitle="Storage capacity (tonnes H2) by hub, coloured by hub type"
          />
          <HubCapacityChart data={data.hubs} />
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <SectionHeader
            title="H2 Demand Forecast by Sector (2024–2035)"
            subtitle="Stacked demand (kt H2/yr) by end-use sector"
          />
          <DemandForecastChart data={data.demand_forecast} />
        </div>
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <SectionHeader
            title="Project Pipeline (Capex $M)"
            subtitle="Capital expenditure by project type and development status"
          />
          <ProjectPipelineChart data={data.projects} />
        </div>
      </div>

      {/* Summary Band */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="Infrastructure Overview"
          subtitle="Key metrics across the Australian hydrogen pipeline and hub network"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Pipeline (km)', value: Number(s.total_pipeline_km).toLocaleString() },
            { label: 'H2 Storage Capacity (t)', value: Number(s.total_h2_storage_capacity_tonne).toLocaleString() },
            { label: 'Cheapest Mode', value: String(s.cheapest_transport_mode) },
            { label: 'Avg Blend % (Current)', value: `${s.avg_blend_pct_current}%` },
            { label: 'Project Pipeline', value: `$${s.total_project_pipeline_b}B` },
            { label: '2030 Export Demand', value: `${s.projected_2030_demand_kt} kt H2` },
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
