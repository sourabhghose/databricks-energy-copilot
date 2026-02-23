import { useEffect, useState } from 'react'
import { Wrench } from 'lucide-react'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import {
  EAMADashboard,
  EAMAAsset,
  EAMAWorkOrder,
  EAMAFailureRecord,
  EAMACostTrend,
  EAMAReliabilityMetric,
  getEnergyAssetMaintenanceDashboard,
} from '../api/client'

// ---- Colour palette ----
const ASSET_TYPE_COLORS: Record<string, string> = {
  'Generator':        '#3b82f6',
  'Transformer':      '#f59e0b',
  'Substation':       '#10b981',
  'Transmission Line':'#8b5cf6',
  'Battery':          '#ef4444',
}

const PRIORITY_COLORS: Record<string, string> = {
  'Critical': '#ef4444',
  'High':     '#f97316',
  'Medium':   '#f59e0b',
  'Low':      '#10b981',
}

const FAILURE_MODE_COLOR = '#6366f1'

// ---- Helper: condition score by asset (top 20) ----
function conditionByAsset(assets: EAMAAsset[]) {
  return [...assets]
    .sort((a, b) => a.condition_score - b.condition_score)
    .slice(0, 20)
    .map(a => ({
      name: a.asset_name.length > 18 ? a.asset_name.slice(0, 18) + '…' : a.asset_name,
      condition_score: a.condition_score,
      asset_type: a.asset_type,
    }))
}

// ---- Helper: planned vs unplanned cost by year ----
function costByYear(costTrends: EAMACostTrend[]) {
  const map: Record<number, { year: number; planned: number; unplanned: number }> = {}
  for (const ct of costTrends) {
    if (!map[ct.year]) map[ct.year] = { year: ct.year, planned: 0, unplanned: 0 }
    map[ct.year].planned = Math.round((map[ct.year].planned + ct.planned_cost_m) * 100) / 100
    map[ct.year].unplanned = Math.round((map[ct.year].unplanned + ct.unplanned_cost_m) * 100) / 100
  }
  return Object.values(map).sort((a, b) => a.year - b.year)
}

// ---- Helper: avg MTBF by asset type ----
function mtbfByAssetType(metrics: EAMAReliabilityMetric[]) {
  const sums: Record<string, { total: number; count: number }> = {}
  for (const m of metrics) {
    if (!sums[m.asset_type]) sums[m.asset_type] = { total: 0, count: 0 }
    sums[m.asset_type].total += m.mtbf_days
    sums[m.asset_type].count += 1
  }
  return Object.entries(sums).map(([asset_type, { total, count }]) => ({
    asset_type,
    avg_mtbf_days: Math.round((total / count) * 10) / 10,
  }))
}

// ---- Helper: total downtime by priority ----
function downtimeByPriority(workOrders: EAMAWorkOrder[]) {
  const map: Record<string, number> = {}
  for (const wo of workOrders) {
    map[wo.priority] = (map[wo.priority] ?? 0) + wo.downtime_hours
  }
  return Object.entries(map).map(([priority, total_downtime_hours]) => ({
    priority,
    total_downtime_hours: Math.round(total_downtime_hours * 10) / 10,
  }))
}

// ---- Helper: total impact_mw by failure mode ----
function impactByFailureMode(failureRecords: EAMAFailureRecord[]) {
  const map: Record<string, number> = {}
  for (const fr of failureRecords) {
    map[fr.failure_mode] = (map[fr.failure_mode] ?? 0) + fr.impact_mw
  }
  return Object.entries(map)
    .map(([failure_mode, total_impact_mw]) => ({
      failure_mode,
      total_impact_mw: Math.round(total_impact_mw * 10) / 10,
    }))
    .sort((a, b) => b.total_impact_mw - a.total_impact_mw)
}

