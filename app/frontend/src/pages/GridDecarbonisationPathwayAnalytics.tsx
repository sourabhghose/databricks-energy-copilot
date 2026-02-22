import { useEffect, useState } from 'react'
import { TrendingDown, Activity, DollarSign, Zap } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getGridDecarbonisationPathwayDashboard,
  GDPADashboard,
} from '../api/client'

// ── KPI Card ──────────────────────────────────────────────────────────────────
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
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Colour maps ───────────────────────────────────────────────────────────────
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#8b5cf6',
  SA1:  '#ef4444',
  TAS1: '#10b981',
}

const TECH_COLOURS: Record<string, string> = {
  'Large Solar':   '#fbbf24',
  'Small Solar':   '#f59e0b',
  'Wind Onshore':  '#06b6d4',
  'Wind Offshore': '#0284c7',
  Hydro:           '#3b82f6',
  Biomass:         '#84cc16',
  Geothermal:      '#f97316',
}

const SCENARIO_COLOURS: Record<string, string> = {
  'Stated Policies': '#94a3b8',
  'Net Zero 2050':   '#22c55e',
  'Accelerated':     '#06b6d4',
}

const RISK_COLOURS: Record<string, string> = {
  High:   '#ef4444',
  Medium: '#f59e0b',
  Low:    '#22c55e',
}

