import { useEffect, useState } from 'react'
import { Zap, TrendingUp, Activity, AlertTriangle } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getGenerationExpansionDashboard } from '../api/client'
import type { GENADashboard } from '../api/client'

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
// Chart Card wrapper
// ---------------------------------------------------------------------------

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colour palette helpers
// ---------------------------------------------------------------------------

const TECH_COLORS: Record<string, string> = {
  Solar: '#f59e0b',
  Wind: '#3b82f6',
  'Wind+Storage': '#6366f1',
  'Solar+Storage': '#f97316',
  'Gas Peaker': '#ef4444',
  'Pumped Hydro': '#06b6d4',
  Nuclear: '#8b5cf6',
}

const STAGE_COLORS: Record<string, string> = {
  'Early Development': '#64748b',
  'DA Submitted': '#3b82f6',
  Approved: '#f59e0b',
  'Financial Close': '#22c55e',
  Construction: '#f97316',
}

const RETIREMENT_TECH_COLORS: Record<string, string> = {
  Coal: '#78716c',
  Gas: '#f97316',
  Oil: '#dc2626',
}

// ---------------------------------------------------------------------------
// Data preparation helpers
// ---------------------------------------------------------------------------

function buildCapacityByTech(data: GENADashboard) {
  const agg: Record<string, number> = {}
  for (const p of data.projects) {
    agg[p.technology] = (agg[p.technology] ?? 0) + p.capacity_mw
  }
  return Object.entries(agg).map(([technology, capacity_mw]) => ({
    technology,
    capacity_mw: Math.round(capacity_mw),
  }))
}

function buildLrmcTrend(data: GENADashboard) {
  const years = [2022, 2023, 2024, 2025, 2030]
  return years.map((year) => {
    const row: Record<string, number | string> = { year: String(year) }
    for (const rec of data.economics) {
      if (rec.year === year) {
        row[rec.technology] = rec.lrmc_mwh
      }
    }
    return row
  })
}

function buildPipelineByStageState(data: GENADashboard) {
  const states = Array.from(new Set(data.pipeline.map((p) => p.state))).sort()
  const stages = ['Early Development', 'DA Submitted', 'Approved', 'Financial Close', 'Construction']
  return states.map((state) => {
    const row: Record<string, number | string> = { state }
    for (const stage of stages) {
      const recs = data.pipeline.filter((p) => p.state === state && p.stage === stage && p.year === 2024)
      row[stage] = recs.reduce((s, r) => s + r.total_capacity_mw, 0)
    }
    return row
  })
}

function buildRetirementsSorted(data: GENADashboard) {
  return [...data.retirements]
    .sort((a, b) => b.capacity_mw - a.capacity_mw)
    .map((r) => ({
      plant_name: r.plant_name.replace(' Power Station', '').replace(' Power', ''),
      capacity_mw: r.capacity_mw,
      technology: r.technology,
      fill: RETIREMENT_TECH_COLORS[r.technology] ?? '#6b7280',
    }))
}

