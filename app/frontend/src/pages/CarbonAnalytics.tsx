import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { Leaf, Wind, TrendingDown, Zap, AlertCircle, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import type {
  CarbonDashboard,
  RegionEmissionsRecord,
  FuelEmissionsFactor,
  EmissionsTrajectory,
  Scope2Calculator,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function intensityColor(val: number): string {
  if (val < 200) return 'text-green-600 dark:text-green-400'
  if (val < 400) return 'text-amber-500 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function intensityBg(val: number): string {
  if (val < 200) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  if (val < 400) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
}

function fuelColor(val: number): string {
  if (val === 0) return 'text-green-600 dark:text-green-400'
  if (val < 200) return 'text-blue-600 dark:text-blue-400'
  if (val < 600) return 'text-amber-500 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function fuelBg(val: number): string {
  if (val === 0) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  if (val < 200) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  if (val < 600) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  unit,
  sub,
  icon: Icon,
  highlight,
}: {
  title: string
  value: string | number
  unit?: string
  sub?: string
  icon: React.ElementType
  highlight?: 'green' | 'amber' | 'red' | 'blue'
}) {
  const border = {
    green: 'border-l-green-500',
    amber: 'border-l-amber-500',
    red: 'border-l-red-500',
    blue: 'border-l-blue-500',
  }[highlight ?? 'blue']

  const iconCol = {
    green: 'text-green-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
    blue: 'text-blue-500',
  }[highlight ?? 'blue']

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 border-l-4 ${border} p-5 flex items-start gap-4`}
    >
      <div className={`mt-1 ${iconCol}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
          {title}
        </p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          {value}
          {unit && (
            <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">
              {unit}
            </span>
          )}
        </p>
        {sub && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</p>
        )}
      </div>
    </div>
  )
}

