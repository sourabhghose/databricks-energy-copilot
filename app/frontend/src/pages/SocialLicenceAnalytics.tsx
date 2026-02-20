import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import {
  api,
  SocialLicenceDashboard,
  SLEProjectRecord,
  SLEFirstNationsRecord,
  SLEJustTransitionRecord,
  SLEEquityRecord,
} from '../api/client'
import {
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PieChart,
  Pie,
  Cell,
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

// ── Badges ────────────────────────────────────────────────────────────────────

const ENGAGEMENT_STYLES: Record<string, { bg: string; text: string }> = {
  EXCELLENT: { bg: '#14532d33', text: '#4ade80' },
  GOOD:      { bg: '#1d4ed833', text: '#60a5fa' },
  FAIR:      { bg: '#92400033', text: '#fbbf24' },
  POOR:      { bg: '#7f1d1d33', text: '#f87171' },
}

function EngagementBadge({ quality }: { quality: string }) {
  const s = ENGAGEMENT_STYLES[quality] ?? { bg: '#37415133', text: '#9ca3af' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: s.bg, color: s.text }}
    >
      {quality}
    </span>
  )
}

const OPPOSITION_COLOURS: Record<string, string> = {
  VISUAL_AMENITY:   '#a78bfa',
  NOISE:            '#fbbf24',
  PROPERTY_VALUE:   '#f87171',
  LAND_USE:         '#fb923c',
  CULTURAL_HERITAGE:'#e879f9',
  GRID_RELIABILITY: '#60a5fa',
  NONE:             '#4ade80',
}

function OppositionBadge({ reason }: { reason: string }) {
  const colour = OPPOSITION_COLOURS[reason] ?? '#9ca3af'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: colour + '22', color: colour }}
    >
      {reason.replace(/_/g, ' ')}
    </span>
  )
}

const TREND_STYLES: Record<string, { bg: string; text: string }> = {
  IMPROVING: { bg: '#14532d33', text: '#4ade80' },
  STABLE:    { bg: '#1d4ed833', text: '#60a5fa' },
  WORSENING: { bg: '#7f1d1d33', text: '#f87171' },
}

function TrendBadge({ trend }: { trend: string }) {
  const s = TREND_STYLES[trend] ?? { bg: '#37415133', text: '#9ca3af' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: s.bg, color: s.text }}
    >
      {trend}
    </span>
  )
}

// ── Support % colour helper ───────────────────────────────────────────────────

function supportColour(pct: number): string {
  if (pct >= 70) return '#4ade80'
  if (pct >= 50) return '#fbbf24'
  return '#f87171'
}

// ── Cohort label helper ───────────────────────────────────────────────────────

const COHORT_LABELS: Record<string, string> = {
  LOW_INCOME:         'Low Income',
  RENTERS:            'Renters',
  REMOTE_COMMUNITIES: 'Remote',
  FIRST_NATIONS:      'First Nations',
  ELDERLY:            'Elderly',
  DISABILITY:         'Disability',
}

// ── Consultation adequacy badge ───────────────────────────────────────────────

const CONSULT_STYLES: Record<string, { bg: string; text: string }> = {
  OUTSTANDING:  { bg: '#14532d33', text: '#4ade80' },
  ADEQUATE:     { bg: '#1d4ed833', text: '#60a5fa' },
  INADEQUATE:   { bg: '#7f1d1d33', text: '#f87171' },
}

