import { useEffect, useState } from 'react'
import { Battery, Zap, Clock, Award } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import { getEnergyStorageDurationXDashboard } from '../api/client'
import type { ESDAxDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------
const TECH_COLOURS: Record<string, string> = {
  'Li-Ion': '#3b82f6',
  'Flow Battery': '#10b981',
  'Pumped Hydro': '#6366f1',
  'Compressed Air': '#f59e0b',
  'Thermal': '#ef4444',
}

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#10b981',
  SA1: '#ef4444',
  TAS1: '#6366f1',
}

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
// Chart Card wrapper
// ---------------------------------------------------------------------------
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function EnergyStorageDurationXAnalytics() {
  const [data, setData] = useState<ESDAxDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEnergyStorageDurationXDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Storage Duration Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const { sites, operational, revenue, tech_trends, summary } = data

  // Chart 1: Energy capacity MWh by site — top 12, sorted desc, coloured by tech
  const sitesByEnergy = [...sites]
    .sort((a, b) => b.energy_capacity_mwh - a.energy_capacity_mwh)
    .slice(0, 12)
    .map(s => ({ name: s.site_name.replace(/ Storage \d$/, ''), mwh: s.energy_capacity_mwh, tech: s.technology }))

  // Chart 2: Revenue streams by quarter (2024)
  const quarterRevenue = (['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
    const recs = revenue.filter(r => r.quarter === q)
    return {
      quarter: q,
      Arbitrage: parseFloat((recs.reduce((s, r) => s + r.energy_arbitrage_m_aud, 0)).toFixed(2)),
      FCAS: parseFloat((recs.reduce((s, r) => s + r.fcas_revenue_m_aud, 0)).toFixed(2)),
      Capacity: parseFloat((recs.reduce((s, r) => s + r.capacity_market_m_aud, 0)).toFixed(2)),
    }
  })

  // Chart 3: Avg cost per kWh trend by technology (2021-2024)
  const costTrendByYear: Record<number, Record<string, number>> = {}
  for (const tt of tech_trends) {
    if (!costTrendByYear[tt.year]) costTrendByYear[tt.year] = { year: tt.year }
    costTrendByYear[tt.year][tt.technology] = tt.avg_cost_per_kwh
  }
  const costTrend = Object.values(costTrendByYear).sort((a, b) => (a.year as number) - (b.year as number))

  // Chart 4: Stacked bar — capacity factor % by region per year (2022-2024)
  const regionYearCF: Record<string, Record<number, number[]>> = {}
  for (const region of ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']) {
    regionYearCF[region] = {}
    for (const yr of [2022, 2023, 2024]) regionYearCF[region][yr] = []
  }
  for (const op of operational) {
    const site = sites.find(s => s.site_id === op.site_id)
    if (site && regionYearCF[site.region] && regionYearCF[site.region][op.year] !== undefined) {
      regionYearCF[site.region][op.year].push(op.capacity_factor_pct)
    }
  }
  const cfByRegion = [2022, 2023, 2024].map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    for (const region of ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']) {
      const vals = regionYearCF[region][yr]
      row[region] = vals.length > 0 ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : 0
    }
    return row
  })

  // Chart 5: Round-trip efficiency % by technology (averaged)
  const rteByTech: Record<string, number[]> = {}
  for (const op of operational) {
    const site = sites.find(s => s.site_id === op.site_id)
    if (site) {
      if (!rteByTech[site.technology]) rteByTech[site.technology] = []
      rteByTech[site.technology].push(op.round_trip_efficiency_pct)
    }
  }
  const rteChart = Object.entries(rteByTech).map(([tech, vals]) => ({
    technology: tech,
    rte: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)),
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Battery size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Energy Storage Duration Analytics</h1>
          <p className="text-xs text-gray-400">Sprint 159a — Storage site performance, revenue and technology trends</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Sites"
            value={String(summary.total_sites)}
            sub="Registered storage assets"
            icon={Battery}
            color="bg-blue-600"
          />
          <KpiCard
            title="Total Capacity"
            value={`${summary.total_capacity_mw.toLocaleString()} MW`}
            sub={`${summary.total_energy_capacity_mwh.toLocaleString()} MWh total energy`}
            icon={Zap}
            color="bg-emerald-600"
          />
          <KpiCard
            title="Avg Duration"
            value={`${summary.avg_duration_hours} h`}
            sub="Average across all sites"
            icon={Clock}
            color="bg-indigo-600"
          />
          <KpiCard
            title="Top Technology"
            value={summary.top_technology}
            sub="Most deployed technology"
            icon={Award}
            color="bg-amber-600"
          />
        </div>

        {/* Chart 1: Energy capacity by site */}
        <ChartCard title="Energy Capacity (MWh) by Site — Top 12">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sitesByEnergy} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} unit=" MWh" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="mwh" name="Energy (MWh)" radius={[3, 3, 0, 0]}>
                {sitesByEnergy.map((entry, idx) => (
                  <Cell key={idx} fill={TECH_COLOURS[entry.tech] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Revenue streams by quarter */}
        <ChartCard title="Revenue Streams by Quarter — 2024 (M AUD)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={quarterRevenue} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" M" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Bar dataKey="Arbitrage" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="FCAS" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Capacity" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Cost per kWh trend by technology */}
        <ChartCard title="Avg Cost per kWh Trend by Technology (AUD/kWh, 2021-2024)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={costTrend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" AUD" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              {Object.keys(TECH_COLOURS).map(tech => (
                <Line
                  key={tech}
                  type="monotone"
                  dataKey={tech}
                  stroke={TECH_COLOURS[tech]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Stacked — capacity factor by region per year */}
        <ChartCard title="Avg Capacity Factor % by Region per Year (2022-2024)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cfByRegion} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              {['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].map(region => (
                <Bar key={region} dataKey={region} stackId="a" fill={REGION_COLOURS[region]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Round-trip efficiency by technology */}
        <ChartCard title="Round-Trip Efficiency % by Technology (All Sites Average)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rteChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="technology" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="rte" name="Round-Trip Efficiency (%)" radius={[3, 3, 0, 0]}>
                {rteChart.map((entry, idx) => (
                  <Cell key={idx} fill={TECH_COLOURS[entry.technology] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
