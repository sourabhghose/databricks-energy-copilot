import { useEffect, useState } from 'react'
import { BookOpen, FileText, TrendingUp, DollarSign, Users } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import { getAemcRuleChangeDashboard } from '../api/client'
import type { AEMCRuleDashboard } from '../api/client'

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
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4">
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
// Chart section wrapper
// ---------------------------------------------------------------------------

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">{title}</h2>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const COLOURS = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
  '#a855f7', '#eab308',
]

const IMPACT_COLOURS: Record<string, string> = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#10b981',
}

const STATUS_COLOURS: Record<string, string> = {
  Completed: '#10b981',
  'In Progress': '#3b82f6',
  'Draft Determination': '#f59e0b',
  'Final Determination': '#8b5cf6',
  Withdrawn: '#6b7280',
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AemcRuleChangeAnalytics() {
  const [data, setData] = useState<AEMCRuleDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAemcRuleChangeDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <p className="text-gray-400 animate-pulse">Loading AEMC Rule Change dashboard…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <p className="text-red-400">Error loading data: {error}</p>
      </div>
    )
  }

  // ── Chart 1: Rules by category coloured by impact_level ─────────────────
  const categoryImpactMap: Record<string, Record<string, number>> = {}
  for (const rule of data.rules) {
    if (!categoryImpactMap[rule.category]) {
      categoryImpactMap[rule.category] = { High: 0, Medium: 0, Low: 0 }
    }
    categoryImpactMap[rule.category][rule.impact_level] += 1
  }
  const chart1Data = Object.entries(categoryImpactMap).map(([category, impacts]) => ({
    category: category.replace(' ', '\n'),
    ...impacts,
  }))

  // ── Chart 2: Top 15 consultations by submissions_received (sorted desc) ──
  const chart2Data = [...data.consultations]
    .sort((a, b) => b.submissions_received - a.submissions_received)
    .slice(0, 15)
    .map((c) => ({
      label: `${c.rule_number} (${c.consultation_round.split(' ')[0]})`,
      submissions: c.submissions_received,
    }))

  // ── Chart 3: Timeline — rules_initiated vs rules_completed by year ────────
  const yearAgg: Record<number, { rules_initiated: number; rules_completed: number }> = {}
  for (const rec of data.timeline) {
    if (!yearAgg[rec.year]) yearAgg[rec.year] = { rules_initiated: 0, rules_completed: 0 }
    yearAgg[rec.year].rules_initiated += rec.rules_initiated
    yearAgg[rec.year].rules_completed += rec.rules_completed
  }
  const chart3Data = Object.entries(yearAgg)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, vals]) => ({
      year: String(year),
      'Rules Initiated': vals.rules_initiated,
      'Rules Completed': vals.rules_completed,
    }))

  // ── Chart 4: Implementation estimated_benefit_m_aud by rule (sorted desc) ─
  const chart4Data = [...data.implementations]
    .sort((a, b) => b.estimated_benefit_m_aud - a.estimated_benefit_m_aud)
    .map((impl) => ({
      name: impl.rule_name.split(' ').slice(0, 3).join(' '),
      benefit: impl.estimated_benefit_m_aud,
    }))

  // ── Chart 5: Rules by status and category (grouped, horizontal) ───────────
  const statusCategoryMap: Record<string, Record<string, number>> = {}
  const allStatuses = Array.from(new Set(data.rules.map((r) => r.status)))
  for (const rule of data.rules) {
    if (!statusCategoryMap[rule.category]) {
      statusCategoryMap[rule.category] = {}
      for (const s of allStatuses) statusCategoryMap[rule.category][s] = 0
    }
    statusCategoryMap[rule.category][rule.status] += 1
  }
  const chart5Data = Object.entries(statusCategoryMap).map(([category, statuses]) => ({
    category,
    ...statuses,
  }))

  const { summary } = data

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen size={24} className="text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-white">
            AEMC Rule Change Analytics
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Australian Energy Market Commission — rule change pipeline, consultations &amp; implementation impact
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total Rules"
          value={String(summary.total_rules)}
          sub="Across all categories"
          icon={FileText}
          color="bg-amber-600"
        />
        <KpiCard
          title="Rules In Progress"
          value={String(summary.rules_in_progress)}
          sub="Active rule changes"
          icon={TrendingUp}
          color="bg-blue-600"
        />
        <KpiCard
          title="Avg Consultation Submissions"
          value={summary.avg_consultation_submissions.toFixed(1)}
          sub="Per consultation round"
          icon={Users}
          color="bg-purple-600"
        />
        <KpiCard
          title="Total Implementation Cost"
          value={`$${summary.total_implementation_cost_m_aud.toFixed(1)}M`}
          sub="AUD across completed rules"
          icon={DollarSign}
          color="bg-green-600"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartSection title="Rules by Category and Impact Level">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart1Data} margin={{ top: 4, right: 16, left: 8, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="category"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="High" stackId="a" fill={IMPACT_COLOURS.High} />
              <Bar dataKey="Medium" stackId="a" fill={IMPACT_COLOURS.Medium} />
              <Bar dataKey="Low" stackId="a" fill={IMPACT_COLOURS.Low} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Top 15 Consultations by Submissions Received">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart2Data} margin={{ top: 4, right: 16, left: 8, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number) => [v, 'Submissions']}
              />
              <Bar dataKey="submissions" radius={[4, 4, 0, 0]}>
                {chart2Data.map((_, i) => (
                  <Cell key={i} fill={COLOURS[i % COLOURS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartSection title="Timeline — Rules Initiated vs Completed by Year (All Categories)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart3Data} margin={{ top: 4, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="Rules Initiated" stackId="a" fill={COLOURS[1]} />
              <Bar dataKey="Rules Completed" stackId="a" fill={COLOURS[2]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Estimated Benefit by Implemented Rule (M AUD, sorted desc)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart4Data} margin={{ top: 4, right: 16, left: 8, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${v}M`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number) => [`$${v}M AUD`, 'Est. Benefit']}
              />
              <Bar dataKey="benefit" radius={[4, 4, 0, 0]}>
                {chart4Data.map((_, i) => (
                  <Cell key={i} fill={COLOURS[i % COLOURS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* Chart row 3 */}
      <div className="grid grid-cols-1 gap-6">
        <ChartSection title="Rules by Status and Category (Grouped)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              layout="vertical"
              data={chart5Data}
              margin={{ top: 4, right: 16, left: 130, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                width={125}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {allStatuses.map((status) => (
                <Bar
                  key={status}
                  dataKey={status}
                  fill={STATUS_COLOURS[status] ?? COLOURS[allStatuses.indexOf(status) % COLOURS.length]}
                  radius={[0, 4, 4, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>
    </div>
  )
}
