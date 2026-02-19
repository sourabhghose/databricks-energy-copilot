import { useEffect, useState } from 'react'
import { ShieldAlert, AlertCircle, Loader2 } from 'lucide-react'
import {
  api,
  GridResilienceDashboard,
  WeatherOutageEvent,
  ResilienceInvestmentRecord,
  GridVulnerabilityRecord,
  ResilienceKpiRecord,
} from '../api/client'
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

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 1) {
  return n.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtInt(n: number) {
  return n.toLocaleString('en-AU')
}

function eventTypeBadge(type: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (type) {
    case 'BUSHFIRE':  return <span className={`${base} bg-red-700 text-red-100`}>BUSHFIRE</span>
    case 'FLOOD':     return <span className={`${base} bg-blue-700 text-blue-100`}>FLOOD</span>
    case 'HEATWAVE':  return <span className={`${base} bg-amber-600 text-amber-100`}>HEATWAVE</span>
    case 'STORM':     return <span className={`${base} bg-gray-600 text-gray-100`}>STORM</span>
    case 'CYCLONE':   return <span className={`${base} bg-purple-700 text-purple-100`}>CYCLONE</span>
    case 'DROUGHT':   return <span className={`${base} bg-yellow-700 text-yellow-100`}>DROUGHT</span>
    default:          return <span className={`${base} bg-gray-500 text-gray-100`}>{type}</span>
  }
}

function severityBadge(severity: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (severity) {
    case 'LOW':      return <span className={`${base} bg-green-700 text-green-100`}>LOW</span>
    case 'MODERATE': return <span className={`${base} bg-amber-600 text-amber-100`}>MODERATE</span>
    case 'HIGH':     return <span className={`${base} bg-orange-600 text-orange-100`}>HIGH</span>
    case 'EXTREME':  return <span className={`${base} bg-red-700 text-red-100`}>EXTREME</span>
    default:         return <span className={`${base} bg-gray-500 text-gray-100`}>{severity}</span>
  }
}

function riskBadge(risk: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (risk) {
    case 'LOW':     return <span className={`${base} bg-green-800 text-green-100`}>LOW</span>
    case 'MEDIUM':  return <span className={`${base} bg-yellow-700 text-yellow-100`}>MED</span>
    case 'HIGH':    return <span className={`${base} bg-orange-600 text-orange-100`}>HIGH</span>
    case 'EXTREME': return <span className={`${base} bg-red-700 text-red-100`}>EXT</span>
    default:        return <span className={`${base} bg-gray-500 text-gray-100`}>{risk}</span>
  }
}

function assetTypeBadge(type: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (type) {
    case 'SUBSTATION':        return <span className={`${base} bg-indigo-700 text-indigo-100`}>SUBSTATION</span>
    case 'TRANSMISSION_LINE': return <span className={`${base} bg-cyan-700 text-cyan-100`}>TRANSMISSION</span>
    case 'DISTRIBUTION_LINE': return <span className={`${base} bg-teal-700 text-teal-100`}>DISTRIBUTION</span>
    case 'TRANSFORMER':       return <span className={`${base} bg-violet-700 text-violet-100`}>TRANSFORMER</span>
    case 'CONTROL_SYSTEM':    return <span className={`${base} bg-blue-700 text-blue-100`}>CONTROL SYS</span>
    default:                  return <span className={`${base} bg-gray-500 text-gray-100`}>{type}</span>
  }
}

function investmentTypeBadge(type: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (type) {
    case 'UNDERGROUNDING':  return <span className={`${base} bg-blue-700 text-blue-100`}>UNDERGROUNDING</span>
    case 'FLOOD_PROTECTION':return <span className={`${base} bg-cyan-700 text-cyan-100`}>FLOOD PROTECT</span>
    case 'FIRE_HARDENING':  return <span className={`${base} bg-red-700 text-red-100`}>FIRE HARDENING</span>
    case 'MICROGRID':       return <span className={`${base} bg-green-700 text-green-100`}>MICROGRID</span>
    case 'BACKUP_POWER':    return <span className={`${base} bg-amber-600 text-amber-100`}>BACKUP POWER</span>
    case 'COMMS_UPGRADE':   return <span className={`${base} bg-purple-700 text-purple-100`}>COMMS UPGRADE</span>
    default:                return <span className={`${base} bg-gray-500 text-gray-100`}>{type}</span>
  }
}

function investmentStatusBadge(status: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (status) {
    case 'PLANNING':     return <span className={`${base} bg-gray-600 text-gray-100`}>PLANNING</span>
    case 'APPROVED':     return <span className={`${base} bg-blue-700 text-blue-100`}>APPROVED</span>
    case 'CONSTRUCTION': return <span className={`${base} bg-amber-600 text-amber-100`}>CONSTRUCTION</span>
    case 'COMPLETE':     return <span className={`${base} bg-green-700 text-green-100`}>COMPLETE</span>
    default:             return <span className={`${base} bg-gray-500 text-gray-100`}>{status}</span>
  }
}

function priorityBadge(priority: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (priority) {
    case 'CRITICAL': return <span className={`${base} bg-red-700 text-red-100`}>CRITICAL</span>
    case 'HIGH':     return <span className={`${base} bg-orange-600 text-orange-100`}>HIGH</span>
    case 'MEDIUM':   return <span className={`${base} bg-amber-600 text-amber-100`}>MEDIUM</span>
    case 'LOW':      return <span className={`${base} bg-green-700 text-green-100`}>LOW</span>
    default:         return <span className={`${base} bg-gray-500 text-gray-100`}>{priority}</span>
  }
}

function stateBadge(state: string) {
  const map: Record<string, string> = {
    QLD: 'bg-purple-700 text-purple-100',
    NSW: 'bg-blue-700 text-blue-100',
    VIC: 'bg-indigo-700 text-indigo-100',
    WA:  'bg-yellow-700 text-yellow-100',
    SA:  'bg-red-700 text-red-100',
    NT:  'bg-orange-700 text-orange-100',
    TAS: 'bg-teal-700 text-teal-100',
    ACT: 'bg-cyan-700 text-cyan-100',
  }
  const cls = map[state] ?? 'bg-gray-600 text-gray-100'
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{state}</span>
}

function VulnerabilityBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 10) * 100)
  let color = 'bg-green-500'
  if (score >= 8) color = 'bg-red-500'
  else if (score >= 6.5) color = 'bg-orange-500'
  else if (score >= 5) color = 'bg-amber-500'
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-8 text-right">{fmt(score, 1)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  unit,
  sub,
  valueColor,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${valueColor ?? 'text-white'}`}>{value}</span>
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SAIDI Chart data builder
// ---------------------------------------------------------------------------

const STATE_COLORS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#6366f1',
  QLD: '#a855f7',
  SA:  '#ef4444',
  WA:  '#f59e0b',
}

function buildSaidiChartData(kpis: ResilienceKpiRecord[]) {
  const years = [2022, 2023, 2024]
  return years.map(year => {
    const row: Record<string, string | number> = { year: String(year) }
    const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA']
    for (const state of states) {
      const record = kpis.find(k => k.year === year && k.state === state)
      if (record) row[state] = record.saidi_minutes
    }
    return row
  })
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GridResilience() {
  const [dashboard, setDashboard] = useState<GridResilienceDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getGridResilienceDashboard()
      .then(setDashboard)
      .catch(err => setError(err.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading resilience data…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 gap-2">
        <AlertCircle size={20} />
        <span>{error ?? 'No data available'}</span>
      </div>
    )
  }

  const saidiData = buildSaidiChartData(dashboard.kpi_records)

  return (
    <div className="p-6 space-y-6 text-gray-100 min-h-screen bg-gray-900">
      {/* Header */}
      <div className="flex items-start gap-3">
        <ShieldAlert className="text-orange-400 mt-0.5 shrink-0" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">
            Power System Resilience &amp; Extreme Weather Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Grid hardening programs, weather-related outage events, asset vulnerability assessment,
            and climate resilience investment across Australia's energy infrastructure.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Unserved Energy"
          value={fmtInt(Math.round(dashboard.total_unserved_energy_mwh))}
          unit="MWh"
          sub="Across all weather events"
          valueColor="text-red-400"
        />
        <KpiCard
          label="Customers Affected"
          value={fmtInt(dashboard.total_affected_customers)}
          unit="customers"
          sub="Cumulative event impact"
          valueColor="text-orange-400"
        />
        <KpiCard
          label="Total Resilience Investment"
          value={`$${fmt(dashboard.total_resilience_investment_m_aud, 0)}M`}
          unit="AUD"
          sub="Committed capital programs"
          valueColor="text-green-400"
        />
        <KpiCard
          label="Avg Recovery Time"
          value={fmt(dashboard.avg_recovery_days, 1)}
          unit="days"
          sub="Mean restoration per event"
          valueColor="text-amber-400"
        />
      </div>

      {/* SAIDI Trend Chart */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">
          SAIDI Trend 2022–2024 (Minutes per Customer per Year)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={saidiData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" min" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(val: number) => [`${fmt(val, 1)} min`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {Object.entries(STATE_COLORS).map(([state, color]) => (
              <Bar key={state} dataKey={state} fill={color} radius={[2, 2, 0, 0]} maxBarSize={40} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weather Outage Events Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Weather Outage Events ({dashboard.outage_events.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-750 border-b border-gray-700">
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Event</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Type</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">State</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Start</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">End</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Customers</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Unserved (MWh)</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Damage ($M)</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Recovery (d)</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Severity</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.outage_events.map((ev: WeatherOutageEvent, i: number) => (
                <tr
                  key={ev.event_id}
                  className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-825'}`}
                >
                  <td className="px-4 py-2 text-gray-200 font-medium max-w-[200px]">
                    <div className="truncate" title={ev.event_name}>{ev.event_name}</div>
                    <div className="text-xs text-gray-500">{ev.region}</div>
                  </td>
                  <td className="px-4 py-2">{eventTypeBadge(ev.event_type)}</td>
                  <td className="px-4 py-2">{stateBadge(ev.state)}</td>
                  <td className="px-4 py-2 text-gray-300 text-xs">{ev.start_date}</td>
                  <td className="px-4 py-2 text-gray-300 text-xs">{ev.end_date ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{fmtInt(ev.affected_customers)}</td>
                  <td className="px-4 py-2 text-right text-red-400 font-semibold">{fmtInt(Math.round(ev.unserved_energy_mwh))}</td>
                  <td className="px-4 py-2 text-right text-orange-400">{fmt(ev.infrastructure_damage_m_aud, 0)}</td>
                  <td className="px-4 py-2 text-right text-amber-400">{fmt(ev.recovery_days, 1)}</td>
                  <td className="px-4 py-2">{severityBadge(ev.severity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vulnerability Assessment Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Grid Asset Vulnerability Assessment ({dashboard.vulnerability_records.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-750 border-b border-gray-700">
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Asset</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Type</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">State</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Vuln. Score</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Bushfire</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Flood</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Heat</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Age (yr)</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Last Hardened</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.vulnerability_records.map((rec: GridVulnerabilityRecord, i: number) => (
                <tr
                  key={rec.asset_id}
                  className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-825'}`}
                >
                  <td className="px-4 py-2 text-gray-200 font-medium max-w-[200px]">
                    <div className="truncate" title={rec.asset_name}>{rec.asset_name}</div>
                  </td>
                  <td className="px-4 py-2">{assetTypeBadge(rec.asset_type)}</td>
                  <td className="px-4 py-2">{stateBadge(rec.state)}</td>
                  <td className="px-4 py-2"><VulnerabilityBar score={rec.vulnerability_score} /></td>
                  <td className="px-4 py-2">{riskBadge(rec.bushfire_risk)}</td>
                  <td className="px-4 py-2">{riskBadge(rec.flood_risk)}</td>
                  <td className="px-4 py-2">{riskBadge(rec.heat_risk)}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{rec.age_years}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{rec.last_hardening_year ?? '—'}</td>
                  <td className="px-4 py-2">{priorityBadge(rec.replacement_priority)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resilience Investment Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Resilience Investment Programs ({dashboard.resilience_investments.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-750 border-b border-gray-700">
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Project</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Asset Owner</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">State</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Type</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">CAPEX ($M)</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Annual Benefit ($M)</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Customers Protected</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Risk Reduction</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.resilience_investments.map((inv: ResilienceInvestmentRecord, i: number) => (
                <tr
                  key={inv.project_id}
                  className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-825'}`}
                >
                  <td className="px-4 py-2 text-gray-200 font-medium max-w-[200px]">
                    <div className="truncate" title={inv.project_name}>{inv.project_name}</div>
                  </td>
                  <td className="px-4 py-2 text-gray-300 text-xs">{inv.asset_owner}</td>
                  <td className="px-4 py-2">{stateBadge(inv.state)}</td>
                  <td className="px-4 py-2">{investmentTypeBadge(inv.investment_type)}</td>
                  <td className="px-4 py-2 text-right text-green-400 font-semibold">${fmt(inv.capex_m_aud, 0)}</td>
                  <td className="px-4 py-2 text-right text-cyan-400">${fmt(inv.annual_benefit_m_aud, 1)}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{fmtInt(inv.customers_protected)}</td>
                  <td className="px-4 py-2 text-right text-amber-400">{fmt(inv.risk_reduction_pct, 0)}%</td>
                  <td className="px-4 py-2">{investmentStatusBadge(inv.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* KPI Detail Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Resilience KPIs by State &amp; Year
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-750 border-b border-gray-700">
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Year</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">State</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">SAIDI (min)</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">SAIFI</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">MAIFI</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Unserved (MWh)</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Weather %</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Avg Restore (h)</th>
                <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium">Invest ($M)</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.kpi_records.map((kpi: ResilienceKpiRecord, i: number) => (
                <tr
                  key={`${kpi.year}-${kpi.state}`}
                  className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-825'}`}
                >
                  <td className="px-4 py-2 text-gray-300 font-semibold">{kpi.year}</td>
                  <td className="px-4 py-2">{stateBadge(kpi.state)}</td>
                  <td className="px-4 py-2 text-right text-red-400 font-semibold">{fmt(kpi.saidi_minutes, 1)}</td>
                  <td className="px-4 py-2 text-right text-orange-400">{fmt(kpi.saifi_count, 2)}</td>
                  <td className="px-4 py-2 text-right text-amber-400">{fmt(kpi.maifi_count, 2)}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{fmtInt(Math.round(kpi.unserved_energy_mwh))}</td>
                  <td className="px-4 py-2 text-right text-cyan-400">{fmt(kpi.weather_related_pct, 1)}%</td>
                  <td className="px-4 py-2 text-right text-gray-300">{fmt(kpi.avg_restoration_hours, 1)}</td>
                  <td className="px-4 py-2 text-right text-green-400">${fmt(kpi.resilience_investment_m_aud, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
