import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { Droplets, AlertTriangle, TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { api } from '../api/client'
import type {
  HydroDashboard,
  ReservoirRecord,
  WaterValuePoint,
  HydroSchemeSummary,
  HydroInflowForecast,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function outlookBadge(outlook: string) {
  if (outlook === 'ABOVE_AVERAGE') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  if (outlook === 'BELOW_AVERAGE') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
}

function usablePctColor(pct: number) {
  if (pct < 30) return 'bg-red-500'
  if (pct < 50) return 'bg-amber-500'
  return 'bg-green-500'
}

function usablePctText(pct: number) {
  if (pct < 30) return 'text-red-600 dark:text-red-400'
  if (pct < 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-green-600 dark:text-green-400'
}

function confidenceBadge(conf: string) {
  if (conf === 'HIGH') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  if (conf === 'LOW')  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
}

function periodBadge(period: string) {
  if (period === '7-DAY')  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  if (period === '30-DAY') return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
  return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
}

function schemeBadgeColor(scheme: string) {
  if (scheme === 'Snowy Hydro')    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  if (scheme === 'Hydro Tasmania') return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
  if (scheme === 'AGL Hydro')      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent?: string
}

function KpiCard({ title, value, sub, icon, accent }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4 shadow-sm">
      <div className={`p-2 rounded-lg ${accent ?? 'bg-blue-50 dark:bg-blue-900/30'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scheme Summary Card
// ---------------------------------------------------------------------------

function SchemeCard({ scheme }: { scheme: HydroSchemeSummary }) {
  const pct = scheme.total_storage_pct
  const circumference = 2 * Math.PI * 28
  const offset = circumference - (pct / 100) * circumference
  const strokeColor = pct < 30 ? '#ef4444' : pct < 50 ? '#f59e0b' : '#22c55e'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{scheme.scheme}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{scheme.region}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${schemeBadgeColor(scheme.scheme)}`}>
          {scheme.num_stations} stations
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Circular progress */}
        <div className="relative shrink-0">
          <svg width="64" height="64" className="-rotate-90">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="5" className="dark:stroke-gray-700" />
            <circle
              cx="32" cy="32" r="28" fill="none"
              stroke={strokeColor} strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900 dark:text-white">
            {pct.toFixed(0)}%
          </span>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-y-1 text-xs">
          <span className="text-gray-500 dark:text-gray-400">Capacity</span>
          <span className="font-medium text-gray-900 dark:text-white text-right">{scheme.total_capacity_mw.toLocaleString()} MW</span>
          <span className="text-gray-500 dark:text-gray-400">Water value</span>
          <span className="font-medium text-gray-900 dark:text-white text-right">${scheme.avg_water_value_aud_ml}/ML</span>
          <span className="text-gray-500 dark:text-gray-400">Annual energy</span>
          <span className="font-medium text-gray-900 dark:text-white text-right">{scheme.annual_energy_twh} TWh</span>
          <span className="text-gray-500 dark:text-gray-400">Critical threshold</span>
          <span className="font-medium text-gray-900 dark:text-white text-right">{scheme.critical_storage_threshold_pct}%</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Water Value Chart
// ---------------------------------------------------------------------------

interface WaterValueChartProps {
  data: WaterValuePoint[]
  currentStoragePct: number
}

function buildChartData(points: WaterValuePoint[]) {
  // Group by usable_storage_pct and collect regime values
  const map = new Map<number, { DROUGHT?: number; AVERAGE?: number; WET?: number }>()
  for (const p of points) {
    const existing = map.get(p.usable_storage_pct) ?? {}
    ;(existing as Record<string, number>)[p.regime] = p.water_value_aud_ml
    map.set(p.usable_storage_pct, existing)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([pct, vals]) => ({ pct, ...vals }))
}

function WaterValueChart({ data, currentStoragePct }: WaterValueChartProps) {
  const chartData = buildChartData(data)
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Water Value Curve</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Shadow price ($/ML) vs usable storage % — vertical line = current NEM storage</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
          <XAxis
            dataKey="pct"
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
            label={{ value: 'Usable Storage (%)', position: 'insideBottom', offset: -2, fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(v) => `$${v}`}
            tick={{ fontSize: 11 }}
            label={{ value: '$/ML', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number, name: string) => [`$${value.toFixed(1)}/ML`, name]}
            labelFormatter={(l) => `Storage: ${l}%`}
          />
          <Legend verticalAlign="top" height={28} />
          <ReferenceLine
            x={currentStoragePct}
            stroke="#6366f1"
            strokeDasharray="4 4"
            label={{ value: `Current ${currentStoragePct.toFixed(0)}%`, position: 'top', fontSize: 10, fill: '#6366f1' }}
          />
          <Line type="monotone" dataKey="DROUGHT" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="AVERAGE" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="WET"     stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reservoir Table
// ---------------------------------------------------------------------------

interface ReservoirTableProps {
  reservoirs: ReservoirRecord[]
}

function ReservoirTable({ reservoirs }: ReservoirTableProps) {
  const [schemeFilter, setSchemeFilter] = useState<string>('ALL')
  const [stateFilter, setStateFilter] = useState<string>('ALL')

  const schemes = ['ALL', ...Array.from(new Set(reservoirs.map((r) => r.scheme)))]
  const states  = ['ALL', ...Array.from(new Set(reservoirs.map((r) => r.state)))]

  const filtered = reservoirs.filter((r) => {
    if (schemeFilter !== 'ALL' && r.scheme !== schemeFilter) return false
    if (stateFilter  !== 'ALL' && r.state  !== stateFilter)  return false
    return true
  })

  const totalGwh = filtered.reduce((s, r) => s + r.energy_potential_gwh, 0)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white flex-1">Reservoir Storage</h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Total energy potential: <strong className="text-gray-700 dark:text-gray-200">{totalGwh.toLocaleString(undefined, { maximumFractionDigits: 0 })} GWh</strong>
        </span>
        {/* Scheme filter */}
        <select
          value={schemeFilter}
          onChange={(e) => setSchemeFilter(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          {schemes.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All Schemes' : s}</option>)}
        </select>
        {/* State filter */}
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          {states.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All States' : s}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50">
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Scheme</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">State</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 min-w-[120px]">Usable %</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Storage GL</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Inflow 7d</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Outflow 7d</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Net Change</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Energy (GWh)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((r) => (
              <tr key={r.reservoir_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">{r.name}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${schemeBadgeColor(r.scheme)}`}>{r.scheme}</span>
                </td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{r.state}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${usablePctColor(r.usable_pct)}`}
                        style={{ width: `${Math.min(r.usable_pct, 100)}%` }}
                      />
                    </div>
                    <span className={`w-10 text-right font-semibold ${usablePctText(r.usable_pct)}`}>{r.usable_pct.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{r.current_storage_gl.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">+{r.inflow_7d_gl.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">-{r.outflow_7d_gl.toFixed(1)}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${r.net_change_7d_gl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {r.net_change_7d_gl >= 0 ? '+' : ''}{r.net_change_7d_gl.toFixed(1)} GL
                </td>
                <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{r.energy_potential_gwh.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">No reservoirs match the current filters.</div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inflow Forecasts Table
// ---------------------------------------------------------------------------

function InflowForecastsTable({ forecasts }: { forecasts: HydroInflowForecast[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Inflow Forecasts</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Probabilistic inflow forecasts across NEM hydro schemes</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50">
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Scheme</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Region</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Period</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Forecast GL</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">vs Median %</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Prob. Exceedance %</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Scenario</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {forecasts.map((f, i) => {
              const vsMedianColor = f.vs_median_pct > 100 ? 'text-green-600 dark:text-green-400' : f.vs_median_pct < 90 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
              return (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">{f.scheme}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{f.region}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${periodBadge(f.forecast_period)}`}>{f.forecast_period}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{f.inflow_gl.toLocaleString()}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${vsMedianColor}`}>
                    {f.vs_median_pct.toFixed(0)}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{f.probability_exceedance_pct.toFixed(0)}%</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{f.scenario}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${confidenceBadge(f.confidence)}`}>{f.confidence}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function HydroStorage() {
  const [dashboard, setDashboard] = useState<HydroDashboard | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    api.getHydroDashboard()
      .then(setDashboard)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load hydro data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400 text-sm animate-pulse">Loading hydro storage data…</div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500 dark:text-red-400 text-sm">{error ?? 'No data available'}</div>
      </div>
    )
  }

  const totalEnergyGwh = dashboard.reservoirs.reduce((s, r) => s + r.energy_potential_gwh, 0)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
            <Droplets className="text-blue-600 dark:text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Hydro Storage &amp; Water Value Analytics</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Reservoir levels, inflow forecasts, water value curves — NEM hydro portfolio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${outlookBadge(dashboard.forecast_outlook)}`}>
            Forecast: {dashboard.forecast_outlook.replace('_', ' ')}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {new Date(dashboard.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="NEM Hydro Storage"
          value={`${dashboard.total_nem_hydro_storage_pct.toFixed(1)}%`}
          sub="Weighted usable capacity"
          icon={<Droplets size={20} className={dashboard.total_nem_hydro_storage_pct < 30 ? 'text-red-500' : dashboard.total_nem_hydro_storage_pct < 50 ? 'text-amber-500' : 'text-blue-500'} />}
          accent={dashboard.total_nem_hydro_storage_pct < 30 ? 'bg-red-50 dark:bg-red-900/30' : dashboard.total_nem_hydro_storage_pct < 50 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-blue-50 dark:bg-blue-900/30'}
        />
        <KpiCard
          title="vs Last Year"
          value={`${dashboard.vs_last_year_pct_pts >= 0 ? '+' : ''}${dashboard.vs_last_year_pct_pts.toFixed(1)} pp`}
          sub="Percentage point change"
          icon={dashboard.vs_last_year_pct_pts >= 0
            ? <TrendingUp size={20} className="text-green-500" />
            : <TrendingDown size={20} className="text-red-500" />}
          accent={dashboard.vs_last_year_pct_pts >= 0 ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'}
        />
        <KpiCard
          title="Critical Reservoirs"
          value={String(dashboard.critical_reservoirs)}
          sub="Below 30% usable storage"
          icon={<AlertTriangle size={20} className={dashboard.critical_reservoirs > 0 ? 'text-red-500' : 'text-gray-400'} />}
          accent={dashboard.critical_reservoirs > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-700/30'}
        />
        <KpiCard
          title="Total Energy Potential"
          value={`${(totalEnergyGwh / 1000).toFixed(1)} TWh`}
          sub={`${totalEnergyGwh.toLocaleString(undefined, { maximumFractionDigits: 0 })} GWh available`}
          icon={<Zap size={20} className="text-amber-500" />}
          accent="bg-amber-50 dark:bg-amber-900/30"
        />
      </div>

      {/* Scheme Summary Cards */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Scheme Summaries</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dashboard.schemes.map((s) => (
            <SchemeCard key={s.scheme} scheme={s} />
          ))}
        </div>
      </div>

      {/* Water Value Curve */}
      <WaterValueChart
        data={dashboard.water_value_curve}
        currentStoragePct={dashboard.total_nem_hydro_storage_pct}
      />

      {/* Reservoir Table */}
      <ReservoirTable reservoirs={dashboard.reservoirs} />

      {/* Inflow Forecasts Table */}
      <InflowForecastsTable forecasts={dashboard.inflow_forecasts} />
    </div>
  )
}
