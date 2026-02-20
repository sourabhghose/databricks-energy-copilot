import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { Wind, Award } from 'lucide-react'
import { getRenewableAuctionDashboard, RenewableAuctionDashboard } from '../api/client'

// ── Colour palette ────────────────────────────────────────────────────────
const TECH_COLOURS: Record<string, string> = {
  WIND_ONSHORE:  '#10b981',
  WIND_OFFSHORE: '#06b6d4',
  UTILITY_SOLAR: '#f59e0b',
  HYBRID:        '#8b5cf6',
  STORAGE:       '#f43f5e',
}

const TECH_LABELS: Record<string, string> = {
  WIND_ONSHORE:  'Wind Onshore',
  WIND_OFFSHORE: 'Wind Offshore',
  UTILITY_SOLAR: 'Utility Solar',
  HYBRID:        'Hybrid',
  STORAGE:       'Storage',
}

const STATUS_STYLES: Record<string, string> = {
  CONTRACTED:         'bg-blue-900 text-blue-200',
  UNDER_CONSTRUCTION: 'bg-yellow-900 text-yellow-200',
  COMMISSIONED:       'bg-green-900 text-green-200',
  TERMINATED:         'bg-red-900 text-red-200',
}

// ── KPI Card ─────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, colour }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; colour: string
}) {
  return (
    <div className={`bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border-l-4 ${colour}`}>
      <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────
function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="text-base font-semibold text-gray-200 mb-3 mt-6 border-b border-gray-700 pb-1">
      {title}
    </h2>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function RenewableAuctionAnalytics() {
  const [data, setData] = useState<RenewableAuctionDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRenewableAuctionDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">Loading Renewable Auction Analytics…</p>
    </div>
  )
  if (error || !data) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-red-400">Error: {error ?? 'No data'}</p>
    </div>
  )

  const { auction_results, technology_trends, performance, state_comparison } = data

  // ── KPI calculations ───────────────────────────────────────────────────
  const totalContractedMw = auction_results.reduce((s: number, r: any) => s + r.capacity_mw, 0)
  const avgStrikePrice = auction_results.reduce((s: number, r: any) => s + r.strike_price_aud_mwh, 0) / auction_results.length
  const lowestStrike = Math.min(...auction_results.map((r: any) => r.strike_price_aud_mwh))
  const lowestRecord = auction_results.find((r: any) => r.strike_price_aud_mwh === lowestStrike)
  const totalCfdPayments = performance.reduce((s: number, r: any) => s + r.cfd_payment_m_aud, 0)

  // ── Strike price trend data ─────────────────────────────────────────────
  const trendYears = [...new Set(technology_trends.map((r: any) => r.year))].sort()
  const trendTechs = [...new Set(technology_trends.map((r: any) => r.technology))]

  const strikeTrendData = trendYears.map((yr: number) => {
    const entry: Record<string, any> = { year: yr }
    trendTechs.forEach((tech: string) => {
      const rec = technology_trends.find((r: any) => r.technology === tech && r.year === yr)
      if (rec) entry[tech] = rec.avg_strike_price_aud_mwh
    })
    return entry
  })

  // ── Oversubscription bar chart data ────────────────────────────────────
  // Use latest year per technology
  const oversubData = trendTechs.map((tech: string) => {
    const latestRec = technology_trends
      .filter((r: any) => r.technology === tech)
      .sort((a: any, b: any) => b.year - a.year)[0]
    return {
      technology: TECH_LABELS[tech] ?? tech,
      tech_key: tech,
      total_contracted_mw: latestRec?.total_contracted_mw ?? 0,
      demand_mw: latestRec ? latestRec.total_contracted_mw * latestRec.oversubscription_ratio : 0,
      oversubscription_ratio: latestRec?.oversubscription_ratio ?? 1,
    }
  })

  // ── Performance scatter data ───────────────────────────────────────────
  const scatterData = performance.map((r: any) => ({
    x: r.bid_capacity_factor_pct,
    y: r.actual_capacity_factor_pct,
    z: r.contracted_capacity_mw,
    name: r.project_name,
    technology: r.technology,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 px-6 py-6 space-y-2">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-emerald-900 rounded-lg">
          <Wind className="text-emerald-400" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Renewable Energy Auction Results & CfD Analytics</h1>
          <p className="text-xs text-gray-400">State-based auction schemes · CfD strike prices · Technology competitiveness · Performance tracking</p>
        </div>
        <span className="ml-auto text-xs text-gray-500">
          Updated: {new Date(data.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
        </span>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Award size={14} />}
          label="Total Contracted Capacity"
          value={`${(totalContractedMw / 1000).toFixed(1)} GW`}
          sub={`${auction_results.length} contracts across all states`}
          colour="border-emerald-500"
        />
        <KpiCard
          icon={<Wind size={14} />}
          label="Avg CfD Strike Price"
          value={`$${avgStrikePrice.toFixed(1)}/MWh`}
          sub="Capacity-weighted across all auctions"
          colour="border-amber-500"
        />
        <KpiCard
          icon={<Award size={14} />}
          label="Lowest-Ever Strike Price"
          value={`$${lowestStrike.toFixed(1)}/MWh`}
          sub={lowestRecord ? `${lowestRecord.auction_name} — ${lowestRecord.state}` : ''}
          colour="border-blue-500"
        />
        <KpiCard
          icon={<Wind size={14} />}
          label="Total CfD Payments"
          value={`$${totalCfdPayments.toFixed(1)}M AUD`}
          sub="Across tracked commissioned/operating projects"
          colour="border-purple-500"
        />
      </div>

      {/* ── Auction Results Table ── */}
      <SectionHeading title="Auction Contract Results" />
      <div className="overflow-x-auto rounded-xl bg-gray-800">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
              <th className="px-4 py-3 text-left">Auction Name</th>
              <th className="px-4 py-3 text-left">State</th>
              <th className="px-4 py-3 text-left">Technology</th>
              <th className="px-4 py-3 text-right">Capacity (MW)</th>
              <th className="px-4 py-3 text-right">Strike (AUD/MWh)</th>
              <th className="px-4 py-3 text-right">Ref Price (AUD/MWh)</th>
              <th className="px-4 py-3 text-right">COD Year</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {auction_results.map((r: any) => (
              <tr key={r.auction_id} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                <td className="px-4 py-2 text-gray-200 font-medium">{r.auction_name}</td>
                <td className="px-4 py-2 text-gray-300">{r.state}</td>
                <td className="px-4 py-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: TECH_COLOURS[r.technology] + '33', color: TECH_COLOURS[r.technology] }}
                  >
                    {TECH_LABELS[r.technology] ?? r.technology}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-gray-200">{r.capacity_mw.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-medium text-amber-300">${r.strike_price_aud_mwh.toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-gray-400">${r.reference_price_aud_mwh.toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-gray-300">{r.cod_year}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] ?? 'bg-gray-700 text-gray-300'}`}>
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Charts Row: Strike Trend + Oversubscription ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Strike Price Trend */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">CfD Strike Price Trend by Technology (2018–2022)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={strikeTrendData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                tickFormatter={(v) => `$${v}`}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                domain={[30, 160]}
                label={{ value: 'AUD/MWh', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10, dy: 40 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: any, name: string) => [`$${v}/MWh`, TECH_LABELS[name] ?? name]}
              />
              <Legend formatter={(name) => TECH_LABELS[name] ?? name} wrapperStyle={{ fontSize: 11 }} />
              {trendTechs.map((tech: string) => (
                <Line
                  key={tech}
                  type="monotone"
                  dataKey={tech}
                  stroke={TECH_COLOURS[tech]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: TECH_COLOURS[tech] }}
                  activeDot={{ r: 5 }}
                />
              ))}
              <ReferenceLine y={60} stroke="#6b7280" strokeDasharray="4 4" label={{ value: '$60 threshold', fill: '#6b7280', fontSize: 9 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Technology Oversubscription */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Technology Oversubscription (Demand vs Supply, Latest Auction Round)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={oversubData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="technology" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(1)}GW`} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: any, name: string) => [
                  `${(+v).toLocaleString()} MW`,
                  name === 'total_contracted_mw' ? 'Contracted (Supply)' : 'Bid Volume (Demand)',
                ]}
              />
              <Legend
                formatter={(name) => name === 'total_contracted_mw' ? 'Contracted (Supply)' : 'Bid Volume (Demand)'}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="demand_mw" fill="#475569" radius={[4, 4, 0, 0]}>
                {oversubData.map((entry: any) => (
                  <Cell key={entry.tech_key} fill={TECH_COLOURS[entry.tech_key] + '55'} />
                ))}
              </Bar>
              <Bar dataKey="total_contracted_mw" fill="#10b981" radius={[4, 4, 0, 0]}>
                {oversubData.map((entry: any) => (
                  <Cell key={entry.tech_key} fill={TECH_COLOURS[entry.tech_key]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── State Comparison Table ── */}
      <SectionHeading title="State Renewable Policy Target Comparison" />
      <div className="overflow-x-auto rounded-xl bg-gray-800">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
              <th className="px-4 py-3 text-left">State</th>
              <th className="px-4 py-3 text-right">Contracted (MW)</th>
              <th className="px-4 py-3 text-right">Avg Strike (AUD/MWh)</th>
              <th className="px-4 py-3 text-left">Cheapest Technology</th>
              <th className="px-4 py-3 text-right">Pipeline (MW)</th>
              <th className="px-4 py-3 text-right">Policy Target (MW)</th>
              <th className="px-4 py-3 text-right">Completion %</th>
            </tr>
          </thead>
          <tbody>
            {state_comparison.map((r: any) => (
              <tr key={r.state} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                <td className="px-4 py-2 font-bold text-white">{r.state}</td>
                <td className="px-4 py-2 text-right text-emerald-300">{r.total_contracted_mw.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-amber-300">${r.avg_strike_price_aud_mwh.toFixed(2)}</td>
                <td className="px-4 py-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: TECH_COLOURS[r.cheapest_technology] + '33', color: TECH_COLOURS[r.cheapest_technology] }}
                  >
                    {TECH_LABELS[r.cheapest_technology] ?? r.cheapest_technology}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-blue-300">{r.auction_pipeline_mw.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-gray-300">{r.policy_target_mw.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-20 bg-gray-700 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(r.completion_pct, 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${r.completion_pct >= 30 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {r.completion_pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Performance Scatter ── */}
      <SectionHeading title="Project Performance: Actual vs Bid Capacity Factor" />
      <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 mb-3">Bubble size proportional to contracted capacity (MW). Points above the diagonal line are outperforming their bid.</p>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 12, right: 20, left: 0, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[24, 50]}
              name="Bid CF (%)"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Bid Capacity Factor (%)', position: 'insideBottom', offset: -4, fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={[20, 50]}
              name="Actual CF (%)"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Actual CF (%)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11, dy: 50 }}
            />
            <ZAxis dataKey="z" range={[60, 800]} name="Contracted MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(v: any, name: string) => [
                name === 'Contracted MW' ? `${v} MW` : `${v}%`,
                name,
              ]}
              content={({ payload }) => {
                if (!payload?.length) return null
                const p = payload[0]?.payload
                if (!p) return null
                return (
                  <div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-200">
                    <p className="font-semibold mb-1">{p.name}</p>
                    <p>Technology: {TECH_LABELS[p.technology] ?? p.technology}</p>
                    <p>Bid CF: {p.x}% | Actual CF: {p.y}%</p>
                    <p>Contracted: {p.z} MW</p>
                    <p className={p.y >= p.x ? 'text-emerald-400' : 'text-red-400'}>
                      {p.y >= p.x ? `Outperforming by ${(p.y - p.x).toFixed(1)}pp` : `Underperforming by ${(p.x - p.y).toFixed(1)}pp`}
                    </p>
                  </div>
                )
              }}
            />
            <ReferenceLine
              segment={[{ x: 24, y: 24 }, { x: 50, y: 50 }]}
              stroke="#6b7280"
              strokeDasharray="5 5"
              label={{ value: 'Bid = Actual', position: 'insideTopLeft', fill: '#6b7280', fontSize: 10 }}
            />
            {[...new Set(scatterData.map((d: any) => d.technology))].map((tech: string) => (
              <Scatter
                key={tech}
                name={TECH_LABELS[tech] ?? tech}
                data={scatterData.filter((d: any) => d.technology === tech)}
                fill={TECH_COLOURS[tech]}
                fillOpacity={0.75}
              />
            ))}
            <Legend formatter={(name) => name} wrapperStyle={{ fontSize: 11 }} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
