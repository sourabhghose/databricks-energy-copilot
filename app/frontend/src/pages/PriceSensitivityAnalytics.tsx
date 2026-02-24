import { useEffect, useState } from 'react'
import { TrendingUp, DollarSign, AlertTriangle, Activity, Zap } from 'lucide-react'
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
import { getPriceSensitivityDashboard } from '../api/client'
import type { EPSADashboard } from '../api/client'

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
// Chart section wrapper
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
// Colour palettes
// ---------------------------------------------------------------------------

const DRIVER_COLORS: Record<string, string> = {
  'Gas Price': '#f59e0b',
  'Carbon Price': '#34d399',
  'Renewable Penetration': '#22d3ee',
  'Demand Growth': '#ef4444',
  'Hydro Availability': '#60a5fa',
  'Coal Availability': '#a78bfa',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#22d3ee',
  QLD1: '#f59e0b',
  VIC1: '#34d399',
  SA1: '#ef4444',
  TAS1: '#a78bfa',
}

const SCENARIO_COLORS: Record<string, string> = {
  'High Gas': '#ef4444',
  'Low Carbon': '#34d399',
  'High Renewables': '#22d3ee',
  'Demand Surge': '#f59e0b',
  BAU: '#a78bfa',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PriceSensitivityAnalytics() {
  const [data, setData] = useState<EPSADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPriceSensitivityDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400 text-sm">
        Loading Price Sensitivity data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400 text-sm">
        Error loading data: {error}
      </div>
    )
  }

  const { sensitivity, scenarios, correlations, tail_risks, summary } = data

  // ── Chart 1: Grouped bar – sensitivity_low / base / sensitivity_high by driver (NSW1, 2024) ──
  const chart1Data = sensitivity
    .filter((r) => r.region === 'NSW1' && r.year === 2024)
    .map((r) => ({
      driver: r.driver,
      Low: r.sensitivity_low_mwh,
      Base: r.base_price_mwh,
      High: r.sensitivity_high_mwh,
    }))

  // ── Chart 2: Scenario avg_price_mwh by scenario coloured by region (2024) ──
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const scenarioNames = ['High Gas', 'Low Carbon', 'High Renewables', 'Demand Surge', 'BAU']
  const chart2Data = scenarioNames.map((sc) => {
    const point: Record<string, string | number> = { scenario: sc }
    for (const reg of regions) {
      const rec = scenarios.find((r) => r.scenario_name === sc && r.region === reg && r.year === 2024)
      if (rec) point[reg] = rec.avg_price_mwh
    }
    return point
  })

  // ── Chart 3: Horizontal bar – correlation by variable_a (NSW1, sorted by abs value) ──
  const nsw1Corr = correlations
    .filter((r) => r.region === 'NSW1')
    .sort((a, b) => Math.abs(b.correlation_coefficient) - Math.abs(a.correlation_coefficient))
  const chart3Data = nsw1Corr.map((r) => ({
    variable: r.variable_a,
    correlation: r.correlation_coefficient,
    abs: Math.abs(r.correlation_coefficient),
  }))

  // ── Chart 4: Line – VaR_95 and CVaR_95 trend 2022-2024 by region ──
  const years = [2022, 2023, 2024]
  const varTrendData = years.map((yr) => {
    const point: Record<string, string | number> = { year: yr }
    for (const reg of regions) {
      const rec = tail_risks.find((r) => r.region === reg && r.year === yr)
      if (rec) {
        point[`${reg}_VaR`] = rec.var_95_mwh
        point[`${reg}_CVaR`] = rec.cvar_95_mwh
      }
    }
    return point
  })

  // ── Chart 5: Bar – Scenario peak_price_mwh by region (2024, all scenarios averaged) ──
  const chart5Data = regions.map((reg) => {
    const recs = scenarios.filter((r) => r.region === reg && r.year === 2024)
    const avgPeak = recs.length
      ? recs.reduce((sum, r) => sum + r.peak_price_mwh, 0) / recs.length
      : 0
    return { region: reg, avg_peak_price: Math.round(avgPeak * 100) / 100 }
  })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingUp size={28} className="text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Electricity Price Sensitivity Analysis</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            EPSA — Driver elasticity, scenario pricing, correlations and tail risk (NEM regions)
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Most Sensitive Region"
          value={summary.most_sensitive_region}
          sub="Largest avg price delta"
          icon={Activity}
          color="bg-amber-500"
        />
        <KpiCard
          title="Highest Elasticity Driver"
          value={summary.highest_elasticity_driver}
          sub="Avg |elasticity| across regions"
          icon={TrendingUp}
          color="bg-cyan-600"
        />
        <KpiCard
          title="Avg Base Price"
          value={`$${summary.avg_base_price_mwh.toFixed(2)}/MWh`}
          sub="All regions & years"
          icon={DollarSign}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Max Tail Risk (CVaR 95)"
          value={`$${summary.max_tail_risk_mwh.toFixed(0)}/MWh`}
          sub="Worst conditional VaR across all regions"
          icon={AlertTriangle}
          color="bg-red-600"
        />
      </div>

      {/* Charts — row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Grouped bar – sensitivity range by driver */}
        <ChartCard title="Price Sensitivity Range by Driver — NSW1, 2024 ($/MWh)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart1Data} margin={{ top: 8, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="driver"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', fontSize: 12 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }} />
              <Bar dataKey="Low" name="Sensitivity Low" fill="#60a5fa" />
              <Bar dataKey="Base" name="Base Price" fill="#f59e0b" />
              <Bar dataKey="High" name="Sensitivity High" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Scenario avg price by scenario, coloured by region */}
        <ChartCard title="Scenario Avg Price by Scenario — 2024 ($/MWh)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart2Data} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="scenario" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', fontSize: 12 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {regions.map((reg) => (
                <Bar key={reg} dataKey={reg} fill={REGION_COLORS[reg]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts — row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Horizontal bar – correlation by variable_a (NSW1) */}
        <ChartCard title="Price Correlation Coefficients — NSW1 (sorted by |r|)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              layout="vertical"
              data={chart3Data}
              margin={{ top: 8, right: 30, left: 130, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                domain={[-1, 1]}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="variable"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                width={120}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', fontSize: 12 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(val: number) => val.toFixed(3)}
              />
              <Bar dataKey="correlation" name="Correlation Coefficient">
                {chart3Data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.correlation >= 0 ? '#22d3ee' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Line – VaR_95 trend by region (2022-2024) */}
        <ChartCard title="VaR 95 Trend by Region — 2022–2024 ($/MWh)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={varTrendData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', fontSize: 12 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
              {regions.map((reg) => (
                <Line
                  key={`${reg}_VaR`}
                  type="monotone"
                  dataKey={`${reg}_VaR`}
                  name={`${reg} VaR95`}
                  stroke={REGION_COLORS[reg]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
              {regions.map((reg) => (
                <Line
                  key={`${reg}_CVaR`}
                  type="monotone"
                  dataKey={`${reg}_CVaR`}
                  name={`${reg} CVaR95`}
                  stroke={REGION_COLORS[reg]}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Chart 5: Scenario peak price by region (full width) */}
      <ChartCard title="Avg Scenario Peak Price by Region — 2024, All Scenarios Averaged ($/MWh)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chart5Data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', fontSize: 12 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(val: number) => [`$${val.toFixed(2)}/MWh`, 'Avg Peak Price']}
            />
            <Bar dataKey="avg_peak_price" name="Avg Peak Price ($/MWh)" radius={[4, 4, 0, 0]}>
              {chart5Data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={REGION_COLORS[entry.region] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Footer note */}
      <p className="text-xs text-gray-600 text-right">
        EPSA — Seed 15403 · NEM regions 2022–2024 · Sprint 154c
      </p>
    </div>
  )
}
