import { useState, useCallback, useEffect } from 'react'
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import type { Alert, AlertCreateRequest } from '../api/client'

// ---------------------------------------------------------------------------
// Mock data — shown when real API is unavailable
// ---------------------------------------------------------------------------

const MOCK_ALERTS: Alert[] = [
  {
    id: 'mock-1',
    region: 'SA1',
    metric: 'PRICE_THRESHOLD',
    threshold: 5000,
    status: 'triggered',
    triggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    notificationChannel: 'EMAIL',
  },
  {
    id: 'mock-2',
    region: 'NSW1',
    metric: 'DEMAND_SURGE',
    threshold: 12000,
    status: 'active',
    triggeredAt: '',
    isActive: true,
    notificationChannel: 'SLACK',
  },
  {
    id: 'mock-3',
    region: 'VIC1',
    metric: 'PRICE_THRESHOLD',
    threshold: 300,
    status: 'resolved',
    triggeredAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    isActive: false,
    notificationChannel: 'IN_APP',
  },
]

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NEM_REGIONS = ['NSW1', 'QLD1', 'SA1', 'TAS1', 'VIC1'] as const
type NemRegion = (typeof NEM_REGIONS)[number]

const ALERT_TYPES = [
  'PRICE_THRESHOLD',
  'DEMAND_SURGE',
  'FCAS_PRICE',
  'FORECAST_SPIKE',
] as const
type AlertTypeKey = (typeof ALERT_TYPES)[number]

const NOTIFICATION_CHANNELS = ['EMAIL', 'SLACK', 'IN_APP'] as const
type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

// ---------------------------------------------------------------------------
// Severity coding — threshold-based for PRICE_THRESHOLD alerts
// ---------------------------------------------------------------------------

function getSeverity(alert: Alert): 'critical' | 'high' | 'medium' | 'low' {
  if (alert.metric === 'PRICE_THRESHOLD') {
    if (alert.threshold >= 5000) return 'critical'
    if (alert.threshold >= 300) return 'high'
    if (alert.threshold >= 100) return 'medium'
    return 'low'
  }
  if (alert.metric === 'DEMAND_SURGE') return 'high'
  if (alert.metric === 'FCAS_PRICE') return 'medium'
  return 'low'
}

const SEVERITY_COLORS: Record<ReturnType<typeof getSeverity>, string> = {
  critical: 'border-l-4 border-red-500',
  high:     'border-l-4 border-orange-400',
  medium:   'border-l-4 border-yellow-400',
  low:      'border-l-4 border-gray-300',
}

