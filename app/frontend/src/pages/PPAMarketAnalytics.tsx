import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import {
  getPPAMarketDashboard,
  PPADashboard,
  PPADealRecord,
  PPAPriceIndexRecord,
  PPABuyerRecord,
  PPARiskRecord,
  PPAPipelineRecord,
} from '../api/client'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  sub,
  color = 'text-emerald-400',
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Technology Badge ───────────────────────────────────────────────────────────

function TechBadge({ tech }: { tech: string }) {
  const map: Record<string, string> = {
    WIND: 'bg-blue-900 text-blue-300',
    SOLAR: 'bg-yellow-900 text-yellow-300',
    HYBRID: 'bg-teal-900 text-teal-300',
    STORAGE_BACKED: 'bg-purple-900 text-purple-300',
    HYDRO: 'bg-cyan-900 text-cyan-300',
  }
  const cls = map[tech] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {tech.replace(/_/g, ' ')}
    </span>
  )
}

// ── Deal Type Badge ────────────────────────────────────────────────────────────

function DealTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    CORPORATE: 'bg-emerald-900 text-emerald-300',
    UTILITY: 'bg-orange-900 text-orange-300',
    GOVERNMENT: 'bg-indigo-900 text-indigo-300',
    AGGREGATED: 'bg-pink-900 text-pink-300',
  }
  const cls = map[type] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {type}
    </span>
  )
}

// ── Structure Badge ────────────────────────────────────────────────────────────

function StructureBadge({ structure }: { structure: string }) {
  const map: Record<string, string> = {
    FIXED_PRICE: 'bg-green-900 text-green-300',
    INDEXED: 'bg-sky-900 text-sky-300',
    FLOOR_CEILING: 'bg-amber-900 text-amber-300',
    PAY_AS_PRODUCED: 'bg-rose-900 text-rose-300',
  }
  const cls = map[structure] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {structure.replace(/_/g, ' ')}
    </span>
  )
}

// ── Impact Badge ───────────────────────────────────────────────────────────────

