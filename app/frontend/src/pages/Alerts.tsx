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
  History,
  Send,
} from 'lucide-react'
import { api } from '../api/client'
import type { Alert, AlertCreateRequest, AlertTriggerEvent, AlertStats } from '../api/client'

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
// Stats bar — fetched from /api/alerts/stats
// ---------------------------------------------------------------------------

function AlertStatsBar({ stats, loading }: { stats: AlertStats | null; loading: boolean }) {
  const cards = [
    {
      label: 'Total Active Alerts',
      value: stats?.total_alerts ?? '—',
      color: 'bg-blue-50 border-blue-100 text-blue-600',
    },
    {
      label: 'Triggered (24h)',
      value: stats?.triggered_last_24h ?? '—',
      color: 'bg-red-50 border-red-100 text-red-600',
    },
    {
      label: 'Notifications Sent',
      value: stats?.notifications_sent ?? '—',
      color: 'bg-green-50 border-green-100 text-green-600',
    },
    {
      label: 'Most Active Region',
      value: stats?.most_triggered_region ?? '—',
      color: 'bg-amber-50 border-amber-100 text-amber-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className={`border rounded-lg p-4 text-center ${card.color}`}>
          {loading ? (
            <div className="h-7 bg-current opacity-10 rounded animate-pulse mb-1" />
          ) : (
            <div className="text-2xl font-bold">{card.value}</div>
          )}
          <div className="text-xs mt-0.5 opacity-70">{card.label}</div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alert history table
// ---------------------------------------------------------------------------

const HISTORY_REGIONS = ['All', 'NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'] as const
const HISTORY_TIME_OPTIONS = [
  { label: 'Last 24h', value: 24 },
  { label: 'Last 48h', value: 48 },
  { label: 'Last 7d',  value: 168 },
] as const

function AlertHistoryTab() {
  const [region, setRegion]         = useState<string>('All')
  const [hoursBack, setHoursBack]   = useState<number>(24)
  const [events, setEvents]         = useState<AlertTriggerEvent[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getAlertHistory(
        region === 'All' ? undefined : region,
        hoursBack,
      )
      setEvents(data)
    } catch (err) {
      setError(`Could not load alert history. (${(err as Error).message})`)
    } finally {
      setLoading(false)
    }
  }, [region, hoursBack])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600">Region</label>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {HISTORY_REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600">Time Range</label>
          <select
            value={hoursBack}
            onChange={e => setHoursBack(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {HISTORY_TIME_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => void loadHistory()}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left">Time (UTC)</th>
              <th className="px-4 py-2 text-left">Region</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-right">Threshold</th>
              <th className="px-4 py-2 text-right">Actual Value</th>
              <th className="px-4 py-2 text-center">Notification</th>
              <th className="px-4 py-2 text-left">Channel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 3 }, (_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }, (__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No trigger events found for the selected filters.
                </td>
              </tr>
            ) : (
              events.map(evt => (
                <tr key={evt.event_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                    {new Date(evt.triggered_at).toLocaleString('en-AU', {
                      timeZone: 'Australia/Sydney',
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{evt.region}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {evt.alert_type.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">
                    {evt.threshold.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800">
                    {evt.actual_value.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {evt.notification_sent ? (
                      <CheckCircle size={16} className="inline text-green-500" />
                    ) : (
                      <X size={16} className="inline text-red-400" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase">
                      {evt.channel}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
// Test Notification inline form
// ---------------------------------------------------------------------------

type TestChannel = 'slack' | 'email' | 'webhook'

interface TestNotificationFormProps {
  onClose: () => void
}

function TestNotificationForm({ onClose }: TestNotificationFormProps) {
  const [channel, setChannel]     = useState<TestChannel>('slack')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [sending, setSending]     = useState(false)
  const [toast, setToast]         = useState<{ success: boolean; message: string } | null>(null)

  const handleTest = async () => {
    setSending(true)
    setToast(null)
    try {
      const result = await api.testNotification(channel, webhookUrl || undefined)
      setToast({ success: result.success, message: result.message })
    } catch (err) {
      setToast({ success: false, message: (err as Error).message })
    } finally {
      setSending(false)
      // Auto-dismiss toast after 3s
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div className="mt-4 border border-blue-200 rounded-lg bg-blue-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
          <Send size={14} />
          Test Notification
        </span>
        <button
          onClick={onClose}
          className="p-0.5 rounded text-blue-400 hover:text-blue-600 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-blue-700">Channel</label>
          <select
            value={channel}
            onChange={e => setChannel(e.target.value as TestChannel)}
            className="border border-blue-200 rounded px-2 py-1 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="slack">Slack</option>
            <option value="email">Email</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>
        {(channel === 'slack' || channel === 'webhook') && (
          <input
            type="url"
            placeholder="Webhook URL (optional in mock mode)"
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            className="flex-1 min-w-[200px] border border-blue-200 rounded px-2 py-1 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        )}
        <button
          onClick={() => { void handleTest() }}
          disabled={sending}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {sending ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
          {sending ? 'Sending…' : 'Send Test'}
        </button>
      </div>

      {toast && (
        <div
          className={`text-xs rounded px-3 py-2 transition-opacity ${
            toast.success
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}
        >
          {toast.success ? 'Sent: ' : 'Failed: '}{toast.message}
        </div>
      )}
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
  const [showTestForm, setShowTestForm] = useState(false)

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

        <div className="px-5 py-5 space-y-4">
          <form onSubmit={e => { void handleSubmit(e) }} className="space-y-4">
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

            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={() => setShowTestForm(v => !v)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Send size={12} />
                {showTestForm ? 'Hide test form' : 'Test notification'}
              </button>
              <div className="flex gap-2">
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
            </div>
          </form>

          {showTestForm && (
            <TestNotificationForm onClose={() => setShowTestForm(false)} />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Alerts page
// ---------------------------------------------------------------------------

type ActiveTab = 'active' | 'history'

export default function Alerts() {
  const [alerts, setAlerts]         = useState<Alert[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showModal, setShowModal]   = useState(false)
  const [activeTab, setActiveTab]   = useState<ActiveTab>('active')
  const [stats, setStats]           = useState<AlertStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

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

  // Load stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await api.getAlertStats()
      setStats(data)
    } catch {
      // Stats are non-critical; silently fail
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAlerts()
    void loadStats()
  }, [loadAlerts, loadStats])

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

      {/* Stats bar — fetched from /api/alerts/stats */}
      <AlertStatsBar stats={stats} loading={statsLoading} />

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('active')}
          className={[
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'active'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ].join(' ')}
        >
          <Bell size={14} />
          Active Alerts
          {alerts.length > 0 && (
            <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
              {alerts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={[
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ].join(' ')}
        >
          <History size={14} />
          Alert History
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'active' ? (
        <>
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
        </>
      ) : (
        <AlertHistoryTab />
      )}

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
