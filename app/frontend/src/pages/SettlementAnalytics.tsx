// Sprint 62a — NEM 5-Minute Settlement & Prudential Analytics

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { CreditCard } from 'lucide-react'
import {
  getSettlementAnalyticsDashboard,
  SettlementAnalyticsDashboard62a,
  WSASettlementRecord,
  WSAPrudentialRecord,
  WSAShortfallRecord,
  WSAParticipantExposureRecord,
} from '../api/client'

// ─── colour helpers ────────────────────────────────────────────────────────

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  VIC1: '#a855f7',
  QLD1: '#f59e0b',
  SA1:  '#ef4444',
  TAS1: '#10b981',
}

const PARTICIPANT_COLOURS: Record<string, string> = {
  'AGL Energy':      '#3b82f6',
  'Origin Energy':   '#f59e0b',
  'EnergyAustralia': '#10b981',
  'Snowy Hydro':     '#06b6d4',
  'Alinta Energy':   '#a855f7',
}

function complianceBadge(status: string) {
  const base = 'inline-block px-2 py-0.5 rounded text-xs font-semibold'
  if (status === 'COMPLIANT') return `${base} bg-emerald-900 text-emerald-300`
  if (status === 'WARNING')   return `${base} bg-amber-900  text-amber-300`
  return                             `${base} bg-red-900    text-red-300`
}

function collateralBadge(type: string) {
  const base = 'inline-block px-2 py-0.5 rounded text-xs font-medium'
  if (type === 'BANK_GUARANTEE')   return `${base} bg-blue-900   text-blue-300`
  if (type === 'CASH')             return `${base} bg-green-900  text-green-300`
  return                                  `${base} bg-purple-900 text-purple-300`
}

function shortfallTypeBadge(type: string) {
  const base = 'inline-block px-2 py-0.5 rounded text-xs font-semibold'
  if (type === 'SETTLEMENT')  return `${base} bg-orange-900 text-orange-300`
  if (type === 'PRUDENTIAL')  return `${base} bg-red-900    text-red-300`
  return                             `${base} bg-gray-700   text-gray-300`
}

function fmt(n: number, dec = 1) {
  return n.toFixed(dec)
}

// ─── KPI card ─────────────────────────────────────────────────────────────

interface KpiProps {
  label: string
  value: string
  sub?: string
  accent?: string
}

