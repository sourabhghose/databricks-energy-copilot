// Phase 5B — Timely Connections
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { CheckCircle, AlertTriangle, Zap } from 'lucide-react'
import { api, TimelyConnectionsKpi, LargeCustomerPipeline } from '../api/client'

const STAGE_STYLES: Record<string, string> = {
  'Feasibility': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'Under Assessment': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  'Offer Issued': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  'Accepted': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  'Rejected': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

export default function TimelyConnections() {
  const [kpis, setKpis] = useState<TimelyConnectionsKpi[]>([])
  const [pipeline, setPipeline] = useState<LargeCustomerPipeline[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getConnectionsCompliance(),
      api.getLargeCustomerPipeline(),
    ]).then(([k, p]) => {
      setKpis(k.kpis)
      setPipeline(p.pipeline)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const totalVolume = kpis.reduce((s, k) => s + k.total_applications, 0)
  const totalCompliant = kpis.reduce((s, k) => s + k.compliant_count, 0)
  const overallRate = totalVolume > 0 ? (totalCompliant / totalVolume) * 100 : 0
  const overdue = kpis.reduce((s, k) => s + (k.total_applications - k.compliant_count), 0)

  const chartData = kpis.map(k => ({
    type: k.application_type.replace(' Connection', '').replace(' Storage', ' Stor.'),
    total: k.total_applications,
    compliant: k.compliant_count,
    rate: Number(k.compliance_rate_pct.toFixed(1)),
  }))

  const totalCapacityMw = pipeline.reduce((s, p) => s + p.capacity_mw, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Timely Connections</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">NER connection timeframe compliance by application type and large customer pipeline</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic data</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Overall Compliance Rate', value: `${overallRate.toFixed(1)}%`, sub: 'NER target: >95%', Icon: CheckCircle, color: overallRate >= 95 ? 'bg-green-500' : 'bg-orange-500' },
          { label: 'NER Compliant', value: String(totalCompliant), sub: `of ${totalVolume} applications`, Icon: CheckCircle, color: 'bg-blue-500' },
          { label: 'Non-Compliant', value: String(overdue), sub: 'Exceeded NER timeframe', Icon: AlertTriangle, color: 'bg-red-500' },
          { label: 'Large Customer Pipeline', value: `${totalCapacityMw.toFixed(0)} MW`, sub: `${pipeline.length} projects`, Icon: Zap, color: 'bg-purple-500' },
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

      {/* NER compliance by type */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">NER Compliance by Application Type</h2>
        {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Applications: Compliant vs Total</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                  <YAxis dataKey="type" type="category" tick={{ fontSize: 10, fill: '#9CA3AF' }} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
                  <Bar dataKey="total" fill="#6B7280" name="Total" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="compliant" fill="#10B981" name="NER Compliant" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Compliance Rate % by Type</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }} unit="%" />
                  <YAxis dataKey="type" type="category" tick={{ fontSize: 10, fill: '#9CA3AF' }} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} formatter={(v: number) => [`${v}%`, 'Compliance Rate']} />
                  <Bar dataKey="rate" fill="#3B82F6" name="Compliance Rate (%)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* NER KPI Detail Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">NER Timeframe KPI by Type & DNSP</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-3">DNSP</th>
                <th className="pb-2 pr-3">Application Type</th>
                <th className="pb-2 pr-3">Total</th>
                <th className="pb-2 pr-3">Compliant</th>
                <th className="pb-2 pr-3">Avg Days</th>
                <th className="pb-2 pr-3">NER Limit</th>
                <th className="pb-2">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {kpis.map((k, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-3">{k.dnsp}</td>
                  <td className="py-1.5 pr-3">{k.application_type}</td>
                  <td className="py-1.5 pr-3">{k.total_applications}</td>
                  <td className="py-1.5 pr-3">{k.compliant_count}</td>
                  <td className="py-1.5 pr-3 font-mono">—</td>
                  <td className="py-1.5 pr-3 font-mono">{k.ner_threshold_days}d</td>
                  <td className="py-1.5">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${k.compliance_rate_pct >= 95 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : k.compliance_rate_pct >= 80 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{k.compliance_rate_pct.toFixed(1)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Large Customer Pipeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Large Customer Pipeline ({pipeline.length} projects — {totalCapacityMw.toFixed(0)} MW total)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-3">App ID</th>
                <th className="pb-2 pr-3">DNSP</th>
                <th className="pb-2 pr-3">Customer</th>
                <th className="pb-2 pr-3">Industry</th>
                <th className="pb-2 pr-3">Capacity (MW)</th>
                <th className="pb-2 pr-3">Zone Substation</th>
                <th className="pb-2 pr-3">Applied</th>
                <th className="pb-2 pr-3">Target Energisation</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {pipeline.slice(0, 20).map((p, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-3 font-mono">{p.application_id}</td>
                  <td className="py-1.5 pr-3">{p.dnsp}</td>
                  <td className="py-1.5 pr-3 max-w-[120px] truncate">{p.customer_name}</td>
                  <td className="py-1.5 pr-3">{p.industry}</td>
                  <td className="py-1.5 pr-3 font-mono">{p.capacity_mw?.toFixed(1)}</td>
                  <td className="py-1.5 pr-3 font-mono text-[10px]">{p.zone_substation}</td>
                  <td className="py-1.5 pr-3 font-mono">{p.application_date?.slice(0, 10)}</td>
                  <td className="py-1.5 pr-3 font-mono">{p.target_energisation_date?.slice(0, 10)}</td>
                  <td className="py-1.5">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STAGE_STYLES[p.assessment_status] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>{p.assessment_status}</span>
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
