import { useEffect, useState } from 'react'
import { Sliders, Zap, Users, TrendingUp, Award } from 'lucide-react'
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
  Cell,
} from 'recharts'
import {
  getDsrAggregatorDashboard,
  DSRDashboard,
  DSRAggregatorRecord,
  DSREventRecord,
  DSRParticipantRecord,
  DSREconomicsRecord,
} from '../api/client'

// ── Colour helpers ────────────────────────────────────────────────────────────

const PARTICIPANT_TYPE_COLORS: Record<string, string> = {
  INDUSTRIAL: 'bg-blue-600 text-blue-100',
  COMMERCIAL: 'bg-orange-600 text-orange-100',
  RESIDENTIAL: 'bg-green-600 text-green-100',
  MIXED: 'bg-purple-600 text-purple-100',
}

const TRIGGER_COLORS: Record<string, string> = {
  PRICE: 'bg-red-600 text-red-100',
  RERT: 'bg-orange-600 text-orange-100',
  FCAS: 'bg-purple-600 text-purple-100',
  VOLUNTARY: 'bg-green-600 text-green-100',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: 'bg-blue-700 text-blue-100',
  QLD1: 'bg-yellow-700 text-yellow-100',
  VIC1: 'bg-indigo-700 text-indigo-100',
  SA1: 'bg-pink-700 text-pink-100',
  NEM: 'bg-gray-600 text-gray-100',
}

const SECTOR_BAR_COLORS: Record<string, string> = {
  ALUMINIUM: '#3b82f6',
  CEMENT: '#f59e0b',
  MINING: '#ef4444',
  COLD_STORAGE: '#06b6d4',
  HVAC: '#8b5cf6',
  EV_FLEET: '#10b981',
  WATER_PUMPING: '#0ea5e9',
}

