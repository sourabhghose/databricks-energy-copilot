import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
} from 'recharts'
import { MapPin, AlertCircle, Loader2 } from 'lucide-react'
import { api, RezDevDashboard, RezRecord, RezGenerationProject } from '../api/client'

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function techBadge(tech: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  if (tech === 'WIND') return <span className={`${base} bg-blue-700 text-blue-100`}>WIND</span>
  if (tech === 'SOLAR') return <span className={`${base} bg-amber-600 text-amber-100`}>SOLAR</span>
  return <span className={`${base} bg-purple-700 text-purple-100`}>MIXED</span>
}

function statusBadge(status: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  if (status === 'OPERATING') return <span className={`${base} bg-green-700 text-green-100`}>OPERATING</span>
  if (status === 'COMMITTED') return <span className={`${base} bg-blue-700 text-blue-100`}>COMMITTED</span>
  if (status === 'ACTIVE') return <span className={`${base} bg-teal-700 text-teal-100`}>ACTIVE</span>
  if (status === 'PRIORITY') return <span className={`${base} bg-violet-700 text-violet-100`}>PRIORITY</span>
  if (status === 'CONSTRUCTION') return <span className={`${base} bg-orange-600 text-orange-100`}>CONSTRUCTION</span>
  if (status === 'APPROVED') return <span className={`${base} bg-sky-700 text-sky-100`}>APPROVED</span>
  if (status === 'PROPOSED') return <span className={`${base} bg-gray-600 text-gray-200`}>PROPOSED</span>
  if (status === 'COMPLETED') return <span className={`${base} bg-emerald-700 text-emerald-100`}>COMPLETED</span>
  return <span className={`${base} bg-gray-600 text-gray-200`}>{status}</span>
}

function rezClassBadge(cls: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-bold'
  if (cls === 'REZ_1') return <span className={`${base} bg-red-700 text-red-100`}>REZ 1</span>
  if (cls === 'REZ_2') return <span className={`${base} bg-orange-600 text-orange-100`}>REZ 2</span>
  return <span className={`${base} bg-yellow-600 text-yellow-100`}>REZ 3</span>
}

function firmingBadge(firming: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  if (firming === 'None') return <span className={`${base} bg-gray-700 text-gray-300`}>None</span>
  if (firming === 'BESS') return <span className={`${base} bg-cyan-700 text-cyan-100`}>BESS</span>
  if (firming.includes('Hydro')) return <span className={`${base} bg-blue-800 text-blue-100`}>Hydro</span>
  if (firming.includes('Gas')) return <span className={`${base} bg-orange-700 text-orange-100`}>Gas</span>
  if (firming.includes('Marinus')) return <span className={`${base} bg-indigo-700 text-indigo-100`}>Interconnect</span>
  return <span className={`${base} bg-gray-600 text-gray-200`}>{firming}</span>
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub?: string
  color?: string
}

