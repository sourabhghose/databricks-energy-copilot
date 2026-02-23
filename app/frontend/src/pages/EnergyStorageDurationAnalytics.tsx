import { useEffect, useState } from 'react'
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
import { Clock } from 'lucide-react'
import {
  getEnergyStorageDurationDashboard,
  type ESDAdash,
} from '../api/client'

// ── colour palettes ──────────────────────────────────────────────────────────
const CATEGORY_COLOURS: Record<string, string> = {
  Electrochemical: '#3b82f6',
  Mechanical:      '#10b981',
  Thermal:         '#f59e0b',
}

const STATUS_COLOURS: Record<string, string> = {
  Operating:    '#10b981',
  Construction: '#3b82f6',
  Approved:     '#f59e0b',
  Proposed:     '#8b5cf6',
}

const TECH_LINE_COLOURS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
]

// ── small helpers ────────────────────────────────────────────────────────────
function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow flex flex-col gap-1">
      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-lg font-bold text-gray-900 dark:text-white truncate">{value}</span>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
      {children}
    </h2>
  )
}

// ── main page ────────────────────────────────────────────────────────────────
export default function EnergyStorageDurationAnalytics() {
  const [data, setData] = useState<ESDAdash | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    getEnergyStorageDurationDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <Clock className="animate-spin mr-2" size={20} />
        Loading Energy Storage Duration Analytics…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-500">
        Failed to load dashboard: {error ?? 'Unknown error'}
      </div>
    )
  }

  const { technologies, pipeline, cost_projections, market_values, suitability_scores, summary } = data

  // ── Chart 1 data: cost by technology ──────────────────────────────────────
  const costBarData = technologies.map(t => ({
    technology: t.technology.replace(' ', '\n'),
    cost:       t.current_cost_aud_kwh,
    category:   t.category,
  }))

  // ── Chart 2 data: cost projections — pivot by year ────────────────────────
  const years = [2024, 2025, 2027, 2030, 2035, 2040]
  const techNames = technologies.map(t => t.technology)
  const costLineData = years.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    techNames.forEach(tn => {
      const entry = cost_projections.find(cp => cp.technology === tn && cp.year === yr)
      if (entry) row[tn] = entry.cost_aud_kwh
    })
    return row
  })

  // ── Chart 3 data: top-10 pipeline projects by energy_mwh ─────────────────
  const top10Pipeline = [...pipeline]
    .sort((a, b) => b.energy_mwh - a.energy_mwh)
    .slice(0, 10)
    .map(p => ({ name: p.project_name.replace(' ', '\n'), energy_mwh: p.energy_mwh, status: p.status }))

  // ── Chart 4 data: revenue by technology × region (2024) ──────────────────
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const mv2024 = market_values.filter(mv => mv.year === 2024)
  const revenueGroupData = techNames.map(tn => {
    const row: Record<string, number | string> = { technology: tn.length > 14 ? tn.slice(0, 13) + '…' : tn }
    regions.forEach(r => {
      const entry = mv2024.find(mv => mv.technology === tn && mv.region === r)
      row[r] = entry ? entry.total_revenue_aud_kwh : 0
    })
    return row
  })

  // ── Chart 5 data: suitability by technology for top-3 applications ────────
  const appTotals: Record<string, number> = {}
  suitability_scores.forEach(s => {
    appTotals[s.application] = (appTotals[s.application] ?? 0) + s.total_score
  })
  const top3Apps = Object.entries(appTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([a]) => a)

  const suitabilityData = techNames.map(tn => {
    const row: Record<string, number | string> = { technology: tn.length > 14 ? tn.slice(0, 13) + '…' : tn }
    top3Apps.forEach(app => {
      const entry = suitability_scores.find(s => s.technology === tn && s.application === app)
      row[app] = entry ? entry.total_score : 0
    })
    return row
  })

  const APP_COLOURS = ['#3b82f6', '#10b981', '#f59e0b']

  return (
    <div className="p-6 space-y-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Clock size={24} className="text-blue-500" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Energy Storage Duration Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Australia storage technology comparison, pipeline, costs and market value — Sprint 136a
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Pipeline Storage"
          value={`${summary.total_storage_mwh_pipeline.toLocaleString()} MWh`}
        />
        <KpiCard
          label="Avg Duration — Pipeline"
          value={`${summary.avg_duration_hours_pipeline} hrs`}
        />
        <KpiCard
          label="Dominant Technology"
          value={summary.dominant_technology}
        />
        <KpiCard
          label="Lowest Cost Technology"
          value={summary.lowest_cost_technology}
        />
        <KpiCard
          label="Highest Revenue Technology"
          value={summary.highest_revenue_technology}
        />
      </div>

      {/* Chart 1 — Current cost by technology */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeading>Current Installed Cost by Technology (AUD/kWh)</SectionHeading>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={costBarData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="technology"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/kWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(value: number) => [`$${value.toFixed(0)}/kWh`, 'Cost']}
            />
            <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
              {costBarData.map((entry, index) => (
                <rect
                  key={`cell-${index}`}
                  fill={CATEGORY_COLOURS[entry.category] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Category legend */}
        <div className="flex gap-4 mt-2 flex-wrap">
          {Object.entries(CATEGORY_COLOURS).map(([cat, colour]) => (
            <span key={cat} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2 — Projected cost by year for each technology */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeading>Projected Cost Reduction by Technology (AUD/kWh, 2024–2040)</SectionHeading>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={costLineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/kWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(value: number) => [`$${value.toFixed(0)}/kWh`]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            {techNames.map((tn, i) => (
              <Line
                key={tn}
                type="monotone"
                dataKey={tn}
                stroke={TECH_LINE_COLOURS[i % TECH_LINE_COLOURS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3 — Top-10 pipeline projects by energy (stacked by status) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeading>Top 10 Pipeline Projects by Energy Capacity (MWh)</SectionHeading>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top10Pipeline} layout="vertical" margin={{ top: 5, right: 20, left: 180, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MWh" />
            <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} width={175} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(value: number) => [`${value.toLocaleString()} MWh`, 'Capacity']}
            />
            {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
              <Bar
                key={status}
                dataKey={(entry: { status: string; energy_mwh: number }) =>
                  entry.status === status ? entry.energy_mwh : 0
                }
                name={status}
                stackId="a"
                fill={colour}
                radius={[0, 4, 4, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 flex-wrap">
          {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
            <span key={status} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
              {status}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 4 — Total revenue by technology × region (2024) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeading>Total Revenue by Technology and Region — 2024 (AUD/kWh)</SectionHeading>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={revenueGroupData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="technology"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/kWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(value: number) => [`$${value.toFixed(2)}/kWh`]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            {regions.map((r, i) => (
              <Bar
                key={r}
                dataKey={r}
                fill={TECH_LINE_COLOURS[i % TECH_LINE_COLOURS.length]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 — Suitability scores for top-3 applications */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeading>
          Suitability Score by Technology — Top 3 Applications: {top3Apps.join(', ')}
        </SectionHeading>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={suitabilityData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="technology"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 10]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(value: number) => [value.toFixed(2), '']}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            {top3Apps.map((app, i) => (
              <Bar
                key={app}
                dataKey={app}
                fill={APP_COLOURS[i]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeading>Summary</SectionHeading>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Total Pipeline Storage</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {summary.total_storage_mwh_pipeline.toLocaleString()} MWh
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Avg Duration (Pipeline)</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {summary.avg_duration_hours_pipeline} hrs
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Dominant Technology</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {summary.dominant_technology}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Lowest Cost Technology</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {summary.lowest_cost_technology}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Highest Revenue Technology</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {summary.highest_revenue_technology}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Technologies Tracked</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {technologies.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Pipeline Projects</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {pipeline.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Cost Projection Data Points</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {cost_projections.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Market Value Records</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {market_values.length}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
