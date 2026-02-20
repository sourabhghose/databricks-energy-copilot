import { useEffect, useState } from 'react'
import { BarChart2 } from 'lucide-react'
import {
  getDemandForecastAccuracyDashboard,
  DFADashboard,
  DFAHorizonSummaryRecord,
  DFASeasonalBiasRecord,
  DFAErrorRecord,
  DFAModelBenchmarkRecord,
} from '../api/client'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
} from 'recharts'

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  sub,
  valueColor,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold" style={{ color: valueColor ?? '#fff' }}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PRODUCTION: { bg: '#14532d55', text: '#4ade80' },
  TESTING:    { bg: '#78350f55', text: '#fbbf24' },
  DEPRECATED: { bg: '#7f1d1d55', text: '#f87171' },
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { bg: '#1f293755', text: '#94a3b8' }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded"
      style={{ background: style.bg, color: style.text }}
    >
      {status}
    </span>
  )
}

const MODEL_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  ENSEMBLE:         { bg: '#1e3a5f55', text: '#60a5fa' },
  GRADIENT_BOOST:   { bg: '#14532d55', text: '#4ade80' },
  DEEP_LEARNING:    { bg: '#581c8755', text: '#c084fc' },
  TIME_SERIES:      { bg: '#78350f55', text: '#fbbf24' },
  STATISTICAL:      { bg: '#1f293755', text: '#94a3b8' },
  STACKING_ENSEMBLE:{ bg: '#0c4a6e55', text: '#38bdf8' },
}

function ModelTypeBadge({ type }: { type: string }) {
  const style = MODEL_TYPE_STYLES[type] ?? { bg: '#1f293755', text: '#94a3b8' }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded"
      style={{ background: style.bg, color: style.text }}
    >
      {type.replace(/_/g, ' ')}
    </span>
  )
}

// ── Region tabs ───────────────────────────────────────────────────────────────

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

