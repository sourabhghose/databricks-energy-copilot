import { useEffect, useState } from 'react'
import { Factory } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, LineChart, Line,
} from 'recharts'
import {
  getCFRADashboard,
  CFRADashboard,
  CFRAUnitRecord,
  CFRAReplacementRecord,
  CFRACapacityRecord,
  CFRAReliabilityRecord,
} from '../api/client'

const STATE_COLORS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#8b5cf6',
  QLD: '#f59e0b',
  SA: '#ef4444',
  TAS: '#10b981',
}

const TECH_COLORS: Record<string, string> = {
  BATTERY_4HR: '#06b6d4',
  GAS_PEAKER: '#f97316',
  ONSHORE_WIND: '#22c55e',
  SOLAR_FARM: '#eab308',
  PUMPED_HYDRO: '#6366f1',
  OFFSHORE_WIND: '#0ea5e9',
}

const REGION_COLORS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#8b5cf6',
  QLD: '#f59e0b',
  SA: '#ef4444',
  TAS: '#10b981',
}

export default function CoalFleetRetirementPathwayAnalytics() {
  const [data, setData] = useState<CFRADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCFRADashboard().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="p-6 text-red-400">Error: {error}</div>
  if (!data) return <div className="p-6 text-gray-400">Loading Coal Fleet Retirement Pathway Analytics...</div>

  // ---- KPI Calculations ----
  const totalCoalCapacityGW = data.units.reduce((s, u) => s + u.capacity_mw, 0) / 1000
  const unitsRetiringBy2030 = data.units.filter((u) => u.retirement_year <= 2030).length
  const replacementCommittedGW = data.replacements
    .filter((r) => r.status === 'COMMITTED')
    .reduce((s, r) => s + r.capacity_mw, 0) / 1000
  const workersAffectedK = data.units.reduce((s, u) => s + u.workforce, 0) / 1000

  // ---- Bar chart: retirement timeline (capacity MW by unit, colored by state) ----
  const retirementTimeline = data.units
    .slice()
    .sort((a, b) => a.retirement_year - b.retirement_year)
    .map((u) => ({
      unit: u.unit_name,
      capacity_mw: u.capacity_mw,
      state: u.state,
      retirement_year: u.retirement_year,
      fill: STATE_COLORS[u.state] || '#6b7280',
    }))

  // ---- Area chart: NEM coal vs replacement capacity 2024-2040 ----
  const capacityTrajectory = data.capacity_trajectory
    .slice()
    .sort((a, b) => a.year - b.year)

  // ---- Stacked bar: replacement technology mix per retiring station ----
  const stationSet = [...new Set(data.replacements.map((r) => r.replacing_station))]
  const techMixData = stationSet.map((station) => {
    const row: Record<string, string | number> = { station }
    const projects = data.replacements.filter((r) => r.replacing_station === station)
    for (const p of projects) {
      row[p.technology] = ((row[p.technology] as number) || 0) + p.capacity_mw
    }
    return row
  })

  // ---- Line chart: reliability margin with / without coal per region ----
  const regions = [...new Set(data.reliability.map((r) => r.region))]
  const reliabilityYears = [...new Set(data.reliability.map((r) => r.year))].sort((a, b) => a - b)
  const reliabilityData = reliabilityYears.map((yr) => {
    const row: Record<string, number | string> = { year: yr }
    for (const reg of regions) {
      const rec = data.reliability.find((r) => r.region === reg && r.year === yr)
      if (rec) {
        row[`${reg}_with`] = rec.reliability_margin_with_coal_pct
        row[`${reg}_without`] = rec.reliability_margin_without_coal_pct
      }
    }
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Factory className="text-orange-400" size={28} />
        <h1 className="text-2xl font-bold tracking-tight">Coal Fleet Retirement Pathway Analytics</h1>
        <span className="ml-auto text-xs text-gray-500">{data.timestamp}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Coal Capacity', value: `${totalCoalCapacityGW.toFixed(1)} GW`, color: 'text-red-400' },
          { label: 'Units Retiring by 2030', value: String(unitsRetiringBy2030), color: 'text-amber-400' },
          { label: 'Replacement Committed', value: `${replacementCommittedGW.toFixed(1)} GW`, color: 'text-green-400' },
          { label: 'Workers Affected', value: `${workersAffectedK.toFixed(1)}k`, color: 'text-blue-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Chart: Retirement Timeline */}
      <section className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Coal Unit Retirement Timeline (Capacity MW by Unit)</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={retirementTimeline} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="unit" angle={-45} textAnchor="end" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={0} />
            <YAxis tick={{ fill: '#9ca3af' }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
            <Legend />
            {Object.entries(STATE_COLORS).map(([state, color]) => (
              <Bar
                key={state}
                dataKey="capacity_mw"
                name={state}
                fill={color}
                hide={false}
                // Only show bars for matching state
                data={retirementTimeline.filter((d) => d.state === state)}
              />
            ))}
            <Bar dataKey="capacity_mw" name="Capacity MW">
              {retirementTimeline.map((entry, idx) => (
                <rect key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Chart: NEM Coal Capacity vs Replacement Capacity */}
      <section className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">NEM Coal Capacity Decline vs Replacement Ramp-up (2024-2040)</h2>
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={capacityTrajectory} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af' }} />
            <YAxis tick={{ fill: '#9ca3af' }} label={{ value: 'GW', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
            <Legend />
            <Area type="monotone" dataKey="coal_capacity_gw" name="Coal Capacity GW" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
            <Area type="monotone" dataKey="total_replacement_gw" name="Replacement Capacity GW" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      {/* Chart: Replacement Technology Mix per Station */}
      <section className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Replacement Technology Mix per Retiring Station (MW)</h2>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={techMixData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="station" tick={{ fill: '#9ca3af' }} />
            <YAxis tick={{ fill: '#9ca3af' }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
            <Legend />
            {Object.entries(TECH_COLORS).map(([tech, color]) => (
              <Bar key={tech} dataKey={tech} stackId="a" fill={color} name={tech.replace(/_/g, ' ')} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Chart: Regional Reliability Margin */}
      <section className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Regional Reliability Margin With & Without Coal (%)</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={reliabilityData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af' }} />
            <YAxis tick={{ fill: '#9ca3af' }} label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
            <Legend />
            {regions.map((reg) => (
              <Line key={`${reg}_with`} type="monotone" dataKey={`${reg}_with`} name={`${reg} With Coal`} stroke={REGION_COLORS[reg]} strokeWidth={2} dot={false} />
            ))}
            {regions.map((reg) => (
              <Line key={`${reg}_without`} type="monotone" dataKey={`${reg}_without`} name={`${reg} Without Coal`} stroke={REGION_COLORS[reg]} strokeWidth={2} strokeDasharray="5 5" dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Table: Coal Unit Register */}
      <section className="bg-gray-800 rounded-xl p-5 border border-gray-700 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">Coal Unit Register</h2>
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-gray-400 border-b border-gray-700">
            <tr>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Station</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2 text-right">Capacity MW</th>
              <th className="px-3 py-2 text-right">Age Yrs</th>
              <th className="px-3 py-2 text-right">Retirement Year</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Replacement Status</th>
            </tr>
          </thead>
          <tbody>
            {data.units.map((u) => {
              const hasReplacement = data.replacements.some((r) => r.replacing_station === u.station_name)
              return (
                <tr key={u.unit_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-3 py-2 font-medium">{u.unit_name}</td>
                  <td className="px-3 py-2">{u.station_name}</td>
                  <td className="px-3 py-2">{u.state}</td>
                  <td className="px-3 py-2 text-right">{u.capacity_mw.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{u.age_years}</td>
                  <td className="px-3 py-2 text-right">{u.retirement_year}</td>
                  <td className="px-3 py-2">{u.owner}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${hasReplacement ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                      {hasReplacement ? 'Replacement Planned' : 'No Replacement'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {/* Table: Replacement Project Tracker */}
      <section className="bg-gray-800 rounded-xl p-5 border border-gray-700 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">Replacement Project Tracker</h2>
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-gray-400 border-b border-gray-700">
            <tr>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Replacing</th>
              <th className="px-3 py-2">Technology</th>
              <th className="px-3 py-2 text-right">Capacity MW</th>
              <th className="px-3 py-2 text-right">COD Year</th>
              <th className="px-3 py-2 text-right">Investment (B AUD)</th>
            </tr>
          </thead>
          <tbody>
            {data.replacements.map((r) => (
              <tr key={r.project_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-3 py-2 font-medium">{r.project_name}</td>
                <td className="px-3 py-2">{r.replacing_station}</td>
                <td className="px-3 py-2">{r.technology.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2 text-right">{r.capacity_mw.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{r.cod_year}</td>
                <td className="px-3 py-2 text-right">${r.investment_b_aud.toFixed(1)}B</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
