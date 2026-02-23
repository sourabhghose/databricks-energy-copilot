import { useEffect, useState } from 'react'
import { Network } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ZAxis,
} from 'recharts'
import {
  getTransmissionAccessReformDashboard,
  TARADashboard,
} from '../api/client'

const STATUS_COLORS: Record<string, string> = {
  Implemented: '#22c55e',
  Consultation: '#f59e0b',
  Proposed:     '#6366f1',
  'In Trial':   '#06b6d4',
}

const POSITION_COLORS: Record<string, string> = {
  Supportive:  '#22c55e',
  Opposed:     '#ef4444',
  Neutral:     '#9ca3af',
  Conditional: '#f59e0b',
}

const SCENARIO_COLORS: Record<string, string> = {
  'Status Quo':    '#9ca3af',
  'Full COGATI':   '#6366f1',
  'Partial Reform':'#f59e0b',
  'REZ Model':     '#22c55e',
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function TransmissionAccessReformAnalytics() {
  const [data, setData] = useState<TARADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTransmissionAccessReformDashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Network size={24} className="mr-2 animate-pulse" />
        Loading Transmission Access Reform Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="p-6 text-red-500">
        Error: {error ?? 'No data returned'}
      </div>
    )
  }

  const { reforms, congestion, price_impacts, stakeholders, summary } = data

  // Chart 1: Estimated benefit by reform_name, coloured by status
  const reformBenefitData = [...reforms]
    .sort((a, b) => b.estimated_benefit_m - a.estimated_benefit_m)
    .map((r) => ({ name: r.reform_name, benefit: r.estimated_benefit_m, status: r.status }))

  // Chart 2: Top 12 congestion constraints by annual cost, sorted desc
  const top12Congestion = [...congestion]
    .sort((a, b) => b.annual_congestion_cost_m - a.annual_congestion_cost_m)
    .slice(0, 12)
    .map((c) => ({ name: c.constraint_id, cost: c.annual_congestion_cost_m }))

  // Chart 3: Consumer benefit by year for 4 scenarios (line)
  const scenarios = ['Status Quo', 'Full COGATI', 'Partial Reform', 'REZ Model']
  const years = [...new Set(price_impacts.map((p) => p.year))].sort()
  const benefitByYear = years.map((yr) => {
    const row: Record<string, string | number> = { year: yr }
    scenarios.forEach((sc) => {
      const rec = price_impacts.find((p) => p.year === yr && p.scenario === sc)
      if (rec) row[sc] = rec.consumer_benefit_m
    })
    return row
  })

  // Chart 4: Submission count by stakeholder coloured by position
  const stakeholderData = [...stakeholders]
    .sort((a, b) => b.submission_count - a.submission_count)
    .map((s) => ({ name: s.stakeholder, submissions: s.submission_count, position: s.position }))

  // Chart 5: Scatter — relief_under_reform_pct vs renewable_curtailment_pct, size = congestion_cost
  const scatterData = congestion.map((c) => ({
    x: c.renewable_curtailment_pct,
    y: c.relief_under_reform_pct,
    z: c.annual_congestion_cost_m,
    name: c.constraint_id,
  }))

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Network size={28} className="text-indigo-500" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Transmission Access Reform Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            COGATI, TNUoS Reform, REZ Access and congestion relief across the Australian NEM
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Reforms Tracked"
          value={String(summary.total_reforms ?? '')}
          sub="Active rule changes"
        />
        <KpiCard
          label="Active Consultations"
          value={String(summary.active_consultations ?? '')}
          sub="In AEMC/AEMO process"
        />
        <KpiCard
          label="Annual Congestion Cost"
          value={`$${Number(summary.annual_congestion_cost_m ?? 0).toFixed(0)}M`}
          sub="NEM-wide estimate"
        />
        <KpiCard
          label="Projected Consumer Benefit"
          value={`$${Number(summary.projected_consumer_benefit_m ?? 0).toFixed(0)}M`}
          sub={`Leading: ${String(summary.leading_reform ?? '')}`}
        />
      </div>

      {/* Chart 1: Reform Benefit by Reform Name */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Estimated Consumer Benefit by Reform (A$M) — coloured by status
        </h2>
        <ResponsiveContainer width="100%" height={440}>
          <BarChart
            data={reformBenefitData}
            layout="vertical"
            margin={{ left: 200, right: 30, top: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => `$${v}M`} />
            <YAxis type="category" dataKey="name" width={195} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => [`$${v}M`, 'Estimated Benefit']} />
            <Bar dataKey="benefit" name="Estimated Benefit (A$M)">
              {reformBenefitData.map((entry, idx) => (
                <Cell key={idx} fill={STATUS_COLORS[entry.status] ?? '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {status}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Top 12 Constraints by Annual Congestion Cost */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Top 12 Constraints by Annual Congestion Cost (A$M) — sorted descending
        </h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart
            data={top12Congestion}
            layout="vertical"
            margin={{ left: 180, right: 30, top: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => `$${v}M`} />
            <YAxis type="category" dataKey="name" width={175} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => [`$${v}M`, 'Annual Congestion Cost']} />
            <Bar dataKey="cost" name="Annual Congestion Cost (A$M)" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Consumer Benefit by Year — 4 Scenarios */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Projected Consumer Benefit by Year (A$M) — 4 Reform Scenarios
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={benefitByYear} margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={(v) => `$${v}M`} />
            <Tooltip formatter={(v: number) => [`$${v}M`, 'Consumer Benefit']} />
            <Legend />
            {scenarios.map((sc) => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                stroke={SCENARIO_COLORS[sc]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Submissions by Stakeholder coloured by position */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Stakeholder Submissions — coloured by position
        </h2>
        <ResponsiveContainer width="100%" height={440}>
          <BarChart
            data={stakeholderData}
            layout="vertical"
            margin={{ left: 210, right: 30, top: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={205} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => [v, 'Submissions']} />
            <Bar dataKey="submissions" name="Submission Count">
              {stakeholderData.map((entry, idx) => (
                <Cell key={idx} fill={POSITION_COLORS[entry.position] ?? '#9ca3af'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {Object.entries(POSITION_COLORS).map(([pos, color]) => (
            <span key={pos} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {pos}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 5: Scatter — Relief vs Renewable Curtailment, dot size = annual congestion cost */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Relief Under Reform vs Renewable Curtailment — dot size = annual congestion cost
        </h2>
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name="Renewable Curtailment (%)"
              label={{ value: 'Renewable Curtailment (%)', position: 'insideBottom', offset: -4, fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Relief Under Reform (%)"
              label={{ value: 'Relief Under Reform (%)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <ZAxis type="number" dataKey="z" range={[60, 600]} name="Annual Congestion Cost (A$M)" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null
                const d = payload[0]?.payload
                return (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 text-xs shadow">
                    <p className="font-semibold mb-1">{d.name}</p>
                    <p>Curtailment: {d.x}%</p>
                    <p>Relief: {d.y}%</p>
                    <p>Congestion Cost: A${d.z}M</p>
                  </div>
                )
              }}
            />
            <Scatter data={scatterData} fill="#6366f1" fillOpacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Summary
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(summary).map(([key, val]) => (
            <div key={key} className="flex flex-col">
              <dt className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
