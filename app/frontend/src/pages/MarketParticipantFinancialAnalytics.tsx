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
import { CreditCard, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  getMarketParticipantFinancialDashboard,
  WMFDashboard,
  WMFParticipantRecord,
  WMFSettlementRecord,
  WMFDefaultRecord,
  WMFCreditSupportRecord,
  WMFPrudentialRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const ROLE_BADGE: Record<string, string> = {
  GENERATOR:                      'bg-blue-600 text-white',
  RETAILER:                       'bg-purple-600 text-white',
  MARKET_CUSTOMER:                'bg-teal-600 text-white',
  TRADER:                         'bg-amber-600 text-white',
  MARKET_NETWORK_SERVICE_PROVIDER:'bg-cyan-600 text-white',
}

const RATING_BADGE: Record<string, string> = {
  AAA:     'bg-emerald-600 text-white',
  AA:      'bg-green-600 text-white',
  A:       'bg-lime-600 text-white',
  BBB:     'bg-yellow-600 text-white',
  BB:      'bg-orange-600 text-white',
  B:       'bg-red-600 text-white',
  UNRATED: 'bg-gray-500 text-white',
}

const RISK_BADGE: Record<string, string> = {
  GREEN: 'bg-green-700 text-white',
  AMBER: 'bg-amber-500 text-white',
  RED:   'bg-red-700 text-white',
}

const TRIGGER_BADGE: Record<string, string> = {
  INSOLVENCY:          'bg-red-700 text-white',
  FAILURE_TO_PAY:      'bg-orange-600 text-white',
  VOLUNTARY_SUSPENSION:'bg-amber-600 text-white',
  REGULATORY:          'bg-blue-600 text-white',
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

function KpiCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'red' | 'amber' | 'green'
}) {
  const borderColor =
    highlight === 'red'
      ? 'border-l-4 border-red-500'
      : highlight === 'amber'
      ? 'border-l-4 border-amber-400'
      : highlight === 'green'
      ? 'border-l-4 border-green-500'
      : ''

  return (
    <div className={`bg-gray-800 rounded-lg p-4 flex flex-col gap-1 ${borderColor}`}>
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Participant Risk Register Table
// ---------------------------------------------------------------------------

function ParticipantRiskTable({ participants }: { participants: WMFParticipantRecord[] }) {
  const sorted = [...participants].sort((a, b) => b.prudential_obligation_m - a.prudential_obligation_m)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-300">
        <thead>
          <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <th className="py-2 pr-4">Participant</th>
            <th className="py-2 pr-4">Role</th>
            <th className="py-2 pr-4">Rating</th>
            <th className="py-2 pr-4 text-right">Prudential Req ($M)</th>
            <th className="py-2 pr-4 text-right">Credit Support ($M)</th>
            <th className="py-2 pr-4 text-right">Coverage</th>
            <th className="py-2 pr-4 text-right">Daily Exp ($M)</th>
            <th className="py-2 pr-4 text-right">Max Exp ($M)</th>
            <th className="py-2">Risk Flag</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.participant_id} className="border-b border-gray-800 hover:bg-gray-750">
              <td className="py-2 pr-4 font-medium text-white">{p.company}</td>
              <td className="py-2 pr-4">
                <Badge label={p.role} colorClass={ROLE_BADGE[p.role] ?? 'bg-gray-600 text-white'} />
              </td>
              <td className="py-2 pr-4">
                <Badge label={p.credit_rating} colorClass={RATING_BADGE[p.credit_rating] ?? 'bg-gray-600 text-white'} />
              </td>
              <td className="py-2 pr-4 text-right">{p.prudential_obligation_m.toFixed(1)}</td>
              <td className="py-2 pr-4 text-right">{p.actual_credit_support_m.toFixed(1)}</td>
              <td className={`py-2 pr-4 text-right font-semibold ${p.coverage_ratio >= 1.0 ? 'text-green-400' : 'text-red-400'}`}>
                {(p.coverage_ratio * 100).toFixed(1)}%
              </td>
              <td className="py-2 pr-4 text-right">{p.daily_settlement_exposure_m.toFixed(1)}</td>
              <td className="py-2 pr-4 text-right">{p.max_exposure_m.toFixed(1)}</td>
              <td className="py-2">
                <Badge label={p.credit_risk_flag} colorClass={RISK_BADGE[p.credit_risk_flag] ?? 'bg-gray-600 text-white'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settlement Trends Chart
// ---------------------------------------------------------------------------

function SettlementTrendsChart({ settlement }: { settlement: WMFSettlementRecord[] }) {
  const data = settlement.map((s) => ({
    month: s.month.slice(0, 7),
    'Settlement ($M)': s.total_settlement_value_m,
    'Max Exposure ($M)': s.max_single_participant_exposure_m,
    'Undercollateralised ($M)': s.undercollateralised_m,
  }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={2} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        <Line type="monotone" dataKey="Settlement ($M)" stroke="#60a5fa" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="Max Exposure ($M)" stroke="#f59e0b" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="Undercollateralised ($M)" stroke="#ef4444" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Late Payments & Disputes Chart
// ---------------------------------------------------------------------------

function LatePaymentsChart({ settlement }: { settlement: WMFSettlementRecord[] }) {
  const data = settlement.map((s) => ({
    month: s.month.slice(0, 7),
    'Late Payments': s.late_payments_count,
    Disputes: s.disputes_count,
  }))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={2} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        <Bar dataKey="Late Payments" fill="#f59e0b" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Disputes" fill="#ef4444" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Default History Chart
// ---------------------------------------------------------------------------

function DefaultHistoryChart({ defaults }: { defaults: WMFDefaultRecord[] }) {
  const data = defaults.map((d) => ({
    year: d.year.toString(),
    'Default Value ($M)': d.total_default_value_m,
    'Market Impact ($M)': d.market_impact_m,
    'Recovered ($M)': d.total_default_value_m > 0
      ? parseFloat(((d.total_default_value_m * d.recovered_pct) / 100).toFixed(2))
      : 0,
  }))
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        <Bar dataKey="Default Value ($M)" fill="#ef4444" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Market Impact ($M)" fill="#f97316" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Recovered ($M)" fill="#22c55e" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Default History Table
// ---------------------------------------------------------------------------

function DefaultHistoryTable({ defaults }: { defaults: WMFDefaultRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-300">
        <thead>
          <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <th className="py-2 pr-4">Year</th>
            <th className="py-2 pr-4 text-right">Events</th>
            <th className="py-2 pr-4 text-right">Total Default ($M)</th>
            <th className="py-2 pr-4 text-right">Recovered (%)</th>
            <th className="py-2 pr-4 text-right">Market Impact ($M)</th>
            <th className="py-2">Trigger</th>
          </tr>
        </thead>
        <tbody>
          {defaults.map((d) => (
            <tr key={d.year} className="border-b border-gray-800 hover:bg-gray-750">
              <td className="py-2 pr-4 font-medium text-white">{d.year}</td>
              <td className="py-2 pr-4 text-right">{d.default_events}</td>
              <td className="py-2 pr-4 text-right">{d.total_default_value_m.toFixed(1)}</td>
              <td className={`py-2 pr-4 text-right ${d.recovered_pct >= 70 ? 'text-green-400' : d.recovered_pct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {d.recovered_pct.toFixed(1)}%
              </td>
              <td className="py-2 pr-4 text-right text-orange-400">{d.market_impact_m.toFixed(1)}</td>
              <td className="py-2">
                <Badge label={d.trigger} colorClass={TRIGGER_BADGE[d.trigger] ?? 'bg-gray-600 text-white'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Credit Support Types Chart
// ---------------------------------------------------------------------------

function CreditSupportChart({ creditSupport }: { creditSupport: WMFCreditSupportRecord[] }) {
  const data = creditSupport.map((cs) => ({
    type: cs.support_type.replace(/_/g, ' '),
    'Lodged ($M)': cs.total_lodged_m,
    'Participants': cs.participants_using,
  }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 140, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis type="category" dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} width={130} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        <Bar dataKey="Lodged ($M)" fill="#60a5fa" radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Credit Support Table
// ---------------------------------------------------------------------------

function CreditSupportTable({ creditSupport }: { creditSupport: WMFCreditSupportRecord[] }) {
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm text-left text-gray-300">
        <thead>
          <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <th className="py-2 pr-4">Support Type</th>
            <th className="py-2 pr-4 text-right">Lodged ($M)</th>
            <th className="py-2 pr-4 text-right">Participants</th>
            <th className="py-2 pr-4 text-right">Avg Duration (months)</th>
            <th className="py-2 pr-4 text-right">Renewals/yr</th>
            <th className="py-2 text-right">Acceptance (%)</th>
          </tr>
        </thead>
        <tbody>
          {creditSupport.map((cs) => (
            <tr key={cs.support_type} className="border-b border-gray-800 hover:bg-gray-750">
              <td className="py-2 pr-4 font-medium text-white">{cs.support_type.replace(/_/g, ' ')}</td>
              <td className="py-2 pr-4 text-right">{cs.total_lodged_m.toFixed(0)}</td>
              <td className="py-2 pr-4 text-right">{cs.participants_using}</td>
              <td className="py-2 pr-4 text-right">{cs.avg_duration_months.toFixed(0)}</td>
              <td className="py-2 pr-4 text-right">{cs.renewal_frequency_per_yr.toFixed(1)}</td>
              <td className={`py-2 text-right ${cs.acceptance_rate_pct >= 95 ? 'text-green-400' : 'text-amber-400'}`}>
                {cs.acceptance_rate_pct.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Prudential Coverage Chart
// ---------------------------------------------------------------------------

function PrudentialCoverageChart({ prudential }: { prudential: WMFPrudentialRecord[] }) {
  const data = prudential.map((p) => ({
    quarter: p.quarter,
    'Requirement ($M)': p.total_prudential_requirement_m,
    'Credit Support ($M)': p.total_credit_support_lodged_m,
    'Coverage Ratio': parseFloat(p.market_coverage_ratio.toFixed(3)),
    'At-Risk Participants': p.amber_participants + p.red_participants,
  }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" domain={[1.0, 1.3]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        <Line yAxisId="left" type="monotone" dataKey="Requirement ($M)" stroke="#60a5fa" dot={false} strokeWidth={2} />
        <Line yAxisId="left" type="monotone" dataKey="Credit Support ($M)" stroke="#22c55e" dot={false} strokeWidth={2} />
        <Line yAxisId="right" type="monotone" dataKey="Coverage Ratio" stroke="#f59e0b" dot={{ r: 4, fill: '#f59e0b' }} strokeWidth={2} strokeDasharray="5 3" />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Prudential At-Risk Chart
// ---------------------------------------------------------------------------

function PrudentialAtRiskChart({ prudential }: { prudential: WMFPrudentialRecord[] }) {
  const data = prudential.map((p) => ({
    quarter: p.quarter,
    'Amber Participants': p.amber_participants,
    'Red Participants': p.red_participants,
    'Waiver Requests': p.waiver_requests,
    'Waivers Granted': p.waivers_granted,
  }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        <Bar dataKey="Amber Participants" fill="#f59e0b" radius={[2, 2, 0, 0]} stackId="a" />
        <Bar dataKey="Red Participants" fill="#ef4444" radius={[2, 2, 0, 0]} stackId="a" />
        <Bar dataKey="Waiver Requests" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Waivers Granted" fill="#22c55e" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MarketParticipantFinancialAnalytics() {
  const [data, setData] = useState<WMFDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = () => {
    setLoading(true)
    setError(null)
    getMarketParticipantFinancialDashboard()
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message ?? 'Failed to load data')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Loading market participant financial data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 gap-2">
        <AlertTriangle size={20} />
        {error ?? 'Unknown error'}
      </div>
    )
  }

  const summary = data.summary as Record<string, string | number>
  const latestPrudential = data.prudential[data.prudential.length - 1]
  const totalCreditLodged = data.credit_support.reduce((sum, cs) => sum + cs.total_lodged_m, 0)
  const totalDefaultValue = data.defaults.reduce((sum, d) => sum + d.total_default_value_m, 0)

  return (
    <div className="p-6 space-y-8 text-gray-200 bg-gray-900 min-h-screen">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="text-blue-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-white">
              Wholesale Market Participant Financial Health
            </h1>
            <p className="text-sm text-gray-400">
              NEM prudential requirements, credit exposure, default risk and financial health analytics
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-200 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Total Participants"
          value={String(summary.total_participants ?? data.participants.length)}
          sub="Active NEM participants"
          highlight="green"
        />
        <KpiCard
          label="Prudential Req."
          value={`$${Number(summary.total_prudential_requirement_m ?? 0).toLocaleString()}M`}
          sub="Q4 2024"
          highlight="green"
        />
        <KpiCard
          label="Market Coverage"
          value={`${Number(summary.market_coverage_ratio ?? 0).toFixed(2)}x`}
          sub="Credit support / requirement"
          highlight={Number(summary.market_coverage_ratio) >= 1.1 ? 'green' : 'amber'}
        />
        <KpiCard
          label="Red-Flag Participants"
          value={String(summary.red_flagged_participants ?? 0)}
          sub="Undercollateralised"
          highlight={Number(summary.red_flagged_participants) > 0 ? 'red' : 'green'}
        />
        <KpiCard
          label="2024 Default Events"
          value={String(summary.default_events_2024 ?? 0)}
          sub="FY2024"
          highlight={Number(summary.default_events_2024) > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          label="Total Credit Lodged"
          value={`$${totalCreditLodged.toLocaleString()}M`}
          sub="All support types"
          highlight="green"
        />
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Avg Credit Rating"
          value={String(summary.avg_credit_rating ?? 'BBB')}
          sub="Market average"
        />
        <KpiCard
          label="10-Year Default Total"
          value={`$${totalDefaultValue.toFixed(0)}M`}
          sub="2015-2024 cumulative"
          highlight="amber"
        />
        <KpiCard
          label="Latest Amber Count"
          value={String(latestPrudential.amber_participants)}
          sub={`Q4 2024 amber participants`}
          highlight="amber"
        />
        <KpiCard
          label="Latest Red Count"
          value={String(latestPrudential.red_participants)}
          sub={`Q4 2024 red participants`}
          highlight={latestPrudential.red_participants > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Participant Risk Register */}
      <div className="bg-gray-800 rounded-xl p-6">
        <SectionHeader
          title="Participant Risk Register"
          subtitle="All NEM participants — prudential obligations, credit support, daily settlement exposure and risk classification"
        />
        <ParticipantRiskTable participants={data.participants} />
      </div>

      {/* Settlement Trends */}
      <div className="bg-gray-800 rounded-xl p-6">
        <SectionHeader
          title="Settlement Trends"
          subtitle="Monthly settlement value, maximum single-participant exposure and undercollateralised amount (2023-2024)"
        />
        <SettlementTrendsChart settlement={data.settlement} />
      </div>

      {/* Late Payments & Disputes */}
      <div className="bg-gray-800 rounded-xl p-6">
        <SectionHeader
          title="Late Payments and Disputes"
          subtitle="Monthly count of late settlements and formal dispute lodgements"
        />
        <LatePaymentsChart settlement={data.settlement} />
      </div>

      {/* Default History */}
      <div className="bg-gray-800 rounded-xl p-6">
        <SectionHeader
          title="Default Event History (2015-2024)"
          subtitle="Annual default value, market cost absorption, and percentage recovered"
        />
        <DefaultHistoryChart defaults={data.defaults} />
        <div className="mt-6">
          <DefaultHistoryTable defaults={data.defaults} />
        </div>
      </div>

      {/* Credit Support Types */}
      <div className="bg-gray-800 rounded-xl p-6">
        <SectionHeader
          title="Credit Support Instruments"
          subtitle="Total lodged by instrument type, participant usage, duration and acceptance rate"
        />
        <CreditSupportChart creditSupport={data.credit_support} />
        <CreditSupportTable creditSupport={data.credit_support} />
      </div>

      {/* Prudential Coverage Trends */}
      <div className="bg-gray-800 rounded-xl p-6">
        <SectionHeader
          title="Prudential Coverage — Quarterly Trends"
          subtitle="Market-wide prudential requirement vs credit support lodged, with coverage ratio (right axis)"
        />
        <PrudentialCoverageChart prudential={data.prudential} />
      </div>

      {/* At-Risk Participants & Waivers */}
      <div className="bg-gray-800 rounded-xl p-6">
        <SectionHeader
          title="At-Risk Participants and Waivers"
          subtitle="Quarterly count of amber/red-flagged participants and waiver outcomes"
        />
        <PrudentialAtRiskChart prudential={data.prudential} />
      </div>
    </div>
  )
}
