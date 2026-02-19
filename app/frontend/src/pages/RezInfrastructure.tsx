import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Zap, TrendingUp, Building2, Layers, RefreshCw } from 'lucide-react'
import { api, RezDashboard, RezProject, IspProject, CisContract } from '../api/client'

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function statusBadge(status: string): React.ReactNode {
  const map: Record<string, string> = {
    'Operational':        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'Under Construction': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'Committed':          'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'Approved':           'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'Proposed':           'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    'Assessment':         'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  }
  const cls = map[status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

function technologyChip(technology: string): React.ReactNode {
  const map: Record<string, string> = {
    'Wind':    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'Solar':   'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    'Storage': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'Hybrid':  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  }
  const cls = map[technology] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {technology}
    </span>
  )
}

function fmt(n: number, decimals = 1): string {
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  Icon: React.ElementType
  iconColor: string
}

function KpiCard({ label, value, sub, Icon, iconColor }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-4">
      <div className={`p-3 rounded-full bg-gray-100 dark:bg-gray-700 ${iconColor}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// REZ Projects table
// ---------------------------------------------------------------------------

function RezProjectsTable({ projects }: { projects: RezProject[] }) {
  const [stateFilter, setStateFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')

  const states = ['All', ...Array.from(new Set(projects.map(p => p.state))).sort()]
  const statuses = ['All', 'Operational', 'Under Construction', 'Committed', 'Proposed']

  const filtered = projects.filter(p => {
    const matchState = stateFilter === 'All' || p.state === stateFilter
    const matchStatus = statusFilter === 'All' || p.status === statusFilter
    return matchState && matchStatus
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">REZ Development Pipeline</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            AEMO-declared Renewable Energy Zones across NSW, QLD, VIC, SA
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            {states.map(s => <option key={s}>{s}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            {statuses.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3">REZ Name</th>
              <th className="text-left px-4 py-3">State</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Total Cap. (MW)</th>
              <th className="text-right px-4 py-3">Committed (MW)</th>
              <th className="text-right px-4 py-3">Operational (MW)</th>
              <th className="text-right px-4 py-3">Queue (MW)</th>
              <th className="text-right px-4 py-3">Target Year</th>
              <th className="text-right px-4 py-3">Network Inv. ($M)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(p => (
              <tr key={p.rez_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  <div>{p.rez_name}</div>
                  <div className="text-xs text-gray-400">{p.rez_id}</div>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{p.state}</td>
                <td className="px-4 py-3">{statusBadge(p.status)}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{p.total_capacity_mw.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{p.committed_capacity_mw.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">{p.operational_capacity_mw.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{p.connection_queue_mw.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{p.target_completion_year}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">${p.network_investment_m.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">No REZ projects match the selected filters.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// REZ capacity chart
// ---------------------------------------------------------------------------

function RezCapacityChart({ projects }: { projects: RezProject[] }) {
  const chartData = projects.map(p => ({
    name: p.rez_name.replace(' REZ', '').replace('Central Queensland', 'CQ').replace('Southern Queensland', 'SQ').replace('Western Victoria', 'W. Vic').replace('Central-West Orana', 'CWO'),
    operational: p.operational_capacity_mw,
    committed: p.committed_capacity_mw - p.operational_capacity_mw,
    queue: p.connection_queue_mw,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">REZ Capacity Breakdown (MW)</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Operational vs committed vs connection queue per REZ</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
          <Tooltip
            formatter={(value: number, name: string) => [value.toLocaleString() + ' MW', name.charAt(0).toUpperCase() + name.slice(1)]}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="operational" stackId="a" fill="#22c55e" name="Operational" />
          <Bar dataKey="committed" stackId="a" fill="#3b82f6" name="Committed" />
          <Bar dataKey="queue" stackId="a" fill="#f59e0b" name="Connection Queue" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ISP Projects table
// ---------------------------------------------------------------------------

function IspProjectsTable({ projects }: { projects: IspProject[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          ISP Priority Transmission Projects
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          AEMO Integrated System Plan — actionable and regulatory investment projects
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Project Name</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">States</th>
              <th className="text-right px-4 py-3">Capacity (MVA)</th>
              <th className="text-right px-4 py-3">Voltage (kV)</th>
              <th className="text-right px-4 py-3">Capex ($M)</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">BCR</th>
              <th className="text-right px-4 py-3">Comm. Year</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {projects.map(p => (
              <tr key={p.project_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  <div>{p.project_name}</div>
                  <div className="text-xs text-gray-400">{p.project_id}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    p.category === 'Actionable ISP'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {p.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {p.states_connected.join(', ')}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{p.capacity_mva.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{p.voltage_kv}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">${p.capex_m.toLocaleString()}</td>
                <td className="px-4 py-3">{statusBadge(p.status)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-semibold ${p.benefit_cost_ratio >= 2.5 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {p.benefit_cost_ratio.toFixed(1)}x
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{p.expected_commissioning_year}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ISP Capex chart
// ---------------------------------------------------------------------------

function IspCapexChart({ projects }: { projects: IspProject[] }) {
  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']
  const chartData = projects.map(p => ({
    name: p.project_id,
    label: p.project_name.split('(')[0].trim().substring(0, 20),
    capex: p.capex_m,
    bcr: p.benefit_cost_ratio,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">ISP Project Capex ($M)</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Estimated capital expenditure per ISP transmission project</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => `$${(v/1000).toFixed(1)}B`} />
          <Tooltip
            formatter={(value: number) => [`$${value.toLocaleString()}M`, 'Capex']}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="capex" name="Capex ($M)" radius={[4, 4, 0, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CIS Contracts table
// ---------------------------------------------------------------------------

function CisContractsTable({ contracts }: { contracts: CisContract[] }) {
  const [techFilter, setTechFilter] = useState<string>('All')
  const [stateFilter, setStateFilter] = useState<string>('All')

  const technologies = ['All', 'Wind', 'Solar', 'Storage', 'Hybrid']
  const states = ['All', ...Array.from(new Set(contracts.map(c => c.state))).sort()]

  const filtered = contracts.filter(c => {
    const matchTech = techFilter === 'All' || c.technology === techFilter
    const matchState = stateFilter === 'All' || c.state === stateFilter
    return matchTech && matchState
  })

  const totalMw = filtered.reduce((sum, c) => sum + c.capacity_mw, 0)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Capacity Investment Scheme (CIS) Contracts
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Australian Government CIS auction results — floor price contracts for new capacity
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {filtered.length} contracts | {fmt(totalMw / 1000, 2)} GW
          </span>
          <select
            value={techFilter}
            onChange={e => setTechFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            {technologies.map(t => <option key={t}>{t}</option>)}
          </select>
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            {states.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Project Name</th>
              <th className="text-left px-4 py-3">Technology</th>
              <th className="text-left px-4 py-3">State</th>
              <th className="text-right px-4 py-3">Capacity (MW)</th>
              <th className="text-right px-4 py-3">Strike Price ($/MWh)</th>
              <th className="text-right px-4 py-3">Duration (yrs)</th>
              <th className="text-left px-4 py-3">Auction Round</th>
              <th className="text-left px-4 py-3">Developer</th>
              <th className="text-right px-4 py-3">Comm. Year</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(c => (
              <tr key={c.contract_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  <div>{c.project_name}</div>
                  <div className="text-xs text-gray-400">{c.contract_id}</div>
                </td>
                <td className="px-4 py-3">{technologyChip(c.technology)}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.state}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{c.capacity_mw.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">${c.strike_price_mwh.toFixed(1)}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{c.contract_duration_years}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">{c.auction_round}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">{c.developer}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{c.commissioning_year}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">No CIS contracts match the selected filters.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CIS technology breakdown chart
// ---------------------------------------------------------------------------

function CisTechChart({ contracts }: { contracts: CisContract[] }) {
  const techMap: Record<string, number> = {}
  for (const c of contracts) {
    techMap[c.technology] = (techMap[c.technology] ?? 0) + c.capacity_mw
  }
  const chartData = Object.entries(techMap).map(([tech, mw]) => ({ tech, mw }))
  const TECH_COLORS: Record<string, string> = {
    Wind: '#3b82f6',
    Solar: '#f59e0b',
    Storage: '#8b5cf6',
    Hybrid: '#22c55e',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">CIS Contracted Capacity by Technology (MW)</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Total contracted MW across all CIS auction rounds</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="tech" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
          <Tooltip
            formatter={(value: number) => [value.toLocaleString() + ' MW', 'Contracted Capacity']}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="mw" name="Capacity (MW)" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={TECH_COLORS[entry.tech] ?? '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function RezInfrastructure() {
  const [dashboard, setDashboard] = useState<RezDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getRezDashboard()
      setDashboard(data)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load REZ dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <RefreshCw size={20} className="animate-spin" />
          <span>Loading REZ & Infrastructure data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 font-medium">Error loading REZ dashboard</p>
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
          <button
            onClick={load}
            className="mt-3 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!dashboard) return null

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap size={22} className="text-amber-500" />
            REZ & Infrastructure Investment Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Renewable Energy Zones, ISP priority transmission projects, and Capacity Investment Scheme contracts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Refreshed {lastRefresh.toLocaleTimeString('en-AU')}
          </span>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total REZ Capacity"
          value={`${fmt(dashboard.total_rez_capacity_gw)} GW`}
          sub={`${dashboard.rez_projects.length} REZs across NEM`}
          Icon={Zap}
          iconColor="text-amber-500"
        />
        <KpiCard
          label="Operational REZ"
          value={`${fmt(dashboard.operational_rez_gw)} GW`}
          sub="Currently generating"
          Icon={TrendingUp}
          iconColor="text-green-500"
        />
        <KpiCard
          label="Under Construction"
          value={`${fmt(dashboard.under_construction_gw)} GW`}
          sub="Committed capacity in build"
          Icon={Building2}
          iconColor="text-blue-500"
        />
        <KpiCard
          label="CIS Contracted"
          value={`${fmt(dashboard.cis_contracted_capacity_gw)} GW`}
          sub={`${dashboard.total_cis_contracts} contracts | $${fmt(dashboard.isp_actionable_capex_b, 1)}B ISP capex`}
          Icon={Layers}
          iconColor="text-purple-500"
        />
      </div>

      {/* REZ Projects table */}
      <RezProjectsTable projects={dashboard.rez_projects} />

      {/* REZ capacity chart */}
      <RezCapacityChart projects={dashboard.rez_projects} />

      {/* ISP Projects */}
      <IspProjectsTable projects={dashboard.isp_projects} />

      {/* ISP Capex chart */}
      <IspCapexChart projects={dashboard.isp_projects} />

      {/* CIS Contracts */}
      <CisContractsTable contracts={dashboard.cis_contracts} />

      {/* CIS tech chart */}
      <CisTechChart contracts={dashboard.cis_contracts} />

      {/* Footer note */}
      <div className="text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-4">
        Data sourced from AEMO Integrated System Plan (ISP) 2024, NSW/QLD/VIC/SA REZ programs, and Australian Government
        Capacity Investment Scheme. Mock data for demonstration — actual figures may vary.
        Last updated: {new Date(dashboard.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
      </div>
    </div>
  )
}
