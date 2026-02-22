import { useEffect, useState } from 'react'
import { Atom, DollarSign, Globe, MapPin } from 'lucide-react'
import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getNuclearSmallModularReactorDashboard,
  NSMRDashboard,
  NSMRDesignRecord,
  NSMRGlobalProjectRecord,
  NSMRSiteRecord,
  NSMRCostRecord,
  NSMRRegulationRecord,
  NSMRScenarioRecord,
} from '../api/client'

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  colour,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

const REACTOR_TYPE_COLOURS: Record<string, string> = {
  'PWR':           '#3b82f6',
  'BWR':           '#10b981',
  'HTGR':          '#f59e0b',
  'MSR':           '#ef4444',
  'Fast Neutron':  '#8b5cf6',
  'ARC':           '#06b6d4',
}

const STATUS_COLOURS: Record<string, string> = {
  'Concept':       '#6b7280',
  'Licensing':     '#f59e0b',
  'Construction':  '#3b82f6',
  'Operating':     '#10b981',
}

const SCENARIO_COLOURS: Record<string, string> = {
  'Optimistic':  '#10b981',
  'Central':     '#3b82f6',
  'Pessimistic': '#ef4444',
}

const NEM_SCENARIO_COLOURS: Record<string, string> = {
  'No Nuclear':     '#6b7280',
  'Nuclear Pathway':'#8b5cf6',
}

const SEISMIC_COLOURS: Record<string, string> = {
  'Low':    '#10b981',
  'Medium': '#f59e0b',
  'High':   '#ef4444',
}

