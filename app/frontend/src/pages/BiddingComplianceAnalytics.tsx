import { useEffect, useState, useMemo } from 'react'
import { AlertOctagon } from 'lucide-react'
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
import {
  getBiddingComplianceDashboard,
  NBCDashboard,
  NBCEnforcementRecord,
  NBCWithholdingRecord,
  NBCRulesBreachRecord,
  NBCMarketPowerRecord,
  NBCComplianceTrendRecord,
} from '../api/client'

// ── Colour maps ───────────────────────────────────────────────────────────────

const CONDUCT_BADGE: Record<string, string> = {
  PHYSICAL_WITHHOLDING: 'bg-red-700 text-red-100',
  ECONOMIC_WITHHOLDING: 'bg-orange-700 text-orange-100',
  FALSE_PRICING:        'bg-yellow-700 text-yellow-100',
  REBIDDING:            'bg-blue-700 text-blue-100',
  RULE_BREACH:          'bg-purple-700 text-purple-100',
}

const ACTION_BADGE: Record<string, string> = {
  WARNING:             'bg-gray-600 text-gray-200',
  CIVIL_PENALTY:       'bg-red-800 text-red-200',
  INFRINGEMENT_NOTICE: 'bg-orange-800 text-orange-200',
  UNDERTAKING:         'bg-blue-800 text-blue-200',
  COURT_ORDER:         'bg-purple-800 text-purple-200',
}

const OUTCOME_BADGE: Record<string, string> = {
  SETTLED:              'bg-green-800 text-green-200',
  DISMISSED:            'bg-gray-700 text-gray-200',
  PENALTY_IMPOSED:      'bg-red-700 text-red-100',
  UNDERTAKING_ACCEPTED: 'bg-blue-700 text-blue-100',
  ONGOING:              'bg-amber-700 text-amber-100',
}

const PRIORITY_BADGE: Record<string, string> = {
  HIGH:   'bg-red-700 text-red-100',
  MEDIUM: 'bg-yellow-700 text-yellow-100',
  LOW:    'bg-green-800 text-green-200',
}

const PARTICIPANT_COLORS: Record<string, string> = {
  'AGL Energy':       '#f59e0b',
  'Origin Energy':    '#3b82f6',
  'EnergyAustralia':  '#10b981',
  'Snowy Hydro':      '#a855f7',
  'Alinta Energy':    '#ef4444',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#3b82f6',
  VIC1: '#10b981',
  QLD1: '#f59e0b',
  SA1:  '#ef4444',
  TAS1: '#a855f7',
}

const NEM_REGIONS = ['NSW1', 'VIC1', 'QLD1', 'SA1', 'TAS1']
const PARTICIPANTS = ['AGL Energy', 'Origin Energy', 'EnergyAustralia', 'Snowy Hydro', 'Alinta Energy']

