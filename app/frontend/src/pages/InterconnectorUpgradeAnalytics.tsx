import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { ArrowLeftRight, DollarSign, TrendingUp, Zap, Activity } from 'lucide-react'
import { getInterconnectorUpgradeDashboard, InterconnectorUpgradeDashboard } from '../api/client'

const PROJECT_COLORS: Record<string, string> = {
  HUMELINK:       '#3b82f6',
  VNI_WEST:       '#10b981',
  QNI_MIDDLEWARE: '#f59e0b',
  ENERGY_CONNECT: '#ef4444',
  MARINUS_1:      '#8b5cf6',
  COPPERSTRING:   '#06b6d4',
}

const PROJECT_SHORT: Record<string, string> = {
  HUMELINK:       'HumeLink',
  VNI_WEST:       'VNI-West',
  QNI_MIDDLEWARE: 'QNI-Mid',
  ENERGY_CONNECT: 'EnConnect',
  MARINUS_1:      'Marinus 1',
  COPPERSTRING:   'CopperStr',
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  OPERATING:    { bg: 'bg-green-900',  text: 'text-green-300'  },
  CONSTRUCTION: { bg: 'bg-blue-900',   text: 'text-blue-300'   },
  APPROVED:     { bg: 'bg-amber-900',  text: 'text-amber-300'  },
  PROPOSED:     { bg: 'bg-gray-700',   text: 'text-gray-300'   },
}

const BENEFIT_COLORS: Record<string, string> = {
  CONGESTION_RENT:    '#3b82f6',
  FUEL_COST_SAVING:   '#10b981',
  RELIABILITY:        '#f59e0b',
  RENEWABLE_FIRMING:  '#8b5cf6',
  AVOIDED_INVESTMENT: '#ef4444',
  CONSUMER_SURPLUS:   '#06b6d4',
}

const BENEFIT_LABELS: Record<string, string> = {
  CONGESTION_RENT:    'Congestion Rent',
  FUEL_COST_SAVING:   'Fuel Cost Saving',
  RELIABILITY:        'Reliability',
  RENEWABLE_FIRMING:  'Renewable Firming',
  AVOIDED_INVESTMENT: 'Avoided Investment',
  CONSUMER_SURPLUS:   'Consumer Surplus',
}

const SCENARIO_COLORS: Record<string, string> = {
  STEP_CHANGE:  '#10b981',
  CENTRAL:      '#3b82f6',
  SLOW_CHANGE:  '#f59e0b',
}

