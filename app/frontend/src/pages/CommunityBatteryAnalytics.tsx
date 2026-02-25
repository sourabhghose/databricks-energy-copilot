import { useEffect, useState } from 'react'
import { Battery } from 'lucide-react'
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getCBADashboard,
  CBADashboard,
  CBABatteryRecord,
  CBAOperationRecord,
  CBANetworkBenefitRecord,
  CBARevenueRecord,
} from '../api/client'

const STATUS_COLORS: Record<string, string> = {
  OPERATIONAL: '#10b981',
  COMMISSIONING: '#f59e0b',
  APPROVED: '#3b82f6',
  PLANNED: '#6b7280',
}

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6']

export default function CommunityBatteryAnalytics() {
  const [data, setData] = useState<CBADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCBADashboard().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="p-6 text-red-400">Error: {error}</div>
  if (!data) return <div className="p-6 text-gray-400">Loading Community Battery Analytics...</div>

  // ---- KPI Calculations ----
  const batteriesDeployed = data.batteries.filter(b => b.status === 'OPERATIONAL').length
  const totalCapacityMwh = data.batteries.reduce((s, b) => s + b.capacity_kwh, 0) / 1000
  const householdsServedK = data.batteries.reduce((s, b) => s + b.households_served, 0) / 1000
  const avgSolarCapture = data.batteries.length > 0
    ? data.batteries.reduce((s, b) => s + b.solar_capture_pct, 0) / data.batteries.length
    : 0

  // ---- BarChart: Deployments by DNSP ----
  const dnspMap = new Map<string, { dnsp: string; count: number; capacity_mwh: number }>()
  data.batteries.forEach((b) => {
    const existing = dnspMap.get(b.dnsp) || { dnsp: b.dnsp, count: 0, capacity_mwh: 0 }
    existing.count += 1
    existing.capacity_mwh += b.capacity_kwh / 1000
    dnspMap.set(b.dnsp, existing)
  })
  const dnspData = Array.from(dnspMap.values()).sort((a, b) => b.capacity_mwh - a.capacity_mwh)

  // ---- AreaChart: Daily operation ----
  const operationData = data.operation.slice().sort((a, b) => a.hour - b.hour)

  // ---- LineChart: Monthly network benefit ----
  const networkData = data.network_benefits.slice().sort((a, b) => {
    if (a.month < b.month) return -1
    if (a.month > b.month) return 1
    return 0
  })

  // ---- PieChart: Revenue stream allocation ----
  const totalRevenue = data.revenue.reduce(
    (acc, r) => ({
      network_deferral: acc.network_deferral + r.network_deferral_k_aud,
      fcas: acc.fcas + r.fcas_k_aud,
      energy_arbitrage: acc.energy_arbitrage + r.energy_arbitrage_k_aud,
      solar_sponge: acc.solar_sponge + r.solar_sponge_k_aud,
      customer_benefit: acc.customer_benefit + r.customer_benefit_k_aud,
    }),
    { network_deferral: 0, fcas: 0, energy_arbitrage: 0, solar_sponge: 0, customer_benefit: 0 },
  )
  const pieData = [
    { name: 'Network Deferral', value: totalRevenue.network_deferral },
    { name: 'FCAS', value: totalRevenue.fcas },
    { name: 'Energy Arbitrage', value: totalRevenue.energy_arbitrage },
    { name: 'Solar Sponge', value: totalRevenue.solar_sponge },
    { name: 'Customer Benefit', value: totalRevenue.customer_benefit },
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Battery className="w-8 h-8 text-green-400" />
        <div>
          <h1 className="text-2xl font-bold">Community Battery Analytics</h1>
          <p className="text-gray-400 text-sm">Sprint 170b &mdash; CBA Dashboard</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Community Batteries Deployed', value: `${batteriesDeployed}`, color: 'text-green-400' },
          { label: 'Total Capacity MWh', value: `${totalCapacityMwh.toFixed(1)}`, color: 'text-blue-400' },
          { label: 'Households Served k', value: `${householdsServedK.toFixed(1)}`, color: 'text-amber-400' },
          { label: 'Solar Export Captured %', value: `${avgSolarCapture.toFixed(1)}`, color: 'text-cyan-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Row 1: Deployments by DNSP + Daily Operation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-lg font-semibold mb-3">Deployments by DNSP</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={dnspData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="dnsp" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af' }} label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af' }} label={{ value: 'MWh', angle: 90, position: 'insideRight', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
              <Legend />
              <Bar yAxisId="left" dataKey="count" name="Batteries" fill="#3b82f6" />
              <Bar yAxisId="right" dataKey="capacity_mwh" name="Capacity MWh" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-lg font-semibold mb-3">Typical Daily Operation</h2>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={operationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" tick={{ fill: '#9ca3af' }} label={{ value: 'Hour', position: 'insideBottom', fill: '#9ca3af' }} />
              <YAxis tick={{ fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
              <Legend />
              <Area type="monotone" dataKey="avg_charge_kw" name="Charge kW" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              <Area type="monotone" dataKey="avg_discharge_kw" name="Discharge kW" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
              <Area type="monotone" dataKey="avg_soc_pct" name="SoC %" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Monthly Network Benefit + Revenue Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-lg font-semibold mb-3">Monthly Network Benefit</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={networkData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af' }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af' }} label={{ value: 'Events', angle: 90, position: 'insideRight', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="peak_reduction_mw" name="Peak Reduction MW" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="voltage_support_events" name="Voltage Support Events" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-lg font-semibold mb-3">Revenue Stream Allocation</h2>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table: Battery Deployment Register */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-3">Battery Deployment Register</h2>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Suburb</th>
              <th className="px-3 py-2">DNSP</th>
              <th className="px-3 py-2 text-right">kW</th>
              <th className="px-3 py-2 text-right">kWh</th>
              <th className="px-3 py-2 text-right">Households</th>
              <th className="px-3 py-2 text-right">Solar %</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.batteries.map((b) => (
              <tr key={b.name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-3 py-2 font-medium">{b.name}</td>
                <td className="px-3 py-2">{b.suburb}</td>
                <td className="px-3 py-2">{b.dnsp}</td>
                <td className="px-3 py-2 text-right">{b.capacity_kw.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{b.capacity_kwh.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{b.households_served.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{b.solar_capture_pct.toFixed(1)}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: STATUS_COLORS[b.status] || '#9ca3af' }}>
                    {b.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table: Financial Performance */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-3">Financial Performance</h2>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <tr>
              <th className="px-3 py-2">Battery</th>
              <th className="px-3 py-2 text-right">Network Deferral k</th>
              <th className="px-3 py-2 text-right">FCAS k</th>
              <th className="px-3 py-2 text-right">Energy Arb k</th>
              <th className="px-3 py-2 text-right">Solar Sponge k</th>
              <th className="px-3 py-2 text-right">Customer k</th>
              <th className="px-3 py-2 text-right">Total k AUD</th>
              <th className="px-3 py-2 text-right">Cost Recovery %</th>
            </tr>
          </thead>
          <tbody>
            {data.revenue.map((r) => (
              <tr key={r.battery_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-3 py-2 font-medium">{r.battery_name}</td>
                <td className="px-3 py-2 text-right">{r.network_deferral_k_aud.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.fcas_k_aud.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.energy_arbitrage_k_aud.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.solar_sponge_k_aud.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.customer_benefit_k_aud.toFixed(1)}</td>
                <td className="px-3 py-2 text-right font-semibold text-green-400">{r.total_k_aud.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.cost_recovery_pct.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
