import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getRezTransmissionDashboard,
  RZTDashboard,
  RZTREZRecord,
  RZTConnectionQueueRecord,
  RZTTransmissionProjectRecord,
  RZTUtilisationRecord,
  RZTCostAllocationRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------
const CARD_BG = 'bg-gray-800 border border-gray-700 rounded-lg p-4'
const TABLE_TH = 'px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide'
const TABLE_TD = 'px-3 py-2 text-sm text-gray-200 whitespace-nowrap'
const TABLE_TD_MONO = 'px-3 py-2 text-sm font-mono text-gray-200 whitespace-nowrap'

const LINE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#06B6D4', '#F97316', '#EC4899',
  '#84CC16', '#A78BFA', '#FCD34D', '#34D399',
]

const RESOURCE_COLORS: Record<string, string> = {
  WIND:   'text-blue-400',
  SOLAR:  'text-amber-400',
  HYBRID: 'text-green-400',
}

const STATUS_COLORS: Record<string, string> = {
  OPERATING:    'bg-green-900 text-green-300',
  CONSTRUCTION: 'bg-blue-900 text-blue-300',
  APPROVED:     'bg-amber-900 text-amber-300',
  IDENTIFIED:   'bg-gray-700 text-gray-300',
}

const ALLOC_COLORS: Record<string, string> = {
  SOCIALISED:  'bg-purple-900 text-purple-300',
  USER_PAYS:   'bg-blue-900 text-blue-300',
  HYBRID:      'bg-teal-900 text-teal-300',
  '50_50_SPLIT': 'bg-amber-900 text-amber-300',
}

function fmt(n: number, dp = 1): string {
  return n.toFixed(dp)
}

