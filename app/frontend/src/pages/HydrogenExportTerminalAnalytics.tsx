import { useEffect, useState } from 'react'
import { Ship } from 'lucide-react'
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
  Cell,
} from 'recharts'
import {
  getHydrogenExportTerminalDashboard,
  HETADashboard,
} from '../api/client'

const STATUS_COLORS: Record<string, string> = {
  Operating:            '#22c55e',
  'Under Construction': '#3b82f6',
  FID:                  '#f59e0b',
  Feasibility:          '#9ca3af',
  Concept:              '#a855f7',
}

const SCENARIO_COLORS: Record<string, string> = {
  Base:               '#9ca3af',
  Optimistic:         '#22c55e',
  'Policy Supported': '#3b82f6',
}

const EXPORT_FORM_COLORS: Record<string, string> = {
  'Liquid H2':    '#3b82f6',
  Ammonia:        '#22c55e',
  LOHC:           '#f59e0b',
  'Compressed H2':'#a855f7',
}

const INFRA_STATUS_COLORS: Record<string, string> = {
  Committed: '#22c55e',
  Planning:  '#f59e0b',
  Needed:    '#ef4444',
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function HydrogenExportTerminalAnalytics() {
  const [data, setData] = useState<HETADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getHydrogenExportTerminalDashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Ship size={24} className="mr-2 animate-pulse" />
        Loading Hydrogen Export Terminal Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="p-6 text-red-500">
        Error: {error ?? 'No data returned'}
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>

  // Chart 2: Production cost line data — avg total_landed_cost_per_kg by year & scenario (WA only for clarity)
  const costByYearScenario: Record<string, Record<number, number[]>> = {}
  for (const s of ['Base', 'Optimistic', 'Policy Supported']) {
    costByYearScenario[s] = {}
  }
  for (const pc of data.production_costs) {
    if (pc.location === 'WA') {
      if (!costByYearScenario[pc.scenario][pc.year]) {
        costByYearScenario[pc.scenario][pc.year] = []
      }
      costByYearScenario[pc.scenario][pc.year].push(pc.total_landed_cost_per_kg)
    }
  }
  const allYears = Array.from(new Set(data.production_costs.map(p => p.year))).sort()
  const costLineData = allYears.map(year => {
    const row: Record<string, number | string> = { year }
    for (const scenario of ['Base', 'Optimistic', 'Policy Supported']) {
      const vals = costByYearScenario[scenario][year] ?? []
      row[scenario] = vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : 0
    }
    return row
  })

  // Chart 3: Export volume stacked by export_form by year
  const volByYearForm: Record<number, Record<string, number>> = {}
  for (const ev of data.export_volumes) {
    if (!volByYearForm[ev.year]) volByYearForm[ev.year] = {}
    volByYearForm[ev.year][ev.export_form] = (volByYearForm[ev.year][ev.export_form] ?? 0) + ev.volume_ktpa
  }
  const exportForms = ['Liquid H2', 'Ammonia', 'LOHC', 'Compressed H2']
  const volYears = Object.keys(volByYearForm).map(Number).sort()
  const volumeChartData = volYears.map(year => {
    const row: Record<string, number | string> = { year }
    for (const ef of exportForms) {
      row[ef] = parseFloat((volByYearForm[year][ef] ?? 0).toFixed(1))
    }
    return row
  })

  // Chart 4: Infrastructure capex_m summed by infrastructure_type
  const infraByType: Record<string, { capex: number; status: string }> = {}
  for (const inf of data.infrastructure) {
    if (!infraByType[inf.infrastructure_type]) {
      infraByType[inf.infrastructure_type] = { capex: 0, status: inf.status }
    }
    infraByType[inf.infrastructure_type].capex += inf.capex_m
  }
  const infraChartData = Object.entries(infraByType).map(([type, val]) => ({
    type,
    capex_m: parseFloat(val.capex.toFixed(1)),
    status: val.status,
  }))

  // Chart 5: Market demand grouped by country
  const demandChartData = data.market_demand.map(d => ({
    country: d.country,
    'Demand 2030 (Mtpa)': d.demand_2030_mtpa,
    'Demand 2040 (Mtpa)': d.demand_2040_mtpa,
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Ship size={28} className="text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Hydrogen Export Terminal Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Australian H2 export terminal pipeline, production costs, volumes and market demand
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Capacity"
          value={`${Number(summary.total_capacity_ktpa ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ktpa`}
          sub="Across all terminals"
        />
        <KpiCard
          label="Operating Terminals"
          value={String(summary.operating_terminals ?? 0)}
          sub="Currently exporting"
        />
        <KpiCard
          label="Total CapEx"
          value={`$${Number(summary.total_capex_b ?? 0).toFixed(1)}B`}
          sub="Combined capital expenditure"
        />
        <KpiCard
          label="Leading Export Form"
          value={String(summary.leading_export_form ?? '—')}
          sub="By export volume"
        />
      </div>

      {/* Chart 1: Terminal capacity by name, coloured by status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Terminal Capacity (ktpa) by Project
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data.terminals.map(t => ({
              name: t.terminal_name.length > 20 ? t.terminal_name.slice(0, 20) + '…' : t.terminal_name,
              capacity_ktpa: parseFloat(t.capacity_ktpa.toFixed(1)),
              status: t.status,
            }))}
            margin={{ top: 4, right: 16, left: 0, bottom: 90 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
            <YAxis unit=" kt" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v} ktpa`, 'Capacity']} />
            <Bar dataKey="capacity_ktpa" name="Capacity (ktpa)">
              {data.terminals.map((t, i) => (
                <Cell key={i} fill={STATUS_COLORS[t.status] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(STATUS_COLORS).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Landed cost by year for 3 scenarios (WA) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Total Landed Cost ($/kg) by Year and Scenario — WA
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={costLineData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis unit=" $/kg" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}/kg`]} />
            <Legend />
            {['Base', 'Optimistic', 'Policy Supported'].map(s => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={SCENARIO_COLORS[s]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Export volume stacked by export_form by year */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Export Volume (ktpa) by Year and Export Form
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={volumeChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis unit=" kt" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {exportForms.map(ef => (
              <Bar key={ef} dataKey={ef} stackId="a" fill={EXPORT_FORM_COLORS[ef] ?? '#6b7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Infrastructure CapEx by type */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Infrastructure CapEx ($M) by Type
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={infraChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="type" tick={{ fontSize: 11 }} />
            <YAxis unit=" $M" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(1)}M`, 'CapEx']} />
            <Bar dataKey="capex_m" name="CapEx ($M)">
              {infraChartData.map((d, i) => (
                <Cell key={i} fill={INFRA_STATUS_COLORS[d.status] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(INFRA_STATUS_COLORS).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 5: Market demand 2030 vs 2040 by country */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Import Market Demand (Mtpa) — 2030 vs 2040 by Country
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={demandChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="country" tick={{ fontSize: 11 }} />
            <YAxis unit=" Mt" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Demand 2030 (Mtpa)" fill="#9ca3af" />
            <Bar dataKey="Demand 2040 (Mtpa)" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(summary).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {k.replace(/_/g, ' ')}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 dark:text-white">
                {typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
