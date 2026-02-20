import { useEffect, useState } from 'react'
import { Sun } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getSolarThermalCSPDashboard,
  type CSPXDashboard,
  type CSPXProjectRecord,
  type CSPXComparisonRecord,
} from '../api/client'

const TECH_COLORS: Record<string, string> = {
  PARABOLIC_TROUGH: '#f59e0b',
  POWER_TOWER: '#3b82f6',
  LINEAR_FRESNEL: '#10b981',
  DISH_STIRLING: '#a855f7',
}

const STATUS_COLORS: Record<string, string> = {
  OPERATIONAL: 'bg-green-600',
  UNDER_CONSTRUCTION: 'bg-blue-600',
  PROPOSED: 'bg-yellow-600',
  FEASIBILITY: 'bg-gray-600',
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-gray-500 text-xs">{sub}</p>}
    </div>
  )
}

function ProjectTable({ projects }: { projects: CSPXProjectRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold mb-3">CSP Project Register</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Project</th>
              <th className="text-left py-2 pr-3">Technology</th>
              <th className="text-left py-2 pr-3">State</th>
              <th className="text-right py-2 pr-3">Cap (MW)</th>
              <th className="text-right py-2 pr-3">Storage (h)</th>
              <th className="text-right py-2 pr-3">CF (%)</th>
              <th className="text-right py-2 pr-3">LCOE (AUD/MWh)</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.project_id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-3 text-white font-medium">{p.name}</td>
                <td className="py-2 pr-3">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-mono text-white"
                    style={{ backgroundColor: TECH_COLORS[p.technology] ?? '#6b7280' }}
                  >
                    {p.technology.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-300">{p.state}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{p.capacity_mw.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{p.storage_hours.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{p.cf_pct.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-yellow-400">${p.lcoe_aud_per_mwh.toFixed(0)}</td>
                <td className="py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs text-white ${STATUS_COLORS[p.status] ?? 'bg-gray-600'}`}
                  >
                    {p.status.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LcoeCurveChart({ costCurves }: { costCurves: CSPXDashboard['cost_curves'] }) {
  const technologies = ['PARABOLIC_TROUGH', 'POWER_TOWER', 'LINEAR_FRESNEL', 'DISH_STIRLING']
  const years = Array.from(new Set(costCurves.map((c) => c.year))).sort()

  const data = years.map((yr) => {
    const row: Record<string, number | string> = { year: yr }
    technologies.forEach((tech) => {
      const records = costCurves.filter((c) => c.technology === tech && c.year === yr)
      if (records.length > 0) {
        row[tech] = Math.round(records.reduce((s, r) => s + r.lcoe_aud_per_mwh, 0) / records.length)
      }
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold mb-3">LCOE Cost Curves by Technology (AUD/MWh)</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" $" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
            formatter={(v: number) => [`$${v} AUD/MWh`]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {technologies.map((tech) => (
            <Line
              key={tech}
              type="monotone"
              dataKey={tech}
              name={tech.replace(/_/g, ' ')}
              stroke={TECH_COLORS[tech]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function DniResourceChart({ resources }: { resources: CSPXDashboard['resources'] }) {
  const data = [...resources]
    .sort((a, b) => b.dni_kwh_m2_day - a.dni_kwh_m2_day)
    .map((r) => ({
      name: r.location,
      DNI: r.dni_kwh_m2_day,
      GHI: r.ghi_kwh_m2_day,
    }))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold mb-3">Solar Resource Quality by Location (kWh/m2/day)</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-35} textAnchor="end" />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="DNI" name="DNI" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          <Bar dataKey="GHI" name="GHI" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TechComparisonRadar({ comparison }: { comparison: CSPXComparisonRecord[] }) {
  const dimensions = [
    { key: 'dispatchability_score', label: 'Dispatchability' },
    { key: 'cost_competitiveness', label: 'Cost' },
    { key: 'grid_services_value', label: 'Grid Services' },
    { key: 'land_use_score', label: 'Land Use' },
    { key: 'water_use_score', label: 'Water Use' },
    { key: 'storage_integration', label: 'Storage' },
  ]

  const data = dimensions.map((dim) => {
    const row: Record<string, string | number> = { subject: dim.label }
    comparison.forEach((c) => {
      row[c.technology] = (c as unknown as Record<string, number>)[dim.key]
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold mb-3">Technology Comparison (6 Dimensions)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data}>
          <PolarGrid stroke="#374151" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#6b7280', fontSize: 10 }} />
          {comparison.map((c) => (
            <Radar
              key={c.technology}
              name={c.technology.replace(/_/g, ' ')}
              dataKey={c.technology}
              stroke={TECH_COLORS[c.technology]}
              fill={TECH_COLORS[c.technology]}
              fillOpacity={0.15}
            />
          ))}
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DispatchProfileChart({ dispatch }: { dispatch: CSPXDashboard['dispatch_profiles'] }) {
  const months = Array.from(new Set(dispatch.map((d) => d.month)))
  const firstProjectId = dispatch[0]?.project_id ?? ''

  const data = months.map((month) => {
    const records = dispatch.filter((d) => d.project_id === firstProjectId && d.month === month)
    const rec = records[0]
    return {
      month: month.slice(0, 6),
      Solar: rec?.solar_gen_gwh ?? 0,
      Storage: rec?.storage_discharge_gwh ?? 0,
    }
  })

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold mb-1">Monthly Dispatch Profile — {firstProjectId}</h2>
      <p className="text-gray-400 text-xs mb-3">Solar generation vs storage discharge (GWh)</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" GWh" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
            formatter={(v: number) => [`${v.toFixed(1)} GWh`]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="Solar" name="Solar Gen" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Storage" name="Storage Discharge" stackId="a" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ResourceTable({ resources }: { resources: CSPXDashboard['resources'] }) {
  const sorted = [...resources].sort((a, b) => b.suitability_score - a.suitability_score)
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold mb-3">Solar Resource Assessment</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Location</th>
              <th className="text-left py-2 pr-3">State</th>
              <th className="text-right py-2 pr-3">DNI (kWh/m2/d)</th>
              <th className="text-right py-2 pr-3">GHI (kWh/m2/d)</th>
              <th className="text-right py-2 pr-3">Clear-sky Days</th>
              <th className="text-right py-2 pr-3">Usable Hours/yr</th>
              <th className="text-right py-2">Suitability</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.location} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-3 text-white font-medium">{r.location}</td>
                <td className="py-2 pr-3 text-gray-300">{r.state}</td>
                <td className="py-2 pr-3 text-right text-yellow-400">{r.dni_kwh_m2_day.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right text-blue-400">{r.ghi_kwh_m2_day.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{r.clearsky_days_per_year}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{r.annual_usable_hours.toLocaleString()}</td>
                <td className="py-2 text-right">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold text-white"
                    style={{
                      backgroundColor:
                        r.suitability_score >= 8.5 ? '#16a34a' :
                        r.suitability_score >= 7 ? '#d97706' : '#6b7280',
                    }}
                  >
                    {r.suitability_score.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SolarThermalCSPAnalytics() {
  const [data, setData] = useState<CSPXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSolarThermalCSPDashboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading Solar Thermal CSP Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-lg">{error ?? 'No data available'}</p>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Sun className="text-yellow-400" size={28} />
        <div>
          <h1 className="text-white text-2xl font-bold">Solar Thermal CSP Analytics</h1>
          <p className="text-gray-400 text-sm">
            Concentrating Solar Power — Australian NEM project pipeline, resource quality and technology benchmarks
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Projects"
          value={String(summary['total_projects'] ?? 0)}
          sub={`${summary['operational_projects'] ?? 0} operational`}
        />
        <KpiCard
          label="Total Capacity"
          value={`${Number(summary['total_capacity_mw'] ?? 0).toFixed(0)} MW`}
          sub="Pipeline capacity"
        />
        <KpiCard
          label="Best DNI Location"
          value={String(summary['best_dni_location'] ?? '—')}
          sub="Highest direct normal irradiance"
        />
        <KpiCard
          label="Avg Storage Hours"
          value={`${Number(summary['avg_storage_hours'] ?? 0).toFixed(1)} h`}
          sub={`Australia CSP potential: ${Number(summary['australia_csp_potential_gw'] ?? 0).toFixed(0)} GW`}
        />
      </div>

      {/* Project Table */}
      <div className="mb-6">
        <ProjectTable projects={data.projects} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <LcoeCurveChart costCurves={data.cost_curves} />
        <DniResourceChart resources={data.resources} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TechComparisonRadar comparison={data.technology_comparison} />
        <DispatchProfileChart dispatch={data.dispatch_profiles} />
      </div>

      {/* Resource Table */}
      <div className="mb-6">
        <ResourceTable resources={data.resources} />
      </div>
    </div>
  )
}
