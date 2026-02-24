import { useEffect, useState } from 'react'
import { Briefcase, TrendingUp, DollarSign, Users, Award } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import { getEnergyTransitionJobsDashboard } from '../api/client'
import type { ETJJDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  Active: '#22c55e',
  Completed: '#3b82f6',
  Proposed: '#f59e0b',
}

const YEAR_COLORS: Record<number, string> = {
  2022: '#6366f1',
  2023: '#f59e0b',
  2024: '#22c55e',
}

const CAT_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
]

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EnergyTransitionJobsAnalytics() {
  const [data, setData] = useState<ETJJDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyTransitionJobsDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-400">
        Loading Energy Transition Jobs data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400">
        Error: {error ?? 'No data available'}
      </div>
    )
  }

  const { summary, worker_profiles, transition_programs, regional_impact, skill_mapping } = data

  // ── Chart 1: Jobs by job_category and year grouped (2024 filter) ──────────
  const categories = ['Direct Renewable', 'Manufacturing', 'Construction', 'O&M', 'Decommissioning']
  const regions2024 = ['NSW', 'QLD', 'VIC', 'SA', 'WA', 'TAS']
  const catData = categories.map((cat) => {
    const profiles2024 = worker_profiles.filter(
      (wp) => wp.job_category === cat && wp.year === 2024
    )
    const entry: Record<string, string | number> = { category: cat }
    regions2024.forEach((r) => {
      const found = profiles2024.find((wp) => wp.region === r)
      entry[r] = found ? found.jobs_count : 0
    })
    return entry
  })

  // ── Chart 2: Transition programs funding coloured by status ───────────────
  const programData = transition_programs.map((p) => ({
    name: p.program_name.length > 20 ? p.program_name.slice(0, 20) + '…' : p.program_name,
    fullName: p.program_name,
    funding: p.funding_m_aud,
    status: p.status,
  }))

  // ── Chart 3: Regional net_jobs_change across years (stacked) ──────────────
  const regionsForImpact = ['NSW', 'QLD', 'VIC', 'SA', 'WA', 'TAS']
  const years = [2022, 2023, 2024]
  const netChangeData = regionsForImpact.map((region) => {
    const entry: Record<string, string | number> = { region }
    years.forEach((year) => {
      const rec = regional_impact.find((ri) => ri.region === region && ri.year === year)
      entry[String(year)] = rec ? rec.net_jobs_change : 0
    })
    return entry
  })

  // ── Chart 4: Skill transferability (horizontal bar sorted desc) ───────────
  const skillData = [...skill_mapping]
    .sort((a, b) => b.transferability_pct - a.transferability_pct)
    .map((s) => ({
      skill: s.fossil_skill,
      transferability: s.transferability_pct,
      demand_growth: s.demand_growth_pct,
    }))

  // ── Chart 5: Stacked regional jobs lost vs gained (2024) ─────────────────
  const lostGained2024 = regionsForImpact.map((region) => {
    const rec = regional_impact.find((ri) => ri.region === region && ri.year === 2024)
    return {
      region,
      jobs_lost: rec ? rec.fossil_fuel_jobs_lost : 0,
      jobs_gained: rec ? rec.renewable_jobs_gained : 0,
    }
  })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-green-600">
          <Briefcase size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Energy Transition Just Jobs</h1>
          <p className="text-sm text-gray-400">
            Workforce analytics for Australia's clean energy transition
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Renewable Jobs 2024"
          value={summary.total_renewable_jobs_2024.toLocaleString()}
          sub="Direct + indirect roles"
          icon={Users}
          color="bg-green-600"
        />
        <KpiCard
          title="Total Transition Funding"
          value={`A$${summary.total_transition_funding_m_aud.toFixed(1)}M`}
          sub="Across all programs"
          icon={DollarSign}
          color="bg-blue-600"
        />
        <KpiCard
          title="Workers Retrained"
          value={summary.workers_retrained.toLocaleString()}
          sub="Via completed programs"
          icon={Award}
          color="bg-amber-600"
        />
        <KpiCard
          title="Avg Salary Increase"
          value={`${summary.avg_salary_increase_pct.toFixed(1)}%`}
          sub="Fossil → renewable roles"
          icon={TrendingUp}
          color="bg-purple-600"
        />
      </div>

      {/* Chart 1: Jobs by category (2024) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Jobs by Category &amp; Region (2024)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={catData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="category"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {regions2024.map((region, idx) => (
              <Bar key={region} dataKey={region} fill={CAT_COLORS[idx % CAT_COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Transition program funding by status */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Transition Program Funding (A$M) by Status
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={programData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={70}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(value: number) => [`A$${value.toFixed(1)}M`, 'Funding']}
            />
            <Bar dataKey="funding" name="Funding (A$M)">
              {programData.map((entry, idx) => (
                <Cell key={idx} fill={STATUS_COLORS[entry.status] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 justify-center">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-400">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart 3: Regional net jobs change (stacked by year) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Regional Net Jobs Change by Year (Stacked)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={netChangeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {years.map((year) => (
              <Bar
                key={year}
                dataKey={String(year)}
                stackId="a"
                fill={YEAR_COLORS[year]}
                name={String(year)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Skill transferability (horizontal bar sorted desc) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Skill Transferability: Fossil → Renewable (% — sorted desc)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={skillData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 130, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              unit="%"
            />
            <YAxis
              type="category"
              dataKey="skill"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={120}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(value: number) => [`${value.toFixed(1)}%`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="transferability" fill="#3b82f6" name="Transferability %" />
            <Bar dataKey="demand_growth" fill="#22c55e" name="Demand Growth %" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Stacked regional jobs lost vs gained (2024) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Regional Jobs Lost vs Gained (2024)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={lostGained2024} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="jobs_lost" stackId="b" fill="#ef4444" name="Fossil Jobs Lost" />
            <Bar dataKey="jobs_gained" stackId="b" fill="#22c55e" name="Renewable Jobs Gained" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
