import { useEffect, useState } from 'react'
import {
  Activity,
  CheckCircle,
  DollarSign,
  BarChart3,
  Zap,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  biddingApi,
} from '../api/client'
import type {
  BiddingDashboardResponse,
  BidRecord,
  BidOptimizationResult,
  ConformanceEvent,
  RevenueRecord,
} from '../api/client'

const NEM_REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'] as const
const GENERATORS = ['BAYSW1', 'ERGT01', 'HDWF1', 'LKBNL1', 'CALL_A_1'] as const
const STRATEGIES = ['ML_OPTIMIZED', 'PRICE_TAKER', 'PRICE_SETTER', 'BALANCED'] as const

const BAND_COLORS = [
  '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a',
  '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81',
]

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: 8,
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACCEPTED: 'bg-green-900 text-green-300',
    REBID: 'bg-yellow-900 text-yellow-300',
    REJECTED: 'bg-red-900 text-red-300',
    PENDING: 'bg-blue-900 text-blue-300',
  }
  return map[status] || 'bg-gray-700 text-gray-300'
}

function conformanceBadge(status: string) {
  const map: Record<string, string> = {
    CONFORMING: 'bg-green-900 text-green-300',
    WARNING: 'bg-yellow-900 text-yellow-300',
    NON_CONFORMING: 'bg-red-900 text-red-300',
  }
  return map[status] || 'bg-gray-700 text-gray-300'
}

