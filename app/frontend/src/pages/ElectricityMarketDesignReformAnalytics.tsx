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
  Cell,
} from 'recharts'
import { BookOpen } from 'lucide-react'
import {
  getElectricityMarketDesignReformDashboard,
  EMDRDashboard,
} from '../api/client'

// ── Colour helpers ────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  Implemented: '#22c55e',
  Consultation: '#3b82f6',
  'Rule Change Proposed': '#a855f7',
  'Under Review': '#f59e0b',
  Rejected: '#ef4444',
}

const COMPLEXITY_COLOURS: Record<string, string> = {
  Low: '#22c55e',
  Medium: '#f59e0b',
  High: '#ef4444',
}

const POSITION_COLOURS: Record<string, string> = {
  Support: '#22c55e',
  Oppose: '#ef4444',
  'Conditional Support': '#f59e0b',
  Neutral: '#94a3b8',
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-xl font-bold text-white truncate">{value}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ElectricityMarketDesignReformAnalytics() {
  const [data, setData] = useState<EMDRDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityMarketDesignReformDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
  }, [])

  if (error) {
    return (
      <div className="p-6 text-red-400">
        Failed to load EMDR dashboard: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-gray-400 animate-pulse">
        Loading Electricity Market Design Reform Analytics…
      </div>
    )
  }

  const { reforms, implementation_progress, stakeholder_positions, comparative_designs, summary } = data

  // ── Chart 1: Top 10 reforms by consumer benefit, coloured by status ─────────
  const top10Reforms = [...reforms]
    .sort((a, b) => b.consumer_benefit_m_pa - a.consumer_benefit_m_pa)
    .slice(0, 10)

  // ── Chart 2: Progress % by reform (year 2024), coloured by complexity ────────
  const progressData = reforms.map((r) => {
    const prog = implementation_progress.find(
      (p) => p.reform_id === r.reform_id && p.year === 2024,
    )
    return {
      reform_id: r.reform_id,
      progress_pct: prog ? prog.progress_pct : 0,
      complexity: r.complexity,
    }
  })

  // ── Chart 3: Stakeholder position distribution by stakeholder_type ───────────
  const stakeholderTypes = [
    'Generators',
    'Networks',
    'Retailers',
    'Large Consumers',
    'Households',
    'Advocacy Groups',
  ]
  const positions = ['Support', 'Oppose', 'Conditional Support', 'Neutral']
  const stakeholderChart = stakeholderTypes.map((stype) => {
    const rows = stakeholder_positions.filter((sp) => sp.stakeholder_type === stype)
    const entry: Record<string, string | number> = { stakeholder_type: stype }
    for (const pos of positions) {
      entry[pos] = rows.filter((sp) => sp.position === pos).length
    }
    return entry
  })

  // ── Chart 4: Total consumer benefit by category ───────────────────────────────
  const categoryMap: Record<string, number> = {}
  for (const r of reforms) {
    categoryMap[r.category] = (categoryMap[r.category] ?? 0) + r.consumer_benefit_m_pa
  }
  const categoryChart = Object.entries(categoryMap)
    .map(([category, total]) => ({ category, total: Math.round(total) }))
    .sort((a, b) => b.total - a.total)

  // ── Chart 5: Applicability to NEM score by design element ────────────────────
  const applicabilityScore: Record<string, string> = { High: '3', Medium: '2', Low: '1' }
  const designElementMap: Record<string, number[]> = {}
  for (const cd of comparative_designs) {
    if (!designElementMap[cd.design_element]) {
      designElementMap[cd.design_element] = []
    }
    designElementMap[cd.design_element].push(
      parseInt(applicabilityScore[cd.applicability_to_nem] ?? '1', 10),
    )
  }
  const applicabilityChart = Object.entries(designElementMap).map(([element, scores]) => ({
    element,
    avg_score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
  }))

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen size={28} className="text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Electricity Market Design Reform Analytics
          </h1>
          <p className="text-sm text-gray-400">
            NEM reform pipeline, implementation progress, stakeholder positions and comparative design benchmarks
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Reforms Tracked" value={summary.total_reforms_tracked} />
        <KpiCard label="Implemented Reforms" value={summary.implemented_reforms} />
        <KpiCard
          label="Total Annual Benefit ($M)"
          value={`$${summary.total_annual_benefit_m.toLocaleString()}M`}
        />
        <KpiCard label="Reforms in Consultation" value={summary.reforms_in_consultation} />
        <KpiCard label="Highest Benefit Reform" value={summary.highest_benefit_reform} />
      </div>

      {/* Chart 1: Consumer benefit by reform name */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-200">
          Consumer Benefit ($M/pa) — Top 10 Reforms by Status
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top10Reforms} margin={{ top: 5, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="reform_name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number) => [`$${v}M`, 'Benefit']}
            />
            <Bar dataKey="consumer_benefit_m_pa" name="Benefit ($M/pa)" radius={[4, 4, 0, 0]}>
              {top10Reforms.map((r) => (
                <Cell key={r.reform_id} fill={STATUS_COLOURS[r.status] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
            <span key={status} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
              {status}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Implementation progress by reform (2024) */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-200">
          Implementation Progress % (2024) — Coloured by Complexity
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={progressData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="reform_id" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number) => [`${v}%`, 'Progress']}
            />
            <Bar dataKey="progress_pct" name="Progress %" radius={[4, 4, 0, 0]}>
              {progressData.map((d, i) => (
                <Cell key={i} fill={COMPLEXITY_COLOURS[d.complexity] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(COMPLEXITY_COLOURS).map(([comp, colour]) => (
            <span key={comp} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
              {comp}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 3: Stakeholder position distribution */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-200">
          Stakeholder Position Distribution by Stakeholder Type
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={stakeholderChart} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="stakeholder_type"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-20}
              textAnchor="end"
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {positions.map((pos) => (
              <Bar
                key={pos}
                dataKey={pos}
                stackId="a"
                fill={POSITION_COLOURS[pos]}
                name={pos}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Consumer benefit by category */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-200">
          Total Consumer Benefit ($M/pa) by Reform Category
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={categoryChart} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="category"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number) => [`$${v}M`, 'Benefit']}
            />
            <Bar dataKey="total" name="Total Benefit ($M/pa)" fill="#60a5fa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Applicability to NEM score by design element */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-200">
          Avg NEM Applicability Score by Design Element (High=3 / Medium=2 / Low=1)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={applicabilityChart} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="element"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 3]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number) => [v.toFixed(1), 'Avg Score']}
            />
            <Bar dataKey="avg_score" name="Avg Applicability Score" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-200">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Total Reforms Tracked</dt>
            <dd className="text-white font-semibold">{summary.total_reforms_tracked}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Implemented Reforms</dt>
            <dd className="text-white font-semibold">{summary.implemented_reforms}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Total Annual Benefit</dt>
            <dd className="text-white font-semibold">${summary.total_annual_benefit_m.toLocaleString()}M</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Reforms in Consultation</dt>
            <dd className="text-white font-semibold">{summary.reforms_in_consultation}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Highest Benefit Reform</dt>
            <dd className="text-white font-semibold">{summary.highest_benefit_reform}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
