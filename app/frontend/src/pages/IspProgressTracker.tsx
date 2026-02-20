import React, { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Map, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  api,
  IspProgressDashboard,
  IspActionableProject,
  IspCapacityMilestone,
  IspScenarioRecord,
  IspDeliveryRiskRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, string> = {
  COMMITTED:        'bg-green-600 text-white',
  APPROVED:         'bg-blue-600 text-white',
  REGULATED:        'bg-teal-600 text-white',
  UNDER_DEVELOPMENT:'bg-amber-500 text-white',
  STALLED:          'bg-red-600 text-white',
}

const CATEGORY_BADGE: Record<string, string> = {
  COMMITTED:      'bg-green-700 text-green-100',
  ACTIONABLE_ISP: 'bg-blue-700 text-blue-100',
  EARLY_STAGE:    'bg-amber-700 text-amber-100',
  REZ:            'bg-teal-700 text-teal-100',
}

const TYPE_BADGE: Record<string, string> = {
  TRANSMISSION:   'bg-violet-700 text-violet-100',
  INTERCONNECTOR: 'bg-indigo-700 text-indigo-100',
  GENERATION:     'bg-orange-700 text-orange-100',
  STORAGE:        'bg-cyan-700 text-cyan-100',
}

const SCENARIO_COLORS: Record<string, { border: string; header: string; label: string }> = {
  STEP_CHANGE: { border: 'border-green-500',  header: 'bg-green-900/40',  label: 'text-green-400'  },
  CENTRAL:     { border: 'border-blue-500',   header: 'bg-blue-900/40',   label: 'text-blue-400'   },
  SLOW_CHANGE: { border: 'border-amber-500',  header: 'bg-amber-900/40',  label: 'text-amber-400'  },
}

const SCENARIO_DISPLAY: Record<string, string> = {
  STEP_CHANGE: 'Step Change',
  CENTRAL:     'Central',
  SLOW_CHANGE: 'Slow Change',
}

const CATEGORY_DISPLAY: Record<string, string> = {
  TRANSMISSION:   'Transmission',
  REZ_DEVELOPMENT:'REZ Development',
  OFFSHORE_WIND:  'Offshore Wind',
  STORAGE:        'Storage',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt1(v: number): string { return v.toFixed(1) }
function fmt2(v: number): string { return v.toFixed(2) }
function fmtB(v: number): string { return `$${v.toFixed(0)}B` }
function fmtM(v: number): string { return `$${v.toFixed(0)}M` }
function fmtPct(v: number): string { return `${v.toFixed(1)}%` }

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  colour?: string
}

function KpiCard({ label, value, sub, colour = 'text-white' }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${colour}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Capacity Milestone Chart
// ---------------------------------------------------------------------------

interface MilestoneChartProps {
  milestones: IspCapacityMilestone[]
}

function MilestoneChart({ milestones }: MilestoneChartProps) {
  // Filter STEP_CHANGE + NSW1 for a clear view
  const data = milestones
    .filter(m => m.scenario === 'STEP_CHANGE' && m.region === 'NSW1')
    .sort((a, b) => a.year - b.year)
    .map(m => ({
      year: m.year,
      windTarget:  m.wind_target_gw,
      solarTarget: m.solar_target_gw,
      storageTarget: m.storage_target_gwh,
      windActual:  m.wind_actual_gw,
      solarActual: m.solar_actual_gw,
      storageActual: m.storage_actual_gwh,
    }))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-1">
        Capacity Milestones — STEP CHANGE · NSW1 (2025–2035)
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Dashed = target &nbsp;|&nbsp; Solid = actual installed
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" GW" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {/* Targets (dashed) */}
          <Line type="monotone" dataKey="windTarget"    name="Wind Target (GW)"   stroke="#22c55e" strokeDasharray="5 5" dot={false} />
          <Line type="monotone" dataKey="solarTarget"   name="Solar Target (GW)"  stroke="#f59e0b" strokeDasharray="5 5" dot={false} />
          {/* Actuals (solid) */}
          <Line type="monotone" dataKey="windActual"    name="Wind Actual (GW)"   stroke="#22c55e" strokeWidth={2} connectNulls={false} />
          <Line type="monotone" dataKey="solarActual"   name="Solar Actual (GW)"  stroke="#f59e0b" strokeWidth={2} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scenario Cards
// ---------------------------------------------------------------------------

interface ScenarioCardsProps {
  scenarios: IspScenarioRecord[]
}

function ScenarioCards({ scenarios }: ScenarioCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {scenarios.map(s => {
        const c = SCENARIO_COLORS[s.scenario] ?? { border: 'border-gray-600', header: 'bg-gray-700', label: 'text-gray-300' }
        const billSign = s.consumer_bill_impact_aud_yr < 0 ? '' : '+'
        return (
          <div key={s.scenario} className={`bg-gray-800 rounded-lg border-l-4 ${c.border} overflow-hidden`}>
            <div className={`${c.header} px-4 py-3`}>
              <p className={`text-sm font-bold ${c.label}`}>{SCENARIO_DISPLAY[s.scenario] ?? s.scenario}</p>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{s.description}</p>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <p className="text-gray-500">Total Investment</p>
                <p className="text-white font-semibold">{fmtB(s.total_investment_b_aud)} AUD</p>
              </div>
              <div>
                <p className="text-gray-500">Renewables 2035</p>
                <p className="text-white font-semibold">{fmtPct(s.renewables_share_2035_pct)}</p>
              </div>
              <div>
                <p className="text-gray-500">Coal Exit Year</p>
                <p className="text-white font-semibold">{s.coal_exit_year}</p>
              </div>
              <div>
                <p className="text-gray-500">New Storage 2035</p>
                <p className="text-white font-semibold">{fmt1(s.new_storage_gwh_2035)} GWh</p>
              </div>
              <div>
                <p className="text-gray-500">New Transmission</p>
                <p className="text-white font-semibold">{s.new_transmission_km.toLocaleString()} km</p>
              </div>
              <div>
                <p className="text-gray-500">Bill Impact / yr</p>
                <p className={`font-semibold ${s.consumer_bill_impact_aud_yr < 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {billSign}${Math.abs(s.consumer_bill_impact_aud_yr).toFixed(0)}/yr
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Actionable Projects Table
// ---------------------------------------------------------------------------

interface ProjectsTableProps {
  projects: IspActionableProject[]
}

function ProjectsTable({ projects }: ProjectsTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')

  const statuses = ['ALL', 'COMMITTED', 'APPROVED', 'REGULATED', 'UNDER_DEVELOPMENT', 'STALLED']
  const categories = ['ALL', 'COMMITTED', 'ACTIONABLE_ISP', 'EARLY_STAGE', 'REZ']

  const filtered = projects.filter(p =>
    (statusFilter   === 'ALL' || p.status       === statusFilter) &&
    (categoryFilter === 'ALL' || p.isp_category === categoryFilter)
  )

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-200">Actionable Projects</h3>
        <div className="flex gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
          >
            {statuses.map(s => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="pb-2 pr-3 font-medium">Project</th>
              <th className="pb-2 pr-3 font-medium">Type</th>
              <th className="pb-2 pr-3 font-medium">Proponent</th>
              <th className="pb-2 pr-3 font-medium">State</th>
              <th className="pb-2 pr-3 font-medium">Category</th>
              <th className="pb-2 pr-3 font-medium text-right">Cap (MW)</th>
              <th className="pb-2 pr-3 font-medium text-right">Investment</th>
              <th className="pb-2 pr-3 font-medium text-right">BCR</th>
              <th className="pb-2 pr-3 font-medium text-right">Need</th>
              <th className="pb-2 pr-3 font-medium">Status</th>
              <th className="pb-2 font-medium">Regulatory Hurdle</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 text-gray-200 font-medium max-w-[180px]">{p.project_name}</td>
                <td className="py-2 pr-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_BADGE[p.project_type] ?? 'bg-gray-600 text-white'}`}>
                    {p.project_type.charAt(0) + p.project_type.slice(1).toLowerCase()}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-300 max-w-[140px]">{p.proponent}</td>
                <td className="py-2 pr-3 text-gray-300">{p.state}</td>
                <td className="py-2 pr-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${CATEGORY_BADGE[p.isp_category] ?? 'bg-gray-600 text-white'}`}>
                    {p.isp_category.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-300 text-right">{p.capacity_mw.toLocaleString()}</td>
                <td className="py-2 pr-3 text-gray-300 text-right">{fmtM(p.investment_m_aud)}</td>
                <td className="py-2 pr-3 text-right font-semibold text-green-400">{fmt2(p.benefit_cost_ratio)}x</td>
                <td className="py-2 pr-3 text-gray-300 text-right">{p.need_year}</td>
                <td className="py-2 pr-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[p.status] ?? 'bg-gray-600 text-white'}`}>
                    {p.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-2 text-gray-400 max-w-[200px]">
                  {p.regulatory_hurdle ? (
                    <span className="flex items-start gap-1">
                      <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
                      <span>{p.regulatory_hurdle}</span>
                    </span>
                  ) : (
                    <span className="text-green-500">Clear</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 py-6 text-sm">No projects match the selected filters.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delivery Risk Cards
// ---------------------------------------------------------------------------

interface DeliveryRiskCardsProps {
  risks: IspDeliveryRiskRecord[]
}

function ProgressBar({ pct, colour }: { pct: number; colour: string }) {
  return (
    <div className="w-full bg-gray-700 rounded-full h-1.5">
      <div className={`${colour} h-1.5 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

function DeliveryRiskCards({ risks }: DeliveryRiskCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {risks.map(r => (
        <div key={r.project_category} className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-200 mb-1">
            {CATEGORY_DISPLAY[r.project_category] ?? r.project_category}
          </p>
          <p className="text-xs text-gray-500 mb-3">{r.total_projects} projects tracked</p>

          <div className="space-y-2 mb-3">
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-green-400">On Schedule</span>
                <span className="text-green-400">{fmtPct(r.on_schedule_pct)}</span>
              </div>
              <ProgressBar pct={r.on_schedule_pct} colour="bg-green-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-amber-400">At Risk</span>
                <span className="text-amber-400">{fmtPct(r.at_risk_pct)}</span>
              </div>
              <ProgressBar pct={r.at_risk_pct} colour="bg-amber-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-orange-400">Delayed</span>
                <span className="text-orange-400">{fmtPct(r.delayed_pct)}</span>
              </div>
              <ProgressBar pct={r.delayed_pct} colour="bg-orange-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-red-400">Stalled</span>
                <span className="text-red-400">{fmtPct(r.stalled_pct)}</span>
              </div>
              <ProgressBar pct={r.stalled_pct} colour="bg-red-500" />
            </div>
          </div>

          <div className="border-t border-gray-700 pt-3 space-y-2">
            <div>
              <p className="text-xs font-medium text-amber-400 mb-0.5">Key Risk</p>
              <p className="text-xs text-gray-400 leading-snug">{r.key_risk}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-green-400 mb-0.5">Mitigation</p>
              <p className="text-xs text-gray-400 leading-snug">{r.risk_mitigation}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function IspProgressTracker() {
  const [dashboard, setDashboard] = useState<IspProgressDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    api.getIspProgressDashboard()
      .then(d => { setDashboard(d); setLoading(false) })
      .catch(e => { setError(e.message ?? 'Failed to load ISP Progress data'); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Map className="text-green-400 shrink-0" size={28} />
          <div>
            <h1 className="text-xl font-bold text-white">
              AEMO Integrated System Plan (ISP) Progress Tracker
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Optimal Development Path actionable projects · capacity milestones · scenario comparison · transition delivery risk
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 h-24 animate-pulse" />
          ))}
        </div>
      )}

      {dashboard && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Total Actionable Investment"
              value={fmtB(dashboard.total_actionable_investment_b_aud)}
              sub="AUD across 15 ISP projects"
              colour="text-green-400"
            />
            <KpiCard
              label="Committed Projects"
              value={String(dashboard.committed_projects)}
              sub={`of ${dashboard.actionable_projects.length} actionable projects`}
              colour="text-blue-400"
            />
            <KpiCard
              label="Projects On Track"
              value={fmtPct(dashboard.projects_on_track_pct)}
              sub="Committed + Approved + Regulated"
              colour={dashboard.projects_on_track_pct >= 60 ? 'text-green-400' : 'text-amber-400'}
            />
            <KpiCard
              label="STEP CHANGE Renewable Target"
              value={`${fmt1(dashboard.step_change_renewable_target_gw_2030)} GW`}
              sub="Wind + Solar target by 2030 (NSW1)"
              colour="text-teal-400"
            />
          </div>

          {/* Capacity Milestone Chart */}
          <MilestoneChart milestones={dashboard.capacity_milestones} />

          {/* Scenario Comparison */}
          <div>
            <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              ISP Scenario Comparison
            </h2>
            <ScenarioCards scenarios={dashboard.scenarios} />
          </div>

          {/* Actionable Projects Table */}
          <ProjectsTable projects={dashboard.actionable_projects} />

          {/* Delivery Risk */}
          <div>
            <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              Delivery Risk by Project Category
            </h2>
            <DeliveryRiskCards risks={dashboard.delivery_risks} />
          </div>

          {/* Timestamp */}
          <p className="text-xs text-gray-600 text-right">
            Data as of {new Date(dashboard.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
          </p>
        </>
      )}
    </div>
  )
}
