import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  getNEMInertiaSynchronousCondenserDashboard,
  NISCDashboard,
} from '../api/client'

const REGION_COLORS: Record<string, string> = {
  SA:  '#ef4444',
  VIC: '#6366f1',
  NSW: '#22c55e',
  QLD: '#f59e0b',
  TAS: '#22d3ee',
}

const SCENARIO_COLORS: Record<string, string> = {
  'No Action':      '#ef4444',
  'Current Plan':   '#f59e0b',
  'Accelerated GFM':'#22c55e',
}

export default function NEMInertiaSynchronousCondenserAnalytics() {
  const [data, setData]       = useState<NISCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getNEMInertiaSynchronousCondenserDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading NEM Inertia &amp; Synchronous Condenser Analytics...</span>
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

  const { inertia_levels, syncondensers, rocof_events, procurement, costs, projections, summary } = data

  // ---- KPI Cards ----
  const kpis = [
    {
      label: 'Avg System Inertia',
      value: `${(summary.avg_system_inertia_mws as number).toLocaleString()} MWs`,
      sub: 'Across all NEM regions',
      color: 'text-indigo-400',
    },
    {
      label: 'Total Syncon Capacity',
      value: `${(summary.total_syncon_capacity_mws as number).toLocaleString()} MWs`,
      sub: 'Operating syncon fleet',
      color: 'text-green-400',
    },
    {
      label: 'RoCoF Events YTD',
      value: `${summary.rocof_events_ytd}`,
      sub: 'Limit breaches in 2024',
      color: 'text-yellow-400',
    },
    {
      label: 'Most At-Risk Region',
      value: `${summary.most_at_risk_region}`,
      sub: 'Lowest inertia headroom',
      color: 'text-red-400',
    },
  ]

  // ---- Chart 1: Inertia Level Trend (SA) ----
  const saInertia = inertia_levels
    .filter((r) => r.region === 'SA')
    .sort((a, b) => a.date_month.localeCompare(b.date_month))

  // ---- Chart 2: Contribution Stack ----
  const contributionData = inertia_levels
    .sort((a, b) => a.date_month.localeCompare(b.date_month))
    .slice(0, 12)
    .map((r) => ({
      month: r.date_month,
      Coal: r.coal_contribution_mws,
      Gas: r.gas_contribution_mws,
      Hydro: r.hydro_contribution_mws,
      Syncon: r.syncon_contribution_mws,
      'Wind/GFM': r.wind_gfm_contribution_mws,
    }))

  // ---- Chart 3: RoCoF Events (breach count) ----
  const rocofData = rocof_events.map((r) => ({
    quarter: r.quarter,
    region: r.region,
    Breaches: r.limit_breach_count,
    AvgRoCoF: r.avg_rocof_hz_per_s,
    Limit: r.rocof_limit_hz_per_s,
  }))

  // ---- Chart 4: Syncon Fleet (horizontal bar) ----
  const synconByAsset = syncondensers
    .filter((s) => s.status === 'Operating')
    .map((s) => ({ name: s.asset_name, H_MWs: s.h_constant_mws, state: s.state }))
    .sort((a, b) => b.H_MWs - a.H_MWs)

  // ---- Chart 5: Procurement Cost by type & year ----
  const procByYear: Record<string, Record<string, number>> = {}
  procurement.forEach((p) => {
    const k = String(p.year)
    if (!procByYear[k]) procByYear[k] = {}
    procByYear[k][p.service_type] = (procByYear[k][p.service_type] ?? 0) + p.procurement_cost_m
  })
  const procChartData = Object.entries(procByYear)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yr, vals]) => ({ year: yr, ...vals }))

  // ---- Chart 6: Scenario Projections (SA, all 3 scenarios) ----
  const scenarioData: Record<string, Record<string, number | string>> = {}
  projections
    .filter((p) => p.region === 'SA')
    .forEach((p) => {
      if (!scenarioData[p.year]) scenarioData[p.year] = { year: p.year, Threshold: p.min_threshold_mws }
      scenarioData[p.year][p.scenario] = p.total_inertia_mws
    })
  const scenarioChartData = Object.values(scenarioData).sort((a, b) =>
    Number(a.year) - Number(b.year),
  )

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Activity className="text-indigo-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">NEM Inertia &amp; Synchronous Condenser Analytics</h1>
          <p className="text-gray-400 text-sm">
            System inertia trends, syncon fleet, RoCoF events, AEMO procurement and adequacy projections
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

      {/* Chart 1: Inertia Level Trend — SA */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Inertia Level Trend — South Australia
        </h2>
        {saInertia.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={saInertia} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date_month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" MWs" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend />
              <ReferenceLine y={3500} stroke="#ef4444" strokeDasharray="6 3" label={{ value: 'Min Threshold', fill: '#ef4444', fontSize: 11 }} />
              <Line type="monotone" dataKey="total_inertia_mws" name="Total Inertia (MWs)" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="syncon_contribution_mws" name="Syncon Contribution" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-sm">No SA inertia data available.</p>
        )}
      </div>

      {/* Chart 2: Inertia Contribution Stack */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Inertia Contribution by Source (Sample Records)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={contributionData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" MWs" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend />
            <Area type="monotone" dataKey="Coal"      stackId="1" stroke="#6b7280" fill="#6b7280" fillOpacity={0.8} />
            <Area type="monotone" dataKey="Gas"       stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.8} />
            <Area type="monotone" dataKey="Hydro"     stackId="1" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.8} />
            <Area type="monotone" dataKey="Syncon"    stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.8} />
            <Area type="monotone" dataKey="Wind/GFM"  stackId="1" stroke="#6366f1" fill="#6366f1" fillOpacity={0.8} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Charts 3 & 4 side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Chart 3: RoCoF Breach Events */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">RoCoF Limit Breach Events by Quarter</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rocofData} margin={{ top: 5, right: 15, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" stroke="#9ca3af" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" />
              <YAxis yAxisId="left" stroke="#9ca3af" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{ fontSize: 10 }} unit=" Hz/s" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend verticalAlign="top" />
              <Bar yAxisId="left" dataKey="Breaches" name="Breach Count" fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="AvgRoCoF" name="Avg RoCoF (Hz/s)" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Syncon Fleet H constant */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Operating Syncon Fleet — Inertia Constant (MWs)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={synconByAsset}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 10 }} unit=" MWs" />
              <YAxis type="category" dataKey="name" stroke="#9ca3af" tick={{ fontSize: 9 }} width={115} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Bar dataKey="H_MWs" name="H Constant (MWs)" fill="#6366f1" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 5: Procurement Cost by Service Type & Year */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          AEMO Inertia Procurement Cost by Service Type &amp; Year (A$M)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={procChartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend />
            <Bar dataKey="Inertia"         name="Inertia"          fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Bar dataKey="SCL"             name="Short Circuit Level" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Voltage Support" name="Voltage Support"  fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 6: Scenario Inertia Adequacy Projection — SA */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Inertia Adequacy Scenario Projection 2024–2034 — South Australia
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={scenarioChartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" MWs" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend />
            <ReferenceLine y={3500} stroke="#ef4444" strokeDasharray="6 3" label={{ value: 'Min Threshold', fill: '#ef4444', fontSize: 11 }} />
            {Object.keys(SCENARIO_COLORS).map((sc) => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                name={sc}
                stroke={SCENARIO_COLORS[sc]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
            <Line type="monotone" dataKey="Threshold" name="Min Threshold" stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Table */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">System Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(summary).map(([k, v]) => (
            <div key={k} className="bg-gray-700 rounded p-3">
              <p className="text-gray-400 text-xs uppercase tracking-wide">{k.replace(/_/g, ' ')}</p>
              <p className="text-white font-semibold text-sm mt-1">
                {typeof v === 'number' ? v.toLocaleString() : String(v)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Region colour legend */}
      <div className="flex flex-wrap gap-3 mt-4">
        {Object.entries(REGION_COLORS).map(([region, color]) => (
          <span key={region} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            {region}
          </span>
        ))}
      </div>
    </div>
  )
}
