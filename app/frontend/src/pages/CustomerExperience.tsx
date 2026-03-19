// Customer Experience Analytics
import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Star, ThumbsUp, MessageCircle, Smartphone, type LucideIcon } from 'lucide-react'
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

export default function CustomerExperience() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [npsTrend, setNpsTrend] = useState<any[]>([])
  const [complaints, setComplaints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getCxSummary(),
      api.getCxNpsTrend(),
      api.getCxComplaints(),
    ]).then(([s, n, c]) => {
      setSummary(s ?? {})
      setNpsTrend(Array.isArray(n?.trend) ? n.trend : Array.isArray(n) ? n : [])
      setComplaints(Array.isArray(c?.by_category) ? c.by_category : Array.isArray(c) ? c : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Customer Experience Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">NPS, CSAT, complaints and digital adoption trends</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="NPS Score" value={String(summary.nps_score ?? 0)} sub="Net Promoter Score" Icon={Star} color="bg-blue-500" />
        <KpiCard label="CSAT Score" value={`${(summary.csat_score ?? 0).toFixed(1)}/5`} sub="Customer satisfaction" Icon={ThumbsUp} color="bg-green-500" />
        <KpiCard label="Complaints / 1000" value={`${(summary.complaints_per_1000 ?? 0).toFixed(2)}`} sub="Complaints per 1,000 customers" Icon={MessageCircle} color="bg-orange-500" />
        <KpiCard label="Digital Adoption" value={`${(summary.digital_adoption_pct ?? 0).toFixed(0)}%`} sub="Self-service & app usage" Icon={Smartphone} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">NPS Trend — Rolling 12 Months</h2>
          {npsTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={npsTrend} margin={{ bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} domain={[-100, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
                <Line type="monotone" dataKey="nps" stroke="#3B82F6" name="NPS" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="industry_avg" stroke="#6B7280" name="Industry Avg" dot={false} strokeDasharray="4 2" strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">No NPS trend data</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Complaints by Category</h2>
          {complaints.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={complaints} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 10, fill: '#9CA3AF' }} width={55} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
                <Bar dataKey="count" fill="#EF4444" name="Complaints" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">No complaints data</p>
          )}
        </div>
      </div>
    </div>
  )
}
