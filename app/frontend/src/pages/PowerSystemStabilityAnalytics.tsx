import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import {
  getPowerSystemStabilityDashboard,
  PSSTDashboard,
  PSSTVoltageRecord,
  PSSTContingencyRecord,
  PSSTInertiaRecord,
  PSSTFrequencyRecord,
  PSSTStabilityMetricRecord,
} from '../api/client'

const REGION_COLORS: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#34d399',
  VIC1: '#a78bfa',
  SA1:  '#fbbf24',
  TAS1: '#f97316',
}

const STATUS_COLORS: Record<string, string> = {
  NORMAL:    '#34d399',
  WARNING:   '#fbbf24',
  VIOLATION: '#f87171',
}

const SEVERITY_COLORS: Record<string, string> = {
  'N-1': '#fbbf24',
  'N-2': '#f97316',
  'N-3': '#f87171',
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'VIOLATION' ? 'bg-red-900 text-red-300 border border-red-700' :
    status === 'WARNING'   ? 'bg-yellow-900 text-yellow-300 border border-yellow-700' :
    status === 'N-3'       ? 'bg-red-900 text-red-300 border border-red-700' :
    status === 'N-2'       ? 'bg-orange-900 text-orange-300 border border-orange-700' :
    status === 'N-1'       ? 'bg-yellow-900 text-yellow-300 border border-yellow-700' :
                             'bg-green-900 text-green-300 border border-green-700'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{status}</span>
  )
}

// Aggregate inertia profiles by region for the stacked bar chart
function aggregateInertiaByRegion(profiles: PSSTInertiaRecord[]) {
  const map: Record<string, { synchronous: number; synthetic: number; min_req: number; count: number }> = {}
  for (const p of profiles) {
    if (!map[p.region]) map[p.region] = { synchronous: 0, synthetic: 0, min_req: 0, count: 0 }
    map[p.region].synchronous += p.synchronous_inertia_mws
    map[p.region].synthetic += p.synthetic_inertia_mws
    map[p.region].min_req += p.minimum_inertia_req_mws
    map[p.region].count += 1
  }
  return Object.entries(map).map(([region, vals]) => ({
    region,
    synchronous: Math.round(vals.synchronous / vals.count),
    synthetic: Math.round(vals.synthetic / vals.count),
    min_req: Math.round(vals.min_req / vals.count),
  }))
}

// Aggregate stability metrics for the HIGH_RENEWABLES scenario trend line
function aggregateStabilityTrend(metrics: PSSTStabilityMetricRecord[]) {
  const filtered = metrics.filter(m => m.scenario === 'HIGH_RENEWABLES')
  const byYear: Record<number, { total: number; count: number }> = {}
  for (const m of filtered) {
    if (!byYear[m.year]) byYear[m.year] = { total: 0, count: 0 }
    byYear[m.year].total += m.transient_stability_margin_pct
    byYear[m.year].count += 1
  }
  return Object.entries(byYear)
    .map(([year, vals]) => ({
      year: Number(year),
      transient_margin: parseFloat((vals.total / vals.count).toFixed(1)),
    }))
    .sort((a, b) => a.year - b.year)
}

// Prepare scatter data for frequency vs ROCOF
function prepareFreqScatter(events: PSSTFrequencyRecord[]) {
  return events.map(e => ({
    frequency_hz: e.frequency_hz,
    rocof_hz_per_sec: e.rocof_hz_per_sec,
    region: e.region,
  }))
}

