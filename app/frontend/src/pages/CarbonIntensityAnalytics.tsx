import { useEffect, useState } from 'react'
import { Leaf } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { getCarbonIntensityDashboard, CarbonIntensityDashboard } from '../api/client'

const REGION_COLORS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#a78bfa',
  QLD: '#f97316',
  SA:  '#34d399',
  TAS: '#fbbf24',
}

const TECH_CATEGORY_COLORS: Record<string, string> = {
  RENEWABLE:   '#34d399',
  STORAGE:     '#60a5fa',
  LOW_CARBON:  '#fbbf24',
  FOSSIL:      '#f87171',
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

export default function CarbonIntensityAnalytics() {
  const [data, setData] = useState<CarbonIntensityDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCarbonIntensityDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading carbon intensity data...</div>
  if (error)   return <div className="flex items-center justify-center h-64 text-red-400">Error: {error}</div>
  if (!data)   return null

  // --- KPI calculations ---
  const latestMonth = data.grid_intensity.reduce((m, r) => (r.month > m ? r.month : m), '')
  const latestRecords = data.grid_intensity.filter(r => r.month === latestMonth)
  const lowestRegion = latestRecords.reduce((a, b) => (a.avg_intensity_kgco2_mwh < b.avg_intensity_kgco2_mwh ? a : b))
  const avgZeroCarbon = latestRecords.length > 0
    ? (latestRecords.reduce((s, r) => s + r.zero_carbon_hours_pct, 0) / latestRecords.length).toFixed(1)
    : '0'
  const totalEmissionsMt = (latestRecords.reduce((s, r) => s + r.total_emissions_kt_co2, 0) / 1000).toFixed(2)
  const latestDecarb = data.decarbonisation.filter(r => r.year === 2024)
  const onTrackCount = latestDecarb.filter(r => r.on_track).length

  // --- Grid intensity trend chart data: pivot by month ---
  const months = [...new Set(data.grid_intensity.map(r => r.month))]
  const gridTrendData = months.map(m => {
    const row: Record<string, string | number> = { month: m }
    data.grid_intensity.filter(r => r.month === m).forEach(r => {
      row[r.region] = r.avg_intensity_kgco2_mwh
    })
    return row
  })

  // --- MEF by hour chart: NSW only ---
  const nswMef = data.marginal_emissions
    .filter(r => r.region === 'NSW')
    .sort((a, b) => a.hour - b.hour)

  // --- Technology emissions sorted cleanest to dirtiest ---
  const sortedTech = [...data.technology_emissions].sort(
    (a, b) => a.lifecycle_kgco2_mwh - b.lifecycle_kgco2_mwh,
  )

  // --- Decarbonisation table: 2024 data ---
  const decarb2024 = data.decarbonisation.filter(r => r.year === 2024).sort(
    (a, b) => a.intensity_kgco2_mwh - b.intensity_kgco2_mwh,
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-600 rounded-lg">
          <Leaf className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Carbon Intensity Analytics</h1>
          <p className="text-sm text-gray-400">
            Grid emissions intensity, marginal emission factors, Scope 2 tracking &amp; decarbonisation progress
          </p>
        </div>
        <span className="ml-auto text-xs text-gray-500">
          Updated: {new Date(data.timestamp).toLocaleString('en-AU')}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Lowest Regional Intensity"
          value={`${lowestRegion.avg_intensity_kgco2_mwh} kgCO₂/MWh`}
          sub={`${lowestRegion.region} — ${latestMonth}`}
        />
        <KpiCard
          label="Avg Zero-Carbon Hours"
          value={`${avgZeroCarbon}%`}
          sub={`Across all regions (${latestMonth})`}
        />
        <KpiCard
          label="National Total Emissions"
          value={`${totalEmissionsMt} Mt CO₂`}
          sub={`All regions — ${latestMonth}`}
        />
        <KpiCard
          label="Regions On Track"
          value={`${onTrackCount} / ${latestDecarb.length}`}
          sub="Meeting 2024 decarbonisation trajectory"
        />
      </div>

      {/* Grid Intensity Trend */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Grid Intensity Trend by Region (kgCO₂/MWh)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={gridTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" kg" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            {['NSW', 'VIC', 'QLD', 'SA', 'TAS'].map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLORS[region]}
                strokeWidth={2}
                dot={{ r: 3 }}
                name={region}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2">
          SA and TAS typically show the lowest intensity due to high VRE and hydro penetration.
        </p>
      </div>

      {/* Marginal Emission Factor by Hour */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Marginal Emission Factor by Hour — NSW (kgCO₂/MWh)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={nswMef} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="hour"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={h => `${String(h).padStart(2, '0')}:00`}
              label={{ value: 'Hour of Day', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" kg" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelFormatter={h => `Hour: ${String(h).padStart(2, '0')}:00`}
              formatter={(v: number, _name: string, props) => [
                `${v} kgCO₂/MWh (${props.payload?.marginal_technology ?? ''})`,
                'MEF',
              ]}
            />
            <ReferenceLine y={300} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'Low-carbon threshold', fill: '#fbbf24', fontSize: 10 }} />
            <Bar dataKey="marginal_emission_factor_kgco2_mwh" name="MEF (kgCO₂/MWh)" radius={[3, 3, 0, 0]}>
              {nswMef.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={entry.marginal_emission_factor_kgco2_mwh < 300 ? '#34d399' : entry.marginal_emission_factor_kgco2_mwh < 600 ? '#fbbf24' : '#f87171'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2">
          High overnight MEF (coal marginal) vs. low midday MEF (solar marginal). Green &lt;300, amber 300–600, red &gt;600 kgCO₂/MWh.
        </p>
      </div>

      {/* Technology Lifecycle Emissions */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Technology Lifecycle Emissions — Cleanest to Dirtiest (kgCO₂/MWh)
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={sortedTech}
            layout="vertical"
            margin={{ top: 5, right: 20, bottom: 5, left: 140 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" kg" />
            <YAxis type="category" dataKey="technology" tick={{ fill: '#d1d5db', fontSize: 12 }} width={140} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number, name: string) => [`${v} kgCO₂/MWh`, name]}
            />
            <Legend />
            <Bar dataKey="lifecycle_kgco2_mwh" name="Lifecycle" radius={[0, 3, 3, 0]}>
              {sortedTech.map((entry, idx) => (
                <Cell key={`tech-${idx}`} fill={TECH_CATEGORY_COLORS[entry.category] ?? '#60a5fa'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 flex-wrap">
          {Object.entries(TECH_CATEGORY_COLORS).map(([cat, color]) => (
            <span key={cat} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              {cat.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>

      {/* Decarbonisation Progress Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Decarbonisation Progress — 2024 (Regions vs. Trajectory)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="pb-2 pr-4">Region</th>
                <th className="pb-2 pr-4 text-right">Actual Intensity</th>
                <th className="pb-2 pr-4 text-right">Target Intensity</th>
                <th className="pb-2 pr-4 text-right">Target Year</th>
                <th className="pb-2 pr-4 text-right">VRE %</th>
                <th className="pb-2 pr-4 text-right">Coal %</th>
                <th className="pb-2 pr-4 text-right">Emissions (Mt)</th>
                <th className="pb-2 text-center">On Track</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {decarb2024.map(row => (
                <tr key={row.region} className="hover:bg-gray-750">
                  <td className="py-2 pr-4 font-semibold">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: REGION_COLORS[row.region] ?? '#9ca3af' }}
                    />
                    {row.region}
                  </td>
                  <td className="py-2 pr-4 text-right text-white font-mono">
                    {row.intensity_kgco2_mwh.toFixed(0)} <span className="text-gray-400 text-xs">kg</span>
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300 font-mono">
                    {row.target_intensity_kgco2_mwh.toFixed(0)} <span className="text-gray-400 text-xs">kg</span>
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-400">{row.target_year}</td>
                  <td className="py-2 pr-4 text-right text-green-400">{row.vre_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-right text-red-400">{row.coal_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{row.emissions_mt_co2.toFixed(2)}</td>
                  <td className="py-2 text-center">
                    {row.on_track ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-900 text-green-300 text-xs font-medium">
                        On Track
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-900 text-red-300 text-xs font-medium">
                        Off Track
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          On-track assessment based on linear trajectory from 2021 baseline to target year. VRE = Variable Renewable Energy.
        </p>
      </div>
    </div>
  )
}
