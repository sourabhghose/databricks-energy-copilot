import { useEffect, useState } from 'react'
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
import { TrendingUp, Activity, BarChart2, DollarSign } from 'lucide-react'
import {
  getElectricityOptionsDashboard,
  EOVDashboard,
  EOVOptionRecord,
  EOVStrategyRecord,
  EOVHistVolRecord,
  EOVVolSurfaceRecord,
} from '../api/client'

// ── Colour helpers ───────────────────────────────────────────────────────────

const OPTION_TYPE_BADGE: Record<string, string> = {
  CAP:      'bg-blue-800/70 text-blue-200 border border-blue-600',
  FLOOR:    'bg-green-800/70 text-green-200 border border-green-600',
  COLLAR:   'bg-purple-800/70 text-purple-200 border border-purple-600',
  SWAPTION: 'bg-orange-800/70 text-orange-200 border border-orange-600',
  STRADDLE: 'bg-pink-800/70 text-pink-200 border border-pink-600',
  BULL_CALL_SPREAD: 'bg-cyan-800/70 text-cyan-200 border border-cyan-600',
}

const MONEYNESS_BADGE: Record<string, string> = {
  ITM: 'bg-green-700/70 text-green-200 border border-green-500',
  ATM: 'bg-yellow-700/70 text-yellow-200 border border-yellow-500',
  OTM: 'bg-red-800/70 text-red-200 border border-red-600',
}

const SUITABILITY_BADGE: Record<string, string> = {
  RETAILER:        'bg-blue-900/60 text-blue-300',
  GENERATOR:       'bg-green-900/60 text-green-300',
  TRADER:          'bg-purple-900/60 text-purple-300',
  COMMERCIAL_LOAD: 'bg-amber-900/60 text-amber-300',
}

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1']
const TENORS = [1, 3, 6, 12, 18, 24]
const STRIKES = [80, 90, 95, 100, 105, 110, 120]

// Map implied vol to a heatmap cell colour (green→yellow→red)
function volToCell(vol: number): string {
  if (vol >= 70) return 'bg-red-700 text-red-100'
  if (vol >= 60) return 'bg-red-800/80 text-red-200'
  if (vol >= 55) return 'bg-orange-700/80 text-orange-100'
  if (vol >= 50) return 'bg-amber-700/70 text-amber-100'
  if (vol >= 45) return 'bg-yellow-700/70 text-yellow-100'
  if (vol >= 40) return 'bg-lime-800/70 text-lime-200'
  if (vol >= 35) return 'bg-green-800/70 text-green-200'
  return 'bg-green-900/60 text-green-300'
}

function fmt(n: number, d = 1) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtLarge(n: number) {
  if (n >= 9990) return 'Unlimited'
  return `$${fmt(n, 1)}`
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent: string
}) {
  return (
    <div className={`bg-gray-800 rounded-xl p-4 border ${accent} flex flex-col gap-1`}>
      <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  )
}

