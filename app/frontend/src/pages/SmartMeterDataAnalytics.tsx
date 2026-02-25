import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getSMDADashboard,
  SMDADashboard,
  SMDALoadProfileRecord,
  SMDARolloutRecord,
  SMDAConsumptionRecord,
  SMDASegmentRecord,
  SMDATariffMigrationRecord,
} from '../api/client'

const LOAD_COLORS: Record<string, string> = {
  residential_mw: '#3b82f6',
  commercial_mw: '#f59e0b',
  industrial_mw: '#ef4444',
}

const TARIFF_COLORS: Record<string, string> = {
  flat_pct: '#6b7280',
  tou_pct: '#3b82f6',
  demand_pct: '#f59e0b',
  dynamic_pct: '#10b981',
}

export default function SmartMeterDataAnalytics() {
  const [data, setData] = useState<SMDADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSMDADashboard().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="p-6 text-red-400">Error: {error}</div>
  if (!data) return <div className="p-6 text-gray-400">Loading Smart Meter Data Analytics...</div>

  // ---- KPI Calculations ----
  const smartMetersDeployedM = data.rollout.reduce((s, r) => s + r.deployed_m, 0)
  const dataPointsPerDayB = (smartMetersDeployedM * 48 * 1_000_000) / 1_000_000_000
  const avgConsumptionKwhDay = data.consumption.length > 0
    ? data.consumption.reduce((s, c) => s + c.avg_daily_kwh, 0) / data.consumption.length
    : 0
  const solarHouseholdsPct = data.segments.length > 0
    ? data.segments.reduce((s, seg) => s + seg.solar_pct * seg.count_k, 0) /
      data.segments.reduce((s, seg) => s + seg.count_k, 0)
    : 0

  // ---- AreaChart: Aggregated load profile ----
  const loadProfileData = data.load_profile
    .slice()
    .sort((a, b) => a.interval - b.interval)
    .map((lp) => ({
      ...lp,
      label: `${String(Math.floor((lp.interval - 1) / 2)).padStart(2, '0')}:${(lp.interval - 1) % 2 === 0 ? '00' : '30'}`,
    }))

  // ---- BarChart: Rollout by DNSP ----
  const rolloutData = data.rollout.slice().sort((a, b) => b.deployed_m - a.deployed_m)

  // ---- LineChart: Monthly avg consumption ----
  const consumptionData = data.consumption.slice().sort((a, b) => {
    if (a.month < b.month) return -1
    if (a.month > b.month) return 1
    return 0
  })

  // ---- Stacked BarChart: Tariff migration ----
  const tariffData = data.tariff_migration.slice().sort((a, b) => a.year - b.year)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold">Smart Meter Data Analytics</h1>
          <p className="text-gray-400 text-sm">Sprint 169b &mdash; SMDA Dashboard</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Smart Meters Deployed', value: `${smartMetersDeployedM.toFixed(1)} M`, color: 'text-cyan-400' },
          { label: 'Data Points / Day', value: `${dataPointsPerDayB.toFixed(1)} B`, color: 'text-blue-400' },
          { label: 'Avg Consumption', value: `${avgConsumptionKwhDay.toFixed(1)} kWh/day`, color: 'text-amber-400' },
          { label: 'Solar Households', value: `${solarHouseholdsPct.toFixed(1)} %`, color: 'text-green-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Row 1: Load Profile + Rollout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AreaChart: Load Profile */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Aggregated Load Profile (Half-Hour Intervals)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={loadProfileData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 10 }} interval={5} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Legend />
              <Area type="monotone" dataKey="residential_mw" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Residential MW" />
              <Area type="monotone" dataKey="commercial_mw" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Commercial MW" />
              <Area type="monotone" dataKey="industrial_mw" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Industrial MW" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* BarChart: Rollout by DNSP */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Smart Meter Rollout by DNSP</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={rolloutData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis dataKey="dnsp" type="category" stroke="#9ca3af" tick={{ fontSize: 10 }} width={120} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="deployed_m" fill="#3b82f6" name="Deployed (M)" />
              <Bar dataKey="target_m" fill="#6b7280" name="Target (M)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Monthly Consumption + Tariff Migration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LineChart: Monthly avg consumption */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Monthly Avg Consumption per Household</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={consumptionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 10 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="avg_daily_kwh" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Avg Daily kWh" />
              <Line type="monotone" dataKey="median_daily_kwh" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Median Daily kWh" />
              <Line type="monotone" dataKey="solar_export_kwh" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Solar Export kWh" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stacked BarChart: Tariff Migration */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Consumption by Tariff Type (Migration Trend)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={tariffData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="flat_pct" stackId="tariff" fill="#6b7280" name="Flat %" />
              <Bar dataKey="tou_pct" stackId="tariff" fill="#3b82f6" name="TOU %" />
              <Bar dataKey="demand_pct" stackId="tariff" fill="#f59e0b" name="Demand %" />
              <Bar dataKey="dynamic_pct" stackId="tariff" fill="#10b981" name="Dynamic %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table: DNSP Smart Meter Rollout */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">DNSP Smart Meter Rollout</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 px-3">DNSP</th>
              <th className="text-right py-2 px-3">Deployed (M)</th>
              <th className="text-right py-2 px-3">Target (M)</th>
              <th className="text-right py-2 px-3">Rollout %</th>
              <th className="text-right py-2 px-3">Data Quality %</th>
              <th className="text-right py-2 px-3">Avg Latency (min)</th>
              <th className="text-left py-2 px-3">Comm Tech</th>
            </tr>
          </thead>
          <tbody>
            {data.rollout.map((r) => (
              <tr key={r.dnsp} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 px-3 font-medium">{r.dnsp}</td>
                <td className="text-right py-2 px-3">{r.deployed_m.toFixed(2)}</td>
                <td className="text-right py-2 px-3">{r.target_m.toFixed(2)}</td>
                <td className="text-right py-2 px-3">{r.rollout_pct.toFixed(1)}</td>
                <td className="text-right py-2 px-3">{r.data_quality_pct.toFixed(1)}</td>
                <td className="text-right py-2 px-3">{r.avg_latency_min.toFixed(1)}</td>
                <td className="py-2 px-3">{r.comm_technology}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table: Consumption Segmentation */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Consumption Segmentation</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 px-3">Segment</th>
              <th className="text-right py-2 px-3">Avg Daily kWh</th>
              <th className="text-right py-2 px-3">Solar %</th>
              <th className="text-right py-2 px-3">Battery %</th>
              <th className="text-right py-2 px-3">EV %</th>
              <th className="text-right py-2 px-3">TOU Adoption %</th>
              <th className="text-right py-2 px-3">Count (K)</th>
            </tr>
          </thead>
          <tbody>
            {data.segments.map((seg) => (
              <tr key={seg.segment} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 px-3 font-medium">{seg.segment.replace(/_/g, ' ')}</td>
                <td className="text-right py-2 px-3">{seg.avg_daily_kwh.toFixed(1)}</td>
                <td className="text-right py-2 px-3">{seg.solar_pct.toFixed(1)}</td>
                <td className="text-right py-2 px-3">{seg.battery_pct.toFixed(1)}</td>
                <td className="text-right py-2 px-3">{seg.ev_pct.toFixed(1)}</td>
                <td className="text-right py-2 px-3">{seg.tou_adoption_pct.toFixed(1)}</td>
                <td className="text-right py-2 px-3">{seg.count_k.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
