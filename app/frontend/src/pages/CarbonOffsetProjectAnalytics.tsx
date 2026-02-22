import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Leaf } from 'lucide-react'
import {
  getCarbonOffsetProjectXDashboard,
  COPAXDashboard,
  COPAXProjectRecord,
  COPAXQualityRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
const RISK_COLOR: Record<string, string> = {
  Low: 'bg-emerald-700 text-emerald-100',
  Medium: 'bg-amber-700 text-amber-100',
  High: 'bg-red-700 text-red-100',
}

const STATUS_COLOR: Record<string, string> = {
  Active: 'bg-emerald-700 text-emerald-100',
  Completed: 'bg-blue-700 text-blue-100',
  Revoked: 'bg-red-700 text-red-100',
  Suspended: 'bg-amber-700 text-amber-100',
}

const IMPACT_COLOR: Record<string, string> = {
  Low: '#94a3b8',
  Medium: '#60a5fa',
  High: '#34d399',
  Transformative: '#a78bfa',
}

const TIER_COLOR: Record<string, string> = {
  Gold: '#fbbf24',
  Standard: '#38bdf8',
  Basic: '#94a3b8',
}

// ---------------------------------------------------------------------------
// KPI cards config
// ---------------------------------------------------------------------------
const buildKpiCards = (summary: Record<string, number | string>) => [
  {
    label: 'Active Projects',
    value: String(summary['total_active_projects'] ?? '—'),
    sub: 'ACCU-registered projects',
    color: 'from-emerald-600 to-emerald-800',
  },
  {
    label: 'Total ACCU Issued',
    value: `${summary['total_accu_issued_m'] ?? '—'} M`,
    sub: 'Cumulative ACCUs issued',
    color: 'from-green-600 to-green-800',
  },
  {
    label: 'Avg Spot Price',
    value: `$${summary['avg_spot_price_aud'] ?? '—'} AUD`,
    sub: 'ACCU spot — 24-month avg',
    color: 'from-teal-600 to-teal-800',
  },
  {
    label: 'Safeguard Demand Share',
    value: `${summary['safeguard_demand_fraction_pct'] ?? '—'}%`,
    sub: 'Of latest month demand',
    color: 'from-cyan-600 to-cyan-800',
  },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function CarbonOffsetProjectAnalytics() {
  const [data, setData] = useState<COPAXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCarbonOffsetProjectXDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-400">
        Loading Carbon Offset Project Analytics…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  // ---- Derived chart data ----

  // Market price trend chart
  const priceTrendData = data.market_records.map(m => ({
    date: m.date.slice(0, 7),
    spot: m.accu_spot_price_aud,
    fwd2026: m.accu_forward_2026,
    fwd2027: m.accu_forward_2027,
    fwd2028: m.accu_forward_2028,
  }))

  // ACCU issuances by methodology (top 8)
  const methIssuances: Record<string, number> = {}
  data.projects.forEach(p => {
    methIssuances[p.methodology] = (methIssuances[p.methodology] ?? 0) + p.accu_issued / 1000
  })
  const methIssuancesData = Object.entries(methIssuances)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value: Math.round(value) }))

  // Quality scores by dimension
  const dimScores: Record<string, number[]> = {}
  data.quality_records.forEach((q: COPAXQualityRecord) => {
    if (!dimScores[q.quality_dimension]) dimScores[q.quality_dimension] = []
    dimScores[q.quality_dimension].push(q.score)
  })
  const qualityData = Object.entries(dimScores).map(([dim, scores]) => ({
    dimension: dim,
    avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
  }))

  // Co-benefit distribution
  const cobenefitMap: Record<string, Record<string, number>> = {}
  data.co_benefits.forEach(c => {
    if (!cobenefitMap[c.cobenefit_type]) cobenefitMap[c.cobenefit_type] = {}
    cobenefitMap[c.cobenefit_type][c.impact_level] = (cobenefitMap[c.cobenefit_type][c.impact_level] ?? 0) + 1
  })
  const cobenefitData = Object.entries(cobenefitMap).map(([type, levels]) => ({
    type,
    Low: levels['Low'] ?? 0,
    Medium: levels['Medium'] ?? 0,
    High: levels['High'] ?? 0,
    Transformative: levels['Transformative'] ?? 0,
  }))

  // Top projects by ACCU issued
  const topProjects: COPAXProjectRecord[] = [...data.projects]
    .sort((a, b) => b.accu_issued - a.accu_issued)
    .slice(0, 10)

  // Pricing table data
  const pricingRows = data.pricing.slice(0, 24)

  const kpiCards = buildKpiCards(data.summary)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Leaf className="w-8 h-8 text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Carbon Offset Project Analytics</h1>
          <p className="text-gray-400 text-sm">ACCU projects, methodologies and offset quality — Australian Carbon Credit Units</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(card => (
          <div key={card.label} className={`rounded-xl bg-gradient-to-br ${card.color} p-5`}>
            <p className="text-xs uppercase tracking-wide text-white/70">{card.label}</p>
            <p className="text-3xl font-bold text-white mt-1">{card.value}</p>
            <p className="text-xs text-white/60 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ACCU Price Trend & Forward Curve */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">ACCU Price Trend & Forward Curve (AUD)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={priceTrendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 11 }} interval={3} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, undefined]}
            />
            <Legend />
            <Line type="monotone" dataKey="spot" stroke="#34d399" strokeWidth={2} dot={false} name="Spot" />
            <Line type="monotone" dataKey="fwd2026" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Fwd 2026" />
            <Line type="monotone" dataKey="fwd2027" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Fwd 2027" />
            <Line type="monotone" dataKey="fwd2028" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Fwd 2028" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ACCU Issuances by Methodology */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">ACCU Issuances by Methodology (000s)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={methIssuancesData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} width={130} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Bar dataKey="value" fill="#34d399" name="ACCU (000s)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quality Scores by Dimension */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Avg Quality Score by Dimension (1–5)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={qualityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="dimension" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[0, 5]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Bar dataKey="avgScore" fill="#60a5fa" name="Avg Score" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Co-benefit distribution */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Co-benefit Distribution by Type and Impact Level</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={cobenefitData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="type" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#d1d5db' }}
            />
            <Legend />
            <Bar dataKey="Low" stackId="a" fill={IMPACT_COLOR['Low']} name="Low" />
            <Bar dataKey="Medium" stackId="a" fill={IMPACT_COLOR['Medium']} name="Medium" />
            <Bar dataKey="High" stackId="a" fill={IMPACT_COLOR['High']} name="High" />
            <Bar dataKey="Transformative" stackId="a" fill={IMPACT_COLOR['Transformative']} name="Transformative" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top projects table */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Top Projects by ACCU Issued</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 pr-3">Project</th>
                  <th className="text-left py-2 pr-3">Methodology</th>
                  <th className="text-right py-2 pr-3">ACCU Issued</th>
                  <th className="text-center py-2 pr-3">Status</th>
                  <th className="text-center py-2 pr-3">Add. Risk</th>
                  <th className="text-center py-2">Perm. Risk</th>
                </tr>
              </thead>
              <tbody>
                {topProjects.map(p => (
                  <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-3 text-white font-medium truncate max-w-[150px]" title={p.project_name}>
                      {p.project_name}
                    </td>
                    <td className="py-2 pr-3 text-gray-300 text-xs">{p.methodology}</td>
                    <td className="py-2 pr-3 text-right text-emerald-400 font-mono">
                      {(p.accu_issued / 1000).toFixed(0)}k
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[p.status] ?? 'bg-gray-600'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${RISK_COLOR[p.additionality_risk] ?? ''}`}>
                        {p.additionality_risk}
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${RISK_COLOR[p.permanence_risk] ?? ''}`}>
                        {p.permanence_risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing table */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Pricing by Methodology & Quality Tier (AUD/ACCU)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 pr-3">Methodology</th>
                  <th className="text-center py-2 pr-3">Tier</th>
                  <th className="text-right py-2 pr-3">Spot (AUD)</th>
                  <th className="text-right py-2 pr-3">Premium %</th>
                  <th className="text-center py-2 pr-3">Liquidity</th>
                  <th className="text-right py-2">Trend %</th>
                </tr>
              </thead>
              <tbody>
                {pricingRows.map(row => (
                  <tr key={row.pricing_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-3 text-gray-300 text-xs">{row.methodology}</td>
                    <td className="py-2 pr-3 text-center">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: TIER_COLOR[row.quality_tier] + '33', color: TIER_COLOR[row.quality_tier] }}
                      >
                        {row.quality_tier}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-emerald-400">
                      ${row.spot_price_aud.toFixed(2)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-gray-300">
                      {row.premium_vs_generic_pct > 0 ? '+' : ''}{row.premium_vs_generic_pct.toFixed(1)}%
                    </td>
                    <td className="py-2 pr-3 text-center text-xs text-gray-400">{row.liquidity}</td>
                    <td
                      className={`py-2 text-right font-mono text-xs ${row.price_trend_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {row.price_trend_pct >= 0 ? '+' : ''}{row.price_trend_pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
