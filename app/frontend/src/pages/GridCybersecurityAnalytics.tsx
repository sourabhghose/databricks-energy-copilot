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
} from 'recharts'
import { Lock, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  getGridCybersecurityDashboard,
  EGCDashboard,
  EGCThreatRecord,
  EGCIncidentRecord,
  EGCComplianceRecord,
  EGCResilienceRecord,
  EGCInvestmentRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-700 text-white',
  HIGH:     'bg-orange-600 text-white',
  MEDIUM:   'bg-amber-600 text-white',
  LOW:      'bg-green-700 text-white',
}

const ACTOR_BADGE: Record<string, string> = {
  NATION_STATE: 'bg-red-800 text-white',
  CRIMINAL:     'bg-orange-700 text-white',
  HACKTIVIST:   'bg-yellow-700 text-white',
  INSIDER:      'bg-purple-700 text-white',
  UNKNOWN:      'bg-gray-600 text-white',
}

const IMPACT_BADGE: Record<string, string> = {
  OPERATIONAL:         'bg-red-700 text-white',
  FINANCIAL:           'bg-orange-600 text-white',
  DATA_BREACH:         'bg-amber-600 text-white',
  SERVICE_DISRUPTION:  'bg-yellow-600 text-white',
  NO_IMPACT:           'bg-green-700 text-white',
}

const CERT_BADGE: Record<string, string> = {
  CERTIFIED:     'bg-green-700 text-white',
  PENDING:       'bg-amber-600 text-white',
  NOT_CERTIFIED: 'bg-red-700 text-white',
  EXEMPT:        'bg-gray-600 text-white',
}

