import React, { useState, useEffect, useCallback } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Sun, Battery, Zap, Home, RefreshCw } from 'lucide-react'
import { api, DerDashboard as DerDashboardType, VppUnit } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return n.toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

function modeBadgeClass(mode: string): string {
  switch (mode) {
    case 'peak_support':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'frequency_response':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    case 'arbitrage':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'peak_support':      return 'Peak Support'
    case 'frequency_response': return 'Freq. Response'
    case 'arbitrage':         return 'Arbitrage'
    default:                  return 'Idle'
  }
}

function dispatchColor(mw: number): string {
  if (mw > 0) return 'text-green-600 dark:text-green-400'
  if (mw < 0) return 'text-blue-600 dark:text-blue-400'
  return 'text-gray-500 dark:text-gray-400'
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: string
}

function SummaryCard({ icon, label, value, sub, accent = 'text-amber-500' }: SummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2">
      <div className={`flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400`}>
        <span className={accent}>{icon}</span>
        {label}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// VPP Fleet Table
// ---------------------------------------------------------------------------

interface VppTableProps {
  vpps: VppUnit[]
}

function VppFleetTable({ vpps }: VppTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">VPP Fleet</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="px-3 py-2 text-left">VPP Name</th>
              <th className="px-3 py-2 text-left">Operator</th>
              <th className="px-3 py-2 text-left">Region</th>
              <th className="px-3 py-2 text-right">Households</th>
              <th className="px-3 py-2 text-right">Capacity MW</th>
              <th className="px-3 py-2 text-right">Battery MWh</th>
              <th className="px-3 py-2 text-right">EVs</th>
              <th className="px-3 py-2 text-right">Dispatch MW</th>
              <th className="px-3 py-2 text-center">Mode</th>
              <th className="px-3 py-2 text-right">Revenue Today</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {vpps.map((vpp) => (
              <tr
                key={vpp.vpp_id}
                className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                  {vpp.vpp_name}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {vpp.operator}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {vpp.region}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {formatNumber(vpp.participating_households)}
                </td>
                <td className="px-3 py-2 text-right font-medium text-gray-800 dark:text-gray-200">
                  {vpp.total_capacity_mw.toFixed(0)}
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {vpp.battery_capacity_mwh.toFixed(0)}
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {formatNumber(vpp.ev_count)}
                </td>
                <td className={`px-3 py-2 text-right font-semibold ${dispatchColor(vpp.current_dispatch_mw)}`}>
                  {vpp.current_dispatch_mw >= 0 ? '+' : ''}{vpp.current_dispatch_mw.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${modeBadgeClass(vpp.mode)}`}>
                    {modeLabel(vpp.mode)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  ${formatNumber(vpp.revenue_today_aud)}
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
// Main page
// ---------------------------------------------------------------------------

const REGIONS = ['All', 'NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

export default function DerDashboard() {
  const [data, setData] = useState<DerDashboardType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string>('All')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const region = selectedRegion === 'All' ? undefined : selectedRegion
      const result = await api.getDerDashboard(region)
      setData(result)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DER dashboard')
    } finally {
      setLoading(false)
    }
  }, [selectedRegion])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Build stacked bar chart data for regional DER comparison
  const regionalBarData = data?.regional_der.map((r) => ({
    region: r.region,
    'Rooftop Solar MW': Math.round(r.rooftop_solar_output_mw),
    'BTM Battery MW': Math.round(r.btm_battery_output_mw),
    'EV Load MW': Math.round(r.ev_charging_mw),
    'Net Reduction %': r.solar_penetration_pct,
  })) ?? []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            VPP &amp; Distributed Energy
          </h1>
          <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 tracking-wide">
            DER
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Region selector */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r === 'All' ? 'All Regions' : r}</option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Last refresh */}
      <p className="text-xs text-gray-400 dark:text-gray-500 -mt-4">
        Last updated: {lastRefresh.toLocaleTimeString('en-AU')}
      </p>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* NEM DER Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              icon={<Sun size={16} />}
              label="Rooftop Solar"
              value={`${data.nem_rooftop_solar_gw.toFixed(1)} GW installed`}
              sub="~3.5 million households"
              accent="text-yellow-500"
            />
            <SummaryCard
              icon={<Zap size={16} />}
              label="Current Solar Output"
              value={`${formatNumber(Math.round(data.regional_der.reduce((s, r) => s + r.rooftop_solar_output_mw, 0)))} MW`}
              sub="NEM-wide generation now"
              accent="text-amber-500"
            />
            <SummaryCard
              icon={<Home size={16} />}
              label="Net Demand Reduction"
              value={`${formatNumber(Math.round(data.nem_net_demand_reduction_mw))} MW`}
              sub="Rooftop solar + BTM battery"
              accent="text-green-500"
            />
            <SummaryCard
              icon={<Battery size={16} />}
              label="BTM Batteries"
              value={`${data.nem_btm_battery_gwh.toFixed(1)} GWh`}
              sub="Behind-the-meter storage"
              accent="text-purple-500"
            />
          </div>

          {/* 24-Hour Solar Forecast (duck curve) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                24-Hour Rooftop Solar Forecast
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                NEM-wide aggregate — bell curve peaking ~midday; duck curve effect visible in net demand
              </p>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={data.hourly_solar_forecast}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                  tick={{ fontSize: 11 }}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  label={{ value: 'MW', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number) => [`${formatNumber(value)} MW`, 'Solar Output']}
                  labelFormatter={(h) => `Hour ${String(h).padStart(2, '0')}:00`}
                />
                <Area
                  type="monotone"
                  dataKey="solar_mw"
                  name="Solar MW"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#solarGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* VPP Fleet Table */}
          <VppFleetTable vpps={data.vpp_fleet} />

          {/* Regional DER Comparison */}
          {regionalBarData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Regional DER Comparison
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Current output by region — stacked bars show Rooftop Solar + BTM Battery + EV load
                </p>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={regionalBarData}
                  margin={{ top: 4, right: 40, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                  <XAxis dataKey="region" tick={{ fontSize: 12 }} />
                  <YAxis
                    yAxisId="mw"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    label={{ value: 'MW', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="pct"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                    domain={[0, 100]}
                    label={{ value: 'Solar %', angle: 90, position: 'insideRight', offset: 10, fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'Net Reduction %') return [`${value.toFixed(1)}%`, name]
                      return [`${formatNumber(value)} MW`, name]
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="mw" dataKey="Rooftop Solar MW" stackId="der" fill="#22c55e" />
                  <Bar yAxisId="mw" dataKey="BTM Battery MW" stackId="der" fill="#a855f7" />
                  <Bar yAxisId="mw" dataKey="EV Load MW" stackId="der" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>

              {/* Regional DER detail table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-1.5 text-left">Region</th>
                      <th className="pb-1.5 text-right">Solar Cap GW</th>
                      <th className="pb-1.5 text-right">Solar Out MW</th>
                      <th className="pb-1.5 text-right">BTM Bat GWh</th>
                      <th className="pb-1.5 text-right">BTM Out MW</th>
                      <th className="pb-1.5 text-right">EVs Connected</th>
                      <th className="pb-1.5 text-right">EV Charge MW</th>
                      <th className="pb-1.5 text-right">Gross Demand MW</th>
                      <th className="pb-1.5 text-right">Net Demand MW</th>
                      <th className="pb-1.5 text-right">Solar Penetration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {data.regional_der.map((r) => (
                      <tr key={r.region} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="py-1.5 font-semibold text-gray-800 dark:text-gray-200">{r.region}</td>
                        <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">{r.rooftop_solar_capacity_gw.toFixed(1)}</td>
                        <td className="py-1.5 text-right text-green-600 dark:text-green-400 font-medium">{formatNumber(Math.round(r.rooftop_solar_output_mw))}</td>
                        <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">{r.btm_battery_capacity_gwh.toFixed(2)}</td>
                        <td className="py-1.5 text-right text-purple-600 dark:text-purple-400">{formatNumber(Math.round(r.btm_battery_output_mw))}</td>
                        <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">{formatNumber(r.ev_connected_count)}</td>
                        <td className="py-1.5 text-right text-blue-600 dark:text-blue-400">{formatNumber(Math.round(r.ev_charging_mw))}</td>
                        <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">{formatNumber(Math.round(r.gross_demand_mw))}</td>
                        <td className="py-1.5 text-right font-medium text-gray-800 dark:text-gray-200">{formatNumber(Math.round(r.net_demand_mw))}</td>
                        <td className="py-1.5 text-right">
                          <span className={`font-semibold ${r.solar_penetration_pct > 50 ? 'text-green-600 dark:text-green-400' : r.solar_penetration_pct > 30 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {r.solar_penetration_pct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
