// Sprint 58c — Energy Affordability & Household Bill Analytics

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { DollarSign } from 'lucide-react'
import {
  getEnergyAffordabilityDashboard,
  EnergyAffordabilityDashboard,
  EAHBillTrendRecord,
  EAHIncomeAffordabilityRecord,
  EAHSolarImpactRecord,
  EAHAssistanceProgramRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const STATE_COLOURS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#34d399',
  QLD: '#fbbf24',
  SA:  '#f87171',
  WA:  '#a78bfa',
  TAS: '#2dd4bf',
}

const COHORT_COLOURS: Record<string, string> = {
  BOTTOM_20PCT:  '#ef4444',
  LOWER_MIDDLE:  '#f97316',
  MIDDLE:        '#eab308',
  UPPER_MIDDLE:  '#22c55e',
  TOP_20PCT:     '#3b82f6',
}

const SOLAR_COLOURS: Record<string, string> = {
  NO_SOLAR:        '#6b7280',
  SOLAR_ONLY:      '#fbbf24',
  SOLAR_BATTERY:   '#34d399',
  VPP_PARTICIPANT: '#60a5fa',
}

const PROGRAM_TYPE_STYLE: Record<string, string> = {
  REBATE:         'bg-blue-900 text-blue-300 border border-blue-700',
  CONCESSION:     'bg-green-900 text-green-300 border border-green-700',
  PAYMENT_PLAN:   'bg-amber-900 text-amber-300 border border-amber-700',
  FREE_APPLIANCE: 'bg-purple-900 text-purple-300 border border-purple-700',
}

const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS']
const COHORT_LABELS: Record<string, string> = {
  BOTTOM_20PCT:  'Bottom 20%',
  LOWER_MIDDLE:  'Lower Middle',
  MIDDLE:        'Middle',
  UPPER_MIDDLE:  'Upper Middle',
  TOP_20PCT:     'Top 20%',
}
const SOLAR_LABELS: Record<string, string> = {
  NO_SOLAR:        'No Solar',
  SOLAR_ONLY:      'Solar Only',
  SOLAR_BATTERY:   'Solar + Battery',
  VPP_PARTICIPANT: 'VPP Participant',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  colour: string
  icon?: React.ReactNode
}

