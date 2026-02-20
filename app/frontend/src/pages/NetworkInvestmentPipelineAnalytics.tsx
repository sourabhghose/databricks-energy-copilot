import { useEffect, useState } from 'react'
import { GitBranch } from 'lucide-react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getNetworkInvestmentPipelineDashboard,
  NIPDashboard,
  NIPProjectRecord,
  NIPConstraintRecord,
  NIPBenefitRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const KPI_CARD_BG = 'bg-gray-800 border border-gray-700 rounded-lg p-4'

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={KPI_CARD_BG}>
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">
      {title}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const COLOR_MAP: Record<string, string> = {
    COMMITTED:          'bg-green-900 text-green-300 border border-green-700',
    UNDER_CONSTRUCTION: 'bg-blue-900 text-blue-300 border border-blue-700',
    APPROVED:           'bg-teal-900 text-teal-300 border border-teal-700',
    ASSESSMENT:         'bg-yellow-900 text-yellow-300 border border-yellow-700',
    PROPOSED:           'bg-gray-700 text-gray-300 border border-gray-600',
  }
  const cls = COLOR_MAP[status] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${cls}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Network type badge
// ---------------------------------------------------------------------------
function NetworkTypeBadge({ type }: { type: string }) {
  const COLOR_MAP: Record<string, string> = {
    TRANSMISSION:   'bg-purple-900 text-purple-300 border border-purple-700',
    DISTRIBUTION:   'bg-indigo-900 text-indigo-300 border border-indigo-700',
    SUBSTATION:     'bg-cyan-900 text-cyan-300 border border-cyan-700',
    INTERCONNECTOR: 'bg-orange-900 text-orange-300 border border-orange-700',
  }
  const cls = COLOR_MAP[type] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${cls}`}>
      {type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Severity badge for constraints
// ---------------------------------------------------------------------------
function SeverityBadge({ severity }: { severity: string }) {
  const COLOR_MAP: Record<string, string> = {
    CRITICAL: 'bg-red-900 text-red-300 border border-red-700',
    HIGH:     'bg-orange-900 text-orange-300 border border-orange-700',
    MEDIUM:   'bg-yellow-900 text-yellow-300 border border-yellow-700',
    LOW:      'bg-gray-700 text-gray-300 border border-gray-600',
  }
  const cls = COLOR_MAP[severity] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${cls}`}>
      {severity}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Category color map for drivers chart
// ---------------------------------------------------------------------------
const CATEGORY_COLORS: Record<string, string> = {
  RENEWABLE_CONNECTION: '#10b981',
  REPLACEMENT:          '#f59e0b',
  LOAD_GROWTH:          '#3b82f6',
  RELIABILITY:          '#8b5cf6',
  RESILIENCE:           '#ef4444',
  CAPACITY:             '#06b6d4',
  REGULATORY:           '#6b7280',
}

const PROPONENT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