const REGION_LINE_COLORS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#8b5cf6',
  SA1: '#ec4899',
}

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1']

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  Icon: React.ElementType
  accent: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 border border-gray-700">
      <div className={`p-3 rounded-lg ${accent}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
        <p className="text-white text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  )
}

function ReliabilityBar({ pct }: { pct: number }) {
  const color = pct >= 95 ? 'bg-green-500' : pct >= 85 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-10 text-right">{pct}%</span>
    </div>
  )
}

function PerformanceBar({ pct }: { pct: number }) {
  const color = pct >= 95 ? 'bg-green-500' : pct >= 85 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-12 text-right">{pct.toFixed(1)}%</span>
    </div>
  )
}

// ── Aggregator Table ──────────────────────────────────────────────────────────

function AggregatorTable({ data }: { data: DSRAggregatorRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-700">
        <h2 className="text-white font-semibold text-base">Registered DSR Aggregators</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-750 border-b border-gray-700">
              {[
                'Aggregator',
                'Region',
                'Capacity (MW)',
                'Participants',
                'Type',
                'Response (min)',
                'Reliability',
                'FCAS',
                'RERT',
                'Events 2024',
                'Revenue ($/MWh)',
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium text-xs uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.aggregator_id} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{a.aggregator_name}</td>
                <td className="px-4 py-3">
                  <Badge label={a.region} colorClass={REGION_COLORS[a.region] ?? 'bg-gray-600 text-gray-100'} />
                </td>
                <td className="px-4 py-3 text-gray-200 font-mono">{a.registered_capacity_mw.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-200 font-mono">{a.active_participants.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <Badge label={a.participant_types} colorClass={PARTICIPANT_TYPE_COLORS[a.participant_types] ?? 'bg-gray-600 text-gray-100'} />
                </td>
                <td className="px-4 py-3 text-gray-200 font-mono">{a.avg_response_time_min}</td>
                <td className="px-4 py-3 w-36">
                  <ReliabilityBar pct={a.reliability_pct} />
                </td>
                <td className="px-4 py-3 text-center">
                  {a.fcas_registered ? (
                    <span className="text-green-400 font-bold">✓</span>
                  ) : (
                    <span className="text-red-400 font-bold">✗</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {a.nem_rert_registered ? (
                    <span className="text-green-400 font-bold">✓</span>
                  ) : (
                    <span className="text-red-400 font-bold">✗</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-200 font-mono">{a.total_events_2024}</td>
                <td className="px-4 py-3 text-emerald-400 font-mono font-semibold">${a.avg_revenue_per_mwh}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Events Table ──────────────────────────────────────────────────────────────

function EventsTable({ data }: { data: DSREventRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-700">
        <h2 className="text-white font-semibold text-base">DSR Event Dispatch Log</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-750 border-b border-gray-700">
              {[
                'Event ID',
                'Date',
                'Region',
                'Trigger',
                'Trigger Price ($/MWh)',
                'Instructed (MW)',
                'Achieved (MW)',
                'Performance',
                'Duration (min)',
                'Aggregators',
                'Revenue ($/MWh)',
                'NEM Benefit ($M)',
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium text-xs uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((e) => (
              <tr key={e.event_id} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3 text-gray-300 font-mono">{e.event_id}</td>
                <td className="px-4 py-3 text-gray-300">{e.date}</td>
                <td className="px-4 py-3">
                  <Badge label={e.region} colorClass={REGION_COLORS[e.region] ?? 'bg-gray-600 text-gray-100'} />
                </td>
                <td className="px-4 py-3">
                  <Badge label={e.trigger_type} colorClass={TRIGGER_COLORS[e.trigger_type] ?? 'bg-gray-600 text-gray-100'} />
                </td>
                <td className="px-4 py-3 text-gray-200 font-mono">${e.trigger_price_per_mwh.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-200 font-mono">{e.instructed_mw}</td>
                <td className="px-4 py-3 text-gray-200 font-mono">{e.achieved_mw}</td>
                <td className="px-4 py-3 w-36">
                  <PerformanceBar pct={e.performance_pct} />
                </td>
                <td className="px-4 py-3 text-gray-200 font-mono">{e.duration_min}</td>
                <td className="px-4 py-3 text-gray-200 font-mono">{e.aggregators_dispatched}</td>
                <td className="px-4 py-3 text-emerald-400 font-mono font-semibold">${e.revenue_per_mwh}</td>
                <td className="px-4 py-3 text-amber-400 font-mono font-semibold">${e.nem_benefit_m.toFixed(1)}M</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Participant Sector Chart ──────────────────────────────────────────────────

function ParticipantSectorChart({ data }: { data: DSRParticipantRecord[] }) {
  const chartData = [...data].sort((a, b) => b.curtailment_capacity_mw - a.curtailment_capacity_mw)

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
    if (!active || !payload?.length) return null
    const record = data.find((d) => d.participant_name === label)
    return (
      <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-xs text-gray-200 shadow-lg">
        <p className="font-semibold text-white mb-1">{label}</p>
        <p>Sector: {record?.sector}</p>
        <p>Curtailment: <span className="text-blue-400 font-mono">{payload[0]?.value} MW</span></p>
        <p>Economic Threshold: <span className="text-amber-400 font-mono">${record?.economic_threshold_per_mwh}/MWh</span></p>
        <p>Annual Revenue: <span className="text-emerald-400 font-mono">${record?.annual_revenue_m}M</span></p>
        <p>Min Notice: <span className="text-gray-300 font-mono">{record?.min_notice_min} min</span></p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <h2 className="text-white font-semibold text-base mb-4">Industrial Load Curtailment Capacity by Participant</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 160, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
            label={{ value: 'Curtailment Capacity (MW)', position: 'insideBottom', offset: -2, fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="participant_name"
            tick={{ fill: '#d1d5db', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={155}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="curtailment_capacity_mw" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.participant_name} fill={SECTOR_BAR_COLORS[entry.sector] ?? '#6b7280'} />
            ))}
          </Bar>
          <ReferenceLine x={50} stroke="#6b7280" strokeDasharray="4 4" label={{ value: '50 MW', fill: '#9ca3af', fontSize: 10 }} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(SECTOR_BAR_COLORS).map(([sector, color]) => (
          <span key={sector} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            {sector.replace('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── DSR Economics Trend Chart ─────────────────────────────────────────────────

function DSREconomicsTrendChart({ data }: { data: DSREconomicsRecord[] }) {
  const [activeRegion, setActiveRegion] = useState<string>('NSW1')

  const regionData = data
    .filter((d) => d.region === activeRegion)
    .sort((a, b) => a.year - b.year)

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-xs text-gray-200 shadow-lg">
        <p className="font-semibold text-white mb-1">Year {label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <span className="font-mono font-semibold">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-base">DSR Economics Trend (2020–2025)</h2>
        <div className="flex gap-1">
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setActiveRegion(r)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeRegion === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={regionData} margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="year"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'MW / Events', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11, dx: -5 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[3, 5]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'BCR', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11, dx: 10 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#9ca3af', paddingTop: '8px' }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="total_dsr_capacity_mw"
            name="DSR Capacity (MW)"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#3b82f6' }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="events_dispatched"
            name="Events Dispatched"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3, fill: '#f59e0b' }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="benefit_cost_ratio"
            name="Benefit/Cost Ratio"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="6 2"
            dot={{ r: 3, fill: '#10b981' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Economics Summary Table ───────────────────────────────────────────────────

function EconomicsSummaryTable({ data }: { data: DSREconomicsRecord[] }) {
  const latest = data.filter((d) => d.year === 2025).sort((a, b) => b.total_dsr_capacity_mw - a.total_dsr_capacity_mw)

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-700">
        <h2 className="text-white font-semibold text-base">DSR Market Economics — 2025 Snapshot</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-750 border-b border-gray-700">
              {[
                'Region',
                'DSR Capacity (MW)',
                'Events',
                'Energy Curtailed (GWh)',
                'Revenue ($M)',
                'Avg Revenue ($/MWh)',
                'NEM Wholesale Saving ($M)',
                'Peaker Avoided ($M)',
                'Benefit/Cost Ratio',
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium text-xs uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {latest.map((r) => (
              <tr key={r.region} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3">
                  <Badge label={r.region} colorClass={REGION_COLORS[r.region] ?? 'bg-gray-600 text-gray-100'} />
                </td>
                <td className="px-4 py-3 text-gray-200 font-mono">{r.total_dsr_capacity_mw.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-200 font-mono">{r.events_dispatched}</td>
                <td className="px-4 py-3 text-gray-200 font-mono">{r.total_energy_curtailed_gwh.toFixed(2)}</td>
                <td className="px-4 py-3 text-emerald-400 font-mono font-semibold">${r.total_revenue_m.toFixed(1)}M</td>
                <td className="px-4 py-3 text-gray-200 font-mono">${r.avg_revenue_per_mwh.toFixed(0)}</td>
                <td className="px-4 py-3 text-amber-400 font-mono">${r.nem_wholesale_saving_m.toFixed(1)}M</td>
                <td className="px-4 py-3 text-blue-400 font-mono">${r.cost_of_new_peaker_avoided_m.toFixed(1)}M</td>
                <td className="px-4 py-3">
                  <span className={`font-mono font-semibold ${r.benefit_cost_ratio >= 4 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {r.benefit_cost_ratio.toFixed(2)}x
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DsrAggregatorAnalytics() {
  const [data, setData] = useState<DSRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDsrAggregatorDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400 text-sm">Error loading DSR data: {error}</p>
      </div>
    )
  }

  const { aggregators, events, participants, economics, summary } = data

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-600 rounded-lg">
          <Sliders size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Demand Side Response Aggregator Analytics</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            NEM DSR event dispatch, aggregator performance, industrial load curtailment and market economics
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Registered MW"
          value={`${(summary.total_registered_mw as number).toLocaleString()} MW`}
          sub="Across all registered aggregators"
          Icon={Zap}
          accent="bg-blue-600"
        />
        <KpiCard
          label="Total Participants"
          value={(summary.total_participants_count as number).toLocaleString()}
          sub="Industrial, commercial & residential"
          Icon={Users}
          accent="bg-purple-600"
        />
        <KpiCard
          label="Avg Reliability"
          value={`${summary.avg_reliability_pct as number}%`}
          sub="Weighted average across aggregators"
          Icon={Award}
          accent="bg-green-600"
        />
        <KpiCard
          label="Events YTD (2025)"
          value={`${summary.events_ytd as number} Events`}
          sub={`Highest revenue: $${summary.highest_revenue_event_per_mwh as number}/MWh`}
          Icon={TrendingUp}
          accent="bg-amber-600"
        />
      </div>

      {/* Aggregator Table */}
      <AggregatorTable data={aggregators} />

      {/* Events Table */}
      <EventsTable data={events} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ParticipantSectorChart data={participants} />
        <DSREconomicsTrendChart data={economics} />
      </div>

      {/* Economics Summary Table */}
      <EconomicsSummaryTable data={economics} />
    </div>
  )
}
