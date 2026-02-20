// ---------------------------------------------------------------------------
// Sprint 53a — Energy Market Stress Testing Analytics
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { ShieldAlert, AlertTriangle, Zap, TrendingUp } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types (mirrors backend Pydantic models)
// ---------------------------------------------------------------------------
interface MarketStressScenario {
  scenario_id: string
  name: string
  description: string
  trigger_event: string
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'EXTREME'
  probability_pct: number
  duration_days: number
}

interface StressTestResult {
  scenario_id: string
  region: string
  metric: 'PRICE' | 'AVAILABILITY' | 'RELIABILITY' | 'REVENUE'
  baseline_value: number
  stressed_value: number
  impact_pct: number
  recovery_days: number
}

interface SystemVulnerabilityRecord {
  component: string
  vulnerability_score: number
  single_point_of_failure: boolean
  mitigation_status: string
}

interface StressTestKpiRecord {
  scenario: string
  avg_price_spike_pct: number
  max_price_aud_mwh: number
  unserved_energy_mwh: number
  affected_consumers_k: number
  economic_cost_m_aud: number
}

interface MarketStressDashboard {
  timestamp: string
  scenarios: MarketStressScenario[]
  results: StressTestResult[]
  vulnerabilities: SystemVulnerabilityRecord[]
  kpis: StressTestKpiRecord[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SEVERITY_STYLES: Record<string, string> = {
  MILD:     'bg-green-900/60 text-green-300 border border-green-700',
  MODERATE: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
  SEVERE:   'bg-orange-900/60 text-orange-300 border border-orange-700',
  EXTREME:  'bg-red-900/60 text-red-300 border border-red-700',
}

const VULNERABILITY_COLOR = (score: number): string => {
  if (score >= 75) return 'bg-red-900/60 text-red-300'
  if (score >= 60) return 'bg-orange-900/60 text-orange-300'
  if (score >= 45) return 'bg-yellow-900/60 text-yellow-300'
  return 'bg-green-900/60 text-green-300'
}

const COMPONENT_LABELS: Record<string, string> = {
  SOLAR_GENERATION: 'Solar Generation',
  WIND_GENERATION:  'Wind Generation',
  GAS_SUPPLY:       'Gas Supply',
  INTERCONNECTOR:   'Interconnectors',
  DEMAND:           'Demand Response',
  STORAGE:          'Storage / BESS',
}

const BAR_COLORS = [
  '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
  '#10b981', '#f97316', '#3b82f6', '#ec4899',
]

// Abbreviated scenario names for bar chart x-axis labels
const SHORT_SCENARIO: Record<string, string> = {
  'Heatwave Demand Surge':           'Heatwave',
  'Gas Supply Disruption':           'Gas Supply',
  'Basslink Cable Trip':             'Basslink',
  'Cyber Attack on SCADA':           'Cyber',
  'Extreme Wind Drought':            'Wind Drought',
  'Solar Eclipse Event':             'Eclipse',
  'Major Generator Failure':         'Gen Failure',
  'Combined Heatwave + Wind Drought':'Compound',
}

function fmt(n: number, decimals = 1): string {
  return n.toLocaleString('en-AU', { maximumFractionDigits: decimals })
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent: string
}

function KpiCard({ icon, label, value, sub, accent }: KpiCardProps) {
  return (
    <div className={`bg-gray-800 rounded-xl p-5 border-l-4 ${accent} flex flex-col gap-2`}>
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold text-white leading-tight">{value}</p>
      <p className="text-xs text-gray-400 leading-snug">{sub}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function MarketStressTesting() {
  const [dashboard, setDashboard] = useState<MarketStressDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/market-stress/dashboard', {
      headers: { Accept: 'application/json' },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<MarketStressDashboard>
      })
      .then(data => { setDashboard(data); setLoading(false) })
      .catch(err => { setError(String(err)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <span className="animate-pulse text-lg">Loading stress test data...</span>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertTriangle className="mr-2" size={20} />
        <span>Failed to load: {error ?? 'No data'}</span>
      </div>
    )
  }

  // ---- Derived data --------------------------------------------------------

  // Worst-case KPI record by economic cost
  const worstKpi = [...dashboard.kpis].sort(
    (a, b) => b.economic_cost_m_aud - a.economic_cost_m_aud,
  )[0]

  // Max price spike scenario
  const maxSpikeKpi = [...dashboard.kpis].sort(
    (a, b) => b.avg_price_spike_pct - a.avg_price_spike_pct,
  )[0]

  // Most vulnerable component
  const mostVulnerable = [...dashboard.vulnerabilities].sort(
    (a, b) => b.vulnerability_score - a.vulnerability_score,
  )[0]

  // Total max unserved energy
  const maxUnserved = Math.max(...dashboard.kpis.map(k => k.unserved_energy_mwh))

  // Radar chart data — vulnerability scores per component
  const radarData = dashboard.vulnerabilities.map(v => ({
    subject: COMPONENT_LABELS[v.component] ?? v.component,
    score: v.vulnerability_score,
    fullMark: 100,
  }))

  // Bar chart data — price spike % and economic cost by scenario
  const barData = dashboard.kpis.map(k => ({
    name:        SHORT_SCENARIO[k.scenario] ?? k.scenario,
    fullName:    k.scenario,
    priceSpikeK: Math.round(k.avg_price_spike_pct / 100) / 10, // convert pct → k-pct for readability
    costMAud:    k.economic_cost_m_aud,
    unservedGWh: Math.round(k.unserved_energy_mwh / 1000),
  }))

  // ---- Render --------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 bg-red-900/40 rounded-xl border border-red-800">
          <ShieldAlert className="text-red-400" size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Energy Market Stress Testing
          </h1>
          <p className="text-gray-400 mt-1 max-w-3xl text-sm leading-relaxed">
            Scenario-based stress analysis of the National Electricity Market (NEM).
            Eight adversarial scenarios are simulated across all five NEM regions,
            evaluating price impacts, generation availability, system reliability,
            and component vulnerabilities to support AEMO operational resilience
            planning and prudent risk management.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Data as at{' '}
            {new Date(dashboard.timestamp).toLocaleString('en-AU', {
              dateStyle: 'medium', timeStyle: 'short',
            })}{' '}
            AEST
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp size={16} />}
          label="Worst-Case Price Spike"
          value={`+${fmt(maxSpikeKpi.avg_price_spike_pct, 0)}%`}
          sub={`${maxSpikeKpi.scenario} — max spot ${fmt(maxSpikeKpi.max_price_aud_mwh, 0)} AUD/MWh`}
          accent="border-red-500"
        />
        <KpiCard
          icon={<Zap size={16} />}
          label="Max Unserved Energy"
          value={`${fmt(maxUnserved / 1000, 0)} GWh`}
          sub={`${dashboard.kpis.find(k => k.unserved_energy_mwh === maxUnserved)?.scenario ?? ''}`}
          accent="border-orange-500"
        />
        <KpiCard
          icon={<AlertTriangle size={16} />}
          label="Most Vulnerable Component"
          value={COMPONENT_LABELS[mostVulnerable.component] ?? mostVulnerable.component}
          sub={`Vulnerability score ${mostVulnerable.vulnerability_score}/100${mostVulnerable.single_point_of_failure ? ' — Single point of failure' : ''}`}
          accent="border-yellow-500"
        />
        <KpiCard
          icon={<ShieldAlert size={16} />}
          label="Highest Economic Cost"
          value={`$${fmt(worstKpi.economic_cost_m_aud, 0)}M`}
          sub={`${worstKpi.scenario} — ${fmt(worstKpi.affected_consumers_k, 0)}k consumers affected`}
          accent="border-purple-500"
        />
      </div>

      {/* Main grid: Scenario Matrix + Radar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Scenario Severity Matrix */}
        <div className="xl:col-span-2 bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-400" />
            Scenario Severity Matrix
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700">
                  <th className="text-left pb-3 pr-4 font-medium">Scenario</th>
                  <th className="text-center pb-3 px-3 font-medium">Severity</th>
                  <th className="text-right pb-3 px-3 font-medium">Prob. %</th>
                  <th className="text-right pb-3 px-3 font-medium">Days</th>
                  <th className="text-left pb-3 pl-4 font-medium hidden lg:table-cell">Trigger Event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {dashboard.scenarios.map(sc => (
                  <tr key={sc.scenario_id} className="hover:bg-gray-750/30 transition-colors">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-white text-xs">{sc.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5 leading-snug hidden sm:block max-w-xs truncate">
                        {sc.description}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${SEVERITY_STYLES[sc.severity]}`}>
                        {sc.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-gray-300 text-xs">
                      {sc.probability_pct.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-gray-300 text-xs">
                      {sc.duration_days}d
                    </td>
                    <td className="py-3 pl-4 text-gray-400 text-xs leading-snug hidden lg:table-cell max-w-xs">
                      <span className="line-clamp-2">{sc.trigger_event}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Radar Chart — System Vulnerability */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-400" />
            System Vulnerability Profile
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: '#6b7280', fontSize: 10 }}
              />
              <Radar
                name="Vulnerability Score"
                dataKey="score"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
                itemStyle={{ color: '#f87171' }}
                formatter={(val: number) => [`${val}/100`, 'Vulnerability Score']}
              />
            </RadarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 text-center mt-2">
            Score 0 (resilient) → 100 (critical vulnerability)
          </p>
        </div>
      </div>

      {/* Stacked / Grouped Bar Chart — Stress Test Impacts */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <TrendingUp size={16} className="text-amber-400" />
          Stress Test Impact Comparison — All Scenarios
        </h2>
        <p className="text-xs text-gray-500 mb-5">
          Economic cost (M AUD) and unserved energy (GWh) per scenario. Price spike expressed as average % above baseline.
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={barData} margin={{ top: 5, right: 30, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              yAxisId="cost"
              orientation="left"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Cost (M AUD)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11, dy: 50 }}
            />
            <YAxis
              yAxisId="energy"
              orientation="right"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Unserved Energy (GWh)', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 11, dy: -60 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(val: number, name: string) => {
                if (name === 'Economic Cost (M AUD)') return [`$${fmt(val, 0)}M`, name]
                if (name === 'Unserved Energy (GWh)') return [`${fmt(val, 0)} GWh`, name]
                return [val, name]
              }}
            />
            <Legend
              wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }}
            />
            <Bar yAxisId="cost" dataKey="costMAud" name="Economic Cost (M AUD)" radius={[3, 3, 0, 0]}>
              {barData.map((_entry, index) => (
                <Cell key={`cost-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
            <Bar yAxisId="energy" dataKey="unservedGWh" name="Unserved Energy (GWh)" fill="#6b7280" opacity={0.7} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Vulnerability Heatmap Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <ShieldAlert size={16} className="text-orange-400" />
          Component Vulnerability Heatmap
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700">
                <th className="text-left pb-3 pr-6 font-medium">Component</th>
                <th className="text-center pb-3 px-4 font-medium">Vulnerability Score</th>
                <th className="text-center pb-3 px-4 font-medium">Single Point of Failure</th>
                <th className="text-left pb-3 pl-4 font-medium">Mitigation Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {[...dashboard.vulnerabilities]
                .sort((a, b) => b.vulnerability_score - a.vulnerability_score)
                .map(v => (
                <tr key={v.component} className="hover:bg-gray-750/30 transition-colors">
                  <td className="py-3 pr-6 font-medium text-white text-sm">
                    {COMPONENT_LABELS[v.component] ?? v.component}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-3">
                      {/* Score bar */}
                      <div className="w-28 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            v.vulnerability_score >= 75 ? 'bg-red-500' :
                            v.vulnerability_score >= 60 ? 'bg-orange-500' :
                            v.vulnerability_score >= 45 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${v.vulnerability_score}%` }}
                        />
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold tabular-nums ${VULNERABILITY_COLOR(v.vulnerability_score)}`}>
                        {v.vulnerability_score.toFixed(0)}/100
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {v.single_point_of_failure ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-900/60 text-red-300 border border-red-700">
                        <AlertTriangle size={12} /> Yes
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-900/40 text-green-400 border border-green-800">
                        No
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-4 text-gray-400 text-xs leading-snug max-w-sm">
                    {v.mitigation_status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stress Test Results Detail Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Zap size={16} className="text-cyan-400" />
          Stress Test Results — Baseline vs Stressed by Region
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700">
                <th className="text-left pb-3 pr-4 font-medium">Scenario</th>
                <th className="text-left pb-3 px-3 font-medium">Region</th>
                <th className="text-left pb-3 px-3 font-medium">Metric</th>
                <th className="text-right pb-3 px-3 font-medium">Baseline</th>
                <th className="text-right pb-3 px-3 font-medium">Stressed</th>
                <th className="text-right pb-3 px-3 font-medium">Impact</th>
                <th className="text-right pb-3 pl-4 font-medium">Recovery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {dashboard.results.map((r, i) => {
                const scenario = dashboard.scenarios.find(s => s.scenario_id === r.scenario_id)
                const isNegative = r.impact_pct < 0
                const isPositiveSpike = r.impact_pct > 100
                return (
                  <tr key={i} className="hover:bg-gray-750/30 transition-colors">
                    <td className="py-2.5 pr-4 text-gray-300 text-xs font-medium">
                      {scenario?.name ?? r.scenario_id}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded text-xs font-mono">
                        {r.region}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 text-xs">{r.metric}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-300 text-xs">
                      {r.metric === 'PRICE'
                        ? `$${fmt(r.baseline_value, 2)}`
                        : r.metric === 'RELIABILITY'
                        ? `${r.baseline_value.toFixed(2)}%`
                        : `${fmt(r.baseline_value, 0)} MW`
                      }
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs">
                      <span className={isPositiveSpike ? 'text-red-400' : isNegative ? 'text-orange-400' : 'text-gray-300'}>
                        {r.metric === 'PRICE'
                          ? `$${fmt(r.stressed_value, 0)}`
                          : r.metric === 'RELIABILITY'
                          ? `${r.stressed_value.toFixed(2)}%`
                          : `${fmt(r.stressed_value, 0)} MW`
                        }
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs">
                      <span className={
                        r.impact_pct > 1000 ? 'text-red-400 font-bold' :
                        r.impact_pct > 0    ? 'text-orange-400' :
                        'text-yellow-400'
                      }>
                        {r.impact_pct > 0 ? '+' : ''}{fmt(r.impact_pct, 1)}%
                      </span>
                    </td>
                    <td className="py-2.5 pl-4 text-right text-gray-400 text-xs">
                      {r.recovery_days}d
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
