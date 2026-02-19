import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Zap, TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import type {
  SpotForecastDashboard,
  SpotForecastInterval,
  RegionalPriceSummary,
  ModelPerformanceRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: number | null | undefined, decimals = 1): string {
  if (v == null) return '—'
  return v.toFixed(decimals)
}

function spikeProbColor(prob: number): string {
  if (prob < 15) return 'text-green-400'
  if (prob < 35) return 'text-amber-400'
  return 'text-red-400'
}

function spikeProbBg(prob: number): string {
  if (prob < 15) return 'bg-green-500'
  if (prob < 35) return 'bg-amber-500'
  return 'bg-red-500'
}

function TrendBadge({ trend }: { trend: string }) {
  if (trend === 'UP')
    return (
      <span className="flex items-center gap-1 text-xs text-green-400 font-semibold">
        <TrendingUp size={13} /> UP
      </span>
    )
  if (trend === 'DOWN')
    return (
      <span className="flex items-center gap-1 text-xs text-red-400 font-semibold">
        <TrendingDown size={13} /> DOWN
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-xs text-gray-400 font-semibold">
      <Minus size={13} /> STABLE
    </span>
  )
}

function ModelBadge({ model }: { model: string }) {
  const colors: Record<string, string> = {
    NEURAL: 'bg-violet-700 text-violet-100',
    GBDT: 'bg-blue-700 text-blue-100',
    ENSEMBLE: 'bg-teal-700 text-teal-100',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-semibold ${colors[model] ?? 'bg-gray-700 text-gray-200'}`}>
      {model}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Mini-card (one per region)
// ---------------------------------------------------------------------------
function RegionKpiCard({ r }: { r: RegionalPriceSummary }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-2 min-w-[150px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400 tracking-widest">{r.region}</span>
        <TrendBadge trend={r.trend} />
      </div>
      <div className="text-2xl font-bold text-white">
        ${fmt(r.current_price, 0)}
        <span className="text-xs text-gray-400 ml-1">$/MWh</span>
      </div>
      <div className="text-xs text-gray-400">Spike risk (4h)</div>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${spikeProbBg(r.price_spike_prob_pct)}`}
          style={{ width: `${Math.min(r.price_spike_prob_pct, 100)}%` }}
        />
      </div>
      <div className={`text-xs font-semibold ${spikeProbColor(r.price_spike_prob_pct)}`}>
        {fmt(r.price_spike_prob_pct, 1)}%
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Forecast Bands Chart
// ---------------------------------------------------------------------------
function ForecastBandsChart({
  intervals,
  selectedRegion,
  onRegionChange,
}: {
  intervals: SpotForecastInterval[]
  selectedRegion: string
  onRegionChange: (r: string) => void
}) {
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const filtered = intervals.filter(i => i.region === selectedRegion)

  const chartData = filtered.map(i => ({
    label: i.trading_interval.slice(11, 16),
    p10: i.forecast_p10,
    p50: i.forecast_p50,
    p90: i.forecast_p90,
    actual: i.actual_price,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Forecast Price Bands (24h)</h2>
          <p className="text-xs text-gray-400 mt-0.5">P10 / P50 / P90 confidence intervals with actual prices</p>
        </div>
        <div className="flex gap-2">
          {regions.map(r => (
            <button
              key={r}
              onClick={() => onRegionChange(r)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                r === selectedRegion
                  ? 'bg-amber-500 text-gray-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            interval={3}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `$${v}`}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(value: number, name: string) => [`$${fmt(value, 1)}/MWh`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          {/* P90 upper band */}
          <Area
            type="monotone"
            dataKey="p90"
            name="P90"
            stroke="#fbbf24"
            strokeWidth={1}
            strokeDasharray="4 2"
            fill="url(#bandGradient)"
            fillOpacity={1}
            dot={false}
          />
          {/* P10 lower band */}
          <Area
            type="monotone"
            dataKey="p10"
            name="P10"
            stroke="#6ee7b7"
            strokeWidth={1}
            strokeDasharray="4 2"
            fill="transparent"
            dot={false}
          />
          {/* P50 median */}
          <Area
            type="monotone"
            dataKey="p50"
            name="P50 (median)"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="transparent"
            dot={false}
          />
          {/* Actual */}
          <Area
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#60a5fa"
            strokeWidth={2}
            fill="transparent"
            dot={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Regional Summary Table
// ---------------------------------------------------------------------------
function RegionalSummaryTable({ rows }: { rows: RegionalPriceSummary[] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white mb-4">Regional Price Summary</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left pb-2 pr-4">Region</th>
              <th className="text-right pb-2 px-4">Current $/MWh</th>
              <th className="text-right pb-2 px-4">24h Avg</th>
              <th className="text-right pb-2 px-4">7d Avg</th>
              <th className="text-right pb-2 px-4">Spike Prob %</th>
              <th className="text-right pb-2 px-4">Volatility</th>
              <th className="text-center pb-2 pl-4">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.region} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-4 font-bold text-white">{r.region}</td>
                <td className="py-2 px-4 text-right font-mono text-white">${fmt(r.current_price, 1)}</td>
                <td className="py-2 px-4 text-right font-mono text-gray-300">${fmt(r.forecast_24h_avg, 1)}</td>
                <td className="py-2 px-4 text-right font-mono text-gray-300">${fmt(r.forecast_7d_avg, 1)}</td>
                <td className={`py-2 px-4 text-right font-mono font-semibold ${spikeProbColor(r.price_spike_prob_pct)}`}>
                  {fmt(r.price_spike_prob_pct, 1)}%
                </td>
                <td className="py-2 px-4 text-right text-gray-300">{fmt(r.volatility_index, 1)}</td>
                <td className="py-2 pl-4 text-center">
                  <TrendBadge trend={r.trend} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Model Performance Table
// ---------------------------------------------------------------------------
const PERIODS = ['last_24h', 'last_7d', 'last_30d']

function ModelPerformanceTable({ records }: { records: ModelPerformanceRecord[] }) {
  const [period, setPeriod] = useState('last_24h')
  const filtered = records.filter(r => r.period === period)

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Model Performance</h2>
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                p === period
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {p.replace('last_', 'Last ').replace('24h', '24h').replace('7d', '7 days').replace('30d', '30 days')}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left pb-2 pr-4">Model</th>
              <th className="text-left pb-2 px-4">Region</th>
              <th className="text-right pb-2 px-4">MAE $/MWh</th>
              <th className="text-right pb-2 px-4">RMSE</th>
              <th className="text-right pb-2 px-4">MAPE %</th>
              <th className="text-right pb-2 px-4">R²</th>
              <th className="text-right pb-2 pl-4">Spike Det. %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-4">
                  <ModelBadge model={r.model_name} />
                </td>
                <td className="py-2 px-4 font-bold text-white">{r.region}</td>
                <td className="py-2 px-4 text-right font-mono text-gray-300">{fmt(r.mae, 1)}</td>
                <td className="py-2 px-4 text-right font-mono text-gray-300">{fmt(r.rmse, 1)}</td>
                <td className="py-2 px-4 text-right font-mono text-amber-400">{fmt(r.mape_pct, 1)}%</td>
                <td className="py-2 px-4 text-right font-mono text-blue-400">{fmt(r.r2_score, 3)}</td>
                <td className="py-2 pl-4 text-right font-mono text-green-400">{fmt(r.spike_detection_rate_pct, 1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SpotForecastDashboardPage() {
  const [data, setData] = useState<SpotForecastDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartRegion, setChartRegion] = useState('NSW1')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const d = await api.getSpotForecastDashboard()
      setData(d)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        <RefreshCw size={16} className="animate-spin mr-2" /> Loading forecast data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-sm gap-2">
        <AlertTriangle size={16} /> {error ?? 'Failed to load data'}
      </div>
    )
  }

  // Filter intervals to region for chart (add placeholder rows for other regions)
  const chartIntervals: SpotForecastInterval[] = data.forecast_intervals.map(i => ({
    ...i,
    region: chartRegion,
  }))

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 rounded-xl">
            <Zap className="text-amber-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">NEM Spot Price Forecasting</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Real-time ML forecast analytics — NEURAL · GBDT · ENSEMBLE models
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data.next_spike_alert && (
            <div className="flex items-center gap-2 bg-red-900/40 border border-red-700/50 text-red-300 text-xs px-3 py-2 rounded-lg">
              <AlertTriangle size={13} />
              {data.next_spike_alert}
            </div>
          )}
          <div className="text-xs text-gray-500">
            Accuracy:{' '}
            <span className="text-green-400 font-semibold">{fmt(data.overall_forecast_accuracy_pct, 1)}%</span>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards — one per region */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {data.regional_summary.map(r => (
          <RegionKpiCard key={r.region} r={r} />
        ))}
      </div>

      {/* Forecast Bands Chart */}
      <ForecastBandsChart
        intervals={chartIntervals}
        selectedRegion={chartRegion}
        onRegionChange={setChartRegion}
      />

      {/* Bottom row — tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RegionalSummaryTable rows={data.regional_summary} />
        <ModelPerformanceTable records={data.model_performance} />
      </div>
    </div>
  )
}
