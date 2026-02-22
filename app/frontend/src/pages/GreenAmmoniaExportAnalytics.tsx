import { useEffect, useState } from 'react'
import { Ship, AlertTriangle } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getGreenAmmoniaExportDashboard,
  GAEXDashboard,
  GAEXProductionRecord,
  GAEXPolicyRecord,
} from '../api/client'

// ---- Helpers ----------------------------------------------------------------

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

const STATUS_COLOURS: Record<string, string> = {
  Operating: 'bg-green-500 text-white',
  Construction: 'bg-blue-500 text-white',
  FID: 'bg-purple-500 text-white',
  FEED: 'bg-yellow-500 text-gray-900',
  'Pre-FEED': 'bg-gray-500 text-white',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLOURS[status] ?? 'bg-gray-600 text-white'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>
  )
}

// ---- Chart data helpers -----------------------------------------------------

function buildCapacityByState(projects: GAEXProductionRecord[]) {
  const byState: Record<string, Record<string, number>> = {}
  for (const p of projects) {
    if (!byState[p.state]) byState[p.state] = {}
    byState[p.state][p.project_status] = (byState[p.state][p.project_status] ?? 0) + p.ammonia_capacity_ktpa
  }
  return Object.entries(byState).map(([state, statuses]) => ({ state, ...statuses }))
}

function buildLcoaCurve(data: GAEXDashboard) {
  const years = [2025, 2027, 2029, 2030]
  const routes = ['Haber-Bosch + Green H2', 'Direct Electrolysis-Ammonia']
  return years.map(yr => {
    const entry: Record<string, number | string> = { year: yr }
    for (const route of routes) {
      const projectsForRoute = data.projects.filter(p => p.production_route === route).map(p => p.project_id)
      const records = data.cost_records.filter(c => c.year === yr && projectsForRoute.includes(c.project_id))
      if (records.length > 0) {
        const avg = records.reduce((s, r) => s + r.lcoa_dolpertonne, 0) / records.length
        entry[route] = Math.round(avg)
      }
    }
    return entry
  })
}

function buildMarketDemand(data: GAEXDashboard) {
  const byCountry: Record<string, { demand2030: number; demand2040: number }> = {}
  for (const m of data.markets) {
    if (!byCountry[m.destination_country]) {
      byCountry[m.destination_country] = { demand2030: 0, demand2040: 0 }
    }
    byCountry[m.destination_country].demand2030 += m.demand_ktpa_2030
    byCountry[m.destination_country].demand2040 += m.demand_ktpa_2040
  }
  return Object.entries(byCountry).map(([country, d]) => ({
    country,
    'Demand 2030 (ktpa)': Math.round(d.demand2030),
    'Demand 2040 (ktpa)': Math.round(d.demand2040),
  }))
}

function buildTradeFlows(data: GAEXDashboard) {
  const scenarios = ['Base', 'High Demand', 'Policy Push', 'Low Demand']
  const years = [2025, 2026, 2027, 2028, 2030]
  return years.map(yr => {
    const entry: Record<string, number | string> = { year: yr }
    for (const sc of scenarios) {
      const rec = data.trade_flows.find(tf => tf.year === yr && tf.scenario === sc)
      if (rec) entry[sc] = rec.australia_export_mtpa
    }
    return entry
  })
}

// ---- Main component ---------------------------------------------------------

