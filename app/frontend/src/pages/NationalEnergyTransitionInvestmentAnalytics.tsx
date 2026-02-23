import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
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
  getNationalEnergyTransitionInvestmentDashboard,
  NETIDashboard,
  NETIInvestmentRecord,
  NETIFinancingRecord,
  NETIEmploymentRecord,
  NETIInternationalRecord,
  NETIProjectionRecord,
} from '../api/client'

const SECTOR_COLORS: Record<string, string> = {
  'Utility Solar':             '#f59e0b',
  'Rooftop Solar':             '#fbbf24',
  'Onshore Wind':              '#22d3ee',
  'Offshore Wind':             '#06b6d4',
  'Battery Storage':           '#6366f1',
  'Pumped Hydro':              '#818cf8',
  'Transmission':              '#34d399',
  'Distribution':              '#10b981',
  'Green Hydrogen':            '#a3e635',
  'Industrial Decarbonisation':'#f87171',
  'CCS':                       '#fb923c',
  'Other':                     '#9ca3af',
}

const SCENARIO_COLORS: Record<string, string> = {
  'Required for Net Zero': '#f87171',
  'Stated Policy':         '#f59e0b',
  'Current Trajectory':    '#34d399',
}

export default function NationalEnergyTransitionInvestmentAnalytics() {
  const [data, setData] = useState<NETIDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNationalEnergyTransitionInvestmentDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading National Energy Transition Investment Analytics...</span>
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

  const { summary, investments, financing, employment, international, projections } = data

  // ---- KPI Cards ----
  const kpis = [
    {
      label: 'Total Invested 2019-2024',
      value: typeof summary.total_invested_2019_2024_b === 'number'
        ? summary.total_invested_2019_2024_b.toFixed(1) : '—',
      unit: '$B',
      color: 'text-amber-400',
    },
    {
      label: 'Avg Annual Investment',
      value: typeof summary.avg_annual_investment_b === 'number'
        ? summary.avg_annual_investment_b.toFixed(1) : '—',
      unit: '$B/yr',
      color: 'text-cyan-400',
    },
    {
      label: 'Total Jobs Created',
      value: typeof summary.total_jobs_created === 'number'
        ? summary.total_jobs_created.toLocaleString() : '—',
      unit: 'FTE',
      color: 'text-emerald-400',
    },
    {
      label: 'Annual Investment Gap',
      value: typeof summary.annual_investment_gap_b === 'number'
        ? summary.annual_investment_gap_b.toFixed(1) : '—',
      unit: '$B/yr',
      color: 'text-red-400',
    },
  ]

  // ---- Chart 1: Annual Investment by Sector — stacked BarChart 2019-2024 ----
  const allSectors = [...new Set(investments.map((r: NETIInvestmentRecord) => r.sector))]
  const invYears = [...new Set(investments.map((r: NETIInvestmentRecord) => r.year))].sort()
  const invByYear: Record<number, Record<string, number>> = {}
  investments.forEach((r: NETIInvestmentRecord) => {
    if (!invByYear[r.year]) invByYear[r.year] = {}
    invByYear[r.year][r.sector] = (invByYear[r.year][r.sector] ?? 0) + r.total_investment_b
  })
  const annualInvData = invYears.map((yr) => {
    const row: Record<string, string | number> = { year: String(yr) }
    allSectors.forEach((s) => {
      row[s] = +(invByYear[yr]?.[s] ?? 0).toFixed(2)
    })
    return row
  })

  // ---- Chart 2: Private vs Public Split — grouped BarChart by year ----
  const mixByYear: Record<number, { private_b: number[]; public_b: number[]; grants_b: number[] }> = {}
  investments.forEach((r: NETIInvestmentRecord) => {
    if (!mixByYear[r.year]) mixByYear[r.year] = { private_b: [], public_b: [], grants_b: [] }
    mixByYear[r.year].private_b.push(r.private_b)
    mixByYear[r.year].public_b.push(r.public_b)
    mixByYear[r.year].grants_b.push(r.grants_b)
  })
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const mixChartData = invYears.map((yr) => ({
    year: String(yr),
    'Private ($B)': +sum(mixByYear[yr]?.private_b ?? []).toFixed(2),
    'Public ($B)':  +sum(mixByYear[yr]?.public_b  ?? []).toFixed(2),
    'Grants ($B)':  +sum(mixByYear[yr]?.grants_b  ?? []).toFixed(2),
  }))

  // ---- Chart 3: Financing Type Distribution — BarChart total_b by financing_type for latest year ----
  const latestFinYear = Math.max(...financing.map((r: NETIFinancingRecord) => r.year))
  const finTypeMap: Record<string, number> = {}
  financing
    .filter((r: NETIFinancingRecord) => r.year === latestFinYear)
    .forEach((r: NETIFinancingRecord) => {
      finTypeMap[r.financing_type] = (finTypeMap[r.financing_type] ?? 0) + r.total_b
    })
  const finChartData = Object.entries(finTypeMap)
    .sort((a, b) => b[1] - a[1])
    .map(([ft, total]) => ({ type: ft, 'Total ($B)': +total.toFixed(2) }))
  const finBarColors = ['#6366f1', '#22d3ee', '#f59e0b', '#34d399', '#f87171', '#a78bfa', '#fb923c', '#38bdf8']

  // ---- Chart 4: Employment by Sector — grouped BarChart direct + indirect, latest 2 years ----
  const empYears = [...new Set(employment.map((r: NETIEmploymentRecord) => r.year))].sort()
  const latest2EmpYears = empYears.slice(-2)
  const empSectors = [...new Set(employment.map((r: NETIEmploymentRecord) => r.sector))]
  const empBySectorYear: Record<string, Record<number, { direct: number; indirect: number }>> = {}
  employment.forEach((r: NETIEmploymentRecord) => {
    if (!empBySectorYear[r.sector]) empBySectorYear[r.sector] = {}
    empBySectorYear[r.sector][r.year] = { direct: r.direct_jobs_fte, indirect: r.indirect_jobs_fte }
  })
  const empChartData = empSectors.map((sec) => {
    const row: Record<string, string | number> = { sector: sec.length > 16 ? sec.slice(0, 15) + '…' : sec }
    latest2EmpYears.forEach((yr) => {
      const d = empBySectorYear[sec]?.[yr]
      row[`Direct ${yr}`]   = d?.direct   ?? 0
      row[`Indirect ${yr}`] = d?.indirect ?? 0
    })
    return row
  })
  const empBarColors = ['#6366f1', '#818cf8', '#22d3ee', '#67e8f9']

  // ---- Chart 5: International Comparison — horizontal BarChart by country, latest year ----
  const latestIntYear = Math.max(...international.map((r: NETIInternationalRecord) => r.year))
  const intlChartData = [...international]
    .filter((r: NETIInternationalRecord) => r.year === latestIntYear)
    .sort((a, b) => b.clean_energy_investment_b_usd - a.clean_energy_investment_b_usd)
    .map((r) => ({
      country: r.country,
      'Investment ($B USD)': r.clean_energy_investment_b_usd,
      policy: r.policy_driver,
    }))

  // ---- Chart 6: Investment Gap — LineChart 2024-2035, total_required vs current_trajectory ----
  const gapScenarios = ['Required for Net Zero', 'Current Trajectory', 'Stated Policy']
  const projYears = [...new Set(projections.map((r: NETIProjectionRecord) => r.year))].sort()
  const projByYearScenario: Record<number, Record<string, number>> = {}
  projections.forEach((r: NETIProjectionRecord) => {
    if (!projByYearScenario[r.year]) projByYearScenario[r.year] = {}
    projByYearScenario[r.year][r.scenario] = r.total_required_b
  })
  const gapChartData = projYears.map((yr) => {
    const row: Record<string, string | number> = { year: String(yr) }
    gapScenarios.forEach((sc) => {
      row[sc] = +(projByYearScenario[yr]?.[sc] ?? 0).toFixed(1)
    })
    return row
  })

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp size={28} className="text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">National Energy Transition Investment Analytics</h1>
          <p className="text-sm text-gray-400">
            Capital deployed across renewables, storage, networks and hydrogen; financing structures,
            employment effects, geographic distribution and international benchmarking — Australia
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>
              {kpi.value}
              <span className="text-sm font-normal text-gray-400 ml-1">{kpi.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Summary Banner */}
      <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-3 mb-6 flex items-center gap-2">
        <TrendingUp size={16} className="text-amber-400 shrink-0" />
        <p className="text-sm text-amber-300">
          <span className="font-semibold text-white">Largest Sector:</span>{' '}
          {summary.largest_sector}
          {' — '}
          Private investment share:{' '}
          <span className="font-semibold text-cyan-400">{summary.private_investment_pct.toFixed(1)}%</span>
          {'. '}
          Net zero requires ~$70B+/yr; current trajectory runs $
          {summary.avg_annual_investment_b.toFixed(1)}B/yr — gap of $
          {summary.annual_investment_gap_b.toFixed(1)}B/yr.
        </p>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Chart 1: Annual Investment by Sector */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">Annual Investment by Sector ($B)</h2>
          <p className="text-xs text-gray-500 mb-3">Stacked total investment 2019-2024 — utility solar and wind dominate</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={annualInvData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $B" width={62} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#9ca3af' }}
                formatter={(v: number) => [`$${v.toFixed(2)}B`]}
              />
              <Legend wrapperStyle={{ fontSize: 9, color: '#9ca3af' }} />
              {allSectors.map((s) => (
                <Bar key={s} dataKey={s} stackId="a" fill={SECTOR_COLORS[s] ?? '#9ca3af'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Private vs Public Split */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">Private vs Public Investment Mix ($B)</h2>
          <p className="text-xs text-gray-500 mb-3">Grouped by year — private capital consistently dominant</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={mixChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $B" width={62} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#9ca3af' }}
                formatter={(v: number) => [`$${v.toFixed(2)}B`]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="Private ($B)" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Public ($B)"  fill="#22d3ee" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Grants ($B)"  fill="#34d399" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Chart 3: Financing Type Distribution */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">Financing Type Distribution ({latestFinYear})</h2>
          <p className="text-xs text-gray-500 mb-3">Total capital ($B) by financing structure — project finance leads</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={finChartData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="type"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-20}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $B" width={58} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#9ca3af' }}
                formatter={(v: number) => [`$${v.toFixed(2)}B`]}
              />
              <Bar dataKey="Total ($B)" radius={[3, 3, 0, 0]}>
                {finChartData.map((_, idx) => (
                  <rect key={idx} fill={finBarColors[idx % finBarColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Employment by Sector */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">Employment by Sector (Latest 2 Years)</h2>
          <p className="text-xs text-gray-500 mb-3">Direct and indirect FTE jobs — rooftop solar and utility solar lead employment</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={empChartData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="sector"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-20}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={60} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#9ca3af' }}
                formatter={(v: number) => [v.toLocaleString()]}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
              {latest2EmpYears.flatMap((yr, i) => [
                <Bar key={`direct-${yr}`}   dataKey={`Direct ${yr}`}   fill={empBarColors[i * 2]}     radius={[2, 2, 0, 0]} />,
                <Bar key={`indirect-${yr}`} dataKey={`Indirect ${yr}`} fill={empBarColors[i * 2 + 1]} radius={[2, 2, 0, 0]} />,
              ])}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Chart 5: International Comparison */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">International Comparison — Clean Energy Investment ({latestIntYear})</h2>
          <p className="text-xs text-gray-500 mb-3">Horizontal bar — USD billions; China and USA lead by wide margin</p>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={intlChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 90 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $B" />
              <YAxis
                type="category"
                dataKey="country"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                width={85}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#9ca3af' }}
                formatter={(v: number, _name: string, props: { payload?: { policy?: string } }) => [
                  `$${v.toFixed(1)}B USD`,
                  props?.payload?.policy ?? 'Policy',
                ]}
              />
              <Bar dataKey="Investment ($B USD)" fill="#f59e0b" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 6: Investment Gap 2024-2035 */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">Investment Gap Analysis 2024-2035 ($B)</h2>
          <p className="text-xs text-gray-500 mb-3">Gap between net zero requirement and current trajectory — widening through 2035</p>
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={gapChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $B" width={62} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#9ca3af' }}
                formatter={(v: number) => [`$${v.toFixed(1)}B`]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {gapScenarios.map((sc) => (
                <Line
                  key={sc}
                  type="monotone"
                  dataKey={sc}
                  stroke={SCENARIO_COLORS[sc] ?? '#9ca3af'}
                  strokeWidth={2}
                  strokeDasharray={sc === 'Current Trajectory' ? '5 3' : undefined}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sector legend */}
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        {Object.entries(SECTOR_COLORS).map(([s, color]) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-400">{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
