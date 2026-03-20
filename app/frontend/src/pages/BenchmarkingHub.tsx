// AER Benchmarking Intelligence
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Award, DollarSign, Map, Calendar, TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'
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

const FALLBACK_PP = [
  { measure: 'Opex per Customer', own: 412, peer_avg: 388, frontier: 310, unit: '$/cust' },
  { measure: 'Opex per Circuit km', own: 8420, peer_avg: 9100, frontier: 7200, unit: '$/km' },
  { measure: 'Opex per MWh Delivered', own: 14.2, peer_avg: 13.8, frontier: 11.5, unit: '$/MWh' },
  { measure: 'Capex per Customer', own: 620, peer_avg: 598, frontier: 510, unit: '$/cust' },
  { measure: 'Staff per 10,000 Customers', own: 8.4, peer_avg: 9.2, frontier: 6.8, unit: 'FTE' },
  { measure: 'Faults per 100 Circuit km', own: 4.2, peer_avg: 4.8, frontier: 3.1, unit: '/100km' },
]

export default function BenchmarkingHub() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [partialProductivity, setPartialProductivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getBenchmarkingSummary(),
      api.getBenchmarkingPartialProductivity(),
    ]).then(([s, pp]) => {
      setSummary(s ?? {})
      setPartialProductivity(Array.isArray(pp?.items) ? pp.items : Array.isArray(pp) ? pp : FALLBACK_PP)
      setLoading(false)
    }).catch(() => {
      setPartialProductivity(FALLBACK_PP)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const efficiencyScore = summary.efficiency_score ?? 82.4
  const opexPerCust = summary.opex_per_customer ?? 412
  const opexPerKm = summary.opex_per_km ?? 8420
  const resetYear = summary.next_reset_year ?? 2029
  const trendDir = summary.trend_direction ?? 'Improving'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">AER Benchmarking Intelligence</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Partial productivity measures against peer DNSPs and AER frontier — regulatory reset intelligence</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Efficiency Score" value={`${efficiencyScore.toFixed(1)}`} sub="AER benchmarking score (100 = frontier)" Icon={Award} color={efficiencyScore >= 85 ? 'bg-green-500' : efficiencyScore >= 70 ? 'bg-amber-500' : 'bg-red-500'} />
        <KpiCard label="Opex / Customer" value={`$${opexPerCust.toFixed(0)}`} sub="Per customer per year" Icon={DollarSign} color="bg-blue-500" />
        <KpiCard label="Opex / km" value={`$${opexPerKm.toLocaleString()}`} sub="Per circuit kilometre" Icon={Map} color="bg-purple-500" />
        <KpiCard label="Next Reset Year" value={String(resetYear)} sub="Regulatory determination period" Icon={Calendar} color="bg-gray-500" />
      </div>

      {/* Trend indicator */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3">
          {trendDir === 'Improving' ? (
            <TrendingUp size={24} className="text-green-500" />
          ) : (
            <TrendingDown size={24} className="text-red-500" />
          )}
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Efficiency Trend:&nbsp;
              <span className={trendDir === 'Improving' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {trendDir}
              </span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {trendDir === 'Improving'
                ? 'Efficiency score has improved 3.2 points over the past 2 regulatory years — on track for reset submission'
                : 'Efficiency score has declined — opex overspend relative to AER benchmarks requires explanation in reset submission'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Partial Productivity Measures — Own vs Peer Avg vs Frontier</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={partialProductivity} margin={{ bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="measure" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-20} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Bar dataKey="own" fill="#3B82F6" name="Own DNSP" radius={[3, 3, 0, 0]} />
            <Bar dataKey="peer_avg" fill="#8B5CF6" name="Peer Average" radius={[3, 3, 0, 0]} />
            <Bar dataKey="frontier" fill="#10B981" name="Frontier" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Partial Productivity Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Measure</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Unit</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Own DNSP</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Peer Avg</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Frontier</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">vs Frontier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {partialProductivity.map((row, i) => {
                const gap = ((row.own - row.frontier) / row.frontier) * 100
                return (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-medium">{row.measure}</td>
                    <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 text-xs">{row.unit}</td>
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-semibold">{typeof row.own === 'number' ? row.own.toLocaleString() : row.own}</td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400">{typeof row.peer_avg === 'number' ? row.peer_avg.toLocaleString() : row.peer_avg}</td>
                    <td className="py-2.5 pr-4 text-green-600 dark:text-green-400">{typeof row.frontier === 'number' ? row.frontier.toLocaleString() : row.frontier}</td>
                    <td className="py-2.5">
                      <span className={`text-xs font-semibold ${gap > 15 ? 'text-red-600 dark:text-red-400' : gap > 5 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                        {gap > 0 ? '+' : ''}{gap.toFixed(1)}%
                      </span>
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
