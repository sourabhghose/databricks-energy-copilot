import { useEffect, useState, useMemo } from 'react'
import { CloudLightning, AlertTriangle, Thermometer, Zap } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ComposedChart,
} from 'recharts'
import {
  getExtremeWeatherResilienceDashboard,
  EWRDashboard,
  EWREventRecord,
  EWRDemandSurgeRecord,
  EWRNetworkImpactRecord,
  EWRAdaptationRecord,
} from '../api/client'

// ── Badge helpers ─────────────────────────────────────────────────────────────

function eventTypeBadge(type: string): string {
  const map: Record<string, string> = {
    HEATWAVE: 'bg-red-700 text-red-100',
    BUSHFIRE: 'bg-orange-700 text-orange-100',
    FLOOD: 'bg-blue-700 text-blue-100',
    CYCLONE: 'bg-purple-700 text-purple-100',
    STORM: 'bg-gray-600 text-gray-100',
  }
  return map[type] ?? 'bg-gray-700 text-gray-200'
}

function attributionBadge(attr: string): string {
  const map: Record<string, string> = {
    LIKELY: 'bg-red-700 text-red-100',
    POSSIBLE: 'bg-yellow-700 text-yellow-100',
    UNCERTAIN: 'bg-gray-600 text-gray-100',
  }
  return map[attr] ?? 'bg-gray-700 text-gray-200'
}

function assetTypeBadge(type: string): string {
  const map: Record<string, string> = {
    TRANSMISSION_LINE: 'bg-blue-700 text-blue-100',
    SUBSTATION: 'bg-purple-700 text-purple-100',
    DISTRIBUTION_FEEDER: 'bg-teal-700 text-teal-100',
    TOWER: 'bg-gray-600 text-gray-100',
  }
  return map[type] ?? 'bg-gray-700 text-gray-200'
}

function failureTypeBadge(type: string): string {
  const map: Record<string, string> = {
    THERMAL_OVERLOAD: 'bg-red-700 text-red-100',
    WEATHER_DAMAGE: 'bg-orange-700 text-orange-100',
    BUSHFIRE_PROXIMITY: 'bg-amber-700 text-amber-100',
    FLOOD: 'bg-blue-700 text-blue-100',
  }
  return map[type] ?? 'bg-gray-700 text-gray-200'
}

function statusBadge(status: string): { cls: string; barColor: string } {
  const map: Record<string, { cls: string; barColor: string }> = {
    COMPLETED: { cls: 'bg-green-700 text-green-100', barColor: '#22c55e' },
    IN_PROGRESS: { cls: 'bg-yellow-700 text-yellow-100', barColor: '#eab308' },
    PLANNED: { cls: 'bg-blue-700 text-blue-100', barColor: '#3b82f6' },
  }
  return map[status] ?? { cls: 'bg-gray-700 text-gray-200', barColor: '#6b7280' }
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-2 border border-gray-700">
      <div className="flex items-center gap-2">
        <Icon size={18} className={accent} />
        <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      {sub && <span className="text-gray-500 text-xs">{sub}</span>}
    </div>
  )
}

// ── Demand Surge Chart ────────────────────────────────────────────────────────

