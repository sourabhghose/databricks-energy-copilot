import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { FileText, BookOpen, AlertTriangle, Calendar, CheckCircle, Clock } from 'lucide-react'
import { api } from '../api/client'
import type {
  RegulatoryDashboard,
  RuleChangeRequest,
  AerDetermination,
  RegulatoryCalendarEvent,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string): string {
  switch (status) {
    case 'OPEN_CONSULTATION': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'DRAFT_RULE':        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    case 'FINAL_RULE':        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'WITHDRAWN':         return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    case 'RULE_DETERMINATION':return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    case 'FINAL':             return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'DRAFT':             return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    case 'APPEAL':            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'INTERIM':           return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    default:                  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
  }
}

function impactBadge(impact: string): string {
  switch (impact) {
    case 'TRANSFORMATIVE': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    case 'HIGH':           return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
    case 'MEDIUM':         return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
    case 'LOW':            return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    default:               return 'bg-gray-100 text-gray-600'
  }
}

function categoryBadge(cat: string): string {
  switch (cat) {
    case 'MARKETS':     return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
    case 'NETWORK':     return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300'
    case 'CONSUMERS':   return 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300'
    case 'RELIABILITY': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
    case 'SECURITY':    return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    case 'METERING':    return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
    default:            return 'bg-gray-100 text-gray-600'
  }
}

function urgencyDot(urgency: string): string {
  switch (urgency) {
    case 'IMMEDIATE': return 'bg-red-500'
    case 'SOON':      return 'bg-amber-500'
    case 'UPCOMING':  return 'bg-green-500'
    default:          return 'bg-blue-400'
  }
}

