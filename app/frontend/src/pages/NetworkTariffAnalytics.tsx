// Phase 5B — Network Tariff Analytics
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { DollarSign, Users, TrendingUp, BarChart2, type LucideIcon } from 'lucide-react'
import {
  api, TariffStructure, TariffMigrationRecord, TariffRevenueByClass,
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

const MIGRATION_COLORS = { flat_rate_pct: '#6B7280', tou_pct: '#3B82F6', demand_pct: '#10B981', inclining_block_pct: '#8B5CF6' }

export default function NetworkTariffAnalytics() {
  const [summary, setSummary] = useState<Record<string, number | string>>({})
  const [structures, setStructures] = useState<TariffStructure[]>([])
  const [migration, setMigration] = useState<TariffMigrationRecord[]>([])
  const [revenueByClass, setRevenueByClass] = useState<TariffRevenueByClass[]>([])
  const [loading, setLoading] = useState(true)
  const [dnspFilter, setDnspFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getTariffSummary(),
      api.getTariffStructures(dnspFilter ? { dnsp: dnspFilter } : {}),
      api.getTariffMigration(dnspFilter ? { dnsp: dnspFilter } : {}),
      api.getTariffRevenueByClass(),
    ]).then(([s, st, m, r]) => {
      setSummary(s as Record<string, number | string>)
      setStructures(st.structures)
      setMigration(m.migration)
      setRevenueByClass(r.revenue)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [dnspFilter])

  // Build migration chart data (latest year, residential)
  const migrationChartData = migration
    .filter(m => m.customer_class === 'residential')
    .map(m => {
      const { dnsp: _d, ...rest } = m
      return { ...rest, label: `${_d.split(' ')[0]} ${m.period_year}` }
    })
    .sort((a, b) => a.period_year - b.period_year)

  // Revenue by class chart
  const revenueChartData = revenueByClass
    .filter(r => r.period_year === Math.max(...revenueByClass.map(x => x.period_year), 0))
    .map(r => ({
      name: `${r.dnsp.split(' ')[0]} ${r.customer_class}`,
      revenue: r.actual_revenue_m_aud,
      cost: r.allocated_cost_m_aud,
    }))

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading tariff data...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Network Tariff Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Tariff structures, migration to cost-reflective tariffs, and revenue by customer class</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={dnspFilter} onChange={e => setDnspFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            <option value="">All DNSPs</option>
            <option value="AusNet Services">AusNet Services</option>
            <option value="Ergon Energy">Ergon Energy</option>
            <option value="Energex">Energex</option>
          </select>
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Tariff Structures" value={String(summary.total_tariffs ?? 0)} sub="Active tariffs" Icon={BarChart2} color="bg-blue-500" />
        <KpiCard label="DNSPs" value={String(summary.dnsp_count ?? 0)} sub="In scope" Icon={Users} color="bg-purple-500" />
        <KpiCard label="Avg Cost-Reflective %" value={`${summary.avg_cost_reflective_pct ?? 0}%`} sub="Residential TOU+Demand" Icon={TrendingUp} color="bg-green-500" />
        <KpiCard label="AER Target" value={`${summary.avg_aer_target_pct ?? 65}%`} sub="Residential by 2026" Icon={DollarSign} color="bg-orange-500" />
      </div>

      {/* Migration stacked bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Residential Tariff Migration Progress (% of customers)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={migrationChartData} margin={{ bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9CA3AF' }} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit="%" />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Bar dataKey="flat_rate_pct" stackId="a" fill={MIGRATION_COLORS.flat_rate_pct} name="Flat Rate %" />
            <Bar dataKey="tou_pct" stackId="a" fill={MIGRATION_COLORS.tou_pct} name="TOU %" />
            <Bar dataKey="demand_pct" stackId="a" fill={MIGRATION_COLORS.demand_pct} name="Demand %" />
            <Bar dataKey="inclining_block_pct" stackId="a" fill={MIGRATION_COLORS.inclining_block_pct} name="Inclining Block %" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue by class */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Revenue vs Allocated Cost by Customer Class ($M, latest year)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={revenueChartData} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" M" />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Bar dataKey="revenue" fill="#3B82F6" name="Actual Revenue ($M)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="cost" fill="#EF4444" name="Allocated Cost ($M)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tariff structures cards */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Tariff Structures ({structures.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-3">DNSP</th>
                <th className="pb-2 pr-3">Tariff Name</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">Class</th>
                <th className="pb-2 pr-3">Fixed $/day</th>
                <th className="pb-2 pr-3">Energy $/kWh</th>
                <th className="pb-2">Demand $/kW</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {structures.slice(0, 20).map((s, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-3">{s.dnsp}</td>
                  <td className="py-1.5 pr-3 font-medium">{s.tariff_name}</td>
                  <td className="py-1.5 pr-3">{s.tariff_type}</td>
                  <td className="py-1.5 pr-3">{s.customer_class}</td>
                  <td className="py-1.5 pr-3 font-mono">{s.fixed_charge_aud_day?.toFixed(4)}</td>
                  <td className="py-1.5 pr-3 font-mono">{s.energy_charge_aud_kwh?.toFixed(5)}</td>
                  <td className="py-1.5 font-mono">{s.demand_charge_aud_kw > 0 ? s.demand_charge_aud_kw?.toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
