import { useEffect, useState } from 'react'
import { Battery } from 'lucide-react'
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import {
  EBTEDashboard,
  EBTEBatteryChemistry,
  EBTEAustraliaFleet,
  EBTEGridImpact,
  EBTESupplyChain,
  EBTERecycling,
  getEvBatteryTechnologyDashboard,
} from '../api/client'

// ---- Colour palettes ----
const CHEM_COLORS: Record<string, string> = {
  'LFP':         '#3b82f6',
  'NMC':         '#f59e0b',
  'NCA':         '#10b981',
  'LTO':         '#8b5cf6',
  'Solid-State': '#ef4444',
  'Sodium-Ion':  '#06b6d4',
}

const STATE_COLORS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#f59e0b',
  QLD: '#10b981',
  WA:  '#8b5cf6',
  SA:  '#ef4444',
  TAS: '#06b6d4',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#10b981',
  SA1:  '#8b5cf6',
  TAS1: '#ef4444',
}

const CRITICALITY_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#f59e0b',
}

// ---- Chart 1: Battery cost by year per chemistry (EV Passenger only) ----
function costByYearPerChem(chemistries: EBTEBatteryChemistry[]) {
  const evPassenger = chemistries.filter(c => c.application === 'EV Passenger')
  const years = [2022, 2023, 2024, 2025]
  return years.map(yr => {
    const row: Record<string, number | string> = { year: yr }
    for (const chem of Object.keys(CHEM_COLORS)) {
      const item = evPassenger.find(c => c.year === yr && c.chemistry === chem)
      if (item) row[chem] = item.cost_usd_kwh
    }
    return row
  })
}

// ---- Chart 2: EV registrations by state × year (stacked bar) ----
function evRegistrationsByStateYear(fleet: EBTEAustraliaFleet[]) {
  const years = [2021, 2022, 2023, 2024]
  return years.map(yr => {
    const row: Record<string, number | string> = { year: yr }
    for (const state of Object.keys(STATE_COLORS)) {
      const item = fleet.find(f => f.year === yr && f.state === state)
      if (item) row[state] = item.ev_registrations_k
    }
    return row
  })
}

// ---- Chart 3: EV charging demand by region × year ----
function chargingDemandByRegionYear(grid: EBTEGridImpact[]) {
  const years = [2022, 2023, 2024, 2025, 2030]
  return years.map(yr => {
    const row: Record<string, number | string> = { year: yr }
    for (const region of Object.keys(REGION_COLORS)) {
      const item = grid.find(g => g.year === yr && g.region === region)
      if (item) row[region] = item.ev_charging_demand_gwh
    }
    return row
  })
}

// ---- Chart 4: Australia reserves % by material ----
function reservesByMaterial(supply: EBTESupplyChain[]) {
  return supply.map(s => ({
    material: s.material,
    australia_reserves_pct: s.australia_reserves_pct,
    criticality: s.criticality,
  }))
}

// ---- Chart 5: Average recovery rate by chemistry ----
function avgRecoveryByChem(recycling: EBTERecycling[]) {
  const sums: Record<string, { total: number; count: number }> = {}
  for (const r of recycling) {
    if (!sums[r.chemistry]) sums[r.chemistry] = { total: 0, count: 0 }
    sums[r.chemistry].total += r.recovery_rate_pct
    sums[r.chemistry].count += 1
  }
  return Object.entries(sums).map(([chemistry, { total, count }]) => ({
    chemistry,
    avg_recovery_pct: Math.round((total / count) * 10) / 10,
  }))
}

// ---- KPI Card ----
function KpiCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
    </div>
  )
}

