import { useEffect, useState } from 'react'
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
import { Truck } from 'lucide-react'
import {
  getHydrogenRefuellingTransportDashboard,
  HRTSDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------
interface KpiProps { label: string; value: string; sub?: string }
function KpiCard({ label, value, sub }: KpiProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function HydrogenRefuellingTransportAnalytics() {
  const [data, setData]       = useState<HRTSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getHydrogenRefuellingTransportDashboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading Hydrogen Refuelling &amp; Transport Analytics…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-8 text-center max-w-md">
          <p className="text-red-400 font-semibold text-lg">Failed to load data</p>
          <p className="text-gray-400 mt-2 text-sm">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  const { stations, vehicles, projects, economics, demand, summary } = data

  // ---- Chart 1: station h2_capacity_kg_per_day coloured by h2_source ----
  const sourceColour: Record<string, string> = {
    Green: '#22c55e',
    Blue:  '#3b82f6',
    Grey:  '#6b7280',
  }
  const stationCapData = stations.map(s => ({
    name: s.station_name.replace(' Station', '').replace(' Analytics', '').substring(0, 22),
    capacity: s.h2_capacity_kg_per_day,
    source: s.h2_source,
    fill: sourceColour[s.h2_source] ?? '#9ca3af',
  }))

  // ---- Chart 2: vehicle tco_vs_diesel_pct by vehicle_category coloured by fuel_cell_manufacturer ----
  const mfrColour: Record<string, string> = {
    Toyota:       '#ef4444',
    Hyundai:      '#3b82f6',
    Ballard:      '#f59e0b',
    Horizon:      '#8b5cf6',
    Cummins:      '#06b6d4',
    'Nel Hydrogen': '#10b981',
  }
  const vehicleTcoData = vehicles.map((v, idx) => ({
    name: `${v.vehicle_category} ${idx + 1}`,
    category: v.vehicle_category,
    tco_vs_diesel: v.tco_vs_diesel_pct,
    manufacturer: v.fuel_cell_manufacturer,
    fill: mfrColour[v.fuel_cell_manufacturer] ?? '#9ca3af',
  }))

  // ---- Chart 3: production_cost_per_kg trajectory 2024-2030 for Green/Blue/Grey ----
  const costByYear: Record<number, Record<string, number>> = {}
  economics.forEach(e => {
    if (!costByYear[e.year]) costByYear[e.year] = { year: e.year }
    // average over vehicle types
    if (costByYear[e.year][e.h2_source] !== undefined) {
      costByYear[e.year][e.h2_source] = (costByYear[e.year][e.h2_source] + e.production_cost_per_kg) / 2
    } else {
      costByYear[e.year][e.h2_source] = e.production_cost_per_kg
    }
  })
  const costTrajectory = Object.values(costByYear)
    .sort((a, b) => (a.year as number) - (b.year as number))
    .map(row => ({
      year: row.year,
      Green: typeof row.Green === 'number' ? parseFloat((row.Green as number).toFixed(2)) : null,
      Blue:  typeof row.Blue  === 'number' ? parseFloat((row.Blue  as number).toFixed(2)) : null,
      Grey:  typeof row.Grey  === 'number' ? parseFloat((row.Grey  as number).toFixed(2)) : null,
    }))

  // ---- Chart 4: sector h2_demand_kt for 2030 by sector ----
  const demand2030 = demand
    .filter(d => d.year === 2030)
    .map(d => ({
      sector: d.sector,
      'H2 Demand kt': d.h2_demand_kt,
    }))

  // ---- Chart 5: project capex_m_aud coloured by funding_source ----
  const fundingColour: Record<string, string> = {
    ARENA:   '#f59e0b',
    CEFC:    '#3b82f6',
    State:   '#8b5cf6',
    Private: '#10b981',
    Federal: '#ef4444',
  }
  const projectCapexData = projects.map(p => ({
    name: p.project_name.substring(0, 24),
    capex: p.capex_m_aud,
    funding: p.funding_source,
    fill: fundingColour[p.funding_source] ?? '#9ca3af',
  }))

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 },
    labelStyle: { color: '#f3f4f6' },
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-teal-500/20 rounded-xl">
          <Truck className="w-7 h-7 text-teal-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Hydrogen Refuelling &amp; Transport Sector Analytics</h1>
          <p className="text-gray-400 text-sm">
            Australian H2 refuelling infrastructure, transport fleet economics, project pipeline and demand outlook
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Stations"
          value={String(summary.total_stations)}
          sub="All statuses"
        />
        <KpiCard
          label="Total Vehicles Deployed"
          value={summary.total_vehicles_deployed.toLocaleString()}
          sub="Across all categories"
        />
        <KpiCard
          label="Total H2 Demand 2030"
          value={`${summary.total_h2_demand_kt_2030.toFixed(1)} kt`}
          sub="All transport sectors"
        />
        <KpiCard
          label="Avg Retail Price"
          value={`$${summary.avg_retail_price_per_kg.toFixed(2)}/kg`}
          sub="Across operating stations"
        />
      </div>

      {/* Row 1: Station capacity + Vehicle TCO */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1 — Station Capacity by H2 Source */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-1">Station H2 Capacity (kg/day)</h2>
          <p className="text-xs text-gray-500 mb-4">Coloured by H2 source: Green / Blue / Grey</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={stationCapData}
              margin={{ top: 5, right: 20, left: 0, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" kg" />
              <Tooltip
                {...tooltipStyle}
                formatter={(value: number, _name: string, entry: { payload?: { source?: string } }) => [
                  `${value.toFixed(0)} kg/day`,
                  entry.payload?.source ?? '',
                ]}
              />
              <Bar dataKey="capacity" name="Capacity (kg/day)" isAnimationActive={false}>
                {stationCapData.map((entry, index) => (
                  <rect key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex gap-4 mt-2 flex-wrap">
            {Object.entries(sourceColour).map(([src, colour]) => (
              <span key={src} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: colour }} />
                {src}
              </span>
            ))}
          </div>
        </div>

        {/* Chart 2 — Vehicle TCO vs Diesel */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-1">Vehicle TCO vs Diesel (%)</h2>
          <p className="text-xs text-gray-500 mb-4">Coloured by fuel cell manufacturer. Negative = cheaper than diesel.</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={vehicleTcoData}
              margin={{ top: 5, right: 20, left: 0, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="category"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
              <Tooltip
                {...tooltipStyle}
                formatter={(value: number, _name: string, entry: { payload?: { manufacturer?: string } }) => [
                  `${value.toFixed(1)}%`,
                  entry.payload?.manufacturer ?? '',
                ]}
              />
              <Bar dataKey="tco_vs_diesel" name="TCO vs Diesel %" isAnimationActive={false}>
                {vehicleTcoData.map((entry, index) => (
                  <rect key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-2 flex-wrap">
            {Object.entries(mfrColour).map(([mfr, colour]) => (
              <span key={mfr} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: colour }} />
                {mfr}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: H2 Production Cost Trajectory + 2030 Demand by Sector */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 3 — Production Cost Trajectory */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-1">H2 Production Cost Trajectory ($/kg)</h2>
          <p className="text-xs text-gray-500 mb-4">Green / Blue / Grey — 2024 to 2030</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={costTrajectory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $/kg" />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}/kg`]} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line type="monotone" dataKey="Green" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Blue"  stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Grey"  stroke="#6b7280" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4 — 2030 H2 Demand by Sector */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-1">H2 Demand by Sector — 2030 (kt)</h2>
          <p className="text-xs text-gray-500 mb-4">Projected annual demand by transport sector</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={demand2030} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" kt" />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)} kt`]} />
              <Bar dataKey="H2 Demand kt" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Project CapEx by Funding Source */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Project CapEx by Funding Source ($M AUD)</h2>
        <p className="text-xs text-gray-500 mb-4">Coloured by funding source: ARENA / CEFC / State / Private / Federal</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={projectCapexData}
            margin={{ top: 5, right: 20, left: 0, bottom: 100 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $M" />
            <Tooltip
              {...tooltipStyle}
              formatter={(value: number, _name: string, entry: { payload?: { funding?: string } }) => [
                `$${value.toFixed(1)}M`,
                entry.payload?.funding ?? '',
              ]}
            />
            <Bar dataKey="capex" name="CapEx ($M AUD)" isAnimationActive={false}>
              {projectCapexData.map((entry, index) => (
                <rect key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 flex-wrap">
          {Object.entries(fundingColour).map(([src, colour]) => (
            <span key={src} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: colour }} />
              {src}
            </span>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Infrastructure Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Total Capacity</p>
            <p className="text-white font-semibold mt-0.5">
              {summary.total_capacity_kg_per_day.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg/day
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Green H2 Stations</p>
            <p className="text-green-400 font-semibold mt-0.5">{summary.green_h2_stations_pct.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Total Project CapEx</p>
            <p className="text-white font-semibold mt-0.5">${summary.total_project_capex_b_aud.toFixed(2)}B AUD</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Avg Retail Price</p>
            <p className="text-white font-semibold mt-0.5">${summary.avg_retail_price_per_kg.toFixed(2)}/kg</p>
          </div>
        </div>
      </div>
    </div>
  )
}
