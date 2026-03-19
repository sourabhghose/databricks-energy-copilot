// Phase 5B — STPIS Performance Tracker
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Activity, DollarSign, TrendingUp, AlertTriangle, type LucideIcon } from 'lucide-react'
import { api, StpisRecord, StpisRiskRecord } from '../api/client'

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

const BAND_COLORS: Record<string, string> = {
  A: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  B: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  C: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  D: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

export default function StpisTracker() {
  const [stpis, setStpis] = useState<StpisRecord[]>([])
  const [risk, setRisk] = useState<StpisRiskRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dnspFilter, setDnspFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getAerStpis(dnspFilter ? { dnsp: dnspFilter } : {}),
      api.getAerStpisRisk(),
    ]).then(([sp, r]) => {
      setStpis(sp.stpis)
      setRisk(r.risk)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [dnspFilter])

  const latest = stpis.filter(s => s.period_year === Math.max(...stpis.map(x => x.period_year), 0))
  const totalRisk = risk.reduce((sum, r) => sum + (r.total_at_risk ?? 0), 0)

  const saidiData = latest.map(r => ({
    name: r.dnsp.split(' ')[0],
    saidi: r.saidi_actual,
    target: r.saidi_target,
    band: r.performance_band,
  }))

  const saifiData = latest.map(r => ({
    name: r.dnsp.split(' ')[0],
    saifi: r.saifi_actual,
    target: r.saifi_target,
  }))

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading STPIS data...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">STPIS Performance Tracker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Service Target Performance Incentive Scheme — s-factors, bands & revenue at risk</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dnspFilter}
            onChange={e => setDnspFilter(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <option value="">All DNSPs</option>
            <option value="AusNet Services">AusNet Services</option>
            <option value="Ergon Energy">Ergon Energy</option>
            <option value="Energex">Energex</option>
          </select>
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic data</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Revenue at Risk" value={`$${(totalRisk / 1e6).toFixed(1)}M`} sub="All DNSPs combined" Icon={DollarSign} color="bg-red-500" />
        <KpiCard label="STPIS Records" value={String(stpis.length)} sub="DNSP × year entries" Icon={Activity} color="bg-blue-500" />
        <KpiCard label="Band A (Outperforming)" value={String(stpis.filter(s => s.performance_band === 'A').length)} sub="Revenue benefit" Icon={TrendingUp} color="bg-green-500" />
        <KpiCard label="Band D (Underperforming)" value={String(stpis.filter(s => s.performance_band === 'D').length)} sub="Revenue penalty risk" Icon={AlertTriangle} color="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">SAIDI Actual vs Target (latest year)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={saidiData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" min" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
              <Bar dataKey="saidi" fill="#3B82F6" name="SAIDI Actual (min)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="target" fill="#6B7280" name="SAIDI Target (min)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">SAIFI Actual vs Target (latest year)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={saifiData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
              <Bar dataKey="saifi" fill="#10B981" name="SAIFI Actual" radius={[3, 3, 0, 0]} />
              <Bar dataKey="target" fill="#6B7280" name="SAIFI Target" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* STPIS Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">STPIS Performance Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-3">DNSP</th>
                <th className="pb-2 pr-3">Year</th>
                <th className="pb-2 pr-3">SAIDI Actual</th>
                <th className="pb-2 pr-3">SAIDI Target</th>
                <th className="pb-2 pr-3">SAIFI Actual</th>
                <th className="pb-2 pr-3">SAIFI Target</th>
                <th className="pb-2 pr-3">S-Factor</th>
                <th className="pb-2 pr-3">Band</th>
                <th className="pb-2">Revenue at Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {stpis.slice(0, 20).map((r, i) => {
                const combined = (r.s_factor_saidi ?? 0) + (r.s_factor_saifi ?? 0)
                return (
                  <tr key={i} className="text-gray-700 dark:text-gray-300">
                    <td className="py-1.5 pr-3">{r.dnsp}</td>
                    <td className="py-1.5 pr-3">{r.period_year}</td>
                    <td className="py-1.5 pr-3">{r.saidi_actual?.toFixed(1)}</td>
                    <td className="py-1.5 pr-3">{r.saidi_target?.toFixed(1)}</td>
                    <td className="py-1.5 pr-3">{r.saifi_actual?.toFixed(3)}</td>
                    <td className="py-1.5 pr-3">{r.saifi_target?.toFixed(3)}</td>
                    <td className="py-1.5 pr-3 font-mono">{combined.toFixed(4)}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${BAND_COLORS[r.performance_band] ?? ''}`}>{r.performance_band}</span>
                    </td>
                    <td className="py-1.5">${((r.revenue_at_risk_aud ?? 0) / 1e6).toFixed(2)}M</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
