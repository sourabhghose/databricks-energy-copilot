import { useEffect, useState } from 'react'
import { Upload, Zap, TrendingUp, DollarSign, Activity } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getRenewableExportDashboard } from '../api/client'
import type { RENXDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart section wrapper
// ---------------------------------------------------------------------------

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">{title}</h2>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const TECH_COLORS: Record<string, string> = {
  Solar: '#f59e0b',
  Wind: '#3b82f6',
  Hydro: '#06b6d4',
  Biomass: '#22c55e',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#a78bfa',
  QLD1: '#f87171',
  VIC1: '#34d399',
  SA1:  '#fb923c',
  TAS1: '#60a5fa',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RenewableExportAnalytics() {
  const [data, setData] = useState<RENXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRenewableExportDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        Loading Renewable Export Analytics…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        {error ?? 'Unknown error'}
      </div>
    )
  }

  const { generation, constraints, investments, pricing, summary } = data

  // ── Chart 1: Monthly generation trend by technology (2024, all regions) ───
  const gen2024 = generation.filter((g) => g.year === 2024)
  const monthlyByTech: Record<number, Record<string, number>> = {}
  for (const rec of gen2024) {
    if (!monthlyByTech[rec.month]) monthlyByTech[rec.month] = {}
    monthlyByTech[rec.month][rec.technology] =
      (monthlyByTech[rec.month][rec.technology] ?? 0) + rec.generation_mwh
  }
  const genTrendData = Object.entries(monthlyByTech)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([month, techs]) => ({ month: `M${month}`, ...techs }))

  // ── Chart 2: Constrained MWh by constraint name (2024) ───────────────────
  const constraint2024 = constraints.filter((c) => c.year === 2024)
  const constraintData = constraint2024.map((c) => ({
    name: c.constraint_name.replace(' Constraint', '').replace(' Limit', ''),
    constrained_mwh: c.constrained_mwh,
  }))

  // ── Chart 3: Export capacity MW by project (sorted desc) ─────────────────
  const exportCapData = [...investments]
    .sort((a, b) => b.export_capacity_mw - a.export_capacity_mw)
    .map((inv) => ({
      name: inv.project_name.split(' ').slice(0, 2).join(' '),
      export_capacity_mw: inv.export_capacity_mw,
    }))

  // ── Chart 4: Quarterly export price by region (2024, stacked) ────────────
  const pricing2024 = pricing.filter((p) => p.year === 2024)
  const quarterlyPriceMap: Record<string, Record<string, number>> = {}
  for (const rec of pricing2024) {
    if (!quarterlyPriceMap[rec.quarter]) quarterlyPriceMap[rec.quarter] = {}
    quarterlyPriceMap[rec.quarter][rec.region] = rec.export_price_mwh
  }
  const quarterlyPriceData = ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({
    quarter: q,
    ...(quarterlyPriceMap[q] ?? {}),
  }))

  // ── Chart 5: Average curtailment % by region and technology ──────────────
  const curtailMap: Record<string, Record<string, { total: number; count: number }>> = {}
  for (const rec of generation) {
    if (rec.generation_mwh <= 0) continue
    if (!curtailMap[rec.region]) curtailMap[rec.region] = {}
    if (!curtailMap[rec.region][rec.technology])
      curtailMap[rec.region][rec.technology] = { total: 0, count: 0 }
    curtailMap[rec.region][rec.technology].total +=
      (rec.curtailed_mwh / rec.generation_mwh) * 100
    curtailMap[rec.region][rec.technology].count += 1
  }
  const curtailData = Object.entries(curtailMap).map(([region, techs]) => {
    const row: Record<string, number | string> = { region }
    for (const [tech, { total, count }] of Object.entries(techs)) {
      row[tech] = Math.round((total / count) * 10) / 10
    }
    return row
  })

  return (
    <div className="min-h-full bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Upload size={28} className="text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Renewable Energy Network Export Analytics</h1>
          <p className="text-xs text-gray-400">RENX — Sprint 153c | NEM export capacity, constraints &amp; pricing</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="2024 Total Generation"
          value={`${summary.total_generation_2024_twh.toFixed(3)} TWh`}
          sub="All regions & technologies"
          icon={Zap}
          color="bg-amber-500"
        />
        <KpiCard
          title="2024 Total Export"
          value={`${summary.total_export_2024_twh.toFixed(3)} TWh`}
          sub="Dispatched to network"
          icon={Upload}
          color="bg-blue-500"
        />
        <KpiCard
          title="Avg Curtailment"
          value={`${summary.avg_curtailment_pct.toFixed(1)}%`}
          sub="Across all years & technologies"
          icon={Activity}
          color="bg-red-500"
        />
        <KpiCard
          title="Network Investment"
          value={`$${summary.total_network_investment_m_aud.toFixed(0)}M`}
          sub="Total upgrade cost AUD"
          icon={DollarSign}
          color="bg-green-600"
        />
      </div>

      {/* Row 1: Gen trend + Constraint MWh */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 1 — Line: monthly generation by technology 2024 */}
        <ChartSection title="Monthly Generation by Technology (2024 — All Regions)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={genTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`${v.toFixed(0)} MWh`, '']}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {['Solar', 'Wind', 'Hydro', 'Biomass'].map((tech) => (
                <Line
                  key={tech}
                  type="monotone"
                  dataKey={tech}
                  stroke={TECH_COLORS[tech]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* Chart 2 — Bar: constrained MWh by constraint name 2024 */}
        <ChartSection title="Constrained MWh by Constraint Name (2024)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={constraintData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`${v.toFixed(0)} MWh`, 'Constrained']}
              />
              <Bar dataKey="constrained_mwh" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* Row 2: Project export capacity + Quarterly pricing */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 3 — Bar: project export_capacity_mw sorted desc */}
        <ChartSection title="Project Export Capacity MW (Sorted Descending)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={exportCapData} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`${v.toFixed(0)} MW`, 'Export Capacity']}
              />
              <Bar dataKey="export_capacity_mw" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* Chart 4 — Stacked bar: quarterly export price by region 2024 */}
        <ChartSection title="Quarterly Export Price $/MWh by Region (2024)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={quarterlyPriceData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`$${v.toFixed(2)}/MWh`, '']}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].map((region) => (
                <Bar key={region} dataKey={region} stackId="a" fill={REGION_COLORS[region]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* Row 3: Curtailment by region and technology */}
      <ChartSection title="Average Curtailment % by Region and Technology (All Years)">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={curtailData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {['Solar', 'Wind', 'Hydro', 'Biomass'].map((tech) => (
              <Bar key={tech} dataKey={tech} fill={TECH_COLORS[tech]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Investment table */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Network Investment Pipeline ({investments.length} Projects)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-500 uppercase tracking-wide">
                <th className="pb-2 text-left">Project</th>
                <th className="pb-2 text-left">Tech</th>
                <th className="pb-2 text-left">State</th>
                <th className="pb-2 text-right">Capacity MW</th>
                <th className="pb-2 text-right">Export MW</th>
                <th className="pb-2 text-right">Net Upgrade $M</th>
                <th className="pb-2 text-right">CF %</th>
                <th className="pb-2 text-right">Commission</th>
              </tr>
            </thead>
            <tbody>
              {investments.map((inv) => (
                <tr key={inv.project_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white">{inv.project_name}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="px-2 py-0.5 rounded text-white text-xs"
                      style={{ backgroundColor: TECH_COLORS[inv.technology] ?? '#6b7280' }}
                    >
                      {inv.technology}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{inv.state}</td>
                  <td className="py-2 pr-4 text-right">{inv.capacity_mw.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right">{inv.export_capacity_mw.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right">${inv.network_upgrade_cost_m_aud.toFixed(1)}M</td>
                  <td className="py-2 pr-4 text-right">{inv.capacity_factor_pct.toFixed(1)}%</td>
                  <td className="py-2 text-right">{inv.commissioning_year}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
