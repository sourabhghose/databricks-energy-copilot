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
import { Fuel } from 'lucide-react'
import {
  getHydrogenRefuellingStationDashboard,
  HRSADashboard,
  HRSAStationRecord,
  HRSAProjectionRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function statusBadge(status: string) {
  const colours: Record<string, string> = {
    Operating:      'bg-green-500/20 text-green-300 border border-green-500/40',
    Construction:   'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
    Planned:        'bg-blue-500/20 text-blue-300 border border-blue-500/40',
    Decommissioned: 'bg-red-500/20 text-red-300 border border-red-500/40',
  }
  return colours[status] ?? 'bg-gray-500/20 text-gray-300 border border-gray-500/40'
}

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
export default function HydrogenRefuellingStationAnalytics() {
  const [data, setData]     = useState<HRSADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    getHydrogenRefuellingStationDashboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading Hydrogen Refuelling Station Analytics…</p>
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

  const { stations, demand_records, economics, supply_chains, networks, projections, summary } = data

  // ---- Chart: Daily capacity by state (operating vs planned) ----
  const stateCapMap: Record<string, { state: string; operating: number; planned: number }> = {}
  stations.forEach((s: HRSAStationRecord) => {
    if (!stateCapMap[s.state]) stateCapMap[s.state] = { state: s.state, operating: 0, planned: 0 }
    if (s.status === 'Operating') stateCapMap[s.state].operating += s.daily_capacity_kg_h2 / 1000
    else if (s.status === 'Planned' || s.status === 'Construction')
      stateCapMap[s.state].planned += s.daily_capacity_kg_h2 / 1000
  })
  const stateCapData = Object.values(stateCapMap).map(v => ({
    state: v.state,
    Operating: parseFloat(v.operating.toFixed(2)),
    'Planned/Construction': parseFloat(v.planned.toFixed(2)),
  }))

  // ---- Chart: H2 price projection by scenario ----
  const scenarioColours: Record<string, string> = {
    'Base':              '#60a5fa',
    'High Adoption':     '#34d399',
    'Government Target': '#fbbf24',
    'Low Adoption':      '#f87171',
  }
  const priceByYear: Record<number, Record<string, number>> = {}
  projections.forEach((p: HRSAProjectionRecord) => {
    if (!priceByYear[p.year]) priceByYear[p.year] = { year: p.year }
    priceByYear[p.year][p.scenario] = p.price_dollar_per_kg
  })
  const priceChartData = Object.values(priceByYear).sort((a, b) => a.year - b.year)

  // ---- Chart: Levelised cost by supply route ----
  const routeCostMap: Record<string, { count: number; total: number }> = {}
  economics.forEach(e => {
    const sc = supply_chains.find(s => s.station_id === e.station_id)
    if (!sc) return
    const route = sc.supply_route
    if (!routeCostMap[route]) routeCostMap[route] = { count: 0, total: 0 }
    routeCostMap[route].count += 1
    routeCostMap[route].total += e.levelised_cost_dollar_per_kg
  })
  const lcosByRoute = Object.entries(routeCostMap).map(([route, v]) => ({
    route: route.replace('On-site ', '').replace(' Delivery', ''),
    'Avg LCOS ($/kg)': parseFloat((v.total / v.count).toFixed(2)),
  }))

  // ---- Chart: Network readiness + gap ----
  const networkChartData = networks.map(n => ({
    corridor: n.corridor_name.replace(' Corridor', '').replace(' Highway', '').substring(0, 20),
    'Readiness Score': n.network_readiness_score,
    'Max Gap (km / 10)': parseFloat((n.gap_km_max / 10).toFixed(1)),
  }))

  // ---- Projection summary table ----
  const projSummary: Record<string, Record<number, HRSAProjectionRecord>> = {}
  projections.forEach((p: HRSAProjectionRecord) => {
    if (!projSummary[p.scenario]) projSummary[p.scenario] = {}
    projSummary[p.scenario][p.year] = p
  })
  const projYears = [2025, 2026, 2027, 2028, 2029]
  const projScenarios = ['Base', 'High Adoption', 'Government Target', 'Low Adoption']

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-cyan-500/20 rounded-xl">
          <Fuel className="w-7 h-7 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Hydrogen Refuelling Station Network Analytics</h1>
          <p className="text-gray-400 text-sm">Australian H2 refuelling infrastructure — capacity, economics, supply chains, and network projections</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Stations" value={String(summary.total_stations)} sub="Operating + pipeline" />
        <KpiCard
          label="Daily Capacity"
          value={`${Number(summary.total_daily_capacity_tpd).toFixed(1)} tpd`}
          sub="Operating stations"
        />
        <KpiCard
          label="Avg Price"
          value={`$${Number(summary.avg_price_dollar_per_kg).toFixed(2)}/kg`}
          sub="Operating stations"
        />
        <KpiCard
          label="Network Coverage"
          value={`${Number(summary.network_coverage_pct).toFixed(1)}%`}
          sub="Avg across corridors"
        />
      </div>

      {/* Row 1: two bar charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Station capacity by state */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Daily Capacity by State (tonnes H2/day)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stateCapData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" t" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="Operating" fill="#22d3ee" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Planned/Construction" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Levelised cost by supply route */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Avg Levelised Cost by Supply Route ($/kg H2)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={lcosByRoute} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="route" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Bar dataKey="Avg LCOS ($/kg)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: line chart + bar chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Price projection */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">H2 Price Projection 2025–2029 by Scenario ($/kg)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={priceChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis domain={[7, 17]} tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {projScenarios.map(sc => (
                <Line
                  key={sc}
                  type="monotone"
                  dataKey={sc}
                  stroke={scenarioColours[sc]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Network readiness */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Network Corridor Readiness Score &amp; Max Gap</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={networkChartData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="corridor" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="Readiness Score" fill="#34d399" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Max Gap (km / 10)" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Station overview table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300">Station Overview</h2>
          <p className="text-xs text-gray-500 mt-0.5">All {stations.length} stations — status, pressure, capacity and pricing</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Station</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">State</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">H2 Source</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Pressure (bar)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Capacity (kg/day)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Price ($/kg)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Utilisation %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {stations.map((s: HRSAStationRecord) => (
                <tr key={s.station_id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 text-gray-200 font-medium whitespace-nowrap">{s.station_name}</td>
                  <td className="px-4 py-3 text-gray-400">{s.state}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(s.status)}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{s.h2_source}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{s.dispensing_pressure_bar}</td>
                  <td className="px-4 py-3 text-right text-cyan-300 font-medium">{s.daily_capacity_kg_h2.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-yellow-300">${s.price_dollar_per_kg.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{s.daily_utilisation_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Projection summary table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300">Projection Summary — Stations Operating by Scenario &amp; Year</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Scenario</th>
                {projYears.map(y => (
                  <th key={y} className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">{y}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {projScenarios.map(sc => (
                <tr key={sc} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-200">{sc}</td>
                  {projYears.map(y => {
                    const rec = projSummary[sc]?.[y]
                    return (
                      <td key={y} className="px-4 py-3 text-center text-gray-300">
                        {rec ? (
                          <div>
                            <div className="font-semibold text-cyan-300">{rec.num_stations_operating}</div>
                            <div className="text-xs text-gray-500">${rec.price_dollar_per_kg.toFixed(1)}/kg</div>
                          </div>
                        ) : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-600 text-center pb-4">
        Data: Illustrative modelling — Australian hydrogen refuelling infrastructure 2021–2029. Not for commercial use.
      </p>
    </div>
  )
}
