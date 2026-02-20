import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import {
  getStorageDurationEconomicsDashboard,
  ESDDashboard,
  ESDTechnologyRecord,
  ESDRevenueStackRecord,
  ESDDurationNeedRecord,
  ESDArbitrageRecord,
  ESDCapitalCostRecord,
} from '../api/client'
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

// ── Helpers ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  sub,
  color = 'text-emerald-400',
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {sub && <p className="text-sm text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function TrlBadge({ trl }: { trl: number }) {
  const color =
    trl >= 9 ? 'bg-emerald-700 text-emerald-200'
    : trl >= 7 ? 'bg-blue-700 text-blue-200'
    : trl >= 5 ? 'bg-yellow-700 text-yellow-200'
    : 'bg-gray-600 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      TRL {trl}
    </span>
  )
}

function AvailabilityBadge({ availability }: { availability: string }) {
  const map: Record<string, string> = {
    COMMERCIAL:  'bg-emerald-800 text-emerald-300',
    DEMONSTRATION: 'bg-blue-800 text-blue-300',
    PILOT:       'bg-yellow-800 text-yellow-300',
    RESEARCH:    'bg-red-800 text-red-300',
  }
  const cls = map[availability] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {availability.charAt(0) + availability.slice(1).toLowerCase()}
    </span>
  )
}

// ── Technology table ────────────────────────────────────────────────────────

