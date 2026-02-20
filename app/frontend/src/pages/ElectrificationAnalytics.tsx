// Sprint 59a — Building Electrification & Heat Pump Analytics

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { Flame } from 'lucide-react'
import {
  getElectrificationDashboard,
  ElectrificationDashboard,
  BEAAdoptionRecord,
  BEALoadImpactRecord,
  BEAGasNetworkRecord,
  BEAProgramRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const STATE_COLOURS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#34d399',
  QLD: '#fbbf24',
  SA:  '#f87171',
  WA:  '#a78bfa',
  TAS: '#2dd4bf',
}

const APPLIANCE_COLOURS: Record<string, string> = {
  HEAT_PUMP_HVAC:    '#60a5fa',
  HEAT_PUMP_WATER:   '#34d399',
  INDUCTION_COOKTOP: '#fbbf24',
  EV_CHARGER:        '#a78bfa',
  ALL_ELECTRIC_HOME: '#f87171',
}

const APPLIANCE_LABELS: Record<string, string> = {
  HEAT_PUMP_HVAC:    'Heat Pump HVAC',
  HEAT_PUMP_WATER:   'Heat Pump Water',
  INDUCTION_COOKTOP: 'Induction Cooktop',
  EV_CHARGER:        'EV Charger',
  ALL_ELECTRIC_HOME: 'All-Electric Home',
}

const REG_STATUS_STYLE: Record<string, string> = {
  ALLOWED:      'bg-green-900 text-green-300 border border-green-700',
  UNDER_REVIEW: 'bg-amber-900 text-amber-300 border border-amber-700',
  RESTRICTED:   'bg-orange-900 text-orange-300 border border-orange-700',
  BANNED:       'bg-red-900 text-red-300 border border-red-700',
}

const PROGRAM_TYPE_STYLE: Record<string, string> = {
  REBATE:        'bg-blue-900 text-blue-300 border border-blue-700',
  LOAN:          'bg-teal-900 text-teal-300 border border-teal-700',
  VPP_INCENTIVE: 'bg-purple-900 text-purple-300 border border-purple-700',
  BULK_PURCHASE: 'bg-emerald-900 text-emerald-300 border border-emerald-700',
}

const APPLIANCE_TYPES = ['HEAT_PUMP_HVAC', 'HEAT_PUMP_WATER', 'INDUCTION_COOKTOP', 'EV_CHARGER', 'ALL_ELECTRIC_HOME']
const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA']
const YEARS = [2024, 2025, 2026, 2027]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  colour: string
  icon?: React.ReactNode
}

function KpiCard({ label, value, sub, colour, icon }: KpiCardProps) {
  return (
    <div className={`rounded-xl border ${colour} p-4 flex flex-col gap-1`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom tooltips
// ---------------------------------------------------------------------------

function AdoptionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs space-y-1 shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          <span className="text-gray-300">{APPLIANCE_LABELS[p.name] ?? p.name}:</span>
          <span className="font-medium text-white">{p.value.toFixed(1)}k units</span>
        </div>
      ))}
    </div>
  )
}

function LoadImpactTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs space-y-1 shadow-xl">
      <p className="font-semibold text-white mb-1">Year {label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="font-medium text-white">{p.value.toFixed(0)} GWh</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ElectrificationAnalytics() {
  const [data, setData] = useState<ElectrificationDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectrificationDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Building Electrification & Heat Pump Analytics...
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

  // ------------- KPI calculations -------------
  const totalHeatPumpInstallations =
    data.adoption
      .filter((r) => r.appliance_type === 'HEAT_PUMP_HVAC' || r.appliance_type === 'HEAT_PUMP_WATER')
      .reduce((s, r) => s + r.total_units_k, 0)

  const additionalPeak2027 = data.load_impacts
    .filter((r) => r.year === 2027)
    .reduce((s, r) => s + r.additional_peak_mw, 0)

  const totalGasDisplaced = data.load_impacts
    .filter((r) => r.year === 2027)
    .reduce((s, r) => s + r.gas_displaced_pj, 0)

  const totalRebateSpending = data.programs
    .reduce((s, r) => s + r.annual_budget_m_aud, 0)

  // ------------- Adoption trend chart data (by appliance type across states, 2024) -------------
  // Build data keyed by appliance type, with state values
  const adoptionByStateData = STATES.map((state) => {
    const row: Record<string, number | string> = { state }
    APPLIANCE_TYPES.forEach((type) => {
      const rec = data.adoption.find((r) => r.state === state && r.appliance_type === type)
      if (rec) row[type] = rec.total_units_k
    })
    return row
  })

  // ------------- Annual additions trend by appliance type across states (summed) -------------
  const adoptionTrendData = APPLIANCE_TYPES.map((type) => {
    const row: Record<string, number | string> = { type: APPLIANCE_LABELS[type] ?? type }
    STATES.forEach((state) => {
      const rec = data.adoption.find((r) => r.state === state && r.appliance_type === type)
      if (rec) row[state] = rec.annual_additions_k
    })
    return row
  })

  // ------------- Load impact area chart data (stacked GWh by state over years) -------------
  const loadImpactByYear = YEARS.map((year) => {
    const row: Record<string, number | string> = { year }
    STATES.forEach((state) => {
      const rec = data.load_impacts.find((r) => r.state === state && r.year === year)
      if (rec) row[state] = rec.additional_annual_gwh
    })
    return row
  })

  return (
    <div className="p-6 space-y-8 bg-gray-950 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Flame className="text-orange-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Building Electrification & Heat Pump Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Residential and commercial electrification, heat pump adoption, load shift impacts, and NEM demand implications — 2024-2027
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Heat Pump Installations"
          value={`${totalHeatPumpInstallations.toFixed(0)}k`}
          sub="HVAC + water heaters across 5 states"
          colour="border-orange-700 bg-orange-900/20"
          icon={<Flame size={14} />}
        />
        <KpiCard
          label="Additional Peak Demand 2027"
          value={`${additionalPeak2027.toFixed(0)} MW`}
          sub="Cumulative across NSW, VIC, QLD, SA, WA"
          colour="border-blue-700 bg-blue-900/20"
        />
        <KpiCard
          label="Total Gas Displaced (2027)"
          value={`${totalGasDisplaced.toFixed(1)} PJ`}
          sub="Annual gas substitution by electrification"
          colour="border-green-700 bg-green-900/20"
        />
        <KpiCard
          label="Total Rebate Program Spending"
          value={`$${totalRebateSpending.toFixed(0)}M`}
          sub={`${data.programs.length} programs across all states`}
          colour="border-amber-700 bg-amber-900/20"
        />
      </div>

      {/* Adoption by State Bar Chart (total units by appliance type) */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Appliance Adoption by State — 2024 (k units installed)</h2>
          <p className="text-xs text-gray-400 mt-0.5">Total installed base per appliance type across states</p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={adoptionByStateData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `${v}k`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={50}
            />
            <Tooltip
              formatter={(v: number, name: string) => [`${v.toFixed(1)}k units`, APPLIANCE_LABELS[name] ?? name]}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563', borderRadius: '8px' }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend
              formatter={(v) => (
                <span style={{ color: APPLIANCE_COLOURS[v] ?? '#fff', fontSize: 12 }}>
                  {APPLIANCE_LABELS[v] ?? v}
                </span>
              )}
            />
            {APPLIANCE_TYPES.map((type) => (
              <Bar key={type} dataKey={type} fill={APPLIANCE_COLOURS[type]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Annual Additions Line Chart (by appliance type) */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Annual Additions by Appliance Type (k units/year)</h2>
          <p className="text-xs text-gray-400 mt-0.5">New installations in 2024 per appliance type — stacked by state contribution</p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={adoptionTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis
              tickFormatter={(v) => `${v}k`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={50}
            />
            <Tooltip
              formatter={(v: number, name: string) => [`${v.toFixed(1)}k units/yr`, name]}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563', borderRadius: '8px' }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend formatter={(v) => <span style={{ color: STATE_COLOURS[v] ?? '#fff', fontSize: 12 }}>{v}</span>} />
            {STATES.map((state) => (
              <Line
                key={state}
                type="monotone"
                dataKey={state}
                stroke={STATE_COLOURS[state]}
                strokeWidth={2}
                dot={{ r: 4, fill: STATE_COLOURS[state] }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Load Impact Area Chart (stacked GWh by state 2024-2027) */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Additional Grid Load — Stacked Annual GWh by State (2024–2027)</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Cumulative additional electricity demand from building electrification
          </p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={loadImpactByYear} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <defs>
              {STATES.map((state) => (
                <linearGradient key={state} id={`grad-${state}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={STATE_COLOURS[state]} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={STATE_COLOURS[state]} stopOpacity={0.1} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `${v.toLocaleString()} GWh`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={80}
            />
            <Tooltip content={<LoadImpactTooltip />} />
            <Legend formatter={(v) => <span style={{ color: STATE_COLOURS[v] ?? '#fff', fontSize: 12 }}>{v}</span>} />
            {STATES.map((state) => (
              <Area
                key={state}
                type="monotone"
                dataKey={state}
                stackId="1"
                stroke={STATE_COLOURS[state]}
                fill={`url(#grad-${state})`}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Gas Network Stranded Asset Risk Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Gas Network Stranded Asset Risk</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Distribution network exposure to electrification — stranded asset risk and regulatory status
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Network</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">State</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Connections</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Asset Value</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Elec. Risk %</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Stranded Risk M AUD</th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.gas_networks
                .slice()
                .sort((a, b) => b.stranded_asset_risk_m_aud - a.stranded_asset_risk_m_aud)
                .map((net, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-white font-medium">{net.network_name}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold text-gray-900"
                        style={{ backgroundColor: STATE_COLOURS[net.state] ?? '#6b7280' }}
                      >
                        {net.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-300">{net.residential_connections_k}k</td>
                    <td className="py-2.5 px-3 text-right text-blue-400 font-medium">
                      ${net.asset_value_m_aud.toLocaleString()}M
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`font-semibold ${
                          net.electrification_risk_pct >= 60
                            ? 'text-red-400'
                            : net.electrification_risk_pct >= 40
                            ? 'text-amber-400'
                            : 'text-green-400'
                        }`}
                      >
                        {net.electrification_risk_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-red-400 font-semibold">
                      ${net.stranded_asset_risk_m_aud.toFixed(1)}M
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${REG_STATUS_STYLE[net.regulatory_status] ?? 'bg-gray-700 text-gray-300'}`}
                      >
                        {net.regulatory_status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {/* Summary row */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400 border-t border-gray-800 pt-3">
          <span>
            Total connections:{' '}
            <span className="text-white font-semibold">
              {data.gas_networks.reduce((s, n) => s + n.residential_connections_k, 0)}k
            </span>
          </span>
          <span>
            Total stranded risk:{' '}
            <span className="text-red-400 font-semibold">
              ${data.gas_networks.reduce((s, n) => s + n.stranded_asset_risk_m_aud, 0).toFixed(1)}M AUD
            </span>
          </span>
          <span>
            Banned / Restricted:{' '}
            <span className="text-orange-400 font-semibold">
              {data.gas_networks.filter((n) => n.regulatory_status === 'BANNED' || n.regulatory_status === 'RESTRICTED').length} networks
            </span>
          </span>
        </div>
      </div>

      {/* Program Comparison Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Electrification Program Comparison</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            State rebate, loan, VPP incentive, and bulk purchase programs — ranked by CO2 abatement efficiency
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Program</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">State</th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Type</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Annual Budget</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Rebate AUD</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Uptake %</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Abatement $/t CO2</th>
              </tr>
            </thead>
            <tbody>
              {data.programs
                .slice()
                .sort((a, b) => a.co2_abatement_cost_aud_tonne - b.co2_abatement_cost_aud_tonne)
                .map((prog, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-white font-medium max-w-[220px]">{prog.program_name}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold text-gray-900"
                        style={{ backgroundColor: STATE_COLOURS[prog.state] ?? '#6b7280' }}
                      >
                        {prog.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${PROGRAM_TYPE_STYLE[prog.program_type] ?? 'bg-gray-700 text-gray-300'}`}
                      >
                        {prog.program_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-400 font-medium">
                      ${prog.annual_budget_m_aud.toFixed(1)}M
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-medium">
                      {prog.rebate_amount_aud > 0 ? `$${prog.rebate_amount_aud.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`font-semibold ${
                          prog.uptake_rate_pct >= 50
                            ? 'text-green-400'
                            : prog.uptake_rate_pct >= 30
                            ? 'text-amber-400'
                            : 'text-gray-300'
                        }`}
                      >
                        {prog.uptake_rate_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`font-semibold ${
                          prog.co2_abatement_cost_aud_tonne <= 30
                            ? 'text-green-400'
                            : prog.co2_abatement_cost_aud_tonne <= 50
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        ${prog.co2_abatement_cost_aud_tonne.toFixed(0)}/t
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {/* Summary row */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400 border-t border-gray-800 pt-3">
          <span>
            Total annual budget:{' '}
            <span className="text-amber-400 font-semibold">
              ${data.programs.reduce((s, p) => s + p.annual_budget_m_aud, 0).toFixed(1)}M AUD
            </span>
          </span>
          <span>
            Avg uptake rate:{' '}
            <span className="text-white font-semibold">
              {(data.programs.reduce((s, p) => s + p.uptake_rate_pct, 0) / data.programs.length).toFixed(1)}%
            </span>
          </span>
          <span>
            Best abatement cost:{' '}
            <span className="text-green-400 font-semibold">
              ${Math.min(...data.programs.map((p) => p.co2_abatement_cost_aud_tonne)).toFixed(0)}/t CO2
            </span>
          </span>
        </div>
      </div>

      {/* CO2 Reduction Summary Chart */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">CO2 Reduction by State & Year (kt CO2e)</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Annual CO2 abatement from building electrification — gas substitution impact
          </p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={YEARS.map((year) => {
              const row: Record<string, number | string> = { year }
              STATES.forEach((state) => {
                const rec = data.load_impacts.find((r) => r.state === state && r.year === year)
                if (rec) row[state] = rec.co2_reduction_kt
              })
              return row
            })}
            margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `${v.toLocaleString()}kt`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={65}
            />
            <Tooltip
              formatter={(v: number, name: string) => [`${v.toLocaleString()} kt CO2e`, name]}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563', borderRadius: '8px' }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend formatter={(v) => <span style={{ color: STATE_COLOURS[v] ?? '#fff', fontSize: 12 }}>{v}</span>} />
            {STATES.map((state) => (
              <Bar key={state} dataKey={state} stackId="a" fill={STATE_COLOURS[state]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer timestamp */}
      <p className="text-xs text-gray-600 text-right">
        Data as at: {new Date(data.timestamp).toLocaleString('en-AU')}
      </p>
    </div>
  )
}
