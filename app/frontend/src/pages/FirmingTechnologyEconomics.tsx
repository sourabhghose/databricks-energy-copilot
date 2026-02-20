import { useEffect, useState } from 'react'
import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Flame, Zap, Battery, Wind } from 'lucide-react'
import { api } from '../api/client'
import type { FirmingTechDashboard, FirmingTechnologyRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  GENERATION: '#f59e0b',
  STORAGE:    '#3b82f6',
  DEMAND:     '#22c55e',
}

const TECH_COLORS: Record<string, string> = {
  OCGT:             '#f97316',
  CCGT:             '#f59e0b',
  HYDROGEN_TURBINE: '#a78bfa',
  BATTERY_4HR:      '#3b82f6',
  BATTERY_8HR:      '#1d4ed8',
  PUMPED_HYDRO:     '#06b6d4',
  BIOMASS:          '#22c55e',
  DEMAND_RESPONSE:  '#10b981',
}

const SCENARIO_COLORS: Record<string, string> = {
  HIGH_VRE_90PCT:   '#ef4444',
  MEDIUM_VRE_70PCT: '#f59e0b',
  LOW_VRE_50PCT:    '#22c55e',
}

const MATURITY_BADGE: Record<string, string> = {
  COMMERCIAL:    'bg-green-700 text-green-100',
  DEMONSTRATION: 'bg-amber-700 text-amber-100',
  EMERGING:      'bg-blue-700 text-blue-100',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function techLabel(id: string): string {
  const MAP: Record<string, string> = {
    OCGT:             'OCGT',
    CCGT:             'CCGT',
    HYDROGEN_TURBINE: 'H2 Turbine',
    BATTERY_4HR:      'Battery 4hr',
    BATTERY_8HR:      'Battery 8hr',
    PUMPED_HYDRO:     'Pumped Hydro',
    BIOMASS:          'Biomass',
    DEMAND_RESPONSE:  'Demand Response',
  }
  return MAP[id] ?? id
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  unit,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  unit: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
        <Icon size={16} className={color} />
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-sm text-gray-400 mb-0.5">{unit}</span>
      </div>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scatter tooltip
// ---------------------------------------------------------------------------

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: FirmingTechnologyRecord & { x: number; y: number; z: number } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs text-gray-100">
      <p className="font-semibold mb-1">{techLabel(d.tech_id)}</p>
      <p>LCOS: <span className="text-amber-400">${d.lcos_aud_mwh}/MWh</span></p>
      <p>Duration: <span className="text-cyan-400">{d.duration_hours != null ? `${d.duration_hours}h` : 'N/A'}</span></p>
      <p>Cap Factor: <span className="text-green-400">{d.capacity_factor_pct}%</span></p>
      <p>CO2: <span className="text-red-400">{d.co2_kg_mwh} kg/MWh</span></p>
      <p>Category: <span className="text-purple-400">{d.category}</span></p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FirmingTechnologyEconomics() {
  const [data, setData] = useState<FirmingTechDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeScenario, setActiveScenario] = useState<string>('HIGH_VRE_90PCT')

  useEffect(() => {
    api
      .getFirmingTechDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading firming technology data...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data available'}
      </div>
    )
  }

  // KPI derivations
  const cheapestLcos = Math.min(...data.technologies.map(t => t.lcos_aud_mwh))
  const cheapestTech = data.technologies.find(t => t.lcos_aud_mwh === cheapestLcos)
  const fastestResponse = Math.min(...data.technologies.map(t => t.response_time_min))
  const fastestTech = data.technologies.find(t => t.response_time_min === fastestResponse)
  const lowestCo2 = Math.min(...data.technologies.map(t => t.co2_kg_mwh))
  const lowestCo2Tech = data.technologies.find(t => t.co2_kg_mwh === lowestCo2)
  const highVreScenario = data.scenarios.find(s => s.name === 'HIGH_VRE_90PCT')

  // Scatter data: LCOS vs duration (generation techs get nominal 48h to appear)
  const scatterData = data.technologies.map(t => ({
    ...t,
    x: t.duration_hours ?? 48,
    y: t.lcos_aud_mwh,
    z: t.capacity_factor_pct * 10,
  }))

  // Revenue bar chart — filter to active scenario
  const dispatchForScenario = data.dispatch_records.filter(r => r.scenario === activeScenario)

  // Cost curve line data — pivot by firming_requirement_pct
  const costCurvePcts = [10, 15, 20, 25, 30]
  const costCurveLineData = costCurvePcts.map(pct => {
    const row: Record<string, number | string> = { pct: `${pct}%` }
    ;['HIGH_VRE_90PCT', 'MEDIUM_VRE_70PCT', 'LOW_VRE_50PCT'].forEach(sc => {
      const rec = data.cost_curves.find(r => r.scenario === sc && r.firming_requirement_pct === pct)
      if (rec) row[sc] = rec.avg_firming_cost_aud_mwh
    })
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 bg-orange-600 rounded-lg">
          <Flame size={28} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Firming Technology Economics</h1>
          <p className="text-gray-400 text-sm mt-1">
            Comparing dispatchable firming options for the renewables-heavy NEM — OCGT, CCGT, hydrogen turbines,
            pumped hydro, long-duration batteries, biomass and demand response analysed by LCOS, dispatch revenue
            and system cost across VRE penetration scenarios.
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Cheapest Firming LCOS"
          value={`$${cheapestLcos}`}
          unit="/MWh"
          sub={techLabel(cheapestTech?.tech_id ?? '')}
          icon={Zap}
          color="text-amber-400"
        />
        <KpiCard
          label="Fastest Response"
          value={fastestResponse < 1 ? '<1' : fastestResponse.toFixed(0)}
          unit="min"
          sub={techLabel(fastestTech?.tech_id ?? '')}
          icon={Battery}
          color="text-blue-400"
        />
        <KpiCard
          label="Lowest CO2 Intensity"
          value={lowestCo2}
          unit="kg/MWh"
          sub={techLabel(lowestCo2Tech?.tech_id ?? '')}
          icon={Wind}
          color="text-green-400"
        />
        <KpiCard
          label="Firming Capacity Needed"
          value={highVreScenario?.firming_capacity_gw ?? '—'}
          unit="GW"
          sub="90% VRE scenario"
          icon={Flame}
          color="text-orange-400"
        />
      </div>

      {/* Technology comparison table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white mb-3">Technology Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700 text-left">
                <th className="pb-2 pr-4">Technology</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">CAPEX (M$/MW)</th>
                <th className="pb-2 pr-4">OPEX (M$/MW/yr)</th>
                <th className="pb-2 pr-4">LCOS ($/MWh)</th>
                <th className="pb-2 pr-4">Response (min)</th>
                <th className="pb-2 pr-4">CO2 (kg/MWh)</th>
                <th className="pb-2">Maturity</th>
              </tr>
            </thead>
            <tbody>
              {data.technologies.map(t => (
                <tr key={t.tech_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: TECH_COLORS[t.tech_id] ?? '#888' }}
                      />
                      {techLabel(t.tech_id)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{t.category}</td>
                  <td className="py-2 pr-4 text-amber-400">${t.capex_m_aud_mw.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-gray-300">${t.opex_m_aud_mw_yr.toFixed(3)}</td>
                  <td className="py-2 pr-4 font-semibold text-white">${t.lcos_aud_mwh}</td>
                  <td className="py-2 pr-4 text-cyan-400">
                    {t.response_time_min < 1 ? `${(t.response_time_min * 60).toFixed(0)}s` : `${t.response_time_min} min`}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={t.co2_kg_mwh === 0 ? 'text-green-400' : t.co2_kg_mwh < 50 ? 'text-green-300' : t.co2_kg_mwh < 200 ? 'text-amber-400' : 'text-red-400'}>
                      {t.co2_kg_mwh}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MATURITY_BADGE[t.commercial_maturity] ?? 'bg-gray-700 text-gray-300'}`}>
                      {t.commercial_maturity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row 1: scatter + revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LCOS vs Duration scatter */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-1">LCOS vs Duration</h2>
          <p className="text-xs text-gray-400 mb-3">Bubble size = capacity factor. Colour = category. Generation techs shown at 48h nominal.</p>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="x"
                type="number"
                name="Duration (h)"
                label={{ value: 'Duration (h)', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 11 }}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <YAxis
                dataKey="y"
                type="number"
                name="LCOS ($/MWh)"
                label={{ value: 'LCOS ($/MWh)', angle: -90, position: 'insideLeft', offset: 10, fill: '#9ca3af', fontSize: 11 }}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <ZAxis dataKey="z" range={[60, 400]} />
              <Tooltip content={<ScatterTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }}
                formatter={(value: string) => value}
              />
              {['GENERATION', 'STORAGE', 'DEMAND'].map(cat => (
                <Scatter
                  key={cat}
                  name={cat}
                  data={scatterData.filter(d => d.category === cat)}
                  fill={CATEGORY_COLORS[cat]}
                  fillOpacity={0.8}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue waterfall bar chart */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-1">Revenue by Technology</h2>
          <div className="flex gap-2 mb-3">
            {['HIGH_VRE_90PCT', 'MEDIUM_VRE_70PCT', 'LOW_VRE_50PCT'].map(sc => (
              <button
                key={sc}
                onClick={() => setActiveScenario(sc)}
                className={`text-xs px-2 py-1 rounded transition-colors ${activeScenario === sc ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
              >
                {sc === 'HIGH_VRE_90PCT' ? '90% VRE' : sc === 'MEDIUM_VRE_70PCT' ? '70% VRE' : '50% VRE'}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={dispatchForScenario.map(r => ({ ...r, label: techLabel(r.tech_id) }))}
              margin={{ top: 5, right: 10, bottom: 30, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`$${v.toFixed(1)}M`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Bar dataKey="avg_revenue_m_aud_yr" name="Dispatch Revenue" stackId="rev" fill="#f59e0b">
                {dispatchForScenario.map(r => (
                  <Cell key={r.tech_id} fill={TECH_COLORS[r.tech_id] ?? '#888'} />
                ))}
              </Bar>
              <Bar dataKey="capacity_payment_m_aud_yr" name="Capacity Payment" stackId="rev" fill="#3b82f6" fillOpacity={0.65} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Firming cost curve */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white mb-1">Firming Cost Curve — VRE Penetration</h2>
        <p className="text-xs text-gray-400 mb-3">Average firming cost ($/MWh) as a function of firming requirement (%) across three VRE scenarios.</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={costCurveLineData} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="pct"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Firming Requirement (%)', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Avg Firming Cost ($/MWh)', angle: -90, position: 'insideLeft', offset: 10, fill: '#9ca3af', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`$${v}/MWh`, '']}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
            {['HIGH_VRE_90PCT', 'MEDIUM_VRE_70PCT', 'LOW_VRE_50PCT'].map(sc => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                name={sc === 'HIGH_VRE_90PCT' ? '90% VRE' : sc === 'MEDIUM_VRE_70PCT' ? '70% VRE' : '50% VRE'}
                stroke={SCENARIO_COLORS[sc]}
                strokeWidth={2}
                dot={{ r: 4, fill: SCENARIO_COLORS[sc] }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario comparison cards */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Scenario Comparison</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.scenarios.map(sc => (
            <div key={sc.scenario_id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-sm font-bold"
                  style={{ color: SCENARIO_COLORS[sc.name] ?? '#fff' }}
                >
                  {sc.name === 'HIGH_VRE_90PCT' ? '90% VRE' : sc.name === 'MEDIUM_VRE_70PCT' ? '70% VRE' : '50% VRE'}
                </span>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                  {sc.vre_penetration_pct}% VRE
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Firming Capacity</span>
                  <span className="text-white font-semibold">{sc.firming_capacity_gw} GW</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg LCOE</span>
                  <span className="text-amber-400 font-semibold">${sc.avg_lcoe_aud_mwh}/MWh</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-1">Recommended Mix</span>
                  <span className="text-xs text-gray-300 leading-snug">{sc.recommended_mix}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
