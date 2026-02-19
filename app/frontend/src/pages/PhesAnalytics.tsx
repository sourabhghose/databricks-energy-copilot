import { useEffect, useState } from 'react'
import { Droplets, Zap, TrendingUp, Building2, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Legend,
} from 'recharts'
import { api } from '../api/client'
import type { PhesDashboard, PhesProject, PhesOperationRecord, PhesMarketOutlook } from '../api/client'

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{title}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPERATING: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    CONSTRUCTION: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    APPROVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    FEASIBILITY: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    PROPOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }
  const cls = map[status] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

function IspRoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    COMMITTED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    ACTIONABLE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    ANTICIPATED: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    NOT_IN_ISP: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }
  const cls = map[role] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {role.replace('_', ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// OutlookChart
// ---------------------------------------------------------------------------

function OutlookChart({ data }: { data: PhesMarketOutlook[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
        PHES Capacity Outlook 2025\u20132035
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="phesCapGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}GW`}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'total_phes_capacity_mw') return [`${value.toLocaleString()} MW`, 'PHES Capacity']
              if (name === 'isp_target_mw') return [`${value.toLocaleString()} MW`, 'ISP Target']
              return [value, name]
            }}
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
              fontSize: '12px',
            }}
          />
          <Legend
            formatter={(value: string) => {
              if (value === 'total_phes_capacity_mw') return 'PHES Capacity (MW)'
              if (value === 'isp_target_mw') return 'ISP Target (MW)'
              return value
            }}
          />
          <Area
            type="monotone"
            dataKey="total_phes_capacity_mw"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#phesCapGrad)"
          />
          <Area
            type="monotone"
            dataKey="isp_target_mw"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="6 3"
            fill="none"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectsTable
// ---------------------------------------------------------------------------

function ProjectsTable({ projects }: { projects: PhesProject[] }) {
  const [stateFilter, setStateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const states = Array.from(new Set(projects.map((p) => p.state))).sort()
  const statuses = Array.from(new Set(projects.map((p) => p.status))).sort()

  const filtered = projects.filter((p) => {
    if (stateFilter && p.state !== stateFilter) return false
    if (statusFilter && p.status !== statusFilter) return false
    return true
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1">
          PHES Project Pipeline
        </h3>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          <option value="">All States</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {[
                'Project Name', 'Developer', 'State', 'Capacity MW',
                'Storage Hrs', 'Energy MWh', 'Head Ht (m)', 'Status',
                'Capex $B', 'LCOE $/MWh', 'ISP Role', 'Comm. Year', 'Jobs (Peak)',
              ].map((h) => (
                <th
                  key={h}
                  className="text-left py-2 px-2 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.project_id}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <td className="py-2 px-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{p.project_name}</td>
                <td className="py-2 px-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.developer}</td>
                <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{p.state}</td>
                <td className="py-2 px-2 text-right font-mono text-gray-800 dark:text-gray-200">{p.capacity_mw.toLocaleString()}</td>
                <td className="py-2 px-2 text-right font-mono text-gray-800 dark:text-gray-200">{p.storage_hours}</td>
                <td className="py-2 px-2 text-right font-mono text-gray-800 dark:text-gray-200">{p.energy_capacity_mwh.toLocaleString()}</td>
                <td className="py-2 px-2 text-right font-mono text-gray-800 dark:text-gray-200">{p.head_height_m.toLocaleString()}</td>
                <td className="py-2 px-2"><StatusBadge status={p.status} /></td>
                <td className="py-2 px-2 text-right font-mono text-gray-800 dark:text-gray-200">${p.capex_b_aud.toFixed(1)}B</td>
                <td className="py-2 px-2 text-right font-mono text-gray-800 dark:text-gray-200">${p.lcoe_aud_mwh.toFixed(0)}</td>
                <td className="py-2 px-2"><IspRoleBadge role={p.isp_role} /></td>
                <td className="py-2 px-2 text-right font-mono text-gray-800 dark:text-gray-200">{p.commissioning_year ?? '\u2014'}</td>
                <td className="py-2 px-2 text-right font-mono text-gray-800 dark:text-gray-200">{p.jobs_peak_construction.toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="py-6 text-center text-gray-400 dark:text-gray-500">
                  No projects match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OperationsChart
// ---------------------------------------------------------------------------

function OperationsChart({ operations }: { operations: PhesOperationRecord[] }) {
  const snowyOps = operations.filter((o) => o.project_id === 'SNOWY1')

  const chartData = snowyOps.map((o) => ({
    month: o.date.slice(0, 7),
    generation_mwh: Math.round(o.generation_mwh),
    pumping_mwh: Math.round(o.pumping_mwh),
    net_mwh: Math.round(o.net_mwh),
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
        Snowy Scheme \u2014 Monthly Generation vs Pumping (2025)
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Generation MWh (blue bars), Pumping MWh (amber bars), Net MWh (line)
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#9ca3af" />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                generation_mwh: 'Generation MWh',
                pumping_mwh: 'Pumping MWh',
                net_mwh: 'Net MWh',
              }
              return [`${value.toLocaleString()} MWh`, labels[name] ?? name]
            }}
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
              fontSize: '12px',
            }}
          />
          <Legend
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                generation_mwh: 'Generation MWh',
                pumping_mwh: 'Pumping MWh',
                net_mwh: 'Net MWh',
              }
              return labels[value] ?? value
            }}
          />
          <Bar yAxisId="left" dataKey="generation_mwh" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="pumping_mwh" fill="#f59e0b" radius={[2, 2, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="net_mwh"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: '#10b981' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PhesAnalytics() {
  const [dashboard, setDashboard] = useState<PhesDashboard | null>(null)
  const [outlook, setOutlook] = useState<PhesMarketOutlook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, out] = await Promise.all([
        api.getPhesDashboard(),
        api.getPhesOutlook(),
      ])
      setDashboard(dash)
      setOutlook(out)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PHES data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600">
            <Droplets size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Pumped Hydro Energy Storage (PHES)
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Investment analytics, project pipeline, and market outlook
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastUpdated.toLocaleTimeString('en-AU')}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="Total Operating + Construction"
            value={`${dashboard.total_operating_mw.toLocaleString()} MW`}
            sub="Including Snowy Scheme existing assets"
            icon={Zap}
            color="bg-blue-600"
          />
          <KpiCard
            title="Total Pipeline"
            value={`${dashboard.total_pipeline_mw.toLocaleString()} MW`}
            sub="Approved, feasibility and proposed"
            icon={TrendingUp}
            color="bg-amber-500"
          />
          <KpiCard
            title="Total Storage Capacity"
            value={`${dashboard.total_storage_gwh.toFixed(1)} GWh`}
            sub="Operating + pipeline combined"
            icon={Droplets}
            color="bg-teal-600"
          />
          <KpiCard
            title="Largest Project"
            value={dashboard.largest_project}
            sub="By installed capacity"
            icon={Building2}
            color="bg-purple-600"
          />
        </div>
      )}

      {/* Snowy 2.0 Highlight Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 flex items-start gap-3">
        <Droplets size={18} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Snowy 2.0</strong> is Australia's largest energy storage project at{' '}
          <strong>2,000 MW / 350 hours</strong>, with <strong>350+ GWh of storage capacity</strong>.
          When complete, it will provide enough energy to power 3 million homes for a week and will be
          critical to supporting Australia's transition to 82% renewable energy by 2030.
        </p>
      </div>

      {/* Outlook Chart */}
      {outlook.length > 0 && <OutlookChart data={outlook} />}

      {/* Projects Table */}
      {dashboard && dashboard.projects.length > 0 && (
        <ProjectsTable projects={dashboard.projects} />
      )}

      {/* Operations Chart */}
      {dashboard && dashboard.operations.length > 0 && (
        <OperationsChart operations={dashboard.operations} />
      )}

      {/* Additional market context */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Technology Advantages
            </h4>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
              <li className="flex items-start gap-1.5">
                <span className="text-blue-500 font-bold mt-0.5">&#x2022;</span>
                Long-duration storage (8\u2013350 hours)
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-500 font-bold mt-0.5">&#x2022;</span>
                50\u2013100 year asset life
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-500 font-bold mt-0.5">&#x2022;</span>
                75\u201382% round-trip efficiency
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-500 font-bold mt-0.5">&#x2022;</span>
                Provides firm capacity and system strength
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-500 font-bold mt-0.5">&#x2022;</span>
                FCAS and arbitrage revenue streams
              </li>
            </ul>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              ISP Role Definitions
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <IspRoleBadge role="COMMITTED" />
                <span className="text-gray-600 dark:text-gray-400">Under construction or financed</span>
              </div>
              <div className="flex items-center gap-2">
                <IspRoleBadge role="ACTIONABLE" />
                <span className="text-gray-600 dark:text-gray-400">Required within planning horizon</span>
              </div>
              <div className="flex items-center gap-2">
                <IspRoleBadge role="ANTICIPATED" />
                <span className="text-gray-600 dark:text-gray-400">Needed under most scenarios</span>
              </div>
              <div className="flex items-center gap-2">
                <IspRoleBadge role="NOT_IN_ISP" />
                <span className="text-gray-600 dark:text-gray-400">Not in current step change</span>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Key Investment Metrics
            </h4>
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>LCOE Range</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">$110\u2013200/MWh</span>
              </div>
              <div className="flex justify-between">
                <span>Typical Construction Period</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">5\u201310 years</span>
              </div>
              <div className="flex justify-between">
                <span>Operational Life</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">50\u2013100 years</span>
              </div>
              <div className="flex justify-between">
                <span>Total Pipeline Investment</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">~$40B+ AUD</span>
              </div>
              <div className="flex justify-between">
                <span>ISP 2030 Storage Target</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">~22 GW</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
