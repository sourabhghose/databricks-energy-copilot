import { useEffect, useState } from 'react'
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Award, TrendingDown, DollarSign, Zap, BarChart2, ShieldCheck } from 'lucide-react'
import {
  getRenewableAuctionDashboard,
  RenewableAuctionDashboard,
  REAAuctionRecord,
  REAProjectRecord,
  READesignRecord,
  REAGovernmentExposureRecord,
  REAPriceHistoryRecord,
} from '../api/client'

// ── Colour palette ────────────────────────────────────────────────────────
const TECH_COLOURS: Record<string, string> = {
  WIND:          '#10b981',
  SOLAR:         '#f59e0b',
  HYBRID:        '#8b5cf6',
  OFFSHORE_WIND: '#06b6d4',
  STORAGE_BACKED:'#f43f5e',
}

const PROGRAM_COLOURS: Record<string, string> = {
  LRETF:                    '#10b981',
  State_Renewables_Auction: '#3b82f6',
  REZ_Access_Rights:        '#f59e0b',
  Community_Energy_Program: '#8b5cf6',
  ARENA_Grant:              '#f43f5e',
}

const STATUS_STYLES: Record<string, string> = {
  CONTRACTED:  'bg-blue-900 text-blue-200',
  CONSTRUCTION:'bg-yellow-900 text-yellow-200',
  OPERATING:   'bg-green-900 text-green-200',
  CANCELLED:   'bg-red-900 text-red-200',
}

const SCENARIO_STYLES: Record<string, string> = {
  CURRENT: 'bg-gray-700 text-gray-200',
  LOW:     'bg-red-900 text-red-200',
  HIGH:    'bg-green-900 text-green-200',
}

// ── KPI Card ──────────────────────────────────────────────────────────────
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

// ── Section heading ────────────────────────────────────────────────────────
function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="text-base font-semibold text-gray-200 mb-3 mt-6 border-b border-gray-700 pb-1">
      {title}
    </h2>
  )
}

