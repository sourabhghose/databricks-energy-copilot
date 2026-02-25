import { useEffect, useState } from 'react'
import { Clock, DollarSign, Activity, AlertTriangle } from 'lucide-react'
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
import { getAemo5MinSettlementDashboard } from '../api/client'
import type { AEMO5Mdashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#6366f1',
  SA1:  '#10b981',
  TAS1: '#8b5cf6',
}

const INTERVAL_COLOURS: Record<string, string> = {
  '5-min dispatch':  '#3b82f6',
  '30-min trading':  '#f59e0b',
  Predispatch:       '#10b981',
  STPASA:            '#ef4444',
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
export default function Aemo5MinSettlementAnalytics() {
  const [data, setData] = useState<AEMO5Mdashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAemo5MinSettlementDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading AEMO 5-Min Settlement Analytics...</p>
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

  const { dispatch, settlement, intervals, compliance, summary } = data

  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

  // Chart 1: Line — Monthly avg dispatch price by region (2024, months 1-4)
  const dispatch2024 = dispatch.filter(d => d.year === 2024)
  const chart1Data = [1, 2, 3, 4].map(m => {
    const row: Record<string, string | number> = { month: `M${m}` }
    for (const region of regions) {
      const rec = dispatch2024.find(d => d.region === region && d.month === m)
      row[region] = rec ? Math.round(rec.avg_dispatch_price_mwh * 100) / 100 : 0
    }
    return row
  })

  // Chart 2: Bar (grouped) — Settlement value vs energy settled by region (2024)
  const settlement2024 = settlement.filter(s => s.year === 2024)
  const chart2Data = regions.map(region => {
    const recs = settlement2024.filter(s => s.region === region)
    const totalEnergy = recs.reduce((sum, r) => sum + r.total_energy_settled_gwh, 0)
    const totalValue = recs.reduce((sum, r) => sum + r.total_settlement_value_m_aud, 0)
    return {
      region,
      energy_gwh: Math.round(totalEnergy),
      value_m_aud: Math.round(totalValue),
    }
  })

  // Chart 3: Bar — Price spread (max-min) by interval type (averaged across regions, 2024)
  const intervals2024 = intervals.filter(i => i.year === 2024)
  const intervalTypes = ['5-min dispatch', '30-min trading', 'Predispatch', 'STPASA']
  const chart3Data = intervalTypes.map(itype => {
    const recs = intervals2024.filter(i => i.interval_type === itype)
    const avgSpread = recs.length > 0
      ? Math.round((recs.reduce((s, r) => s + r.price_spread_mwh, 0) / recs.length) * 100) / 100
      : 0
    return {
      interval_type: itype,
      avg_price_spread: avgSpread,
    }
  })

  // Chart 4: Bar — Rebid count by participant (2024, sorted desc)
  const participantNames = [...new Set(compliance.map(c => c.participant_name))]
  const chart4Data = participantNames.map(name => {
    const recs = compliance.filter(c => c.participant_name === name && c.year === 2024)
    const totalRebids = recs.reduce((sum, r) => sum + r.rebid_count, 0)
    return {
      name: name.length > 14 ? name.slice(0, 14) + '…' : name,
      rebid_count: totalRebids,
    }
  }).sort((a, b) => b.rebid_count - a.rebid_count)

  // Chart 5: Line — Dispatch compliance % trend by participant (Q1-Q4 2024)
  const quarterList = ['Q1', 'Q2', 'Q3', 'Q4']
  const chart5Data = quarterList.map(q => {
    const row: Record<string, string | number> = { quarter: q }
    for (const name of participantNames) {
      const rec = compliance.find(c => c.participant_name === name && c.quarter === q && c.year === 2024)
      const shortName = name.length > 14 ? name.slice(0, 14) + '…' : name
      row[shortName] = rec ? Math.round(rec.dispatch_compliance_pct * 100) / 100 : 0
    }
    return row
  })
  const participantShortNames = participantNames.map(n =>
    n.length > 14 ? n.slice(0, 14) + '…' : n
  )
  const participantLineColors = [
    '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#a3e635', '#64748b',
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-indigo-700 border-b border-indigo-800 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-indigo-900 rounded-lg">
          <Clock size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">AEMO 5-Minute Settlement Dispatch Analytics</h1>
          <p className="text-xs text-indigo-200">AEMO5M — Dispatch Pricing, Settlement, Interval Types & Compliance</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Avg Dispatch Price 2024"
            value={`$${summary.avg_dispatch_price_2024_mwh.toFixed(2)}/MWh`}
            sub="Average across all regions"
            icon={DollarSign}
            color="bg-indigo-700"
          />
          <KpiCard
            title="Total Settlement Value 2024"
            value={`$${(summary.total_settlement_value_2024_m_aud / 1000).toFixed(1)}B`}
            sub="AUD settled across NEM"
            icon={Activity}
            color="bg-blue-700"
          />
          <KpiCard
            title="Most Volatile Region"
            value={summary.most_volatile_region}
            sub="Highest avg price volatility"
            icon={AlertTriangle}
            color="bg-amber-700"
          />
          <KpiCard
            title="Total Cap Price Intervals"
            value={summary.total_cap_price_intervals.toLocaleString()}
            sub="All regions, 2022–2024"
            icon={Clock}
            color="bg-purple-700"
          />
        </div>

        {/* Chart 1: Monthly avg dispatch price by region (2024) */}
        <ChartCard title="Monthly Average Dispatch Price by Region (2024, $/MWh)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chart1Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {regions.map(region => (
                <Line
                  key={region}
                  type="monotone"
                  dataKey={region}
                  stroke={REGION_COLOURS[region]}
                  strokeWidth={2}
                  dot={{ r: 4, fill: REGION_COLOURS[region] }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Settlement value vs energy settled by region (2024) */}
        <ChartCard title="Settlement Value vs Energy Settled by Region (2024)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart2Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="energy_gwh" name="Energy Settled (GWh)" fill="#3b82f6" />
              <Bar yAxisId="right" dataKey="value_m_aud" name="Settlement Value ($M AUD)" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Price spread by interval type (2024) */}
        <ChartCard title="Average Price Spread (Max–Min) by Interval Type (2024, $/MWh)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart3Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="interval_type" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }}
              />
              <Bar dataKey="avg_price_spread" name="Avg Price Spread ($/MWh)">
                {chart3Data.map((entry) => (
                  <rect key={entry.interval_type} fill={INTERVAL_COLOURS[entry.interval_type] ?? '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Rebid count by participant (2024, sorted desc) */}
        <ChartCard title="Rebid Count by Participant (2024, sorted descending)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart4Data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} width={110} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }}
              />
              <Bar dataKey="rebid_count" name="Total Rebid Count" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Dispatch compliance % trend by participant (Q1-Q4 2024) */}
        <ChartCard title="Dispatch Compliance % Trend by Participant (Q1–Q4 2024)">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chart5Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis
                domain={[85, 100]}
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                unit="%"
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {participantShortNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={participantLineColors[i % participantLineColors.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
