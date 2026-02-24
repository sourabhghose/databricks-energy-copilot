import { useEffect, useState } from 'react'
import { Users, DollarSign, TrendingDown, Star } from 'lucide-react'
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
import { getConsumerSegmentationDashboard } from '../api/client'
import type { ECSADashboard } from '../api/client'

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
// Main page
// ---------------------------------------------------------------------------

export default function ConsumerSegmentationAnalytics() {
  const [data, setData] = useState<ECSADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getConsumerSegmentationDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        Loading Consumer Segmentation Analytics...
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

  const { segments, behaviour, products, churn, summary } = data

  // ── Chart 1: Avg annual consumption by segment (2024, all states avg) ──────
  const seg2024 = segments.filter((s) => s.year === 2024)
  const segmentNames = [...new Set(seg2024.map((s) => s.segment_name))]

  const consumptionBySegment = segmentNames.map((name) => {
    const recs = seg2024.filter((s) => s.segment_name === name)
    const avg = recs.reduce((acc, r) => acc + r.avg_annual_consumption_mwh, 0) / recs.length
    return { segment: name, avg_mwh: Math.round(avg * 10) / 10 }
  })

  // ── Chart 2: Churn rate by segment (2024, all states avg) sorted desc ───────
  const churnBySegment = segmentNames
    .map((name) => {
      const recs = seg2024.filter((s) => s.segment_name === name)
      const avg = recs.reduce((acc, r) => acc + r.churn_rate_pct, 0) / recs.length
      return { segment: name, churn_pct: Math.round(avg * 10) / 10 }
    })
    .sort((a, b) => b.churn_pct - a.churn_pct)

  // ── Chart 3: Behaviour — peak vs off-peak by segment ─────────────────────
  const behaviourData = behaviour.map((b) => ({
    segment: b.segment_name,
    peak: b.peak_consumption_pct,
    off_peak: b.off_peak_consumption_pct,
  }))

  // ── Chart 4: Product customers_enrolled by product_type (summed) ──────────
  const productTypeMap: Record<string, number> = {}
  for (const p of products) {
    productTypeMap[p.product_type] = (productTypeMap[p.product_type] ?? 0) + p.customers_enrolled
  }
  const productTypeData = Object.entries(productTypeMap).map(([type, enrolled]) => ({
    type,
    enrolled,
  }))

  // ── Chart 5: Net churn change trend by state (quarterly 2023-2024, segs agg) ─
  const stateList = [...new Set(churn.map((c) => c.state))]
  const periodKeys = ['2023-Q1', '2023-Q2', '2023-Q3', '2023-Q4', '2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4']

  const netChurnTrend = periodKeys.map((pk) => {
    const [yearStr, quarter] = pk.split('-')
    const year = parseInt(yearStr, 10)
    const entry: Record<string, string | number> = { period: pk }
    for (const state of stateList) {
      const recs = churn.filter((c) => c.state === state && c.year === year && c.quarter === quarter)
      entry[state] = recs.reduce((acc, r) => acc + r.net_change, 0)
    }
    return entry
  })

  const STATE_COLORS: Record<string, string> = {
    NSW: '#60a5fa',
    QLD: '#34d399',
    VIC: '#f472b6',
    SA: '#fbbf24',
    WA: '#a78bfa',
  }

  return (
    <div className="min-h-full bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Users size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Energy Consumer Segmentation Analytics</h1>
          <p className="text-sm text-gray-400">ECSA — Retail segment behaviour, churn, and product analytics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Total Customers (NSW 2024)"
          value={summary.total_customers.toLocaleString()}
          sub="NSW state, all segments"
          icon={Users}
          color="bg-blue-600"
        />
        <KpiCard
          title="Avg Annual Bill"
          value={`$${summary.avg_annual_bill_aud.toLocaleString()}`}
          sub="All segments, 2024"
          icon={DollarSign}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Overall Churn Rate"
          value={`${summary.overall_churn_rate_pct}%`}
          sub="All segments, 2024"
          icon={TrendingDown}
          color="bg-rose-600"
        />
        <KpiCard
          title="Highest Satisfaction Segment"
          value={summary.highest_satisfaction_segment}
          sub="Best avg satisfaction score, 2024"
          icon={Star}
          color="bg-amber-500"
        />
      </div>

      {/* Charts — Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Chart 1: Avg consumption by segment */}
        <ChartCard title="Avg Annual Consumption by Segment (2024, All States Avg) — MWh">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={consumptionBySegment} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="segment"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#60a5fa' }}
              />
              <Bar dataKey="avg_mwh" name="Avg MWh" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Churn rate by segment sorted desc */}
        <ChartCard title="Churn Rate by Segment (2024, All States Avg) — % Sorted Desc">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={churnBySegment} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="segment"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#f87171' }}
                formatter={(v: number) => [`${v}%`, 'Churn Rate']}
              />
              <Bar dataKey="churn_pct" name="Churn %" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts — Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Chart 3: Behaviour — peak vs off-peak */}
        <ChartCard title="Peak vs Off-Peak Consumption by Segment (%)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={behaviourData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="segment"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => [`${v}%`]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
              <Bar dataKey="peak" name="Peak %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="off_peak" name="Off-Peak %" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Product customers_enrolled by product_type */}
        <ChartCard title="Customers Enrolled by Product Type (All States Summed)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={productTypeData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="type"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-20}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#a78bfa' }}
                formatter={(v: number) => [v.toLocaleString(), 'Enrolled']}
              />
              <Bar dataKey="enrolled" name="Customers Enrolled" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Chart 5: Net churn trend by state */}
      <ChartCard title="Net Customer Change Trend by State (Quarterly 2023-2024, All Segments)">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={netChurnTrend} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {stateList.map((state) => (
              <Line
                key={state}
                type="monotone"
                dataKey={state}
                stroke={STATE_COLORS[state] ?? '#94a3b8'}
                strokeWidth={2}
                dot={false}
                name={state}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
