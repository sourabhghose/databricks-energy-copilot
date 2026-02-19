import React, { useState, useEffect, useCallback } from 'react'
import {
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
  Cell,
} from 'recharts'
import { Leaf, Wind, Sun, TrendingDown, RefreshCw } from 'lucide-react'
import { api, SustainabilityDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NEM_REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
const BASELINE_2005_INTENSITY = 0.82  // kg CO2/MWh in 2005
const NET_ZERO_TARGET = 0.10          // 2030 target

// Colour by carbon intensity: green = low, amber = mid, red = high
function intensityColor(intensity: number): string {
  if (intensity <= 0.15) return '#22c55e'   // green-500
  if (intensity <= 0.35) return '#84cc16'   // lime-500
  if (intensity <= 0.55) return '#eab308'   // yellow-500
  if (intensity <= 0.70) return '#f97316'   // orange-500
  return '#ef4444'                           // red-500
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  colorClass = 'text-gray-800 dark:text-gray-100',
}: {
  label: string
  value: string
  unit?: string
  icon?: React.ElementType
  colorClass?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
        {Icon && <Icon size={14} />}
        {label}
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>
        {value}
        {unit && <span className="text-sm font-normal ml-1 text-gray-500 dark:text-gray-400">{unit}</span>}
      </div>
    </div>
  )
}

