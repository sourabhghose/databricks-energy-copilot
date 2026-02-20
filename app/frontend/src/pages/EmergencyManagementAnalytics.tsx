import { useEffect, useState } from 'react'
import { AlertTriangle, Shield, Clock, Activity, CheckCircle, XCircle, MinusCircle } from 'lucide-react'
import {
  getEmergencyManagementDashboard,
  EMCDashboard,
  EMCEmergencyRecord,
  EMCResponseProtocolRecord,
  EMCRestorationRecord,
  EMCPreparednessRecord,
  EMCDrillRecord,
} from '../api/client'

// ── Colour maps ─────────────────────────────────────────────────────────────────

const EMERGENCY_CLASS_COLORS: Record<string, string> = {
  SYSTEM_SECURITY:     'bg-red-700 text-red-100',
  MARKET_EMERGENCY:    'bg-orange-700 text-orange-100',
  SUPPLY_SHORTAGE:     'bg-yellow-700 text-yellow-100',
  TRANSMISSION_FAILURE:'bg-purple-700 text-purple-100',
  GENERATION_DEFICIT:  'bg-blue-700 text-blue-100',
}

const SEVERITY_COLORS: Record<number, string> = {
  5: 'bg-red-600 text-red-100',
  4: 'bg-orange-600 text-orange-100',
  3: 'bg-yellow-600 text-yellow-100',
  2: 'bg-blue-600 text-blue-100',
  1: 'bg-green-600 text-green-100',
}

const RESOLUTION_COLORS: Record<string, string> = {
  RERT:              'bg-green-700 text-green-100',
  DEMAND_RESPONSE:   'bg-teal-700 text-teal-100',
  MARKET_SUSPENSION: 'bg-red-700 text-red-100',
  ISLANDING:         'bg-purple-700 text-purple-100',
  MANUAL_DISPATCH:   'bg-orange-700 text-orange-100',
}

const ADEQUACY_COLORS: Record<string, string> = {
  ADEQUATE:     'bg-green-700 text-green-100',
  MARGINAL:     'bg-yellow-700 text-yellow-100',
  INSUFFICIENT: 'bg-red-700 text-red-100',
}

const DRILL_TYPE_COLORS: Record<string, string> = {
  TABLETOP:      'bg-blue-700 text-blue-100',
  FUNCTIONAL:    'bg-teal-700 text-teal-100',
  FULL_SCALE:    'bg-green-700 text-green-100',
  CYBER_RESPONSE:'bg-purple-700 text-purple-100',
  BLACK_START:   'bg-orange-700 text-orange-100',
}

const REGION_COLORS: Record<string, string> = {
  NSW: 'bg-blue-700 text-blue-100',
  VIC: 'bg-indigo-700 text-indigo-100',
  QLD: 'bg-yellow-700 text-yellow-100',
  SA:  'bg-pink-700 text-pink-100',
  TAS: 'bg-teal-700 text-teal-100',
  NEM: 'bg-gray-600 text-gray-100',
}

