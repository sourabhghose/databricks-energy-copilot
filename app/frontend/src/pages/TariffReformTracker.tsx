// Phase 5B — Tariff Reform Tracker
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { TrendingUp, Target, CheckCircle, AlertTriangle, type LucideIcon } from 'lucide-react'
import { api, TariffReformRecord, DemandTariffPerformance } from '../api/client'

const COLORS = ['#6B7280', '#3B82F6', '#10B981', '#8B5CF6']

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

export default function TariffReformTracker() {
  const [reform, setReform] = useState<TariffReformRecord[]>([])
  const [demandPerf, setDemandPerf] = useState<DemandTariffPerformance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getTariffReformTracker(),
      api.getTariffDemandPerformance(),
    ]).then(([r, d]) => {
      setReform(r.reform)
      setDemandPerf(d.performance)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const residential = reform.filter(r => r.customer_class === 'residential')
  const avgGap = residential.length > 0
    ? residential.reduce((s, r) => s + (r.gap_to_target_pct ?? (r.aer_target_cost_reflective_pct - r.current_cost_reflective_pct)), 0) / residential.length
    : 0
  const onTrack = residential.filter(r => (r.gap_to_target_pct ?? 0) <= 5).length

  // Donut data per DNSP
  const getDonutData = (dnsp: string) => {
    const r = reform.find(x => x.dnsp === dnsp && x.customer_class === 'residential')
    if (!r) return []
    return [
      { name: 'Flat Rate', value: r.flat_rate_pct },
      { name: 'TOU', value: r.tou_pct },
      { name: 'Demand', value: r.demand_pct },
      { name: 'Inclining Block', value: r.inclining_block_pct },
    ]
  }

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading reform data...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Tariff Reform Tracker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">AER cost-reflective tariff reform progress and demand tariff customer performance</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic data</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Reform Records" value={String(reform.length)} sub="DNSP × class" Icon={TrendingUp} color="bg-blue-500" />
        <KpiCard label="Avg Gap to Target" value={`${avgGap.toFixed(1)}%`} sub="Residential class" Icon={Target} color="bg-orange-500" />
        <KpiCard label="On Track (≤5% gap)" value={String(onTrack)} sub="DNSPs meeting target" Icon={CheckCircle} color="bg-green-500" />
        <KpiCard label="Demand Customers" value={String(demandPerf.length)} sub="Monitoring performance" Icon={AlertTriangle} color="bg-purple-500" />
      </div>

      {/* Donut charts per DNSP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {['AusNet Services', 'Ergon Energy', 'Energex'].map(dnsp => {
          const data = getDonutData(dnsp)
          const r = reform.find(x => x.dnsp === dnsp && x.customer_class === 'residential')
          const current = r?.current_cost_reflective_pct ?? 0
          const target = r?.aer_target_cost_reflective_pct ?? 65
          return (
            <div key={dnsp} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">{dnsp}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Residential — cost-reflective: {current.toFixed(1)}% (target: {target}%)</p>
              {data.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${(value as number).toFixed(0)}%`} labelLine={false}>
                      {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} itemStyle={{ color: '#D1D5DB' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-gray-400 text-center py-8">No data</p>}
            </div>
          )
        })}
      </div>

      {/* Reform progress bar chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Cost-Reflective Migration vs AER Target by Class</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={reform.filter(r => r.customer_class === 'residential')} margin={{ bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="dnsp" tickFormatter={v => v.split(' ')[0]} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit="%" />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Bar dataKey="current_cost_reflective_pct" fill="#3B82F6" name="Current Cost-Reflective %" radius={[3, 3, 0, 0]} />
            <Bar dataKey="aer_target_cost_reflective_pct" fill="#6B7280" name="AER Target %" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
