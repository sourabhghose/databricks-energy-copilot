import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { PauseCircle } from 'lucide-react'
import {
  getElectricityNetworkInvestmentDeferralDashboard,
  ENIDDashboard,
} from '../api/client'

// ── Colour helpers ────────────────────────────────────────────────────────────
const STATUS_COLOURS: Record<string, string> = {
  Approved:       '#22c55e',
  'Under Review': '#f59e0b',
  Rejected:       '#ef4444',
  Implemented:    '#3b82f6',
}

const SOLUTION_COLOURS: Record<string, string> = {
  'Demand Response':   '#8b5cf6',
  'Battery Storage':   '#3b82f6',
  'Distributed Solar': '#f59e0b',
  'EV Smart Charging': '#10b981',
  'Load Management':   '#f97316',
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ElectricityNetworkInvestmentDeferralAnalytics() {
  const [data, setData] = useState<ENIDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityNetworkInvestmentDeferralDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading ENID dashboard…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data.'}
      </div>
    )
  }

  const { projects, deferral_trends, non_network_solutions, cost_benefits, regulator_decisions, summary } = data

  // ── Chart 1 — Top 15 projects by NPV saving ──────────────────────────────
  const top15 = [...projects]
    .sort((a, b) => b.npv_saving_m - a.npv_saving_m)
    .slice(0, 15)

  // ── Chart 2 — Deferred capex vs alternatives by DNSP (2024) ─────────────
  const trends2024 = deferral_trends.filter(t => t.year === 2024)
  const chart2Data = trends2024.map(t => ({
    dnsp: t.dnsp.replace(' Energy', '').replace(' Services', ''),
    deferred: t.deferred_capex_m,
    alternatives: t.implemented_alternatives_m,
  }))

  // ── Chart 3 — Peak reduction by solution type (2024) ────────────────────
  const solutionMap: Record<string, number> = {}
  non_network_solutions
    .filter(s => s.year === 2024)
    .forEach(s => {
      solutionMap[s.solution_type] = (solutionMap[s.solution_type] ?? 0) + s.peak_reduction_mw
    })
  const chart3Data = Object.entries(solutionMap).map(([type, mw]) => ({
    solution_type: type,
    peak_reduction_mw: Math.round(mw * 10) / 10,
  }))

  // ── Chart 4 — Scatter: BCR vs payback years ──────────────────────────────
  const scatterData = cost_benefits.map(cb => ({
    bcr: cb.bcr,
    payback: cb.payback_years,
    project_id: cb.project_id,
  }))

  // ── Chart 5 — RER% by DNSP (most recent year per DNSP) ──────────────────
  const latestDecisions: Record<string, typeof regulator_decisions[0]> = {}
  regulator_decisions.forEach(rd => {
    if (!latestDecisions[rd.dnsp] || rd.year > latestDecisions[rd.dnsp].year) {
      latestDecisions[rd.dnsp] = rd
    }
  })
  const chart5Data = Object.values(latestDecisions).map(rd => ({
    dnsp: rd.dnsp.replace(' Energy', '').replace(' Services', ''),
    rer_pct: rd.rer_pct,
    year: rd.year,
  }))

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <PauseCircle className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Electricity Network Investment Deferral Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Non-network alternatives, deferral savings, and AER regulatory decisions across Australian DNSPs
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Total Deferred Capex (2024)"
          value={`$${summary.total_deferred_capex_m.toFixed(1)}`}
          unit="M"
        />
        <KpiCard
          label="Non-Network Solutions (2024)"
          value={`$${summary.total_non_network_solutions_m.toFixed(1)}`}
          unit="M"
        />
        <KpiCard
          label="Avg NPV Saving / Project"
          value={`$${summary.avg_npv_saving_per_project_m.toFixed(2)}`}
          unit="M"
        />
        <KpiCard
          label="Total Peak Reduction (2024)"
          value={summary.total_peak_reduction_mw.toFixed(1)}
          unit="MW"
        />
        <KpiCard
          label="Projects Implemented"
          value={summary.projects_implemented}
        />
      </div>

      {/* Chart 1 — NPV saving by project */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-100">
          NPV Saving by Project — Top 15 (coloured by Approval Status)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top15} margin={{ top: 5, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="project_id"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-45}
              textAnchor="end"
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(val: number) => [`$${val.toFixed(2)}M`, 'NPV Saving']}
            />
            <Bar dataKey="npv_saving_m" name="NPV Saving ($M)" radius={[3, 3, 0, 0]}>
              {top15.map((p, idx) => (
                <Cell key={idx} fill={STATUS_COLOURS[p.approval_status] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3">
          {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
            <span key={status} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
              {status}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2 — Stacked bar: deferred capex vs alternatives by DNSP */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-100">
          Deferred Capex vs Non-Network Alternatives by DNSP (2024)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart2Data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="dnsp" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(val: number, name: string) => [`$${val.toFixed(1)}M`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="deferred" name="Deferred Capex ($M)" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="alternatives" name="Non-Network Alternatives ($M)" stackId="a" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3 — Peak reduction by solution type */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-100">
          Total Peak Reduction by Non-Network Solution Type (2024)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart3Data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="solution_type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(val: number) => [`${val.toFixed(1)} MW`, 'Peak Reduction']}
            />
            <Bar dataKey="peak_reduction_mw" name="Peak Reduction (MW)" radius={[3, 3, 0, 0]}>
              {chart3Data.map((d, idx) => (
                <Cell key={idx} fill={SOLUTION_COLOURS[d.solution_type] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — Scatter: BCR vs Payback Years */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-100">
          Benefit-Cost Ratio vs Payback Years (40 Projects)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              dataKey="payback"
              name="Payback Years"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Payback Years', position: 'insideBottom', offset: -5, fill: '#9ca3af', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="bcr"
              name="BCR"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'BCR', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(val: number, name: string) => [
                name === 'BCR' ? val.toFixed(2) : `${val.toFixed(1)} yrs`,
                name,
              ]}
            />
            <Scatter data={scatterData} fill="#8b5cf6" opacity={0.75} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 — RER% by DNSP */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-100">
          Non-Network Replacement Rate (RER%) by DNSP — Most Recent AER Decision
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart5Data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="dnsp" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[0, 35]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(val: number, _name: string, props: { payload?: { year?: number } }) => [
                `${val.toFixed(1)}% (${props.payload?.year ?? ''})`,
                'RER%',
              ]}
            />
            <Bar dataKey="rer_pct" name="RER (%)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary grid */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-100">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-400">Total Deferred Capex (2024)</dt>
            <dd className="font-semibold text-white">${summary.total_deferred_capex_m.toFixed(1)}M</dd>
          </div>
          <div>
            <dt className="text-gray-400">Total Non-Network Solutions (2024)</dt>
            <dd className="font-semibold text-white">${summary.total_non_network_solutions_m.toFixed(1)}M</dd>
          </div>
          <div>
            <dt className="text-gray-400">Avg NPV Saving per Project</dt>
            <dd className="font-semibold text-white">${summary.avg_npv_saving_per_project_m.toFixed(2)}M</dd>
          </div>
          <div>
            <dt className="text-gray-400">Total Peak Reduction (2024)</dt>
            <dd className="font-semibold text-white">{summary.total_peak_reduction_mw.toFixed(1)} MW</dd>
          </div>
          <div>
            <dt className="text-gray-400">Projects Implemented</dt>
            <dd className="font-semibold text-white">{summary.projects_implemented}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Total Projects</dt>
            <dd className="font-semibold text-white">{projects.length}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
