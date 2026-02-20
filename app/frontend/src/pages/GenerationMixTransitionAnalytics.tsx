import { useEffect, useState } from 'react'
import { BarChart as BarChartIcon } from 'lucide-react'
import {
  getGenerationMixTransitionDashboard,
  GMTDashboard,
  GMTAnnualMixRecord,
  GMTMilestoneRecord,
  GMTRetirementScheduleRecord,
  GMTCapacityForecastRecord,
  GMTInvestmentRecord,
} from '../api/client'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ── KPI Card ──────────────────────────────────────────────────────────────────

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

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ── Technology colour map ──────────────────────────────────────────────────────

const TECH_COLORS: Record<string, string> = {
  coal: '#ef4444',
  gas: '#f97316',
  wind: '#3b82f6',
  solar_utility: '#eab308',
  solar_rooftop: '#fde047',
  hydro: '#06b6d4',
  battery: '#a855f7',
  other: '#6b7280',
}

const SCENARIO_COLORS: Record<string, string> = {
  STEP_CHANGE: '#10b981',
  PROGRESSIVE_CHANGE: '#3b82f6',
  SLOW_CHANGE: '#f97316',
}

const INV_COLORS: Record<string, string> = {
  WIND: '#3b82f6',
  SOLAR_UTILITY: '#eab308',
  BATTERY_STORAGE: '#a855f7',
}

// ── Annual Mix chart data preparation ─────────────────────────────────────────

function buildAnnualMixChartData(
  records: GMTAnnualMixRecord[],
  region: string,
): object[] {
  const filtered = records
    .filter((r) => r.region === region)
    .sort((a, b) => a.year - b.year)
  return filtered.map((r) => ({
    year: r.year,
    Coal: r.coal_pct,
    Gas: r.gas_pct,
    Wind: r.wind_pct,
    'Solar Utility': r.solar_utility_pct,
    'Solar Rooftop': r.solar_rooftop_pct,
    Hydro: r.hydro_pct,
    Battery: r.battery_pct,
    Other: r.other_pct,
    renewable_pct: r.renewable_pct,
  }))
}

// ── Capacity Forecast chart data ───────────────────────────────────────────────

function buildForecastChartData(
  records: GMTCapacityForecastRecord[],
  region: string,
): object[] {
  const filtered = records.filter((r) => r.region === region)
  const byYear: Record<number, Record<string, number>> = {}
  filtered.forEach((r) => {
    if (!byYear[r.year]) byYear[r.year] = { year: r.year }
    byYear[r.year][`${r.scenario}_total`] = r.total_gw
    byYear[r.year][`${r.scenario}_renewable`] =
      r.wind_gw + r.solar_utility_gw + r.solar_rooftop_gw + r.hydro_gw + r.storage_gw
  })
  return Object.values(byYear).sort((a: any, b: any) => a.year - b.year)
}

// ── Investment chart data ──────────────────────────────────────────────────────

function buildInvestmentChartData(records: GMTInvestmentRecord[]): object[] {
  const byYear: Record<number, Record<string, number>> = {}
  records.forEach((r) => {
    if (!byYear[r.year]) byYear[r.year] = { year: r.year }
    byYear[r.year][r.technology] = r.investment_bn
  })
  return Object.values(byYear).sort((a: any, b: any) => a.year - b.year)
}

// ── Significance badge ─────────────────────────────────────────────────────────

function SignificanceBadge({ sig }: { sig: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-semibold ${
        sig === 'HIGH'
          ? 'bg-red-900 text-red-300'
          : 'bg-yellow-900 text-yellow-300'
      }`}
    >
      {sig}
    </span>
  )
}

// ── Gap badge ─────────────────────────────────────────────────────────────────

function GapBadge({ gap }: { gap: number }) {
  const positive = gap >= 0
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-semibold ${
        positive ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'
      }`}
    >
      {positive ? '+' : ''}
      {gap.toFixed(0)} MW
    </span>
  )
}

// ── Retirement type badge ──────────────────────────────────────────────────────

function RetTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    SCHEDULED: 'bg-blue-900 text-blue-300',
    ECONOMIC: 'bg-orange-900 text-orange-300',
    REGULATORY: 'bg-purple-900 text-purple-300',
    VOLUNTARY: 'bg-teal-900 text-teal-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[type] ?? 'bg-gray-700 text-gray-300'}`}>
      {type}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function GenerationMixTransitionAnalytics() {
  const [data, setData] = useState<GMTDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mixRegion, setMixRegion] = useState('NSW')
  const [forecastRegion, setForecastRegion] = useState('NSW')

  useEffect(() => {
    getGenerationMixTransitionDashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Generation Mix Transition data...
      </div>
    )
  if (error)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error}
      </div>
    )
  if (!data) return null

  const summary = data.summary as Record<string, number>
  const mixChartData = buildAnnualMixChartData(data.annual_mix, mixRegion)
  const forecastChartData = buildForecastChartData(data.capacity_forecast, forecastRegion)
  const investmentChartData = buildInvestmentChartData(data.investment)

  const REGIONS = ['NSW', 'VIC', 'QLD', 'SA', 'TAS']

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-white">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <BarChartIcon className="w-7 h-7 text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Generation Mix Transition Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            NEM shift from coal to renewables — technology milestones, retirement timelines &amp; replacement capacity
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard
          label="Renewables 2024"
          value={summary.current_renewable_pct_2024}
          unit="%"
          color="text-emerald-400"
          sub="NEM-wide annual share"
        />
        <KpiCard
          label="Coal 2024"
          value={summary.coal_pct_2024}
          unit="%"
          color="text-red-400"
          sub="NEM-wide annual share"
        />
        <KpiCard
          label="2030 RE Target"
          value={summary.renewable_target_2030_pct}
          unit="%"
          color="text-blue-400"
          sub="Federal target"
        />
        <KpiCard
          label="Coal Retirements"
          value={(summary.coal_retirements_by_2030_mw / 1000).toFixed(1)}
          unit="GW"
          color="text-orange-400"
          sub="By 2030"
        />
        <KpiCard
          label="Replacement Gap"
          value={summary.replacement_gap_mw}
          unit="MW"
          color="text-yellow-400"
          sub="Unmatched capacity"
        />
        <KpiCard
          label="Emission Intensity"
          value={summary.emission_intensity_2024_kg_mwh}
          unit="kg/MWh"
          color="text-purple-400"
          sub="2024 NEM average"
        />
        <KpiCard
          label="Peak RE Hour"
          value={summary.peak_renewable_hour_pct}
          unit="%"
          color="text-teal-400"
          sub="SA record"
        />
      </div>

      {/* ── Annual Mix Evolution ── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <SectionHeader
            title="Annual Generation Mix Evolution (2010–2024)"
            subtitle="Technology share by region — stacked area chart"
          />
          <div className="flex gap-2">
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => setMixRegion(r)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  mixRegion === r
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={mixChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Area type="monotone" dataKey="Coal" stackId="1" stroke={TECH_COLORS.coal} fill={TECH_COLORS.coal} fillOpacity={0.8} />
            <Area type="monotone" dataKey="Gas" stackId="1" stroke={TECH_COLORS.gas} fill={TECH_COLORS.gas} fillOpacity={0.8} />
            <Area type="monotone" dataKey="Hydro" stackId="1" stroke={TECH_COLORS.hydro} fill={TECH_COLORS.hydro} fillOpacity={0.8} />
            <Area type="monotone" dataKey="Wind" stackId="1" stroke={TECH_COLORS.wind} fill={TECH_COLORS.wind} fillOpacity={0.8} />
            <Area type="monotone" dataKey="Solar Utility" stackId="1" stroke={TECH_COLORS.solar_utility} fill={TECH_COLORS.solar_utility} fillOpacity={0.8} />
            <Area type="monotone" dataKey="Solar Rooftop" stackId="1" stroke={TECH_COLORS.solar_rooftop} fill={TECH_COLORS.solar_rooftop} fillOpacity={0.8} />
            <Area type="monotone" dataKey="Battery" stackId="1" stroke={TECH_COLORS.battery} fill={TECH_COLORS.battery} fillOpacity={0.8} />
            <Area type="monotone" dataKey="Other" stackId="1" stroke={TECH_COLORS.other} fill={TECH_COLORS.other} fillOpacity={0.8} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Milestones Timeline ── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionHeader
          title="Technology Milestones"
          subtitle="Key achievements and forecast targets for the NEM's clean energy transition"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4 font-medium">Milestone</th>
                <th className="pb-2 pr-4 font-medium">Region</th>
                <th className="pb-2 pr-4 font-medium">Achieved</th>
                <th className="pb-2 pr-4 font-medium">Forecast</th>
                <th className="pb-2 pr-4 font-medium">Significance</th>
                <th className="pb-2 font-medium">Next Milestone</th>
              </tr>
            </thead>
            <tbody>
              {data.milestones.map((m: GMTMilestoneRecord, i: number) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 text-white font-medium">{m.milestone}</td>
                  <td className="py-2 pr-4">
                    <span className="bg-gray-700 text-gray-200 px-2 py-0.5 rounded text-xs">{m.region}</span>
                  </td>
                  <td className="py-2 pr-4">
                    {m.achieved_date ? (
                      <span className="text-emerald-400">{m.achieved_date}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {m.forecast_date ? (
                      <span className="text-blue-400">{m.forecast_date}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <SignificanceBadge sig={m.significance} />
                  </td>
                  <td className="py-2 text-gray-400 text-xs">{m.next_milestone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Retirement Schedule ── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionHeader
          title="Generator Retirement Schedule &amp; Replacement Gap Analysis"
          subtitle="Scheduled, economic, and regulatory plant closures with replacement capacity tracking"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-3 font-medium">Plant</th>
                <th className="pb-2 pr-3 font-medium">Technology</th>
                <th className="pb-2 pr-3 font-medium">Region</th>
                <th className="pb-2 pr-3 font-medium">Capacity</th>
                <th className="pb-2 pr-3 font-medium">Retirement Yr</th>
                <th className="pb-2 pr-3 font-medium">Type</th>
                <th className="pb-2 pr-3 font-medium">Replacement</th>
                <th className="pb-2 pr-3 font-medium">Replace MW</th>
                <th className="pb-2 pr-3 font-medium">Timeline</th>
                <th className="pb-2 font-medium">Gap</th>
              </tr>
            </thead>
            <tbody>
              {data.retirement_schedule.map((r: GMTRetirementScheduleRecord, i: number) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-3 text-white font-medium">{r.plant_name}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      r.technology.includes('COAL') ? 'bg-red-900 text-red-300' : 'bg-orange-900 text-orange-300'
                    }`}>
                      {r.technology}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="bg-gray-700 text-gray-200 px-2 py-0.5 rounded text-xs">{r.region}</span>
                  </td>
                  <td className="py-2 pr-3 text-gray-300">{r.capacity_mw.toFixed(0)} MW</td>
                  <td className="py-2 pr-3 text-yellow-400 font-semibold">{r.expected_retirement_year}</td>
                  <td className="py-2 pr-3">
                    <RetTypeBadge type={r.retirement_type} />
                  </td>
                  <td className="py-2 pr-3">
                    <span className="bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded text-xs font-semibold">
                      {r.replacement_technology}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-300">{r.replacement_capacity_mw.toFixed(0)} MW</td>
                  <td className="py-2 pr-3 text-gray-400">{r.replacement_timeline_years}y</td>
                  <td className="py-2">
                    <GapBadge gap={r.net_capacity_gap_mw} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Capacity Forecast ── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <SectionHeader
            title="Capacity Forecast by Scenario (2030–2050)"
            subtitle="Total installed capacity and renewable capacity across ISP scenarios"
          />
          <div className="flex gap-2">
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => setForecastRegion(r)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  forecastRegion === r
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={forecastChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${v} GW`} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(value: number, name: string) => [`${value.toFixed(1)} GW`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {Object.entries(SCENARIO_COLORS).map(([scenario, color]) => (
              <Bar
                key={`${scenario}_total`}
                dataKey={`${scenario}_total`}
                name={`${scenario.replace('_', ' ')} Total`}
                fill={color}
                fillOpacity={0.7}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Investment Trends ── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionHeader
          title="Clean Energy Investment Trends (2020–2029)"
          subtitle="Annual investment by technology (A$ billions)"
        />
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={investmentChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v}B`} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(value: number, name: string) => [`$${value.toFixed(2)}B`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {Object.entries(INV_COLORS).map(([tech, color]) => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                name={tech.replace('_', ' ')}
                stroke={color}
                strokeWidth={2.5}
                dot={{ fill: color, r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
