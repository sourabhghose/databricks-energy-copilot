import { useEffect, useState } from 'react'
import { GitBranch, DollarSign, Activity, Zap, Clock } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getNADADashboard } from '../api/client'
import type { NADADashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const DNSP_COLOURS: Record<string, string> = {
  Ausgrid:              '#3b82f6',
  Endeavour:            '#f59e0b',
  Essential:            '#10b981',
  Energex:              '#ef4444',
  Ergon:                '#8b5cf6',
  'SA Power Networks':  '#f97316',
  CitiPower:            '#06b6d4',
  Powercor:             '#ec4899',
  AusNet:               '#84cc16',
  TasNetworks:          '#a855f7',
}

const SOLUTION_COLOURS: Record<string, string> = {
  BATTERY:          '#3b82f6',
  SOLAR_BATTERY:    '#f59e0b',
  DR:               '#10b981',
  VPP:              '#8b5cf6',
  NETWORK_RECONFIG: '#ef4444',
}

const SOLUTION_LABELS: Record<string, string> = {
  BATTERY:          'Battery',
  SOLAR_BATTERY:    'Solar+Battery',
  DR:               'Demand Response',
  VPP:              'VPP',
  NETWORK_RECONFIG: 'Network Reconfig',
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:           'bg-green-600',
  COMPLETED:        'bg-blue-600',
  UNDER_REVIEW:     'bg-amber-600',
  REJECTED:         'bg-red-600',
  APPROVED:         'bg-green-600',
  UNDER_ASSESSMENT: 'bg-amber-600',
  DRAFT:            'bg-gray-600',
}

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
    <div className="bg-gray-800 rounded-2xl p-6 flex items-start gap-4">
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
// Chart Card wrapper
// ---------------------------------------------------------------------------
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function NetworkAugmentationDeferralAnalytics() {
  const [data, setData] = useState<NADADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNADADashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Network Augmentation Deferral Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">Error: {error ?? 'No data received'}</p>
      </div>
    )
  }

  // Derived KPIs
  const totalDeferralValue = data.deferrals.reduce((s, d) => s + d.saving_m_aud, 0)
  const activeNonNetwork = data.deferrals.filter((d) => d.status === 'ACTIVE').length
  const derParticipatingMw = data.deferrals.reduce((s, d) => s + d.der_capacity_mw, 0)
  const avgDeferralYears =
    data.deferrals.reduce((s, d) => s + d.deferral_years, 0) / data.deferrals.length

  // --- Chart 1: Deferral value by DNSP ---
  const dnspValueMap: Record<string, number> = {}
  data.deferrals.forEach((d) => {
    dnspValueMap[d.dnsp] = (dnspValueMap[d.dnsp] || 0) + d.saving_m_aud
  })
  const deferralByDnsp = Object.entries(dnspValueMap)
    .map(([dnsp, value]) => ({ dnsp, value: Math.round(value * 10) / 10 }))
    .sort((a, b) => b.value - a.value)

  // --- Chart 2: Annual investment trends ---
  const investmentTrends = data.investment_trends.map((t) => ({
    year: String(t.year),
    traditional: t.traditional_augmentation_m_aud,
    nonNetwork: t.non_network_solutions_m_aud,
  }))

  // --- Chart 3: Non-network solution types by DNSP (stacked bar) ---
  const solutionTypes = ['BATTERY', 'SOLAR_BATTERY', 'DR', 'VPP', 'NETWORK_RECONFIG']
  const allDnsps = Object.keys(DNSP_COLOURS)
  const solutionByDnsp = allDnsps.map((dnsp) => {
    const row: Record<string, string | number> = { dnsp }
    for (const st of solutionTypes) {
      const matched = data.deferrals.filter((d) => d.dnsp === dnsp && d.solution_type === st)
      row[st] = matched.reduce((s, d) => s + d.non_network_cost_m_aud, 0)
    }
    return row
  })

  // --- Chart 4: DER hosting vs actual penetration ---
  const derHostingData = data.der_hosting.map((h) => ({
    zone: `${h.dnsp.slice(0, 3)}-${h.zone_name.slice(0, 8)}`,
    hostingCapacity: h.hosting_capacity_mw,
    actualDer: h.actual_der_mw,
    utilisation: h.utilisation_pct,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GitBranch className="text-cyan-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Network Augmentation Deferral Analytics</h1>
          <p className="text-sm text-gray-400">Sprint 165b &mdash; NADA Dashboard</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Deferral Value"
          value={`$${totalDeferralValue.toFixed(1)}M`}
          sub="AUD savings from non-network solutions"
          icon={DollarSign}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Active Non-Network Solutions"
          value={String(activeNonNetwork)}
          sub="Currently operating projects"
          icon={Activity}
          color="bg-blue-600"
        />
        <KpiCard
          title="DER Participating"
          value={`${derParticipatingMw.toFixed(1)} MW`}
          sub="Distributed energy resources enrolled"
          icon={Zap}
          color="bg-amber-600"
        />
        <KpiCard
          title="Avg Deferral Period"
          value={`${avgDeferralYears.toFixed(1)} yrs`}
          sub="Average augmentation deferral duration"
          icon={Clock}
          color="bg-purple-600"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Deferral Value by DNSP (M AUD)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={deferralByDnsp} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="dnsp"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                width={110}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Annual Investment: Deferred vs Traditional Augmentation (M AUD)">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={investmentTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ color: '#d1d5db' }} />
              <Line
                type="monotone"
                dataKey="traditional"
                stroke="#ef4444"
                strokeWidth={2}
                name="Traditional Augmentation"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="nonNetwork"
                stroke="#10b981"
                strokeWidth={2}
                name="Non-Network Solutions"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Non-Network Solution Types by DNSP (M AUD)">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={solutionByDnsp}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="dnsp"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ color: '#d1d5db' }} />
              {solutionTypes.map((st) => (
                <Bar
                  key={st}
                  dataKey={st}
                  stackId="sol"
                  fill={SOLUTION_COLOURS[st]}
                  name={SOLUTION_LABELS[st]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="DER Hosting Capacity vs Actual Penetration by Zone">
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={derHostingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="zone"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ color: '#d1d5db' }} />
              <Bar dataKey="hostingCapacity" fill="#3b82f6" name="Hosting Capacity MW" />
              <Bar dataKey="actualDer" fill="#f59e0b" name="Actual DER MW" />
              <Line
                type="monotone"
                dataKey="utilisation"
                stroke="#ef4444"
                strokeWidth={2}
                name="Utilisation %"
                dot={{ r: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Active Deferral Projects Table */}
      <div className="bg-gray-800 rounded-2xl p-6 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Active Deferral Projects</h3>
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="py-2 pr-4">Project</th>
              <th className="py-2 pr-4">DNSP</th>
              <th className="py-2 pr-4">Zone</th>
              <th className="py-2 pr-4 text-right">Traditional Cost (M)</th>
              <th className="py-2 pr-4 text-right">Non-Network Cost (M)</th>
              <th className="py-2 pr-4 text-right">Saving (M)</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.deferrals.map((d, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4 text-gray-200">{d.project_name}</td>
                <td className="py-2 pr-4 text-gray-300">{d.dnsp}</td>
                <td className="py-2 pr-4 text-gray-300">{d.zone}</td>
                <td className="py-2 pr-4 text-right text-gray-300">
                  ${d.traditional_cost_m_aud.toFixed(1)}
                </td>
                <td className="py-2 pr-4 text-right text-gray-300">
                  ${d.non_network_cost_m_aud.toFixed(1)}
                </td>
                <td className="py-2 pr-4 text-right text-emerald-400">
                  ${d.saving_m_aud.toFixed(1)}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium text-white ${STATUS_BADGE[d.status] || 'bg-gray-600'}`}
                  >
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RIT-D Assessment Outcomes Table */}
      <div className="bg-gray-800 rounded-2xl p-6 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">RIT-D Assessment Outcomes</h3>
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="py-2 pr-4">Project</th>
              <th className="py-2 pr-4">Proponent</th>
              <th className="py-2 pr-4">Preferred Option</th>
              <th className="py-2 pr-4 text-right">Net Benefit (M)</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.ritd_assessments.map((r, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4 text-gray-200">{r.project_name}</td>
                <td className="py-2 pr-4 text-gray-300">{r.proponent_dnsp}</td>
                <td className="py-2 pr-4 text-gray-300">{r.preferred_option}</td>
                <td className="py-2 pr-4 text-right text-cyan-400">
                  ${r.net_benefit_m_aud.toFixed(1)}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium text-white ${STATUS_BADGE[r.status] || 'bg-gray-600'}`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
