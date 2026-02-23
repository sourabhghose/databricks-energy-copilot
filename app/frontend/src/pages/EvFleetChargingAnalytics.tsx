import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Zap, Battery, TrendingUp, Leaf } from 'lucide-react'
import {
  getEvFleetChargingDashboard,
  EVFCDashboard,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const CHARGER_TYPE_COLOURS: Record<string, string> = {
  'AC Level 2':          '#60a5fa',
  'DC Fast (50kW)':      '#facc15',
  'Ultra-Fast (150kW+)': '#f87171',
  'Depot Overnight':     '#4ade80',
}

const VEHICLE_TYPE_COLOURS: Record<string, string> = {
  'Delivery Van':      '#60a5fa',
  'Bus':               '#4ade80',
  'Taxi/Rideshare':    '#facc15',
  'Government Fleet':  '#f87171',
  'Heavy Truck':       '#fb923c',
}

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#facc15',
  VIC1: '#4ade80',
  SA1:  '#f87171',
  TAS1: '#a78bfa',
}

const SCENARIO_COLOURS: Record<string, string> = {
  'Moderate':      '#60a5fa',
  'High Adoption': '#4ade80',
  'Fleet Led':     '#facc15',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, Icon }: {
  label: string; value: string; sub?: string; Icon: React.ElementType
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow-lg">
      <div className="p-3 bg-gray-700 rounded-lg">
        <Icon className="w-6 h-6 text-cyan-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EvFleetChargingAnalytics() {
  const [data, setData] = useState<EVFCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEvFleetChargingDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 bg-gray-900">
        Loading EV Fleet Charging Infrastructure Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 bg-gray-900">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>

  // ─── Chart 1: Bar — max_power_mw by hub_name (top 15) coloured by charger_type ──
  const top15Hubs = [...data.hubs]
    .sort((a, b) => b.max_power_mw - a.max_power_mw)
    .slice(0, 15)
    .map(h => ({
      hub_name: h.hub_name.length > 20 ? h.hub_name.slice(0, 18) + '…' : h.hub_name,
      max_power_mw: h.max_power_mw,
      charger_type: h.charger_type,
    }))

  // ─── Chart 2: Bar — ev_count by fleet_owner sorted desc coloured by vehicle_type ─
  const fleetBarData = [...data.fleets]
    .sort((a, b) => b.ev_count - a.ev_count)
    .map(f => ({
      fleet_owner: f.fleet_owner.length > 18 ? f.fleet_owner.slice(0, 16) + '…' : f.fleet_owner,
      ev_count: f.ev_count,
      vehicle_type: f.vehicle_type,
    }))

  // ─── Chart 3: Line — net_grid_impact_mw by year for 5 regions ────────────
  const impactYearsSet = new Set<number>()
  data.grid_impacts.forEach(g => impactYearsSet.add(g.year))
  const impactYears = Array.from(impactYearsSet).sort((a, b) => a - b)
  const impactLineData = impactYears.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    for (const region of Object.keys(REGION_COLOURS)) {
      const rec = data.grid_impacts.find(g => g.year === yr && g.region === region)
      row[region] = rec ? rec.net_grid_impact_mw : 0
    }
    return row
  })

  // ─── Chart 4: Line — total_charging_energy_twh by year for 3 scenarios ───
  const projYearsSet = new Set<number>()
  data.projections.forEach(p => projYearsSet.add(p.year))
  const projYears = Array.from(projYearsSet).sort((a, b) => a - b)
  const scenarios = Object.keys(SCENARIO_COLOURS)
  const projLineData = projYears.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    scenarios.forEach(sc => {
      const rec = data.projections.find(p => p.year === yr && p.scenario === sc)
      row[sc] = rec ? rec.total_charging_energy_twh : 0
    })
    return row
  })

  // ─── Chart 5: Bar — off_peak_per_kwh vs peak_per_kwh grouped by tariff_name ─
  const tariffBarData = data.tariffs.map(t => ({
    tariff_name: t.tariff_name.length > 20 ? t.tariff_name.slice(0, 18) + '…' : t.tariff_name,
    'Off-Peak ($/kWh)': t.off_peak_per_kwh,
    'Peak ($/kWh)': t.peak_per_kwh,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold">EV Fleet Charging Infrastructure Analytics</h1>
          <p className="text-sm text-gray-400">
            Charging hubs, fleet demand, grid impact, tariffs and infrastructure projections across NEM regions
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Installed Chargers"
          value={String(summary.total_installed_chargers ?? '—')}
          sub="Across all hubs & regions"
          Icon={Zap}
        />
        <KpiCard
          label="Total EV Fleets"
          value={`${summary.total_ev_fleets_k ?? '—'}k`}
          sub="Fleet vehicles on network"
          Icon={Battery}
        />
        <KpiCard
          label="Avg Utilisation"
          value={`${summary.avg_utilisation_pct ?? '—'}%`}
          sub="Across all charging hubs"
          Icon={TrendingUp}
        />
        <KpiCard
          label="Renewable Charging"
          value={`${summary.renewable_charging_pct ?? '—'}%`}
          sub="2024 baseline, all regions"
          Icon={Leaf}
        />
      </div>

      {/* Chart 1: Bar — max_power_mw by hub_name (top 15) */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Top 15 Charging Hubs by Max Power (MW), coloured by Charger Type
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top15Hubs} margin={{ top: 4, right: 16, bottom: 80, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="hub_name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`${val} MW`, 'Max Power']}
            />
            <Bar dataKey="max_power_mw" name="Max Power (MW)">
              {top15Hubs.map((entry, idx) => (
                <rect
                  key={idx}
                  fill={CHARGER_TYPE_COLOURS[entry.charger_type] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-3">
          {Object.entries(CHARGER_TYPE_COLOURS).map(([type, colour]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {type}
            </div>
          ))}
        </div>
      </div>

      {/* Chart 2: Bar — ev_count by fleet_owner sorted desc */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          EV Count by Fleet Owner (sorted descending), coloured by Vehicle Type
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={fleetBarData} margin={{ top: 4, right: 16, bottom: 80, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="fleet_owner"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'EVs', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [val.toLocaleString(), 'EV Count']}
            />
            <Bar dataKey="ev_count" name="EV Count">
              {fleetBarData.map((entry, idx) => (
                <rect
                  key={idx}
                  fill={VEHICLE_TYPE_COLOURS[entry.vehicle_type] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-3">
          {Object.entries(VEHICLE_TYPE_COLOURS).map(([type, colour]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {type}
            </div>
          ))}
        </div>
      </div>

      {/* Chart 3: Line — net_grid_impact_mw by year for 5 regions */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Net Grid Impact by Year and Region (MW), 2024–2035
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={impactLineData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            {Object.keys(REGION_COLOURS).map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLOURS[region] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
                name={region}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Line — total_charging_energy_twh by year for 3 scenarios */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Total Charging Energy by Scenario 2025–2035 (TWh)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={projLineData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'TWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            {scenarios.map(sc => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                stroke={SCENARIO_COLOURS[sc] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
                name={sc}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Bar — off_peak vs peak rate grouped by tariff_name */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          EV Tariff Rates: Off-Peak vs Peak ($/kWh) by Tariff
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={tariffBarData} margin={{ top: 4, right: 16, bottom: 100, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="tariff_name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '$/kWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`$${val.toFixed(4)}/kWh`]}
            />
            <Legend />
            <Bar dataKey="Off-Peak ($/kWh)" fill="#4ade80" name="Off-Peak ($/kWh)" />
            <Bar dataKey="Peak ($/kWh)" fill="#f87171" name="Peak ($/kWh)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(summary).map(([key, val]) => (
            <div key={key} className="bg-gray-700 rounded-lg p-3">
              <dt className="text-xs text-gray-400 uppercase tracking-wide break-words">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="text-base font-semibold text-white mt-1 break-words">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
