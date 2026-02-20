import React, { useEffect, useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  Building2,
  Target,
  Shield,
  BarChart2,
  AlertTriangle,
  RefreshCw,
  DollarSign,
} from 'lucide-react'
import {
  getWholesaleBiddingStrategyDashboard,
  WBSDashboard,
  WBSPortfolioRecord,
  WBSStrategyRecord,
  WBSDispatchRankRecord,
  WBSRiskRecord,
  WBSOptimalBidRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const FUEL_MIX_BADGE: Record<string, string> = {
  COAL_DOMINANT:      'bg-gray-700 text-gray-200',
  GAS_PEAKER:         'bg-orange-700 text-orange-100',
  RENEWABLES:         'bg-green-700 text-green-100',
  MIXED:              'bg-blue-700 text-blue-100',
  STORAGE_SPECIALIST: 'bg-purple-700 text-purple-100',
}

const STRATEGY_BADGE: Record<string, string> = {
  COST_PLUS:              'bg-green-800 text-green-200',
  SCARCITY_PRICING:       'bg-red-800 text-red-200',
  PORTFOLIO_OPTIMISATION: 'bg-blue-800 text-blue-200',
  MIXED:                  'bg-amber-800 text-amber-200',
  FINANCIAL_HEDGE_DRIVEN: 'bg-purple-800 text-purple-200',
}

const RISK_TYPE_BADGE: Record<string, string> = {
  VOLUME:        'bg-blue-700 text-blue-100',
  PRICE:         'bg-red-700 text-red-100',
  FUEL:          'bg-orange-700 text-orange-100',
  COUNTERPARTY:  'bg-amber-700 text-amber-100',
  REGULATORY:    'bg-gray-600 text-gray-200',
  MARKET_DESIGN: 'bg-purple-700 text-purple-100',
}

const SCENARIO_BADGE: Record<string, string> = {
  LOW_DEMAND:  'bg-green-800 text-green-200',
  NORMAL:      'bg-blue-800 text-blue-200',
  HIGH_DEMAND: 'bg-orange-800 text-orange-200',
  EXTREME_HEAT:'bg-red-800 text-red-200',
  LOW_WIND:    'bg-purple-800 text-purple-200',
}

const TECH_COLORS: Record<string, string> = {
  BLACK_COAL:    '#6b7280',
  GAS_CCGT:      '#f59e0b',
  GAS_OCGT:      '#ef4444',
  WIND:          '#3b82f6',
  UTILITY_SOLAR: '#10b981',
}

const COMPANY_COLORS: Record<string, string> = {
  'AGL Energy':          '#f59e0b',
  'Origin Energy':       '#3b82f6',
  'EnergyAustralia':     '#10b981',
  'Alinta Energy':       '#8b5cf6',
  'CS Energy':           '#ec4899',
  'Snowy Hydro':         '#06b6d4',
  'APA Group':           '#f97316',
  'Neoen':               '#84cc16',
  'Iberdrola Australia': '#a78bfa',
  'Macquarie Energy':    '#fb7185',
}

function badge(text: string, map: Record<string, string>, fallback = 'bg-gray-600 text-gray-200') {
  const cls = map[text] ?? fallback
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {text.replace(/_/g, ' ')}
    </span>
  )
}

