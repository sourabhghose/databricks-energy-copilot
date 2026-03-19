// Vegetation Management
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Scissors, CheckCircle, AlertTriangle, Users, type LucideIcon } from 'lucide-react'
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

export default function VegetationManagement() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [zones, setZones] = useState<any[]>([])
  const [contractors, setContractors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getVegetationSummary(),
      api.getVegetationByZone(),
      api.getVegetationContractors(),
    ]).then(([s, z, c]) => {
      setSummary(s ?? {})
      setZones(Array.isArray(z?.zones) ? z.zones : Array.isArray(z) ? z : [])
      setContractors(Array.isArray(c?.contractors) ? c.contractors : Array.isArray(c) ? c : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Vegetation Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Clearance compliance by zone and contractor performance</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Spans" value={`${(summary.total_spans_km ?? 0).toLocaleString()} km`} sub="Network coverage" Icon={Scissors} color="bg-green-500" />
        <KpiCard label="Compliance" value={`${(summary.compliance_pct ?? 0).toFixed(1)}%`} sub="Clearance compliant" Icon={CheckCircle} color="bg-blue-500" />
        <KpiCard label="Non-Compliant Spans" value={String(summary.non_compliant_spans ?? 0)} sub="Remediation required" Icon={AlertTriangle} color="bg-red-500" />
        <KpiCard label="Contractor Utilisation" value={`${(summary.contractor_utilisation_pct ?? 0).toFixed(0)}%`} sub="Of contracted capacity" Icon={Users} color="bg-purple-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Compliance % by Zone</h2>
        {zones.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={zones} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="zone" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-20} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Bar dataKey="compliance_pct" fill="#22C55E" name="Compliance %" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">No zone data available</p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Contractor Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Contractor</th>
                <th className="pb-2 pr-4">Cleared MTD (km)</th>
                <th className="pb-2 pr-4">Target (km)</th>
                <th className="pb-2">Compliance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {contractors.map((c, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4 font-medium">{c.contractor_name ?? c.contractor}</td>
                  <td className="py-1.5 pr-4">{(c.km_cleared_mtd ?? 0).toFixed(0)}</td>
                  <td className="py-1.5 pr-4">{(c.km_target_mtd ?? c.target_km ?? 0).toFixed(0)}</td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, c.compliance_rate_pct ?? c.compliance_pct ?? 0)}%` }} />
                      </div>
                      <span>{(c.compliance_rate_pct ?? c.compliance_pct ?? 0).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {contractors.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-gray-400 dark:text-gray-500">No contractor data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