function buildIrrByTech2024(data: GENADashboard) {
  return data.economics
    .filter((e) => e.year === 2024)
    .map((e) => ({
      technology: e.technology,
      irr_pct: e.irr_pct,
    }))
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GenerationExpansionAnalytics() {
  const [data, setData] = useState<GENADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGenerationExpansionDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        Loading Generation Expansion Analytics…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const { summary } = data
  const capacityByTech = buildCapacityByTech(data)
  const lrmcTrend = buildLrmcTrend(data)
  const pipelineByStageState = buildPipelineByStageState(data)
  const retirementsSorted = buildRetirementsSorted(data)
  const irrByTech2024 = buildIrrByTech2024(data)
  const technologies = ['Solar', 'Wind', 'Wind+Storage', 'Solar+Storage', 'Gas Peaker', 'Pumped Hydro']
  const stages = ['Early Development', 'DA Submitted', 'Approved', 'Financial Close', 'Construction']

  return (
    <div className="p-6 bg-gray-900 min-h-full text-gray-100">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <Zap className="text-amber-400" size={24} />
        <div>
          <h1 className="text-xl font-bold text-white">Generation Expansion Analytics</h1>
          <p className="text-xs text-gray-400">
            GENA — New entry project pipeline, economics &amp; coal retirement transition
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="New Projects"
          value={summary.total_new_projects.toLocaleString()}
          sub="projects in pipeline"
          icon={Zap}
          color="bg-amber-600"
        />
        <KpiCard
          title="New Capacity"
          value={`${(summary.total_new_capacity_mw / 1000).toFixed(1)} GW`}
          sub="total pipeline MW"
          icon={TrendingUp}
          color="bg-blue-600"
        />
        <KpiCard
          title="Avg IRR"
          value={`${summary.avg_irr_pct.toFixed(1)}%`}
          sub="across all technologies"
          icon={Activity}
          color="bg-green-600"
        />
        <KpiCard
          title="Retiring Capacity"
          value={`${(summary.total_retirement_capacity_mw / 1000).toFixed(1)} GW`}
          sub="legacy plant retirements"
          icon={AlertTriangle}
          color="bg-red-600"
        />
      </div>

      {/* Charts — first row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Chart 1: Capacity by technology */}
        <ChartCard title="New Capacity by Technology (MW)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={capacityByTech} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="technology"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-30}
                textAnchor="end"
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                formatter={(v: number) => [`${v.toLocaleString()} MW`, 'Capacity']}
              />
              <Bar
                dataKey="capacity_mw"
                name="Capacity (MW)"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: IRR by technology (2024) */}
        <ChartCard title="IRR by Technology — 2024 (%)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={irrByTech2024} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="technology"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-30}
                textAnchor="end"
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                formatter={(v: number) => [`${v.toFixed(1)}%`, 'IRR']}
              />
              <Bar
                dataKey="irr_pct"
                name="IRR (%)"
                radius={[4, 4, 0, 0]}
              >
                {irrByTech2024.map((entry) => (
                  <rect key={entry.technology} fill={TECH_COLORS[entry.technology] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts — second row */}
      <div className="grid grid-cols-1 gap-5 mb-5">
        {/* Chart 2: LRMC trend */}
        <ChartCard title="LRMC Trend 2022–2030 by Technology ($/MWh)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={lrmcTrend} margin={{ top: 4, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/MWh" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                formatter={(v: number, name: string) => [`$${v.toFixed(2)}/MWh`, name]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {technologies.map((tech) => (
                <Line
                  key={tech}
                  type="monotone"
                  dataKey={tech}
                  stroke={TECH_COLORS[tech] ?? '#6b7280'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts — third row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 3: Pipeline by stage and state (stacked) */}
        <ChartCard title="Pipeline Capacity by Stage &amp; State — 2024 (MW, stacked)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineByStageState} margin={{ top: 4, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                formatter={(v: number, name: string) => [`${v.toLocaleString()} MW`, name]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {stages.map((stage) => (
                <Bar
                  key={stage}
                  dataKey={stage}
                  stackId="a"
                  fill={STAGE_COLORS[stage] ?? '#6b7280'}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Retirement capacity sorted desc */}
        <ChartCard title="Retiring Plant Capacity (MW, sorted descending)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={retirementsSorted}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 80, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="plant_name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                width={80}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                formatter={(v: number, _name: string, props) => [
                  `${v.toLocaleString()} MW`,
                  props.payload.technology,
                ]}
              />
              <Bar dataKey="capacity_mw" name="Capacity (MW)" radius={[0, 4, 4, 0]}>
                {retirementsSorted.map((entry, idx) => (
                  <rect
                    key={idx}
                    fill={RETIREMENT_TECH_COLORS[entry.technology] ?? '#6b7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