// ── Chart 1: Design Comparison — Capacity vs LCOE (ScatterChart) ──────────
function DesignCapacityLCOEChart({ data }: { data: NSMRDesignRecord[] }) {
  const scatterData = data.map(d => ({
    electrical_mw: d.electrical_mw,
    lcoe_usd_per_mwh: d.lcoe_usd_per_mwh,
    reactor_type: d.reactor_type,
    name: d.design_name,
    vendor: d.vendor,
  }))

  const reactorTypes = Array.from(new Set(data.map(d => d.reactor_type))).sort()

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          type="number"
          dataKey="electrical_mw"
          name="Electrical Output (MW)"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Electrical Output (MWe)', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="lcoe_usd_per_mwh"
          name="LCOE (USD/MWh)"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'LCOE (USD/MWh)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(value: number, name: string) => [value, name]}
          cursor={{ strokeDasharray: '3 3' }}
        />
        <Legend
          wrapperStyle={{ paddingTop: 12, fontSize: 11, color: '#9ca3af' }}
          formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
        />
        {reactorTypes.map(rt => (
          <Scatter
            key={rt}
            name={rt}
            data={scatterData.filter(d => d.reactor_type === rt)}
            fill={REACTOR_TYPE_COLOURS[rt] ?? '#6b7280'}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ── Chart 2: Global Pipeline by Status (Stacked BarChart) ─────────────────
function GlobalPipelineChart({ data }: { data: NSMRGlobalProjectRecord[] }) {
  const countries = Array.from(new Set(data.map(d => d.country))).sort()
  const statuses = ['Concept', 'Licensing', 'Construction', 'Operating']

  const chartData = countries.map(country => {
    const row: Record<string, string | number> = { country: country.length > 10 ? country.slice(0, 9) + '.' : country }
    statuses.forEach(status => {
      const recs = data.filter(d => d.country === country && d.status === status)
      row[status] = recs.reduce((acc, d) => acc + d.capacity_mw, 0)
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="country"
          tick={{ fill: '#9ca3af', fontSize: 9 }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Capacity (MW)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ paddingTop: 16, fontSize: 11, color: '#9ca3af' }} />
        {statuses.map(status => (
          <Bar key={status} dataKey={status} stackId="a" fill={STATUS_COLOURS[status] ?? '#6b7280'} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 3: Cost Trajectories (LineChart) ─────────────────────────────────
function CostTrajectoriesChart({ data }: { data: NSMRCostRecord[] }) {
  const years = Array.from(new Set(data.map(d => d.year))).sort()
  const scenarios = ['Optimistic', 'Central', 'Pessimistic']

  const chartData = years.map(yr => {
    const row: Record<string, string | number> = { year: yr }
    scenarios.forEach(s => {
      const rec = data.find(d => d.year === yr && d.scenario === s)
      if (rec) row[s] = rec.lcoe_aud_per_mwh
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'LCOE (AUD/MWh)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ paddingTop: 12, fontSize: 11, color: '#9ca3af' }} />
        {scenarios.map(s => (
          <Line
            key={s}
            type="monotone"
            dataKey={s}
            stroke={SCENARIO_COLOURS[s] ?? '#6b7280'}
            strokeWidth={2}
            strokeDasharray={s === 'Central' ? undefined : s === 'Optimistic' ? '5 5' : '2 4'}
            dot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Chart 4: Australian Site Assessment (Horizontal BarChart) ─────────────
function SiteAssessmentChart({ data }: { data: NSMRSiteRecord[] }) {
  const sorted = [...data].sort((a, b) => b.community_support_pct - a.community_support_pct)
  const chartData = sorted.map(s => ({
    name: s.site_name.length > 22 ? s.site_name.slice(0, 20) + '…' : s.site_name,
    community_support_pct: s.community_support_pct,
    seismic_risk: s.seismic_risk,
    state: s.state,
  }))

  return (
    <ResponsiveContainer width="100%" height={460}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 170, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Community Support (%)', position: 'insideBottom', offset: -4, fill: '#9ca3af', fontSize: 10 }}
        />
        <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} width={165} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(value: number) => [`${value}%`, 'Community Support']}
        />
        <Bar dataKey="community_support_pct" name="Community Support (%)">
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={SEISMIC_COLOURS[entry.seismic_risk] ?? '#6b7280'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 5: Regulatory Status Heat Table ─────────────────────────────────
const STATUS_BADGE_STYLES: Record<string, string> = {
  'Prohibiting': 'bg-red-900 text-red-300 border border-red-700',
  'Neutral':     'bg-yellow-900 text-yellow-300 border border-yellow-700',
  'Enabling':    'bg-blue-900 text-blue-300 border border-blue-700',
  'Enacted':     'bg-green-900 text-green-300 border border-green-700',
}

function RegulatoryHeatTable({ data }: { data: NSMRRegulationRecord[] }) {
  const regulationTypes = ['Safety', 'Waste', 'Siting', 'Licensing', 'Environmental']
  const jurisdictions = ['Federal', 'NSW', 'QLD', 'VIC', 'SA', 'WA']

  // Build lookup map: type × jurisdiction -> records
  const lookup: Record<string, NSMRRegulationRecord[]> = {}
  data.forEach(r => {
    const key = `${r.regulation_type}__${r.jurisdiction}`
    if (!lookup[key]) lookup[key] = []
    lookup[key].push(r)
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 pr-4 text-gray-400 font-medium">Regulation Type</th>
            {jurisdictions.map(j => (
              <th key={j} className="text-center py-2 px-2 text-gray-400 font-medium">{j}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {regulationTypes.map(rt => (
            <tr key={rt} className="border-b border-gray-700/50 hover:bg-gray-700/30">
              <td className="py-2 pr-4 text-gray-300 font-medium">{rt}</td>
              {jurisdictions.map(j => {
                const key = `${rt}__${j}`
                const recs = lookup[key] ?? []
                return (
                  <td key={j} className="py-2 px-2 text-center">
                    {recs.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {recs.map((rec, i) => (
                          <span
                            key={i}
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_STYLES[rec.current_status] ?? 'bg-gray-700 text-gray-300'}`}
                            title={rec.regulation_name}
                          >
                            {rec.current_status}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Chart 6: NEM Scenario: Capacity (AreaChart) ────────────────────────────
function NEMScenarioCapacityChart({ data }: { data: NSMRScenarioRecord[] }) {
  const years = Array.from(new Set(data.map(d => d.year))).sort()
  const scenarioNames = ['No Nuclear', 'Nuclear Pathway']

  const chartData = years.map(yr => {
    const row: Record<string, string | number> = { year: yr }
    scenarioNames.forEach(s => {
      const rec = data.find(d => d.year === yr && d.scenario === s)
      if (rec) row[s] = rec.installed_capacity_mw
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Installed Capacity (MW)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(value: number) => [`${value.toLocaleString()} MW`, '']}
        />
        <Legend wrapperStyle={{ paddingTop: 12, fontSize: 11, color: '#9ca3af' }} />
        {scenarioNames.map(s => (
          <Area
            key={s}
            type="monotone"
            dataKey={s}
            stroke={NEM_SCENARIO_COLOURS[s] ?? '#6b7280'}
            fill={NEM_SCENARIO_COLOURS[s] ?? '#6b7280'}
            fillOpacity={s === 'No Nuclear' ? 0.15 : 0.3}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function NuclearSmallModularReactorAnalytics() {
  const [data, setData] = useState<NSMRDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNuclearSmallModularReactorDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="p-8 text-red-400">
        Failed to load SMR Nuclear Analytics: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-gray-400">Loading SMR Nuclear Analytics...</div>
    )
  }

  const { summary } = data

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Atom size={26} className="text-violet-400" />
          SMR Nuclear Analytics
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Small Modular Reactor design comparison, global pipeline, Australian site suitability,
          cost benchmarks, ARPANSA regulatory pathways and NEM integration scenarios
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Designs Tracked"
          value={String(summary.total_designs_tracked as number)}
          sub="Global SMR designs"
          icon={Atom}
          colour="bg-violet-600"
        />
        <KpiCard
          label="Global Projects"
          value={String(summary.total_global_projects as number)}
          sub="In pipeline worldwide"
          icon={Globe}
          colour="bg-blue-600"
        />
        <KpiCard
          label="Avg Central LCOE"
          value={`A$${(summary.avg_lcoe_central_aud_per_mwh as number).toFixed(0)}/MWh`}
          sub="2025–2034 central scenario"
          icon={DollarSign}
          colour="bg-emerald-600"
        />
        <KpiCard
          label="Potential Aus. Sites"
          value={String(summary.potential_aus_sites as number)}
          sub={`Earliest grid: ${summary.earliest_possible_grid_date}`}
          icon={MapPin}
          colour="bg-amber-600"
        />
      </div>

      {/* Chart 1: Design Comparison */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Design Comparison: Electrical Capacity vs LCOE"
          subtitle="SMR designs globally — scatter by electrical output (MWe) vs LCOE (USD/MWh), coloured by reactor type"
        />
        <DesignCapacityLCOEChart data={data.designs} />
      </div>

      {/* Chart 2: Global Pipeline */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Global SMR Pipeline by Status and Country"
          subtitle="Stacked capacity (MW) by project status per country"
        />
        <GlobalPipelineChart data={data.global_projects} />
      </div>

      {/* Chart 3 + Chart 4 side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 shadow">
          <SectionHeader
            title="SMR Cost Trajectories 2025–2034"
            subtitle="LCOE (AUD/MWh) for Optimistic, Central and Pessimistic scenarios"
          />
          <CostTrajectoriesChart data={data.costs} />
        </div>

        <div className="bg-gray-800 rounded-xl p-6 shadow">
          <SectionHeader
            title="NEM Scenario: Nuclear Installed Capacity 2030–2055"
            subtitle="Installed capacity (MW) under No Nuclear vs Nuclear Pathway"
          />
          <NEMScenarioCapacityChart data={data.scenarios} />
        </div>
      </div>

      {/* Chart 4: Australian Site Assessment */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Australian SMR Site Assessment"
          subtitle="Sites ranked by community support (%) — colour indicates seismic risk (green=Low, amber=Medium, red=High)"
        />
        <SiteAssessmentChart data={data.sites} />
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />Low seismic</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-500 inline-block" />Medium seismic</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />High seismic</span>
        </div>
      </div>

      {/* Chart 5: Regulatory Status Heat Table */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Regulatory Status Heat Map — Australia"
          subtitle="Regulation type vs jurisdiction — current status under ARPANSA and state frameworks"
        />
        <RegulatoryHeatTable data={data.regulations} />
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-400">
          {['Prohibiting', 'Neutral', 'Enabling', 'Enacted'].map(s => (
            <span key={s} className={`inline-block px-2 py-0.5 rounded font-medium ${STATUS_BADGE_STYLES[s]}`}>{s}</span>
          ))}
        </div>
      </div>

      {/* Summary row */}
      <div className="bg-gray-800 rounded-xl p-5 shadow grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide">Most Advanced Design (TRL)</p>
          <p className="text-violet-400 font-semibold mt-0.5">{summary.most_advanced_design as string}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide">Earliest Australian Grid Date</p>
          <p className="text-amber-400 font-semibold mt-0.5">{summary.earliest_possible_grid_date as string}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide">Avg Central LCOE (AUD/MWh)</p>
          <p className="text-emerald-400 font-semibold mt-0.5">
            A${(summary.avg_lcoe_central_aud_per_mwh as number).toFixed(1)}/MWh
          </p>
        </div>
      </div>
    </div>
  )
}
