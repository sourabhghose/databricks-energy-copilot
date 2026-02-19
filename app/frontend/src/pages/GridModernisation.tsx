import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts'
import { Wifi, Settings, TrendingUp, Activity, DollarSign, Zap } from 'lucide-react'
import { api } from '../api/client'
import type {
  GridModernisationDashboard,
  SmartMeterRecord,
  GridModernisationProject,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const STATE_COLOURS: Record<string, string> = {
  NSW: 'bg-blue-100 text-blue-700',
  VIC: 'bg-purple-100 text-purple-700',
  SA:  'bg-amber-100 text-amber-700',
  QLD: 'bg-green-100 text-green-700',
  TAS: 'bg-cyan-100 text-cyan-700',
  WA:  'bg-orange-100 text-orange-700',
}

const CATEGORY_COLOURS: Record<string, string> = {
  SCADA_UPGRADE:    'bg-blue-100 text-blue-700',
  DER_MANAGEMENT:   'bg-green-100 text-green-700',
  CYBER_SECURITY:   'bg-red-100 text-red-700',
  EV_INTEGRATION:   'bg-purple-100 text-purple-700',
  FIELD_AUTOMATION: 'bg-amber-100 text-amber-700',
  NETWORK_VISIBILITY: 'bg-cyan-100 text-cyan-700',
}

const STATUS_COLOURS: Record<string, string> = {
  UNDERWAY: 'bg-blue-100 text-blue-700',
  COMPLETE: 'bg-green-100 text-green-700',
  APPROVED: 'bg-amber-100 text-amber-700',
  PLANNED:  'bg-gray-100 text-gray-600',
}

function saidiBarColour(saidi: number): string {
  if (saidi < 80) return '#22c55e'   // green
  if (saidi < 120) return '#f59e0b'  // amber
  return '#ef4444'                    // red
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${accent}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function StateChip({ state }: { state: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${STATE_COLOURS[state] ?? 'bg-gray-100 text-gray-600'}`}>
      {state}
    </span>
  )
}

function CategoryBadge({ category }: { category: string }) {
  const label = category.replace(/_/g, ' ')
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${CATEGORY_COLOURS[category] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLOURS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Penetration chart
// ---------------------------------------------------------------------------

function PenetrationChart({ records }: { records: SmartMeterRecord[] }) {
  const sorted = [...records].sort((a, b) => a.penetration_pct - b.penetration_pct)
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Smart Meter Penetration by DNSP (%) vs 2030 Target
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={sorted} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="dnsp"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            domain={[0, 110]}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)}%`,
              name === 'penetration_pct' ? 'Penetration' : 'Target',
            ]}
          />
          <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
          <Bar dataKey="penetration_pct" name="Penetration %" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="smart_meter_target_pct" name="2030 Target %" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SAIDI chart
// ---------------------------------------------------------------------------

function SaidiChart({ records }: { records: { dnsp: string; saidi_minutes: number }[] }) {
  const sorted = [...records].sort((a, b) => a.saidi_minutes - b.saidi_minutes)
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Network Reliability — SAIDI (Minutes/Year, 2025)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={sorted} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="dnsp"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickFormatter={(v: number) => `${v} min`}
          />
          <Tooltip formatter={(v: number) => [`${v.toFixed(1)} min`, 'SAIDI']} />
          <ReferenceLine y={80}  stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'Good', position: 'right', fontSize: 10, fill: '#22c55e' }} />
          <ReferenceLine y={120} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Threshold', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
          <Bar dataKey="saidi_minutes" name="SAIDI (min)" radius={[3, 3, 0, 0]}>
            {sorted.map((entry) => (
              <Cell key={entry.dnsp} fill={saidiBarColour(entry.saidi_minutes)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Smart Meter Table
// ---------------------------------------------------------------------------

const ALL_STATES = ['ALL', 'NSW', 'VIC', 'SA', 'QLD', 'TAS', 'WA']

function SmartMeterTable({ records }: { records: SmartMeterRecord[] }) {
  const [stateFilter, setStateFilter] = useState('ALL')

  const filtered = stateFilter === 'ALL'
    ? records
    : records.filter(r => r.state === stateFilter)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Smart Meter Penetration Details
        </h3>
        <div className="flex gap-1 flex-wrap">
          {ALL_STATES.map(s => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                stateFilter === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-3 font-medium">DNSP</th>
              <th className="py-2 pr-3 font-medium">State</th>
              <th className="py-2 pr-3 font-medium text-right">Total Pts (k)</th>
              <th className="py-2 pr-3 font-medium text-right">Installed (k)</th>
              <th className="py-2 pr-3 font-medium">Penetration %</th>
              <th className="py-2 pr-3 font-medium text-right">Interval Data %</th>
              <th className="py-2 pr-3 font-medium text-right">TOU Tariff %</th>
              <th className="py-2 pr-3 font-medium text-right">Demand Tariff %</th>
              <th className="py-2 pr-3 font-medium text-right">Annual Rollout %</th>
              <th className="py-2 font-medium text-right">Cost ($/meter)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(r => (
              <tr key={r.dnsp} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-200">{r.dnsp}</td>
                <td className="py-2 pr-3"><StateChip state={r.state} /></td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">
                  {(r.total_customer_points / 1000).toFixed(0)}k
                </td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">
                  {(r.smart_meters_installed / 1000).toFixed(0)}k
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 min-w-[60px]">
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${Math.min(r.penetration_pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 w-10 text-right">
                      {r.penetration_pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">
                  {r.interval_data_enabled_pct.toFixed(1)}%
                </td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">
                  {r.tou_tariff_customers_pct.toFixed(1)}%
                </td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">
                  {r.demand_tariff_customers_pct.toFixed(1)}%
                </td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">
                  {r.annual_rollout_rate_pct.toFixed(1)}%
                </td>
                <td className="py-2 text-right text-gray-700 dark:text-gray-300">
                  ${r.cost_per_meter_aud.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 dark:text-gray-500 py-6 text-sm">
            No records for selected state.
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grid Modernisation Projects Table
// ---------------------------------------------------------------------------

const ALL_CATEGORIES = ['ALL', 'SCADA_UPGRADE', 'DER_MANAGEMENT', 'CYBER_SECURITY', 'EV_INTEGRATION', 'FIELD_AUTOMATION', 'NETWORK_VISIBILITY']
const ALL_STATUSES   = ['ALL', 'UNDERWAY', 'COMPLETE', 'APPROVED', 'PLANNED']

function ProjectsTable({ projects }: { projects: GridModernisationProject[] }) {
  const [catFilter, setCatFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const filtered = projects.filter(p => {
    const catOk = catFilter === 'ALL' || p.category === catFilter
    const statusOk = statusFilter === 'ALL' || p.status === statusFilter
    return catOk && statusOk
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Grid Modernisation Capital Projects
        </h3>
        <div className="flex flex-col gap-2">
          <div className="flex gap-1 flex-wrap">
            {ALL_CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                  catFilter === c
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {c === 'ALL' ? 'All Categories' : c.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {ALL_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {s === 'ALL' ? 'All Statuses' : s}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-3 font-medium">Project</th>
              <th className="py-2 pr-3 font-medium">DNSP</th>
              <th className="py-2 pr-3 font-medium">State</th>
              <th className="py-2 pr-3 font-medium">Category</th>
              <th className="py-2 pr-3 font-medium text-right">Capex ($M)</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium text-right">Year</th>
              <th className="py-2 pr-3 font-medium text-right">Customers</th>
              <th className="py-2 font-medium text-right">Reliability Impr.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(p => (
              <tr key={p.project_id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="py-2 pr-3">
                  <div className="font-medium text-gray-800 dark:text-gray-200 max-w-[200px]">
                    {p.project_name}
                  </div>
                  <div className="text-gray-400 dark:text-gray-500 text-xs mt-0.5 max-w-[200px] line-clamp-2">
                    {p.description}
                  </div>
                </td>
                <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{p.dnsp}</td>
                <td className="py-2 pr-3"><StateChip state={p.state} /></td>
                <td className="py-2 pr-3"><CategoryBadge category={p.category} /></td>
                <td className="py-2 pr-3 text-right font-medium text-gray-800 dark:text-gray-200">
                  ${p.capex_m_aud.toFixed(0)}M
                </td>
                <td className="py-2 pr-3"><StatusBadge status={p.status} /></td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">
                  {p.completion_year}
                </td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">
                  {(p.customers_benefiting / 1000).toFixed(0)}k
                </td>
                <td className="py-2 text-right">
                  {p.reliability_improvement_pct > 0 ? (
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      +{p.reliability_improvement_pct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 dark:text-gray-500 py-6 text-sm">
            No projects match the selected filters.
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function GridModernisation() {
  const [dashboard, setDashboard] = useState<GridModernisationDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getGridModernisationDashboard()
      .then(data => {
        setDashboard(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load grid modernisation data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400 text-sm animate-pulse">
          Loading grid modernisation data…
        </div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
          {error ?? 'No data available.'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600">
            <Wifi size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Smart Meter &amp; Grid Modernisation Analytics
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              AMI rollout, interval data, TOU adoption, demand response enablement &amp; grid investment programs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold">
            <Wifi size={14} />
            National AMI: {dashboard.national_smart_meter_pct.toFixed(1)}% penetration
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="National Smart Meter %"
          value={`${dashboard.national_smart_meter_pct.toFixed(1)}%`}
          sub="Weighted avg. across all DNSPs"
          icon={Wifi}
          accent="bg-blue-600"
        />
        <KpiCard
          title="TOU Tariff Adoption"
          value={`${dashboard.tou_tariff_adoption_pct.toFixed(1)}%`}
          sub="Of smart meter customers on TOU"
          icon={Activity}
          accent="bg-purple-600"
        />
        <KpiCard
          title="Grid Mod Investment"
          value={`$${dashboard.total_grid_mod_investment_m_aud.toFixed(0)}M`}
          sub="Total capex across active programs"
          icon={DollarSign}
          accent="bg-green-600"
        />
        <KpiCard
          title="Projects Underway"
          value={String(dashboard.projects_underway)}
          sub={`Avg SAIDI ${dashboard.avg_saidi_minutes.toFixed(0)} min/year nationally`}
          icon={TrendingUp}
          accent="bg-amber-600"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PenetrationChart records={dashboard.smart_meter_records} />
        <SaidiChart records={dashboard.reliability_stats} />
      </div>

      {/* Smart Meter Table */}
      <SmartMeterTable records={dashboard.smart_meter_records} />

      {/* Grid Modernisation Projects Table */}
      <ProjectsTable projects={dashboard.grid_mod_projects} />

      {/* Footer note */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
        Source: AER Distribution Determination, AEMC Smart Meter Roadmap, DNSP Regulatory Proposals 2025–26.
        Data as at {new Date(dashboard.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST.
      </p>
    </div>
  )
}
