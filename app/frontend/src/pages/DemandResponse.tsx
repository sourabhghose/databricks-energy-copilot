import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Users, Zap, AlertTriangle, TrendingDown, RefreshCw } from 'lucide-react'
import { api, DspDashboard, DspParticipant, DspActivationEvent, LoadCurtailmentRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const SECTOR_COLOURS: Record<string, string> = {
  Manufacturing: '#3b82f6',
  Mining: '#f59e0b',
  'Water/Wastewater': '#06b6d4',
  Commercial: '#8b5cf6',
}

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  VIC1: '#8b5cf6',
  QLD1: '#f59e0b',
  SA1: '#ef4444',
  TAS1: '#10b981',
}

function regionChip(region: string) {
  const colour = REGION_COLOURS[region] ?? '#6b7280'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
      style={{ backgroundColor: colour }}
    >
      {region}
    </span>
  )
}

function sectorChip(sector: string) {
  const colour = SECTOR_COLOURS[sector] ?? '#6b7280'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
      style={{ backgroundColor: colour }}
    >
      {sector}
    </span>
  )
}

function programBadge(program: string) {
  const colours: Record<string, string> = {
    RERT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    ILRP: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'DSP Mechanism': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'VPP DR': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  }
  const cls = colours[program] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {program}
    </span>
  )
}

function triggerBadge(trigger: string) {
  const colours: Record<string, string> = {
    Emergency: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'High Price': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    'Market Trial': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    Testing: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  }
  const cls = colours[trigger] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {trigger}
    </span>
  )
}

function curtailmentBadge(type: string) {
  const colours: Record<string, string> = {
    Emergency: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    Voluntary: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    'Rolling Blackout': 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100',
  }
  const cls = colours[type] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  accent: string
}

function KpiCard({ title, value, subtitle, icon, accent }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Participants table
// ---------------------------------------------------------------------------

function ParticipantsTable({ participants }: { participants: DspParticipant[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">DSP Participants</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">DUID</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sector</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Region</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Capacity (MW)</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Response (min)</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Program</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Reliability %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {participants.map((p) => (
              <tr key={p.duid} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">{p.duid}</td>
                <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium">{p.participant_name}</td>
                <td className="px-4 py-2.5">{sectorChip(p.industry_sector)}</td>
                <td className="px-4 py-2.5">{regionChip(p.region)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">{p.registered_capacity_mw.toFixed(0)}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{p.response_time_minutes}</td>
                <td className="px-4 py-2.5">{programBadge(p.dsp_program)}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`font-semibold ${p.reliability_score_pct >= 97 ? 'text-green-600 dark:text-green-400' : p.reliability_score_pct >= 93 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                    {p.reliability_score_pct.toFixed(1)}%
                  </span>
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
// Sector capacity chart
// ---------------------------------------------------------------------------

function SectorCapacityChart({ participants }: { participants: DspParticipant[] }) {
  const sectorMap: Record<string, number> = {}
  for (const p of participants) {
    sectorMap[p.industry_sector] = (sectorMap[p.industry_sector] ?? 0) + p.registered_capacity_mw
  }
  const data = Object.entries(sectorMap).map(([sector, capacity_mw]) => ({ sector, capacity_mw }))
  data.sort((a, b) => b.capacity_mw - a.capacity_mw)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Registered Capacity by Sector (MW)</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="sector"
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickFormatter={(v: number) => `${v}`}
            label={{ value: 'MW', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#6b7280' } }}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(0)} MW`, 'Capacity']}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="capacity_mw" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.sector} fill={SECTOR_COLOURS[entry.sector] ?? '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activation Events table
// ---------------------------------------------------------------------------

function ActivationEventsTable({ activations }: { activations: DspActivationEvent[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Activation Events</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Event ID</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Region</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trigger</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Called (MW)</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Delivered (MW)</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Duration (min)</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">$/MWh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {activations.map((a) => (
              <tr key={a.event_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">{a.event_id}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{a.date}</td>
                <td className="px-4 py-2.5">{regionChip(a.region)}</td>
                <td className="px-4 py-2.5">{triggerBadge(a.trigger)}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{a.activated_mw.toFixed(0)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-green-700 dark:text-green-400">{a.delivered_mw.toFixed(0)}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{a.duration_minutes}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`font-semibold ${a.average_price_mwh >= 10000 ? 'text-red-600 dark:text-red-400' : a.average_price_mwh >= 3000 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    ${a.average_price_mwh.toLocaleString()}
                  </span>
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
// Curtailment Records table
// ---------------------------------------------------------------------------

function CurtailmentTable({ records }: { records: LoadCurtailmentRecord[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Load Curtailment Records</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Region</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Load Shed (MWh)</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Customers Affected</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Duration (min)</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trigger Event</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {records.map((r, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{r.date}</td>
                <td className="px-4 py-2.5">{regionChip(r.region)}</td>
                <td className="px-4 py-2.5">{curtailmentBadge(r.curtailment_type)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">{r.total_load_shed_mwh.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                  {r.customers_affected > 0 ? r.customers_affected.toLocaleString() : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{r.duration_minutes}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 max-w-xs truncate" title={r.trigger_event}>{r.trigger_event}</td>
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

export default function DemandResponse() {
  const [dashboard, setDashboard] = useState<DspDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getDspDashboard()
      setDashboard(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DSP dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Demand Side Participation & Load Curtailment
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            DSP programs, participant registry, activation events and curtailment records across the NEM
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {dashboard && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total DSP Capacity"
              value={`${dashboard.total_registered_capacity_mw.toLocaleString()} MW`}
              subtitle={`Top sector: ${dashboard.top_sector_by_capacity}`}
              icon={<Zap size={18} className="text-amber-600 dark:text-amber-400" />}
              accent="bg-amber-50 dark:bg-amber-900/20"
            />
            <KpiCard
              title="Participants"
              value={`${dashboard.total_participants}`}
              subtitle="Registered across NEM"
              icon={<Users size={18} className="text-blue-600 dark:text-blue-400" />}
              accent="bg-blue-50 dark:bg-blue-900/20"
            />
            <KpiCard
              title="Activations YTD"
              value={`${dashboard.activations_ytd}`}
              subtitle={`Avg reliability ${dashboard.avg_delivery_reliability_pct.toFixed(1)}%`}
              icon={<AlertTriangle size={18} className="text-red-600 dark:text-red-400" />}
              accent="bg-red-50 dark:bg-red-900/20"
            />
            <KpiCard
              title="Delivered MWh YTD"
              value={`${dashboard.total_delivered_mwh_ytd.toLocaleString()} MWh`}
              subtitle="Actual demand response delivered"
              icon={<TrendingDown size={18} className="text-green-600 dark:text-green-400" />}
              accent="bg-green-50 dark:bg-green-900/20"
            />
          </div>

          {/* Sector chart + participants */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <SectorCapacityChart participants={dashboard.participants} />
            </div>
            <div className="lg:col-span-2">
              <ParticipantsTable participants={dashboard.participants} />
            </div>
          </div>

          {/* Activation events */}
          <ActivationEventsTable activations={dashboard.activations} />

          {/* Curtailment records */}
          <CurtailmentTable records={dashboard.curtailment_records} />
        </>
      )}
    </div>
  )
}
