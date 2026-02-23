// Sprint 143a — EFOT: Electricity Futures & Options Trading Analytics
// ASX Energy electricity derivatives: contracts, OHLC, hedging programs,
// market depth and volatility surface for NSW/VIC/QLD/SA regions.

import { useEffect, useState } from 'react'
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
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { getElectricityFuturesOptionsDashboard, EFOTDashboard } from '../api/client'

// ── colour palettes ───────────────────────────────────────────────────────────
const CONTRACT_TYPE_COLOURS: Record<string, string> = {
  'Base Load Futures': '#6366f1',
  'Peak Load Futures': '#f59e0b',
  'Cap Contract':      '#22c55e',
  'Swap':              '#3b82f6',
  'Collar':            '#ef4444',
  'Spark Spread':      '#a78bfa',
}

const HEDGE_TYPE_COLOURS: Record<string, string> = {
  'Retailer Hedge':        '#6366f1',
  'Generator Hedge':       '#22c55e',
  'Corporate PPA Hedge':   '#f59e0b',
  'Trader Spec':           '#ef4444',
}

const REGION_COLOURS: Record<string, string> = {
  NSW: '#6366f1',
  VIC: '#3b82f6',
  QLD: '#f59e0b',
  SA:  '#ef4444',
}

const OHLC_LINE_COLOURS = ['#22c55e', '#f59e0b', '#a78bfa']

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt1(n: number) { return n.toFixed(1) }
function fmt2(n: number) { return n.toFixed(2) }

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── tooltip style ─────────────────────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' },
  labelStyle:   { color: '#f3f4f6' },
  itemStyle:    { color: '#d1d5db' },
}

