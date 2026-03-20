// AER Expenditure Justification
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { CheckCircle, TrendingUp, DollarSign, Layers, type LucideIcon } from 'lucide-react'
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

const FALLBACK_DATA = [
  { category: 'Asset Replacement', actual_m: 142.3, allowed_m: 138.5, justification_strength: 'Strong', evidence: 'Asset condition assessments, failure history, AER approved AMP' },
  { category: 'Augmentation', actual_m: 58.7, allowed_m: 62.0, justification_strength: 'Strong', evidence: 'Load flow studies, customer connection commitments' },
  { category: 'Non-Network Solutions', actual_m: 12.4, allowed_m: 15.0, justification_strength: 'Moderate', evidence: 'Demand side management programs with partial uptake' },
  { category: 'Vegetation Management', actual_m: 34.1, allowed_m: 31.8, justification_strength: 'Moderate', evidence: 'ELC compliance program — over-run due to adverse growing conditions' },
  { category: 'IT/OT Systems', actual_m: 28.6, allowed_m: 24.2, justification_strength: 'Weak', evidence: 'Digital transformation program — limited AER pre-approved scope' },
  { category: 'Network Operations', actual_m: 41.2, allowed_m: 43.6, justification_strength: 'Strong', evidence: 'Field operations aligned to approved opex model' },
  { category: 'Customer Connections', actual_m: 22.8, allowed_m: 21.5, justification_strength: 'Strong', evidence: 'Metered connection volumes — volume driven over-run' },
  { category: 'Emergency Response', actual_m: 18.5, allowed_m: 16.0, justification_strength: 'Moderate', evidence: 'Storm season exceptional events — AER contingency claimed' },
]

const strengthBadge = (strength: string) => {
  if (strength === 'Strong') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (strength === 'Moderate') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
}

export default function ExpenditureJustification() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAssetIntelExpenditureJustification().then((d) => {
      setData(Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : FALLBACK_DATA)
      setLoading(false)
    }).catch(() => {
      setData(FALLBACK_DATA)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const totalActual = data.reduce((a, r) => a + (r.actual_m ?? 0), 0)
  const totalAllowed = data.reduce((a, r) => a + (r.allowed_m ?? 0), 0)
  const efficiencyRatio = totalAllowed > 0 ? totalActual / totalAllowed : 1
  const strongCount = data.filter(r => r.justification_strength === 'Strong').length
  const aerJustifiedPct = data.length > 0 ? (strongCount / data.length) * 100 : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">AER Expenditure Justification</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Actual vs AER-allowed expenditure by category with justification strength assessment</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="AER Justified" value={`${aerJustifiedPct.toFixed(0)}%`} sub="Categories with strong evidence" Icon={CheckCircle} color={aerJustifiedPct >= 70 ? 'bg-green-500' : 'bg-amber-500'} />
        <KpiCard label="Efficiency Ratio" value={efficiencyRatio.toFixed(2)} sub="Actual ÷ Allowed (1.0 = on budget)" Icon={TrendingUp} color={efficiencyRatio <= 1.0 ? 'bg-green-500' : 'bg-orange-500'} />
        <KpiCard label="Total Actual" value={`$${totalActual.toFixed(0)}M`} sub="Regulatory year expenditure" Icon={DollarSign} color="bg-blue-500" />
        <KpiCard label="Total Allowed" value={`$${totalAllowed.toFixed(0)}M`} sub="AER-approved allowance" Icon={Layers} color="bg-purple-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Actual vs Allowed by Category ($M)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-20} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Bar dataKey="actual_m" fill="#3B82F6" name="Actual ($M)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="allowed_m" fill="#6B7280" name="AER Allowed ($M)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Expenditure Justification Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Category</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Actual $M</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Allowed $M</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Variance $M</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Justification</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Evidence Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {data.map((row, i) => {
                const variance = (row.actual_m ?? 0) - (row.allowed_m ?? 0)
                return (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-medium">{row.category}</td>
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{(row.actual_m ?? 0).toFixed(1)}</td>
                    <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{(row.allowed_m ?? 0).toFixed(1)}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`font-semibold ${variance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {variance > 0 ? '+' : ''}{variance.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${strengthBadge(row.justification_strength)}`}>
                        {row.justification_strength}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-500 dark:text-gray-400 text-xs max-w-xs">{row.evidence}</td>
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
