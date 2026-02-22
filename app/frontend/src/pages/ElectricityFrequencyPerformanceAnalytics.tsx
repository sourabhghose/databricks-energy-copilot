import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  getElectricityFrequencyPerformanceDashboard,
  EFPADashboard,
  EFPAFrequencyRecord,
  EFPAEventRecord,
  EFPAStandardRecord,
  EFPAInertiaRecord,
  EFPAFCASPerformanceRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function kpiCard(title: string, value: string | number, sub: string, accent: string) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{title}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      <span className="text-xs text-gray-500">{sub}</span>
    </div>
  )
}

function TrendBadge({ trend }: { trend: string }) {
  const colours: Record<string, string> = {
    Improving: 'bg-green-900 text-green-300',
    Stable: 'bg-gray-700 text-gray-300',
    Deteriorating: 'bg-red-900 text-red-300',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colours[trend] ?? 'bg-gray-700 text-gray-300'}`}>
      {trend}
    </span>
  )
}

function ComplianceBadge({ ok }: { ok: boolean }) {
  return ok
    ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-900 text-green-300">Compliant</span>
    : <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-900 text-red-300">Non-Compliant</span>
}

function SeverityBadge({ impact }: { impact: number }) {
  if (impact >= 50) return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-900 text-red-300">Critical</span>
  if (impact >= 20) return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-orange-900 text-orange-300">High</span>
  if (impact >= 5)  return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-yellow-900 text-yellow-300">Medium</span>
  return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">Low</span>
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function ElectricityFrequencyPerformanceAnalytics() {
  const [data, setData] = useState<EFPADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState('NSW1')

  useEffect(() => {
    getElectricityFrequencyPerformanceDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-6 text-red-300 max-w-md text-center">
          <Activity size={32} className="mx-auto mb-3 text-red-400" />
          <p className="font-semibold">Failed to load dashboard</p>
          <p className="text-sm mt-1 text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Activity size={22} className="animate-pulse text-blue-400" />
          <span>Loading Electricity Frequency Performance data…</span>
        </div>
      </div>
    )
  }

  const summary = data.summary
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

  // -- Frequency Line Chart data for selected region --
  const freqForRegion: EFPAFrequencyRecord[] = data.frequency_records
    .filter(r => r.region === selectedRegion)
    .sort((a, b) => a.measurement_date.localeCompare(b.measurement_date) || a.hour - b.hour)
  const freqChartData = freqForRegion.map((r, i) => ({
    label: `${r.measurement_date} H${r.hour}`,
    avg: r.avg_frequency_hz,
    min: r.min_frequency_hz,
    max: r.max_frequency_hz,
    index: i,
  }))

  // -- Inertia Bar Chart data per region (latest record) --
  const latestInertiaByRegion: Record<string, EFPAInertiaRecord> = {}
  for (const rec of data.inertia_records) {
    const prev = latestInertiaByRegion[rec.region]
    if (!prev || rec.date > prev.date) latestInertiaByRegion[rec.region] = rec
  }
  const inertiaBarData = regions.map(r => {
    const rec = latestInertiaByRegion[r]
    return {
      region: r,
      total: rec ? rec.total_inertia_mws : 0,
      threshold: rec ? rec.ms_threshold_mws : 0,
      met: rec ? rec.min_inertia_threshold_met : true,
    }
  })

  // -- FCAS enabled vs activated by service type (all regions aggregated) --
  const fcasMap: Record<string, { enabled: number; activated: number }> = {}
  for (const rec of data.fcas_performance) {
    if (!fcasMap[rec.service_type]) fcasMap[rec.service_type] = { enabled: 0, activated: 0 }
    fcasMap[rec.service_type].enabled += rec.enabled_mw
    fcasMap[rec.service_type].activated += rec.activated_mw
  }
  const fcasBarData = Object.entries(fcasMap).map(([svc, v]) => ({
    service: svc,
    enabled: Math.round(v.enabled),
    activated: Math.round(v.activated),
  }))

  // -- Event count by type and year --
  const eventYears = ['2022', '2023', '2024']
  const eventTypes = ['Under-frequency', 'Over-frequency', 'ROCOF Exceedance',
    'Separation Event', 'Near-miss', 'LOR3 Frequency']
  const eventMap: Record<string, Record<string, number>> = {}
  for (const ev of data.events) {
    const yr = ev.event_date.slice(0, 4)
    if (!eventMap[ev.event_type]) eventMap[ev.event_type] = {}
    eventMap[ev.event_type][yr] = (eventMap[ev.event_type][yr] ?? 0) + 1
  }
  const eventBarData = eventTypes.map(et => {
    const entry: Record<string, number | string> = { type: et.length > 12 ? et.slice(0, 12) + '…' : et }
    for (const yr of eventYears) entry[yr] = eventMap[et]?.[yr] ?? 0
    return entry
  })

  // Notable events (top 8 by market impact)
  const notableEvents: EFPAEventRecord[] = [...data.events]
    .sort((a, b) => b.market_impact_m - a.market_impact_m)
    .slice(0, 8)

  const YEAR_COLOURS: Record<string, string> = {
    '2022': '#60a5fa',
    '2023': '#34d399',
    '2024': '#f59e0b',
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-900/50 rounded-lg border border-blue-700">
          <Activity size={22} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Electricity Frequency Performance Analytics</h1>
          <p className="text-sm text-gray-400">NEM frequency monitoring, inertia management and standards compliance</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpiCard(
          'Regions Below Inertia Threshold',
          String(summary['regions_below_inertia_threshold']),
          'of 5 NEM regions',
          'text-red-400',
        )}
        {kpiCard(
          'Frequency Exceedances YTD',
          String(summary['frequency_exceedances_ytd']),
          'outside 49.5–50.5 Hz band',
          'text-orange-400',
        )}
        {kpiCard(
          'Avg Normal Band %',
          `${Number(summary['avg_normal_band_pct']).toFixed(1)}%`,
          'time in 49.85–50.15 Hz',
          'text-green-400',
        )}
        {kpiCard(
          'FCAS Cost YTD',
          `$${Number(summary['fcas_cost_ytd_m']).toFixed(1)}M`,
          'ancillary services expenditure',
          'text-blue-400',
        )}
      </div>

      {/* Row 1: Frequency Distribution Line Chart + Inertia Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Frequency Distribution */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-200">Frequency Distribution by Time Period</h2>
            <select
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
            >
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={freqChartData} margin={{ top: 4, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis domain={[49.4, 50.6]} tick={{ fill: '#9ca3af', fontSize: 10 }} tickCount={7} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb', fontSize: 11 }}
                itemStyle={{ fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <ReferenceLine y={50.15} stroke="#22c55e" strokeDasharray="4 4" label={{ value: '50.15', fill: '#22c55e', fontSize: 9 }} />
              <ReferenceLine y={49.85} stroke="#22c55e" strokeDasharray="4 4" label={{ value: '49.85', fill: '#22c55e', fontSize: 9 }} />
              <ReferenceLine y={50.5}  stroke="#ef4444" strokeDasharray="4 4" label={{ value: '50.5', fill: '#ef4444', fontSize: 9 }} />
              <ReferenceLine y={49.5}  stroke="#ef4444" strokeDasharray="4 4" label={{ value: '49.5', fill: '#ef4444', fontSize: 9 }} />
              <Line type="monotone" dataKey="avg" stroke="#60a5fa" strokeWidth={2} dot={false} name="Avg Hz" />
              <Line type="monotone" dataKey="min" stroke="#f87171" strokeWidth={1.5} dot={false} name="Min Hz" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="max" stroke="#34d399" strokeWidth={1.5} dot={false} name="Max Hz" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Inertia by Region */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">System Inertia vs Minimum Threshold by Region</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={inertiaBarData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} unit=" MWs" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb', fontSize: 11 }}
                itemStyle={{ fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {inertiaBarData.map(d => null)}
              <Bar
                dataKey="total"
                name="Total Inertia (MWs)"
                radius={[3, 3, 0, 0]}
                fill="#60a5fa"
                label={{ position: 'top', fill: '#9ca3af', fontSize: 9 }}
              >
                {inertiaBarData.map((entry, index) => (
                  <rect key={`cell-${index}`} fill={entry.met ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
              <Bar dataKey="threshold" name="Min Threshold (MWs)" fill="#f59e0b" opacity={0.7} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-1">Green = threshold met, Red = below threshold</p>
        </div>
      </div>

      {/* Row 2: FCAS enabled vs activated + Event count by type/year */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* FCAS Performance */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">FCAS Enabled vs Activated MW by Service Type (All Regions)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={fcasBarData} margin={{ top: 4, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="service" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} unit=" MW" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb', fontSize: 11 }}
                itemStyle={{ fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="enabled"   name="Enabled MW"   fill="#60a5fa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="activated" name="Activated MW"  fill="#34d399" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Event Count by Type and Year */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Frequency Event Count by Type and Year</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={eventBarData} margin={{ top: 4, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb', fontSize: 11 }}
                itemStyle={{ fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {eventYears.map(yr => (
                <Bar key={yr} dataKey={yr} name={yr} fill={YEAR_COLOURS[yr]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Standards Compliance Table */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Frequency Standards Compliance Status</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-2 pr-3">Standard</th>
                <th className="text-left py-2 pr-3">Category</th>
                <th className="text-left py-2 pr-3">Parameter</th>
                <th className="text-right py-2 pr-3">Target</th>
                <th className="text-right py-2 pr-3">Current</th>
                <th className="text-center py-2 pr-3">Status</th>
                <th className="text-center py-2 pr-3">Trend</th>
                <th className="text-right py-2 pr-3">Breaches YTD</th>
                <th className="text-right py-2">Last Breach</th>
              </tr>
            </thead>
            <tbody>
              {data.standards.map((s: EFPAStandardRecord) => (
                <tr key={s.standard_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-3 font-medium text-gray-200">{s.standard_name}</td>
                  <td className="py-2 pr-3 text-gray-400">{s.standard_category}</td>
                  <td className="py-2 pr-3 text-gray-400 max-w-[160px] truncate">{s.parameter}</td>
                  <td className="py-2 pr-3 text-right">{s.target_value} {s.unit.split(' ')[0]}</td>
                  <td className="py-2 pr-3 text-right font-mono">{s.current_performance}</td>
                  <td className="py-2 pr-3 text-center"><ComplianceBadge ok={s.compliance} /></td>
                  <td className="py-2 pr-3 text-center"><TrendBadge trend={s.performance_trend} /></td>
                  <td className={`py-2 pr-3 text-right font-bold ${s.breach_count_ytd > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {s.breach_count_ytd}
                  </td>
                  <td className="py-2 text-right text-gray-500">{s.last_breach_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4: Notable Events Table */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Notable Frequency Events (Top 8 by Market Impact)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-2 pr-3">Event ID</th>
                <th className="text-left py-2 pr-3">Date</th>
                <th className="text-left py-2 pr-3">Type</th>
                <th className="text-left py-2 pr-3">Region</th>
                <th className="text-right py-2 pr-3">Nadir Hz</th>
                <th className="text-right py-2 pr-3">ROCOF Hz/s</th>
                <th className="text-right py-2 pr-3">Recovery (s)</th>
                <th className="text-right py-2 pr-3">IBR %</th>
                <th className="text-left py-2 pr-3">Causal Plant</th>
                <th className="text-center py-2 pr-3">UFLS</th>
                <th className="text-center py-2 pr-3">Severity</th>
                <th className="text-right py-2">Impact ($M)</th>
              </tr>
            </thead>
            <tbody>
              {notableEvents.map((ev: EFPAEventRecord) => (
                <tr key={ev.event_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-3 font-mono text-gray-400">{ev.event_id}</td>
                  <td className="py-2 pr-3">{ev.event_date}</td>
                  <td className="py-2 pr-3 text-blue-300">{ev.event_type}</td>
                  <td className="py-2 pr-3">{ev.region}</td>
                  <td className="py-2 pr-3 text-right font-mono">{ev.nadir_hz.toFixed(3)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{ev.initial_rocof_hz_per_s.toFixed(3)}</td>
                  <td className="py-2 pr-3 text-right">{ev.recovery_time_seconds.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right">{ev.ibr_penetration_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-3 text-yellow-300">{ev.causal_plant}</td>
                  <td className="py-2 pr-3 text-center">
                    {ev.ufls_triggered
                      ? <span className="text-red-400 font-bold">Yes</span>
                      : <span className="text-gray-500">No</span>}
                  </td>
                  <td className="py-2 pr-3 text-center"><SeverityBadge impact={ev.market_impact_m} /></td>
                  <td className="py-2 text-right font-bold text-orange-300">{ev.market_impact_m.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