// ── Colour dot ────────────────────────────────────────────────────────────
function Dot({ colour }: { colour: string }) {
  return <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: colour }} />
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function RenewableAuctionAnalytics() {
  const [data, setData] = useState<RenewableAuctionDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [techFilter, setTechFilter] = useState<string>('ALL')
  const [programFilter, setProgramFilter] = useState<string>('ALL')
  const [scenarioFilter, setScenarioFilter] = useState<'CURRENT' | 'LOW' | 'HIGH'>('CURRENT')

  useEffect(() => {
    getRenewableAuctionDashboard()
      .then(setData)
      .catch(e => setError(String(e)))
  }, [])

  if (error) return (
    <div className="p-8 text-red-400">Failed to load Renewable Auction dashboard: {error}</div>
  )
  if (!data) return (
    <div className="p-8 text-gray-400 animate-pulse">Loading Renewable Auction Design & CfD Analytics…</div>
  )

  const { auctions, projects, design_elements, price_history, govt_exposure, summary } = data

  // ── Auction Results filtered
  const filteredAuctions: REAAuctionRecord[] = auctions.filter(a =>
    programFilter === 'ALL' || a.program === programFilter
  )

  // ── Project Register filtered
  const filteredProjects: REAProjectRecord[] = projects.filter(p =>
    techFilter === 'ALL' || p.technology === techFilter
  )

  // ── Price History chart data — pivot by year
  const phPrograms = Array.from(new Set(price_history.map(r => r.program)))
  const phYears = Array.from(new Set(price_history.map(r => r.year))).sort()
  const priceChartData = phYears.map(yr => {
    const row: Record<string, number | string> = { year: yr }
    phPrograms.forEach(prog => {
      const match = price_history.find(r => r.year === yr && r.program === prog)
      if (match) row[prog] = match.avg_strike_price
    })
    return row
  })

  // ── Govt Exposure filtered by scenario
  const exposureByScenario: REAGovernmentExposureRecord[] = govt_exposure.filter(
    g => g.market_price_scenario === scenarioFilter
  )

  // ── Filter options
  const programs = Array.from(new Set(auctions.map(a => a.program)))
  const technologies = Array.from(new Set(projects.map(p => p.technology)))

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Award className="text-emerald-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Renewable Energy Auction Design & CfD Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Contracts for Difference auctions, government renewable tenders, auction design effectiveness — Australia 2017–2024
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <KpiCard
          icon={<Zap size={14} />}
          label="Total Auctioned"
          value={`${(summary.total_auctioned_mw / 1000).toFixed(1)} GW`}
          sub="across all programs"
          colour="border-emerald-500"
        />
        <KpiCard
          icon={<DollarSign size={14} />}
          label="Avg Strike 2024"
          value={`$${summary.avg_strike_price_2024}`}
          sub="$/MWh weighted avg"
          colour="border-blue-500"
        />
        <KpiCard
          icon={<TrendingDown size={14} />}
          label="YoY Price Decline"
          value={`${summary.yoy_price_decline_pct}%`}
          sub="CfD strike prices falling"
          colour="border-green-500"
        />
        <KpiCard
          icon={<Award size={14} />}
          label="Projects Contracted"
          value={`${summary.total_contracted_projects}`}
          sub="CfD / tender backed"
          colour="border-purple-500"
        />
        <KpiCard
          icon={<BarChart2 size={14} />}
          label="Avg Oversubscription"
          value={`${summary.oversubscription_avg}×`}
          sub="demand vs capacity offered"
          colour="border-yellow-500"
        />
        <KpiCard
          icon={<ShieldCheck size={14} />}
          label="Govt CfD Liability"
          value={`$${(summary.govt_cfd_liability_total_m / 1000).toFixed(1)}B`}
          sub="max cumulative exposure"
          colour="border-red-500"
        />
      </div>

      {/* ── 1. Auction Results ─────────────────────────────────────────────── */}
      <SectionHeading title="Auction Results — Oversubscription & Strike Prices" />

      {/* Program filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => setProgramFilter('ALL')}
          className={`px-3 py-1 rounded text-xs font-medium transition ${programFilter === 'ALL' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          All Programs
        </button>
        {programs.map(p => (
          <button
            key={p}
            onClick={() => setProgramFilter(p)}
            className={`px-3 py-1 rounded text-xs font-medium transition ${programFilter === p ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            {p.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="min-w-full text-xs text-gray-300">
          <thead className="bg-gray-800 text-gray-400 uppercase text-[10px] tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Auction ID</th>
              <th className="px-3 py-2 text-left">Program</th>
              <th className="px-3 py-2 text-left">Jurisdiction</th>
              <th className="px-3 py-2 text-right">Year</th>
              <th className="px-3 py-2 text-right">Round</th>
              <th className="px-3 py-2 text-right">Capacity (MW)</th>
              <th className="px-3 py-2 text-right">Projects</th>
              <th className="px-3 py-2 text-right">Oversubscription</th>
              <th className="px-3 py-2 text-right">Avg Strike ($/MWh)</th>
              <th className="px-3 py-2 text-right">Min Strike</th>
              <th className="px-3 py-2 text-right">Max Strike</th>
              <th className="px-3 py-2 text-right">Duration (yrs)</th>
              <th className="px-3 py-2 text-right">Govt Risk ($M)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredAuctions.map(a => (
              <tr key={a.auction_id} className="hover:bg-gray-750 bg-gray-800/50 hover:bg-gray-700/60">
                <td className="px-3 py-2 font-mono text-[10px] text-gray-400">{a.auction_id}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1">
                    <Dot colour={PROGRAM_COLOURS[a.program] ?? '#6b7280'} />
                    {a.program.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-3 py-2 font-semibold">{a.jurisdiction}</td>
                <td className="px-3 py-2 text-right">{a.year}</td>
                <td className="px-3 py-2 text-right">{a.round}</td>
                <td className="px-3 py-2 text-right font-medium">{a.capacity_contracted_mw.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{a.number_of_projects}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.oversubscription_ratio >= 4 ? 'bg-emerald-900 text-emerald-300' : a.oversubscription_ratio >= 2.5 ? 'bg-blue-900 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>
                    {a.oversubscription_ratio.toFixed(1)}×
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-bold text-emerald-400">${a.avg_strike_price.toFixed(1)}</td>
                <td className="px-3 py-2 text-right text-green-400">${a.min_strike_price.toFixed(1)}</td>
                <td className="px-3 py-2 text-right text-yellow-400">${a.max_strike_price.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{a.contract_duration_years}</td>
                <td className="px-3 py-2 text-right text-red-400">${a.govt_revenue_risk_m.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 2. Project Register ────────────────────────────────────────────── */}
      <SectionHeading title="Project Register — CfD & Tender-Backed Projects" />

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => setTechFilter('ALL')}
          className={`px-3 py-1 rounded text-xs font-medium transition ${techFilter === 'ALL' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          All Technologies
        </button>
        {technologies.map(t => (
          <button
            key={t}
            onClick={() => setTechFilter(t)}
            className={`px-3 py-1 rounded text-xs font-medium transition ${techFilter === t ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            <Dot colour={TECH_COLOURS[t] ?? '#6b7280'} />
            {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="min-w-full text-xs text-gray-300">
          <thead className="bg-gray-800 text-gray-400 uppercase text-[10px] tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-left">Developer</th>
              <th className="px-3 py-2 text-left">Technology</th>
              <th className="px-3 py-2 text-left">State</th>
              <th className="px-3 py-2 text-right">Capacity (MW)</th>
              <th className="px-3 py-2 text-right">Strike ($/MWh)</th>
              <th className="px-3 py-2 text-left">Reference Price</th>
              <th className="px-3 py-2 text-right">Duration (yrs)</th>
              <th className="px-3 py-2 text-right">Fin Close</th>
              <th className="px-3 py-2 text-right">COD Year</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Jobs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredProjects.map(p => (
              <tr key={p.project_id} className="bg-gray-800/50 hover:bg-gray-700/60">
                <td className="px-3 py-2 font-medium text-white">{p.name}</td>
                <td className="px-3 py-2 text-gray-400">{p.developer}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1">
                    <Dot colour={TECH_COLOURS[p.technology] ?? '#6b7280'} />
                    {p.technology.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-3 py-2 font-semibold">{p.state}</td>
                <td className="px-3 py-2 text-right font-medium">{p.capacity_mw.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-bold text-emerald-400">${p.strike_price.toFixed(1)}</td>
                <td className="px-3 py-2 text-gray-400">{p.reference_price}</td>
                <td className="px-3 py-2 text-right">{p.contract_duration_years}</td>
                <td className="px-3 py-2 text-right text-gray-400">{p.financial_close_date ?? '—'}</td>
                <td className="px-3 py-2 text-right">{p.commissioning_year}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLES[p.status] ?? 'bg-gray-700 text-gray-300'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{p.jobs_created.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 3. Auction Design Elements ────────────────────────────────────── */}
      <SectionHeading title="Auction Design Elements — Pros, Cons & Effectiveness" />

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="min-w-full text-xs text-gray-300">
          <thead className="bg-gray-800 text-gray-400 uppercase text-[10px] tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Design Element</th>
              <th className="px-3 py-2 text-left">Program</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Pros</th>
              <th className="px-3 py-2 text-left">Cons</th>
              <th className="px-3 py-2 text-right">Global Adoption %</th>
              <th className="px-3 py-2 text-right">Effectiveness</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {design_elements.map((d: READesignRecord) => (
              <tr key={d.design_element} className="bg-gray-800/50 hover:bg-gray-700/60">
                <td className="px-3 py-2 font-mono font-semibold text-purple-300 text-[10px]">{d.design_element.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded text-[10px]" style={{ background: PROGRAM_COLOURS[d.program] ? `${PROGRAM_COLOURS[d.program]}33` : '#374151', color: PROGRAM_COLOURS[d.program] ?? '#9ca3af' }}>
                    {d.program.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-3 py-2 max-w-xs text-gray-400 leading-tight">{d.description}</td>
                <td className="px-3 py-2 max-w-xs text-green-400 leading-tight">{d.pros}</td>
                <td className="px-3 py-2 max-w-xs text-red-400 leading-tight">{d.cons}</td>
                <td className="px-3 py-2 text-right">{d.adoption_rate_pct.toFixed(0)}%</td>
                <td className="px-3 py-2 text-right">
                  <span className={`font-bold ${d.effectiveness_score >= 8 ? 'text-emerald-400' : d.effectiveness_score >= 7 ? 'text-yellow-400' : 'text-gray-300'}`}>
                    {d.effectiveness_score.toFixed(1)}/10
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 4. Price History Chart ─────────────────────────────────────────── */}
      <SectionHeading title="CfD Strike Price History by Program — 2019 to 2024" />

      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-4">
        <p className="text-xs text-gray-400 mb-4">Weighted average strike price ($/MWh) across all technologies per program. Declining prices reflect technology cost reductions and increased competition.</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={priceChartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={v => `$${v}`}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
              formatter={(v: number, name: string) => [`$${v.toFixed(1)}/MWh`, name.replace(/_/g, ' ')]}
            />
            <Legend
              formatter={name => name.replace(/_/g, ' ')}
              wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
            />
            {phPrograms.map(prog => (
              <Line
                key={prog}
                type="monotone"
                dataKey={prog}
                stroke={PROGRAM_COLOURS[prog] ?? '#6b7280'}
                strokeWidth={2}
                dot={{ r: 3, fill: PROGRAM_COLOURS[prog] ?? '#6b7280' }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Price History detail table */}
      <details className="mb-2">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-200 select-none">
          Show price history detail table ({price_history.length} records)
        </summary>
        <div className="overflow-x-auto rounded-lg border border-gray-700 mt-2">
          <table className="min-w-full text-xs text-gray-300">
            <thead className="bg-gray-800 text-gray-400 uppercase text-[10px] tracking-wide">
              <tr>
                <th className="px-3 py-2 text-right">Year</th>
                <th className="px-3 py-2 text-left">Program</th>
                <th className="px-3 py-2 text-left">Technology</th>
                <th className="px-3 py-2 text-right">Avg $/MWh</th>
                <th className="px-3 py-2 text-right">Min</th>
                <th className="px-3 py-2 text-right">P25</th>
                <th className="px-3 py-2 text-right">P75</th>
                <th className="px-3 py-2 text-right">Max</th>
                <th className="px-3 py-2 text-right">Contracts</th>
                <th className="px-3 py-2 text-right">Total MW</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {price_history.map((r: REAPriceHistoryRecord, i: number) => (
                <tr key={i} className="bg-gray-800/50 hover:bg-gray-700/60">
                  <td className="px-3 py-2 text-right">{r.year}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1">
                      <Dot colour={PROGRAM_COLOURS[r.program] ?? '#6b7280'} />
                      {r.program.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1">
                      <Dot colour={TECH_COLOURS[r.technology] ?? '#6b7280'} />
                      {r.technology}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-400">${r.avg_strike_price.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-green-400">${r.min_strike_price.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">${r.p25_strike_price.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">${r.p75_strike_price.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-yellow-400">${r.max_strike_price.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">{r.number_of_contracts}</td>
                  <td className="px-3 py-2 text-right">{r.total_mw.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* ── 5. Government CfD Exposure ────────────────────────────────────── */}
      <SectionHeading title="Government CfD Exposure by Jurisdiction & Price Scenario" />

      <div className="flex gap-3 mb-3">
        {(['CURRENT', 'LOW', 'HIGH'] as const).map(sc => (
          <button
            key={sc}
            onClick={() => setScenarioFilter(sc)}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition ${scenarioFilter === sc ? (sc === 'HIGH' ? 'bg-green-600 text-white' : sc === 'LOW' ? 'bg-red-600 text-white' : 'bg-gray-600 text-white') : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
          >
            {sc} Market Prices
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700 mb-6">
        <table className="min-w-full text-xs text-gray-300">
          <thead className="bg-gray-800 text-gray-400 uppercase text-[10px] tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Jurisdiction</th>
              <th className="px-3 py-2 text-right">Year</th>
              <th className="px-3 py-2 text-right">Contracted MW</th>
              <th className="px-3 py-2 text-right">Max CfD Liability ($M)</th>
              <th className="px-3 py-2 text-right">Avg Remaining (yrs)</th>
              <th className="px-3 py-2 text-left">Scenario</th>
              <th className="px-3 py-2 text-right">Net Govt Position ($M)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {exposureByScenario.map((g: REAGovernmentExposureRecord, i: number) => (
              <tr key={i} className="bg-gray-800/50 hover:bg-gray-700/60">
                <td className="px-3 py-2 font-bold text-white">{g.jurisdiction}</td>
                <td className="px-3 py-2 text-right">{g.year}</td>
                <td className="px-3 py-2 text-right">{g.total_contracted_mw.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-medium text-red-400">${g.total_cfd_liability_m.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{g.avg_remaining_contract_years.toFixed(1)}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${SCENARIO_STYLES[g.market_price_scenario]}`}>
                    {g.market_price_scenario}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`font-bold ${g.net_govt_position_m > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {g.net_govt_position_m > 0 ? '+' : ''}${g.net_govt_position_m.toFixed(1)}M
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 text-[10px] text-gray-500">
          Positive net position = market prices above strike price; government receives difference payments from developer.
          Negative = government pays subsidy. Liability represents maximum cumulative exposure under contract term.
        </p>
      </div>
    </div>
  )
}
