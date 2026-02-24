import { useEffect, useState } from 'react'
import { Cpu, Activity, DollarSign, Zap, BarChart2 } from 'lucide-react'
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
import { getDistributedAssetOptimisationDashboard } from '../api/client'
import type { DARODashboard } from '../api/client'

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
// Chart 1 — Bar: Aggregator total_capacity_mw sorted desc
// ---------------------------------------------------------------------------

const AGG_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#34d399', '#f97316', '#a78bfa', '#60a5fa', '#fb7185']

function AggregatorCapacityChart({ data }: { data: DARODashboard }) {
  const chartData = [...data.aggregators]
    .sort((a, b) => b.total_capacity_mw - a.total_capacity_mw)
    .map((agg, idx) => ({
      name: agg.aggregator_name.replace(' Power', '').replace(' Electric', '').replace(' Energy', ''),
      capacity: agg.total_capacity_mw,
      fill: AGG_COLORS[idx % AGG_COLORS.length],
    }))

  return (
    <ChartCard title="Aggregator Total Capacity MW (sorted descending)">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 110, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
          <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} width={105} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => [`${v.toFixed(1)} MW`, 'Capacity']}
          />
          <Bar dataKey="capacity" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 2 — Bar: Asset count by asset_type
// ---------------------------------------------------------------------------

const ASSET_TYPE_COLORS: Record<string, string> = {
  'Rooftop Solar': '#f59e0b',
  'Home Battery': '#6366f1',
  'EV': '#22d3ee',
  'Pool Pump': '#34d399',
  'HVAC': '#f97316',
  'Hot Water': '#fb7185',
}

