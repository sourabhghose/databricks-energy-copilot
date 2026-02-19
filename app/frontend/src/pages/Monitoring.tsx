import React, { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Database,
  Brain,
  Activity,
  Clock,
} from 'lucide-react'
import { api, SystemHealthResponse, ModelHealthRecord } from '../api/client'

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------
const StatusBadge: React.FC<{ status: 'ok' | 'stale' | 'missing' | boolean; label?: string }> = ({
  status,
  label,
}) => {
  if (status === true || status === 'ok')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle size={10} />
        {label ?? 'OK'}
      </span>
    )
  if (status === 'stale')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        <AlertCircle size={10} />
        Stale
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      <XCircle size={10} />
      {label ?? 'Error'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MODEL_TYPE_LABELS: Record<string, string> = {
  price_forecast: 'Price Forecast',
  demand_forecast: 'Demand Forecast',
  wind_forecast: 'Wind Forecast',
  solar_forecast: 'Solar Forecast',
  anomaly_detection_nem: 'Anomaly Detection',
}

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

function modelTypeKey(modelName: string): string {
  const last = modelName.split('.').pop() ?? ''
  return last.replace(/_NSW1|_QLD1|_VIC1|_SA1|_TAS1$/, '')
}

// ---------------------------------------------------------------------------
// InfraCard
// ---------------------------------------------------------------------------
interface InfraCardProps {
  icon: React.ElementType
  label: string
  detail: string
  ok: boolean
}

const InfraCard: React.FC<InfraCardProps> = ({ icon: Icon, label, detail, ok }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${ok ? 'bg-green-50' : 'bg-red-50'}`}>
          <Icon size={18} className={ok ? 'text-green-600' : 'text-red-600'} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">{detail}</p>
        </div>
      </div>
      <StatusBadge status={ok} />
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Monitoring page
// ---------------------------------------------------------------------------
export default function Monitoring() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getSystemHealth()
      setHealth(data)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(fetchHealth, 30_000)
    return () => clearInterval(id)
  }, [autoRefresh, fetchHealth])

  const modelGroups = (health?.model_details ?? []).reduce<Record<string, ModelHealthRecord[]>>(
    (acc, m) => {
      const key = modelTypeKey(m.model_name)
      ;(acc[key] = acc[key] ?? []).push(m)
      return acc
    },
    {}
  )

  const infraCards: InfraCardProps[] = [
    {
      icon: Database,
      label: 'Databricks Warehouse',
      ok: health?.databricks_ok ?? false,
      detail: 'SQL query engine',
    },
    {
      icon: Database,
      label: 'Lakebase (Postgres)',
      ok: health?.lakebase_ok ?? false,
      detail: 'Alert & session store',
    },
    {
      icon: Activity,
      label: 'Data Freshness',
      ok: (health?.data_freshness_minutes ?? 99) < 10,
      detail:
        health?.data_freshness_minutes != null
          ? `${health.data_freshness_minutes.toFixed(1)} min lag`
          : '— min lag',
    },
    {
      icon: Clock,
      label: 'Pipeline Last Run',
      ok: !!health?.pipeline_last_run,
      detail: health?.pipeline_last_run
        ? new Date(health.pipeline_last_run).toLocaleTimeString('en-AU')
        : 'Unknown',
    },
  ]

  const allHealthy =
    health != null && health.models_healthy === health.models_total

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Monitoring</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString('en-AU')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
          Could not reach the monitoring endpoint — showing last known state.
        </div>
      )}

      {/* Infrastructure Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {infraCards.map(card => (
          <InfraCard key={card.label} {...card} />
        ))}
      </div>

      {/* Model Summary Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
        <Brain size={20} className="text-blue-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900">
            {health?.models_healthy ?? 0} / {health?.models_total ?? 21} models healthy
          </p>
          <p className="text-xs text-blue-700 mt-0.5">
            20 regional forecast models (price, demand, wind, solar × 5 NEM regions) + 1 anomaly detection model
          </p>
        </div>
        <StatusBadge
          status={allHealthy ? 'ok' : health ? 'stale' : 'missing'}
          label={allHealthy ? 'All healthy' : 'Degraded'}
        />
      </div>

      {/* Model Registry Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={18} className="text-purple-600" />
          <h2 className="text-base font-semibold text-gray-900">ML Model Registry</h2>
          <span className="ml-auto text-xs text-gray-400">@production alias</span>
        </div>

        {loading && !health ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Model Type</th>
                  {REGIONS.map(r => (
                    <th key={r} className="pb-2 font-medium text-center">
                      {r}
                    </th>
                  ))}
                  <th className="pb-2 font-medium text-center">Version</th>
                  <th className="pb-2 font-medium text-center">Alias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(modelGroups).map(([key, models]) => {
                  const label = MODEL_TYPE_LABELS[key] ?? key
                  const version = models[0]?.model_version ?? '—'
                  const alias = models[0]?.alias ?? '—'
                  return (
                    <tr key={key} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-800">{label}</td>
                      {REGIONS.map(region => {
                        const m = models.find(x => x.region === region)
                        return (
                          <td key={region} className="py-2.5 text-center">
                            {m ? (
                              <StatusBadge status={m.status} />
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="py-2.5 text-center text-gray-500 text-xs">{version}</td>
                      <td className="py-2.5 text-center text-xs text-gray-500">{alias}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {health && (
        <p className="text-xs text-gray-400 text-right">
          Backend timestamp:{' '}
          {new Date(health.timestamp).toLocaleString('en-AU', {
            timeZone: 'Australia/Sydney',
          })}{' '}
          AEST
        </p>
      )}
    </div>
  )
}
