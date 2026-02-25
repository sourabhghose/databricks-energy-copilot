import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Droplets, TrendingUp, Clock, DollarSign } from 'lucide-react'
import { getPHSADashboard, PHSADashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  iconBg: string
}

function KpiCard({ label, value, sub, icon, iconBg }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl shadow p-5 flex items-center gap-4">
      <div className={`${iconBg} rounded-lg p-3 shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const CHART_COLOURS = {
  existing: '#22c55e',
  construction: '#f59e0b',
  planned: '#3b82f6',
  pumping: '#ef4444',
  generating: '#22c55e',
  efficiency: '#8b5cf6',
  arbitrage: '#3b82f6',
  fcas: '#f59e0b',
  inertia: '#22c55e',
  capacity: '#ec4899',
}

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------

function statusChip(status: string) {
  const colours: Record<string, string> = {
    OPERATING: 'bg-green-900 text-green-200',
    CONSTRUCTION: 'bg-amber-900 text-amber-200',
    APPROVED: 'bg-blue-900 text-blue-200',
    FEASIBILITY: 'bg-purple-900 text-purple-200',
  }
  const cls = colours[status] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status}
    </span>
  )
}

function damTypeChip(damType: string) {
  const colours: Record<string, string> = {
    CLOSED_LOOP: 'bg-cyan-900 text-cyan-200',
    OPEN_LOOP: 'bg-teal-900 text-teal-200',
    SEAWATER: 'bg-sky-900 text-sky-200',
    UNDERGROUND: 'bg-indigo-900 text-indigo-200',
  }
  const cls = colours[damType] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {damType.replace('_', ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PumpedHydroStorageAnalytics() {
  const [data, setData] = useState<PHSADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPHSADashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading Pumped Hydro Storage Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400">Error: {error ?? 'No data'}</p>
      </div>
    )
  }

  // ---- KPI calculations ----
  const totalCapacityGW = data.projects.reduce((s, p) => s + p.capacity_mw, 0) / 1000
  const weightedDuration =
    data.projects.reduce((s, p) => s + p.storage_hours * p.capacity_mw, 0) /
    data.projects.reduce((s, p) => s + p.capacity_mw, 0)
  const pipelineCount = data.projects.filter((p) => p.status !== 'OPERATING').length
  const totalInvestmentB = data.projects.reduce((s, p) => s + p.investment_b_aud, 0)

  // ---- Bar chart data: capacity by project ----
  const capacityBarData = data.projects.map((p) => ({
    name: p.project_name.length > 18 ? p.project_name.slice(0, 16) + '..' : p.project_name,
    existing: p.status === 'OPERATING' ? p.capacity_mw : 0,
    construction: p.status === 'CONSTRUCTION' ? p.capacity_mw : 0,
    planned: ['APPROVED', 'FEASIBILITY'].includes(p.status) ? p.capacity_mw : 0,
  }))

  // ---- Area chart data: daily profile ----
  const profileData = data.daily_profile.map((dp) => ({
    hour: `${String(dp.hour).padStart(2, '0')}:00`,
    pumping_mw: dp.pumping_mw,
    generating_mw: dp.generating_mw,
  }))

  // ---- Line chart: efficiency trend ----
  const efficiencyData = data.operations.map((op) => ({
    name: op.project_name.length > 18 ? op.project_name.slice(0, 16) + '..' : op.project_name,
    efficiency: op.round_trip_efficiency_pct,
  }))

  // ---- Composed chart: revenue streams ----
  const revenueData = data.revenue.map((r) => ({
    name: r.project_name.length > 18 ? r.project_name.slice(0, 16) + '..' : r.project_name,
    arbitrage: r.energy_arbitrage_m_aud,
    fcas: r.fcas_m_aud,
    inertia: r.inertia_m_aud,
    capacity: r.capacity_m_aud,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Droplets className="text-cyan-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Pumped Hydro Energy Storage Analytics</h1>
          <p className="text-sm text-gray-400">PHES project register, operations &amp; revenue -- Sprint 168c</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total PHES Capacity"
          value={`${fmt(totalCapacityGW, 1)} GW`}
          sub="All projects combined"
          icon={<Droplets size={22} className="text-cyan-300" />}
          iconBg="bg-cyan-900/60"
        />
        <KpiCard
          label="Storage Duration (weighted)"
          value={`${fmt(weightedDuration, 1)} hrs`}
          sub="Capacity-weighted average"
          icon={<Clock size={22} className="text-amber-300" />}
          iconBg="bg-amber-900/60"
        />
        <KpiCard
          label="Pipeline Projects"
          value={String(pipelineCount)}
          sub="Construction / Approved / Feasibility"
          icon={<TrendingUp size={22} className="text-blue-300" />}
          iconBg="bg-blue-900/60"
        />
        <KpiCard
          label="Total Investment"
          value={`$${fmt(totalInvestmentB, 1)}B AUD`}
          sub="Aggregate capex estimate"
          icon={<DollarSign size={22} className="text-green-300" />}
          iconBg="bg-green-900/60"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart: capacity by project */}
        <div className="bg-gray-800 rounded-xl shadow p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">PHES Capacity by Project (MW)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={capacityBarData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="existing" stackId="a" fill={CHART_COLOURS.existing} name="Operating" />
              <Bar dataKey="construction" stackId="a" fill={CHART_COLOURS.construction} name="Construction" />
              <Bar dataKey="planned" stackId="a" fill={CHART_COLOURS.planned} name="Planned" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Area chart: daily operation profile */}
        <div className="bg-gray-800 rounded-xl shadow p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Daily Operation Profile (MW)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={profileData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Area type="monotone" dataKey="pumping_mw" stroke={CHART_COLOURS.pumping} fill={CHART_COLOURS.pumping} fillOpacity={0.3} name="Pumping MW" />
              <Area type="monotone" dataKey="generating_mw" stroke={CHART_COLOURS.generating} fill={CHART_COLOURS.generating} fillOpacity={0.3} name="Generating MW" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line chart: round-trip efficiency trend */}
        <div className="bg-gray-800 rounded-xl shadow p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Round-Trip Efficiency % by Project</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={efficiencyData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis domain={[60, 85]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="efficiency" stroke={CHART_COLOURS.efficiency} strokeWidth={2} dot={{ r: 4 }} name="Efficiency %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Composed chart: revenue streams */}
        <div className="bg-gray-800 rounded-xl shadow p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Revenue Streams by Project (M AUD)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={revenueData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="arbitrage" stackId="rev" fill={CHART_COLOURS.arbitrage} name="Energy Arbitrage" />
              <Bar dataKey="fcas" stackId="rev" fill={CHART_COLOURS.fcas} name="FCAS" />
              <Bar dataKey="inertia" stackId="rev" fill={CHART_COLOURS.inertia} name="Inertia" />
              <Bar dataKey="capacity" stackId="rev" fill={CHART_COLOURS.capacity} name="Capacity" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table 1: project register */}
      <div className="bg-gray-800 rounded-xl shadow p-5 overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">PHES Project Register</h2>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="py-2 px-3">Project</th>
              <th className="py-2 px-3">Location</th>
              <th className="py-2 px-3">State</th>
              <th className="py-2 px-3 text-right">Capacity MW</th>
              <th className="py-2 px-3 text-right">Storage hrs</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Dam Type</th>
              <th className="py-2 px-3 text-right">Head m</th>
              <th className="py-2 px-3 text-right">Investment B AUD</th>
            </tr>
          </thead>
          <tbody>
            {data.projects.map((p, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 px-3 font-medium text-white">{p.project_name}</td>
                <td className="py-2 px-3">{p.location}</td>
                <td className="py-2 px-3">{p.state}</td>
                <td className="py-2 px-3 text-right">{fmt(p.capacity_mw)}</td>
                <td className="py-2 px-3 text-right">{fmt(p.storage_hours, 0)}</td>
                <td className="py-2 px-3">{statusChip(p.status)}</td>
                <td className="py-2 px-3">{damTypeChip(p.dam_type)}</td>
                <td className="py-2 px-3 text-right">{fmt(p.head_m)}</td>
                <td className="py-2 px-3 text-right">{fmt(p.investment_b_aud, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table 2: operational performance */}
      <div className="bg-gray-800 rounded-xl shadow p-5 overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Operational Performance</h2>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="py-2 px-3">Project</th>
              <th className="py-2 px-3 text-right">Round-Trip Eff %</th>
              <th className="py-2 px-3 text-right">Cycles / Year</th>
              <th className="py-2 px-3 text-right">Revenue M AUD</th>
              <th className="py-2 px-3 text-right">Capacity Factor %</th>
            </tr>
          </thead>
          <tbody>
            {data.operations.map((op, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 px-3 font-medium text-white">{op.project_name}</td>
                <td className="py-2 px-3 text-right">{fmt(op.round_trip_efficiency_pct, 1)}</td>
                <td className="py-2 px-3 text-right">{fmt(op.cycles_per_year)}</td>
                <td className="py-2 px-3 text-right">{fmt(op.annual_revenue_m_aud, 1)}</td>
                <td className="py-2 px-3 text-right">{fmt(op.capacity_factor_pct, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