// ── Helper components ───────────────────────────────────────────────────────────

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  )
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  iconColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  iconColor: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${iconColor}`}>{icon}</div>
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <p className="text-white text-2xl font-bold">{value}</p>
        {sub && <p className="text-gray-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function AdequacyIcon({ status }: { status: string }) {
  if (status === 'ADEQUATE')     return <CheckCircle className="w-4 h-4 text-green-400 inline" />
  if (status === 'MARGINAL')     return <MinusCircle className="w-4 h-4 text-yellow-400 inline" />
  if (status === 'INSUFFICIENT') return <XCircle className="w-4 h-4 text-red-400 inline" />
  return null
}

// ── Section: Emergency Registry ─────────────────────────────────────────────────

function EmergencyRegistryTable({ emergencies }: { emergencies: EMCEmergencyRecord[] }) {
  const sorted = [...emergencies].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold text-lg mb-3">NEM Emergency Event Registry</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Event ID</th>
              <th className="text-left py-2 pr-3">Date</th>
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-left py-2 pr-3">Name</th>
              <th className="text-left py-2 pr-3">Class</th>
              <th className="text-left py-2 pr-3">AEMO Power</th>
              <th className="text-center py-2 pr-3">Sev.</th>
              <th className="text-right py-2 pr-3">Duration (hrs)</th>
              <th className="text-right py-2 pr-3">MW at Risk</th>
              <th className="text-right py-2 pr-3">Load Shed (MWh)</th>
              <th className="text-left py-2">Resolution</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.event_id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-3 text-gray-300 font-mono text-xs">{e.event_id}</td>
                <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{e.date}</td>
                <td className="py-2 pr-3">
                  <Badge
                    label={e.region}
                    colorClass={REGION_COLORS[e.region] ?? 'bg-gray-600 text-gray-100'}
                  />
                </td>
                <td className="py-2 pr-3 text-gray-200 max-w-xs">{truncate(e.name, 38)}</td>
                <td className="py-2 pr-3">
                  <Badge
                    label={e.emergency_class.replace(/_/g, ' ')}
                    colorClass={EMERGENCY_CLASS_COLORS[e.emergency_class] ?? 'bg-gray-600 text-gray-100'}
                  />
                </td>
                <td className="py-2 pr-3 text-gray-300 text-xs font-mono">{e.aemo_power_invoked}</td>
                <td className="py-2 pr-3 text-center">
                  <Badge
                    label={String(e.severity_level)}
                    colorClass={SEVERITY_COLORS[e.severity_level] ?? 'bg-gray-600 text-gray-100'}
                  />
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">{e.duration_hrs.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{e.mw_at_risk.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  {e.load_shed_mwh > 0 ? e.load_shed_mwh.toLocaleString() : '—'}
                </td>
                <td className="py-2">
                  <Badge
                    label={e.resolution_mechanism.replace(/_/g, ' ')}
                    colorClass={RESOLUTION_COLORS[e.resolution_mechanism] ?? 'bg-gray-600 text-gray-100'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Section: Response Protocols ─────────────────────────────────────────────────

function ResponseProtocolsTable({ protocols }: { protocols: EMCResponseProtocolRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold text-lg mb-3">AEMO Emergency Response Protocols</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Protocol ID</th>
              <th className="text-left py-2 pr-3">Name</th>
              <th className="text-left py-2 pr-3">NER/NEL Section</th>
              <th className="text-left py-2 pr-3">Trigger Condition</th>
              <th className="text-right py-2 pr-3">Activation Target (min)</th>
              <th className="text-right py-2 pr-3">Tests/yr</th>
              <th className="text-right py-2 pr-3">Last Activated</th>
              <th className="text-right py-2 pr-3">Effectiveness</th>
            </tr>
          </thead>
          <tbody>
            {protocols.map((p) => (
              <tr key={p.protocol_id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-3 text-gray-300 font-mono text-xs">{p.protocol_id}</td>
                <td className="py-2 pr-3 text-gray-200 max-w-xs">{truncate(p.name, 42)}</td>
                <td className="py-2 pr-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-indigo-800 text-indigo-100">
                    {p.aemo_power_section}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-400 text-xs max-w-xs">{truncate(p.trigger_condition, 55)}</td>
                <td className="py-2 pr-3 text-right">
                  {p.activation_time_target_min === 0 ? (
                    <span className="text-green-400 font-semibold text-xs">Automatic</span>
                  ) : (
                    <span className="text-yellow-300 font-semibold">{p.activation_time_target_min}</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">{p.test_frequency_per_yr}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{p.last_activation_year}</td>
                <td className="py-2 pr-3 text-right">
                  <span
                    className={`font-semibold ${
                      p.effectiveness_score >= 8.5
                        ? 'text-green-400'
                        : p.effectiveness_score >= 7.0
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  >
                    {p.effectiveness_score.toFixed(1)}/10
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <h3 className="text-gray-400 text-sm font-semibold mb-2">Response Resources by Protocol</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {protocols.map((p) => (
            <div key={`res-${p.protocol_id}`} className="bg-gray-700 rounded p-3">
              <p className="text-gray-200 text-xs font-semibold mb-1">
                {p.protocol_id} — {truncate(p.name, 38)}
              </p>
              <ul className="list-disc list-inside text-gray-400 text-xs space-y-0.5">
                {p.response_resources.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Section: Restoration Case Studies ──────────────────────────────────────────

function RestorationTable({ restoration }: { restoration: EMCRestorationRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold text-lg mb-3">Black Start & Restoration Case Studies</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Event</th>
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-left py-2 pr-3">Black Start Units</th>
              <th className="text-center py-2 pr-3">Phases</th>
              <th className="text-right py-2 pr-3">Phase 1 (hrs)</th>
              <th className="text-right py-2 pr-3">Phase 2 (hrs)</th>
              <th className="text-right py-2 pr-3">Full Restore (hrs)</th>
              <th className="text-left py-2">Lessons Learned</th>
            </tr>
          </thead>
          <tbody>
            {restoration.map((r) => (
              <tr key={r.event_id} className="border-b border-gray-700 hover:bg-gray-750 align-top">
                <td className="py-2 pr-3 text-gray-200 text-xs font-semibold whitespace-nowrap">
                  {truncate(r.event_name, 30)}
                </td>
                <td className="py-2 pr-3">
                  <Badge
                    label={r.region}
                    colorClass={REGION_COLORS[r.region] ?? 'bg-gray-600 text-gray-100'}
                  />
                </td>
                <td className="py-2 pr-3 text-gray-400 text-xs max-w-xs">
                  {r.black_start_units.join(', ')}
                </td>
                <td className="py-2 pr-3 text-center text-gray-300">{r.restoration_phases}</td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  {r.phase_1_time_hrs > 0 ? r.phase_1_time_hrs.toFixed(1) : '—'}
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  {r.phase_2_time_hrs > 0 ? r.phase_2_time_hrs.toFixed(1) : '—'}
                </td>
                <td className="py-2 pr-3 text-right">
                  <span
                    className={`font-semibold ${
                      r.full_restoration_hrs <= 10
                        ? 'text-green-400'
                        : r.full_restoration_hrs <= 15
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  >
                    {r.full_restoration_hrs.toFixed(1)}
                  </span>
                </td>
                <td className="py-2 text-gray-400 text-xs max-w-sm">{truncate(r.lessons_learned, 80)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 space-y-3">
        {restoration.map((r) => (
          <div key={`lesson-${r.event_id}`} className="bg-gray-700 rounded p-3">
            <p className="text-gray-200 text-xs font-semibold mb-1">
              {r.event_name} — Critical Load Priority
            </p>
            <p className="text-gray-400 text-xs mb-1">{r.critical_load_priority}</p>
            <p className="text-gray-300 text-xs italic">{r.lessons_learned}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section: Preparedness Status ────────────────────────────────────────────────

function PreparednessTable({ preparedness }: { preparedness: EMCPreparednessRecord[] }) {
  const regions = Array.from(new Set(preparedness.map((p) => p.region)))
  const metrics = Array.from(new Set(preparedness.map((p) => p.metric)))

  // Build lookup map
  const lookup: Record<string, EMCPreparednessRecord> = {}
  preparedness.forEach((p) => {
    lookup[`${p.region}__${p.metric}`] = p
  })

  function adequacyBg(status: string): string {
    if (status === 'ADEQUATE')     return 'bg-green-900/40'
    if (status === 'MARGINAL')     return 'bg-yellow-900/40'
    if (status === 'INSUFFICIENT') return 'bg-red-900/40'
    return 'bg-gray-700'
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold text-lg mb-1">Emergency Preparedness Status</h2>
      <p className="text-gray-400 text-xs mb-4">
        Traffic-light status per region and preparedness metric. Green = Adequate, Yellow = Marginal, Red = Insufficient.
      </p>

      {/* Traffic-light heat map */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-4">Metric</th>
              {regions.map((r) => (
                <th key={r} className="text-center py-2 px-3">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric} className="border-b border-gray-700">
                <td className="py-2 pr-4 text-gray-300 text-xs font-mono">{metric.replace(/_/g, ' ')}</td>
                {regions.map((region) => {
                  const rec = lookup[`${region}__${metric}`]
                  if (!rec) return <td key={region} className="py-2 px-3 text-center text-gray-600">—</td>
                  return (
                    <td key={region} className={`py-2 px-3 text-center rounded ${adequacyBg(rec.adequacy_status)}`}>
                      <div className="flex flex-col items-center gap-0.5">
                        <AdequacyIcon status={rec.adequacy_status} />
                        <span className="text-gray-200 text-xs font-semibold">
                          {rec.current_value.toFixed(0)}
                        </span>
                        <span className="text-gray-500 text-xs">/ {rec.target_value.toFixed(0)}</span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-left py-2 pr-3">Metric</th>
              <th className="text-right py-2 pr-3">Current</th>
              <th className="text-right py-2 pr-3">Target</th>
              <th className="text-left py-2 pr-3">Status</th>
              <th className="text-right py-2 pr-3">Last Tested (months ago)</th>
              <th className="text-right py-2">Investment Needed ($M)</th>
            </tr>
          </thead>
          <tbody>
            {preparedness.map((p, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-3">
                  <Badge
                    label={p.region}
                    colorClass={REGION_COLORS[p.region] ?? 'bg-gray-600 text-gray-100'}
                  />
                </td>
                <td className="py-2 pr-3 text-gray-400 text-xs font-mono">{p.metric.replace(/_/g, ' ')}</td>
                <td className="py-2 pr-3 text-right text-gray-200 font-semibold">{p.current_value.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-gray-400">{p.target_value.toFixed(1)}</td>
                <td className="py-2 pr-3">
                  <Badge
                    label={p.adequacy_status}
                    colorClass={ADEQUACY_COLORS[p.adequacy_status] ?? 'bg-gray-600 text-gray-100'}
                  />
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">{p.last_tested_months_ago.toFixed(0)}</td>
                <td className="py-2 text-right">
                  {p.investment_needed_m > 0 ? (
                    <span className="text-red-400 font-semibold">${p.investment_needed_m.toFixed(0)}M</span>
                  ) : (
                    <span className="text-green-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Section: Drill Program ──────────────────────────────────────────────────────

function DrillProgramTable({ drills }: { drills: EMCDrillRecord[] }) {
  const sorted = [...drills].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-white font-semibold text-lg mb-3">Emergency Drill Program Outcomes</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Drill ID</th>
              <th className="text-left py-2 pr-3">Date</th>
              <th className="text-left py-2 pr-3">Type</th>
              <th className="text-left py-2 pr-3">Scenario</th>
              <th className="text-left py-2 pr-3">Participants</th>
              <th className="text-right py-2 pr-3">Duration (hrs)</th>
              <th className="text-right py-2 pr-3">Objectives Met</th>
              <th className="text-right py-2 pr-3">Findings</th>
              <th className="text-right py-2 pr-3">Critical</th>
              <th className="text-right py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.drill_id} className="border-b border-gray-700 hover:bg-gray-750 align-top">
                <td className="py-2 pr-3 text-gray-300 font-mono text-xs">{d.drill_id}</td>
                <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{d.date}</td>
                <td className="py-2 pr-3">
                  <Badge
                    label={d.drill_type.replace(/_/g, ' ')}
                    colorClass={DRILL_TYPE_COLORS[d.drill_type] ?? 'bg-gray-600 text-gray-100'}
                  />
                </td>
                <td className="py-2 pr-3 text-gray-400 text-xs max-w-xs">{truncate(d.scenario, 52)}</td>
                <td className="py-2 pr-3 text-gray-400 text-xs max-w-xs">{truncate(d.participants.join(', '), 48)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{d.duration_hrs.toFixed(0)}</td>
                <td className="py-2 pr-3 text-right">
                  <span
                    className={`font-semibold ${
                      d.objectives_met_pct >= 85
                        ? 'text-green-400'
                        : d.objectives_met_pct >= 75
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  >
                    {d.objectives_met_pct.toFixed(0)}%
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">{d.findings_count}</td>
                <td className="py-2 pr-3 text-right">
                  <span className={d.critical_findings > 3 ? 'text-red-400 font-semibold' : d.critical_findings > 1 ? 'text-yellow-400 font-semibold' : 'text-green-400'}>
                    {d.critical_findings}
                  </span>
                </td>
                <td className="py-2 text-right text-gray-300">{d.remediation_actions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────────

export default function EmergencyManagementAnalytics() {
  const [data, setData] = useState<EMCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEmergencyManagementDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertTriangle className="w-5 h-5 mr-2" />
        {error ?? 'No data'}
      </div>
    )
  }

  const s = data.summary as Record<string, number>

  return (
    <div className="space-y-6 p-6 bg-gray-900 min-h-screen text-white">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          NEM Emergency Management &amp; Contingency Response Analytics
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          AEMO emergency powers, system security protocols, contingency event management, and restoration procedures
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Emergencies 2024"
          value={String(s.total_emergencies_2024 ?? '—')}
          sub="NEM emergency events"
          iconColor="bg-red-900"
        />
        <KpiCard
          icon={<Activity className="w-5 h-5" />}
          label="Avg Severity Level"
          value={s.avg_severity_level?.toFixed(1) ?? '—'}
          sub="Scale 1-5"
          iconColor="bg-orange-900"
        />
        <KpiCard
          icon={<Shield className="w-5 h-5" />}
          label="Load Shed 2024"
          value={`${(s.load_shed_2024_mwh ?? 0).toLocaleString()} MWh`}
          sub="Involuntary load curtailment"
          iconColor="bg-yellow-900"
        />
        <KpiCard
          icon={<Clock className="w-5 h-5" />}
          label="Avg Restoration"
          value={`${s.avg_restoration_hrs?.toFixed(1) ?? '—'} hrs`}
          sub="Full system restoration"
          iconColor="bg-blue-900"
        />
        <KpiCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Preparedness Adequate"
          value={`${s.preparedness_adequate_pct?.toFixed(0) ?? '—'}%`}
          sub="Of metrics meeting targets"
          iconColor="bg-green-900"
        />
        <KpiCard
          icon={<Activity className="w-5 h-5" />}
          label="Drills / Year (avg)"
          value={s.drills_per_yr_avg?.toFixed(1) ?? '—'}
          sub="Emergency drill frequency"
          iconColor="bg-purple-900"
        />
        <KpiCard
          icon={<Shield className="w-5 h-5" />}
          label="RERT Activated 2024"
          value={String(s.rert_activated_2024 ?? '—')}
          sub="Times RERT was triggered"
          iconColor="bg-teal-900"
        />
      </div>

      {/* Emergency Registry */}
      <EmergencyRegistryTable emergencies={data.emergencies} />

      {/* Response Protocols */}
      <ResponseProtocolsTable protocols={data.protocols} />

      {/* Restoration Case Studies */}
      <RestorationTable restoration={data.restoration} />

      {/* Preparedness Status */}
      <PreparednessTable preparedness={data.preparedness} />

      {/* Drill Program */}
      <DrillProgramTable drills={data.drills} />

      {/* Footer note */}
      <p className="text-gray-600 text-xs pb-4">
        Data reflects publicly available AEMO reports, NER obligations (NER 3.14, 5.20, 4.8, 5.1), and NEM emergency event records 2016–2024.
        Not for operational use.
      </p>
    </div>
  )
}
