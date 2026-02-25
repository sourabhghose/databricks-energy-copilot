import { useEffect, useState } from 'react'
import { Car, Zap, Battery, DollarSign } from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getEFGADashboard } from '../api/client'
import type { EFGADashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const ADOPTION_COLOURS = {
  bev: '#3b82f6',
  phev: '#f59e0b',
  v2g: '#10b981',
}

const CHARGING_COLOURS = {
  unmanaged: '#ef4444',
  smart: '#3b82f6',
  v2g: '#10b981',
  solar: '#f59e0b',
}

const STATE_COLOURS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#6366f1',
  QLD: '#f59e0b',
  SA: '#10b981',
  WA: '#ec4899',
  TAS: '#8b5cf6',
  ACT: '#14b8a6',
  NT: '#f97316',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-2xl p-6 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart Card wrapper
// ---------------------------------------------------------------------------
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function EvFleetGridIntegrationAnalytics() {
  const [data, setData] = useState<EFGADashboard | null>(null)

  useEffect(() => {
    getEFGADashboard().then(setData).catch(console.error)
  }, [])

  if (!data) {
    return <div className="min-h-screen bg-gray-900 p-8 text-white">Loading EV Fleet Grid Integration dashboard...</div>
  }

  // KPI aggregation
  const latestAdoption = data.adoption[data.adoption.length - 1]
  const totalFleet = latestAdoption.total_fleet_k
  const v2gEnabled = data.adoption.reduce((max, r) => Math.max(max, r.v2g_enabled_k), 0)
  const peakDemandImpact = data.state_impacts.reduce((s, r) => s + r.additional_peak_mw, 0)
  const smartChargingSavings = data.monthly.reduce((s, r) => s + r.charging_energy_gwh, 0) * 0.12 // rough AUD calc

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Car size={28} className="text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold">EV Fleet Grid Integration Analytics</h1>
          <p className="text-sm text-gray-400">Sprint 165c — EFGA Dashboard</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="Total EV Fleet Size"
          value={`${totalFleet.toFixed(0)}k`}
          sub="by 2035 forecast"
          icon={Car}
          color="bg-blue-600"
        />
        <KpiCard
          title="V2G Enabled Vehicles"
          value={`${v2gEnabled.toFixed(0)}k`}
          sub="bi-directional capable"
          icon={Battery}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Peak Demand Impact"
          value={`${peakDemandImpact.toFixed(0)} MW`}
          sub="additional peak demand"
          icon={Zap}
          color="bg-amber-600"
        />
        <KpiCard
          title="Smart Charging Savings"
          value={`${smartChargingSavings.toFixed(0)}M AUD`}
          sub="annual estimated savings"
          icon={DollarSign}
          color="bg-purple-600"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* EV Adoption Forecast AreaChart */}
        <ChartCard title="EV Adoption Forecast (2024-2035)">
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={data.adoption}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'Fleet (k)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Area type="monotone" dataKey="bev_fleet_k" name="BEV" stackId="1" stroke={ADOPTION_COLOURS.bev} fill={ADOPTION_COLOURS.bev} fillOpacity={0.6} />
              <Area type="monotone" dataKey="phev_fleet_k" name="PHEV" stackId="1" stroke={ADOPTION_COLOURS.phev} fill={ADOPTION_COLOURS.phev} fillOpacity={0.6} />
              <Area type="monotone" dataKey="v2g_enabled_k" name="V2G Enabled" stackId="2" stroke={ADOPTION_COLOURS.v2g} fill={ADOPTION_COLOURS.v2g} fillOpacity={0.4} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Charging Load Profile ComposedChart */}
        <ChartCard title="24-Hour Charging Load Profile">
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={data.charging_profile}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="unmanaged_load_mw" name="Unmanaged" fill={CHARGING_COLOURS.unmanaged} opacity={0.7} />
              <Bar dataKey="smart_charging_mw" name="Smart Charging" fill={CHARGING_COLOURS.smart} opacity={0.7} />
              <Bar dataKey="v2g_discharge_mw" name="V2G Discharge" fill={CHARGING_COLOURS.v2g} opacity={0.7} />
              <Line type="monotone" dataKey="solar_generation_mw" name="Solar Gen" stroke={CHARGING_COLOURS.solar} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Grid Impact by State BarChart */}
        <ChartCard title="Grid Impact by State">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data.state_impacts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="additional_peak_mw" name="Additional Peak MW" fill="#ef4444" />
              <Bar dataKey="v2g_capacity_mw" name="V2G Capacity MW" fill="#10b981" />
              <Bar dataKey="smart_charging_reduction_mw" name="Smart Charging Reduction MW" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Monthly Charging vs Solar LineChart */}
        <ChartCard title="Monthly Charging Energy vs Solar Generation">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'GWh', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="charging_energy_gwh" name="Charging Energy" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="solar_generation_gwh" name="Solar Generation" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table: Fleet Operator Summary */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Fleet Operator Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4 text-right">Fleet Size</th>
                <th className="py-3 px-4 text-right">V2G %</th>
                <th className="py-3 px-4 text-right">Avg Charge Rate kW</th>
                <th className="py-3 px-4 text-right">Annual Energy MWh</th>
                <th className="py-3 px-4 text-right">Grid Services Revenue (k AUD)</th>
              </tr>
            </thead>
            <tbody>
              {data.fleet_operators.map((op) => (
                <tr key={op.operator_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 px-4 font-medium text-white">{op.operator_name}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{op.fleet_size.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${op.v2g_pct >= 40 ? 'bg-green-900 text-green-300' : op.v2g_pct >= 20 ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                      {op.v2g_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">{op.avg_charge_rate_kw.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{op.annual_energy_mwh.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-emerald-400">${op.grid_services_revenue_k_aud.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table: Charging Infrastructure by State */}
      <div className="bg-gray-800 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Charging Infrastructure by State</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4 text-right">DC Fast Chargers</th>
                <th className="py-3 px-4 text-right">AC Destination</th>
                <th className="py-3 px-4 text-right">Home Chargers (k)</th>
                <th className="py-3 px-4 text-right">Utilisation %</th>
              </tr>
            </thead>
            <tbody>
              {data.state_impacts.map((st) => (
                <tr key={st.state} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 px-4 font-medium text-white">
                    <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: STATE_COLOURS[st.state] || '#6b7280' }} />
                    {st.state}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">{st.dc_fast_chargers.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{st.ac_destination_chargers.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{st.home_chargers_k.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${st.charger_utilisation_pct >= 60 ? 'bg-green-900 text-green-300' : st.charger_utilisation_pct >= 40 ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                      {st.charger_utilisation_pct.toFixed(1)}%
                    </span>
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
