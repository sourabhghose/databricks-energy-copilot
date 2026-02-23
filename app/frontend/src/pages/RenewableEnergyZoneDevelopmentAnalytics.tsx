import { useEffect, useState } from 'react'
import { Map } from 'lucide-react'
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
  getRenewableEnergyZoneDevelopmentDashboard,
  REZDDashboard,
} from '../api/client'

const STATE_COLORS: Record<string, string> = {
  NSW: '#6366f1',
  VIC: '#22c55e',
  QLD: '#f59e0b',
  SA: '#ef4444',
  TAS: '#22d3ee',
  WA: '#f97316',
  ACT: '#a855f7',
  NT: '#ec4899',
}

const TYPE_COLORS: Record<string, string> = {
  'ISP Priority': '#6366f1',
  Designated: '#22c55e',
  Proposed: '#f59e0b',
}

const STATUS_COLORS: Record<string, string> = {
  Queue: '#6b7280',
  Registered: '#f59e0b',
  'Financial Close': '#22d3ee',
  Construction: '#6366f1',
  Operating: '#22c55e',
}

const TECH_COLORS: Record<string, string> = {
  Solar: '#f59e0b',
  Wind: '#6366f1',
  Hybrid: '#22c55e',
  Storage: '#ef4444',
}

export default function RenewableEnergyZoneDevelopmentAnalytics() {
  const [data, setData] = useState<REZDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRenewableEnergyZoneDevelopmentDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading Renewable Energy Zone Development Analytics...</span>
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

  const { zones, projects, transmission, access_rights, performance, forecasts, summary } = data

  // ---- KPI cards ----
  const kpis = [
    {
      label: 'Total Designated Capacity',
      value: `${((summary.total_rez_designated_capacity_mw as number) / 1000).toFixed(1)} GW`,
      sub: 'Across all ISP REZs',
      color: 'text-indigo-400',
    },
    {
      label: 'Projects in Queue',
      value: (summary.total_projects_in_queue as number).toString(),
      sub: 'Queue + Registered status',
      color: 'text-amber-400',
    },
    {
      label: 'Total Transmission Augmentation',
      value: `$${((summary.total_transmission_augmentation_m as number) / 1000).toFixed(1)}B`,
      sub: 'TNSP capex pipeline',
      color: 'text-cyan-400',
    },
    {
      label: 'Avg Curtailment',
      value: `${(summary.avg_curtailment_pct as number).toFixed(1)}%`,
      sub: 'Across access right periods',
      color: 'text-red-400',
    },
  ]

  // ---- Chart 1: REZ Capacity by State (stacked bar by rez_type) ----
  const stateTypeMap: Record<string, Record<string, number>> = {}
  for (const z of zones) {
    if (!stateTypeMap[z.state]) stateTypeMap[z.state] = {}
    stateTypeMap[z.state][z.rez_type] =
      (stateTypeMap[z.state][z.rez_type] ?? 0) + z.designated_capacity_mw
  }
  const rezTypes = ['ISP Priority', 'Designated', 'Proposed']
  const capacityByState = Object.entries(stateTypeMap).map(([state, typeMap]) => {
    const row: Record<string, string | number> = { state }
    for (const rt of rezTypes) row[rt] = (typeMap[rt] ?? 0) / 1000  // GW
    return row
  })

  // ---- Chart 2: Project Queue Status (stacked bar by technology × status) ----
  const techStatusMap: Record<string, Record<string, number>> = {}
  for (const p of projects) {
    if (!techStatusMap[p.technology]) techStatusMap[p.technology] = {}
    techStatusMap[p.technology][p.status] =
      (techStatusMap[p.technology][p.status] ?? 0) + p.capacity_mw
  }
  const allStatuses = ['Queue', 'Registered', 'Financial Close', 'Construction', 'Operating']
  const projectQueueData = Object.entries(techStatusMap).map(([tech, statusMap]) => {
    const row: Record<string, string | number> = { technology: tech }
    for (const s of allStatuses) row[s] = statusMap[s] ?? 0
    return row
  })

  // ---- Chart 3: Transmission Augmentation (horizontal bar by rez × tnsp) ----
  const txChartData = [...transmission]
    .sort((a, b) => b.augmentation_cost_m - a.augmentation_cost_m)
    .map((t) => ({
      name: t.rez_id.replace('REZ-', ''),
      augmentation_cost_m: t.augmentation_cost_m,
      tnsp: t.tnsp,
      bcr: t.benefit_cost_ratio,
    }))

  const tnspColors: Record<string, string> = {
    TransGrid: '#6366f1',
    AusNet: '#22c55e',
    Powerlink: '#f59e0b',
    ElectraNet: '#ef4444',
    TasNetworks: '#22d3ee',
    'Western Power': '#f97316',
  }

  // ---- Chart 4: Access Rights Market (line chart by quarter) ----
  const quarterSet = [...new Set(access_rights.map((a) => a.quarter))].sort()
  const accessByQuarter = quarterSet.map((q) => {
    const recs = access_rights.filter((a) => a.quarter === q)
    const avgPrice = recs.length
      ? recs.reduce((s, r) => s + r.access_price_aud_per_mw_year, 0) / recs.length
      : 0
    const totalTraded = recs.reduce((s, r) => s + r.traded_rights_mw, 0)
    return {
      quarter: q,
      avg_price: Math.round(avgPrice),
      traded_rights_mw: Math.round(totalTraded),
    }
  })

  // ---- Chart 5: REZ Performance (grouped bar, CF by rez) ----
  const perfRezIds = [...new Set(performance.map((p) => p.rez_id))]
  const perfByRez = perfRezIds.map((rezId) => {
    const recs = performance.filter((p) => p.rez_id === rezId)
    const avgSolar = recs.reduce((s, r) => s + r.capacity_factor_solar_pct, 0) / recs.length
    const avgWind = recs.reduce((s, r) => s + r.capacity_factor_wind_pct, 0) / recs.length
    return {
      name: rezId.replace('REZ-', ''),
      cf_solar: Math.round(avgSolar * 10) / 10,
      cf_wind: Math.round(avgWind * 10) / 10,
    }
  })

  // ---- Chart 6: Forecast dual-axis LineChart ----
  const forecastStates = [...new Set(forecasts.map((f) => f.state))]
  const forecastYears = [...new Set(forecasts.map((f) => f.year))].sort()
  const forecastChartData = forecastYears.map((yr) => {
    const row: Record<string, string | number> = { year: yr.toString() }
    for (const state of forecastStates) {
      const rec = forecasts.find((f) => f.year === yr && f.state === state)
      if (rec) {
        row[`${state}_cap`] = rec.total_capacity_mw
        row[`${state}_gen`] = rec.generation_twh
      }
    }
    return row
  })

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Map className="w-8 h-8 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Renewable Energy Zone Development Analytics
          </h1>
          <p className="text-gray-400 text-sm">
            ISP-designated REZs, transmission access standards, project registration, congestion
            management, access rights trading and connection queue across Australia
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-gray-500 text-xs mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart 1: REZ Capacity by State */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">REZ Designated Capacity by State</h2>
        <p className="text-gray-400 text-xs mb-4">
          Total designated capacity (GW) stacked by REZ type — ISP Priority, Designated and Proposed.
          NSW and QLD lead with New England, Central-West Orana, and North QLD REZs.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          {rezTypes.map((rt) => (
            <span key={rt} className="flex items-center gap-1 text-xs text-gray-300">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: TYPE_COLORS[rt] ?? '#9ca3af' }}
              />
              {rt}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={capacityByState}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="state" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} GW`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`${v.toFixed(1)} GW`, '']}
            />
            <Legend />
            {rezTypes.map((rt) => (
              <Bar key={rt} dataKey={rt} stackId="cap" fill={TYPE_COLORS[rt] ?? '#9ca3af'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Project Queue Status */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Project Queue Status by Technology
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Total project capacity (MW) by technology type, stacked by connection status. Solar and
          Wind dominate the pipeline; Storage projects are in early queue stages.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          {allStatuses.map((s) => (
            <span key={s} className="flex items-center gap-1 text-xs text-gray-300">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: STATUS_COLORS[s] ?? '#9ca3af' }}
              />
              {s}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={projectQueueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="technology" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toLocaleString()} MW`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`${v.toLocaleString()} MW`, '']}
            />
            <Legend />
            {allStatuses.map((s) => (
              <Bar key={s} dataKey={s} stackId="proj" fill={STATUS_COLORS[s] ?? '#9ca3af'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Transmission Augmentation (horizontal) */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Transmission Augmentation Cost by REZ
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Capex ($M) per REZ transmission augmentation project by TNSP. Gippsland offshore wind
          connection and Pilbara REZ backbone represent the largest individual investments.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          {Object.entries(tnspColors).map(([tnsp, col]) => (
            <span key={tnsp} className="flex items-center gap-1 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: col }} />
              {tnsp}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart layout="vertical" data={txChartData} margin={{ left: 90 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `$${v}M`}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#9ca3af"
              tick={{ fontSize: 10 }}
              width={90}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, _n: string, props: { payload?: { tnsp?: string; bcr?: number } }) => [
                `$${v}M | TNSP: ${props.payload?.tnsp ?? ''} | BCR: ${props.payload?.bcr ?? ''}`,
                'Augmentation Cost',
              ]}
            />
            <Bar dataKey="augmentation_cost_m" name="Augmentation Cost ($M)">
              {txChartData.map((entry, idx) => (
                <rect
                  key={idx}
                  fill={tnspColors[entry.tnsp] ?? '#9ca3af'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Access Rights Market */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Access Rights Market — Price and Volume</h2>
        <p className="text-gray-400 text-xs mb-4">
          Average access rights price (AUD/MW/year, left axis) and total traded rights (MW, right axis)
          across REZs by quarter. Rising prices indicate tightening supply relative to queue demand.
        </p>
        <div className="flex gap-4 mb-3">
          <span className="flex items-center gap-1 text-xs text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500" />
            Avg Access Price (AUD/MW/yr)
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" />
            Traded Rights (MW)
          </span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={accessByQuarter} margin={{ right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis
              yAxisId="price"
              stroke="#6366f1"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="volume"
              orientation="right"
              stroke="#f59e0b"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${v.toLocaleString()} MW`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, name: string) =>
                name === 'avg_price'
                  ? [`$${v.toLocaleString()}/MW/yr`, 'Avg Access Price']
                  : [`${v.toLocaleString()} MW`, 'Traded Rights']
              }
            />
            <Legend />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="avg_price"
              name="Avg Access Price"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="volume"
              type="monotone"
              dataKey="traded_rights_mw"
              name="Traded Rights (MW)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: REZ Performance */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          REZ Performance — Capacity Factors (Solar vs Wind)
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Average capacity factor (%) by REZ. Solar-dominated REZs (Pilbara, North QLD) achieve higher
          solar CFs; wind-dominant REZs (Western Vic, Yorke Peninsula) achieve higher wind CFs.
        </p>
        <div className="flex gap-4 mb-3">
          <span className="flex items-center gap-1 text-xs text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" />
            Solar CF (%)
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500" />
            Wind CF (%)
          </span>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={perfByRez} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              stroke="#9ca3af"
              tick={{ fontSize: 9, angle: -40, textAnchor: 'end' }}
              interval={0}
            />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`${v}%`, '']}
            />
            <Legend verticalAlign="top" />
            <Bar dataKey="cf_solar" name="Solar CF (%)" fill="#f59e0b" />
            <Bar dataKey="cf_wind" name="Wind CF (%)" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 6: Forecast — Capacity & Generation */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Forecast: REZ Capacity and Generation (2024–2033)
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Total REZ capacity (MW, left axis) and generation (TWh, right axis) by state 2024–2033.
          NSW leads capacity build-out from Central-West Orana and New England; QLD accelerates
          post-2026 with North QLD expansions.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          {forecastStates.map((state) => (
            <span key={state} className="flex items-center gap-1 text-xs text-gray-300">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: STATE_COLORS[state] ?? '#9ca3af' }}
              />
              {state}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={forecastChartData} margin={{ right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="cap"
              stroke="#9ca3af"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)} GW`}
            />
            <YAxis
              yAxisId="gen"
              orientation="right"
              stroke="#9ca3af"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${v} TWh`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
            />
            <Legend />
            {forecastStates.map((state) => (
              <Line
                key={`${state}_cap`}
                yAxisId="cap"
                type="monotone"
                dataKey={`${state}_cap`}
                name={`${state} Capacity (MW)`}
                stroke={STATE_COLORS[state] ?? '#9ca3af'}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
            {forecastStates.map((state) => (
              <Line
                key={`${state}_gen`}
                yAxisId="gen"
                type="monotone"
                dataKey={`${state}_gen`}
                name={`${state} Generation (TWh)`}
                stroke={STATE_COLORS[state] ?? '#9ca3af'}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Zone Summary Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-1">REZ Zone Register</h2>
        <p className="text-gray-400 text-xs mb-4">
          All 20 REZs with state, type, designated capacity and development stage.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700">
                {['REZ ID', 'Name', 'State', 'Type', 'Des. Cap (MW)', 'TX Limit (MW)', 'Stage', 'Est. Completion'].map((h) => (
                  <th key={h} className="text-left p-2 text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.rez_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                  <td className="p-2 font-mono text-indigo-300">{z.rez_id}</td>
                  <td className="p-2">{z.rez_name}</td>
                  <td className="p-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: (STATE_COLORS[z.state] ?? '#9ca3af') + '33',
                        color: STATE_COLORS[z.state] ?? '#9ca3af',
                      }}
                    >
                      {z.state}
                    </span>
                  </td>
                  <td className="p-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: (TYPE_COLORS[z.rez_type] ?? '#9ca3af') + '33',
                        color: TYPE_COLORS[z.rez_type] ?? '#9ca3af',
                      }}
                    >
                      {z.rez_type}
                    </span>
                  </td>
                  <td className="p-2 text-right">{z.designated_capacity_mw.toLocaleString()}</td>
                  <td className="p-2 text-right">{z.transmission_limit_mw.toLocaleString()}</td>
                  <td className="p-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        z.development_stage === 'Operating'
                          ? 'bg-green-900 text-green-300'
                          : z.development_stage === 'Under Development'
                          ? 'bg-indigo-900 text-indigo-300'
                          : z.development_stage === 'Determined'
                          ? 'bg-cyan-900 text-cyan-300'
                          : z.development_stage === 'Consultation'
                          ? 'bg-amber-900 text-amber-300'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {z.development_stage}
                    </span>
                  </td>
                  <td className="p-2 text-center">{z.estimated_completion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
