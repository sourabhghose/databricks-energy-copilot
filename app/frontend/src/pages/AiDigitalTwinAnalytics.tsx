import { useEffect, useState } from 'react'
import { Cpu } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import { getAiDigitalTwinDashboard, AiDigitalTwinDashboard } from '../api/client'

const STATUS_COLORS: Record<string, string> = {
  PRODUCTION: '#34d399',
  PILOT:      '#fbbf24',
  RESEARCH:   '#60a5fa',
  PLANNED:    '#a78bfa',
}

const TECH_COLORS: Record<string, string> = {
  ML:           '#60a5fa',
  DL:           '#a78bfa',
  RL:           '#f97316',
  DIGITAL_TWIN: '#34d399',
  OPTIMIZATION: '#fbbf24',
  HYBRID:       '#f87171',
}

const INVEST_COLORS: Record<string, string> = {
  INFRASTRUCTURE:     '#60a5fa',
  ANALYTICS_PLATFORM: '#34d399',
  AI_MODELS:          '#a78bfa',
  DIGITAL_TWINS:      '#fbbf24',
  CYBERSECURITY:      '#f87171',
  TRAINING:           '#f97316',
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#9ca3af'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: color + '33', color }}
    >
      {status}
    </span>
  )
}

function TechBadge({ tech }: { tech: string }) {
  const color = TECH_COLORS[tech] ?? '#9ca3af'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: color + '33', color }}
    >
      {tech.replace('_', ' ')}
    </span>
  )
}

