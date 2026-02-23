import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Sun } from 'lucide-react'
import {
  getSolarThermalPowerPlantDashboard,
  STPAXDashboard,
} from '../api/client'

// ── colour palette ───────────────────────────────────────────────────────────
const COLOURS = {
  parabolic:  '#f59e0b',
  powerTower: '#ef4444',
  fresnel:    '#3b82f6',
  dish:       '#a78bfa',
  hybrid:     '#10b981',
  operating:  '#22c55e',
  construction:'#f59e0b',
  development:'#3b82f6',
  concept:    '#a78bfa',
  cancelled:  '#64748b',
  molten:     '#ef4444',
  concrete:   '#64748b',
  phase:      '#a78bfa',
  steam:      '#3b82f6',
}

const TECH_COLOURS: Record<string, string> = {
  'Parabolic Trough': COLOURS.parabolic,
  'Power Tower':      COLOURS.powerTower,
  'Linear Fresnel':   COLOURS.fresnel,
  'Dish Stirling':    COLOURS.dish,
  'Hybrid PV-CSP':    COLOURS.hybrid,
}

const STATUS_COLOURS: Record<string, string> = {
  'Operating':    COLOURS.operating,
  'Construction': COLOURS.construction,
  'Development':  COLOURS.development,
  'Concept':      COLOURS.concept,
  'Cancelled':    COLOURS.cancelled,
}

