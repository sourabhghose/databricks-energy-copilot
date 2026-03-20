// AIO Compliance Hub
import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, XCircle, DollarSign, Award, type LucideIcon } from 'lucide-react'
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

const FALLBACK_SECTIONS = [
  { section_id: 'S1', section_name: 'Network Overview & Context', status: 'Complete', completion_pct: 100, description: 'DNSP overview, licence area, network statistics' },
  { section_id: 'S2', section_name: 'Reliability & Quality of Supply', status: 'Complete', completion_pct: 100, description: 'SAIDI/SAIFI performance against targets' },
  { section_id: 'S3', section_name: 'Customer Service Standards', status: 'In Progress', completion_pct: 72, description: 'Guaranteed Service Level payments and complaints' },
  { section_id: 'S4', section_name: 'STPIS Performance', status: 'In Progress', completion_pct: 60, description: 'Incentive scheme S-factor calculations' },
  { section_id: 'S5', section_name: 'Capital Expenditure', status: 'Complete', completion_pct: 100, description: 'Actual vs allowed capex reconciliation' },
  { section_id: 'S6', section_name: 'Operating Expenditure', status: 'Incomplete', completion_pct: 35, description: 'Opex categories and AER benchmark alignment' },
  { section_id: 'S7', section_name: 'Demand Forecast & DER', status: 'In Progress', completion_pct: 55, description: 'Peak demand, DER integration outlook' },
  { section_id: 'S8', section_name: 'Network Capability Statement', status: 'Not Started', completion_pct: 0, description: 'Bulk supply points, N-1 compliance, headroom' },
]

export default function AioHub() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [sections, setSections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getAioSummary(),
      api.getAioSections(),
    ]).then(([s, d]) => {
      setSummary(s ?? {})
      setSections(Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : FALLBACK_SECTIONS)
      setLoading(false)
    }).catch(() => {
      setSections(FALLBACK_SECTIONS)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const overallScore = summary.overall_score ?? 65
  const sFactor = summary.s_factor ?? 0.42
  const revenueImpact = summary.revenue_impact_m ?? 2.1
  const completeSections = sections.filter(s => s.status === 'Complete').length

  const statusIcon = (status: string) => {
    if (status === 'Complete') return <CheckCircle size={16} className="text-green-500" />
    if (status === 'In Progress') return <AlertCircle size={16} className="text-amber-500" />
    if (status === 'Incomplete') return <AlertCircle size={16} className="text-orange-500" />
    return <XCircle size={16} className="text-red-500" />
  }

  const statusBadge = (status: string) => {
    if (status === 'Complete') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    if (status === 'In Progress') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
    if (status === 'Incomplete') return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">AIO Compliance Hub</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Annual Information Obligations — AER reporting compliance tracker</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Overall Score" value={`${overallScore}%`} sub="AIO completion score" Icon={Award} color="bg-blue-500" />
        <KpiCard
          label="STPIS S-Factor"
          value={`${sFactor >= 0 ? '+' : ''}${sFactor.toFixed(2)}`}
          sub={sFactor >= 0 ? 'Revenue increase' : 'Revenue penalty'}
          Icon={CheckCircle}
          color={sFactor >= 0 ? 'bg-green-500' : 'bg-red-500'}
        />
        <KpiCard label="Revenue Impact" value={`$${Math.abs(revenueImpact).toFixed(1)}M`} sub={revenueImpact >= 0 ? 'Incentive earned' : 'Penalty applied'} Icon={DollarSign} color="bg-purple-500" />
        <KpiCard label="Sections Complete" value={`${completeSections}/8`} sub="AIO submission sections" Icon={CheckCircle} color={completeSections >= 6 ? 'bg-green-500' : 'bg-amber-500'} />
      </div>

      {/* Overall completion bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Overall AIO Progress</h2>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{overallScore}%</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
            style={{ width: `${overallScore}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">AER submission deadline: 31 October 2026 · {completeSections} of 8 sections complete</p>
      </div>

      {/* Sections table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">AIO Section Completion</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Section</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Description</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 w-36">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {sections.map((sec, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 pr-4 text-gray-900 dark:text-gray-100">
                    <div className="flex items-center gap-2">
                      {statusIcon(sec.status)}
                      <span className="font-mono text-xs font-medium">{sec.section_id}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">{sec.section_name}</td>
                  <td className="py-3 pr-4 text-gray-500 dark:text-gray-400 text-xs max-w-xs">{sec.description}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusBadge(sec.status)}`}>
                      {sec.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 w-24">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${sec.completion_pct ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{sec.completion_pct ?? 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key compliance notes */}
      <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/40 p-5">
        <h2 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">AER Compliance Notes</h2>
        <ul className="space-y-1.5 text-xs text-blue-700 dark:text-blue-400">
          <li>· Sections S6 (Opex) and S8 (Network Capability) require immediate attention — below 40% completion</li>
          <li>· STPIS S-factor must be lodged with AER by 31 October each regulatory year</li>
          <li>· Revenue impact of {sFactor >= 0 ? '+' : ''}${revenueImpact.toFixed(1)}M applies to the following regulatory year MAR</li>
          <li>· All data must be consistent with audited financial statements and RIN templates</li>
        </ul>
      </div>
    </div>
  )
}
