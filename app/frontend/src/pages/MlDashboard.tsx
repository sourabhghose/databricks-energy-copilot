import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Brain, Activity, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { api, MlDashboardData as MlDashboardType } from '../api/client'

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

function truncateRunId(id: string): string {
  return id.length > 12 ? id.slice(0, 12) + '…' : id
}

function importanceColor(importance: number): string {
  if (importance >= 0.18) return '#22c55e'   // green-500 — high importance
  if (importance >= 0.10) return '#f59e0b'   // amber-500 — medium importance
  return '#ef4444'                            // red-500   — lower importance
}

function driftStatusColor(status: string): {
  bg: string
  text: string
  label: string
} {
  switch (status) {
    case 'critical':
      return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Critical' }
    case 'warning':
      return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Warning' }
    default:
      return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Stable' }
  }
}

function runStatusBadge(status: string): React.ReactElement {
  switch (status) {
    case 'FINISHED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle size={12} />
          Finished
        </span>
      )
    case 'RUNNING':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <Activity size={12} className="animate-spin" />
          Running
        </span>
      )
    case 'FAILED':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <AlertTriangle size={12} />
          Failed
        </span>
      )
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  title: string
  value: string | number
  badge?: React.ReactElement
  icon: React.ReactElement
  iconBg: string
}

function SummaryCard({ title, value, badge, icon, iconBg }: SummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
          {badge}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function MlDashboardPage() {
  const [data, setData] = useState<MlDashboardType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const result = await api.getMlDashboard()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ML dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---- Derived stats for summary cards ----
  const driftAlertCount = data
    ? data.drift_summary.filter(d => d.drift_status === 'warning' || d.drift_status === 'critical').length
    : 0

  // ---- Sort drift by drift_ratio descending ----
  const sortedDrift = data
    ? [...data.drift_summary].sort((a, b) => b.drift_ratio - a.drift_ratio)
    : []

  // ---- Feature importance for price_forecast ----
  const priceFeatures = data?.feature_importance?.['price_forecast'] ?? []
  const featureChartData = [...priceFeatures]
    .sort((a, b) => a.rank - b.rank)
    .map(f => ({
      feature_name: f.feature_name,
      importance: f.importance,
    }))

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-72 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-72 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    )
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          <p className="font-medium">Failed to load ML dashboard</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={() => fetchData()}
            className="mt-3 text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Brain size={24} className="text-purple-600 dark:text-purple-400" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            ML Experiment Dashboard
          </h1>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            MLflow
          </span>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ---- Summary cards ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Runs"
          value={data.total_runs}
          icon={<Activity size={18} className="text-blue-600" />}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
        />
        <SummaryCard
          title="Models in Production"
          value={data.models_in_production}
          badge={
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              live
            </span>
          }
          icon={<CheckCircle size={18} className="text-green-600" />}
          iconBg="bg-green-100 dark:bg-green-900/30"
        />
        <SummaryCard
          title="Avg Production MAE"
          value={data.avg_mae_production.toFixed(2)}
          icon={<Brain size={18} className="text-purple-600" />}
          iconBg="bg-purple-100 dark:bg-purple-900/30"
        />
        <SummaryCard
          title="Drift Alerts"
          value={driftAlertCount}
          badge={
            driftAlertCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                needs review
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                all clear
              </span>
            )
          }
          icon={<AlertTriangle size={18} className={driftAlertCount > 0 ? 'text-amber-500' : 'text-green-600'} />}
          iconBg={driftAlertCount > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30'}
        />
      </div>

      {/* ---- Model Drift Table ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Model Drift Summary
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Sorted by drift ratio descending. Warning: ratio &gt; 1.3. Critical: ratio &gt; 1.5.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Model</th>
                <th className="text-left px-4 py-3">Region</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Training MAE</th>
                <th className="text-right px-4 py-3">Production MAE</th>
                <th className="text-right px-4 py-3">Drift Ratio</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedDrift.map((d, idx) => {
                const sc = driftStatusColor(d.drift_status)
                return (
                  <tr
                    key={`${d.model_type}-${d.region}-${idx}`}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-750"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {d.model_type}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {d.region}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {d.date}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                      {d.mae_training.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-medium">
                      {d.mae_production.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      <span className={d.drift_ratio >= 1.3 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-600 dark:text-gray-300'}>
                        {d.drift_ratio.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.text}`}>
                        {sc.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Feature Importance Chart ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Feature Importance — Price Forecast
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            LightGBM gain metric, normalised to sum to 1.0. Top 8 features shown.
          </p>
        </div>
        <div className="p-5">
          {featureChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={featureChartData}
                layout="vertical"
                margin={{ top: 4, right: 32, left: 24, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  domain={[0, 0.25]}
                  tickFormatter={v => v.toFixed(2)}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  label={{ value: 'Importance Score', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#9ca3af' }}
                />
                <YAxis
                  type="category"
                  dataKey="feature_name"
                  width={120}
                  tick={{ fontSize: 12, fill: '#374151' }}
                />
                <Tooltip
                  formatter={(value: number) => [value.toFixed(4), 'Importance']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="importance" name="Importance" radius={[0, 3, 3, 0]}>
                  {featureChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={importanceColor(entry.importance)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No feature importance data available.
            </p>
          )}
        </div>
      </div>

      {/* ---- Recent Training Runs Table ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Recent Training Runs
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Showing {data.recent_runs.length} most recent runs. FAILED rows show no metrics.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Run ID</th>
                <th className="text-left px-4 py-3">Model</th>
                <th className="text-left px-4 py-3">Region</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Duration</th>
                <th className="text-right px-4 py-3">MAE</th>
                <th className="text-right px-4 py-3">RMSE</th>
                <th className="text-right px-4 py-3">MAPE %</th>
                <th className="text-center px-4 py-3">Version</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_runs.map((run) => {
                const isFailed = run.status === 'FAILED'
                const metricClass = isFailed
                  ? 'text-gray-300 dark:text-gray-600 line-through'
                  : 'text-gray-900 dark:text-gray-100'
                return (
                  <tr
                    key={run.run_id}
                    className={[
                      'border-b border-gray-100 dark:border-gray-700/50',
                      isFailed ? 'opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-750',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {truncateRunId(run.run_id)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {run.model_type}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {run.region}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {runStatusBadge(run.status)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                      {formatDuration(run.duration_seconds)}
                    </td>
                    <td className={`px-4 py-3 text-right ${metricClass}`}>
                      {isFailed ? '—' : run.mae.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right ${metricClass}`}>
                      {isFailed ? '—' : run.rmse.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right ${metricClass}`}>
                      {isFailed ? '—' : run.mape.toFixed(1) + '%'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 font-mono text-xs">
                      v{run.model_version}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Footer note ---- */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Experiments map to Unity Catalog: energy_copilot.models.&lt;model_type&gt;_&lt;region&gt;.
        Data as of {new Date(data.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST.
      </p>
    </div>
  )
}
