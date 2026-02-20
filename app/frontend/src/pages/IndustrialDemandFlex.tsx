import React, { useEffect, useState } from 'react'
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
  ReferenceLine,
} from 'recharts'
import { Factory, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  api,
  IndustrialDemandFlexDashboard,
  LargeConsumerRecord,
  FlexibilityEventRecord,
  IndustrialLoadShapeRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDUSTRY_BADGE: Record<string, string> = {
  EAF_STEEL:   'bg-red-700 text-white',
  ALUMINIUM:   'bg-gray-400 text-gray-900',
  DATA_CENTRE: 'bg-blue-600 text-white',
  DESALINATION:'bg-cyan-600 text-white',
  CHEMICALS:   'bg-orange-600 text-white',
  MINING:      'bg-amber-600 text-gray-900',
  CEMENT:      'bg-gray-600 text-white',
}

const INDUSTRY_LABEL: Record<string, string> = {
  EAF_STEEL:   'EAF Steel',
  ALUMINIUM:   'Aluminium',
  DATA_CENTRE: 'Data Centre',
  DESALINATION:'Desalination',
  CHEMICALS:   'Chemicals',
  MINING:      'Mining',
  CEMENT:      'Cement',
}

const CONTRACT_BADGE: Record<string, string> = {
  RERT:         'bg-red-600 text-white',
  WHOLESALE_DR: 'bg-blue-600 text-white',
  NETWORK_DR:   'bg-green-600 text-white',
  SPOT_RESPONSE:'bg-amber-500 text-gray-900',
}

const EVENT_TYPE_BADGE: Record<string, string> = {
  RERT_ACTIVATION: 'bg-red-600 text-white',
  PRICE_SIGNAL:    'bg-amber-500 text-gray-900',
  NETWORK_SUPPORT: 'bg-blue-600 text-white',
  VOLUNTARY:       'bg-gray-600 text-white',
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  RERT_ACTIVATION: 'RERT Activation',
  PRICE_SIGNAL:    'Price Signal',
  NETWORK_SUPPORT: 'Network Support',
  VOLUNTARY:       'Voluntary',
}

const SEASON_COLORS: Record<string, string> = {
  SUMMER:   '#f59e0b',
  WINTER:   '#3b82f6',
  SHOULDER: '#10b981',
}

const INDUSTRY_BAR_COLORS: Record<string, string> = {
  EAF_STEEL:   '#dc2626',
  ALUMINIUM:   '#9ca3af',
  DATA_CENTRE: '#2563eb',
  DESALINATION:'#0891b2',
  CHEMICALS:   '#ea580c',
  MINING:      '#d97706',
  CEMENT:      '#6b7280',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt0(v: number): string {
  return v.toLocaleString('en-AU', { maximumFractionDigits: 0 })
}
function fmt1(v: number): string {
  return v.toLocaleString('en-AU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
function fmt2(v: number): string {
  return v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${fmt0(v)}`
}

function accuracyColor(pct: number): string {
  if (pct >= 97) return 'text-green-400'
  if (pct >= 92) return 'text-lime-400'
  if (pct >= 85) return 'text-amber-400'
  return 'text-red-400'
}

function scoreColor(score: number): string {
  if (score >= 8) return 'bg-green-500'
  if (score >= 6) return 'bg-lime-500'
  if (score >= 4) return 'bg-amber-500'
  return 'bg-red-500'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

function IndustryBadge({ type }: { type: string }) {
  const cls = INDUSTRY_BADGE[type] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {INDUSTRY_LABEL[type] ?? type}
    </span>
  )
}

function ContractBadge({ type }: { type: string }) {
  const cls = CONTRACT_BADGE[type] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {type}
    </span>
  )
}

function EventTypeBadge({ type }: { type: string }) {
  const cls = EVENT_TYPE_BADGE[type] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {EVENT_TYPE_LABEL[type] ?? type}
    </span>
  )
}

function SustainabilityBar({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const colorClass = scoreColor(score)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-6 text-right">{fmt1(score)}</span>
    </div>
  )
}

// Custom label for horizontal bar chart
function HBarLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = props
  return (
    <text x={x + width + 6} y={y + height / 2 + 4} fill="#9ca3af" fontSize={11}>
      {fmt0(value)} MW
    </text>
  )
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

function FlexCapacityChart({ consumers }: { consumers: LargeConsumerRecord[] }) {
  const sorted = [...consumers].sort((a, b) => b.flexibility_mw - a.flexibility_mw)
  const data = sorted.map(c => ({
    name: c.consumer_name.replace(' Aluminium', ' Al.').replace('BlueScope Steel', 'BlueScope').replace(' Data Centre', ' DC').replace(' Processing', '').replace(' Industrial Complex', '').replace(' Guthega Pumping', '').replace(' Yarwun Alumina', ' Yarwun').replace(' Portland', ' Portland'),
    flexMw: c.flexibility_mw,
    industryType: c.industry_type,
    fill: INDUSTRY_BAR_COLORS[c.industry_type] ?? '#6b7280',
  }))

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 80, left: 160, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          tickFormatter={v => `${v} MW`}
          domain={[0, 450]}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: '#d1d5db', fontSize: 11 }}
          width={155}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#f9fafb' }}
          formatter={(val: number) => [`${fmt0(val)} MW`, 'Flexibility']}
        />
        <Bar dataKey="flexMw" radius={[0, 4, 4, 0]} label={<HBarLabel />}>
          {data.map((entry, idx) => (
            <rect key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// We need Cell from recharts for per-bar coloring
import { Cell } from 'recharts'

function FlexCapacityChartColored({ consumers }: { consumers: LargeConsumerRecord[] }) {
  const sorted = [...consumers].sort((a, b) => b.flexibility_mw - a.flexibility_mw)
  const data = sorted.map(c => ({
    name: c.consumer_name
      .replace('BlueScope Steel Port Kembla', 'BlueScope Steel')
      .replace(' Aluminium', ' Al.')
      .replace(' Processing', '')
      .replace(' Industrial Complex', '')
      .replace(' Guthega Pumping', '')
      .replace(' Yarwun Alumina', ' Yarwun')
      .replace(' Data Centre', ' DC')
      .replace(' Power Station Aux', ' Aux'),
    flexMw: c.flexibility_mw,
    fill: INDUSTRY_BAR_COLORS[c.industry_type] ?? '#6b7280',
  }))

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 90, left: 165, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          tickFormatter={v => `${v}`}
          domain={[0, 450]}
          label={{ value: 'MW', position: 'insideRight', fill: '#6b7280', fontSize: 11, dx: 10 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: '#d1d5db', fontSize: 11 }}
          width={160}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#f9fafb' }}
          formatter={(val: number) => [`${fmt0(val)} MW`, 'Max Interruptible Flex']}
        />
        <Bar dataKey="flexMw" radius={[0, 4, 4, 0]}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function SeasonalLoadShapeChart({
  loadShapes,
  consumers,
}: {
  loadShapes: IndustrialLoadShapeRecord[]
  consumers: LargeConsumerRecord[]
}) {
  const consumerIds = [...new Set(loadShapes.map(s => s.consumer_id))]
  const [selectedId, setSelectedId] = useState(consumerIds[0] ?? '')

  const filtered = loadShapes.filter(s => s.consumer_id === selectedId)
  const seasons = ['SUMMER', 'WINTER', 'SHOULDER'] as const

  // Build hourly data — use hour 0 and 12 as representative sample points
  // (real data has 2 rows per season; we'll just show both as discrete points)
  const chartData = filtered.reduce<Record<string, Record<string, number>>>((acc, row) => {
    const key = `H${row.hour}`
    if (!acc[key]) acc[key] = { hour: row.hour }
    acc[key][`baseline_${row.season}`] = row.baseline_mw
    acc[key][`flex_${row.season}`] = row.flexibility_band_mw
    return acc
  }, {})

  const points = Object.values(chartData).sort((a, b) => (a.hour as number) - (b.hour as number))

  const selectedConsumer = consumers.find(c => c.consumer_id === selectedId)

  return (
    <div>
      {/* Consumer toggle */}
      <div className="flex flex-wrap gap-2 mb-4">
        {consumerIds.map(id => {
          const c = consumers.find(x => x.consumer_id === id)
          return (
            <button
              key={id}
              onClick={() => setSelectedId(id)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedId === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
              }`}
            >
              {c?.consumer_name.replace(' Aluminium', ' Al.').replace('BlueScope Steel Port Kembla', 'BlueScope').replace(' Processing', '') ?? id}
            </button>
          )
        })}
      </div>

      {selectedConsumer && (
        <p className="text-xs text-gray-400 mb-3">
          {selectedConsumer.consumer_name} — {INDUSTRY_LABEL[selectedConsumer.industry_type] ?? selectedConsumer.industry_type}
          {' | '}Baseline peak: {fmt0(selectedConsumer.peak_demand_mw)} MW
          {' | '}Max flex: {fmt0(selectedConsumer.flexibility_mw)} MW
        </p>
      )}

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="hour"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={v => `${v}:00`}
            label={{ value: 'Hour', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={v => `${v}`}
            label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f9fafb' }}
            labelFormatter={v => `Hour ${v}:00`}
            formatter={(val: number, name: string) => {
              const parts = name.split('_')
              const metric = parts[0] === 'baseline' ? 'Baseline' : 'Flex Band'
              const season = parts[1]
              return [`${fmt0(val)} MW`, `${metric} (${season})`]
            }}
          />
          <Legend
            formatter={(value: string) => {
              const parts = value.split('_')
              const metric = parts[0] === 'baseline' ? 'Baseline' : 'Flex Band'
              const season = parts[1]
              return `${metric} (${season})`
            }}
            wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
          />
          {seasons.map(season => (
            <Line
              key={`baseline_${season}`}
              type="monotone"
              dataKey={`baseline_${season}`}
              stroke={SEASON_COLORS[season]}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          ))}
          {seasons.map(season => (
            <Line
              key={`flex_${season}`}
              type="monotone"
              dataKey={`flex_${season}`}
              stroke={SEASON_COLORS[season]}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-1">Solid lines = baseline demand. Dashed lines = flexibility band (interruptible capacity). Showing representative hours (00:00 and 12:00).</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function IndustrialDemandFlex() {
  const [data, setData] = useState<IndustrialDemandFlexDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const d = await api.getIndustrialDemandFlexDashboard()
      setData(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Loading industrial demand flexibility data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 gap-2">
        <AlertTriangle size={20} />
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  const { large_consumers, flexibility_events, load_shapes } = data

  return (
    <div className="p-6 space-y-6 text-gray-100 min-h-screen bg-gray-900">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-600/20 rounded-lg">
            <Factory size={28} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Industrial Demand Flexibility &amp; Load Management</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Large industrial consumers — aluminium smelters, electric arc furnaces, data centres, desalination plants.
              Demand response contracts, interruptible load, and grid balancing services.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-sm text-gray-300 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Flex Capacity"
          value={fmt0(data.total_flex_capacity_mw)}
          unit="MW"
          sub={`Across ${large_consumers.length} large consumers`}
        />
        <KpiCard
          label="Activated Events (2024)"
          value={fmt0(data.activated_events_2024)}
          unit="events"
          sub="RERT + price signal + voluntary"
        />
        <KpiCard
          label="Total DR Revenue"
          value={`$${fmt1(data.total_dr_revenue_m_aud)}M`}
          unit="AUD"
          sub="Annual demand response revenue"
        />
        <KpiCard
          label="Avg Response Accuracy"
          value={`${fmt1(data.avg_response_accuracy_pct)}%`}
          sub="Actual vs requested reduction"
        />
      </div>

      {/* Flexibility Capacity by Industry */}
      <div className="bg-gray-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Flexibility Capacity by Consumer</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(INDUSTRY_LABEL).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1 text-xs text-gray-400">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: INDUSTRY_BAR_COLORS[key] ?? '#6b7280' }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
        <FlexCapacityChartColored consumers={large_consumers} />
      </div>

      {/* Flexibility Events Table */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-4">Flexibility Activation Events — 2024</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700 text-xs uppercase tracking-wide">
                <th className="pb-3 pr-4 font-medium">Date</th>
                <th className="pb-3 pr-4 font-medium">Consumer</th>
                <th className="pb-3 pr-4 font-medium">Event Type</th>
                <th className="pb-3 pr-4 font-medium text-right">Requested (MW)</th>
                <th className="pb-3 pr-4 font-medium text-right">Actual (MW)</th>
                <th className="pb-3 pr-4 font-medium text-right">Accuracy</th>
                <th className="pb-3 pr-4 font-medium text-right">Duration (h)</th>
                <th className="pb-3 pr-4 font-medium text-right">Settlement</th>
                <th className="pb-3 font-medium text-right">Grid Benefit (MWh)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {flexibility_events.map(ev => (
                <tr key={ev.event_id} className="hover:bg-gray-750 transition-colors">
                  <td className="py-2.5 pr-4 text-gray-300 whitespace-nowrap">{ev.event_date}</td>
                  <td className="py-2.5 pr-4 text-gray-200 whitespace-nowrap max-w-[160px] truncate">{ev.consumer_name}</td>
                  <td className="py-2.5 pr-4">
                    <EventTypeBadge type={ev.event_type} />
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-300">{fmt0(ev.requested_reduction_mw)}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-200 font-medium">{fmt0(ev.actual_reduction_mw)}</td>
                  <td className={`py-2.5 pr-4 text-right font-semibold ${accuracyColor(ev.response_accuracy_pct)}`}>
                    {fmt1(ev.response_accuracy_pct)}%
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-300">{fmt1(ev.duration_hours)}</td>
                  <td className="py-2.5 pr-4 text-right text-green-400 font-medium">{fmtCurrency(ev.settlement_aud)}</td>
                  <td className="py-2.5 text-right text-gray-300">{fmt0(ev.grid_benefit_mwh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Large Consumers Table */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-4">Large Industrial Consumers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700 text-xs uppercase tracking-wide">
                <th className="pb-3 pr-4 font-medium">Consumer</th>
                <th className="pb-3 pr-4 font-medium">Industry</th>
                <th className="pb-3 pr-4 font-medium">State</th>
                <th className="pb-3 pr-4 font-medium text-right">Peak Demand (MW)</th>
                <th className="pb-3 pr-4 font-medium text-right">Flexibility (MW)</th>
                <th className="pb-3 pr-4 font-medium text-right">Response (min)</th>
                <th className="pb-3 pr-4 font-medium text-right">Contracted DR (MW)</th>
                <th className="pb-3 pr-4 font-medium">Contract</th>
                <th className="pb-3 pr-4 font-medium text-right">DR Revenue ($M)</th>
                <th className="pb-3 font-medium">Sustainability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {large_consumers
                .slice()
                .sort((a, b) => b.flexibility_mw - a.flexibility_mw)
                .map(c => (
                  <tr key={c.consumer_id} className="hover:bg-gray-750 transition-colors">
                    <td className="py-2.5 pr-4 text-gray-200 font-medium whitespace-nowrap max-w-[180px] truncate">{c.consumer_name}</td>
                    <td className="py-2.5 pr-4">
                      <IndustryBadge type={c.industry_type} />
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400">{c.state}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-300">{fmt0(c.peak_demand_mw)}</td>
                    <td className="py-2.5 pr-4 text-right text-blue-400 font-semibold">{fmt0(c.flexibility_mw)}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-300">{c.response_time_minutes}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-300">{fmt0(c.contracted_dr_mw)}</td>
                    <td className="py-2.5 pr-4">
                      <ContractBadge type={c.contract_type} />
                    </td>
                    <td className="py-2.5 pr-4 text-right text-green-400 font-medium">${fmt2(c.annual_dr_revenue_m_aud)}M</td>
                    <td className="py-2.5 min-w-[120px]">
                      <SustainabilityBar score={c.sustainability_score} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seasonal Load Shape Chart */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-1">Seasonal Load Shape &amp; Flexibility Band</h2>
        <p className="text-xs text-gray-400 mb-4">
          Select a consumer to view their seasonal baseline load and available flexibility band by hour of day.
        </p>
        <SeasonalLoadShapeChart loadShapes={load_shapes} consumers={large_consumers} />
      </div>

      {/* Legend / Info footer */}
      <div className="bg-gray-800 rounded-lg p-4 text-xs text-gray-400">
        <p className="font-semibold text-gray-300 mb-1">Data Notes</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>RERT (Reliability &amp; Emergency Reserve Trader) activations are emergency grid interventions; settlements are significantly higher than typical demand response.</li>
          <li>Flexibility MW represents maximum interruptible load achievable within the contracted response time.</li>
          <li>Sustainability scores (0–10) incorporate renewable energy sourcing, emissions intensity, and corporate sustainability commitments.</li>
          <li>Load shape data shows representative hours (00:00 and 12:00) for SUMMER, WINTER, and SHOULDER seasons.</li>
        </ul>
      </div>
    </div>
  )
}
