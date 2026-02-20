// Sprint 60b — TNSP Revenue & Investment Analytics

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
import { Network } from 'lucide-react'
import {
  getTnspAnalyticsDashboard,
  TnspAnalyticsDashboard,
  TNATnspRecord,
  TNAReliabilityRecord,
  TNAProjectRecord,
  TNARegulatoryRecord,
} from '../api/client'

// ─── colour palette ───────────────────────────────────────────────────────────
const TNSP_COLOURS: Record<string, string> = {
  TransGrid:              '#f59e0b',
  ElectraNet:             '#3b82f6',
  TasNetworks:            '#10b981',
  Powerlink:              '#a855f7',
  'AusNet Transmission':  '#ef4444',
}

const PROJECT_TYPE_COLOURS: Record<string, string> = {
  AUGMENTATION: '#f59e0b',
  REPLACEMENT:  '#64748b',
  UPGRADE:      '#3b82f6',
  NEW_BUILD:    '#10b981',
}

const AER_DECISION_STYLES: Record<string, string> = {
  ACCEPTED: 'bg-emerald-900/60 text-emerald-300 border border-emerald-600',
  REVISED:  'bg-amber-900/60 text-amber-300 border border-amber-600',
  REJECTED: 'bg-red-900/60 text-red-300 border border-red-600',
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETE:     'bg-emerald-900/60 text-emerald-300 border border-emerald-600',
  CONSTRUCTION: 'bg-amber-900/60 text-amber-300 border border-amber-600',
  APPROVED:     'bg-blue-900/60 text-blue-300 border border-blue-600',
  PROPOSED:     'bg-slate-700/60 text-slate-300 border border-slate-500',
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col gap-1">
      <span className="text-slate-400 text-xs uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-slate-400 text-xs">{sub}</span>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function TnspAnalytics() {
  const [data, setData] = useState<TnspAnalyticsDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTnspAnalyticsDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-red-400">Failed to load TNSP analytics: {error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400 animate-pulse">Loading TNSP analytics...</p>
      </div>
    )
  }

  const tnsps: TNATnspRecord[]               = data.tnsps
  const reliability: TNAReliabilityRecord[]  = data.reliability
  const projects: TNAProjectRecord[]         = data.projects
  const regulatory: TNARegulatoryRecord[]    = data.regulatory

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalRab     = tnsps.reduce((s, t) => s + t.regulated_asset_base_bn_aud, 0)
  const totalRevenue = tnsps.reduce((s, t) => s + t.revenue_determination_bn_aud, 0)
  const avgWacc      = tnsps.reduce((s, t) => s + t.wacc_real_pct, 0) / tnsps.length

  const latestYear    = Math.max(...reliability.map(r => r.year))
  const latestRel     = reliability.filter(r => r.year === latestYear)
  const mostConstrained = latestRel.reduce(
    (prev, cur) => cur.saidi_minutes > prev.saidi_minutes ? cur : prev,
    latestRel[0],
  )

  // ── SAIDI trend (line chart) ───────────────────────────────────────────────
  const years = [...new Set(reliability.map(r => r.year))].sort()
  const saidiTrend = years.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    tnsps.forEach(t => {
      const rec = reliability.find(r => r.tnsp === t.tnsp_name && r.year === yr)
      if (rec) row[t.tnsp_name] = rec.saidi_minutes
    })
    return row
  })

  // ── Investment pipeline (stacked bar) ─────────────────────────────────────
  const investByTnsp: Record<string, Record<string, number>> = {}
  projects.forEach(p => {
    if (!investByTnsp[p.tnsp]) investByTnsp[p.tnsp] = {}
    investByTnsp[p.tnsp][p.project_type] = (investByTnsp[p.tnsp][p.project_type] ?? 0) + p.investment_m_aud
  })
  const pipelineData = Object.entries(investByTnsp).map(([tnsp, types]) => ({ tnsp, ...types }))
  const allProjectTypes = [...new Set(projects.map(p => p.project_type))]

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600/20 rounded-lg">
          <Network className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">TNSP Revenue &amp; Investment Analytics</h1>
          <p className="text-slate-400 text-sm">
            AER revenue determinations · network capex/opex · reliability performance · transmission asset management
          </p>
        </div>
        <span className="ml-auto text-slate-500 text-xs">
          Updated {new Date(data.timestamp).toLocaleString()}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total RAB"
          value={`$${totalRab.toFixed(1)} bn`}
          sub="Regulated Asset Base (all TNSPs)"
        />
        <KpiCard
          label="Total Annual Revenue"
          value={`$${totalRevenue.toFixed(2)} bn`}
          sub="Revenue determination (all TNSPs)"
        />
        <KpiCard
          label="Average WACC (real)"
          value={`${avgWacc.toFixed(2)}%`}
          sub="Weighted average across 5 TNSPs"
        />
        <KpiCard
          label="Most Constrained TNSP"
          value={mostConstrained?.tnsp ?? '-'}
          sub={`SAIDI ${mostConstrained?.saidi_minutes.toFixed(1)} min (${latestYear})`}
        />
      </div>

      {/* TNSP Comparison Table */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700">
          <h2 className="text-base font-semibold text-slate-200">TNSP Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 uppercase text-xs border-b border-slate-700">
                <th className="text-left px-4 py-3">TNSP</th>
                <th className="text-left px-4 py-3">State</th>
                <th className="text-right px-4 py-3">RAB (bn AUD)</th>
                <th className="text-right px-4 py-3">Revenue (bn AUD)</th>
                <th className="text-right px-4 py-3">WACC %</th>
                <th className="text-right px-4 py-3">Network (km)</th>
                <th className="text-right px-4 py-3">Substations</th>
                <th className="text-right px-4 py-3">Capex (M/yr)</th>
                <th className="text-right px-4 py-3">Opex (M/yr)</th>
                <th className="text-left px-4 py-3">Period</th>
              </tr>
            </thead>
            <tbody>
              {tnsps.map((t, i) => (
                <tr
                  key={t.tnsp_id}
                  className={`border-b border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/60'} hover:bg-slate-700/40 transition-colors`}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: TNSP_COLOURS[t.tnsp_name] ?? '#94a3b8' }}>
                    {t.tnsp_name}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{t.state}</td>
                  <td className="px-4 py-3 text-right text-amber-300">${t.regulated_asset_base_bn_aud.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right text-emerald-300">${t.revenue_determination_bn_aud.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-slate-200">{t.wacc_real_pct.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-slate-300">{t.network_length_km.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{t.substations}</td>
                  <td className="px-4 py-3 text-right text-blue-300">${t.capex_m_aud_yr.toFixed(0)}M</td>
                  <td className="px-4 py-3 text-right text-purple-300">${t.opex_m_aud_yr.toFixed(0)}M</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{t.determination_period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SAIDI reliability trend */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-base font-semibold text-slate-200 mb-4">SAIDI Reliability Trend (minutes)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={saidiTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} unit=" min" />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v: number, name: string) => [`${v.toFixed(2)} min`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {tnsps.map(t => (
                <Line
                  key={t.tnsp_id}
                  type="monotone"
                  dataKey={t.tnsp_name}
                  stroke={TNSP_COLOURS[t.tnsp_name] ?? '#94a3b8'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* Project investment pipeline */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-base font-semibold text-slate-200 mb-4">Investment Pipeline by TNSP (M AUD)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={pipelineData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="tnsp" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} unit="M" />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v: number, name: string) => [`$${v.toFixed(0)}M`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {allProjectTypes.map(pt => (
                <Bar
                  key={pt}
                  dataKey={pt}
                  stackId="a"
                  fill={PROJECT_TYPE_COLOURS[pt] ?? '#64748b'}
                  name={pt.replace(/_/g, ' ')}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3">
            {allProjectTypes.map(pt => (
              <span key={pt} className="flex items-center gap-1.5 text-xs text-slate-300">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: PROJECT_TYPE_COLOURS[pt] ?? '#64748b' }}
                />
                {pt.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* Regulatory Performance Table */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700">
          <h2 className="text-base font-semibold text-slate-200">
            Regulatory Performance — AER Revenue Determinations
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 uppercase text-xs border-b border-slate-700">
                <th className="text-left px-4 py-3">TNSP</th>
                <th className="text-left px-4 py-3">Regulatory Period</th>
                <th className="text-right px-4 py-3">Allowed Revenue (M)</th>
                <th className="text-right px-4 py-3">Actual Revenue (M)</th>
                <th className="text-right px-4 py-3">Variance (M)</th>
                <th className="text-right px-4 py-3">Efficiency Carryover (M)</th>
                <th className="text-right px-4 py-3">CPI Escalator %</th>
                <th className="text-center px-4 py-3">AER Decision</th>
              </tr>
            </thead>
            <tbody>
              {regulatory.map((r, i) => {
                const variance = r.actual_revenue_m_aud - r.allowed_revenue_m_aud
                return (
                  <tr
                    key={`${r.tnsp}-${r.regulatory_period}`}
                    className={`border-b border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/60'} hover:bg-slate-700/40 transition-colors`}
                  >
                    <td
                      className="px-4 py-3 font-medium"
                      style={{ color: TNSP_COLOURS[r.tnsp] ?? '#94a3b8' }}
                    >
                      {r.tnsp}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.regulatory_period}</td>
                    <td className="px-4 py-3 text-right text-slate-200">
                      ${r.allowed_revenue_m_aud.toLocaleString()}M
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200">
                      ${r.actual_revenue_m_aud.toLocaleString()}M
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {variance >= 0 ? '+' : ''}${variance.toFixed(0)}M
                    </td>
                    <td className="px-4 py-3 text-right text-amber-300">
                      ${r.efficiency_carryover_m_aud.toFixed(1)}M
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {r.cpi_escalator_pct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${AER_DECISION_STYLES[r.aer_decision] ?? ''}`}>
                        {r.aer_decision}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Project Details Table */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700">
          <h2 className="text-base font-semibold text-slate-200">Transmission Project Pipeline</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 uppercase text-xs border-b border-slate-700">
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-left px-4 py-3">TNSP</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Investment (M AUD)</th>
                <th className="text-right px-4 py-3">COD</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Primary Driver</th>
                <th className="text-right px-4 py-3">VRE Enabled (MW)</th>
              </tr>
            </thead>
            <tbody>
              {projects
                .slice()
                .sort((a, b) => b.investment_m_aud - a.investment_m_aud)
                .map((p, i) => (
                  <tr
                    key={`${p.project_name}-${p.tnsp}`}
                    className={`border-b border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/60'} hover:bg-slate-700/40 transition-colors`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-100">{p.project_name}</td>
                    <td
                      className="px-4 py-3 font-medium"
                      style={{ color: TNSP_COLOURS[p.tnsp] ?? '#94a3b8' }}
                    >
                      {p.tnsp}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300 border border-slate-600">
                        {p.project_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-amber-300">
                      {p.investment_m_aud >= 1000
                        ? `$${(p.investment_m_aud / 1000).toFixed(1)}B`
                        : `$${p.investment_m_aud.toFixed(0)}M`}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{p.commissioning_year}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLES[p.status] ?? ''}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {p.primary_driver.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400">
                      {p.vre_enabled_mw > 0 ? `${p.vre_enabled_mw.toLocaleString()} MW` : '-'}
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
