// Sprint 60a — Gas-Fired Generation Transition Analytics

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  ComposedChart,
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
import { Fuel } from 'lucide-react'
import {
  getGasTransitionDashboard,
  GasTransitionDashboard,
  GFTGeneratorRecord,
  GFTGasSupplyRecord,
  GFTHydrogenBlendRecord,
  GFTCapacityOutlookRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const TECH_STYLE: Record<string, string> = {
  CCGT:  'bg-blue-900 text-blue-300 border border-blue-700',
  OCGT:  'bg-amber-900 text-amber-300 border border-amber-700',
  RECIP: 'bg-purple-900 text-purple-300 border border-purple-700',
  STEAM: 'bg-gray-700 text-gray-300 border border-gray-600',
}

const TREND_STYLE: Record<string, string> = {
  RISING:  'bg-red-900 text-red-300 border border-red-700',
  STABLE:  'bg-amber-900 text-amber-300 border border-amber-700',
  FALLING: 'bg-emerald-900 text-emerald-300 border border-emerald-700',
}

const EXIT_TRIGGER_STYLE: Record<string, string> = {
  ECONOMICS: 'bg-red-900 text-red-300 border border-red-700',
  FUEL:      'bg-orange-900 text-orange-300 border border-orange-700',
  POLICY:    'bg-blue-900 text-blue-300 border border-blue-700',
  AGE:       'bg-gray-700 text-gray-300 border border-gray-600',
}

const RISK_STYLE: Record<string, string> = {
  LOW:    'bg-emerald-900 text-emerald-300 border border-emerald-700',
  MEDIUM: 'bg-amber-900 text-amber-300 border border-amber-700',
  HIGH:   'bg-red-900 text-red-300 border border-red-700',
}

const Badge = ({ label, style }: { label: string; style: string }) => (
  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${style}`}>{label}</span>
)

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string
  subtitle: string
  colour: string
}

const KpiCard = ({ title, value, subtitle, colour }: KpiCardProps) => (
  <div className={`bg-gray-800 border ${colour} rounded-lg p-4`}>
    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{title}</p>
    <p className="text-2xl font-bold text-white">{value}</p>
    <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
  </div>
)

// ---------------------------------------------------------------------------
// Custom tooltip for capacity outlook
// ---------------------------------------------------------------------------

const OutlookTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-3 text-xs text-gray-200 shadow-lg">
      <p className="font-semibold mb-1">Year {label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()} MW
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GasTransitionAnalytics() {
  const [data, setData] = useState<GasTransitionDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGasTransitionDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-pulse text-sm">Loading Gas Transition data…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400 text-sm">Error: {error ?? 'No data'}</div>
      </div>
    )
  }

  // KPI calculations
  const totalCapacityMW = data.generators.reduce((s, g) => s + g.capacity_mw, 0)
  const h2CapableCount = data.generators.filter(g => g.h2_capable).length
  const avgSRMC = data.generators.reduce((s, g) => s + g.srmc_aud_mwh, 0) / data.generators.length
  const validBasins = data.gas_supply.filter(b => b.reserve_life_years < 900)
  const avgReserveLife = validBasins.reduce((s, b) => s + b.reserve_life_years, 0) / validBasins.length

  // H2 blending chart data
  const blendChartData = data.hydrogen_blending.map((r: GFTHydrogenBlendRecord) => ({
    unit: r.unit_id,
    '2025': r.blend_pct_2025,
    '2030': r.blend_pct_2030,
    '2035': r.blend_pct_2035,
  }))

  // Capacity outlook chart data
  const outlookChartData = data.capacity_outlook.map((r: GFTCapacityOutlookRecord) => ({
    year: r.year,
    OCGT: r.ocgt_mw,
    CCGT: r.ccgt_mw,
    'H2 Turbine': r.h2_turbine_mw,
  }))

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-900/40 rounded-lg">
          <Fuel className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Gas-Fired Generation Transition Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Gas peakers, CCGT firming, supply security, and the pathway to hydrogen-capable turbines
          </p>
        </div>
        <span className="ml-auto text-xs text-gray-500">
          Updated: {new Date(data.timestamp).toLocaleString()}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Total Gas Capacity"
          value={`${totalCapacityMW.toLocaleString()} MW`}
          subtitle="NEM + WEM fleet"
          colour="border-orange-700"
        />
        <KpiCard
          title="H2-Capable Units"
          value={`${h2CapableCount} units`}
          subtitle={`of ${data.generators.length} total generators`}
          colour="border-teal-700"
        />
        <KpiCard
          title="Avg Gas SRMC"
          value={`$${avgSRMC.toFixed(0)}/MWh`}
          subtitle="Fleet-weighted average"
          colour="border-amber-700"
        />
        <KpiCard
          title="Avg Gas Reserve Life"
          value={`${avgReserveLife.toFixed(1)} yrs`}
          subtitle="Producing basins only"
          colour="border-blue-700"
        />
      </div>

      {/* Generator Fleet Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-white">Generator Fleet</h2>
          <p className="text-xs text-gray-400">Gas-fired generation units — capacity, technology, SRMC and H2 readiness</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase tracking-wider">
                <th className="text-left px-4 py-2">Unit</th>
                <th className="text-left px-4 py-2">Tech</th>
                <th className="text-left px-4 py-2">Region</th>
                <th className="text-right px-4 py-2">Capacity (MW)</th>
                <th className="text-left px-4 py-2">H2 Ready</th>
                <th className="text-right px-4 py-2">SRMC ($/MWh)</th>
                <th className="text-right px-4 py-2">CF %</th>
                <th className="text-right px-4 py-2">Exit Year</th>
                <th className="text-left px-4 py-2">Trigger</th>
              </tr>
            </thead>
            <tbody>
              {data.generators.map((g: GFTGeneratorRecord) => (
                <tr key={g.unit_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2 font-medium text-white">{g.unit_name}</td>
                  <td className="px-4 py-2">
                    <Badge label={g.technology} style={TECH_STYLE[g.technology] ?? 'bg-gray-700 text-gray-300'} />
                  </td>
                  <td className="px-4 py-2 text-gray-400">{g.region}</td>
                  <td className="px-4 py-2 text-right font-mono">{g.capacity_mw.toLocaleString()}</td>
                  <td className="px-4 py-2">
                    {g.h2_capable
                      ? <Badge label={`H2 Ready ${g.h2_ready_year ?? ''}`} style="bg-teal-900 text-teal-300 border border-teal-700" />
                      : g.h2_ready_year
                        ? <Badge label={`H2 ${g.h2_ready_year}`} style="bg-gray-700 text-gray-400 border border-gray-600" />
                        : <span className="text-gray-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{g.srmc_aud_mwh.toFixed(0)}</td>
                  <td className="px-4 py-2 text-right font-mono">{g.capacity_factor_pct.toFixed(0)}%</td>
                  <td className="px-4 py-2 text-right font-mono">{g.exit_year ?? '—'}</td>
                  <td className="px-4 py-2">
                    {g.exit_trigger
                      ? <Badge label={g.exit_trigger} style={EXIT_TRIGGER_STYLE[g.exit_trigger] ?? 'bg-gray-700 text-gray-300'} />
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gas Supply Basin Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-white">Gas Supply Basins</h2>
          <p className="text-xs text-gray-400">Domestic reserves, production rates, pricing and pipeline connectivity</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase tracking-wider">
                <th className="text-left px-4 py-2">Basin</th>
                <th className="text-left px-4 py-2">Region</th>
                <th className="text-right px-4 py-2">Reserves (PJ)</th>
                <th className="text-right px-4 py-2">Production (PJ/yr)</th>
                <th className="text-right px-4 py-2">Reserve Life (yrs)</th>
                <th className="text-right px-4 py-2">Dom. Reservation %</th>
                <th className="text-right px-4 py-2">Price ($/GJ)</th>
                <th className="text-left px-4 py-2">Price Trend</th>
                <th className="text-center px-4 py-2">Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {data.gas_supply.map((b: GFTGasSupplyRecord) => (
                <tr key={b.basin} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2 font-medium text-white">{b.basin}</td>
                  <td className="px-4 py-2 text-gray-400">{b.region}</td>
                  <td className="px-4 py-2 text-right font-mono">{b.reserves_pj.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono">{b.production_pj_yr.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {b.reserve_life_years > 900 ? 'Undevel.' : b.reserve_life_years.toFixed(1)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{b.domestic_reservation_pct.toFixed(0)}%</td>
                  <td className="px-4 py-2 text-right font-mono">${b.price_aud_gj.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <Badge label={b.price_trend} style={TREND_STYLE[b.price_trend] ?? 'bg-gray-700 text-gray-300'} />
                  </td>
                  <td className="px-4 py-2 text-center">
                    {b.pipeline_connected
                      ? <span className="text-emerald-400">Yes</span>
                      : <span className="text-red-400">No</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* H2 Blending Pathway Chart */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-white mb-1">Hydrogen Blending Pathway</h2>
          <p className="text-xs text-gray-400 mb-4">Blend % by unit — 2025 / 2030 / 2035 targets</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={blendChartData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="unit"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                label={{ value: 'Blend %', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10, dy: 40 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <ReferenceLine y={20} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '20% target', fill: '#f59e0b', fontSize: 10 }} />
              <Bar dataKey="2025" fill="#60a5fa" radius={[2, 2, 0, 0]} />
              <Bar dataKey="2030" fill="#34d399" radius={[2, 2, 0, 0]} />
              <Bar dataKey="2035" fill="#f97316" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Capacity Outlook Stacked Area Chart */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-white mb-1">Capacity Outlook 2024–2031</h2>
          <p className="text-xs text-gray-400 mb-4">OCGT / CCGT / H2 Turbine stacked capacity (MW)</p>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={outlookChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10, dy: 20 }}
              />
              <Tooltip content={<OutlookTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Area type="monotone" dataKey="OCGT"       stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.55} />
              <Area type="monotone" dataKey="CCGT"       stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.55} />
              <Area type="monotone" dataKey="H2 Turbine" stackId="1" stroke="#34d399" fill="#34d399" fillOpacity={0.75} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* H2 Blending Details Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-white">Hydrogen Blending Details</h2>
          <p className="text-xs text-gray-400">Conversion costs, operational risk and derating per unit</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase tracking-wider">
                <th className="text-left px-4 py-2">Unit ID</th>
                <th className="text-right px-4 py-2">Blend 2025 %</th>
                <th className="text-right px-4 py-2">Blend 2030 %</th>
                <th className="text-right px-4 py-2">Blend 2035 %</th>
                <th className="text-right px-4 py-2">Conversion Cost ($M)</th>
                <th className="text-left px-4 py-2">Operational Risk</th>
                <th className="text-right px-4 py-2">Derating %</th>
              </tr>
            </thead>
            <tbody>
              {data.hydrogen_blending.map((r: GFTHydrogenBlendRecord) => (
                <tr key={r.unit_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2 font-medium text-white font-mono">{r.unit_id}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.blend_pct_2025.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.blend_pct_2030.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.blend_pct_2035.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.conversion_cost_m_aud.toFixed(0)}</td>
                  <td className="px-4 py-2">
                    <Badge label={r.operational_risk} style={RISK_STYLE[r.operational_risk] ?? 'bg-gray-700 text-gray-300'} />
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{r.derating_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Capacity Outlook Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-white">Capacity Outlook Detail</h2>
          <p className="text-xs text-gray-400">Annual breakdown of gas capacity, retirements and generation role</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase tracking-wider">
                <th className="text-left px-4 py-2">Year</th>
                <th className="text-right px-4 py-2">OCGT (MW)</th>
                <th className="text-right px-4 py-2">CCGT (MW)</th>
                <th className="text-right px-4 py-2">H2 Turbine (MW)</th>
                <th className="text-right px-4 py-2">Total (MW)</th>
                <th className="text-right px-4 py-2">Retirements (MW)</th>
                <th className="text-right px-4 py-2">Generation (TWh)</th>
                <th className="text-left px-4 py-2">Role in NEM</th>
              </tr>
            </thead>
            <tbody>
              {data.capacity_outlook.map((r: GFTCapacityOutlookRecord) => (
                <tr key={r.year} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2 font-semibold text-white">{r.year}</td>
                  <td className="px-4 py-2 text-right font-mono text-amber-300">{r.ocgt_mw.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono text-blue-300">{r.ccgt_mw.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-300">{r.h2_turbine_mw.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-white">{r.total_gas_mw.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono text-red-400">{r.retirements_mw.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.gas_generation_twh.toFixed(0)}</td>
                  <td className="px-4 py-2 text-gray-400">{r.role_in_nem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
