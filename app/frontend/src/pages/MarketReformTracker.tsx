// ---------------------------------------------------------------------------
// Sprint 33c — NEM Electricity Market Reform Tracker
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import {
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { api, type ReformDashboard, type MarketReform, type ReformMilestoneRecord, type ReformImpactRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string): JSX.Element {
  const map: Record<string, string> = {
    IMPLEMENTED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    APPROVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    CONSULTATION: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    PROPOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-300',
    COMPLETE: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    UPCOMING: 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-300',
  }
  const cls = map[status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function agencyBadge(agency: string): JSX.Element {
  const map: Record<string, string> = {
    AEMC: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    AEMO: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    AER: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    ESB: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    DCCEEW: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  }
  const cls = map[agency] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {agency}
    </span>
  )
}

function impactBadge(level: string): JSX.Element {
  const map: Record<string, string> = {
    HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  }
  const cls = map[level] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {level}
    </span>
  )
}

function categoryBadge(cat: string): JSX.Element {
  const map: Record<string, string> = {
    SETTLEMENT: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    DER: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    RELIABILITY: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    MARKET_DESIGN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    CONSUMER: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
    GRID_SERVICES: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  }
  const cls = map[cat] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {cat.replace('_', ' ')}
    </span>
  )
}

function benefitTypeBadge(bt: string): JSX.Element {
  const map: Record<string, string> = {
    REVENUE: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    COST_SAVING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    COMPLIANCE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    OPERATIONAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  }
  const cls = map[bt] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {bt.replace('_', ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: number
  icon: React.ReactNode
  colour: string
  subtitle?: string
}

function KpiCard({ label, value, icon, colour, subtitle }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${colour}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reforms Table
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ['ALL', 'IMPLEMENTED', 'IN_PROGRESS', 'APPROVED', 'CONSULTATION', 'PROPOSED']
const CATEGORY_OPTIONS = ['ALL', 'SETTLEMENT', 'DER', 'RELIABILITY', 'MARKET_DESIGN', 'CONSUMER']

interface ReformsTableProps {
  reforms: MarketReform[]
}

function ReformsTable({ reforms }: ReformsTableProps) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = reforms.filter(r => {
    const statusOk = statusFilter === 'ALL' || r.status === statusFilter
    const catOk = categoryFilter === 'ALL' || r.category === categoryFilter
    return statusOk && catOk
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mr-auto">
          NEM Reform Register
        </h2>
        {/* Status filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
        {/* Category filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {CATEGORY_OPTIONS.map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                categoryFilter === c
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {c.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reform</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Agency</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Impact</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Impl. Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rule Ref</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-64">Key Benefit</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(r => (
              <>
                <tr
                  key={r.reform_id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === r.reform_id ? null : r.reform_id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{r.reform_name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{r.reform_id}</p>
                  </td>
                  <td className="px-4 py-3">{categoryBadge(r.category)}</td>
                  <td className="px-4 py-3">{agencyBadge(r.lead_agency)}</td>
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3">{impactBadge(r.impact_level)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {r.implementation_date ?? <span className="text-gray-400">TBD</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                    {r.rule_reference ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">{r.key_benefit}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {expandedId === r.reform_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </td>
                </tr>
                {expandedId === r.reform_id && (
                  <tr key={`${r.reform_id}-detail`} className="bg-blue-50 dark:bg-blue-900/10">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1">Description</p>
                          <p className="text-gray-700 dark:text-gray-300">{r.description}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1">Stakeholders Affected</p>
                          <div className="flex flex-wrap gap-1">
                            {r.stakeholders_affected.map(s => (
                              <span key={s} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">{s}</span>
                            ))}
                          </div>
                        </div>
                        {r.ner_clause && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1">NER Clause</p>
                            <p className="text-gray-700 dark:text-gray-300 font-mono text-xs">{r.ner_clause}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  No reforms match the selected filters.
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
// Milestone Table
// ---------------------------------------------------------------------------

interface MilestoneTableProps {
  milestones: ReformMilestoneRecord[]
}

function MilestoneTable({ milestones }: MilestoneTableProps) {
  // Group by reform_name
  const grouped: Record<string, ReformMilestoneRecord[]> = {}
  for (const m of milestones) {
    if (!grouped[m.reform_name]) grouped[m.reform_name] = []
    grouped[m.reform_name].push(m)
  }

  const milestoneBadge = (status: string) => {
    if (status === 'COMPLETE') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
    if (status === 'IN_PROGRESS') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Reform Milestone Timeline</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Key milestones grouped by reform program</p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {Object.entries(grouped).map(([reformName, mlist]) => (
          <div key={reformName} className="px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{reformName}</h3>
            <div className="relative ml-2">
              {/* Timeline line */}
              <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-600" />
              <div className="space-y-3">
                {mlist.map(m => (
                  <div key={`${m.reform_id}-${m.milestone}`} className="flex items-start gap-4 relative pl-8">
                    {/* Dot */}
                    <div className={`absolute left-0.5 top-1.5 w-3 h-3 rounded-full border-2 ${
                      m.status === 'COMPLETE'
                        ? 'bg-green-500 border-green-500'
                        : m.status === 'IN_PROGRESS'
                        ? 'bg-amber-400 border-amber-400'
                        : 'bg-gray-300 border-gray-300 dark:bg-gray-600 dark:border-gray-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{m.milestone}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${milestoneBadge(m.status)}`}>
                          {m.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.description}</p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{m.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Impact Table
// ---------------------------------------------------------------------------

interface ImpactTableProps {
  impacts: ReformImpactRecord[]
}

function ImpactTable({ impacts }: ImpactTableProps) {
  const totalBenefit = impacts.reduce((sum, i) => sum + i.financial_impact_m_aud, 0)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Financial Impact Analysis</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Estimated $M AUD impacts by reform and stakeholder</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Net Estimated Benefit</p>
          <p className={`text-lg font-bold ${totalBenefit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {totalBenefit >= 0 ? '+' : ''}${totalBenefit.toFixed(0)}M
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reform</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stakeholder</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Impact Description</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">$M AUD</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Benefit Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {impacts.map((imp, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800 dark:text-gray-200">{imp.reform_name}</p>
                  <p className="text-xs text-gray-400">{imp.reform_id}</p>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{imp.stakeholder_type}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs">{imp.impact_description}</td>
                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${
                  imp.financial_impact_m_aud >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {imp.financial_impact_m_aud >= 0 ? '+' : ''}${imp.financial_impact_m_aud.toFixed(0)}M
                </td>
                <td className="px-4 py-3">{benefitTypeBadge(imp.benefit_type)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MarketReformTracker() {
  const [dashboard, setDashboard] = useState<ReformDashboard | null>(null)
  const [reforms, setReforms] = useState<MarketReform[]>([])
  const [milestones, setMilestones] = useState<ReformMilestoneRecord[]>([])
  const [impacts, setImpacts] = useState<ReformImpactRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'reforms' | 'milestones' | 'impacts'>('reforms')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [dash, reformList, milestoneList] = await Promise.all([
          api.getReformDashboard(),
          api.getReformList(),
          api.getReformMilestones(),
        ])
        setDashboard(dash)
        setReforms(reformList)
        setMilestones(milestoneList)
        setImpacts(dash.impacts)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load reform data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading reform tracker...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
          <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">NEM Market Reform Tracker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            NEM rule changes, 5-minute settlement, DER integration, capacity mechanism and market design reforms
            {dashboard && (
              <span className="ml-2 text-xs text-gray-400">
                — as at {new Date(dashboard.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
              </span>
            )}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Implemented Reforms"
            value={dashboard.implemented_reforms}
            icon={<CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />}
            colour="bg-green-100 dark:bg-green-900/40"
            subtitle="Live in the NEM"
          />
          <KpiCard
            label="In Progress / Approved"
            value={dashboard.in_progress_reforms}
            icon={<Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            colour="bg-amber-100 dark:bg-amber-900/40"
            subtitle="Active implementation"
          />
          <KpiCard
            label="Proposed / Consultation"
            value={dashboard.proposed_reforms}
            icon={<FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
            colour="bg-purple-100 dark:bg-purple-900/40"
            subtitle="Under consultation"
          />
          <KpiCard
            label="High Impact Reforms"
            value={dashboard.high_impact_reforms}
            icon={<Zap className="w-5 h-5 text-red-600 dark:text-red-400" />}
            colour="bg-red-100 dark:bg-red-900/40"
            subtitle="Major market implications"
          />
        </div>
      )}

      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6">
          {([
            { key: 'reforms', label: 'Reform Register' },
            { key: 'milestones', label: 'Milestone Timeline' },
            { key: 'impacts', label: 'Financial Impact' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'reforms' && <ReformsTable reforms={reforms} />}
      {activeTab === 'milestones' && <MilestoneTable milestones={milestones} />}
      {activeTab === 'impacts' && <ImpactTable impacts={impacts} />}
    </div>
  )
}
