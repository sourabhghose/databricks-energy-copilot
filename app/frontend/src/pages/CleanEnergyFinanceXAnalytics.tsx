import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Activity, BarChart2 } from 'lucide-react'
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
  Cell,
} from 'recharts'
import { getCleanEnergyFinanceAnalyticsDashboard } from '../api/client'
import type { CEFAXDashboard } from '../api/client'

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

const TECH_COLORS: Record<string, string> = {
  Solar:        '#fbbf24',
  Wind:         '#60a5fa',
  Battery:      '#34d399',
  Hydrogen:     '#a78bfa',
  Transmission: '#f87171',
  Other:        '#94a3b8',
}

const STATE_COLORS: Record<string, string> = {
  NSW: '#3b82f6',
  QLD: '#f59e0b',
  VIC: '#10b981',
  SA:  '#8b5cf6',
  WA:  '#ec4899',
  TAS: '#06b6d4',
}

const FUND_TYPE_COLORS: Record<string, string> = {
  CEFC:           '#34d399',
  ARENA:          '#60a5fa',
  'Green Bank':   '#a78bfa',
  'Private PE':   '#fbbf24',
  Superannuation: '#f87171',
  Government:     '#94a3b8',
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CleanEnergyFinanceXAnalytics() {
  const [data, setData] = useState<CEFAXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCleanEnergyFinanceAnalyticsDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 bg-gray-900 min-h-screen">
        Loading Clean Energy Finance Analytics...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 bg-gray-900 min-h-screen">
        Error loading data: {error ?? 'No data'}
      </div>
    )
  }

  const { investments, funds, cost_trends, risk_metrics, summary } = data

  // ── Chart 1: Total investment by technology (2024) stacked by state ──
  const inv2024 = investments.filter((r) => r.year === 2024)
  const techStateMap: Record<string, Record<string, number>> = {}
  for (const r of inv2024) {
    if (!techStateMap[r.technology]) techStateMap[r.technology] = {}
    techStateMap[r.technology][r.state] =
      (techStateMap[r.technology][r.state] ?? 0) + r.investment_m_aud
  }
  const investmentByTech = Object.entries(techStateMap).map(([tech, states]) => ({
    technology: tech,
    ...states,
  }))
  const allStates = Array.from(new Set(inv2024.map((r) => r.state)))

  // ── Chart 2: Fund deployed_m_aud coloured by fund_type ──
  const fundDeployed = funds.map((f) => ({
    name: f.fund_name.replace(' Fund', '').replace(' Infrastructure', ' Infra'),
    deployed: f.deployed_m_aud,
    fund_type: f.fund_type,
  }))

  // ── Chart 3: LCOE trend by technology (2020-2024) ──
  const lcoeByYear: Record<number, Record<string, number>> = {}
  for (const ct of cost_trends) {
    if (!lcoeByYear[ct.year]) lcoeByYear[ct.year] = { year: ct.year }
    lcoeByYear[ct.year][ct.technology] = ct.lcoe_mwh
  }
  const lcoeTrend = Object.values(lcoeByYear).sort((a, b) => (a.year as number) - (b.year as number))
  const technologies = Array.from(new Set(cost_trends.map((c) => c.technology)))

  // ── Chart 4: Risk scores by project (top 15, sorted by merchant_risk_score desc) ──
  const topRisk = [...risk_metrics]
    .sort((a, b) => b.merchant_risk_score - a.merchant_risk_score)
    .slice(0, 15)
    .map((r) => ({
      name: r.project_name.length > 20 ? r.project_name.slice(0, 18) + '…' : r.project_name,
      merchant: r.merchant_risk_score,
      regulatory: r.regulatory_risk_score,
      construction: r.construction_risk_score,
    }))

  // ── Chart 5: Fund portfolio_irr_pct sorted descending ──
  const fundIrr = [...funds]
    .sort((a, b) => b.portfolio_irr_pct - a.portfolio_irr_pct)
    .map((f) => ({
      name: f.fund_name.replace(' Fund', '').replace(' Infrastructure', ' Infra'),
      irr: f.portfolio_irr_pct,
      fund_type: f.fund_type,
    }))

  return (
    <div className="bg-gray-900 min-h-screen text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-emerald-600">
          <DollarSign size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Clean Energy Finance Analytics</h1>
          <p className="text-xs text-gray-400">Sprint 151c — CEFA: Investment flows, fund performance & project risk</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="2024 Total Investment"
          value={`A$${(summary.total_investment_2024_m_aud / 1000).toFixed(1)}B`}
          sub="Across all technologies"
          icon={DollarSign}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Total Projects"
          value={String(summary.total_projects)}
          sub="Active pipeline"
          icon={Activity}
          color="bg-blue-600"
        />
        <KpiCard
          title="Average Project IRR"
          value={`${summary.avg_irr_pct.toFixed(1)}%`}
          sub="Portfolio weighted"
          icon={TrendingUp}
          color="bg-amber-600"
        />
        <KpiCard
          title="CEFC Deployed"
          value={`A$${(summary.cefc_deployed_m_aud / 1000).toFixed(2)}B`}
          sub="CEFC Infrastructure Fund"
          icon={BarChart2}
          color="bg-violet-600"
        />
      </div>

      {/* Chart 1: Investment by Technology stacked by State */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Total Investment by Technology — 2024 (A$M, stacked by State)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={investmentByTech} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="technology" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
            {allStates.map((state) => (
              <Bar key={state} dataKey={state} stackId="a" fill={STATE_COLORS[state] ?? '#6b7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Fund Deployed Capital by Fund Type */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Fund Deployed Capital (A$M) — Coloured by Fund Type
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={fundDeployed} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 9 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Bar dataKey="deployed" name="Deployed (A$M)">
              {fundDeployed.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={FUND_TYPE_COLORS[entry.fund_type] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: LCOE Trend by Technology */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          LCOE Trend by Technology 2020–2024 (A$/MWh)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={lcoeTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="$/MWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
            {technologies.map((tech) => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                stroke={TECH_COLORS[tech] ?? '#6b7280'}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Risk Scores by Project (top 15, horizontal bar) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Project Risk Scores — Top 15 by Merchant Risk (sorted descending)
        </h2>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart
            layout="vertical"
            data={topRisk}
            margin={{ top: 5, right: 20, bottom: 5, left: 120 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" domain={[0, 10]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 9 }}
              width={115}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
            <Bar dataKey="merchant" name="Merchant Risk" fill="#f87171" />
            <Bar dataKey="regulatory" name="Regulatory Risk" fill="#fbbf24" />
            <Bar dataKey="construction" name="Construction Risk" fill="#60a5fa" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Fund Portfolio IRR sorted descending */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Fund Portfolio IRR (%) — Sorted Descending
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={fundIrr} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 9 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Bar dataKey="irr" name="Portfolio IRR (%)">
              {fundIrr.map((entry, index) => (
                <Cell key={`irr-cell-${index}`} fill={FUND_TYPE_COLORS[entry.fund_type] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
