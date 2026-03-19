// Phase 5B — Rural Network Analytics Dashboard
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Wifi, DollarSign, Activity, type LucideIcon } from 'lucide-react'
import {
  api, CsoPayment, RuralFeederPerformance, ErgonEnergyexRecord,
} from '../api/client'

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

export default function RuralNetworkAnalytics() {
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [cso, setCso] = useState<CsoPayment[]>([])
  const [feeders, setFeeders] = useState<RuralFeederPerformance[]>([])
  const [comparison, setComparison] = useState<ErgonEnergyexRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getRuralSummary(),
      api.getCsoPayments(),
      api.getRuralFeederPerformance(),
      api.getErgonEnergyexSplit(),
    ]).then(([s, c, f, comp]) => {
      setSummary(s as Record<string, number>)
      setCso(c.cso)
      setFeeders(f.feeders)
      setComparison(comp.comparison)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // CSO trend by year
  const csoYearly = Object.entries(
    cso.reduce((acc, c) => {
      acc[c.period_year] = (acc[c.period_year] || 0) + c.cso_payment_m_aud
      return acc
    }, {} as Record<number, number>)
  ).map(([year, total]) => ({ year: Number(year), cso: Math.round(total * 10) / 10 })).sort((a, b) => a.year - b.year)

  // SAIDI by feeder tier
  const saidiByTier = ['<50km', '50-100km', '100-200km', '>200km'].map(tier => {
    const items = feeders.filter(f => f.length_tier === tier)
    return {
      tier,
      avg_saidi: items.length > 0 ? Math.round(items.reduce((s, f) => s + f.saidi_minutes, 0) / items.length) : 0,
      count: items.length,
    }
  })

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading rural network data...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Rural Network Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ergon Energy & Energy Queensland — CSO payments, rural SAIDI, RAPS fleet, and Ergon vs Energex comparison</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Energy Queensland — Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="CSO Payments YTD" value={`$${(summary.total_cso_ytd_m ?? 0).toFixed(0)}M`} sub="QLD Govt subsidy" Icon={DollarSign} color="bg-purple-500" />
        <KpiCard label="RAPS Sites" value={String(summary.total_raps_sites ?? 0)} sub={`${summary.operational_raps_sites ?? 0} operational`} Icon={Wifi} color="bg-blue-500" />
        <KpiCard label="RAPS Solar" value={`${(summary.total_raps_solar_kw ?? 0).toFixed(0)} kW`} sub="Remote hybrid systems" Icon={Activity} color="bg-yellow-500" />
        <KpiCard label="Long Rural SAIDI" value={`${(summary.avg_saidi_long_rural ?? 0).toFixed(0)} min`} sub="Feeders >200km" Icon={Activity} color="bg-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSO trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">CSO Payment Trend ($M/year) — Ergon Energy</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={csoYearly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" M" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Bar dataKey="cso" fill="#8B5CF6" name="CSO Payment ($M)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* SAIDI by tier */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Avg SAIDI by Feeder Length Tier (min) — Ergon Energy</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={saidiByTier}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="tier" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" min" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Bar dataKey="avg_saidi" fill="#EF4444" name="Avg SAIDI (min)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ergon vs Energex comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Ergon vs Energex Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Business Unit</th>
                <th className="pb-2 pr-4">Year</th>
                <th className="pb-2 pr-4">SAIDI (min)</th>
                <th className="pb-2 pr-4">SAIFI</th>
                <th className="pb-2 pr-4">Network (km)</th>
                <th className="pb-2 pr-4">Customers</th>
                <th className="pb-2 pr-4">Capex $M</th>
                <th className="pb-2 pr-4">Opex $M</th>
                <th className="pb-2">RAB $M</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {comparison.slice(0, 12).map((r, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4 font-medium">{r.business_unit}</td>
                  <td className="py-1.5 pr-4">{r.period_year}</td>
                  <td className="py-1.5 pr-4">{r.saidi_minutes?.toFixed(1)}</td>
                  <td className="py-1.5 pr-4">{r.saifi_count?.toFixed(2)}</td>
                  <td className="py-1.5 pr-4">{r.network_km?.toLocaleString()}</td>
                  <td className="py-1.5 pr-4">{r.customers?.toLocaleString()}</td>
                  <td className="py-1.5 pr-4">{r.capex_m_aud?.toFixed(0)}</td>
                  <td className="py-1.5 pr-4">{r.opex_m_aud?.toFixed(0)}</td>
                  <td className="py-1.5">{r.rab_m_aud?.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
