import { useEffect, useState } from 'react'
import { Scale } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  getNEMPostReformMarketDesignDashboard,
  type PRDDashboard,
  type PRDReformMilestoneRecord,
  type PRDMarketOutcomeRecord,
  type PRDDesignElementRecord,
  type PRDStakeholderSentimentRecord,
  type PRDScenarioOutcomeRecord,
} from '../api/client'

const STATUS_COLORS: Record<string, string> = {
  IMPLEMENTED: 'bg-green-600',
  IN_PROGRESS: 'bg-blue-600',
  PROPOSED: 'bg-yellow-600',
  DEFERRED: 'bg-gray-600',
}

const COMPLEXITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-700 text-green-200',
  MEDIUM: 'bg-yellow-700 text-yellow-200',
  HIGH: 'bg-orange-700 text-orange-200',
  VERY_HIGH: 'bg-red-700 text-red-200',
}

const ASSESSMENT_COLORS: Record<string, string> = {
  ON_TRACK: 'text-green-400',
  AHEAD: 'text-blue-400',
  BEHIND: 'text-red-400',
  ACHIEVED: 'text-emerald-400',
}

const PACKAGE_COLORS: Record<string, string> = {
  'Baseline Reform': '#3b82f6',
  'Accelerated Reform': '#10b981',
  'Conservative Reform': '#f59e0b',
  'Net Zero Fast Track': '#a855f7',
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-gray-500 text-xs">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-600'
  return (
    <span className={`${color} text-white text-xs px-2 py-0.5 rounded-full font-medium`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function ImpactBar({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const color = score >= 8.5 ? 'bg-red-500' : score >= 7 ? 'bg-amber-500' : 'bg-blue-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-300 text-xs">{score.toFixed(1)}</span>
    </div>
  )
}

function ReformMilestonesTable({ milestones }: { milestones: PRDReformMilestoneRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold mb-3">Reform Milestones</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">ID</th>
              <th className="text-left py-2 pr-3">Reform</th>
              <th className="text-left py-2 pr-3">Category</th>
              <th className="text-left py-2 pr-3">Status</th>
              <th className="text-left py-2 pr-3">Target Date</th>
              <th className="text-right py-2 pr-3">Stakeholder Support</th>
              <th className="text-left py-2 pr-3">Impact Score</th>
              <th className="text-center py-2">AEMO Lead</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((m) => (
              <tr key={m.reform_id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-3 text-gray-400 font-mono text-xs">{m.reform_id}</td>
                <td className="py-2 pr-3 text-white font-medium max-w-xs">{m.name}</td>
                <td className="py-2 pr-3">
                  <span className="text-gray-300 text-xs bg-gray-700 px-2 py-0.5 rounded">
                    {m.category}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <StatusBadge status={m.status} />
                </td>
                <td className="py-2 pr-3 text-gray-300 text-xs">{m.target_date}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{m.stakeholder_support.toFixed(1)}%</td>
                <td className="py-2 pr-3">
                  <ImpactBar score={m.impact_score} />
                </td>
                <td className="py-2 text-center text-xs">
                  {m.aemo_lead ? (
                    <span className="text-green-400">Yes</span>
                  ) : (
                    <span className="text-gray-500">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MarketOutcomesChart({ outcomes }: { outcomes: PRDMarketOutcomeRecord[] }) {
  // Show a subset for readability in the bar chart
  const chartData = outcomes.slice(0, 8).map((o) => ({
    name: o.metric.length > 18 ? o.metric.slice(0, 18) + '…' : o.metric,
    'Pre-Reform': o.pre_reform_value,
    'Post-Reform': o.post_reform_value,
    Target: o.target_value,
    assessment: o.assessment,
  }))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold mb-3">Market Outcomes: Pre vs Post Reform</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: '8px' }} />
          <Bar dataKey="Pre-Reform" fill="#6b7280" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Post-Reform" fill="#3b82f6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {outcomes.map((o) => (
          <div key={o.metric} className="flex items-center justify-between text-xs bg-gray-700 rounded px-2 py-1">
            <span className="text-gray-400 truncate max-w-[110px]">{o.metric}</span>
            <span className={`ml-2 font-semibold ${ASSESSMENT_COLORS[o.assessment] ?? 'text-gray-300'}`}>
              {o.assessment.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StakeholderSentimentChart({ sentiments }: { sentiments: PRDStakeholderSentimentRecord[] }) {
  const byCategory: Record<string, number[]> = {}
  for (const s of sentiments) {
    if (!byCategory[s.category]) byCategory[s.category] = []
    byCategory[s.category].push(s.support_score)
  }
  const chartData = Object.entries(byCategory).map(([cat, scores]) => ({
    category: cat,
    'Avg Support': parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)),
    'Max Support': Math.max(...scores),
    'Min Support': Math.min(...scores),
  }))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold mb-3">Stakeholder Support by Category</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="category" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis domain={[0, 10]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af' }} />
          <ReferenceLine y={7} stroke="#10b981" strokeDasharray="4 2" label={{ value: 'Supportive', fill: '#10b981', fontSize: 10 }} />
          <Bar dataKey="Avg Support" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Max Support" fill="#10b981" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Min Support" fill="#ef4444" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-1 pr-3">Stakeholder</th>
              <th className="text-left py-1 pr-3">Category</th>
              <th className="text-right py-1 pr-3">Support</th>
              <th className="text-left py-1 pr-3">Engagement</th>
              <th className="text-right py-1">Submissions</th>
            </tr>
          </thead>
          <tbody>
            {sentiments.map((s) => (
              <tr key={s.stakeholder_group} className="border-b border-gray-700">
                <td className="py-1 pr-3 text-white">{s.stakeholder_group}</td>
                <td className="py-1 pr-3 text-gray-400">{s.category}</td>
                <td className="py-1 pr-3 text-right font-semibold text-blue-400">{s.support_score.toFixed(1)}</td>
                <td className="py-1 pr-3 text-gray-300">{s.engagement_level}</td>
                <td className="py-1 text-right text-gray-300">{s.submission_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ScenarioOutcomesChart({ scenarios }: { scenarios: PRDScenarioOutcomeRecord[] }) {
  const packages = [...new Set(scenarios.map((s) => s.reform_package))]
  const years = [...new Set(scenarios.map((s) => s.year))].sort()

  const chartData = years.map((year) => {
    const row: Record<string, number | string> = { year: String(year) }
    for (const pkg of packages) {
      const match = scenarios.find((s) => s.reform_package === pkg && s.year === year)
      if (match) row[pkg] = match.wholesale_price_aud_mwh
    }
    return row
  })

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold mb-1">Scenario Wholesale Price Outlook (AUD/MWh)</h2>
      <p className="text-gray-400 text-xs mb-3">Projected wholesale prices by reform scenario package through 2050</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" AUD" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(val: number) => [`${val} AUD/MWh`]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af' }} />
          {packages.map((pkg) => (
            <Line
              key={pkg}
              type="monotone"
              dataKey={pkg}
              stroke={PACKAGE_COLORS[pkg] ?? '#6b7280'}
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

function DesignElementsTable({ elements }: { elements: PRDDesignElementRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold mb-3">Market Design Elements</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Element</th>
              <th className="text-left py-2 pr-3">Category</th>
              <th className="text-left py-2 pr-3">Rationale</th>
              <th className="text-left py-2 pr-3">Complexity</th>
              <th className="text-right py-2 pr-3">Expected Benefit (AUD M)</th>
              <th className="text-right py-2 pr-3">Actual Benefit (AUD M)</th>
              <th className="text-left py-2">International Precedent</th>
            </tr>
          </thead>
          <tbody>
            {elements.map((e) => (
              <tr key={e.element} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-3 text-white font-medium">{e.element}</td>
                <td className="py-2 pr-3">
                  <span className="text-gray-300 text-xs bg-gray-700 px-2 py-0.5 rounded">{e.category}</span>
                </td>
                <td className="py-2 pr-3 text-gray-400 text-xs max-w-[180px]">{e.rationale}</td>
                <td className="py-2 pr-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${COMPLEXITY_COLORS[e.implementation_complexity] ?? 'bg-gray-700 text-gray-200'}`}>
                    {e.implementation_complexity.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-amber-400 font-semibold">
                  {e.expected_benefit_aud_m.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right text-green-400">
                  {e.actual_benefit_aud_m != null ? e.actual_benefit_aud_m.toLocaleString() : <span className="text-gray-500">—</span>}
                </td>
                <td className="py-2 text-gray-400 text-xs">
                  {e.international_precedent ?? <span className="text-gray-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function NEMPostReformMarketDesignAnalytics() {
  const [data, setData] = useState<PRDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNEMPostReformMarketDesignDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading NEM Post-Reform Market Design Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">Error loading dashboard: {error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const summary = data.summary
  const implementedCount = Number(summary.implemented_count ?? 0)
  const inProgressCount = Number(summary.in_progress_count ?? 0)
  const totalReforms = Number(summary.total_reforms ?? 0)
  const avgSupport = Number(summary.avg_stakeholder_support_pct ?? 0)
  const highestImpact = String(summary.highest_impact_reform ?? '')
  const totalBenefit = Number(summary.total_expected_benefit_aud_m ?? 0)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Scale className="text-indigo-400" size={28} />
        <div>
          <h1 className="text-white text-2xl font-bold">NEM Post-Reform Market Design Analytics</h1>
          <p className="text-gray-400 text-sm">Australian National Electricity Market — Reform Evaluation & Scenario Analysis</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Reforms Tracked"
          value={String(totalReforms)}
          sub={`${inProgressCount} in progress`}
        />
        <KpiCard
          label="Implemented"
          value={String(implementedCount)}
          sub={`${Math.round((implementedCount / totalReforms) * 100)}% of total`}
        />
        <KpiCard
          label="Avg Stakeholder Support"
          value={`${avgSupport.toFixed(1)}%`}
          sub="across all reforms"
        />
        <KpiCard
          label="Highest Impact Reform"
          value={highestImpact}
          sub={`Total expected benefit: AUD ${(totalBenefit / 1000).toFixed(1)}B`}
        />
      </div>

      {/* Reform Milestones Table */}
      <div className="mb-6">
        <ReformMilestonesTable milestones={data.reform_milestones} />
      </div>

      {/* Market Outcomes Chart */}
      <div className="mb-6">
        <MarketOutcomesChart outcomes={data.market_outcomes} />
      </div>

      {/* Two column: Stakeholder + Scenario */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <StakeholderSentimentChart sentiments={data.stakeholder_sentiments} />
        <ScenarioOutcomesChart scenarios={data.scenario_outcomes} />
      </div>

      {/* Design Elements Table */}
      <div className="mb-6">
        <DesignElementsTable elements={data.design_elements} />
      </div>
    </div>
  )
}
