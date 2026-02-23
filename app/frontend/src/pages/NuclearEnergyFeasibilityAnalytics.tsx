import { useEffect, useState } from 'react'
import { Atom } from 'lucide-react'
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
import {
  getNuclearEnergyFeasibilityDashboard,
  NEFADashboard,
} from '../api/client'

const SCENARIO_COLORS: Record<string, string> = {
  Optimistic: '#34d399',
  Base: '#38bdf8',
  Pessimistic: '#f87171',
}

const SEISMIC_COLORS: Record<string, string> = {
  Low: '#34d399',
  Moderate: '#fbbf24',
  High: '#f87171',
}

const OPINION_COLORS = {
  support: '#34d399',
  oppose: '#f87171',
  undecided: '#94a3b8',
}

function KpiCard({
  label,
  value,
  unit,
  sub,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
      {title}
    </h2>
  )
}

export default function NuclearEnergyFeasibilityAnalytics() {
  const [data, setData] = useState<NEFADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNuclearEnergyFeasibilityDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
  }, [])

  if (error) {
    return (
      <div className="p-6 text-red-400">
        Failed to load Nuclear Energy Feasibility data: {error}
      </div>
    )
  }
  if (!data) {
    return (
      <div className="p-6 text-gray-400 animate-pulse">
        Loading Nuclear Energy Feasibility Analytics...
      </div>
    )
  }

  const { technologies, site_assessments, cost_comparisons, timeline_scenarios, public_opinion, summary } = data

  // Chart 1: overnight_cost_aud_kw and lcoe_aud_mwh by technology
  const techCostData = technologies.map((t) => ({
    name: t.technology,
    'Overnight Cost (AUD/kW)': t.overnight_cost_aud_kw,
    'LCOE (AUD/MWh)': t.lcoe_aud_mwh,
  }))

  // Chart 2: suitability_score by site (coloured by seismic risk)
  const siteData = site_assessments
    .slice()
    .sort((a, b) => b.suitability_score - a.suitability_score)
    .map((s) => ({
      name: s.site_name.length > 22 ? s.site_name.slice(0, 22) + '…' : s.site_name,
      fullName: s.site_name,
      score: s.suitability_score,
      seismic: s.seismic_risk,
      fill: SEISMIC_COLORS[s.seismic_risk] ?? '#94a3b8',
    }))

  // Chart 3: LCOE by technology × scenario grouped bar
  const lcoeTechData = technologies.map((t) => {
    const row: Record<string, string | number> = { name: t.technology }
    for (const scenario of ['Optimistic', 'Base', 'Pessimistic']) {
      const match = cost_comparisons.find(
        (c) => c.technology === t.technology && c.scenario === scenario,
      )
      if (match) row[scenario] = match.lcoe_aud_mwh
    }
    return row
  })

  // Chart 4: Stacked bar — support/oppose/undecided by state (2024)
  const opinionData = ['NSW', 'VIC', 'QLD', 'SA', 'WA'].map((state) => {
    const record = public_opinion.find((p) => p.state === state && p.year === 2024)
    return {
      state,
      Support: record?.support_pct ?? 0,
      Oppose: record?.oppose_pct ?? 0,
      Undecided: record?.undecided_pct ?? 0,
    }
  })

  // Chart 5: Timeline scenario comparison
  const timelineData = timeline_scenarios.map((ts) => ({
    name: ts.scenario_name,
    'Capacity (GW)': ts.total_capacity_gw,
    'Generation (TWh)': ts.annual_generation_twh,
    'CO2 Abatement (Mt/pa)': ts.co2_abatement_mt_pa,
  }))

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Atom className="text-sky-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">
            Nuclear Energy Feasibility Analytics
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Technology readiness, site assessments, cost scenarios and public opinion for Australian nuclear energy
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Lowest LCOE Technology"
          value={summary.lowest_lcoe_technology}
          sub="Most cost-competitive option"
        />
        <KpiCard
          label="Best Site Score"
          value={summary.best_site_score}
          unit="/ 100"
          sub="Top suitability score"
        />
        <KpiCard
          label="Earliest Possible Online"
          value={summary.earliest_possible_online}
          sub="First unit year (aggressive)"
        />
        <KpiCard
          label="Total Potential Capacity"
          value={summary.total_potential_capacity_gw}
          unit="GW"
          sub="Average across scenarios"
        />
        <KpiCard
          label="National Support"
          value={summary.national_support_pct}
          unit="%"
          sub="2024 survey average"
        />
      </div>

      {/* Chart 1: Technology Cost Overview */}
      <div className="bg-gray-800 rounded-lg p-5">
        <SectionTitle title="Technology Cost Overview — Overnight Cost vs LCOE" />
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={techCostData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-25}
              textAnchor="end"
              interval={0}
            />
            <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'AUD/kW', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'AUD/MWh', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="Overnight Cost (AUD/kW)" fill="#38bdf8" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="right" dataKey="LCOE (AUD/MWh)" fill="#f97316" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Site Suitability */}
      <div className="bg-gray-800 rounded-lg p-5">
        <SectionTitle title="Site Suitability Scores (coloured by Seismic Risk)" />
        <div className="flex gap-4 mb-3">
          {Object.entries(SEISMIC_COLORS).map(([risk, color]) => (
            <span key={risk} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              {risk} Seismic
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={siteData} margin={{ top: 10, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Score /100', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(value: number) => [`${value}`, 'Suitability Score']}
            />
            <Bar dataKey="score" radius={[3, 3, 0, 0]}>
              {siteData.map((entry, index) => (
                <rect key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: LCOE by Technology x Scenario */}
      <div className="bg-gray-800 rounded-lg p-5">
        <SectionTitle title="LCOE by Technology and Scenario (AUD/MWh)" />
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={lcoeTechData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-25}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'AUD/MWh', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {(['Optimistic', 'Base', 'Pessimistic'] as const).map((scenario) => (
              <Bar
                key={scenario}
                dataKey={scenario}
                fill={SCENARIO_COLORS[scenario]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Public Opinion by State (2024) */}
      <div className="bg-gray-800 rounded-lg p-5">
        <SectionTitle title="Public Opinion by State — 2024 (%)" />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={opinionData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Support" stackId="a" fill={OPINION_COLORS.support} />
            <Bar dataKey="Oppose" stackId="a" fill={OPINION_COLORS.oppose} />
            <Bar dataKey="Undecided" stackId="a" fill={OPINION_COLORS.undecided} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Timeline Scenario Comparison */}
      <div className="bg-gray-800 rounded-lg p-5">
        <SectionTitle title="Timeline Scenario Comparison — Capacity, Generation & CO2 Abatement" />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={timelineData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Capacity (GW)" fill="#38bdf8" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Generation (TWh)" fill="#a78bfa" radius={[3, 3, 0, 0]} />
            <Bar dataKey="CO2 Abatement (Mt/pa)" fill="#34d399" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-lg p-5">
        <SectionTitle title="Summary" />
        <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-x-8 gap-y-4">
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Lowest LCOE Technology</dt>
            <dd className="mt-1 text-sm font-semibold text-sky-300">{summary.lowest_lcoe_technology}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Best Site Score</dt>
            <dd className="mt-1 text-sm font-semibold text-white">{summary.best_site_score} / 100</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Earliest Online Year</dt>
            <dd className="mt-1 text-sm font-semibold text-white">{summary.earliest_possible_online}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Total Potential Capacity</dt>
            <dd className="mt-1 text-sm font-semibold text-white">{summary.total_potential_capacity_gw} GW</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide">National Support (2024)</dt>
            <dd className="mt-1 text-sm font-semibold text-emerald-400">{summary.national_support_pct}%</dd>
          </div>
        </dl>

        {/* Timeline details table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase text-left">
                <th className="pb-2 pr-4">Scenario</th>
                <th className="pb-2 pr-4">First Online</th>
                <th className="pb-2 pr-4">Capacity (GW)</th>
                <th className="pb-2 pr-4">Sites</th>
                <th className="pb-2 pr-4">CapEx (B AUD)</th>
                <th className="pb-2 pr-4">Generation (TWh)</th>
                <th className="pb-2 pr-4">CO2 Abatement (Mt/pa)</th>
                <th className="pb-2">Jobs</th>
              </tr>
            </thead>
            <tbody>
              {timeline_scenarios.map((ts) => (
                <tr key={ts.scenario_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-sky-300">{ts.scenario_name}</td>
                  <td className="py-2 pr-4">{ts.first_unit_online}</td>
                  <td className="py-2 pr-4">{ts.total_capacity_gw}</td>
                  <td className="py-2 pr-4">{ts.sites_count}</td>
                  <td className="py-2 pr-4">{ts.cumulative_capex_b}</td>
                  <td className="py-2 pr-4">{ts.annual_generation_twh}</td>
                  <td className="py-2 pr-4">{ts.co2_abatement_mt_pa}</td>
                  <td className="py-2">{ts.jobs_created.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Site assessments summary table */}
        <div className="mt-6 overflow-x-auto">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Site Assessments
          </h3>
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase text-left">
                <th className="pb-2 pr-4">Site</th>
                <th className="pb-2 pr-4">State</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Seismic</th>
                <th className="pb-2 pr-4">Social Licence</th>
                <th className="pb-2 pr-4">Grid Cost (M)</th>
                <th className="pb-2 pr-4">Env. Approvals</th>
                <th className="pb-2">Score /100</th>
              </tr>
            </thead>
            <tbody>
              {site_assessments.map((s) => (
                <tr key={s.site_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-sky-300">{s.site_name}</td>
                  <td className="py-2 pr-4">{s.state}</td>
                  <td className="py-2 pr-4">{s.site_type}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: (SEISMIC_COLORS[s.seismic_risk] ?? '#94a3b8') + '33',
                        color: SEISMIC_COLORS[s.seismic_risk] ?? '#94a3b8',
                      }}
                    >
                      {s.seismic_risk}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{s.social_license_score} / 10</td>
                  <td className="py-2 pr-4">${s.grid_connection_cost_m}M</td>
                  <td className="py-2 pr-4">{s.environmental_approvals}</td>
                  <td className="py-2 font-semibold text-emerald-400">{s.suitability_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
