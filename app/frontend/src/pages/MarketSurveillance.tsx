import { useState, useEffect } from 'react'
import { Shield, AlertTriangle, FileText, Users, TrendingUp, RefreshCw } from 'lucide-react'
import { api, SurveillanceDashboard, MarketSurveillanceNotice, ComplianceRecord, MarketAnomalyRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function fmtPenalty(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`
  return `$${val.toFixed(0)}`
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return d
  }
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    UNDER_INVESTIGATION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    REFERRED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    CLOSED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }
  const cls = map[status] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  const label = status.replace(/_/g, ' ')
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    LOW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  }
  const cls = map[priority] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{priority}</span>
}

function TypeBadge({ type }: { type: string }) {
  const label = type.replace(/_/g, ' ')
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
      {label}
    </span>
  )
}

function BreachBadge({ breach }: { breach: string }) {
  const map: Record<string, string> = {
    MINOR: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    MODERATE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    SERIOUS: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  const cls = map[breach] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{breach}</span>
}

function ComplianceStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ALLEGED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    PROVEN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    DISMISSED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }
  const cls = map[status] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>
}

function AnomalyTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    PRICE_SPIKE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    UNUSUAL_REBID: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    CONSTRAINT_MANIPULATION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    LOW_OFFER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  }
  const cls = map[type] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  const label = type.replace(/_/g, ' ')
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
  subtitle?: string
}

function KpiCard({ title, value, icon, color, subtitle }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Notices Table
// ---------------------------------------------------------------------------
const NOTICE_STATUSES = ['ALL', 'OPEN', 'UNDER_INVESTIGATION', 'REFERRED', 'CLOSED']
const NOTICE_PRIORITIES = ['ALL', 'HIGH', 'MEDIUM', 'LOW']

function NoticesTable({ notices }: { notices: MarketSurveillanceNotice[] }) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')

  const filtered = notices.filter(n => {
    const matchStatus = statusFilter === 'ALL' || n.status === statusFilter
    const matchPriority = priorityFilter === 'ALL' || n.priority === priorityFilter
    return matchStatus && matchPriority
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
              Surveillance Notices
            </h2>
            <span className="ml-1 text-xs text-gray-400">({filtered.length})</span>
          </div>
          <div className="flex gap-2 flex-wrap sm:ml-auto">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {NOTICE_STATUSES.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Priority:</span>
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {NOTICE_PRIORITIES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notice ID</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Region</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Participant</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">
                  No notices match current filters
                </td>
              </tr>
            ) : (
              filtered.map(n => (
                <tr key={n.notice_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">{n.notice_id}</td>
                  <td className="px-4 py-2.5"><TypeBadge type={n.notice_type} /></td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{n.region}</td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 max-w-[160px] truncate">{n.participant}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(n.trading_date)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={n.status} /></td>
                  <td className="px-4 py-2.5"><PriorityBadge priority={n.priority} /></td>
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
// Compliance Table
// ---------------------------------------------------------------------------
function ComplianceTable({ records }: { records: ComplianceRecord[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <Shield size={18} className="text-red-500" />
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Compliance Records</h2>
        <span className="ml-1 text-xs text-gray-400">({records.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Record ID</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Participant</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rule</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Breach</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Region</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Penalty</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">AER</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {records.map(rec => (
              <tr key={rec.record_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">{rec.record_id}</td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 max-w-[140px] truncate">{rec.participant}</td>
                <td className="px-4 py-2.5">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{rec.rule_reference}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[180px]">{rec.rule_description}</div>
                </td>
                <td className="px-4 py-2.5"><BreachBadge breach={rec.breach_type} /></td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{rec.region}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(rec.trading_date)}</td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                  {rec.penalty_aud > 0 ? (
                    <span className="text-red-600 dark:text-red-400">{fmtPenalty(rec.penalty_aud)}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5"><ComplianceStatusBadge status={rec.status} /></td>
                <td className="px-4 py-2.5 text-center">
                  {rec.referred_to_aer ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">AER</span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Anomaly Table
// ---------------------------------------------------------------------------
function AnomalyTable({ anomalies }: { anomalies: MarketAnomalyRecord[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <AlertTriangle size={18} className="text-amber-500" />
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Market Anomaly Detections</h2>
        <span className="ml-1 text-xs text-gray-400">({anomalies.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Anomaly ID</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Region</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Interval</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Spot ($/MWh)</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expected</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deviation</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Generator</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Flagged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {anomalies.map(a => (
              <tr key={a.anomaly_id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${a.flagged ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">{a.anomaly_id}</td>
                <td className="px-4 py-2.5"><AnomalyTypeBadge type={a.anomaly_type} /></td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{a.region}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {a.trading_interval.replace('T', ' ').substring(0, 16)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-800 dark:text-gray-200">
                  <span className={a.spot_price > 1000 ? 'text-red-600 dark:text-red-400' : a.spot_price < 0 ? 'text-blue-600 dark:text-blue-400' : ''}>
                    {a.spot_price.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">{a.expected_price.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={a.flagged ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-300'}>
                    {a.deviation_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">{a.generator_id}</td>
                <td className="px-4 py-2.5 text-center">
                  {a.flagged ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      FLAGGED
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function MarketSurveillance() {
  const [dashboard, setDashboard] = useState<SurveillanceDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getSurveillanceDashboard()
      setDashboard(data)
      setLastUpdated(new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load surveillance data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <Shield size={22} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Market Surveillance & Compliance
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              AEMO Market Surveillance — notices, compliance records, anomaly detection
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastUpdated} AEST
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !dashboard && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <RefreshCw size={18} className="animate-spin" />
            <span>Loading surveillance data...</span>
          </div>
        </div>
      )}

      {dashboard && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              title="Open Investigations"
              value={dashboard.open_investigations}
              icon={<Shield size={18} className="text-red-600 dark:text-red-400" />}
              color="bg-red-50 dark:bg-red-900/20"
              subtitle="Active + Under Investigation"
            />
            <KpiCard
              title="Referred to AER YTD"
              value={dashboard.referred_to_aer_ytd}
              icon={<Users size={18} className="text-orange-600 dark:text-orange-400" />}
              color="bg-orange-50 dark:bg-orange-900/20"
              subtitle="Matters referred to AER"
            />
            <KpiCard
              title="Total Penalties YTD"
              value={fmtPenalty(dashboard.total_penalties_ytd_aud)}
              icon={<TrendingUp size={18} className="text-indigo-600 dark:text-indigo-400" />}
              color="bg-indigo-50 dark:bg-indigo-900/20"
              subtitle="Proven compliance breaches"
            />
            <KpiCard
              title="Participants Under Review"
              value={dashboard.participants_under_review}
              icon={<AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />}
              color="bg-amber-50 dark:bg-amber-900/20"
              subtitle="Unique entities monitored"
            />
          </div>

          {/* Notices Table */}
          <div className="mb-6">
            <NoticesTable notices={dashboard.notices} />
          </div>

          {/* Compliance Table */}
          <div className="mb-6">
            <ComplianceTable records={dashboard.compliance_records} />
          </div>

          {/* Anomaly Table */}
          <div className="mb-6">
            <AnomalyTable anomalies={dashboard.anomalies} />
          </div>

          {/* Footer note */}
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center pb-2">
            Data sourced from AEMO Market Surveillance systems. Simulated for demonstration purposes.
            Last snapshot: {dashboard.timestamp}
          </p>
        </>
      )}
    </div>
  )
}
