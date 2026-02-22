import { useEffect, useState } from 'react'
import { Eye, DollarSign, Activity, BarChart2 } from 'lucide-react'
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
} from 'recharts'
import {
  getElectricityMarketTransparencyDashboard,
  EMTRDashboard,
  EMTRDataQualityRecord,
  EMTRComplianceRecord,
  EMTRMarketNoticRecord,
  EMTRAuditRecord,
  EMTRInformationRecord,
  EMTRTransparencyScoreRecord,
} from '../api/client'

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  colour,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ── Colour helpers ──────────────────────────────────────────────────────────
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#60a5fa',
  VIC1: '#34d399',
  QLD1: '#fbbf24',
  SA1: '#f87171',
  TAS1: '#a78bfa',
}

const NOTICE_COLOURS = [
  '#60a5fa', '#34d399', '#fbbf24', '#f87171',
  '#a78bfa', '#fb923c', '#22d3ee', '#e879f9',
]

function scoreColour(score: number): string {
  if (score >= 7) return 'bg-green-700 text-green-100'
  if (score >= 4) return 'bg-yellow-700 text-yellow-100'
  return 'bg-red-700 text-red-100'
}

// ── Chart 1: Data Quality Trend ────────────────────────────────────────────
function DataQualityTrendChart({ records }: { records: EMTRDataQualityRecord[] }) {
  const monthSet = Array.from(new Set(records.map((r) => r.report_month))).sort()
  const dataTypes = Array.from(new Set(records.map((r) => r.data_type)))

  const byMonth = monthSet.map((month) => {
    const entry: Record<string, string | number> = { month }
    dataTypes.forEach((dt) => {
      const rec = records.find((r) => r.report_month === month && r.data_type === dt)
      if (rec) {
        entry[`${dt}_completeness`] = rec.completeness_pct
        entry[`${dt}_uptime`] = rec.api_uptime_pct
      }
    })
    return entry
  })

  const colours = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#22d3ee', '#e879f9']

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={byMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis domain={[88, 102]} tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
        {dataTypes.slice(0, 4).map((dt, i) => (
          <Line
            key={`${dt}_completeness`}
            type="monotone"
            dataKey={`${dt}_completeness`}
            name={`${dt} Completeness %`}
            stroke={colours[i]}
            dot={false}
            strokeWidth={2}
          />
        ))}
        {dataTypes.slice(0, 2).map((dt, i) => (
          <Line
            key={`${dt}_uptime`}
            type="monotone"
            dataKey={`${dt}_uptime`}
            name={`${dt} API Uptime %`}
            stroke={colours[4 + i]}
            dot={false}
            strokeDasharray="4 2"
            strokeWidth={1.5}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Chart 2: Compliance Overview ───────────────────────────────────────────
function ComplianceOverviewChart({ records }: { records: EMTRComplianceRecord[] }) {
  const ptGroups: Record<string, { due: number; submitted: number; late: number }> = {}
  records.forEach((r) => {
    if (!ptGroups[r.participant_type]) {
      ptGroups[r.participant_type] = { due: 0, submitted: 0, late: 0 }
    }
    ptGroups[r.participant_type].due += r.reports_due
    ptGroups[r.participant_type].submitted += r.reports_submitted
    ptGroups[r.participant_type].late += r.reports_late
  })
  const data = Object.entries(ptGroups).map(([pt, vals]) => ({
    participant_type: pt,
    ...vals,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="participant_type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
        <Bar dataKey="due" name="Reports Due" fill="#60a5fa" radius={[3, 3, 0, 0]} />
        <Bar dataKey="submitted" name="Submitted" fill="#34d399" radius={[3, 3, 0, 0]} />
        <Bar dataKey="late" name="Late" fill="#f87171" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 3: Market Notice Lead Time ──────────────────────────────────────
function MarketNoticeLeadTimeChart({ records }: { records: EMTRMarketNoticRecord[] }) {
  const ntGroups: Record<string, number[]> = {}
  records.forEach((r) => {
    if (!ntGroups[r.notice_type]) ntGroups[r.notice_type] = []
    ntGroups[r.notice_type].push(r.lead_time_minutes)
  })
  const data = Object.entries(ntGroups).map(([nt, times]) => {
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const min = Math.min(...times)
    const max = Math.max(...times)
    return { notice_type: nt, avg: parseFloat(avg.toFixed(1)), min: parseFloat(min.toFixed(1)), max: parseFloat(max.toFixed(1)) }
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 55 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="notice_type" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" min" />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
        <Bar dataKey="min" name="Min Lead Time" fill="#34d399" radius={[3, 3, 0, 0]} />
        <Bar dataKey="avg" name="Avg Lead Time" fill="#60a5fa" radius={[3, 3, 0, 0]} />
        <Bar dataKey="max" name="Max Lead Time" fill="#f87171" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 4: Audit Findings ────────────────────────────────────────────────
function AuditFindingsChart({ records }: { records: EMTRAuditRecord[] }) {
  const sorted = [...records].sort((a, b) => b.findings_count - a.findings_count).slice(0, 10)
  const auditTypes = Array.from(new Set(records.map((r) => r.audit_type)))

  const data = sorted.map((r) => ({
    label: `${r.participant.split(' ')[0]} (${r.audit_type.slice(0, 4)})`,
    critical_findings: r.critical_findings,
    other_findings: r.findings_count - r.critical_findings,
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 55 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis type="category" dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} width={130} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
        <Bar dataKey="critical_findings" name="Critical Findings" fill="#f87171" stackId="a" radius={[0, 3, 3, 0]} />
        <Bar dataKey="other_findings" name="Other Findings" fill="#60a5fa" stackId="a" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 5: Transparency Score Trend ─────────────────────────────────────
function TransparencyScoreTrendChart({ records }: { records: EMTRTransparencyScoreRecord[] }) {
  const years = Array.from(new Set(records.map((r) => r.year))).sort()
  const regions = Array.from(new Set(records.map((r) => r.region)))

  const data = years.map((yr) => {
    const entry: Record<string, string | number> = { year: yr.toString() }
    regions.forEach((reg) => {
      const rec = records.find((r) => r.year === yr && r.region === reg)
      if (rec) entry[reg] = rec.overall_transparency_score
    })
    return entry
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis domain={[40, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
        {regions.map((reg) => (
          <Line
            key={reg}
            type="monotone"
            dataKey={reg}
            name={reg}
            stroke={REGION_COLOURS[reg] ?? '#9ca3af'}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Chart 6: Information Gap Heatmap (table) ────────────────────────────────
function InformationGapHeatmap({ records }: { records: EMTRInformationRecord[] }) {
  const metrics = Array.from(new Set(records.map((r) => r.metric_name)))
  const regions = Array.from(new Set(records.map((r) => r.region)))

  const scoreMap: Record<string, Record<string, number>> = {}
  records.forEach((r) => {
    if (!scoreMap[r.metric_name]) scoreMap[r.metric_name] = {}
    scoreMap[r.metric_name][r.region] = r.information_advantage_score
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-gray-300 border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 text-gray-400 font-medium bg-gray-900 sticky left-0">Metric</th>
            {regions.map((reg) => (
              <th key={reg} className="py-2 px-3 text-gray-400 font-medium bg-gray-900 text-center">{reg}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric} className="border-t border-gray-700 hover:bg-gray-750">
              <td className="py-2 px-3 text-gray-300 bg-gray-800 sticky left-0 font-medium">{metric}</td>
              {regions.map((reg) => {
                const score = scoreMap[metric]?.[reg]
                return (
                  <td key={reg} className="py-2 px-3 text-center">
                    {score !== undefined ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${scoreColour(score)}`}>
                        {score.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ElectricityMarketTransparencyAnalytics() {
  const [dashboard, setDashboard] = useState<EMTRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityMarketTransparencyDashboard()
      .then(setDashboard)
      .catch((e) => setError(e.message ?? 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 animate-pulse">Loading Market Transparency data...</p>
      </div>
    )
  }
  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400">{error ?? 'No data available'}</p>
      </div>
    )
  }

  const summary = dashboard.summary
  const avgCompleteness = typeof summary.avg_data_completeness_pct === 'number'
    ? summary.avg_data_completeness_pct.toFixed(1)
    : String(summary.avg_data_completeness_pct)
  const avgUptime = typeof summary.avg_api_uptime_pct === 'number'
    ? summary.avg_api_uptime_pct.toFixed(2)
    : String(summary.avg_api_uptime_pct)
  const totalPenalties = typeof summary.total_penalties_m === 'number'
    ? summary.total_penalties_m.toFixed(2)
    : String(summary.total_penalties_m)
  const avgTransparency = typeof summary.avg_transparency_score === 'number'
    ? summary.avg_transparency_score.toFixed(1)
    : String(summary.avg_transparency_score)

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-white">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Eye size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Electricity Market Transparency Reporting</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            AEMO data publication quality, participant disclosure compliance, market notice timeliness, AER/ACCC audits, and information asymmetry metrics
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Avg Data Completeness"
          value={`${avgCompleteness}%`}
          sub="Across all data types"
          icon={Activity}
          colour="bg-blue-600"
        />
        <KpiCard
          label="Avg API Uptime"
          value={`${avgUptime}%`}
          sub="NEM data platform"
          icon={Eye}
          colour="bg-green-600"
        />
        <KpiCard
          label="Total Penalties"
          value={`$${totalPenalties}M`}
          sub="Compliance + audit penalties"
          icon={DollarSign}
          colour="bg-red-600"
        />
        <KpiCard
          label="Avg Transparency Score"
          value={`${avgTransparency} / 100`}
          sub={`Best region: ${String(summary.highest_transparency_region)}`}
          icon={BarChart2}
          colour="bg-purple-600"
        />
      </div>

      {/* Chart 1: Data Quality Trend */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Data Quality Trend"
          subtitle="Completeness % and API uptime % by month for each data type"
        />
        <DataQualityTrendChart records={dashboard.data_quality} />
      </div>

      {/* Chart 2: Compliance Overview */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Compliance Overview"
          subtitle="Reports due vs submitted vs late by participant type"
        />
        <ComplianceOverviewChart records={dashboard.compliance} />
      </div>

      {/* Chart 3: Market Notice Lead Time */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Market Notice Lead Time"
          subtitle="Min / avg / max lead time (minutes) by notice type"
        />
        <MarketNoticeLeadTimeChart records={dashboard.market_notices} />
      </div>

      {/* Chart 4: Audit Findings */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Audit Findings"
          subtitle="Critical vs other findings by participant and audit type (top 10 by total findings)"
        />
        <AuditFindingsChart records={dashboard.audits} />
      </div>

      {/* Chart 5: Transparency Score Trend */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Transparency Score Trend"
          subtitle="Overall transparency score by region 2020-2024"
        />
        <TransparencyScoreTrendChart records={dashboard.transparency_scores} />
      </div>

      {/* Chart 6: Information Gap Heatmap */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Information Gap Heatmap"
          subtitle="Information advantage score (1-10) by metric and region — green: low asymmetry, red: high asymmetry"
        />
        <InformationGapHeatmap records={dashboard.information_gaps} />
      </div>
    </div>
  )
}