function utilColour(pct: number): string {
  if (pct >= 85) return 'text-red-400 font-semibold'
  if (pct >= 70) return 'text-amber-400'
  if (pct >= 50) return 'text-green-400'
  return 'text-gray-400'
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className={CARD_BG}>
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 border-b border-gray-700 pb-2">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 1 — KPI Cards
// ---------------------------------------------------------------------------
function KpiSection({ summary }: { summary: Record<string, unknown> }) {
  const totalRezs        = summary['total_rezs'] as number
  const totalPotentialGw = summary['total_potential_gw'] as number
  const totalConnectedMw = summary['total_connected_mw'] as number
  const totalQueueMw     = summary['total_queue_mw'] as number
  const avgWait          = summary['avg_wait_time_months'] as number
  const augCost          = summary['total_augmentation_cost_m'] as number
  const avgUtil          = summary['avg_utilisation_pct'] as number

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
      <KpiCard
        label="REZs Tracked"
        value={String(totalRezs)}
        sub="Major Australian REZs"
        accent="text-blue-400"
      />
      <KpiCard
        label="Total Potential Capacity"
        value={`${fmt(totalPotentialGw)} GW`}
        sub="Across all REZ regions"
        accent="text-green-400"
      />
      <KpiCard
        label="Connected Capacity"
        value={`${(totalConnectedMw / 1000).toFixed(1)} GW`}
        sub="Currently operational"
        accent="text-teal-400"
      />
      <KpiCard
        label="Total Queue Capacity"
        value={`${(totalQueueMw / 1000).toFixed(1)} GW`}
        sub="Projects in connection queue"
        accent="text-amber-400"
      />
      <KpiCard
        label="Avg Queue Wait Time"
        value={`${fmt(avgWait)} mo`}
        sub="From application to approval"
        accent="text-orange-400"
      />
      <KpiCard
        label="Total Augmentation Cost"
        value={`$${(augCost / 1000).toFixed(1)}B`}
        sub="Identified transmission needs"
        accent="text-red-400"
      />
      <KpiCard
        label="Avg Utilisation"
        value={`${fmt(avgUtil)}%`}
        sub="Connected / connection limit"
        accent="text-purple-400"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 2 — REZ Overview Table
// ---------------------------------------------------------------------------
function REZOverviewSection({ rezs }: { rezs: RZTREZRecord[] }) {
  return (
    <div className={`${CARD_BG} mb-8`}>
      <SectionHeader
        title="REZ Overview — Transmission Utilisation"
        subtitle="Connection limits, capacity pipeline and current utilisation per Renewable Energy Zone"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>REZ</th>
              <th className={TABLE_TH}>State</th>
              <th className={TABLE_TH}>Type</th>
              <th className={TABLE_TH}>Potential (GW)</th>
              <th className={TABLE_TH}>Conn. Limit (MW)</th>
              <th className={TABLE_TH}>Connected (MW)</th>
              <th className={TABLE_TH}>Committed (MW)</th>
              <th className={TABLE_TH}>Approved (MW)</th>
              <th className={TABLE_TH}>Utilisation</th>
              <th className={TABLE_TH}>Aug. Needed (MW)</th>
              <th className={TABLE_TH}>Aug. Cost ($M)</th>
            </tr>
          </thead>
          <tbody>
            {rezs.map((r) => (
              <tr key={r.rez_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className={TABLE_TD}>
                  <span className="font-semibold text-white">{r.name}</span>
                  <span className="block text-gray-500 text-xs">{r.rez_id}</span>
                </td>
                <td className={TABLE_TD}>{r.state}</td>
                <td className={TABLE_TD}>
                  <span className={`text-xs font-semibold ${RESOURCE_COLORS[r.resource_type] ?? 'text-gray-400'}`}>
                    {r.resource_type}
                  </span>
                </td>
                <td className={TABLE_TD_MONO}>{fmt(r.potential_capacity_gw)}</td>
                <td className={TABLE_TD_MONO}>{r.connection_limit_mw.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>{r.connected_capacity_mw.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>{r.committed_capacity_mw.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>{r.approved_capacity_mw.toLocaleString()}</td>
                <td className={TABLE_TD}>
                  <span className={utilColour(r.utilisation_pct)}>
                    {fmt(r.utilisation_pct)}%
                  </span>
                  <div className="w-24 h-1.5 bg-gray-700 rounded-full mt-1">
                    <div
                      className={`h-1.5 rounded-full ${r.utilisation_pct >= 85 ? 'bg-red-500' : r.utilisation_pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(r.utilisation_pct, 100)}%` }}
                    />
                  </div>
                </td>
                <td className={TABLE_TD_MONO}>{r.transmission_augmentation_needed_mw.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>${r.augmentation_cost_m.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 3 — Connection Queue
// ---------------------------------------------------------------------------
function ConnectionQueueSection({ queue }: { queue: RZTConnectionQueueRecord[] }) {
  return (
    <div className={`${CARD_BG} mb-8`}>
      <SectionHeader
        title="Connection Queue Management"
        subtitle="Project backlog, wait times, approval rates and technical study delays per REZ"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>REZ</th>
              <th className={TABLE_TH}>Projects in Queue</th>
              <th className={TABLE_TH}>Total Queue (MW)</th>
              <th className={TABLE_TH}>Avg Wait (mo)</th>
              <th className={TABLE_TH}>Approved %</th>
              <th className={TABLE_TH}>Withdrawn %</th>
              <th className={TABLE_TH}>New Apps / yr</th>
              <th className={TABLE_TH}>Fee / MW ($)</th>
              <th className={TABLE_TH}>Studies Backlog (mo)</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((q) => (
              <tr key={q.rez_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className={TABLE_TD}>
                  <span className="font-semibold text-white">{q.rez_id}</span>
                </td>
                <td className={TABLE_TD_MONO}>{q.project_count_in_queue}</td>
                <td className={TABLE_TD_MONO}>{q.total_queue_mw.toLocaleString()}</td>
                <td className={`${TABLE_TD_MONO} ${q.avg_wait_time_months > 30 ? 'text-red-400' : q.avg_wait_time_months > 22 ? 'text-amber-400' : 'text-green-400'}`}>
                  {fmt(q.avg_wait_time_months)}
                </td>
                <td className={TABLE_TD_MONO}>{fmt(q.approved_pct)}%</td>
                <td className={TABLE_TD_MONO}>{fmt(q.withdrawn_pct)}%</td>
                <td className={TABLE_TD_MONO}>{q.annual_new_applications}</td>
                <td className={TABLE_TD_MONO}>${q.connection_fee_per_mw.toLocaleString()}</td>
                <td className={`${TABLE_TD_MONO} ${q.technical_studies_backlog_months > 4 ? 'text-amber-400' : 'text-green-400'}`}>
                  {fmt(q.technical_studies_backlog_months)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 4 — Transmission Projects
// ---------------------------------------------------------------------------
function TransmissionProjectsSection({ projects }: { projects: RZTTransmissionProjectRecord[] }) {
  return (
    <div className={`${CARD_BG} mb-8`}>
      <SectionHeader
        title="Transmission Projects Pipeline"
        subtitle="REZ-linked augmentation projects — technology, BCR, capex and status"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>ID</th>
              <th className={TABLE_TH}>Project Name</th>
              <th className={TABLE_TH}>REZ</th>
              <th className={TABLE_TH}>State</th>
              <th className={TABLE_TH}>Capacity Increase (MW)</th>
              <th className={TABLE_TH}>Technology</th>
              <th className={TABLE_TH}>Capex ($M)</th>
              <th className={TABLE_TH}>BCR</th>
              <th className={TABLE_TH}>Status</th>
              <th className={TABLE_TH}>Commission Year</th>
              <th className={TABLE_TH}>Primary Benefit</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className={`${TABLE_TD} text-gray-500`}>{p.project_id}</td>
                <td className={TABLE_TD}>
                  <span className="text-white font-medium">{p.name}</span>
                </td>
                <td className={TABLE_TD_MONO}>{p.rez_id}</td>
                <td className={TABLE_TD}>{p.state}</td>
                <td className={TABLE_TD_MONO}>{p.capacity_increase_mw.toLocaleString()}</td>
                <td className={TABLE_TD}>
                  <span className="text-xs bg-gray-700 text-gray-300 rounded px-1.5 py-0.5">
                    {p.technology.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className={TABLE_TD_MONO}>${p.capex_m.toLocaleString()}</td>
                <td className={`${TABLE_TD_MONO} ${p.benefit_cost_ratio >= 3 ? 'text-green-400' : p.benefit_cost_ratio >= 2 ? 'text-teal-400' : p.benefit_cost_ratio >= 1.5 ? 'text-amber-400' : 'text-red-400'}`}>
                  {fmt(p.benefit_cost_ratio, 2)}
                </td>
                <td className={TABLE_TD}>
                  <span className={`text-xs rounded px-1.5 py-0.5 font-semibold ${STATUS_COLORS[p.status] ?? 'bg-gray-700 text-gray-300'}`}>
                    {p.status}
                  </span>
                </td>
                <td className={TABLE_TD_MONO}>{p.commissioning_year}</td>
                <td className={TABLE_TD}>
                  <span className="text-xs text-gray-400">{p.primary_benefit.replace(/_/g, ' ')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 5 — Utilisation Trends (LineChart)
// ---------------------------------------------------------------------------
function buildUtilChartData(utilisation: RZTUtilisationRecord[]): { quarter: string; [rezId: string]: number | string }[] {
  const quarters = Array.from(new Set(utilisation.map((u) => u.quarter))).sort()
  return quarters.map((q) => {
    const row: { quarter: string; [key: string]: number | string } = { quarter: q }
    utilisation
      .filter((u) => u.quarter === q)
      .forEach((u) => {
        row[u.rez_id] = u.avg_utilisation_pct
      })
    return row
  })
}

function UtilisationTrendsSection({ utilisation, rezIds }: { utilisation: RZTUtilisationRecord[]; rezIds: string[] }) {
  const chartData = buildUtilChartData(utilisation)

  return (
    <div className={`${CARD_BG} mb-8`}>
      <SectionHeader
        title="Utilisation Trends by REZ — Quarterly"
        subtitle="Average utilisation percentage (connected capacity / connection limit) per quarter across all REZs"
      />
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#F9FAFB', fontWeight: 600 }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number) => [`${fmt(v)}%`, '']}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 11 }} />
          {rezIds.map((rezId, idx) => (
            <Line
              key={rezId}
              type="monotone"
              dataKey={rezId}
              stroke={LINE_COLORS[idx % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Utilisation detail table (latest quarter) */}
      <div className="mt-6 overflow-x-auto">
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Latest Quarter Detail (2024-Q4)</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>REZ</th>
              <th className={TABLE_TH}>Avg Util %</th>
              <th className={TABLE_TH}>Peak Util %</th>
              <th className={TABLE_TH}>Constrained Hours %</th>
              <th className={TABLE_TH}>Curtailment (Cong.) %</th>
              <th className={TABLE_TH}>Congestion Cost ($M)</th>
              <th className={TABLE_TH}>Revenue Foregone ($M)</th>
            </tr>
          </thead>
          <tbody>
            {utilisation
              .filter((u) => u.quarter === '2024-Q4')
              .map((u) => (
                <tr key={u.rez_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className={TABLE_TD_MONO}>{u.rez_id}</td>
                  <td className={`${TABLE_TD_MONO} ${utilColour(u.avg_utilisation_pct)}`}>{fmt(u.avg_utilisation_pct)}%</td>
                  <td className={TABLE_TD_MONO}>{fmt(u.peak_utilisation_pct)}%</td>
                  <td className={TABLE_TD_MONO}>{fmt(u.constrained_hours_pct)}%</td>
                  <td className={TABLE_TD_MONO}>{fmt(u.curtailment_from_congestion_pct)}%</td>
                  <td className={TABLE_TD_MONO}>${fmt(u.congestion_cost_m)}</td>
                  <td className={TABLE_TD_MONO}>${fmt(u.revenue_foregone_m)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 6 — Cost Allocation
// ---------------------------------------------------------------------------
function CostAllocationSection({ costAlloc }: { costAlloc: RZTCostAllocationRecord[] }) {
  return (
    <div className={`${CARD_BG} mb-8`}>
      <SectionHeader
        title="Transmission Cost Allocation"
        subtitle="Method, cost burden distribution across generators, consumers and government; AER approval status"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>REZ</th>
              <th className={TABLE_TH}>Cost Method</th>
              <th className={TABLE_TH}>Tx Cost ($M)</th>
              <th className={TABLE_TH}>Generators %</th>
              <th className={TABLE_TH}>Consumers %</th>
              <th className={TABLE_TH}>Government %</th>
              <th className={TABLE_TH}>$/MW Connected</th>
              <th className={TABLE_TH}>AER Approved</th>
            </tr>
          </thead>
          <tbody>
            {costAlloc.map((c) => (
              <tr key={c.rez_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className={TABLE_TD_MONO}>{c.rez_id}</td>
                <td className={TABLE_TD}>
                  <span className={`text-xs rounded px-1.5 py-0.5 font-semibold ${ALLOC_COLORS[c.cost_allocation_method] ?? 'bg-gray-700 text-gray-300'}`}>
                    {c.cost_allocation_method.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className={TABLE_TD_MONO}>${c.transmission_cost_m.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>{fmt(c.borne_by_generators_pct)}%</td>
                <td className={TABLE_TD_MONO}>{fmt(c.borne_by_consumers_pct)}%</td>
                <td className={TABLE_TD_MONO}>{fmt(c.borne_by_government_pct)}%</td>
                <td className={TABLE_TD_MONO}>${c.cost_per_mw_connected.toLocaleString()}</td>
                <td className={TABLE_TD}>
                  {c.aer_approved ? (
                    <span className="text-xs bg-green-900 text-green-300 rounded px-1.5 py-0.5 font-semibold">YES</span>
                  ) : (
                    <span className="text-xs bg-red-900 text-red-300 rounded px-1.5 py-0.5 font-semibold">NO</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------
export default function REZTransmissionAnalytics() {
  const [data, setData] = useState<RZTDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRezTransmissionDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load REZ Transmission data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-lg animate-pulse">Loading REZ Transmission Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-lg">Error: {error ?? 'No data returned'}</p>
      </div>
    )
  }

  const rezIds = data.rezs.map((r) => r.rez_id)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          REZ Transmission Infrastructure Analytics
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Renewable Energy Zone transmission investment, connection queue management and infrastructure utilisation — Sprint 82b
        </p>
      </div>

      {/* KPI Cards */}
      <KpiSection summary={data.summary} />

      {/* REZ Overview */}
      <REZOverviewSection rezs={data.rezs} />

      {/* Connection Queue */}
      <ConnectionQueueSection queue={data.connection_queue} />

      {/* Transmission Projects */}
      <TransmissionProjectsSection projects={data.transmission_projects} />

      {/* Utilisation Trends */}
      <UtilisationTrendsSection utilisation={data.utilisation} rezIds={rezIds} />

      {/* Cost Allocation */}
      <CostAllocationSection costAlloc={data.cost_allocation} />
    </div>
  )
}
