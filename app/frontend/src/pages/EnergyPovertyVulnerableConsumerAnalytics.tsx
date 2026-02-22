import { useEffect, useState } from 'react'
import { Users, DollarSign, TrendingDown, Heart } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getEnergyPovertyVulnerableConsumerDashboard,
  EPVCDashboard,
  EPVCHardshipRecord,
  EPVCDisconnectionRecord,
  EPVCAffordabilityRecord,
  EPVCConcessionRecord,
  EPVCInterventionRecord,
  EPVCForecastRecord,
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

const RETAILER_COLOURS: Record<string, string> = {
  'AGL':              '#3b82f6',
  'Origin Energy':    '#10b981',
  'EnergyAustralia':  '#f59e0b',
  'Red Energy':       '#ef4444',
  'Powershop':        '#8b5cf6',
}

const STATE_COLOURS: Record<string, string> = {
  'NSW': '#3b82f6',
  'VIC': '#10b981',
  'QLD': '#f59e0b',
  'SA':  '#ef4444',
  'WA':  '#8b5cf6',
}

const SCENARIO_COLOURS: Record<string, string> = {
  'BAU':                      '#ef4444',
  'Targeted Intervention':    '#f59e0b',
  'Universal Basic Energy':   '#10b981',
}

// ── Chart 1: Hardship Program Enrollment ──────────────────────────────────
function HardshipEnrollmentChart({ data }: { data: EPVCHardshipRecord[] }) {
  const top5Retailers = ['AGL', 'Origin Energy', 'EnergyAustralia', 'Red Energy', 'Powershop']
  const years = Array.from(new Set(data.map(d => d.year))).sort()

  const chartData = years.map(yr => {
    const row: Record<string, string | number> = { year: yr }
    top5Retailers.forEach(r => {
      const recs = data.filter(d => d.year === yr && d.retailer === r)
      row[r] = recs.reduce((acc, d) => acc + d.customers_on_hardship_program, 0)
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
          label={{ value: 'Customers on Hardship', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ paddingTop: 12, fontSize: 11, color: '#9ca3af' }} />
        {top5Retailers.map(r => (
          <Line
            key={r}
            type="monotone"
            dataKey={r}
            stroke={RETAILER_COLOURS[r] ?? '#6b7280'}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Chart 2: Disconnection Trend ──────────────────────────────────────────
function DisconnectionTrendChart({ data }: { data: EPVCDisconnectionRecord[] }) {
  const quarters = Array.from(new Set(data.map(d => d.quarter))).sort()

  const chartData = quarters.map(q => {
    const recs = data.filter(d => d.quarter === q)
    return {
      quarter: q,
      disconnections_count: recs.reduce((acc, d) => acc + d.disconnections_count, 0),
      medical_exemptions: recs.reduce((acc, d) => acc + d.medical_exemptions, 0),
    }
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="quarter"
          tick={{ fill: '#9ca3af', fontSize: 9 }}
          angle={-40}
          textAnchor="end"
          interval={1}
        />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ paddingTop: 16, fontSize: 11, color: '#9ca3af' }} />
        <Line
          type="monotone"
          dataKey="disconnections_count"
          name="Disconnections"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="medical_exemptions"
          name="Medical Exemptions"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Chart 3: Energy Poverty Rate by State ─────────────────────────────────
function EnergyPovertyRateChart({ data }: { data: EPVCAffordabilityRecord[] }) {
  const states = Array.from(new Set(data.map(d => d.state))).sort()
  const years = Array.from(new Set(data.map(d => d.year))).sort()

  const chartData = states.map(s => {
    const row: Record<string, string | number> = { state: s }
    years.forEach(yr => {
      const rec = data.find(d => d.state === s && d.year === yr)
      if (rec) row[String(yr)] = rec.energy_poverty_rate_pct
    })
    return row
  })

  const yearColours = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Poverty Rate (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ paddingTop: 12, fontSize: 11, color: '#9ca3af' }} />
        {years.map((yr, i) => (
          <Bar key={yr} dataKey={String(yr)} fill={yearColours[i % yearColours.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 4: Concession Scheme Value (horizontal bar) ─────────────────────
function ConcessionSchemeChart({ data }: { data: EPVCConcessionRecord[] }) {
  const sorted = [...data].sort((a, b) => b.annual_value_aud - a.annual_value_aud)
  const chartData = sorted.map(c => ({
    name: c.scheme_name.length > 32 ? c.scheme_name.slice(0, 30) + '…' : c.scheme_name,
    value: c.annual_value_aud,
    state: c.state,
  }))

  return (
    <ResponsiveContainer width="100%" height={480}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 230, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          type="number"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Annual Value (AUD)', position: 'insideBottom', offset: -4, fill: '#9ca3af', fontSize: 10 }}
        />
        <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} width={225} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Annual Value']}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={STATE_COLOURS[entry.state] ?? '#6b7280'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Chart 5: Intervention Effectiveness (Scatter) ─────────────────────────
function InterventionEffectivenessChart({ data }: { data: EPVCInterventionRecord[] }) {
  const chartData = data.map(d => ({
    name: d.program_name,
    cost_per_household: d.cost_per_household_aud,
    bill_reduction: d.avg_bill_reduction_aud,
    type: d.program_type,
  }))

  const TYPE_COLOURS: Record<string, string> = {
    'Efficiency Upgrade': '#10b981',
    'Concession':         '#3b82f6',
    'Payment Plan':       '#f59e0b',
    'Smart Meter':        '#8b5cf6',
    'Community Solar':    '#06b6d4',
    'Emergency Fund':     '#ef4444',
    'Hardship Tariff':    '#f97316',
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          type="number"
          dataKey="cost_per_household"
          name="Cost per Household"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Cost per Household (AUD)', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 10 }}
        />
        <YAxis
          type="number"
          dataKey="bill_reduction"
          name="Bill Reduction"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Avg Bill Reduction (AUD)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
          cursor={{ strokeDasharray: '3 3' }}
          formatter={(value: number, name: string) => [`$${value.toFixed(0)}`, name === 'cost_per_household' ? 'Cost/HH' : 'Bill Reduction']}
        />
        <Scatter
          data={chartData}
          name="Programs"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={TYPE_COLOURS[entry.type] ?? '#6b7280'} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ── Chart 6: Forecast Poverty Rate by Scenario ────────────────────────────
function ForecastPovertyRateChart({ data }: { data: EPVCForecastRecord[] }) {
  const scenarios = ['BAU', 'Targeted Intervention', 'Universal Basic Energy']
  const nswData = data.filter(d => d.state === 'NSW')
  const years = Array.from(new Set(nswData.map(d => d.year))).sort()

  const chartData = years.map(yr => {
    const row: Record<string, string | number> = { year: yr }
    scenarios.forEach(s => {
      const rec = nswData.find(d => d.year === yr && d.policy_scenario === s)
      if (rec) row[s] = rec.projected_energy_poverty_rate_pct
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
          label={{ value: 'Energy Poverty Rate (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
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
            strokeDasharray={s === 'BAU' ? undefined : s === 'Targeted Intervention' ? '5 5' : '2 4'}
            dot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function EnergyPovertyVulnerableConsumerAnalytics() {
  const [data, setData] = useState<EPVCDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyPovertyVulnerableConsumerDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="p-8 text-red-400">
        Failed to load Energy Poverty & Vulnerable Consumer Analytics: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-gray-400">Loading Energy Poverty & Vulnerable Consumer Analytics...</div>
    )
  }

  const { summary } = data

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users size={26} className="text-blue-400" />
          Energy Poverty &amp; Vulnerable Consumer Analytics
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Hardship programs, disconnections, concession schemes, affordability, interventions and forecasts — Australia 2020–2030
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Hardship Customers"
          value={(summary.total_hardship_customers as number).toLocaleString()}
          sub="All retailers & states"
          icon={Users}
          colour="bg-blue-600"
        />
        <KpiCard
          label="Avg Energy Poverty Rate"
          value={`${(summary.avg_energy_poverty_rate_pct as number).toFixed(1)}%`}
          sub="2020–2024 average"
          icon={TrendingDown}
          colour="bg-red-600"
        />
        <KpiCard
          label="Total Concession Spend"
          value={`$${(summary.total_concession_spend_m as number).toFixed(0)}M`}
          sub="Annual concession value"
          icon={DollarSign}
          colour="bg-green-600"
        />
        <KpiCard
          label="Most Effective Intervention"
          value={(summary.most_effective_intervention as string).split(' ').slice(0, 3).join(' ')}
          sub="By avg bill reduction"
          icon={Heart}
          colour="bg-purple-600"
        />
      </div>

      {/* Chart 1: Hardship Program Enrollment */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Hardship Program Enrollment by Retailer"
          subtitle="Customers on hardship programs per year — top 5 retailers"
        />
        <HardshipEnrollmentChart data={data.hardship} />
      </div>

      {/* Chart 2: Disconnection Trend */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Disconnection Trend"
          subtitle="Total disconnections count and medical exemptions by quarter"
        />
        <DisconnectionTrendChart data={data.disconnections} />
      </div>

      {/* Chart 3 + Chart 4 side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 shadow">
          <SectionHeader
            title="Energy Poverty Rate by State"
            subtitle="Energy poverty rate (>10% income on energy) — grouped by year"
          />
          <EnergyPovertyRateChart data={data.affordability} />
        </div>

        <div className="bg-gray-800 rounded-xl p-6 shadow">
          <SectionHeader
            title="Forecast: Energy Poverty Rate by Scenario"
            subtitle="Projected poverty rate for NSW 2025–2030 under 3 policy scenarios"
          />
          <ForecastPovertyRateChart data={data.forecasts} />
        </div>
      </div>

      {/* Chart 5: Intervention Effectiveness (Scatter) */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Intervention Effectiveness"
          subtitle="Cost per household vs average bill reduction — by program type"
        />
        <InterventionEffectivenessChart data={data.interventions} />
      </div>

      {/* Chart 6: Concession Scheme Value */}
      <div className="bg-gray-800 rounded-xl p-6 shadow">
        <SectionHeader
          title="Concession Scheme Annual Value"
          subtitle="Annual benefit value per scheme sorted by value — colour by state"
        />
        <ConcessionSchemeChart data={data.concessions} />
      </div>

      {/* Summary row */}
      <div className="bg-gray-800 rounded-xl p-5 shadow grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide">Avg Disconnection Rate</p>
          <p className="text-white font-semibold mt-0.5">
            {(summary.avg_disconnection_rate_per_1000 as number).toFixed(2)}k per quarter
          </p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide">Projected 2030 Poverty Rate (BAU)</p>
          <p className="text-red-400 font-semibold mt-0.5">
            {(summary.projected_2030_poverty_rate_pct as number).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide">Most Effective Intervention</p>
          <p className="text-green-400 font-semibold mt-0.5">
            {summary.most_effective_intervention as string}
          </p>
        </div>
      </div>
    </div>
  )
}
