import React, { useState, useEffect, useCallback } from 'react'
import { Database, CheckCircle, XCircle, AlertCircle, Activity, RefreshCw } from 'lucide-react'
import { api, DataCatalogDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(0)
  return `${mins}m ${secs}s`
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Australia/Sydney',
    })
  } catch {
    return iso
  }
}

function truncateRunId(runId: string, maxLen = 20): string {
  return runId.length > maxLen ? runId.slice(0, maxLen) + '…' : runId
}

// ---------------------------------------------------------------------------
// Status badge components
// ---------------------------------------------------------------------------

interface BadgeProps {
  label: string
  variant: 'green' | 'red' | 'blue' | 'amber' | 'gray'
  pulse?: boolean
}

function Badge({ label, variant, pulse = false }: BadgeProps) {
  const variantClass: Record<string, string> = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${variantClass[variant]} ${pulse ? 'animate-pulse' : ''}`}
    >
      {label}
    </span>
  )
}

function pipelineStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED': return <Badge label="COMPLETED" variant="green" />
    case 'RUNNING':   return <Badge label="RUNNING" variant="blue" pulse />
    case 'FAILED':    return <Badge label="FAILED" variant="red" />
    case 'WAITING':   return <Badge label="WAITING" variant="gray" />
    default:          return <Badge label={status} variant="gray" />
  }
}

function freshnessBadge(status: string) {
  switch (status) {
    case 'fresh':    return <Badge label="fresh" variant="green" />
    case 'stale':    return <Badge label="stale" variant="amber" />
    case 'critical': return <Badge label="critical" variant="red" />
    default:         return <Badge label={status} variant="gray" />
  }
}

function severityBadge(severity: string) {
  switch (severity) {
    case 'error':   return <Badge label="error" variant="red" />
    case 'warning': return <Badge label="warning" variant="amber" />
    case 'drop':    return <Badge label="drop" variant="blue" />
    default:        return <Badge label={severity} variant="gray" />
  }
}

function passRateColor(rate: number): string {
  if (rate >= 0.99) return 'text-green-600 dark:text-green-400'
  if (rate >= 0.90) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  title: string
  value: string | number
  subtitle?: string
  badge?: React.ReactNode
  icon: React.ReactNode
  iconBg: string
}

function SummaryCard({ title, value, subtitle, badge, icon, iconBg }: SummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-4">
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pass-rate mini bar
// ---------------------------------------------------------------------------

function PassRateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100)
  const barColor =
    rate >= 0.99 ? 'bg-green-500' : rate >= 0.90 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium w-10 text-right ${passRateColor(rate)}`}>{pct}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table card (used in the health grid)
// ---------------------------------------------------------------------------

interface TableCardProps {
  tableName: string
  rowCount: number
  sizeGb: number
  freshnessMinutes: number
  freshnessStatus: string
  expectationPassRate: number
  partitionCount: number
}

