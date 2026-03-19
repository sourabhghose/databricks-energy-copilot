// Large Load Connection Pipeline
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { FileText, Zap, Building2, Car, type LucideIcon } from 'lucide-react'
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
  const cls = s === 'connected' || s === 'approved' || s === 'complete'
    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    : s === 'in progress' || s === 'under review' || s === 'pending'
    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
    : s === 'on hold' || s === 'deferred'
    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{status}</span>
}

export default function LargeLoadPipeline() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [pipeline, setPipeline] = useState<any[]>([])
  const [revenueByType, setRevenueByType] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getLargeLoadSummary(),
      api.getLargeLoadPipeline(),
      api.getLargeLoadRevenueOpportunity(),
    ]).then(([s, p, r]) => {
      setSummary(s ?? {})
      setPipeline(Array.isArray(p?.pipeline) ? p.pipeline : Array.isArray(p) ? p : [])
      setRevenueByType(Array.isArray(r?.by_type) ? r.by_type : Array.isArray(r) ? r : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Large Load Connection Pipeline</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Data centres, EV charging hubs and industrial load connection applications</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Applications" value={String(summary.total_applications ?? 0)} sub="Active connection requests" Icon={FileText} color="bg-blue-500" />
        <KpiCard label="Total MW Requested" value={`${(summary.total_mw_requested ?? 0).toFixed(0)} MW`} sub="Aggregate load" Icon={Zap} color="bg-purple-500" />
        <KpiCard label="Data Centre MW" value={`${(summary.data_centre_mw ?? 0).toFixed(0)} MW`} sub="Data centre pipeline" Icon={Building2} color="bg-indigo-500" />
        <KpiCard label="EV Charging MW" value={`${(summary.ev_charging_mw ?? 0).toFixed(0)} MW`} sub="EV hub pipeline" Icon={Car} color="bg-green-500" />
      </div>

      {revenueByType.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">MW by Load Type</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenueByType} margin={{ bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="load_type" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" MW" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Bar dataKey="total_mw" fill="#6366F1" name="Total MW" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Connection Pipeline</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Customer</th>
                <th className="pb-2 pr-4">Load Type</th>
                <th className="pb-2 pr-4">MW</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Est. Connection Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {pipeline.map((p, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4 font-medium">{p.customer_name ?? p.customer}</td>
                  <td className="py-1.5 pr-4">{p.load_type}</td>
                  <td className="py-1.5 pr-4">{(p.mw_requested ?? p.mw ?? 0).toFixed(0)}</td>
                  <td className="py-1.5 pr-4">{statusBadge(p.status)}</td>
                  <td className="py-1.5">{p.connection_date ?? p.est_connection_date ?? '—'}</td>
                </tr>
              ))}
              {pipeline.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-gray-400 dark:text-gray-500">No pipeline data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
