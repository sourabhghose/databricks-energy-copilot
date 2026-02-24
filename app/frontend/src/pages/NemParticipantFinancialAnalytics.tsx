import { useEffect, useState } from 'react'
import { TrendingUp, Users, DollarSign, Award, BarChart2 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getNemParticipantFinancialDashboard } from '../api/client'
import type { NPFPdashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------
const TYPE_COLOURS: Record<string, string> = {
  Generator:  '#3b82f6',
  Retailer:   '#10b981',
  Trader:     '#f59e0b',
  Integrated: '#8b5cf6',
}

const REVENUE_COLOURS = {
  trading:  '#3b82f6',
  fcas:     '#10b981',
  capacity: '#f59e0b',
  hedge:    '#ef4444',
}

const COST_COLOURS = {
  fuel:    '#ef4444',
  opex:    '#f59e0b',
  carbon:  '#6b7280',
  network: '#8b5cf6',
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
        <p className="text-xl font-bold text-white leading-tight">{value}</p>
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
export default function NemParticipantFinancialAnalytics() {
  const [data, setData] = useState<NPFPdashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNemParticipantFinancialDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Participant Financial Analytics...</p>
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

  const { participants, revenue, costs, risk, summary } = data

  // ---------------------------------------------------------------------------
  // Chart 1: Revenue streams (trading, FCAS, capacity, hedge) per participant — 2024 Q4
  // ---------------------------------------------------------------------------
  const revenueQ4Chart = participants.map(p => {
    const rec = revenue.find(r => r.participant_id === p.participant_id && r.year === 2024 && r.quarter === 'Q4')
    return {
      name: p.participant_name.replace(/ (Energy|Group|Hydro|Retail)$/, '').slice(0, 12),
      Trading:  rec?.trading_revenue_m_aud ?? 0,
      FCAS:     rec?.fcas_revenue_m_aud ?? 0,
      Capacity: rec?.capacity_revenue_m_aud ?? 0,
      Hedge:    rec?.hedge_pnl_m_aud ?? 0,
    }
  })

  // ---------------------------------------------------------------------------
  // Chart 2: EBITDA margin % by participant — 2024, sorted desc
  // ---------------------------------------------------------------------------
  const ebitdaChart = participants
    .map(p => {
      const c = costs.find(cr => cr.participant_id === p.participant_id && cr.year === 2024)
      return {
        name:   p.participant_name.replace(/ (Energy|Group|Hydro|Retail)$/, '').slice(0, 12),
        EBITDA: c?.ebitda_margin_pct ?? 0,
        type:   p.participant_type,
      }
    })
    .sort((a, b) => b.EBITDA - a.EBITDA)

  // ---------------------------------------------------------------------------
  // Chart 3: Quarterly total revenue by participant — 2024 stacked
  // ---------------------------------------------------------------------------
  const quarterlyRevChart = (['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
    const row: Record<string, string | number> = { quarter: q }
    for (const p of participants) {
      const rec = revenue.find(r => r.participant_id === p.participant_id && r.year === 2024 && r.quarter === q)
      const shortName = p.participant_name.replace(/ (Energy|Group|Hydro|Retail)$/, '').slice(0, 10)
      row[shortName] = parseFloat((rec?.total_revenue_m_aud ?? 0).toFixed(2))
    }
    return row
  })

  const participantShortNames = participants.map(p =>
    p.participant_name.replace(/ (Energy|Group|Hydro|Retail)$/, '').slice(0, 10)
  )

  const STACK_COLOURS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6',
    '#a855f7', '#eab308',
  ]

  // ---------------------------------------------------------------------------
  // Chart 4: Cost breakdown per participant type (averaged, 2024)
  // ---------------------------------------------------------------------------
  const types = ['Generator', 'Retailer', 'Trader', 'Integrated']
  const costByTypeChart = types.map(t => {
    const typeParticipants = participants.filter(p => p.participant_type === t)
    const typeCosts = costs.filter(c => c.year === 2024 && typeParticipants.some(p => p.participant_id === c.participant_id))
    const count = typeCosts.length || 1
    return {
      type:    t,
      Fuel:    parseFloat((typeCosts.reduce((s, c) => s + c.fuel_cost_m_aud, 0) / count).toFixed(2)),
      Opex:    parseFloat((typeCosts.reduce((s, c) => s + c.opex_m_aud, 0) / count).toFixed(2)),
      Carbon:  parseFloat((typeCosts.reduce((s, c) => s + c.carbon_cost_m_aud, 0) / count).toFixed(2)),
      Network: parseFloat((typeCosts.reduce((s, c) => s + c.network_charges_m_aud, 0) / count).toFixed(2)),
    }
  })

  // ---------------------------------------------------------------------------
  // Chart 5: VaR vs credit exposure by participant — 2024
  // ---------------------------------------------------------------------------
  const riskChart = participants.map(p => {
    const rm = risk.find(r => r.participant_id === p.participant_id && r.year === 2024)
    return {
      name:   p.participant_name.replace(/ (Energy|Group|Hydro|Retail)$/, '').slice(0, 12),
      VaR:    rm?.value_at_risk_m_aud ?? 0,
      Credit: rm?.credit_exposure_m_aud ?? 0,
    }
  })

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' },
    labelStyle:   { color: '#e5e7eb' },
    itemStyle:    { color: '#9ca3af' },
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg">
          <TrendingUp size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">NEM Participant Financial Performance</h1>
          <p className="text-xs text-gray-400">Sprint 159b — Revenue, cost and risk analytics for NEM market participants</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Participants"
            value={String(summary.total_participants)}
            sub="Active NEM market participants"
            icon={Users}
            color="bg-blue-600"
          />
          <KpiCard
            title="Total Market Revenue"
            value={`$${summary.total_market_revenue_m_aud.toLocaleString(undefined, { maximumFractionDigits: 0 })} M`}
            sub="Across all participants and periods"
            icon={DollarSign}
            color="bg-emerald-600"
          />
          <KpiCard
            title="Avg EBITDA Margin"
            value={`${summary.avg_ebitda_margin_pct.toFixed(1)}%`}
            sub="2024 average across participants"
            icon={BarChart2}
            color="bg-indigo-600"
          />
          <KpiCard
            title="Most Profitable"
            value={summary.most_profitable_participant}
            sub="Highest cumulative EBITDA"
            icon={Award}
            color="bg-amber-600"
          />
        </div>

        {/* Chart 1: Revenue streams per participant — 2024 Q4 */}
        <ChartCard title="Revenue Streams by Participant — 2024 Q4 (M AUD, Grouped)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueQ4Chart} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} unit=" M" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Bar dataKey="Trading"  fill={REVENUE_COLOURS.trading}  radius={[2, 2, 0, 0]} />
              <Bar dataKey="FCAS"     fill={REVENUE_COLOURS.fcas}     radius={[2, 2, 0, 0]} />
              <Bar dataKey="Capacity" fill={REVENUE_COLOURS.capacity} radius={[2, 2, 0, 0]} />
              <Bar dataKey="Hedge"    fill={REVENUE_COLOURS.hedge}    radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: EBITDA margin % by participant — 2024, sorted desc */}
        <ChartCard title="EBITDA Margin % by Participant — 2024 (Sorted Descending)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ebitdaChart} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} unit="%" />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="EBITDA" name="EBITDA Margin %" radius={[3, 3, 0, 0]}>
                {ebitdaChart.map((entry, idx) => (
                  <rect key={idx} fill={TYPE_COLOURS[entry.type] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Quarterly total revenue by participant — 2024, stacked */}
        <ChartCard title="Quarterly Total Revenue by Participant — 2024 (M AUD, Stacked)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={quarterlyRevChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} unit=" M" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
              {participantShortNames.map((name, idx) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="a"
                  fill={STACK_COLOURS[idx % STACK_COLOURS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Cost breakdown per participant type — 2024 averaged */}
        <ChartCard title="Avg Cost Breakdown by Participant Type — 2024 (M AUD, Grouped)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={costByTypeChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} unit=" M" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Bar dataKey="Fuel"    fill={COST_COLOURS.fuel}    radius={[2, 2, 0, 0]} />
              <Bar dataKey="Opex"    fill={COST_COLOURS.opex}    radius={[2, 2, 0, 0]} />
              <Bar dataKey="Carbon"  fill={COST_COLOURS.carbon}  radius={[2, 2, 0, 0]} />
              <Bar dataKey="Network" fill={COST_COLOURS.network} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: VaR vs credit exposure by participant — 2024 */}
        <ChartCard title="Value at Risk vs Credit Exposure by Participant — 2024 (M AUD)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={riskChart} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} unit=" M" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Bar dataKey="VaR"    name="Value at Risk"    fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Credit" name="Credit Exposure"  fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