function TechnologyTable({ technologies }: { technologies: ESDTechnologyRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-900 border-b border-gray-700">
          <tr>
            {[
              'Technology','Duration (h)','CapEx $/kWh','CapEx $/kW',
              'OpEx $/kWh/yr','RTE %','Cycle Life','Cal. Life (yr)',
              'TRL','Availability','Best Use Case',
            ].map(h => (
              <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {technologies.map(t => (
            <tr key={t.technology} className="border-b border-gray-700 hover:bg-gray-750">
              <td className="px-3 py-2 font-medium text-white whitespace-nowrap">
                {t.technology.replace(/_/g, ' ')}
              </td>
              <td className="px-3 py-2">{t.duration_hr}</td>
              <td className="px-3 py-2">{t.capex_per_kwh.toFixed(0)}</td>
              <td className="px-3 py-2">{t.capex_per_kw.toFixed(0)}</td>
              <td className="px-3 py-2">{t.opex_per_kwh_yr.toFixed(1)}</td>
              <td className="px-3 py-2">{t.round_trip_efficiency_pct.toFixed(1)}</td>
              <td className="px-3 py-2">{t.cycle_life.toLocaleString()}</td>
              <td className="px-3 py-2">{t.calendar_life_years}</td>
              <td className="px-3 py-2"><TrlBadge trl={t.trl} /></td>
              <td className="px-3 py-2"><AvailabilityBadge availability={t.commercial_availability} /></td>
              <td className="px-3 py-2 text-xs text-gray-400 max-w-xs">{t.best_use_case}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Revenue stack chart ─────────────────────────────────────────────────────

function RevenueStackChart({ records }: { records: ESDRevenueStackRecord[] }) {
  // Aggregate by technology + scenario for 2024/2030/2035, region NSW
  const scenarioFilter = ['2024', '2030', '2035']
  const filtered = records.filter(r => r.region === 'NSW' && scenarioFilter.includes(r.scenario))

  // Group by technology + scenario (pick first duration for each)
  const seen = new Set<string>()
  const chartData: {
    name: string
    arbitrage: number
    fcas_raise: number
    fcas_lower: number
    capacity_market: number
    network_services: number
  }[] = []

  for (const r of filtered) {
    const key = `${r.technology}_${r.scenario}`
    if (seen.has(key)) continue
    seen.add(key)
    chartData.push({
      name: `${r.technology.replace(/_/g, ' ').replace('BESS', '').trim()} (${r.scenario})`,
      arbitrage: r.arbitrage_revenue_per_mwh_yr,
      fcas_raise: r.fcas_raise_revenue_per_mwh_yr,
      fcas_lower: r.fcas_lower_revenue_per_mwh_yr,
      capacity_market: r.capacity_market_revenue_per_mwh_yr,
      network_services: r.network_services_revenue_per_mwh_yr,
    })
  }

  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 100 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="name"
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          angle={-40}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/MWh" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
          formatter={(v: number) => `$${v.toFixed(1)}/MWh·yr`}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 16 }} />
        <Bar dataKey="arbitrage"       name="Arbitrage"       stackId="a" fill="#10b981" />
        <Bar dataKey="fcas_raise"      name="FCAS Raise"      stackId="a" fill="#3b82f6" />
        <Bar dataKey="fcas_lower"      name="FCAS Lower"      stackId="a" fill="#6366f1" />
        <Bar dataKey="capacity_market" name="Capacity Market" stackId="a" fill="#f59e0b" />
        <Bar dataKey="network_services"name="Network Services"stackId="a" fill="#ec4899" />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Duration need / storage gap chart ──────────────────────────────────────

function DurationNeedChart({ records }: { records: ESDDurationNeedRecord[] }) {
  // Show storage gap by region for each scenario year
  const years = [2025, 2030, 2035, 2040]
  const regions = ['QLD', 'NSW', 'VIC', 'SA', 'TAS']

  const chartData = regions.map(region => {
    const entry: Record<string, string | number> = { region }
    for (const yr of years) {
      const rec = records.find(r => r.region === region && r.scenario_year === yr)
      entry[`gap_${yr}`] = rec ? Math.round(rec.storage_gap_mwh / 1000) : 0
    }
    return entry
  })

  const yearColors: Record<number, string> = {
    2025: '#6b7280', 2030: '#3b82f6', 2035: '#10b981', 2040: '#f59e0b',
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" GWh" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
          formatter={(v: number) => `${v.toFixed(0)} GWh gap`}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        {years.map(yr => (
          <Bar key={yr} dataKey={`gap_${yr}`} name={String(yr)} fill={yearColors[yr]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Arbitrage by duration chart ─────────────────────────────────────────────

function ArbitrageChart({ records }: { records: ESDArbitrageRecord[] }) {
  const durations = [2, 4, 8, 24]
  const regions   = ['QLD', 'NSW', 'VIC', 'SA', 'TAS']

  const chartData = regions.map(region => {
    const entry: Record<string, string | number> = { region }
    for (const d of durations) {
      const rec = records.find(r => r.region === region && r.duration_hr === d)
      entry[`dur_${d}h`] = rec ? rec.avg_daily_arbitrage_spread : 0
    }
    return entry
  })

  const durColors: Record<string, string> = {
    dur_2h: '#6366f1', dur_4h: '#10b981', dur_8h: '#f59e0b', dur_24h: '#ef4444',
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/MWh" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
          formatter={(v: number) => `$${v.toFixed(1)}/MWh spread`}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        {['dur_2h', 'dur_4h', 'dur_8h', 'dur_24h'].map(key => (
          <Bar key={key} dataKey={key} name={key.replace('dur_', '')} fill={durColors[key]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Capital cost curves ─────────────────────────────────────────────────────

const TECH_COLORS: Record<string, string> = {
  LFP_BESS:          '#10b981',
  NMC_BESS:          '#3b82f6',
  FLOW_VANADIUM:     '#f59e0b',
  PUMPED_HYDRO:      '#6366f1',
  COMPRESSED_AIR:    '#ec4899',
  LIQUID_AIR:        '#14b8a6',
  HYDROGEN_STORAGE:  '#f97316',
  GRAVITY:           '#a78bfa',
}

function CapitalCostChart({ records }: { records: ESDCapitalCostRecord[] }) {
  const years = [2024, 2025, 2026, 2027, 2028]
  const techs = [...new Set(records.map(r => r.technology))]

  const chartData = years.map(yr => {
    const entry: Record<string, number | string> = { year: yr }
    for (const tech of techs) {
      const rec = records.find(r => r.year === yr && r.technology === tech)
      if (rec) entry[tech] = rec.capex_per_kwh
    }
    return entry
  })

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/kWh" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
          formatter={(v: number, name: string) => [`$${v.toFixed(1)}/kWh`, name.replace(/_/g, ' ')]}
        />
        <Legend
          wrapperStyle={{ color: '#9ca3af', fontSize: 11 }}
          formatter={(value: string) => value.replace(/_/g, ' ')}
        />
        {techs.map(tech => (
          <Line
            key={tech}
            type="monotone"
            dataKey={tech}
            name={tech}
            stroke={TECH_COLORS[tech] ?? '#9ca3af'}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function StorageDurationEconomicsAnalytics() {
  const [data, setData] = useState<ESDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStorageDurationEconomicsDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading storage duration economics data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Failed to load data: {error}
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>

  // Compute additional KPI: total revenue stacks loaded
  const techSet = [...new Set(data.revenue_stacks.map(r => r.technology))]

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <Clock className="w-7 h-7 text-emerald-400 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Energy Storage Duration Economics Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Economics of 2h / 4h / 8h / 24h / 100h+ storage technologies and technology selection
            for the Australian energy transition
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="4-Hour Optimal Share"
          value={`${summary.optimal_duration_4hr_pct}%`}
          sub="of installed projects"
          color="text-emerald-400"
        />
        <KpiCard
          label="Long Duration Gap"
          value={((summary.long_duration_gap_gwh as number) / 1000).toFixed(0)}
          unit="TWh"
          sub="NEM storage shortfall"
          color="text-red-400"
        />
        <KpiCard
          label="PHES Share (LDES)"
          value={`${summary.phes_share_long_duration_pct}%`}
          sub="of long-duration capacity"
          color="text-blue-400"
        />
        <KpiCard
          label="Avg 4h Arb Spread"
          value={`$${summary.avg_4hr_arbitrage_spread}`}
          unit="/MWh"
          sub="NEM average"
          color="text-yellow-400"
        />
        <KpiCard
          label="Best Tech 2030 (LCOE)"
          value={String(summary.lcoe_best_technology_2030).replace(/_/g, ' ')}
          sub="lowest levelised cost"
          color="text-purple-400"
        />
        <KpiCard
          label="CapEx Reduction 2030"
          value={`${summary.capex_reduction_2030_pct}%`}
          sub="vs 2024 baseline"
          color="text-teal-400"
        />
      </div>

      {/* 1. Technology Comparison Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionHeader
          title="Technology Comparison"
          sub={`${data.technologies.length} storage technologies — CapEx, efficiency, lifetime, TRL and commercial readiness`}
        />
        <TechnologyTable technologies={data.technologies} />
      </div>

      {/* 2. Revenue Stack by Technology & Scenario */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionHeader
          title="Revenue Stack by Technology and Scenario (NSW)"
          sub={`${techSet.length} technologies across 2024 / 2030 / 2035 scenarios — stacked revenue streams in $/MWh·yr`}
        />
        <RevenueStackChart records={data.revenue_stacks} />
      </div>

      {/* 3. Storage Gap by Region */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionHeader
          title="Storage Duration Need and Gap by NEM Region"
          sub="Energy storage shortfall (GWh) projected across scenario years — gap = need minus current installed"
        />
        <DurationNeedChart records={data.duration_needs} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead className="text-gray-400 uppercase border-b border-gray-700">
              <tr>
                {['Region','Year','VRE %','Duration Needed (h)','Need (GWh)','Current (GWh)','Gap (GWh)'].map(h => (
                  <th key={h} className="px-3 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.duration_needs.filter(r => r.scenario_year === 2035).map(r => (
                <tr key={`${r.region}_${r.scenario_year}`} className="border-b border-gray-700">
                  <td className="px-3 py-1.5 font-medium text-white">{r.region}</td>
                  <td className="px-3 py-1.5">{r.scenario_year}</td>
                  <td className="px-3 py-1.5">{r.vre_penetration_pct.toFixed(1)}%</td>
                  <td className="px-3 py-1.5">{r.storage_duration_needed_hr.toFixed(1)} h</td>
                  <td className="px-3 py-1.5">{(r.energy_storage_need_mwh / 1000).toFixed(1)}</td>
                  <td className="px-3 py-1.5">{(r.current_storage_mwh / 1000).toFixed(1)}</td>
                  <td className={`px-3 py-1.5 font-semibold ${r.storage_gap_mwh > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {(r.storage_gap_mwh / 1000).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Arbitrage Spread by Duration and Region */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionHeader
          title="Arbitrage Spread by Duration and Region"
          sub="Average daily peak–off-peak spread ($/MWh) captured at 2h / 4h / 8h / 24h discharge durations"
        />
        <ArbitrageChart records={data.arbitrage} />
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.arbitrage.filter(r => r.region === 'SA').map(r => (
            <div key={`${r.region}_${r.duration_hr}`} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
              <div className="text-xs text-gray-400">{r.region} — {r.duration_hr}h duration</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">
                ${r.avg_daily_arbitrage_spread.toFixed(1)}/MWh
              </div>
              <div className="text-xs text-gray-500">
                {r.annual_cycles.toFixed(0)} cycles/yr &middot; {r.capture_rate_pct.toFixed(1)}% capture
              </div>
              <div className="text-xs text-gray-400 mt-1">
                ${(r.revenue_per_mw_yr / 1000).toFixed(1)}k/MW·yr
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Capital Cost Curves */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionHeader
          title="Capital Cost Curves 2024–2028 (Wright's Law)"
          sub="Projected CapEx decline ($/kWh) by technology driven by learning rates and cumulative global deployment"
        />
        <CapitalCostChart records={data.capital_costs} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead className="text-gray-400 uppercase border-b border-gray-700">
              <tr>
                {['Technology','2024 $/kWh','2028 $/kWh','Learning Rate','Cum. Capacity 2024 (GWh)','Market Share (2024)'].map(h => (
                  <th key={h} className="px-3 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...new Set(data.capital_costs.map(r => r.technology))].map(tech => {
                const rec2024 = data.capital_costs.find(r => r.technology === tech && r.year === 2024)
                const rec2028 = data.capital_costs.find(r => r.technology === tech && r.year === 2028)
                if (!rec2024 || !rec2028) return null
                const reduction = ((rec2024.capex_per_kwh - rec2028.capex_per_kwh) / rec2024.capex_per_kwh * 100).toFixed(1)
                return (
                  <tr key={tech} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="px-3 py-1.5 font-medium text-white">
                      {tech.replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-1.5">${rec2024.capex_per_kwh.toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-emerald-400">${rec2028.capex_per_kwh.toFixed(1)}</td>
                    <td className="px-3 py-1.5">{rec2024.learning_rate_pct.toFixed(1)}%</td>
                    <td className="px-3 py-1.5">{rec2024.cumulative_capacity_gwh_global.toLocaleString()} GWh</td>
                    <td className="px-3 py-1.5">
                      {rec2024.market_share_pct.toFixed(2)}%
                      <span className="ml-2 text-red-400 text-xs">-{reduction}%</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
