import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
} from 'recharts'
import { Zap, Car, Sun, Battery } from 'lucide-react'
import { api } from '../api/client'
import type { SolarEvDashboard, SolarGenerationRecord, EvFleetRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals)
}

function fmtM(n: number): string {
  return (n / 1_000_000).toFixed(2) + 'M'
}

function fmtK(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toLocaleString()
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${accent}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zone chip
// ---------------------------------------------------------------------------

function ZoneChip({ zone }: { zone: string }) {
  const colors: Record<string, string> = {
    metro: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    regional: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    rural: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[zone] ?? 'bg-gray-100 text-gray-600'}`}>
      {zone}
    </span>
  )
}

// ---------------------------------------------------------------------------
// EV type badge
// ---------------------------------------------------------------------------

function EvTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    BEV: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    PHEV: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    FCEV: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${colors[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// CF Progress bar
// ---------------------------------------------------------------------------

function CfBar({ value }: { value: number }) {
  const pct = Math.min(value, 100)
  const color = value >= 22 ? 'bg-amber-500' : value >= 18 ? 'bg-yellow-400' : 'bg-blue-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct * 3}%` }} />
      </div>
      <span className="text-xs text-gray-700 dark:text-gray-300">{fmt(value)}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// State filter selector
// ---------------------------------------------------------------------------

const STATES = ['All', 'NSW', 'QLD', 'VIC', 'SA', 'WA']

interface StateFilterProps {
  value: string
  onChange: (s: string) => void
}