// ── section card ──────────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────
export default function ElectricityFuturesOptionsAnalytics() {
  const [data, setData]       = useState<EFOTDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getElectricityFuturesOptionsDashboard()
      .then(d  => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Loading Electricity Futures & Options data…
    </div>
  )
  if (error || !data) return (
    <div className="flex items-center justify-center h-64 text-red-400">
      {error ?? 'No data available'}
    </div>
  )

  const { contracts, daily_ohlc, hedging_programs, market_depth, volatility, summary } = data

  // ── Chart 1: open interest by region, coloured by contract_type ───────────
  const regionContractMap: Record<string, Record<string, number>> = {}
  for (const c of contracts) {
    if (!regionContractMap[c.region]) regionContractMap[c.region] = {}
    regionContractMap[c.region][c.contract_type] =
      (regionContractMap[c.region][c.contract_type] ?? 0) + c.open_interest_mwh / 1000
  }
  const oi_by_region = Object.entries(regionContractMap).map(([region, types]) => ({
    region,
    ...types,
  }))
  const all_contract_types = Array.from(new Set(contracts.map(c => c.contract_type)))

  // ── Chart 2: OHLC price history for top 3 contracts ──────────────────────
  const key_ids = Array.from(new Set(daily_ohlc.map(d => d.contract_id))).slice(0, 3)
  const ohlc_by_day: Record<number, Record<string, number>> = {}
  for (const row of daily_ohlc) {
    if (!key_ids.includes(row.contract_id)) continue
    if (!ohlc_by_day[row.trade_date_offset]) ohlc_by_day[row.trade_date_offset] = {}
    ohlc_by_day[row.trade_date_offset][`${row.contract_id}_close`] = row.close_mwh
    ohlc_by_day[row.trade_date_offset][`${row.contract_id}_high`]  = row.high_mwh
    ohlc_by_day[row.trade_date_offset][`${row.contract_id}_low`]   = row.low_mwh
  }
  const ohlc_chart = Object.entries(ohlc_by_day)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([day, vals]) => ({ day: `D${day}`, ...vals }))

  // ── Chart 3: hedging MtM by program coloured by hedge_type ───────────────
  const mtm_chart = hedging_programs.map(hp => ({
    name: hp.participant_name.split(' ').slice(-1)[0],
    mtm:  hp.mark_to_market_m_aud,
    type: hp.hedge_type,
  }))

  // ── Chart 4: market depth bid vs ask for 2025 Q1 by region ───────────────
  const depth_2025q1 = market_depth.filter(d => d.year === 2025 && d.quarter === 'Q1')
  const depth_by_region: Record<string, { bid: number; ask: number }> = {}
  for (const row of depth_2025q1) {
    if (!depth_by_region[row.region]) depth_by_region[row.region] = { bid: 0, ask: 0 }
    depth_by_region[row.region].bid += row.bid_volume_mwh / 1000
    depth_by_region[row.region].ask += row.ask_volume_mwh / 1000
  }
  const depth_chart = Object.entries(depth_by_region).map(([region, v]) => ({
    region,
    bid: Math.round(v.bid),
    ask: Math.round(v.ask),
  }))

  // ── Chart 5: implied vs realised vol for NSW & VIC 2022-2024 ─────────────
  const vol_nsw_vic = volatility
    .filter(v => (v.region === 'NSW' || v.region === 'VIC') && v.month <= 6)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .map(v => ({
      label:       `${v.region} ${v.year} M${v.month}`,
      implied_vol: v.implied_vol,
      realised_vol: v.realised_vol_30d,
      region:      v.region,
    }))

  return (
    <div className="min-h-screen bg-gray-900 p-6 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="text-indigo-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Electricity Futures &amp; Options Trading Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            ASX Energy derivatives — contracts, OHLC, hedging programs, market depth &amp; volatility
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          label="Total Open Interest"
          value={`${(summary.total_open_interest_twh * 1000).toFixed(1)} GWh`}
          sub="Across all contracts"
        />
        <KPICard
          label="Avg Implied Vol"
          value={`${fmt2(summary.avg_implied_volatility_pct)}%`}
          sub="Across 20 active contracts"
        />
        <KPICard
          label="Most Liquid Region"
          value={summary.most_liquid_region}
          sub="By open interest MWh"
        />
        <KPICard
          label="Portfolio VaR 95%"
          value={`$${fmt2(summary.var_95_portfolio_m_aud)}M`}
          sub="AUD across all hedging programs"
        />
      </div>

      {/* Chart row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">

        {/* Chart 1: Open Interest by Region & Contract Type */}
        <SectionCard title="Open Interest by Region & Contract Type (GWh)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={oi_by_region} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${fmt1(v)} GWh`]} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {all_contract_types.map(ct => (
                <Bar key={ct} dataKey={ct} stackId="a"
                  fill={CONTRACT_TYPE_COLOURS[ct] ?? '#6b7280'}
                  name={ct}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Chart 2: OHLC Price History (close + high + low lines) */}
        <SectionCard title="OHLC Price History — Top 3 Contracts ($/MWh)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={ohlc_chart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 10 }}
                interval={3} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`$${fmt2(v)}/MWh`]} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 10 }} />
              {key_ids.map((cid, idx) => (
                <Line
                  key={`${cid}_close`}
                  type="monotone"
                  dataKey={`${cid}_close`}
                  stroke={OHLC_LINE_COLOURS[idx]}
                  dot={false}
                  strokeWidth={2}
                  name={`Contract ${idx + 1} Close`}
                />
              ))}
              {key_ids.map((cid, idx) => (
                <Line
                  key={`${cid}_high`}
                  type="monotone"
                  dataKey={`${cid}_high`}
                  stroke={OHLC_LINE_COLOURS[idx]}
                  dot={false}
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  name={`Contract ${idx + 1} High`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Chart row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">

        {/* Chart 3: Hedging Program MtM by participant */}
        <SectionCard title="Hedging Program Mark-to-Market ($M AUD)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={mtm_chart} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip {...tooltipStyle}
                formatter={(v: number) => [`$${fmt2(v)}M`]}
                labelFormatter={(l: string) => `Participant: ${l}`}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {Object.keys(HEDGE_TYPE_COLOURS).map(ht => (
                <Bar
                  key={ht}
                  dataKey="mtm"
                  name={ht}
                  fill={HEDGE_TYPE_COLOURS[ht]}
                  hide={!mtm_chart.some(d => d.type === ht)}
                />
              ))}
              <Bar dataKey="mtm" name="MtM $M AUD"
                fill="#6366f1"
              />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Chart 4: Market Depth bid vs ask 2025 Q1 */}
        <SectionCard title="Market Depth — Bid vs Ask Volume 2025 Q1 (GWh)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={depth_chart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} GWh`]} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar dataKey="bid" name="Bid Volume" fill="#22c55e" />
              <Bar dataKey="ask" name="Ask Volume" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Chart row 3 */}
      <div className="grid grid-cols-1 gap-6 mb-6">

        {/* Chart 5: Implied vs Realised Vol NSW/VIC 2022-2024 */}
        <SectionCard title="Implied vs Realised Volatility — NSW & VIC (2022-2024)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={vol_nsw_vic} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${fmt2(v)}%`]} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Line type="monotone" dataKey="implied_vol"  stroke="#6366f1"
                dot={{ r: 3 }} strokeWidth={2} name="Implied Vol %" />
              <Line type="monotone" dataKey="realised_vol" stroke="#f59e0b"
                dot={{ r: 3 }} strokeWidth={2} name="Realised Vol 30d %" />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard
          label="Total Hedging Volume"
          value={`${fmt2(summary.total_hedging_volume_twh)} TWh`}
          sub="Across 15 hedging programs"
        />
        <KPICard
          label="Avg Hedge Ratio"
          value={`${fmt1(summary.avg_hedge_ratio_pct)}%`}
          sub="Portfolio-weighted"
        />
        <KPICard
          label="Active Contracts"
          value={String(summary.active_contracts)}
          sub="ASX Energy derivatives"
        />
      </div>
    </div>
  )
}
