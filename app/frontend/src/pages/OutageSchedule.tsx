import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Clock, CheckCircle, Wrench, RefreshCw } from 'lucide-react'
import { api, PasaDashboard, OutageRecord, PasaRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-AU', {
      timeZone: 'Australia/Sydney',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return iso
  }
}

function formatReserve(mw: number): string {
  return `${mw.toLocaleString('en-AU', { maximumFractionDigits: 0 })} MW`
}

// ---------------------------------------------------------------------------
// Badge components
// ---------------------------------------------------------------------------

interface BadgeProps {
  label: string
  variant: 'red' | 'amber' | 'blue' | 'green' | 'purple' | 'gray'
  size?: 'sm' | 'xs'
}

function Badge({ label, variant, size = 'sm' }: BadgeProps) {
  const colorMap: Record<string, string> = {
    red:    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    amber:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    blue:   'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    green:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    gray:   'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }
  const sizeMap: Record<string, string> = {
    sm: 'px-2 py-0.5 text-xs font-medium rounded',
    xs: 'px-1.5 py-0.5 text-[10px] font-medium rounded',
  }
  return (
    <span className={`inline-flex items-center ${sizeMap[size]} ${colorMap[variant]}`}>
      {label}
    </span>
  )
}

function outageTypeBadge(outageType: string) {
  if (outageType === 'FORCED') return <Badge label="FORCED" variant="red" />
  if (outageType === 'PLANNED') return <Badge label="PLANNED" variant="amber" />
  if (outageType === 'PARTIAL') return <Badge label="PARTIAL" variant="blue" />
  return <Badge label={outageType} variant="gray" />
}

function pasaStatusBadge(status: string) {
  const map: Record<string, BadgeProps['variant']> = {
    SURPLUS:  'green',
    ADEQUATE: 'blue',
    LOR1:     'amber',
    LOR2:     'red',
    LOR3:     'red',
  }
  return <Badge label={status} variant={map[status] ?? 'gray'} />
}

// ---------------------------------------------------------------------------
// Capacity Impact cards
// ---------------------------------------------------------------------------

interface CapacityCardsProps {
  dashboard: PasaDashboard
  regionFilter: string
}

