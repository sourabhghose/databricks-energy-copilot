// DNSP Peer Comparison
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import { Award, TrendingUp, Users, Star, type LucideIcon } from 'lucide-react'
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

const FALLBACK_PEERS = [
  { dnsp: 'Citipower', efficiency_score: 94.2, opex_per_cust: 318, opex_per_km: 7120, saidi: 31.5, customers_k: 340, is_own: false },
  { dnsp: 'Energex', efficiency_score: 91.8, opex_per_cust: 341, opex_per_km: 7580, saidi: 56.8, customers_k: 1420, is_own: false },
  { dnsp: 'Ausgrid', efficiency_score: 88.3, opex_per_cust: 378, opex_per_km: 7940, saidi: 62.4, customers_k: 1820, is_own: false },
  { dnsp: 'AusNet', efficiency_score: 84.6, opex_per_cust: 392, opex_per_km: 8210, saidi: 88.3, customers_k: 720, is_own: false },
  { dnsp: 'Endeavour', efficiency_score: 82.4, opex_per_cust: 412, opex_per_km: 8420, saidi: 71.2, customers_k: 980, is_own: true },
  { dnsp: 'Powercor', efficiency_score: 79.1, opex_per_cust: 428, opex_per_km: 8840, saidi: 97.4, customers_k: 880, is_own: false },
  { dnsp: 'SA Power', efficiency_score: 75.8, opex_per_cust: 451, opex_per_km: 9210, saidi: 104.2, customers_k: 880, is_own: false },
  { dnsp: 'Essential', efficiency_score: 71.4, opex_per_cust: 489, opex_per_km: 9840, saidi: 118.6, customers_k: 920, is_own: false },
]

export default function PeerComparison() {
  const [peers, setPeers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getBenchmarkingPeers().then((d) => {
      setPeers(Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : FALLBACK_PEERS)
      setLoading(false)
    }).catch(() => {
      setPeers(FALLBACK_PEERS)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const sorted = [...peers].sort((a, b) => (b.efficiency_score ?? 0) - (a.efficiency_score ?? 0))
  const own = peers.find(p => p.is_own)
  const ownRank = sorted.findIndex(p => p.is_own) + 1
  const industryAvg = peers.length ? peers.reduce((a, p) => a + (p.efficiency_score ?? 0), 0) / peers.length : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">DNSP Peer Comparison</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Efficiency scores, opex metrics and reliability benchmarks across all Australian DNSPs</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Own Rank" value={`${ownRank} / ${peers.length}`} sub="AER efficiency ranking" Icon={Award} color={ownRank <= 3 ? 'bg-green-500' : ownRank <= 6 ? 'bg-amber-500' : 'bg-red-500'} />
        <KpiCard label="Own Efficiency Score" value={`${(own?.efficiency_score ?? 0).toFixed(1)}`} sub={own?.dnsp ?? 'Own DNSP'} Icon={TrendingUp} color="bg-blue-500" />
        <KpiCard label="Industry Avg Score" value={`${industryAvg.toFixed(1)}`} sub="Average across 8 DNSPs" Icon={Users} color="bg-purple-500" />
        <KpiCard label="Frontier Score" value="100.0" sub="AER frontier benchmark" Icon={Star} color="bg-green-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Efficiency Score by DNSP</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={sorted} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis dataKey="dnsp" type="category" tick={{ fontSize: 11, fill: '#9CA3AF' }} width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <Bar dataKey="efficiency_score" radius={[0, 3, 3, 0]} name="Efficiency Score">
              {sorted.map((entry, i) => (
                <Cell key={i} fill={entry.is_own ? '#3B82F6' : '#6B7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Blue bar = own DNSP ({own?.dnsp})</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Peer Benchmarking — Full Metrics</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Rank</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">DNSP</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Eff. Score</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Opex/Cust $</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Opex/km $</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">SAIDI min</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Customers (k)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {sorted.map((row, i) => (
                <tr
                  key={i}
                  className={row.is_own
                    ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                  }
                >
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 font-mono">#{i + 1}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-semibold">
                    {row.dnsp}
                    {row.is_own && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(own)</span>}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-bold ${(row.efficiency_score ?? 0) >= 88 ? 'text-green-600 dark:text-green-400' : (row.efficiency_score ?? 0) >= 78 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      {(row.efficiency_score ?? 0).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">${(row.opex_per_cust ?? 0).toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">${(row.opex_per_km ?? 0).toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{(row.saidi ?? 0).toFixed(1)}</td>
                  <td className="py-2.5 text-gray-900 dark:text-gray-100">{row.customers_k?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
