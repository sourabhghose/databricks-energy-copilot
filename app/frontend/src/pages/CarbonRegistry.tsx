import { useEffect, useState, useMemo } from 'react'
import { Leaf, TrendingUp, BarChart2, List, AlertCircle, CheckCircle } from 'lucide-react'
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
import { api } from '../api/client'
import type { CarbonCreditDashboard, AccuProject, CarbonAccuMarketRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const METHOD_LABELS: Record<string, string> = {
  SAVANNA_FIRE: 'Savanna Fire',
  HUMAN_INDUCED_REGEN: 'Human Induced Regen',
  AVOIDED_DEFORESTATION: 'Avoided Deforestation',
  SOIL_CARBON: 'Soil Carbon',
  BLUE_CARBON: 'Blue Carbon',
  LANDFILL_GAS: 'Landfill Gas',
  INDUSTRIAL_EFFICIENCY: 'Industrial Efficiency',
  LIVESTOCK_METHANE: 'Livestock Methane',
  NATIVE_FOREST: 'Native Forest',
}

const METHOD_COLOURS: Record<string, string> = {
  SAVANNA_FIRE: 'bg-orange-800 text-orange-100',
  HUMAN_INDUCED_REGEN: 'bg-green-800 text-green-100',
  AVOIDED_DEFORESTATION: 'bg-emerald-700 text-emerald-100',
  SOIL_CARBON: 'bg-yellow-800 text-yellow-100',
  BLUE_CARBON: 'bg-blue-800 text-blue-100',
  LANDFILL_GAS: 'bg-gray-600 text-gray-100',
  INDUSTRIAL_EFFICIENCY: 'bg-slate-700 text-slate-100',
  LIVESTOCK_METHANE: 'bg-amber-800 text-amber-100',
  NATIVE_FOREST: 'bg-teal-800 text-teal-100',
}

const STATUS_COLOURS: Record<string, string> = {
  ACTIVE: 'bg-green-700 text-green-100',
  REGISTERED: 'bg-blue-700 text-blue-100',
  COMPLETED: 'bg-gray-600 text-gray-100',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent: string
}

function KpiCard({ title, value, sub, icon, accent }: KpiCardProps) {
  return (
    <div className={`rounded-xl border ${accent} bg-gray-800 p-5 flex flex-col gap-2 shadow`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</span>
        <span className="opacity-60">{icon}</span>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ACCU Price Chart
// ---------------------------------------------------------------------------

interface PriceChartProps {
  records: CarbonAccuMarketRecord[]
}

function AccuPriceChart({ records }: PriceChartProps) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow">
      <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-blue-400" />
        ACCU Spot &amp; 12-Month Futures Price (24 Months)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={records} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickLine={false}
            tickFormatter={v => `$${v}`}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#D1D5DB' }}
            itemStyle={{ color: '#F9FAFB' }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, undefined]}
          />
          <Legend
            wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="spot_price_aud"
            name="Spot Price (AUD)"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="futures_12m_aud"
            name="12M Futures (AUD)"
            stroke="#10B981"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Method Breakdown Bar Chart
// ---------------------------------------------------------------------------

interface MethodBreakdownProps {
  projects: AccuProject[]
}

function MethodBreakdown({ projects }: MethodBreakdownProps) {
  const data = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of projects) {
      map[p.method] = (map[p.method] || 0) + p.accu_issued
    }
    return Object.entries(map)
      .map(([method, total]) => ({ method: METHOD_LABELS[method] || method, total }))
      .sort((a, b) => b.total - a.total)
  }, [projects])

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow">
      <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
        <BarChart2 size={16} className="text-green-400" />
        Total ACCUs Issued by Method
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 16, bottom: 60, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="method"
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            tickLine={false}
            angle={-35}
            textAnchor="end"
          />
          <YAxis
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickLine={false}
            tickFormatter={v => fmtK(v)}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#D1D5DB' }}
            itemStyle={{ color: '#F9FAFB' }}
            formatter={(value: number) => [fmt(value), 'ACCUs Issued']}
          />
          <Bar dataKey="total" name="ACCUs Issued" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Projects Table
// ---------------------------------------------------------------------------

const ALL_METHODS = ['ALL', 'SAVANNA_FIRE', 'HUMAN_INDUCED_REGEN', 'SOIL_CARBON', 'AVOIDED_DEFORESTATION', 'LANDFILL_GAS', 'BLUE_CARBON', 'LIVESTOCK_METHANE', 'NATIVE_FOREST', 'INDUSTRIAL_EFFICIENCY']

interface ProjectsTableProps {
  projects: AccuProject[]
}

function ProjectsTable({ projects }: ProjectsTableProps) {
  const [methodFilter, setMethodFilter] = useState<string>('ALL')
  const [safeguardOnly, setSafeguardOnly] = useState(false)

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (methodFilter !== 'ALL' && p.method !== methodFilter) return false
      if (safeguardOnly && !p.safeguard_eligible) return false
      return true
    })
  }, [projects, methodFilter, safeguardOnly])

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <List size={16} className="text-purple-400" />
          ACCU Registered Projects
          <span className="ml-1 text-xs text-gray-500">({filtered.length} shown)</span>
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          {/* Method filter */}
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="text-xs bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ALL_METHODS.map(m => (
              <option key={m} value={m}>{m === 'ALL' ? 'All Methods' : (METHOD_LABELS[m] || m)}</option>
            ))}
          </select>
          {/* Safeguard toggle */}
          <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={safeguardOnly}
              onChange={e => setSafeguardOnly(e.target.checked)}
              className="accent-green-500 w-3.5 h-3.5"
            />
            Safeguard Eligible Only
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3 font-medium">Project</th>
              <th className="text-left py-2 pr-3 font-medium">Proponent</th>
              <th className="text-left py-2 pr-3 font-medium">State</th>
              <th className="text-left py-2 pr-3 font-medium">Method</th>
              <th className="text-left py-2 pr-3 font-medium">Status</th>
              <th className="text-right py-2 pr-3 font-medium">Area (ha)</th>
              <th className="text-right py-2 pr-3 font-medium">ACCUs Issued</th>
              <th className="text-right py-2 pr-3 font-medium">Pending</th>
              <th className="text-right py-2 pr-3 font-medium">Price $/ACCU</th>
              <th className="text-center py-2 font-medium">Safeguard</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-3 font-medium text-white">
                  <span className="text-gray-500 mr-1">{p.project_id}</span>
                  {p.project_name}
                </td>
                <td className="py-2 pr-3 text-gray-300">{p.proponent}</td>
                <td className="py-2 pr-3 text-gray-300">{p.state}</td>
                <td className="py-2 pr-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${METHOD_COLOURS[p.method] || 'bg-gray-700 text-gray-200'}`}>
                    {METHOD_LABELS[p.method] || p.method}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLOURS[p.status] || 'bg-gray-600 text-gray-200'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">{fmtK(p.area_ha)}</td>
                <td className="py-2 pr-3 text-right text-white font-medium">{fmt(p.accu_issued)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{fmt(p.accu_pending)}</td>
                <td className="py-2 pr-3 text-right text-green-400 font-semibold">${p.price_per_accu_aud.toFixed(2)}</td>
                <td className="py-2 text-center">
                  {p.safeguard_eligible
                    ? <CheckCircle size={14} className="text-green-400 inline" />
                    : <span className="text-gray-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-8">No projects match the selected filters.</div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CarbonRegistry() {
  const [dashboard, setDashboard] = useState<CarbonCreditDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.getAccuRegistryDashboard()
      .then(data => {
        setDashboard(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err?.message || 'Failed to load Carbon Registry data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading ACCU Registry data...</span>
        </div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-gray-900">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <AlertCircle size={40} className="text-red-400" />
          <span className="text-red-400 font-semibold">Error loading data</span>
          <span className="text-gray-400 text-sm">{error || 'Unknown error'}</span>
        </div>
      </div>
    )
  }

  const { projects, market_records } = dashboard

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-green-900/50 border border-green-700">
          <Leaf size={24} className="text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">ACCU Carbon Credit Registry</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Australian Carbon Credit Units — Registry Analytics &amp; Market Data
            <span className="ml-2 text-gray-600">Updated: {dashboard.timestamp}</span>
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="ACCU Spot Price"
          value={`$${dashboard.current_spot_price_aud.toFixed(2)}`}
          sub="AUD per unit"
          icon={<TrendingUp size={18} className="text-blue-400" />}
          accent="border-blue-700/50"
        />
        <KpiCard
          title="Registered Projects"
          value={fmt(dashboard.total_registered_projects)}
          sub="Active, registered &amp; completed"
          icon={<Leaf size={18} className="text-green-400" />}
          accent="border-green-700/50"
        />
        <KpiCard
          title="Total ACCUs Issued"
          value={fmtK(dashboard.total_accu_issued)}
          sub="Cumulative registry issuances"
          icon={<BarChart2 size={18} className="text-purple-400" />}
          accent="border-purple-700/50"
        />
        <KpiCard
          title="YTD Trading Volume"
          value={fmtK(dashboard.ytd_trading_volume)}
          sub="Units traded (12-month)"
          icon={<TrendingUp size={18} className="text-amber-400" />}
          accent="border-amber-700/50"
        />
      </div>

      {/* Price Chart */}
      <div className="mb-6">
        <AccuPriceChart records={market_records} />
      </div>

      {/* Projects Table */}
      <div className="mb-6">
        <ProjectsTable projects={projects} />
      </div>

      {/* Method Breakdown */}
      <div className="mb-6">
        <MethodBreakdown projects={projects} />
      </div>

      {/* Market Summary Footer */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Market Activity (Last 6 Months)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4 font-medium">Month</th>
                <th className="text-right py-2 pr-4 font-medium">Spot (AUD)</th>
                <th className="text-right py-2 pr-4 font-medium">12M Futures</th>
                <th className="text-right py-2 pr-4 font-medium">Volume Traded</th>
                <th className="text-right py-2 pr-4 font-medium">ACCUs Issued</th>
                <th className="text-right py-2 pr-4 font-medium">New Projects</th>
                <th className="text-right py-2 font-medium">Corporate Demand %</th>
              </tr>
            </thead>
            <tbody>
              {market_records.slice(-6).map(m => (
                <tr key={m.month} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 text-white font-medium">{m.month}</td>
                  <td className="py-2 pr-4 text-right text-blue-400 font-semibold">${m.spot_price_aud.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right text-green-400">${m.futures_12m_aud.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{fmt(m.volume_traded)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{fmt(m.accus_issued)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{m.new_projects_registered}</td>
                  <td className="py-2 text-right text-amber-400">{m.corporate_demand_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
