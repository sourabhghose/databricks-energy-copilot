// Sprint 69a — Renewable Energy Zone Progress Analytics

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { MapPin } from 'lucide-react'
import {
  getRezProgressDashboard,
  RZPDashboard,
  RZPZoneRecord,
  RZPProjectRecord,
  RZPConstraintRecord,
  RZPQueueRecord,
} from '../api/client'

// ─── colour maps ──────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  OPEN:        'bg-emerald-900/60 text-emerald-300 border border-emerald-600',
  CONSTRAINED: 'bg-orange-900/60 text-orange-300 border border-orange-600',
  DEVELOPING:  'bg-blue-900/60 text-blue-300 border border-blue-600',
  CLOSED:      'bg-red-900/60 text-red-300 border border-red-600',
}

const STAGE_BADGE: Record<string, string> = {
  OPERATIONAL:        'bg-emerald-900/60 text-emerald-300 border border-emerald-600',
  UNDER_CONSTRUCTION: 'bg-amber-900/60 text-amber-300 border border-amber-600',
  APPROVED:           'bg-blue-900/60 text-blue-300 border border-blue-600',
  PROPOSED:           'bg-slate-700/60 text-slate-300 border border-slate-500',
}

const TECH_BADGE: Record<string, string> = {
  WIND:          'bg-sky-900/60 text-sky-300 border border-sky-600',
  SOLAR:         'bg-yellow-900/60 text-yellow-300 border border-yellow-600',
  PUMPED_HYDRO:  'bg-cyan-900/60 text-cyan-300 border border-cyan-600',
  OFFSHORE_WIND: 'bg-indigo-900/60 text-indigo-300 border border-indigo-600',
  BESS:          'bg-purple-900/60 text-purple-300 border border-purple-600',
}

const STATE_BADGE: Record<string, string> = {
  NSW: 'bg-blue-800/60 text-blue-200 border border-blue-600',
  VIC: 'bg-purple-800/60 text-purple-200 border border-purple-600',
  QLD: 'bg-amber-800/60 text-amber-200 border border-amber-600',
  SA:  'bg-rose-800/60 text-rose-200 border border-rose-600',
}

const CONSTRAINT_TYPE_BADGE: Record<string, string> = {
  THERMAL:       'bg-red-900/60 text-red-300 border border-red-600',
  VOLTAGE:       'bg-orange-900/60 text-orange-300 border border-orange-600',
  STABILITY:     'bg-amber-900/60 text-amber-300 border border-amber-600',
  INTERCONNECTOR:'bg-purple-900/60 text-purple-300 border border-purple-600',
}

const TECH_ICON: Record<string, string> = {
  WIND:          '💨',
  SOLAR:         '☀️',
  PUMPED_HYDRO:  '💧',
  OFFSHORE_WIND: '🌊',
  BESS:          '🔋',
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

// ─── Zone Cards ───────────────────────────────────────────────────────────────

function ZoneCard({ zone }: { zone: RZPZoneRecord }) {
  const operationalPct = zone.capacity_limit_mw > 0
    ? (zone.capacity_operational_mw / zone.capacity_limit_mw) * 100 : 0
  const committedPct = zone.capacity_limit_mw > 0
    ? (zone.capacity_committed_mw / zone.capacity_limit_mw) * 100 : 0
  const transmissionPct = zone.capacity_limit_mw > 0
    ? (zone.transmission_capacity_mw / zone.capacity_limit_mw) * 100 : 0

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm truncate">{zone.rez_name}</span>
            <Badge text={zone.state} cls={STATE_BADGE[zone.state] ?? 'bg-gray-700 text-gray-300 border border-gray-600'} />
          </div>
          <div className="text-gray-500 text-xs mt-0.5">{zone.rez_id} · {zone.region}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge text={zone.zone_status} cls={STATUS_BADGE[zone.zone_status] ?? 'bg-gray-700 text-gray-300 border border-gray-600'} />
          <span className="text-lg" title={zone.dominant_technology}>{TECH_ICON[zone.dominant_technology] ?? '⚡'}</span>
        </div>
      </div>

      {/* Capacity bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Capacity utilisation</span>
          <span>{zone.capacity_limit_mw.toLocaleString()} MW limit</span>
        </div>
        <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
          {/* committed bar (widest) */}
          <div
            className="absolute inset-y-0 left-0 bg-blue-500/50 rounded-full"
            style={{ width: `${Math.min(committedPct, 100)}%` }}
          />
          {/* operational bar (narrower) */}
          <div
            className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
            style={{ width: `${Math.min(operationalPct, 100)}%` }}
          />
          {/* transmission limit line */}
          <div
            className="absolute inset-y-0 w-0.5 bg-red-400"
            style={{ left: `${Math.min(transmissionPct, 100)}%` }}
            title={`Transmission limit: ${zone.transmission_capacity_mw} MW`}
          />
        </div>
        <div className="flex gap-3 mt-1 text-xs">
          <span className="text-emerald-400">{zone.capacity_operational_mw.toLocaleString()} MW operational</span>
          <span className="text-blue-400">{zone.capacity_committed_mw.toLocaleString()} MW committed</span>
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-700 pt-2">
        <span>LCOE: <span className="text-gray-200">{zone.lcoe_range}</span></span>
        <span>{zone.num_projects} projects</span>
      </div>
    </div>
  )
}

