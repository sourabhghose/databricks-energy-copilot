import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ZAxis, ResponsiveContainer, Cell,
} from 'recharts'
import { Shield } from 'lucide-react'
import {
  EPRMDashboard,
  getElectricityPriceRiskDashboard,
} from '../api/client'

const PRODUCT_COLORS: Record<string, string> = {
  Swap: '#6366f1',
  Cap: '#10b981',
  Floor: '#f59e0b',
  Collar: '#3b82f6',
  Futures: '#8b5cf6',
  PPA: '#ec4899',
}

const COMPLIANCE_COLORS: Record<string, string> = {
  Compliant: 'bg-emerald-500/20 text-emerald-300',
  Warning: 'bg-amber-500/20 text-amber-300',
  Breach: 'bg-red-500/20 text-red-300',
}

export default function ElectricityPriceRiskAnalytics() {
  const [data, setData] = useState<EPRMDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityPriceRiskDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading electricity price risk data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error loading data: {error ?? 'Unknown error'}
      </div>
    )
  }

  const { portfolios, hedges, var_records, scenarios, correlations, regulatory_capital, summary } = data

  // KPI values
  const totalOpenPos = summary['total_open_position_twh'] ?? 0
  const aggregateVar = summary['aggregate_var_95_m'] ?? 0
  const avgHedgeRatio = summary['avg_hedge_ratio_pct'] ?? 0
  const totalHedgeMw = summary['total_hedge_book_mw'] ?? 0

  // Chart 1: Portfolio VaR by entity (base vs stressed) — use first 8 portfolios
  const varChartData = portfolios.slice(0, 8).map(p => {
    const portVarRec = var_records.find(v => v.portfolio_id === p.portfolio_id)
    return {
      name: p.entity_name.replace(' Energy', '').replace(' Retail', '').replace(' Generation', ' Gen'),
      var_95: p.var_95_m,
      stressed_var: portVarRec ? portVarRec.stressed_var_m : Math.round(p.var_95_m * 2.2),
    }
  })

  // Chart 2: Scenario P&L — aggregate across portfolios for each scenario name
  const scenarioMap: Record<string, { pnl: number; hedge_benefit: number }> = {}
  scenarios.forEach(s => {
    if (!scenarioMap[s.scenario_name]) {
      scenarioMap[s.scenario_name] = { pnl: 0, hedge_benefit: 0 }
    }
    scenarioMap[s.scenario_name].pnl += s.portfolio_pnl_m
    scenarioMap[s.scenario_name].hedge_benefit += s.hedge_benefit_m
  })
  const scenarioChartData = Object.entries(scenarioMap).map(([name, vals]) => ({
    name,
    pnl: Math.round(vals.pnl * 10) / 10,
    hedge_benefit: Math.round(vals.hedge_benefit * 10) / 10,
  }))

  // Chart 3: Scatter — hedge effectiveness vs MTM value (bubble by volume)
  const scatterData = hedges.slice(0, 30).map(h => ({
    x: h.hedge_effectiveness_pct,
    y: h.mtm_value_m,
    z: h.volume_mw,
    product: h.product_type,
  }))

  // Chart 4: Correlations by |coeff|
  const corrChartData = correlations
    .sort((a, b) => Math.abs(b.correlation_coefficient) - Math.abs(a.correlation_coefficient))
    .slice(0, 12)
    .map(c => ({
      name: c.factor_pair.length > 22 ? c.factor_pair.slice(0, 21) + '…' : c.factor_pair,
      abs_corr: Math.round(Math.abs(c.correlation_coefficient) * 1000) / 1000,
      significant: c.statistical_significance,
    }))

  // Table 1: Top hedges by |MTM|
  const topHedges = [...hedges]
    .sort((a, b) => Math.abs(b.mtm_value_m) - Math.abs(a.mtm_value_m))
    .slice(0, 10)

  // Table 2: Regulatory capital
  const regCapSorted = [...regulatory_capital].sort((a, b) => {
    const order: Record<string, number> = { Breach: 0, Warning: 1, Compliant: 2 }
    return (order[a.compliance_status] ?? 2) - (order[b.compliance_status] ?? 2)
  })

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield size={28} className="text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Electricity Price Risk Management Analytics</h1>
          <p className="text-sm text-gray-400">Portfolio VaR, hedge book analysis, scenario stress testing &amp; regulatory capital</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Open Position</p>
          <p className="text-2xl font-bold text-violet-300 mt-1">{totalOpenPos.toFixed(2)} TWh</p>
          <p className="text-xs text-gray-500 mt-1">Net unhedged exposure</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Aggregate VaR 95%</p>
          <p className="text-2xl font-bold text-red-300 mt-1">${aggregateVar.toFixed(1)}M</p>
          <p className="text-xs text-gray-500 mt-1">Portfolio-level value at risk</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Avg Hedge Ratio</p>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{avgHedgeRatio.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">Across all portfolios</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Hedge Book</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">{totalHedgeMw.toLocaleString()} MW</p>
          <p className="text-xs text-gray-500 mt-1">Notional volume hedged</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: VaR by Entity */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Portfolio VaR by Entity (Base vs Stressed)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={varChartData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}M`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(val: number) => [`$${val.toFixed(1)}M`, '']}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="var_95" name="VaR 95%" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="stressed_var" name="Stressed VaR" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart: Scenario P&L */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Scenario P&amp;L Impact (Aggregated Portfolios)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={scenarioChartData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}M`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(val: number) => [`$${val.toFixed(1)}M`, '']}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="pnl" name="Portfolio P&L" radius={[3, 3, 0, 0]}>
                {scenarioChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
              <Bar dataKey="hedge_benefit" name="Hedge Benefit" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scatter: Hedge Effectiveness vs MTM */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Hedge Effectiveness vs MTM Value (bubble = volume)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="x" type="number" name="Effectiveness %" domain={[60, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Effectiveness %', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 11 }} />
              <YAxis dataKey="y" type="number" name="MTM $M" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}M`} />
              <ZAxis dataKey="z" range={[40, 400]} name="Volume MW" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                formatter={(val: number, name: string) => {
                  if (name === 'Effectiveness %') return [`${val.toFixed(1)}%`, name]
                  if (name === 'MTM $M') return [`$${val.toFixed(2)}M`, name]
                  return [`${val} MW`, name]
                }}
              />
              <Scatter data={scatterData} fill="#6366f1">
                {scatterData.map((entry, index) => (
                  <Cell key={`sc-${index}`} fill={PRODUCT_COLORS[entry.product] ?? '#6366f1'} fillOpacity={0.75} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(PRODUCT_COLORS).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
                {type}
              </span>
            ))}
          </div>
        </div>

        {/* Bar: Correlation factors */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Energy Factor Correlations (|coefficient|)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={corrChartData} layout="vertical" margin={{ top: 5, right: 20, left: 140, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" domain={[0, 1]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={138} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                formatter={(val: number) => [val.toFixed(3), '|Correlation|']}
              />
              <Bar dataKey="abs_corr" name="|Correlation|" radius={[0, 3, 3, 0]}>
                {corrChartData.map((entry, index) => (
                  <Cell key={`corr-${index}`} fill={entry.significant ? '#6366f1' : '#4b5563'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-1">Purple = statistically significant; grey = not significant</p>
        </div>
      </div>

      {/* Table 1: Top Hedge Positions */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Top Hedge Positions by MTM Value</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-2 pr-3">Hedge ID</th>
                <th className="text-left py-2 pr-3">Portfolio</th>
                <th className="text-left py-2 pr-3">Product</th>
                <th className="text-left py-2 pr-3">Region</th>
                <th className="text-right py-2 pr-3">Volume (MW)</th>
                <th className="text-right py-2 pr-3">Strike ($/MWh)</th>
                <th className="text-right py-2 pr-3">Market ($/MWh)</th>
                <th className="text-right py-2 pr-3">MTM ($M)</th>
                <th className="text-right py-2 pr-3">Effectiveness</th>
                <th className="text-left py-2">Counterparty</th>
              </tr>
            </thead>
            <tbody>
              {topHedges.map(h => (
                <tr key={h.hedge_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-3 font-mono text-gray-400">{h.hedge_id}</td>
                  <td className="py-2 pr-3">{h.portfolio_id}</td>
                  <td className="py-2 pr-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: (PRODUCT_COLORS[h.product_type] ?? '#6366f1') + '33', color: PRODUCT_COLORS[h.product_type] ?? '#6366f1' }}
                    >
                      {h.product_type}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{h.region}</td>
                  <td className="py-2 pr-3 text-right">{h.volume_mw.toFixed(0)}</td>
                  <td className="py-2 pr-3 text-right">${h.strike_price_dolpermwh.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right">${h.market_price_dolpermwh.toFixed(2)}</td>
                  <td className={`py-2 pr-3 text-right font-semibold ${h.mtm_value_m >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {h.mtm_value_m >= 0 ? '+' : ''}{h.mtm_value_m.toFixed(2)}
                  </td>
                  <td className="py-2 pr-3 text-right">{h.hedge_effectiveness_pct.toFixed(1)}%</td>
                  <td className="py-2 text-gray-400">{h.counterparty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: Regulatory Capital Status */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Regulatory Capital Status</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-2 pr-3">Entity</th>
                <th className="text-left py-2 pr-3">Framework</th>
                <th className="text-right py-2 pr-3">Required ($M)</th>
                <th className="text-right py-2 pr-3">Current ($M)</th>
                <th className="text-right py-2 pr-3">Coverage</th>
                <th className="text-right py-2 pr-3">Liquidity Buffer ($M)</th>
                <th className="text-right py-2 pr-3">Stressed Req ($M)</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2">Review Date</th>
              </tr>
            </thead>
            <tbody>
              {regCapSorted.map(r => (
                <tr key={r.capital_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-3 font-medium">{r.entity_name}</td>
                  <td className="py-2 pr-3 text-gray-400">{r.regulatory_framework}</td>
                  <td className="py-2 pr-3 text-right">${r.capital_requirement_m.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right">${r.current_capital_m.toFixed(1)}</td>
                  <td className={`py-2 pr-3 text-right font-semibold ${r.coverage_ratio_pct >= 105 ? 'text-emerald-400' : r.coverage_ratio_pct >= 90 ? 'text-amber-400' : 'text-red-400'}`}>
                    {r.coverage_ratio_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-3 text-right">${r.liquidity_buffer_m.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right">${r.stressed_requirement_m.toFixed(1)}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${COMPLIANCE_COLORS[r.compliance_status] ?? 'bg-gray-700 text-gray-300'}`}>
                      {r.compliance_status}
                    </span>
                  </td>
                  <td className="py-2 text-gray-400">{r.review_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
