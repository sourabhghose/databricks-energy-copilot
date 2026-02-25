import { useEffect, useState } from 'react'
import { TrendingDown, DollarSign, Activity, Zap } from 'lucide-react'
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
import { getDemandCurvePriceAnchorDashboard } from '../api/client'
import type { DCPAdashboard } from '../api/client'

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

const SECTOR_COLOURS: Record<string, string> = {
  Residential:  '#3b82f6',
  Commercial:   '#f59e0b',
  Industrial:   '#ef4444',
  Agricultural: '#10b981',
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
export default function DemandCurvePriceAnchorAnalytics() {
  const [data, setData] = useState<DCPAdashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDemandCurvePriceAnchorDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Demand Curve Price Anchor Analytics...</p>
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

  const { demand, price_anchors, elasticity, forecasts, summary } = data

  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const sectors = ['Residential', 'Commercial', 'Industrial', 'Agricultural']

  // Chart 1: Monthly peak demand trend by region (2024, months 1-4)
  const peakDemandTrend = [1, 2, 3, 4].map(mo => {
    const row: Record<string, string | number> = { month: `M${mo}` }
    for (const region of regions) {
      const rec = demand.find(r => r.year === 2024 && r.month === mo && r.region === region)
      row[region] = rec ? Math.round(rec.peak_demand_mw) : 0
    }
    return row
  })

  // Chart 2: VWAP vs TWA price by region (2024 Q4, grouped bar)
  const vwapVsTwa = regions.map(region => {
    const rec = price_anchors.find(r => r.year === 2024 && r.quarter === 'Q4' && r.region === region)
    return {
      region,
      vwap_mwh: rec ? Math.round(rec.vwap_mwh * 100) / 100 : 0,
      twa_price_mwh: rec ? Math.round(rec.twa_price_mwh * 100) / 100 : 0,
    }
  })

  // Chart 3: Price elasticity by sector (absolute values, averaged across regions and years)
  const elasticityBySector = sectors.map(sector => {
    const recs = elasticity.filter(r => r.sector === sector)
    const avgAbs =
      recs.length > 0
        ? Math.round((recs.reduce((s, r) => s + Math.abs(r.price_elasticity), 0) / recs.length) * 10000) / 10000
        : 0
    return { sector, abs_elasticity: avgAbs }
  })

  // Chart 4: Forecast vs actual demand by region (2024 Q1, grouped bar)
  const forecastVsActual = regions.map(region => {
    const rec = forecasts.find(r => r.year === 2024 && r.quarter === 'Q1' && r.region === region)
    return {
      region,
      forecast_demand_mw: rec ? Math.round(rec.forecast_demand_mw) : 0,
      actual_demand_mw: rec ? Math.round(rec.actual_demand_mw) : 0,
    }
  })

  // Chart 5: Price anchor trend by region (quarterly 2024)
  const priceAnchorTrend = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
    const row: Record<string, string | number> = { quarter: q }
    for (const region of regions) {
      const rec = price_anchors.find(r => r.year === 2024 && r.quarter === q && r.region === region)
      row[region] = rec ? Math.round(rec.price_anchor_mwh * 100) / 100 : 0
    }
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-purple-600 border-b border-purple-700 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-purple-800 rounded-lg">
          <TrendingDown size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Demand Curve Price Anchor Analytics</h1>
          <p className="text-xs text-purple-200">DCPA — Demand curves, price anchors, elasticity &amp; forecasting accuracy</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Avg Peak Demand MW"
            value={`${summary.avg_peak_demand_mw.toLocaleString()} MW`}
            sub="All regions &amp; years"
            icon={Zap}
            color="bg-purple-600"
          />
          <KpiCard
            title="Avg Price Anchor"
            value={`$${summary.avg_price_anchor_mwh.toFixed(2)}/MWh`}
            sub="All regions &amp; years"
            icon={DollarSign}
            color="bg-blue-600"
          />
          <KpiCard
            title="Most Elastic Region"
            value={summary.most_elastic_region}
            sub="Lowest mean price elasticity"
            icon={TrendingDown}
            color="bg-emerald-600"
          />
          <KpiCard
            title="Total Demand Response MW"
            value={`${Math.round(summary.total_demand_response_mw).toLocaleString()} MW`}
            sub="Cumulative all records"
            icon={Activity}
            color="bg-yellow-600"
          />
        </div>

        {/* Chart 1: Monthly peak demand trend by region (line, 2024 months 1-4) */}
        <ChartCard title="Monthly Peak Demand Trend by Region — 2024 (Months 1–4, MW)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={peakDemandTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" width={70} />
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
                  stroke={REGION_COLOURS[region]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: VWAP vs TWA price by region (grouped bar, 2024 Q4) */}
        <ChartCard title="VWAP vs TWA Price by Region — 2024 Q4 ($/MWh)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={vwapVsTwa} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="$" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="vwap_mwh" name="VWAP ($/MWh)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="twa_price_mwh" name="TWA Price ($/MWh)" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Price elasticity by sector (bar, absolute values) */}
        <ChartCard title="Price Elasticity by Sector — Absolute Value (averaged across regions &amp; years)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={elasticityBySector} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="abs_elasticity" name="Abs Price Elasticity" radius={[4, 4, 0, 0]}>
                {elasticityBySector.map(entry => (
                  <rect key={entry.sector} fill={SECTOR_COLOURS[entry.sector] ?? '#6b7280'} />
                ))}
                {elasticityBySector.map((entry, index) => (
                  <Bar
                    key={`bar-${index}`}
                    dataKey="abs_elasticity"
                    fill={SECTOR_COLOURS[entry.sector] ?? '#6b7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Forecast vs actual demand by region (grouped bar, 2024 Q1) */}
        <ChartCard title="Forecast vs Actual Demand by Region — 2024 Q1 (MW)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={forecastVsActual} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" width={70} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="forecast_demand_mw" name="Forecast (MW)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual_demand_mw" name="Actual (MW)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Price anchor trend by region (line, quarterly 2024) */}
        <ChartCard title="Price Anchor Trend by Region — Quarterly 2024 ($/MWh)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={priceAnchorTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="$" width={60} />
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
                  stroke={REGION_COLOURS[region]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
