import { useEffect, useState } from 'react'
import { Heart, AlertTriangle, Users, DollarSign } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts'
import {
  getConsumerHardshipDashboard,
  ECHDashboard,
  ECHStressRecord,
  ECHRetailerRecord,
  ECHConcessionRecord,
  ECHDisconnectionRecord,
} from '../api/client'

// ── Colour maps ───────────────────────────────────────────────────────────────

const STATE_COLORS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#8b5cf6',
  QLD: '#f59e0b',
  SA: '#10b981',
  TAS: '#ef4444',
}

const FUNDING_BADGE: Record<string, string> = {
  STATE: 'bg-blue-700 text-blue-100',
  FEDERAL: 'bg-purple-700 text-purple-100',
  RETAILER: 'bg-green-700 text-green-100',
}

const ADEQUACY_BADGE: Record<string, string> = {
  ADEQUATE: 'bg-green-700 text-green-100',
  INSUFFICIENT: 'bg-yellow-600 text-yellow-100',
  CRITICAL: 'bg-red-700 text-red-100',
}

const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'TAS']

// ── Helper components ─────────────────────────────────────────────────────────

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  iconClass?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-start gap-3">
      <div className={`mt-0.5 ${iconClass ?? 'text-rose-400'}`}>{icon}</div>
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
        <p className="text-white text-2xl font-bold leading-tight">{value}</p>
        {sub && <p className="text-gray-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function HardshipsScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const color =
    score >= 8 ? '#22c55e' : score >= 6 ? '#eab308' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-300 w-8 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

function UptakeBar({ pct }: { pct: number }) {
  const color = pct >= 85 ? '#22c55e' : pct >= 65 ? '#eab308' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-300 w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  )
}

// ── Stress Trend Chart ────────────────────────────────────────────────────────

