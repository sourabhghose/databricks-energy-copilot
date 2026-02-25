import { useEffect, useState } from 'react'
import { Shield, Zap, Sun, Users } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getMGRADashboard } from '../api/client'
import type { MGRADashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const TYPE_COLOURS: Record<string, string> = {
  REMOTE: '#3b82f6',
  REGIONAL: '#f59e0b',
  INDUSTRIAL: '#ef4444',
  DEFENCE: '#10b981',
  CRITICAL_INFRA: '#8b5cf6',
}

const GEN_COLOURS: Record<string, string> = {
  solar: '#f59e0b',
  battery: '#3b82f6',
  diesel: '#ef4444',
  wind: '#10b981',
  hydro: '#06b6d4',
}

const RADAR_FILL = '#8b5cf6'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-2xl p-6 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart Card wrapper
// ---------------------------------------------------------------------------
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function MicrogridResilienceAnalytics() {
  const [data, setData] = useState<MGRADashboard | null>(null)

  useEffect(() => {
    getMGRADashboard().then(setData).catch(console.error)
  }, [])

  if (!data) {
    return <div className="min-h-screen bg-gray-900 p-8 text-white">Loading Microgrid Resilience Analytics dashboard...</div>
  }

  // KPI aggregation
  const activeMicrogrids = data.microgrids.length
  const totalIslandingCapacity = data.microgrids
    .filter((m) => m.islanding_capable)
    .reduce((s, m) => s + m.capacity_kw, 0) / 1000 // MW
  const avgRenewableFraction = data.microgrids.reduce((s, m) => s + m.renewable_pct, 0) / data.microgrids.length
  const communitiesServed = data.microgrids.reduce((s, m) => s + m.communities_served, 0) / 1000 // k

  // Derived data for charts
  // 1) Capacity by type
  const capacityByType = Object.entries(
    data.microgrids.reduce<Record<string, number>>((acc, m) => {
      acc[m.grid_type] = (acc[m.grid_type] || 0) + m.capacity_kw / 1000
      return acc
    }, {})
  ).map(([type, capacity_mw]) => ({ type, capacity_mw: Math.round(capacity_mw * 10) / 10 }))

  // 2) Islanding event history - use monthly_trends
  const islandingHistory = data.monthly_trends.map((m) => ({
    month: m.month,
    events: m.total_islanding_events,
    avg_duration_hrs: m.avg_duration_hrs,
  }))

  // 3) Generation mix by state (stacked bar) - aggregate from microgrids
  const genMixByState = Object.entries(
    data.microgrids.reduce<Record<string, { solar: number; battery: number; diesel: number; wind: number; hydro: number }>>((acc, m) => {
      const st = m.state
      if (!acc[st]) acc[st] = { solar: 0, battery: 0, diesel: 0, wind: 0, hydro: 0 }
      acc[st].solar += m.solar_kw / 1000
      acc[st].wind += m.wind_kw / 1000
      acc[st].diesel += m.diesel_kw / 1000
      acc[st].battery += m.battery_kwh / 1000
      // hydro estimated as remainder
      const total = m.capacity_kw / 1000
      const accounted = (m.solar_kw + m.wind_kw + m.diesel_kw) / 1000
      if (total > accounted) acc[st].hydro += Math.round((total - accounted) * 10) / 10
      return acc
    }, {})
  ).map(([state, mix]) => ({
    state,
    solar: Math.round(mix.solar * 10) / 10,
    battery: Math.round(mix.battery * 10) / 10,
    diesel: Math.round(mix.diesel * 10) / 10,
    wind: Math.round(mix.wind * 10) / 10,
    hydro: Math.round(mix.hydro * 10) / 10,
  }))

  // 4) Radar chart data - average resilience scores
  const avgResilience = data.resilience.reduce(
    (acc, r) => {
      acc.reliability += r.reliability_score
      acc.renewable += r.renewable_score
      acc.autonomy += r.autonomy_score
      acc.cost += r.cost_score
      acc.emissions += r.emissions_score
      return acc
    },
    { reliability: 0, renewable: 0, autonomy: 0, cost: 0, emissions: 0 }
  )
  const n = data.resilience.length || 1
  const radarData = [
    { dimension: 'Reliability', score: Math.round((avgResilience.reliability / n) * 10) / 10 },
    { dimension: 'Renewable %', score: Math.round((avgResilience.renewable / n) * 10) / 10 },
    { dimension: 'Autonomy', score: Math.round((avgResilience.autonomy / n) * 10) / 10 },
    { dimension: 'Cost', score: Math.round((avgResilience.cost / n) * 10) / 10 },
    { dimension: 'Emissions', score: Math.round((avgResilience.emissions / n) * 10) / 10 },
  ]

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Shield size={28} className="text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold">Microgrid Resilience Analytics</h1>
          <p className="text-sm text-gray-400">Sprint 166c — MGRA Dashboard</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="Active Microgrids"
          value={`${activeMicrogrids}`}
          sub="registered sites"
          icon={Shield}
          color="bg-blue-600"
        />
        <KpiCard
          title="Total Islanding Capacity"
          value={`${totalIslandingCapacity.toFixed(1)} MW`}
          sub="islanding-capable capacity"
          icon={Zap}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Avg Renewable Fraction"
          value={`${avgRenewableFraction.toFixed(1)}%`}
          sub="across all microgrids"
          icon={Sun}
          color="bg-amber-600"
        />
        <KpiCard
          title="Communities Served"
          value={`${communitiesServed.toFixed(1)}k`}
          sub="people in microgrid zones"
          icon={Users}
          color="bg-purple-600"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Microgrid Capacity by Type BarChart */}
        <ChartCard title="Microgrid Capacity by Type (MW)">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={capacityByType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="type" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="capacity_mw" name="Capacity MW" fill="#3b82f6">
                {capacityByType.map((entry, index) => (
                  <rect key={`cell-${index}`} fill={TYPE_COLOURS[entry.type] || '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Islanding Event History LineChart */}
        <ChartCard title="Islanding Event History (18 months)">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={islandingHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'Events', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'Avg Hrs', angle: 90, position: 'insideRight', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="events" name="Islanding Events" stroke="#3b82f6" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="avg_duration_hrs" name="Avg Duration (hrs)" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Generation Mix Stacked BarChart */}
        <ChartCard title="Generation Mix by State (MW)">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={genMixByState}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="solar" name="Solar" stackId="gen" fill={GEN_COLOURS.solar} />
              <Bar dataKey="battery" name="Battery" stackId="gen" fill={GEN_COLOURS.battery} />
              <Bar dataKey="diesel" name="Diesel" stackId="gen" fill={GEN_COLOURS.diesel} />
              <Bar dataKey="wind" name="Wind" stackId="gen" fill={GEN_COLOURS.wind} />
              <Bar dataKey="hydro" name="Hydro" stackId="gen" fill={GEN_COLOURS.hydro} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Resilience Scoring RadarChart */}
        <ChartCard title="Resilience Scoring (Average across Microgrids)">
          <ResponsiveContainer width="100%" height={340}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="dimension" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 10]} stroke="#9ca3af" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Radar name="Avg Score" dataKey="score" stroke={RADAR_FILL} fill={RADAR_FILL} fillOpacity={0.4} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table: Microgrid Registry */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Microgrid Registry</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Capacity kW</th>
                <th className="py-3 px-4 text-right">Battery kWh</th>
                <th className="py-3 px-4 text-right">Renewable %</th>
                <th className="py-3 px-4 text-center">Islanding</th>
                <th className="py-3 px-4">Operator</th>
              </tr>
            </thead>
            <tbody>
              {data.microgrids.map((mg) => (
                <tr key={mg.name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 px-4 font-medium text-white">{mg.name}</td>
                  <td className="py-3 px-4 text-gray-300">{mg.location}, {mg.state}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: (TYPE_COLOURS[mg.grid_type] || '#6b7280') + '33', color: TYPE_COLOURS[mg.grid_type] || '#9ca3af' }}>
                      {mg.grid_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">{mg.capacity_kw.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{mg.battery_kwh.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${mg.renewable_pct >= 70 ? 'bg-green-900 text-green-300' : mg.renewable_pct >= 40 ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                      {mg.renewable_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${mg.islanding_capable ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                      {mg.islanding_capable ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-300">{mg.operator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table: Islanding Events Log */}
      <div className="bg-gray-800 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Islanding Events Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-3 px-4">Microgrid</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Trigger</th>
                <th className="py-3 px-4 text-right">Duration (hrs)</th>
                <th className="py-3 px-4 text-right">Load Served %</th>
                <th className="py-3 px-4 text-right">Battery SoC End %</th>
              </tr>
            </thead>
            <tbody>
              {data.islanding_events.map((ev, idx) => (
                <tr key={`${ev.microgrid_name}-${ev.event_date}-${idx}`} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 px-4 font-medium text-white">{ev.microgrid_name}</td>
                  <td className="py-3 px-4 text-gray-300">{ev.event_date}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      ev.trigger === 'STORM' ? 'bg-blue-900 text-blue-300' :
                      ev.trigger === 'BUSHFIRE' ? 'bg-red-900 text-red-300' :
                      ev.trigger === 'GRID_FAULT' ? 'bg-yellow-900 text-yellow-300' :
                      ev.trigger === 'PLANNED_MAINTENANCE' ? 'bg-green-900 text-green-300' :
                      'bg-purple-900 text-purple-300'
                    }`}>
                      {ev.trigger}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">{ev.duration_hrs.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ev.load_served_pct >= 90 ? 'bg-green-900 text-green-300' : ev.load_served_pct >= 70 ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                      {ev.load_served_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ev.battery_soc_end_pct >= 30 ? 'bg-green-900 text-green-300' : ev.battery_soc_end_pct >= 15 ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                      {ev.battery_soc_end_pct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
