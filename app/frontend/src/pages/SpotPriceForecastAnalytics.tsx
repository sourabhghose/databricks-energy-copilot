import { useEffect, useState, useMemo } from 'react'
import { Brain } from 'lucide-react'
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  BarChart,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import {
  getSpotPriceForecastDashboard,
  SPFDashboard,
  SPFModelRecord,
  SPFForecastRecord,
  SPFFeatureRecord,
  SPFDriftRecord,
} from '../api/client'

// ── Colours ──────────────────────────────────────────────────────────────────

const MODEL_TYPE_BADGE: Record<string, string> = {
  XGBOOST:  'bg-blue-700 text-blue-100',
  LSTM:     'bg-purple-700 text-purple-100',
  PROPHET:  'bg-amber-700 text-amber-100',
  ENSEMBLE: 'bg-emerald-700 text-emerald-100',
  LINEAR:   'bg-gray-600 text-gray-100',
}

const STATUS_BADGE: Record<string, string> = {
  PRODUCTION: 'bg-emerald-700 text-emerald-100',
  SHADOW:     'bg-yellow-700 text-yellow-100',
  DEPRECATED: 'bg-red-800 text-red-200',
}

const REGIME_COLORS: Record<string, string> = {
  NORMAL:   '#9ca3af',
  SPIKE:    '#ef4444',
  NEGATIVE: '#3b82f6',
  EXTREME:  '#a855f7',
}

const CATEGORY_COLORS: Record<string, string> = {
  DEMAND:  '#3b82f6',
  SUPPLY:  '#10b981',
  WEATHER: '#f59e0b',
  MARKET:  '#a855f7',
  TIME:    '#6b7280',
}

const MODEL_DRIFT_COLORS: Record<string, string> = {
  M001: '#60a5fa',
  M003: '#34d399',
  M004: '#f87171',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}

function KpiCard({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{title}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-gray-400 text-xs">{sub}</p>}
    </div>
  )
}

function horizonLabel(min: number) {
  if (min === 5)   return '5 min'
  if (min === 30)  return '30 min'
  if (min === 60)  return '1 hr'
  if (min === 288) return 'Day-ahead'
  return `${min} min`
}

// ── Forecast vs Actual Chart ──────────────────────────────────────────────────

interface ForecastChartProps {
  forecasts: SPFForecastRecord[]
}

