import { useAlerts } from '../hooks/useMarketData'
import type { Alert } from '../api/client'
import { Bell, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; icon: React.ReactNode }> = {
    triggered: {
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: <AlertTriangle size={12} />,
    },
    active: {
      color: 'bg-amber-100 text-amber-700 border-amber-200',
      icon: <Clock size={12} />,
    },
    resolved: {
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: <CheckCircle size={12} />,
    },
  }
  const { color, icon } = cfg[status] ?? { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: null }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function AlertRow({ alert }: { alert: Alert }) {
  const triggeredDate = alert.triggeredAt
    ? new Date(alert.triggeredAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })
    : '—'

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-gray-800">{alert.region}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{alert.metric}</td>
      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
        {alert.metric.toLowerCase().includes('price')
          ? `$${alert.threshold.toLocaleString()}/MWh`
          : `${alert.threshold.toLocaleString()} MW`}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={alert.status} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{triggeredDate}</td>
    </tr>
  )
}

// Placeholder: alert summary stats
function AlertStats({ alerts }: { alerts: Alert[] }) {
  const triggered = alerts.filter(a => a.status === 'triggered').length
  const active    = alerts.filter(a => a.status === 'active').length
  const resolved  = alerts.filter(a => a.status === 'resolved').length

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-red-600">{triggered}</div>
        <div className="text-xs text-red-500 mt-0.5">Triggered</div>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-amber-600">{active}</div>
        <div className="text-xs text-amber-500 mt-0.5">Active</div>
      </div>
      <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-green-600">{resolved}</div>
        <div className="text-xs text-green-500 mt-0.5">Resolved</div>
      </div>
    </div>
  )
}

export default function Alerts() {
  const { data: alerts, loading, error } = useAlerts()

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-gray-500" />
            <h2 className="text-xl font-bold text-gray-900">Alerts</h2>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Price threshold, demand surge, data staleness, and predictive spike alerts
          </p>
        </div>
        {loading && (
          <RefreshCw size={16} className="text-gray-400 animate-spin" />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load alerts: {error}
        </div>
      )}

      {/* Stats */}
      {!loading && alerts.length > 0 && <AlertStats alerts={alerts} />}

      {/* Alerts table */}
      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Active Alerts</h3>
          <span className="text-xs text-gray-400">{alerts.length} total</span>
        </div>

        {loading && alerts.length === 0 ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-12 px-4 flex items-center gap-4">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-16" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-24" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-20" />
                <div className="h-5 bg-gray-100 rounded-full animate-pulse w-20" />
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            No alerts configured. Alerts are managed via Databricks SQL.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left">Region</th>
                  <th className="px-4 py-2 text-left">Metric</th>
                  <th className="px-4 py-2 text-left">Threshold</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Triggered At (AEST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alerts.map(alert => (
                  <AlertRow key={alert.id} alert={alert} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Alert types info */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Price Threshold', desc: '>$300, >$1,000, >$5,000 /MWh per region', color: 'border-red-200 bg-red-50' },
          { label: 'Demand Surge',    desc: 'Rapid demand increase above forecast',    color: 'border-amber-200 bg-amber-50' },
          { label: 'Data Staleness',  desc: 'Dispatch data >10 min late',              color: 'border-blue-200 bg-blue-50' },
          { label: 'Model Drift',     desc: 'Forecast accuracy below threshold',       color: 'border-purple-200 bg-purple-50' },
        ].map(item => (
          <div key={item.label} className={`rounded-lg border p-3 ${item.color}`}>
            <div className="text-xs font-semibold text-gray-700">{item.label}</div>
            <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
          </div>
        ))}
      </section>
    </div>
  )
}
