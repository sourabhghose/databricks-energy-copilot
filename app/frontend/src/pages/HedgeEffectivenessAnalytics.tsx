import { useEffect, useState } from 'react'
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
import { Shield, TrendingUp, DollarSign, Activity, AlertTriangle } from 'lucide-react'
import {
  getHedgeEffectivenessDashboard,
  HEFDashboard,
  HEFPositionRecord,
  HEFBasisRiskRecord,
  HEFPnLRecord,
  HEFHedgeRatioRecord,
  HEFRollingPerformanceRecord,
} from '../api/client'

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, d = 1): string {
  return n.toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtM(n: number): string {
  return `$${fmt(n, 2)}m`
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#6366f1',
  VIC1: '#10b981',
  QLD1: '#f59e0b',
  SA1:  '#ef4444',
  TAS1: '#06b6d4',
}

const REC_STYLES: Record<string, string> = {
  INCREASE: 'bg-green-900/50 text-green-300 border border-green-700',
  DECREASE: 'bg-red-900/50 text-red-300 border border-red-700',
  MAINTAIN: 'bg-slate-700/50 text-slate-300 border border-slate-600',
}

const POS_STYLES: Record<string, string> = {
  LONG:  'bg-indigo-900/50 text-indigo-300',
  SHORT: 'bg-orange-900/50 text-orange-300',
}

// ─── derived data builders ───────────────────────────────────────────────────

function buildPnLChartData(pnl: HEFPnLRecord[]) {
  // Aggregate across portfolios per month
  const monthMap: Record<string, { month: string; physical: number; hedge: number; net: number }> = {}
  for (const r of pnl) {
    const key = r.month
    if (!monthMap[key]) {
      monthMap[key] = { month: r.month.replace('2024-', ''), physical: 0, hedge: 0, net: 0 }
    }
    monthMap[key].physical += r.physical_pnl_m
    monthMap[key].hedge    += r.hedge_pnl_m
    monthMap[key].net      += r.net_pnl_m
  }
  return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month))
}

function buildBasisCorrelationData(basis: HEFBasisRiskRecord[]) {
  // Average correlation per region pair
  const pairMap: Record<string, { pair: string; correlation: number; count: number; basis_risk_pct: number }> = {}
  for (const r of basis) {
    const key = `${r.region}/${r.hedge_region}`
    if (!pairMap[key]) {
      pairMap[key] = { pair: key, correlation: 0, count: 0, basis_risk_pct: 0 }
    }
    pairMap[key].correlation    += r.correlation
    pairMap[key].basis_risk_pct += r.basis_risk_pct
    pairMap[key].count++
  }
  return Object.values(pairMap).map(p => ({
    pair:           p.pair,
    correlation:    parseFloat((p.correlation / p.count).toFixed(3)),
    basis_risk_pct: parseFloat((p.basis_risk_pct / p.count).toFixed(2)),
  }))
}

function buildRollingChartData(rolling: HEFRollingPerformanceRecord[]) {
  const yearMap: Record<number, Record<string, number>> = {}
  for (const r of rolling) {
    if (!yearMap[r.year]) yearMap[r.year] = { year: r.year }
    yearMap[r.year][r.region] = r.effectiveness_pct
  }
  return Object.values(yearMap).sort((a, b) => (a.year as number) - (b.year as number))
}

// ─── KPI computation ─────────────────────────────────────────────────────────

function computeKpis(data: HEFDashboard) {
  const s = data.summary as Record<string, number>
  return {
    totalNotionalMW:       s.total_notional_mw ?? 0,
    totalMtmValueM:        s.total_mtm_value_m ?? 0,
    avgHedgeRatioPct:      s.avg_hedge_ratio_pct ?? 0,
    avgBasisRiskPct:       s.avg_basis_risk_pct ?? 0,
    bestRegion:            (data.summary as Record<string, string>).best_performing_region ?? 'N/A',
    avgEffectivenessPct:   s.avg_hedge_effectiveness_pct ?? 0,
    totalVar95M:           s.total_var_95_m ?? 0,
  }
}

