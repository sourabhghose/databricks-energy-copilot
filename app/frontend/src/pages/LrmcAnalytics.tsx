import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ErrorBar,
} from 'recharts'
import { TrendingDown, DollarSign, Zap, MapPin } from 'lucide-react'
import { api } from '../api/client'
import type {
  LrmcDashboard,
  LcoeTechnology,
  InvestmentSignal,
  CapacityMechanismScenario,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TECH_COLORS: Record<string, string> = {
  'Wind Onshore':  '#22c55e',
  'Solar Farm':    '#f59e0b',
  'Black Coal':    '#6b7280',
  'Gas CCGT':      '#f97316',
  'Gas OCGT':      '#fb923c',
  'Utility BESS':  '#8b5cf6',
  'Pumped Hydro':  '#3b82f6',
  'Nuclear SMR':   '#ef4444',
  'Offshore Wind': '#06b6d4',
}

function techColor(technology: string): string {
  return TECH_COLORS[technology] ?? '#94a3b8'
}

function signalBadge(signal: string) {
  const map: Record<string, string> = {
    INVEST:  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    MONITOR: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    CAUTION: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    AVOID:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[signal] ?? 'bg-gray-100 text-gray-700'}`}>
      {signal}
    </span>
  )
}

function regionChip(region: string) {
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
      {region}
    </span>
  )
}

function dispatchableBadge(isDispatchable: boolean) {
  if (isDispatchable) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
        Dispatchable
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
      Variable
    </span>
  )
}

function irrColor(irr: number): string {
  if (irr >= 12) return 'text-green-600 dark:text-green-400'
  if (irr >= 8)  return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function marginColor(margin: number): string {
  return margin >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals)
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  Icon: React.ElementType
  iconClass?: string
}

function KpiCard({ label, value, sub, Icon, iconClass = 'text-blue-500' }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-gray-50 dark:bg-gray-700 ${iconClass}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LCOE Range Chart
// ---------------------------------------------------------------------------

interface LcoeChartDatum {
  name: string
  mid: number
  errorBars: [number, number]  // [mid - low, high - mid]
  color: string
}

function LcoeRangeChart({ technologies, spotPrice }: { technologies: LcoeTechnology[]; spotPrice: number }) {
  // Aggregate by technology — take the minimum low, average mid, maximum high across regions
  const byTech: Record<string, LcoeTechnology[]> = {}
  technologies.forEach(t => {
    ;(byTech[t.technology] ??= []).push(t)
  })

  const chartData: LcoeChartDatum[] = Object.entries(byTech)
    .map(([tech, entries]) => {
      const minLow  = Math.min(...entries.map(e => e.lcoe_low_aud_mwh))
      const avgMid  = entries.reduce((s, e) => s + e.lcoe_mid_aud_mwh, 0) / entries.length
      const maxHigh = Math.max(...entries.map(e => e.lcoe_high_aud_mwh))
      return {
        name: tech,
        mid: avgMid,
        errorBars: [avgMid - minLow, maxHigh - avgMid] as [number, number],
        color: techColor(tech),
      }
    })
    .sort((a, b) => a.mid - b.mid)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        LCOE by Technology — Range ($/MWh)
      </h3>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            label={{ value: '$/MWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number, name: string) => [`$${fmt(value)}/MWh`, name]}
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <ReferenceLine
            y={spotPrice}
            stroke="#f59e0b"
            strokeDasharray="6 3"
            label={{ value: `Spot $${fmt(spotPrice)}`, fill: '#f59e0b', fontSize: 11, position: 'right' }}
          />
          <Bar dataKey="mid" name="LCOE Mid" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
            <ErrorBar dataKey="errorBars" width={6} strokeWidth={2} stroke="#94a3b8" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
        Error bars show best-case to worst-case range. Dashed line = 12-month avg spot price.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Investment Signal table
// ---------------------------------------------------------------------------

const SIGNAL_OPTIONS = ['ALL', 'INVEST', 'MONITOR', 'CAUTION', 'AVOID']

function InvestmentSignalTable({ signals }: { signals: InvestmentSignal[] }) {
  const [filter, setFilter] = useState('ALL')
  const filtered = filter === 'ALL' ? signals : signals.filter(s => s.signal === filter)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Investment Viability Signals
        </h3>
        <div className="flex gap-2">
          {SIGNAL_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                filter === opt
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="pb-2 pr-4 font-medium">Technology</th>
              <th className="pb-2 pr-4 font-medium">Region</th>
              <th className="pb-2 pr-4 font-medium">Signal</th>
              <th className="pb-2 pr-4 font-medium text-right">Spot Avg</th>
              <th className="pb-2 pr-4 font-medium text-right">LCOE Mid</th>
              <th className="pb-2 pr-4 font-medium text-right">Margin</th>
              <th className="pb-2 pr-4 font-medium text-right">IRR %</th>
              <th className="pb-2 pr-4 font-medium text-right">Payback (yr)</th>
              <th className="pb-2 font-medium text-right">Rev. Adequacy %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: techColor(s.technology) }}
                    />
                    <span className="font-medium text-gray-900 dark:text-white">{s.technology}</span>
                  </div>
                </td>
                <td className="py-2.5 pr-4">{regionChip(s.region)}</td>
                <td className="py-2.5 pr-4">{signalBadge(s.signal)}</td>
                <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                  ${fmt(s.spot_price_avg_aud_mwh)}
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                  ${fmt(s.lcoe_mid_aud_mwh)}
                </td>
                <td className={`py-2.5 pr-4 text-right font-semibold ${marginColor(s.margin_aud_mwh)}`}>
                  {s.margin_aud_mwh >= 0 ? '+' : ''}${fmt(s.margin_aud_mwh)}
                </td>
                <td className={`py-2.5 pr-4 text-right font-semibold ${irrColor(s.irr_pct)}`}>
                  {fmt(s.irr_pct)}%
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                  {fmt(s.payback_years, 1)}
                </td>
                <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                  {fmt(s.revenue_adequacy_pct)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-6">No signals match filter.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Capacity Mechanism Scenarios table
// ---------------------------------------------------------------------------

function CapacityScenariosTable({ scenarios }: { scenarios: CapacityMechanismScenario[] }) {
  const scenarioColor: Record<string, string> = {
    NO_MECHANISM:      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    CRM_LIGHT:         'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    RELIABILITY_PAYMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    CRM_FULL:          'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Capacity Mechanism Scenarios
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="pb-2 pr-4 font-medium">Scenario</th>
              <th className="pb-2 pr-4 font-medium">Description</th>
              <th className="pb-2 pr-4 font-medium text-right">Add. Capacity (GW)</th>
              <th className="pb-2 pr-4 font-medium text-right">Cost ($M/yr)</th>
              <th className="pb-2 pr-4 font-medium text-right">Reliability Gain %</th>
              <th className="pb-2 font-medium">Recommended Technologies</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((sc, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${scenarioColor[sc.scenario] ?? 'bg-gray-100 text-gray-700'}`}>
                    {sc.scenario.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-600 dark:text-gray-400 text-xs max-w-xs">
                  {sc.description}
                </td>
                <td className="py-3 pr-4 text-right font-semibold text-gray-900 dark:text-white">
                  {fmt(sc.additional_capacity_gw, 1)}
                </td>
                <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                  ${sc.cost_to_consumers_m_aud.toLocaleString()}M
                </td>
                <td className={`py-3 pr-4 text-right font-semibold ${sc.reliability_improvement_pct > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                  {sc.reliability_improvement_pct > 0 ? '+' : ''}{fmt(sc.reliability_improvement_pct)}%
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {sc.recommended_technologies.map((t, j) => (
                      <span
                        key={j}
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ background: `${techColor(t)}22`, color: techColor(t) }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LCOE Comparison table
// ---------------------------------------------------------------------------

const REGION_OPTIONS = ['ALL', 'NSW1', 'SA1', 'QLD1']

function LcoeComparisonTable({ technologies }: { technologies: LcoeTechnology[] }) {
  const [regionFilter, setRegionFilter] = useState('ALL')
  const filtered = regionFilter === 'ALL'
    ? technologies
    : technologies.filter(t => t.region === regionFilter)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          LCOE Detailed Comparison
        </h3>
        <div className="flex gap-2">
          {REGION_OPTIONS.map(r => (
            <button
              key={r}
              onClick={() => setRegionFilter(r)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                regionFilter === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="pb-2 pr-4 font-medium">Technology</th>
              <th className="pb-2 pr-4 font-medium">Region</th>
              <th className="pb-2 pr-4 font-medium text-right">CF %</th>
              <th className="pb-2 pr-4 font-medium text-right">Capex ($/kW)</th>
              <th className="pb-2 pr-4 font-medium text-right">Opex ($/MWh)</th>
              <th className="pb-2 pr-4 font-medium text-right">LCOE Low</th>
              <th className="pb-2 pr-4 font-medium text-right">LCOE Mid</th>
              <th className="pb-2 pr-4 font-medium text-right">LCOE High</th>
              <th className="pb-2 pr-4 font-medium text-right">CO2 (kg/MWh)</th>
              <th className="pb-2 pr-4 font-medium">Type</th>
              <th className="pb-2 font-medium text-right">Learning %/yr</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: techColor(t.technology) }}
                    />
                    <span className="font-medium text-gray-900 dark:text-white">{t.technology}</span>
                  </div>
                </td>
                <td className="py-2.5 pr-4">{regionChip(t.region)}</td>
                <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                  {fmt(t.capacity_factor_pct)}%
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                  ${t.capex_aud_kw.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                  ${fmt(t.opex_aud_mwh)}
                </td>
                <td className="py-2.5 pr-4 text-right text-green-600 dark:text-green-400">
                  ${fmt(t.lcoe_low_aud_mwh)}
                </td>
                <td className="py-2.5 pr-4 text-right font-semibold text-gray-900 dark:text-white">
                  ${fmt(t.lcoe_mid_aud_mwh)}
                </td>
                <td className="py-2.5 pr-4 text-right text-red-500 dark:text-red-400">
                  ${fmt(t.lcoe_high_aud_mwh)}
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                  {fmt(t.co2_intensity_kg_mwh)}
                </td>
                <td className="py-2.5 pr-4">{dispatchableBadge(t.is_dispatchable)}</td>
                <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                  {fmt(t.learning_rate_pct)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LrmcAnalytics() {
  const [dashboard, setDashboard] = useState<LrmcDashboard | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getLrmcDashboard()
      .then(d => {
        setDashboard(d)
        setError(null)
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-700 dark:text-red-300 text-sm">{error ?? 'Failed to load LRMC data.'}</p>
        </div>
      </div>
    )
  }

  const spotPrice = dashboard.investment_signals[0]?.spot_price_avg_aud_mwh ?? 95

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <TrendingDown className="text-blue-500" size={26} />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              LRMC &amp; Investment Signal Analytics
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
              Cheapest new entrant: {dashboard.cheapest_new_entrant} @ ${fmt(dashboard.cheapest_lcoe_aud_mwh)}/MWh
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ml-9">
            Levelised cost of electricity by technology, investment viability signals and capacity mechanism scenarios
          </p>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
          <p>Data as at</p>
          <p>{new Date(dashboard.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Avg NEM LRMC"
          value={`$${fmt(dashboard.avg_nem_lrmc_aud_mwh)}/MWh`}
          sub="Capacity-weighted avg across all technologies"
          Icon={TrendingDown}
          iconClass="text-blue-500"
        />
        <KpiCard
          label="Cheapest Technology"
          value={`$${fmt(dashboard.cheapest_lcoe_aud_mwh)}/MWh`}
          sub={dashboard.cheapest_new_entrant}
          Icon={DollarSign}
          iconClass="text-green-500"
        />
        <KpiCard
          label="Technologies Above Market"
          value={String(dashboard.technologies_above_market)}
          sub={`LCOE mid > $${fmt(spotPrice)}/MWh spot avg`}
          Icon={Zap}
          iconClass="text-amber-500"
        />
        <KpiCard
          label="Best Investment Region"
          value={dashboard.best_investment_region}
          sub="Lowest avg LCOE across all technologies"
          Icon={MapPin}
          iconClass="text-purple-500"
        />
      </div>

      {/* LCOE Range Chart */}
      <LcoeRangeChart technologies={dashboard.lcoe_technologies} spotPrice={spotPrice} />

      {/* Investment Signal Table */}
      <InvestmentSignalTable signals={dashboard.investment_signals} />

      {/* Capacity Mechanism Scenarios */}
      <CapacityScenariosTable scenarios={dashboard.capacity_scenarios} />

      {/* LCOE Comparison Table */}
      <LcoeComparisonTable technologies={dashboard.lcoe_technologies} />
    </div>
  )
}
