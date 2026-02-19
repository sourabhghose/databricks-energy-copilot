// ---------------------------------------------------------------------------
// Sprint 46a — Transmission Congestion & Nodal Pricing Analytics
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import {
  Network,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts'
import { api } from '../api/client'
import type {
  TransmissionCongestionDashboard,
  ConstraintBindingRecord,
  CongestionRentRecord,
  CongestionHeatmapRecord,
  NodalPriceRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const IC_COLORS: Record<string, string> = {
  'VIC1-NSW1': '#3b82f6',   // blue
  'QLD1-NSW1': '#22c55e',   // green
  'SA1-VIC1':  '#f59e0b',   // amber
  'TAS1-VIC1': '#06b6d4',   // cyan
}

const CAUSE_BADGE: Record<string, string> = {
  THERMAL:        'bg-red-900 text-red-300 border border-red-700',
  STABILITY:      'bg-orange-900 text-orange-300 border border-orange-700',
  VOLTAGE:        'bg-amber-900 text-amber-300 border border-amber-700',
  NETWORK_OUTAGE: 'bg-gray-700 text-gray-300 border border-gray-600',
}

const DIR_BADGE: Record<string, string> = {
  IMPORT: 'bg-blue-900 text-blue-300 border border-blue-700',
  EXPORT: 'bg-purple-900 text-purple-300 border border-purple-700',
}

function fmtNum(n: number, d = 0) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtAud(n: number, d = 1) {
  return `$${fmtNum(n, d)}`
}

function IcBadge({ ic }: { ic: string }) {
  const color = IC_COLORS[ic] ?? '#9ca3af'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold border"
      style={{ color, borderColor: color, backgroundColor: `${color}22` }}
    >
      {ic}
    </span>
  )
}

function CauseBadge({ cause }: { cause: string }) {
  const cls = CAUSE_BADGE[cause] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {cause.replace('_', ' ')}
    </span>
  )
}

function DirBadge({ dir }: { dir: string }) {
  const cls = DIR_BADGE[dir] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {dir}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
}

function KpiCard({ label, value, sub, trend, icon }: KpiProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-2 border border-gray-700">
      <div className="flex items-center justify-between text-gray-400 text-xs font-medium uppercase tracking-wide">
        <span>{label}</span>
        {icon && <span className="text-gray-500">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && (
        <div className="flex items-center gap-1 text-xs text-gray-400">
          {trend === 'up' && <TrendingUp size={12} className="text-green-400" />}
          {trend === 'down' && <TrendingDown size={12} className="text-red-400" />}
          {trend === 'neutral' && <AlertTriangle size={12} className="text-amber-400" />}
          <span>{sub}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Congestion Heatmap Chart
// ---------------------------------------------------------------------------

function buildHeatmapChartData(records: CongestionHeatmapRecord[]) {
  const months = [...new Set(records.map(r => r.month))].sort()
  return months.map(month => {
    const row: Record<string, number | string> = { month }
    records.filter(r => r.month === month).forEach(r => {
      row[`${r.interconnector}_util`] = r.utilisation_pct
      row[`${r.interconnector}_sep`] = r.avg_price_separation
    })
    // Average price separation across interconnectors for the month
    const monthRecs = records.filter(r => r.month === month)
    row['avg_sep'] = monthRecs.reduce((s, r) => s + r.avg_price_separation, 0) / (monthRecs.length || 1)
    return row
  })
}

interface HeatmapTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function HeatmapTooltip({ active, payload, label }: HeatmapTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white font-mono">{fmtNum(p.value, 1)}{p.name.includes('sep') ? ' $/MWh' : '%'}</span>
        </div>
      ))}
    </div>
  )
}

function CongestionHeatmapChart({ data }: { data: CongestionHeatmapRecord[] }) {
  const chartData = buildHeatmapChartData(data)
  const interconnectors = Object.keys(IC_COLORS)

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold text-sm mb-1">Interconnector Utilisation Heatmap</h3>
      <p className="text-gray-400 text-xs mb-4">
        Monthly utilisation % per interconnector (bars) with average price separation $/MWh (line)
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 60, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis
            yAxisId="util"
            domain={[0, 100]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Utilisation %', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            yAxisId="sep"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Price Sep $/MWh', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }}
          />
          <Tooltip content={<HeatmapTooltip />} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {interconnectors.map(ic => (
            <Bar
              key={`${ic}_util`}
              yAxisId="util"
              dataKey={`${ic}_util`}
              name={`${ic} Util%`}
              fill={IC_COLORS[ic]}
              opacity={0.75}
              radius={[2, 2, 0, 0]}
            />
          ))}
          <Line
            yAxisId="sep"
            type="monotone"
            dataKey="avg_sep"
            name="Avg Price Sep"
            stroke="#f472b6"
            strokeWidth={2}
            dot={{ fill: '#f472b6', r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nodal Price Decomposition Chart
// ---------------------------------------------------------------------------

interface NodalTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function NodalTooltip({ active, payload, label }: NodalTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white font-mono">${fmtNum(p.value, 1)}/MWh</span>
        </div>
      ))}
    </div>
  )
}

