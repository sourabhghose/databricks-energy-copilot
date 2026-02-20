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
} from 'recharts'
import { Smartphone, RefreshCw, AlertTriangle, TrendingUp, Award, Cpu, Users } from 'lucide-react'
import {
  getDigitalTransformationDashboard,
  EDTDashboard,
  EDTTechnologyRecord,
  EDTMaturityRecord,
  EDTInvestmentRecord,
  EDTOutcomeRecord,
  EDTSkillsRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const MATURITY_BADGE: Record<string, string> = {
  PIONEER:        'bg-violet-600 text-white',
  EARLY_ADOPTER:  'bg-blue-600 text-white',
  EARLY_MAJORITY: 'bg-teal-600 text-white',
  LATE_MAJORITY:  'bg-amber-600 text-white',
  LAGGARD:        'bg-red-700 text-white',
}

const SECTOR_BADGE: Record<string, string> = {
  GENERATION:        'bg-orange-600 text-white',
  TRANSMISSION:      'bg-sky-600 text-white',
  DISTRIBUTION:      'bg-green-600 text-white',
  RETAIL:            'bg-pink-600 text-white',
  MARKET_OPERATIONS: 'bg-purple-600 text-white',
}

const ORG_TYPE_BADGE: Record<string, string> = {
  TNSP:       'bg-sky-700 text-white',
  DNSP:       'bg-green-700 text-white',
  GENERATOR:  'bg-orange-700 text-white',
  RETAILER:   'bg-pink-700 text-white',
  AGGREGATOR: 'bg-violet-700 text-white',
}

const DIFFICULTY_BADGE: Record<string, string> = {
  HIGH:   'bg-red-700 text-white',
  MEDIUM: 'bg-amber-600 text-white',
  LOW:    'bg-green-700 text-white',
}

const OUTCOME_BADGE: Record<string, string> = {
  RELIABILITY_IMPROVEMENT: 'bg-blue-700 text-white',
  COST_REDUCTION:          'bg-green-700 text-white',
  CUSTOMER_SATISFACTION:   'bg-pink-700 text-white',
  EMISSIONS_REDUCTION:     'bg-teal-700 text-white',
  OUTAGE_REDUCTION:        'bg-red-700 text-white',
  WORKFORCE_PRODUCTIVITY:  'bg-violet-700 text-white',
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ElementType
  accent?: string
}) {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border-l-4 ${accent ?? 'border-blue-500'}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-gray-400" />}
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score bar for maturity table
// ---------------------------------------------------------------------------

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  const colour =
    pct >= 75 ? 'bg-green-500' :
    pct >= 55 ? 'bg-amber-500' :
    'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div
          className={`${colour} h-2 rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-300 w-6 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-base font-semibold text-white mb-4">{title}</h2>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Technology Adoption Bar Chart
// ---------------------------------------------------------------------------

function TechAdoptionChart({ data }: { data: EDTTechnologyRecord[] }) {
  const chartData = data.map((t) => ({
    name: t.technology.replace(/_/g, ' '),
    'Current %': t.adoption_rate_pct,
    '2030 Target %': t.adoption_2030_target_pct,
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 80, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="name"
          tick={{ fill: '#9CA3AF', fontSize: 10 }}
          angle={-40}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} domain={[0, 100]} unit="%" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F9FAFB' }}
        />
        <Legend wrapperStyle={{ color: '#D1D5DB', fontSize: 12 }} />
        <Bar dataKey="Current %" fill="#3B82F6" radius={[3, 3, 0, 0]} />
        <Bar dataKey="2030 Target %" fill="#10B981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Investment Trends Stacked Bar Chart
// ---------------------------------------------------------------------------

function InvestmentChart({ data }: { data: EDTInvestmentRecord[] }) {
  const sectors = ['TRANSMISSION', 'DISTRIBUTION', 'GENERATION', 'RETAIL']
  const years = [2020, 2021, 2022, 2023, 2024]

  const chartData = years.map((yr) => {
    const row: Record<string, number | string> = { year: yr.toString() }
    sectors.forEach((sec) => {
      const rec = data.find((d) => d.year === yr && d.sector === sec)
      row[sec] = rec ? rec.total_digital_m : 0
    })
    return row
  })

  const COLOURS: Record<string, string> = {
    TRANSMISSION: '#0EA5E9',
    DISTRIBUTION: '#10B981',
    GENERATION:   '#F59E0B',
    RETAIL:       '#EC4899',
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} unit="M" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F9FAFB' }}
          formatter={(val: number) => [`$${val.toFixed(0)}M`, undefined]}
        />
        <Legend wrapperStyle={{ color: '#D1D5DB', fontSize: 12 }} />
        {sectors.map((sec) => (
          <Bar key={sec} dataKey={sec} stackId="a" fill={COLOURS[sec]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Outcomes grouped bar chart
// ---------------------------------------------------------------------------

function OutcomesChart({ data }: { data: EDTOutcomeRecord[] }) {
  const technologies = [...new Set(data.map((d) => d.technology))]
  const metrics = [...new Set(data.map((d) => d.outcome_metric))]

  const chartData = technologies.map((tech) => {
    const row: Record<string, number | string> = { tech: tech.replace(/_/g, ' ') }
    metrics.forEach((m) => {
      const rec = data.find((d) => d.technology === tech && d.outcome_metric === m)
      row[m.replace(/_/g, ' ')] = rec ? parseFloat(rec.improvement_pct.toFixed(1)) : 0
    })
    return row
  })

  const COLOURS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444']

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 60, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="tech"
          tick={{ fill: '#9CA3AF', fontSize: 10 }}
          angle={-30}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} unit="%" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F9FAFB' }}
        />
        <Legend wrapperStyle={{ color: '#D1D5DB', fontSize: 11 }} />
        {metrics.map((m, i) => (
          <Bar key={m} dataKey={m.replace(/_/g, ' ')} fill={COLOURS[i % COLOURS.length]} radius={[2, 2, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Skills Gap horizontal bar chart
// ---------------------------------------------------------------------------

function SkillsGapChart({ data }: { data: EDTSkillsRecord[] }) {
  const chartData = data.map((s) => ({
    name: s.skill_area.replace(/_/g, ' '),
    'Current FTE': s.current_fte,
    '2030 Required': s.required_2030_fte,
    'Gap 2030': s.gap_2030,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 4, right: 40, bottom: 4, left: 120 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={115} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F9FAFB' }}
        />
        <Legend wrapperStyle={{ color: '#D1D5DB', fontSize: 12 }} />
        <Bar dataKey="Current FTE"   fill="#3B82F6" radius={[0, 3, 3, 0]} />
        <Bar dataKey="2030 Required" fill="#10B981" radius={[0, 3, 3, 0]} />
        <Bar dataKey="Gap 2030"      fill="#EF4444" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DigitalTransformationAnalytics() {
  const [data, setData]       = useState<EDTDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getDigitalTransformationDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Loading digital transformation data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 gap-2">
        <AlertTriangle size={20} />
        <span>{error ?? 'No data available'}</span>
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Smartphone size={28} className="text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-white">
              Electricity Sector Digital Transformation Analytics
            </h1>
            <p className="text-sm text-gray-400">
              Smart grid adoption, IoT/AI deployment, digital maturity benchmarking &amp; investment trends
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 transition"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Smart Meter Adoption"
          value={`${summary.avg_adoption_smart_meters_pct}%`}
          sub="Avg across all DNSPs"
          icon={Smartphone}
          accent="border-blue-500"
        />
        <KpiCard
          label="Avg Digital Maturity"
          value={`${summary.avg_digital_maturity_score} / 10`}
          sub="Industry average score"
          icon={Award}
          accent="border-teal-500"
        />
        <KpiCard
          label="Total Digital Investment 2024"
          value={`$${(summary.total_digital_investment_2024_m as number / 1000).toFixed(1)}B`}
          sub="All sectors combined"
          icon={TrendingUp}
          accent="border-green-500"
        />
        <KpiCard
          label="Top ROI Technology"
          value={String(summary.top_roi_technology).replace(/_/g, ' ')}
          sub="Highest return on digital investment"
          icon={Cpu}
          accent="border-amber-500"
        />
        <KpiCard
          label="Skills Gap 2030"
          value={`${(summary.skills_gap_2030 as number).toLocaleString()} FTE`}
          sub="Projected digital skills shortfall"
          icon={Users}
          accent="border-red-500"
        />
        <KpiCard
          label="Digital % of CapEx"
          value={`${summary.digital_capex_pct}%`}
          sub="Digital investment as % of total CapEx"
          icon={TrendingUp}
          accent="border-purple-500"
        />
      </div>

      {/* Technology Adoption */}
      <Section title="Technology Adoption — Current vs 2030 Target (%)">
        <TechAdoptionChart data={data.technologies} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="py-2 pr-4">Technology</th>
                <th className="py-2 pr-4">Sector</th>
                <th className="py-2 pr-4">Maturity</th>
                <th className="py-2 pr-4 text-right">Adoption %</th>
                <th className="py-2 pr-4 text-right">2030 Target</th>
                <th className="py-2 pr-4 text-right">Inv $M/yr</th>
                <th className="py-2 pr-4 text-right">ROI %</th>
                <th className="py-2">Reg. Barrier</th>
              </tr>
            </thead>
            <tbody>
              {data.technologies.map((t, i) => (
                <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-medium text-white">
                    {t.technology.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge
                      label={t.sector}
                      colorClass={SECTOR_BADGE[t.sector] ?? 'bg-gray-600 text-white'}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <Badge
                      label={t.maturity_level}
                      colorClass={MATURITY_BADGE[t.maturity_level] ?? 'bg-gray-600 text-white'}
                    />
                  </td>
                  <td className="py-2 pr-4 text-right">{t.adoption_rate_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-right text-green-400">{t.adoption_2030_target_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-right">${t.annual_investment_m.toFixed(0)}M</td>
                  <td className="py-2 pr-4 text-right text-amber-400">{t.expected_roi_pct.toFixed(1)}%</td>
                  <td className="py-2">
                    {t.regulatory_barrier ? (
                      <span className="text-red-400 text-xs font-semibold">Yes</span>
                    ) : (
                      <span className="text-gray-500 text-xs">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Digital Maturity Benchmark */}
      <Section title="Digital Maturity Benchmark — Organisation Scores (0–10)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="py-2 pr-3">Organisation</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Overall</th>
                <th className="py-2 pr-3 min-w-32">Data Mgmt</th>
                <th className="py-2 pr-3 min-w-32">Automation</th>
                <th className="py-2 pr-3 min-w-32">Analytics</th>
                <th className="py-2 pr-3 min-w-32">Cybersec</th>
                <th className="py-2 pr-3 min-w-32">Customer</th>
                <th className="py-2 pr-3 min-w-32">Workforce</th>
                <th className="py-2 text-right">vs Global</th>
              </tr>
            </thead>
            <tbody>
              {data.maturity.map((m, i) => (
                <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-3 font-medium text-white whitespace-nowrap">{m.organisation}</td>
                  <td className="py-2 pr-3">
                    <Badge
                      label={m.organisation_type}
                      colorClass={ORG_TYPE_BADGE[m.organisation_type] ?? 'bg-gray-600 text-white'}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <ScoreBar score={m.overall_maturity_score} />
                  </td>
                  <td className="py-2 pr-3"><ScoreBar score={m.data_management_score} /></td>
                  <td className="py-2 pr-3"><ScoreBar score={m.automation_score} /></td>
                  <td className="py-2 pr-3"><ScoreBar score={m.analytics_score} /></td>
                  <td className="py-2 pr-3"><ScoreBar score={m.cybersecurity_score} /></td>
                  <td className="py-2 pr-3"><ScoreBar score={m.customer_digital_score} /></td>
                  <td className="py-2 pr-3"><ScoreBar score={m.workforce_digital_score} /></td>
                  <td className={`py-2 text-right text-sm font-semibold ${m.benchmark_vs_global >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {m.benchmark_vs_global >= 0 ? '+' : ''}{m.benchmark_vs_global.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Investment Trends */}
      <Section title="Digital Investment Trends 2020–2024 — Total by Sector ($M)">
        <InvestmentChart data={data.investment} />
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {['TRANSMISSION', 'DISTRIBUTION', 'GENERATION', 'RETAIL'].map((sec) => {
            const rec2024 = data.investment.find((d) => d.year === 2024 && d.sector === sec)
            const rec2020 = data.investment.find((d) => d.year === 2020 && d.sector === sec)
            if (!rec2024 || !rec2020) return null
            const growth = (((rec2024.total_digital_m - rec2020.total_digital_m) / rec2020.total_digital_m) * 100).toFixed(0)
            return (
              <div key={sec} className="bg-gray-750 rounded p-3 border border-gray-700">
                <div className="text-xs text-gray-400 uppercase mb-1">{sec}</div>
                <div className="text-lg font-bold text-white">${rec2024.total_digital_m.toFixed(0)}M</div>
                <div className="text-xs text-gray-400">2024 total</div>
                <div className="text-xs text-green-400 mt-1">+{growth}% since 2020</div>
                <div className="text-xs text-gray-500">{rec2024.digital_as_pct_capex.toFixed(1)}% of CapEx</div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* Outcomes */}
      <Section title="Digital Technology Outcomes — Improvement % by Technology">
        <OutcomesChart data={data.outcomes} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="py-2 pr-4">Technology</th>
                <th className="py-2 pr-4">Metric</th>
                <th className="py-2 pr-4 text-right">Baseline</th>
                <th className="py-2 pr-4 text-right">Current</th>
                <th className="py-2 pr-4 text-right">Improvement</th>
                <th className="py-2 pr-4 text-right">Digital Attribution</th>
                <th className="py-2">Unit</th>
              </tr>
            </thead>
            <tbody>
              {data.outcomes.map((o, i) => (
                <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-medium text-white whitespace-nowrap">
                    {o.technology.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge
                      label={o.outcome_metric}
                      colorClass={OUTCOME_BADGE[o.outcome_metric] ?? 'bg-gray-600 text-white'}
                    />
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-400">{o.baseline_value.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right text-white">{o.current_value.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right text-green-400 font-semibold">
                    {o.improvement_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4 text-right text-blue-400">{o.attributable_to_digital_pct.toFixed(0)}%</td>
                  <td className="py-2 text-xs text-gray-400">{o.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Skills Gap */}
      <Section title="Digital Skills Gap Analysis — Current FTE vs 2030 Requirements">
        <SkillsGapChart data={data.skills} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="py-2 pr-4">Skill Area</th>
                <th className="py-2 pr-4 text-right">Current FTE</th>
                <th className="py-2 pr-4 text-right">Required 2030</th>
                <th className="py-2 pr-4 text-right">Gap 2030</th>
                <th className="py-2 pr-4 text-right">Avg Salary</th>
                <th className="py-2 pr-4 text-right">Training Inv.</th>
                <th className="py-2">Hire Difficulty</th>
              </tr>
            </thead>
            <tbody>
              {data.skills.map((s, i) => (
                <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-medium text-white">
                    {s.skill_area.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2 pr-4 text-right">{s.current_fte.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-green-400">{s.required_2030_fte.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-red-400 font-semibold">
                    {s.gap_2030.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right">${(s.avg_salary / 1000).toFixed(0)}K</td>
                  <td className="py-2 pr-4 text-right">${s.training_investment_m.toFixed(0)}M</td>
                  <td className="py-2">
                    <Badge
                      label={s.external_hire_difficulty}
                      colorClass={DIFFICULTY_BADGE[s.external_hire_difficulty] ?? 'bg-gray-600 text-white'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
