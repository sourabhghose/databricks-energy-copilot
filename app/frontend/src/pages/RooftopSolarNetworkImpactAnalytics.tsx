import { useEffect, useState } from 'react'
import { Sun, Zap, TrendingUp, AlertTriangle } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getRooftopSolarNetworkImpactDashboard,
  RSNIDashboard,
  RSNIInstallationRecord,
  RSNIVoltageRecord,
  RSNIHostingCapacityRecord,
  RSNIDuckCurveRecord,
  RSNIExportSchemeRecord,
  RSNIForecastRecord,
} from '../api/client'

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  colour,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Colour maps ───────────────────────────────────────────────────────────────
const STATE_COLOURS: Record<string, string> = {
  SA:  '#ef4444',
  QLD: '#f59e0b',
  NSW: '#3b82f6',
  VIC: '#8b5cf6',
  WA:  '#10b981',
  TAS: '#06b6d4',
  ACT: '#f97316',
  NT:  '#84cc16',
}

const DNSP_COLOURS: Record<string, string> = {
  'SA Power Networks': '#ef4444',
  Energex:             '#f59e0b',
  Ergon:               '#fbbf24',
  Ausgrid:             '#3b82f6',
  Endeavour:           '#60a5fa',
  Essential:           '#93c5fd',
  CitiPower:           '#8b5cf6',
  Powercor:            '#a78bfa',
  'Western Power':     '#10b981',
  TasNetworks:         '#06b6d4',
}

const REGION_COLOURS: Record<string, string> = {
  SA1:   '#ef4444',
  QLD1:  '#f59e0b',
  NSW1:  '#3b82f6',
  VIC1:  '#8b5cf6',
}