// ---- KPI card ----
function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-gray-900 dark:text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ---- Main page ----
export default function EnergyAssetMaintenanceAnalytics() {
  const [data, setData] = useState<EAMADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEnergyAssetMaintenanceDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Energy Asset Maintenance Analytics…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Error loading data: {error}
      </div>
    )
  }

  const { summary, assets, work_orders, failure_records, cost_trends, reliability_metrics } = data

  const conditionData = conditionByAsset(assets)
  const costData = costByYear(cost_trends)
  const mtbfData = mtbfByAssetType(reliability_metrics)
  const downtimeData = downtimeByPriority(work_orders)
  const impactData = impactByFailureMode(failure_records)

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
          <Wrench className="text-amber-600 dark:text-amber-400" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Energy Asset Maintenance Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Fleet-wide maintenance performance, work orders, failure analysis and reliability metrics
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Assets"
          value={summary.total_assets}
          sub="Across all regions"
        />
        <KpiCard
          label="Critical Condition"
          value={summary.assets_critical_condition}
          sub="Score < 4"
          accent={summary.assets_critical_condition > 0 ? 'text-red-500' : 'text-green-500'}
        />
        <KpiCard
          label="Total Maint. Cost FY"
          value={`$${summary.total_maintenance_cost_m_fy.toFixed(1)}M`}
          sub="AUD — FY 2024"
          accent="text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          label="Avg Asset Age"
          value={`${summary.avg_asset_age_years} yrs`}
          sub="Fleet average"
        />
        <KpiCard
          label="Open Work Orders"
          value={summary.open_work_orders}
          sub="Open + In Progress"
          accent={summary.open_work_orders > 15 ? 'text-orange-500' : 'text-gray-900 dark:text-white'}
        />
      </div>

      {/* Chart 1: Condition score by asset (top 20, coloured by type) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Asset Condition Score — Bottom 20 Assets (by Score)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={conditionData} margin={{ top: 4, right: 16, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              label={{ value: 'Score (0–10)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#f9fafb' }}
              formatter={(v: number) => [v.toFixed(1), 'Condition Score']}
            />
            <Bar dataKey="condition_score" radius={[4, 4, 0, 0]}>
              {conditionData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={ASSET_TYPE_COLORS[entry.asset_type] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(ASSET_TYPE_COLORS).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Planned vs Unplanned cost by year */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Maintenance Cost — Planned vs Unplanned by Year ($M AUD)
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={costData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: '$M', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#f9fafb' }}
              formatter={(v: number, name: string) => [`$${v.toFixed(2)}M`, name === 'planned' ? 'Planned' : 'Unplanned']}
            />
            <Legend
              formatter={(value) => value === 'planned' ? 'Planned Cost' : 'Unplanned Cost'}
              wrapperStyle={{ fontSize: 12, color: '#6b7280' }}
            />
            <Bar dataKey="planned" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} name="planned" />
            <Bar dataKey="unplanned" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="unplanned" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: MTBF by asset type */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Mean Time Between Failures (MTBF) — Average by Asset Type (days)
        </h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={mtbfData} layout="vertical" margin={{ top: 4, right: 24, left: 80, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: 'Days', position: 'insideBottom', offset: -2, style: { fontSize: 11, fill: '#9ca3af' } }} />
            <YAxis dataKey="asset_type" type="category" tick={{ fontSize: 11, fill: '#6b7280' }} width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#f9fafb' }}
              formatter={(v: number) => [`${v.toFixed(1)} days`, 'Avg MTBF']}
            />
            <Bar dataKey="avg_mtbf_days" radius={[0, 4, 4, 0]}>
              {mtbfData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={ASSET_TYPE_COLORS[entry.asset_type] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Downtime by work order priority */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Total Downtime Hours by Work Order Priority
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={downtimeData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="priority" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#f9fafb' }}
              formatter={(v: number) => [`${v.toFixed(1)} hrs`, 'Total Downtime']}
            />
            <Bar dataKey="total_downtime_hours" radius={[4, 4, 0, 0]}>
              {downtimeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.priority] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Impact MW by failure mode */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Total Generation/Capacity Lost (MW) by Failure Mode
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={impactData} layout="vertical" margin={{ top: 4, right: 24, left: 100, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: 'MW', position: 'insideBottom', offset: -2, style: { fontSize: 11, fill: '#9ca3af' } }} />
            <YAxis dataKey="failure_mode" type="category" tick={{ fontSize: 11, fill: '#6b7280' }} width={100} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#f9fafb' }}
              formatter={(v: number) => [`${v.toFixed(1)} MW`, 'Impact']}
            />
            <Bar dataKey="total_impact_mw" fill={FAILURE_MODE_COLOR} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Summary Statistics</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Total Assets</dt>
            <dd className="text-lg font-semibold text-gray-900 dark:text-white">{summary.total_assets}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Critical Assets</dt>
            <dd className="text-lg font-semibold text-red-500">{summary.assets_critical_condition}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">FY 2024 Maint. Cost</dt>
            <dd className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              ${summary.total_maintenance_cost_m_fy.toFixed(2)}M
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Avg Fleet Age</dt>
            <dd className="text-lg font-semibold text-gray-900 dark:text-white">{summary.avg_asset_age_years} yrs</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Open Work Orders</dt>
            <dd className="text-lg font-semibold text-orange-500">{summary.open_work_orders}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Total Work Orders</dt>
            <dd className="text-lg font-semibold text-gray-900 dark:text-white">{work_orders.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Total Failure Records</dt>
            <dd className="text-lg font-semibold text-gray-900 dark:text-white">{failure_records.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Asset Types</dt>
            <dd className="text-lg font-semibold text-gray-900 dark:text-white">5</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Regions Covered</dt>
            <dd className="text-lg font-semibold text-gray-900 dark:text-white">5</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Cost Trend Records</dt>
            <dd className="text-lg font-semibold text-gray-900 dark:text-white">{cost_trends.length}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