function TableCard({
  tableName,
  rowCount,
  sizeGb,
  freshnessMinutes,
  freshnessStatus,
  expectationPassRate,
  partitionCount,
}: TableCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate" title={tableName}>
          {tableName}
        </span>
        {freshnessBadge(freshnessStatus)}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">{formatNumber(rowCount)}</span> rows
        </div>
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">{sizeGb.toFixed(3)}</span> GB
        </div>
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">{freshnessMinutes.toFixed(1)}</span> min ago
        </div>
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">{partitionCount}</span> partitions
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">DQ Pass Rate</p>
        <PassRateBar rate={expectationPassRate} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function DataCatalog() {
  const [dashboard, setDashboard] = useState<DataCatalogDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getCatalogDashboard()
      setDashboard(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Group tables by schema
  const bronzeTables = dashboard?.table_health.filter(t => t.schema_name === 'bronze') ?? []
  const silverTables = dashboard?.table_health.filter(t => t.schema_name === 'silver') ?? []
  const goldTables   = dashboard?.table_health.filter(t => t.schema_name === 'gold')   ?? []

  return (
    <div className="p-6 space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Database size={20} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Data Pipeline &amp; Catalog
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                Unity Catalog
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              DLT pipeline runs, table freshness, and data quality expectations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastUpdated.toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
            </span>
          )}
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Error state                                                         */}
      {/* ------------------------------------------------------------------ */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start gap-3">
          <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Failed to load dashboard</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Loading skeleton                                                    */}
      {/* ------------------------------------------------------------------ */}
      {loading && !dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-24 animate-pulse" />
          ))}
        </div>
      )}

      {dashboard && (
        <>
          {/* ---------------------------------------------------------------- */}
          {/* Health summary cards                                             */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Fresh Tables"
              value={`${dashboard.fresh_tables}/${dashboard.total_tables}`}
              subtitle={`${dashboard.stale_tables} stale, ${dashboard.critical_tables} critical`}
              badge={<Badge label="healthy" variant="green" />}
              icon={<CheckCircle size={20} className="text-green-600 dark:text-green-400" />}
              iconBg="bg-green-100 dark:bg-green-900/30"
            />
            <SummaryCard
              title="Critical Tables"
              value={dashboard.critical_tables}
              subtitle="freshness > 30 min"
              badge={dashboard.critical_tables > 0 ? <Badge label="action required" variant="red" /> : undefined}
              icon={<AlertCircle size={20} className="text-red-600 dark:text-red-400" />}
              iconBg="bg-red-100 dark:bg-red-900/30"
            />
            <SummaryCard
              title="Pipeline Failures Today"
              value={dashboard.pipeline_failures_today}
              subtitle={`of ${dashboard.pipeline_runs_today} runs`}
              badge={
                dashboard.pipeline_failures_today > 0
                  ? <Badge label="failures" variant="red" />
                  : <Badge label="all passing" variant="green" />
              }
              icon={<Activity size={20} className="text-blue-600 dark:text-blue-400" />}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
            />
            <SummaryCard
              title="Rows Processed Today"
              value={formatNumber(dashboard.total_rows_today)}
              subtitle="across all pipelines"
              icon={<Database size={20} className="text-violet-600 dark:text-violet-400" />}
              iconBg="bg-violet-100 dark:bg-violet-900/30"
            />
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Pipeline runs table                                              */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Activity size={16} className="text-blue-500" />
              Recent Pipeline Runs
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Pipeline</th>
                    <th className="text-left px-4 py-3">Run ID</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Started</th>
                    <th className="text-right px-4 py-3">Duration</th>
                    <th className="text-right px-4 py-3">Rows</th>
                    <th className="text-left px-4 py-3">Trigger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {dashboard.recent_pipelines.map((run) => (
                    <tr
                      key={run.run_id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        run.status === 'FAILED' ? 'bg-red-50/40 dark:bg-red-900/10' : ''
                      }`}
                      title={run.error_message ?? undefined}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">
                        <span className="block max-w-[200px] truncate" title={run.pipeline_name}>
                          {run.pipeline_name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 font-mono text-xs">
                        {truncateRunId(run.run_id)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {pipelineStatusBadge(run.status)}
                          {run.status === 'FAILED' && run.error_message && (
                            <span
                              className="text-red-500 cursor-help"
                              title={run.error_message}
                            >
                              <AlertCircle size={13} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 text-xs">
                        {formatTimestamp(run.start_time)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300 tabular-nums">
                        {run.status === 'WAITING' ? '—' : formatDuration(run.duration_seconds)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300 tabular-nums">
                        {run.rows_processed > 0 ? formatNumber(run.rows_processed) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{run.triggered_by}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Table health grid — grouped by schema                           */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Database size={16} className="text-violet-500" />
              Unity Catalog Table Health
            </h2>

            {/* Bronze */}
            {bronzeTables.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                    Bronze
                  </span>
                  <span className="text-xs text-gray-400">— raw ingestion layer</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {bronzeTables.map(t => (
                    <TableCard
                      key={`${t.schema_name}.${t.table_name}`}
                      tableName={t.table_name}
                      rowCount={t.row_count}
                      sizeGb={t.size_gb}
                      freshnessMinutes={t.freshness_minutes}
                      freshnessStatus={t.freshness_status}
                      expectationPassRate={t.expectation_pass_rate}
                      partitionCount={t.partition_count}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Silver */}
            {silverTables.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-300">
                    Silver
                  </span>
                  <span className="text-xs text-gray-400">— cleansed &amp; conformed</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {silverTables.map(t => (
                    <TableCard
                      key={`${t.schema_name}.${t.table_name}`}
                      tableName={t.table_name}
                      rowCount={t.row_count}
                      sizeGb={t.size_gb}
                      freshnessMinutes={t.freshness_minutes}
                      freshnessStatus={t.freshness_status}
                      expectationPassRate={t.expectation_pass_rate}
                      partitionCount={t.partition_count}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Gold */}
            {goldTables.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-yellow-600 dark:text-yellow-400">
                    Gold
                  </span>
                  <span className="text-xs text-gray-400">— business-ready aggregates</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {goldTables.map(t => (
                    <TableCard
                      key={`${t.schema_name}.${t.table_name}`}
                      tableName={t.table_name}
                      rowCount={t.row_count}
                      sizeGb={t.size_gb}
                      freshnessMinutes={t.freshness_minutes}
                      freshnessStatus={t.freshness_status}
                      expectationPassRate={t.expectation_pass_rate}
                      partitionCount={t.partition_count}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Data Quality Expectations table                                  */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500" />
              Data Quality Expectations
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Table</th>
                    <th className="text-left px-4 py-3">Expectation</th>
                    <th className="text-left px-4 py-3">Column</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-right px-4 py-3">Pass Rate</th>
                    <th className="text-right px-4 py-3">Failed Rows</th>
                    <th className="text-left px-4 py-3">Severity</th>
                    <th className="text-left px-4 py-3">Last Run</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {dashboard.dq_expectations.map((exp, idx) => (
                    <tr
                      key={`${exp.table_name}-${exp.expectation_name}-${idx}`}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        !exp.passed ? 'bg-red-50/40 dark:bg-red-900/10' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">
                        {exp.table_name}
                      </td>
                      <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 max-w-[160px]">
                        <span className="block truncate" title={exp.expectation_name}>
                          {exp.expectation_name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400">
                        {exp.column_name}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {exp.expectation_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-semibold tabular-nums ${passRateColor(exp.pass_rate)}`}>
                          {(exp.pass_rate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300 tabular-nums">
                        {exp.failed_rows > 0 ? (
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {formatNumber(exp.failed_rows)}
                          </span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">{severityBadge(exp.severity)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                        {formatTimestamp(exp.last_evaluated)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
