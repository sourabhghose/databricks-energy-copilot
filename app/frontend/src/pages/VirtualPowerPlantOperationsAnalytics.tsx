import { useEffect, useState } from 'react'
import { Network, Zap, DollarSign, Activity } from 'lucide-react'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getVPOADashboard } from '../api/client'
import type { VPOADashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const OPERATOR_COLOURS = [
  '#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
]

const MARKET_COLOURS: Record<string, string> = {
  energy: '#3b82f6',
  fcas: '#f59e0b',
  network: '#10b981',
}

const ASSET_COLOURS: Record<string, string> = {
  HOME_BATTERY: '#3b82f6',
  COMMERCIAL_BESS: '#f59e0b',
  EV_CHARGER: '#ef4444',
  HOT_WATER: '#10b981',
  POOL_PUMP: '#8b5cf6',
  SOLAR_INVERTER: '#06b6d4',
}

const ASSET_LABELS: Record<string, string> = {
  HOME_BATTERY: 'Home Battery',
  COMMERCIAL_BESS: 'Commercial BESS',
  EV_CHARGER: 'EV Charger',
  HOT_WATER: 'Hot Water',
  POOL_PUMP: 'Pool Pump',
  SOLAR_INVERTER: 'Solar Inverter',
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
        <Icon size={22} className="text-white" />
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
// Main component
// ---------------------------------------------------------------------------
export default function VirtualPowerPlantOperationsAnalytics() {
  const [data, setData] = useState<VPOADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getVPOADashboard()
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        <p className="text-red-400">Error: {error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        <p className="animate-pulse text-gray-400">Loading VPP Operations Analytics...</p>
      </div>
    )
  }

  // Derived KPIs
  const totalCapacityMW = data.operators.reduce((s, o) => s + o.capacity_mw, 0)
  const totalEnrolledK = data.operators.reduce((s, o) => s + o.enrolled_assets_k, 0)
  const totalRevenueM = data.operators.reduce((s, o) => s + o.revenue_m_aud, 0)
  const avgDispatchSuccess =
    data.operators.reduce((s, o) => s + o.dispatch_success_pct, 0) / data.operators.length

  // Bar chart data – operator portfolio comparison
  const operatorBarData = data.operators.map((o) => ({
    name: o.operator_name,
    capacity_mw: o.capacity_mw,
  }))

  // Area chart data – monthly dispatch volume
  const dispatchAreaData = data.dispatch_monthly.map((d) => ({
    month: d.month,
    Energy: d.energy_mwh,
    FCAS: d.fcas_mwh,
    Network: d.network_mwh,
  }))

  // Line chart data – response time vs SoC correlation
  const responseVsSocData = data.events.map((e) => ({
    event: `${e.event_date} ${e.vpp_name}`,
    response_time_ms: e.response_time_ms,
    battery_soc_pct: e.battery_soc_pct,
  }))

  // Pie chart data – asset type distribution
  const assetPieData = data.asset_mix.map((a) => ({
    name: ASSET_LABELS[a.asset_type] || a.asset_type,
    value: a.count_k,
    asset_type: a.asset_type,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Network size={28} className="text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">Virtual Power Plant Operations Analytics</h1>
          <p className="text-sm text-gray-400">Sprint 168b -- VPOA Dashboard</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total VPP Capacity"
          value={`${totalCapacityMW.toLocaleString('en-AU')} MW`}
          sub="Across all operators"
          icon={Zap}
          color="bg-blue-600"
        />
        <KpiCard
          title="Enrolled Assets"
          value={`${totalEnrolledK.toFixed(1)}k`}
          sub="Registered DER units"
          icon={Network}
          color="bg-amber-600"
        />
        <KpiCard
          title="FCAS Revenue"
          value={`$${totalRevenueM.toFixed(1)}M AUD`}
          sub="Total operator revenue"
          icon={DollarSign}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Avg Dispatch Success"
          value={`${avgDispatchSuccess.toFixed(1)}%`}
          sub="Weighted across operators"
          icon={Activity}
          color="bg-purple-600"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BarChart: Operator portfolio comparison */}
        <ChartCard title="VPP Operator Portfolio Comparison (Capacity MW)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={operatorBarData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Bar dataKey="capacity_mw" name="Capacity MW">
                {operatorBarData.map((_, i) => (
                  <Cell key={i} fill={OPERATOR_COLOURS[i % OPERATOR_COLOURS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* AreaChart: Monthly dispatch volume */}
        <ChartCard title="Monthly VPP Dispatch Volume (MWh) by Market">
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={dispatchAreaData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Legend />
              <Area type="monotone" dataKey="Energy" stackId="1" stroke={MARKET_COLOURS.energy} fill={MARKET_COLOURS.energy} fillOpacity={0.6} />
              <Area type="monotone" dataKey="FCAS" stackId="1" stroke={MARKET_COLOURS.fcas} fill={MARKET_COLOURS.fcas} fillOpacity={0.6} />
              <Area type="monotone" dataKey="Network" stackId="1" stroke={MARKET_COLOURS.network} fill={MARKET_COLOURS.network} fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LineChart: Response time vs Battery SoC */}
        <ChartCard title="VPP Response Time (ms) vs Battery SoC (%) Correlation">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={responseVsSocData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="event" tick={false} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af' }} label={{ value: 'Response ms', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af' }} label={{ value: 'SoC %', angle: 90, position: 'insideRight', fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="response_time_ms" stroke="#ef4444" name="Response Time ms" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="battery_soc_pct" stroke="#10b981" name="Battery SoC %" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* PieChart: Asset type distribution */}
        <ChartCard title="Asset Type Distribution (Count k)">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={assetPieData}
                cx="50%"
                cy="50%"
                outerRadius={110}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {assetPieData.map((entry) => (
                  <Cell key={entry.asset_type} fill={ASSET_COLOURS[entry.asset_type] || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table: VPP Operator Summary */}
      <div className="bg-gray-800 rounded-2xl p-6 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">VPP Operator Summary</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="pb-2 pr-4">Operator</th>
              <th className="pb-2 pr-4 text-right">Enrolled Assets</th>
              <th className="pb-2 pr-4 text-right">Capacity MW</th>
              <th className="pb-2 pr-4">Markets</th>
              <th className="pb-2 pr-4 text-right">Dispatch Success %</th>
              <th className="pb-2 text-right">Revenue M AUD</th>
            </tr>
          </thead>
          <tbody>
            {data.operators.map((o) => (
              <tr key={o.operator_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4 font-medium text-white">{o.operator_name}</td>
                <td className="py-2 pr-4 text-right">{o.enrolled_assets_k.toFixed(1)}k</td>
                <td className="py-2 pr-4 text-right">{o.capacity_mw.toLocaleString('en-AU')}</td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {o.markets.map((m) => (
                      <span key={m} className="px-1.5 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                        {m}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2 pr-4 text-right">{o.dispatch_success_pct.toFixed(1)}%</td>
                <td className="py-2 text-right">${o.revenue_m_aud.toFixed(1)}M</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table: Recent Dispatch Events */}
      <div className="bg-gray-800 rounded-2xl p-6 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Recent Dispatch Events</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">VPP</th>
              <th className="pb-2 pr-4">Market</th>
              <th className="pb-2 pr-4 text-right">Dispatched MW</th>
              <th className="pb-2 pr-4 text-right">Duration min</th>
              <th className="pb-2 pr-4 text-right">Response ms</th>
              <th className="pb-2 text-right">Payment AUD</th>
            </tr>
          </thead>
          <tbody>
            {data.events.map((e, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4">{e.event_date}</td>
                <td className="py-2 pr-4 font-medium text-white">{e.vpp_name}</td>
                <td className="py-2 pr-4">
                  <span className="px-1.5 py-0.5 rounded text-xs bg-gray-700 text-gray-300">{e.market}</span>
                </td>
                <td className="py-2 pr-4 text-right">{e.dispatched_mw.toFixed(1)}</td>
                <td className="py-2 pr-4 text-right">{e.duration_min}</td>
                <td className="py-2 pr-4 text-right">{e.response_time_ms}</td>
                <td className="py-2 text-right">${e.payment_aud.toLocaleString('en-AU')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
