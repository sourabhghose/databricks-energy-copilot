// ---------------------------------------------------------------------------
// Sprint 46c — Electricity Market Design & Reform Tracker
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import {
  BookOpen,
  RefreshCw,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { api } from '../api/client'
import type {
  MarketDesignDashboard,
  MarketDesignProposalRecord,
  CapacityMechanismRecord,
  SettlementReformRecord,
  MarketDesignComparisonRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers & badge styles
// ---------------------------------------------------------------------------

function fmtNum(n: number, decimals = 0) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtAud(n: number, decimals = 2) {
  return `$${fmtNum(n, decimals)}`
}

const PROPOSAL_STATUS_STYLES: Record<string, string> = {
  CONSULTATION:         'bg-blue-900 text-blue-300 border border-blue-700',
  DRAFT_DETERMINATION:  'bg-amber-900 text-amber-300 border border-amber-700',
  FINAL_DETERMINATION:  'bg-orange-900 text-orange-300 border border-orange-700',
  IMPLEMENTED:          'bg-green-900 text-green-300 border border-green-700',
  REJECTED:             'bg-red-900 text-red-300 border border-red-700',
}

const REFORM_AREA_STYLES: Record<string, string> = {
  CAPACITY_MECHANISM: 'bg-red-900 text-red-300 border border-red-700',
  PRICING:            'bg-amber-900 text-amber-300 border border-amber-700',
  SETTLEMENT:         'bg-blue-900 text-blue-300 border border-blue-700',
  STORAGE:            'bg-cyan-900 text-cyan-300 border border-cyan-700',
  DER:                'bg-green-900 text-green-300 border border-green-700',
  RETAIL:             'bg-purple-900 text-purple-300 border border-purple-700',
  PLANNING:           'bg-gray-700 text-gray-300 border border-gray-600',
}

const IMPACT_STYLES: Record<string, string> = {
  LOW:           'bg-gray-700 text-gray-300 border border-gray-600',
  MEDIUM:        'bg-amber-900 text-amber-300 border border-amber-700',
  HIGH:          'bg-orange-900 text-orange-300 border border-orange-700',
  TRANSFORMATIVE: 'bg-red-900 text-red-300 border border-red-700',
}

const MECHANISM_STATUS_STYLES: Record<string, string> = {
  PROPOSED:   'bg-blue-900 text-blue-300 border border-blue-700',
  PILOT:      'bg-amber-900 text-amber-300 border border-amber-700',
  OPERATIONAL:'bg-green-900 text-green-300 border border-green-700',
}

const MECHANISM_TYPE_STYLES: Record<string, string> = {
  RELIABILITY_OBLIGATION: 'bg-red-900 text-red-300 border border-red-700',
  CAPACITY_AUCTION:       'bg-blue-900 text-blue-300 border border-blue-700',
  STRATEGIC_RESERVE:      'bg-amber-900 text-amber-300 border border-amber-700',
  CAPACITY_PAYMENT:       'bg-purple-900 text-purple-300 border border-purple-700',
}

const WINNER_STYLES: Record<string, string> = {
  GENERATORS: 'bg-red-900 text-red-300 border border-red-700',
  STORAGE:    'bg-blue-900 text-blue-300 border border-blue-700',
  CONSUMERS:  'bg-green-900 text-green-300 border border-green-700',
  MIXED:      'bg-amber-900 text-amber-300 border border-amber-700',
}

const MARKET_TYPE_STYLES: Record<string, string> = {
  GROSS_POOL:  'bg-blue-900 text-blue-300 border border-blue-700',
  NET_POOL:    'bg-purple-900 text-purple-300 border border-purple-700',
  BILATERAL:   'bg-gray-700 text-gray-300 border border-gray-600',
  HYBRID:      'bg-cyan-900 text-cyan-300 border border-cyan-700',
}

const CAP_MECH_MARKET_STYLES: Record<string, string> = {
  NONE:       'bg-gray-700 text-gray-300 border border-gray-600',
  AUCTION:    'bg-blue-900 text-blue-300 border border-blue-700',
  OBLIGATION: 'bg-amber-900 text-amber-300 border border-amber-700',
  PAYMENT:    'bg-purple-900 text-purple-300 border border-purple-700',
}

function Badge({ value, styles }: { value: string; styles: Record<string, string> }) {
  const cls = styles[value] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'IMPLEMENTED') return <CheckCircle size={14} className="text-green-400 inline mr-1" />
  if (status === 'REJECTED') return <XCircle size={14} className="text-red-400 inline mr-1" />
  if (status === 'FINAL_DETERMINATION') return <AlertCircle size={14} className="text-orange-400 inline mr-1" />
  return <Clock size={14} className="text-blue-400 inline mr-1" />
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub?: string
  accent?: string
  icon?: React.ReactNode
}

function KpiCard({ label, value, sub, accent = 'text-amber-400', icon }: KpiProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Proposal status filter
// ---------------------------------------------------------------------------

const STATUS_FILTERS = ['ALL', 'CONSULTATION', 'DRAFT_DETERMINATION', 'FINAL_DETERMINATION', 'IMPLEMENTED', 'REJECTED']

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function MarketDesignReform() {
  const [data, setData] = useState<MarketDesignDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('ALL')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const d = await api.getMarketDesignDashboard()
      setData(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load market design data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filteredProposals: MarketDesignProposalRecord[] = data
    ? (statusFilter === 'ALL' ? data.proposals : data.proposals.filter(p => p.status === statusFilter))
    : []

  // Chart data for reform area breakdown
  const reformAreaChart = data
    ? Object.entries(
        data.proposals.reduce<Record<string, number>>((acc, p) => {
          acc[p.reform_area] = (acc[p.reform_area] ?? 0) + 1
          return acc
        }, {})
      ).map(([area, count]) => ({ area: area.replace(/_/g, ' '), count }))
    : []

  // Chart data for capacity mechanisms target vs contracted
  const capacityChart: { name: string; target: number; contracted: number }[] = data
    ? data.capacity_mechanisms.map(m => ({
        name: m.region,
        target: Math.round(m.target_capacity_mw),
        contracted: Math.round(m.contracted_capacity_mw),
      }))
    : []

  return (
    <div className="flex flex-col gap-6 p-6 bg-gray-900 min-h-screen text-gray-100">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <BookOpen size={28} className="text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Electricity Market Design &amp; Reform Tracker</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              NEM reform pipeline, capacity mechanisms, 5-minute settlement impacts, and global market benchmarking
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 rounded p-3 text-sm">{error}</div>
      )}

      {loading && !data && (
        <div className="text-center text-gray-400 py-16">Loading market design data...</div>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Active Reform Proposals"
              value={String(data.active_proposals)}
              sub="In consultation or determination"
              accent="text-blue-400"
              icon={<Clock size={14} />}
            />
            <KpiCard
              label="Implemented Reforms"
              value={String(data.implemented_reforms)}
              sub="Successfully enacted"
              accent="text-green-400"
              icon={<CheckCircle size={14} />}
            />
            <KpiCard
              label="Total Reform Benefit"
              value={`$${fmtNum(data.total_reform_benefit_b_aud, 2)}B AUD`}
              sub="Annualised across implemented reforms"
              accent="text-amber-400"
            />
            <KpiCard
              label="Capacity Mechanism Pipeline"
              value={`${fmtNum(data.capacity_mechanism_pipeline_gw, 2)} GW`}
              sub="Proposed + pilot mechanisms"
              accent="text-indigo-400"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Reform area breakdown */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Proposals by Reform Area</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={reformAreaChart} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="area"
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                    labelStyle={{ color: '#e5e7eb' }}
                    itemStyle={{ color: '#818cf8' }}
                  />
                  <Bar dataKey="count" fill="#818cf8" name="Proposals" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Capacity mechanism target vs contracted */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Capacity Mechanisms — Target vs Contracted (MW)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={capacityChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                    labelStyle={{ color: '#e5e7eb' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  <Bar dataKey="target" fill="#f59e0b" name="Target (MW)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="contracted" fill="#10b981" name="Contracted (MW)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reform Proposals Table */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-gray-300">Reform Proposals</h2>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1"
                >
                  {STATUS_FILTERS.map(s => (
                    <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-2 pr-3">Title</th>
                    <th className="py-2 pr-3">Body</th>
                    <th className="py-2 pr-3">Area</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Impact</th>
                    <th className="py-2 pr-3">Decision Date</th>
                    <th className="py-2 pr-3 text-right">Benefit ($M/yr)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProposals.map(p => (
                    <tr key={p.proposal_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1">
                          <StatusIcon status={p.status} />
                          <span className="text-gray-200 font-medium max-w-xs" title={p.summary}>
                            {p.title}
                          </span>
                        </div>
                        <div className="text-gray-500 mt-0.5 text-xs max-w-sm truncate" title={p.summary}>
                          {p.summary.slice(0, 80)}...
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <span className="text-gray-300">{p.proposing_body}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge value={p.reform_area} styles={REFORM_AREA_STYLES} />
                      </td>
                      <td className="py-2 pr-3">
                        <Badge value={p.status} styles={PROPOSAL_STATUS_STYLES} />
                      </td>
                      <td className="py-2 pr-3">
                        <Badge value={p.impact_assessment} styles={IMPACT_STYLES} />
                      </td>
                      <td className="py-2 pr-3 text-gray-400">
                        {p.decision_date ?? <span className="text-gray-600">TBD</span>}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        {p.annual_benefit_m_aud != null
                          ? <span className="text-green-400">{fmtAud(p.annual_benefit_m_aud, 0)}</span>
                          : <span className="text-gray-600">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProposals.length === 0 && (
                <div className="text-center text-gray-500 py-6 text-sm">No proposals match selected filter</div>
              )}
            </div>
          </div>

          {/* Capacity Mechanisms Table */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Capacity Mechanisms</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-2 pr-3">Mechanism</th>
                    <th className="py-2 pr-3">Region</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 text-right">Target (MW)</th>
                    <th className="py-2 pr-3 text-right">Contracted (MW)</th>
                    <th className="py-2 pr-3 text-right">$/MW</th>
                    <th className="py-2 pr-3 text-center">Storage</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.capacity_mechanisms as CapacityMechanismRecord[]).map(m => {
                    const fillPct = m.target_capacity_mw > 0
                      ? Math.round((m.contracted_capacity_mw / m.target_capacity_mw) * 100)
                      : 0
                    return (
                      <tr key={m.mechanism_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                        <td className="py-2 pr-3 text-gray-200 font-medium">{m.mechanism_name}</td>
                        <td className="py-2 pr-3 text-gray-300">{m.region}</td>
                        <td className="py-2 pr-3">
                          <Badge value={m.mechanism_type} styles={MECHANISM_TYPE_STYLES} />
                        </td>
                        <td className="py-2 pr-3">
                          <Badge value={m.status} styles={MECHANISM_STATUS_STYLES} />
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-gray-300">
                          {fmtNum(m.target_capacity_mw)}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <div className="font-mono text-gray-300">{fmtNum(m.contracted_capacity_mw)}</div>
                          <div className="w-full bg-gray-700 rounded h-1 mt-1">
                            <div
                              className="bg-green-500 h-1 rounded"
                              style={{ width: `${Math.min(fillPct, 100)}%` }}
                            />
                          </div>
                          <div className="text-gray-500 text-xs mt-0.5">{fillPct}% filled</div>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-amber-400">
                          {fmtAud(m.cost_per_mw_aud, 0)}
                        </td>
                        <td className="py-2 pr-3 text-center">
                          {m.storage_eligible
                            ? <CheckCircle size={14} className="text-green-400 inline" />
                            : <XCircle size={14} className="text-red-400 inline" />
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Settlement Reforms Section */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Settlement Reform Impact Analysis</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {(data.settlement_reforms as SettlementReformRecord[]).map(r => {
                const priceChange = r.post_reform_avg_price - r.pre_reform_avg_price
                const priceDown = priceChange < 0
                return (
                  <div
                    key={r.reform_name}
                    className="bg-gray-900 border border-gray-700 rounded-lg p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-gray-200 font-medium text-xs leading-tight">{r.reform_name}</div>
                      <Badge value={r.winner} styles={WINNER_STYLES} />
                    </div>
                    <div className="text-gray-500 text-xs">{r.region} — Implemented {r.implementation_date}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-gray-500">Pre-reform avg price</div>
                        <div className="text-gray-300 font-mono">{fmtAud(r.pre_reform_avg_price, 2)}/MWh</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Post-reform avg price</div>
                        <div className={`font-mono ${priceDown ? 'text-green-400' : 'text-red-400'}`}>
                          {fmtAud(r.post_reform_avg_price, 2)}/MWh
                          <span className="ml-1 text-xs">
                            ({priceDown ? '' : '+'}{fmtNum(priceChange, 2)})
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Volatility change</div>
                        <div className={`font-mono ${r.price_volatility_change_pct < 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {r.price_volatility_change_pct > 0 ? '+' : ''}{fmtNum(r.price_volatility_change_pct, 1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Storage revenue</div>
                        <div className="text-blue-400 font-mono">+{fmtAud(r.storage_revenue_change_m_aud, 0)}M</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Demand response</div>
                        <div className="text-cyan-400 font-mono">+{fmtNum(r.demand_response_change_mw)} MW</div>
                      </div>
                    </div>
                    <div className="text-gray-500 text-xs leading-relaxed border-t border-gray-700 pt-2">
                      {r.assessment.slice(0, 120)}...
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Global Market Comparison Table */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Global Electricity Market Design Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-2 pr-3">Market</th>
                    <th className="py-2 pr-3">Country</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3 text-right">Settlement (min)</th>
                    <th className="py-2 pr-3">Capacity Mechanism</th>
                    <th className="py-2 pr-3 text-right">Price Cap ($/MWh)</th>
                    <th className="py-2 pr-3 text-right">Renewables %</th>
                    <th className="py-2 pr-3 text-right">Avg Price ($/MWh)</th>
                    <th className="py-2 pr-3 text-right">Size (TWh)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.market_comparison as MarketDesignComparisonRecord[]).map(m => {
                    const isNem = m.market === 'NEM'
                    const rowCls = isNem
                      ? 'border-b border-indigo-800/60 bg-indigo-950/40 hover:bg-indigo-950/60'
                      : 'border-b border-gray-700/50 hover:bg-gray-750'
                    return (
                      <tr key={m.market} className={rowCls}>
                        <td className="py-2 pr-3">
                          <span className={`font-bold ${isNem ? 'text-indigo-300' : 'text-gray-200'}`}>
                            {m.market}
                          </span>
                          {isNem && (
                            <span className="ml-1 text-xs bg-indigo-900 text-indigo-300 border border-indigo-700 rounded px-1">
                              HOME
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-gray-400">{m.country}</td>
                        <td className="py-2 pr-3">
                          <Badge value={m.market_type} styles={MARKET_TYPE_STYLES} />
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-gray-300">
                          {m.settlement_interval_min}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge value={m.capacity_mechanism} styles={CAP_MECH_MARKET_STYLES} />
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-amber-400">
                          {fmtAud(m.price_cap_aud_mwh, 0)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          <span className={m.renewables_pct >= 50 ? 'text-green-400' : 'text-gray-300'}>
                            {fmtNum(m.renewables_pct, 1)}%
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-gray-300">
                          {fmtAud(m.avg_price_aud_mwh, 2)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-gray-400">
                          {fmtNum(m.market_size_twh, 0)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              * NEM row highlighted. Prices converted to AUD at approximate exchange rates. Data indicative for comparison purposes.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
