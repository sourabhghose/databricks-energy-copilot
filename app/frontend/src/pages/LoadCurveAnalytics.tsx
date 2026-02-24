import { useEffect, useState } from 'react'
import { Activity, Zap, TrendingUp, Leaf, BarChart2 } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getLoadCurveDashboard } from '../api/client'
import type { ELCADashboard } from '../api/client'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------

const SEASON_COLORS: Record<string, string> = {
  Summer: '#f87171',
  Autumn: '#fb923c',
  Winter: '#60a5fa',
  Spring: '#34d399',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#fbbf24',
  VIC1: '#a78bfa',
  SA1:  '#34d399',
  TAS1: '#f87171',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LoadCurveAnalytics() {
  const [data, setData] = useState<ELCADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLoadCurveDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 bg-gray-900 min-h-screen">
        Loading Load Curve Analytics...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 bg-gray-900 min-h-screen">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const { summary, hourly_profiles, duration_curves, peak_records, seasonal_trends } = data

  // ── Chart 1: Hourly avg_demand_mw profile by season (NSW1, Weekday) ──
  const nsw1WeekdayProfiles = hourly_profiles.filter(
    h => h.region === 'NSW1' && h.day_type === 'Weekday'
  )

  const hourlyChartData = Array.from({ length: 24 }, (_, hour) => {
    const entry: Record<string, number | string> = { hour: `${hour}:00` }
    for (const season of ['Summer', 'Autumn', 'Winter', 'Spring']) {
      const rec = nsw1WeekdayProfiles.find(h => h.season === season && h.hour === hour)
      if (rec) entry[season] = rec.avg_demand_mw
    }
    return entry
  })

  // ── Chart 2: Duration curve for 2024 by region (percentile on X-axis) ──
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const percentiles = [1, 5, 10, 25, 50, 75, 90, 95, 99]

  const durationChartData = percentiles.map(pct => {
    const entry: Record<string, number | string> = { percentile: `P${pct}` }
    for (const region of regions) {
      const rec = duration_curves.find(
        d => d.region === region && d.year === 2024 && d.percentile === pct
      )
      if (rec) entry[region] = rec.demand_mw
    }
    return entry
  })

  // ── Chart 3: Annual peak_demand_mw by region and year ──
  const peakYears = [2020, 2021, 2022, 2023, 2024]
  const peakChartData = peakYears.map(year => {
    const entry: Record<string, number | string> = { year: String(year) }
    for (const region of regions) {
      const rec = peak_records.find(p => p.region === region && p.year === year)
      if (rec) entry[region] = rec.peak_demand_mw
    }
    return entry
  })

  // ── Chart 4: Seasonal avg_demand_mw trend 2020-2024 by region (Summer only) ──
  const trendChartData = peakYears.map(year => {
    const entry: Record<string, number | string> = { year: String(year) }
    for (const region of regions) {
      const rec = seasonal_trends.find(
        t => t.region === region && t.year === year && t.season === 'Summer'
      )
      if (rec) entry[region] = rec.avg_demand_mw
    }
    return entry
  })

  // ── Chart 5: renewable_share_pct by season (2024) grouped by region ──
  const seasons = ['Summer', 'Autumn', 'Winter', 'Spring']
  const renewableChartData = seasons.map(season => {
    const entry: Record<string, number | string> = { season }
    for (const region of regions) {
      const rec = seasonal_trends.find(
        t => t.region === region && t.year === 2024 && t.season === season
      )
      if (rec) entry[region] = rec.renewable_share_pct
    }
    return entry
  })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Activity size={28} className="text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Electricity Load Curve Analytics</h1>
          <p className="text-sm text-gray-400">ELCA — hourly profiles, duration curves, peak records and seasonal trends</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Max Peak Demand"
          value={`${summary.max_peak_demand_mw.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW`}
          sub="All regions, all years"
          icon={Zap}
          color="bg-red-600"
        />
        <KpiCard
          title="Min System Demand"
          value={`${summary.min_demand_mw.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW`}
          sub="Minimum hourly observed"
          icon={TrendingUp}
          color="bg-blue-600"
        />
        <KpiCard
          title="Avg Load Factor"
          value={`${summary.avg_load_factor_pct.toFixed(1)}%`}
          sub="Average / peak ratio"
          icon={BarChart2}
          color="bg-purple-600"
        />
        <KpiCard
          title="Demand Growth YoY"
          value={`${summary.demand_growth_yoy_pct.toFixed(2)}%`}
          sub="Year-on-year growth"
          icon={Leaf}
          color="bg-green-600"
        />
      </div>

      {/* Chart 1: Hourly profile by season */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          Hourly Average Demand Profile — NSW1 Weekday by Season
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={hourlyChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(1)}GW`} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number) => [`${v.toFixed(0)} MW`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {(['Summer', 'Autumn', 'Winter', 'Spring'] as const).map(season => (
              <Line
                key={season}
                type="monotone"
                dataKey={season}
                stroke={SEASON_COLORS[season]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Duration curve 2024 */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          Load Duration Curve — 2024 by Region
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={durationChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="percentile" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(1)}GW`} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number) => [`${v.toFixed(0)} MW`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {regions.map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLORS[region]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Annual peak demand by region and year */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          Annual Peak Demand by Region (2020–2024)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={peakChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(1)}GW`} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number) => [`${v.toFixed(0)} MW`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {regions.map(region => (
              <Bar key={region} dataKey={region} fill={REGION_COLORS[region]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Summer avg demand trend 2020-2024 by region */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          Summer Average Demand Trend 2020–2024 by Region
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(1)}GW`} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number) => [`${v.toFixed(0)} MW`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {regions.map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLORS[region]}
                dot={{ r: 4 }}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Renewable share by season 2024 */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          Renewable Share by Season — 2024 by Region (%)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={renewableChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="season" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number) => [`${v.toFixed(1)}%`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {regions.map(region => (
              <Bar key={region} dataKey={region} fill={REGION_COLORS[region]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
