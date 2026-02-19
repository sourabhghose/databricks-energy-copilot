import { useEffect, useState } from 'react'
import { Leaf } from 'lucide-react'
import {
  api,
  DecarbonizationDashboard,
  SectoralEmissionsRecord,
  NetZeroMilestoneRecord,
  TechnologyDeploymentRecord,
} from '../api/client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
  Cell,
} from 'recharts'

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  sub,
  valueColor,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold" style={{ color: valueColor ?? '#fff' }}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Status badge styles ───────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  ACHIEVED:    { bg: '#15803d33', text: '#4ade80' },
  ON_TRACK:    { bg: '#1d4ed833', text: '#60a5fa' },
  AT_RISK:     { bg: '#a16207 33', text: '#facc15' },
  BEHIND:      { bg: '#c2410c33', text: '#fb923c' },
  NOT_STARTED: { bg: '#37415133', text: '#9ca3af' },
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { bg: '#37415133', text: '#9ca3af' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
      style={{ background: style.bg, color: style.text }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── Tech label map ────────────────────────────────────────────────────────────

const TECH_COLORS: Record<string, string> = {
  SOLAR:          '#facc15',
  WIND_ONSHORE:   '#60a5fa',
  WIND_OFFSHORE:  '#34d399',
  BESS:           '#a78bfa',
  GREEN_HYDROGEN: '#6ee7b7',
  EV:             '#fb923c',
  HEAT_PUMP:      '#f472b6',
  CCS:            '#94a3b8',
  DIRECT_AIR_CAPTURE: '#e879f9',
}

const TECH_LABELS: Record<string, string> = {
  SOLAR:          'SOLAR',
  WIND_ONSHORE:   'WIND',
  BESS:           'BESS',
  EV:             'EV',
  GREEN_HYDROGEN: 'GREEN H2',
}

// ── Sectoral Emissions Bar Chart ──────────────────────────────────────────────

function SectoralEmissionsChart({ records }: { records: SectoralEmissionsRecord[] }) {
  const data2024 = records.filter((r) => r.year === 2024)
  const chartData = data2024.map((r) => ({
    sector: r.sector.replace(/_/g, ' '),
    actual: r.emissions_mt_co2e,
    target: r.target_mt_co2e,
    on_track: r.reduction_on_track,
  }))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-200 mb-4">
        Sectoral Emissions 2024 vs 2030 Target (Mt CO2-e)
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} barCategoryGap="25%" barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="sector"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={55}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#9ca3af' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="actual" name="Actual 2024" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, idx) => (
              <Cell
                key={`cell-${idx}`}
                fill={entry.on_track ? '#4ade80' : '#f87171'}
              />
            ))}
          </Bar>
          <Bar dataKey="target" name="2030 Target" fill="transparent" stroke="#6b7280" strokeWidth={2} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-2">
        Green = on track to 2030 target, Red = not on track
      </p>
    </div>
  )
}

// ── Technology Deployment Line Chart ──────────────────────────────────────────

const TECH_FILTER_KEYS = ['SOLAR', 'WIND_ONSHORE', 'BESS', 'EV', 'GREEN_HYDROGEN']

