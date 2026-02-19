import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import {
  api,
  EnergyPovertyDashboard,
  EnergyPovertyHardshipRecord,
  CoalWorkerTransitionRecord,
  EnergyAffordabilityRecord,
  JustTransitionProgramRecord,
} from '../api/client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  sub,
  valueColor,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold" style={{ color: valueColor ?? '#fff' }}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  ACTIVE:    { bg: '#15803d33', text: '#4ade80' },
  COMPLETED: { bg: '#37415133', text: '#9ca3af' },
  PLANNED:   { bg: '#1d4ed833', text: '#60a5fa' },
  PLANNING:  { bg: '#1d4ed833', text: '#60a5fa' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: '#37415133', text: '#9ca3af' }
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: s.bg, color: s.text }}
    >
      {status}
    </span>
  )
}

// ── Program type badge ────────────────────────────────────────────────────────

const PROGRAM_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  WORKER_RETRAINING:        { bg: '#1d4ed833', text: '#60a5fa' },
  COMMUNITY_FUND:           { bg: '#15803d33', text: '#4ade80' },
  CLEAN_ENERGY_ACCESS:      { bg: '#a16207 33', text: '#fbbf24' },
  ECONOMIC_DIVERSIFICATION: { bg: '#6b21a833', text: '#c084fc' },
}

function ProgramTypeBadge({ type }: { type: string }) {
  const s = PROGRAM_TYPE_STYLES[type] ?? { bg: '#37415133', text: '#9ca3af' }
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.text }}
    >
      {type.replace(/_/g, ' ')}
    </span>
  )
}

// ── Wage ratio cell ───────────────────────────────────────────────────────────

function WageRatioCell({ ratio }: { ratio: number }) {
  if (ratio === 0) return <span className="text-gray-500 text-sm">N/A</span>
  const color = ratio < 0.8 ? '#f87171' : ratio < 0.95 ? '#fbbf24' : '#4ade80'
  return <span style={{ color }} className="font-semibold text-sm">{ratio.toFixed(2)}</span>
}

// ── Hardship trend chart data builder ────────────────────────────────────────

function buildHardshipChartData(records: EnergyPovertyHardshipRecord[]) {
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  return quarters.map((q) => {
    const row: Record<string, string | number> = { quarter: q }
    const forQ = records.filter((r) => r.quarter === q)
    for (const r of forQ) {
      row[r.state] = r.hardship_rate_pct
    }
    return row
  })
}

const STATE_COLORS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#4ade80',
  QLD: '#fbbf24',
  SA:  '#f87171',
  WA:  '#c084fc',
}

// ── Outcomes score bar ────────────────────────────────────────────────────────

