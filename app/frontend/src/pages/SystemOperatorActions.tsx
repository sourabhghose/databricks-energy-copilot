import { useEffect, useState } from 'react'
import { AlertOctagon, RefreshCw, Zap, TrendingDown, DollarSign, Activity } from 'lucide-react'
import { api, SystemOperatorDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function DirectionTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    GENERATE:      'bg-green-900 text-green-300 border border-green-700',
    REDUCE_OUTPUT: 'bg-red-900 text-red-300 border border-red-700',
    INCREASE_LOAD: 'bg-blue-900 text-blue-300 border border-blue-700',
    REDUCE_LOAD:   'bg-orange-900 text-orange-300 border border-orange-700',
    MAINTAIN:      'bg-gray-700 text-gray-300 border border-gray-600',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${styles[type] ?? 'bg-gray-700 text-gray-300'}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function ReasonBadge({ reason }: { reason: string }) {
  const styles: Record<string, string> = {
    LOW_RESERVE: 'bg-amber-900 text-amber-300 border border-amber-700',
    FREQUENCY:   'bg-purple-900 text-purple-300 border border-purple-700',
    VOLTAGE:     'bg-indigo-900 text-indigo-300 border border-indigo-700',
    NETWORK:     'bg-cyan-900 text-cyan-300 border border-cyan-700',
    SECURITY:    'bg-rose-900 text-rose-300 border border-rose-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${styles[reason] ?? 'bg-gray-700 text-gray-300'}`}>
      {reason.replace('_', ' ')}
    </span>
  )
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const styles: Record<string, string> = {
    SUCCESSFUL: 'bg-green-900 text-green-300',
    PARTIAL:    'bg-amber-900 text-amber-300',
    FAILED:     'bg-red-900 text-red-300',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${styles[outcome] ?? 'bg-gray-700 text-gray-300'}`}>
      {outcome}
    </span>
  )
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const styles: Record<string, string> = {
    LACK_OF_RESERVE_1: 'bg-green-900 text-green-300 border border-green-700',
    LACK_OF_RESERVE_2: 'bg-amber-900 text-amber-300 border border-amber-700',
    LACK_OF_RESERVE_3: 'bg-red-900 text-red-300 border border-red-700',
  }
  const labels: Record<string, string> = {
    LACK_OF_RESERVE_1: 'LOR1',
    LACK_OF_RESERVE_2: 'LOR2',
    LACK_OF_RESERVE_3: 'LOR3',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${styles[trigger] ?? 'bg-gray-700 text-gray-300'}`}>
      {labels[trigger] ?? trigger}
    </span>
  )
}

function CauseBadge({ cause }: { cause: string }) {
  const styles: Record<string, string> = {
    GENERATION_SHORTFALL: 'bg-red-900 text-red-300 border border-red-700',
    NETWORK_FAILURE:      'bg-orange-900 text-orange-300 border border-orange-700',
    EXTREME_DEMAND:       'bg-amber-900 text-amber-300 border border-amber-700',
    CASCADING:            'bg-purple-900 text-purple-300 border border-purple-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${styles[cause] ?? 'bg-gray-700 text-gray-300'}`}>
      {cause.replace(/_/g, ' ')}
    </span>
  )
}

function RiskBadge({ risk }: { risk: string }) {
  const styles: Record<string, string> = {
    LOW:    'bg-green-900 text-green-300 border border-green-700',
    MEDIUM: 'bg-amber-900 text-amber-300 border border-amber-700',
    HIGH:   'bg-red-900 text-red-300 border border-red-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${styles[risk] ?? 'bg-gray-700 text-gray-300'}`}>
      {risk}
    </span>
  )
}

