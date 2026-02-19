import { useEffect, useState } from 'react'
import { Battery } from 'lucide-react'
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
} from 'recharts'
import {
  api,
  BatteryTechDashboard,
  BatteryTechCostRecord,
  LcosRecord,
  SupplyChainRecord,
} from '../api/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, unit, sub }: { label: string; value: string | number; unit?: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

const TECH_COLORS: Record<string, string> = {
  LI_ION_LFP: '#3b82f6',
  LI_ION_NMC: '#a855f7',
  FLOW_VANADIUM: '#14b8a6',
  SODIUM_ION: '#f97316',
}

const TECH_LABELS: Record<string, string> = {
  LI_ION_LFP: 'Li-ion LFP',
  LI_ION_NMC: 'Li-ion NMC',
  FLOW_VANADIUM: 'Vanadium Flow',
  SODIUM_ION: 'Sodium-Ion',
}

const APP_LABELS: Record<string, string> = {
  UTILITY_2HR: 'Utility 2hr',
  UTILITY_4HR: 'Utility 4hr',
  RESIDENTIAL: 'Residential',
  FREQUENCY_RESPONSE: 'Freq Response',
  LONG_DURATION: 'Long Duration',
}

function hhi_risk(hhi: number): { label: string; color: string } {
  if (hhi > 0.6) return { label: 'High', color: '#ef4444' }
  if (hhi >= 0.4) return { label: 'Medium', color: '#f59e0b' }
  return { label: 'Low', color: '#22c55e' }
}

// ── Cost Trend Chart ──────────────────────────────────────────────────────────

