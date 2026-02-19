import { useEffect, useState } from 'react'
import { Car, Zap, TrendingUp, Building2 } from 'lucide-react'
import {
  ComposedChart,
  BarChart,
  Bar,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'
import type { EvFleet45Dashboard } from '../api/client'

// ─── Badge helpers ────────────────────────────────────────────────────────────

function FleetTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    BUS:           'bg-cyan-700 text-cyan-100',
    TRUCK:         'bg-amber-700 text-amber-100',
    DELIVERY_VAN:  'bg-orange-700 text-orange-100',
    GOVERNMENT:    'bg-blue-700 text-blue-100',
    TAXI:          'bg-purple-700 text-purple-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[type] ?? 'bg-gray-700 text-gray-200'}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function ChargingStrategyBadge({ strategy }: { strategy: string }) {
  const map: Record<string, string> = {
    OVERNIGHT:   'bg-gray-600 text-gray-200',
    OPPORTUNITY: 'bg-amber-700 text-amber-100',
    SMART_V2G:   'bg-green-700 text-green-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[strategy] ?? 'bg-gray-700 text-gray-200'}`}>
      {strategy.replace('_', ' ')}
    </span>
  )
}

function LocationTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    DEPOT:           'bg-blue-700 text-blue-100',
    HIGHWAY:         'bg-green-700 text-green-100',
    RETAIL:          'bg-purple-700 text-purple-100',
    WORKPLACE:       'bg-amber-700 text-amber-100',
    RESIDENTIAL_HUB: 'bg-cyan-700 text-cyan-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[type] ?? 'bg-gray-700 text-gray-200'}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function ChargerTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    AC_SLOW:  'bg-gray-600 text-gray-200',
    AC_FAST:  'bg-blue-700 text-blue-100',
    DC_FAST:  'bg-amber-700 text-amber-100',
    DC_ULTRA: 'bg-red-700 text-red-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[type] ?? 'bg-gray-700 text-gray-200'}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPERATING:    'bg-green-700 text-green-100',
    CONSTRUCTION: 'bg-amber-700 text-amber-100',
    PLANNED:      'bg-gray-600 text-gray-200',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[status] ?? 'bg-gray-700 text-gray-200'}`}>
      {status}
    </span>
  )
}

function PenetrationPct({ pct }: { pct: number }) {
  const cls =
    pct < 30 ? 'text-red-400' :
    pct < 60 ? 'text-amber-400' :
               'text-green-400'
  return <span className={`font-semibold ${cls}`}>{pct.toFixed(1)}%</span>
}

function UtilisationPct({ pct }: { pct: number }) {
  const cls =
    pct < 40 ? 'text-red-400' :
    pct < 65 ? 'text-amber-400' :
               'text-green-400'
  return <span className={`font-semibold ${cls}`}>{pct.toFixed(1)}%</span>
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
}

function KpiCard({ label, value, sub, icon }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-start gap-4 border border-gray-700">
      <div className="text-blue-400 mt-1">{icon}</div>
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <p className="text-white text-2xl font-bold leading-tight">{value}</p>
        {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EvFleetCharging() {
  const [data, setData] = useState<EvFleet45Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getEvFleetDashboard()
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading EV Fleet data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  // Format V2G dispatch chart data — show HH:MM label
  const v2gChartData = data.v2g_dispatch.map(r => ({
    interval: r.interval.slice(11, 16),
    v2g_export_mw: r.v2g_export_mw,
    spot_price: r.spot_price_aud_mwh,
    revenue: r.revenue_aud,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Car className="w-8 h-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            EV Fleet &amp; Grid-Scale Charging Integration
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Vehicle-to-grid (V2G) analytics, managed charging optimisation, and fleet electrification tracking across the NEM
          </p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total EV Fleet Vehicles"
          value={data.total_fleet_ev_vehicles.toLocaleString()}
          sub="Across all registered fleets"
          icon={<Car className="w-6 h-6" />}
        />
        <KpiCard
          label="Total Charging Power"
          value={`${data.total_charging_power_mw.toFixed(1)} MW`}
          sub="Installed across all sites"
          icon={<Zap className="w-6 h-6" />}
        />
        <KpiCard
          label="Avg Fleet EV Penetration"
          value={`${data.avg_fleet_ev_penetration_pct.toFixed(1)}%`}
          sub="Weighted fleet average"
          icon={<TrendingUp className="w-6 h-6" />}
        />
        <KpiCard
          label="V2G Capable Sites"
          value={data.v2g_capable_sites}
          sub="Sites with V2G discharge capability"
          icon={<Building2 className="w-6 h-6" />}
        />
      </div>

      {/* ── EV Demand Forecast chart ── */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">EV Demand Forecast 2024–2035</h2>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data.demand_forecast} margin={{ top: 10, right: 50, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              yAxisId="twh"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'TWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 12 }}
            />
            <YAxis
              yAxisId="gw"
              orientation="right"
              tick={{ fill: '#f59e0b', fontSize: 12 }}
              label={{ value: 'GW', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Area
              yAxisId="twh"
              type="monotone"
              dataKey="total_ev_demand_twh"
              stackId="1"
              fill="#3b82f6"
              stroke="#3b82f6"
              fillOpacity={0.6}
              name="Total EV Demand (TWh)"
            />
            <Area
              yAxisId="twh"
              type="monotone"
              dataKey="managed_charging_twh"
              stackId="2"
              fill="#10b981"
              stroke="#10b981"
              fillOpacity={0.6}
              name="Managed Charging (TWh)"
            />
            <Area
              yAxisId="twh"
              type="monotone"
              dataKey="v2g_discharge_twh"
              stackId="3"
              fill="#8b5cf6"
              stroke="#8b5cf6"
              fillOpacity={0.6}
              name="V2G Discharge (TWh)"
            />
            <Line
              yAxisId="gw"
              type="monotone"
              dataKey="peak_demand_increase_gw"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', r: 3 }}
              name="Peak Demand Increase (GW)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Fleet Registry table ── */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Fleet Registry</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="pb-2 pr-4">Fleet Name</th>
                <th className="pb-2 pr-4">Operator</th>
                <th className="pb-2 pr-4">State</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4 text-right">Total Vehicles</th>
                <th className="pb-2 pr-4 text-right">EV Vehicles</th>
                <th className="pb-2 pr-4 text-right">Penetration</th>
                <th className="pb-2 pr-4">Charging Strategy</th>
                <th className="pb-2 text-right">Peak Charge (MW)</th>
              </tr>
            </thead>
            <tbody>
              {data.fleets.map(f => (
                <tr key={f.fleet_id} className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors">
                  <td className="py-2 pr-4 text-white font-medium">{f.fleet_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{f.operator}</td>
                  <td className="py-2 pr-4 text-gray-300">{f.state}</td>
                  <td className="py-2 pr-4"><FleetTypeBadge type={f.fleet_type} /></td>
                  <td className="py-2 pr-4 text-right text-gray-300">{f.total_vehicles.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{f.ev_vehicles.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right"><PenetrationPct pct={f.ev_penetration_pct} /></td>
                  <td className="py-2 pr-4"><ChargingStrategyBadge strategy={f.charging_strategy} /></td>
                  <td className="py-2 text-right text-gray-300">{f.peak_charge_mw.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Charging Infrastructure table ── */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Charging Infrastructure</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="pb-2 pr-4">Site Name</th>
                <th className="pb-2 pr-4">Operator</th>
                <th className="pb-2 pr-4">State</th>
                <th className="pb-2 pr-4">Location</th>
                <th className="pb-2 pr-4">Charger Type</th>
                <th className="pb-2 pr-4 text-right">Chargers</th>
                <th className="pb-2 pr-4 text-right">Power (kW)</th>
                <th className="pb-2 pr-4 text-right">Utilisation</th>
                <th className="pb-2 pr-4 text-center">V2G</th>
                <th className="pb-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.charging_infra.map(s => (
                <tr key={s.site_id} className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors">
                  <td className="py-2 pr-4 text-white font-medium">{s.site_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{s.operator}</td>
                  <td className="py-2 pr-4 text-gray-300">{s.state}</td>
                  <td className="py-2 pr-4"><LocationTypeBadge type={s.location_type} /></td>
                  <td className="py-2 pr-4"><ChargerTypeBadge type={s.charger_type} /></td>
                  <td className="py-2 pr-4 text-right text-gray-300">{s.num_chargers}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{s.total_power_kw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right"><UtilisationPct pct={s.avg_utilisation_pct} /></td>
                  <td className="py-2 pr-4 text-center">
                    {s.v2g_capable && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-700 text-green-100">
                        V2G
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-center"><StatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── V2G Dispatch chart ── */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          V2G Dispatch — Half-Hour Intervals (Today)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={v2gChartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="interval" tick={{ fill: '#9ca3af', fontSize: 11 }} interval={2} />
            <YAxis
              yAxisId="mw"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 12 }}
            />
            <YAxis
              yAxisId="price"
              orientation="right"
              tick={{ fill: '#f59e0b', fontSize: 12 }}
              label={{ value: '$/MWh', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar
              yAxisId="mw"
              dataKey="v2g_export_mw"
              fill="#3b82f6"
              fillOpacity={0.8}
              name="V2G Export (MW)"
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="spot_price"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="Spot Price ($/MWh)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
