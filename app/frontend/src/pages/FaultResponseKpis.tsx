// Phase 5B — Fault Response KPIs
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { Zap, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { api, FaultResponseKpi } from '../api/client'

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6']

export default function FaultResponseKpis() {
  const [kpis, setKpis] = useState<FaultResponseKpi[]>([])
  const [loading, setLoading] = useState(true)
  const [dnspFilter, setDnspFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    api.getFaultResponseKpis(dnspFilter ? { dnsp: dnspFilter } : {})
      .then(r => {
        setKpis(r.kpis)
        setLoading(false)
      }).catch(() => setLoading(false))
  }, [dnspFilter])

  const totalFaults = kpis.reduce((s, k) => s + k.total_faults, 0)
  const overallSlaRate = kpis.length > 0 ? kpis.reduce((s, k) => s + k.sla_compliance_pct, 0) / kpis.length : 0
  const totalSlaCompliant = Math.round(kpis.reduce((s, k) => s + k.total_faults * k.sla_compliance_pct / 100, 0))
  const avgResponse = kpis.length > 0 ? kpis.reduce((s, k) => s + k.avg_response_time_min, 0) / kpis.length : 0
  const avgRestoration = kpis.length > 0 ? kpis.reduce((s, k) => s + k.avg_restoration_time_min, 0) / kpis.length : 0

  // SLA donut data
  const slaDonutData = [
    { name: 'SLA Met', value: totalSlaCompliant },
    { name: 'SLA Breached', value: totalFaults - totalSlaCompliant },
  ]

  // Response time by fault type
  const faultTypes = [...new Set(kpis.map(k => k.fault_type))].filter(Boolean)
  const responseByType = faultTypes.map(ft => {
    const items = kpis.filter(k => k.fault_type === ft)
    return {
      type: ft,
      avgResponse: Math.round(items.reduce((s, k) => s + k.avg_response_time_min, 0) / items.length),
      avgRestoration: Math.round(items.reduce((s, k) => s + k.avg_restoration_time_min, 0) / items.length),
    }
  })

  // SLA compliance by DNSP
  const dnspNames = [...new Set(kpis.map(k => k.dnsp))].filter(Boolean)
  const slaByDnsp = dnspNames.map(d => {
    const items = kpis.filter(k => k.dnsp === d)
    return {
      dnsp: d.split(' ').slice(0, 2).join(' '),
      slaRate: items.length > 0 ? Math.round(items.reduce((s, k) => s + k.sla_compliance_pct, 0) / items.length * 10) / 10 : 0,
    }
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Fault Response KPIs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">SLA compliance tracking, average response and restoration times by fault type and region</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={dnspFilter} onChange={e => setDnspFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            <option value="">All DNSPs</option>
            <option value="AusNet Services">AusNet Services</option>
            <option value="Ergon Energy">Ergon Energy</option>
            <option value="Energex">Energex</option>
          </select>
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic data</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Fault Events', value: String(totalFaults), sub: 'Filtered period', Icon: Zap, color: 'bg-blue-500' },
          { label: 'SLA Compliance Rate', value: `${overallSlaRate.toFixed(1)}%`, sub: 'SLA met / total', Icon: CheckCircle, color: overallSlaRate >= 90 ? 'bg-green-500' : 'bg-orange-500' },
          { label: 'Avg Response Time', value: `${avgResponse.toFixed(0)} min`, sub: 'Dispatch to arrival', Icon: Clock, color: 'bg-yellow-500' },
          { label: 'Avg Restoration Time', value: `${avgRestoration.toFixed(0)} min`, sub: 'Fault to restoration', Icon: AlertTriangle, color: 'bg-red-500' },
        ].map((k, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
            <div className={`p-2.5 rounded-lg ${k.color}`}><k.Icon size={20} className="text-white" /></div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{k.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{k.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SLA Donut */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">SLA Compliance</h2>
          {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={slaDonutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {slaDonutData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} itemStyle={{ color: '#D1D5DB' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-xs mt-2">
                {slaDonutData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-gray-500 dark:text-gray-400">{d.name}: <strong className="text-gray-800 dark:text-gray-200">{d.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Response time by fault type */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Avg Response & Restoration by Fault Type (min)</h2>
          {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={responseByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" min" />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
                <Bar dataKey="avgResponse" fill="#F59E0B" name="Avg Response (min)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="avgRestoration" fill="#EF4444" name="Avg Restoration (min)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* SLA compliance by DNSP */}
      {slaByDnsp.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">SLA Compliance Rate by DNSP (%)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={slaByDnsp}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="dnsp" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} formatter={(v: number) => [`${v}%`, 'SLA Rate']} />
              <Bar dataKey="slaRate" fill="#10B981" name="SLA Compliance (%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detail table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">KPI Detail ({kpis.length} records)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-3">DNSP</th>
                <th className="pb-2 pr-3">Region</th>
                <th className="pb-2 pr-3">Fault Type</th>
                <th className="pb-2 pr-3">Total Faults</th>
                <th className="pb-2 pr-3">SLA Met</th>
                <th className="pb-2 pr-3">SLA Rate</th>
                <th className="pb-2 pr-3">Avg Response</th>
                <th className="pb-2 pr-3">SLA Target</th>
                <th className="pb-2">Avg Restoration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {kpis.slice(0, 40).map((k, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-3">{k.dnsp}</td>
                  <td className="py-1.5 pr-3">{k.region}</td>
                  <td className="py-1.5 pr-3">{k.fault_type}</td>
                  <td className="py-1.5 pr-3">{k.total_faults}</td>
                  <td className="py-1.5 pr-3">{Math.round(k.total_faults * k.sla_compliance_pct / 100)}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${k.sla_compliance_pct >= 90 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : k.sla_compliance_pct >= 75 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{k.sla_compliance_pct?.toFixed(1)}%</span>
                  </td>
                  <td className="py-1.5 pr-3 font-mono">{k.avg_response_time_min?.toFixed(0)} min</td>
                  <td className="py-1.5 pr-3 font-mono">{k.sla_target_min} min</td>
                  <td className="py-1.5 font-mono">{k.avg_restoration_time_min?.toFixed(0)} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
