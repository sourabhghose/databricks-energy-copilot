import { useEffect, useState } from 'react'
import {
  BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts'
import { Gauge, Zap, Activity, TrendingDown } from 'lucide-react'
import { getDemandFlexibilityDashboard, DemandFlexibilityDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const INDUSTRY_COLOURS: Record<string, string> = {
  ALUMINIUM_SMELTER: '#60a5fa',
  STEEL_EAF:         '#f59e0b',
  DATA_CENTRE:       '#a78bfa',
  WATER_UTILITY:     '#34d399',
  MINING:            '#fb923c',
  CEMENT:            '#94a3b8',
  PAPER_PULP:        '#86efac',
  COLD_STORAGE:      '#67e8f9',
}

const CONTRACT_COLOURS: Record<string, string> = {
  INTERRUPTIBLE:    'bg-red-800 text-red-200',
  VOLUNTARY:        'bg-green-800 text-green-200',
  VPP_PARTICIPANT:  'bg-purple-800 text-purple-200',
  ANCILLARY_SERVICE:'bg-yellow-800 text-yellow-200',
}

const TRIGGER_COLOURS: Record<string, string> = {
  HIGH_PRICE:       'bg-orange-800 text-orange-200',
  RESERVE_LOW:      'bg-red-800 text-red-200',
  FCAS_SHORTFALL:   'bg-yellow-800 text-yellow-200',
  OPERATOR_REQUEST: 'bg-blue-800 text-blue-200',
}

const TECH_COLOURS: Record<string, string> = {
  AUTOMATED_DR:     '#60a5fa',
  MANUAL_DR:        '#f59e0b',
  SMART_INVERTER:   '#34d399',
  THERMAL_STORAGE:  '#a78bfa',
  PROCESS_SHIFT:    '#fb923c',
  BACKUP_GENERATOR: '#f87171',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function Badge({ label, colourClass }: { label: string; colourClass: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colourClass}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

function KpiCard({
  title,
  value,
  unit,
  icon: Icon,
  colour,
}: {
  title: string
  value: string
  unit: string
  icon: React.ElementType
  colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-2 shadow">
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Icon size={16} className={colour} />
        {title}
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-3xl font-bold ${colour}`}>{value}</span>
        <span className="text-gray-400 text-sm mb-1">{unit}</span>
      </div>
    </div>
  )
}

// Truncate long names for chart labels
function shortName(name: string) {
  return name.length > 22 ? name.slice(0, 20) + '…' : name
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DemandFlexibilityAnalytics() {
  const [data, setData] = useState<DemandFlexibilityDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDemandFlexibilityDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading demand flexibility data…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Derived KPIs
  // -------------------------------------------------------------------------
  const totalFlexibleMw = data.consumers.reduce((s, c) => s + c.flexible_mw, 0)
  const totalDrEvents = data.events.length
  const totalBenefits = data.benefits.reduce((s, b) => s + b.total_benefit_m_aud, 0)
  const avgResponseTime =
    Math.round(
      data.consumers.reduce((s, c) => s + c.response_time_min, 0) /
        data.consumers.length
    )

  // -------------------------------------------------------------------------
  // Benefit stacking bar chart data
  // -------------------------------------------------------------------------
  const benefitChartData = data.benefits.map(b => ({
    name: shortName(b.consumer_name),
    flexibility_revenue: parseFloat(b.annual_flexibility_revenue_m_aud.toFixed(1)),
    energy_savings:      parseFloat(b.energy_cost_saving_m_aud.toFixed(1)),
    network_savings:     parseFloat(b.network_charge_saving_m_aud.toFixed(1)),
  }))

  // -------------------------------------------------------------------------
  // Technology scatter chart data
  // -------------------------------------------------------------------------
  const techScatterData = data.technologies.map(t => ({
    name:              t.technology.replace(/_/g, ' '),
    response_time:     t.avg_response_time_min,
    reliability:       t.reliability_score,
    adoption:          t.adoption_pct,
    fill:              TECH_COLOURS[t.technology] ?? '#94a3b8',
  }))

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="p-6 space-y-8 text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Gauge size={28} className="text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">
            Demand Flexibility &amp; Industrial Load Management
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Large industrial consumer participation in demand response, interruptible load programs,
            and economic benefits of load flexibility — NEM 2024
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Flexible Capacity"
          value={totalFlexibleMw.toFixed(0)}
          unit="MW"
          icon={Zap}
          colour="text-blue-400"
        />
        <KpiCard
          title="DR Events 2024"
          value={totalDrEvents.toString()}
          unit="events"
          icon={Activity}
          colour="text-orange-400"
        />
        <KpiCard
          title="Total Consumer Benefits"
          value={totalBenefits.toFixed(1)}
          unit="M AUD"
          icon={TrendingDown}
          colour="text-green-400"
        />
        <KpiCard
          title="Avg Response Time"
          value={avgResponseTime.toString()}
          unit="min"
          icon={Gauge}
          colour="text-purple-400"
        />
      </div>

      {/* Consumer Flexibility Table */}
      <section className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap size={18} className="text-blue-400" />
          Industrial Consumer Flexibility Profiles
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Consumer</th>
                <th className="text-left py-2 pr-4">Industry</th>
                <th className="text-left py-2 pr-4">Region</th>
                <th className="text-right py-2 pr-4">Peak MW</th>
                <th className="text-right py-2 pr-4">Flexible MW</th>
                <th className="text-right py-2 pr-4">Flex %</th>
                <th className="text-left py-2 pr-4">Contract</th>
                <th className="text-right py-2 pr-4">Response (min)</th>
                <th className="text-right py-2">Rev (M AUD)</th>
              </tr>
            </thead>
            <tbody>
              {data.consumers.map(c => (
                <tr key={c.consumer_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 font-medium">{c.consumer_name}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        backgroundColor: (INDUSTRY_COLOURS[c.industry] ?? '#94a3b8') + '33',
                        color: INDUSTRY_COLOURS[c.industry] ?? '#94a3b8',
                        border: `1px solid ${INDUSTRY_COLOURS[c.industry] ?? '#94a3b8'}55`,
                      }}
                    >
                      {c.industry.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{c.region}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{c.peak_demand_mw.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-blue-300">{c.flexible_mw.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right text-green-300">{c.flexibility_pct.toFixed(0)}%</td>
                  <td className="py-2 pr-4">
                    <Badge label={c.contract_type} colourClass={CONTRACT_COLOURS[c.contract_type] ?? 'bg-gray-700 text-gray-300'} />
                  </td>
                  <td className="py-2 pr-4 text-right text-purple-300">{c.response_time_min}</td>
                  <td className="py-2 text-right font-semibold text-yellow-300">{c.annual_revenue_m_aud.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Event Log */}
      <section className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity size={18} className="text-orange-400" />
          Demand Response Event Log — 2024
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Event ID</th>
                <th className="text-left py-2 pr-4">Date</th>
                <th className="text-left py-2 pr-4">Trigger</th>
                <th className="text-left py-2 pr-4">Region</th>
                <th className="text-right py-2 pr-4">Curtailed MW</th>
                <th className="text-right py-2 pr-4">Duration (hr)</th>
                <th className="text-right py-2 pr-4">Participants</th>
                <th className="text-right py-2 pr-4">Price (AUD)</th>
                <th className="text-right py-2 pr-4">Cost Avoided (M)</th>
                <th className="text-right py-2">Success %</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map(ev => (
                <tr key={ev.event_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 font-mono text-gray-300 text-xs">{ev.event_id}</td>
                  <td className="py-2 pr-4 text-gray-200">{ev.date}</td>
                  <td className="py-2 pr-4">
                    <Badge label={ev.trigger} colourClass={TRIGGER_COLOURS[ev.trigger] ?? 'bg-gray-700 text-gray-300'} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{ev.region}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-blue-300">{ev.total_curtailed_mw.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{ev.duration_hr.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{ev.participants}</td>
                  <td className="py-2 pr-4 text-right text-orange-300">
                    ${ev.price_during_event_aud.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right text-green-300">${ev.cost_avoided_m_aud.toFixed(1)}M</td>
                  <td className="py-2 text-right">
                    <span className={`font-semibold ${ev.success_rate_pct >= 95 ? 'text-green-400' : ev.success_rate_pct >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {ev.success_rate_pct.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Benefit Stacking Bar Chart */}
        <section className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <TrendingDown size={18} className="text-green-400" />
            Economic Benefits by Consumer (M AUD)
          </h2>
          <p className="text-gray-400 text-xs mb-4">
            Stacked: flexibility revenue + energy savings + network charge savings
          </p>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart
              data={benefitChartData}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={v => `$${v}M`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={148}
                tick={{ fill: '#d1d5db', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
                formatter={(val: number, name: string) => [
                  `$${val.toFixed(1)}M`,
                  name.replace(/_/g, ' '),
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: '#9ca3af' }}
                formatter={v => v.replace(/_/g, ' ')}
              />
              <ReferenceLine x={0} stroke="#6b7280" />
              <Bar dataKey="flexibility_revenue" stackId="a" fill="#60a5fa" name="flexibility_revenue">
                <LabelList dataKey="flexibility_revenue" position="insideRight" style={{ fill: '#fff', fontSize: 10 }} formatter={(v: number) => v > 3 ? `$${v}M` : ''} />
              </Bar>
              <Bar dataKey="energy_savings" stackId="a" fill="#34d399" name="energy_savings" />
              <Bar dataKey="network_savings" stackId="a" fill="#a78bfa" name="network_savings" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* Technology Scatter Chart */}
        <section className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Gauge size={18} className="text-purple-400" />
            Technology Comparison: Response Time vs Reliability
          </h2>
          <p className="text-gray-400 text-xs mb-4">
            Bubble size = adoption %. X-axis = avg response time (min). Y-axis = reliability score (0–10).
          </p>
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 16, right: 24, left: 8, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                dataKey="response_time"
                name="Response Time"
                unit=" min"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                label={{ value: 'Avg Response Time (min)', position: 'insideBottom', offset: -12, fill: '#9ca3af', fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="reliability"
                name="Reliability"
                domain={[5, 10]}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                label={{ value: 'Reliability Score', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 12 }}
              />
              <ZAxis type="number" dataKey="adoption" range={[60, 600]} name="Adoption %" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(val: number, name: string) => {
                  if (name === 'Response Time') return [`${val} min`, name]
                  if (name === 'Reliability') return [val.toFixed(1), name]
                  if (name === 'Adoption %') return [`${val}%`, name]
                  return [val, name]
                }}
              />
              <Scatter
                name="Technologies"
                data={techScatterData}
                isAnimationActive
              >
                {techScatterData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} fillOpacity={0.85} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {data.technologies.map(t => (
              <div key={t.technology} className="flex items-center gap-1.5 text-xs text-gray-300">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: TECH_COLOURS[t.technology] ?? '#94a3b8' }}
                />
                {t.technology.replace(/_/g, ' ')} ({t.adoption_pct}%)
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Technology Details Table */}
      <section className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity size={18} className="text-purple-400" />
          Demand Response Technology Profiles
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Technology</th>
                <th className="text-right py-2 pr-4">Adoption %</th>
                <th className="text-right py-2 pr-4">Avg Response (min)</th>
                <th className="text-right py-2 pr-4">Typical Duration (hr)</th>
                <th className="text-right py-2 pr-4">Cost (AUD/kW)</th>
                <th className="text-right py-2">Reliability Score</th>
              </tr>
            </thead>
            <tbody>
              {data.technologies.map(t => (
                <tr key={t.technology} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: TECH_COLOURS[t.technology] ?? '#94a3b8' }}
                      />
                      <span className="font-medium">{t.technology.replace(/_/g, ' ')}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right text-blue-300">{t.adoption_pct.toFixed(0)}%</td>
                  <td className="py-2 pr-4 text-right text-orange-300">{t.avg_response_time_min}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{t.typical_duration_hr.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right text-yellow-300">${t.cost_aud_per_kw.toFixed(0)}</td>
                  <td className="py-2 text-right">
                    <span className={`font-bold ${t.reliability_score >= 9 ? 'text-green-400' : t.reliability_score >= 8 ? 'text-yellow-400' : 'text-orange-400'}`}>
                      {t.reliability_score.toFixed(1)}
                    </span>
                    <span className="text-gray-500">/10</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-gray-500 text-xs text-right">
        Data as at {new Date(data.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
      </p>
    </div>
  )
}
