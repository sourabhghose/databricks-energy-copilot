// ---------------------------------------------------------------------------
// Sprint 54b — NEM Capacity Investment Signals
// ---------------------------------------------------------------------------
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
  Cell,
  ReferenceLine,
} from 'recharts'
import { TrendingUp, DollarSign, BarChart2, AlertTriangle } from 'lucide-react'
import {
  getCapacityInvestmentDashboard,
  type CISNewEntrantRecord,
  type CISInvestmentActivityRecord,
  type CISPriceSignalRecord,
  type CISExitRiskRecord,
  type CapacityInvestmentDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SIGNAL_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  STRONG:       { bg: 'bg-green-700',  text: 'text-green-100',  label: 'STRONG'       },
  ADEQUATE:     { bg: 'bg-yellow-700', text: 'text-yellow-100', label: 'ADEQUATE'     },
  WEAK:         { bg: 'bg-orange-700', text: 'text-orange-100', label: 'WEAK'         },
  INSUFFICIENT: { bg: 'bg-red-800',    text: 'text-red-100',    label: 'INSUFFICIENT' },
}

const TRIGGER_STYLES: Record<string, string> = {
  ECONOMICS:  'bg-red-900 text-red-200',
  AGE:        'bg-orange-900 text-orange-200',
  POLICY:     'bg-blue-900 text-blue-200',
  REGULATION: 'bg-purple-900 text-purple-200',
}

