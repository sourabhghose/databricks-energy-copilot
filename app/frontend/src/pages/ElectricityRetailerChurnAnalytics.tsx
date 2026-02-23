import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { UserMinus } from 'lucide-react'
import {
  getElectricityRetailerChurnDashboard,
  ERCADashboard,
} from '../api/client'

// ── Colour palette ──────────────────────────────────────────────────────────
const RETAILER_COLOURS: Record<string, string> = {
  'AGL Energy':       '#f59e0b',
  'Origin Energy':    '#3b82f6',
  'EnergyAustralia':  '#10b981',
  'Simply Energy':    '#8b5cf6',
  'Alinta Energy':    '#ef4444',
  'Red Energy':       '#f97316',
  'Momentum Energy':  '#06b6d4',
}

const SEGMENT_COLOURS: Record<string, string> = {
  'Residential':      '#3b82f6',
  'Small Business':   '#f59e0b',
  'Large Commercial': '#10b981',
}

function npsColour(nps: number): string {
  if (nps >= 40) return '#10b981'
  if (nps >= 10) return '#f59e0b'
  return '#ef4444'
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function ElectricityRetailerChurnAnalytics() {
  const [data, setData] = useState<ERCADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityRetailerChurnDashboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Electricity Retailer Churn Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data'}
      </div>
    )
  }

  const { retailers, churn_trends, switching_reasons, segments, price_sensitivity, summary } = data

  // ── Chart 1: avg churn_rate_pct by retailer (across all regions) ─────────
  const retailerNames = [...new Set(retailers.map(r => r.retailer_name))]
  const chart1Data = retailerNames.map(rname => {
    const rows = retailers.filter(r => r.retailer_name === rname)
    const avgChurn = rows.reduce((s, r) => s + r.churn_rate_pct, 0) / rows.length
    const avgNps   = rows.reduce((s, r) => s + r.nps_score, 0) / rows.length
    return { name: rname.replace(' Energy', ''), churn: +avgChurn.toFixed(1), nps: +avgNps.toFixed(1) }
  })

  // ── Chart 2: net_change_k by quarter for top 5 retailers (2024) ──────────
  const trends2024 = churn_trends.filter(ct => ct.year === 2024)
  // pick top 5 by absolute total net change
  const netByRetailer = retailerNames.map(rn => ({
    rn,
    total: Math.abs(trends2024.filter(ct => ct.retailer_name === rn).reduce((s, ct) => s + ct.net_change_k, 0)),
  }))
  netByRetailer.sort((a, b) => b.total - a.total)
  const top5 = netByRetailer.slice(0, 5).map(x => x.rn)

  const quarters = [1, 2, 3, 4]
  const chart2Data = quarters.map(q => {
    const row: Record<string, unknown> = { quarter: `Q${q}` }
    top5.forEach(rn => {
      const ct = trends2024.find(t => t.retailer_name === rn && t.quarter === q)
      row[rn.replace(' Energy', '')] = ct ? ct.net_change_k : 0
    })
    return row
  })

  // ── Chart 3: avg count_pct by switching reason (across all regions) ──────
  const reasons = [...new Set(switching_reasons.map(sr => sr.reason))]
  const chart3Data = reasons.map(reason => {
    const rows = switching_reasons.filter(sr => sr.reason === reason)
    const avgPct = rows.reduce((s, sr) => s + sr.count_pct, 0) / rows.length
    const avgSaving = rows.reduce((s, sr) => s + sr.avg_saving_aud, 0) / rows.length
    return { reason, pct: +avgPct.toFixed(1), saving: +avgSaving.toFixed(0) }
  })

  // ── Chart 4: churn_rate_pct by segment grouped by retailer ───────────────
  const segmentNames = [...new Set(segments.map(s => s.segment))]
  const chart4Data = retailerNames.map(rname => {
    const row: Record<string, unknown> = { retailer: rname.replace(' Energy', '') }
    segmentNames.forEach(seg => {
      const match = segments.find(s => s.retailer_name === rname && s.segment === seg)
      row[seg] = match ? match.churn_rate_pct : 0
    })
    return row
  })

  // ── Chart 5: price_change_pct vs churn_response_pct (2024) ───────────────
  const chart5Data = price_sensitivity
    .filter(ps => ps.year === 2024)
    .map(ps => ({
      retailer: ps.retailer_name.replace(' Energy', ''),
      x: ps.price_change_pct,
      y: ps.churn_response_pct,
      elasticity: ps.price_elasticity,
    }))

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <UserMinus className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Electricity Retailer Churn Analytics</h1>
          <p className="text-sm text-gray-400">Customer switching behaviour across Australian electricity retailers</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Total Switches FY"
          value={`${summary.total_switches_fy_k.toFixed(1)}k`}
          sub="customers switched in FY2024"
        />
        <KpiCard
          label="Avg Market Churn Rate"
          value={`${summary.avg_market_churn_rate_pct.toFixed(1)}%`}
          sub="annual average across retailers"
        />
        <KpiCard
          label="Top Gaining Retailer"
          value={summary.top_gaining_retailer}
          sub="highest net customer gain (2024)"
        />
        <KpiCard
          label="Avg Saving on Switch"
          value={`$${summary.avg_saving_on_switch_aud.toFixed(0)}`}
          sub="average annual bill saving"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Chart 1 — Avg Churn Rate by Retailer (NPS coloured) */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Average Annual Churn Rate by Retailer (coloured by NPS)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart1Data} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: unknown, _n: unknown, props: { payload?: { nps?: number } }) => [
                  `${v}% churn (NPS: ${props.payload?.nps ?? 'N/A'})`,
                  'Churn Rate',
                ]}
              />
              <Bar dataKey="churn" name="Churn Rate %">
                {chart1Data.map((entry, i) => (
                  <Cell key={i} fill={npsColour(entry.nps)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-1">Green = NPS &ge;40, Amber = NPS 10-40, Red = NPS &lt;10</p>
        </div>

        {/* Chart 2 — Net customer change by quarter (top 5, 2024) */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Quarterly Net Customer Change — Top 5 Retailers (2024, k customers)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chart2Data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="k" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {top5.map(rn => (
                <Line
                  key={rn}
                  type="monotone"
                  dataKey={rn.replace(' Energy', '')}
                  stroke={RETAILER_COLOURS[rn] ?? '#6b7280'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3 — Switching reasons */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Switching Reasons — % of Switchers (averaged across regions)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart3Data} layout="vertical" margin={{ top: 5, right: 60, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="reason" tick={{ fill: '#9ca3af', fontSize: 11 }} width={110} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: unknown, n: unknown, props: { payload?: { saving?: number } }) => [
                  n === 'pct' ? `${v}% of switchers (avg saving $${props.payload?.saving ?? 0}/yr)` : `$${v}`,
                  n === 'pct' ? 'Switchers' : 'Avg Saving',
                ]}
              />
              <Bar dataKey="pct" name="pct" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4 — Churn by segment grouped by retailer */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Churn Rate by Customer Segment and Retailer (%)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart4Data} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="retailer" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {segmentNames.map(seg => (
                <Bar key={seg} dataKey={seg} fill={SEGMENT_COLOURS[seg] ?? '#6b7280'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 5 — Price sensitivity scatter (2024) */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 xl:col-span-2">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Price Change vs Churn Response by Retailer (2024) — Scatter Plot
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                dataKey="x"
                name="Price Change %"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                label={{ value: 'Price Change (%)', position: 'insideBottom', offset: -5, fill: '#9ca3af', fontSize: 12 }}
                unit="%"
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Churn Response %"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                label={{ value: 'Churn Response (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 12 }}
                unit="%"
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: unknown, n: string) => [`${v}%`, n]}
                content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload as typeof chart5Data[0]
                  return (
                    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs">
                      <p className="font-semibold text-white">{d.retailer}</p>
                      <p className="text-gray-300">Price change: {d.x}%</p>
                      <p className="text-gray-300">Churn response: {d.y}%</p>
                      <p className="text-gray-300">Elasticity: {d.elasticity}</p>
                    </div>
                  )
                }}
              />
              <Scatter data={chart5Data} name="Retailers">
                {chart5Data.map((entry, i) => (
                  <Cell key={i} fill={RETAILER_COLOURS[`${entry.retailer} Energy`] ?? RETAILER_COLOURS[entry.retailer] ?? '#6b7280'} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {retailerNames.map(rn => (
              <span key={rn} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: RETAILER_COLOURS[rn] ?? '#6b7280' }} />
                {rn.replace(' Energy', '')}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* Summary dl grid */}
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Market Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wide">Total Switches FY2024</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{summary.total_switches_fy_k.toFixed(1)}k</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wide">Avg Market Churn Rate</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{summary.avg_market_churn_rate_pct.toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wide">Top Gaining Retailer</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{summary.top_gaining_retailer}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wide">Top Losing Retailer</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{summary.top_losing_retailer}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wide">Avg Saving on Switch</dt>
            <dd className="mt-1 text-lg font-semibold text-white">${summary.avg_saving_on_switch_aud.toFixed(0)}/yr</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
