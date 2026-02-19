import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'
import type {
  DemandForecastDashboard,
  DemandForecastRecord,
  PasaReliabilityRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

const REGIONS = ['NSW1', 'VIC1', 'QLD1', 'SA1', 'TAS1']
const REGION_FILTERS = ['ALL', ...REGIONS]
const HORIZON_FILTERS = ['ALL', '1h', '24h', '168h']
const HORIZON_VALUES: Record<string, number | null> = { ALL: null, '1h': 1, '24h': 24, '168h': 168 }

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  VIC1: '#8b5cf6',
  QLD1: '#f59e0b',
  SA1: '#10b981',
  TAS1: '#06b6d4',
}

function conditionBadge(cond: string) {
  const map: Record<string, string> = {
    HOT: 'bg-red-700 text-red-100',
    MODERATE: 'bg-blue-700 text-blue-100',
    COLD: 'bg-cyan-700 text-cyan-100',
    STORM: 'bg-purple-700 text-purple-100',
  }
  return map[cond] ?? 'bg-gray-600 text-gray-100'
}

function modelBadge(model: string) {
  const map: Record<string, string> = {
    AEMO_ST_PASA: 'bg-amber-700 text-amber-100',
    AEMO_MT_PASA: 'bg-orange-700 text-orange-100',
    ML_ENHANCED: 'bg-emerald-700 text-emerald-100',
  }
  return map[model] ?? 'bg-gray-600 text-gray-100'
}

function reserveColour(pct: number): string {
  if (pct >= 15) return 'text-emerald-400'
  if (pct >= 10) return 'text-amber-400'
  return 'text-red-400'
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub: string
  colour: string
}

