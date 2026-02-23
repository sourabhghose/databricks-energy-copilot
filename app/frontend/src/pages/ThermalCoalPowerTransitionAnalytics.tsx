import React, { useEffect, useState } from 'react'
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
import { Zap } from 'lucide-react'
import {
  getThermalCoalPowerTransitionDashboard,
  TCPTDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const FUEL_COLOURS: Record<string, string> = {
  'Black Coal': '#374151',
  'Brown Coal': '#92400e',
}

const COMMUNITY_COLOURS: Record<string, string> = {
  High:   '#ef4444',
  Medium: '#f59e0b',
  Low:    '#10b981',
}

const TECH_COLOURS: Record<string, string> = {
  'Wind Farm':      '#3b82f6',
  'Solar Farm':     '#f59e0b',
  'BESS':           '#10b981',
  'PHES':           '#06b6d4',
  'Interconnector': '#8b5cf6',
  'Demand Response':'#ec4899',
}

const STATION_LINE_COLOURS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
]

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-medium">
        <Zap size={16} />
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ThermalCoalPowerTransitionAnalytics() {
  const [data, setData] = useState<TCPTDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getThermalCoalPowerTransitionDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Thermal Coal Power Station Transition Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>

  // ── Chart 1: Bar — installed_capacity_mw by station coloured by fuel_type ──
  const chart1Data = data.stations
    .slice()
    .sort((a, b) => b.installed_capacity_mw - a.installed_capacity_mw)
    .map((s) => ({
      name: s.station_name,
      installed_capacity_mw: s.installed_capacity_mw,
      fuel_type: s.fuel_type,
      closure_year: s.announced_closure_year,
    }))

  // ── Chart 2: Line — aggregate remaining_capacity_mw by year ──────────────
  const yearTotals: Record<number, number> = {}
  for (const t of data.closure_timeline) {
    yearTotals[t.year] = (yearTotals[t.year] ?? 0) + t.remaining_capacity_mw
  }
  const chart2Data = Object.entries(yearTotals)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, mw]) => ({ year: Number(year), remaining_capacity_mw: Math.round(mw) }))

  // ── Chart 3: Bar — direct + indirect workers by station ──────────────────
  const chart3Data = data.worker_impact
    .slice()
    .sort((a, b) => b.direct_workers + b.indirect_workers - (a.direct_workers + a.indirect_workers))
    .map((w) => {
      const st = data.stations.find((s) => s.station_name === w.station_name)
      return {
        name: w.station_name,
        direct_workers: w.direct_workers,
        indirect_workers: w.indirect_workers,
        community_dependence: st?.community_dependence ?? 'Medium',
      }
    })

  // ── Chart 4: Stacked bar — replacement capacity_mw by station × technology ──
  const repl_stations = Array.from(new Set(data.replacement_plan.map((r) => r.station_name)))
  const all_techs = Array.from(new Set(data.replacement_plan.map((r) => r.replacement_technology)))
  const replByStationTech: Record<string, Record<string, number>> = {}
  for (const r of data.replacement_plan) {
    if (!replByStationTech[r.station_name]) replByStationTech[r.station_name] = {}
    replByStationTech[r.station_name][r.replacement_technology] =
      (replByStationTech[r.station_name][r.replacement_technology] ?? 0) + r.capacity_mw
  }
  const chart4Data = repl_stations.map((sname) => ({
    name: sname,
    ...replByStationTech[sname],
  }))

  // ── Chart 5: Line — srmc_per_mwh by year for 5 stations ─────────────────
  const econ5Stations = Array.from(new Set(data.economics.map((e) => e.station_name))).slice(0, 5)
  const econYears = Array.from(new Set(data.economics.map((e) => e.year))).sort((a, b) => a - b)
  const srmcByYearStation: Record<number, Record<string, number>> = {}
  for (const e of data.economics) {
    if (!srmcByYearStation[e.year]) srmcByYearStation[e.year] = {}
    srmcByYearStation[e.year][e.station_name] = e.srmc_per_mwh
  }
  const chart5Data = econYears.map((yr) => ({
    year: yr,
    ...(srmcByYearStation[yr] ?? {}),
  }))

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap size={28} className="text-amber-500 dark:text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Thermal Coal Power Station Transition Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sprint 129c — TCPT | Closure Timeline, Worker Impact, Replacement Plans &amp; Station Economics
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Remaining Capacity"
          value={`${summary['total_remaining_capacity_gw']} GW`}
          sub="Current derated fleet capacity"
        />
        <KpiCard
          label="Stations Closed by 2030"
          value={String(summary['stations_closed_by_2030'])}
          sub="Announced closures ≤ 2030"
        />
        <KpiCard
          label="Total Workers Affected"
          value={`${summary['total_workers_affected_k']}k`}
          sub="Direct + indirect employment"
        />
        <KpiCard
          label="CO2 Reduction by 2035"
          value={`${summary['co2_reduction_mt_by_2035']} Mt`}
          sub="Estimated cumulative abatement"
        />
      </div>

      {/* Chart 1 — Installed capacity by station coloured by fuel type */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Installed Capacity by Station (MW) — Fuel Type &amp; Closure Year
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart1Data} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(val: number) => [`${val} MW`, 'Installed Capacity']}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload
                return item
                  ? `${label} | ${item.fuel_type} | Closes ${item.closure_year}`
                  : label
              }}
            />
            <Bar dataKey="installed_capacity_mw" name="Installed Capacity (MW)" radius={[4, 4, 0, 0]}>
              {chart1Data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={FUEL_COLOURS[entry.fuel_type] ?? '#6b7280'}
                />
              ))}
            </Bar>
            <Legend
              payload={Object.entries(FUEL_COLOURS).map(([name, color]) => ({
                value: name,
                type: 'square' as const,
                color,
              }))}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2 — Aggregate remaining capacity over time */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Aggregate Remaining Coal Capacity by Year (MW)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chart2Data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(val: number) => [`${val.toLocaleString()} MW`, 'Remaining Capacity']} />
            <Line
              type="monotone"
              dataKey="remaining_capacity_mw"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ r: 4 }}
              name="Remaining Capacity (MW)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3 — Worker impact by station */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Direct &amp; Indirect Workers by Station — Community Dependence
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart3Data} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="direct_workers" name="Direct Workers" stackId="a" radius={[0, 0, 0, 0]}>
              {chart3Data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={COMMUNITY_COLOURS[entry.community_dependence] ?? '#6b7280'}
                />
              ))}
            </Bar>
            <Bar dataKey="indirect_workers" name="Indirect Workers" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — Replacement capacity stacked by technology */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Replacement Capacity by Station &amp; Technology (MW)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart4Data} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {all_techs.map((tech) => (
              <Bar
                key={tech}
                dataKey={tech}
                stackId="b"
                fill={TECH_COLOURS[tech] ?? '#6b7280'}
                name={tech}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 — SRMC by year for 5 stations */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Short-Run Marginal Cost ($/MWh) by Year — Top 5 Stations
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chart5Data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {econ5Stations.map((sname, idx) => (
              <Line
                key={sname}
                type="monotone"
                dataKey={sname}
                stroke={STATION_LINE_COLOURS[idx % STATION_LINE_COLOURS.length]}
                strokeWidth={2}
                dot={false}
                name={sname}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Summary Statistics
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(summary).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <dt className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 dark:text-white">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
