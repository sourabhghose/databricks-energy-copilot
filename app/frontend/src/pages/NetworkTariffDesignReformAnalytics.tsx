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
  LineChart,
  Line,
  Cell,
} from 'recharts'
import { Tag } from 'lucide-react'
import {
  getNetworkTariffDesignReformDashboard,
  NTDRDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const BUSINESS_COLOURS: Record<string, string> = {
  'Ausgrid':            '#3b82f6',
  'Endeavour':          '#f59e0b',
  'Essential':          '#10b981',
  'AusNet':             '#8b5cf6',
  'SA Power Networks':  '#ef4444',
  'Energex':            '#06b6d4',
  'Ergon':              '#ec4899',
}

const TARIFF_COLOURS: Record<string, string> = {
  'Residential TOU':      '#3b82f6',
  'Demand Tariff':        '#f59e0b',
  'Capacity Tariff':      '#10b981',
  'Critical Peak':        '#ef4444',
  'Time Varying Network': '#8b5cf6',
}

const STATUS_COLOURS: Record<string, string> = {
  'Implemented':  '#10b981',
  'Proposed':     '#3b82f6',
  'Rejected':     '#ef4444',
  'Under Review': '#f59e0b',
}

const LINE_COLOURS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444']

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
        <Tag size={16} />
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

export default function NetworkTariffDesignReformAnalytics() {
  const [data, setData] = useState<NTDRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNetworkTariffDesignReformDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Network Tariff Design &amp; Reform Analytics...
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

  // ── Chart 1: Grouped bar — adoption_pct by tariff_name × network_business (top 5) ──
  const top5Businesses = ['Ausgrid', 'Endeavour', 'Essential', 'AusNet', 'SA Power Networks']
  const tariffNames = ['Residential TOU', 'Demand Tariff', 'Capacity Tariff', 'Critical Peak', 'Time Varying Network']
  const adoptionByTariff: Record<string, Record<string, number>> = {}
  for (const t of data.tariffs) {
    if (!top5Businesses.includes(t.network_business)) continue
    if (!adoptionByTariff[t.tariff_name]) adoptionByTariff[t.tariff_name] = {}
    adoptionByTariff[t.tariff_name][t.network_business] = t.adoption_pct
  }
  const chart1Data = tariffNames.map((tn) => ({
    name: tn,
    ...(adoptionByTariff[tn] ?? {}),
  }))

  // ── Chart 2: Bar — bill_change_pct by customer_type coloured by tariff_name ──
  const chart2Data = data.bill_impacts.map((b) => ({
    name: b.customer_type,
    bill_change_pct: b.bill_change_pct,
    tariff_name: b.tariff_name,
  }))

  // ── Chart 3: Bar — gap_m by cost_component coloured by network_business (top 5) ──
  const top5ForCost = top5Businesses
  const costComponents = ['Peak Demand', 'Energy Usage', 'Fixed Costs', 'Cross Subsidy', 'EV Uplift']
  const gapByComponent: Record<string, Record<string, number>> = {}
  for (const cr of data.cost_reflectivity) {
    if (!top5ForCost.includes(cr.network_business)) continue
    if (!gapByComponent[cr.cost_component]) gapByComponent[cr.cost_component] = {}
    gapByComponent[cr.cost_component][cr.network_business] = cr.gap_m
  }
  const chart3Data = costComponents.map((comp) => ({
    name: comp,
    ...(gapByComponent[comp] ?? {}),
  }))

  // ── Chart 4: Bar — benefit_b by reform_name coloured by status ──────────
  const chart4Data = data.reform_options
    .slice()
    .sort((a, b) => b.benefit_b - a.benefit_b)
    .map((r) => ({
      name: r.reform_name.length > 22 ? r.reform_name.slice(0, 22) + '…' : r.reform_name,
      fullName: r.reform_name,
      benefit_b: r.benefit_b,
      status: r.status,
    }))

  // ── Chart 5: Line — export_tariff_per_kwh by year for 5 businesses ───────
  const exportBusinesses = Array.from(new Set(data.export_tariffs.map((e) => e.network_business))).slice(0, 5)
  const exportYears = Array.from(new Set(data.export_tariffs.map((e) => e.year))).sort((a, b) => a - b)
  const exportByYearBiz: Record<number, Record<string, number>> = {}
  for (const e of data.export_tariffs) {
    if (!exportByYearBiz[e.year]) exportByYearBiz[e.year] = {}
    exportByYearBiz[e.year][e.network_business] = e.export_tariff_per_kwh
  }
  const chart5Data = exportYears.map((yr) => ({
    year: yr,
    ...(exportByYearBiz[yr] ?? {}),
  }))

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Tag size={28} className="text-blue-500 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Network Tariff Design &amp; Reform Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sprint 130c — NTDR | Tariff Adoption, Bill Impacts, Cost Reflectivity, Reform Options &amp; Export Tariffs
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Most Cost-Reflective Network"
          value={String(summary['most_cost_reflective_network'])}
          sub="Smallest avg tariff-cost gap"
        />
        <KpiCard
          label="Avg TOU Adoption"
          value={`${summary['avg_adoption_tou_pct']}%`}
          sub="Across all TOU tariff records"
        />
        <KpiCard
          label="Total Cross-Subsidy"
          value={`$${summary['total_cross_subsidy_m']}M`}
          sub="Cross-subsidy cost component gap"
        />
        <KpiCard
          label="Export Tariff Networks"
          value={String(summary['export_tariff_networks'])}
          sub="DNSPs with export tariff data"
        />
      </div>

      {/* Chart 1 — Tariff adoption by tariff × business */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Tariff Adoption (%) by Tariff Name &amp; Network Business (Top 5)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart1Data} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(val: number) => [`${val.toFixed(1)}%`, '']} />
            <Legend />
            {top5Businesses.map((biz) => (
              <Bar key={biz} dataKey={biz} name={biz} fill={BUSINESS_COLOURS[biz] ?? '#6b7280'} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2 — Bill change % by customer type coloured by tariff */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Bill Change (%) Under Reform by Customer Type — Winners (green) vs Losers (red)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart2Data} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              formatter={(val: number, _name, props) => [
                `${val.toFixed(1)}%`,
                props.payload.tariff_name,
              ]}
            />
            <Bar dataKey="bill_change_pct" name="Bill Change (%)" radius={[4, 4, 0, 0]}>
              {chart2Data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.bill_change_pct >= 0 ? '#ef4444' : '#10b981'}
                />
              ))}
            </Bar>
            <Legend
              payload={[
                { value: 'Bill increase (loser)', type: 'square' as const, color: '#ef4444' },
                { value: 'Bill decrease (winner)', type: 'square' as const, color: '#10b981' },
              ]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3 — Cost reflectivity gap by component × business */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Cost Reflectivity Gap ($M) by Cost Component &amp; Network Business (Top 5)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart3Data} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(val: number) => [`$${val.toFixed(1)}M`, '']} />
            <Legend />
            {top5ForCost.map((biz) => (
              <Bar key={biz} dataKey={biz} name={biz} fill={BUSINESS_COLOURS[biz] ?? '#6b7280'} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — Reform benefit by reform name coloured by status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Reform Option Benefit ($B) by Reform Name — Coloured by Status
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chart4Data} margin={{ top: 10, right: 20, left: 0, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(val: number, _name, props) => [
                `$${val.toFixed(2)}B`,
                props.payload.status,
              ]}
              labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName ?? _label}
            />
            <Bar dataKey="benefit_b" name="Benefit ($B)" radius={[4, 4, 0, 0]}>
              {chart4Data.map((entry, idx) => (
                <Cell key={idx} fill={STATUS_COLOURS[entry.status] ?? '#6b7280'} />
              ))}
            </Bar>
            <Legend
              payload={Object.entries(STATUS_COLOURS).map(([name, color]) => ({
                value: name,
                type: 'square' as const,
                color,
              }))}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 — Export tariff per kWh by year for 5 businesses */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Network Export Tariff ($/kWh) by Year — 5 Network Businesses
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chart5Data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v.toFixed(3)} />
            <Tooltip formatter={(val: number) => [`$${val.toFixed(4)}/kWh`, '']} />
            <Legend />
            {exportBusinesses.map((biz, idx) => (
              <Line
                key={biz}
                type="monotone"
                dataKey={biz}
                name={biz}
                stroke={LINE_COLOURS[idx % LINE_COLOURS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Dashboard Summary
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Most Cost-Reflective Network</dt>
            <dd className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {String(summary['most_cost_reflective_network'])}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Avg TOU Adoption (%)</dt>
            <dd className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {String(summary['avg_adoption_tou_pct'])}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Total Cross-Subsidy ($M)</dt>
            <dd className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              ${String(summary['total_cross_subsidy_m'])}M
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Most Impactful Reform</dt>
            <dd className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {String(summary['most_impactful_reform'])}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Export Tariff Networks</dt>
            <dd className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {String(summary['export_tariff_networks'])}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