function RegionBadge({ region }: { region: string }) {
  const styles: Record<string, string> = {
    SA1:  'bg-sky-900 text-sky-300',
    NSW1: 'bg-blue-900 text-blue-300',
    VIC1: 'bg-indigo-900 text-indigo-300',
    QLD1: 'bg-teal-900 text-teal-300',
    TAS1: 'bg-emerald-900 text-emerald-300',
    NEM:  'bg-rose-900 text-rose-300',
  }
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${styles[region] ?? 'bg-gray-700 text-gray-300'}`}>
      {region.replace('1', '')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: string
}

function KpiCard({ icon, label, value, sub, accent = 'text-amber-400' }: KpiCardProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-2">
      <div className={`flex items-center gap-2 ${accent}`}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SystemOperatorActions() {
  const [data, setData] = useState<SystemOperatorDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      setRefreshing(true)
      const result = await api.getSystemOperatorDashboard()
      setData(result)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Loading System Operator Actions...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-400 bg-red-950 border border-red-800 rounded-lg m-6">
        Error: {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-gray-100">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-red-900 border border-red-700 rounded-xl p-2.5">
            <AlertOctagon size={28} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              AEMO System Operator Actions &amp; Instructions
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Emergency interventions, directions to participants, RERT activations,
              load shedding events and constraint relaxations
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Zap size={16} />}
          label="Total Directions (2024)"
          value={data.total_directions_2024.toString()}
          sub="Directions issued by AEMO"
          accent="text-amber-400"
        />
        <KpiCard
          icon={<Activity size={16} />}
          label="RERT Activations (2024)"
          value={data.total_rert_activations_2024.toString()}
          sub="Reserve trader activations"
          accent="text-red-400"
        />
        <KpiCard
          icon={<TrendingDown size={16} />}
          label="Total Load Shed"
          value={`${data.total_load_shed_mwh.toLocaleString()} MWh`}
          sub="Unserved energy across events"
          accent="text-orange-400"
        />
        <KpiCard
          icon={<DollarSign size={16} />}
          label="Direction Cost"
          value={`$${data.total_direction_cost_m_aud.toFixed(1)}M`}
          sub="Total 2024 AUD direction costs"
          accent="text-green-400"
        />
      </div>

      {/* Directions Table */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Zap size={18} className="text-amber-400" />
          Directions to Market Participants
        </h2>
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-750 border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Direction ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Issued</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Region</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Participant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">MW</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Reason</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Duration</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Compliance</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {data.directions.map((d, i) => (
                  <tr
                    key={d.direction_id}
                    className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-amber-400">{d.direction_id}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">
                      {new Date(d.issued_datetime).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3"><RegionBadge region={d.region} /></td>
                    <td className="px-4 py-3 text-gray-200 text-xs">{d.participant_name}</td>
                    <td className="px-4 py-3"><DirectionTypeBadge type={d.direction_type} /></td>
                    <td className="px-4 py-3 text-right font-semibold text-white">{d.mw_directed.toFixed(0)}</td>
                    <td className="px-4 py-3"><ReasonBadge reason={d.reason} /></td>
                    <td className="px-4 py-3 text-right text-gray-300">{d.duration_minutes} min</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${d.actual_compliance_pct >= 95 ? 'text-green-400' : d.actual_compliance_pct >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                        {d.actual_compliance_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 text-xs">
                      ${(d.cost_aud / 1_000_000).toFixed(2)}M
                    </td>
                    <td className="px-4 py-3"><OutcomeBadge outcome={d.outcome} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* RERT Activations */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Activity size={18} className="text-red-400" />
          RERT Activations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.rert_activations.map(r => (
            <div key={r.activation_id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-amber-400">{r.activation_id}</span>
                <TriggerBadge trigger={r.trigger} />
              </div>
              <div className="flex items-center gap-2">
                <RegionBadge region={r.region} />
                <span className="text-sm text-gray-400">{r.activation_date}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <p className="text-gray-500">Contracted</p>
                  <p className="text-white font-semibold">{r.contracted_mw.toFixed(0)} MW</p>
                </div>
                <div>
                  <p className="text-gray-500">Activated</p>
                  <p className="text-green-400 font-semibold">{r.activated_mw.toFixed(0)} MW</p>
                </div>
                <div>
                  <p className="text-gray-500">Duration</p>
                  <p className="text-white font-semibold">{r.duration_hours.toFixed(1)} hrs</p>
                </div>
                <div>
                  <p className="text-gray-500">Total Cost</p>
                  <p className="text-orange-400 font-semibold">${r.total_cost_m_aud.toFixed(1)}M</p>
                </div>
              </div>
              <div className="text-xs">
                <p className="text-gray-500 mb-1">Reserve Margin</p>
                <div className="flex items-center gap-2">
                  <span className="text-red-400 font-semibold">{r.reserve_margin_pre_pct.toFixed(1)}%</span>
                  <span className="text-gray-600">before</span>
                  <span className="text-gray-600">→</span>
                  <span className="text-green-400 font-semibold">{r.reserve_margin_post_pct.toFixed(1)}%</span>
                  <span className="text-gray-600">after</span>
                </div>
              </div>
              <div className="text-xs">
                <p className="text-gray-500 mb-1">Providers</p>
                <div className="flex flex-wrap gap-1">
                  {r.providers.map(p => (
                    <span key={p} className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded text-xs">{p}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Load Shedding Events */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <TrendingDown size={18} className="text-orange-400" />
          Load Shedding Events
        </h2>
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-750 border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Region</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">State</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Cause</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Peak (MW)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Duration</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Customers</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Unserved (MWh)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Fin. Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">VoLL Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.load_shedding.map((e, i) => (
                  <tr
                    key={e.event_id}
                    className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'}`}
                  >
                    <td className="px-4 py-3 text-gray-300 text-xs font-mono">{e.event_date}</td>
                    <td className="px-4 py-3"><RegionBadge region={e.region} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{e.state}</td>
                    <td className="px-4 py-3"><CauseBadge cause={e.cause} /></td>
                    <td className="px-4 py-3 text-right font-semibold text-red-400">{e.peak_shedding_mw.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{e.duration_minutes} min</td>
                    <td className="px-4 py-3 text-right text-gray-300">{e.affected_customers.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-400">{e.unserved_energy_mwh.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-300">${e.financial_cost_m_aud.toFixed(0)}M</td>
                    <td className="px-4 py-3 text-right text-amber-400 font-semibold">${e.voll_cost_m_aud.toFixed(0)}M</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Constraint Relaxations */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <AlertOctagon size={18} className="text-purple-400" />
          Constraint Relaxations
        </h2>
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-750 border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Constraint</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Region</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Original (MW)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Relaxed (MW)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Delta (MW)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Approval</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.constraint_relaxations.map((cr, i) => (
                  <tr
                    key={cr.relaxation_id}
                    className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'}`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-white text-xs font-medium">{cr.constraint_name}</p>
                      <p className="font-mono text-gray-500 text-xs">{cr.constraint_id}</p>
                    </td>
                    <td className="px-4 py-3"><RegionBadge region={cr.region} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{cr.relaxation_date}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{cr.original_limit_mw.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400">{cr.relaxed_limit_mw.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-400">+{cr.relaxation_mw.toFixed(0)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{cr.approval_authority}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{cr.duration_hours.toFixed(1)} hrs</td>
                    <td className="px-4 py-3"><RiskBadge risk={cr.risk_assessment} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="text-xs text-gray-600 text-center pb-4">
        AEMO System Operator Actions — Sprint 47c &bull; Data sourced from AEMO Operational Data &bull; Last updated: {new Date(data.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
      </div>
    </div>
  )
}
