// Bushfire Risk Forecast by Zone
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Flame, AlertTriangle, Map, Layers, type LucideIcon } from 'lucide-react'
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

const FALLBACK_ZONES = [
  { zone: 'Blue Mountains BMO', network_km: 284, current_risk_score: 7.8, peak_risk_score: 9.6, fuel_load: 'Very High', bmo_zone: true, mitigation_status: 'Planned', high_risk_assets: 142 },
  { zone: 'Hunter Valley BMO', network_km: 412, current_risk_score: 7.2, peak_risk_score: 9.1, fuel_load: 'High', bmo_zone: true, mitigation_status: 'In Progress', high_risk_assets: 218 },
  { zone: 'Southern Highlands BMO', network_km: 228, current_risk_score: 6.9, peak_risk_score: 8.8, fuel_load: 'High', bmo_zone: true, mitigation_status: 'Planned', high_risk_assets: 98 },
  { zone: 'Central West BMO', network_km: 521, current_risk_score: 6.4, peak_risk_score: 8.4, fuel_load: 'High', bmo_zone: true, mitigation_status: 'In Progress', high_risk_assets: 164 },
  { zone: 'Mid North Coast BMO', network_km: 348, current_risk_score: 6.1, peak_risk_score: 8.2, fuel_load: 'Moderate', bmo_zone: true, mitigation_status: 'Complete', high_risk_assets: 88 },
  { zone: 'New England BMO', network_km: 684, current_risk_score: 5.8, peak_risk_score: 7.9, fuel_load: 'Moderate', bmo_zone: true, mitigation_status: 'Planned', high_risk_assets: 74 },
  { zone: 'Illawarra', network_km: 142, current_risk_score: 4.2, peak_risk_score: 6.4, fuel_load: 'Low', bmo_zone: false, mitigation_status: 'Not Required', high_risk_assets: 12 },
  { zone: 'Western Sydney', network_km: 208, current_risk_score: 3.1, peak_risk_score: 5.2, fuel_load: 'Low', bmo_zone: false, mitigation_status: 'Not Required', high_risk_assets: 6 },
]

const fuelLoadBadge = (load: string) => {
  if (load === 'Very High') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  if (load === 'High') return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
  if (load === 'Moderate') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
}

const mitigationBadge = (status: string) => {
  if (status === 'Complete') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (status === 'In Progress') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
  if (status === 'Planned') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
}

export default function BushfireRiskForecast() {
  const [zones, setZones] = useState<any[]>([])
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getVegRiskBushfireForecast().then((d) => {
      setSummary(d?.summary ?? {})
      setZones(Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : FALLBACK_ZONES)
      setLoading(false)
    }).catch(() => {
      setZones(FALLBACK_ZONES)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const bmoZoneKm = zones.filter(z => z.bmo_zone).reduce((a, z) => a + (z.network_km ?? 0), 0)
  const highRiskZones = zones.filter(z => (z.current_risk_score ?? 0) >= 7).length
  const peakSeasonRisk = zones.length ? Math.max(...zones.map(z => z.peak_risk_score ?? 0)) : 0
  const totalHighRiskAssets = zones.reduce((a, z) => a + (z.high_risk_assets ?? 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Bushfire Risk Forecast by Zone</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Bushfire Management Overlay (BMO) zones — current vs peak season risk scoring and mitigation tracking</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="BMO Zone Network" value={`${bmoZoneKm.toLocaleString()} km`} sub="Network in Bushfire Management Overlay" Icon={Map} color="bg-orange-500" />
        <KpiCard label="High Risk Zones" value={String(highRiskZones)} sub="Risk score ≥ 7.0 (current)" Icon={Flame} color="bg-red-500" />
        <KpiCard label="Peak Season Risk" value={`${peakSeasonRisk.toFixed(1)}/10`} sub="Maximum zone risk (Dec–Feb)" Icon={AlertTriangle} color={peakSeasonRisk >= 9 ? 'bg-red-500' : 'bg-orange-500'} />
        <KpiCard label="High Risk Assets" value={String(totalHighRiskAssets)} sub="Assets in high-risk zones" Icon={Layers} color="bg-purple-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Current vs Peak Season Risk Score by Zone</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={zones} margin={{ bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="zone" tick={{ fontSize: 9, fill: '#9CA3AF' }} angle={-20} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} domain={[0, 10]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Bar dataKey="current_risk_score" fill="#F59E0B" name="Current Risk Score" radius={[3, 3, 0, 0]} />
            <Bar dataKey="peak_risk_score" fill="#EF4444" name="Peak Season Risk Score" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Zone Risk Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Zone</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Network km</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Current Risk</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Peak Risk</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Fuel Load</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">BMO</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">High Risk Assets</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Mitigation Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {zones.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-medium text-xs">{row.zone}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{(row.network_km ?? 0).toLocaleString()}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-bold ${(row.current_risk_score ?? 0) >= 7 ? 'text-red-600 dark:text-red-400' : (row.current_risk_score ?? 0) >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                      {(row.current_risk_score ?? 0).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-bold ${(row.peak_risk_score ?? 0) >= 9 ? 'text-red-600 dark:text-red-400' : (row.peak_risk_score ?? 0) >= 7 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                      {(row.peak_risk_score ?? 0).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${fuelLoadBadge(row.fuel_load)}`}>{row.fuel_load}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    {row.bmo_zone
                      ? <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">BMO</span>
                      : <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-semibold">{row.high_risk_assets}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${mitigationBadge(row.mitigation_status)}`}>{row.mitigation_status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
