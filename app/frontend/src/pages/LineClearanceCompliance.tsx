// ELC Inspection & Line Clearance Compliance
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { CheckCircle, AlertTriangle, Map, Activity, type LucideIcon } from 'lucide-react'
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

const FALLBACK_DNSP = [
  { dnsp: 'Ausgrid', compliance_pct: 94.2, overdue_inspections: 28, works_due_km: 142, works_completed_km: 128, reg_risk: 'Low' },
  { dnsp: 'Endeavour', compliance_pct: 88.7, overdue_inspections: 64, works_due_km: 218, works_completed_km: 174, reg_risk: 'Medium' },
  { dnsp: 'Essential', compliance_pct: 71.4, overdue_inspections: 182, works_due_km: 340, works_completed_km: 198, reg_risk: 'High' },
  { dnsp: 'AusNet', compliance_pct: 86.1, overdue_inspections: 91, works_due_km: 284, works_completed_km: 228, reg_risk: 'Medium' },
  { dnsp: 'Citipower', compliance_pct: 97.8, overdue_inspections: 8, works_due_km: 44, works_completed_km: 43, reg_risk: 'Low' },
  { dnsp: 'Powercor', compliance_pct: 79.3, overdue_inspections: 128, works_due_km: 312, works_completed_km: 218, reg_risk: 'High' },
  { dnsp: 'SA Power', compliance_pct: 83.6, overdue_inspections: 104, works_due_km: 268, works_completed_km: 204, reg_risk: 'Medium' },
  { dnsp: 'Energex', compliance_pct: 91.4, overdue_inspections: 42, works_due_km: 198, works_completed_km: 172, reg_risk: 'Low' },
]

const regRiskBadge = (risk: string) => {
  if (risk === 'High') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  if (risk === 'Medium') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
}

export default function LineClearanceCompliance() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getVegRiskElcCompliance().then((d) => {
      setData(Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : FALLBACK_DNSP)
      setLoading(false)
    }).catch(() => {
      setData(FALLBACK_DNSP)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const avgCompliance = data.length ? data.reduce((a, r) => a + (r.compliance_pct ?? 0), 0) / data.length : 0
  const totalOverdue = data.reduce((a, r) => a + (r.overdue_inspections ?? 0), 0)
  const totalWorksDue = data.reduce((a, r) => a + (r.works_due_km ?? 0), 0)
  const totalWorksComplete = data.reduce((a, r) => a + (r.works_completed_km ?? 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ELC Inspection & Line Clearance Compliance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Electrical Line Clearance compliance programme — inspection schedules and works completion across DNSPs</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Overall Compliance" value={`${avgCompliance.toFixed(1)}%`} sub="Industry average ELC compliance" Icon={CheckCircle} color={avgCompliance >= 90 ? 'bg-green-500' : avgCompliance >= 80 ? 'bg-amber-500' : 'bg-red-500'} />
        <KpiCard label="Overdue Inspections" value={String(totalOverdue)} sub="Across all DNSPs" Icon={AlertTriangle} color="bg-red-500" />
        <KpiCard label="Works Due (km)" value={totalWorksDue.toLocaleString()} sub="Clearance works required" Icon={Map} color="bg-orange-500" />
        <KpiCard label="Works Completed (km)" value={totalWorksComplete.toLocaleString()} sub="Completed this cycle" Icon={Activity} color="bg-blue-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">ELC Compliance % by DNSP</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="dnsp" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Bar dataKey="compliance_pct" fill="#10B981" name="Compliance %" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">ELC Programme — DNSP Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">DNSP</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Compliance %</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Overdue Inspections</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Works Due (km)</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Works Complete (km)</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Works Rate %</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Regulatory Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {data.map((row, i) => {
                const worksRate = row.works_due_km > 0 ? (row.works_completed_km / row.works_due_km) * 100 : 100
                return (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-semibold">{row.dnsp}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`font-semibold ${(row.compliance_pct ?? 0) >= 90 ? 'text-green-600 dark:text-green-400' : (row.compliance_pct ?? 0) >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {(row.compliance_pct ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{row.overdue_inspections}</td>
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{row.works_due_km?.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{row.works_completed_km?.toLocaleString()}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`font-semibold ${worksRate >= 90 ? 'text-green-600 dark:text-green-400' : worksRate >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {worksRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${regRiskBadge(row.reg_risk)}`}>{row.reg_risk}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
