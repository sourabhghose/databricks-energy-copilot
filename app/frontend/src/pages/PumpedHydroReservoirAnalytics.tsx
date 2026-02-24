import { useEffect, useState } from 'react'
import { Droplets, Zap, TrendingUp, Database, RefreshCw } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getPumpedHydroReservoirOperationsDashboard } from '../api/client'
import type { PHRODashboard } from '../api/client'

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
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
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
// Status colour helper
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  Operating: '#22c55e',
  'Under Construction': '#f59e0b',
  Approved: '#3b82f6',
  Concept: '#8b5cf6',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PumpedHydroReservoirAnalytics() {
  const [data, setData] = useState<PHRODashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPumpedHydroReservoirOperationsDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400 gap-3">
        <RefreshCw size={20} className="animate-spin" />
        <span>Loading Pumped Hydro Reservoir Operations...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const { facilities, operations, water, market, forecast, summary } = data

  // ---- Chart 1: Facility energy_storage_gwh vs turbine_capacity_mw grouped by status ----
  const facilityStorageChart = facilities.map((f) => ({
    name: f.facility_name.length > 18 ? f.facility_name.slice(0, 16) + '…' : f.facility_name,
    energy_storage_gwh: f.energy_storage_gwh,
    turbine_capacity_mw: f.turbine_capacity_mw,
    status: f.status,
    fill: STATUS_COLORS[f.status] ?? '#6b7280',
  }))

  // ---- Chart 2: Monthly generation vs pumping 2024 (aggregate all 5 facilities) ----
  const ops2024 = operations.filter((o) => o.year === 2024)
  const monthMap: Record<number, { month: number; generation_gwh: number; pumping_gwh: number }> = {}
  for (const op of ops2024) {
    if (!monthMap[op.month]) {
      monthMap[op.month] = { month: op.month, generation_gwh: 0, pumping_gwh: 0 }
    }
    monthMap[op.month].generation_gwh += op.generation_gwh
    monthMap[op.month].pumping_gwh += op.pumping_gwh
  }
  const monthLabels: Record<number, string> = {
    1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
    7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
  }
  const genPumpTrend = Object.values(monthMap)
    .sort((a, b) => a.month - b.month)
    .map((r) => ({
      month: monthLabels[r.month] ?? `M${r.month}`,
      generation_gwh: Math.round(r.generation_gwh * 10) / 10,
      pumping_gwh: Math.round(r.pumping_gwh * 10) / 10,
    }))

  // ---- Chart 3: Quarterly water_level_upper_pct by facility (2022-2024) ----
  // Average per facility per year-quarter
  type WaterKey = string
  const waterAgg: Record<WaterKey, { total: number; count: number; facilityId: string; period: string }> = {}
  for (const w of water) {
    const key = `${w.facility_id}|${w.year}-${w.quarter}`
    if (!waterAgg[key]) {
      waterAgg[key] = { total: 0, count: 0, facilityId: w.facility_id, period: `${w.year} ${w.quarter}` }
    }
    waterAgg[key].total += w.end_of_quarter_upper_pct
    waterAgg[key].count += 1
  }
  // Build period x facility pivot for chart
  const waterPeriods = [...new Set(Object.values(waterAgg).map((v) => v.period))].sort()
  const waterFacilityIds = [...new Set(Object.values(waterAgg).map((v) => v.facilityId))]
  const waterChartData = waterPeriods.map((period) => {
    const row: Record<string, string | number> = { period }
    for (const fid of waterFacilityIds) {
      const key = `${fid}|${period.replace(' ', '-')}`
      const entry = waterAgg[key]
      const shortId = fid.replace('PHRO-', 'F')
      row[shortId] = entry ? Math.round((entry.total / entry.count) * 10) / 10 : 0
    }
    return row
  })
  const waterFacilityShortIds = waterFacilityIds.map((fid) => fid.replace('PHRO-', 'F'))
  const WATER_COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fb923c', '#f472b6']

  // ---- Chart 4: Stacked bar — quarterly revenue breakdown by facility ----
  // Aggregate market data by facility
  const marketByFacility: Record<string, { wholesale: number; fcas: number; ancillary: number }> = {}
  for (const m of market) {
    if (!marketByFacility[m.facility_id]) {
      marketByFacility[m.facility_id] = { wholesale: 0, fcas: 0, ancillary: 0 }
    }
    marketByFacility[m.facility_id].wholesale += m.wholesale_revenue_m_aud
    marketByFacility[m.facility_id].fcas += m.fcas_revenue_m_aud
    marketByFacility[m.facility_id].ancillary += m.ancillary_revenue_m_aud
  }
  const revenueChartData = Object.entries(marketByFacility).map(([fid, vals]) => {
    const facName = facilities.find((f) => f.facility_id === fid)?.facility_name ?? fid
    const shortName = facName.length > 18 ? facName.slice(0, 16) + '…' : facName
    return {
      facility: shortName,
      Wholesale: Math.round(vals.wholesale * 10) / 10,
      FCAS: Math.round(vals.fcas * 10) / 10,
      Ancillary: Math.round(vals.ancillary * 10) / 10,
    }
  })

  // ---- Chart 5: Forecast generation by scenario 2025-2029 ----
  // Aggregate per year+scenario
  type ScenKey = string
  const scenAgg: Record<ScenKey, { total: number; count: number }> = {}
  for (const f of forecast) {
    const key = `${f.year}|${f.scenario}`
    if (!scenAgg[key]) scenAgg[key] = { total: 0, count: 0 }
    scenAgg[key].total += f.forecast_generation_gwh
    scenAgg[key].count += 1
  }
  const forecastYears = [2025, 2026, 2027, 2028, 2029]
  const forecastScenarios = ['Base', 'Optimistic', 'Conservative']
  const forecastChartData = forecastYears.map((yr) => {
    const row: Record<string, string | number> = { year: String(yr) }
    for (const sc of forecastScenarios) {
      const key = `${yr}|${sc}`
      const entry = scenAgg[key]
      row[sc] = entry ? Math.round((entry.total / entry.count) * 10) / 10 : 0
    }
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Droplets size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Pumped Hydro Reservoir Operations Analytics</h1>
          <p className="text-sm text-gray-400">Australian PHES facilities — reservoir, market &amp; forecast intelligence</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="Total Facilities"
          value={String(summary.total_facilities)}
          sub="Across all stages"
          icon={Database}
          color="bg-blue-600"
        />
        <KpiCard
          title="Total Storage"
          value={`${summary.total_storage_gwh.toFixed(1)} GWh`}
          sub={`Largest: ${summary.largest_facility}`}
          icon={Droplets}
          color="bg-cyan-600"
        />
        <KpiCard
          title="Generation 2024"
          value={`${summary.total_generation_gwh_2024.toFixed(1)} GWh`}
          sub="All operating facilities"
          icon={Zap}
          color="bg-amber-600"
        />
        <KpiCard
          title="Avg Round-Trip Efficiency"
          value={`${summary.avg_round_trip_efficiency_pct.toFixed(1)}%`}
          sub="Fleet average"
          icon={TrendingUp}
          color="bg-green-600"
        />
      </div>

      {/* Chart 1 & 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Chart 1: Facility Storage vs Turbine Capacity */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Facility Energy Storage (GWh) vs Turbine Capacity (MW)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={facilityStorageChart} margin={{ left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="energy_storage_gwh" name="Storage GWh" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="turbine_capacity_mw" name="Turbine MW" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <span key={status} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {status}
              </span>
            ))}
          </div>
        </div>

        {/* Chart 2: Monthly Generation vs Pumping 2024 */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Monthly Generation vs Pumping GWh — 2024 (5 Facilities)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={genPumpTrend} margin={{ left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Line type="monotone" dataKey="generation_gwh" name="Generation GWh" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="pumping_gwh" name="Pumping GWh" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 3 & 4 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Chart 3: Water Level by Facility Quarter */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Upper Reservoir Water Level % by Facility (2022–2024)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={waterChartData} margin={{ left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {waterFacilityShortIds.map((shortId, idx) => (
                <Bar
                  key={shortId}
                  dataKey={shortId}
                  name={shortId}
                  fill={WATER_COLORS[idx % WATER_COLORS.length]}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Stacked Revenue Breakdown */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Cumulative Revenue Breakdown by Facility (M AUD, All Quarters)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueChartData} margin={{ left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="facility" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar dataKey="Wholesale" stackId="rev" fill="#38bdf8" radius={[0, 0, 0, 0]} />
              <Bar dataKey="FCAS" stackId="rev" fill="#818cf8" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Ancillary" stackId="rev" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 5: Forecast Generation by Scenario */}
      <div className="bg-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Forecast Generation GWh by Scenario (2025–2029)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={forecastChartData} margin={{ left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            <Line type="monotone" dataKey="Base" stroke="#38bdf8" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="Optimistic" stroke="#34d399" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 4 }} />
            <Line type="monotone" dataKey="Conservative" stroke="#f87171" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Facility Table */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Facility Registry</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-2 pr-4">Facility</th>
                <th className="text-left py-2 pr-4">State</th>
                <th className="text-right py-2 pr-4">Storage GWh</th>
                <th className="text-right py-2 pr-4">Turbine MW</th>
                <th className="text-right py-2 pr-4">Efficiency %</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((f) => (
                <tr key={f.facility_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 font-medium">{f.facility_name}</td>
                  <td className="py-2 pr-4">{f.state}</td>
                  <td className="py-2 pr-4 text-right">{f.energy_storage_gwh.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right">{f.turbine_capacity_mw.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right">{f.round_trip_efficiency_pct.toFixed(1)}</td>
                  <td className="py-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: (STATUS_COLORS[f.status] ?? '#6b7280') + '33',
                        color: STATUS_COLORS[f.status] ?? '#9ca3af',
                        border: `1px solid ${STATUS_COLORS[f.status] ?? '#6b7280'}55`,
                      }}
                    >
                      {f.status}
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
