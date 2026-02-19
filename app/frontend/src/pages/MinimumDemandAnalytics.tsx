import { useEffect, useState } from 'react'
import { TrendingDown, Star } from 'lucide-react'
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
} from 'recharts'
import {
  api,
  MinDemandDashboard,
  MinimumDemandRecord,
  DuckCurveProfile,
  NegativePricingRecord,
} from '../api/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, unit, sub }: { label: string; value: string | number; unit?: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

const REGIONS = ['SA1', 'VIC1', 'NSW1', 'QLD1']
const SEASONS = ['SPRING', 'AUTUMN']

// Generate half-hour time labels: 00:00, 00:30, 01:00, ..., 23:30
const HH_LABELS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

const REGION_COLORS: Record<string, string> = {
  SA1:  '#f59e0b',
  VIC1: '#3b82f6',
  NSW1: '#22c55e',
  QLD1: '#a855f7',
}

// ── Duck Curve Chart ──────────────────────────────────────────────────────────

function DuckCurveChart({ profiles }: { profiles: DuckCurveProfile[] }) {
  const [region, setRegion] = useState('SA1')
  const [season, setSeason] = useState('SPRING')

  const profile = profiles.find(p => p.region === region && p.season === season)

  const chartData = profile
    ? HH_LABELS.map((label, i) => ({
        time: label,
        demand: profile.half_hourly_demand[i],
        rooftop_pv: profile.half_hourly_rooftop_pv[i],
        net_demand: profile.half_hourly_net_demand[i],
      }))
    : []

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Duck Curve — Half-Hourly Demand Profile</h2>
          {profile && (
            <p className="text-xs text-gray-400 mt-0.5">
              Evening ramp: {profile.ramp_rate_mw_30min.toLocaleString()} MW/30min &nbsp;|&nbsp;
              Trough depth: {profile.trough_depth_mw.toLocaleString()} MW &nbsp;|&nbsp;
              Peak: {profile.peak_demand_mw.toLocaleString()} MW &nbsp;|&nbsp;
              Trough: {profile.trough_demand_mw.toLocaleString()} MW
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map(r => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                region === r
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
          <span className="w-px bg-gray-600 mx-1" />
          {SEASONS.map(s => (
            <button
              key={s}
              onClick={() => setSeason(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                season === s
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      {chartData.length === 0 ? (
        <p className="text-gray-500 text-sm">No profile data for selected region/season.</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              interval={3}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" width={75} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  demand: 'Total Demand',
                  rooftop_pv: 'Rooftop PV',
                  net_demand: 'Net Demand',
                }
                return [`${value.toLocaleString()} MW`, labels[name] ?? name]
              }}
            />
            <Legend
              wrapperStyle={{ color: '#9ca3af', paddingTop: '8px' }}
              formatter={(value) => {
                const labels: Record<string, string> = {
                  demand: 'Total Demand',
                  rooftop_pv: 'Rooftop PV',
                  net_demand: 'Net Demand',
                }
                return labels[value] ?? value
              }}
            />
            <Line
              type="monotone"
              dataKey="demand"
              stroke="#3b82f6"
              dot={false}
              strokeWidth={2}
              name="demand"
            />
            <Line
              type="monotone"
              dataKey="rooftop_pv"
              stroke="#f59e0b"
              dot={false}
              strokeWidth={2}
              name="rooftop_pv"
            />
            <Line
              type="monotone"
              dataKey="net_demand"
              stroke="#22c55e"
              dot={false}
              strokeWidth={2.5}
              name="net_demand"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Negative Pricing Bar Chart ────────────────────────────────────────────────

function NegativePricingChart({ records }: { records: NegativePricingRecord[] }) {
  // Get last 12 months sorted
  const months = Array.from(new Set(records.map(r => r.month))).sort().slice(-12)

  const chartData = months.map(month => {
    const row: Record<string, unknown> = { month: month.slice(0, 7) }
    REGIONS.forEach(r => {
      const rec = records.find(x => x.month === month && x.region === r)
      row[r] = rec ? rec.negative_intervals : 0
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-base font-semibold text-white mb-4">
        Negative Pricing Intervals by Region — Last 12 Months (Stacked)
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(value: number, name: string) => [
              `${value.toLocaleString()} intervals`,
              name,
            ]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: '8px' }} />
          {REGIONS.map(r => (
            <Bar key={r} dataKey={r} stackId="a" fill={REGION_COLORS[r]} name={r} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Min Demand Records Table ──────────────────────────────────────────────────

function MinDemandTable({ records }: { records: MinimumDemandRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-base font-semibold text-white mb-3">Minimum Operational Demand Records</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Region</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Min Demand MW</th>
              <th className="text-center py-2 px-3 text-gray-400 font-medium">Time (AEST)</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Rooftop PV MW</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Neg. Price Intervals</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Min Spot $/MWh</th>
              <th className="text-center py-2 px-3 text-gray-400 font-medium">Record Low</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.record_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 px-3 text-gray-200 font-medium">{r.date}</td>
                <td className="py-2 px-3">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ backgroundColor: REGION_COLORS[r.region] + '33', color: REGION_COLORS[r.region] }}
                  >
                    {r.region}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-semibold text-amber-300">
                  {r.min_operational_demand_mw.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-center text-gray-300">{r.time_of_minimum}</td>
                <td className="py-2 px-3 text-right text-yellow-400">{r.rooftop_pv_mw.toLocaleString()}</td>
                <td className="py-2 px-3 text-right text-gray-300">{r.negative_price_intervals}</td>
                <td className={`py-2 px-3 text-right font-semibold ${r.min_spot_price_aud_mwh < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                  {r.min_spot_price_aud_mwh.toFixed(1)}
                </td>
                <td className="py-2 px-3 text-center">
                  {r.record_low_flag && (
                    <Star size={14} className="inline text-amber-400" fill="currentColor" />
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function MinimumDemandAnalytics() {
  const [dash, setDash] = useState<MinDemandDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getMinDemandDashboard()
      .then(setDash)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading minimum demand data...
      </div>
    )
  }

  if (error || !dash) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingDown size={28} className="text-green-400" />
        <div>
          <h1 className="text-xl font-bold text-white">
            Minimum Operational Demand &amp; Duck Curve Analytics
          </h1>
          <p className="text-sm text-gray-400">
            Rooftop Solar Impact &middot; Negative Pricing Periods &middot; Grid Stability &middot; Duck Curve Profiles
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Record Minimum Demand"
          value={dash.min_demand_record_mw.toLocaleString()}
          unit="MW"
          sub={`${dash.min_demand_region} · ${dash.min_demand_date}`}
        />
        <KpiCard
          label="Avg Negative Price Intervals/Day"
          value={dash.avg_negative_price_intervals_per_day.toFixed(1)}
          unit="intervals"
        />
        <KpiCard
          label="Total Curtailed Energy"
          value={dash.total_curtailed_twh_yr.toFixed(3)}
          unit="TWh/yr"
        />
        <KpiCard
          label="Rooftop PV Share at Min Demand"
          value={dash.rooftop_pv_share_at_min_demand_pct.toFixed(1)}
          unit="%"
        />
      </div>

      {/* Duck Curve Chart */}
      <DuckCurveChart profiles={dash.duck_curve_profiles} />

      {/* Min Demand Records Table */}
      <MinDemandTable records={dash.min_demand_records} />

      {/* Negative Pricing Bar Chart */}
      <NegativePricingChart records={dash.negative_pricing} />
    </div>
  )
}