// ---------------------------------------------------------------------------
// Project table
// ---------------------------------------------------------------------------
function ProjectTable({ projects }: { projects: NIPProjectRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="pb-2 pr-4 font-medium">Project</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium">Proponent</th>
            <th className="pb-2 pr-4 font-medium">Region</th>
            <th className="pb-2 pr-4 font-medium text-right">Capex (AUD M)</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium">Purpose</th>
            <th className="pb-2 pr-4 font-medium">Timeline</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.project_id} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="py-2 pr-4 text-white font-medium max-w-xs">
                <div className="truncate" title={p.name}>{p.name}</div>
                <div className="text-gray-500 text-xs">{p.project_id}</div>
              </td>
              <td className="py-2 pr-4">
                <NetworkTypeBadge type={p.network_type} />
              </td>
              <td className="py-2 pr-4 text-gray-300">{p.proponent}</td>
              <td className="py-2 pr-4 text-gray-300">{p.region}</td>
              <td className="py-2 pr-4 text-right text-amber-400 font-mono font-semibold">
                {p.capex_aud_m.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </td>
              <td className="py-2 pr-4">
                <StatusBadge status={p.status} />
              </td>
              <td className="py-2 pr-4 text-gray-400 text-xs">{p.purpose}</td>
              <td className="py-2 pr-4 text-gray-400 text-xs whitespace-nowrap">
                {p.start_year} – {p.completion_year}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Constraints table
// ---------------------------------------------------------------------------
function ConstraintTable({ constraints }: { constraints: NIPConstraintRecord[] }) {
  const sorted = [...constraints].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    return (order[a.severity as keyof typeof order] ?? 4) - (order[b.severity as keyof typeof order] ?? 4)
  })
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="pb-2 pr-4 font-medium">ID</th>
            <th className="pb-2 pr-4 font-medium">Description</th>
            <th className="pb-2 pr-4 font-medium">Region</th>
            <th className="pb-2 pr-4 font-medium text-right">Annual Congestion Cost (AUD M)</th>
            <th className="pb-2 pr-4 font-medium">Severity</th>
            <th className="pb-2 pr-4 font-medium">Addressing Project</th>
            <th className="pb-2 pr-4 font-medium">Resolution Year</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.constraint_id} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="py-2 pr-4 text-gray-400 font-mono text-xs">{c.constraint_id}</td>
              <td className="py-2 pr-4 text-white">{c.description}</td>
              <td className="py-2 pr-4 text-gray-300">{c.region}</td>
              <td className="py-2 pr-4 text-right text-red-400 font-mono font-semibold">
                {c.annual_congestion_cost_aud_m.toFixed(1)}
              </td>
              <td className="py-2 pr-4">
                <SeverityBadge severity={c.severity} />
              </td>
              <td className="py-2 pr-4 text-gray-300 text-xs">{c.address_project ?? '—'}</td>
              <td className="py-2 pr-4 text-gray-400 text-xs">{c.resolution_year ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BCR table for benefits
// ---------------------------------------------------------------------------
function BenefitBcrChart({ benefits }: { benefits: NIPBenefitRecord[] }) {
  const data = [...benefits]
    .sort((a, b) => b.bcr - a.bcr)
    .map((b) => ({
      project: b.project_id,
      bcr: b.bcr,
      benefit: b.benefit_aud_m_npv,
      cost: b.cost_aud_m,
      type: b.benefit_type,
    }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="project" stroke="#9ca3af" tick={{ fontSize: 11 }} />
        <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} label={{ value: 'BCR', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#f3f4f6' }}
          itemStyle={{ color: '#10b981' }}
          formatter={(v: number) => v.toFixed(3)}
        />
        <Bar dataKey="bcr" fill="#10b981" radius={[3, 3, 0, 0]} name="Benefit-Cost Ratio" />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function NetworkInvestmentPipelineAnalytics() {
  const [data, setData] = useState<NIPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNetworkInvestmentPipelineDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading Network Investment Pipeline...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const { projects, spend_profiles, drivers, constraints, benefits, summary } = data

  // Build spend profile chart data: capex per year for top 3 proponents
  const TOP_PROPONENTS = ['TransGrid', 'Ausgrid', 'Powerlink']
  const spendByYear: Record<number, Record<string, number>> = {}
  for (const sp of spend_profiles) {
    if (!TOP_PROPONENTS.includes(sp.proponent)) continue
    if (!spendByYear[sp.year]) spendByYear[sp.year] = {}
    spendByYear[sp.year][sp.proponent] = sp.capex_aud_m
  }
  const spendChartData = Object.entries(spendByYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, vals]) => ({ year, ...vals }))

  // Driver bar chart data
  const driverChartData = [...drivers]
    .sort((a, b) => b.total_capex_aud_m - a.total_capex_aud_m)
    .map((d) => ({
      driver: d.driver.length > 22 ? d.driver.slice(0, 22) + '…' : d.driver,
      capex: d.total_capex_aud_m,
      category: d.category,
      fill: CATEGORY_COLORS[d.category] ?? '#6b7280',
    }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GitBranch className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Network Investment Pipeline Analytics</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Australian NEM — Transmission &amp; Distribution Capex Programs
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Projects"
          value={String(summary['total_projects'] as number)}
          sub="In pipeline"
        />
        <KpiCard
          label="Total Pipeline Capex"
          value={`AUD ${((summary['total_pipeline_capex_aud_m'] as number) / 1000).toFixed(1)} B`}
          sub="Across all projects"
        />
        <KpiCard
          label="Committed Projects"
          value={String(summary['committed_projects'] as number)}
          sub="Committed or under construction"
        />
        <KpiCard
          label="Critical Constraints"
          value={String(summary['critical_constraints'] as number)}
          sub="Requiring urgent resolution"
        />
      </div>

      {/* Summary strip */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-400">Largest Project: </span>
          <span className="text-white font-medium">{summary['largest_project'] as string}</span>
        </div>
        <div>
          <span className="text-gray-400">Avg Benefit-Cost Ratio: </span>
          <span className="text-green-400 font-mono font-semibold">{(summary['avg_bcr'] as number).toFixed(3)}</span>
        </div>
        <div>
          <span className="text-gray-400">Network Proponents Tracked: </span>
          <span className="text-white font-medium">{summary['proponents'] as number}</span>
        </div>
      </div>

      {/* Project Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <SectionHeader title="Investment Project Register" />
        <ProjectTable projects={projects} />
      </div>

      {/* Spend Profile Chart */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <SectionHeader title="Regulatory Capex Spend Profile (Top 3 TNSPs)" />
        <p className="text-gray-400 text-xs mb-4">Annual capex (AUD M) by proponent — 2023 to 2030</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={spendChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number, name: string) => [`AUD ${v.toFixed(1)} M`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {TOP_PROPONENTS.map((prop, i) => (
              <Line
                key={prop}
                type="monotone"
                dataKey={prop}
                stroke={PROPONENT_COLORS[i]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Investment Drivers Chart */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <SectionHeader title="Investment Drivers by Total Capex" />
        <p className="text-gray-400 text-xs mb-4">Total capex driven by each investment rationale (AUD M)</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={driverChartData} layout="vertical" margin={{ top: 5, right: 30, left: 160, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" M" />
            <YAxis type="category" dataKey="driver" stroke="#9ca3af" tick={{ fontSize: 11 }} width={155} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number, _name: string, props: { payload?: { category?: string } }) => [
                `AUD ${v.toLocaleString()} M`,
                props.payload?.category ?? 'Capex',
              ]}
            />
            <Bar dataKey="capex" radius={[0, 3, 3, 0]} name="Total Capex">
              {driverChartData.map((entry, index) => (
                <rect key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Category legend */}
        <div className="flex flex-wrap gap-3 mt-4">
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-gray-400 text-xs">{cat.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Constraints Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <SectionHeader title="Network Constraints &amp; Congestion Register" />
        <ConstraintTable constraints={constraints} />
      </div>

      {/* Benefit-Cost Ratio Chart */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <SectionHeader title="Benefit-Cost Ratios by Project" />
        <p className="text-gray-400 text-xs mb-4">NPV benefit vs regulatory cost — top 12 projects ranked by BCR</p>
        <BenefitBcrChart benefits={benefits} />
        {/* Benefits detail table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4 font-medium">Project ID</th>
                <th className="pb-2 pr-4 font-medium">Benefit Type</th>
                <th className="pb-2 pr-4 font-medium text-right">NPV Benefit (AUD M)</th>
                <th className="pb-2 pr-4 font-medium text-right">Cost (AUD M)</th>
                <th className="pb-2 pr-4 font-medium text-right">BCR</th>
                <th className="pb-2 pr-4 font-medium">Beneficiaries</th>
              </tr>
            </thead>
            <tbody>
              {[...benefits].sort((a, b) => b.bcr - a.bcr).map((b) => (
                <tr key={b.project_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-2 pr-4 text-gray-400 font-mono text-xs">{b.project_id}</td>
                  <td className="py-2 pr-4 text-gray-300 text-xs">{b.benefit_type.replace(/_/g, ' ')}</td>
                  <td className="py-2 pr-4 text-right text-green-400 font-mono">{b.benefit_aud_m_npv.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right text-amber-400 font-mono">{b.cost_aud_m.toFixed(1)}</td>
                  <td className={`py-2 pr-4 text-right font-mono font-semibold ${b.bcr >= 1.5 ? 'text-green-400' : b.bcr >= 1.0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {b.bcr.toFixed(3)}
                  </td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{b.beneficiaries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
