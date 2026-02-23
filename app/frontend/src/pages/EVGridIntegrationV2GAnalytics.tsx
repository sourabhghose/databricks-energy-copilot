import { useEffect, useState } from 'react'
import { Plug } from 'lucide-react'
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
  getEVGridIntegrationV2GDashboard,
  EVGIDashboard,
  EVGIFleetRecord,
  EVGIChargingRecord,
  EVGIV2GRecord,
  EVGINetworkRecord,
  EVGIInfrastructureRecord,
  EVGIProjectionRecord,
} from '../api/client'

export default function EVGridIntegrationV2GAnalytics() {
  const [data, setData] = useState<EVGIDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEVGridIntegrationV2GDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading EV Grid Integration V2G Analytics...</span>
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

  const { summary, fleet, charging, v2g, network_impact, infrastructure, projections } = data

  // ---- KPI Cards ----
  const totalFleet = typeof summary.total_ev_fleet === 'number' ? summary.total_ev_fleet : 0
  const v2gCapable = typeof summary.v2g_capable_vehicles === 'number' ? summary.v2g_capable_vehicles : 0
  const v2gCapablePct = totalFleet > 0 ? ((v2gCapable / totalFleet) * 100).toFixed(1) : '0.0'
  const avgV2GBenefit = typeof summary.avg_v2g_net_benefit_aud_per_vehicle === 'number'
    ? summary.avg_v2g_net_benefit_aud_per_vehicle.toFixed(0)
    : '0'
  const totalChargingPoints = typeof summary.total_charging_points === 'number'
    ? summary.total_charging_points.toLocaleString()
    : '0'

  const kpis = [
    {
      label: 'Total EV Fleet (2024)',
      value: totalFleet.toLocaleString(),
      unit: 'vehicles',
      color: 'text-green-400',
    },
    {
      label: 'V2G Capable Vehicles',
      value: `${v2gCapable.toLocaleString()} (${v2gCapablePct}%)`,
      unit: 'of fleet',
      color: 'text-cyan-400',
    },
    {
      label: 'Avg V2G Net Benefit',
      value: `A$${avgV2GBenefit}`,
      unit: 'per vehicle / year',
      color: 'text-yellow-400',
    },
    {
      label: 'Total Charging Points',
      value: totalChargingPoints,
      unit: 'installed',
      color: 'text-purple-400',
    },
  ]

  // ---- Chart 1: EV Fleet Growth by Segment (stacked BarChart) ----
  const fleetSegStateMap: Record<string, Record<string, number>> = {}
  fleet.forEach((f: EVGIFleetRecord) => {
    if (f.year !== 2024) return
    if (!fleetSegStateMap[f.segment]) fleetSegStateMap[f.segment] = {}
    fleetSegStateMap[f.segment][f.state] = (fleetSegStateMap[f.segment][f.state] ?? 0) + f.registered_count
  })
  const fleetChartData = Object.entries(fleetSegStateMap).map(([segment, states]) => ({
    segment,
    ...states,
  }))
  const fleetStates = [...new Set(fleet.map((f) => f.state))]
  const fleetStateColors = ['#6366f1', '#22d3ee', '#f59e0b', '#34d399', '#f87171']

  // ---- Chart 2: Charging Session Profile (sessions by charge_type + offpeak line) ----
  const chargingTypeMap: Record<string, { sessions: number; offpeak: number; count: number }> = {}
  charging.forEach((c: EVGIChargingRecord) => {
    if (!chargingTypeMap[c.charge_type]) chargingTypeMap[c.charge_type] = { sessions: 0, offpeak: 0, count: 0 }
    chargingTypeMap[c.charge_type].sessions += c.sessions_count
    chargingTypeMap[c.charge_type].offpeak += c.offpeak_share_pct
    chargingTypeMap[c.charge_type].count += 1
  })
  const chargingChartData = Object.entries(chargingTypeMap).map(([charge_type, v]) => ({
    charge_type,
    sessions: Math.round(v.sessions),
    avg_offpeak_pct: +(v.offpeak / v.count).toFixed(1),
  }))

  // ---- Chart 3: V2G Revenue Potential (grouped BarChart by technology_type) ----
  const v2gTechMap: Record<string, { fcas: number; arbitrage: number; peak_shaving: number; count: number }> = {}
  v2g.forEach((r: EVGIV2GRecord) => {
    if (!v2gTechMap[r.technology_type])
      v2gTechMap[r.technology_type] = { fcas: 0, arbitrage: 0, peak_shaving: 0, count: 0 }
    v2gTechMap[r.technology_type].fcas += r.fcas_revenue_aud_per_vehicle_year
    v2gTechMap[r.technology_type].arbitrage += r.arbitrage_revenue_aud_per_vehicle_year
    v2gTechMap[r.technology_type].peak_shaving += r.peak_shaving_revenue_aud_per_vehicle_year
    v2gTechMap[r.technology_type].count += 1
  })
  const v2gChartData = Object.entries(v2gTechMap).map(([tech, v]) => ({
    tech,
    FCAS: +(v.fcas / v.count).toFixed(0),
    Arbitrage: +(v.arbitrage / v.count).toFixed(0),
    'Peak Shaving': +(v.peak_shaving / v.count).toFixed(0),
  }))

  // ---- Chart 4: Network Impact Trend (LineChart quarterly) ----
  const networkQuarterMap: Record<string, { ev_peak: number; managed_shift: number; count: number }> = {}
  network_impact.forEach((n: EVGINetworkRecord) => {
    if (!networkQuarterMap[n.quarter]) networkQuarterMap[n.quarter] = { ev_peak: 0, managed_shift: 0, count: 0 }
    networkQuarterMap[n.quarter].ev_peak += n.ev_peak_demand_mw
    networkQuarterMap[n.quarter].managed_shift += n.managed_charging_mw_shifted
    networkQuarterMap[n.quarter].count += 1
  })
  const networkChartData = Object.entries(networkQuarterMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarter, v]) => ({
      quarter,
      ev_peak_demand_mw: +(v.ev_peak / v.count).toFixed(2),
      managed_charging_mw_shifted: +(v.managed_shift / v.count).toFixed(2),
    }))

  // ---- Chart 5: Charging Infrastructure (horizontal BarChart by charger_type) ----
  const infraTypeMap: Record<string, { total: number; utilisation: number; count: number }> = {}
  infrastructure.forEach((inf: EVGIInfrastructureRecord) => {
    if (!infraTypeMap[inf.charger_type]) infraTypeMap[inf.charger_type] = { total: 0, utilisation: 0, count: 0 }
    infraTypeMap[inf.charger_type].total += inf.total_points
    infraTypeMap[inf.charger_type].utilisation += inf.utilisation_rate_pct
    infraTypeMap[inf.charger_type].count += 1
  })
  const infraChartData = Object.entries(infraTypeMap).map(([charger_type, v]) => ({
    charger_type,
    total_points: Math.round(v.total),
    avg_utilisation_pct: +(v.utilisation / v.count).toFixed(1),
  }))

  // ---- Chart 6: Projection — EV Stock & Grid Storage dual-axis (3 scenarios) ----
  const projScenarios = ['BAU', 'Accelerated', 'V2G Enabled']
  const projYearScMap: Record<string, Record<number, { ev_stock: number; grid_storage: number }>> = {}
  projections.forEach((p: EVGIProjectionRecord) => {
    if (!projScenarios.includes(p.scenario)) return
    if (!projYearScMap[p.scenario]) projYearScMap[p.scenario] = {}
    projYearScMap[p.scenario][p.year] = { ev_stock: p.ev_stock_m, grid_storage: p.grid_storage_equivalent_gwh }
  })
  const projAllYears = [...new Set(projections.map((p) => p.year))].sort()
  const projChartData = projAllYears.map((yr) => {
    const row: Record<string, number | string> = { year: yr }
    projScenarios.forEach((sc) => {
      const entry = projYearScMap[sc]?.[yr]
      row[`${sc}_ev`] = entry?.ev_stock ?? 0
      row[`${sc}_storage`] = entry?.grid_storage ?? 0
    })
    return row
  })
  const scenarioColors: Record<string, string> = {
    BAU: '#6366f1',
    Accelerated: '#22d3ee',
    'V2G Enabled': '#34d399',
  }
  const scenarioStorageColors: Record<string, string> = {
    BAU: '#a5b4fc',
    Accelerated: '#67e8f9',
    'V2G Enabled': '#86efac',
  }

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Plug size={28} className="text-green-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">EV Grid Integration & V2G Analytics</h1>
          <p className="text-sm text-gray-400">
            Electric vehicle charging demand, smart charging impact, Vehicle-to-Grid revenue potential and network analytics — Australia
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.unit}</p>
          </div>
        ))}
      </div>

      {/* Row 1: Fleet Growth + Charging Session Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart 1: EV Fleet Growth by Segment */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">EV Fleet Growth by Segment (2024, by State)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={fleetChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="segment"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number) => [v.toLocaleString(), 'Vehicles']}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {fleetStates.map((st, idx) => (
                <Bar
                  key={st}
                  dataKey={st}
                  stackId="fleet"
                  fill={fleetStateColors[idx % fleetStateColors.length]}
                  name={st}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Charging Session Profile */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Charging Session Profile by Type</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chargingChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="charge_type"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar yAxisId="left" dataKey="sessions" fill="#6366f1" name="Total Sessions" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avg_offpeak_pct"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b', r: 4 }}
                name="Off-Peak Share (%)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: V2G Revenue + Network Impact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart 3: V2G Revenue Potential */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">V2G Revenue Potential by Technology Type (AUD/vehicle/year)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={v2gChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="tech"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number) => [`A$${v}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="FCAS" fill="#22d3ee" name="FCAS Revenue" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Arbitrage" fill="#f59e0b" name="Arbitrage Revenue" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Peak Shaving" fill="#34d399" name="Peak Shaving Revenue" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Network Impact Trend */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Network Impact Trend — EV Peak Demand & Managed Charging Shifted (MW)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={networkChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="quarter"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                interval={1}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number) => [`${v.toFixed(1)} MW`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Line
                type="monotone"
                dataKey="ev_peak_demand_mw"
                stroke="#f87171"
                strokeWidth={2}
                dot={{ fill: '#f87171', r: 3 }}
                name="EV Peak Demand (MW)"
              />
              <Line
                type="monotone"
                dataKey="managed_charging_mw_shifted"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ fill: '#34d399', r: 3 }}
                name="Managed Charging Shifted (MW)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Infrastructure + Projection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart 5: Charging Infrastructure (horizontal bar) */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Charging Infrastructure by Type — Total Points</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={infraChartData}
              layout="vertical"
              margin={{ top: 5, right: 40, left: 120, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                dataKey="charger_type"
                type="category"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                width={115}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number, name: string) => {
                  if (name === 'Total Points') return [v.toLocaleString(), name]
                  return [`${v}%`, 'Avg Utilisation']
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="total_points" fill="#a78bfa" name="Total Points" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 6: Projection — EV Stock & Grid Storage Equivalent */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Projection: EV Stock (M) & Grid Storage Equivalent (GWh) 2025–2034</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={projChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="ev" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="storage" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {projScenarios.map((sc) => (
                <Line
                  key={`${sc}_ev`}
                  yAxisId="ev"
                  type="monotone"
                  dataKey={`${sc}_ev`}
                  stroke={scenarioColors[sc]}
                  strokeWidth={2}
                  dot={false}
                  name={`${sc} EV Stock (M)`}
                />
              ))}
              {projScenarios.map((sc) => (
                <Line
                  key={`${sc}_storage`}
                  yAxisId="storage"
                  type="monotone"
                  dataKey={`${sc}_storage`}
                  stroke={scenarioStorageColors[sc]}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  name={`${sc} Grid Storage (GWh)`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
