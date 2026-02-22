import { useEffect, useState } from 'react'
import { Leaf } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts'
import {
  getBiomassBioenergyDashboard,
  BIOEDashboard,
  BIOEPlantRecord,
  BIOEGenerationRecord,
} from '../api/client'

// ── Helpers ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1 shadow">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white text-2xl font-bold">
        {value}
        {unit && <span className="text-gray-400 text-base ml-1">{unit}</span>}
      </span>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function BiomassBioenergyAnalytics() {
  const [data, setData] = useState<BIOEDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBiomassBioenergyDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400">Error loading biomass data: {error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const { plants, generation_records, economics, biogas_projects, sustainability, summary } = data

  // ── Chart: Capacity by technology ─────────────────────────────────────────
  const techCapMap: Record<string, number> = {}
  plants.forEach((p) => {
    techCapMap[p.technology] = (techCapMap[p.technology] ?? 0) + p.capacity_mw
  })
  const techCapData = Object.entries(techCapMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, capacity_mw: Math.round(value * 10) / 10 }))

  // ── Chart: Scenario LCOE comparison ───────────────────────────────────────
  const scenarioMap: Record<string, { total: number; count: number }> = {}
  economics.forEach((e) => {
    if (!scenarioMap[e.scenario]) scenarioMap[e.scenario] = { total: 0, count: 0 }
    scenarioMap[e.scenario].total += e.lcoe_dolpermwh
    scenarioMap[e.scenario].count += 1
  })
  const scenarioData = Object.entries(scenarioMap).map(([scenario, v]) => ({
    scenario,
    avg_lcoe: Math.round((v.total / v.count) * 10) / 10,
  }))

  // ── Chart: Generation trend 2021-2024 ─────────────────────────────────────
  const yearMap: Record<number, { gen: number; cf_sum: number; cf_count: number }> = {}
  generation_records.forEach((g) => {
    if (!yearMap[g.year]) yearMap[g.year] = { gen: 0, cf_sum: 0, cf_count: 0 }
    yearMap[g.year].gen += g.generation_mwh
    yearMap[g.year].cf_sum += g.capacity_factor_pct
    yearMap[g.year].cf_count += 1
  })
  const trendData = Object.entries(yearMap)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([year, v]) => ({
      year,
      generation_gwh: Math.round(v.gen / 1000),
      avg_cf: Math.round((v.cf_sum / v.cf_count) * 10) / 10,
    }))

  // ── Chart: Sustainability — lifecycle CO2 vs coal reduction ───────────────
  const sustainData = sustainability.map((s) => {
    const plant = plants.find((p) => p.plant_id === s.plant_id)
    return {
      name: plant ? plant.plant_name.split(' ').slice(0, 2).join(' ') : s.plant_id,
      lifecycle_co2: s.lifecycle_co2_tco2_per_mwh,
      coal_reduction_pct: s.co2_vs_coal_reduction_pct,
    }
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Leaf className="text-green-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white">Biomass &amp; Bioenergy Analytics</h1>
          <p className="text-gray-400 text-sm">
            Australian biomass generation fleet, feedstock economics, biogas projects &amp; sustainability
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Total Biomass Capacity"
          value={String(summary['total_biomass_capacity_mw'] ?? '—')}
          unit="MW"
        />
        <KpiCard
          label="Annual Generation"
          value={String(summary['annual_generation_gwh'] ?? '—')}
          unit="GWh"
        />
        <KpiCard
          label="Avg Capacity Factor"
          value={String(summary['avg_capacity_factor_pct'] ?? '—')}
          unit="%"
        />
        <KpiCard
          label="CO2 Abatement"
          value={String(summary['total_co2_abatement_kt'] ?? '—')}
          unit="kt CO2"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Capacity by Technology */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-lg font-semibold mb-4 text-green-300">Capacity by Technology (MW)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={techCapData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" stroke="#9CA3AF" tick={{ fontSize: 11 }} width={145} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="capacity_mw" fill="#4ADE80" name="Capacity (MW)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scenario LCOE Comparison */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-lg font-semibold mb-4 text-green-300">Avg LCOE by Scenario ($/MWh)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={scenarioData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="scenario" stroke="#9CA3AF" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="avg_lcoe" fill="#34D399" name="Avg LCOE ($/MWh)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Generation Trend */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-lg font-semibold mb-4 text-green-300">Generation &amp; Capacity Factor Trend (2021-2024)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" stroke="#4ADE80" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#60A5FA" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="generation_gwh"
                stroke="#4ADE80"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Generation (GWh)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avg_cf"
                stroke="#60A5FA"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Avg CF (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sustainability */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-lg font-semibold mb-4 text-green-300">Sustainability: Lifecycle CO2 &amp; Coal Reduction</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sustainData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={55} />
              <YAxis yAxisId="left" stroke="#F87171" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#A78BFA" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="lifecycle_co2"
                fill="#F87171"
                name="Lifecycle CO2 (tCO2/MWh)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="coal_reduction_pct"
                fill="#A78BFA"
                name="vs Coal Reduction (%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Plant Overview Table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow mb-6">
        <h2 className="text-lg font-semibold mb-4 text-green-300">Plant Overview</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">Plant Name</th>
                <th className="pb-2 pr-4">Technology</th>
                <th className="pb-2 pr-4">State</th>
                <th className="pb-2 pr-4">Capacity (MW)</th>
                <th className="pb-2 pr-4">Gen (GWh)</th>
                <th className="pb-2 pr-4">CF (%)</th>
                <th className="pb-2 pr-4">Feedstock</th>
                <th className="pb-2 pr-4">LRET</th>
                <th className="pb-2 pr-4">Owner</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {plants.map((p: BIOEPlantRecord) => (
                <tr key={p.plant_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 text-white font-medium">{p.plant_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.technology}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.state}</td>
                  <td className="py-2 pr-4 text-green-400">{p.capacity_mw}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.annual_generation_gwh}</td>
                  <td className="py-2 pr-4 text-blue-300">{p.capacity_factor_pct}%</td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{p.feedstock_type}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        p.lret_accredited
                          ? 'bg-green-900 text-green-300'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {p.lret_accredited ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{p.owner}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        p.status === 'Operating'
                          ? 'bg-green-900 text-green-300'
                          : p.status === 'Construction'
                          ? 'bg-yellow-900 text-yellow-300'
                          : 'bg-blue-900 text-blue-300'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Biogas Projects Table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold mb-4 text-green-300">Biogas Projects</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">Project Name</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">State</th>
                <th className="pb-2 pr-4">Gas Prod. (m³/pa)</th>
                <th className="pb-2 pr-4">Elec. Cap. (kW)</th>
                <th className="pb-2 pr-4">Heat Cap. (kWth)</th>
                <th className="pb-2 pr-4">Carbon Credits (ACCUs)</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {biogas_projects.map((bg) => (
                <tr key={bg.biogas_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 text-white font-medium">{bg.project_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{bg.project_type}</td>
                  <td className="py-2 pr-4 text-gray-300">{bg.state}</td>
                  <td className="py-2 pr-4 text-green-400">{bg.gas_production_m3_pa.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-blue-300">{bg.electricity_capacity_kw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-gray-300">{bg.heat_capacity_kw_th.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-purple-300">{bg.carbon_credits_accu_pa.toLocaleString()}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        bg.status === 'Operating'
                          ? 'bg-green-900 text-green-300'
                          : bg.status === 'Construction'
                          ? 'bg-yellow-900 text-yellow-300'
                          : 'bg-blue-900 text-blue-300'
                      }`}
                    >
                      {bg.status}
                    </span>
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
