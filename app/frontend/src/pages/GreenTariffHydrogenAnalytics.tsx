import { useEffect, useState } from 'react'
import { Zap, DollarSign, Activity, BarChart2 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  Cell,
} from 'recharts'
import { getGreenTariffHydrogenDashboard } from '../api/client'
import type { GTHAdashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const STATUS_COLOURS: Record<string, string> = {
  'Operating':    '#22c55e',
  'Construction': '#3b82f6',
  'Approved':     '#10b981',
  'Feasibility':  '#f59e0b',
}

const TECH_COLOURS: Record<string, string> = {
  'PEM Electrolysis': '#6366f1',
  'Alkaline':         '#10b981',
  'SOEC':             '#f59e0b',
  'SMR + CCS':        '#ef4444',
}

const STATE_COLOURS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#6366f1',
  QLD: '#f59e0b',
  SA:  '#10b981',
  WA:  '#ef4444',
  TAS: '#8b5cf6',
  NT:  '#ec4899',
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
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4">
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
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function GreenTariffHydrogenAnalytics() {
  const [data, setData] = useState<GTHAdashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGreenTariffHydrogenDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Green Tariff & Hydrogen Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const { tariffs, hydrogen_projects, cost_trends, exports, summary } = data

  // Chart 1: Green tariff premium (c/kWh) by retailer and state — grouped bar (2024)
  const stateList = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS']
  const retailerList = [...new Set(tariffs.map(t => t.retailer))]
  const premiumByRetailerState = retailerList.map(retailer => {
    const row: Record<string, number | string> = { retailer: retailer.replace(' Energy', '').replace('ReAmped Energy', 'ReAmped') }
    for (const state of stateList) {
      const match = tariffs.find(t => t.retailer === retailer && t.state === state)
      row[state] = match ? match.green_premium_c_kwh : 0
    }
    return row
  })

  // Chart 2: Hydrogen projects sorted by capacity_mw, coloured by status (horizontal bar)
  const h2ByCapacity = [...hydrogen_projects]
    .sort((a, b) => b.capacity_mw - a.capacity_mw)
    .map(p => ({
      name: p.project_name.length > 22 ? p.project_name.slice(0, 20) + '…' : p.project_name,
      capacity_mw: p.capacity_mw,
      status: p.status,
    }))

  // Chart 3: LCOH trend by technology (2021-2025) — line chart
  const years = [2021, 2022, 2023, 2024, 2025]
  const lcohTrendData = years.map(yr => {
    const row: Record<string, number | string> = { year: yr }
    for (const tech of Object.keys(TECH_COLOURS)) {
      const rec = cost_trends.find(ct => ct.year === yr && ct.technology === tech)
      row[tech] = rec ? rec.lcoh_aud_per_kg : 0
    }
    return row
  })

  // Chart 4: Export revenue by project (2024)
  const exportRev2024Map: Record<string, number> = {}
  for (const ex of exports) {
    if (ex.year === 2024) {
      exportRev2024Map[ex.project_id] = (exportRev2024Map[ex.project_id] ?? 0) + ex.export_revenue_m_aud
    }
  }
  const exportRevByProject = hydrogen_projects
    .map(p => ({
      name: p.project_name.length > 18 ? p.project_name.slice(0, 16) + '…' : p.project_name,
      revenue_m_aud: Math.round((exportRev2024Map[p.project_id] ?? 0) * 10) / 10,
      state: p.state,
    }))
    .sort((a, b) => b.revenue_m_aud - a.revenue_m_aud)

  // Chart 5: Electrolyser cost trend by technology (grouped, years 2021-2025)
  const electrolysercostData = years.map(yr => {
    const row: Record<string, number | string> = { year: yr }
    for (const tech of Object.keys(TECH_COLOURS)) {
      const rec = cost_trends.find(ct => ct.year === yr && ct.technology === tech)
      row[tech] = rec ? rec.electrolyser_cost_aud_per_kw : 0
    }
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-emerald-600 border-b border-emerald-700 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-emerald-800 rounded-lg">
          <Zap size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Green Tariff & Hydrogen Analytics</h1>
          <p className="text-xs text-emerald-200">Australian green energy tariffs and hydrogen project intelligence</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Total Tariff Products"
            value={String(summary.total_tariff_products)}
            sub="Green tariffs (2024)"
            icon={Zap}
            color="bg-emerald-600"
          />
          <KpiCard
            title="Total H2 Projects"
            value={String(summary.total_hydrogen_projects)}
            sub="Across Australia"
            icon={Activity}
            color="bg-blue-600"
          />
          <KpiCard
            title="Avg LCOH"
            value={`$${summary.avg_lcoh_aud_per_kg.toFixed(2)}/kg`}
            sub="Levelised cost of hydrogen"
            icon={DollarSign}
            color="bg-indigo-600"
          />
          <KpiCard
            title="Total H2 Capacity"
            value={`${summary.total_hydrogen_capacity_mw.toLocaleString()} MW`}
            sub="Electrolysis capacity"
            icon={BarChart2}
            color="bg-violet-600"
          />
        </div>

        {/* Chart 1: Green tariff premium by retailer and state */}
        <ChartCard title="Green Tariff Premium (c/kWh) by Retailer and State — 2024">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={premiumByRetailerState} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="retailer" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" c" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {stateList.map(state => (
                <Bar key={state} dataKey={state} fill={STATE_COLOURS[state]} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Hydrogen projects by capacity (horizontal bar, coloured by status) */}
        <ChartCard title="Hydrogen Projects by Capacity (MW) — coloured by Status">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={h2ByCapacity}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 160, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} width={155} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
                formatter={(value: number) => [`${value.toLocaleString()} MW`, 'Capacity']}
              />
              <Bar dataKey="capacity_mw" radius={[0, 4, 4, 0]}>
                {h2ByCapacity.map((entry, idx) => (
                  <Cell key={idx} fill={STATUS_COLOURS[entry.status] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Status legend */}
          <div className="flex flex-wrap gap-4 mt-3">
            {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colour }} />
                <span className="text-xs text-gray-400">{status}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Chart 3: LCOH trend by technology (line chart, 2021-2025) */}
        <ChartCard title="Levelised Cost of Hydrogen ($/kg) Trend by Technology — 2021 to 2025">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lcohTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/kg" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {Object.entries(TECH_COLOURS).map(([tech, colour]) => (
                <Line
                  key={tech}
                  type="monotone"
                  dataKey={tech}
                  stroke={colour}
                  strokeWidth={2}
                  dot={{ r: 3, fill: colour }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Charts 4 and 5 in a 2-column grid */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Chart 4: Export revenue by project (2024) */}
          <ChartCard title="Export Revenue by Project (A$M) — 2024">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={exportRevByProject} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" M" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#e5e7eb' }}
                  itemStyle={{ color: '#9ca3af' }}
                  formatter={(value: number) => [`$${value.toFixed(1)}M`, 'Revenue']}
                />
                <Bar dataKey="revenue_m_aud" radius={[4, 4, 0, 0]}>
                  {exportRevByProject.map((entry, idx) => (
                    <Cell key={idx} fill={STATE_COLOURS[entry.state] ?? '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Chart 5: Electrolyser cost trend by technology (grouped bars, 2021-2025) */}
          <ChartCard title="Electrolyser Cost Trend (AUD/kW) by Technology — 2021 to 2025">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={electrolysercostData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/kW" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#e5e7eb' }}
                  itemStyle={{ color: '#9ca3af' }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                {Object.entries(TECH_COLOURS).map(([tech, colour]) => (
                  <Bar key={tech} dataKey={tech} fill={colour} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
