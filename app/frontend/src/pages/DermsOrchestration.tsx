// ---------------------------------------------------------------------------
// Sprint 46b — DERMS & DER Orchestration Analytics
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import {
  Layers,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Zap,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'
import type {
  DermsOrchestrationDashboard,
  DerAggregatorRecord,
  DerDispatchEventRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

const MARKET_REG_STYLES: Record<string, string> = {
  VPP:              'bg-green-900 text-green-300 border border-green-700',
  FCAS:             'bg-amber-900 text-amber-300 border border-amber-700',
  DEMAND_RESPONSE:  'bg-blue-900  text-blue-300  border border-blue-700',
  ALL:              'bg-purple-900 text-purple-300 border border-purple-700',
}

const TRIGGER_STYLES: Record<string, string> = {
  PRICE_SPIKE:         'bg-red-900    text-red-300    border border-red-700',
  GRID_FREQUENCY:      'bg-orange-900 text-orange-300 border border-orange-700',
  OPERATOR_INSTRUCTION:'bg-blue-900   text-blue-300   border border-blue-700',
  SCHEDULED:           'bg-gray-700   text-gray-300   border border-gray-600',
}

const GRID_SERVICE_STYLES: Record<string, string> = {
  ENERGY:          'bg-blue-900  text-blue-300  border border-blue-700',
  FCAS_R6:         'bg-amber-900 text-amber-300 border border-amber-700',
  FCAS_R60:        'bg-amber-900 text-amber-300 border border-amber-700',
  DEMAND_RESPONSE: 'bg-green-900 text-green-300 border border-green-700',
}

const DER_TYPE_COLORS: Record<string, string> = {
  ROOFTOP_SOLAR: '#fbbf24',
  HOME_BATTERY:  '#60a5fa',
  EV_CHARGER:    '#4ade80',
  HVAC:          '#a78bfa',
  HOT_WATER:     '#22d3ee',
}

const STATE_LINE_COLORS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#4ade80',
  QLD: '#fbbf24',
  SA:  '#f87171',
  WA:  '#a78bfa',
}

const DER_TYPES = ['ROOFTOP_SOLAR', 'HOME_BATTERY', 'EV_CHARGER', 'HVAC', 'HOT_WATER']
const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA']

function fmtNum(n: number, decimals = 0) {
  return n.toLocaleString('en-AU', { maximumFractionDigits: decimals })
}

function fmtAud(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function accuracyColor(pct: number): string {
  if (pct >= 95) return 'text-green-400'
  if (pct >= 85) return 'text-amber-400'
  return 'text-red-400'
}

function successRateColor(pct: number): string {
  if (pct >= 95) return 'text-green-400'
  if (pct >= 88) return 'text-amber-400'
  return 'text-red-400'
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function Badge({ label, styleMap }: { label: string; styleMap: Record<string, string> }) {
  const cls = styleMap[label] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Cards
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
}

function KpiCard({ label, value, sub, icon }: KpiProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wide">
        {icon && <span className="text-indigo-400">{icon}</span>}
        {label}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DER Portfolio stacked bar chart
// ---------------------------------------------------------------------------

function DerPortfolioChart({ dashboard }: { dashboard: DermsOrchestrationDashboard }) {
  // Build per-state data with each DER type's flexibility
  const data = STATES.map(state => {
    const row: Record<string, unknown> = { state }
    DER_TYPES.forEach(dt => {
      const rec = dashboard.der_portfolio.find(p => p.state === state && p.der_type === dt)
      row[dt] = rec ? rec.potential_flexibility_mw : 0
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-3">
        DER Potential Flexibility by State &amp; Type (MW)
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" width={60} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => [`${fmtNum(v, 1)} MW`]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
            formatter={v => v.replace(/_/g, ' ')}
          />
          {DER_TYPES.map(dt => (
            <Bar key={dt} dataKey={dt} stackId="a" fill={DER_TYPE_COLORS[dt]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Monthly KPI line chart — peak coincidence reduction
// ---------------------------------------------------------------------------

function MonthlyKpiChart({ dashboard }: { dashboard: DermsOrchestrationDashboard }) {
  const months = ['2024-01', '2024-02', '2024-03', '2024-04']
  const data = months.map(month => {
    const row: Record<string, unknown> = { month }
    STATES.forEach(state => {
      const rec = dashboard.kpi_records.find(k => k.month === month && k.state === state)
      row[state] = rec ? rec.peak_coincidence_reduction_mw : 0
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-3">
        Peak Coincidence Reduction by State (MW) — Monthly 2024
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" width={60} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => [`${fmtNum(v, 1)} MW`]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          {STATES.map(state => (
            <Line
              key={state}
              type="monotone"
              dataKey={state}
              stroke={STATE_LINE_COLORS[state]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aggregator Registry Table
// ---------------------------------------------------------------------------

function AggregatorTable({ aggregators }: { aggregators: DerAggregatorRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
          Aggregator Registry
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-2">Aggregator</th>
              <th className="text-left px-4 py-2">State</th>
              <th className="text-left px-4 py-2">DER Types</th>
              <th className="text-right px-4 py-2">Enrolled</th>
              <th className="text-right px-4 py-2">Controllable</th>
              <th className="text-right px-4 py-2">Peak Dispatch (MW)</th>
              <th className="text-left px-4 py-2">Market Reg.</th>
              <th className="text-right px-4 py-2">Response (s)</th>
              <th className="text-right px-4 py-2">Success %</th>
            </tr>
          </thead>
          <tbody>
            {aggregators.map(agg => (
              <tr key={agg.aggregator_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                <td className="px-4 py-2 font-medium text-white">{agg.aggregator_name}</td>
                <td className="px-4 py-2 text-gray-300">{agg.state}</td>
                <td className="px-4 py-2 text-gray-400 text-xs">
                  {agg.der_types.join(', ').replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-2 text-right text-gray-300">{fmtNum(agg.enrolled_devices)}</td>
                <td className="px-4 py-2 text-right text-gray-300">{fmtNum(agg.controllable_devices)}</td>
                <td className="px-4 py-2 text-right text-white font-medium">{fmtNum(agg.peak_dispatch_mw, 1)}</td>
                <td className="px-4 py-2">
                  <Badge label={agg.market_registration} styleMap={MARKET_REG_STYLES} />
                </td>
                <td className="px-4 py-2 text-right text-gray-300">{agg.avg_response_time_sec.toFixed(1)}</td>
                <td className={`px-4 py-2 text-right font-semibold ${successRateColor(agg.dispatch_success_rate_pct)}`}>
                  {agg.dispatch_success_rate_pct.toFixed(1)}%
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
// Dispatch Events Table
// ---------------------------------------------------------------------------

function DispatchEventsTable({ events }: { events: DerDispatchEventRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
          VPP Dispatch Event Log
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-left px-4 py-2">Aggregator</th>
              <th className="text-left px-4 py-2">Trigger</th>
              <th className="text-right px-4 py-2">Requested (MW)</th>
              <th className="text-right px-4 py-2">Delivered (MW)</th>
              <th className="text-right px-4 py-2">Accuracy %</th>
              <th className="text-right px-4 py-2">Duration (min)</th>
              <th className="text-right px-4 py-2">Revenue</th>
              <th className="text-left px-4 py-2">Grid Service</th>
            </tr>
          </thead>
          <tbody>
            {events.map(ev => (
              <tr key={ev.event_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{ev.event_date}</td>
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">{ev.aggregator_name}</td>
                <td className="px-4 py-2">
                  <Badge label={ev.trigger} styleMap={TRIGGER_STYLES} />
                </td>
                <td className="px-4 py-2 text-right text-gray-300">{fmtNum(ev.requested_mw, 1)}</td>
                <td className="px-4 py-2 text-right text-white font-medium">{fmtNum(ev.delivered_mw, 1)}</td>
                <td className={`px-4 py-2 text-right font-semibold ${accuracyColor(ev.response_accuracy_pct)}`}>
                  {ev.response_accuracy_pct.toFixed(1)}%
                </td>
                <td className="px-4 py-2 text-right text-gray-300">{ev.duration_minutes}</td>
                <td className="px-4 py-2 text-right text-emerald-400 font-medium">
                  {fmtAud(ev.market_revenue_aud)}
                </td>
                <td className="px-4 py-2">
                  <Badge label={ev.grid_service} styleMap={GRID_SERVICE_STYLES} />
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
// Main page component
// ---------------------------------------------------------------------------

export default function DermsOrchestration() {
  const [dashboard, setDashboard] = useState<DermsOrchestrationDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(showSpin = false) {
    if (showSpin) setLoading(true)
    setError(null)
    try {
      const data = await api.getDermsOrchestrationDashboard()
      setDashboard(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load DERMS data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-900/50 rounded-lg border border-indigo-700">
            <Layers className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">DERMS &amp; DER Orchestration Analytics</h1>
            <p className="text-sm text-gray-400">
              VPP dispatch, grid flexibility services and behind-the-meter resource orchestration
            </p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700 h-24 animate-pulse" />
          ))}
        </div>
      )}

      {dashboard && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Total Controllable Capacity"
              value={`${fmtNum(dashboard.total_controllable_mw, 1)} MW`}
              sub="Across all registered aggregators"
              icon={<Zap className="w-4 h-4" />}
            />
            <KpiCard
              label="Total Enrolled Devices"
              value={fmtNum(dashboard.total_enrolled_devices)}
              sub="Smart DER devices enrolled in VPP programs"
              icon={<Layers className="w-4 h-4" />}
            />
            <KpiCard
              label="Avg Dispatch Accuracy"
              value={`${dashboard.avg_dispatch_accuracy_pct.toFixed(1)}%`}
              sub="Delivered vs requested across all events"
              icon={<CheckCircle className="w-4 h-4" />}
            />
            <KpiCard
              label="Peak Flexibility"
              value={`${fmtNum(dashboard.peak_flexibility_mw, 1)} MW`}
              sub="Total potential flexibility across portfolio"
              icon={<Zap className="w-4 h-4" />}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
            <DerPortfolioChart dashboard={dashboard} />
            <MonthlyKpiChart dashboard={dashboard} />
          </div>

          {/* Aggregator Registry */}
          <div className="mb-6">
            <AggregatorTable aggregators={dashboard.aggregators} />
          </div>

          {/* Dispatch Events */}
          <div className="mb-6">
            <DispatchEventsTable events={dashboard.dispatch_events} />
          </div>
        </>
      )}
    </div>
  )
}
