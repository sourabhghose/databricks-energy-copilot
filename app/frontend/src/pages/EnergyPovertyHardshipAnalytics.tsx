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
  Cell,
} from 'recharts'
import { Heart } from 'lucide-react'
import {
  getEnergyPovertyHardshipDashboard,
  EPHADashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const REGION_COLOURS: Record<string, string> = {
  NSW: '#3b82f6',
  QLD: '#f59e0b',
  VIC: '#10b981',
  SA:  '#8b5cf6',
  WA:  '#f97316',
  TAS: '#06b6d4',
  NT:  '#ec4899',
}

const PROGRAM_TYPE_COLOURS: Record<string, string> = {
  'Rebate':        '#3b82f6',
  'Concession':    '#10b981',
  'Hardship Fund': '#f59e0b',
  'Energy Upgrade': '#8b5cf6',
}

const LINE_COLOURS: string[] = [
  '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#f97316',
]

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
        <Heart size={16} />
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

export default function EnergyPovertyHardshipAnalytics() {
  const [data, setData] = useState<EPHADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyPovertyHardshipDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Energy Poverty &amp; Hardship Program Analytics…
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

  // ── Chart 1: Line — hardship_rate_pct by year for 7 regions ───────────────
  const hardshipRegions = Array.from(new Set(data.hardship.map((h) => h.region))).sort()
  const hardshipYears = Array.from(new Set(data.hardship.map((h) => h.year))).sort((a, b) => a - b)
  const hardshipMap: Record<number, Record<string, number>> = {}
  for (const h of data.hardship) {
    if (!hardshipMap[h.year]) hardshipMap[h.year] = {}
    hardshipMap[h.year][h.region] = h.hardship_rate_pct
  }
  const hardshipChartData = hardshipYears.map((yr) => ({ year: yr, ...hardshipMap[yr] }))

  // ── Chart 2: Bar — annual_value_m by program coloured by program_type (top 15) ──
  const top15Programs = [...data.programs]
    .sort((a, b) => b.annual_value_m - a.annual_value_m)
    .slice(0, 15)
    .map((p) => ({
      name: p.program_name.length > 28 ? p.program_name.slice(0, 26) + '…' : p.program_name,
      annual_value_m: p.annual_value_m,
      program_type: p.program_type,
      fill: PROGRAM_TYPE_COLOURS[p.program_type] ?? '#6b7280',
    }))

  // ── Chart 3: Bar — energy_burden_pct by household_type sorted desc, coloured by region ──
  const burdenChartData = [...data.burden]
    .sort((a, b) => b.energy_burden_pct - a.energy_burden_pct)
    .map((b) => ({
      label: `${b.household_type.length > 18 ? b.household_type.slice(0, 16) + '…' : b.household_type} (${b.region})`,
      energy_burden_pct: b.energy_burden_pct,
      region: b.region,
      fill: REGION_COLOURS[b.region] ?? '#6b7280',
    }))

  // ── Chart 4: Bar — avg_bill_reduction_pct by intervention sorted desc ─────
  const interventionChartData = [...data.interventions]
    .sort((a, b) => b.avg_bill_reduction_pct - a.avg_bill_reduction_pct)
    .map((i) => ({
      name: i.intervention.length > 22 ? i.intervention.slice(0, 20) + '…' : i.intervention,
      avg_bill_reduction_pct: i.avg_bill_reduction_pct,
    }))

  // ── Chart 5: Line — energy_burden_pct by quarter for 5 regions ───────────
  const trendRegions = ['NSW', 'VIC', 'QLD', 'SA', 'WA']
  const trendQuarters = Array.from(new Set(data.trends.map((t) => t.quarter))).sort()
  const trendMap: Record<string, Record<string, number>> = {}
  for (const t of data.trends) {
    if (!trendRegions.includes(t.region)) continue
    if (!trendMap[t.quarter]) trendMap[t.quarter] = {}
    trendMap[t.quarter][t.region] = t.energy_burden_pct
  }
  const trendChartData = trendQuarters.map((q) => ({ quarter: q, ...trendMap[q] }))

  return (
    <div className="p-6 space-y-8 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Heart size={28} className="text-rose-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Energy Poverty &amp; Hardship Program Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Hardship customers, concession programs, energy burden and intervention effectiveness — Australia
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Hardship Customers"
          value={`${(summary.total_hardship_customers_k as number).toLocaleString()} k`}
          sub="Across all regions 2018–2024"
        />
        <KpiCard
          label="Total Program Value"
          value={`$${(summary.total_program_value_m as number).toFixed(1)} M`}
          sub="Annual concession &amp; hardship programs"
        />
        <KpiCard
          label="Highest Burden Segment"
          value={summary.highest_burden_segment as string}
          sub="Segment with greatest energy burden"
        />
        <KpiCard
          label="Avg Energy Burden"
          value={`${(summary.avg_energy_burden_pct as number).toFixed(2)}%`}
          sub={`Most effective: ${summary.most_effective_intervention as string}`}
        />
      </div>

      {/* Chart 1 — Hardship Rate by Year for 7 Regions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Hardship Rate (%) by Year — 7 Australian Regions (2018–2024)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={hardshipChartData} margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '']} />
            <Legend />
            {hardshipRegions.map((region, idx) => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLOURS[region] ?? LINE_COLOURS[idx % LINE_COLOURS.length]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2 — Annual Program Value (Top 15) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Annual Value by Concession Program ($M) — Top 15, Coloured by Program Type
        </h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={top15Programs} margin={{ top: 4, right: 20, bottom: 120, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tickFormatter={(v) => `$${v}M`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(1)}M`, 'Annual Value']} />
            <Bar dataKey="annual_value_m" name="Annual Value ($M)">
              {top15Programs.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
          {Object.entries(PROGRAM_TYPE_COLOURS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: v }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 3 — Energy Burden by Household Type */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Energy Burden (% of Income) by Household Type — Sorted Descending, Coloured by Region
        </h2>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={burdenChartData} margin={{ top: 4, right: 20, bottom: 130, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'Energy Burden']} />
            <Bar dataKey="energy_burden_pct" name="Energy Burden (%)">
              {burdenChartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
          {Object.entries(REGION_COLOURS)
            .filter(([k]) => ['NSW', 'VIC', 'QLD', 'SA', 'WA'].includes(k))
            .map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: v }} />
                {k}
              </span>
            ))}
        </div>
      </div>

      {/* Chart 4 — Avg Bill Reduction by Intervention */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Avg Bill Reduction (%) by Intervention — Sorted Descending
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={interventionChartData} margin={{ top: 4, right: 20, bottom: 100, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Bill Reduction']} />
            <Bar dataKey="avg_bill_reduction_pct" name="Avg Bill Reduction (%)" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 — Energy Burden Trend by Quarter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Energy Burden (%) by Quarter — 5 Regions (2020–2024)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trendChartData} margin={{ top: 4, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="quarter" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '']} />
            <Legend />
            {trendRegions.map((region, idx) => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLOURS[region] ?? LINE_COLOURS[idx % LINE_COLOURS.length]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Total Hardship Customers</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {(summary.total_hardship_customers_k as number).toLocaleString()} k (cumulative 2018–2024)
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Total Program Value</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              ${(summary.total_program_value_m as number).toFixed(1)} M per annum
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Highest Burden Segment</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {summary.highest_burden_segment as string}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Avg Energy Burden</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {(summary.avg_energy_burden_pct as number).toFixed(2)}% of household income
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Most Effective Intervention</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {summary.most_effective_intervention as string}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Programs Tracked</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {data.programs.length} concession &amp; hardship programs
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Burden Cohorts</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {data.burden.length} household type × region records
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Interventions Evaluated</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {data.interventions.length} programs across 5 regions
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Trend Records</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {data.trends.length} quarterly records (2020–2024)
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
