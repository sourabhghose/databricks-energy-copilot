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
import { Building } from 'lucide-react'
import {
  getElectricityNetworkCapitalInvestmentDashboard,
  ENCIDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const BUSINESS_COLOURS: Record<string, string> = {
  'Ausgrid':            '#3b82f6',
  'Endeavour Energy':   '#f59e0b',
  'Essential Energy':   '#10b981',
  'AusNet':             '#8b5cf6',
  'SA Power Networks':  '#f97316',
  'Energex':            '#06b6d4',
  'Ergon':              '#ec4899',
  'TasNetworks':        '#14b8a6',
  'TransGrid':          '#6366f1',
  'ElectraNet':         '#84cc16',
}

const CATEGORY_COLOURS: Record<string, string> = {
  'Augmentation':          '#3b82f6',
  'Replacement/Renewal':   '#f59e0b',
  'REZ Connection':        '#10b981',
  'Reliability':           '#8b5cf6',
  'Non-network':           '#f97316',
  'Digital/Smart Grid':    '#06b6d4',
}

const REGION_COLOURS: Record<string, string> = {
  'NSW': '#3b82f6',
  'VIC': '#8b5cf6',
  'QLD': '#f59e0b',
  'SA':  '#10b981',
  'TAS': '#06b6d4',
}

const DRIVER_COLOURS: Record<string, string> = {
  'EV Charging Load':     '#3b82f6',
  'Rooftop Solar':        '#f59e0b',
  'BESS Integration':     '#10b981',
  'Climate Resilience':   '#8b5cf6',
  'Asset Aging':          '#f97316',
  'REZ':                  '#06b6d4',
}

const TOP5_BUSINESSES = [
  'Ausgrid',
  'Endeavour Energy',
  'Essential Energy',
  'AusNet',
  'SA Power Networks',
]

const CATEGORIES = [
  'Augmentation',
  'Replacement/Renewal',
  'REZ Connection',
  'Reliability',
  'Non-network',
  'Digital/Smart Grid',
]

const NEED_DRIVERS = [
  'EV Charging Load',
  'Rooftop Solar',
  'BESS Integration',
  'Climate Resilience',
  'Asset Aging',
  'REZ',
]

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
        <Building size={16} />
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

export default function ElectricityNetworkCapitalInvestmentAnalytics() {
  const [data, setData] = useState<ENCIDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityNetworkCapitalInvestmentDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Electricity Network Capital Investment Analytics...
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

  // ── Chart 1: Stacked bar — capex_m by year x network_business (top 5 stacked) ──
  const years2018to2024 = [2018, 2019, 2020, 2021, 2022, 2023, 2024]
  const capexByYearBiz: Record<number, Record<string, number>> = {}
  for (const yr of years2018to2024) {
    capexByYearBiz[yr] = {}
  }
  for (const ns of data.network_spend) {
    if (!TOP5_BUSINESSES.includes(ns.network_business)) continue
    if (!capexByYearBiz[ns.year]) capexByYearBiz[ns.year] = {}
    capexByYearBiz[ns.year][ns.network_business] =
      (capexByYearBiz[ns.year][ns.network_business] ?? 0) + ns.capex_m
  }
  const capexStackedData = years2018to2024.map((yr) => ({
    year: yr,
    ...capexByYearBiz[yr],
  }))

  // ── Chart 2: Grouped bar — capex_m by category x year (6 categories) ──────
  const catByYear: Record<string, Record<string, number>> = {}
  for (const pc of data.project_categories) {
    const yrKey = String(pc.year)
    if (!catByYear[yrKey]) catByYear[yrKey] = {}
    catByYear[yrKey][pc.category] =
      (catByYear[yrKey][pc.category] ?? 0) + pc.capex_m
  }
  const catYears = Object.keys(catByYear).sort()
  const categoryChartData = catYears.map((yr) => ({
    year: yr,
    ...catByYear[yr],
  }))

  // ── Chart 3: Bar — regulatory_asset_base_m by network_business coloured by region ──
  const rabByBiz: Record<string, { rab: number; region: string }> = {}
  for (const rd of data.regulatory_determinations) {
    if (!rabByBiz[rd.network_business]) {
      rabByBiz[rd.network_business] = { rab: 0, region: '' }
    }
    rabByBiz[rd.network_business].rab += rd.regulatory_asset_base_m
    // find region from network_spend
    const ns = data.network_spend.find((s) => s.network_business === rd.network_business)
    if (ns) rabByBiz[rd.network_business].region = ns.region
  }
  const rabChartData = Object.entries(rabByBiz)
    .map(([biz, v]) => ({
      network_business: biz.length > 14 ? biz.slice(0, 12) + '…' : biz,
      rab_m: parseFloat(v.rab.toFixed(2)),
      region: v.region,
      fill: REGION_COLOURS[v.region] ?? '#6b7280',
    }))
    .sort((a, b) => b.rab_m - a.rab_m)

  // ── Chart 4: Bar — reliability_improvement_min by technology sorted desc ──
  const reliabilityByTech: Record<string, number[]> = {}
  for (const sg of data.smart_grid) {
    if (!reliabilityByTech[sg.technology]) reliabilityByTech[sg.technology] = []
    reliabilityByTech[sg.technology].push(sg.reliability_improvement_min)
  }
  const reliabilityChartData = Object.entries(reliabilityByTech)
    .map(([tech, vals]) => ({
      technology: tech,
      avg_reliability_min: parseFloat(
        (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
      ),
    }))
    .sort((a, b) => b.avg_reliability_min - a.avg_reliability_min)

  // ── Chart 5: Line — required_investment_m by year for 6 need drivers ──────
  const futureYears = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034]
  const futureByYearDriver: Record<number, Record<string, number>> = {}
  for (const yr of futureYears) {
    futureByYearDriver[yr] = {}
  }
  for (const fn of data.future_needs) {
    if (!futureByYearDriver[fn.year]) futureByYearDriver[fn.year] = {}
    futureByYearDriver[fn.year][fn.need_driver] =
      (futureByYearDriver[fn.year][fn.need_driver] ?? 0) + fn.required_investment_m
  }
  const futureLineData = futureYears.map((yr) => ({
    year: yr,
    ...futureByYearDriver[yr],
  }))

  return (
    <div className="p-6 space-y-8 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building className="text-blue-500" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Electricity Network Capital Investment Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Regulatory spend, project categories, RAB, smart grid investment &amp; future network needs
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total CapEx"
          value={`$${Number(summary.total_capex_b ?? 0).toFixed(2)}B`}
          sub="2018–2024 across all networks"
        />
        <KpiCard
          label="Smart Grid Investment"
          value={`$${Number(summary.total_smart_grid_investment_m ?? 0).toFixed(0)}M`}
          sub="5 technologies across key DNSPs"
        />
        <KpiCard
          label="Highest Spend Network"
          value={String(summary.highest_spend_network ?? '—')}
          sub="By total network spend"
        />
        <KpiCard
          label="Avg WACC"
          value={`${Number(summary.avg_wacc_pct ?? 0).toFixed(2)}%`}
          sub="Across regulatory determinations"
        />
      </div>

      {/* Chart 1: Stacked bar — CapEx by year x top 5 businesses */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          CapEx by Year — Top 5 Network Businesses (Stacked, $M)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={capexStackedData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(1)}M`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {TOP5_BUSINESSES.map((biz) => (
              <Bar
                key={biz}
                dataKey={biz}
                stackId="a"
                fill={BUSINESS_COLOURS[biz] ?? '#6b7280'}
                name={biz}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Grouped bar — CapEx by category x year */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Project Category CapEx by Year — 6 Categories ($M)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={categoryChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(1)}M`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {CATEGORIES.map((cat) => (
              <Bar
                key={cat}
                dataKey={cat}
                fill={CATEGORY_COLOURS[cat] ?? '#6b7280'}
                name={cat}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Bar — RAB by network business coloured by region */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Regulatory Asset Base by Network Business (coloured by Region, $M)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={rabChartData}
            margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="network_business"
              tick={{ fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(0)}M`} />
            <Bar dataKey="rab_m" name="RAB ($M)" isAnimationActive={false}>
              {rabChartData.map((entry, idx) => (
                <rect key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(REGION_COLOURS).map(([reg, col]) => (
            <span key={reg} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: col }} />
              {reg}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 4: Bar — Reliability improvement by technology */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Smart Grid Reliability Improvement by Technology (avg min/customer/year, desc)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={reliabilityChartData}
            margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="technology"
              tick={{ fontSize: 11 }}
              angle={-25}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 12 }} unit=" min" />
            <Tooltip formatter={(v: number) => `${v.toFixed(2)} min`} />
            <Bar dataKey="avg_reliability_min" name="Avg Reliability Improvement (min)" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Line — Required investment by year for 6 drivers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Future Network Investment Requirements by Year — 6 Drivers ($M)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={futureLineData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(1)}M`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {NEED_DRIVERS.map((driver) => (
              <Line
                key={driver}
                type="monotone"
                dataKey={driver}
                stroke={DRIVER_COLOURS[driver] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
                name={driver}
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
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total CapEx', value: `$${Number(summary.total_capex_b ?? 0).toFixed(2)}B` },
            {
              label: 'Smart Grid Investment',
              value: `$${Number(summary.total_smart_grid_investment_m ?? 0).toFixed(0)}M`,
            },
            { label: 'Highest Spend Network', value: String(summary.highest_spend_network ?? '—') },
            { label: 'Avg WACC', value: `${Number(summary.avg_wacc_pct ?? 0).toFixed(2)}%` },
            {
              label: 'Future Investment Needed',
              value: `$${Number(summary.future_investment_needed_b ?? 0).toFixed(2)}B`,
            },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium">{item.label}</dt>
              <dd className="text-lg font-bold text-gray-900 dark:text-white">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
