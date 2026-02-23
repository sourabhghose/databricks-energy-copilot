import { useEffect, useState } from 'react'
import { Scale } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getElectricityMarketRegulatoryAppealsDashboard,
  EMRDDashboard,
} from '../api/client'

const OUTCOME_COLORS: Record<string, string> = {
  Upheld:            '#22c55e',
  'Partially Upheld':'#86efac',
  Dismissed:         '#ef4444',
  Settled:           '#f59e0b',
  Remitted:          '#6366f1',
}

const STAGE_COLORS: Record<string, string> = {
  Implemented: '#22c55e',
  'Final Rule': '#86efac',
  Draft:        '#f59e0b',
  Consultation: '#6366f1',
  Initiation:   '#94a3b8',
}

const REGULATOR_COLORS: Record<string, string> = {
  AER:  '#6366f1',
  AEMO: '#22c55e',
  ACCC: '#f59e0b',
}

const VIOLATION_COLORS: Record<string, string> = {
  'Market Manipulation': '#ef4444',
  'Late Reporting':      '#f59e0b',
  'Information Disclosure': '#6366f1',
  Registration:          '#22c55e',
  Safety:                '#22d3ee',
  'Ring-fencing':        '#a855f7',
  Metering:              '#94a3b8',
}

export default function ElectricityMarketRegulatoryAppealsAnalytics() {
  const [data, setData]       = useState<EMRDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getElectricityMarketRegulatoryAppealsDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading Electricity Market Regulatory Appeals Analytics...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400">
        <span className="text-lg">Error: {error ?? 'No data available'}</span>
      </div>
    )
  }

  const {
    rule_changes,
    appeals,
    network_determinations,
    penalties,
    compliance_trends,
    summary,
  } = data

  // ---- KPI Cards ----
  const kpis = [
    {
      label: 'Active Rule Changes',
      value: `${summary.total_rule_changes_active}`,
      sub: 'In pipeline (Initiation/Consultation/Draft)',
      color: 'text-indigo-400',
    },
    {
      label: 'Total Penalties YTD',
      value: `$${(summary.total_penalties_ytd_m as number).toFixed(1)}M`,
      sub: 'Penalties issued in 2023',
      color: 'text-red-400',
    },
    {
      label: 'Appeals Success Rate',
      value: `${summary.appeals_success_rate_pct}%`,
      sub: 'Upheld / Partial / Settled / Remitted',
      color: 'text-green-400',
    },
    {
      label: 'Latest Compliance Rate',
      value: `${(summary.compliance_rate_latest_pct as number).toFixed(1)}%`,
      sub: 'Avg across regulators (2024)',
      color: 'text-yellow-400',
    },
  ]

  // ---- Chart 1: Rule Change Pipeline — horizontal BarChart, duration_days by change_id ----
  const pipelineData = [...rule_changes]
    .sort((a, b) => b.duration_days - a.duration_days)
    .slice(0, 12)
    .map((rc) => ({
      name: rc.change_id,
      title: rc.title.length > 30 ? rc.title.slice(0, 28) + '…' : rc.title,
      duration_days: rc.duration_days,
      stage: rc.stage,
      fill: STAGE_COLORS[rc.stage] ?? '#94a3b8',
    }))

  // ---- Chart 2: Appeal Outcomes — count by outcome × jurisdiction ----
  const jurisdictions = ['AEMC', 'AER', 'ACT', 'Federal Court', 'High Court']
  const outcomesList  = ['Upheld', 'Partially Upheld', 'Dismissed', 'Settled', 'Remitted']
  const appealsByJurisdiction: Record<string, Record<string, number>> = {}
  appeals.forEach((a) => {
    if (!appealsByJurisdiction[a.jurisdiction]) appealsByJurisdiction[a.jurisdiction] = {}
    const o = a.outcome ?? 'Unknown'
    appealsByJurisdiction[a.jurisdiction][o] = (appealsByJurisdiction[a.jurisdiction][o] ?? 0) + 1
  })
  const appealsChartData = jurisdictions.map((j) => ({
    jurisdiction: j,
    ...outcomesList.reduce((acc, o) => ({ ...acc, [o]: appealsByJurisdiction[j]?.[o] ?? 0 }), {}),
  }))

  // ---- Chart 3: Network Revenue Reductions — aar_reduction_m by network_name ----
  const networkReductionData = [...network_determinations]
    .sort((a, b) => b.aar_reduction_m - a.aar_reduction_m)
    .map((n) => ({
      name: n.network_name.length > 18 ? n.network_name.slice(0, 16) + '…' : n.network_name,
      aar_reduction_m: n.aar_reduction_m,
      appellant: n.appellant,
    }))

  // ---- Chart 4: Penalty Trend — total_penalties_m by year × regulator ----
  const penaltyTrendByYear: Record<string, Record<string, number>> = {}
  compliance_trends.forEach((ct) => {
    const k = String(ct.year)
    if (!penaltyTrendByYear[k]) penaltyTrendByYear[k] = {}
    penaltyTrendByYear[k][ct.regulator] = (penaltyTrendByYear[k][ct.regulator] ?? 0) + ct.total_penalties_m
  })
  const penaltyTrendData = Object.entries(penaltyTrendByYear)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yr, vals]) => ({ year: yr, ...vals }))

  // ---- Chart 5: Compliance Rate — compliance_rate_pct by year × regulator with industry_cost overlay ----
  const complianceByYearReg: Record<string, Record<string, number>> = {}
  const industryCostByYear: Record<string, number> = {}
  compliance_trends.forEach((ct) => {
    const k = String(ct.year)
    if (!complianceByYearReg[k]) complianceByYearReg[k] = {}
    complianceByYearReg[k][ct.regulator] = ct.compliance_rate_pct
    industryCostByYear[k] = (industryCostByYear[k] ?? 0) + ct.industry_cost_m
  })
  const complianceChartData = Object.entries(complianceByYearReg)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yr, vals]) => ({
      year: yr,
      ...vals,
      industry_cost_m: industryCostByYear[yr] ?? 0,
    }))

  // ---- Chart 6: Penalty Overview — penalty_amount_m by violation_type × participant ----
  const penaltyByViolation: Record<string, Record<string, number>> = {}
  penalties.forEach((p) => {
    if (!penaltyByViolation[p.violation_type]) penaltyByViolation[p.violation_type] = {}
    penaltyByViolation[p.violation_type][p.participant] =
      (penaltyByViolation[p.violation_type][p.participant] ?? 0) + p.penalty_amount_m
  })
  const violationTypes = Object.keys(penaltyByViolation)
  const topParticipants = [...new Set(penalties.map((p) => p.participant))].slice(0, 6)
  const penaltyOverviewData = violationTypes.map((vt) => ({
    violation_type: vt.length > 20 ? vt.slice(0, 18) + '…' : vt,
    ...topParticipants.reduce(
      (acc, part) => ({ ...acc, [part]: penaltyByViolation[vt]?.[part] ?? 0 }),
      {},
    ),
  }))

  const PARTICIPANT_COLORS = [
    '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#22d3ee', '#a855f7',
  ]

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Scale className="text-indigo-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Electricity Market Regulatory Appeals &amp; Decisions
          </h1>
          <p className="text-gray-400 text-sm">
            AEMC rule changes, AER network determinations, appeal decisions, penalties &amp; compliance — Australian Energy Market
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Chart 1: Rule Change Pipeline */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Rule Change Pipeline — Duration by Change (days)
          </h2>
          <div className="mb-2 flex flex-wrap gap-2">
            {Object.entries(STAGE_COLORS).map(([stage, color]) => (
              <span key={stage} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} />
                {stage}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              layout="vertical"
              data={pipelineData}
              margin={{ top: 4, right: 24, left: 60, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" d" />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#9ca3af"
                tick={{ fontSize: 11 }}
                width={58}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', color: '#f3f4f6' }}
                formatter={(val: number, _name: string, props: { payload?: { title?: string; stage?: string } }) => [
                  `${val} days`,
                  props.payload?.title ?? 'Duration',
                ]}
                labelFormatter={(label) => `ID: ${label}`}
              />
              <Bar dataKey="duration_days" name="Duration (days)" radius={[0, 3, 3, 0]}>
                {pipelineData.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Appeal Outcomes */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Appeal Outcomes by Jurisdiction
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={appealsChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="jurisdiction" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#f3f4f6' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {outcomesList.map((outcome) => (
                <Bar
                  key={outcome}
                  dataKey={outcome}
                  stackId="a"
                  fill={OUTCOME_COLORS[outcome] ?? '#94a3b8'}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Network Revenue Reductions */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Network Revenue Reductions — AER vs Proposals ($M)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={networkReductionData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                stroke="#9ca3af"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit="M" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', color: '#f3f4f6' }}
                formatter={(val: number) => [`$${val.toFixed(0)}M`, 'AAR Reduction']}
              />
              <Bar dataKey="aar_reduction_m" name="AAR Reduction ($M)" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Penalty Trend */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Penalty Trend by Year &amp; Regulator ($M)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={penaltyTrendData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit="M" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', color: '#f3f4f6' }}
                formatter={(val: number) => [`$${val.toFixed(1)}M`]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {['AER', 'AEMO', 'ACCC'].map((reg) => (
                <Line
                  key={reg}
                  type="monotone"
                  dataKey={reg}
                  stroke={REGULATOR_COLORS[reg] ?? '#94a3b8'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 5: Compliance Rate with industry cost overlay */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Compliance Rate (%) by Year &amp; Regulator — with Industry Cost ($M)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={complianceChartData} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                domain={[90, 100]}
                stroke="#9ca3af"
                tick={{ fontSize: 11 }}
                unit="%"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#f59e0b"
                tick={{ fontSize: 11 }}
                unit="M"
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {['AER', 'AEMO', 'ACCC'].map((reg) => (
                <Line
                  key={reg}
                  yAxisId="left"
                  type="monotone"
                  dataKey={reg}
                  stroke={REGULATOR_COLORS[reg] ?? '#94a3b8'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="industry_cost_m"
                name="Industry Cost ($M)"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 6: Penalty Overview by violation type */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Penalty Overview — Amount ($M) by Violation Type &amp; Participant
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={penaltyOverviewData}
              margin={{ top: 4, right: 16, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="violation_type"
                stroke="#9ca3af"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit="M" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', color: '#f3f4f6' }}
                formatter={(val: number) => [`$${val.toFixed(2)}M`]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {topParticipants.map((part, i) => (
                <Bar
                  key={part}
                  dataKey={part}
                  stackId="b"
                  fill={PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary footer */}
      <div className="mt-6 bg-gray-800 rounded-lg p-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-400">Total Network Revenue Reduction</p>
          <p className="text-lg font-bold text-indigo-400">
            ${(summary.total_network_revenue_reduction_m as number).toLocaleString()}M
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Avg Rule Change Duration</p>
          <p className="text-lg font-bold text-yellow-400">
            {summary.avg_rule_change_duration_days} days
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Appeals Success Rate</p>
          <p className="text-lg font-bold text-green-400">
            {summary.appeals_success_rate_pct}%
          </p>
        </div>
      </div>
    </div>
  )
}