function LgcCard({
  label,
  price,
  isSpot = false,
}: {
  label: string
  price: number
  isSpot?: boolean
}) {
  return (
    <div className={`rounded-lg border p-3 flex flex-col gap-1 ${isSpot ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</div>
      <div className={`text-xl font-bold ${isSpot ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-gray-100'}`}>
        ${price.toFixed(2)}
        <span className="text-xs font-normal ml-1 text-gray-500 dark:text-gray-400">/MWh</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom BarChart tooltip
// ---------------------------------------------------------------------------

interface TooltipPayload {
  payload?: { carbon_intensity_kg_co2_mwh?: number; renewable_pct?: number }
  dataKey?: string
  value?: number
  name?: string
}

function IntensityTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{label}</p>
      <p className="text-gray-600 dark:text-gray-400">
        Intensity: <span className="font-medium text-gray-800 dark:text-gray-200">{d?.carbon_intensity_kg_co2_mwh?.toFixed(3)} kg CO₂/MWh</span>
      </p>
      <p className="text-gray-600 dark:text-gray-400">
        Renewable: <span className="font-medium text-green-600 dark:text-green-400">{d?.renewable_pct?.toFixed(1)}%</span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function Sustainability() {
  const [dashboard, setDashboard] = useState<SustainabilityDashboard | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string>('NSW1')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchDashboard = useCallback(async (region: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getSustainabilityDashboard(region)
      setDashboard(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sustainability data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard(selectedRegion)
  }, [fetchDashboard, selectedRegion])

  // ---- decarbonisation progress ----
  const baseline = BASELINE_2005_INTENSITY
  const target = NET_ZERO_TARGET
  const current = dashboard?.nem_carbon_intensity ?? 0.50
  const progressPct = Math.max(
    0,
    Math.min(
      100,
      ((baseline - current) / (baseline - target)) * 100,
    ),
  )

  // ---- regional bar chart data ----
  const regionalData = (dashboard?.regional_intensity ?? []).map((rec) => ({
    region: rec.region,
    carbon_intensity_kg_co2_mwh: rec.carbon_intensity_kg_co2_mwh,
    renewable_pct: rec.renewable_pct,
  }))

  // ---- intensity history chart data ----
  const historyData = (dashboard?.intensity_history ?? []).map((rec) => {
    const dt = new Date(rec.timestamp)
    const hour = dt.getUTCHours()
    const aestHour = (hour + 10) % 24
    return {
      time: `${String(aestHour).padStart(2, '0')}:00`,
      intensity: rec.carbon_intensity_kg_co2_mwh,
      renewable: rec.renewable_pct,
    }
  })

  return (
    <div className="p-6 space-y-6 text-gray-900 dark:text-gray-100">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Leaf className="text-green-500" size={24} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Carbon &amp; Sustainability
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              NEM decarbonisation progress, renewable energy certificates, and emissions tracking
            </p>
          </div>
          <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">
            <Leaf size={10} />
            Live
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastUpdated.toLocaleTimeString('en-AU')}
            </span>
          )}
          <button
            onClick={() => fetchDashboard(selectedRegion)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 text-sm text-amber-700 dark:text-amber-400">
          {error} — showing indicative data.
        </div>
      )}

      {/* NEM Decarbonisation Banner */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-green-700 dark:text-green-400 font-medium uppercase tracking-wide mb-1">
              NEM Carbon Intensity
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-green-800 dark:text-green-300">
                {loading ? '—' : current.toFixed(2)}
              </span>
              <span className="text-lg text-green-700 dark:text-green-400">
                kg CO₂/MWh
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <TrendingDown size={20} />
            <span className="text-lg font-semibold">
              Down {loading ? '—' : Math.abs(dashboard?.emissions_vs_2005_pct ?? 36.4).toFixed(1)}% vs 2005 baseline
            </span>
          </div>
        </div>

        {/* Progress bar: 2005 → 2030 net-zero target */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>2005 baseline: {baseline.toFixed(2)} kg CO₂/MWh</span>
            <span>2030 target: &lt;{target.toFixed(2)} kg CO₂/MWh</span>
          </div>
          <div className="relative h-5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            {/* Filled portion */}
            <div
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
            {/* Current position marker */}
            <div
              className="absolute top-0 h-full w-1 bg-white dark:bg-gray-100 rounded"
              style={{ left: `calc(${progressPct}% - 2px)` }}
            />
          </div>
          <div className="text-center text-xs text-green-700 dark:text-green-400 font-medium">
            {progressPct.toFixed(0)}% of the way to net-zero target
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="NEM Renewable %"
          value={loading ? '—' : `${(dashboard?.nem_renewable_pct ?? 0).toFixed(0)}%`}
          icon={Sun}
          colorClass="text-green-600 dark:text-green-400"
        />
        <StatCard
          label="Annual Emissions"
          value={loading ? '—' : `${(dashboard?.annual_emissions_mt_co2 ?? 0).toFixed(0)}`}
          unit="MT CO₂"
          icon={Wind}
          colorClass="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Installed Renewables"
          value={loading ? '—' : `${(dashboard?.renewable_capacity_gw ?? 0).toFixed(0)}`}
          unit="GW"
          icon={Leaf}
          colorClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="LGC Spot Price"
          value={loading ? '—' : `$${(dashboard?.lgc_market?.lgc_spot_price_aud ?? 0).toFixed(2)}`}
          unit="/MWh"
          colorClass="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Regional Carbon Intensity Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-3">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Regional Carbon Intensity
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            kg CO₂/MWh — lower is cleaner
          </p>
          {loading ? (
            <div className="h-56 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={regionalData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis
                  dataKey="region"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#4b5563' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#4b5563' }}
                  tickLine={false}
                  domain={[0, 0.9]}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <Tooltip content={<IntensityTooltip />} />
                <Bar dataKey="carbon_intensity_kg_co2_mwh" name="Intensity" radius={[4, 4, 0, 0]}>
                  {regionalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={intensityColor(entry.carbon_intensity_kg_co2_mwh)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            TAS1 (hydro) and SA1 (wind) have the lowest emissions. NSW1/QLD1 remain coal-heavy.
          </p>
        </div>

        {/* Carbon Intensity Trend Area Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                24-Hour Intensity Trend
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Lower during solar generation hours
              </p>
            </div>
            {/* Region selector */}
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-2 py-1"
            >
              {NEM_REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {loading ? (
            <div className="h-56 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={historyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="intensityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#4b5563' }}
                  tickLine={false}
                  interval={3}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#4b5563' }}
                  tickLine={false}
                  tickFormatter={(v) => v.toFixed(2)}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'intensity' ? `${value.toFixed(3)} kg CO₂/MWh` : `${value.toFixed(1)}%`,
                    name === 'intensity' ? 'Carbon Intensity' : 'Renewable %',
                  ]}
                  contentStyle={{
                    background: 'rgba(17,24,39,0.9)',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#e5e7eb',
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value === 'intensity' ? 'Carbon Intensity (kg CO₂/MWh)' : 'Renewable %'
                  }
                  wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }}
                />
                <Area
                  type="monotone"
                  dataKey="intensity"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#intensityGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#22c55e' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* LGC Market section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
              LGC Market — Large-scale Generation Certificates
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
              LGCs are the tradeable instrument for Australia&apos;s Renewable Energy Target (RET).
              1 LGC = 1 MWh of eligible renewable generation. Liable entities (electricity retailers
              and large consumers) must surrender LGCs annually to meet their Renewable Power
              Percentage (RPP) obligations. The futures curve is declining as new renewable capacity
              comes online, increasing certificate supply.
            </p>
          </div>
        </div>

        {/* LGC price cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <LgcCard
              label="Spot Price"
              price={dashboard?.lgc_market?.lgc_spot_price_aud ?? 0}
              isSpot
            />
            <LgcCard
              label="2026 Futures"
              price={dashboard?.lgc_market?.lgc_futures_2026 ?? 0}
            />
            <LgcCard
              label="2027 Futures"
              price={dashboard?.lgc_market?.lgc_futures_2027 ?? 0}
            />
            <LgcCard
              label="2028 Futures"
              price={dashboard?.lgc_market?.lgc_futures_2028 ?? 0}
            />
          </div>
        )}

        {/* STC price and YTD surrenders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              STC Price (Fixed)
            </p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
              ${(dashboard?.lgc_market?.sts_price_aud ?? 40).toFixed(2)}
              <span className="text-sm font-normal ml-1 text-gray-500 dark:text-gray-400">/certificate</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Small-scale Technology Certificate — legislatively fixed at $40
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Certificates Surrendered YTD
            </p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {loading ? '—' : `${dashboard?.lgc_market?.total_lgcs_surrendered_ytd ?? 0}`}
              <span className="text-sm font-normal ml-1 text-gray-500 dark:text-gray-400">million LGCs</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Year-to-date against annual RPP obligations
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Liable Entity Shortfall
            </p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {loading ? '—' : `${(dashboard?.lgc_market?.liable_entities_shortfall_gwh ?? 0).toLocaleString('en-AU')}`}
              <span className="text-sm font-normal ml-1 text-gray-500 dark:text-gray-400">GWh</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Outstanding certificates required to meet RPP (shortfall charge: $65/MWh)
            </p>
          </div>
        </div>
      </div>

      {/* Regional intensity detail table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          Regional Breakdown
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="text-left py-2 pr-4 font-medium">Region</th>
                  <th className="text-right py-2 pr-4 font-medium">Intensity (kg CO₂/MWh)</th>
                  <th className="text-right py-2 pr-4 font-medium">Renewable %</th>
                  <th className="text-right py-2 pr-4 font-medium">Fossil %</th>
                  <th className="text-right py-2 font-medium">Top Fuel</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.regional_intensity ?? []).map((rec) => {
                  const topFuelEntry = Object.entries(rec.generation_mix).reduce(
                    (best, [fuel, mw]) => (mw > best[1] ? [fuel, mw] : best),
                    ['', 0] as [string, number],
                  )
                  return (
                    <tr
                      key={rec.region}
                      className="border-b border-gray-50 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    >
                      <td className="py-2.5 pr-4 font-semibold text-gray-800 dark:text-gray-200">{rec.region}</td>
                      <td className="py-2.5 pr-4 text-right">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: intensityColor(rec.carbon_intensity_kg_co2_mwh) }}
                        >
                          {rec.carbon_intensity_kg_co2_mwh.toFixed(3)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-green-600 dark:text-green-400 font-medium">
                        {rec.renewable_pct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 pr-4 text-right text-red-500 dark:text-red-400">
                        {rec.fossil_pct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">
                        {topFuelEntry[0]} ({(topFuelEntry[1] as number).toLocaleString('en-AU', { maximumFractionDigits: 0 })} MW)
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
