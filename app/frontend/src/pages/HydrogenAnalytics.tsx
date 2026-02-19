import { useState, useEffect } from 'react'
import { Zap, TrendingDown, Activity, Target } from 'lucide-react'
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
import { api } from '../api/client'
import type {
  HydrogenDashboard,
  ElectrolysisProject,
  HydrogenPriceBenchmark,
  HydrogenCapacityRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function fmtMw(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)} GW`
  return `${v.toFixed(1)} MW`
}

function fmtAud(v: number, decimals = 2) {
  return `$${v.toFixed(decimals)}`
}

// ---------------------------------------------------------------------------
// Badge components
// ---------------------------------------------------------------------------

function TechBadge({ tech }: { tech: string }) {
  const colours: Record<string, string> = {
    PEM: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    ALKALINE: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    SOEC: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colours[tech] ?? 'bg-gray-100 text-gray-700'}`}>
      {tech}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    OPERATING: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    CONSTRUCTION: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    APPROVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    PROPOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colours[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
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
  icon: Icon,
  colour,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  colour: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${colour}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LCOH Comparison Chart
// ---------------------------------------------------------------------------

function LcohComparisonChart({ benchmarks }: { benchmarks: HydrogenPriceBenchmark[] }) {
  if (!benchmarks.length) return null

  const avgJapanTarget =
    benchmarks.reduce((s, b) => s + b.japan_target_price_aud_kg, 0) / benchmarks.length

  const data = benchmarks.map((b) => ({
    region: b.region,
    Grey: b.grey_h2_price_aud_kg,
    Blue: b.blue_h2_price_aud_kg,
    Green: b.spot_h2_price_aud_kg,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
        H&#x2082; Price Benchmarks by City (AUD/kg)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="region" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            formatter={(value: number, name: string) => [`$${value.toFixed(2)}/kg`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Grey" fill="#9ca3af" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Blue" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Green" fill="#22c55e" radius={[3, 3, 0, 0]} />
          <ReferenceLine
            y={avgJapanTarget}
            stroke="#ef4444"
            strokeDasharray="6 3"
            label={{ value: `Japan target $${avgJapanTarget.toFixed(2)}`, fill: '#ef4444', fontSize: 11 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Capacity Pipeline Chart
// ---------------------------------------------------------------------------

function CapacityPipelineChart({ records }: { records: HydrogenCapacityRecord[] }) {
  if (!records.length) return null

  const data = records.map((r) => ({
    state: r.state,
    Operating: r.operating_mw,
    'Under Construction': r.under_construction_mw,
    Approved: r.approved_mw,
    Proposed: r.proposed_mw,
    Target: r.government_target_mw,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
        Electrolyser Capacity Pipeline by State (MW)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="state" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
          <Tooltip
            formatter={(value: number, name: string) => [fmtMw(value), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Operating" stackId="a" fill="#22c55e" />
          <Bar dataKey="Under Construction" stackId="a" fill="#f59e0b" />
          <Bar dataKey="Approved" stackId="a" fill="#3b82f6" />
          <Bar dataKey="Proposed" stackId="a" fill="#d1d5db" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Projects Table
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ['ALL', 'OPERATING', 'CONSTRUCTION', 'APPROVED', 'PROPOSED']
const STATE_OPTIONS = ['ALL', 'WA', 'NSW', 'QLD', 'SA', 'VIC', 'TAS', 'NT', 'ACT']

function ProjectsTable({ projects }: { projects: ElectrolysisProject[] }) {
  const [stateFilter, setStateFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const filtered = projects.filter((p) => {
    const matchState = stateFilter === 'ALL' || p.state === stateFilter
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter
    return matchState && matchStatus
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Electrolysis Projects ({filtered.length})
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            {STATE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All States' : s}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {[
                'Project Name', 'Developer', 'State', 'Technology',
                'Capacity', 'H\u2082 Output', 'LCOH $/kg', 'Efficiency',
                'Status', 'Offtake', 'Export',
              ].map((h) => (
                <th
                  key={h}
                  className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-6 text-center text-gray-400 dark:text-gray-500">
                  No projects match the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const lcohOverTarget = p.lcoh_aud_kg > p.target_cost_kg_aud
                return (
                  <tr
                    key={p.project_id}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      {p.project_name}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.developer}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{p.state}</td>
                    <td className="py-2 px-3">
                      <TechBadge tech={p.technology} />
                    </td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-right">
                      {fmtMw(p.capacity_mw)}
                    </td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-right">
                      {p.hydrogen_output_tpd.toFixed(1)} t/d
                    </td>
                    <td
                      className={`py-2 px-3 font-semibold text-right whitespace-nowrap ${
                        lcohOverTarget
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {fmtAud(p.lcoh_aud_kg)}
                    </td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">
                      {p.electrolyser_efficiency_pct.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-2 px-3 text-center">
                      {p.offtake_secured ? (
                        <span className="text-green-600 dark:text-green-400 font-bold">&#10003;</span>
                      ) : (
                        <span className="text-red-400">&#10007;</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {p.export_ready ? (
                        <span className="text-green-600 dark:text-green-400 font-bold">&#10003;</span>
                      ) : (
                        <span className="text-red-400">&#10007;</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function HydrogenAnalytics() {
  const [dashboard, setDashboard] = useState<HydrogenDashboard | null>(null)
  const [projects, setProjects] = useState<ElectrolysisProject[]>([])
  const [benchmarks, setBenchmarks] = useState<HydrogenPriceBenchmark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [dash, proj, bench] = await Promise.all([
          api.getHydrogenDashboard(),
          api.getHydrogenProjects(),
          api.getHydrogenBenchmarks(),
        ])
        setDashboard(dash)
        setProjects(proj)
        setBenchmarks(bench)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load hydrogen data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        <Activity size={24} className="animate-pulse mr-2" />
        Loading hydrogen analytics...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-500 dark:text-red-400">
        Error: {error}
      </div>
    )
  }

  const capacityRecords: HydrogenCapacityRecord[] = dashboard?.capacity_records ?? []

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-600 rounded-lg">
          <Zap size={22} className="text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Green Hydrogen &amp; Electrolysis Economics
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-300 dark:border-green-700">
              H&#x2082; Green
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            LCOH benchmarks, project pipeline, and electrolysis capacity across Australia
          </p>
        </div>
      </div>

      {/* KPI cards */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Operating Capacity"
            value={fmtMw(dashboard.total_operating_capacity_mw)}
            sub="Electrolyser MW operating"
            icon={Zap}
            colour="bg-green-500"
          />
          <KpiCard
            label="Total Pipeline Capacity"
            value={fmtMw(dashboard.total_pipeline_capacity_mw)}
            sub="Operating + construction + approved + proposed"
            icon={Activity}
            colour="bg-blue-500"
          />
          <KpiCard
            label="National Avg LCOH"
            value={`$${dashboard.national_avg_lcoh_aud_kg.toFixed(2)}/kg`}
            sub="Levelised cost of green hydrogen"
            icon={TrendingDown}
            colour="bg-purple-500"
          />
          <KpiCard
            label="Projects At Target Cost"
            value={String(dashboard.projects_at_target_cost)}
            sub="Projects at or below target LCOH"
            icon={Target}
            colour="bg-amber-500"
          />
        </div>
      )}

      {/* LCOH Comparison Chart */}
      <LcohComparisonChart benchmarks={benchmarks} />

      {/* Projects Table */}
      <ProjectsTable projects={projects} />

      {/* Capacity Pipeline Chart */}
      <CapacityPipelineChart records={capacityRecords} />
    </div>
  )
}
