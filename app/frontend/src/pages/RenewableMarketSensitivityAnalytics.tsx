import { useEffect, useState } from 'react'
import { Sun, TrendingUp, MapPin, Zap, BarChart2 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts'
import { getRenewableMarketSensitivityDashboard } from '../api/client'
import type { REMSdashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#6366f1',
  SA1:  '#10b981',
  TAS1: '#8b5cf6',
}

const SCENARIO_COLOURS: Record<string, string> = {
  'High Renewable': '#10b981',
  'Low Renewable':  '#ef4444',
  'Base':           '#3b82f6',
  'Accelerated':    '#f59e0b',
  'Conservative':   '#8b5cf6',
}

const FACTOR_COLOURS: Record<string, string> = {
  'Solar Output':         '#f59e0b',
  'Wind Output':          '#06b6d4',
  'Demand':               '#ef4444',
  'Interconnector Flow':  '#8b5cf6',
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
export default function RenewableMarketSensitivityAnalytics() {
  const [data, setData] = useState<REMSdashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRenewableMarketSensitivityDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Renewable Market Sensitivity Analytics...</p>
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

  const { sensitivity, generation, price_correlation, scenarios, summary } = data

  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const sensitivityFactors = [
    'Renewable Penetration',
    'Weather Variability',
    'Grid Stability',
    'Demand Growth',
    'Storage Uptake',
  ]
  const corrFactors = ['Solar Output', 'Wind Output', 'Demand', 'Interconnector Flow']
  const scenarioNames = ['High Renewable', 'Low Renewable', 'Base', 'Accelerated', 'Conservative']

  // ---------------------------------------------------------------------------
  // Chart 1: Price impact % by sensitivity factor per region (2024 Q4, grouped bar)
  // ---------------------------------------------------------------------------
  const sensitivity2024Q4 = sensitivity.filter(s => s.year === 2024 && s.quarter === 'Q4')
  const priceImpactByFactor = sensitivityFactors.map(factor => {
    const row: Record<string, string | number> = { factor: factor.replace(' ', '\n') }
    for (const region of regions) {
      const rec = sensitivity2024Q4.find(
        s => s.sensitivity_factor === factor && s.region === region
      )
      row[region] = rec ? Math.round(rec.price_impact_pct * 100) / 100 : 0
    }
    return row
  })

  // ---------------------------------------------------------------------------
  // Chart 2: Monthly renewable penetration % trend by region (2024, line)
  // ---------------------------------------------------------------------------
  const gen2024 = generation.filter(g => g.year === 2024)
  const genMonths = [3, 6, 9, 12]
  const monthLabels: Record<number, string> = { 3: 'Mar', 6: 'Jun', 9: 'Sep', 12: 'Dec' }

  const penetrationTrend = genMonths.map(month => {
    const row: Record<string, string | number> = { month: monthLabels[month] }
    for (const region of regions) {
      const rec = gen2024.find(g => g.month === month && g.region === region)
      row[region] = rec ? Math.round(rec.renewable_penetration_pct * 100) / 100 : 0
    }
    return row
  })

  // ---------------------------------------------------------------------------
  // Chart 3: Price correlation coefficient by factor per region (2024, grouped bar)
  // Absolute values with colour coding per factor
  // ---------------------------------------------------------------------------
  const corr2024 = price_correlation.filter(c => c.year === 2024)
  const corrByRegion = regions.map(region => {
    const row: Record<string, string | number> = { region }
    for (const factor of corrFactors) {
      const rec = corr2024.find(c => c.region === region && c.factor === factor)
      row[factor] = rec ? Math.round(Math.abs(rec.correlation_coefficient) * 1000) / 1000 : 0
    }
    return row
  })

  // ---------------------------------------------------------------------------
  // Chart 4: Avg price by scenario (2024, all regions averaged, bar)
  // ---------------------------------------------------------------------------
  const scenarios2024 = scenarios.filter(s => s.year === 2024)
  const avgPriceByScenario = scenarioNames.map(scenario => {
    const recs = scenarios2024.filter(s => s.scenario === scenario)
    const avg = recs.length > 0
      ? Math.round((recs.reduce((sum, s) => sum + s.avg_price_mwh, 0) / recs.length) * 100) / 100
      : 0
    return { scenario, avg_price_mwh: avg }
  })

  // ---------------------------------------------------------------------------
  // Chart 5: Renewable share % by scenario trend (2022-2024 averaged across regions, line)
  // ---------------------------------------------------------------------------
  const scenarioYears = [2022, 2023, 2024]
  const reShareTrend = scenarioYears.map(yr => {
    const row: Record<string, string | number> = { year: String(yr) }
    for (const scenario of scenarioNames) {
      const recs = scenarios.filter(s => s.year === yr && s.scenario === scenario)
      const avg = recs.length > 0
        ? Math.round((recs.reduce((sum, s) => sum + s.renewable_share_pct, 0) / recs.length) * 100) / 100
        : 0
      row[scenario] = avg
    }
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-yellow-600 border-b border-yellow-700 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-yellow-800 rounded-lg">
          <Sun size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">
            Renewable Energy Market Sensitivity Analytics
          </h1>
          <p className="text-xs text-yellow-200">
            Sensitivity Factors, Generation Mix, Price Correlations & Scenario Analysis — NEM Regions
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Avg Renewable Penetration"
            value={`${summary.avg_renewable_penetration_pct.toFixed(1)}%`}
            sub="All regions & years"
            icon={Sun}
            color="bg-yellow-600"
          />
          <KpiCard
            title="Highest Penetration Region"
            value={summary.highest_penetration_region}
            sub="Avg penetration leader"
            icon={MapPin}
            color="bg-green-600"
          />
          <KpiCard
            title="Most Sensitive Factor"
            value={summary.most_sensitive_factor}
            sub="Highest avg price impact"
            icon={TrendingUp}
            color="bg-blue-600"
          />
          <KpiCard
            title="Total Renewable MW 2024"
            value={`${(summary.total_renewable_mw_2024 / 1000).toFixed(1)}k MW`}
            sub="Sum across sampled months"
            icon={Zap}
            color="bg-purple-600"
          />
        </div>

        {/* Chart 1: Price impact % by sensitivity factor per region (2024 Q4, grouped) */}
        <ChartCard title="Price Impact % by Sensitivity Factor per Region — 2024 Q4 (grouped)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={priceImpactByFactor}
              margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="factor"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {regions.map(region => (
                <Bar
                  key={region}
                  dataKey={region}
                  name={region}
                  fill={REGION_COLOURS[region]}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Monthly renewable penetration % trend by region (2024, line) */}
        <ChartCard title="Monthly Renewable Penetration % Trend by Region — 2024">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={penetrationTrend}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {regions.map(region => (
                <Line
                  key={region}
                  type="monotone"
                  dataKey={region}
                  name={region}
                  stroke={REGION_COLOURS[region]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Price correlation coefficient (absolute) by factor per region (2024) */}
        <ChartCard title="Price Correlation Coefficient (|r|) by Factor per Region — 2024 (grouped)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={corrByRegion} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} domain={[0, 1]} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {corrFactors.map(factor => (
                <Bar
                  key={factor}
                  dataKey={factor}
                  name={factor}
                  fill={FACTOR_COLOURS[factor]}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Avg price by scenario (2024, all regions averaged) */}
        <ChartCard title="Avg Wholesale Price ($/MWh) by Scenario — 2024 (all regions averaged)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={avgPriceByScenario}
              margin={{ top: 5, right: 20, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="scenario"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-20}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $/MWh" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Bar
                dataKey="avg_price_mwh"
                name="Avg Price ($/MWh)"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Renewable share % by scenario trend (2022-2024, line) */}
        <ChartCard title="Renewable Share % by Scenario — 2022 to 2024 (averaged across regions)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={reShareTrend}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {scenarioNames.map(scenario => (
                <Line
                  key={scenario}
                  type="monotone"
                  dataKey={scenario}
                  name={scenario}
                  stroke={SCENARIO_COLOURS[scenario]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
