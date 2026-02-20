import { useEffect, useState } from 'react'
import { BarChart2, Users, TrendingUp, Activity } from 'lucide-react'
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
  Cell,
} from 'recharts'
import {
  getTariffCrossSubsidyDashboard,
  CRTDashboard,
  CRTTariffStructureRecord,
  CRTCrossSubsidyRecord,
  CRTCustomerCostRecord,
  CRTDerImpactRecord,
} from '../api/client'

// ── Colour maps ───────────────────────────────────────────────────────────────

const TARIFF_TYPE_BADGE: Record<string, string> = {
  FLAT: 'bg-gray-600 text-gray-100',
  TOU: 'bg-blue-600 text-blue-100',
  DEMAND: 'bg-green-600 text-green-100',
  CAPACITY: 'bg-purple-600 text-purple-100',
}

const SEGMENT_BADGE: Record<string, string> = {
  RESIDENTIAL: 'bg-sky-700 text-sky-100',
  SME: 'bg-amber-700 text-amber-100',
  LARGE_COMMERCIAL: 'bg-violet-700 text-violet-100',
  INDUSTRIAL: 'bg-rose-700 text-rose-100',
}

const REFORM_BADGE: Record<string, string> = {
  REFORMED: 'bg-green-700 text-green-100',
  IN_PROGRESS: 'bg-yellow-600 text-yellow-100',
  UNREFORMED: 'bg-red-700 text-red-100',
}

