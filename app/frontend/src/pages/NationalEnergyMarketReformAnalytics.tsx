import React, { useEffect, useState } from 'react'
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
import { BookOpen } from 'lucide-react'
import {
  getNationalEnergyMarketReformDashboard,
  NEMRIDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const STATUS_COLOURS: Record<string, string> = {
  'Implemented':        '#10b981',
  'Rule Made':          '#3b82f6',
  'Final Rule':         '#8b5cf6',
  'Consultation':       '#f59e0b',
  'Proposed':           '#ef4444',
}

const POSITION_COLOURS: Record<string, string> = {
  'Support':            '#10b981',
  'Oppose':             '#ef4444',
  'Conditional Support':'#f59e0b',
  'Neutral':            '#6b7280',
}

const BARRIER_COLOURS: Record<string, string> = {
  'Vendor delays':          '#ef4444',
  'Stakeholder opposition': '#f59e0b',
  'Regulatory complexity':  '#8b5cf6',
  'IT legacy systems':      '#3b82f6',
  'Resource constraints':   '#06b6d4',
  'None':                   '#10b981',
}

const REFORM_LINE_COLOURS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-medium">
        <BookOpen size={16} />
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function NationalEnergyMarketReformAnalytics() {
  const [data, setData] = useState<NEMRIDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNationalEnergyMarketReformDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading National Energy Market Reform Impact Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>

  // ── Chart 1: Bar — estimated_consumer_benefit_b by reform_name coloured by status ──
  const benefitChartData = data.reforms.map((r) => ({
    reform_label: r.reform_name.length > 22 ? r.reform_name.slice(0, 20) + '…' : r.reform_name,
    reform_name: r.reform_name,
    benefit: r.estimated_consumer_benefit_b,
    status: r.status,
  }))

  // ── Chart 2: Grouped bar — improvement_pct by metric_name for top 10 reforms ──
  const top10Reforms = data.reforms.slice(0, 10).map((r) => r.reform_name)
  const metricNames = Array.from(new Set(data.impacts.map((i) => i.metric_name)))
  const impactByReform: Record<string, Record<string, number>> = {}
  for (const imp of data.impacts) {
    if (!top10Reforms.includes(imp.reform_name)) continue
    if (!impactByReform[imp.reform_name]) impactByReform[imp.reform_name] = {}
    // use the first occurrence per metric per reform
    if (impactByReform[imp.reform_name][imp.metric_name] === undefined) {
      impactByReform[imp.reform_name][imp.metric_name] = imp.improvement_pct
    }
  }
  const impactChartData = top10Reforms.map((rn) => ({
    reform_label: rn.length > 22 ? rn.slice(0, 20) + '…' : rn,
    reform_name: rn,
    ...(impactByReform[rn] ?? {}),
  }))
  const metricColours: Record<string, string> = {
    'Consumer Bills ($)':   '#3b82f6',
    'RE Penetration (%)':   '#10b981',
    'System Reliability (%)': '#f59e0b',
    'Market Efficiency ($M)': '#8b5cf6',
  }

  // ── Chart 3: Bar — submission_count by stakeholder_group coloured by position ──
  const stakeholderGroups = Array.from(new Set(data.stakeholder_positions.map((sp) => sp.stakeholder_group)))
  const positionsList = Array.from(new Set(data.stakeholder_positions.map((sp) => sp.position)))
  const submissionByGroupPos: Record<string, Record<string, number>> = {}
  for (const sp of data.stakeholder_positions) {
    if (!submissionByGroupPos[sp.stakeholder_group]) submissionByGroupPos[sp.stakeholder_group] = {}
    submissionByGroupPos[sp.stakeholder_group][sp.position] =
      (submissionByGroupPos[sp.stakeholder_group][sp.position] ?? 0) + sp.submission_count
  }
  const stakeholderChartData = stakeholderGroups.map((grp) => ({
    group_label: grp.length > 20 ? grp.slice(0, 18) + '…' : grp,
    stakeholder_group: grp,
    ...(submissionByGroupPos[grp] ?? {}),
  }))

  // ── Chart 4: Bar — delay_months by reform_name (phase delays summed) coloured by barrier ──
  const implementedReforms = Array.from(new Set(data.implementation_progress.map((ip) => ip.reform_name)))
  const barrierList = Array.from(new Set(data.implementation_progress.map((ip) => ip.barrier)))
  const delayByReformBarrier: Record<string, Record<string, number>> = {}
  for (const ip of data.implementation_progress) {
    if (!delayByReformBarrier[ip.reform_name]) delayByReformBarrier[ip.reform_name] = {}
    delayByReformBarrier[ip.reform_name][ip.barrier] =
      (delayByReformBarrier[ip.reform_name][ip.barrier] ?? 0) + ip.delay_months
  }
  const delayChartData = implementedReforms.map((rn) => ({
    reform_label: rn.length > 20 ? rn.slice(0, 18) + '…' : rn,
    reform_name: rn,
    ...(delayByReformBarrier[rn] ?? {}),
  }))

  // ── Chart 5: Line — actual_benefit_m vs projected_benefit_m by year for 6 reforms ──
  const benefitRealisationReforms = Array.from(new Set(data.benefit_realisation.map((b) => b.reform_name))).slice(0, 6)
  const years = Array.from(new Set(data.benefit_realisation.map((b) => b.year))).sort((a, b) => a - b)
  const actualByReformYear: Record<string, Record<number, number>> = {}
  const projectedByReformYear: Record<string, Record<number, number>> = {}
  for (const b of data.benefit_realisation) {
    if (!benefitRealisationReforms.includes(b.reform_name)) continue
    if (!actualByReformYear[b.reform_name]) actualByReformYear[b.reform_name] = {}
    if (!projectedByReformYear[b.reform_name]) projectedByReformYear[b.reform_name] = {}
    actualByReformYear[b.reform_name][b.year] = b.actual_benefit_m
    projectedByReformYear[b.reform_name][b.year] = b.projected_benefit_m
  }
  const benefitLineData = years.map((yr) => {
    const row: Record<string, unknown> = { year: yr }
    for (const rn of benefitRealisationReforms) {
      const shortName = rn.length > 18 ? rn.slice(0, 16) + '…' : rn
      row[`${shortName} Actual`] = actualByReformYear[rn]?.[yr] ?? null
      row[`${shortName} Projected`] = projectedByReformYear[rn]?.[yr] ?? null
    }
    return row
  })
  const benefitLineKeys: { key: string; colour: string; dashed: boolean }[] = []
  benefitRealisationReforms.forEach((rn, idx) => {
    const shortName = rn.length > 18 ? rn.slice(0, 16) + '…' : rn
    const colour = REFORM_LINE_COLOURS[idx % REFORM_LINE_COLOURS.length]
    benefitLineKeys.push({ key: `${shortName} Actual`, colour, dashed: false })
    benefitLineKeys.push({ key: `${shortName} Projected`, colour, dashed: true })
  })

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen size={28} className="text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            National Energy Market Reform Impact Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sprint 127c — NEMRI | AEMC Rule Changes, Stakeholder Positions, Implementation Progress &amp; Benefit Realisation
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Reforms Implemented"
          value={String(summary.total_reforms_implemented ?? '—')}
          sub="Rules with Implemented status in the NEM"
        />
        <KpiCard
          label="Total Consumer Benefit"
          value={`$${Number(summary.total_consumer_benefit_b ?? 0).toFixed(1)}B`}
          sub="Aggregate estimated consumer benefit across all reforms"
        />
        <KpiCard
          label="Avg Implementation Delay"
          value={`${Number(summary.avg_delay_months ?? 0).toFixed(1)} months`}
          sub="Average months delayed across implementation phases"
        />
        <KpiCard
          label="Most Contested Reform"
          value={String(summary.most_contested_reform ?? '—')}
          sub="Reform with highest total submission count"
        />
      </div>

      {/* Chart 1: Consumer benefit by reform coloured by status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Estimated Consumer Benefit ($B) by Reform — Coloured by Status
        </h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={benefitChartData} margin={{ top: 4, right: 24, bottom: 100, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="reform_label"
              tick={{ fontSize: 9 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{ value: '$B', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <Tooltip
              formatter={(value: unknown) => [`$${Number(value).toFixed(2)}B`, 'Consumer Benefit']}
              labelFormatter={(label: string) => {
                const rec = benefitChartData.find((d) => d.reform_label === label)
                return rec ? `${rec.reform_name} (${rec.status})` : label
              }}
            />
            <Legend />
            {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
              <Bar
                key={status}
                dataKey={(entry: Record<string, unknown>) =>
                  (entry as { status: string; benefit: number }).status === status
                    ? (entry as { benefit: number }).benefit
                    : null
                }
                name={status}
                fill={colour}
                stackId="status"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Grouped bar — improvement_pct by metric for top 10 reforms */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Reform Impact — Improvement % by Metric (Top 10 Reforms)
        </h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={impactChartData} margin={{ top: 4, right: 24, bottom: 100, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="reform_label"
              tick={{ fontSize: 9 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{ value: '% Improvement', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <Tooltip formatter={(value: unknown, name: string) => [`${Number(value).toFixed(2)}%`, name]} />
            <Legend />
            {metricNames.map((mn) => (
              <Bar
                key={mn}
                dataKey={mn}
                fill={metricColours[mn] ?? '#6b7280'}
                name={mn}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Bar — submission_count by stakeholder_group coloured by position */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Stakeholder Submissions by Group — Coloured by Position
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={stakeholderChartData} margin={{ top: 4, right: 24, bottom: 60, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="group_label"
              tick={{ fontSize: 10 }}
              angle={-20}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{ value: 'Submissions', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <Tooltip formatter={(value: unknown, name: string) => [Number(value).toLocaleString(), name]} />
            <Legend />
            {positionsList.map((pos) => (
              <Bar
                key={pos}
                dataKey={pos}
                fill={POSITION_COLOURS[pos] ?? '#6b7280'}
                name={pos}
                stackId="pos"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Bar — delay_months by reform (phase delays summed) coloured by barrier */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Total Implementation Delay (months) by Reform — Coloured by Barrier
        </h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={delayChartData} margin={{ top: 4, right: 24, bottom: 80, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="reform_label"
              tick={{ fontSize: 9 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{ value: 'Months', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <Tooltip formatter={(value: unknown, name: string) => [`${Number(value)} months`, name]} />
            <Legend />
            {barrierList.map((barrier) => (
              <Bar
                key={barrier}
                dataKey={barrier}
                fill={BARRIER_COLOURS[barrier] ?? '#6b7280'}
                name={barrier}
                stackId="barrier"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Line — actual vs projected benefit by year for 6 reforms */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Benefit Realisation ($M): Actual vs Projected by Year — 6 Reforms
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={benefitLineData} margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{ value: '$M', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <Tooltip formatter={(value: unknown, name: string) => [`$${Number(value).toFixed(1)}M`, name]} />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            {benefitLineKeys.map(({ key, colour, dashed }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colour}
                strokeDasharray={dashed ? '5 3' : undefined}
                dot={false}
                strokeWidth={dashed ? 1.5 : 2}
                name={key}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary DL grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Dashboard Summary
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          {Object.entries(summary).map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                {k.replace(/_/g, ' ')}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                {typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
