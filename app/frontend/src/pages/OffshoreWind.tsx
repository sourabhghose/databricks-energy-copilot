import { useState, useEffect } from 'react'
import { Wind, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import {
  api,
  type OffshoreWindDashboard,
  type OffshoreWindProject,
  type OffshoreWindZoneSummary,
  type OffshoreTimeline,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function FoundationBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    MONOPILE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    JACKET: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    FLOATING: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    TBD: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }
  const cls = colorMap[type] ?? colorMap.TBD
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {type}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    FEASIBILITY: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    ENVIRONMENT_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    APPROVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    CONSTRUCTION: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    PROPOSED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  }
  const cls = colorMap[status] ?? colorMap.PROPOSED
  const label = status.replace('_', ' ')
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function BoolIcon({ val }: { val: boolean }) {
  return val
    ? <CheckCircle size={14} className="text-green-500 inline" />
    : <XCircle size={14} className="text-red-400 inline" />
}

// ---------------------------------------------------------------------------
// ZonesTable
// ---------------------------------------------------------------------------

function ZonesTable({ zones }: { zones: OffshoreWindZoneSummary[] }) {
  if (!zones.length) return <p className="text-sm text-gray-400 py-4">No zones data.</p>
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase text-left">
            <th className="px-3 py-2 font-medium">Zone</th>
            <th className="px-3 py-2 font-medium">State</th>
            <th className="px-3 py-2 font-medium text-right">Total MW</th>
            <th className="px-3 py-2 font-medium text-right">Projects</th>
            <th className="px-3 py-2 font-medium text-right">Avg Depth m</th>
            <th className="px-3 py-2 font-medium text-right">Avg Dist km</th>
            <th className="px-3 py-2 font-medium text-right">Declared</th>
            <th className="px-3 py-2 font-medium text-right">Area km²</th>
            <th className="px-3 py-2 font-medium text-right">Wind m/s</th>
            <th className="px-3 py-2 font-medium text-right">Cap Factor %</th>
            <th className="px-3 py-2 font-medium">Grid Connection</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {zones.map((z) => (
            <tr key={z.zone_name} className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{z.zone_name}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{z.state}</td>
              <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{z.total_capacity_mw.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{z.num_projects}</td>
              <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{z.avg_water_depth_m}</td>
              <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{z.avg_distance_km}</td>
              <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{z.declared_year}</td>
              <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{z.area_km2.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{z.wind_speed_ms}</td>
              <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{z.capacity_factor_pct}%</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{z.grid_connection_point}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectsTable
// ---------------------------------------------------------------------------

const ALL_STATES = ['All', 'VIC', 'NSW', 'WA', 'SA', 'QLD']
const ALL_STATUSES = ['All', 'FEASIBILITY', 'ENVIRONMENT_REVIEW', 'APPROVED', 'CONSTRUCTION', 'PROPOSED']

function ProjectsTable({ initialProjects }: { initialProjects: OffshoreWindProject[] }) {
  const [stateFilter, setStateFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [projects, setProjects] = useState<OffshoreWindProject[]>(initialProjects)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setProjects(initialProjects)
  }, [initialProjects])

  const handleFilter = async (state: string, status: string) => {
    setStateFilter(state)
    setStatusFilter(status)
    setLoading(true)
    try {
      const params: { state?: string; status?: string } = {}
      if (state !== 'All') params.state = state
      if (status !== 'All') params.status = status
      const data = await api.getOffshoreProjects(params)
      setProjects(data)
    } catch {
      // keep existing data on error
    } finally {
      setLoading(false)
    }
  }

  const setStateAndFilter = (s: string) => handleFilter(s, statusFilter)
  const setStatusAndFilter = (s: string) => handleFilter(stateFilter, s)

  const filterBtn = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1">State:</span>
        {ALL_STATES.map(s => filterBtn(s, stateFilter === s, () => setStateAndFilter(s)))}
        <span className="text-xs text-gray-500 dark:text-gray-400 self-center ml-3 mr-1">Status:</span>
        {ALL_STATUSES.map(s => filterBtn(s, statusFilter === s, () => setStatusAndFilter(s)))}
      </div>
      {loading && <p className="text-xs text-gray-400 py-2">Loading...</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase text-left">
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Developer</th>
              <th className="px-3 py-2 font-medium">Zone</th>
              <th className="px-3 py-2 font-medium text-right">MW</th>
              <th className="px-3 py-2 font-medium text-right">Turbines</th>
              <th className="px-3 py-2 font-medium">Foundation</th>
              <th className="px-3 py-2 font-medium text-right">LCOE $/MWh</th>
              <th className="px-3 py-2 font-medium text-right">Capex $B</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-center">Feasibility</th>
              <th className="px-3 py-2 font-medium text-center">Env</th>
              <th className="px-3 py-2 font-medium text-center">Fin Close</th>
              <th className="px-3 py-2 font-medium text-right">Commiss.</th>
              <th className="px-3 py-2 font-medium text-right">Jobs (Build)</th>
              <th className="px-3 py-2 font-medium text-right">Jobs (Ops)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {projects.map((p) => (
              <tr key={p.project_id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">{p.project_name}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{p.developer}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{p.zone}</td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{p.capacity_mw.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{p.turbine_count}</td>
                <td className="px-3 py-2"><FoundationBadge type={p.foundation_type} /></td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">${p.lcoe_aud_mwh.toFixed(0)}</td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">${p.capex_b_aud.toFixed(2)}B</td>
                <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                <td className="px-3 py-2 text-center"><BoolIcon val={p.feasibility_licence} /></td>
                <td className="px-3 py-2 text-center"><BoolIcon val={p.environment_approval} /></td>
                <td className="px-3 py-2 text-center"><BoolIcon val={p.financial_close} /></td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{p.commissioning_year ?? '—'}</td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{p.jobs_construction.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{p.jobs_operations.toLocaleString()}</td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={15} className="px-3 py-6 text-center text-gray-400">No projects match the selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TimelineTable
// ---------------------------------------------------------------------------

function TimelineTable({ milestones }: { milestones: OffshoreTimeline[] }) {
  if (!milestones.length) return <p className="text-sm text-gray-400 py-4">No milestones data.</p>
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase text-left">
            <th className="px-3 py-2 font-medium">Project</th>
            <th className="px-3 py-2 font-medium">Milestone</th>
            <th className="px-3 py-2 font-medium text-right">Planned</th>
            <th className="px-3 py-2 font-medium text-right">Actual</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {milestones.map((m, idx) => (
            <tr key={`${m.project_id}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">{m.project_name}</td>
              <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{m.milestone}</td>
              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{m.planned_year}</td>
              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{m.actual_year ?? 'Pending'}</td>
              <td className="px-3 py-2">
                {m.completed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <CheckCircle size={10} /> Complete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    <AlertCircle size={10} /> Pending
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{m.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Capacity by Zone bar chart (simple CSS-based)
// ---------------------------------------------------------------------------

function ZoneCapacityChart({ zones }: { zones: OffshoreWindZoneSummary[] }) {
  if (!zones.length) return null
  const maxMw = Math.max(...zones.map(z => z.total_capacity_mw))
  const sorted = [...zones].sort((a, b) => b.total_capacity_mw - a.total_capacity_mw)
  return (
    <div className="space-y-2">
      {sorted.map(z => (
        <div key={z.zone_name} className="flex items-center gap-3">
          <div className="w-32 text-xs text-gray-600 dark:text-gray-300 truncate text-right">{z.zone_name}</div>
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 relative">
            <div
              className="bg-blue-500 dark:bg-blue-400 h-4 rounded-full transition-all duration-500"
              style={{ width: `${(z.total_capacity_mw / maxMw) * 100}%` }}
            />
          </div>
          <div className="w-20 text-xs text-gray-700 dark:text-gray-200 text-right">
            {z.total_capacity_mw.toLocaleString()} MW
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function OffshoreWind() {
  const [dashboard, setDashboard] = useState<OffshoreWindDashboard | null>(null)
  const [zones, setZones] = useState<OffshoreWindZoneSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'zones' | 'projects' | 'timeline' | 'chart'>('zones')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [dash, zoneList] = await Promise.all([
          api.getOffshoreWindDashboard(),
          api.getOffshoreZones(),
        ])
        setDashboard(dash)
        setZones(zoneList)
      } catch (e) {
        setError('Failed to load offshore wind data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const tab = (id: typeof activeTab, label: string) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeTab === id
          ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="p-6 max-w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
          <Wind size={22} className="text-blue-600 dark:text-blue-300" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Offshore Wind Project Tracker
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Australia
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Offshore Electricity Infrastructure Act 2021 — declared zones and project pipeline
          </p>
        </div>
      </div>

      {/* Note banner */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
        Australia declared its first offshore wind zones in Bass Strait (Gippsland, Star of the South) in late 2022 under the
        Offshore Electricity Infrastructure Act 2021. Total pipeline exceeds 25 GW.
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Loading offshore wind data...</span>
        </div>
      )}

      {!loading && dashboard && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Total Proposed Capacity"
              value={`${dashboard.total_proposed_capacity_gw} GW`}
              sub="Across all projects"
            />
            <KpiCard
              label="Projects with Feasibility Licence"
              value={dashboard.projects_with_feasibility_licence}
              sub="Licences granted by DCCEEW"
            />
            <KpiCard
              label="Projects in Construction"
              value={dashboard.projects_in_construction}
              sub="Under active development"
            />
            <KpiCard
              label="Earliest Commissioning"
              value={dashboard.earliest_commissioning_year}
              sub="First power expected"
            />
          </div>

          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
              {tab('zones', 'Declared Zones')}
              {tab('projects', 'Projects')}
              {tab('timeline', 'Milestone Timeline')}
              {tab('chart', 'Capacity by Zone')}
            </div>

            <div className="p-4">
              {activeTab === 'zones' && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    Declared Offshore Wind Zones
                  </h2>
                  <ZonesTable zones={zones} />
                </div>
              )}

              {activeTab === 'projects' && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    Project Pipeline ({dashboard.projects.length} projects)
                  </h2>
                  <ProjectsTable initialProjects={dashboard.projects} />
                </div>
              )}

              {activeTab === 'timeline' && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    Milestone Tracker
                  </h2>
                  <TimelineTable milestones={dashboard.timeline_milestones} />
                </div>
              )}

              {activeTab === 'chart' && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
                    Proposed Capacity by Zone (MW)
                  </h2>
                  <ZoneCapacityChart zones={zones} />
                </div>
              )}
            </div>
          </div>

          {/* Summary footer */}
          <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Last updated: {dashboard.timestamp} AEST
          </div>
        </>
      )}
    </div>
  )
}