function CapacityCards({ dashboard, regionFilter }: CapacityCardsProps) {
  const filtered = regionFilter === 'ALL'
    ? dashboard.active_outages
    : dashboard.active_outages.filter(o => o.region === regionFilter)

  const totalLost = filtered.reduce((sum, o) => sum + o.capacity_lost_mw, 0)
  const forcedCount = filtered.filter(o => o.outage_type === 'FORCED').length
  const plannedCount = filtered.filter(o => o.outage_type === 'PLANNED').length

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {/* Total Capacity Lost */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start justify-between mb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Total Capacity Lost
          </span>
          <Badge label="ACTIVE" variant="red" size="xs" />
        </div>
        <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
          {totalLost.toLocaleString('en-AU', { maximumFractionDigits: 0 })} MW
        </div>
        <div className="text-xs text-gray-400 mt-1">across active outages</div>
      </div>

      {/* Active Forced Outages */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start justify-between mb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Active Forced Outages
          </span>
          <Badge label={String(forcedCount)} variant="red" size="xs" />
        </div>
        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">
          {forcedCount}
        </div>
        <div className="text-xs text-gray-400 mt-1">unplanned generator failures</div>
      </div>

      {/* Planned Outages (Active) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start justify-between mb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Planned Outages (Active)
          </span>
          <Badge label={String(plannedCount)} variant="amber" size="xs" />
        </div>
        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">
          {plannedCount}
        </div>
        <div className="text-xs text-gray-400 mt-1">scheduled maintenance in progress</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PASA 7-Day Outlook timeline
// ---------------------------------------------------------------------------

interface PasaOutlookProps {
  outlook: PasaRecord[]
}

function PasaOutlook({ outlook }: PasaOutlookProps) {
  const bgMap: Record<string, string> = {
    SURPLUS:  'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
    ADEQUATE: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
    LOR1:     'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
    LOR2:     'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700',
    LOR3:     'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
  }
  const reserveColorMap: Record<string, string> = {
    SURPLUS:  'text-green-700 dark:text-green-400',
    ADEQUATE: 'text-blue-700 dark:text-blue-400',
    LOR1:     'text-amber-700 dark:text-amber-400',
    LOR2:     'text-orange-700 dark:text-orange-400',
    LOR3:     'text-red-700 dark:text-red-400',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
        <Clock size={16} className="text-blue-500" />
        PASA 7-Day Adequacy Outlook
      </h2>
      <div className="grid grid-cols-7 gap-2">
        {outlook.map((rec) => (
          <div
            key={rec.interval_date}
            className={`rounded border p-2 text-center ${bgMap[rec.reserve_status] ?? 'bg-gray-50 border-gray-200'}`}
          >
            <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
              {formatDate(rec.interval_date)}
            </div>
            <div className={`text-sm font-bold ${reserveColorMap[rec.reserve_status] ?? 'text-gray-700'}`}>
              {formatReserve(rec.reserve_mw)}
            </div>
            <div className="mt-1">
              {pasaStatusBadge(rec.reserve_status)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              {rec.surplus_pct.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>SURPLUS (&gt;25%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>ADEQUATE (&ge;750 MW)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>LOR1 (450-750 MW)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>LOR2 (0-450 MW)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>LOR3 (&lt;0 MW)
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Active Outages table
// ---------------------------------------------------------------------------

interface ActiveOutagesTableProps {
  outages: OutageRecord[]
  regionFilter: string
}

function ActiveOutagesTable({ outages, regionFilter }: ActiveOutagesTableProps) {
  const filtered = regionFilter === 'ALL'
    ? outages
    : outages.filter(o => o.region === regionFilter)

  // Sort: FORCED first, then PLANNED, then PARTIAL
  const typeOrder: Record<string, number> = { FORCED: 0, PLANNED: 1, PARTIAL: 2 }
  const sorted = [...filtered].sort(
    (a, b) => (typeOrder[a.outage_type] ?? 99) - (typeOrder[b.outage_type] ?? 99)
  )

  if (sorted.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6 text-center text-gray-400 text-sm">
        No active outages for the selected region.
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-500" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Active Outages
        </h2>
        <Badge label={String(sorted.length)} variant="red" size="xs" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Station</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Region</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Fuel</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Type</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium text-right">Capacity Lost</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Started</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Est. Return</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Reason</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((outage, idx) => (
              <tr
                key={outage.outage_id}
                className={`border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                  idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/20'
                }`}
              >
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">
                  {outage.station_name}
                  <div className="text-[10px] text-gray-400">{outage.duid}</div>
                </td>
                <td className="px-3 py-2">
                  <Badge label={outage.region} variant="gray" size="xs" />
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{outage.fuel_type}</td>
                <td className="px-3 py-2">{outageTypeBadge(outage.outage_type)}</td>
                <td className="px-3 py-2 text-right font-mono font-medium text-red-600 dark:text-red-400">
                  {outage.capacity_lost_mw.toLocaleString('en-AU')} MW
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                  {formatDateTime(outage.start_time)}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                  {outage.end_time ? formatDateTime(outage.end_time) : (
                    <span className="text-red-500 font-medium">Ongoing</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[220px]">
                  <span className="line-clamp-2">{outage.reason}</span>
                </td>
                <td className="px-3 py-2">
                  <Badge label="ACTIVE" variant="red" size="xs" />
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
// Upcoming Outages section (collapsible with timeline view)
// ---------------------------------------------------------------------------

interface UpcomingOutagesProps {
  outages: OutageRecord[]
  regionFilter: string
}

function UpcomingOutages({ outages, regionFilter }: UpcomingOutagesProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table')

  const filtered = regionFilter === 'ALL'
    ? outages
    : outages.filter(o => o.region === regionFilter)

  const sorted = [...filtered].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )

  // Build 14-day timeline bars
  const now = Date.now()
  const DAY_MS = 24 * 60 * 60 * 1000
  const WINDOW_MS = 14 * DAY_MS

  function toTimelinePct(ts: string): number {
    const offset = new Date(ts).getTime() - now
    return Math.max(0, Math.min(100, (offset / WINDOW_MS) * 100))
  }

  function toWidthPct(start: string, end: string): number {
    const s = Math.max(0, new Date(start).getTime() - now)
    const e = Math.min(WINDOW_MS, new Date(end).getTime() - now)
    return Math.max(1, ((e - s) / WINDOW_MS) * 100)
  }

  const typeColorMap: Record<string, string> = {
    FORCED:  'bg-red-400',
    PLANNED: 'bg-amber-400',
    PARTIAL: 'bg-blue-400',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Upcoming Outages (Next 14 Days)
          </h2>
          <Badge label={String(sorted.length)} variant="amber" size="xs" />
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && (
            <div className="flex rounded overflow-hidden border border-gray-200 dark:border-gray-600 text-xs">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 ${viewMode === 'table'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1 ${viewMode === 'timeline'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Timeline
              </button>
            </div>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {isExpanded && sorted.length === 0 && (
        <div className="px-4 py-6 text-center text-gray-400 text-sm">
          No upcoming outages for the selected region.
        </div>
      )}

      {isExpanded && sorted.length > 0 && viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
                <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Station</th>
                <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Region</th>
                <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Fuel</th>
                <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium text-right">Capacity Lost</th>
                <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Scheduled Start</th>
                <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Est. Return</th>
                <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Reason</th>
                <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((outage, idx) => (
                <tr
                  key={outage.outage_id}
                  className={`border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                    idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/20'
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">
                    {outage.station_name}
                    <div className="text-[10px] text-gray-400">{outage.duid}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge label={outage.region} variant="gray" size="xs" />
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{outage.fuel_type}</td>
                  <td className="px-3 py-2">{outageTypeBadge(outage.outage_type)}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-amber-600 dark:text-amber-400">
                    {outage.capacity_lost_mw.toLocaleString('en-AU')} MW
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                    {formatDateTime(outage.start_time)}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                    {outage.end_time ? formatDateTime(outage.end_time) : '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[220px]">
                    <span className="line-clamp-2">{outage.reason}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge label="UPCOMING" variant="amber" size="xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isExpanded && sorted.length > 0 && viewMode === 'timeline' && (
        <div className="p-4">
          {/* Timeline header — 14-day tick marks */}
          <div className="relative h-6 mb-2 ml-40">
            {[0, 2, 4, 7, 10, 14].map(day => (
              <div
                key={day}
                className="absolute top-0 text-[10px] text-gray-400 -translate-x-1/2"
                style={{ left: `${(day / 14) * 100}%` }}
              >
                {day === 0 ? 'Now' : `+${day}d`}
              </div>
            ))}
          </div>
          {/* Timeline rows */}
          <div className="space-y-2">
            {sorted.map((outage) => {
              const leftPct = toTimelinePct(outage.start_time)
              const widthPct = outage.end_time
                ? toWidthPct(outage.start_time, outage.end_time)
                : 8
              return (
                <div key={outage.outage_id} className="flex items-center gap-2">
                  <div className="w-40 shrink-0 text-right">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                      {outage.station_name}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {outage.capacity_lost_mw} MW
                    </div>
                  </div>
                  <div className="flex-1 relative h-6 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                    <div
                      className={`absolute top-0 h-full rounded ${typeColorMap[outage.outage_type] ?? 'bg-gray-400'} opacity-80`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      title={`${outage.reason}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex gap-4 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-red-400 rounded inline-block"></span> FORCED
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-amber-400 rounded inline-block"></span> PLANNED
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-blue-400 rounded inline-block"></span> PARTIAL
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent Returns section
// ---------------------------------------------------------------------------

interface RecentReturnsProps {
  outages: OutageRecord[]
}

function RecentReturns({ outages }: RecentReturnsProps) {
  if (outages.length === 0) return null
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <CheckCircle size={16} className="text-green-500" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Returned to Service (Last 24h)
        </h2>
        <Badge label={String(outages.length)} variant="green" size="xs" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
              <th className="px-3 py-2 text-gray-500 font-medium">Station</th>
              <th className="px-3 py-2 text-gray-500 font-medium">Region</th>
              <th className="px-3 py-2 text-gray-500 font-medium">Fuel</th>
              <th className="px-3 py-2 text-gray-500 font-medium">Type</th>
              <th className="px-3 py-2 text-gray-500 font-medium text-right">Capacity</th>
              <th className="px-3 py-2 text-gray-500 font-medium">Outage Start</th>
              <th className="px-3 py-2 text-gray-500 font-medium">Returned</th>
              <th className="px-3 py-2 text-gray-500 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {outages.map((outage, idx) => (
              <tr
                key={outage.outage_id}
                className={`border-t border-gray-100 dark:border-gray-700 ${
                  idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/20'
                }`}
              >
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">
                  {outage.station_name}
                </td>
                <td className="px-3 py-2">
                  <Badge label={outage.region} variant="gray" size="xs" />
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{outage.fuel_type}</td>
                <td className="px-3 py-2">{outageTypeBadge(outage.outage_type)}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                  {outage.capacity_lost_mw.toLocaleString('en-AU')} MW
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                  {formatDateTime(outage.start_time)}
                </td>
                <td className="px-3 py-2 text-green-600 dark:text-green-400 font-medium">
                  {outage.end_time ? formatDateTime(outage.end_time) : '—'}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[220px]">
                  <span className="line-clamp-2">{outage.reason}</span>
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
// Main page component
// ---------------------------------------------------------------------------

const REGIONS = ['ALL', 'NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

export default function OutageSchedule() {
  const [dashboard, setDashboard] = useState<PasaDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regionFilter, setRegionFilter] = useState('ALL')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getOutageDashboard()
      setDashboard(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load outage data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchDashboard, 60_000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  return (
    <div className="p-6 min-h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wrench size={22} className="text-amber-500" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                Outage Schedule &amp; PASA
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                PASA
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Projected Assessment of System Adequacy — NEM generator outage tracker
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Region selector */}
          <div className="flex rounded overflow-hidden border border-gray-200 dark:border-gray-600 text-xs">
            {REGIONS.map(r => (
              <button
                key={r}
                onClick={() => setRegionFilter(r)}
                className={`px-2.5 py-1.5 font-medium transition-colors ${
                  regionFilter === r
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Last updated timestamp */}
      {lastUpdated && (
        <div className="text-[10px] text-gray-400 mb-4 -mt-4">
          Last updated: {lastUpdated.toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>API unavailable — showing indicative mock data. ({error})</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !dashboard && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
          <div className="h-36 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      )}

      {/* Dashboard content */}
      {dashboard && (
        <>
          {/* Worst reserve day alert strip */}
          {dashboard.worst_reserve_mw < 750 && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                <strong>PASA Alert:</strong> Worst reserve day is{' '}
                <strong>{formatDate(dashboard.worst_reserve_day)}</strong> with only{' '}
                <strong>{formatReserve(dashboard.worst_reserve_mw)}</strong> reserve — LOR1 conditions forecast.
              </span>
            </div>
          )}

          <CapacityCards dashboard={dashboard} regionFilter={regionFilter} />
          <PasaOutlook outlook={dashboard.pasa_outlook} />
          <ActiveOutagesTable outages={dashboard.active_outages} regionFilter={regionFilter} />
          <UpcomingOutages outages={dashboard.upcoming_outages} regionFilter={regionFilter} />
          <RecentReturns outages={dashboard.recent_returns} />
        </>
      )}
    </div>
  )
}