function TechDeploymentChart({ records }: { records: TechnologyDeploymentRecord[] }) {
  const [selectedTech, setSelectedTech] = useState<string>('SOLAR')

  const filtered = records.filter((r) => r.technology === selectedTech)
  const chartData = filtered.map((r) => ({
    year: r.year,
    capacity: r.deployed_capacity_gw,
    unit: r.unit,
  }))

  const color = TECH_COLORS[selectedTech] ?? '#60a5fa'
  const unitLabel = filtered[0]?.unit ?? 'GW'

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold text-gray-200 mr-2">
          Technology Deployment Trend (2020–2024)
        </h2>
        {TECH_FILTER_KEYS.map((tech) => (
          <button
            key={tech}
            onClick={() => setSelectedTech(tech)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              selectedTech === tech
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {TECH_LABELS[tech] ?? tech}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit={` ${unitLabel}`} width={70} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#9ca3af' }}
            formatter={(val: number) => [`${val} ${unitLabel}`, 'Deployed Capacity']}
          />
          <Line
            type="monotone"
            dataKey="capacity"
            name={`${TECH_LABELS[selectedTech] ?? selectedTech} (${unitLabel})`}
            stroke={color}
            strokeWidth={2.5}
            dot={{ fill: color, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Milestones Table ──────────────────────────────────────────────────────────

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + '…' : str
}

function MilestonesTable({ milestones }: { milestones: NetZeroMilestoneRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-200 mb-4">
        Net Zero Milestones Tracker
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300 border-collapse">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="pb-2 pr-3 font-medium">Milestone</th>
              <th className="pb-2 pr-3 font-medium">Sector</th>
              <th className="pb-2 pr-3 font-medium">Target</th>
              <th className="pb-2 pr-3 font-medium">Status</th>
              <th className="pb-2 pr-3 font-medium w-32">Progress</th>
              <th className="pb-2 pr-3 font-medium">Committed</th>
              <th className="pb-2 pr-3 font-medium">Required</th>
              <th className="pb-2 pr-3 font-medium">Gap (B AUD)</th>
              <th className="pb-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((m) => (
              <tr
                key={m.milestone_id}
                className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-2 pr-3 font-medium text-gray-200 max-w-[180px]">
                  {truncate(m.milestone_name, 40)}
                </td>
                <td className="py-2 pr-3">
                  <span className="bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">
                    {m.sector}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-400">{m.target_year}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={m.status} />
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-2 min-w-[60px]">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, m.progress_pct)}%`,
                          background:
                            m.status === 'ACHIEVED' || m.status === 'ON_TRACK'
                              ? '#4ade80'
                              : m.status === 'AT_RISK'
                              ? '#facc15'
                              : m.status === 'BEHIND'
                              ? '#fb923c'
                              : '#6b7280',
                        }}
                      />
                    </div>
                    <span className="text-gray-400 whitespace-nowrap">{m.progress_pct}%</span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-right">
                  {m.investment_committed_b_aud > 0
                    ? `$${m.investment_committed_b_aud.toFixed(1)}B`
                    : '—'}
                </td>
                <td className="py-2 pr-3 text-right">
                  {m.investment_required_b_aud > 0
                    ? `$${m.investment_required_b_aud.toFixed(1)}B`
                    : '—'}
                </td>
                <td className="py-2 pr-3 text-right">
                  {m.funding_gap_b_aud > 0 ? (
                    <span className="text-red-400 font-semibold">
                      ${m.funding_gap_b_aud.toFixed(1)}B
                    </span>
                  ) : (
                    <span className="text-green-400">Funded</span>
                  )}
                </td>
                <td className="py-2 text-gray-400 max-w-[220px]">
                  {truncate(m.description, 80)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DecarbonizationPathway() {
  const [dash, setDash] = useState<DecarbonizationDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getDecarbonizationDashboard()
      .then(setDash)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-full text-gray-400 bg-gray-900">
        Loading decarbonization data…
      </div>
    )
  if (error || !dash)
    return (
      <div className="flex items-center justify-center h-full text-red-400 bg-gray-900">
        {error ?? 'No data available'}
      </div>
    )

  return (
    <div className="bg-gray-900 min-h-full text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Leaf className="text-green-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-gray-100">
            Energy Transition &amp; Decarbonization Pathway Analytics
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Sectoral decarbonization · Technology milestones · Net zero by 2050 pathway tracking ·
            Carbon budget analysis
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total 2024 Emissions"
          value={dash.total_emissions_2024_mt_co2e.toFixed(1)}
          unit="Mt CO2-e"
          sub="All sectors combined"
          valueColor="#f87171"
        />
        <KpiCard
          label="Reduction vs 2005"
          value={`${dash.emissions_vs_2005_pct.toFixed(1)}%`}
          sub="vs ~586 Mt baseline"
          valueColor="#4ade80"
        />
        <KpiCard
          label="Electricity Decarbonization"
          value={`${dash.electricity_decarbonization_pct.toFixed(1)}%`}
          sub="vs ~200 Mt peak"
          valueColor="#60a5fa"
        />
        <KpiCard
          label="On-Track Milestones"
          value={`${dash.on_track_milestones}/${dash.total_milestones}`}
          sub={`Funding gap $${dash.investment_gap_b_aud.toFixed(0)}B AUD`}
          valueColor={
            dash.on_track_milestones >= dash.total_milestones * 0.6 ? '#4ade80' : '#facc15'
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectoralEmissionsChart records={dash.sectoral_emissions} />
        <TechDeploymentChart records={dash.technology_deployment} />
      </div>

      {/* Milestones table */}
      <MilestonesTable milestones={dash.milestones} />
    </div>
  )
}