function RegionTabs({
  selected,
  onChange,
}: {
  selected: string
  onChange: (r: string) => void
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {REGIONS.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
            selected === r
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

// ── Horizon Accuracy Chart ────────────────────────────────────────────────────

function HorizonAccuracyChart({ data }: { data: DFAHorizonSummaryRecord[] }) {
  const [selectedRegion, setSelectedRegion] = useState('NSW1')

  const chartData = data
    .filter((d) => d.region === selectedRegion)
    .sort((a, b) => a.horizon_min - b.horizon_min)
    .map((d) => ({
      horizon: `${d.horizon_min}m`,
      MAE: d.mae_mw,
      RMSE: d.rmse_mw,
      skill_score: d.skill_score,
    }))

  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-100">
          Horizon Accuracy — MAE / RMSE &amp; Skill Score
        </h2>
        <RegionTabs selected={selectedRegion} onChange={setSelectedRegion} />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 40, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="horizon" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 1]}
            tick={{ fill: '#4ade80', fontSize: 12 }}
            label={{ value: 'Skill Score', angle: 90, position: 'insideRight', fill: '#4ade80', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="MAE" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={40} />
          <Bar yAxisId="left" dataKey="RMSE" fill="#a855f7" radius={[3, 3, 0, 0]} maxBarSize={40} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="skill_score"
            stroke="#4ade80"
            strokeWidth={2}
            dot={{ fill: '#4ade80', r: 4 }}
            name="Skill Score"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Seasonal Bias Heatmap ─────────────────────────────────────────────────────

const SEASONS = ['SUMMER', 'AUTUMN', 'WINTER', 'SPRING']
const TIMES_OF_DAY = ['MORNING_PEAK', 'MIDDAY', 'EVENING_PEAK', 'OVERNIGHT']
const TOD_LABELS: Record<string, string> = {
  MORNING_PEAK:  'Morning Peak',
  MIDDAY:        'Midday',
  EVENING_PEAK:  'Evening Peak',
  OVERNIGHT:     'Overnight',
}

function biasColor(value: number, maxAbs: number): string {
  const intensity = Math.min(Math.abs(value) / maxAbs, 1)
  if (value > 0) {
    // Over-forecast: red
    const r = Math.round(239 * intensity + 31 * (1 - intensity))
    const g = Math.round(68 * intensity + 41 * (1 - intensity))
    const b = Math.round(68 * intensity + 55 * (1 - intensity))
    return `rgb(${r},${g},${b})`
  } else if (value < 0) {
    // Under-forecast: blue
    const r = Math.round(59 * intensity + 31 * (1 - intensity))
    const g = Math.round(130 * intensity + 41 * (1 - intensity))
    const b = Math.round(246 * intensity + 55 * (1 - intensity))
    return `rgb(${r},${g},${b})`
  }
  return 'rgb(31,41,55)'
}

function SeasonalBiasHeatmap({ data }: { data: DFASeasonalBiasRecord[] }) {
  const [selectedRegion, setSelectedRegion] = useState('NSW1')

  const regionData = data.filter((d) => d.region === selectedRegion)
  const allValues = regionData.map((d) => Math.abs(d.avg_error_mw))
  const maxAbs = Math.max(...allValues, 1)

  function getCell(season: string, tod: string): DFASeasonalBiasRecord | undefined {
    return regionData.find((d) => d.season === season && d.time_of_day === tod)
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-100">
          Seasonal Bias Heatmap
          <span className="ml-2 text-xs font-normal text-gray-400">
            Red = Over-forecast &bull; Blue = Under-forecast
          </span>
        </h2>
        <RegionTabs selected={selectedRegion} onChange={setSelectedRegion} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-gray-400 font-medium w-28">Season</th>
              {TIMES_OF_DAY.map((tod) => (
                <th key={tod} className="p-2 text-center text-gray-400 font-medium">
                  {TOD_LABELS[tod]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SEASONS.map((season) => (
              <tr key={season}>
                <td className="p-2 text-gray-300 font-semibold">{season}</td>
                {TIMES_OF_DAY.map((tod) => {
                  const cell = getCell(season, tod)
                  const val = cell?.avg_error_mw ?? 0
                  const bg = biasColor(val, maxAbs)
                  const textColor = Math.abs(val) > maxAbs * 0.4 ? '#fff' : '#d1d5db'
                  return (
                    <td
                      key={tod}
                      className="p-0"
                      title={cell ? `${cell.primary_driver}\n${cell.sample_count} samples` : ''}
                    >
                      <div
                        className="m-1 rounded p-2 text-center font-semibold"
                        style={{ background: bg, color: textColor, minWidth: 80 }}
                      >
                        <div>{val > 0 ? '+' : ''}{val.toFixed(0)} MW</div>
                        {cell && (
                          <div className="text-gray-300 font-normal mt-0.5" style={{ fontSize: 10 }}>
                            {cell.avg_error_pct > 0 ? '+' : ''}{cell.avg_error_pct.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Driver legend */}
      {(() => {
        const cell = regionData[0]
        return cell ? (
          <p className="text-xs text-gray-500 mt-1">
            Hover cells to see primary driver and sample count.
          </p>
        ) : null
      })()}
    </div>
  )
}

// ── Error Distribution Chart ──────────────────────────────────────────────────

const HORIZONS = [5, 30, 60, 120, 240]

function ErrorDistributionChart({ data }: { data: DFAErrorRecord[] }) {
  const [selectedRegion, setSelectedRegion] = useState('NSW1')
  const [selectedHorizon, setSelectedHorizon] = useState(5)

  const filtered = data.filter(
    (d) => d.region === selectedRegion && d.horizon_min === selectedHorizon
  )

  // Build histogram bins
  const values = filtered.map((d) => d.error_pct)
  const minVal = Math.min(...values, -5)
  const maxVal = Math.max(...values, 5)
  const BIN_COUNT = 10
  const binWidth = (maxVal - minVal) / BIN_COUNT

  const bins: { bin: string; OVER: number; UNDER: number; center: number }[] = Array.from(
    { length: BIN_COUNT },
    (_, i) => {
      const lo = minVal + i * binWidth
      const hi = lo + binWidth
      const center = (lo + hi) / 2
      const inBin = filtered.filter((d) => d.error_pct >= lo && d.error_pct < hi)
      return {
        bin: `${lo.toFixed(1)}`,
        center,
        OVER: inBin.filter((d) => d.direction === 'OVER').length,
        UNDER: inBin.filter((d) => d.direction === 'UNDER').length,
      }
    }
  )

  // Scatter data
  const scatterData = filtered.map((d, i) => ({
    index: i,
    error_pct: d.error_pct,
    direction: d.direction,
  }))

  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-100">Error Distribution by Region &amp; Horizon</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <RegionTabs selected={selectedRegion} onChange={setSelectedRegion} />
          <div className="flex gap-1">
            {HORIZONS.map((h) => (
              <button
                key={h}
                onClick={() => setSelectedHorizon(h)}
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                  selectedHorizon === h
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {h}m
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Histogram */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Error % Histogram (OVER / UNDER)</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={bins} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="bin" tick={{ fill: '#9ca3af', fontSize: 10 }} label={{ value: 'Error %', position: 'insideBottom', offset: -2, fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar dataKey="OVER" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
              <Bar dataKey="UNDER" stackId="a" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Scatter plot */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Scatter: Error % by Record (OVER=red / UNDER=blue)</p>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                dataKey="index"
                name="Record"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                label={{ value: 'Record #', position: 'insideBottom', offset: -2, fill: '#9ca3af', fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="error_pct"
                name="Error %"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                label={{ value: 'Error %', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(val: number) => [`${val.toFixed(2)}%`, 'Error']}
              />
              <Scatter name="Errors" data={scatterData}>
                {scatterData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.direction === 'OVER' ? '#ef4444' : '#3b82f6'}
                    opacity={0.75}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Showing {filtered.length} records for {selectedRegion} at {selectedHorizon}-minute horizon.
      </div>
    </div>
  )
}

// ── Model Benchmark Table ─────────────────────────────────────────────────────

function ModelBenchmarkTable({ data }: { data: DFAModelBenchmarkRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-100">Model Performance Benchmarking</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              {[
                'Model Name', 'Type', 'Region',
                'MAE (MW)', 'RMSE (MW)', 'MAPE (%)',
                'Training Data', 'Features', 'Status', 'Last Retrained',
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((m, i) => (
              <tr
                key={i}
                className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                <td className="px-3 py-2 text-gray-100 font-medium whitespace-nowrap">{m.model_name}</td>
                <td className="px-3 py-2">
                  <ModelTypeBadge type={m.model_type} />
                </td>
                <td className="px-3 py-2 text-gray-300">{m.region}</td>
                <td className="px-3 py-2 text-blue-400 font-semibold">{m.mae_mw.toFixed(0)}</td>
                <td className="px-3 py-2 text-purple-400 font-semibold">{m.rmse_mw.toFixed(0)}</td>
                <td className="px-3 py-2 text-amber-400 font-semibold">{m.mape_pct.toFixed(2)}%</td>
                <td className="px-3 py-2 text-gray-300">{m.training_data_years} yr</td>
                <td className="px-3 py-2 text-gray-400 max-w-xs truncate" title={m.features_used}>
                  {m.features_used}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={m.deployment_status} />
                </td>
                <td className="px-3 py-2 text-gray-400">{m.last_retrained}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DemandForecastAccuracyAnalytics() {
  const [data, setData] = useState<DFADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDemandForecastAccuracyDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading Demand Forecast Accuracy...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-sm">{error ?? 'Unknown error'}</div>
      </div>
    )
  }

  const summary = data.summary
  const bestMape = typeof summary.best_model_mape_pct === 'number' ? summary.best_model_mape_pct : 0
  const bestHorizon = typeof summary.best_horizon_min === 'number' ? summary.best_horizon_min : 0
  const productionModels = typeof summary.production_models === 'number' ? summary.production_models : 0
  const seasonalBiasRecords = typeof summary.seasonal_bias_records === 'number' ? summary.seasonal_bias_records : 0

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart2 className="text-blue-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">Demand Forecast Accuracy Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            NEM pre-dispatch vs actual demand errors — horizon analysis, seasonal biases, model benchmarking
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Best Model MAPE"
          value={bestMape.toFixed(2)}
          unit="%"
          sub="Ensemble NEM Realtime"
          valueColor="#4ade80"
        />
        <KpiCard
          label="Best Horizon"
          value={bestHorizon}
          unit="min"
          sub="Shortest forecast window"
          valueColor="#60a5fa"
        />
        <KpiCard
          label="Production Models"
          value={productionModels}
          sub="Active in NEM dispatch"
          valueColor="#fbbf24"
        />
        <KpiCard
          label="Seasonal Bias Records"
          value={seasonalBiasRecords}
          sub="Season x Time-of-day x Region"
          valueColor="#c084fc"
        />
      </div>

      {/* Horizon Accuracy */}
      <HorizonAccuracyChart data={data.horizon_summary} />

      {/* Seasonal Bias Heatmap */}
      <SeasonalBiasHeatmap data={data.seasonal_bias} />

      {/* Error Distribution */}
      <ErrorDistributionChart data={data.error_records} />

      {/* Model Benchmark Table */}
      <ModelBenchmarkTable data={data.model_benchmarks} />
    </div>
  )
}
