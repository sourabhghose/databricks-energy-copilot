import { useEffect, useState } from 'react'
import { Globe, TrendingUp, DollarSign, Activity, BarChart2 } from 'lucide-react'
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
import { getEnergyHubMicrostructureDashboard } from '../api/client'
import type { AEHMDashboard } from '../api/client'

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
// Chart 1 — Bar chart: Hub liquidity_index sorted desc
// ---------------------------------------------------------------------------

function HubLiquidityChart({ data }: { data: AEHMDashboard }) {
  const chartData = [...data.hubs]
    .sort((a, b) => b.liquidity_index - a.liquidity_index)
    .map(h => ({
      name: h.hub_name.replace(' Hub', '').replace(' Exchange', '').replace(' Market', ''),
      liquidity: h.liquidity_index,
    }))

  return (
    <ChartCard title="Hub Liquidity Index (sorted descending)">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-35}
            textAnchor="end"
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#34d399' }}
          />
          <Bar dataKey="liquidity" fill="#34d399" radius={[4, 4, 0, 0]} name="Liquidity Index" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 2 — Line chart: Monthly bid_ask_spread trend by hub (2024)
// ---------------------------------------------------------------------------

const LINE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

function BidAskSpreadTrendChart({ data }: { data: AEHMDashboard }) {
  const hubs = [...new Set(data.order_book.map(o => o.hub_name))]
  const months2024 = [1, 2, 3, 4, 5, 6]

  const chartData = months2024.map(month => {
    const row: Record<string, number | string> = { month: `M${month}` }
    for (const hub of hubs) {
      const rec = data.order_book.find(o => o.hub_name === hub && o.year === 2024 && o.month === month)
      const shortName = hub.replace(' Hub', '').replace(' Exchange', '').replace(' Market', '').replace(' Energy', '')
      row[shortName] = rec ? rec.bid_ask_spread : 0
    }
    return row
  })

  const shortHubs = hubs.map(h =>
    h.replace(' Hub', '').replace(' Exchange', '').replace(' Market', '').replace(' Energy', '')
  )

  return (
    <ChartCard title="Monthly Bid-Ask Spread Trend by Hub (2024, Jan–Jun)">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {shortHubs.map((hub, i) => (
            <Line
              key={hub}
              type="monotone"
              dataKey={hub}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 3 — Stacked bar: Participant market_share_pct by participant_type per hub
// ---------------------------------------------------------------------------

const PTYPE_COLORS: Record<string, string> = {
  Producer: '#10b981',
  Retailer: '#3b82f6',
  Trader: '#f59e0b',
  Aggregator: '#8b5cf6',
  Broker: '#ef4444',
}
const PARTICIPANT_TYPES = ['Producer', 'Retailer', 'Trader', 'Aggregator', 'Broker']

function ParticipantMarketShareChart({ data }: { data: AEHMDashboard }) {
  const hubs = [...new Set(data.participants.map(p => p.hub_name))]

  const chartData = hubs.map(hub => {
    const row: Record<string, number | string> = {
      hub: hub.replace(' Hub', '').replace(' Exchange', '').replace(' Market', ''),
    }
    for (const pt of PARTICIPANT_TYPES) {
      const recs = data.participants.filter(p => p.hub_name === hub && p.participant_type === pt)
      row[pt] = recs.reduce((sum, r) => sum + r.market_share_pct, 0)
    }
    return row
  })

  return (
    <ChartCard title="Participant Market Share % by Type per Hub (stacked)">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="hub"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-35}
            textAnchor="end"
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {PARTICIPANT_TYPES.map(pt => (
            <Bar key={pt} dataKey={pt} stackId="a" fill={PTYPE_COLORS[pt]} name={pt} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 4 — Bar chart: Quarterly transaction_count by hub (2024)
// ---------------------------------------------------------------------------

const QUARTER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

function QuarterlyTransactionChart({ data }: { data: AEHMDashboard }) {
  const hubs = [...new Set(data.transactions.map(t => t.hub_name))]
  const txn2024 = data.transactions.filter(t => t.year === 2024)

  const chartData = QUARTERS.map(q => {
    const row: Record<string, number | string> = { quarter: q }
    for (const hub of hubs) {
      const rec = txn2024.find(t => t.hub_name === hub && t.quarter === q)
      const shortName = hub
        .replace(' Hub', '')
        .replace(' Exchange', '')
        .replace(' Market', '')
        .replace(' Energy', '')
      row[shortName] = rec ? rec.transaction_count : 0
    }
    return row
  })

  const shortHubs = hubs.map(h =>
    h.replace(' Hub', '').replace(' Exchange', '').replace(' Market', '').replace(' Energy', '')
  )

  return (
    <ChartCard title="Quarterly Transaction Count by Hub (2024)">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {shortHubs.map((hub, i) => (
            <Bar
              key={hub}
              dataKey={hub}
              fill={LINE_COLORS[i % LINE_COLORS.length]}
              stackId="a"
              name={hub}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 5 — Bar chart: Hub daily_volume by hub_type (coloured)
// ---------------------------------------------------------------------------

const HUB_TYPE_COLORS: Record<string, string> = {
  Gas: '#f59e0b',
  Electricity: '#3b82f6',
  Hybrid: '#10b981',
}

function DailyVolumeByTypeChart({ data }: { data: AEHMDashboard }) {
  const chartData = [...data.hubs]
    .sort((a, b) => b.daily_volume_tj_or_mwh - a.daily_volume_tj_or_mwh)
    .map(h => ({
      name: h.hub_name.replace(' Hub', '').replace(' Exchange', '').replace(' Market', ''),
      volume: h.daily_volume_tj_or_mwh,
      type: h.hub_type,
      fill: HUB_TYPE_COLORS[h.hub_type] ?? '#9ca3af',
    }))

  return (
    <ChartCard title="Daily Volume by Hub (coloured by Hub Type — Gas / Electricity / Hybrid)">
      <div className="flex gap-4 mb-3">
        {Object.entries(HUB_TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-400">{type}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-35}
            textAnchor="end"
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#f3f4f6' }}
            formatter={(value: number) => [value.toLocaleString(), 'Daily Volume (TJ or MWh)']}
          />
          {chartData.map(entry => (
            <Bar
              key={entry.name}
              dataKey="volume"
              data={[entry]}
              fill={entry.fill}
              radius={[4, 4, 0, 0]}
              name={entry.name}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function EnergyHubMicrostructureAnalytics() {
  const [dashboard, setDashboard] = useState<AEHMDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyHubMicrostructureDashboard()
      .then(data => {
        setDashboard(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err?.message ?? 'Failed to load data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 animate-pulse">Loading Energy Hub Microstructure data…</p>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400">{error ?? 'No data available'}</p>
      </div>
    )
  }

  const { summary } = dashboard

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-teal-600 rounded-lg">
          <Globe size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Australian Energy Hub Microstructure Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Order book depth, participant structure and transaction patterns across Australian energy hubs
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="Total Hubs"
          value={String(summary.total_hubs)}
          sub="Gas, Electricity & Hybrid"
          icon={Globe}
          color="bg-teal-600"
        />
        <KpiCard
          title="Most Liquid Hub"
          value={summary.most_liquid_hub.split(' ').slice(0, 2).join(' ')}
          sub="Highest liquidity index"
          icon={Activity}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Total Daily Volume"
          value={`${(summary.total_daily_volume / 1000).toFixed(1)}K`}
          sub="TJ or MWh across all hubs"
          icon={BarChart2}
          color="bg-blue-600"
        />
        <KpiCard
          title="Avg Bid-Ask Spread"
          value={summary.avg_bid_ask_spread.toFixed(3)}
          sub="Average across order book records"
          icon={DollarSign}
          color="bg-amber-600"
        />
      </div>

      {/* Charts — 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HubLiquidityChart data={dashboard} />
        <BidAskSpreadTrendChart data={dashboard} />
        <ParticipantMarketShareChart data={dashboard} />
        <QuarterlyTransactionChart data={dashboard} />
        <div className="lg:col-span-2">
          <DailyVolumeByTypeChart data={dashboard} />
        </div>
      </div>
    </div>
  )
}
