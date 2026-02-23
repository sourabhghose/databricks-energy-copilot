import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { Wind } from 'lucide-react'
import {
  getRezCapacityFactorDashboard,
  REZCDashboard,
} from '../api/client'

// ── Colour palettes ──────────────────────────────────────────────────────────
const TECH_COLOURS: Record<string, string> = {
  Wind:  '#3b82f6',
  Solar: '#f59e0b',
}

const REZ_COLOURS: Record<string, string> = {
  'REZ-NSW1': '#3b82f6',
  'REZ-NSW2': '#10b981',
  'REZ-NSW3': '#f59e0b',
  'REZ-QLD1': '#8b5cf6',
  'REZ-QLD2': '#ef4444',
  'REZ-VIC1': '#06b6d4',
  'REZ-SA1':  '#f97316',
  'REZ-TAS1': '#a3e635',
}

const CONSTRAINT_COLOURS: Record<string, string> = {
  'Thermal Limit':    '#ef4444',
  'Stability Limit':  '#f97316',
  'System Strength':  '#8b5cf6',
}

const REZ_IDS = ['REZ-NSW1', 'REZ-NSW2', 'REZ-NSW3', 'REZ-QLD1', 'REZ-QLD2', 'REZ-VIC1', 'REZ-SA1', 'REZ-TAS1']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs text-gray-400 truncate">{label}</span>
      <span className="text-2xl font-bold text-white leading-none">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500 mt-0.5">{sub}</span>}
    </div>
  )
}

