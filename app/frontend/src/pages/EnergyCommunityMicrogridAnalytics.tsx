import { useEffect, useState } from 'react'
import { Home } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts'
import {
  ECMADashboard,
  ECMAMicrogrid,
  ECMAEnergyFlow,
  ECMAFinancial,
  ECMAReliability,
  ECMACommunity,
  getEnergyCommunityMicrogridDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
const TYPE_COLOURS: Record<string, string> = {
  'Island': '#f59e0b',
  'Grid-Connected': '#3b82f6',
  'Hybrid': '#10b981',
  'Remote Community': '#a855f7',
}

const FUNDING_COLOURS: Record<string, string> = {
  'ARENA': '#22d3ee',
  'CEFC': '#f97316',
  'State Government': '#6366f1',
  'Private': '#ec4899',
  'Community Owned': '#84cc16',
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------
function KpiCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        {unit && <span className="text-sm text-gray-400">{unit}</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function EnergyCommunityMicrogridAnalytics() {
  const [data, setData] = useState<ECMADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyCommunityMicrogridDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        Loading Energy Community & Microgrid Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        Error: {error ?? 'No data returned'}
      </div>
    )
  }

  const { microgrids, energy_flows, financials, reliability, communities, summary } = data

  // -------------------------------------------------------------------------
  // Chart 1: Solar capacity by microgrid, sorted descending, coloured by type
  // -------------------------------------------------------------------------
  const chart1Data = [...microgrids]
    .sort((a, b) => b.solar_capacity_kw - a.solar_capacity_kw)
    .map((mg) => ({
      name: mg.microgrid_name.length > 22 ? mg.microgrid_name.slice(0, 22) + '…' : mg.microgrid_name,
      fullName: mg.microgrid_name,
      solar_capacity_kw: mg.solar_capacity_kw,
      microgrid_type: mg.microgrid_type,
      fill: TYPE_COLOURS[mg.microgrid_type] ?? '#6b7280',
    }))

  // -------------------------------------------------------------------------
  // Chart 2: Monthly energy flow for top 3 microgrids by total annual_energy_kwh
  // -------------------------------------------------------------------------
  const top3 = [...microgrids]
    .sort((a, b) => b.annual_energy_kwh - a.annual_energy_kwh)
    .slice(0, 3)

  const top3Ids = new Set(top3.map((m) => m.microgrid_id))
  const top3Names: Record<string, string> = Object.fromEntries(top3.map((m) => [m.microgrid_id, m.microgrid_name.slice(0, 18)]))

  // Aggregate by month across top 3 microgrids
  const chart2Map: Record<number, { solar: number; wind: number; battery: number; diesel: number }> = {}
  for (let m = 1; m <= 12; m++) {
    chart2Map[m] = { solar: 0, wind: 0, battery: 0, diesel: 0 }
  }
  energy_flows
    .filter((ef) => top3Ids.has(ef.microgrid_id))
    .forEach((ef) => {
      chart2Map[ef.month].solar += ef.solar_gen_kwh
      chart2Map[ef.month].wind += ef.wind_gen_kwh
      chart2Map[ef.month].battery += ef.battery_discharge_kwh
      chart2Map[ef.month].diesel += ef.diesel_gen_kwh
    })

  const chart2Data = MONTH_LABELS.map((label, idx) => ({
    month: label,
    Solar: Math.round(chart2Map[idx + 1].solar / 1000),
    Wind: Math.round(chart2Map[idx + 1].wind / 1000),
    Battery: Math.round(chart2Map[idx + 1].battery / 1000),
    Diesel: Math.round(chart2Map[idx + 1].diesel / 1000),
  }))

  // -------------------------------------------------------------------------
  // Chart 3: LCOE by microgrid with payback_years on tooltip
  // -------------------------------------------------------------------------
  const mgNameMap: Record<string, string> = Object.fromEntries(
    microgrids.map((m) => [m.microgrid_id, m.microgrid_name.length > 20 ? m.microgrid_name.slice(0, 20) + '…' : m.microgrid_name])
  )
  const chart3Data = [...financials]
    .sort((a, b) => a.lcoe_per_kwh - b.lcoe_per_kwh)
    .map((f) => ({
      name: mgNameMap[f.microgrid_id] ?? f.microgrid_id,
      lcoe: f.lcoe_per_kwh,
      payback: f.payback_years,
    }))

  // -------------------------------------------------------------------------
  // Chart 4: Availability % 2022–2024 for top 5 microgrids by avg availability
  // -------------------------------------------------------------------------
  const avgAvailByMg: Record<string, number> = {}
  reliability.forEach((r) => {
    if (!avgAvailByMg[r.microgrid_id]) avgAvailByMg[r.microgrid_id] = 0
    avgAvailByMg[r.microgrid_id] += r.availability_pct
  })
  const reliabilityMgIds = Object.keys(avgAvailByMg)
  const top5ReliabilityIds = reliabilityMgIds
    .sort((a, b) => avgAvailByMg[b] - avgAvailByMg[a])
    .slice(0, 5)

  const reliabilityByYear: Record<number, Record<string, number>> = {}
  ;[2022, 2023, 2024].forEach((yr) => { reliabilityByYear[yr] = {} })
  reliability
    .filter((r) => top5ReliabilityIds.includes(r.microgrid_id))
    .forEach((r) => {
      reliabilityByYear[r.year][r.microgrid_id] = r.availability_pct
    })

  const chart4Data = [2022, 2023, 2024].map((yr) => {
    const row: Record<string, number | string> = { year: String(yr) }
    top5ReliabilityIds.forEach((id) => {
      row[mgNameMap[id] ?? id] = reliabilityByYear[yr][id] ?? 0
    })
    return row
  })

  const reliabilityLineColours = ['#22d3ee', '#f59e0b', '#10b981', '#a855f7', '#f97316']

  // -------------------------------------------------------------------------
  // Chart 5: Energy poverty index by state, coloured by funding program
  // -------------------------------------------------------------------------
  const chart5Data = communities.map((c) => ({
    name: c.community_name.length > 18 ? c.community_name.slice(0, 18) + '…' : c.community_name,
    fullName: c.community_name,
    state: c.state,
    energy_poverty_index: c.energy_poverty_index,
    program_funding: c.program_funding,
    fill: FUNDING_COLOURS[c.program_funding] ?? '#6b7280',
  }))

  // -------------------------------------------------------------------------
  // Custom tooltip for chart 1
  // -------------------------------------------------------------------------
  const Chart1Tooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: (typeof chart1Data)[0] }> }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-gray-800 border border-gray-600 rounded p-2 text-xs text-white">
        <p className="font-semibold">{d.fullName}</p>
        <p>Type: {d.microgrid_type}</p>
        <p>Solar: {d.solar_capacity_kw.toFixed(0)} kW</p>
      </div>
    )
  }

  const Chart3Tooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: (typeof chart3Data)[0] }> }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-gray-800 border border-gray-600 rounded p-2 text-xs text-white">
        <p className="font-semibold">{d.name}</p>
        <p>LCOE: ${d.lcoe.toFixed(3)}/kWh</p>
        <p>Payback: {d.payback.toFixed(1)} years</p>
      </div>
    )
  }

  const Chart5Tooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: (typeof chart5Data)[0] }> }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-gray-800 border border-gray-600 rounded p-2 text-xs text-white">
        <p className="font-semibold">{d.fullName}</p>
        <p>State: {d.state}</p>
        <p>Poverty Index: {d.energy_poverty_index.toFixed(3)}</p>
        <p>Funding: {d.program_funding}</p>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Home className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Energy Community &amp; Microgrid Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Australian remote &amp; community microgrid performance, financials and social impact</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Microgrids" value={summary.total_microgrids} />
        <KpiCard label="Avg Renewable Fraction" value={summary.avg_renewable_fraction_pct} unit="%" />
        <KpiCard label="Total Solar Capacity" value={summary.total_solar_capacity_mw} unit="MW" />
        <KpiCard label="Total Battery Storage" value={summary.total_battery_capacity_mwh} unit="MWh" />
      </div>

      {/* Chart 1: Solar capacity by microgrid */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Solar Capacity by Microgrid (coloured by type)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart1Data} margin={{ top: 5, right: 20, left: 0, bottom: 90 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'kW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip content={<Chart1Tooltip />} />
            <Bar dataKey="solar_capacity_kw" name="Solar Capacity (kW)" radius={[3, 3, 0, 0]}>
              {chart1Data.map((entry, index) => (
                <rect key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(TYPE_COLOURS).map(([type, colour]) => (
            <span key={type} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Monthly energy flow (stacked area) */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-100 mb-1">Monthly Energy Flow 2024 — Top 3 Microgrids</h2>
        <p className="text-xs text-gray-500 mb-4">
          {top3.map((m) => top3Names[m.microgrid_id]).join(' · ')} (combined, MWh)
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chart2Data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'MWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Area type="monotone" dataKey="Solar" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.7} />
            <Area type="monotone" dataKey="Wind" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.7} />
            <Area type="monotone" dataKey="Battery" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.7} />
            <Area type="monotone" dataKey="Diesel" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: LCOE by microgrid */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-100 mb-4">LCOE ($/kWh) by Microgrid — hover for payback years</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart3Data} margin={{ top: 5, right: 20, left: 0, bottom: 90 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '$/kWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip content={<Chart3Tooltip />} />
            <Bar dataKey="lcoe" name="LCOE $/kWh" fill="#6366f1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Availability % 2022–2024 */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Availability % (2022–2024) — Top 5 Microgrids by Reliability</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chart4Data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis domain={[85, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            {top5ReliabilityIds.map((id, idx) => (
              <Line
                key={id}
                type="monotone"
                dataKey={mgNameMap[id] ?? id}
                stroke={reliabilityLineColours[idx]}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Community energy poverty index by state */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Community Energy Poverty Index (coloured by program funding)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart5Data} margin={{ top: 5, right: 20, left: 0, bottom: 90 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis domain={[0, 1]} tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Index (0-1)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
            <Tooltip content={<Chart5Tooltip />} />
            <Bar dataKey="energy_poverty_index" name="Energy Poverty Index" radius={[3, 3, 0, 0]}>
              {chart5Data.map((entry, index) => (
                <rect key={`cell5-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(FUNDING_COLOURS).map(([prog, colour]) => (
            <span key={prog} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
              {prog}
            </span>
          ))}
        </div>
      </div>

      {/* Footer summary */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-sm text-gray-400">
        <span className="font-semibold text-gray-300">Best performing microgrid:</span>{' '}
        {summary.best_performing_microgrid} &nbsp;|&nbsp;
        <span className="font-semibold text-gray-300">Total CO₂ saved:</span>{' '}
        {summary.total_co2_saved_tpa.toLocaleString()} tCO₂/yr &nbsp;|&nbsp;
        <span className="font-semibold text-gray-300">Households connected:</span>{' '}
        {summary.total_households_connected.toLocaleString()}
      </div>
    </div>
  )
}