const SECTOR_COLOURS: Record<string, string> = {
  Generation:    '#3b82f6',
  Storage:       '#a855f7',
  Transmission:  '#f59e0b',
  Distribution:  '#10b981',
  Hydrogen:      '#06b6d4',
  Other:         '#6b7280',
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GridDecarbonisationPathwayAnalytics() {
  const [data, setData] = useState<GDPADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGridDecarbonisationPathwayDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Grid Decarbonisation Pathway Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  const { emissions, renewables, pathways, stranded_assets, policies, investments, summary } = data

  // ── Chart 1: Grid Emissions Intensity — quarterly by region ──────────────────
  // Build a map of quarter → { region: intensity }
  const intensityByQuarter: Record<string, Record<string, number>> = {}
  emissions.forEach(r => {
    if (!intensityByQuarter[r.quarter]) intensityByQuarter[r.quarter] = {}
    intensityByQuarter[r.quarter][r.region] = r.grid_intensity_kgco2_per_mwh
  })
  const intensityData = Object.entries(intensityByQuarter)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarter, vals]) => ({ quarter, ...vals }))

  const intensityRegions = [...new Set(emissions.map(r => r.region))]

  // ── Chart 2: Renewable Capacity by Technology — stacked bar 2020-2024 ────────
  const renewableByYear: Record<number, Record<string, number>> = {}
  renewables.forEach(r => {
    if (!renewableByYear[r.year]) renewableByYear[r.year] = {}
    renewableByYear[r.year][r.technology] = r.installed_capacity_mw
  })
  const renewableData = Object.entries(renewableByYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, vals]) => ({ year: Number(year), ...vals }))

  const renewableTechs = [...new Set(renewables.map(r => r.technology))]

  // ── Chart 3: Decarbonisation Pathway — renewable_pct by scenario 2025-2050 ───
  const pathwayByYear: Record<number, Record<string, number>> = {}
  pathways.forEach(r => {
    if (!pathwayByYear[r.year]) pathwayByYear[r.year] = {}
    pathwayByYear[r.year][r.scenario] = r.renewable_pct
  })
  const pathwayData = Object.entries(pathwayByYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, vals]) => ({ year: Number(year), ...vals }))

  const pathwayScenarios = [...new Set(pathways.map(r => r.scenario))]

  // ── Chart 4: Stranded Asset Risk — horizontal bar, sorted by stranded_value_m ─
  const strandedData = [...stranded_assets]
    .sort((a, b) => b.stranded_value_m - a.stranded_value_m)
    .slice(0, 15)
    .map(a => ({
      name: a.asset_name.length > 20 ? a.asset_name.slice(0, 18) + '…' : a.asset_name,
      'Stranded Value ($M)': a.stranded_value_m,
      risk: a.stranded_risk,
    }))

  // ── Chart 5: Investment Gap — grouped bar by sector ───────────────────────────
  // Aggregate across years per sector
  const investBySector: Record<string, { required: number; committed: number; gap: number }> = {}
  investments.forEach(r => {
    if (!investBySector[r.sector]) investBySector[r.sector] = { required: 0, committed: 0, gap: 0 }
    investBySector[r.sector].required += r.investment_required_b
    investBySector[r.sector].committed += r.committed_b
    investBySector[r.sector].gap += r.gap_b
  })
  const investData = Object.entries(investBySector).map(([sector, vals]) => ({
    sector,
    'Required ($B)': parseFloat(vals.required.toFixed(2)),
    'Committed ($B)': parseFloat(vals.committed.toFixed(2)),
    'Gap ($B)': parseFloat(vals.gap.toFixed(2)),
  }))

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingDown size={26} className="text-green-400" />
          Grid Decarbonisation Pathway Analytics
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          NEM decarbonisation pathways — renewable penetration scenarios, emissions trajectory, policy mechanisms (CIS, CfDs, SROs), investment needs and stranded asset risks.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Current Grid Intensity"
          value={`${(summary.current_grid_intensity_kgco2_per_mwh as number).toFixed(3)} kgCO₂/MWh`}
          sub="NEM average 2024"
          icon={Activity}
          colour="bg-orange-600"
        />
        <KpiCard
          label="Current Renewable %"
          value={`${(summary.current_renewable_pct as number).toFixed(1)}%`}
          sub="Target: 82% by 2030"
          icon={TrendingDown}
          colour="bg-green-600"
        />
        <KpiCard
          label="Total Stranded Value"
          value={`$${(summary.total_stranded_value_b as number).toFixed(1)}B`}
          sub="At-risk asset book value"
          icon={Zap}
          colour="bg-red-600"
        />
        <KpiCard
          label="Total Investment Gap"
          value={`$${(summary.total_investment_gap_b as number).toFixed(1)}B`}
          sub="Uncommitted through 2030"
          icon={DollarSign}
          colour="bg-blue-600"
        />
      </div>

      {/* Chart 1: Grid Emissions Intensity */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Grid Emissions Intensity by Region (kgCO₂/MWh)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={intensityData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend />
            {intensityRegions.map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLOURS[region] ?? '#6b7280'}
                strokeWidth={2}
                dot={{ r: 3 }}
                name={region}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Renewable Penetration by Technology */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Renewable Installed Capacity by Technology (MW)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={renewableData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend />
            {renewableTechs.map(tech => (
              <Bar
                key={tech}
                dataKey={tech}
                stackId="a"
                fill={TECH_COLOURS[tech] ?? '#6b7280'}
                name={tech}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Decarbonisation Pathway */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Decarbonisation Pathway — Renewable % by Scenario (2025–2050)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={pathwayData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[30, 105]} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend />
            {pathwayScenarios.map(s => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={SCENARIO_COLOURS[s] ?? '#6b7280'}
                strokeWidth={2.5}
                strokeDasharray={s === 'Stated Policies' ? '6 3' : undefined}
                dot={{ r: 4 }}
                name={s}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Stranded Asset Risk — horizontal bar */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Stranded Asset Risk by Plant ($M)</h2>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart
            layout="vertical"
            data={strandedData}
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" stroke="#9ca3af" tick={{ fontSize: 11 }} width={110} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Bar dataKey="Stranded Value ($M)" name="Stranded Value ($M)">
              {strandedData.map((entry, idx) => (
                <Cell key={idx} fill={RISK_COLOURS[entry.risk] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-6 mt-3 text-xs text-gray-400">
          {Object.entries(RISK_COLOURS).map(([risk, colour]) => (
            <span key={risk} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
              {risk} Risk
            </span>
          ))}
        </div>
      </div>

      {/* Chart 5: Investment Gap — grouped bar */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Investment Gap by Sector 2024–2030 ($B)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={investData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="sector" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend />
            <Bar dataKey="Required ($B)" fill="#3b82f6" />
            <Bar dataKey="Committed ($B)" fill="#22c55e" />
            <Bar dataKey="Gap ($B)" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 6: Policy Overview — table */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Policy Mechanism Overview ({policies.length} mechanisms)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4 font-medium">Policy</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Target</th>
                <th className="pb-2 pr-4 font-medium">Budget ($B)</th>
                <th className="pb-2 pr-4 font-medium">Capacity (MW)</th>
                <th className="pb-2 pr-4 font-medium">Emissions Red. (MtCO₂)</th>
                <th className="pb-2 pr-4 font-medium">Impl. Year</th>
                <th className="pb-2 pr-4 font-medium">Expiry</th>
                <th className="pb-2 font-medium">Region</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p, idx) => (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 text-white font-medium">{p.policy_name}</td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-900 text-blue-300">
                      {p.policy_type}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-300 max-w-xs truncate" title={p.target}>{p.target}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.budget_b > 0 ? `$${p.budget_b.toFixed(1)}B` : '—'}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.expected_capacity_mw > 0 ? p.expected_capacity_mw.toLocaleString() : '—'}</td>
                  <td className="py-2 pr-4 text-green-400">{p.expected_emissions_reduction_mtco2.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.implementation_year}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.expiry_year}</td>
                  <td className="py-2 text-gray-300">{p.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
