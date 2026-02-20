import { useEffect, useState } from 'react'
import { Shield, AlertTriangle, CheckCircle, Clock, DollarSign, Zap, Users, BarChart2 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getCapacityMechanismDashboard,
  CMDDashboard,
  CMDCapacityRecord,
  CMDAuctionRecord,
  CMDParticipantRecord,
  CMDDesignComparisonRecord,
} from '../api/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case 'CLEARED': return 'bg-green-700 text-green-100'
    case 'DEFICIT': return 'bg-red-700 text-red-100'
    case 'PENDING': return 'bg-yellow-700 text-yellow-100'
    default: return 'bg-gray-600 text-gray-100'
  }
}

function outcomeColor(outcome: string): string {
  switch (outcome) {
    case 'OVERSUBSCRIBED': return 'bg-green-700 text-green-100'
    case 'CLEARED': return 'bg-blue-700 text-blue-100'
    case 'UNDERSUBSCRIBED': return 'bg-red-700 text-red-100'
    default: return 'bg-gray-600 text-gray-100'
  }
}

function complianceColor(status: string): string {
  switch (status) {
    case 'COMPLIANT': return 'bg-green-700 text-green-100'
    case 'WATCH': return 'bg-yellow-700 text-yellow-100'
    case 'BREACH': return 'bg-red-700 text-red-100'
    case 'DEVELOPMENT': return 'bg-gray-600 text-gray-200'
    default: return 'bg-gray-600 text-gray-100'
  }
}

function complexityColor(complexity: string): string {
  switch (complexity) {
    case 'LOW': return 'bg-green-700 text-green-100'
    case 'MEDIUM': return 'bg-yellow-700 text-yellow-100'
    case 'HIGH': return 'bg-red-700 text-red-100'
    default: return 'bg-gray-600 text-gray-100'
  }
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  accent?: string
}