export default function InterconnectorUpgradeAnalytics() {
  const [data, setData] = useState<InterconnectorUpgradeDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getInterconnectorUpgradeDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading interconnector upgrade analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  // ---- KPI calculations ----
  const totalCapex = data.projects.reduce((s: number, p: any) => s + p.capex_bn_aud, 0)
  const totalNpv = data.projects.reduce((s: number, p: any) => s + p.npv_bn_aud, 0)
  const projectsBcrAbove1 = data.projects.filter((p: any) => p.bcr > 1).length
  const highestCongestionProject = [...data.flow_analysis].sort(
    (a: any, b: any) => b.congestion_hours_pct - a.congestion_hours_pct
  )[0]

  // ---- Benefit breakdown by project ----
  const benefitTypes = Array.from(
    new Set(data.benefits.map((b: any) => b.benefit_type))
  ) as string[]
  const benefitChartData = data.projects.map((p: any) => {
    const row: Record<string, string | number> = { project: PROJECT_SHORT[p.project_id] ?? p.project_id }
    benefitTypes.forEach(bt => {
      const recs = data.benefits.filter(
        (b: any) => b.project_id === p.project_id && b.benefit_type === bt
      )
      row[bt] = recs.reduce((s: number, b: any) => s + b.benefit_m_aud_yr, 0)
    })
    return row
  })

  // ---- Scenario NPV comparison ----
  const scenarioChartData = data.projects.map((p: any) => {
    const row: Record<string, string | number> = { project: PROJECT_SHORT[p.project_id] ?? p.project_id }
    ;['STEP_CHANGE', 'CENTRAL', 'SLOW_CHANGE'].forEach(sc => {
      const rec = data.scenarios.find((s: any) => s.project_id === p.project_id && s.scenario === sc)
      if (rec) row[sc] = rec.npv_bn_aud
    })
    return row
  })

  // ---- Flow analysis trend — annual flow TWh by project across years ----
  const allYears = Array.from(
    new Set(data.flow_analysis.map((f: any) => f.year))
  ).sort() as number[]
  const projectIds = data.projects.map((p: any) => p.project_id)
  const flowChartData = allYears.map(yr => {
    const row: Record<string, string | number> = { year: String(yr) }
    projectIds.forEach(pid => {
      const rec = data.flow_analysis.find((f: any) => f.project_id === pid && f.year === yr)
      if (rec) row[pid] = rec.annual_flow_twh
    })
    return row
  })

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="text-blue-400 w-7 h-7" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Interconnector Upgrade Business Case Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Economic case for proposed NEM interconnector expansions — HumeLink, VNI-West,
            QNI-Middleware, EnergyConnect, Marinus Link and CopperString
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-blue-400 w-4 h-4" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Total Capex Pipeline</span>
          </div>
          <p className="text-2xl font-bold text-blue-300">
            ${totalCapex.toFixed(1)}bn
          </p>
          <p className="text-gray-400 text-sm">AUD across {data.projects.length} projects</p>
          <p className="text-gray-500 text-xs mt-1">ISP-identified upgrades</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-green-400 w-4 h-4" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Total Portfolio NPV</span>
          </div>
          <p className="text-2xl font-bold text-green-300">
            ${totalNpv.toFixed(2)}bn
          </p>
          <p className="text-gray-400 text-sm">Central scenario NPV</p>
          <p className="text-gray-500 text-xs mt-1">AUD, real 2024</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="text-amber-400 w-4 h-4" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Projects with BCR &gt; 1</span>
          </div>
          <p className="text-2xl font-bold text-amber-300">
            {projectsBcrAbove1} / {data.projects.length}
          </p>
          <p className="text-gray-400 text-sm">Pass regulatory test</p>
          <p className="text-gray-500 text-xs mt-1">Central scenario</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="text-purple-400 w-4 h-4" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Highest Congestion Relief</span>
          </div>
          <p className="text-2xl font-bold text-purple-300">
            {highestCongestionProject?.congestion_hours_pct?.toFixed(1)}%
          </p>
          <p className="text-gray-400 text-sm">
            {PROJECT_SHORT[highestCongestionProject?.project_id] ?? highestCongestionProject?.project_id} — {highestCongestionProject?.year}
          </p>
          <p className="text-gray-500 text-xs mt-1">Congestion hours pre-upgrade</p>
        </div>
      </div>

      {/* Project overview table */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">
          Project Overview — NEM Interconnector Upgrade Pipeline
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Project</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Route</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Capex (bn AUD)</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Capacity (MW)</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Status</th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium">AER Approved</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">BCR</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">NPV (bn AUD)</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Online</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p: any) => {
                const statusStyle = STATUS_STYLES[p.status] ?? STATUS_STYLES['PROPOSED']
                return (
                  <tr key={p.project_id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PROJECT_COLORS[p.project_id] ?? '#9ca3af' }}
                        />
                        <span className="font-semibold text-white">{p.project_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-300">
                      {p.from_region} → {p.to_region}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-200">
                      ${p.capex_bn_aud.toFixed(2)}bn
                    </td>
                    <td className="py-3 px-3 text-right text-gray-200">
                      +{p.capacity_increase_mw.toLocaleString()} MW
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={p.aer_approved ? 'text-green-400' : 'text-gray-500'}>
                        {p.aer_approved ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={p.bcr >= 1 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                        {p.bcr.toFixed(2)}x
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={p.npv_bn_aud >= 0 ? 'text-green-300' : 'text-red-400'}>
                        ${p.npv_bn_aud.toFixed(2)}bn
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-400">{p.commissioning_year}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Benefit breakdown stacked bar chart */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-1">
          Benefit Breakdown by Project — Stacked by Benefit Type (M AUD/yr)
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Annual monetised benefit by category across all interconnector upgrade projects
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={benefitChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="project" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={v => `$${v}M`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(v: number, name: string) => [`$${v.toFixed(1)}M/yr`, BENEFIT_LABELS[name] ?? name]}
            />
            <Legend
              wrapperStyle={{ color: '#9ca3af', fontSize: 12 }}
              formatter={name => BENEFIT_LABELS[name] ?? name}
            />
            {benefitTypes.map(bt => (
              <Bar
                key={bt}
                dataKey={bt}
                name={bt}
                stackId="a"
                fill={BENEFIT_COLORS[bt] ?? '#6b7280'}
                radius={bt === benefitTypes[benefitTypes.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario NPV comparison grouped bar chart */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-1">
          Scenario NPV Comparison — Step Change vs Central vs Slow Change (bn AUD)
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Net present value sensitivity across AEMO ISP demand and renewable uptake scenarios
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={scenarioChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="project" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={v => `$${v}bn`}
            />
            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(v: number, name: string) => [
                `$${v.toFixed(2)}bn`,
                name === 'STEP_CHANGE' ? 'Step Change' : name === 'CENTRAL' ? 'Central' : 'Slow Change',
              ]}
            />
            <Legend
              wrapperStyle={{ color: '#9ca3af', fontSize: 12 }}
              formatter={name =>
                name === 'STEP_CHANGE' ? 'Step Change' : name === 'CENTRAL' ? 'Central' : 'Slow Change'
              }
            />
            <Bar dataKey="STEP_CHANGE" name="STEP_CHANGE" fill={SCENARIO_COLORS['STEP_CHANGE']} radius={[3, 3, 0, 0]} />
            <Bar dataKey="CENTRAL" name="CENTRAL" fill={SCENARIO_COLORS['CENTRAL']} radius={[3, 3, 0, 0]} />
            <Bar dataKey="SLOW_CHANGE" name="SLOW_CHANGE" fill={SCENARIO_COLORS['SLOW_CHANGE']} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Flow analysis trend line chart */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-1">
          Flow Analysis Trend — Annual Energy Flow by Project (TWh)
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Projected annual transmission flow across each interconnector upgrade over time
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={flowChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={v => `${v} TWh`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(v: number, name: string) => [
                `${v.toFixed(1)} TWh`,
                PROJECT_SHORT[name] ?? name,
              ]}
            />
            <Legend
              wrapperStyle={{ color: '#9ca3af', fontSize: 12 }}
              formatter={name => PROJECT_SHORT[name] ?? name}
            />
            {projectIds.map(pid => (
              <Line
                key={pid}
                type="monotone"
                dataKey={pid}
                name={pid}
                stroke={PROJECT_COLORS[pid] ?? '#9ca3af'}
                strokeWidth={2}
                dot={{ r: 4, fill: PROJECT_COLORS[pid] ?? '#9ca3af' }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
