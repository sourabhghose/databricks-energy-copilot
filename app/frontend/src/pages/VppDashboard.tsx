import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  YAxis as YAxisRight,
} from 'recharts'
import { BatteryCharging, Users, Zap, Building2, DollarSign, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import type { VppDashboard as VppDashboardType, VppScheme, VppPerformanceRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TECH_COLOURS: Record<string, string> = {
  SOLAR_BATTERY: '#eab308',
  BATTERY_ONLY: '#22c55e',
  EV: '#3b82f6',
  HEAT_PUMP: '#f97316',
  MIXED: '#a855f7',
}

const TECH_BADGE: Record<string, string> = {
  SOLAR_BATTERY: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  BATTERY_ONLY: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  EV: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  HEAT_PUMP: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  MIXED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

const STATUS_BADGE: Record<string, string> = {
  OPERATING: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  TRIAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  APPROVED: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
}

const SCHEME_COLOURS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']

function fmt(n: number, dec = 0) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtAud(n: number) {
  return '$' + fmt(n, 0)
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  Icon: React.ElementType
  colour: string
}

function KpiCard({ label, value, sub, Icon, colour }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${colour}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CapacityChart — Bar chart of total_capacity_mw per scheme, coloured by tech
// ---------------------------------------------------------------------------

interface CapacityChartProps {
  schemes: VppScheme[]
}

function CapacityChart({ schemes }: CapacityChartProps) {
  const data = schemes.map(s => ({
    name: s.scheme_name.replace(' Virtual Power Plant', ' VPP').replace(' Community', '').slice(0, 20),
    capacity: s.total_capacity_mw,
    tech: s.technology,
    fill: TECH_COLOURS[s.technology] ?? '#94a3b8',
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Capacity by Scheme (MW)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            angle={-40}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" MW" width={60} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(value: number) => [`${fmt(value, 1)} MW`, 'Capacity']}
          />
          <Bar dataKey="capacity" radius={[4, 4, 0, 0]}>
            {data.map((entry, idx) => (
              <rect key={idx} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Technology legend */}
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(TECH_COLOURS).map(([tech, colour]) => (
          <span key={tech} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
            {tech.replace('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SchemesTable
// ---------------------------------------------------------------------------

interface SchemesTableProps {
  schemes: VppScheme[]
}

const TECH_OPTIONS = ['ALL', 'SOLAR_BATTERY', 'BATTERY_ONLY', 'EV', 'HEAT_PUMP', 'MIXED']
const STATE_OPTIONS = ['ALL', 'SA', 'QLD', 'NSW', 'VIC', 'ACT', 'WA', 'TAS', 'NT']

function SchemesTable({ schemes }: SchemesTableProps) {
  const [stateFilter, setStateFilter] = useState('ALL')
  const [techFilter, setTechFilter] = useState('ALL')

  const filtered = schemes.filter(s => {
    if (stateFilter !== 'ALL' && s.state !== stateFilter) return false
    if (techFilter !== 'ALL' && s.technology !== techFilter) return false
    return true
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          VPP Scheme Registrations
        </h3>
        <div className="flex gap-2">
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            {STATE_OPTIONS.map(s => (
              <option key={s} value={s}>{s === 'ALL' ? 'All States' : s}</option>
            ))}
          </select>
          <select
            value={techFilter}
            onChange={e => setTechFilter(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            {TECH_OPTIONS.map(t => (
              <option key={t} value={t}>{t === 'ALL' ? 'All Technologies' : t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {['Scheme Name', 'Operator', 'State', 'Technology', 'Participants', 'Capacity MW', 'Avg Battery kWh', 'NEM', 'FCAS', 'Status', 'Avg Saving/yr'].map(h => (
                <th key={h} className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr
                key={s.scheme_id}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <td className="px-2 py-2 font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">
                  {s.scheme_name}
                </td>
                <td className="px-2 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{s.operator}</td>
                <td className="px-2 py-2 text-gray-600 dark:text-gray-300">{s.state}</td>
                <td className="px-2 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TECH_BADGE[s.technology] ?? 'bg-gray-100 text-gray-700'}`}>
                    {s.technology.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-200">{fmt(s.enrolled_participants)}</td>
                <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-200">{fmt(s.total_capacity_mw, 1)}</td>
                <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-200">{fmt(s.avg_battery_kwh, 1)}</td>
                <td className="px-2 py-2 text-center">
                  {s.nem_registered
                    ? <span className="text-emerald-500 font-bold">✓</span>
                    : <span className="text-red-400">✗</span>}
                </td>
                <td className="px-2 py-2 text-center">
                  {s.fcas_eligible
                    ? <span className="text-emerald-500 font-bold">✓</span>
                    : <span className="text-red-400">✗</span>}
                </td>
                <td className="px-2 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[s.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-200 whitespace-nowrap">
                  {fmtAud(s.avg_annual_saving_aud)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-2 py-6 text-center text-gray-400 dark:text-gray-500">
                  No schemes match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PerformanceChart — 12-month energy trend per scheme + reliability on secondary axis
// ---------------------------------------------------------------------------

interface PerformanceChartProps {
  performance: VppPerformanceRecord[]
}

function PerformanceChart({ performance }: PerformanceChartProps) {
  // Build pivot: month -> { month, [schemeId]: energy_mwh, [schemeId]_rel: reliability }
  const months = Array.from(new Set(performance.map(p => p.month))).sort()
  const schemeIds = Array.from(new Set(performance.map(p => p.scheme_id)))
  const schemeNames: Record<string, string> = {}
  performance.forEach(p => { schemeNames[p.scheme_id] = p.scheme_name })

  const data = months.map(month => {
    const row: Record<string, string | number> = { month }
    schemeIds.forEach(sid => {
      const rec = performance.find(p => p.scheme_id === sid && p.month === month)
      row[sid] = rec ? rec.total_energy_mwh : 0
      row[`${sid}_rel`] = rec ? rec.reliability_pct : 0
    })
    return row
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        12-Month Energy Dispatch Trend (MWh) with Reliability %
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 4, right: 60, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickFormatter={v => v.slice(5)}
          />
          <YAxis
            yAxisId="energy"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            unit=" MWh"
            width={65}
          />
          <YAxisRight
            yAxisId="reliability"
            orientation="right"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            unit="%"
            domain={[85, 100]}
            width={45}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => {
              if (value.endsWith('_rel')) return `${schemeNames[value.replace('_rel', '')] ?? value} Rel%`
              return schemeNames[value] ?? value
            }}
          />
          {schemeIds.map((sid, idx) => (
            <Line
              key={sid}
              yAxisId="energy"
              type="monotone"
              dataKey={sid}
              name={sid}
              stroke={SCHEME_COLOURS[idx % SCHEME_COLOURS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
          {schemeIds.map((sid, idx) => (
            <Line
              key={`${sid}_rel`}
              yAxisId="reliability"
              type="monotone"
              dataKey={`${sid}_rel`}
              name={`${sid}_rel`}
              stroke={SCHEME_COLOURS[idx % SCHEME_COLOURS.length]}
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Solid lines = Energy (MWh, left axis) — Dashed lines = Reliability % (right axis)
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DispatchSummary table
// ---------------------------------------------------------------------------

function DispatchSummary({ dashboard }: { dashboard: VppDashboardType }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Recent Dispatch Events
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {['Scheme', 'Interval', 'Type', 'Trigger', 'Energy (MWh)', 'Participants', 'Revenue', 'Avg Payment'].map(h => (
                <th key={h} className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dashboard.dispatches.slice(0, 10).map((d, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-2 py-2 font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">{d.scheme_name}</td>
                <td className="px-2 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{d.trading_interval.slice(11, 16)}</td>
                <td className="px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 font-medium whitespace-nowrap">
                    {d.dispatch_type}
                  </span>
                </td>
                <td className="px-2 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{d.trigger}</td>
                <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-200">{fmt(d.energy_dispatched_mwh, 2)}</td>
                <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-200">{fmt(d.participants_dispatched)}</td>
                <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-200">{fmtAud(d.revenue_aud)}</td>
                <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-200">{fmtAud(d.avg_participant_payment_aud)}</td>
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

export default function VppDashboard() {
  const [dashboard, setDashboard] = useState<VppDashboardType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const data = await api.getVppDashboard()
      setDashboard(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load VPP data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        <RefreshCw size={20} className="animate-spin mr-2" />
        Loading VPP dashboard…
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      </div>
    )
  }

  if (!dashboard) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BatteryCharging size={24} className="text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Virtual Power Plant (VPP) Performance
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              NEM-registered VPP schemes — dispatch, performance & participant analytics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {dashboard.timestamp}
          </span>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Enrolled Participants"
          value={fmt(dashboard.total_enrolled_participants)}
          sub="across all VPP schemes"
          Icon={Users}
          colour="bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300"
        />
        <KpiCard
          label="Total VPP Capacity"
          value={`${fmt(dashboard.total_vpp_capacity_mw, 1)} MW`}
          sub="aggregate registered capacity"
          Icon={Zap}
          colour="bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300"
        />
        <KpiCard
          label="Active Schemes"
          value={String(dashboard.active_schemes)}
          sub={`of ${dashboard.schemes.length} total registered`}
          Icon={Building2}
          colour="bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300"
        />
        <KpiCard
          label="Revenue YTD"
          value={fmtAud(dashboard.total_revenue_ytd_aud)}
          sub="cumulative dispatch revenue"
          Icon={DollarSign}
          colour="bg-sky-100 text-sky-600 dark:bg-sky-900 dark:text-sky-300"
        />
      </div>

      {/* Capacity Chart */}
      <CapacityChart schemes={dashboard.schemes} />

      {/* Schemes Table */}
      <SchemesTable schemes={dashboard.schemes} />

      {/* Performance Chart */}
      <PerformanceChart performance={dashboard.performance} />

      {/* Dispatch Summary */}
      <DispatchSummary dashboard={dashboard} />
    </div>
  )
}
