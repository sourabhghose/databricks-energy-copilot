import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Activity } from 'lucide-react'
import {
  getNemFrequencyControlDashboard,
  NFCPXDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#10b981',
  SA1:  '#ef4444',
  TAS1: '#8b5cf6',
}

const SERVICE_COLOURS: Record<string, string> = {
  'Raise 6s':   '#10b981',
  'Raise 60s':  '#34d399',
  'Raise 5min': '#6ee7b7',
  'Lower 6s':   '#ef4444',
  'Lower 60s':  '#f87171',
  'Lower 5min': '#fca5a5',
}

const TECHNOLOGY_COLOURS: Record<string, string> = {
  BESS:          '#3b82f6',
  Hydro:         '#06b6d4',
  'Gas Peaker':  '#f97316',
  'Pumped Hydro':'#8b5cf6',
}

const SEVERITY_COLOURS: Record<string, string> = {
  Minor:    '#10b981',
  Moderate: '#f59e0b',
  Major:    '#f97316',
  Critical: '#ef4444',
}

const STATUS_COLOURS: Record<string, string> = {
  Implemented:  '#10b981',
  'In Progress':'#f59e0b',
  Proposed:     '#6b7280',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KPICardProps {
  label: string
  value: string
  sub?: string
}

function KPICard({ label, value, sub }: KPICardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function NemFrequencyControlAnalytics() {
  const [data, setData] = useState<NFCPXDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNemFrequencyControlDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="p-6 text-red-600 dark:text-red-400">
        Failed to load NEM Frequency Control data: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-gray-500 dark:text-gray-400 animate-pulse">
        Loading NEM Frequency Control Performance Analytics...
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>

  // ---- Chart 1: time_in_band_pct by month for 5 regions ----
  const monthSet = Array.from(new Set(data.frequency_records.map(r => r.month))).sort()
  const timeInBandByMonth = monthSet.map(month => {
    const row: Record<string, unknown> = { month }
    for (const region of ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']) {
      const rec = data.frequency_records.find(r => r.month === month && r.region === region)
      row[region] = rec ? rec.time_in_band_pct : null
    }
    return row
  })

  // ---- Chart 2: Stacked bar — volume_mw by quarter x service ----
  const quarterSet = Array.from(new Set(data.fcas_market.map(f => f.quarter))).sort()
  const fcasVolumeByQuarter = quarterSet.map(quarter => {
    const row: Record<string, unknown> = { quarter }
    for (const service of ['Raise 6s', 'Raise 60s', 'Raise 5min', 'Lower 6s', 'Lower 60s', 'Lower 5min']) {
      const entries = data.fcas_market.filter(f => f.quarter === quarter && f.service === service)
      row[service] = entries.reduce((s, f) => s + f.volume_mw, 0)
    }
    return row
  })

  // ---- Chart 3: Bar — fcas_capacity_mw by provider_name ----
  const providerCapacity = data.providers
    .slice()
    .sort((a, b) => b.fcas_capacity_mw - a.fcas_capacity_mw)

  // ---- Chart 4: Scatter — nadir vs imbalance ----
  const scatterData = data.system_events.map(e => ({
    x: e.mw_imbalance,
    y: e.frequency_nadir_hz,
    z: e.duration_seconds,
    severity: e.severity,
    event_type: e.event_type,
  }))

  // ---- Chart 5: Bar — expected_benefit_mw by reform ----
  const reformData = data.reforms.slice().sort((a, b) => b.expected_benefit_mw - a.expected_benefit_mw)

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Activity className="text-blue-500 w-7 h-7" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            NEM Frequency Control Performance Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Frequency performance, FCAS market, provider analysis, system events and reform tracking
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Avg Time in Band"
          value={`${Number(summary.avg_time_in_band_pct ?? 0).toFixed(1)}%`}
          sub="49.85–50.15 Hz"
        />
        <KPICard
          label="Total FCAS Cost"
          value={`$${Number(summary.total_fcas_cost_m ?? 0).toFixed(1)}M`}
          sub="All services combined"
        />
        <KPICard
          label="Battery Share"
          value={`${Number(summary.battery_share_pct ?? 0).toFixed(1)}%`}
          sub="Avg FCAS battery share"
        />
        <KPICard
          label="Excursion Events YTD"
          value={String(summary.excursion_events_ytd ?? 0)}
          sub="Outside 49.5–50.5 Hz"
        />
      </div>

      {/* Chart 1: Time in Band by Month & Region */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Time in Normal Band (%) by Month and Region
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={timeInBandByMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis domain={[80, 100]} tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
            <Legend />
            {['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLOURS[region]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: FCAS Volume by Quarter & Service */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
          FCAS Volume (MW) by Quarter and Service
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={fcasVolumeByQuarter} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis dataKey="quarter" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} unit=" MW" />
            <Tooltip />
            <Legend />
            {['Raise 6s', 'Raise 60s', 'Raise 5min', 'Lower 6s', 'Lower 60s', 'Lower 5min'].map(service => (
              <Bar key={service} dataKey={service} stackId="a" fill={SERVICE_COLOURS[service]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Provider FCAS Capacity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
          FCAS Capacity (MW) by Provider and Technology
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={providerCapacity}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 140, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis type="number" tick={{ fontSize: 11 }} unit=" MW" />
            <YAxis type="category" dataKey="provider_name" tick={{ fontSize: 10 }} width={135} />
            <Tooltip formatter={(v: number) => `${v.toFixed(0)} MW`} />
            <Bar dataKey="fcas_capacity_mw" name="FCAS Capacity (MW)">
              {providerCapacity.map((entry, idx) => (
                <Cell key={idx} fill={TECHNOLOGY_COLOURS[entry.technology] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(TECHNOLOGY_COLOURS).map(([tech, colour]) => (
            <span key={tech} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 4: Scatter — Nadir vs Imbalance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Frequency Nadir vs MW Imbalance (dot size = duration, colour = severity)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              type="number"
              dataKey="x"
              name="MW Imbalance"
              unit=" MW"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Freq Nadir"
              unit=" Hz"
              tick={{ fontSize: 11 }}
              domain={[48, 50.1]}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (!payload || payload.length === 0) return null
                const d = payload[0].payload as typeof scatterData[0]
                return (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs shadow">
                    <p className="font-semibold">{d.event_type}</p>
                    <p>Nadir: {d.y.toFixed(3)} Hz</p>
                    <p>Imbalance: {d.x.toFixed(0)} MW</p>
                    <p>Duration: {d.z}s</p>
                    <p>Severity: {d.severity}</p>
                  </div>
                )
              }}
            />
            {(['Minor', 'Moderate', 'Major', 'Critical'] as const).map(sev => {
              const pts = scatterData.filter(d => d.severity === sev)
              return (
                <Scatter
                  key={sev}
                  name={sev}
                  data={pts}
                  fill={SEVERITY_COLOURS[sev]}
                />
              )
            })}
            <Legend />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Reform Expected Benefit */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Expected Benefit (MW) by Reform and Status
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={reformData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 210, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis type="number" tick={{ fontSize: 11 }} unit=" MW" />
            <YAxis type="category" dataKey="reform_name" tick={{ fontSize: 10 }} width={205} />
            <Tooltip formatter={(v: number) => `${v.toFixed(0)} MW`} />
            <Bar dataKey="expected_benefit_mw" name="Expected Benefit (MW)">
              {reformData.map((entry, idx) => (
                <Cell key={idx} fill={STATUS_COLOURS[entry.status] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
            <span key={status} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {status}
            </span>
          ))}
        </div>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Avg Time in Band</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {Number(summary.avg_time_in_band_pct ?? 0).toFixed(2)}%
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Total FCAS Cost</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              ${Number(summary.total_fcas_cost_m ?? 0).toFixed(2)}M
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Dominant FCAS Provider</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {String(summary.dominant_fcas_provider ?? '-')}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Excursion Events YTD</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {String(summary.excursion_events_ytd ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Battery Share</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {Number(summary.battery_share_pct ?? 0).toFixed(2)}%
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Providers Tracked</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {data.providers.length}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
