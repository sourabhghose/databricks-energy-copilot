import { useEffect, useState } from 'react'
import { Radio, Activity, AlertTriangle, Gauge } from 'lucide-react'
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
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts'
import { getGFRADashboard } from '../api/client'
import type { GFRADashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#6366f1',
  SA1:  '#10b981',
  TAS1: '#8b5cf6',
}

const TECH_COLOURS: Record<string, string> = {
  BATTERY: '#3b82f6',
  GAS:     '#f59e0b',
  HYDRO:   '#10b981',
  COAL:    '#ef4444',
  WIND:    '#8b5cf6',
  SOLAR:   '#f97316',
}

const EVENT_TYPE_BADGE: Record<string, string> = {
  GENERATION_TRIP:      'bg-red-600',
  LOAD_TRIP:            'bg-amber-600',
  INTERCONNECTOR_TRIP:  'bg-purple-600',
  SYSTEM_NORMAL:        'bg-green-600',
}

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
    <div className="bg-gray-800 rounded-2xl p-6 flex items-start gap-4">
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
// Chart Card wrapper
// ---------------------------------------------------------------------------
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function GridFrequencyResponseAnalytics() {
  const [data, setData] = useState<GFRADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGFRADashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Grid Frequency Response Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">Error: {error ?? 'No data received'}</p>
      </div>
    )
  }

  // Derived KPI values
  const totalEvents = data.frequency_events.length
  const avgNadir = (
    data.frequency_events.reduce((s, e) => s + e.frequency_nadir_hz, 0) / totalEvents
  ).toFixed(3)
  const avgRecovery = (
    data.frequency_events.reduce((s, e) => s + e.recovery_time_s, 0) / totalEvents
  ).toFixed(1)
  const belowThresholdCount = data.inertia.filter((i) => i.is_below_threshold).length

  // Prepare inertia chart data grouped by region
  const regionSet = [...new Set(data.inertia.map((i) => i.region))]
  const monthSet = [...new Set(data.inertia.map((i) => i.month))].sort()
  const inertiaChartData = monthSet.map((month) => {
    const row: Record<string, string | number> = { month }
    for (const r of regionSet) {
      const rec = data.inertia.find((i) => i.month === month && i.region === r)
      row[r] = rec ? rec.system_inertia_mws : 0
    }
    return row
  })

  // RoCoF trend chart data
  const rocofChartData = data.rocof_trends.map((r) => ({
    month: r.month,
    avg: r.avg_rocof_hz_per_s,
    max: r.max_rocof_hz_per_s,
    threshold: r.threshold_hz_per_s,
    events: r.events_above_threshold,
  }))

  // FCAS provider bar chart data
  const fcasBarData = data.fcas_providers.map((p) => ({
    name: p.provider_name.length > 15 ? p.provider_name.slice(0, 14) + '...' : p.provider_name,
    fullName: p.provider_name,
    raise_6s: p.raise_6s_capacity_mw,
    raise_60s: p.raise_60s_capacity_mw,
    raise_5min: p.raise_5min_capacity_mw,
    response_ms: p.avg_response_time_ms,
    reliability: p.reliability_pct,
  }))

  // Frequency event scatter-like chart (bar chart of nadir by event)
  const eventChartData = data.frequency_events.map((e, idx) => ({
    event: `E${idx + 1}`,
    nadir: e.frequency_nadir_hz,
    rocof: Math.abs(e.rocof_hz_per_s),
    recovery: e.recovery_time_s,
    type: e.event_type,
    region: e.region,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Radio className="text-cyan-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Grid Frequency Response Analytics</h1>
          <p className="text-sm text-gray-400">
            NEM frequency control, FCAS provider performance, inertia levels &amp; RoCoF monitoring
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Frequency Events"
          value={String(totalEvents)}
          sub="Generation & load trips recorded"
          icon={AlertTriangle}
          color="bg-red-700"
        />
        <KpiCard
          title="Avg Frequency Nadir"
          value={`${avgNadir} Hz`}
          sub="Average lowest frequency during events"
          icon={Activity}
          color="bg-cyan-700"
        />
        <KpiCard
          title="Avg Recovery Time"
          value={`${avgRecovery}s`}
          sub="Mean time to restore 50 Hz"
          icon={Gauge}
          color="bg-amber-700"
        />
        <KpiCard
          title="Inertia Shortfalls"
          value={String(belowThresholdCount)}
          sub="Region-months below minimum threshold"
          icon={Radio}
          color="bg-purple-700"
        />
      </div>

      {/* Row 1: Frequency Events + RoCoF Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Frequency Nadir by Event">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={eventChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="event" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis domain={[49.5, 50.1]} stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <ReferenceLine y={49.85} stroke="#ef4444" strokeDasharray="5 5" label={{ value: '49.85 Hz', fill: '#ef4444', fontSize: 10 }} />
              <ReferenceLine y={50.0} stroke="#22c55e" strokeDasharray="3 3" label={{ value: '50.0 Hz', fill: '#22c55e', fontSize: 10 }} />
              <Bar dataKey="nadir" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Frequency Nadir (Hz)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="RoCoF Trend (Monthly)">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={rocofChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} name="Avg RoCoF (Hz/s)" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="max" stroke="#ef4444" strokeWidth={2} name="Max RoCoF (Hz/s)" dot={{ r: 3 }} />
              <ReferenceLine y={rocofChartData[0]?.threshold ?? 0.5} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Threshold', fill: '#f59e0b', fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: System Inertia + FCAS Provider Capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="System Inertia by Region (MWs)">
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={inertiaChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {regionSet.map((r) => (
                <Area
                  key={r}
                  type="monotone"
                  dataKey={r}
                  stackId="1"
                  fill={REGION_COLOURS[r] ?? '#6b7280'}
                  stroke={REGION_COLOURS[r] ?? '#6b7280'}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="FCAS Provider Raise Capacity (MW)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={fcasBarData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" stroke="#9ca3af" tick={{ fontSize: 10 }} width={110} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="raise_6s" fill="#3b82f6" name="Raise 6s" stackId="a" />
              <Bar dataKey="raise_60s" fill="#10b981" name="Raise 60s" stackId="a" />
              <Bar dataKey="raise_5min" fill="#f59e0b" name="Raise 5min" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table 1: Frequency Events */}
      <ChartCard title="Frequency Event Log">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">Event ID</th>
                <th className="pb-2 pr-4">Timestamp</th>
                <th className="pb-2 pr-4">Region</th>
                <th className="pb-2 pr-4">Event Type</th>
                <th className="pb-2 pr-4 text-right">Nadir (Hz)</th>
                <th className="pb-2 pr-4 text-right">RoCoF (Hz/s)</th>
                <th className="pb-2 pr-4 text-right">Recovery (s)</th>
                <th className="pb-2 pr-4 text-right">Contingency (MW)</th>
                <th className="pb-2">Primary Responder</th>
              </tr>
            </thead>
            <tbody>
              {data.frequency_events.map((ev) => (
                <tr key={ev.event_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                  <td className="py-2 pr-4 text-gray-300 font-mono text-xs">{ev.event_id}</td>
                  <td className="py-2 pr-4 text-gray-300 text-xs">{ev.timestamp}</td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: REGION_COLOURS[ev.region] ?? '#6b7280', color: '#fff' }}>
                      {ev.region}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${EVENT_TYPE_BADGE[ev.event_type] ?? 'bg-gray-600'}`}>
                      {ev.event_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className={`py-2 pr-4 text-right font-mono text-xs ${ev.frequency_nadir_hz < 49.85 ? 'text-red-400' : 'text-green-400'}`}>
                    {ev.frequency_nadir_hz.toFixed(3)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-xs text-gray-300">{ev.rocof_hz_per_s.toFixed(3)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-xs text-gray-300">{ev.recovery_time_s.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-xs text-gray-300">{ev.contingency_size_mw}</td>
                  <td className="py-2 text-gray-300 text-xs">{ev.primary_response_provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Table 2: FCAS Provider Performance */}
      <ChartCard title="FCAS Provider Performance">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">Provider</th>
                <th className="pb-2 pr-4">Technology</th>
                <th className="pb-2 pr-4">Region</th>
                <th className="pb-2 pr-4 text-right">Raise 6s (MW)</th>
                <th className="pb-2 pr-4 text-right">Raise 60s (MW)</th>
                <th className="pb-2 pr-4 text-right">Raise 5min (MW)</th>
                <th className="pb-2 pr-4 text-right">Avg Response (ms)</th>
                <th className="pb-2 text-right">Reliability (%)</th>
              </tr>
            </thead>
            <tbody>
              {data.fcas_providers.map((p) => (
                <tr key={p.provider_name} className="border-b border-gray-700/50 hover:bg-gray-750">
                  <td className="py-2 pr-4 text-gray-200 text-xs font-medium">{p.provider_name}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: TECH_COLOURS[p.technology] ?? '#6b7280' }}
                    >
                      {p.technology}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: REGION_COLOURS[p.region] ?? '#6b7280', color: '#fff' }}>
                      {p.region}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-xs text-gray-300">{p.raise_6s_capacity_mw}</td>
                  <td className="py-2 pr-4 text-right font-mono text-xs text-gray-300">{p.raise_60s_capacity_mw}</td>
                  <td className="py-2 pr-4 text-right font-mono text-xs text-gray-300">{p.raise_5min_capacity_mw}</td>
                  <td className="py-2 pr-4 text-right font-mono text-xs text-gray-300">{p.avg_response_time_ms}</td>
                  <td className={`py-2 text-right font-mono text-xs ${p.reliability_pct >= 98 ? 'text-green-400' : p.reliability_pct >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {p.reliability_pct.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}
