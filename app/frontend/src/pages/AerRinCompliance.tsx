// Phase 5B — AER Regulatory Information Notice (RIN) Compliance
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { FileText, AlertTriangle, DollarSign, CheckCircle, type LucideIcon } from 'lucide-react'
import {
  api, AerRinRecord, StpisRecord, RevenueMonitoringRecord,
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

export default function AerRinCompliance() {
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [rins, setRins] = useState<AerRinRecord[]>([])
  const [stpis, setStpis] = useState<StpisRecord[]>([])
  const [revenue, setRevenue] = useState<RevenueMonitoringRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dnsFilter, setDnsFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getAerSummary(),
      api.getAerRin(dnsFilter ? { dnsp: dnsFilter } : {}),
      api.getAerStpis(dnsFilter ? { dnsp: dnsFilter } : {}),
      api.getAerRevenue(dnsFilter ? { dnsp: dnsFilter } : {}),
    ]).then(([s, r, sp, rev]) => {
      setSummary(s as Record<string, number>)
      setRins(r.submissions)
      setStpis(sp.stpis)
      setRevenue(rev.revenue)
      setLoading(false)
    }).catch(e => { setError(String(e)); setLoading(false) })
  }, [dnsFilter])

  const revenueChartData = revenue.slice(0, 12).map(r => ({
    month: r.period_start?.slice(0, 7) ?? '',
    allowed: r.allowed_revenue_m_aud,
    actual: r.actual_revenue_m_aud,
    variance: r.variance_m_aud,
  })).reverse()

  const stpisChartData = stpis.map(r => ({
    name: `${r.dnsp.split(' ')[0]} ${r.period_year}`,
    saidi_actual: r.saidi_actual,
    saidi_target: r.saidi_target,
    band: r.performance_band,
    risk: r.revenue_at_risk_aud / 1e6,
  }))

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading AER RIN data...</div>
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">AER RIN Compliance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Regulatory Information Notice submissions, STPIS performance & revenue cap monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dnsFilter}
            onChange={e => setDnsFilter(e.target.value)}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total RINs Submitted" value={String(summary.total_rins ?? 0)} sub="All years" Icon={FileText} color="bg-blue-500" />
        <KpiCard label="AER Accepted" value={String(summary.accepted_rins ?? 0)} sub={`${((summary.accepted_rins ?? 0) / Math.max(summary.total_rins ?? 1, 1) * 100).toFixed(0)}% acceptance rate`} Icon={CheckCircle} color="bg-green-500" />
        <KpiCard label="STPIS Revenue at Risk" value={`$${((summary.total_revenue_at_risk_aud ?? 0) / 1e6).toFixed(1)}M`} sub="Combined DNSPs" Icon={DollarSign} color="bg-orange-500" />
        <KpiCard label="YTD Revenue Variance" value={`$${(summary.ytd_revenue_variance_m ?? 0).toFixed(1)}M`} sub="Allowed vs actual" Icon={AlertTriangle} color={((summary.ytd_revenue_variance_m ?? 0) > 0 ? 'bg-red-500' : 'bg-green-500')} />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Revenue Cap Monitoring — Allowed vs Actual ($M/month)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={revenueChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" M" />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Line type="monotone" dataKey="allowed" stroke="#3B82F6" name="Allowed Revenue ($M)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="actual" stroke="#10B981" name="Actual Revenue ($M)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* STPIS Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">STPIS — SAIDI Actual vs Target & Revenue at Risk ($M)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stpisChartData} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} angle={-35} textAnchor="end" interval={0} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" min" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" $M" />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Bar yAxisId="left" dataKey="saidi_actual" fill="#3B82F6" name="SAIDI Actual (min)" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="saidi_target" fill="#6B7280" name="SAIDI Target (min)" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="right" dataKey="risk" fill="#EF4444" name="Revenue at Risk ($M)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* RIN Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">RIN Submissions ({rins.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">RIN ID</th>
                <th className="pb-2 pr-4">DNSP</th>
                <th className="pb-2 pr-4">Year</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">Value</th>
                <th className="pb-2 pr-4">Unit</th>
                <th className="pb-2 pr-4">Submitted</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {rins.slice(0, 20).map((r, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4 font-mono">{r.rin_id}</td>
                  <td className="py-1.5 pr-4">{r.dnsp}</td>
                  <td className="py-1.5 pr-4">{r.submission_year}</td>
                  <td className="py-1.5 pr-4">{r.category}</td>
                  <td className="py-1.5 pr-4">{r.data_value?.toFixed(2)}</td>
                  <td className="py-1.5 pr-4">{r.unit}</td>
                  <td className="py-1.5 pr-4">{r.submission_date?.slice(0, 10)}</td>
                  <td className="py-1.5">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${r.aer_accepted ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                      {r.aer_accepted ? 'Accepted' : 'Queried'}
                    </span>
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
