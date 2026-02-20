import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Grid, Layers, AlertTriangle, CheckCircle, DollarSign } from 'lucide-react'
import {
  getREZConnectionQueueDashboard,
  RCQDashboard,
  RCQZoneRecord,
  RCQApplicationRecord,
  RCQBottleneckRecord,
  RCQCapacityRecord,
  RCQAccessChargeRecord,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const ZONE_STATUS_COLOURS: Record<string, string> = {
  OPEN:        'bg-green-700 text-green-100',
  CONSTRAINED: 'bg-yellow-700 text-yellow-100',
  CLOSED:      'bg-red-700 text-red-100',
}

const APP_STATUS_COLOURS: Record<string, string> = {
  REGISTERED:  'bg-blue-700 text-blue-100',
  ASSESSMENT:  'bg-purple-700 text-purple-100',
  APPROVED:    'bg-green-700 text-green-100',
  WITHDRAWN:   'bg-gray-600 text-gray-200',
  LAPSED:      'bg-red-800 text-red-200',
}

const TECH_COLOURS: Record<string, string> = {
  SOLAR:  'bg-yellow-700 text-yellow-100',
  WIND:   'bg-cyan-700 text-cyan-100',
  BESS:   'bg-blue-700 text-blue-100',
  HYBRID: 'bg-purple-700 text-purple-100',
}

const ARRANGEMENT_COLOURS: Record<string, string> = {
  ORDERLY_TRANSITION:    'bg-blue-800 text-blue-200',
  FIRST_COME_FIRST_SERVED: 'bg-orange-800 text-orange-200',
  AUCTION:               'bg-teal-800 text-teal-200',
}

const CAPACITY_BAR_COLOURS: Record<string, string> = {
  committed_mw: '#60a5fa',
  queue_mw:     '#f472b6',
}

const ACCESS_CHARGE_COLOURS: Record<string, string> = {
  SHARED_NETWORK:    '#60a5fa',
  LOCAL_NETWORK:     '#4ade80',
  CONNECTION_ASSETS: '#facc15',
  AUGMENTATION:      '#f472b6',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, Icon }: {
  label: string; value: string; sub?: string; Icon: React.ElementType
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow-lg">
      <div className="p-3 bg-gray-700 rounded-lg">
        <Icon className="w-6 h-6 text-blue-400" />
      </div>
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function Badge({ label, colourMap }: { label: string; colourMap: Record<string, string> }) {
  const cls = colourMap[label] ?? 'bg-gray-700 text-gray-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ─── Headroom bar ──────────────────────────────────────────────────────────────
function HeadroomBar({ committed, queue, total }: { committed: number; queue: number; total: number }) {
  const committedPct = Math.min((committed / total) * 100, 100)
  const queuePct    = Math.min((queue / total) * 100, 100 - committedPct)
  return (
    <div className="w-full bg-gray-700 rounded h-3 overflow-hidden flex">
      <div className="bg-blue-500 h-full" style={{ width: `${committedPct}%` }} title={`Committed: ${committed.toFixed(1)} GW`} />
      <div className="bg-pink-500 h-full" style={{ width: `${queuePct}%` }} title={`Queue: ${queue.toFixed(1)} GW`} />
    </div>
  )
}

// ─── Capacity Outlook chart ────────────────────────────────────────────────────
function CapacityOutlookChart({ data, zoneId }: { data: RCQCapacityRecord[]; zoneId: string }) {
  const filtered = data.filter(d => d.zone_id === zoneId)
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={filtered} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" width={70} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
          labelStyle={{ color: '#f9fafb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        <Bar dataKey="committed_mw" name="Committed MW" fill={CAPACITY_BAR_COLOURS.committed_mw} radius={[3, 3, 0, 0]} />
        <Bar dataKey="queue_mw"     name="Queue MW"     fill={CAPACITY_BAR_COLOURS.queue_mw}     radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Access Charges chart ──────────────────────────────────────────────────────
function AccessChargesChart({ data }: { data: RCQAccessChargeRecord[] }) {
  // Aggregate total_cost_aud_m by category
  const byCategory: Record<string, number> = {}
  for (const r of data) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + r.total_cost_aud_m
  }
  const chartData = Object.entries(byCategory).map(([category, total]) => ({
    category,
    total_cost_aud_m: Math.round(total * 10) / 10,
  }))
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="category" tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" width={60} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
          labelStyle={{ color: '#f9fafb' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(v: number) => [`$${v.toFixed(1)}M`, 'Total Cost']}
        />
        <Bar dataKey="total_cost_aud_m" name="Total Cost AUD M" radius={[3, 3, 0, 0]}>
          {chartData.map((entry) => (
            <rect key={entry.category} fill={ACCESS_CHARGE_COLOURS[entry.category] ?? '#60a5fa'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Bottleneck table ──────────────────────────────────────────────────────────
function BottleneckTable({ bottlenecks }: { bottlenecks: RCQBottleneckRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-left text-gray-400">
            <th className="pb-2 pr-4">ID</th>
            <th className="pb-2 pr-4">Zone</th>
            <th className="pb-2 pr-4">Description</th>
            <th className="pb-2 pr-4 text-right">Impact MW</th>
            <th className="pb-2 pr-4 text-right">Curtailment GWh/yr</th>
            <th className="pb-2 pr-4 text-right">Resolution Cost</th>
            <th className="pb-2 pr-4 text-right">Resolution Year</th>
            <th className="pb-2 text-center">Critical</th>
          </tr>
        </thead>
        <tbody>
          {bottlenecks.map((b) => (
            <tr key={b.constraint_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
              <td className="py-2 pr-4 font-mono text-gray-300">{b.constraint_id}</td>
              <td className="py-2 pr-4 text-gray-300">{b.zone_id}</td>
              <td className="py-2 pr-4 text-gray-200">{b.description}</td>
              <td className="py-2 pr-4 text-right text-yellow-300">{b.capacity_impact_mw.toFixed(0)}</td>
              <td className="py-2 pr-4 text-right text-orange-300">{b.annual_curtailment_gwh.toFixed(0)}</td>
              <td className="py-2 pr-4 text-right text-cyan-300">${b.resolution_cost_aud_m.toFixed(0)}M</td>
              <td className="py-2 pr-4 text-right text-gray-300">{b.resolution_year ?? 'TBD'}</td>
              <td className="py-2 text-center">
                {b.critical
                  ? <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-700 text-red-100">CRITICAL</span>
                  : <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-600 text-gray-300">MINOR</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Zone overview table ───────────────────────────────────────────────────────
function ZoneTable({ zones }: { zones: RCQZoneRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-left text-gray-400">
            <th className="pb-2 pr-4">Zone</th>
            <th className="pb-2 pr-4">State</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2 pr-4">Access Arrangement</th>
            <th className="pb-2 pr-4 text-right">Total GW</th>
            <th className="pb-2 pr-4 text-right">Committed GW</th>
            <th className="pb-2 pr-4 text-right">Queue GW</th>
            <th className="pb-2 pr-4 text-right">Headroom GW</th>
            <th className="pb-2 pr-4 text-right">Charge $/MW</th>
            <th className="pb-2">Utilisation</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.zone_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
              <td className="py-2 pr-4">
                <div className="font-semibold text-white">{z.zone_id}</div>
                <div className="text-xs text-gray-400">{z.name}</div>
              </td>
              <td className="py-2 pr-4 text-gray-300">{z.state}</td>
              <td className="py-2 pr-4">
                <Badge label={z.status} colourMap={ZONE_STATUS_COLOURS} />
              </td>
              <td className="py-2 pr-4">
                <Badge label={z.access_arrangement} colourMap={ARRANGEMENT_COLOURS} />
              </td>
              <td className="py-2 pr-4 text-right text-gray-200">{z.total_capacity_gw.toFixed(1)}</td>
              <td className="py-2 pr-4 text-right text-blue-300">{z.committed_capacity_gw.toFixed(1)}</td>
              <td className="py-2 pr-4 text-right text-pink-300">{z.queue_capacity_gw.toFixed(1)}</td>
              <td className="py-2 pr-4 text-right text-green-300">{z.available_headroom_gw.toFixed(1)}</td>
              <td className="py-2 pr-4 text-right text-yellow-300">${(z.connection_charge_aud_per_mw / 1000).toFixed(0)}k</td>
              <td className="py-2 w-32">
                <HeadroomBar
                  committed={z.committed_capacity_gw}
                  queue={z.queue_capacity_gw}
                  total={z.total_capacity_gw + z.queue_capacity_gw}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Application table ────────────────────────────────────────────────────────
function ApplicationTable({ applications }: { applications: RCQApplicationRecord[] }) {
  const [page, setPage] = useState(0)
  const pageSize = 10
  const paged = applications.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(applications.length / pageSize)

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-left text-gray-400">
              <th className="pb-2 pr-4">App ID</th>
              <th className="pb-2 pr-4">Project</th>
              <th className="pb-2 pr-4">Zone</th>
              <th className="pb-2 pr-4">Technology</th>
              <th className="pb-2 pr-4 text-right">Capacity MW</th>
              <th className="pb-2 pr-4">Proponent</th>
              <th className="pb-2 pr-4">Lodged</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4 text-right">Offer MW</th>
              <th className="pb-2 text-right">Works $M</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((a) => (
              <tr key={a.app_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-4 font-mono text-gray-400 text-xs">{a.app_id}</td>
                <td className="py-2 pr-4 text-gray-200">{a.project_name}</td>
                <td className="py-2 pr-4 text-gray-300 text-xs">{a.zone_id}</td>
                <td className="py-2 pr-4">
                  <Badge label={a.technology} colourMap={TECH_COLOURS} />
                </td>
                <td className="py-2 pr-4 text-right text-white font-semibold">{a.capacity_mw.toFixed(0)}</td>
                <td className="py-2 pr-4 text-gray-300 text-xs">{a.proponent}</td>
                <td className="py-2 pr-4 text-gray-400 text-xs">{a.lodgement_date}</td>
                <td className="py-2 pr-4">
                  <Badge label={a.status} colourMap={APP_STATUS_COLOURS} />
                </td>
                <td className="py-2 pr-4 text-right text-cyan-300">
                  {a.connection_offer_mw != null ? a.connection_offer_mw.toFixed(0) : '—'}
                </td>
                <td className="py-2 text-right text-orange-300">
                  {a.works_program_aud_m != null ? `$${a.works_program_aud_m.toFixed(1)}M` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex gap-2 mt-3 justify-end">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 bg-gray-700 rounded text-sm text-gray-300 disabled:opacity-40 hover:bg-gray-600"
          >
            Prev
          </button>
          <span className="text-sm text-gray-400 self-center">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="px-3 py-1 bg-gray-700 rounded text-sm text-gray-300 disabled:opacity-40 hover:bg-gray-600"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function REZConnectionQueueAnalytics() {
  const [data, setData]     = useState<RCQDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [selectedZone, setSelectedZone] = useState('REZ-NSW1')

  useEffect(() => {
    getREZConnectionQueueDashboard()
      .then(d => {
        setData(d)
        if (d.zones.length > 0) setSelectedZone(d.zones[0].zone_id)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading REZ Connection Queue data...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>
  const topZoneIds = data.zones.slice(0, 6).map(z => z.zone_id)

  // Build access charges bar chart data: total cost by category across all zones
  const accessChartData = (() => {
    const byCat: Record<string, number> = {}
    for (const r of data.access_charges) {
      byCat[r.category] = (byCat[r.category] ?? 0) + r.total_cost_aud_m
    }
    return Object.entries(byCat).map(([category, total]) => ({
      category,
      total_cost_aud_m: Math.round(total * 10) / 10,
      fill: ACCESS_CHARGE_COLOURS[category] ?? '#60a5fa',
    }))
  })()

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-700 rounded-lg">
          <Grid className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">REZ Connection Queue Analytics</h1>
          <p className="text-sm text-gray-400">
            Renewable Energy Zone connection queues, generator access arrangements, and capacity analytics
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total REZ Zones"
          value={String(summary.total_zones)}
          sub="Across all states"
          Icon={Grid}
        />
        <KpiCard
          label="Total Queue Capacity"
          value={`${summary.total_queue_capacity_gw} GW`}
          sub="Across all zones"
          Icon={Layers}
        />
        <KpiCard
          label="Approved Applications"
          value={String(summary.approved_applications)}
          sub={`of ${summary.total_applications} total`}
          Icon={CheckCircle}
        />
        <KpiCard
          label="Critical Bottlenecks"
          value={String(summary.critical_bottlenecks)}
          sub="Requiring urgent resolution"
          Icon={AlertTriangle}
        />
      </div>

      {/* Zone Overview Table */}
      <section className="bg-gray-800 rounded-xl p-5 mb-6 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">REZ Zone Overview</h2>
        <p className="text-xs text-gray-400 mb-4">
          Capacity utilisation, headroom, and access arrangement by zone.
          <span className="ml-3">
            <span className="inline-block w-3 h-3 bg-blue-500 rounded-sm mr-1" />Committed
            <span className="inline-block w-3 h-3 bg-pink-500 rounded-sm ml-3 mr-1" />Queue
          </span>
        </p>
        <ZoneTable zones={data.zones} />
      </section>

      {/* Capacity Outlook + Access Charges Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Capacity Outlook */}
        <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Capacity Outlook</h2>
            <select
              className="bg-gray-700 text-gray-200 text-sm rounded px-2 py-1 border border-gray-600"
              value={selectedZone}
              onChange={e => setSelectedZone(e.target.value)}
            >
              {topZoneIds.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Committed vs queue MW 2025–2031 for selected zone.
          </p>
          <CapacityOutlookChart data={data.capacity_outlook} zoneId={selectedZone} />
        </section>

        {/* Access Charges by Category */}
        <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-1">Access Charges by Category</h2>
          <p className="text-xs text-gray-400 mb-3">
            Aggregated total cost (AUD M) across all zones by charge category.
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={accessChartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="category" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" width={60} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`$${v.toFixed(1)}M`, 'Total Cost']}
              />
              <Bar dataKey="total_cost_aud_m" name="Total Cost AUD M" radius={[3, 3, 0, 0]}>
                {accessChartData.map((entry, idx) => (
                  <rect key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {accessChartData.map(e => (
              <div key={e.category} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: e.fill }} />
                <span className="text-xs text-gray-400">{e.category.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Connection Queue Applications */}
      <section className="bg-gray-800 rounded-xl p-5 mb-6 shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <DollarSign className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Connection Queue Applications</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          All registered connection applications, priority rank, and offer details.
        </p>
        <ApplicationTable applications={data.applications} />
      </section>

      {/* Bottlenecks */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h2 className="text-lg font-semibold text-white">Network Bottlenecks</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Identified transmission constraints impacting REZ connection capacity.
        </p>
        <BottleneckTable bottlenecks={data.bottlenecks} />
      </section>
    </div>
  )
}
