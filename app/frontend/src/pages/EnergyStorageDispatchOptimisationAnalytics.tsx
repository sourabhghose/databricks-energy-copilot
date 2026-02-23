import React, { useEffect, useState } from 'react'
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
import { Battery } from 'lucide-react'
import {
  getEnergyStorageDispatchOptimisationDashboard,
  ESDODashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const TECH_COLOURS: Record<string, string> = {
  'LFP BESS':  '#3b82f6',
  'NMC BESS':  '#10b981',
  'PHES':      '#8b5cf6',
  'Flywheel':  '#f59e0b',
}

const STRATEGY_COLOURS: Record<string, string> = {
  'Perfect Foresight': '#3b82f6',
  'MPC':               '#10b981',
  'Rule-Based':        '#f59e0b',
  'RL Agent':          '#8b5cf6',
}

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#8b5cf6',
  SA1:  '#10b981',
  TAS1: '#06b6d4',
}

const TOP_STRATEGIES = ['Perfect Foresight', 'MPC', 'Rule-Based', 'RL Agent']

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
        <Battery size={16} />
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

export default function EnergyStorageDispatchOptimisationAnalytics() {
  const [data, setData] = useState<ESDODashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyStorageDispatchOptimisationDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Energy Storage Dispatch Optimisation Analytics...
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

  // ── Chart 1: Bar — capacity_mw by asset_name coloured by technology ───────
  const capacityChartData = data.assets.map((a) => ({
    asset_label: a.asset_name.length > 18 ? a.asset_name.slice(0, 16) + '…' : a.asset_name,
    asset_name: a.asset_name,
    capacity_mw: a.capacity_mw,
    technology: a.technology,
  }))

  // ── Chart 2: Line — soc_pct over intervals for 3 assets ──────────────────
  const chart2Assets = Array.from(new Set(data.dispatch_intervals.map((d) => d.asset_name))).slice(0, 3)
  const intervalsByAsset: Record<string, { interval: number; soc_pct: number }[]> = {}
  for (const rec of data.dispatch_intervals) {
    if (!chart2Assets.includes(rec.asset_name)) continue
    if (!intervalsByAsset[rec.asset_name]) intervalsByAsset[rec.asset_name] = []
    intervalsByAsset[rec.asset_name].push({ interval: rec.interval, soc_pct: rec.soc_pct })
  }
  // Build merged array sorted by interval index
  const allIntervals = Array.from(
    new Set(data.dispatch_intervals.filter((d) => chart2Assets.includes(d.asset_name)).map((d) => d.interval))
  ).sort((a, b) => a - b)
  const socChartData = allIntervals.map((iv) => {
    const row: Record<string, unknown> = { interval: iv }
    for (const an of chart2Assets) {
      const match = intervalsByAsset[an]?.find((r) => r.interval === iv)
      if (match) row[an] = match.soc_pct
    }
    return row
  })
  const chart2Colours = ['#3b82f6', '#10b981', '#f59e0b']

  // ── Chart 3: Grouped bar — net_revenue_m by asset × strategy (top 4) ─────
  const chart3Assets = Array.from(new Set(data.optimisation_results.map((r) => r.asset_name))).slice(0, 6)
  const revByAsset: Record<string, Record<string, number>> = {}
  for (const rec of data.optimisation_results) {
    if (!chart3Assets.includes(rec.asset_name)) continue
    if (!TOP_STRATEGIES.includes(rec.strategy)) continue
    if (!revByAsset[rec.asset_name]) revByAsset[rec.asset_name] = {}
    revByAsset[rec.asset_name][rec.strategy] = rec.net_revenue_m
  }
  const revChartData = chart3Assets.map((an) => ({
    asset_label: an.length > 18 ? an.slice(0, 16) + '…' : an,
    asset_name: an,
    ...(revByAsset[an] ?? {}),
  }))

  // ── Chart 4: Line — avg_soc_pct by month for 5 assets ────────────────────
  const socAssets = Array.from(new Set(data.battery_states.map((b) => b.asset_name)))
  const socByMonth: Record<string, Record<string, unknown>> = {}
  for (const rec of data.battery_states) {
    if (!socByMonth[rec.month]) socByMonth[rec.month] = { month: rec.month }
    socByMonth[rec.month][rec.asset_name] = rec.avg_soc_pct
  }
  const socMonthData = Object.values(socByMonth).sort((a, b) =>
    String(a.month).localeCompare(String(b.month))
  )
  const socAssetColours = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

  // ── Chart 5: Bar — capturable_revenue_m by opportunity_type coloured by region ──
  const oppTypes = Array.from(new Set(data.market_opportunities.map((o) => o.opportunity_type)))
  const regions = Array.from(new Set(data.market_opportunities.map((o) => o.region)))
  const oppByType: Record<string, Record<string, number>> = {}
  for (const rec of data.market_opportunities) {
    if (!oppByType[rec.opportunity_type]) oppByType[rec.opportunity_type] = {}
    oppByType[rec.opportunity_type][rec.region] =
      (oppByType[rec.opportunity_type][rec.region] ?? 0) + rec.capturable_revenue_m
  }
  const oppChartData = oppTypes.map((ot) => ({
    opp_label: ot.length > 18 ? ot.slice(0, 16) + '…' : ot,
    opportunity_type: ot,
    ...(oppByType[ot] ?? {}),
  }))

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Battery size={28} className="text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Energy Storage Dispatch Optimisation Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sprint 126a — ESDO | BESS &amp; PHES Dispatch, Revenue Optimisation &amp; Market Opportunities
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Storage Capacity"
          value={`${Number(summary.total_storage_capacity_gw ?? 0).toFixed(3)} GW`}
          sub="Aggregate nameplate capacity across all assets"
        />
        <KpiCard
          label="Avg Round-Trip Efficiency"
          value={`${Number(summary.avg_round_trip_efficiency_pct ?? 0).toFixed(1)}%`}
          sub="Fleet-average round-trip efficiency"
        />
        <KpiCard
          label="Best Strategy"
          value={String(summary.best_strategy ?? '—')}
          sub="Highest cumulative net revenue across assets"
        />
        <KpiCard
          label="Total Net Revenue"
          value={`$${Number(summary.total_net_revenue_m ?? 0).toFixed(1)}M`}
          sub="Sum of net revenue across all assets & strategies"
        />
      </div>

      {/* Chart 1: Capacity by Asset coloured by Technology */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Storage Capacity (MW) by Asset — Coloured by Technology
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={capacityChartData} margin={{ top: 4, right: 24, bottom: 80, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="asset_label"
              tick={{ fontSize: 10 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip
              formatter={(value: unknown) => [`${Number(value).toLocaleString()} MW`, 'Capacity']}
              labelFormatter={(label: string) => {
                const rec = capacityChartData.find((d) => d.asset_label === label)
                return rec ? `${rec.asset_name} (${rec.technology})` : label
              }}
            />
            <Legend />
            {Object.entries(TECH_COLOURS).map(([tech, colour]) => (
              <Bar
                key={tech}
                dataKey={(entry: Record<string, unknown>) =>
                  (entry as { technology: string; capacity_mw: number }).technology === tech
                    ? (entry as { capacity_mw: number }).capacity_mw
                    : null
                }
                name={tech}
                fill={colour}
                stackId="tech"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: SoC over Intervals — 3 Assets */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          State of Charge (%) over Sample Dispatch Intervals — 3 Assets
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={socChartData} margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="interval" tick={{ fontSize: 11 }} label={{ value: 'Interval (5-min)', position: 'insideBottom', offset: -4, fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} label={{ value: 'SoC %', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip formatter={(value: unknown, name: string) => [`${Number(value).toFixed(1)}%`, name]} />
            <Legend />
            {chart2Assets.map((an, idx) => (
              <Line
                key={an}
                type="monotone"
                dataKey={an}
                stroke={chart2Colours[idx % chart2Colours.length]}
                dot={false}
                strokeWidth={2}
                name={an.length > 22 ? an.slice(0, 20) + '…' : an}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Net Revenue by Asset x Strategy (top 4 strategies) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Net Revenue ($M) by Asset &amp; Strategy — Top 4 Strategies
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={revChartData} margin={{ top: 4, right: 24, bottom: 80, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="asset_label"
              tick={{ fontSize: 10 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} label={{ value: '$M', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip formatter={(value: unknown, name: string) => [`$${Number(value).toFixed(2)}M`, name]} />
            <Legend />
            {TOP_STRATEGIES.map((strat) => (
              <Bar
                key={strat}
                dataKey={strat}
                fill={STRATEGY_COLOURS[strat]}
                name={strat}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Avg SoC by Month for 5 Assets */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Average State of Charge (%) by Month — 5 Assets
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={socMonthData} margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} label={{ value: 'SoC %', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip formatter={(value: unknown, name: string) => [`${Number(value).toFixed(1)}%`, name]} />
            <Legend />
            {socAssets.map((an, idx) => (
              <Line
                key={an}
                type="monotone"
                dataKey={an}
                stroke={socAssetColours[idx % socAssetColours.length]}
                dot={false}
                strokeWidth={2}
                name={an.length > 22 ? an.slice(0, 20) + '…' : an}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Capturable Revenue by Opportunity Type coloured by Region */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Capturable Revenue ($M) by Opportunity Type — Coloured by Region
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={oppChartData} margin={{ top: 4, right: 24, bottom: 60, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="opp_label"
              tick={{ fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} label={{ value: '$M', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip formatter={(value: unknown, name: string) => [`$${Number(value).toFixed(3)}M`, name]} />
            <Legend />
            {regions.map((r) => (
              <Bar
                key={r}
                dataKey={r}
                fill={REGION_COLOURS[r] ?? '#6b7280'}
                name={r}
                stackId="region"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary DL grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Dashboard Summary
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Total Storage Capacity (GW)
            </dt>
            <dd className="text-base font-semibold text-gray-900 dark:text-white mt-1">
              {Number(summary.total_storage_capacity_gw ?? 0).toFixed(3)} GW
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Avg Round-Trip Efficiency
            </dt>
            <dd className="text-base font-semibold text-gray-900 dark:text-white mt-1">
              {Number(summary.avg_round_trip_efficiency_pct ?? 0).toFixed(1)}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Best Strategy
            </dt>
            <dd className="text-base font-semibold text-gray-900 dark:text-white mt-1">
              {String(summary.best_strategy ?? '—')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Total Net Revenue ($M)
            </dt>
            <dd className="text-base font-semibold text-gray-900 dark:text-white mt-1">
              ${Number(summary.total_net_revenue_m ?? 0).toFixed(1)}M
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Most Active Region
            </dt>
            <dd className="text-base font-semibold text-gray-900 dark:text-white mt-1">
              {String(summary.most_active_region ?? '—')}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