function KpiCard({ label, value, sub, colour, icon }: KpiCardProps) {
  return (
    <div className={`rounded-xl border ${colour} p-4 flex flex-col gap-1`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom tooltips
// ---------------------------------------------------------------------------

function BillTrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs space-y-1 shadow-xl">
      <p className="font-semibold text-white mb-1">Year {label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="font-medium text-white">${p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function SolarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs space-y-1 shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className={`font-medium ${p.value < 0 ? 'text-green-400' : 'text-white'}`}>
            {p.value < 0 ? '-' : ''}${Math.abs(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

function CohortTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs space-y-1 shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          <span className="text-gray-300">{COHORT_LABELS[p.name] ?? p.name}:</span>
          <span className="font-medium text-white">{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Star rating helper
// ---------------------------------------------------------------------------

function EffectivenessStars({ score }: { score: number }) {
  const full = Math.floor(score / 2)
  const half = score % 2 >= 1
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span className="text-amber-400 text-sm">
      {'★'.repeat(full)}
      {half ? '½' : ''}
      <span className="text-gray-600">{'★'.repeat(empty)}</span>
      <span className="ml-1 text-gray-400 text-xs">({score.toFixed(1)})</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EnergyAffordabilityAnalytics() {
  const [data, setData] = useState<EnergyAffordabilityDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeStates, setActiveStates] = useState<Set<string>>(new Set(STATES))
  const [activeCohortState, setActiveCohortState] = useState<string>('NSW')

  useEffect(() => {
    getEnergyAffordabilityDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Energy Affordability Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  // ------------- KPI calculations -------------
  const trends2024 = data.bill_trends.filter((r) => r.year === 2024)
  const avgNationalBill = trends2024.reduce((s, r) => s + r.avg_annual_bill_aud, 0) / trends2024.length
  const avgIncomePct = trends2024.reduce((s, r) => s + r.median_income_pct, 0) / trends2024.length
  const bottom20Burden = data.income_affordability
    .filter((r) => r.income_cohort === 'BOTTOM_20PCT')
    .reduce((s, r) => s + r.energy_burden_pct, 0) /
    data.income_affordability.filter((r) => r.income_cohort === 'BOTTOM_20PCT').length
  const totalAssistance = data.assistance_programs.reduce((s, r) => s + r.total_cost_m_aud, 0)

  // ------------- Bill trend chart data -------------
  const years = [2020, 2021, 2022, 2023, 2024]
  const billTrendByYear = years.map((year) => {
    const row: Record<string, number | string> = { year }
    STATES.forEach((state) => {
      const rec = data.bill_trends.find((r) => r.state === state && r.year === year)
      if (rec) row[state] = rec.avg_annual_bill_aud
    })
    return row
  })

  // ------------- Bill component chart data (2024) -------------
  const billComponentData = trends2024.map((r) => ({
    state: r.state,
    Network: r.network_charges_aud,
    Wholesale: r.wholesale_charges_aud,
    Environmental: r.environmental_charges_aud,
    'Retail Margin': r.retail_margin_aud,
  }))

  // ------------- Income cohort chart data -------------
  const cohortData = STATES.map((state) => {
    const row: Record<string, string | number> = { state }
    const cohorts = ['BOTTOM_20PCT', 'LOWER_MIDDLE', 'MIDDLE', 'UPPER_MIDDLE', 'TOP_20PCT']
    cohorts.forEach((cohort) => {
      const rec = data.income_affordability.find(
        (r) => r.state === state && r.income_cohort === cohort
      )
      if (rec) row[cohort] = rec.energy_burden_pct
    })
    return row
  })

  // ------------- Solar impact chart data (selected state) -------------
  const solarTypes = ['NO_SOLAR', 'SOLAR_ONLY', 'SOLAR_BATTERY', 'VPP_PARTICIPANT']
  const solarData = STATES.map((state) => {
    const row: Record<string, string | number> = { state }
    solarTypes.forEach((type) => {
      const rec = data.solar_impact.find(
        (r) => r.state === state && r.household_type === type
      )
      if (rec) row[type] = rec.net_energy_cost_aud
    })
    return row
  })

  const toggleState = (state: string) => {
    setActiveStates((prev) => {
      const next = new Set(prev)
      if (next.has(state)) {
        if (next.size > 1) next.delete(state)
      } else {
        next.add(state)
      }
      return next
    })
  }

  return (
    <div className="p-6 space-y-8 bg-gray-950 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <DollarSign className="text-emerald-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Energy Affordability & Household Bill Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Retail electricity bill trends, affordability by income cohort, solar/battery impacts, and bill assistance programs — 2020-2024
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Avg National Bill 2024"
          value={`$${avgNationalBill.toFixed(0)}`}
          sub="Average across 6 states"
          colour="border-emerald-700 bg-emerald-900/20"
          icon={<DollarSign size={14} />}
        />
        <KpiCard
          label="Bill as % of Median Income"
          value={`${avgIncomePct.toFixed(1)}%`}
          sub="National average 2024"
          colour="border-blue-700 bg-blue-900/20"
        />
        <KpiCard
          label="Bottom 20% Energy Burden"
          value={`${bottom20Burden.toFixed(1)}%`}
          sub="Avg income share spent on energy"
          colour="border-red-700 bg-red-900/20"
        />
        <KpiCard
          label="Total Assistance Spending"
          value={`$${totalAssistance.toFixed(0)}M`}
          sub={`${data.assistance_programs.length} programs across all states`}
          colour="border-amber-700 bg-amber-900/20"
        />
      </div>

      {/* Bill Trend Multi-line Chart */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Average Annual Electricity Bill Trend (AUD)</h2>
            <p className="text-xs text-gray-400 mt-0.5">2020–2024 by state</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATES.map((state) => (
              <button
                key={state}
                onClick={() => toggleState(state)}
                className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${
                  activeStates.has(state)
                    ? 'border-transparent text-gray-900'
                    : 'border-gray-600 text-gray-400 bg-transparent'
                }`}
                style={activeStates.has(state) ? { backgroundColor: STATE_COLOURS[state] } : {}}
              >
                {state}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={billTrendByYear} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `$${v.toLocaleString()}`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={70}
            />
            <Tooltip content={<BillTrendTooltip />} />
            <Legend
              formatter={(val) => <span style={{ color: STATE_COLOURS[val] ?? '#fff', fontSize: 12 }}>{val}</span>}
            />
            {STATES.filter((s) => activeStates.has(s)).map((state) => (
              <Line
                key={state}
                type="monotone"
                dataKey={state}
                stroke={STATE_COLOURS[state]}
                strokeWidth={2}
                dot={{ r: 4, fill: STATE_COLOURS[state] }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bill Component Stacked Bar */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Bill Component Breakdown — 2024</h2>
          <p className="text-xs text-gray-400 mt-0.5">Network / Wholesale / Environmental / Retail Margin (AUD)</p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={billComponentData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `$${v}`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={60}
            />
            <Tooltip
              formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name]}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563', borderRadius: '8px' }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend formatter={(v) => <span className="text-xs text-gray-300">{v}</span>} />
            <Bar dataKey="Network" stackId="a" fill="#60a5fa" />
            <Bar dataKey="Wholesale" stackId="a" fill="#fbbf24" />
            <Bar dataKey="Environmental" stackId="a" fill="#34d399" />
            <Bar dataKey="Retail Margin" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Income Cohort Affordability Chart */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Energy Burden by Income Cohort &amp; State</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Energy spend as % of annual household income — higher burden = worse affordability
          </p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={cohortData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={50}
            />
            <Tooltip content={<CohortTooltip />} />
            <Legend
              formatter={(v) => (
                <span style={{ color: COHORT_COLOURS[v] ?? '#fff', fontSize: 12 }}>
                  {COHORT_LABELS[v] ?? v}
                </span>
              )}
            />
            <ReferenceLine y={6} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Hardship threshold 6%', fill: '#ef4444', fontSize: 10 }} />
            {['BOTTOM_20PCT', 'LOWER_MIDDLE', 'MIDDLE', 'UPPER_MIDDLE', 'TOP_20PCT'].map((cohort) => (
              <Bar key={cohort} dataKey={cohort} fill={COHORT_COLOURS[cohort]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Solar Impact Comparison */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Solar &amp; Battery Impact on Net Energy Cost</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Net annual cost (AUD) after solar exports — negative values mean net earners. Grouped by state.
          </p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={solarData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `$${v.toLocaleString()}`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={75}
            />
            <Tooltip content={<SolarTooltip />} />
            <Legend
              formatter={(v) => (
                <span style={{ color: SOLAR_COLOURS[v] ?? '#fff', fontSize: 12 }}>
                  {SOLAR_LABELS[v] ?? v}
                </span>
              )}
            />
            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
            {['NO_SOLAR', 'SOLAR_ONLY', 'SOLAR_BATTERY', 'VPP_PARTICIPANT'].map((type) => (
              <Bar key={type} dataKey={type} fill={SOLAR_COLOURS[type]} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        {/* Solar adoption mini-summary */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {solarTypes.slice(1).map((type) => {
            const avg =
              data.solar_impact
                .filter((r) => r.household_type === type)
                .reduce((s, r) => s + r.adoption_pct, 0) /
              data.solar_impact.filter((r) => r.household_type === type).length
            return (
              <div key={type} className="rounded-lg bg-gray-800 border border-gray-700 p-3">
                <p className="text-xs text-gray-400">{SOLAR_LABELS[type]}</p>
                <p className="text-lg font-bold" style={{ color: SOLAR_COLOURS[type] }}>
                  {avg.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">avg adoption</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Assistance Programs Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Bill Assistance Programs</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            State-based rebates, concessions, payment plans, and appliance programs
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Program</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">State</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Eligible Cohort</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Rebate</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Recipients</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Total Cost</th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Type</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Effectiveness</th>
              </tr>
            </thead>
            <tbody>
              {data.assistance_programs
                .slice()
                .sort((a, b) => b.effectiveness_score - a.effectiveness_score)
                .map((prog, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-white font-medium">{prog.program_name}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold text-gray-900"
                        style={{ backgroundColor: STATE_COLOURS[prog.state] ?? '#6b7280' }}
                      >
                        {prog.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-300 text-xs max-w-[180px]">{prog.eligible_cohort}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-medium">
                      {prog.rebate_aud > 0 ? `$${prog.rebate_aud.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-300">{prog.recipients_k}k</td>
                    <td className="py-2.5 px-3 text-right text-amber-400 font-medium">
                      ${prog.total_cost_m_aud.toFixed(1)}M
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${PROGRAM_TYPE_STYLE[prog.program_type] ?? 'bg-gray-700 text-gray-300'}`}
                      >
                        {prog.program_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <EffectivenessStars score={prog.effectiveness_score} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {/* Summary totals row */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400 border-t border-gray-800 pt-3">
          <span>
            Total recipients:{' '}
            <span className="text-white font-semibold">
              {data.assistance_programs.reduce((s, p) => s + p.recipients_k, 0)}k households
            </span>
          </span>
          <span>
            Total spending:{' '}
            <span className="text-amber-400 font-semibold">
              ${data.assistance_programs.reduce((s, p) => s + p.total_cost_m_aud, 0).toFixed(1)}M AUD
            </span>
          </span>
          <span>
            Avg effectiveness:{' '}
            <span className="text-white font-semibold">
              {(
                data.assistance_programs.reduce((s, p) => s + p.effectiveness_score, 0) /
                data.assistance_programs.length
              ).toFixed(1)}
              /10
            </span>
          </span>
        </div>
      </div>

      {/* Footer timestamp */}
      <p className="text-xs text-gray-600 text-right">
        Data as at: {new Date(data.timestamp).toLocaleString('en-AU')}
      </p>
    </div>
  )
}