function DemandSurgeChart({ surges }: { surges: EWRDemandSurgeRecord[] }) {
  const chartData = surges.map((s) => ({
    label: `${s.region}\n${s.date.slice(0, 7)}`,
    dateRegion: `${s.region} ${s.date.slice(5, 7)}/${s.date.slice(2, 4)}`,
    demand_normal: s.demand_normal_mw,
    demand_surge: s.demand_surge_mw,
    demand_actual: s.demand_actual_mw,
    reserve_margin: s.reserve_margin_pct,
    close_to_lor: s.close_to_lor,
    region: s.region,
  }))

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {surges
          .filter((s) => s.close_to_lor)
          .map((s) => (
            <span
              key={`${s.date}-${s.region}`}
              className="flex items-center gap-1 bg-red-900 border border-red-600 text-red-200 text-xs px-2 py-1 rounded-full"
            >
              <AlertTriangle size={10} />
              LOR Warning: {s.region} {s.date}
            </span>
          ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="dateRegion" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 25]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Reserve %', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="demand_normal" name="Normal Demand (MW)" fill="#3b82f6" stackId="a" />
          <Bar yAxisId="left" dataKey="demand_surge" name="Demand Surge (MW)" fill="#ef4444" stackId="a" />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="reserve_margin"
            name="Reserve Margin (%)"
            stroke="#fbbf24"
            strokeWidth={2}
            dot={{ fill: '#fbbf24', r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Adaptation Investment Chart ───────────────────────────────────────────────

function AdaptationChart({ adaptation }: { adaptation: EWRAdaptationRecord[] }) {
  const sorted = useMemo(
    () => [...adaptation].sort((a, b) => b.investment_m - a.investment_m),
    [adaptation]
  )

  const chartData = sorted.map((a) => ({
    name: a.measure_name.length > 30 ? a.measure_name.slice(0, 28) + '…' : a.measure_name,
    investment: a.investment_m,
    bcr: a.benefit_cost_ratio,
    status: a.status,
    fill: statusBadge(a.status).barColor,
  }))

  const CustomBar = (props: any) => {
    const { x, y, width, height, fill, index } = props
    const item = chartData[index]
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={item?.fill ?? fill} rx={3} />
        <text x={x + width + 5} y={y + height / 2 + 4} fill="#9ca3af" fontSize={10}>
          BCR {item?.bcr}x
        </text>
      </g>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 5, right: 90, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'Investment ($M)', position: 'insideBottom', fill: '#9ca3af', fontSize: 11, offset: -2 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          width={200}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f9fafb' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(value: number) => [`$${value}M`, 'Investment']}
        />
        <Bar dataKey="investment" name="Investment ($M)" shape={<CustomBar />} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExtremeWeatherResilienceAnalytics() {
  const [data, setData] = useState<EWRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getExtremeWeatherResilienceDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        <div className="animate-spin mr-3 h-6 w-6 border-2 border-amber-400 border-t-transparent rounded-full" />
        Loading Extreme Weather Resilience data...
      </div>
    )

  if (error)
    return (
      <div className="flex items-center justify-center h-96 text-red-400">
        <AlertTriangle className="mr-2" size={20} />
        {error}
      </div>
    )

  if (!data) return null

  const { events, demand_surges, network_impacts, adaptation, summary } = data

  const totalCostB = ((summary.total_economic_cost_m as number) / 1000).toFixed(1)
  const adaptInvM = Math.round(summary.total_adaptation_investment_m as number)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <CloudLightning size={28} className="text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Extreme Weather Energy Resilience Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            NEM heatwave demand surge, bushfire transmission impacts, flood outages, cyclone losses and climate adaptation investment
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Total Weather Events"
          value={String(summary.total_events as number)}
          sub={`${summary.heatwave_events as number} heatwave events`}
          icon={CloudLightning}
          accent="text-amber-400"
        />
        <KpiCard
          label="Total Economic Cost"
          value={`$${totalCostB}B`}
          sub="Direct energy sector costs"
          icon={Zap}
          accent="text-red-400"
        />
        <KpiCard
          label="Close to LOR Events"
          value={String(summary.close_to_lor_events as number)}
          sub="Demand surge events near reserve limits"
          icon={AlertTriangle}
          accent="text-orange-400"
        />
        <KpiCard
          label="Total Adaptation Investment"
          value={`$${adaptInvM}M`}
          sub={`${summary.adaptation_measures as number} measures across TNSPs/DNSPs`}
          icon={Thermometer}
          accent="text-green-400"
        />
      </div>

      {/* Weather Events Table */}
      <section className="bg-gray-800 rounded-xl border border-gray-700 mb-6">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CloudLightning size={18} className="text-amber-400" />
            NEM Extreme Weather Events
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Event Name</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Date Range</th>
                <th className="text-left px-4 py-3">Regions</th>
                <th className="text-right px-4 py-3">Demand Surge (MW)</th>
                <th className="text-right px-4 py-3">Gen Lost (MW)</th>
                <th className="text-right px-4 py-3">Customers</th>
                <th className="text-right px-4 py-3">Restoration (hr)</th>
                <th className="text-right px-4 py-3">Cost ($M)</th>
                <th className="text-left px-4 py-3">Attribution</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e: EWREventRecord) => (
                <tr
                  key={e.event_id}
                  className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-white">{e.event_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${eventTypeBadge(e.event_type)}`}>
                      {e.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                    {e.start_date} – {e.end_date}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">
                    {e.regions_affected.split(',').map((r) => (
                      <span key={r} className="mr-1 bg-gray-700 px-1 py-0.5 rounded">
                        {r}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-200">
                    {e.peak_demand_surge_mw > 0 ? e.peak_demand_surge_mw.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-300">
                    {e.generation_lost_mw.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-200">
                    {e.customers_without_power.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-200">{e.restoration_time_hr}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-300">
                    ${e.economic_cost_energy_m.toLocaleString()}M
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${attributionBadge(e.climate_attribution)}`}>
                      {e.climate_attribution}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Demand Surge Chart */}
      <section className="bg-gray-800 rounded-xl border border-gray-700 mb-6">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Thermometer size={18} className="text-red-400" />
            Heatwave Demand Surge Analysis
          </h2>
          <p className="text-gray-400 text-xs mt-1">
            Actual vs normal demand with reserve margin. Yellow line = reserve margin % (right axis).
          </p>
        </div>
        <div className="p-5">
          <DemandSurgeChart surges={demand_surges} />
        </div>
        {/* Demand Surge Details */}
        <div className="overflow-x-auto border-t border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Region</th>
                <th className="text-right px-4 py-2">Temp (°C)</th>
                <th className="text-right px-4 py-2">Actual (MW)</th>
                <th className="text-right px-4 py-2">Normal (MW)</th>
                <th className="text-right px-4 py-2">Surge (MW)</th>
                <th className="text-right px-4 py-2">Surge %</th>
                <th className="text-right px-4 py-2">Reserve %</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Response Actions</th>
              </tr>
            </thead>
            <tbody>
              {demand_surges.map((d: EWRDemandSurgeRecord) => (
                <tr
                  key={`${d.date}-${d.region}`}
                  className={`border-b border-gray-700 transition-colors ${d.close_to_lor ? 'bg-red-950 hover:bg-red-900' : 'hover:bg-gray-750'}`}
                >
                  <td className="px-4 py-2 text-gray-200">{d.date}</td>
                  <td className="px-4 py-2 font-medium text-white">{d.region}</td>
                  <td className="px-4 py-2 text-right text-orange-300">{d.temperature_max_c}°C</td>
                  <td className="px-4 py-2 text-right text-white">{d.demand_actual_mw.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{d.demand_normal_mw.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-red-300 font-semibold">+{d.demand_surge_mw.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-red-300">+{d.surge_pct.toFixed(1)}%</td>
                  <td className={`px-4 py-2 text-right font-semibold ${d.reserve_margin_pct < 10 ? 'text-red-400' : 'text-green-400'}`}>
                    {d.reserve_margin_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2">
                    {d.close_to_lor ? (
                      <span className="flex items-center gap-1 text-xs bg-red-700 text-red-100 px-2 py-0.5 rounded">
                        <AlertTriangle size={10} /> LOR WARNING
                      </span>
                    ) : (
                      <span className="text-xs bg-green-800 text-green-200 px-2 py-0.5 rounded">Normal</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs max-w-xs">{d.response_actions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Network Impacts Table */}
      <section className="bg-gray-800 rounded-xl border border-gray-700 mb-6">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap size={18} className="text-yellow-400" />
            Network & Transmission Impacts
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Event</th>
                <th className="text-left px-4 py-3">Network Operator</th>
                <th className="text-left px-4 py-3">Asset Type</th>
                <th className="text-left px-4 py-3">Asset Name</th>
                <th className="text-left px-4 py-3">Failure Type</th>
                <th className="text-right px-4 py-3">Cap. Loss (MW)</th>
                <th className="text-right px-4 py-3">Repair Cost ($M)</th>
                <th className="text-right px-4 py-3">Repair Time (days)</th>
                <th className="text-right px-4 py-3">Resilience Inv. ($M)</th>
              </tr>
            </thead>
            <tbody>
              {network_impacts.map((n: EWRNetworkImpactRecord, i: number) => (
                <tr key={i} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">{n.event_id}</td>
                  <td className="px-4 py-3 font-medium text-white">{n.network_operator}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${assetTypeBadge(n.asset_type)}`}>
                      {n.asset_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-200">{n.asset_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${failureTypeBadge(n.failure_type)}`}>
                      {n.failure_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-orange-300 font-semibold">
                    {n.capacity_loss_mw.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-red-300">${n.repair_cost_m}M</td>
                  <td className="px-4 py-3 text-right text-gray-200">{n.repair_time_days}d</td>
                  <td className="px-4 py-3 text-right text-yellow-300 font-semibold">
                    ${n.resilience_investment_needed_m}M
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-600 bg-gray-700">
                <td colSpan={5} className="px-4 py-2 text-gray-400 text-xs font-semibold">TOTALS</td>
                <td className="px-4 py-2 text-right text-orange-300 font-bold text-sm">
                  {network_impacts.reduce((s, n) => s + n.capacity_loss_mw, 0).toLocaleString()} MW
                </td>
                <td className="px-4 py-2 text-right text-red-300 font-bold text-sm">
                  ${network_impacts.reduce((s, n) => s + n.repair_cost_m, 0).toFixed(0)}M
                </td>
                <td className="px-4 py-2 text-right text-gray-300 font-bold text-sm">—</td>
                <td className="px-4 py-2 text-right text-yellow-300 font-bold text-sm">
                  ${network_impacts.reduce((s, n) => s + n.resilience_investment_needed_m, 0).toFixed(0)}M
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Adaptation Investment Chart & Table */}
      <section className="bg-gray-800 rounded-xl border border-gray-700 mb-6">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Thermometer size={18} className="text-green-400" />
            Climate Adaptation Investment by TNSP / DNSP
          </h2>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-500 inline-block" /> Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-yellow-500 inline-block" /> In Progress
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Planned
            </span>
          </div>
        </div>
        <div className="p-5">
          <AdaptationChart adaptation={adaptation} />
        </div>
        <div className="overflow-x-auto border-t border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Network Operator</th>
                <th className="text-left px-4 py-3">Measure</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Investment ($M)</th>
                <th className="text-right px-4 py-3">Risk Reduction</th>
                <th className="text-right px-4 py-3">Assets Protected</th>
                <th className="text-right px-4 py-3">Year</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">BCR</th>
              </tr>
            </thead>
            <tbody>
              {[...adaptation]
                .sort((a, b) => b.investment_m - a.investment_m)
                .map((a: EWRAdaptationRecord, i: number) => (
                  <tr key={i} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{a.network_operator}</td>
                    <td className="px-4 py-3 text-gray-200">{a.measure_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                        {a.measure_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white">
                      ${a.investment_m.toLocaleString()}M
                    </td>
                    <td className="px-4 py-3 text-right text-green-300">{a.risk_reduction_pct}%</td>
                    <td className="px-4 py-3 text-right text-gray-200">{a.assets_protected.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{a.implementation_year}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${statusBadge(a.status).cls}`}>
                        {a.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${a.benefit_cost_ratio >= 4 ? 'text-green-300' : a.benefit_cost_ratio >= 2.5 ? 'text-yellow-300' : 'text-orange-300'}`}>
                      {a.benefit_cost_ratio}x
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-600 bg-gray-700">
                <td colSpan={3} className="px-4 py-2 text-gray-400 text-xs font-semibold">TOTAL ADAPTATION INVESTMENT</td>
                <td className="px-4 py-2 text-right text-white font-bold text-sm">
                  ${adaptation.reduce((s, a) => s + a.investment_m, 0).toFixed(0)}M
                </td>
                <td colSpan={5} className="px-4 py-2 text-gray-500 text-xs">
                  Best BCR: {summary.highest_bcr_measure as string}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}