function OutcomesBar({ score }: { score: number }) {
  const color = score >= 7.5 ? '#4ade80' : score >= 6 ? '#fbbf24' : '#f87171'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-700 rounded-full h-2">
        <div
          className="h-2 rounded-full"
          style={{ width: `${(score / 10) * 100}%`, background: color }}
        />
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{score.toFixed(1)}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EnergyPoverty() {
  const [data, setData] = useState<EnergyPovertyDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getEnergyPovertyDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Energy Poverty data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data.'}
      </div>
    )
  }

  const chartData = buildHardshipChartData(data.hardship_records)
  const states = [...new Set(data.hardship_records.map((r) => r.state))]

  return (
    <div className="p-6 bg-gray-900 min-h-full text-gray-100">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Heart className="text-rose-400" size={26} />
          <h1 className="text-2xl font-bold text-white">
            Energy Poverty &amp; Just Transition Analytics
          </h1>
        </div>
        <p className="text-sm text-gray-400 ml-9">
          Household energy hardship, affordability metrics, coal worker transition programs and
          just transition funding across Australia.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="National Hardship Rate"
          value={data.national_hardship_rate_pct.toFixed(1)}
          unit="%"
          sub="Average across states & quarters"
          valueColor="#f87171"
        />
        <KpiCard
          label="Workers in Transition"
          value={data.total_workers_in_transition.toLocaleString()}
          sub="Excluding completed programs"
          valueColor="#fbbf24"
        />
        <KpiCard
          label="Total Transition Fund"
          value={`$${data.total_transition_fund_b_aud.toFixed(2)}B`}
          unit="AUD"
          sub="Across all coal closure programs"
          valueColor="#60a5fa"
        />
        <KpiCard
          label="Low-Income Solar Gap"
          value={data.low_income_solar_gap_pct.toFixed(1)}
          unit="pp"
          sub="Gap vs. overall solar penetration"
          valueColor="#c084fc"
        />
      </div>

      {/* Hardship Trend Chart */}
      <section className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Energy Hardship Rate by State — 2024 Quarters (%)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              domain={[5, 20]}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
              formatter={(val: number) => [`${val.toFixed(1)}%`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {states.map((state) => (
              <Line
                key={state}
                type="monotone"
                dataKey={state}
                stroke={STATE_COLORS[state] ?? '#e5e7eb'}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Coal Worker Transition Table */}
      <section className="bg-gray-800 rounded-lg p-5 mb-6 overflow-x-auto">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Coal Worker Transition Programs
        </h2>
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-700">
              <th className="py-2 pr-4">Facility</th>
              <th className="py-2 pr-4">State</th>
              <th className="py-2 pr-4">Closure</th>
              <th className="py-2 pr-4 text-right">Workers</th>
              <th className="py-2 pr-4 text-right">Retraining</th>
              <th className="py-2 pr-4 text-right">Reemployed</th>
              <th className="py-2 pr-4 text-right">Wage Ratio</th>
              <th className="py-2 pr-4 text-right">Fund ($M AUD)</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.worker_transition.map((r: CoalWorkerTransitionRecord) => (
              <tr
                key={r.facility_name}
                className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
              >
                <td className="py-2.5 pr-4 text-gray-100 font-medium">{r.facility_name}</td>
                <td className="py-2.5 pr-4">
                  <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-xs">{r.state}</span>
                </td>
                <td className="py-2.5 pr-4 text-gray-300">{r.closure_year}</td>
                <td className="py-2.5 pr-4 text-right text-gray-200">{r.workers_affected.toLocaleString()}</td>
                <td className="py-2.5 pr-4 text-right text-gray-200">{r.retraining_enrolled.toLocaleString()}</td>
                <td className="py-2.5 pr-4 text-right text-gray-200">{r.reemployed.toLocaleString()}</td>
                <td className="py-2.5 pr-4 text-right">
                  <WageRatioCell ratio={r.avg_reemployment_wage_ratio} />
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-200">
                  ${r.transition_fund_m_aud.toFixed(0)}M
                </td>
                <td className="py-2.5">
                  <StatusBadge status={r.program_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Affordability Table */}
      <section className="bg-gray-800 rounded-lg p-5 mb-6 overflow-x-auto">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Energy Affordability by State — 2024
        </h2>
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-700">
              <th className="py-2 pr-4">State</th>
              <th className="py-2 pr-4 text-right">Median Bill</th>
              <th className="py-2 pr-4 text-right">Low-Income Bill</th>
              <th className="py-2 pr-4 text-right">% Income (Med)</th>
              <th className="py-2 pr-4 text-right">% Income (Low)</th>
              <th className="py-2 pr-4 text-right">Solar Pen. (Low Inc.)</th>
              <th className="py-2 text-right">Concession Cov.</th>
            </tr>
          </thead>
          <tbody>
            {data.affordability.map((r: EnergyAffordabilityRecord) => (
              <tr
                key={r.state}
                className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
              >
                <td className="py-2.5 pr-4 font-semibold text-gray-100">{r.state}</td>
                <td className="py-2.5 pr-4 text-right text-gray-200">
                  ${r.median_bill_aud.toFixed(0)}
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-200">
                  ${r.low_income_bill_aud.toFixed(0)}
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <span className="text-green-400 font-medium">{r.bill_as_pct_income_median.toFixed(1)}%</span>
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <span
                    className="font-medium"
                    style={{ color: r.bill_as_pct_income_low > 15 ? '#f87171' : r.bill_as_pct_income_low > 12 ? '#fbbf24' : '#4ade80' }}
                  >
                    {r.bill_as_pct_income_low.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-200">
                  {r.solar_penetration_low_income_pct.toFixed(1)}%
                </td>
                <td className="py-2.5 text-right text-gray-200">
                  {r.concession_coverage_pct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Just Transition Programs Table */}
      <section className="bg-gray-800 rounded-lg p-5 overflow-x-auto">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Just Transition Programs
        </h2>
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-700">
              <th className="py-2 pr-4">Program</th>
              <th className="py-2 pr-4">State</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4 text-right">Budget ($M)</th>
              <th className="py-2 pr-4 text-right">Beneficiaries</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Outcomes Score</th>
            </tr>
          </thead>
          <tbody>
            {data.just_transition_programs.map((r: JustTransitionProgramRecord) => (
              <tr
                key={r.program_id}
                className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
              >
                <td className="py-2.5 pr-4">
                  <div className="text-gray-100 font-medium leading-tight">{r.program_name}</div>
                  <div className="text-xs text-gray-500">{r.region}</div>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-xs">{r.state}</span>
                </td>
                <td className="py-2.5 pr-4">
                  <ProgramTypeBadge type={r.program_type} />
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-200">
                  ${r.budget_m_aud.toFixed(0)}M
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-200">
                  {r.beneficiaries.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4">
                  <StatusBadge status={r.status} />
                </td>
                <td className="py-2.5">
                  <OutcomesBar score={r.outcomes_score} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
