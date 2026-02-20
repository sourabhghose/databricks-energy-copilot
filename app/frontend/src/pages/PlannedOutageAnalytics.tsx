import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { Calendar } from 'lucide-react'
import {
  getPlannedOutageDashboard,
  PlannedOutageDashboard,
  GPOPlannedOutageRecord,
  GPOReserveMarginRecord,
  GPOOutageConflictRecord,
  GPOMaintenanceKpiRecord,
} from '../api/client'

// ---- Colour helpers ----
const OUTAGE_TYPE_BADGE: Record<string, string> = {
  FULL:     'bg-red-900/60 text-red-300 border border-red-700',
  PARTIAL:  'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
  DERATING: 'bg-orange-900/60 text-orange-300 border border-orange-700',
}

const REASON_LABEL: Record<string, string> = {
  MAJOR_OVERHAUL:           'Major Overhaul',
  MINOR_MAINTENANCE:        'Minor Maint.',
  REGULATORY_INSPECTION:    'Regulatory Insp.',
  FUEL_SYSTEM:              'Fuel System',
  ENVIRONMENTAL_COMPLIANCE: 'Env. Compliance',
}

const RESERVE_STATUS_BADGE: Record<string, string> = {
  ADEQUATE: 'bg-green-900/60 text-green-300 border border-green-700',
  TIGHT:    'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
  CRITICAL: 'bg-red-900/60 text-red-300 border border-red-700',
}

const RISK_BADGE: Record<string, string> = {
  LOW:      'bg-green-900/60 text-green-300 border border-green-700',
  MEDIUM:   'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
  HIGH:     'bg-orange-900/60 text-orange-300 border border-orange-700',
  CRITICAL: 'bg-red-900/60 text-red-300 border border-red-700',
}

const TECH_COLORS: Record<string, string> = {
  Coal:         '#6b7280',
  'Gas (CCGT)': '#f59e0b',
  'Gas (OCGT)': '#fbbf24',
  Hydro:        '#06b6d4',
  Wind:         '#6366f1',
  'Utility Solar': '#10b981',
  'Brown Coal':    '#78716c',
}

const REGION_LINE_COLORS: Record<string, string> = {
  NSW: '#6366f1',
  VIC: '#10b981',
  QLD: '#f59e0b',
  SA:  '#ef4444',
  TAS: '#06b6d4',
}

function fmt(n: number, dec = 0) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// ---- KPI derivations ----
function totalOfflineMW(outages: GPOPlannedOutageRecord[]): number {
  return outages.reduce((sum, o) => {
    if (o.outage_type === 'FULL') return sum + o.capacity_mw
    return sum + (o.capacity_mw - o.derated_capacity_mw)
  }, 0)
}

function tightestReserveMargin(margins: GPOReserveMarginRecord[]): number {
  if (!margins.length) return 0
  return Math.min(...margins.map(m => m.reserve_margin_pct))
}

function highestEforTech(kpis: GPOMaintenanceKpiRecord[]): string {
  if (!kpis.length) return 'N/A'
  const worst = kpis.reduce((prev, cur) =>
    cur.forced_outage_rate_pct > prev.forced_outage_rate_pct ? cur : prev
  )
  return worst.technology
}

// ---- Reserve margin chart data: one point per week, one series per region ----
function buildReserveChartData(margins: GPOReserveMarginRecord[]) {
  const weeks = [...new Set(margins.map(m => m.week))].sort()
  const regions = [...new Set(margins.map(m => m.region))]
  return weeks.map(week => {
    const row: Record<string, string | number> = { week }
    regions.forEach(region => {
      const rec = margins.find(m => m.week === week && m.region === region)
      if (rec) row[region] = rec.reserve_margin_pct
    })
    return row
  })
}

