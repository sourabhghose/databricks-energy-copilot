import { useEffect, useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts'
import { Battery, Zap, BarChart2 } from 'lucide-react'
import { getStorageOptimisationDashboard, StorageOptimisationDashboard } from '../api/client'

const PALETTE = {
  energy:   '#f59e0b',
  raiseFcas:'#10b981',
  lowerFcas:'#06b6d4',
  capacity: '#8b5cf6',
  dr:       '#f43f5e',
  idle:     '#6b7280',
  horns:    '#f59e0b',
  vicBig:   '#10b981',
  scenarios: ['#6b7280', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'],
}

const SCENARIO_LABELS: Record<string, string> = {
  ENERGY_ONLY: 'Energy Only',
  FCAS_ONLY:   'FCAS Only',
  ENERGY_FCAS: 'Energy + FCAS',
  FULL_STACK:  'Full Stack',
  AI_OPTIMISED:'AI Optimised',
}

function KpiCard({ icon, label, value, sub, colour }: { icon: React.ReactNode; label: string; value: string; sub?: string; colour: string }) {
  return (
    <div className={`bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border-l-4 ${colour}`}>
      <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

export default function StorageOptimisationAnalytics() {
  const [data, setData] = useState<StorageOptimisationDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStorageOptimisationDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message ?? 'Failed to load'); setLoading(false) })
  }, [])

  if (loading) return <div className="flex h-full items-center justify-center text-gray-400 text-sm">Loading Storage Optimisation data…</div>
  if (error || !data) return <div className="flex h-full items-center justify-center text-red-400 text-sm">Error: {error}</div>

  // ── KPI derivations ──────────────────────────────────────────────────────
  const bestRevPerMw = Math.max(...data.service_allocations.map((r: any) => r.revenue_per_mw_k_aud as number))
  const bestRevPerMwName = (data.service_allocations.find((r: any) => r.revenue_per_mw_k_aud === bestRevPerMw) as any)?.bess_name ?? '—'
  const highestIrr = Math.max(...data.optimisation_results.map((r: any) => r.irr_pct as number))
  const highestIrrScenario = SCENARIO_LABELS[(data.optimisation_results.find((r: any) => r.irr_pct === highestIrr) as any)?.scenario] ?? '—'
  const mostProfitable = [...data.service_allocations].sort((a: any, b: any) => b.total_revenue_m_aud - a.total_revenue_m_aud)[0] as any
  const energyOnlyRev = (data.optimisation_results.find((r: any) => r.scenario === 'ENERGY_ONLY') as any)?.annual_revenue_m_aud ?? 1
  const aiOptRev = (data.optimisation_results.find((r: any) => r.scenario === 'AI_OPTIMISED') as any)?.annual_revenue_m_aud ?? energyOnlyRev
  const aiUplift = (((aiOptRev - energyOnlyRev) / energyOnlyRev) * 100).toFixed(1)

  // ── Chart data ────────────────────────────────────────────────────────────
  const allocationChartData = data.service_allocations.map((r: any) => ({
    name: r.bess_name.length > 18 ? r.bess_name.slice(0, 18) + '…' : r.bess_name,
    'Energy Arbitrage': r.energy_arbitrage_pct,
    'Raise FCAS': r.raise_fcas_pct,
    'Lower FCAS': r.lower_fcas_pct,
    'Capacity Market': r.capacity_market_pct,
    'Demand Response': r.demand_response_pct,
    'Idle': r.idle_pct,
  }))

  const scenarioChartData = [...data.optimisation_results]
    .sort((a: any, b: any) => a.annual_revenue_m_aud - b.annual_revenue_m_aud)
    .map((r: any) => ({
      scenario: SCENARIO_LABELS[r.scenario] ?? r.scenario,
      revenue: r.annual_revenue_m_aud,
      irr: r.irr_pct,
      _raw: r.scenario,
    }))

  const priceChartData = data.price_correlations.map((r: any) => ({
    month: r.month.slice(0, 7),
    'Arbitrage Spread': r.arbitrage_spread_aud,
    'Energy Price': r.energy_price_aud_mwh,
    'Raise Reg': r.raise_reg_price,
  }))

  // Degradation: two BESS side-by-side
  const degradHorns = data.degradation.filter((r: any) => r.bess_id === 'HORNSDALE1').sort((a: any, b: any) => a.year - b.year)
  const degradVic = data.degradation.filter((r: any) => r.bess_id === 'VIC_BIG').sort((a: any, b: any) => a.year - b.year)
  const degradChartData = degradHorns.map((r: any, i: number) => ({
    year: `Year ${r.year}`,
    'Hornsdale PR': r.capacity_retention_pct,
    'Victorian Big Battery': degradVic[i]?.capacity_retention_pct ?? null,
  }))

  return (
    <div className="min-h-full bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <Battery className="text-amber-400" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Battery Storage Revenue Stacking Optimisation</h1>
          <p className="text-sm text-gray-400">Multi-service optimisation across energy arbitrage, FCAS, capacity markets, and demand response — utility-scale BESS</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={<Zap size={14} />}
          label="Best Revenue / MW"
          value={`${bestRevPerMw.toFixed(0)} k AUD`}
          sub={bestRevPerMwName}
          colour="border-amber-400"
        />
        <KpiCard
          icon={<BarChart2 size={14} />}
          label="Highest IRR Scenario"
          value={`${highestIrr.toFixed(1)} %`}
          sub={highestIrrScenario}
          colour="border-emerald-400"
        />
        <KpiCard
          icon={<Battery size={14} />}
          label="Most Profitable BESS"
          value={`$${mostProfitable?.total_revenue_m_aud?.toFixed(1) ?? '—'} M`}
          sub={mostProfitable?.bess_name ?? '—'}
          colour="border-violet-400"
        />
        <KpiCard
          icon={<Zap size={14} />}
          label="AI Optimisation Uplift"
          value={`+${aiUplift} %`}
          sub="vs Energy Only scenario"
          colour="border-rose-400"
        />
      </div>

      {/* Row 1: Allocation stacked bar + Scenario horizontal bar */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Service Allocation */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Battery size={15} className="text-amber-400" />
            Service Allocation per BESS (%)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={allocationChartData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#9ca3af' }} width={130} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`${v.toFixed(1)}%`]}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
              <Bar dataKey="Energy Arbitrage" stackId="a" fill={PALETTE.energy} />
              <Bar dataKey="Raise FCAS" stackId="a" fill={PALETTE.raiseFcas} />
              <Bar dataKey="Lower FCAS" stackId="a" fill={PALETTE.lowerFcas} />
              <Bar dataKey="Capacity Market" stackId="a" fill={PALETTE.capacity} />
              <Bar dataKey="Demand Response" stackId="a" fill={PALETTE.dr} />
              <Bar dataKey="Idle" stackId="a" fill={PALETTE.idle} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Optimisation Scenario Comparison */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <BarChart2 size={15} className="text-emerald-400" />
            Optimisation Scenario Comparison — Annual Revenue (M AUD)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={scenarioChartData} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `$${v}M`} />
              <YAxis dataKey="scenario" type="category" tick={{ fontSize: 10, fill: '#9ca3af' }} width={110} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number, name: string) => [`$${v.toFixed(1)}M`, name]}
              />
              <Bar dataKey="revenue" name="Annual Revenue" radius={[0, 4, 4, 0]}>
                {scenarioChartData.map((entry, idx) => (
                  <Cell key={idx} fill={PALETTE.scenarios[idx % PALETTE.scenarios.length]} />
                ))}
                <LabelList
                  dataKey="irr"
                  position="right"
                  formatter={(v: number) => `IRR ${v.toFixed(1)}%`}
                  style={{ fill: '#9ca3af', fontSize: 10 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Price correlation + Degradation */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Price Correlation */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Zap size={15} className="text-cyan-400" />
            NSW1 Monthly Price Correlation — Arbitrage Spread & Energy Price (2024)
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={priceChartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`$${v.toFixed(1)}/MWh`]}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
              <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="4 4" label={{ value: '$50 threshold', fill: '#6b7280', fontSize: 9 }} />
              <Line type="monotone" dataKey="Arbitrage Spread" stroke={PALETTE.energy} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Energy Price" stroke={PALETTE.raiseFcas} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
              <Line type="monotone" dataKey="Raise Reg" stroke={PALETTE.lowerFcas} strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="3 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Degradation Impact */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Battery size={15} className="text-violet-400" />
            Degradation Impact — Capacity Retention % over 4 Years
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={degradChartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis domain={[93, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`${v.toFixed(1)}%`]}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
              <ReferenceLine y={96} stroke="#6b7280" strokeDasharray="4 4" label={{ value: '96% threshold', fill: '#6b7280', fontSize: 9 }} />
              <Line type="monotone" dataKey="Hornsdale PR" stroke={PALETTE.horns} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Victorian Big Battery" stroke={PALETTE.vicBig} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Service Allocation Table */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <Battery size={15} className="text-amber-400" />
          BESS Portfolio Service Allocation Summary
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-3 font-medium">BESS Name</th>
                <th className="text-center py-2 px-2 font-medium">Region</th>
                <th className="text-right py-2 px-2 font-medium">MW</th>
                <th className="text-right py-2 px-2 font-medium">hr</th>
                <th className="text-right py-2 px-2 font-medium">Energy %</th>
                <th className="text-right py-2 px-2 font-medium">FCAS %</th>
                <th className="text-right py-2 px-2 font-medium">Cap Mkt %</th>
                <th className="text-right py-2 px-2 font-medium">DR %</th>
                <th className="text-right py-2 px-2 font-medium">Revenue M</th>
                <th className="text-right py-2 pl-2 font-medium">$/MW k</th>
              </tr>
            </thead>
            <tbody>
              {data.service_allocations.map((r: any, i: number) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-1.5 pr-3 font-medium text-gray-100">{r.bess_name}</td>
                  <td className="py-1.5 px-2 text-center">
                    <span className="px-1.5 py-0.5 rounded text-xs bg-gray-700 text-gray-300">{r.region}</span>
                  </td>
                  <td className="py-1.5 px-2 text-right text-gray-300">{r.capacity_mw}</td>
                  <td className="py-1.5 px-2 text-right text-gray-300">{r.duration_hr}</td>
                  <td className="py-1.5 px-2 text-right">
                    <span className="text-amber-400 font-medium">{r.energy_arbitrage_pct.toFixed(0)}%</span>
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    <span className="text-emerald-400">{(r.raise_fcas_pct + r.lower_fcas_pct).toFixed(0)}%</span>
                  </td>
                  <td className="py-1.5 px-2 text-right text-violet-400">{r.capacity_market_pct.toFixed(0)}%</td>
                  <td className="py-1.5 px-2 text-right text-rose-400">{r.demand_response_pct.toFixed(0)}%</td>
                  <td className="py-1.5 px-2 text-right font-semibold text-gray-100">${r.total_revenue_m_aud.toFixed(1)}M</td>
                  <td className="py-1.5 pl-2 text-right text-cyan-400">{r.revenue_per_mw_k_aud.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Optimisation Results Table */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <BarChart2 size={15} className="text-emerald-400" />
          Optimisation Scenario Financials (200 MW / 2 hr reference BESS)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-3 font-medium">Scenario</th>
                <th className="text-right py-2 px-2 font-medium">Annual Rev M AUD</th>
                <th className="text-right py-2 px-2 font-medium">IRR %</th>
                <th className="text-right py-2 px-2 font-medium">Payback (yrs)</th>
                <th className="text-right py-2 px-2 font-medium">CAPEX M AUD</th>
                <th className="text-right py-2 pl-2 font-medium">LCOE AUD/MWh</th>
              </tr>
            </thead>
            <tbody>
              {[...data.optimisation_results].sort((a: any, b: any) => b.annual_revenue_m_aud - a.annual_revenue_m_aud).map((r: any, i: number) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-1.5 pr-3 font-medium">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      r.scenario === 'AI_OPTIMISED' ? 'bg-rose-900/60 text-rose-300' :
                      r.scenario === 'FULL_STACK'   ? 'bg-amber-900/60 text-amber-300' :
                      r.scenario === 'ENERGY_FCAS'  ? 'bg-emerald-900/60 text-emerald-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {SCENARIO_LABELS[r.scenario] ?? r.scenario}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right font-semibold text-gray-100">${r.annual_revenue_m_aud.toFixed(1)}M</td>
                  <td className="py-1.5 px-2 text-right">
                    <span className={r.irr_pct >= 15 ? 'text-emerald-400 font-semibold' : r.irr_pct >= 10 ? 'text-amber-400' : 'text-gray-300'}>
                      {r.irr_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right text-gray-300">{r.payback_years.toFixed(1)}</td>
                  <td className="py-1.5 px-2 text-right text-gray-300">${r.capex_m_aud.toFixed(0)}M</td>
                  <td className="py-1.5 pl-2 text-right text-cyan-400">${r.lcoe_aud_mwh.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
