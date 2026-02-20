import React, { useEffect, useState } from 'react'
import {
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ZAxis,
} from 'recharts'
import { Thermometer, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  api,
  ThermalEfficiencyDashboard,
  ThermalUnitRecord,
  HeatRateTrendRecord,
  FuelCostRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TECH_COLORS: Record<string, string> = {
  BLACK_COAL: '#4b5563',
  BROWN_COAL: '#92400e',
  GAS_CCGT:   '#3b82f6',
  GAS_OCGT:   '#6b7280',
  GAS_STEAM:  '#06b6d4',
}

const TECH_BADGE: Record<string, string> = {
  BLACK_COAL: 'bg-gray-600 text-white',
  BROWN_COAL: 'bg-amber-800 text-white',
  GAS_CCGT:   'bg-blue-600 text-white',
  GAS_OCGT:   'bg-gray-500 text-white',
  GAS_STEAM:  'bg-cyan-600 text-white',
}

const TECH_DISPLAY: Record<string, string> = {
  BLACK_COAL: 'Black Coal',
  BROWN_COAL: 'Brown Coal',
  GAS_CCGT:   'Gas CCGT',
  GAS_OCGT:   'Gas OCGT',
  GAS_STEAM:  'Gas Steam',
}

const TECHNOLOGIES = ['ALL', 'BLACK_COAL', 'BROWN_COAL', 'GAS_CCGT', 'GAS_OCGT', 'GAS_STEAM']

const TREND_LINE_COLORS: Record<string, string> = {
  ERA1:  '#f59e0b',
  VP5:   '#ef4444',
  LYA1:  '#8b5cf6',
  PP1:   '#3b82f6',
  DD1:   '#06b6d4',
  CAL3:  '#22c55e',
}

const TREND_UNIT_NAMES: Record<string, string> = {
  ERA1:  'Eraring 1',
  VP5:   'Vales Point 5',
  LYA1:  'Loy Yang A1',
  PP1:   'Pelican Point 1',
  DD1:   'Darling Downs 1',
  CAL3:  'Callide C3',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt1(v: number): string { return v.toFixed(1) }
function fmt2(v: number): string { return v.toFixed(2) }
function fmtB(v: number): string { return `$${v.toFixed(1)}B` }

function degradationColor(pct: number): string {
  if (pct > 10) return 'text-red-400 font-semibold'
  if (pct > 5)  return 'text-amber-400'
  return 'text-green-400'
}

function co2Color(kg: number): string {
  if (kg > 1000) return 'text-red-400'
  if (kg > 700)  return 'text-amber-400'
  return 'text-green-400'
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub?: string
  accent?: string
}

function KpiCard({ label, value, sub, accent = 'text-white' }: KpiProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Heat Rate vs Benchmark Scatter Chart
// ---------------------------------------------------------------------------

interface ScatterUnit {
  x: number
  y: number
  name: string
  technology: string
  degradation: number
}

function HeatRateScatterChart({ units }: { units: ThermalUnitRecord[] }) {
  const byTech: Record<string, ScatterUnit[]> = {}
  units.forEach((u) => {
    if (!byTech[u.technology]) byTech[u.technology] = []
    byTech[u.technology].push({
      x: u.design_heat_rate_gj_mwh,
      y: u.actual_heat_rate_gj_mwh,
      name: u.unit_name,
      technology: u.technology,
      degradation: u.heat_rate_degradation_pct,
    })
  })

  const allX = units.map((u) => u.design_heat_rate_gj_mwh)
  const minX = Math.floor(Math.min(...allX)) - 1
  const maxX = Math.ceil(Math.max(...allX)) + 1
  const diagData = [
    { x: minX, y: minX },
    { x: maxX, y: maxX },
  ]

  const CustomDot = (props: {
    cx?: number
    cy?: number
    payload?: ScatterUnit
    fill?: string
  }) => {
    const { cx = 0, cy = 0, payload, fill } = props
    if (!payload) return null
    return (
      <g>
        <circle cx={cx} cy={cy} r={8} fill={fill} fillOpacity={0.85} stroke="#1f2937" strokeWidth={1} />
        <text x={cx + 10} y={cy - 5} fill="#d1d5db" fontSize={9}>{payload.name}</text>
      </g>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-200 mb-1">Heat Rate: Design vs Actual</h2>
      <p className="text-xs text-gray-500 mb-4">Points above the diagonal line are underperforming vs design. Colour by technology.</p>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            type="number"
            dataKey="x"
            name="Design HR"
            domain={[minX, maxX]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Design Heat Rate (GJ/MWh)', position: 'bottom', fill: '#6b7280', fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Actual HR"
            domain={[minX, maxX]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Actual Heat Rate (GJ/MWh)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
          />
          <ZAxis range={[60, 60]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb', fontSize: 12 }}
            formatter={(value: number, name: string, props: { payload?: ScatterUnit }) => {
              if (name === 'Design HR') return [`${fmt2(value)} GJ/MWh`, 'Design HR']
              if (name === 'Actual HR') return [`${fmt2(value)} GJ/MWh (deg: ${fmt1(props.payload?.degradation ?? 0)}%)`, 'Actual HR']
              return [value, name]
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 10 }}
            formatter={(value: string) => TECH_DISPLAY[value] ?? value}
          />
          {/* Diagonal benchmark line */}
          <Scatter name="_diag" data={diagData} fill="none" line={{ stroke: '#6b7280', strokeDasharray: '6 3' }} shape={() => <></>} legendType="none" />
          {Object.entries(byTech).map(([tech, data]) => (
            <Scatter
              key={tech}
              name={tech}
              data={data}
              fill={TECH_COLORS[tech] ?? '#6b7280'}
              shape={<CustomDot fill={TECH_COLORS[tech] ?? '#6b7280'} />}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Heat Rate Trend Line Chart
// ---------------------------------------------------------------------------

function HeatRateTrendChart({ trends }: { trends: HeatRateTrendRecord[] }) {
  const unitIds = Array.from(new Set(trends.map((t) => t.unit_id)))
  const years = Array.from(new Set(trends.map((t) => t.year))).sort()

  const chartData = years.map((yr) => {
    const row: Record<string, number | string> = { year: String(yr) }
    unitIds.forEach((uid) => {
      const rec = trends.find((t) => t.unit_id === uid && t.year === yr)
      if (rec) row[uid] = rec.actual_heat_rate_gj_mwh
    })
    return row
  })

  // Overhaul year markers
  const overhaulYears: { unit_id: string; year: number; unit_name: string }[] = []
  trends.forEach((t) => {
    if (t.major_overhaul) overhaulYears.push({ unit_id: t.unit_id, year: t.year, unit_name: t.unit_name })
  })

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-200">Heat Rate Trend by Unit (2020–2024)</h2>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        Step improvements visible after major overhauls (marked with vertical dashed lines).
        {overhaulYears.length > 0 && (
          <span className="ml-2">
            Overhauls: {overhaulYears.map((o) => `${TREND_UNIT_NAMES[o.unit_id] ?? o.unit_id} (${o.year})`).join(', ')}
          </span>
        )}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" GJ" width={55} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb', fontSize: 12 }}
            itemStyle={{ color: '#d1d5db', fontSize: 11 }}
            formatter={(value: number, name: string) => [`${fmt2(value)} GJ/MWh`, TREND_UNIT_NAMES[name] ?? name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
            formatter={(value: string) => TREND_UNIT_NAMES[value] ?? value}
          />
          {/* Overhaul reference lines */}
          {overhaulYears.map((o) => (
            <ReferenceLine
              key={`${o.unit_id}-${o.year}`}
              x={String(o.year)}
              stroke={TREND_LINE_COLORS[o.unit_id] ?? '#6b7280'}
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
          ))}
          {unitIds.map((uid) => (
            <Line
              key={uid}
              type="monotone"
              dataKey={uid}
              stroke={TREND_LINE_COLORS[uid] ?? '#6b7280'}
              strokeWidth={2}
              dot={{ r: 3, fill: TREND_LINE_COLORS[uid] ?? '#6b7280' }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thermal Units Table
// ---------------------------------------------------------------------------

function ThermalUnitsTable({ units }: { units: ThermalUnitRecord[] }) {
  const [techFilter, setTechFilter] = useState<string>('ALL')

  const filtered = techFilter === 'ALL'
    ? units
    : units.filter((u) => u.technology === techFilter)

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-200">Thermal Units Registry</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Filter:</span>
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="text-xs bg-gray-700 text-gray-200 rounded px-2 py-1 border border-gray-600 focus:outline-none"
          >
            {TECHNOLOGIES.map((t) => (
              <option key={t} value={t}>{t === 'ALL' ? 'All Technologies' : (TECH_DISPLAY[t] ?? t)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300 border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              {['Unit', 'Station', 'Owner', 'State', 'Technology', 'Cap (MW)', 'Age (yr)', 'Design HR', 'Actual HR', 'Degradation', 'Net Eff.', 'CO2 (kg/MWh)'].map((h) => (
                <th key={h} className="py-2 px-3 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.unit_id} className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors">
                <td className="py-2 px-3 font-medium text-white whitespace-nowrap">{u.unit_name}</td>
                <td className="py-2 px-3 whitespace-nowrap">{u.station_name}</td>
                <td className="py-2 px-3 whitespace-nowrap">{u.owner}</td>
                <td className="py-2 px-3">{u.state}</td>
                <td className="py-2 px-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TECH_BADGE[u.technology] ?? 'bg-gray-600 text-white'}`}>
                    {TECH_DISPLAY[u.technology] ?? u.technology}
                  </span>
                </td>
                <td className="py-2 px-3 text-right">{u.installed_capacity_mw.toLocaleString()}</td>
                <td className="py-2 px-3 text-right">{u.age_years}</td>
                <td className="py-2 px-3 text-right">{fmt1(u.design_heat_rate_gj_mwh)}</td>
                <td className="py-2 px-3 text-right">{fmt1(u.actual_heat_rate_gj_mwh)}</td>
                <td className={`py-2 px-3 text-right ${degradationColor(u.heat_rate_degradation_pct)}`}>
                  {fmt1(u.heat_rate_degradation_pct)}%
                </td>
                <td className="py-2 px-3 text-right text-blue-300">{fmt1(u.net_efficiency_pct)}%</td>
                <td className={`py-2 px-3 text-right ${co2Color(u.co2_intensity_kg_mwh)}`}>
                  {u.co2_intensity_kg_mwh.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fuel Cost / SRMC Table
// ---------------------------------------------------------------------------

type SortKey = 'total_srmc_mwh' | 'all_in_cost_mwh' | 'fuel_cost_mwh' | 'year'

function FuelCostTable({ fuelCosts }: { fuelCosts: FuelCostRecord[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('total_srmc_mwh')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = [...fuelCosts].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey]
    return sortAsc ? diff : -diff
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="py-2 px-3 text-left text-gray-400 font-medium whitespace-nowrap cursor-pointer hover:text-gray-200 select-none"
      onClick={() => handleSort(k)}
    >
      {label} {sortKey === k ? (sortAsc ? '▲' : '▼') : ''}
    </th>
  )

  function srmcColor(v: number): string {
    if (v > 120) return 'text-red-400 font-semibold'
    if (v > 70)  return 'text-amber-400'
    return 'text-green-400'
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-200 mb-4">Fuel Cost & SRMC by Unit</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300 border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-3 text-left text-gray-400 font-medium whitespace-nowrap">Unit</th>
              <th className="py-2 px-3 text-left text-gray-400 font-medium whitespace-nowrap">Technology</th>
              <SortHeader label="Year" k="year" />
              <th className="py-2 px-3 text-left text-gray-400 font-medium whitespace-nowrap">Fuel ($/GJ)</th>
              <SortHeader label="Fuel Cost ($/MWh)" k="fuel_cost_mwh" />
              <th className="py-2 px-3 text-left text-gray-400 font-medium whitespace-nowrap">Var O&M</th>
              <SortHeader label="SRMC ($/MWh)" k="total_srmc_mwh" />
              <th className="py-2 px-3 text-left text-gray-400 font-medium whitespace-nowrap">Carbon ($/MWh)</th>
              <SortHeader label="All-in ($/MWh)" k="all_in_cost_mwh" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, idx) => (
              <tr key={`${r.unit_id}-${r.year}-${idx}`} className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors">
                <td className="py-2 px-3 font-medium text-white whitespace-nowrap">{r.unit_name}</td>
                <td className="py-2 px-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TECH_BADGE[r.technology] ?? 'bg-gray-600 text-white'}`}>
                    {TECH_DISPLAY[r.technology] ?? r.technology}
                  </span>
                </td>
                <td className="py-2 px-3 text-right">{r.year}</td>
                <td className="py-2 px-3 text-right">${fmt2(r.fuel_price_gj)}</td>
                <td className="py-2 px-3 text-right">${fmt1(r.fuel_cost_mwh)}</td>
                <td className="py-2 px-3 text-right">${fmt1(r.variable_om_mwh)}</td>
                <td className={`py-2 px-3 text-right ${srmcColor(r.total_srmc_mwh)}`}>${fmt1(r.total_srmc_mwh)}</td>
                <td className="py-2 px-3 text-right">{r.carbon_cost_mwh > 0 ? `$${fmt1(r.carbon_cost_mwh)}` : '—'}</td>
                <td className={`py-2 px-3 text-right font-semibold ${srmcColor(r.all_in_cost_mwh)}`}>${fmt1(r.all_in_cost_mwh)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ThermalEfficiency() {
  const [dashboard, setDashboard] = useState<ThermalEfficiencyDashboard | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getThermalEfficiencyDashboard()
      setDashboard(data)
      setLastUpdated(new Date().toLocaleTimeString('en-AU'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load thermal efficiency data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Loading Thermal Efficiency data…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 gap-2">
        <AlertTriangle size={20} />
        <span>{error ?? 'No data available'}</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-700 rounded-lg">
            <Thermometer className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Thermal Power Plant Heat Rate &amp; Efficiency Analytics</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Coal &amp; gas unit heat rates, fuel efficiency, SRMC benchmarking, emissions intensity and turbine performance degradation
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg border border-gray-700 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
          {lastUpdated && <span className="text-gray-500">· {lastUpdated}</span>}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Fleet Avg Heat Rate"
          value={`${fmt1(dashboard.fleet_avg_heat_rate_gj_mwh)} GJ/MWh`}
          sub="Capacity-weighted average across all thermal units"
          accent="text-orange-400"
        />
        <KpiCard
          label="Fleet Avg Efficiency"
          value={`${fmt1(dashboard.fleet_avg_efficiency_pct)}%`}
          sub="Net thermal efficiency across the fleet"
          accent="text-blue-400"
        />
        <KpiCard
          label="Worst Performing Unit"
          value={dashboard.worst_heat_rate_unit}
          sub="Highest actual heat rate vs benchmark"
          accent="text-red-400"
        />
        <KpiCard
          label="Total Fuel Cost"
          value={fmtB(dashboard.total_fuel_cost_b_aud_yr)}
          sub="AUD per year across the thermal fleet"
          accent="text-amber-400"
        />
      </div>

      {/* Heat Rate Scatter + Trend side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <HeatRateScatterChart units={dashboard.thermal_units} />
        <HeatRateTrendChart trends={dashboard.heat_rate_trends} />
      </div>

      {/* Thermal Units Table */}
      <ThermalUnitsTable units={dashboard.thermal_units} />

      {/* Fuel Cost SRMC Table */}
      <FuelCostTable fuelCosts={dashboard.fuel_costs} />
    </div>
  )
}
