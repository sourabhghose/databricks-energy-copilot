import { useEffect, useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ReferenceLine, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts'
import { TrendingDown, Battery, Zap, Target, AlertCircle, CheckCircle } from 'lucide-react'
import {
  getStorageCostCurvesDashboard,
  STCDashboard,
  STCLearningCurveRecord,
  STCProjectionRecord,
  STCTrlRecord,
  STCComparison2030Record,
} from '../api/client'

// ── Colour palette for technologies ───────────────────────────────────────────
const TECH_COLORS: Record<string, string> = {
  'Li-ion LFP': '#3b82f6',
  'Li-ion NMC': '#06b6d4',
  'Flow Battery (VRFB)': '#8b5cf6',
  'Pumped Hydro': '#10b981',
  'Compressed Air (CAES)': '#f59e0b',
  'Liquid Air (LAES)': '#ec4899',
  'Green H2 (Power-to-Power)': '#ef4444',
  'Thermal Storage (PTES)': '#f97316',
  'Zinc-Air': '#84cc16',
  'Gravity Storage': '#a78bfa',
}

const ALL_TECHS = Object.keys(TECH_COLORS)
const PROJECTION_TECHS = ['Li-ion LFP', 'Flow Battery (VRFB)', 'Pumped Hydro', 'Green H2 (Power-to-Power)', 'Thermal Storage (PTES)']

// ── Badge helpers ──────────────────────────────────────────────────────────────
function TrlBadge({ value }: { value: number }) {
  const color = value >= 8 ? 'bg-green-600 text-green-100' : value >= 6 ? 'bg-yellow-600 text-yellow-100' : 'bg-red-600 text-red-100'
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${color}`}>TRL {value}</span>
}

function ReadinessBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    MATURE: 'bg-green-700 text-green-100',
    COMMERCIAL: 'bg-blue-700 text-blue-100',
    DEMONSTRATION: 'bg-yellow-700 text-yellow-100',
    PILOT: 'bg-orange-700 text-orange-100',
    RESEARCH: 'bg-red-700 text-red-100',
  }
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${map[value] ?? 'bg-gray-600 text-gray-100'}`}>{value}</span>
}

function NemFitBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    EXCELLENT: 'bg-green-600 text-green-100',
    GOOD: 'bg-blue-600 text-blue-100',
    MODERATE: 'bg-yellow-600 text-yellow-100',
    POOR: 'bg-red-600 text-red-100',
  }
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${map[value] ?? 'bg-gray-600 text-gray-100'}`}>{value}</span>
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex items-start gap-4 border border-gray-700">
      <div className="text-blue-400 mt-1">{icon}</div>
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
        <p className="text-white text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-gray-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <h2 className="text-white text-lg font-semibold mb-4">{title}</h2>
      {children}
    </div>
  )
}

// ── Tech Checkbox row ─────────────────────────────────────────────────────────
function TechCheckboxes({
  techs,
  selected,
  onToggle,
}: {
  techs: string[]
  selected: Set<string>
  onToggle: (t: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {techs.map((t) => (
        <button
          key={t}
          onClick={() => onToggle(t)}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors"
          style={{
            borderColor: selected.has(t) ? TECH_COLORS[t] ?? '#6b7280' : '#374151',
            backgroundColor: selected.has(t) ? `${TECH_COLORS[t]}22` : 'transparent',
            color: selected.has(t) ? TECH_COLORS[t] ?? '#fff' : '#9ca3af',
          }}
        >
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: TECH_COLORS[t] ?? '#6b7280' }}
          />
          {t}
        </button>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StorageCostCurvesAnalytics() {
  const [data, setData] = useState<STCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Learning curve controls
  const [lcSelectedTechs, setLcSelectedTechs] = useState<Set<string>>(
    new Set(['Li-ion LFP', 'Flow Battery (VRFB)', 'Pumped Hydro', 'Green H2 (Power-to-Power)', 'Thermal Storage (PTES)'])
  )
  const [logScale, setLogScale] = useState(false)

  // Projection controls
  const [projTech, setProjTech] = useState('Li-ion LFP')

  // Comparison radar controls
  const [radarSelectedTechs, setRadarSelectedTechs] = useState<Set<string>>(
    new Set(['Li-ion LFP (2hr)', 'Flow Battery VRFB (6hr)', 'Pumped Hydro (8hr)', 'Thermal PTES (10hr)'])
  )

  useEffect(() => {
    getStorageCostCurvesDashboard()
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [])

  // ── Learning curve chart data ───────────────────────────────────────────────
  const lcChartData = useMemo(() => {
    if (!data) return []
    const byYear: Record<number, Record<string, number>> = {}
    data.learning_curves
      .filter((r: STCLearningCurveRecord) => lcSelectedTechs.has(r.technology))
      .forEach((r: STCLearningCurveRecord) => {
        if (!byYear[r.year]) byYear[r.year] = { year: r.year }
        byYear[r.year][r.technology] = r.capex_per_kwh
      })
    return Object.values(byYear).sort((a, b) => (a.year as number) - (b.year as number))
  }, [data, lcSelectedTechs])

  // ── Projection chart data ───────────────────────────────────────────────────
  const projChartData = useMemo(() => {
    if (!data) return []
    const byYear: Record<number, Record<string, number>> = {}
    data.projections
      .filter((r: STCProjectionRecord) => r.technology === projTech)
      .forEach((r: STCProjectionRecord) => {
        if (!byYear[r.year]) byYear[r.year] = { year: r.year }
        byYear[r.year][`${r.scenario}_mid`] = r.capex_per_kwh_mid
        byYear[r.year][`${r.scenario}_low`] = r.capex_per_kwh_low
        byYear[r.year][`${r.scenario}_high`] = r.capex_per_kwh_high
        byYear[r.year][`${r.scenario}_band`] = r.capex_per_kwh_high - r.capex_per_kwh_low
      })
    return Object.values(byYear).sort((a, b) => (a.year as number) - (b.year as number))
  }, [data, projTech])

  // ── Radar chart data ────────────────────────────────────────────────────────
  const radarAxes = ['CAPEX/kWh (inv)', 'RTE (%)', 'Cycle Life (k)', 'Duration (hr)', 'LCOES (inv)']

  const radarData = useMemo(() => {
    if (!data) return []
    return radarAxes.map((axis) => {
      const entry: Record<string, unknown> = { axis }
      data.comparison_2030
        .filter((r: STCComparison2030Record) => radarSelectedTechs.has(r.technology))
        .forEach((r: STCComparison2030Record) => {
          if (axis === 'CAPEX/kWh (inv)') entry[r.technology] = Math.max(0, 100 - r.capex_per_kwh / 3)
          if (axis === 'RTE (%)') entry[r.technology] = r.rte_pct
          if (axis === 'Cycle Life (k)') entry[r.technology] = Math.min(100, r.cycle_life / 500)
          if (axis === 'Duration (hr)') entry[r.technology] = Math.min(100, r.duration_hr * 2)
          if (axis === 'LCOES (inv)') entry[r.technology] = Math.max(0, 100 - r.lcoes_per_mwh / 2)
        })
      return entry
    })
  }, [data, radarSelectedTechs])

  const comparison2030Techs = useMemo(() => {
    if (!data) return []
    return data.comparison_2030.map((r: STCComparison2030Record) => r.technology)
  }, [data])

  function toggleLcTech(t: string) {
    setLcSelectedTechs((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  function toggleRadarTech(t: string) {
    setRadarSelectedTechs((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-lg animate-pulse">Loading storage cost curve data...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle className="w-6 h-6" />
          <p>{error ?? 'No data available'}</p>
        </div>
      </div>
    )
  }

  const summary = data.summary as Record<string, string | number>

  return (
    <div className="min-h-screen bg-gray-900 text-white px-4 py-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg">
          <TrendingDown className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Energy Storage Technology Cost Curves</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            NEM storage learning curves, cost trajectory projections, and technology readiness tracking
          </p>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Technologies Tracked"
          value={String(summary.technologies_tracked ?? 10)}
          sub="across all storage types"
          icon={<Battery className="w-5 h-5" />}
        />
        <KpiCard
          label="Mature Technologies"
          value={String(summary.mature_technologies ?? 2)}
          sub="TRL 9 & commercially deployed"
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <KpiCard
          label="Lowest 2030 LCOES"
          value="$45/MWh"
          sub={String(summary.lowest_2030_lcoes_tech ?? 'Thermal PTES')}
          icon={<TrendingDown className="w-5 h-5" />}
        />
        <KpiCard
          label="Highest Learning Rate"
          value="20%"
          sub={String(summary.highest_learning_rate_tech ?? 'Green H2')}
          icon={<Zap className="w-5 h-5" />}
        />
      </div>

      {/* ── Learning Curve Chart ─────────────────────────────────────────────── */}
      <Section title="Technology Learning Curves — CAPEX/kWh (2020–2030)">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <TechCheckboxes techs={ALL_TECHS} selected={lcSelectedTechs} onToggle={toggleLcTech} />
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={logScale}
              onChange={(e) => setLogScale(e.target.checked)}
              className="accent-blue-500"
            />
            Log scale
          </label>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={lcChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 12 }}
              scale={logScale ? 'log' : 'auto'}
              domain={logScale ? ['auto', 'auto'] : [0, 'auto']}
              label={{ value: '$/kWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`$${val}/kWh`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {[...lcSelectedTechs].map((tech) => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                stroke={TECH_COLORS[tech] ?? '#6b7280'}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Section>

      {/* ── Cost Projection Chart ────────────────────────────────────────────── */}
      <Section title="Cost Projection Scenarios (2025–2035)">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-gray-400 text-sm">Technology:</span>
          <div className="flex gap-2 flex-wrap">
            {PROJECTION_TECHS.map((t) => (
              <button
                key={t}
                onClick={() => setProjTech(t)}
                className="px-3 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: projTech === t ? TECH_COLORS[t] ?? '#3b82f6' : '#374151',
                  color: '#fff',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={projChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 12 }}
              label={{ value: '$/kWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number, name: string) => [`$${val}/kWh`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <ReferenceLine
              y={100}
              stroke="#22c55e"
              strokeDasharray="6 3"
              label={{ value: '$100/kWh competitive threshold', fill: '#22c55e', fontSize: 11, position: 'right' }}
            />
            <Area
              type="monotone"
              dataKey="BASE_high"
              stroke="transparent"
              fill="url(#baseGrad)"
              name="BASE high"
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="BASE_low"
              stroke="transparent"
              fill="#1f2937"
              name="BASE low"
              legendType="none"
            />
            <Line type="monotone" dataKey="BASE_mid" stroke="#3b82f6" strokeWidth={2.5} name="BASE" dot={{ r: 4 }} />
            <Line type="monotone" dataKey="FAST_LEARNING_mid" stroke="#22c55e" strokeWidth={2} strokeDasharray="6 3" name="FAST LEARNING" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="SLOW_LEARNING_mid" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" name="SLOW LEARNING" dot={{ r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      {/* ── TRL & Maturity Table ─────────────────────────────────────────────── */}
      <Section title="Technology Readiness Level (TRL) & Maturity Tracker">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Technology</th>
                <th className="text-center pb-2 pr-4">TRL Now</th>
                <th className="text-center pb-2 pr-4">TRL 2030</th>
                <th className="text-left pb-2 pr-4">Readiness</th>
                <th className="text-left pb-2 pr-4">Key Barrier</th>
                <th className="text-right pb-2 pr-4">Cost Red. (%)</th>
                <th className="text-right pb-2 pr-4">AU Installs</th>
                <th className="text-right pb-2 pr-4">Global (GW)</th>
                <th className="text-left pb-2">Major Developers</th>
              </tr>
            </thead>
            <tbody>
              {data.trl_records.map((r: STCTrlRecord) => (
                <tr key={r.technology} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 text-white font-medium">{r.technology}</td>
                  <td className="py-2 pr-4 text-center">
                    <TrlBadge value={r.trl_current} />
                  </td>
                  <td className="py-2 pr-4 text-center">
                    <TrlBadge value={r.trl_2030} />
                  </td>
                  <td className="py-2 pr-4">
                    <ReadinessBadge value={r.commercial_readiness} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300 max-w-xs text-xs">{r.key_barrier}</td>
                  <td className="py-2 pr-4 text-right text-green-400 font-semibold">{r.cost_reduction_potential_pct}%</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{r.australia_installations}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{r.global_installed_gw}</td>
                  <td className="py-2 text-gray-400 text-xs">{r.major_developers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── 2030 Technology Comparison ───────────────────────────────────────── */}
      <Section title="2030 Technology Comparison — Radar & NEM Fit">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Radar chart */}
          <div>
            <p className="text-gray-400 text-xs mb-3">Select technologies to overlay on radar chart:</p>
            <TechCheckboxes
              techs={comparison2030Techs}
              selected={radarSelectedTechs}
              onToggle={toggleRadarTech}
            />
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                {[...radarSelectedTechs].map((tech) => {
                  const color = TECH_COLORS[tech.replace(' (2hr)', '').replace(' (4hr)', '').replace(' (6hr)', '').replace(' (8hr)', '').replace(' (10hr)', '').replace(' (48hr)', '').replace('Flow Battery VRFB', 'Flow Battery (VRFB)').replace('Pumped Hydro', 'Pumped Hydro').replace('Thermal PTES', 'Thermal Storage (PTES)').replace('LAES', 'Liquid Air (LAES)').replace('Gravity', 'Gravity Storage')] ?? '#6b7280'
                  return (
                    <Radar
                      key={tech}
                      name={tech}
                      dataKey={tech}
                      stroke={color}
                      fill={color}
                      fillOpacity={0.15}
                    />
                  )
                })}
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left pb-2 pr-3">Technology</th>
                  <th className="text-right pb-2 pr-3">Dur (hr)</th>
                  <th className="text-right pb-2 pr-3">CAPEX/kWh</th>
                  <th className="text-right pb-2 pr-3">LCOES</th>
                  <th className="text-right pb-2 pr-3">RTE %</th>
                  <th className="text-right pb-2 pr-3">Cycles (k)</th>
                  <th className="text-left pb-2 pr-3">Best Use</th>
                  <th className="text-center pb-2">NEM Fit</th>
                </tr>
              </thead>
              <tbody>
                {data.comparison_2030.map((r: STCComparison2030Record) => (
                  <tr key={r.technology} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="py-2 pr-3 text-white font-medium text-xs">{r.technology}</td>
                    <td className="py-2 pr-3 text-right text-gray-300">{r.duration_hr}</td>
                    <td className="py-2 pr-3 text-right text-blue-300">${r.capex_per_kwh}</td>
                    <td className="py-2 pr-3 text-right text-purple-300">${r.lcoes_per_mwh}/MWh</td>
                    <td className="py-2 pr-3 text-right text-green-400">{r.rte_pct}%</td>
                    <td className="py-2 pr-3 text-right text-gray-300">{(r.cycle_life / 1000).toFixed(0)}k</td>
                    <td className="py-2 pr-3 text-gray-400 text-xs max-w-xs">{r.best_use_case}</td>
                    <td className="py-2 text-center">
                      <NemFitBadge value={r.nem_fit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ── Footer note ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 text-gray-500 text-xs pb-4">
        <Target className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          Cost data is modelled from published learning rates and global deployment trajectories. LCOES = Levelised Cost of
          Energy Storage. TRL scale: 1 (concept) to 9 (fully commercial). NEM Fit rating reflects suitability for
          Australian National Electricity Market conditions including FCAS, arbitrage, and capacity requirements.
        </p>
      </div>
    </div>
  )
}