// ─── Capacity Chart ───────────────────────────────────────────────────────────

function CapacityChart({ zones }: { zones: RZPZoneRecord[] }) {
  const data = zones.map(z => ({
    name: z.rez_name.length > 14 ? z.rez_id : z.rez_name,
    Operational: z.capacity_operational_mw,
    Committed:   z.capacity_committed_mw - z.capacity_operational_mw,
    Queue:       z.capacity_queue_mw,
    txLimit:     z.transmission_capacity_mw,
  }))

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
      <SectionHeader title="Capacity by REZ — Operational / Committed / Queue" />
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" width={70} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="Operational" stackId="cap" fill="#10b981" name="Operational" />
          <Bar dataKey="Committed"   stackId="cap" fill="#3b82f6" name="Committed (add-on)" />
          <Bar dataKey="Queue"       stackId="cap" fill="#eab308" name="Queue" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Projects Table ───────────────────────────────────────────────────────────

function ProjectsTable({ projects }: { projects: RZPProjectRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <SectionHeader title="Developer Pipeline by Zone" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700/60">
            <tr>
              {['Project Name', 'REZ', 'Developer', 'Technology', 'Capacity (MW)', 'Stage', 'Target COD', 'LGI'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {projects.map(p => (
              <tr key={p.project_id} className="hover:bg-gray-700/30 transition-colors">
                <td className="px-3 py-2 text-gray-200 font-medium whitespace-nowrap">{p.project_name}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge text={p.rez_id} cls="bg-gray-700 text-gray-300 border border-gray-600" />
                </td>
                <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{p.developer}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge text={p.technology} cls={TECH_BADGE[p.technology] ?? 'bg-gray-700 text-gray-300 border border-gray-600'} />
                </td>
                <td className="px-3 py-2 text-gray-200 text-right tabular-nums">{p.capacity_mw.toLocaleString()}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge text={p.stage.replace('_', ' ')} cls={STAGE_BADGE[p.stage] ?? 'bg-gray-700 text-gray-300 border border-gray-600'} />
                </td>
                <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{p.target_cod}</td>
                <td className="px-3 py-2 text-center">
                  {p.lgi_agreement
                    ? <span className="text-emerald-400 font-bold">✓</span>
                    : <span className="text-red-400 font-bold">✗</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Constraints Panel ────────────────────────────────────────────────────────

function ConstraintsPanel({ constraints }: { constraints: RZPConstraintRecord[] }) {
  return (
    <div>
      <SectionHeader title="Transmission Constraints" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {constraints.map(c => (
          <div key={c.constraint_id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-white font-semibold text-sm">{c.constraint_id}</div>
                <div className="text-gray-500 text-xs mt-0.5">{c.rez_id}</div>
              </div>
              <Badge text={c.constraint_type} cls={CONSTRAINT_TYPE_BADGE[c.constraint_type] ?? 'bg-gray-700 text-gray-300 border border-gray-600'} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-900/60 rounded-lg p-2">
                <div className="text-orange-400 font-bold text-lg tabular-nums">{c.binding_frequency_pct}%</div>
                <div className="text-gray-500 text-xs">Binding freq.</div>
              </div>
              <div className="bg-gray-900/60 rounded-lg p-2">
                <div className="text-amber-400 font-bold text-lg tabular-nums">{c.avg_curtailment_pct}%</div>
                <div className="text-gray-500 text-xs">Curtailment</div>
              </div>
              <div className="bg-gray-900/60 rounded-lg p-2">
                <div className="text-red-400 font-bold text-lg tabular-nums">${c.shadow_price_per_mwh}/MWh</div>
                <div className="text-gray-500 text-xs">Shadow price</div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-2 text-xs text-gray-400">
              <div className="font-medium text-gray-300 truncate" title={c.resolution_project}>{c.resolution_project}</div>
              <div className="text-gray-500 mt-0.5">Resolution target: {c.resolution_year}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Connection Queue Table ───────────────────────────────────────────────────

function QueueTable({ queue }: { queue: RZPQueueRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <SectionHeader title="Connection Queue" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700/60">
            <tr>
              {['#', 'REZ', 'Technology', 'Capacity (MW)', 'Developer', 'Application Date', 'Exp. Year', 'Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {queue.map(q => (
              <tr key={`${q.rez_id}-${q.queue_position}`} className="hover:bg-gray-700/30 transition-colors">
                <td className="px-3 py-2 text-gray-400 font-mono text-xs tabular-nums">{q.queue_position}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge text={q.rez_id} cls="bg-gray-700 text-gray-300 border border-gray-600" />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge text={q.technology} cls={TECH_BADGE[q.technology] ?? 'bg-gray-700 text-gray-300 border border-gray-600'} />
                </td>
                <td className="px-3 py-2 text-gray-200 text-right tabular-nums">{q.capacity_mw.toLocaleString()}</td>
                <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{q.developer}</td>
                <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{q.application_date}</td>
                <td className="px-3 py-2 text-gray-200 tabular-nums">{q.expected_connection_year}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge
                    text={q.status}
                    cls={q.status === 'ACTIVE'
                      ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-600'
                      : 'bg-gray-700 text-gray-300 border border-gray-600'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RezProgressAnalytics() {
  const [data, setData] = useState<RZPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRezProgressDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-gray-400 text-sm animate-pulse">Loading REZ Progress data...</div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-red-400 text-sm">Error: {error ?? 'No data'}</div>
    </div>
  )

  const summary = data.summary as Record<string, number>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col gap-6">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-900/50 rounded-lg border border-emerald-700">
          <MapPin className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Renewable Energy Zone Progress Analytics</h1>
          <p className="text-gray-400 text-xs mt-0.5">NEM REZ development progress, connection queue, transmission constraints &amp; developer pipeline</p>
        </div>
      </div>

      {/* KPI summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total REZs"
          value={String(summary.total_zones ?? data.zones.length)}
          sub="across NEM regions"
        />
        <KpiCard
          label="Operational Capacity"
          value={`${summary.total_operational_gw ?? '—'} GW`}
          sub="generating across all REZs"
        />
        <KpiCard
          label="Committed Capacity"
          value={`${summary.total_committed_gw ?? '—'} GW`}
          sub="approved or under construction"
        />
        <KpiCard
          label="Constrained Zones"
          value={String(summary.constrained_zones ?? '—')}
          sub="transmission-limited REZs"
        />
      </div>

      {/* REZ zone cards grid */}
      <div>
        <SectionHeader title="REZ Zone Status Overview" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.zones.map(z => (
            <ZoneCard key={z.rez_id} zone={z} />
          ))}
        </div>
      </div>

      {/* Capacity chart */}
      <CapacityChart zones={data.zones} />

      {/* Projects table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <ProjectsTable projects={data.projects} />
      </div>

      {/* Constraints */}
      <ConstraintsPanel constraints={data.constraints} />

      {/* Queue table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <QueueTable queue={data.queue} />
      </div>

    </div>
  )
}
