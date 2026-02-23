import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
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
  getPowerSystemInertiaDashboard,
  PSISDashboard,
  PSISInertiaLevel,
  PSISFrequencyEvent,
  PSISInertiaService,
  PSISStabilityMetric,
  PSISMitigationAction,
} from '../api/client'

const REGION_COLORS: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#f59e0b',
  VIC1: '#34d399',
  SA1:  '#f87171',
  TAS1: '#a78bfa',
}

const STATUS_COLORS: Record<string, string> = {
  'In Service':        '#34d399',
  'Under Construction':'#f59e0b',
  Planned:             '#60a5fa',
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Chart 1: inertia trend by region (2024) ─────────────────────────────────
function InertiaLineChart({ data }: { data: PSISInertiaLevel[] }) {
  const filtered = data.filter(d => d.year === 2024)
  const quarters = [1, 2, 3, 4]
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

  const chartData = quarters.map(q => {
    const point: Record<string, number | string> = { quarter: `Q${q}` }
    regions.forEach(reg => {
      const item = filtered.find(d => d.region === reg && d.quarter === q)
      if (item) point[reg] = item.synchronous_inertia_mws
    })
    return point
  })

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">
        Synchronous Inertia by Region — 2024 (MWs)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MWs" width={80} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {regions.map(reg => (
            <Line
              key={reg}
              type="monotone"
              dataKey={reg}
              stroke={REGION_COLORS[reg]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Chart 2: scatter nadir_hz vs rocof_hz_s ─────────────────────────────────
function FrequencyEventScatter({ data }: { data: PSISFrequencyEvent[] }) {
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">
        Frequency Events — Nadir (Hz) vs RoCoF (Hz/s) by Region
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            type="number"
            dataKey="nadir_hz"
            name="Nadir (Hz)"
            domain={['auto', 'auto']}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            label={{ value: 'Nadir (Hz)', position: 'insideBottom', offset: -4, fill: '#6b7280', fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="rocof_hz_s"
            name="RoCoF (Hz/s)"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            label={{ value: 'RoCoF (Hz/s)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(val: number, name: string) => [val.toFixed(3), name]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <ReferenceLine x={49.0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'UFLS 49 Hz', fill: '#ef4444', fontSize: 10 }} />
          {regions.map(reg => (
            <Scatter
              key={reg}
              name={reg}
              data={data.filter(d => d.region === reg).map(d => ({ nadir_hz: d.nadir_hz, rocof_hz_s: d.rocof_hz_s }))}
              fill={REGION_COLORS[reg]}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Chart 3: stacked bar contracted_mws by service_type x region ─────────────
function InertiaServicesStackedBar({ data }: { data: PSISInertiaService[] }) {
  const serviceTypes = ['Synchronous Condenser', 'Synthetic Inertia', 'Fast Frequency Response', 'Grid Forming Inverter']
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const serviceColors = ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa']

  const chartData = regions.map(reg => {
    const point: Record<string, number | string> = { region: reg }
    serviceTypes.forEach(st => {
      const item = data.find(d => d.region === reg && d.service_type === st)
      point[st] = item ? item.contracted_mws : 0
    })
    return point
  })

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">
        Contracted Inertia Services by Service Type &amp; Region (MWs)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MWs" width={80} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {serviceTypes.map((st, i) => (
            <Bar key={st} dataKey={st} stackId="a" fill={serviceColors[i]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Chart 4: stability metrics value vs threshold (NSW1, 2024) ───────────────
function StabilityMetricGroupedBar({ data }: { data: PSISStabilityMetric[] }) {
  const filtered = data.filter(d => d.region === 'NSW1' && d.year === 2024)
  const chartData = filtered.map(d => ({
    metric: d.metric_name.replace(' Analytics', '').slice(0, 22),
    Value: d.value,
    Threshold: d.threshold,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">
        Stability Metrics vs Thresholds — NSW1, 2024
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 40, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="metric"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-20}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} width={70} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="Value" fill="#60a5fa" />
          <Bar dataKey="Threshold" fill="#f87171" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Chart 5: mitigation actions inertia_contribution_mws coloured by status ──
function MitigationActionsBar({ data }: { data: PSISMitigationAction[] }) {
  const chartData = data.map(d => ({
    id: d.action_id,
    inertia: d.inertia_contribution_mws,
    status: d.status,
    fill: STATUS_COLORS[d.status] ?? '#6b7280',
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">
        Mitigation Actions — Inertia Contribution (MWs) by Status
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 40, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="id"
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MWs" width={80} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(val: number) => [`${val.toFixed(1)} MWs`, 'Inertia Contribution']}
          />
          <Bar dataKey="inertia" isAnimationActive={false}>
            {chartData.map((entry, index) => (
              <rect key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 flex-wrap">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} />
            <span className="text-xs text-gray-400">{status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Summary DL grid ──────────────────────────────────────────────────────────
function SummaryGrid({ dash }: { dash: PSISDashboard }) {
  const s = dash.summary
  const items = [
    { label: 'Avg System Inertia', value: `${s.avg_system_inertia_mws.toLocaleString()} MWs` },
    { label: 'Min Inertia Recorded', value: `${s.min_inertia_recorded_mws.toLocaleString()} MWs` },
    { label: 'Frequency Events FY', value: s.frequency_events_fy.toString() },
    { label: 'UFLS Activations FY', value: s.ufls_activations_fy.toString() },
    { label: 'Total Contracted Services', value: `${s.total_contracted_inertia_services_mws.toLocaleString()} MWs` },
    { label: 'Inertia Level Records', value: dash.inertia_levels.length.toString() },
    { label: 'Frequency Events', value: dash.frequency_events.length.toString() },
    { label: 'Inertia Service Contracts', value: dash.inertia_services.length.toString() },
    { label: 'Stability Metrics', value: dash.stability_metrics.length.toString() },
    { label: 'Mitigation Actions', value: dash.mitigation_actions.length.toString() },
  ]

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Dashboard Summary</h3>
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {items.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="text-sm font-semibold text-gray-100">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function PowerSystemInertiaAnalytics() {
  const [dash, setDash] = useState<PSISDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPowerSystemInertiaDashboard()
      .then(setDash)
      .catch(err => setError(err?.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Activity className="animate-pulse mr-2" size={20} />
        Loading Power System Inertia data...
      </div>
    )
  }

  if (error || !dash) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const s = dash.summary

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Activity className="text-blue-400" size={24} />
        <div>
          <h1 className="text-xl font-bold text-white">
            Power System Inertia Stability Analytics
          </h1>
          <p className="text-sm text-gray-400">
            NEM synchronous inertia, frequency events, and system strength monitoring
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Avg System Inertia"
          value={`${s.avg_system_inertia_mws.toLocaleString()} MWs`}
          sub="All regions, all years"
        />
        <KpiCard
          label="Min Inertia Recorded"
          value={`${s.min_inertia_recorded_mws.toLocaleString()} MWs`}
          sub="Lowest quarter observed"
        />
        <KpiCard
          label="Frequency Events FY"
          value={s.frequency_events_fy.toString()}
          sub="Events with 2024 date"
        />
        <KpiCard
          label="UFLS Activations FY"
          value={s.ufls_activations_fy.toString()}
          sub="Under-freq load shedding"
        />
        <KpiCard
          label="Contracted Inertia Services"
          value={`${s.total_contracted_inertia_services_mws.toLocaleString()} MWs`}
          sub="Total contracted MWs"
        />
      </div>

      {/* Chart 1 + Chart 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InertiaLineChart data={dash.inertia_levels} />
        <FrequencyEventScatter data={dash.frequency_events} />
      </div>

      {/* Chart 3 */}
      <InertiaServicesStackedBar data={dash.inertia_services} />

      {/* Chart 4 + Chart 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StabilityMetricGroupedBar data={dash.stability_metrics} />
        <MitigationActionsBar data={dash.mitigation_actions} />
      </div>

      {/* Summary */}
      <SummaryGrid dash={dash} />
    </div>
  )
}
