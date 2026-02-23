import { useEffect, useState } from 'react'
import { Home } from 'lucide-react'
import {
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
import {
  getResidentialSolarSelfConsumptionDashboard,
  RSSCDashboard,
} from '../api/client'

const ARCHETYPE_COLORS: Record<string, string> = {
  'Single Occupant':  '#6366f1',
  'Young Family':     '#22c55e',
  'Retirees':         '#f59e0b',
  'WFH Professional': '#06b6d4',
  'Large Family':     '#ef4444',
  'EV Owner':         '#a855f7',
  'Night Shift':      '#64748b',
  'Rural':            '#84cc16',
}

const SEASON_COLORS: Record<string, string> = {
  Summer: '#f59e0b',
  Autumn: '#f97316',
  Winter: '#6366f1',
  Spring: '#22c55e',
}

const SCENARIO_COLORS: Record<string, string> = {
  'Status Quo':         '#64748b',
  'High Battery Uptake': '#22c55e',
  'Smart Tariff':        '#06b6d4',
}

const FIT_TYPE_COLORS: Record<string, string> = {
  'Single Rate':    '#6366f1',
  'Time-Varying':   '#22c55e',
  'Premium Legacy': '#f59e0b',
  'Market Linked':  '#ef4444',
  'Peer-to-Peer':   '#a855f7',
  'Battery Export': '#06b6d4',
}

export default function ResidentialSolarSelfConsumptionAnalytics() {
  const [data, setData] = useState<RSSCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getResidentialSolarSelfConsumptionDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading Residential Solar Self-Consumption Analytics...</div>
  if (error)   return <div className="p-8 text-center text-red-400">Error: {error}</div>
  if (!data)   return null

  const { households, self_consumption_profile, economics, fit_rates, technology_options, projections, summary } = data

  // Chart 1: Self-Consumption by Archetype — grouped bar
  const archetypes = Array.from(new Set(households.map(h => h.archetype)))
  const archetypeChartData = archetypes.map(arch => {
    const group = households.filter(h => h.archetype === arch)
    const avg_sc = group.reduce((s, h) => s + h.self_consumption_rate_pct, 0) / group.length
    const avg_ss = group.reduce((s, h) => s + h.self_sufficiency_pct, 0) / group.length
    return {
      archetype: arch.length > 12 ? arch.slice(0, 12) + '…' : arch,
      'Self-Consumption %': Math.round(avg_sc * 10) / 10,
      'Self-Sufficiency %': Math.round(avg_ss * 10) / 10,
    }
  })

  // Chart 2: Daily Generation/Consumption Profile — Summer & Winter only
  const profileBySeason: Record<string, Record<number, { gen: number; cons: number }>> = {}
  for (const r of self_consumption_profile) {
    if (r.season !== 'Summer' && r.season !== 'Winter') continue
    if (!profileBySeason[r.season]) profileBySeason[r.season] = {}
    profileBySeason[r.season][r.hour_of_day] = { gen: r.avg_generation_kw, cons: r.avg_consumption_kw }
  }
  const allHours = Array.from(new Set(self_consumption_profile.map(r => r.hour_of_day))).sort((a, b) => a - b)
  const profileChartData = allHours.map(h => {
    const row: Record<string, number | string> = { hour: `${h}:00` }
    for (const season of ['Summer', 'Winter']) {
      if (profileBySeason[season]?.[h]) {
        row[`${season} Gen`]  = profileBySeason[season][h].gen
        row[`${season} Cons`] = profileBySeason[season][h].cons
      }
    }
    return row
  })

  // Chart 3: Economics by System Size — payback_years and irr_pct
  const econSizes = Array.from(new Set(economics.map(e => e.system_size_kw))).sort((a, b) => a - b)
  const econChartData = econSizes.map(sz => {
    const withBat    = economics.find(e => e.system_size_kw === sz && e.battery_included)
    const withoutBat = economics.find(e => e.system_size_kw === sz && !e.battery_included)
    return {
      size: `${sz}kW`,
      'Payback (Solar Only)':     withoutBat?.payback_years ?? null,
      'Payback (w/ Battery)':     withBat?.payback_years ?? null,
      'IRR % (Solar Only)':       withoutBat?.irr_pct ?? null,
      'IRR % (w/ Battery)':       withBat?.irr_pct ?? null,
    }
  })

  // Chart 4: FIT Rate Comparison
  const fitChartData = fit_rates.map(f => ({
    label: `${f.retailer} (${f.state})`,
    'FIT Rate (c/kWh)': f.fit_rate_cents_kwh,
    fit_type: f.fit_type,
    state: f.state,
  })).sort((a, b) => b['FIT Rate (c/kWh)'] - a['FIT Rate (c/kWh)'])

  // Chart 5: Technology NPV — horizontal bar
  const techChartData = [...technology_options]
    .sort((a, b) => b.ten_yr_npv_aud - a.ten_yr_npv_aud)
    .map(t => ({
      tech: t.technology_option.length > 28 ? t.technology_option.slice(0, 26) + '…' : t.technology_option,
      '10yr NPV ($)': t.ten_yr_npv_aud,
      state: t.state,
    }))

  // Chart 6: Self-Consumption Projection — line by scenario
  const projYears = Array.from(new Set(projections.map(p => p.year))).sort((a, b) => a - b)
  const scenarios = Array.from(new Set(projections.map(p => p.scenario)))
  const projChartData = projYears.map(yr => {
    const row: Record<string, number | string> = { year: yr }
    for (const sc of scenarios) {
      const recs = projections.filter(p => p.year === yr && p.scenario === sc)
      if (recs.length > 0) {
        row[sc] = Math.round(recs.reduce((s, r) => s + r.avg_self_consumption_pct, 0) / recs.length * 10) / 10
      }
    }
    return row
  })

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Home className="text-yellow-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Residential Solar Self-Consumption Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">
            Rooftop PV self-consumption rates, feed-in tariffs, battery storage economics, household archetypes and 2024-2035 projections
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Avg Self-Consumption</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">
            {summary.avg_self_consumption_rate_pct.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Avg Payback</div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {summary.avg_payback_years.toFixed(1)} yrs
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Avg Annual Savings</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">
            ${summary.avg_annual_savings_aud.toLocaleString()}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Avg FIT Rate</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">
            {summary.avg_fit_rate_cents_kwh.toFixed(1)} c/kWh
          </div>
        </div>
      </div>

      {/* Chart 1: Self-Consumption by Archetype */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Self-Consumption &amp; Self-Sufficiency by Household Archetype</h2>
        <p className="text-xs text-gray-400 mb-4">
          Retirees and WFH professionals achieve highest self-consumption; EV owners benefit most from solar-charged vehicles
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={archetypeChartData} margin={{ top: 10, right: 20, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="archetype" stroke="#9ca3af" angle={-30} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
            />
            <Legend />
            <Bar dataKey="Self-Consumption %" fill="#f59e0b" />
            <Bar dataKey="Self-Sufficiency %" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Daily Generation/Consumption Profile */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Daily Generation &amp; Consumption Profile — Summer vs Winter</h2>
        <p className="text-xs text-gray-400 mb-4">
          Summer generation peaks at midday ~4.2kW; winter peak ~1.6kW. Morning and evening consumption spikes drive import need.
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={profileChartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="hour" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9ca3af" tickFormatter={(v: number) => `${v.toFixed(1)}kW`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number, name: string) => [`${v.toFixed(2)} kW`, name]}
            />
            <Legend />
            <Line type="monotone" dataKey="Summer Gen"  stroke={SEASON_COLORS['Summer']} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Summer Cons" stroke={SEASON_COLORS['Summer']} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Winter Gen"  stroke={SEASON_COLORS['Winter']} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Winter Cons" stroke={SEASON_COLORS['Winter']} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2 text-center">Solid lines = generation; dashed = consumption</p>
      </div>

      {/* Chart 3: Economics by System Size */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Economics by System Size — Payback Years &amp; IRR</h2>
        <p className="text-xs text-gray-400 mb-4">
          5kW systems offer best value; adding battery extends payback by 2-4 years but improves self-consumption significantly
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={econChartData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="size" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
            />
            <Legend />
            <Bar dataKey="Payback (Solar Only)"   fill="#6366f1" />
            <Bar dataKey="Payback (w/ Battery)"   fill="#a855f7" />
            <Bar dataKey="IRR % (Solar Only)"      fill="#22c55e" />
            <Bar dataKey="IRR % (w/ Battery)"      fill="#84cc16" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: FIT Rate Comparison */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Feed-in Tariff (FIT) Rates by Retailer &amp; State</h2>
        <p className="text-xs text-gray-400 mb-4">
          Victorian premium legacy FIT at 60c/kWh; standard single-rate FITs 3-7c/kWh; battery export and peer-to-peer offer higher rates
        </p>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={fitChartData} margin={{ top: 10, right: 20, left: 20, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="label"
              stroke="#9ca3af"
              angle={-40}
              textAnchor="end"
              height={110}
              tick={{ fontSize: 9 }}
            />
            <YAxis stroke="#9ca3af" tickFormatter={(v: number) => `${v}c`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number, _: string, props: any) => [
                `${v} c/kWh (${props.payload.fit_type})`,
                'FIT Rate',
              ]}
            />
            <Bar dataKey="FIT Rate (c/kWh)" name="FIT Rate (c/kWh)" isAnimationActive={false}>
              {fitChartData.map((entry, idx) => (
                <rect key={idx} fill={FIT_TYPE_COLORS[entry.fit_type] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3 justify-center text-xs">
          {Object.entries(FIT_TYPE_COLORS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span style={{ background: v, width: 10, height: 10, display: 'inline-block', borderRadius: 2 }} />
              <span className="text-gray-400">{k}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Chart 5: Technology 10yr NPV Comparison */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">10-Year NPV by Technology Option</h2>
        <p className="text-xs text-gray-400 mb-4">
          Solar + EV + Battery offers highest NPV at ~$28k; hot water diverters and HVAC control deliver strong value per dollar invested
        </p>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart
            layout="vertical"
            data={techChartData}
            margin={{ top: 10, right: 30, left: 210, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              stroke="#9ca3af"
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis dataKey="tech" type="category" stroke="#9ca3af" width={200} tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number, _: string, props: any) => [
                `$${v.toLocaleString()} (${props.payload.state})`,
                '10yr NPV',
              ]}
            />
            <Bar dataKey="10yr NPV ($)" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 6: Self-Consumption Projection 2024-2033 */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Self-Consumption Projection 2024–2033 by Scenario</h2>
        <p className="text-xs text-gray-400 mb-4">
          High Battery Uptake scenario projects avg self-consumption reaching 65-75% by 2033; Smart Tariffs drive 10-15% uplift vs status quo
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={projChartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" tickFormatter={(v: number) => `${v}%`} domain={[25, 90]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
            />
            <Legend />
            {scenarios.map(sc => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                stroke={SCENARIO_COLORS[sc] ?? '#6b7280'}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Panel */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Solar Self-Consumption Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Avg Self-Consumption Rate</div>
            <div className="text-lg font-bold text-yellow-400">{summary.avg_self_consumption_rate_pct.toFixed(1)}%</div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Avg System Payback</div>
            <div className="text-lg font-bold text-green-400">{summary.avg_payback_years.toFixed(1)} years</div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Avg Annual Savings</div>
            <div className="text-lg font-bold text-blue-400">${summary.avg_annual_savings_aud.toLocaleString()}</div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Avg FIT Rate (Single Rate)</div>
            <div className="text-lg font-bold text-purple-400">{summary.avg_fit_rate_cents_kwh.toFixed(1)} c/kWh</div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Households w/ Battery</div>
            <div className="text-lg font-bold text-orange-400">{(summary.households_with_battery_m * 100).toFixed(0)}% of sample</div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Projected 2030 Self-Consumption</div>
            <div className="text-lg font-bold text-cyan-400">{summary.projected_2030_self_consumption_pct.toFixed(1)}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}
