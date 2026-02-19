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
import { Sun, AlertCircle, Loader2 } from 'lucide-react'
import {
  api,
  BtmDashboard,
  HomeBatteryRecord,
  BtmEvRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// State colours for the line chart
// ---------------------------------------------------------------------------

const STATE_COLORS: Record<string, string> = {
  NSW: '#3B82F6',   // blue
  VIC: '#14B8A6',   // teal
  QLD: '#EAB308',   // yellow
  SA:  '#EF4444',   // red
  WA:  '#A855F7',   // purple
  TAS: '#9CA3AF',   // gray
  ACT: '#6B7280',   // gray
  NT:  '#4B5563',   // gray
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}

function KpiCard({ label, value, sub, highlight }: KpiProps) {
  return (
    <div
      className={`rounded-lg p-4 ${
        highlight
          ? 'bg-amber-900/40 border border-amber-700/50'
          : 'bg-gray-800'
      }`}
    >
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BehindTheMeter() {
  const [dashboard, setDashboard] = useState<BtmDashboard | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    api
      .getBtmDashboard()
      .then(setDashboard)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading behind-the-meter data…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center gap-2 text-red-400 p-6">
        <AlertCircle size={18} />
        <span>Error: {error ?? 'No data'}</span>
      </div>
    )
  }

  // ── Build line chart data: capacity by state over 12 months ──
  // Collect unique months in order
  const months = Array.from(
    new Set(dashboard.rooftop_pv.map(r => r.month))
  ).sort()

  // Group by month → { month, NSW: cap, VIC: cap, ... }
  const lineData = months.map(month => {
    const entry: Record<string, string | number> = { month }
    dashboard.rooftop_pv
      .filter(r => r.month === month)
      .forEach(r => {
        entry[r.state] = r.installed_capacity_mw
      })
    return entry
  })

  const pvStates = Array.from(
    new Set(dashboard.rooftop_pv.map(r => r.state))
  ).sort()

  // Latest month battery & EV data
  const latestMonth = months[months.length - 1]
  const latestBatteries: HomeBatteryRecord[] = dashboard.home_batteries.filter(
    r => r.month === latestMonth
  )
  const latestEv: BtmEvRecord[] = dashboard.ev_records.filter(
    r => r.month === latestMonth
  )

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-full text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sun className="text-amber-400" size={24} />
        <div>
          <h1 className="text-xl font-bold text-white">
            Behind-the-Meter Analytics
          </h1>
          <p className="text-sm text-gray-400">
            Rooftop PV, home batteries &amp; EV managed charging — as at{' '}
            {dashboard.timestamp}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Total Rooftop Capacity"
          value={`${fmt(dashboard.total_rooftop_capacity_mw, 0)} MW`}
          sub="All states, latest month"
          highlight
        />
        <KpiCard
          label="Total Generation"
          value={`${fmt(dashboard.total_generation_twh, 2)} TWh`}
          sub="12-month cumulative"
        />
        <KpiCard
          label="Home Batteries Installed"
          value={fmt(dashboard.total_home_batteries)}
          sub={`${fmt(dashboard.total_battery_capacity_mwh, 0)} MWh total capacity`}
        />
        <KpiCard
          label="EV Registrations"
          value={fmt(dashboard.ev_registrations)}
          sub={`${fmt(dashboard.managed_charging_enrolled)} managed charging enrolled`}
        />
      </div>

      {/* Line Chart: Rooftop PV Capacity by State */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Rooftop PV Installed Capacity by State (12-Month Trend)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={lineData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="month"
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              tickFormatter={m => m.slice(2)}
            />
            <YAxis
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              unit=" MW"
              width={70}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: 6,
              }}
              labelStyle={{ color: '#F9FAFB', fontSize: 12 }}
              itemStyle={{ fontSize: 12 }}
              formatter={(v: number) => [`${fmt(v, 0)} MW`]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
            {pvStates.map(state => (
              <Line
                key={state}
                type="monotone"
                dataKey={state}
                stroke={STATE_COLORS[state] ?? '#6B7280'}
                strokeWidth={2}
                dot={false}
                name={state}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Home Battery Table (latest month) */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Home Battery Storage — {latestMonth} ({latestBatteries.length} states)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="text-left py-2 pr-3">State</th>
                <th className="text-right py-2 pr-3">Installations</th>
                <th className="text-right py-2 pr-3">Total Capacity (MWh)</th>
                <th className="text-right py-2 pr-3">Avg Capacity (kWh)</th>
                <th className="text-right py-2 pr-3">Paired w/ Solar (%)</th>
                <th className="text-right py-2">Arbitrage Revenue ($M AUD)</th>
              </tr>
            </thead>
            <tbody>
              {latestBatteries.map((b: HomeBatteryRecord) => (
                <tr
                  key={b.record_id}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="py-2 pr-3 font-semibold text-teal-300">{b.state}</td>
                  <td className="py-2 pr-3 text-right text-white">
                    {b.cumulative_installations.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right text-blue-300">
                    {fmt(b.total_capacity_mwh, 0)}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-300">
                    {b.avg_capacity_kwh.toFixed(1)}
                  </td>
                  <td className="py-2 pr-3 text-right text-amber-300">
                    {b.paired_with_solar_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 text-right text-green-400">
                    ${b.arbitrage_revenue_m_aud.toFixed(3)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EV Table (latest month) */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Electric Vehicles &amp; Managed Charging — {latestMonth} ({latestEv.length}{' '}
          states)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="text-left py-2 pr-3">State</th>
                <th className="text-right py-2 pr-3">EV Registrations</th>
                <th className="text-right py-2 pr-3">Home Chargers</th>
                <th className="text-right py-2 pr-3">Managed Charging</th>
                <th className="text-right py-2 pr-3">V2G Capable</th>
                <th className="text-right py-2">Peak Demand Offset (MW)</th>
              </tr>
            </thead>
            <tbody>
              {latestEv.map((e: BtmEvRecord) => (
                <tr
                  key={e.record_id}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="py-2 pr-3 font-semibold text-blue-300">{e.state}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-white">
                    {e.ev_registrations_cumulative.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-300">
                    {e.home_chargers_installed.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right text-teal-300">
                    {e.managed_charging_enrolled.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right text-purple-300">
                    {e.v2g_capable_units.toLocaleString()}
                  </td>
                  <td className="py-2 text-right text-amber-300">
                    {e.peak_demand_offset_mw.toFixed(1)}
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