function fmt(n: number, decimals = 1) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtCurrency(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1000) return `${sign}$${fmt(abs / 1000, 1)}B`
  return `${sign}$${fmt(abs, 1)}M`
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiProps {
  label: string
  value: string
  sub?: string
  Icon: React.ElementType
  accent?: string
}
function KpiCard({ label, value, sub, Icon, accent = 'text-blue-400' }: KpiProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-start gap-3 border border-gray-700">
      <Icon className={`w-6 h-6 mt-0.5 shrink-0 ${accent}`} />
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-750">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Portfolio Overview Table
// ---------------------------------------------------------------------------
function PortfolioTable({ rows }: { rows: WBSPortfolioRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-gray-300 min-w-[900px]">
        <thead>
          <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <th className="text-left py-2 pr-4">Company</th>
            <th className="text-left py-2 pr-4">Region</th>
            <th className="text-left py-2 pr-4">Fuel Mix</th>
            <th className="text-right py-2 pr-4">Total MW</th>
            <th className="text-right py-2 pr-4">Mkt Share %</th>
            <th className="text-right py-2 pr-4">Hedged %</th>
            <th className="text-right py-2 pr-4">Retail Load MW</th>
            <th className="text-right py-2">Net Position MW</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.company} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
              <td className="py-2 pr-4 font-medium text-white flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: COMPANY_COLORS[r.company] ?? '#6b7280' }}
                />
                {r.company}
              </td>
              <td className="py-2 pr-4">{r.region}</td>
              <td className="py-2 pr-4">{badge(r.fuel_mix, FUEL_MIX_BADGE)}</td>
              <td className="py-2 pr-4 text-right">{fmt(r.total_portfolio_mw, 0)}</td>
              <td className="py-2 pr-4 text-right font-semibold text-blue-300">{fmt(r.market_share_pct)}%</td>
              <td className="py-2 pr-4 text-right">
                <span className={r.hedged_position_pct >= 70 ? 'text-green-400' : r.hedged_position_pct >= 50 ? 'text-amber-400' : 'text-red-400'}>
                  {fmt(r.hedged_position_pct)}%
                </span>
              </td>
              <td className="py-2 pr-4 text-right">{fmt(r.retail_load_mw, 0)}</td>
              <td className="py-2 text-right font-semibold">
                <span className={r.net_position_mw >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {r.net_position_mw >= 0 ? '+' : ''}{fmt(r.net_position_mw, 0)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Strategy Comparison Table
// ---------------------------------------------------------------------------
function StrategyTable({ rows }: { rows: WBSStrategyRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-gray-300 min-w-[1000px]">
        <thead>
          <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <th className="text-left py-2 pr-4">Company</th>
            <th className="text-left py-2 pr-4">Strategy</th>
            <th className="text-right py-2 pr-4">Band 1 ($/MWh)</th>
            <th className="text-right py-2 pr-4">Band 10 ($/MWh)</th>
            <th className="text-right py-2 pr-4">% Below SRMC</th>
            <th className="text-right py-2 pr-4">% at VoLL</th>
            <th className="text-right py-2 pr-4">Rebids/Day</th>
            <th className="text-right py-2 pr-4">Stability</th>
            <th className="text-right py-2">Forecast Resp %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.company} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
              <td className="py-2 pr-4 font-medium text-white">{r.company}</td>
              <td className="py-2 pr-4">{badge(r.strategy, STRATEGY_BADGE)}</td>
              <td className="py-2 pr-4 text-right">
                <span className={r.avg_band_1_price < 0 ? 'text-red-400' : 'text-gray-300'}>
                  {r.avg_band_1_price < 0 ? '' : ''}${fmt(r.avg_band_1_price, 0)}
                </span>
              </td>
              <td className="py-2 pr-4 text-right">
                <span className={r.avg_band_10_price >= 14000 ? 'text-red-300' : 'text-gray-300'}>
                  ${fmt(r.avg_band_10_price, 0)}
                </span>
              </td>
              <td className="py-2 pr-4 text-right text-amber-300">{fmt(r.pct_volume_below_srmc)}%</td>
              <td className="py-2 pr-4 text-right">
                <span className={r.pct_volume_at_voll > 15 ? 'text-red-400' : 'text-gray-300'}>
                  {fmt(r.pct_volume_at_voll)}%
                </span>
              </td>
              <td className="py-2 pr-4 text-right">{fmt(r.rebid_rate_per_day, 1)}</td>
              <td className="py-2 pr-4 text-right">
                <span className={r.price_stability_score >= 8 ? 'text-green-400' : r.price_stability_score >= 6 ? 'text-amber-400' : 'text-red-400'}>
                  {fmt(r.price_stability_score, 1)}/10
                </span>
              </td>
              <td className="py-2 text-right text-blue-300">{fmt(r.responsive_to_forecast_pct)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dispatch Merit Order Chart
// ---------------------------------------------------------------------------
function DispatchMeritChart({ rows }: { rows: WBSDispatchRankRecord[] }) {
  const [selectedQuarter, setSelectedQuarter] = useState<string>('2024-Q4')
  const [selectedRegion, setSelectedRegion] = useState<string>('NSW')

  const quarters = useMemo(() => [...new Set(rows.map((r) => r.quarter))].sort(), [rows])
  const regions = useMemo(() => [...new Set(rows.map((r) => r.region))].sort(), [rows])

  const chartData = useMemo(() => {
    const filtered = rows.filter(
      (r) => r.quarter === selectedQuarter && r.region === selectedRegion,
    )
    return filtered.map((r) => ({
      tech: r.technology.replace('_', '\n'),
      'Cap Factor %': r.capacity_factor_pct,
      'Price Setter %': r.price_setter_pct,
      'Infra-Marginal Rent $M': r.infra_marginal_rent_m,
    }))
  }, [rows, selectedQuarter, selectedRegion])

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <div>
          <label className="text-xs text-gray-400 mr-2">Quarter:</label>
          {quarters.map((q) => (
            <button
              key={q}
              onClick={() => setSelectedQuarter(q)}
              className={`mr-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                selectedQuarter === q
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs text-gray-400 mr-2">Region:</label>
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={`mr-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                selectedRegion === r
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="tech" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="Cap Factor %" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Price Setter %" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Infra-Marginal Rent $M" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary table below chart */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm text-gray-300">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
              <th className="text-left py-2 pr-4">Technology</th>
              <th className="text-right py-2 pr-4">Avg Dispatch Rank</th>
              <th className="text-right py-2 pr-4">Cap Factor %</th>
              <th className="text-right py-2 pr-4">Price Setter %</th>
              <th className="text-right py-2 pr-4">Avg Marg Cost</th>
              <th className="text-right py-2 pr-4">Avg Dispatch Price</th>
              <th className="text-right py-2">Infra-Marg Rent $M</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => r.quarter === selectedQuarter && r.region === selectedRegion)
              .sort((a, b) => a.avg_dispatch_rank - b.avg_dispatch_rank)
              .map((r) => (
                <tr key={r.technology} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                  <td className="py-2 pr-4 flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: TECH_COLORS[r.technology] ?? '#6b7280' }}
                    />
                    <span className="text-white font-medium">{r.technology.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="py-2 pr-4 text-right">{fmt(r.avg_dispatch_rank, 1)}</td>
                  <td className="py-2 pr-4 text-right text-blue-300">{fmt(r.capacity_factor_pct)}%</td>
                  <td className="py-2 pr-4 text-right text-amber-300">{fmt(r.price_setter_pct)}%</td>
                  <td className="py-2 pr-4 text-right">
                    <span className={r.avg_marginal_cost < 0 ? 'text-red-400' : 'text-gray-300'}>
                      ${fmt(r.avg_marginal_cost, 1)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right">${fmt(r.avg_dispatch_price, 1)}</td>
                  <td className="py-2 text-right text-green-300">{fmtCurrency(r.infra_marginal_rent_m)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Risk Analysis Table
// ---------------------------------------------------------------------------
function RiskTable({ rows }: { rows: WBSRiskRecord[] }) {
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL')
  const companies = useMemo(() => ['ALL', ...new Set(rows.map((r) => r.company))], [rows])

  const filtered = useMemo(
    () => (selectedCompany === 'ALL' ? rows : rows.filter((r) => r.company === selectedCompany)),
    [rows, selectedCompany],
  )

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-4">
        {companies.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCompany(c)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              selectedCompany === c
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-300 min-w-[800px]">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
              <th className="text-left py-2 pr-4">Company</th>
              <th className="text-left py-2 pr-4">Risk Type</th>
              <th className="text-right py-2 pr-4">Exposure $M</th>
              <th className="text-left py-2 pr-4">Hedging Instrument</th>
              <th className="text-right py-2 pr-4">Hedge Ratio %</th>
              <th className="text-right py-2">Residual Risk $M</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                <td className="py-2 pr-4 font-medium text-white">{r.company}</td>
                <td className="py-2 pr-4">{badge(r.risk_type, RISK_TYPE_BADGE)}</td>
                <td className="py-2 pr-4 text-right text-red-300">{fmtCurrency(r.exposure_m)}</td>
                <td className="py-2 pr-4">
                  <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-200 text-xs font-mono">
                    {r.hedging_instrument}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right">
                  <span className={r.hedge_ratio_pct >= 70 ? 'text-green-400' : r.hedge_ratio_pct >= 50 ? 'text-amber-400' : 'text-red-400'}>
                    {fmt(r.hedge_ratio_pct)}%
                  </span>
                </td>
                <td className="py-2 text-right text-orange-300">{fmtCurrency(r.residual_risk_m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Optimal Bid Scenarios Table
// ---------------------------------------------------------------------------
function OptimalBidTable({ rows }: { rows: WBSOptimalBidRecord[] }) {
  const [selectedTech, setSelectedTech] = useState<string>('ALL')
  const technologies = useMemo(() => ['ALL', ...new Set(rows.map((r) => r.technology))], [rows])

  const filtered = useMemo(
    () => (selectedTech === 'ALL' ? rows : rows.filter((r) => r.technology === selectedTech)),
    [rows, selectedTech],
  )

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-4">
        {technologies.map((t) => (
          <button
            key={t}
            onClick={() => setSelectedTech(t)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              selectedTech === t
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            style={t !== 'ALL' ? { borderLeft: `3px solid ${TECH_COLORS[t] ?? '#6b7280'}` } : {}}
          >
            {t === 'ALL' ? 'ALL' : t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-300 min-w-[900px]">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
              <th className="text-left py-2 pr-4">Technology</th>
              <th className="text-left py-2 pr-4">Scenario</th>
              <th className="text-right py-2 pr-4">Opt Band 1 ($/MWh)</th>
              <th className="text-right py-2 pr-4">Opt Band 10 ($/MWh)</th>
              <th className="text-right py-2 pr-4">Exp Dispatch %</th>
              <th className="text-right py-2 pr-4">Exp Revenue $/MWh</th>
              <th className="text-right py-2">VaR 10th pct $M</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                <td className="py-2 pr-4 font-medium flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: TECH_COLORS[r.technology] ?? '#6b7280' }}
                  />
                  <span className="text-white">{r.technology.replace(/_/g, ' ')}</span>
                </td>
                <td className="py-2 pr-4">{badge(r.scenario, SCENARIO_BADGE)}</td>
                <td className="py-2 pr-4 text-right">
                  <span className={r.optimal_band_1_price < 0 ? 'text-red-400' : 'text-gray-300'}>
                    ${fmt(r.optimal_band_1_price, 0)}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right">
                  <span className={r.optimal_band_10_price >= 14000 ? 'text-red-300' : 'text-gray-300'}>
                    ${fmt(r.optimal_band_10_price, 0)}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right text-blue-300">{fmt(r.expected_dispatch_pct)}%</td>
                <td className="py-2 pr-4 text-right text-green-300">${fmt(r.expected_revenue_per_mwh, 1)}</td>
                <td className="py-2 text-right text-orange-300">{fmtCurrency(r.value_at_risk_10pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function WholesaleBiddingStrategyAnalytics() {
  const [data, setData] = useState<WBSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWholesaleBiddingStrategyDashboard()
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading Wholesale Bidding Strategy data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertTriangle className="w-6 h-6 mr-2" />
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>

  return (
    <div className="space-y-6 text-gray-100">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <TrendingUp className="w-7 h-7 text-blue-400 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-white">NEM Wholesale Market Participant Bidding Strategy Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Portfolio optimisation, risk-adjusted bidding and market position analysis for major NEM generators
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          Icon={BarChart2}
          label="Market HHI"
          value={String(summary['avg_market_concentration_hhi'])}
          sub="Moderately concentrated"
          accent="text-orange-400"
        />
        <KpiCard
          Icon={Target}
          label="Dominant Strategy"
          value="Portfolio Opt."
          sub={String(summary['dominant_strategy']).replace(/_/g, ' ')}
          accent="text-blue-400"
        />
        <KpiCard
          Icon={Shield}
          label="Avg Hedge Ratio"
          value={`${summary['avg_hedge_ratio_pct']}%`}
          sub="Across major participants"
          accent="text-green-400"
        />
        <KpiCard
          Icon={Building2}
          label="Coal Price Setting"
          value={`${summary['price_setter_frequency_coal_pct']}%`}
          sub="Intervals price set by coal"
          accent="text-gray-400"
        />
        <KpiCard
          Icon={DollarSign}
          label="Gas Price Setting"
          value={`${summary['price_setter_frequency_gas_pct']}%`}
          sub="Intervals price set by gas"
          accent="text-amber-400"
        />
        <KpiCard
          Icon={AlertTriangle}
          label="VoLL Bidding"
          value={`${summary['voll_bidding_volume_pct']}%`}
          sub="Volume bid at $16,600/MWh"
          accent="text-red-400"
        />
      </div>

      {/* Portfolio Overview */}
      <Section title="Portfolio Overview — Market Share & Net Position">
        <PortfolioTable rows={data.portfolios} />
      </Section>

      {/* Strategy Comparison */}
      <Section title="Strategy Comparison — Bidding Behaviour & Price Band Analysis">
        <StrategyTable rows={data.strategies} />
      </Section>

      {/* Dispatch Merit Order */}
      <Section title="Dispatch Merit Order — Capacity Factor, Price Setting & Infra-Marginal Rent by Technology">
        <DispatchMeritChart rows={data.dispatch_ranks} />
      </Section>

      {/* Risk Analysis */}
      <Section title="Risk Analysis — Exposure, Hedging Instruments & Residual Risk">
        <RiskTable rows={data.risks} />
      </Section>

      {/* Optimal Bid Scenarios */}
      <Section title="Optimal Bid Scenarios — Revenue Maximisation by Technology & Demand Scenario">
        <OptimalBidTable rows={data.optimal_bids} />
      </Section>
    </div>
  )
}
