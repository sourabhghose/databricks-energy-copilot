import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer,
} from 'recharts'
import {
  getElectricityWorkforceDashboard,
  ESWDashboard,
  ESWEmploymentRecord,
  ESWSkillsGapRecord,
  ESWTransitionRecord,
  ESWTrainingRecord,
  ESWDiversityRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const CARD_BG = 'bg-gray-800 border border-gray-700 rounded-lg p-4'
const TABLE_TH = 'px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide'
const TABLE_TD = 'px-3 py-2 text-sm text-gray-200 whitespace-nowrap'
const TABLE_TD_MONO = 'px-3 py-2 text-sm font-mono text-gray-200 whitespace-nowrap'

const SECTOR_COLORS: Record<string, string> = {
  COAL_MINING:            '#6B7280',
  GAS_EXTRACTION:         '#F59E0B',
  ELECTRICITY_GENERATION: '#3B82F6',
  TRANSMISSION:           '#8B5CF6',
  DISTRIBUTION:           '#06B6D4',
  RENEWABLES:             '#10B981',
  STORAGE:                '#F97316',
  EFFICIENCY_SERVICES:    '#EC4899',
}

const SECTOR_LABELS: Record<string, string> = {
  COAL_MINING:            'Coal Mining',
  GAS_EXTRACTION:         'Gas Extraction',
  ELECTRICITY_GENERATION: 'Electricity Gen.',
  TRANSMISSION:           'Transmission',
  DISTRIBUTION:           'Distribution',
  RENEWABLES:             'Renewables',
  STORAGE:                'Storage',
  EFFICIENCY_SERVICES:    'Efficiency Svcs',
}

const LINE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316', '#EC4899']

function fmt(n: number, dp = 1): string {
  return n.toFixed(dp)
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className={CARD_BG}>
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 border-b border-gray-700 pb-2">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 1 — KPI Cards
// ---------------------------------------------------------------------------
function KpiSection({ summary }: { summary: Record<string, unknown> }) {
  const totalJobs   = summary['total_electricity_jobs_2024'] as number
  const renewJobs   = summary['renewable_jobs_2024'] as number
  const coalRisk    = summary['coal_jobs_at_risk_by_2030'] as number
  const gapTotal    = summary['skills_gap_2030_total'] as number
  const retrainCost = summary['avg_retraining_cost'] as number
  const femalePct   = summary['female_sector_pct'] as number

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      <KpiCard
        label="Total Electricity Jobs 2024"
        value={`${(totalJobs / 1000).toFixed(0)}k`}
        sub="Direct + indirect + induced"
        accent="text-blue-400"
      />
      <KpiCard
        label="Renewable Energy Jobs"
        value={`${(renewJobs / 1000).toFixed(0)}k`}
        sub="Solar, wind, storage 2024"
        accent="text-green-400"
      />
      <KpiCard
        label="Coal Jobs at Risk by 2030"
        value={`${(coalRisk / 1000).toFixed(0)}k`}
        sub="Subject to transition programs"
        accent="text-red-400"
      />
      <KpiCard
        label="Skills Gap 2030 (total)"
        value={fmtK(gapTotal)}
        sub="Across all key occupations"
        accent="text-amber-400"
      />
      <KpiCard
        label="Avg Retraining Cost"
        value={`$${(retrainCost / 1000).toFixed(1)}k`}
        sub="Per worker (coal/gas → clean)"
        accent="text-purple-400"
      />
      <KpiCard
        label="Female Workforce %"
        value={`${fmt(femalePct)}%`}
        sub="Sector-wide average 2024"
        accent="text-pink-400"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 2 — Employment by Sector (Stacked Bar: direct + indirect + induced)
// ---------------------------------------------------------------------------
function aggregateBySector(records: ESWEmploymentRecord[]) {
  const byS: Record<string, { direct: number; indirect: number; induced: number }> = {}
  for (const r of records) {
    if (!byS[r.sector]) byS[r.sector] = { direct: 0, indirect: 0, induced: 0 }
    byS[r.sector].direct   += r.direct_jobs
    byS[r.sector].indirect += r.indirect_jobs
    byS[r.sector].induced  += r.induced_jobs
  }
  return Object.entries(byS).map(([sector, v]) => ({
    sector: SECTOR_LABELS[sector] ?? sector,
    direct: Math.round(v.direct / 1000 * 10) / 10,
    indirect: Math.round(v.indirect / 1000 * 10) / 10,
    induced: Math.round(v.induced / 1000 * 10) / 10,
  }))
}

function EmploymentSection({ employment }: { employment: ESWEmploymentRecord[] }) {
  const data = aggregateBySector(employment)

  return (
    <div className={`${CARD_BG} mb-6`}>
      <SectionHeader
        title="Employment by Sector"
        subtitle="Aggregated national jobs across all states — 2024 (thousands)"
      />
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ top: 4, right: 24, left: 8, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="sector"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} unit="k" />
          <Tooltip
            contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#F9FAFB', fontWeight: 600 }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number) => [`${v}k`, undefined]}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
          <Bar dataKey="direct"   stackId="a" fill="#3B82F6" name="Direct Jobs"   />
          <Bar dataKey="indirect" stackId="a" fill="#10B981" name="Indirect Jobs" />
          <Bar dataKey="induced"  stackId="a" fill="#F59E0B" name="Induced Jobs"  radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Quality & diversity table */}
      <div className="mt-6 overflow-x-auto">
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Sector Quality & Diversity (2024 national avg)</p>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>Sector</th>
              <th className={TABLE_TH}>Avg Salary</th>
              <th className={TABLE_TH}>Job Quality (0-10)</th>
              <th className={TABLE_TH}>Female %</th>
              <th className={TABLE_TH}>Indigenous %</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(
              employment.reduce((acc, r) => {
                if (!acc[r.sector]) acc[r.sector] = { salary: 0, quality: 0, female: 0, indigenous: 0, count: 0 }
                acc[r.sector].salary     += r.avg_salary
                acc[r.sector].quality    += r.job_quality_index
                acc[r.sector].female     += r.female_pct
                acc[r.sector].indigenous += r.indigenous_pct
                acc[r.sector].count      += 1
                return acc
              }, {} as Record<string, { salary: number; quality: number; female: number; indigenous: number; count: number }>)
            ).map(([sector, v], i) => (
              <tr key={sector} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}>
                <td className={TABLE_TD}>
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2"
                    style={{ background: SECTOR_COLORS[sector] ?? '#6B7280' }}
                  />
                  {SECTOR_LABELS[sector] ?? sector}
                </td>
                <td className={TABLE_TD_MONO}>${(v.salary / v.count / 1000).toFixed(0)}k</td>
                <td className={TABLE_TD_MONO}>{fmt(v.quality / v.count)}</td>
                <td className={TABLE_TD_MONO}>{fmt(v.female / v.count)}%</td>
                <td className={TABLE_TD_MONO}>{fmt(v.indigenous / v.count)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 3 — Skills Gap (horizontal bar chart)
// ---------------------------------------------------------------------------
function SkillsGapSection({ skillsGaps }: { skillsGaps: ESWSkillsGapRecord[] }) {
  const sorted = [...skillsGaps].sort((a, b) => b.gap_2030 - a.gap_2030)

  const chartData = sorted.map(r => ({
    occupation: r.occupation.replace(/_/g, ' '),
    gap_2030: r.gap_2030,
    gap_2035: r.gap_2035,
  }))

  return (
    <div className={`${CARD_BG} mb-6`}>
      <SectionHeader
        title="Skills Gap by Occupation"
        subtitle="Projected shortfall vs current supply — workers needed beyond current training pipeline"
      />
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 40, left: 130, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
          <YAxis type="category" dataKey="occupation" tick={{ fill: '#D1D5DB', fontSize: 11 }} width={125} />
          <Tooltip
            contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#F9FAFB', fontWeight: 600 }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number) => [v.toLocaleString(), undefined]}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
          <Bar dataKey="gap_2030" fill="#F59E0B" name="Gap 2030" radius={[0, 3, 3, 0]} />
          <Bar dataKey="gap_2035" fill="#EF4444" name="Gap 2035" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-6 overflow-x-auto">
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Occupation Detail</p>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>Occupation</th>
              <th className={TABLE_TH}>Demand 2024</th>
              <th className={TABLE_TH}>Demand 2030</th>
              <th className={TABLE_TH}>Demand 2035</th>
              <th className={TABLE_TH}>Current Supply</th>
              <th className={TABLE_TH}>Gap 2030</th>
              <th className={TABLE_TH}>Pipeline/yr</th>
              <th className={TABLE_TH}>Train (months)</th>
              <th className={TABLE_TH}>Avg Wage</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.occupation} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}>
                <td className={TABLE_TD}>{r.occupation.replace(/_/g, ' ')}</td>
                <td className={TABLE_TD_MONO}>{r.demand_2024.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>{r.demand_2030.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>{r.demand_2035.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>{r.current_supply.toLocaleString()}</td>
                <td className={`${TABLE_TD_MONO} text-amber-400 font-semibold`}>{r.gap_2030.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>{r.training_pipeline_per_yr.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>{r.avg_training_time_months}</td>
                <td className={TABLE_TD_MONO}>${(r.avg_wage / 1000).toFixed(0)}k</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 4 — Just Transition (table)
// ---------------------------------------------------------------------------
function TransitionSection({ transition }: { transition: ESWTransitionRecord[] }) {
  return (
    <div className={`${CARD_BG} mb-6`}>
      <SectionHeader
        title="Just Transition — Regional Job Impact"
        subtitle="Coal & gas region workforce transition scenarios by year"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>Region</th>
              <th className={TABLE_TH}>Retiring Sector</th>
              <th className={TABLE_TH}>Retiring Jobs</th>
              <th className={TABLE_TH}>Transition Yr</th>
              <th className={TABLE_TH}>New Sector</th>
              <th className={TABLE_TH}>New Jobs</th>
              <th className={TABLE_TH}>Net Impact</th>
              <th className={TABLE_TH}>Transferable Skills</th>
              <th className={TABLE_TH}>Retrain Cost/Worker</th>
              <th className={TABLE_TH}>Geo Match %</th>
            </tr>
          </thead>
          <tbody>
            {transition.map((r, i) => {
              const netColor = r.net_job_impact >= 0 ? 'text-green-400' : 'text-red-400'
              return (
                <tr key={`${r.region}-${r.new_sector}-${r.transition_year}`} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}>
                  <td className={TABLE_TD}>{r.region}</td>
                  <td className={TABLE_TD}>
                    <span className="px-1.5 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                      {r.retiring_sector}
                    </span>
                  </td>
                  <td className={TABLE_TD_MONO}>{r.retiring_jobs.toLocaleString()}</td>
                  <td className={TABLE_TD_MONO}>{r.transition_year}</td>
                  <td className={TABLE_TD}>
                    <span className="px-1.5 py-0.5 rounded text-xs bg-green-900 text-green-300">
                      {r.new_sector}
                    </span>
                  </td>
                  <td className={TABLE_TD_MONO}>{r.new_jobs_created.toLocaleString()}</td>
                  <td className={`${TABLE_TD_MONO} font-semibold ${netColor}`}>
                    {r.net_job_impact >= 0 ? '+' : ''}{r.net_job_impact.toLocaleString()}
                  </td>
                  <td className={TABLE_TD_MONO}>{(r.transferable_skills_pct * 100).toFixed(0)}%</td>
                  <td className={TABLE_TD_MONO}>${(r.retraining_cost_per_worker / 1000).toFixed(1)}k</td>
                  <td className={TABLE_TD_MONO}>{(r.geographic_match_pct * 100).toFixed(0)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 5 — Training Programs (table)
// ---------------------------------------------------------------------------
function TrainingSection({ training }: { training: ESWTrainingRecord[] }) {
  const sorted = [...training].sort((a, b) => b.employment_rate_pct - a.employment_rate_pct)

  const OPERATOR_COLORS: Record<string, string> = {
    TAFE:       'bg-blue-900 text-blue-300',
    UNIVERSITY: 'bg-purple-900 text-purple-300',
    INDUSTRY:   'bg-amber-900 text-amber-300',
    GOVERNMENT: 'bg-green-900 text-green-300',
  }

  return (
    <div className={`${CARD_BG} mb-6`}>
      <SectionHeader
        title="Training Programs — Effectiveness"
        subtitle="Annual graduates, completion & sector employment rates (sorted by employment rate)"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>Program</th>
              <th className={TABLE_TH}>Operator</th>
              <th className={TABLE_TH}>State</th>
              <th className={TABLE_TH}>Target Occupation</th>
              <th className={TABLE_TH}>Graduates/yr</th>
              <th className={TABLE_TH}>Completion %</th>
              <th className={TABLE_TH}>Employment %</th>
              <th className={TABLE_TH}>Govt Funding $M</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.program} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}>
                <td className={TABLE_TD}>{r.program}</td>
                <td className={TABLE_TD}>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${OPERATOR_COLORS[r.operator] ?? 'bg-gray-700 text-gray-300'}`}>
                    {r.operator}
                  </span>
                </td>
                <td className={TABLE_TD}>{r.state}</td>
                <td className={TABLE_TD}>{r.target_occupation.replace(/_/g, ' ')}</td>
                <td className={TABLE_TD_MONO}>{r.annual_graduates.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>{fmt(r.completion_rate_pct)}%</td>
                <td className={`${TABLE_TD_MONO} ${r.employment_rate_pct >= 85 ? 'text-green-400' : r.employment_rate_pct >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                  {fmt(r.employment_rate_pct)}%
                </td>
                <td className={TABLE_TD_MONO}>${fmt(r.govt_funding_m)}M</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 6 — Diversity Trends (Line Chart: female % by sector over time)
// ---------------------------------------------------------------------------
function buildDiversityChartData(diversity: ESWDiversityRecord[]) {
  const years = [2020, 2022, 2024]
  return years.map(year => {
    const row: Record<string, number | string> = { year: String(year) }
    for (const r of diversity) {
      if (r.year === year) {
        row[SECTOR_LABELS[r.sector] ?? r.sector] = parseFloat(r.female_technical_pct.toFixed(1))
      }
    }
    return row
  })
}

function DiversitySection({ diversity }: { diversity: ESWDiversityRecord[] }) {
  const lineData = buildDiversityChartData(diversity)
  const sectors = Object.keys(SECTOR_LABELS)

  // 2024 diversity snapshot table
  const latest = diversity.filter(r => r.year === 2024)

  return (
    <div className={`${CARD_BG} mb-6`}>
      <SectionHeader
        title="Diversity Trends"
        subtitle="Female technical workforce % by sector — 2020 / 2022 / 2024"
      />
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={lineData} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} unit="%" domain={[0, 45]} />
          <Tooltip
            contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#F9FAFB', fontWeight: 600 }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number) => [`${v}%`, undefined]}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 11 }} />
          {sectors.map((sector, idx) => (
            <Line
              key={sector}
              type="monotone"
              dataKey={SECTOR_LABELS[sector]}
              stroke={LINE_COLORS[idx % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-6 overflow-x-auto">
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">2024 Diversity Snapshot</p>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>Sector</th>
              <th className={TABLE_TH}>Female Leadership %</th>
              <th className={TABLE_TH}>Female Technical %</th>
              <th className={TABLE_TH}>Indigenous %</th>
              <th className={TABLE_TH}>Under 30 %</th>
              <th className={TABLE_TH}>Apprenticeship %</th>
              <th className={TABLE_TH}>Target Achieved</th>
            </tr>
          </thead>
          <tbody>
            {latest.map((r, i) => (
              <tr key={r.sector} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}>
                <td className={TABLE_TD}>
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2"
                    style={{ background: SECTOR_COLORS[r.sector] ?? '#6B7280' }}
                  />
                  {SECTOR_LABELS[r.sector] ?? r.sector}
                </td>
                <td className={TABLE_TD_MONO}>{fmt(r.female_leadership_pct)}%</td>
                <td className={TABLE_TD_MONO}>{fmt(r.female_technical_pct)}%</td>
                <td className={TABLE_TD_MONO}>{fmt(r.indigenous_employment_pct)}%</td>
                <td className={TABLE_TD_MONO}>{fmt(r.under_30_pct)}%</td>
                <td className={TABLE_TD_MONO}>{fmt(r.apprenticeship_pct)}%</td>
                <td className={TABLE_TD}>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.diversity_target_achieved ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    {r.diversity_target_achieved ? 'YES' : 'NO'}
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

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function ElectricityWorkforceAnalytics() {
  const [data, setData] = useState<ESWDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityWorkforceDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-lg animate-pulse">Loading workforce analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-lg">Error loading data: {error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Electricity Sector Workforce &amp; Skills Analytics
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Workforce needs for the energy transition, skills gaps, training pipelines and employment impacts
        </p>
      </div>

      {/* KPI Cards */}
      <KpiSection summary={data.summary} />

      {/* Employment by Sector */}
      <EmploymentSection employment={data.employment} />

      {/* Skills Gap */}
      <SkillsGapSection skillsGaps={data.skills_gaps} />

      {/* Just Transition */}
      <TransitionSection transition={data.transition} />

      {/* Training Programs */}
      <TrainingSection training={data.training} />

      {/* Diversity Trends */}
      <DiversitySection diversity={data.diversity} />
    </div>
  )
}
