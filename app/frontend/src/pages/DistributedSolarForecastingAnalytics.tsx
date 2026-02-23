import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Sun, Zap, TrendingUp, MapPin } from 'lucide-react'
import {
  getDistributedSolarForecastingDashboard,
  DSFADashboard,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#facc15',
  VIC1: '#34d399',
  SA1:  '#f87171',
  TAS1: '#a78bfa',
}

const MODEL_COLOURS: Record<string, string> = {
  NWP:          '#60a5fa',
  'ML-Hybrid':  '#34d399',
  Ensemble:     '#facc15',
  Persistence:  '#f87171',
}

const SCENARIO_COLOURS: Record<string, string> = {
  Base:          '#60a5fa',
  'High Solar':  '#facc15',
  'Managed DER': '#34d399',
}

const EVENT_COLOURS: Record<string, string> = {
  'Cloud Cover': '#9ca3af',
  Heatwave:     '#fb923c',
  Storm:        '#f87171',
  'Smoke/Haze': '#a78bfa',
  'Clear Sky':  '#34d399',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, Icon }: {
  label: string; value: string; sub?: string; Icon: React.ElementType
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow-lg">
      <div className="p-3 bg-gray-700 rounded-lg">
        <Icon className="w-6 h-6 text-cyan-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DistributedSolarForecastingAnalytics() {
  const [data, setData] = useState<DSFADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDistributedSolarForecastingDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 bg-gray-900">
        Loading Distributed Solar Forecasting Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 bg-gray-900">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>

  // ─── Chart 1: Line — skill_score_pct by month for each model (1-hr horizon) ─
  const months = Array.from(new Set(data.accuracy.map(a => a.month))).sort()
  const modelSkillData = months.map(m => {
    const row: Record<string, string | number> = { month: m }
    ;['NWP', 'ML-Hybrid', 'Ensemble', 'Persistence'].forEach(model => {
      const recs = data.accuracy.filter(a => a.month === m && a.model === model && a.forecast_horizon_hr === 1)
      if (recs.length > 0) {
        row[model] = Math.round((recs.reduce((s, r) => s + r.skill_score_pct, 0) / recs.length) * 10) / 10
      } else {
        row[model] = 0
      }
    })
    return row
  })

  // ─── Chart 2: Line — total_capacity_mw by month for 5 regions (cumulative) ──
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const capacityLineData = months.map(m => {
    const row: Record<string, string | number> = { month: m }
    regions.forEach(region => {
      const rec = data.installations.find(i => i.month === m && i.region === region)
      row[region] = rec ? rec.total_capacity_mw : 0
    })
    return row
  })

  // ─── Chart 3: Bar — avg_generation_reduction_pct by event_type ───────────────
  const eventTypes = Array.from(new Set(data.weather_impacts.map(w => w.event_type)))
  const weatherBarData = eventTypes.map(event => {
    const recs = data.weather_impacts.filter(w => w.event_type === event)
    const avg = recs.length > 0
      ? Math.round((recs.reduce((s, r) => s + r.avg_generation_reduction_pct, 0) / recs.length) * 10) / 10
      : 0
    const region = recs.length > 0 ? recs[0].region : 'N/A'
    return { event_type: event, avg_generation_reduction_pct: avg, region }
  })

  // ─── Chart 4: Bar — curtailment_pct by dnsp with hosting_capacity_mw ─────────
  const dnsps = Array.from(new Set(data.grid_integration.map(g => g.dnsp)))
  const gridBarData = dnsps.map(dnsp => {
    const recs = data.grid_integration.filter(g => g.dnsp === dnsp)
    const avgCurt = recs.length > 0
      ? Math.round((recs.reduce((s, r) => s + r.curtailment_pct, 0) / recs.length) * 100) / 100
      : 0
    const avgHosting = recs.length > 0
      ? Math.round(recs.reduce((s, r) => s + r.hosting_capacity_mw, 0) / recs.length)
      : 0
    return { dnsp, curtailment_pct: avgCurt, hosting_capacity_mw: avgHosting }
  })

  // ─── Chart 5: Line — total_capacity_gw by year for 3 scenarios ───────────────
  const scenarioNames = ['Base', 'High Solar', 'Managed DER']
  const years = Array.from(new Set(data.scenarios.map(s => s.year))).sort((a, b) => a - b)
  const scenarioLineData = years.map(yr => {
    const row: Record<string, string | number> = { year: String(yr) }
    scenarioNames.forEach(sc => {
      const rec = data.scenarios.find(s => s.year === yr && s.scenario === sc)
      row[sc] = rec ? rec.total_capacity_gw : 0
    })
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sun className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold">Distributed Solar Forecasting Analytics</h1>
          <p className="text-sm text-gray-400">
            Rooftop solar forecast accuracy, installation trends, weather impacts, grid integration and scenario projections
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Installed Capacity"
          value={`${summary.total_installed_capacity_gw ?? '—'} GW`}
          sub="Dec 2024 across all regions"
          Icon={Zap}
        />
        <KpiCard
          label="Avg Forecast Accuracy"
          value={`${summary.avg_forecast_accuracy_pct ?? '—'}%`}
          sub="Ensemble skill score (1-hr horizon)"
          Icon={TrendingUp}
        />
        <KpiCard
          label="Highest Penetration Region"
          value={String(summary.highest_penetration_region ?? '—')}
          sub="By household penetration %"
          Icon={MapPin}
        />
        <KpiCard
          label="Total Annual Generation"
          value={`${summary.total_annual_generation_twh ?? '—'} TWh`}
          sub="Estimated Dec 2024 annualised"
          Icon={Sun}
        />
      </div>

      {/* Chart 1: Line — Forecast skill score by month for each model */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Forecast Skill Score by Month — Model Comparison (1-hr Horizon, avg across regions)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={modelSkillData} margin={{ top: 4, right: 16, bottom: 40, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="month"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-25}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`${val.toFixed(1)}%`, '']}
            />
            <Legend />
            {['NWP', 'ML-Hybrid', 'Ensemble', 'Persistence'].map(model => (
              <Line
                key={model}
                type="monotone"
                dataKey={model}
                stroke={MODEL_COLOURS[model] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
                name={model}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Line — Cumulative installed capacity by month per region */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Cumulative Installed Capacity by Month (MW) — All Regions
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={capacityLineData} margin={{ top: 4, right: 16, bottom: 40, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="month"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-25}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            {regions.map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLOURS[region] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
                name={region}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Bar — avg generation reduction % by event type coloured by region */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Avg Generation Reduction by Weather Event Type (%) — Coloured by Event
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weatherBarData} margin={{ top: 4, right: 16, bottom: 50, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="event_type"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`${val.toFixed(1)}%`, 'Avg Reduction']}
            />
            <Bar dataKey="avg_generation_reduction_pct" name="Avg Gen Reduction (%)">
              {weatherBarData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={EVENT_COLOURS[entry.event_type] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-3">
          {Object.entries(EVENT_COLOURS).map(([event, colour]) => (
            <div key={event} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {event}
            </div>
          ))}
        </div>
      </div>

      {/* Chart 4: Bar — curtailment_pct by DNSP with hosting_capacity_mw */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Curtailment % by DNSP — with Avg Hosting Capacity (MW)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={gridBarData} margin={{ top: 4, right: 16, bottom: 50, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="dnsp"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-15}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              unit="%"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              unit=" MW"
            />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="curtailment_pct"
              fill="#f87171"
              name="Curtailment (%)"
            />
            <Bar
              yAxisId="right"
              dataKey="hosting_capacity_mw"
              fill="#60a5fa"
              name="Hosting Capacity (MW)"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Line — total_capacity_gw by year for 3 scenarios */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Distributed Solar Capacity Projections 2025–2035 (GW) by Scenario
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={scenarioLineData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" GW" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            {scenarioNames.map(sc => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                stroke={SCENARIO_COLOURS[sc] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
                name={sc}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(summary).map(([key, val]) => (
            <div key={key} className="bg-gray-700 rounded-lg p-3">
              <dt className="text-xs text-gray-400 uppercase tracking-wide break-words">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="text-base font-semibold text-white mt-1 break-words">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
