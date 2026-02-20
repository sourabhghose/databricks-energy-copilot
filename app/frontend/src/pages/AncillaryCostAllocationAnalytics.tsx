import { useEffect, useState } from 'react'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { DollarSign, AlertTriangle, Users, Layers } from 'lucide-react'
import {
  getAncillaryCostAllocationDashboard,
  ASADashboard,
} from '../api/client'

// ── Colour palette ─────────────────────────────────────────────────────────
const SERVICE_COLOURS: Record<string, string> = {
  RAISE6SEC:  '#10b981',
  LOWER6SEC:  '#34d399',
  RAISE60SEC: '#3b82f6',
  LOWER60SEC: '#60a5fa',
  RAISE5MIN:  '#f59e0b',
  LOWER5MIN:  '#fcd34d',
  RAISEREG:   '#f43f5e',
  LOWERREG:   '#fb7185',
}

const PARTICIPANT_TYPE_STYLES: Record<string, string> = {
  GENERATOR:     'bg-blue-900 text-blue-200',
  LOAD:          'bg-orange-900 text-orange-200',
  INTERCONNECTOR:'bg-purple-900 text-purple-200',
}

const COMPLIANCE_STYLES: Record<string, string> = {
  COMPLIANT: 'bg-green-900 text-green-200',
  WATCH:     'bg-yellow-900 text-yellow-200',
  BREACH:    'bg-red-900 text-red-200',
}

const DIRECTION_STYLES: Record<string, string> = {
  RAISE: 'bg-green-900 text-green-200',
  LOWER: 'bg-blue-900 text-blue-200',
}

