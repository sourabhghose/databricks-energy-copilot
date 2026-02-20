// Sprint 59b — Long Duration Energy Storage (LDES) Economics Analytics

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ComposedChart,
  Area,
} from 'recharts'
import { Database } from 'lucide-react'
import {
  getLdesEconomicsDashboard,
  LdesEconomicsDashboard,
  LDETechnologyRecord,
  LDEEconomicCaseRecord,
  LDEProjectRecord,
  LDESeasonalRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const TRL_COLOUR = (trl: number): string => {
  if (trl >= 8) return '#34d399'
  if (trl >= 6) return '#fbbf24'
  if (trl >= 4) return '#f97316'
  return '#f87171'
}

const TRL_LABEL = (trl: number): string => {
  if (trl >= 8) return 'Commercial'
  if (trl >= 6) return 'Demo'
  if (trl >= 4) return 'Pilot'
  return 'R&D'
}

const STATUS_STYLE: Record<string, string> = {
  OPERATING:    'bg-emerald-900 text-emerald-300 border border-emerald-700',
  CONSTRUCTION: 'bg-blue-900 text-blue-300 border border-blue-700',
  APPROVED:     'bg-amber-900 text-amber-300 border border-amber-700',
  PROPOSED:     'bg-gray-700 text-gray-300 border border-gray-600',
}

const SCENARIO_COLOUR: Record<string, string> = {
  HIGH_VRE_90:   '#60a5fa',
  HIGH_VRE_75:   '#34d399',
  MEDIUM_VRE_60: '#fbbf24',
}

const SCENARIO_LABEL: Record<string, string> = {
  HIGH_VRE_90:   '90% VRE',
  HIGH_VRE_75:   '75% VRE',
  MEDIUM_VRE_60: '60% VRE',
}

const TECH_SCATTER_COLOUR: Record<string, string> = {
  PUMPED_HYDRO:           '#60a5fa',
  COMPRESSED_AIR:         '#34d399',
  FLOW_VANADIUM:          '#a78bfa',
  FLOW_ZINC:              '#2dd4bf',
  LIQUID_AIR:             '#f97316',
  GREEN_HYDROGEN_STORAGE: '#facc15',
  THERMAL_MOLTEN_SALT:    '#f87171',
  GRAVITY_RAIL:           '#e879f9',
  IRON_AIR:               '#fb923c',
  ADIABATIC_CAES:         '#86efac',
}

// ---------------------------------------------------------------------------
// KPI Card
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
// TRL Badge
// ---------------------------------------------------------------------------

function TrlBadge({ trl }: { trl: number }) {
  const colour = TRL_COLOUR(trl)
  const label = TRL_LABEL(trl)
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border"
      style={{ borderColor: colour, color: colour, backgroundColor: colour + '20' }}
    >
      TRL {trl} · {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Custom tooltips
// ---------------------------------------------------------------------------

function SeasonalTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs space-y-1 shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="font-medium text-white">
            {typeof p.value === 'number'
              ? p.dataKey === 'storage_utilisation_pct'
                ? `${p.value.toFixed(1)}%`
                : p.dataKey === 'price_arbitrage_aud_mwh'
                ? `$${p.value.toFixed(0)}/MWh`
                : `${p.value.toFixed(0)} GWh`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs space-y-1 shadow-xl min-w-[180px]">
      <p className="font-semibold text-white mb-1">{d.name}</p>
      <div className="flex justify-between gap-4">
        <span className="text-gray-400">Duration:</span>
        <span className="text-white">{d.duration_range_hr} hr</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-400">Current LCOS:</span>
        <span className="text-amber-400">${d.current_lcos}/MWh</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-400">2035 Target:</span>
        <span className="text-emerald-400">${d.target_lcos}/MWh</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-400">TRL:</span>
        <span className="text-white">{d.trl}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-400">Efficiency:</span>
        <span className="text-white">{d.efficiency}%</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LdesEconomicsAnalytics() {
  const [data, setData] = useState<LdesEconomicsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLdesEconomicsDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading LDES Economics Analytics...
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
  const trl7Plus = data.technologies.filter((t) => t.technology_readiness_level >= 7).length
  const cheapest2035 = Math.min(...data.technologies.map((t) => t.target_lcos_2035_aud_mwh))
  const cheapest2035Tech = data.technologies.find(
    (t) => t.target_lcos_2035_aud_mwh === cheapest2035
  )
  const totalPipelineGwh = data.projects
    .filter((p) => p.status !== 'OPERATING')
    .reduce((s, p) => s + p.capacity_gwh, 0)
  const maxSurplus = Math.max(...data.seasonal_patterns.map((s) => s.vre_surplus_gwh))

  // ------------- Scatter data -------------
  const scatterData = data.technologies.map((t) => ({
    name: t.name,
    tech_id: t.tech_id,
    current_lcos: t.current_lcos_aud_mwh,
    target_lcos: t.target_lcos_2035_aud_mwh,
    trl: t.technology_readiness_level,
    efficiency: t.round_trip_efficiency_pct,
    duration_range_hr: t.duration_range_hr,
    // Use TRL as bubble size proxy (z value)
    z: t.technology_readiness_level * 12,
  }))

  // ------------- LCOS comparison bar data -------------
  const lcosBarData = data.technologies
    .slice()
    .sort((a, b) => a.current_lcos_aud_mwh - b.current_lcos_aud_mwh)
    .map((t) => ({
      name: t.name.replace(' Energy Storage', '').replace(' Battery', '').replace(' (CAES)', ''),
      current: t.current_lcos_aud_mwh,
      target: t.target_lcos_2035_aud_mwh,
      trl: t.technology_readiness_level,
    }))

  return (
    <div className="p-6 space-y-8 bg-gray-950 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Database className="text-cyan-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Long Duration Energy Storage (LDES) Economics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Storage technologies for 8–100+ hour discharge, seasonal storage economics, and viability
            in a high-VRE NEM
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Technologies at TRL ≥ 7"
          value={`${trl7Plus} / ${data.technologies.length}`}
          sub="Commercial-ready or demonstration stage"
          colour="border-emerald-700 bg-emerald-900/20"
          icon={<Database size={14} />}
        />
        <KpiCard
          label="Cheapest 2035 LCOS Target"
          value={`$${cheapest2035.toFixed(0)}/MWh`}
          sub={cheapest2035Tech?.name ?? ''}
          colour="border-cyan-700 bg-cyan-900/20"
        />
        <KpiCard
          label="Total Pipeline Capacity"
          value={`${totalPipelineGwh.toFixed(0)} GWh`}
          sub="Approved + proposed projects (excl. operating)"
          colour="border-blue-700 bg-blue-900/20"
        />
        <KpiCard
          label="Peak Seasonal VRE Surplus"
          value={`${maxSurplus.toFixed(0)} GWh`}
          sub="Max monthly surplus to be stored"
          colour="border-amber-700 bg-amber-900/20"
        />
      </div>

      {/* Technology Matrix Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Technology Matrix</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Current vs 2035 target LCOS (AUD/MWh), TRL, round-trip efficiency, and Australian
            project pipeline
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  Technology
                </th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  Duration
                </th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  LCOS Now
                </th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  LCOS 2035
                </th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  Reduction
                </th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  TRL
                </th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  Efficiency
                </th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  AU Projects
                </th>
              </tr>
            </thead>
            <tbody>
              {data.technologies
                .slice()
                .sort(
                  (a, b) =>
                    b.technology_readiness_level - a.technology_readiness_level ||
                    a.current_lcos_aud_mwh - b.current_lcos_aud_mwh
                )
                .map((tech, i) => {
                  const reduction =
                    ((tech.current_lcos_aud_mwh - tech.target_lcos_2035_aud_mwh) /
                      tech.current_lcos_aud_mwh) *
                    100
                  return (
                    <tr
                      key={i}
                      className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-white font-medium">{tech.name}</td>
                      <td className="py-2.5 px-3 text-center text-gray-300 font-mono text-xs">
                        {tech.duration_range_hr} hr
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-400 font-medium">
                        ${tech.current_lcos_aud_mwh.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-medium">
                        ${tech.target_lcos_2035_aud_mwh.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-cyan-400 font-medium">
                        -{reduction.toFixed(0)}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <TrlBadge trl={tech.technology_readiness_level} />
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-300">
                        {tech.round_trip_efficiency_pct.toFixed(0)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {tech.australian_projects > 0 ? (
                          <span className="text-blue-400 font-semibold">
                            {tech.australian_projects}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* LCOS Current vs 2035 Target Bar Chart */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">
            LCOS: Current vs 2035 Target (AUD/MWh)
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Levelised Cost of Storage — sorted by current cost (lowest first)
          </p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={lcosBarData} margin={{ top: 10, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tickFormatter={(v) => `$${v}`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={55}
            />
            <Tooltip
              formatter={(v: number, name: string) => [
                `$${v.toFixed(0)}/MWh`,
                name === 'current' ? 'Current LCOS' : '2035 Target LCOS',
              ]}
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #4b5563',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend
              formatter={(v) => (
                <span className="text-xs text-gray-300">
                  {v === 'current' ? 'Current LCOS' : '2035 Target LCOS'}
                </span>
              )}
            />
            <ReferenceLine
              y={200}
              stroke="#6b7280"
              strokeDasharray="4 4"
              label={{ value: 'Competitive threshold ~$200', fill: '#9ca3af', fontSize: 10 }}
            />
            <Bar dataKey="current" fill="#f59e0b" name="current" />
            <Bar dataKey="target" fill="#34d399" name="target" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Economic Case Scenario Cards */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-white">Economic Case — NEM Scenario Analysis</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Optimal LDES deployment economics under three NEM VRE penetration scenarios
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.economic_cases.map((ec, i) => {
            const colour = SCENARIO_COLOUR[ec.scenario] ?? '#6b7280'
            return (
              <div
                key={i}
                className="rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-4"
                style={{ borderTopColor: colour, borderTopWidth: 3 }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm font-bold"
                    style={{ color: colour }}
                  >
                    {SCENARIO_LABEL[ec.scenario]}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                    {ec.scenario}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-500">Optimal Duration</p>
                    <p className="text-white font-semibold text-base">
                      {ec.duration_optimal_hr.toFixed(0)} hr
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Storage Required</p>
                    <p className="text-white font-semibold text-base">
                      {ec.storage_required_gwh.toFixed(0)} GWh
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Avoided Curtailment</p>
                    <p className="text-emerald-400 font-semibold text-base">
                      {(ec.avoided_curtailment_gwh / 1000).toFixed(0)} TWh/yr
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">System Savings</p>
                    <p className="text-cyan-400 font-semibold text-base">
                      ${ec.system_cost_saving_m_aud.toFixed(0)}M
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Optimal Technology</p>
                    <p className="text-white font-medium text-xs leading-snug">
                      {ec.optimal_technology.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Breakeven LCOS</p>
                    <p className="text-amber-400 font-semibold text-base">
                      ${ec.breakeven_lcos_aud_mwh.toFixed(0)}/MWh
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Seasonal Surplus/Deficit Area Chart */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">
            Seasonal VRE Surplus / Deficit &amp; Storage Utilisation
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Monthly VRE surplus (summer) and deficit (winter) with optimal charge/discharge and
            storage utilisation %
          </p>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart
            data={data.seasonal_patterns}
            margin={{ top: 10, right: 60, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => `${v} GWh`}
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              width={70}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              width={45}
              domain={[0, 100]}
            />
            <Tooltip content={<SeasonalTooltip />} />
            <Legend formatter={(v) => <span className="text-xs text-gray-300">{v}</span>} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="vre_surplus_gwh"
              fill="#fbbf2430"
              stroke="#fbbf24"
              strokeWidth={2}
              name="VRE Surplus"
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="vre_deficit_gwh"
              fill="#f8717130"
              stroke="#f87171"
              strokeWidth={2}
              name="VRE Deficit"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="optimal_charge_gwh"
              stroke="#34d399"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 3, fill: '#34d399' }}
              name="Optimal Charge"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="optimal_discharge_gwh"
              stroke="#60a5fa"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 3, fill: '#60a5fa' }}
              name="Optimal Discharge"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="storage_utilisation_pct"
              stroke="#a78bfa"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#a78bfa' }}
              name="Utilisation %"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Price Arbitrage Line Chart */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">
            Monthly Price Arbitrage Opportunity (AUD/MWh)
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Estimated price spread available for LDES arbitrage — peaks during winter VRE deficit
          </p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
            data={data.seasonal_patterns}
            margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `$${v}`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={55}
            />
            <Tooltip
              formatter={(v: number) => [`$${v.toFixed(0)}/MWh`, 'Price Arbitrage']}
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #4b5563',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <ReferenceLine
              y={185}
              stroke="#34d399"
              strokeDasharray="4 4"
              label={{ value: 'PHES breakeven ~$185', fill: '#34d399', fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="price_arbitrage_aud_mwh"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 5, fill: '#f59e0b', strokeWidth: 0 }}
              activeDot={{ r: 7 }}
              name="Price Arbitrage"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* LCOS vs Duration Scatter */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">
            LCOS vs Round-Trip Efficiency — Bubble size = TRL level
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Current LCOS (y-axis) vs round-trip efficiency (x-axis); bubble size proportional to TRL
          </p>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              dataKey="efficiency"
              name="Efficiency"
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Round-Trip Efficiency (%)', fill: '#6b7280', fontSize: 11, position: 'insideBottom', offset: -12 }}
              domain={[30, 105]}
            />
            <YAxis
              type="number"
              dataKey="current_lcos"
              name="Current LCOS"
              tickFormatter={(v) => `$${v}`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Current LCOS (AUD/MWh)', fill: '#6b7280', fontSize: 11, angle: -90, position: 'insideLeft' }}
              domain={[100, 500]}
            />
            <ZAxis type="number" dataKey="z" range={[80, 600]} />
            <Tooltip content={<ScatterTooltip />} />
            <ReferenceLine
              y={200}
              stroke="#6b7280"
              strokeDasharray="4 4"
              label={{ value: 'Competitive ~$200', fill: '#9ca3af', fontSize: 10 }}
            />
            <Scatter
              data={scatterData}
              name="Technologies"
            >
              {scatterData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={TECH_SCATTER_COLOUR[entry.tech_id] ?? '#6b7280'}
                  fillOpacity={0.85}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        {/* Tech colour legend */}
        <div className="mt-3 flex flex-wrap gap-2">
          {data.technologies.map((tech) => (
            <span key={tech.tech_id} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: TECH_SCATTER_COLOUR[tech.tech_id] ?? '#6b7280' }}
              />
              {tech.name}
            </span>
          ))}
        </div>
      </div>

      {/* Project Tracker Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Australian LDES Project Tracker</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Operating, construction, approved, and proposed LDES projects across NEM regions
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  Project
                </th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  Technology
                </th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  Region
                </th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  Capacity GWh
                </th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  Power MW
                </th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  COD
                </th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  CAPEX
                </th>
              </tr>
            </thead>
            <tbody>
              {data.projects
                .slice()
                .sort((a, b) => {
                  const order = {
                    OPERATING: 0, CONSTRUCTION: 1, APPROVED: 2, PROPOSED: 3,
                  } as Record<string, number>
                  return (order[a.status] ?? 4) - (order[b.status] ?? 4) || b.capacity_gwh - a.capacity_gwh
                })
                .map((proj, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-white font-medium max-w-[200px]">
                      {proj.project_name}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[proj.status] ?? 'bg-gray-700 text-gray-300'}`}
                      >
                        {proj.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-300 text-xs">
                      {proj.technology.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-700 text-gray-200">
                        {proj.region}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-cyan-400 font-medium">
                      {proj.capacity_gwh >= 1
                        ? proj.capacity_gwh.toFixed(1)
                        : proj.capacity_gwh.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-300">
                      {proj.power_mw.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-300">{proj.expected_cod}</td>
                    <td className="py-2.5 px-3 text-right text-amber-400 font-medium">
                      ${proj.capex_m_aud >= 1000
                        ? `${(proj.capex_m_aud / 1000).toFixed(1)}B`
                        : `${proj.capex_m_aud.toFixed(0)}M`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {/* Summary */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400 border-t border-gray-800 pt-3">
          <span>
            Total projects:{' '}
            <span className="text-white font-semibold">{data.projects.length}</span>
          </span>
          <span>
            Total capacity:{' '}
            <span className="text-cyan-400 font-semibold">
              {data.projects.reduce((s, p) => s + p.capacity_gwh, 0).toFixed(1)} GWh
            </span>
          </span>
          <span>
            Total CAPEX:{' '}
            <span className="text-amber-400 font-semibold">
              $
              {(
                data.projects.reduce((s, p) => s + p.capex_m_aud, 0) / 1000
              ).toFixed(1)}
              B AUD
            </span>
          </span>
          <span>
            Operating:{' '}
            <span className="text-emerald-400 font-semibold">
              {data.projects.filter((p) => p.status === 'OPERATING').length}
            </span>
          </span>
        </div>
      </div>

      {/* Footer timestamp */}
      <p className="text-xs text-gray-600 text-right">
        Data as at: {new Date(data.timestamp).toLocaleString('en-AU')}
      </p>
    </div>
  )
}
