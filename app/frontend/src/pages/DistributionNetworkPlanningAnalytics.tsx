import { useEffect, useState } from 'react'
import { Network } from 'lucide-react'
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
  getDistributionNetworkPlanningDashboard,
  DNPADashboard,
  DNPAFeederRecord,
  DNPAConstraintRecord,
  DNPADERIntegrationRecord,
  DNPALoadForecastRecord,
  DNPAUpgradeRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kpiCard(title: string, value: string | number, sub: string) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1 shadow">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{title}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-gray-500">{sub}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DistributionNetworkPlanningAnalytics() {
  const [data, setData] = useState<DNPADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFeeder, setSelectedFeeder] = useState<string>('FDR-001')

  useEffect(() => {
    getDistributionNetworkPlanningDashboard()
      .then((d) => {
        setData(d)
        if (d.feeders.length > 0) setSelectedFeeder(d.feeders[0].feeder_id)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-400">
        <span className="text-sm animate-pulse">Loading distribution network data...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400">
        <span className="text-sm">Error: {error ?? 'No data available'}</span>
      </div>
    )
  }

  const { feeders, hosting_capacity, upgrades, load_forecasts, constraints, der_integrations, summary } = data

  // -------------------------------------------------------------------------
  // KPI values
  // -------------------------------------------------------------------------
  const totalFeeders = Number(summary['total_feeders'] ?? feeders.length)
  const avgHCUsed = Number(summary['avg_hosting_capacity_used_pct'] ?? 0).toFixed(1)
  const totalUpgradeInv = Number(summary['total_upgrade_investment_m'] ?? 0).toFixed(1)
  const totalDERConnected = Number(summary['total_der_connected_mw'] ?? 0).toFixed(1)

  // -------------------------------------------------------------------------
  // Chart 1: Feeder utilisation & DER penetration by DNSP (grouped bar)
  // -------------------------------------------------------------------------
  const dnspMap: Record<string, { dnsp: string; avgUtil: number; count: number; avgDer: number }> = {}
  feeders.forEach((f: DNPAFeederRecord) => {
    if (!dnspMap[f.dnsp]) dnspMap[f.dnsp] = { dnsp: f.dnsp, avgUtil: 0, count: 0, avgDer: 0 }
    dnspMap[f.dnsp].avgUtil += f.utilisation_pct
    dnspMap[f.dnsp].avgDer += f.der_connected_mw
    dnspMap[f.dnsp].count++
  })
  const dnspChartData = Object.values(dnspMap).map((d) => ({
    dnsp: d.dnsp.split(' ')[0],
    avgUtilisation: +(d.avgUtil / d.count).toFixed(1),
    avgDERMW: +(d.avgDer / d.count).toFixed(2),
  }))

  // -------------------------------------------------------------------------
  // Chart 2: Hosting capacity by constraint type (bar)
  // -------------------------------------------------------------------------
  const hcConstraintMap: Record<string, number> = {}
  hosting_capacity.forEach((hc) => {
    hcConstraintMap[hc.hc_constraint] = (hcConstraintMap[hc.hc_constraint] ?? 0) + hc.static_hc_kw
  })
  const hcConstraintData = Object.entries(hcConstraintMap).map(([type, total]) => ({
    constraint: type,
    totalStaticHC_kW: +total.toFixed(0),
  }))

  // -------------------------------------------------------------------------
  // Chart 3: Load forecast line chart (net load trend for selected feeder)
  // -------------------------------------------------------------------------
  const scenarios = ['Base', 'High EV', 'High Solar', 'High DER']
  const forecastFiltered = load_forecasts.filter((f: DNPALoadForecastRecord) => f.feeder_id === selectedFeeder)
  const yearSet = Array.from(new Set(forecastFiltered.map((f) => f.year))).sort()
  const forecastChartData = yearSet.map((yr) => {
    const row: Record<string, number | string> = { year: yr }
    scenarios.forEach((sc) => {
      const match = forecastFiltered.find((f) => f.year === yr && f.scenario === sc)
      if (match) row[sc] = +match.net_load_mw.toFixed(2)
    })
    return row
  })
  const scenarioColors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171']

  // -------------------------------------------------------------------------
  // Chart 4: Upgrade investment by type with BCR overlay
  // -------------------------------------------------------------------------
  const upgradeTypeMap: Record<string, { capex: number; bcr: number; count: number }> = {}
  upgrades.forEach((u: DNPAUpgradeRecord) => {
    const key = u.upgrade_type.split(' ').slice(0, 2).join(' ')
    if (!upgradeTypeMap[key]) upgradeTypeMap[key] = { capex: 0, bcr: 0, count: 0 }
    upgradeTypeMap[key].capex += u.capex_m
    upgradeTypeMap[key].bcr += u.benefit_cost_ratio
    upgradeTypeMap[key].count++
  })
  const upgradeChartData = Object.entries(upgradeTypeMap).map(([type, d]) => ({
    type,
    totalCapexM: +d.capex.toFixed(2),
    avgBCR: +(d.bcr / d.count).toFixed(2),
  }))

  // -------------------------------------------------------------------------
  // Table 1: Constrained feeders requiring upgrade
  // -------------------------------------------------------------------------
  const constrainedFeeders = feeders.filter((f: DNPAFeederRecord) => f.upgrade_required)
  const constraintSeverityFor = (feederId: string) => {
    const related = constraints.filter((c: DNPAConstraintRecord) => c.feeder_id === feederId)
    if (related.length === 0) return 'Unknown'
    const order = { Critical: 4, High: 3, Medium: 2, Low: 1 }
    return related.sort((a, b) => (order[b.severity as keyof typeof order] ?? 0) - (order[a.severity as keyof typeof order] ?? 0))[0].severity
  }
  const severityColor: Record<string, string> = {
    Critical: 'text-red-400',
    High: 'text-orange-400',
    Medium: 'text-yellow-400',
    Low: 'text-green-400',
    Unknown: 'text-gray-400',
  }

  // -------------------------------------------------------------------------
  // Table 2: DER integration approvals
  // -------------------------------------------------------------------------
  const recentDER = [...der_integrations]
    .sort((a: DNPADERIntegrationRecord, b: DNPADERIntegrationRecord) => b.connection_year - a.connection_year)
    .slice(0, 15)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Network className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Distribution Network Planning Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Hosting capacity, DER integration and feeder planning across Australian DNSPs</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCard('Total Feeders', totalFeeders, 'Analysed across all DNSPs')}
        {kpiCard('Avg HC Used', `${avgHCUsed}%`, 'Hosting capacity utilisation')}
        {kpiCard('Total Upgrade Investment', `$${totalUpgradeInv}M`, 'Planned network capex')}
        {kpiCard('Total DER Connected', `${totalDERConnected} MW`, 'Across all feeders')}
      </div>

      {/* Row 1: DNSP Chart + HC Constraint Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feeder utilisation & DER penetration by DNSP */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Feeder Utilisation & DER Penetration by DNSP</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dnspChartData} margin={{ top: 4, right: 16, left: 0, bottom: 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="dnsp" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="avgUtilisation" name="Avg Utilisation %" fill="#60a5fa" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="right" dataKey="avgDERMW" name="Avg DER (MW)" fill="#34d399" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hosting capacity by constraint type */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Hosting Capacity by Constraint Type (kW)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hcConstraintData} margin={{ top: 4, right: 16, left: 0, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="constraint" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" kW" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} />
              <Bar dataKey="totalStaticHC_kW" name="Static HC (kW)" fill="#a78bfa" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Load Forecast + Upgrade Investment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Load forecast line chart */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Net Load Forecast by Scenario</h2>
            <select
              className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
              value={selectedFeeder}
              onChange={(e) => setSelectedFeeder(e.target.value)}
            >
              {feeders.map((f: DNPAFeederRecord) => (
                <option key={f.feeder_id} value={f.feeder_id}>{f.feeder_name}</option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={forecastChartData} margin={{ top: 4, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {scenarios.map((sc, idx) => (
                <Line key={sc} type="monotone" dataKey={sc} stroke={scenarioColors[idx]} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Upgrade investment by type */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Upgrade Investment by Type with BCR</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={upgradeChartData} margin={{ top: 4, right: 16, left: 0, bottom: 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 5]} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="totalCapexM" name="Total Capex ($M)" fill="#fbbf24" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="right" dataKey="avgBCR" name="Avg BCR" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table 1: Constrained feeders */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Constrained Feeders Requiring Upgrade</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="pb-2 pr-4">Feeder</th>
                <th className="pb-2 pr-4">DNSP</th>
                <th className="pb-2 pr-4">State</th>
                <th className="pb-2 pr-4">Voltage (kV)</th>
                <th className="pb-2 pr-4">Utilisation %</th>
                <th className="pb-2 pr-4">HC Used %</th>
                <th className="pb-2 pr-4">Severity</th>
                <th className="pb-2 pr-4">Upgrade Year</th>
                <th className="pb-2">Customers</th>
              </tr>
            </thead>
            <tbody>
              {constrainedFeeders.map((f: DNPAFeederRecord) => {
                const sev = constraintSeverityFor(f.feeder_id)
                return (
                  <tr key={f.feeder_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="py-2 pr-4 font-medium text-white">{f.feeder_name}</td>
                    <td className="py-2 pr-4">{f.dnsp}</td>
                    <td className="py-2 pr-4">{f.state}</td>
                    <td className="py-2 pr-4">{f.voltage_kv}</td>
                    <td className="py-2 pr-4">{f.utilisation_pct}%</td>
                    <td className="py-2 pr-4">{f.hosting_capacity_used_pct}%</td>
                    <td className={`py-2 pr-4 font-semibold ${severityColor[sev]}`}>{sev}</td>
                    <td className="py-2 pr-4">{f.upgrade_year ?? '—'}</td>
                    <td className="py-2">{f.customers_connected.toLocaleString()}</td>
                  </tr>
                )
              })}
              {constrainedFeeders.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-gray-500">No constrained feeders found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: DER integration approvals */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">DER Integration Approvals & Connection Timeline</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="pb-2 pr-4">DER ID</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">Feeder</th>
                <th className="pb-2 pr-4">Capacity (kW)</th>
                <th className="pb-2 pr-4">Year</th>
                <th className="pb-2 pr-4">Smart Inv.</th>
                <th className="pb-2 pr-4">Dyn Export</th>
                <th className="pb-2 pr-4">Export Limit (kW)</th>
                <th className="pb-2 pr-4">Approval (wks)</th>
                <th className="pb-2">Connection Cost</th>
              </tr>
            </thead>
            <tbody>
              {recentDER.map((d: DNPADERIntegrationRecord) => (
                <tr key={d.der_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 font-mono text-blue-300">{d.der_id}</td>
                  <td className="py-2 pr-4">{d.der_category}</td>
                  <td className="py-2 pr-4">{d.feeder_id}</td>
                  <td className="py-2 pr-4">{d.capacity_kw.toFixed(0)}</td>
                  <td className="py-2 pr-4">{d.connection_year}</td>
                  <td className="py-2 pr-4">
                    <span className={d.smart_inverter ? 'text-green-400' : 'text-gray-500'}>
                      {d.smart_inverter ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={d.dynamic_export_enabled ? 'text-green-400' : 'text-gray-500'}>
                      {d.dynamic_export_enabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{d.export_limited ? d.export_limit_kw.toFixed(0) : '—'}</td>
                  <td className="py-2 pr-4">{d.approval_time_weeks}</td>
                  <td className="py-2">${d.connection_cost_aud.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
