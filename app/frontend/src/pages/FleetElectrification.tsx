// Fleet Electrification
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Car, Zap, DollarSign, Leaf, type LucideIcon } from 'lucide-react'
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

export default function FleetElectrification() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [vehicles, setVehicles] = useState<any[]>([])
  const [transitionPlan, setTransitionPlan] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getFleetSummary(),
      api.getFleetVehicles(),
      api.getFleetTransitionPlan(),
    ]).then(([s, v, t]) => {
      setSummary(s ?? {})
      setVehicles(Array.isArray(v?.categories) ? v.categories : Array.isArray(v) ? v : [])
      setTransitionPlan(Array.isArray(t?.plan) ? t.plan : Array.isArray(t) ? t : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Fleet Electrification</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">EV transition progress, fuel cost savings and emissions reduction to 2030</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Fleet" value={String(summary.total_fleet ?? 0)} sub="All vehicle types" Icon={Car} color="bg-gray-500" />
        <KpiCard label="EV Count" value={String(summary.ev_count ?? 0)} sub="Electric vehicles" Icon={Zap} color="bg-green-500" />
        <KpiCard label="Fuel Cost Saved" value={`$${(summary.fuel_cost_saved_m ?? 0).toFixed(2)}M`} sub="YTD savings vs ICE fleet" Icon={DollarSign} color="bg-blue-500" />
        <KpiCard label="CO2e Saved YTD" value={`${(summary.co2e_saved_t_ytd ?? 0).toLocaleString()} t`} sub="Emissions avoided" Icon={Leaf} color="bg-emerald-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">EV Transition Plan — Additions per Year to 2030</h2>
        {transitionPlan.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={transitionPlan} margin={{ bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
              <Bar dataKey="ev_additions" fill="#22C55E" name="EV Additions" radius={[3, 3, 0, 0]} />
              <Bar dataKey="cumulative_ev" fill="#3B82F6" name="Cumulative EV Fleet" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">No transition plan data</p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Vehicle Categories</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">Total</th>
                <th className="pb-2 pr-4">EV</th>
                <th className="pb-2 pr-4">ICE</th>
                <th className="pb-2">EV %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {vehicles.map((v, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4 font-medium">{v.category}</td>
                  <td className="py-1.5 pr-4">{v.total ?? 0}</td>
                  <td className="py-1.5 pr-4 text-green-600 dark:text-green-400">{v.ev_count ?? v.ev ?? 0}</td>
                  <td className="py-1.5 pr-4">{v.ice_count ?? v.ice ?? 0}</td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, v.ev_pct ?? 0)}%` }} />
                      </div>
                      <span>{(v.ev_pct ?? 0).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-gray-400 dark:text-gray-500">No vehicle data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
