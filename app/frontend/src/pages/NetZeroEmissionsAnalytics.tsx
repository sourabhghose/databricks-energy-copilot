import { useEffect, useState } from 'react'
import { Wind, Leaf, DollarSign, TrendingDown, Activity } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getNetZeroEmissionsDashboard } from '../api/client'
import type { NZEMDashboard } from '../api/client'

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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sector colour palette
// ---------------------------------------------------------------------------

const SECTOR_COLORS: Record<string, string> = {
  Electricity: '#22d3ee',
  Transport: '#f59e0b',
  Industry: '#ef4444',
  Buildings: '#a78bfa',
  Agriculture: '#34d399',
  'Land Use': '#fb923c',
}

const TECH_COLORS: Record<string, string> = {
  'Solar PV': '#fbbf24',
  Wind: '#60a5fa',
  'Battery Storage': '#34d399',
}

const STATUS_COLORS: Record<string, string> = {
  Active: '#22c55e',
  Proposed: '#f59e0b',
  Announced: '#6366f1',
}

const JURISDICTION_COLORS: Record<string, string> = {
  Australia: '#22d3ee',
  NSW: '#f59e0b',
  VIC: '#34d399',
  QLD: '#ef4444',
  SA: '#a78bfa',
  WA: '#fb923c',
  TAS: '#60a5fa',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function NetZeroEmissionsAnalytics() {
  const [data, setData] = useState<NZEMDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNetZeroEmissionsDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400 text-sm">
        Loading Net Zero Emissions data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400 text-sm">
        Error loading data: {error}
      </div>
    )
  }

  const { sectors, technologies, policies, progress, summary } = data

  // ── Chart 1: Sector emissions trend 2020-2030 ──────────────────────────
  const sectorYears = [2020, 2021, 2022, 2023, 2024, 2025, 2030]
  const sectorTrend = sectorYears.map((yr) => {
    const point: Record<string, number | string> = { year: yr }
    const sectorNames = ['Electricity', 'Transport', 'Industry', 'Buildings', 'Agriculture', 'Land Use']
    for (const s of sectorNames) {
      const rec = sectors.find((r) => r.sector === s && r.year === yr)
      if (rec) point[s] = rec.emissions_mt_co2e
    }
    return point
  })

  // ── Chart 2: Technology CO₂ abatement (2024) sorted desc ───────────────
  const techAbatement2024 = technologies
    .filter((t) => t.year === 2024)
    .sort((a, b) => b.co2_abatement_mt - a.co2_abatement_mt)

  // ── Chart 3: Technology deployment trend (Solar PV, Wind, Battery Storage) ─
  const techNames = ['Solar PV', 'Wind', 'Battery Storage']
  const techDeployTrend = [2020, 2021, 2022, 2023, 2024, 2025, 2030].map((yr) => {
    const point: Record<string, number | string> = { year: yr }
    for (const tech of techNames) {
      const rec = technologies.find((t) => t.technology === tech && t.year === yr)
      if (rec) point[tech] = rec.deployment_gw
    }
    return point
  })

  // ── Chart 4: Policy abatement coloured by status ───────────────────────
  const policyAbatement = policies.map((p) => ({
    name: p.policy_name.length > 28 ? p.policy_name.slice(0, 28) + '…' : p.policy_name,
    abatement: p.expected_abatement_mt,
    status: p.status,
    fill: STATUS_COLORS[p.status] ?? '#9ca3af',
  }))

  // ── Chart 5: Jurisdiction renewable share 2020-2024 ───────────────────
  const jurs = ['Australia', 'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS']
  const renewTrend = [2020, 2021, 2022, 2023, 2024].map((yr) => {
    const point: Record<string, number | string> = { year: yr }
    for (const j of jurs) {
      const rec = progress.find((p) => p.jurisdiction === j && p.year === yr)
      if (rec) point[j] = rec.renewable_share_pct
    }
    return point
  })

  return (
    <div className="min-h-full bg-gray-900 p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Wind size={26} className="text-cyan-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Net Zero Emissions Market Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Sector pathways, technology deployment, policy abatement &amp; jurisdictional progress
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Emissions 2024"
          value={`${summary.total_emissions_2024_mt.toFixed(1)} Mt`}
          sub="CO₂-equivalent"
          icon={Activity}
          color="bg-red-600"
        />
        <KpiCard
          title="Reduction vs 2005"
          value={`${summary.reduction_vs_2005_pct.toFixed(1)}%`}
          sub="Emissions reduction"
          icon={TrendingDown}
          color="bg-green-600"
        />
        <KpiCard
          title="Renewable Electricity"
          value={`${summary.renewable_electricity_pct.toFixed(1)}%`}
          sub="Share of generation"
          icon={Leaf}
          color="bg-cyan-600"
        />
        <KpiCard
          title="Investment Required"
          value={`A$${summary.investment_required_b_aud.toFixed(1)}B`}
          sub="2024 technologies"
          icon={DollarSign}
          color="bg-amber-600"
        />
      </div>

      {/* Chart row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1: Sector emissions trend */}
        <ChartCard title="Sector Emissions Trend (Mt CO₂e) — 2020 to 2030">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={sectorTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {Object.entries(SECTOR_COLORS).map(([sector, color]) => (
                <Line
                  key={sector}
                  type="monotone"
                  dataKey={sector}
                  stroke={color}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Technology CO₂ abatement 2024 */}
        <ChartCard title="Technology CO₂ Abatement — 2024 (Mt CO₂e, sorted)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={techAbatement2024} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                dataKey="technology"
                type="category"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                width={110}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="co2_abatement_mt" fill="#22d3ee" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Chart row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 3: Technology deployment trend */}
        <ChartCard title="Technology Deployment (GW) — Solar PV, Wind & Battery Storage">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={techDeployTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {techNames.map((tech) => (
                <Line
                  key={tech}
                  type="monotone"
                  dataKey={tech}
                  stroke={TECH_COLORS[tech]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Policy expected abatement coloured by status */}
        <ChartCard title="Policy Expected Abatement (Mt CO₂e) by Status">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={policyAbatement} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                width={180}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="abatement" radius={[0, 4, 4, 0]}>
                {policyAbatement.map((entry, idx) => (
                  <rect key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex gap-4 mt-2 flex-wrap">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-400">{status}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Chart row 3 */}
      <div className="grid grid-cols-1 gap-6">
        {/* Chart 5: Jurisdiction renewable share */}
        <ChartCard title="Jurisdiction Renewable Share (%) — 2020 to 2024">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={renewTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {jurs.map((j) => (
                <Line
                  key={j}
                  type="monotone"
                  dataKey={j}
                  stroke={JURISDICTION_COLORS[j]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