function KpiCard({ label, value, sub, accent = 'border-blue-500' }: KpiProps) {
  return (
    <div className={`bg-gray-800 rounded-xl p-5 border-l-4 ${accent}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ─── custom tooltip ────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-300 font-semibold mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? '#fff' }}>
          {p.name}: {typeof p.value === 'number' ? fmt(p.value, 1) : p.value}
        </p>
      ))}
    </div>
  )
}

// ─── main page ─────────────────────────────────────────────────────────────

export default function SettlementAnalytics() {
  const [data, setData] = useState<SettlementAnalyticsDashboard62a | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSettlementAnalyticsDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading settlement analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  // ── derived KPIs ──────────────────────────────────────────────────────────
  const totalSettlementValue = data.settlements.reduce((s, r) => s + r.total_energy_value_m_aud, 0)
  const totalVariance = data.settlements.reduce((s, r) => s + r.settlement_variance_m_aud, 0)
  const highestCreditParticipant = data.prudential.reduce((best, r) =>
    r.maximum_credit_limit_m_aud > best.maximum_credit_limit_m_aud ? r : best
  )
  const shortfallCount = data.shortfalls.length

  // ── settlement bar chart data (by region / week) ──────────────────────────
  const settlementByWeekRegion: Record<string, Record<string, number>> = {}
  for (const r of data.settlements) {
    if (!settlementByWeekRegion[r.week]) settlementByWeekRegion[r.week] = {}
    settlementByWeekRegion[r.week][r.region] = (settlementByWeekRegion[r.week][r.region] ?? 0) + r.total_energy_value_m_aud
  }
  const settlementChartData = Object.entries(settlementByWeekRegion).map(([week, regions]) => ({
    week,
    ...regions,
  }))

  // ── top-5 participant exposure line chart ──────────────────────────────────
  const TOP5 = ['AGL Energy', 'Origin Energy', 'EnergyAustralia', 'Snowy Hydro', 'Alinta Energy']
  const exposureByWeek: Record<string, Record<string, number>> = {}
  for (const r of data.exposures) {
    if (!TOP5.includes(r.participant)) continue
    if (!exposureByWeek[r.week]) exposureByWeek[r.week] = {}
    exposureByWeek[r.week][r.participant] = r.exposure_utilisation_pct
  }
  const exposureChartData = Object.entries(exposureByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, parts]) => ({ week, ...parts }))

  const regions = Array.from(new Set(data.settlements.map(r => r.region)))

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <CreditCard className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            NEM 5-Minute Settlement &amp; Prudential Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            5-min settlement regime, prudential deposits, credit exposure &amp; shortfall tracking
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Total Weekly Settlement Value"
          value={`$${fmt(totalSettlementValue, 1)}M`}
          sub="AUD across all regions"
          accent="border-blue-500"
        />
        <KpiCard
          label="5-Min vs 30-Min Variance"
          value={`$${fmt(totalVariance, 1)}M`}
          sub="Cumulative settlement residue"
          accent="border-amber-500"
        />
        <KpiCard
          label="Highest Credit Limit Participant"
          value={highestCreditParticipant.participant.split(' ')[0]}
          sub={`$${fmt(highestCreditParticipant.maximum_credit_limit_m_aud, 0)}M limit`}
          accent="border-emerald-500"
        />
        <KpiCard
          label="Shortfall Events"
          value={String(shortfallCount)}
          sub="Year to date 2024"
          accent="border-red-500"
        />
      </div>

      {/* Row 1 — settlement bar chart + prudential table */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">

        {/* Settlement value by region/week */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
            Settlement Value by Region and Week (M AUD)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={settlementChartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {regions.map(region => (
                <Bar key={region} dataKey={region} stackId="a" fill={REGION_COLOURS[region] ?? '#6b7280'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 5-min vs 30-min variance composite */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
            Settlement Variance: Positive vs Negative Residue (M AUD)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.settlements} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
              <Bar dataKey="positive_residue_m_aud" name="Positive Residue" fill="#10b981" opacity={0.85} />
              <Bar dataKey="negative_residue_m_aud" name="Negative Residue" fill="#ef4444" opacity={0.85} />
              <Line
                type="monotone"
                dataKey="settlement_variance_m_aud"
                name="Net Variance"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2 — participant exposure line chart */}
      <div className="bg-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
          Participant Credit Exposure Utilisation — Top 5 Participants (%)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={exposureChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis domain={[60, 95]} tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            <ReferenceLine y={85} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Warning 85%', fill: '#ef4444', fontSize: 10 }} />
            {TOP5.map(participant => (
              <Line
                key={participant}
                type="monotone"
                dataKey={participant}
                stroke={PARTICIPANT_COLOURS[participant] ?? '#6b7280'}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Row 3 — prudential compliance table */}
      <div className="bg-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
          Prudential Compliance Register
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="pb-2 text-left">Participant</th>
                <th className="pb-2 text-right">Credit Support (M AUD)</th>
                <th className="pb-2 text-right">Max Limit (M AUD)</th>
                <th className="pb-2 text-right">Utilisation</th>
                <th className="pb-2 text-center">Collateral</th>
                <th className="pb-2 text-center">Credit Rating</th>
                <th className="pb-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.prudential
                .slice()
                .sort((a, b) => b.utilisation_pct - a.utilisation_pct)
                .map((r: WSAPrudentialRecord, i: number) => (
                  <tr
                    key={i}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="py-2.5 text-white font-medium">{r.participant}</td>
                    <td className="py-2.5 text-right text-gray-300">${fmt(r.credit_support_m_aud, 1)}</td>
                    <td className="py-2.5 text-right text-gray-300">${fmt(r.maximum_credit_limit_m_aud, 1)}</td>
                    <td className="py-2.5 text-right">
                      <span className={r.utilisation_pct >= 90 ? 'text-red-400 font-semibold' : r.utilisation_pct >= 80 ? 'text-amber-400' : 'text-emerald-400'}>
                        {fmt(r.utilisation_pct, 1)}%
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      <span className={collateralBadge(r.collateral_type)}>
                        {r.collateral_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 text-center text-gray-300 font-mono">{r.credit_rating}</td>
                    <td className="py-2.5 text-center">
                      <span className={complianceBadge(r.compliance_status)}>
                        {r.compliance_status}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4 — shortfall event log */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
          Settlement Shortfall Event Log — 2024
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="pb-2 text-left">Event ID</th>
                <th className="pb-2 text-left">Date</th>
                <th className="pb-2 text-left">Participant</th>
                <th className="pb-2 text-right">Shortfall (M AUD)</th>
                <th className="pb-2 text-center">Type</th>
                <th className="pb-2 text-right">Resolution (days)</th>
                <th className="pb-2 text-center">Security Drawn</th>
                <th className="pb-2 text-left">AEMO Action</th>
              </tr>
            </thead>
            <tbody>
              {data.shortfalls.map((r: WSAShortfallRecord, i: number) => (
                <tr
                  key={i}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="py-2.5 text-blue-400 font-mono text-xs">{r.event_id}</td>
                  <td className="py-2.5 text-gray-300">{r.date}</td>
                  <td className="py-2.5 text-white font-medium">{r.participant}</td>
                  <td className="py-2.5 text-right text-red-400 font-semibold">
                    ${fmt(r.shortfall_m_aud, 1)}M
                  </td>
                  <td className="py-2.5 text-center">
                    <span className={shortfallTypeBadge(r.shortfall_type)}>
                      {r.shortfall_type}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-gray-300">{r.resolution_days}d</td>
                  <td className="py-2.5 text-center">
                    {r.financial_security_drawn ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-900 text-red-300">YES</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-700 text-gray-400">NO</span>
                    )}
                  </td>
                  <td className="py-2.5 text-gray-400 text-xs">{r.aemo_action.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
