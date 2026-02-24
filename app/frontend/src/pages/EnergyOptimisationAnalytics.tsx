import { useEffect, useState } from 'react'
import { Settings, DollarSign, Zap, Leaf, TrendingDown } from 'lucide-react'
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
import { getEnergyOptimisationDashboard } from '../api/client'
import type { AEOSDashboard } from '../api/client'

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
// Colour palette
// ---------------------------------------------------------------------------

const COLOURS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6', '#a855f7', '#eab308']

// ---------------------------------------------------------------------------
// Chart section wrapper
// ---------------------------------------------------------------------------

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">{title}</h2>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EnergyOptimisationAnalytics() {
  const [data, setData] = useState<AEOSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyOptimisationDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <p className="text-gray-400 animate-pulse">Loading AEOS dashboard…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <p className="text-red-400">Error loading data: {error}</p>
      </div>
    )
  }

  // ── Chart 1: Cost saving by algorithm (success runs only, summed) ──────────
  const algorithmSavings: Record<string, number> = {}
  for (const run of data.optimisation_runs) {
    if (run.status === 'Success') {
      algorithmSavings[run.algorithm] = (algorithmSavings[run.algorithm] ?? 0) + run.cost_saving_aud
    }
  }
  const chart1Data = Object.entries(algorithmSavings)
    .map(([algorithm, total]) => ({ algorithm, total: Math.round(total) }))
    .sort((a, b) => b.total - a.total)

  // ── Chart 2: avg_monthly_saving_aud by site (top 10, sorted desc) ─────────
  const chart2Data = [...data.sites]
    .sort((a, b) => b.avg_monthly_saving_aud - a.avg_monthly_saving_aud)
    .slice(0, 10)
    .map((s) => ({
      site: s.site_name.split(' ').slice(0, 2).join(' '),
      saving: Math.round(s.avg_monthly_saving_aud),
    }))

  // ── Chart 3: Monthly grid_import vs solar_dispatch for 2024 (all sites) ───
  const monthlyAgg: Record<number, { grid_import: number; solar_dispatch: number }> = {}
  for (const sch of data.schedules) {
    if (sch.year === 2024) {
      if (!monthlyAgg[sch.month]) monthlyAgg[sch.month] = { grid_import: 0, solar_dispatch: 0 }
      monthlyAgg[sch.month].grid_import += sch.grid_import_mwh
      monthlyAgg[sch.month].solar_dispatch += sch.solar_dispatch_mwh
    }
  }
  const MONTH_LABELS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const chart3Data = Object.entries(monthlyAgg)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([month, vals]) => ({
      month: MONTH_LABELS[Number(month)],
      'Grid Import': Math.round(vals.grid_import),
      'Solar Dispatch': Math.round(vals.solar_dispatch),
    }))

  // ── Chart 4: avg optimisation_rate_pct & forecast_accuracy_pct by site (2024) ──
  const siteKpiMap: Record<string, { opt_sum: number; fa_sum: number; count: number }> = {}
  for (const kpi of data.performance_kpis) {
    if (kpi.year === 2024) {
      if (!siteKpiMap[kpi.site_name]) siteKpiMap[kpi.site_name] = { opt_sum: 0, fa_sum: 0, count: 0 }
      siteKpiMap[kpi.site_name].opt_sum += kpi.optimisation_rate_pct
      siteKpiMap[kpi.site_name].fa_sum += kpi.forecast_accuracy_pct
      siteKpiMap[kpi.site_name].count += 1
    }
  }
  const chart4Data = Object.entries(siteKpiMap).map(([site, v]) => ({
    site: site.split(' ').slice(0, 2).join(' '),
    'Opt Rate %': Math.round((v.opt_sum / v.count) * 10) / 10,
    'Forecast Acc %': Math.round((v.fa_sum / v.count) * 10) / 10,
  }))

  // ── Chart 5: Total peak_reduction_mw by objective (summed) ────────────────
  const peakByObj: Record<string, number> = {}
  for (const run of data.optimisation_runs) {
    peakByObj[run.objective] = (peakByObj[run.objective] ?? 0) + run.peak_reduction_mw
  }
  const chart5Data = Object.entries(peakByObj)
    .map(([objective, total]) => ({ objective, total: Math.round(total * 10) / 10 }))
    .sort((a, b) => b.total - a.total)

  // ── Summary KPIs ───────────────────────────────────────────────────────────
  const { summary } = data

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-white">
            Automated Energy Optimisation System (AEOS)
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Multi-site optimisation analytics — algorithms, schedules &amp; performance KPIs
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total Sites"
          value={String(summary.total_sites)}
          sub="Enrolled in AEOS"
          icon={Settings}
          color="bg-amber-600"
        />
        <KpiCard
          title="Total Cost Savings"
          value={`$${(summary.total_cost_saving_aud / 1_000).toFixed(1)}k AUD`}
          sub="Across all runs"
          icon={DollarSign}
          color="bg-green-600"
        />
        <KpiCard
          title="Avg Peak Reduction"
          value={`${summary.avg_peak_reduction_mw.toFixed(2)} MW`}
          sub="Per optimisation run"
          icon={Zap}
          color="bg-blue-600"
        />
        <KpiCard
          title="Total Carbon Reduction"
          value={`${summary.total_carbon_reduction_t.toFixed(1)} t`}
          sub="CO₂-equivalent avoided"
          icon={Leaf}
          color="bg-emerald-600"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartSection title="Cost Savings by Algorithm (Success Runs, AUD)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart1Data} margin={{ top: 4, right: 16, left: 8, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="algorithm"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number) => [`$${v.toLocaleString()} AUD`, 'Total Savings']}
              />
              <Bar dataKey="total" fill={COLOURS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Avg Monthly Savings by Site — Top 10 (AUD)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart2Data} margin={{ top: 4, right: 16, left: 8, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="site"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number) => [`$${v.toLocaleString()} AUD`, 'Avg Monthly Saving']}
              />
              <Bar dataKey="saving" fill={COLOURS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartSection title="Monthly Grid Import vs Solar Dispatch — 2024 All Sites (MWh)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chart3Data} margin={{ top: 4, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line type="monotone" dataKey="Grid Import" stroke={COLOURS[4]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Solar Dispatch" stroke={COLOURS[0]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Avg Optimisation Rate & Forecast Accuracy by Site — 2024 (%)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart4Data} margin={{ top: 4, right: 16, left: 8, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="site"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[50, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="Opt Rate %" fill={COLOURS[2]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Forecast Acc %" fill={COLOURS[3]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* Chart row 3 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartSection title="Total Peak Reduction by Objective (MW)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart5Data} margin={{ top: 4, right: 16, left: 8, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="objective"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number) => [`${v} MW`, 'Peak Reduction']}
              />
              <Bar dataKey="total" fill={COLOURS[5]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* Summary stats panel */}
        <div className="bg-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-gray-300">Optimisation Run Summary</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Runs</span>
              <span className="text-white font-medium">{data.optimisation_runs.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Successful</span>
              <span className="text-green-400 font-medium">
                {data.optimisation_runs.filter((r) => r.status === 'Success').length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Partial</span>
              <span className="text-yellow-400 font-medium">
                {data.optimisation_runs.filter((r) => r.status === 'Partial').length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Failed</span>
              <span className="text-red-400 font-medium">
                {data.optimisation_runs.filter((r) => r.status === 'Failed').length}
              </span>
            </div>
            <hr className="border-gray-700" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Sites Optimisation-Enabled</span>
              <span className="text-white font-medium">
                {data.sites.filter((s) => s.optimisation_enabled).length} / {data.sites.length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Schedules Generated</span>
              <span className="text-white font-medium">{data.schedules.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Performance KPI Records</span>
              <span className="text-white font-medium">{data.performance_kpis.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
