import { useEffect, useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  Zap,
  BarChart3,
  Loader2,
  ArrowLeftRight,
} from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { wemApi } from '../api/client'
import type { WemPrice, WemGeneration } from '../api/client'

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: 8,
}

const FUEL_COLOURS: Record<string, string> = {
  gas_ccgt: '#f59e0b',
  coal_black: '#6b7280',
  wind: '#3b82f6',
  solar: '#eab308',
  battery: '#14b8a6',
  gas_ocgt: '#f97316',
  distillate: '#a855f7',
  hydro: '#06b6d4',
}

const FUEL_LABELS: Record<string, string> = {
  gas_ccgt: 'Gas CCGT',
  coal_black: 'Coal',
  wind: 'Wind',
  solar: 'Solar',
  battery: 'Battery',
  gas_ocgt: 'Gas OCGT',
  distillate: 'Distillate',
  hydro: 'Hydro',
}

export default function WemDashboard() {
  const [loading, setLoading] = useState(true)
  const [priceSummary, setPriceSummary] = useState<{ avg_price: number; max_price: number; vol: number }>({ avg_price: 0, max_price: 0, vol: 0 })
  const [demandSummary, setDemandSummary] = useState<{ avg_demand: number; peak_demand: number; min_demand: number }>({ avg_demand: 0, peak_demand: 0, min_demand: 0 })
  const [prices, setPrices] = useState<WemPrice[]>([])
  const [generation, setGeneration] = useState<WemGeneration[]>([])
  const [demand, setDemand] = useState<Array<{ trading_interval: string; total_demand_mw: number }>>([])
  const [comparison, setComparison] = useState<{
    wem: { avg_price: number; max_price: number; avg_demand_mw: number };
    nem_nsw1: { avg_price: number; max_price: number; avg_demand_mw: number };
    price_differential: number;
  } | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [dashRes, pricesRes, genRes, demandRes, compRes] = await Promise.all([
        wemApi.dashboard(7),
        wemApi.prices(7),
        wemApi.generation(7),
        wemApi.demand(7),
        wemApi.comparison(7),
      ])

      const ps = dashRes.price_summary || {}
      setPriceSummary({ avg_price: ps.avg_price ?? 0, max_price: ps.max_price ?? 0, vol: ps.vol ?? 0 })
      const ds = dashRes.demand_summary || {}
      setDemandSummary({ avg_demand: ds.avg_demand ?? 0, peak_demand: ds.peak_demand ?? 0, min_demand: ds.min_demand ?? 0 })
      setPrices(pricesRes.prices || [])
      setGeneration(genRes.generation || [])
      setDemand(demandRes.demand || [])
      if (compRes?.wem && compRes?.nem_nsw1) {
        setComparison({
          wem: { avg_price: compRes.wem.avg_price ?? 0, max_price: compRes.wem.max_price ?? 0, avg_demand_mw: compRes.wem.avg_demand_mw ?? 0 },
          nem_nsw1: { avg_price: compRes.nem_nsw1.avg_price ?? 0, max_price: compRes.nem_nsw1.max_price ?? 0, avg_demand_mw: compRes.nem_nsw1.avg_demand_mw ?? 0 },
          price_differential: compRes.price_differential ?? 0,
        })
      }
    } catch (e) {
      console.error('Failed to fetch WEM data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Balancing price chart data
  const priceChartData = prices.map((p) => ({
    time: p.trading_interval.slice(5, 16), // MM-DD HH:MM
    price: p.balancing_price,
  }))

  // Generation mix — pivot by interval
  const fuelTypes = [...new Set(generation.map((g) => g.fuel_type))]
  const genByInterval: Record<string, Record<string, number>> = {}
  generation.forEach((g) => {
    if (!genByInterval[g.trading_interval]) genByInterval[g.trading_interval] = {}
    genByInterval[g.trading_interval][g.fuel_type] = g.total_mw
  })
  const genChartData = Object.entries(genByInterval)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([interval, fuels]) => ({
      time: interval.slice(5, 16),
      ...fuels,
    }))

  // Demand chart
  const demandChartData = demand.map((d) => ({
    time: d.trading_interval.slice(5, 16),
    demand: d.total_demand_mw,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-400 text-lg">Loading WEM data...</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">WEM Dashboard</h1>
        <p className="text-gray-400 mt-1">Western Australia Wholesale Electricity Market (7-day view)</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            Avg Price
          </div>
          <div className="text-2xl font-bold text-white">${priceSummary.avg_price.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">$/MWh</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Max Price
          </div>
          <div className="text-2xl font-bold text-red-400">${priceSummary.max_price.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">$/MWh</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Zap className="w-4 h-4" />
            Avg Demand
          </div>
          <div className="text-2xl font-bold text-blue-400">{demandSummary.avg_demand.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-gray-500 mt-1">MW</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <BarChart3 className="w-4 h-4" />
            Peak Demand
          </div>
          <div className="text-2xl font-bold text-yellow-400">{demandSummary.peak_demand.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-gray-500 mt-1">MW</div>
        </div>
      </div>

      {/* Balancing Price Line Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Balancing Price</h2>
        {priceChartData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  interval={Math.max(Math.floor(priceChartData.length / 12), 1)}
                />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: '$/MWh', angle: -90, fill: '#9ca3af', position: 'insideLeft' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#fff' }} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Price']} />
                <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} dot={false} name="Balancing Price" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No price data</p>
        )}
      </div>

      {/* Generation Mix Stacked Area Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Generation Mix</h2>
        {genChartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={genChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  interval={Math.max(Math.floor(genChartData.length / 12), 1)}
                />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: 'MW', angle: -90, fill: '#9ca3af', position: 'insideLeft' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#fff' }} />
                <Legend formatter={(v: string) => FUEL_LABELS[v] || v} />
                {fuelTypes.map((fuel) => (
                  <Area
                    key={fuel}
                    type="monotone"
                    dataKey={fuel}
                    stackId="gen"
                    stroke={FUEL_COLOURS[fuel] || '#6b7280'}
                    fill={FUEL_COLOURS[fuel] || '#6b7280'}
                    fillOpacity={0.6}
                    name={fuel}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No generation data</p>
        )}
      </div>

      {/* Demand Line Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Total Demand</h2>
        {demandChartData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={demandChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  interval={Math.max(Math.floor(demandChartData.length / 12), 1)}
                />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: 'MW', angle: -90, fill: '#9ca3af', position: 'insideLeft' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#fff' }} formatter={(v: number) => [`${v.toLocaleString()} MW`, 'Demand']} />
                <Line type="monotone" dataKey="demand" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Total Demand" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No demand data</p>
        )}
      </div>

      {/* WEM vs NEM Comparison */}
      {comparison && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <ArrowLeftRight className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">WEM vs NEM (NSW1) Comparison</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* WEM Stats */}
            <div className="bg-gray-900 rounded-lg p-5 border border-gray-700">
              <h3 className="text-sm font-medium text-blue-400 mb-3 uppercase tracking-wide">WEM (WA)</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Price</span>
                  <span className="text-white font-medium">${comparison.wem.avg_price.toFixed(2)}/MWh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Price</span>
                  <span className="text-white font-medium">${comparison.wem.max_price.toFixed(2)}/MWh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Demand</span>
                  <span className="text-white font-medium">{comparison.wem.avg_demand_mw.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW</span>
                </div>
              </div>
            </div>

            {/* NEM Stats */}
            <div className="bg-gray-900 rounded-lg p-5 border border-gray-700">
              <h3 className="text-sm font-medium text-teal-400 mb-3 uppercase tracking-wide">NEM (NSW1)</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Price</span>
                  <span className="text-white font-medium">${comparison.nem_nsw1.avg_price.toFixed(2)}/MWh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Price</span>
                  <span className="text-white font-medium">${comparison.nem_nsw1.max_price.toFixed(2)}/MWh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Demand</span>
                  <span className="text-white font-medium">{comparison.nem_nsw1.avg_demand_mw.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW</span>
                </div>
              </div>
            </div>

            {/* Differential */}
            <div className="bg-gray-900 rounded-lg p-5 border border-gray-700 flex flex-col items-center justify-center">
              <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">Price Differential</h3>
              <div className={`text-3xl font-bold ${comparison.price_differential >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {comparison.price_differential >= 0 ? '+' : ''}{comparison.price_differential.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">$/MWh (WEM - NEM)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