function ImpactBadge({ level }: { level: string }) {
  const cls =
    level === 'HIGH'
      ? 'bg-red-900 text-red-300'
      : level === 'MEDIUM'
      ? 'bg-amber-900 text-amber-300'
      : 'bg-green-900 text-green-300'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{level}</span>
  )
}

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PPAMarketAnalytics() {
  const [data, setData] = useState<PPADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string>('NSW')
  const [selectedTech, setSelectedTech] = useState<string>('WIND')

  useEffect(() => {
    getPPAMarketDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading PPA market analytics...
      </div>
    )
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )

  const summary = data.summary as Record<string, number>

  // ── Price Index chart: filter by region + tech, sorted by quarter ────────────
  const priceChartData = data.price_index
    .filter(
      (r: PPAPriceIndexRecord) => r.region === selectedRegion && r.technology === selectedTech
    )
    .sort((a, b) => a.quarter.localeCompare(b.quarter))
    .map((r: PPAPriceIndexRecord) => ({
      quarter: r.quarter,
      'Avg Price': r.avg_ppa_price,
      'Median Price': r.median_ppa_price,
      'Min Price': r.min_ppa_price,
      'Max Price': r.max_ppa_price,
    }))

  // ── Buyer sector chart ────────────────────────────────────────────────────────
  const buyerChartData = data.buyers.map((b: PPABuyerRecord) => ({
    sector: b.buyer_sector.replace(/_/g, ' '),
    'Deal Count': b.deal_count,
    'Total MW (÷10)': Math.round(b.total_mw / 10),
    'Avg Price $/MWh': b.avg_ppa_price,
  }))

  // ── Pipeline chart: aggregate by year ────────────────────────────────────────
  const pipelineYearMap: Record<number, { year: number; Signed: number; 'Under Negotiation': number }> = {}
  for (const p of data.pipeline as PPAPipelineRecord[]) {
    if (!pipelineYearMap[p.year]) {
      pipelineYearMap[p.year] = { year: p.year, Signed: 0, 'Under Negotiation': 0 }
    }
    pipelineYearMap[p.year].Signed += p.signed_mw
    pipelineYearMap[p.year]['Under Negotiation'] += p.under_negotiation_mw
  }
  const pipelineChartData = Object.values(pipelineYearMap)
    .sort((a, b) => a.year - b.year)
    .map(d => ({
      year: String(d.year),
      Signed: Math.round(d.Signed),
      'Under Negotiation': Math.round(d['Under Negotiation']),
    }))

  const regions = [...new Set(data.price_index.map((r: PPAPriceIndexRecord) => r.region))].sort()
  const techs = [...new Set(data.price_index.map((r: PPAPriceIndexRecord) => r.technology))].sort()

  return (
    <div className="p-6 space-y-10 text-gray-100 bg-gray-900 min-h-screen">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <FileText className="w-7 h-7 text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">PPA Market Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Corporate &amp; utility power purchase agreement deal flow, pricing indices, buyer
            mix, risk register, and pipeline outlook — Australian market 2020–2026
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Total Deals 2024"
          value={summary.total_deals_2024}
          sub="Signed transactions"
          color="text-emerald-400"
        />
        <KpiCard
          label="Total MW Signed"
          value={summary.total_mw_signed.toLocaleString()}
          unit="MW"
          sub="All recorded deals"
          color="text-sky-400"
        />
        <KpiCard
          label="Avg PPA Price 2024"
          value={`$${summary.avg_ppa_price_2024}`}
          unit="/MWh"
          sub={`Avg tenor ${summary.avg_duration_years} years`}
          color="text-amber-400"
        />
        <KpiCard
          label="Pipeline 2025"
          value={summary.pipeline_2025_mw.toLocaleString()}
          unit="MW"
          sub="Under negotiation + signed"
          color="text-purple-400"
        />
        <KpiCard
          label="Corporate Share"
          value={`${summary.corporate_share_pct}%`}
          sub="of 2024 deal volume"
          color="text-teal-400"
        />
        <KpiCard
          label="Wind Share"
          value={`${summary.wind_share_pct}%`}
          sub="of signed MW"
          color="text-blue-400"
        />
        <KpiCard
          label="Solar Share"
          value={`${summary.solar_share_pct}%`}
          sub="of signed MW"
          color="text-yellow-400"
        />
        <KpiCard
          label="Avg Duration"
          value={summary.avg_duration_years}
          unit="years"
          sub="Weighted by capacity"
          color="text-rose-400"
        />
      </div>

      {/* Deal Register Table */}
      <section>
        <SectionHeader
          title="Deal Register"
          subtitle="Australian PPA deal activity 2020–2024 — pricing, structure, and technology mix"
        />
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Deal ID</th>
                <th className="px-4 py-3 text-left">Buyer</th>
                <th className="px-4 py-3 text-left">Seller</th>
                <th className="px-4 py-3 text-left">Technology</th>
                <th className="px-4 py-3 text-left">Region</th>
                <th className="px-4 py-3 text-right">MW</th>
                <th className="px-4 py-3 text-right">GWh/yr</th>
                <th className="px-4 py-3 text-right">$/MWh</th>
                <th className="px-4 py-3 text-right">Years</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Structure</th>
                <th className="px-4 py-3 text-center">LGC</th>
                <th className="px-4 py-3 text-right">Signed</th>
              </tr>
            </thead>
            <tbody>
              {data.deals.map((d: PPADealRecord, idx: number) => (
                <tr
                  key={d.deal_id}
                  className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-300">{d.deal_id}</td>
                  <td className="px-4 py-2.5 text-white font-medium">{d.buyer}</td>
                  <td className="px-4 py-2.5 text-gray-300">{d.seller}</td>
                  <td className="px-4 py-2.5">
                    <TechBadge tech={d.technology} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-300">{d.region}</td>
                  <td className="px-4 py-2.5 text-right text-gray-200">
                    {d.capacity_mw.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-200">
                    {d.annual_energy_gwh.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">
                    ${d.ppa_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-200">
                    {d.contract_duration_years}
                  </td>
                  <td className="px-4 py-2.5">
                    <DealTypeBadge type={d.deal_type} />
                  </td>
                  <td className="px-4 py-2.5">
                    <StructureBadge structure={d.structure} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {d.green_certificate ? (
                      <span className="text-emerald-400 font-bold">Yes</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300">{d.signed_year}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* PPA Price Index — Line Chart */}
      <section>
        <SectionHeader
          title="PPA Price Index"
          subtitle="Average, median, min and max PPA price ($/MWh) by region and technology over time"
        />
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">Region</label>
            <select
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {regions.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">Technology</label>
            <select
              value={selectedTech}
              onChange={e => setSelectedTech(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {techs.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={priceChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={v => `$${v}`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => [`$${v.toFixed(2)}/MWh`]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Line
                type="monotone"
                dataKey="Avg Price"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Median Price"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={{ r: 3 }}
                strokeDasharray="5 3"
              />
              <Line
                type="monotone"
                dataKey="Min Price"
                stroke="#f87171"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 3"
              />
              <Line
                type="monotone"
                dataKey="Max Price"
                stroke="#fbbf24"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 3"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Price Index table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Quarter</th>
                <th className="px-4 py-3 text-left">Region</th>
                <th className="px-4 py-3 text-left">Technology</th>
                <th className="px-4 py-3 text-right">Avg $/MWh</th>
                <th className="px-4 py-3 text-right">Median $/MWh</th>
                <th className="px-4 py-3 text-right">Min $/MWh</th>
                <th className="px-4 py-3 text-right">Max $/MWh</th>
                <th className="px-4 py-3 text-right">Deals</th>
                <th className="px-4 py-3 text-right">Total MW</th>
                <th className="px-4 py-3 text-right">vs Spot</th>
              </tr>
            </thead>
            <tbody>
              {data.price_index
                .filter((r: PPAPriceIndexRecord) => r.region === selectedRegion && r.technology === selectedTech)
                .sort((a, b) => a.quarter.localeCompare(b.quarter))
                .map((r: PPAPriceIndexRecord, idx: number) => (
                  <tr key={`${r.quarter}-${r.region}-${r.technology}`} className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-300">{r.quarter}</td>
                    <td className="px-4 py-2.5 text-gray-300">{r.region}</td>
                    <td className="px-4 py-2.5"><TechBadge tech={r.technology} /></td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">${r.avg_ppa_price.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-200">${r.median_ppa_price.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-red-400">${r.min_ppa_price.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-yellow-400">${r.max_ppa_price.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{r.deal_count}</td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{r.total_mw.toLocaleString()}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${r.vs_spot_premium_pct >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {r.vs_spot_premium_pct >= 0 ? '+' : ''}{r.vs_spot_premium_pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Buyer Sectors — Bar Chart */}
      <section>
        <SectionHeader
          title="Buyer Sector Analysis"
          subtitle="Deal count, total contracted MW, and average PPA price by buyer sector"
        />
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={buyerChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={v => `$${v}`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Bar yAxisId="left" dataKey="Deal Count" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="Total MW (÷10)" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="Avg Price $/MWh" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Buyer table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Sector</th>
                <th className="px-4 py-3 text-right">Deals</th>
                <th className="px-4 py-3 text-right">Total MW</th>
                <th className="px-4 py-3 text-right">Avg Deal MW</th>
                <th className="px-4 py-3 text-right">Avg $/MWh</th>
                <th className="px-4 py-3 text-right">Avg Duration</th>
                <th className="px-4 py-3 text-right">RE Target %</th>
                <th className="px-4 py-3 text-right">LGC %</th>
              </tr>
            </thead>
            <tbody>
              {data.buyers.map((b: PPABuyerRecord, idx: number) => (
                <tr key={b.buyer_sector} className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}>
                  <td className="px-4 py-2.5 font-semibold text-white">
                    {b.buyer_sector.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300">{b.deal_count}</td>
                  <td className="px-4 py-2.5 text-right text-sky-400">
                    {b.total_mw.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300">{b.avg_deal_size_mw}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">
                    ${b.avg_ppa_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300">
                    {b.avg_duration_years} yrs
                  </td>
                  <td className="px-4 py-2.5 text-right text-teal-400">
                    {b.green_target_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300">
                    {b.pct_with_lgcs.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Risk Register */}
      <section>
        <SectionHeader
          title="PPA Risk Register"
          subtitle="Key risk types, mitigation strategies, and impact/probability matrix"
        />
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Risk Type</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Mitigation</th>
                <th className="px-4 py-3 text-left">Applicable Structures</th>
                <th className="px-4 py-3 text-center">Impact</th>
                <th className="px-4 py-3 text-center">Probability</th>
              </tr>
            </thead>
            <tbody>
              {data.risks.map((r: PPARiskRecord, idx: number) => (
                <tr key={r.risk_type} className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}>
                  <td className="px-4 py-2.5 font-semibold text-amber-400 whitespace-nowrap">
                    {r.risk_type.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-2.5 text-gray-300 max-w-xs">{r.description}</td>
                  <td className="px-4 py-2.5 text-gray-300 max-w-xs">{r.mitigation}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">{r.deal_structure}</td>
                  <td className="px-4 py-2.5 text-center">
                    <ImpactBadge level={r.impact} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <ImpactBadge level={r.probability} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pipeline Outlook — Stacked Bar Chart */}
      <section>
        <SectionHeader
          title="Pipeline Outlook 2022–2026"
          subtitle="Signed and under-negotiation MW by year across NEM regions"
        />
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={pipelineChartData}
              margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={v => `${(v / 1000).toFixed(1)}GW`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => [`${v.toLocaleString()} MW`]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Bar dataKey="Signed" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Under Negotiation" stackId="a" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Pipeline table by region */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-right">Year</th>
                <th className="px-4 py-3 text-left">Region</th>
                <th className="px-4 py-3 text-right">Signed MW</th>
                <th className="px-4 py-3 text-right">Negotiating MW</th>
                <th className="px-4 py-3 text-right">Total MW</th>
                <th className="px-4 py-3 text-right">Avg $/MWh</th>
                <th className="px-4 py-3 text-left">Lead Tech</th>
                <th className="px-4 py-3 text-right">YoY Growth</th>
              </tr>
            </thead>
            <tbody>
              {(data.pipeline as PPAPipelineRecord[])
                .sort((a, b) => a.year - b.year || a.region.localeCompare(b.region))
                .map((p: PPAPipelineRecord, idx: number) => (
                  <tr
                    key={`${p.year}-${p.region}`}
                    className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}
                  >
                    <td className="px-4 py-2.5 text-right font-mono text-gray-300">{p.year}</td>
                    <td className="px-4 py-2.5 font-semibold text-white">{p.region}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-400">
                      {p.signed_mw.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sky-400">
                      {p.under_negotiation_mw.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-white">
                      {p.total_pipeline_mw.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-400">
                      ${p.avg_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5">
                      <TechBadge tech={p.dominant_technology} />
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold ${
                        p.yoy_growth_pct >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {p.yoy_growth_pct >= 0 ? '+' : ''}
                      {p.yoy_growth_pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
