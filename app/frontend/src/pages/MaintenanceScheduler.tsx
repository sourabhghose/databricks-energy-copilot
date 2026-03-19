// Phase 5B — Maintenance Scheduler
import { useEffect, useState } from 'react'
import { Wrench, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { api, MaintenanceOrder } from '../api/client'

const PRIORITY_STYLES: Record<string, string> = {
  Emergency: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  Critical: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  High: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  Medium: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  Low: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
}

const STATUS_STYLES: Record<string, string> = {
  Open: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  'In Progress': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  Completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  Deferred: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  Cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
}

export default function MaintenanceScheduler() {
  const [orders, setOrders] = useState<MaintenanceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [priorityFilter, setPriorityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dnspFilter, setDnspFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    api.getMaintenanceOrders({
      ...(priorityFilter ? { priority: priorityFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(dnspFilter ? { dnsp: dnspFilter } : {}),
    }).then(r => {
      setOrders(r.orders)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [priorityFilter, statusFilter, dnspFilter])

  const emergency = orders.filter(o => o.priority === 'Emergency').length
  const critical = orders.filter(o => o.priority === 'Critical').length
  const inProgress = orders.filter(o => o.status === 'In Progress').length
  const completed = orders.filter(o => o.status === 'Completed').length
  const totalCost = orders.reduce((s, o) => s + (o.cost_aud ?? 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Maintenance Scheduler</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Work order register with priority triage, SLA tracking, and cost monitoring</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic data</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Emergency / Critical', value: String(emergency + critical), sub: `${emergency} emergency, ${critical} critical`, Icon: AlertTriangle, color: (emergency > 0 ? 'bg-red-500' : 'bg-orange-500') },
          { label: 'In Progress', value: String(inProgress), sub: 'Active work orders', Icon: Clock, color: 'bg-blue-500' },
          { label: 'Completed', value: String(completed), sub: `of ${orders.length} total`, Icon: CheckCircle, color: 'bg-green-500' },
          { label: 'Est. Total Cost', value: `$${(totalCost / 1000).toFixed(0)}K`, sub: 'Filtered orders', Icon: Wrench, color: 'bg-purple-500' },
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

      {emergency > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">⚠ {emergency} Emergency work order{emergency > 1 ? 's' : ''} requiring immediate dispatch</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select value={dnspFilter} onChange={e => setDnspFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All DNSPs</option>
          <option value="AusNet Services">AusNet Services</option>
          <option value="Ergon Energy">Ergon Energy</option>
          <option value="Energex">Energex</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Priorities</option>
          {Object.keys(PRIORITY_STYLES).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Status</option>
          {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Work Orders ({orders.length})</h2>
        {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 pr-3">Order ID</th>
                  <th className="pb-2 pr-3">DNSP</th>
                  <th className="pb-2 pr-3">Asset</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Priority</th>
                  <th className="pb-2 pr-3">Scheduled</th>
                  <th className="pb-2 pr-3">Completed</th>
                  <th className="pb-2 pr-3">Est. Cost</th>
                  <th className="pb-2 pr-3">Contractor</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {orders.slice(0, 50).map((o, i) => (
                  <tr key={i} className={`text-gray-700 dark:text-gray-300 ${o.priority === 'Emergency' ? 'bg-red-50 dark:bg-red-900/10' : o.priority === 'Critical' ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}>
                    <td className="py-1.5 pr-3 font-mono">{o.order_id}</td>
                    <td className="py-1.5 pr-3">{o.dnsp}</td>
                    <td className="py-1.5 pr-3 font-mono text-[10px]">{o.asset_id}</td>
                    <td className="py-1.5 pr-3">{o.order_type}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${PRIORITY_STYLES[o.priority] ?? ''}`}>{o.priority}</span>
                    </td>
                    <td className="py-1.5 pr-3 font-mono">{o.scheduled_date?.slice(0, 10)}</td>
                    <td className="py-1.5 pr-3 font-mono">{o.completed_date?.slice(0, 10) ?? '—'}</td>
                    <td className="py-1.5 pr-3">${((o.cost_aud ?? 0) / 1000).toFixed(1)}K</td>
                    <td className="py-1.5 pr-3 truncate max-w-[100px]">{o.contractor ?? '—'}</td>
                    <td className="py-1.5">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[o.status] ?? ''}`}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
