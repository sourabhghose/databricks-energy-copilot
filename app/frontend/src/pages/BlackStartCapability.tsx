import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { ShieldAlert } from 'lucide-react'
import { getBlackStartDashboard, BlackStartDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------
const ADEQUACY_BADGE: Record<string, string> = {
  ADEQUATE:   'bg-green-900/50 border border-green-700 text-green-300',
  MARGINAL:   'bg-amber-900/50 border border-amber-700 text-amber-300',
  INADEQUATE: 'bg-red-900/50 border border-red-700 text-red-300',
}

const CAPABILITY_BADGE: Record<string, string> = {
  FULL:    'bg-green-900/50 border border-green-700 text-green-300',
  PARTIAL: 'bg-amber-900/50 border border-amber-700 text-amber-300',
  NONE:    'bg-red-900/50 border border-red-700 text-red-300',
}

const CONTRACT_BADGE: Record<string, string> = {
  MARKET:     'bg-indigo-900/50 border border-indigo-700 text-indigo-300',
  CONTRACTED: 'bg-cyan-900/50 border border-cyan-700 text-cyan-300',
  MANDATORY:  'bg-purple-900/50 border border-purple-700 text-purple-300',
}

const TECH_BADGE: Record<string, string> = {
  'Open Cycle Gas Turbine':     'bg-orange-900/50 border border-orange-700 text-orange-300',
  'Combined Cycle Gas Turbine': 'bg-yellow-900/50 border border-yellow-700 text-yellow-300',
  'Hydro':                      'bg-blue-900/50 border border-blue-700 text-blue-300',
  'Coal Steam':                 'bg-stone-800/60 border border-stone-600 text-stone-300',
  'Synchronous Condenser':      'bg-teal-900/50 border border-teal-700 text-teal-300',
}

const COMPLIANCE_COLORS: Record<string, string> = {
  COMPLIANT:     'text-green-400',
  NON_COMPLIANT: 'text-red-400',
}

const SCENARIO_COLORS: Record<string, string> = {
  BEST_CASE:  '#10b981',
  WORST_CASE: '#ef4444',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(n: number, d = 0) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function badge(cls: string, label: string) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI computation
// ---------------------------------------------------------------------------
function computeKpis(data: BlackStartDashboard) {
  const totalBSMw = data.restart_zones.reduce((s, z) => s + z.total_black_start_mw, 0)
  const adequateZones = data.restart_zones.filter(z => z.adequacy_status === 'ADEQUATE').length
  const fastestRestore = Math.min(...data.restart_zones.map(z => z.estimated_restore_hours))
  const inadequateStrength = data.system_strength.filter(
    s => s.system_strength_status === 'INADEQUATE',
  ).length
  return { totalBSMw, adequateZones, fastestRestore, inadequateStrength }
}

// ---------------------------------------------------------------------------
// Restore progress chart data
// ---------------------------------------------------------------------------
function buildRestoreChartData(data: BlackStartDashboard) {
  const hours = [...new Set(data.restore_progress.map(r => r.hour))].sort((a, b) => a - b)
  return hours.map(h => {
    const records = data.restore_progress.filter(r => r.hour === h)
    const entry: Record<string, number | string> = { hour: `H${h}` }
    for (const r of records) {
      entry[r.scenario] = r.restored_load_pct
    }
    return entry
  })
}

// ---------------------------------------------------------------------------
// Strength bar chart data
// ---------------------------------------------------------------------------
function buildStrengthData(data: BlackStartDashboard) {
  return data.system_strength.map(s => ({
    region: s.region.replace('1', ''),
    fault_level: s.fault_level_mva,
    minimum: s.minimum_fault_level_mva,
    status: s.system_strength_status,
  }))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function BlackStartCapability() {
  const [data, setData] = useState<BlackStartDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBlackStartDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading black start analytics…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  const kpis = computeKpis(data)
  const restoreChartData = buildRestoreChartData(data)
  const strengthData = buildStrengthData(data)

  return (
    <div className="p-6 space-y-8 bg-gray-950 min-h-screen text-gray-100">

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-3">
        <ShieldAlert className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Black Start &amp; System Restart Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            NEM black start capability, restart zones, cranking paths and system strength — as at{' '}
            {new Date(data.timestamp).toLocaleString('en-AU')}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* KPI cards                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total BS Capacity</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{fmt(kpis.totalBSMw)} MW</p>
          <p className="text-xs text-gray-500 mt-1">across {data.restart_zones.length} restart zones</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Zones Assessed ADEQUATE</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">
            {kpis.adequateZones} / {data.restart_zones.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">zones meeting adequacy criteria</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Fastest Restore Est.</p>
          <p className="text-3xl font-bold text-cyan-400 mt-1">{kpis.fastestRestore} hrs</p>
          <p className="text-xs text-gray-500 mt-1">best-case zone restoration time</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Strength INADEQUATE</p>
          <p className={`text-3xl font-bold mt-1 ${kpis.inadequateStrength > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {kpis.inadequateStrength}
          </p>
          <p className="text-xs text-gray-500 mt-1">NEM regions below minimum fault level</p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Restart zone cards                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Restart Zones</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.restart_zones.map(zone => (
            <div
              key={zone.zone_id}
              className="bg-gray-900 rounded-xl border border-gray-700 p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-100 text-sm">{zone.zone_id}</p>
                  <p className="text-xs text-gray-400">{zone.region}</p>
                </div>
                {badge(ADEQUACY_BADGE[zone.adequacy_status] ?? '', zone.adequacy_status)}
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Anchor Units</p>
                <div className="flex flex-wrap gap-1">
                  {zone.anchor_units.map(u => (
                    <span key={u} className="text-xs bg-gray-800 border border-gray-600 text-gray-300 px-2 py-0.5 rounded">
                      {u}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cranking Path</p>
                <p className="text-xs text-gray-300">{zone.cranking_path}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800">
                <div>
                  <p className="text-xs text-gray-500">BS Capacity</p>
                  <p className="text-sm font-bold text-green-400">{fmt(zone.total_black_start_mw)} MW</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Est. Restore</p>
                  <p className="text-sm font-bold text-cyan-400">{zone.estimated_restore_hours} hrs</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Zone Load</p>
                  <p className="text-sm font-bold text-gray-300">{fmt(zone.zone_load_mw)} MW</p>
                </div>
              </div>

              <p className="text-xs text-gray-600">Last tested: {zone.last_tested_date}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Black start unit table                                              */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Black Start Units</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-700">
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wider">Unit</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wider">Technology</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wider">Region</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wider">Capability</th>
                <th className="px-4 py-3 text-right text-xs text-gray-400 uppercase tracking-wider">Cranking MW</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wider">Self-Excit.</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wider">Contract</th>
                <th className="px-4 py-3 text-right text-xs text-gray-400 uppercase tracking-wider">Value M$/yr</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wider">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {data.black_start_units.map((u, idx) => (
                <tr
                  key={u.unit_id}
                  className={`border-b border-gray-800 ${idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/50'} hover:bg-gray-800/60 transition-colors`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-200">{u.unit_name}</p>
                    <p className="text-xs text-gray-500">{u.unit_id}</p>
                  </td>
                  <td className="px-4 py-3">
                    {badge(TECH_BADGE[u.technology] ?? 'bg-gray-800 border border-gray-600 text-gray-300', u.technology)}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{u.region}</td>
                  <td className="px-4 py-3">
                    {badge(CAPABILITY_BADGE[u.black_start_capability] ?? '', u.black_start_capability)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-200">
                    {u.cranking_power_mw > 0 ? fmt(u.cranking_power_mw) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={u.self_excitation ? 'text-green-400' : 'text-gray-500'}>
                      {u.self_excitation ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {badge(CONTRACT_BADGE[u.contract_type] ?? '', u.contract_type)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-200">
                    {u.contract_value_m_aud_yr > 0 ? fmt(u.contract_value_m_aud_yr, 1) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${COMPLIANCE_COLORS[u.test_compliance] ?? 'text-gray-400'}`}>
                      {u.test_compliance.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* System strength table + bar chart                                   */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-4">System Strength Status</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wider">Region</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-400 uppercase tracking-wider">Fault Level MVA</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-400 uppercase tracking-wider">Min Required</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-400 uppercase tracking-wider">IBR %</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wider">Providers</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.system_strength.map((s, idx) => (
                  <tr
                    key={s.region}
                    className={`border-b border-gray-800 ${idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/50'} hover:bg-gray-800/60 transition-colors`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-200">{s.region}</td>
                    <td className={`px-4 py-3 text-right font-bold ${
                      s.fault_level_mva >= s.minimum_fault_level_mva ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {fmt(s.fault_level_mva)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{fmt(s.minimum_fault_level_mva)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      s.inverter_based_resources_pct > 60 ? 'text-amber-400' : 'text-gray-300'
                    }`}>
                      {s.inverter_based_resources_pct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.strength_providers.slice(0, 2).map(p => (
                          <span key={p} className="text-xs bg-gray-800 border border-gray-600 text-gray-300 px-1.5 py-0.5 rounded">
                            {p}
                          </span>
                        ))}
                        {s.strength_providers.length > 2 && (
                          <span className="text-xs text-gray-500">+{s.strength_providers.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {badge(ADEQUACY_BADGE[s.system_strength_status] ?? '', s.system_strength_status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar chart — fault level vs minimum */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">
              Fault Level vs Minimum Requirement (MVA)
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={strengthData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(1)}k`} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#e5e7eb' }}
                  itemStyle={{ color: '#d1d5db' }}
                  formatter={(v: number) => [`${fmt(v)} MVA`]}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                <Bar dataKey="fault_level" name="Current Fault Level" radius={[4, 4, 0, 0]}>
                  {strengthData.map(entry => (
                    <Cell
                      key={entry.region}
                      fill={
                        entry.status === 'ADEQUATE'   ? '#10b981' :
                        entry.status === 'MARGINAL'   ? '#f59e0b' : '#ef4444'
                      }
                    />
                  ))}
                </Bar>
                <Bar dataKey="minimum" name="Minimum Required" fill="#374151" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* System restore progress chart                                       */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-4">System Restore Progress — Scenario Comparison</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
          <p className="text-xs text-gray-400 mb-4">
            Percentage of NEM load restored over 10 hours under best-case and worst-case restart scenarios.
          </p>
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={restoreChartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="hour"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                label={{ value: 'Hours post-event', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                tickFormatter={v => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`${v.toFixed(1)}%`, undefined]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="4 4" label={{ value: '50% target', fill: '#6b7280', fontSize: 10 }} />
              <ReferenceLine y={80} stroke="#4b5563" strokeDasharray="4 4" label={{ value: '80% target', fill: '#4b5563', fontSize: 10 }} />
              {['BEST_CASE', 'WORST_CASE'].map(scenario => (
                <Line
                  key={scenario}
                  type="monotone"
                  dataKey={scenario}
                  name={scenario.replace('_', ' ')}
                  stroke={SCENARIO_COLORS[scenario]}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: SCENARIO_COLORS[scenario] }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

    </div>
  )
}
