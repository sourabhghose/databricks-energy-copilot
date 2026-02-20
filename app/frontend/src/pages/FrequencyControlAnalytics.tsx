import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
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
  ReferenceLine,
} from 'recharts'
import { Activity } from 'lucide-react'
import {
  getFrequencyControlDashboard,
  FrequencyControlDashboard,
  NFCEventRecord,
} from '../api/client'

// ─── helpers ────────────────────────────────────────────────────────────────

function kpiCard(label: string, value: string, sub: string, accent: string) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      <span className="text-xs text-gray-500">{sub}</span>
    </div>
  )
}

const TRIGGER_COLORS: Record<string, string> = {
  GENERATOR_TRIP:           'bg-red-700 text-red-100',
  LOAD_REJECTION:           'bg-yellow-700 text-yellow-100',
  INTERCONNECTOR_SEPARATION:'bg-purple-700 text-purple-100',
  DEMAND_FORECAST_ERROR:    'bg-blue-700 text-blue-100',
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const cls = TRIGGER_COLORS[trigger] ?? 'bg-gray-700 text-gray-100'
  const label = trigger.replace(/_/g, ' ')
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function responseColor(ms: number): string {
  if (ms <= 500)  return '#22c55e'   // fast — green
  if (ms <= 1500) return '#f59e0b'   // medium — amber
  return '#ef4444'                   // slow — red
}

// ─── component ──────────────────────────────────────────────────────────────

export default function FrequencyControlAnalytics() {
  const [data, setData]       = useState<FrequencyControlDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getFrequencyControlDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        Loading frequency control data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  // ── derived KPI values ───────────────────────────────────────────────────
  const avgFreq       = (data.frequency_records.reduce((s, r) => s + r.avg_freq_hz, 0) / data.frequency_records.length).toFixed(3)
  const avgInBand     = (data.frequency_records.reduce((s, r) => s + r.time_in_band_pct, 0) / data.frequency_records.length).toFixed(1)
  const worstNadir    = Math.min(...data.events.map((e) => e.nadir_hz)).toFixed(3)
  const avgCompliance = (data.performance.reduce((s, r) => s + r.compliance_rate_pct, 0) / data.performance.length).toFixed(1)

  // ── event table — sorted nadir ascending (worst first) ──────────────────
  const sortedEvents: NFCEventRecord[] = [...data.events].sort((a, b) => a.nadir_hz - b.nadir_hz)

  // ── contributor bar data ─────────────────────────────────────────────────
  const contribData = [...data.contributors].sort((a, b) => b.pfr_response_mw - a.pfr_response_mw)

  // ── performance chart ────────────────────────────────────────────────────
  const perfData = data.performance.map((p) => ({
    month:        p.month.replace('2024-', ''),
    compliance:   p.compliance_rate_pct,
    shortfalls:   p.fcas_shortfall_events,
    pfr_adequacy: p.pfr_response_adequacy_pct,
  }))

  return (
    <div className="min-h-full bg-gray-900 text-gray-100 p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Activity size={24} className="text-cyan-400" />
        <div>
          <h1 className="text-xl font-bold text-white">NEM Frequency Control Analytics</h1>
          <p className="text-sm text-gray-400">
            System frequency performance, primary frequency response (PFR) and deviation events — 2024 annual view
          </p>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCard('Current Avg Frequency', `${avgFreq} Hz`, 'NSW1 · 12-month mean', 'text-cyan-400')}
        {kpiCard('Time in Normal Band', `${avgInBand}%`, '49.85 – 50.15 Hz band', 'text-green-400')}
        {kpiCard('Worst Nadir (2024)', `${worstNadir} Hz`, 'Lowest recorded frequency', 'text-red-400')}
        {kpiCard('PFR Compliance Rate', `${avgCompliance}%`, 'Avg monthly FCAS compliance', 'text-amber-400')}
      </div>

      {/* ── Frequency deviation AreaChart ──────────────────────────────── */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Monthly Average Frequency — NSW1 (2024)
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data.frequency_records} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="freqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => v.replace('2024-', '')} />
            <YAxis
              domain={[49.6, 50.5]}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={(v) => v.toFixed(2)}
              label={{ value: 'Hz', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#06b6d4' }}
              formatter={(v: number) => [`${v.toFixed(4)} Hz`, 'Avg Frequency']}
            />
            <ReferenceLine y={50.15} stroke="#f59e0b" strokeDasharray="5 3" label={{ value: '50.15 Hz', fill: '#f59e0b', fontSize: 10, position: 'right' }} />
            <ReferenceLine y={49.85} stroke="#f59e0b" strokeDasharray="5 3" label={{ value: '49.85 Hz', fill: '#f59e0b', fontSize: 10, position: 'right' }} />
            <ReferenceLine y={50.0}  stroke="#6b7280" strokeDasharray="2 4" label={{ value: '50.00 Hz', fill: '#6b7280', fontSize: 10, position: 'right' }} />
            <Area
              type="monotone"
              dataKey="avg_freq_hz"
              name="Avg Frequency"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#freqGrad)"
              dot={{ r: 3, fill: '#06b6d4' }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2">
          Yellow dashed lines mark the normal operating band (49.85 – 50.15 Hz). Deviations outside this band trigger FCAS dispatch.
        </p>
      </div>

      {/* ── Event severity table ────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Major Frequency Events — Sorted by Nadir (worst first)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                <th className="pb-2 pr-4">Event ID</th>
                <th className="pb-2 pr-4">Date / Time</th>
                <th className="pb-2 pr-4">Region</th>
                <th className="pb-2 pr-4">Trigger</th>
                <th className="pb-2 pr-4 text-right">Nadir (Hz)</th>
                <th className="pb-2 pr-4 text-right">ROCOF (Hz/s)</th>
                <th className="pb-2 pr-4 text-right">Recovery (s)</th>
                <th className="pb-2 text-right">USE (MWh)</th>
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map((ev) => (
                <tr key={ev.event_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-mono text-xs text-gray-300">{ev.event_id}</td>
                  <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">
                    {ev.datetime.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-300 text-xs font-medium">
                      {ev.region}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <TriggerBadge trigger={ev.trigger} />
                  </td>
                  <td className={`py-2 pr-4 text-right font-semibold tabular-nums ${ev.nadir_hz < 49.5 ? 'text-red-400' : ev.nadir_hz < 49.75 ? 'text-amber-400' : 'text-green-400'}`}>
                    {ev.nadir_hz.toFixed(3)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-gray-300">
                    {ev.rocof_hz_per_sec.toFixed(2)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-gray-300">
                    {ev.recovery_time_sec.toFixed(1)}
                  </td>
                  <td className={`py-2 text-right tabular-nums font-medium ${ev.unserved_energy_mwh > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                    {ev.unserved_energy_mwh > 0 ? ev.unserved_energy_mwh.toFixed(1) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          USE = Unserved Energy. Nadir colour: red &lt; 49.50 Hz, amber 49.50–49.75 Hz, green &gt; 49.75 Hz.
        </p>
      </div>

      {/* ── PFR contributor horizontal bar chart ────────────────────────── */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-1">
          Primary Frequency Response — MW Contribution by Technology
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Bar colour indicates response speed: green ≤ 500 ms · amber 501–1 500 ms · red &gt; 1 500 ms
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={contribData}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 160, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'PFR Response (MW)', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="technology"
              tick={{ fill: '#d1d5db', fontSize: 11 }}
              width={155}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(v: number, _name: string, props) => {
                const d = props.payload
                return [`${v} MW  ·  ${d.contribution_pct}% · ${d.response_speed_ms} ms`, 'PFR Response']
              }}
            />
            <Bar dataKey="pfr_response_mw" radius={[0, 4, 4, 0]}>
              {contribData.map((entry, idx) => (
                <rect key={idx} fill={responseColor(entry.response_speed_ms)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Monthly performance dual-axis line chart ─────────────────────── */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Monthly Performance Trend — PFR Compliance % vs FCAS Shortfall Events
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={perfData} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis
              yAxisId="left"
              domain={[88, 100]}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              label={{ value: 'Compliance %', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 6]}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Shortfall Events', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="compliance"
              name="Compliance Rate (%)"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="pfr_adequacy"
              name="PFR Adequacy (%)"
              stroke="#06b6d4"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={{ r: 3 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="shortfalls"
              name="FCAS Shortfall Events"
              stroke="#f87171"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2">
          Left axis: compliance and PFR adequacy (%). Right axis: FCAS shortfall event count. Summer months (Dec, Jan, May) show elevated shortfall frequency.
        </p>
      </div>

    </div>
  )
}
