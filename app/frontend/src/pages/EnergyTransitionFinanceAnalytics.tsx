import React, { useEffect, useState } from 'react'
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
} from 'recharts'
import { DollarSign, RefreshCw, AlertTriangle, TrendingUp, Award, Leaf, Building2 } from 'lucide-react'
import {
  getEnergyTransitionFinanceDashboard,
  ETFDashboard,
  ETFGreenBondRecord,
  ETFCapitalFlowRecord,
  ETFESGRecord,
  ETFCostOfCapitalRecord,
  ETFInstitutionalRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const CERTIFICATION_BADGE: Record<string, string> = {
  CBI:         'bg-green-600 text-white',
  ICMA:        'bg-blue-600 text-white',
  EU_TAXONOMY: 'bg-violet-600 text-white',
  NONE:        'bg-gray-600 text-white',
}

const ISSUER_TYPE_BADGE: Record<string, string> = {
  UTILITY:    'bg-orange-600 text-white',
  GOVERNMENT: 'bg-blue-700 text-white',
  BANK:       'bg-teal-600 text-white',
  DEVELOPER:  'bg-green-600 text-white',
  TNSP:       'bg-sky-600 text-white',
  DNSP:       'bg-indigo-600 text-white',
  RETAILER:   'bg-pink-600 text-white',
}

const TREND_BADGE: Record<string, string> = {
  IMPROVING:    'bg-green-600 text-white',
  STABLE:       'bg-amber-600 text-white',
  DETERIORATING:'bg-red-700 text-white',
}

const CURRENCY_BADGE: Record<string, string> = {
  AUD: 'bg-yellow-600 text-white',
  USD: 'bg-green-700 text-white',
  EUR: 'bg-blue-700 text-white',
  NZD: 'bg-teal-700 text-white',
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'text-emerald-400',
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color?: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 shadow">
      <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wider">
        <Icon size={14} className={color} />
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score Bar
// ---------------------------------------------------------------------------

function ScoreBar({ value, max = 100, color = 'bg-emerald-500' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-8 text-right">{value.toFixed(0)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stacked Bar Chart — Capital Flows by Asset Class / Year
// ---------------------------------------------------------------------------

const ASSET_COLORS: Record<string, string> = {
  WIND:         '#34d399',
  SOLAR:        '#fbbf24',
  STORAGE:      '#60a5fa',
  TRANSMISSION: '#a78bfa',
  HYDRO:        '#38bdf8',
  HYDROGEN:     '#f472b6',
  EV_INFRA:     '#fb923c',
}

function buildCapitalFlowChartData(flows: ETFCapitalFlowRecord[]) {
  const years = Array.from(new Set(flows.map(f => f.year))).sort()
  return years.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    flows.filter(f => f.year === yr).forEach(f => {
      row[f.asset_class] = f.total_bn
    })
    return row
  })
}

function buildWaccLineData(coc: ETFCostOfCapitalRecord[]) {
  const years = Array.from(new Set(coc.map(c => c.year))).sort()
  return years.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    coc.filter(c => c.year === yr).forEach(c => {
      row[c.asset_class] = c.wacc_pct
    })
    return row
  })
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function EnergyTransitionFinanceAnalytics() {
  const [data, setData] = useState<ETFDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getEnergyTransitionFinanceDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Loading Energy Transition Finance data…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center gap-2 text-red-400 p-6">
        <AlertTriangle size={20} />
        {error ?? 'No data'}
      </div>
    )
  }

  const { summary } = data
  const capitalFlowChartData = buildCapitalFlowChartData(data.capital_flows)
  const waccLineData = buildWaccLineData(data.cost_of_capital)
  const assetClasses = Array.from(new Set(data.capital_flows.map(f => f.asset_class)))
  const sortedESG = [...data.esg_ratings].sort((a, b) => b.esg_overall_score - a.esg_overall_score)

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <DollarSign className="text-emerald-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Energy Transition Finance &amp; Capital Markets</h1>
          <p className="text-gray-400 text-sm">Green bonds · ESG ratings · Capital flows · Cost of capital · Institutional allocation</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <KpiCard
          label="Green Bonds on Issue"
          value={`A$${summary.total_green_bonds_on_issue_bn}bn`}
          icon={Leaf}
          color="text-green-400"
        />
        <KpiCard
          label="Clean Energy Invest. 2024"
          value={`A$${summary.total_clean_energy_investment_2024_bn}bn`}
          icon={TrendingUp}
          color="text-emerald-400"
        />
        <KpiCard
          label="Avg Greenium"
          value={`${summary.avg_greenium_bps} bps`}
          sub="green premium vs conventional"
          icon={DollarSign}
          color="text-teal-400"
        />
        <KpiCard
          label="Avg ESG Score"
          value={`${summary.avg_esg_score} / 100`}
          icon={Award}
          color="text-amber-400"
        />
        <KpiCard
          label="Renewables WACC"
          value={`${summary.renewables_weighted_wacc_pct}%`}
          sub="weighted avg cost of capital"
          icon={TrendingUp}
          color="text-sky-400"
        />
        <KpiCard
          label="Institutional Energy Alloc."
          value={`${summary.institutional_energy_allocation_pct}%`}
          sub="of total AUM"
          icon={Building2}
          color="text-violet-400"
        />
        <KpiCard
          label="Fossil Fuel Divested"
          value={`${summary.divested_fossil_pct}%`}
          sub="of prior holdings"
          icon={Leaf}
          color="text-rose-400"
        />
      </div>

      {/* Green Bond Register */}
      <section className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Leaf className="text-green-400" size={18} />
          Green Bond Register — Australian Energy Sector
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-3">Issuer</th>
                <th className="text-left py-2 pr-3">Type</th>
                <th className="text-left py-2 pr-3">Issued</th>
                <th className="text-left py-2 pr-3">Matures</th>
                <th className="text-right py-2 pr-3">Face Value</th>
                <th className="text-left py-2 pr-3">CCY</th>
                <th className="text-right py-2 pr-3">Coupon%</th>
                <th className="text-left py-2 pr-3">Use of Proceeds</th>
                <th className="text-left py-2 pr-3">Certification</th>
                <th className="text-right py-2 pr-3">Yield%</th>
                <th className="text-right py-2">Greenium bps</th>
              </tr>
            </thead>
            <tbody>
              {data.green_bonds.map((b: ETFGreenBondRecord) => (
                <tr key={b.bond_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-1.5 pr-3 font-medium text-white">{b.issuer}</td>
                  <td className="py-1.5 pr-3">
                    <Badge label={b.issuer_type} colorClass={ISSUER_TYPE_BADGE[b.issuer_type] ?? 'bg-gray-600 text-white'} />
                  </td>
                  <td className="py-1.5 pr-3 text-gray-300">{b.issue_date}</td>
                  <td className="py-1.5 pr-3 text-gray-300">{b.maturity_date}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-100">{b.face_value_m.toLocaleString()}m</td>
                  <td className="py-1.5 pr-3">
                    <Badge label={b.currency} colorClass={CURRENCY_BADGE[b.currency] ?? 'bg-gray-600 text-white'} />
                  </td>
                  <td className="py-1.5 pr-3 text-right text-gray-100">{b.coupon_pct.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-gray-300">{b.use_of_proceeds}</td>
                  <td className="py-1.5 pr-3">
                    <Badge label={b.certification} colorClass={CERTIFICATION_BADGE[b.certification] ?? 'bg-gray-600 text-white'} />
                  </td>
                  <td className="py-1.5 pr-3 text-right text-gray-100">{b.yield_at_issue_pct.toFixed(2)}</td>
                  <td className="py-1.5 text-right text-emerald-400 font-semibold">{b.green_premium_bps.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Capital Flow Trends */}
      <section className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="text-emerald-400" size={18} />
          Clean Energy Capital Flow Trends (A$bn) — 2020–2024
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={capitalFlowChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="bn" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`A$${v.toFixed(1)}bn`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            {assetClasses.map(ac => (
              <Bar key={ac} dataKey={ac} stackId="a" fill={ASSET_COLORS[ac] ?? '#6b7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ESG Ratings */}
      <section className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Award className="text-amber-400" size={18} />
          ESG Ratings — ASX-Listed Energy Companies
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-3">Company</th>
                <th className="text-left py-2 pr-3">Ticker</th>
                <th className="text-left py-2 pr-3">Sector</th>
                <th className="text-left py-2 pr-3">Overall</th>
                <th className="text-left py-2 pr-3 w-28">Environment</th>
                <th className="text-left py-2 pr-3 w-28">Social</th>
                <th className="text-left py-2 pr-3 w-28">Governance</th>
                <th className="text-right py-2 pr-3">Carbon t/MWh</th>
                <th className="text-right py-2 pr-3">Renewables%</th>
                <th className="text-left py-2 pr-3">Agency</th>
                <th className="text-left py-2">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sortedESG.map((e: ETFESGRecord) => (
                <tr key={e.ticker} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-1.5 pr-3 font-medium text-white">{e.company}</td>
                  <td className="py-1.5 pr-3 text-gray-400 font-mono">{e.ticker}</td>
                  <td className="py-1.5 pr-3 text-gray-300">{e.sector}</td>
                  <td className="py-1.5 pr-3 w-32">
                    <ScoreBar value={e.esg_overall_score} color="bg-amber-500" />
                  </td>
                  <td className="py-1.5 pr-3 w-28">
                    <ScoreBar value={e.environmental_score} color="bg-green-500" />
                  </td>
                  <td className="py-1.5 pr-3 w-28">
                    <ScoreBar value={e.social_score} color="bg-blue-500" />
                  </td>
                  <td className="py-1.5 pr-3 w-28">
                    <ScoreBar value={e.governance_score} color="bg-violet-500" />
                  </td>
                  <td className="py-1.5 pr-3 text-right text-gray-100">{e.carbon_intensity_t_per_mwh.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-100">{e.renewables_pct.toFixed(1)}%</td>
                  <td className="py-1.5 pr-3 text-gray-300">{e.esg_rating_agency}</td>
                  <td className="py-1.5">
                    <Badge label={e.esg_trend} colorClass={TREND_BADGE[e.esg_trend] ?? 'bg-gray-600 text-white'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cost of Capital — WACC by Technology / Year */}
      <section className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <DollarSign className="text-sky-400" size={18} />
          Cost of Capital (WACC%) by Technology — 2020–2024
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={waccLineData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[4, 12]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${v.toFixed(2)}%`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            {assetClasses.map(ac => (
              <Line
                key={ac}
                type="monotone"
                dataKey={ac}
                stroke={ASSET_COLORS[ac] ?? '#6b7280'}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Institutional Investor Allocation */}
      <section className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="text-violet-400" size={18} />
          Institutional Investor Energy Allocation
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data.institutional.map((i: ETFInstitutionalRecord) => ({
              type: i.investor_type.replace(/_/g, ' '),
              'Energy Alloc %': i.energy_allocation_pct,
              'Renewable Target %': i.renewable_target_pct,
              'Fossil Divested %': i.divested_fossil_pct,
            }))}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 120, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <YAxis type="category" dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} width={115} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${v.toFixed(1)}%`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            <Bar dataKey="Energy Alloc %" fill="#a78bfa" />
            <Bar dataKey="Renewable Target %" fill="#34d399" />
            <Bar dataKey="Fossil Divested %" fill="#f87171" />
          </BarChart>
        </ResponsiveContainer>

        {/* Institutional Detail Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-3">Investor Type</th>
                <th className="text-right py-2 pr-3">AUM (A$bn)</th>
                <th className="text-right py-2 pr-3">Energy Alloc%</th>
                <th className="text-right py-2 pr-3">Renew. Target%</th>
                <th className="text-right py-2 pr-3">Fossil Divested%</th>
                <th className="text-right py-2 pr-3">Net Zero Yr</th>
                <th className="text-left py-2">Pref. Instrument</th>
              </tr>
            </thead>
            <tbody>
              {data.institutional.map((i: ETFInstitutionalRecord) => (
                <tr key={i.investor_type} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-1.5 pr-3 font-medium text-white">{i.investor_type.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-100">{i.total_aum_bn.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right text-violet-400 font-semibold">{i.energy_allocation_pct.toFixed(1)}%</td>
                  <td className="py-1.5 pr-3 text-right text-emerald-400">{i.renewable_target_pct.toFixed(1)}%</td>
                  <td className="py-1.5 pr-3 text-right text-rose-400">{i.divested_fossil_pct.toFixed(1)}%</td>
                  <td className="py-1.5 pr-3 text-right text-gray-300">{i.net_zero_commitment_year ?? '—'}</td>
                  <td className="py-1.5 text-gray-300">{i.preferred_instrument}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cost of Capital Detail Table */}
      <section className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <DollarSign className="text-sky-400" size={18} />
          Cost of Capital — 2024 Snapshot by Technology
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-3">Asset Class</th>
                <th className="text-right py-2 pr-3">Risk-Free%</th>
                <th className="text-right py-2 pr-3">ERP%</th>
                <th className="text-right py-2 pr-3">Tech Risk%</th>
                <th className="text-right py-2 pr-3">WACC%</th>
                <th className="text-right py-2 pr-3">Debt Cost%</th>
                <th className="text-right py-2 pr-3">Equity Cost%</th>
                <th className="text-right py-2 pr-3">Gearing%</th>
                <th className="text-right py-2">Country Risk%</th>
              </tr>
            </thead>
            <tbody>
              {data.cost_of_capital
                .filter((c: ETFCostOfCapitalRecord) => c.year === 2024)
                .map((c: ETFCostOfCapitalRecord) => (
                  <tr key={c.asset_class} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="py-1.5 pr-3 font-medium text-white">{c.asset_class}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-300">{c.risk_free_rate_pct.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-300">{c.equity_risk_premium_pct.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-right text-amber-400">{c.technology_risk_premium_pct.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-right text-sky-400 font-bold">{c.wacc_pct.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-300">{c.debt_cost_pct.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-300">{c.equity_cost_pct.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-right text-violet-400">{c.gearing_pct.toFixed(1)}</td>
                    <td className="py-1.5 text-right text-gray-300">{c.country_risk_premium_pct.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
