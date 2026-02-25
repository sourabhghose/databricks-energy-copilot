import { useEffect, useState } from 'react'
import { Zap, Users, TrendingUp, Activity } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getDRAADashboard } from '../api/client'
import type { DRAADashboard } from '../api/client'

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

const EVENT_TYPE_COLOURS: Record<string, string> = {
  RERT:            '#ef4444',
  WDRM:            '#3b82f6',
  NETWORK_SUPPORT: '#10b981',
  EMERGENCY:       '#f59e0b',
  VOLUNTARY:       '#8b5cf6',
}

const REVENUE_COLOURS: Record<string, string> = {
  FCAS:      '#3b82f6',
  WHOLESALE: '#f59e0b',
  NETWORK:   '#10b981',
  CAPACITY:  '#8b5cf6',
  RERT:      '#ef4444',
}

const TECH_COLOURS: Record<string, string> = {
  RESIDENTIAL_AC:     '#3b82f6',
  COMMERCIAL_HVAC:    '#f59e0b',
  INDUSTRIAL_PROCESS: '#ef4444',
  BATTERY:            '#10b981',
  POOL_PUMP:          '#8b5cf6',
  HOT_WATER:          '#ec4899',
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
    <div className="bg-gray-800 rounded-2xl p-6 flex items-start gap-4">
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
    <div className="bg-gray-800 rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Badge helper
// ---------------------------------------------------------------------------
function badge(label: string, colorMap: Record<string, string>) {
  const bg = colorMap[label] ?? '#6b7280'
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: bg }}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function DemandResponseAggregationAnalytics() {
  const [data, setData] = useState<DRAADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDRAADashboard()
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-red-400">Error: {error}</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading Demand Response analytics...</p>
      </div>
    )
  }

  // ---- derived data ----
  const totalPortfolioMw = data.aggregators.reduce((s, a) => s + a.portfolio_mw, 0)
  const totalCustomersK = data.aggregators.reduce((s, a) => s + a.customers_k, 0)
  const totalLoadReduced = data.events.reduce((s, e) => s + e.load_reduced_mw, 0)
  const totalRevenueM = data.revenue.reduce((s, r) => s + r.revenue_m_aud, 0)

  // Aggregator portfolio bar chart data
  const aggregatorBarData = data.aggregators
    .sort((a, b) => b.portfolio_mw - a.portfolio_mw)
    .map((a) => ({
      name: a.aggregator_name,
      portfolio_mw: a.portfolio_mw,
      customers_k: a.customers_k,
      success_pct: a.activation_success_pct,
    }))

  // Events by type for pie chart
  const eventTypeCounts: Record<string, number> = {}
  data.events.forEach((e) => {
    eventTypeCounts[e.event_type] = (eventTypeCounts[e.event_type] || 0) + 1
  })
  const eventPieData = Object.entries(eventTypeCounts).map(([name, value]) => ({ name, value }))

  // Seasonal activation rate by month (avg across regions)
  const monthlyMap: Record<number, { activated: number; available: number; count: number }> = {}
  data.seasonal.forEach((s) => {
    if (!monthlyMap[s.month]) monthlyMap[s.month] = { activated: 0, available: 0, count: 0 }
    monthlyMap[s.month].activated += s.activated_dr_mw
    monthlyMap[s.month].available += s.available_dr_mw
    monthlyMap[s.month].count += 1
  })
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const seasonalLineData = Object.entries(monthlyMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([m, v]) => ({
      month: monthNames[Number(m) - 1],
      activation_rate_pct: Math.round((v.activated / v.available) * 100 * 10) / 10,
      avg_available_mw: Math.round(v.available / v.count),
      avg_activated_mw: Math.round(v.activated / v.count),
    }))

  // Revenue by stream (stacked bar per aggregator)
  const revenueByAggregator: Record<string, Record<string, number>> = {}
  data.revenue.forEach((r) => {
    if (!revenueByAggregator[r.aggregator_name]) revenueByAggregator[r.aggregator_name] = {}
    revenueByAggregator[r.aggregator_name][r.revenue_stream] = r.revenue_m_aud
  })
  const revenueBarData = Object.entries(revenueByAggregator).map(([name, streams]) => ({
    name,
    ...streams,
  }))
  const revenueStreams = [...new Set(data.revenue.map((r) => r.revenue_stream))]

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Zap className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Demand Response Aggregation Analytics</h1>
          <p className="text-sm text-gray-400">
            Sprint 164c -- DR providers, RERT activations, WDRM, aggregator performance across the NEM
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total DR Portfolio"
          value={`${totalPortfolioMw.toFixed(0)} MW`}
          sub={`${data.aggregators.length} aggregators`}
          icon={Zap}
          color="bg-blue-600"
        />
        <KpiCard
          title="Enrolled Customers"
          value={`${totalCustomersK.toFixed(1)}k`}
          sub="Residential + C&I"
          icon={Users}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Total Load Curtailed"
          value={`${totalLoadReduced.toFixed(0)} MW`}
          sub={`${data.events.length} events (2024-25)`}
          icon={Activity}
          color="bg-amber-600"
        />
        <KpiCard
          title="Aggregator Revenue"
          value={`$${totalRevenueM.toFixed(1)}M`}
          sub="All revenue streams"
          icon={TrendingUp}
          color="bg-purple-600"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aggregator Portfolio */}
        <ChartCard title="Aggregator Portfolio Size (MW) & Activation Success (%)">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={aggregatorBarData} margin={{ top: 5, right: 20, bottom: 60, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" />
              <YAxis yAxisId="mw" tick={{ fill: '#9ca3af' }} />
              <YAxis yAxisId="pct" orientation="right" domain={[80, 100]} tick={{ fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }} />
              <Legend wrapperStyle={{ color: '#d1d5db' }} />
              <Bar yAxisId="mw" dataKey="portfolio_mw" fill="#3b82f6" name="Portfolio MW" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="pct" dataKey="success_pct" fill="#10b981" name="Activation %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Events by Type */}
        <ChartCard title="DR Events by Type">
          <ResponsiveContainer width="100%" height={340}>
            <PieChart>
              <Pie
                data={eventPieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {eventPieData.map((entry) => (
                  <Cell key={entry.name} fill={EVENT_TYPE_COLOURS[entry.name] ?? '#6b7280'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }} />
              <Legend wrapperStyle={{ color: '#d1d5db' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Seasonal Activation */}
        <ChartCard title="Monthly DR Activation Rate (%) -- All Regions Avg">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={seasonalLineData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af' }} />
              <YAxis tick={{ fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }} />
              <Legend wrapperStyle={{ color: '#d1d5db' }} />
              <Line type="monotone" dataKey="activation_rate_pct" stroke="#f59e0b" strokeWidth={2} name="Activation Rate %" dot />
              <Line type="monotone" dataKey="avg_available_mw" stroke="#3b82f6" strokeWidth={2} name="Avg Available MW" dot={false} />
              <Line type="monotone" dataKey="avg_activated_mw" stroke="#10b981" strokeWidth={2} name="Avg Activated MW" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue by Stream */}
        <ChartCard title="Revenue by Aggregator & Stream ($M AUD)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={revenueBarData} margin={{ top: 5, right: 20, bottom: 60, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }} />
              <Legend wrapperStyle={{ color: '#d1d5db' }} />
              {revenueStreams.map((stream) => (
                <Bar key={stream} dataKey={stream} stackId="a" fill={REVENUE_COLOURS[stream] ?? '#6b7280'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Aggregator Table */}
      <ChartCard title="Aggregator Performance Summary">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="py-2 px-3">Aggregator</th>
                <th className="py-2 px-3">Region</th>
                <th className="py-2 px-3 text-right">Portfolio (MW)</th>
                <th className="py-2 px-3 text-right">Customers (k)</th>
                <th className="py-2 px-3 text-right">Avg Response (min)</th>
                <th className="py-2 px-3 text-right">Success %</th>
                <th className="py-2 px-3 text-right">Revenue ($M)</th>
              </tr>
            </thead>
            <tbody>
              {data.aggregators
                .sort((a, b) => b.portfolio_mw - a.portfolio_mw)
                .map((a) => (
                  <tr key={`${a.aggregator_name}-${a.region}`} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 px-3 font-medium text-white">{a.aggregator_name}</td>
                    <td className="py-2 px-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: REGION_COLOURS[a.region] ?? '#6b7280' }}
                      >
                        {a.region}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-300">{a.portfolio_mw.toFixed(1)}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{a.customers_k.toFixed(1)}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{a.avg_response_time_min.toFixed(1)}</td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`font-semibold ${
                          a.activation_success_pct >= 95
                            ? 'text-emerald-400'
                            : a.activation_success_pct >= 90
                              ? 'text-amber-400'
                              : 'text-red-400'
                        }`}
                      >
                        {a.activation_success_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-300">${a.revenue_m_aud.toFixed(1)}M</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Events Table */}
      <ChartCard title="DR Events Log (2024-2025)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="py-2 px-3">Event ID</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Region</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Trigger</th>
                <th className="py-2 px-3 text-right">Duration (min)</th>
                <th className="py-2 px-3 text-right">Load Reduced (MW)</th>
                <th className="py-2 px-3 text-right">Participants (k)</th>
                <th className="py-2 px-3 text-right">Payment ($/MWh)</th>
                <th className="py-2 px-3 text-right">Peak Reduced %</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e) => (
                <tr key={e.event_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 px-3 font-mono text-xs text-gray-300">{e.event_id}</td>
                  <td className="py-2 px-3 text-gray-300">{e.date}</td>
                  <td className="py-2 px-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: REGION_COLOURS[e.region] ?? '#6b7280' }}
                    >
                      {e.region}
                    </span>
                  </td>
                  <td className="py-2 px-3">{badge(e.event_type, EVENT_TYPE_COLOURS)}</td>
                  <td className="py-2 px-3 text-gray-300">{e.trigger}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{e.duration_min}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{e.load_reduced_mw.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{e.participants_k.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">${e.avg_payment_aud_mwh.toFixed(0)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{e.peak_demand_reduced_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}
