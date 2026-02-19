import React, { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Activity } from 'lucide-react'
import {
  api,
  AvailabilityDashboard,
  GeneratorAvailabilityRecord,
  EforTrendRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TECH_COLORS: Record<string, string> = {
  BLACK_COAL: '#374151',
  BROWN_COAL: '#92400E',
  GAS_CCGT:   '#6B7280',
  GAS_OCGT:   '#9CA3AF',
  HYDRO:      '#06B6D4',
  WIND:       '#3B82F6',
  SOLAR:      '#F59E0B',
}

const TECH_BADGE_CLASSES: Record<string, string> = {
  BLACK_COAL: 'bg-gray-700 text-gray-100',
  BROWN_COAL: 'bg-yellow-900 text-yellow-100',
  GAS_CCGT:   'bg-gray-500 text-gray-100',
  GAS_OCGT:   'bg-gray-400 text-gray-900',
  HYDRO:      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  WIND:       'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  SOLAR:      'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
}

type TechFilter = 'COAL' | 'GAS' | 'HYDRO' | 'WIND' | 'SOLAR'

const TECH_FILTER_MAP: Record<TechFilter, string[]> = {
  COAL:  ['BLACK_COAL', 'BROWN_COAL'],
  GAS:   ['GAS_CCGT', 'GAS_OCGT'],
  HYDRO: ['HYDRO'],
  WIND:  ['WIND'],
  SOLAR: ['SOLAR'],
}

const ALL_TECHNOLOGIES = [
  'BLACK_COAL',
  'BROWN_COAL',
  'GAS_CCGT',
  'GAS_OCGT',
  'HYDRO',
  'WIND',
  'SOLAR',
]

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  valueClass?: string
}

