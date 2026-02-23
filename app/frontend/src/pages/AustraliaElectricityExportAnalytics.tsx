import { useEffect, useState } from 'react'
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
import { Globe } from 'lucide-react'
import {
  getAustraliaElectricityExportDashboard,
  AELXDashboard,
} from '../api/client'

// ── Colour palettes ────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  Concept: '#6b7280',
  Feasibility: '#3b82f6',
  Approved: '#22c55e',
  'Under Construction': '#f59e0b',
  Cancelled: '#ef4444',
}

const TECH_COLOURS: Record<string, string> = {
  Solar: '#fbbf24',
  Wind: '#60a5fa',
  Hybrid: '#a78bfa',
}

const IMPACT_COLOURS: Record<string, string> = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#22c55e',
}

const LINE_COLOURS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444',
  '#a78bfa', '#ec4899', '#14b8a6', '#f97316',
]

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white truncate">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Chart 1: Cable Capacity by Status ─────────────────────────────────────

function buildCableCapacityData(dashboard: AELXDashboard) {
  return dashboard.cables.map((c) => ({
    name: c.cable_name.replace('AAPowerLink', 'APL').replace('Export Extension', 'Ext').replace(' Export Hub', '').replace(' HVDC Link', '').replace(' Connector', '').replace(' Hybrid Cable', '').replace(' Green Link', '').replace(' Pacific Cable', ''),
    capacity_gw: c.capacity_gw,
    fill: STATUS_COLOURS[c.status] ?? '#6b7280',
  }))
}

// ── Chart 2: Export Energy TWh by year for each cable ─────────────────────

function buildScenarioLines(dashboard: AELXDashboard) {
  const years = [2030, 2035, 2040]
  return years.map((yr) => {
    const entry: Record<string, number | string> = { year: String(yr) }
    dashboard.cables.forEach((c) => {
      const s = dashboard.export_scenarios.find(
        (sc) => sc.cable_id === c.cable_id && sc.year === yr,
      )
      entry[c.cable_id] = s?.export_energy_twh ?? 0
    })
    return entry
  })
}

// ── Chart 3: Renewable Zone Capacity ──────────────────────────────────────

function buildZoneData(dashboard: AELXDashboard) {
  return dashboard.renewable_zones.map((z) => ({
    name: z.zone_name.replace(' Zone', '').replace(' Solar', '').replace(' Wind', '').replace(' Hybrid', ''),
    potential_capacity_gw: z.potential_capacity_gw,
    fill: TECH_COLOURS[z.technology] ?? '#6b7280',
  }))
}

// ── Chart 4: Investment Funding Split (top 3 cables) ─────────────────────

function buildInvestmentData(dashboard: AELXDashboard) {
  const top3 = [...dashboard.cables]
    .sort((a, b) => b.capex_b_aud - a.capex_b_aud)
    .slice(0, 3)

  const years = [2025, 2029, 2033, 2037, 2041, 2045]
  return years.map((yr) => {
    const entry: Record<string, number | string> = { year: String(yr) }
    top3.forEach((c) => {
      const inv = dashboard.investments.find(
        (i) => i.cable_id === c.cable_id && i.year === yr,
      )
      const shortName = c.cable_name.split(' ').slice(0, 2).join(' ')
      entry[`${shortName}_private`] = inv?.private_funding_pct ?? 0
      entry[`${shortName}_govt`] = inv?.government_funding_pct ?? 0
      entry[`${shortName}_foreign`] = inv?.foreign_funding_pct ?? 0
    })
    return entry
  })
}

// ── Chart 5: Policy Framework Count by Category & Impact ──────────────────

