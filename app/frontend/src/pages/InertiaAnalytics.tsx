import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import { Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { api, InertiaDashboard, InertiaRecord, SystemStrengthRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtNum(n: number, dp = 0) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'SECURE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle size={11} /> SECURE
      </span>
    )
  }
  if (status === 'MARGINAL') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        <AlertTriangle size={11} /> MARGINAL
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
      <XCircle size={11} /> INSECURE
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  variant?: 'default' | 'warning' | 'danger' | 'ok'
}

function KpiCard({ label, value, sub, variant = 'default' }: KpiCardProps) {
  const accent =
    variant === 'danger'
      ? 'border-l-4 border-red-500'
      : variant === 'warning'
      ? 'border-l-4 border-amber-500'
      : variant === 'ok'
      ? 'border-l-4 border-green-500'
      : 'border-l-4 border-blue-500'

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm ${accent}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inertia Bar Chart
// ---------------------------------------------------------------------------

interface InertiaBarChartProps {
  records: InertiaRecord[]
}

function InertiaBarChart({ records }: InertiaBarChartProps) {
  const data = records.map((r) => ({
    region: r.region,
    'Total Inertia': r.total_inertia_mws,
    'Sync Inertia': r.synchronous_inertia_mws,
    'Non-Sync Inertia': r.non_synchronous_inertia_mws,
    'Secure Threshold': r.secure_threshold_mws,
    'Min Threshold': r.min_threshold_mws,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Regional Inertia vs Thresholds (MWs)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis dataKey="region" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(val: number, name: string) => [`${fmtNum(val)} MWs`, name]}
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 6, color: '#f9fafb', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Sync Inertia" stackId="a" fill="#3b82f6" />
          <Bar dataKey="Non-Sync Inertia" stackId="a" fill="#93c5fd" />
          {records.map((r) => (
            <ReferenceLine
              key={`sec-${r.region}`}
              x={r.region}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              strokeWidth={1.5}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-2">
        Stacked bars show synchronous (dark blue) and non-synchronous (light blue) inertia components.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inertia Threshold Chart (separate simple bar per region showing vs thresholds)
// ---------------------------------------------------------------------------

function InertiaThresholdChart({ records }: InertiaBarChartProps) {
  const data = records.map((r) => ({
    region: r.region,
    total: r.total_inertia_mws,
    secure: r.secure_threshold_mws,
    minimum: r.min_threshold_mws,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Total Inertia vs Secure &amp; Minimum Thresholds (MWs)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis dataKey="region" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(val: number, name: string) => [`${fmtNum(val)} MWs`, name]}
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 6, color: '#f9fafb', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="total" name="Total Inertia" fill="#3b82f6" />
          <Bar dataKey="secure" name="Secure Threshold" fill="#f59e0b" opacity={0.7} />
          <Bar dataKey="minimum" name="Minimum Threshold" fill="#ef4444" opacity={0.7} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// System Strength Table
// ---------------------------------------------------------------------------

interface StrengthTableProps {
  records: SystemStrengthRecord[]
}

function SystemStrengthTable({ records }: StrengthTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
        System Strength by Region
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Region</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fault Level (MVA)</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Min Fault Level (MVA)</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">SCR Ratio</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">IBR%</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sync Condenser (MVA)</th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr
                key={r.region}
                className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">{r.region}</td>
                <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{fmtNum(r.fault_level_mva, 1)}</td>
                <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{fmtNum(r.min_fault_level_mva, 1)}</td>
                <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{r.scr_ratio.toFixed(3)}</td>
                <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{r.inverter_based_resources_pct.toFixed(1)}%</td>
                <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{fmtNum(r.synchronous_condenser_mva, 1)}</td>
                <td className="py-2 px-3 text-center">
                  <StatusBadge status={r.system_strength_status} />
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
// Inertia Detail Table
// ---------------------------------------------------------------------------

interface DetailTableProps {
  records: InertiaRecord[]
}

function InertiaDetailTable({ records }: DetailTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
        Inertia Detail by Region
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Region</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total (MWs)</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sync (MWs)</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Non-Sync (MWs)</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Secure (MWs)</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Min (MWs)</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Deficit (MWs)</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">RoCoF (Hz/s)</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sync Condensers</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sync Generators</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const belowMin = r.total_inertia_mws < r.min_threshold_mws
              const belowSecure = r.total_inertia_mws < r.secure_threshold_mws
              return (
                <tr
                  key={r.region}
                  className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                    belowMin ? 'bg-red-50 dark:bg-red-900/10' : belowSecure ? 'bg-amber-50 dark:bg-amber-900/10' : ''
                  }`}
                >
                  <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">{r.region}</td>
                  <td className={`py-2 px-3 text-right font-medium ${belowMin ? 'text-red-600 dark:text-red-400' : belowSecure ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {fmtNum(r.total_inertia_mws, 1)}
                  </td>
                  <td className="py-2 px-3 text-right text-blue-600 dark:text-blue-400">{fmtNum(r.synchronous_inertia_mws, 1)}</td>
                  <td className="py-2 px-3 text-right text-sky-500 dark:text-sky-400">{fmtNum(r.non_synchronous_inertia_mws, 1)}</td>
                  <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400">{fmtNum(r.secure_threshold_mws, 0)}</td>
                  <td className="py-2 px-3 text-right text-red-500 dark:text-red-400">{fmtNum(r.min_threshold_mws, 0)}</td>
                  <td className={`py-2 px-3 text-right font-medium ${r.deficit_mws > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {r.deficit_mws > 0 ? fmtNum(r.deficit_mws, 1) : '—'}
                  </td>
                  <td className={`py-2 px-3 text-right ${r.rocof_hz_per_sec > 0.9 ? 'text-red-600 dark:text-red-400' : r.rocof_hz_per_sec > 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {r.rocof_hz_per_sec.toFixed(3)}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{r.synchronous_condensers_online}</td>
                  <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{r.num_synchronous_generators}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alert Banner
// ---------------------------------------------------------------------------

interface AlertBannerProps {
  belowMin: string[]
  belowSecure: string[]
}

function AlertBanner({ belowMin, belowSecure }: AlertBannerProps) {
  if (belowMin.length > 0) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <XCircle className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" size={18} />
        <div>
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            INERTIA BELOW MINIMUM THRESHOLD — Immediate risk
          </p>
          <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
            Regions below minimum: {belowMin.join(', ')}. System is at risk of losing frequency stability
            following a significant contingency event. AEMO may need to direct generation.
          </p>
        </div>
      </div>
    )
  }
  if (belowSecure.length > 0) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" size={18} />
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            INERTIA BELOW SECURE THRESHOLD — Monitor closely
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            Regions below secure level: {belowSecure.join(', ')}. Inertia is below secure operating level but
            above minimum. AEMO may apply inertia sub-limits.
          </p>
        </div>
      </div>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function InertiaAnalytics() {
  const [dashboard, setDashboard] = useState<InertiaDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getInertiaDashboard()
      setDashboard(data)
      setLastRefresh(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load inertia data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 300_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Activity className="text-blue-600 dark:text-blue-400" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Power System Inertia &amp; System Strength
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              NEM inertia, RoCoF exposure, system strength and synchronous plant analytics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated: {lastRefresh.toLocaleTimeString('en-AU')}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {dashboard && (
        <>
          {/* Alert Banner */}
          <AlertBanner
            belowMin={dashboard.regions_below_minimum}
            belowSecure={dashboard.regions_below_secure}
          />

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="National Inertia"
              value={`${fmtNum(dashboard.national_inertia_mws, 0)} MWs`}
              sub="Combined NEM inertia (all regions)"
              variant="default"
            />
            <KpiCard
              label="Regions Below Secure"
              value={dashboard.regions_below_secure.length}
              sub={
                dashboard.regions_below_secure.length > 0
                  ? dashboard.regions_below_secure.join(', ')
                  : 'All regions secure'
              }
              variant={dashboard.regions_below_secure.length > 0 ? 'warning' : 'ok'}
            />
            <KpiCard
              label="Regions Below Minimum"
              value={dashboard.regions_below_minimum.length}
              sub={
                dashboard.regions_below_minimum.length > 0
                  ? dashboard.regions_below_minimum.join(', ')
                  : 'No critical deficits'
              }
              variant={dashboard.regions_below_minimum.length > 0 ? 'danger' : 'ok'}
            />
            <KpiCard
              label="Total Synchronous Condensers"
              value={dashboard.total_synchronous_condensers}
              sub="Online across all regions"
              variant="default"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <InertiaBarChart records={dashboard.inertia_records} />
            <InertiaThresholdChart records={dashboard.inertia_records} />
          </div>

          {/* System Strength Table */}
          <SystemStrengthTable records={dashboard.strength_records} />

          {/* Inertia Detail Table */}
          <InertiaDetailTable records={dashboard.inertia_records} />

          {/* Explanation Note */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Activity className="text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" size={16} />
              <div className="space-y-1.5 text-sm text-blue-800 dark:text-blue-300">
                <p className="font-semibold">About System Inertia &amp; System Strength</p>
                <p>
                  System inertia (MWs) determines how quickly frequency changes after a disturbance (RoCoF).
                  Low inertia regions like SA1 are most exposed. Synchronous condensers provide inertia and
                  fault level without generating power.
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>
                    <strong>RoCoF (Rate of Change of Frequency)</strong> — the rate at which frequency
                    deviates following a contingency. Higher inertia = lower RoCoF = more time to respond.
                  </li>
                  <li>
                    <strong>System Strength (Fault Level MVA)</strong> — measures the ability of the grid to
                    maintain voltage following a disturbance. Inverter-based resources (IBR) contribute less
                    fault current than synchronous generators.
                  </li>
                  <li>
                    <strong>SCR (Short Circuit Ratio)</strong> — ratio of fault level to installed IBR
                    capacity. Low SCR indicates a weak grid vulnerable to voltage instability.
                  </li>
                  <li>
                    <strong>Secure threshold</strong> — AEMO&apos;s preferred operating level for inertia.
                    <strong> Minimum threshold</strong> — below this level AEMO must apply special
                    constraints or direct synchronous generation online.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