const DETECTED_BADGE: Record<string, string> = {
  INTERNAL:   'bg-blue-600 text-white',
  AEMO_ALERT: 'bg-purple-600 text-white',
  GOVT_INTEL: 'bg-red-700 text-white',
  VENDOR:     'bg-orange-600 text-white',
  CUSTOMER:   'bg-teal-600 text-white',
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

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
// Resilience score colour helpers (heatmap-style)
// ---------------------------------------------------------------------------

function resilienceCell(score: number) {
  if (score >= 75) return 'bg-green-700 text-white'
  if (score >= 65) return 'bg-amber-600 text-white'
  if (score >= 55) return 'bg-orange-600 text-white'
  return 'bg-red-700 text-white'
}

// ---------------------------------------------------------------------------
// Investment chart data helper
// ---------------------------------------------------------------------------

function buildInvestmentChartData(investment: EGCInvestmentRecord[]) {
  const years = [2020, 2021, 2022, 2023, 2024]
  return years.map(year => {
    const row: Record<string, number | string> = { year: String(year) }
    investment
      .filter(r => r.year === year)
      .forEach(r => {
        row[r.sector] = r.total_cyber_investment_m
      })
    return row
  })
}

const SECTOR_COLORS: Record<string, string> = {
  GENERATION:          '#60a5fa',
  TRANSMISSION:        '#34d399',
  DISTRIBUTION:        '#f59e0b',
  MARKET_OPERATIONS:   '#f87171',
}

// ---------------------------------------------------------------------------
// Threat incident trend helper
// ---------------------------------------------------------------------------

function buildThreatTrendData(threats: EGCThreatRecord[]) {
  return threats.map(t => ({
    category: t.category.replace(/_/g, ' '),
    '2022': t.incidents_2022,
    '2023': t.incidents_2023,
    '2024': t.incidents_2024,
  }))
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GridCybersecurityAnalytics() {
  const [dash, setDash] = useState<EGCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getGridCybersecurityDashboard()
      .then(d => { setDash(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} /> Loading...
      </div>
    )

  if (error || !dash)
    return (
      <div className="flex items-center justify-center h-64 text-red-400 gap-2">
        <AlertTriangle size={20} />
        <span>{error ?? 'No data returned'}</span>
        <button
          onClick={load}
          className="ml-4 px-3 py-1 bg-gray-700 rounded text-sm text-gray-200 hover:bg-gray-600"
        >
          Retry
        </button>
      </div>
    )

  const s = dash.summary as Record<string, number>

  // Unique sectors in investment data
  const investmentSectors = [...new Set(dash.investment.map(r => r.sector))]

  // Unique regions for resilience heatmap
  const regions = [...new Set(dash.resilience.map(r => r.region))]
  const assetClasses = [...new Set(dash.resilience.map(r => r.asset_class))]

  // Build resilience lookup
  const resMap = new Map<string, EGCResilienceRecord>()
  dash.resilience.forEach(r => resMap.set(`${r.region}|${r.asset_class}`, r))

  return (
    <div className="p-6 space-y-8 text-gray-100 bg-gray-900 min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lock className="text-cyan-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-white">
              Electricity Grid Cybersecurity &amp; Resilience Analytics
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              NEM cyber threat landscape · critical infrastructure protection · incident reporting · resilience frameworks
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 rounded text-sm text-gray-200 hover:bg-gray-600"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <KpiCard
          label="2024 Incidents"
          value={String(s.total_incidents_2024)}
          sub="reported NEM incidents"
          accent="text-red-400"
        />
        <KpiCard
          label="Critical Threats"
          value={String(s.critical_threats)}
          sub="active critical threat categories"
          accent="text-red-400"
        />
        <KpiCard
          label="Avg Resilience Score"
          value={`${s.avg_resilience_score}`}
          sub="out of 100 (all regions)"
          accent="text-amber-400"
        />
        <KpiCard
          label="Certified Orgs"
          value={`${s.compliance_certified_pct}%`}
          sub="compliance certified"
          accent="text-green-400"
        />
        <KpiCard
          label="Cyber Investment 2024"
          value={`$${s.total_cyber_investment_2024_m}M`}
          sub="across all sectors"
          accent="text-cyan-400"
        />
        <KpiCard
          label="Avg Response Time"
          value={`${s.avg_response_time_hrs}h`}
          sub="incident response time"
          accent="text-amber-400"
        />
        <KpiCard
          label="Patch Currency"
          value={`${s.patch_currency_avg_pct}%`}
          sub="systems current on patches"
          accent="text-green-400"
        />
      </div>

      {/* Threat Landscape */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-cyan-300 border-b border-gray-700 pb-1">
          Threat Landscape
        </h2>
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Actor Type</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Targeted Systems</th>
                <th className="px-3 py-2 text-center">2022</th>
                <th className="px-3 py-2 text-center">2023</th>
                <th className="px-3 py-2 text-center">2024</th>
                <th className="px-3 py-2 text-right">Dwell (days)</th>
                <th className="px-3 py-2 text-right">Recovery (days)</th>
                <th className="px-3 py-2 text-right">Fin. Impact ($M)</th>
              </tr>
            </thead>
            <tbody>
              {dash.threats.map((t: EGCThreatRecord, idx: number) => (
                <tr
                  key={t.threat_id}
                  className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800/60'}
                >
                  <td className="px-3 py-2 font-mono text-gray-400 text-xs">{t.threat_id}</td>
                  <td className="px-3 py-2 font-medium">{t.category.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2">
                    <Badge
                      label={t.actor_type}
                      colorClass={ACTOR_BADGE[t.actor_type] ?? 'bg-gray-600 text-white'}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      label={t.severity}
                      colorClass={SEVERITY_BADGE[t.severity] ?? 'bg-gray-600 text-white'}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-300">
                    {t.targeted_systems.join(', ')}
                  </td>
                  <td className="px-3 py-2 text-center">{t.incidents_2022}</td>
                  <td className="px-3 py-2 text-center">{t.incidents_2023}</td>
                  <td className="px-3 py-2 text-center font-semibold text-white">{t.incidents_2024}</td>
                  <td className="px-3 py-2 text-right">{t.avg_dwell_time_days}</td>
                  <td className="px-3 py-2 text-right">{t.avg_recovery_time_days}</td>
                  <td className="px-3 py-2 text-right text-amber-400">${t.financial_impact_m.toFixed(1)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Incident Trend Bar Chart */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Incident Trends by Threat Category (2022–2024)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={buildThreatTrendData(dash.threats)} margin={{ top: 4, right: 16, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="category"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="2022" fill="#60a5fa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="2023" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="2024" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Incident Registry */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-cyan-300 border-b border-gray-700 pb-1">
          Incident Registry (2022–2024)
        </h2>
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-3 py-2">Incident ID</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Organisation Type</th>
                <th className="px-3 py-2">System Affected</th>
                <th className="px-3 py-2">Attack Vector</th>
                <th className="px-3 py-2">Impact</th>
                <th className="px-3 py-2">Detected By</th>
                <th className="px-3 py-2 text-right">Response (hrs)</th>
                <th className="px-3 py-2 text-center">Reported ASD</th>
                <th className="px-3 py-2 text-center">Public</th>
              </tr>
            </thead>
            <tbody>
              {dash.incidents.map((inc: EGCIncidentRecord, idx: number) => (
                <tr
                  key={inc.incident_id}
                  className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800/60'}
                >
                  <td className="px-3 py-2 font-mono text-gray-400 text-xs">{inc.incident_id}</td>
                  <td className="px-3 py-2 text-gray-300">{inc.date}</td>
                  <td className="px-3 py-2">{inc.organisation_type}</td>
                  <td className="px-3 py-2 text-xs text-gray-300">{inc.system_affected.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2">
                    <Badge
                      label={inc.attack_vector}
                      colorClass={SEVERITY_BADGE[inc.attack_vector] ?? 'bg-gray-600 text-white'}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      label={inc.impact_level}
                      colorClass={IMPACT_BADGE[inc.impact_level] ?? 'bg-gray-600 text-white'}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      label={inc.detected_by}
                      colorClass={DETECTED_BADGE[inc.detected_by] ?? 'bg-gray-600 text-white'}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    <span className={inc.response_time_hrs >= 24 ? 'text-red-400' : inc.response_time_hrs >= 12 ? 'text-amber-400' : 'text-green-400'}>
                      {inc.response_time_hrs}h
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {inc.reported_to_asd
                      ? <span className="text-green-400 font-bold">Yes</span>
                      : <span className="text-gray-500">No</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-center">
                    {inc.publicly_disclosed
                      ? <span className="text-amber-400 font-bold">Yes</span>
                      : <span className="text-gray-500">No</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Compliance Status */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-cyan-300 border-b border-gray-700 pb-1">
          Compliance Status — SOCI Act, ISM, IEC 62443, NIST CSF
        </h2>
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-3 py-2">Organisation</th>
                <th className="px-3 py-2">Framework</th>
                <th className="px-3 py-2 text-right">Compliance Score</th>
                <th className="px-3 py-2 text-center">Critical Gaps</th>
                <th className="px-3 py-2">Last Audit</th>
                <th className="px-3 py-2">Certification</th>
                <th className="px-3 py-2 text-right">Remediation Budget</th>
              </tr>
            </thead>
            <tbody>
              {dash.compliance.map((c: EGCComplianceRecord, idx: number) => (
                <tr
                  key={`${c.organisation}-${c.framework}`}
                  className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800/60'}
                >
                  <td className="px-3 py-2 font-medium">{c.organisation}</td>
                  <td className="px-3 py-2 text-xs text-cyan-300 font-mono">{c.framework.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={
                      c.compliance_score_pct >= 80 ? 'text-green-400 font-bold' :
                      c.compliance_score_pct >= 65 ? 'text-amber-400 font-bold' :
                      'text-red-400 font-bold'
                    }>
                      {c.compliance_score_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={c.critical_gaps <= 3 ? 'text-green-400' : c.critical_gaps <= 6 ? 'text-amber-400' : 'text-red-400'}>
                      {c.critical_gaps}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-300 text-xs">{c.last_audit_date}</td>
                  <td className="px-3 py-2">
                    <Badge
                      label={c.certification_status}
                      colorClass={CERT_BADGE[c.certification_status] ?? 'bg-gray-600 text-white'}
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-amber-400">${c.remediation_budget_m.toFixed(1)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Resilience Scores — Heatmap-style */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-cyan-300 border-b border-gray-700 pb-1">
          Cyber Resilience Scores by Region &amp; Asset Class
        </h2>

        {/* Heatmap grid */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-2">Region</th>
                {assetClasses.map(ac => (
                  <th key={ac} className="px-4 py-2 text-center">{ac.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regions.map((region, idx) => (
                <tr key={region} className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800/60'}>
                  <td className="px-4 py-2 font-semibold">{region}</td>
                  {assetClasses.map(ac => {
                    const rec = resMap.get(`${region}|${ac}`)
                    return (
                      <td key={ac} className="px-4 py-2 text-center">
                        {rec ? (
                          <span className={`inline-block px-3 py-1 rounded font-bold text-sm ${resilienceCell(rec.cyber_resilience_score)}`}>
                            {rec.cyber_resilience_score.toFixed(0)}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Resilience detail table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-3 py-2">Region</th>
                <th className="px-3 py-2">Asset Class</th>
                <th className="px-3 py-2 text-center">Score</th>
                <th className="px-3 py-2 text-center">Redundancy</th>
                <th className="px-3 py-2 text-right">RTO (hrs)</th>
                <th className="px-3 py-2 text-right">RPO (hrs)</th>
                <th className="px-3 py-2 text-right">Last Pentest (mo)</th>
                <th className="px-3 py-2 text-right">Known Vulns</th>
                <th className="px-3 py-2 text-right">Patch Currency</th>
              </tr>
            </thead>
            <tbody>
              {dash.resilience.map((r: EGCResilienceRecord, idx: number) => (
                <tr
                  key={`${r.region}-${r.asset_class}`}
                  className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800/60'}
                >
                  <td className="px-3 py-2 font-medium">{r.region}</td>
                  <td className="px-3 py-2 text-xs text-gray-300">{r.asset_class.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${resilienceCell(r.cyber_resilience_score)}`}>
                      {r.cyber_resilience_score.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-cyan-300 font-mono text-xs">{r.redundancy_level}</td>
                  <td className="px-3 py-2 text-right">{r.recovery_time_objective_hrs}h</td>
                  <td className="px-3 py-2 text-right">{r.recovery_point_objective_hrs}h</td>
                  <td className="px-3 py-2 text-right">
                    <span className={r.last_penetration_test_months > 12 ? 'text-red-400' : r.last_penetration_test_months > 6 ? 'text-amber-400' : 'text-green-400'}>
                      {r.last_penetration_test_months}mo
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={r.known_vulnerabilities > 30 ? 'text-red-400' : r.known_vulnerabilities > 15 ? 'text-amber-400' : 'text-green-400'}>
                      {r.known_vulnerabilities}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={r.patch_currency_pct >= 85 ? 'text-green-400' : r.patch_currency_pct >= 70 ? 'text-amber-400' : 'text-red-400'}>
                      {r.patch_currency_pct.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Investment Trends */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-cyan-300 border-b border-gray-700 pb-1">
          Cybersecurity Investment Trends by Sector (2020–2024)
        </h2>
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Total Cyber Investment ($M) by Sector</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={buildInvestmentChartData(dash.investment)}
              margin={{ top: 4, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(val: number) => [`$${val.toFixed(1)}M`]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
              {investmentSectors.map(sector => (
                <Bar
                  key={sector}
                  dataKey={sector}
                  stackId="a"
                  fill={SECTOR_COLORS[sector] ?? '#8b5cf6'}
                  radius={sector === investmentSectors[investmentSectors.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Investment detail table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Sector</th>
                <th className="px-3 py-2 text-right">OT Security ($M)</th>
                <th className="px-3 py-2 text-right">IT Security ($M)</th>
                <th className="px-3 py-2 text-right">Training ($M)</th>
                <th className="px-3 py-2 text-right">IR ($M)</th>
                <th className="px-3 py-2 text-right">Total ($M)</th>
                <th className="px-3 py-2 text-right">% of CapEx</th>
              </tr>
            </thead>
            <tbody>
              {dash.investment.map((inv: EGCInvestmentRecord, idx: number) => (
                <tr
                  key={`${inv.year}-${inv.sector}`}
                  className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800/60'}
                >
                  <td className="px-3 py-2 font-mono text-gray-300">{inv.year}</td>
                  <td className="px-3 py-2 font-medium">{inv.sector}</td>
                  <td className="px-3 py-2 text-right">${inv.ot_security_m.toFixed(1)}M</td>
                  <td className="px-3 py-2 text-right">${inv.it_security_m.toFixed(1)}M</td>
                  <td className="px-3 py-2 text-right">${inv.training_m.toFixed(1)}M</td>
                  <td className="px-3 py-2 text-right">${inv.incident_response_m.toFixed(1)}M</td>
                  <td className="px-3 py-2 text-right font-bold text-cyan-400">
                    ${inv.total_cyber_investment_m.toFixed(1)}M
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300">{inv.as_pct_of_capex.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
