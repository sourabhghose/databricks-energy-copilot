// Sprint 68c — Transmission Network Investment Analytics

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
  ReferenceArea,
} from 'recharts'
import { Network } from 'lucide-react'
import {
  getTransmissionInvestmentDashboard,
  TNIDashboard,
  TNIProjectRecord,
  TNIRabRecord,
  TNICapexRecord,
  TNIAerDeterminationRecord,
} from '../api/client'

// ─── colour palettes ──────────────────────────────────────────────────────────
const TNSP_BADGE: Record<string, string> = {
  TransGrid:   'bg-amber-900/60 text-amber-300 border border-amber-600',
  ElectraNet:  'bg-blue-900/60 text-blue-300 border border-blue-600',
  Powerlink:   'bg-purple-900/60 text-purple-300 border border-purple-600',
  AusNet:      'bg-rose-900/60 text-rose-300 border border-rose-600',
  TasNetworks: 'bg-emerald-900/60 text-emerald-300 border border-emerald-600',
}

const TNSP_LINE_COLOUR: Record<string, string> = {
  TransGrid:   '#f59e0b',
  ElectraNet:  '#3b82f6',
  Powerlink:   '#a855f7',
  AusNet:      '#ef4444',
  TasNetworks: '#10b981',
}

const PROJECT_TYPE_BADGE: Record<string, string> = {
  AUGMENTATION:  'bg-blue-900/60 text-blue-300 border border-blue-600',
  REZ:           'bg-emerald-900/60 text-emerald-300 border border-emerald-600',
  INTERCONNECTOR:'bg-purple-900/60 text-purple-300 border border-purple-600',
  REPLACEMENT:   'bg-slate-700/60 text-slate-300 border border-slate-500',
}

const STAGE_BADGE: Record<string, string> = {
  CONSTRUCTION: 'bg-amber-900/60 text-amber-300 border border-amber-600',
  APPROVED:     'bg-blue-900/60 text-blue-300 border border-blue-600',
  COMMISSIONED: 'bg-emerald-900/60 text-emerald-300 border border-emerald-600',
  PLANNING:     'bg-slate-700/60 text-slate-300 border border-slate-500',
}

// ─── shared helpers ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-1">
      <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-gray-500 text-xs">{sub}</span>
    </div>
  )
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{text}</span>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-base font-semibold text-gray-100 mb-3">{title}</h2>
  )
}

