// Phase 5B — Regulatory Calendar
import { useEffect, useState } from 'react'
import { Calendar, Clock, CheckCircle, AlertTriangle, type LucideIcon } from 'lucide-react'
import { api, RegulatoryMilestone } from '../api/client'

const STATUS_STYLES: Record<string, string> = {
  COMPLETE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  IN_PROGRESS: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'IN PROGRESS': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  UPCOMING: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  OVERDUE: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

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

export default function RegulatoryCalendar() {
  const [milestones, setMilestones] = useState<RegulatoryMilestone[]>([])
  const [upcoming, setUpcoming] = useState<RegulatoryMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [dnspFilter, setDnspFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getAerMilestones({ ...(dnspFilter ? { dnsp: dnspFilter } : {}), ...(statusFilter ? { status: statusFilter } : {}) }),
      api.getAerUpcomingMilestones(),
    ]).then(([m, u]) => {
      setMilestones(m.milestones)
      setUpcoming(u.milestones)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [dnspFilter, statusFilter])

  const overdue = milestones.filter(m => m.status === 'OVERDUE').length
  const complete = milestones.filter(m => m.status === 'COMPLETE').length
  const today = new Date().toISOString().slice(0, 10)

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading regulatory calendar...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Regulatory Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">AER submission milestones, pricing proposals, audits and compliance dates</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={dnspFilter} onChange={e => setDnspFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            <option value="">All DNSPs</option>
            <option value="AusNet Services">AusNet Services</option>
            <option value="Ergon Energy">Ergon Energy</option>
            <option value="Energex">Energex</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            <option value="">All Status</option>
            <option value="COMPLETE">Complete</option>
            <option value="IN PROGRESS">In Progress</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="OVERDUE">Overdue</option>
          </select>
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Milestones" value={String(milestones.length)} sub="All DNSPs" Icon={Calendar} color="bg-blue-500" />
        <KpiCard label="Upcoming (90 days)" value={String(upcoming.length)} sub="Action required" Icon={Clock} color="bg-purple-500" />
        <KpiCard label="Complete" value={String(complete)} sub="On time" Icon={CheckCircle} color="bg-green-500" />
        <KpiCard label="Overdue" value={String(overdue)} sub="Escalation needed" Icon={AlertTriangle} color={overdue > 0 ? 'bg-red-500' : 'bg-gray-400'} />
      </div>

      {/* Upcoming 90 days */}
      {upcoming.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Upcoming Milestones — Next 90 Days</h2>
          <div className="space-y-2">
            {upcoming.map((m, i) => {
              const days = m.days_remaining ?? Math.ceil((new Date(m.due_date).getTime() - new Date(today).getTime()) / 86400000)
              return (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${days <= 14 ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800' : 'bg-gray-50 dark:bg-gray-700'}`}>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.milestone_type}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.dnsp} — {m.responsible_team}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-400">{m.due_date?.slice(0, 10)}</p>
                    <p className={`text-xs font-semibold ${days <= 7 ? 'text-red-600 dark:text-red-400' : days <= 14 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>{days}d remaining</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All milestones table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">All Milestones ({milestones.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">DNSP</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Description</th>
                <th className="pb-2 pr-4">Due Date</th>
                <th className="pb-2 pr-4">Completed</th>
                <th className="pb-2 pr-4">Team</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {milestones.map((m, i) => (
                <tr key={i} className={`text-gray-700 dark:text-gray-300 ${m.status === 'OVERDUE' ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                  <td className="py-1.5 pr-4">{m.dnsp}</td>
                  <td className="py-1.5 pr-4 font-medium">{m.milestone_type}</td>
                  <td className="py-1.5 pr-4 max-w-xs truncate">{m.description}</td>
                  <td className="py-1.5 pr-4 font-mono">{m.due_date?.slice(0, 10)}</td>
                  <td className="py-1.5 pr-4 font-mono text-gray-400">{m.completed_date?.slice(0, 10) || '—'}</td>
                  <td className="py-1.5 pr-4">{m.responsible_team}</td>
                  <td className="py-1.5">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[m.status] ?? ''}`}>{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
