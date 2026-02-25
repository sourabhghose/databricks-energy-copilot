import { useEffect, useState } from 'react'
import { GitMerge, Gauge, Activity, TrendingUp } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts'
import { getNaturalGasPipelineDashboard } from '../api/client'
import type { NGPAdashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const PIPELINE_COLOURS: Record<string, string> = {
  'PL-NSW-01': '#3b82f6',
  'PL-NSW-02': '#60a5fa',
  'PL-VIC-01': '#6366f1',
  'PL-VIC-02': '#818cf8',
  'PL-QLD-01': '#f59e0b',
  'PL-QLD-02': '#fbbf24',
  'PL-SA-01':  '#10b981',
  'PL-SA-02':  '#34d399',
  'PL-WA-01':  '#ef4444',
  'PL-WA-02':  '#f87171',
  'PL-TAS-01': '#8b5cf6',
  'PL-TAS-02': '#a78bfa',
}

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
// Main Page
// ---------------------------------------------------------------------------
export default function NaturalGasPipelineAnalytics() {
  const [data, setData] = useState<NGPAdashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNaturalGasPipelineDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Natural Gas Pipeline Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const { pipelines, flows, capacity, maintenance, summary } = data

  // Chart 1: Horizontal Bar — Pipeline capacity TJ/day sorted descending
  const capacityChartData = [...pipelines]
    .sort((a, b) => b.capacity_tj_per_day - a.capacity_tj_per_day)
    .map(pl => ({
      name: pl.pipeline_name.length > 22 ? pl.pipeline_name.slice(0, 22) + '…' : pl.pipeline_name,
      pipeline_id: pl.pipeline_id,
      capacity_tj_per_day: pl.capacity_tj_per_day,
    }))

  // Chart 2: Line — Monthly average flow TJ/day by pipeline (2024, months 1-4)
  const months = [1, 2, 3, 4]
  const monthlyFlowData = months.map(m => {
    const row: Record<string, string | number> = { month: `M${m}` }
    for (const pl of pipelines) {
      const rec = flows.find(f => f.pipeline_id === pl.pipeline_id && f.year === 2024 && f.month === m)
      const shortName = pl.pipeline_name.length > 18 ? pl.pipeline_name.slice(0, 18) + '…' : pl.pipeline_name
      row[shortName] = rec ? Math.round(rec.avg_flow_tj_per_day * 10) / 10 : 0
    }
    return row
  })
  const pipelineShortNames = pipelines.map(pl =>
    pl.pipeline_name.length > 18 ? pl.pipeline_name.slice(0, 18) + '…' : pl.pipeline_name
  )

  // Chart 3: Bar — Utilisation % by pipeline (2024 average across months)
  const utilisationChartData = pipelines.map(pl => {
    const plFlows = flows.filter(f => f.pipeline_id === pl.pipeline_id && f.year === 2024)
    const avgUtil = plFlows.length > 0
      ? Math.round((plFlows.reduce((s, f) => s + f.utilisation_pct, 0) / plFlows.length) * 100) / 100
      : 0
    return {
      name: pl.pipeline_name.length > 16 ? pl.pipeline_name.slice(0, 16) + '…' : pl.pipeline_name,
      pipeline_id: pl.pipeline_id,
      utilisation_pct: avgUtil,
    }
  }).sort((a, b) => b.utilisation_pct - a.utilisation_pct)

  // Chart 4: Grouped Bar — Planned vs unplanned outage days by pipeline (2024)
  const outageChartData = pipelines.map(pl => {
    const rec = maintenance.find(m => m.pipeline_id === pl.pipeline_id && m.year === 2024)
    return {
      name: pl.pipeline_name.length > 16 ? pl.pipeline_name.slice(0, 16) + '…' : pl.pipeline_name,
      pipeline_id: pl.pipeline_id,
      planned_outage_days: rec ? rec.planned_outage_days : 0,
      unplanned_outage_days: rec ? rec.unplanned_outage_days : 0,
    }
  })

  // Chart 5: Bar — Maintenance cost by pipeline (2022-2024 total)
  const maintenanceCostData = pipelines.map(pl => {
    const totalCost = maintenance
      .filter(m => m.pipeline_id === pl.pipeline_id)
      .reduce((s, m) => s + m.maintenance_cost_m_aud, 0)
    return {
      name: pl.pipeline_name.length > 16 ? pl.pipeline_name.slice(0, 16) + '…' : pl.pipeline_name,
      pipeline_id: pl.pipeline_id,
      total_cost_m_aud: Math.round(totalCost * 100) / 100,
    }
  }).sort((a, b) => b.total_cost_m_aud - a.total_cost_m_aud)

  // Capacity data is used for summary display
  void capacity

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-orange-700 border-b border-orange-800 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-orange-900 rounded-lg">
          <GitMerge size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Natural Gas Pipeline Analytics</h1>
          <p className="text-xs text-orange-200">NGPA — Pipeline Capacity, Flow, Utilisation & Maintenance</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Total Pipelines"
            value={String(summary.total_pipelines)}
            sub="Across all states"
            icon={GitMerge}
            color="bg-orange-700"
          />
          <KpiCard
            title="Total Capacity TJ/day"
            value={summary.total_capacity_tj_per_day.toLocaleString()}
            sub="Combined network capacity"
            icon={Gauge}
            color="bg-blue-600"
          />
          <KpiCard
            title="Avg Utilisation %"
            value={`${summary.avg_utilisation_pct.toFixed(1)}%`}
            sub="2024 average across pipelines"
            icon={Activity}
            color="bg-indigo-600"
          />
          <KpiCard
            title="Highest Utilisation Pipeline"
            value={summary.highest_utilisation_pipeline.length > 20
              ? summary.highest_utilisation_pipeline.slice(0, 20) + '…'
              : summary.highest_utilisation_pipeline}
            sub="Highest avg utilisation in 2024"
            icon={TrendingUp}
            color="bg-emerald-600"
          />
        </div>

        {/* Chart 1: Horizontal Bar — Pipeline capacity TJ/day sorted desc */}
        <ChartCard title="Pipeline Capacity TJ/day — All 12 Pipelines (sorted descending)">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={capacityChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" TJ" />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => [`${v.toLocaleString()} TJ/day`, 'Capacity']}
              />
              <Bar dataKey="capacity_tj_per_day" name="Capacity TJ/day" fill="#f97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Line — Monthly average flow TJ/day by pipeline (2024 months 1-4) */}
        <ChartCard title="Monthly Average Flow TJ/day by Pipeline — 2024 (Months 1–4)">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={monthlyFlowData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" TJ" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 10 }} />
              {pipelineShortNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={Object.values(PIPELINE_COLOURS)[i] ?? '#6b7280'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Bar — Utilisation % by pipeline (2024 average across months) */}
        <ChartCard title="Average Utilisation % by Pipeline — 2024 (sorted descending)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={utilisationChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => [`${v.toFixed(1)}%`, 'Utilisation']}
              />
              <Bar dataKey="utilisation_pct" name="Utilisation %" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Grouped Bar — Planned vs Unplanned outage days by pipeline (2024) */}
        <ChartCard title="Planned vs Unplanned Outage Days by Pipeline — 2024">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={outageChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" d" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="planned_outage_days" name="Planned Outage Days" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="unplanned_outage_days" name="Unplanned Outage Days" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Bar — Maintenance cost by pipeline (2022-2024 total) */}
        <ChartCard title="Total Maintenance Cost by Pipeline — 2022–2024 (A$M)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={maintenanceCostData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" M" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => [`A$${v.toFixed(2)}M`, 'Total Cost']}
              />
              <Bar dataKey="total_cost_m_aud" name="Maintenance Cost (A$M)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
