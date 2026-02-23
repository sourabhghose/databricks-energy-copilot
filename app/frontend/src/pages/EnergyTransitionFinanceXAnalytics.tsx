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
import { TrendingUp } from 'lucide-react'
import {
  getEnergyTransitionFinanceXDashboard,
  ETFAXDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const SECTOR_COLOURS: Record<string, string> = {
  'Utility Solar':      '#f59e0b',
  'Wind':               '#3b82f6',
  'BESS':               '#10b981',
  'Transmission':       '#8b5cf6',
  'Hydrogen':           '#06b6d4',
  'EV Infrastructure':  '#f97316',
  'Energy Efficiency':  '#84cc16',
}

const TECH_LINE_COLOURS: Record<string, string> = {
  'Utility Solar':  '#f59e0b',
  'Wind':           '#3b82f6',
  'BESS':           '#10b981',
  'Offshore Wind':  '#0ea5e9',
  'Hydrogen':       '#06b6d4',
  'Nuclear SMR':    '#a855f7',
}

const FINANCE_STATUS_COLOURS: Record<string, string> = {
  'Financial Close':    '#10b981',
  'Debt Raising':       '#3b82f6',
  'Equity Raising':     '#f59e0b',
  'Government Support': '#8b5cf6',
  'Pre-FID':            '#6b7280',
}

const BOND_TYPE_COLOURS: Record<string, string> = {
  'Green Bond':         '#10b981',
  'Sustainability Bond':'#3b82f6',
  'Climate Bond':       '#06b6d4',
  'Transition Bond':    '#f59e0b',
}

const STATUS_COLOUR: Record<string, string> = {
  'Active':    '#10b981',
  'Completed': '#6b7280',
  'Proposed':  '#f59e0b',
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
        <TrendingUp size={16} />
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

export default function EnergyTransitionFinanceXAnalytics() {
  const [data, setData] = useState<ETFAXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyTransitionFinanceXDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Energy Transition Finance Analytics…
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

  // ── Chart 1: Stacked bar — investment_m by year × sector ──────────────────
  const yearMap: Record<number, Record<string, number>> = {}
  for (const f of data.investment_flows) {
    if (!yearMap[f.year]) yearMap[f.year] = {}
    yearMap[f.year][f.sector] = (yearMap[f.year][f.sector] ?? 0) + f.investment_m
  }
  const investmentByYear = Object.entries(yearMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, sectors]) => ({ year, ...sectors }))

  const allSectors = Array.from(new Set(data.investment_flows.map((f) => f.sector)))

  // ── Chart 2: Bar — amount_m by issuer coloured by bond_type ───────────────
  const bondByIssuer: Record<string, Record<string, number>> = {}
  for (const b of data.green_bonds) {
    if (!bondByIssuer[b.issuer]) bondByIssuer[b.issuer] = {}
    bondByIssuer[b.issuer][b.bond_type] = (bondByIssuer[b.issuer][b.bond_type] ?? 0) + b.amount_m
  }
  const bondChartData = Object.entries(bondByIssuer).map(([issuer, types]) => ({
    issuer,
    ...types,
  }))
  const allBondTypes = Array.from(new Set(data.green_bonds.map((b) => b.bond_type)))

  // ── Chart 3: Line — wacc_pct by year for 6 technologies (Base scenario) ───
  const baseCoc = data.cost_of_capital.filter((c) => c.scenario === 'Base')
  const waccByYearMap: Record<number, Record<string, number>> = {}
  for (const c of baseCoc) {
    if (!waccByYearMap[c.year]) waccByYearMap[c.year] = {}
    waccByYearMap[c.year][c.technology] = c.wacc_pct
  }
  const waccChartData = Object.entries(waccByYearMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, techs]) => ({ year, ...techs }))
  const allTechs = Array.from(new Set(baseCoc.map((c) => c.technology)))

  // ── Chart 4: Bar — total_funding_b by program coloured by status ──────────
  const govChartData = data.government_support.map((g) => ({
    name: g.program_name.length > 20 ? g.program_name.slice(0, 18) + '…' : g.program_name,
    total_funding_b: g.total_funding_b,
    committed_b: g.committed_b,
    status: g.status,
    fill: STATUS_COLOUR[g.status] ?? '#6b7280',
  }))

  // ── Chart 5: Bar — capex_m by project_name (top 15) coloured by finance_status ─
  const top15Pipeline = [...data.project_pipeline]
    .sort((a, b) => b.capex_m - a.capex_m)
    .slice(0, 15)

  return (
    <div className="p-6 space-y-8 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingUp size={28} className="text-emerald-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Energy Transition Finance Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Investment flows, green bonds, cost of capital, government support and project pipeline
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Investment"
          value={`$${(summary.total_investment_b as number).toFixed(1)}B`}
          sub="Cumulative 2018–2024"
        />
        <KpiCard
          label="Total Green Bonds"
          value={`$${(summary.total_green_bonds_b as number).toFixed(1)}B`}
          sub="Across all issuers"
        />
        <KpiCard
          label="Avg WACC (Base)"
          value={`${(summary.avg_wacc_pct as number).toFixed(1)}%`}
          sub="Weighted avg cost of capital"
        />
        <KpiCard
          label="Pipeline Capacity"
          value={`${(summary.pipeline_capacity_gw as number).toFixed(1)} GW`}
          sub="30 projects in pipeline"
        />
      </div>

      {/* Chart 1 — Investment by Year & Sector */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Investment Flows by Year &amp; Sector ($M)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={investmentByYear} margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}B`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(0)}M`, '']} />
            <Legend />
            {allSectors.map((sector) => (
              <Bar
                key={sector}
                dataKey={sector}
                stackId="year"
                fill={SECTOR_COLOURS[sector] ?? '#6b7280'}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2 — Green Bond Issuance by Issuer */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Green Bond Issuance by Issuer ($M)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={bondChartData} margin={{ top: 4, right: 20, bottom: 24, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="issuer" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
            <YAxis tickFormatter={(v) => `$${v.toFixed(0)}M`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(0)}M`, '']} />
            <Legend />
            {allBondTypes.map((bt) => (
              <Bar
                key={bt}
                dataKey={bt}
                stackId="issuer"
                fill={BOND_TYPE_COLOURS[bt] ?? '#6b7280'}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3 — WACC by Year (Base Scenario) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Weighted Average Cost of Capital by Technology — Base Scenario (%)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={waccChartData} margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '']} />
            <Legend />
            {allTechs.map((tech) => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                stroke={TECH_LINE_COLOURS[tech] ?? '#6b7280'}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — Government Support Programs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Government Support Programs — Total Funding ($B)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={govChartData} margin={{ top: 4, right: 20, bottom: 60, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tickFormatter={(v) => `$${v.toFixed(1)}B`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}B`, '']} />
            <Bar dataKey="total_funding_b" name="Total Funding">
              {govChartData.map((entry, idx) => (
                <rect key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Active</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-500 inline-block" /> Completed</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Proposed</span>
        </div>
      </div>

      {/* Chart 5 — Project Pipeline Top 15 by CAPEX */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Project Pipeline — Top 15 by CAPEX ($M)
        </h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart
            data={top15Pipeline.map((p) => ({
              name: p.project_name.length > 22 ? p.project_name.slice(0, 20) + '…' : p.project_name,
              capex_m: p.capex_m,
              fill: FINANCE_STATUS_COLOURS[p.finance_status] ?? '#6b7280',
              finance_status: p.finance_status,
            }))}
            layout="vertical"
            margin={{ top: 4, right: 20, bottom: 4, left: 180 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(0)}M`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={175} />
            <Tooltip formatter={(v: number, _: string, props: { payload?: { finance_status?: string } }) => [
              `$${v.toFixed(0)}M`,
              props.payload?.finance_status ?? 'CAPEX',
            ]} />
            <Bar dataKey="capex_m" name="CAPEX ($M)" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
          {Object.entries(FINANCE_STATUS_COLOURS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: v }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Total Investment (2018–2024)</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              ${(summary.total_investment_b as number).toFixed(2)}B
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Total Green Bonds Issued</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              ${(summary.total_green_bonds_b as number).toFixed(2)}B
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Avg WACC (Base Scenario)</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {(summary.avg_wacc_pct as number).toFixed(2)}%
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Largest Investor Type</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {summary.largest_investor_type as string}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Pipeline Capacity</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {(summary.pipeline_capacity_gw as number).toFixed(2)} GW
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Govt Support Programs</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">
              {data.government_support.length} programs
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
