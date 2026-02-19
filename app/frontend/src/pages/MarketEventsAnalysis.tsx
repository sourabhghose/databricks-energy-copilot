import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  api,
  NEMSuspensionDashboard,
  MajorMarketEvent,
  InterventionRecord,
  MarketEventTimeline,
} from '../api/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, unit, sub }: { label: string; value: string | number; unit?: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  MARKET_SUSPENSION: '#ef4444',
  PRICE_CAP: '#f97316',
  AEMO_DIRECTION: '#eab308',
  LOAD_SHEDDING: '#a855f7',
  SYSTEM_EMERGENCY: '#b91c1c',
  FORCE_MAJEURE: '#6b7280',
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  MARKET_SUSPENSION: 'Market Suspension',
  PRICE_CAP: 'Price Cap',
  AEMO_DIRECTION: 'AEMO Direction',
  LOAD_SHEDDING: 'Load Shedding',
  SYSTEM_EMERGENCY: 'System Emergency',
  FORCE_MAJEURE: 'Force Majeure',
}

function EventTypeBadge({ type }: { type: string }) {
  const color = EVENT_TYPE_COLORS[type] ?? '#6b7280'
  const label = EVENT_TYPE_LABELS[type] ?? type
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: color + '33', color }}
    >
      {label}
    </span>
  )
}

const MILESTONE_TYPE_COLORS: Record<string, string> = {
  NOTICE: '#60a5fa',
  DIRECTION: '#eab308',
  DECLARATION: '#f97316',
  SUSPENSION: '#ef4444',
  RESTORATION: '#22c55e',
  SETTLEMENT: '#a78bfa',
}

