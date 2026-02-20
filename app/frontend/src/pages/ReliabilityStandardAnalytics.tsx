// Sprint 61a — NEM Reliability Standard & Unserved Energy (USE) Analytics

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
  ReferenceLine,
  Cell,
} from 'recharts'
import { ShieldCheck } from 'lucide-react'
import {
  getReliabilityStandardDashboard,
  ReliabilityStandardDashboard,
  RSAUseRecord,
  RSAReserveMarginRecord,
  RSAReliabilityEventRecord,
  RSADemandSideRecord,
} from '../api/client'

// ─── colour palette ───────────────────────────────────────────────────────────

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#f59e0b',
  VIC1: '#3b82f6',
  QLD1: '#10b981',
  SA1:  '#ef4444',
  TAS1: '#a855f7',
}

const COMPLIANCE_STYLES: Record<string, string> = {
  COMPLIANT: 'bg-emerald-900/60 text-emerald-300 border border-emerald-600',
  AT_RISK:   'bg-amber-900/60 text-amber-300 border border-amber-600',
  BREACH:    'bg-red-900/60 text-red-300 border border-red-600',
}

const CAUSE_STYLES: Record<string, string> = {
  GENERATION_SHORTFALL: 'bg-red-900/60 text-red-300 border border-red-600',
  NETWORK_FAILURE:      'bg-orange-900/60 text-orange-300 border border-orange-600',
  EXTREME_WEATHER:      'bg-blue-900/60 text-blue-300 border border-blue-600',
  DEMAND_SURGE:         'bg-yellow-900/60 text-yellow-300 border border-yellow-600',
  EQUIPMENT_FAILURE:    'bg-slate-700/60 text-slate-300 border border-slate-500',
}

const MECHANISM_COLOURS: Record<string, string> = {
  RERT:               '#f59e0b',
  DSP:                '#3b82f6',
  VPP:                '#10b981',
  INTERRUPTIBLE_LOAD: '#a855f7',
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: {
  label: string
  value: string
  sub: string
  accent?: string
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col gap-1">
      <span className="text-slate-400 text-xs uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</span>
      <span className="text-slate-400 text-xs">{sub}</span>
    </div>
  )
}