export default function BiddingDashboard() {
  const [region, setRegion] = useState<string>('NSW1')
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<BiddingDashboardResponse | null>(null)
  const [recentBids, setRecentBids] = useState<BidRecord[]>([])
  const [conformanceEvents, setConformanceEvents] = useState<ConformanceEvent[]>([])
  const [revenueData, setRevenueData] = useState<RevenueRecord[]>([])

  // Optimize panel state
  const [selectedGenerator, setSelectedGenerator] = useState<string>(GENERATORS[0])
  const [selectedStrategy, setSelectedStrategy] = useState<string>(STRATEGIES[0])
  const [optimizing, setOptimizing] = useState(false)
  const [optResult, setOptResult] = useState<BidOptimizationResult | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [dash, bidsRes, confRes, revRes] = await Promise.all([
        biddingApi.dashboard(region),
        biddingApi.bids(region),
        biddingApi.conformance(region),
        biddingApi.revenue(region),
      ])
      setDashboard(dash)
      setRecentBids(bidsRes.bids || [])
      setConformanceEvents(confRes.events || [])
      setRevenueData(revRes.revenue || [])
    } catch (e) {
      console.error('Failed to fetch bidding data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [region])

  const handleOptimize = async () => {
    setOptimizing(true)
    setOptResult(null)
    try {
      const result = await biddingApi.optimize(selectedGenerator, region, selectedStrategy)
      setOptResult(result)
    } catch (e) {
      console.error('Optimization failed:', e)
    } finally {
      setOptimizing(false)
    }
  }

  const kpis = dashboard?.kpis
  const acceptedPct = kpis ? ((kpis.accepted_bids / Math.max(kpis.total_bids, 1)) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-400 text-lg">Loading bidding data...</span>
      </div>
    )
  }

  // Prepare band chart data for optimize result
  const bandChartData = optResult?.recommended_bands?.map((b) => ({
    band: `Band ${b.band}`,
    mw: b.mw,
    price: b.price,
  })) || []

  // Revenue chart data
  const revenueChartData = revenueData.map((r) => ({
    generator: r.generator_name,
    energy_rev: r.energy_rev,
    fcas_rev: r.fcas_rev,
  }))

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bidding Dashboard</h1>
          <p className="text-gray-400 mt-1">NEM bid management, optimization and conformance</p>
        </div>
        <div className="relative">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="appearance-none bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {NEM_REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <BarChart3 className="w-4 h-4" />
            Total Bids
          </div>
          <div className="text-2xl font-bold text-white">{kpis?.total_bids ?? 0}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <CheckCircle className="w-4 h-4" />
            Accepted %
          </div>
          <div className="text-2xl font-bold text-green-400">{acceptedPct.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Activity className="w-4 h-4" />
            Conformance Rate
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {((kpis?.conformance_rate ?? 0) * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            Total Revenue
          </div>
          <div className="text-2xl font-bold text-white">
            ${(kpis?.total_revenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Zap className="w-4 h-4" />
            Avg CF
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {((kpis?.avg_capacity_factor ?? 0) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Recent Bids Table */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Bids</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-3 pr-4">Generator</th>
                <th className="pb-3 pr-4">DateTime</th>
                <th className="pb-3 pr-4 text-right">Total MW</th>
                <th className="pb-3 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBids.slice(0, 15).map((bid) => (
                <tr key={bid.bid_id} className="border-b border-gray-700 text-gray-300">
                  <td className="py-3 pr-4 font-medium text-white">{bid.generator_name}</td>
                  <td className="py-3 pr-4">{new Date(bid.bid_datetime).toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right">{bid.total_mw.toFixed(1)}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(bid.status)}`}>
                      {bid.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentBids.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-500">No bids found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Optimize Bid Panel */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Optimize Bid</h2>
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Generator</label>
            <div className="relative">
              <select
                value={selectedGenerator}
                onChange={(e) => setSelectedGenerator(e.target.value)}
                className="appearance-none bg-gray-900 text-white border border-gray-600 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {GENERATORS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Strategy</label>
            <div className="relative">
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="appearance-none bg-gray-900 text-white border border-gray-600 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STRATEGIES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {optimizing && <Loader2 className="w-4 h-4 animate-spin" />}
            {optimizing ? 'Optimizing...' : 'Optimize'}
          </button>
        </div>

        {/* Optimization result */}
        {optResult && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="bg-gray-900 rounded-lg px-4 py-2 border border-gray-700">
                <span className="text-gray-400">Capacity:</span>{' '}
                <span className="text-white font-medium">{optResult.capacity_mw} MW</span>
              </div>
              <div className="bg-gray-900 rounded-lg px-4 py-2 border border-gray-700">
                <span className="text-gray-400">SRMC:</span>{' '}
                <span className="text-white font-medium">${optResult.srmc.toFixed(2)}/MWh</span>
              </div>
              <div className="bg-gray-900 rounded-lg px-4 py-2 border border-gray-700">
                <span className="text-gray-400">Total Bid:</span>{' '}
                <span className="text-white font-medium">{optResult.total_bid_mw.toFixed(1)} MW</span>
              </div>
              <div className="bg-gray-900 rounded-lg px-4 py-2 border border-gray-700">
                <span className="text-gray-400">Expected Revenue:</span>{' '}
                <span className="text-green-400 font-medium">${optResult.expected_revenue_daily.toLocaleString()}/day</span>
              </div>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bandChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="band" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: 'MW', angle: -90, fill: '#9ca3af', position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: number, name: string) => {
                      if (name === 'mw') return [`${value.toFixed(1)} MW`, 'Capacity']
                      return [value, name]
                    }}
                    labelFormatter={(label: string) => {
                      const item = bandChartData.find((b) => b.band === label)
                      return `${label} — $${item?.price?.toFixed(2) ?? '?'}/MWh`
                    }}
                  />
                  <Bar dataKey="mw" name="mw" radius={[4, 4, 0, 0]}>
                    {bandChartData.map((_, idx) => (
                      <Cell key={idx} fill={BAND_COLORS[idx % BAND_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Conformance Events */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Conformance Events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-3 pr-4">Generator</th>
                <th className="pb-3 pr-4">Interval</th>
                <th className="pb-3 pr-4 text-right">Target MW</th>
                <th className="pb-3 pr-4 text-right">Actual MW</th>
                <th className="pb-3 pr-4 text-right">Deviation %</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Reason</th>
              </tr>
            </thead>
            <tbody>
              {conformanceEvents.slice(0, 15).map((evt) => (
                <tr key={evt.event_id} className="border-b border-gray-700 text-gray-300">
                  <td className="py-3 pr-4 font-medium text-white">{evt.generator_name}</td>
                  <td className="py-3 pr-4">{new Date(evt.interval_datetime).toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right">{evt.target_mw.toFixed(1)}</td>
                  <td className="py-3 pr-4 text-right">{evt.actual_mw.toFixed(1)}</td>
                  <td className="py-3 pr-4 text-right">{evt.deviation_pct.toFixed(1)}%</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${conformanceBadge(evt.conformance_status)}`}>
                      {evt.conformance_status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-400 max-w-[200px] truncate">{evt.reason}</td>
                </tr>
              ))}
              {conformanceEvents.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-gray-500">No conformance events</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Stacked Bar Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Revenue by Generator</h2>
        {revenueChartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="generator"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number, name: string) => [
                    `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                    name === 'energy_rev' ? 'Energy Revenue' : 'FCAS Revenue',
                  ]}
                />
                <Legend
                  formatter={(value: string) =>
                    value === 'energy_rev' ? 'Energy Revenue' : 'FCAS Revenue'
                  }
                />
                <Bar dataKey="energy_rev" stackId="rev" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="fcas_rev" stackId="rev" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No revenue data available</p>
        )}
      </div>
    </div>
  )
}