function ConsultBadge({ adequacy }: { adequacy: string }) {
  const s = CONSULT_STYLES[adequacy] ?? { bg: '#37415133', text: '#9ca3af' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: s.bg, color: s.text }}
    >
      {adequacy}
    </span>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SocialLicenceAnalytics() {
  const [data, setData] = useState<SocialLicenceDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getSocialLicenceDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Social Licence Analytics…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  // ── KPI calculations ────────────────────────────────────────────────────────

  const avgSupport =
    data.projects.reduce((s, p) => s + p.community_support_pct, 0) / data.projects.length

  const poorEngagement = data.projects.filter(
    (p) => p.engagement_quality === 'POOR',
  ).length

  const totalJTFunding = data.just_transition.reduce(
    (s, r) => s + r.community_fund_m_aud,
    0,
  )

  const worseningCohorts = data.equity.filter((e) => e.trend === 'WORSENING').length

  // ── Just transition chart data ──────────────────────────────────────────────

  const jtChartData = data.just_transition.map((r) => ({
    region: r.region,
    retrained: +(r.affected_workers_k * (r.retraining_uptake_pct / 100)).toFixed(1),
    not_retrained: +(r.affected_workers_k * (1 - r.retraining_uptake_pct / 100)).toFixed(1),
    funding: r.community_fund_m_aud,
  }))

  // ── Equity radar chart data ─────────────────────────────────────────────────

  const radarData = [
    { subject: 'Equity Score', fullMark: 10 },
    { subject: 'Program Coverage', fullMark: 100 },
    { subject: 'Solar Access', fullMark: 100 },
    { subject: 'Low Hardship', fullMark: 100 },
  ]

  // Build per-cohort series for radar
  const RADAR_COLOURS = ['#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#a78bfa', '#fb923c']

  const radarSeriesData = data.equity.map((e, i) => ({
    label: COHORT_LABELS[e.cohort] ?? e.cohort,
    colour: RADAR_COLOURS[i % RADAR_COLOURS.length],
    data: [
      { subject: 'Equity Score', value: e.equity_score * 10 },          // normalised to 100
      { subject: 'Program Coverage', value: e.program_coverage_pct },
      { subject: 'Solar Access', value: e.access_to_solar_pct },
      { subject: 'Low Hardship', value: 100 - e.energy_hardship_rate_pct },
    ],
  }))

  // Flatten for a single RadarChart with multiple <Radar> components
  // recharts RadarChart expects one unified data array keyed by subject
  const radarUnified = radarData.map((r) => {
    const row: Record<string, string | number> = { subject: r.subject }
    data.equity.forEach((e, i) => {
      const label = COHORT_LABELS[e.cohort] ?? e.cohort
      const series = radarSeriesData[i].data.find((d) => d.subject === r.subject)
      row[label] = series ? series.value : 0
    })
    return row
  })

  return (
    <div className="p-6 space-y-8 text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="w-7 h-7 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold">Social Licence &amp; Energy Transition Equity</h1>
          <p className="text-sm text-gray-400">
            Community opposition, First Nations engagement, just transition &amp; energy justice
            outcomes — updated {new Date(data.timestamp).toLocaleString()}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Avg Community Support"
          value={avgSupport.toFixed(1)}
          unit="%"
          sub="across all projects"
          valueColor={supportColour(avgSupport)}
        />
        <KpiCard
          label="Projects — Poor Engagement"
          value={poorEngagement}
          unit="projects"
          sub="need improvement"
          valueColor={poorEngagement > 0 ? '#f87171' : '#4ade80'}
        />
        <KpiCard
          label="Just Transition Funding"
          value={totalJTFunding.toFixed(0)}
          unit="M AUD"
          sub="community fund total"
          valueColor="#60a5fa"
        />
        <KpiCard
          label="Cohorts Worsening"
          value={worseningCohorts}
          unit="cohorts"
          sub="equity trend declining"
          valueColor={worseningCohorts > 0 ? '#f87171' : '#4ade80'}
        />
      </div>

      {/* Project Social Licence Table */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Project Social Licence</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Project</th>
                <th className="text-left py-2 pr-4">Technology</th>
                <th className="text-left py-2 pr-4">Region / State</th>
                <th className="text-right py-2 pr-4">Support %</th>
                <th className="text-right py-2 pr-4">Opposition %</th>
                <th className="text-left py-2 pr-4">Opposition Reason</th>
                <th className="text-left py-2 pr-4">Engagement</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-left py-2">Aboriginal Land</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr
                  key={p.project_id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="py-2 pr-4 font-medium">{p.project_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.technology}</td>
                  <td className="py-2 pr-4 text-gray-300">
                    {p.region}, {p.state}
                  </td>
                  <td
                    className="py-2 pr-4 text-right font-semibold"
                    style={{ color: supportColour(p.community_support_pct) }}
                  >
                    {p.community_support_pct.toFixed(0)}%
                  </td>
                  <td className="py-2 pr-4 text-right text-red-400">
                    {p.community_opposition_pct.toFixed(0)}%
                  </td>
                  <td className="py-2 pr-4">
                    <OppositionBadge reason={p.opposition_reason} />
                  </td>
                  <td className="py-2 pr-4">
                    <EngagementBadge quality={p.engagement_quality} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{p.status}</td>
                  <td className="py-2">
                    {p.aboriginal_land ? (
                      <span className="text-yellow-400 font-medium">Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* First Nations Regional Summary */}
      <section>
        <h2 className="text-lg font-semibold mb-3">First Nations Engagement — Regional Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Region</th>
                <th className="text-right py-2 pr-4">Projects</th>
                <th className="text-right py-2 pr-4">Land Agreements</th>
                <th className="text-right py-2 pr-4">Benefit Sharing (M AUD)</th>
                <th className="text-right py-2 pr-4">Indigenous Employment (k)</th>
                <th className="text-left py-2 pr-4">Consultation</th>
                <th className="text-left py-2 pr-4">Land Rights</th>
                <th className="text-right py-2">Heritage Issues</th>
              </tr>
            </thead>
            <tbody>
              {data.first_nations.map((fn) => (
                <tr
                  key={fn.region}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="py-2 pr-4 font-medium">{fn.region}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{fn.project_count}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {fn.indigenous_land_agreements}
                  </td>
                  <td className="py-2 pr-4 text-right text-green-400">
                    ${fn.benefit_sharing_m_aud.toFixed(1)}M
                  </td>
                  <td className="py-2 pr-4 text-right text-blue-400">
                    {fn.employment_indigenous_k.toFixed(1)}k
                  </td>
                  <td className="py-2 pr-4">
                    <ConsultBadge adequacy={fn.consultation_adequacy} />
                  </td>
                  <td className="py-2 pr-4">
                    {fn.land_rights_respected ? (
                      <span className="text-green-400 font-medium">Respected</span>
                    ) : (
                      <span className="text-red-400 font-medium">Issues</span>
                    )}
                  </td>
                  <td
                    className="py-2 text-right font-semibold"
                    style={{ color: fn.cultural_heritage_issues > 2 ? '#f87171' : '#9ca3af' }}
                  >
                    {fn.cultural_heritage_issues}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Just Transition — Stacked Bar Chart */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Just Transition Progress — Coal Regions</h2>
        <div className="bg-gray-800 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={jtChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis
                yAxisId="workers"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                label={{
                  value: 'Workers (k)',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#9ca3af',
                  fontSize: 11,
                }}
              />
              <YAxis
                yAxisId="funding"
                orientation="right"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                label={{
                  value: 'Funding (M AUD)',
                  angle: 90,
                  position: 'insideRight',
                  fill: '#9ca3af',
                  fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              <Bar
                yAxisId="workers"
                dataKey="retrained"
                name="Retrained Workers (k)"
                stackId="workers"
                fill="#4ade80"
              />
              <Bar
                yAxisId="workers"
                dataKey="not_retrained"
                name="Not Retrained (k)"
                stackId="workers"
                fill="#f87171"
              />
              <Bar
                yAxisId="funding"
                dataKey="funding"
                name="Community Fund (M AUD)"
                fill="#60a5fa"
                fillOpacity={0.7}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Equity Cohort Radar Chart */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Energy Equity Cohort Radar</h2>
        <div className="bg-gray-800 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={380}>
            <RadarChart data={radarUnified}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              {data.equity.map((e, i) => {
                const label = COHORT_LABELS[e.cohort] ?? e.cohort
                const colour = RADAR_COLOURS[i % RADAR_COLOURS.length]
                return (
                  <Radar
                    key={e.cohort}
                    name={label}
                    dataKey={label}
                    stroke={colour}
                    fill={colour}
                    fillOpacity={0.15}
                  />
                )
              })}
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {/* Equity score table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Cohort</th>
                <th className="text-right py-2 pr-4">Equity Score</th>
                <th className="text-right py-2 pr-4">Bill Burden %</th>
                <th className="text-right py-2 pr-4">Solar Access %</th>
                <th className="text-right py-2 pr-4">Hardship Rate %</th>
                <th className="text-right py-2 pr-4">Program Coverage %</th>
                <th className="text-left py-2">Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.equity.map((e) => (
                <tr
                  key={e.cohort}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="py-2 pr-4 font-medium">
                    {COHORT_LABELS[e.cohort] ?? e.cohort}
                  </td>
                  <td
                    className="py-2 pr-4 text-right font-semibold"
                    style={{
                      color:
                        e.equity_score >= 6
                          ? '#4ade80'
                          : e.equity_score >= 4
                          ? '#fbbf24'
                          : '#f87171',
                    }}
                  >
                    {e.equity_score.toFixed(1)} / 10
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {e.electricity_bill_burden_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4 text-right text-blue-400">
                    {e.access_to_solar_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4 text-right text-red-400">
                    {e.energy_hardship_rate_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4 text-right text-green-400">
                    {e.program_coverage_pct.toFixed(1)}%
                  </td>
                  <td className="py-2">
                    <TrendBadge trend={e.trend} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
