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
import { Layers } from 'lucide-react'
import {
  getHydrogenValleyClusterDashboard,
  HVCADashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const STATUS_COLOURS: Record<string, string> = {
  'Operating':             '#10b981',
  'Under Construction':    '#3b82f6',
  'FID':                   '#8b5cf6',
  'Advanced Development':  '#f59e0b',
  'Concept':               '#94a3b8',
}

const TECH_COLOURS: Record<string, string> = {
  PEM:       '#3b82f6',
  Alkaline:  '#10b981',
  SOEC:      '#f59e0b',
  AEM:       '#ec4899',
}

const SCENARIO_COLOURS: Record<string, string> = {
  'Base':            '#ef4444',
  'Cost Reduction':  '#10b981',
  'Policy Support':  '#3b82f6',
}

const RISK_COLOURS: Record<string, string> = {
  High:   '#ef4444',
  Medium: '#f59e0b',
  Low:    '#10b981',
}

const DEMAND_CLUSTER_COLOURS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
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
        <Layers size={16} />
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

export default function HydrogenValleyClusterAnalytics() {
  const [data, setData] = useState<HVCADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getHydrogenValleyClusterDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Hydrogen Valley &amp; Industrial Cluster Analytics...
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

  // ── Chart 1: Bar — hydrogen_production_ktpa by cluster coloured by status ─
  const chart1Data = data.clusters
    .slice()
    .sort((a, b) => b.hydrogen_production_ktpa - a.hydrogen_production_ktpa)
    .map((c) => ({
      name: c.cluster_name,
      hydrogen_production_ktpa: c.hydrogen_production_ktpa,
      status: c.status,
    }))

  // ── Chart 2: Bar — capacity_mw by electrolyser coloured by technology ────
  const chart2Data = data.electrolysers
    .slice()
    .sort((a, b) => b.capacity_mw - a.capacity_mw)
    .map((e) => ({
      name: e.project_name,
      capacity_mw: e.capacity_mw,
      technology: e.technology,
    }))

  // ── Chart 3: Line — total_lcoh by year for 2 scenarios ──────────────────
  const lcohScenarios = Array.from(new Set(data.lcoh.map((r) => r.scenario)))
  const lcohYears = Array.from(new Set(data.lcoh.map((r) => r.year))).sort((a, b) => a - b)
  const lcohByYearScenario: Record<number, Record<string, number[]>> = {}
  for (const r of data.lcoh) {
    if (!lcohByYearScenario[r.year]) lcohByYearScenario[r.year] = {}
    if (!lcohByYearScenario[r.year][r.scenario]) lcohByYearScenario[r.year][r.scenario] = []
    lcohByYearScenario[r.year][r.scenario].push(r.total_lcoh)
  }
  const chart3Data = lcohYears.map((yr) => {
    const row: Record<string, number | string> = { year: yr }
    for (const sc of lcohScenarios) {
      const vals = lcohByYearScenario[yr]?.[sc] ?? []
      row[sc] = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0
    }
    return row
  })

  // ── Chart 4: Bar — demand_2030_ktpa by sector × top clusters ─────────────
  const topDemandClusters = Array.from(new Set(data.demand.map((d) => d.cluster_name))).slice(0, 5)
  const demandSectors = Array.from(new Set(data.demand.map((d) => d.sector)))
  const demandBySectorCluster: Record<string, Record<string, number>> = {}
  for (const d of data.demand) {
    if (!demandBySectorCluster[d.sector]) demandBySectorCluster[d.sector] = {}
    demandBySectorCluster[d.sector][d.cluster_name] = d.demand_2030_ktpa
  }
  const chart4Data = demandSectors.map((sector) => ({
    name: sector,
    ...demandBySectorCluster[sector],
  }))

  // ── Chart 5: Bar — localisation_pct by supply chain component coloured by bottleneck_risk ─
  const chart5Data = data.supply_chain
    .slice()
    .sort((a, b) => b.localisation_pct - a.localisation_pct)
    .map((s) => ({
      name: `${s.component} (${s.domestic_supplier.slice(0, 10)})`,
      localisation_pct: s.localisation_pct,
      bottleneck_risk: s.bottleneck_risk,
    }))

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Layers size={28} className="text-blue-500 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Hydrogen Valley &amp; Industrial Cluster Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sprint 130b — HVCA | Australian H2 Hubs, Electrolyser Capacity, LCOH Pathways &amp; Supply Chain
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total H2 Production"
          value={`${summary['total_production_ktpa']} ktpa`}
          sub="Across all clusters"
        />
        <KpiCard
          label="Total Electrolyser"
          value={`${summary['total_electrolyser_gw']} GW`}
          sub="Installed electrolyser capacity"
        />
        <KpiCard
          label="Lowest LCOH"
          value={`$${summary['lowest_lcoh_per_kg']}/kg`}
          sub="Best-case levelised cost"
        />
        <KpiCard
          label="Jobs Created"
          value={Number(summary['jobs_created']).toLocaleString()}
          sub="Direct employment across hubs"
        />
      </div>

      {/* Chart 1 — H2 production by cluster coloured by status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Hydrogen Production by Cluster (ktpa) — Coloured by Development Status
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chart1Data} margin={{ top: 10, right: 20, left: 0, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} label={{ value: 'ktpa', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }} />
            <Tooltip
              formatter={(val: number) => [`${val} ktpa`, 'H2 Production']}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload
                return item ? `${label} | ${item.status}` : label
              }}
            />
            <Bar dataKey="hydrogen_production_ktpa" name="H2 Production (ktpa)" radius={[4, 4, 0, 0]}>
              {chart1Data.map((entry, idx) => (
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

      {/* Chart 2 — Electrolyser capacity by project coloured by technology */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Electrolyser Capacity by Project (MW) — Coloured by Technology
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chart2Data} margin={{ top: 10, right: 20, left: 0, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }} />
            <Tooltip
              formatter={(val: number) => [`${val} MW`, 'Capacity']}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload
                return item ? `${label} | ${item.technology}` : label
              }}
            />
            <Bar dataKey="capacity_mw" name="Capacity (MW)" radius={[4, 4, 0, 0]}>
              {chart2Data.map((entry, idx) => (
                <Cell key={idx} fill={TECH_COLOURS[entry.technology] ?? '#6b7280'} />
              ))}
            </Bar>
            <Legend
              payload={Object.entries(TECH_COLOURS).map(([name, color]) => ({
                value: name,
                type: 'square' as const,
                color,
              }))}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3 — LCOH by year for scenarios */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Average Total LCOH ($/kg) by Year &amp; Scenario
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chart3Data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} label={{ value: '$/kg', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }} />
            <Tooltip formatter={(val: number) => [`$${val}/kg`, '']} />
            <Legend />
            {lcohScenarios.map((sc) => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                stroke={SCENARIO_COLOURS[sc] ?? '#6b7280'}
                strokeWidth={2.5}
                dot={{ r: 5 }}
                name={sc}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — Demand 2030 by sector × cluster */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          H2 Demand 2030 by Sector &amp; Cluster (ktpa)
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chart4Data} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {topDemandClusters.map((cname, idx) => (
              <Bar
                key={cname}
                dataKey={cname}
                stackId="a"
                fill={DEMAND_CLUSTER_COLOURS[idx % DEMAND_CLUSTER_COLOURS.length]}
                name={cname}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 — Localisation % by supply chain component coloured by bottleneck risk */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Local Content (%) by Supply Chain Component — Coloured by Bottleneck Risk
        </h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={chart5Data} margin={{ top: 10, right: 20, left: 0, bottom: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} label={{ value: '%', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }} />
            <Tooltip
              formatter={(val: number) => [`${val}%`, 'Local Content']}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload
                return item ? `${label} | Risk: ${item.bottleneck_risk}` : label
              }}
            />
            <Bar dataKey="localisation_pct" name="Local Content (%)" radius={[4, 4, 0, 0]}>
              {chart5Data.map((entry, idx) => (
                <Cell key={idx} fill={RISK_COLOURS[entry.bottleneck_risk] ?? '#6b7280'} />
              ))}
            </Bar>
            <Legend
              payload={Object.entries(RISK_COLOURS).map(([name, color]) => ({
                value: `${name} Risk`,
                type: 'square' as const,
                color,
              }))}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Summary Statistics
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(summary).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <dt className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 dark:text-white">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