// Options Book Table
function OptionsBookTable({ records }: { records: EOVOptionRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-700">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Options Book</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="px-4 py-2 text-left">Option ID</th>
              <th className="px-4 py-2 text-left">Region</th>
              <th className="px-4 py-2 text-left">Expiry</th>
              <th className="px-4 py-2 text-right">Strike $/MWh</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-right">Premium</th>
              <th className="px-4 py-2 text-right">Delta</th>
              <th className="px-4 py-2 text-right">Gamma</th>
              <th className="px-4 py-2 text-right">Theta</th>
              <th className="px-4 py-2 text-right">Vega</th>
              <th className="px-4 py-2 text-right">IV %</th>
              <th className="px-4 py-2 text-left">Moneyness</th>
              <th className="px-4 py-2 text-right">OI (MWh)</th>
            </tr>
          </thead>
          <tbody>
            {records.map((o) => (
              <tr key={o.option_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-2 text-gray-300 font-mono text-xs">{o.option_id}</td>
                <td className="px-4 py-2 text-white font-semibold">{o.region}</td>
                <td className="px-4 py-2 text-gray-300">{o.expiry}</td>
                <td className="px-4 py-2 text-right text-white font-mono">${fmt(o.strike_per_mwh, 0)}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${OPTION_TYPE_BADGE[o.option_type] ?? 'bg-gray-700 text-gray-300'}`}>
                    {o.option_type}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-green-300 font-mono">${fmt(o.premium_per_mwh, 2)}</td>
                <td className="px-4 py-2 text-right text-blue-300 font-mono">{fmt(o.delta, 3)}</td>
                <td className="px-4 py-2 text-right text-indigo-300 font-mono">{o.gamma.toFixed(4)}</td>
                <td className="px-4 py-2 text-right text-red-300 font-mono">{fmt(o.theta, 3)}</td>
                <td className="px-4 py-2 text-right text-amber-300 font-mono">{fmt(o.vega, 3)}</td>
                <td className="px-4 py-2 text-right text-white font-semibold">{fmt(o.implied_vol_pct, 1)}%</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${MONEYNESS_BADGE[o.moneyness] ?? 'bg-gray-700 text-gray-300'}`}>
                    {o.moneyness}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-gray-300 font-mono">
                  {(o.open_interest_mwh / 1000).toFixed(1)}k
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Volatility Surface Heatmap
function VolSurfaceHeatmap({ surface }: { surface: EOVVolSurfaceRecord[] }) {
  const [selectedRegion, setSelectedRegion] = useState('NSW1')

  const regionData = surface.filter((v) => v.region === selectedRegion)

  // Build lookup: tenor → strike% → vol
  const lookup: Record<number, Record<number, number>> = {}
  for (const row of regionData) {
    if (!lookup[row.tenor_months]) lookup[row.tenor_months] = {}
    lookup[row.tenor_months][row.strike_pct_atm] = row.implied_vol_pct
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-700 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider">
          Implied Volatility Surface — {selectedRegion}
        </h2>
        <div className="flex gap-1">
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedRegion === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-gray-400 text-left px-2 py-1 font-medium">Tenor / Strike</th>
              {STRIKES.map((s) => (
                <th key={s} className="text-gray-400 text-center px-2 py-1 font-medium">
                  {s}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TENORS.map((tenor) => (
              <tr key={tenor}>
                <td className="text-gray-300 px-2 py-1 font-semibold whitespace-nowrap">
                  {tenor}m
                </td>
                {STRIKES.map((strike) => {
                  const vol = lookup[tenor]?.[strike]
                  return (
                    <td key={strike} className="px-1 py-1">
                      {vol !== undefined ? (
                        <div
                          className={`rounded px-1 py-1 text-center font-mono font-semibold ${volToCell(vol)}`}
                          style={{ minWidth: '3.5rem' }}
                        >
                          {fmt(vol, 1)}%
                        </div>
                      ) : (
                        <div className="rounded px-1 py-1 text-center text-gray-600 bg-gray-900/30">—</div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {/* Legend */}
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
          <span>Vol scale:</span>
          {[
            { cls: 'bg-green-900/60', label: '<35%' },
            { cls: 'bg-green-800/70', label: '35-40%' },
            { cls: 'bg-lime-800/70', label: '40-45%' },
            { cls: 'bg-yellow-700/70', label: '45-50%' },
            { cls: 'bg-amber-700/70', label: '50-55%' },
            { cls: 'bg-orange-700/80', label: '55-60%' },
            { cls: 'bg-red-800/80', label: '60-70%' },
            { cls: 'bg-red-700', label: '>70%' },
          ].map(({ cls, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-4 h-4 rounded ${cls}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Strategy Payoff Cards
function StrategyCards({ strategies }: { strategies: EOVStrategyRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-700">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Strategy Payoff Profiles</h2>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {strategies.map((s) => {
          const profitPct =
            s.max_profit_per_mwh >= 9990
              ? 100
              : Math.min(100, (s.max_profit_per_mwh / 50) * 100)
          const lossPct = Math.min(100, (Math.abs(s.max_loss_per_mwh) / 30) * 100)
          return (
            <div
              key={s.strategy_name}
              className="bg-gray-900/60 rounded-lg border border-gray-700 p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-white font-semibold text-sm">{s.strategy_name}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{s.legs} leg{s.legs > 1 ? 's' : ''}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      OPTION_TYPE_BADGE[s.strategy_type] ?? 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {s.strategy_type}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      SUITABILITY_BADGE[s.suitability] ?? 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {s.suitability.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Max profit bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Max Profit</span>
                  <span className="text-green-300 font-mono">{fmtLarge(s.max_profit_per_mwh)}/MWh</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${profitPct}%` }}
                  />
                </div>
              </div>

              {/* Max loss bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Max Loss</span>
                  <span className="text-red-300 font-mono">${fmt(Math.abs(s.max_loss_per_mwh), 1)}/MWh</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${lossPct}%` }}
                  />
                </div>
              </div>

              {/* Breakeven & premium */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-gray-800/60 rounded p-2">
                  <div className="text-gray-500">BE Low</div>
                  <div className="text-white font-mono">${fmt(s.breakeven_low, 0)}</div>
                </div>
                <div className="bg-gray-800/60 rounded p-2">
                  <div className="text-gray-500">BE High</div>
                  <div className="text-white font-mono">
                    {s.breakeven_high >= 9990 ? 'N/A' : `$${fmt(s.breakeven_high, 0)}`}
                  </div>
                </div>
                <div className="bg-gray-800/60 rounded p-2">
                  <div className="text-gray-500">Net Prem</div>
                  <div className="text-amber-300 font-mono">${fmt(Math.abs(s.net_premium), 1)}</div>
                </div>
              </div>

              <div className="text-gray-400 text-xs italic border-t border-gray-700 pt-2">
                {s.use_case}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Historical Volatility Chart
function HistVolChart({ histVol }: { histVol: EOVHistVolRecord[] }) {
  const [selectedRegion, setSelectedRegion] = useState('NSW1')

  const filtered = histVol.filter((h) => h.region === selectedRegion)
  const chartData = filtered.map((h) => ({
    date: h.date.replace('2024-', '').replace('2025-', '25-'),
    rv30: h.realized_vol_30d,
    rv90: h.realized_vol_90d,
    iv: h.implied_vol,
    vrp: h.vol_risk_premium,
  }))

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-700 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider">
          Historical vs Implied Volatility — {selectedRegion}
        </h2>
        <div className="flex gap-1">
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedRegion === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis
              stroke="#6b7280"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb', fontSize: 12 }}
              itemStyle={{ fontSize: 12 }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  rv30: 'Realized Vol 30d',
                  rv90: 'Realized Vol 90d',
                  iv: 'Implied Vol',
                  vrp: 'Vol Risk Premium',
                }
                return [`${fmt(value, 1)}%`, labels[name] ?? name]
              }}
            />
            <Legend
              formatter={(value) => {
                const labels: Record<string, string> = {
                  rv30: 'Realized Vol 30d',
                  rv90: 'Realized Vol 90d',
                  iv: 'Implied Vol',
                  vrp: 'Vol Risk Premium',
                }
                return <span style={{ color: '#d1d5db', fontSize: 12 }}>{labels[value] ?? value}</span>
              }}
            />
            <Line
              type="monotone"
              dataKey="rv30"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="rv90"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="iv"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="vrp"
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ElectricityOptionsAnalytics() {
  const [data, setData] = useState<EOVDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityOptionsDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading options analytics...</div>
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

  const summary = data.summary as Record<string, number | string>

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-900/50 rounded-lg border border-blue-700">
            <TrendingUp className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              Electricity Options &amp; Volatility Surface
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Energy derivatives pricing, implied volatility surface, cap/floor strategies and Greeks analysis
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 flex flex-col gap-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={<BarChart2 className="w-3.5 h-3.5" />}
            label="Total Options"
            value={String(summary.total_options)}
            sub="Active positions"
            accent="border-blue-700"
          />
          <KpiCard
            icon={<Activity className="w-3.5 h-3.5" />}
            label="Avg Implied Vol"
            value={`${summary.avg_implied_vol_pct}%`}
            sub="Across all regions"
            accent="border-amber-700"
          />
          <KpiCard
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            label="Highest Vol Region"
            value={String(summary.highest_vol_region)}
            sub="South Australia — extreme volatility"
            accent="border-red-700"
          />
          <KpiCard
            icon={<DollarSign className="w-3.5 h-3.5" />}
            label="Total Open Interest"
            value={`${summary.total_open_interest_gwh} GWh`}
            sub={`${summary.vol_surface_points} vol surface points`}
            accent="border-green-700"
          />
        </div>

        {/* Options Book */}
        <OptionsBookTable records={data.options_book} />

        {/* Volatility Surface */}
        <VolSurfaceHeatmap surface={data.vol_surface} />

        {/* Strategy Payoff Cards */}
        <StrategyCards strategies={data.strategies} />

        {/* Historical Volatility Chart */}
        <HistVolChart histVol={data.hist_vol} />
      </div>
    </div>
  )
}
