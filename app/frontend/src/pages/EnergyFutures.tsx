import React, { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Shield, DollarSign, RefreshCw } from 'lucide-react'
import { api, FuturesDashboard, FuturesContract, ForwardCurvePoint, HedgeEffectivenessRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: number, decimals = 2): string {
  return `$${v.toFixed(decimals)}`
}

function fmtChange(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}$${v.toFixed(2)}`
}

function fmtOI(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M MWh`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k MWh`
  return `${v} MWh`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MarketSummaryPill({
  label,
  price,
  change,
}: {
  label: string
  price: number
  change: number
}) {
  const isUp = change >= 0
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-bold text-gray-900 dark:text-white">
        {fmt(price)}
      </span>
      <span
        className={`flex items-center gap-0.5 text-xs font-semibold ${
          isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}
      >
        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {fmtChange(change)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Forward Curve Chart
// ---------------------------------------------------------------------------

function ForwardCurveChart({ data }: { data: ForwardCurvePoint[] }) {
  if (!data.length) return null

  const chartData = data.map((pt) => ({
    date: pt.date,
    base_price: pt.base_price,
    peak_price: pt.peak_price ?? null,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Forward Curve (Q1 2025 – Q4 2028)
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            interval={1}
            angle={-35}
            textAnchor="end"
            height={52}
          />
          <YAxis
            tickFormatter={(v) => `$${v}`}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `$${value?.toFixed(2)} /MWh`,
              name === 'base_price' ? 'Base Load' : 'Peak Load',
            ]}
            labelStyle={{ fontWeight: 600 }}
          />
          <Legend
            formatter={(value) => (value === 'base_price' ? 'Base Load' : 'Peak Load')}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="base_price"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            name="base_price"
          />
          <Line
            type="monotone"
            dataKey="peak_price"
            stroke="#f97316"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 4 }}
            name="peak_price"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contracts Table
// ---------------------------------------------------------------------------

type SortKey = 'contract_code' | 'settlement_price' | 'change_1d' | 'change_1w' | 'open_interest' | 'volume_today'

function ContractsTable({ contracts }: { contracts: FuturesContract[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('contract_code')
  const [sortAsc, setSortAsc] = useState(true)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k
    return (
      <th
        onClick={() => handleSort(k)}
        className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
      >
        {label}
        {active && (
          <span className="ml-1 text-blue-500">{sortAsc ? '↑' : '↓'}</span>
        )}
      </th>
    )
  }

  const calContracts = contracts
    .filter((c) => c.contract_type === 'CAL')
    .sort((a, b) => {
      const av = a[sortKey] as number | string
      const bv = b[sortKey] as number | string
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })

  const qContracts = contracts
    .filter((c) => c.contract_type !== 'CAL')
    .sort((a, b) => {
      const av = a[sortKey] as number | string
      const bv = b[sortKey] as number | string
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })

  function ContractRow({ c }: { c: FuturesContract }) {
    const up1d = c.change_1d >= 0
    const up1w = c.change_1w >= 0
    return (
      <tr className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
        <td className="px-3 py-2 text-xs font-mono text-gray-800 dark:text-gray-100">
          {c.contract_code}
        </td>
        <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
            {c.contract_type}
          </span>
        </td>
        <td className="px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white text-right">
          {fmt(c.settlement_price)}
        </td>
        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 text-right">
          {c.peak_price != null ? fmt(c.peak_price) : '—'}
        </td>
        <td
          className={`px-3 py-2 text-xs font-semibold text-right ${
            up1d ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {up1d ? '▲' : '▼'} {fmtChange(c.change_1d)}
        </td>
        <td
          className={`px-3 py-2 text-xs font-semibold text-right ${
            up1w ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {up1w ? '▲' : '▼'} {fmtChange(c.change_1w)}
        </td>
        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 text-right">
          {fmtOI(c.open_interest)}
        </td>
        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 text-right">
          {c.volume_today.toLocaleString()}
        </td>
        <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
          {new Date(c.last_trade).toLocaleTimeString('en-AU', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </td>
      </tr>
    )
  }

  function GroupHeader({ label }: { label: string }) {
    return (
      <tr className="bg-gray-50 dark:bg-gray-750">
        <td
          colSpan={9}
          className="px-3 py-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
        >
          {label}
        </td>
      </tr>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Futures Contracts
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-750">
            <tr>
              <SortHeader label="Contract" k="contract_code" />
              <SortHeader label="Type" k="contract_code" />
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Price
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Peak Price
              </th>
              <SortHeader label="1D Change" k="change_1d" />
              <SortHeader label="1W Change" k="change_1w" />
              <SortHeader label="Open Interest" k="open_interest" />
              <SortHeader label="Volume" k="volume_today" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Last Trade
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {calContracts.length > 0 && (
              <>
                <GroupHeader label="CAL Contracts" />
                {calContracts.map((c) => (
                  <ContractRow key={c.contract_code} c={c} />
                ))}
              </>
            )}
            {qContracts.length > 0 && (
              <>
                <GroupHeader label="Quarterly Contracts" />
                {qContracts.map((c) => (
                  <ContractRow key={c.contract_code} c={c} />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hedge Effectiveness Cards
// ---------------------------------------------------------------------------

function EffectivenessBar({ pct }: { pct: number }) {
  const color =
    pct >= 80
      ? 'bg-green-500'
      : pct >= 60
      ? 'bg-amber-500'
      : 'bg-red-500'
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
      <div
        className={`${color} h-2 rounded-full transition-all`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

function HedgeCard({ h }: { h: HedgeEffectivenessRecord }) {
  const pnlPos = h.pnl_aud >= 0
  const effColor =
    h.effectiveness_pct >= 80
      ? 'text-green-600 dark:text-green-400'
      : h.effectiveness_pct >= 60
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Shield size={14} className="text-blue-500" />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
              {h.hedge_type.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{h.contract}</p>
        </div>
        <span
          className={`text-sm font-bold ${
            pnlPos ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {pnlPos ? '+' : ''}
          {(h.pnl_aud / 1_000).toFixed(0)}k AUD
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
        <div className="text-gray-500 dark:text-gray-400">Notional</div>
        <div className="text-right text-gray-800 dark:text-gray-200 font-medium">
          {(h.notional_mwh / 1_000).toFixed(1)}k MWh
        </div>
        <div className="text-gray-500 dark:text-gray-400">Hedge Price</div>
        <div className="text-right text-gray-800 dark:text-gray-200 font-medium">
          {fmt(h.hedge_price)}/MWh
        </div>
        <div className="text-gray-500 dark:text-gray-400">Spot Realised</div>
        <div className="text-right text-gray-800 dark:text-gray-200 font-medium">
          {fmt(h.spot_realised)}/MWh
        </div>
      </div>

      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500 dark:text-gray-400">Effectiveness</span>
        <span className={`font-bold ${effColor}`}>{h.effectiveness_pct.toFixed(1)}%</span>
      </div>
      <EffectivenessBar pct={h.effectiveness_pct} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EnergyFutures() {
  const [region, setRegion] = useState('NSW1')
  const [dashboard, setDashboard] = useState<FuturesDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getFuturesDashboard(region)
      setDashboard(data)
      setLastUpdated(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load futures data')
    } finally {
      setLoading(false)
    }
  }, [region])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const summary = dashboard?.market_summary ?? {}
  const contracts = dashboard?.contracts ?? []
  const forwardCurve = dashboard?.forward_curve ?? []
  const hedgeEffectiveness = dashboard?.hedge_effectiveness ?? []

  // Derive 1D changes for near-term contracts for the summary strip
  function change1dFor(key: string): number {
    const map: Record<string, string> = {
      cal_2025: 'CAL',
      cal_2026: 'CAL',
      q4_2025: 'Q4',
      q1_2026: 'Q1',
    }
    const yearMap: Record<string, number> = {
      cal_2025: 2025,
      cal_2026: 2026,
      q4_2025: 2025,
      q1_2026: 2026,
    }
    const ct = map[key]
    const yr = yearMap[key]
    const qMap: Record<string, number | undefined> = {
      cal_2025: undefined,
      cal_2026: undefined,
      q4_2025: 4,
      q1_2026: 1,
    }
    const q = qMap[key]
    const match = contracts.find(
      (c) => c.contract_type === ct && c.year === yr && c.quarter === q
    )
    return match?.change_1d ?? 0
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DollarSign size={22} className="text-blue-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              ASX Energy Futures
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Calendar and quarterly electricity strips · NEM regions
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
            ASX Energy
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Region selector */}
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {lastUpdated ? `Updated ${lastUpdated}` : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {error} — showing indicative mock data
        </div>
      )}

      {/* Market Summary Strip */}
      {!loading && Object.keys(summary).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {summary.cal_2025 != null && (
            <MarketSummaryPill
              label="Cal 2025"
              price={summary.cal_2025}
              change={change1dFor('cal_2025')}
            />
          )}
          {summary.cal_2026 != null && (
            <MarketSummaryPill
              label="Cal 2026"
              price={summary.cal_2026}
              change={change1dFor('cal_2026')}
            />
          )}
          {summary.q4_2025 != null && (
            <MarketSummaryPill
              label="Q4 2025"
              price={summary.q4_2025}
              change={change1dFor('q4_2025')}
            />
          )}
          {summary.q1_2026 != null && (
            <MarketSummaryPill
              label="Q1 2026"
              price={summary.q1_2026}
              change={change1dFor('q1_2026')}
            />
          )}
        </div>
      )}

      {/* Loading skeleton for summary strip */}
      {loading && (
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-10 w-44 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Forward Curve Chart */}
      {loading ? (
        <div className="h-80 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      ) : (
        <ForwardCurveChart data={forwardCurve} />
      )}

      {/* Contracts Table */}
      {loading ? (
        <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      ) : (
        <ContractsTable contracts={contracts} />
      )}

      {/* Hedge Effectiveness */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Hedge Effectiveness Analytics
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hedgeEffectiveness.map((h) => (
              <HedgeCard key={`${h.hedge_type}-${h.contract}`} h={h} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
