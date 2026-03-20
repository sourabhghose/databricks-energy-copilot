// STPIS Performance Calculator
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Clock, Zap, TrendingUp, DollarSign, type LucideIcon } from 'lucide-react'
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
  { dnsp: 'Ausgrid', saidi_actual: 62.4, saidi_target: 68.0, saifi_actual: 0.78, saifi_target: 0.85, band: 'B', s_factor: 0.38, revenue_impact_m: 4.2 },
  { dnsp: 'Endeavour', saidi_actual: 71.2, saidi_target: 74.5, saifi_actual: 0.91, saifi_target: 0.95, band: 'B', s_factor: 0.21, revenue_impact_m: 1.8 },
  { dnsp: 'Essential', saidi_actual: 118.6, saidi_target: 110.0, saifi_actual: 1.42, saifi_target: 1.30, band: 'C', s_factor: -0.18, revenue_impact_m: -1.1 },
  { dnsp: 'AusNet', saidi_actual: 88.3, saidi_target: 95.0, saifi_actual: 1.05, saifi_target: 1.12, band: 'B', s_factor: 0.29, revenue_impact_m: 2.6 },
  { dnsp: 'Citipower', saidi_actual: 31.5, saidi_target: 38.0, saifi_actual: 0.41, saifi_target: 0.50, band: 'A', s_factor: 0.72, revenue_impact_m: 3.9 },
  { dnsp: 'Powercor', saidi_actual: 97.4, saidi_target: 98.0, saifi_actual: 1.18, saifi_target: 1.20, band: 'B', s_factor: 0.05, revenue_impact_m: 0.4 },
  { dnsp: 'SA Power', saidi_actual: 104.2, saidi_target: 100.0, saifi_actual: 1.28, saifi_target: 1.25, band: 'C', s_factor: -0.09, revenue_impact_m: -0.7 },
  { dnsp: 'Energex', saidi_actual: 56.8, saidi_target: 65.0, saifi_actual: 0.72, saifi_target: 0.80, band: 'A', s_factor: 0.61, revenue_impact_m: 5.1 },
]

const bandColor = (band: string) => {
  if (band === 'A') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (band === 'B') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
  if (band === 'C') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
}

export default function StpisCalculator() {
  const [data, setData] = useState<any[]>([])
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAioStpis().then((d) => {
      setSummary(d?.summary ?? {})
      setData(Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : FALLBACK_DATA)
      setLoading(false)
    }).catch(() => {
      setData(FALLBACK_DATA)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const avgSaidi = data.length ? data.reduce((a, r) => a + (r.saidi_actual ?? 0), 0) / data.length : 0
  const avgSaifi = data.length ? data.reduce((a, r) => a + (r.saifi_actual ?? 0), 0) / data.length : 0
  const totalSFactor = data.reduce((a, r) => a + (r.s_factor ?? 0), 0)
  const totalRevImpact = data.reduce((a, r) => a + (r.revenue_impact_m ?? 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">STPIS Performance Calculator</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Service Target Performance Incentive Scheme — SAIDI/SAIFI band and revenue adjustment</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Avg SAIDI" value={`${avgSaidi.toFixed(1)} min`} sub="System Average Interruption Duration" Icon={Clock} color="bg-blue-500" />
        <KpiCard label="Avg SAIFI" value={avgSaifi.toFixed(2)} sub="System Average Interruption Frequency" Icon={Zap} color="bg-purple-500" />
        <KpiCard label="Avg S-Factor" value={`${totalSFactor >= 0 ? '+' : ''}${(totalSFactor / (data.length || 1)).toFixed(2)}`} sub="STPIS incentive factor" Icon={TrendingUp} color={totalSFactor >= 0 ? 'bg-green-500' : 'bg-red-500'} />
        <KpiCard label="Total Revenue Adj." value={`${totalRevImpact >= 0 ? '+' : ''}$${totalRevImpact.toFixed(1)}M`} sub="Across all DNSPs" Icon={DollarSign} color={totalRevImpact >= 0 ? 'bg-green-500' : 'bg-red-500'} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">SAIDI Actual vs Target by DNSP (minutes)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="dnsp" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" min" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Bar dataKey="saidi_actual" fill="#3B82F6" name="SAIDI Actual" radius={[3, 3, 0, 0]} />
            <Bar dataKey="saidi_target" fill="#6B7280" name="SAIDI Target" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">STPIS Band Performance — All DNSPs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">DNSP</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">SAIDI Actual</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">SAIDI Target</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">SAIFI Actual</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">SAIFI Target</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Band</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">S-Factor</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Rev. Impact $M</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-medium">{row.dnsp}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{(row.saidi_actual ?? 0).toFixed(1)}</td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{(row.saidi_target ?? 0).toFixed(1)}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{(row.saifi_actual ?? 0).toFixed(2)}</td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{(row.saifi_target ?? 0).toFixed(2)}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${bandColor(row.band)}`}>{row.band}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-semibold ${(row.s_factor ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {(row.s_factor ?? 0) >= 0 ? '+' : ''}{(row.s_factor ?? 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className={`font-semibold ${(row.revenue_impact_m ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {(row.revenue_impact_m ?? 0) >= 0 ? '+' : ''}{(row.revenue_impact_m ?? 0).toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Band A = top quartile (reward), Band B = within target, Band C/D = penalty zone. S-factor applied to Maximum Allowable Revenue.</p>
      </div>
    </div>
  )
}