// ---- Main component ----
export default function PlannedOutageAnalytics() {
  const [data, setData] = useState<PlannedOutageDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRegions, setSelectedRegions] = useState<string[]>(['NSW', 'VIC', 'QLD', 'SA', 'TAS'])

  useEffect(() => {
    getPlannedOutageDashboard()
      .then(setData)
      .catch(err => setError(err.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        Loading planned outage data...
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

  const offlineMW = totalOfflineMW(data.outages)
  const tightestMargin = tightestReserveMargin(data.reserve_margins)
  const highestEfor = highestEforTech(data.kpis)
  const conflictCount = data.conflicts.length
  const allRegions = [...new Set(data.reserve_margins.map(m => m.region))]
  const reserveChartData = buildReserveChartData(data.reserve_margins)

  const toggleRegion = (region: string) => {
    setSelectedRegions(prev =>
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    )
  }

  return (
    <div className="p-6 space-y-8 bg-gray-950 min-h-screen text-gray-100">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Calendar size={26} className="text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-100">
            Generator Planned Outage &amp; Maintenance Scheduling Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            AEMO PASA planned outage submissions, maintenance windows, and reserve margin impacts — Q1 2025
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Capacity Offline</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{fmt(offlineMW)}</p>
          <p className="text-xs text-gray-500 mt-1">MW across {data.outages.length} planned outages</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Tightest Reserve Margin</p>
          <p className={`text-3xl font-bold mt-1 ${tightestMargin < 10 ? 'text-red-400' : tightestMargin < 15 ? 'text-yellow-400' : 'text-green-400'}`}>
            {fmt(tightestMargin, 1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Minimum across all regions &amp; weeks</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Outage Conflicts</p>
          <p className={`text-3xl font-bold mt-1 ${conflictCount >= 3 ? 'text-orange-400' : 'text-yellow-400'}`}>
            {conflictCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {data.conflicts.filter(c => c.aemo_intervention).length} requiring AEMO intervention
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Highest EFOR Technology</p>
          <p className="text-xl font-bold text-purple-400 mt-1">{highestEfor}</p>
          <p className="text-xs text-gray-500 mt-1">
            {fmt(data.kpis.find(k => k.technology === highestEfor)?.forced_outage_rate_pct ?? 0, 1)}% forced outage rate
          </p>
        </div>
      </div>

      {/* Gantt-style Outage Calendar Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-base font-semibold text-gray-100 mb-4">
          Planned Outage Calendar (Q1 2025) — {data.outages.length} Units
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-800">
                <th className="pb-2 pr-4 font-medium">Unit</th>
                <th className="pb-2 pr-4 font-medium">Technology</th>
                <th className="pb-2 pr-4 font-medium">Region</th>
                <th className="pb-2 pr-4 font-medium">Start</th>
                <th className="pb-2 pr-4 font-medium">End</th>
                <th className="pb-2 pr-4 font-medium text-right">Days</th>
                <th className="pb-2 pr-4 font-medium text-right">Cap. (MW)</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.outages.map((o: GPOPlannedOutageRecord) => (
                <tr key={o.outage_id} className="border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors">
                  <td className="py-2 pr-4 text-gray-100 font-medium whitespace-nowrap">{o.unit_name}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: (TECH_COLORS[o.technology] ?? '#6b7280') + '33',
                        color: TECH_COLORS[o.technology] ?? '#9ca3af',
                        border: `1px solid ${TECH_COLORS[o.technology] ?? '#6b7280'}66`,
                      }}
                    >
                      {o.technology}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{o.region}</td>
                  <td className="py-2 pr-4 text-gray-400 text-xs font-mono">{o.start_date}</td>
                  <td className="py-2 pr-4 text-gray-400 text-xs font-mono">{o.end_date}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{o.duration_days}</td>
                  <td className="py-2 pr-4 text-right text-gray-100 font-medium">{fmt(o.capacity_mw)}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${OUTAGE_TYPE_BADGE[o.outage_type]}`}>
                      {o.outage_type}
                    </span>
                  </td>
                  <td className="py-2 text-gray-400 text-xs">{REASON_LABEL[o.reason] ?? o.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reserve Margin Line Chart */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-100">
            Weekly Reserve Margin by Region (%)
          </h2>
          <div className="flex gap-2 flex-wrap">
            {allRegions.map(region => (
              <button
                key={region}
                onClick={() => toggleRegion(region)}
                className="px-2 py-0.5 rounded text-xs font-medium border transition-colors"
                style={{
                  borderColor: REGION_LINE_COLORS[region] ?? '#6b7280',
                  color: selectedRegions.includes(region) ? '#f9fafb' : '#6b7280',
                  backgroundColor: selectedRegions.includes(region)
                    ? (REGION_LINE_COLORS[region] ?? '#6b7280') + '33'
                    : 'transparent',
                }}
              >
                {region}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={reserveChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={v => `${v}%`}
              domain={[0, 80]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
              itemStyle={{ color: '#9ca3af' }}
              formatter={(val: number) => [`${fmt(val, 1)}%`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <ReferenceLine
              y={15}
              stroke="#ef4444"
              strokeDasharray="6 3"
              label={{ value: '15% Critical', fill: '#ef4444', fontSize: 11 }}
            />
            {allRegions
              .filter(r => selectedRegions.includes(r))
              .map(region => (
                <Line
                  key={region}
                  type="monotone"
                  dataKey={region}
                  stroke={REGION_LINE_COLORS[region] ?? '#6b7280'}
                  strokeWidth={2}
                  dot={{ fill: REGION_LINE_COLORS[region] ?? '#6b7280', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Two-column: Conflict Risk Matrix + Maintenance KPI Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Conflict Risk Matrix */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-base font-semibold text-gray-100 mb-4">
            Outage Conflict Risk Matrix
          </h2>
          <div className="space-y-3">
            {data.conflicts.map((c: GPOOutageConflictRecord) => (
              <div
                key={c.conflict_id}
                className={`rounded-lg border p-3 ${
                  c.risk_level === 'CRITICAL' ? 'border-red-700 bg-red-950/30' :
                  c.risk_level === 'HIGH'     ? 'border-orange-700 bg-orange-950/30' :
                  c.risk_level === 'MEDIUM'   ? 'border-yellow-700 bg-yellow-950/20' :
                                                'border-green-800 bg-green-950/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-gray-400">{c.conflict_id}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${RISK_BADGE[c.risk_level]}`}>
                      {c.risk_level}
                    </span>
                    {c.aemo_intervention && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-900/60 text-purple-300 border border-purple-700">
                        AEMO Action
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-200 font-medium">
                  {c.unit_a} <span className="text-gray-500 mx-1">vs</span> {c.unit_b}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                  <span>Region: <span className="text-gray-300">{c.region}</span></span>
                  <span>Overlap: <span className="text-gray-300">{c.overlap_start} — {c.overlap_end}</span></span>
                  <span>Combined: <span className="text-gray-300">{fmt(c.combined_capacity_mw)} MW</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance KPI Bar Chart */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-base font-semibold text-gray-100 mb-4">
            Planned Outage Rate by Technology (%)
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={[...data.kpis].sort((a, b) => b.planned_outage_rate_pct - a.planned_outage_rate_pct)}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={v => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="technology"
                width={110}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
                formatter={(val: number) => [`${fmt(val, 1)}%`, 'Planned Outage Rate']}
              />
              <Bar dataKey="planned_outage_rate_pct" radius={[0, 4, 4, 0]} name="Planned Outage Rate (%)">
                {data.kpis
                  .slice()
                  .sort((a, b) => b.planned_outage_rate_pct - a.planned_outage_rate_pct)
                  .map((entry) => (
                    <Cell key={entry.technology} fill={TECH_COLORS[entry.technology] ?? '#6366f1'} />
                  ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* KPI summary table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800">
                  <th className="pb-1 pr-3 font-medium">Technology</th>
                  <th className="pb-1 pr-3 text-right font-medium">EFOR %</th>
                  <th className="pb-1 pr-3 text-right font-medium">POR %</th>
                  <th className="pb-1 pr-3 text-right font-medium">Avg Days/yr</th>
                  <th className="pb-1 text-right font-medium">Reliability</th>
                </tr>
              </thead>
              <tbody>
                {data.kpis.map((k: GPOMaintenanceKpiRecord) => (
                  <tr key={k.technology} className="border-b border-gray-800/50">
                    <td className="py-1 pr-3 text-gray-300">{k.technology}</td>
                    <td className={`py-1 pr-3 text-right font-medium ${k.forced_outage_rate_pct > 8 ? 'text-red-400' : k.forced_outage_rate_pct > 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {fmt(k.forced_outage_rate_pct, 1)}
                    </td>
                    <td className="py-1 pr-3 text-right text-gray-300">{fmt(k.planned_outage_rate_pct, 1)}</td>
                    <td className="py-1 pr-3 text-right text-gray-300">{fmt(k.avg_planned_days_yr, 0)}</td>
                    <td className={`py-1 text-right font-medium ${k.reliability_index >= 92 ? 'text-green-400' : k.reliability_index >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {fmt(k.reliability_index, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-600 text-right">
        Source: AEMO PASA submissions, MT PASA weekly reports, AEMC reliability standards. Data: Q1 2025.
      </div>
    </div>
  )
}
