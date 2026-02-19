import { useEffect, useState } from 'react'
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
import { Radio, AlertCircle, Loader2 } from 'lucide-react'
import {
  api,
  NemRealTimeDashboard as NemRealTimeDashboardType,
  RegionalDispatch,
  NemGenMixRecord,
  InterconnectorFlowRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function priceColor(price: number): string {
  if (price < 100)  return 'text-green-400'
  if (price < 300)  return 'text-amber-400'
  if (price < 1000) return 'text-orange-400'
  return 'text-red-500'
}

function priceBg(price: number): string {
  if (price < 100)  return 'border-green-700'
  if (price < 300)  return 'border-amber-600'
  if (price < 1000) return 'border-orange-600'
  return 'border-red-600'
}

// ---------------------------------------------------------------------------
// Fuel type colours for stacked bar chart
// ---------------------------------------------------------------------------

const FUEL_COLORS: Record<string, string> = {
  BLACK_COAL:  '#374151',  // gray-700
  BROWN_COAL:  '#92400e',  // amber-800
  GAS:         '#ea580c',  // orange-600
  HYDRO:       '#3b82f6',  // blue-500
  WIND:        '#22d3ee',  // cyan-400
  SOLAR:       '#facc15',  // yellow-400
  BATTERY:     '#a855f7',  // purple-500
  OTHER:       '#6b7280',  // gray-500
}

const ALL_FUELS = ['BLACK_COAL', 'BROWN_COAL', 'GAS', 'HYDRO', 'WIND', 'SOLAR', 'BATTERY', 'OTHER']

// ---------------------------------------------------------------------------
// Regional KPI price card
// ---------------------------------------------------------------------------

function RegionalPriceCard({ r }: { r: RegionalDispatch }) {
  const colorCls = priceColor(r.dispatch_price_aud_mwh)
  const borderCls = priceBg(r.dispatch_price_aud_mwh)
  return (
    <div className={`rounded-lg p-4 bg-gray-800 border-l-4 ${borderCls}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-200">{r.region}</span>
        <span className={`text-xs px-2 py-0.5 rounded font-medium bg-gray-700 ${colorCls}`}>
          {r.rrp_band}
        </span>
      </div>
      <p className={`text-3xl font-bold mb-1 ${colorCls}`}>
        ${fmt(r.dispatch_price_aud_mwh, 2)}
      </p>
      <p className="text-xs text-gray-500 mb-3">AUD/MWh dispatch price</p>
      <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-400">
        <div>
          <span className="block text-gray-500">Demand</span>
          <span className="text-gray-200">{fmt(r.demand_mw, 0)} MW</span>
        </div>
        <div>
          <span className="block text-gray-500">Renewable</span>
          <span className="text-gray-200">{fmt(r.renewable_pct, 1)}%</span>
        </div>
        <div className="mt-2">
          <span className="block text-gray-500">Pre-dispatch</span>
          <span className="text-gray-200">${fmt(r.predispatch_price_aud_mwh, 2)}</span>
        </div>
        <div className="mt-2">
          <span className="block text-gray-500">Interchange</span>
          <span className={r.net_interchange_mw > 0 ? 'text-blue-400' : 'text-orange-400'}>
            {r.net_interchange_mw > 0 ? '+' : ''}{fmt(r.net_interchange_mw, 0)} MW
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generation mix stacked bar chart
// ---------------------------------------------------------------------------

function buildChartData(mix: NemGenMixRecord[]) {
  const byRegion: Record<string, Record<string, number>> = {}
  for (const rec of mix) {
    if (!byRegion[rec.region]) byRegion[rec.region] = {}
    byRegion[rec.region][rec.fuel_type] = (byRegion[rec.region][rec.fuel_type] ?? 0) + rec.dispatch_mw
  }
  return Object.entries(byRegion).map(([region, fuels]) => ({ region, ...fuels }))
}

function fuelsPresent(mix: NemGenMixRecord[]): string[] {
  const seen = new Set(mix.map(r => r.fuel_type))
  return ALL_FUELS.filter(f => seen.has(f))
}

// ---------------------------------------------------------------------------
// Direction badge
// ---------------------------------------------------------------------------

function DirectionBadge({ direction }: { direction: string }) {
  const styles: Record<string, string> = {
    FORWARD:     'bg-green-800 text-green-200',
    REVERSE:     'bg-orange-800 text-orange-200',
    CONSTRAINED: 'bg-red-800 text-red-200',
  }
  const cls = styles[direction] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {direction}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Loading bar for interconnector loading %
// ---------------------------------------------------------------------------

function LoadingBar({ pct }: { pct: number }) {
  const barColor = pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-blue-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 rounded bg-gray-700 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-10">{fmt(pct, 1)}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function NemRealTimeDashboard() {
  const [data, setData] = useState<NemRealTimeDashboardType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getRealtimeDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading real-time NEM data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 text-red-400 p-6">
        <AlertCircle size={18} />
        <span>{error ?? 'No data available'}</span>
      </div>
    )
  }

  const chartData = buildChartData(data.generation_mix)
  const fuelTypes = fuelsPresent(data.generation_mix)

  return (
    <div className="min-h-full bg-gray-900 p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="text-cyan-400" size={22} />
          <div>
            <h1 className="text-xl font-bold text-white">NEM Real-Time Overview</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Dispatch interval: <span className="text-gray-300 font-mono">{data.dispatch_interval}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
          Live · 5-min dispatch
        </div>
      </div>

      {/* ── NEM-wide summary KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg p-4 bg-gray-800">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">NEM Total Demand</p>
          <p className="text-2xl font-bold text-white">{fmt(data.nem_total_demand_mw, 0)} <span className="text-sm font-normal text-gray-400">MW</span></p>
        </div>
        <div className="rounded-lg p-4 bg-gray-800">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">NEM Avg Price</p>
          <p className={`text-2xl font-bold ${priceColor(data.nem_avg_price_aud_mwh)}`}>
            ${fmt(data.nem_avg_price_aud_mwh, 2)}
            <span className="text-sm font-normal text-gray-400 ml-1">AUD/MWh</span>
          </p>
        </div>
        <div className="rounded-lg p-4 bg-gray-800">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">NEM Renewables</p>
          <p className="text-2xl font-bold text-green-400">{fmt(data.nem_renewable_pct, 1)}<span className="text-sm font-normal text-gray-400 ml-1">%</span></p>
        </div>
        <div className="rounded-lg p-4 bg-gray-800">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Price Range</p>
          <p className="text-sm font-semibold text-white">
            <span className="text-green-400">{data.min_price_region}</span>
            <span className="text-gray-500 mx-2">→</span>
            <span className="text-red-400">{data.max_price_region}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">min → max price region</p>
        </div>
      </div>

      {/* ── 5 Regional price KPI cards ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Regional Dispatch Prices</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {data.regional_dispatch.map(r => (
            <RegionalPriceCard key={r.region} r={r} />
          ))}
        </div>
      </div>

      {/* ── Generation Mix stacked bar chart ── */}
      <div className="rounded-lg bg-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Generation Mix by Fuel Type</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={v => `${(v / 1000).toFixed(0)}GW`} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(value: number, name: string) => [`${fmt(value, 0)} MW`, name.replace('_', ' ')]}
            />
            <Legend
              wrapperStyle={{ paddingTop: 12, fontSize: 11, color: '#9ca3af' }}
              formatter={(value: string) => value.replace('_', ' ')}
            />
            {fuelTypes.map(fuel => (
              <Bar key={fuel} dataKey={fuel} stackId="a" fill={FUEL_COLORS[fuel]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Interconnector flows table ── */}
      <div className="rounded-lg bg-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Interconnector Flows</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-700">
                <th className="text-left py-2 pr-4">Interconnector</th>
                <th className="text-left py-2 pr-4">From → To</th>
                <th className="text-right py-2 pr-4">Flow (MW)</th>
                <th className="text-right py-2 pr-4">Limit (MW)</th>
                <th className="text-left py-2 pr-4">Loading</th>
                <th className="text-right py-2 pr-4">Losses (MW)</th>
                <th className="text-left py-2">Direction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.interconnector_flows.map(ic => (
                <tr key={ic.interconnector_id} className="hover:bg-gray-750 transition-colors">
                  <td className="py-2.5 pr-4 font-mono text-xs text-gray-200">{ic.interconnector_id}</td>
                  <td className="py-2.5 pr-4 text-gray-400">
                    <span className="text-gray-200">{ic.from_region}</span>
                    <span className="mx-1 text-gray-600">→</span>
                    <span className="text-gray-200">{ic.to_region}</span>
                  </td>
                  <td className={`py-2.5 pr-4 text-right font-semibold ${ic.mw_flow >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                    {ic.mw_flow >= 0 ? '+' : ''}{fmt(ic.mw_flow, 1)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-400">{fmt(ic.mw_limit, 0)}</td>
                  <td className="py-2.5 pr-4">
                    <LoadingBar pct={ic.loading_pct} />
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-400">{fmt(ic.losses_mw, 1)}</td>
                  <td className="py-2.5">
                    <DirectionBadge direction={ic.direction} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