function KpiCard({ label, value, sub, color = 'text-white' }: KpiProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border border-gray-700">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-gray-400 text-xs">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Capacity Progress Chart
// ---------------------------------------------------------------------------

function CapacityProgressChart({ records }: { records: RezRecord[] }) {
  const data = records.map(r => ({
    name: r.rez_name.replace(' REZ', '').replace(' (REZ)', ''),
    operating: Math.round(r.operating_capacity_mw),
    committed: Math.round(r.committed_capacity_mw),
    pipeline: Math.round(r.pipeline_capacity_mw),
    potential: r.capacity_potential_gw * 1000,
  }))

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h2 className="text-gray-200 font-semibold mb-4 text-sm uppercase tracking-wide">
        REZ Capacity Progress (MW)
      </h2>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-40}
            textAnchor="end"
            interval={0}
          />
          <YAxis yAxisId="mw" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
          <YAxis yAxisId="potential" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Potential MW', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(value: number, name: string) => [`${value.toLocaleString()} MW`, name]}
          />
          <Legend wrapperStyle={{ paddingTop: 16, color: '#9ca3af', fontSize: 12 }} />
          <Bar yAxisId="mw" dataKey="operating" stackId="a" name="Operating" fill="#22c55e" />
          <Bar yAxisId="mw" dataKey="committed" stackId="a" name="Committed" fill="#3b82f6" />
          <Bar yAxisId="mw" dataKey="pipeline" stackId="a" name="Pipeline" fill="#f59e0b" />
          <Line yAxisId="potential" type="monotone" dataKey="potential" name="Potential" stroke="#a78bfa" strokeWidth={2} dot={{ r: 4, fill: '#a78bfa' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// REZ Zones Table
// ---------------------------------------------------------------------------

const ALL_STATES = ['ALL', 'NSW', 'VIC', 'QLD', 'SA', 'TAS', 'WA']
const ALL_ZONE_STATUSES = ['ALL', 'ACTIVE', 'COMMITTED', 'PRIORITY', 'COMPLETED']

function RezZonesTable({ records }: { records: RezRecord[] }) {
  const [stateFilter, setStateFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const filtered = records.filter(r => {
    if (stateFilter !== 'ALL' && r.state !== stateFilter) return false
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false
    return true
  })

  const btnBase = 'px-3 py-1 rounded text-xs font-medium transition-colors'
  const btnActive = 'bg-indigo-600 text-white'
  const btnInactive = 'bg-gray-700 text-gray-300 hover:bg-gray-600'

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h2 className="text-gray-200 font-semibold mb-3 text-sm uppercase tracking-wide">
        REZ Zone Registry ({filtered.length} zones)
      </h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400 text-xs self-center mr-1">State:</span>
          {ALL_STATES.map(s => (
            <button
              key={s}
              className={`${btnBase} ${stateFilter === s ? btnActive : btnInactive}`}
              onClick={() => setStateFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400 text-xs self-center mr-1">Status:</span>
          {ALL_ZONE_STATUSES.map(s => (
            <button
              key={s}
              className={`${btnBase} ${statusFilter === s ? btnActive : btnInactive}`}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="pb-2 pr-3 font-medium">REZ Name</th>
              <th className="pb-2 pr-3 font-medium">State</th>
              <th className="pb-2 pr-3 font-medium">Technology</th>
              <th className="pb-2 pr-3 font-medium">Status</th>
              <th className="pb-2 pr-3 font-medium text-right">Potential GW</th>
              <th className="pb-2 pr-3 font-medium text-right">Committed MW</th>
              <th className="pb-2 pr-3 font-medium text-right">Operating MW</th>
              <th className="pb-2 pr-3 font-medium text-right">Tx Invest $M</th>
              <th className="pb-2 pr-3 font-medium">Class</th>
              <th className="pb-2 font-medium">Enabling Project</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.rez_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-3 font-medium text-gray-200">{r.rez_name}</td>
                <td className="py-2 pr-3">{r.state}</td>
                <td className="py-2 pr-3">{techBadge(r.technology_focus)}</td>
                <td className="py-2 pr-3">{statusBadge(r.status)}</td>
                <td className="py-2 pr-3 text-right font-mono">{r.capacity_potential_gw.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right font-mono">{r.committed_capacity_mw.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right font-mono text-green-400">{r.operating_capacity_mw.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right font-mono text-amber-400">{r.transmission_investment_m_aud.toFixed(0)}</td>
                <td className="py-2 pr-3">{rezClassBadge(r.rez_class)}</td>
                <td className="py-2 text-gray-400">{r.enabling_project}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-gray-500">No zones match the selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generation Projects Table
// ---------------------------------------------------------------------------

const ALL_TECHNOLOGIES = ['ALL', 'WIND', 'SOLAR']
const ALL_PROJECT_STATUSES = ['ALL', 'OPERATING', 'CONSTRUCTION', 'APPROVED', 'PROPOSED']

function GenerationProjectsTable({ projects }: { projects: RezGenerationProject[] }) {
  const [techFilter, setTechFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const filtered = projects.filter(p => {
    if (techFilter !== 'ALL' && p.technology !== techFilter) return false
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
    return true
  })

  const btnBase = 'px-3 py-1 rounded text-xs font-medium transition-colors'
  const btnActive = 'bg-indigo-600 text-white'
  const btnInactive = 'bg-gray-700 text-gray-300 hover:bg-gray-600'

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h2 className="text-gray-200 font-semibold mb-3 text-sm uppercase tracking-wide">
        Generation Pipeline Projects ({filtered.length} projects)
      </h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400 text-xs self-center mr-1">Technology:</span>
          {ALL_TECHNOLOGIES.map(t => (
            <button
              key={t}
              className={`${btnBase} ${techFilter === t ? btnActive : btnInactive}`}
              onClick={() => setTechFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400 text-xs self-center mr-1">Status:</span>
          {ALL_PROJECT_STATUSES.map(s => (
            <button
              key={s}
              className={`${btnBase} ${statusFilter === s ? btnActive : btnInactive}`}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="pb-2 pr-3 font-medium">Project</th>
              <th className="pb-2 pr-3 font-medium">REZ</th>
              <th className="pb-2 pr-3 font-medium">Technology</th>
              <th className="pb-2 pr-3 font-medium text-right">Capacity MW</th>
              <th className="pb-2 pr-3 font-medium">Developer</th>
              <th className="pb-2 pr-3 font-medium">State</th>
              <th className="pb-2 pr-3 font-medium">Status</th>
              <th className="pb-2 pr-3 font-medium text-right">Year</th>
              <th className="pb-2 pr-3 font-medium text-right">Gen GWh</th>
              <th className="pb-2 font-medium">Firming</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-3 font-medium text-gray-200">{p.project_name}</td>
                <td className="py-2 pr-3 text-gray-400 text-xs">{p.rez_id.replace('REZ_', '').replace(/_/g, ' ')}</td>
                <td className="py-2 pr-3">{techBadge(p.technology)}</td>
                <td className="py-2 pr-3 text-right font-mono">{p.capacity_mw.toLocaleString()}</td>
                <td className="py-2 pr-3">{p.developer}</td>
                <td className="py-2 pr-3">{p.state}</td>
                <td className="py-2 pr-3">{statusBadge(p.status)}</td>
                <td className="py-2 pr-3 text-right font-mono">{p.commissioning_year}</td>
                <td className="py-2 pr-3 text-right font-mono text-green-400">{p.estimated_generation_gwh.toFixed(0)}</td>
                <td className="py-2">{firmingBadge(p.firming_partner)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-gray-500">No projects match the selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function RezDevelopment() {
  const [dashboard, setDashboard] = useState<RezDevDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.getRezDevDashboard()
      .then(data => {
        setDashboard(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message ?? 'Failed to load REZ data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading REZ data...
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 gap-2">
        <AlertCircle size={20} />
        <span>{error ?? 'No data available'}</span>
      </div>
    )
  }

  const totalOperatingMw = Math.round(dashboard.operating_capacity_mw)
  const totalCommittedMw = Math.round(dashboard.committed_capacity_mw)

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <MapPin className="text-green-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-gray-100">Renewable Energy Zone (REZ) Development</h1>
          <p className="text-gray-400 text-sm">
            ISP priority REZs — capacity pipeline, transmission enablement &amp; generation investment
            <span className="ml-3 text-gray-500 text-xs">Updated: {dashboard.timestamp}</span>
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total REZ Zones"
          value={String(dashboard.total_rez_zones)}
          sub="ISP-designated zones"
          color="text-green-400"
        />
        <KpiCard
          label="Total Pipeline"
          value={`${dashboard.total_pipeline_gw.toFixed(1)} GW`}
          sub="Combined potential capacity"
          color="text-violet-400"
        />
        <KpiCard
          label="Operating Capacity"
          value={`${totalOperatingMw.toLocaleString()} MW`}
          sub={`Committed: ${totalCommittedMw.toLocaleString()} MW`}
          color="text-teal-400"
        />
        <KpiCard
          label="Transmission Investment"
          value={`$${dashboard.total_transmission_investment_m_aud.toFixed(0)}M`}
          sub="Enabling infrastructure"
          color="text-amber-400"
        />
      </div>

      {/* Capacity Progress Chart */}
      <CapacityProgressChart records={dashboard.rez_records} />

      {/* REZ Zones Table */}
      <RezZonesTable records={dashboard.rez_records} />

      {/* Generation Projects Table */}
      <GenerationProjectsTable projects={dashboard.generation_projects} />
    </div>
  )
}