function buildPolicyData(dashboard: AELXDashboard) {
  const categories = ['Trade Agreement', 'Regulatory', 'Environmental', 'Financial', 'Grid Code']
  return categories.map((cat) => {
    const frameworks = dashboard.policy_frameworks.filter((p) => p.category === cat)
    return {
      category: cat.replace(' Agreement', ' Agmt').replace('Environmental', 'Environ.'),
      High: frameworks.filter((p) => p.impact === 'High').length,
      Medium: frameworks.filter((p) => p.impact === 'Medium').length,
      Low: frameworks.filter((p) => p.impact === 'Low').length,
    }
  })
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AustraliaElectricityExportAnalytics() {
  const [dashboard, setDashboard] = useState<AELXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAustraliaElectricityExportDashboard()
      .then(setDashboard)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading…
      </div>
    )
  if (error || !dashboard)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data'}
      </div>
    )

  const { summary } = dashboard
  const cableCapData = buildCableCapacityData(dashboard)
  const scenarioData = buildScenarioLines(dashboard)
  const zoneData = buildZoneData(dashboard)
  const investmentData = buildInvestmentData(dashboard)
  const policyData = buildPolicyData(dashboard)

  const top3Cables = [...dashboard.cables]
    .sort((a, b) => b.capex_b_aud - a.capex_b_aud)
    .slice(0, 3)

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Globe size={28} className="text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">Australia Electricity Export Analytics</h1>
          <p className="text-sm text-gray-400">
            Undersea cable projects, renewable supply zones, policy frameworks &amp; investment
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Total Cable Capacity"
          value={`${summary.total_cable_capacity_gw} GW`}
          sub="Across all 8 proposed cables"
        />
        <KpiCard
          label="Total CapEx"
          value={`$${summary.total_capex_b_aud}B`}
          sub="AUD combined capex"
        />
        <KpiCard
          label="Total Export TWh (2040)"
          value={`${summary.total_export_twh_2040} TWh`}
          sub="Projected 2040 export energy"
        />
        <KpiCard
          label="Leading Destination"
          value={summary.leading_destination}
          sub={`$${summary.total_revenue_b_aud_2040}B revenue by 2040`}
        />
      </div>

      {/* Chart 1: Cable Capacity by Status */}
      <div className="bg-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold mb-4">
          Cable Capacity (GW) by Project Status
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={cableCapData} margin={{ left: 10, right: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" GW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }}
            />
            <Bar dataKey="capacity_gw" name="Capacity (GW)" isAnimationActive={false}>
              {cableCapData.map((entry, idx) => (
                <rect key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(STATUS_COLOURS).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Export Scenario Lines */}
      <div className="bg-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold mb-4">
          Export Energy (TWh) by Year — Scenario Lines per Cable
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={scenarioData} margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" TWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            {dashboard.cables.map((c, idx) => (
              <Line
                key={c.cable_id}
                type="monotone"
                dataKey={c.cable_id}
                name={c.cable_name.split(' ').slice(0, 2).join(' ')}
                stroke={LINE_COLOURS[idx % LINE_COLOURS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Renewable Zone Potential Capacity */}
      <div className="bg-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold mb-4">
          Renewable Zone Potential Capacity (GW) by Technology
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={zoneData} margin={{ left: 10, right: 20, bottom: 70 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" GW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }}
            />
            <Bar dataKey="potential_capacity_gw" name="Potential (GW)" isAnimationActive={false}>
              {zoneData.map((entry, idx) => (
                <rect key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(TECH_COLOURS).map(([t, c]) => (
            <span key={t} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 4: Investment Funding Split (Stacked Bar) */}
      <div className="bg-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold mb-1">
          Investment Funding Split — Top 3 Cables by CapEx
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Stacked: private / government / foreign (% of total per milestone year)
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={investmentData} margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 10 }} />
            {top3Cables.map((c, idx) => {
              const shortName = c.cable_name.split(' ').slice(0, 2).join(' ')
              const colours = ['#22c55e', '#3b82f6', '#f59e0b']
              return [
                <Bar
                  key={`${c.cable_id}_private`}
                  dataKey={`${shortName}_private`}
                  name={`${shortName} Private`}
                  stackId={String(idx)}
                  fill={colours[idx]}
                  isAnimationActive={false}
                />,
                <Bar
                  key={`${c.cable_id}_govt`}
                  dataKey={`${shortName}_govt`}
                  name={`${shortName} Govt`}
                  stackId={String(idx)}
                  fill={colours[idx] + '99'}
                  isAnimationActive={false}
                />,
                <Bar
                  key={`${c.cable_id}_foreign`}
                  dataKey={`${shortName}_foreign`}
                  name={`${shortName} Foreign`}
                  stackId={String(idx)}
                  fill={colours[idx] + '55'}
                  isAnimationActive={false}
                />,
              ]
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Policy Framework Count by Category */}
      <div className="bg-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold mb-4">
          Policy Framework Count by Category and Impact Level
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={policyData} margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="category" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {(['High', 'Medium', 'Low'] as const).map((impact) => (
              <Bar
                key={impact}
                dataKey={impact}
                name={`${impact} Impact`}
                fill={IMPACT_COLOURS[impact]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-3">2040 Projection Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Total Jobs Created:</span>{' '}
            <span className="font-semibold text-white">
              {summary.total_jobs_2040.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-400">CO2 Offset:</span>{' '}
            <span className="font-semibold text-white">
              {summary.total_co2_offset_mt_2040} MT
            </span>
          </div>
          <div>
            <span className="text-gray-400">Leading Destination:</span>{' '}
            <span className="font-semibold text-white">{summary.leading_destination}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
