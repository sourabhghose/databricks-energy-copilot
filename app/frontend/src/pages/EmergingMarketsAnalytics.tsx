import { useEffect, useState } from 'react'
import { Rocket, TrendingUp, Users, DollarSign, BarChart2 } from 'lucide-react'
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
import { getEmergingMarketsDashboard } from '../api/client'
import type { EMGADashboard } from '../api/client'

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
// Chart 1 — Market size trend 2021-2025 by market_name (Line chart)
// ---------------------------------------------------------------------------

const MARKET_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

function MarketSizeTrendChart({ data }: { data: EMGADashboard }) {
  const marketNames = Array.from(new Set(data.markets.map(m => m.market_name)))
  const years = [2021, 2022, 2023, 2024, 2025]

  const chartData = years.map(year => {
    const row: Record<string, number | string> = { year: String(year) }
    for (const name of marketNames) {
      const rec = data.markets.find(m => m.market_name === name && m.year === year)
      row[name] = rec ? rec.market_size_m_aud : 0
    }
    return row
  })

  return (
    <ChartCard title="Market Size Trend 2021–2025 by Segment (A$M)">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} formatter={(v: number) => [`$${v.toFixed(1)}M`]} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {marketNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={MARKET_COLORS[i % MARKET_COLORS.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 2 — Startup funding by market_segment (summed, sorted desc, Bar chart)
// ---------------------------------------------------------------------------

function StartupFundingBySegmentChart({ data }: { data: EMGADashboard }) {
  const fundingMap: Record<string, number> = {}
  for (const s of data.startups) {
    fundingMap[s.market_segment] = (fundingMap[s.market_segment] ?? 0) + s.funding_raised_m_aud
  }
  const chartData = Object.entries(fundingMap)
    .map(([segment, total]) => ({ segment, total: Math.round(total * 10) / 10 }))
    .sort((a, b) => b.total - a.total)

  return (
    <ChartCard title="Total Startup Funding by Segment (A$M)">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="segment" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} formatter={(v: number) => [`$${v.toFixed(1)}M`, 'Funding']} />
          <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 3 — Technology adoption rate % trend 2021-2024 by technology (NSW only)
// ---------------------------------------------------------------------------

const TECH_COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

function TechAdoptionTrendChart({ data }: { data: EMGADashboard }) {
  const nswData = data.adoption.filter(a => a.state === 'NSW')
  const technologies = Array.from(new Set(nswData.map(a => a.technology)))
  const years = [2021, 2022, 2023, 2024]

  const chartData = years.map(year => {
    const row: Record<string, number | string> = { year: String(year) }
    for (const tech of technologies) {
      const rec = nswData.find(a => a.technology === tech && a.year === year)
      row[tech] = rec ? rec.adoption_rate_pct : 0
    }
    return row
  })

  return (
    <ChartCard title="Technology Adoption Rate % Trend 2021–2024 (NSW)">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {technologies.map((tech, i) => (
            <Line
              key={tech}
              type="monotone"
              dataKey={tech}
              stroke={TECH_COLORS[i % TECH_COLORS.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 4 — Quarterly total_investment by segment (2024, stacked Bar chart)
// ---------------------------------------------------------------------------

const INV_COLORS = ['#10b981', '#3b82f6', '#f59e0b']

function QuarterlyInvestmentChart({ data }: { data: EMGADashboard }) {
  const inv2024 = data.investment_trends.filter(t => t.year === 2024)
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const segments = Array.from(new Set(inv2024.map(t => t.segment)))

  const chartData = quarters.map(q => {
    const row: Record<string, number | string> = { quarter: q }
    for (const seg of segments) {
      const rec = inv2024.find(t => t.quarter === q && t.segment === seg)
      row[seg] = rec ? rec.total_investment_m_aud : 0
    }
    return row
  })

  return (
    <ChartCard title="Quarterly Total Investment by Segment — 2024 (A$M, Stacked)">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} formatter={(v: number) => [`$${v.toFixed(1)}M`]} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {segments.map((seg, i) => (
            <Bar
              key={seg}
              dataKey={seg}
              stackId="a"
              fill={MARKET_COLORS[i % MARKET_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 5 — Startup count by growth_stage (distribution, Bar chart)
// ---------------------------------------------------------------------------

function StartupByStageChart({ data }: { data: EMGADashboard }) {
  const stageOrder = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+']
  const countMap: Record<string, number> = {}
  for (const s of data.startups) {
    countMap[s.growth_stage] = (countMap[s.growth_stage] ?? 0) + 1
  }
  const chartData = stageOrder.map(stage => ({ stage, count: countMap[stage] ?? 0 }))

  return (
    <ChartCard title="Startup Count by Growth Stage">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="stage" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} formatter={(v: number) => [v, 'Startups']} />
          <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EmergingMarketsAnalytics() {
  const [data, setData] = useState<EMGADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEmergingMarketsDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading Emerging Markets Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error ?? 'No data available'}</p>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-emerald-600">
          <Rocket size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Emerging Energy Markets Growth Analytics</h1>
          <p className="text-xs text-gray-400">Australian emerging energy segments — market size, startups, adoption &amp; investment</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Total Market Size (2024)"
          value={`$${summary.total_market_size_b_aud.toFixed(2)}B`}
          sub="AUD — all segments combined"
          icon={DollarSign}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Fastest Growing Market"
          value={summary.fastest_growing_market}
          sub="By growth rate % in 2024"
          icon={TrendingUp}
          color="bg-blue-600"
        />
        <KpiCard
          title="Total Startups Tracked"
          value={String(summary.total_startups)}
          sub="Across all segments"
          icon={Users}
          color="bg-purple-600"
        />
        <KpiCard
          title="Total Investment 2024"
          value={`$${summary.total_investment_2024_m_aud.toFixed(1)}M`}
          sub="VC + PE + Govt grants"
          icon={BarChart2}
          color="bg-amber-600"
        />
      </div>

      {/* Charts — 2 column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <MarketSizeTrendChart data={data} />
        <StartupFundingBySegmentChart data={data} />
        <TechAdoptionTrendChart data={data} />
        <QuarterlyInvestmentChart data={data} />
        <div className="xl:col-span-2">
          <StartupByStageChart data={data} />
        </div>
      </div>
    </div>
  )
}