export default function GreenAmmoniaExportAnalytics() {
  const [data, setData] = useState<GAEXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGreenAmmoniaExportDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Ship size={40} className="text-teal-400 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-400">Loading Green Ammonia Export data...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-400">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  const { summary, projects, policies } = data
  const capacityData = buildCapacityByState(projects)
  const lcoaData = buildLcoaCurve(data)
  const marketData = buildMarketDemand(data)
  const tradeData = buildTradeFlows(data)

  const topProjects = [...projects]
    .sort((a, b) => b.ammonia_capacity_ktpa - a.ammonia_capacity_ktpa)
    .slice(0, 10)

  const topPolicies = [...policies]
    .sort((a: GAEXPolicyRecord, b: GAEXPolicyRecord) => b.value_m - a.value_m)
    .slice(0, 10)

  const statusKeys = ['Operating', 'Construction', 'FID', 'FEED', 'Pre-FEED']
  const statusBarColours: Record<string, string> = {
    Operating: '#22c55e',
    Construction: '#3b82f6',
    FID: '#a855f7',
    FEED: '#eab308',
    'Pre-FEED': '#6b7280',
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Ship size={28} className="text-teal-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Green Ammonia Export Analytics</h1>
          <p className="text-sm text-gray-400">Australia's green ammonia export pipeline — projects, costs, markets, trade flows and policy</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Project Pipeline Capacity"
          value={`${summary.total_project_capacity_mtpa} Mtpa`}
          sub="Total ammonia capacity across all projects"
        />
        <KpiCard
          label="Operating Projects"
          value={String(summary.operating_projects)}
          sub={`FID/Construction: ${summary.fid_projects}`}
        />
        <KpiCard
          label="Avg LCOA 2030"
          value={`$${summary.avg_lcoa_2030}/t`}
          sub="Levelised cost of ammonia ($/tonne)"
        />
        <KpiCard
          label="Policy Support"
          value={`$${summary.total_policy_support_bn}bn`}
          sub="Total Federal + State government support"
        />
      </div>

      {/* Row 1: Capacity by State + LCOA Learning Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Capacity by state & status */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
            Project Capacity by State & Status (ktpa)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={capacityData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {statusKeys.map(sk => (
                <Bar key={sk} dataKey={sk} stackId="a" fill={statusBarColours[sk]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* LCOA Learning Curve */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
            LCOA Learning Curve 2025–2030 ($/tonne)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={lcoaData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[400, 950]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: number) => `$${v}/t`}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Line type="monotone" dataKey="Haber-Bosch + Green H2" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Direct Electrolysis-Ammonia" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Market Demand + Trade Flow Scenarios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Market Demand by Country */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
            Market Demand by Destination Country (ktpa)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={marketData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="country" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="Demand 2030 (ktpa)" fill="#14b8a6" />
              <Bar dataKey="Demand 2040 (ktpa)" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trade Flow Scenarios */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
            Australia Export by Scenario 2025–2030 (Mtpa)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={tradeData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: number) => `${v} Mtpa`}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Area type="monotone" dataKey="High Demand" stroke="#22c55e" fill="#22c55e22" strokeWidth={2} />
              <Area type="monotone" dataKey="Policy Push" stroke="#3b82f6" fill="#3b82f622" strokeWidth={2} />
              <Area type="monotone" dataKey="Base" stroke="#14b8a6" fill="#14b8a622" strokeWidth={2} />
              <Area type="monotone" dataKey="Low Demand" stroke="#ef4444" fill="#ef444422" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 10 Projects Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Top 10 Projects by Ammonia Capacity
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Project</th>
                <th className="text-left py-2 pr-4">Developer</th>
                <th className="text-left py-2 pr-4">State</th>
                <th className="text-right py-2 pr-4">Capacity (ktpa)</th>
                <th className="text-right py-2 pr-4">CapEx ($M)</th>
                <th className="text-left py-2 pr-4">Port</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {topProjects.map(p => (
                <tr key={p.project_id} className="border-b border-gray-700 hover:bg-gray-700 transition-colors">
                  <td className="py-2 pr-4 text-gray-200 font-medium max-w-[200px] truncate">{p.project_name}</td>
                  <td className="py-2 pr-4 text-gray-400 max-w-[140px] truncate">{p.developer}</td>
                  <td className="py-2 pr-4 text-gray-400">{p.state}</td>
                  <td className="py-2 pr-4 text-right text-teal-300 font-semibold">{p.ammonia_capacity_ktpa.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">${p.capex_m.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-gray-400">{p.port_name}</td>
                  <td className="py-2"><StatusBadge status={p.project_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 10 Policies Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Policy Support Summary (Top 10 by Value)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Policy Name</th>
                <th className="text-left py-2 pr-4">Jurisdiction</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-right py-2 pr-4">Value ($M)</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-left py-2">Beneficiary</th>
              </tr>
            </thead>
            <tbody>
              {topPolicies.map((pol: GAEXPolicyRecord) => (
                <tr key={pol.policy_id} className="border-b border-gray-700 hover:bg-gray-700 transition-colors">
                  <td className="py-2 pr-4 text-gray-200 font-medium max-w-[220px] truncate">{pol.policy_name}</td>
                  <td className="py-2 pr-4 text-gray-400">{pol.jurisdiction}</td>
                  <td className="py-2 pr-4 text-gray-400">{pol.policy_type}</td>
                  <td className="py-2 pr-4 text-right text-emerald-300 font-semibold">
                    {pol.value_m > 0 ? `$${pol.value_m.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      pol.status === 'Active' ? 'bg-green-700 text-green-100' :
                      pol.status === 'Announced' ? 'bg-yellow-700 text-yellow-100' :
                      'bg-gray-600 text-gray-200'
                    }`}>{pol.status}</span>
                  </td>
                  <td className="py-2 text-gray-400 max-w-[160px] truncate">{pol.beneficiary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
