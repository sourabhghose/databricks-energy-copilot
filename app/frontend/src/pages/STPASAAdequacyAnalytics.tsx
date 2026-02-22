import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
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
} from 'recharts'
import {
  getSTPASAAdequacyDashboard,
  STPADashboard,
  STPAOutlookRecord,
  STPARERTRecord,
} from '../api/client'

const REGION_COLORS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#a78bfa',
  QLD: '#f97316',
  SA: '#34d399',
  TAS: '#fbbf24',
}

const STATUS_COLORS: Record<string, string> = {
  Adequate: '#22c55e',
  Marginal: '#f59e0b',
  LOR1: '#f97316',
  LOR2: '#ef4444',
  LOR3: '#7f1d1d',
}

const STATUS_BADGE: Record<string, string> = {
  Adequate: 'bg-green-900 text-green-300',
  Marginal: 'bg-yellow-900 text-yellow-300',
  LOR1: 'bg-orange-900 text-orange-300',
  LOR2: 'bg-red-900 text-red-300',
  LOR3: 'bg-red-950 text-red-200',
}

const STAGE_BADGE: Record<string, string> = {
  'Pre-activation': 'bg-blue-900 text-blue-300',
  'Stage 1': 'bg-yellow-900 text-yellow-300',
  'Stage 2': 'bg-orange-900 text-orange-300',
  'Stage 3': 'bg-red-900 text-red-300',
}

const CHART_COLORS = [
  '#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ec4899',
  '#8b5cf6', '#f97316', '#14b8a6',
]

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-white text-3xl font-bold">{value}</p>
      {sub && <p className="text-gray-500 text-xs">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status}
    </span>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const cls = STAGE_BADGE[stage] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {stage}
    </span>
  )
}