// ---- Main page ----
export default function EvBatteryTechnologyAnalytics() {
  const [data, setData] = useState<EBTEDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEvBatteryTechnologyDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        Loading EV Battery Technology data…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        Error loading data: {error}
      </div>
    )
  }

  const { summary, battery_chemistries, australia_fleet, grid_impact, supply_chain, recycling } = data

  const costData = costByYearPerChem(battery_chemistries)
  const fleetData = evRegistrationsByStateYear(australia_fleet)
  const chargingData = chargingDemandByRegionYear(grid_impact)
  const reservesData = reservesByMaterial(supply_chain)
  const recoveryData = avgRecoveryByChem(recycling)

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-full text-gray-100">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Battery size={28} className="text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">EV Battery Technology Economics Analytics</h1>
          <p className="text-sm text-gray-400">Battery chemistry costs, Australia EV fleet, grid impact, supply chain &amp; recycling</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total EV Fleet Australia" value={summary.total_ev_fleet_australia_k.toFixed(1)} unit="k EVs" />
        <KpiCard label="Avg Battery Cost" value={`$${summary.avg_battery_cost_usd_kwh.toFixed(2)}`} unit="/kWh" />
        <KpiCard label="Projected 2030 Cost" value={`$${summary.projected_cost_2030_usd_kwh.toFixed(2)}`} unit="/kWh" />
        <KpiCard label="Total Grid Charging" value={summary.total_grid_charging_demand_gwh.toFixed(1)} unit="GWh" />
        <KpiCard label="V2G Potential" value={summary.v2g_potential_total_mw.toFixed(1)} unit="MW" />
      </div>

      {/* Chart 1: Battery pack cost by year per chemistry */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-100 mb-4">
          Battery Pack Cost Trajectory by Chemistry — EV Passenger ($/kWh)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={costData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $/kWh" width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }}
              formatter={(v: number) => [`$${v.toFixed(2)}/kWh`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {Object.keys(CHEM_COLORS).map(chem => (
              <Line
                key={chem}
                type="monotone"
                dataKey={chem}
                stroke={CHEM_COLORS[chem]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: EV registrations by state × year (stacked bar) */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-100 mb-4">
          EV Registrations by State and Year (thousands)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={fleetData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="k" width={50} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }}
              formatter={(v: number) => [`${v.toFixed(1)}k`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {Object.keys(STATE_COLORS).map(state => (
              <Bar key={state} dataKey={state} stackId="fleet" fill={STATE_COLORS[state]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: EV charging demand by region × year */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-100 mb-4">
          EV Charging Demand by Region (GWh/year) — incl. 2030 Projection
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chargingData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" GWh" width={70} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }}
              formatter={(v: number) => [`${v.toFixed(1)} GWh`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {Object.keys(REGION_COLORS).map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLORS[region]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                strokeDasharray={undefined}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 4: Australia reserves by material */}
        <div className="bg-gray-800 rounded-lg p-5">
          <h2 className="text-base font-semibold text-gray-100 mb-4">
            Australia Share of Global Reserves by Material (%)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={reservesData}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
              <YAxis type="category" dataKey="material" tick={{ fill: '#9ca3af', fontSize: 12 }} width={80} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }}
                formatter={(v: number, _name, props) => [
                  `${v}% (${props.payload.criticality})`,
                  'AU Reserves',
                ]}
              />
              <Bar dataKey="australia_reserves_pct" radius={[0, 4, 4, 0]}>
                {reservesData.map((entry, i) => (
                  <Cell key={i} fill={CRITICALITY_COLORS[entry.criticality] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.entries(CRITICALITY_COLORS).map(([label, color]) => (
              <span key={label} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Chart 5: Avg recovery rate by chemistry */}
        <div className="bg-gray-800 rounded-lg p-5">
          <h2 className="text-base font-semibold text-gray-100 mb-4">
            Average Battery Recycling Recovery Rate by Chemistry (%)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={recoveryData}
              margin={{ top: 4, right: 24, left: 0, bottom: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="chemistry"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-20}
                textAnchor="end"
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" domain={[70, 100]} width={50} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }}
                formatter={(v: number) => [`${v.toFixed(1)}%`]}
              />
              <Bar dataKey="avg_recovery_pct" radius={[4, 4, 0, 0]}>
                {recoveryData.map((entry, i) => (
                  <Cell key={i} fill={CHEM_COLORS[entry.chemistry] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Dashboard Summary</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4">
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">EV Fleet Australia</dt>
            <dd className="text-lg font-semibold text-white mt-1">{summary.total_ev_fleet_australia_k.toFixed(1)}k</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Avg Battery Cost (2024)</dt>
            <dd className="text-lg font-semibold text-white mt-1">${summary.avg_battery_cost_usd_kwh.toFixed(2)}/kWh</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Projected Cost 2030</dt>
            <dd className="text-lg font-semibold text-white mt-1">${summary.projected_cost_2030_usd_kwh.toFixed(2)}/kWh</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Grid Charging Demand</dt>
            <dd className="text-lg font-semibold text-white mt-1">{summary.total_grid_charging_demand_gwh.toFixed(1)} GWh</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">V2G Potential</dt>
            <dd className="text-lg font-semibold text-white mt-1">{summary.v2g_potential_total_mw.toFixed(1)} MW</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
