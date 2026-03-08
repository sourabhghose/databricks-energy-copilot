import { useEffect, useState } from 'react'
import {
  Battery,
  BatteryCharging,
  Zap,
  DollarSign,
  Loader2,
  Play,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import { batteryApi } from '../api/client'
import type {
  BatteryAsset,
  BatteryOptResult,
  BatteryPerfRecord,
} from '../api/client'

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: 8,
}

const PIE_COLORS = ['#3b82f6', '#14b8a6']

function statusColor(status: string): string {
  const map: Record<string, string> = {
    ONLINE: 'text-green-400',
    OFFLINE: 'text-red-400',
    CHARGING: 'text-blue-400',
    DISCHARGING: 'text-yellow-400',
    IDLE: 'text-gray-400',
    MAINTENANCE: 'text-orange-400',
  }
  return map[status] || 'text-gray-400'
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    ONLINE: 'bg-green-900 text-green-300',
    OFFLINE: 'bg-red-900 text-red-300',
    CHARGING: 'bg-blue-900 text-blue-300',
    DISCHARGING: 'bg-yellow-900 text-yellow-300',
    IDLE: 'bg-gray-700 text-gray-300',
    MAINTENANCE: 'bg-orange-900 text-orange-300',
  }
  return map[status] || 'bg-gray-700 text-gray-300'
}

