// SF6 & ESG Reporting
import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Wind, Leaf, Car, Sun, type LucideIcon } from 'lucide-react'
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

function riskBadge(risk: string) {
  const r = (risk ?? '').toLowerCase()
  const cls = r === 'low'
    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    : r === 'medium'
    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    : r === 'high' || r === 'critical'
    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{risk}</span>
}

export default function Sf6Esg() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [sf6Assets, setSf6Assets] = useState<any[]>([])
  const [emissionsTrend, setEmissionsTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getEsqSummary(),
      api.getEsqSf6(),
      api.getEsqEmissionsTrend(),
    ]).then(([s, sf6, e]) => {
      setSummary(s ?? {})
      setSf6Assets(Array.isArray(sf6?.assets) ? sf6.assets : Array.isArray(sf6) ? sf6 : [])
      setEmissionsTrend(Array.isArray(e?.trend) ? e.trend : Array.isArray(e) ? e : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">SF6 &amp; ESG Reporting</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">SF6 leakage, Scope 1 emissions, fleet electrification and renewable office energy</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="SF6 Leakage YTD" value={`${(summary.sf6_leakage_kg_ytd ?? 0).toFixed(1)} kg`} sub="Greenhouse gas leakage" Icon={Wind} color="bg-red-500" />
        <KpiCard label="Scope 1 Emissions" value={`${(summary.scope1_emissions_tco2e ?? 0).toLocaleString()} tCO2e`} sub="Direct emissions YTD" Icon={Leaf} color="bg-orange-500" />
        <KpiCard label="Fleet EV %" value={`${(summary.fleet_ev_pct ?? 0).toFixed(0)}%`} sub="Electric vehicles in fleet" Icon={Car} color="bg-green-500" />
        <KpiCard label="Renewable Office %" value={`${(summary.renewable_office_pct ?? 0).toFixed(0)}%`} sub="Office renewable energy" Icon={Sun} color="bg-blue-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Total Emissions Trend — 5 Years (tCO2e)</h2>
        {emissionsTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={emissionsTrend} margin={{ bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
              <Line type="monotone" dataKey="total_tco2e" stroke="#EF4444" name="Total Emissions (tCO2e)" dot={{ r: 3 }} strokeWidth={2} />
              <Line type="monotone" dataKey="scope1_tco2e" stroke="#F97316" name="Scope 1" dot={{ r: 3 }} strokeWidth={1.5} />
              <Line type="monotone" dataKey="scope2_tco2e" stroke="#3B82F6" name="Scope 2" dot={{ r: 3 }} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">No emissions trend data</p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">SF6 Asset Inventory</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Asset Type</th>
                <th className="pb-2 pr-4">Gas (kg)</th>
                <th className="pb-2 pr-4">Leakage Rate %</th>
                <th className="pb-2">Risk Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {sf6Assets.map((a, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4 font-medium">{a.asset_type}</td>
                  <td className="py-1.5 pr-4">{(a.gas_kg ?? 0).toFixed(1)}</td>
                  <td className="py-1.5 pr-4">{(a.leakage_rate_pct ?? 0).toFixed(3)}%</td>
                  <td className="py-1.5">{riskBadge(a.risk_level)}</td>
                </tr>
              ))}
              {sf6Assets.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-gray-400 dark:text-gray-500">No SF6 asset data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
