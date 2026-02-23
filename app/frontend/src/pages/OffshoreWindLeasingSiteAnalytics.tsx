import { useEffect, useState } from 'react'
import { Wind } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
} from 'recharts'
import {
  getOffshoreWindLeasingSiteDashboard,
  OWLSDashboard,
} from '../api/client'

const STATE_COLORS: Record<string, string> = {
  VIC: '#6366f1',
  NSW: '#22c55e',
  WA:  '#f59e0b',
  QLD: '#22d3ee',
  SA:  '#ef4444',
  TAS: '#a855f7',
}

const SCENARIO_COLORS: Record<string, string> = {
  'Current Policy':       '#6b7280',
  'Target 4GW by 2030':  '#22c55e',
  'Accelerated':         '#6366f1',
}

const FOUNDATION_COLORS: Record<string, string> = {
  'Monopile':          '#6366f1',
  'Jacket':            '#22c55e',
  'Floating Semi-Sub': '#f59e0b',
  'Floating Spar':     '#22d3ee',
  'TLP':               '#ef4444',
}

export default function OffshoreWindLeasingSiteAnalytics() {
  const [data, setData]       = useState<OWLSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getOffshoreWindLeasingSiteDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading Offshore Wind Leasing &amp; Site Analytics...</span>
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

  const { areas, licences, resources, supply_chain, costs, projections, summary } = data

  // ---- KPI Cards ----
  const kpis = [
    {
      label: 'Total Declared Area',
      value: `${(summary.total_declared_area_km2 as number).toLocaleString()} km²`,
      sub: 'Formally declared offshore areas',
      color: 'text-indigo-400',
    },
    {
      label: 'Total Capacity Potential',
      value: `${(summary.total_capacity_potential_gw as number).toFixed(1)} GW`,
      sub: 'Across all declared/proposed areas',
      color: 'text-green-400',
    },
    {
      label: 'Licences Under Assessment',
      value: `${summary.licences_under_assessment}`,
      sub: 'Applications with DCCEEW/AEMO',
      color: 'text-yellow-400',
    },
    {
      label: 'Avg Wind Speed',
      value: `${(summary.avg_wind_speed_m_s as number).toFixed(1)} m/s`,
      sub: 'Mean across all declared areas',
      color: 'text-cyan-400',
    },
  ]

  // ---- Chart 1: Area Capacity Potential by State (BarChart) ----
  const areaCapacityData = areas.map((a) => ({
    name: a.area_name.length > 22 ? a.area_name.slice(0, 20) + '…' : a.area_name,
    fullName: a.area_name,
    state: a.state,
    capacity_potential_gw: a.capacity_potential_gw,
    fill: STATE_COLORS[a.state] ?? '#6366f1',
  }))

  // ---- Chart 2: Resource Assessment Scatter ----
  const scatterData = resources.map((r) => {
    const area = areas.find((a) => a.area_id === r.area_id)
    return {
      avg_wind_speed_m_s: r.avg_wind_speed_m_s,
      p50_capacity_factor_pct: r.p50_capacity_factor_pct,
      capacity_area: area ? area.capacity_potential_gw * 100 : 100,
      name: r.location_name,
      state: area?.state ?? 'VIC',
    }
  })

  // ---- Chart 3: Licence Pipeline stacked by foundation_type × status ----
  const statusList = ['Applied', 'Under Assessment', 'Granted', 'Suspended', 'Withdrawn']
  const foundationList = Array.from(new Set(licences.map((l) => l.foundation_type)))

  const licencePipelineByStatus: Record<string, Record<string, number>> = {}
  licences.forEach((l) => {
    if (!licencePipelineByStatus[l.status]) licencePipelineByStatus[l.status] = {}
    licencePipelineByStatus[l.status][l.foundation_type] =
      (licencePipelineByStatus[l.status][l.foundation_type] ?? 0) + l.capacity_mw
  })
  const licencePipelineData = statusList
    .filter((s) => licencePipelineByStatus[s])
    .map((s) => ({ status: s, ...licencePipelineByStatus[s] }))

  // ---- Chart 4: Supply Chain Localisation (horizontal BarChart) ----
  const supplyChainData = supply_chain.map((s) => ({
    component: s.component.length > 18 ? s.component.slice(0, 16) + '…' : s.component,
    fullName: s.component,
    'Current AU Supply': s.australian_supply_capacity_pct,
    'Localisation Potential': s.localisation_potential_pct,
  }))

  // ---- Chart 5: LCOE Cost Trajectory by foundation type (LineChart) ----
  const lcoeByYear: Record<number, Record<string, number>> = {}
  costs.forEach((c) => {
    if (!lcoeByYear[c.year]) lcoeByYear[c.year] = { year: c.year }
    lcoeByYear[c.year][c.foundation_type] = c.lcoe_aud_per_mwh
  })
  const lcoeTrendData = Object.values(lcoeByYear).sort((a, b) => (a.year as number) - (b.year as number))

  // ---- Chart 6: Scenario Cumulative Capacity (AreaChart) ----
  const scenarioByYear: Record<number, Record<string, number>> = {}
  projections.forEach((p) => {
    if (!scenarioByYear[p.year]) scenarioByYear[p.year] = { year: p.year }
    scenarioByYear[p.year][p.scenario] = p.cumulative_capacity_gw
  })
  const scenarioCapacityData = Object.values(scenarioByYear).sort(
    (a, b) => (a.year as number) - (b.year as number),
  )

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Wind className="text-cyan-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Offshore Wind Leasing &amp; Site Analytics
          </h1>
          <p className="text-gray-400 text-sm">
            Australia declared offshore areas, licence applications, wind resource assessment,
            seabed characteristics, supply chain and LCOE trajectory under AEMO/DCCEEW
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-gray-500 text-xs mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart 1: Area Capacity Potential by State */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Area Capacity Potential by State
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Indicative offshore wind capacity potential (GW) across declared and proposed areas
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={areaCapacityData}
            margin={{ top: 5, right: 20, left: 10, bottom: 90 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              stroke="#9ca3af"
              tick={{ fontSize: 9 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" GW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number, _n: string, props: { payload?: { fullName?: string; state?: string } }) => [
                `${v} GW`,
                props.payload?.fullName ?? '',
              ]}
            />
            <Bar dataKey="capacity_potential_gw" name="Capacity Potential (GW)" radius={[3, 3, 0, 0]}>
              {areaCapacityData.map((entry, i) => (
                <rect key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* State legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(STATE_COLORS).map(([state, color]) => (
            <div key={state} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              {state}
            </div>
          ))}
        </div>
      </div>

      {/* Chart 2: Resource Assessment Scatter */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Wind Resource Assessment
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Average wind speed vs P50 capacity factor — bubble size proportional to area capacity potential
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              dataKey="avg_wind_speed_m_s"
              name="Avg Wind Speed"
              unit=" m/s"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              domain={[8, 12]}
            />
            <YAxis
              type="number"
              dataKey="p50_capacity_factor_pct"
              name="P50 Capacity Factor"
              unit="%"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              domain={[38, 56]}
            />
            <ZAxis type="number" dataKey="capacity_area" range={[40, 400]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(v: number, name: string) => [
                name === 'Avg Wind Speed' ? `${v} m/s` : `${v}%`,
                name,
              ]}
            />
            <Scatter
              name="Resource Sites"
              data={scatterData}
              fill="#22d3ee"
              fillOpacity={0.7}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Licence Pipeline Status */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Licence Pipeline — Capacity by Status and Foundation Type
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Stacked capacity (MW) of licence applications grouped by assessment status and foundation technology
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={licencePipelineData}
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="status" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend />
            {foundationList.map((ft) => (
              <Bar
                key={ft}
                dataKey={ft}
                stackId="a"
                fill={FOUNDATION_COLORS[ft] ?? '#6b7280'}
                radius={foundationList.indexOf(ft) === foundationList.length - 1 ? [3, 3, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Supply Chain Localisation */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Supply Chain Localisation Opportunity
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Current Australian supply capacity vs localisation potential (%) by component
        </p>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart
            data={supplyChainData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 140, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
            <YAxis
              type="category"
              dataKey="component"
              stroke="#9ca3af"
              tick={{ fontSize: 9 }}
              width={135}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number) => [`${v}%`]}
            />
            <Legend />
            <Bar dataKey="Current AU Supply" fill="#22c55e" radius={[0, 3, 3, 0]} />
            <Bar dataKey="Localisation Potential" fill="#6366f1" fillOpacity={0.7} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 & 6 side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Chart 5: LCOE Cost Trajectory */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-1">LCOE Cost Trajectory</h2>
          <p className="text-gray-400 text-xs mb-4">
            Levelised cost of energy (AUD/MWh) 2024–2034 by foundation type
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lcoeTrendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" $/MWh" domain={[60, 200]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend />
              {Object.keys(FOUNDATION_COLORS).map((ft) => (
                <Line
                  key={ft}
                  type="monotone"
                  dataKey={ft}
                  stroke={FOUNDATION_COLORS[ft]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 6: Scenario — Installed Capacity */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-1">
            Scenario: Cumulative Installed Capacity
          </h2>
          <p className="text-gray-400 text-xs mb-4">
            Projected offshore wind capacity (GW) to 2040 under three policy scenarios
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={scenarioCapacityData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" GW" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend />
              {Object.entries(SCENARIO_COLORS).map(([scenario, color]) => (
                <Area
                  key={scenario}
                  type="monotone"
                  dataKey={scenario}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.25}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
