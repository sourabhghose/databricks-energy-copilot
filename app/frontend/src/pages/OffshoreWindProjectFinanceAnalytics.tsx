import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ZAxis,
} from 'recharts'
import { Anchor } from 'lucide-react'
import {
  getOffshoreWindProjectFinanceDashboard,
  OWPFXDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const STATUS_COLOURS: Record<string, string> = {
  'Feasibility':         '#94a3b8',
  'EIS':                 '#60a5fa',
  'Planning Approval':   '#f59e0b',
  'Finance':             '#a78bfa',
  'Under Construction':  '#34d399',
  'Operating':           '#10b981',
}

const COMPONENT_COLOURS: Record<string, string> = {
  'Turbines':                 '#3b82f6',
  'Foundation & Substructure':'#8b5cf6',
  'Offshore Cable':            '#10b981',
  'Onshore Grid':              '#f59e0b',
  'Installation':              '#ef4444',
  'Development':               '#06b6d4',
  'O&M Reserve':               '#f97316',
}

const BOTTLENECK_COLOURS: Record<string, string> = {
  High:   '#ef4444',
  Medium: '#f59e0b',
  Low:    '#10b981',
}

const COMPLEXITY_COLOURS: Record<string, string> = {
  High:   '#ef4444',
  Medium: '#f59e0b',
  Low:    '#10b981',
}

const TOP_PROJECTS_FOR_COST = 8
const COST_COMPONENTS = [
  'Turbines',
  'Foundation & Substructure',
  'Offshore Cable',
  'Onshore Grid',
  'Installation',
  'Development',
  'O&M Reserve',
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
      {sub && (
        <span className="text-xs text-gray-400 dark:text-gray-500">{sub}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function OffshoreWindProjectFinanceAnalytics() {
  const [data, setData] = useState<OWPFXDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getOffshoreWindProjectFinanceDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
  }, [])

  if (error) {
    return (
      <div className="p-8 text-red-500">
        Failed to load Offshore Wind Project Finance data: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-gray-500 dark:text-gray-400">
        Loading Offshore Wind Project Finance Analytics…
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>

  // Chart 1 data — capacity by project coloured by status
  const capacityData = data.projects.map((p) => ({
    name: p.project_name.length > 20 ? p.project_name.slice(0, 18) + '…' : p.project_name,
    capacity_mw: p.capacity_mw,
    status: p.status,
  }))

  // Chart 2 data — stacked cost components by project (top 8 projects)
  const top8Projects = data.projects.slice(0, TOP_PROJECTS_FOR_COST).map((p) => p.project_name)
  const costByProject: Record<string, Record<string, number>> = {}
  for (const cb of data.cost_breakdown) {
    if (!top8Projects.includes(cb.project_name)) continue
    if (!costByProject[cb.project_name]) costByProject[cb.project_name] = {}
    costByProject[cb.project_name][cb.component] = cb.cost_m
  }
  const costChartData = top8Projects.map((pname) => ({
    name: pname.length > 18 ? pname.slice(0, 16) + '…' : pname,
    ...(costByProject[pname] ?? {}),
  }))

  // Chart 3 data — scatter irr_pct vs lcoe_per_mwh sized by npv_m
  const scatterData = data.financing.map((f) => ({
    name: f.project_name,
    irr_pct: f.irr_pct,
    lcoe_per_mwh: f.lcoe_per_mwh,
    npv_m: f.npv_m,
  }))

  // Chart 4 data — lead_time_years by component coloured by bottleneck_risk
  const leadTimeData = data.supply_chain.map((s) => ({
    name: `${s.component} (${s.supplier_region.slice(0, 3)})`,
    lead_time_years: s.lead_time_years,
    bottleneck_risk: s.bottleneck_risk,
  }))

  // Chart 5 data — average_duration_months by regulatory step coloured by complexity
  const regulatoryData = data.regulatory.map((r) => ({
    name: r.regulatory_step.length > 22 ? r.regulatory_step.slice(0, 20) + '…' : r.regulatory_step,
    average_duration_months: r.average_duration_months,
    complexity: r.complexity,
  }))

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Anchor className="text-blue-500" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Offshore Wind Project Finance Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Australian offshore wind pipeline — project finance, cost structure, supply chain &amp; regulatory
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Pipeline"
          value={`${summary['total_pipeline_gw'] as number} GW`}
          sub="Across all projects"
        />
        <KpiCard
          label="Avg LCOE"
          value={`$${summary['avg_lcoe_per_mwh'] as number}/MWh`}
          sub="Levelised cost of energy"
        />
        <KpiCard
          label="Total CapEx"
          value={`$${summary['total_capex_b'] as number}B`}
          sub="Combined capital expenditure"
        />
        <KpiCard
          label="Leading Zone"
          value={String(summary['leading_zone'])}
          sub="Most projects by zone"
        />
      </div>

      {/* Chart 1 — Capacity by project coloured by status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Capacity (MW) by Project — coloured by Status
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={capacityData} margin={{ top: 8, right: 16, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }} />
            <Tooltip formatter={(v: unknown) => [`${v} MW`, 'Capacity']} />
            <Bar dataKey="capacity_mw" name="Capacity (MW)" radius={[3, 3, 0, 0]}>
              {capacityData.map((entry, idx) => (
                <Cell key={idx} fill={STATUS_COLOURS[entry.status] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
            <span key={status} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {status}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2 — Stacked cost components by project (top 8) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Cost Components by Project ($M) — Top 8 Projects
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={costChartData} margin={{ top: 8, right: 16, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} label={{ value: '$M', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {COST_COMPONENTS.map((comp) => (
              <Bar
                key={comp}
                dataKey={comp}
                stackId="cost"
                fill={COMPONENT_COLOURS[comp] ?? '#6b7280'}
                name={comp}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3 — Scatter IRR vs LCOE sized by NPV */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          IRR (%) vs LCOE ($/MWh) — bubble size = NPV ($M)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="lcoe_per_mwh"
              name="LCOE ($/MWh)"
              tick={{ fontSize: 11 }}
              label={{ value: 'LCOE ($/MWh)', position: 'insideBottom', offset: -2, fontSize: 11 }}
            />
            <YAxis
              dataKey="irr_pct"
              name="IRR (%)"
              tick={{ fontSize: 11 }}
              label={{ value: 'IRR (%)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }}
            />
            <ZAxis dataKey="npv_m" range={[60, 600]} name="NPV ($M)" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (!payload || payload.length === 0) return null
                const d = payload[0].payload as { name: string; lcoe_per_mwh: number; irr_pct: number; npv_m: number }
                return (
                  <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-2 text-xs shadow">
                    <p className="font-semibold">{d.name}</p>
                    <p>LCOE: ${d.lcoe_per_mwh}/MWh</p>
                    <p>IRR: {d.irr_pct}%</p>
                    <p>NPV: ${d.npv_m}M</p>
                  </div>
                )
              }}
            />
            <Scatter data={scatterData} fill="#3b82f6" fillOpacity={0.75} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — Lead time by component coloured by bottleneck_risk */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Supply Chain Lead Time (years) by Component — coloured by Bottleneck Risk
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={leadTimeData} margin={{ top: 8, right: 16, left: 0, bottom: 90 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} label={{ value: 'Years', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }} />
            <Tooltip formatter={(v: unknown) => [`${v} yrs`, 'Lead Time']} />
            <Bar dataKey="lead_time_years" name="Lead Time (yrs)" radius={[3, 3, 0, 0]}>
              {leadTimeData.map((entry, idx) => (
                <Cell key={idx} fill={BOTTLENECK_COLOURS[entry.bottleneck_risk] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3">
          {Object.entries(BOTTLENECK_COLOURS).map(([risk, colour]) => (
            <span key={risk} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {risk}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 5 — Regulatory duration by step coloured by complexity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Regulatory Duration (months) by Step — coloured by Complexity
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={regulatoryData} margin={{ top: 8, right: 16, left: 0, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} label={{ value: 'Months', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }} />
            <Tooltip formatter={(v: unknown) => [`${v} months`, 'Avg Duration']} />
            <Bar dataKey="average_duration_months" name="Duration (months)" radius={[3, 3, 0, 0]}>
              {regulatoryData.map((entry, idx) => (
                <Cell key={idx} fill={COMPLEXITY_COLOURS[entry.complexity] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3">
          {Object.entries(COMPLEXITY_COLOURS).map(([comp, colour]) => (
            <span key={comp} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {comp}
            </span>
          ))}
        </div>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Pipeline Summary
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Total Pipeline</dt>
            <dd className="text-lg font-bold text-gray-900 dark:text-white">
              {summary['total_pipeline_gw'] as number} GW
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Operating Projects</dt>
            <dd className="text-lg font-bold text-gray-900 dark:text-white">
              {summary['operating_projects'] as number}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Avg LCOE</dt>
            <dd className="text-lg font-bold text-gray-900 dark:text-white">
              ${summary['avg_lcoe_per_mwh'] as number}/MWh
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Total CapEx</dt>
            <dd className="text-lg font-bold text-gray-900 dark:text-white">
              ${summary['total_capex_b'] as number}B
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Leading Zone</dt>
            <dd className="text-lg font-bold text-gray-900 dark:text-white">
              {String(summary['leading_zone'])}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
