// Network Reliability (SAIDI/SAIFI) Deep-Dive
import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Clock, Target, TrendingDown, Activity, type LucideIcon } from 'lucide-react'
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

export default function ReliabilityDnsp() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [feeders, setFeeders] = useState<any[]>([])
  const [trend, setTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getReliabilityDnspSummary(),
      api.getReliabilityDnspWorstFeeders(),
      api.getReliabilityDnspTrend(),
    ]).then(([s, f, t]) => {
      setSummary(s ?? {})
      setFeeders(Array.isArray(f?.feeders) ? f.feeders : Array.isArray(f) ? f : [])
      setTrend(Array.isArray(t?.trend) ? t.trend : Array.isArray(t) ? t : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Network Reliability (SAIDI/SAIFI)</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Year-to-date reliability indices, worst feeders and 12-month trend</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="SAIDI YTD (min)" value={`${(summary.saidi_ytd ?? 0).toFixed(1)}`} sub="System avg interruption duration" Icon={Clock} color="bg-blue-500" />
        <KpiCard label="SAIDI Target (min)" value={`${(summary.saidi_target ?? 0).toFixed(1)}`} sub="AER regulatory limit" Icon={Target} color="bg-gray-500" />
        <KpiCard label="SAIFI YTD" value={`${(summary.saifi_ytd ?? 0).toFixed(2)}`} sub="Avg interruption frequency" Icon={TrendingDown} color="bg-orange-500" />
        <KpiCard label="CAIDI (min)" value={`${(summary.caidi_min ?? 0).toFixed(1)}`} sub="Avg restoration time" Icon={Activity} color="bg-green-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">SAIDI Trend — Rolling 12 Months</h2>
        {trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={{ bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" min" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
              <Line type="monotone" dataKey="saidi" stroke="#3B82F6" name="SAIDI (min)" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="target" stroke="#EF4444" name="Target" dot={false} strokeDasharray="4 2" strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">No trend data available</p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Worst Performing Feeders</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Feeder</th>
                <th className="pb-2 pr-4">SAIDI (min)</th>
                <th className="pb-2 pr-4">Customers Affected</th>
                <th className="pb-2">Primary Cause</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {feeders.map((f, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4 font-medium">{f.feeder_id ?? f.feeder}</td>
                  <td className="py-1.5 pr-4 text-red-600 dark:text-red-400 font-semibold">{(f.saidi ?? 0).toFixed(1)}</td>
                  <td className="py-1.5 pr-4">{(f.customers_affected ?? 0).toLocaleString()}</td>
                  <td className="py-1.5 text-gray-500 dark:text-gray-400">{f.primary_cause ?? f.cause ?? '—'}</td>
                </tr>
              ))}
              {feeders.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-gray-400 dark:text-gray-500">No feeder data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