function CostTrendChart({ records }: { records: BatteryTechCostRecord[] }) {
  // Build year-keyed map per technology
  const years = Array.from(new Set(records.map(r => r.year))).sort()
  const techs = ['LI_ION_LFP', 'LI_ION_NMC', 'FLOW_VANADIUM', 'SODIUM_ION']

  const data = years.map(year => {
    const point: Record<string, number | string> = { year }
    techs.forEach(tech => {
      const rec = records.find(r => r.year === year && r.technology === tech)
      if (rec) point[tech] = rec.pack_cost_usd_kwh
    })
    return point
  })

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
        Battery Pack Cost Trend 2015–2024 (USD/kWh)
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $/kWh" width={80} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(value: number, name: string) => [
              `$${value.toFixed(0)}/kWh`,
              TECH_LABELS[name] ?? name,
            ]}
          />
          <Legend formatter={(value) => TECH_LABELS[value] ?? value} wrapperStyle={{ color: '#d1d5db', fontSize: 12 }} />
          {techs.map(tech => (
            <Line
              key={tech}
              type="monotone"
              dataKey={tech}
              stroke={TECH_COLORS[tech]}
              strokeWidth={2}
              dot={{ r: 3, fill: TECH_COLORS[tech] }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── LCOS Comparison Chart ─────────────────────────────────────────────────────

function LcosChart({ records }: { records: LcosRecord[] }) {
  const records2024 = records.filter(r => r.year === 2024)
  const applications = Array.from(new Set(records2024.map(r => r.application))).sort()
  const techs = Array.from(new Set(records2024.map(r => r.technology))).sort()

  const data = applications.map(app => {
    const point: Record<string, number | string> = { application: APP_LABELS[app] ?? app }
    techs.forEach(tech => {
      const rec = records2024.find(r => r.application === app && r.technology === tech)
      if (rec) point[tech] = rec.lcos_aud_mwh
    })
    return point
  })

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
        LCOS by Application & Technology — 2024 (AUD/MWh)
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="application" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" A$/MWh" width={95} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(value: number, name: string) => [
              `A$${value.toFixed(0)}/MWh`,
              TECH_LABELS[name] ?? name,
            ]}
          />
          <Legend formatter={(value) => TECH_LABELS[value] ?? value} wrapperStyle={{ color: '#d1d5db', fontSize: 12 }} />
          {techs.map(tech => (
            <Bar key={tech} dataKey={tech} fill={TECH_COLORS[tech] ?? '#6b7280'} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Technology Comparison Table ───────────────────────────────────────────────

function TechComparisonTable({ records }: { records: BatteryTechCostRecord[] }) {
  const records2024 = records.filter(r => r.year === 2024)

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
        Technology Specifications — 2024
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-xs text-gray-400 py-2 pr-4">Technology</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Pack Cost ($/kWh)</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">System Cost ($/kWh)</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Cycle Life</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">RTE (%)</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Cal. Life (yr)</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Energy Density (Wh/kg)</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Learning Rate (%)</th>
            </tr>
          </thead>
          <tbody>
            {records2024.map(r => (
              <tr key={r.record_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                    style={{
                      backgroundColor: (TECH_COLORS[r.technology] ?? '#6b7280') + '33',
                      color: TECH_COLORS[r.technology] ?? '#9ca3af',
                    }}
                  >
                    {TECH_LABELS[r.technology] ?? r.technology}
                  </span>
                </td>
                <td className="text-right text-white py-2 px-3">${r.pack_cost_usd_kwh.toFixed(0)}</td>
                <td className="text-right text-gray-300 py-2 px-3">${r.system_cost_usd_kwh.toFixed(0)}</td>
                <td className="text-right text-gray-300 py-2 px-3">{r.cycle_life.toLocaleString()}</td>
                <td className="text-right text-gray-300 py-2 px-3">{r.round_trip_efficiency_pct.toFixed(1)}%</td>
                <td className="text-right text-gray-300 py-2 px-3">{r.calendar_life_years}</td>
                <td className="text-right text-gray-300 py-2 px-3">{r.energy_density_wh_kg.toFixed(0)}</td>
                <td className="text-right text-gray-300 py-2 px-3">{r.learning_rate_pct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Supply Chain Risk Table ───────────────────────────────────────────────────

function SupplyChainTable({ records }: { records: SupplyChainRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
        Critical Mineral Supply Chain Risk — 2024
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-xs text-gray-400 py-2 pr-4">Material</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Price (USD/t)</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">YoY Change</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">HHI Concentration</th>
              <th className="text-center text-xs text-gray-400 py-2 px-3">Risk</th>
              <th className="text-left text-xs text-gray-400 py-2 px-3">Top Producer</th>
              <th className="text-left text-xs text-gray-400 py-2 px-3">Battery Exposure</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => {
              const risk = hhi_risk(r.supply_concentration_hhi)
              const priceChangePositive = r.price_change_pct_yr >= 0
              return (
                <tr key={r.record_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-semibold text-white">{r.material}</td>
                  <td className="text-right text-gray-300 py-2 px-3">
                    ${r.price_usd_tonne.toLocaleString()}
                  </td>
                  <td className="text-right py-2 px-3">
                    <span className={priceChangePositive ? 'text-red-400' : 'text-green-400'}>
                      {priceChangePositive ? '+' : ''}{r.price_change_pct_yr.toFixed(1)}%
                    </span>
                  </td>
                  <td className="text-right text-gray-300 py-2 px-3">
                    {r.supply_concentration_hhi.toFixed(2)}
                  </td>
                  <td className="text-center py-2 px-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={{ backgroundColor: risk.color + '33', color: risk.color }}
                    >
                      {risk.label}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-300">{r.top_producer_country}</td>
                  <td className="py-2 px-3 text-gray-400 text-xs">
                    {r.battery_tech_exposure.map(t => TECH_LABELS[t] ?? t).join(', ')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BatteryTechAnalytics() {
  const [dashboard, setDashboard] = useState<BatteryTechDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getBatteryTechDashboard()
      .then(setDashboard)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-gray-400 text-sm">Loading battery technology data...</div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-red-400 text-sm">{error ?? 'Failed to load data'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Battery className="text-blue-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">Battery Technology Economics & Learning Rate Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Li-ion cost trajectories, learning rates, LCOS analysis, competing storage technologies &amp; critical mineral supply chain risk
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Li-ion LFP Pack Cost 2024"
          value={`$${dashboard.li_ion_pack_cost_2024_usd_kwh.toFixed(0)}`}
          unit="USD/kWh"
          sub="BloombergNEF benchmark"
        />
        <KpiCard
          label="Cost Reduction Since 2015"
          value={`${dashboard.cost_reduction_since_2015_pct.toFixed(1)}%`}
          sub="LFP pack cost 2015 → 2024"
        />
        <KpiCard
          label="Projected 2030 Cost"
          value={`$${dashboard.projected_cost_2030_usd_kwh.toFixed(0)}`}
          unit="USD/kWh"
          sub="~20% further reduction forecast"
        />
        <KpiCard
          label="Avg Li-ion Learning Rate"
          value={`${dashboard.avg_li_ion_learning_rate_pct.toFixed(1)}%`}
          sub="Cost reduction per capacity doubling"
        />
      </div>

      {/* Cost Trend Line Chart */}
      <CostTrendChart records={dashboard.cost_records} />

      {/* LCOS Bar Chart */}
      <LcosChart records={dashboard.lcos_records} />

      {/* Technology Comparison Table */}
      <TechComparisonTable records={dashboard.cost_records} />

      {/* Supply Chain Risk Table */}
      <SupplyChainTable records={dashboard.supply_chain} />
    </div>
  )
}
