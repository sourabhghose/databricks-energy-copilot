import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Zap } from 'lucide-react'
import {
  getEnergyStorageArbitrageDashboard,
  ESAODashboard,
} from '../api/client'

// ── colour palette ──────────────────────────────────────────────────────────
const ASSET_COLOURS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#6366f1', '#84cc16',
]

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#10b981',
  SA1:  '#ef4444',
}

const STRAT_COLOUR = '#6366f1'

// ── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── main component ───────────────────────────────────────────────────────────
export default function EnergyStorageArbitrageAnalytics() {
  const [data, setData] = useState<ESAODashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyStorageArbitrageDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <p className="text-gray-400 animate-pulse">Loading Energy Storage Arbitrage Optimisation Analytics…</p>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <p className="text-red-400">Failed to load data: {error}</p>
      </div>
    )
  }

  const { assets, daily_patterns, revenue, optimisation, spreads, summary } = data

  // ── Chart 1: asset power_mw and energy_mwh grouped bar ────────────────────
  const chart1Data = assets.map(a => ({
    name: a.asset_name.replace(' Battery', '').replace(' BESS', '').replace(' Power Reserve', ' HPR'),
    power_mw: a.power_mw,
    energy_mwh: a.energy_mwh,
  }))

  // ── Chart 2: monthly arbitrage_revenue_k_aud trend for 6 assets ───────────
  const patternAssetIds = Array.from(new Set(daily_patterns.map(p => p.asset_id))).slice(0, 6)
  const allMonths = Array.from(new Set(daily_patterns.map(p => p.month))).sort((a, b) => a - b)
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const chart2Data = allMonths.map(mo => {
    const row: Record<string, number | string> = { month: monthNames[mo - 1] }
    patternAssetIds.forEach(aid => {
      const rec = daily_patterns.find(p => p.asset_id === aid && p.month === mo)
      row[aid] = rec ? rec.arbitrage_revenue_k_aud : 0
    })
    return row
  })

  // ── Chart 3: quarterly total_revenue_m_aud stacked by source for 2024 ─────
  const rev2024AssetIds = Array.from(new Set(revenue.filter(r => r.year === 2024).map(r => r.asset_id)))
  const rev2024Quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const chart3Data = rev2024Quarters.map(qtr => {
    const row: Record<string, number | string> = { quarter: qtr }
    rev2024AssetIds.forEach(aid => {
      const rec = revenue.find(r => r.year === 2024 && r.quarter === qtr && r.asset_id === aid)
      if (rec) {
        row[`${aid}_arb`] = rec.arbitrage_revenue_m_aud
        row[`${aid}_fcas`] = rec.fcas_revenue_m_aud
        row[`${aid}_anc`] = rec.ancillary_revenue_m_aud
      }
    })
    return row
  })

  // ── Chart 4: optimisation strategy improvement_vs_naive_pct sorted desc ───
  const stratMap: Record<string, number[]> = {}
  optimisation.forEach(o => {
    stratMap[o.optimisation_strategy] = stratMap[o.optimisation_strategy] || []
    stratMap[o.optimisation_strategy].push(o.improvement_vs_naive_pct)
  })
  const chart4Data = Object.entries(stratMap)
    .map(([strat, vals]) => ({
      strategy: strat,
      avg_improvement: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
    }))
    .sort((a, b) => b.avg_improvement - a.avg_improvement)

  // ── Chart 5: regional price_spread_mwh trend across 2022-2024 quarterly ──
  const spreadRegions = Array.from(new Set(spreads.map(s => s.region))).sort()
  // Create quarterly labels from year + month
  type SpreadPoint = { label: string; [key: string]: number | string }
  const spreadKeys: string[] = []
  spreads.forEach(s => {
    const key = `${s.year}-M${s.month}`
    if (!spreadKeys.includes(key)) spreadKeys.push(key)
  })
  spreadKeys.sort()
  const chart5Data: SpreadPoint[] = spreadKeys.map(key => {
    const [yearStr, mPart] = key.split('-M')
    const yr = parseInt(yearStr)
    const mo = parseInt(mPart)
    const row: SpreadPoint = { label: `${yr} M${mo}` }
    spreadRegions.forEach(reg => {
      const rec = spreads.find(s => s.region === reg && s.year === yr && s.month === mo)
      row[reg] = rec ? rec.price_spread_mwh : 0
    })
    return row
  })

  return (
    <div className="min-h-full bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Energy Storage Arbitrage Optimisation</h1>
          <p className="text-sm text-gray-400">NEM battery & storage arbitrage analytics — synthetic data</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Total Storage"
          value={`${summary.total_storage_mwh.toLocaleString()} MWh`}
          sub="Combined fleet capacity"
        />
        <KPICard
          label="Avg Round-Trip Efficiency"
          value={`${summary.avg_round_trip_efficiency_pct.toFixed(1)}%`}
          sub="Fleet average RTE"
        />
        <KPICard
          label="Best Arbitrage Region"
          value={summary.best_arbitrage_region}
          sub="Highest avg price spread"
        />
        <KPICard
          label="Total Revenue 2024"
          value={`$${summary.total_revenue_m_aud_2024.toFixed(1)}M`}
          sub="All tracked assets"
        />
      </div>

      {/* Chart 1: Asset Power & Energy */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Asset Fleet — Power (MW) & Energy (MWh)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart1Data} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            <Bar dataKey="power_mw" name="Power (MW)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="energy_mwh" name="Energy (MWh)" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Monthly Arbitrage Revenue Trend */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Monthly Arbitrage Revenue Trend (k AUD) — Top 6 Assets</h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chart2Data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {patternAssetIds.map((aid, idx) => (
              <Line
                key={aid}
                type="monotone"
                dataKey={aid}
                name={aid}
                stroke={ASSET_COLOURS[idx % ASSET_COLOURS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: 2024 Quarterly Revenue Stacked */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">2024 Quarterly Revenue by Source (M AUD) — Stacked</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart3Data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {rev2024AssetIds.map((aid, idx) => [
              <Bar key={`${aid}_arb`} dataKey={`${aid}_arb`} name={`${aid} Arbitrage`} stackId={aid} fill={ASSET_COLOURS[idx % ASSET_COLOURS.length]} />,
              <Bar key={`${aid}_fcas`} dataKey={`${aid}_fcas`} name={`${aid} FCAS`} stackId={aid} fill={ASSET_COLOURS[(idx + 3) % ASSET_COLOURS.length]} />,
              <Bar key={`${aid}_anc`} dataKey={`${aid}_anc`} name={`${aid} Ancillary`} stackId={aid} fill={ASSET_COLOURS[(idx + 6) % ASSET_COLOURS.length]} radius={[3, 3, 0, 0]} />,
            ])}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Optimisation Strategy Improvement */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Optimisation Strategy — Avg Improvement vs Naive Dispatch (%)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart4Data} layout="vertical" margin={{ top: 10, right: 30, left: 160, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <YAxis type="category" dataKey="strategy" tick={{ fill: '#9ca3af', fontSize: 12 }} width={155} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, 'Improvement']}
            />
            <Bar dataKey="avg_improvement" name="Avg Improvement %" fill={STRAT_COLOUR} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Regional Price Spread Trend */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Regional Price Spread ($/MWh) — 2022–2024 Monthly</h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chart5Data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/MWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            {spreadRegions.map(reg => (
              <Line
                key={reg}
                type="monotone"
                dataKey={reg}
                name={reg}
                stroke={REGION_COLOURS[reg] || '#94a3b8'}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary footer */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-3">Analytics Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Best Optimisation Strategy</p>
            <p className="text-white font-medium">{summary.best_optimisation_strategy}</p>
          </div>
          <div>
            <p className="text-gray-400">Avg Annual Spread</p>
            <p className="text-white font-medium">${summary.avg_annual_spread_mwh.toFixed(1)}/MWh</p>
          </div>
          <div>
            <p className="text-gray-400">Avg Payback Period</p>
            <p className="text-white font-medium">{summary.avg_payback_years.toFixed(1)} years</p>
          </div>
        </div>
      </div>
    </div>
  )
}
