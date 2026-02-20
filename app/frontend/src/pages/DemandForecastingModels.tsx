import React, { useEffect, useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
} from 'recharts'
import { Brain, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  api,
  DemandForecastModelsDashboard,
  DFMModelRecord,
  DFMForecastRecord,
  DFMSeasonalPatternRecord,
  DFMFeatureImportanceRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_COLORS: Record<string, string> = {
  ARIMA:    '#f59e0b',
  LSTM:     '#3b82f6',
  XGBoost:  '#10b981',
  Prophet:  '#a855f7',
  Ensemble: '#ef4444',
  SARIMA:   '#06b6d4',
}

const SEASON_BADGE: Record<string, string> = {
  SUMMER: 'bg-orange-700 text-orange-100',
  AUTUMN: 'bg-amber-700 text-amber-100',
  WINTER: 'bg-blue-700 text-blue-100',
  SPRING: 'bg-green-700 text-green-100',
}

const FEATURE_LABELS: Record<string, string> = {
  TEMPERATURE:       'Temperature',
  TIME_OF_DAY:       'Time of Day',
  DAY_OF_WEEK:       'Day of Week',
  HOLIDAY:           'Holiday',
  SOLAR_OUTPUT:      'Solar Output',
  ECONOMIC_ACTIVITY: 'Economic Activity',
  HUMIDITY:          'Humidity',
}

const FEATURE_COLORS: Record<string, string> = {
  TEMPERATURE:       '#ef4444',
  TIME_OF_DAY:       '#3b82f6',
  DAY_OF_WEEK:       '#10b981',
  HOLIDAY:           '#f59e0b',
  SOLAR_OUTPUT:      '#eab308',
  ECONOMIC_ACTIVITY: '#8b5cf6',
  HUMIDITY:          '#06b6d4',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt1(v: number): string { return v.toFixed(1) }
function fmt2(v: number): string { return v.toFixed(2) }
function fmtMW(v: number): string { return `${v.toFixed(0)} MW` }
function fmtPct(v: number): string { return `${v.toFixed(2)}%` }

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  accent?: string
}

function KpiCard({ label, value, sub, accent = 'text-blue-400' }: KpiCardProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sortable column header
// ---------------------------------------------------------------------------

type SortDir = 'asc' | 'desc'

interface SortState {
  col: keyof DFMModelRecord
  dir: SortDir
}

function SortHeader({
  label,
  col,
  sort,
  onSort,
}: {
  label: string
  col: keyof DFMModelRecord
  sort: SortState
  onSort: (col: keyof DFMModelRecord) => void
}) {
  const active = sort.col === col
  return (
    <th
      className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-white transition-colors"
      onClick={() => onSort(col)}
    >
      {label}
      <span className="ml-1 text-gray-600">
        {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  )
}

// ---------------------------------------------------------------------------
// Model Performance Table
// ---------------------------------------------------------------------------

function ModelPerformanceTable({ models }: { models: DFMModelRecord[] }) {
  const [sort, setSort] = useState<SortState>({ col: 'mape_pct', dir: 'asc' })
  const [regionFilter, setRegionFilter] = useState<string>('NSW1')

  function handleSort(col: keyof DFMModelRecord) {
    setSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' },
    )
  }

  const regions = useMemo(
    () => Array.from(new Set(models.map(m => m.region))).sort(),
    [models],
  )

  const filtered = useMemo(
    () => models.filter(m => m.region === regionFilter),
    [models, regionFilter],
  )

  const bestMape = useMemo(
    () => Math.min(...filtered.map(m => m.mape_pct)),
    [filtered],
  )

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      const av = a[sort.col]
      const bv = b[sort.col]
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, sort])

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Model Performance Comparison</h2>
        <div className="flex gap-2">
          {regions.map(r => (
            <button
              key={r}
              onClick={() => setRegionFilter(r)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                regionFilter === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <SortHeader label="Model"     col="name"                sort={sort} onSort={handleSort} />
              <SortHeader label="MAE (MW)"  col="mae_mw"              sort={sort} onSort={handleSort} />
              <SortHeader label="RMSE (MW)" col="rmse_mw"             sort={sort} onSort={handleSort} />
              <SortHeader label="MAPE %"    col="mape_pct"            sort={sort} onSort={handleSort} />
              <SortHeader label="R²"        col="r_squared"           sort={sort} onSort={handleSort} />
              <SortHeader label="Trn Yrs"   col="training_data_years" sort={sort} onSort={handleSort} />
              <SortHeader label="Retrained" col="last_retrained"      sort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map(m => {
              const isBest = m.mape_pct === bestMape
              const dot = MODEL_COLORS[m.name] ?? '#6b7280'
              return (
                <tr
                  key={m.model_id}
                  className={`border-b border-gray-700/40 hover:bg-gray-700/30 transition-colors ${
                    isBest ? 'bg-green-900/10' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-white">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: dot }}
                    />
                    {m.name}
                    {isBest && (
                      <span className="ml-2 text-xs bg-green-700 text-green-100 px-1.5 py-0.5 rounded">
                        Best
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-300">{fmt1(m.mae_mw)}</td>
                  <td className="px-3 py-2 text-gray-300">{fmt1(m.rmse_mw)}</td>
                  <td className={`px-3 py-2 font-semibold ${isBest ? 'text-green-400' : 'text-gray-300'}`}>
                    {fmtPct(m.mape_pct)}
                  </td>
                  <td className="px-3 py-2 text-gray-300">{fmt2(m.r_squared)}</td>
                  <td className="px-3 py-2 text-gray-300">{m.training_data_years}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{m.last_retrained}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 24-hour forecast chart
// ---------------------------------------------------------------------------

function ForecastChart({ forecasts }: { forecasts: DFMForecastRecord[] }) {
  const nsw = forecasts.filter(f => f.region === 'NSW1')

  const byHour = useMemo(() => {
    const hours: Record<number, Record<string, number | null>> = {}
    for (let h = 0; h < 24; h++) {
      hours[h] = { hour: h, actual: null, lstm: null, ensemble: null, lstm_lo: null, lstm_hi: null, ens_lo: null, ens_hi: null }
    }
    for (const f of nsw) {
      if (f.model_id === 'lstm_nsw1') {
        hours[f.hour].lstm     = f.forecast_mw
        hours[f.hour].lstm_lo  = f.lower_bound_mw
        hours[f.hour].lstm_hi  = f.upper_bound_mw
        hours[f.hour].actual   = f.actual_mw ?? null
      }
      if (f.model_id === 'ensemble_nsw1') {
        hours[f.hour].ensemble = f.forecast_mw
        hours[f.hour].ens_lo   = f.lower_bound_mw
        hours[f.hour].ens_hi   = f.upper_bound_mw
      }
    }
    return Array.from({ length: 24 }, (_, h) => ({ ...hours[h], label: `${h}:00` }))
  }, [nsw])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-xs shadow-xl">
        <p className="text-gray-300 font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }} className="mb-0.5">
            {p.name}: {p.value != null ? `${Number(p.value).toFixed(0)} MW` : '—'}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <h2 className="text-base font-semibold text-white mb-1">
        24-Hour Demand Forecast — NSW1 (15 Jan 2025)
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        LSTM vs Ensemble vs Actual demand with 90% confidence intervals
      </p>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={byHour} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            interval={1}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            domain={['auto', 'auto']}
            tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
            label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 12 }}
          />
          {/* LSTM confidence band */}
          <Area
            dataKey="lstm_hi"
            fill="#3b82f6"
            stroke="none"
            fillOpacity={0.12}
            name="LSTM CI Upper"
            legendType="none"
          />
          <Area
            dataKey="lstm_lo"
            fill="#3b82f6"
            stroke="none"
            fillOpacity={0}
            name="LSTM CI Lower"
            legendType="none"
          />
          {/* Ensemble confidence band */}
          <Area
            dataKey="ens_hi"
            fill="#ef4444"
            stroke="none"
            fillOpacity={0.12}
            name="Ensemble CI Upper"
            legendType="none"
          />
          <Area
            dataKey="ens_lo"
            fill="#ef4444"
            stroke="none"
            fillOpacity={0}
            name="Ensemble CI Lower"
            legendType="none"
          />
          {/* Forecast lines */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#ffffff"
            strokeWidth={2}
            dot={false}
            name="Actual"
          />
          <Line
            type="monotone"
            dataKey="lstm"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            name="LSTM"
          />
          <Line
            type="monotone"
            dataKey="ensemble"
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="8 3"
            dot={false}
            name="Ensemble"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature importance horizontal bar chart
// ---------------------------------------------------------------------------

const ALL_FEATURES = [
  'TEMPERATURE', 'TIME_OF_DAY', 'DAY_OF_WEEK',
  'HOLIDAY', 'SOLAR_OUTPUT', 'ECONOMIC_ACTIVITY', 'HUMIDITY',
]

function FeatureImportanceChart({ data }: { data: DFMFeatureImportanceRecord[] }) {
  const nsw1Models = ['lstm_nsw1', 'xgb_nsw1', 'ensemble_nsw1']
  const nsw1Labels: Record<string, string> = {
    lstm_nsw1:     'LSTM',
    xgb_nsw1:      'XGBoost',
    ensemble_nsw1: 'Ensemble',
  }

  const chartData = useMemo(() => {
    return ALL_FEATURES.map(feat => {
      const row: Record<string, string | number> = { feature: FEATURE_LABELS[feat] ?? feat }
      for (const mid of nsw1Models) {
        const rec = data.find(d => d.model_id === mid && d.feature === feat)
        row[mid] = rec ? parseFloat((rec.importance_score * 100).toFixed(1)) : 0
      }
      return row
    })
  }, [data])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-xs shadow-xl">
        <p className="text-gray-300 font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.fill }} className="mb-0.5">
            {nsw1Labels[p.dataKey] ?? p.dataKey}: {p.value}%
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <h2 className="text-base font-semibold text-white mb-1">
        Feature Importance — NSW1 Models
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Relative importance of each input feature (%) across LSTM, XGBoost, and Ensemble
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 30, left: 110, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={v => `${v}%`}
            domain={[0, 60]}
          />
          <YAxis
            type="category"
            dataKey="feature"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            width={105}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="lstm_nsw1"     name="LSTM"     fill="#3b82f6" radius={[0, 3, 3, 0]} />
          <Bar dataKey="xgb_nsw1"      name="XGBoost"  fill="#10b981" radius={[0, 3, 3, 0]} />
          <Bar dataKey="ensemble_nsw1" name="Ensemble" fill="#ef4444" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seasonal Patterns Table
// ---------------------------------------------------------------------------

function SeasonalPatternsTable({ patterns }: { patterns: DFMSeasonalPatternRecord[] }) {
  const [regionFilter, setRegionFilter] = useState<string>('NSW1')

  const regions = useMemo(
    () => Array.from(new Set(patterns.map(p => p.region))).sort(),
    [patterns],
  )

  const filtered = useMemo(
    () => patterns.filter(p => p.region === regionFilter),
    [patterns, regionFilter],
  )

  const maxPeak = useMemo(() => Math.max(...filtered.map(p => p.peak_demand_mw)), [filtered])

  function peakColor(v: number): string {
    const ratio = v / maxPeak
    if (ratio > 0.95) return 'text-red-400 font-bold'
    if (ratio > 0.85) return 'text-orange-400 font-semibold'
    if (ratio > 0.70) return 'text-amber-400'
    return 'text-gray-300'
  }

  function sensColor(v: number): string {
    if (v < 0) return 'text-blue-400'
    if (v > 150) return 'text-red-400'
    if (v > 80) return 'text-orange-400'
    return 'text-gray-300'
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Seasonal Demand Patterns</h2>
        <div className="flex gap-2">
          {regions.map(r => (
            <button
              key={r}
              onClick={() => setRegionFilter(r)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                regionFilter === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Season</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Peak Demand</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Avg Demand</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Min Demand</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Peak Hour</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Temp Sensitivity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr
                key={`${p.region}-${p.season}`}
                className="border-b border-gray-700/40 hover:bg-gray-700/30 transition-colors"
              >
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${SEASON_BADGE[p.season] ?? 'bg-gray-700 text-gray-200'}`}>
                    {p.season}
                  </span>
                </td>
                <td className={`px-3 py-2 ${peakColor(p.peak_demand_mw)}`}>
                  {fmtMW(p.peak_demand_mw)}
                </td>
                <td className="px-3 py-2 text-gray-300">{fmtMW(p.avg_demand_mw)}</td>
                <td className="px-3 py-2 text-gray-400">{fmtMW(p.min_demand_mw)}</td>
                <td className="px-3 py-2 text-gray-300">{p.peak_hour}:00</td>
                <td className={`px-3 py-2 font-medium ${sensColor(p.temp_sensitivity_mw_per_degc)}`}>
                  {p.temp_sensitivity_mw_per_degc > 0 ? '+' : ''}
                  {fmt1(p.temp_sensitivity_mw_per_degc)} MW/°C
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
// Main Page
// ---------------------------------------------------------------------------

export default function DemandForecastingModels() {
  const [data, setData]     = useState<DemandForecastModelsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const d = await api.getDemandForecastModelsDashboard()
      setData(d)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Derive KPIs from NSW1 models (6 primary models)
  const nsw1Models = useMemo(
    () => (data?.models ?? []).filter(m => m.region === 'NSW1'),
    [data],
  )
  const bestMape  = useMemo(() => nsw1Models.length ? Math.min(...nsw1Models.map(m => m.mape_pct)) : 0, [nsw1Models])
  const bestRmse  = useMemo(() => nsw1Models.length ? Math.min(...nsw1Models.map(m => m.rmse_mw)) : 0, [nsw1Models])
  const bestR2    = useMemo(() => nsw1Models.length ? Math.max(...nsw1Models.map(m => m.r_squared)) : 0, [nsw1Models])
  const modelCount = useMemo(() => new Set(data?.models.map(m => m.name) ?? []).size, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2 w-5 h-5" />
        Loading demand forecasting models...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-6 text-red-400">
        <AlertTriangle className="w-5 h-5" />
        {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 space-y-6 text-white">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 bg-blue-900/40 rounded-lg">
            <Brain className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              Electricity Demand Forecasting Models
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Comparative analysis of ML forecasting approaches across NEM regions — ARIMA, LSTM,
              XGBoost, Prophet, SARIMA, and Ensemble methods evaluated on accuracy and reliability.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Best Model MAPE"
          value={fmtPct(bestMape)}
          sub="Ensemble — NSW1"
          accent="text-green-400"
        />
        <KpiCard
          label="Best RMSE"
          value={`${fmt1(bestRmse)} MW`}
          sub="Ensemble — NSW1"
          accent="text-blue-400"
        />
        <KpiCard
          label="Best R²"
          value={fmt2(bestR2)}
          sub="Ensemble — NSW1"
          accent="text-purple-400"
        />
        <KpiCard
          label="Models Compared"
          value={String(modelCount)}
          sub="Across 5 NEM regions"
          accent="text-amber-400"
        />
      </div>

      {/* Model Performance Table */}
      <ModelPerformanceTable models={data.models} />

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ForecastChart forecasts={data.forecasts} />
        <FeatureImportanceChart data={data.feature_importance} />
      </div>

      {/* Seasonal Patterns */}
      <SeasonalPatternsTable patterns={data.seasonal_patterns} />

      {/* Footer */}
      <p className="text-xs text-gray-600 text-right">
        Data as of {new Date(data.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
      </p>
    </div>
  )
}
