import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { AlertTriangle, Activity } from 'lucide-react'
import { api } from '../api/client'
import type { PasaAdequacyDashboard, PasaPeriod, ForcedOutageRecord, GeneratorReliabilityStats } from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
const REGION_COLORS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  SA1:  '#ef4444',
  VIC1: '#10b981',
}

function lorBadge(lor: string) {
  const map: Record<string, string> = {
    NONE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    LOR1: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    LOR2: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    LOR3: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }
  return map[lor] ?? 'bg-gray-100 text-gray-700'
}

function outageTypeBadge(type: string) {
  const map: Record<string, string> = {
    FORCED:  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    PLANNED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    PARTIAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  }
  return map[type] ?? 'bg-gray-100 text-gray-700'
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE:   'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    CLEARED:  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    EXTENDED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}

function fuelChip(fuel: string) {
  const map: Record<string, string> = {
    BLACK_COAL: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    BROWN_COAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    GAS_CCGT:   'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    GAS_OCGT:   'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
    WIND:       'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    SOLAR:      'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  }
  return map[fuel] ?? 'bg-gray-100 text-gray-700'
}

function regionChip(region: string) {
  const map: Record<string, string> = {
    NSW1: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    QLD1: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    SA1:  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    VIC1: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    TAS1: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  }
  return map[region] ?? 'bg-gray-100 text-gray-700'
}

function eforColor(efor: number) {
  if (efor >= 10) return 'text-red-600 dark:text-red-400 font-semibold'
  if (efor >= 5)  return 'text-amber-600 dark:text-amber-400 font-semibold'
  return 'text-green-600 dark:text-green-400'
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------
function KpiCard({
  title,
  value,
  sub,
  alert,
}: {
  title: string
  value: string | number
  sub?: string
  alert?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 bg-white dark:bg-gray-800 shadow-sm flex flex-col gap-1 ${
        alert ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {title}
      </p>
      <p
        className={`text-2xl font-bold ${
          alert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reserve margin bar chart data transform
// ---------------------------------------------------------------------------
function buildChartData(periods: PasaPeriod[]) {
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']
  return weeks.map((week) => {
    const row: Record<string, string | number> = { week }
    for (const region of ['NSW1', 'QLD1', 'SA1', 'VIC1']) {
      const match = periods.find((p) => p.period === week && p.region === region)
      if (match) row[region] = match.reserve_margin_pct
    }
    return row
  })
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function PasaAnalytics() {
  const [dashboard, setDashboard] = useState<PasaAdequacyDashboard | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // filters
  const [regionFilter, setRegionFilter]   = useState<string>('ALL')
  const [statusFilter, setStatusFilter]   = useState<string>('ALL')

  useEffect(() => {
    setLoading(true)
    api
      .getPasaDashboard()
      .then((d) => {
        setDashboard(d)
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        <Activity className="animate-pulse mr-2" size={20} />
        Loading PASA data...
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <AlertTriangle className="mr-2" size={20} />
        {error ?? 'No data available'}
      </div>
    )
  }

  // Filtered periods for table
  const filteredPeriods: PasaPeriod[] =
    regionFilter === 'ALL'
      ? dashboard.pasa_periods
      : dashboard.pasa_periods.filter((p) => p.region === regionFilter)

  // Filtered outages for table
  const filteredOutages: ForcedOutageRecord[] = dashboard.forced_outages.filter((o) => {
    if (regionFilter !== 'ALL' && o.region !== regionFilter) return false
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false
    return true
  })

  const chartData = buildChartData(dashboard.pasa_periods)

  const lorAlert = dashboard.regions_with_lor_risk.length > 0

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="text-amber-500" size={26} />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              PASA &amp; System Adequacy
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Projected Assessment of System Adequacy — Generator Forced Outage Statistics
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
          5-Week Outlook
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* KPI Cards                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Min Reserve Margin"
          value={`${dashboard.min_reserve_margin_mw.toFixed(0)} MW`}
          sub={`Region: ${dashboard.min_reserve_margin_region}`}
        />
        <KpiCard
          title="Regions with LOR Risk"
          value={dashboard.regions_with_lor_risk.length}
          sub={
            lorAlert
              ? dashboard.regions_with_lor_risk.join(', ')
              : 'All regions adequate'
          }
          alert={lorAlert}
        />
        <KpiCard
          title="Active Forced Outages"
          value={dashboard.total_forced_outages_active}
          sub="Units currently offline"
          alert={dashboard.total_forced_outages_active > 3}
        />
        <KpiCard
          title="Total MW Forced Out"
          value={`${dashboard.total_mw_forced_out.toFixed(0)} MW`}
          sub={`${dashboard.high_efor_generators} high-EFOR generators`}
          alert={dashboard.total_mw_forced_out > 500}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Reserve Margin Bar Chart                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
          PASA Reserve Margin by Region &amp; Week (%)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              domain={[0, 50]}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f9fafb',
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'LOR1 10%', position: 'right', fontSize: 11, fill: '#f59e0b' }} />
            <ReferenceLine y={5}  stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'LOR3 5%',  position: 'right', fontSize: 11, fill: '#ef4444' }} />
            <Bar dataKey="NSW1" fill={REGION_COLORS.NSW1} radius={[3, 3, 0, 0]} />
            <Bar dataKey="QLD1" fill={REGION_COLORS.QLD1} radius={[3, 3, 0, 0]} />
            <Bar dataKey="SA1"  fill={REGION_COLORS.SA1}  radius={[3, 3, 0, 0]} />
            <Bar dataKey="VIC1" fill={REGION_COLORS.VIC1} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Filter row                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Region</label>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <option value="ALL">All Regions</option>
            <option value="NSW1">NSW1</option>
            <option value="QLD1">QLD1</option>
            <option value="SA1">SA1</option>
            <option value="VIC1">VIC1</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Outage Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CLEARED">Cleared</option>
            <option value="EXTENDED">Extended</option>
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* PASA Periods Table                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            PASA Assessment Periods
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {[
                  'Period', 'Start – End', 'Region', 'Peak Demand (MW)',
                  'Available (MW)', 'Reserve Margin (MW)', 'Reserve Margin %',
                  'LOR Risk', 'Shortage Prob %',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredPeriods.map((p, i) => (
                <tr
                  key={i}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                    {p.period}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {p.start_date} – {p.end_date}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${regionChip(p.region)}`}>
                      {p.region}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                    {p.peak_demand_mw.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                    {p.total_available_mw.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                    {p.reserve_margin_mw.toFixed(0)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                    {p.reserve_margin_pct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${lorBadge(p.lor_risk)}`}>
                      {p.lor_risk}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                    {p.probability_shortage_pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPeriods.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">No periods match the selected filters.</p>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Active Forced Outages Table                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Forced Outage Log
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {filteredOutages.length} records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {[
                  'DUID', 'Station', 'Fuel', 'Region', 'Type', 'Cause',
                  'MW Lost', 'Outage Start', 'Status', 'Return to Service',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredOutages.map((o, i) => (
                <tr
                  key={i}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                    {o.duid}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    {o.station_name}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${fuelChip(o.fuel_type)}`}>
                      {o.fuel_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${regionChip(o.region)}`}>
                      {o.region}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${outageTypeBadge(o.outage_type)}`}>
                      {o.outage_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {o.cause}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-red-600 dark:text-red-400">
                    {o.mw_lost.toFixed(0)}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {o.outage_start.replace('T', ' ').slice(0, 16)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(o.status)}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {o.return_to_service
                      ? o.return_to_service.replace('T', ' ').slice(0, 16)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOutages.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">No outages match the selected filters.</p>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Generator Reliability Stats Table                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Generator Reliability Statistics
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {[
                  'Station', 'Fuel', 'Region', 'Capacity (MW)',
                  'EFOR %', 'Planned OR %', 'Availability %',
                  'Forced Outages (12m)', 'Avg Duration (hrs)', 'UEUE %',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {dashboard.reliability_stats.map((s: GeneratorReliabilityStats, i) => (
                <tr
                  key={i}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                    {s.station_name}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${fuelChip(s.fuel_type)}`}>
                      {s.fuel_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${regionChip(s.region)}`}>
                      {s.region}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                    {s.capacity_mw.toFixed(0)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${eforColor(s.equivalent_forced_outage_rate_pct)}`}>
                    {s.equivalent_forced_outage_rate_pct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                    {s.planned_outage_rate_pct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                    {s.availability_pct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                    {s.forced_outages_last_12m}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                    {s.avg_outage_duration_hrs.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                    {s.unplanned_energy_unavailability_pct.toFixed(1)}%
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
