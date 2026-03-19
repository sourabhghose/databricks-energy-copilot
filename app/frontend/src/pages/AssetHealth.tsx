// Asset Health & Risk Management
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Activity, AlertTriangle, Heart, DollarSign, type LucideIcon } from 'lucide-react'
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

export default function AssetHealth() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [riskMatrix, setRiskMatrix] = useState<any[]>([])
  const [forecast, setForecast] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getAssetHealthSummary(),
      api.getAssetHealthRiskMatrix(),
      api.getAssetHealthReplacementForecast(),
    ]).then(([s, r, f]) => {
      setSummary(s ?? {})
      setRiskMatrix(Array.isArray(r?.matrix) ? r.matrix : Array.isArray(r) ? r : [])
      setForecast(Array.isArray(f?.forecast) ? f.forecast : Array.isArray(f) ? f : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Asset Health &amp; Risk Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Health scores, risk matrix and replacement capex forecast</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Assets" value={String(summary.total_assets ?? 0)} sub="Network assets tracked" Icon={Activity} color="bg-blue-500" />
        <KpiCard label="Critical Risk" value={String(summary.critical_risk_count ?? 0)} sub="Immediate action" Icon={AlertTriangle} color="bg-red-500" />
        <KpiCard label="Avg Health Score" value={`${(summary.avg_health_score ?? 0).toFixed(1)}`} sub="Out of 10" Icon={Heart} color="bg-green-500" />
        <KpiCard label="Replacement Capex" value={`$${(summary.replacement_capex_m ?? 0).toFixed(0)}M`} sub="5-year forecast" Icon={DollarSign} color="bg-purple-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Replacement Capex Forecast by Year ($M)</h2>
        {forecast.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={forecast} margin={{ bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" M" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
              <Bar dataKey="capex_m" fill="#3B82F6" name="Replacement Capex ($M)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">No forecast data available</p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Risk Matrix — Asset Type × Consequence / Likelihood</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Asset Type</th>
                <th className="pb-2 pr-4">Consequence</th>
                <th className="pb-2 pr-4">Likelihood</th>
                <th className="pb-2 pr-4">Risk Score</th>
                <th className="pb-2">Risk Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {riskMatrix.map((row, i) => {
                const level = row.risk_level ?? row.risk_rating ?? ''
                const badgeColor = level === 'Critical' || level === 'Extreme'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : level === 'High'
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                  : level === 'Medium'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                return (
                  <tr key={i} className="text-gray-700 dark:text-gray-300">
                    <td className="py-1.5 pr-4 font-medium">{row.asset_type}</td>
                    <td className="py-1.5 pr-4">{row.consequence}</td>
                    <td className="py-1.5 pr-4">{row.likelihood}</td>
                    <td className="py-1.5 pr-4">{row.risk_score}</td>
                    <td className="py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badgeColor}`}>{level}</span></td>
                  </tr>
                )
              })}
              {riskMatrix.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-gray-400 dark:text-gray-500">No risk matrix data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
