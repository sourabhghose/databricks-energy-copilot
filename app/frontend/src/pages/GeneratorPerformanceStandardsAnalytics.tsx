import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { CheckCircle } from 'lucide-react'
import {
  GPSCDashboard,
  getGeneratorPerformanceStandardsDashboard,
} from '../api/client'

export default function GeneratorPerformanceStandardsAnalytics() {
  const [data, setData] = useState<GPSCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGeneratorPerformanceStandardsDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-400">
        <p>Loading Generator Performance Standards data...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400">
        <p>Error loading data: {error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const { summary, generators, performance_standards, incidents, test_results, compliance_trends } = data

  // --- KPI values ---
  const totalRegistered = Number(summary.total_registered_generators ?? 0)
  const overallCompliancePct = Number(summary.overall_compliance_pct ?? 0)
  const activeNonCompliant = Number(summary.active_non_compliant ?? 0)
  const totalPenalties = Number(summary.total_penalties_m ?? 0)

  // --- BarChart: Compliance by standard category ---
  const categoryPassMap: Record<string, { pass: number; total: number }> = {}
  for (const ps of performance_standards) {
    if (!categoryPassMap[ps.standard_category]) {
      categoryPassMap[ps.standard_category] = { pass: 0, total: 0 }
    }
    categoryPassMap[ps.standard_category].total += 1
    if (ps.compliance) categoryPassMap[ps.standard_category].pass += 1
  }
  const categoryComplianceData = Object.entries(categoryPassMap).map(([cat, v]) => ({
    category: cat.replace(' ', '\n'),
    passRate: v.total > 0 ? Math.round((v.pass / v.total) * 100) : 0,
  }))

  // --- Stacked BarChart: Incidents by severity and type ---
  const incidentSeverityTypeMap: Record<string, Record<string, number>> = {}
  const incidentTypes = ['GPS Breach', 'Near Miss', 'Exceedance', 'Test Failure', 'Monitoring Gap']
  for (const inc of incidents) {
    if (!incidentSeverityTypeMap[inc.severity]) {
      incidentSeverityTypeMap[inc.severity] = {}
      for (const t of incidentTypes) incidentSeverityTypeMap[inc.severity][t] = 0
    }
    incidentSeverityTypeMap[inc.severity][inc.incident_type] =
      (incidentSeverityTypeMap[inc.severity][inc.incident_type] ?? 0) + 1
  }
  const incidentChartData = Object.entries(incidentSeverityTypeMap).map(([sev, types]) => ({
    severity: sev,
    ...types,
  }))

  // --- LineChart: Compliance trend by region over quarters ---
  const regionQuarterMap: Record<string, Record<string, number>> = {}
  for (const t of compliance_trends) {
    const key = `Q${t.quarter}`
    if (!regionQuarterMap[key]) regionQuarterMap[key] = {}
    regionQuarterMap[key][t.region] = t.compliant_pct
  }
  const trendChartData = ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({
    quarter: q,
    ...(regionQuarterMap[q] ?? {}),
  }))

  // --- BarChart: Test results pass/fail by test type ---
  const testTypeMap: Record<string, { Pass: number; 'Conditional Pass': number; Fail: number }> = {}
  for (const tr of test_results) {
    if (!testTypeMap[tr.test_type]) testTypeMap[tr.test_type] = { Pass: 0, 'Conditional Pass': 0, Fail: 0 }
    testTypeMap[tr.test_type][tr.pass_fail as 'Pass' | 'Conditional Pass' | 'Fail'] =
      (testTypeMap[tr.test_type][tr.pass_fail as 'Pass' | 'Conditional Pass' | 'Fail'] ?? 0) + 1
  }
  const testResultChartData = Object.entries(testTypeMap).map(([tt, counts]) => ({
    testType: tt,
    ...counts,
  }))

  // --- Compliance status badge colour ---
  const statusColor = (status: string) => {
    switch (status) {
      case 'Compliant': return 'bg-green-700 text-green-100'
      case 'Non-Compliant': return 'bg-red-700 text-red-100'
      case 'Under Review': return 'bg-yellow-700 text-yellow-100'
      case 'Exempt': return 'bg-blue-700 text-blue-100'
      default: return 'bg-gray-700 text-gray-100'
    }
  }

  // --- Severity badge colour ---
  const severityColor = (sev: string) => {
    switch (sev) {
      case 'Critical': return 'bg-red-800 text-red-100'
      case 'Major': return 'bg-orange-700 text-orange-100'
      case 'Moderate': return 'bg-yellow-700 text-yellow-100'
      case 'Minor': return 'bg-green-800 text-green-100'
      default: return 'bg-gray-700 text-gray-100'
    }
  }

  const regionColors: Record<string, string> = {
    NSW: '#60a5fa',
    VIC: '#34d399',
    QLD: '#fbbf24',
    SA: '#f87171',
    TAS: '#a78bfa',
  }

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <CheckCircle className="text-green-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Generator Performance Standards Compliance Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            AEMO GPS compliance monitoring — reactive power, voltage control, fault ride-through &amp; more
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Registered Generators</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{totalRegistered}</p>
          <p className="text-xs text-gray-500 mt-1">AEMO registered</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Overall Compliance</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{overallCompliancePct.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">Avg compliance score</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Active Non-Compliant</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{activeNonCompliant}</p>
          <p className="text-xs text-gray-500 mt-1">Require remediation</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Penalties</p>
          <p className="text-3xl font-bold text-yellow-400 mt-1">${totalPenalties.toFixed(2)}M</p>
          <p className="text-xs text-gray-500 mt-1">Cumulative AUD</p>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Compliance by standard category */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Compliance Pass Rate by Standard Category (%)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categoryComplianceData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="category" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Bar dataKey="passRate" name="Pass Rate %" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Incidents by severity and type (stacked) */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Incidents by Severity and Type
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={incidentChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="severity" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
              <Bar dataKey="GPS Breach" stackId="a" fill="#f87171" />
              <Bar dataKey="Near Miss" stackId="a" fill="#fbbf24" />
              <Bar dataKey="Exceedance" stackId="a" fill="#60a5fa" />
              <Bar dataKey="Test Failure" stackId="a" fill="#a78bfa" />
              <Bar dataKey="Monitoring Gap" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Compliance trend by region */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Compliance Trend by Region — 2024 Quarters (%)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[60, 100]} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
              {['NSW', 'VIC', 'QLD', 'SA', 'TAS'].map((region) => (
                <Line
                  key={region}
                  type="monotone"
                  dataKey={region}
                  stroke={regionColors[region]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Test results pass/fail by test type */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Test Results by Test Type
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={testResultChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="testType" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
              <Bar dataKey="Pass" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Conditional Pass" fill="#fbbf24" />
              <Bar dataKey="Fail" fill="#f87171" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Generator Compliance Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 mb-6">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200">Generator Compliance Overview</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="bg-gray-700 text-gray-400 uppercase tracking-wide text-xs">
                <th className="px-3 py-2 text-left">Generator</th>
                <th className="px-3 py-2 text-left">Technology</th>
                <th className="px-3 py-2 text-left">Region</th>
                <th className="px-3 py-2 text-left">Classification</th>
                <th className="px-3 py-2 text-right">Capacity (MW)</th>
                <th className="px-3 py-2 text-right">Score (%)</th>
                <th className="px-3 py-2 text-left">GPS Version</th>
                <th className="px-3 py-2 text-left">Last Audit</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {generators.map((g, i) => (
                <tr key={g.gen_id} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}>
                  <td className="px-3 py-2 font-medium text-white">{g.generator_name}</td>
                  <td className="px-3 py-2">{g.technology}</td>
                  <td className="px-3 py-2">{g.region}</td>
                  <td className="px-3 py-2">{g.gps_classification}</td>
                  <td className="px-3 py-2 text-right">{g.capacity_mw.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right">{g.overall_compliance_score_pct.toFixed(1)}</td>
                  <td className="px-3 py-2">{g.performance_standard_version}</td>
                  <td className="px-3 py-2">{g.last_audit_date}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(g.compliance_status)}`}>
                      {g.compliance_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Incidents Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200">Recent Incidents</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="bg-gray-700 text-gray-400 uppercase tracking-wide text-xs">
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Generator</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Severity</th>
                <th className="px-3 py-2 text-right">Impact (MW)</th>
                <th className="px-3 py-2 text-right">Penalty (AUD)</th>
                <th className="px-3 py-2 text-left">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc, i) => (
                <tr key={inc.incident_id} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}>
                  <td className="px-3 py-2 font-mono text-gray-400">{inc.incident_id}</td>
                  <td className="px-3 py-2 font-medium text-white">{inc.generator_name}</td>
                  <td className="px-3 py-2">{inc.incident_date}</td>
                  <td className="px-3 py-2">{inc.incident_type}</td>
                  <td className="px-3 py-2">{inc.standard_category}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColor(inc.severity)}`}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{inc.operational_impact_mw.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">
                    {inc.penalty_aud > 0 ? `$${inc.penalty_aud.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3 py-2">
                    {inc.resolved ? (
                      <span className="text-green-400 font-medium">Yes</span>
                    ) : (
                      <span className="text-red-400 font-medium">Open</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
