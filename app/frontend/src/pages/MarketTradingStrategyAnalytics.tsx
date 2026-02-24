import { useEffect, useState } from 'react'
import { BarChart2, TrendingUp, Activity, DollarSign, Zap } from 'lucide-react'
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
import { getMarketTradingStrategyDashboard } from '../api/client'
import type { MATSDashboard } from '../api/client'

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
// Chart 1 — Total PnL by strategy_name (2024, summed across participants)
// ---------------------------------------------------------------------------

function PnlByStrategyChart({ data }: { data: MATSDashboard }) {
  const pnlMap: Record<string, number> = {}
  for (const s of data.strategies) {
    if (s.year === 2024) {
      pnlMap[s.strategy_name] = (pnlMap[s.strategy_name] ?? 0) + s.pnl_m_aud
    }
  }
  const chartData = Object.entries(pnlMap)
    .map(([name, pnl]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, pnl: Math.round(pnl * 100) / 100 }))
    .sort((a, b) => b.pnl - a.pnl)

  return (
    <ChartCard title="Total PnL by Strategy — 2024 (A$M)">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} formatter={(v: number) => [`$${v.toFixed(2)}M`, 'PnL']} />
          <Bar dataKey="pnl" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 2 — Win Rate % by participant (averaged, 2024)
// ---------------------------------------------------------------------------

function WinRateByParticipantChart({ data }: { data: MATSDashboard }) {
  const totals: Record<string, { sum: number; count: number }> = {}
  for (const s of data.strategies) {
    if (s.year === 2024) {
      if (!totals[s.participant]) totals[s.participant] = { sum: 0, count: 0 }
      totals[s.participant].sum += s.win_rate_pct
      totals[s.participant].count += 1
    }
  }
  const chartData = Object.entries(totals)
    .map(([participant, { sum, count }]) => ({
      participant: participant.split(' ')[0],
      win_rate: Math.round((sum / count) * 10) / 10,
    }))
    .sort((a, b) => b.win_rate - a.win_rate)

  return (
    <ChartCard title="Avg Win Rate % by Participant — 2024">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="participant" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} formatter={(v: number) => [`${v}%`, 'Win Rate']} />
          <Bar dataKey="win_rate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 3 — Market Liquidity Score trend by region 2022-2024 (Q4)
// ---------------------------------------------------------------------------

const REGION_COLORS: Record<string, string> = {
  NSW1: '#f59e0b',
  QLD1: '#10b981',
  VIC1: '#3b82f6',
  SA1:  '#a855f7',
  TAS1: '#ef4444',
}

function LiquidityTrendChart({ data }: { data: MATSDashboard }) {
  // Q4 records grouped by year, then by region
  const yearMap: Record<number, Record<string, number>> = {}
  for (const md of data.market_depth) {
    if (md.quarter === 'Q4') {
      if (!yearMap[md.year]) yearMap[md.year] = {}
      yearMap[md.year][md.region] = md.liquidity_score
    }
  }
  const chartData = [2022, 2023, 2024].map((yr) => ({
    year: String(yr),
    ...(yearMap[yr] ?? {}),
  }))
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

  return (
    <ChartCard title="Market Liquidity Score by Region — Q4 Trend (2022–2024)">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 10]} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {regions.map((r) => (
            <Line key={r} type="monotone" dataKey={r} stroke={REGION_COLORS[r]} strokeWidth={2} dot={{ r: 4 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 4 — Avg Execution Speed (ms) by participant (sorted asc)
// ---------------------------------------------------------------------------

function ExecutionSpeedChart({ data }: { data: MATSDashboard }) {
  const totals: Record<string, { sum: number; count: number }> = {}
  for (const e of data.execution) {
    if (!totals[e.participant]) totals[e.participant] = { sum: 0, count: 0 }
    totals[e.participant].sum += e.execution_speed_ms
    totals[e.participant].count += 1
  }
  const chartData = Object.entries(totals)
    .map(([participant, { sum, count }]) => ({
      participant: participant.split(' ')[0],
      speed: Math.round((sum / count) * 10) / 10,
    }))
    .sort((a, b) => a.speed - b.speed)

  return (
    <ChartCard title="Avg Execution Speed (ms) by Participant — Fastest First">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="participant" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} formatter={(v: number) => [`${v} ms`, 'Exec Speed']} />
          <Bar dataKey="speed" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 5 — Stacked Bar: Net position by product (all participants, 2024)
// ---------------------------------------------------------------------------

const PRODUCT_COLORS: Record<string, string> = {
  Spot:         '#10b981',
  Cap:          '#3b82f6',
  Floor:        '#f59e0b',
  Swap:         '#a855f7',
  'ASX Futures': '#ef4444',
}

function NetPositionByProductChart({ data }: { data: MATSDashboard }) {
  // Sum net_position_mwh by region & product, filter 2024
  const regionProductMap: Record<string, Record<string, number>> = {}
  for (const p of data.positions) {
    if (p.year === 2024) {
      if (!regionProductMap[p.region]) regionProductMap[p.region] = {}
      regionProductMap[p.region][p.product] = (regionProductMap[p.region][p.product] ?? 0) + p.net_position_mwh
    }
  }
  const products = ['Spot', 'Cap', 'Floor', 'Swap', 'ASX Futures']
  const chartData = Object.entries(regionProductMap).map(([region, prods]) => ({
    region,
    ...prods,
  }))

  return (
    <ChartCard title="Net Position by Product & Region — 2024 (MWh, Stacked)">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {products.map((prod) => (
            <Bar key={prod} dataKey={prod} stackId="a" fill={PRODUCT_COLORS[prod]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MarketTradingStrategyAnalytics() {
  const [data, setData] = useState<MATSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMarketTradingStrategyDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading MATS dashboard…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400">Error loading data: {error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-600 rounded-lg">
          <BarChart2 size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Market Access Trading Strategy Analytics</h1>
          <p className="text-sm text-gray-400">MATS — NEM participant trading strategies, positions, execution & market depth</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="Total Unique Strategies"
          value={String(summary.total_strategies)}
          sub="Tracked across all participants"
          icon={Activity}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Best Strategy PnL"
          value={`$${summary.best_strategy_pnl_m_aud.toFixed(2)}M`}
          sub="Single strategy top performer"
          icon={DollarSign}
          color="bg-blue-600"
        />
        <KpiCard
          title="Avg Sharpe Ratio"
          value={summary.avg_sharpe_ratio.toFixed(2)}
          sub="Risk-adjusted return (all strategies)"
          icon={TrendingUp}
          color="bg-purple-600"
        />
        <KpiCard
          title="Total Market Volume"
          value={`${summary.total_market_volume_twh.toFixed(3)} TWh`}
          sub="Aggregate across all strategies"
          icon={Zap}
          color="bg-amber-600"
        />
      </div>

      {/* Charts — row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PnlByStrategyChart data={data} />
        <WinRateByParticipantChart data={data} />
      </div>

      {/* Charts — row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <LiquidityTrendChart data={data} />
        <ExecutionSpeedChart data={data} />
      </div>

      {/* Chart — row 3 (full width) */}
      <div className="mb-6">
        <NetPositionByProductChart data={data} />
      </div>
    </div>
  )
}
