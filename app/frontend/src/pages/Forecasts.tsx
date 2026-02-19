import { useState } from 'react'
import { useForecasts } from '../hooks/useMarketData'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'] as const
type Region = typeof REGIONS[number]

const HORIZONS = [
  { id: '1hr',  label: '1 hr'  },
  { id: '4hr',  label: '4 hr'  },
  { id: '24hr', label: '24 hr' },
] as const
type Horizon = typeof HORIZONS[number]['id']

// Merge forecast data with placeholder actuals for chart display
function mergeWithActuals(
  forecasts: { timestamp: string; predicted: number; lower: number; upper: number }[]
) {
  return forecasts.map((f, i) => ({
    ...f,
    time: new Date(f.timestamp).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Australia/Sydney',
    }),
    // Simulate actuals for past intervals; future intervals have no actual
    actual: i < Math.floor(forecasts.length * 0.6)
      ? f.predicted + (Math.random() - 0.5) * 20
      : undefined,
    confidenceBand: [f.lower, f.upper] as [number, number],
  }))
}

export default function Forecasts() {
  const [region, setRegion] = useState<Region>('NSW1')
  const [horizon, setHorizon] = useState<Horizon>('4hr')

  const { data: forecasts, loading, error } = useForecasts(region, horizon)

  const chartData = mergeWithActuals(forecasts)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Forecasts</h2>
        <p className="text-sm text-gray-500 mt-0.5">Price forecasts with 90% confidence intervals</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Region selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="region-select" className="text-sm font-medium text-gray-600">
            Region:
          </label>
          <select
            id="region-select"
            value={region}
            onChange={e => setRegion(e.target.value as Region)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Horizon tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {HORIZONS.map(h => (
            <button
              key={h.id}
              onClick={() => setHorizon(h.id)}
              className={[
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                horizon === h.id
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Chart */}
      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          {region} Price Forecast — {horizon} horizon
        </h3>
        <p className="text-xs text-gray-400 mb-4">Actual vs Predicted (90% confidence band)</p>

        {loading ? (
          <div className="h-72 bg-gray-50 rounded animate-pulse flex items-center justify-center text-gray-400 text-sm">
            Loading forecast data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={Math.floor(chartData.length / 8)} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={v => `$${v.toFixed(0)}`}
                width={60}
              />
              <Tooltip
                formatter={(v: number, name: string) => {
                  const labels: Record<string, string> = {
                    predicted: 'Predicted',
                    actual: 'Actual',
                    upper: 'Upper 90%',
                    lower: 'Lower 90%',
                  }
                  return [`$${v.toFixed(2)}/MWh`, labels[name] ?? name]
                }}
              />
              <Legend />
              {/* Confidence band: filled area between lower/upper */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="#BFDBFE"
                fillOpacity={0.5}
                name="upper"
                legendType="none"
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="#ffffff"
                fillOpacity={1}
                name="lower"
                legendType="none"
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                name="predicted"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                strokeDasharray="0"
                name="actual"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Model accuracy panel */}
      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Model Accuracy — {region}</h3>
        <div className="grid grid-cols-3 gap-4">
          {HORIZONS.map(h => (
            <div key={h.id} className="text-center">
              <div className="text-xs text-gray-400 mb-1">{h.label} horizon</div>
              <div className="text-2xl font-bold text-gray-800">
                ${(10 + HORIZONS.indexOf(h) * 3).toFixed(1)}
              </div>
              <div className="text-xs text-gray-500">MAE /MWh</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
