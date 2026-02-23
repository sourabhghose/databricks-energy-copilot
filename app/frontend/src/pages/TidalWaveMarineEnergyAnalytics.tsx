import { useEffect, useState } from 'react'
import { Waves } from 'lucide-react'
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
  Cell,
} from 'recharts'
import {
  TWMEDashboard,
  getTidalWaveMarineEnergyDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
const RESOURCE_TYPE_COLOURS: Record<string, string> = {
  'Tidal Stream':      '#22d3ee',
  'Tidal Barrage':     '#3b82f6',
  'Wave Energy':       '#10b981',
  'OTEC':              '#f59e0b',
  'Salinity Gradient': '#a855f7',
}

const STATUS_COLOURS: Record<string, string> = {
  'R&D':           '#6b7280',
  'Proposed':      '#3b82f6',
  'Pilot':         '#f59e0b',
  'Demonstration': '#10b981',
  'Cancelled':     '#ef4444',
}

const FUNDING_COLOURS: Record<string, string> = {
  'ARENA Grant':    '#22d3ee',
  'CEFC Debt':      '#f97316',
  'Private Equity': '#a855f7',
  'University':     '#10b981',
}

const PROJECT_LINE_COLOURS = ['#22d3ee', '#f59e0b', '#a855f7']

const MONTH_LABELS: Record<number, string> = {
  1: 'Jan', 4: 'Apr', 7: 'Jul', 10: 'Oct',
}

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
export default function TidalWaveMarineEnergyAnalytics() {
  const [data, setData] = useState<TWMEDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTidalWaveMarineEnergyDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        Loading Tidal, Wave &amp; Marine Energy Analytics...
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

  const { resources, projects, production, technologies, investments, summary } = data

  // -------------------------------------------------------------------------
  // Chart 1: Site potential_capacity_mw coloured by resource_type
  // -------------------------------------------------------------------------
  const chart1Data = [...resources]
    .sort((a, b) => b.potential_capacity_mw - a.potential_capacity_mw)
    .map((r) => ({
      name: r.site_name.length > 22 ? r.site_name.slice(0, 22) + '…' : r.site_name,
      fullName: r.site_name,
      potential_capacity_mw: r.potential_capacity_mw,
      resource_type: r.resource_type,
      fill: RESOURCE_TYPE_COLOURS[r.resource_type] ?? '#6b7280',
    }))

  // -------------------------------------------------------------------------
  // Chart 2: Project lcoe_per_mwh coloured by status, sorted ascending
  // -------------------------------------------------------------------------
  const chart2Data = [...projects]
    .sort((a, b) => a.lcoe_per_mwh - b.lcoe_per_mwh)
    .map((p) => ({
      name: p.project_name.length > 20 ? p.project_name.slice(0, 20) + '…' : p.project_name,
      fullName: p.project_name,
      lcoe_per_mwh: p.lcoe_per_mwh,
      status: p.status,
      fill: STATUS_COLOURS[p.status] ?? '#6b7280',
    }))

  // -------------------------------------------------------------------------
  // Chart 3: Technology TRL level vs global_installed_mw (grouped bar)
  // -------------------------------------------------------------------------
  const chart3Data = [...technologies]
    .sort((a, b) => b.trl_level - a.trl_level)
    .map((t) => ({
      name: t.technology_name.length > 22 ? t.technology_name.slice(0, 22) + '…' : t.technology_name,
      fullName: t.technology_name,
      trl_level: t.trl_level,
      global_installed_mw: t.global_installed_mw,
    }))

  // -------------------------------------------------------------------------
  // Chart 4: Monthly energy_output_mwh for 3 pilot projects (PRJ001/002/003)
  // -------------------------------------------------------------------------
  const pilotIds = ['PRJ001', 'PRJ002', 'PRJ003']
  const pilotNames: Record<string, string> = {}
  projects.forEach((p) => {
    if (pilotIds.includes(p.project_id)) {
      pilotNames[p.project_id] = p.project_name.length > 20
        ? p.project_name.slice(0, 20) + '…'
        : p.project_name
    }
  })

  // Build a map: key = `${year}-${month}` → Record<project_id, energy_output_mwh>
  const prodMap: Record<string, Record<string, number>> = {}
  production
    .filter((p) => pilotIds.includes(p.project_id))
    .forEach((p) => {
      const key = `${p.year}-${MONTH_LABELS[p.month] ?? p.month}`
      if (!prodMap[key]) prodMap[key] = {}
      prodMap[key][p.project_id] = p.energy_output_mwh
    })

  const chart4Data = Object.entries(prodMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, vals]) => ({
      period: key,
      ...vals,
    }))

  // -------------------------------------------------------------------------
  // Chart 5: Stacked bar — annual investment by funding_type across 2020-2024
  // -------------------------------------------------------------------------
  const invByYear: Record<number, Record<string, number>> = {}
  ;[2020, 2021, 2022, 2023, 2024].forEach((yr) => { invByYear[yr] = {} })
  investments.forEach((inv) => {
    if (!invByYear[inv.year]) invByYear[inv.year] = {}
    invByYear[inv.year][inv.funding_type] = (invByYear[inv.year][inv.funding_type] ?? 0) + inv.amount_m_aud
  })

  const chart5Data = [2020, 2021, 2022, 2023, 2024].map((yr) => ({
    year: String(yr),
    'ARENA Grant':    parseFloat((invByYear[yr]['ARENA Grant']    ?? 0).toFixed(2)),
    'CEFC Debt':      parseFloat((invByYear[yr]['CEFC Debt']      ?? 0).toFixed(2)),
    'Private Equity': parseFloat((invByYear[yr]['Private Equity'] ?? 0).toFixed(2)),
    'University':     parseFloat((invByYear[yr]['University']     ?? 0).toFixed(2)),
  }))

  // -------------------------------------------------------------------------
  // Custom tooltips
  // -------------------------------------------------------------------------
  const Chart1Tooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: (typeof chart1Data)[0] }> }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-gray-800 border border-gray-600 rounded p-2 text-xs text-gray-200">
        <p className="font-semibold">{d.fullName}</p>
        <p>Type: {d.resource_type}</p>
        <p>Potential: {d.potential_capacity_mw} MW</p>
      </div>
    )
  }

  const Chart2Tooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: (typeof chart2Data)[0] }> }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-gray-800 border border-gray-600 rounded p-2 text-xs text-gray-200">
        <p className="font-semibold">{d.fullName}</p>
        <p>Status: {d.status}</p>
        <p>LCOE: ${d.lcoe_per_mwh}/MWh</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 min-h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Waves className="text-cyan-400 w-7 h-7" />
        <div>
          <h1 className="text-2xl font-bold text-white">Tidal, Wave &amp; Marine Energy Analytics</h1>
          <p className="text-sm text-gray-400">Australian marine energy resource potential, projects, and investment landscape</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Sites"        value={summary.total_sites} />
        <KpiCard label="Total Projects"     value={summary.total_projects} />
        <KpiCard label="Total Potential"    value={summary.total_potential_mw.toLocaleString()} unit="MW" />
        <KpiCard label="Total Installed"    value={summary.total_installed_kw.toLocaleString()} unit="kW" />
      </div>

      {/* Chart 1 — Site Potential Capacity by Resource Type */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">Site Potential Capacity (MW) by Resource Type</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart1Data} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip content={<Chart1Tooltip />} />
            <Bar dataKey="potential_capacity_mw" name="Potential Capacity (MW)" radius={[4, 4, 0, 0]}>
              {chart1Data.map((entry, idx) => (
                <Cell key={`c1-${idx}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Resource type legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(RESOURCE_TYPE_COLOURS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: v }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2 — Project LCOE by Status */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">Project LCOE ($/MWh) by Status — Sorted Ascending</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart2Data} margin={{ top: 5, right: 20, left: 0, bottom: 90 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '$/MWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip content={<Chart2Tooltip />} />
            <Bar dataKey="lcoe_per_mwh" name="LCOE ($/MWh)" radius={[4, 4, 0, 0]}>
              {chart2Data.map((entry, idx) => (
                <Cell key={`c2-${idx}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Status legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(STATUS_COLOURS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: v }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 3 — Technology TRL vs Global Installed MW (grouped bar) */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">Technology TRL Level vs Global Installed MW</h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chart3Data} margin={{ top: 5, right: 20, left: 0, bottom: 90 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
            <YAxis yAxisId="trl" orientation="left" domain={[0, 9]} tick={{ fill: '#22d3ee', fontSize: 11 }} label={{ value: 'TRL', angle: -90, position: 'insideLeft', fill: '#22d3ee', fontSize: 11 }} />
            <YAxis yAxisId="mw" orientation="right" tick={{ fill: '#f59e0b', fontSize: 11 }} label={{ value: 'MW', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar yAxisId="trl" dataKey="trl_level" name="TRL Level" fill="#22d3ee" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="mw"  dataKey="global_installed_mw" name="Global Installed (MW)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — Monthly Production Trend for 3 Pilot Projects */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">Monthly Energy Output (MWh) — 3 Pilot Projects</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart4Data} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'MWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {pilotIds.map((pid, idx) => (
              <Line
                key={pid}
                type="monotone"
                dataKey={pid}
                name={pilotNames[pid] ?? pid}
                stroke={PROJECT_LINE_COLOURS[idx]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 — Annual Investment by Funding Type (Stacked Bar) */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">Annual Investment (A$M) by Funding Type — 2020-2024</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart5Data} margin={{ top: 5, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'A$M', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {Object.entries(FUNDING_COLOURS).map(([ft, colour]) => (
              <Bar key={ft} dataKey={ft} stackId="inv" fill={colour} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer summary */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-wrap gap-4 text-sm text-gray-300">
        <span>Avg LCOE: <span className="text-white font-semibold">${summary.avg_lcoe_per_mwh}/MWh</span></span>
        <span>Leading Technology: <span className="text-cyan-400 font-semibold">{summary.leading_technology}</span></span>
        <span>Total Investment: <span className="text-white font-semibold">A${summary.total_investment_m_aud.toFixed(1)}M</span></span>
      </div>
    </div>
  )
}
