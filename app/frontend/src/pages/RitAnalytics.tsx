import { useEffect, useState } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { GitBranch, AlertCircle, Loader2 } from 'lucide-react'
import {
  api,
  RitDashboard,
  RitProject,
  RitOptionRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub?: string
}

function KpiCard({ label, value, sub }: KpiProps) {
  return (
    <div className="rounded-lg p-4 bg-gray-800">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function TypeBadge({ type }: { type: string }) {
  const isT = type === 'RIT_T'
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
        isT ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'
      }`}
    >
      {type}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ASSESSMENT: 'bg-gray-700 text-gray-300',
    DRAFT: 'bg-yellow-900 text-yellow-300',
    FINAL: 'bg-blue-900 text-blue-300',
    APPROVED: 'bg-indigo-900 text-indigo-300',
    CONSTRUCTION: 'bg-orange-900 text-orange-300',
    COMPLETE: 'bg-green-900 text-green-300',
  }
  const cls = map[status] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status}
    </span>
  )
}

function FeasibilityBadge({ feasibility }: { feasibility: string }) {
  const map: Record<string, string> = {
    HIGH: 'bg-green-900 text-green-300',
    MEDIUM: 'bg-yellow-900 text-yellow-300',
    LOW: 'bg-red-900 text-red-300',
  }
  const cls = map[feasibility] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {feasibility}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Scatter tooltip
// ---------------------------------------------------------------------------

interface ScatterTooltipProps {
  active?: boolean
  payload?: Array<{ payload: RitProject & { x: number; y: number } }>
}

function ScatterTooltipContent({ active, payload }: ScatterTooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="bg-gray-800 border border-gray-600 rounded p-3 text-xs text-gray-200 shadow-lg">
      <p className="font-semibold text-white mb-1">{p.project_name}</p>
      <p>Type: {p.project_type}</p>
      <p>CAPEX: ${fmt(p.capital_cost_m_aud)}M</p>
      <p>Net Benefit: ${fmt(p.net_market_benefit_m_aud)}M</p>
      <p>BCR: {p.benefit_cost_ratio.toFixed(2)}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RitAnalytics() {
  const [dash, setDash] = useState<RitDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  useEffect(() => {
    api
      .getRitDashboard()
      .then((d) => {
        setDash(d)
        if (d.projects.length > 0) setSelectedProjectId(d.projects[0].project_id)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading RIT Analytics…
      </div>
    )
  }

  if (error || !dash) {
    return (
      <div className="flex items-center gap-2 p-6 text-red-400">
        <AlertCircle size={18} />
        {error ?? 'No data available'}
      </div>
    )
  }

  // Prepare scatter data split by type
  const ritTData = dash.projects
    .filter((p) => p.project_type === 'RIT_T')
    .map((p) => ({ ...p, x: p.capital_cost_m_aud, y: p.net_market_benefit_m_aud }))

  const ritDData = dash.projects
    .filter((p) => p.project_type === 'RIT_D')
    .map((p) => ({ ...p, x: p.capital_cost_m_aud, y: p.net_market_benefit_m_aud }))

  // Options for the selected project
  const filteredOptions: RitOptionRecord[] = dash.options.filter(
    (o) => o.project_id === selectedProjectId
  )

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GitBranch className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Network Investment Test (RIT-T/RIT-D) Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Regulatory Investment Tests for Transmission and Distribution projects
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Projects"
          value={String(dash.total_projects)}
          sub={`${dash.rit_t_projects} RIT-T · ${dash.rit_d_projects} RIT-D`}
        />
        <KpiCard
          label="Total CAPEX"
          value={`$${fmt(dash.total_capex_m_aud)}M`}
          sub="Capital expenditure"
        />
        <KpiCard
          label="Total Net Benefit"
          value={`$${fmt(dash.total_net_benefit_m_aud)}M`}
          sub="NPV of market benefits"
        />
        <KpiCard
          label="Avg BCR"
          value={dash.avg_bcr.toFixed(2)}
          sub="Benefit-cost ratio"
        />
      </div>

      {/* Scatter Chart */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">
          Capital Cost vs Net Market Benefit
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              dataKey="x"
              name="CAPEX ($M)"
              label={{ value: 'CAPEX ($M AUD)', position: 'insideBottom', offset: -15, fill: '#9CA3AF', fontSize: 12 }}
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Net Benefit ($M)"
              label={{ value: 'Net Benefit ($M AUD)', angle: -90, position: 'insideLeft', offset: 10, fill: '#9CA3AF', fontSize: 12 }}
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
            />
            <Tooltip content={<ScatterTooltipContent />} />
            <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
            <Scatter name="RIT-T (Transmission)" data={ritTData} fill="#3B82F6" />
            <Scatter name="RIT-D (Distribution)" data={ritDData} fill="#10B981" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Projects Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">
          RIT Projects
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left py-2 pr-3">Project</th>
                <th className="text-left py-2 pr-3">Proponent</th>
                <th className="text-left py-2 pr-3">Type</th>
                <th className="text-left py-2 pr-3">State</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-right py-2 pr-3">CAPEX ($M)</th>
                <th className="text-right py-2 pr-3">Net Benefit ($M)</th>
                <th className="text-right py-2 pr-3">BCR</th>
                <th className="text-left py-2 pr-3">Period</th>
                <th className="text-left py-2">Key Drivers</th>
              </tr>
            </thead>
            <tbody>
              {dash.projects.map((p: RitProject) => (
                <tr
                  key={p.project_id}
                  className="border-b border-gray-700 hover:bg-gray-750"
                >
                  <td className="py-2 pr-3 text-white font-medium max-w-[180px] truncate">
                    {p.project_name}
                  </td>
                  <td className="py-2 pr-3 text-gray-300">{p.proponent}</td>
                  <td className="py-2 pr-3">
                    <TypeBadge type={p.project_type} />
                  </td>
                  <td className="py-2 pr-3 text-gray-300">{p.state}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-200">
                    {fmt(p.capital_cost_m_aud)}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-200">
                    {fmt(p.net_market_benefit_m_aud)}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right font-semibold ${
                      p.benefit_cost_ratio >= 1.4 ? 'text-green-400' : 'text-gray-200'
                    }`}
                  >
                    {p.benefit_cost_ratio.toFixed(2)}
                  </td>
                  <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">
                    {p.commencement_year}–{p.completion_year}
                  </td>
                  <td className="py-2 text-gray-400 text-xs max-w-[180px]">
                    {p.key_drivers.slice(0, 2).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Options Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Project Options Comparison
          </h2>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-gray-700 text-gray-200 text-sm rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {dash.projects.map((p: RitProject) => (
              <option key={p.project_id} value={p.project_id}>
                {p.project_name}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left py-2 pr-3">Option</th>
                <th className="text-left py-2 pr-3">Type</th>
                <th className="text-right py-2 pr-3">CAPEX ($M)</th>
                <th className="text-right py-2 pr-3">OPEX p.a. ($M)</th>
                <th className="text-right py-2 pr-3">Net Benefit ($M)</th>
                <th className="text-left py-2 pr-3">Preferred</th>
                <th className="text-left py-2">Feasibility</th>
              </tr>
            </thead>
            <tbody>
              {filteredOptions.map((o: RitOptionRecord) => (
                <tr
                  key={o.option_id}
                  className="border-b border-gray-700 hover:bg-gray-750"
                >
                  <td className="py-2 pr-3 text-white font-medium">{o.option_name}</td>
                  <td className="py-2 pr-3 text-gray-300">{o.option_type}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">
                    {fmt(o.capex_m_aud)}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-200">
                    {fmt(o.opex_m_aud_pa, 2)}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-200">
                    {fmt(o.net_benefit_m_aud)}
                  </td>
                  <td className="py-2 pr-3">
                    {o.is_preferred ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-900 text-blue-300">
                        Preferred
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    <FeasibilityBadge feasibility={o.feasibility} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
