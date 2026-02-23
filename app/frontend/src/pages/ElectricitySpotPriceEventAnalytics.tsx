import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
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
  Cell,
} from 'recharts'
import {
  getElectricitySpotPriceEventsDashboard,
  ESPEDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const TRIGGER_COLORS: Record<string, string> = {
  'Generator Trip':     '#ef4444',
  'Demand Spike':       '#f59e0b',
  'Renewable Drop':     '#10b981',
  'Gas Shortage':       '#f97316',
  'Network Constraint': '#8b5cf6',
  'Heatwave':           '#ec4899',
  'Cold Snap':          '#06b6d4',
}

const DRIVER_TYPE_COLORS: Record<string, string> = {
  'Supply':           '#3b82f6',
  'Demand':           '#f59e0b',
  'Weather':          '#10b981',
  'Network':          '#8b5cf6',
  'Fuel':             '#f97316',
  'Market Structure': '#06b6d4',
}

const SEASONAL_COLORS: Record<string, string> = {
  'Summer':     '#ef4444',
  'Winter':     '#3b82f6',
  'Year-Round': '#10b981',
  'Random':     '#6b7280',
}

const PRICE_BAND_COLORS: Record<string, string> = {
  'Negative': '#ef4444',
  '$0-$50':   '#10b981',
  '$50-$300': '#f59e0b',
  '$300+':    '#8b5cf6',
}

const REGION_LINE_COLORS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#10b981',
  SA1:  '#8b5cf6',
  TAS1: '#06b6d4',
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  unit,
}: {
  label: string
  value: string | number
  unit?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
      <span className="text-white text-2xl font-bold">
        {value}
        {unit && <span className="text-gray-400 text-sm font-normal ml-1">{unit}</span>}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-white font-semibold text-lg mb-4">{title}</h2>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ElectricitySpotPriceEventAnalytics() {
  const [data, setData] = useState<ESPEDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricitySpotPriceEventsDashboard()
      .then(setData)
      .catch((err) => setError(err.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-gray-400 text-lg">Loading ESPE dashboard…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-red-400 text-lg">{error ?? 'No data available'}</span>
      </div>
    )
  }

  const { events, regional_stats, drivers, price_distribution, mitigation, summary } = data

  // -------------------------------------------------------------------------
  // Chart 1 — Event financial_impact_m_aud by event_type coloured by trigger_cause
  // -------------------------------------------------------------------------
  const eventChartData = events.map((e) => ({
    name: `${e.event_type.slice(0, 10)}-${e.event_id.slice(-3)}`,
    financial_impact_m_aud: e.financial_impact_m_aud,
    trigger_cause: e.trigger_cause,
    event_type: e.event_type,
  }))

  // -------------------------------------------------------------------------
  // Chart 2 — Volatility index quarterly trend 2022-2024 across 5 regions
  // (use halves H1/H2 as the x-axis periods)
  // -------------------------------------------------------------------------
  const allRegions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const volatilityMap: Record<string, Record<string, number>> = {}
  for (const rs of regional_stats) {
    const key = `${rs.year}-${rs.half}`
    if (!volatilityMap[key]) volatilityMap[key] = {}
    volatilityMap[key][rs.region] = rs.volatility_index
  }
  const volatilityChartData = Object.entries(volatilityMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, vals]) => ({ period: key, ...vals }))

  // -------------------------------------------------------------------------
  // Chart 3 — Driver contribution_pct by driver_type coloured by seasonal_pattern
  // -------------------------------------------------------------------------
  const driverChartData = [...drivers]
    .sort((a, b) => b.contribution_pct - a.contribution_pct)
    .slice(0, 20)
    .map((d) => ({
      name: d.driver_name.length > 22 ? d.driver_name.slice(0, 20) + '…' : d.driver_name,
      contribution_pct: d.contribution_pct,
      driver_type: d.driver_type,
      seasonal_pattern: d.seasonal_pattern,
    }))

  // -------------------------------------------------------------------------
  // Chart 4 — Stacked bar: price distribution hours_count by price_band for each region
  // -------------------------------------------------------------------------
  const priceBands = ['Negative', '$0-$50', '$50-$300', '$300+']
  const distRegions = [...new Set(price_distribution.map((p) => p.region))].sort()
  const priceDistChartData = distRegions.map((region) => {
    const row: Record<string, string | number> = { region }
    for (const band of priceBands) {
      const recs = price_distribution.filter((p) => p.region === region && p.price_band === band)
      row[band] = recs.reduce((sum, r) => sum + r.hours_count, 0)
    }
    return row
  })

  // -------------------------------------------------------------------------
  // Chart 5 — Mitigation mw_dispatched by measure_type coloured by effectiveness_pct
  // -------------------------------------------------------------------------
  const mitigationChartData = [...mitigation]
    .sort((a, b) => b.mw_dispatched - a.mw_dispatched)
    .map((m) => ({
      name: m.measure_name.length > 22 ? m.measure_name.slice(0, 20) + '…' : m.measure_name,
      mw_dispatched: m.mw_dispatched,
      effectiveness_pct: m.effectiveness_pct,
      measure_type: m.measure_type,
    }))

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Zap className="text-amber-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Electricity Spot Price Event Analytics
          </h1>
          <p className="text-gray-400 text-sm">
            NEM spot price events: spikes, negatives, cap hits, VoLL, mitigations and drivers
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Events 2024"
          value={summary.total_events_2024}
        />
        <KpiCard
          label="Total Spike Revenue"
          value={`$${summary.total_spike_revenue_m_aud.toFixed(1)}`}
          unit="M"
        />
        <KpiCard
          label="Most Volatile Region"
          value={summary.most_volatile_region}
        />
        <KpiCard
          label="Biggest Single Event"
          value={`$${summary.biggest_single_event_m_aud.toFixed(2)}`}
          unit="M"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1 — Event financial impact by event type */}
        <Section title="Event Financial Impact ($M AUD) by Event Type (coloured by Trigger Cause)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={eventChartData} margin={{ top: 4, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
                formatter={(val: number, _name: string, props: { payload?: { trigger_cause?: string; event_type?: string } }) => [
                  `$${val.toFixed(3)}M`,
                  `${props.payload?.event_type ?? ''} — ${props.payload?.trigger_cause ?? ''}`,
                ]}
              />
              <Bar dataKey="financial_impact_m_aud" name="Financial Impact $M" maxBarSize={28}>
                {eventChartData.map((entry, i) => (
                  <Cell key={i} fill={TRIGGER_COLORS[entry.trigger_cause] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Chart 2 — Volatility index trend */}
        <Section title="Volatility Index Trend 2022–2024 (H1/H2) Across 5 Regions">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={volatilityChartData} margin={{ top: 4, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="period"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              {allRegions.map((region) => (
                <Line
                  key={region}
                  type="monotone"
                  dataKey={region}
                  name={region}
                  stroke={REGION_LINE_COLORS[region] ?? '#6b7280'}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Section>

        {/* Chart 3 — Driver contribution by driver type */}
        <Section title="Driver Contribution % by Driver Type (coloured by Seasonal Pattern)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={driverChartData}
              layout="vertical"
              margin={{ top: 4, right: 20, left: 140, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                width={135}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
                formatter={(val: number, _name: string, props: { payload?: { driver_type?: string; seasonal_pattern?: string } }) => [
                  `${val.toFixed(1)}%`,
                  `${props.payload?.driver_type ?? ''} — ${props.payload?.seasonal_pattern ?? ''}`,
                ]}
              />
              <Bar dataKey="contribution_pct" name="Contribution %" maxBarSize={18}>
                {driverChartData.map((entry, i) => (
                  <Cell key={i} fill={SEASONAL_COLORS[entry.seasonal_pattern] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Chart 4 — Stacked price distribution */}
        <Section title="Price Distribution Hours Count by Price Band per Region (Stacked)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={priceDistChartData} margin={{ top: 4, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              {priceBands.map((band) => (
                <Bar
                  key={band}
                  dataKey={band}
                  name={band}
                  stackId="a"
                  fill={PRICE_BAND_COLORS[band] ?? '#6b7280'}
                  maxBarSize={60}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Chart 5 — Mitigation MW dispatched */}
        <Section title="Mitigation MW Dispatched by Measure Type (shaded by Effectiveness %)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={mitigationChartData}
              layout="vertical"
              margin={{ top: 4, right: 20, left: 145, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                width={140}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
                formatter={(val: number, _name: string, props: { payload?: { measure_type?: string; effectiveness_pct?: number } }) => [
                  `${val.toFixed(0)} MW`,
                  `${props.payload?.measure_type ?? ''} — ${props.payload?.effectiveness_pct?.toFixed(0) ?? ''}% effective`,
                ]}
              />
              <Bar dataKey="mw_dispatched" name="MW Dispatched" maxBarSize={18}>
                {mitigationChartData.map((entry, i) => {
                  // Shade from red (low) to green (high) based on effectiveness
                  const eff = entry.effectiveness_pct / 100
                  const r = Math.round(255 * (1 - eff))
                  const g = Math.round(200 * eff)
                  return <Cell key={i} fill={`rgb(${r},${g},80)`} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Summary stats */}
        <Section title="Event Summary Statistics">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total Cap Hit Events</p>
              <p className="text-white text-xl font-bold">{summary.total_cap_hit_events}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Avg Negative Price Hrs/yr</p>
              <p className="text-white text-xl font-bold">{summary.avg_negative_price_hrs_pa.toFixed(1)}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Avg Event Duration</p>
              <p className="text-white text-xl font-bold">
                {summary.avg_event_duration_intervals.toFixed(1)}
                <span className="text-gray-400 text-sm font-normal ml-1">intervals</span>
              </p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Most Volatile Region</p>
              <p className="text-amber-400 text-xl font-bold">{summary.most_volatile_region}</p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
