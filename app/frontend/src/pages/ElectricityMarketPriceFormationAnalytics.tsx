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
  ScatterChart,
  Scatter,
  Cell,
} from 'recharts'
import { DollarSign } from 'lucide-react'
import {
  getElectricityMarketPriceFormationDashboard,
  EMPFDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const FUEL_COLOURS: Record<string, string> = {
  'Black Coal':  '#374151',
  'Brown Coal':  '#92400e',
  'Gas CCGT':    '#f59e0b',
  'Gas OCGT':    '#ef4444',
  'Hydro':       '#3b82f6',
  'Wind':        '#10b981',
  'Solar':       '#fbbf24',
}

const EVENT_TYPE_COLOURS: Record<string, string> = {
  'Price Spike >$300': '#ef4444',
  'Negative Price':    '#3b82f6',
  'Administered Price':'#f59e0b',
  'VOLL':              '#8b5cf6',
}

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#8b5cf6',
  SA1:  '#10b981',
  TAS1: '#06b6d4',
}

const PARTICIPANT_COLOURS: Record<string, string> = {
  'AGL':              '#3b82f6',
  'Origin':           '#f59e0b',
  'Snowy Hydro':      '#10b981',
  'EnergyAustralia':  '#8b5cf6',
}

const TECH_COLOURS: Record<string, string> = {
  'New Entrant CCGT': '#f59e0b',
  'New Entrant Wind': '#10b981',
  'New Entrant Solar':'#fbbf24',
  'New Entrant BESS': '#3b82f6',
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
        <DollarSign size={16} />
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

export default function ElectricityMarketPriceFormationAnalytics() {
  const [data, setData] = useState<EMPFDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityMarketPriceFormationDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Electricity Market Price Formation Analytics...
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

  // ── Chart 1: Stacked bar — price driver components by month for NSW1 ──────
  const nsw1Drivers = data.price_drivers
    .filter((r) => r.region === 'NSW1')
    .sort((a, b) => a.month.localeCompare(b.month))
  const chart1Data = nsw1Drivers.map((r) => ({
    month: r.month.slice(5),
    'Fuel Cost': r.fuel_cost_component,
    'Carbon Cost': r.carbon_cost_component,
    'Capacity Scarcity': r.capacity_scarcity_component,
    'Network Constraint': r.network_constraint_component,
    'Renewable Suppression': r.renewable_suppression_component,
    'FCAS Cost': r.fcas_cost_component,
  }))
  const chart1Keys = ['Fuel Cost', 'Carbon Cost', 'Capacity Scarcity', 'Network Constraint', 'Renewable Suppression', 'FCAS Cost']
  const chart1Colours = ['#374151', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6']

  // ── Chart 2: Bar — pct_intervals_marginal by fuel_type ───────────────────
  const fuelMap: Record<string, number[]> = {}
  for (const mu of data.marginal_units) {
    if (!fuelMap[mu.fuel_type]) fuelMap[mu.fuel_type] = []
    fuelMap[mu.fuel_type].push(mu.pct_intervals_marginal)
  }
  const chart2Data = Object.entries(fuelMap).map(([fuel_type, vals]) => ({
    fuel_type,
    pct_intervals_marginal: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
  }))

  // ── Chart 3: Scatter — peak_price vs duration_intervals, size by total_cost_m, colour by event_type ──
  const chart3Data = data.price_events.map((e) => ({
    peak_price: e.peak_price,
    duration_intervals: e.duration_intervals,
    total_cost_m: e.total_cost_m,
    event_type: e.event_type,
    region: e.region,
  }))

  // ── Chart 4: Bar — capacity_bid_at_voll_pct by participant grouped by quarter ──
  const participants = ['AGL', 'Origin', 'Snowy Hydro', 'EnergyAustralia']
  const quartersSet = Array.from(new Set(data.bidding_behaviour.map((b) => b.quarter))).sort()
  const byQuarter: Record<string, Record<string, number>> = {}
  for (const bb of data.bidding_behaviour) {
    if (!byQuarter[bb.quarter]) byQuarter[bb.quarter] = {}
    byQuarter[bb.quarter][bb.participant] = bb.capacity_bid_at_voll_pct
  }
  const chart4Data = quartersSet.map((q) => ({
    quarter: q,
    ...(byQuarter[q] ?? {}),
  }))

  // ── Chart 5: Bar — lrmc_per_mwh by technology×region ────────────────────
  const technologies = ['New Entrant CCGT', 'New Entrant Wind', 'New Entrant Solar', 'New Entrant BESS']
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const lrmcByTech: Record<string, Record<string, { lrmc: number; req_cf: number; curr_cf: number; signal: string }>> = {}
  for (const lc of data.long_run_costs) {
    if (!lrmcByTech[lc.technology]) lrmcByTech[lc.technology] = {}
    lrmcByTech[lc.technology][lc.region] = {
      lrmc: lc.lrmc_per_mwh,
      req_cf: lc.required_capacity_factor_pct,
      curr_cf: lc.current_cf_pct,
      signal: lc.investment_signal,
    }
  }
  const chart5Data = technologies.map((tech) => {
    const row: Record<string, unknown> = { technology: tech.replace('New Entrant ', '') }
    for (const region of regions) {
      row[region] = lrmcByTech[tech]?.[region]?.lrmc ?? 0
    }
    return row
  })

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <DollarSign size={28} className="text-green-600 dark:text-green-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Electricity Market Price Formation Deep Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sprint 127a — EMPF | Price Drivers, Marginal Units, Events, Bidding Behaviour &amp; LRMC
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Avg Spot Price"
          value={`$${Number(summary.avg_spot_price_mwh ?? 0).toFixed(2)}/MWh`}
          sub="Annual average across all NEM regions"
        />
        <KpiCard
          label="Most Frequent Price Setter"
          value={String(summary.most_frequent_price_setter ?? '—')}
          sub="Fuel type most often setting spot price"
        />
        <KpiCard
          label="Price Spike Events YTD"
          value={String(summary.price_spike_events_ytd ?? 0)}
          sub="Events with peak price > $300/MWh"
        />
        <KpiCard
          label="Avg LRMC New Wind"
          value={`$${Number(summary.avg_lrmc_new_wind ?? 0).toFixed(2)}/MWh`}
          sub="Long-run marginal cost, new entrant wind"
        />
      </div>

      {/* Chart 1: Stacked bar — NSW1 price driver components by month */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 1: Price Driver Components by Month — NSW1
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart1Data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis unit=" $/MWh" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(2)}/MWh`} />
            <Legend />
            {chart1Keys.map((key, i) => (
              <Bar key={key} dataKey={key} stackId="a" fill={chart1Colours[i]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Bar — pct_intervals_marginal by fuel_type */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 2: Average % Intervals Marginal by Fuel Type
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart2Data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fuel_type" tick={{ fontSize: 11 }} />
            <YAxis unit="%" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
            <Bar dataKey="pct_intervals_marginal" name="% Intervals Marginal">
              {chart2Data.map((entry) => (
                <Cell key={entry.fuel_type} fill={FUEL_COLOURS[entry.fuel_type] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Scatter — peak_price vs duration_intervals */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 3: Price Events — Peak Price vs Duration (size = Total Cost $M)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="duration_intervals" name="Duration (intervals)" unit=" int" tick={{ fontSize: 11 }} />
            <YAxis dataKey="peak_price" name="Peak Price" unit=" $/MWh" tick={{ fontSize: 11 }} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (!payload || payload.length === 0) return null
                const d = payload[0]?.payload as typeof chart3Data[0]
                return (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs shadow">
                    <div><b>Type:</b> {d.event_type}</div>
                    <div><b>Region:</b> {d.region}</div>
                    <div><b>Peak:</b> ${d.peak_price.toFixed(2)}/MWh</div>
                    <div><b>Duration:</b> {d.duration_intervals} intervals</div>
                    <div><b>Total Cost:</b> ${d.total_cost_m.toFixed(3)}M</div>
                  </div>
                )
              }}
            />
            <Scatter data={chart3Data} name="Price Events">
              {chart3Data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={EVENT_TYPE_COLOURS[entry.event_type] ?? '#6b7280'}
                  r={Math.max(4, Math.sqrt(entry.total_cost_m) * 3)}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(EVENT_TYPE_COLOURS).map(([et, color]) => (
            <span key={et} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
              {et}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 4: Grouped bar — capacity_bid_at_voll_pct by participant × quarter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 4: Capacity Bid at VoLL (%) by Participant &amp; Quarter
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chart4Data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="quarter" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
            <YAxis unit="%" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
            <Legend />
            {participants.map((p) => (
              <Bar key={p} dataKey={p} name={p} fill={PARTICIPANT_COLOURS[p] ?? '#6b7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Bar — lrmc_per_mwh by technology × region */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Chart 5: LRMC ($/MWh) by Technology &amp; Region
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart5Data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="technology" tick={{ fontSize: 11 }} />
            <YAxis unit=" $/MWh" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(2)}/MWh`} />
            <Legend />
            {regions.map((r) => (
              <Bar key={r} dataKey={r} name={r} fill={REGION_COLOURS[r] ?? '#6b7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        {/* Required vs Current CF annotation table */}
        <div className="mt-4 overflow-x-auto">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-2 py-1 text-left">Technology</th>
                <th className="px-2 py-1 text-left">Region</th>
                <th className="px-2 py-1 text-right">Req CF %</th>
                <th className="px-2 py-1 text-right">Curr CF %</th>
                <th className="px-2 py-1 text-center">Signal</th>
              </tr>
            </thead>
            <tbody>
              {data.long_run_costs.map((lc, i) => (
                <tr key={i} className="border-t border-gray-200 dark:border-gray-600">
                  <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{lc.technology}</td>
                  <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{lc.region}</td>
                  <td className="px-2 py-1 text-right">{lc.required_capacity_factor_pct.toFixed(1)}%</td>
                  <td className="px-2 py-1 text-right">{lc.current_cf_pct.toFixed(1)}%</td>
                  <td className="px-2 py-1 text-center">
                    <span
                      className={`px-2 py-0.5 rounded font-semibold ${
                        lc.investment_signal === 'Invest'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : lc.investment_signal === 'Wait'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}
                    >
                      {lc.investment_signal}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Avg Spot Price (MWh)</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              ${Number(summary.avg_spot_price_mwh ?? 0).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Most Frequent Price Setter</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {String(summary.most_frequent_price_setter ?? '—')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Price Spike Events YTD</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {String(summary.price_spike_events_ytd ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Avg LRMC New Wind ($/MWh)</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              ${Number(summary.avg_lrmc_new_wind ?? 0).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Most Concentrated Region</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {String(summary.most_concentrated_region ?? '—')}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
