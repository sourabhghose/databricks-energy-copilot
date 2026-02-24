import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { Lock, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  getSmartGridCybersecurityDashboard,
  SGCRDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const ENTITY_TYPE_COLORS: Record<string, string> = {
  'TNSP': '#3b82f6',
  'DNSP': '#10b981',
  'Generator': '#f59e0b',
  'Retailer': '#8b5cf6',
  'Market Operator': '#ef4444',
  'Aggregator': '#06b6d4',
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
}

const EXPLOIT_RISK_COLORS: Record<string, string> = {
  High: '#ef4444',
  Medium: '#f97316',
  Low: '#22c55e',
}

const LINE_COLORS = ['#3b82f6', '#10b981']

// ---------------------------------------------------------------------------
// SmartGridCybersecurityAnalytics
// ---------------------------------------------------------------------------

export default function SmartGridCybersecurityAnalytics() {
  const [data, setData] = useState<SGCRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSmartGridCybersecurityDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Loading Smart Grid Cybersecurity data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400">
        <AlertTriangle className="mr-2" size={20} />
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  const { entities, incidents, controls, vulnerabilities, resilience, summary } = data

  // ------------------------------------------------------------------
  // Chart 1: Entity ICT Maturity vs Vulnerability Score
  // ------------------------------------------------------------------
  const entityChartData = entities.map((e) => ({
    name: e.entity_name.replace(/ (NSW|SA|VIC|QLD|WA|DNSP)$/, '').slice(0, 14),
    ict_maturity_score: e.ict_maturity_score,
    vulnerability_score: e.vulnerability_score,
    entity_type: e.entity_type,
  }))

  // ------------------------------------------------------------------
  // Chart 2: Incident count by incident_type × severity (2022-2024)
  // ------------------------------------------------------------------
  const incidentTypeMap: Record<string, Record<string, number>> = {}
  for (const inc of incidents) {
    if (!incidentTypeMap[inc.incident_type]) {
      incidentTypeMap[inc.incident_type] = { Critical: 0, High: 0, Medium: 0, Low: 0 }
    }
    incidentTypeMap[inc.incident_type][inc.severity] =
      (incidentTypeMap[inc.incident_type][inc.severity] ?? 0) + 1
  }
  const incidentChartData = Object.entries(incidentTypeMap).map(([type, counts]) => ({
    name: type,
    ...counts,
  }))

  // ------------------------------------------------------------------
  // Chart 3: Control adoption_pct vs effectiveness_score (grouped)
  // ------------------------------------------------------------------
  const controlChartData = controls.slice(0, 15).map((c, i) => ({
    name: `${c.control_name} ${i + 1}`,
    adoption_pct: c.adoption_pct,
    effectiveness_score: c.effectiveness_score * 10, // scale to pct for comparison
  }))

  // ------------------------------------------------------------------
  // Chart 4: Asset vulnerability_count vs critical_vulns coloured by exploit_risk
  // ------------------------------------------------------------------
  const vulnByRisk: Record<string, typeof vulnerabilities> = { High: [], Medium: [], Low: [] }
  for (const v of vulnerabilities) {
    vulnByRisk[v.exploit_risk].push(v)
  }
  const vulnChartData = vulnerabilities.map((v) => ({
    name: v.asset_type.slice(0, 12),
    vulnerability_count: v.vulnerability_count,
    critical_vulns: v.critical_vulns,
    exploit_risk: v.exploit_risk,
  }))

  // ------------------------------------------------------------------
  // Chart 5: Quarterly security_investment_m_aud trend 2022-2024
  //           for the 2 entities used in resilience
  // ------------------------------------------------------------------
  const resilienceEntityIds = Array.from(new Set(resilience.map((r) => r.entity_id)))
  const entityNameMap: Record<string, string> = {}
  for (const e of entities) entityNameMap[e.entity_id] = e.entity_name.split(' ')[0]

  const quarterKeys = ['2022-Q1','2022-Q2','2022-Q3','2022-Q4','2023-Q1','2023-Q2','2023-Q3','2023-Q4','2024-Q1','2024-Q2','2024-Q3','2024-Q4']
  const investmentTrendData = quarterKeys.map((qk) => {
    const [yr, q] = qk.split('-')
    const row: Record<string, number | string> = { quarter: qk }
    for (const eid of resilienceEntityIds) {
      const rec = resilience.find((r) => r.entity_id === eid && r.year === parseInt(yr) && r.quarter === q)
      row[entityNameMap[eid] ?? eid] = rec ? rec.security_investment_m_aud : 0
    }
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Lock className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Smart Grid Cybersecurity &amp; Resilience Analytics
          </h1>
          <p className="text-sm text-gray-400">
            AESCSF, Essential 8 &amp; ICT security posture across NEM participants — SGCR Sprint 150c
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Total Entities"
          value={String(summary.total_entities)}
          sub="NEM participants assessed"
          accent="text-blue-400"
        />
        <KpiCard
          label="Avg ICT Maturity Score"
          value={summary.avg_ict_maturity_score.toFixed(2)}
          sub="out of 10.0"
          accent="text-green-400"
        />
        <KpiCard
          label="Total Incidents 2024"
          value={String(summary.total_incidents_2024)}
          sub={`${summary.critical_incidents_2024} critical`}
          accent="text-red-400"
        />
        <KpiCard
          label="Avg Essential 8 Compliance"
          value={`${summary.avg_essentials8_compliance_pct.toFixed(1)}%`}
          sub="across all entities"
          accent="text-amber-400"
        />
      </div>

      {/* Chart 1: Entity ICT Maturity vs Vulnerability Score */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Entity ICT Maturity Score vs Vulnerability Score
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={entityChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            <Bar dataKey="ict_maturity_score" name="ICT Maturity (0-10)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="vulnerability_score" name="Vulnerability Score (0-100)" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Incident count by type and severity */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Cyber Incidents by Type and Severity (2022–2024)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={incidentChartData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            <Bar dataKey="Critical" stackId="a" fill={SEVERITY_COLORS.Critical} />
            <Bar dataKey="High" stackId="a" fill={SEVERITY_COLORS.High} />
            <Bar dataKey="Medium" stackId="a" fill={SEVERITY_COLORS.Medium} />
            <Bar dataKey="Low" stackId="a" fill={SEVERITY_COLORS.Low} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Control Framework adoption vs effectiveness */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Control Framework Adoption % vs Effectiveness Score (scaled ×10)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={controlChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            <Bar dataKey="adoption_pct" name="Adoption %" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="effectiveness_score" name="Effectiveness ×10" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Asset vulnerability_count vs critical_vulns */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Asset Vulnerability Count vs Critical Vulns (by Exploit Risk)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={vulnChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(value: number, name: string, props: any) => [
                value,
                `${name} [${props.payload.exploit_risk} risk]`,
              ]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            <Bar dataKey="vulnerability_count" name="Total Vulns" fill="#f97316" radius={[3, 3, 0, 0]} />
            <Bar dataKey="critical_vulns" name="Critical Vulns" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Quarterly security investment trend */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Quarterly Security Investment Trend 2022–2024 ($M AUD)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={investmentTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" stroke="#9ca3af" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            {resilienceEntityIds.map((eid, idx) => (
              <Line
                key={eid}
                type="monotone"
                dataKey={entityNameMap[eid] ?? eid}
                stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Footer summary */}
      <div className="bg-gray-800 rounded-lg p-4 text-xs text-gray-400 flex flex-wrap gap-4">
        <span>Entities with SOC: <span className="text-white font-medium">{summary.entities_with_soc_pct.toFixed(1)}%</span></span>
        <span>Total Security Investment: <span className="text-white font-medium">${summary.total_security_investment_m_aud.toFixed(1)}M AUD</span></span>
        <span>Critical Incidents 2024: <span className="text-red-400 font-medium">{summary.critical_incidents_2024}</span></span>
        <span className="ml-auto text-gray-600">Data: Synthetic — SGCR Sprint 150c</span>
      </div>
    </div>
  )
}