export default function PowerSystemStabilityAnalytics() {
  const [data, setData] = useState<PSSTDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPowerSystemStabilityDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400 text-sm">
        Loading Power System Stability data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400 text-sm">
        Failed to load data: {error}
      </div>
    )
  }

  const { summary, voltage_profiles, frequency_events, contingencies, inertia_profiles, stability_metrics } = data

  const inertiaBarData = aggregateInertiaByRegion(inertia_profiles)
  const stabilityTrend = aggregateStabilityTrend(stability_metrics)
  const freqScatterData = prepareFreqScatter(frequency_events)

  // Calculate thermal loading pct for contingencies
  const contingenciesWithLoading: (PSSTContingencyRecord & { thermal_loading_pct: number })[] = contingencies.map(c => ({
    ...c,
    thermal_loading_pct: c.thermal_limit_mw > 0
      ? Math.round((c.post_contingency_flow_mw / c.thermal_limit_mw) * 100)
      : 0,
  }))

  return (
    <div className="p-6 bg-gray-900 min-h-full text-white space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="text-amber-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">Power System Stability Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Voltage stability, transient stability, frequency performance and inertia — Australian NEM
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Voltage Violations"
          value={String(summary.voltage_violations as number)}
          sub={`${summary.voltage_warnings as number} warnings`}
          accent={(summary.voltage_violations as number) > 0 ? 'text-red-400' : 'text-green-400'}
        />
        <KpiCard
          label="Critical Contingencies"
          value={String(summary.critical_contingencies as number)}
          sub={`of ${summary.total_contingencies as number} total`}
          accent={(summary.critical_contingencies as number) > 0 ? 'text-orange-400' : 'text-green-400'}
        />
        <KpiCard
          label="Inertia Shortfall Regions"
          value={String(summary.regions_with_inertia_shortfall as number)}
          sub="regions below minimum"
          accent={(summary.regions_with_inertia_shortfall as number) > 0 ? 'text-yellow-400' : 'text-green-400'}
        />
        <KpiCard
          label="Avg System Strength"
          value={`${summary.avg_system_strength_scr as number} SCR`}
          sub={`Best: ${summary.best_stability_region as string}`}
          accent="text-blue-400"
        />
      </div>

      {/* Voltage Profile Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Voltage Profiles — Key Network Nodes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase text-left">
                <th className="pb-2 pr-4">Node</th>
                <th className="pb-2 pr-4">Region</th>
                <th className="pb-2 pr-4">Voltage (pu)</th>
                <th className="pb-2 pr-4">Voltage (kV)</th>
                <th className="pb-2 pr-4">Deviation (%)</th>
                <th className="pb-2 pr-4">Stability Margin (%)</th>
                <th className="pb-2 pr-4">Contingency pu</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {voltage_profiles.map((v: PSSTVoltageRecord) => (
                <tr key={v.node_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-medium text-white">
                    <div>{v.node_name}</div>
                    <div className="text-gray-500 text-xs">{v.node_id}</div>
                  </td>
                  <td className="py-2 pr-4">
                    <span style={{ color: REGION_COLORS[v.region] ?? '#9ca3af' }}>{v.region}</span>
                  </td>
                  <td className="py-2 pr-4 font-mono">{v.voltage_pu.toFixed(4)}</td>
                  <td className="py-2 pr-4 font-mono">{v.voltage_kv}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${Math.abs(v.voltage_deviation_pct) > 3 ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {v.voltage_deviation_pct > 0 ? '+' : ''}{v.voltage_deviation_pct.toFixed(2)}%
                      </span>
                      <div className="w-16 bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${Math.abs(v.voltage_deviation_pct) > 5 ? 'bg-red-500' : Math.abs(v.voltage_deviation_pct) > 3 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(100, Math.abs(v.voltage_deviation_pct) * 10)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-4 font-mono">{v.voltage_stability_margin_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-4 font-mono">{v.contingency_voltage_pu.toFixed(4)}</td>
                  <td className="py-2">
                    <StatusBadge status={v.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Row: Frequency Scatter + Inertia Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Frequency Events Scatter */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">Frequency Events — Hz vs RoCoF</h2>
          <p className="text-xs text-gray-500 mb-3">Each dot is a frequency event; coloured by region</p>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="frequency_hz"
                type="number"
                domain={[49.3, 50.7]}
                name="Frequency (Hz)"
                label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 11 }}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <YAxis
                dataKey="rocof_hz_per_sec"
                type="number"
                name="RoCoF (Hz/s)"
                label={{ value: 'RoCoF (Hz/s)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#9ca3af' }}
                formatter={(value: number, name: string) => [value.toFixed(4), name]}
              />
              <ReferenceLine x={50.0} stroke="#6b7280" strokeDasharray="4 2" label={{ value: '50 Hz', fill: '#6b7280', fontSize: 10 }} />
              {Object.entries(REGION_COLORS).map(([region, color]) => (
                <Scatter
                  key={region}
                  name={region}
                  data={freqScatterData.filter(d => d.region === region)}
                  fill={color}
                  opacity={0.8}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Inertia Bar Chart */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">Average System Inertia by Region</h2>
          <p className="text-xs text-gray-500 mb-3">Synchronous vs synthetic inertia (MWs); dashed line = minimum requirement</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={inertiaBarData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MWs" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="synchronous" name="Synchronous Inertia" stackId="inertia" fill="#60a5fa" />
              <Bar dataKey="synthetic" name="Synthetic Inertia" stackId="inertia" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              {inertiaBarData.map((entry, idx) => (
                <ReferenceLine
                  key={idx}
                  y={entry.min_req}
                  stroke="#f87171"
                  strokeDasharray="4 2"
                  strokeWidth={1}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-1">Red dashed lines indicate minimum inertia requirements per region</p>
        </div>
      </div>

      {/* Stability Trend Line Chart */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-1">Transient Stability Margin — HIGH_RENEWABLES Scenario</h2>
        <p className="text-xs text-gray-500 mb-3">
          Average transient stability margin (%) across all NEM regions as renewable penetration increases to 2040
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={stabilityTrend} margin={{ top: 10, right: 30, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              unit="%"
              domain={[0, 40]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#9ca3af' }}
            />
            <ReferenceLine y={10} stroke="#fbbf24" strokeDasharray="4 2" label={{ value: 'Min 10%', fill: '#fbbf24', fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey="transient_margin"
              name="Transient Stability Margin (%)"
              stroke="#34d399"
              strokeWidth={2}
              dot={{ fill: '#34d399', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Contingency Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Contingency Analysis — N-1/N-2/N-3 Events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase text-left">
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Description</th>
                <th className="pb-2 pr-4">Region</th>
                <th className="pb-2 pr-4">Severity</th>
                <th className="pb-2 pr-4">Pre-cont. Flow</th>
                <th className="pb-2 pr-4">Post-cont. Flow</th>
                <th className="pb-2 pr-4">Thermal Loading</th>
                <th className="pb-2 pr-4">Freq Dev (Hz)</th>
                <th className="pb-2 pr-4">V Recovery (s)</th>
                <th className="pb-2">Remedial Action</th>
              </tr>
            </thead>
            <tbody>
              {contingenciesWithLoading.map(c => (
                <tr key={c.contingency_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-mono text-gray-400">{c.contingency_id}</td>
                  <td className="py-2 pr-4 text-white max-w-xs">{c.description}</td>
                  <td className="py-2 pr-4">
                    <span style={{ color: REGION_COLORS[c.region] ?? '#9ca3af' }}>{c.region}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={c.severity} />
                  </td>
                  <td className="py-2 pr-4 font-mono">{c.pre_contingency_flow_mw.toFixed(0)} MW</td>
                  <td className="py-2 pr-4 font-mono">{c.post_contingency_flow_mw.toFixed(0)} MW</td>
                  <td className="py-2 pr-4">
                    {c.thermal_limit_mw > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className={`font-mono ${c.thermal_loading_pct > 100 ? 'text-red-400' : c.thermal_loading_pct > 80 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {c.thermal_loading_pct}%
                        </span>
                        <div className="w-12 bg-gray-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${c.thermal_loading_pct > 100 ? 'bg-red-500' : c.thermal_loading_pct > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, c.thermal_loading_pct)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 font-mono text-orange-400">{c.frequency_deviation_hz.toFixed(2)}</td>
                  <td className="py-2 pr-4 font-mono">{c.voltage_recovery_sec.toFixed(1)}s</td>
                  <td className="py-2">
                    {c.remedial_action ? (
                      <span className="bg-blue-900 text-blue-300 border border-blue-700 px-2 py-0.5 rounded text-xs">
                        {c.remedial_action}
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
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
