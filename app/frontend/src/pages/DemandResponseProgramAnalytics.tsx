import { useEffect, useState } from 'react'
import { Sliders } from 'lucide-react'
import {
  getDemandResponseProgramsDashboard,
  DRPDashboard,
  DRPProgramRecord,
  DRPEventRecord,
  DRPParticipantRecord,
  DRPCapacityRecord,
  DRPBarrierRecord,
} from '../api/client'
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

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  sub,
  color = 'text-emerald-400',
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Impact Badge ──────────────────────────────────────────────────────────────

function ImpactBadge({ impact }: { impact: string }) {
  const cls =
    impact === 'HIGH'
      ? 'bg-red-900 text-red-300'
      : impact === 'MEDIUM'
      ? 'bg-amber-900 text-amber-300'
      : 'bg-green-900 text-green-300'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{impact}</span>
  )
}

// ── Type Badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    RERT: 'bg-purple-900 text-purple-300',
    DIRECT_LOAD_CONTROL: 'bg-blue-900 text-blue-300',
    VOLUNTARY_DSP: 'bg-teal-900 text-teal-300',
    NETWORK_RELIEF: 'bg-orange-900 text-orange-300',
    CAPACITY_MARKET_DR: 'bg-pink-900 text-pink-300',
    AEMC_DR_RULE: 'bg-indigo-900 text-indigo-300',
  }
  const cls = map[type] ?? 'bg-gray-700 text-gray-300'
  const label = type.replace(/_/g, ' ')
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{label}</span>
  )
}

// ── Trigger Badge ─────────────────────────────────────────────────────────────