// ── Chart Section Wrapper ─────────────────────────────────────────────────────
function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RezCapacityFactorAnalytics() {
  const [data, setData] = useState<REZCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRezCapacityFactorDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading REZ Capacity Factor Analytics...
      </div>
    )
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data.'}
      </div>
    )

  const { zones, capacity_factors, hourly_patterns, transmission_constraints, economics, summary } = data

  // ── Chart 1: Avg capacity_factor_pct by rez_name for Wind and Solar (grouped) ──
  const rezNameMap: Record<string, string> = {}
  for (const z of zones) rezNameMap[z.rez_id] = z.rez_name

  const cfByRezTech: Record<string, Record<string, number[]>> = {}
  for (const rezId of REZ_IDS) cfByRezTech[rezId] = { Wind: [], Solar: [] }
  for (const cf of capacity_factors) {
    if (cfByRezTech[cf.rez_id]) {
      cfByRezTech[cf.rez_id][cf.technology].push(cf.capacity_factor_pct)
    }
  }
  const chart1Data = REZ_IDS.map(rezId => {
    const windVals = cfByRezTech[rezId]?.Wind ?? []
    const solarVals = cfByRezTech[rezId]?.Solar ?? []
    return {
      name: rezNameMap[rezId] ?? rezId,
      Wind: windVals.length > 0 ? Math.round((windVals.reduce((a, b) => a + b, 0) / windVals.length) * 10) / 10 : 0,
      Solar: solarVals.length > 0 ? Math.round((solarVals.reduce((a, b) => a + b, 0) / solarVals.length) * 10) / 10 : 0,
    }
  })

  // ── Chart 2: Monthly CF for Wind across all REZs (2024 only, 8 lines) ────────
  const windCf2024: Record<string, Record<number, number>> = {}
  for (const rezId of REZ_IDS) windCf2024[rezId] = {}
  for (const cf of capacity_factors) {
    if (cf.year === 2024 && cf.technology === 'Wind') {
      windCf2024[cf.rez_id][cf.month] = cf.capacity_factor_pct
    }
  }
  const chart2Data = Array.from({ length: 12 }, (_, i) => {
    const mo = i + 1
    const row: Record<string, string | number> = { month: MONTHS[i] }
    for (const rezId of REZ_IDS) {
      row[rezId] = windCf2024[rezId]?.[mo] ?? 0
    }
    return row
  })

  // ── Chart 3: avg_cf_pct by hour_of_day for Summer — Wind vs Solar (REZ-NSW1) ─
  const nswSummerPatterns = hourly_patterns.filter(
    p => p.rez_id === 'REZ-NSW1' && p.season === 'Summer',
  )
  const chart3Data = Array.from({ length: 24 }, (_, h) => {
    const windRows = nswSummerPatterns.filter(p => p.hour_of_day === h && p.technology === 'Wind')
    const solarRows = nswSummerPatterns.filter(p => p.hour_of_day === h && p.technology === 'Solar')
    const windAvg = windRows.length > 0
      ? Math.round((windRows.reduce((a, b) => a + b.avg_cf_pct, 0) / windRows.length) * 10) / 10
      : 0
    const solarAvg = solarRows.length > 0
      ? Math.round((solarRows.reduce((a, b) => a + b.avg_cf_pct, 0) / solarRows.length) * 10) / 10
      : 0
    return { hour: `${String(h).padStart(2, '0')}:00`, Wind: windAvg, Solar: solarAvg }
  })

  // ── Chart 4: revenue_foregone_m by rez_id (summed 2024, coloured by constraint_cause) ─
  const revByRez: Record<string, Record<string, number>> = {}
  for (const rezId of REZ_IDS) revByRez[rezId] = {}
  for (const tc of transmission_constraints) {
    if (tc.year === 2024) {
      if (!revByRez[tc.rez_id]) revByRez[tc.rez_id] = {}
      revByRez[tc.rez_id][tc.constraint_cause] =
        (revByRez[tc.rez_id][tc.constraint_cause] ?? 0) + tc.revenue_foregone_m
    }
  }
  // Determine dominant constraint cause per REZ for colouring
  const chart4Data = REZ_IDS.map(rezId => {
    const causes = revByRez[rezId] ?? {}
    const total = Math.round(Object.values(causes).reduce((a, b) => a + b, 0) * 100) / 100
    const dominant = Object.keys(causes).sort((a, b) => (causes[b] ?? 0) - (causes[a] ?? 0))[0] ?? 'Thermal Limit'
    return { rez: rezId, revenue_foregone_m: total, constraint_cause: dominant }
  })

  // ── Chart 5: effective_lcoe_aud_mwh by rez for Wind and Solar (2024, grouped) ─
  const lcoeByRezTech: Record<string, Record<string, number[]>> = {}
  for (const rezId of REZ_IDS) lcoeByRezTech[rezId] = { Wind: [], Solar: [] }
  for (const econ of economics) {
    if (econ.year === 2024 && lcoeByRezTech[econ.rez_id]) {
      lcoeByRezTech[econ.rez_id][econ.technology].push(econ.effective_lcoe_aud_mwh)
    }
  }
  const chart5Data = REZ_IDS.map(rezId => {
    const windVals = lcoeByRezTech[rezId]?.Wind ?? []
    const solarVals = lcoeByRezTech[rezId]?.Solar ?? []
    return {
      rez: rezId,
      Wind: windVals.length > 0 ? Math.round((windVals.reduce((a, b) => a + b, 0) / windVals.length) * 10) / 10 : 0,
      Solar: solarVals.length > 0 ? Math.round((solarVals.reduce((a, b) => a + b, 0) / solarVals.length) * 10) / 10 : 0,
    }
  })

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wind className="text-blue-400" size={26} />
        <div>
          <h1 className="text-xl font-bold text-white">REZ Capacity Factor Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Renewable Energy Zone capacity factors, hourly profiles, transmission constraints and economics
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Installed Capacity" value={String(summary.total_installed_gw)} unit="GW" />
        <KpiCard label="Avg Wind CF" value={String(summary.avg_wind_cf_pct)} unit="%" sub="All REZs all years" />
        <KpiCard label="Avg Solar CF" value={String(summary.avg_solar_cf_pct)} unit="%" sub="All REZs all years" />
        <KpiCard label="Avg Curtailment" value={String(summary.total_curtailment_pct)} unit="%" sub="Avg across all CFs" />
        <KpiCard label="Best Performing REZ" value={summary.best_performing_rez} sub="Highest avg CF" />
      </div>

      {/* Chart 1: Avg CF by REZ for Wind and Solar */}
      <ChartSection title="Chart 1 — Avg Capacity Factor (%) by REZ — Wind vs Solar (All Years)">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart1Data} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number) => [`${v}%`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Wind" fill={TECH_COLOURS.Wind} radius={[3, 3, 0, 0]} name="Wind CF %" />
            <Bar dataKey="Solar" fill={TECH_COLOURS.Solar} radius={[3, 3, 0, 0]} name="Solar CF %" />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 2: Monthly Wind CF for all REZs (2024) */}
      <ChartSection title="Chart 2 — Monthly Wind Capacity Factor (%) by REZ — 2024">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chart2Data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number) => [`${v}%`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {REZ_IDS.map(rezId => (
              <Line
                key={rezId}
                type="monotone"
                dataKey={rezId}
                stroke={REZ_COLOURS[rezId]}
                strokeWidth={2}
                dot={false}
                name={rezNameMap[rezId] ?? rezId}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 3: Hourly CF pattern for Summer — Wind vs Solar (NSW REZ1) */}
      <ChartSection title="Chart 3 — Avg CF (%) by Hour of Day — Summer, New England REZ (Wind vs Solar)">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart3Data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={2} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number) => [`${v}%`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="Wind"
              stroke={TECH_COLOURS.Wind}
              strokeWidth={2}
              dot={false}
              name="Wind CF %"
            />
            <Line
              type="monotone"
              dataKey="Solar"
              stroke={TECH_COLOURS.Solar}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Solar CF %"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 4: Revenue Foregone by REZ (2024, coloured by dominant constraint cause) */}
      <ChartSection title="Chart 4 — Revenue Foregone (AUD M) by REZ — 2024 (Coloured by Dominant Constraint)">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart4Data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="rez" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number, _name: string, props: { payload?: { constraint_cause?: string } }) => [
                `$${v.toFixed(2)}M`,
                props.payload?.constraint_cause ?? 'Unknown',
              ]}
            />
            <Bar dataKey="revenue_foregone_m" radius={[4, 4, 0, 0]} name="Revenue Foregone (AUD M)">
              {chart4Data.map((entry, idx) => (
                <Cell key={idx} fill={CONSTRAINT_COLOURS[entry.constraint_cause] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 flex-wrap">
          {Object.entries(CONSTRAINT_COLOURS).map(([cause, colour]) => (
            <span key={cause} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: colour }} />
              {cause}
            </span>
          ))}
        </div>
      </ChartSection>

      {/* Chart 5: Effective LCOE by REZ for Wind and Solar (2024, grouped) */}
      <ChartSection title="Chart 5 — Effective LCOE (AUD/MWh) by REZ — Wind vs Solar, 2024">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart5Data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="rez" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $/MWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number) => [`$${v}/MWh`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Wind" fill={TECH_COLOURS.Wind} radius={[3, 3, 0, 0]} name="Wind Effective LCOE" />
            <Bar dataKey="Solar" fill={TECH_COLOURS.Solar} radius={[3, 3, 0, 0]} name="Solar Effective LCOE" />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Summary Grid */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Dashboard Summary</h3>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Installed', value: `${summary.total_installed_gw} GW` },
            { label: 'Avg Wind CF', value: `${summary.avg_wind_cf_pct}%` },
            { label: 'Avg Solar CF', value: `${summary.avg_solar_cf_pct}%` },
            { label: 'Avg Curtailment', value: `${summary.total_curtailment_pct}%` },
            { label: 'Best Performing REZ', value: summary.best_performing_rez },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="text-sm font-semibold text-gray-100 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