const STORAGE_COLOURS: Record<string, string> = {
  'Molten Salt Two-Tank':    COLOURS.molten,
  'Molten Salt Single-Tank': '#f97316',
  'Concrete':                COLOURS.concrete,
  'Phase Change':            COLOURS.phase,
  'Steam Accumulator':       COLOURS.steam,
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── chart wrapper ─────────────────────────────────────────────────────────────
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function SolarThermalPowerPlantAnalytics() {
  const [data, setData] = useState<STPAXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSolarThermalPowerPlantDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Loading Solar Thermal Power Plant data…
    </div>
  )
  if (error || !data) return (
    <div className="flex items-center justify-center h-64 text-red-400">
      {error ?? 'No data available'}
    </div>
  )

  const { technologies, projects, costs, storage, resources, dispatchability, summary } = data

  // ── Chart 1: Global CSP Capacity by Country (horizontal bar) ─────────────
  const countryMap: Record<string, number> = {}
  for (const p of projects) {
    if (p.status === 'Operating') {
      countryMap[p.country] = (countryMap[p.country] ?? 0) + p.capacity_mw
    }
  }
  const globalCapacityData = Object.entries(countryMap)
    .map(([country, capacity_mw]) => ({ country, capacity_mw: Math.round(capacity_mw) }))
    .sort((a, b) => b.capacity_mw - a.capacity_mw)

  // ── Chart 2: Cost Trajectory 2020-2027 by technology ─────────────────────
  const costYearMap: Record<number, Record<string, number>> = {}
  for (const c of costs) {
    if (['Parabolic Trough', 'Power Tower', 'Linear Fresnel'].includes(c.technology)) {
      if (!costYearMap[c.year]) costYearMap[c.year] = { year: c.year }
      costYearMap[c.year][c.technology] = c.lcoe_usd_per_mwh
    }
  }
  const costTrajectory = Object.values(costYearMap).sort((a, b) => (a.year as number) - (b.year as number))

  // ── Chart 3: Storage Technology Comparison (grouped bar) ─────────────────
  const storageMediumMap: Record<string, { efficiency: number; cost: number; count: number }> = {}
  for (const s of storage) {
    if (!storageMediumMap[s.storage_medium]) {
      storageMediumMap[s.storage_medium] = { efficiency: 0, cost: 0, count: 0 }
    }
    storageMediumMap[s.storage_medium].efficiency += s.round_trip_efficiency_pct
    storageMediumMap[s.storage_medium].cost += s.storage_cost_usd_per_kwh
    storageMediumMap[s.storage_medium].count += 1
  }
  const storageComparisonData = Object.entries(storageMediumMap).map(([medium, vals]) => ({
    medium: medium.replace('Molten Salt ', 'MS '),
    avg_efficiency: Math.round((vals.efficiency / vals.count) * 10) / 10,
    avg_cost: Math.round((vals.cost / vals.count) * 10) / 10,
  }))

  // ── Chart 4: Australian Resource Map (CSP potential by location) ──────────
  const auResources = resources
    .filter(r => r.csp_potential_gw > 0)
    .map(r => ({ location: r.location, state: r.state, csp_potential_gw: r.csp_potential_gw }))
    .sort((a, b) => b.csp_potential_gw - a.csp_potential_gw)
    .slice(0, 12)

  // ── Chart 5: Dispatchability Value (line, storage hours axis) ────────────
  const dispatchSorted = [...dispatchability]
    .filter(d => d.year === 2024)
    .sort((a, b) => a.storage_hours - b.storage_hours)
    .map(d => ({
      storage_hours: d.storage_hours,
      avg_dispatch_price: d.avg_dispatch_price_aud_per_mwh,
      revenue_premium: d.revenue_premium_vs_pv_pct,
      label: `${d.storage_hours}h`,
    }))

  // ── Chart 6: Project Pipeline stacked bar (capacity by status × technology) ─
  const pipelineMap: Record<string, Record<string, number>> = {}
  for (const p of projects) {
    if (!pipelineMap[p.status]) pipelineMap[p.status] = {}
    pipelineMap[p.status][p.technology] = (pipelineMap[p.status][p.technology] ?? 0) + p.capacity_mw
  }
  const pipelineData = Object.entries(pipelineMap).map(([status, techMap]) => ({ status, ...techMap }))
  const pipelineTechs = [...new Set(projects.map(p => p.technology))]

  // ── KPI values ────────────────────────────────────────────────────────────
  const totalGlobalGW = summary.total_global_csp_mw
    ? (Number(summary.total_global_csp_mw) / 1000).toFixed(1)
    : '—'
  const avg2024Lcoe = costs
    .filter(c => c.year === 2024)
    .reduce((acc, c, _, arr) => acc + c.lcoe_usd_per_mwh / arr.length, 0)

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Sun className="text-amber-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">Solar Thermal Power Plant Analytics</h1>
          <p className="text-sm text-gray-400">
            Concentrated Solar Power (CSP) — Parabolic Trough, Power Tower, Linear Fresnel, Dish Stirling — Technology, Storage &amp; Dispatchability
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Global CSP"
          value={`${totalGlobalGW} GW`}
          sub="Operating projects tracked"
        />
        <KPICard
          label="Total Projects Tracked"
          value={String(summary.total_projects_tracked ?? projects.length)}
          sub="All statuses incl. pipeline"
        />
        <KPICard
          label="Avg Storage Hours"
          value={`${summary.avg_storage_hours ?? '—'} h`}
          sub="Across projects with storage"
        />
        <KPICard
          label="Avg LCOE 2024"
          value={`$${avg2024Lcoe.toFixed(0)}/MWh`}
          sub="USD — across CSP technologies"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Chart 1: Global CSP Capacity by Country */}
        <ChartCard title="Global CSP Capacity by Country (Operating, MW)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={globalCapacityData} layout="vertical" margin={{ left: 60, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis dataKey="country" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} width={70} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#fbbf24' }}
              />
              <Bar dataKey="capacity_mw" name="Capacity (MW)" fill={COLOURS.parabolic} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Cost Trajectory 2020-2027 */}
        <ChartCard title="LCOE Cost Trajectory 2020–2027 (USD/MWh)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={costTrajectory} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" USD" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {['Parabolic Trough', 'Power Tower', 'Linear Fresnel'].map(tech => (
                <Line
                  key={tech}
                  type="monotone"
                  dataKey={tech}
                  stroke={TECH_COLOURS[tech]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={tech}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Storage Technology Comparison */}
        <ChartCard title="Storage Technology Comparison — Efficiency vs Cost (USD/kWh)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={storageComparisonData} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="medium" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[80, 100]} unit="%" />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="avg_efficiency" name="Round-trip Efficiency (%)" fill={COLOURS.powerTower} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="avg_cost" name="Avg Storage Cost (USD/kWh)" fill={COLOURS.fresnel} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Australian Resource Map */}
        <ChartCard title="Australian CSP Resource Potential by Location (GW)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={auResources} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="location" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-30} textAnchor="end" interval={0} height={55} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" GW" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(val: number, _name: string, props: { payload?: { state?: string } }) => [
                  `${val} GW`,
                  props.payload?.state ?? '',
                ]}
              />
              <Bar dataKey="csp_potential_gw" name="CSP Potential (GW)" fill={COLOURS.hybrid} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Dispatchability Value (2024) */}
        <ChartCard title="Dispatchability Value vs Storage Hours (2024, NEM regions)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dispatchSorted} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" AUD" />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="avg_dispatch_price"
                name="Avg Dispatch Price (AUD/MWh)"
                stroke={COLOURS.parabolic}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue_premium"
                name="Revenue Premium vs PV (%)"
                stroke={COLOURS.powerTower}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 6: Project Pipeline stacked by status × technology */}
        <ChartCard title="CSP Project Pipeline — Capacity by Status and Technology (MW)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineData} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="status" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {pipelineTechs.map(tech => (
                <Bar
                  key={tech}
                  dataKey={tech}
                  name={tech}
                  stackId="a"
                  fill={TECH_COLOURS[tech] ?? '#6b7280'}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* Technology table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">CSP Technology Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 text-gray-400">Technology</th>
                <th className="text-right py-2 pr-4 text-gray-400">Efficiency (%)</th>
                <th className="text-right py-2 pr-4 text-gray-400">Temp (°C)</th>
                <th className="text-right py-2 pr-4 text-gray-400">Max Storage (h)</th>
                <th className="text-right py-2 pr-4 text-gray-400">Capacity Factor (%)</th>
                <th className="text-right py-2 pr-4 text-gray-400">TRL</th>
                <th className="text-right py-2 text-gray-400">1st Commercial</th>
              </tr>
            </thead>
            <tbody>
              {technologies.map((t, idx) => (
                <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-1.5 pr-4" style={{ color: TECH_COLOURS[t.technology] ?? '#9ca3af' }}>
                    {t.technology}
                  </td>
                  <td className="text-right py-1.5 pr-4">{t.efficiency_solar_to_electric_pct}</td>
                  <td className="text-right py-1.5 pr-4">{t.operating_temp_c}</td>
                  <td className="text-right py-1.5 pr-4">{t.storage_capable ? t.max_storage_hours : '—'}</td>
                  <td className="text-right py-1.5 pr-4">{t.capacity_factor_pct}</td>
                  <td className="text-right py-1.5 pr-4">{t.trl}</td>
                  <td className="text-right py-1.5">{t.first_commercial_year}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