export default function STPASAAdequacyAnalytics() {
  const [data, setData] = useState<STPADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string>('NSW')

  useEffect(() => {
    getSTPASAAdequacyDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-lg animate-pulse">Loading STPASA Adequacy data...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-lg">{error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const summary = data.summary

  // ── Supply vs Demand by region (aggregate by region, first supply record) ──
  const supplyByRegion = ['NSW', 'VIC', 'QLD', 'SA', 'TAS'].map(region => {
    const recs = data.supply_records.filter(s => s.region === region)
    if (!recs.length) return { region, supply: 0, demand: 0, reserve: 0, status: 'Adequate' }
    const avgSupply = recs.reduce((a, r) => a + r.scheduled_total_mw, 0) / recs.length
    const avgDemand = recs.reduce((a, r) => a + r.forecast_demand_mw, 0) / recs.length
    const avgReserve = recs.reduce((a, r) => a + r.reserve_pct, 0) / recs.length
    const lorRec = recs.find(r => r.LOR_level !== 'None')
    const status = lorRec ? lorRec.LOR_level : (avgReserve < 5 ? 'Marginal' : 'Adequate')
    return {
      region,
      supply: Math.round(avgSupply),
      demand: Math.round(avgDemand),
      reserve: Math.round(avgReserve * 10) / 10,
      status,
    }
  })

  // ── 7-day demand forecast (POE10/50/90) for selected region ──
  const forecastForRegion = data.demand_forecasts
    .filter(d => d.region === selectedRegion)
    .sort((a, b) => a.forecast_date.localeCompare(b.forecast_date))
    .map(d => ({
      date: d.forecast_date.slice(5),
      poe50: Math.round(d.forecast_50_mw),
      poe10: Math.round(d.forecast_10_mw),
      poe90: Math.round(d.forecast_90_mw),
      actual: d.actual_mw > 0 ? Math.round(d.actual_mw) : undefined,
    }))

  // ── Outage impact by technology ──
  const techMap: Record<string, { forced: number; planned: number; partial: number }> = {}
  data.outages.forEach(o => {
    if (!techMap[o.technology]) techMap[o.technology] = { forced: 0, planned: 0, partial: 0 }
    const key = o.outage_type === 'Forced' ? 'forced' : o.outage_type === 'Planned' ? 'planned' : 'partial'
    techMap[o.technology][key] += Math.abs(o.surplus_impact_mw)
  })
  const outageChartData = Object.entries(techMap).map(([tech, vals]) => ({
    tech: tech.replace(' ', '\n'),
    Forced: Math.round(vals.forced),
    Planned: Math.round(vals.planned),
    Partial: Math.round(vals.partial),
  }))

  // ── Interconnector flows ──
  const icFlowData = data.interconnector_records.map(ic => ({
    name: ic.interconnector,
    flow: Math.round(ic.scheduled_flow_mw),
    maxImport: Math.round(ic.max_import_mw),
    congested: ic.congested,
    direction: ic.flow_direction,
  }))
  // Aggregate by interconnector name, average flow
  const icAgg: Record<string, { totalFlow: number; count: number; congested: boolean }> = {}
  icFlowData.forEach(r => {
    if (!icAgg[r.name]) icAgg[r.name] = { totalFlow: 0, count: 0, congested: false }
    icAgg[r.name].totalFlow += r.flow
    icAgg[r.name].count += 1
    if (r.congested) icAgg[r.name].congested = true
  })
  const icChartData = Object.entries(icAgg).map(([ic, v]) => ({
    ic,
    avgFlow: Math.round(v.totalFlow / v.count),
    congested: v.congested,
  }))

  // Deduplicate outlooks: latest run_date per region+period for the outlook table
  const latestOutlooks: STPAOutlookRecord[] = []
  const seen = new Set<string>()
  ;[...data.outlooks]
    .sort((a, b) => b.run_date.localeCompare(a.run_date))
    .forEach(o => {
      const key = `${o.region}-${o.period}`
      if (!seen.has(key)) {
        seen.add(key)
        latestOutlooks.push(o)
      }
    })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            STPASA — Short-Term Projected Assessment of System Adequacy
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            7-day outlook, reserve adequacy, LOR assessment and RERT activation tracking
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Regions with LOR"
          value={Number(summary.regions_with_lor ?? 0)}
          sub="Active loss-of-reserve conditions"
        />
        <KpiCard
          label="Total Surplus MW"
          value={`${Number(summary.total_surplus_mw ?? 0).toLocaleString()} MW`}
          sub="Aggregate across adequate outlooks"
        />
        <KpiCard
          label="Avg Reserve %"
          value={`${Number(summary.avg_reserve_pct ?? 0).toFixed(1)}%`}
          sub="Supply records average"
        />
        <KpiCard
          label="RERT Activations YTD"
          value={Number(summary.rert_activations_ytd ?? 0)}
          sub="Reserve emergency activations"
        />
      </div>

      {/* Supply vs Demand by Region */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          Supply vs Demand by Region — Average Reserve Margin
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={supplyByRegion} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(1)}GW`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(value: number, name: string) => [`${value.toLocaleString()} MW`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="supply" name="Scheduled Supply MW" fill="#6366f1" radius={[4, 4, 0, 0]}>
              {supplyByRegion.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={
                    entry.status === 'Adequate' ? '#22c55e' :
                    entry.status === 'Marginal' ? '#f59e0b' :
                    '#ef4444'
                  }
                />
              ))}
            </Bar>
            <Bar dataKey="demand" name="Forecast Demand MW" fill="#64748b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 7-day Demand Forecast (POE10/50/90) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            7-Day Demand Forecast — POE10 / POE50 / POE90
          </h2>
          <select
            className="bg-gray-700 text-gray-200 text-sm rounded px-3 py-1 border border-gray-600"
            value={selectedRegion}
            onChange={e => setSelectedRegion(e.target.value)}
          >
            {['NSW', 'VIC', 'QLD', 'SA', 'TAS'].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={forecastForRegion} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(1)}GW`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(value: number, name: string) => [`${value.toLocaleString()} MW`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Line type="monotone" dataKey="poe10" name="POE10 (High)" stroke="#ef4444" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="poe50" name="POE50 (Median)" stroke="#60a5fa" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="poe90" name="POE90 (Low)" stroke="#34d399" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Two charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Outage Impact by Technology */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">
            Outage Impact by Technology (MW)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={outageChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="tech" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(value: number, name: string) => [`${value.toLocaleString()} MW`, name]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="Forced" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="Planned" fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="Partial" fill="#6366f1" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Interconnector Flows */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">
            Interconnector Avg Scheduled Flow (MW)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={icChartData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="ic" stroke="#9ca3af" tick={{ fontSize: 11 }} width={70} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(value: number, name: string) => [`${value.toLocaleString()} MW`, name]}
              />
              <Bar dataKey="avgFlow" name="Avg Flow MW" radius={[0, 4, 4, 0]}>
                {icChartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.congested ? '#ef4444' : CHART_COLORS[idx % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-gray-500 text-xs mt-2">Red = congested. Negative = export.</p>
        </div>
      </div>

      {/* STPASA Outlook Summary Table */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          STPASA Outlook Summary by Region
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="pb-2 pr-4 text-left">ID</th>
                <th className="pb-2 pr-4 text-left">Region</th>
                <th className="pb-2 pr-4 text-left">Period</th>
                <th className="pb-2 pr-4 text-right">Surplus MW</th>
                <th className="pb-2 pr-4 text-right">Sched Cap MW</th>
                <th className="pb-2 pr-4 text-right">Forecast Demand MW</th>
                <th className="pb-2 pr-4 text-right">Prob LRC %</th>
                <th className="pb-2 pr-4 text-center">Status</th>
                <th className="pb-2 text-center">RERT</th>
              </tr>
            </thead>
            <tbody>
              {latestOutlooks.map((o: STPAOutlookRecord) => (
                <tr
                  key={o.outlook_id}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="py-2 pr-4 font-mono text-xs text-gray-500">{o.outlook_id}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{
                        backgroundColor: (REGION_COLORS[o.region] ?? '#6b7280') + '33',
                        color: REGION_COLORS[o.region] ?? '#9ca3af',
                      }}
                    >
                      {o.region}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{o.period}</td>
                  <td
                    className={`py-2 pr-4 text-right font-medium ${o.surplus_mw >= 0 ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {o.surplus_mw.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right">{o.scheduled_capacity_mw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right">{o.forecast_demand_mw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right">{o.probability_lrc_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-center">
                    <StatusBadge status={o.reliability_status} />
                  </td>
                  <td className="py-2 text-center">
                    {o.triggered_rert ? (
                      <span className="text-red-400 font-semibold text-xs">TRIGGERED</span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RERT Activations Table */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          RERT Activation History
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="pb-2 pr-4 text-left">ID</th>
                <th className="pb-2 pr-4 text-left">Region</th>
                <th className="pb-2 pr-4 text-left">Date</th>
                <th className="pb-2 pr-4 text-center">Stage</th>
                <th className="pb-2 pr-4 text-left">Trigger</th>
                <th className="pb-2 pr-4 text-right">Contracted MW</th>
                <th className="pb-2 pr-4 text-right">Activated MW</th>
                <th className="pb-2 pr-4 text-left">Provider</th>
                <th className="pb-2 pr-4 text-right">Cost $M</th>
                <th className="pb-2 pr-4 text-right">Duration h</th>
                <th className="pb-2 text-right">Effectiveness</th>
              </tr>
            </thead>
            <tbody>
              {data.rert_activations.map((r: STPARERTRecord) => (
                <tr
                  key={r.rert_id}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="py-2 pr-4 font-mono text-xs text-gray-500">{r.rert_id}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{
                        backgroundColor: (REGION_COLORS[r.region] ?? '#6b7280') + '33',
                        color: REGION_COLORS[r.region] ?? '#9ca3af',
                      }}
                    >
                      {r.region}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{r.activation_date}</td>
                  <td className="py-2 pr-4 text-center">
                    <StageBadge stage={r.stage} />
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        backgroundColor: (STATUS_COLORS[r.trigger_lor_level] ?? '#6b7280') + '33',
                        color: STATUS_COLORS[r.trigger_lor_level] ?? '#9ca3af',
                      }}
                    >
                      {r.trigger_lor_level}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right">{r.contracted_mw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-amber-300">{r.activated_mw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-gray-400">{r.provider_type}</td>
                  <td className="py-2 pr-4 text-right">{r.activation_cost_m.toFixed(3)}</td>
                  <td className="py-2 pr-4 text-right">{r.duration_hours.toFixed(1)}</td>
                  <td className="py-2 text-right text-green-400">{r.effectiveness_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
