import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getFrequencyControlPerformanceDashboard,
  FCPDashboard,
  FCPFrequencyRecord,
  FCPProviderRecord,
  FCPEventRecord,
  FCPComplianceRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const KPI_CARD_BG = 'bg-gray-800 border border-gray-700 rounded-lg p-4'

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={KPI_CARD_BG}>
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">
      {title}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// Frequency Band Distribution — BarChart (% time in each band by region)
// ---------------------------------------------------------------------------
function FrequencyBandSection({ records }: { records: FCPFrequencyRecord[] }) {
  // Average across all months per region
  const regionMap: Record<string, { normal: number[]; above: number[]; below: number[] }> = {}
  for (const r of records) {
    if (!regionMap[r.region]) regionMap[r.region] = { normal: [], above: [], below: [] }
    regionMap[r.region].normal.push(r.time_in_normal_band_pct)
    regionMap[r.region].above.push(r.time_above_50_15_pct)
    regionMap[r.region].below.push(r.time_below_49_85_pct)
  }
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const chartData = Object.entries(regionMap).map(([region, v]) => ({
    region,
    'Normal Band (49.85-50.15 Hz)': parseFloat(avg(v.normal).toFixed(2)),
    'Above 50.15 Hz': parseFloat(avg(v.above).toFixed(2)),
    'Below 49.85 Hz': parseFloat(avg(v.below).toFixed(2)),
  }))

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <SectionHeader title="Frequency Band Distribution by Region (2024 Annual Average)" />
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#F9FAFB' }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number) => [`${v.toFixed(2)}%`]}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
          <Bar dataKey="Normal Band (49.85-50.15 Hz)" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Above 50.15 Hz" stackId="a" fill="#F59E0B" />
          <Bar dataKey="Below 49.85 Hz" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Event Timeline — color-coded table
// ---------------------------------------------------------------------------
const EVENT_TYPE_COLORS: Record<string, string> = {
  UNDER_FREQUENCY: 'bg-red-900 text-red-300',
  OVER_FREQUENCY: 'bg-amber-900 text-amber-300',
  CREDIBLE_CONTINGENCY: 'bg-blue-900 text-blue-300',
  NON_CREDIBLE: 'bg-purple-900 text-purple-300',
}

function EventTimelineSection({ events }: { events: FCPEventRecord[] }) {
  const sorted = [...events].sort((a, b) => b.datetime.localeCompare(a.datetime))
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <SectionHeader title="Frequency Event Timeline" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-3">Event ID</th>
              <th className="text-left py-2 pr-3">Date / Time</th>
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-left py-2 pr-3">Type</th>
              <th className="text-left py-2 pr-3">Trigger</th>
              <th className="text-right py-2 pr-3">Nadir (Hz)</th>
              <th className="text-right py-2 pr-3">Recovery (s)</th>
              <th className="text-right py-2 pr-3">UFLS</th>
              <th className="text-right py-2 pr-3">Shed (MWh)</th>
              <th className="text-right py-2">FCAS (MW)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ev) => (
              <tr key={ev.event_id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-3 text-gray-300 font-mono text-xs">{ev.event_id}</td>
                <td className="py-2 pr-3 text-gray-300 text-xs whitespace-nowrap">{ev.datetime.replace('T', ' ')}</td>
                <td className="py-2 pr-3 text-gray-400">{ev.region}</td>
                <td className="py-2 pr-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_COLORS[ev.event_type] ?? 'bg-gray-700 text-gray-300'}`}>
                    {ev.event_type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-400 text-xs">{ev.trigger.replace(/_/g, ' ')}</td>
                <td className="py-2 pr-3 text-right text-red-400 font-mono">{ev.frequency_nadir_hz.toFixed(3)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{ev.recovery_time_sec.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right">
                  {ev.ufls_activated
                    ? <span className="text-red-400 font-semibold">YES</span>
                    : <span className="text-green-500">NO</span>}
                </td>
                <td className="py-2 pr-3 text-right text-amber-400">{ev.energy_shed_mwh.toFixed(0)}</td>
                <td className="py-2 text-right text-blue-400">{ev.fcas_response_mw.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Provider Performance — ranked table with compliance scores
// ---------------------------------------------------------------------------
function scoreColor(score: number) {
  if (score >= 90) return 'text-green-400'
  if (score >= 75) return 'text-amber-400'
  return 'text-red-400'
}

function ProviderPerformanceSection({ providers }: { providers: FCPProviderRecord[] }) {
  const sorted = [...providers].sort((a, b) => b.performance_score - a.performance_score)
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <SectionHeader title="FCAS Provider Performance (Ranked)" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-3">Rank</th>
              <th className="text-left py-2 pr-3">Provider</th>
              <th className="text-left py-2 pr-3">Technology</th>
              <th className="text-left py-2 pr-3">Service</th>
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-right py-2 pr-3">Reg. MW</th>
              <th className="text-right py-2 pr-3">Avg Enabled MW</th>
              <th className="text-right py-2 pr-3">Enablement %</th>
              <th className="text-right py-2 pr-3">Compliance %</th>
              <th className="text-right py-2 pr-3">Revenue $/MWh</th>
              <th className="text-right py-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.provider_id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-3 text-gray-500 font-mono">#{i + 1}</td>
                <td className="py-2 pr-3 text-white font-medium">{p.company}</td>
                <td className="py-2 pr-3 text-gray-400 text-xs">{p.technology}</td>
                <td className="py-2 pr-3 text-xs text-blue-400 font-mono">{p.service.replace(/_/g, ' ')}</td>
                <td className="py-2 pr-3 text-gray-400">{p.region}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{p.registered_mw.toFixed(0)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{p.avg_enabled_mw.toFixed(0)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{p.enablement_rate_pct.toFixed(1)}%</td>
                <td className="py-2 pr-3 text-right text-green-400">{p.compliance_rate_pct.toFixed(1)}%</td>
                <td className="py-2 pr-3 text-right text-gray-300">${p.avg_revenue_per_mw_hr.toFixed(2)}</td>
                <td className={`py-2 text-right font-bold ${scoreColor(p.performance_score)}`}>
                  {p.performance_score.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FCAS Bandwidth Costs — Stacked BarChart monthly (NSW as default region)
// ---------------------------------------------------------------------------
type BWRecord = FCPDashboard['bandwidth_costs'][number]

function BandwidthCostsSectionImpl({ records }: { records: BWRecord[] }) {
  const [selectedRegion, setSelectedRegion] = useState('NSW')
  const regions = [...new Set(records.map((r) => r.region))].sort()
  const chartData = records
    .filter((r) => r.region === selectedRegion)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({
      month: r.month.slice(5),
      'Raise 6s': r.raise_6sec_cost_m,
      'Raise 60s': r.raise_60sec_cost_m,
      'Raise 5m': r.raise_5min_cost_m,
      'Lower 6s': r.lower_6sec_cost_m,
      'Lower 60s': r.lower_60sec_cost_m,
      'Lower 5m': r.lower_5min_cost_m,
      'Cont. Raise': r.contingency_raise_cost_m,
      'Cont. Lower': r.contingency_lower_cost_m,
    }))

  const STACK_COLORS = ['#10B981', '#34D399', '#6EE7B7', '#3B82F6', '#60A5FA', '#93C5FD', '#F59E0B', '#FBBF24']
  const keys = ['Raise 6s', 'Raise 60s', 'Raise 5m', 'Lower 6s', 'Lower 60s', 'Lower 5m', 'Cont. Raise', 'Cont. Lower']

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="FCAS Bandwidth Costs — Monthly 2024 ($M)" />
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm"
        >
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
          <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} unit="M" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#F9FAFB' }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number) => [`$${v.toFixed(2)}M`]}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 11 }} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={STACK_COLORS[i]}
              radius={i === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compliance Heatmap — color-coded table GREEN/AMBER/RED
// ---------------------------------------------------------------------------
const FLAG_STYLE: Record<string, string> = {
  GREEN: 'bg-green-900 text-green-300 border border-green-700',
  AMBER: 'bg-amber-900 text-amber-300 border border-amber-700',
  RED:   'bg-red-900 text-red-300 border border-red-700',
}

function ComplianceHeatSection({ compliance }: { compliance: FCPComplianceRecord[] }) {
  const providers = [...new Set(compliance.map((c) => c.company))]
  const quarters  = [...new Set(compliance.map((c) => c.quarter))].sort()

  // Build lookup: company -> quarter -> record
  const lookup: Record<string, Record<string, FCPComplianceRecord>> = {}
  for (const c of compliance) {
    if (!lookup[c.company]) lookup[c.company] = {}
    lookup[c.company][c.quarter] = c
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <SectionHeader title="Causer Pays Compliance Heatmap — 2024" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-4">Provider</th>
              <th className="text-left py-2 pr-4">Service</th>
              {quarters.map((q) => (
                <th key={q} className="text-center py-2 px-3">{q}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {providers.map((company) => {
              const firstRec = compliance.find((c) => c.company === company)
              return (
                <tr key={company} className="border-b border-gray-700">
                  <td className="py-3 pr-4 text-white font-medium whitespace-nowrap">{company}</td>
                  <td className="py-3 pr-4 text-xs text-blue-400 font-mono whitespace-nowrap">
                    {firstRec?.service.replace(/_/g, ' ')}
                  </td>
                  {quarters.map((q) => {
                    const rec = lookup[company]?.[q]
                    if (!rec) return <td key={q} className="py-3 px-3 text-center text-gray-600">—</td>
                    return (
                      <td key={q} className="py-3 px-3 text-center">
                        <div className={`inline-block px-3 py-1 rounded text-xs font-semibold ${FLAG_STYLE[rec.performance_flag] ?? 'bg-gray-700 text-gray-300'}`}>
                          <div>{rec.performance_flag}</div>
                          <div className="text-[10px] mt-0.5 opacity-75">
                            {rec.non_compliance_events} evt
                            {rec.causer_pays_charge_k > 0 && ` · $${rec.causer_pays_charge_k.toFixed(0)}k`}
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function FrequencyControlPerformanceAnalytics() {
  const [data, setData] = useState<FCPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFrequencyControlPerformanceDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-lg">
        Loading Frequency Control Performance data...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-lg">
        Error: {error ?? 'No data available'}
      </div>
    )
  }

  const s = data.summary as Record<string, unknown>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          NEM Frequency Control Performance Analytics
        </h1>
        <p className="text-gray-400 mt-2 text-sm">
          FCAS compliance, frequency band adherence, event history and causer pays performance
          across the National Electricity Market — 2024
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <KpiCard
          label="Avg Time in Normal Band"
          value={`${s['avg_time_in_normal_band_pct']}%`}
          sub="49.85–50.15 Hz"
        />
        <KpiCard
          label="Total FCAS Cost 2024"
          value={`$${s['total_fcas_cost_2024_m']}M`}
          sub="All services"
        />
        <KpiCard
          label="Contingency Events 2024"
          value={String(s['contingency_events_2024'])}
          sub="Credible + Non-credible"
        />
        <KpiCard
          label="Best Performer"
          value={String(s['best_performer'])}
          sub="By performance score"
        />
        <KpiCard
          label="Registered Providers"
          value={String(s['total_registered_providers'])}
          sub="Across all services"
        />
        <KpiCard
          label="Avg Compliance Rate"
          value={`${s['avg_compliance_rate_pct']}%`}
          sub="Causer pays metric"
        />
      </div>

      {/* Frequency Band Distribution */}
      <FrequencyBandSection records={data.frequency_performance} />

      {/* FCAS Bandwidth Costs */}
      <BandwidthCostsSectionImpl records={data.bandwidth_costs} />

      {/* Provider Performance */}
      <ProviderPerformanceSection providers={data.providers} />

      {/* Compliance Heatmap */}
      <ComplianceHeatSection compliance={data.compliance} />

      {/* Event Timeline */}
      <EventTimelineSection events={data.events} />
    </div>
  )
}
