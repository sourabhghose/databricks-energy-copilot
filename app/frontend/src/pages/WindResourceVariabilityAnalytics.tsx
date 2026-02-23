import { useState, useEffect } from 'react'
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
  ScatterChart,
  Scatter,
  Cell,
} from 'recharts'
import { Wind } from 'lucide-react'
import {
  getWindResourceVariabilityDashboard,
  type WRVADashboard,
} from '../api/client'

// ── Colour helpers ────────────────────────────────────────────────────────

const STATE_COLOURS: Record<string, string> = {
  SA:  '#f59e0b',
  VIC: '#3b82f6',
  NSW: '#10b981',
  TAS: '#8b5cf6',
  QLD: '#ef4444',
}

const SITE_LINE_COLOURS = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#84cc16',
]

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── KPI card ──────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function WindResourceVariabilityAnalytics() {
  const [data, setData] = useState<WRVADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWindResourceVariabilityDashboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Wind size={28} className="animate-spin mr-3 text-cyan-400" />
        Loading wind resource data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const { sites, wind_data, correlations, ramp_events, seasonal_patterns, summary } = data

  // ── Chart 1: avg_wind_speed_m_s by site ──────────────────────────────
  const windSpeedBySite = sites.map(s => ({
    name: s.site_name.replace(' Wind Farm', '').replace(' Wind', ''),
    avg_wind_speed: s.avg_wind_speed_m_s,
    state: s.state,
  }))

  // ── Chart 2: monthly CF for 2024, one line per site ──────────────────
  const siteNames: Record<string, string> = {}
  sites.forEach(s => { siteNames[s.site_id] = s.site_name.replace(' Wind Farm', '').replace(' Wind', '') })

  const monthlyData2024 = MONTH_LABELS.map((month, idx) => {
    const mo = idx + 1
    const row: Record<string, number | string> = { month }
    sites.forEach(s => {
      const rec = wind_data.find(w => w.site_id === s.site_id && w.year === 2024 && w.month === mo)
      row[siteNames[s.site_id]] = rec ? rec.capacity_factor_pct : 0
    })
    return row
  })

  // ── Chart 3: seasonal CF by top-4 sites ──────────────────────────────
  const top4Sites = [...sites]
    .sort((a, b) => b.avg_wind_speed_m_s - a.avg_wind_speed_m_s)
    .slice(0, 4)

  const seasonOrder = ['Summer', 'Autumn', 'Winter', 'Spring']
  const seasonalChartData = seasonOrder.map(season => {
    const row: Record<string, number | string> = { season }
    top4Sites.forEach(s => {
      const rec = seasonal_patterns.find(p => p.site_id === s.site_id && p.season === season)
      row[siteNames[s.site_id]] = rec ? rec.avg_cf_pct : 0
    })
    return row
  })

  // ── Chart 4: scatter correlation vs distance ─────────────────────────
  const scatterData = correlations.map(c => ({
    distance_km: c.distance_km,
    correlation_coefficient: c.correlation_coefficient,
    label: `${c.site_a}/${c.site_b}`,
  }))

  // ── Chart 5: ramp magnitude by trigger, grouped up/down ─────────────
  const triggers = ['Cold Front', 'Sea Breeze', 'Thunderstorm', 'High Pressure']
  const rampByTrigger = triggers.map(trigger => {
    const events = ramp_events.filter(e => e.trigger === trigger)
    const upTotal = events.filter(e => e.ramp_type === 'Up-ramp').reduce((s, e) => s + e.magnitude_mw, 0)
    const downTotal = events.filter(e => e.ramp_type === 'Down-ramp').reduce((s, e) => s + e.magnitude_mw, 0)
    return {
      trigger,
      'Up-ramp': Math.round(upTotal),
      'Down-ramp': Math.round(downTotal),
    }
  })

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wind size={28} className="text-cyan-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Wind Resource Variability Analytics</h1>
          <p className="text-sm text-gray-400">
            Portfolio analysis across {sites.length} wind farms — capacity factors, correlations and ramp events
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Wind Capacity"
          value={`${summary.total_wind_capacity_mw.toLocaleString()} MW`}
        />
        <KpiCard
          label="Avg Portfolio CF"
          value={`${summary.avg_portfolio_cf_pct}%`}
        />
        <KpiCard
          label="Best Wind Site"
          value={summary.best_wind_site}
        />
        <KpiCard
          label="Highest Correlation Pair"
          value={summary.highest_correlation_pair}
          sub="site pair"
        />
        <KpiCard
          label="Annual Ramp Events"
          value={summary.annual_ramp_events}
        />
      </div>

      {/* Chart 1 — avg wind speed by site */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Average Wind Speed by Site (m/s)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={windSpeedBySite} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis domain={[6, 10]} tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" m/s" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#9ca3af' }}
            />
            <Bar dataKey="avg_wind_speed" name="Avg Wind Speed (m/s)" radius={[3, 3, 0, 0]}>
              {windSpeedBySite.map((entry, idx) => (
                <Cell key={idx} fill={STATE_COLOURS[entry.state] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-3">
          {Object.entries(STATE_COLOURS).map(([state, colour]) => (
            <span key={state} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: colour }} />
              {state}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2 — monthly CF 2024 */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Monthly Capacity Factor — 2024 (all 8 sites)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData2024} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ fontSize: 11 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {sites.map((s, idx) => (
              <Line
                key={s.site_id}
                type="monotone"
                dataKey={siteNames[s.site_id]}
                stroke={SITE_LINE_COLOURS[idx % SITE_LINE_COLOURS.length]}
                dot={false}
                strokeWidth={1.5}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3 — seasonal CF top-4 sites */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Seasonal Capacity Factor — Top 4 Sites
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={seasonalChartData} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="season" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {top4Sites.map((s, idx) => (
              <Bar
                key={s.site_id}
                dataKey={siteNames[s.site_id]}
                fill={SITE_LINE_COLOURS[idx]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — scatter: correlation vs distance */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Inter-site Correlation vs Distance (28 pairs)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="distance_km"
              name="Distance (km)"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Distance (km)', position: 'insideBottom', offset: -4, fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis
              dataKey="correlation_coefficient"
              name="Correlation"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Correlation', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(value: number, name: string) => [value.toFixed(3), name]}
            />
            <Scatter data={scatterData} fill="#06b6d4" opacity={0.75} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 — ramp events by trigger */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Ramp Event Magnitude by Trigger (MW — grouped Up/Down)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rampByTrigger} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="trigger" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Up-ramp"   fill="#10b981" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Down-ramp" fill="#ef4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Portfolio Summary
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
          <div>
            <dt className="text-xs text-gray-500">Total Wind Capacity</dt>
            <dd className="text-sm font-semibold text-white">{summary.total_wind_capacity_mw.toLocaleString()} MW</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Avg Portfolio CF</dt>
            <dd className="text-sm font-semibold text-white">{summary.avg_portfolio_cf_pct}%</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Best Wind Site</dt>
            <dd className="text-sm font-semibold text-white">{summary.best_wind_site}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Highest Correlation Pair</dt>
            <dd className="text-sm font-semibold text-white">{summary.highest_correlation_pair}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Annual Ramp Events</dt>
            <dd className="text-sm font-semibold text-white">{summary.annual_ramp_events}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Total Sites</dt>
            <dd className="text-sm font-semibold text-white">{sites.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">States</dt>
            <dd className="text-sm font-semibold text-white">
              {[...new Set(sites.map(s => s.state))].join(', ')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Data Period</dt>
            <dd className="text-sm font-semibold text-white">2021 – 2024</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Correlation Pairs Analysed</dt>
            <dd className="text-sm font-semibold text-white">{correlations.length}</dd>
          </div>
        </dl>
      </div>

      {/* Sites table */}
      <div className="bg-gray-800 rounded-lg p-5 overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Wind Farm Registry
        </h2>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700 text-xs text-gray-500 uppercase">
              <th className="pb-2 pr-4">Site</th>
              <th className="pb-2 pr-4">State</th>
              <th className="pb-2 pr-4">Turbine</th>
              <th className="pb-2 pr-4 text-right">Capacity (MW)</th>
              <th className="pb-2 pr-4 text-right">Hub Height (m)</th>
              <th className="pb-2 pr-4 text-right">Avg Wind (m/s)</th>
              <th className="pb-2 text-right">Weibull k / c</th>
            </tr>
          </thead>
          <tbody>
            {sites.map(s => (
              <tr key={s.site_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-4 font-medium text-white">{s.site_name}</td>
                <td className="py-2 pr-4">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ backgroundColor: `${STATE_COLOURS[s.state]}33`, color: STATE_COLOURS[s.state] ?? '#9ca3af' }}
                  >
                    {s.state}
                  </span>
                </td>
                <td className="py-2 pr-4 text-gray-400">{s.turbine_model}</td>
                <td className="py-2 pr-4 text-right text-gray-200">{s.installed_capacity_mw}</td>
                <td className="py-2 pr-4 text-right text-gray-200">{s.hub_height_m}</td>
                <td className="py-2 pr-4 text-right text-cyan-400 font-semibold">{s.avg_wind_speed_m_s}</td>
                <td className="py-2 text-right text-gray-400">{s.weibull_k} / {s.weibull_c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
