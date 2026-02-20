import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import {
  getEPVDashboard,
  EPVDashboard,
  EPVAffordabilityRecord,
  EPVStressIndicatorRecord,
  EPVConcessionRecord,
  EPVRegionRecord,
  EPVPolicyRecord,
} from '../api/client'
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

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  OPERATING: 'bg-emerald-600 text-white',
  ANNOUNCED: 'bg-blue-600 text-white',
  CONSULTATION: 'bg-amber-600 text-white',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-700 text-gray-200'}`}
    >
      {status}
    </span>
  )
}

// ── State colour map ───────────────────────────────────────────────────────────

const STATE_COLORS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#34d399',
  QLD: '#f59e0b',
  SA:  '#f87171',
  TAS: '#a78bfa',
}

// ── Affordability Trends ──────────────────────────────────────────────────────

function AffordabilityTrends({ data }: { data: EPVAffordabilityRecord[] }) {
  // Build chart data: year → { NSW, VIC, QLD, SA, TAS } energy_burden_pct
  const years = Array.from(new Set(data.map((r) => r.year))).sort()
  const states = Array.from(new Set(data.map((r) => r.state)))

  const chartData = years.map((yr) => {
    const row: Record<string, number | string> = { year: String(yr) }
    states.forEach((st) => {
      const rec = data.find((r) => r.state === st && r.year === yr)
      if (rec) row[st] = rec.energy_burden_pct
    })
    return row
  })

  const lowIncomeChartData = years.map((yr) => {
    const row: Record<string, number | string> = { year: String(yr) }
    states.forEach((st) => {
      const rec = data.find((r) => r.state === st && r.year === yr)
      if (rec) row[st] = rec.low_income_energy_burden_pct
    })
    return row
  })

  return (
    <section className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-white mb-4">
        Affordability Trends — Energy Burden % by State
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        Energy burden = annual electricity bill as % of median household income. &gt;6% is considered severe energy poverty.
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-gray-300 mb-2 font-medium">All Households — Energy Burden %</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[2, 9]} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => `${v.toFixed(2)}%`}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {states.map((st) => (
                <Line
                  key={st}
                  type="monotone"
                  dataKey={st}
                  stroke={STATE_COLORS[st] ?? '#aaa'}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-sm text-gray-300 mb-2 font-medium">Low-Income Households (Bottom Quintile) — Energy Burden %</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lowIncomeChartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[5, 16]} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => `${v.toFixed(2)}%`}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {states.map((st) => (
                <Line
                  key={st}
                  type="monotone"
                  dataKey={st}
                  stroke={STATE_COLORS[st] ?? '#aaa'}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

// ── Stress Indicators ─────────────────────────────────────────────────────────

function StressIndicators({ data }: { data: EPVStressIndicatorRecord[] }) {
  const quarters = Array.from(new Set(data.map((r) => r.quarter))).sort()
  const states = Array.from(new Set(data.map((r) => r.state)))

  // Aggregated disconnections per quarter (all states)
  const disconnChartData = quarters.map((q) => {
    const row: Record<string, number | string> = { quarter: q }
    states.forEach((st) => {
      const rec = data.find((r) => r.state === st && r.quarter === q)
      if (rec) row[st] = rec.disconnections_residential
    })
    return row
  })

  // Aggregated complaints per quarter
  const complaintsChartData = quarters.map((q) => {
    const row: Record<string, number | string> = { quarter: q }
    states.forEach((st) => {
      const rec = data.find((r) => r.state === st && r.quarter === q)
      if (rec) row[st] = rec.energy_ombudsman_complaints
    })
    return row
  })

  return (
    <section className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-white mb-4">
        Stress Indicators — Quarterly Disconnections &amp; Complaints
      </h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-gray-300 mb-2 font-medium">Residential Disconnections by State</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={disconnChartData} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="quarter"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-30}
                textAnchor="end"
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {states.map((st) => (
                <Bar key={st} dataKey={st} stackId="a" fill={STATE_COLORS[st] ?? '#888'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-sm text-gray-300 mb-2 font-medium">Energy Ombudsman Complaints by State</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={complaintsChartData} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="quarter"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-30}
                textAnchor="end"
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {states.map((st) => (
                <Bar key={st} dataKey={st} stackId="a" fill={STATE_COLORS[st] ?? '#888'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

// ── Concession Effectiveness ───────────────────────────────────────────────────

function ConcessionEffectiveness({ data }: { data: EPVConcessionRecord[] }) {
  const concessionTypes = Array.from(new Set(data.map((r) => r.concession_type)))

  // Group by concession_type, show uptake_pct and effectiveness_score side by side
  const chartData = concessionTypes.map((ct) => {
    const recs = data.filter((r) => r.concession_type === ct)
    const avgUptake = recs.reduce((s, r) => s + r.uptake_pct, 0) / recs.length
    const avgEff = recs.reduce((s, r) => s + r.effectiveness_score, 0) / recs.length
    return {
      type: ct.replace(/_/g, ' '),
      'Avg Uptake %': Math.round(avgUptake * 10) / 10,
      'Avg Effectiveness (0-10)': Math.round(avgEff * 10) / 10,
    }
  })

  return (
    <section className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-white mb-4">
        Concession Effectiveness — Uptake % vs Effectiveness Score
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        Effectiveness score (0-10) measures reduction in energy stress achieved per concession type. Averaged across states.
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 48, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="type"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-20}
            textAnchor="end"
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="Avg Uptake %" fill="#60a5fa" />
          <Bar dataKey="Avg Effectiveness (0-10)" fill="#34d399" />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="py-2 pr-4">State</th>
              <th className="py-2 pr-4">Concession Type</th>
              <th className="py-2 pr-4">Annual Value ($)</th>
              <th className="py-2 pr-4">Eligible (000s)</th>
              <th className="py-2 pr-4">Uptake %</th>
              <th className="py-2 pr-4">Govt Cost ($M/yr)</th>
              <th className="py-2">Effectiveness</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-4 font-medium">{r.state}</td>
                <td className="py-2 pr-4">{r.concession_type.replace(/_/g, ' ')}</td>
                <td className="py-2 pr-4">${r.annual_value.toFixed(0)}</td>
                <td className="py-2 pr-4">{r.eligible_households_thousands}</td>
                <td className="py-2 pr-4">
                  <span className={r.uptake_pct >= 75 ? 'text-emerald-400' : r.uptake_pct >= 60 ? 'text-amber-400' : 'text-red-400'}>
                    {r.uptake_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 pr-4">${r.govt_cost_m_yr.toFixed(1)}M</td>
                <td className="py-2">
                  <span className={r.effectiveness_score >= 7 ? 'text-emerald-400' : r.effectiveness_score >= 5.5 ? 'text-amber-400' : 'text-red-400'}>
                    {r.effectiveness_score.toFixed(1)}/10
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Regional Vulnerability ────────────────────────────────────────────────────

function RegionalVulnerability({ data }: { data: EPVRegionRecord[] }) {
  const sorted = [...data].sort((a, b) => b.energy_poverty_rate_pct - a.energy_poverty_rate_pct)

  return (
    <section className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-white mb-4">
        Regional Vulnerability — SA4 Regions Sorted by Energy Poverty Rate
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        Regions with poverty rate &gt;10% are considered high vulnerability. Solar access % for low-income households
        limited by rental and apartment dwelling types.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="py-2 pr-4">SA4 Region</th>
              <th className="py-2 pr-4">State</th>
              <th className="py-2 pr-4">Poverty Rate %</th>
              <th className="py-2 pr-4">Energy Burden %</th>
              <th className="py-2 pr-4">Solar Access %</th>
              <th className="py-2 pr-4">Social Housing %</th>
              <th className="py-2 pr-4">Avg Star Rating</th>
              <th className="py-2">Digital Access %</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-4 font-medium text-white">{r.sa4_region}</td>
                <td className="py-2 pr-4">
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-medium"
                    style={{ background: STATE_COLORS[r.state] + '33', color: STATE_COLORS[r.state] }}
                  >
                    {r.state}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={
                      r.energy_poverty_rate_pct > 12
                        ? 'text-red-400 font-bold'
                        : r.energy_poverty_rate_pct > 9
                        ? 'text-amber-400 font-medium'
                        : 'text-emerald-400'
                    }
                  >
                    {r.energy_poverty_rate_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 pr-4">{r.avg_energy_burden_pct.toFixed(1)}%</td>
                <td className="py-2 pr-4">{r.solar_access_pct.toFixed(1)}%</td>
                <td className="py-2 pr-4">{r.social_housing_pct.toFixed(1)}%</td>
                <td className="py-2 pr-4">{r.avg_star_rating.toFixed(1)}</td>
                <td className="py-2">{r.digital_access_pct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Policy Comparison ─────────────────────────────────────────────────────────

const POLICY_TYPE_COLORS: Record<string, string> = {
  REBATE: 'bg-blue-700 text-blue-200',
  TARIFF_REFORM: 'bg-indigo-700 text-indigo-200',
  EFFICIENCY_UPGRADE: 'bg-emerald-700 text-emerald-200',
  SOLAR_FOR_RENTERS: 'bg-amber-700 text-amber-200',
  COMMUNITY_ENERGY: 'bg-purple-700 text-purple-200',
}

function PolicyComparison({ data }: { data: EPVPolicyRecord[] }) {
  const sorted = [...data].sort(
    (a, b) => b.annual_beneficiaries_thousands - a.annual_beneficiaries_thousands,
  )

  return (
    <section className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-white mb-4">
        Policy Comparison — Low-Income Energy Programs
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        Covers rebates, tariff reform, efficiency upgrades, solar-for-renters and community energy programs
        across federal and state jurisdictions.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="py-2 pr-4">Policy</th>
              <th className="py-2 pr-4">Jurisdiction</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Beneficiaries (000s)</th>
              <th className="py-2 pr-4">Govt Cost ($M/yr)</th>
              <th className="py-2 pr-4">Energy Saving (kWh/hh)</th>
              <th className="py-2 pr-4">Bill Reduction ($/hh)</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-4 font-medium text-white max-w-xs">{r.policy}</td>
                <td className="py-2 pr-4 font-mono text-xs">{r.jurisdiction}</td>
                <td className="py-2 pr-4">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${POLICY_TYPE_COLORS[r.policy_type] ?? 'bg-gray-700 text-gray-200'}`}
                  >
                    {r.policy_type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-2 pr-4">{r.annual_beneficiaries_thousands.toLocaleString()}</td>
                <td className="py-2 pr-4">
                  {r.govt_cost_m_yr > 0 ? `$${r.govt_cost_m_yr.toFixed(0)}M` : '—'}
                </td>
                <td className="py-2 pr-4">
                  {r.energy_saving_per_household_kwh > 0
                    ? r.energy_saving_per_household_kwh.toLocaleString()
                    : '—'}
                </td>
                <td className="py-2 pr-4">${r.bill_reduction_per_household.toFixed(0)}</td>
                <td className="py-2">
                  <StatusBadge status={r.implementation_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EnergyPovertyAnalytics() {
  const [dash, setDash] = useState<EPVDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEPVDashboard()
      .then((d) => {
        setDash(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading energy poverty data...
      </div>
    )
  }

  if (error || !dash) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error loading data: {error}
      </div>
    )
  }

  const s = dash.summary as Record<string, number | string>

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Heart className="text-rose-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Energy Poverty &amp; Vulnerable Customer Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Affordability indices, energy burden metrics, concession effectiveness and low-income policy analysis — Australia
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <KpiCard
          label="Avg Energy Burden"
          value={Number(s.avg_energy_burden_pct).toFixed(1)}
          unit="%"
          sub="All households"
          valueColor="#60a5fa"
        />
        <KpiCard
          label="Low-Income Burden"
          value={Number(s.low_income_energy_burden_pct).toFixed(1)}
          unit="%"
          sub="Bottom quintile"
          valueColor="#f87171"
        />
        <KpiCard
          label="Households in Stress"
          value={Number(s.households_in_stress_thousands).toLocaleString()}
          unit="000s"
          sub="Paying >10% income"
          valueColor="#fbbf24"
        />
        <KpiCard
          label="Total Concession Spend"
          value={`$${Number(s.total_concession_spend_m).toLocaleString()}M`}
          sub="Annual govt outlay"
          valueColor="#34d399"
        />
        <KpiCard
          label="Highest Burden State"
          value={String(s.highest_burden_state)}
          sub="Severe energy poverty"
          valueColor="#a78bfa"
        />
        <KpiCard
          label="2024 Disconnections"
          value={Number(s.disconnections_2024).toLocaleString()}
          sub="Residential"
          valueColor="#f87171"
        />
        <KpiCard
          label="Low-Income Solar Access"
          value={Number(s.avg_solar_access_low_income_pct).toFixed(1)}
          unit="%"
          sub="Rental/apartment gap"
          valueColor="#fbbf24"
        />
      </div>

      {/* Affordability Trends */}
      <AffordabilityTrends data={dash.affordability} />

      {/* Stress Indicators */}
      <StressIndicators data={dash.stress_indicators} />

      {/* Concession Effectiveness */}
      <ConcessionEffectiveness data={dash.concessions} />

      {/* Regional Vulnerability */}
      <RegionalVulnerability data={dash.regions} />

      {/* Policy Comparison */}
      <PolicyComparison data={dash.policies} />
    </div>
  )
}
