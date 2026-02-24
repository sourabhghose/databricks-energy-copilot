import { useEffect, useState } from 'react'
import { BarChart as BarChartIcon } from 'lucide-react'
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
  getGeneratorCapacityAdequacyDashboard,
  NGCADashboard,
} from '../api/client'

const TECH_COLOURS: Record<string, string> = {
  Coal: '#f87171',
  Gas: '#fb923c',
  Hydro: '#60a5fa',
  Wind: '#34d399',
  Solar: '#fbbf24',
  Battery: '#a78bfa',
  Diesel: '#94a3b8',
  'Wind+Storage': '#2dd4bf',
  'Hydro (PHES)': '#38bdf8',
}

const RISK_COLOURS: Record<string, string> = {
  High: '#f87171',
  Medium: '#fb923c',
  Low: '#34d399',
}

const SCENARIO_COLOURS: Record<string, string> = {
  Low: '#34d399',
  Medium: '#60a5fa',
  High: '#f87171',
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

export default function GeneratorCapacityAdequacyAnalytics() {
  const [data, setData] = useState<NGCADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGeneratorCapacityAdequacyDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading Generator Capacity Adequacy Analytics...</span>
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

  const { capacity, generators, retirements, demand_scenarios, investments, summary } = data

  // ---- Chart 1: Regional reserve margin % by year (grouped bar) ----
  const years = [2022, 2023, 2024]
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const reserveChartData = regions.map((region) => {
    const row: Record<string, string | number | boolean> = { region }
    years.forEach((yr) => {
      const rec = capacity.find((c) => c.region === region && c.year === yr)
      row[`${yr}_margin`] = rec ? rec.reserve_margin_pct : 0
      row[`${yr}_met`] = rec ? rec.reliability_standard_met : false
    })
    return row
  })

  // ---- Chart 2: Generator sent-out capacity by technology (sorted desc) ----
  const genChartData = [...generators]
    .sort((a, b) => b.sent_out_capacity_mw - a.sent_out_capacity_mw)
    .map((g) => ({
      name: g.generator_name.length > 20 ? g.generator_name.slice(0, 18) + '…' : g.generator_name,
      sent_out_capacity_mw: g.sent_out_capacity_mw,
      technology: g.technology,
      fill: TECH_COLOURS[g.technology] ?? '#94a3b8',
    }))

  // ---- Chart 3: Retirement capacity by year coloured by risk ----
  const retYears = Array.from(new Set(retirements.map((r) => r.retirement_year))).sort()
  const retChartData = retYears.map((yr) => {
    const row: Record<string, string | number> = { year: String(yr) }
    const recs = retirements.filter((r) => r.retirement_year === yr)
    row['High'] = recs.filter((r) => r.reliability_risk === 'High').reduce((s, r) => s + r.capacity_mw, 0)
    row['Medium'] = recs.filter((r) => r.reliability_risk === 'Medium').reduce((s, r) => s + r.capacity_mw, 0)
    row['Low'] = recs.filter((r) => r.reliability_risk === 'Low').reduce((s, r) => s + r.capacity_mw, 0)
    return row
  })

  // ---- Chart 4: Peak demand trajectory NSW1/VIC1 × Low/Medium scenarios ----
  const demandRegions = ['NSW1', 'VIC1']
  const demandScenarios = ['Low', 'Medium']
  const demandYears = [2025, 2027, 2030, 2033, 2035, 2040]
  const demandChartData = demandYears.map((yr) => {
    const row: Record<string, string | number> = { year: String(yr) }
    demandRegions.forEach((reg) => {
      demandScenarios.forEach((sc) => {
        const rec = demand_scenarios.find(
          (d) => d.region === reg && d.year === yr && d.scenario === sc
        )
        row[`${reg}_${sc}`] = rec ? rec.peak_demand_mw : 0
      })
    })
    return row
  })

  // ---- Chart 5: Investment capacity by commissioning year coloured by technology ----
  const commYears = Array.from(new Set(investments.map((i) => i.commissioning_year))).sort()
  const invTechs = Array.from(new Set(investments.map((i) => i.technology)))
  const invChartData = commYears.map((yr) => {
    const row: Record<string, string | number> = { year: String(yr) }
    invTechs.forEach((tech) => {
      row[tech] = investments
        .filter((i) => i.commissioning_year === yr && i.technology === tech)
        .reduce((s, i) => s + i.capacity_mw, 0)
    })
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChartIcon className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">NEM Generator Capacity Adequacy</h1>
          <p className="text-sm text-gray-400">
            NGCA — Reserve margins, generator retirement pipeline, demand scenarios and investment outlook
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Installed (2024)"
          value={`${summary.total_installed_gw.toFixed(1)} GW`}
          sub="Registered capacity NEM-wide"
        />
        <KpiCard
          label="Avg Reserve Margin"
          value={`${summary.avg_reserve_margin_pct.toFixed(1)}%`}
          sub="Across 5 NEM regions (2024)"
        />
        <KpiCard
          label="Retirement by 2030"
          value={`${summary.total_retirement_gw_by_2030.toFixed(1)} GW`}
          sub="Thermal fleet leaving the grid"
        />
        <KpiCard
          label="New Investment Pipeline"
          value={`${summary.total_new_investment_gw.toFixed(1)} GW`}
          sub="Committed + proposed projects"
        />
      </div>

      {/* Chart 1: Reserve Margin by Region & Year */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Regional Reserve Margin % by Year
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={reserveChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            <Bar dataKey="2022_margin" name="2022 Reserve Margin %" fill="#60a5fa" radius={[3, 3, 0, 0]} />
            <Bar dataKey="2023_margin" name="2023 Reserve Margin %" fill="#34d399" radius={[3, 3, 0, 0]} />
            <Bar dataKey="2024_margin" name="2024 Reserve Margin %" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2">
          Reliability standard threshold ~10%. {summary.regions_at_risk} region(s) at risk in 2024.
        </p>
      </div>

      {/* Chart 2: Generator Sent-Out Capacity */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Generator Sent-Out Capacity (MW) — Sorted Descending
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={genChartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 80 }}
            layout="horizontal"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
              formatter={(value: number) => [`${value.toFixed(0)} MW`, 'Sent-Out Capacity']}
            />
            <Bar
              dataKey="sent_out_capacity_mw"
              name="Sent-Out Capacity (MW)"
              isAnimationActive={false}
              label={false}
            >
              {genChartData.map((entry, index) => (
                <rect key={`bar-${index}`} fill={entry.fill as string} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(TECH_COLOURS).map(([tech, colour]) => (
            <span key={tech} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: colour }} />
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 3: Retirement Capacity by Year */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Scheduled Retirement Capacity (MW) by Year — Reliability Risk
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={retChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {(['High', 'Medium', 'Low'] as const).map((risk) => (
              <Bar
                key={risk}
                dataKey={risk}
                name={`${risk} Risk`}
                stackId="retirement"
                fill={RISK_COLOURS[risk]}
                radius={risk === 'Low' ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Peak Demand Scenario Trajectory */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Peak Demand Scenario Trajectory 2025–2040 (NSW1 &amp; VIC1)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={demandChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {demandRegions.map((reg) =>
              demandScenarios.map((sc) => (
                <Line
                  key={`${reg}_${sc}`}
                  type="monotone"
                  dataKey={`${reg}_${sc}`}
                  name={`${reg} ${sc}`}
                  stroke={
                    reg === 'NSW1'
                      ? sc === 'Low' ? '#34d399' : '#60a5fa'
                      : sc === 'Low' ? '#f59e0b' : '#a78bfa'
                  }
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  strokeDasharray={sc === 'Low' ? '5 3' : undefined}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Investment Capacity by Commissioning Year */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          New Investment Capacity (MW) by Commissioning Year — Technology Mix
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={invChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {invTechs.map((tech) => (
              <Bar
                key={tech}
                dataKey={tech}
                name={tech}
                stackId="investment"
                fill={TECH_COLOURS[tech] ?? '#94a3b8'}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Footer */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-200 mb-3">Adequacy Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Regions at Risk (2024):</span>
            <span className={`ml-2 font-semibold ${summary.regions_at_risk > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {summary.regions_at_risk}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Projected USE by 2030:</span>
            <span className="ml-2 font-semibold text-amber-400">
              {summary.projected_use_2030_mwh.toFixed(1)} MWh
            </span>
          </div>
          <div>
            <span className="text-gray-400">All Regions Met Standard:</span>
            <span className={`ml-2 font-semibold ${summary.reliability_standard_met_all_regions ? 'text-green-400' : 'text-red-400'}`}>
              {summary.reliability_standard_met_all_regions ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
