import { useEffect, useState } from 'react'
import { Battery } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
} from 'recharts'
import {
  getBatteryStorageDegradationLifetimeDashboard,
  BSDLDashboard,
} from '../api/client'

const CHEM_COLORS: Record<string, string> = {
  LFP: '#22c55e',
  NMC: '#6366f1',
  NCA: '#f59e0b',
  VRF: '#22d3ee',
  LTO: '#a855f7',
  'Sodium-Ion': '#f97316',
}

const STRATEGY_COLORS: Record<string, string> = {
  Full: '#6366f1',
  Augmentation: '#22c55e',
  'Cell Swap': '#f59e0b',
}

const SL_APP_COLORS: Record<string, string> = {
  'Stationary Storage': '#22c55e',
  'Community Battery': '#6366f1',
  UPS: '#f59e0b',
  'Grid Ancillary': '#22d3ee',
  Research: '#a855f7',
}

export default function BatteryStorageDegradationLifetimeAnalytics() {
  const [data, setData] = useState<BSDLDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBatteryStorageDegradationLifetimeDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading Battery Storage Degradation & Lifetime Analytics...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400">
        <span className="text-lg">Error: {error ?? 'No data available'}</span>
      </div>
    )
  }

  const { degradation, curves, augmentation, second_life, economics, projections, summary } = data

  // ---- KPI Cards ----
  const kpis = [
    {
      label: 'Avg Capacity Retained',
      value: `${(summary.avg_capacity_retained_pct as number).toFixed(1)}%`,
      sub: 'Fleet-wide average SOH',
      color: 'text-green-400',
    },
    {
      label: 'Avg Degradation Rate',
      value: `${(summary.avg_degradation_rate_pct_year as number).toFixed(2)}%/yr`,
      sub: 'Fleet capacity fade per year',
      color: 'text-amber-400',
    },
    {
      label: 'Best Chemistry (Longevity)',
      value: summary.best_chemistry_longevity as string,
      sub: 'Highest avg capacity retention',
      color: 'text-indigo-400',
    },
    {
      label: 'Avg Storage LCOE',
      value: `$${(summary.avg_lcoe_storage_aud_per_mwh as number).toFixed(0)} AUD/MWh`,
      sub: 'Lifetime cost of storage dispatch',
      color: 'text-cyan-400',
    },
  ]

  // ---- Chart 1: Degradation Curve by Chemistry ----
  // LineChart: capacity_retained_pct vs cycle_count for LFP/NMC/NCA/VRF
  const curveChemistries = ['LFP', 'NMC', 'NCA', 'VRF']
  const curveByChemistry: Record<string, Record<number, number>> = {}
  for (const c of curves) {
    if (!curveChemistries.includes(c.chemistry)) continue
    if (!curveByChemistry[c.chemistry]) curveByChemistry[c.chemistry] = {}
    curveByChemistry[c.chemistry][c.cycle_count] = c.capacity_retained_pct
  }
  const allCycleCounts = [0, 500, 1000, 2000, 3000, 5000]
  const curveChartData = allCycleCounts.map((cyc) => {
    const row: Record<string, number | string> = { cycle_count: cyc }
    for (const chem of curveChemistries) {
      row[chem] = curveByChemistry[chem]?.[cyc] ?? 0
    }
    return row
  })

  // ---- Chart 2: Fleet Capacity Retention (BarChart sorted ascending) ----
  const fleetRetentionData = [...degradation]
    .sort((a, b) => a.capacity_retained_pct - b.capacity_retained_pct)
    .map((d) => ({
      name: d.asset_name.replace(' Storage', '').replace(' BESS', '').replace(' Energy', ''),
      capacity_retained_pct: d.capacity_retained_pct,
      chemistry: d.chemistry,
    }))

  // ---- Chart 3: Augmentation Cost Analysis (ScatterChart) ----
  const augScatterData = augmentation.map((a) => ({
    x: a.augmentation_cost_m,
    y: a.capacity_restored_mwh,
    z: a.expected_life_extension_years,
    name: a.asset_name,
    type: a.augmentation_type,
  }))

  // ---- Chart 4: Second Life Value (grouped bar by application) ----
  const slAppMap: Record<string, { value: number; recycle: number; count: number }> = {}
  for (const s of second_life) {
    if (!slAppMap[s.second_life_application]) {
      slAppMap[s.second_life_application] = { value: 0, recycle: 0, count: 0 }
    }
    slAppMap[s.second_life_application].value += s.second_life_value_m
    slAppMap[s.second_life_application].recycle += s.recycling_alternative_cost_m
    slAppMap[s.second_life_application].count += 1
  }
  const slAppChartData = Object.entries(slAppMap).map(([app, v]) => ({
    application: app,
    second_life_value_m: Math.round((v.value / v.count) * 10) / 10,
    recycling_cost_m: Math.round((v.recycle / v.count) * 10) / 10,
  }))

  // ---- Chart 5: LCOE Trajectory (LineChart by year for replacement strategies × chemistry) ----
  const allYears = [...new Set(economics.map((e) => e.year))].sort()
  const strategyChemKeys = [...new Set(economics.map((e) => `${e.chemistry}/${e.replacement_strategy}`))].sort()
  const lcoeChartData = allYears.map((yr) => {
    const row: Record<string, number | string> = { year: yr.toString() }
    for (const key of strategyChemKeys) {
      const [chem, strat] = key.split('/')
      const rec = economics.find((e) => e.year === yr && e.chemistry === chem && e.replacement_strategy === strat)
      if (rec) row[key] = rec.lcoe_storage_aud_per_mwh
    }
    return row
  })

  // ---- Chart 6: Degradation Rate Projection (LineChart 2024-2035) ----
  const projYears = [...new Set(projections.map((p) => p.year))].sort()
  const projChems = [...new Set(projections.map((p) => p.chemistry))]
  const projByChemistry: Record<string, Record<number, number>> = {}
  for (const p of projections) {
    if (!projByChemistry[p.chemistry]) projByChemistry[p.chemistry] = {}
    projByChemistry[p.chemistry][p.year] = p.degradation_rate_pct_year
  }
  const projChartData = projYears.map((yr) => {
    const row: Record<string, number | string> = { year: yr.toString() }
    for (const chem of projChems) {
      if (projByChemistry[chem]?.[yr] !== undefined) row[chem] = projByChemistry[chem][yr]
    }
    return row
  })

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Battery className="w-8 h-8 text-green-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Battery Storage Degradation &amp; Lifetime Analytics
          </h1>
          <p className="text-gray-400 text-sm">
            BESS capacity fade curves by chemistry, cycle counting, calendar aging, temperature
            effects, DoD impact, augmentation strategies, second-life applications and
            replacement economics for Australian grid-scale storage fleets.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-gray-500 text-xs mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart 1: Degradation Curve by Chemistry */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Degradation Curve by Chemistry</h2>
        <p className="text-gray-400 text-xs mb-4">
          Capacity retention (%) vs. cycle count for LFP, NMC, NCA, and VRF chemistries.
          LFP retains ~85% at 3,000 cycles; NMC degrades faster to ~77%; VRF and LTO show
          the best longevity. Curves derived from lab and field test data.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          {curveChemistries.map((chem) => (
            <span key={chem} className="flex items-center gap-1 text-xs text-gray-300">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: CHEM_COLORS[chem] ?? '#9ca3af' }}
              />
              {chem}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={curveChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="cycle_count"
              stroke="#9ca3af"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `${v}`}
              label={{ value: 'Cycle Count', position: 'insideBottom', offset: -2, fill: '#9ca3af', fontSize: 11 }}
            />
            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              domain={[55, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
            />
            <Legend />
            {curveChemistries.map((chem) => (
              <Line
                key={chem}
                type="monotone"
                dataKey={chem}
                stroke={CHEM_COLORS[chem] ?? '#9ca3af'}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Fleet Capacity Retention */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Fleet Capacity Retention</h2>
        <p className="text-gray-400 text-xs mb-4">
          Current state-of-health (% capacity retained) for each asset in the Australian BESS
          fleet, sorted ascending. Colour indicates chemistry. Assets below 80% are candidates
          for augmentation or replacement planning.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          {Object.keys(CHEM_COLORS).map((chem) => (
            <span key={chem} className="flex items-center gap-1 text-xs text-gray-300">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: CHEM_COLORS[chem] }}
              />
              {chem}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={fleetRetentionData} layout="vertical" margin={{ left: 150, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              domain={[65, 100]}
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis type="category" dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} width={145} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, _name: string, props: { payload?: { chemistry?: string } }) => [
                `${v.toFixed(1)}% (${props.payload?.chemistry ?? ''})`,
                'Capacity Retained',
              ]}
            />
            <Bar dataKey="capacity_retained_pct" name="Capacity Retained %">
              {fleetRetentionData.map((entry, index) => (
                <rect
                  key={`bar-${index}`}
                  fill={CHEM_COLORS[entry.chemistry] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Augmentation Cost Analysis */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Augmentation Cost Analysis</h2>
        <p className="text-gray-400 text-xs mb-4">
          Augmentation cost (AUD M) vs. capacity restored (MWh) for each project. Bubble size
          represents expected life extension (years). Cell and module replacements offer the
          best cost-per-MWh-restored ratios vs. full-string replacements.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="x"
              name="Augmentation Cost"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `$${v}M`}
              label={{ value: 'Augmentation Cost ($M)', position: 'insideBottom', offset: -2, fill: '#9ca3af', fontSize: 11 }}
            />
            <YAxis
              dataKey="y"
              name="Capacity Restored"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v} MWh`}
            />
            <ZAxis dataKey="z" range={[50, 400]} name="Life Extension (yrs)" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, name: string) => {
                if (name === 'Augmentation Cost') return [`$${v.toFixed(2)}M`, name]
                if (name === 'Capacity Restored') return [`${v.toFixed(1)} MWh`, name]
                if (name === 'Life Extension (yrs)') return [`${v.toFixed(1)} yrs`, name]
                return [v, name]
              }}
            />
            <Scatter data={augScatterData} fill="#22c55e" opacity={0.8} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Second Life Value */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Second Life Value by Application</h2>
        <p className="text-gray-400 text-xs mb-4">
          Average second-life value ($M) vs. recycling alternative cost ($M) grouped by
          second-life application. Stationary Storage and Grid Ancillary deliver the highest
          value, significantly exceeding the recycling baseline and justifying repurposing costs.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          {['second_life_value_m', 'recycling_cost_m'].map((key) => (
            <span key={key} className="flex items-center gap-1 text-xs text-gray-300">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: key === 'second_life_value_m' ? '#22c55e' : '#6366f1' }}
              />
              {key === 'second_life_value_m' ? 'Second Life Value ($M avg)' : 'Recycling Cost ($M avg)'}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={slAppChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="application" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}M`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`$${v.toFixed(2)}M`, '']}
            />
            <Legend />
            <Bar dataKey="second_life_value_m" name="Second Life Value ($M)" fill="#22c55e" />
            <Bar dataKey="recycling_cost_m" name="Recycling Alternative ($M)" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: LCOE Trajectory */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Storage LCOE Trajectory by Strategy &amp; Chemistry
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Levelised Cost of Energy Storage (AUD/MWh) from 2022 to 2032, by replacement
          strategy and chemistry combination. Augmentation consistently shows lower LCOE
          vs. full replacement. LFP with augmentation is the most cost-effective pathway.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={lcoeChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, name: string) => [`$${v.toFixed(0)}/MWh`, name]}
            />
            <Legend />
            {strategyChemKeys.slice(0, 6).map((key) => {
              const [chem] = key.split('/')
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CHEM_COLORS[chem] ?? STRATEGY_COLORS[key.split('/')[1]] ?? '#9ca3af'}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 6: Degradation Rate Projection */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Degradation Rate Projection 2024–2035
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Projected annual degradation rate (% capacity loss per year) for each chemistry
          from 2024 to 2035. Improvements in electrolyte formulation, BMS algorithms, and
          thermal management drive declining fade rates. LFP is projected to reach below
          1%/year by 2033.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          {projChems.map((chem) => (
            <span key={chem} className="flex items-center gap-1 text-xs text-gray-300">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: CHEM_COLORS[chem] ?? '#9ca3af' }}
              />
              {chem}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={projChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, name: string) => [`${v.toFixed(2)}%/yr`, name]}
            />
            <Legend />
            {projChems.map((chem) => (
              <Line
                key={chem}
                type="monotone"
                dataKey={chem}
                stroke={CHEM_COLORS[chem] ?? '#9ca3af'}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats Footer */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-3">Fleet Summary Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total Augmentation Projects</p>
            <p className="text-xl font-bold text-green-400">{summary.total_augmentation_projects as number}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Second Life Market (2030)</p>
            <p className="text-xl font-bold text-cyan-400">{(summary.second_life_market_size_gwh as number).toFixed(1)} GWh</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Best Chemistry</p>
            <p className="text-xl font-bold text-indigo-400">{summary.best_chemistry_longevity as string}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Avg Degradation</p>
            <p className="text-xl font-bold text-amber-400">{(summary.avg_degradation_rate_pct_year as number).toFixed(2)}%/yr</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Fleet SOH Avg</p>
            <p className="text-xl font-bold text-green-400">{(summary.avg_capacity_retained_pct as number).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Avg Storage LCOE</p>
            <p className="text-xl font-bold text-rose-400">${(summary.avg_lcoe_storage_aud_per_mwh as number).toFixed(0)}/MWh</p>
          </div>
        </div>
      </div>
    </div>
  )
}
