import { useEffect, useState } from 'react'
import { CloudLightning, AlertTriangle, DollarSign, Shield } from 'lucide-react'
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
} from 'recharts'
import {
  getPowerGridClimateResilienceDashboard,
  PGCRDashboard,
  PGCRAssetRiskRecord,
  PGCREventRecord,
} from '../api/client'

// ── KPI Card ────────────────────────────────────────────────────────────────
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
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Severity colour ──────────────────────────────────────────────────────────
function severityBadge(score: number) {
  if (score >= 20) return 'bg-red-600 text-white'
  if (score >= 15) return 'bg-orange-500 text-white'
  if (score >= 10) return 'bg-yellow-500 text-gray-900'
  return 'bg-green-700 text-white'
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function PowerGridClimateResilienceAnalytics() {
  const [data, setData] = useState<PGCRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPowerGridClimateResilienceDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <div className="text-gray-400 animate-pulse text-sm">Loading climate resilience data…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <div className="text-red-400 text-sm">Error: {error ?? 'Unknown error'}</div>
      </div>
    )
  }

  const { asset_risks, events, hazard_projections, adaptations, summary } = data

  // ── Chart 1: Asset risk by hazard type (stacked by exposure) ─────────────
  const hazardMap: Record<string, { Low: number; Medium: number; High: number; 'Very High': number }> = {}
  for (const a of asset_risks) {
    if (!hazardMap[a.climate_hazard]) hazardMap[a.climate_hazard] = { Low: 0, Medium: 0, High: 0, 'Very High': 0 }
    hazardMap[a.climate_hazard][a.hazard_exposure as keyof (typeof hazardMap)[string]]++
  }
  const hazardChartData = Object.entries(hazardMap).map(([hazard, counts]) => ({ hazard, ...counts }))

  // ── Chart 2: Hazard intensity projections by scenario ────────────────────
  const scenarioKeys = ['1.5C', '2C', '3C', '4C']
  const scenarioIntensity: Record<string, { scenario: string; avg_2030: number; avg_2040: number; avg_2050: number }> = {}
  for (const p of hazard_projections) {
    if (!scenarioIntensity[p.climate_scenario]) {
      scenarioIntensity[p.climate_scenario] = { scenario: p.climate_scenario, avg_2030: 0, avg_2040: 0, avg_2050: 0 }
    }
    scenarioIntensity[p.climate_scenario].avg_2030 += p.year_2030_intensity
    scenarioIntensity[p.climate_scenario].avg_2040 += p.year_2040_intensity
    scenarioIntensity[p.climate_scenario].avg_2050 += p.year_2050_intensity
  }
  // Compute average
  const projByScenario = scenarioKeys.map(sc => {
    const count = hazard_projections.filter(p => p.climate_scenario === sc).length || 1
    const d = scenarioIntensity[sc] ?? { scenario: sc, avg_2030: 0, avg_2040: 0, avg_2050: 0 }
    return {
      scenario: sc,
      '2030': parseFloat((d.avg_2030 / count).toFixed(3)),
      '2040': parseFloat((d.avg_2040 / count).toFixed(3)),
      '2050': parseFloat((d.avg_2050 / count).toFixed(3)),
    }
  })

  // ── Chart 3: Climate events by year ──────────────────────────────────────
  const yearMap: Record<string, { year: string; capacity_mw: number; damage_m: number }> = {}
  for (const e of events) {
    const yr = e.event_date.slice(0, 4)
    if (!yearMap[yr]) yearMap[yr] = { year: yr, capacity_mw: 0, damage_m: 0 }
    yearMap[yr].capacity_mw += e.capacity_impacted_mw
    yearMap[yr].damage_m += e.economic_damage_m
  }
  const eventsYearData = Object.values(yearMap).sort((a, b) => a.year.localeCompare(b.year))

  // ── Chart 4: Adaptation cost-benefit ratios ───────────────────────────────
  const adaptChartData = adaptations.map(a => ({
    measure: a.adaptation_measure,
    cost_benefit_ratio: a.cost_benefit_ratio,
    risk_reduction: a.risk_reduction_pct,
    adoption: a.current_adoption_pct,
  }))

  // ── High-risk assets table ────────────────────────────────────────────────
  const highRiskAssets: PGCRAssetRiskRecord[] = [...asset_risks]
    .filter(a => a.current_risk_score >= 15)
    .sort((a, b) => b.current_risk_score - a.current_risk_score)

  // ── Recent events table ───────────────────────────────────────────────────
  const recentEvents: PGCREventRecord[] = [...events]
    .sort((a, b) => b.economic_damage_m - a.economic_damage_m)
    .slice(0, 8)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CloudLightning size={28} className="text-orange-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Power Grid Climate Resilience Analytics</h1>
          <p className="text-sm text-gray-400">Climate risk to power infrastructure &amp; extreme weather impact assessment</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="At-Risk Assets"
          value={String(summary.total_at_risk_assets)}
          sub={`${summary.high_risk_assets_count} high-risk (score ≥ 15)`}
          icon={AlertTriangle}
          colour="bg-red-600"
        />
        <KpiCard
          label="Avg Risk Score"
          value={String(summary.avg_risk_score)}
          sub="Out of 25 max score"
          icon={Shield}
          colour="bg-orange-500"
        />
        <KpiCard
          label="Historical Economic Damage"
          value={`$${Number(summary.total_economic_damage_bn).toFixed(2)}B`}
          sub="Cumulative climate events 2009–2022"
          icon={DollarSign}
          colour="bg-yellow-600"
        />
        <KpiCard
          label="Adaptation Investment Needed"
          value={`$${Number(summary.adaptation_investment_needed_bn).toFixed(1)}B`}
          sub="Estimated total adaptation capex"
          icon={CloudLightning}
          colour="bg-blue-600"
        />
      </div>

      {/* Chart row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1: Asset risk by hazard type stacked by exposure */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Asset Risk by Hazard Type &amp; Exposure Level</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hazardChartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hazard" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} label={{ value: 'Assets', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="Low" stackId="a" fill="#16a34a" />
              <Bar dataKey="Medium" stackId="a" fill="#ca8a04" />
              <Bar dataKey="High" stackId="a" fill="#ea580c" />
              <Bar dataKey="Very High" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Hazard intensity projections by climate scenario */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Average Hazard Intensity Projections to 2050</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={projByScenario} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="scenario" tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: 'Climate Scenario', position: 'insideBottom', offset: -4, fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={['auto', 'auto']} label={{ value: 'Intensity Index', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Line type="monotone" dataKey="2030" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="2040" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="2050" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 3: Climate events impact by year */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Climate Event Impact by Year</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={eventsYearData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Capacity MW', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Damage $M', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar yAxisId="left" dataKey="capacity_mw" name="Capacity Impacted (MW)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="damage_m" name="Economic Damage ($M)" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Adaptation cost-benefit ratios */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Adaptation Measure Cost-Benefit Ratios</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={adaptChartData} layout="vertical" margin={{ top: 4, right: 20, left: 120, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis dataKey="measure" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} width={118} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="cost_benefit_ratio" name="Cost-Benefit Ratio" fill="#22c55e" radius={[0, 4, 4, 0]} />
              <Bar dataKey="risk_reduction" name="Risk Reduction %" fill="#a78bfa" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* High-risk asset table */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">High-Risk Assets (Score &ge; 15)</h2>
          <div className="overflow-auto max-h-72">
            <table className="w-full text-xs text-left">
              <thead className="text-gray-500 border-b border-gray-700">
                <tr>
                  <th className="pb-2 pr-3">Asset</th>
                  <th className="pb-2 pr-3">Hazard</th>
                  <th className="pb-2 pr-3">Exposure</th>
                  <th className="pb-2 pr-3">Score</th>
                  <th className="pb-2">Adaptation</th>
                </tr>
              </thead>
              <tbody>
                {highRiskAssets.map(a => (
                  <tr key={a.risk_id} className="border-b border-gray-700 hover:bg-gray-700/40 transition-colors">
                    <td className="py-2 pr-3 text-gray-200 font-medium max-w-[140px] truncate" title={a.asset_name}>{a.asset_name}</td>
                    <td className="py-2 pr-3 text-gray-300">{a.climate_hazard}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        a.hazard_exposure === 'Very High' ? 'bg-red-700 text-white' :
                        a.hazard_exposure === 'High' ? 'bg-orange-600 text-white' :
                        a.hazard_exposure === 'Medium' ? 'bg-yellow-600 text-gray-900' : 'bg-green-700 text-white'
                      }`}>{a.hazard_exposure}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${severityBadge(a.current_risk_score)}`}>
                        {a.current_risk_score}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400 text-[10px]">{a.adaptation_measure}</td>
                  </tr>
                ))}
                {highRiskAssets.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-gray-500">No high-risk assets</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent climate events table */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Major Climate Events by Economic Damage</h2>
          <div className="overflow-auto max-h-72">
            <table className="w-full text-xs text-left">
              <thead className="text-gray-500 border-b border-gray-700">
                <tr>
                  <th className="pb-2 pr-3">Event</th>
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Damage $M</th>
                  <th className="pb-2">Restore (d)</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map(e => (
                  <tr key={e.event_id} className="border-b border-gray-700 hover:bg-gray-700/40 transition-colors">
                    <td className="py-2 pr-3 text-gray-200 font-medium max-w-[140px] truncate" title={e.event_name}>{e.event_name}</td>
                    <td className="py-2 pr-3 text-gray-400">{e.event_date}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        e.event_type === 'Bushfire' ? 'bg-red-800 text-orange-200' :
                        e.event_type === 'Cyclone' ? 'bg-blue-800 text-blue-200' :
                        e.event_type === 'Flood' ? 'bg-cyan-800 text-cyan-200' :
                        e.event_type === 'Heatwave' ? 'bg-orange-700 text-white' : 'bg-gray-700 text-gray-200'
                      }`}>{e.event_type}</span>
                    </td>
                    <td className="py-2 pr-3 text-red-300 font-semibold">${e.economic_damage_m.toLocaleString()}</td>
                    <td className="py-2 text-gray-400">{e.restoration_time_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
