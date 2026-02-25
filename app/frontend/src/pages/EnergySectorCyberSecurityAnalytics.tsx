import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getESCADashboard,
  ESCADashboard,
  ESCAIncidentRecord,
  ESCADetectionTrendRecord,
  ESCAMaturityRecord,
  ESCAVulnerabilityRecord,
  ESCAAssetRecord,
} from '../api/client'

const CATEGORY_COLORS: Record<string, string> = {
  RANSOMWARE: '#ef4444',
  PHISHING: '#f59e0b',
  OT_INTRUSION: '#8b5cf6',
  DDOS: '#3b82f6',
  INSIDER: '#ec4899',
  SUPPLY_CHAIN: '#10b981',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical_count: '#ef4444',
  high_count: '#f59e0b',
  medium_count: '#3b82f6',
  low_count: '#6b7280',
}

export default function EnergySectorCyberSecurityAnalytics() {
  const [data, setData] = useState<ESCADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getESCADashboard().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="p-6 text-red-400">Error: {error}</div>
  if (!data) return <div className="p-6 text-gray-400">Loading Energy Sector Cyber Security Analytics...</div>

  // ---- KPI Calculations ----
  const criticalIncidents = data.incidents.filter(
    (i) => i.severity === 'CRITICAL'
  ).length
  const avgDetectionTime =
    data.incidents.length > 0
      ? data.incidents.reduce((s, i) => s + i.detection_time_hrs, 0) / data.incidents.length
      : 0
  const otScadaVulns = data.vulnerabilities.find((v) => v.asset_type === 'OT')
  const otScadaVulnCount = otScadaVulns
    ? otScadaVulns.critical_count + otScadaVulns.high_count + otScadaVulns.medium_count + otScadaVulns.low_count
    : 0
  const securityMaturityScore =
    data.maturity.length > 0
      ? data.maturity.reduce((s, m) => s + m.current_score, 0) / data.maturity.length
      : 0

  // ---- BarChart: Incident count by category per quarter ----
  const quarterMap: Record<string, Record<string, number>> = {}
  data.incidents.forEach((inc) => {
    const d = new Date(inc.incident_date)
    const q = `${d.getFullYear()} Q${Math.ceil((d.getMonth() + 1) / 3)}`
    if (!quarterMap[q]) quarterMap[q] = {}
    quarterMap[q][inc.category] = (quarterMap[q][inc.category] || 0) + 1
  })
  const incidentByQuarter = Object.entries(quarterMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarter, cats]) => ({ quarter, ...cats }))

  // ---- LineChart: MTTD and MTTR trend ----
  const detectionTrend = data.detection_trends.slice().sort((a, b) => a.month.localeCompare(b.month))

  // ---- RadarChart: Security maturity ----
  const maturityRadar = data.maturity.map((m) => ({
    domain: m.domain.replace(/_/g, ' '),
    current: m.current_score,
    target: m.target_score,
  }))

  // ---- Stacked BarChart: Vulnerability severity by asset type ----
  const vulnData = data.vulnerabilities.map((v) => ({
    asset_type: v.asset_type,
    critical_count: v.critical_count,
    high_count: v.high_count,
    medium_count: v.medium_count,
    low_count: v.low_count,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Lock className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold">Energy Sector Cyber Security Analytics</h1>
          <p className="text-gray-400 text-sm">Sprint 170a &mdash; ESCA Dashboard</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Critical Incidents (12 mo)', value: criticalIncidents, color: 'text-red-400' },
          { label: 'Avg Detection Time (hrs)', value: avgDetectionTime.toFixed(1), color: 'text-yellow-400' },
          { label: 'OT/SCADA Vulnerabilities', value: otScadaVulnCount, color: 'text-purple-400' },
          { label: 'Security Maturity Score', value: securityMaturityScore.toFixed(2) + ' / 5', color: 'text-cyan-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BarChart: Incidents by category per quarter */}
        <div className="bg-gray-800 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-4">Incidents by Category per Quarter</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={incidentByQuarter}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend />
              {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                <Bar key={cat} dataKey={cat} stackId="a" fill={color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* LineChart: MTTD and MTTR */}
        <div className="bg-gray-800 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-4">Detection & Response Time Trend</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={detectionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend />
              <Line type="monotone" dataKey="mttd_hrs" stroke="#3b82f6" name="MTTD (hrs)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="mttr_hrs" stroke="#f59e0b" name="MTTR (hrs)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RadarChart: Security Maturity */}
        <div className="bg-gray-800 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-4">Security Maturity by Domain</h2>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={maturityRadar}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="domain" stroke="#9ca3af" fontSize={11} />
              <PolarRadiusAxis angle={30} domain={[0, 5]} stroke="#6b7280" fontSize={10} />
              <Radar name="Current" dataKey="current" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              <Radar name="Target" dataKey="target" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
              <Legend />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Stacked BarChart: Vulnerability severity by asset type */}
        <div className="bg-gray-800 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-4">Vulnerabilities by Asset Type & Severity</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={vulnData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="asset_type" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
              <Legend />
              <Bar dataKey="critical_count" stackId="sev" fill={SEVERITY_COLORS.critical_count} name="Critical" />
              <Bar dataKey="high_count" stackId="sev" fill={SEVERITY_COLORS.high_count} name="High" />
              <Bar dataKey="medium_count" stackId="sev" fill={SEVERITY_COLORS.medium_count} name="Medium" />
              <Bar dataKey="low_count" stackId="sev" fill={SEVERITY_COLORS.low_count} name="Low" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table: Recent Incidents */}
      <div className="bg-gray-800 rounded-2xl p-5 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">Recent Incidents</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="py-2 text-left">Date</th>
              <th className="py-2 text-left">Category</th>
              <th className="py-2 text-left">Severity</th>
              <th className="py-2 text-left">Affected System</th>
              <th className="py-2 text-right">Detection (hrs)</th>
              <th className="py-2 text-right">Resolution (hrs)</th>
              <th className="py-2 text-left">Impact</th>
            </tr>
          </thead>
          <tbody>
            {data.incidents
              .slice()
              .sort((a, b) => b.incident_date.localeCompare(a.incident_date))
              .map((inc, idx) => (
                <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2">{inc.incident_date}</td>
                  <td className="py-2">{inc.category}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        inc.severity === 'CRITICAL'
                          ? 'bg-red-900/50 text-red-300'
                          : inc.severity === 'HIGH'
                          ? 'bg-yellow-900/50 text-yellow-300'
                          : inc.severity === 'MEDIUM'
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td className="py-2">{inc.affected_system}</td>
                  <td className="py-2 text-right">{inc.detection_time_hrs.toFixed(1)}</td>
                  <td className="py-2 text-right">{inc.resolution_time_hrs.toFixed(1)}</td>
                  <td className="py-2 text-gray-300 max-w-xs truncate">{inc.impact_description}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Table: Critical Infrastructure Asset Security Posture */}
      <div className="bg-gray-800 rounded-2xl p-5 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">Critical Infrastructure Asset Security Posture</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="py-2 text-left">Asset Class</th>
              <th className="py-2 text-right">Count</th>
              <th className="py-2 text-right">Patched %</th>
              <th className="py-2 text-right">Monitored %</th>
              <th className="py-2 text-right">Avg Age (yrs)</th>
            </tr>
          </thead>
          <tbody>
            {data.assets.map((asset, idx) => (
              <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2">{asset.asset_class}</td>
                <td className="py-2 text-right">{asset.count.toLocaleString()}</td>
                <td className="py-2 text-right">{asset.patched_pct.toFixed(1)}%</td>
                <td className="py-2 text-right">{asset.monitored_pct.toFixed(1)}%</td>
                <td className="py-2 text-right">{asset.avg_age_years.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
