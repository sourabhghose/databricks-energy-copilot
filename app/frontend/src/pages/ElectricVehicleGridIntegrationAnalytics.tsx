import { useEffect, useState } from 'react'
import { Car } from 'lucide-react'
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
  getElectricVehicleGridIntegrationDashboard,
  EVGIXDashboard,
} from '../api/client'

const BEHAVIOUR_COLOURS: Record<string, string> = {
  'Home Only': '#34d399',
  'Work Only': '#60a5fa',
  'Public': '#f59e0b',
  'Mixed': '#a78bfa',
}

const STATUS_COLOURS: Record<string, string> = {
  Active: '#34d399',
  Pilot: '#60a5fa',
  Proposed: '#f59e0b',
}

const LINE_COLOURS = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#f87171']
const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

export default function ElectricVehicleGridIntegrationAnalytics() {
  const [data, setData] = useState<EVGIXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricVehicleGridIntegrationDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading EV Grid Integration Analytics...</span>
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

  const { fleet, charging_load, v2g, infrastructure, grid_impact, summary } = data

  // ---- Chart 1: Fleet segment EV counts (2024 vs 2030 forecast) ----
  const fleetChartData = fleet.map((f) => ({
    name: f.segment_name.replace(' ', '\n'),
    ev_count_2024: f.ev_count_2024,
    ev_count_2030_forecast: f.ev_count_2030_forecast,
    charging_behaviour: f.charging_behaviour,
  }))

  // ---- Chart 2: Monthly peak charging load trend 2022-2024 per region ----
  // Build time-series: year-month labels × region
  const allYearMonths = Array.from(
    new Set(charging_load.map((cl) => `${cl.year}-${String(cl.month).padStart(2, '0')}`))
  ).sort()
  const chargingTrendData = allYearMonths.map((ym) => {
    const row: Record<string, string | number> = { label: ym }
    REGIONS.forEach((r) => {
      const match = charging_load.find(
        (cl) => `${cl.year}-${String(cl.month).padStart(2, '0')}` === ym && cl.region === r
      )
      row[r] = match ? match.peak_charging_load_mw : 0
    })
    return row
  })

  // ---- Chart 3: V2G program total_capacity_mw by status ----
  const v2gChartData = v2g.map((p) => ({
    name: p.program_name.length > 22 ? p.program_name.slice(0, 22) + '...' : p.program_name,
    total_capacity_mw: p.total_capacity_mw,
    status: p.status,
  }))

  // ---- Chart 4: Infrastructure installed_count by charger_type × state for 2024 ----
  const infra2024 = infrastructure.filter((i) => i.year === 2024)
  const chargerTypes = Array.from(new Set(infra2024.map((i) => i.charger_type)))
  const infraStates = Array.from(new Set(infra2024.map((i) => i.state))).sort()
  const infraChartData = infraStates.map((state) => {
    const row: Record<string, string | number> = { state }
    chargerTypes.forEach((ct) => {
      const match = infra2024.find((i) => i.state === state && i.charger_type === ct)
      row[ct] = match ? match.installed_count : 0
    })
    return row
  })

  // ---- Chart 5: Quarterly ev_load_peak_increase vs smart_charging_peak_reduction + net impact ----
  const gridImpactData = (() => {
    const combined: Record<string, { ev_increase: number; smart_reduction: number; net: number; count: number }> = {}
    grid_impact.forEach((gi) => {
      const key = `${gi.year} ${gi.quarter}`
      if (!combined[key]) combined[key] = { ev_increase: 0, smart_reduction: 0, net: 0, count: 0 }
      combined[key].ev_increase += gi.ev_load_peak_increase_mw
      combined[key].smart_reduction += gi.smart_charging_peak_reduction_mw
      combined[key].net += gi.net_grid_impact_m_aud
      combined[key].count += 1
    })
    return Object.entries(combined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, vals]) => ({
        label,
        ev_load_peak_increase_mw: Math.round(vals.ev_increase),
        smart_charging_peak_reduction_mw: Math.round(vals.smart_reduction),
        net_grid_impact_m_aud: Math.round(vals.net * 10) / 10,
      }))
  })()

  // ---- KPI Cards ----
  const kpis = [
    {
      label: 'Total EVs 2024',
      value: summary.total_evs_2024.toLocaleString(),
      unit: 'vehicles',
      color: 'text-green-400',
    },
    {
      label: 'Total Charging Capacity',
      value: summary.total_charging_capacity_mw.toLocaleString(),
      unit: 'MW',
      color: 'text-cyan-400',
    },
    {
      label: 'Smart Charging Enrolled',
      value: `${summary.smart_charging_enrolled_pct.toFixed(1)}%`,
      unit: 'of fleet',
      color: 'text-amber-400',
    },
    {
      label: 'V2G Capacity',
      value: summary.v2g_capacity_mw.toFixed(1),
      unit: 'MW',
      color: 'text-purple-400',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Car className="h-8 w-8 text-green-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Electric Vehicle Grid Integration Analytics
          </h1>
          <p className="text-gray-400 text-sm">
            EV fleet, V2G programs, charging infrastructure and grid impact — Australia
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-xs mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-gray-500 text-xs">{kpi.unit}</p>
          </div>
        ))}
      </div>

      {/* Chart 1: Fleet Segments */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          EV Fleet Segments — 2024 vs 2030 Forecast
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={fleetChartData} margin={{ top: 10, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 16 }} />
            <Bar dataKey="ev_count_2024" name="EV Count 2024" fill="#34d399" radius={[3, 3, 0, 0]} />
            <Bar dataKey="ev_count_2030_forecast" name="EV Count 2030 Forecast" fill="#60a5fa" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Monthly Peak Charging Load Trend */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Monthly Peak Charging Load Trend 2022–2024 by Region (MW)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chargingTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={2}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 16 }} />
            {REGIONS.map((r, idx) => (
              <Line
                key={r}
                type="monotone"
                dataKey={r}
                stroke={LINE_COLOURS[idx]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: V2G Programs Capacity */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          V2G Program Total Capacity by Status (MW)
        </h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={v2gChartData} margin={{ top: 10, right: 20, left: 10, bottom: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            <Bar
              dataKey="total_capacity_mw"
              name="Total Capacity (MW)"
              radius={[3, 3, 0, 0]}
              fill="#34d399"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Infrastructure by Charger Type & State (2024) */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Charger Infrastructure Installed Count by State (2024)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={infraChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            {chargerTypes.map((ct, idx) => (
              <Bar
                key={ct}
                dataKey={ct}
                name={ct}
                fill={LINE_COLOURS[idx % LINE_COLOURS.length]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Grid Impact — EV Load Increase vs Smart Charging Reduction */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Quarterly Grid Impact — EV Load Increase vs Smart Charging Reduction (MW)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={gridImpactData} margin={{ top: 10, right: 20, left: 10, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 16 }} />
            <Line
              type="monotone"
              dataKey="ev_load_peak_increase_mw"
              name="EV Peak Load Increase (MW)"
              stroke="#f87171"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="smart_charging_peak_reduction_mw"
              name="Smart Charging Reduction (MW)"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="net_grid_impact_m_aud"
              name="Net Grid Impact (M AUD)"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
