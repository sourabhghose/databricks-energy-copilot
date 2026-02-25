import { useEffect, useState } from 'react'
import { Map } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, LineChart, Line,
} from 'recharts'
import {
  getISPADashboard,
  ISPADashboard,
  ISPAProjectRecord,
  ISPACapacityRecord,
  ISPASavingsRecord,
  ISPATransferRecord,
  ISPAScenarioRecord,
} from '../api/client'

const STATUS_COLORS: Record<string, string> = {
  COMMITTED: '#22c55e',
  ANTICIPATED: '#3b82f6',
  FUTURE: '#f59e0b',
  UNDER_ASSESSMENT: '#8b5cf6',
}

const FUEL_COLORS: Record<string, string> = {
  coal_gw: '#6b7280',
  gas_gw: '#f97316',
  wind_gw: '#06b6d4',
  solar_gw: '#eab308',
  battery_gw: '#a855f7',
  hydro_gw: '#3b82f6',
  hydrogen_gw: '#10b981',
}

const FUEL_LABELS: Record<string, string> = {
  coal_gw: 'Coal',
  gas_gw: 'Gas',
  wind_gw: 'Wind',
  solar_gw: 'Solar',
  battery_gw: 'Battery',
  hydro_gw: 'Hydro',
  hydrogen_gw: 'Hydrogen',
}

