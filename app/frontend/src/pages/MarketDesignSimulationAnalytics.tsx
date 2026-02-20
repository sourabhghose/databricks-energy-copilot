import { useEffect, useState } from 'react'
import {
  LineChart, Line,
  BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { BarChart2 } from 'lucide-react'
import {
  getMarketDesignSimulationDashboard,
  MDSDashboard,
  MDSScenarioRecord,
  MDSEquilibriumRecord,
  MDSMonteCarloRecord,
  MDSAgentBehaviourRecord,
  MDSDesignOutcomeRecord,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const DESIGN_COLOURS: Record<string, string> = {
  CURRENT_NEM:    '#6b7280',
  TWO_SIDED:      '#60a5fa',
  CAPACITY_MARKET:'#f97316',
  ENERGY_ONLY_V2: '#facc15',
  LMP:            '#4ade80',
}

const DESIGN_BADGE: Record<string, string> = {
  CURRENT_NEM:    'bg-gray-700 text-gray-200',
  TWO_SIDED:      'bg-blue-800 text-blue-200',
  CAPACITY_MARKET:'bg-orange-800 text-orange-200',
  ENERGY_ONLY_V2: 'bg-yellow-800 text-yellow-200',
  LMP:            'bg-green-800 text-green-200',
}

const CONFIDENCE_BADGE: Record<string, string> = {
  HIGH:   'bg-green-800 text-green-200',
  MEDIUM: 'bg-yellow-800 text-yellow-200',
  LOW:    'bg-red-800 text-red-200',
}

const AGENT_TYPE_BADGE: Record<string, string> = {
  GENERATOR:  'bg-orange-800 text-orange-200',
  RETAILER:   'bg-blue-800 text-blue-200',
  CONSUMER:   'bg-teal-800 text-teal-200',
  STORAGE:    'bg-purple-800 text-purple-200',
  AGGREGATOR: 'bg-pink-800 text-pink-200',
}

const STRATEGY_BADGE: Record<string, string> = {
  COMPETITIVE:          'bg-green-800 text-green-200',
  OLIGOPOLY:            'bg-red-800 text-red-200',
  STRATEGIC_WITHHOLDING:'bg-yellow-800 text-yellow-200',
  PRICE_TAKER:          'bg-gray-700 text-gray-200',
  ADAPTIVE:             'bg-indigo-800 text-indigo-200',
}

const PERCENTILE_COLOURS: Record<number, string> = {
  5:  '#ef4444',
  25: '#f97316',
  50: '#60a5fa',
  75: '#a78bfa',
  95: '#4ade80',
}

const DESIGNS = ['CURRENT_NEM', 'TWO_SIDED', 'CAPACITY_MARKET', 'ENERGY_ONLY_V2', 'LMP']
const METRICS = ['EFFICIENCY', 'ADEQUACY', 'EQUITY', 'INVESTMENT', 'EMISSIONS']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}

function KpiCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{title}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ─── Build radar chart data ────────────────────────────────────────────────────
function buildRadarData(designOutcomes: MDSDesignOutcomeRecord[]) {
  return METRICS.map((metric) => {
    const row: Record<string, string | number> = { metric }
    for (const design of DESIGNS) {
      const found = designOutcomes.find((d) => d.design === design && d.metric === metric)
      row[design] = found ? found.score : 0
    }
    return row
  })
}

// ─── Build equilibrium price line data ────────────────────────────────────────
function buildEquilibriumLineData(equilibria: MDSEquilibriumRecord[]) {
  const years = [2025, 2028, 2030, 2035, 2040]
  return years.map((yr) => {
    const row: Record<string, string | number> = { year: yr }
    for (const design of DESIGNS) {
      const rows = equilibria.filter((e) => e.year === yr && e.scenario_id === scenarioIdForDesign(design))
      if (rows.length > 0) {
        row[design] = Math.round(
          rows.reduce((sum, r) => sum + r.equilibrium_price_aud_mwh, 0) / rows.length
        )
      }
    }
    return row
  })
}

function scenarioIdForDesign(design: string): string {
  const map: Record<string, string> = {
    CURRENT_NEM:    'SIM-001',
    TWO_SIDED:      'SIM-002',
    CAPACITY_MARKET:'SIM-003',
    ENERGY_ONLY_V2: 'SIM-004',
    LMP:            'SIM-005',
  }
  return map[design] ?? 'SIM-001'
}

// ─── Build Monte Carlo fan data (CURRENT_NEM & TWO_SIDED, NSW1) ───────────────
function buildMonteCarloData(monteCarlo: MDSMonteCarloRecord[], scenarioId: string) {
  const years = [2025, 2030, 2035]
  const region = 'NSW1'
  return years.map((yr) => {
    const row: Record<string, string | number> = { year: yr }
    for (const pct of [5, 25, 50, 75, 95]) {
      const found = monteCarlo.find(
        (m) => m.scenario_id === scenarioId && m.region === region && m.year === yr && m.percentile === pct
      )
      row[`p${pct}`] = found ? found.price_aud_mwh : 0
    }
    return row
  })
}

// ─── Main page component ──────────────────────────────────────────────────────
export default function MarketDesignSimulationAnalytics() {
  const [data, setData] = useState<MDSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMarketDesignSimulationDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Market Design Simulation data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data'}
      </div>
    )
  }

  const { scenarios, equilibria, monte_carlo, agent_behaviours, design_outcomes, summary } = data

  const radarData = buildRadarData(design_outcomes)
  const equilibriumLineData = buildEquilibriumLineData(equilibria)
  const mcCurrentNem = buildMonteCarloData(monte_carlo, 'SIM-001')
  const mcTwoSided  = buildMonteCarloData(monte_carlo, 'SIM-002')

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-gray-100">

      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart2 className="text-blue-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">Market Design Simulation Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Agent-based modelling, Monte Carlo price simulations and market equilibrium analysis — Australian NEM
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Total Scenarios"
          value={String(summary.total_scenarios ?? scenarios.length)}
          sub={`${summary.simulation_runs_per_scenario ?? 500} Monte Carlo runs each`}
        />
        <KpiCard
          title="Best Efficiency Design"
          value={String(summary.best_efficiency_design ?? '—')}
          sub="Highest efficiency score"
        />
        <KpiCard
          title="Best Adequacy Design"
          value={String(summary.best_adequacy_design ?? '—')}
          sub="Highest reliability score"
        />
        <KpiCard
          title="Best Overall Design"
          value={String(summary.best_overall_design ?? '—')}
          sub="Balanced across all metrics"
        />
      </div>

      {/* Scenario Summary Table */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Simulation Scenarios</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-700">
                <th className="text-left pb-2 pr-4">ID</th>
                <th className="text-left pb-2 pr-4">Name</th>
                <th className="text-left pb-2 pr-4">Market Design</th>
                <th className="text-left pb-2 pr-4">Description</th>
                <th className="text-right pb-2 pr-4">Runs</th>
                <th className="text-right pb-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s: MDSScenarioRecord) => (
                <tr key={s.scenario_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-mono text-xs text-gray-300">{s.scenario_id}</td>
                  <td className="py-2 pr-4 text-white font-medium">{s.name}</td>
                  <td className="py-2 pr-4">
                    <Badge label={s.market_design} className={DESIGN_BADGE[s.market_design] ?? 'bg-gray-700 text-gray-200'} />
                  </td>
                  <td className="py-2 pr-4 text-gray-400 text-xs max-w-xs">{s.description}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{s.simulation_runs.toLocaleString()}</td>
                  <td className="py-2 text-right text-gray-300">{s.confidence_level_pct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Design Outcomes Radar Chart */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Market Design Performance Scores (Radar)</h2>
        <p className="text-xs text-gray-400 mb-3">Score 1–10 across Efficiency, Adequacy, Equity, Investment, Emissions</p>
        <ResponsiveContainer width="100%" height={380}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#6b7280', fontSize: 10 }} />
            {DESIGNS.map((design) => (
              <Radar
                key={design}
                name={design}
                dataKey={design}
                stroke={DESIGN_COLOURS[design]}
                fill={DESIGN_COLOURS[design]}
                fillOpacity={0.08}
              />
            ))}
            <Legend formatter={(v) => <span style={{ color: DESIGN_COLOURS[v] ?? '#9ca3af', fontSize: 11 }}>{v}</span>} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Equilibrium Price Line Chart */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Equilibrium Price Trajectory by Market Design (AUD/MWh)</h2>
        <p className="text-xs text-gray-400 mb-3">Average equilibrium price across NSW1, QLD1, VIC1 regions</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={equilibriumLineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/MWh" width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend formatter={(v) => <span style={{ color: DESIGN_COLOURS[v] ?? '#9ca3af', fontSize: 11 }}>{v}</span>} />
            {DESIGNS.map((design) => (
              <Line
                key={design}
                type="monotone"
                dataKey={design}
                stroke={DESIGN_COLOURS[design]}
                strokeWidth={2}
                dot={{ r: 3, fill: DESIGN_COLOURS[design] }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Monte Carlo Fan Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'CURRENT_NEM — Monte Carlo Price Fan (NSW1)', mcData: mcCurrentNem, colour: DESIGN_COLOURS['CURRENT_NEM'] },
          { label: 'TWO_SIDED — Monte Carlo Price Fan (NSW1)',    mcData: mcTwoSided,   colour: DESIGN_COLOURS['TWO_SIDED'] },
        ].map(({ label, mcData, colour }) => (
          <div key={label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h2 className="text-sm font-semibold text-gray-200 mb-1">{label}</h2>
            <p className="text-xs text-gray-400 mb-3">5th / 25th / 50th / 75th / 95th percentile</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={mcData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/MWh" width={75} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                  labelStyle={{ color: '#e5e7eb' }}
                  itemStyle={{ color: '#d1d5db' }}
                />
                <Legend formatter={(v) => <span style={{ color: PERCENTILE_COLOURS[parseInt(v.replace('p', ''))] ?? colour, fontSize: 10 }}>{v}</span>} />
                {[5, 25, 50, 75, 95].map((pct) => (
                  <Line
                    key={pct}
                    type="monotone"
                    dataKey={`p${pct}`}
                    stroke={PERCENTILE_COLOURS[pct]}
                    strokeWidth={pct === 50 ? 2.5 : 1.5}
                    strokeDasharray={pct === 50 ? undefined : '4 2'}
                    dot={false}
                    name={`p${pct}`}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* Design Outcomes Grouped Bar Chart */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">% Change vs Current NEM by Design and Metric</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={METRICS.map((metric) => {
              const row: Record<string, string | number> = { metric }
              for (const design of DESIGNS.filter((d) => d !== 'CURRENT_NEM')) {
                const found = design_outcomes.find((d: MDSDesignOutcomeRecord) => d.design === design && d.metric === metric)
                row[design] = found ? found.comparison_to_current_pct : 0
              }
              return row
            })}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="metric" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend formatter={(v) => <span style={{ color: DESIGN_COLOURS[v] ?? '#9ca3af', fontSize: 11 }}>{v}</span>} />
            {DESIGNS.filter((d) => d !== 'CURRENT_NEM').map((design) => (
              <Bar key={design} dataKey={design} fill={DESIGN_COLOURS[design]} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Agent Behaviour Table */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Agent-Based Model Behaviour Parameters</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Agent Type</th>
                <th className="text-left pb-2 pr-4">Strategy</th>
                <th className="text-right pb-2 pr-4">Market Share</th>
                <th className="text-right pb-2 pr-4">Profit Margin</th>
                <th className="text-right pb-2 pr-4">Invest Trigger</th>
                <th className="text-right pb-2 pr-4">Exit Trigger</th>
                <th className="text-right pb-2">Adaptive Score</th>
              </tr>
            </thead>
            <tbody>
              {agent_behaviours.map((ab: MDSAgentBehaviourRecord, idx: number) => (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4">
                    <Badge label={ab.agent_type} className={AGENT_TYPE_BADGE[ab.agent_type] ?? 'bg-gray-700 text-gray-200'} />
                  </td>
                  <td className="py-2 pr-4">
                    <Badge label={ab.strategy} className={STRATEGY_BADGE[ab.strategy] ?? 'bg-gray-700 text-gray-200'} />
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">{ab.market_share_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{ab.profit_margin_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-right text-green-400">${ab.investment_trigger_price_aud_mwh.toFixed(0)}/MWh</td>
                  <td className="py-2 pr-4 text-right text-red-400">${ab.exit_trigger_price_aud_mwh.toFixed(0)}/MWh</td>
                  <td className="py-2 text-right text-blue-300 font-semibold">{ab.adaptive_response_score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Design Outcomes Detail Table */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Design Outcome Scores by Metric</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Design</th>
                <th className="text-left pb-2 pr-4">Metric</th>
                <th className="text-right pb-2 pr-4">Score (1–10)</th>
                <th className="text-right pb-2 pr-4">vs Current NEM</th>
                <th className="text-right pb-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {design_outcomes.map((d: MDSDesignOutcomeRecord, idx: number) => (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4">
                    <Badge label={d.design} className={DESIGN_BADGE[d.design] ?? 'bg-gray-700 text-gray-200'} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{d.metric}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-white">{d.score.toFixed(1)}</td>
                  <td className={`py-2 pr-4 text-right font-semibold ${d.comparison_to_current_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {d.comparison_to_current_pct >= 0 ? '+' : ''}{d.comparison_to_current_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 text-right">
                    <Badge label={d.confidence} className={CONFIDENCE_BADGE[d.confidence] ?? 'bg-gray-700 text-gray-200'} />
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
