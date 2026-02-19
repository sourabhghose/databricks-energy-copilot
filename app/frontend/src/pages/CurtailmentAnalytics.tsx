import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts'
import { Wind, AlertTriangle, TrendingDown, Zap, RefreshCw } from 'lucide-react'
import { api, CurtailmentDashboard, CurtailmentEvent, MinimumOperationalDemandRecord, RenewableIntegrationLimit } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function causeBadgeClass(cause: string): string {
  switch (cause) {
    case 'System Strength':  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'Thermal Limit':    return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    case 'Voltage':          return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    case 'Frequency Control':return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    default:                 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  }
}

function causeBarColor(cause: string): string {
  switch (cause) {
    case 'System Strength':  return '#ef4444'
    case 'Thermal Limit':    return '#f97316'
    case 'Voltage':          return '#f59e0b'
    case 'Frequency Control':return '#3b82f6'
    default:                 return '#6b7280'
  }
}

function regionChipClass(region: string): string {
  switch (region) {
    case 'NSW1': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'QLD1': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    case 'VIC1': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'SA1':  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'TAS1': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
    default:     return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  }
}

function techChipClass(technology: string): string {
  switch (technology) {
    case 'Wind':   return 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200'
    case 'Solar':  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'Hybrid': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
    default:       return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  unit,
  subtitle,
  Icon,
  iconClass,
}: {
  title: string
  value: string | number
  unit?: string
  subtitle?: string
  Icon: React.ElementType
  iconClass?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</span>
        <Icon size={18} className={iconClass ?? 'text-gray-400'} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
        {unit && <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>}
      </div>
      {subtitle && <span className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>}
    </div>
  )
}

