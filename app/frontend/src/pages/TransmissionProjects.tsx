import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { GitBranch, RefreshCw, AlertCircle, Info, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { api, TransmissionProject, TransmissionMilestone, TransmissionDashboard } from '../api/client'

const STATUS_COLOURS: Record<string, string> = {
  OPERATING: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  CONSTRUCTION: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  APPROVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  AER_REVIEW: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  PROPOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const CATEGORY_COLOURS: Record<string, string> = {
  COMMITTED_ISP: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  ACTIONABLE_ISP: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ANTICIPATED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  REGULATORY: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

const PRIORITY_COLOURS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const MILESTONE_STATUS_ICONS: Record<string, { icon: typeof CheckCircle; colour: string }> = {
  COMPLETE: { icon: CheckCircle, colour: 'text-green-500' },
  IN_PROGRESS: { icon: Clock, colour: 'text-amber-500' },
  UPCOMING: { icon: Clock, colour: 'text-gray-400' },
  DELAYED: { icon: AlertTriangle, colour: 'text-red-500' },
}

function KpiCard({ title, value, subtitle, colour = 'text-gray-900 dark:text-gray-100' }: { title: string; value: string; subtitle?: string; colour?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</span>
      <span className={`text-2xl font-bold ${colour}`}>{value}</span>
      {subtitle && <span className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>}
    </div>
  )
}

function CapexBenefitChart({ projects }: { projects: TransmissionProject[] }) {
  const data = projects.map(p => ({
    name: p.project_name.replace('Project ', '').substring(0, 14),
    capex: p.capex_b_aud,
    benefit: p.consumer_benefit_b_aud,
  }))
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Capex vs Consumer Benefit ($B AUD)</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => `$${v}B`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px', color: '#F9FAFB' }}
            formatter={(v: number, name: string) => [`$${v.toFixed(2)}B`, name === 'capex' ? 'Capex' : 'Consumer Benefit']}
          />
          <Legend formatter={v => v === 'capex' ? 'Capex $B' : 'Consumer Benefit $B'} wrapperStyle={{ fontSize: '12px' }} />
          <Bar dataKey="capex" fill="#3B82F6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="benefit" fill="#10B981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ProjectsTable({ projects }: { projects: TransmissionProject[] }) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [catFilter, setCatFilter] = useState('ALL')

  const filtered = projects
    .filter(p => statusFilter === 'ALL' || p.status === statusFilter)
    .filter(p => catFilter === 'ALL' || p.category === catFilter)

  const statuses = ['ALL', 'CONSTRUCTION', 'APPROVED', 'AER_REVIEW', 'PROPOSED']
  const categories = ['ALL', 'COMMITTED_ISP', 'ACTIONABLE_ISP', 'ANTICIPATED', 'REGULATORY']

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex flex-col gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Transmission Projects ({filtered.length})</h2>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={['px-2.5 py-1 rounded-md text-xs font-medium transition-colors', statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'].join(' ')}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={['px-2.5 py-1 rounded-md text-xs font-medium transition-colors', catFilter === c ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'].join(' ')}>
              {c.replace('_ISP', '')}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              {['Project', 'TNSP', 'States', 'Category', 'Cap. MW', 'KM', 'KV', 'Capex $B', 'Benefit $B', 'Status', 'RIT-T', 'AER', 'Priority', 'Comm.'].map(h => (
                <th key={h} className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.project_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="py-2 px-2 font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">{p.project_name}</td>
                <td className="py-2 px-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{p.tnsp}</td>
                <td className="py-2 px-2">
                  <div className="flex gap-1 flex-wrap">
                    {p.states.map(s => <span key={s} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">{s}</span>)}
                  </div>
                </td>
                <td className="py-2 px-2">
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLOURS[p.category] ?? 'bg-gray-100 text-gray-700'}`}>
                    {p.category.replace('_ISP', '')}
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-200">{p.capacity_mw.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-200">{p.circuit_km}</td>
                <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-200">{p.voltage_kv}</td>
                <td className="py-2 px-2 text-right font-medium text-gray-800 dark:text-gray-100">${p.capex_b_aud.toFixed(1)}B</td>
                <td className="py-2 px-2 text-right text-green-600 dark:text-green-400">${p.consumer_benefit_b_aud.toFixed(1)}B</td>
                <td className="py-2 px-2">
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOURS[p.status] ?? ''}`}>{p.status.replace('_', ' ')}</span>
                </td>
                <td className="py-2 px-2 text-center">{p.rit_t_passed ? <CheckCircle size={14} className="text-green-500 mx-auto" /> : <XCircle size={14} className="text-gray-400 mx-auto" />}</td>
                <td className="py-2 px-2 text-center">{p.aer_approved ? <CheckCircle size={14} className="text-green-500 mx-auto" /> : <XCircle size={14} className="text-gray-400 mx-auto" />}</td>
                <td className="py-2 px-2">
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_COLOURS[p.isp_2024_priority] ?? ''}`}>{p.isp_2024_priority}</span>
                </td>
                <td className="py-2 px-2 text-center text-gray-600 dark:text-gray-300">{p.commissioning_year ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MilestoneTracker({ milestones }: { milestones: TransmissionMilestone[] }) {
  const grouped: Record<string, TransmissionMilestone[]> = {}
  milestones.forEach(m => {
    if (!grouped[m.project_name]) grouped[m.project_name] = []
    grouped[m.project_name].push(m)
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Project Milestone Tracker</h2>
      <div className="space-y-6">
        {Object.entries(grouped).map(([projectName, items]) => (
          <div key={projectName}>
            <h3 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">{projectName}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600">
                    {['Milestone', 'Planned', 'Actual', 'Status', 'Notes'].map(h => (
                      <th key={h} className="text-left py-1.5 px-2 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((m, idx) => {
                    const { icon: Icon, colour } = MILESTONE_STATUS_ICONS[m.status] ?? { icon: Clock, colour: 'text-gray-400' }
                    return (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-1.5 px-2 font-medium text-gray-800 dark:text-gray-100">{m.milestone}</td>
                        <td className="py-1.5 px-2 text-gray-600 dark:text-gray-300">{m.planned_date}</td>
                        <td className="py-1.5 px-2 text-gray-600 dark:text-gray-300">{m.actual_date ?? '—'}</td>
                        <td className="py-1.5 px-2">
                          <div className="flex items-center gap-1">
                            <Icon size={14} className={colour} />
                            <span className={`text-xs font-medium ${colour}`}>{m.status.replace('_', ' ')}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-gray-500 dark:text-gray-400">{m.notes}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TransmissionProjects() {
  const [dashboard, setDashboard] = useState<TransmissionDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const dash = await api.getTransmissionDashboard()
      setDashboard(dash)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  if (loading && !dashboard) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={24} className="text-blue-500 animate-spin" />
    </div>
  )

  if (error && !dashboard) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 max-w-sm text-center">
        <AlertCircle size={24} className="text-red-500" />
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={fetchAll} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Retry</button>
      </div>
    </div>
  )

  const dash = dashboard!

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <GitBranch size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Major Transmission Projects</h1>
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full">
                ${dash.total_pipeline_capex_b_aud.toFixed(1)}B Pipeline
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">ISP Committed & Actionable Projects · RIT-T & AER Approval Status</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{lastRefresh.toLocaleTimeString('en-AU')}</span>
          <button onClick={fetchAll} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>
      </div>

      {/* Context note */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
          <span className="font-semibold">ISP Context:</span> Australia&apos;s Integrated System Plan (ISP) identifies transmission investments needed for the energy transition. Projects must pass a Regulatory Investment Test for Transmission (RIT-T) to demonstrate net market benefit before AER regulatory approval.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Pipeline Capex" value={`$${dash.total_pipeline_capex_b_aud.toFixed(1)}B`} subtitle="All ISP projects" />
        <KpiCard title="KM Under Construction" value={`${dash.km_under_construction.toLocaleString()} km`} />
        <KpiCard title="KM Approved" value={`${dash.km_approved.toLocaleString()} km`} colour="text-blue-600 dark:text-blue-400" />
        <KpiCard title="Projects At Risk" value={`${dash.projects_at_risk}`} subtitle="AER Review or Proposed" colour={dash.projects_at_risk > 0 ? 'text-amber-500' : 'text-green-500'} />
      </div>

      <CapexBenefitChart projects={dash.projects} />
      <ProjectsTable projects={dash.projects} />
      <MilestoneTracker milestones={dash.milestones} />
    </div>
  )
}