function AssetTypeCountChart({ data }: { data: DARODashboard }) {
  const counts: Record<string, number> = {}
  for (const asset of data.assets) {
    counts[asset.asset_type] = (counts[asset.asset_type] ?? 0) + 1
  }

  const chartData = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type,
      count,
      fill: ASSET_TYPE_COLORS[type] ?? '#9ca3af',
    }))

  return (
    <ChartCard title="Asset Count by Asset Type">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="type"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 3 — Line: Quarterly available_flexibility_mw trend by region 2022-2024
// ---------------------------------------------------------------------------

const REGION_COLORS: Record<string, string> = {
  NSW1: '#6366f1',
  QLD1: '#f59e0b',
  VIC1: '#22d3ee',
  SA1: '#34d399',
}

function FlexibilityTrendChart({ data }: { data: DARODashboard }) {
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1']
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const years = [2022, 2023, 2024]

  const labels = years.flatMap(y => quarters.map(q => `${y} ${q}`))

  const chartData = labels.map(label => {
    const [yearStr, quarter] = label.split(' ')
    const year = parseInt(yearStr)
    const row: Record<string, string | number> = { period: `${year} ${quarter}` }
    for (const region of regions) {
      const rec = data.flexibility.find(
        f => f.region === region && f.year === year && f.quarter === quarter
      )
      row[region] = rec ? rec.available_flexibility_mw : 0
    }
    return row
  })

  return (
    <ChartCard title="Quarterly Available Flexibility MW by Region (2022–2024)">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="period"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            interval={2}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
          {regions.map(region => (
            <Line
              key={region}
              type="monotone"
              dataKey={region}
              stroke={REGION_COLORS[region]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 4 — Bar: Monthly total_dispatch_mwh by asset_type (2024, all regions)
// ---------------------------------------------------------------------------

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const ASSET_COLORS_STACKED: Record<string, string> = {
  'Rooftop Solar': '#f59e0b',
  'Home Battery': '#6366f1',
  'EV': '#22d3ee',
  'Pool Pump': '#34d399',
  'HVAC': '#f97316',
  'Hot Water': '#fb7185',
}

function MonthlyDispatchChart({ data }: { data: DARODashboard }) {
  const assetTypes = ['Rooftop Solar', 'Home Battery', 'EV', 'Pool Pump', 'HVAC', 'Hot Water']
  const months2024 = data.dispatch.filter(d => d.year === 2024)

  const uniqueMonths = Array.from(new Set(months2024.map(d => d.month))).sort((a, b) => a - b)

  const chartData = uniqueMonths.map(month => {
    const row: Record<string, string | number> = { month: MONTH_NAMES[month - 1] }
    for (const atype of assetTypes) {
      const total = months2024
        .filter(d => d.month === month && d.asset_type === atype)
        .reduce((sum, d) => sum + d.total_dispatch_mwh, 0)
      row[atype] = Math.round(total)
    }
    return row
  })

  return (
    <ChartCard title="Monthly Total Dispatch MWh by Asset Type (2024, All Regions)">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MWh" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {assetTypes.map(atype => (
            <Bar key={atype} dataKey={atype} stackId="a" fill={ASSET_COLORS_STACKED[atype]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 5 — Bar: Aggregator Revenue vs Avg Dispatch Response (two charts)
// ---------------------------------------------------------------------------

function AggregatorRevenueChart({ data }: { data: DARODashboard }) {
  const revenueData = [...data.aggregators]
    .sort((a, b) => b.annual_revenue_m_aud - a.annual_revenue_m_aud)
    .map((agg, idx) => ({
      name: agg.aggregator_name.replace(' Power', '').replace(' Electric', '').replace(' Energy', '').replace(' Locals', ''),
      revenue: agg.annual_revenue_m_aud,
      response_ms: agg.avg_dispatch_response_ms,
      fill: AGG_COLORS[idx % AGG_COLORS.length],
    }))

  return (
    <ChartCard title="Aggregator Annual Revenue (M AUD) vs Avg Dispatch Response (ms)">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-2 text-center">Annual Revenue (M AUD)</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueData} layout="vertical" margin={{ top: 0, right: 10, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={75} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`$${v.toFixed(1)}M`, 'Revenue']}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {revenueData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-2 text-center">Avg Dispatch Response (ms)</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueData} layout="vertical" margin={{ top: 0, right: 10, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" ms" />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={75} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`${v.toFixed(0)} ms`, 'Dispatch Response']}
              />
              <Bar dataKey="response_ms" radius={[0, 4, 4, 0]}>
                {revenueData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DistributedAssetOptimisationAnalytics() {
  const [data, setData] = useState<DARODashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDistributedAssetOptimisationDashboard()
      .then(setData)
      .catch(err => setError(err.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading DARO Analytics...</p>
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

  const { summary } = data

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-indigo-600">
          <Cpu size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Distributed Asset Resource Optimisation</h1>
          <p className="text-xs text-gray-400 mt-0.5">DARO Analytics — VPP aggregator performance, flexibility utilisation &amp; dispatch metrics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Total Assets"
          value={summary.total_assets.toLocaleString()}
          sub="enrolled DER assets"
          icon={Cpu}
          color="bg-indigo-600"
        />
        <KpiCard
          title="Total Capacity"
          value={`${summary.total_capacity_mw.toFixed(2)} MW`}
          sub="combined installed capacity"
          icon={Zap}
          color="bg-amber-600"
        />
        <KpiCard
          title="Avg Flexibility Score"
          value={`${summary.avg_flexibility_score.toFixed(1)}`}
          sub="out of 100"
          icon={Activity}
          color="bg-cyan-600"
        />
        <KpiCard
          title="Total Annual Revenue"
          value={`$${summary.total_annual_revenue_m_aud.toFixed(1)}M`}
          sub="aggregator combined AUD"
          icon={DollarSign}
          color="bg-emerald-600"
        />
      </div>

      {/* Charts — row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <AggregatorCapacityChart data={data} />
        <AssetTypeCountChart data={data} />
      </div>

      {/* Charts — row 2 */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        <FlexibilityTrendChart data={data} />
      </div>

      {/* Charts — row 3 */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        <MonthlyDispatchChart data={data} />
      </div>

      {/* Charts — row 4 */}
      <div className="grid grid-cols-1 gap-4">
        <AggregatorRevenueChart data={data} />
      </div>
    </div>
  )
}