function TriggerBadge({ trigger }: { trigger: string }) {
  const map: Record<string, string> = {
    PRICE_SPIKE: 'bg-red-900 text-red-300',
    CAPACITY_SHORTAGE: 'bg-orange-900 text-orange-300',
    NETWORK_CONSTRAINT: 'bg-yellow-900 text-yellow-300',
    EMERGENCY: 'bg-rose-900 text-rose-300',
  }
  const cls = map[trigger] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {trigger.replace(/_/g, ' ')}
    </span>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DemandResponseProgramAnalytics() {
  const [data, setData] = useState<DRPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDemandResponseProgramsDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading demand response program data...
      </div>
    )
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )

  const summary = data.summary as Record<string, number>

  // Build capacity chart data grouped by quarter (aggregate all regions)
  const quarterMap: Record<string, { quarter: string; RERT: number; 'Voluntary DSP': number; 'Direct Load Control': number; 'Network Relief': number }> = {}
  for (const r of data.capacity) {
    if (!quarterMap[r.quarter]) {
      quarterMap[r.quarter] = { quarter: r.quarter, RERT: 0, 'Voluntary DSP': 0, 'Direct Load Control': 0, 'Network Relief': 0 }
    }
    quarterMap[r.quarter].RERT += r.rert_contracted_mw
    quarterMap[r.quarter]['Voluntary DSP'] += r.voluntary_dsp_mw
    quarterMap[r.quarter]['Direct Load Control'] += r.direct_load_control_mw
    quarterMap[r.quarter]['Network Relief'] += r.network_relief_mw
  }
  const capacityChartData = Object.values(quarterMap).map(q => ({
    ...q,
    RERT: Math.round(q.RERT),
    'Voluntary DSP': Math.round(q['Voluntary DSP']),
    'Direct Load Control': Math.round(q['Direct Load Control']),
    'Network Relief': Math.round(q['Network Relief']),
  }))

  // Participant sector aggregation
  const sectorMap: Record<string, { sector: string; enrolled: number; delivered: number }> = {}
  for (const p of data.participants) {
    if (!sectorMap[p.sector]) sectorMap[p.sector] = { sector: p.sector, enrolled: 0, delivered: 0 }
    sectorMap[p.sector].enrolled += p.enrolled_mw
    sectorMap[p.sector].delivered += p.avg_delivered_mw
  }
  const sectorChartData = Object.values(sectorMap).map(s => ({
    sector: s.sector.replace(/_/g, ' '),
    'Enrolled MW': Math.round(s.enrolled * 10) / 10,
    'Avg Delivered MW': Math.round(s.delivered * 10) / 10,
  }))

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sliders className="text-emerald-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Demand Response Program Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            NEM demand response programs — RERT, direct load control, voluntary DSP and C&I aggregation
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-4">
        <KpiCard
          label="Total Enrolled Capacity"
          value={summary.total_enrolled_mw?.toLocaleString()}
          unit="MW"
          color="text-emerald-400"
        />
        <KpiCard
          label="Total Programs"
          value={summary.total_programs}
          unit="programs"
          color="text-blue-400"
        />
        <KpiCard
          label="Avg Response Rate"
          value={summary.avg_response_rate_pct}
          unit="%"
          color="text-teal-400"
        />
        <KpiCard
          label="Events in 2024"
          value={summary.total_events_2024}
          unit="events"
          color="text-amber-400"
        />
        <KpiCard
          label="Load Shedding Avoided"
          value={summary.avoided_load_shedding_events}
          unit="events"
          color="text-green-400"
        />
        <KpiCard
          label="Annual DR Cost"
          value={`$${summary.annual_dr_cost_m}M`}
          color="text-orange-400"
        />
        <KpiCard
          label="DR as % of Peak (avg)"
          value={summary.dr_as_pct_of_peak_avg}
          unit="%"
          color="text-purple-400"
        />
      </div>

      {/* Program Overview Table */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Program Overview</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3 text-right">Enrolled MW</th>
                <th className="px-4 py-3 text-right">Participants</th>
                <th className="px-4 py-3 text-right">Avg Response (min)</th>
                <th className="px-4 py-3">Threshold</th>
                <th className="px-4 py-3 text-right">Activations/yr</th>
                <th className="px-4 py-3 text-right">$/MWh</th>
                <th className="px-4 py-3 text-right">Annual Cost ($M)</th>
              </tr>
            </thead>
            <tbody>
              {data.programs.map((prog: DRPProgramRecord, i: number) => (
                <tr
                  key={prog.program_id}
                  className={`border-t border-gray-700 ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'} hover:bg-gray-750 transition-colors`}
                >
                  <td className="px-4 py-2.5 font-medium text-white">{prog.program_name}</td>
                  <td className="px-4 py-2.5">
                    <TypeBadge type={prog.program_type} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-300">{prog.operator}</td>
                  <td className="px-4 py-2.5 text-gray-300">{prog.region}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">
                    {prog.enrolled_capacity_mw.toFixed(0)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300 font-mono">
                    {prog.active_participants.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-blue-300 font-mono">
                    {prog.avg_response_time_min.toFixed(1)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{prog.activation_threshold}</td>
                  <td className="px-4 py-2.5 text-right text-amber-300 font-mono">
                    {prog.activations_per_year.toFixed(1)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300 font-mono">
                    ${prog.avg_payment_per_mwh.toFixed(0)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-orange-300 font-mono">
                    ${prog.annual_program_cost_m.toFixed(1)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Charts Row: Capacity by Quarter + Sector Participants */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Capacity by Quarter – Stacked Bar */}
        <section className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-4">
            DR Capacity by Type — NEM 2024 (MW)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={capacityChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#F9FAFB' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
              <Bar dataKey="RERT" stackId="a" fill="#8B5CF6" />
              <Bar dataKey="Voluntary DSP" stackId="a" fill="#14B8A6" />
              <Bar dataKey="Direct Load Control" stackId="a" fill="#3B82F6" />
              <Bar dataKey="Network Relief" stackId="a" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* Participant Sector – Enrolled vs Delivered */}
        <section className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-4">
            Participant Sectors — Enrolled vs Avg Delivered MW
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sectorChartData} layout="vertical" margin={{ top: 4, right: 16, left: 80, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis dataKey="sector" type="category" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={80} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#F9FAFB' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
              <Bar dataKey="Enrolled MW" fill="#10B981" radius={[0, 3, 3, 0]} />
              <Bar dataKey="Avg Delivered MW" fill="#6366F1" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      {/* Event History Table */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">DR Event History (2021–2024)</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Event ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3 text-right">Requested MW</th>
                <th className="px-4 py-3 text-right">Delivered MW</th>
                <th className="px-4 py-3 text-right">Response %</th>
                <th className="px-4 py-3 text-right">Duration (hrs)</th>
                <th className="px-4 py-3 text-right">Cost ($M)</th>
                <th className="px-4 py-3 text-center">Avoided Shedding</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((ev: DRPEventRecord, i: number) => (
                <tr
                  key={ev.event_id}
                  className={`border-t border-gray-700 ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'} hover:bg-gray-750 transition-colors`}
                >
                  <td className="px-4 py-2 font-mono text-gray-400 text-xs">{ev.event_id}</td>
                  <td className="px-4 py-2 text-gray-300">{ev.date}</td>
                  <td className="px-4 py-2 text-gray-300">{ev.region}</td>
                  <td className="px-4 py-2 text-white text-xs">{ev.program}</td>
                  <td className="px-4 py-2">
                    <TriggerBadge trigger={ev.trigger_type} />
                  </td>
                  <td className="px-4 py-2 text-right text-gray-300 font-mono">{ev.requested_mw.toFixed(0)}</td>
                  <td className="px-4 py-2 text-right text-emerald-400 font-mono">{ev.delivered_mw.toFixed(0)}</td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`font-mono ${ev.response_rate_pct >= 90 ? 'text-green-400' : ev.response_rate_pct >= 85 ? 'text-amber-400' : 'text-red-400'}`}
                    >
                      {ev.response_rate_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-blue-300 font-mono">{ev.duration_hrs.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-orange-300 font-mono">${ev.cost_m.toFixed(1)}M</td>
                  <td className="px-4 py-2 text-center">
                    {ev.avoided_load_shedding ? (
                      <span className="text-green-400 font-bold">Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Capacity by Region Table */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">DR Capacity by Region &amp; Quarter (2024)</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Quarter</th>
                <th className="px-4 py-3 text-right">RERT (MW)</th>
                <th className="px-4 py-3 text-right">Voluntary DSP (MW)</th>
                <th className="px-4 py-3 text-right">DLC (MW)</th>
                <th className="px-4 py-3 text-right">Network Relief (MW)</th>
                <th className="px-4 py-3 text-right">Total DR (MW)</th>
                <th className="px-4 py-3 text-right">System Peak (MW)</th>
                <th className="px-4 py-3 text-right">DR as % Peak</th>
              </tr>
            </thead>
            <tbody>
              {data.capacity.map((c: DRPCapacityRecord, i: number) => (
                <tr
                  key={`${c.region}-${c.quarter}`}
                  className={`border-t border-gray-700 ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'} hover:bg-gray-750 transition-colors`}
                >
                  <td className="px-4 py-2 font-semibold text-white">{c.region}</td>
                  <td className="px-4 py-2 text-gray-400">{c.quarter}</td>
                  <td className="px-4 py-2 text-right text-purple-300 font-mono">{c.rert_contracted_mw.toFixed(0)}</td>
                  <td className="px-4 py-2 text-right text-teal-300 font-mono">{c.voluntary_dsp_mw.toFixed(0)}</td>
                  <td className="px-4 py-2 text-right text-blue-300 font-mono">{c.direct_load_control_mw.toFixed(0)}</td>
                  <td className="px-4 py-2 text-right text-orange-300 font-mono">{c.network_relief_mw.toFixed(0)}</td>
                  <td className="px-4 py-2 text-right text-emerald-400 font-mono font-bold">
                    {c.total_dr_capacity_mw.toFixed(0)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-400 font-mono">{c.system_peak_mw.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`font-mono ${c.dr_as_pct_of_peak >= 6 ? 'text-green-400' : c.dr_as_pct_of_peak >= 4 ? 'text-amber-400' : 'text-gray-400'}`}
                    >
                      {c.dr_as_pct_of_peak.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Barriers Table */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Barriers to DR Participation</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Barrier</th>
                <th className="px-4 py-3">Impact</th>
                <th className="px-4 py-3">Affected Sectors</th>
                <th className="px-4 py-3">Regulatory Fix</th>
                <th className="px-4 py-3">Timeline</th>
              </tr>
            </thead>
            <tbody>
              {data.barriers.map((b: DRPBarrierRecord, i: number) => (
                <tr
                  key={b.barrier}
                  className={`border-t border-gray-700 ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'} hover:bg-gray-750 transition-colors`}
                >
                  <td className="px-4 py-3 font-medium text-white max-w-xs">{b.barrier}</td>
                  <td className="px-4 py-3">
                    <ImpactBadge impact={b.impact} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {b.affected_sectors.join(', ')}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs max-w-sm">{b.regulatory_fix}</td>
                  <td className="px-4 py-3 text-blue-300 font-mono text-xs">{b.implementation_timeline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
