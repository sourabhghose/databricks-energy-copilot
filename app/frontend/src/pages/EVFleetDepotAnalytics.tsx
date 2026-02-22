import { useEffect, useState } from 'react'
import { Truck } from 'lucide-react'
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
import {
  getEVFleetDepotDashboard,
  EVFDDashboard,
  EVFDFleetRecord,
  EVFDDepotRecord,
} from '../api/client'

export default function EVFleetDepotAnalytics() {
  const [data, setData] = useState<EVFDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEVFleetDepotDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading EV Fleet Depot Analytics...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400">
        <span className="text-lg">Error: {error ?? 'No data available'}</span>
      </div>
    )
  }

  const { summary, fleets, depots, charging_sessions, tco_records, forecasts } = data

  // ---- KPI cards ----
  const kpis = [
    {
      label: 'Total EV Fleet Vehicles',
      value: summary.total_ev_fleet_vehicles.toLocaleString(),
      unit: 'vehicles',
    },
    {
      label: 'Charging Capacity',
      value: summary.total_charging_capacity_mw.toFixed(1),
      unit: 'MW',
    },
    {
      label: 'Annual Consumption',
      value: summary.annual_energy_consumption_gwh.toFixed(1),
      unit: 'GWh / yr',
    },
    {
      label: 'CO2 Reduction',
      value: summary.total_co2_reduction_kt.toFixed(1),
      unit: 'kt CO2',
    },
  ]

  // ---- Bar chart: Annual savings vs diesel by fleet type ----
  const savingsByType: Record<string, { savings: number; count: number }> = {}
  fleets.forEach((f: EVFDFleetRecord) => {
    if (!savingsByType[f.fleet_type]) savingsByType[f.fleet_type] = { savings: 0, count: 0 }
    savingsByType[f.fleet_type].savings += f.annual_savings_vs_diesel_aud
    savingsByType[f.fleet_type].count += 1
  })
  const savingsChartData = Object.entries(savingsByType).map(([type, v]) => ({
    type,
    avg_savings_m: +(v.savings / v.count / 1_000_000).toFixed(2),
  }))

  // ---- Line chart: EV Fleet Forecast by scenario 2025-2029 ----
  const scenarioYearMap: Record<string, Record<number, number>> = {}
  forecasts.forEach((fc) => {
    if (!scenarioYearMap[fc.scenario]) scenarioYearMap[fc.scenario] = {}
    if (!scenarioYearMap[fc.scenario][fc.year]) scenarioYearMap[fc.scenario][fc.year] = 0
    scenarioYearMap[fc.scenario][fc.year] += fc.ev_fleet_vehicles
  })
  const forecastYears = [2025, 2026, 2027, 2028, 2029]
  const allScenarios = Object.keys(scenarioYearMap)
  const forecastChartData = forecastYears.map((yr) => {
    const row: Record<string, number | string> = { year: yr }
    allScenarios.forEach((sc) => {
      row[sc] = scenarioYearMap[sc][yr] ?? 0
    })
    return row
  })
  const scenarioColors = ['#6366f1', '#22d3ee', '#f59e0b', '#34d399', '#f87171']

  // ---- Bar chart: TCO comparison — EV vs diesel by vehicle class ----
  const tcoGrouped: Record<string, Record<string, number>> = {}
  tco_records.forEach((t) => {
    const key = t.fleet_type
    if (!tcoGrouped[key]) tcoGrouped[key] = {}
    if (!tcoGrouped[key][t.fuel_type]) tcoGrouped[key][t.fuel_type] = 0
    tcoGrouped[key][t.fuel_type] += t.total_tco_10yr_aud
  })
  const tcoChartData = Object.entries(tcoGrouped).map(([ftype, fuels]) => ({
    fleet_type: ftype,
    Diesel: +((fuels['Diesel'] ?? 0) / 1_000_000).toFixed(2),
    BEV: +((fuels['BEV'] ?? 0) / 1_000_000).toFixed(2),
  }))

  // ---- Bar chart: Charging sessions by hour of day (solar vs grid) ----
  const hourProfile: Record<number, { Solar: number; Grid: number; Mixed: number }> = {}
  for (let h = 0; h < 24; h++) hourProfile[h] = { Solar: 0, Grid: 0, Mixed: 0 }
  charging_sessions.forEach((s) => {
    const h = s.hour_start
    if (hourProfile[h]) {
      hourProfile[h][s.grid_or_solar as 'Solar' | 'Grid' | 'Mixed'] += 1
    }
  })
  const hourChartData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h.toString().padStart(2, '0')}:00`,
    Solar: hourProfile[h].Solar,
    Grid: hourProfile[h].Grid,
    Mixed: hourProfile[h].Mixed,
  }))

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Truck size={28} className="text-green-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">EV Fleet Depot Charging Analytics</h1>
          <p className="text-sm text-gray-400">Fleet electrification, depot operations, TCO and grid impact across Australian states</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.unit}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Fleet Annual Savings vs Diesel */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Average Annual Savings vs Diesel by Fleet Type (A$M)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={savingsChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number) => [`A$${v}M`, 'Avg Savings']}
              />
              <Bar dataKey="avg_savings_m" fill="#4ade80" name="Avg Savings (A$M)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* EV Fleet Forecast by Scenario */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">EV Fleet Vehicle Forecast by Scenario 2025–2029</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={forecastChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {allScenarios.map((sc, idx) => (
                <Line
                  key={sc}
                  type="monotone"
                  dataKey={sc}
                  stroke={scenarioColors[idx % scenarioColors.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* TCO Comparison */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">10-Year TCO Comparison — BEV vs Diesel by Vehicle Class (A$M total)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={tcoChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="fleet_type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number) => [`A$${v}M`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="Diesel" fill="#f87171" name="Diesel" radius={[4, 4, 0, 0]} />
              <Bar dataKey="BEV" fill="#34d399" name="BEV" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Charging Sessions by Hour */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Depot Charging Sessions by Hour of Day (Solar vs Grid)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hourChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 9 }} interval={3} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="Solar" stackId="a" fill="#fbbf24" name="Solar" />
              <Bar dataKey="Mixed" stackId="a" fill="#60a5fa" name="Mixed" />
              <Bar dataKey="Grid" stackId="a" fill="#6366f1" name="Grid" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fleet Summary Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 mb-6 overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300">Fleet Summary</h2>
        </div>
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="bg-gray-750 border-b border-gray-700">
              <th className="text-left px-4 py-2 text-gray-400">Fleet</th>
              <th className="text-left px-4 py-2 text-gray-400">Operator</th>
              <th className="text-left px-4 py-2 text-gray-400">Type</th>
              <th className="text-left px-4 py-2 text-gray-400">State</th>
              <th className="text-right px-4 py-2 text-gray-400">Vehicles</th>
              <th className="text-left px-4 py-2 text-gray-400">Strategy</th>
              <th className="text-right px-4 py-2 text-gray-400">Annual Savings</th>
              <th className="text-right px-4 py-2 text-gray-400">Fleet Cap (MWh)</th>
            </tr>
          </thead>
          <tbody>
            {fleets.map((f: EVFDFleetRecord, idx: number) => (
              <tr
                key={f.fleet_id}
                className={idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850 hover:bg-gray-700'}
              >
                <td className="px-4 py-2 font-medium text-white">{f.fleet_name}</td>
                <td className="px-4 py-2">{f.operator}</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-900 text-green-300">
                    {f.fleet_type}
                  </span>
                </td>
                <td className="px-4 py-2">{f.state}</td>
                <td className="px-4 py-2 text-right">{f.num_vehicles.toLocaleString()}</td>
                <td className="px-4 py-2">{f.charging_strategy}</td>
                <td className="px-4 py-2 text-right text-green-400">
                  A${(f.annual_savings_vs_diesel_aud / 1_000_000).toFixed(2)}M
                </td>
                <td className="px-4 py-2 text-right">{f.total_fleet_capacity_mwh.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Depot Overview Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300">Depot Overview</h2>
        </div>
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="bg-gray-750 border-b border-gray-700">
              <th className="text-left px-4 py-2 text-gray-400">Depot</th>
              <th className="text-left px-4 py-2 text-gray-400">State</th>
              <th className="text-right px-4 py-2 text-gray-400">Chargers</th>
              <th className="text-right px-4 py-2 text-gray-400">Cap (kW)</th>
              <th className="text-right px-4 py-2 text-gray-400">Solar (kW)</th>
              <th className="text-right px-4 py-2 text-gray-400">Dispensed (MWh)</th>
              <th className="text-center px-4 py-2 text-gray-400">Smart</th>
              <th className="text-center px-4 py-2 text-gray-400">V2G</th>
              <th className="text-right px-4 py-2 text-gray-400">Opex (A$M)</th>
            </tr>
          </thead>
          <tbody>
            {depots.map((d: EVFDDepotRecord, idx: number) => (
              <tr
                key={d.depot_id}
                className={idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850 hover:bg-gray-700'}
              >
                <td className="px-4 py-2 font-medium text-white">{d.depot_name}</td>
                <td className="px-4 py-2">{d.state}</td>
                <td className="px-4 py-2 text-right">{d.num_chargers}</td>
                <td className="px-4 py-2 text-right">{d.total_charging_capacity_kw.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-yellow-400">{d.solar_capacity_kw.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{d.annual_energy_dispensed_mwh.toFixed(1)}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${d.smart_charging_enabled ? 'bg-blue-900 text-blue-300' : 'bg-gray-700 text-gray-400'}`}>
                    {d.smart_charging_enabled ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${d.v2g_enabled ? 'bg-purple-900 text-purple-300' : 'bg-gray-700 text-gray-400'}`}>
                    {d.v2g_enabled ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{d.depot_opex_m_pa.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