function ForecastVsActualChart({ forecasts }: ForecastChartProps) {
  const regions = useMemo(() => [...new Set(forecasts.map(f => f.region))].sort(), [forecasts])
  const dates   = useMemo(() => [...new Set(forecasts.map(f => f.date))].sort(), [forecasts])
  const [region, setRegion] = useState(regions[0] ?? 'NSW1')
  const [date,   setDate]   = useState(dates[0]   ?? '')

  const chartData = useMemo(() => {
    return forecasts
      .filter(f => f.region === region && f.date === date)
      .sort((a, b) => a.trading_interval.localeCompare(b.trading_interval))
      .map(f => ({
        interval:      f.trading_interval,
        actual:        f.actual_price,
        forecast:      f.forecast_price,
        low:           f.forecast_low,
        high:          f.forecast_high,
        regime:        f.price_regime,
        regimeColor:   REGIME_COLORS[f.price_regime] ?? '#9ca3af',
      }))
  }, [forecasts, region, date])

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-white font-semibold text-base">Forecast vs Actual — Spot Price</h2>
        <div className="flex gap-2 flex-wrap">
          {/* Region tabs */}
          <div className="flex gap-1">
            {regions.map(r => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  r === region
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {/* Date selector */}
          <select
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
          >
            {dates.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Regime legend */}
      <div className="flex gap-4 mb-3 flex-wrap">
        {Object.entries(REGIME_COLORS).map(([regime, color]) => (
          <span key={regime} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
            {regime}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="interval" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6', fontSize: 12 }}
            formatter={(val: number, name: string) => [`$${val.toFixed(2)}/MWh`, name]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {/* Confidence band: low to high using two Areas stacked */}
          <Area
            dataKey="high"
            stroke="none"
            fill="#3b82f6"
            fillOpacity={0.15}
            name="Forecast High"
            legendType="none"
          />
          <Area
            dataKey="low"
            stroke="none"
            fill="#1e3a5f"
            fillOpacity={1}
            name="Forecast Low"
            legendType="none"
          />
          <Bar dataKey="actual" name="Actual Price" maxBarSize={24}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.regimeColor} fillOpacity={0.85} />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="forecast"
            name="Forecast Price"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ r: 3, fill: '#60a5fa' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Feature Importance Chart ──────────────────────────────────────────────────

interface FeatureChartProps {
  features: SPFFeatureRecord[]
}

function FeatureImportanceChart({ features }: FeatureChartProps) {
  const modelTypes = useMemo(() => [...new Set(features.map(f => f.model_type))].sort(), [features])
  const [modelType, setModelType] = useState(modelTypes[0] ?? 'XGBOOST')

  const chartData = useMemo(() => {
    return features
      .filter(f => f.model_type === modelType)
      .sort((a, b) => a.rank - b.rank)
      .map(f => ({
        feature:   f.feature_name,
        score:     f.importance_score,
        category:  f.category,
        color:     CATEGORY_COLORS[f.category] ?? '#6b7280',
      }))
  }, [features, modelType])

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-white font-semibold text-base">Feature Importance</h2>
        <div className="flex gap-1">
          {modelTypes.map(mt => (
            <button
              key={mt}
              onClick={() => setModelType(mt)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                mt === modelType
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {mt}
            </button>
          ))}
        </div>
      </div>

      {/* Category legend */}
      <div className="flex gap-4 mb-3 flex-wrap">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <span key={cat} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: color }} />
            {cat}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 32, bottom: 4, left: 130 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 0.25]}
            tickFormatter={v => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="feature"
            tick={{ fill: '#d1d5db', fontSize: 11 }}
            width={128}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6', fontSize: 12 }}
            formatter={(val: number) => [`${(val * 100).toFixed(1)}%`, 'Importance']}
          />
          <Bar dataKey="score" name="Importance" radius={[0, 3, 3, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Model Drift Monitoring Chart ──────────────────────────────────────────────

interface DriftChartProps {
  drift: SPFDriftRecord[]
  models: SPFModelRecord[]
}

function ModelDriftChart({ drift, models }: DriftChartProps) {
  const modelIds = useMemo(() => [...new Set(drift.map(d => d.model_id))].sort(), [drift])
  const [selectedModel, setSelectedModel] = useState(modelIds[0] ?? 'M001')

  const modelName = useMemo(() => {
    return models.find(m => m.model_id === selectedModel)?.model_name ?? selectedModel
  }, [models, selectedModel])

  const baselineMae = useMemo(() => {
    return drift.find(d => d.model_id === selectedModel)?.mae_baseline ?? 0
  }, [drift, selectedModel])

  const chartData = useMemo(() => {
    return drift
      .filter(d => d.model_id === selectedModel)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date:       d.date,
        rolling:    d.mae_rolling_7d,
        baseline:   d.mae_baseline,
        driftScore: d.drift_score,
        alert:      d.drift_alert,
        shift:      d.regime_shift,
        dotColor:   d.drift_alert ? '#ef4444' : '#60a5fa',
      }))
  }, [drift, selectedModel])

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-white font-semibold text-base">Model Drift Monitoring</h2>
        <div className="flex gap-1 flex-wrap">
          {modelIds.map(mid => {
            const name = models.find(m => m.model_id === mid)?.model_name ?? mid
            const color = MODEL_DRIFT_COLORS[mid] ?? '#9ca3af'
            return (
              <button
                key={mid}
                onClick={() => setSelectedModel(mid)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
                  mid === selectedModel
                    ? 'text-white border-transparent'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-gray-600'
                }`}
                style={mid === selectedModel ? { backgroundColor: color, borderColor: color } : {}}
              >
                {name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-4 mb-3 flex-wrap text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 bg-blue-400 inline-block" /> Rolling 7d MAE
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 border-t-2 border-dashed border-yellow-400 inline-block" /> Baseline MAE ({baselineMae} $/MWh)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Drift Alert
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-2 bg-emerald-700 inline-block rounded" /> Drift Score
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis
            yAxisId="mae"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'MAE $/MWh', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10, dy: 40 }}
          />
          <YAxis
            yAxisId="score"
            orientation="right"
            domain={[0, 1]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Drift Score', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 10, dy: -30 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6', fontSize: 12 }}
            formatter={(val: number, name: string) => {
              if (name === 'Rolling 7d MAE' || name === 'Baseline') return [`${val.toFixed(2)} $/MWh`, name]
              return [`${val.toFixed(3)}`, name]
            }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {/* Baseline reference line */}
          <ReferenceLine
            yAxisId="mae"
            y={baselineMae}
            stroke="#fbbf24"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: 'Baseline', position: 'right', fill: '#fbbf24', fontSize: 10 }}
          />
          {/* Alert threshold for drift score */}
          <ReferenceLine
            yAxisId="score"
            y={0.7}
            stroke="#ef4444"
            strokeDasharray="4 2"
            strokeWidth={1}
          />
          <Bar
            yAxisId="score"
            dataKey="driftScore"
            name="Drift Score"
            maxBarSize={20}
            fill="#065f46"
            fillOpacity={0.7}
          />
          <Line
            yAxisId="mae"
            type="monotone"
            dataKey="rolling"
            name="Rolling 7d MAE"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={(props: any) => {
              const { cx, cy, payload } = props
              return (
                <circle
                  key={`dot-${payload.date}`}
                  cx={cx}
                  cy={cy}
                  r={payload.alert ? 6 : 4}
                  fill={payload.dotColor}
                  stroke={payload.alert ? '#fca5a5' : '#1d4ed8'}
                  strokeWidth={payload.alert ? 2 : 1}
                />
              )
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Model Leaderboard Table ───────────────────────────────────────────────────

interface LeaderboardProps {
  models: SPFModelRecord[]
}

function ModelLeaderboard({ models }: LeaderboardProps) {
  const sorted = useMemo(() => [...models].sort((a, b) => a.mae_per_mwh - b.mae_per_mwh), [models])

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-white font-semibold text-base mb-4">Model Leaderboard</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-700">
              <th className="text-left py-2 pr-3 font-medium">Model</th>
              <th className="text-left py-2 pr-3 font-medium">Type</th>
              <th className="text-left py-2 pr-3 font-medium">Region</th>
              <th className="text-left py-2 pr-3 font-medium">Horizon</th>
              <th className="text-right py-2 pr-3 font-medium">MAE $/MWh</th>
              <th className="text-right py-2 pr-3 font-medium">RMSE</th>
              <th className="text-right py-2 pr-3 font-medium">MAPE %</th>
              <th className="text-right py-2 pr-3 font-medium">R²</th>
              <th className="text-right py-2 pr-3 font-medium">Spike Recall %</th>
              <th className="text-right py-2 pr-3 font-medium">Neg. Price %</th>
              <th className="text-left py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => (
              <tr
                key={m.model_id}
                className={`border-b border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'} hover:bg-gray-700/40 transition-colors`}
              >
                <td className="py-2 pr-3 text-white font-medium whitespace-nowrap">{m.model_name}</td>
                <td className="py-2 pr-3">
                  <Badge label={m.model_type} className={MODEL_TYPE_BADGE[m.model_type] ?? 'bg-gray-600 text-gray-100'} />
                </td>
                <td className="py-2 pr-3 text-gray-300">{m.region}</td>
                <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{horizonLabel(m.horizon_min)}</td>
                <td className="py-2 pr-3 text-right text-blue-300 font-semibold">{m.mae_per_mwh.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{m.rmse_per_mwh.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{m.mape_pct.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{m.r2_score.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right">
                  <span className={m.spike_detection_recall_pct >= 75 ? 'text-emerald-400 font-semibold' : m.spike_detection_recall_pct >= 60 ? 'text-yellow-400' : 'text-red-400'}>
                    {m.spike_detection_recall_pct}%
                  </span>
                </td>
                <td className="py-2 pr-3 text-right">
                  <span className={m.negative_price_recall_pct >= 65 ? 'text-emerald-400 font-semibold' : m.negative_price_recall_pct >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                    {m.negative_price_recall_pct}%
                  </span>
                </td>
                <td className="py-2">
                  <Badge label={m.deployment_status} className={STATUS_BADGE[m.deployment_status] ?? 'bg-gray-600 text-gray-100'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SpotPriceForecastAnalytics() {
  const [data, setData]     = useState<SPFDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    getSpotPriceForecastDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading Spot Price Forecast Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">Error: {error ?? 'No data returned'}</p>
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>
  const driftAlerts = data.drift.filter(d => d.drift_alert).length

  return (
    <div className="min-h-screen bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="text-blue-400" size={28} />
        <div>
          <h1 className="text-white text-2xl font-bold leading-tight">
            Spot Price Forecasting Model Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            NEM ML model performance, feature importance, forecast tracking and drift monitoring
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Production Models"
          value={summary.production_models as number}
          sub="Deployed to live trading"
        />
        <KpiCard
          title="Best MAE Model"
          value={summary.best_mae_model as string}
          sub="Lowest mean absolute error"
        />
        <KpiCard
          title="Best Spike Recall"
          value={`${summary.best_spike_recall_pct}%`}
          sub="LSTM SA Spike Model (Shadow)"
        />
        <KpiCard
          title="Active Drift Alerts"
          value={driftAlerts}
          sub={driftAlerts > 0 ? 'Models require retraining review' : 'All models stable'}
        />
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard
          title="Avg MAPE (Production)"
          value={`${summary.avg_mape_pct}%`}
          sub="Mean absolute percentage error"
        />
        <KpiCard
          title="Total Forecast Records"
          value={summary.total_forecasts as number}
          sub="Across all regions & dates"
        />
        <KpiCard
          title="Shadow Models"
          value={data.models.filter(m => m.deployment_status === 'SHADOW').length}
          sub="Under evaluation"
        />
      </div>

      {/* Model Leaderboard */}
      <ModelLeaderboard models={data.models} />

      {/* Forecast vs Actual + Feature Importance side-by-side on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ForecastVsActualChart forecasts={data.forecasts} />
        <FeatureImportanceChart features={data.features} />
      </div>

      {/* Model Drift Monitoring */}
      <ModelDriftChart drift={data.drift} models={data.models} />

      {/* Regime-Conditional Accuracy Summary */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-white font-semibold text-base mb-4">
          Regime-Conditional Accuracy — Production Models
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-700">
                <th className="text-left py-2 pr-4 font-medium">Model</th>
                <th className="text-left py-2 pr-4 font-medium">Region</th>
                <th className="text-right py-2 pr-4 font-medium">Spike Recall</th>
                <th className="text-right py-2 pr-4 font-medium">Neg. Price Recall</th>
                <th className="text-right py-2 pr-4 font-medium">R² Score</th>
                <th className="text-right py-2 font-medium">MAPE %</th>
              </tr>
            </thead>
            <tbody>
              {data.models
                .filter(m => m.deployment_status === 'PRODUCTION')
                .sort((a, b) => b.spike_detection_recall_pct - a.spike_detection_recall_pct)
                .map((m, i) => (
                  <tr
                    key={m.model_id}
                    className={`border-b border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-800' : ''} hover:bg-gray-700/40`}
                  >
                    <td className="py-2 pr-4 text-white font-medium">{m.model_name}</td>
                    <td className="py-2 pr-4 text-gray-300">{m.region}</td>
                    <td className="py-2 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-gray-700 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${m.spike_detection_recall_pct}%`,
                              backgroundColor: m.spike_detection_recall_pct >= 75 ? '#10b981' : m.spike_detection_recall_pct >= 60 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                        <span className={`text-xs font-semibold w-8 text-right ${m.spike_detection_recall_pct >= 75 ? 'text-emerald-400' : m.spike_detection_recall_pct >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {m.spike_detection_recall_pct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-gray-700 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${m.negative_price_recall_pct}%`,
                              backgroundColor: m.negative_price_recall_pct >= 65 ? '#10b981' : m.negative_price_recall_pct >= 50 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                        <span className={`text-xs font-semibold w-8 text-right ${m.negative_price_recall_pct >= 65 ? 'text-emerald-400' : m.negative_price_recall_pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {m.negative_price_recall_pct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-300">{m.r2_score.toFixed(2)}</td>
                    <td className="py-2 text-right text-gray-300">{m.mape_pct.toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="text-gray-500 text-xs mt-3">
          Spike Recall: % of price spikes (&gt;$300/MWh) correctly predicted. Negative Price Recall: % of negative price intervals correctly predicted.
          Color coding: green &ge;75%, yellow &ge;60%, red &lt;60%.
        </p>
      </div>
    </div>
  )
}