function NodalPriceChart({ data }: { data: NodalPriceRecord[] }) {
  const chartData = data.map(n => ({
    name: n.node_name.replace(' Power Station', '').replace(' Load', '').replace(' Load Node', '').replace(' Metro', '').substring(0, 18),
    Energy: n.energy_component,
    Loss: n.loss_component,
    Congestion: n.congestion_component,
    region: n.region,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold text-sm mb-1">Nodal LMP Decomposition</h3>
      <p className="text-gray-400 text-xs mb-4">
        Locational Marginal Price = Energy + Loss + Congestion components ($/MWh, 2024 avg)
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 64 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '$/MWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip content={<NodalTooltip />} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="Energy" stackId="lmp" fill="#3b82f6" name="Energy" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Loss" stackId="lmp" fill="#22c55e" name="Loss" />
          <Bar dataKey="Congestion" stackId="lmp" fill="#f59e0b" name="Congestion" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Constraint Binding Table
// ---------------------------------------------------------------------------

function ConstraintTable({ data }: { data: ConstraintBindingRecord[] }) {
  const sorted = [...data].sort((a, b) => b.binding_pct - a.binding_pct)
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-700">
        <h3 className="text-white font-semibold text-sm">NEM Constraint Binding Frequency (2024)</h3>
        <p className="text-gray-400 text-xs mt-0.5">Ranked by binding % — shadow prices and congestion rent per constraint</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Constraint</th>
              <th className="text-left px-4 py-3">Interconnector</th>
              <th className="text-left px-4 py-3">Direction</th>
              <th className="text-right px-4 py-3">Binding Hrs</th>
              <th className="text-right px-4 py-3">Binding %</th>
              <th className="text-right px-4 py-3">Avg Shadow</th>
              <th className="text-right px-4 py-3">Max Shadow</th>
              <th className="text-right px-4 py-3">Cong. Rent</th>
              <th className="text-left px-4 py-3">Primary Cause</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr
                key={c.constraint_id}
                className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'}`}
              >
                <td className="px-4 py-3 text-gray-200 font-medium max-w-xs">
                  <div className="truncate" title={c.constraint_name}>{c.constraint_name}</div>
                  <div className="text-gray-500 text-xs mt-0.5 font-mono">{c.constraint_id}</div>
                </td>
                <td className="px-4 py-3"><IcBadge ic={c.interconnector} /></td>
                <td className="px-4 py-3"><DirBadge dir={c.direction} /></td>
                <td className="px-4 py-3 text-right text-gray-200 font-mono">{fmtNum(c.binding_hours_2024)}</td>
                <td className="px-4 py-3 text-right font-mono">
                  <span className={c.binding_pct >= 30 ? 'text-red-400' : c.binding_pct >= 15 ? 'text-amber-400' : 'text-green-400'}>
                    {fmtNum(c.binding_pct, 1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-200 font-mono">{fmtAud(c.avg_shadow_price, 1)}</td>
                <td className="px-4 py-3 text-right text-red-300 font-mono">{fmtAud(c.max_shadow_price, 0)}</td>
                <td className="px-4 py-3 text-right text-amber-300 font-mono">${fmtNum(c.congestion_rent_m_aud, 1)}M</td>
                <td className="px-4 py-3"><CauseBadge cause={c.primary_cause} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Congestion Rent Distribution Table
// ---------------------------------------------------------------------------

function CongestionRentTable({ data }: { data: CongestionRentRecord[] }) {
  const interconnectors = Object.keys(IC_COLORS)
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']

  // Flatten into rows grouped by interconnector
  const rows = interconnectors.flatMap(ic =>
    quarters.map(q => data.find(r => r.interconnector === ic && r.quarter === q)).filter(Boolean) as CongestionRentRecord[]
  )

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-700">
        <h3 className="text-white font-semibold text-sm">Congestion Rent Distribution (2024)</h3>
        <p className="text-gray-400 text-xs mt-0.5">Total rent, SREC allocation, TNSP retained and hedging value per interconnector-quarter</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Interconnector</th>
              <th className="text-left px-4 py-3">Quarter</th>
              <th className="text-right px-4 py-3">Total Rent ($M)</th>
              <th className="text-right px-4 py-3">SREC ($M)</th>
              <th className="text-right px-4 py-3">TNSP Retained ($M)</th>
              <th className="text-right px-4 py-3">Hedging Value ($M)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.interconnector}-${r.quarter}`}
                className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'}`}
              >
                <td className="px-4 py-3"><IcBadge ic={r.interconnector} /></td>
                <td className="px-4 py-3 text-gray-300">{r.year} {r.quarter}</td>
                <td className="px-4 py-3 text-right text-amber-300 font-mono font-semibold">${fmtNum(r.total_rent_m_aud, 1)}</td>
                <td className="px-4 py-3 text-right text-blue-300 font-mono">${fmtNum(r.srec_allocated_m_aud, 1)}</td>
                <td className="px-4 py-3 text-right text-green-300 font-mono">${fmtNum(r.tnsp_retained_m_aud, 1)}</td>
                <td className="px-4 py-3 text-right text-purple-300 font-mono">${fmtNum(r.hedging_value_m_aud, 1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-600 bg-gray-900">
              <td className="px-4 py-3 text-gray-300 font-semibold" colSpan={2}>All Interconnectors Total</td>
              <td className="px-4 py-3 text-right text-amber-200 font-mono font-bold">
                ${fmtNum(rows.reduce((s, r) => s + r.total_rent_m_aud, 0), 1)}
              </td>
              <td className="px-4 py-3 text-right text-blue-200 font-mono font-bold">
                ${fmtNum(rows.reduce((s, r) => s + r.srec_allocated_m_aud, 0), 1)}
              </td>
              <td className="px-4 py-3 text-right text-green-200 font-mono font-bold">
                ${fmtNum(rows.reduce((s, r) => s + r.tnsp_retained_m_aud, 0), 1)}
              </td>
              <td className="px-4 py-3 text-right text-purple-200 font-mono font-bold">
                ${fmtNum(rows.reduce((s, r) => s + r.hedging_value_m_aud, 0), 1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TransmissionCongestion() {
  const [dashboard, setDashboard] = useState<TransmissionCongestionDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getTransmissionCongestionDashboard()
      setDashboard(data)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-900 rounded-lg">
            <Network size={24} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Transmission Congestion &amp; Nodal Pricing Analytics</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              NEM constraint binding frequency, locational marginal pricing (LMP) decomposition, congestion rent distribution and interconnector utilisation heatmap
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Updated {lastRefresh.toLocaleTimeString('en-AU')}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !dashboard && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-800 rounded-xl p-5 h-28 animate-pulse border border-gray-700" />
          ))}
        </div>
      )}

      {dashboard && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Total Congestion Rent 2024"
              value={`$${fmtNum(dashboard.total_congestion_rent_m_aud, 1)}M`}
              sub="Across all major NEM interconnectors"
              trend="neutral"
              icon={<Zap size={16} />}
            />
            <KpiCard
              label="Most Constrained Interconnector"
              value={dashboard.most_constrained_interconnector}
              sub="Highest binding % in 2024"
              trend="down"
              icon={<Network size={16} />}
            />
            <KpiCard
              label="Average Binding %"
              value={`${fmtNum(dashboard.avg_binding_pct, 1)}%`}
              sub="Avg across monitored constraints"
              trend={dashboard.avg_binding_pct > 20 ? 'down' : 'neutral'}
              icon={<TrendingUp size={16} />}
            />
            <KpiCard
              label="Peak Shadow Price"
              value={fmtAud(dashboard.peak_shadow_price, 0)}
              sub="$/MWh — maximum recorded shadow price"
              trend="down"
              icon={<AlertTriangle size={16} />}
            />
          </div>

          {/* Heatmap Chart */}
          <div className="mb-6">
            <CongestionHeatmapChart data={dashboard.congestion_heatmap} />
          </div>

          {/* Constraint Binding Table */}
          <div className="mb-6">
            <ConstraintTable data={dashboard.constraint_binding} />
          </div>

          {/* Nodal Price Decomposition Chart */}
          <div className="mb-6">
            <NodalPriceChart data={dashboard.nodal_prices} />
          </div>

          {/* Congestion Rent Distribution Table */}
          <div className="mb-6">
            <CongestionRentTable data={dashboard.congestion_rent} />
          </div>

          {/* Interconnector colour legend */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Interconnector Legend</h4>
            <div className="flex flex-wrap gap-4">
              {Object.entries(IC_COLORS).map(([ic, color]) => (
                <div key={ic} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-gray-300 text-xs">{ic}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
