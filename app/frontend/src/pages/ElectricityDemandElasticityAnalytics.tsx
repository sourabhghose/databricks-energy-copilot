import { useEffect, useState } from 'react'
import { TrendingDown } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getElectricityDemandElasticityDashboard,
  EDEADashboard,
} from '../api/client'

// ── Colour palette ────────────────────────────────────────────────────────
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#34d399',
  VIC1: '#f472b6',
  SA1:  '#fb923c',
  TAS1: '#a78bfa',
}
const SECTOR_COLOURS: Record<string, string> = {
  Residential:  '#60a5fa',
  Commercial:   '#34d399',
  Industrial:   '#fb923c',
  Agricultural: '#a78bfa',
}

// ── KPI card ─────────────────────────────────────────────────────────────
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
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function ElectricityDemandElasticityAnalytics() {
  const [data, setData] = useState<EDEADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityDemandElasticityDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Electricity Demand Elasticity Analytics...
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

  const { summary, elasticity_estimates, tou_penetration, segment_responses, price_response_events, elasticity_trends } = data

  // ── Chart 1: grouped bar — price_elasticity by region × sector ──────────
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const sectors = ['Residential', 'Commercial', 'Industrial', 'Agricultural']

  const chart1Data = regions.map((reg) => {
    const row: Record<string, string | number> = { region: reg }
    sectors.forEach((sec) => {
      const est = elasticity_estimates.find((e) => e.region === reg && e.sector === sec)
      row[sec] = est ? est.price_elasticity : 0
    })
    return row
  })

  // ── Chart 2: line — tou_customers_pct by year per region ─────────────────
  const years2 = [2020, 2021, 2022, 2023, 2024]
  const chart2Data = years2.map((yr) => {
    const row: Record<string, string | number> = { year: String(yr) }
    regions.forEach((reg) => {
      const entry = tou_penetration.find((t) => t.region === reg && t.year === yr)
      row[reg] = entry ? entry.tou_customers_pct : 0
    })
    return row
  })

  // ── Chart 3: bar — avg price_sensitivity_score by segment ─────────────────
  const segments = [
    'Large Industrial (>160MWh/yr)',
    'Small Business',
    'Residential Flat',
    'Residential TOU',
    'Residential EV',
  ]
  const chart3Data = segments.map((seg) => {
    const rows = segment_responses.filter((s) => s.segment === seg)
    const avg =
      rows.length > 0
        ? parseFloat((rows.reduce((a, b) => a + b.price_sensitivity_score, 0) / rows.length).toFixed(2))
        : 0
    return { segment: seg.replace('Large Industrial (>160MWh/yr)', 'Large Indust.'), score: avg }
  })

  // ── Chart 4: scatter — price_change_pct vs demand_response_pct ────────────
  const chart4Data = price_response_events.map((ev) => ({
    x: ev.price_change_pct,
    y: ev.demand_response_pct,
    sector: ev.sector,
  }))

  // ── Chart 5: line — price_elasticity trend by year for Residential & Industrial ─
  const years5 = [2018, 2019, 2020, 2021, 2022, 2023, 2024]
  const chart5Data = years5.map((yr) => {
    const resRows = elasticity_trends.filter((t) => t.year === yr && t.sector === 'Residential')
    const indRows = elasticity_trends.filter((t) => t.year === yr && t.sector === 'Industrial')
    const avgRes =
      resRows.length > 0
        ? parseFloat((resRows.reduce((a, b) => a + b.price_elasticity, 0) / resRows.length).toFixed(3))
        : 0
    const avgInd =
      indRows.length > 0
        ? parseFloat((indRows.reduce((a, b) => a + b.price_elasticity, 0) / indRows.length).toFixed(3))
        : 0
    return { year: String(yr), Residential: avgRes, Industrial: avgInd }
  })

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingDown className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Electricity Demand Elasticity Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Price responsiveness, TOU penetration, and demand response potential across the NEM
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Avg Residential Elasticity"
          value={summary.avg_residential_elasticity}
          sub="Own-price (avg across regions)"
        />
        <KpiCard
          label="Avg Industrial Elasticity"
          value={summary.avg_industrial_elasticity}
          sub="Own-price (avg across regions)"
        />
        <KpiCard
          label="Total DR Potential"
          value={summary.total_dr_potential_mw.toLocaleString()}
          unit="MW"
          sub="All segments & regions"
        />
        <KpiCard
          label="TOU Penetration"
          value={summary.tou_penetration_pct}
          unit="%"
          sub="TOU customers 2024 (avg)"
        />
        <KpiCard
          label="Most Price-Sensitive Region"
          value={summary.most_price_sensitive_region}
          sub="Highest avg sensitivity score"
        />
      </div>

      {/* Chart 1: Price Elasticity by Region x Sector */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">
          Price Elasticity by Region and Sector
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart1Data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {sectors.map((sec) => (
              <Bar key={sec} dataKey={sec} fill={SECTOR_COLOURS[sec]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: TOU Penetration by Year per Region */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">
          TOU Customer Penetration by Year and Region (%)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart2Data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {regions.map((reg) => (
              <Line
                key={reg}
                type="monotone"
                dataKey={reg}
                stroke={REGION_COLOURS[reg]}
                strokeWidth={2}
                dot={{ r: 4, fill: REGION_COLOURS[reg] }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Price Sensitivity Score by Segment */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">
          Price Sensitivity Score by Segment (avg across regions, 0–10)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chart3Data}
            layout="vertical"
            margin={{ top: 8, right: 32, left: 16, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis type="number" domain={[0, 10]} tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              dataKey="segment"
              type="category"
              width={130}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
              {chart3Data.map((_, idx) => (
                <Cell key={idx} fill={['#60a5fa', '#34d399', '#fb923c', '#a78bfa', '#f472b6'][idx % 5]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Scatter — Price Change vs Demand Response */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">
          Price Change (%) vs Demand Response (%) — 35 Events (coloured by sector)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="x"
              name="Price Change %"
              type="number"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'Price Change (%)', position: 'insideBottom', offset: -4, fill: '#9ca3af', fontSize: 12 }}
            />
            <YAxis
              dataKey="y"
              name="Demand Response %"
              type="number"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'Demand Response (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(value: number, name: string) => [value.toFixed(2), name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {sectors.map((sec) => (
              <Scatter
                key={sec}
                name={sec}
                data={chart4Data.filter((d) => d.sector === sec)}
                fill={SECTOR_COLOURS[sec]}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Elasticity Trend by Year */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">
          Price Elasticity Trend by Year — Residential vs Industrial (avg across regions)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart5Data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="Residential"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={{ r: 4, fill: '#60a5fa' }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="Industrial"
              stroke="#fb923c"
              strokeWidth={2}
              dot={{ r: 4, fill: '#fb923c' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">Dashboard Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Avg Residential Elasticity</dt>
            <dd className="text-lg font-bold text-blue-400 mt-1">{summary.avg_residential_elasticity}</dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Avg Industrial Elasticity</dt>
            <dd className="text-lg font-bold text-orange-400 mt-1">{summary.avg_industrial_elasticity}</dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Total DR Potential (MW)</dt>
            <dd className="text-lg font-bold text-green-400 mt-1">{summary.total_dr_potential_mw.toLocaleString()}</dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">TOU Penetration 2024</dt>
            <dd className="text-lg font-bold text-purple-400 mt-1">{summary.tou_penetration_pct}%</dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Most Price-Sensitive Region</dt>
            <dd className="text-lg font-bold text-pink-400 mt-1">{summary.most_price_sensitive_region}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
