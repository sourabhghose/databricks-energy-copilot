// DAPR Assembly Hub
import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, XCircle, Calendar, Clock, FileText, type LucideIcon } from 'lucide-react'
import { api } from '../api/client'

interface KpiCardProps {
  label: string; value: string; sub?: string
  Icon: LucideIcon; color: string
}
function KpiCard({ label, value, sub, Icon, color }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}><Icon size={20} className="text-white" /></div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const DAPR_SECTIONS = [
  {
    section_id: 'D1',
    section_name: 'Network Overview',
    description: 'Licence area description, network statistics and asset summary',
    status: 'Complete',
    completion_pct: 100,
    owner: 'Network Planning',
    due_date: '2026-08-31',
  },
  {
    section_id: 'D2',
    section_name: 'Demand Forecast',
    description: 'Peak demand, energy demand and DER integration 5-year outlook',
    status: 'In Progress',
    completion_pct: 74,
    owner: 'Network Planning',
    due_date: '2026-09-30',
  },
  {
    section_id: 'D3',
    section_name: 'Network Capability Statement',
    description: 'Bulk supply point headroom, N-1 compliance, transfer capability',
    status: 'In Progress',
    completion_pct: 58,
    owner: 'Asset Management',
    due_date: '2026-09-30',
  },
  {
    section_id: 'D4',
    section_name: 'Hosting Capacity',
    description: 'DER hosting capacity analysis, constrained feeders, DOE approach',
    status: 'Complete',
    completion_pct: 100,
    owner: 'DER Team',
    due_date: '2026-08-31',
  },
  {
    section_id: 'D5',
    section_name: 'Augmentation Pipeline',
    description: 'Proposed augmentation projects, RIT-D assessments, non-network solutions',
    status: 'In Progress',
    completion_pct: 42,
    owner: 'Capital Projects',
    due_date: '2026-10-31',
  },
  {
    section_id: 'D6',
    section_name: 'Asset Management',
    description: 'Asset health, replacement priorities and maintenance plans',
    status: 'Complete',
    completion_pct: 100,
    owner: 'Asset Management',
    due_date: '2026-08-31',
  },
  {
    section_id: 'D7',
    section_name: 'Emergency Management',
    description: 'Emergency response plans, extreme weather protocols',
    status: 'In Progress',
    completion_pct: 65,
    owner: 'Operations',
    due_date: '2026-10-31',
  },
  {
    section_id: 'D8',
    section_name: 'Regulatory Obligations',
    description: 'Compliance status, AER obligations, regulatory reporting',
    status: 'Not Started',
    completion_pct: 0,
    owner: 'Regulation',
    due_date: '2026-11-30',
  },
]

const statusIcon = (status: string) => {
  if (status === 'Complete') return <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
  if (status === 'In Progress') return <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
  if (status === 'Incomplete') return <AlertCircle size={16} className="text-orange-500 flex-shrink-0" />
  return <XCircle size={16} className="text-red-500 flex-shrink-0" />
}

const statusBadge = (status: string) => {
  if (status === 'Complete') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (status === 'In Progress') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  if (status === 'Incomplete') return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
}

export default function DaprHub() {
  const [sections, setSections] = useState<any[]>(DAPR_SECTIONS)
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDaprSummary().then((d) => {
      setSummary(d ?? {})
      if (Array.isArray(d?.sections)) setSections(d.sections)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const completeCount = sections.filter(s => s.status === 'Complete').length
  const overallPct = sections.length ? Math.round(sections.reduce((a, s) => a + (s.completion_pct ?? 0), 0) / sections.length) : 0
  const regulatoryPeriod = summary.regulatory_period ?? '2025–2030'
  const submissionDate = summary.submission_date ?? '2026-11-30'
  const today = new Date()
  const sub = new Date(submissionDate)
  const daysToSub = Math.max(0, Math.round((sub.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">DAPR Assembly Hub</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Distribution Annual Planning Report — NER cl. 5.20.1 submission tracker</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Sections Complete" value={`${completeCount}/8`} sub="DAPR submission sections" Icon={CheckCircle} color={completeCount >= 6 ? 'bg-green-500' : 'bg-amber-500'} />
        <KpiCard label="Overall Completion" value={`${overallPct}%`} sub="Average across all sections" Icon={FileText} color={overallPct >= 75 ? 'bg-green-500' : overallPct >= 50 ? 'bg-amber-500' : 'bg-red-500'} />
        <KpiCard label="Days to Submission" value={String(daysToSub)} sub={`Due: ${submissionDate}`} Icon={Clock} color={daysToSub > 90 ? 'bg-green-500' : daysToSub > 30 ? 'bg-amber-500' : 'bg-red-500'} />
        <KpiCard label="Regulatory Period" value={regulatoryPeriod} sub="Current regulatory determination" Icon={Calendar} color="bg-blue-500" />
      </div>

      {/* Overall progress bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Overall DAPR Progress</h2>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{overallPct}%</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${overallPct >= 75 ? 'bg-green-500' : overallPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-gray-500">
          <span>{completeCount} of 8 sections complete</span>
          <span>Target: 100% by {submissionDate}</span>
        </div>
      </div>

      {/* Section checklist */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">DAPR Section Status</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Section</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Owner</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4 w-40">Completion</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {sections.map((sec, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 pr-4 text-gray-900 dark:text-gray-100">
                    <div className="flex items-center gap-2">
                      {statusIcon(sec.status)}
                      <span className="font-mono text-xs font-semibold">{sec.section_id}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-gray-900 dark:text-gray-100 font-medium">{sec.section_name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{sec.description}</p>
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-400 text-xs">{sec.owner}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusBadge(sec.status)}`}>{sec.status}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 w-20">
                        <div
                          className={`h-1.5 rounded-full ${sec.completion_pct === 100 ? 'bg-green-500' : sec.completion_pct > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${sec.completion_pct ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right font-semibold">{sec.completion_pct ?? 0}%</span>
                    </div>
                  </td>
                  <td className="py-3 text-gray-500 dark:text-gray-400 text-xs font-mono">{sec.due_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/40 p-5">
        <h2 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">DAPR Regulatory Reference</h2>
        <ul className="space-y-1.5 text-xs text-blue-700 dark:text-blue-400">
          <li>· NER clause 5.20.1 — Distribution Annual Planning Report lodged with AEMO by 31 December each year</li>
          <li>· DAPR must include 5-year demand forecast, network capability statement and augmentation pipeline</li>
          <li>· DER hosting capacity and non-network solutions must be addressed per AEMC 2022 rule change</li>
          <li>· N-1 contingency analysis must be completed for all bulk supply points with demand &gt; 10 MVA</li>
        </ul>
      </div>
    </div>
  )
}