export default function AiDigitalTwinAnalytics() {
  const [data, setData] = useState<AiDigitalTwinDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAiDigitalTwinDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading AI & Digital Twin data...</div>
  if (error)   return <div className="flex items-center justify-center h-64 text-red-400">Error: {error}</div>
  if (!data)   return null

  // --- KPIs ---
  const productionUseCases = data.use_cases.filter(u => u.deployment_status === 'PRODUCTION').length
  const totalCostSavings = data.use_cases.reduce((s, u) => s + u.cost_saving_m_aud_yr, 0)
  const highestAutomation = data.automation.reduce((a, b) => (a.current_automation_pct > b.current_automation_pct ? a : b))
  const totalInvestment = data.investments.reduce((s, i) => s + i.investment_m_aud, 0)

  // --- Automation frontier chart data ---
  const automationChartData = data.automation.map(a => ({
    domain: a.domain.replace(/_/g, ' '),
    current: a.current_automation_pct,
    target2030: a.target_2030_pct,
  }))

  // --- Investment trend data: pivot by year ---
  const years = [...new Set(data.investments.map(i => i.year))].sort()
  const allCategories = [...new Set(data.investments.map(i => i.category))]
  const investTrendData = years.map(yr => {
    const row: Record<string, string | number> = { year: yr }
    allCategories.forEach(cat => {
      const rec = data.investments.find(i => i.year === yr && i.category === cat)
      row[cat] = rec ? rec.investment_m_aud : 0
    })
    return row
  })

  return (
    <div className="p-6 space-y-6 text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Cpu className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">AI &amp; Digital Twin — Electricity Sector Analytics</h1>
          <p className="text-sm text-gray-400">AI/ML deployment in grid operations, digital twin adoption, predictive maintenance value &amp; automation frontier in energy trading</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="AI Use Cases in Production"
          value={String(productionUseCases)}
          sub={`of ${data.use_cases.length} total use cases`}
        />
        <KpiCard
          label="Total Cost Savings"
          value={`$${totalCostSavings.toFixed(0)}M`}
          sub="AUD/yr across all use cases"
        />
        <KpiCard
          label="Highest Automation Domain"
          value={`${highestAutomation.current_automation_pct}%`}
          sub={highestAutomation.domain.replace(/_/g, ' ')}
        />
        <KpiCard
          label="Total AI Investment"
          value={`$${totalInvestment.toFixed(0)}M`}
          sub="AUD across 5 years"
        />
      </div>

      {/* Use Case Deployment Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">AI/ML Use Case Deployment</h2>
          <p className="text-xs text-gray-400">Deployment status, accuracy gains, cost savings, and technology by use case</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase bg-gray-900">
                <th className="px-4 py-3 text-left">Use Case</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Accuracy Improvement</th>
                <th className="px-4 py-3 text-right">Cost Saving (M AUD/yr)</th>
                <th className="px-4 py-3 text-right">Industry Adoption</th>
                <th className="px-4 py-3 text-left">Technology</th>
                <th className="px-4 py-3 text-right">Orgs Deployed</th>
              </tr>
            </thead>
            <tbody>
              {data.use_cases.map((u, i) => (
                <tr key={u.use_case_id} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}>
                  <td className="px-4 py-3 font-medium text-white">{u.use_case.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3"><StatusBadge status={u.deployment_status} /></td>
                  <td className="px-4 py-3 text-right text-green-400">+{u.accuracy_improvement_pct.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-blue-400">${u.cost_saving_m_aud_yr.toFixed(1)}M</td>
                  <td className="px-4 py-3 text-right text-gray-300">{u.adoption_rate_industry_pct.toFixed(0)}%</td>
                  <td className="px-4 py-3"><TechBadge tech={u.technology} /></td>
                  <td className="px-4 py-3 text-right text-gray-300">{u.organisations_deployed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Digital Twin Performance Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">Digital Twin Performance</h2>
          <p className="text-xs text-gray-400">Coverage, predictive accuracy, maintenance savings, and outage reduction by asset type</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase bg-gray-900">
                <th className="px-4 py-3 text-left">Asset Type</th>
                <th className="px-4 py-3 text-left">Operator</th>
                <th className="px-4 py-3 text-right">Coverage</th>
                <th className="px-4 py-3 text-right">Predictive Accuracy</th>
                <th className="px-4 py-3 text-right">Maintenance Saving (M AUD/yr)</th>
                <th className="px-4 py-3 text-right">Outage Reduction</th>
                <th className="px-4 py-3 text-right">Data Feeds</th>
                <th className="px-4 py-3 text-right">Impl. Cost (M AUD)</th>
              </tr>
            </thead>
            <tbody>
              {data.digital_twins.map((dt, i) => (
                <tr key={`${dt.asset_type}-${dt.operator}`} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}>
                  <td className="px-4 py-3 font-medium text-white">{dt.asset_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-gray-300">{dt.operator}</td>
                  <td className="px-4 py-3 text-right text-blue-400">{dt.coverage_pct.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-green-400">{dt.predictive_accuracy_pct.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-yellow-400">${dt.maintenance_saving_m_aud_yr.toFixed(1)}M</td>
                  <td className="px-4 py-3 text-right text-purple-400">{dt.outage_reduction_pct.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-gray-300">{dt.data_feeds_count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-300">${dt.implementation_cost_m_aud.toFixed(1)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Automation Frontier Bar Chart */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-base font-semibold text-white mb-1">Automation Frontier by Domain</h2>
          <p className="text-xs text-gray-400 mb-4">Current automation % vs 2030 target</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={automationChartData} layout="vertical" margin={{ left: 60, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis type="category" dataKey="domain" tick={{ fill: '#9ca3af', fontSize: 10 }} width={140} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(value: number, name: string) => [`${value}%`, name === 'current' ? 'Current' : '2030 Target']}
              />
              <Legend formatter={name => name === 'current' ? 'Current' : '2030 Target'} wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="current" fill="#60a5fa" radius={[0, 4, 4, 0]} name="current" />
              <Bar dataKey="target2030" fill="#a78bfa" radius={[0, 4, 4, 0]} name="target2030" />
              <ReferenceLine x={80} stroke="#f97316" strokeDasharray="4 2" label={{ value: '80%', fill: '#f97316', fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Investment Trend Line Chart */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-base font-semibold text-white mb-1">AI &amp; Digital Investment Trend</h2>
          <p className="text-xs text-gray-400 mb-4">Investment (M AUD) by category over 5 years</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={investTrendData} margin={{ right: 16, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${v}M`} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(value: number, name: string) => [`$${value}M`, name.replace(/_/g, ' ')]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} formatter={name => (name as string).replace(/_/g, ' ')} />
              {allCategories.map(cat => (
                <Line
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stroke={INVEST_COLORS[cat] ?? '#9ca3af'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Automation Details Summary */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">Automation Domain Detail</h2>
          <p className="text-xs text-gray-400">Human override rates, error rates, cost reductions, and workforce impact</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase bg-gray-900">
                <th className="px-4 py-3 text-left">Domain</th>
                <th className="px-4 py-3 text-right">Current %</th>
                <th className="px-4 py-3 text-right">Target 2030 %</th>
                <th className="px-4 py-3 text-right">Human Override %</th>
                <th className="px-4 py-3 text-right">Error Rate %</th>
                <th className="px-4 py-3 text-right">Cost Reduction (M AUD/yr)</th>
                <th className="px-4 py-3 text-right">Jobs Affected</th>
              </tr>
            </thead>
            <tbody>
              {data.automation.map((a, i) => (
                <tr key={a.domain} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}>
                  <td className="px-4 py-3 font-medium text-white">{a.domain.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-right text-blue-400">{a.current_automation_pct}%</td>
                  <td className="px-4 py-3 text-right text-purple-400">{a.target_2030_pct}%</td>
                  <td className="px-4 py-3 text-right text-yellow-400">{a.human_override_rate_pct}%</td>
                  <td className="px-4 py-3 text-right text-red-400">{a.error_rate_pct}%</td>
                  <td className="px-4 py-3 text-right text-green-400">${a.cost_reduction_m_aud_yr}M</td>
                  <td className="px-4 py-3 text-right text-gray-300">{a.jobs_affected.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
