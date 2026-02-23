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
  Cell,
} from 'recharts'
import { Users } from 'lucide-react'
import {
  getDemandResponseAggregatorDashboard,
  DRAMDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#8b5cf6',
  SA1:  '#10b981',
  TAS1: '#06b6d4',
}

const TRIGGER_COLOURS: Record<string, string> = {
  'Price Spike':          '#ef4444',
  'Emergency':            '#dc2626',
  'FCAS Shortage':        '#f59e0b',
  'Network Constraint':   '#8b5cf6',
  'Voluntary':            '#10b981',
}

const REASON_COLOURS: Record<string, string> = {
  'Revenue':       '#3b82f6',
  'Grid Support':  '#10b981',
  'Sustainability':'#22c55e',
  'Reliability':   '#f59e0b',
}

const SCENARIO_COLOURS: Record<string, string> = {
  'Base':               '#3b82f6',
  'High DSP':           '#f59e0b',
  'Technology Enabled': '#10b981',
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-medium">
        <Users size={16} />
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DemandResponseAggregatorAnalytics() {
  const [data, setData] = useState<DRAMDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDemandResponseAggregatorDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Demand Response Aggregator Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>

  // ── Chart 1: Bar — registered_capacity_mw by aggregator_name coloured by region ──
  const aggregatorNames = ['EnerNOC', 'Enel X', 'Flux Federation', 'PowerResponse', 'GridBeyond']
  const chart1ByAgg: Record<string, Record<string, number>> = {}
  for (const a of data.aggregators) {
    if (!chart1ByAgg[a.aggregator_name]) chart1ByAgg[a.aggregator_name] = {}
    chart1ByAgg[a.aggregator_name][a.region] = a.registered_capacity_mw
  }
  const chart1Data = aggregatorNames.map((name) => ({
    name,
    ...(chart1ByAgg[name] ?? {}),
  }))

  // ── Chart 2: Bar — delivery_rate_pct by event_date (last 15 events), coloured by trigger ──
  const sortedEvents = data.events
    .slice()
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(-15)
  const chart2Data = sortedEvents.map((e) => ({
    event_date: e.event_date,
    delivery_rate_pct: e.delivery_rate_pct,
    trigger: e.trigger,
  }))

  // ── Chart 3: Bar — enrolled_mw by segment coloured by reason_for_participation ──
  const segmentNames = ['Manufacturing', 'Cold Storage', 'Data Centres', 'Shopping Centres', 'Agriculture Pumping']
  const chart3BySegReason: Record<string, { enrolled_mw: number; reason_for_participation: string }> = {}
  for (const s of data.segments) {
    if (!chart3BySegReason[s.segment]) {
      chart3BySegReason[s.segment] = { enrolled_mw: 0, reason_for_participation: s.reason_for_participation }
    }
    chart3BySegReason[s.segment].enrolled_mw += s.enrolled_mw
  }
  const chart3Data = segmentNames
    .filter((seg) => chart3BySegReason[seg])
    .map((seg) => ({
      segment: seg,
      enrolled_mw: Math.round(chart3BySegReason[seg].enrolled_mw * 10) / 10,
      reason_for_participation: chart3BySegReason[seg].reason_for_participation,
    }))

  // ── Chart 4: Bar — cost_effectiveness_score by program grouped by region ──
  const programNames = ['RERT', 'STEM', 'Emergency Demand Response', 'Industrial DSP']
  const chart4ByProg: Record<string, Record<string, number>> = {}
  for (const p of data.programs) {
    if (!chart4ByProg[p.program_name]) chart4ByProg[p.program_name] = {}
    chart4ByProg[p.program_name][p.region] = p.cost_effectiveness_score
  }
  const chart4Data = programNames.map((prog) => ({
    program: prog.length > 20 ? prog.substring(0, 18) + '…' : prog,
    full_program: prog,
    ...(chart4ByProg[prog] ?? {}),
  }))

  // ── Chart 5: Line — enrolled_capacity_gw by year for 3 scenarios ──
  const scenarioList = ['Base', 'High DSP', 'Technology Enabled']
  const chart5ByYear: Record<number, Record<string, number>> = {}
  for (const proj of data.projections) {
    if (!chart5ByYear[proj.year]) chart5ByYear[proj.year] = {}
    chart5ByYear[proj.year][proj.scenario] = proj.enrolled_capacity_gw
  }
  const chart5Data = Object.entries(chart5ByYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, values]) => ({ year: Number(year), ...values }))

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users size={28} className="text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Demand Response Aggregator Market Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sprint 129a — DRAM | Aggregators, Events, Customer Segments, Programs &amp; Projections
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Enrolled Capacity"
          value={`${Number(summary.total_enrolled_capacity_gw ?? 0).toFixed(2)} GW`}
          sub="Registered capacity across all aggregators and regions"
        />
        <KpiCard
          label="Avg Dispatch Success"
          value={`${Number(summary.avg_dispatch_success_pct ?? 0).toFixed(1)}%`}
          sub="Average dispatch success rate across all aggregators"
        />
        <KpiCard
          label="Total Events 2024"
          value={String(Number(summary.total_events_2024 ?? 0))}
          sub="Demand response events dispatched in 2024"
        />
        <KpiCard
          label="Market Value"
          value={`$${Number(summary.market_value_m ?? 0).toFixed(2)}M`}
          sub="Total event value across all 2024 events"
        />
      </div>

      {/* Chart 1: Bar — registered_capacity_mw by aggregator_name coloured by region */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 1: Registered Capacity (MW) by Aggregator and Region
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart1Data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis unit=" MW" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v.toFixed(1)} MW`} />
            <Legend />
            {['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].map((region) => (
              <Bar
                key={region}
                dataKey={region}
                stackId="a"
                fill={REGION_COLOURS[region] ?? '#6b7280'}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Bar — delivery_rate_pct by event_date (last 15), coloured by trigger */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 2: Delivery Rate (%) by Event Date — Last 15 Events (coloured by Trigger)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart2Data} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="event_date" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" />
            <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Delivery Rate']} />
            <Bar dataKey="delivery_rate_pct" name="Delivery Rate (%)">
              {chart2Data.map((entry) => (
                <Cell
                  key={`${entry.event_date}-${entry.trigger}`}
                  fill={TRIGGER_COLOURS[entry.trigger] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(TRIGGER_COLOURS).map(([trigger, colour]) => (
            <span key={trigger} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {trigger}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 3: Bar — enrolled_mw by segment coloured by reason_for_participation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 3: Total Enrolled MW by Customer Segment (coloured by Reason for Participation)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart3Data} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="segment" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
            <YAxis unit=" MW" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)} MW`, 'Enrolled MW']} />
            <Bar dataKey="enrolled_mw" name="Enrolled MW">
              {chart3Data.map((entry) => (
                <Cell
                  key={entry.segment}
                  fill={REASON_COLOURS[entry.reason_for_participation] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(REASON_COLOURS).map(([reason, colour]) => (
            <span key={reason} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {reason}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 4: Bar — cost_effectiveness_score by program grouped by region */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 4: Cost Effectiveness Score by Program and Region (0–100)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart4Data} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="program" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number) => `${v.toFixed(1)}`}
              labelFormatter={(_label, payload) =>
                payload?.[0]?.payload?.full_program ?? _label
              }
            />
            <Legend />
            {['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].map((region) => (
              <Bar
                key={region}
                dataKey={region}
                fill={REGION_COLOURS[region] ?? '#6b7280'}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Line — enrolled_capacity_gw by year for 3 scenarios */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 5: Enrolled Capacity (GW) by Year — 3 Scenarios (2025–2035)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chart5Data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis unit=" GW" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v.toFixed(3)} GW`} />
            <Legend />
            {scenarioList.map((scenario) => (
              <Line
                key={scenario}
                type="monotone"
                dataKey={scenario}
                stroke={SCENARIO_COLOURS[scenario] ?? '#6b7280'}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Summary
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Total Enrolled Capacity
            </dt>
            <dd className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
              {Number(summary.total_enrolled_capacity_gw ?? 0).toFixed(2)} GW
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Avg Dispatch Success
            </dt>
            <dd className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
              {Number(summary.avg_dispatch_success_pct ?? 0).toFixed(1)}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Total Events 2024
            </dt>
            <dd className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
              {Number(summary.total_events_2024 ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Market Value
            </dt>
            <dd className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
              ${Number(summary.market_value_m ?? 0).toFixed(2)}M
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Fastest Growing Segment
            </dt>
            <dd className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
              {String(summary.fastest_growing_segment ?? '—')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Aggregators Tracked
            </dt>
            <dd className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
              {data.aggregators.length}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
