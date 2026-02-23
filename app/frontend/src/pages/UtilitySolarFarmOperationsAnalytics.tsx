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
import { Sun } from 'lucide-react'
import {
  getUtilitySolarFarmOperationsDashboard,
  USSODashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const TECH_COLOURS: Record<string, string> = {
  'Fixed-tilt':           '#f59e0b',
  'Single-axis Tracker':  '#3b82f6',
  'Dual-axis Tracker':    '#10b981',
  'Bifacial':             '#8b5cf6',
}

const FARM_LINE_COLOURS: string[] = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#f97316',
]

const REGION_COLOURS: Record<string, string> = {
  'NSW1': '#3b82f6',
  'QLD1': '#f59e0b',
  'VIC1': '#10b981',
  'SA1':  '#8b5cf6',
  'TAS1': '#06b6d4',
}

const MAINT_COLOURS: Record<string, string> = {
  'Module Cleaning':       '#f59e0b',
  'Inverter Service':      '#3b82f6',
  'Tracker Maintenance':   '#10b981',
  'Vegetation Management': '#8b5cf6',
  'Cable Inspection':      '#f97316',
}

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
        <Sun size={16} />
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

export default function UtilitySolarFarmOperationsAnalytics() {
  const [data, setData] = useState<USSODashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getUtilitySolarFarmOperationsDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Utility-Scale Solar Farm Operations Analytics…
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

  // ── Chart 1: Bar — annual_generation_gwh by farm_name coloured by technology ──
  const farmGenData = [...data.farms]
    .sort((a, b) => b.annual_generation_gwh - a.annual_generation_gwh)
    .map((f) => ({
      name: f.farm_name.length > 20 ? f.farm_name.slice(0, 18) + '…' : f.farm_name,
      annual_generation_gwh: f.annual_generation_gwh,
      technology: f.technology,
      fill: TECH_COLOURS[f.technology] ?? '#6b7280',
    }))

  // ── Chart 2: Bar — cost_per_mw_k by maintenance_type sorted desc ──────────
  const maintAgg: Record<string, number[]> = {}
  for (const m of data.maintenance) {
    if (!maintAgg[m.maintenance_type]) maintAgg[m.maintenance_type] = []
    maintAgg[m.maintenance_type].push(m.cost_per_mw_k)
  }
  const maintChartData = Object.entries(maintAgg)
    .map(([mt, vals]) => ({
      maintenance_type: mt,
      avg_cost_per_mw_k: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)),
      fill: MAINT_COLOURS[mt] ?? '#6b7280',
    }))
    .sort((a, b) => b.avg_cost_per_mw_k - a.avg_cost_per_mw_k)

  // ── Chart 3: Line — capacity_remaining_pct by year for 5 farms ────────────
  const degrad5Farms = Array.from(new Set(data.degradation.map((d) => d.farm_name))).slice(0, 5)
  const degradYears = Array.from(new Set(data.degradation.map((d) => d.year))).sort((a, b) => a - b)
  const degradMap: Record<number, Record<string, number>> = {}
  for (const d of data.degradation) {
    if (!degrad5Farms.includes(d.farm_name)) continue
    if (!degradMap[d.year]) degradMap[d.year] = {}
    degradMap[d.year][d.farm_name] = d.capacity_remaining_pct
  }
  const degradChartData = degradYears.map((yr) => ({ year: yr, ...degradMap[yr] }))

  // ── Chart 4: Line — curtailment_pct by month for 5 farms ─────────────────
  const curt5Farms = Array.from(new Set(data.curtailment.map((c) => c.farm_name))).slice(0, 5)
  const curtMonths = Array.from(new Set(data.curtailment.map((c) => c.month))).sort()
  const curtMap: Record<string, Record<string, number>> = {}
  for (const c of data.curtailment) {
    if (!curt5Farms.includes(c.farm_name)) continue
    if (!curtMap[c.month]) curtMap[c.month] = {}
    curtMap[c.month][c.farm_name] = c.curtailment_pct
  }
  const curtChartData = curtMonths.map((mo) => ({ month: mo.slice(5), ...curtMap[mo] }))

  // ── Chart 5: Bar — actual_vs_p50_pct by month for 5 regions ──────────────
  const wp5Regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const wpMonths = Array.from(new Set(data.weather_performance.map((w) => w.month))).sort()
  const wpMap: Record<string, Record<string, number>> = {}
  for (const w of data.weather_performance) {
    if (!wpMonths.includes(w.month)) continue
    if (!wpMap[w.month]) wpMap[w.month] = {}
    wpMap[w.month][w.region] = w.actual_vs_p50_pct
  }
  const wpChartData = wpMonths.map((mo) => ({ month: mo.slice(5), ...wpMap[mo] }))

  return (
    <div className="p-6 space-y-8 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sun size={28} className="text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Utility-Scale Solar Farm Operations Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Farm performance, maintenance, degradation, curtailment and weather impact — Australian utility solar
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Installed Capacity"
          value={`${(summary.total_installed_capacity_gw as number).toFixed(2)} GW`}
          sub="20 utility-scale farms"
        />
        <KpiCard
          label="Avg Capacity Factor"
          value={`${(summary.avg_capacity_factor_pct as number).toFixed(1)}%`}
          sub="Fleet-wide average"
        />
        <KpiCard
          label="Total Curtailment"
          value={`${(summary.total_curtailment_pct as number).toFixed(1)}%`}
          sub="Grid-constrained output loss"
        />
        <KpiCard
          label="Top Operator"
          value={summary.top_operator as string}
          sub={`Avg PR: ${(summary.avg_performance_ratio_pct as number).toFixed(1)}%`}
        />
      </div>

      {/* Chart 1 — Annual Generation by Farm */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Annual Generation by Farm (GWh) — Coloured by Technology
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={farmGenData} margin={{ top: 4, right: 20, bottom: 80, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tickFormatter={(v) => `${v} GWh`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)} GWh`, 'Generation']} />
            <Bar dataKey="annual_generation_gwh" name="Annual Generation (GWh)">
              {farmGenData.map((entry, idx) => (
                <rect key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
          {Object.entries(TECH_COLOURS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: v }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2 — Maintenance Cost by Type */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Average Maintenance Cost by Type ($/kW·yr) — Sorted Descending
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={maintChartData} margin={{ top: 4, right: 20, bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="maintenance_type"
              tick={{ fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              interval={0}
            />
            <YAxis tickFormatter={(v) => `$${v}k`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(3)}k/MW`, 'Avg Cost']} />
            <Bar dataKey="avg_cost_per_mw_k" name="Avg Cost ($/MW·yr k)">
              {maintChartData.map((entry, idx) => (
                <rect key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3 — Panel Degradation Curves 2025–2035 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Capacity Remaining (%) by Year — Panel Degradation Curves 2025–2035
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={degradChartData} margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis
              domain={[88, 101]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 12 }}
            />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '']} />
            <Legend formatter={(val: string) => val.length > 22 ? val.slice(0, 20) + '…' : val} />
            {degrad5Farms.map((farm, idx) => (
              <Line
                key={farm}
                type="monotone"
                dataKey={farm}
                stroke={FARM_LINE_COLOURS[idx] ?? '#6b7280'}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — Curtailment % by Month */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Curtailment (%) by Month — 5 Farms (2024)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={curtChartData} margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '']} />
            <Legend formatter={(val: string) => val.length > 22 ? val.slice(0, 20) + '…' : val} />
            {curt5Farms.map((farm, idx) => (
              <Line
                key={farm}
                type="monotone"
                dataKey={farm}
                stroke={FARM_LINE_COLOURS[idx] ?? '#6b7280'}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 — Actual vs P50 by Month for 5 Regions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Actual vs P50 Output (%) by Month — 5 NEM Regions (2024)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={wpChartData} margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis
              domain={[75, 120]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 12 }}
            />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '']} />
            <Legend />
            {wp5Regions.map((reg) => (
              <Bar
                key={reg}
                dataKey={reg}
                fill={REGION_COLOURS[reg] ?? '#6b7280'}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Total Installed Capacity</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {(summary.total_installed_capacity_gw as number).toFixed(3)} GW
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Avg Capacity Factor</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {(summary.avg_capacity_factor_pct as number).toFixed(2)}%
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Fleet Curtailment Rate</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {(summary.total_curtailment_pct as number).toFixed(2)}%
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Top Operator (by farm count)</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {summary.top_operator as string}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Avg Performance Ratio</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {(summary.avg_performance_ratio_pct as number).toFixed(2)}%
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Total Farms</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {data.farms.length} utility-scale farms
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Maintenance Records</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {data.maintenance.length} records
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Degradation Projections</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {data.degradation.length} records (2025–2035)
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Curtailment Records</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {data.curtailment.length} monthly records
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