function MilestoneBadge({ type }: { type: string }) {
  const color = MILESTONE_TYPE_COLORS[type] ?? '#6b7280'
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: color + '33', color }}
    >
      {type}
    </span>
  )
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const colors: Record<string, string> = {
    SUCCESSFUL: '#22c55e',
    PARTIAL: '#eab308',
    FAILED: '#ef4444',
  }
  const color = colors[outcome] ?? '#6b7280'
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: color + '33', color }}
    >
      {outcome}
    </span>
  )
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-AU', { maximumFractionDigits: decimals })
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MarketEventsAnalysis() {
  const [dash, setDash] = useState<NEMSuspensionDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string>('ALL')

  useEffect(() => {
    api
      .getNEMSuspensionDashboard()
      .then(d => {
        setDash(d)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading NEM Market Events...</div>
      </div>
    )
  }

  if (error || !dash) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-red-400 text-sm">Error: {error ?? 'No data'}</div>
      </div>
    )
  }

  // Duration bar chart data
  const barData = dash.events.map(e => ({
    name: e.event_name.length > 22 ? e.event_name.slice(0, 22) + '…' : e.event_name,
    duration_days: e.duration_days,
    event_type: e.event_type,
    event_id: e.event_id,
  }))

  // Interventions filter
  const filteredInterventions: InterventionRecord[] =
    selectedEventId === 'ALL'
      ? dash.interventions
      : dash.interventions.filter(i => i.event_id === selectedEventId)

  // Timeline filter
  const filteredTimeline: MarketEventTimeline[] =
    selectedEventId === 'ALL'
      ? dash.timeline
      : dash.timeline.filter(t => t.event_id === selectedEventId)

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertTriangle size={28} className="text-red-400" />
        <div>
          <h1 className="text-xl font-bold text-white">NEM Market Events &amp; AEMO Interventions Analysis</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Major market suspension events, price spikes, AEMO interventions, and system emergencies
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Total Major Events (5yr)"
          value={dash.total_events_5yr}
          unit="events"
          sub="Since 2019"
        />
        <KpiCard
          label="Total Suspension Days"
          value={fmt(dash.total_suspension_days, 1)}
          unit="days"
          sub="Market suspension only"
        />
        <KpiCard
          label="Total Market Cost"
          value={`$${fmt(dash.total_market_cost_m_aud, 0)}M`}
          sub="Cumulative estimated cost"
        />
        <KpiCard
          label="Total Load Shed"
          value={fmt(dash.total_load_shed_gwh, 3)}
          unit="GWh"
          sub="Across all events"
        />
      </div>

      {/* Duration bar chart */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Event Duration by Type (days)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 30, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={v => `${v}d`}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={170}
              tick={{ fill: '#d1d5db', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(val: number) => [`${val} days`, 'Duration']}
            />
            <Bar dataKey="duration_days" radius={[0, 4, 4, 0]}>
              {barData.map((entry, idx) => (
                <Cell key={idx} fill={EVENT_TYPE_COLORS[entry.event_type] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: EVENT_TYPE_COLORS[k] }}
              />
              {v}
            </div>
          ))}
        </div>
      </div>

      {/* Events table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-200 px-4 py-3 border-b border-gray-700">
          Major Market Events
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Event</th>
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Start</th>
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Type</th>
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Regions</th>
                <th className="px-3 py-2 text-right text-gray-400 font-medium">Duration</th>
                <th className="px-3 py-2 text-right text-gray-400 font-medium">Before $/MWh</th>
                <th className="px-3 py-2 text-right text-gray-400 font-medium">During $/MWh</th>
                <th className="px-3 py-2 text-right text-gray-400 font-medium">Max $/MWh</th>
                <th className="px-3 py-2 text-right text-gray-400 font-medium">Cost $M</th>
                <th className="px-3 py-2 text-right text-gray-400 font-medium">Notices</th>
              </tr>
            </thead>
            <tbody>
              {dash.events.map(evt => (
                <>
                  <tr
                    key={evt.event_id}
                    className="border-t border-gray-700 hover:bg-gray-700/40 cursor-pointer"
                    onClick={() => setExpandedEvent(expandedEvent === evt.event_id ? null : evt.event_id)}
                  >
                    <td className="px-3 py-2 text-white font-medium">{evt.event_name}</td>
                    <td className="px-3 py-2">{evt.start_date}</td>
                    <td className="px-3 py-2">
                      <EventTypeBadge type={evt.event_type} />
                    </td>
                    <td className="px-3 py-2">{evt.regions_affected.join(', ')}</td>
                    <td className="px-3 py-2 text-right">{evt.duration_days}d</td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      ${fmt(evt.avg_spot_price_before_aud_mwh, 0)}
                    </td>
                    <td className="px-3 py-2 text-right text-amber-300 font-semibold">
                      ${fmt(evt.avg_spot_price_during_aud_mwh, 0)}
                    </td>
                    <td className="px-3 py-2 text-right text-red-300">
                      ${fmt(evt.max_spot_price_aud_mwh, 0)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {evt.total_market_cost_m_aud < 0
                        ? <span className="text-green-400">${fmt(evt.total_market_cost_m_aud, 0)}M</span>
                        : <span>${fmt(evt.total_market_cost_m_aud, 0)}M</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-right">{evt.aemo_market_notices}</td>
                  </tr>
                  {expandedEvent === evt.event_id && (
                    <tr key={`${evt.event_id}-desc`} className="bg-gray-700/30">
                      <td colSpan={10} className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="text-gray-200 text-xs leading-relaxed">{evt.description}</p>
                          <p className="text-gray-400 text-xs">
                            <span className="font-medium text-gray-300">Trigger: </span>{evt.trigger}
                          </p>
                          <p className="text-gray-400 text-xs">
                            <span className="font-medium text-gray-300">Generators Directed: </span>{evt.generators_directed} &nbsp;|&nbsp;
                            <span className="font-medium text-gray-300">Rule Changes: </span>{evt.rule_changes_triggered}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event filter dropdown */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-400 font-medium">Filter by Event:</label>
        <select
          value={selectedEventId}
          onChange={e => setSelectedEventId(e.target.value)}
          className="bg-gray-700 text-gray-200 text-xs rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500"
        >
          <option value="ALL">All Events</option>
          {dash.events.map(e => (
            <option key={e.event_id} value={e.event_id}>
              {e.event_name}
            </option>
          ))}
        </select>
      </div>

      {/* Interventions table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-200 px-4 py-3 border-b border-gray-700">
          AEMO Interventions {selectedEventId !== 'ALL' && `— ${dash.events.find(e => e.event_id === selectedEventId)?.event_name ?? ''}`}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Type</th>
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Date</th>
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Region</th>
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Generator / Party</th>
                <th className="px-3 py-2 text-right text-gray-400 font-medium">Qty (MW)</th>
                <th className="px-3 py-2 text-right text-gray-400 font-medium">Duration (hrs)</th>
                <th className="px-3 py-2 text-right text-gray-400 font-medium">Cost $M</th>
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {filteredInterventions.map(intv => (
                <tr key={intv.intervention_id} className="border-t border-gray-700 hover:bg-gray-700/30">
                  <td className="px-3 py-2">
                    <span className="bg-blue-900/40 text-blue-300 text-xs px-2 py-0.5 rounded font-medium">
                      {intv.intervention_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2">{intv.date}</td>
                  <td className="px-3 py-2">{intv.region}</td>
                  <td className="px-3 py-2 text-white">{intv.generator_or_party}</td>
                  <td className="px-3 py-2 text-right">{fmt(intv.quantity_mw, 0)}</td>
                  <td className="px-3 py-2 text-right">{intv.duration_hrs}</td>
                  <td className="px-3 py-2 text-right">{intv.cost_m_aud > 0 ? `$${fmt(intv.cost_m_aud, 1)}M` : '—'}</td>
                  <td className="px-3 py-2">
                    <OutcomeBadge outcome={intv.outcome} />
                  </td>
                </tr>
              ))}
              {filteredInterventions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-gray-500">No interventions for selected event</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline milestones */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-200 px-4 py-3 border-b border-gray-700">
          Event Timeline Milestones {selectedEventId !== 'ALL' && `— ${dash.events.find(e => e.event_id === selectedEventId)?.event_name ?? ''}`}
        </h2>
        <div className="divide-y divide-gray-700">
          {filteredTimeline
            .slice()
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
            .map(tl => (
              <div key={tl.record_id} className="px-4 py-3 flex gap-3 items-start hover:bg-gray-700/20">
                <div className="shrink-0 pt-0.5">
                  <MilestoneBadge type={tl.milestone_type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 font-mono">{tl.timestamp.replace('T', ' ')}</span>
                    <span className="text-xs text-gray-500">|</span>
                    <span className="text-xs text-blue-300 font-medium">{tl.region}</span>
                  </div>
                  <p className="text-sm text-white font-medium mt-0.5">{tl.milestone}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tl.detail}</p>
                </div>
              </div>
            ))}
          {filteredTimeline.length === 0 && (
            <div className="px-4 py-4 text-center text-gray-500 text-xs">
              No timeline milestones for selected event
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
