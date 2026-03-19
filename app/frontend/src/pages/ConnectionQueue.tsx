// Phase 5B — Connection Queue
import { useEffect, useState } from 'react'
import { Users, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { api, ConnectionApplication } from '../api/client'

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  'Under Assessment': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'Offer Issued': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  Accepted: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  Rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

export default function ConnectionQueue() {
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [apps, setApps] = useState<ConnectionApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [dnspFilter, setDnspFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getConnectionsSummary(),
      api.getConnectionQueue({
        ...(dnspFilter ? { dnsp: dnspFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(typeFilter ? { application_type: typeFilter } : {}),
      }),
    ]).then(([s, q]) => {
      setSummary(s as Record<string, number>)
      setApps(q.applications)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [dnspFilter, statusFilter, typeFilter])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Connection Queue</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">NER connection application queue with deadline tracking and compliance KPIs</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic data</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Applications', value: String(summary.total_applications ?? 0), sub: 'All DNSPs', Icon: Users, color: 'bg-blue-500' },
          { label: 'Pending / In Assessment', value: String(summary.pending_applications ?? 0), sub: 'Awaiting offer', Icon: Clock, color: 'bg-yellow-500' },
          { label: 'NER Compliant', value: String(summary.ner_compliant ?? 0), sub: 'Within NER timeframe', Icon: CheckCircle, color: 'bg-green-500' },
          { label: 'NER Compliance Rate', value: `${(summary.ner_compliance_rate_pct ?? 0).toFixed(1)}%`, sub: 'Regulatory target: >95%', Icon: AlertTriangle, color: (summary.ner_compliance_rate_pct ?? 0) >= 95 ? 'bg-green-500' : 'bg-orange-500' },
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

      <div className="flex flex-wrap items-center gap-3">
        <select value={dnspFilter} onChange={e => setDnspFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All DNSPs</option>
          <option value="AusNet Services">AusNet Services</option>
          <option value="Ergon Energy">Ergon Energy</option>
          <option value="Energex">Energex</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Status</option>
          {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Types</option>
          <option value="Standard Connection">Standard Connection</option>
          <option value="Large Customer">Large Customer</option>
          <option value="EV Charger">EV Charger</option>
          <option value="Solar Export">Solar Export</option>
          <option value="Battery Storage">Battery Storage</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Applications ({apps.length})</h2>
        {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 pr-3">App ID</th>
                  <th className="pb-2 pr-3">DNSP</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Capacity (kW)</th>
                  <th className="pb-2 pr-3">Applied</th>
                  <th className="pb-2 pr-3">NER Deadline</th>
                  <th className="pb-2 pr-3">Days Left</th>
                  <th className="pb-2 pr-3">NER</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {apps.slice(0, 50).map((a, i) => {
                  const daysLeft = a.days_to_ner_deadline ?? 0
                  const isUrgent = daysLeft >= 0 && daysLeft <= 14 && a.status !== 'Accepted' && a.status !== 'Rejected'
                  return (
                    <tr key={i} className={`text-gray-700 dark:text-gray-300 ${isUrgent ? 'bg-orange-50 dark:bg-orange-900/10' : ''} ${!a.ner_compliant ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                      <td className="py-1.5 pr-3 font-mono">{a.application_id}</td>
                      <td className="py-1.5 pr-3">{a.dnsp}</td>
                      <td className="py-1.5 pr-3">{a.application_type}</td>
                      <td className="py-1.5 pr-3">{a.capacity_kw?.toLocaleString()}</td>
                      <td className="py-1.5 pr-3 font-mono">{a.application_date?.slice(0, 10)}</td>
                      <td className="py-1.5 pr-3 font-mono">{a.ner_deadline_date?.slice(0, 10)}</td>
                      <td className={`py-1.5 pr-3 font-mono ${daysLeft < 0 ? 'text-red-600 dark:text-red-400' : daysLeft <= 14 ? 'text-orange-500 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>{daysLeft < 0 ? `${daysLeft}d` : `+${daysLeft}d`}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${a.ner_compliant ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{a.ner_compliant ? '✓' : '✗'}</span>
                      </td>
                      <td className="py-1.5">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[a.status] ?? ''}`}>{a.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