const PERIODS = ['2024-10', '2024-11', '2024-12', '2025-01', '2025-02']
const SERVICES = ['RAISE6SEC','LOWER6SEC','RAISE60SEC','LOWER60SEC','RAISE5MIN','LOWER5MIN','RAISEREG','LOWERREG']

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = 'text-emerald-400',
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-start gap-3">
      <div className={`mt-0.5 ${accent}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold ${accent}`}>{value}</p>
        {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function AncillaryCostAllocationAnalytics() {
  const [data, setData] = useState<ASADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('2025-02')

  useEffect(() => {
    getAncillaryCostAllocationDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">Loading ancillary cost data...</p>
    </div>
  )
  if (error || !data) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-red-400">Error: {error ?? 'No data returned'}</p>
    </div>
  )

  const summary = data.summary as Record<string, string | number>

  // ── Cost by service chart data for selected period ─────────────────────
  const costChartData = SERVICES.map(svc => {
    const rec = data.cost_records.find(
      r => r.period === selectedPeriod && r.service === svc
    )
    return {
      service: svc.replace('SEC', 's').replace('MIN', 'm').replace('REG', 'Reg'),
      total_cost_m: rec?.total_cost_m ?? 0,
      gen_cost: rec ? parseFloat(((rec.total_cost_m * rec.generator_contribution_pct) / 100).toFixed(2)) : 0,
      load_cost: rec ? parseFloat(((rec.total_cost_m * rec.load_contribution_pct) / 100).toFixed(2)) : 0,
    }
  })

  // ── Cost trend chart data ─────────────────────────────────────────────
  const trendChartData = data.trends.map(t => ({
    label: `${t.year} ${t.quarter}`,
    raise: t.raise_cost_m,
    lower: t.lower_cost_m,
    regulation: t.regulation_cost_m,
    contingency: t.contingency_cost_m,
    ibr: t.ibr_penetration_pct,
  }))

  // ── Participants sorted by total liability descending ──────────────────
  const sortedParticipants = [...data.participants].sort(
    (a, b) => b.total_liability_m - a.total_liability_m
  )

  // ── Max CPF for bar scaling ────────────────────────────────────────────
  const maxCpf = Math.max(...data.causer_pays.map(c => c.cpf_score), 0.1)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <DollarSign className="text-emerald-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Ancillary Services Cost Allocation Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            NEM FCAS cost recovery, causer-pays methodology, and participant liability tracking
          </p>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Layers}
          label="Total FCAS Services"
          value={String(summary.total_services ?? 8)}
          sub="Contingency + Regulation"
          accent="text-emerald-400"
        />
        <KpiCard
          icon={Users}
          label="Total Participants"
          value={String(summary.total_participants ?? 0)}
          sub="Generators, Loads, Interconnectors"
          accent="text-blue-400"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Breach Participants"
          value={String(summary.breach_participants ?? 0)}
          sub="Exceeding CPF threshold"
          accent="text-red-400"
        />
        <KpiCard
          icon={DollarSign}
          label="Avg Annual FCAS Cost"
          value={`$${Number(summary.avg_annual_fcas_cost_m ?? 0).toFixed(1)}M`}
          sub={`Highest cost: ${summary.highest_cost_service ?? 'RAISEREG'}`}
          accent="text-yellow-400"
        />
      </div>

      {/* ── FCAS Cost by Service Chart ───────────────────────────────────── */}
      <div className="bg-gray-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">FCAS Cost by Service</h2>
            <p className="text-gray-400 text-xs">Total cost ($M) per service — generator vs load split</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  selectedPeriod === p
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={costChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="service" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="$M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number, name: string) => [`$${v.toFixed(2)}M`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="gen_cost" name="Generator Contribution" stackId="split" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="load_cost" name="Load Contribution" stackId="split" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {/* Service colour legend */}
        <div className="mt-3 flex flex-wrap gap-2">
          {SERVICES.map(svc => (
            <span key={svc} className="flex items-center gap-1 text-xs text-gray-400">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: SERVICE_COLOURS[svc] }}
              />
              {svc}
            </span>
          ))}
        </div>
      </div>

      {/* ── Participant Liability Table ──────────────────────────────────── */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white mb-1">Participant Liability</h2>
        <p className="text-gray-400 text-xs mb-4">Sorted by total liability (descending) — all values in $M</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-700">
                <th className="text-left py-2 pr-4">Participant</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">Region</th>
                <th className="text-right py-2 pr-4">Total ($M)</th>
                <th className="text-right py-2 pr-4">Raise ($M)</th>
                <th className="text-right py-2 pr-4">Lower ($M)</th>
                <th className="text-right py-2 pr-4">Reg ($M)</th>
                <th className="text-right py-2 pr-4">CPF Score</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedParticipants.map((p, i) => (
                <tr
                  key={p.participant_id}
                  className={`border-b border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-800/30' : 'bg-gray-900/20'}`}
                >
                  <td className="py-2.5 pr-4 text-white font-medium">{p.participant_name}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${PARTICIPANT_TYPE_STYLES[p.participant_type] ?? 'bg-gray-700 text-gray-300'}`}>
                      {p.participant_type}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-300">{p.region}</td>
                  <td className="py-2.5 pr-4 text-right text-yellow-400 font-semibold">${p.total_liability_m.toFixed(1)}</td>
                  <td className="py-2.5 pr-4 text-right text-green-400">${p.raise_liability_m.toFixed(1)}</td>
                  <td className="py-2.5 pr-4 text-right text-blue-400">${p.lower_liability_m.toFixed(1)}</td>
                  <td className="py-2.5 pr-4 text-right text-purple-400">${p.regulation_liability_m.toFixed(1)}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-300 font-mono">{p.causer_pays_factor.toFixed(3)}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${COMPLIANCE_STYLES[p.compliance_status] ?? 'bg-gray-700 text-gray-300'}`}>
                      {p.compliance_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FCAS Cost Trend Chart ────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white mb-1">FCAS Cost Trend (2020–2025)</h2>
        <p className="text-gray-400 text-xs mb-4">
          Stacked area: raise / lower / regulation / contingency — line: IBR penetration (right axis)
        </p>
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={trendChartData} margin={{ top: 10, right: 60, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              interval={3}
              angle={-30}
              textAnchor="end"
              height={45}
            />
            <YAxis
              yAxisId="cost"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              unit="$M"
            />
            <YAxis
              yAxisId="ibr"
              orientation="right"
              tick={{ fill: '#a78bfa', fontSize: 11 }}
              unit="%"
              domain={[0, 60]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number, name: string) =>
                name === 'IBR Penetration'
                  ? [`${v.toFixed(1)}%`, name]
                  : [`$${v.toFixed(1)}M`, name]
              }
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Area yAxisId="cost" type="monotone" dataKey="raise"       name="Raise"       stackId="1" fill="#10b981" stroke="#10b981" fillOpacity={0.7} />
            <Area yAxisId="cost" type="monotone" dataKey="lower"       name="Lower"       stackId="1" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.7} />
            <Area yAxisId="cost" type="monotone" dataKey="regulation"  name="Regulation"  stackId="1" fill="#f43f5e" stroke="#f43f5e" fillOpacity={0.7} />
            <Area yAxisId="cost" type="monotone" dataKey="contingency" name="Contingency" stackId="1" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.7} />
            <Area
              yAxisId="ibr"
              type="monotone"
              dataKey="ibr"
              name="IBR Penetration"
              fill="none"
              stroke="#a78bfa"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Causer-Pays Table ────────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white mb-1">Causer-Pays Analysis</h2>
        <p className="text-gray-400 text-xs mb-4">
          Measurement period: 2025-Q1 — CPF bar scaled 0–{maxCpf.toFixed(3)}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-700">
                <th className="text-left py-2 pr-4">Participant ID</th>
                <th className="text-left py-2 pr-4">Service</th>
                <th className="text-left py-2 pr-4">Direction</th>
                <th className="text-left py-2 pr-4 min-w-[120px]">CPF Score</th>
                <th className="text-right py-2 pr-4">Freq Dev Contrib</th>
                <th className="text-right py-2 pr-4">Liability Fraction</th>
                <th className="text-right py-2">Total Liability ($M)</th>
              </tr>
            </thead>
            <tbody>
              {data.causer_pays.map((cp, i) => {
                const cpfPct = Math.min((cp.cpf_score / maxCpf) * 100, 100)
                return (
                  <tr
                    key={`${cp.participant_id}-${cp.service}`}
                    className={`border-b border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-800/30' : 'bg-gray-900/20'}`}
                  >
                    <td className="py-2.5 pr-4 text-white font-mono font-medium">{cp.participant_id}</td>
                    <td className="py-2.5 pr-4 text-gray-300">{cp.service}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${DIRECTION_STYLES[cp.direction] ?? 'bg-gray-700 text-gray-300'}`}>
                        {cp.direction}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-700 rounded h-2 w-24">
                          <div
                            className="h-2 rounded bg-emerald-500"
                            style={{ width: `${cpfPct}%` }}
                          />
                        </div>
                        <span className="text-gray-300 font-mono text-xs w-12 text-right">
                          {cp.cpf_score.toFixed(4)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-300 font-mono">{cp.frequency_deviation_contribution.toFixed(4)}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-300 font-mono">{cp.liability_fraction.toFixed(4)}</td>
                    <td className="py-2.5 text-right text-yellow-400 font-semibold">${cp.total_liability_m.toFixed(2)}M</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <p className="text-center text-gray-600 text-xs mt-4">
        Sources: AEMO FCAS Cost Reports, NER Rules 3.15.6A &amp; 3.15.6B, AEMC Causer-Pays Procedures
        &nbsp;|&nbsp; IBR penetration data: AEMO ISP 2024
      </p>
    </div>
  )
}
