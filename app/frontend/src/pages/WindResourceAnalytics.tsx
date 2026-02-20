import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { Tornado, MapPin, Gauge, Activity } from 'lucide-react'
import { api } from '../api/client'
import type {
  WindResourceDashboard,
  WindSiteAssessment,
  WindFarmPerformance,
  WakeLossRecord,
  WindResourceRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function ResourceClassBadge({ cls }: { cls: string }) {
  const map: Record<string, string> = {
    CLASS_7: 'bg-amber-900/60 text-amber-300 border border-amber-700',
    CLASS_6: 'bg-green-900/60 text-green-300 border border-green-700',
    CLASS_5: 'bg-blue-900/60 text-blue-300 border border-blue-700',
    CLASS_4: 'bg-cyan-900/60 text-cyan-300 border border-cyan-700',
    CLASS_3: 'bg-gray-700 text-gray-300 border border-gray-600',
    CLASS_2: 'bg-gray-700/80 text-gray-400 border border-gray-600',
    CLASS_1: 'bg-gray-800 text-gray-500 border border-gray-700',
  }
  const label: Record<string, string> = {
    CLASS_7: 'Class 7',
    CLASS_6: 'Class 6',
    CLASS_5: 'Class 5',
    CLASS_4: 'Class 4',
    CLASS_3: 'Class 3',
    CLASS_2: 'Class 2',
    CLASS_1: 'Class 1',
  }
  const cn = map[cls] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cn}`}>
      {label[cls] ?? cls}
    </span>
  )
}

function TerrainBadge({ terrain }: { terrain: string }) {
  const map: Record<string, string> = {
    OFFSHORE: 'bg-teal-900/60 text-teal-300 border border-teal-700',
    FLAT: 'bg-green-900/60 text-green-300 border border-green-700',
    ROLLING: 'bg-blue-900/60 text-blue-300 border border-blue-700',
    COMPLEX: 'bg-amber-900/60 text-amber-300 border border-amber-700',
  }
  const label: Record<string, string> = {
    OFFSHORE: 'Offshore',
    FLAT: 'Flat',
    ROLLING: 'Rolling',
    COMPLEX: 'Complex',
  }
  const cn = map[terrain] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cn}`}>
      {label[terrain] ?? terrain}
    </span>
  )
}

function WakeLossBadge({ pct }: { pct: number }) {
  const cn =
    pct < 8
      ? 'text-green-400'
      : pct < 12
      ? 'text-amber-400'
      : 'text-red-400'
  return <span className={`font-semibold ${cn}`}>{pct.toFixed(1)}%</span>
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: string
}