const TECH_COLORS: Record<string, string> = {
  'Utility Solar':  '#facc15',
  'Onshore Wind':   '#34d399',
  'BESS':           '#60a5fa',
  'Gas Peaker':     '#f87171',
  'BESS 2h':        '#60a5fa',
  'OCGT':           '#fb923c',
  'CCGT':           '#a78bfa',
  'Pumped Hydro':   '#22d3ee',
  'Offshore Wind':  '#38bdf8',
  'Green Hydrogen': '#86efac',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiCardProps {
  title: string
  value: string
  sub: string
  Icon: React.FC<{ className?: string }>
  colour: string
}
function KpiCard({ title, value, sub, Icon, colour }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 border border-gray-700">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function CapacityInvestmentSignals() {
  const [data, setData] = useState<CapacityInvestmentDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCapacityInvestmentDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Capacity Investment Signals…
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

  // ---- Derived KPIs --------------------------------------------------------
  const cheapestLcoe = Math.min(...data.new_entrant_costs.map((r) => r.loe_aud_mwh))
  const cheapestTech = data.new_entrant_costs.find((r) => r.loe_aud_mwh === cheapestLcoe)?.technology ?? '-'

  const committed2024 = data.investment_activity
    .filter((r) => r.year === 2024)
    .reduce((s, r) => s + r.committed_mw, 0)

  const strongSignalRegions = Array.from(
    new Set(
      data.price_signals
        .filter((r) => r.revenue_adequacy_signal === 'STRONG')
        .map((r) => r.region)
    )
  ).length

  const exitCapacity = data.exit_risks.reduce((s, r) => s + r.capacity_mw, 0)

  // ---- New entrant cost chart data ----------------------------------------
  const newEntrantChartData = data.new_entrant_costs.map((r) => ({
    name: r.technology,
    CAPEX:         r.capex_m_aud_mw * 20,  // normalise to $/MWh equivalent scale
    'WACC Uplift': r.loe_aud_mwh - r.capex_m_aud_mw * 20,
    LCOE:          r.loe_aud_mwh,
    Breakeven:     r.breakeven_price_aud_mwh,
  }))

  // ---- Investment activity chart data -------------------------------------
  const years = Array.from(new Set(data.investment_activity.map((r) => r.year))).sort()
  const technologies = Array.from(new Set(data.investment_activity.map((r) => r.technology)))

  const investmentChartData = years.map((yr) => {
    const row: Record<string, string | number> = { year: String(yr) }
    technologies.forEach((tech) => {
      const rec = data.investment_activity.find((r) => r.year === yr && r.technology === tech)
      row[`${tech}_committed`] = rec?.committed_mw ?? 0
      row[`${tech}_cancelled`] = rec ? -rec.cancelled_mw : 0
    })
    return row
  })

  // ---- Price signal heatmap data ------------------------------------------
  const regions = Array.from(new Set(data.price_signals.map((r) => r.region))).sort()
  const sigYears = Array.from(new Set(data.price_signals.map((r) => r.year))).sort()

  // Build map: region -> year -> record
  const signalMap: Record<string, Record<number, CISPriceSignalRecord>> = {}
  data.price_signals.forEach((r) => {
    if (!signalMap[r.region]) signalMap[r.region] = {}
    signalMap[r.region][r.year] = r
  })

  // ---- Line chart for average spot price by region over time --------------
  const priceLineData = sigYears.map((yr) => {
    const row: Record<string, string | number> = { year: String(yr) }
    regions.forEach((reg) => {
      row[reg] = signalMap[reg]?.[yr]?.avg_spot_price ?? 0
    })
    return row
  })

  const regionColors: Record<string, string> = {
    NSW1: '#60a5fa',
    VIC1: '#34d399',
    QLD1: '#facc15',
    SA1:  '#f87171',
    TAS1: '#a78bfa',
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingUp className="w-8 h-8 text-green-400" />
        <div>
          <h1 className="text-2xl font-bold">NEM Capacity Investment Signals</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Entry/exit economics, new entrant cost benchmarks &amp; revenue adequacy signals
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Cheapest New Entrant LCOE"
          value={`$${cheapestLcoe.toFixed(0)}/MWh`}
          sub={cheapestTech}
          Icon={DollarSign}
          colour="bg-green-700"
        />
        <KpiCard
          title="Total 2024 Committed Capacity"
          value={`${committed2024.toLocaleString()} MW`}
          sub="All technologies combined"
          Icon={BarChart2}
          colour="bg-blue-700"
        />
        <KpiCard
          title="Regions with STRONG Signal"
          value={String(strongSignalRegions)}
          sub="Revenue adequacy — STRONG"
          Icon={TrendingUp}
          colour="bg-yellow-700"
        />
        <KpiCard
          title="Total Exit Risk Capacity"
          value={`${exitCapacity.toLocaleString()} MW`}
          sub="Across all exit risk units"
          Icon={AlertTriangle}
          colour="bg-red-700"
        />
      </div>

      {/* New Entrant Cost Waterfall */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-1">New Entrant Cost Benchmarks</h2>
        <p className="text-xs text-gray-400 mb-4">
          CAPEX component + WACC uplift stacked to LCOE ($/MWh). Reference line = average breakeven price.
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={newEntrantChartData} margin={{ top: 8, right: 24, left: 8, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/MWh" width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(val: number) => [`$${val.toFixed(1)}/MWh`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 16 }} />
            <ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: '$85 avg breakeven', fill: '#f59e0b', fontSize: 11 }} />
            <Bar dataKey="CAPEX" stackId="lcoe" fill="#60a5fa" radius={[0, 0, 4, 4]} />
            <Bar dataKey="WACC Uplift" stackId="lcoe" fill="#34d399" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Investment Activity Stacked Bar */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-1">Investment Activity — Committed vs Cancelled</h2>
        <p className="text-xs text-gray-400 mb-4">
          Positive bars = committed MW; negative bars = cancelled MW. Grouped by technology per year.
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={investmentChartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" width={72} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(val: number) => [`${val.toFixed(0)} MW`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            <ReferenceLine y={0} stroke="#6b7280" />
            {technologies.map((tech) => (
              <Bar
                key={`${tech}_committed`}
                dataKey={`${tech}_committed`}
                name={`${tech} committed`}
                stackId={`committed_${tech}`}
                fill={TECH_COLORS[tech] ?? '#94a3b8'}
              />
            ))}
            {technologies.map((tech) => (
              <Bar
                key={`${tech}_cancelled`}
                dataKey={`${tech}_cancelled`}
                name={`${tech} cancelled`}
                stackId={`cancelled_${tech}`}
                fill={TECH_COLORS[tech] ?? '#94a3b8'}
                fillOpacity={0.4}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Average spot price trend */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-1">Average Spot Price by Region</h2>
        <p className="text-xs text-gray-400 mb-4">
          Time-weighted average spot price ($/MWh) across NEM regions 2021-2024.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={priceLineData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/MWh" width={72} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(val: number) => [`$${val.toFixed(1)}/MWh`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            <ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: 'LRMC ~$85', fill: '#f59e0b', fontSize: 11 }} />
            {regions.map((reg) => (
              <Line
                key={reg}
                type="monotone"
                dataKey={reg}
                stroke={regionColors[reg] ?? '#94a3b8'}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Price Signal Heatmap Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-1">Revenue Adequacy Signal Heatmap</h2>
        <p className="text-xs text-gray-400 mb-4">
          Colour-coded by signal strength: green = STRONG, yellow = ADEQUATE, orange = WEAK, red = INSUFFICIENT.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Region</th>
                {sigYears.map((yr) => (
                  <th key={yr} className="text-center py-2 px-3 text-gray-400 font-medium">{yr}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regions.map((reg) => (
                <tr key={reg} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 px-3 font-semibold text-gray-200">{reg}</td>
                  {sigYears.map((yr) => {
                    const rec = signalMap[reg]?.[yr]
                    const sig = rec?.revenue_adequacy_signal ?? 'INSUFFICIENT'
                    const style = SIGNAL_STYLES[sig] ?? SIGNAL_STYLES.INSUFFICIENT
                    return (
                      <td key={yr} className="py-2 px-3 text-center">
                        {rec ? (
                          <div className={`inline-flex flex-col items-center rounded-lg px-2 py-1 ${style.bg}`}>
                            <span className={`text-xs font-semibold ${style.text}`}>{style.label}</span>
                            <span className={`text-xs ${style.text} opacity-80`}>${rec.avg_spot_price.toFixed(0)}/MWh</span>
                          </div>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exit Risk Register */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-1">Exit Risk Register</h2>
        <p className="text-xs text-gray-400 mb-4">
          Units with highest probability of exiting the NEM within 5 years, sorted by exit probability.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Unit</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Technology</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Age (yr)</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Remaining (yr)</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Capacity (MW)</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Exit Prob 5yr</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Trigger</th>
              </tr>
            </thead>
            <tbody>
              {[...data.exit_risks]
                .sort((a, b) => b.exit_probability_5yr_pct - a.exit_probability_5yr_pct)
                .map((r) => (
                  <tr key={r.unit_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="py-2 px-3">
                      <div className="font-medium text-gray-100">{r.unit_name}</div>
                      <div className="text-xs text-gray-500">{r.unit_id}</div>
                    </td>
                    <td className="py-2 px-3 text-gray-300">{r.technology}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{r.age_years}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{r.remaining_life_years}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{r.capacity_mw.toFixed(0)}</td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-gray-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              r.exit_probability_5yr_pct >= 80
                                ? 'bg-red-500'
                                : r.exit_probability_5yr_pct >= 50
                                ? 'bg-orange-500'
                                : 'bg-yellow-500'
                            }`}
                            style={{ width: `${Math.min(r.exit_probability_5yr_pct, 100)}%` }}
                          />
                        </div>
                        <span
                          className={`font-semibold ${
                            r.exit_probability_5yr_pct >= 80
                              ? 'text-red-400'
                              : r.exit_probability_5yr_pct >= 50
                              ? 'text-orange-400'
                              : 'text-yellow-400'
                          }`}
                        >
                          {r.exit_probability_5yr_pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          TRIGGER_STYLES[r.exit_trigger] ?? 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {r.exit_trigger}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
