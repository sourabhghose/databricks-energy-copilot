import { useState, useEffect } from 'react'
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
  ReferenceLine,
  Cell,
} from 'recharts'
import { Target, Clock, TrendingUp, AlertTriangle, Zap, Activity } from 'lucide-react'
import { api } from '../api/client'
import type {
  DispatchDashboard,
  PredispatchInterval,
  FiveMinuteSettlementSummary,
  DispatchAccuracyStats,
} from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const REGIONS = ['SA1', 'NSW1', 'QLD1', 'VIC1', 'TAS1']

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-4 shadow-sm">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide truncate">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 leading-none">
          {value}
        </p>
        {sub && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom tooltip for the pre-dispatch chart
// ---------------------------------------------------------------------------
interface TooltipPayloadItem {
  dataKey: string
  value: number
  color: string
  name: string
}

function PredispatchTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-100 shadow-xl min-w-[180px]">
      <p className="font-semibold text-gray-300 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4 mb-1">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono font-semibold">
            {typeof p.value === 'number'
              ? `$${p.value.toFixed(1)}/MWh`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Constraint strip along chart bottom
// ---------------------------------------------------------------------------
function ConstraintStrip({ intervals }: { intervals: PredispatchInterval[] }) {
  return (
    <div className="flex gap-0.5 mt-2 px-12">
      {intervals.map((iv) => (
        <div
          key={iv.interval}
          title={
            iv.constraint_active
              ? `${iv.interval} — Binding constraint active`
              : `${iv.interval} — No constraint`
          }
          className={`flex-1 h-2 rounded-sm transition-colors ${
            iv.constraint_active
              ? 'bg-red-500'
              : 'bg-gray-200 dark:bg-gray-700'
          }`}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Horizon badge
// ---------------------------------------------------------------------------
function HorizonBadge({ horizon }: { horizon: string }) {
  const colorMap: Record<string, string> = {
    '30-min': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    '1-hour': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    '2-hour': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  }
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
        colorMap[horizon] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {horizon}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Region chip
// ---------------------------------------------------------------------------
function RegionChip({ region }: { region: string }) {
  const colorMap: Record<string, string> = {
    SA1:  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    NSW1: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    QLD1: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    VIC1: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    TAS1: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  }
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
        colorMap[region] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {region}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Five-minute settlement table
// ---------------------------------------------------------------------------
function FiveMinTable({ summaries }: { summaries: FiveMinuteSettlementSummary[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <Clock size={16} className="text-purple-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          5-Minute Settlement Analysis
        </h2>
        <span className="ml-auto text-xs text-gray-400">SA1 — midday to afternoon</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 uppercase tracking-wide text-[10px]">
              <th className="px-4 py-2.5 text-left">Trading Period</th>
              <th className="px-4 py-2.5 text-right">Min ($/MWh)</th>
              <th className="px-4 py-2.5 text-right">Max ($/MWh)</th>
              <th className="px-4 py-2.5 text-right">Avg ($/MWh)</th>
              <th className="px-4 py-2.5 text-right">30-min equiv</th>
              <th className="px-4 py-2.5 text-right">5-min vs 30-min</th>
              <th className="px-4 py-2.5 text-center">Volatility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {summaries.map((s) => (
              <tr
                key={s.trading_period}
                className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                  s.high_volatility ? 'bg-red-50/40 dark:bg-red-900/10' : ''
                }`}
              >
                <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-200">
                  {s.trading_period}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-mono ${
                    s.min_price < 0
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {s.min_price < 0 ? '' : ''}${s.min_price.toFixed(1)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">
                  ${s.max_price.toFixed(1)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">
                  ${s.avg_price.toFixed(1)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-500 dark:text-gray-400">
                  ${s.trading_price.toFixed(1)}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-mono font-semibold ${
                    s.five_min_vs_30min_diff >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {s.five_min_vs_30min_diff >= 0 ? '+' : ''}
                  ${s.five_min_vs_30min_diff.toFixed(1)}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {s.high_volatility ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-bold">
                      <AlertTriangle size={10} />
                      HIGH
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  )}
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
// Dispatch accuracy stats table
// ---------------------------------------------------------------------------
function AccuracyTable({ stats }: { stats: DispatchAccuracyStats[] }) {
  function maeColor(mae: number) {
    if (mae < 15) return 'text-green-600 dark:text-green-400'
    if (mae < 30) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <Target size={16} className="text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Dispatch Forecast Accuracy
        </h2>
        <span className="ml-auto text-xs text-gray-400">All regions — 2026-02-19</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 uppercase tracking-wide text-[10px]">
              <th className="px-4 py-2.5 text-left">Region</th>
              <th className="px-4 py-2.5 text-left">Horizon</th>
              <th className="px-4 py-2.5 text-right">MAE ($/MWh)</th>
              <th className="px-4 py-2.5 text-right">RMSE</th>
              <th className="px-4 py-2.5 text-right">Bias</th>
              <th className="px-4 py-2.5 text-right">Within 10%</th>
              <th className="px-4 py-2.5 text-right">Spike Detection</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {stats.map((s, i) => (
              <tr
                key={`${s.region}-${s.predispatch_horizon}-${i}`}
                className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <td className="px-4 py-2.5">
                  <RegionChip region={s.region} />
                </td>
                <td className="px-4 py-2.5">
                  <HorizonBadge horizon={s.predispatch_horizon} />
                </td>
                <td className={`px-4 py-2.5 text-right font-mono font-semibold ${maeColor(s.mean_absolute_error_aud)}`}>
                  ${s.mean_absolute_error_aud.toFixed(1)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-gray-400">
                  ${s.root_mean_square_error_aud.toFixed(1)}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-mono font-semibold ${
                    s.bias_aud > 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {s.bias_aud >= 0 ? '+' : ''}${s.bias_aud.toFixed(1)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">
                  {s.accuracy_within_10pct.toFixed(1)}%
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-20 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          s.spike_detection_rate_pct >= 85
                            ? 'bg-green-500'
                            : s.spike_detection_rate_pct >= 75
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${s.spike_detection_rate_pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-gray-700 dark:text-gray-300 text-[11px]">
                      {s.spike_detection_rate_pct.toFixed(0)}%
                    </span>
                  </div>
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
// Main page component
// ---------------------------------------------------------------------------
export default function DispatchAccuracy() {
  const [region, setRegion] = useState<string>('SA1')
  const [dashboard, setDashboard] = useState<DispatchDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .getDispatchDashboard({ region })
      .then((data) => {
        setDashboard(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [region])

  // Build chart data — merge interval data for display
  const chartData = (dashboard?.predispatch_intervals ?? []).map((iv) => ({
    interval: iv.interval,
    predispatch_price: iv.predispatch_price,
    actual_price: iv.actual_price,
    price_error: iv.price_error,
    constraint_active: iv.constraint_active,
  }))

  return (
    <div className="p-6 space-y-6 min-h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target size={22} className="text-blue-500" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Pre-dispatch Accuracy &amp; 5-Minute Settlement
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pre-dispatch forecast vs actual dispatch prices, 5-minute settlement
            impact analysis, and energy dispatch errors — NEM regions
          </p>
        </div>

        {/* Region selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Region:
          </span>
          <div className="flex gap-1">
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  region === r
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading / error states */}
      {loading && (
        <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500">
          <Activity size={20} className="animate-spin mr-2" />
          Loading dispatch data...
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {dashboard && !loading && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Avg Price Error"
              value={`$${dashboard.today_avg_price_error.toFixed(1)}/MWh`}
              sub="Mean absolute error today"
              icon={Target}
              color="bg-blue-500"
            />
            <KpiCard
              label="Max Price Error"
              value={`$${dashboard.today_max_price_error.toFixed(0)}/MWh`}
              sub="Worst single interval"
              icon={TrendingUp}
              color={dashboard.today_max_price_error > 200 ? 'bg-red-500' : 'bg-amber-500'}
            />
            <KpiCard
              label="5-Min Settlement Advantage"
              value={`$${dashboard.five_min_settlement_advantage_generators.toFixed(2)}M`}
              sub="Generators vs old 30-min regime"
              icon={Zap}
              color="bg-green-500"
            />
            <KpiCard
              label="Negative Price Intervals"
              value={String(dashboard.intervals_with_negative_prices)}
              sub={`${dashboard.intervals_with_spikes} spike interval(s) today`}
              icon={AlertTriangle}
              color={dashboard.intervals_with_negative_prices > 0 ? 'bg-purple-500' : 'bg-gray-500'}
            />
          </div>

          {/* Pre-dispatch vs Actual chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Pre-dispatch vs Actual Price
              </h2>
              <span className="ml-auto text-xs text-gray-400">
                {region} — 00:00–23:00 (hourly intervals)
              </span>
            </div>

            {/* Constraint strip legend */}
            <div className="flex items-center gap-3 mb-3 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 rounded-sm bg-red-500" />
                <span>Binding constraint active</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 rounded-sm bg-gray-200 dark:bg-gray-700" />
                <span>No constraint</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#374151"
                  opacity={0.15}
                />
                <XAxis
                  dataKey="interval"
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151', opacity: 0.3 }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip content={<PredispatchTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" strokeOpacity={0.5} />

                {/* Price error bars — green = over-forecast (actual > predispatch), red = under-forecast */}
                <Bar
                  dataKey="price_error"
                  name="Price Error ($/MWh)"
                  maxBarSize={14}
                  opacity={0.7}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.price_error >= 0 ? '#EF4444' : '#22C55E'}
                    />
                  ))}
                </Bar>

                {/* Pre-dispatch forecast — dashed blue */}
                <Line
                  type="monotone"
                  dataKey="predispatch_price"
                  name="Pre-dispatch Forecast"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  activeDot={{ r: 4 }}
                />

                {/* Actual price — solid amber */}
                <Line
                  type="monotone"
                  dataKey="actual_price"
                  name="Actual Dispatch Price"
                  stroke="#F59E0B"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Constraint active timeline strip */}
            <ConstraintStrip intervals={dashboard.predispatch_intervals} />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 pl-12">
              Red segments indicate intervals with a binding network constraint active
            </p>
          </div>

          {/* Five-minute settlement table */}
          <FiveMinTable summaries={dashboard.five_min_summary} />

          {/* Dispatch accuracy stats table */}
          <AccuracyTable stats={dashboard.accuracy_stats} />

          {/* Footer note */}
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            Pre-dispatch data sourced from AEMO NEMWEB. 5-minute settlement effective from October 2021.
            Price errors: red bar = actual higher than forecast (under-forecast), green = actual lower (over-forecast).
          </p>
        </>
      )}
    </div>
  )
}
