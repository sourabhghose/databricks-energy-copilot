// Customer Harm Framework
import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ShieldAlert, Zap, MessageSquare, Clock, type LucideIcon } from 'lucide-react'
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

function metricBadge(status: string) {
  const s = (status ?? '').toLowerCase()
  const cls = s === 'green' || s === 'on track' || s === 'pass'
    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    : s === 'amber' || s === 'at risk' || s === 'watch'
    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{status}</span>
}

export default function CustomerHarm() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [metrics, setMetrics] = useState<any[]>([])
  const [trend, setTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getCustomerHarmSummary(),
      api.getCustomerHarmMetrics(),
      api.getCustomerHarmTrend(),
    ]).then(([s, m, t]) => {
      setSummary(s ?? {})
      setMetrics(Array.isArray(m?.metrics) ? m.metrics : Array.isArray(m) ? m : [])
      setTrend(Array.isArray(t?.trend) ? t.trend : Array.isArray(t) ? t : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Customer Harm Framework</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Harm index, interruption rates, voltage complaints and connection performance</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Harm Index Score" value={`${(summary.harm_index_score ?? 0).toFixed(2)}`} sub="Composite harm metric" Icon={ShieldAlert} color="bg-red-500" />
        <KpiCard label="Unplanned Interruptions" value={`${(summary.unplanned_interruptions_per_customer ?? 0).toFixed(2)}`} sub="Per customer YTD" Icon={Zap} color="bg-orange-500" />
        <KpiCard label="Voltage Complaints" value={String(summary.voltage_complaints ?? 0)} sub="YTD complaints lodged" Icon={MessageSquare} color="bg-yellow-500" />
        <KpiCard label="Connection Delay Rate" value={`${(summary.connection_delay_rate_pct ?? 0).toFixed(1)}%`} sub="% delayed past benchmark" Icon={Clock} color="bg-blue-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Harm Index Trend — Rolling 12 Months</h2>
        {trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={{ bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
              <Line type="monotone" dataKey="harm_index" stroke="#EF4444" name="Harm Index" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="benchmark" stroke="#6B7280" name="Benchmark" dot={false} strokeDasharray="4 2" strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">No trend data available</p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Metrics vs Benchmarks</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Metric</th>
                <th className="pb-2 pr-4">Actual</th>
                <th className="pb-2 pr-4">Benchmark</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {metrics.map((m, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4 font-medium">{m.metric_name ?? m.metric}</td>
                  <td className="py-1.5 pr-4">{m.actual}</td>
                  <td className="py-1.5 pr-4">{m.benchmark}</td>
                  <td className="py-1.5">{metricBadge(m.status)}</td>
                </tr>
              ))}
              {metrics.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-gray-400 dark:text-gray-500">No metrics data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
