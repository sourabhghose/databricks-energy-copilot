import { useEffect, useState } from 'react'
import { Flame, TrendingUp, DollarSign, Users, BarChart2 } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getNaturalGasTradingDashboard } from '../api/client'
import type { NGTSDashboard } from '../api/client'

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
// Colour palettes
// ---------------------------------------------------------------------------

const HUB_COLORS: Record<string, string> = {
  Wallumbilla: '#60a5fa',
  Moomba:      '#fbbf24',
  Victoria:    '#a78bfa',
  Adelaide:    '#34d399',
  Darwin:      '#f87171',
}

const PARTICIPANT_COLORS = [
  '#60a5fa', '#fbbf24', '#a78bfa', '#34d399', '#f87171',
  '#fb923c', '#e879f9', '#2dd4bf', '#facc15', '#f43f5e',
]

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function NaturalGasTradingAnalytics() {
  const [data, setData] = useState<NGTSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNaturalGasTradingDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 bg-gray-900 min-h-screen">
        Loading Natural Gas Trading Analytics...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 bg-gray-900 min-h-screen">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const { summary, trades, hub_prices, pipeline_flows, settlements } = data

  const hubs = ['Wallumbilla', 'Moomba', 'Victoria', 'Adelaide', 'Darwin']

  // ── Chart 1: Monthly spot_price_gj trend 2022-2024 by hub ──
  const spotPriceChartData = (() => {
    const years = [2022, 2023, 2024]
    const months = [1, 2, 3, 4, 5, 6]
    const rows: Record<string, number | string>[] = []
    for (const year of years) {
      for (const month of months) {
        const entry: Record<string, number | string> = {
          label: `${year}-${String(month).padStart(2, '0')}`,
        }
        for (const hub of hubs) {
          const rec = hub_prices.find(h => h.hub === hub && h.year === year && h.month === month)
          if (rec) entry[hub] = rec.spot_price_gj
        }
        rows.push(entry)
      }
    }
    return rows
  })()

  // ── Chart 2: Total trade volume (GJ) by hub ──
  const tradeVolumeByHub = hubs.map(hub => ({
    hub,
    volume_gj: Math.round(
      trades.filter(t => t.hub === hub).reduce((sum, t) => sum + t.volume_gj, 0)
    ),
  }))

  // ── Chart 3: Pipeline utilisation_pct by pipeline (2024, month 6) ──
  const pipelineUtilData = pipeline_flows
    .filter(p => p.year === 2024 && p.month === 6)
    .map(p => ({
      name: p.pipeline_name.replace(' Pipeline', '').replace(' Gas', ''),
      utilisation_pct: p.utilisation_pct,
    }))

  // ── Chart 4: Quarterly settlement_amount by participant (2024, stacked) ──
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const participants2024 = [...new Set(settlements.filter(s => s.year === 2024).map(s => s.participant))]
  const settlementChartData = quarters.map(q => {
    const entry: Record<string, number | string> = { quarter: q }
    for (const part of participants2024) {
      const rec = settlements.find(s => s.year === 2024 && s.quarter === q && s.participant === part)
      entry[part] = rec ? rec.settlement_amount_m_aud : 0
    }
    return entry
  })

  // ── Chart 5: Price volatility_pct by hub (2024 average) ──
  const volatilityByHub = hubs.map(hub => {
    const recs = hub_prices.filter(h => h.hub === hub && h.year === 2024)
    const avg = recs.length > 0 ? recs.reduce((s, h) => s + h.price_volatility_pct, 0) / recs.length : 0
    return { hub, avg_volatility_pct: Math.round(avg * 10) / 10 }
  })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Flame size={28} className="text-orange-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Natural Gas Trading &amp; Settlement Analytics</h1>
          <p className="text-sm text-gray-400">NGTS — hub prices, pipeline flows, trade records and settlement positions</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total Trade Volume"
          value={`${summary.total_trade_volume_pj.toFixed(3)} PJ`}
          sub="Aggregated across all hubs"
          icon={BarChart2}
          color="bg-orange-600"
        />
        <KpiCard
          title="Avg Spot Price"
          value={`$${summary.avg_spot_price_gj.toFixed(2)}/GJ`}
          sub="All hubs, 2022-2024"
          icon={DollarSign}
          color="bg-blue-600"
        />
        <KpiCard
          title="Total Participants"
          value={String(summary.total_participants)}
          sub="Active gas traders"
          icon={Users}
          color="bg-purple-600"
        />
        <KpiCard
          title="Highest Price Hub"
          value={summary.highest_price_hub}
          sub="Avg spot price leader"
          icon={TrendingUp}
          color="bg-green-600"
        />
      </div>

      {/* Chart 1: Monthly Spot Price Trend by Hub */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Monthly Spot Price Trend by Hub ($/GJ)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={spotPriceChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              interval={2}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="$/GJ" width={70} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {hubs.map(hub => (
              <Line
                key={hub}
                type="monotone"
                dataKey={hub}
                stroke={HUB_COLORS[hub]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Total Trade Volume by Hub */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Total Trade Volume by Hub (GJ)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={tradeVolumeByHub} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="hub" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Bar dataKey="volume_gj" name="Volume (GJ)" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Pipeline Utilisation (2024, Month 6) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Pipeline Utilisation % (2024, June)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={pipelineUtilData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[0, 100]} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} width={160} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Bar dataKey="utilisation_pct" name="Utilisation %" fill="#60a5fa" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Quarterly Settlement Amount by Participant (2024, stacked) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Quarterly Settlement Amount by Participant (2024, A$M)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={settlementChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            {participants2024.map((part, idx) => (
              <Bar
                key={part}
                dataKey={part}
                stackId="a"
                fill={PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Price Volatility by Hub (2024 average) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Average Price Volatility by Hub (2024, %)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={volatilityByHub} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="hub" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Bar dataKey="avg_volatility_pct" name="Avg Volatility %" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
