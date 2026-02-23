import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  Cell,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import {
  getEnergyCommodityTradingDashboard,
  ECTADashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const DESK_COLOURS: Record<string, string> = {
  'NEM Spot Desk':      '#3b82f6',
  'Gas Desk':           '#f59e0b',
  'Carbon Desk':        '#10b981',
  'Structured Products':'#8b5cf6',
  'Renewable Desk':     '#ec4899',
}

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#10b981',
  SA1:  '#ef4444',
  TAS1: '#8b5cf6',
}

const PRODUCT_COLOURS: Record<string, string> = {
  'Base Swap': '#3b82f6',
  'Peak Swap': '#f59e0b',
  'Cap':       '#10b981',
  'Floor':     '#ef4444',
  'CfD':       '#8b5cf6',
  'Strip':     '#ec4899',
}

const DIRECTION_COLOURS: Record<string, string> = {
  Buy:  '#10b981',
  Sell: '#ef4444',
}

const DESK_LINE_COLOURS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-medium">
        <TrendingUp size={16} />
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EnergyCommodityTradingAnalytics() {
  const [data, setData] = useState<ECTADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyCommodityTradingDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Energy Commodity Trading Desk Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>

  // ── Chart 1: Bar — mark_to_market_m by desk coloured by region ────────────
  const chart1Data = data.positions.map((p) => ({
    name: `${p.trader_desk} / ${p.region}`,
    desk: p.trader_desk,
    region: p.region,
    mark_to_market_m: p.mark_to_market_m,
  }))

  // ── Chart 2: Line — total_pnl_m by month for 5 desks ─────────────────────
  const desks = ['NEM Spot Desk', 'Gas Desk', 'Carbon Desk', 'Structured Products', 'Renewable Desk']
  const months = Array.from(new Set(data.pnl.map((r) => r.month))).sort()
  const pnlByMonthDesk: Record<string, Record<string, number>> = {}
  for (const rec of data.pnl) {
    if (!pnlByMonthDesk[rec.month]) pnlByMonthDesk[rec.month] = {}
    pnlByMonthDesk[rec.month][rec.desk] = rec.total_pnl_m
  }
  const chart2Data = months.map((m) => ({ month: m, ...(pnlByMonthDesk[m] ?? {}) }))

  // ── Chart 3: Bar — var_99_m by desk × quarter (top 8 quarters) ────────────
  const topQuarters = Array.from(new Set(data.risk_metrics.map((r) => r.quarter)))
    .sort()
    .slice(-8)
  const varByDeskQuarter: Record<string, Record<string, number>> = {}
  for (const rm of data.risk_metrics) {
    if (!topQuarters.includes(rm.quarter)) continue
    if (!varByDeskQuarter[rm.quarter]) varByDeskQuarter[rm.quarter] = {}
    varByDeskQuarter[rm.quarter][rm.desk] =
      (varByDeskQuarter[rm.quarter][rm.desk] ?? 0) + rm.var_99_m
  }
  const chart3Data = topQuarters.map((q) => ({ quarter: q, ...(varByDeskQuarter[q] ?? {}) }))

  // ── Chart 4: Scatter — implied_volatility_pct vs daily_volume_mwh ─────────
  const chart4Data = data.market_structure.map((ms) => ({
    product: ms.product,
    region: ms.region,
    implied_volatility_pct: ms.implied_volatility_pct,
    daily_volume_mwh: ms.daily_volume_mwh,
  }))

  // ── Chart 5: Bar — total_value_m by counterparty_type × direction ─────────
  const cpTypes = ['Exchange', 'OTC Bilateral', 'Broker']
  const tradeValueByCpDir: Record<string, Record<string, number>> = {}
  for (const t of data.trades) {
    if (!tradeValueByCpDir[t.counterparty_type]) tradeValueByCpDir[t.counterparty_type] = {}
    tradeValueByCpDir[t.counterparty_type][t.direction] =
      (tradeValueByCpDir[t.counterparty_type][t.direction] ?? 0) + t.total_value_m
  }
  const chart5Data = cpTypes.map((cp) => ({
    name: cp,
    Buy:  Number((tradeValueByCpDir[cp]?.['Buy']  ?? 0).toFixed(2)),
    Sell: Number((tradeValueByCpDir[cp]?.['Sell'] ?? 0).toFixed(2)),
  }))

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingUp size={28} className="text-blue-500 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Energy Commodity Trading Desk Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sprint 130a — ECTA | Positions, PnL, Risk Metrics &amp; Market Structure
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Position"
          value={`${Number(summary['total_position_mw']).toLocaleString()} MW`}
          sub="Net long / short across all desks"
        />
        <KpiCard
          label="Total VaR (1-day)"
          value={`$${Number(summary['total_var_m']).toFixed(1)}M`}
          sub="Aggregate portfolio value-at-risk"
        />
        <KpiCard
          label="Best Performing Desk"
          value={String(summary['best_performing_desk'])}
          sub="Highest cumulative total PnL"
        />
        <KpiCard
          label="Total Trading PnL"
          value={`$${Number(summary['total_trading_pnl_m']).toFixed(1)}M`}
          sub="Sum of trading PnL across all desks"
        />
      </div>

      {/* Chart 1 — Mark-to-Market by Desk & Region */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Mark-to-Market ($M) by Desk &amp; Region
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chart1Data} margin={{ top: 10, right: 20, left: 0, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} unit="M" />
            <Tooltip formatter={(val: number) => [`$${val.toFixed(2)}M`, 'MtM']} />
            <Bar dataKey="mark_to_market_m" name="Mark-to-Market ($M)" radius={[4, 4, 0, 0]}>
              {chart1Data.map((entry, idx) => (
                <Cell key={idx} fill={REGION_COLOURS[entry.region] ?? '#6b7280'} />
              ))}
            </Bar>
            <Legend
              payload={Object.entries(REGION_COLOURS).map(([name, color]) => ({
                value: name,
                type: 'square' as const,
                color,
              }))}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2 — Total PnL by Month for 5 Desks */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Total PnL ($M) by Month — All Desks
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart2Data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} unit="M" />
            <Tooltip formatter={(val: number) => [`$${Number(val).toFixed(2)}M`]} />
            <Legend />
            {desks.map((desk, i) => (
              <Line
                key={desk}
                type="monotone"
                dataKey={desk}
                stroke={DESK_LINE_COLOURS[i]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3 — VaR 99% by Desk × Quarter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          VaR 99% ($M) by Desk &amp; Quarter (Last 8 Quarters)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart3Data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="M" />
            <Tooltip formatter={(val: number) => [`$${Number(val).toFixed(2)}M`, 'VaR 99%']} />
            <Legend />
            {desks.map((desk, i) => (
              <Bar
                key={desk}
                dataKey={desk}
                stackId="var"
                fill={DESK_LINE_COLOURS[i]}
                name={desk}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — Scatter: Implied Volatility vs Daily Volume */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Implied Volatility (%) vs Daily Volume (MWh) — by Product
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="daily_volume_mwh"
              type="number"
              name="Daily Volume (MWh)"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              dataKey="implied_volatility_pct"
              type="number"
              name="Implied Volatility (%)"
              tick={{ fontSize: 11 }}
              unit="%"
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(val: number, name: string) =>
                name === 'Daily Volume (MWh)'
                  ? [`${val.toLocaleString()} MWh`, name]
                  : [`${val}%`, name]
              }
            />
            <Legend
              payload={Object.entries(PRODUCT_COLOURS).map(([name, color]) => ({
                value: name,
                type: 'circle' as const,
                color,
              }))}
            />
            {Object.keys(PRODUCT_COLOURS).map((product) => {
              const points = chart4Data.filter((d) => d.product === product)
              return (
                <Scatter
                  key={product}
                  name={product}
                  data={points}
                  fill={PRODUCT_COLOURS[product]}
                />
              )
            })}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 — Total Value by Counterparty Type × Direction */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Total Trade Value ($M) by Counterparty Type &amp; Direction
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart5Data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="M" />
            <Tooltip formatter={(val: number) => [`$${Number(val).toFixed(2)}M`]} />
            <Legend />
            <Bar dataKey="Buy"  name="Buy"  fill={DIRECTION_COLOURS['Buy']}  radius={[4, 4, 0, 0]} />
            <Bar dataKey="Sell" name="Sell" fill={DIRECTION_COLOURS['Sell']} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Portfolio Summary
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
          {Object.entries(summary).map(([key, val]) => (
            <div key={key}>
              <dt className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 dark:text-white">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
