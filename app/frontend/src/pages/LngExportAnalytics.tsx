import { useEffect, useState } from 'react'
import { Ship } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getLngExportDashboard,
  LNGADashboard,
} from '../api/client'

const STATE_COLORS: Record<string, string> = {
  WA:  '#3b82f6',
  QLD: '#22c55e',
  NT:  '#f59e0b',
}

const CONTRACT_COLORS: Record<string, string> = {
  'Long-term':  '#3b82f6',
  'Spot':       '#f59e0b',
  'Short-term': '#a855f7',
}

const PRICE_COLORS: Record<string, string> = {
  jcc_price_usd:              '#3b82f6',
  jkm_price_usd:              '#22c55e',
  nbp_price_usd:              '#f59e0b',
  henry_hub_price_usd:        '#ef4444',
}

const CI_HIGH   = '#ef4444'
const CI_MEDIUM = '#f59e0b'
const CI_LOW    = '#22c55e'

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function LngExportAnalytics() {
  const [data, setData] = useState<LNGADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLngExportDashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Ship size={24} className="mr-2 animate-pulse" />
        Loading LNG Export Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="p-6 text-red-500">
        Error: {error ?? 'No data returned'}
      </div>
    )
  }

  const s = data.summary

  // Chart 1: Project capacity by name, coloured by state
  const capacityChartData = data.projects.map(p => ({
    name: p.project_name.length > 22 ? p.project_name.slice(0, 22) + '\u2026' : p.project_name,
    capacity_mtpa: p.capacity_mtpa,
    state: p.state,
  }))

  // Chart 2: Monthly production trend 2024 — top 5 projects by plateau_production_mtpa
  const top5 = [...data.projects]
    .sort((a, b) => b.plateau_production_mtpa - a.plateau_production_mtpa)
    .slice(0, 5)
  const top5Ids = new Set(top5.map(p => p.project_id))
  const top5Names: Record<string, string> = Object.fromEntries(
    top5.map(p => [p.project_id, p.project_name.split(' ').slice(0, 2).join(' ')])
  )
  const monthlyProd: Record<number, Record<string, number>> = {}
  for (const pr of data.production) {
    if (!top5Ids.has(pr.project_id)) continue
    if (!monthlyProd[pr.month]) monthlyProd[pr.month] = { month: pr.month }
    monthlyProd[pr.month][top5Names[pr.project_id]] = parseFloat(pr.production_mt.toFixed(3))
  }
  const prodLineData = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    ...(monthlyProd[i + 1] ?? {}),
  }))
  const top5NamesList = top5.map(p => top5Names[p.project_id])
  const lineColors = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444']

  // Chart 3: Export destination volume 2024 — top 15, coloured by contract_type
  const destChartData = [...data.export_destinations]
    .sort((a, b) => b.volume_mt_2024 - a.volume_mt_2024)
    .slice(0, 15)
    .map(d => ({
      country: d.destination_country,
      volume_mt_2024: d.volume_mt_2024,
      contract_type: d.contract_type,
    }))

  // Chart 4: Price trend 2021-2024 monthly (4 lines)
  const priceLineData = data.prices.map(p => ({
    label: `${p.year}-${String(p.month).padStart(2, '0')}`,
    jcc_price_usd: p.jcc_price_usd,
    jkm_price_usd: p.jkm_price_usd,
    nbp_price_usd: p.nbp_price_usd,
    henry_hub_price_usd: p.henry_hub_price_usd,
  }))

  // Chart 5: Scope1 emissions 2024 by project, coloured by carbon_intensity
  const emissions2024 = data.emissions.filter(e => e.year === 2024)
  const emissionsMap: Record<string, { scope1: number; ci: number }> = {}
  for (const e of emissions2024) {
    emissionsMap[e.project_id] = {
      scope1: e.scope1_co2e_mt,
      ci: e.carbon_intensity_kgco2e_per_mj,
    }
  }
  const ciThresholdHigh = 0.075
  const ciThresholdMed  = 0.065
  const emissionsChartData = data.projects.map(p => ({
    name: p.project_name.split(' ').slice(0, 2).join(' '),
    scope1_co2e_mt: emissionsMap[p.project_id]?.scope1 ?? 0,
    carbon_intensity: emissionsMap[p.project_id]?.ci ?? 0,
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Ship size={28} className="text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            LNG Export Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Australian LNG export industry — projects, production, destinations, pricing &amp; emissions
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Capacity"
          value={`${s.total_capacity_mtpa.toFixed(1)} Mtpa`}
          sub="Across all projects"
        />
        <KpiCard
          label="Total Production 2024"
          value={`${s.total_production_2024_mt.toFixed(1)} Mt`}
          sub="Annual production"
        />
        <KpiCard
          label="Export Revenue"
          value={`$${s.total_export_revenue_b_usd.toFixed(1)}B USD`}
          sub="2024 estimated"
        />
        <KpiCard
          label="Avg Utilisation"
          value={`${s.avg_utilisation_pct.toFixed(1)}%`}
          sub={`Top customer: ${s.top_customer_country}`}
        />
      </div>

      {/* Chart 1: Project capacity coloured by state */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Project Capacity (Mtpa) by State
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={capacityChartData}
            margin={{ top: 4, right: 16, left: 0, bottom: 90 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis unit=" Mt" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)} Mtpa`, 'Capacity']} />
            <Bar dataKey="capacity_mtpa" name="Capacity (Mtpa)">
              {capacityChartData.map((d, i) => (
                <Cell key={i} fill={STATE_COLORS[d.state] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(STATE_COLORS).map(([st, c]) => (
            <span key={st} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
              {st}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Monthly production trend 2024 — top 5 projects */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Monthly Production (Mt) — Top 5 Projects, 2024
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={prodLineData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} label={{ value: 'Month', position: 'insideBottom', offset: -2, fontSize: 11 }} />
            <YAxis unit=" Mt" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(3)} Mt`]} />
            <Legend />
            {top5NamesList.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={lineColors[i]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Export destination volume 2024 — top 15, coloured by contract_type */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Export Destination Volume 2024 (Mt) — Top 15 Countries
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={destChartData}
            margin={{ top: 4, right: 16, left: 0, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="country" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis unit=" Mt" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)} Mt`, 'Volume 2024']} />
            <Bar dataKey="volume_mt_2024" name="Volume 2024 (Mt)">
              {destChartData.map((d, i) => (
                <Cell key={i} fill={CONTRACT_COLORS[d.contract_type] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(CONTRACT_COLORS).map(([ct, c]) => (
            <span key={ct} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
              {ct}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 4: LNG Price Indices 2021-2024 (4 lines) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          LNG Price Indices (USD/MMBtu) — JCC, JKM, NBP, Henry Hub 2021–2024
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={priceLineData} margin={{ top: 4, right: 16, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9 }}
              angle={-45}
              textAnchor="end"
              interval={5}
            />
            <YAxis unit=" $" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}/MMBtu`]} />
            <Legend />
            {(Object.keys(PRICE_COLORS) as (keyof typeof PRICE_COLORS)[]).map(key => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={PRICE_COLORS[key]}
                dot={false}
                strokeWidth={2}
                name={key.replace(/_price_usd$/, '').replace(/_/g, ' ').toUpperCase()}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Scope1 emissions 2024 by project, coloured by carbon intensity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Scope 1 Emissions 2024 (MtCO2e) by Project — Coloured by Carbon Intensity
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={emissionsChartData}
            margin={{ top: 4, right: 16, left: 0, bottom: 70 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis unit=" Mt" tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number, _name: string, props: { payload?: { carbon_intensity?: number } }) => [
                `${v.toFixed(3)} MtCO2e (CI: ${(props.payload?.carbon_intensity ?? 0).toFixed(4)} kg/MJ)`,
                'Scope 1',
              ]}
            />
            <Bar dataKey="scope1_co2e_mt" name="Scope 1 (MtCO2e)">
              {emissionsChartData.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    d.carbon_intensity >= ciThresholdHigh
                      ? CI_HIGH
                      : d.carbon_intensity >= ciThresholdMed
                      ? CI_MEDIUM
                      : CI_LOW
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: CI_HIGH }} />
            High CI (&ge;0.075)
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: CI_MEDIUM }} />
            Medium CI (0.065–0.075)
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: CI_LOW }} />
            Low CI (&lt;0.065)
          </span>
        </div>
      </div>

      {/* Summary table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Industry Summary
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(s) as [string, string | number][]).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {k.replace(/_/g, ' ')}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 dark:text-white">
                {typeof v === 'number'
                  ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
