import { useEffect, useState } from 'react'
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
} from 'recharts'
import {
  EGFSDashboard,
  getGridFlexibilityServicesDashboard,
} from '../api/client'

export default function GridFlexibilityServicesAnalytics() {
  const [data, setData] = useState<EGFSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGridFlexibilityServicesDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-400 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Loading Grid Flexibility Services data...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center text-red-400">
          <p className="text-xl font-semibold mb-2">Failed to load data</p>
          <p className="text-gray-400">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  const { summary, services, costs, needs, tenders, future_needs } = data

  // ── KPI cards ──────────────────────────────────────────────────────────────
  const kpis = [
    {
      label: 'Total Ancillary Cost',
      value: `$${Number(summary.total_ancillary_cost_m).toFixed(1)}M`,
      sub: 'All service categories',
      colour: 'text-indigo-400',
    },
    {
      label: 'Regions With Gaps',
      value: String(summary.regions_with_gaps),
      sub: 'Inertia or SS deficit',
      colour: 'text-red-400',
    },
    {
      label: 'Critical Services',
      value: String(summary.critical_services_count),
      sub: 'Black start / Inertia / SRAS',
      colour: 'text-yellow-400',
    },
    {
      label: 'Projected Investment',
      value: `$${Number(summary.projected_investment_needed_m).toFixed(1)}M`,
      sub: '2025–2035 future needs',
      colour: 'text-emerald-400',
    },
  ]

  // ── Chart 1: Service costs by category (bar) ──────────────────────────────
  const costByCategoryMap: Record<string, number> = {}
  costs.forEach((c) => {
    costByCategoryMap[c.service_category] =
      (costByCategoryMap[c.service_category] ?? 0) + c.total_cost_m
  })
  const costByCategoryData = Object.entries(costByCategoryMap).map(([cat, val]) => ({
    category: cat.replace('SRAS - System Restart Ancillary Service', 'SRAS').replace('Synchronous Inertia', 'Sync Inertia'),
    cost_m: parseFloat(val.toFixed(2)),
  }))

  // ── Chart 2: Future needs gap by scenario (bar) ───────────────────────────
  const scenarioMap: Record<string, { inertia: number; ss: number }> = {}
  needs.forEach((n) => {
    if (!scenarioMap[n.scenario]) scenarioMap[n.scenario] = { inertia: 0, ss: 0 }
    scenarioMap[n.scenario].inertia += n.gap_mws
    scenarioMap[n.scenario].ss += n.gap_mva
  })
  const gapByScenarioData = Object.entries(scenarioMap).map(([sc, v]) => ({
    scenario: sc,
    inertia_gap_mws: parseFloat(v.inertia.toFixed(0)),
    ss_gap_mva: parseFloat(v.ss.toFixed(0)),
  }))

  // ── Chart 3: Cost trend by service type over 5 quarters (line) ───────────
  const quarterLabels: Record<string, string> = {}
  costs.forEach((c) => {
    const key = `Q${c.quarter} ${c.year}`
    quarterLabels[`${c.year}-${c.quarter}`] = key
  })
  const quarterKeys = Array.from(
    new Set(costs.map((c) => `${c.year}-${c.quarter}`))
  ).sort()

  const trendCategories = [
    'Synchronous Inertia',
    'System Strength',
    'Black Start',
    'Voltage Support',
  ]
  const trendData = quarterKeys.map((qk) => {
    const row: Record<string, string | number> = { quarter: quarterLabels[qk] }
    trendCategories.forEach((cat) => {
      const match = costs.find(
        (c) => `${c.year}-${c.quarter}` === qk && c.service_category === cat
      )
      row[cat.replace('Synchronous Inertia', 'Sync Inertia')] = match
        ? parseFloat(match.total_cost_m.toFixed(2))
        : 0
    })
    return row
  })

  // ── Chart 4: Tender outcomes — contracted vs required (bar) ───────────────
  const tenderChartData = tenders.map((t) => ({
    name: t.service_name.replace('SRAS Tender', 'SRAS').replace('Inertia Services', 'Inertia').replace('System Strength', 'SS').replace('Black Start', 'BS').replace('Voltage Support', 'VS').replace('Fast Frequency', 'FFR').slice(0, 22),
    required_mw: t.volume_required_mw,
    awarded_mw: t.num_awarded * (t.volume_required_mw / Math.max(t.num_bids, 1)),
    outcome: t.outcome,
  }))

  const outcomeColour: Record<string, string> = {
    Successful: '#10b981',
    'Partially Successful': '#f59e0b',
    Unsuccessful: '#ef4444',
    Cancelled: '#6b7280',
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Electricity Grid Flexibility Services Analytics
        </h1>
        <p className="mt-1 text-gray-400 text-sm">
          Non-frequency ancillary services · System services · Flexibility markets · NEM regions
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className={`text-3xl font-bold ${kpi.colour}`}>{kpi.value}</p>
            <p className="text-gray-500 text-xs mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Bar: Service costs by category */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-gray-100 mb-4">
            Service Costs by Category ($M)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={costByCategoryData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="category"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-30}
                textAnchor="end"
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="cost_m" name="Total Cost $M" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bar: Future needs gap by renewable scenario */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-gray-100 mb-4">
            Inertia & System Strength Gap by Renewable Scenario
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={gapByScenarioData} margin={{ top: 4, right: 16, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="scenario" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="inertia_gap_mws" name="Inertia Gap (MWs)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ss_gap_mva" name="SS Gap (MVA)" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Line: Cost trend by service type over 5 quarters */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-gray-100 mb-4">
            Cost Trend by Service Type ($M, 5 Quarters)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line type="monotone" dataKey="Sync Inertia" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="System Strength" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Black Start" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Voltage Support" stroke="#ec4899" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar: Tender outcomes — contracted vs required */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-gray-100 mb-4">
            Tender Outcomes — Required vs Awarded Volume (MW)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={tenderChartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="required_mw" name="Required MW" fill="#4b5563" radius={[4, 4, 0, 0]} />
              <Bar dataKey="awarded_mw" name="Awarded MW" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table 1: Service contracts overview */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-gray-100 mb-4">
          Service Contracts Overview
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 px-3">Service</th>
                <th className="text-left py-2 px-3">Category</th>
                <th className="text-left py-2 px-3">Region</th>
                <th className="text-left py-2 px-3">Mechanism</th>
                <th className="text-left py-2 px-3">Provider Type</th>
                <th className="text-right py-2 px-3">Contracted MW</th>
                <th className="text-right py-2 px-3">Annual Cost $M</th>
                <th className="text-left py-2 px-3">Review</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc, i) => (
                <tr
                  key={svc.service_id}
                  className={`border-b border-gray-700 ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'} hover:bg-gray-700 transition-colors`}
                >
                  <td className="py-2 px-3 text-gray-100 font-medium">{svc.service_name}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        svc.service_category === 'Black Start' || svc.service_category === 'SRAS - System Restart Ancillary Service'
                          ? 'bg-red-900 text-red-300'
                          : svc.service_category === 'Synchronous Inertia' || svc.service_category === 'System Strength'
                          ? 'bg-yellow-900 text-yellow-300'
                          : 'bg-indigo-900 text-indigo-300'
                      }`}
                    >
                      {svc.service_category.replace('SRAS - System Restart Ancillary Service', 'SRAS')}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-300">{svc.region}</td>
                  <td className="py-2 px-3 text-gray-300">{svc.procurement_mechanism}</td>
                  <td className="py-2 px-3 text-gray-300">{svc.provider_type}</td>
                  <td className="py-2 px-3 text-right text-emerald-400 font-mono">
                    {svc.contracted_mw.toFixed(1)}
                  </td>
                  <td className="py-2 px-3 text-right text-indigo-400 font-mono">
                    ${svc.annual_cost_m.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-gray-400 text-xs">{svc.review_frequency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: Future needs assessment */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-100 mb-4">
          Future Needs Assessment (2025–2035)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 px-3">Region</th>
                <th className="text-left py-2 px-3">Year</th>
                <th className="text-left py-2 px-3">Driver</th>
                <th className="text-left py-2 px-3">Need Type</th>
                <th className="text-right py-2 px-3">Required MW</th>
                <th className="text-right py-2 px-3">Current Gap MW</th>
                <th className="text-right py-2 px-3">Lead Time (yr)</th>
                <th className="text-left py-2 px-3">Recommended Solution</th>
                <th className="text-right py-2 px-3">Est. Cost $M</th>
                <th className="text-left py-2 px-3">Reg. Pathway</th>
              </tr>
            </thead>
            <tbody>
              {future_needs.map((fn, i) => (
                <tr
                  key={fn.future_id}
                  className={`border-b border-gray-700 ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'} hover:bg-gray-700 transition-colors`}
                >
                  <td className="py-2 px-3 text-gray-100 font-medium">{fn.region}</td>
                  <td className="py-2 px-3 text-gray-300">{fn.year}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        fn.driver === 'Coal Retirement'
                          ? 'bg-orange-900 text-orange-300'
                          : fn.driver === 'High Renewables'
                          ? 'bg-green-900 text-green-300'
                          : fn.driver === 'New Technology'
                          ? 'bg-blue-900 text-blue-300'
                          : 'bg-purple-900 text-purple-300'
                      }`}
                    >
                      {fn.driver}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-300">{fn.need_type}</td>
                  <td className="py-2 px-3 text-right text-gray-300 font-mono">
                    {fn.required_service_mw.toFixed(1)}
                  </td>
                  <td className="py-2 px-3 text-right text-red-400 font-mono">
                    {fn.current_gap_mw.toFixed(1)}
                  </td>
                  <td className="py-2 px-3 text-right text-yellow-400">
                    {fn.lead_time_years}
                  </td>
                  <td className="py-2 px-3 text-gray-300 text-xs">{fn.recommended_solution}</td>
                  <td className="py-2 px-3 text-right text-emerald-400 font-mono">
                    ${fn.estimated_cost_m.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-gray-400 text-xs">{fn.regulatory_pathway}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
