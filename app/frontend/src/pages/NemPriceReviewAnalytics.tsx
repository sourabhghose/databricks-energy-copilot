import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, MapPin, AlertTriangle } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getNemPriceReviewDashboard } from '../api/client'
import type { NEPRdashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#10b981',
  VIC1: '#f59e0b',
  SA1:  '#ef4444',
  TAS1: '#8b5cf6',
}

const DRIVER_COLOURS = {
  wholesale:     '#3b82f6',
  network:       '#10b981',
  environmental: '#84cc16',
  retail_margin: '#f59e0b',
  other:         '#6b7280',
}

const STATE_COLOURS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#10b981',
  QLD: '#f59e0b',
  SA:  '#ef4444',
  WA:  '#8b5cf6',
  TAS: '#06b6d4',
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
        <p className="text-xl font-bold text-white leading-tight">{value}</p>
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
export default function NemPriceReviewAnalytics() {
  const [data, setData] = useState<NEPRdashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNemPriceReviewDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading NEM Price Review Analytics...</p>
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

  const { spot_prices, retail_prices, price_drivers, affordability, summary } = data

  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS']

  // ---------------------------------------------------------------------------
  // Chart 1: Line — Monthly avg spot price by region (2024, months 1–4)
  // ---------------------------------------------------------------------------
  const spotMonthlyChart = [1, 2, 3, 4].map(month => {
    const row: Record<string, string | number> = { month: `M${month}` }
    for (const region of regions) {
      const rec = spot_prices.find(r => r.region === region && r.year === 2024 && r.month === month)
      row[region] = rec ? parseFloat(rec.avg_spot_price_mwh.toFixed(2)) : 0
    }
    return row
  })

  // ---------------------------------------------------------------------------
  // Chart 2: Bar (grouped) — Avg residential vs SME retail price by state (2024)
  // ---------------------------------------------------------------------------
  const retailStateChart = states.map(state => {
    const recs2024 = retail_prices.filter(r => r.state === state && r.year === 2024)
    const count = recs2024.length || 1
    return {
      state,
      Residential: parseFloat((recs2024.reduce((s, r) => s + r.avg_residential_c_kwh, 0) / count).toFixed(2)),
      SME: parseFloat((recs2024.reduce((s, r) => s + r.avg_sme_c_kwh, 0) / count).toFixed(2)),
    }
  })

  // ---------------------------------------------------------------------------
  // Chart 3: Bar (stacked) — Price components by region (2024 Q4)
  // ---------------------------------------------------------------------------
  const priceComponentChart = regions.map(region => {
    const rec = price_drivers.find(r => r.region === region && r.year === 2024 && r.quarter === 'Q4')
    return {
      region,
      Wholesale:     rec ? parseFloat(rec.wholesale_component_pct.toFixed(1)) : 0,
      Network:       rec ? parseFloat(rec.network_component_pct.toFixed(1)) : 0,
      Environmental: rec ? parseFloat(rec.environmental_component_pct.toFixed(1)) : 0,
      'Retail Margin': rec ? parseFloat(rec.retail_margin_pct.toFixed(1)) : 0,
      Other:         rec ? parseFloat(rec.other_pct.toFixed(1)) : 0,
    }
  })

  // ---------------------------------------------------------------------------
  // Chart 4: Bar — Avg household bill by state (2024)
  // ---------------------------------------------------------------------------
  const billChart = states.map(state => {
    const rec = affordability.find(r => r.state === state && r.year === 2024)
    return {
      state,
      Bill: rec ? parseFloat(rec.avg_household_bill_aud.toFixed(0)) : 0,
    }
  })

  // ---------------------------------------------------------------------------
  // Chart 5: Line — Energy poverty % trend by state (2022–2024)
  // ---------------------------------------------------------------------------
  const povertyTrendChart = [2022, 2023, 2024].map(year => {
    const row: Record<string, string | number> = { year: String(year) }
    for (const state of states) {
      const rec = affordability.find(r => r.state === state && r.year === year)
      row[state] = rec ? parseFloat(rec.energy_poverty_pct.toFixed(2)) : 0
    }
    return row
  })

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' },
    labelStyle:   { color: '#e5e7eb' },
    itemStyle:    { color: '#9ca3af' },
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-amber-600 border-b border-amber-700 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-amber-700 rounded-lg">
          <DollarSign size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">NEM Price Review Analytics</h1>
          <p className="text-xs text-amber-100">Sprint 160b — Spot, retail price drivers and affordability across the NEM</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Avg Spot Price 2024"
            value={`$${summary.avg_spot_price_2024_mwh.toFixed(2)}/MWh`}
            sub="NEM-wide average across regions"
            icon={DollarSign}
            color="bg-amber-600"
          />
          <KpiCard
            title="Avg Retail Price 2024"
            value={`${summary.avg_retail_price_2024_c_kwh.toFixed(2)} c/kWh`}
            sub="Residential average across states"
            icon={TrendingUp}
            color="bg-blue-600"
          />
          <KpiCard
            title="Highest Price Region"
            value={summary.highest_price_region}
            sub="Highest avg spot price in 2024"
            icon={MapPin}
            color="bg-red-600"
          />
          <KpiCard
            title="Total Cap Price Events"
            value={String(summary.total_cap_price_events)}
            sub="Events above $5,000/MWh"
            icon={AlertTriangle}
            color="bg-orange-600"
          />
        </div>

        {/* Chart 1: Monthly avg spot price by region (2024) */}
        <ChartCard title="Monthly Avg Spot Price by Region — 2024 ($/MWh)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={spotMonthlyChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} unit=" $" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              {regions.map(region => (
                <Line
                  key={region}
                  type="monotone"
                  dataKey={region}
                  stroke={REGION_COLOURS[region] ?? '#9ca3af'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Avg residential vs SME retail price by state (2024) */}
        <ChartCard title="Avg Residential vs SME Retail Price by State — 2024 (c/kWh, Grouped)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={retailStateChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} unit=" c" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Bar dataKey="Residential" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="SME"         fill="#10b981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Price components by region (2024 Q4, stacked) */}
        <ChartCard title="Price Components by Region — 2024 Q4 (%, Stacked)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={priceComponentChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} unit="%" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
              <Bar dataKey="Wholesale"      stackId="a" fill={DRIVER_COLOURS.wholesale}     />
              <Bar dataKey="Network"        stackId="a" fill={DRIVER_COLOURS.network}        />
              <Bar dataKey="Environmental"  stackId="a" fill={DRIVER_COLOURS.environmental}  />
              <Bar dataKey="Retail Margin"  stackId="a" fill={DRIVER_COLOURS.retail_margin}  />
              <Bar dataKey="Other"          stackId="a" fill={DRIVER_COLOURS.other}          />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Avg household bill by state (2024) */}
        <ChartCard title="Avg Household Electricity Bill by State — 2024 (AUD/year)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={billChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} unit=" $" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Bar dataKey="Bill" name="Avg Household Bill (AUD)" radius={[3, 3, 0, 0]}>
                {billChart.map((entry, idx) => (
                  <rect key={idx} fill={STATE_COLOURS[entry.state] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Energy poverty % trend by state (2022–2024) */}
        <ChartCard title="Energy Poverty % Trend by State — 2022–2024">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={povertyTrendChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} unit="%" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              {states.map(state => (
                <Line
                  key={state}
                  type="monotone"
                  dataKey={state}
                  stroke={STATE_COLOURS[state] ?? '#9ca3af'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
