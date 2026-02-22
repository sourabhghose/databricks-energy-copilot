import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import {
  getOTICSCyberSecurityDashboard,
  OICSDashboard,
  OICSAssetRecord,
  OICSIncidentRecord,
} from '../api/client'

const SEVERITY_COLOR: Record<string, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
  Informational: '#3b82f6',
}

const CHART_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#f97316', '#14b8a6']

function SeverityBadge({ severity }: { severity: string }) {
  const color = SEVERITY_COLOR[severity] ?? '#6b7280'
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: color + '33', color }}
    >
      {severity}
    </span>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-white text-3xl font-bold">{value}</p>
      {sub && <p className="text-gray-500 text-xs">{sub}</p>}
    </div>
  )
}

export default function OTICSCyberSecurityAnalytics() {
  const [data, setData] = useState<OICSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getOTICSCyberSecurityDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-lg animate-pulse">Loading OT/ICS Cyber Security data...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-lg">{error ?? 'No data available.'}</p>
      </div>
    )
  }

  const summary = data.summary

  // --- Chart: Incidents by type and severity (stacked) ---
  const incidentsByType: Record<string, Record<string, number>> = {}
  data.incidents.forEach(inc => {
    if (!incidentsByType[inc.incident_type]) incidentsByType[inc.incident_type] = {}
    incidentsByType[inc.incident_type][inc.severity] = (incidentsByType[inc.incident_type][inc.severity] ?? 0) + 1
  })
  const incidentChartData = Object.entries(incidentsByType).map(([type, sev]) => ({
    type: type.length > 16 ? type.slice(0, 15) + '…' : type,
    ...sev,
  }))
  const allSeverities = ['Critical', 'High', 'Medium', 'Low', 'Informational']

  // --- Chart: Compliance maturity by entity and framework ---
  const complianceChartData: Record<string, Record<string, number>> = {}
  data.compliance.forEach(c => {
    if (!complianceChartData[c.entity_name]) complianceChartData[c.entity_name] = {}
    complianceChartData[c.entity_name][c.framework] = c.maturity_level
  })
  const allFrameworks = [...new Set(data.compliance.map(c => c.framework))]
  const complianceChart = Object.entries(complianceChartData).map(([entity, frameworks]) => ({
    entity: entity.length > 14 ? entity.slice(0, 13) + '…' : entity,
    ...frameworks,
  }))

  // --- Chart: CVSS score distribution of unpatched vulnerabilities ---
  const cvssRanges: Record<string, number> = { '4.0-5.9': 0, '6.0-7.9': 0, '8.0-8.9': 0, '9.0-10.0': 0 }
  data.vulnerabilities
    .filter(v => !v.patch_available)
    .forEach(v => {
      if (v.cvss_score < 6.0) cvssRanges['4.0-5.9']++
      else if (v.cvss_score < 8.0) cvssRanges['6.0-7.9']++
      else if (v.cvss_score < 9.0) cvssRanges['8.0-8.9']++
      else cvssRanges['9.0-10.0']++
    })
  const cvssChart = Object.entries(cvssRanges).map(([range, count]) => ({ range, count }))

  // --- Chart: Security investment by type and ROI ---
  const investByType: Record<string, { spend: number; roi: number; count: number }> = {}
  data.security_investments.forEach(inv => {
    if (!investByType[inv.investment_type]) investByType[inv.investment_type] = { spend: 0, roi: 0, count: 0 }
    investByType[inv.investment_type].spend += inv.annual_spend_m
    investByType[inv.investment_type].roi += inv.roi_pct
    investByType[inv.investment_type].count++
  })
  const investChart = Object.entries(investByType).map(([type, d]) => ({
    type: type.length > 14 ? type.slice(0, 13) + '…' : type,
    spend: Math.round(d.spend * 100) / 100,
    avg_roi: Math.round(d.roi / d.count),
  }))

  // --- Table: Critical assets ---
  const criticalAssets: OICSAssetRecord[] = data.assets
    .filter(a => a.criticality === 'Critical' || a.criticality === 'High')
    .sort((a, b) => b.vulnerability_count - a.vulnerability_count)
    .slice(0, 12)

  // --- Table: Recent incidents ---
  const recentIncidents: OICSIncidentRecord[] = [...data.incidents]
    .sort((a, b) => b.incident_date.localeCompare(a.incident_date))
    .slice(0, 10)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-red-600 p-2 rounded-lg">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">OT/ICS Energy Cyber Security Analytics</h1>
          <p className="text-gray-400 text-sm">Operational Technology Security for Energy Infrastructure</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Critical Assets"
          value={summary.total_critical_assets as number}
          sub="Assets rated Critical"
        />
        <KpiCard
          label="Incidents YTD"
          value={summary.incidents_ytd as number}
          sub="Confirmed 2024 incidents"
        />
        <KpiCard
          label="Avg Compliance Score"
          value={`${summary.avg_compliance_score_pct}%`}
          sub="Across all frameworks"
        />
        <KpiCard
          label="Unpatched Critical Vulns"
          value={summary.critical_vulnerabilities_unpatched as number}
          sub="CVSS ≥ 9.0, no patch applied"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incidents by Type & Severity */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Incidents by Type & Severity</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={incidentChartData} margin={{ left: 0, right: 10, top: 5, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {allSeverities.map(sev => (
                <Bar key={sev} dataKey={sev} stackId="a" fill={SEVERITY_COLOR[sev]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Compliance Maturity by Entity & Framework */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Compliance Maturity by Entity & Framework</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={complianceChart} margin={{ left: 0, right: 10, top: 5, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="entity" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 5]} allowDecimals={false} label={{ value: 'Maturity', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {allFrameworks.map((fw, idx) => (
                <Bar key={fw} dataKey={fw} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CVSS Score Distribution - Unpatched */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Unpatched Vulnerability CVSS Distribution</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cvssChart} margin={{ left: 0, right: 10, top: 5, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="range" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
              {cvssChart.map((entry, idx) => null)}
              <Bar dataKey="count" name="Unpatched Vulns" radius={[4, 4, 0, 0]}>
                {cvssChart.map((entry, idx) => (
                  <Cell key={idx} fill={['#22c55e', '#eab308', '#f97316', '#ef4444'][idx]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Security Investment by Type & ROI */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Security Investment by Type & Avg ROI</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={investChart} margin={{ left: 0, right: 10, top: 5, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '$M', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'ROI %', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="spend" name="Annual Spend ($M)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="avg_roi" name="Avg ROI (%)" fill="#22d3ee" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table: Critical Asset Inventory */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Critical Asset Inventory</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Asset ID</th>
                <th className="text-left py-2 pr-4">Name</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">Criticality</th>
                <th className="text-left py-2 pr-4">Sector</th>
                <th className="text-left py-2 pr-4">Security Zone</th>
                <th className="text-left py-2 pr-4">State</th>
                <th className="text-left py-2 pr-4">Internet Exposed</th>
                <th className="text-left py-2 pr-4">Legacy</th>
                <th className="text-left py-2">Vulns</th>
              </tr>
            </thead>
            <tbody>
              {criticalAssets.map(asset => (
                <tr key={asset.asset_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-mono text-xs text-indigo-400">{asset.asset_id}</td>
                  <td className="py-2 pr-4 text-gray-200">{asset.asset_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{asset.asset_type}</td>
                  <td className="py-2 pr-4"><SeverityBadge severity={asset.criticality} /></td>
                  <td className="py-2 pr-4 text-gray-300">{asset.sector}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      asset.security_zone === 'OT' ? 'bg-orange-900/40 text-orange-400' :
                      asset.security_zone === 'IT' ? 'bg-blue-900/40 text-blue-400' :
                      asset.security_zone === 'DMZ' ? 'bg-purple-900/40 text-purple-400' :
                      'bg-gray-700 text-gray-300'
                    }`}>{asset.security_zone}</span>
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{asset.state}</td>
                  <td className="py-2 pr-4 text-center">
                    {asset.internet_exposed
                      ? <span className="text-red-400 font-semibold">Yes</span>
                      : <span className="text-green-500">No</span>}
                  </td>
                  <td className="py-2 pr-4 text-center">
                    {asset.legacy_system
                      ? <span className="text-yellow-400">Yes</span>
                      : <span className="text-gray-500">No</span>}
                  </td>
                  <td className="py-2">
                    <span className={`font-semibold ${asset.vulnerability_count > 10 ? 'text-red-400' : asset.vulnerability_count > 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {asset.vulnerability_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table: Recent Incidents */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Recent Incidents</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Incident ID</th>
                <th className="text-left py-2 pr-4">Date</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">Severity</th>
                <th className="text-left py-2 pr-4">Affected Asset</th>
                <th className="text-left py-2 pr-4">Sector</th>
                <th className="text-left py-2 pr-4">Operational Impact</th>
                <th className="text-left py-2 pr-4">Detect (hrs)</th>
                <th className="text-left py-2 pr-4">Recover (hrs)</th>
                <th className="text-left py-2">Financial Impact ($M)</th>
              </tr>
            </thead>
            <tbody>
              {recentIncidents.map(inc => (
                <tr key={inc.incident_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-mono text-xs text-indigo-400">{inc.incident_id}</td>
                  <td className="py-2 pr-4 text-gray-300">{inc.incident_date}</td>
                  <td className="py-2 pr-4 text-gray-200">{inc.incident_type}</td>
                  <td className="py-2 pr-4"><SeverityBadge severity={inc.severity} /></td>
                  <td className="py-2 pr-4 text-gray-300">{inc.affected_asset_type}</td>
                  <td className="py-2 pr-4 text-gray-300">{inc.sector}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      inc.operational_impact === 'Severe' ? 'bg-red-900/40 text-red-400' :
                      inc.operational_impact === 'Significant' ? 'bg-orange-900/40 text-orange-400' :
                      inc.operational_impact === 'Moderate' ? 'bg-yellow-900/40 text-yellow-400' :
                      inc.operational_impact === 'Minor' ? 'bg-blue-900/40 text-blue-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>{inc.operational_impact}</span>
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{inc.time_to_detect_hours}</td>
                  <td className="py-2 pr-4 text-gray-300">{inc.time_to_recover_hours}</td>
                  <td className="py-2 text-red-300 font-medium">{inc.financial_impact_m.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
