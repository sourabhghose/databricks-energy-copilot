// DAPR Compliance
import { useEffect, useState } from 'react'
import { AlertCircle, Wrench, Leaf, Calendar, type LucideIcon } from 'lucide-react'
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

function statusBadge(status: string) {
  const s = (status ?? '').toLowerCase()
  const cls = s === 'complete' || s === 'compliant' || s === 'submitted'
    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    : s === 'in progress' || s === 'pending' || s === 'draft'
    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{status}</span>
}

export default function DaprCompliance() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [constraints, setConstraints] = useState<any[]>([])
  const [obligations, setObligations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getDaprSummary(),
      api.getDaprConstraints(),
      api.getDaprObligations(),
    ]).then(([s, c, o]) => {
      setSummary(s ?? {})
      setConstraints(Array.isArray(c?.constraints) ? c.constraints : Array.isArray(c) ? c : [])
      setObligations(Array.isArray(o?.obligations) ? o.obligations : Array.isArray(o) ? o : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">DAPR Compliance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Distribution Annual Planning Report obligations and network constraints</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Constraints Identified" value={String(summary.constraints_identified ?? 0)} sub="Network constraint areas" Icon={AlertCircle} color="bg-red-500" />
        <KpiCard label="Augmentation Projects" value={String(summary.augmentation_projects ?? 0)} sub="Network augmentations" Icon={Wrench} color="bg-blue-500" />
        <KpiCard label="Non-Network Alternatives" value={String(summary.non_network_alternatives ?? 0)} sub="Demand-side solutions" Icon={Leaf} color="bg-green-500" />
        <KpiCard label="Next Submission Due" value={summary.next_submission_due ?? '—'} sub="Regulatory deadline" Icon={Calendar} color="bg-purple-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Network Constraints</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Zone Substation</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Utilisation %</th>
                <th className="pb-2 pr-4">Breach Year</th>
                <th className="pb-2 pr-4">Solution</th>
                <th className="pb-2">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {constraints.map((c, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4 font-medium">{c.zone_substation ?? c.substation}</td>
                  <td className="py-1.5 pr-4">{c.constraint_type ?? c.type}</td>
                  <td className="py-1.5 pr-4">
                    <span className={(c.utilisation_pct ?? 0) >= 90
                      ? 'text-red-600 dark:text-red-400 font-semibold'
                      : (c.utilisation_pct ?? 0) >= 75
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-green-600 dark:text-green-400'
                    }>{(c.utilisation_pct ?? 0).toFixed(0)}%</span>
                  </td>
                  <td className="py-1.5 pr-4">{c.breach_year ?? '—'}</td>
                  <td className="py-1.5 pr-4">{c.solution ?? '—'}</td>
                  <td className="py-1.5">{c.cost_m ? `$${c.cost_m.toFixed(0)}M` : '—'}</td>
                </tr>
              ))}
              {constraints.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-gray-400 dark:text-gray-500">No constraint data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">DAPR Obligations</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Obligation</th>
                <th className="pb-2 pr-4">Due Date</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {obligations.map((o, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4 font-medium">{o.obligation ?? o.description}</td>
                  <td className="py-1.5 pr-4">{o.due_date}</td>
                  <td className="py-1.5">{statusBadge(o.status)}</td>
                </tr>
              ))}
              {obligations.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-gray-400 dark:text-gray-500">No obligations data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
