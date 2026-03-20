// Workforce & Contractor Analytics
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Users, DollarSign, TrendingDown, Activity, type LucideIcon } from 'lucide-react'
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

const FALLBACK_OPEX = [
  { category: 'Field Operations', actual_m: 84.2, aer_allowed_m: 81.4 },
  { category: 'Network Planning', actual_m: 22.6, aer_allowed_m: 24.0 },
  { category: 'Vegetation Mgmt', actual_m: 34.1, aer_allowed_m: 31.8 },
  { category: 'Customer Service', actual_m: 18.8, aer_allowed_m: 19.2 },
  { category: 'IT/OT Systems', actual_m: 28.6, aer_allowed_m: 24.2 },
  { category: 'Corporate Overhead', actual_m: 41.4, aer_allowed_m: 43.8 },
  { category: 'Safety & Environment', actual_m: 12.2, aer_allowed_m: 11.8 },
  { category: 'Emergency Response', actual_m: 18.5, aer_allowed_m: 16.0 },
]

export default function WorkforceAnalyticsHub() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [opex, setOpex] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getWorkforceSummary(),
      api.getWorkforceOpexBenchmark(),
    ]).then(([s, o]) => {
      setSummary(s ?? {})
      setOpex(Array.isArray(o?.items) ? o.items : Array.isArray(o) ? o : FALLBACK_OPEX)
      setLoading(false)
    }).catch(() => {
      setOpex(FALLBACK_OPEX)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const totalFte = summary.total_workforce_fte ?? 1842
  const contractorRatio = summary.contractor_ratio_pct ?? 34.2
  const costPerCustomer = summary.cost_per_customer ?? 412
  const actualOpex = opex.reduce((a, r) => a + (r.actual_m ?? 0), 0)
  const allowedOpex = opex.reduce((a, r) => a + (r.aer_allowed_m ?? 0), 0)
  const opexGap = actualOpex - allowedOpex

  // Biggest gap category
  const gaps = opex.map(r => ({ category: r.category, gap: (r.actual_m ?? 0) - (r.aer_allowed_m ?? 0) }))
  const biggestGap = gaps.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Workforce & Contractor Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total workforce, contractor ratio, opex benchmarking and AER efficiency gap analysis</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Workforce" value={`${totalFte.toLocaleString()} FTE`} sub="Employee + equivalent contractor" Icon={Users} color="bg-blue-500" />
        <KpiCard label="Contractor Ratio" value={`${contractorRatio.toFixed(1)}%`} sub="Contracted labour proportion" Icon={Activity} color={contractorRatio > 40 ? 'bg-orange-500' : 'bg-green-500'} />
        <KpiCard label="Cost / Customer" value={`$${costPerCustomer.toLocaleString()}`} sub="Total opex per customer per year" Icon={DollarSign} color="bg-purple-500" />
        <KpiCard label="Opex vs AER Allowed" value={`${opexGap >= 0 ? '+' : ''}$${opexGap.toFixed(1)}M`} sub={opexGap > 0 ? 'Over AER allowance' : 'Under AER allowance'} Icon={TrendingDown} color={Math.abs(opexGap) <= 5 ? 'bg-green-500' : opexGap > 0 ? 'bg-red-500' : 'bg-green-500'} />
      </div>

      {/* Key efficiency gap alert */}
      {biggestGap && Math.abs(biggestGap.gap) > 2 && (
        <div className={`rounded-xl border p-4 ${biggestGap.gap > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/40' : 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800/40'}`}>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Key Efficiency Gap: <span className="font-bold">{biggestGap.category}</span>
          </p>
          <p className={`text-xs mt-1 ${biggestGap.gap > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
            {biggestGap.gap > 0 ? '↑ Over' : '↓ Under'} AER allowance by ${Math.abs(biggestGap.gap).toFixed(1)}M — {biggestGap.gap > 0 ? 'AER efficiency question risk at reset' : 'potential capex to opex reclassification needed'}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Opex by Category — Actual vs AER Allowed ($M)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={opex} margin={{ bottom: 40, left: 10 }}>
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
            <Bar dataKey="aer_allowed_m" fill="#6B7280" name="AER Allowed ($M)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Opex Category Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Category</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Actual $M</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">AER Allowed $M</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Variance $M</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Efficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {opex.map((row, i) => {
                const variance = (row.actual_m ?? 0) - (row.aer_allowed_m ?? 0)
                const effPct = row.aer_allowed_m > 0 ? ((row.aer_allowed_m - row.actual_m) / row.aer_allowed_m) * 100 : 0
                return (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-medium">{row.category}</td>
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{(row.actual_m ?? 0).toFixed(1)}</td>
                    <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{(row.aer_allowed_m ?? 0).toFixed(1)}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`font-semibold ${variance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {variance > 0 ? '+' : ''}{variance.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className={`text-xs font-semibold ${effPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {effPct >= 0 ? '+' : ''}{effPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-gray-200 dark:border-gray-600 font-semibold">
                <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">Total</td>
                <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{actualOpex.toFixed(1)}</td>
                <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{allowedOpex.toFixed(1)}</td>
                <td className="py-2.5 pr-4">
                  <span className={`font-bold ${opexGap > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {opexGap > 0 ? '+' : ''}{opexGap.toFixed(1)}
                  </span>
                </td>
                <td className="py-2.5 text-gray-400 dark:text-gray-500">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