const SEVERITY_BADGE: Record<ReturnType<typeof getSeverity>, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-gray-100 text-gray-500',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
  const { color, icon } = cfg[status] ?? {
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: null,
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}
    >
      {icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Toggle switch (optimistic UI — PATCH /api/alerts/:id TODO)
// ---------------------------------------------------------------------------

interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-blue-600' : 'bg-gray-200',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Alert row
// ---------------------------------------------------------------------------

interface AlertRowProps {
  alert: Alert
  onDelete: (id: string) => void
  onToggle: (id: string, next: boolean) => void
}

function AlertRow({ alert, onDelete, onToggle }: AlertRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const severity = getSeverity(alert)
  const triggeredDate = alert.triggeredAt
    ? new Date(alert.triggeredAt).toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  const unit =
    alert.metric === 'PRICE_THRESHOLD' || alert.metric === 'FCAS_PRICE'
      ? '$/MWh'
      : 'MW'

  if (confirmDelete) {
    return (
      <tr className="bg-red-50">
        <td colSpan={7} className="px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-red-700">
            <Trash2 size={14} className="shrink-0" />
            <span>
              Delete alert for <strong>{alert.region}</strong> — {alert.metric}?
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => onDelete(alert.id)}
                className="px-3 py-1 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1 rounded bg-white text-gray-600 border border-gray-200 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`hover:bg-gray-50 transition-colors ${SEVERITY_COLORS[severity]}`}>
      <td className="px-4 py-3">
        <span
          className={`text-xs font-semibold px-1.5 py-0.5 rounded uppercase ${SEVERITY_BADGE[severity]}`}
        >
          {severity}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-gray-800">{alert.region}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{alert.metric}</td>
      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
        {alert.threshold.toLocaleString()} {unit}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={alert.status} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{triggeredDate}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          {/* TODO: wire to PATCH /api/alerts/:id when backend endpoint is available */}
          <Toggle
            checked={alert.isActive ?? true}
            onChange={next => onToggle(alert.id, next)}
          />
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete alert"
            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center text-center px-6">
      <Bell size={48} className="text-gray-200 mb-4" />
      <h3 className="text-base font-semibold text-gray-700 mb-1">No alerts yet</h3>
      <p className="text-sm text-gray-400 max-w-xs mb-6">
        Create your first alert to get notified when NEM prices or demand cross your thresholds.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <Plus size={15} />
        Create Alert
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create Alert modal
// ---------------------------------------------------------------------------

interface CreateAlertModalProps {
  onClose: () => void
  onCreated: (alert: Alert) => void
}

function CreateAlertModal({ onClose, onCreated }: CreateAlertModalProps) {
  const [region, setRegion]           = useState<NemRegion>('NSW1')
  const [alertType, setAlertType]     = useState<AlertTypeKey>('PRICE_THRESHOLD')
  const [threshold, setThreshold]     = useState('')
  const [channel, setChannel]         = useState<NotificationChannel>('IN_APP')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const unit = alertType === 'PRICE_THRESHOLD' || alertType === 'FCAS_PRICE'
    ? '$/MWh'
    : 'MW'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const thresholdNum = parseFloat(threshold)
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      setError('Please enter a valid positive threshold value.')
      return
    }

    setSubmitting(true)
    setError(null)

    const payload: AlertCreateRequest = {
      region_id: region,
      alert_type: alertType,
      threshold_value: thresholdNum,
      notification_channel: channel,
    }

    try {
      const created = await api.createAlert(payload)
      onCreated(created)
    } catch (err) {
      // Fallback: create a local mock alert so the UI still responds
      const mockCreated: Alert = {
        id: `local-${Date.now()}`,
        region,
        metric: alertType,
        threshold: thresholdNum,
        status: 'active',
        triggeredAt: '',
        isActive: true,
        notificationChannel: channel,
      }
      onCreated(mockCreated)
      console.warn('POST /api/alerts failed, using local mock:', (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Bell size={16} className="text-blue-500" />
            Create Alert
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={e => { void handleSubmit(e) }} className="px-5 py-5 space-y-4">
          {/* Region */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Region
            </label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value as NemRegion)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {NEM_REGIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Alert type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Alert Type
            </label>
            <select
              value={alertType}
              onChange={e => setAlertType(e.target.value as AlertTypeKey)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {ALERT_TYPES.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Threshold */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
                placeholder={alertType === 'PRICE_THRESHOLD' ? '300' : '12000'}
                required
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-sm text-gray-500 font-mono shrink-0">{unit}</span>
            </div>
          </div>

          {/* Notification channel */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Notification Channel
            </label>
            <div className="flex items-center gap-4">
              {NOTIFICATION_CHANNELS.map(ch => (
                <label key={ch} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    value={ch}
                    checked={channel === ch}
                    onChange={() => setChannel(ch)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">{ch.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating…' : 'Create Alert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Alerts page
// ---------------------------------------------------------------------------

export default function Alerts() {
  const [alerts, setAlerts]         = useState<Alert[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showModal, setShowModal]   = useState(false)

  // Load alerts from real API, fall back to mock data
  const loadAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getAlerts()
      setAlerts(data)
    } catch (err) {
      // Fall back to mock data so the UI is never blank
      setAlerts(MOCK_ALERTS)
      setError(`API unavailable — showing mock data. (${(err as Error).message})`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAlerts()
  }, [loadAlerts])

  const handleDelete = useCallback(async (id: string) => {
    // Optimistic remove
    setAlerts(prev => prev.filter(a => a.id !== id))
    try {
      await api.deleteAlert(id)
    } catch {
      // If real delete fails, re-fetch to reconcile
      void loadAlerts()
    }
  }, [loadAlerts])

  const handleToggle = useCallback((id: string, next: boolean) => {
    // TODO: wire to PATCH /api/alerts/:id when backend endpoint is available
    setAlerts(prev =>
      prev.map(a => a.id === id ? { ...a, isActive: next } : a)
    )
  }, [])

  const handleCreated = useCallback((alert: Alert) => {
    setAlerts(prev => [alert, ...prev])
    setShowModal(false)
  }, [])

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
            Price threshold, demand surge, FCAS, and predictive spike alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw size={16} className="text-gray-400 animate-spin" />}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} />
            Add Alert
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          {error}
        </div>
      )}

      {/* Stats */}
      {!loading && alerts.length > 0 && <AlertStats alerts={alerts} />}

      {/* Alerts table */}
      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">All Alerts</h3>
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
          <EmptyState onAdd={() => setShowModal(true)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left">Severity</th>
                  <th className="px-4 py-2 text-left">Region</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Threshold</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Triggered (AEST)</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alerts.map(alert => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    onDelete={id => { void handleDelete(id) }}
                    onToggle={handleToggle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Alert type info cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Price Threshold',
            desc: '>$100 (medium), >$300 (high), >$5,000/MWh (critical) per region',
            color: 'border-red-200 bg-red-50',
          },
          {
            label: 'Demand Surge',
            desc: 'Rapid demand increase above forecast',
            color: 'border-orange-200 bg-orange-50',
          },
          {
            label: 'FCAS Price',
            desc: 'Frequency regulation market price spikes',
            color: 'border-blue-200 bg-blue-50',
          },
          {
            label: 'Forecast Spike',
            desc: 'ML model predicts >70% probability of price spike',
            color: 'border-purple-200 bg-purple-50',
          },
        ].map(item => (
          <div key={item.label} className={`rounded-lg border p-3 ${item.color}`}>
            <div className="text-xs font-semibold text-gray-700">{item.label}</div>
            <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
          </div>
        ))}
      </section>

      {/* Create Alert modal */}
      {showModal && (
        <CreateAlertModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
