import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
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
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getElectricityPriceCapInterventionDashboard,
  EPCIDashboard,
} from '../api/client'

const REGION_COLORS: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#34d399',
  VIC1: '#a78bfa',
  SA1:  '#fb923c',
  TAS1: '#f472b6',
}

const OUTCOME_COLORS: Record<string, string> = {
  'Prevented Cap':    '#34d399',
  'Reduced Duration': '#60a5fa',
  'Ineffective':      '#f87171',
}

const TRIGGER_COLORS: Record<string, string> = {
  'MPC Activated': '#60a5fa',
  'CPT Breach':    '#f87171',
  'RERT Trigger':  '#fbbf24',
  'APC Price':     '#a78bfa',
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ElectricityPriceCapInterventionAnalytics() {
  const [data, setData] = useState<EPCIDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityPriceCapInterventionDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        Loading Electricity Price Cap Intervention Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  const { summary, price_cap_events, market_impact, generator_response, threshold_tracker, remedy_actions } = data

  // Chart 1: cap_events_count by region per quarter (2024)
  const cap2024 = market_impact.filter(m => m.year === 2024)
  const chart1Data = [1, 2, 3, 4].map(q => {
    const row: Record<string, string | number> = { quarter: `Q${q}` }
    for (const reg of ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']) {
      const entry = cap2024.find(m => m.quarter === q && m.region === reg)
      row[reg] = entry?.cap_events_count ?? 0
    }
    return row
  })

  // Chart 2: cumulative_price_atd by month for each region (2024)
  const threshold2024 = threshold_tracker.filter(t => t.year === 2024)
  const chart2Data = MONTHS.map((label, idx) => {
    const mo = idx + 1
    const row: Record<string, string | number> = { month: label }
    for (const reg of ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']) {
      const entry = threshold2024.find(t => t.month === mo && t.region === reg)
      row[reg] = entry ? Math.round(entry.cumulative_price_atd / 1000) : 0
    }
    return row
  })

  // Chart 3: revenue_impact_m by generator (2024)
  const gen2024 = generator_response.filter(g => g.year === 2024)
  const chart3Data = gen2024.map(g => ({
    generator: g.generator.replace('EnergyAustralia ', 'EA ').replace('Snowy Hydro ', 'SH '),
    revenue_impact_m: g.revenue_impact_m,
    positive: g.revenue_impact_m >= 0,
  }))

  // Chart 4: capacity_mw by action_type for remedy actions, coloured by outcome
  const actionTypeOrder = ['RERT Activation', 'DR Activation', 'Interconnector Dispatch', 'Reserve Trader']
  const chart4Data = actionTypeOrder.map(at => {
    const actions = remedy_actions.filter(a => a.action_type === at)
    const row: Record<string, string | number> = { action_type: at.replace(' Activation', '').replace(' Dispatch', '') }
    for (const outcome of ['Prevented Cap', 'Reduced Duration', 'Ineffective']) {
      const total = actions.filter(a => a.outcome === outcome).reduce((s, a) => s + a.capacity_mw, 0)
      row[outcome] = Math.round(total)
    }
    return row
  })

  // Chart 5: spot_price_avg_aud_mwh distribution by trigger_type
  const chart5Data = ['MPC Activated', 'CPT Breach', 'RERT Trigger', 'APC Price'].map(tt => {
    const events = price_cap_events.filter(e => e.trigger_type === tt)
    const avg = events.length > 0
      ? Math.round(events.reduce((s, e) => s + e.spot_price_avg_aud_mwh, 0) / events.length)
      : 0
    const max = events.length > 0
      ? Math.round(Math.max(...events.map(e => e.spot_price_avg_aud_mwh)))
      : 0
    return { trigger_type: tt, avg_spot_price: avg, max_spot_price: max, count: events.length }
  })

  return (
    <div className="p-6 space-y-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Electricity Price Cap Intervention Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Market Price Cap (MPC) events, cumulative price thresholds, generator responses and remedy actions across the NEM
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Cap Events FY</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{summary.total_cap_events_fy}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Hours at Cap FY</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{summary.total_hours_at_cap_fy.toFixed(1)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">hours</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Max Administered Price</p>
          <p className="text-3xl font-bold text-red-400 mt-1">${summary.max_administered_price_aud_mwh.toFixed(0)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">AUD/MWh</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Consumer Savings</p>
          <p className="text-3xl font-bold text-green-400 mt-1">${summary.total_consumer_savings_m.toFixed(1)}M</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">AUD millions</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Most Affected Region</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{summary.most_affected_region}</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1: Cap Events Count by Region per Quarter (2024) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Cap Events by Region per Quarter (2024)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart1Data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].map(reg => (
                <Bar key={reg} dataKey={reg} stackId="a" fill={REGION_COLORS[reg]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Cumulative Price ATD by Month per Region (2024) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
            Cumulative Price Threshold by Month — 2024 (AUD $000/MWh)
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
            Dashed line = $300k/MWh CPT threshold
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chart2Data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="k" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`$${v}k`, '']}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <ReferenceLine y={300} stroke="#f87171" strokeDasharray="6 3" label={{ value: 'CPT $300k', fill: '#f87171', fontSize: 11 }} />
              {['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].map(reg => (
                <Line
                  key={reg}
                  type="monotone"
                  dataKey={reg}
                  stroke={REGION_COLORS[reg]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 3: Revenue Impact by Generator (2024) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
            Generator Revenue Impact during Cap Periods (2024, $M AUD)
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
            Negative = revenue loss under administered price
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart3Data} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="generator" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="M" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`$${v.toFixed(2)}M`, 'Revenue Impact']}
              />
              <ReferenceLine y={0} stroke="#6b7280" />
              <Bar dataKey="revenue_impact_m" name="Revenue Impact ($M)">
                {chart3Data.map((entry, idx) => (
                  <Cell key={idx} fill={entry.positive ? '#34d399' : '#f87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Remedy Actions — capacity_mw by action_type, coloured by outcome */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Remedy Action Capacity by Type and Outcome (MW)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart4Data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="action_type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {['Prevented Cap', 'Reduced Duration', 'Ineffective'].map(outcome => (
                <Bar key={outcome} dataKey={outcome} stackId="b" fill={OUTCOME_COLORS[outcome]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 5: Spot Price Distribution by Trigger Type */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Spot Price Distribution at Cap Events by Trigger Type (AUD/MWh)
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chart5Data} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="trigger_type" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $/MWh" width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`$${v.toLocaleString()}/MWh`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="avg_spot_price" name="Avg Spot Price ($/MWh)" radius={[4, 4, 0, 0]}>
              {chart5Data.map((entry, idx) => (
                <Cell key={idx} fill={TRIGGER_COLORS[entry.trigger_type] ?? '#60a5fa'} />
              ))}
            </Bar>
            <Bar dataKey="max_spot_price" name="Max Spot Price ($/MWh)" fill="#fbbf24" opacity={0.5} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-400" />
          FY Summary — Price Cap Intervention Overview
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-x-8 gap-y-5">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Cap Events</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{summary.total_cap_events_fy}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hours at Cap</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{summary.total_hours_at_cap_fy.toFixed(1)} hrs</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Max Administered Price</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">${summary.max_administered_price_aud_mwh.toFixed(0)}/MWh</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Consumer Savings</dt>
            <dd className="mt-1 text-lg font-semibold text-green-400">${summary.total_consumer_savings_m.toFixed(2)}M</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Most Affected Region</dt>
            <dd className="mt-1 text-lg font-semibold text-purple-400">{summary.most_affected_region}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Price Cap Events (dataset)</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{price_cap_events.length} events</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Market Impact Records</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{market_impact.length} region-quarter rows</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Generator Records</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{generator_response.length} gen-year rows</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Threshold Tracker</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{threshold_tracker.length} region-month rows</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Remedy Actions</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{remedy_actions.length} actions</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