export default function IntegratedSystemPlanAnalytics() {
  const [data, setData] = useState<ISPADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getISPADashboard().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="p-6 text-red-400">Error: {error}</div>
  if (!data) return <div className="p-6 text-gray-400">Loading Integrated System Plan Analytics...</div>

  // ---- KPI Calculations ----
  const totalProjects = data.projects.length
  const totalInvestmentB = data.projects.reduce((s, p) => s + p.investment_b_aud, 0)
  const newTransferCapacityGW = data.transfers.reduce((s, t) => s + t.capacity_mw, 0) / 1000
  const stepChange2050 = data.capacity.find((c) => c.scenario === 'STEP_CHANGE' && c.year === 2050)
  const genCapacityRequiredGW = stepChange2050 ? stepChange2050.total_gw : 0

  // ---- BarChart: ISP actionable projects by status with investment ----
  const statusGroups: Record<string, { count: number; investment: number }> = {}
  data.projects.forEach((p) => {
    if (!statusGroups[p.status]) statusGroups[p.status] = { count: 0, investment: 0 }
    statusGroups[p.status].count += 1
    statusGroups[p.status].investment += p.investment_b_aud
  })
  const projectsByStatus = Object.entries(statusGroups).map(([status, v]) => ({
    status,
    count: v.count,
    investment_b_aud: parseFloat(v.investment.toFixed(1)),
  }))

  // ---- AreaChart: NEM generation capacity mix under Step Change ----
  const stepChangeCapacity = data.capacity
    .filter((c) => c.scenario === 'STEP_CHANGE')
    .slice()
    .sort((a, b) => a.year - b.year)

  // ---- LineChart: Consumer savings from ISP implementation ----
  const savingsData = data.savings.slice().sort((a, b) => a.year - b.year)

  // ---- Horizontal BarChart: Transfer capacity by corridor ----
  const transferData = data.transfers.slice().sort((a, b) => b.capacity_mw - a.capacity_mw)

  const fuelKeys = ['coal_gw', 'gas_gw', 'wind_gw', 'solar_gw', 'battery_gw', 'hydro_gw', 'hydrogen_gw'] as const

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center gap-3">
        <Map className="w-8 h-8 text-blue-400" />
        <h1 className="text-2xl font-bold">Integrated System Plan Analytics</h1>
      </div>

      {/* ---- KPIs ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'ISP Transmission Projects', value: totalProjects, fmt: (v: number) => v.toString() },
          { label: 'Total Transmission Investment B AUD', value: totalInvestmentB, fmt: (v: number) => v.toFixed(1) },
          { label: 'New Transfer Capacity GW', value: newTransferCapacityGW, fmt: (v: number) => v.toFixed(1) },
          { label: 'Generation Capacity Required GW', value: genCapacityRequiredGW, fmt: (v: number) => v.toFixed(0) },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-2xl font-bold mt-1">{kpi.fmt(kpi.value)}</p>
          </div>
        ))}
      </div>

      {/* ---- Charts Row 1 ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BarChart: ISP actionable projects by status */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">ISP Actionable Projects by Status</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={projectsByStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="status" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Investment B AUD', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Projects" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="investment_b_aud" fill="#f59e0b" name="Investment B AUD" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* AreaChart: NEM generation capacity mix 2024-2050 Step Change */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">NEM Generation Capacity Mix (Step Change)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={stepChangeCapacity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'GW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {fuelKeys.map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="1"
                  stroke={FUEL_COLORS[key]}
                  fill={FUEL_COLORS[key]}
                  name={FUEL_LABELS[key]}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---- Charts Row 2 ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LineChart: Consumer savings */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Consumer Savings from ISP Implementation (Cumulative B AUD)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={savingsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'B AUD', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="cumulative_savings_b_aud" stroke="#22c55e" strokeWidth={2} name="Cumulative Savings B AUD" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="counterfactual_cost_b_aud" stroke="#ef4444" strokeWidth={2} name="Counterfactual Cost B AUD" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Horizontal BarChart: Transfer capacity by interconnector corridor */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Transfer Capacity Additions by Corridor</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={transferData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'MW', position: 'insideBottom', fill: '#9ca3af', fontSize: 11, offset: -5 }} />
              <YAxis type="category" dataKey="corridor_name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={120} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="capacity_mw" fill="#06b6d4" name="Capacity MW" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---- Table: ISP Actionable Projects ---- */}
      <div className="bg-gray-800 rounded-xl p-5 overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">ISP Actionable Projects</h2>
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="py-2 pr-4">Project</th>
              <th className="py-2 pr-4">Corridor</th>
              <th className="py-2 pr-4 text-right">Capacity MW</th>
              <th className="py-2 pr-4 text-right">Investment B</th>
              <th className="py-2 pr-4">Timing</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4 text-right">BCR</th>
            </tr>
          </thead>
          <tbody>
            {data.projects.map((p) => (
              <tr key={p.project_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4 font-medium">{p.project_name}</td>
                <td className="py-2 pr-4">{p.corridor}</td>
                <td className="py-2 pr-4 text-right">{p.capacity_mw.toLocaleString()}</td>
                <td className="py-2 pr-4 text-right">{p.investment_b_aud.toFixed(1)}</td>
                <td className="py-2 pr-4">{p.timing}</td>
                <td className="py-2 pr-4">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{ backgroundColor: (STATUS_COLORS[p.status] || '#6b7280') + '22', color: STATUS_COLORS[p.status] || '#6b7280' }}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right">{p.benefit_cost_ratio.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- Table: Scenario Comparison ---- */}
      <div className="bg-gray-800 rounded-xl p-5 overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Scenario Comparison</h2>
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="py-2 pr-4">Scenario</th>
              <th className="py-2 pr-4 text-right">2030 Renewables %</th>
              <th className="py-2 pr-4 text-right">2050 Renewables %</th>
              <th className="py-2 pr-4 text-right">Coal Exit Year</th>
              <th className="py-2 pr-4 text-right">Total Investment B</th>
            </tr>
          </thead>
          <tbody>
            {data.scenarios.map((s) => (
              <tr key={s.scenario} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4 font-medium">{s.scenario.replace(/_/g, ' ')}</td>
                <td className="py-2 pr-4 text-right">{s.renewables_2030_pct}%</td>
                <td className="py-2 pr-4 text-right">{s.renewables_2050_pct}%</td>
                <td className="py-2 pr-4 text-right">{s.coal_exit_year}</td>
                <td className="py-2 pr-4 text-right">{s.total_investment_b_aud.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