function KpiCard({ title, value, sub, icon, color }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow">
      <div className={`p-3 rounded-lg ${color} shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers for wake loss chart data
// ---------------------------------------------------------------------------

function buildWakeChartData(records: WakeLossRecord[]) {
  // Aggregate by farm — sum near/far/inter across all speed bins
  const farmMap: Record<string, { near: number; far: number; inter: number }> = {}
  records.forEach((r) => {
    if (!farmMap[r.farm_name]) farmMap[r.farm_name] = { near: 0, far: 0, inter: 0 }
    farmMap[r.farm_name].near += r.near_wake_loss_pct
    farmMap[r.farm_name].far += r.far_wake_loss_pct
    farmMap[r.farm_name].inter += r.inter_farm_wake_pct
  })
  // Average over bins (4 bins per farm)
  return Object.entries(farmMap)
    .map(([name, v]) => ({
      name,
      'Near Wake': parseFloat((v.near / 4).toFixed(2)),
      'Far Wake': parseFloat((v.far / 4).toFixed(2)),
      'Inter-Farm': parseFloat((v.inter / 4).toFixed(2)),
    }))
    .sort((a, b) => b['Near Wake'] + b['Far Wake'] + b['Inter-Farm'] - (a['Near Wake'] + a['Far Wake'] + a['Inter-Farm']))
    .slice(0, 5)
}

// Build monthly CF chart data (3 regions, 12 months)
function buildMonthlyData(records: WindResourceRecord[]) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const byMonth: Record<string, Record<string, number>> = {}
  months.forEach((m) => (byMonth[m] = {}))
  records.forEach((r) => {
    byMonth[r.month_name][r.region] = r.capacity_factor_monthly_pct
  })
  return months.map((m) => ({ month: m, ...byMonth[m] }))
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function WindResourceAnalytics() {
  const [dashboard, setDashboard] = useState<WindResourceDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getWindResourceDashboard()
      .then((d) => setDashboard(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading Wind Resource Analytics...
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-sm">
        {error ?? 'Failed to load data.'}
      </div>
    )
  }

  const monthlyData = buildMonthlyData(dashboard.monthly_resource)
  const wakeChartData = buildWakeChartData(dashboard.wake_loss_records)

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-full text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-900/50 rounded-lg">
          <Tornado className="text-cyan-400" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Wind Resource &amp; Wake Effect Analytics</h1>
          <p className="text-sm text-gray-400">
            Wind farm energy yield, wake loss analysis, turbine performance and resource assessment by region
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Best Wind Resource Site"
          value={dashboard.best_wind_resource_site}
          sub="Highest mean wind speed"
          icon={<MapPin size={20} className="text-amber-300" />}
          color="bg-amber-900/50"
        />
        <KpiCard
          title="Avg Capacity Factor"
          value={`${dashboard.avg_capacity_factor_pct.toFixed(1)}%`}
          sub="Across all wind farms"
          icon={<Gauge size={20} className="text-cyan-300" />}
          color="bg-cyan-900/50"
        />
        <KpiCard
          title="Total Wind Capacity"
          value={`${dashboard.total_wind_capacity_mw.toLocaleString()} MW`}
          sub="Installed capacity"
          icon={<Tornado size={20} className="text-green-300" />}
          color="bg-green-900/50"
        />
        <KpiCard
          title="Avg Wake Loss"
          value={`${dashboard.avg_wake_loss_pct.toFixed(1)}%`}
          sub="Portfolio average"
          icon={<Activity size={20} className="text-rose-300" />}
          color="bg-rose-900/50"
        />
      </div>

      {/* Monthly Wind Resource Chart */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Monthly Capacity Factor by Region (%)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <YAxis
              domain={[30, 55]}
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#F9FAFB' }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
            />
            <Legend wrapperStyle={{ color: '#D1D5DB', fontSize: 12 }} />
            <Line type="monotone" dataKey="SA" stroke="#F59E0B" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="VIC" stroke="#22D3EE" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="QLD" stroke="#4ADE80" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Wake Loss Analysis Chart */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-sm font-semibold text-gray-200 mb-1">
          Wake Loss Decomposition — Top 5 Farms (avg %)
        </h2>
        <p className="text-xs text-gray-500 mb-4">Near-wake, far-wake and inter-farm wake losses averaged across wind speed bins</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={wakeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#F9FAFB' }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
            />
            <Legend wrapperStyle={{ color: '#D1D5DB', fontSize: 12 }} />
            <Bar dataKey="Near Wake" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Far Wake" stackId="a" fill="#22D3EE" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Inter-Farm" stackId="a" fill="#F87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Wind Farm Performance Table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Wind Farm Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-700">
                <th className="pb-2 pr-4">Farm</th>
                <th className="pb-2 pr-4">State</th>
                <th className="pb-2 pr-4">Turbine Model</th>
                <th className="pb-2 pr-4 text-right">Cap (MW)</th>
                <th className="pb-2 pr-4 text-right">Turbines</th>
                <th className="pb-2 pr-4 text-right">Hub (m)</th>
                <th className="pb-2 pr-4 text-right">Rotor (m)</th>
                <th className="pb-2 pr-4 text-right">CF %</th>
                <th className="pb-2 pr-4 text-right">P90 CF %</th>
                <th className="pb-2 pr-4 text-right">Wake Loss</th>
                <th className="pb-2 pr-4 text-right">Avail %</th>
                <th className="pb-2 text-right">Gen (GWh)</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.farm_performance.map((f: WindFarmPerformance) => (
                <tr
                  key={f.farm_id}
                  className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors"
                >
                  <td className="py-2 pr-4 font-medium text-white">{f.farm_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{f.state}</td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{f.turbine_model}</td>
                  <td className="py-2 pr-4 text-right text-gray-200">{f.installed_capacity_mw.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right text-gray-200">{f.num_turbines}</td>
                  <td className="py-2 pr-4 text-right text-gray-200">{f.hub_height_m.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right text-gray-200">{f.rotor_diameter_m.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right text-cyan-300 font-semibold">
                    {f.actual_capacity_factor_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-400">
                    {f.p90_capacity_factor_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <WakeLossBadge pct={f.wake_loss_pct} />
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {f.availability_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 text-right text-amber-300 font-semibold">
                    {f.annual_generation_gwh.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-5 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="text-green-400 font-bold">{'<'}8%</span> Low wake loss
          </span>
          <span className="flex items-center gap-1">
            <span className="text-amber-400 font-bold">8–12%</span> Moderate wake loss
          </span>
          <span className="flex items-center gap-1">
            <span className="text-red-400 font-bold">{'≥'}12%</span> High wake loss
          </span>
        </div>
      </div>

      {/* Site Assessment Table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Wind Site Assessments</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-700">
                <th className="pb-2 pr-4">Site</th>
                <th className="pb-2 pr-4">State</th>
                <th className="pb-2 pr-4">Resource Class</th>
                <th className="pb-2 pr-4 text-right">Wind Speed (m/s)</th>
                <th className="pb-2 pr-4 text-right">Power Density (W/m²)</th>
                <th className="pb-2 pr-4">Predominant Dir.</th>
                <th className="pb-2 pr-4 text-right">Turbulence %</th>
                <th className="pb-2 pr-4">Terrain</th>
                <th className="pb-2 text-right">CF Potential %</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.site_assessments.map((s: WindSiteAssessment) => (
                <tr
                  key={s.site_id}
                  className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors"
                >
                  <td className="py-2 pr-4 font-medium text-white">{s.site_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{s.state}</td>
                  <td className="py-2 pr-4">
                    <ResourceClassBadge cls={s.resource_class} />
                  </td>
                  <td className="py-2 pr-4 text-right text-cyan-300 font-semibold">
                    {s.mean_wind_speed_ms.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-200">
                    {s.wind_power_density_wm2.toFixed(0)}
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{s.predominant_direction}</td>
                  <td className="py-2 pr-4 text-right text-gray-400">
                    {s.turbulence_intensity_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4">
                    <TerrainBadge terrain={s.terrain_roughness} />
                  </td>
                  <td className="py-2 text-right text-amber-300 font-semibold">
                    {s.capacity_factor_potential_pct.toFixed(1)}%
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