// ── Helpers ───────────────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${className}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {sub && <p className="text-sm text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EnforcementTable({ rows }: { rows: NBCEnforcementRecord[] }) {
  const [sortKey, setSortKey] = useState<'year' | 'penalty_m' | 'market_impact_m'>('year')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number)
      return sortDir === 'desc' ? -diff : diff
    })
  }, [rows, sortKey, sortDir])

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const thClass = "px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer hover:text-white select-none"

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-800">
          <tr>
            <th className={thClass} onClick={() => toggleSort('year')}>Year {sortKey==='year' ? (sortDir==='desc'?'▼':'▲') : ''}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Respondent</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Action Type</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Conduct</th>
            <th className={thClass} onClick={() => toggleSort('penalty_m')}>Penalty ($M) {sortKey==='penalty_m' ? (sortDir==='desc'?'▼':'▲') : ''}</th>
            <th className={thClass} onClick={() => toggleSort('market_impact_m')}>Market Impact ($M) {sortKey==='market_impact_m' ? (sortDir==='desc'?'▼':'▲') : ''}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Duration (days)</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Outcome</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {sorted.map(row => (
            <tr key={row.action_id} className="bg-gray-900 hover:bg-gray-800 transition-colors">
              <td className="px-3 py-2 text-gray-300 font-medium">{row.year}</td>
              <td className="px-3 py-2 text-white font-medium">{row.respondent}</td>
              <td className="px-3 py-2">
                <Badge label={row.action_type} className={ACTION_BADGE[row.action_type] ?? 'bg-gray-700 text-gray-200'} />
              </td>
              <td className="px-3 py-2">
                <Badge label={row.conduct} className={CONDUCT_BADGE[row.conduct] ?? 'bg-gray-700 text-gray-200'} />
              </td>
              <td className="px-3 py-2 text-right text-gray-200 font-mono">
                {row.penalty_m > 0 ? `$${row.penalty_m.toFixed(1)}M` : '—'}
              </td>
              <td className="px-3 py-2 text-right text-gray-200 font-mono">
                {row.market_impact_m > 0 ? `$${row.market_impact_m.toFixed(1)}M` : '—'}
              </td>
              <td className="px-3 py-2 text-right text-gray-300 font-mono">
                {row.duration_days > 0 ? row.duration_days : '—'}
              </td>
              <td className="px-3 py-2">
                <Badge label={row.outcome} className={OUTCOME_BADGE[row.outcome] ?? 'bg-gray-700 text-gray-200'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WithholdingChart({ rows }: { rows: NBCWithholdingRecord[] }) {
  const [mode, setMode] = useState<'physical' | 'economic'>('economic')
  const [region, setRegion] = useState<string>('ALL')

  const filtered = useMemo(() => {
    return region === 'ALL' ? rows : rows.filter(r => r.region === region)
  }, [rows, region])

  // Aggregate by month + participant
  const chartData = useMemo(() => {
    const months = [...new Set(filtered.map(r => r.month))].sort()
    return months.map(month => {
      const obj: Record<string, string | number> = { month }
      PARTICIPANTS.forEach(p => {
        const rec = filtered.find(r => r.month === month && r.participant === p)
        obj[p] = rec
          ? (mode === 'physical' ? rec.physical_withholding_events : rec.economic_withholding_events)
          : 0
      })
      return obj
    })
  }, [filtered, mode])

  const regions = ['ALL', ...new Set(rows.map(r => r.region)).values()]

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-gray-600">
          {(['physical', 'economic'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === m ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {m === 'physical' ? 'Physical Withholding' : 'Economic Withholding'}
            </button>
          ))}
        </div>
        <select
          value={region}
          onChange={e => setRegion(e.target.value)}
          className="bg-gray-800 border border-gray-600 text-gray-200 rounded-lg px-3 py-1.5 text-xs"
        >
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Events', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }} />
          <Legend wrapperStyle={{ color: '#d1d5db', fontSize: 12 }} />
          {PARTICIPANTS.map(p => (
            <Bar key={p} dataKey={p} stackId="stack" fill={PARTICIPANT_COLORS[p]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function RulesBreachTable({ rows }: { rows: NBCRulesBreachRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-800">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Rule</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">2022</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">2023</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">2024</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Trend</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Priority</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Common Respondents</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {rows.map(row => {
            const trend = row.breaches_2024 > row.breaches_2023 ? '▲' : row.breaches_2024 < row.breaches_2023 ? '▼' : '='
            const trendColor = row.breaches_2024 > row.breaches_2023 ? 'text-red-400' : row.breaches_2024 < row.breaches_2023 ? 'text-green-400' : 'text-gray-400'
            return (
              <tr key={row.rule_id} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                <td className="px-3 py-2">
                  <p className="text-white font-medium">{row.rule_id}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{row.rule_name}</p>
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs text-gray-300">{row.rule_type.replace(/_/g, ' ')}</span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-300">{row.breaches_2022}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-300">{row.breaches_2023}</td>
                <td className="px-3 py-2 text-right font-mono text-white font-semibold">{row.breaches_2024}</td>
                <td className={`px-3 py-2 text-right font-bold text-base ${trendColor}`}>{trend}</td>
                <td className="px-3 py-2">
                  <Badge label={row.aer_priority} className={PRIORITY_BADGE[row.aer_priority] ?? 'bg-gray-700 text-gray-200'} />
                </td>
                <td className="px-3 py-2 text-gray-300 text-xs">{row.common_respondents.join(', ')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MarketPowerChart({ rows }: { rows: NBCMarketPowerRecord[] }) {
  const [metric, setMetric] = useState<'lerner_index' | 'pivotal_supplier_hours_pct' | 'consumer_detriment_m'>('lerner_index')

  const METRIC_LABELS: Record<string, string> = {
    lerner_index:                  'Lerner Index',
    pivotal_supplier_hours_pct:    'Pivotal Supplier Hours (%)',
    consumer_detriment_m:          'Consumer Detriment ($M)',
  }

  const chartData = useMemo(() => {
    const quarters = [...new Set(rows.map(r => r.quarter))].sort()
    return quarters.map(q => {
      const obj: Record<string, string | number> = { quarter: q }
      NEM_REGIONS.forEach(r => {
        const rec = rows.find(row => row.quarter === q && row.region === r)
        obj[r] = rec ? (rec[metric] as number) : 0
      })
      return obj
    })
  }, [rows, metric])

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {Object.entries(METRIC_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMetric(key as typeof metric)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${metric === key ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }} />
          <Legend wrapperStyle={{ color: '#d1d5db', fontSize: 12 }} />
          {NEM_REGIONS.map(r => (
            <Line
              key={r}
              type="monotone"
              dataKey={r}
              stroke={REGION_COLORS[r]}
              strokeWidth={2}
              dot={{ r: 3, fill: REGION_COLORS[r] }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ComplianceTrendsChart({ rows }: { rows: NBCComplianceTrendRecord[] }) {
  const penaltyData = useMemo(() => rows.map(r => ({ year: String(r.year), total_penalties_m: r.total_penalties_m, enforcement_actions: r.total_enforcement_actions })), [rows])
  const caseData = useMemo(() => rows.map(r => ({
    year: String(r.year),
    'Physical Withholding': r.physical_withholding_cases,
    'Economic Withholding': r.economic_withholding_cases,
    'False Pricing':        r.false_pricing_cases,
    'Rebidding':            r.rebidding_cases,
  })), [rows])

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div>
        <p className="text-sm font-medium text-gray-300 mb-3">Total Penalties ($M) and Enforcement Actions</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={penaltyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }} />
            <Legend wrapperStyle={{ color: '#d1d5db', fontSize: 12 }} />
            <Line yAxisId="left" type="monotone" dataKey="total_penalties_m" name="Penalties ($M)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            <Line yAxisId="right" type="monotone" dataKey="enforcement_actions" name="Actions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-300 mb-3">Cases by Conduct Type (Annual)</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={caseData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }} />
            <Legend wrapperStyle={{ color: '#d1d5db', fontSize: 12 }} />
            <Bar dataKey="Physical Withholding" stackId="a" fill="#ef4444" />
            <Bar dataKey="Economic Withholding" stackId="a" fill="#f97316" />
            <Bar dataKey="False Pricing"        stackId="a" fill="#f59e0b" />
            <Bar dataKey="Rebidding"            stackId="a" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BiddingComplianceAnalytics() {
  const [data, setData] = useState<NBCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBiddingComplianceDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
    </div>
  )

  if (error || !data) return (
    <div className="flex items-center justify-center h-64 text-red-400">
      Failed to load dashboard: {error}
    </div>
  )

  const s = data.summary as Record<string, number | string>
  const totalPenalty = data.enforcement.reduce((acc, r) => acc + r.penalty_m, 0)
  const ongoingCount = data.enforcement.filter(r => r.outcome === 'ONGOING').length
  const avgLerner = (data.market_power.reduce((acc, r) => acc + r.lerner_index, 0) / data.market_power.length).toFixed(3)
  const aerReferrals = data.withholding.filter(r => r.aer_referral).length

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-8">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <AlertOctagon className="w-7 h-7 text-red-400 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-white">NEM Generator Bidding Compliance Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">AER enforcement actions, physical withholding, economic withholding and false pricing investigations</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Total Penalties 2020–2024"
          value={`$${s.total_penalties_2020_2024_m}M`}
          sub="AER civil penalties"
        />
        <KpiCard
          label="Enforcement Actions 2024"
          value={String(s.enforcement_actions_2024)}
          sub="Active investigations"
        />
        <KpiCard
          label="Most Common Conduct"
          value="Economic Withholding"
          sub={String(s.most_common_conduct).replace(/_/g, ' ')}
        />
        <KpiCard
          label="Avg Lerner Index"
          value={avgLerner}
          sub="Market power indicator (0–1)"
        />
        <KpiCard
          label="Highest Risk Region"
          value={String(s.highest_risk_region)}
          sub="SA1 elevated market power"
        />
        <KpiCard
          label="Consumer Detriment 2024"
          value={`$${s.consumer_detriment_2024_m}M`}
          sub="Est. cost to consumers"
        />
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Penalties (all years)"
          value={`$${totalPenalty.toFixed(1)}M`}
          sub="20 enforcement records"
        />
        <KpiCard
          label="Ongoing Proceedings"
          value={String(ongoingCount)}
          sub="Active AER / Court matters"
        />
        <KpiCard
          label="AER Referrals (6 months)"
          value={String(aerReferrals)}
          sub="From withholding monitor"
        />
        <KpiCard
          label="Rules Breach Types"
          value={String(data.rules_breaches.length)}
          sub="NER obligations tracked"
        />
      </div>

      {/* Section 1 — Enforcement Actions */}
      <section className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
        <SectionHeader
          title="AER Enforcement Actions (2015–2024)"
          sub="Civil penalties, court orders, undertakings and infringement notices. Click column headers to sort."
        />
        <EnforcementTable rows={data.enforcement} />
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {Object.entries(CONDUCT_BADGE).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded font-medium ${v}`}>{k.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2 — Withholding Events */}
      <section className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
        <SectionHeader
          title="Withholding Events by Company and Month (2024)"
          sub="Physical withholding: unit available but not dispatched. Economic withholding: priced above reasonable short-run marginal cost."
        />
        <WithholdingChart rows={data.withholding} />
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-gray-400 uppercase">Month</th>
                <th className="px-3 py-2 text-left text-gray-400 uppercase">Participant</th>
                <th className="px-3 py-2 text-left text-gray-400 uppercase">Technology</th>
                <th className="px-3 py-2 text-left text-gray-400 uppercase">Region</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Phys. Events</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Econ. Events</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Cap. (MW)</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Price Impact ($/MWh)</th>
                <th className="px-3 py-2 text-center text-gray-400 uppercase">AER Referral</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.withholding.map((r, i) => (
                <tr key={i} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                  <td className="px-3 py-1.5 text-gray-300">{r.month}</td>
                  <td className="px-3 py-1.5 font-medium" style={{ color: PARTICIPANT_COLORS[r.participant] ?? '#d1d5db' }}>{r.participant}</td>
                  <td className="px-3 py-1.5 text-gray-300">{r.technology}</td>
                  <td className="px-3 py-1.5 text-gray-300">{r.region}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-red-300">{r.physical_withholding_events}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-orange-300">{r.economic_withholding_events}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-200">{r.estimated_capacity_mw.toFixed(1)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-yellow-300">${r.price_impact_per_mwh.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-center">
                    {r.aer_referral
                      ? <span className="text-red-400 font-bold">Yes</span>
                      : <span className="text-gray-500">No</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3 — Rules Breaches */}
      <section className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
        <SectionHeader
          title="NEM Rules Breach Tracker"
          sub="Breach counts by NER obligation type with AER enforcement priority rating and trend direction."
        />
        <RulesBreachTable rows={data.rules_breaches} />
      </section>

      {/* Section 4 — Market Power Indicators */}
      <section className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
        <SectionHeader
          title="Market Power Indicators by Region (2024)"
          sub="Lerner Index = (price - marginal cost) / price. Higher values indicate greater market power. SA1 consistently elevated."
        />
        <MarketPowerChart rows={data.market_power} />
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-gray-400 uppercase">Quarter</th>
                <th className="px-3 py-2 text-left text-gray-400 uppercase">Region</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Lerner Index</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">HHI</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Pivotal Supplier Hours (%)</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Strategic Withholding (MW)</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Consumer Detriment ($M)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.market_power.map((r, i) => (
                <tr key={i} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                  <td className="px-3 py-1.5 text-gray-300">{r.quarter}</td>
                  <td className="px-3 py-1.5 font-medium" style={{ color: REGION_COLORS[r.region] ?? '#d1d5db' }}>{r.region}</td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    <span className={r.lerner_index > 0.3 ? 'text-red-400 font-semibold' : r.lerner_index > 0.22 ? 'text-yellow-400' : 'text-green-400'}>
                      {r.lerner_index.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-200">{r.market_concentration_hhi.toFixed(0)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-orange-300">{r.pivotal_supplier_hours_pct.toFixed(1)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono text-red-300">{r.strategic_withholding_estimated_mw.toFixed(1)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-amber-300">${r.consumer_detriment_m.toFixed(1)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 5 — Compliance Trends */}
      <section className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
        <SectionHeader
          title="AER Compliance Enforcement Trends (2015–2024)"
          sub="Annual penalties, enforcement action counts and case breakdown by conduct type."
        />
        <ComplianceTrendsChart rows={data.compliance_trends} />
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-gray-400 uppercase">Year</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Actions</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Penalties ($M)</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Phys. Withholding</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Econ. Withholding</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">False Pricing</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Rebidding</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Investigations Opened</th>
                <th className="px-3 py-2 text-right text-gray-400 uppercase">Investigations Closed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.compliance_trends.map((r) => (
                <tr key={r.year} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                  <td className="px-3 py-1.5 font-semibold text-white">{r.year}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-blue-300">{r.total_enforcement_actions}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-red-300">${r.total_penalties_m.toFixed(1)}M</td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-200">{r.physical_withholding_cases}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-200">{r.economic_withholding_cases}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-200">{r.false_pricing_cases}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-200">{r.rebidding_cases}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-amber-300">{r.aer_investigations_opened}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-green-300">{r.aer_investigations_closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