function KpiCard({ label, value, sub, colour }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-3xl font-bold ${colour}`}>{value}</span>
      <span className="text-xs text-gray-500">{sub}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MAE by Horizon Bar Chart
// ---------------------------------------------------------------------------

interface MaeChartProps {
  records: DemandForecastRecord[]
}

function MaeByHorizonChart({ records }: MaeChartProps) {
  const horizons = [1, 4, 24, 48, 168]

  const chartData = useMemo(() => {
    return horizons.map(h => {
      const entry: Record<string, string | number> = { horizon: `${h}h` }
      REGIONS.forEach(region => {
        const filtered = records.filter(r => r.region === region && r.forecast_horizon_h === h)
        if (filtered.length > 0) {
          const avg = filtered.reduce((sum, r) => sum + r.mae_pct, 0) / filtered.length
          entry[region] = parseFloat(avg.toFixed(2))
        } else {
          entry[region] = 0
        }
      })
      return entry
    })
  }, [records])

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Average MAE (%) by Forecast Horizon & Region</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="horizon" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {REGIONS.map(region => (
            <Bar key={region} dataKey={region} fill={REGION_COLOURS[region]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Forecast Records Table
// ---------------------------------------------------------------------------

interface ForecastTableProps {
  records: DemandForecastRecord[]
}

function ForecastRecordsTable({ records }: ForecastTableProps) {
  const [regionFilter, setRegionFilter] = useState('ALL')
  const [horizonFilter, setHorizonFilter] = useState('ALL')

  const filtered = useMemo(() => {
    return records.filter(r => {
      const regionOk = regionFilter === 'ALL' || r.region === regionFilter
      const horizonOk =
        horizonFilter === 'ALL' || r.forecast_horizon_h === HORIZON_VALUES[horizonFilter]
      return regionOk && horizonOk
    })
  }, [records, regionFilter, horizonFilter])

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-300">Forecast Accuracy Records</h3>
        <div className="flex flex-wrap gap-2">
          {/* Region filter */}
          <div className="flex gap-1">
            {REGION_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setRegionFilter(f)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  regionFilter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {/* Horizon filter */}
          <div className="flex gap-1">
            {HORIZON_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setHorizonFilter(f)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  horizonFilter === f
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="pb-2 pr-3 font-medium">Region</th>
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Horizon</th>
              <th className="pb-2 pr-3 font-medium text-right">Forecast MW</th>
              <th className="pb-2 pr-3 font-medium text-right">Actual MW</th>
              <th className="pb-2 pr-3 font-medium text-right">Error MW</th>
              <th className="pb-2 pr-3 font-medium text-right">MAE %</th>
              <th className="pb-2 pr-3 font-medium">Model</th>
              <th className="pb-2 font-medium">Conditions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 60).map((rec, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-2 pr-3">
                  <span
                    className="font-semibold"
                    style={{ color: REGION_COLOURS[rec.region] ?? '#9ca3af' }}
                  >
                    {rec.region}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-300">{rec.forecast_date}</td>
                <td className="py-2 pr-3 text-gray-300">{rec.forecast_horizon_h}h</td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  {rec.forecast_mw.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  {rec.actual_mw.toLocaleString()}
                </td>
                <td
                  className={`py-2 pr-3 text-right font-semibold ${
                    rec.error_mw >= 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {rec.error_mw >= 0 ? '+' : ''}
                  {rec.error_mw.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">{rec.mae_pct.toFixed(2)}%</td>
                <td className="py-2 pr-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${modelBadge(rec.forecast_model)}`}>
                    {rec.forecast_model}
                  </span>
                </td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${conditionBadge(rec.conditions)}`}>
                    {rec.conditions}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 py-6 text-sm">No records match the selected filters.</p>
        )}
        {filtered.length > 60 && (
          <p className="text-center text-gray-500 py-2 text-xs">
            Showing 60 of {filtered.length} records.
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PASA Reliability Table
// ---------------------------------------------------------------------------

interface PasaTableProps {
  records: PasaReliabilityRecord[]
}

function PasaReliabilityTable({ records }: PasaTableProps) {
  const [regionFilter, setRegionFilter] = useState('ALL')

  const filtered = useMemo(() => {
    return records.filter(r => regionFilter === 'ALL' || r.region === regionFilter)
  }, [records, regionFilter])

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-300">PASA Reliability Assessment</h3>
        <div className="flex gap-1">
          {REGION_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setRegionFilter(f)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                regionFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="pb-2 pr-3 font-medium">Region</th>
              <th className="pb-2 pr-3 font-medium">Month</th>
              <th className="pb-2 pr-3 font-medium text-right">Reserve Margin %</th>
              <th className="pb-2 pr-3 font-medium text-right">UES MWh</th>
              <th className="pb-2 pr-3 font-medium text-right">Capacity MW</th>
              <th className="pb-2 pr-3 font-medium text-right">10% PoE MW</th>
              <th className="pb-2 pr-3 font-medium text-right">50% PoE MW</th>
              <th className="pb-2 font-medium text-center">Reliability Std</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rec, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-2 pr-3">
                  <span
                    className="font-semibold"
                    style={{ color: REGION_COLOURS[rec.region] ?? '#9ca3af' }}
                  >
                    {rec.region}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-300">{rec.month}</td>
                <td className={`py-2 pr-3 text-right font-semibold ${reserveColour(rec.reserve_margin_pct)}`}>
                  {rec.reserve_margin_pct.toFixed(1)}%
                </td>
                <td
                  className={`py-2 pr-3 text-right font-semibold ${
                    rec.ues_mwh === 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {rec.ues_mwh.toFixed(2)}
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  {rec.capacity_available_mw.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  {rec.demand_10poe_mw.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  {rec.demand_50poe_mw.toLocaleString()}
                </td>
                <td className="py-2 text-center">
                  {rec.reliability_standard_met ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-900 text-emerald-300">
                      <CheckCircle size={11} />
                      Met
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-900 text-red-300">
                      <XCircle size={11} />
                      Not Met
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 py-6 text-sm">No records match the selected filter.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DemandForecastAnalytics() {
  const [data, setData] = useState<DemandForecastDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .getDemandForecastDashboard()
      .then(d => {
        setData(d)
        setError(null)
      })
      .catch(err => setError(err.message ?? 'Failed to load demand forecast data'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-900 rounded-lg">
          <TrendingUp className="text-blue-400" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Demand Forecasting Accuracy &amp; PASA Reliability
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            AEMO ST PASA / MT PASA forecast accuracy analysis and NEM reliability assessment
          </p>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-3 bg-red-900/40 border border-red-700 rounded-xl p-4 mb-6">
          <AlertTriangle className="text-red-400 shrink-0" size={20} />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Content */}
      {data && !loading && (
        <div className="flex flex-col gap-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Avg MAE — 1h Horizon"
              value={`${data.avg_mae_1h_pct.toFixed(2)}%`}
              sub="Short-term accuracy across all NEM regions"
              colour="text-emerald-400"
            />
            <KpiCard
              label="Avg MAE — 24h Horizon"
              value={`${data.avg_mae_24h_pct.toFixed(2)}%`}
              sub="Day-ahead forecast error"
              colour="text-amber-400"
            />
            <KpiCard
              label="Avg MAE — 168h Horizon"
              value={`${data.avg_mae_168h_pct.toFixed(2)}%`}
              sub="Week-ahead forecast error"
              colour="text-red-400"
            />
          </div>

          {/* MAE by Horizon Chart */}
          <MaeByHorizonChart records={data.forecast_records} />

          {/* Forecast Records Table */}
          <ForecastRecordsTable records={data.forecast_records} />

          {/* PASA Reliability Table */}
          <PasaReliabilityTable records={data.pasa_records} />
        </div>
      )}
    </div>
  )
}
