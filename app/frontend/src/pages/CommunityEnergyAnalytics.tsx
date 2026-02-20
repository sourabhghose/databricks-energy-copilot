import React, { useEffect, useState } from 'react'
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
import { Home, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  getCommunityEnergyDashboard,
  CEADashboard,
  CEAProjectRecord,
  CEAFinancialRecord,
  CEALocalTradingRecord,
  CEAEquityRecord,
  CEABarrierRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const TYPE_BADGE: Record<string, string> = {
  COMMUNITY_SOLAR:      'bg-amber-600 text-white',
  MICROGRID:            'bg-blue-600 text-white',
  VPP:                  'bg-purple-600 text-white',
  LOCAL_ENERGY_NETWORK: 'bg-teal-600 text-white',
  SHARED_ROOFTOP:       'bg-cyan-600 text-white',
  COMMUNITY_BATTERY:    'bg-green-600 text-white',
}

const STATUS_BADGE: Record<string, string> = {
  OPERATING:    'bg-green-700 text-white',
  CONSTRUCTION: 'bg-amber-600 text-white',
  APPROVED:     'bg-blue-600 text-white',
  PILOT:        'bg-violet-600 text-white',
}

const SEVERITY_BADGE: Record<string, string> = {
  HIGH:   'bg-red-700 text-white',
  MEDIUM: 'bg-amber-600 text-white',
  LOW:    'bg-green-700 text-white',
}

const IMPL_BADGE: Record<string, string> = {
  IMPLEMENTED: 'bg-green-700 text-white',
  IN_PROGRESS: 'bg-blue-600 text-white',
  PROPOSED:    'bg-gray-600 text-white',
}

const REGION_BADGE: Record<string, string> = {
  URBAN:    'bg-slate-600 text-white',
  SUBURBAN: 'bg-indigo-600 text-white',
  REGIONAL: 'bg-orange-600 text-white',
  REMOTE:   'bg-red-600 text-white',
  ISLAND:   'bg-teal-600 text-white',
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart data helpers
// ---------------------------------------------------------------------------

function buildFinancialByType(
  projects: CEAProjectRecord[],
  financials: CEAFinancialRecord[],
): { type: string; avg_irr: number; avg_payback: number }[] {
  const finMap = new Map<string, CEAFinancialRecord>()
  financials.forEach(f => finMap.set(f.project_id, f))

  const grouped: Record<string, { irr: number[]; payback: number[] }> = {}
  projects.forEach(p => {
    const f = finMap.get(p.project_id)
    if (!f) return
    if (!grouped[p.type]) grouped[p.type] = { irr: [], payback: [] }
    grouped[p.type].irr.push(f.irr_pct)
    grouped[p.type].payback.push(f.payback_years)
  })

  return Object.entries(grouped).map(([type, vals]) => ({
    type: type.replace(/_/g, ' '),
    avg_irr: Math.round((vals.irr.reduce((a, b) => a + b, 0) / vals.irr.length) * 10) / 10,
    avg_payback:
      Math.round((vals.payback.reduce((a, b) => a + b, 0) / vals.payback.length) * 10) / 10,
  }))
}

function buildP2PLineData(
  trading: CEALocalTradingRecord[],
  selectedProjects: string[],
): Record<string, unknown>[] {
  const quarters = ['2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4']
  return quarters.map(q => {
    const row: Record<string, unknown> = { quarter: q }
    selectedProjects.forEach(pid => {
      const rec = trading.find(t => t.project_id === pid && t.quarter === q)
      row[pid] = rec ? rec.peer_to_peer_mwh : 0
    })
    return row
  })
}

const LINE_COLORS = [
  '#60a5fa','#34d399','#f59e0b','#f87171','#a78bfa',
  '#2dd4bf','#fb923c','#4ade80','#e879f9','#38bdf8',
]

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CommunityEnergyAnalytics() {
  const [dash, setDash] = useState<CEADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getCommunityEnergyDashboard()
      .then(d => { setDash(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} /> Loading...
      </div>
    )

  if (error || !dash)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertTriangle className="mr-2" size={20} /> {error ?? 'No data'}
      </div>
    )

  const summary = dash.summary as Record<string, number>
  const finChartData = buildFinancialByType(dash.projects, dash.financials)

  // P2P chart: use projects that have trading records
  const tradingPids = [...new Set(dash.local_trading.map(t => t.project_id))]
  const p2pChartData = buildP2PLineData(dash.local_trading, tradingPids)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Home size={28} className="text-teal-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">
              Community Energy &amp; Microgrid Analytics
            </h1>
            <p className="text-sm text-gray-400">
              Community solar, microgrids, local trading &amp; energy equity — Australia
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <KpiCard label="Total Projects"     value={String(summary.total_projects)}     sub="across Australia" />
        <KpiCard label="Total Capacity"     value={`${summary.total_capacity_mw} MW`}  sub="installed" />
        <KpiCard label="Total Members"      value={summary.total_members.toLocaleString()} sub="households &amp; businesses" />
        <KpiCard label="Avg Bill Saving"    value={`$${summary.avg_bill_saving}/yr`}   sub="per member" />
        <KpiCard label="Local Consumption"  value={`${summary.local_consumption_avg_pct}%`} sub="avg consumed locally" />
        <KpiCard label="P2P Trading"        value={`${(summary.p2p_trading_total_mwh / 1000).toFixed(1)} GWh`} sub="annual total" />
        <KpiCard label="Low-Income Members" value={`${summary.low_income_participation_avg_pct}%`} sub="avg participation" />
      </div>

      {/* Section 1: Project Portfolio */}
      <section className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Project Portfolio</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Project</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">State</th>
                <th className="text-left py-2 pr-4">Region</th>
                <th className="text-right py-2 pr-4">Capacity (kW)</th>
                <th className="text-right py-2 pr-4">Storage (kWh)</th>
                <th className="text-right py-2 pr-4">Members</th>
                <th className="text-right py-2 pr-4">Gen (MWh/yr)</th>
                <th className="text-right py-2 pr-4">Local %</th>
                <th className="text-right py-2 pr-4">Bill Saving</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {dash.projects.map(p => (
                <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 font-medium text-white">{p.name}</td>
                  <td className="py-2 pr-4">
                    <Badge label={p.type} colorClass={TYPE_BADGE[p.type] ?? 'bg-gray-600 text-white'} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{p.state}</td>
                  <td className="py-2 pr-4">
                    <Badge label={p.region_type} colorClass={REGION_BADGE[p.region_type] ?? 'bg-gray-600 text-white'} />
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">{p.capacity_kw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{p.storage_kwh.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{p.members.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{p.annual_generation_mwh.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{p.local_consumption_pct}%</td>
                  <td className="py-2 pr-4 text-right text-green-400">${p.avg_bill_saving_per_member.toLocaleString()}</td>
                  <td className="py-2">
                    <Badge label={p.status} colorClass={STATUS_BADGE[p.status] ?? 'bg-gray-600 text-white'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: Financial Performance by Project Type */}
      <section className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Financial Performance by Project Type</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* IRR by type */}
          <div>
            <p className="text-sm text-gray-400 mb-3">Average IRR (%) by Project Type</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={finChartData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="type"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                  formatter={(v: number) => [`${v}%`, 'Avg IRR']}
                />
                <Bar dataKey="avg_irr" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Payback by type */}
          <div>
            <p className="text-sm text-gray-400 mb-3">Average Payback Period (years) by Project Type</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={finChartData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="type"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" yr" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                  formatter={(v: number) => [`${v} yrs`, 'Avg Payback']}
                />
                <Bar dataKey="avg_payback" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Project ID</th>
                <th className="text-right py-2 pr-4">CapEx ($k)</th>
                <th className="text-right py-2 pr-4">OpEx/yr ($k)</th>
                <th className="text-right py-2 pr-4">Revenue/yr ($k)</th>
                <th className="text-right py-2 pr-4">Member Inv. ($)</th>
                <th className="text-right py-2 pr-4">Payback (yr)</th>
                <th className="text-right py-2 pr-4">IRR (%)</th>
                <th className="text-right py-2 pr-4">Govt Grant ($k)</th>
                <th className="text-right py-2">Community Benefit ($/mbr/yr)</th>
              </tr>
            </thead>
            <tbody>
              {dash.financials.map(f => (
                <tr key={f.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 text-teal-300 font-mono text-xs">{f.project_id}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{f.capex_k.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{f.opex_per_yr_k.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-green-400">{f.revenue_per_yr_k.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">${f.member_investment_avg.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-amber-300">{f.payback_years}</td>
                  <td className="py-2 pr-4 text-right text-green-400">{f.irr_pct}%</td>
                  <td className="py-2 pr-4 text-right text-blue-300">{f.govt_grant_k.toLocaleString()}</td>
                  <td className="py-2 text-right text-green-400">${f.community_benefit_per_member_yr.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: P2P Local Trading */}
      <section className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-1">P2P Local Energy Trading</h2>
        <p className="text-sm text-gray-400 mb-4">Quarterly peer-to-peer MWh traded by project (2024)</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={p2pChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
              formatter={(v: number, name: string) => [`${v.toFixed(1)} MWh`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            {tradingPids.map((pid, i) => (
              <Line
                key={pid}
                type="monotone"
                dataKey={pid}
                name={pid}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                dot={{ r: 3 }}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* Trading details table */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Project ID</th>
                <th className="text-left py-2 pr-4">Quarter</th>
                <th className="text-right py-2 pr-4">P2P (MWh)</th>
                <th className="text-right py-2 pr-4">Grid Export (MWh)</th>
                <th className="text-right py-2 pr-4">Grid Import (MWh)</th>
                <th className="text-right py-2 pr-4">P2P Price ($/MWh)</th>
                <th className="text-right py-2 pr-4">Buyback ($/MWh)</th>
                <th className="text-left py-2 pr-4">Platform</th>
                <th className="text-right py-2">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {dash.local_trading.map((t, i) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 text-teal-300 font-mono text-xs">{t.project_id}</td>
                  <td className="py-2 pr-4 text-gray-300">{t.quarter}</td>
                  <td className="py-2 pr-4 text-right text-green-400">{t.peer_to_peer_mwh.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{t.grid_export_mwh.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{t.grid_import_mwh.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right text-amber-300">${t.avg_p2p_price.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right text-blue-300">${t.avg_grid_buyback.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-xs">
                    <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                      {t.trading_platform.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2 text-right text-gray-300">{t.transaction_count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 4: Energy Equity */}
      <section className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Energy Equity &amp; Justice</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">State</th>
                <th className="text-right py-2 pr-4">Low-Income Members %</th>
                <th className="text-right py-2 pr-4">Renter Members %</th>
                <th className="text-right py-2 pr-4">Apartment Members %</th>
                <th className="text-right py-2 pr-4">Indigenous Projects</th>
                <th className="text-right py-2 pr-4">Remote Projects</th>
                <th className="text-right py-2 pr-4">Justice Score</th>
                <th className="text-right py-2">Govt Subsidy ($/mbr)</th>
              </tr>
            </thead>
            <tbody>
              {dash.equity.map(e => (
                <tr key={e.state} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 font-semibold text-white">{e.state}</td>
                  <td className="py-2 pr-4 text-right text-amber-300">{e.low_income_participation_pct}%</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{e.renter_participation_pct}%</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{e.apartment_participation_pct}%</td>
                  <td className="py-2 pr-4 text-right text-teal-300">{e.indigenous_community_projects}</td>
                  <td className="py-2 pr-4 text-right text-blue-300">{e.remote_community_projects}</td>
                  <td className="py-2 pr-4 text-right">
                    <span className={`font-bold ${e.energy_justice_score >= 7.5 ? 'text-green-400' : e.energy_justice_score >= 6.5 ? 'text-amber-300' : 'text-red-400'}`}>
                      {e.energy_justice_score.toFixed(1)} / 10
                    </span>
                  </td>
                  <td className="py-2 text-right text-green-400">${e.govt_subsidy_per_member.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 5: Barriers */}
      <section className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Barriers to Community Energy Adoption</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Barrier</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">Severity</th>
                <th className="text-left py-2 pr-4">Affected Types</th>
                <th className="text-left py-2 pr-4">Proposed Solution</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {dash.barriers.map((b, i) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 text-gray-200 max-w-xs">{b.barrier}</td>
                  <td className="py-2 pr-4">
                    <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs">
                      {b.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge label={b.severity} colorClass={SEVERITY_BADGE[b.severity] ?? 'bg-gray-600 text-white'} />
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {b.affected_project_types.map(t => (
                        <span key={t} className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded text-xs">
                          {t.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-gray-400 text-xs max-w-xs">{b.proposed_solution}</td>
                  <td className="py-2">
                    <Badge label={b.implementation_status} colorClass={IMPL_BADGE[b.implementation_status] ?? 'bg-gray-600 text-white'} />
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