function CurtailmentEventsTable({ events }: { events: CurtailmentEvent[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Curtailment Events</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Recent renewable curtailment events by region, technology and cause</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Event ID</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Region</th>
              <th className="px-4 py-3 text-left">Technology</th>
              <th className="px-4 py-3 text-right">Curtailed MWh</th>
              <th className="px-4 py-3 text-right">Curtailed %</th>
              <th className="px-4 py-3 text-right">Duration (min)</th>
              <th className="px-4 py-3 text-left">Cause</th>
              <th className="px-4 py-3 text-right">Peak Available MW</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {events.map((e) => (
              <tr key={e.event_id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{e.event_id}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{e.date}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${regionChipClass(e.region)}`}>
                    {e.region}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${techChipClass(e.technology)}`}>
                    {e.technology}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                  {e.curtailed_mwh.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={e.curtailed_pct > 40 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-700 dark:text-gray-300'}>
                    {e.curtailed_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{e.duration_minutes}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${causeBadgeClass(e.cause)}`}>
                    {e.cause}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                  {e.peak_available_mw.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ModRecordsTable({ records }: { records: MinimumOperationalDemandRecord[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Minimum Operational Demand Records</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Days when NEM regions hit minimum demand levels with high renewable penetration</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Region</th>
              <th className="px-4 py-3 text-right">Min Demand MW</th>
              <th className="px-4 py-3 text-center">Time</th>
              <th className="px-4 py-3 text-left">Renewable Share</th>
              <th className="px-4 py-3 text-right">Renewable MW</th>
              <th className="px-4 py-3 text-right">Storage Charging MW</th>
              <th className="px-4 py-3 text-right">Exports MW</th>
              <th className="px-4 py-3 text-center">Record</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {records.map((r, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.date}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${regionChipClass(r.region)}`}>
                    {r.region}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                  {r.min_demand_mw.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{r.min_demand_time}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 min-w-16">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${Math.min(r.renewable_share_pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-10 text-right">
                      {r.renewable_share_pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                  {r.instantaneous_renewable_mw.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                  {r.storage_charging_mw.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                  {r.exports_mw.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center">
                  {r.record_broken ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Record
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function IntegrationLimitsTable({ limits }: { limits: RenewableIntegrationLimit[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Renewable Integration Limits</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Current binding limits on renewable generation by region and constraint type</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Region</th>
              <th className="px-4 py-3 text-left">Limit Type</th>
              <th className="px-4 py-3 text-right">Current Limit MW</th>
              <th className="px-4 py-3 text-right">Headroom MW</th>
              <th className="px-4 py-3 text-left">Mitigation Project</th>
              <th className="px-4 py-3 text-center">Mitigation Year</th>
              <th className="px-4 py-3 text-left">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {limits.map((l, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${regionChipClass(l.region)}`}>
                    {l.region}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${causeBadgeClass(l.limit_type)}`}>
                    {l.limit_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                  {l.current_limit_mw.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={l.headroom_mw < 0
                    ? 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : 'text-green-700 dark:text-green-400 font-medium'
                  }>
                    {l.headroom_mw < 0 ? '' : '+'}{l.headroom_mw.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-xs">{l.mitigation_project}</td>
                <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{l.mitigation_year}</td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-sm">{l.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart components
// ---------------------------------------------------------------------------

function CurtailmentByRegionChart({ events }: { events: CurtailmentEvent[] }) {
  const byRegion: Record<string, number> = {}
  for (const e of events) {
    byRegion[e.region] = (byRegion[e.region] ?? 0) + e.curtailed_mwh
  }
  const data = Object.entries(byRegion).map(([region, mwh]) => ({ region, mwh: Math.round(mwh) }))
    .sort((a, b) => b.mwh - a.mwh)

  const regionColors: Record<string, string> = {
    SA1: '#ef4444', VIC1: '#22c55e', QLD1: '#a855f7', NSW1: '#3b82f6', TAS1: '#14b8a6',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Curtailment by Region (MWh)</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="region" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => [`${v.toLocaleString()} MWh`, 'Curtailed']} />
          <Bar dataKey="mwh" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.region} fill={regionColors[entry.region] ?? '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CurtailmentByCauseChart({ events }: { events: CurtailmentEvent[] }) {
  const byCause: Record<string, number> = {}
  for (const e of events) {
    byCause[e.cause] = (byCause[e.cause] ?? 0) + e.curtailed_mwh
  }
  const data = Object.entries(byCause).map(([cause, value]) => ({
    name: cause,
    value: Math.round(value),
    fill: causeBarColor(cause),
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Curtailment by Cause (MWh)</h2>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => [`${v.toLocaleString()} MWh`, 'Curtailed']} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function HeadroomChart({ limits }: { limits: RenewableIntegrationLimit[] }) {
  const data = limits.map((l) => ({
    label: `${l.region} ${l.limit_type.split(' ')[0]}`,
    headroom: l.headroom_mw,
    fill: l.headroom_mw < 0 ? '#ef4444' : '#22c55e',
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Integration Limit Headroom (MW)</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => [`${v.toLocaleString()} MW`, 'Headroom']} />
          <Bar dataKey="headroom" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CurtailmentAnalytics() {
  const [dashboard, setDashboard] = useState<CurtailmentDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Filter state
  const [regionFilter, setRegionFilter] = useState<string>('')
  const [causeFilter, setCauseFilter] = useState<string>('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getCurtailmentDashboard()
      setDashboard(data)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch curtailment data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredEvents = dashboard?.curtailment_events.filter((e) => {
    if (regionFilter && e.region !== regionFilter) return false
    if (causeFilter && e.cause !== causeFilter) return false
    return true
  }) ?? []

  const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const CAUSES = ['System Strength', 'Thermal Limit', 'Voltage', 'Frequency Control']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading curtailment data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertTriangle size={24} className="text-red-500" />
        <span className="ml-2 text-red-600 dark:text-red-400">{error}</span>
        <button
          onClick={fetchData}
          className="ml-4 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!dashboard) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <TrendingDown size={22} className="text-red-500" />
            Renewable Curtailment & Integration Analytics
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Curtailment events, minimum operational demand records and renewable integration limits — NEM
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Curtailment YTD"
          value={dashboard.total_curtailment_gwh_ytd.toFixed(2)}
          unit="GWh"
          subtitle={`${dashboard.curtailment_events_ytd} events recorded`}
          Icon={Wind}
          iconClass="text-red-500"
        />
        <KpiCard
          title="Events YTD"
          value={dashboard.curtailment_events_ytd}
          subtitle={`Worst region: ${dashboard.worst_region}`}
          Icon={AlertTriangle}
          iconClass="text-orange-500"
        />
        <KpiCard
          title="Lowest MOD Record"
          value={dashboard.lowest_mod_record_mw.toLocaleString()}
          unit="MW"
          subtitle={`Recorded ${dashboard.lowest_mod_date}`}
          Icon={TrendingDown}
          iconClass="text-blue-500"
        />
        <KpiCard
          title="Renewable Penetration Record"
          value={dashboard.renewable_penetration_record_pct.toFixed(1)}
          unit="%"
          subtitle={`Achieved ${dashboard.renewable_penetration_record_date}`}
          Icon={Zap}
          iconClass="text-green-500"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CurtailmentByRegionChart events={dashboard.curtailment_events} />
        <CurtailmentByCauseChart events={dashboard.curtailment_events} />
        <HeadroomChart limits={dashboard.integration_limits} />
      </div>

      {/* Filters for events table */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Filter events:</span>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Regions</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={causeFilter}
          onChange={(e) => setCauseFilter(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Causes</option>
          {CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(regionFilter || causeFilter) && (
          <button
            onClick={() => { setRegionFilter(''); setCauseFilter('') }}
            className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} shown
        </span>
      </div>

      {/* Curtailment events table */}
      <CurtailmentEventsTable events={filteredEvents} />

      {/* MOD records table */}
      <ModRecordsTable records={dashboard.mod_records} />

      {/* Integration limits table */}
      <IntegrationLimitsTable limits={dashboard.integration_limits} />
    </div>
  )
}
