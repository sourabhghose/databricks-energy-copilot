import { useEffect, useState } from 'react'
import { DollarSign } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getRetailerFinancialHealthDashboard,
  ERFHDashboard,
  ERFHRetailer,
  ERFHProfitability,
  ERFHRisk,
  ERFHPrudential,
  ERFHComparison,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const CREDIT_COLORS: Record<string, string> = {
  A:          '#22c55e',
  BBB:        '#84cc16',
  BB:         '#f59e0b',
  B:          '#f97316',
  'Not Rated':'#94a3b8',
}

const RISK_COLORS: Record<string, string> = {
  High:   '#ef4444',
  Medium: '#f59e0b',
  Low:    '#22c55e',
}

const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6']

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 1 — Retailer EBITDA margin % coloured by credit_rating
// ---------------------------------------------------------------------------

function EbitdaMarginChart({ retailers }: { retailers: ERFHRetailer[] }) {
  const data = [...retailers]
    .sort((a, b) => b.ebitda_margin_pct - a.ebitda_margin_pct)
    .map(r => ({
      name: r.retailer_name.length > 18 ? r.retailer_name.slice(0, 18) + '…' : r.retailer_name,
      ebitda_margin_pct: r.ebitda_margin_pct,
      credit_rating: r.credit_rating,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Retailer EBITDA Margin (%) by Credit Rating
      </h3>
      <div className="flex flex-wrap gap-3 mb-3">
        {Object.entries(CREDIT_COLORS).map(([rating, colour]) => (
          <span key={rating} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: colour }} />
            {rating}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            formatter={(v: number, _n: string, entry: any) => [
              `${v.toFixed(1)}%`,
              `EBITDA Margin (${entry.payload.credit_rating})`,
            ]}
          />
          <Bar dataKey="ebitda_margin_pct" radius={[4, 4, 0, 0]}>
            {data.map((d, idx) => (
              <Cell key={idx} fill={CREDIT_COLORS[d.credit_rating] ?? '#6366f1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 2 — Stacked bar: quarterly revenue vs gross_margin for 3 retailers
// ---------------------------------------------------------------------------

function QuarterlyProfitabilityChart({ profitability }: { profitability: ERFHProfitability[] }) {
  const retailerIds = Array.from(new Set(profitability.map(p => p.retailer_id)))
  // Build per-quarter aggregates labelled by retailer
  const quarters = ['2022-Q1','2022-Q2','2022-Q3','2022-Q4','2023-Q1','2023-Q2','2023-Q3','2023-Q4','2024-Q1','2024-Q2','2024-Q3','2024-Q4']

  const data = quarters.map(qLabel => {
    const [yrStr, q] = qLabel.split('-')
    const yr = parseInt(yrStr, 10)
    const row: Record<string, any> = { quarter: qLabel }
    for (const rid of retailerIds) {
      const rec = profitability.find(p => p.retailer_id === rid && p.year === yr && p.quarter === q)
      row[`${rid}_rev`] = rec ? rec.revenue_m_aud : 0
      row[`${rid}_gm`] = rec ? rec.gross_margin_m_aud : 0
    }
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Quarterly Revenue vs Gross Margin — Top 3 Retailers ($M AUD)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-45} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {retailerIds.map((rid, idx) => (
            <Bar key={`${rid}_rev`} dataKey={`${rid}_rev`} name={`${rid} Revenue`} stackId="a" fill={LINE_COLORS[idx % LINE_COLORS.length]} />
          ))}
          {retailerIds.map((rid, idx) => (
            <Bar key={`${rid}_gm`} dataKey={`${rid}_gm`} name={`${rid} Gross Margin`} stackId="b" fill={LINE_COLORS[(idx + 3) % LINE_COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 3 — Risk score by risk_type coloured by risk_level
// ---------------------------------------------------------------------------

function RiskScoreChart({ risks }: { risks: ERFHRisk[] }) {
  // Average risk score per risk_type across all retailers
  const riskTypes = Array.from(new Set(risks.map(r => r.risk_type)))
  const data = riskTypes.map(rt => {
    const subset = risks.filter(r => r.risk_type === rt)
    const avgScore = subset.reduce((s, r) => s + r.risk_score, 0) / subset.length
    // Majority risk level
    const levelCounts: Record<string, number> = {}
    subset.forEach(r => { levelCounts[r.risk_level] = (levelCounts[r.risk_level] ?? 0) + 1 })
    const majorLevel = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0][0]
    return { risk_type: rt, avg_score: parseFloat(avgScore.toFixed(2)), risk_level: majorLevel }
  }).sort((a, b) => b.avg_score - a.avg_score)

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Average Risk Score by Risk Type (coloured by Risk Level)
      </h3>
      <div className="flex gap-4 mb-3">
        {Object.entries(RISK_COLORS).map(([level, colour]) => (
          <span key={level} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: colour }} />
            {level}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 120, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis type="number" domain={[0, 10]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis type="category" dataKey="risk_type" tick={{ fill: '#9ca3af', fontSize: 11 }} width={115} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            formatter={(v: number, _n: string, entry: any) => [
              `${v.toFixed(2)} / 10`,
              `Avg Risk Score (${entry.payload.risk_level})`,
            ]}
          />
          <Bar dataKey="avg_score" radius={[0, 4, 4, 0]}>
            {data.map((d, idx) => (
              <Cell key={idx} fill={RISK_COLORS[d.risk_level] ?? '#6366f1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 4 — Quarterly prudential capital required vs deposited (line chart)
// ---------------------------------------------------------------------------

function PrudentialTrendChart({ prudential }: { prudential: ERFHPrudential[] }) {
  const quarters = ['2022-Q1','2022-Q2','2022-Q3','2022-Q4','2023-Q1','2023-Q2','2023-Q3','2023-Q4','2024-Q1','2024-Q2','2024-Q3','2024-Q4']
  const data = quarters.map(qLabel => {
    const [yrStr, q] = qLabel.split('-')
    const yr = parseInt(yrStr, 10)
    const rows = prudential.filter(p => p.year === yr && p.quarter === q)
    const totalReq = rows.reduce((s, r) => s + r.total_prudential_required_m_aud, 0)
    const totalDep = rows.reduce((s, r) => s + r.total_deposited_m_aud, 0)
    return {
      quarter: qLabel,
      required: parseFloat(totalReq.toFixed(2)),
      deposited: parseFloat(totalDep.toFixed(2)),
    }
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Quarterly Prudential Capital Required vs Deposited ($M AUD)
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-45} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Line type="monotone" dataKey="required" name="Required ($M)" stroke="#ef4444" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="deposited" name="Deposited ($M)" stroke="#22c55e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 5 — Metric comparison: retailer_a vs retailer_b vs industry_avg
// ---------------------------------------------------------------------------

function MetricComparisonChart({ comparison }: { comparison: ERFHComparison[] }) {
  // Use year 2024 data (most recent), pick 8 key metrics for readability
  const keyMetrics = [
    'EBITDA Margin',
    'Bad Debt Rate',
    'Churn Rate',
    'Hedge Ratio',
    'NPS Score',
    'Market Share',
    'Gross Margin',
  ]
  const latestYear = Math.max(...comparison.map(c => c.year))
  const data = comparison
    .filter(c => c.year === latestYear && keyMetrics.includes(c.metric))
    .map(c => ({
      metric: c.metric,
      'Major Retailer': c.retailer_a_value,
      'Mid-tier Retailer': c.retailer_b_value,
      'Industry Avg': c.industry_avg,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Retailer Metric Comparison — Major vs Mid-tier vs Industry Avg ({latestYear})
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="metric" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Bar dataKey="Major Retailer" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Mid-tier Retailer" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Industry Avg" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RetailerFinancialHealthAnalytics() {
  const [data, setData] = useState<ERFHDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRetailerFinancialHealthDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-gray-400 text-sm animate-pulse">Loading Retailer Financial Health data…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-red-400 text-sm">Failed to load data: {error}</span>
      </div>
    )
  }

  const { summary, retailers, profitability, risks, prudential, comparison } = data

  return (
    <div className="min-h-screen bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-500/10 rounded-lg">
          <DollarSign className="text-green-400" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Electricity Retailer Financial Health</h1>
          <p className="text-sm text-gray-400">Australian NEM retail market — financial health, profitability and prudential analytics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Total Market Revenue"
          value={`$${summary.total_market_revenue_b_aud.toFixed(2)}B`}
          sub="AUD — all retailers"
        />
        <KpiCard
          label="Avg EBITDA Margin"
          value={`${summary.avg_ebitda_margin_pct.toFixed(1)}%`}
          sub="Industry average"
        />
        <KpiCard
          label="Retailers at Exit Risk"
          value={`${summary.retailers_at_exit_risk}`}
          sub="Requiring AEMO monitoring"
        />
        <KpiCard
          label="Total Prudential Capital"
          value={`$${summary.total_prudential_capital_m_aud.toFixed(0)}M`}
          sub="Deposited with AEMO"
        />
      </div>

      {/* Charts — row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EbitdaMarginChart retailers={retailers} />
        <QuarterlyProfitabilityChart profitability={profitability} />
      </div>

      {/* Charts — row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskScoreChart risks={risks} />
        <PrudentialTrendChart prudential={prudential} />
      </div>

      {/* Chart — row 3 */}
      <MetricComparisonChart comparison={comparison} />

      {/* Retailer summary table */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Retailer Overview</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Retailer</th>
                <th className="text-right py-2 pr-4">Revenue ($M)</th>
                <th className="text-right py-2 pr-4">EBITDA Margin</th>
                <th className="text-right py-2 pr-4">Customers (K)</th>
                <th className="text-right py-2 pr-4">Credit Rating</th>
                <th className="text-right py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...retailers]
                .sort((a, b) => b.revenue_m_aud - a.revenue_m_aud)
                .map(r => (
                  <tr key={r.retailer_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-1.5 pr-4 font-medium">{r.retailer_name}</td>
                    <td className="text-right py-1.5 pr-4">{r.revenue_m_aud.toFixed(0)}</td>
                    <td className="text-right py-1.5 pr-4">
                      <span style={{ color: r.ebitda_margin_pct >= 10 ? '#22c55e' : r.ebitda_margin_pct >= 5 ? '#f59e0b' : '#ef4444' }}>
                        {r.ebitda_margin_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right py-1.5 pr-4">{r.customer_count_k.toFixed(0)}</td>
                    <td className="text-right py-1.5 pr-4">
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{ background: `${CREDIT_COLORS[r.credit_rating] ?? '#94a3b8'}22`, color: CREDIT_COLORS[r.credit_rating] ?? '#94a3b8' }}
                      >
                        {r.credit_rating}
                      </span>
                    </td>
                    <td className="text-right py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        r.status === 'Exit Risk' ? 'bg-red-500/20 text-red-400' :
                        r.status === 'Major' ? 'bg-blue-500/20 text-blue-400' :
                        r.status === 'Mid-tier' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