// ── Chart 1: Installations by State ───────────────────────────────────────────
function InstallationsByStateChart({ data }: { data: RSNIInstallationRecord[] }) {
  // Aggregate by state
  const byState = data.reduce((acc, r) => {
    if (!acc[r.state]) acc[r.state] = { state: r.state, total_capacity_kw: 0, penetration_rate_pct: [] }
    acc[r.state].total_capacity_kw += r.total_capacity_kw
    acc[r.state].penetration_rate_pct.push(r.penetration_rate_pct)
    return acc
  }, {} as Record<string, { state: string; total_capacity_kw: number; penetration_rate_pct: number[] }>)

  const chartData = Object.values(byState).map(s => ({
    state: s.state,
    total_capacity_mw: Math.round(s.total_capacity_kw / 1000),
    avg_penetration_pct: Math.round(
      s.penetration_rate_pct.reduce((a, b) => a + b, 0) / s.penetration_rate_pct.length * 10
    ) / 10,
  })).sort((a, b) => b.total_capacity_mw - a.total_capacity_mw)

  return (
    <div className="bg-gray-800 rounded-xl p-5 shadow">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Installations by State — Capacity (MW) &amp; Penetration Rate (%)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '%', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#f3f4f6' }} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="total_capacity_mw" name="Total Capacity (MW)" radius={[4, 4, 0, 0]}>
            {chartData.map(entry => (
              <Cell key={entry.state} fill={STATE_COLOURS[entry.state] ?? '#6b7280'} />
            ))}
          </Bar>
          <Line yAxisId="right" type="monotone" dataKey="avg_penetration_pct" name="Avg Penetration (%)" stroke="#fbbf24" strokeWidth={2} dot={{ r: 4, fill: '#fbbf24' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Chart 2: Voltage Issues Over Time ─────────────────────────────────────────
function VoltageIssuesChart({ data }: { data: RSNIVoltageRecord[] }) {
  // Aggregate by month across all DNSPs for a summary view
  const byMonth = data.reduce((acc, r) => {
    const k = r.measurement_date
    if (!acc[k]) acc[k] = { month: k, avg_voltage_pu: [], max_voltage_pu: [], curtailed_kwh: 0 }
    acc[k].avg_voltage_pu.push(r.avg_voltage_pu)
    acc[k].max_voltage_pu.push(r.max_voltage_pu)
    acc[k].curtailed_kwh += r.export_curtailed_kwh
    return acc
  }, {} as Record<string, { month: string; avg_voltage_pu: number[]; max_voltage_pu: number[]; curtailed_kwh: number }>)

  const chartData = Object.values(byMonth)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({
      month: m.month,
      avg_voltage_pu: Math.round(m.avg_voltage_pu.reduce((a, b) => a + b, 0) / m.avg_voltage_pu.length * 10000) / 10000,
      max_voltage_pu: Math.round(m.max_voltage_pu.reduce((a, b) => a + b, 0) / m.max_voltage_pu.length * 10000) / 10000,
      curtailed_kwh: Math.round(m.curtailed_kwh),
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 shadow">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Voltage Issues Over Time — Avg &amp; Max Voltage (p.u.)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={2} />
          <YAxis domain={[1.0, 1.1]} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => v.toFixed(3)} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#f3f4f6' }} formatter={(v: number) => v.toFixed(4)} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Line type="monotone" dataKey="avg_voltage_pu" name="Avg Voltage (p.u.)" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="max_voltage_pu" name="Max Voltage (p.u.)" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 2" />
          {/* 1.06 pu limit reference */}
          <Line type="monotone" dataKey={() => 1.06} name="1.06 p.u. Limit" stroke="#f59e0b" strokeWidth={1} strokeDasharray="6 3" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Chart 3: Hosting Capacity Utilisation ─────────────────────────────────────
function HostingCapacityChart({ data }: { data: RSNIHostingCapacityRecord[] }) {
  const chartData = [...data]
    .sort((a, b) => b.capacity_utilisation_pct - a.capacity_utilisation_pct)
    .slice(0, 15)
    .map(r => ({
      substation_id: r.substation_id,
      capacity_utilisation_pct: r.capacity_utilisation_pct,
      state: r.state,
      over_limit: r.capacity_utilisation_pct > 80,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 shadow">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Hosting Capacity Utilisation — Top 15 Substations (%)</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis type="number" domain={[0, 120]} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} />
          <YAxis type="category" dataKey="substation_id" tick={{ fill: '#9ca3af', fontSize: 10 }} width={75} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#f3f4f6' }} formatter={(v: number) => `${v}%`} />
          <Bar dataKey="capacity_utilisation_pct" name="Utilisation (%)" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={entry.over_limit ? '#ef4444' : '#10b981'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-2">Red = &gt;80% utilisation (upgrade required)</p>
    </div>
  )
}

// ── Chart 4: Duck Curve Evolution ─────────────────────────────────────────────
function DuckCurveChart({ data }: { data: RSNIDuckCurveRecord[] }) {
  // Average across regions by month
  const byMonth = data.reduce((acc, r) => {
    const k = r.month
    if (!acc[k]) acc[k] = { month: k, midday_min_demand_mw: [], evening_ramp_mw_per_hour: [] }
    acc[k].midday_min_demand_mw.push(r.midday_min_demand_mw)
    acc[k].evening_ramp_mw_per_hour.push(r.evening_ramp_mw_per_hour)
    return acc
  }, {} as Record<string, { month: string; midday_min_demand_mw: number[]; evening_ramp_mw_per_hour: number[] }>)

  const chartData = Object.values(byMonth)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({
      month: m.month,
      midday_min_mw: Math.round(m.midday_min_demand_mw.reduce((a, b) => a + b, 0) / m.midday_min_demand_mw.length),
      evening_ramp: Math.round(m.evening_ramp_mw_per_hour.reduce((a, b) => a + b, 0) / m.evening_ramp_mw_per_hour.length),
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 shadow">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Duck Curve Evolution — Midday Min Demand &amp; Evening Ramp (MW)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={2} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#f3f4f6' }} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Line type="monotone" dataKey="midday_min_mw" name="Midday Min Demand (MW)" stroke="#06b6d4" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="evening_ramp" name="Evening Ramp (MW/hr)" stroke="#f97316" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Chart 5: Export Curtailment by Scheme ─────────────────────────────────────
const SCHEME_TYPE_COLOURS: Record<string, string> = {
  'Dynamic Export': '#10b981',
  'Fixed Export':   '#3b82f6',
  'Zero Export':    '#ef4444',
  'Peer-to-Peer':   '#8b5cf6',
}

function ExportCurtailmentChart({ data }: { data: RSNIExportSchemeRecord[] }) {
  const chartData = [...data]
    .sort((a, b) => b.avg_curtailment_pct - a.avg_curtailment_pct)
    .map(r => ({
      scheme: r.scheme_name.length > 22 ? r.scheme_name.slice(0, 22) + '…' : r.scheme_name,
      avg_curtailment_pct: r.avg_curtailment_pct,
      participants_k: Math.round(r.participants / 1000 * 10) / 10,
      scheme_type: r.scheme_type,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 shadow">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Export Curtailment by Scheme — Avg Curtailment (%) &amp; Participants (k)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="scheme" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
          <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Curtailment %', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Participants (k)', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#f3f4f6' }} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="avg_curtailment_pct" name="Avg Curtailment (%)" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={SCHEME_TYPE_COLOURS[entry.scheme_type] ?? '#6b7280'} />
            ))}
          </Bar>
          <Bar yAxisId="right" dataKey="participants_k" name="Participants (k)" fill="#fbbf24" radius={[4, 4, 0, 0]} opacity={0.7} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Chart 6: Projected Growth (Stacked Area) ───────────────────────────────────
function ProjectedGrowthChart({ data }: { data: RSNIForecastRecord[] }) {
  // Build year → { SA, QLD, NSW, VIC }
  const byYear = data.reduce((acc, r) => {
    if (!acc[r.year]) acc[r.year] = { year: r.year, SA: 0, QLD: 0, NSW: 0, VIC: 0 }
    acc[r.year][r.state as 'SA' | 'QLD' | 'NSW' | 'VIC'] = r.projected_capacity_gw
    return acc
  }, {} as Record<number, { year: number; SA: number; QLD: number; NSW: number; VIC: number }>)

  const chartData = Object.values(byYear).sort((a, b) => a.year - b.year)

  return (
    <div className="bg-gray-800 rounded-xl p-5 shadow">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Projected Rooftop Solar Growth 2024–2028 — Capacity (GW) by State</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <defs>
            {['SA', 'QLD', 'NSW', 'VIC'].map(state => (
              <linearGradient key={state} id={`grad-${state}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={STATE_COLOURS[state]} stopOpacity={0.7} />
                <stop offset="95%" stopColor={STATE_COLOURS[state]} stopOpacity={0.1} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'GW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} labelStyle={{ color: '#f3f4f6' }} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {['SA', 'QLD', 'NSW', 'VIC'].map(state => (
            <Area
              key={state}
              type="monotone"
              dataKey={state}
              name={`${state} (GW)`}
              stackId="1"
              stroke={STATE_COLOURS[state]}
              fill={`url(#grad-${state})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RooftopSolarNetworkImpactAnalytics() {
  const [data, setData] = useState<RSNIDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRooftopSolarNetworkImpactDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Rooftop Solar Network Impact data…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data available'}
      </div>
    )
  }

  const summary = data.summary
  const totalSystems = typeof summary.total_rooftop_systems_m === 'number'
    ? summary.total_rooftop_systems_m.toFixed(2)
    : String(summary.total_rooftop_systems_m)
  const totalCapacity = typeof summary.total_rooftop_capacity_gw === 'number'
    ? summary.total_rooftop_capacity_gw.toFixed(1)
    : String(summary.total_rooftop_capacity_gw)
  const avgPenetration = typeof summary.avg_penetration_rate_pct === 'number'
    ? summary.avg_penetration_rate_pct.toFixed(1)
    : String(summary.avg_penetration_rate_pct)
  const avgCurtailment = typeof summary.avg_curtailment_pct === 'number'
    ? summary.avg_curtailment_pct.toFixed(1)
    : String(summary.avg_curtailment_pct)

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sun size={28} className="text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Rooftop Solar Network Impact Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            DRES voltage rise, reverse power flow, hosting capacity, duck curve &amp; export management — Australian distribution networks
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Rooftop Systems"
          value={`${totalSystems}M`}
          sub="~4M nationally by 2024"
          icon={Sun}
          colour="bg-amber-500"
        />
        <KpiCard
          label="Total Capacity"
          value={`${totalCapacity} GW`}
          sub="~22 GW nationally"
          icon={Zap}
          colour="bg-blue-600"
        />
        <KpiCard
          label="Avg Penetration Rate"
          value={`${avgPenetration}%`}
          sub="SA highest ~45%"
          icon={TrendingUp}
          colour="bg-green-600"
        />
        <KpiCard
          label="Avg Export Curtailment"
          value={`${avgCurtailment}%`}
          sub="Across all export schemes"
          icon={AlertTriangle}
          colour="bg-red-600"
        />
      </div>

      {/* Charts — Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InstallationsByStateChart data={data.installations} />
        <VoltageIssuesChart data={data.voltage_issues} />
      </div>

      {/* Charts — Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <HostingCapacityChart data={data.hosting_capacity} />
        <DuckCurveChart data={data.duck_curve} />
      </div>

      {/* Charts — Row 3 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ExportCurtailmentChart data={data.export_schemes} />
        <ProjectedGrowthChart data={data.forecasts} />
      </div>

      {/* Data tables */}
      <div className="bg-gray-800 rounded-xl p-5 shadow overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Export Management Schemes</h3>
        <table className="w-full text-xs text-gray-300 border-collapse">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-700">
              <th className="pb-2 pr-3">Scheme</th>
              <th className="pb-2 pr-3">DNSP</th>
              <th className="pb-2 pr-3">State</th>
              <th className="pb-2 pr-3">Type</th>
              <th className="pb-2 pr-3 text-right">Max Export (kW)</th>
              <th className="pb-2 pr-3 text-right">Participants</th>
              <th className="pb-2 pr-3 text-right">Curtailment (%)</th>
              <th className="pb-2 text-right">Satisfaction (%)</th>
            </tr>
          </thead>
          <tbody>
            {data.export_schemes.map((s, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-1.5 pr-3">{s.scheme_name}</td>
                <td className="py-1.5 pr-3">{s.dnsp}</td>
                <td className="py-1.5 pr-3">
                  <span
                    className="px-1.5 py-0.5 rounded text-white text-xs"
                    style={{ backgroundColor: STATE_COLOURS[s.state] ?? '#6b7280' }}
                  >
                    {s.state}
                  </span>
                </td>
                <td className="py-1.5 pr-3">
                  <span
                    className="px-1.5 py-0.5 rounded text-white text-xs"
                    style={{ backgroundColor: SCHEME_TYPE_COLOURS[s.scheme_type] ?? '#6b7280' }}
                  >
                    {s.scheme_type}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right">{s.max_export_kw}</td>
                <td className="py-1.5 pr-3 text-right">{s.participants.toLocaleString()}</td>
                <td className={`py-1.5 pr-3 text-right font-semibold ${s.avg_curtailment_pct > 20 ? 'text-red-400' : s.avg_curtailment_pct > 10 ? 'text-amber-400' : 'text-green-400'}`}>
                  {s.avg_curtailment_pct}%
                </td>
                <td className="py-1.5 text-right">{s.customer_satisfaction_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