function StressTrendChart({ records }: { records: ECHStressRecord[] }) {
  const [selectedState, setSelectedState] = useState('NSW')

  const filtered = records.filter((r) => r.state === selectedState)

  const chartData = filtered.map((r) => ({
    label: `${r.year} ${r.quarter}`,
    stress_pct: r.households_in_stress_pct,
    disconnections: r.disconnections_quarterly,
  }))

  const stressColor = (val: number) =>
    val > 20 ? '#ef4444' : val >= 15 ? '#f97316' : '#eab308'

  const currentStress = filtered.length > 0 ? filtered[filtered.length - 1].households_in_stress_pct : 0

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-lg">Energy Stress Trend by State</h2>
        <div className="flex gap-1">
          {STATES.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedState(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedState === s
                  ? 'bg-rose-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 mb-3">
        <span className="text-xs flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" /> &gt;20% Critical
        </span>
        <span className="text-xs flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-orange-500" /> 15-20% High
        </span>
        <span className="text-xs flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" /> &lt;15% Moderate
        </span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 60, bottom: 60, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            interval={3}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
            label={{ value: 'Stress %', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'}
            label={{ value: 'Disconnections', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(value: number, name: string) => {
              if (name === 'stress_pct') return [`${value.toFixed(1)}%`, 'Households in Stress']
              return [value.toLocaleString(), 'Quarterly Disconnections']
            }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
          <Bar
            yAxisId="right"
            dataKey="disconnections"
            name="Quarterly Disconnections"
            fill="#374151"
            opacity={0.7}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="stress_pct"
            name="Households in Stress %"
            stroke={stressColor(currentStress)}
            strokeWidth={2.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Retailer Hardship Policy Table ────────────────────────────────────────────

function RetailerPolicyTable({ retailers }: { retailers: ECHRetailerRecord[] }) {
  const sorted = [...retailers].sort((a, b) => b.hardship_policy_score - a.hardship_policy_score)

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-white font-semibold text-lg mb-4">
        Retailer Hardship Policy Comparison (AER Assessment)
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
              <th className="text-left pb-2 pr-4">Retailer</th>
              <th className="text-left pb-2 pr-4 min-w-[160px]">Policy Score (/10)</th>
              <th className="text-right pb-2 pr-4">Early Intervention %</th>
              <th className="text-right pb-2 pr-4">Payment Plan Success %</th>
              <th className="text-right pb-2 pr-4">Disc. Rate /1000</th>
              <th className="text-right pb-2 pr-4">Avg Days to Disc.</th>
              <th className="text-center pb-2">AEMC Compliant</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2.5 pr-4 text-gray-200 font-medium whitespace-nowrap">
                  {r.retailer_name}
                </td>
                <td className="py-2.5 pr-4 min-w-[160px]">
                  <HardshipsScoreBar score={r.hardship_policy_score} />
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-300">
                  {r.early_intervention_pct.toFixed(0)}%
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-300">
                  {r.payment_plan_success_pct.toFixed(0)}%
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <span
                    className={
                      r.disconnection_rate_per_1000 >= 12
                        ? 'text-red-400 font-semibold'
                        : r.disconnection_rate_per_1000 >= 9
                        ? 'text-orange-400'
                        : 'text-green-400'
                    }
                  >
                    {r.disconnection_rate_per_1000.toFixed(1)}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-300">
                  {r.avg_days_to_disconnection}
                </td>
                <td className="py-2.5 text-center">
                  {r.aemc_compliant ? (
                    <span className="text-green-400 font-bold text-base">&#10003;</span>
                  ) : (
                    <span className="text-red-400 font-bold text-base">&#10007;</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Concession Coverage Table ─────────────────────────────────────────────────

function ConcessionCoverageTable({ concessions }: { concessions: ECHConcessionRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-white font-semibold text-lg mb-4">
        Concession Program Coverage by State
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
              <th className="text-left pb-2 pr-3">State</th>
              <th className="text-left pb-2 pr-4">Concession Program</th>
              <th className="text-right pb-2 pr-4">Eligible HH</th>
              <th className="text-right pb-2 pr-4">Enrolled HH</th>
              <th className="text-left pb-2 pr-4 min-w-[140px]">Uptake</th>
              <th className="text-right pb-2 pr-4">Annual Value ($/HH)</th>
              <th className="text-right pb-2 pr-4">Total Cost ($M)</th>
              <th className="text-center pb-2 pr-4">Funding</th>
              <th className="text-center pb-2">Adequacy</th>
            </tr>
          </thead>
          <tbody>
            {concessions.map((c, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2.5 pr-3">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold text-white"
                    style={{ backgroundColor: STATE_COLORS[c.state] ?? '#6b7280' }}
                  >
                    {c.state}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-gray-300 text-xs max-w-[200px]">
                  {c.concession_name}
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-300">
                  {c.eligible_households.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-300">
                  {c.enrolled_households.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 min-w-[140px]">
                  <UptakeBar pct={c.uptake_pct} />
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-300">
                  ${c.annual_value_per_household.toFixed(0)}
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-300">
                  ${c.total_cost_m.toFixed(0)}M
                </td>
                <td className="py-2.5 pr-4 text-center">
                  <Badge
                    label={c.funding_source}
                    cls={FUNDING_BADGE[c.funding_source] ?? 'bg-gray-600 text-gray-100'}
                  />
                </td>
                <td className="py-2.5 text-center">
                  <Badge
                    label={c.adequacy_rating}
                    cls={ADEQUACY_BADGE[c.adequacy_rating] ?? 'bg-gray-600 text-gray-100'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Disconnection Trend Chart ─────────────────────────────────────────────────

function DisconnectionTrendChart({ disconnections }: { disconnections: ECHDisconnectionRecord[] }) {
  const [selectedState, setSelectedState] = useState('NSW')

  const filtered = disconnections
    .filter((r) => r.state === selectedState)
    .sort((a, b) => a.year - b.year || a.quarter.localeCompare(b.quarter))

  const chartData = filtered.map((r) => ({
    label: `${r.year} ${r.quarter}`,
    residential: r.residential_disconnections,
    small_business: r.small_business_disconnections,
    avg_debt: r.avg_debt_at_disconnection,
  }))

  const stateColor = STATE_COLORS[selectedState] ?? '#3b82f6'

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-lg">Disconnection Trend by State</h2>
        <div className="flex gap-1">
          {STATES.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedState(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedState === s
                  ? 'text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              style={selectedState === s ? { backgroundColor: STATE_COLORS[s] ?? '#6b7280' } : {}}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 70, bottom: 60, left: 0 }}>
          <defs>
            <linearGradient id="discGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={stateColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={stateColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            interval={1}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(v) => v.toLocaleString()}
            label={{ value: 'Disconnections', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
            label={{ value: 'Avg Debt ($)', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(value: number, name: string) => {
              if (name === 'avg_debt') return [`$${value.toFixed(0)}`, 'Avg Debt at Disconnection']
              if (name === 'residential') return [value.toLocaleString(), 'Residential Disconnections']
              return [value.toLocaleString(), 'Small Business Disconnections']
            }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="residential"
            name="residential"
            fill="url(#discGradient)"
            stroke={stateColor}
            strokeWidth={2}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="small_business"
            name="small_business"
            fill="#6b728040"
            stroke="#6b7280"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avg_debt"
            name="avg_debt"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ConsumerHardshipAnalytics() {
  const [data, setData] = useState<ECHDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getConsumerHardshipDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-lg animate-pulse">Loading hardship analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-lg">{error ?? 'No data available'}</p>
      </div>
    )
  }

  const summary = data.summary as Record<string, number>
  const totalConcessionSpend = summary.total_concession_cost_m ?? 0
  const nonCompliantRetailers = summary.non_compliant_retailers ?? 0
  const highestStressPct = summary.highest_stress_pct ?? 0
  const statesTracked = summary.states_tracked ?? 0

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Heart className="text-rose-400" size={28} />
          <h1 className="text-2xl font-bold text-white">
            Energy Consumer Hardship &amp; Affordability Analytics
          </h1>
        </div>
        <p className="text-gray-400 text-sm ml-10">
          NEM-wide household energy stress indicators, hardship program effectiveness, concession coverage,
          payment plan data, disconnection trends, and retailer hardship policy comparison.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<Users size={22} />}
          label="States Tracked"
          value={String(statesTracked)}
          sub="NSW, VIC, QLD, SA, TAS"
          iconClass="text-blue-400"
        />
        <KpiCard
          icon={<AlertTriangle size={22} />}
          label="Highest Stress State"
          value={`TAS ${highestStressPct}%`}
          sub="Households in energy stress"
          iconClass="text-red-400"
        />
        <KpiCard
          icon={<Heart size={22} />}
          label="Non-Compliant Retailers"
          value={String(nonCompliantRetailers)}
          sub="AEMC hardship policy breach"
          iconClass="text-rose-400"
        />
        <KpiCard
          icon={<DollarSign size={22} />}
          label="Total Concession Spend"
          value={`$${totalConcessionSpend.toFixed(0)}M`}
          sub="Across all programs"
          iconClass="text-emerald-400"
        />
      </div>

      {/* Energy Stress Trend Chart */}
      <div className="mb-6">
        <StressTrendChart records={data.stress_records} />
      </div>

      {/* Retailer Hardship Policy Table */}
      <div className="mb-6">
        <RetailerPolicyTable retailers={data.retailers} />
      </div>

      {/* Concession Coverage Table */}
      <div className="mb-6">
        <ConcessionCoverageTable concessions={data.concessions} />
      </div>

      {/* Disconnection Trend Chart */}
      <div className="mb-6">
        <DisconnectionTrendChart disconnections={data.disconnections} />
      </div>

      {/* Footer note */}
      <p className="text-gray-600 text-xs text-center mt-4">
        Data sourced from AER Annual Retail Markets Reports, AEMC Retail Energy Competition Review, and state concession registries.
        Sprint 71c &mdash; Consumer Advocacy Metrics &amp; Policy Comparison.
      </p>
    </div>
  )
}
