// ---------------------------------------------------------------------------
// Sprint 79a — NEM Interconnector Congestion & Constraint Analytics
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import {
  GitMerge,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Activity,
  DollarSign,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getInterconnectorCongestionDashboard,
} from '../api/client'
import type {
  ICCDashboard,
  ICCInterconnectorRecord,
  ICCCongestionRecord,
  ICCConstraintRecord,
  ICCSRARecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers & constants
// ---------------------------------------------------------------------------

const IC_COLORS: Record<string, string> = {
  'VIC1-NSW1':     '#3b82f6',
  'QNI':           '#22c55e',
  'V-SA':          '#f59e0b',
  'Heywood':       '#ef4444',
  'Murraylink':    '#06b6d4',
  'Basslink':      '#a78bfa',
  'EnergyConnect': '#fb923c',
}

const REGION_COLORS: Record<string, string> = {
  nsw1: '#3b82f6',
  qld1: '#22c55e',
  vic1: '#a78bfa',
  sa1:  '#f59e0b',
  tas1: '#06b6d4',
}

const UPGRADE_BADGE: Record<string, string> = {
  OPERATING:           'bg-emerald-900 text-emerald-300 border border-emerald-700',
  UPGRADE_PLANNED:     'bg-amber-900 text-amber-300 border border-amber-700',
  UPGRADE_IN_PROGRESS: 'bg-blue-900 text-blue-300 border border-blue-700',
  PROPOSED:            'bg-gray-700 text-gray-300 border border-gray-600',
}

const REASON_BADGE: Record<string, string> = {
  THERMAL:          'bg-red-900 text-red-300 border border-red-700',
  VOLTAGE:          'bg-orange-900 text-orange-300 border border-orange-700',
  STABILITY:        'bg-amber-900 text-amber-300 border border-amber-700',
  N_1_CONTINGENCY:  'bg-purple-900 text-purple-300 border border-purple-700',
}

function fmtNum(n: number, d = 0) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtAud(n: number, d = 1) {
  return `$${fmtNum(n, d)}m`
}

function UpgradeBadge({ status }: { status: string }) {
  const cls = UPGRADE_BADGE[status] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function ReasonBadge({ reason }: { reason: string }) {
  const key = reason.replace(/-/g, '_')
  const cls = REASON_BADGE[key] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {reason.replace(/_/g, ' ')}
    </span>
  )
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
          {trend === 'up'      && <TrendingUp   size={12} className="text-green-400" />}
          {trend === 'down'    && <TrendingDown  size={12} className="text-red-400"   />}
          {trend === 'neutral' && <AlertTriangle size={12} className="text-amber-400" />}
          <span>{sub}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Utilisation bar helper
// ---------------------------------------------------------------------------

function UtilBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? '#ef4444' : pct >= 50 ? '#f59e0b' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-300 w-12 text-right">{fmtNum(pct, 1)}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section: Interconnector Overview
// ---------------------------------------------------------------------------

function InterconnectorOverviewSection({ data }: { data: ICCInterconnectorRecord[] }) {
  return (
    <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700 flex items-center gap-2">
        <GitMerge size={18} className="text-blue-400" />
        <h2 className="text-white font-semibold text-sm">Interconnector Overview</h2>
        <span className="ml-auto text-xs text-gray-500">{data.length} interconnectors</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Route</th>
              <th className="px-4 py-3 text-right">Import MW</th>
              <th className="px-4 py-3 text-right">Export MW</th>
              <th className="px-4 py-3 text-right">Flow MW</th>
              <th className="px-4 py-3 text-left w-40">Utilisation</th>
              <th className="px-4 py-3 text-right">Binding hrs/yr</th>
              <th className="px-4 py-3 text-right">Congestion $m</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr
                key={r.interconnector_id}
                className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${
                  i % 2 === 0 ? '' : 'bg-gray-800/50'
                }`}
              >
                <td className="px-4 py-3">
                  <IcBadge ic={r.interconnector_id} />
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {r.from_region} → {r.to_region}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{fmtNum(r.import_limit_mw)}</td>
                <td className="px-4 py-3 text-right text-gray-300">{fmtNum(r.export_limit_mw)}</td>
                <td className="px-4 py-3 text-right text-white font-medium">{fmtNum(r.current_flow_mw)}</td>
                <td className="px-4 py-3">
                  <UtilBar pct={r.utilisation_pct} />
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{fmtNum(r.binding_hours_per_year)}</td>
                <td className="px-4 py-3 text-right text-amber-400 font-medium">
                  {fmtAud(r.congestion_cost_annual_m)}
                </td>
                <td className="px-4 py-3">
                  <UpgradeBadge status={r.upgrade_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Congestion History (binding hours by interconnector/month)
// ---------------------------------------------------------------------------

function buildCongestionChartData(congestion: ICCCongestionRecord[]) {
  const months = [...new Set(congestion.map(r => r.month))].sort()
  return months.map(month => {
    const row: Record<string, number | string> = { month: month.replace('2024-', '') }
    congestion.filter(r => r.month === month).forEach(r => {
      row[r.interconnector_id] = r.binding_hours
    })
    return row
  })
}

const IC_IDS = ['VIC1-NSW1', 'QNI', 'V-SA', 'Heywood', 'Murraylink', 'Basslink', 'EnergyConnect']

function CongestionHistorySection({ congestion }: { congestion: ICCCongestionRecord[] }) {
  const chartData = buildCongestionChartData(congestion)

  return (
    <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700 flex items-center gap-2">
        <Activity size={18} className="text-amber-400" />
        <h2 className="text-white font-semibold text-sm">Binding Hours by Interconnector (Monthly 2024)</h2>
        <span className="ml-auto text-xs text-gray-500">{congestion.length} records</span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Binding Hours', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            {IC_IDS.map(ic => (
              <Line
                key={ic}
                type="monotone"
                dataKey={ic}
                stroke={IC_COLORS[ic] ?? '#9ca3af'}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Regional Price Spread
// ---------------------------------------------------------------------------

function buildSpreadChartData(spreads: { date: string; hour: number; nsw1_price: number; qld1_price: number; vic1_price: number; sa1_price: number; tas1_price: number; max_spread: number }[]) {
  // Show SA-spike day only (first 20 records are 2024-01-17)
  const spikeDay = spreads.filter(r => r.date === '2024-01-17').sort((a, b) => a.hour - b.hour)
  return spikeDay.map(r => ({
    hour: `${String(r.hour).padStart(2, '0')}:00`,
    NSW: r.nsw1_price,
    QLD: r.qld1_price,
    VIC: r.vic1_price,
    SA:  r.sa1_price,
    TAS: r.tas1_price,
    Spread: r.max_spread,
  }))
}

function RegionalSpreadSection({ spreads }: { spreads: Parameters<typeof buildSpreadChartData>[0] }) {
  const chartData = buildSpreadChartData(spreads)

  return (
    <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700 flex items-center gap-2">
        <Zap size={18} className="text-yellow-400" />
        <h2 className="text-white font-semibold text-sm">Regional Spot Prices — SA Congestion Event (17 Jan 2024)</h2>
        <span className="ml-auto text-xs text-gray-500">All 5 NEM regions</span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: '$/MWh', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(val: number) => [`$${val.toFixed(2)}/MWh`]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            {(['NSW', 'QLD', 'VIC', 'SA', 'TAS'] as const).map((region, idx) => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={Object.values(REGION_COLORS)[idx]}
                strokeWidth={region === 'SA' ? 3 : 1.5}
                dot={false}
                strokeDasharray={region === 'SA' ? undefined : '4 2'}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Constraint Register
// ---------------------------------------------------------------------------

function ConstraintRegisterSection({ constraints }: { constraints: ICCConstraintRecord[] }) {
  return (
    <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700 flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-400" />
        <h2 className="text-white font-semibold text-sm">Network Constraint Register</h2>
        <span className="ml-auto text-xs text-gray-500">{constraints.length} constraints</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Constraint</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Interconnectors</th>
              <th className="px-4 py-3 text-right">Binding %</th>
              <th className="px-4 py-3 text-right">Shadow Price $/MWh</th>
              <th className="px-4 py-3 text-right">Annual Cost $m</th>
              <th className="px-4 py-3 text-right">Redispatch $m</th>
            </tr>
          </thead>
          <tbody>
            {constraints.map((c, i) => (
              <tr
                key={c.constraint_id}
                className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${
                  i % 2 === 0 ? '' : 'bg-gray-800/50'
                }`}
              >
                <td className="px-4 py-3">
                  <div className="text-white font-medium text-xs">{c.constraint_id}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{c.constraint_name}</div>
                </td>
                <td className="px-4 py-3">
                  <ReasonBadge reason={c.reason} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.interconnectors_affected.map(ic => (
                      <IcBadge key={ic} ic={ic} />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-medium ${c.binding_frequency_pct >= 6 ? 'text-red-400' : c.binding_frequency_pct >= 4 ? 'text-amber-400' : 'text-gray-300'}`}>
                    {fmtNum(c.binding_frequency_pct, 1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-300">${fmtNum(c.avg_shadow_price, 1)}</td>
                <td className="px-4 py-3 text-right text-amber-400 font-medium">{fmtAud(c.annual_cost_m)}</td>
                <td className="px-4 py-3 text-right text-red-400">{fmtAud(c.redispatch_cost_m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: SRA Auction Results
// ---------------------------------------------------------------------------

function buildSraChartData(sra: ICCSRARecord[]) {
  return sra.map(r => ({
    label: `${r.interconnector_id} ${r.auction_quarter}`,
    ic: r.interconnector_id,
    quarter: r.auction_quarter,
    clearing_price: r.clearing_price,
    revenue: r.total_revenue_m,
    sold_pct: Math.round((r.sra_units_sold / (r.sra_units_offered || 1)) * 100),
  }))
}

function SRASection({ sra }: { sra: ICCSRARecord[] }) {
  const chartData = buildSraChartData(sra)

  return (
    <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700 flex items-center gap-2">
        <DollarSign size={18} className="text-emerald-400" />
        <h2 className="text-white font-semibold text-sm">SRA Auction Clearing Prices (Q3–Q4 2024)</h2>
        <span className="ml-auto text-xs text-gray-500">{sra.length} auctions</span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 8, right: 24, bottom: 60, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: '$/MWh', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`$${val.toFixed(2)}/MWh`, 'Clearing Price']}
            />
            <Bar dataKey="clearing_price" name="Clearing Price $/MWh" fill="#22c55e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="px-6 pb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase tracking-wide">
                <th className="py-2 text-left">Interconnector</th>
                <th className="py-2 text-left">Quarter</th>
                <th className="py-2 text-right">Offered</th>
                <th className="py-2 text-right">Sold</th>
                <th className="py-2 text-right">Sold %</th>
                <th className="py-2 text-right">Clear $/MWh</th>
                <th className="py-2 text-right">Revenue $m</th>
                <th className="py-2 text-left">Buyer Type</th>
              </tr>
            </thead>
            <tbody>
              {sra.map((r, i) => (
                <tr
                  key={`${r.interconnector_id}-${r.auction_quarter}`}
                  className={`border-b border-gray-700/40 hover:bg-gray-700/20 ${i % 2 === 0 ? '' : 'bg-gray-800/40'}`}
                >
                  <td className="py-2"><IcBadge ic={r.interconnector_id} /></td>
                  <td className="py-2 text-gray-300 pl-1">{r.auction_quarter}</td>
                  <td className="py-2 text-right text-gray-400">{fmtNum(r.sra_units_offered)}</td>
                  <td className="py-2 text-right text-gray-300">{fmtNum(r.sra_units_sold)}</td>
                  <td className="py-2 text-right text-emerald-400">
                    {Math.round((r.sra_units_sold / (r.sra_units_offered || 1)) * 100)}%
                  </td>
                  <td className="py-2 text-right text-white font-medium">${fmtNum(r.clearing_price, 2)}</td>
                  <td className="py-2 text-right text-amber-400">{fmtAud(r.total_revenue_m)}</td>
                  <td className="py-2 pl-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 border border-gray-600">
                      {r.buyer_type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function InterconnectorCongestionAnalytics() {
  const [data, setData] = useState<ICCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = () => {
    setLoading(true)
    setError(null)
    getInterconnectorCongestionDashboard()
      .then(d => {
        setData(d)
        setLastRefresh(new Date())
      })
      .catch(e => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitMerge size={22} className="text-blue-400" />
            <div>
              <h1 className="text-lg font-bold text-white">NEM Interconnector Congestion & Constraint Analytics</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Binding constraint hours · Regional price separation · SRA auctions
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        {/* Loading / error */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
            <RefreshCw size={20} className="animate-spin" />
            <span>Loading congestion data…</span>
          </div>
        )}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl px-6 py-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <KpiCard
                label="Total Binding Hours/yr"
                value={fmtNum(Number(data.summary.total_binding_hours_annual))}
                sub="All NEM interconnectors"
                trend="neutral"
                icon={<Activity size={16} />}
              />
              <KpiCard
                label="Total Congestion Cost"
                value={`$${fmtNum(Number(data.summary.total_congestion_cost_m))}m`}
                sub="Annual network rent"
                trend="up"
                icon={<DollarSign size={16} />}
              />
              <KpiCard
                label="Most Congested"
                value={String(data.summary.most_congested)}
                sub="Highest binding frequency"
                trend="neutral"
                icon={<GitMerge size={16} />}
              />
              <KpiCard
                label="Avg Peak Price Spread"
                value={`$${fmtNum(Number(data.summary.avg_max_spread_peak), 1)}/MWh`}
                sub="Max-min regional spread"
                trend="up"
                icon={<Zap size={16} />}
              />
              <KpiCard
                label="SRA Total Revenue"
                value={`$${fmtNum(Number(data.summary.sra_total_revenue_m), 1)}m`}
                sub="H2 2024 auction proceeds"
                trend="down"
                icon={<TrendingDown size={16} />}
              />
              <KpiCard
                label="Constraint Cost"
                value={`$${fmtNum(Number(data.summary.constraint_cost_m))}m`}
                sub="10 binding constraints"
                trend="up"
                icon={<AlertTriangle size={16} />}
              />
            </div>

            {/* Interconnector Overview */}
            <InterconnectorOverviewSection data={data.interconnectors} />

            {/* Congestion History */}
            <CongestionHistorySection congestion={data.congestion} />

            {/* Regional Price Spread */}
            <RegionalSpreadSection spreads={data.regional_spreads} />

            {/* Constraint Register */}
            <ConstraintRegisterSection constraints={data.constraints} />

            {/* SRA Auctions */}
            <SRASection sra={data.sra_auctions} />
          </>
        )}
      </div>
    </div>
  )
}
