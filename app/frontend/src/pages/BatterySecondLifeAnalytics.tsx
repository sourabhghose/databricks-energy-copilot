import React, { useEffect, useState } from 'react'
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
import { RefreshCw } from 'lucide-react'
import {
  getBatterySecondLifeDashboard,
  BSLADashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const SEGMENT_COLOURS: Record<string, string> = {
  'EV Passenger':        '#3b82f6',
  'EV Commercial':       '#f59e0b',
  'Stationary Storage':  '#10b981',
  'Grid BESS':           '#8b5cf6',
  'Consumer Electronics':'#f97316',
}

const STATUS_COLOURS: Record<string, string> = {
  'Operating':          '#10b981',
  'Under Construction': '#f59e0b',
  'Proposed':           '#6b7280',
}

const MATERIAL_COLOURS: Record<string, string> = {
  'Lithium':   '#3b82f6',
  'Cobalt':    '#f59e0b',
  'Nickel':    '#10b981',
  'Manganese': '#8b5cf6',
  'Graphite':  '#06b6d4',
  'Copper':    '#f97316',
  'Aluminium': '#84cc16',
}

const BATTERY_TYPE_COLOURS: Record<string, string> = {
  'LFP':        '#10b981',
  'NMC':        '#3b82f6',
  'NCA':        '#f59e0b',
  'LTO':        '#8b5cf6',
  'Solid State':'#06b6d4',
}

const REG_STATUS_COLOURS: Record<string, string> = {
  'Active':       '#10b981',
  'Under Review': '#f59e0b',
  'Proposed':     '#6b7280',
}

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
        <RefreshCw size={16} />
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

export default function BatterySecondLifeAnalytics() {
  const [data, setData] = useState<BSLADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBatterySecondLifeDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Battery Second Life &amp; Circular Economy Analytics…
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

  // ── Chart 1: Stacked bar — retirement_forecast_2030_units by fleet_segment × region ──
  const regionMap: Record<string, Record<string, number>> = {}
  for (const f of data.fleet) {
    if (!regionMap[f.region]) regionMap[f.region] = {}
    regionMap[f.region][f.fleet_segment] =
      (regionMap[f.region][f.fleet_segment] ?? 0) + f.retirement_forecast_2030_units
  }
  const retirementByRegion = Object.entries(regionMap).map(([region, segs]) => ({
    region,
    ...segs,
  }))
  const allSegments = Array.from(new Set(data.fleet.map((f) => f.fleet_segment)))

  // ── Chart 2: Bar — input_capacity_tpa by facility coloured by status ──────
  const facilityChartData = data.facilities.map((fac) => ({
    name: fac.facility_name.length > 24 ? fac.facility_name.slice(0, 22) + '…' : fac.facility_name,
    input_capacity_tpa: fac.input_capacity_tpa,
    status: fac.status,
    fill: STATUS_COLOURS[fac.status] ?? '#6b7280',
  }))

  // ── Chart 3: Line — recovered_tonnes by year for 7 materials ─────────────
  const materialYearMap: Record<number, Record<string, number>> = {}
  for (const m of data.materials) {
    if (!materialYearMap[m.year]) materialYearMap[m.year] = {}
    materialYearMap[m.year][m.material] = m.recovered_tonnes
  }
  const materialLineData = Object.entries(materialYearMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, mats]) => ({ year, ...mats }))
  const allMaterials = Array.from(new Set(data.materials.map((m) => m.material)))

  // ── Chart 4: Bar — deployed_mwh by application coloured by battery_type ───
  const appTypeMap: Record<string, Record<string, number>> = {}
  for (const s of data.second_life) {
    if (!appTypeMap[s.application]) appTypeMap[s.application] = {}
    appTypeMap[s.application][s.battery_type] =
      (appTypeMap[s.application][s.battery_type] ?? 0) + s.deployed_mwh
  }
  const secondLifeChartData = Object.entries(appTypeMap).map(([application, types]) => ({
    application,
    ...types,
  }))
  const allBatteryTypes = Array.from(new Set(data.second_life.map((s) => s.battery_type)))

  // ── Chart 5: Bar — recycling_target_pct by regulation_name coloured by status ──
  const regChartData = data.regulations.map((r) => ({
    name: r.regulation_name.length > 22 ? r.regulation_name.slice(0, 20) + '…' : r.regulation_name,
    recycling_target_pct: r.recycling_target_pct,
    status: r.status,
    fill: REG_STATUS_COLOURS[r.status] ?? '#6b7280',
  }))

  return (
    <div className="p-6 space-y-8 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <RefreshCw size={28} className="text-emerald-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Battery Second Life &amp; Circular Economy Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Fleet retirement forecasts, processing facilities, material recovery, second-life applications and regulations
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Batteries Retiring 2030"
          value={(summary.total_batteries_retiring_2030 as number).toLocaleString()}
          sub="Across all segments & states"
        />
        <KpiCard
          label="Processing Capacity"
          value={`${((summary.total_processing_capacity_tpa as number) / 1000).toFixed(1)}k tpa`}
          sub="Total facility input capacity"
        />
        <KpiCard
          label="Second Life Deployed"
          value={`${(summary.second_life_deployed_mwh as number).toFixed(1)} MWh`}
          sub="Across all applications"
        />
        <KpiCard
          label="Leading Technology"
          value={summary.leading_technology as string}
          sub="Most common processing method"
        />
      </div>

      {/* Chart 1 — Retirement Forecast by Region & Segment */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Battery Retirement Forecast 2030 — Units by Region &amp; Segment
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={retirementByRegion} margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="region" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [v.toLocaleString(), '']} />
            <Legend />
            {allSegments.map((seg) => (
              <Bar
                key={seg}
                dataKey={seg}
                stackId="region"
                fill={SEGMENT_COLOURS[seg] ?? '#6b7280'}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2 — Processing Facility Capacity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Processing Facility Input Capacity (tpa) — Coloured by Status
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={facilityChartData}
            layout="vertical"
            margin={{ top: 4, right: 20, bottom: 4, left: 220 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)} t`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={215} />
            <Tooltip
              formatter={(v: number, _: string, props: { payload?: { status?: string } }) => [
                `${v.toFixed(0)} tpa`,
                props.payload?.status ?? 'Capacity',
              ]}
            />
            <Bar dataKey="input_capacity_tpa" name="Input Capacity (tpa)" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
          {Object.entries(STATUS_COLOURS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: v }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 3 — Material Recovery by Year */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Material Recovery Volumes by Year (tonnes) — 2024–2035
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={materialLineData} margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(0)} t`, '']} />
            <Legend />
            {allMaterials.map((mat) => (
              <Line
                key={mat}
                type="monotone"
                dataKey={mat}
                stroke={MATERIAL_COLOURS[mat] ?? '#6b7280'}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — Second Life Applications Deployed (MWh) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Second Life Deployed Capacity (MWh) by Application &amp; Battery Type
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={secondLifeChartData} margin={{ top: 4, right: 20, bottom: 24, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="application" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
            <YAxis tickFormatter={(v) => `${v.toFixed(0)} MWh`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)} MWh`, '']} />
            <Legend />
            {allBatteryTypes.map((bt) => (
              <Bar
                key={bt}
                dataKey={bt}
                stackId="app"
                fill={BATTERY_TYPE_COLOURS[bt] ?? '#6b7280'}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 — Recycling Targets by Regulation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Recycling Targets by Regulation (%) — Coloured by Status
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={regChartData}
            layout="vertical"
            margin={{ top: 4, right: 20, bottom: 4, left: 210 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={205} />
            <Tooltip
              formatter={(v: number, _: string, props: { payload?: { status?: string } }) => [
                `${v.toFixed(1)}%`,
                props.payload?.status ?? 'Target',
              ]}
            />
            <Bar dataKey="recycling_target_pct" name="Recycling Target (%)" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
          {Object.entries(REG_STATUS_COLOURS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: v }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Total Batteries Retiring 2030</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {(summary.total_batteries_retiring_2030 as number).toLocaleString()} units
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Total Processing Capacity</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {(summary.total_processing_capacity_tpa as number).toLocaleString()} tpa
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Lithium Recovery Value</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              ${(summary.lithium_recovery_value_m as number).toFixed(1)}M
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Second Life Deployed</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {(summary.second_life_deployed_mwh as number).toFixed(1)} MWh
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Leading Technology</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {summary.leading_technology as string}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Facilities Tracked</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {data.facilities.length} facilities
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