const RISK_COLOR: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#8b5cf6',
  SA1: '#10b981',
}

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
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-start gap-3">
      <div className="text-blue-400 mt-0.5">{icon}</div>
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
        <p className="text-white text-2xl font-bold leading-tight">{value}</p>
        {sub && <p className="text-gray-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Cost-reflective score bar ─────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const color =
    score >= 8 ? '#22c55e' : score >= 6 ? '#eab308' : score >= 4 ? '#f97316' : '#ef4444'
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

// ── Tariff Structure Table ────────────────────────────────────────────────────

function TariffStructureTable({ data }: { data: CRTTariffStructureRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-white font-semibold text-lg mb-4">
        Distribution Tariff Structures
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
              <th className="text-left pb-2 pr-3">DNSP</th>
              <th className="text-left pb-2 pr-3">Tariff Name</th>
              <th className="text-left pb-2 pr-3">Type</th>
              <th className="text-left pb-2 pr-3">Segment</th>
              <th className="text-right pb-2 pr-3">Fixed ($/day)</th>
              <th className="text-right pb-2 pr-3">Peak (c/kWh)</th>
              <th className="text-right pb-2 pr-3">Off-peak (c/kWh)</th>
              <th className="text-right pb-2 pr-3">Demand ($/kW)</th>
              <th className="text-left pb-2 pr-3 min-w-[140px]">Cost Reflective Score</th>
              <th className="text-right pb-2">Penetration</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 text-gray-200 font-medium">{row.dnsp}</td>
                <td className="py-2 pr-3 text-gray-300">{row.tariff_name}</td>
                <td className="py-2 pr-3">
                  <Badge
                    label={row.tariff_type}
                    cls={TARIFF_TYPE_BADGE[row.tariff_type] ?? 'bg-gray-600 text-gray-100'}
                  />
                </td>
                <td className="py-2 pr-3">
                  <Badge
                    label={row.customer_segment}
                    cls={SEGMENT_BADGE[row.customer_segment] ?? 'bg-gray-600 text-gray-100'}
                  />
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  {row.fixed_charge_per_day.toFixed(2)}
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  {(row.energy_charge_peak * 100).toFixed(1)}
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  {(row.energy_charge_offpeak * 100).toFixed(1)}
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  {row.demand_charge_per_kw > 0 ? row.demand_charge_per_kw.toFixed(2) : '—'}
                </td>
                <td className="py-2 pr-3">
                  <ScoreBar score={row.cost_reflective_score} />
                </td>
                <td className="py-2 text-right text-gray-300">{row.penetration_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Cross-Subsidy Flow Table ──────────────────────────────────────────────────

function CrossSubsidyTable({ data }: { data: CRTCrossSubsidyRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-white font-semibold text-lg mb-4">
        Cross-Subsidy Flows
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
              <th className="text-left pb-2 pr-3">Region / DNSP</th>
              <th className="text-left pb-2 pr-3">Who Pays</th>
              <th className="text-center pb-2 pr-3 w-6"></th>
              <th className="text-left pb-2 pr-3">Who Receives</th>
              <th className="text-right pb-2 pr-3">Annual ($M/yr)</th>
              <th className="text-right pb-2 pr-3">Per Customer ($/yr)</th>
              <th className="text-left pb-2 pr-3">Main Driver</th>
              <th className="text-left pb-2">Reform Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3">
                  <div className="text-gray-200 font-medium">{row.region}</div>
                  <div className="text-gray-500 text-xs">{row.dnsp}</div>
                </td>
                <td className="py-2 pr-3 text-red-300 font-medium">
                  {row.subsidising_segment}
                </td>
                <td className="py-2 pr-3 text-center text-gray-400 font-bold">→</td>
                <td className="py-2 pr-3 text-green-300 font-medium">
                  {row.subsidised_segment}
                </td>
                <td className="py-2 pr-3 text-right">
                  <span className="text-orange-300 font-semibold">
                    ${row.annual_transfer_m}M
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-gray-300">
                  ${row.per_customer_per_year.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-gray-400 text-xs max-w-[220px]">
                  {row.main_driver}
                </td>
                <td className="py-2">
                  <Badge
                    label={row.reform_status.replace('_', ' ')}
                    cls={REFORM_BADGE[row.reform_status] ?? 'bg-gray-600 text-gray-100'}
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

// ── Customer Bill Comparison ──────────────────────────────────────────────────

function CustomerBillChart({ data }: { data: CRTCustomerCostRecord[] }) {
  const chartData = data.map((r) => ({
    name: r.customer_type,
    'Actual Bill': Math.round(r.actual_bill_per_yr),
    'Cost-Reflective Bill': Math.round(r.cost_reflective_bill_per_yr),
    direction: r.subsidy_direction,
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const diff = payload[0]?.value - payload[1]?.value
    return (
      <div className="bg-gray-900 border border-gray-700 rounded p-3 text-xs">
        <p className="text-white font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: ${p.value.toLocaleString()}
          </p>
        ))}
        <p className={`mt-1 font-semibold ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
          {diff > 0
            ? `Pays $${Math.abs(diff).toLocaleString()} above cost-reflective`
            : `Receives $${Math.abs(diff).toLocaleString()} subsidy`}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-white font-semibold text-lg mb-1">
        Customer Bill: Actual vs Cost-Reflective
      </h2>
      <p className="text-gray-400 text-xs mb-4">
        Grouped by customer type — gap reveals subsidy direction
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-25}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 12 }}
          />
          <Bar dataKey="Actual Bill" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.direction === 'PAYS' ? '#ef4444' : '#22c55e'}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
          <Bar dataKey="Cost-Reflective Bill" fill="#3b82f6" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-gray-400">Actual (subsidises others)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
          <span className="text-gray-400">Actual (receives subsidy)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-gray-400">Cost-Reflective Bill</span>
        </span>
      </div>
    </div>
  )
}

// ── DER Impact Trend Chart ────────────────────────────────────────────────────

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1']

function DerImpactChart({ data }: { data: CRTDerImpactRecord[] }) {
  const [activeRegion, setActiveRegion] = useState('SA1')

  const regionData = data
    .filter((r) => r.region === activeRegion)
    .sort((a, b) => a.year - b.year)

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props
    const color = RISK_COLOR[payload.death_spiral_risk] ?? '#9ca3af'
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#1f2937" strokeWidth={1.5} />
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const record = regionData.find((r) => r.year === label)
    return (
      <div className="bg-gray-900 border border-gray-700 rounded p-3 text-xs">
        <p className="text-white font-semibold mb-1">{activeRegion} — {label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value.toFixed(1)}{p.name.includes('%') ? '%' : 'M'}
          </p>
        ))}
        {record && (
          <>
            <p className="text-gray-400 mt-1">Solar: {record.rooftop_solar_gw} GW</p>
            <p className="text-gray-400">EV adoption: {record.ev_adoption_pct}%</p>
            <p
              className="font-semibold mt-1"
              style={{ color: RISK_COLOR[record.death_spiral_risk] }}
            >
              Death Spiral Risk: {record.death_spiral_risk}
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-white font-semibold text-lg mb-1">
        DER Integration Impact &amp; Death Spiral Risk
      </h2>
      <p className="text-gray-400 text-xs mb-4">
        Fixed cost recovery gap and average bill increase driven by solar/EV uptake. Dot colour = death spiral risk level.
      </p>

      {/* Region tabs */}
      <div className="flex gap-2 mb-5">
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRegion(r)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeRegion === r
                ? 'text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
            }`}
            style={
              activeRegion === r
                ? { backgroundColor: REGION_COLORS[r], color: '#fff' }
                : {}
            }
          >
            {r}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={regionData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{
              value: '$M gap',
              angle: -90,
              position: 'insideLeft',
              fill: '#6b7280',
              fontSize: 11,
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{
              value: 'Bill increase %',
              angle: 90,
              position: 'insideRight',
              fill: '#6b7280',
              fontSize: 11,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="fixed_cost_recovery_gap_m"
            name="Fixed Cost Recovery Gap ($M)"
            stroke="#f97316"
            strokeWidth={2}
            dot={<CustomDot />}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avg_bill_increase_pct"
            name="Avg Bill Increase (%)"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Risk legend */}
      <div className="flex gap-4 mt-3 text-xs">
        {Object.entries(RISK_COLOR).map(([level, color]) => (
          <span key={level} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-gray-400">{level}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TariffCrossSubsidyAnalytics() {
  const [data, setData] = useState<CRTDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTariffCrossSubsidyDashboard()
      .then(setData)
      .catch((e) => setError(e?.message ?? 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading tariff cross-subsidy data...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400">{error ?? 'No data available'}</p>
      </div>
    )
  }

  const summary = data.summary as Record<string, number>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-600/20 p-2 rounded-lg">
          <BarChart2 className="text-blue-400" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Cross-Subsidy &amp; Cost-Reflective Tariff Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            NEM distribution network tariff structures, cross-subsidy flows, customer cost analysis and DER integration impacts
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<BarChart2 size={20} />}
          label="DNSPs Covered"
          value={String(summary.dnsp_count ?? 4)}
          sub="Ausgrid, Citipower, SAPN, Endeavour"
        />
        <KpiCard
          icon={<Activity size={20} />}
          label="Cross-Subsidy Flows"
          value={String(summary.cross_subsidy_flows ?? 6)}
          sub={`${summary.unreformed_flows ?? 0} unreformed flows`}
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="Largest Transfer"
          value="$450M/yr"
          sub="QLD1 urban→rural (Energex)"
        />
        <KpiCard
          icon={<Users size={20} />}
          label="Reformed Flows"
          value={`${summary.reformed_flows ?? 1} / ${summary.cross_subsidy_flows ?? 6}`}
          sub="SA1 solar reform completed"
        />
      </div>

      {/* ── Tariff Structures ── */}
      <div className="mb-6">
        <TariffStructureTable data={data.tariff_structures} />
      </div>

      {/* ── Cross-Subsidy Flows ── */}
      <div className="mb-6">
        <CrossSubsidyTable data={data.cross_subsidies} />
      </div>

      {/* ── Bill Comparison + DER Impact ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <CustomerBillChart data={data.customer_costs} />
        <DerImpactChart data={data.der_impacts} />
      </div>

      {/* ── Footer note ── */}
      <p className="text-gray-600 text-xs text-center">
        Sprint 71b · Cross-Subsidy &amp; Cost-Reflective Tariff Analytics · NEM Distribution Network ·{' '}
        {new Date().getFullYear()}
      </p>
    </div>
  )
}
