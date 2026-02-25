import { useEffect, useState } from 'react'
import { Fuel, Zap, DollarSign, Globe, TrendingDown } from 'lucide-react'
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
  AreaChart,
  Area,
} from 'recharts'
import { getHEOADashboard } from '../api/client'
import type { HEOADashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const TECH_COLOURS: Record<string, string> = {
  ALKALINE: '#3b82f6',
  PEM:      '#10b981',
  SOEC:     '#f59e0b',
  SMR_CCS:  '#ef4444',
}

const COST_COLOURS: Record<string, string> = {
  green: '#10b981',
  blue:  '#3b82f6',
  gray:  '#6b7280',
}

const STATE_COLOURS: Record<string, string> = {
  WA:  '#3b82f6',
  SA:  '#10b981',
  QLD: '#f59e0b',
  NSW: '#ef4444',
  TAS: '#8b5cf6',
  VIC: '#6366f1',
  NT:  '#f97316',
}

const SECTOR_COLOURS: Record<string, string> = {
  EXPORT:     '#3b82f6',
  INDUSTRIAL: '#f59e0b',
  TRANSPORT:  '#10b981',
  POWER:      '#8b5cf6',
  AMMONIA:    '#ef4444',
}

const STATUS_BADGE: Record<string, string> = {
  OPERATING:    'bg-green-600',
  CONSTRUCTION: 'bg-blue-600',
  FID:          'bg-amber-600',
  FEASIBILITY:  'bg-purple-600',
  CONCEPT:      'bg-gray-600',
}

const MOU_STATUS_BADGE: Record<string, string> = {
  SIGNED:      'bg-green-600',
  NEGOTIATING: 'bg-amber-600',
  CONCEPT:     'bg-gray-600',
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
        <Icon size={20} className="text-white" />
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
export default function HydrogenEconomyOutlookAnalytics() {
  const [data, setData] = useState<HEOADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHEOADashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Hydrogen Economy Outlook Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">Error: {error ?? 'No data received'}</p>
      </div>
    )
  }

  // Derived KPIs
  const totalElectrolyserCapacity = data.projects.reduce((s, p) => s + p.capacity_mw, 0)
  const latestGreenCost = data.costs.length > 0
    ? data.costs[data.costs.length - 1].green_lcoh_aud_kg
    : 0
  const exportPipelineCount = data.exports.length
  const totalInvestment = data.projects.reduce((s, p) => s + p.investment_b_aud, 0)

  // ---------- Chart data transforms ----------

  // Stacked bar: production capacity by technology per year
  const capacityByYearTech: Record<string, Record<string, number>> = {}
  for (const p of data.projects) {
    const yr = String(p.target_year)
    if (!capacityByYearTech[yr]) capacityByYearTech[yr] = { year: p.target_year } as any
    capacityByYearTech[yr][p.technology] = (capacityByYearTech[yr][p.technology] || 0) + p.capacity_mw
  }
  const capacityChartData = Object.values(capacityByYearTech).sort(
    (a: any, b: any) => a.year - b.year,
  )

  // LCOH trajectory
  const lcohData = data.costs.map((c) => ({
    year: c.year,
    Green: c.green_lcoh_aud_kg,
    Blue: c.blue_lcoh_aud_kg,
    Gray: c.gray_lcoh_aud_kg,
  }))

  // Horizontal bar: pipeline by state & status
  const stateStatusMap: Record<string, Record<string, number>> = {}
  for (const p of data.projects) {
    if (!stateStatusMap[p.state]) stateStatusMap[p.state] = {}
    stateStatusMap[p.state][p.status] = (stateStatusMap[p.state][p.status] || 0) + 1
  }
  const pipelineByState = Object.entries(stateStatusMap).map(([state, statuses]) => ({
    state,
    ...statuses,
  }))

  // Area chart: demand by sector
  const demandByYear: Record<number, Record<string, number>> = {}
  for (const d of data.demand) {
    if (!demandByYear[d.year]) demandByYear[d.year] = { year: d.year } as any
    demandByYear[d.year][d.sector] = (demandByYear[d.year][d.sector] || 0) + d.demand_ktpa
  }
  const demandChartData = Object.values(demandByYear).sort((a: any, b: any) => a.year - b.year)

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <Fuel className="text-emerald-400" size={28} />
        <div>
          <h1 className="text-xl font-bold">Hydrogen Economy Outlook Analytics</h1>
          <p className="text-xs text-gray-500">Sprint 165a — HEOA Dashboard</p>
        </div>
        <span className="ml-auto text-xs text-gray-600">{data.timestamp}</span>
      </header>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Electrolyser Capacity MW"
            value={totalElectrolyserCapacity.toLocaleString()}
            sub="Across all projects"
            icon={Zap}
            color="bg-blue-600"
          />
          <KpiCard
            title="Green H2 Production Cost $/kg"
            value={`$${latestGreenCost.toFixed(2)}`}
            sub="Latest year LCOH"
            icon={TrendingDown}
            color="bg-emerald-600"
          />
          <KpiCard
            title="Export Pipeline Projects"
            value={String(exportPipelineCount)}
            sub="Active MOUs"
            icon={Globe}
            color="bg-purple-600"
          />
          <KpiCard
            title="Total Investment Committed B AUD"
            value={`$${totalInvestment.toFixed(1)}B`}
            sub="All project stages"
            icon={DollarSign}
            color="bg-amber-600"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stacked BarChart: Capacity by Technology */}
          <ChartCard title="Hydrogen Production Capacity by Technology (MW)">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={capacityChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                <Legend />
                {Object.keys(TECH_COLOURS).map((tech) => (
                  <Bar key={tech} dataKey={tech} stackId="a" fill={TECH_COLOURS[tech]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* LineChart: LCOH Trajectory */}
          <ChartCard title="Levelised Cost of Hydrogen (LCOH) Trajectory ($/kg)">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={lcohData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="Green" stroke={COST_COLOURS.green} strokeWidth={2} dot />
                <Line type="monotone" dataKey="Blue" stroke={COST_COLOURS.blue} strokeWidth={2} dot />
                <Line type="monotone" dataKey="Gray" stroke={COST_COLOURS.gray} strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Horizontal BarChart: Pipeline by State & Status */}
          <ChartCard title="Project Pipeline by State and Status">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={pipelineByState} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis type="category" dataKey="state" stroke="#9ca3af" fontSize={12} width={40} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                <Legend />
                {['OPERATING', 'CONSTRUCTION', 'FID', 'FEASIBILITY', 'CONCEPT'].map((status) => (
                  <Bar key={status} dataKey={status} stackId="a" fill={
                    status === 'OPERATING' ? '#10b981' :
                    status === 'CONSTRUCTION' ? '#3b82f6' :
                    status === 'FID' ? '#f59e0b' :
                    status === 'FEASIBILITY' ? '#8b5cf6' : '#6b7280'
                  } />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* AreaChart: Projected Demand by Sector */}
          <ChartCard title="Projected Hydrogen Demand by Sector (ktpa) 2024-2035">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={demandChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                <Legend />
                {Object.keys(SECTOR_COLOURS).map((sector) => (
                  <Area
                    key={sector}
                    type="monotone"
                    dataKey={sector}
                    stackId="1"
                    stroke={SECTOR_COLOURS[sector]}
                    fill={SECTOR_COLOURS[sector]}
                    fillOpacity={0.6}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Major H2 Projects Table */}
        <ChartCard title="Major Hydrogen Projects">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="py-2 px-3">Project</th>
                  <th className="py-2 px-3">Developer</th>
                  <th className="py-2 px-3">State</th>
                  <th className="py-2 px-3">Capacity MW</th>
                  <th className="py-2 px-3">Technology</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Investment B AUD</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p, i) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 px-3 text-gray-200">{p.project_name}</td>
                    <td className="py-2 px-3 text-gray-300">{p.developer}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: STATE_COLOURS[p.state] || '#9ca3af' }}>
                        {p.state}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-300">{p.capacity_mw.toLocaleString()}</td>
                    <td className="py-2 px-3 text-gray-300">{p.technology}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${STATUS_BADGE[p.status] || 'bg-gray-600'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-300">${p.investment_b_aud.toFixed(1)}B</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        {/* Export MOU Table */}
        <ChartCard title="Export Memoranda of Understanding (MOUs)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="py-2 px-3">Partner Country</th>
                  <th className="py-2 px-3">Volume ktpa</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Target Year</th>
                  <th className="py-2 px-3">Port</th>
                </tr>
              </thead>
              <tbody>
                {data.exports.map((e, i) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 px-3 text-gray-200">{e.partner_country}</td>
                    <td className="py-2 px-3 text-gray-300">{e.mou_volume_ktpa}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${MOU_STATUS_BADGE[e.status] || 'bg-gray-600'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-300">{e.target_year}</td>
                    <td className="py-2 px-3 text-gray-300">{e.port}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
