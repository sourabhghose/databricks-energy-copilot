import { useEffect, useState } from 'react'
import { Scale, FileText, Activity, TrendingUp } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts'
import { getMarketEvolutionPolicyDashboard } from '../api/client'
import type { MEPAdashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const POLICY_TYPE_COLOURS: Record<string, string> = {
  'Market Design':        '#6366f1',
  'Reliability':          '#3b82f6',
  'Decarbonisation':      '#10b981',
  'Consumer Protection':  '#f59e0b',
  'Network':              '#ef4444',
}

const TECH_COLOURS: Record<string, string> = {
  Gas:     '#f59e0b',
  Coal:    '#78716c',
  Wind:    '#3b82f6',
  Solar:   '#fbbf24',
  Storage: '#10b981',
  Hydro:   '#06b6d4',
}

const STATE_COLOURS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#6366f1',
  QLD: '#f59e0b',
  SA:  '#10b981',
  WA:  '#ef4444',
  TAS: '#8b5cf6',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart Card wrapper
// ---------------------------------------------------------------------------
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function MarketEvolutionPolicyAnalytics() {
  const [data, setData] = useState<MEPAdashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMarketEvolutionPolicyDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Market Evolution Policy Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const { policies, market_indicators, transition, consumer, summary } = data

  // Chart 1: Bar — Policy impact score by policy type (sorted desc, averaged)
  const policyTypes = ['Market Design', 'Reliability', 'Decarbonisation', 'Consumer Protection', 'Network']
  const impactByType = policyTypes
    .map(ptype => {
      const recs = policies.filter(p => p.policy_type === ptype)
      const avg = recs.length > 0
        ? Math.round((recs.reduce((s, r) => s + r.impact_score, 0) / recs.length) * 100) / 100
        : 0
      return { policy_type: ptype, avg_impact_score: avg }
    })
    .sort((a, b) => b.avg_impact_score - a.avg_impact_score)

  // Chart 2: Grouped Bar — Market indicator values vs benchmark by indicator (2024 Q4, NSW1 only)
  const indicators = ['Market Concentration', 'Entry Barriers', 'Price Efficiency', 'Liquidity']
  const indicatorVsBenchmark = indicators.map(ind => {
    const rec = market_indicators.find(
      m => m.year === 2024 && m.quarter === 'Q4' && m.region === 'NSW1' && m.indicator === ind
    )
    return {
      indicator: ind.replace(' ', '\n'),
      indicator_label: ind,
      value: rec ? Math.round(rec.value * 100) / 100 : 0,
      benchmark: rec ? Math.round(rec.benchmark * 100) / 100 : 0,
    }
  })

  // Chart 3: Line — Net capacity change MW by technology (2021-2025 trend)
  const transitionYears = [2021, 2022, 2023, 2024, 2025]
  const technologies = ['Gas', 'Coal', 'Wind', 'Solar', 'Storage', 'Hydro']
  const netCapacityByYear = transitionYears.map(yr => {
    const row: Record<string, string | number> = { year: yr }
    for (const tech of technologies) {
      const rec = transition.find(t => t.year === yr && t.technology === tech)
      row[tech] = rec ? Math.round(rec.net_change_mw * 10) / 10 : 0
    }
    return row
  })

  // Chart 4: Stacked Bar — Technology capacity retirement vs new by year (2021-2025)
  const stackedCapacityByYear = transitionYears.map(yr => {
    const row: Record<string, string | number> = { year: yr }
    for (const tech of technologies) {
      const rec = transition.find(t => t.year === yr && t.technology === tech)
      row[`${tech}_retirement`] = rec ? Math.round(rec.capacity_retirement_mw * 10) / 10 : 0
      row[`${tech}_new`] = rec ? Math.round(rec.capacity_new_mw * 10) / 10 : 0
    }
    return row
  })

  // Chart 5: Line — Consumer switching rate trend by state (2022-2024 averaged by quarter)
  const switchingStates = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS']
  const switchingYears = [2022, 2023, 2024]
  const switchingTrend = switchingYears.map(yr => {
    const row: Record<string, string | number> = { year: yr }
    for (const state of switchingStates) {
      const recs = consumer.filter(
        c => c.year === yr && c.state === state && c.measure === 'Switching Rate'
      )
      row[state] = recs.length > 0
        ? Math.round((recs.reduce((s, r) => s + r.value, 0) / recs.length) * 100) / 100
        : 0
    }
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-violet-600 border-b border-violet-700 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-violet-800 rounded-lg">
          <Scale size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Market Evolution Policy Analytics</h1>
          <p className="text-xs text-violet-200">MEPA — Policy Impact, Market Indicators, Energy Transition & Consumer Metrics</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Total Policies"
            value={String(summary.total_policies)}
            sub="All policy types"
            icon={FileText}
            color="bg-violet-600"
          />
          <KpiCard
            title="Policies in Effect"
            value={String(summary.policies_in_effect)}
            sub="Currently active"
            icon={Scale}
            color="bg-blue-600"
          />
          <KpiCard
            title="Avg Market Concentration"
            value={summary.avg_market_concentration.toFixed(1)}
            sub="2024 index (0-100)"
            icon={Activity}
            color="bg-indigo-600"
          />
          <KpiCard
            title="Total Net Capacity Change"
            value={`${summary.total_net_capacity_change_mw.toLocaleString()} MW`}
            sub="2021-2025 cumulative"
            icon={TrendingUp}
            color="bg-emerald-600"
          />
        </div>

        {/* Chart 1: Policy impact score by policy type (sorted desc) */}
        <ChartCard title="Avg Policy Impact Score by Policy Type (sorted descending)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={impactByType} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="policy_type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} domain={[0, 10]} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="avg_impact_score" name="Avg Impact Score" radius={[4, 4, 0, 0]}>
                {impactByType.map(entry => (
                  <rect key={entry.policy_type} fill={POLICY_TYPE_COLOURS[entry.policy_type] ?? '#6b7280'} />
                ))}
              </Bar>
              <Bar dataKey="avg_impact_score" name="Avg Impact Score" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Market indicator values vs benchmark (2024 Q4, NSW1) */}
        <ChartCard title="Market Indicators vs Benchmark — 2024 Q4, NSW1">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={indicatorVsBenchmark} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="indicator_label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="value" name="Actual Value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="benchmark" name="Benchmark" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Net capacity change MW by technology (2021-2025 trend) */}
        <ChartCard title="Net Capacity Change MW by Technology — 2021-2025 Trend">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={netCapacityByYear} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {technologies.map(tech => (
                <Line
                  key={tech}
                  type="monotone"
                  dataKey={tech}
                  stroke={TECH_COLOURS[tech] ?? '#6b7280'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Stacked bar — Technology capacity retirement vs new by year */}
        <ChartCard title="Technology Capacity Retirement vs New — 2021-2025 (stacked by technology)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stackedCapacityByYear} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {technologies.map(tech => (
                <Bar
                  key={`${tech}_new`}
                  dataKey={`${tech}_new`}
                  name={`${tech} New`}
                  stackId="new"
                  fill={TECH_COLOURS[tech] ?? '#6b7280'}
                />
              ))}
              {technologies.map(tech => (
                <Bar
                  key={`${tech}_retirement`}
                  dataKey={`${tech}_retirement`}
                  name={`${tech} Retirement`}
                  stackId="retirement"
                  fill={TECH_COLOURS[tech] ?? '#6b7280'}
                  fillOpacity={0.4}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Consumer switching rate trend by state (2022-2024) */}
        <ChartCard title="Consumer Switching Rate Trend by State — 2022-2024 (averaged)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={switchingTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {switchingStates.map(state => (
                <Line
                  key={state}
                  type="monotone"
                  dataKey={state}
                  stroke={STATE_COLOURS[state] ?? '#6b7280'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