function KpiCard({ title, value, sub, icon, accent = 'text-blue-400' }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-start gap-4">
      <div className={`mt-1 ${accent}`}>{icon}</div>
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wide">{title}</p>
        <p className="text-white text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-gray-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Capacity Obligations Chart ────────────────────────────────────────────────

function CapacityObligationsChart({ records }: { records: CMDCapacityRecord[] }) {
  const [selectedYear, setSelectedYear] = useState<number>(2025)
  const years = Array.from(new Set(records.map(r => r.delivery_year))).sort()

  const filtered = records.filter(r => r.delivery_year === selectedYear)

  // Aggregate by region (in case of multiple records per region/year)
  const regionMap: Record<string, { obligation: number; contracted: number; status: string }> = {}
  filtered.forEach(r => {
    if (!regionMap[r.region]) {
      regionMap[r.region] = { obligation: r.capacity_obligation_mw, contracted: r.capacity_contracted_mw, status: r.status }
    }
  })

  const chartData = Object.entries(regionMap).map(([region, v]) => ({
    region,
    Obligation: v.obligation,
    Contracted: v.contracted,
    status: v.status,
  }))

  const barColorObligation = '#6366f1'
  const getContractedColor = (status: string) => {
    if (status === 'CLEARED') return '#22c55e'
    if (status === 'DEFICIT') return '#ef4444'
    return '#eab308'
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-lg">Capacity Obligations vs Contracted by Region</h2>
        <div className="flex gap-2">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                selectedYear === y
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickFormatter={v => `${(v / 1000).toFixed(0)}GW`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(value: number) => [`${value.toLocaleString()} MW`]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="Obligation" fill={barColorObligation} radius={[3, 3, 0, 0]} />
          <Bar
            dataKey="Contracted"
            radius={[3, 3, 0, 0]}
            fill="#22c55e"
            // Per-bar coloring via cell is not straightforward with Recharts Bar without Cell;
            // use a static color here and rely on status badges in the legend below
          />
        </BarChart>
      </ResponsiveContainer>
      {/* Status legend by region */}
      <div className="flex flex-wrap gap-2 mt-3">
        {chartData.map(d => (
          <span key={d.region} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="font-medium text-gray-200">{d.region}</span>
            <Badge label={d.status} className={statusColor(d.status)} />
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Auction Results Table ─────────────────────────────────────────────────────

function AuctionResultsTable({ auctions }: { auctions: CMDAuctionRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-white font-semibold text-lg mb-4">CIS Auction Results</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-700">
              <th className="text-left pb-2 pr-4">Auction ID</th>
              <th className="text-left pb-2 pr-4">Date</th>
              <th className="text-left pb-2 pr-4">Region</th>
              <th className="text-right pb-2 pr-4">Sought (MW)</th>
              <th className="text-right pb-2 pr-4">Cleared (MW)</th>
              <th className="text-right pb-2 pr-4">Price ($/kW/yr)</th>
              <th className="text-right pb-2 pr-4">Bidders</th>
              <th className="text-right pb-2 pr-4">Winners</th>
              <th className="text-right pb-2 pr-4">Oversub (%)</th>
              <th className="text-left pb-2">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {auctions.map(a => (
              <tr key={a.auction_id} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                <td className="py-2 pr-4 text-gray-200 font-mono text-xs">{a.auction_id}</td>
                <td className="py-2 pr-4 text-gray-300">{a.auction_date}</td>
                <td className="py-2 pr-4">
                  <Badge label={a.region} className="bg-gray-700 text-gray-200" />
                </td>
                <td className="py-2 pr-4 text-right text-gray-300">{a.capacity_sought_mw.toLocaleString()}</td>
                <td className="py-2 pr-4 text-right text-gray-200 font-medium">{a.capacity_cleared_mw.toLocaleString()}</td>
                <td className="py-2 pr-4 text-right text-blue-300">${a.clearing_price_per_kw_yr}</td>
                <td className="py-2 pr-4 text-right text-gray-300">{a.num_bidders}</td>
                <td className="py-2 pr-4 text-right text-gray-300">{a.num_winners}</td>
                <td className={`py-2 pr-4 text-right font-medium ${a.oversubscription_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {a.oversubscription_pct >= 0 ? '+' : ''}{a.oversubscription_pct}%
                </td>
                <td className="py-2">
                  <Badge label={a.outcome} className={outcomeColor(a.outcome)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Participant Compliance Table ──────────────────────────────────────────────

function ParticipantTable({ participants }: { participants: CMDParticipantRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-white font-semibold text-lg mb-4">Participant Compliance Tracker</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-700">
              <th className="text-left pb-2 pr-4">Participant</th>
              <th className="text-left pb-2 pr-4">Region</th>
              <th className="text-left pb-2 pr-4">Technology</th>
              <th className="text-right pb-2 pr-4">Committed (MW)</th>
              <th className="text-right pb-2 pr-4">Available (MW)</th>
              <th className="text-left pb-2 pr-4 w-40">Reliability Rating</th>
              <th className="text-left pb-2">Compliance</th>
            </tr>
          </thead>
          <tbody>
            {participants.map(p => (
              <tr key={p.participant_id} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                <td className="py-2 pr-4 text-gray-200 font-medium">{p.name}</td>
                <td className="py-2 pr-4">
                  <Badge label={p.region} className="bg-gray-700 text-gray-200" />
                </td>
                <td className="py-2 pr-4">
                  <Badge label={p.technology} className="bg-indigo-800 text-indigo-200" />
                </td>
                <td className="py-2 pr-4 text-right text-gray-300">{p.committed_capacity_mw.toLocaleString()}</td>
                <td className="py-2 pr-4 text-right text-gray-300">{p.available_capacity_mw.toLocaleString()}</td>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          p.reliability_rating >= 0.95
                            ? 'bg-green-500'
                            : p.reliability_rating >= 0.80
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${p.reliability_rating * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right">
                      {(p.reliability_rating * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="py-2">
                  <Badge label={p.compliance_status} className={complianceColor(p.compliance_status)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Mechanism Comparison Cards ────────────────────────────────────────────────

function MechanismComparisonGrid({ mechanisms }: { mechanisms: CMDDesignComparisonRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-white font-semibold text-lg mb-4">Global Mechanism Design Comparison</h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {mechanisms.map(m => (
          <div key={m.mechanism_name} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="text-white font-semibold text-sm leading-tight">{m.mechanism_name}</h3>
                <p className="text-gray-400 text-xs mt-0.5">{m.jurisdiction}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge
                  label={m.in_use ? 'IN USE' : 'PROPOSED'}
                  className={m.in_use ? 'bg-green-800 text-green-200' : 'bg-gray-600 text-gray-300'}
                />
                <Badge label={m.admin_complexity} className={complexityColor(m.admin_complexity)} />
              </div>
            </div>
            <div className="flex items-center gap-1 mb-3">
              <Badge label={m.mechanism_type.replace(/_/g, ' ')} className="bg-blue-900 text-blue-200" />
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-gray-800 rounded p-2 text-center">
                <p className="text-gray-400 text-xs">Cost</p>
                <p className="text-white font-bold text-sm">${m.cost_per_mwh}/MWh</p>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <p className="text-gray-400 text-xs">Reliability Gain</p>
                <p className="text-green-400 font-bold text-sm">+{m.reliability_improvement_pct}%</p>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <p className="text-gray-400 text-xs">New Investment</p>
                <p className="text-blue-400 font-bold text-sm">
                  {m.new_investment_triggered_mw > 0
                    ? `${(m.new_investment_triggered_mw / 1000).toFixed(1)} GW`
                    : '—'}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-start gap-1">
                <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={12} />
                <p className="text-gray-300 text-xs">{m.pros}</p>
              </div>
              <div className="flex items-start gap-1">
                <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={12} />
                <p className="text-gray-400 text-xs">{m.cons}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CapacityMechanismAnalytics() {
  const [data, setData] = useState<CMDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCapacityMechanismDashboard()
      .then(setData)
      .catch(e => setError(e?.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading Capacity Mechanism Analytics...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-sm">{error ?? 'No data available'}</div>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-5">
        <div className="flex items-center gap-3">
          <Shield className="text-blue-400" size={28} />
          <div>
            <h1 className="text-xl font-bold text-white">Capacity Mechanism Design Analytics</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              NEM reliability and capacity mechanism designs — CIS performance, auctions, obligations &amp; global comparisons
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Deficit Regions"
            value={`${summary.deficit_regions as number} / ${summary.total_regions_tracked as number}`}
            sub="Regions with capacity shortfall"
            icon={<AlertTriangle size={22} />}
            accent="text-red-400"
          />
          <KpiCard
            title="Total Contracted Capacity"
            value={`${summary.total_capacity_contracted_gw as number} GW`}
            sub="Across all regions & years"
            icon={<Zap size={22} />}
            accent="text-yellow-400"
          />
          <KpiCard
            title="Avg CIS Clearing Price"
            value={`$${summary.cis_avg_clearing_price_per_kw_yr as number}/kW/yr`}
            sub="Capacity Investment Scheme"
            icon={<DollarSign size={22} />}
            accent="text-green-400"
          />
          <KpiCard
            title="Total Participants"
            value={summary.total_participants as number}
            sub={`${summary.breach_participants as number} in breach`}
            icon={<Users size={22} />}
            accent="text-blue-400"
          />
        </div>

        {/* Secondary KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Auctions Run"
            value={summary.total_auctions_run as number}
            sub="CIS auction rounds tracked"
            icon={<BarChart2 size={22} />}
            accent="text-purple-400"
          />
          <KpiCard
            title="Mechanisms Compared"
            value={summary.mechanisms_compared as number}
            sub="Global design benchmarks"
            icon={<Shield size={22} />}
            accent="text-indigo-400"
          />
          <KpiCard
            title="Breach Participants"
            value={summary.breach_participants as number}
            sub="Non-compliant CIS participants"
            icon={<AlertTriangle size={22} />}
            accent="text-red-400"
          />
          <KpiCard
            title="Regions Tracked"
            value={summary.total_regions_tracked as number}
            sub="NEM regions under review"
            icon={<Clock size={22} />}
            accent="text-cyan-400"
          />
        </div>

        {/* Capacity Obligations Chart */}
        <CapacityObligationsChart records={data.capacity_records} />

        {/* Auction Results Table */}
        <AuctionResultsTable auctions={data.auction_results} />

        {/* Participant Compliance Table */}
        <ParticipantTable participants={data.participants} />

        {/* Mechanism Comparison Cards */}
        <MechanismComparisonGrid mechanisms={data.mechanism_comparison} />
      </div>
    </div>
  )
}