// ─── Projects Table ───────────────────────────────────────────────────────────
function ProjectsTable({ projects }: { projects: TNIProjectRecord[] }) {
  const sorted = [...projects].sort((a, b) => b.capex_approved_m - a.capex_approved_m)
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700/60">
            <tr>
              {['Project Name', 'TNSP', 'Type', 'Stage', 'Capex ($M)', '% Spent', 'BCR', 'MW Enabled', 'AER'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sorted.map(p => {
              const pctSpent = p.capex_approved_m > 0 ? (p.capex_spent_m / p.capex_approved_m) * 100 : 0
              return (
                <tr key={p.project_id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-3 py-2 text-gray-200 font-medium whitespace-nowrap">{p.project_name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Badge text={p.tnsp} cls={TNSP_BADGE[p.tnsp] ?? 'bg-gray-700 text-gray-300 border border-gray-600'} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Badge text={p.project_type} cls={PROJECT_TYPE_BADGE[p.project_type] ?? 'bg-gray-700 text-gray-300 border border-gray-600'} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Badge text={p.stage} cls={STAGE_BADGE[p.stage] ?? 'bg-gray-700 text-gray-300 border border-gray-600'} />
                  </td>
                  <td className="px-3 py-2 text-gray-200 text-right tabular-nums">${p.capex_approved_m.toLocaleString()}</td>
                  <td className="px-3 py-2 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-amber-500 transition-all"
                          style={{ width: `${Math.min(pctSpent, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-400 text-xs tabular-nums w-10 text-right">{pctSpent.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-200 text-right tabular-nums">{p.bcr.toFixed(1)}x</td>
                  <td className="px-3 py-2 text-gray-200 text-right tabular-nums">{p.mw_enabled.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center">
                    {p.aer_approved
                      ? <span className="text-emerald-400 font-bold">✓</span>
                      : <span className="text-red-400 font-bold">✗</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── RAB Bar Chart ────────────────────────────────────────────────────────────
function RabChart({ records }: { records: TNIRabRecord[] }) {
  const data = records.map(r => ({
    tnsp: r.tnsp,
    'RAB Opening ($M)': r.rab_opening_m,
    'RAB Closing ($M)': r.rab_closing_m,
  }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="tnsp" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v.toLocaleString()}`} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(v: number) => [`$${v.toLocaleString()}M`, '']}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        <Bar dataKey="RAB Opening ($M)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        <Bar dataKey="RAB Closing ($M)" fill="#6366f1" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Efficiency Score horizontal bars ────────────────────────────────────────
function EfficiencyScoreTable({ records }: { records: TNIRabRecord[] }) {
  const sorted = [...records].sort((a, b) => b.efficiency_score - a.efficiency_score)
  return (
    <div className="space-y-3">
      {sorted.map(r => (
        <div key={r.tnsp}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-300">{r.tnsp}</span>
            <span className="text-sm font-semibold text-emerald-400">{(r.efficiency_score * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all"
              style={{
                width: `${r.efficiency_score * 100}%`,
                background: `linear-gradient(to right, #059669, #10b981)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── CapEx Trend Line Chart ───────────────────────────────────────────────────
const TNSPS = ['TransGrid', 'ElectraNet', 'Powerlink', 'AusNet', 'TasNetworks']

function CapexTrendChart({ records }: { records: TNICapexRecord[] }) {
  const [selectedTnsp, setSelectedTnsp] = useState<string>('TransGrid')

  const filtered = records.filter(r => r.tnsp === selectedTnsp)
  const data = filtered.map(r => ({
    year: r.year,
    'CapEx ($M)': r.capex_m,
    'OpEx ($M)': r.opex_m,
    'Total Expenditure ($M)': r.total_expenditure_m,
  }))

  const colour = TNSP_LINE_COLOUR[selectedTnsp] ?? '#6366f1'

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {TNSPS.map(t => (
          <button
            key={t}
            onClick={() => setSelectedTnsp(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              selectedTnsp === t
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white hover:bg-gray-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => [`$${v.toFixed(1)}M`, '']}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <ReferenceArea x1={2023} x2={2028} fill="#4f46e5" fillOpacity={0.07} label={{ value: 'Reg. Period', fill: '#6366f1', fontSize: 10, position: 'insideTop' }} />
          <Line type="monotone" dataKey="CapEx ($M)" stroke={colour} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="OpEx ($M)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
          <Line type="monotone" dataKey="Total Expenditure ($M)" stroke="#f472b6" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── AER Determinations Table ─────────────────────────────────────────────────
function AerDeterminationsTable({ determinations }: { determinations: TNIAerDeterminationRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700/60">
            <tr>
              {['TNSP', 'Period', 'Allowed Revenue ($M)', 'Proposed ($M)', 'Reduction ($M)', 'WACC (%)', 'CapEx Allowance ($M)', 'RAB Approved ($M)', 'Key Decision'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {determinations.map(d => (
              <tr key={d.determination_id} className="hover:bg-gray-700/30 transition-colors">
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge text={d.tnsp} cls={TNSP_BADGE[d.tnsp] ?? 'bg-gray-700 text-gray-300 border border-gray-600'} />
                </td>
                <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{d.period_start}–{d.period_end}</td>
                <td className="px-3 py-2 text-gray-200 text-right tabular-nums">${d.allowed_revenue_m.toLocaleString()}</td>
                <td className="px-3 py-2 text-gray-400 text-right tabular-nums">${d.proposed_revenue_m.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className="text-red-400 font-semibold">-${d.revenue_reduction_m.toLocaleString()}</span>
                </td>
                <td className="px-3 py-2 text-gray-200 text-right tabular-nums">{d.wacc_approved_pct.toFixed(1)}%</td>
                <td className="px-3 py-2 text-gray-200 text-right tabular-nums">${d.capex_allowance_m.toLocaleString()}</td>
                <td className="px-3 py-2 text-gray-200 text-right tabular-nums">${d.rab_approved_m.toLocaleString()}</td>
                <td className="px-3 py-2 text-gray-400 max-w-xs">
                  <span title={d.key_decision}>
                    {d.key_decision.length > 60 ? d.key_decision.slice(0, 60) + '…' : d.key_decision}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TransmissionInvestmentAnalytics() {
  const [data, setData] = useState<TNIDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTransmissionInvestmentDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <div className="text-gray-400 animate-pulse">Loading Transmission Investment Analytics...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <div className="text-red-400">{error ?? 'Unknown error'}</div>
      </div>
    )
  }

  const summary = data.summary as Record<string, number>

  return (
    <div className="min-h-screen bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-900/50 rounded-lg border border-indigo-700">
          <Network size={22} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Transmission Network Investment Analytics</h1>
          <p className="text-gray-400 text-sm">TNSP capital expenditure programs, RAB, revenue and AER regulatory determinations</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Total Approved CapEx"
          value={`$${summary.total_capex_approved_bn}B`}
          sub={`${summary.total_projects} projects across ${summary.tnsp_count} TNSPs`}
        />
        <KpiCard
          label="Under Construction"
          value={String(summary.projects_under_construction)}
          sub="projects actively being built"
        />
        <KpiCard
          label="Total MW Enabled"
          value={`${(summary.total_mw_enabled / 1000).toFixed(1)} GW`}
          sub={`${summary.interconnector_projects} interconnector · ${summary.rez_projects} REZ`}
        />
        <KpiCard
          label="Average BCR"
          value={`${summary.avg_bcr}x`}
          sub="benefit-cost ratio across projects"
        />
      </div>

      {/* Projects Table */}
      <div>
        <SectionHeader title="Capital Investment Projects (sorted by approved CapEx)" />
        <ProjectsTable projects={data.projects} />
      </div>

      {/* RAB & Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <SectionHeader title="RAB — Opening vs Closing ($M)" />
          <RabChart records={data.rab_records} />
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <SectionHeader title="Efficiency Scores by TNSP" />
          <div className="mt-2">
            <EfficiencyScoreTable records={data.rab_records} />
          </div>
          <div className="mt-6">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide font-medium">Revenue Cap vs Actual ($M)</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left pb-1">TNSP</th>
                  <th className="text-right pb-1">Cap ($M)</th>
                  <th className="text-right pb-1">Actual ($M)</th>
                  <th className="text-right pb-1">WACC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {data.rab_records.map(r => (
                  <tr key={r.tnsp}>
                    <td className="py-1 text-gray-300">{r.tnsp}</td>
                    <td className="py-1 text-gray-300 text-right">${r.revenue_cap_m}</td>
                    <td className={`py-1 text-right ${r.revenue_actual_m > r.revenue_cap_m ? 'text-red-400' : 'text-emerald-400'}`}>${r.revenue_actual_m}</td>
                    <td className="py-1 text-gray-300 text-right">{r.wacc_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CapEx Trend */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <SectionHeader title="CapEx & OpEx Trend by TNSP (2022–2028)" />
        <CapexTrendChart records={data.capex_records} />
      </div>

      {/* AER Determinations */}
      <div>
        <SectionHeader title="AER Regulatory Determinations" />
        <AerDeterminationsTable determinations={data.aer_determinations} />
      </div>
    </div>
  )
}
