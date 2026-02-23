import { useEffect, useState } from 'react'
import { BarChart2 } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  getElectricitySpotPriceSeasonalityDashboard,
  ESPSDashboard,
} from '../api/client'

const SEASON_COLORS: Record<string, string> = {
  Summer: '#f59e0b',
  Autumn: '#f97316',
  Winter: '#3b82f6',
  Spring: '#22c55e',
}

const SCENARIO_COLORS: Record<string, string> = {
  Base: '#6366f1',
  'High Renewable': '#22c55e',
  'Low Renewable': '#ef4444',
}

const REGIME_COLORS: Record<string, string> = {
  'High-Price':       '#ef4444',
  'Low-Price':        '#22c55e',
  'Volatile':         '#f97316',
  'Renewable-Driven': '#22d3ee',
  'Gas-Driven':       '#f59e0b',
  'Managed':          '#6366f1',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#6366f1',
  QLD1: '#f59e0b',
  VIC1: '#22c55e',
  SA1:  '#ef4444',
  TAS1: '#22d3ee',
}

export default function ElectricitySpotPriceSeasonalityAnalytics() {
  const [data, setData] = useState<ESPSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string>('NSW1')
  const [selectedSeason, setSelectedSeason] = useState<string>('Summer')

  useEffect(() => {
    getElectricitySpotPriceSeasonalityDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading Electricity Spot Price Seasonality Analytics...</span>
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

  const { summary, hourly_patterns, day_type_patterns, monthly_trends, price_regimes, decomposition, forecasts } = data

  // KPI cards
  const kpis = [
    {
      label: 'Avg Summer Price',
      value: `$${summary.avg_price_summer_mwh.toFixed(1)}/MWh`,
      sub: 'Seasonal average',
      color: 'text-amber-400',
    },
    {
      label: 'Avg Winter Price',
      value: `$${summary.avg_price_winter_mwh.toFixed(1)}/MWh`,
      sub: 'Seasonal average',
      color: 'text-blue-400',
    },
    {
      label: 'Negative Price Hours YTD',
      value: summary.negative_price_hrs_ytd.toString(),
      sub: '2024 year-to-date',
      color: 'text-cyan-400',
    },
    {
      label: 'Most Volatile Region',
      value: summary.most_volatile_region,
      sub: `Peak hr ${summary.peak_hour_of_day}:00 | Trough hr ${summary.trough_hour_of_day}:00`,
      color: 'text-red-400',
    },
  ]

  // ---- Chart 1: Time-of-Day Price Profile ----
  // Group hourly records by hour and season for the selected region
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const seasons = ['Summer', 'Autumn', 'Winter', 'Spring']

  const hourlyFiltered = hourly_patterns.filter((h) => h.region === selectedRegion)
  const hourlyByHour: Record<number, Record<string, number[]>> = {}
  for (const h of hourlyFiltered) {
    if (!hourlyByHour[h.hour_of_day]) hourlyByHour[h.hour_of_day] = {}
    if (!hourlyByHour[h.hour_of_day][h.season]) hourlyByHour[h.hour_of_day][h.season] = []
    hourlyByHour[h.hour_of_day][h.season].push(h.avg_price_mwh)
  }
  const hourlyChartData = Object.keys(hourlyByHour)
    .map(Number)
    .sort((a, b) => a - b)
    .map((hr) => {
      const row: Record<string, number | string> = { hour: `${hr}:00` }
      for (const s of seasons) {
        const vals = hourlyByHour[hr][s]
        if (vals && vals.length > 0) {
          row[s] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        }
      }
      return row
    })

  // ---- Chart 2: Monthly Price Trend ----
  const monthlyFiltered = monthly_trends
    .filter((m) => m.region === selectedRegion)
    .sort((a, b) => a.year_month.localeCompare(b.year_month))

  const monthlyChartData = monthlyFiltered.map((m) => ({
    month: m.year_month,
    avg: m.avg_price_mwh,
    min: m.min_price_mwh,
    max: m.max_price_mwh,
  }))

  // ---- Chart 3: Day-Type Price Comparison ----
  const dayTypeFiltered = day_type_patterns.filter((d) => d.season === selectedSeason)
  const dayTypeMap: Record<string, Record<string, number[]>> = {}
  for (const d of dayTypeFiltered) {
    if (!dayTypeMap[d.day_type]) dayTypeMap[d.day_type] = {}
    if (!dayTypeMap[d.day_type][d.region]) dayTypeMap[d.day_type][d.region] = []
    dayTypeMap[d.day_type][d.region].push(d.avg_price_mwh)
  }
  const dayTypeOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Public Holiday']
  const dayTypeChartData = dayTypeOrder
    .filter((dt) => dayTypeMap[dt])
    .map((dt) => {
      const row: Record<string, number | string> = { day_type: dt }
      for (const r of regions) {
        const vals = dayTypeMap[dt][r]
        if (vals && vals.length > 0) {
          row[r] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        }
      }
      return row
    })

  // ---- Chart 4: Price Regime Map (horizontal bar) ----
  const regimeSorted = [...price_regimes].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const regimeChartData = regimeSorted.map((r) => ({
    regime: `${r.regime_id} ${r.region}`,
    duration: r.duration_days,
    regime_type: r.regime_type,
    avg_price: r.avg_price_mwh,
    fill: REGIME_COLORS[r.regime_type] ?? '#9ca3af',
  }))

  // ---- Chart 5: Price Decomposition (stacked bar) ----
  const decompFiltered = decomposition.filter((d) => d.region === selectedRegion)
  const decompChartData = decompFiltered.map((d) => ({
    year: d.year.toString(),
    Trend: d.trend_component_mwh,
    Seasonal: d.seasonal_component_mwh,
    'Renewable Effect': d.renewable_penetration_effect_mwh,
    Residual: d.residual_component_mwh,
  }))

  // ---- Chart 6: Price Forecast ----
  const forecastRegion = selectedRegion
  const forecastFiltered = forecasts.filter((f) => f.region === forecastRegion)
  const forecastYears = [...new Set(forecastFiltered.map((f) => f.year))].sort()
  const forecastChartData = forecastYears.map((yr) => {
    const row: Record<string, number | string> = { year: yr.toString() }
    for (const sc of ['Base', 'High Renewable', 'Low Renewable']) {
      const rec = forecastFiltered.find((f) => f.year === yr && f.scenario === sc)
      if (rec) row[sc] = rec.forecast_avg_price_mwh
    }
    return row
  })

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart2 className="w-8 h-8 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Electricity Spot Price Seasonality Analytics</h1>
          <p className="text-gray-400 text-sm">Time-of-day patterns, seasonal distributions, regime analysis and structural forecasts</p>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-sm">Region:</label>
          <select
            className="bg-gray-800 text-gray-200 rounded-lg px-3 py-1 border border-gray-600 text-sm"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-sm">Season (Day-Type):</label>
          <select
            className="bg-gray-800 text-gray-200 rounded-lg px-3 py-1 border border-gray-600 text-sm"
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
          >
            {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Chart 1: Time-of-Day Price Profile */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Time-of-Day Price Profile — {selectedRegion}
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={hourlyChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="hour" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`$${v.toFixed(1)}/MWh`]}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
            {seasons.map((s) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={SEASON_COLORS[s]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Monthly Price Trend */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Monthly Price Trend — {selectedRegion}
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
            <YAxis stroke="#9ca3af" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`$${v.toFixed(1)}/MWh`]}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="max" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" dot={false} name="P90 Max" />
            <Line type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Avg Price" />
            <Line type="monotone" dataKey="min" stroke="#22c55e" strokeWidth={1} strokeDasharray="4 2" dot={false} name="P10 Min" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Day-Type Price Comparison */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Day-Type Price Comparison — {selectedSeason}
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dayTypeChartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="day_type" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9ca3af" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`$${v.toFixed(1)}/MWh`]}
            />
            <Legend />
            {regions.map((r) => (
              <Bar key={r} dataKey={r} fill={REGION_COLORS[r]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Price Regime Map */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Price Regime Map — Duration by Regime Type</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(REGIME_COLORS).map(([rt, col]) => (
            <span key={rt} className="flex items-center gap-1 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: col }} />
              {rt}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart layout="vertical" data={regimeChartData} margin={{ left: 110 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis type="number" stroke="#9ca3af" tickFormatter={(v) => `${v}d`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="regime" stroke="#9ca3af" tick={{ fontSize: 9 }} width={110} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, name: string, props: { payload?: { avg_price?: number; regime_type?: string } }) => [
                `${v} days | Avg $${props.payload?.avg_price?.toFixed(1)}/MWh`,
                props.payload?.regime_type ?? name,
              ]}
            />
            <Bar dataKey="duration" name="Duration (days)">
              {regimeChartData.map((entry, idx) => (
                <rect key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Price Decomposition */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Price Decomposition — {selectedRegion}
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={decompChartData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`$${v.toFixed(2)}/MWh`]}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#6b7280" />
            <Bar dataKey="Trend" stackId="a" fill="#6366f1" />
            <Bar dataKey="Seasonal" stackId="a" fill="#f59e0b" />
            <Bar dataKey="Renewable Effect" stackId="a" fill="#22c55e" />
            <Bar dataKey="Residual" stackId="a" fill="#9ca3af" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 6: Price Forecast */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Price Forecast 2024-2028 — {forecastRegion}
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={forecastChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`$${v.toFixed(1)}/MWh`]}
            />
            <Legend />
            {['Base', 'High Renewable', 'Low Renewable'].map((sc) => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                stroke={SCENARIO_COLORS[sc]}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p className="text-gray-500 text-xs mt-2">
          Structural break expected in High Renewable scenario from 2026 as solar penetration exceeds 60%.
        </p>
      </div>
    </div>
  )
}
