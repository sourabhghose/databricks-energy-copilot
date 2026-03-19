// Phase 5B — CSO Subsidy Tracker
import { useEffect, useState } from 'react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { DollarSign, CheckCircle, AlertTriangle, Wifi } from 'lucide-react'
import { api, CsoPayment, NonNetworkAlternative } from '../api/client'

export default function CsoSubsidyTracker() {
  const [cso, setCso] = useState<CsoPayment[]>([])
  const [nna, setNna] = useState<NonNetworkAlternative[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState(0)

  useEffect(() => {
    Promise.all([
      api.getCsoPayments(yearFilter ? { year: yearFilter } : {}),
      api.getNonNetworkAlternatives(),
    ]).then(([c, n]) => {
      setCso(c.cso)
      setNna(n.alternatives)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [yearFilter])

  const totalCso = cso.reduce((s, c) => s + c.cso_payment_m_aud, 0)
  const totalUneconomic = cso.reduce((s, c) => s + c.uneconomic_cost_m_aud, 0)
  const avgCoverage = totalUneconomic > 0 ? (totalCso / totalUneconomic * 100) : 0

  const lineData = cso.map(c => ({
    label: `${c.period_year} ${c.period_quarter}`,
    uneconomic: c.uneconomic_cost_m_aud,
    cso: c.cso_payment_m_aud,
  })).slice(0, 20)

  const ergonNna = nna.filter(n => n.dnsp === 'Ergon Energy')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">CSO Subsidy Tracker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ergon Energy Community Service Obligation payments and non-network alternatives</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            <option value={0}>All Years</option>
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2024}>2024</option>
            <option value={2023}>2023</option>
          </select>
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Ergon — Synthetic</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total CSO Payments', value: `$${totalCso.toFixed(0)}M`, sub: 'Cumulative', Icon: DollarSign, color: 'bg-purple-500' },
          { label: 'Total Uneconomic Cost', value: `$${totalUneconomic.toFixed(0)}M`, sub: 'Rural network loss', Icon: AlertTriangle, color: 'bg-red-500' },
          { label: 'Average Coverage', value: `${avgCoverage.toFixed(1)}%`, sub: 'CSO / uneconomic cost', Icon: CheckCircle, color: 'bg-green-500' },
          { label: 'Non-Network Alternatives', value: String(ergonNna.length), sub: 'Assessed options', Icon: Wifi, color: 'bg-blue-500' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
            <div className={`p-2.5 rounded-lg ${kpi.color}`}><kpi.Icon size={20} className="text-white" /></div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{kpi.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{kpi.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CSO vs Uneconomic line chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">CSO Payment vs Uneconomic Cost Trend ($M/quarter)</h2>
        {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9CA3AF' }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" M" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
              <Line type="monotone" dataKey="uneconomic" stroke="#EF4444" name="Uneconomic Cost ($M)" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="cso" stroke="#8B5CF6" name="CSO Payment ($M)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Non-network alternatives table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Non-Network Alternatives Register</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-3">DNSP</th>
                <th className="pb-2 pr-3">Zone Sub</th>
                <th className="pb-2 pr-3">Augmentation $M</th>
                <th className="pb-2 pr-3">NNA Cost $M</th>
                <th className="pb-2 pr-3">Saving $M</th>
                <th className="pb-2 pr-3">Recommended Solution</th>
                <th className="pb-2">RIT-D Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {nna.slice(0, 20).map((r, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-3">{r.dnsp}</td>
                  <td className="py-1.5 pr-3 font-mono text-[10px]">{r.zone_substation}</td>
                  <td className="py-1.5 pr-3">{r.augmentation_cost_m_aud?.toFixed(1)}</td>
                  <td className="py-1.5 pr-3">{r.non_network_cost_m_aud?.toFixed(1)}</td>
                  <td className="py-1.5 pr-3 font-semibold text-green-600 dark:text-green-400">{(r.augmentation_cost_m_aud - r.non_network_cost_m_aud)?.toFixed(1)}</td>
                  <td className="py-1.5 pr-3 max-w-xs truncate">{r.recommended_solution}</td>
                  <td className="py-1.5">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${r.rit_d_required ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{r.rit_d_required ? 'Yes' : 'No'}</span>
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
