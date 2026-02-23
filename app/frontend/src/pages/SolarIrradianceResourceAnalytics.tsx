import { useEffect, useState } from 'react'
import { Sun } from 'lucide-react'
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
  getSolarIrradianceResourceDashboard,
  SIRADashboard,
} from '../api/client'

// ── Colour palette ────────────────────────────────────────────────────────────
const CLIMATE_COLOURS: Record<string, string> = {
  Arid: '#f59e0b',
  'Semi-Arid': '#f97316',
  Temperate: '#3b82f6',
  Mediterranean: '#8b5cf6',
  Tropical: '#10b981',
}

const STATION_COLOURS = [
  '#f59e0b', '#3b82f6', '#10b981', '#f97316', '#8b5cf6',
  '#ec4899', '#14b8a6', '#ef4444', '#06b6d4', '#84cc16',
  '#a855f7', '#6366f1',
]

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        {unit && <span className="text-sm text-gray-400 mb-0.5">{unit}</span>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SolarIrradianceResourceAnalytics() {
  const [data, setData] = useState<SIRADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSolarIrradianceResourceDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Solar Irradiance Resource Analytics...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  const { stations, monthly_data, performance_ratios, extreme_events, forecasts, summary } = data

  // ── Chart 1: Annual GHI by station coloured by climate zone ──────────────
  const ghiByStation = stations.map((s) => ({
    name: s.station_name,
    ghi: Math.round(s.annual_ghi_kwh_m2),
    climate_zone: s.climate_zone,
  }))

  // ── Chart 2: Monthly GHI for top 5 stations (2024) ───────────────────────
  const top5 = [...stations]
    .sort((a, b) => b.annual_ghi_kwh_m2 - a.annual_ghi_kwh_m2)
    .slice(0, 5)
  const top5Ids = new Set(top5.map((s) => s.station_id))
  const monthlyChart: Record<number, Record<string, number>> = {}
  for (let m = 1; m <= 12; m++) {
    monthlyChart[m] = {}
  }
  monthly_data
    .filter((d) => d.year === 2024 && top5Ids.has(d.station_id))
    .forEach((d) => {
      const stationName = stations.find((s) => s.station_id === d.station_id)?.station_name ?? d.station_id
      monthlyChart[d.month][stationName] = d.ghi_kwh_m2
    })
  const monthlyChartData = Array.from({ length: 12 }, (_, i) => ({
    month: MONTH_LABELS[i],
    ...monthlyChart[i + 1],
  }))

  // ── Chart 3: Avg yield by system type (2024) ─────────────────────────────
  const yieldByType: Record<string, number[]> = {}
  performance_ratios
    .filter((p) => p.year === 2024)
    .forEach((p) => {
      if (!yieldByType[p.system_type]) yieldByType[p.system_type] = []
      yieldByType[p.system_type].push(p.yield_kwh_kwp)
    })
  const yieldChartData = Object.entries(yieldByType).map(([system_type, vals]) => ({
    system_type,
    avg_yield: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  }))

  // ── Chart 4: Avg irradiance reduction by event type ───────────────────────
  const reductionByEvent: Record<string, number[]> = {}
  extreme_events.forEach((e) => {
    if (!reductionByEvent[e.event_type]) reductionByEvent[e.event_type] = []
    reductionByEvent[e.event_type].push(e.irradiance_reduction_pct)
  })
  const eventChartData = Object.entries(reductionByEvent).map(([event_type, vals]) => ({
    event_type,
    avg_reduction: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  }))

  // ── Chart 5: Skill score by horizon and model (2024) ─────────────────────
  const skillMap: Record<string, Record<string, number[]>> = {}
  forecasts
    .filter((f) => f.year === 2024)
    .forEach((f) => {
      if (!skillMap[f.forecast_horizon]) skillMap[f.forecast_horizon] = {}
      if (!skillMap[f.forecast_horizon][f.model_used]) skillMap[f.forecast_horizon][f.model_used] = []
      skillMap[f.forecast_horizon][f.model_used].push(f.skill_score_pct)
    })
  const allModels = Array.from(
    new Set(forecasts.map((f) => f.model_used))
  )
  const skillChartData = Object.entries(skillMap).map(([horizon, models]) => {
    const row: Record<string, number | string> = { horizon }
    allModels.forEach((m) => {
      const vals = models[m] ?? []
      row[m] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
    })
    return row
  })

  const MODEL_COLOURS: Record<string, string> = {
    NWP: '#3b82f6',
    'ML Hybrid': '#10b981',
    Statistical: '#f59e0b',
    'Satellite-Derived': '#8b5cf6',
  }

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sun className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Solar Irradiance Resource Analytics</h1>
          <p className="text-sm text-gray-400">BOM station data — GHI, DNI, DHI, performance ratios and forecast accuracy</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard label="Best Resource State" value={summary.best_resource_state} />
        <KpiCard label="Avg Annual GHI" value={summary.avg_annual_ghi_kwh_m2.toFixed(0)} unit="kWh/m²" />
        <KpiCard label="Max Daily GHI" value={summary.max_daily_ghi_kwh_m2.toFixed(2)} unit="kWh/m²" />
        <KpiCard label="Avg Performance Ratio" value={summary.avg_performance_ratio_pct.toFixed(1)} unit="%" />
        <KpiCard label="Best Specific Yield" value={summary.best_specific_yield_kwh_kwp.toFixed(0)} unit="kWh/kWp" />
      </div>

      {/* Chart 1: Annual GHI by station */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Annual GHI by Station (kWh/m²)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={ghiByStation} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(value: number, _name: string, props: { payload?: { climate_zone?: string } }) => [
                `${value} kWh/m²`,
                props.payload?.climate_zone ?? 'GHI',
              ]}
            />
            <Bar dataKey="ghi" name="Annual GHI">
              {ghiByStation.map((entry, index) => (
                <rect
                  key={`cell-${index}`}
                  fill={CLIMATE_COLOURS[entry.climate_zone] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Climate zone legend */}
        <div className="flex flex-wrap gap-4 mt-3">
          {Object.entries(CLIMATE_COLOURS).map(([zone, colour]) => (
            <span key={zone} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
              {zone}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Monthly GHI top 5 stations (2024) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Monthly GHI — Top 5 Stations, 2024 (kWh/m²)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={monthlyChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {top5.map((s, i) => (
              <Line
                key={s.station_id}
                type="monotone"
                dataKey={s.station_name}
                stroke={STATION_COLOURS[i % STATION_COLOURS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Avg yield by system type */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Avg Specific Yield by System Type, 2024 (kWh/kWp)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={yieldChartData} margin={{ top: 5, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="system_type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number) => [`${v} kWh/kWp`, 'Avg Yield']}
            />
            <Bar dataKey="avg_yield" name="Avg Yield (kWh/kWp)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Irradiance reduction by event type */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Avg Irradiance Reduction by Extreme Event Type (%)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={eventChartData} margin={{ top: 5, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="event_type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number) => [`${v}%`, 'Avg Reduction']}
            />
            <Bar dataKey="avg_reduction" name="Avg Irradiance Reduction (%)" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Skill score by forecast horizon and model */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Forecast Skill Score by Horizon and Model, 2024 (%)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={skillChartData} margin={{ top: 5, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="horizon" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number, name: string) => [`${v}%`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {allModels.map((model) => (
              <Bar
                key={model}
                dataKey={model}
                fill={MODEL_COLOURS[model] ?? '#6b7280'}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Summary</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Best Resource State</dt>
            <dd className="text-white font-medium mt-0.5">{summary.best_resource_state}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Avg Annual GHI</dt>
            <dd className="text-white font-medium mt-0.5">{summary.avg_annual_ghi_kwh_m2.toFixed(1)} kWh/m²/yr</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Max Daily GHI (peak month avg)</dt>
            <dd className="text-white font-medium mt-0.5">{summary.max_daily_ghi_kwh_m2.toFixed(2)} kWh/m²/day</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Avg Performance Ratio</dt>
            <dd className="text-white font-medium mt-0.5">{summary.avg_performance_ratio_pct.toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Best Specific Yield</dt>
            <dd className="text-white font-medium mt-0.5">{summary.best_specific_yield_kwh_kwp.toFixed(0)} kWh/kWp</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Stations Monitored</dt>
            <dd className="text-white font-medium mt-0.5">{stations.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Extreme Events Recorded</dt>
            <dd className="text-white font-medium mt-0.5">{extreme_events.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">System Types Assessed</dt>
            <dd className="text-white font-medium mt-0.5">Fixed Tilt, Single-Axis Tracker, Dual-Axis Tracker, Bifacial, BIPV</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Forecast Models</dt>
            <dd className="text-white font-medium mt-0.5">NWP, ML Hybrid, Statistical, Satellite-Derived</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