export default function BatteryDashboard() {
  const [loading, setLoading] = useState(true)
  const [fleetSummary, setFleetSummary] = useState<{
    total_assets: number; total_capacity_mw: number; total_storage_mwh: number; total_revenue_7d: number
  } | null>(null)
  const [assets, setAssets] = useState<BatteryAsset[]>([])
  const [performance, setPerformance] = useState<BatteryPerfRecord[]>([])
  const [revenueBreakdown, setRevenueBreakdown] = useState<Array<{ name: string; arb_rev: number; fcas_rev: number }>>([])

  // Schedule/optimize per asset
  const [scheduleData, setScheduleData] = useState<Array<{ hour: number; action: string; power_mw: number; soc_pct: number }>>([])
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [optimizing, setOptimizing] = useState<string | null>(null)
  const [optResult, setOptResult] = useState<BatteryOptResult | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [dashRes, revRes] = await Promise.all([
        batteryApi.dashboard(),
        batteryApi.revenue(),
      ])
      setFleetSummary(dashRes.fleet_summary)
      setAssets(dashRes.assets || [])
      setPerformance(dashRes.performance?.assets || [])
      setRevenueBreakdown(revRes.revenue || [])
    } catch (e) {
      console.error('Failed to fetch battery data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleViewSchedule = async (assetId: string) => {
    setSelectedAssetId(assetId)
    setOptResult(null)
    try {
      const res = await batteryApi.schedule(assetId, 1)
      const items = (res.schedule || []).map((s, i) => ({
        hour: i,
        action: s.action,
        power_mw: s.power_mw,
        soc_pct: s.soc_pct,
      }))
      setScheduleData(items)
    } catch (e) {
      console.error('Failed to fetch schedule:', e)
    }
  }

  const handleOptimize = async (assetId: string) => {
    setOptimizing(assetId)
    setSelectedAssetId(assetId)
    try {
      const result = await batteryApi.optimize(assetId, 24)
      setOptResult(result)
      // Also update schedule data from optimization
      const items = (result.schedule || []).map((s) => ({
        hour: s.hour_of_day ?? s.hour,
        action: s.action,
        power_mw: s.power_mw,
        soc_pct: s.soc_pct,
      }))
      setScheduleData(items)
    } catch (e) {
      console.error('Optimization failed:', e)
    } finally {
      setOptimizing(null)
    }
  }

  // Build dispatch area chart data
  const dispatchChartData = scheduleData.map((s) => ({
    hour: `${s.hour}:00`,
    charge: s.action === 'charge' ? Math.abs(s.power_mw) : 0,
    idle: s.action === 'idle' ? 0.5 : 0,
    discharge: s.action === 'discharge' ? Math.abs(s.power_mw) : 0,
    soc: s.soc_pct,
  }))

  // Pie chart data for total revenue breakdown
  const totalArb = revenueBreakdown.reduce((acc, r) => acc + r.arb_rev, 0)
  const totalFcas = revenueBreakdown.reduce((acc, r) => acc + r.fcas_rev, 0)
  const pieData = [
    { name: 'Arbitrage', value: totalArb },
    { name: 'FCAS', value: totalFcas },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-400 text-lg">Loading battery data...</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Battery Dispatch Dashboard</h1>
        <p className="text-gray-400 mt-1">Fleet management, dispatch optimization and revenue analytics</p>
      </div>

      {/* Fleet Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Battery className="w-4 h-4" />
            Total Assets
          </div>
          <div className="text-2xl font-bold text-white">{fleetSummary?.total_assets ?? 0}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Zap className="w-4 h-4" />
            Total MW
          </div>
          <div className="text-2xl font-bold text-blue-400">{fleetSummary?.total_capacity_mw ?? 0} MW</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <BatteryCharging className="w-4 h-4" />
            Total MWh
          </div>
          <div className="text-2xl font-bold text-teal-400">{fleetSummary?.total_storage_mwh ?? 0} MWh</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            7d Revenue
          </div>
          <div className="text-2xl font-bold text-green-400">
            ${(fleetSummary?.total_revenue_7d ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Asset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {assets.map((asset) => (
          <div key={asset.asset_id} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">{asset.name}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(asset.status)}`}>
                {asset.status}
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-300 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Region</span>
                <span>{asset.region}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Capacity</span>
                <span>{asset.capacity_mw} MW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Storage</span>
                <span>{asset.storage_mwh} MWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Efficiency</span>
                <span>{asset.efficiency_pct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">FCAS Capable</span>
                <span className={asset.fcas_capable ? 'text-green-400' : 'text-gray-500'}>
                  {asset.fcas_capable ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleViewSchedule(asset.asset_id)}
                className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              >
                View Schedule
              </button>
              <button
                onClick={() => handleOptimize(asset.asset_id)}
                disabled={optimizing === asset.asset_id}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
              >
                {optimizing === asset.asset_id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Optimize
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Dispatch Schedule Chart */}
      {selectedAssetId && dispatchChartData.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Dispatch Schedule — {assets.find((a) => a.asset_id === selectedAssetId)?.name ?? selectedAssetId}
            </h2>
            {optResult && (
              <div className="text-sm text-green-400 font-medium">
                Optimized Revenue: ${optResult.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                {' | '}Spread: ${optResult.spread?.toFixed(2) ?? '—'}/MWh
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stacked Area: charge / idle / discharge */}
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dispatchChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: 'MW', angle: -90, fill: '#9ca3af', position: 'insideLeft' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#fff' }} />
                  <Legend />
                  <Area type="monotone" dataKey="charge" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Charge" />
                  <Area type="monotone" dataKey="idle" stackId="1" stroke="#6b7280" fill="#6b7280" fillOpacity={0.3} name="Idle" />
                  <Area type="monotone" dataKey="discharge" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Discharge" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* SoC Line */}
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dispatchChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} domain={[0, 100]} label={{ value: 'SoC %', angle: -90, fill: '#9ca3af', position: 'insideLeft' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#fff' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'SoC']} />
                  <Line type="monotone" dataKey="soc" stroke="#14b8a6" strokeWidth={2} dot={false} name="SoC %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Performance Table */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Performance Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-3 pr-4">Asset</th>
                <th className="pb-3 pr-4 text-right">Cycles</th>
                <th className="pb-3 pr-4 text-right">Throughput MWh</th>
                <th className="pb-3 pr-4 text-right">Arb Revenue</th>
                <th className="pb-3 pr-4 text-right">FCAS Revenue</th>
                <th className="pb-3 pr-4 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((p) => {
                const asset = assets.find((a) => a.asset_id === p.asset_id)
                return (
                  <tr key={p.asset_id} className="border-b border-gray-700 text-gray-300">
                    <td className="py-3 pr-4 font-medium text-white">{asset?.name ?? p.asset_id}</td>
                    <td className="py-3 pr-4 text-right">{p.total_cycles}</td>
                    <td className="py-3 pr-4 text-right">{p.total_throughput.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right">${p.arb_rev.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-3 pr-4 text-right">${p.fcas_rev.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-3 pr-4 text-right font-medium text-white">${p.total_rev.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                )
              })}
              {performance.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">No performance data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Pie Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Revenue Breakdown</h2>
        <div className="flex items-center justify-center h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                label={({ name, value }) => `${name}: $${(value / 1000).toFixed(0)}k`}
              >
                {pieData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Revenue']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