function StateFilter({ value, onChange }: StateFilterProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {STATES.map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            value === s
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Duck Curve Chart
// ---------------------------------------------------------------------------

interface DuckCurveChartProps {
  profile: Array<{ hour: number; solar_mw: number; ev_charging_mw: number; net_demand_mw: number }>
}

function DuckCurveChart({ profile }: DuckCurveChartProps) {
  const data = profile.map(p => ({ ...p, label: hourLabel(p.hour) }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Duck Curve — Daily Solar & EV Charging Profile</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Solar generation (amber), EV charging demand (blue), net NEM demand (dark line)
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval={3}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10 }}
            tickFormatter={v => `${(v / 1000).toFixed(0)}GW`}
            label={{ value: 'MW (Solar / EV)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10 }}
            tickFormatter={v => `${(v / 1000).toFixed(0)}GW`}
            label={{ value: 'Net Demand (MW)', angle: 90, position: 'insideRight', style: { fontSize: 10 } }}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${(value / 1000).toFixed(2)} GW`,
              name === 'solar_mw' ? 'Solar Generation' : name === 'ev_charging_mw' ? 'EV Charging' : 'Net NEM Demand',
            ]}
            labelFormatter={l => `Hour: ${l}`}
          />
          <Legend
            formatter={v =>
              v === 'solar_mw' ? 'Solar Generation' : v === 'ev_charging_mw' ? 'EV Charging' : 'Net NEM Demand'
            }
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="solar_mw"
            fill="#fbbf24"
            stroke="#f59e0b"
            fillOpacity={0.4}
            name="solar_mw"
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="ev_charging_mw"
            fill="#60a5fa"
            stroke="#3b82f6"
            fillOpacity={0.4}
            name="ev_charging_mw"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="net_demand_mw"
            stroke="#1e293b"
            strokeWidth={2}
            dot={false}
            name="net_demand_mw"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Growth Projection Chart
// ---------------------------------------------------------------------------

interface GrowthChartProps {
  data: Array<{ year: number; solar_gw: number; ev_millions: number }>
}

function GrowthChart({ data }: GrowthChartProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Growth Projection 2024–2035</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Rooftop solar GW (amber, left axis) and EV fleet millions (blue, right axis)
        </p>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10 }}
            tickFormatter={v => `${v} GW`}
            label={{ value: 'Solar (GW)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10 }}
            tickFormatter={v => `${v}M`}
            label={{ value: 'EVs (M)', angle: 90, position: 'insideRight', style: { fontSize: 10 } }}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              name === 'solar_gw' ? `${value} GW` : `${value}M vehicles`,
              name === 'solar_gw' ? 'Rooftop Solar' : 'EV Fleet',
            ]}
          />
          <Legend formatter={v => (v === 'solar_gw' ? 'Rooftop Solar (GW)' : 'EV Fleet (millions)')} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="solar_gw"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#f59e0b' }}
            name="solar_gw"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="ev_millions"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#3b82f6' }}
            name="ev_millions"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Solar Records Table
// ---------------------------------------------------------------------------

interface SolarTableProps {
  records: SolarGenerationRecord[]
}

function SolarTable({ records }: SolarTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">State</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Zone</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Installed (MW)</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Gen Now (MW)</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">CF %</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Systems</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Avg Size (kW)</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Curtailment (MW)</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Export (MW)</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr
              key={`${r.state}-${r.postcode_zone}`}
              className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 ${
                i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/50'
              }`}
            >
              <td className="py-2 px-3 font-semibold text-gray-900 dark:text-white">{r.state}</td>
              <td className="py-2 px-3"><ZoneChip zone={r.postcode_zone} /></td>
              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{r.installed_capacity_mw.toLocaleString()}</td>
              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{fmt(r.avg_generation_mw)}</td>
              <td className="py-2 px-3"><CfBar value={r.capacity_factor_pct} /></td>
              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{fmtK(r.num_systems)}</td>
              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{fmt(r.avg_system_size_kw)}</td>
              <td className={`py-2 px-3 text-right font-medium ${r.curtailment_mw > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-500'}`}>
                {r.curtailment_mw > 0 ? fmt(r.curtailment_mw) : '—'}
              </td>
              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{fmt(r.export_to_grid_mw)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EV Fleet Table
// ---------------------------------------------------------------------------

interface EvTableProps {
  records: EvFleetRecord[]
}

function EvTable({ records }: EvTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">State</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Vehicles</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Growth %/yr</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Demand (MWh/day)</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Peak Hour</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Smart Chg %</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">V2G % / MW</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr
              key={`${r.state}-${r.ev_type}`}
              className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 ${
                i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/50'
              }`}
            >
              <td className="py-2 px-3 font-semibold text-gray-900 dark:text-white">{r.state}</td>
              <td className="py-2 px-3"><EvTypeBadge type={r.ev_type} /></td>
              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{r.total_vehicles.toLocaleString()}</td>
              <td className="py-2 px-3 text-right">
                <span className="text-green-600 dark:text-green-400 font-medium flex items-center justify-end gap-1">
                  ↑ {fmt(r.annual_growth_pct)}%
                </span>
              </td>
              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{fmt(r.daily_charging_demand_mwh, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{hourLabel(r.peak_charging_hour)}</td>
              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{fmt(r.smart_charging_capable_pct)}%</td>
              <td className="py-2 px-3 text-right">
                {r.v2g_capable_pct > 0 ? (
                  <span className="text-blue-600 dark:text-blue-400">
                    {fmt(r.v2g_capable_pct)}% / {fmt(r.v2g_potential_mw)} MW
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SolarEvAnalytics() {
  const [dashboard, setDashboard] = useState<SolarEvDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [solarStateFilter, setSolarStateFilter] = useState('All')
  const [evStateFilter, setEvStateFilter] = useState('All')

  useEffect(() => {
    setLoading(true)
    api.getSolarEvDashboard()
      .then(d => { setDashboard(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        <span className="ml-3 text-sm text-gray-500">Loading Solar & EV data…</span>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500 text-sm">{error ?? 'No data available'}</p>
      </div>
    )
  }

  const filteredSolar = solarStateFilter === 'All'
    ? dashboard.solar_records
    : dashboard.solar_records.filter(r => r.state === solarStateFilter)

  const filteredEv = evStateFilter === 'All'
    ? dashboard.ev_records
    : dashboard.ev_records.filter(r => r.state === evStateFilter)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sun className="text-amber-500" size={22} />
            Small-Scale Solar &amp; EV Fleet Analytics
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            APVI rooftop PV · behind-the-meter solar · EV fleet growth · managed charging · V2G potential
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold">
          <Zap size={12} />
          {fmt(dashboard.current_rooftop_generation_gw)} GW generating now
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Rooftop Solar Installed"
          value={`${fmt(dashboard.total_rooftop_solar_gw)} GW`}
          sub={`${fmt(dashboard.nem_solar_pct)}% of NEM demand offset`}
          icon={<Sun size={20} className="text-amber-600" />}
          accent="bg-amber-50 dark:bg-amber-900/20"
        />
        <KpiCard
          label="Current Generation"
          value={`${fmt(dashboard.current_rooftop_generation_gw)} GW`}
          sub={`Min demand impact: ${fmt(dashboard.minimum_demand_impact_mw / 1000)} GW`}
          icon={<Zap size={20} className="text-yellow-600" />}
          accent="bg-yellow-50 dark:bg-yellow-900/20"
        />
        <KpiCard
          label="Total EV Fleet"
          value={fmtM(dashboard.total_evs)}
          sub={`BEV: ${fmtM(dashboard.bev_count)} · Charging: ${fmt(dashboard.total_ev_charging_demand_mw)} MW`}
          icon={<Car size={20} className="text-blue-600" />}
          accent="bg-blue-50 dark:bg-blue-900/20"
        />
        <KpiCard
          label="V2G Fleet Potential"
          value={`${fmt(dashboard.v2g_fleet_potential_mw)} MW`}
          sub="Dispatchable V2G across all states"
          icon={<Battery size={20} className="text-green-600" />}
          accent="bg-green-50 dark:bg-green-900/20"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DuckCurveChart profile={dashboard.hourly_profile} />
        <GrowthChart data={dashboard.growth_projection} />
      </div>

      {/* Solar Records Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Rooftop Solar Generation by State &amp; Zone</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              APVI data — capacity factors, curtailment and NEM export by postcode zone
            </p>
          </div>
          <StateFilter value={solarStateFilter} onChange={setSolarStateFilter} />
        </div>
        {filteredSolar.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No records for selected state.</p>
        ) : (
          <SolarTable records={filteredSolar} />
        )}
      </div>

      {/* EV Fleet Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Electric Vehicle Fleet by State &amp; Type</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              BEV / PHEV / FCEV registrations · smart charging · V2G capability · managed demand response
            </p>
          </div>
          <StateFilter value={evStateFilter} onChange={setEvStateFilter} />
        </div>
        {filteredEv.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No records for selected state.</p>
        ) : (
          <EvTable records={filteredEv} />
        )}
      </div>
    </div>
  )
}