function ProgressBar({ value, max = 100, color = 'bg-green-500' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
      <div
        className={`${color} h-2 rounded-full transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function FuelChip({ label, pct }: { label: string; pct: number }) {
  if (pct <= 0) return null
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 mr-1 mb-0.5">
      {label} {pct.toFixed(0)}%
    </span>
  )
}

// ---------------------------------------------------------------------------
// Custom tooltip for trajectory chart
// ---------------------------------------------------------------------------
interface TooltipPayloadEntry {
  name: string
  value: number | null
  color: string
}

function TrajectoryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{label}</p>
      {payload.map((p) =>
        p.value != null ? (
          <p key={p.name} style={{ color: p.color }} className="leading-5">
            {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
          </p>
        ) : null,
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function CarbonAnalytics() {
  const [dashboard, setDashboard] = useState<CarbonDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getCarbonDashboard()
      setDashboard(data)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch carbon data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [])

  // ------------------------------------------------------------------
  // Loading / error states
  // ------------------------------------------------------------------
  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-green-500 mr-3" size={24} />
        <span className="text-gray-500 dark:text-gray-400">Loading carbon analytics…</span>
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-6 rounded-xl m-6">
        <AlertCircle size={20} />
        <div>
          <p className="font-semibold">Failed to load carbon data</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!dashboard) return null

  const {
    nem_emissions_intensity_now,
    renewable_share_now_pct,
    vs_same_time_last_year_pct,
    lowest_region,
    lowest_intensity,
    highest_region,
    highest_intensity,
    annual_trajectory,
    region_records,
    fuel_factors,
    scope2_by_state,
  } = dashboard

  // ------------------------------------------------------------------
  // Trajectory chart data: merge actual + forecast on same year axis
  // ------------------------------------------------------------------
  const trajectoryData = annual_trajectory.map((t: EmissionsTrajectory) => ({
    year: t.year,
    actual: t.actual_emissions_mt,
    forecast: t.forecast_emissions_mt,
    renewable: t.renewable_share_pct,
  }))

  const improvement = Math.abs(vs_same_time_last_year_pct)
  const improving = vs_same_time_last_year_pct < 0

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Leaf className="text-green-500" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Carbon &amp; Emissions Analytics
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Real-time NEM emissions intensity, Net Zero trajectory &amp; Scope 2 accounting
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-sm font-semibold">
            <Leaf size={14} />
            {renewable_share_now_pct.toFixed(1)}% Renewable Now
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* KPI Cards                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="NEM Emissions Intensity Now"
          value={nem_emissions_intensity_now.toFixed(0)}
          unit="kg CO₂/MWh"
          sub={`Highest: ${highest_region} (${highest_intensity} kg/MWh)`}
          icon={Zap}
          highlight={nem_emissions_intensity_now < 300 ? 'green' : nem_emissions_intensity_now < 450 ? 'amber' : 'red'}
        />
        <KpiCard
          title="Renewable Share Now"
          value={renewable_share_now_pct.toFixed(1)}
          unit="%"
          sub="Weighted by regional generation"
          icon={Wind}
          highlight="green"
        />
        <KpiCard
          title="vs Same Time Last Year"
          value={`${improving ? '-' : '+'}${improvement.toFixed(1)}`}
          unit="%"
          sub={improving ? 'Emissions intensity improvement' : 'Emissions intensity increase'}
          icon={TrendingDown}
          highlight={improving ? 'green' : 'red'}
        />
        <KpiCard
          title="Lowest Intensity Region"
          value={lowest_region}
          unit=""
          sub={`${lowest_intensity} kg CO₂/MWh`}
          icon={Leaf}
          highlight="green"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Emissions Trajectory Chart                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="text-green-500" size={18} />
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">
            NEM Emissions Trajectory (2005 – 2035)
          </h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
          Historical actuals (blue) vs forecast pathway (dashed green) to Net Zero, with renewable share (right axis)
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={trajectoryData} margin={{ top: 8, right: 60, bottom: 8, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              label={{
                value: 'MT CO₂',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                style: { fontSize: 11, fill: '#6b7280' },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              label={{
                value: 'Renewable %',
                angle: 90,
                position: 'insideRight',
                offset: 10,
                style: { fontSize: 11, fill: '#6b7280' },
              }}
            />
            <Tooltip content={<TrajectoryTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine
              yAxisId="left"
              x={2026}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: 'Today', position: 'top', fontSize: 11, fill: '#f59e0b' }}
            />
            <Bar
              yAxisId="right"
              dataKey="renewable"
              name="Renewable Share %"
              fill="#bbf7d0"
              opacity={0.6}
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="actual"
              name="Actual Emissions (MT)"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="forecast"
              name="Forecast Emissions (MT)"
              stroke="#22c55e"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Region Emissions Intensity Table                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="text-amber-500" size={18} />
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">
            Regional Emissions Intensity
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Region
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Intensity (kg CO₂/MWh)
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-48">
                  Renewable %
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Net Emissions (t CO₂/hr)
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Fuel Mix
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {region_records
                .slice()
                .sort((a: RegionEmissionsRecord, b: RegionEmissionsRecord) => a.emissions_intensity_kg_co2_mwh - b.emissions_intensity_kg_co2_mwh)
                .map((r: RegionEmissionsRecord) => (
                  <tr
                    key={r.region}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">
                      {r.region}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-semibold text-sm ${intensityBg(r.emissions_intensity_kg_co2_mwh)}`}
                      >
                        {r.emissions_intensity_kg_co2_mwh.toFixed(0)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-green-600 dark:text-green-400 w-8 text-right">
                          {r.renewable_pct.toFixed(0)}%
                        </span>
                        <div className="flex-1">
                          <ProgressBar value={r.renewable_pct} color="bg-green-500" />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300 font-mono text-xs">
                      {r.net_emissions_t_co2_hr.toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap">
                        <FuelChip label="Coal" pct={r.coal_pct} />
                        <FuelChip label="Gas" pct={r.gas_pct} />
                        <FuelChip label="Wind" pct={r.wind_pct} />
                        <FuelChip label="Solar" pct={r.solar_pct} />
                        <FuelChip label="Hydro" pct={r.hydro_pct} />
                        <FuelChip label="Batt" pct={r.battery_pct} />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Fuel Emissions Factors Table                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wind className="text-blue-500" size={18} />
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">
            Fuel Emissions Factors
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Fuel Type
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Scope
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  kg CO₂/MWh
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  incl. Losses
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  NEM Share %
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Abatement Potential (GT)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {fuel_factors
                .slice()
                .sort((a: FuelEmissionsFactor, b: FuelEmissionsFactor) => b.kg_co2_mwh - a.kg_co2_mwh)
                .map((f: FuelEmissionsFactor) => (
                  <tr
                    key={f.fuel_type}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">
                      {f.fuel_type}
                    </td>
                    <td className="py-3 px-3 text-gray-500 dark:text-gray-400 text-xs">
                      {f.scope}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-semibold text-sm ${fuelBg(f.kg_co2_mwh)}`}
                      >
                        {f.kg_co2_mwh.toFixed(0)}
                      </span>
                    </td>
                    <td className={`py-3 px-3 text-right font-mono text-xs ${fuelColor(f.kg_co2_mwh_with_losses)}`}>
                      {f.kg_co2_mwh_with_losses.toFixed(0)}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300">
                      {f.generation_share_pct.toFixed(0)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-gray-600 dark:text-gray-400">
                      {f.annual_abatement_potential_gt > 0
                        ? f.annual_abatement_potential_gt.toFixed(3)
                        : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          * Lifecycle emissions for renewables are near-zero in operation. Transmission loss factor ~10% applied to &ldquo;incl. Losses&rdquo; column.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Scope 2 Calculator Table                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Leaf className="text-green-500" size={18} />
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">
            Scope 2 Emissions by State
          </h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Market-based Scope 2 emissions for representative commercial consumption, accounting for GreenPower offsets
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  State
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Consumption (GWh)
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Emissions Factor (kg/MWh)
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Gross Scope 2 (t CO₂)
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-40">
                  GreenPower Offset
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Net Scope 2 (t CO₂)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {scope2_by_state.map((s: Scope2Calculator) => (
                <tr
                  key={s.state}
                  className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">
                    {s.state}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300 font-mono text-xs">
                    {s.consumption_gwh.toFixed(0)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`font-semibold ${intensityColor(s.emissions_factor_kg_co2_mwh * 1000)}`}>
                      {s.emissions_factor_kg_co2_mwh.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300 font-mono text-xs">
                    {s.scope2_emissions_t_co2.toLocaleString()}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 w-8 text-right">
                        {s.green_power_offset_pct.toFixed(0)}%
                      </span>
                      <div className="flex-1">
                        <ProgressBar value={s.green_power_offset_pct} color="bg-emerald-500" />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white font-mono text-xs">
                    {s.net_scope2_t_co2.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          State emissions factors sourced from NGA Factors (2024). GreenPower offset reflects voluntary renewable energy certificate purchases.
        </p>
      </div>
    </div>
  )
}
