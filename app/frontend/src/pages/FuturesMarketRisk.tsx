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
  ScatterChart,
  Scatter,
  ZAxis,
  LineChart,
  Line,
} from 'recharts'
import { Activity, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  api,
  FuturesMarketRiskDashboard,
  VaRRecord,
  FMRHedgeEffectivenessRecord,
  BasisRiskRecord,
  FuturesPositionRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

const INSTRUMENT_COLORS: Record<string, string> = {
  FUTURES: '#3b82f6',
  SWAP: '#06b6d4',
  CAP: '#f59e0b',
  FLOOR: '#14b8a6',
  COLLAR: '#a855f7',
  PPA: '#22c55e',
}

const PARTICIPANT_TYPE_COLORS: Record<string, string> = {
  GENERATOR: '#ef4444',
  RETAILER: '#3b82f6',
  GENTAILER: '#a855f7',
  FINANCIAL: '#6b7280',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtM(v: number): string {
  return `$${v.toFixed(1)}M`
}

function fmtMWh(v: number): string {
  return `${v.toFixed(1)} $/MWh`
}

function fmtMW(v: number): string {
  return `${v.toFixed(0)} MW`
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

function basisColor(basis: number): string {
  if (basis < -10) return 'bg-red-700 text-white'
  if (basis < -3) return 'bg-red-400 text-white'
  if (basis < 3) return 'bg-gray-400 text-white'
  if (basis < 10) return 'bg-green-400 text-white'
  if (basis < 20) return 'bg-green-600 text-white'
  return 'bg-green-800 text-white'
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  subtitle,
  highlight,
}: {
  title: string
  value: string
  subtitle: string
  highlight?: 'red' | 'amber' | 'green' | 'blue'
}) {
  const highlightClass =
    highlight === 'red'
      ? 'text-red-400'
      : highlight === 'amber'
      ? 'text-amber-400'
      : highlight === 'green'
      ? 'text-green-400'
      : 'text-blue-400'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
        {title}
      </p>
      <p className={`text-2xl font-bold ${highlightClass}`}>{value}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Instrument Badge
// ---------------------------------------------------------------------------

function InstrumentBadge({ instrument }: { instrument: string }) {
  const color = INSTRUMENT_COLORS[instrument] ?? '#6b7280'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: color + '22', color }}
    >
      {instrument}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Participant Type Badge
// ---------------------------------------------------------------------------

function ParticipantTypeBadge({ type }: { type: string }) {
  const color = PARTICIPANT_TYPE_COLORS[type] ?? '#6b7280'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: color + '22', color }}
    >
      {type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// VaR Chart — grouped bars (var_95, var_99) + CVaR line
// ---------------------------------------------------------------------------

function VaRChart({ records }: { records: VaRRecord[] }) {
  // Aggregate by region
  const byRegion: Record<string, { var95: number; var99: number; cvar95: number }> = {}
  for (const r of records) {
    if (!byRegion[r.region]) byRegion[r.region] = { var95: 0, var99: 0, cvar95: 0 }
    byRegion[r.region].var95 += r.var_95_m_aud
    byRegion[r.region].var99 += r.var_99_m_aud
    byRegion[r.region].cvar95 += r.cvar_95_m_aud
  }

  const data = REGIONS.filter((r) => byRegion[r]).map((r) => ({
    region: r,
    'VaR 95%': +byRegion[r].var95.toFixed(2),
    'VaR 99%': +byRegion[r].var99.toFixed(2),
    'CVaR 95%': +byRegion[r].cvar95.toFixed(2),
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Value-at-Risk by Region
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 50, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickFormatter={(v) => `$${v}M`}
            label={{ value: '$ M AUD', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: '#f97316' }}
            tickFormatter={(v) => `$${v}M`}
            label={{ value: 'CVaR ($M)', angle: 90, position: 'insideRight', fill: '#f97316', fontSize: 10 }}
          />
          <Tooltip
            formatter={(value: number, name: string) => [`$${value.toFixed(2)}M`, name]}
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', fontSize: 12 }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="VaR 95%" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar yAxisId="left" dataKey="VaR 99%" fill="#ef4444" radius={[3, 3, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="CVaR 95%"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 4, fill: '#f97316' }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hedge Effectiveness Scatter Plot
// ---------------------------------------------------------------------------

function HedgeEffectivenessChart({ records }: { records: FMRHedgeEffectivenessRecord[] }) {
  // Group by instrument for separate scatter series
  const byInstrument: Record<string, { x: number; y: number; z: number; participant: string; quarter: string }[]> = {}
  for (const r of records) {
    if (!byInstrument[r.hedge_instrument]) byInstrument[r.hedge_instrument] = []
    byInstrument[r.hedge_instrument].push({
      x: r.hedge_ratio_pct,
      y: r.effectiveness_score_pct,
      z: Math.abs(r.hedge_gain_loss_m_aud) * 40 + 200,
      participant: r.participant,
      quarter: r.quarter,
    })
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Hedge Effectiveness vs Hedge Ratio
      </h3>
      <p className="text-xs text-gray-400 mb-3">
        Bubble size proportional to absolute gain/loss. X = hedge ratio %, Y = effectiveness %.
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            type="number"
            dataKey="x"
            name="Hedge Ratio %"
            domain={[55, 100]}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            label={{ value: 'Hedge Ratio (%)', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Effectiveness %"
            domain={[65, 100]}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            label={{ value: 'Effectiveness (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
          />
          <ZAxis type="number" dataKey="z" range={[60, 400]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ payload }) => {
              if (!payload || !payload.length) return null
              const d = payload[0].payload
              const instr = Object.entries(byInstrument).find(([, arr]) =>
                arr.some((p) => p.x === d.x && p.y === d.y)
              )
              return (
                <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs text-gray-200">
                  <p>{d.participant} ({d.quarter})</p>
                  <p>Hedge Ratio: {d.x.toFixed(1)}%</p>
                  <p>Effectiveness: {d.y.toFixed(1)}%</p>
                  {instr && <p>Instrument: {instr[0]}</p>}
                </div>
              )
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {Object.entries(byInstrument).map(([instr, pts]) => (
            <Scatter
              key={instr}
              name={instr}
              data={pts}
              fill={INSTRUMENT_COLORS[instr] ?? '#6b7280'}
              fillOpacity={0.75}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Basis Risk Heatmap (table-based)
// ---------------------------------------------------------------------------

function BasisRiskHeatmap({ records }: { records: BasisRiskRecord[] }) {
  const map: Record<string, Record<string, number>> = {}
  for (const r of records) {
    if (!map[r.region]) map[r.region] = {}
    map[r.region][r.quarter] = r.basis_aud_mwh
  }

  const regions = REGIONS.filter((r) => map[r])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Basis Risk Heatmap — Basis ($/MWh) by Region x Quarter
      </h3>
      <p className="text-xs text-gray-400 mb-3">
        Negative = futures settled below spot (retailer overpaid for hedge). Positive = futures above spot.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 dark:text-gray-400">
              <th className="text-left py-2 pr-4">Region</th>
              {QUARTERS.map((q) => (
                <th key={q} className="text-center py-2 px-3">
                  {q} 2024
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regions.map((region) => (
              <tr key={region} className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-2 pr-4 font-medium text-gray-700 dark:text-gray-200 text-sm">
                  {region}
                </td>
                {QUARTERS.map((q) => {
                  const v = map[region]?.[q]
                  if (v === undefined) {
                    return (
                      <td key={q} className="text-center py-2 px-3 text-gray-400 text-xs">
                        —
                      </td>
                    )
                  }
                  return (
                    <td key={q} className="text-center py-1.5 px-2">
                      <span
                        className={`inline-block w-20 py-1 rounded text-xs font-semibold ${basisColor(v)}`}
                      >
                        {v > 0 ? '+' : ''}
                        {v.toFixed(1)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 mt-4 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-4 h-4 rounded bg-red-700 inline-block" /> Strong negative (&lt; -10)
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-4 h-4 rounded bg-red-400 inline-block" /> Negative (-3 to -10)
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-4 h-4 rounded bg-gray-400 inline-block" /> Near zero (-3 to +3)
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-4 h-4 rounded bg-green-400 inline-block" /> Positive (+3 to +10)
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-4 h-4 rounded bg-green-800 inline-block" /> Strong positive (&gt; +20)
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Futures Positions Table
// ---------------------------------------------------------------------------

function FuturesPositionsTable({ records }: { records: FuturesPositionRecord[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Futures Positions
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-3">Participant</th>
              <th className="text-left py-2 pr-3">Type</th>
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-left py-2 pr-3">Quarter</th>
              <th className="text-right py-2 pr-3">Long (MW)</th>
              <th className="text-right py-2 pr-3">Short (MW)</th>
              <th className="text-right py-2 pr-3">Net (MW)</th>
              <th className="text-right py-2 pr-3">Avg Entry</th>
              <th className="text-right py-2 pr-3">MTM ($M)</th>
              <th className="text-right py-2">Margin ($M)</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-200">{r.participant}</td>
                <td className="py-2 pr-3">
                  <ParticipantTypeBadge type={r.participant_type} />
                </td>
                <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{r.region}</td>
                <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{r.contract_quarter}</td>
                <td className="py-2 pr-3 text-right text-blue-500">{fmtMW(r.long_position_mw)}</td>
                <td className="py-2 pr-3 text-right text-red-400">{fmtMW(r.short_position_mw)}</td>
                <td
                  className={`py-2 pr-3 text-right font-semibold ${
                    r.net_position_mw >= 0 ? 'text-green-500' : 'text-red-400'
                  }`}
                >
                  {r.net_position_mw >= 0 ? '+' : ''}
                  {fmtMW(r.net_position_mw)}
                </td>
                <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-300">
                  ${r.avg_entry_price.toFixed(1)}
                </td>
                <td
                  className={`py-2 pr-3 text-right font-semibold ${
                    r.mark_to_market_m_aud >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {r.mark_to_market_m_aud >= 0 ? '+' : ''}
                  {fmtM(r.mark_to_market_m_aud)}
                </td>
                <td className="py-2 text-right text-gray-600 dark:text-gray-300">
                  {fmtM(r.margin_posted_m_aud)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hedge Effectiveness Detail Table
// ---------------------------------------------------------------------------

function HedgeEffectivenessTable({ records }: { records: FMRHedgeEffectivenessRecord[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Hedge Effectiveness Detail
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-3">Participant</th>
              <th className="text-left py-2 pr-3">Quarter</th>
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-right py-2 pr-3">Hedge Ratio</th>
              <th className="text-left py-2 pr-3">Instrument</th>
              <th className="text-right py-2 pr-3">Hedge $</th>
              <th className="text-right py-2 pr-3">Spot $</th>
              <th className="text-right py-2 pr-3">Gain/Loss</th>
              <th className="text-right py-2 pr-3">Effectiveness</th>
              <th className="text-right py-2">Basis Risk</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-200">{r.participant}</td>
                <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{r.quarter}</td>
                <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{r.region}</td>
                <td className="py-2 pr-3 text-right text-blue-400 font-semibold">
                  {fmtPct(r.hedge_ratio_pct)}
                </td>
                <td className="py-2 pr-3">
                  <InstrumentBadge instrument={r.hedge_instrument} />
                </td>
                <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-300">
                  ${r.avg_hedge_price.toFixed(1)}
                </td>
                <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-300">
                  ${r.avg_spot_price.toFixed(1)}
                </td>
                <td
                  className={`py-2 pr-3 text-right font-semibold ${
                    r.hedge_gain_loss_m_aud >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {r.hedge_gain_loss_m_aud >= 0 ? '+' : ''}
                  {fmtM(r.hedge_gain_loss_m_aud)}
                </td>
                <td
                  className={`py-2 pr-3 text-right font-semibold ${
                    r.effectiveness_score_pct >= 85 ? 'text-green-400' : r.effectiveness_score_pct >= 75 ? 'text-amber-400' : 'text-red-400'
                  }`}
                >
                  {fmtPct(r.effectiveness_score_pct)}
                </td>
                <td
                  className={`py-2 text-right ${
                    r.basis_risk_m_aud > 2.5 ? 'text-red-400' : r.basis_risk_m_aud > 1.0 ? 'text-amber-400' : 'text-green-400'
                  }`}
                >
                  {fmtM(r.basis_risk_m_aud)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function FuturesMarketRisk() {
  const [dashboard, setDashboard] = useState<FuturesMarketRiskDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getFuturesMarketRiskDashboard()
      setDashboard(data)
    } catch (e) {
      setError('Failed to load Futures Market Risk data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Activity className="text-indigo-400" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Electricity Futures Market Risk Analytics
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              ASX electricity futures — value-at-risk, hedge effectiveness, basis risk and portfolio risk
              metrics for energy retailers and gentailers
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !dashboard && (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
          Loading futures market risk data...
        </div>
      )}

      {dashboard && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Portfolio VaR 95%"
              value={fmtM(dashboard.portfolio_var_95_m_aud)}
              subtitle="1-day 95% Value-at-Risk, all regions"
              highlight="red"
            />
            <KpiCard
              title="Avg Hedge Ratio"
              value={fmtPct(dashboard.avg_hedge_ratio_pct)}
              subtitle="Average % of load/generation hedged"
              highlight="blue"
            />
            <KpiCard
              title="Total Open Interest"
              value={fmtMW(dashboard.total_open_interest_mw)}
              subtitle="Long + short positions across all participants"
              highlight="green"
            />
            <KpiCard
              title="Avg Basis Risk"
              value={fmtMWh(dashboard.avg_basis_risk_aud_mwh)}
              subtitle="Average absolute basis (futures vs spot)"
              highlight="amber"
            />
          </div>

          {/* VaR Chart */}
          <VaRChart records={dashboard.var_records} />

          {/* Hedge Effectiveness Chart */}
          <HedgeEffectivenessChart records={dashboard.hedge_effectiveness} />

          {/* Basis Risk Heatmap */}
          <BasisRiskHeatmap records={dashboard.basis_risk} />

          {/* Futures Positions Table */}
          <FuturesPositionsTable records={dashboard.futures_positions} />

          {/* Hedge Effectiveness Detail Table */}
          <HedgeEffectivenessTable records={dashboard.hedge_effectiveness} />

          {/* Footer timestamp */}
          <p className="text-xs text-gray-400 text-right">
            Data as of {new Date(dashboard.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
          </p>
        </>
      )}
    </div>
  )
}
