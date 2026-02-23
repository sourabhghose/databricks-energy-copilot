import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from 'recharts'
import {
  getEnergyInfrastructureCyberThreatDashboard,
  EICTDashboard,
} from '../api/client'

const CRITICALITY_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#f59e0b',
  Low:      '#22c55e',
}

const SEVERITY_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#84cc16',
  3: '#f59e0b',
  4: '#f97316',
  5: '#ef4444',
}

const RISK_RATING_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#f59e0b',
  Low:      '#22c55e',
}

const INVESTMENT_COLORS: Record<string, string> = {
  'IT Security':        '#6366f1',
  'OT Security':        '#22c55e',
  'Training':           '#f59e0b',
  'Incident Response':  '#ef4444',
  'Compliance':         '#06b6d4',
  'Threat Intel':       '#a855f7',
}

export default function EnergyInfrastructureCyberThreatAnalytics() {
  const [data, setData] = useState<EICTDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyInfrastructureCyberThreatDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading Energy Infrastructure Cyber Threat Analytics...</div>
  if (error)   return <div className="p-8 text-center text-red-400">Error: {error}</div>
  if (!data)   return null

  const { threats, assets, incidents, compliance, investments, risk_scenarios, summary } = data

  // Chart 1: Threat Frequency by Category × Criticality
  const threatCategories = Array.from(new Set(threats.map(t => t.threat_category)))
  const criticalities = ['Critical', 'High', 'Medium', 'Low']
  const threatChartData = threatCategories.map(cat => {
    const row: Record<string, string | number> = { category: cat.length > 12 ? cat.slice(0, 12) + '…' : cat }
    for (const crit of criticalities) {
      const matching = threats.filter(t => t.threat_category === cat && t.criticality === crit)
      row[crit] = matching.reduce((s, t) => s + t.frequency_ytd, 0)
    }
    return row
  })

  // Chart 2: Asset Vulnerability Profile by asset_type
  const assetTypesUniq = Array.from(new Set(assets.map(a => a.asset_type)))
  const assetChartData = assetTypesUniq.map(atype => {
    const group = assets.filter(a => a.asset_type === atype)
    return {
      asset_type: atype.length > 12 ? atype.slice(0, 12) + '…' : atype,
      'Vulnerabilities': group.reduce((s, a) => s + a.vulnerability_count, 0),
      'Critical Vulns':  group.reduce((s, a) => s + a.critical_vulnerability_count, 0),
    }
  })

  // Chart 3: Incident Timeline — count by month × severity
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const incidentTimelineData = months.map((month, idx) => {
    const row: Record<string, string | number> = { month }
    for (let sev = 1; sev <= 5; sev++) {
      const count = incidents.filter(inc => {
        const m = parseInt(inc.incident_date.split('-')[1], 10)
        return m === idx + 1 && inc.severity === sev
      }).length
      row[`Sev ${sev}`] = count
    }
    return row
  })

  // Chart 4: Compliance Score — horizontal bar, compliance_score_pct by entity × sector
  const complianceChartData = compliance.map(c => ({
    entity: c.entity.length > 14 ? c.entity.slice(0, 14) + '…' : c.entity,
    score: c.compliance_score_pct,
    sector: c.sector,
  })).sort((a, b) => b.score - a.score)

  // Chart 5: Investment Trend — stacked bar by year
  const years = Array.from(new Set(investments.map(inv => inv.year))).sort()
  const investmentChartData = years.map(yr => {
    const group = investments.filter(inv => inv.year === yr)
    const total = group.reduce((s, inv) => s + inv.cybersecurity_spend_m, 0)
    const it_s   = group.reduce((s, inv) => s + inv.cybersecurity_spend_m * inv.it_security_pct / 100, 0)
    const ot_s   = group.reduce((s, inv) => s + inv.cybersecurity_spend_m * inv.ot_security_pct / 100, 0)
    const train  = group.reduce((s, inv) => s + inv.cybersecurity_spend_m * inv.training_pct / 100, 0)
    const ir_s   = group.reduce((s, inv) => s + inv.cybersecurity_spend_m * inv.incident_response_pct / 100, 0)
    const comp_s = group.reduce((s, inv) => s + inv.cybersecurity_spend_m * inv.compliance_pct / 100, 0)
    const ti_s   = group.reduce((s, inv) => s + inv.cybersecurity_spend_m * inv.threat_intel_pct / 100, 0)
    return {
      year: yr,
      total: Math.round(total * 10) / 10,
      'IT Security':       Math.round(it_s * 10) / 10,
      'OT Security':       Math.round(ot_s * 10) / 10,
      'Training':          Math.round(train * 10) / 10,
      'Incident Response': Math.round(ir_s * 10) / 10,
      'Compliance':        Math.round(comp_s * 10) / 10,
      'Threat Intel':      Math.round(ti_s * 10) / 10,
    }
  })

  // Chart 6: Risk Scenario Matrix — scatter likelihood vs impact, size by cost, colour by rating
  const riskScatterData = risk_scenarios.map(r => ({
    x: r.likelihood_score,
    y: r.impact_score,
    z: Math.round(r.implementation_cost_m * 10),
    risk_rating: r.risk_rating,
    scenario: r.risk_scenario.length > 30 ? r.risk_scenario.slice(0, 30) + '…' : r.risk_scenario,
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="text-red-500" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Energy Infrastructure Cyber Threat Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            OT/ICS vulnerability monitoring, SOCI Act compliance, incident response and security investment tracking
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Incidents YTD</div>
          <div className="text-2xl font-bold text-red-500 mt-1">{summary.total_incidents_ytd}</div>
          <div className="text-xs text-gray-400 mt-1">Security incidents recorded</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Detection Time</div>
          <div className="text-2xl font-bold text-orange-500 mt-1">{summary.avg_detection_time_h} h</div>
          <div className="text-xs text-gray-400 mt-1">Mean time to detect threats</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Compliance Score</div>
          <div className="text-2xl font-bold text-blue-500 mt-1">{summary.avg_compliance_score_pct}%</div>
          <div className="text-xs text-gray-400 mt-1">SOCI Act compliance average</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Cyber Spend</div>
          <div className="text-2xl font-bold text-green-500 mt-1">${summary.total_cyber_spend_m}M</div>
          <div className="text-xs text-gray-400 mt-1">FY2024 cybersecurity investment</div>
        </div>
      </div>

      {/* Row 1: Threat Frequency + Asset Vulnerability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Threat Frequency by Category
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={threatChartData} margin={{ top: 4, right: 16, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {criticalities.map(crit => (
                <Bar key={crit} dataKey={crit} stackId="a" fill={CRITICALITY_COLORS[crit]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Asset Vulnerability Profile
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={assetChartData} margin={{ top: 4, right: 16, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="asset_type" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Vulnerabilities" fill="#6366f1" />
              <Bar dataKey="Critical Vulns" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Incident Timeline + Compliance Score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Incident Timeline by Severity
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={incidentTimelineData} margin={{ top: 4, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {[1, 2, 3, 4, 5].map(sev => (
                <Bar key={sev} dataKey={`Sev ${sev}`} stackId="b" fill={SEVERITY_COLORS[sev]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
            SOCI Compliance Score by Entity
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              layout="vertical"
              data={complianceChartData}
              margin={{ top: 4, right: 32, left: 80, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="entity" tick={{ fontSize: 10 }} width={80} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="score" name="Compliance Score %">
                {complianceChartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.score >= 80 ? '#22c55e' : entry.score >= 65 ? '#f59e0b' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Investment Trend + Risk Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 5 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Cybersecurity Investment Trend
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={investmentChartData} margin={{ top: 4, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="M" />
              <Tooltip formatter={(v: number) => `$${v}M`} />
              <Legend />
              {Object.entries(INVESTMENT_COLORS).map(([key, color]) => (
                <Bar key={key} dataKey={key} stackId="c" fill={color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 6 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Risk Scenario Matrix — Likelihood vs Impact
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                type="number"
                dataKey="x"
                name="Likelihood"
                domain={[0.5, 5.5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 11 }}
                label={{ value: 'Likelihood', position: 'insideBottom', offset: -8, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Impact"
                domain={[0.5, 5.5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 11 }}
                label={{ value: 'Impact', angle: -90, position: 'insideLeft', fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="z" range={[40, 400]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-gray-900 text-white p-2 rounded text-xs max-w-xs">
                      <div className="font-semibold mb-1">{d.scenario}</div>
                      <div>Likelihood: {d.x} | Impact: {d.y}</div>
                      <div>Rating: <span style={{ color: RISK_RATING_COLORS[d.risk_rating] }}>{d.risk_rating}</span></div>
                    </div>
                  )
                }}
              />
              <Scatter name="Risk Scenarios" data={riskScatterData}>
                {riskScatterData.map((entry, idx) => (
                  <Cell key={idx} fill={RISK_RATING_COLORS[entry.risk_rating]} fillOpacity={0.75} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex gap-4 justify-center mt-2 flex-wrap">
            {Object.entries(RISK_RATING_COLORS).map(([rating, color]) => (
              <div key={rating} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
                {rating}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stats row */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Threat Intelligence Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">{summary.total_incidents_ytd}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Incidents YTD</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">{summary.avg_detection_time_h}h</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Avg Detection</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">{summary.avg_compliance_score_pct}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">SOCI Compliance</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">${summary.total_cyber_spend_m}M</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cyber Spend FY24</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{summary.critical_vulnerabilities_count}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Critical Vulns</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{summary.high_risk_scenarios}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">High/Critical Risks</div>
          </div>
        </div>
      </div>
    </div>
  )
}
