import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { Home } from 'lucide-react'
import {
  getElectricityConsumerBehaviourDashboard,
  ECBSDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const REGION_COLOURS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#8b5cf6',
  QLD: '#f59e0b',
  SA:  '#10b981',
  TAS: '#06b6d4',
}

const SEASON_COLOURS: Record<string, string> = {
  Summer: '#ef4444',
  Autumn: '#f59e0b',
  Winter: '#3b82f6',
  Spring: '#10b981',
}

const TECHNOLOGY_COLOURS: Record<string, string> = {
  Solar:        '#f59e0b',
  Battery:      '#8b5cf6',
  EV:           '#3b82f6',
  'Smart Meter':'#10b981',
  'Heat Pump':  '#ef4444',
  'Smart HVAC': '#06b6d4',
}

const INTERVENTION_COLOURS: Record<string, string> = {
  'TOU Tariff':      '#3b82f6',
  'Dynamic Pricing': '#ef4444',
  'Energy Report':   '#10b981',
  'Smart Alert':     '#f59e0b',
  'Gamification':    '#8b5cf6',
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-medium">
        <Home size={16} />
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ElectricityConsumerBehaviourAnalytics() {
  const [data, setData] = useState<ECBSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityConsumerBehaviourDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Electricity Consumer Behaviour & Smart Home Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>

  // ── Chart 1: Bar — avg_annual_consumption_kwh by segment × region (grouped) ──
  const segments = ['Tech Enthusiast', 'Cost Saver', 'Green Consumer', 'Passive User', 'Business Owner']
  const regions = ['NSW', 'VIC', 'QLD', 'SA', 'TAS']

  const consumptionBySegion: Record<string, Record<string, number>> = {}
  for (const seg of data.segments) {
    if (!consumptionBySegion[seg.segment]) consumptionBySegion[seg.segment] = {}
    consumptionBySegion[seg.segment][seg.region] = seg.avg_annual_consumption_kwh
  }
  const chart1Data = segments.map((seg) => ({
    segment: seg,
    ...(consumptionBySegion[seg] ?? {}),
  }))

  // ── Chart 2: Line — avg_demand_kw by hour_of_day for 4 seasons (weekday only) ──
  const seasonsList = ['Summer', 'Autumn', 'Winter', 'Spring']
  const demandByHourSeason: Record<number, Record<string, number[]>> = {}
  for (const lp of data.load_profiles) {
    if (lp.day_type !== 'Weekday') continue
    if (!demandByHourSeason[lp.hour_of_day]) demandByHourSeason[lp.hour_of_day] = {}
    if (!demandByHourSeason[lp.hour_of_day][lp.season]) demandByHourSeason[lp.hour_of_day][lp.season] = []
    demandByHourSeason[lp.hour_of_day][lp.season].push(lp.avg_demand_kw)
  }
  const chart2Data = Array.from({ length: 24 }, (_, hour) => {
    const entry: Record<string, number | string> = { hour: String(hour).padStart(2, '0') + ':00' }
    for (const season of seasonsList) {
      const vals = demandByHourSeason[hour]?.[season] ?? []
      entry[season] = vals.length > 0 ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)) : 0
    }
    return entry
  })

  // ── Chart 3: Bar — annual_savings_per_household by technology coloured by region ──
  const savingsByTechRegion: Record<string, Record<string, number>> = {}
  for (const sh of data.smart_home) {
    if (!savingsByTechRegion[sh.technology]) savingsByTechRegion[sh.technology] = {}
    savingsByTechRegion[sh.technology][sh.region] = sh.annual_savings_per_household
  }
  const smartTechnologies = ['Smart Thermostat', 'Smart EV Charger', 'HEMS', 'Smart Hot Water', 'Smart Pool Pump']
  const chart3Data = smartTechnologies.map((tech) => ({
    technology: tech,
    ...(savingsByTechRegion[tech] ?? {}),
  }))

  // ── Chart 4: Bar — load_reduction_pct by intervention_type sorted desc ──
  const reductionByIntervention: Record<string, number[]> = {}
  for (const iv of data.interventions) {
    if (!reductionByIntervention[iv.intervention_type]) reductionByIntervention[iv.intervention_type] = []
    reductionByIntervention[iv.intervention_type].push(iv.load_reduction_pct)
  }
  const chart4Data = Object.entries(reductionByIntervention)
    .map(([intervention_type, vals]) => ({
      intervention_type,
      avg_load_reduction_pct: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)),
    }))
    .sort((a, b) => b.avg_load_reduction_pct - a.avg_load_reduction_pct)

  // ── Chart 5: Line — adoption_pct by year for 6 technologies ──
  const adoptionTechList = ['Solar', 'Battery', 'EV', 'Smart Meter', 'Heat Pump', 'Smart HVAC']
  const adoptionByYearTech: Record<number, Record<string, number[]>> = {}
  for (const at of data.adoption_trends) {
    if (!adoptionByYearTech[at.year]) adoptionByYearTech[at.year] = {}
    if (!adoptionByYearTech[at.year][at.technology]) adoptionByYearTech[at.year][at.technology] = []
    adoptionByYearTech[at.year][at.technology].push(at.adoption_pct)
  }
  const trendYears = Array.from({ length: 11 }, (_, i) => 2020 + i)
  const chart5Data = trendYears.map((year) => {
    const entry: Record<string, number | string> = { year: String(year) }
    for (const tech of adoptionTechList) {
      const vals = adoptionByYearTech[year]?.[tech] ?? []
      entry[tech] = vals.length > 0 ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : 0
    }
    return entry
  })

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Home size={28} className="text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Electricity Consumer Behaviour &amp; Smart Home Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sprint 129b — ECBS | Consumer Segments, Load Profiles, Smart Home Technologies &amp; Behaviour Interventions
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Avg Solar Adoption %"
          value={`${Number(summary.avg_solar_adoption_pct ?? 0).toFixed(1)}%`}
          sub="Average across all consumer segments and regions"
        />
        <KpiCard
          label="Avg Battery Adoption %"
          value={`${Number(summary.avg_battery_adoption_pct ?? 0).toFixed(1)}%`}
          sub="Average across all consumer segments and regions"
        />
        <KpiCard
          label="Most Effective Intervention"
          value={String(summary.most_effective_intervention ?? '—')}
          sub="Highest average load reduction intervention type"
        />
        <KpiCard
          label="Peak Flexibility %"
          value={`${Number(summary.peak_flexibility_pct ?? 0).toFixed(1)}%`}
          sub="Maximum flexible load share across all load profiles"
        />
      </div>

      {/* Chart 1: Bar — avg_annual_consumption_kwh by segment × region (grouped) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 1: Annual Consumption by Consumer Segment &amp; Region (kWh)
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chart1Data} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="segment" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
            <YAxis unit=" kWh" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString()} kWh`]} />
            <Legend />
            {regions.map((region) => (
              <Bar key={region} dataKey={region} name={region} fill={REGION_COLOURS[region] ?? '#6b7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Line — avg_demand_kw by hour_of_day for 4 seasons (weekday only) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 2: Weekday Load Profile by Hour &amp; Season (avg kW)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chart2Data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
            <YAxis unit=" kW" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(3)} kW`]} />
            <Legend />
            {seasonsList.map((season) => (
              <Line
                key={season}
                type="monotone"
                dataKey={season}
                name={season}
                stroke={SEASON_COLOURS[season] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Bar — annual_savings_per_household by technology coloured by region */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 3: Annual Household Savings by Smart Home Technology &amp; Region ($)
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chart3Data} margin={{ top: 10, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="technology" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
            <YAxis unit=" $" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`]} />
            <Legend />
            {regions.map((region) => (
              <Bar key={region} dataKey={region} name={region} fill={REGION_COLOURS[region] ?? '#6b7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Bar — load_reduction_pct by intervention_type sorted desc */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 4: Load Reduction % by Behaviour Intervention Type (sorted desc)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart4Data} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="intervention_type" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
            <YAxis unit="%" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'Avg Load Reduction']} />
            <Bar dataKey="avg_load_reduction_pct" name="Avg Load Reduction (%)">
              {chart4Data.map((entry) => (
                <rect key={entry.intervention_type} fill={INTERVENTION_COLOURS[entry.intervention_type] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Line — adoption_pct by year for 6 technologies */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 5: Technology Adoption Trends 2020–2030 (%)
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chart5Data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis unit="%" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`]} />
            <Legend />
            {adoptionTechList.map((tech) => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                name={tech}
                stroke={TECHNOLOGY_COLOURS[tech] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Solar Adoption %</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {Number(summary.avg_solar_adoption_pct ?? 0).toFixed(2)}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Battery Adoption %</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {Number(summary.avg_battery_adoption_pct ?? 0).toFixed(2)}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Most Effective Intervention</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {String(summary.most_effective_intervention ?? '—')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Peak Flexibility %</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {Number(summary.peak_flexibility_pct ?? 0).toFixed(2)}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fastest Growing Technology</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {String(summary.fastest_growing_technology ?? '—')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Consumer Segments</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">{data.segments.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Load Profile Records</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">{data.load_profiles.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Smart Home Technologies</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">{data.smart_home.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Behaviour Interventions</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">{data.interventions.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Adoption Trend Records</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">{data.adoption_trends.length}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