// ─── sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  accent: string
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${accent}`}>
      <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider">
        <Icon size={14} />
        {label}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

function PositionTable({ positions }: { positions: HEFPositionRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm text-slate-300">
        <thead className="bg-slate-800/80 text-xs text-slate-400 uppercase">
          <tr>
            {['Portfolio', 'Company', 'Region', 'Contract', 'Position', 'Notional MW',
              'Strike', 'Market', 'MtM $m', 'Delta', 'Gamma', 'Vega', 'Expiry'].map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((p, i) => (
            <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
              <td className="px-3 py-2 font-mono text-indigo-300">{p.portfolio_id}</td>
              <td className="px-3 py-2">{p.company}</td>
              <td className="px-3 py-2">
                <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ color: REGION_COLORS[p.region] ?? '#94a3b8' }}>
                  {p.region}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-slate-200">{p.contract_type}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${POS_STYLES[p.position] ?? ''}`}>
                  {p.position}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono">{fmt(p.notional_mw, 1)}</td>
              <td className="px-3 py-2 text-right font-mono">${fmt(p.strike_price, 2)}</td>
              <td className="px-3 py-2 text-right font-mono">${fmt(p.market_price, 2)}</td>
              <td className={`px-3 py-2 text-right font-mono font-semibold ${p.mtm_value_m >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtM(p.mtm_value_m)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-slate-300">{fmt(p.delta, 3)}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-400">{p.gamma.toFixed(5)}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-400">{fmt(p.vega, 3)}</td>
              <td className="px-3 py-2 font-mono text-amber-300">{p.expiry}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BasisRiskTable({ basis }: { basis: HEFBasisRiskRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm text-slate-300">
        <thead className="bg-slate-800/80 text-xs text-slate-400 uppercase">
          <tr>
            {['Physical Region', 'Hedge Region', 'Quarter', 'Spot (Hedge)', 'Spot (Physical)',
              'Basis Diff', 'Basis Risk %', 'Correlation', 'Constraint Hrs'].map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {basis.map((b, i) => {
            const highBasis = b.basis_risk_pct > 10
            return (
              <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-3 py-2 font-semibold" style={{ color: REGION_COLORS[b.region] ?? '#94a3b8' }}>{b.region}</td>
                <td className="px-3 py-2" style={{ color: REGION_COLORS[b.hedge_region] ?? '#94a3b8' }}>{b.hedge_region}</td>
                <td className="px-3 py-2 font-mono text-slate-200">{b.quarter}</td>
                <td className="px-3 py-2 text-right font-mono">${fmt(b.spot_price_hedge_region, 2)}</td>
                <td className="px-3 py-2 text-right font-mono">${fmt(b.spot_price_physical_region, 2)}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${b.basis_differential >= 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
                  {b.basis_differential >= 0 ? '+' : ''}{fmt(b.basis_differential, 2)}
                </td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${highBasis ? 'text-red-400' : 'text-slate-300'}`}>
                  {fmt(b.basis_risk_pct, 2)}%
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  <span className={`${b.correlation > 0.85 ? 'text-green-400' : b.correlation > 0.70 ? 'text-amber-400' : 'text-red-400'}`}>
                    {fmt(b.correlation, 3)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">{fmt(b.avg_interconnector_constraint_hrs, 0)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function HedgeRatioTable({ ratios }: { ratios: HEFHedgeRatioRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm text-slate-300">
        <thead className="bg-slate-800/80 text-xs text-slate-400 uppercase">
          <tr>
            {['Company', 'Region', 'Quarter', 'Optimal %', 'Actual %', 'Deviation',
              'Cost Over-Hedge $m', 'Cost Under-Hedge $m', 'Recommendation'].map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ratios.map((r, i) => (
            <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
              <td className="px-3 py-2 font-semibold">{r.company}</td>
              <td className="px-3 py-2 font-semibold" style={{ color: REGION_COLORS[r.region] ?? '#94a3b8' }}>{r.region}</td>
              <td className="px-3 py-2 font-mono text-slate-200">{r.quarter}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(r.optimal_hedge_ratio, 1)}%</td>
              <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(r.actual_hedge_ratio, 1)}%</td>
              <td className={`px-3 py-2 text-right font-mono font-semibold ${r.deviation_from_optimal_pct > 5 ? 'text-red-400' : r.deviation_from_optimal_pct < -5 ? 'text-amber-400' : 'text-green-400'}`}>
                {r.deviation_from_optimal_pct >= 0 ? '+' : ''}{fmt(r.deviation_from_optimal_pct, 1)}%
              </td>
              <td className="px-3 py-2 text-right font-mono text-orange-400">{fmtM(r.cost_of_over_hedging_m)}</td>
              <td className="px-3 py-2 text-right font-mono text-amber-400">{fmtM(r.cost_of_under_hedging_m)}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${REC_STYLES[r.recommendation] ?? ''}`}>
                  {r.recommendation}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function HedgeEffectivenessAnalytics() {
  const [data, setData]       = useState<HEFDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getHedgeEffectivenessDashboard()
      .then(d  => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400" />
    </div>
  )
  if (error || !data) return (
    <div className="p-6 text-red-400">Failed to load hedge effectiveness data: {error}</div>
  )

  const kpi             = computeKpis(data)
  const pnlChartData    = buildPnLChartData(data.pnl_attribution)
  const basisChartData  = buildBasisCorrelationData(data.basis_risk)
  const rollingChartData = buildRollingChartData(data.rolling_performance)
  const allRegions      = [...new Set(data.rolling_performance.map(r => r.region))].sort()

  return (
    <div className="p-6 space-y-8 text-slate-200">
      {/* ── page header ── */}
      <div className="flex items-center gap-3">
        <Shield className="text-indigo-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Electricity Futures Hedge Effectiveness Analytics</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            ASX energy futures hedging performance, basis risk, hedge ratios and portfolio P&amp;L attribution
          </p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <KpiCard
          icon={Activity}
          label="Total Notional"
          value={`${fmt(kpi.totalNotionalMW, 0)} MW`}
          accent="bg-indigo-900/30 border-indigo-700"
        />
        <KpiCard
          icon={DollarSign}
          label="Total MtM"
          value={fmtM(kpi.totalMtmValueM)}
          sub="Mark-to-Market"
          accent="bg-emerald-900/30 border-emerald-700"
        />
        <KpiCard
          icon={TrendingUp}
          label="Avg Hedge Ratio"
          value={`${fmt(kpi.avgHedgeRatioPct, 1)}%`}
          sub="Portfolio average"
          accent="bg-cyan-900/30 border-cyan-700"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Avg Basis Risk"
          value={`${fmt(kpi.avgBasisRiskPct, 1)}%`}
          sub="Cross-region"
          accent="bg-amber-900/30 border-amber-700"
        />
        <KpiCard
          icon={Shield}
          label="Hedge Effectiveness"
          value={`${fmt(kpi.avgEffectivenessPct, 1)}%`}
          sub="Variance eliminated"
          accent="bg-purple-900/30 border-purple-700"
        />
        <KpiCard
          icon={Activity}
          label="Total VaR 95%"
          value={fmtM(kpi.totalVar95M)}
          sub="1-day, portfolio"
          accent="bg-rose-900/30 border-rose-700"
        />
        <KpiCard
          icon={TrendingUp}
          label="Best Region"
          value={kpi.bestRegion}
          sub="Highest effectiveness"
          accent="bg-green-900/30 border-green-700"
        />
      </div>

      {/* ── Position Book ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity size={18} className="text-indigo-400" />
          Position Book — MtM &amp; Greeks
        </h2>
        <PositionTable positions={data.positions} />
      </section>

      {/* ── Basis Risk ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-400" />
          Basis Risk — Cross-Region Analysis
        </h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <BasisRiskTable basis={data.basis_risk} />
          <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4 space-y-2">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Average Correlation by Region Pair</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={basisChartData} margin={{ top: 8, right: 16, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="pair"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={v => v.toFixed(2)}
                />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0', fontSize: 12 }}
                  formatter={(v: number) => [v.toFixed(3), 'Correlation']}
                />
                <Bar dataKey="correlation" fill="#6366f1" radius={[4, 4, 0, 0]} name="Correlation" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── P&L Attribution ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <DollarSign size={18} className="text-emerald-400" />
          P&amp;L Attribution — Physical vs Hedge (2024, All Portfolios)
        </h2>
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={pnlChartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={v => `$${v.toFixed(0)}m`}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0', fontSize: 12 }}
                formatter={(v: number) => [`$${v.toFixed(2)}m`]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Bar dataKey="physical" name="Physical P&L" fill="#6366f1" stackId="pnl" radius={[0, 0, 0, 0]} />
              <Bar dataKey="hedge"    name="Hedge P&L"    fill="#10b981" stackId="pnl" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly detail table */}
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm text-slate-300">
            <thead className="bg-slate-800/80 text-xs text-slate-400 uppercase">
              <tr>
                {['Month', 'Portfolio', 'Physical P&L', 'Hedge P&L', 'Net P&L', 'Hedge Ratio %',
                  'VaR 95% $m', 'CVaR 95% $m', 'Realised Vol'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.pnl_attribution.map((r: HEFPnLRecord, i: number) => (
                <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-3 py-2 font-mono text-slate-200">{r.month}</td>
                  <td className="px-3 py-2 font-mono text-indigo-300">{r.portfolio_id}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${r.physical_pnl_m >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtM(r.physical_pnl_m)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${r.hedge_pnl_m >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtM(r.hedge_pnl_m)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-bold ${r.net_pnl_m >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmtM(r.net_pnl_m)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.hedge_ratio_pct, 1)}%</td>
                  <td className="px-3 py-2 text-right font-mono text-rose-400">{fmtM(r.var_95_m)}</td>
                  <td className="px-3 py-2 text-right font-mono text-rose-300">{fmtM(r.cvar_95_m)}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400">{(r.realized_vol_annualized * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Hedge Ratio Analysis ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingUp size={18} className="text-cyan-400" />
          Hedge Ratio Analysis — Optimal vs Actual
        </h2>
        <HedgeRatioTable ratios={data.hedge_ratios} />
      </section>

      {/* ── Rolling Effectiveness ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield size={18} className="text-purple-400" />
          Rolling Hedge Effectiveness by Region (2021–2024)
        </h2>
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={rollingChartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis
                domain={[30, 100]}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0', fontSize: 12 }}
                formatter={(v: number) => [`${v.toFixed(1)}%`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              {allRegions.map(region => (
                <Line
                  key={region}
                  type="monotone"
                  dataKey={region}
                  stroke={REGION_COLORS[region] ?? '#94a3b8'}
                  strokeWidth={2}
                  dot={{ r: 4, fill: REGION_COLORS[region] ?? '#94a3b8' }}
                  activeDot={{ r: 6 }}
                  name={region}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Rolling performance detail table */}
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm text-slate-300">
            <thead className="bg-slate-800/80 text-xs text-slate-400 uppercase">
              <tr>
                {['Year', 'Region', 'Avg Spot $/MWh', 'Avg Hedge $/MWh', 'Hedge Premium %',
                  'Hedge Savings $m', 'Unhedged Cost $m', 'Hedged Cost $m', 'Effectiveness %'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rolling_performance.map((r: HEFRollingPerformanceRecord, i: number) => (
                <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-3 py-2 font-mono font-semibold text-slate-200">{r.year}</td>
                  <td className="px-3 py-2 font-semibold" style={{ color: REGION_COLORS[r.region] ?? '#94a3b8' }}>{r.region}</td>
                  <td className="px-3 py-2 text-right font-mono">${fmt(r.avg_annual_spot_price, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono">${fmt(r.avg_hedge_price, 2)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${r.hedge_premium_pct >= 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {r.hedge_premium_pct >= 0 ? '+' : ''}{fmt(r.hedge_premium_pct, 2)}%
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${r.hedge_savings_m >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtM(r.hedge_savings_m)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400">{fmtM(r.unhedged_cost_m)}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">{fmtM(r.hedged_cost_m)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${r.effectiveness_pct >= 70 ? 'bg-green-900/50 text-green-300' : r.effectiveness_pct >= 55 ? 'bg-amber-900/50 text-amber-300' : 'bg-red-900/50 text-red-300'}`}>
                      {fmt(r.effectiveness_pct, 1)}%
                    </span>
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