function Badge({ text, styleClass }: { text: string; styleClass: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${styleClass}`}>
      {text}
    </span>
  )
}

// ─── chart data builders ──────────────────────────────────────────────────────

function buildReserveMarginChartData(records: RSAReserveMarginRecord[]) {
  const years = [...new Set(records.map(r => r.year))].sort()
  return years.map(yr => {
    const entry: Record<string, unknown> = { year: yr.toString() }
    for (const region of ['NSW1', 'VIC1', 'QLD1', 'SA1', 'TAS1']) {
      const rec = records.find(r => r.year === yr && r.region === region)
      entry[region] = rec ? +rec.reserve_margin_pct.toFixed(1) : null
    }
    return entry
  })
}

function buildDemandSideChartData(records: RSADemandSideRecord[]) {
  const mechanisms = [...new Set(records.map(r => r.mechanism))]
  return mechanisms.map(mech => {
    const subset = records.filter(r => r.mechanism === mech)
    return {
      mechanism: mech.replace('_', ' '),
      registered_mw: +subset.reduce((s, r) => s + r.registered_mw, 0).toFixed(0),
      activated_mw:  +subset.reduce((s, r) => s + r.activated_mw, 0).toFixed(0),
    }
  })
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ReliabilityStandardAnalytics() {
  const [data, setData] = useState<ReliabilityStandardDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getReliabilityStandardDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-red-400">Failed to load reliability analytics: {error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400 animate-pulse">Loading reliability standard analytics…</p>
      </div>
    )
  }

  const { use_records, reserve_margins, events, demand_side } = data

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const latestYear = Math.max(...use_records.map(r => r.year))
  const latestUse = use_records.filter(r => r.year === latestYear)
  const nationalUseMwh = latestUse.reduce((s, r) => s + r.unserved_energy_mwh, 0)
  const breachCount = latestUse.filter(r => r.compliance === 'BREACH').length
  const allReserveMargins = reserve_margins.filter(r => r.year === latestYear)
  const tightestMargin = Math.min(...allReserveMargins.map(r => r.reserve_margin_pct))
  const totalRegisteredMw = demand_side.reduce((s, r) => s + r.registered_mw, 0)

  // ── USE compliance table data (pivot region × year) ───────────────────────
  const years = [...new Set(use_records.map(r => r.year))].sort()
  const regions = [...new Set(use_records.map(r => r.region))]

  // ── Chart data ────────────────────────────────────────────────────────────
  const reserveChartData = buildReserveMarginChartData(reserve_margins)
  const demandSideChartData = buildDemandSideChartData(demand_side)

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-white">NEM Reliability Standard & USE Analytics</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Unserved Energy tracking · Reserve margins · Demand-side adequacy · NEM 0.002% standard
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="National USE (MWh)"
          value={nationalUseMwh.toFixed(1)}
          sub={`Total unserved energy ${latestYear}`}
          accent="text-amber-300"
        />
        <KpiCard
          label="Regions in BREACH"
          value={String(breachCount)}
          sub={`Of 5 NEM regions in ${latestYear}`}
          accent={breachCount > 0 ? 'text-red-400' : 'text-emerald-400'}
        />
        <KpiCard
          label="Tightest Reserve Margin"
          value={`${tightestMargin.toFixed(1)}%`}
          sub={`Lowest across regions ${latestYear}`}
          accent={tightestMargin < 15 ? 'text-red-400' : 'text-emerald-400'}
        />
        <KpiCard
          label="Demand-Side Registered"
          value={`${totalRegisteredMw.toFixed(0)} MW`}
          sub="Total registered capacity (all mechanisms)"
          accent="text-blue-300"
        />
      </div>

      {/* USE compliance table */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">USE Compliance by Region &amp; Year</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                <th className="text-left py-2 pr-4">Region</th>
                {years.map(yr => (
                  <th key={yr} className="text-center py-2 px-3" colSpan={3}>
                    {yr}
                  </th>
                ))}
              </tr>
              <tr className="text-slate-500 text-xs border-b border-slate-700/50">
                <th className="py-1.5 pr-4"></th>
                {years.map(yr => (
                  <>
                    <th key={`${yr}-use`} className="text-center px-2 py-1.5">USE %</th>
                    <th key={`${yr}-std`} className="text-center px-2 py-1.5">Std %</th>
                    <th key={`${yr}-status`} className="text-center px-2 py-1.5">Status</th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {regions.map(region => (
                <tr key={region} className="border-b border-slate-700/40 hover:bg-slate-700/20">
                  <td className="py-2.5 pr-4">
                    <span
                      className="font-semibold text-sm"
                      style={{ color: REGION_COLOURS[region] ?? '#94a3b8' }}
                    >
                      {region}
                    </span>
                  </td>
                  {years.map(yr => {
                    const rec = use_records.find(r => r.region === region && r.year === yr)
                    return (
                      <>
                        <td key={`${region}-${yr}-use`} className="text-center px-2 py-2.5 text-white font-mono text-xs">
                          {rec ? (rec.use_pct * 100).toFixed(5) : '—'}%
                        </td>
                        <td key={`${region}-${yr}-std`} className="text-center px-2 py-2.5 text-slate-400 font-mono text-xs">
                          {rec ? (rec.standard_pct * 100).toFixed(3) : '—'}%
                        </td>
                        <td key={`${region}-${yr}-status`} className="text-center px-2 py-2.5">
                          {rec ? (
                            <Badge
                              text={rec.compliance}
                              styleClass={COMPLIANCE_STYLES[rec.compliance] ?? 'bg-slate-700 text-slate-300'}
                            />
                          ) : '—'}
                        </td>
                      </>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Reserve margin trend line chart */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-lg font-semibold text-white mb-1">Reserve Margin Trend by Region</h2>
        <p className="text-slate-400 text-xs mb-4">Dashed line = 15% required threshold</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={reserveChartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(value: number) => [`${value}%`, '']}
            />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="6 4" label={{ value: '15% Required', fill: '#ef4444', fontSize: 11 }} />
            {(['NSW1', 'VIC1', 'QLD1', 'SA1', 'TAS1'] as const).map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLOURS[region]}
                strokeWidth={2}
                dot={{ r: 4, fill: REGION_COLOURS[region] }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Reliability events table */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Reliability Events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                <th className="text-left py-2 pr-3">Date</th>
                <th className="text-left py-2 pr-3">Region</th>
                <th className="text-left py-2 pr-3">Cause</th>
                <th className="text-right py-2 pr-3">Duration (hr)</th>
                <th className="text-right py-2 pr-3">Customers (k)</th>
                <th className="text-right py-2 pr-3">USE (MWh)</th>
                <th className="text-right py-2 pr-3">Est. Cost ($M)</th>
                <th className="text-center py-2">NEM Intervention</th>
              </tr>
            </thead>
            <tbody>
              {events
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((ev: RSAReliabilityEventRecord) => (
                  <tr key={ev.event_id} className="border-b border-slate-700/40 hover:bg-slate-700/20">
                    <td className="py-2.5 pr-3 text-slate-300 font-mono text-xs">{ev.date}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className="font-semibold text-xs"
                        style={{ color: REGION_COLOURS[ev.region] ?? '#94a3b8' }}
                      >
                        {ev.region}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge
                        text={ev.cause.replace(/_/g, ' ')}
                        styleClass={CAUSE_STYLES[ev.cause] ?? 'bg-slate-700 text-slate-300'}
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-right text-white font-mono">{ev.duration_hr.toFixed(1)}</td>
                    <td className="py-2.5 pr-3 text-right text-white font-mono">{ev.customers_affected_k}</td>
                    <td className="py-2.5 pr-3 text-right text-amber-300 font-mono">{ev.use_mwh.toFixed(1)}</td>
                    <td className="py-2.5 pr-3 text-right text-white font-mono">{ev.estimated_cost_m_aud.toFixed(1)}</td>
                    <td className="py-2.5 text-center">
                      {ev.nem_intervention ? (
                        <Badge text="Yes" styleClass="bg-red-900/60 text-red-300 border border-red-600" />
                      ) : (
                        <Badge text="No" styleClass="bg-slate-700/60 text-slate-400 border border-slate-600" />
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Demand-side mechanism bar chart */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-lg font-semibold text-white mb-1">Demand-Side Participation — Registered vs Activated Capacity</h2>
        <p className="text-slate-400 text-xs mb-4">Aggregated across all regions by mechanism</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={demandSideChartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="mechanism" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(value: number) => [`${value} MW`, '']}
            />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <Bar dataKey="registered_mw" name="Registered MW" radius={[4, 4, 0, 0]}>
              {demandSideChartData.map((entry) => (
                <Cell
                  key={entry.mechanism}
                  fill={MECHANISM_COLOURS[entry.mechanism.replace(' ', '_')] ?? '#64748b'}
                  fillOpacity={0.7}
                />
              ))}
            </Bar>
            <Bar dataKey="activated_mw" name="Activated MW" radius={[4, 4, 0, 0]}>
              {demandSideChartData.map((entry) => (
                <Cell
                  key={entry.mechanism}
                  fill={MECHANISM_COLOURS[entry.mechanism.replace(' ', '_')] ?? '#64748b'}
                  fillOpacity={1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Demand-side detail table */}
        <div className="overflow-x-auto mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                <th className="text-left py-2 pr-3">Mechanism</th>
                <th className="text-left py-2 pr-3">Region</th>
                <th className="text-right py-2 pr-3">Registered (MW)</th>
                <th className="text-right py-2 pr-3">Activated (MW)</th>
                <th className="text-right py-2 pr-3">Events / yr</th>
                <th className="text-right py-2 pr-3">Cost ($/MWh)</th>
                <th className="text-right py-2">Reliability Contrib %</th>
              </tr>
            </thead>
            <tbody>
              {demand_side.map((rec: RSADemandSideRecord, i: number) => (
                <tr key={i} className="border-b border-slate-700/40 hover:bg-slate-700/20">
                  <td className="py-2.5 pr-3">
                    <span
                      className="font-semibold text-xs"
                      style={{ color: MECHANISM_COLOURS[rec.mechanism] ?? '#94a3b8' }}
                    >
                      {rec.mechanism.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className="text-xs font-medium"
                      style={{ color: REGION_COLOURS[rec.region] ?? '#94a3b8' }}
                    >
                      {rec.region}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-white font-mono">{rec.registered_mw.toFixed(0)}</td>
                  <td className="py-2.5 pr-3 text-right text-emerald-300 font-mono">{rec.activated_mw.toFixed(0)}</td>
                  <td className="py-2.5 pr-3 text-right text-slate-300 font-mono">{rec.activation_events_yr}</td>
                  <td className="py-2.5 pr-3 text-right text-slate-300 font-mono">{rec.cost_aud_mwh.toFixed(1)}</td>
                  <td className="py-2.5 text-right text-amber-300 font-mono">{rec.reliability_contribution_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
