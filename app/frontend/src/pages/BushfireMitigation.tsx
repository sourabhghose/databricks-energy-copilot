// Phase 5B — Bushfire Mitigation Program Main Dashboard
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Flame, Shield, AlertTriangle, CheckCircle, type LucideIcon } from 'lucide-react'
import { api, BmpSpend, BushfireRiskZone } from '../api/client'

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

export default function BushfireMitigation() {
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [spend, setSpend] = useState<BmpSpend[]>([])
  const [zones, setZones] = useState<BushfireRiskZone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getBushfireSummary(),
      api.getBmpSpend({ dnsp: 'AusNet Services' }),
      api.getBushfireRiskZones(),
    ]).then(([s, sp, z]) => {
      setSummary(s as Record<string, number>)
      setSpend(sp.spend)
      setZones(z.zones)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const spendChartData = spend
    .filter(s => s.period_year === Math.max(...spend.map(x => x.period_year), 0))
    .map(s => ({
      category: s.category,
      allowance: s.approved_allowance_m_aud,
      actual: s.actual_spend_m_aud,
    }))

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading BMP data...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Bushfire Mitigation Program</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">AusNet Services VIC — BMP compliance, ELC inspections, BMP capex & BMO zone risk</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">AusNet Services — Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total BMP Assets" value={String(summary.total_assets ?? 0)} sub="BMO zone coverage" Icon={Shield} color="bg-blue-500" />
        <KpiCard label="High/Extreme Risk" value={String(summary.high_risk_assets ?? 0)} sub="Priority inspection" Icon={Flame} color="bg-red-500" />
        <KpiCard label="Asset Compliance" value={`${summary.asset_compliance_pct ?? 0}%`} sub="Clearance compliant" Icon={CheckCircle} color="bg-green-500" />
        <KpiCard label="Overdue Assets" value={String(summary.overdue_assets ?? 0)} sub="Action needed" Icon={AlertTriangle} color={summary.overdue_assets > 10 ? 'bg-red-500' : 'bg-orange-500'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">ELC Inspections (90d)</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.elc_inspections_90d ?? 0}</p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>ELC Compliance</span>
              <span>{summary.elc_compliance_pct ?? 0}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: `${summary.elc_compliance_pct ?? 0}%` }} />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Non-Compliant Spans</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.non_compliant_spans ?? 0}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Action pending clearance</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">BMP Spend vs Allowance</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${(summary.bmp_spend_m_aud ?? 0).toFixed(0)}M</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">of ${(summary.bmp_allowance_m_aud ?? 0).toFixed(0)}M allowance</p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
            <div
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${Math.min(100, (summary.bmp_spend_m_aud ?? 0) / Math.max(summary.bmp_allowance_m_aud ?? 1, 1) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Spend chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">BMP Capex: Actual vs AER Allowance by Category ($M)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={spendChartData} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="category" tick={{ fontSize: 9, fill: '#9CA3AF' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" M" />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Bar dataKey="allowance" fill="#6B7280" name="AER Allowance ($M)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="actual" fill="#3B82F6" name="Actual Spend ($M)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Zone risk table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">BMO Zone Risk Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">BMO Zone</th>
                <th className="pb-2 pr-4">Total Assets</th>
                <th className="pb-2 pr-4">Extreme</th>
                <th className="pb-2 pr-4">High</th>
                <th className="pb-2 pr-4">Overdue</th>
                <th className="pb-2">Compliance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {zones.map((z, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4 font-medium">{z.bmo_zone}</td>
                  <td className="py-1.5 pr-4">{z.total_assets}</td>
                  <td className="py-1.5 pr-4"><span className="px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px]">{z.extreme_count}</span></td>
                  <td className="py-1.5 pr-4"><span className="px-1 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-[10px]">{z.high_count}</span></td>
                  <td className="py-1.5 pr-4">{z.overdue_count}</td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${z.compliance_pct}%` }} />
                      </div>
                      <span>{z.compliance_pct?.toFixed(0)}%</span>
                    </div>
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