function KpiCard({ label, value, sub, valueClass = 'text-white' }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function TechBadge({ tech }: { tech: string }) {
  const cls = TECH_BADGE_CLASSES[tech] ?? 'bg-gray-600 text-gray-100'
  const label = tech.replace('_', ' ')
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function availColor(pct: number): string {
  if (pct >= 90) return 'text-green-400'
  if (pct >= 80) return 'text-amber-400'
  return 'text-red-400'
}

function eforColor(pct: number): string {
  if (pct < 3) return 'text-green-400'
  if (pct <= 7) return 'text-amber-400'
  return 'text-red-400'
}

// ---------------------------------------------------------------------------
// EFOR Trend chart data builder
// ---------------------------------------------------------------------------

function buildTrendChartData(
  trends: EforTrendRecord[],
  activeTechs: Set<string>,
): Record<string, number | string>[] {
  const years = Array.from(new Set(trends.map(t => t.year))).sort()
  return years.map(year => {
    const row: Record<string, number | string> = { year }
    for (const tech of ALL_TECHNOLOGIES) {
      if (!activeTechs.has(tech)) continue
      const rec = trends.find(t => t.technology === tech && t.year === year)
      if (rec) row[tech] = rec.fleet_avg_efor_pct
    }
    return row
  })
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GeneratorAvailability() {
  const [dashboard, setDashboard] = useState<AvailabilityDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tech filter toggles — all enabled by default
  const [activeFilters, setActiveFilters] = useState<Set<TechFilter>>(
    new Set(['COAL', 'GAS', 'HYDRO', 'WIND', 'SOLAR']),
  )

  useEffect(() => {
    api
      .getEforDashboard()
      .then(d => {
        setDashboard(d)
        setLoading(false)
      })
      .catch(e => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-gray-400 animate-pulse">Loading EFOR data…</div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-red-400">{error ?? 'Failed to load data'}</div>
      </div>
    )
  }

  // Compute active technology set from filter toggles
  const activeTechs = new Set<string>()
  for (const filter of activeFilters) {
    for (const tech of TECH_FILTER_MAP[filter]) activeTechs.add(tech)
  }

  const trendData = buildTrendChartData(dashboard.efor_trends, activeTechs)

  // 2024 availability records, sorted by EFOR descending
  const records2024: GeneratorAvailabilityRecord[] = dashboard.availability_records
    .filter(r => r.year === 2024)
    .slice()
    .sort((a, b) => b.efor_pct - a.efor_pct)

  function toggleFilter(f: TechFilter) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  const filterButtons: TechFilter[] = ['COAL', 'GAS', 'HYDRO', 'WIND', 'SOLAR']

  return (
    <div className="min-h-full bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-800 rounded-lg">
          <Activity className="text-amber-400" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Generator Availability &amp; EFOR Analytics
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Equivalent Forced Outage Rate analysis by technology, unit, and year &mdash; NEM fleet
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Fleet Avg Availability"
          value={`${dashboard.fleet_avg_availability_pct.toFixed(1)}%`}
          sub="2024 average across all units"
          valueClass={availColor(dashboard.fleet_avg_availability_pct)}
        />
        <KpiCard
          label="Fleet Avg EFOR"
          value={`${dashboard.fleet_avg_efor_pct.toFixed(2)}%`}
          sub="Equivalent forced outage rate 2024"
          valueClass={eforColor(dashboard.fleet_avg_efor_pct)}
        />
        <KpiCard
          label="Highest EFOR Technology"
          value={dashboard.highest_efor_technology.replace('_', ' ')}
          sub="Worst-performing technology 2024"
          valueClass="text-red-400"
        />
        <KpiCard
          label="Total Forced Outage Energy"
          value={`${(dashboard.total_forced_outage_mwh_yr / 1000).toFixed(0)} GWh/yr`}
          sub="MWh lost to forced outages 2024"
          valueClass="text-amber-400"
        />
      </div>

      {/* EFOR Trend chart */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-100">
            Fleet EFOR Trend by Technology (2018–2024)
          </h2>
          <div className="flex gap-2 flex-wrap">
            {filterButtons.map(f => (
              <button
                key={f}
                onClick={() => toggleFilter(f)}
                className={[
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  activeFilters.has(f)
                    ? 'bg-amber-500 text-gray-900'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200',
                ].join(' ')}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              tickFormatter={v => `${v}%`}
              width={45}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '6px' }}
              labelStyle={{ color: '#F3F4F6' }}
              itemStyle={{ color: '#D1D5DB' }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', color: '#9CA3AF' }}
              formatter={v => v.replace('_', ' ')}
            />
            {ALL_TECHNOLOGIES.filter(t => activeTechs.has(t)).map(tech => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                stroke={TECH_COLORS[tech] ?? '#6B7280'}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Availability table — 2024 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-100">
            Unit Availability — 2024 (sorted by EFOR, worst first)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {[
                  'Unit',
                  'Owner',
                  'State',
                  'Technology',
                  'Cap (MW)',
                  'Availability %',
                  'EFOR %',
                  'Planned %',
                  'Cap Factor %',
                ].map(h => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records2024.map((r, i) => (
                <tr
                  key={r.unit_id}
                  className={[
                    'border-b border-gray-700 hover:bg-gray-750',
                    i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850',
                  ].join(' ')}
                  style={{ backgroundColor: i % 2 === 0 ? '#1f2937' : '#1a2233' }}
                >
                  <td className="px-4 py-2 text-gray-100 font-medium whitespace-nowrap">
                    {r.unit_name}
                  </td>
                  <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{r.owner}</td>
                  <td className="px-4 py-2 text-gray-300">{r.state}</td>
                  <td className="px-4 py-2">
                    <TechBadge tech={r.technology} />
                  </td>
                  <td className="px-4 py-2 text-gray-300 text-right">
                    {r.registered_capacity_mw.toLocaleString()}
                  </td>
                  <td className={`px-4 py-2 font-medium text-right ${availColor(r.availability_factor_pct)}`}>
                    {r.availability_factor_pct.toFixed(1)}%
                  </td>
                  <td className={`px-4 py-2 font-medium text-right ${eforColor(r.efor_pct)}`}>
                    {r.efor_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-gray-300 text-right">
                    {r.planned_outage_rate_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-gray-300 text-right">
                    {r.capacity_factor_pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
