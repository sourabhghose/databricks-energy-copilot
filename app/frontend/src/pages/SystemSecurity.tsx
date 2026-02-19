import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Shield, Zap, Activity, RefreshCw, AlertTriangle } from 'lucide-react'
import { api, PowerSystemSecurityDashboard, PssInertiaRecord, SynchronousCondenserRecord, FcasDispatchRecord } from '../api/client'

// ---------------------------------------------------------------------------
// FCAS service label map
// ---------------------------------------------------------------------------

const FCAS_LABELS: Record<string, string> = {
  R6S:  'Raise 6-Second',
  R60S: 'Raise 60-Second',
  R5M:  'Raise 5-Minute',
  R5RE: 'Raise Reg',
  L6S:  'Lower 6-Second',
  L60S: 'Lower 60-Second',
  L5M:  'Lower 5-Minute',
  L5RE: 'Lower Reg',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function headroomColor(headroom: number): string {
  if (headroom < 0)    return 'text-red-600 dark:text-red-400 font-semibold'
  if (headroom < 1000) return 'text-amber-600 dark:text-amber-400 font-semibold'
  return 'text-green-600 dark:text-green-400'
}

function statusBadge(status: string): JSX.Element {
  let cls = 'px-2 py-0.5 rounded-full text-xs font-medium '
  if (status === 'Secure')      cls += 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  else if (status === 'Low Inertia') cls += 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
  else if (status === 'Critical')    cls += 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  else                                cls += 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  return <span className={cls}>{status}</span>
}

function synconStatusBadge(status: string): JSX.Element {
  let cls = 'px-2 py-0.5 rounded-full text-xs font-medium '
  if (status === 'Online')          cls += 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  else if (status === 'Commissioning') cls += 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  else                                  cls += 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  return <span className={cls}>{status}</span>
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string
  unit?: string
  icon: React.ReactNode
  color?: string
}

function KpiCard({ title, value, unit, icon, color = 'text-blue-600' }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`mt-1 ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
          {value}
          {unit && <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  )
}

interface SystemStrengthBannerProps {
  status: string
}

function SystemStrengthBanner({ status }: SystemStrengthBannerProps) {
  let cls = 'rounded-xl p-4 flex items-center gap-3 '
  let icon: React.ReactNode
  if (status === 'Secure') {
    cls += 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
    icon = <Shield className="text-green-600 dark:text-green-400 shrink-0" size={22} />
  } else if (status === 'Marginal') {
    cls += 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
    icon = <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0" size={22} />
  } else {
    cls += 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
    icon = <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" size={22} />
  }

  const statusColor =
    status === 'Secure'   ? 'text-green-700 dark:text-green-300' :
    status === 'Marginal' ? 'text-amber-700 dark:text-amber-300' :
                            'text-red-700 dark:text-red-300'

  const description =
    status === 'Secure'
      ? 'All NEM regions have sufficient inertia headroom. System strength is adequate.'
      : status === 'Marginal'
      ? 'One or more NEM regions have low inertia headroom (<500 MWs). Monitor closely.'
      : 'One or more NEM regions have negative inertia headroom. Immediate action required.'

  return (
    <div className={cls}>
      {icon}
      <div>
        <p className={`font-semibold text-sm ${statusColor}`}>
          System Strength Status: {status}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

interface InertiaTableProps {
  records: PssInertiaRecord[]
}

function InertiaTable({ records }: InertiaTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Inertia by Region</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Current inertia levels and headroom for each NEM region</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-750">
            <tr>
              {['Region', 'Total Inertia (MWs)', 'Sync Gen (MW)', 'Non-Sync %', 'RoCoF Limit (Hz/s)', 'Headroom (MWs)', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {records.map(r => (
              <tr key={r.region} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{r.region}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.total_inertia_mws.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.synchronous_generation_mw.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.non_synchronous_pct.toFixed(1)}%</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.rocof_limit_hz_s.toFixed(1)}</td>
                <td className={`px-4 py-3 ${headroomColor(r.inertia_headroom_mws)}`}>
                  {r.inertia_headroom_mws.toLocaleString()}
                </td>
                <td className="px-4 py-3">{statusBadge(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface InertiaChartProps {
  records: PssInertiaRecord[]
}

function InertiaChart({ records }: InertiaChartProps) {
  const data = records.map(r => ({
    region: r.region,
    'Sync Gen MW': r.synchronous_generation_mw,
    'Headroom MWs': Math.max(0, r.inertia_headroom_mws),
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Inertia Composition by Region</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Synchronous generation MW (dark) and inertia headroom MWs (light) by NEM region</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="region" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: number) => v.toLocaleString()} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Sync Gen MW" stackId="a" fill="#1e40af" />
          <Bar dataKey="Headroom MWs" stackId="a" fill="#93c5fd" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface SynconTableProps {
  condensers: SynchronousCondenserRecord[]
}

function SynconTable({ condensers }: SynconTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Synchronous Condensers</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Installed and commissioning synchronous condensers providing system strength</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-750">
            <tr>
              {['Unit ID', 'Site Name', 'Region', 'Operator', 'MVAr', 'Inertia (MWs)', 'Status', 'Year', 'Purpose'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {condensers.map(c => (
              <tr key={c.unit_id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{c.unit_id}</td>
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-xs">{c.site_name}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.region}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.operator}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.rated_mvar.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.inertia_contribution_mws.toLocaleString()}</td>
                <td className="px-4 py-3">{synconStatusBadge(c.status)}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.commissioning_year}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface FcasTableProps {
  records: FcasDispatchRecord[]
}

function FcasTable({ records }: FcasTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">FCAS Dispatch</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Current dispatch for all 8 FCAS services — Raise (blue) and Lower (amber)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-750">
            <tr>
              {['Service', 'Requirement (MW)', 'Dispatched (MW)', 'Price ($/MW/hr)', 'Enablement', 'Primary Provider'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {records.map(r => {
              const isRaise = r.service.startsWith('R')
              const rowBg = isRaise
                ? 'bg-blue-50/40 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                : 'bg-amber-50/40 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20'

              return (
                <tr key={r.service} className={rowBg}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isRaise ? 'bg-blue-500' : 'bg-amber-500'}`} />
                      <span className="font-medium text-gray-900 dark:text-gray-100">{FCAS_LABELS[r.service] ?? r.service}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">({r.service})</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.requirement_mw.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.dispatched_mw.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">${r.price_mwh.toFixed(2)}</td>
                  <td className="px-4 py-3 w-40">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isRaise ? 'bg-blue-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(r.enablement_pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400 tabular-nums w-12 text-right">
                        {r.enablement_pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.primary_provider}</td>
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
// Main page
// ---------------------------------------------------------------------------

export default function SystemSecurity() {
  const [data, setData] = useState<PowerSystemSecurityDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const dashboard = await api.getPssDashboard()
      setData(dashboard)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load power system security data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <RefreshCw className="animate-spin" size={20} />
          <span className="text-sm">Loading power system security data...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" size={20} />
          <p className="text-sm text-red-700 dark:text-red-300">{error ?? 'No data available'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="text-blue-600 dark:text-blue-400" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Power System Security</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Inertia analytics, synchronous condensers & FCAS dispatch
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastUpdated.toLocaleTimeString('en-AU')}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchData() }}
            className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* System strength banner */}
      <SystemStrengthBanner status={data.system_strength_status} />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="NEM Total Inertia"
          value={data.nem_inertia_total_mws.toLocaleString()}
          unit="MWs"
          icon={<Activity size={22} />}
          color="text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          title="Synchronous Condensers Online"
          value={String(data.synchronous_condensers_online)}
          unit={`of ${data.synchronous_condensers.length} total`}
          icon={<Zap size={22} />}
          color="text-green-600 dark:text-green-400"
        />
        <KpiCard
          title="FCAS Raise Total"
          value={data.fcas_raise_total_mw.toLocaleString()}
          unit="MW dispatched"
          icon={<Shield size={22} />}
          color="text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          title="FCAS Lower Total"
          value={data.fcas_lower_total_mw.toLocaleString()}
          unit="MW dispatched"
          icon={<Shield size={22} />}
          color="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Inertia table + chart side by side on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InertiaTable records={data.inertia_records} />
        <InertiaChart records={data.inertia_records} />
      </div>

      {/* Synchronous condensers */}
      <SynconTable condensers={data.synchronous_condensers} />

      {/* FCAS dispatch */}
      <FcasTable records={data.fcas_dispatch} />

      {/* Footer note */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center pb-2">
        Lowest inertia headroom region: <span className="font-medium">{data.lowest_inertia_region}</span>
        {' '} · Total SynCon capacity: <span className="font-medium">{data.total_syncon_capacity_mvar.toLocaleString()} MVAr</span>
        {' '} · Data refreshes every 30 seconds
      </p>
    </div>
  )
}
