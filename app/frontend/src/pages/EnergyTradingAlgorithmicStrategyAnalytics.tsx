import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import {
  ScatterChart, Scatter, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ZAxis, Cell, ReferenceLine,
} from 'recharts'
import { getEnergyTradingAlgorithmicStrategyDashboard, ETASDashboard } from '../api/client'

const STRATEGY_COLOURS: Record<string, string> = {
  'Mean Reversion':       '#6366f1',
  'Momentum':             '#f59e0b',
  'Statistical Arbitrage':'#10b981',
  'Spread Trading':       '#3b82f6',
  'ML Dispatch':          '#ec4899',
  'Volatility':           '#8b5cf6',
  'Basis Trading':        '#14b8a6',
  'Calendar Spread':      '#f97316',
}

const VENUE_COLOURS: Record<string, string> = {
  'AEMO Dispatch': '#6366f1',
  'ASX':           '#f59e0b',
  'OTC':           '#10b981',
  'Bilateral':     '#ec4899',
}

function KPICard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

export default function EnergyTradingAlgorithmicStrategyAnalytics() {
  const [data, setData] = useState<ETASDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyTradingAlgorithmicStrategyDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <div className="p-8 text-red-600">Error: {error}</div>
  if (!data)  return <div className="p-8 text-gray-500">Loading...</div>

  const { strategies, performance, risk, market_signals, backtests, execution, summary } = data

  // --- Chart 1: Strategy Risk-Return Scatter ---
  const riskReturnData = strategies.map(s => ({
    x: s.max_drawdown_pct,
    y: s.annualised_return_pct,
    z: Math.max(s.sharpe_ratio * 40, 40),
    name: s.strategy_name,
    type: s.strategy_type,
  }))

  // --- Chart 2: Cumulative P&L by month for top 4 strategies ---
  const top4Ids = Array.from(new Set(performance.map(p => p.strategy_id))).slice(0, 4)
  const monthSet = Array.from(new Set(performance.map(p => p.month))).sort()
  const cumPnlRows = monthSet.map(month => {
    const row: Record<string, string | number> = { month }
    top4Ids.forEach(sid => {
      const perf = performance.filter(p => p.strategy_id === sid && p.month <= month)
      row[sid] = parseFloat(perf.reduce((acc, p) => acc + p.net_pnl_m, 0).toFixed(3))
    })
    return row
  })
  const lineColours = ['#6366f1', '#f59e0b', '#10b981', '#ec4899']

  // --- Chart 3: Market Signal Accuracy by signal_type ---
  const signalTypeMap: Record<string, { accuracy: number[]; confidence: number[] }> = {}
  market_signals.forEach(s => {
    if (!signalTypeMap[s.signal_type]) signalTypeMap[s.signal_type] = { accuracy: [], confidence: [] }
    signalTypeMap[s.signal_type].accuracy.push(s.accuracy_historical_pct)
    signalTypeMap[s.signal_type].confidence.push(s.ml_confidence_pct)
  })
  const signalAccuracyData = Object.entries(signalTypeMap).map(([type, vals]) => ({
    signal_type: type.length > 12 ? type.slice(0, 12) + '…' : type,
    accuracy_pct: parseFloat((vals.accuracy.reduce((a, b) => a + b, 0) / vals.accuracy.length).toFixed(1)),
    confidence_pct: parseFloat((vals.confidence.reduce((a, b) => a + b, 0) / vals.confidence.length).toFixed(1)),
  }))

  // --- Chart 4: Backtest Comparison grouped bar ---
  const backtestChartData = backtests.slice(0, 10).map(bt => ({
    name: bt.strategy_name.length > 14 ? bt.strategy_name.slice(0, 14) + '…' : bt.strategy_name,
    sharpe: bt.sharpe_ratio,
    calmar: bt.calmar_ratio,
  }))

  // --- Chart 5: Execution Quality scatter (slippage vs volume) ---
  const execQualityData = execution.map(e => ({
    x: e.volume_mwh,
    y: e.slippage_bps,
    venue: e.venue,
    name: e.order_type,
  }))

  // --- Chart 6: Risk Utilisation horizontal bar ---
  const riskChartData = risk.map(r => ({
    metric: r.risk_metric,
    utilisation: r.utilisation_pct,
    breach: r.breach_count_ytd,
  }))

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-100">
          <TrendingUp className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Energy Trading Algorithmic Strategy Analytics</h1>
          <p className="text-sm text-gray-500">Quantitative strategy performance, risk attribution and execution quality</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Strategies"
          value={String(summary.total_strategies)}
          sub="Live algorithmic strategies"
        />
        <KPICard
          title="Avg Sharpe Ratio"
          value={String(summary.avg_sharpe_ratio)}
          sub="Risk-adjusted return"
        />
        <KPICard
          title="Total YTD P&L"
          value={`$${summary.total_ytd_pnl_m}M`}
          sub="Net after costs & slippage"
        />
        <KPICard
          title="Avg Win Rate"
          value={`${summary.avg_win_rate_pct}%`}
          sub="Across all strategies"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 1: Strategy Risk-Return */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Strategy Risk-Return (sized by Sharpe)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" name="Max Drawdown (%)" label={{ value: 'Max Drawdown %', position: 'insideBottom', offset: -5 }} />
              <YAxis dataKey="y" name="Annualised Return (%)" label={{ value: 'Ann. Return %', angle: -90, position: 'insideLeft' }} />
              <ZAxis dataKey="z" range={[40, 300]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                if (!payload?.length) return null
                const d = payload[0].payload
                return (
                  <div className="bg-white border border-gray-200 rounded p-2 text-xs shadow">
                    <p className="font-semibold">{d.name}</p>
                    <p>Type: {d.type}</p>
                    <p>Return: {d.y}%</p>
                    <p>Drawdown: {d.x}%</p>
                  </div>
                )
              }} />
              {Object.entries(STRATEGY_COLOURS).map(([type, colour]) => (
                <Scatter
                  key={type}
                  name={type}
                  data={riskReturnData.filter(d => d.type === type)}
                  fill={colour}
                />
              ))}
              <Legend />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Cumulative P&L */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Cumulative Net P&L — Top 4 Strategies ($M)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={cumPnlRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              {top4Ids.map((sid, idx) => (
                <Line
                  key={sid}
                  type="monotone"
                  dataKey={sid}
                  stroke={lineColours[idx]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 3: Market Signal Accuracy */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Market Signal Accuracy by Type</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={signalAccuracyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="signal_type" tick={{ fontSize: 11 }} />
              <YAxis domain={[40, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="accuracy_pct" name="Historical Accuracy %" fill="#6366f1" />
              <Bar dataKey="confidence_pct" name="ML Confidence %" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Backtest Comparison */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Backtest Comparison — Sharpe &amp; Calmar Ratios</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={backtestChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sharpe" name="Sharpe Ratio" fill="#6366f1" />
              <Bar dataKey="calmar" name="Calmar Ratio" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 5: Execution Quality */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Execution Quality — Slippage vs Volume (by Venue)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" name="Volume (MWh)" label={{ value: 'Volume MWh', position: 'insideBottom', offset: -5 }} />
              <YAxis dataKey="y" name="Slippage (bps)" label={{ value: 'Slippage bps', angle: -90, position: 'insideLeft' }} />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" />
              <Tooltip content={({ payload }) => {
                if (!payload?.length) return null
                const d = payload[0].payload
                return (
                  <div className="bg-white border border-gray-200 rounded p-2 text-xs shadow">
                    <p className="font-semibold">{d.venue}</p>
                    <p>Volume: {d.x} MWh</p>
                    <p>Slippage: {d.y} bps</p>
                    <p>Order: {d.name}</p>
                  </div>
                )
              }} />
              {Object.entries(VENUE_COLOURS).map(([venue, colour]) => (
                <Scatter
                  key={venue}
                  name={venue}
                  data={execQualityData.filter(d => d.venue === venue)}
                  fill={colour}
                />
              ))}
              <Legend />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 6: Risk Utilisation */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Risk Utilisation by Metric (%)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={riskChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 120]} />
              <YAxis dataKey="metric" type="category" width={80} tick={{ fontSize: 11 }} />
              <ReferenceLine x={100} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Limit', fill: '#ef4444', fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="utilisation" name="Utilisation %" radius={[0, 3, 3, 0]}>
                {riskChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.utilisation >= 100 ? '#ef4444' : entry.utilisation >= 80 ? '#f59e0b' : '#10b981'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
