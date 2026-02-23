import { useEffect, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
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
  ComposedChart,
} from 'recharts'
import {
  getEnergyRetailerMarginDashboard,
  ERMADashboard,
} from '../api/client'

const RETAILER_COLORS: Record<string, string> = {
  'AGL':              '#6366f1',
  'Origin Energy':    '#f59e0b',
  'EnergyAustralia':  '#22c55e',
  'Red Energy':       '#ef4444',
  'Alinta':           '#06b6d4',
  'Simply Energy':    '#a855f7',
  '1st Energy':       '#f97316',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#6366f1',
  QLD1: '#f59e0b',
  VIC1: '#22c55e',
  SA1:  '#ef4444',
  TAS1: '#06b6d4',
}

const COMPONENT_COLORS: Record<string, string> = {
  'Wholesale Energy': '#6366f1',
  'Network Charges':  '#f59e0b',
  'Metering':         '#22c55e',
  'Green Costs':      '#10b981',
  'Retail Ops':       '#f97316',
  'Margin':           '#a855f7',
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function EnergyRetailerMarginAnalytics() {
  const [data, setData] = useState<ERMADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyRetailerMarginDashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <ShoppingCart size={24} className="mr-2 animate-pulse" />
        Loading Energy Retailer Margin Analytics...
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

  const summary = data.summary as Record<string, string | number>

  // --- Chart 1: Stacked bar — dollar_per_mwh by region for each component ---
  const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const COMPONENTS = [
    'Wholesale Energy', 'Network Charges', 'Metering',
    'Green Costs', 'Retail Ops', 'Margin',
  ]
  const chart1Data = REGIONS.map((region) => {
    const row: Record<string, string | number> = { region }
    COMPONENTS.forEach((comp) => {
      const rec = data.margin_components.find(
        (m) => m.region === region && m.component === comp
      )
      row[comp] = rec ? rec.dollar_per_mwh : 0
    })
    return row
  })

  // --- Chart 2: Horizontal bar — margin_per_mwh by retailer sorted desc (top 12) ---
  const retailerMarginMap: Record<string, number[]> = {}
  data.retailers.forEach((r) => {
    if (!retailerMarginMap[r.retailer_name]) retailerMarginMap[r.retailer_name] = []
    retailerMarginMap[r.retailer_name].push(r.margin_per_mwh)
  })
  const chart2Data = Object.entries(retailerMarginMap)
    .map(([retailer, vals]) => ({
      retailer,
      avg_margin: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
    }))
    .sort((a, b) => b.avg_margin - a.avg_margin)
    .slice(0, 12)

  // --- Chart 3: Line — gross_margin_m by quarter for 4 retailers ---
  const MAJOR = ['AGL', 'Origin Energy', 'EnergyAustralia', 'Red Energy']
  const quarterSet = Array.from(new Set(data.trends.map((t) => t.quarter))).sort()
  const chart3Data = quarterSet.map((quarter) => {
    const row: Record<string, string | number> = { quarter }
    MAJOR.forEach((retailer) => {
      const rec = data.trends.find(
        (t) => t.quarter === quarter && t.retailer === retailer
      )
      row[retailer] = rec ? rec.gross_margin_m : 0
    })
    return row
  })

  // --- Chart 4: Composed bar+line — switching_rate_pct and hhi_index by region ---
  const chart4Data = REGIONS.map((region) => {
    const rec = data.competition.find((c) => c.region === region)
    return {
      region,
      switching_rate_pct: rec ? rec.switching_rate_pct : 0,
      hhi_index: rec ? rec.hhi_index : 0,
    }
  })

  // --- Chart 5: Line — price_gap_pct by year for 5 regions ---
  const years = Array.from(new Set(data.regulated_vs_market.map((r) => r.year))).sort()
  const chart5Data = years.map((year) => {
    const row: Record<string, string | number> = { year }
    REGIONS.forEach((region) => {
      const rec = data.regulated_vs_market.find(
        (r) => r.year === year && r.region === region
      )
      row[region] = rec ? rec.price_gap_pct : 0
    })
    return row
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShoppingCart size={28} className="text-indigo-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Energy Retailer Margin Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Retailer margins, competition metrics, and regulated vs market price comparison
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Best Margin Retailer"
          value={String(summary.best_margin_retailer ?? '—')}
          sub="highest avg margin/MWh"
        />
        <KpiCard
          label="Avg Margin / MWh"
          value={`$${Number(summary.avg_margin_per_mwh ?? 0).toFixed(2)}`}
          sub="across all retailers & regions"
        />
        <KpiCard
          label="Avg Churn Rate"
          value={`${Number(summary.avg_churn_rate_pct ?? 0).toFixed(2)}%`}
          sub="customer churn p.a."
        />
        <KpiCard
          label="Total Market Customers"
          value={`${Number(summary.total_market_customers_m ?? 0).toFixed(3)}M`}
          sub={`Most competitive: ${String(summary.most_competitive_region ?? '—')}`}
        />
      </div>

      {/* Chart 1: Stacked bar — dollar_per_mwh components by region */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Bill Component Breakdown by Region (AGL, $/MWh)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart1Data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="region" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit="$" />
            <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
            <Legend />
            {COMPONENTS.map((comp) => (
              <Bar key={comp} dataKey={comp} stackId="a" fill={COMPONENT_COLORS[comp]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Horizontal bar — margin_per_mwh by retailer */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Avg Margin / MWh by Retailer (Sorted Descending)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chart2Data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 12 }} unit="$" />
            <YAxis dataKey="retailer" type="category" tick={{ fontSize: 11 }} width={95} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(2)}/MWh`} />
            <Bar dataKey="avg_margin" name="Avg Margin/MWh" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Line — gross_margin_m by quarter for 4 retailers */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Gross Margin Trend by Quarter ($M) — Major Retailers
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart3Data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="quarter" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 12 }} unit="M" />
            <Tooltip formatter={(v: number) => `$${v.toFixed(1)}M`} />
            <Legend />
            {MAJOR.map((retailer) => (
              <Line
                key={retailer}
                type="monotone"
                dataKey={retailer}
                stroke={RETAILER_COLORS[retailer]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Composed — switching_rate_pct (bar) + hhi_index (line) by region */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Switching Rate vs HHI Index by Region (Dual Axis)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chart4Data} margin={{ top: 10, right: 40, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="region" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              unit="%"
              domain={[0, 35]}
              label={{ value: 'Switching Rate %', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              domain={[0, 4000]}
              label={{ value: 'HHI Index', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 11 } }}
            />
            <Tooltip />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="switching_rate_pct"
              name="Switching Rate %"
              fill="#22c55e"
              opacity={0.8}
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="hhi_index"
              name="HHI Index"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Line — price_gap_pct by year for 5 regions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Market Offer vs Regulated Price Gap (%) by Year
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart5Data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit="%" />
            <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
            <Legend />
            {REGIONS.map((region) => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLORS[region]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary DL Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Market Summary
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Best Margin Retailer</dt>
            <dd className="text-sm font-medium text-gray-900 dark:text-white">
              {String(summary.best_margin_retailer ?? '—')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Avg Margin / MWh</dt>
            <dd className="text-sm font-medium text-gray-900 dark:text-white">
              ${Number(summary.avg_margin_per_mwh ?? 0).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Avg Churn Rate</dt>
            <dd className="text-sm font-medium text-gray-900 dark:text-white">
              {Number(summary.avg_churn_rate_pct ?? 0).toFixed(2)}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Most Competitive Region</dt>
            <dd className="text-sm font-medium text-gray-900 dark:text-white">
              {String(summary.most_competitive_region ?? '—')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Total Market Customers</dt>
            <dd className="text-sm font-medium text-gray-900 dark:text-white">
              {Number(summary.total_market_customers_m ?? 0).toFixed(3)}M
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Retailers Tracked</dt>
            <dd className="text-sm font-medium text-gray-900 dark:text-white">
              {data.retailers.length} records (7 retailers × 5 regions)
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
