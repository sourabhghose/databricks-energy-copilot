import { useEffect, useState } from 'react'
import {
  Flame,
  TrendingUp,
  Loader2,
  BarChart3,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { gasApi } from '../api/client'
import type {
  GasSttmPrice,
  GasDwgmPrice,
  GasSparkSpread,
} from '../api/client'

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: 8,
}

const STTM_HUBS = ['Sydney', 'Adelaide', 'Brisbane'] as const
const NEM_REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'] as const
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#14b8a6',
  SA1: '#ef4444',
  TAS1: '#8b5cf6',
}
const HUB_COLOURS: Record<string, string> = {
  Sydney: '#3b82f6',
  Adelaide: '#ef4444',
  Brisbane: '#f59e0b',
}

export default function GasMarketDashboard() {
  const [loading, setLoading] = useState(true)
  const [sttmSummary, setSttmSummary] = useState<Array<{ hub: string; avg_price: number; min_price?: number; max_price?: number }>>([])
  const [sttmPrices, setSttmPrices] = useState<GasSttmPrice[]>([])
  const [dwgmPrices, setDwgmPrices] = useState<GasDwgmPrice[]>([])
  const [sparkSpreads, setSparkSpreads] = useState<GasSparkSpread[]>([])
  const [sparkSummary, setSparkSummary] = useState<Array<{ region: string; avg_spark: number; avg_clean_spark: number }>>([])
  const [correlations, setCorrelations] = useState<Record<string, number>>({})

  const fetchData = async () => {
    setLoading(true)
    try {
      const [dashRes, sttmRes, dwgmRes, sparkRes] = await Promise.all([
        gasApi.dashboard(30),
        gasApi.sttm(undefined, 30),
        gasApi.dwgm(30),
        gasApi.sparkSpread(undefined, 30),
      ])

      setSttmSummary(dashRes.sttm_summary || [])
      setSttmPrices(sttmRes.prices || [])
      setDwgmPrices(dwgmRes.prices || [])
      setSparkSpreads(sparkRes.spreads || [])
      setSparkSummary(sparkRes.summary_by_region || [])

      // Fetch correlations for each region
      const corrResults: Record<string, number> = {}
      const corrPromises = NEM_REGIONS.map(async (r) => {
        try {
          const res = await gasApi.correlation(r, 30)
          corrResults[r] = res.correlation
        } catch {
          corrResults[r] = 0
        }
      })
      await Promise.all(corrPromises)
      setCorrelations(corrResults)
    } catch (e) {
      console.error('Failed to fetch gas data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Build STTM line chart data — pivot by date
  const sttmByDate: Record<string, Record<string, number>> = {}
  sttmPrices.forEach((p) => {
    if (!sttmByDate[p.trade_date]) sttmByDate[p.trade_date] = {}
    sttmByDate[p.trade_date][p.hub] = p.ex_ante_price
  })
  const sttmChartData = Object.entries(sttmByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, hubs]) => ({
      date: date.slice(5), // MM-DD
      ...hubs,
    }))

  // Build DWGM line chart data
  const dwgmByDate: Record<string, number[]> = {}
  dwgmPrices.forEach((p) => {
    if (!dwgmByDate[p.trade_date]) dwgmByDate[p.trade_date] = []
    dwgmByDate[p.trade_date].push(p.price_aud_gj)
  })
  const dwgmChartData = Object.entries(dwgmByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, prices]) => ({
      date: date.slice(5),
      avg_price: prices.reduce((a, b) => a + b, 0) / prices.length,
    }))

  // Build spark spread chart data — pivot by date
  const sparkByDate: Record<string, Record<string, number>> = {}
  sparkSpreads.forEach((s) => {
    if (!sparkByDate[s.trade_date]) sparkByDate[s.trade_date] = {}
    sparkByDate[s.trade_date][s.region] = s.spark_spread
  })
  const sparkChartData = Object.entries(sparkByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, regions]) => ({
      date: date.slice(5),
      ...regions,
    }))

  // Compute min/max per hub from sttm prices
  const hubStats: Record<string, { min: number; max: number }> = {}
  sttmPrices.forEach((p) => {
    if (!hubStats[p.hub]) hubStats[p.hub] = { min: Infinity, max: -Infinity }
    if (p.ex_ante_price < hubStats[p.hub].min) hubStats[p.hub].min = p.ex_ante_price
    if (p.ex_ante_price > hubStats[p.hub].max) hubStats[p.hub].max = p.ex_ante_price
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-400 text-lg">Loading gas market data...</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Gas Market Dashboard</h1>
        <p className="text-gray-400 mt-1">STTM, DWGM prices and spark spread analytics (30-day)</p>
      </div>

      {/* STTM Hub Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STTM_HUBS.map((hub) => {
          const summary = sttmSummary.find((s) => s.hub === hub)
          const stats = hubStats[hub]
          return (
            <div key={hub} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-5 h-5 text-orange-400" />
                <h3 className="text-lg font-semibold text-white">{hub}</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Price</span>
                  <span className="text-white font-medium">${(summary?.avg_price ?? 0).toFixed(2)}/GJ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Min</span>
                  <span className="text-green-400">${(stats?.min ?? 0).toFixed(2)}/GJ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max</span>
                  <span className="text-red-400">${(stats?.max ?? 0).toFixed(2)}/GJ</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* STTM Price Line Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">STTM Ex-Ante Prices by Hub</h2>
        {sttmChartData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sttmChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: '$/GJ', angle: -90, fill: '#9ca3af', position: 'insideLeft' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#fff' }} />
                <Legend />
                {STTM_HUBS.map((hub) => (
                  <Line key={hub} type="monotone" dataKey={hub} stroke={HUB_COLOURS[hub]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No STTM price data</p>
        )}
      </div>

      {/* DWGM Price Line Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">DWGM Daily Average Price</h2>
        {dwgmChartData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dwgmChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: '$/GJ', angle: -90, fill: '#9ca3af', position: 'insideLeft' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#fff' }} formatter={(v: number) => [`$${v.toFixed(2)}/GJ`, 'Avg Price']} />
                <Line type="monotone" dataKey="avg_price" stroke="#14b8a6" strokeWidth={2} dot={false} name="DWGM Avg Price" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No DWGM price data</p>
        )}
      </div>

      {/* Spark Spread Line Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Spark Spread by Region</h2>
        {sparkChartData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: '$/MWh', angle: -90, fill: '#9ca3af', position: 'insideLeft' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#fff' }} />
                <Legend />
                {NEM_REGIONS.map((r) => (
                  <Line key={r} type="monotone" dataKey={r} stroke={REGION_COLOURS[r]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No spark spread data</p>
        )}
      </div>

      {/* Summary Stats Table */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Spark Spread Summary by Region</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-3 pr-4">Region</th>
                <th className="pb-3 pr-4 text-right">Avg Spark Spread</th>
                <th className="pb-3 pr-4 text-right">Avg Clean Spark Spread</th>
                <th className="pb-3 pr-4 text-right">Gas-Elec Correlation</th>
              </tr>
            </thead>
            <tbody>
              {sparkSummary.map((row) => (
                <tr key={row.region} className="border-b border-gray-700 text-gray-300">
                  <td className="py-3 pr-4 font-medium text-white">{row.region}</td>
                  <td className="py-3 pr-4 text-right">
                    <span className={row.avg_spark >= 0 ? 'text-green-400' : 'text-red-400'}>
                      ${row.avg_spark.toFixed(2)}/MWh
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className={row.avg_clean_spark >= 0 ? 'text-green-400' : 'text-red-400'}>
                      ${row.avg_clean_spark.toFixed(2)}/MWh
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {correlations[row.region] !== undefined
                      ? correlations[row.region].toFixed(3)
                      : '—'}
                  </td>
                </tr>
              ))}
              {sparkSummary.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-500">No summary data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
