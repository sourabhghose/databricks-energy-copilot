import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
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
  Cell,
} from 'recharts'
import {
  getNetworkAssetLifeCycleDashboard,
  ENALCDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#eab308',
  Low:      '#22c55e',
}

const ACTION_COLORS: Record<string, string> = {
  Replace:   '#ef4444',
  Refurbish: '#f97316',
  Monitor:   '#eab308',
  Accept:    '#22c55e',
}

const STATUS_COLORS: Record<string, string> = {
  Completed:    '#22c55e',
  'In Progress':'#3b82f6',
  Approved:     '#a855f7',
  Proposed:     '#9ca3af',
}

const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6']

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 1 — Asset class condition score vs % past design life (grouped bar)
// ---------------------------------------------------------------------------

function AssetClassConditionChart({ data }: { data: ENALCDashboard['asset_classes'] }) {
  const chartData = data.map(ac => ({
    name: ac.class_name.length > 14 ? ac.class_name.substring(0, 13) + '…' : ac.class_name,
    condition_score: ac.condition_score,
    pct_past_design_life: ac.pct_past_design_life,
    replacement_priority: ac.replacement_priority,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Asset Class — Condition Score vs % Past Design Life
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ left: 0, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="condition_score" name="Condition Score (0-10)" fill="#6366f1" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={PRIORITY_COLORS[entry.replacement_priority] ?? '#6366f1'} />
            ))}
          </Bar>
          <Bar dataKey="pct_past_design_life" name="% Past Design Life" fill="#94a3b8" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-2">
        {Object.entries(PRIORITY_COLORS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: v }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 2 — Top 25 individual asset risk scores (bar, coloured by action_required)
// ---------------------------------------------------------------------------

function AssetRiskChart({ data }: { data: ENALCDashboard['conditions'] }) {
  const sorted = [...data].sort((a, b) => b.risk_score - a.risk_score).slice(0, 25)

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Top 25 Individual Asset Risk Scores (descending)
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
          <YAxis
            type="category"
            dataKey="asset_id"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            width={90}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
            formatter={(v: number) => [v.toFixed(1), 'Risk Score']}
          />
          <Bar dataKey="risk_score" name="Risk Score" radius={[0, 3, 3, 0]}>
            {sorted.map((entry, idx) => (
              <Cell key={idx} fill={ACTION_COLORS[entry.action_required] ?? '#6366f1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-2">
        {Object.entries(ACTION_COLORS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: v }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 3 — Replacement CAPEX by year (bar, coloured by priority)
// ---------------------------------------------------------------------------

function ReplacementCapexChart({ data }: { data: ENALCDashboard['replacements'] }) {
  const byYear: Record<number, Record<string, number>> = {}
  for (const r of data) {
    if (!byYear[r.replacement_year]) byYear[r.replacement_year] = { Critical: 0, High: 0, Medium: 0, Low: 0 }
    byYear[r.replacement_year][r.priority] = (byYear[r.replacement_year][r.priority] ?? 0) + r.capex_m_aud
  }
  const chartData = Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, vals]) => ({
      year: String(year),
      Critical: Math.round(vals.Critical * 10) / 10,
      High: Math.round(vals.High * 10) / 10,
      Medium: Math.round(vals.Medium * 10) / 10,
      Low: Math.round(vals.Low * 10) / 10,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Replacement CAPEX Pipeline by Year (A$m) — by Priority
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ left: 0, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" M" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
            formatter={(v: number) => [`$${v.toFixed(1)}M`, '']}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {(['Critical', 'High', 'Medium', 'Low'] as const).map(p => (
            <Bar key={p} dataKey={p} fill={PRIORITY_COLORS[p]} stackId="a" radius={p === 'Low' ? [3, 3, 0, 0] : undefined} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 4 — Owner asset-related SAIDI trend 2022-2024 (line)
// ---------------------------------------------------------------------------

function SaidiTrendChart({ data }: { data: ENALCDashboard['reliability_impact'] }) {
  const owners = [...new Set(data.map(d => d.owner))]
  const years = [2022, 2023, 2024]

  const chartData = years.map(year => {
    const row: Record<string, number | string> = { year: String(year) }
    for (const owner of owners) {
      const rec = data.find(d => d.owner === owner && d.year === year)
      row[owner] = rec ? rec.asset_related_saidi_mins : 0
    }
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Asset-Related SAIDI Trend by Owner 2022–2024 (mins)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ left: 0, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" min" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
            formatter={(v: number) => [`${v.toFixed(1)} min`, '']}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {owners.map((owner, idx) => (
            <Line
              key={owner}
              type="monotone"
              dataKey={owner}
              stroke={LINE_COLORS[idx % LINE_COLORS.length]}
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

// ---------------------------------------------------------------------------
// Chart 5 — Quarterly spend breakdown (stacked bar) by owner
// ---------------------------------------------------------------------------

function QuarterlySpendChart({ data }: { data: ENALCDashboard['spend'] }) {
  const chartData = data.map(s => ({
    key: `${s.owner} ${s.year} ${s.quarter}`,
    label: `${s.quarter} ${s.year}`.replace(/(\w+) (\d{4})/, '$1\'$2'.slice(0, 10)),
    owner: s.owner,
    year: s.year,
    quarter: s.quarter,
    'Replacement CAPEX': s.replacement_capex_m_aud,
    'Augmentation CAPEX': s.augmentation_capex_m_aud,
    'Condition Maint': s.condition_based_maint_m_aud,
    'Corrective Maint': s.corrective_maint_m_aud,
  }))

  // Group by owner for separate mini-charts — show Ausgrid as representative
  const ausgridData = chartData.filter(d => d.owner === 'Ausgrid')

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-200 mb-1">
        Quarterly Spend Breakdown — Ausgrid (A$m)
      </h3>
      <p className="text-xs text-gray-500 mb-3">Replacement CAPEX / Augmentation CAPEX / Condition-Based Maint / Corrective Maint</p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={ausgridData} margin={{ left: 0, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="quarter"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickFormatter={(v, idx) => `${v} ${ausgridData[idx]?.year ?? ''}`}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" M" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
            formatter={(v: number) => [`$${v.toFixed(1)}M`, '']}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Bar dataKey="Replacement CAPEX"   fill="#6366f1" stackId="s" />
          <Bar dataKey="Augmentation CAPEX"  fill="#22c55e" stackId="s" />
          <Bar dataKey="Condition Maint"     fill="#f59e0b" stackId="s" />
          <Bar dataKey="Corrective Maint"    fill="#ef4444" stackId="s" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function NetworkAssetLifeCycleAnalytics() {
  const [data, setData] = useState<ENALCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNetworkAssetLifeCycleDashboard()
      .then(setData)
      .catch(err => setError(err.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Network Asset Life Cycle Analytics…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Settings size={28} className="text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Electricity Network Asset Life Cycle Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            ENALC — Asset condition, replacement pipeline, reliability impact &amp; spend
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Asset Count"
          value={summary.total_asset_count.toLocaleString()}
          sub="across all asset classes"
        />
        <KpiCard
          label="Avg Condition Score"
          value={summary.avg_condition_score.toFixed(2)}
          sub="out of 10"
        />
        <KpiCard
          label="% Past Design Life"
          value={`${summary.pct_past_design_life.toFixed(1)}%`}
          sub="of assets exceeded design life"
        />
        <KpiCard
          label="Critical Assets"
          value={summary.critical_assets_count.toString()}
          sub="requiring replacement"
        />
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Replacement Pipeline</span>
          <span className="text-xl font-bold text-white">
            ${summary.total_replacement_capex_pipeline_m_aud.toFixed(1)}M AUD
          </span>
          <span className="text-xs text-gray-500">total CAPEX in replacement pipeline</span>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Avg Failure Probability</span>
          <span className="text-xl font-bold text-white">
            {summary.avg_failure_probability_pct.toFixed(1)}%
          </span>
          <span className="text-xs text-gray-500">average across monitored assets</span>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Total Spend 2024</span>
          <span className="text-xl font-bold text-white">
            ${summary.total_spend_2024_m_aud.toFixed(1)}M AUD
          </span>
          <span className="text-xs text-gray-500">CAPEX + OPEX for selected owners</span>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AssetClassConditionChart data={data.asset_classes} />
        <AssetRiskChart data={data.conditions} />
        <ReplacementCapexChart data={data.replacements} />
        <SaidiTrendChart data={data.reliability_impact} />
        <div className="xl:col-span-2">
          <QuarterlySpendChart data={data.spend} />
        </div>
      </div>
    </div>
  )
}