function eventTypeBadge(type: string): string {
  switch (type) {
    case 'SUBMISSION_DUE':    return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    case 'CONSULTATION_OPEN': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    case 'DETERMINATION':     return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
    case 'EFFECTIVE_DATE':    return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    case 'HEARING':           return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
    default:                  return 'bg-gray-100 text-gray-600'
  }
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiProps {
  label: string
  value: number | string
  icon: React.ReactNode
  highlight?: 'amber' | 'red' | 'none'
}

function KpiCard({ label, value, icon, highlight = 'none' }: KpiProps) {
  const borderCls =
    highlight === 'red'   ? 'border-l-4 border-red-500' :
    highlight === 'amber' ? 'border-l-4 border-amber-500' :
                            'border-l-4 border-blue-500'
  const valCls =
    highlight === 'red'   ? 'text-red-600 dark:text-red-400' :
    highlight === 'amber' ? 'text-amber-600 dark:text-amber-400' :
                            'text-gray-900 dark:text-gray-100'

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${borderCls}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
      </div>
      <div className={`text-3xl font-bold ${valCls}`}>{value}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Calendar Timeline
// ---------------------------------------------------------------------------
function CalendarTimeline({ events }: { events: RegulatoryCalendarEvent[] }) {
  const upcoming = events.filter(e => e.days_from_now <= 30).sort((a, b) => a.days_from_now - b.days_from_now)
  if (upcoming.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        No events in the next 30 days.
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {upcoming.map(ev => (
        <div key={ev.event_id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="mt-1 shrink-0">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${urgencyDot(ev.urgency)}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${eventTypeBadge(ev.event_type)}`}>
                {ev.event_type.replace(/_/g, ' ')}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                {ev.body}
              </span>
              {ev.urgency === 'IMMEDIATE' && (
                <span className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle size={11} /> IMMEDIATE
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{ev.title}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {ev.date}
              </span>
              <span>{ev.days_from_now} day{ev.days_from_now !== 1 ? 's' : ''} away</span>
              {ev.related_rcr && (
                <span className="font-mono text-blue-600 dark:text-blue-400">{ev.related_rcr}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rule Changes Table
// ---------------------------------------------------------------------------
function RuleChangesTable({ ruleChanges }: { ruleChanges: RuleChangeRequest[] }) {
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const categories = Array.from(new Set(ruleChanges.map(r => r.category))).sort()
  const statuses = Array.from(new Set(ruleChanges.map(r => r.status))).sort()

  const filtered = ruleChanges.filter(r => {
    if (catFilter && r.category !== catFilter) return false
    if (statusFilter && r.status !== statusFilter) return false
    return true
  })

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        {(catFilter || statusFilter) && (
          <button
            onClick={() => { setCatFilter(''); setStatusFilter('') }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400 self-center ml-auto">
          {filtered.length} of {ruleChanges.length} records
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">RCR ID</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Title</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Proponent</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Category</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Status</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Impact</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Lodged</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Determination</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rc, i) => (
              <tr
                key={rc.rcr_id}
                className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/30'}`}
              >
                <td className="py-2 px-3">
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{rc.rcr_id}</span>
                </td>
                <td className="py-2 px-3 max-w-xs">
                  <span className="block truncate text-gray-900 dark:text-gray-100" title={rc.title}>
                    {rc.title}
                  </span>
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 font-medium">
                    {rc.proponent}
                  </span>
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${categoryBadge(rc.category)}`}>
                    {rc.category}
                  </span>
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${statusBadge(rc.status)}`}>
                    {rc.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${impactBadge(rc.impact_level)}`}>
                    {rc.impact_level}
                  </span>
                </td>
                <td className="py-2 px-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{rc.lodged_date}</td>
                <td className="py-2 px-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                  {rc.determination_date ?? <span className="text-gray-400 dark:text-gray-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AER Determinations Table
// ---------------------------------------------------------------------------
function AerTable({ determinations }: { determinations: AerDetermination[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">ID</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Title</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Network</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">State</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Type</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Period</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Revenue ($M)</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">WACC %</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Status</th>
          </tr>
        </thead>
        <tbody>
          {determinations.map((det, i) => (
            <tr
              key={det.determination_id}
              className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/30'}`}
            >
              <td className="py-2 px-3">
                <span className="font-mono text-gray-500 dark:text-gray-400 text-xs">{det.determination_id}</span>
              </td>
              <td className="py-2 px-3 max-w-xs">
                <span className="block truncate text-gray-900 dark:text-gray-100 font-medium" title={det.title}>
                  {det.title}
                </span>
              </td>
              <td className="py-2 px-3 whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">
                {det.network_business}
              </td>
              <td className="py-2 px-3 whitespace-nowrap">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 font-medium">
                  {det.state}
                </span>
              </td>
              <td className="py-2 px-3 whitespace-nowrap">
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
                  {det.determination_type.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="py-2 px-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{det.effective_period}</td>
              <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {det.allowed_revenue_m_aud != null
                  ? `$${det.allowed_revenue_m_aud.toLocaleString()}`
                  : <span className="text-gray-400">—</span>}
              </td>
              <td className="py-2 px-3 text-right whitespace-nowrap text-gray-700 dark:text-gray-300">
                {det.wacc_pct != null ? `${det.wacc_pct.toFixed(2)}%` : <span className="text-gray-400">—</span>}
              </td>
              <td className="py-2 px-3 whitespace-nowrap">
                <span className={`px-2 py-0.5 rounded-full font-medium ${statusBadge(det.status)}`}>
                  {det.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rule Pipeline Bar Chart
// ---------------------------------------------------------------------------
const STATUS_ORDER = ['OPEN_CONSULTATION', 'DRAFT_RULE', 'RULE_DETERMINATION', 'FINAL_RULE', 'WITHDRAWN']
const STATUS_LABELS: Record<string, string> = {
  OPEN_CONSULTATION:  'Open Consult.',
  DRAFT_RULE:         'Draft Rule',
  RULE_DETERMINATION: 'Determination',
  FINAL_RULE:         'Final Rule',
  WITHDRAWN:          'Withdrawn',
}
const STATUS_COLOURS: Record<string, string> = {
  OPEN_CONSULTATION:  '#3b82f6',
  DRAFT_RULE:         '#f59e0b',
  RULE_DETERMINATION: '#a855f7',
  FINAL_RULE:         '#22c55e',
  WITHDRAWN:          '#9ca3af',
}

function PipelineChart({ ruleChanges }: { ruleChanges: RuleChangeRequest[] }) {
  const counts = STATUS_ORDER.map(s => ({
    status: STATUS_LABELS[s],
    count: ruleChanges.filter(r => r.status === s).length,
    colour: STATUS_COLOURS[s],
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={counts} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="status" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
        <Tooltip
          formatter={(value: number) => [value, 'Rule Changes']}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {counts.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.colour} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function RegulatoryTracker() {
  const [dashboard, setDashboard] = useState<RegulatoryDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getRegulatoryDashboard()
      .then(data => {
        setDashboard(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message ?? 'Failed to load regulatory data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <Clock className="animate-spin mr-2" size={20} />
        Loading regulatory data...
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <AlertTriangle className="mr-2" size={20} />
        {error ?? 'No data available'}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="text-blue-600 dark:text-blue-400" size={22} />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              NEM Regulatory Reform Tracker
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            AEMC | AER | AEMO &mdash; Rule change requests, determinations and upcoming deadlines
          </p>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
          <div className="flex items-center gap-1 justify-end">
            <CheckCircle size={12} className="text-green-500" />
            Updated: {new Date(dashboard.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Open Consultations"
          value={dashboard.open_consultations}
          icon={<FileText size={18} />}
          highlight="amber"
        />
        <KpiCard
          label="Draft Rules"
          value={dashboard.draft_rules}
          icon={<BookOpen size={18} />}
          highlight="amber"
        />
        <KpiCard
          label="Final Rules This Year"
          value={dashboard.final_rules_this_year}
          icon={<CheckCircle size={18} />}
          highlight="none"
        />
        <KpiCard
          label="Transformative Changes"
          value={dashboard.transformative_changes}
          icon={<AlertTriangle size={18} />}
          highlight="red"
        />
      </div>

      {/* Calendar + Pipeline side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Calendar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="text-blue-500" size={16} />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Upcoming Deadlines — Next 30 Days
            </h2>
            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {dashboard.upcoming_deadlines} events
            </span>
          </div>
          <CalendarTimeline events={dashboard.calendar_events} />
        </div>

        {/* Pipeline Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="text-blue-500" size={16} />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Rule Change Pipeline by Status
            </h2>
          </div>
          <PipelineChart ruleChanges={dashboard.rule_changes} />
        </div>
      </div>

      {/* Rule Changes Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="text-indigo-500" size={16} />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            AEMC Rule Change Requests
          </h2>
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            {dashboard.rule_changes.length} total
          </span>
        </div>
        <RuleChangesTable ruleChanges={dashboard.rule_changes} />
      </div>

      {/* AER Determinations Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="text-purple-500" size={16} />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            AER Network Revenue Determinations
          </h2>
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            {dashboard.aer_determinations.length} determinations
          </span>
        </div>
        <AerTable determinations={dashboard.aer_determinations} />
      </div>
    </div>
  )
}
