// Regulatory Reset Preparation
import { useEffect, useState } from 'react'
import { CheckCircle, AlertTriangle, Calendar, Clock, type LucideIcon } from 'lucide-react'
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

const FALLBACK_AREAS = [
  {
    area: 'Opex Efficiency Program',
    readiness_score: 72,
    key_risks: 'AER benchmarking gap of 8% vs peer average — consultant engaged to close gap by submission',
    consultant_engagement: 'In Progress',
    owner: 'CFO',
    due_date: '2027-06-30',
  },
  {
    area: 'Capex Justification Pack',
    readiness_score: 85,
    key_risks: 'IT/OT project costs $4.2M above AER template — additional RIT-D analysis required',
    consultant_engagement: 'Engaged',
    owner: 'Head of Asset Management',
    due_date: '2027-06-30',
  },
  {
    area: 'Demand Forecasting',
    readiness_score: 68,
    key_risks: 'DER growth assumptions not yet aligned to AER accepted models — needs update',
    consultant_engagement: 'In Progress',
    owner: 'Head of Planning',
    due_date: '2027-09-30',
  },
  {
    area: 'STPIS S-Factor Modelling',
    readiness_score: 91,
    key_risks: 'Minor: SAIFI outage classification methodology differs from AER preferred approach',
    consultant_engagement: 'Complete',
    owner: 'Regulation Manager',
    due_date: '2027-03-31',
  },
  {
    area: 'RAB Roll-Forward',
    readiness_score: 79,
    key_risks: 'Asset disposals not yet reconciled — 3 large retirement events pending audit sign-off',
    consultant_engagement: 'Engaged',
    owner: 'Finance',
    due_date: '2027-09-30',
  },
  {
    area: 'WACC & Finance Parameters',
    readiness_score: 55,
    key_risks: 'Material risk — WACC methodology submission window opens Q3 2027, requires expert evidence',
    consultant_engagement: 'Not Started',
    owner: 'CFO',
    due_date: '2027-12-31',
  },
]

const readinessColor = (score: number) => {
  if (score >= 85) return 'bg-green-500'
  if (score >= 65) return 'bg-amber-500'
  return 'bg-red-500'
}

const consultantBadge = (status: string) => {
  if (status === 'Complete') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (status === 'Engaged' || status === 'In Progress') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
}

export default function ResetPreparation() {
  const [areas, setAreas] = useState<any[]>([])
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getBenchmarkingResetReadiness().then((d) => {
      setSummary(d?.summary ?? {})
      setAreas(Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : FALLBACK_AREAS)
      setLoading(false)
    }).catch(() => {
      setAreas(FALLBACK_AREAS)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const avgReadiness = areas.length ? areas.reduce((a, r) => a + (r.readiness_score ?? 0), 0) / areas.length : 0
  const atRiskCount = areas.filter(a => (a.readiness_score ?? 0) < 70).length
  const nextResetYear = summary.next_reset_year ?? 2029
  const submissionDate = summary.submission_date ?? '2027-12-31'
  const today = new Date()
  const submission = new Date(submissionDate)
  const monthsToSubmission = Math.round((submission.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Regulatory Reset Preparation</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Reset submission readiness tracker across all AER workstreams</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Overall Readiness" value={`${avgReadiness.toFixed(0)}%`} sub="Average across all workstreams" Icon={CheckCircle} color={avgReadiness >= 80 ? 'bg-green-500' : avgReadiness >= 65 ? 'bg-amber-500' : 'bg-red-500'} />
        <KpiCard label="Areas at Risk" value={String(atRiskCount)} sub="Below 70% readiness threshold" Icon={AlertTriangle} color={atRiskCount === 0 ? 'bg-green-500' : 'bg-red-500'} />
        <KpiCard label="Next Reset Year" value={String(nextResetYear)} sub="Regulatory determination commences" Icon={Calendar} color="bg-blue-500" />
        <KpiCard label="Months to Submission" value={String(monthsToSubmission)} sub={`Submission date: ${submissionDate}`} Icon={Clock} color={monthsToSubmission < 12 ? 'bg-red-500' : monthsToSubmission < 18 ? 'bg-amber-500' : 'bg-green-500'} />
      </div>

      {/* Overall readiness bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Overall Reset Readiness</h2>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{avgReadiness.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${avgReadiness >= 80 ? 'bg-green-500' : avgReadiness >= 65 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${avgReadiness}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400 dark:text-gray-500">
          <span>Target: 90% by Q3 2027</span>
          <span>AER submission window: Q4 2027</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Reset Workstream Readiness</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Workstream</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Owner</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4 w-40">Readiness</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Due Date</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Consultant</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Key Risks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {areas.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 pr-4 text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">{row.area}</td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-400 text-xs">{row.owner}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 w-20">
                        <div
                          className={`h-1.5 rounded-full ${readinessColor(row.readiness_score ?? 0)}`}
                          style={{ width: `${row.readiness_score ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-8">{row.readiness_score}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-400 text-xs font-mono">{row.due_date}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${consultantBadge(row.consultant_engagement)}`}>
                      {row.consultant_engagement}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500 dark:text-gray-400 text-xs max-w-xs">{row.key_risks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
