import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts'
import { BarChart3, TrendingUp, Zap, Layers, DollarSign } from 'lucide-react'
import { api } from '../api/client'
import type { StorageRevenueStackDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour constants
// ---------------------------------------------------------------------------
const STREAM_COLORS = {
  energy_arbitrage_m_aud: '#3b82f6',   // blue
  fcas_raise_m_aud:       '#22c55e',   // green
  fcas_lower_m_aud:       '#06b6d4',   // cyan
  capacity_market_m_aud:  '#f59e0b',   // amber
  network_services_m_aud: '#a855f7',   // purple
  ancillary_services_m_aud:'#6b7280',  // gray
}

const ACTION_COLORS: Record<string, string> = {
  CHARGE:       '#3b82f6',
  DISCHARGE:    '#ef4444',
  IDLE:         '#6b7280',
  FCAS_STANDBY: '#f59e0b',
}

const SCENARIO_COLORS = {
  annual_revenue_m_aud: '#3b82f6',
  annual_cost_m_aud:    '#ef4444',
  annual_profit_m_aud:  '#22c55e',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(v: number, dec = 1): string {
  return v.toFixed(dec)
}

function fmtM(v: number): string {
  return `$${fmt(v)}M`
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent: string
}

function KpiCard({ label, value, sub, icon, accent }: KpiCardProps) {
  return (
    <div className={`bg-gray-800 rounded-xl p-4 border-l-4 ${accent} flex items-start gap-3`}>
      <div className="mt-1 shrink-0 text-gray-400">{icon}</div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Revenue Waterfall Chart
// ---------------------------------------------------------------------------
function RevenueWaterfallSection({ data }: { data: StorageRevenueStackDashboard['revenue_waterfall'] }) {
  const sorted = [...data].sort((a, b) => b.total_revenue_m_aud - a.total_revenue_m_aud)

  const chartData = sorted.map(p => ({
    name: p.project_name.replace(' Battery', ' Bat.').replace(' Power Reserve', ' PR').replace(' Super Battery', ' SB').replace(' BESS', ''),
    'Energy Arb': p.energy_arbitrage_m_aud,
    'FCAS Raise': p.fcas_raise_m_aud,
    'FCAS Lower': p.fcas_lower_m_aud,
    'Capacity': p.capacity_market_m_aud,
    'Network': p.network_services_m_aud,
    'Ancillary': p.ancillary_services_m_aud,
    total: p.total_revenue_m_aud,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white mb-1">Revenue Waterfall by Project</h2>
      <p className="text-xs text-gray-400 mb-4">Stacked annual revenue by service stream ($M AUD) — sorted by total revenue</p>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}M`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(v: number) => [`$${fmt(v)}M`, undefined]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 12 }} />
          <Bar dataKey="Energy Arb"  stackId="a" fill={STREAM_COLORS.energy_arbitrage_m_aud} />
          <Bar dataKey="FCAS Raise"  stackId="a" fill={STREAM_COLORS.fcas_raise_m_aud} />
          <Bar dataKey="FCAS Lower"  stackId="a" fill={STREAM_COLORS.fcas_lower_m_aud} />
          <Bar dataKey="Capacity"    stackId="a" fill={STREAM_COLORS.capacity_market_m_aud} />
          <Bar dataKey="Network"     stackId="a" fill={STREAM_COLORS.network_services_m_aud} />
          <Bar dataKey="Ancillary"   stackId="a" fill={STREAM_COLORS.ancillary_services_m_aud} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Detail table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 pr-3">Project</th>
              <th className="text-right py-2 px-2">Total $M</th>
              <th className="text-right py-2 px-2">LCOE</th>
              <th className="text-right py-2 px-2">IRR %</th>
              <th className="text-right py-2 px-2">Payback yrs</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <tr key={p.project_id} className="border-b border-gray-700/40 hover:bg-gray-700/30">
                <td className="py-1.5 pr-3">{p.project_name}</td>
                <td className="text-right px-2 text-green-400 font-semibold">{fmtM(p.total_revenue_m_aud)}</td>
                <td className="text-right px-2">${fmt(p.lcoe_mwh, 0)}/MWh</td>
                <td className="text-right px-2">{fmt(p.irr_pct)}%</td>
                <td className="text-right px-2">{fmt(p.simple_payback_years)} yr</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scenario Comparison
// ---------------------------------------------------------------------------
function ScenarioSection({ data }: { data: StorageRevenueStackDashboard['scenario_comparison'] }) {
  const chartData = data.map(s => ({
    name: s.scenario.replace('_', ' '),
    Revenue: s.annual_revenue_m_aud,
    Cost: s.annual_cost_m_aud,
    Profit: s.annual_profit_m_aud,
  }))

  const SCENARIO_LABELS: Record<string, string> = {
    ENERGY_ONLY:       'Energy Only',
    FCAS_ONLY:         'FCAS Only',
    FULL_STACK:        'Full Stack',
    NETWORK_CONTRACT:  'Network Contract',
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white mb-1">Scenario Comparison</h2>
      <p className="text-xs text-gray-400 mb-4">Annual revenue / cost / profit across stacking scenarios ($M AUD, 300 MWh reference project)</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}M`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(v: number) => [`$${fmt(v)}M`, undefined]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="Revenue" fill={SCENARIO_COLORS.annual_revenue_m_aud} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Cost"    fill={SCENARIO_COLORS.annual_cost_m_aud}    radius={[3, 3, 0, 0]} />
          <Bar dataKey="Profit"  fill={SCENARIO_COLORS.annual_profit_m_aud}  radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 pr-3">Scenario</th>
              <th className="text-right py-2 px-2">Revenue $M</th>
              <th className="text-right py-2 px-2">Profit $M</th>
              <th className="text-right py-2 px-2">ROI %</th>
              <th className="text-right py-2 px-2">Payback yrs</th>
              <th className="text-right py-2 px-2">NPV $M</th>
            </tr>
          </thead>
          <tbody>
            {data.map(s => (
              <tr key={s.scenario} className="border-b border-gray-700/40 hover:bg-gray-700/30">
                <td className="py-1.5 pr-3 font-medium text-white">{SCENARIO_LABELS[s.scenario] ?? s.scenario}</td>
                <td className="text-right px-2 text-blue-400">{fmtM(s.annual_revenue_m_aud)}</td>
                <td className="text-right px-2 text-green-400 font-semibold">{fmtM(s.annual_profit_m_aud)}</td>
                <td className="text-right px-2">{fmt(s.roi_pct)}%</td>
                <td className="text-right px-2">{fmt(s.payback_years)} yr</td>
                <td className="text-right px-2 text-purple-400">{fmtM(s.project_npv_m_aud)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dispatch Optimisation Section
// ---------------------------------------------------------------------------
function DispatchSection({ data }: { data: StorageRevenueStackDashboard['dispatch_optimisation'] }) {
  const socData = data.map(d => ({
    hour: `${String(d.hour).padStart(2, '0')}:00`,
    'SOC Start %': d.soc_start_pct,
    'SOC End %': d.soc_end_pct,
    'Revenue ($K)': d.revenue_aud / 1000,
    action: d.optimal_action,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white mb-1">Dispatch Optimisation — Peak Day (Jan)</h2>
      <p className="text-xs text-gray-400 mb-4">Hourly state-of-charge trajectory and revenue alongside optimal dispatch action</p>

      {/* Action legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(ACTION_COLORS).map(([action, color]) => (
          <span key={action} className="flex items-center gap-1.5 text-xs text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            {action.replace('_', ' ')}
          </span>
        ))}
      </div>

      {/* Action heatmap row */}
      <div className="flex gap-0.5 mb-4 overflow-x-auto pb-1">
        {data.map(d => (
          <div
            key={d.hour}
            className="flex-1 min-w-[28px] rounded-sm flex flex-col items-center"
            style={{ backgroundColor: ACTION_COLORS[d.optimal_action] + '33', border: `1px solid ${ACTION_COLORS[d.optimal_action]}` }}
            title={`${String(d.hour).padStart(2, '0')}:00 — ${d.optimal_action}\nSOC: ${d.soc_start_pct}→${d.soc_end_pct}%\nPrice: $${d.energy_price}/MWh\nRevenue: $${(d.revenue_aud).toLocaleString()}`}
          >
            <span className="text-[9px] font-bold py-0.5" style={{ color: ACTION_COLORS[d.optimal_action] }}>
              {String(d.hour).padStart(2, '0')}
            </span>
            <span className="text-[8px] text-gray-400 pb-0.5">
              {d.optimal_action.slice(0, 2)}
            </span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={socData} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={2} />
          <YAxis yAxisId="soc" domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} />
          <YAxis yAxisId="rev" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}K`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(v: number, name: string) => {
              if (name.includes('SOC')) return [`${fmt(v)}%`, name]
              return [`$${fmt(v)}K`, name]
            }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Line yAxisId="soc" type="monotone" dataKey="SOC Start %" stroke="#3b82f6" dot={false} strokeWidth={2} />
          <Line yAxisId="rev" type="monotone" dataKey="Revenue ($K)" stroke="#f59e0b" dot={false} strokeWidth={2} strokeDasharray="5 3" />
        </LineChart>
      </ResponsiveContainer>

      {/* Hourly table */}
      <div className="mt-4 overflow-x-auto max-h-52 overflow-y-auto">
        <table className="w-full text-xs text-gray-300">
          <thead className="sticky top-0 bg-gray-800">
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 pr-3">Hour</th>
              <th className="text-left py-2 px-2">Action</th>
              <th className="text-right py-2 px-2">Price $/MWh</th>
              <th className="text-right py-2 px-2">SOC %</th>
              <th className="text-right py-2 px-2">Energy MWh</th>
              <th className="text-right py-2 px-2">Revenue $</th>
            </tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d.hour} className="border-b border-gray-700/40 hover:bg-gray-700/30">
                <td className="py-1.5 pr-3">{String(d.hour).padStart(2, '0')}:00</td>
                <td className="px-2">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    style={{
                      backgroundColor: ACTION_COLORS[d.optimal_action] + '33',
                      color: ACTION_COLORS[d.optimal_action],
                    }}
                  >
                    {d.optimal_action}
                  </span>
                </td>
                <td className="text-right px-2">${fmt(d.energy_price, 0)}</td>
                <td className="text-right px-2">{fmt(d.soc_start_pct, 0)}→{fmt(d.soc_end_pct, 0)}%</td>
                <td className="text-right px-2">{d.energy_mwh > 0 ? fmt(d.energy_mwh, 0) : '—'}</td>
                <td className={`text-right px-2 font-semibold ${d.revenue_aud >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${Math.abs(d.revenue_aud).toLocaleString()}
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
// Multi-Service Bids Table
// ---------------------------------------------------------------------------
function MultiBidsSection({ data }: { data: StorageRevenueStackDashboard['multi_service_bids'] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white mb-1">Multi-Service Bid Co-optimisation</h2>
      <p className="text-xs text-gray-400 mb-4">BESS co-optimised bids across energy + FCAS contingency + regulation markets with co-optimisation revenue uplift</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 pr-3">Project</th>
              <th className="text-left py-2 px-2">Date</th>
              <th className="text-right py-2 px-2">Energy (MW)</th>
              <th className="text-right py-2 px-2">FCAS C-Raise</th>
              <th className="text-right py-2 px-2">FCAS C-Lower</th>
              <th className="text-right py-2 px-2">FCAS R-Raise</th>
              <th className="text-right py-2 px-2">FCAS R-Lower</th>
              <th className="text-right py-2 px-2">FCAS Rev $</th>
              <th className="text-right py-2 px-2">Energy Rev $</th>
              <th className="text-right py-2 px-2">Co-opt Uplift</th>
            </tr>
          </thead>
          <tbody>
            {data.map((b, i) => (
              <tr key={i} className="border-b border-gray-700/40 hover:bg-gray-700/30">
                <td className="py-1.5 pr-3 font-medium text-white whitespace-nowrap">{b.project_name}</td>
                <td className="px-2 text-gray-400">{b.trading_date}</td>
                <td className="text-right px-2">{fmt(b.energy_bid_mw, 0)}</td>
                <td className="text-right px-2 text-green-400">{fmt(b.fcas_contingency_raise_mw, 0)}</td>
                <td className="text-right px-2 text-cyan-400">{fmt(b.fcas_contingency_lower_mw, 0)}</td>
                <td className="text-right px-2 text-emerald-400">{fmt(b.fcas_regulation_raise_mw, 0)}</td>
                <td className="text-right px-2 text-teal-400">{fmt(b.fcas_regulation_lower_mw, 0)}</td>
                <td className="text-right px-2 text-green-300">${b.total_fcas_revenue_aud.toLocaleString()}</td>
                <td className="text-right px-2 text-blue-300">${b.total_energy_revenue_aud.toLocaleString()}</td>
                <td className="text-right px-2">
                  <span className="text-amber-400 font-semibold">+{fmt(b.co_optimisation_benefit_pct)}%</span>
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
export default function StorageRevenueStack() {
  const [data, setData] = useState<StorageRevenueStackDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getStorageRevenueStackDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-gray-400 text-sm animate-pulse">Loading Storage Revenue Stack data...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-red-400 text-sm">{error ?? 'Unknown error'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="p-3 bg-blue-500/20 rounded-xl">
          <BarChart3 className="w-7 h-7 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Energy Storage Revenue Stacking &amp; Optimisation</h1>
          <p className="text-gray-400 mt-1 max-w-2xl">
            Multi-service co-optimisation analytics covering energy arbitrage, FCAS contingency &amp; regulation,
            capacity market, and network service stacking. Optimal dispatch scheduling and revenue waterfall
            breakdown for major Australian BESS projects.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Avg Total Revenue"
          value={`$${fmt(data.avg_total_revenue_m_aud)}M/yr`}
          sub="Across all BESS projects"
          icon={<DollarSign className="w-5 h-5" />}
          accent="border-blue-500"
        />
        <KpiCard
          label="Best Revenue Project"
          value={data.best_revenue_project}
          sub="Highest stacked revenue"
          icon={<TrendingUp className="w-5 h-5" />}
          accent="border-green-500"
        />
        <KpiCard
          label="Energy vs FCAS Split"
          value={`${fmt(data.energy_vs_fcas_split_pct)}%`}
          sub="Energy share of total revenue"
          icon={<Zap className="w-5 h-5" />}
          accent="border-amber-500"
        />
        <KpiCard
          label="Co-optimisation Benefit"
          value={`+${fmt(data.co_optimisation_benefit_pct)}%`}
          sub="Revenue uplift from stacking"
          icon={<Layers className="w-5 h-5" />}
          accent="border-purple-500"
        />
      </div>

      {/* Revenue Waterfall */}
      <div className="mb-8">
        <RevenueWaterfallSection data={data.revenue_waterfall} />
      </div>

      {/* Scenario Comparison */}
      <div className="mb-8">
        <ScenarioSection data={data.scenario_comparison} />
      </div>

      {/* Dispatch Optimisation */}
      <div className="mb-8">
        <DispatchSection data={data.dispatch_optimisation} />
      </div>

      {/* Multi-Service Bids */}
      <div className="mb-8">
        <MultiBidsSection data={data.multi_service_bids} />
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-500 text-center mt-4">
        Sprint 49a — Energy Storage Revenue Stacking &amp; Optimisation Analytics |
        Data as at {new Date(data.timestamp).toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' })}
      </p>
    </div>
  )
}
